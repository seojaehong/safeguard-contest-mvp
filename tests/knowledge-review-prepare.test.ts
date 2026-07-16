import { describe, expect, it } from "vitest";
import type { KnowledgeCandidate } from "@/lib/knowledge-governance";
import {
  KnowledgeReviewPrepareError,
  prepareKnowledgeReviewCandidate
} from "@/lib/knowledge-review-prepare";
import {
  applyKnowledgeReviewAction,
  loadKnowledgeReviewInbox
} from "@/lib/knowledge-review";

type Row = Record<string, unknown>;

type FakeOptions = {
  run?: Partial<Row>;
  events?: Row[];
  additionalRuns?: Row[];
};

function makeCandidate(runId: string): KnowledgeCandidate {
  return {
    contractVersion: "knowledge-candidate.v2",
    stage: "candidate",
    reviewStatus: "pending_review",
    publicationState: "unpublished",
    generatedBy: "hermes_or_llm",
    providerLabel: "fixture-provider",
    authority: "none",
    nextStage: "human_review",
    dbMutationAllowed: false,
    dbMutationPerformed: false,
    publishAllowed: false,
    question: "원본 이벤트 1건 기반 현장 지식 후보 검토",
    generatedText: "추락 방지 난간 상태를 확인하고 현장 책임자가 검토합니다.",
    matchedHazardIds: ["hazard-fall"],
    tenantContext: { organizationId: "org-1", siteId: "site-1" },
    provenance: []
  };
}

function makeClient(options: FakeOptions = {}) {
  const baseRun: Row = {
    id: "run-1",
    organization_id: "org-1",
    site_id: "site-1",
    question: "홍길동 서명 완료 추락 위험 검토",
    raw_event_ids: ["event-1"],
    generated_output: {},
    provider: null,
    status: "draft",
    created_at: "2026-07-16T00:01:00.000Z",
    ...options.run
  };
  const baseEvents: Row[] = options.events ?? [{
    id: "event-1",
    organization_id: "org-1",
    site_id: "site-1",
    source: "manual",
    source_id: "manual-1",
    captured_at: "2026-07-16T00:00:00.000Z",
    title: "작업자 홍길동 서명 포함 원문",
    url: "https://private.example/photo.jpg?signature=secret",
    payload: { residentNumber: "secret", photo: "base64-secret", signature: "secret" },
    related_hazard_ids: ["hazard-fall"],
    reflected_documents: ["위험성평가표"],
    review_status: "pending_review",
    proposed_wiki_update: {},
    created_at: "2026-07-16T00:00:00.000Z"
  }];
  const tables: Record<string, Row[]> = {
    organizations: [{ id: "org-1", owner_id: "reviewer-1" }],
    sites: [{ id: "site-1", organization_id: "org-1" }],
    knowledge_events: baseEvents,
    knowledge_regeneration_runs: [baseRun, ...(options.additionalRuns ?? [])]
  };
  const writes: Array<{ table: string; value: Row }> = [];
  let ontologyWriteCount = 0;

  function project(row: Row, columns: string | null): Row {
    if (!columns) return { ...row };
    return Object.fromEntries(columns.split(",").map((column) => {
      const key = column.trim();
      return [key, row[key]];
    }));
  }

  const rawClient = {
    from(table: string) {
      if (table.includes("ontology")) ontologyWriteCount += 1;
      const filters: Array<(row: Row) => boolean> = [];
      let columns: string | null = null;
      let updateValue: Row | null = null;

      function execute() {
        const matched = (tables[table] ?? []).filter((row) => filters.every((filter) => filter(row)));
        if (updateValue) {
          writes.push({ table, value: updateValue });
          for (const row of matched) Object.assign(row, updateValue);
        }
        return { data: matched.map((row) => project(row, columns)), error: null };
      }

      const query = {
        select(value: string) { columns = value; return query; },
        eq(column: string, value: unknown) {
          filters.push((row) => row[column] === value);
          return query;
        },
        in(column: string, values: unknown[]) {
          filters.push((row) => values.includes(row[column]));
          return query;
        },
        overlaps(column: string, values: unknown[]) {
          filters.push((row) => Array.isArray(row[column]) && row[column].some((value) => values.includes(value)));
          return query;
        },
        is(column: string, value: unknown) {
          filters.push((row) => row[column] === value);
          return query;
        },
        order() { return query; },
        update(value: Row) { updateValue = value; return query; },
        async maybeSingle() {
          const result = execute();
          return { data: result.data[0] ?? null, error: result.error };
        },
        async single() {
          const result = execute();
          return result.data.length === 1
            ? { data: result.data[0], error: null }
            : { data: null, error: new Error(`Expected one ${table} row, received ${result.data.length}`) };
        },
        then(resolve: (value: ReturnType<typeof execute>) => unknown) {
          return Promise.resolve(execute()).then(resolve);
        }
      };
      return query;
    }
  };

  const client = rawClient as unknown as Parameters<typeof prepareKnowledgeReviewCandidate>[0];
  return { client, tables, writes, getOntologyWriteCount: () => ontologyWriteCount };
}

const user = { id: "reviewer-1", email: "reviewer@example.com" };

