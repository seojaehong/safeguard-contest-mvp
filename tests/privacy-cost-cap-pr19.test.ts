// PR-19 (2026-10-25 결정 19~24): 익명 template 제한·하루 AI 비용 상한·초대제·미리보기 전용·
// 공유 세션 연락처 보유기간·Upstash 장애 때 공유 열람·처리방침 페이지.
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { buildMockAskResponse } from "@/lib/mock-data";

const mocks = vi.hoisted(() => ({
  runAsk: vi.fn(),
  createSupabaseAdminClient: vi.fn(),
  getWorkspaceUser: vi.fn(),
  loadOwnedWorkpackOperationContext: vi.fn(),
}));

vi.mock("@/lib/search", () => ({ runAsk: mocks.runAsk }));

vi.mock("@/lib/supabase-admin", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/supabase-admin")>();
  return {
    ...actual,
    createSupabaseAdminClient: mocks.createSupabaseAdminClient,
    getWorkspaceUser: mocks.getWorkspaceUser,
  };
});

vi.mock("@/lib/workpack-commercial-store", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/workpack-commercial-store")>();
  return { ...actual, loadOwnedWorkpackOperationContext: mocks.loadOwnedWorkpackOperationContext };
});

const USER = { id: "11111111-1111-4111-8111-111111111111", email: "admin@example.com" };
const WORKPACK_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const SESSION_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const ORG_ID = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";

let ipCounter = 10;
function askRequest(path: string, body: Record<string, unknown>, options: { token?: string } = {}): NextRequest {
  ipCounter += 1;
  const headers: Record<string, string> = {
    "content-type": "application/json",
    "x-forwarded-for": `198.51.100.${ipCounter}`,
  };
  if (options.token) headers.authorization = `Bearer ${options.token}`;
  return new NextRequest(`http://localhost${path}`, { method: "POST", headers, body: JSON.stringify(body) });
}

async function readSseFinal(response: Response): Promise<Record<string, unknown>> {
  const text = await response.text();
  const frames = text.split("\n\n").map((frame) => frame.replace(/^data: /mu, "").trim()).filter(Boolean);
  for (const frame of frames.reverse()) {
    try {
      const parsed = JSON.parse(frame) as { kind?: string; payload?: Record<string, unknown> };
      if (parsed.kind === "final" && parsed.payload) return parsed.payload;
    } catch {
      // ignore non-JSON frames
    }
  }
  throw new Error("final SSE frame not found");
}

