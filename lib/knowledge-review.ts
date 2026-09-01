import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  WorkspaceDatabase,
  WorkspaceUser
} from "@/lib/supabase-admin";
import { toJson } from "@/lib/supabase-admin";
import { isRfc3339OffsetTimestamp } from "@/lib/rfc3339-timestamp";
import {
  buildKnowledgeReviewSourceSnapshotDigest,
  buildKnowledgeReviewSourceSnapshot,
  isStrictUuidV4,
  readCurrentSourceBoundCandidate,
  type KnowledgeReviewSourceEventRow
} from "@/lib/knowledge-review-prepare";
import { getSafetyKnowledgeHazardsByIds } from "@/lib/safety-knowledge";
import {
  buildKnowledgeCandidateReviewContract,
  evaluateKnowledgeCandidateContentReadiness,
  KNOWLEDGE_REVIEW_AUTHORITY_ORDER,
  readKnowledgeEventReviewFacts,
  type KnowledgeCandidateContentReadiness,
  type KnowledgeEventProvenance,
  type KnowledgeCandidateReviewContract
} from "@/lib/knowledge-governance";
import type {
  OntologyPromotionTrustedContext,
  OntologyPromotionCommand
} from "@/lib/ontology-promotion-policy";

export const KNOWLEDGE_REVIEW_RUN_STATUSES = [
  "draft",
  "generated",
  "review_required"
] as const;

type KnowledgeReviewClient = SupabaseClient<WorkspaceDatabase>;

export type KnowledgeReviewAction =
  | "approve_candidate"
  | "keep_site_only"
  | "reject";

export type KnowledgeReviewRequest = {
  runId: string;
  action: KnowledgeReviewAction;
};

export type KnowledgeReviewInboxPresentationDto = {
  runId: string;
  status: (typeof KNOWLEDGE_REVIEW_RUN_STATUSES)[number];
  statusLabel: string;
  sourceEventCount: number;
  candidateLabel: string;
  candidateText: string;
  matchedHazardCount: number;
  providerLabel: string | null;
  evidenceItems: KnowledgeReviewEvidenceItem[];
  traceItems: KnowledgeReviewTraceItem[];
  traceabilityComplete: boolean;
  reviewContract: Pick<
    KnowledgeCandidateReviewContract,
    | "contractVersion"
    | "status"
    | "presentAuthorityIds"
    | "sourceRoleCounts"
    | "statutoryClaimsRequireLawProvenance"
    | "tenantMemoryPublicPromotionAllowed"
    | "siteManagerAcceptanceRequiredBeforeWorkpackUse"
    | "publicationState"
    | "humanReviewRequired"
    | "machineEvidenceReplacesHumanReview"
  > | null;
  contentReadiness: KnowledgeCandidateContentReadiness | null;
};

type KnowledgeReviewEvidenceAuthorityId = typeof KNOWLEDGE_REVIEW_AUTHORITY_ORDER[number];

export type KnowledgeReviewEvidenceItem = {
  id: string;
  authorityId: KnowledgeReviewEvidenceAuthorityId;
  authorityLabel: string;
  sourceLabel: string;
  capturedAt: string;
  digest: string;
  metadata: Array<{ label: string; value: string }>;
  publicUrl: string | null;
  reviewFacts: string[];
};

export type KnowledgeReviewTraceItem = {
  id: string;
  hazardId: string;
  hazardTitle: string;
  controls: string[];
  primaryDocuments: string[];
  evidenceIds: string[];
  resolved: boolean;
  unresolvedReviewItems: string[];
};

const KNOWLEDGE_REVIEW_EVIDENCE_LIMIT = 20;
const EVIDENCE_AUTHORITY_LABELS: Record<KnowledgeReviewEvidenceAuthorityId, string> = {
  sif: "SIF 통제 근거",
  kosha: "KOSHA 기술 지침",
  law: "법령 근거",
  organization_history: "조직 전용 이력",
  site_history: "현장 전용 이력",
  external_context: "외부 작업 맥락"
};
const PUBLIC_EVIDENCE_AUTHORITIES = new Set<KnowledgeReviewEvidenceAuthorityId>(["sif", "kosha", "law"]);
const PUBLIC_EVIDENCE_HOSTS = ["law.go.kr", "kosha.or.kr", "data.go.kr"] as const;
const REVIEW_METADATA_LABELS: Record<string, string> = {
  article: "조문",
  articleNo: "조문 번호",
  article_number: "조문 번호",
  effectiveDate: "시행일",
  guideCode: "가이드 코드",
  guide_code: "가이드 코드",
  itemType: "자료 유형",
  item_type: "자료 유형"
};

function readVerifiedPublicEvidenceUrl(value: string | undefined): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    const hostname = url.hostname.toLowerCase();
    if (url.protocol !== "https:") return null;
    if (!PUBLIC_EVIDENCE_HOSTS.some((host) => hostname === host || hostname.endsWith(`.${host}`))) return null;
    url.username = "";
    url.password = "";
    url.hash = "";
    return url.toString();
  } catch {
    return null;
  }
}

function readPublicEvidenceTitle(value: string): string {
  return value.replace(/[\u0000-\u001f\u007f]/gu, " ").replace(/\s+/gu, " ").trim().slice(0, 160);
}

function buildEvidenceMetadata(provenance: KnowledgeEventProvenance): Array<{ label: string; value: string }> {
  if (!PUBLIC_EVIDENCE_AUTHORITIES.has(provenance.authorityId as KnowledgeReviewEvidenceAuthorityId)) return [];
  return Object.entries(provenance.payloadEvidence.reviewMetadata)
    .flatMap(([key, value]) => {
      const label = REVIEW_METADATA_LABELS[key];
      if (!label || value === null) return [];
      return [{ label, value: String(value).slice(0, 96) }];
    })
    .slice(0, 4);
}

function buildKnowledgeReviewEvidenceItems(input: {
  candidate: NonNullable<ReturnType<typeof readCurrentSourceBoundCandidate>>;
  rawEvents: ReturnType<typeof buildKnowledgeReviewSourceSnapshot>["rawEvents"];
}): KnowledgeReviewEvidenceItem[] {
  const items = input.candidate.provenance.map((provenance, index) => {
    const authorityId = provenance.authorityId as KnowledgeReviewEvidenceAuthorityId;
    const rawEvent = input.rawEvents[index];
    const isPublic = PUBLIC_EVIDENCE_AUTHORITIES.has(authorityId);
    const publicTitle = isPublic && rawEvent ? readPublicEvidenceTitle(rawEvent.title) : "";
    return {
      id: `evidence-${provenance.eventReference.digest.slice(0, 16)}`,
      authorityId,
      authorityLabel: EVIDENCE_AUTHORITY_LABELS[authorityId],
      sourceLabel: publicTitle || EVIDENCE_AUTHORITY_LABELS[authorityId],
      capturedAt: provenance.eventReference.capturedAt,
      digest: `sha256:${provenance.eventReference.digest.slice(0, 16)}`,
      metadata: buildEvidenceMetadata(provenance),
      publicUrl: isPublic ? readVerifiedPublicEvidenceUrl(rawEvent?.url) : null,
      reviewFacts: rawEvent ? readKnowledgeEventReviewFacts([rawEvent]) : []
    } satisfies KnowledgeReviewEvidenceItem;
  });
  return items
    .sort((left, right) => (
      KNOWLEDGE_REVIEW_AUTHORITY_ORDER.indexOf(left.authorityId)
      - KNOWLEDGE_REVIEW_AUTHORITY_ORDER.indexOf(right.authorityId)
    ))
    .slice(0, KNOWLEDGE_REVIEW_EVIDENCE_LIMIT);
}