describe("knowledge review candidate preparation", () => {
  it("persists one redacted candidate and moves a valid draft to review_required", async () => {
    const fake = makeClient();
    let builderQuestion = "";

    const result = await prepareKnowledgeReviewCandidate(fake.client, user, { runId: "run-1" }, {
      buildCandidate: async (input) => {
        builderQuestion = input.question;
        return {
          candidate: makeCandidate("run-1"),
          configured: true,
          providerLabel: "fixture-provider"
        };
      }
    });

    expect(result).toMatchObject({
      ok: true,
      runId: "run-1",
      status: "review_required",
      publicationState: "unpublished",
      ontologyPublished: false
    });
    expect(fake.writes).toHaveLength(1);
    expect(fake.tables.knowledge_regeneration_runs[0]).toMatchObject({
      status: "review_required",
      provider: "fixture-provider",
      generated_output: {
        candidate: {
          contractVersion: "knowledge-candidate.v2",
          publicationState: "unpublished",
          publishAllowed: false
        },
        publicationState: "unpublished",
        ontologyPublished: false,
        publishPerformed: false,
        migrationPerformed: false
      }
    });
    expect(JSON.stringify(result)).not.toMatch(/홍길동|residentNumber|base64-secret|signature=secret/u);
    expect(builderQuestion).toBe("원본 이벤트 1건 기반 현장 지식 후보 검토");
    expect(builderQuestion).not.toContain("홍길동");
  });

  it.each([
    { name: "cross-organization event", options: { events: [{
      id: "event-1", organization_id: "org-2", site_id: "site-1", source: "manual",
      source_id: "manual-1", captured_at: "2026-07-16T00:00:00.000Z", title: "cross",
      url: null, payload: {}, related_hazard_ids: [], reflected_documents: [],
      review_status: "pending_review", proposed_wiki_update: {}, created_at: "2026-07-16T00:00:00.000Z"
    }] } },
    { name: "cross-site event", options: { events: [{
      id: "event-1", organization_id: "org-1", site_id: "site-2", source: "manual",
      source_id: "manual-1", captured_at: "2026-07-16T00:00:00.000Z", title: "cross",
      url: null, payload: {}, related_hazard_ids: [], reflected_documents: [],
      review_status: "pending_review", proposed_wiki_update: {}, created_at: "2026-07-16T00:00:00.000Z"
    }] } },
    { name: "missing event", options: { events: [] } },
    { name: "duplicate event ids", options: { run: { raw_event_ids: ["event-1", "event-1"] } } },
    { name: "shared event", options: { additionalRuns: [{
      id: "run-2", organization_id: "org-1", site_id: "site-1", question: "shared",
      raw_event_ids: ["event-1"], generated_output: {}, provider: null, status: "draft",
      created_at: "2026-07-16T00:02:00.000Z"
    }] } },
    { name: "invalid status", options: { run: { status: "approved" } } }
  ])("blocks $name before all writes", async ({ options }) => {
    const fake = makeClient(options);

    await expect(prepareKnowledgeReviewCandidate(fake.client, user, { runId: "run-1" }, {
      buildCandidate: async () => ({
        candidate: makeCandidate("run-1"),
        configured: true,
        providerLabel: "fixture-provider"
      })
    })).rejects.toBeInstanceOf(KnowledgeReviewPrepareError);

    expect(fake.writes).toEqual([]);
  });

  it.each([
    { generatedText: "", providerLabel: "fixture-provider" },
    { generatedText: "   ", providerLabel: null }
  ])("does not make an empty candidate reviewable", async ({ generatedText, providerLabel }) => {
    const fake = makeClient();
    const candidate = { ...makeCandidate("run-1"), generatedText, providerLabel };

    await expect(prepareKnowledgeReviewCandidate(fake.client, user, { runId: "run-1" }, {
      buildCandidate: async () => ({ candidate, configured: true, providerLabel })
    })).rejects.toMatchObject({ code: "candidate_empty" });
    expect(fake.writes).toEqual([]);
  });

  it("keeps the draft unchanged when candidate generation fails", async () => {
    const fake = makeClient();

    await expect(prepareKnowledgeReviewCandidate(fake.client, user, { runId: "run-1" }, {
      buildCandidate: async () => {
        throw new Error("fixture generation failure");
      }
    })).rejects.toMatchObject({ code: "candidate_generation_failed" });

    expect(fake.writes).toEqual([]);
    expect(fake.tables.knowledge_regeneration_runs[0].status).toBe("draft");
  });

  it("completes prepare, inbox load, and existing approval without publishing", async () => {
    const fake = makeClient();
    await prepareKnowledgeReviewCandidate(fake.client, user, { runId: "run-1" }, {
      buildCandidate: async () => ({
        candidate: makeCandidate("run-1"),
        configured: true,
        providerLabel: "fixture-provider"
      })
    });

    const inbox = await loadKnowledgeReviewInbox(fake.client, user);
    expect(inbox.queue).toHaveLength(1);
    expect(inbox.queue[0].run.status).toBe("review_required");

    const review = await applyKnowledgeReviewAction(fake.client, user, {
      runId: "run-1",
      action: "approve_candidate"
    }, { now: () => "2026-07-16T09:00:00.000+09:00" });

    expect(review).toMatchObject({
      runStatus: "approved",
      publicationState: "unpublished",
      ontologyPublished: false,
      publishPerformed: false
    });
    expect(fake.getOntologyWriteCount()).toBe(0);
    expect(fake.tables.knowledge_regeneration_runs[0].generated_output).toMatchObject({
      humanReviewReceipt: {
        action: "approve_candidate",
        publicationState: "unpublished",
        ontologyPublished: false
      }
    });
  });
});