beforeEach(async () => {
  vi.stubEnv("UPSTASH_REDIS_REST_URL", "");
  vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "");
  vi.stubEnv("KV_REST_API_URL", "");
  vi.stubEnv("KV_REST_API_TOKEN", "");
  vi.stubEnv("VERCEL_ENV", "");
  vi.stubEnv("AI_MODE_DEFAULT", "");
  vi.stubEnv("SAFECLAW_AI_DAILY_WORK_UNITS", "");
  mocks.runAsk.mockImplementation(async (question: string, options: { aiMode?: string }) => ({
    ...buildMockAskResponse(question, [], "mock", "test"),
    generationMode: options.aiMode,
  }));
  mocks.createSupabaseAdminClient.mockReturnValue({});
  mocks.getWorkspaceUser.mockImplementation(async (_client: unknown, headers: Headers) =>
    headers.get("authorization") === "Bearer valid-admin-token" ? USER : null);
  const { resetAiDailyCostCapInstanceForTests } = await import("@/lib/ai-daily-cost-cap");
  resetAiDailyCostCapInstanceForTests();
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("결정 21 — 익명은 template 만", () => {
  it("anonymous aiMode=full on /api/ask is downgraded to template and flagged", async () => {
    const { POST } = await import("@/app/api/ask/route");
    const response = await POST(askRequest("/api/ask", { question: "외벽 도장 작업", aiMode: "full" }));
    expect(response.status).toBe(200);
    expect(response.headers.get("X-SafeClaw-AI-Mode")).toBe("template");
    expect(response.headers.get("X-SafeClaw-AI-Mode-Downgraded")).toBe("anonymous");
    const body = await response.json() as { aiModeNotice?: { reason: string; requestedMode: string; appliedMode: string } };
    expect(body.aiModeNotice).toMatchObject({ reason: "anonymous", requestedMode: "full", appliedMode: "template" });
    expect(mocks.runAsk).toHaveBeenCalledWith("외벽 도장 작업", expect.objectContaining({ aiMode: "template" }));
  });

  it("anonymous request without aiMode ignores AI_MODE_DEFAULT=enhanced", async () => {
    vi.stubEnv("AI_MODE_DEFAULT", "enhanced");
    const { POST } = await import("@/app/api/ask/route");
    const response = await POST(askRequest("/api/ask", { question: "밀폐공간 점검" }));
    expect(response.headers.get("X-SafeClaw-AI-Mode")).toBe("template");
    expect(mocks.runAsk).toHaveBeenCalledWith("밀폐공간 점검", expect.objectContaining({ aiMode: "template" }));
  });

  it("anonymous aiMode=enhanced on the SSE route is downgraded too", async () => {
    const { POST } = await import("@/app/api/ask/stream/route");
    const response = await POST(askRequest("/api/ask/stream", { question: "굴착 작업", aiMode: "enhanced" }));
    expect(response.headers.get("X-SafeClaw-AI-Mode")).toBe("template");
    expect(response.headers.get("X-SafeClaw-AI-Mode-Downgraded")).toBe("anonymous");
    const payload = await readSseFinal(response);
    expect(payload.aiModeNotice).toMatchObject({ reason: "anonymous" });
  });

  it("an invalid bearer token is treated as anonymous", async () => {
    const { POST } = await import("@/app/api/ask/route");
    const response = await POST(askRequest("/api/ask", { question: "외벽 도장 작업", aiMode: "full" }, { token: "forged" }));
    expect(response.headers.get("X-SafeClaw-AI-Mode")).toBe("template");
  });

  it("a signed-in admin keeps the requested full mode", async () => {
    const { POST } = await import("@/app/api/ask/route");
    const response = await POST(askRequest("/api/ask", { question: "외벽 도장 작업", aiMode: "full" }, { token: "valid-admin-token" }));
    expect(response.status).toBe(200);
    expect(response.headers.get("X-SafeClaw-AI-Mode")).toBe("full");
    expect(response.headers.get("X-SafeClaw-AI-Mode-Downgraded")).toBeNull();
    const body = await response.json() as { aiModeNotice?: unknown };
    expect(body.aiModeNotice).toBeUndefined();
  });
});

describe("결정 21 — 로그인 사용자 하루 AI 비용 상한", () => {
  it("defaults to 600 work units (full 50 / enhanced 300) and reads the env override", async () => {
    const { resolveAiDailyWorkUnitCap, AI_DAILY_WORK_UNITS_DEFAULT } = await import("@/lib/ai-daily-cost-cap");
    const { PUBLIC_ASK_PROVIDER_ADMISSION_POLICY } = await import("@/lib/public-ask-admission");
    expect(AI_DAILY_WORK_UNITS_DEFAULT).toBe(600);
    expect(AI_DAILY_WORK_UNITS_DEFAULT / PUBLIC_ASK_PROVIDER_ADMISSION_POLICY.weights.full).toBe(50);
    expect(AI_DAILY_WORK_UNITS_DEFAULT / PUBLIC_ASK_PROVIDER_ADMISSION_POLICY.weights.enhanced).toBe(300);
    expect(resolveAiDailyWorkUnitCap({ SAFECLAW_AI_DAILY_WORK_UNITS: "120" })).toBe(120);
    expect(resolveAiDailyWorkUnitCap({ SAFECLAW_AI_DAILY_WORK_UNITS: "abc" })).toBe(600);
  });

  it("downgrades a signed-in full request to template once the site-wide cap is spent", async () => {
    vi.stubEnv("SAFECLAW_AI_DAILY_WORK_UNITS", "12");
    const { POST } = await import("@/app/api/ask/route");
    const first = await POST(askRequest("/api/ask", { question: "첫 작업", aiMode: "full" }, { token: "valid-admin-token" }));
    expect(first.headers.get("X-SafeClaw-AI-Mode")).toBe("full");

    const second = await POST(askRequest("/api/ask", { question: "둘째 작업", aiMode: "full" }, { token: "valid-admin-token" }));
    expect(second.status).toBe(200);
    expect(second.headers.get("X-SafeClaw-AI-Mode")).toBe("template");
    expect(second.headers.get("X-SafeClaw-AI-Mode-Downgraded")).toBe("daily_cost_cap");
    const body = await second.json() as { aiModeNotice?: { reason: string } };
    expect(body.aiModeNotice?.reason).toBe("daily_cost_cap");
    expect(mocks.runAsk).toHaveBeenLastCalledWith("둘째 작업", expect.objectContaining({ aiMode: "template" }));
  });

  it("counts by weight in one atomic INCRBY and keys by KST date, not by IP", async () => {
    const commands: unknown[][] = [];
    const fetchImpl = vi.fn(async (_input: string | URL | Request, init?: RequestInit) => {
      commands.push(JSON.parse(String(init?.body)) as unknown[]);
      return Response.json({ result: [12, 3_600_000] });
    });
    const { checkAiDailyCostCap, kstDateKey } = await import("@/lib/ai-daily-cost-cap");
    const decision = await checkAiDailyCostCap({
      request: new Request("https://www.safeclaw.kr/api/ask", { headers: { "x-forwarded-for": "203.0.113.5" } }),
      aiMode: "full",
      environment: { UPSTASH_REDIS_REST_URL: "https://example.upstash.io", UPSTASH_REDIS_REST_TOKEN: "t" },
      fetchImpl,
      now: new Date("2026-10-25T15:30:00Z"),
    });
    expect(decision.allowed).toBe(true);
    expect(String(commands[0][1])).toContain("INCRBY");
    // 가중치가 1보다 커도 새 키에 만료가 걸려야 한다(첫 값 == 가중치).
    expect(String(commands[0][1])).toContain("if count == tonumber(ARGV[2] or '1') then redis.call('PEXPIRE'");
    expect(commands[0][5]).toBe("12");
    expect(String(commands[0][3])).toMatch(/^safeclaw:public-rate:ai-daily-cost:[a-f0-9]{32}$/u);
    expect(kstDateKey(new Date("2026-10-25T15:30:00Z"))).toBe("2026-10-26");
  });

  it("fails closed on cost (template) when the distributed counter is unavailable", async () => {
    const { checkAiDailyCostCap } = await import("@/lib/ai-daily-cost-cap");
    const decision = await checkAiDailyCostCap({
      request: new Request("https://www.safeclaw.kr/api/ask"),
      aiMode: "enhanced",
      environment: { UPSTASH_REDIS_REST_URL: "https://example.upstash.io", UPSTASH_REDIS_REST_TOKEN: "t" },
      fetchImpl: vi.fn(async () => { throw new Error("upstash down"); }),
    });
    expect(decision.allowed).toBe(false);
  });
});

describe("결정 19 — 공유 세션 연락처 정리", () => {
  type UpdateCall = { values: Record<string, unknown>; filters: Array<[string, unknown]> };

  function shareSessionClient(snapshot: unknown) {
    const updates: UpdateCall[] = [];
    const client = {
      from(table: string) {
        expect(table).toBe("workpack_share_sessions");
        return {
          update(values: Record<string, unknown>) {
            const call: UpdateCall = { values, filters: [] };
            updates.push(call);
            const chain = {
              eq(column: string, value: unknown) { call.filters.push([column, value]); return chain; },
              is(column: string, value: unknown) { call.filters.push([column, value]); return chain; },
              select() { return chain; },
              async maybeSingle() {
                return { data: { id: SESSION_ID, status: "revoked", updated_at: "2026-10-25T00:00:00Z", recipients_snapshot: snapshot }, error: null };
              },
              then(resolve: (value: { error: null }) => void) { resolve({ error: null }); },
            };
            return chain;
          },
        };
      },
    };
    return { client, updates };
  }

  const snapshotWithContacts = [
    { workerId: "w1", displayName: "김작업", workerSnapshot: { workerId: "w1", displayName: "김작업", phone: "010-1234-5678", email: "kim@example.com", nationality: "KR" } },
    { workerId: "w2", displayName: "Nguyen", workerSnapshot: { workerId: "w2", displayName: "Nguyen", phone: "010-9999-0000", email: null } },
  ];

  it("DELETE share session revokes it and leaves 0 contacts in the stored snapshot", async () => {
    const { client, updates } = shareSessionClient(snapshotWithContacts);
    mocks.createSupabaseAdminClient.mockReturnValue(client);
    mocks.getWorkspaceUser.mockResolvedValue(USER);
    mocks.loadOwnedWorkpackOperationContext.mockResolvedValue({
      ok: true,
      context: { workpackId: WORKPACK_ID, organizationId: ORG_ID, siteId: null },
    });
    const { DELETE } = await import("@/app/api/workpacks/[id]/share-sessions/route");
    const response = await DELETE(
      new NextRequest(`http://localhost/api/workpacks/${WORKPACK_ID}/share-sessions?sessionId=${SESSION_ID}`, {
        method: "DELETE",
        headers: { authorization: "Bearer valid-admin-token" },
      }),
      { params: Promise.resolve({ id: WORKPACK_ID }) },
    );
    expect(response.status).toBe(200);
    const body = await response.json() as { contactsCleared: boolean; revokedSessionId: string };
    expect(body).toMatchObject({ contactsCleared: true, revokedSessionId: SESSION_ID });

    const { countRecipientSnapshotContacts } = await import("@/lib/workpack-commercial");
    const scrub = updates.find((call) => "recipients_snapshot" in call.values);
    expect(scrub, "a snapshot scrub update was issued").toBeDefined();
    expect(countRecipientSnapshotContacts(scrub?.values.recipients_snapshot)).toBe(0);
    expect(countRecipientSnapshotContacts(snapshotWithContacts)).toBe(3);
    const scrubbed = scrub?.values.recipients_snapshot as Array<{ workerSnapshot: Record<string, unknown> }>;
    expect(scrubbed[0].workerSnapshot).toMatchObject({ workerId: "w1", displayName: "김작업", nationality: "KR" });
    expect(scrubbed[0].workerSnapshot).not.toHaveProperty("phone");
    expect(scrub?.filters).toEqual(expect.arrayContaining([["id", SESSION_ID], ["organization_id", ORG_ID]]));
  });

  it("the daily retention sweep scrubs sessions expired more than 30 days ago", async () => {
    const now = new Date("2026-10-25T00:00:00Z");
    const selects: Array<Array<[string, unknown]>> = [];
    const updates: Array<{ values: Record<string, unknown>; id: unknown }> = [];
    const rows = [{ id: SESSION_ID, recipients_snapshot: snapshotWithContacts }];
    const confirmationRows = [{ id: "rc-1", worker_snapshot: snapshotWithContacts[0].workerSnapshot }];
    const client = {
      from() {
        return {
          select() {
            const filters: Array<[string, unknown]> = [];
            selects.push(filters);
            const chain = {
              lt(column: string, value: unknown) { filters.push([`lt:${column}`, value]); return chain; },
              in(column: string, value: unknown) { filters.push([`in:${column}`, value]); return chain; },
              order() { return chain; },
              limit() {
                const isConfirmation = filters.some(([key]) => key === "lt:read_at");
                return Promise.resolve({ data: isConfirmation ? confirmationRows : rows, error: null });
              },
            };
            return chain;
          },
          update(values: Record<string, unknown>) {
            return { eq: async (_column: string, id: unknown) => { updates.push({ values, id }); return { error: null }; } };
          },
        };
      },
    };
    const { purgeExpiredShareSessionContacts } = await import("@/lib/share-contact-retention");
    const result = await purgeExpiredShareSessionContacts(client as never, { now });
    expect(result).toMatchObject({ ok: true, cleared: 1, confirmationsCleared: 1, cutoff: "2026-09-25T00:00:00.000Z" });
    expect(selects[2]).toContainEqual(["lt:read_at", "2026-09-25T00:00:00.000Z"]);
    expect(selects[0]).toContainEqual(["lt:expires_at", "2026-09-25T00:00:00.000Z"]);
    expect(selects[1]).toContainEqual(["in:status", ["revoked", "expired"]]);
    const { countRecipientSnapshotContacts } = await import("@/lib/workpack-commercial");
    expect(updates).toHaveLength(2);
    expect(countRecipientSnapshotContacts(updates[0].values.recipients_snapshot)).toBe(0);
    expect(updates[1].values.worker_snapshot).not.toHaveProperty("phone");
    expect(updates[1].values.worker_snapshot).not.toHaveProperty("email");
  });

  it("the retention cron requires CRON_SECRET", async () => {
    vi.stubEnv("CRON_SECRET", "cron-secret");
    const { GET } = await import("@/app/api/share-sessions/contact-retention/route");
    const denied = await GET(new NextRequest("http://localhost/api/share-sessions/contact-retention"));
    expect(denied.status).toBe(401);
  });

  it("read confirmations never store worker contacts", async () => {
    const { buildReadConfirmationDraft } = await import("@/lib/workpack-commercial");
    const draft = buildReadConfirmationDraft({
      organizationId: ORG_ID,
      siteId: null,
      workpackId: WORKPACK_ID,
      displayName: "김작업",
      workerSnapshot: snapshotWithContacts[0].workerSnapshot,
    });
    expect(draft.ok).toBe(true);
    if (!draft.ok) return;
    expect(draft.insert.worker_snapshot).not.toHaveProperty("phone");
    expect(draft.insert.worker_snapshot).not.toHaveProperty("email");
    expect(draft.insert.worker_snapshot).toMatchObject({ displayName: "김작업", nationality: "KR" });
  });
});

describe("결정 20 — 관리자 초대·승인제", () => {
  function organizationClient(existingOrganizationId: string | null) {
    const inserted: string[] = [];
    const client = {
      from(table: string) {
        const chain = {
          select() { return chain; },
          eq() { return chain; },
          order() { return chain; },
          limit() { return chain; },
          async maybeSingle() {
            if (table === "organizations") return { data: existingOrganizationId ? { id: existingOrganizationId } : null, error: null };
            return { data: { id: "site-1" }, error: null };
          },
          insert() {
            inserted.push(table);
            return { select: () => ({ single: async () => ({ data: { id: `${table}-new` }, error: null }) }) };
          },
        };
        return chain;
      },
    };
    return { client, inserted };
  }

  it("rejects workspace creation for a signed-in account that is not invited", async () => {
    const { ensureWorkspaceContext } = await import("@/lib/supabase-admin");
    const { WorkspaceInviteRequiredError } = await import("@/lib/admin-invite");
    const { client, inserted } = organizationClient(null);
    await expect(ensureWorkspaceContext(client as never, { id: "u-new", email: "stranger@example.com" }, {}))
      .rejects.toBeInstanceOf(WorkspaceInviteRequiredError);
    expect(inserted).toEqual([]);
  });

  it("lets an invited email create its workspace and keeps existing owners working", async () => {
    vi.stubEnv("SAFECLAW_ADMIN_INVITED_EMAILS", "Owner@Example.com, other@example.com");
    const { ensureWorkspaceContext } = await import("@/lib/supabase-admin");
    const invited = organizationClient(null);
    await expect(ensureWorkspaceContext(invited.client as never, { id: "u-1", email: "owner@example.com" }, {}))
      .resolves.toMatchObject({ organizationId: "organizations-new" });

    vi.stubEnv("SAFECLAW_ADMIN_INVITED_EMAILS", "");
    const existing = organizationClient("org-existing");
    await expect(ensureWorkspaceContext(existing.client as never, { id: "u-2", email: "legacy@example.com" }, {}))
      .resolves.toMatchObject({ organizationId: "org-existing" });
    expect(existing.inserted).toEqual([]);
  });

  it("the briefing settings endpoint answers 403 for a non-invited new account", async () => {
    const { client } = organizationClient(null);
    mocks.createSupabaseAdminClient.mockReturnValue(client);
    mocks.getWorkspaceUser.mockResolvedValue({ id: "u-new", email: "stranger@example.com" });
    const { POST } = await import("@/app/api/briefing/settings/route");
    const response = await POST(new NextRequest("http://localhost/api/briefing/settings", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: "Bearer x" },
      body: JSON.stringify({ enabled: true, question: "외벽 도장", email: "a@example.com" }),
    }));
    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({ code: "WORKSPACE_INVITE_REQUIRED" });
  });

  it("the email login no longer creates new Supabase users", async () => {
    const { readFileSync } = await import("node:fs");
    const panel = readFileSync("components/AdminLoginPanel.tsx", "utf8");
    const field = readFileSync("components/FieldOperationsWorkspace.tsx", "utf8");
    expect(panel).toContain("shouldCreateUser: false");
    expect(panel).not.toContain("shouldCreateUser: true");
    expect(field).toContain("shouldCreateUser: false");
  });
});

