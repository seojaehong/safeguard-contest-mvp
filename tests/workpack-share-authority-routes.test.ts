import { EventEmitter } from "node:events";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { evaluateShareSessionReuse } from "@/components/WorkflowSharePolicy";
import type { AskResponse } from "@/lib/types";
import {
  PUBLIC_SHARE_ACK_REQUEST_MAX_BYTES,
  WORKFLOW_DISPATCH_REQUEST_MAX_BYTES
} from "@/lib/public-work-budget";
import { buildReadConfirmationId } from "@/lib/read-confirmation-idempotency";
import {
  buildCanonicalRecipientMessageVariants,
  buildLocalizedDispatchRecipients,
  buildLocalizedDispatchWebhookPayload
} from "@/lib/workflow-share-client";

const mocks = vi.hoisted(() => ({
  createSupabaseAdminClient: vi.fn(),
  getWorkspaceUser: vi.fn(),
  loadOwnedWorkpackOperationContext: vi.fn(),
  loadServerShareRecipients: vi.fn(),
  loadActiveOwnedShareSession: vi.fn(),
  loadActivePublicShareSession: vi.fn(),
  postWebhookWithTimeout: vi.fn(),
  resolveWebhookConfig: vi.fn(),
  isLiveDispatchEnabled: vi.fn()
}));

vi.mock("@/lib/supabase-admin", () => ({
  createSupabaseAdminClient: mocks.createSupabaseAdminClient,
  getWorkspaceUser: mocks.getWorkspaceUser,
  toJson: (value: unknown) => value
}));

vi.mock("@/lib/workpack-commercial-store", () => ({
  loadOwnedWorkpackOperationContext: mocks.loadOwnedWorkpackOperationContext,
  loadServerShareRecipients: mocks.loadServerShareRecipients,
  loadActiveOwnedShareSession: mocks.loadActiveOwnedShareSession,
  loadActivePublicShareSession: mocks.loadActivePublicShareSession
}));

vi.mock("@/lib/n8n-webhook", () => ({
  postWebhookWithTimeout: mocks.postWebhookWithTimeout,
  resolveWebhookConfig: mocks.resolveWebhookConfig,
  isLiveDispatchEnabled: mocks.isLiveDispatchEnabled
}));

vi.mock("@/lib/api-guard", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api-guard")>();
  return {
    ...actual,
    enforceRateLimit: () => null
  };
});

const WORKPACK_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const SESSION_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const WORKER_ID = "11111111-1111-4111-8111-111111111111";
const KOREAN_WORKER_ID = "22222222-2222-4222-8222-222222222222";
const RECIPIENT_VERIFICATION = "01011112222";
const KO_MESSAGE = "[SafeClaw]\n작업 전 안전수칙을 확인해 주세요.";
const VI_MESSAGE = "[SafeClaw]\nTiếng Việt\n\n- Dừng công việc khi gió mạnh.";

const serverRecipient = {
  workerId: WORKER_ID,
  displayName: "Server Nguyen",
  languageCode: "vi",
  role: "viewer" as const,
  workerSnapshot: {
    workerId: WORKER_ID,
    displayName: "Server Nguyen",
    workerRole: "도장공",
    languageCode: "vi",
    languageLabel: "베트남어",
    phone: "010-1111-2222",
    email: "server@example.com"
  }
};

const koreanRecipient = {
  workerId: KOREAN_WORKER_ID,
  displayName: "Server Kim",
  languageCode: "ko",
  role: "viewer" as const,
  workerSnapshot: {
    workerId: KOREAN_WORKER_ID,
    displayName: "Server Kim",
    workerRole: "배관공",
    languageCode: "ko",
    languageLabel: "한국어",
    phone: "010-3333-4444",
    email: "kim@example.com"
  }
};

const serverWorkpack = {
  question: "server workpack",
  answer: "server answer",
  practicalPoints: [],
  citations: [],
  mode: "live",
  scenario: {},
  externalData: {},
  riskSummary: {},
  deliverables: {
    kakaoMessage: KO_MESSAGE,
    foreignWorkerLanguages: [{
      code: "vi",
      label: "베트남어",
      nativeLabel: "Tiếng Việt",
      rationale: "test",
      lines: ["Dừng công việc khi gió mạnh."]
    }]
  },
  status: {}
};

function jsonRequest(path: string, body: unknown) {
  return new NextRequest(`http://localhost${path}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: "Bearer test-token"
    },
    body: JSON.stringify(body)
  });
}

function getRequest(path: string) {
  return new NextRequest(`http://localhost${path}`, {
    method: "GET"
  });
}

function ownedContext() {
  return {
    ok: true,
    context: {
      organizationId: "org-1",
      siteId: "site-1",
      workpackId: WORKPACK_ID,
      question: "server workpack",
      generatedAt: "2026-07-10T00:00:00.000Z",
      shareAuthority: {
        workpack: serverWorkpack,
        readiness: { canShare: true, status: "ready", summary: "공유 준비됨", reasons: [] }
      }
    }
  };
}

function activeSession() {
  return {
    ok: true,
    session: {
      id: SESSION_ID,
      workpackId: WORKPACK_ID,
      recipients: [serverRecipient],
      expiresAt: "2099-01-01T00:00:00.000Z"
    }
  };
}

function publicSession() {
  return {
    ok: true,
    session: {
      id: SESSION_ID,
      organizationId: "org-1",
      siteId: "site-1",
      workpackId: WORKPACK_ID,
      shareScope: "invited",
      question: "부산 해운대 천장 누수 보수",
      recipients: [serverRecipient, koreanRecipient],
      accessPolicy: {
        anonymousAllowed: false,
        manualLanguageSwitchAllowed: true,
        requireKnownWorkerSnapshot: true
      },
      documents: [
        {
          key: "riskAssessmentDraft" as const,
          title: "위험성평가표",
          body: "추락 위험을 확인합니다."
        },
        {
          key: "tbmBriefing" as const,
          title: "TBM 브리핑",
          body: "강풍 시 작업을 중지합니다."
        }
      ],
      recipientMessage: {
        languageCode: "vi",
        title: "Tiếng Việt 안내",
        body: "Dừng công việc khi gió mạnh."
      },
      status: "active",
      expiresAt: "2099-01-01T00:00:00.000Z"
    }
  };
}

function makeShareInsertClient() {
  let inserted: unknown = null;
  return {
    client: {
      from(table: string) {
        if (table !== "workpack_share_sessions") throw new Error(`Unexpected table ${table}`);
        return {
          insert(value: unknown) {
            inserted = value;
            return {
              select() {
                return { single: async () => ({ data: { id: SESSION_ID }, error: null }) };
              }
            };
          }
        };
      }
    },
    inserted: () => inserted
  };
}

function makeConfirmationClient(existingId: string | null) {
  let insertCount = 0;
  let inserted: unknown = null;
  const query = {
    select() { return query; },
    eq() { return query; },
    maybeSingle: async () => ({ data: existingId ? { id: existingId } : null, error: null }),
    insert(value: unknown) {
      insertCount += 1;
      inserted = value;
      return {
        select() {
          return { single: async () => ({ data: { id: "confirmation-new" }, error: null }) };
        }
      };
    }
  };
  return {
    client: { from: () => query },
    insertCount: () => insertCount,
    inserted: () => inserted
  };
}

function makeShareRevokeClient(options: { data?: Record<string, unknown> | null; error?: Record<string, unknown> | null } = {}) {
  const filters: Array<[string, unknown]> = [];
  let updated: unknown = null;
  const query = {
    update(value: unknown) {
      updated = value;
      return query;
    },
    eq(field: string, value: unknown) {
      filters.push([field, value]);
      return query;
    },
    is(field: string, value: unknown) {
      filters.push([field, value]);
      return query;
    },
    select() { return query; },
    maybeSingle: async () => ({
      data: options.data === undefined
        ? { id: SESSION_ID, status: "revoked", updated_at: "2026-08-14T01:00:00.000Z" }
        : options.data,
      error: options.error || null
    })
  };
  return {
    client: {
      from(table: string) {
        if (table !== "workpack_share_sessions") throw new Error(`Unexpected table ${table}`);
        return query;
      }
    },
    filters: () => filters,
    updated: () => updated
  };
}

function makeConfirmationRaceClient(concurrentRow: Record<string, unknown>) {
  let maybeSingleCount = 0;
  let insertCount = 0;
  let inserted: unknown = null;
  const query = {
    select() { return query; },
    eq() { return query; },
    is() { return query; },
    maybeSingle: async () => {
      maybeSingleCount += 1;
      return { data: maybeSingleCount === 1 ? null : concurrentRow, error: null };
    },
    insert(value: unknown) {
      insertCount += 1;
      inserted = value;
      return {
        select() {
          return {
            single: async () => ({
              data: null,
              error: { code: "23505", message: "duplicate primary key" }
            })
          };
        }
      };
    }
  };
  return {
    client: { from: () => query },
    insertCount: () => insertCount,
    inserted: () => inserted
  };
}

type RouteLoopShareSessionRow = {
  id: string;
  organization_id: string;
  site_id: string | null;
  workpack_id: string;
  share_scope: string;
  recipients_snapshot: typeof serverRecipient[];
  access_policy: {
    anonymousAllowed?: boolean;
    manualLanguageSwitchAllowed?: boolean;
    requireKnownWorkerSnapshot?: boolean;
  };
  status: string;
  expires_at: string;
  created_at: string;
  updated_at: string;
  created_by: string;
};

type RouteLoopConfirmationRow = {
  id: string;
  organization_id: string;
  site_id: string | null;
  workpack_id: string;
  share_session_id: string;
  worker_id: string | null;
  worker_display_name: string;
  worker_snapshot: Record<string, unknown>;
  language_code: string;
  confirmation_method: string;
  read_at: string;
};

function readRouteLoopField(row: Record<string, unknown>, field: string): unknown {
  return row[field];
}

