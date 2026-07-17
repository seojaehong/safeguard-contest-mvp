import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

type FixtureRow = Record<string, unknown>;
type FixtureTables = Record<string, FixtureRow[]>;
type QueryFilter = { method: "eq" | "in"; column: string; value: unknown };
type OperationGraphResponse = {
  graph: {
    input: {
      improvements: Array<{ id: string }>;
      confirmations: Array<{ displayName: string }>;
    };
  };
};

const mocks = vi.hoisted(() => ({
  createSupabaseAdminClient: vi.fn(),
  loadOwnedWorkpackOperationContext: vi.fn()
}));

vi.mock("@/lib/supabase-admin", () => ({
  createSupabaseAdminClient: mocks.createSupabaseAdminClient,
  getWorkspaceUser: async () => ({ id: "user-1", email: "owner@example.com" }),
  toJson: (value: unknown) => value
}));

vi.mock("@/lib/workpack-commercial-store", () => ({
  loadOwnedWorkpackOperationContext: mocks.loadOwnedWorkpackOperationContext,
  loadServerShareRecipients: vi.fn(),
  loadActiveOwnedShareSession: vi.fn()
}));

vi.mock("@/lib/generation-evidence", () => ({
  buildGenerationEvidenceComparison: vi.fn(),
  generationEvidenceReferences: () => [],
  mergeGenerationImprovements: (_snapshot: unknown, improvements: unknown[]) => improvements,
  verifyAskResponseGenerationEvidence: () => ({
    ok: true,
    snapshot: {
      generatedAt: "2026-07-17T00:00:00.000Z",
      question: "tenant tuple test",
      scenario: { workSummary: "tuple test task" },
      dbHarnessPacket: {
        workpackMemory: [],
        retrievalContract: { mode: "fixture", vector: { enabled: false } }
      }
    }
  })
}));

vi.mock("@/lib/workpack-learning-export", () => ({
  buildWorkpackLearningFile: (input: unknown) => ({
    content: JSON.stringify(input),
    contentType: "application/json",
    fileName: "tenant-tuple.json"
  }),
  normalizeLearningVisionPayload: () => ({}),
  normalizeWorkpackLearningFormat: () => "json",
  WORKPACK_LEARNING_GOVERNANCE: {
    authority: "fixture",
    promotionStatus: "candidate",
    runtimeAuthority: false
  }
}));

vi.mock("@/lib/ontology/operation-memory", () => ({
  buildOperationMemoryGraph: (input: unknown) => ({ input })
}));

vi.mock("@/lib/safety-reference-catalog-server", () => ({
  searchSafetyReferences: vi.fn()
}));

function executeRows(rows: FixtureRow[], filters: QueryFilter[]): FixtureRow[] {
  return rows.filter((row) => filters.every((filter) => filter.method === "in"
    ? Array.isArray(filter.value) && filter.value.includes(row[filter.column])
    : row[filter.column] === filter.value));
}

function createFixtureClient(tables: FixtureTables) {
  const calls: Array<{ table: string; method: "eq" | "is"; column: string; value: unknown }> = [];

  return {
    client: {
      from(table: string) {
        const filters: QueryFilter[] = [];
        const query = {
          select() {
            return query;
          },
          eq(column: string, value: unknown) {
            filters.push({ method: "eq", column, value });
            calls.push({ table, method: "eq", column, value });
            return query;
          },
          is(column: string, value: unknown) {
            filters.push({ method: "eq", column, value });
            calls.push({ table, method: "is", column, value });
            return query;
          },
          in(column: string, value: unknown[]) {
            filters.push({ method: "in", column, value });
            return query;
          },
          async order() {
            return { data: executeRows(tables[table] || [], filters), error: null };
          },
          async maybeSingle() {
            const rows = executeRows(tables[table] || [], filters);
            return { data: rows.length === 1 ? rows[0] : null, error: null };
          },
          then<TResult1 = { data: FixtureRow[]; error: null }, TResult2 = never>(
            onFulfilled?: ((value: { data: FixtureRow[]; error: null }) => TResult1 | PromiseLike<TResult1>) | null,
            onRejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null
          ) {
            const result = { data: executeRows(tables[table] || [], filters), error: null as null };
            return Promise.resolve(result).then(onFulfilled, onRejected);
          }
        };
        return query;
      }
    },
    calls
  };
}

