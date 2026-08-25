import { describe, expect, it } from "vitest";
import {
  buildKnowledgeCandidate,
  classifyKnowledgeEvent,
  type KnowledgeCandidate
} from "@/lib/knowledge-governance";
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
  const provenance = classifyKnowledgeEvent({
    source: "manual",
    sourceId: "manual-1",
    capturedAt: "2026-07-16T00:00:00.000Z",
    title: "작업자 홍길동 서명 포함 원문",
    url: "https://private.example/photo.jpg?signature=secret",
    payload: { residentNumber: "secret", photo: "base64-secret", signature: "secret" },
    relatedHazardIds: ["hazard-fall"],
    reflectedDocuments: ["위험성평가표"]
  }, { organizationId: "org-1", siteId: "site-1" });
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
    generatedText: [
      "1) 위험요인 요약: 작업발판 단부 추락 위험",
      "2) 문서 반영 위치: 위험성평가표와 TBM 브리핑",
      "3) 통제대책: 추락 방지 난간 상태를 작업 전 확인",
      "4) 검수 필요 항목: 현장 책임자가 실제 설치 상태 확인"
    ].join("\n"),
    matchedHazardIds: ["hazard-fall"],
    tenantContext: { organizationId: "org-1", siteId: "site-1" },
    provenance: [provenance]
  };
}

function makeClient(options: FakeOptions = {}) {
  const calls: Array<{ table: string; operation: string; column: string; value: unknown }> = [];
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
  return { client, tables, writes, calls, getOntologyWriteCount: () => ontologyWriteCount };
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

  it("preserves catalog hazard meaning without leaking raw event text into the builder question", async () => {
    const rawChemicalEvent = {
      source: "manual" as const,
      sourceId: "manual-secret",
      capturedAt: "2026-07-16T00:00:00.000Z",
      title: "김철수 화학 세척 작업 원문",
      url: "https://private.example/secret",
      payload: { residentNumber: "secret", scenario: "피부 접촉" },
      relatedHazardIds: ["chemical-msds"],
      reflectedDocuments: ["위험성평가표"]
    };
    const fake = makeClient({
      run: { question: "김철수 서명 완료 화학물질 세척 검토" },
      events: [{
        id: "event-1",
        organization_id: "org-1",
        site_id: "site-1",
        source: rawChemicalEvent.source,
        source_id: rawChemicalEvent.sourceId,
        captured_at: rawChemicalEvent.capturedAt,
        title: rawChemicalEvent.title,
        url: rawChemicalEvent.url,
        payload: rawChemicalEvent.payload,
        related_hazard_ids: rawChemicalEvent.relatedHazardIds,
        reflected_documents: rawChemicalEvent.reflectedDocuments,
        review_status: "pending_review"
      }]
    });
    let builderQuestion = "";

    await prepareKnowledgeReviewCandidate(fake.client, user, { runId: "run-1" }, {
      buildCandidate: async (input) => {
        builderQuestion = input.question;
        return {
          candidate: buildKnowledgeCandidate({
            question: input.question,
            rawEvents: [rawChemicalEvent],
            matchedHazardIds: ["chemical-msds"],
            generatedText: [
              "1) 위험요인 요약: 화학물질 세척제 누출과 피부 접촉 위험",
              "2) 문서 반영 위치: 위험성평가표와 안전보건교육",
              "3) 통제대책: MSDS와 보호구를 작업 전 확인",
              "4) 검수 필요 항목: 현장 책임자가 실제 세척제와 환기 상태 확인"
            ].join("\n"),
            providerLabel: "fixture-provider",
            tenantContext: { organizationId: "org-1", siteId: "site-1" }
          }),
          configured: true,
          providerLabel: "fixture-provider"
        };
      }
    });

    expect(builderQuestion).toContain("화학물질·세척제 노출");
    expect(builderQuestion).not.toMatch(/김철수|residentNumber|피부 접촉|manual-secret/u);
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

  it.each([
    {
      name: "empty provenance",
      mutate: (candidate: KnowledgeCandidate): KnowledgeCandidate => ({ ...candidate, provenance: [] })
    },
    {
      name: "stale event digest",
      mutate: (candidate: KnowledgeCandidate): KnowledgeCandidate => ({
        ...candidate,
        provenance: candidate.provenance.map((item) => ({
          ...item,
          eventReference: { ...item.eventReference, digest: "0".repeat(64) }
        }))
      })
    },
    {
      name: "foreign tenant provenance",
      mutate: (candidate: KnowledgeCandidate): KnowledgeCandidate => ({
        ...candidate,
        provenance: candidate.provenance.map((item) => ({
          ...item,
          tenantContext: { organizationId: "org-foreign", siteId: "site-foreign" }
        }))
      })
    }
  ])("blocks $name before persistence", async ({ mutate }) => {
    const fake = makeClient();

    await expect(prepareKnowledgeReviewCandidate(fake.client, user, { runId: "run-1" }, {
      buildCandidate: async () => ({
        candidate: mutate(makeCandidate("run-1")),
        configured: true,
        providerLabel: "fixture-provider"
      })
    })).rejects.toMatchObject({ code: "candidate_source_binding_invalid" });

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
    expect(inbox.queue[0].status).toBe("review_required");

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