function makeShareRecipientRouteLoopClient() {
  const shareSessions: RouteLoopShareSessionRow[] = [];
  const confirmations: RouteLoopConfirmationRow[] = [];
  const now = "2026-07-19T00:00:00.000Z";

  function filterRows<T extends Record<string, unknown>>(rows: T[]) {
    let filtered = [...rows];
    const query = {
      select() { return query; },
      eq(field: string, value: unknown) {
        filtered = filtered.filter((row) => readRouteLoopField(row, field) === value);
        return query;
      },
      is(field: string, value: unknown) {
        filtered = filtered.filter((row) => readRouteLoopField(row, field) === value);
        return query;
      },
      order() {
        return Promise.resolve({ data: filtered, error: null });
      },
      maybeSingle() {
        return Promise.resolve({ data: filtered[0] || null, error: null });
      }
    };
    return query;
  }

  return {
    client: {
      from(table: string) {
        if (table === "workpack_share_sessions") {
          return {
            ...filterRows(shareSessions),
            insert(value: Omit<RouteLoopShareSessionRow, "id" | "created_at" | "updated_at">) {
              const row: RouteLoopShareSessionRow = {
                ...value,
                id: SESSION_ID,
                created_at: now,
                updated_at: now
              };
              shareSessions.push(row);
              return {
                select() {
                  return { single: async () => ({ data: { id: row.id, expires_at: row.expires_at }, error: null }) };
                }
              };
            }
          };
        }
        if (table === "workpack_read_confirmations") {
          return {
            ...filterRows(confirmations),
            insert(value: Omit<RouteLoopConfirmationRow, "id" | "read_at">) {
              const row: RouteLoopConfirmationRow = {
                ...value,
                id: "confirmation-route-loop",
                read_at: now
              };
              confirmations.push(row);
              return {
                select() {
                  return { single: async () => ({ data: { id: row.id }, error: null }) };
                }
              };
            }
          };
        }
        throw new Error(`Unexpected table ${table}`);
      }
    },
    latestShareSession: () => shareSessions[shareSessions.length - 1] || null,
    confirmations: () => [...confirmations]
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getWorkspaceUser.mockResolvedValue({ id: "user-1", email: "owner@example.com" });
  mocks.loadOwnedWorkpackOperationContext.mockResolvedValue(ownedContext());
  mocks.loadServerShareRecipients.mockResolvedValue({ ok: true, recipients: [serverRecipient] });
  mocks.loadActiveOwnedShareSession.mockResolvedValue(activeSession());
  mocks.loadActivePublicShareSession.mockResolvedValue(publicSession());
  mocks.resolveWebhookConfig.mockReturnValue({ url: "https://n8n.example/webhook", token: "secret" });
  mocks.isLiveDispatchEnabled.mockReturnValue(true);
  mocks.postWebhookWithTimeout.mockResolvedValue({ ok: true, workflowRunId: "run-1", channelResults: [] });
});

