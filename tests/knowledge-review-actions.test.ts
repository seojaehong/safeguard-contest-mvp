import { describe, expect, it } from "vitest";
import {
  applyKnowledgeReviewAction,
  KnowledgeReviewError,
  loadKnowledgeReviewInbox,
  parseKnowledgeReviewRequest
} from "@/lib/knowledge-review";

type FakeOptions = {
  runUpdateError?: Error;
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
  const run: Record<string, unknown> = {
    id: "run-1",
    organization_id: "org-1",
    site_id: "site-1",
    raw_event_ids: ["event-1", "event-2"],
    generated_output: { candidate: "기존 검토 초안" },
    status: "review_required"
  };
  const events: Array<Record<string, unknown>> = [
    {
      id: "event-1",
      organization_id: options.eventOrganizationId ?? "org-1",
      site_id: options.eventSiteId === undefined ? "site-1" : options.eventSiteId,
      review_status: "pending_review",
      proposed_wiki_update: { existingKey: "event-one" },
      payload: { rawSecret: "preserve-one" }
    },
    {
      id: "event-2",
      organization_id: options.eventOrganizationId ?? "org-1",
      site_id: options.eventSiteId === undefined ? "site-1" : options.eventSiteId,
      review_status: "pending_review",
      proposed_wiki_update: { existingKey: "event-two" },
      payload: { rawSecret: "preserve-two" }
    }
  ];
  const tables: Record<string, Array<Record<string, unknown>>> = {
    organizations: [{ id: "org-1", owner_id: "reviewer-auth" }],
    sites: [{ id: "site-1", organization_id: "org-1" }],
    knowledge_regeneration_runs: [run, ...(options.additionalRuns ?? [])],
    knowledge_events: events
  };
  const updates: Array<{ table: string; value: unknown }> = [];
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
          if (table === "knowledge_regeneration_runs" && options.runUpdateError) {
            return { data: null, error: options.runUpdateError };
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
          filters.push((row) => row[column] === value);
          return query;
        },
        in(column: string, values: unknown[]) {
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

  return { client, events, run, updates };
}

describe("knowledge review actions", () => {
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
      table: "knowledge_regeneration_runs",
      value: {
        status: "approved",
        generated_output: {
          candidate: "기존 검토 초안",
          publicationState: "unpublished",
          ontologyPublished: false,
          humanReviewReceipt: {
            contractVersion: "knowledge-human-review.v1",
            action: "approve_candidate",
            scope: "promotion_candidate",
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
          existingKey: "event-one",
          publicationState: "unpublished",
          ontologyPublished: false,
          humanReviewReceipt: {
            action: "approve_candidate",
            scope: "promotion_candidate",
            reviewer: { id: "reviewer-auth", email: "reviewer@example.com" },
            reviewedAt: "2026-07-15T01:02:03.000Z"
          }
        }
      }
    });
    expect(fake.updates[2]).toMatchObject({
      table: "knowledge_events",
      value: {
        review_status: "approved",
        proposed_wiki_update: {
          existingKey: "event-two",
          humanReviewReceipt: { scope: "promotion_candidate" }
        }
      }
    });
    expect(fake.events[0]?.payload).toEqual({ rawSecret: "preserve-one" });
    expect(fake.events[1]?.payload).toEqual({ rawSecret: "preserve-two" });
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
        table: "knowledge_regeneration_runs",
        value: {
          status: runStatus,
          generated_output: {
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

  it("reports required compensation when the second update fails after the run update", async () => {
    const fake = makeReviewClient({ eventUpdateErrorAt: 2 });

    try {
      await applyKnowledgeReviewAction(
        fake.client as never,
        { id: "reviewer-auth", email: "reviewer@example.com" },
        { runId: "run-1", action: "approve_candidate" }
      );
      throw new Error("Expected applyKnowledgeReviewAction to fail");
    } catch (error) {
      expect(error).toBeInstanceOf(KnowledgeReviewError);
      expect(error).toMatchObject({
        status: 500,
        code: "review_event_update_failed",
        compensationRequired: true,
        updates: {
          runUpdated: true,
          eventsUpdated: false,
          eventsUpdatedCount: 1,
          eventsTotal: 2
        }
      });
    }
    expect(fake.updates).toHaveLength(3);
    expect(fake.events[0]?.review_status).toBe("approved");
    expect(fake.events[1]?.review_status).toBe("pending_review");
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
        runUpdated: true,
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
    expect(inbox.queue.map((item) => item.run.id)).toEqual(["run-1"]);

    for (const item of inbox.queue) {
      const result = await applyKnowledgeReviewAction(
        fake.client as never,
        user,
        { runId: item.run.id, action: "approve_candidate" },
        { now: () => "2026-07-16T00:00:00.000Z" }
      );
      expect(result).toMatchObject({
        ok: true,
        runId: item.run.id,
        runStatus: "approved",
        compensationRequired: false
      });
    }
  });

  it("does not attempt the event update when the run update fails", async () => {
    const fake = makeReviewClient({ runUpdateError: new Error("run update unavailable") });

    await expect(applyKnowledgeReviewAction(
      fake.client as never,
      { id: "reviewer-auth", email: null },
      { runId: "run-1", action: "reject" }
    )).rejects.toMatchObject({
      status: 500,
      code: "review_run_update_failed",
      compensationRequired: false,
      updates: { runUpdated: false, eventsUpdated: false }
    });
    expect(fake.updates).toHaveLength(1);
    expect(fake.updates[0]?.table).toBe("knowledge_regeneration_runs");
  });

  it("fails a stale conditional run update before touching events", async () => {
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
      compensationRequired: false,
      updates: {
        runUpdated: false,
        eventsUpdated: false,
        eventsUpdatedCount: 0,
        eventsTotal: 0
      }
    });
    expect(fake.updates).toHaveLength(1);
  });

  it("drops body-supplied reviewer and tenant claims from the parsed request", () => {
    expect(parseKnowledgeReviewRequest({
      runId: "run-1",
      action: "approve_candidate",
      reviewer: { id: "forged-reviewer" },
      organizationId: "org-foreign",
      siteId: "site-foreign"
    })).toEqual({
      runId: "run-1",
      action: "approve_candidate"
    });
  });
});
