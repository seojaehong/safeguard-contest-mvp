import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { buildKnowledgeCandidate } from "@/lib/knowledge-governance";
import {
  buildKnowledgeReviewSourceSnapshot,
  type KnowledgeReviewSourceEventRow
} from "@/lib/knowledge-review-prepare";
import * as knowledgeReview from "@/lib/knowledge-review";

const mocks = vi.hoisted(() => ({
  createSupabaseAdminClient: vi.fn(),
  getWorkspaceUser: vi.fn()
}));

type QueryCall = {
  table: string;
  operation: string;
  args: unknown[];
};

type QueryResult = {
  data: unknown;
  error: Error | null;
};

type DatabaseRows = Record<string, Array<Record<string, unknown>>>;

function makeReadClient(
  overrides: Partial<DatabaseRows> = {},
  errors: Partial<Record<string, Error>> = {}
) {
  const calls: QueryCall[] = [];
  const rows: DatabaseRows = {
    organizations: [{ id: "org-owned", owner_id: "reviewer-1" }],
    sites: [{ id: "site-1", organization_id: "org-owned" }],
    knowledge_events: [{
      id: "event-1",
      organization_id: "org-owned",
      site_id: "site-1",
      source: "manual",
      source_id: "manual-1",
      captured_at: "2026-07-15T00:00:00.000Z",
      title: "현장 검토 이벤트",
      url: "https://private.example/token-secret",
      payload: { workerNote: "raw-secret" },
      related_hazard_ids: ["fall-scaffold"],
      reflected_documents: ["위험성평가표"],
      review_status: "pending_review",
      created_at: "2026-07-15T00:01:00.000Z"
    }],
    knowledge_regeneration_runs: [{
      id: "run-1",
      organization_id: "org-owned",
      site_id: "site-1",
      question: "추락 위험 검토",
      raw_event_ids: ["event-1"],
      generated_output: { candidate: "검토 초안" },
      provider: "vertex",
      status: "review_required",
      created_at: "2026-07-15T00:02:00.000Z"
    }],
    ...overrides
  };
  for (const event of rows.knowledge_events ?? []) {
    if (!Array.isArray(event.reflected_documents) || event.reflected_documents.length === 0) {
      event.reflected_documents = ["fixture-document"];
    }
    event.payload ??= {};
    event.url ??= null;
  }
  for (const run of rows.knowledge_regeneration_runs ?? []) {
    if (run.status !== "review_required"
      || typeof run.organization_id !== "string"
      || typeof run.site_id !== "string"
      || !Array.isArray(run.raw_event_ids)
      || typeof run.generated_output !== "object"
      || run.generated_output === null) continue;
    const sourceEvents = run.raw_event_ids
      .map((eventId) => rows.knowledge_events?.find((event) => event.id === eventId))
      .filter((event): event is Record<string, unknown> => event !== undefined);
    if (sourceEvents.length !== run.raw_event_ids.length
      || sourceEvents.some((event) => event.organization_id !== run.organization_id || event.site_id !== run.site_id)) continue;
    const sourceBinding = buildKnowledgeReviewSourceSnapshot({
      eventIds: run.raw_event_ids as string[],
      events: sourceEvents as KnowledgeReviewSourceEventRow[],
      tenantContext: { organizationId: run.organization_id, siteId: run.site_id }
    });
    const candidate = buildKnowledgeCandidate({
      question: `원본 이벤트 ${sourceEvents.length}건 기반 현장 지식 후보 검토`,
      rawEvents: sourceBinding.rawEvents,
      matchedHazardIds: [...new Set(sourceEvents.flatMap((event) => (
        Array.isArray(event.related_hazard_ids)
          ? event.related_hazard_ids.filter((item): item is string => typeof item === "string")
          : []
      )))],
      generatedText: "현장 안전 지식 후보를 검토합니다.",
      providerLabel: typeof run.provider === "string" ? run.provider : null,
      tenantContext: { organizationId: run.organization_id, siteId: run.site_id }
    });
    run.generated_output = {
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
  }

  return {
    calls,
    client: {
      from(table: string) {
        const filters: Array<(row: Record<string, unknown>) => boolean> = [];
        const query = {
          select(...args: unknown[]) { calls.push({ table, operation: "select", args }); return query; },
          eq(column: string, value: unknown) {
            const args = [column, value];
            calls.push({ table, operation: "eq", args });
            filters.push((row) => row[column] === value);
            return query;
          },
          in(column: string, values: unknown[]) {
            const args = [column, values];
            calls.push({ table, operation: "in", args });
            filters.push((row) => values.includes(row[column]));
            return query;
          },
          order(...args: unknown[]) { calls.push({ table, operation: "order", args }); return query; },
          then(resolve: (value: QueryResult) => unknown) {
            const data = (rows[table] ?? []).filter((row) => filters.every((filter) => filter(row)));
            return Promise.resolve({ data, error: errors[table] ?? null }).then(resolve);
          }
        };
        return query;
      }
    }
  };
}

vi.mock("@/lib/supabase-admin", () => ({
  createSupabaseAdminClient: mocks.createSupabaseAdminClient,
  getWorkspaceUser: mocks.getWorkspaceUser
}));

beforeEach(() => {
  vi.clearAllMocks();
  mocks.createSupabaseAdminClient.mockReturnValue(null);
});

describe("knowledge review route fail-closed setup", () => {
  it.each(["GET", "POST"])("returns 503 for %s when Supabase is not configured", async (method) => {
    const route = await import("@/app/api/knowledge/review/route");
    const request = new NextRequest("http://localhost/api/knowledge/review", {
      method,
      headers: { "content-type": "application/json" },
      ...(method === "POST"
        ? { body: JSON.stringify({ runId: "11111111-1111-4111-8111-111111111111", action: "approve_candidate" }) }
        : {})
    });

    const response = method === "GET"
      ? await route.GET(request)
      : await route.POST(request);
    const payload = await response.json();

    expect(response.status).toBe(503);
    expect(payload).toMatchObject({
      ok: false,
      configured: false,
      atomic: false
    });
    expect(mocks.getWorkspaceUser).not.toHaveBeenCalled();
  });

  it.each(["GET", "POST"])("returns 401 for unauthenticated %s requests", async (method) => {
    mocks.createSupabaseAdminClient.mockReturnValue({});
    mocks.getWorkspaceUser.mockResolvedValue(null);
    const route = await import("@/app/api/knowledge/review/route");
    const request = new NextRequest("http://localhost/api/knowledge/review", {
      method,
      headers: { "content-type": "application/json" },
      ...(method === "POST"
        ? { body: JSON.stringify({ runId: "11111111-1111-4111-8111-111111111111", action: "approve_candidate" }) }
        : {})
    });

    const response = method === "GET"
      ? await route.GET(request)
      : await route.POST(request);

    expect(response.status).toBe(401);
  });

  it.each(["publish", "publish_public", "migrate"])("rejects the unsupported %s action", async (action) => {
    mocks.createSupabaseAdminClient.mockReturnValue({});
    mocks.getWorkspaceUser.mockResolvedValue({ id: "reviewer-1", email: null });
    const { POST } = await import("@/app/api/knowledge/review/route");

    const response = await POST(new NextRequest("http://localhost/api/knowledge/review", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: "Bearer test-token"
      },
      body: JSON.stringify({ runId: "run-1", action })
    }));
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload).toMatchObject({
      ok: false,
      code: "invalid_review_action",
      atomic: false,
      compensationRequired: false
    });
  });

  it.each(["run-1", "11111111-1111-1111-8111-111111111111", "{11111111-1111-4111-8111-111111111111}"])(
    "rejects non-canonical review UUID %s before applying an action",
    async (runId) => {
      mocks.createSupabaseAdminClient.mockReturnValue({});
      mocks.getWorkspaceUser.mockResolvedValue({ id: "reviewer-1", email: null });
      const applySpy = vi.spyOn(knowledgeReview, "applyKnowledgeReviewAction");
      const { POST } = await import("@/app/api/knowledge/review/route");

      const response = await POST(new NextRequest("http://localhost/api/knowledge/review", {
        method: "POST",
        headers: { "content-type": "application/json", authorization: "Bearer test-token" },
        body: JSON.stringify({ runId, action: "approve_candidate" })
      }));

      expect(response.status).toBe(400);
      expect(mocks.createSupabaseAdminClient).not.toHaveBeenCalled();
      expect(mocks.getWorkspaceUser).not.toHaveBeenCalled();
      expect(applySpy).not.toHaveBeenCalled();
      applySpy.mockRestore();
    }
  );
});