describe("share session route authority", () => {
  it("rejects an oversized public acknowledgement before session lookup", async () => {
    const { POST } = await import("@/app/api/share-sessions/[sessionId]/route");
    const response = await POST(new NextRequest(`http://localhost/api/share-sessions/${SESSION_ID}`, {
      method: "POST",
      headers: {
        "content-length": "1",
        "content-type": "application/json",
        "x-forwarded-for": "198.51.100.88"
      },
      body: "x".repeat(PUBLIC_SHARE_ACK_REQUEST_MAX_BYTES + 1)
    }), { params: Promise.resolve({ sessionId: SESSION_ID }) });
    const payload = await response.json() as { code: string; limit: number };

    expect(response.status).toBe(413);
    expect(payload).toMatchObject({
      code: "PUBLIC_WORK_BUDGET_EXCEEDED",
      limit: PUBLIC_SHARE_ACK_REQUEST_MAX_BYTES
    });
    expect(mocks.loadActivePublicShareSession).not.toHaveBeenCalled();
  });

  it("rate limits repeated public share reads before session lookup", async () => {
    mocks.createSupabaseAdminClient.mockReturnValue({});
    const { GET } = await import("@/app/api/share-sessions/[sessionId]/route");
    const requestForAttempt = () => new NextRequest(
      `http://localhost/api/share-sessions/${SESSION_ID}?workerId=${WORKER_ID}`,
      { method: "GET", headers: { "x-forwarded-for": "198.51.100.89" } }
    );

    for (let attempt = 0; attempt < 60; attempt += 1) {
      const response = await GET(requestForAttempt(), {
        params: Promise.resolve({ sessionId: SESSION_ID })
      });
      expect(response.status).toBe(200);
    }

    mocks.loadActivePublicShareSession.mockClear();
    const limited = await GET(requestForAttempt(), {
      params: Promise.resolve({ sessionId: SESSION_ID })
    });

    expect(limited.status).toBe(429);
    expect(limited.headers.get("X-SafeClaw-Rate-Limit")).toBe("instance");
    expect(mocks.loadActivePublicShareSession).not.toHaveBeenCalled();
  });

  it("returns only the invited worker hint for a public recipient share link", async () => {
    mocks.createSupabaseAdminClient.mockReturnValue({});
    const { GET } = await import("@/app/api/share-sessions/[sessionId]/route");

    const response = await GET(
      getRequest(`/api/share-sessions/${SESSION_ID}?workerId=${WORKER_ID}`),
      { params: Promise.resolve({ sessionId: SESSION_ID }) }
    );

    expect(response.status).toBe(200);
    expect(mocks.loadActivePublicShareSession).toHaveBeenCalledWith(expect.anything(), {
      shareSessionId: SESSION_ID,
      workerId: WORKER_ID
    });
    const body = await response.json() as {
      ok: boolean;
      session: {
        recipients: Array<{ workerId: string; displayName: string; languageCode: string }>;
        documents: Array<{ key: string; title: string; body: string }>;
        recipientMessage: { languageCode: string; title: string; body: string } | null;
      };
    };
    expect(body.ok).toBe(true);
    expect(body.session.recipients).toEqual([{
      workerId: WORKER_ID,
      displayName: "Server Nguyen",
      languageCode: "vi"
    }]);
    expect(body.session.documents.map((document) => document.title)).toEqual(["위험성평가표", "TBM 브리핑"]);
    expect(body.session.recipientMessage).toEqual({
      languageCode: "vi",
      title: "Tiếng Việt 안내",
      body: "Dừng công việc khi gió mạnh."
    });
  });

  it("does not expose recipient hints on an anonymous share lookup without worker identity", async () => {
    mocks.createSupabaseAdminClient.mockReturnValue({});
    const anonymousSession = publicSession();
    anonymousSession.session.accessPolicy = {
      ...anonymousSession.session.accessPolicy,
      anonymousAllowed: true,
      requireKnownWorkerSnapshot: false
    };
    mocks.loadActivePublicShareSession.mockResolvedValueOnce(anonymousSession);
    const { GET } = await import("@/app/api/share-sessions/[sessionId]/route");

    const response = await GET(
      getRequest(`/api/share-sessions/${SESSION_ID}`),
      { params: Promise.resolve({ sessionId: SESSION_ID }) }
    );

    expect(response.status).toBe(200);
    expect(mocks.loadActivePublicShareSession).toHaveBeenCalledWith(expect.anything(), {
      shareSessionId: SESSION_ID,
      workerId: undefined
    });
    const body = await response.json() as {
      session: {
        accessPolicy: { anonymousAllowed: boolean };
        recipients: Array<{ workerId: string; displayName: string; languageCode: string }>;
      };
    };
    expect(body.session.accessPolicy.anonymousAllowed).toBe(true);
    expect(body.session.recipients).toEqual([]);
  });

  it("does not expose invited documents when a public recipient link is missing worker identity", async () => {
    mocks.createSupabaseAdminClient.mockReturnValue({});
    const { GET } = await import("@/app/api/share-sessions/[sessionId]/route");

    const response = await GET(
      getRequest(`/api/share-sessions/${SESSION_ID}`),
      { params: Promise.resolve({ sessionId: SESSION_ID }) }
    );

    expect(response.status).toBe(403);
    expect(mocks.loadActivePublicShareSession).toHaveBeenCalledWith(expect.anything(), {
      shareSessionId: SESSION_ID,
      workerId: undefined
    });
    const bodyText = await response.text();
    expect(bodyText).toContain("초대된 작업자 링크로 다시 접속해 주세요.");
    expect(bodyText).not.toContain("위험성평가표");
    expect(bodyText).not.toContain("TBM 브리핑");
    expect(bodyText).not.toContain("Dừng công việc khi gió mạnh.");
  });

  it("does not expose invited documents when a public recipient link has an unknown worker identity", async () => {
    mocks.createSupabaseAdminClient.mockReturnValue({});
    const { GET } = await import("@/app/api/share-sessions/[sessionId]/route");

    const response = await GET(
      getRequest(`/api/share-sessions/${SESSION_ID}?workerId=99999999-9999-4999-8999-999999999999`),
      { params: Promise.resolve({ sessionId: SESSION_ID }) }
    );

    expect(response.status).toBe(403);
    const bodyText = await response.text();
    expect(bodyText).not.toContain("위험성평가표");
    expect(bodyText).not.toContain("TBM 브리핑");
    expect(bodyText).not.toContain("Dừng công việc khi gió mạnh.");
  });

  it("rejects a copied invitation URL without separate recipient contact verification", async () => {
    const fake = makeConfirmationClient(null);
    mocks.createSupabaseAdminClient.mockReturnValue(fake.client);
    const { POST } = await import("@/app/api/share-sessions/[sessionId]/route");

    const missing = await POST(jsonRequest(`/api/share-sessions/${SESSION_ID}?workerId=${WORKER_ID}`, {}), {
      params: Promise.resolve({ sessionId: SESSION_ID })
    });
    const mismatch = await POST(jsonRequest(`/api/share-sessions/${SESSION_ID}?workerId=${WORKER_ID}`, {
      recipientVerification: "010-9999-9999"
    }), { params: Promise.resolve({ sessionId: SESSION_ID }) });

    expect(missing.status).toBe(403);
    expect(mismatch.status).toBe(403);
    await expect(missing.json()).resolves.toMatchObject({
      code: "SHARE_RECIPIENT_VERIFICATION_REQUIRED",
      confirmationId: null
    });
    expect(fake.insertCount()).toBe(0);
  });

  it("fails closed when the invited worker snapshot has no verification contact", async () => {
    const fake = makeConfirmationClient(null);
    mocks.createSupabaseAdminClient.mockReturnValue(fake.client);
    const sessionWithoutContact = publicSession();
    sessionWithoutContact.session.recipients[0] = {
      ...serverRecipient,
      workerSnapshot: {
        ...serverRecipient.workerSnapshot,
        phone: "",
        email: ""
      }
    };
    mocks.loadActivePublicShareSession.mockResolvedValueOnce(sessionWithoutContact);
    const { POST } = await import("@/app/api/share-sessions/[sessionId]/route");

    const response = await POST(jsonRequest(`/api/share-sessions/${SESSION_ID}?workerId=${WORKER_ID}`, {
      recipientVerification: RECIPIENT_VERIFICATION
    }), { params: Promise.resolve({ sessionId: SESSION_ID }) });

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({
      code: "SHARE_RECIPIENT_CONTACT_UNAVAILABLE",
      confirmationId: null
    });
    expect(fake.insertCount()).toBe(0);
  });

  it("public recipient confirmation verifies contact, ignores forged fields, and stores the invited snapshot", async () => {
    const fake = makeConfirmationClient(null);
    mocks.createSupabaseAdminClient.mockReturnValue(fake.client);
    const { POST } = await import("@/app/api/share-sessions/[sessionId]/route");

    const response = await POST(jsonRequest(`/api/share-sessions/${SESSION_ID}`, {
      workerId: WORKER_ID,
      displayName: "Forged Name",
      recipientVerification: "010 1111 2222",
      languageCode: "ko",
      workerSnapshot: {
        workerId: WORKER_ID,
        displayName: "Forged Name",
        phone: "010-9999-9999"
      }
    }), { params: Promise.resolve({ sessionId: SESSION_ID }) });

    expect(response.status).toBe(200);
    expect(fake.inserted()).toMatchObject({
      worker_id: WORKER_ID,
      worker_display_name: "Server Nguyen",
      language_code: "vi",
      worker_snapshot: serverRecipient.workerSnapshot
    });
  });

  it("public recipient confirmation treats the link worker id as authoritative over a forged body worker id", async () => {
    const fake = makeConfirmationClient(null);
    mocks.createSupabaseAdminClient.mockReturnValue(fake.client);
    const { POST } = await import("@/app/api/share-sessions/[sessionId]/route");

    const response = await POST(jsonRequest(`/api/share-sessions/${SESSION_ID}?workerId=${WORKER_ID}`, {
      workerId: KOREAN_WORKER_ID,
      displayName: "Forged Kim",
      recipientVerification: "SERVER@example.com",
      languageCode: "ko"
    }), { params: Promise.resolve({ sessionId: SESSION_ID }) });

    expect(response.status).toBe(200);
    expect(fake.inserted()).toMatchObject({
      worker_id: WORKER_ID,
      worker_display_name: "Server Nguyen",
      language_code: "vi",
      worker_snapshot: serverRecipient.workerSnapshot
    });
  });

  it("rejects anonymous confirmation when the session requires a known worker snapshot", async () => {
    const fake = makeConfirmationClient(null);
    mocks.createSupabaseAdminClient.mockReturnValue(fake.client);
    const anonymousSession = publicSession();
    anonymousSession.session.accessPolicy = {
      ...anonymousSession.session.accessPolicy,
      anonymousAllowed: true,
      requireKnownWorkerSnapshot: true
    };
    mocks.loadActivePublicShareSession.mockResolvedValueOnce(anonymousSession);
    const { POST } = await import("@/app/api/share-sessions/[sessionId]/route");

    const response = await POST(jsonRequest(`/api/share-sessions/${SESSION_ID}`, {
      displayName: "Manual Visitor",
      languageCode: "vi"
    }), { params: Promise.resolve({ sessionId: SESSION_ID }) });
    const body = await response.json() as { ok: boolean; message: string };

    expect(response.status).toBe(403);
    expect(body).toMatchObject({
      ok: false,
      message: "초대된 작업자 식별자가 확인되지 않아 열람 확인을 저장할 수 없습니다."
    });
    expect(fake.insertCount()).toBe(0);
  });

  it("ignores forged recipient fields and persists only the server worker snapshot", async () => {
    const fake = makeShareInsertClient();
    mocks.createSupabaseAdminClient.mockReturnValue(fake.client);
    const { POST } = await import("@/app/api/workpacks/[id]/share-sessions/route");

    const response = await POST(jsonRequest(`/api/workpacks/${WORKPACK_ID}/share-sessions`, {
      recipients: [{
        workerId: WORKER_ID,
        displayName: "Forged Name",
        workerSnapshot: { phone: "010-9999-9999" }
      }]
    }), { params: Promise.resolve({ id: WORKPACK_ID }) });

    expect(response.status).toBe(200);
    expect(mocks.loadServerShareRecipients).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      requestedWorkerIds: [WORKER_ID]
    }));
    expect(fake.inserted()).toMatchObject({ recipients_snapshot: [serverRecipient] });
    const inserted = fake.inserted() as {
      expires_at?: string;
      status: string;
      share_scope: string;
      access_policy: { anonymousAllowed?: boolean };
      recipients_snapshot: Array<typeof serverRecipient>;
    };
    expect(Date.parse(inserted.expires_at || "")).toBeGreaterThan(Date.now());
    const body = await response.json() as { expiresAt?: string };
    expect(body.expiresAt).toBe(inserted.expires_at);
    expect(evaluateShareSessionReuse({
      id: SESSION_ID,
      status: inserted.status,
      shareScope: inserted.share_scope,
      anonymousAllowed: inserted.access_policy.anonymousAllowed === true,
      expiresAt: inserted.expires_at || null,
      recipients: inserted.recipients_snapshot
    }, {
      workpackId: WORKPACK_ID,
      workerIds: [WORKER_ID]
    }, 1, Date.now())).toEqual({ reusable: true });
  });

  it("proves the manager-created invited session can be opened by the worker and reflected in manager confirmations", async () => {
    const fake = makeShareRecipientRouteLoopClient();
    mocks.createSupabaseAdminClient.mockReturnValue(fake.client);
    mocks.loadActivePublicShareSession.mockImplementation(async (_client: unknown, input: { shareSessionId: string; workerId?: string }) => {
      const inserted = fake.latestShareSession();
      if (!inserted || inserted.id !== input.shareSessionId) {
        return { ok: false, status: 404, message: "공유 세션을 찾지 못했습니다." };
      }
      return {
        ok: true,
        session: {
          ...publicSession().session,
          id: inserted.id,
          organizationId: inserted.organization_id,
          siteId: inserted.site_id,
          workpackId: inserted.workpack_id,
          recipients: inserted.recipients_snapshot,
          accessPolicy: inserted.access_policy,
          shareScope: inserted.share_scope,
          status: inserted.status,
          expiresAt: inserted.expires_at
        }
      };
    });

    const managerShareRoute = await import("@/app/api/workpacks/[id]/share-sessions/route");
    const publicRecipientRoute = await import("@/app/api/share-sessions/[sessionId]/route");

    const createResponse = await managerShareRoute.POST(jsonRequest(`/api/workpacks/${WORKPACK_ID}/share-sessions`, {
      recipients: [{ workerId: WORKER_ID }]
    }), { params: Promise.resolve({ id: WORKPACK_ID }) });
    const created = await createResponse.json() as { shareSessionId: string; expiresAt: string };

    expect(createResponse.status).toBe(200);
    expect(created.shareSessionId).toBe(SESSION_ID);
    expect(fake.latestShareSession()).toMatchObject({
      id: SESSION_ID,
      workpack_id: WORKPACK_ID,
      recipients_snapshot: [serverRecipient],
      access_policy: {
        anonymousAllowed: false,
        manualLanguageSwitchAllowed: true,
        requireKnownWorkerSnapshot: true
      }
    });

    const workerGetResponse = await publicRecipientRoute.GET(
      getRequest(`/api/share-sessions/${created.shareSessionId}?workerId=${WORKER_ID}`),
      { params: Promise.resolve({ sessionId: created.shareSessionId }) }
    );
    const workerPayload = await workerGetResponse.json() as {
      session: {
        recipients: Array<{ workerId: string; displayName: string; languageCode: string }>;
        recipientMessage: { languageCode: string; body: string };
      };
    };

    expect(workerGetResponse.status).toBe(200);
    expect(workerPayload.session.recipients).toEqual([{
      workerId: WORKER_ID,
      displayName: "Server Nguyen",
      languageCode: "vi"
    }]);
    expect(workerPayload.session.recipientMessage.languageCode).toBe("vi");

    const workerConfirmResponse = await publicRecipientRoute.POST(jsonRequest(`/api/share-sessions/${created.shareSessionId}?workerId=${WORKER_ID}`, {
      workerId: KOREAN_WORKER_ID,
      displayName: "Forged Kim",
      recipientVerification: RECIPIENT_VERIFICATION,
      languageCode: "ko"
    }), { params: Promise.resolve({ sessionId: created.shareSessionId }) });
    const workerConfirmation = await workerConfirmResponse.json() as { confirmationId: string };

    expect(workerConfirmResponse.status).toBe(200);
    expect(workerConfirmation.confirmationId).toBe("confirmation-route-loop");
    expect(fake.confirmations()).toEqual([expect.objectContaining({
      id: "confirmation-route-loop",
      workpack_id: WORKPACK_ID,
      share_session_id: SESSION_ID,
      worker_id: WORKER_ID,
      worker_display_name: "Server Nguyen",
      language_code: "vi",
      worker_snapshot: expect.objectContaining(serverRecipient.workerSnapshot)
    })]);

    const managerStatusResponse = await managerShareRoute.GET(
      getRequest(`/api/workpacks/${WORKPACK_ID}/share-sessions`),
      { params: Promise.resolve({ id: WORKPACK_ID }) }
    );
    const managerStatus = await managerStatusResponse.json() as {
      sessions: Array<{ id: string; recipients_snapshot: typeof serverRecipient[] }>;
      confirmations: Array<{ id: string; share_session_id: string; worker_display_name: string; language_code: string }>;
    };

    expect(managerStatusResponse.status).toBe(200);
    expect(managerStatus.sessions).toEqual([expect.objectContaining({
      id: SESSION_ID,
      recipients_snapshot: [expect.objectContaining({
        workerId: WORKER_ID,
        displayName: "Server Nguyen",
        languageCode: "vi",
        workerSnapshot: expect.objectContaining(serverRecipient.workerSnapshot)
      })]
    })]);
    expect(managerStatus.confirmations).toEqual([expect.objectContaining({
      id: "confirmation-route-loop",
      share_session_id: SESSION_ID,
      worker_display_name: "Server Nguyen",
      language_code: "vi"
    })]);
  });

  it("lets only the owning manager revoke a session within the full workpack tuple", async () => {
    const fake = makeShareRevokeClient();
    mocks.createSupabaseAdminClient.mockReturnValue(fake.client);
    const { DELETE } = await import("@/app/api/workpacks/[id]/share-sessions/route");

    const response = await DELETE(new NextRequest(
      `http://localhost/api/workpacks/${WORKPACK_ID}/share-sessions?sessionId=${SESSION_ID}`,
      { method: "DELETE", headers: { authorization: "Bearer test-token" } }
    ), { params: Promise.resolve({ id: WORKPACK_ID }) });
    const body = await response.json() as { revokedSessionId: string; status: string; revokedAt: string };

    expect(response.status).toBe(200);
    expect(body).toEqual(expect.objectContaining({
      revokedSessionId: SESSION_ID,
      status: "revoked",
      revokedAt: "2026-08-14T01:00:00.000Z"
    }));
    expect(fake.updated()).toEqual(expect.objectContaining({ status: "revoked" }));
    expect(fake.filters()).toEqual([
      ["id", SESSION_ID],
      ["workpack_id", WORKPACK_ID],
      ["organization_id", "org-1"],
      ["site_id", "site-1"]
    ]);
  });

  it("rejects session revocation before storage access when manager auth is missing", async () => {
    const fake = makeShareRevokeClient();
    mocks.createSupabaseAdminClient.mockReturnValue(fake.client);
    mocks.getWorkspaceUser.mockResolvedValueOnce(null);
    const { DELETE } = await import("@/app/api/workpacks/[id]/share-sessions/route");

    const response = await DELETE(new NextRequest(
      `http://localhost/api/workpacks/${WORKPACK_ID}/share-sessions?sessionId=${SESSION_ID}`,
      { method: "DELETE" }
    ), { params: Promise.resolve({ id: WORKPACK_ID }) });

    expect(response.status).toBe(401);
    expect(fake.updated()).toBeNull();
    expect(mocks.loadOwnedWorkpackOperationContext).not.toHaveBeenCalled();
  });

  it("fails closed when a requested session is outside the owned tuple", async () => {
    const fake = makeShareRevokeClient({ data: null });
    mocks.createSupabaseAdminClient.mockReturnValue(fake.client);
    const { DELETE } = await import("@/app/api/workpacks/[id]/share-sessions/route");

    const response = await DELETE(new NextRequest(
      `http://localhost/api/workpacks/${WORKPACK_ID}/share-sessions?sessionId=${SESSION_ID}`,
      { method: "DELETE", headers: { authorization: "Bearer test-token" } }
    ), { params: Promise.resolve({ id: WORKPACK_ID }) });

    expect(response.status).toBe(404);
    expect(fake.filters()).toContainEqual(["organization_id", "org-1"]);
    expect(fake.filters()).toContainEqual(["site_id", "site-1"]);
  });
});

