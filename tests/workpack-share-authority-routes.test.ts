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
  isLiveDispatchEnabled: vi.fn(),
  readWorkpackShareServerConfig: vi.fn(),
  readReviewedLocalizationEnvelopes: vi.fn(),
  resolveReviewedLocalizationAuthority: vi.fn(),
  buildChannelRuntimeConfiguration: vi.fn(),
  resolveServerChannelAvailability: vi.fn(),
  verifyChannelAvailabilityToken: vi.fn(),
  buildShareDispatchBinding: vi.fn(),
  buildShareRecipientDigest: vi.fn(),
  validateShareDispatchBinding: vi.fn()
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

vi.mock("@/lib/workpack-share-server-config", () => ({
  readWorkpackShareServerConfig: mocks.readWorkpackShareServerConfig
}));

vi.mock("@/lib/reviewed-localization-envelope", () => ({
  readReviewedLocalizationEnvelopes: mocks.readReviewedLocalizationEnvelopes,
  resolveReviewedLocalizationAuthority: mocks.resolveReviewedLocalizationAuthority
}));

vi.mock("@/lib/channel-availability", () => ({
  buildChannelRuntimeConfiguration: mocks.buildChannelRuntimeConfiguration,
  resolveServerChannelAvailability: mocks.resolveServerChannelAvailability,
  verifyChannelAvailabilityToken: mocks.verifyChannelAvailabilityToken,
  buildShareDispatchBinding: mocks.buildShareDispatchBinding,
  buildShareRecipientDigest: mocks.buildShareRecipientDigest,
  validateShareDispatchBinding: mocks.validateShareDispatchBinding
}));

vi.mock("@/lib/api-guard", () => ({
  enforceRateLimit: () => null
}));

const WORKPACK_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const SESSION_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const WORKER_ID = "11111111-1111-4111-8111-111111111111";

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

const serverWorkpack = {
  question: "server workpack",
  answer: "server answer",
  practicalPoints: [],
  citations: [],
  mode: "live",
  scenario: {},
  externalData: {},
  riskSummary: {},
  deliverables: {},
  status: {}
};

const channelResolution = {
  ok: true,
  version: "channel-availability/v1",
  workpackId: WORKPACK_ID,
  canonicalWorkpackRevision: "a".repeat(64),
  recipientDigest: "d".repeat(64),
  requestedChannels: ["email", "sms"],
  dispatchMode: "fixture",
  channels: [
    { channel: "email", configured: true, approved: true, available: true, recipientCount: 1, reasonCode: "available", ownerRoute: "/settings" },
    { channel: "sms", configured: true, approved: true, available: true, recipientCount: 1, reasonCode: "available", ownerRoute: "/settings" }
  ],
  configurationVersion: "channel-configuration/v2",
  configurationRevision: 7,
  configurationDigestKeyId: "channel-key-2026-07",
  configurationDigest: "e".repeat(64),
  resolvedAt: "2026-07-14T00:00:00.000Z",
  expiresAt: "2099-01-01T00:00:00.000Z",
  availabilityToken: "signed-token",
  ready: true
};

const dispatchBinding = {
  version: "share-dispatch-binding/v1",
  marker: "server-created-binding"
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
      evidenceSummary: {},
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
      organizationId: "org-1",
      siteId: "site-1",
      workpackId: WORKPACK_ID,
      createdBy: "user-1",
      recipients: [serverRecipient],
      expiresAt: "2099-01-01T00:00:00.000Z",
      accessPolicy: { dispatchBinding },
      dispatchBinding
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
                const row = value as { id?: string; expires_at?: string };
                return { single: async () => ({ data: { id: row.id, expires_at: row.expires_at }, error: null }) };
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
  mocks.readWorkpackShareServerConfig.mockReturnValue({
    ok: true,
    config: {
      channelConfigurationRevision: 7,
      channelConfigurationDigestKeyId: "channel-key-2026-07",
      channelAvailabilitySecret: "availability-secret-abcdefghijklmnopqrstuvwxyz-01",
      channelConfigurationBindingSecret: "binding-secret-abcdefghijklmnopqrstuvwxyz-02",
      reviewedLocalizationSecret: "localization-secret-abcdefghijklmnopqrstuvwxyz-03"
    }
  });
  mocks.readReviewedLocalizationEnvelopes.mockReturnValue({});
  mocks.resolveReviewedLocalizationAuthority.mockReturnValue({
    ok: true,
    canonicalWorkpackRevision: "a".repeat(64),
    normalizedWorkpackDigest: "b".repeat(64),
    localePayloadDigest: "c".repeat(64),
    dispatchRecipients: [],
    verifiedEnvelopes: {}
  });
  mocks.buildChannelRuntimeConfiguration.mockReturnValue({ dispatchMode: "fixture" });
  mocks.resolveServerChannelAvailability.mockReturnValue(channelResolution);
  mocks.verifyChannelAvailabilityToken.mockReturnValue({ ok: true, resolution: channelResolution });
  mocks.buildShareDispatchBinding.mockReturnValue(dispatchBinding);
  mocks.buildShareRecipientDigest.mockReturnValue("d".repeat(64));
  mocks.validateShareDispatchBinding.mockReturnValue({ ok: true, binding: dispatchBinding });
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
      }],
      channels: ["email", "sms"],
      canonicalWorkpackRevision: "a".repeat(64),
      availabilityToken: "signed-token"
    }), { params: Promise.resolve({ id: WORKPACK_ID }) });

    expect(response.status).toBe(200);
    expect(mocks.loadServerShareRecipients).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      requestedWorkerIds: [WORKER_ID]
    }));
    expect(fake.inserted()).toMatchObject({
      id: expect.stringMatching(/^[0-9a-f-]{36}$/i),
      recipients_snapshot: [serverRecipient],
      access_policy: expect.objectContaining({ dispatchBinding })
    });
    const inserted = fake.inserted() as {
      expires_at?: string;
      status: string;
      share_scope: string;
      access_policy: { anonymousAllowed?: boolean; dispatchBinding?: unknown };
      recipients_snapshot: Array<typeof serverRecipient>;
    };
    expect(Date.parse(inserted.expires_at || "")).toBeGreaterThan(Date.now());
    const body = await response.json() as { expiresAt?: string };
    expect(body.expiresAt).toBe(inserted.expires_at);
    expect(body).toMatchObject({ shareSessionId: (fake.inserted() as { id: string }).id });
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

  it("stops before provider dispatch when the persisted session binding is stale", async () => {
    mocks.createSupabaseAdminClient.mockReturnValue({});
    mocks.validateShareDispatchBinding.mockReturnValueOnce({
      ok: false,
      reasonCode: "channel_configuration_changed"
    });
    const { POST } = await import("@/app/api/workflow/dispatch/route");

    const response = await POST(jsonRequest("/api/workflow/dispatch", {
      workpackId: WORKPACK_ID,
      shareSessionId: SESSION_ID,
      idempotencyKey: "provider-dispatch-v1-44444444-4444-4444-8444-444444444444-deadbeef",
      channels: ["email", "sms"],
      operatorNote: "server authority"
    }));
    const body = await response.json() as Record<string, unknown>;

    expect(response.status).toBe(409);
    expect(body).toMatchObject({
      ok: false,
      state: "stale",
      reasonCode: "channel_configuration_changed",
      providerCalled: false
    });
    expect(mocks.postWebhookWithTimeout).not.toHaveBeenCalled();
  });
});

describe("workflow dispatch route authority", () => {
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
      operatorNote: "server authority"
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
      operatorNote: "fixture validation"
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