describe("knowledge review GET", () => {
  it("returns only the owned review inbox without raw event payloads", async () => {
    const fake = makeReadClient();
    mocks.createSupabaseAdminClient.mockReturnValue(fake.client);
    mocks.getWorkspaceUser.mockResolvedValue({ id: "reviewer-1", email: "reviewer@example.com" });
    const { GET } = await import("@/app/api/knowledge/review/route");

    const response = await GET(new NextRequest("http://localhost/api/knowledge/review", {
      headers: { authorization: "Bearer test-token" }
    }));
    const payload = await response.json();
    const serialized = JSON.stringify(payload);

    expect(response.status).toBe(200);
    expect(payload).toMatchObject({
      ok: true,
      configured: true,
      queue: [{
        runId: "run-1",
        status: "review_required",
        sourceEventCount: 1,
        candidateText: "현장 안전 지식 후보를 검토합니다.",
        evidenceItems: [{
          authorityId: "external_context",
          authorityLabel: "외부 작업 맥락",
          sourceLabel: "외부 작업 맥락",
          capturedAt: "2026-07-15T00:00:00.000Z",
          metadata: [],
          publicUrl: null
        }],
        reviewContract: {
          contractVersion: "knowledge-candidate-review.v1",
          status: "human_review_required",
          presentAuthorityIds: ["external_context"],
          sourceRoleCounts: {
            sifIncidentControlEvidence: 0,
            koshaTechnicalGuidance: 0,
            lawStatutorySource: 0,
            organizationPrivateMemory: 0,
            sitePrivateMemory: 0,
            externalContext: 1
          },
          statutoryClaimsRequireLawProvenance: true,
          tenantMemoryPublicPromotionAllowed: false,
          siteManagerAcceptanceRequiredBeforeWorkpackUse: true,
          publicationState: "unpublished",
          humanReviewRequired: true,
          machineEvidenceReplacesHumanReview: false
        },
        contentReadiness: {
          contractVersion: "knowledge-candidate-content-readiness.v1",
          status: "revision_required",
          requiredSectionCount: 4,
          presentSectionCount: 0,
          nonEmptySectionCount: 0,
          placeholderFindingCount: 0,
          legalOverclaimFindingCount: 0,
          humanReviewCompleted: false,
          publicationState: "unpublished",
          publishAllowed: false
        }
      }],
      dropped: {
        runCount: 0,
        eventCount: 0,
        reasons: []
      }
    });
    expect(serialized).not.toContain("raw-secret");
    expect(serialized).not.toContain("token-secret");
    expect(payload.queue[0].evidenceItems).toHaveLength(1);
    expect(payload.queue[0].evidenceItems[0].id).toMatch(/^evidence-[0-9a-f]{16}$/u);
    expect(payload.queue[0].evidenceItems[0].digest).toMatch(/^sha256:[0-9a-f]{16}$/u);
    expect(payload.queue[0].traceabilityComplete).toBe(true);
    expect(payload.queue[0].traceItems).toEqual([
      expect.objectContaining({
        hazardId: "fall-scaffold",
        hazardTitle: "비계·고소작업 추락",
        resolved: true,
        evidenceIds: [payload.queue[0].evidenceItems[0].id]
      })
    ]);
    expect(payload.queue[0].traceItems[0].controls.length).toBeGreaterThan(0);
    expect(payload.queue[0].traceItems[0].primaryDocuments).toContain("위험성평가표");
    for (const forbidden of [
      "현장 검토 이벤트",
      "manual-1",
      "추락 위험 검토",
      "org-owned",
      "site-1",
      "rawEventIds",
      "generatedOutput",
      '"events"'
    ]) {
      expect(serialized, `network response exposes ${forbidden}`).not.toContain(forbidden);
    }
    expect(payload.queue[0]).toEqual(expect.objectContaining({
      runId: "run-1",
      status: "review_required",
      sourceEventCount: 1
    }));
    expect(payload.queue[0].run).toBeUndefined();
    expect(fake.calls).toContainEqual({
      table: "organizations",
      operation: "eq",
      args: ["owner_id", "reviewer-1"]
    });
    expect(fake.calls).toContainEqual({
      table: "knowledge_events",
      operation: "in",
      args: ["organization_id", ["org-owned"]]
    });
    expect(fake.calls).toContainEqual({
      table: "knowledge_events",
      operation: "eq",
      args: ["review_status", "pending_review"]
    });
    expect(fake.calls).toContainEqual({
      table: "knowledge_regeneration_runs",
      operation: "in",
      args: ["status", ["draft", "generated", "review_required"]]
    });
  });

  it("exposes only bounded public references while keeping tenant evidence generic", async () => {
    const fake = makeReadClient({
      knowledge_events: [{
        id: "event-law",
        organization_id: "org-owned",
        site_id: "site-1",
        source: "lawgo",
        source_id: "law-secret-id",
        captured_at: "2026-07-15T00:00:00.000Z",
        title: "산업안전보건법 제38조",
        url: "https://www.law.go.kr/법령/산업안전보건법",
        payload: { article: "제38조", internalNote: "law-raw-secret" },
        related_hazard_ids: ["fall-scaffold"],
        reflected_documents: ["위험성평가표"],
        review_status: "pending_review",
        created_at: "2026-07-15T00:00:00.000Z"
      }, {
        id: "event-site",
        organization_id: "org-owned",
        site_id: "site-1",
        source: "manual",
        source_id: "site-secret-id",
        captured_at: "2026-07-15T00:01:00.000Z",
        title: "홍길동 현장 비공개 관찰",
        url: "https://attacker.invalid/private-token",
        payload: {
          provenanceScope: "site",
          workerNote: "private-worker-note",
          reviewFacts: [
            "야간 교대 작업",
            "청각 경보 보조수단 필요",
            "resident-id: 900101-1234567",
            "worker-phone: 010-9876-5432"
          ]
        },
        related_hazard_ids: ["fall-scaffold"],
        reflected_documents: ["위험성평가표"],
        review_status: "pending_review",
        created_at: "2026-07-15T00:01:00.000Z"
      }],
      knowledge_regeneration_runs: [{
        id: "run-public-private",
        organization_id: "org-owned",
        site_id: "site-1",
        question: "공개·비공개 근거 검토",
        raw_event_ids: ["event-law", "event-site"],
        generated_output: {},
        provider: "vertex",
        status: "review_required",
        created_at: "2026-07-15T00:02:00.000Z"
      }]
    });
    mocks.createSupabaseAdminClient.mockReturnValue(fake.client);
    mocks.getWorkspaceUser.mockResolvedValue({ id: "reviewer-1", email: "reviewer@example.com" });
    const { GET } = await import("@/app/api/knowledge/review/route");

    const response = await GET(new NextRequest("http://localhost/api/knowledge/review", {
      headers: { authorization: "Bearer test-token" }
    }));
    const payload = await response.json();
    const serialized = JSON.stringify(payload);

    expect(response.status).toBe(200);
    expect(payload.queue[0].evidenceItems).toEqual([
      expect.objectContaining({
        authorityId: "law",
        sourceLabel: "산업안전보건법 제38조",
        metadata: [{ label: "조문", value: "제38조" }],
        publicUrl: expect.stringMatching(/^https:\/\/www\.law\.go\.kr\//u)
      }),
      expect.objectContaining({
        authorityId: "site_history",
        sourceLabel: "현장 전용 이력",
        metadata: [],
        publicUrl: null,
        reviewFacts: ["야간 교대 작업", "청각 경보 보조수단 필요"]
      })
    ]);
    for (const forbidden of [
      "law-secret-id",
      "site-secret-id",
      "law-raw-secret",
      "private-worker-note",
      "홍길동",
      "private-token",
      "resident-id",
      "worker-phone",
      "org-owned",
      "site-1"
    ]) {
      expect(serialized, `evidence response exposes ${forbidden}`).not.toContain(forbidden);
    }
  });

  it("drops invalid relations and generated output without exposing their contents", async () => {
    const fake = makeReadClient({
      knowledge_events: [
        {
          id: "event-valid",
          organization_id: "org-owned",
          site_id: "site-1",
          source: "manual",
          source_id: "valid",
          captured_at: "2026-07-15T00:00:00.000Z",
          title: "유효 이벤트",
          related_hazard_ids: [],
          reflected_documents: [],
          review_status: "pending_review",
          created_at: "2026-07-15T00:00:00.000Z"
        },
        {
          id: "event-cross-site",
          organization_id: "org-owned",
          site_id: "site-2",
          source: "manual",
          source_id: "cross-site",
          captured_at: "2026-07-15T00:00:00.000Z",
          title: "다른 현장 이벤트",
          related_hazard_ids: [],
          reflected_documents: [],
          review_status: "pending_review",
          created_at: "2026-07-15T00:00:00.000Z"
        },
        {
          id: "event-invalid-output",
          organization_id: "org-owned",
          site_id: "site-1",
          source: "manual",
          source_id: "invalid-output",
          captured_at: "2026-07-15T00:00:00.000Z",
          title: "비정상 output 이벤트",
          related_hazard_ids: [],
          reflected_documents: [],
          review_status: "pending_review",
          created_at: "2026-07-15T00:00:00.000Z"
        }
      ],
      knowledge_regeneration_runs: [
        {
          id: "run-valid",
          organization_id: "org-owned",
          site_id: "site-1",
          question: "유효 run",
          raw_event_ids: ["event-valid"],
          generated_output: { candidate: "safe-candidate" },
          provider: "vertex",
          status: "review_required",
          created_at: "2026-07-15T00:00:00.000Z"
        },
        {
          id: "run-missing-event",
          organization_id: "org-owned",
          site_id: "site-1",
          question: "누락 run",
          raw_event_ids: ["event-missing"],
          generated_output: { candidate: "missing-event-secret" },
          provider: "vertex",
          status: "generated",
          created_at: "2026-07-15T00:00:00.000Z"
        },
        {
          id: "run-cross-site",
          organization_id: "org-owned",
          site_id: "site-1",
          question: "교차 현장 run",
          raw_event_ids: ["event-cross-site"],
          generated_output: { candidate: "cross-site-secret" },
          provider: "vertex",
          status: "review_required",
          created_at: "2026-07-15T00:00:00.000Z"
        },
        {
          id: "run-invalid-output",
          organization_id: "org-owned",
          site_id: "site-1",
          question: "비정상 output run",
          raw_event_ids: ["event-invalid-output"],
          generated_output: "invalid-output-secret",
          provider: "vertex",
          status: "draft",
          created_at: "2026-07-15T00:00:00.000Z"
        }
      ]
    });
    mocks.createSupabaseAdminClient.mockReturnValue(fake.client);
    mocks.getWorkspaceUser.mockResolvedValue({ id: "reviewer-1", email: null });
    const { GET } = await import("@/app/api/knowledge/review/route");

    const response = await GET(new NextRequest("http://localhost/api/knowledge/review", {
      headers: { authorization: "Bearer test-token" }
    }));
    const payload = await response.json();
    const serialized = JSON.stringify(payload);

    expect(response.status).toBe(200);
    expect(payload.queue).toHaveLength(1);
    expect(payload.queue[0].runId).toBe("run-valid");
    expect(payload.dropped).toEqual({
      runCount: 3,
      eventCount: 1,
      reasons: [
        { runId: "run-missing-event", reason: "raw_event_missing_or_not_pending" },
        { runId: "run-cross-site", reason: "raw_event_missing_or_not_pending" },
        { runId: "run-invalid-output", reason: "generated_output_invalid" }
      ]
    });
    expect(serialized).not.toContain("missing-event-secret");
    expect(serialized).not.toContain("cross-site-secret");
    expect(serialized).not.toContain("invalid-output-secret");
  });

  it("drops every actionable run that shares a pending raw event", async () => {
    const sharedEvent = {
      id: "event-shared",
      organization_id: "org-owned",
      site_id: "site-1",
      source: "manual",
      source_id: "shared",
      captured_at: "2026-07-15T00:00:00.000Z",
      title: "공유 이벤트",
      related_hazard_ids: [],
      reflected_documents: [],
      review_status: "pending_review",
      created_at: "2026-07-15T00:00:00.000Z"
    };
    const fake = makeReadClient({
      knowledge_events: [sharedEvent],
      knowledge_regeneration_runs: ["run-shared-a", "run-shared-b"].map((id, index) => ({
        id,
        organization_id: "org-owned",
        site_id: "site-1",
        question: id,
        raw_event_ids: ["event-shared"],
        generated_output: index === 0 ? { candidate: `${id}-private-output` } : "invalid-private-output",
        provider: "vertex",
        status: "review_required",
        created_at: "2026-07-15T00:00:00.000Z"
      }))
    });
    mocks.createSupabaseAdminClient.mockReturnValue(fake.client);
    mocks.getWorkspaceUser.mockResolvedValue({ id: "reviewer-1", email: null });
    const { GET } = await import("@/app/api/knowledge/review/route");

    const response = await GET(new NextRequest("http://localhost/api/knowledge/review", {
      headers: { authorization: "Bearer test-token" }
    }));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.queue).toEqual([]);
    expect(payload.dropped).toEqual({
      runCount: 2,
      eventCount: 1,
      reasons: [
        { runId: "run-shared-a", reason: "shared_event_conflict" },
        { runId: "run-shared-b", reason: "shared_event_conflict" }
      ]
    });
    expect(JSON.stringify(payload)).not.toContain("private-output");
  });

  it("does not hide an actionable run when another site references its event", async () => {
    const sharedEvent = {
      id: "event-site-1",
      organization_id: "org-owned",
      site_id: "site-1",
      source: "manual",
      source_id: "shared-across-sites",
      captured_at: "2026-07-15T00:00:00.000Z",
      title: "현장 1 이벤트",
      related_hazard_ids: [],
      reflected_documents: [],
      review_status: "pending_review",
      created_at: "2026-07-15T00:00:00.000Z"
    };
    const fake = makeReadClient({
      sites: [
        { id: "site-1", organization_id: "org-owned" },
        { id: "site-2", organization_id: "org-owned" }
      ],
      knowledge_events: [sharedEvent],
      knowledge_regeneration_runs: [
        {
          id: "run-valid-site-1",
          organization_id: "org-owned",
          site_id: "site-1",
          question: "정상 후보",
          raw_event_ids: [sharedEvent.id],
          generated_output: { candidate: "site-1-output" },
          provider: "vertex",
          status: "review_required",
          created_at: "2026-07-15T00:00:00.000Z"
        },
        {
          id: "run-invalid-site-2",
          organization_id: "org-owned",
          site_id: "site-2",
          question: "다른 현장의 잘못된 참조",
          raw_event_ids: [sharedEvent.id],
          generated_output: { candidate: "site-2-output" },
          provider: "vertex",
          status: "review_required",
          created_at: "2026-07-15T00:00:00.000Z"
        }
      ]
    });
    mocks.createSupabaseAdminClient.mockReturnValue(fake.client);
    mocks.getWorkspaceUser.mockResolvedValue({ id: "reviewer-1", email: null });
    const { GET } = await import("@/app/api/knowledge/review/route");

    const response = await GET(new NextRequest("http://localhost/api/knowledge/review", {
      headers: { authorization: "Bearer test-token" }
    }));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.queue.map((item: { runId: string }) => item.runId)).toEqual(["run-valid-site-1"]);
    expect(payload.dropped.reasons).toContainEqual({
      runId: "run-invalid-site-2",
      reason: "tenant_mismatch"
    });
    expect(payload.dropped.reasons).not.toContainEqual({
      runId: "run-valid-site-1",
      reason: "shared_event_conflict"
    });
  });

  it("drops runs whose non-null site is missing or belongs to another organization", async () => {
    const event = (id: string, siteId: string) => ({
      id,
      organization_id: "org-owned",
      site_id: siteId,
      source: "manual",
      source_id: id,
      captured_at: "2026-07-15T00:00:00.000Z",
      title: id,
      related_hazard_ids: [],
      reflected_documents: [],
      review_status: "pending_review",
      created_at: "2026-07-15T00:00:00.000Z"
    });
    const run = (id: string, siteId: string, eventId: string) => ({
      id,
      organization_id: "org-owned",
      site_id: siteId,
      question: id,
      raw_event_ids: [eventId],
      generated_output: { candidate: id },
      provider: "vertex",
      status: "review_required",
      created_at: "2026-07-15T00:00:00.000Z"
    });
    const fake = makeReadClient({
      organizations: [
        { id: "org-owned", owner_id: "reviewer-1" },
        { id: "org-foreign", owner_id: "foreign-owner" }
      ],
      sites: [
        { id: "site-1", organization_id: "org-owned" },
        { id: "site-foreign", organization_id: "org-foreign" }
      ],
      knowledge_events: [
        event("event-valid", "site-1"),
        event("event-foreign-site", "site-foreign"),
        event("event-missing-site", "site-missing")
      ],
      knowledge_regeneration_runs: [
        run("run-valid", "site-1", "event-valid"),
        run("run-foreign-site", "site-foreign", "event-foreign-site"),
        run("run-missing-site", "site-missing", "event-missing-site")
      ]
    });
    mocks.createSupabaseAdminClient.mockReturnValue(fake.client);
    mocks.getWorkspaceUser.mockResolvedValue({ id: "reviewer-1", email: null });
    const { GET } = await import("@/app/api/knowledge/review/route");

    const response = await GET(new NextRequest("http://localhost/api/knowledge/review", {
      headers: { authorization: "Bearer test-token" }
    }));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.queue.map((item: { runId: string }) => item.runId)).toEqual(["run-valid"]);
    expect(payload.dropped).toEqual({
      runCount: 0,
      eventCount: 0,
      reasons: []
    });
    expect(fake.calls).toContainEqual({
      table: "sites",
      operation: "in",
      args: ["organization_id", ["org-owned"]]
    });
  });

  it("fails the entire queue closed when the batched site query fails", async () => {
    const fake = makeReadClient({}, { sites: new Error("site lookup unavailable") });
    mocks.createSupabaseAdminClient.mockReturnValue(fake.client);
    mocks.getWorkspaceUser.mockResolvedValue({ id: "reviewer-1", email: null });
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const { GET } = await import("@/app/api/knowledge/review/route");

    const response = await GET(new NextRequest("http://localhost/api/knowledge/review", {
      headers: { authorization: "Bearer test-token" }
    }));
    const payload = await response.json();

    expect(response.status).toBe(500);
    expect(payload).toMatchObject({
      ok: false,
      atomic: false,
      compensationRequired: false
    });
    expect(payload.queue).toBeUndefined();
    consoleSpy.mockRestore();
  });
});