function ownedContext(siteId: string | null) {
  return {
    ok: true,
    context: {
      organizationId: "org-a",
      siteId,
      workpackId: "workpack-a",
      question: "tenant tuple test",
      generatedAt: "2026-07-17T00:00:00.000Z",
      shareAuthority: {
        workpack: { generationEvidence: { version: "fixture" } },
        readiness: { canShare: true, status: "ready", summary: "ready", reasons: [] }
      }
    }
  };
}

function fixtureRows(siteId: string | null): FixtureTables {
  const tenant = { organization_id: "org-a", site_id: siteId, workpack_id: "workpack-a" };
  return {
    workers: [
      {
        id: "11111111-1111-4111-8111-111111111111",
        organization_id: "org-a",
        site_id: siteId,
        external_key: "worker-match",
        display_name: "Tenant A Worker",
        role: "worker",
        joined_at: null,
        experience_summary: "",
        nationality: "KR",
        language_code: "ko",
        language_label: "한국어",
        is_new_worker: false,
        is_foreign_worker: false,
        training_status: "completed",
        training_summary: "",
        phone: null,
        email: null
      },
      {
        id: "22222222-2222-4222-8222-222222222222",
        organization_id: "org-b",
        site_id: siteId,
        external_key: "worker-foreign",
        display_name: "Foreign Org Worker",
        role: "worker",
        joined_at: null,
        experience_summary: "",
        nationality: "KR",
        language_code: "ko",
        language_label: "한국어",
        is_new_worker: false,
        is_foreign_worker: false,
        training_status: "completed",
        training_summary: "",
        phone: null,
        email: null
      }
    ],
    workpack_share_sessions: [
      {
        id: "session-match",
        ...tenant,
        recipients_snapshot: [{
          workerId: "11111111-1111-4111-8111-111111111111",
          displayName: "Tenant A Worker",
          languageCode: "ko",
          role: "viewer",
          workerSnapshot: {
            workerId: "11111111-1111-4111-8111-111111111111",
            displayName: "Tenant A Worker"
          }
        }],
        share_scope: "invited",
        access_policy: {
          anonymousAllowed: false,
          manualLanguageSwitchAllowed: true,
          requireKnownWorkerSnapshot: true
        },
        status: "active",
        expires_at: "2099-01-01T00:00:00.000Z",
        created_by: "user-1",
        created_at: "2026-07-17T00:00:00.000Z"
      },
      {
        id: "33333333-3333-4333-8333-333333333333",
        ...tenant,
        recipients_snapshot: [{
          workerId: "11111111-1111-4111-8111-111111111111",
          displayName: "Tenant A Worker",
          languageCode: "ko",
          role: "viewer",
          workerSnapshot: {
            workerId: "11111111-1111-4111-8111-111111111111",
            displayName: "Tenant A Worker"
          }
        }],
        share_scope: "invited",
        access_policy: {
          anonymousAllowed: false,
          manualLanguageSwitchAllowed: true,
          requireKnownWorkerSnapshot: true
        },
        status: "active",
        expires_at: "2099-01-01T00:00:00.000Z",
        created_by: "user-1",
        created_at: "2026-07-17T00:00:00.000Z"
      },
      {
        id: "session-wrong-org",
        ...tenant,
        organization_id: "org-b",
        recipients_snapshot: [],
        share_scope: "invited",
        access_policy: {
          anonymousAllowed: false,
          manualLanguageSwitchAllowed: true,
          requireKnownWorkerSnapshot: true
        },
        status: "active",
        expires_at: "2099-01-01T00:00:00.000Z",
        created_by: "user-1",
        created_at: "2026-07-17T00:00:00.000Z"
      },
      {
        id: "session-wrong-site",
        ...tenant,
        site_id: "site-b",
        recipients_snapshot: [],
        share_scope: "invited",
        access_policy: {
          anonymousAllowed: false,
          manualLanguageSwitchAllowed: true,
          requireKnownWorkerSnapshot: true
        },
        status: "active",
        expires_at: "2099-01-01T00:00:00.000Z",
        created_by: "user-1",
        created_at: "2026-07-17T00:00:00.000Z"
      }
    ],
    workpacks: [
      {
        id: "workpack-a",
        organization_id: "org-a",
        site_id: siteId,
        question: "Tenant A 작업팩",
        deliverables: {
          riskAssessmentDraft: "위험성평가표 본문: 추락 위험과 통제조치를 확인합니다.",
          tbmBriefing: "TBM 브리핑 본문: 강풍 시 작업중지 기준을 공유합니다.",
          tbmLogDraft: "TBM 기록 본문: 작업자가 확인 버튼으로 열람을 남깁니다.",
          kakaoMessage: "한국어 전송본",
          foreignWorkerLanguages: [{
            code: "vi",
            nativeLabel: "Tiếng Việt",
            lines: ["Dừng công việc khi gió mạnh.", "Kiểm tra dây an toàn."]
          }]
        }
      }
    ],
    workpack_read_confirmations: [
      {
        id: "confirmation-match",
        ...tenant,
        worker_display_name: "Tenant A Worker",
        language_code: "ko",
        read_at: "2026-07-17T00:00:00.000Z"
      },
      {
        id: "confirmation-wrong-org",
        ...tenant,
        organization_id: "org-b",
        worker_display_name: "Foreign Org Worker",
        language_code: "en",
        read_at: "2026-07-17T00:00:00.000Z"
      },
      {
        id: "confirmation-wrong-site",
        ...tenant,
        site_id: "site-b",
        worker_display_name: "Foreign Site Worker",
        language_code: "vi",
        read_at: "2026-07-17T00:00:00.000Z"
      }
    ],
    workpack_improvements: [
      {
        id: "improvement-match",
        ...tenant,
        task_label: "Tenant A Task",
        hazard_label: "fall",
        improvement_text: "Tenant A Improvement",
        reflected_documents: [],
        source_type: "manual",
        analysis_payload: {},
        created_at: "2026-07-17T00:00:00.000Z"
      },
      {
        id: "improvement-wrong-org",
        ...tenant,
        organization_id: "org-b",
        task_label: "Foreign Org Task",
        hazard_label: "fall",
        improvement_text: "Foreign Org Improvement",
        reflected_documents: [],
        source_type: "manual",
        analysis_payload: {},
        created_at: "2026-07-17T00:00:00.000Z"
      },
      {
        id: "improvement-wrong-site",
        ...tenant,
        site_id: "site-b",
        task_label: "Foreign Site Task",
        hazard_label: "fall",
        improvement_text: "Foreign Site Improvement",
        reflected_documents: [],
        source_type: "manual",
        analysis_payload: {},
        created_at: "2026-07-17T00:00:00.000Z"
      }
    ]
  };
}