describe("workflow dispatch route authority", () => {
  it("reports provider dispatch as preview-only without activating a provider", async () => {
    const { GET } = await import("@/app/api/workflow/dispatch/route");

    const response = await GET();
    const body = await response.json() as Record<string, unknown>;

    expect(response.status).toBe(200);
    expect(body).toEqual({
      ok: true,
      providerDispatch: {
        capability: false,
        mode: "preview_only",
        reason: "persistent_idempotency_unavailable",
        channels: {
          email: { capability: false, reason: "persistent_idempotency_unavailable" },
          sms: { capability: false, reason: "persistent_idempotency_unavailable" },
          kakao: { capability: false, reason: "persistent_idempotency_unavailable" }
        }
      }
    });
    expect(mocks.postWebhookWithTimeout).not.toHaveBeenCalled();
  });

  it("builds an exact minimal provider DTO for each canonical recipient message", async () => {
    expect(buildLocalizedDispatchRecipients(
      {
        recipients: [serverRecipient.workerSnapshot, koreanRecipient.workerSnapshot],
        messageVariants: { vi: VI_MESSAGE, ko: KO_MESSAGE },
        channels: ["sms"]
      }
    )).toEqual({
      ok: true,
      recipients: [
        {
          workerId: WORKER_ID,
          phone: "010-1111-2222",
          dispatchLanguageCode: "vi",
          messageTarget: "foreign:vi",
          message: VI_MESSAGE,
          deliveryText: VI_MESSAGE
        },
        {
          workerId: KOREAN_WORKER_ID,
          phone: "010-3333-4444",
          dispatchLanguageCode: "ko",
          messageTarget: "manager",
          message: KO_MESSAGE,
          deliveryText: KO_MESSAGE
        }
      ]
    });
  });

  it("fails closed instead of truncating an SMS recipient message", () => {
    const oversizedMessage = "V".repeat(901);

    expect(buildLocalizedDispatchRecipients({
      recipients: [serverRecipient.workerSnapshot],
      messageVariants: { vi: oversizedMessage },
      channels: ["sms"]
    })).toEqual({
      ok: false,
      missingLanguageCodes: [],
      oversizedMessageLanguageCodes: ["vi"]
    });
    expect(buildLocalizedDispatchRecipients({
      recipients: [serverRecipient.workerSnapshot],
      messageVariants: { vi: oversizedMessage },
      channels: ["email"]
    })).toMatchObject({ ok: true });
  });

  it("omits phone after kakao preflight leaves email as the only relay channel", async () => {
    const localizedPayload = buildLocalizedDispatchWebhookPayload({
      idempotencyKey: "provider-dispatch-v1-44444444-4444-4444-8444-444444444444-deadbeef",
      channels: ["email"],
      recipients: [serverRecipient.workerSnapshot],
      messageVariants: { vi: VI_MESSAGE },
      operatorNote: "",
      workpack: serverWorkpack,
      sentAt: "2026-07-17T00:00:00.000Z"
    });
    if (!localizedPayload.ok) throw new Error("Expected localized payload");
    const payload = localizedPayload.payload;

    expect(payload).toMatchObject({
      channels: ["email"],
      recipients: [{
        workerId: WORKER_ID,
        email: "server@example.com",
        dispatchLanguageCode: "vi",
        message: VI_MESSAGE,
        deliveryText: VI_MESSAGE
      }]
    });
    expect(payload.recipients[0]).not.toHaveProperty("phone");
  });

  it("does not require phone when kakao preflight leaves email as the only relay channel", async () => {
    mocks.createSupabaseAdminClient.mockReturnValue({});
    mocks.isLiveDispatchEnabled.mockReturnValue(false);
    mocks.loadActiveOwnedShareSession.mockResolvedValue({
      ...activeSession(),
      session: {
        ...activeSession().session,
        recipients: [{
          ...serverRecipient,
          workerSnapshot: {
            ...serverRecipient.workerSnapshot,
            phone: null
          }
        }]
      }
    });
    const { POST } = await import("@/app/api/workflow/dispatch/route");

    const response = await POST(jsonRequest("/api/workflow/dispatch", {
      workpackId: WORKPACK_ID,
      shareSessionId: SESSION_ID,
      idempotencyKey: "provider-dispatch-v1-44444444-4444-4444-8444-444444444444-deadbeef",
      channels: ["email", "kakao"],
      operatorNote: "",
      messageVariants: { vi: VI_MESSAGE }
    }));
    const body = await response.json() as {
      ok?: boolean;
      providerCalled?: boolean;
      channelResults?: Array<{ channel?: string; status?: string }>;
    };

    expect(response.status).toBe(200);
    expect(body).toMatchObject({ ok: true, providerCalled: false });
    expect(body.channelResults).toEqual(expect.arrayContaining([
      expect.objectContaining({ channel: "email", status: "sent" }),
      expect.objectContaining({ channel: "kakao", status: "unconfigured" })
    ]));
    expect(mocks.postWebhookWithTimeout).not.toHaveBeenCalled();
  });

  it("rejects a forged foreign body before provider dispatch", async () => {
    mocks.createSupabaseAdminClient.mockReturnValue({});
    mocks.isLiveDispatchEnabled.mockReturnValue(false);
    const { POST } = await import("@/app/api/workflow/dispatch/route");

    const response = await POST(jsonRequest("/api/workflow/dispatch", {
      workpackId: WORKPACK_ID,
      shareSessionId: SESSION_ID,
      idempotencyKey: "provider-dispatch-v1-44444444-4444-4444-8444-444444444444-deadbeef",
      channels: ["sms"],
      operatorNote: "",
      messageVariants: { vi: "[SafeClaw]\nTiếng Việt\n\n- Nội dung bị giả mạo." }
    }));
    const body = await response.json() as { providerCalled?: boolean };

    expect(response.status).toBe(409);
    expect(body.providerCalled).toBe(false);
    expect(mocks.postWebhookWithTimeout).not.toHaveBeenCalled();
  });

  it("rejects unknown language keys before provider dispatch", async () => {
    mocks.createSupabaseAdminClient.mockReturnValue({});
    mocks.isLiveDispatchEnabled.mockReturnValue(false);
    const { POST } = await import("@/app/api/workflow/dispatch/route");

    const response = await POST(jsonRequest("/api/workflow/dispatch", {
      workpackId: WORKPACK_ID,
      shareSessionId: SESSION_ID,
      idempotencyKey: "provider-dispatch-v1-44444444-4444-4444-8444-444444444444-deadbeef",
      channels: ["sms"],
      operatorNote: "",
      messageVariants: { vi: VI_MESSAGE, zz: "Unknown language body" }
    }));
    const body = await response.json() as { providerCalled?: boolean };

    expect(response.status).toBe(409);
    expect(body.providerCalled).toBe(false);
    expect(mocks.postWebhookWithTimeout).not.toHaveBeenCalled();
  });

  it("rejects Korean leakage in a stored foreign variant before provider dispatch", async () => {
    mocks.createSupabaseAdminClient.mockReturnValue({});
    mocks.isLiveDispatchEnabled.mockReturnValue(false);
    const leakingWorkpack = {
      ...serverWorkpack,
      deliverables: {
        ...serverWorkpack.deliverables,
        foreignWorkerLanguages: [{
          ...serverWorkpack.deliverables.foreignWorkerLanguages[0],
          lines: ["강풍 시 작업을 중지하세요."]
        }]
      }
    };
    mocks.loadOwnedWorkpackOperationContext.mockResolvedValue({
      ...ownedContext(),
      context: {
        ...ownedContext().context,
        shareAuthority: {
          ...ownedContext().context.shareAuthority,
          workpack: leakingWorkpack
        }
      }
    });
    const { POST } = await import("@/app/api/workflow/dispatch/route");

    const response = await POST(jsonRequest("/api/workflow/dispatch", {
      workpackId: WORKPACK_ID,
      shareSessionId: SESSION_ID,
      idempotencyKey: "provider-dispatch-v1-44444444-4444-4444-8444-444444444444-deadbeef",
      channels: ["sms"],
      operatorNote: "",
      messageVariants: { vi: "[SafeClaw]\nTiếng Việt\n\n- 강풍 시 작업을 중지하세요." }
    }));
    const body = await response.json() as { providerCalled?: boolean };

    expect(response.status).toBe(409);
    expect(body.providerCalled).toBe(false);
    expect(mocks.postWebhookWithTimeout).not.toHaveBeenCalled();
  });

  it("fails closed when stored foreignWorkerLanguages is missing", async () => {
    mocks.createSupabaseAdminClient.mockReturnValue({});
    mocks.isLiveDispatchEnabled.mockReturnValue(false);
    const { foreignWorkerLanguages: _removed, ...deliverables } = serverWorkpack.deliverables;
    mocks.loadOwnedWorkpackOperationContext.mockResolvedValue({
      ...ownedContext(),
      context: {
        ...ownedContext().context,
        shareAuthority: {
          ...ownedContext().context.shareAuthority,
          workpack: { ...serverWorkpack, deliverables }
        }
      }
    });
    const { POST } = await import("@/app/api/workflow/dispatch/route");

    const response = await POST(jsonRequest("/api/workflow/dispatch", {
      workpackId: WORKPACK_ID,
      shareSessionId: SESSION_ID,
      idempotencyKey: "provider-dispatch-v1-44444444-4444-4444-8444-444444444444-deadbeef",
      channels: ["sms"],
      operatorNote: "",
      messageVariants: { vi: VI_MESSAGE }
    }));
    const body = await response.json() as {
      malformedFields?: string[];
      providerCalled?: boolean;
    };

    expect(response.status).toBe(409);
    expect(body).toMatchObject({
      malformedFields: ["deliverables.foreignWorkerLanguages"],
      providerCalled: false
    });
    expect(mocks.postWebhookWithTimeout).not.toHaveBeenCalled();
  });

  it("fails closed when stored foreign worker lines is not an array", async () => {
    mocks.createSupabaseAdminClient.mockReturnValue({});
    mocks.isLiveDispatchEnabled.mockReturnValue(false);
    const malformedWorkpack = {
      ...serverWorkpack,
      deliverables: {
        ...serverWorkpack.deliverables,
        foreignWorkerLanguages: [{
          ...serverWorkpack.deliverables.foreignWorkerLanguages[0],
          lines: "Dừng công việc khi gió mạnh."
        }]
      }
    };
    mocks.loadOwnedWorkpackOperationContext.mockResolvedValue({
      ...ownedContext(),
      context: {
        ...ownedContext().context,
        shareAuthority: {
          ...ownedContext().context.shareAuthority,
          workpack: malformedWorkpack
        }
      }
    });
    const { POST } = await import("@/app/api/workflow/dispatch/route");

    const response = await POST(jsonRequest("/api/workflow/dispatch", {
      workpackId: WORKPACK_ID,
      shareSessionId: SESSION_ID,
      idempotencyKey: "provider-dispatch-v1-44444444-4444-4444-8444-444444444444-deadbeef",
      channels: ["sms"],
      operatorNote: "",
      messageVariants: { vi: VI_MESSAGE }
    }));
    const body = await response.json() as {
      malformedFields?: string[];
      providerCalled?: boolean;
    };

    expect(response.status).toBe(409);
    expect(body).toMatchObject({
      malformedFields: ["deliverables.foreignWorkerLanguages[0].lines"],
      providerCalled: false
    });
    expect(mocks.postWebhookWithTimeout).not.toHaveBeenCalled();
  });

  it("fails closed when a stored foreign worker native label is blank", async () => {
    mocks.createSupabaseAdminClient.mockReturnValue({});
    mocks.isLiveDispatchEnabled.mockReturnValue(false);
    const malformedWorkpack = {
      ...serverWorkpack,
      deliverables: {
        ...serverWorkpack.deliverables,
        foreignWorkerLanguages: [{
          ...serverWorkpack.deliverables.foreignWorkerLanguages[0],
          nativeLabel: "   "
        }]
      }
    };
    mocks.loadOwnedWorkpackOperationContext.mockResolvedValue({
      ...ownedContext(),
      context: {
        ...ownedContext().context,
        shareAuthority: {
          ...ownedContext().context.shareAuthority,
          workpack: malformedWorkpack
        }
      }
    });
    const { POST } = await import("@/app/api/workflow/dispatch/route");

    const response = await POST(jsonRequest("/api/workflow/dispatch", {
      workpackId: WORKPACK_ID,
      shareSessionId: SESSION_ID,
      idempotencyKey: "provider-dispatch-v1-44444444-4444-4444-8444-444444444444-deadbeef",
      channels: ["sms"],
      operatorNote: "",
      messageVariants: { vi: VI_MESSAGE }
    }));
    const body = await response.json() as {
      malformedFields?: string[];
      providerCalled?: boolean;
    };

    expect(response.status).toBe(409);
    expect(body).toMatchObject({
      malformedFields: ["deliverables.foreignWorkerLanguages[0].nativeLabel"],
      providerCalled: false
    });
    expect(mocks.postWebhookWithTimeout).not.toHaveBeenCalled();
  });

  it("fails closed when stored foreign worker lines are empty", async () => {
    mocks.createSupabaseAdminClient.mockReturnValue({});
    mocks.isLiveDispatchEnabled.mockReturnValue(false);
    const malformedWorkpack = {
      ...serverWorkpack,
      deliverables: {
        ...serverWorkpack.deliverables,
        foreignWorkerLanguages: [{
          ...serverWorkpack.deliverables.foreignWorkerLanguages[0],
          lines: []
        }]
      }
    };
    mocks.loadOwnedWorkpackOperationContext.mockResolvedValue({
      ...ownedContext(),
      context: {
        ...ownedContext().context,
        shareAuthority: {
          ...ownedContext().context.shareAuthority,
          workpack: malformedWorkpack
        }
      }
    });
    const { POST } = await import("@/app/api/workflow/dispatch/route");

    const response = await POST(jsonRequest("/api/workflow/dispatch", {
      workpackId: WORKPACK_ID,
      shareSessionId: SESSION_ID,
      idempotencyKey: "provider-dispatch-v1-44444444-4444-4444-8444-444444444444-deadbeef",
      channels: ["sms"],
      operatorNote: "",
      messageVariants: { vi: "[SafeClaw]\nTiếng Việt" }
    }));
    const body = await response.json() as {
      malformedFields?: string[];
      providerCalled?: boolean;
    };

    expect(response.status).toBe(409);
    expect(body).toMatchObject({
      malformedFields: ["deliverables.foreignWorkerLanguages[0].lines"],
      providerCalled: false
    });
    expect(mocks.postWebhookWithTimeout).not.toHaveBeenCalled();
  });

  it("fails closed when a stored foreign worker line is blank", async () => {
    mocks.createSupabaseAdminClient.mockReturnValue({});
    mocks.isLiveDispatchEnabled.mockReturnValue(false);
    const malformedWorkpack = {
      ...serverWorkpack,
      deliverables: {
        ...serverWorkpack.deliverables,
        foreignWorkerLanguages: [{
          ...serverWorkpack.deliverables.foreignWorkerLanguages[0],
          lines: ["   "]
        }]
      }
    };
    mocks.loadOwnedWorkpackOperationContext.mockResolvedValue({
      ...ownedContext(),
      context: {
        ...ownedContext().context,
        shareAuthority: {
          ...ownedContext().context.shareAuthority,
          workpack: malformedWorkpack
        }
      }
    });
    const { POST } = await import("@/app/api/workflow/dispatch/route");

    const response = await POST(jsonRequest("/api/workflow/dispatch", {
      workpackId: WORKPACK_ID,
      shareSessionId: SESSION_ID,
      idempotencyKey: "provider-dispatch-v1-44444444-4444-4444-8444-444444444444-deadbeef",
      channels: ["sms"],
      operatorNote: "",
      messageVariants: { vi: "[SafeClaw]\nTiếng Việt\n\n-" }
    }));
    const body = await response.json() as {
      malformedFields?: string[];
      providerCalled?: boolean;
    };

    expect(response.status).toBe(409);
    expect(body).toMatchObject({
      malformedFields: ["deliverables.foreignWorkerLanguages[0].lines"],
      providerCalled: false
    });
    expect(mocks.postWebhookWithTimeout).not.toHaveBeenCalled();
  });

  it("fails closed when stored foreign worker language codes are duplicated", async () => {
    mocks.createSupabaseAdminClient.mockReturnValue({});
    mocks.isLiveDispatchEnabled.mockReturnValue(false);
    const language = serverWorkpack.deliverables.foreignWorkerLanguages[0];
    const malformedWorkpack = {
      ...serverWorkpack,
      deliverables: {
        ...serverWorkpack.deliverables,
        foreignWorkerLanguages: [
          language,
          {
            ...language,
            nativeLabel: "Vietnamese",
            lines: ["Stop work when strong wind begins."]
          }
        ]
      }
    };
    mocks.loadOwnedWorkpackOperationContext.mockResolvedValue({
      ...ownedContext(),
      context: {
        ...ownedContext().context,
        shareAuthority: {
          ...ownedContext().context.shareAuthority,
          workpack: malformedWorkpack
        }
      }
    });
    const { POST } = await import("@/app/api/workflow/dispatch/route");

    const response = await POST(jsonRequest("/api/workflow/dispatch", {
      workpackId: WORKPACK_ID,
      shareSessionId: SESSION_ID,
      idempotencyKey: "provider-dispatch-v1-44444444-4444-4444-8444-444444444444-deadbeef",
      channels: ["sms"],
      operatorNote: "",
      messageVariants: { vi: VI_MESSAGE }
    }));
    const body = await response.json() as {
      malformedFields?: string[];
      providerCalled?: boolean;
    };

    expect(response.status).toBe(409);
    expect(body).toMatchObject({
      malformedFields: ["deliverables.foreignWorkerLanguages[1].code"],
      providerCalled: false
    });
    expect(mocks.postWebhookWithTimeout).not.toHaveBeenCalled();
  });

  it("fails closed when foreign worker languages reserve the canonical ko code", async () => {
    mocks.createSupabaseAdminClient.mockReturnValue({});
    mocks.isLiveDispatchEnabled.mockReturnValue(false);
    const language = serverWorkpack.deliverables.foreignWorkerLanguages[0];
    const malformedWorkpack = {
      ...serverWorkpack,
      deliverables: {
        ...serverWorkpack.deliverables,
        foreignWorkerLanguages: [{
          ...language,
          code: "ko",
          nativeLabel: "한국어",
          lines: ["작업 전 안전수칙을 확인해 주세요."]
        }]
      }
    };
    mocks.loadOwnedWorkpackOperationContext.mockResolvedValue({
      ...ownedContext(),
      context: {
        ...ownedContext().context,
        shareAuthority: {
          ...ownedContext().context.shareAuthority,
          workpack: malformedWorkpack
        }
      }
    });
    mocks.loadActiveOwnedShareSession.mockResolvedValue({
      ...activeSession(),
      session: {
        ...activeSession().session,
        recipients: [koreanRecipient]
      }
    });
    const { POST } = await import("@/app/api/workflow/dispatch/route");

    const response = await POST(jsonRequest("/api/workflow/dispatch", {
      workpackId: WORKPACK_ID,
      shareSessionId: SESSION_ID,
      idempotencyKey: "provider-dispatch-v1-44444444-4444-4444-8444-444444444444-deadbeef",
      channels: ["sms"],
      operatorNote: "",
      messageVariants: { ko: KO_MESSAGE }
    }));
    const body = await response.json() as {
      malformedFields?: string[];
      providerCalled?: boolean;
    };

    expect(response.status).toBe(409);
    expect(body).toMatchObject({
      malformedFields: ["deliverables.foreignWorkerLanguages[0].code"],
      providerCalled: false
    });
    expect(mocks.postWebhookWithTimeout).not.toHaveBeenCalled();
  });

  it("fails closed before provider dispatch when a saved recipient language body is unavailable", async () => {
    mocks.createSupabaseAdminClient.mockReturnValue({});
    mocks.isLiveDispatchEnabled.mockReturnValue(false);
    const { POST } = await import("@/app/api/workflow/dispatch/route");

    const response = await POST(jsonRequest("/api/workflow/dispatch", {
      workpackId: WORKPACK_ID,
      shareSessionId: SESSION_ID,
      idempotencyKey: "provider-dispatch-v1-44444444-4444-4444-8444-444444444444-deadbeef",
      channels: ["sms"],
      operatorNote: "",
      messageVariants: {
        ko: "[SafeClaw]\n작업 전 안전수칙을 확인해 주세요."
      }
    }));
    const body = await response.json() as {
      missingLanguageCodes?: string[];
      providerCalled?: boolean;
    };

    expect(response.status).toBe(409);
    expect(body).toMatchObject({
      missingLanguageCodes: ["vi"],
      providerCalled: false
    });
    expect(mocks.postWebhookWithTimeout).not.toHaveBeenCalled();
  });

  it("fails closed before provider dispatch instead of truncating an oversized SMS body", async () => {
    const oversizedWorkpack = {
      ...serverWorkpack,
      mode: "live",
      deliverables: {
        ...serverWorkpack.deliverables,
        foreignWorkerLanguages: [{
          ...serverWorkpack.deliverables.foreignWorkerLanguages[0],
          lines: ["V".repeat(900)]
        }]
      }
    };
    const canonical = buildCanonicalRecipientMessageVariants({
      data: oversizedWorkpack as unknown as AskResponse,
      recipientLanguageCodes: ["vi"]
    });
    if (!canonical.ok) throw new Error("Expected an oversized canonical message fixture");
    expect(canonical.messageVariants.vi.length).toBeGreaterThan(900);
    mocks.createSupabaseAdminClient.mockReturnValue({});
    mocks.isLiveDispatchEnabled.mockReturnValue(false);
    mocks.loadOwnedWorkpackOperationContext.mockResolvedValue({
      ...ownedContext(),
      context: {
        ...ownedContext().context,
        shareAuthority: {
          ...ownedContext().context.shareAuthority,
          workpack: oversizedWorkpack
        }
      }
    });
    const { POST } = await import("@/app/api/workflow/dispatch/route");

    const response = await POST(jsonRequest("/api/workflow/dispatch", {
      workpackId: WORKPACK_ID,
      shareSessionId: SESSION_ID,
      idempotencyKey: "provider-dispatch-v1-44444444-4444-4444-8444-444444444444-deadbeef",
      channels: ["sms"],
      operatorNote: "",
      messageVariants: canonical.messageVariants
    }));
    const body = await response.json() as {
      oversizedMessageLanguageCodes?: string[];
      providerCalled?: boolean;
    };

    expect(response.status).toBe(409);
    expect(body).toMatchObject({
      oversizedMessageLanguageCodes: ["vi"],
      providerCalled: false
    });
    expect(mocks.postWebhookWithTimeout).not.toHaveBeenCalled();
  });

  it("rejects client-forged workpack and recipients fields", async () => {
    mocks.createSupabaseAdminClient.mockReturnValue({});
    const { POST } = await import("@/app/api/workflow/dispatch/route");

    const response = await POST(jsonRequest("/api/workflow/dispatch", {
      workpackId: WORKPACK_ID,
      shareSessionId: SESSION_ID,
      channels: ["sms"],
      workpack: { answer: "forged" },
      recipients: [{ phone: "010-9999-9999" }]
    }));

    expect(response.status).toBe(400);
    expect(mocks.postWebhookWithTimeout).not.toHaveBeenCalled();
  });

  it("fails closed before provider dispatch when persistent idempotency is unavailable", async () => {
    mocks.createSupabaseAdminClient.mockReturnValue({});
    const { POST } = await import("@/app/api/workflow/dispatch/route");

    const response = await POST(jsonRequest("/api/workflow/dispatch", {
      workpackId: WORKPACK_ID,
      shareSessionId: SESSION_ID,
      idempotencyKey: "provider-dispatch-v1-44444444-4444-4444-8444-444444444444-deadbeef",
      channels: ["email", "sms"],
      operatorNote: "server authority",
      messageVariants: {
        vi: VI_MESSAGE
      }
    }));
    const body = await response.json() as {
      duplicateRisk?: boolean;
      idempotencySupported?: boolean;
      idempotencyKey?: string;
      providerCalled?: boolean;
      providerDispatch?: {
        capability: boolean;
        mode: string;
        reason: string | null;
      };
    };

    expect(response.status).toBe(409);
    expect(body).toMatchObject({
      duplicateRisk: true,
      idempotencySupported: false,
      idempotencyKey: "provider-dispatch-v1-44444444-4444-4444-8444-444444444444-deadbeef",
      providerCalled: false,
      providerDispatch: {
        capability: false,
        mode: "preview_only",
        reason: "persistent_idempotency_unavailable"
      }
    });
    expect(mocks.postWebhookWithTimeout).not.toHaveBeenCalled();
  });

  it("keeps fixture validation non-delivery while accepting the idempotency contract", async () => {
    mocks.createSupabaseAdminClient.mockReturnValue({});
    mocks.isLiveDispatchEnabled.mockReturnValue(false);
    const { POST } = await import("@/app/api/workflow/dispatch/route");

    const response = await POST(jsonRequest("/api/workflow/dispatch", {
      workpackId: WORKPACK_ID,
      shareSessionId: SESSION_ID,
      idempotencyKey: "provider-dispatch-v1-44444444-4444-4444-8444-444444444444-deadbeef",
      channels: ["email"],
      operatorNote: "fixture validation",
      messageVariants: {
        vi: VI_MESSAGE
      }
    }));
    const body = await response.json() as {
      providerStatus?: string;
      duplicateRisk?: boolean;
      idempotencyKey?: string;
      providerCalled?: boolean;
    };

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      providerStatus: "fixture",
      duplicateRisk: false,
      idempotencyKey: "provider-dispatch-v1-44444444-4444-4444-8444-444444444444-deadbeef",
      providerCalled: false
    });
    expect(mocks.postWebhookWithTimeout).not.toHaveBeenCalled();
  });

  it("builds a payload that proves each recipient language body without a global message", async () => {
    const messageVariants = {
      vi: VI_MESSAGE,
      ko: KO_MESSAGE
    };
    const localized = buildLocalizedDispatchRecipients({
      recipients: [serverRecipient.workerSnapshot, koreanRecipient.workerSnapshot],
      messageVariants,
      channels: ["sms"]
    });
    if (!localized.ok) throw new Error("Expected canonical recipients");

    const localizedPayload = buildLocalizedDispatchWebhookPayload({
      idempotencyKey: "provider-dispatch-v1-44444444-4444-4444-8444-444444444444-deadbeef",
      channels: ["sms"],
      recipients: [serverRecipient.workerSnapshot, koreanRecipient.workerSnapshot],
      messageVariants,
      operatorNote: "TBM 후 확인",
      workpack: serverWorkpack,
      sentAt: "2026-07-15T00:00:00.000Z"
    });
    if (!localizedPayload.ok) throw new Error("Expected localized payload");
    const payload = localizedPayload.payload;

    expect(payload).toMatchObject({
      event: "safeguard.workpack.dispatch",
      recipientMessageContract: "saved-worker-language-v1",
      recipients: localized.recipients
    });
    expect(payload.messageVariants).toEqual(messageVariants);
    expect(payload).not.toHaveProperty("messageTarget");
    expect(payload).not.toHaveProperty("message");
    const foreignRecipient = payload.recipients.find((recipient) => recipient.dispatchLanguageCode === "vi");
    expect(foreignRecipient).toEqual({
      workerId: WORKER_ID,
      phone: "010-1111-2222",
      dispatchLanguageCode: "vi",
      messageTarget: "foreign:vi",
      message: VI_MESSAGE,
      deliveryText: VI_MESSAGE
    });
    expect(Object.keys(foreignRecipient || {})).not.toEqual(expect.arrayContaining([
      "displayName",
      "workerRole",
      "languageLabel",
      "trainingStatus",
      "trainingSummary",
      "email"
    ]));
    expect(foreignRecipient?.message).not.toMatch(/[가-힣]/u);
  });

  it("rejects internal diagnostics and oversized selected messages before relay", async () => {
    mocks.createSupabaseAdminClient.mockReturnValue({});
    mocks.isLiveDispatchEnabled.mockReturnValue(false);
    const { POST } = await import("@/app/api/workflow/dispatch/route");
    const baseBody = {
      workpackId: WORKPACK_ID,
      shareSessionId: SESSION_ID,
      idempotencyKey: "provider-dispatch-v1-44444444-4444-4444-8444-444444444444-deadbeef",
      channels: ["sms"],
      operatorNote: ""
    };

    const internalResponse = await POST(jsonRequest("/api/workflow/dispatch", {
      ...baseBody,
      messageVariants: { vi: "DB 하네스 내부 진단" }
    }));
    expect(internalResponse.status).toBe(400);

    const oversizedResponse = await POST(jsonRequest("/api/workflow/dispatch", {
      ...baseBody,
      messageVariants: { vi: "x".repeat(4_001) }
    }));
    expect(oversizedResponse.status).toBe(400);
    expect(mocks.postWebhookWithTimeout).not.toHaveBeenCalled();
  });

  it("rejects an oversized workflow body before database or provider work", async () => {
    const { POST } = await import("@/app/api/workflow/dispatch/route");
    const response = await POST(jsonRequest("/api/workflow/dispatch", {
      workpackId: WORKPACK_ID,
      shareSessionId: SESSION_ID,
      idempotencyKey: "provider-dispatch-v1-44444444-4444-4444-8444-444444444444-deadbeef",
      channels: ["sms"],
      operatorNote: "x".repeat(WORKFLOW_DISPATCH_REQUEST_MAX_BYTES),
      messageVariants: { vi: VI_MESSAGE }
    }));
    const body = await response.json() as { code: string; limit: number };

    expect(response.status).toBe(413);
    expect(body).toMatchObject({
      code: "WORKFLOW_DISPATCH_PAYLOAD_TOO_LARGE",
      limit: WORKFLOW_DISPATCH_REQUEST_MAX_BYTES
    });
    expect(mocks.createSupabaseAdminClient).not.toHaveBeenCalled();
    expect(mocks.postWebhookWithTimeout).not.toHaveBeenCalled();
  });

  it("rejects the legacy single-message-for-all request contract", async () => {
    mocks.createSupabaseAdminClient.mockReturnValue({});
    const { POST } = await import("@/app/api/workflow/dispatch/route");

    const response = await POST(jsonRequest("/api/workflow/dispatch", {
      workpackId: WORKPACK_ID,
      shareSessionId: SESSION_ID,
      idempotencyKey: "provider-dispatch-v1-44444444-4444-4444-8444-444444444444-deadbeef",
      channels: ["sms"],
      operatorNote: "",
      messageTarget: "foreign:vi",
      message: "하나의 본문을 모든 수신자에게 보내는 과거 요청"
    }));

    expect(response.status).toBe(400);
    expect(mocks.loadOwnedWorkpackOperationContext).not.toHaveBeenCalled();
    expect(mocks.postWebhookWithTimeout).not.toHaveBeenCalled();
  });
});