describe("knowledge review POST failure disclosure", () => {
  it("returns 500 with compensationRequired after a run-only partial update", async () => {
    mocks.createSupabaseAdminClient.mockReturnValue({});
    mocks.getWorkspaceUser.mockResolvedValue({ id: "reviewer-1", email: "reviewer@example.com" });
    const applySpy = vi.spyOn(knowledgeReview, "applyKnowledgeReviewAction").mockRejectedValue(
      new knowledgeReview.KnowledgeReviewError({
        status: 500,
        code: "review_event_update_failed",
        message: "run은 갱신됐지만 원본 이벤트 상태 저장이 완료되지 않았습니다.",
        compensationRequired: true,
        updates: {
          runUpdated: true,
          eventsUpdated: false,
          eventsUpdatedCount: 1,
          eventsTotal: 2
        }
      })
    );
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const { POST } = await import("@/app/api/knowledge/review/route");

    const response = await POST(new NextRequest("http://localhost/api/knowledge/review", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: "Bearer test-token"
      },
      body: JSON.stringify({ runId: "11111111-1111-4111-8111-111111111111", action: "approve_candidate" })
    }));
    const payload = await response.json();

    expect(response.status).toBe(500);
    expect(payload).toMatchObject({
      ok: false,
      code: "review_event_update_failed",
      atomic: false,
      compensationRequired: true,
      updates: {
        runUpdated: true,
        eventsUpdated: false,
        eventsUpdatedCount: 1,
        eventsTotal: 2
      }
    });
    expect(consoleSpy).toHaveBeenCalledWith(
      "knowledge review action failed",
      expect.objectContaining({
        code: "review_event_update_failed",
        compensationRequired: true
      })
    );

    applySpy.mockRestore();
    consoleSpy.mockRestore();
  });
});