const TRACE_DOCUMENT_LABELS: Record<string, string> = {
  riskAssessment: "위험성평가표",
  workPlan: "작업계획서",
  workpackSummary: "작업 요약",
  tbmBriefing: "TBM 브리핑",
  tbmLog: "TBM 기록",
  safetyEducation: "안전보건교육",
  emergencyResponse: "비상대응 절차",
  photoEvidence: "사진 증빙",
  foreignWorkerBriefing: "외국인 근로자 안내문",
  foreignWorkerTransmission: "외국인 근로자 전파문",
  dispatch: "현장 전파"
};
const KNOWLEDGE_REVIEW_TRACE_MAPPING_LIMIT = 12;

function buildKnowledgeReviewTraceItems(input: {
  candidate: NonNullable<ReturnType<typeof readCurrentSourceBoundCandidate>>;
  rawEvents: ReturnType<typeof buildKnowledgeReviewSourceSnapshot>["rawEvents"];
  evidenceItems: KnowledgeReviewEvidenceItem[];
}): KnowledgeReviewTraceItem[] {
  const evidenceByDigest = new Map(input.evidenceItems.map((item) => [item.digest.slice("sha256:".length), item.id]));
  const evidenceIdsByHazard = new Map<string, Set<string>>();
  input.candidate.provenance.forEach((provenance, index) => {
    const evidenceId = evidenceByDigest.get(provenance.eventReference.digest.slice(0, 16));
    if (!evidenceId) return;
    for (const hazardId of input.rawEvents[index]?.relatedHazardIds ?? []) {
      const ids = evidenceIdsByHazard.get(hazardId) ?? new Set<string>();
      ids.add(evidenceId);
      evidenceIdsByHazard.set(hazardId, ids);
    }
  });
  const knownHazards = getSafetyKnowledgeHazardsByIds(input.candidate.matchedHazardIds);
  const knownIds = new Set(knownHazards.map((hazard) => hazard.id));
  const traces = knownHazards.map((hazard) => {
    const evidenceIds = [...(evidenceIdsByHazard.get(hazard.id) ?? [])];
    const canonicalControls = [...new Set(hazard.controls.map((item) => item.trim()).filter(Boolean))];
    const canonicalPrimaryDocuments = [...new Set(hazard.primaryDocuments.map((item) => TRACE_DOCUMENT_LABELS[item] ?? item))];
    const controls = canonicalControls.slice(0, KNOWLEDGE_REVIEW_TRACE_MAPPING_LIMIT);
    const primaryDocuments = canonicalPrimaryDocuments.slice(0, KNOWLEDGE_REVIEW_TRACE_MAPPING_LIMIT);
    const unresolvedReviewItems = [
      ...(controls.length === 0 ? ["missing_controls"] : []),
      ...(primaryDocuments.length === 0 ? ["missing_primary_documents"] : []),
      ...(evidenceIds.length === 0 ? ["missing_bound_evidence"] : []),
      ...(canonicalControls.length > controls.length ? ["control_mapping_limit_exceeded"] : []),
      ...(canonicalPrimaryDocuments.length > primaryDocuments.length ? ["document_mapping_limit_exceeded"] : [])
    ];
    return {
      id: `trace-${hazard.id}`,
      hazardId: hazard.id,
      hazardTitle: hazard.title,
      controls,
      primaryDocuments,
      evidenceIds,
      resolved: unresolvedReviewItems.length === 0,
      unresolvedReviewItems
    } satisfies KnowledgeReviewTraceItem;
  });
  for (const hazardId of input.candidate.matchedHazardIds) {
    if (knownIds.has(hazardId)) continue;
    traces.push({
      id: `trace-unresolved-${traces.length + 1}`,
      hazardId: "unresolved",
      hazardTitle: "등록되지 않은 위험요인",
      controls: [],
      primaryDocuments: [],
      evidenceIds: [...(evidenceIdsByHazard.get(hazardId) ?? [])],
      resolved: false,
      unresolvedReviewItems: ["unknown_hazard", "missing_controls", "missing_primary_documents"]
    });
  }
  return traces.slice(0, 20);
}

export type KnowledgeReviewFailureUpdates = {
  runUpdated: boolean;
  eventsUpdated: boolean;
  eventsUpdatedCount: number;
  eventsTotal: number;
};

export class KnowledgeReviewError extends Error {
  readonly status: number;
  readonly code: string;
  readonly compensationRequired: boolean;
  readonly updates: KnowledgeReviewFailureUpdates;

  constructor(input: {
    status: number;
    code: string;
    message: string;
    compensationRequired?: boolean;
    updates?: KnowledgeReviewFailureUpdates;
    cause?: unknown;
  }) {
    super(input.message, { cause: input.cause });
    this.name = "KnowledgeReviewError";
    this.status = input.status;
    this.code = input.code;
    this.compensationRequired = input.compensationRequired ?? false;
    this.updates = input.updates ?? {
      runUpdated: false,
      eventsUpdated: false,
      eventsUpdatedCount: 0,
      eventsTotal: 0
    };
  }
}

type KnowledgeEventRow = WorkspaceDatabase["public"]["Tables"]["knowledge_events"]["Row"];
type KnowledgeRunRow = WorkspaceDatabase["public"]["Tables"]["knowledge_regeneration_runs"]["Row"];
type ReviewEventRow = Pick<KnowledgeEventRow,
  | "id"
  | "organization_id"
  | "site_id"
  | "source"
  | "source_id"
  | "captured_at"
  | "title"
  | "url"
  | "payload"
  | "related_hazard_ids"
  | "reflected_documents"
  | "review_status"
  | "created_at"
>;
type ReviewRunRow = Pick<KnowledgeRunRow,
  | "id"
  | "organization_id"
  | "site_id"
  | "question"
  | "raw_event_ids"
  | "generated_output"
  | "provider"
  | "status"
  | "created_at"
>;

type KnowledgeReviewDropReason =
  | "raw_event_ids_empty"
  | "raw_event_ids_duplicate"
  | "raw_event_missing_or_not_pending"
  | "tenant_mismatch"
  | "site_tenant_mismatch"
  | "generated_output_invalid"
  | "shared_event_conflict";

