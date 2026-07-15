import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  WorkspaceDatabase,
  WorkspaceUser
} from "@/lib/supabase-admin";
import { toJson } from "@/lib/supabase-admin";

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

function mapReviewEvent(row: ReviewEventRow) {
  return {
    id: row.id,
    organizationId: row.organization_id,
    siteId: row.site_id,
    source: row.source,
    sourceId: row.source_id,
    capturedAt: row.captured_at,
    title: row.title,
    relatedHazardIds: row.related_hazard_ids,
    reflectedDocuments: row.reflected_documents,
    reviewStatus: row.review_status,
    createdAt: row.created_at
  };
}

function mapReviewRun(row: ReviewRunRow) {
  return {
    id: row.id,
    organizationId: row.organization_id,
    siteId: row.site_id,
    question: row.question,
    rawEventIds: row.raw_event_ids,
    generatedOutput: row.generated_output,
    provider: row.provider,
    status: row.status,
    createdAt: row.created_at
  };
}

export function parseKnowledgeReviewRequest(value: unknown): KnowledgeReviewRequest | null {
  if (!isRecord(value)) return null;
  const runId = typeof value.runId === "string" ? value.runId.trim() : "";
  const action = value.action;
  if (!runId) return null;
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
      tenantBoundary: {
        ownerUserId: user.id,
        organizationIds,
        rawEventPayloadIncluded: false
      },
      queue: [],
      dropped: {
        runCount: 0,
        eventCount: 0,
        reasons: []
      }
    };
  }

  const { data: events, error: eventError } = await client
    .from("knowledge_events")
    .select("id,organization_id,site_id,source,source_id,captured_at,title,related_hazard_ids,reflected_documents,review_status,created_at")
    .in("organization_id", organizationIds)
    .eq("review_status", "pending_review")
    .order("created_at", { ascending: false });

  if (eventError) throw eventError;

  const { data: runs, error: runError } = await client
    .from("knowledge_regeneration_runs")
    .select("id,organization_id,site_id,question,raw_event_ids,generated_output,provider,status,created_at")
    .in("organization_id", organizationIds)
    .in("status", [...KNOWLEDGE_REVIEW_RUN_STATUSES])
    .order("created_at", { ascending: false });

  if (runError) throw runError;

  const nonNullSiteIds = [...new Set((runs ?? []).flatMap((run) => (
    run.site_id === null ? [] : [run.site_id]
  )))];
  let siteOrganizationById = new Map<string, string>();
  if (nonNullSiteIds.length > 0) {
    const { data: sites, error: siteError } = await client
      .from("sites")
      .select("id,organization_id")
      .in("id", nonNullSiteIds);
    if (siteError) throw siteError;
    siteOrganizationById = new Map((sites ?? []).map((site) => [site.id, site.organization_id]));
  }

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
    relationValidRuns.push({ run, events: relatedEvents });
  }

  const queue = relationValidRuns.map((candidate) => ({
      run: mapReviewRun(candidate.run),
      events: candidate.events.map(mapReviewEvent)
  }));
  const includedEventIds = new Set(queue.flatMap((item) => item.events.map((event) => event.id)));

  return {
    tenantBoundary: {
      ownerUserId: user.id,
      organizationIds,
      rawEventPayloadIncluded: false
    },
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

function buildReviewedOutput(input: {
  generatedOutput: unknown;
  request: KnowledgeReviewRequest;
  user: WorkspaceUser;
  reviewedAt: string;
}) {
  const preservedOutput = isRecord(input.generatedOutput)
    ? input.generatedOutput
    : { candidateOutput: input.generatedOutput };

  return {
    ...preservedOutput,
    publicationState: "unpublished" as const,
    ontologyPublished: false,
    humanReviewReceipt: buildHumanReviewReceipt(input)
  };
}

function buildHumanReviewReceipt(input: {
  request: KnowledgeReviewRequest;
  user: WorkspaceUser;
  reviewedAt: string;
}) {
  const transition = actionTransition(input.request.action);
  return {
    contractVersion: "knowledge-human-review.v1" as const,
    action: input.request.action,
    scope: transition.scope,
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

function buildReviewedEventProposal(input: {
  proposedWikiUpdate: unknown;
  request: KnowledgeReviewRequest;
  user: WorkspaceUser;
  reviewedAt: string;
}) {
  const preservedProposal = isRecord(input.proposedWikiUpdate)
    ? input.proposedWikiUpdate
    : { candidateProposedWikiUpdate: input.proposedWikiUpdate };
  return {
    ...preservedProposal,
    publicationState: "unpublished" as const,
    ontologyPublished: false,
    humanReviewReceipt: buildHumanReviewReceipt(input)
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

  const { data: run, error: runReadError } = await client
    .from("knowledge_regeneration_runs")
    .select("id,organization_id,site_id,raw_event_ids,generated_output,status")
    .eq("id", request.runId)
    .in("organization_id", organizationIds)
    .maybeSingle();
  assertReadSucceeded(runReadError, "검토 대상을 확인하지 못했습니다.");

  if (!run) {
    throw new KnowledgeReviewError({
      status: 403,
      code: "review_run_forbidden",
      message: "이 조직에서 검토할 수 없는 대상입니다."
    });
  }
  if (!(KNOWLEDGE_REVIEW_RUN_STATUSES as readonly string[]).includes(run.status)) {
    throw new KnowledgeReviewError({
      status: 409,
      code: "review_run_not_actionable",
      message: "이미 처리되었거나 검토할 수 없는 상태입니다."
    });
  }
  if (!isRecord(run.generated_output)) {
    throw new KnowledgeReviewError({
      status: 409,
      code: "review_generated_output_invalid",
      message: "검토 대상의 생성 결과 형식이 유효하지 않습니다."
    });
  }
  if (run.site_id) {
    const { data: site, error: siteError } = await client
      .from("sites")
      .select("id,organization_id")
      .eq("id", run.site_id)
      .eq("organization_id", run.organization_id)
      .maybeSingle();
    assertReadSucceeded(siteError, "검토 대상의 현장 범위를 확인하지 못했습니다.");
    if (!site) {
      throw new KnowledgeReviewError({
        status: 409,
        code: "review_site_mismatch",
        message: "검토 대상의 조직과 현장 범위가 일치하지 않습니다."
      });
    }
  }

  const uniqueEventIds = [...new Set(run.raw_event_ids)];
  if (uniqueEventIds.length === 0 || uniqueEventIds.length !== run.raw_event_ids.length) {
    throw new KnowledgeReviewError({
      status: 409,
      code: "review_event_set_invalid",
      message: "검토 대상의 원본 이벤트 연결이 유효하지 않습니다."
    });
  }

  let overlappingRunQuery = client
    .from("knowledge_regeneration_runs")
    .select("id,raw_event_ids")
    .eq("organization_id", run.organization_id)
    .in("status", [...KNOWLEDGE_REVIEW_RUN_STATUSES])
    .overlaps("raw_event_ids", uniqueEventIds);
  overlappingRunQuery = run.site_id === null
    ? overlappingRunQuery.is("site_id", null)
    : overlappingRunQuery.eq("site_id", run.site_id);
  const { data: overlappingRuns, error: overlappingRunError } = await overlappingRunQuery;
  assertReadSucceeded(overlappingRunError, "공유 원본 이벤트 연결을 확인하지 못했습니다.");
  const sharedConflictRunIds = findSharedEventConflictRunIds((overlappingRuns ?? []).map((candidate) => ({
    id: candidate.id,
    rawEventIds: candidate.raw_event_ids
  })));
  if (sharedConflictRunIds.has(run.id)) {
    throw new KnowledgeReviewError({
      status: 409,
      code: "review_shared_event_conflict",
      message: "같은 원본 이벤트를 공유하는 다른 검토 run이 있어 처리할 수 없습니다."
    });
  }

  const { data: events, error: eventReadError } = await client
    .from("knowledge_events")
    .select("id,organization_id,site_id,review_status,proposed_wiki_update")
    .in("id", uniqueEventIds);
  assertReadSucceeded(eventReadError, "원본 이벤트 범위를 확인하지 못했습니다.");

  const eventIds = new Set((events ?? []).map((event) => event.id));
  const allEventsMatch = (events ?? []).length === uniqueEventIds.length
    && uniqueEventIds.every((eventId) => eventIds.has(eventId))
    && (events ?? []).every((event) => (
      event.organization_id === run.organization_id
      && event.site_id === run.site_id
      && event.review_status === "pending_review"
    ));
  if (!allEventsMatch) {
    throw new KnowledgeReviewError({
      status: 409,
      code: "review_event_tenant_mismatch",
      message: "모든 원본 이벤트가 같은 조직, 현장, 검토 상태에 속해야 합니다."
    });
  }

  const transition = actionTransition(request.action);
  const reviewedAt = (options.now ?? (() => new Date().toISOString()))();
  const generatedOutput = buildReviewedOutput({
    generatedOutput: run.generated_output,
    request,
    user,
    reviewedAt
  });
  const { data: updatedRun, error: runUpdateError } = await client
    .from("knowledge_regeneration_runs")
    .update({
      status: transition.runStatus,
      generated_output: toJson(generatedOutput)
    })
    .eq("id", run.id)
    .eq("organization_id", run.organization_id)
    .in("status", [...KNOWLEDGE_REVIEW_RUN_STATUSES])
    .select("id")
    .single();

  if (runUpdateError || !updatedRun) {
    throw new KnowledgeReviewError({
      status: 500,
      code: "review_run_update_failed",
      message: "검토 run 상태를 저장하지 못했습니다.",
      cause: runUpdateError
    });
  }

  const eventById = new Map((events ?? []).map((event) => [event.id, event]));
  let eventsUpdatedCount = 0;
  for (const eventId of uniqueEventIds) {
    const event = eventById.get(eventId);
    if (!event) {
      throw new KnowledgeReviewError({
        status: 500,
        code: "review_event_update_failed",
        message: "run은 갱신됐지만 원본 이벤트 상태 저장이 완료되지 않았습니다.",
        compensationRequired: true,
        updates: {
          runUpdated: true,
          eventsUpdated: false,
          eventsUpdatedCount,
          eventsTotal: uniqueEventIds.length
        }
      });
    }
    const proposedWikiUpdate = buildReviewedEventProposal({
      proposedWikiUpdate: event.proposed_wiki_update,
      request,
      user,
      reviewedAt
    });
    let eventUpdate = client
      .from("knowledge_events")
      .update({
        review_status: transition.eventReviewStatus,
        proposed_wiki_update: toJson(proposedWikiUpdate)
      })
      .eq("id", eventId)
      .eq("organization_id", run.organization_id)
      .eq("review_status", "pending_review");
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
        message: "run은 갱신됐지만 원본 이벤트 상태 저장이 완료되지 않았습니다.",
        compensationRequired: true,
        updates: {
          runUpdated: true,
          eventsUpdated: false,
          eventsUpdatedCount,
          eventsTotal: uniqueEventIds.length
        },
        cause: eventUpdateError
      });
    }
    eventsUpdatedCount += 1;
  }

  return {
    ok: true as const,
    action: request.action,
    runId: run.id,
    organizationId: run.organization_id,
    siteId: run.site_id,
    runStatus: transition.runStatus,
    eventReviewStatus: transition.eventReviewStatus,
    publicationState: "unpublished" as const,
    ontologyPublished: false,
    publishPerformed: false,
    migrationPerformed: false,
    atomic: false,
    compensationRequired: false,
    updates: {
      runUpdated: true,
      eventsUpdated: true,
      eventsUpdatedCount,
      eventsTotal: uniqueEventIds.length
    },
    reviewer: {
      id: user.id,
      email: user.email
    }
  };
}