describe("n8n recipient localization contract", () => {
  it("consumes each server-authoritative recipient message without a legacy global body", async () => {
    const template = JSON.parse(readFileSync(
      join(process.cwd(), "docs", "n8n_safeguard_workflow_template.json"),
      "utf8"
    )) as Array<{ nodes?: Array<{ name?: string; parameters?: { jsCode?: string } }> }>;
    const script = template[0]?.nodes
      ?.find((node) => node.name === "Validate Secret and Dispatch Channels")
      ?.parameters?.jsCode;

    expect(script).toBeTypeOf("string");
    expect(script).not.toContain("const message = workpack.message");
    expect(script).not.toContain("payload.message");
    expect(script).toContain("recipient.message");
    expect(script).toContain("recipient.deliveryText");
    expect(script).toContain("recipientText(recipient)");
    expect(script).toContain("for (const recipient of messageRecipients)");
    expect(script).toContain("recipients: [recipient]");
    expect(script).toContain("const text = recipientText(recipient)");
    expect(script).not.toContain("recipientText(recipient).slice(0, 900)");
    expect(script).toContain(
      "client.mail(config.smtpUser, [email], payload.subject, recipientText(recipient), recipient.messageTarget)"
    );

    const providerBodies: Array<Record<string, unknown>> = [];
    const providerFetch = vi.fn(async (_input: unknown, init: unknown) => {
      const request = init as { body?: unknown };
      providerBodies.push(JSON.parse(String(request.body)) as Record<string, unknown>);
      return new Response("accepted", { status: 200 });
    });
    const AsyncFunction = Object.getPrototypeOf(async () => undefined).constructor as new (
      ...args: string[]
    ) => (...args: unknown[]) => Promise<unknown>;
    const execute = new AsyncFunction("$json", "$env", "$execution", "require", "fetch", "Buffer", script || "");
    await execute({
      headers: { "x-safeguard-secret": "secret" },
      body: {
        recipientMessageContract: "saved-worker-language-v1",
        operatorNote: "TBM 후 확인",
        channels: ["sms"],
        recipients: [
          {
            workerId: WORKER_ID,
            phone: "010-1111-2222",
            dispatchLanguageCode: "vi",
            messageTarget: "foreign:vi",
            message: VI_MESSAGE,
            deliveryText: `${VI_MESSAGE}\n\nhttps://www.safeclaw.kr/share/${SESSION_ID}?workerId=${WORKER_ID}`
          },
          {
            workerId: KOREAN_WORKER_ID,
            phone: "010-3333-4444",
            dispatchLanguageCode: "ko",
            messageTarget: "manager",
            message: KO_MESSAGE
          }
        ],
        workpack: { companyName: "Safe Site" }
      }
    }, {
      SAFEGUARD_WEBHOOK_TOKEN: "secret",
      SAFEGUARD_SMS_WEBHOOK_URL: "https://provider.example/sms"
    }, { id: "execution-1" }, createRequire(import.meta.url), providerFetch, Buffer);

    expect(providerFetch).toHaveBeenCalledTimes(2);
    expect(providerBodies).toEqual([
      expect.objectContaining({
        recipients: [{
          workerId: WORKER_ID,
          phone: "010-1111-2222",
          dispatchLanguageCode: "vi",
          messageTarget: "foreign:vi",
          message: VI_MESSAGE,
          deliveryText: `${VI_MESSAGE}\n\nhttps://www.safeclaw.kr/share/${SESSION_ID}?workerId=${WORKER_ID}`
        }],
        messageTarget: "foreign:vi",
        message: VI_MESSAGE,
        text: `${VI_MESSAGE}\n\nhttps://www.safeclaw.kr/share/${SESSION_ID}?workerId=${WORKER_ID}`
      }),
      expect.objectContaining({
        recipients: [{
          workerId: KOREAN_WORKER_ID,
          phone: "010-3333-4444",
          dispatchLanguageCode: "ko",
          messageTarget: "manager",
          message: KO_MESSAGE
        }],
        messageTarget: "manager",
        message: KO_MESSAGE,
        text: KO_MESSAGE
      })
    ]);
  });

  it("preserves each recipient message and messageTarget on the Solapi wire payload", async () => {
    const template = JSON.parse(readFileSync(
      join(process.cwd(), "docs", "n8n_safeguard_workflow_template.json"),
      "utf8"
    )) as Array<{ nodes?: Array<{ name?: string; parameters?: { jsCode?: string } }> }>;
    const script = template[0]?.nodes
      ?.find((node) => node.name === "Validate Secret and Dispatch Channels")
      ?.parameters?.jsCode || "";
    const wireBodies: Array<Record<string, unknown>> = [];
    const fakeHttps = {
      request(_options: unknown, callback: (response: EventEmitter & {
        statusCode: number;
        setEncoding: (encoding: string) => void;
      }) => void) {
        let requestBody = "";
        const request = new EventEmitter() as EventEmitter & {
          write: (chunk: string) => void;
          end: () => void;
          destroy: (error?: Error) => void;
        };
        request.write = (chunk: string) => { requestBody += chunk; };
        request.destroy = (error?: Error) => { if (error) request.emit("error", error); };
        request.end = () => {
          wireBodies.push(JSON.parse(requestBody) as Record<string, unknown>);
          const response = new EventEmitter() as EventEmitter & {
            statusCode: number;
            setEncoding: (encoding: string) => void;
          };
          response.statusCode = 200;
          response.setEncoding = () => undefined;
          callback(response);
          queueMicrotask(() => {
            response.emit("data", "accepted");
            response.emit("end");
          });
        };
        return request;
      }
    };
    const nodeRequire = createRequire(import.meta.url);
    const sandboxRequire = (id: string): unknown => id === "https" ? fakeHttps : nodeRequire(id);
    const AsyncFunction = Object.getPrototypeOf(async () => undefined).constructor as new (
      ...args: string[]
    ) => (...args: unknown[]) => Promise<unknown>;
    const execute = new AsyncFunction("$json", "$env", "$execution", "require", "fetch", "Buffer", script);

    const longVietnameseMessage = `SafeClaw ${"V".repeat(892)}`;
    await execute({
      headers: { "x-safeguard-secret": "secret" },
      body: {
        recipientMessageContract: "saved-worker-language-v1",
        operatorNote: "TBM 후 확인",
        channels: ["sms"],
        recipients: [{
          workerId: WORKER_ID,
          phone: "010-1111-2222",
          dispatchLanguageCode: "vi",
          messageTarget: "foreign:vi",
          message: longVietnameseMessage
        }],
        workpack: { companyName: "Safe Site" }
      }
    }, {
      SAFEGUARD_WEBHOOK_TOKEN: "secret",
      SOLAPI_API_KEY: "api-key",
      SOLAPI_API_SECRET: "api-secret",
      SOLAPI_SENDER: "0299998888",
      SOLAPI_BASE_URL: "https://api.solapi.example"
    }, { id: "execution-solapi" }, sandboxRequire, vi.fn(), Buffer);

    expect(wireBodies).toEqual([{
      message: {
        to: "01011112222",
        from: "0299998888",
        text: longVietnameseMessage,
        messageTarget: "foreign:vi",
        message: longVietnameseMessage
      }
    }]);
  });

  it("preserves each recipient message and messageTarget on the SMTP wire payload", async () => {
    const template = JSON.parse(readFileSync(
      join(process.cwd(), "docs", "n8n_safeguard_workflow_template.json"),
      "utf8"
    )) as Array<{ nodes?: Array<{ name?: string; parameters?: { jsCode?: string } }> }>;
    const script = template[0]?.nodes
      ?.find((node) => node.name === "Validate Secret and Dispatch Channels")
      ?.parameters?.jsCode || "";
    const smtpWrites: string[] = [];
    const createSocket = (responses: string[]) => {
      const socket = new EventEmitter() as EventEmitter & {
        setEncoding: (encoding: string) => void;
        write: (chunk: string) => void;
      };
      socket.setEncoding = () => undefined;
      socket.write = (chunk: string) => {
        smtpWrites.push(chunk);
        const response = responses.shift();
        if (!response) throw new Error(`Unexpected SMTP write: ${chunk.slice(0, 40)}`);
        queueMicrotask(() => socket.emit("data", response));
      };
      return socket;
    };
    const fakeNet = {
      connect(_options: unknown, callback: () => void) {
        const socket = createSocket(["250 hello\r\n", "220 tls\r\n"]);
        queueMicrotask(() => {
          callback();
          socket.emit("data", "220 ready\r\n");
        });
        return socket;
      }
    };
    const fakeTls = {
      connect() {
        const socket = createSocket([
          "250 hello\r\n",
          "334 user\r\n",
          "334 pass\r\n",
          "235 authenticated\r\n",
          "250 sender\r\n",
          "250 recipient\r\n",
          "354 data\r\n",
          "250 queued\r\n",
          "221 bye\r\n"
        ]);
        queueMicrotask(() => socket.emit("secureConnect"));
        return socket;
      }
    };
    const nodeRequire = createRequire(import.meta.url);
    const sandboxRequire = (id: string): unknown => {
      if (id === "net") return fakeNet;
      if (id === "tls") return fakeTls;
      return nodeRequire(id);
    };
    const AsyncFunction = Object.getPrototypeOf(async () => undefined).constructor as new (
      ...args: string[]
    ) => (...args: unknown[]) => Promise<unknown>;
    const execute = new AsyncFunction("$json", "$env", "$execution", "require", "fetch", "Buffer", script);

    await execute({
      headers: { "x-safeguard-secret": "secret" },
      body: {
        recipientMessageContract: "saved-worker-language-v1",
        operatorNote: "TBM 후 확인",
        channels: ["email"],
        recipients: [{
          workerId: WORKER_ID,
          email: "worker@example.com",
          dispatchLanguageCode: "vi",
          messageTarget: "foreign:vi",
          message: VI_MESSAGE
        }],
        workpack: { companyName: "Safe Site" }
      }
    }, {
      SAFEGUARD_WEBHOOK_TOKEN: "secret",
      SMTP_HOST: "smtp.example.com",
      SMTP_PORT: "587",
      SMTP_USER: "sender@example.com",
      SMTP_PASS: "smtp-pass"
    }, { id: "execution-smtp" }, sandboxRequire, vi.fn(), Buffer);

    const dataWrite = smtpWrites.find((write) => write.includes("Content-Transfer-Encoding: base64")) || "";
    expect(dataWrite).toContain("X-SafeClaw-Message-Target: foreign:vi");
    const encodedBody = dataWrite.split("\r\n\r\n")[1]?.split("\r\n.\r\n")[0] || "";
    expect(Buffer.from(encodedBody.replace(/\r\n/gu, ""), "base64").toString("utf8")).toBe(VI_MESSAGE);
  });
});

