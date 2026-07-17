import { describe, expect, it } from "vitest";
import { buildKnowledgeCandidate } from "@/lib/knowledge-governance";
import {
  buildKnowledgeReviewSourceSnapshot,
  type KnowledgeReviewSourceEventRow
} from "@/lib/knowledge-review-prepare";
import {
  applyKnowledgeReviewAction,
  KnowledgeReviewError,
  loadKnowledgeReviewInbox,
  loadOntologyPromotionTrustedContext,
  parseKnowledgeReviewRequest
} from "@/lib/knowledge-review";

type FakeOptions = {
  organizationOwnerId?: string;
  runUpdateError?: Error;
  runUpdateErrorAt?: number;
  eventUpdateErrorAt?: number;
  eventOrganizationId?: string;
  eventSiteId?: string | null;
  additionalRuns?: Array<Record<string, unknown>>;
  beforeRunUpdate?: (run: Record<string, unknown>) => void;
  beforeEventUpdate?: (events: Array<Record<string, unknown>>, attempt: number) => void;
};

type FakeQueryResult = {
  data: unknown;
  error: Error | null;
};

function makeReviewClient(options: FakeOptions = {}) {
  const events: Array<Record<string, unknown>> = [
    {
      id: "event-1",
      organization_id: options.eventOrganizationId ?? "org-1",
      site_id: options.eventSiteId === undefined ? "site-1" : options.eventSiteId,
      source: "manual",
      source_id: "manual-event-1",
      captured_at: "2026-07-16T00:00:00.000Z",
      title: "현장 안전 이벤트 1",
      url: null,
      review_status: "pending_review",
      proposed_wiki_update: { existingKey: "event-one" },
      payload: { rawSecret: "preserve-one" },
      related_hazard_ids: ["hazard-1"],
      reflected_documents: ["위험성평가표"]
    },
    {
      id: "event-2",
      organization_id: options.eventOrganizationId ?? "org-1",
      site_id: options.eventSiteId === undefined ? "site-1" : options.eventSiteId,
      source: "manual",
      source_id: "manual-event-2",
      captured_at: "2026-07-16T00:01:00.000Z",
      title: "현장 안전 이벤트 2",
      url: null,
      review_status: "pending_review",
      proposed_wiki_update: { existingKey: "event-two" },
      payload: { rawSecret: "preserve-two" },
      related_hazard_ids: ["hazard-2"],
      reflected_documents: ["위험성평가표"]
    }
  ];
  const sourceBinding = buildKnowledgeReviewSourceSnapshot({
    eventIds: ["event-1", "event-2"],
    events: events as KnowledgeReviewSourceEventRow[],
    tenantContext: { organizationId: "org-1", siteId: "site-1" }
  });
  const candidate = buildKnowledgeCandidate({
    question: "원본 이벤트 2건 기반 현장 지식 후보 검토",
    rawEvents: sourceBinding.rawEvents,
    matchedHazardIds: ["hazard-1", "hazard-2"],
    generatedText: "현장 위험요인을 검토하고 필요한 예방조치를 확인합니다.",
    providerLabel: "fixture-provider",
    tenantContext: { organizationId: "org-1", siteId: "site-1" }
  });
  const preparedOutput = {
    contractVersion: "knowledge-review-preparation.v1",
    candidate,
    sourceSnapshot: sourceBinding.snapshot,
    publicationState: "unpublished",
    ontologyPublished: false,
    publishPerformed: false,
    migrationPerformed: false,
    legalConfirmed: false,
    rawEventPayloadIncluded: false
  };
  const run: Record<string, unknown> = {
    id: "run-1",
    organization_id: "org-1",
    site_id: "site-1",
    raw_event_ids: ["event-1", "event-2"],
    generated_output: preparedOutput,
    status: "review_required"
  };
  const tables: Record<string, Array<Record<string, unknown>>> = {
    organizations: [{ id: "org-1", owner_id: options.organizationOwnerId ?? "reviewer-auth" }],
    sites: [{ id: "site-1", organization_id: "org-1" }],
    knowledge_regeneration_runs: [run, ...(options.additionalRuns ?? [])],
    knowledge_events: events
  };
  const updates: Array<{ table: string; value: unknown }> = [];
  const calls: Array<{ table: string; operation: string; column: string; value: unknown }> = [];
  let runUpdateAttempt = 0;
  let eventUpdateAttempt = 0;

  function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
  }

  function project(row: Record<string, unknown>, columns: string | null) {
    if (!columns) return { ...row };
    return Object.fromEntries(columns.split(",").map((column) => {
      const key = column.trim();
      return [key, row[key]];
    }));
  }

  const client = {
    from(table: string) {
      const filters: Array<(row: Record<string, unknown>) => boolean> = [];
      let updateValue: unknown;
      let selectedColumns: string | null = null;

      function execute(): FakeQueryResult {
        if (updateValue !== undefined) {
          if (!isRecord(updateValue)) throw new Error("Expected record update value");
          if (table === "knowledge_regeneration_runs") {
            runUpdateAttempt += 1;
            if (options.runUpdateError || options.runUpdateErrorAt === runUpdateAttempt) {
              return { data: null, error: options.runUpdateError ?? new Error(`run update failed at ${runUpdateAttempt}`) };
            }
          }
          if (table === "knowledge_regeneration_runs") options.beforeRunUpdate?.(run);
          if (table === "knowledge_events") {
            eventUpdateAttempt += 1;
            options.beforeEventUpdate?.(events, eventUpdateAttempt);
            if (options.eventUpdateErrorAt === eventUpdateAttempt) {
              return { data: null, error: new Error(`event update failed at ${eventUpdateAttempt}`) };
            }
          }
        }

        const matchedRows = (tables[table] ?? []).filter((row) => filters.every((filter) => filter(row)));
        if (updateValue !== undefined && isRecord(updateValue)) {
          for (const row of matchedRows) Object.assign(row, updateValue);
        }
        return {
          data: matchedRows.map((row) => project(row, selectedColumns)),
          error: null
        };
      }

      const query = {
        select(columns: string) { selectedColumns = columns; return query; },
        eq(column: string, value: unknown) {
          calls.push({ table, operation: "eq", column, value });
          filters.push((row) => row[column] === value);
          return query;
        },
        in(column: string, values: unknown[]) {
          calls.push({ table, operation: "in", column, value: values });
          filters.push((row) => values.includes(row[column]));
          return query;
        },
        overlaps(column: string, values: unknown[]) {
          filters.push((row) => (
            Array.isArray(row[column]) && row[column].some((value) => values.includes(value))
          ));
          return query;
        },
        is(column: string, value: unknown) {
          filters.push((row) => row[column] === value);
          return query;
        },
        order() { return query; },
        update(value: unknown) {
          updateValue = value;
          updates.push({ table, value });
          return query;
        },
        maybeSingle: async (): Promise<FakeQueryResult> => {
          const result = execute();
          const rows = Array.isArray(result.data) ? result.data : [];
          return { data: rows[0] ?? null, error: result.error };
        },
        single: async (): Promise<FakeQueryResult> => {
          const result = execute();
          if (result.error) return result;
          const rows = Array.isArray(result.data) ? result.data : [];
          return rows.length === 1
            ? { data: rows[0], error: null }
            : { data: null, error: new Error(`Expected one ${table} row, received ${rows.length}`) };
        },
        then(resolve: (value: FakeQueryResult) => unknown) {
          return Promise.resolve(execute()).then(resolve);
        }
      };
      return query;
    }
  };

  return { client, events, run, updates, calls, preparedOutput };
}