function request(path: string): NextRequest {
  return new NextRequest(`http://localhost${path}`, {
    headers: { authorization: "Bearer test-token" }
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.loadOwnedWorkpackOperationContext.mockResolvedValue(ownedContext("site-a"));
});

describe("commercial workpack service-role tenant hardening", () => {
  it("loads recipients only from the authoritative organization and site", async () => {
    const fake = createFixtureClient(fixtureRows("site-a"));
    const store = await vi.importActual<typeof import("@/lib/workpack-commercial-store")>(
      "@/lib/workpack-commercial-store"
    );

    const matching = await store.loadServerShareRecipients(fake.client as never, {
      organizationId: "org-a",
      siteId: "site-a",
      requestedWorkerIds: ["11111111-1111-4111-8111-111111111111"]
    });
    const mismatched = await store.loadServerShareRecipients(fake.client as never, {
      organizationId: "org-a",
      siteId: "site-a",
      requestedWorkerIds: ["22222222-2222-4222-8222-222222222222"]
    });

    expect(matching.ok).toBe(true);
    expect(mismatched).toMatchObject({ ok: false });
  });

  it("rejects a mismatched active share session and accepts a nullable-site match", async () => {
    const store = await vi.importActual<typeof import("@/lib/workpack-commercial-store")>(
      "@/lib/workpack-commercial-store"
    );
    const siteFake = createFixtureClient(fixtureRows("site-a"));
    const mismatched = await store.loadActiveOwnedShareSession(siteFake.client as never, {
      organizationId: "org-a",
      siteId: "site-a",
      workpackId: "workpack-a",
      shareSessionId: "session-wrong-org",
      userId: "user-1"
    });
    const nullSiteFake = createFixtureClient(fixtureRows(null));
    const nullableMatch = await store.loadActiveOwnedShareSession(nullSiteFake.client as never, {
      organizationId: "org-a",
      siteId: null,
      workpackId: "workpack-a",
      shareSessionId: "session-match",
      userId: "user-1"
    });

    expect(mismatched).toMatchObject({ ok: false, status: 404 });
    expect(nullableMatch).toMatchObject({ ok: true });
    expect(nullSiteFake.calls).toContainEqual({
      table: "workpack_share_sessions",
      method: "is",
      column: "site_id",
      value: null
    });
  });

  it("loads an invited public share session with safe document previews and recipient language message", async () => {
    const store = await vi.importActual<typeof import("@/lib/workpack-commercial-store")>(
      "@/lib/workpack-commercial-store"
    );
    const fake = createFixtureClient(fixtureRows("site-a"));

    const result = await store.loadActivePublicShareSession(fake.client as never, {
      shareSessionId: "33333333-3333-4333-8333-333333333333",
      workerId: "11111111-1111-4111-8111-111111111111"
    });

    expect(result).toMatchObject({
      ok: true,
      session: {
        question: "Tenant A 작업팩",
        documents: [
          { key: "riskAssessmentDraft", title: "위험성평가표" },
          { key: "tbmBriefing", title: "TBM 브리핑" },
          { key: "tbmLogDraft", title: "TBM 기록" }
        ],
        recipientMessage: {
          languageCode: "ko",
          title: "한국어 전송본",
          body: "한국어 전송본"
        }
      }
    });
  });

  it("returns only full-tuple share sessions and confirmations", async () => {
    const fake = createFixtureClient(fixtureRows("site-a"));
    mocks.createSupabaseAdminClient.mockReturnValue(fake.client);
    const { GET } = await import("@/app/api/workpacks/[id]/share-sessions/route");

    const response = await GET(request("/api/workpacks/workpack-a/share-sessions"), {
      params: Promise.resolve({ id: "workpack-a" })
    });
    const body = await response.json() as {
      sessions: FixtureRow[];
      confirmations: FixtureRow[];
    };

    expect(body.sessions.map((row) => row.id)).toEqual([
      "session-match",
      "33333333-3333-4333-8333-333333333333"
    ]);
    expect(body.confirmations.map((row) => row.id)).toEqual(["confirmation-match"]);
  });

  it("returns only full-tuple confirmation rows", async () => {
    const fake = createFixtureClient(fixtureRows("site-a"));
    mocks.createSupabaseAdminClient.mockReturnValue(fake.client);
    const { GET } = await import("@/app/api/workpacks/[id]/read-confirmations/route");

    const response = await GET(request("/api/workpacks/workpack-a/read-confirmations"), {
      params: Promise.resolve({ id: "workpack-a" })
    });
    const body = await response.json() as { confirmations: FixtureRow[] };

    expect(body.confirmations.map((row) => row.id)).toEqual(["confirmation-match"]);
  });

  it("returns only full-tuple improvement rows", async () => {
    const fake = createFixtureClient(fixtureRows("site-a"));
    mocks.createSupabaseAdminClient.mockReturnValue(fake.client);
    const { GET } = await import("@/app/api/workpacks/[id]/improvements/route");

    const response = await GET(request("/api/workpacks/workpack-a/improvements"), {
      params: Promise.resolve({ id: "workpack-a" })
    });
    const body = await response.json() as { improvements: FixtureRow[] };

    expect(body.improvements.map((row) => row.id)).toEqual(["improvement-match"]);
  });

  it("exports only full-tuple improvement and confirmation memory", async () => {
    const fake = createFixtureClient(fixtureRows("site-a"));
    mocks.createSupabaseAdminClient.mockReturnValue(fake.client);
    const { GET } = await import("@/app/api/workpacks/[id]/learning-export/route");

    const response = await GET(request("/api/workpacks/workpack-a/learning-export"), {
      params: Promise.resolve({ id: "workpack-a" })
    });
    const body = await response.text();

    expect(response.headers.get("x-safeclaw-improvement-count")).toBe("1");
    expect(response.headers.get("x-safeclaw-confirmation-count")).toBe("1");
    expect(body).toContain("Tenant A Improvement");
    expect(body).not.toContain("Foreign Org Improvement");
    expect(body).not.toContain("Foreign Site Worker");
  });

  it("builds the operation graph from full-tuple child rows", async () => {
    const fake = createFixtureClient(fixtureRows("site-a"));
    mocks.createSupabaseAdminClient.mockReturnValue(fake.client);
    const { GET } = await import("@/app/api/workpacks/[id]/operation-graph/route");

    const response = await GET(request("/api/workpacks/workpack-a/operation-graph"), {
      params: Promise.resolve({ id: "workpack-a" })
    });
    const body = await response.json() as OperationGraphResponse;
    const improvementIds = body.graph.input.improvements.map((item) => item.id);
    const confirmationNames = body.graph.input.confirmations.map((item) => item.displayName);

    expect(improvementIds).toEqual(["improvement-match"]);
    expect(improvementIds).not.toContain("improvement-wrong-org");
    expect(improvementIds).not.toContain("improvement-wrong-site");
    expect(confirmationNames).toEqual(["Tenant A Worker"]);
    expect(confirmationNames).not.toContain("Foreign Org Worker");
    expect(confirmationNames).not.toContain("Foreign Site Worker");
  });

  it("uses IS NULL for nullable-site operation graph child rows", async () => {
    mocks.loadOwnedWorkpackOperationContext.mockResolvedValue(ownedContext(null));
    const fake = createFixtureClient(fixtureRows(null));
    mocks.createSupabaseAdminClient.mockReturnValue(fake.client);
    const { GET } = await import("@/app/api/workpacks/[id]/operation-graph/route");

    const response = await GET(request("/api/workpacks/workpack-a/operation-graph"), {
      params: Promise.resolve({ id: "workpack-a" })
    });
    const body = await response.json() as OperationGraphResponse;
    const improvementIds = body.graph.input.improvements.map((item) => item.id);
    const confirmationNames = body.graph.input.confirmations.map((item) => item.displayName);

    expect(improvementIds).toEqual(["improvement-match"]);
    expect(improvementIds).not.toContain("improvement-wrong-org");
    expect(improvementIds).not.toContain("improvement-wrong-site");
    expect(confirmationNames).toEqual(["Tenant A Worker"]);
    expect(confirmationNames).not.toContain("Foreign Org Worker");
    expect(confirmationNames).not.toContain("Foreign Site Worker");
    expect(fake.calls.filter((call) => call.method === "is")).toEqual([
      { table: "workpack_improvements", method: "is", column: "site_id", value: null },
      { table: "workpack_read_confirmations", method: "is", column: "site_id", value: null }
    ]);
  });
});