describe("read confirmation route authority", () => {
  it("returns the existing confirmation id without inserting a duplicate", async () => {
    const fake = makeConfirmationClient("confirmation-existing");
    mocks.createSupabaseAdminClient.mockReturnValue(fake.client);
    const { POST } = await import("@/app/api/workpacks/[id]/read-confirmations/route");

    const response = await POST(jsonRequest(`/api/workpacks/${WORKPACK_ID}/read-confirmations`, {
      shareSessionId: SESSION_ID,
      workerId: WORKER_ID
    }), { params: Promise.resolve({ id: WORKPACK_ID }) });
    const body = await response.json() as { confirmationId: string };

    expect(body.confirmationId).toBe("confirmation-existing");
    expect(fake.insertCount()).toBe(0);
  });

  it("uses the snapshotted session worker instead of client confirmation fields", async () => {
    const fake = makeConfirmationClient(null);
    mocks.createSupabaseAdminClient.mockReturnValue(fake.client);
    const { POST } = await import("@/app/api/workpacks/[id]/read-confirmations/route");

    const response = await POST(jsonRequest(`/api/workpacks/${WORKPACK_ID}/read-confirmations`, {
      shareSessionId: SESSION_ID,
      workerId: WORKER_ID,
      displayName: "Forged Name",
      languageCode: "ko",
      workerSnapshot: { phone: "010-9999-9999" }
    }), { params: Promise.resolve({ id: WORKPACK_ID }) });

    expect(response.status).toBe(200);
    expect(fake.inserted()).toMatchObject({
      worker_id: WORKER_ID,
      worker_display_name: "Server Nguyen",
      language_code: "vi",
      worker_snapshot: serverRecipient.workerSnapshot
    });
  });

  it("reuses a concurrently inserted public recipient confirmation", async () => {
    const identity = {
      organizationId: "org-1",
      siteId: "site-1",
      workpackId: WORKPACK_ID,
      shareSessionId: SESSION_ID,
      workerId: WORKER_ID,
      workerDisplayName: "Server Nguyen",
      confirmationMethod: "button"
    };
    const confirmationId = buildReadConfirmationId(identity);
    const fake = makeConfirmationRaceClient({
      id: confirmationId,
      organization_id: identity.organizationId,
      site_id: identity.siteId,
      workpack_id: identity.workpackId,
      share_session_id: identity.shareSessionId,
      worker_id: identity.workerId,
      worker_display_name: identity.workerDisplayName,
      confirmation_method: identity.confirmationMethod
    });
    mocks.createSupabaseAdminClient.mockReturnValue(fake.client);
    const { POST } = await import("@/app/api/share-sessions/[sessionId]/route");

    const response = await POST(jsonRequest(`/api/share-sessions/${SESSION_ID}?workerId=${WORKER_ID}`, {
      recipientVerification: RECIPIENT_VERIFICATION
    }), {
      params: Promise.resolve({ sessionId: SESSION_ID })
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      confirmationId,
      idempotent: true
    });
    expect(fake.insertCount()).toBe(1);
  });

  it("rejects a public confirmation collision whose stored tenant tuple differs", async () => {
    const identity = {
      organizationId: "org-1",
      siteId: "site-1",
      workpackId: WORKPACK_ID,
      shareSessionId: SESSION_ID,
      workerId: WORKER_ID,
      workerDisplayName: "Server Nguyen",
      confirmationMethod: "button"
    };
    const fake = makeConfirmationRaceClient({
      id: buildReadConfirmationId(identity),
      organization_id: "org-other",
      site_id: identity.siteId,
      workpack_id: identity.workpackId,
      share_session_id: identity.shareSessionId,
      worker_id: identity.workerId,
      worker_display_name: identity.workerDisplayName,
      confirmation_method: identity.confirmationMethod
    });
    mocks.createSupabaseAdminClient.mockReturnValue(fake.client);
    const { POST } = await import("@/app/api/share-sessions/[sessionId]/route");

    const response = await POST(jsonRequest(`/api/share-sessions/${SESSION_ID}?workerId=${WORKER_ID}`, {
      recipientVerification: RECIPIENT_VERIFICATION
    }), {
      params: Promise.resolve({ sessionId: SESSION_ID })
    });

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({ confirmationId: null });
  });

  it("reuses the same owned confirmation when concurrent inserts collide", async () => {
    const identity = {
      organizationId: "org-1",
      siteId: "site-1",
      workpackId: WORKPACK_ID,
      shareSessionId: SESSION_ID,
      workerId: WORKER_ID,
      workerDisplayName: "Server Nguyen",
      confirmationMethod: "button"
    };
    const confirmationId = buildReadConfirmationId(identity);
    const fake = makeConfirmationRaceClient({
      id: confirmationId,
      organization_id: identity.organizationId,
      site_id: identity.siteId,
      workpack_id: identity.workpackId,
      share_session_id: identity.shareSessionId,
      worker_id: identity.workerId,
      worker_display_name: identity.workerDisplayName,
      confirmation_method: identity.confirmationMethod
    });
    mocks.createSupabaseAdminClient.mockReturnValue(fake.client);
    const { POST } = await import("@/app/api/workpacks/[id]/read-confirmations/route");

    const response = await POST(jsonRequest(`/api/workpacks/${WORKPACK_ID}/read-confirmations`, {
      shareSessionId: SESSION_ID,
      workerId: WORKER_ID
    }), { params: Promise.resolve({ id: WORKPACK_ID }) });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      confirmationId,
      idempotent: true
    });
    expect(fake.insertCount()).toBe(1);
    expect(fake.inserted()).toMatchObject({ id: confirmationId });
  });

  it("fails closed when a confirmation primary-key collision has foreign ownership", async () => {
    const identity = {
      organizationId: "org-1",
      siteId: "site-1",
      workpackId: WORKPACK_ID,
      shareSessionId: SESSION_ID,
      workerId: WORKER_ID,
      workerDisplayName: "Server Nguyen",
      confirmationMethod: "button"
    };
    const fake = makeConfirmationRaceClient({
      id: buildReadConfirmationId(identity),
      organization_id: "org-other",
      site_id: identity.siteId,
      workpack_id: identity.workpackId,
      share_session_id: identity.shareSessionId,
      worker_id: identity.workerId,
      worker_display_name: identity.workerDisplayName,
      confirmation_method: identity.confirmationMethod
    });
    mocks.createSupabaseAdminClient.mockReturnValue(fake.client);
    const { POST } = await import("@/app/api/workpacks/[id]/read-confirmations/route");

    const response = await POST(jsonRequest(`/api/workpacks/${WORKPACK_ID}/read-confirmations`, {
      shareSessionId: SESSION_ID,
      workerId: WORKER_ID
    }), { params: Promise.resolve({ id: WORKPACK_ID }) });

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({ confirmationId: null });
  });
});