function makeReceipt(overrides: {
  action?: "approve_candidate" | "keep_site_only" | "reject";
  scope?: "promotion_candidate" | "site_private" | "rejected";
  organizationId?: string;
  siteId?: string | null;
  reviewerId?: string;
  reviewedAt?: string;
  operationId?: string;
} = {}) {
  const action = overrides.action ?? "approve_candidate";
  const scope = action === "reject"
    ? "rejected"
    : action === "keep_site_only" ? "site_private" : "promotion_candidate";
  return {
    contractVersion: "knowledge-human-review.v1",
    operationId: overrides.operationId ?? `knowledge-review:run-1:${action}`,
    action,
    scope: overrides.scope ?? scope,
    runId: "run-1",
    organizationId: overrides.organizationId ?? "org-1",
    siteId: overrides.siteId === undefined ? "site-1" : overrides.siteId,
    reviewer: {
      id: overrides.reviewerId ?? "reviewer-auth",
      email: null
    },
    reviewedAt: overrides.reviewedAt ?? "2026-07-16T08:00:00.000Z",
    publicationState: "unpublished",
    ontologyPublished: false,
    publishPerformed: false,
    migrationPerformed: false,
    atomic: false
  };
}

function makeLegacyReceipt(overrides: {
  action?: "approve_candidate" | "keep_site_only" | "reject";
  scope?: "promotion_candidate" | "site_private" | "rejected";
  reviewerId?: string;
  reviewedAt?: string;
  publicationState?: "unpublished" | "published";
  ontologyPublished?: boolean;
} = {}) {
  const action = overrides.action ?? "approve_candidate";
  const scope = action === "reject"
    ? "rejected"
    : action === "keep_site_only" ? "site_private" : "promotion_candidate";
  return {
    contractVersion: "knowledge-human-review.v1",
    action,
    scope: overrides.scope ?? scope,
    reviewer: {
      id: overrides.reviewerId ?? "reviewer-auth",
      email: null
    },
    reviewedAt: overrides.reviewedAt ?? "2026-07-15T01:02:03.000Z",
    publicationState: overrides.publicationState ?? "unpublished",
    ontologyPublished: overrides.ontologyPublished ?? false,
    publishPerformed: false,
    migrationPerformed: false,
    atomic: false
  };
}

