import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { evaluateShareSessionReuse } from "@/components/WorkflowSharePolicy";

const mocks = vi.hoisted(() => ({
  createSupabaseAdminClient: vi.fn(),
  getWorkspaceUser: vi.fn(),
  loadOwnedWorkpackOperationContext: vi.fn(),
  loadServerShareRecipients: vi.fn(),
  loadActiveOwnedShareSession: vi.fn(),
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
  loadActiveOwnedShareSession: mocks.loadActiveOwnedShareSession
}));

vi.mock("@/lib/n8n-webhook", () => ({
  postWebhookWithTimeout: mocks.postWebhookWithTimeout,
  resolveWebhookConfig: mocks.resolveWebhookConfig,
  isLiveDispatchEnabled: mocks.isLiveDispatchEnabled
}));

vi.mock("@/lib/api-guard", () => ({
  enforceRateLimit: () => null
}));

const WORKPACK_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const SESSION_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const WORKER_ID = "11111111-1111-4111-8111-111111111111";
const KOREAN_WORKER_ID = "22222222-2222-4222-8222-222222222222";
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

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getWorkspaceUser.mockResolvedValue({ id: "user-1", email: "owner@example.com" });
  mocks.loadOwnedWorkpackOperationContext.mockResolvedValue(ownedContext());
  mocks.loadServerShareRecipients.mockResolvedValue({ ok: true, recipients: [serverRecipient] });
  mocks.loadActiveOwnedShareSession.mockResolvedValue(activeSession());
  mocks.resolveWebhookConfig.mockReturnValue({ url: "https://n8n.example/webhook", token: "secret" });
  mocks.isLiveDispatchEnabled.mockReturnValue(true);
  mocks.postWebhookWithTimeout.mockResolvedValue({ ok: true, workflowRunId: "run-1", channelResults: [] });
});

describe("share session route authority", () => {
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
});

describe("workflow dispatch route authority", () => {
  it("builds an exact minimal provider DTO for each canonical recipient message", async () => {
    const { buildLocalizedDispatchRecipients } = await import("@/app/api/workflow/dispatch/route");

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
          message: VI_MESSAGE
        },
        {
          workerId: KOREAN_WORKER_ID,
          phone: "010-3333-4444",
          dispatchLanguageCode: "ko",
          message: KO_MESSAGE
        }
      ]
    });
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
    };

    expect(response.status).toBe(409);
    expect(body).toMatchObject({
      duplicateRisk: true,
      idempotencySupported: false,
      idempotencyKey: "provider-dispatch-v1-44444444-4444-4444-8444-444444444444-deadbeef",
      providerCalled: false
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
    const {
      buildLocalizedDispatchRecipients,
      buildLocalizedDispatchWebhookPayload
    } = await import("@/app/api/workflow/dispatch/route");
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

    const payload = buildLocalizedDispatchWebhookPayload({
      idempotencyKey: "provider-dispatch-v1-44444444-4444-4444-8444-444444444444-deadbeef",
      channels: ["sms"],
      recipients: localized.recipients,
      operatorNote: "TBM 후 확인",
      workpack: serverWorkpack,
      sentAt: "2026-07-15T00:00:00.000Z"
    });

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
      message: VI_MESSAGE
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
});