describe("SEC-05 — 브리핑 자리 상한", () => {
  it("refuses to enable a briefing when the site-wide cap is already full", async () => {
    const { MAX_BRIEFING_SITES } = await import("@/lib/briefing");
    const updates: unknown[] = [];
    const client = {
      from(table: string) {
        const state: { head?: boolean } = {};
        const chain = {
          select(_columns: string, options?: { head?: boolean }) { state.head = options?.head; return chain; },
          eq() { return state.head ? Promise.resolve({ count: MAX_BRIEFING_SITES, error: null }) : chain; },
          order() { return chain; },
          limit() { return chain; },
          async maybeSingle() {
            if (table === "organizations") return { data: { id: "org-1" }, error: null };
            return { data: { id: "site-1", briefing_enabled: false }, error: null };
          },
          update(values: unknown) { updates.push(values); return { eq: async () => ({ error: null }) }; },
        };
        return chain;
      },
    };
    mocks.createSupabaseAdminClient.mockReturnValue(client);
    mocks.getWorkspaceUser.mockResolvedValue(USER);
    const { POST } = await import("@/app/api/briefing/settings/route");
    const response = await POST(new NextRequest("http://localhost/api/briefing/settings", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: "Bearer x" },
      body: JSON.stringify({ enabled: true, question: "외벽 도장", email: "a@example.com" }),
    }));
    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({ code: "BRIEFING_SITE_CAP_REACHED" });
    expect(updates).toEqual([]);
  });
});