describe("knowledge review actions", () => {
  it.each([
    ["draft", { candidate: "draft" }],
    ["generated", { candidate: "generated" }],
    ["review_required", {}]
  ] as const)("blocks %s or schema-invalid candidates before mutation", async (status, generatedOutput) => {
    const fake = makeReviewClient();
    fake.run.status = status;
    fake.run.generated_output = generatedOutput;

    await expect(applyKnowledgeReviewAction(
      fake.client as never,
      { id: "reviewer-auth", email: null },
      { runId: "run-1", action: "approve_candidate" }
    )).rejects.toMatchObject({
      status: 409,
      compensationRequired: false
    });

    expect(fake.updates).toEqual([]);
  });

  it.each(["empty", "stale", "foreign"] as const)(
    "blocks a %s source binding before mutation",
    async (attack) => {
      const fake = makeReviewClient();
      const output = structuredClone(fake.preparedOutput);
      if (attack === "empty") {
        output.candidate.provenance = [];
      } else if (attack === "stale") {
        const first = output.sourceSnapshot.provenance[0];
        if (!first) throw new Error("Expected fixture provenance");
        first.eventReference.digest = "0".repeat(64);
      } else {
        const first = output.candidate.provenance[0];
        if (!first) throw new Error("Expected fixture provenance");
        first.tenantContext.organizationId = "org-foreign";
      }
      fake.run.generated_output = output;

      await expect(applyKnowledgeReviewAction(
        fake.client as never,
        { id: "reviewer-auth", email: null },
        { runId: "run-1", action: "approve_candidate" }
      )).rejects.toMatchObject({
        status: 409,
        code: "review_candidate_source_binding_invalid",
        compensationRequired: false
      });
      expect(fake.updates).toEqual([]);
    }
  );

  it("blocks a source event that no longer satisfies the snapshot schema", async () => {
    const fake = makeReviewClient();
    if (!fake.events[0]) throw new Error("Expected fixture event");
    fake.events[0].reflected_documents = [];

    await expect(applyKnowledgeReviewAction(
      fake.client as never,
      { id: "reviewer-auth", email: null },
      { runId: "run-1", action: "reject" }
    )).rejects.toMatchObject({
      status: 409,
      code: "review_candidate_source_binding_invalid",
      compensationRequired: false
    });
    expect(fake.updates).toEqual([]);
  });

  it("approves a validated candidate while preserving an unpublished human receipt", async () => {
    const fake = makeReviewClient();
    const result = await applyKnowledgeReviewAction(
      fake.client as never,
      { id: "reviewer-auth", email: "reviewer@example.com" },
      { runId: "run-1", action: "approve_candidate" },
      { now: () => "2026-07-15T01:02:03.000Z" }
    );

    expect(result).toMatchObject({
      ok: true,
      action: "approve_candidate",
      runId: "run-1",
      runStatus: "approved",
      eventReviewStatus: "approved",
      publicationState: "unpublished",
      ontologyPublished: false,
      publishPerformed: false,
      migrationPerformed: false,
      atomic: false,
      compensationRequired: false,
      reviewer: { id: "reviewer-auth", email: "reviewer@example.com" }
    });
    expect(fake.updates).toHaveLength(3);
    expect(fake.updates[0]).toMatchObject({
      table: "knowledge_events",
      value: {
        review_status: "approved",
        proposed_wiki_update: {
          existingKey: "event-one",
          publicationState: "unpublished",
          ontologyPublished: false,
          publishPerformed: false,
          migrationPerformed: false,
          humanReviewReceipt: {
            contractVersion: "knowledge-human-review.v1",
            operationId: "knowledge-review:run-1:approve_candidate",
            action: "approve_candidate",
            scope: "promotion_candidate",
            runId: "run-1",
            organizationId: "org-1",
            siteId: "site-1",
            reviewedAt: "2026-07-15T01:02:03.000Z",
            reviewer: { id: "reviewer-auth", email: "reviewer@example.com" },
            atomic: false
          }
        }
      }
    });
    expect(fake.updates[1]).toMatchObject({
      table: "knowledge_events",
      value: {
        review_status: "approved",
        proposed_wiki_update: {
          existingKey: "event-two",
          humanReviewReceipt: { scope: "promotion_candidate" }
        }
      }
    });
    expect(fake.updates[2]).toMatchObject({
      table: "knowledge_regeneration_runs",
      value: {
        status: "approved",
        generated_output: {
          publicationState: "unpublished",
          ontologyPublished: false,
          publishPerformed: false,
          migrationPerformed: false,
          humanReviewReceipt: {
            action: "approve_candidate",
            scope: "promotion_candidate",
            runId: "run-1"
          }
        }
      }
    });
    expect(fake.events[0]?.payload).toEqual({ rawSecret: "preserve-one" });
    expect(fake.events[1]?.payload).toEqual({ rawSecret: "preserve-two" });
    expect(fake.calls).toContainEqual({
      table: "knowledge_regeneration_runs",
      operation: "in",
      column: "site_id",
      value: ["site-1"]
    });
    expect(fake.calls).toContainEqual({
      table: "knowledge_events",
      operation: "eq",
      column: "organization_id",
      value: "org-1"
    });
    expect(fake.calls).toContainEqual({
      table: "knowledge_events",
      operation: "eq",
      column: "site_id",
      value: "site-1"
    });
  });

  it.each([
    ["keep_site_only", "approved", "approved", "site_private"],
    ["reject", "failed", "rejected", "rejected"]
  ] as const)(
    "%s preserves the bounded run, event, and receipt states",
    async (action, runStatus, eventReviewStatus, scope) => {
      const fake = makeReviewClient();
      const result = await applyKnowledgeReviewAction(
        fake.client as never,
        { id: "reviewer-auth", email: null },
        { runId: "run-1", action },
        { now: () => "2026-07-15T02:00:00.000Z" }
      );

      expect(result).toMatchObject({
        action,
        runStatus,
        eventReviewStatus,
        publicationState: "unpublished",
        ontologyPublished: false,
        atomic: false,
        compensationRequired: false
      });
      expect(fake.updates[0]).toMatchObject({
        table: "knowledge_events",
        value: {
          review_status: eventReviewStatus,
          proposed_wiki_update: {
            humanReviewReceipt: { action, scope }
          }
        }
      });
      expect(fake.updates[1]).toMatchObject({
        table: "knowledge_events",
        value: {
          review_status: eventReviewStatus,
          proposed_wiki_update: {
            publicationState: "unpublished",
            ontologyPublished: false,
            humanReviewReceipt: { action, scope }
          }
        }
      });
    }
  );

  it.each([
    ["organization", { eventOrganizationId: "org-foreign" }],
    ["site", { eventSiteId: "site-foreign" }]
  ] as const)("performs no writes when a raw event crosses the run %s boundary", async (_label, options) => {
    const fake = makeReviewClient(options);

    await expect(applyKnowledgeReviewAction(
      fake.client as never,
      { id: "reviewer-auth", email: null },
      { runId: "run-1", action: "approve_candidate" }
    )).rejects.toMatchObject({
      status: 409,
      code: "review_event_tenant_mismatch",
      compensationRequired: false,
      updates: { runUpdated: false, eventsUpdated: false }
    });
    expect(fake.updates).toHaveLength(0);
  });

  it("keeps the run actionable and resumes only incomplete events after a partial failure", async () => {
    const fake = makeReviewClient({ eventUpdateErrorAt: 2 });

    try {
      await applyKnowledgeReviewAction(
        fake.client as never,
        { id: "reviewer-auth", email: "reviewer@example.com" },
        { runId: "run-1", action: "approve_candidate" },
        { now: () => "2026-07-16T08:00:00.000Z" }
      );
      throw new Error("Expected applyKnowledgeReviewAction to fail");
    } catch (error) {
      expect(error).toBeInstanceOf(KnowledgeReviewError);
      expect(error).toMatchObject({
        status: 500,
        code: "review_event_update_failed",
        compensationRequired: true,
        updates: {
          runUpdated: false,
          eventsUpdated: false,
          eventsUpdatedCount: 1,
          eventsTotal: 2
        }
      });
    }
    expect(fake.updates).toHaveLength(2);
    expect(fake.run.status).toBe("review_required");
    expect(fake.events[0]?.review_status).toBe("approved");
    expect(fake.events[1]?.review_status).toBe("pending_review");
    expect(fake.events[0]?.proposed_wiki_update).toMatchObject({
      publicationState: "unpublished",
      ontologyPublished: false,
      humanReviewReceipt: {
        action: "approve_candidate",
        runId: "run-1",
        organizationId: "org-1",
        siteId: "site-1"
      }
    });

    const retryResult = await applyKnowledgeReviewAction(
      fake.client as never,
      { id: "reviewer-auth", email: "reviewer@example.com" },
      { runId: "run-1", action: "approve_candidate" },
      { now: () => "2026-07-16T09:00:00.000Z" }
    );

    expect(retryResult).toMatchObject({
      ok: true,
      runStatus: "approved",
      compensationRequired: false,
      updates: {
        runUpdated: true,
        eventsUpdated: true,
        eventsUpdatedCount: 1,
        eventsTotal: 2
      }
    });
    expect(fake.updates).toHaveLength(4);
    expect(fake.updates[2]).toMatchObject({
      table: "knowledge_events",
      value: { review_status: "approved" }
    });
    expect(fake.updates[3]).toMatchObject({
      table: "knowledge_regeneration_runs",
      value: { status: "approved" }
    });
    expect(fake.run.status).toBe("approved");
    expect(fake.events.map((event) => event.review_status)).toEqual(["approved", "approved"]);
    expect(fake.events[1]?.proposed_wiki_update).toMatchObject({
      publicationState: "unpublished",
      ontologyPublished: false,
      humanReviewReceipt: {
        reviewedAt: "2026-07-16T08:00:00.000Z"
      }
    });
  });

  it("resumes pending events from a finalized legacy run-first partial state", async () => {
    const fake = makeReviewClient();
    const receipt = makeLegacyReceipt();
    fake.run.status = "approved";
    fake.run.generated_output = {
      ...fake.preparedOutput,
      publicationState: "unpublished",
      ontologyPublished: false,
      humanReviewReceipt: receipt
    };
    if (fake.events[0]) {
      fake.events[0].review_status = "approved";
      fake.events[0].proposed_wiki_update = {
        existingKey: "event-one",
        publicationState: "unpublished",
        ontologyPublished: false,
        humanReviewReceipt: receipt
      };
    }

    const result = await applyKnowledgeReviewAction(
      fake.client as never,
      { id: "reviewer-auth", email: null },
      { runId: "run-1", action: "approve_candidate" }
    );

    expect(result).toMatchObject({
      ok: true,
      runStatus: "approved",
      updates: {
        runUpdated: true,
        eventsUpdated: true,
        eventsUpdatedCount: 2,
        eventsTotal: 2
      }
    });
    expect(fake.updates).toHaveLength(3);
    expect(fake.updates[0]).toMatchObject({
      table: "knowledge_events",
      value: {
        proposed_wiki_update: {
          publicationState: "unpublished",
          ontologyPublished: false,
          publishPerformed: false,
          migrationPerformed: false,
          humanReviewReceipt: {
            operationId: "knowledge-review:run-1:approve_candidate",
            runId: "run-1",
            organizationId: "org-1",
            siteId: "site-1"
          }
        }
      }
    });
    expect(fake.updates[1]).toMatchObject({
      table: "knowledge_events",
      value: {
        review_status: "approved",
        proposed_wiki_update: {
          publicationState: "unpublished",
          ontologyPublished: false,
          publishPerformed: false,
          migrationPerformed: false
        }
      }
    });
    expect(fake.updates[2]).toMatchObject({
      table: "knowledge_regeneration_runs",
      value: {
        generated_output: {
          publicationState: "unpublished",
          ontologyPublished: false,
          publishPerformed: false,
          migrationPerformed: false,
          humanReviewReceipt: {
            operationId: "knowledge-review:run-1:approve_candidate",
            runId: "run-1",
            organizationId: "org-1",
            siteId: "site-1"
          }
        }
      }
    });
    expect(fake.events.map((event) => event.review_status)).toEqual(["approved", "approved"]);
  });

  it("blocks a finalized legacy resume when an actionable run shares an event", async () => {
    const fake = makeReviewClient({
      additionalRuns: [{
        id: "run-shared",
        organization_id: "org-1",
        site_id: "site-1",
        raw_event_ids: ["event-2"],
        generated_output: { candidate: "공유 이벤트 초안" },
        status: "generated"
      }]
    });
    const receipt = makeLegacyReceipt();
    fake.run.status = "approved";
    fake.run.generated_output = {
      ...fake.preparedOutput,
      humanReviewReceipt: receipt
    };
    if (fake.events[0]) {
      fake.events[0].review_status = "approved";
      fake.events[0].proposed_wiki_update = {
        existingKey: "event-one",
        publicationState: "unpublished",
        ontologyPublished: false,
        humanReviewReceipt: receipt
      };
    }

    await expect(applyKnowledgeReviewAction(
      fake.client as never,
      { id: "reviewer-auth", email: null },
      { runId: "run-1", action: "approve_candidate" }
    )).rejects.toMatchObject({
      status: 409,
      code: "review_shared_event_conflict",
      compensationRequired: false
    });
    expect(fake.updates).toHaveLength(0);
    expect(fake.events[1]?.review_status).toBe("pending_review");
  });

  it("blocks both finalized legacy runs that share the same pending event", async () => {
    const fake = makeReviewClient({
      additionalRuns: [{
        id: "run-2",
        organization_id: "org-1",
        site_id: "site-1",
        raw_event_ids: ["event-2"],
        generated_output: {
          humanReviewReceipt: {
            ...makeLegacyReceipt({ action: "reject" }),
            reviewer: { id: "reviewer-auth", email: null }
          }
        },
        status: "failed"
      }]
    });
    const approvedReceipt = makeLegacyReceipt();
    fake.run.status = "approved";
    fake.run.generated_output = {
      ...fake.preparedOutput,
      humanReviewReceipt: approvedReceipt
    };
    if (fake.events[0]) {
      fake.events[0].review_status = "approved";
      fake.events[0].proposed_wiki_update = {
        publicationState: "unpublished",
        ontologyPublished: false,
        humanReviewReceipt: approvedReceipt
      };
    }

    await expect(applyKnowledgeReviewAction(
      fake.client as never,
      { id: "reviewer-auth", email: null },
      { runId: "run-1", action: "approve_candidate" }
    )).rejects.toMatchObject({
      status: 409,
      code: "review_shared_event_conflict"
    });
    expect(fake.updates).toHaveLength(0);

    await expect(applyKnowledgeReviewAction(
      fake.client as never,
      { id: "reviewer-auth", email: null },
      { runId: "run-2", action: "reject" }
    )).rejects.toMatchObject({
      status: 409,
      code: "review_shared_event_conflict"
    });
    expect(fake.updates).toHaveLength(0);
    expect(fake.events[1]?.review_status).toBe("pending_review");
  });

  it("fails closed when a cross-reviewer finalized run shares a pending event", async () => {
    const fake = makeReviewClient({
      additionalRuns: [{
        id: "run-unrelated-final",
        organization_id: "org-1",
        site_id: "site-1",
        raw_event_ids: ["event-2"],
        generated_output: {
          humanReviewReceipt: makeLegacyReceipt({ reviewerId: "reviewer-other" })
        },
        status: "approved"
      }]
    });

    await expect(applyKnowledgeReviewAction(
      fake.client as never,
      { id: "reviewer-auth", email: null },
      { runId: "run-1", action: "approve_candidate" }
    )).rejects.toMatchObject({
      status: 409,
      code: "review_shared_event_conflict",
      compensationRequired: false
    });

    expect(fake.updates).toHaveLength(0);
    expect(fake.events.map((event) => event.review_status)).toEqual([
      "pending_review",
      "pending_review"
    ]);
  });

  it("fails closed when a malformed finalized receipt shares a pending event", async () => {
    const fake = makeReviewClient({
      additionalRuns: [{
        id: "run-malformed-final",
        organization_id: "org-1",
        site_id: "site-1",
        raw_event_ids: ["event-2"],
        generated_output: {
          humanReviewReceipt: {
            contractVersion: "knowledge-human-review.v1",
            action: "approve_candidate",
            scope: "promotion_candidate",
            reviewer: "malformed"
          }
        },
        status: "approved"
      }]
    });

    await expect(applyKnowledgeReviewAction(
      fake.client as never,
      { id: "reviewer-auth", email: null },
      { runId: "run-1", action: "approve_candidate" }
    )).rejects.toMatchObject({
      status: 409,
      code: "review_shared_event_conflict",
      compensationRequired: false
    });

    expect(fake.updates).toHaveLength(0);
    expect(fake.events[1]?.review_status).toBe("pending_review");
  });

  it("ignores a valid finalized run that overlaps only a completed event", async () => {
    const fake = makeReviewClient({
      additionalRuns: [{
        id: "run-completed-overlap",
        organization_id: "org-1",
        site_id: "site-1",
        raw_event_ids: ["event-1"],
        generated_output: {
          humanReviewReceipt: makeLegacyReceipt()
        },
        status: "approved"
      }]
    });
    if (fake.events[0]) {
      fake.events[0].review_status = "approved";
      fake.events[0].proposed_wiki_update = {
        publicationState: "unpublished",
        ontologyPublished: false,
        publishPerformed: false,
        migrationPerformed: false,
        humanReviewReceipt: makeReceipt()
      };
    }

    const result = await applyKnowledgeReviewAction(
      fake.client as never,
      { id: "reviewer-auth", email: null },
      { runId: "run-1", action: "approve_candidate" }
    );

    expect(result).toMatchObject({
      ok: true,
      updates: { eventsUpdatedCount: 1 }
    });
    expect(fake.events.map((event) => event.review_status)).toEqual(["approved", "approved"]);
  });

  it("rejects an arbitrary legacy receipt before writes", async () => {
    const fake = makeReviewClient();
    fake.run.generated_output = {
      ...fake.preparedOutput,
      humanReviewReceipt: makeLegacyReceipt()
    };

    await expect(applyKnowledgeReviewAction(
      fake.client as never,
      { id: "reviewer-auth", email: null },
      { runId: "run-1", action: "approve_candidate" }
    )).rejects.toMatchObject({
      status: 409,
      code: "review_idempotency_conflict",
      compensationRequired: true
    });
    expect(fake.updates).toHaveLength(0);
  });

  it.each([
    ["action", makeReceipt({ action: "reject" })],
    ["scope", makeReceipt({ scope: "site_private" })],
    ["organization", makeReceipt({ organizationId: "org-tampered" })],
    ["site", makeReceipt({ siteId: "site-tampered" })],
    ["operation", makeReceipt({ operationId: "knowledge-review:other:approve_candidate" })]
  ] as const)("rejects an actionable run with a mismatched %s receipt before writes", async (_label, receipt) => {
    const fake = makeReviewClient();
    fake.run.generated_output = {
      ...fake.preparedOutput,
      humanReviewReceipt: receipt
    };

    await expect(applyKnowledgeReviewAction(
      fake.client as never,
      { id: "reviewer-auth", email: null },
      { runId: "run-1", action: "approve_candidate" }
    )).rejects.toMatchObject({
      status: 409,
      code: "review_idempotency_conflict",
      compensationRequired: true
    });
    expect(fake.updates).toHaveLength(0);
  });

  it("rejects resume when the authenticated reviewer changed", async () => {
    const fake = makeReviewClient({ organizationOwnerId: "reviewer-new" });
    const oldReceipt = makeReceipt({ reviewerId: "reviewer-auth" });
    fake.run.generated_output = {
      ...fake.preparedOutput,
      humanReviewReceipt: oldReceipt
    };

    await expect(applyKnowledgeReviewAction(
      fake.client as never,
      { id: "reviewer-new", email: "new@example.com" },
      { runId: "run-1", action: "approve_candidate" }
    )).rejects.toMatchObject({
      status: 409,
      code: "review_idempotency_conflict"
    });
    expect(fake.updates).toHaveLength(0);
  });

  it("rejects a null-site partial state without mutation", async () => {
    const fake = makeReviewClient({ eventUpdateErrorAt: 2, eventSiteId: null });
    fake.run.site_id = null;

    await expect(applyKnowledgeReviewAction(
      fake.client as never,
      { id: "reviewer-auth", email: null },
      { runId: "run-1", action: "keep_site_only" },
      { now: () => "2026-07-16T08:00:00.000Z" }
    )).rejects.toMatchObject({ code: "review_run_forbidden" });
    expect(fake.updates).toHaveLength(0);
  });

  it("rejects a different action after a partial update without changing its receipt", async () => {
    const fake = makeReviewClient({ eventUpdateErrorAt: 2 });
    await expect(applyKnowledgeReviewAction(
      fake.client as never,
      { id: "reviewer-auth", email: null },
      { runId: "run-1", action: "approve_candidate" },
      { now: () => "2026-07-16T08:00:00.000Z" }
    )).rejects.toMatchObject({ code: "review_event_update_failed" });
    const writesAfterFailure = fake.updates.length;

    await expect(applyKnowledgeReviewAction(
      fake.client as never,
      { id: "reviewer-auth", email: null },
      { runId: "run-1", action: "reject" }
    )).rejects.toMatchObject({
      status: 409,
      code: "review_idempotency_conflict",
      compensationRequired: true
    });
    expect(fake.updates).toHaveLength(writesAfterFailure);
    expect(fake.events[0]?.review_status).toBe("approved");
  });

  it("treats a replay of a completed review as an idempotent no-op", async () => {
    const fake = makeReviewClient();
    const user = { id: "reviewer-auth", email: "reviewer@example.com" };
    const request = { runId: "run-1", action: "keep_site_only" } as const;
    await applyKnowledgeReviewAction(fake.client as never, user, request);
    const writesAfterSuccess = fake.updates.length;

    const replay = await applyKnowledgeReviewAction(fake.client as never, user, request);

    expect(replay).toMatchObject({
      ok: true,
      action: "keep_site_only",
      runStatus: "approved",
      compensationRequired: false,
      updates: {
        runUpdated: false,
        eventsUpdated: false,
        eventsUpdatedCount: 0,
        eventsTotal: 2
      }
    });
    expect(fake.updates).toHaveLength(writesAfterSuccess);
  });

  it.each([
    ["empty", ""],
    ["invalid", "2026-02-30T00:00:00Z"]
  ] as const)("fails closed for a finalized current receipt with %s reviewedAt", async (_label, reviewedAt) => {
    const fake = makeReviewClient();
    const receipt = makeReceipt({ reviewedAt });
    fake.run.status = "approved";
    fake.run.generated_output = {
      ...fake.preparedOutput,
      publicationState: "unpublished",
      ontologyPublished: false,
      publishPerformed: false,
      migrationPerformed: false,
      humanReviewReceipt: receipt
    };
    for (const event of fake.events) {
      event.review_status = "approved";
      event.proposed_wiki_update = {
        publicationState: "unpublished",
        ontologyPublished: false,
        publishPerformed: false,
        migrationPerformed: false,
        humanReviewReceipt: receipt
      };
    }

    await expect(applyKnowledgeReviewAction(
      fake.client as never,
      { id: "reviewer-auth", email: null },
      { runId: "run-1", action: "approve_candidate" }
    )).rejects.toMatchObject({
      status: 409,
      code: "review_idempotency_conflict",
      compensationRequired: true
    });
    expect(fake.updates).toHaveLength(0);
  });

  it("accepts a finalized current receipt with a valid RFC3339 instant", async () => {
    const fake = makeReviewClient();
    const receipt = makeReceipt({ reviewedAt: "2026-07-16T17:30:00+09:00" });
    fake.run.status = "approved";
    fake.run.generated_output = {
      ...fake.preparedOutput,
      publicationState: "unpublished",
      ontologyPublished: false,
      publishPerformed: false,
      migrationPerformed: false,
      humanReviewReceipt: receipt
    };
    for (const event of fake.events) {
      event.review_status = "approved";
      event.proposed_wiki_update = {
        publicationState: "unpublished",
        ontologyPublished: false,
        publishPerformed: false,
        migrationPerformed: false,
        humanReviewReceipt: receipt
      };
    }

    const result = await applyKnowledgeReviewAction(
      fake.client as never,
      { id: "reviewer-auth", email: null },
      { runId: "run-1", action: "approve_candidate" }
    );

    expect(result).toMatchObject({
      ok: true,
      updates: {
        runUpdated: false,
        eventsUpdated: false,
        eventsUpdatedCount: 0
      }
    });
    expect(fake.updates).toHaveLength(0);
  });

  it("detects a shared-event race as a compensating partial update", async () => {
    const fake = makeReviewClient({
      beforeEventUpdate(events, attempt) {
        if (attempt === 2 && events[1]) events[1].review_status = "approved";
      }
    });

    await expect(applyKnowledgeReviewAction(
      fake.client as never,
      { id: "reviewer-auth", email: null },
      { runId: "run-1", action: "keep_site_only" }
    )).rejects.toMatchObject({
      status: 500,
      code: "review_event_update_failed",
      compensationRequired: true,
      updates: {
        runUpdated: false,
        eventsUpdated: false,
        eventsUpdatedCount: 1,
        eventsTotal: 2
      }
    });
    expect(fake.events[0]?.proposed_wiki_update).toMatchObject({
      humanReviewReceipt: { scope: "site_private" }
    });
  });

  it("rejects an existing shared-event run before performing any write", async () => {
    const fake = makeReviewClient({
      additionalRuns: [{
        id: "run-shared",
        organization_id: "org-1",
        site_id: "site-1",
        raw_event_ids: ["event-2"],
        generated_output: "invalid-shared-output",
        status: "generated"
      }]
    });

    await expect(applyKnowledgeReviewAction(
      fake.client as never,
      { id: "reviewer-auth", email: null },
      { runId: "run-1", action: "approve_candidate" }
    )).rejects.toMatchObject({
      status: 409,
      code: "review_shared_event_conflict",
      compensationRequired: false
    });
    expect(fake.updates).toHaveLength(0);
  });

  it("ensures every run returned by GET is actionable by POST under the same contract", async () => {
    const fake = makeReviewClient();
    const user = { id: "reviewer-auth", email: "reviewer@example.com" };

    const inbox = await loadKnowledgeReviewInbox(fake.client as never, user);
    expect(inbox.queue.map((item) => item.runId)).toEqual(["run-1"]);

    for (const item of inbox.queue) {
      const result = await applyKnowledgeReviewAction(
        fake.client as never,
        user,
        { runId: item.runId, action: "approve_candidate" },
        { now: () => "2026-07-16T00:00:00.000Z" }
      );
      expect(result).toMatchObject({
        ok: true,
        runId: item.runId,
        runStatus: "approved",
        compensationRequired: false
      });
    }
  });

  it("resumes only the final run update after all events were safely reviewed", async () => {
    const fake = makeReviewClient({ runUpdateErrorAt: 1 });

    await expect(applyKnowledgeReviewAction(
      fake.client as never,
      { id: "reviewer-auth", email: null },
      { runId: "run-1", action: "reject" }
    )).rejects.toMatchObject({
      status: 500,
      code: "review_run_update_failed",
      compensationRequired: true,
      updates: {
        runUpdated: false,
        eventsUpdated: true,
        eventsUpdatedCount: 2,
        eventsTotal: 2
      }
    });
    expect(fake.updates).toHaveLength(3);
    expect(fake.updates.map((update) => update.table)).toEqual([
      "knowledge_events",
      "knowledge_events",
      "knowledge_regeneration_runs"
    ]);
    expect(fake.run.status).toBe("review_required");

    const retry = await applyKnowledgeReviewAction(
      fake.client as never,
      { id: "reviewer-auth", email: null },
      { runId: "run-1", action: "reject" }
    );
    expect(retry).toMatchObject({
      ok: true,
      runStatus: "failed",
      updates: {
        runUpdated: true,
        eventsUpdated: false,
        eventsUpdatedCount: 0,
        eventsTotal: 2
      }
    });
    expect(fake.updates).toHaveLength(4);
    expect(fake.updates[3]?.table).toBe("knowledge_regeneration_runs");
    expect(fake.run.status).toBe("failed");
  });

  it("reports no event write when a run-only retry fails again", async () => {
    const fake = makeReviewClient({ runUpdateError: new Error("run update unavailable") });

    await expect(applyKnowledgeReviewAction(
      fake.client as never,
      { id: "reviewer-auth", email: null },
      { runId: "run-1", action: "reject" }
    )).rejects.toMatchObject({
      code: "review_run_update_failed",
      updates: { eventsUpdated: true, eventsUpdatedCount: 2 }
    });

    await expect(applyKnowledgeReviewAction(
      fake.client as never,
      { id: "reviewer-auth", email: null },
      { runId: "run-1", action: "reject" }
    )).rejects.toMatchObject({
      code: "review_run_update_failed",
      updates: {
        runUpdated: false,
        eventsUpdated: false,
        eventsUpdatedCount: 0,
        eventsTotal: 2
      }
    });
  });

  it("keeps a stale final run update resumable after events are safely reviewed", async () => {
    const fake = makeReviewClient({
      beforeRunUpdate(run) {
        run.status = "approved";
      }
    });

    await expect(applyKnowledgeReviewAction(
      fake.client as never,
      { id: "reviewer-auth", email: null },
      { runId: "run-1", action: "approve_candidate" }
    )).rejects.toMatchObject({
      status: 500,
      code: "review_run_update_failed",
      compensationRequired: true,
      updates: {
        runUpdated: false,
        eventsUpdated: true,
        eventsUpdatedCount: 2,
        eventsTotal: 2
      }
    });
    expect(fake.updates).toHaveLength(3);
    expect(fake.events.map((event) => event.review_status)).toEqual(["approved", "approved"]);
    expect(fake.events.every((event) => (
      (event.proposed_wiki_update as Record<string, unknown>).publicationState === "unpublished"
    ))).toBe(true);

    const writesAfterFailure = fake.updates.length;
    const retry = await applyKnowledgeReviewAction(
      fake.client as never,
      { id: "reviewer-auth", email: null },
      { runId: "run-1", action: "approve_candidate" }
    );
    expect(retry).toMatchObject({
      ok: true,
      runStatus: "approved",
      updates: {
        runUpdated: true,
        eventsUpdated: false,
        eventsUpdatedCount: 0,
        eventsTotal: 2
      }
    });
    expect(fake.updates).toHaveLength(writesAfterFailure + 1);
    expect(fake.updates.at(-1)).toMatchObject({
      table: "knowledge_regeneration_runs",
      value: {
        generated_output: {
          publicationState: "unpublished",
          ontologyPublished: false,
          publishPerformed: false,
          migrationPerformed: false,
          humanReviewReceipt: {
            operationId: "knowledge-review:run-1:approve_candidate",
            runId: "run-1",
            organizationId: "org-1",
            siteId: "site-1"
          }
        }
      }
    });
  });

  it("normalizes a published final run from completed event receipts", async () => {
    const fake = makeReviewClient();
    const receipt = makeReceipt();
    fake.run.status = "approved";
    fake.run.generated_output = {
      ...fake.preparedOutput,
      publicationState: "published",
      ontologyPublished: true,
      publishPerformed: true,
      migrationPerformed: true
    };
    for (const event of fake.events) {
      event.review_status = "approved";
      event.proposed_wiki_update = {
        publicationState: "unpublished",
        ontologyPublished: false,
        publishPerformed: false,
        migrationPerformed: false,
        humanReviewReceipt: receipt
      };
    }

    const result = await applyKnowledgeReviewAction(
      fake.client as never,
      { id: "reviewer-auth", email: null },
      { runId: "run-1", action: "approve_candidate" }
    );

    expect(result).toMatchObject({
      ok: true,
      runStatus: "approved",
      updates: {
        runUpdated: true,
        eventsUpdated: false,
        eventsUpdatedCount: 0
      }
    });
    expect(fake.updates).toHaveLength(1);
    expect(fake.run.generated_output).toMatchObject({
      publicationState: "unpublished",
      ontologyPublished: false,
      publishPerformed: false,
      migrationPerformed: false,
      humanReviewReceipt: {
        operationId: "knowledge-review:run-1:approve_candidate",
        runId: "run-1",
        organizationId: "org-1",
        siteId: "site-1"
      }
    });
  });

  it.each([
    ["publicationState", { publicationState: "published" }],
    ["ontologyPublished", { ontologyPublished: true }],
    ["publishPerformed", { publishPerformed: true }],
    ["migrationPerformed", { migrationPerformed: true }]
  ] as const)("normalizes a completed event with unsafe top-level %s", async (_label, unsafeState) => {
    const fake = makeReviewClient();
    const receipt = makeReceipt();
    fake.run.status = "approved";
    fake.run.generated_output = {
      ...fake.preparedOutput,
      publicationState: "unpublished",
      ontologyPublished: false,
      publishPerformed: false,
      migrationPerformed: false,
      humanReviewReceipt: receipt
    };
    for (const event of fake.events) {
      event.review_status = "approved";
      event.proposed_wiki_update = {
        publicationState: "unpublished",
        ontologyPublished: false,
        publishPerformed: false,
        migrationPerformed: false,
        humanReviewReceipt: receipt
      };
    }
    if (fake.events[0]) {
      fake.events[0].proposed_wiki_update = {
        ...(fake.events[0].proposed_wiki_update as Record<string, unknown>),
        ...unsafeState
      };
    }

    const result = await applyKnowledgeReviewAction(
      fake.client as never,
      { id: "reviewer-auth", email: null },
      { runId: "run-1", action: "approve_candidate" }
    );

    expect(result).toMatchObject({
      ok: true,
      updates: {
        runUpdated: false,
        eventsUpdated: true,
        eventsUpdatedCount: 1,
        eventsTotal: 2
      }
    });
    expect(fake.updates).toHaveLength(1);
    expect(fake.events[0]?.proposed_wiki_update).toMatchObject({
      publicationState: "unpublished",
      ontologyPublished: false,
      publishPerformed: false,
      migrationPerformed: false
    });
  });

  it("drops body-supplied reviewer and tenant claims from the parsed request", () => {
    expect(parseKnowledgeReviewRequest({
      runId: "11111111-1111-4111-8111-111111111111",
      action: "approve_candidate",
      reviewer: { id: "forged-reviewer" },
      organizationId: "org-foreign",
      siteId: "site-foreign"
    })).toEqual({
      runId: "11111111-1111-4111-8111-111111111111",
      action: "approve_candidate"
    });
  });

  it("loads promotion approval and source digest from stored rows without writing", async () => {
    const fake = makeReviewClient();
    const receipt = makeReceipt();
    fake.run.status = "approved";
    fake.run.generated_output = {
      ...fake.preparedOutput,
      humanReviewReceipt: receipt
    };
    for (const event of fake.events) {
      event.review_status = "approved";
      event.proposed_wiki_update = {
        publicationState: "unpublished",
        ontologyPublished: false,
        publishPerformed: false,
        migrationPerformed: false,
        humanReviewReceipt: receipt
      };
    }

    const context = await loadOntologyPromotionTrustedContext(
      fake.client as never,
      { id: "reviewer-auth", email: null },
      {
        contractVersion: "ontology-promotion-command.v1",
        commandIdentity: "ontology-promotion-command:fixture",
        organizationId: "org-1",
        siteId: "site-1",
        runId: "run-1",
        action: "approve_candidate"
      }
    );

    expect(context).toMatchObject({
      authenticatedReviewerId: "reviewer-auth",
      organizationId: "org-1",
      siteId: "site-1",
      runId: "run-1",
      action: "approve_candidate",
      humanApprovalReceipt: receipt,
      source: {
        digestAlgorithm: "sha256",
        digest: expect.stringMatching(/^[a-f0-9]{64}$/u),
        publicationState: "unavailable",
        verificationState: "review_required"
      }
    });
    expect(fake.updates).toEqual([]);
  });

  it("rejects a forged stored approval receipt without writing", async () => {
    const fake = makeReviewClient();
    const receipt = makeReceipt();
    fake.run.status = "approved";
    fake.run.generated_output = {
      ...fake.preparedOutput,
      humanReviewReceipt: { ...receipt, reviewer: { id: "forged-reviewer", email: null } }
    };
    for (const event of fake.events) {
      event.review_status = "approved";
      event.proposed_wiki_update = {
        publicationState: "unpublished",
        ontologyPublished: false,
        publishPerformed: false,
        migrationPerformed: false,
        humanReviewReceipt: receipt
      };
    }

    await expect(loadOntologyPromotionTrustedContext(
      fake.client as never,
      { id: "reviewer-auth", email: null },
      {
        contractVersion: "ontology-promotion-command.v1",
        commandIdentity: "ontology-promotion-command:fixture",
        organizationId: "org-1",
        siteId: "site-1",
        runId: "run-1",
        action: "approve_candidate"
      }
    )).rejects.toMatchObject({ code: "promotion_stored_receipt_invalid" });
    expect(fake.updates).toEqual([]);
  });

  it("rejects a forged command tenant without writing", async () => {
    const fake = makeReviewClient();

    await expect(loadOntologyPromotionTrustedContext(
      fake.client as never,
      { id: "reviewer-auth", email: null },
      {
        contractVersion: "ontology-promotion-command.v1",
        commandIdentity: "ontology-promotion-command:fixture",
        organizationId: "org-foreign",
        siteId: "site-1",
        runId: "run-1",
        action: "approve_candidate"
      }
    )).rejects.toMatchObject({ code: "promotion_tenant_forbidden" });
    expect(fake.updates).toEqual([]);
  });

  it("rejects source data that no longer matches the stored snapshot digest without writing", async () => {
    const fake = makeReviewClient();
    const receipt = makeReceipt();
    fake.run.status = "approved";
    fake.run.generated_output = {
      ...fake.preparedOutput,
      humanReviewReceipt: receipt
    };
    for (const event of fake.events) {
      event.review_status = "approved";
      event.proposed_wiki_update = {
        publicationState: "unpublished",
        ontologyPublished: false,
        publishPerformed: false,
        migrationPerformed: false,
        humanReviewReceipt: receipt
      };
    }
    if (fake.events[0]) fake.events[0].payload = { tampered: true };

    await expect(loadOntologyPromotionTrustedContext(
      fake.client as never,
      { id: "reviewer-auth", email: null },
      {
        contractVersion: "ontology-promotion-command.v1",
        commandIdentity: "ontology-promotion-command:fixture",
        organizationId: "org-1",
        siteId: "site-1",
        runId: "run-1",
        action: "approve_candidate"
      }
    )).rejects.toMatchObject({ code: "promotion_source_digest_mismatch" });
    expect(fake.updates).toEqual([]);
  });
});