export function findSharedEventConflictRunIds(
  runs: ReadonlyArray<{ id: string; rawEventIds: readonly string[] }>
): Set<string> {
  const runIdsByEventId = new Map<string, Set<string>>();
  for (const run of runs) {
    for (const eventId of new Set(run.rawEventIds)) {
      const runIds = runIdsByEventId.get(eventId) ?? new Set<string>();
      runIds.add(run.id);
      runIdsByEventId.set(eventId, runIds);
    }
  }

  const conflictedRunIds = new Set<string>();
  for (const runIds of runIdsByEventId.values()) {
    if (runIds.size < 2) continue;
    for (const runId of runIds) conflictedRunIds.add(runId);
  }
  return conflictedRunIds;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function parseKnowledgeReviewRequest(value: unknown): KnowledgeReviewRequest | null {
  if (!isRecord(value)) return null;
  const runId = typeof value.runId === "string" ? value.runId.trim() : "";
  const action = value.action;
  if (!isStrictUuidV4(runId)) return null;
  if (action !== "approve_candidate" && action !== "keep_site_only" && action !== "reject") {
    return null;
  }
  return { runId, action };
}

export async function loadKnowledgeReviewInbox(
  client: KnowledgeReviewClient,
  user: WorkspaceUser
) {
  const { data: organizations, error: organizationError } = await client
    .from("organizations")
    .select("id")
    .eq("owner_id", user.id);

  if (organizationError) throw organizationError;
  const organizationIds = (organizations ?? []).map((organization) => organization.id);
  if (organizationIds.length === 0) {
    return {
      queue: [],
      dropped: {
        runCount: 0,
        eventCount: 0,
        reasons: []
      }
    };
  }

  const { data: sites, error: siteError } = await client
    .from("sites")
    .select("id,organization_id")
    .in("organization_id", organizationIds);
  if (siteError) throw siteError;
  const siteIds = (sites ?? []).map((site) => site.id);
  const siteOrganizationById = new Map((sites ?? []).map((site) => [site.id, site.organization_id]));
  if (siteIds.length === 0) {
    return {
      queue: [],
      dropped: { runCount: 0, eventCount: 0, reasons: [] }
    };
  }

  const { data: events, error: eventError } = await client
    .from("knowledge_events")
    .select("id,organization_id,site_id,source,source_id,captured_at,title,url,payload,related_hazard_ids,reflected_documents,review_status,created_at")
    .in("organization_id", organizationIds)
    .in("site_id", siteIds)
    .eq("review_status", "pending_review")
    .order("created_at", { ascending: false });

  if (eventError) throw eventError;

  const { data: runs, error: runError } = await client
    .from("knowledge_regeneration_runs")
    .select("id,organization_id,site_id,question,raw_event_ids,generated_output,provider,status,created_at")
    .in("organization_id", organizationIds)
    .in("site_id", siteIds)
    .in("status", [...KNOWLEDGE_REVIEW_RUN_STATUSES])
    .order("created_at", { ascending: false });

  if (runError) throw runError;

  const eventById = new Map((events ?? []).map((event) => [event.id, event]));
  const droppedReasons: Array<{ runId: string; reason: KnowledgeReviewDropReason }> = [];
  const relationValidRuns: Array<{ run: ReviewRunRow; events: ReviewEventRow[] }> = [];
  const runsByTenantScope = new Map<string, ReviewRunRow[]>();
  for (const run of runs ?? []) {
    const scopeKey = JSON.stringify([run.organization_id, run.site_id]);
    const scopedRuns = runsByTenantScope.get(scopeKey) ?? [];
    scopedRuns.push(run);
    runsByTenantScope.set(scopeKey, scopedRuns);
  }
  const sharedConflictRunIds = new Set<string>();
  for (const scopedRuns of runsByTenantScope.values()) {
    for (const runId of findSharedEventConflictRunIds(scopedRuns.map((run) => ({
      id: run.id,
      rawEventIds: run.raw_event_ids
    })))) {
      sharedConflictRunIds.add(runId);
    }
  }

  for (const run of runs ?? []) {
    if (sharedConflictRunIds.has(run.id)) {
      droppedReasons.push({ runId: run.id, reason: "shared_event_conflict" });
      continue;
    }
    if (run.site_id !== null && siteOrganizationById.get(run.site_id) !== run.organization_id) {
      droppedReasons.push({ runId: run.id, reason: "site_tenant_mismatch" });
      continue;
    }
    if (!isRecord(run.generated_output)) {
      droppedReasons.push({ runId: run.id, reason: "generated_output_invalid" });
      continue;
    }
    if (run.raw_event_ids.length === 0) {
      droppedReasons.push({ runId: run.id, reason: "raw_event_ids_empty" });
      continue;
    }
    const uniqueEventIds = [...new Set(run.raw_event_ids)];
    if (uniqueEventIds.length !== run.raw_event_ids.length) {
      droppedReasons.push({ runId: run.id, reason: "raw_event_ids_duplicate" });
      continue;
    }
    const relatedEvents = uniqueEventIds
      .map((eventId) => eventById.get(eventId))
      .filter((event): event is ReviewEventRow => event !== undefined);
    if (relatedEvents.length !== uniqueEventIds.length) {
      droppedReasons.push({ runId: run.id, reason: "raw_event_missing_or_not_pending" });
      continue;
    }
    const tenantMatches = relatedEvents.every((event) => (
      event.organization_id === run.organization_id
      && event.site_id === run.site_id
      && event.review_status === "pending_review"
    ));
    if (!tenantMatches) {
      droppedReasons.push({ runId: run.id, reason: "tenant_mismatch" });
      continue;
    }
    if (run.status === "review_required") {
      if (!run.site_id) {
        droppedReasons.push({ runId: run.id, reason: "site_tenant_mismatch" });
        continue;
      }
      const sourceBinding = buildKnowledgeReviewSourceSnapshot({
        eventIds: uniqueEventIds,
        events: relatedEvents as KnowledgeReviewSourceEventRow[],
        tenantContext: { organizationId: run.organization_id, siteId: run.site_id }
      });
      if (!readCurrentSourceBoundCandidate(run.generated_output, sourceBinding.snapshot)) {
        droppedReasons.push({ runId: run.id, reason: "generated_output_invalid" });
        continue;
      }
    }
    relationValidRuns.push({ run, events: relatedEvents });
  }

  const queue: KnowledgeReviewInboxPresentationDto[] = relationValidRuns.map(({ run, events: relatedEvents }) => {
    const sourceEventCount = relatedEvents.length;
    const sourceBinding = run.site_id && run.status === "review_required"
      ? buildKnowledgeReviewSourceSnapshot({
          eventIds: run.raw_event_ids,
          events: relatedEvents as KnowledgeReviewSourceEventRow[],
          tenantContext: { organizationId: run.organization_id, siteId: run.site_id }
        })
      : null;
    const candidate = sourceBinding
      ? readCurrentSourceBoundCandidate(run.generated_output, sourceBinding.snapshot)
      : null;
    const reviewContract = candidate ? buildKnowledgeCandidateReviewContract(candidate) : null;
    const evidenceItems = candidate && sourceBinding
      ? buildKnowledgeReviewEvidenceItems({ candidate, rawEvents: sourceBinding.rawEvents })
      : [];
    const traceItems = candidate && sourceBinding
      ? buildKnowledgeReviewTraceItems({ candidate, rawEvents: sourceBinding.rawEvents, evidenceItems })
      : [];
    return {
      runId: run.id,
      status: run.status as KnowledgeReviewInboxPresentationDto["status"],
      statusLabel: run.status === "review_required" ? "검토 대기" : "후보 준비 전",
      sourceEventCount,
      candidateLabel: candidate?.question ?? `원본 이벤트 ${sourceEventCount}건 후보 준비`,
      candidateText: candidate?.generatedText ?? "",
      matchedHazardCount: candidate?.matchedHazardIds.length ?? 0,
      providerLabel: candidate?.providerLabel ?? null,
      evidenceItems,
      traceItems,
      traceabilityComplete: Boolean(candidate)
        && traceItems.length === candidate?.matchedHazardIds.length
        && traceItems.length > 0
        && traceItems.every((item) => item.resolved),
      reviewContract: reviewContract ? {
        contractVersion: reviewContract.contractVersion,
        status: reviewContract.status,
        presentAuthorityIds: reviewContract.presentAuthorityIds,
        sourceRoleCounts: reviewContract.sourceRoleCounts,
        statutoryClaimsRequireLawProvenance: reviewContract.statutoryClaimsRequireLawProvenance,
        tenantMemoryPublicPromotionAllowed: reviewContract.tenantMemoryPublicPromotionAllowed,
        siteManagerAcceptanceRequiredBeforeWorkpackUse: reviewContract.siteManagerAcceptanceRequiredBeforeWorkpackUse,
        publicationState: reviewContract.publicationState,
        humanReviewRequired: reviewContract.humanReviewRequired,
        machineEvidenceReplacesHumanReview: reviewContract.machineEvidenceReplacesHumanReview
      } : null,
      contentReadiness: candidate ? evaluateKnowledgeCandidateContentReadiness(candidate) : null
    };
  });
  const includedEventIds = new Set(relationValidRuns.flatMap((item) => item.events.map((event) => event.id)));

  return {
    queue,
    dropped: {
      runCount: droppedReasons.length,
      eventCount: (events ?? []).filter((event) => !includedEventIds.has(event.id)).length,
      reasons: droppedReasons
    }
  };
}

function assertReadSucceeded(error: unknown, message: string): void {
  if (!error) return;
  throw new KnowledgeReviewError({
    status: 500,
    code: "review_validation_read_failed",
    message,
    cause: error
  });
}

function actionTransition(action: KnowledgeReviewAction) {
  if (action === "reject") {
    return {
      runStatus: "failed" as const,
      eventReviewStatus: "rejected" as const,
      scope: "rejected" as const
    };
  }
  return {
    runStatus: "approved" as const,
    eventReviewStatus: "approved" as const,
    scope: action === "keep_site_only" ? "site_private" as const : "promotion_candidate" as const
  };
}

export type HumanReviewReceipt = {
  contractVersion: "knowledge-human-review.v1";
  operationId: string;
  action: KnowledgeReviewAction;
  scope: "rejected" | "site_private" | "promotion_candidate";
  runId: string;
  organizationId: string;
  siteId: string | null;
  reviewer: {
    id: string;
    email: string | null;
  };
  reviewedAt: string;
  publicationState: "unpublished";
  ontologyPublished: false;
  publishPerformed: false;
  migrationPerformed: false;
  atomic: false;
};

type LegacyHumanReviewReceipt = Omit<HumanReviewReceipt,
  | "operationId"
  | "runId"
  | "organizationId"
  | "siteId"
>;

type ReceiptOperationContext = {
  request: KnowledgeReviewRequest;
  user: WorkspaceUser;
  runId: string;
  organizationId: string;
  siteId: string | null;
};

function buildHumanReviewReceipt(input: {
  request: KnowledgeReviewRequest;
  user: WorkspaceUser;
  reviewedAt: string;
  runId: string;
  organizationId: string;
  siteId: string | null;
}): HumanReviewReceipt {
  const transition = actionTransition(input.request.action);
  return {
    contractVersion: "knowledge-human-review.v1" as const,
    operationId: `knowledge-review:${input.runId}:${input.request.action}`,
    action: input.request.action,
    scope: transition.scope,
    runId: input.runId,
    organizationId: input.organizationId,
    siteId: input.siteId,
    reviewer: {
      id: input.user.id,
      email: input.user.email
    },
    reviewedAt: input.reviewedAt,
    publicationState: "unpublished" as const,
    ontologyPublished: false,
    publishPerformed: false,
    migrationPerformed: false,
    atomic: false
  };
}

function readHumanReviewReceipt(value: unknown): HumanReviewReceipt | null {
  if (!isRecord(value) || !isRecord(value.humanReviewReceipt)) return null;
  const receipt = value.humanReviewReceipt;
  if (
    receipt.contractVersion !== "knowledge-human-review.v1"
    || typeof receipt.operationId !== "string"
    || (receipt.action !== "approve_candidate"
      && receipt.action !== "keep_site_only"
      && receipt.action !== "reject")
    || (receipt.scope !== "promotion_candidate"
      && receipt.scope !== "site_private"
      && receipt.scope !== "rejected")
    || typeof receipt.runId !== "string"
    || typeof receipt.organizationId !== "string"
    || (receipt.siteId !== null && typeof receipt.siteId !== "string")
    || !isRecord(receipt.reviewer)
    || typeof receipt.reviewer.id !== "string"
    || (receipt.reviewer.email !== null && typeof receipt.reviewer.email !== "string")
    || !isRfc3339OffsetTimestamp(receipt.reviewedAt)
    || receipt.publicationState !== "unpublished"
    || receipt.ontologyPublished !== false
    || receipt.publishPerformed !== false
    || receipt.migrationPerformed !== false
    || receipt.atomic !== false
  ) {
    return null;
  }
  return receipt as HumanReviewReceipt;
}

function readLegacyHumanReviewReceipt(value: unknown): LegacyHumanReviewReceipt | null {
  if (!isRecord(value) || !isRecord(value.humanReviewReceipt)) return null;
  const receipt = value.humanReviewReceipt;
  const identityFields = ["operationId", "runId", "organizationId", "siteId"] as const;
  if (identityFields.some((field) => Object.prototype.hasOwnProperty.call(receipt, field))) {
    return null;
  }
  if (
    receipt.contractVersion !== "knowledge-human-review.v1"
    || (receipt.action !== "approve_candidate"
      && receipt.action !== "keep_site_only"
      && receipt.action !== "reject")
    || (receipt.scope !== "promotion_candidate"
      && receipt.scope !== "site_private"
      && receipt.scope !== "rejected")
    || !isRecord(receipt.reviewer)
    || typeof receipt.reviewer.id !== "string"
    || (receipt.reviewer.email !== null && typeof receipt.reviewer.email !== "string")
    || !isRfc3339OffsetTimestamp(receipt.reviewedAt)
    || receipt.publicationState !== "unpublished"
    || receipt.ontologyPublished !== false
    || receipt.publishPerformed !== false
    || receipt.migrationPerformed !== false
    || receipt.atomic !== false
  ) {
    return null;
  }
  return receipt as LegacyHumanReviewReceipt;
}

function receiptMatchesOperation(input: {
  receipt: HumanReviewReceipt;
  request: KnowledgeReviewRequest;
  user: WorkspaceUser;
  runId: string;
  organizationId: string;
  siteId: string | null;
}): boolean {
  const transition = actionTransition(input.request.action);
  return input.receipt.operationId === `knowledge-review:${input.runId}:${input.request.action}`
    && input.receipt.action === input.request.action
    && input.receipt.scope === transition.scope
    && input.receipt.runId === input.runId
    && input.receipt.organizationId === input.organizationId
    && input.receipt.siteId === input.siteId
    && input.receipt.reviewer.id === input.user.id;
}

function resolveHumanReviewReceipt(
  value: unknown,
  context: ReceiptOperationContext
): { receipt: HumanReviewReceipt; needsUpgrade: boolean } | null {
  const currentReceipt = readHumanReviewReceipt(value);
  if (currentReceipt) {
    return receiptMatchesOperation({ receipt: currentReceipt, ...context })
      ? { receipt: currentReceipt, needsUpgrade: false }
      : null;
  }

  const legacyReceipt = readLegacyHumanReviewReceipt(value);
  if (!legacyReceipt) return null;
  const transition = actionTransition(context.request.action);
  if (
    legacyReceipt.action !== context.request.action
    || legacyReceipt.scope !== transition.scope
    || legacyReceipt.reviewer.id !== context.user.id
  ) {
    return null;
  }

  return {
    receipt: {
      ...legacyReceipt,
      operationId: `knowledge-review:${context.runId}:${context.request.action}`,
      runId: context.runId,
      organizationId: context.organizationId,
      siteId: context.siteId
    },
    needsUpgrade: true
  };
}

function receiptsAreConsistent(left: HumanReviewReceipt, right: HumanReviewReceipt): boolean {
  return left.operationId === right.operationId
    && left.reviewedAt === right.reviewedAt
    && left.reviewer.id === right.reviewer.id
    && left.reviewer.email === right.reviewer.email;
}

function hasSafeReviewEnvelope(value: unknown): boolean {
  return isRecord(value)
    && value.publicationState === "unpublished"
    && value.ontologyPublished === false
    && value.publishPerformed === false
    && value.migrationPerformed === false;
}

function buildReviewedOutput(input: {
  generatedOutput: unknown;
  receipt: HumanReviewReceipt;
}) {
  const preservedOutput = isRecord(input.generatedOutput)
    ? input.generatedOutput
    : { candidateOutput: input.generatedOutput };

  return {
    ...preservedOutput,
    publicationState: "unpublished" as const,
    ontologyPublished: false,
    publishPerformed: false,
    migrationPerformed: false,
    humanReviewReceipt: input.receipt
  };
}

function buildReviewedEventProposal(input: {
  proposedWikiUpdate: unknown;
  receipt: HumanReviewReceipt;
}) {
  const preservedProposal = isRecord(input.proposedWikiUpdate)
    ? input.proposedWikiUpdate
    : { candidateProposedWikiUpdate: input.proposedWikiUpdate };
  return {
    ...preservedProposal,
    publicationState: "unpublished" as const,
    ontologyPublished: false,
    publishPerformed: false,
    migrationPerformed: false,
    humanReviewReceipt: input.receipt
  };
}

function buildKnowledgeReviewSuccessResult(input: {
  request: KnowledgeReviewRequest;
  user: WorkspaceUser;
  run: {
    id: string;
    organization_id: string;
    site_id: string | null;
  };
  transition: ReturnType<typeof actionTransition>;
  runUpdated: boolean;
  eventsUpdated: boolean;
  eventsUpdatedCount: number;
  eventsTotal: number;
}) {
  return {
    ok: true as const,
    action: input.request.action,
    runId: input.run.id,
    organizationId: input.run.organization_id,
    siteId: input.run.site_id,
    runStatus: input.transition.runStatus,
    eventReviewStatus: input.transition.eventReviewStatus,
    publicationState: "unpublished" as const,
    ontologyPublished: false,
    publishPerformed: false,
    migrationPerformed: false,
    atomic: false,
    compensationRequired: false,
    updates: {
      runUpdated: input.runUpdated,
      eventsUpdated: input.eventsUpdated,
      eventsUpdatedCount: input.eventsUpdatedCount,
      eventsTotal: input.eventsTotal
    },
    reviewer: {
      id: input.user.id,
      email: input.user.email
    }
  };
}

export async function loadOntologyPromotionTrustedContext(
  client: KnowledgeReviewClient,
  user: WorkspaceUser,
  command: OntologyPromotionCommand
): Promise<OntologyPromotionTrustedContext> {
  const { data: organization, error: organizationError } = await client
    .from("organizations")
    .select("id")
    .eq("id", command.organizationId)
    .eq("owner_id", user.id)
    .maybeSingle();
  assertReadSucceeded(organizationError, "승격 명령의 조직 소유권을 확인하지 못했습니다.");
  if (!organization) {
    throw new KnowledgeReviewError({
      status: 403,
      code: "promotion_tenant_forbidden",
      message: "승격 명령의 조직을 검토할 권한이 없습니다."
    });
  }

  const { data: site, error: siteError } = await client
    .from("sites")
    .select("id,organization_id")
    .eq("id", command.siteId)
    .eq("organization_id", command.organizationId)
    .maybeSingle();
  assertReadSucceeded(siteError, "승격 명령의 현장 소유권을 확인하지 못했습니다.");
  if (!site) {
    throw new KnowledgeReviewError({
      status: 403,
      code: "promotion_site_forbidden",
      message: "승격 명령의 현장이 조직 범위와 일치하지 않습니다."
    });
  }

  const { data: run, error: runError } = await client
    .from("knowledge_regeneration_runs")
    .select("id,organization_id,site_id,raw_event_ids,generated_output,status")
    .eq("id", command.runId)
    .eq("organization_id", command.organizationId)
    .eq("site_id", command.siteId)
    .maybeSingle();
  assertReadSucceeded(runError, "승격 명령의 저장된 검토 run을 확인하지 못했습니다.");
  if (!run) {
    throw new KnowledgeReviewError({
      status: 403,
      code: "promotion_run_forbidden",
      message: "승격 명령과 일치하는 저장된 run이 없습니다."
    });
  }
  if (run.status !== "approved") {
    throw new KnowledgeReviewError({
      status: 409,
      code: "promotion_human_approval_required",
      message: "사람 검토가 승인 완료된 run만 승격 명령을 준비할 수 있습니다."
    });
  }

  const receiptContext: ReceiptOperationContext = {
    request: { runId: command.runId, action: command.action },
    user,
    runId: run.id,
    organizationId: run.organization_id,
    siteId: run.site_id
  };
  const receiptResolution = resolveHumanReviewReceipt(run.generated_output, receiptContext);
  if (!receiptResolution || receiptResolution.needsUpgrade) {
    throw new KnowledgeReviewError({
      status: 409,
      code: "promotion_stored_receipt_invalid",
      message: "저장된 사람 검토 영수증이 현재 승격 명령과 일치하지 않습니다."
    });
  }

  const eventIds = [...new Set(run.raw_event_ids)];
  if (eventIds.length === 0 || eventIds.length !== run.raw_event_ids.length) {
    throw new KnowledgeReviewError({
      status: 409,
      code: "promotion_source_set_invalid",
      message: "승격 명령의 저장된 원본 이벤트 연결이 유효하지 않습니다."
    });
  }
  const { data: events, error: eventsError } = await client
    .from("knowledge_events")
    .select("id,organization_id,site_id,source,source_id,captured_at,title,url,payload,related_hazard_ids,reflected_documents,review_status,proposed_wiki_update")
    .in("id", eventIds)
    .eq("organization_id", command.organizationId)
    .eq("site_id", command.siteId);
  assertReadSucceeded(eventsError, "승격 명령의 저장된 원본 이벤트를 확인하지 못했습니다.");
  const storedEvents = events ?? [];
  const storedEventIds = new Set(storedEvents.map((event) => event.id));
  const eventsAreApproved = storedEvents.length === eventIds.length
    && eventIds.every((eventId) => storedEventIds.has(eventId))
    && storedEvents.every((event) => event.review_status === "approved");
  if (!eventsAreApproved) {
    throw new KnowledgeReviewError({
      status: 409,
      code: "promotion_source_approval_incomplete",
      message: "모든 저장된 원본 이벤트의 사람 검토가 완료되지 않았습니다."
    });
  }
  for (const event of storedEvents) {
    const eventReceipt = resolveHumanReviewReceipt(event.proposed_wiki_update, receiptContext);
    if (!eventReceipt
      || eventReceipt.needsUpgrade
      || !receiptsAreConsistent(receiptResolution.receipt, eventReceipt.receipt)) {
      throw new KnowledgeReviewError({
        status: 409,
        code: "promotion_stored_receipt_invalid",
        message: "저장된 이벤트 승인 영수증이 run 승인 영수증과 일치하지 않습니다."
      });
    }
  }

  const sourceBinding = buildKnowledgeReviewSourceSnapshot({
    eventIds,
    events: storedEvents as KnowledgeReviewSourceEventRow[],
    tenantContext: { organizationId: command.organizationId, siteId: command.siteId }
  });
  if (!readCurrentSourceBoundCandidate(run.generated_output, sourceBinding.snapshot)) {
    throw new KnowledgeReviewError({
      status: 409,
      code: "promotion_source_digest_mismatch",
      message: "저장된 후보와 현재 원본 이벤트 snapshot이 일치하지 않습니다."
    });
  }

  // Existing rows prove the current snapshot digest, but not source publication or verification authority.
  return {
    authenticatedReviewerId: user.id,
    organizationId: run.organization_id,
    siteId: command.siteId,
    runId: run.id,
    action: command.action,
    humanApprovalReceipt: receiptResolution.receipt as OntologyPromotionTrustedContext["humanApprovalReceipt"],
    source: {
      digestAlgorithm: "sha256",
      digest: buildKnowledgeReviewSourceSnapshotDigest(sourceBinding.snapshot),
      publicationState: "unavailable",
      verificationState: "review_required"
    }
  };
}

export async function applyKnowledgeReviewAction(
  client: KnowledgeReviewClient,
  user: WorkspaceUser,
  request: KnowledgeReviewRequest,
  options: { now?: () => string } = {}
) {
  const { data: organizations, error: organizationError } = await client
    .from("organizations")
    .select("id")
    .eq("owner_id", user.id);
  assertReadSucceeded(organizationError, "검토자 조직 범위를 확인하지 못했습니다.");

  const organizationIds = (organizations ?? []).map((organization) => organization.id);
  if (organizationIds.length === 0) {
    throw new KnowledgeReviewError({
      status: 403,
      code: "review_tenant_forbidden",
      message: "검토 가능한 조직이 없습니다."
    });
  }

  const { data: ownedSites, error: ownedSiteError } = await client
    .from("sites")
    .select("id,organization_id")
    .in("organization_id", organizationIds);
  assertReadSucceeded(ownedSiteError, "검토자 현장 범위를 확인하지 못했습니다.");
  const siteIds = (ownedSites ?? []).map((site) => site.id);
  if (siteIds.length === 0) {
    throw new KnowledgeReviewError({
      status: 403,
      code: "review_tenant_forbidden",
      message: "검토 가능한 현장이 없습니다."
    });
  }

  const { data: run, error: runReadError } = await client
    .from("knowledge_regeneration_runs")
    .select("id,organization_id,site_id,raw_event_ids,generated_output,status")
    .eq("id", request.runId)
    .in("organization_id", organizationIds)
    .in("site_id", siteIds)
    .maybeSingle();
  assertReadSucceeded(runReadError, "검토 대상을 확인하지 못했습니다.");

  if (!run) {
    throw new KnowledgeReviewError({
      status: 403,
      code: "review_run_forbidden",
      message: "이 조직에서 검토할 수 없는 대상입니다."
    });
  }
  const transition = actionTransition(request.action);
  const runIsActionable = run.status === "review_required";
  const runHasStoredReceipt = isRecord(run.generated_output)
    && Object.prototype.hasOwnProperty.call(run.generated_output, "humanReviewReceipt");
  const runHasTargetFinalStatus = run.status === transition.runStatus;
  const receiptContext: ReceiptOperationContext = {
    request,
    user,
    runId: run.id,
    organizationId: run.organization_id,
    siteId: run.site_id
  };
  const runReceiptResolution = resolveHumanReviewReceipt(run.generated_output, receiptContext);
  if (runHasStoredReceipt && (
    !runReceiptResolution
    || (runReceiptResolution.needsUpgrade && !runHasTargetFinalStatus)
  )) {
    throw new KnowledgeReviewError({
      status: 409,
      code: "review_idempotency_conflict",
      message: "run에 저장된 검토 영수증이 현재 요청 범위와 일치하지 않습니다.",
      compensationRequired: true
    });
  }
  if (!runIsActionable && !runHasTargetFinalStatus) {
    throw new KnowledgeReviewError({
      status: 409,
      code: "review_run_not_actionable",
      message: "이미 처리되었거나 검토할 수 없는 상태입니다."
    });
  }
  if (!run.site_id
    || !(ownedSites ?? []).some((site) => site.id === run.site_id && site.organization_id === run.organization_id)) {
    throw new KnowledgeReviewError({
      status: 409,
      code: "review_site_mismatch",
      message: "검토 대상의 조직과 현장 범위가 일치하지 않습니다."
    });
  }

  const uniqueEventIds = [...new Set(run.raw_event_ids)];
  if (uniqueEventIds.length === 0 || uniqueEventIds.length !== run.raw_event_ids.length) {
    throw new KnowledgeReviewError({
      status: 409,
      code: "review_event_set_invalid",
      message: "검토 대상의 원본 이벤트 연결이 유효하지 않습니다."
    });
  }

  const { data: events, error: eventReadError } = await client
    .from("knowledge_events")
    .select("id,organization_id,site_id,source,source_id,captured_at,title,url,payload,related_hazard_ids,reflected_documents,review_status,proposed_wiki_update")
    .in("id", uniqueEventIds)
    .eq("organization_id", run.organization_id)
    .eq("site_id", run.site_id);
  assertReadSucceeded(eventReadError, "원본 이벤트 범위를 확인하지 못했습니다.");

  const eventIds = new Set((events ?? []).map((event) => event.id));
  const allEventsMatchScope = (events ?? []).length === uniqueEventIds.length
    && uniqueEventIds.every((eventId) => eventIds.has(eventId))
    && (events ?? []).every((event) => (
      event.organization_id === run.organization_id
      && event.site_id === run.site_id
    ));
  if (!allEventsMatchScope) {
    throw new KnowledgeReviewError({
      status: 409,
      code: "review_event_tenant_mismatch",
      message: "모든 원본 이벤트가 같은 조직, 현장, 검토 상태에 속해야 합니다."
    });
  }
  const pendingEventIds = new Set((events ?? [])
    .filter((event) => event.review_status === "pending_review")
    .map((event) => event.id));

  let overlappingRunQuery = client
    .from("knowledge_regeneration_runs")
    .select("id,organization_id,site_id,raw_event_ids,generated_output,status")
    .eq("organization_id", run.organization_id)
    .in("status", [...KNOWLEDGE_REVIEW_RUN_STATUSES, "approved", "failed"])
    .overlaps("raw_event_ids", uniqueEventIds);
  overlappingRunQuery = run.site_id === null
    ? overlappingRunQuery.is("site_id", null)
    : overlappingRunQuery.eq("site_id", run.site_id);
  const { data: overlappingRuns, error: overlappingRunError } = await overlappingRunQuery;
  assertReadSucceeded(overlappingRunError, "공유 원본 이벤트 연결을 확인하지 못했습니다.");
  const conflictCandidates = (overlappingRuns ?? []).filter((candidate) => {
    if (candidate.id === run.id) return false;
    if ((KNOWLEDGE_REVIEW_RUN_STATUSES as readonly string[]).includes(candidate.status)) {
      return true;
    }
    const sharesPendingEvent = candidate.raw_event_ids
      .some((eventId) => pendingEventIds.has(eventId));
    return sharesPendingEvent
      && (candidate.status === "approved" || candidate.status === "failed");
  });
  const sharedConflictRunIds = findSharedEventConflictRunIds([
    { id: run.id, rawEventIds: uniqueEventIds },
    ...conflictCandidates.map((candidate) => ({
      id: candidate.id,
      rawEventIds: candidate.raw_event_ids
    }))
  ]);
  if (sharedConflictRunIds.has(run.id)) {
    throw new KnowledgeReviewError({
      status: 409,
      code: "review_shared_event_conflict",
      message: "같은 원본 이벤트를 공유하는 다른 검토 run이 있어 처리할 수 없습니다."
    });
  }

  let sourceBinding: ReturnType<typeof buildKnowledgeReviewSourceSnapshot>;
  try {
    sourceBinding = buildKnowledgeReviewSourceSnapshot({
      eventIds: uniqueEventIds,
      events: events as KnowledgeReviewSourceEventRow[],
      tenantContext: { organizationId: run.organization_id, siteId: run.site_id }
    });
  } catch (error) {
    throw new KnowledgeReviewError({
      status: 409,
      code: "review_candidate_source_binding_invalid",
      message: "검토 후보의 원본 이벤트 snapshot을 검증할 수 없습니다.",
      cause: error
    });
  }
  const currentCandidate = readCurrentSourceBoundCandidate(run.generated_output, sourceBinding.snapshot, {
    requireSafeEnvelope: runIsActionable
  });
  if (!currentCandidate) {
    throw new KnowledgeReviewError({
      status: 409,
      code: "review_candidate_source_binding_invalid",
      message: "검토 후보가 현재 원본 이벤트 snapshot과 일치하지 않습니다."
    });
  }
  if (runIsActionable && request.action === "approve_candidate") {
    const evidenceItems = buildKnowledgeReviewEvidenceItems({
      candidate: currentCandidate,
      rawEvents: sourceBinding.rawEvents
    });
    const traceItems = buildKnowledgeReviewTraceItems({
      candidate: currentCandidate,
      rawEvents: sourceBinding.rawEvents,
      evidenceItems
    });
    if (traceItems.length !== currentCandidate.matchedHazardIds.length
      || traceItems.length === 0
      || traceItems.some((item) => !item.resolved)) {
      throw new KnowledgeReviewError({
        status: 409,
        code: "review_candidate_traceability_incomplete",
        message: "위험요인, 통제대책, 반영 문서와 근거 연결이 완성된 후보만 승인할 수 있습니다."
      });
    }
    if (evaluateKnowledgeCandidateContentReadiness(currentCandidate).status !== "ready_for_human_review") {
      throw new KnowledgeReviewError({
        status: 409,
        code: "review_candidate_revision_required",
        message: "필수 섹션과 근거 준비도를 충족한 후보만 승인할 수 있습니다."
      });
    }
  }

  const eventById = new Map((events ?? []).map((event) => [event.id, event]));
  let operationReceipt = runReceiptResolution?.receipt ?? null;
  const eventIdsToNormalize = new Set<string>();
  let completedEventCount = 0;
  for (const event of events ?? []) {
    if (event.review_status === "pending_review") continue;
    const eventReceiptResolution = resolveHumanReviewReceipt(
      event.proposed_wiki_update,
      receiptContext
    );
    if (
      event.review_status !== transition.eventReviewStatus
      || !eventReceiptResolution
      || (eventReceiptResolution.needsUpgrade && !runHasTargetFinalStatus)
    ) {
      throw new KnowledgeReviewError({
        status: 409,
        code: "review_idempotency_conflict",
        message: "이미 저장된 이벤트 검토 결과가 현재 요청과 일치하지 않습니다.",
        compensationRequired: true,
        updates: {
          runUpdated: false,
          eventsUpdated: false,
          eventsUpdatedCount: 0,
          eventsTotal: uniqueEventIds.length
        }
      });
    }
    const receipt = eventReceiptResolution.receipt;
    if (operationReceipt && !receiptsAreConsistent(operationReceipt, receipt)) {
      throw new KnowledgeReviewError({
        status: 409,
        code: "review_idempotency_conflict",
        message: "부분 저장된 이벤트의 검토 영수증이 서로 일치하지 않습니다.",
        compensationRequired: true,
        updates: {
          runUpdated: false,
          eventsUpdated: false,
          eventsUpdatedCount: 0,
          eventsTotal: uniqueEventIds.length
        }
      });
    }
    operationReceipt = receipt;
    if (!hasSafeReviewEnvelope(event.proposed_wiki_update)) {
      eventIdsToNormalize.add(event.id);
    }
    completedEventCount += 1;
  }

  if (runHasTargetFinalStatus && !operationReceipt) {
    throw new KnowledgeReviewError({
      status: 409,
      code: "review_idempotency_conflict",
      message: "완료된 run을 현재 요청에 연결할 검토 영수증이 없습니다.",
      compensationRequired: true,
      updates: {
        runUpdated: false,
        eventsUpdated: false,
        eventsUpdatedCount: 0,
        eventsTotal: uniqueEventIds.length
      }
    });
  }

  operationReceipt ??= buildHumanReviewReceipt({
    request,
    user,
    reviewedAt: (options.now ?? (() => new Date().toISOString()))(),
    runId: run.id,
    organizationId: run.organization_id,
    siteId: run.site_id
  });

  let eventsUpdatedCount = 0;
  for (const eventId of uniqueEventIds) {
    const event = eventById.get(eventId);
    if (!event) {
      throw new KnowledgeReviewError({
        status: 500,
        code: "review_event_update_failed",
        message: "일부 원본 이벤트만 저장되어 동일 요청으로 재개해야 합니다.",
        compensationRequired: true,
        updates: {
          runUpdated: false,
          eventsUpdated: false,
          eventsUpdatedCount,
          eventsTotal: uniqueEventIds.length
        }
      });
    }
    const eventIsCompleted = event.review_status === transition.eventReviewStatus;
    if (eventIsCompleted && !eventIdsToNormalize.has(eventId)) continue;
    const proposedWikiUpdate = buildReviewedEventProposal({
      proposedWikiUpdate: event.proposed_wiki_update,
      receipt: operationReceipt
    });
    let eventUpdate = client
      .from("knowledge_events")
      .update(eventIsCompleted
        ? { proposed_wiki_update: toJson(proposedWikiUpdate) }
        : {
            review_status: transition.eventReviewStatus,
            proposed_wiki_update: toJson(proposedWikiUpdate)
          })
      .eq("id", eventId)
      .eq("organization_id", run.organization_id)
      .eq("review_status", eventIsCompleted
        ? transition.eventReviewStatus
        : "pending_review");
    eventUpdate = run.site_id === null
      ? eventUpdate.is("site_id", null)
      : eventUpdate.eq("site_id", run.site_id);
    const { data: updatedEvent, error: eventUpdateError } = await eventUpdate
      .select("id")
      .maybeSingle();
    if (eventUpdateError || !updatedEvent) {
      throw new KnowledgeReviewError({
        status: 500,
        code: "review_event_update_failed",
        message: "일부 원본 이벤트만 저장되어 동일 요청으로 재개해야 합니다.",
        compensationRequired: true,
        updates: {
          runUpdated: false,
          eventsUpdated: false,
          eventsUpdatedCount,
          eventsTotal: uniqueEventIds.length
        },
        cause: eventUpdateError
      });
    }
    eventsUpdatedCount += 1;
  }

  if (runHasTargetFinalStatus) {
    const runNeedsNormalization = runReceiptResolution?.needsUpgrade !== false
      || !hasSafeReviewEnvelope(run.generated_output);
    let runUpdated = false;
    if (runNeedsNormalization) {
      const normalizedOutput = buildReviewedOutput({
        generatedOutput: run.generated_output,
        receipt: operationReceipt
      });
      const { data: normalizedRun, error: normalizationError } = await client
        .from("knowledge_regeneration_runs")
        .update({ generated_output: toJson(normalizedOutput) })
        .eq("id", run.id)
        .eq("organization_id", run.organization_id)
        .eq("site_id", run.site_id)
        .eq("status", transition.runStatus)
        .select("id")
        .single();
      if (normalizationError || !normalizedRun) {
        throw new KnowledgeReviewError({
          status: 500,
          code: "review_run_normalization_failed",
          message: "완료된 run의 비공개 검토 영수증을 정규화하지 못했습니다.",
          compensationRequired: true,
          updates: {
            runUpdated: false,
            eventsUpdated: eventsUpdatedCount > 0,
            eventsUpdatedCount,
            eventsTotal: uniqueEventIds.length
          },
          cause: normalizationError
        });
      }
      runUpdated = true;
    }
    return buildKnowledgeReviewSuccessResult({
      request,
      user,
      run,
      transition,
      runUpdated,
      eventsUpdated: eventsUpdatedCount > 0,
      eventsUpdatedCount,
      eventsTotal: uniqueEventIds.length
    });
  }

  const generatedOutput = buildReviewedOutput({
    generatedOutput: run.generated_output,
    receipt: operationReceipt
  });
  const { data: updatedRun, error: runUpdateError } = await client
    .from("knowledge_regeneration_runs")
    .update({
      status: transition.runStatus,
      generated_output: toJson(generatedOutput)
    })
    .eq("id", run.id)
    .eq("organization_id", run.organization_id)
    .eq("site_id", run.site_id)
    .eq("status", "review_required")
    .select("id")
    .single();

  if (runUpdateError || !updatedRun) {
    throw new KnowledgeReviewError({
      status: 500,
      code: "review_run_update_failed",
      message: "원본 이벤트는 저장됐지만 검토 run 상태를 확정하지 못했습니다.",
      compensationRequired: true,
      updates: {
        runUpdated: false,
        eventsUpdated: eventsUpdatedCount > 0,
        eventsUpdatedCount,
        eventsTotal: uniqueEventIds.length
      },
      cause: runUpdateError
    });
  }

  return buildKnowledgeReviewSuccessResult({
    request,
    user,
    run,
    transition,
    runUpdated: true,
    eventsUpdated: eventsUpdatedCount > 0,
    eventsUpdatedCount,
    eventsTotal: uniqueEventIds.length
  });
}