describe("결정 22 — 메일·문자 실발송은 기본 꺼짐(미리보기 전용)", () => {
  it("the live dispatch flag is off unless SAFEGUARD_RUN_LIVE_DISPATCH is exactly 1", async () => {
    const { isLiveDispatchEnabled } = await import("@/lib/n8n-webhook");
    vi.stubEnv("SAFEGUARD_RUN_LIVE_DISPATCH", "");
    expect(isLiveDispatchEnabled()).toBe(false);
    vi.stubEnv("SAFEGUARD_RUN_LIVE_DISPATCH", "true");
    expect(isLiveDispatchEnabled()).toBe(false);
  });

  it("the dispatch capability is preview_only by default even with a configured relay", async () => {
    vi.stubEnv("SAFEGUARD_RUN_LIVE_DISPATCH", "");
    vi.stubEnv("N8N_WEBHOOK_URL", "https://n8n.example.com/webhook/x");
    vi.stubEnv("N8N_WEBHOOK_TOKEN", "token");
    const { GET } = await import("@/app/api/workflow/dispatch/route");
    const body = await (await GET()).json() as { providerDispatch: { mode: string; capability: boolean } };
    expect(body.providerDispatch).toMatchObject({ mode: "preview_only", capability: false });

    const { resolveBriefingEmailDispatchStatus } = await import("@/lib/server/briefing-dispatch-status");
    expect(resolveBriefingEmailDispatchStatus()).toMatchObject({ emailReady: false, mode: "preview_only" });
  });

  it("even with the flag on, the provider path stays blocked until idempotent storage exists", async () => {
    const { resolveProviderDispatchCapability, PROVIDER_DISPATCH_IDEMPOTENCY_SUPPORTED } = await import("@/lib/server/workflow-dispatch-capability-policy");
    expect(PROVIDER_DISPATCH_IDEMPOTENCY_SUPPORTED).toBe(false);
    const ready = { providerConfigured: true, contactReadiness: "ready" as const };
    expect(resolveProviderDispatchCapability({
      persistentIdempotencySupported: PROVIDER_DISPATCH_IDEMPOTENCY_SUPPORTED,
      liveDispatchEnabled: true,
      channels: { email: ready, sms: ready, kakao: ready },
    })).toMatchObject({ mode: "preview_only", capability: false });
  });
});

