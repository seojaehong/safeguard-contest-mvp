import type { SupabaseClient } from "@supabase/supabase-js";
import type { KnowledgeCandidate } from "@/lib/knowledge-governance";
import { normalizeKnowledgeRawEvent, type KnowledgeRawEvent } from "@/lib/safety-knowledge";
import type { WorkspaceDatabase, WorkspaceUser } from "@/lib/supabase-admin";
import { toJson } from "@/lib/supabase-admin";

const MAX_SOURCE_EVENTS = 20;
const MAX_QUESTION_LENGTH = 500;
const MAX_CANDIDATE_TEXT_LENGTH = 12_000;
const ACTIONABLE_RUN_STATUSES = ["draft", "generated", "review_required"] as const;

type KnowledgeReviewPrepareClient = SupabaseClient<WorkspaceDatabase>;

type KnowledgeRunRow = Pick<
  WorkspaceDatabase["public"]["Tables"]["knowledge_regeneration_runs"]["Row"],
  "id" | "organization_id" | "site_id" | "question" | "raw_event_ids" | "status"
>;

type KnowledgeEventRow = Pick<
  WorkspaceDatabase["public"]["Tables"]["knowledge_events"]["Row"],
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
>;

export type KnowledgeReviewPrepareRequest = {
  runId: string;
};

export type KnowledgeReviewCandidateBuildResult = {
  candidate: KnowledgeCandidate;
  configured: boolean;
  providerLabel: string | null;
};

export type KnowledgeReviewCandidateBuilder = (input: {
  runId: string;
  question: string;
  rawEvents: KnowledgeRawEvent[];
  tenantContext: { organizationId: string; siteId: string };
}) => Promise<KnowledgeReviewCandidateBuildResult>;

export class KnowledgeReviewPrepareError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(input: { status: number; code: string; message: string; cause?: unknown }) {
    super(input.message, { cause: input.cause });
    this.name = "KnowledgeReviewPrepareError";
    this.status = input.status;
    this.code = input.code;
  }
}

function fail(status: number, code: string, message: string): never {
  throw new KnowledgeReviewPrepareError({ status, code, message });
}

function assertRead(error: unknown, message: string): void {
  if (!error) return;
  throw new KnowledgeReviewPrepareError({
    status: 500,
    code: "prepare_validation_read_failed",
    message,
    cause: error
  });
}

function toRawEvent(row: KnowledgeEventRow): KnowledgeRawEvent {
  const normalized = normalizeKnowledgeRawEvent({
    source: row.source,
    sourceId: row.source_id,
    capturedAt: row.captured_at,
    title: row.title,
    url: row.url ?? undefined,
    payload: row.payload,
    relatedHazardIds: row.related_hazard_ids,
    reflectedDocuments: row.reflected_documents
  });
  if (!normalized.ok) {
    fail(409, "source_event_invalid", "원본 이벤트가 후보 생성 계약을 충족하지 않습니다.");
  }
  return normalized.event;
}

function validateCandidate(
  result: KnowledgeReviewCandidateBuildResult,
  run: KnowledgeRunRow,
  expectedQuestion: string
): KnowledgeCandidate {
  const candidate = result.candidate;
  if (!candidate.generatedText.trim()) {
    fail(422, "candidate_empty", "빈 지식 후보는 검토 대기로 전환할 수 없습니다.");
  }
  if (
    candidate.generatedText.length > MAX_CANDIDATE_TEXT_LENGTH
    || candidate.question.length > MAX_QUESTION_LENGTH
    || candidate.question !== expectedQuestion
    || (result.providerLabel !== null && result.providerLabel.length > 96)
    || candidate.matchedHazardIds.length > 20
    || candidate.matchedHazardIds.some((hazardId) => !hazardId.trim() || hazardId.length > 128)
    || candidate.contractVersion !== "knowledge-candidate.v2"
    || candidate.publicationState !== "unpublished"
    || candidate.publishAllowed !== false
    || candidate.dbMutationAllowed !== false
    || candidate.dbMutationPerformed !== false
    || candidate.tenantContext.organizationId !== run.organization_id
    || candidate.tenantContext.siteId !== run.site_id
  ) {
    fail(422, "candidate_invalid", "지식 후보가 검토용 안전 경계를 충족하지 않습니다.");
  }
  return candidate;
}

function buildSafeReviewQuestion(eventCount: number): string {
  return `원본 이벤트 ${eventCount}건 기반 현장 지식 후보 검토`;
}