describe("결정 24 — Upstash 장애 때 공유 링크 열람", () => {
  it("admits on the instance limiter and logs the outage when opted in", async () => {
    const errors = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const { checkPublicRateLimit } = await import("@/lib/public-distributed-rate-limit");
    const { createRateLimiter } = await import("@/lib/rate-limit");
    const decision = await checkPublicRateLimit({
      request: new Request("https://www.safeclaw.kr/share/x"),
      namespace: "share-session-read",
      limit: 60,
      windowMs: 60_000,
      instanceLimiter: createRateLimiter({ limit: 60, windowMs: 60_000 }),
      environment: { UPSTASH_REDIS_REST_URL: "https://example.upstash.io", UPSTASH_REDIS_REST_TOKEN: "t" },
      fetchImpl: vi.fn(async () => { throw new Error("upstash down"); }),
      requireDistributedInProduction: true,
      instanceFallbackOnOutage: true,
    });
    expect(decision).toMatchObject({ allowed: true, mode: "instance", reason: "distributed_outage_instance_fallback" });
    expect(errors.mock.calls.some((call) => String(call[0]).includes("instance fallback admitted"))).toBe(true);
    errors.mockRestore();
  });

  it("keeps other callers fail-closed (503) during the same outage", async () => {
    const errors = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const { checkPublicRateLimit, publicRateLimitResponse } = await import("@/lib/public-distributed-rate-limit");
    const { createRateLimiter } = await import("@/lib/rate-limit");
    const decision = await checkPublicRateLimit({
      request: new Request("https://www.safeclaw.kr/api/ask"),
      namespace: "public-ask-provider",
      limit: 10,
      windowMs: 60_000,
      instanceLimiter: createRateLimiter({ limit: 10, windowMs: 60_000 }),
      environment: { UPSTASH_REDIS_REST_URL: "https://example.upstash.io", UPSTASH_REDIS_REST_TOKEN: "t" },
      fetchImpl: vi.fn(async () => { throw new Error("upstash down"); }),
    });
    expect(publicRateLimitResponse(decision)?.status).toBe(503);
    errors.mockRestore();
  });

  it("the public share read route no longer returns 503 when Upstash calls fail", async () => {
    const errors = vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "https://example.upstash.io");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "t");
    vi.stubEnv("VERCEL_ENV", "production");
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("upstash down"); }));
    mocks.createSupabaseAdminClient.mockReturnValue(null);
    const { GET } = await import("@/app/api/share-sessions/[sessionId]/route");
    const response = await GET(
      new NextRequest(`http://localhost/api/share-sessions/${SESSION_ID}?workerId=w1`),
      { params: Promise.resolve({ sessionId: SESSION_ID }) },
    );
    expect(response.status).not.toBe(503);
    expect(response.headers.get("X-SafeClaw-Rate-Limit")).not.toBe("distributed");
    await expect(response.json()).resolves.toMatchObject({ configured: false });
    errors.mockRestore();
  });
});

describe("SEC-04 — /privacy 처리방침", () => {
  it("ships an app/privacy page (so /privacy is 200, not 404) with the processor role and retention", async () => {
    // vitest 는 TSX 를 변환하지 않으므로 원문으로 확인한다. 실제 200 응답은 next dev 로 따로 확인했다(PR 본문).
    const { readFileSync } = await import("node:fs");
    const html = readFileSync("app/privacy/page.tsx", "utf8");
    expect(html).toContain("export default function PrivacyPage()");
    expect(html).toContain("개인정보 처리방침 | SafeClaw");
    expect(html).toContain("수탁자");
    expect(html).toContain("만료 뒤 30일");
    expect(html).toContain("미리보기 전용");
    expect(html).toContain("아직 확인하지 못한 사항");
  });

  it("is listed in the sitemap and in the route contract", async () => {
    const sitemap = (await import("@/app/sitemap")).default();
    expect(sitemap.some((entry) => entry.url.endsWith("/privacy"))).toBe(true);
    const { standaloneToolRoutes, userVisibleRoutes } = await import("@/lib/frontend-design-contract");
    expect([...standaloneToolRoutes, ...userVisibleRoutes]).toContain("/privacy");
  });
});

describe("결정 23 — bot_chat_sessions 의존 여부", () => {
  it("SafeClaw runtime code never reads or writes bot_chat_sessions", async () => {
    const { readdirSync, readFileSync, statSync } = await import("node:fs");
    const { join } = await import("node:path");
    const hits: string[] = [];
    const walk = (dir: string) => {
      for (const name of readdirSync(dir)) {
        const full = join(dir, name);
        if (statSync(full).isDirectory()) walk(full);
        else if (/\.(ts|tsx|mjs|sql)$/u.test(name) && readFileSync(full, "utf8").includes("bot_chat_sessions")) hits.push(full);
      }
    };
    for (const dir of ["app", "lib", "components", "supabase"]) walk(dir);
    expect(hits).toEqual([]);
  });
});