export async function prepareKnowledgeReviewCandidate(
  client: KnowledgeReviewPrepareClient,
  user: WorkspaceUser,
  request: KnowledgeReviewPrepareRequest,
  dependencies: { buildCandidate: KnowledgeReviewCandidateBuilder }
) {
  const runId = request.runId.trim();
  if (!runId) fail(400, "prepare_run_id_required", "runId가 필요합니다.");

  const { data: organizations, error: organizationError } = await client
    .from("organizations")
    .select("id")
    .eq("owner_id", user.id);
  assertRead(organizationError, "후보 준비 조직 범위를 확인하지 못했습니다.");
  const organizationIds = (organizations ?? []).map((organization) => organization.id);
  if (organizationIds.length === 0) {
    fail(403, "prepare_tenant_forbidden", "후보를 준비할 수 있는 조직이 없습니다.");
  }

  const { data: run, error: runError } = await client
    .from("knowledge_regeneration_runs")
    .select("id,organization_id,site_id,question,raw_event_ids,status")
    .eq("id", runId)
    .in("organization_id", organizationIds)
    .maybeSingle();
  assertRead(runError, "후보 준비 run을 확인하지 못했습니다.");
  if (!run) fail(403, "prepare_run_forbidden", "이 조직에서 준비할 수 없는 run입니다.");
  if (run.status !== "draft") {
    fail(409, "prepare_run_status_invalid", "draft 상태의 run만 후보로 준비할 수 있습니다.");
  }
  if (!run.site_id || !run.question.trim() || run.question.length > MAX_QUESTION_LENGTH) {
    fail(409, "prepare_run_invalid", "run의 현장 또는 질문 정보가 유효하지 않습니다.");
  }
  if (run.raw_event_ids.length === 0 || run.raw_event_ids.length > MAX_SOURCE_EVENTS) {
    fail(409, "prepare_event_count_invalid", "원본 이벤트 수가 허용 범위를 벗어났습니다.");
  }
  const uniqueEventIds = [...new Set(run.raw_event_ids)];
  if (uniqueEventIds.length !== run.raw_event_ids.length) {
    fail(409, "prepare_event_ids_duplicate", "중복 원본 이벤트가 포함된 run은 준비할 수 없습니다.");
  }

  const { data: sites, error: siteError } = await client
    .from("sites")
    .select("id,organization_id")
    .eq("id", run.site_id)
    .eq("organization_id", run.organization_id);
  assertRead(siteError, "run 현장 범위를 확인하지 못했습니다.");
  if ((sites ?? []).length !== 1) {
    fail(409, "prepare_site_tenant_mismatch", "run 현장이 조직 범위와 일치하지 않습니다.");
  }

  const { data: sharedRuns, error: sharedRunError } = await client
    .from("knowledge_regeneration_runs")
    .select("id")
    .overlaps("raw_event_ids", uniqueEventIds)
    .in("status", [...ACTIONABLE_RUN_STATUSES]);
  assertRead(sharedRunError, "원본 이벤트 공유 여부를 확인하지 못했습니다.");
  if ((sharedRuns ?? []).some((sharedRun) => sharedRun.id !== run.id)) {
    fail(409, "prepare_shared_event_conflict", "다른 검토 run과 공유된 원본 이벤트가 있습니다.");
  }

  const { data: events, error: eventError } = await client
    .from("knowledge_events")
    .select("id,organization_id,site_id,source,source_id,captured_at,title,url,payload,related_hazard_ids,reflected_documents,review_status")
    .in("id", uniqueEventIds);
  assertRead(eventError, "원본 이벤트를 확인하지 못했습니다.");
  if ((events ?? []).length !== uniqueEventIds.length) {
    fail(409, "prepare_event_missing", "원본 이벤트가 누락되어 후보를 준비할 수 없습니다.");
  }
  const eventById = new Map((events ?? []).map((event) => [event.id, event]));
  const orderedEvents = uniqueEventIds.map((eventId) => eventById.get(eventId));
  if (orderedEvents.some((event) => !event)) {
    fail(409, "prepare_event_missing", "원본 이벤트가 누락되어 후보를 준비할 수 없습니다.");
  }
  const tenantMatches = orderedEvents.every((event) => event
    && event.organization_id === run.organization_id
    && event.site_id === run.site_id
    && event.review_status === "pending_review");
  if (!tenantMatches) {
    fail(409, "prepare_event_tenant_mismatch", "원본 이벤트의 조직, 현장 또는 검토 상태가 일치하지 않습니다.");
  }

  const safeQuestion = buildSafeReviewQuestion(orderedEvents.length);
  let built: KnowledgeReviewCandidateBuildResult;
  try {
    built = await dependencies.buildCandidate({
      runId: run.id,
      question: safeQuestion,
      rawEvents: orderedEvents.map((event) => toRawEvent(event as KnowledgeEventRow)),
      tenantContext: { organizationId: run.organization_id, siteId: run.site_id }
    });
  } catch (error) {
    if (error instanceof KnowledgeReviewPrepareError) throw error;
    throw new KnowledgeReviewPrepareError({
      status: 502,
      code: "candidate_generation_failed",
      message: "지식 후보 생성에 실패했습니다.",
      cause: error
    });
  }
  const candidate = validateCandidate(built, run, safeQuestion);
  const generatedOutput = {
    contractVersion: "knowledge-review-preparation.v1",
    candidate,
    publicationState: "unpublished",
    ontologyPublished: false,
    publishPerformed: false,
    migrationPerformed: false,
    legalConfirmed: false,
    rawEventPayloadIncluded: false
  } as const;

  const { data: updatedRun, error: updateError } = await client
    .from("knowledge_regeneration_runs")
    .update({
      generated_output: toJson(generatedOutput),
      provider: built.providerLabel,
      status: "review_required"
    })
    .eq("id", run.id)
    .eq("organization_id", run.organization_id)
    .eq("site_id", run.site_id)
    .eq("status", "draft")
    .select("id,status")
    .single();
  if (updateError || !updatedRun) {
    throw new KnowledgeReviewPrepareError({
      status: 409,
      code: "prepare_write_conflict",
      message: "run 상태가 변경되어 후보를 저장하지 못했습니다.",
      cause: updateError
    });
  }

  return {
    ok: true as const,
    runId: updatedRun.id,
    status: "review_required" as const,
    candidate: {
      contractVersion: candidate.contractVersion,
      stage: candidate.stage,
      reviewStatus: candidate.reviewStatus,
      publicationState: candidate.publicationState,
      authority: candidate.authority,
      publishAllowed: candidate.publishAllowed,
      question: candidate.question,
      generatedText: candidate.generatedText,
      matchedHazardIds: candidate.matchedHazardIds.slice(0, 20),
      sourceEventCount: candidate.provenance.length
    },
    configured: built.configured,
    publicationState: "unpublished" as const,
    ontologyPublished: false,
    publishPerformed: false,
    migrationPerformed: false,
    legalConfirmed: false,
    rawEventPayloadIncluded: false
  };
}
