import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  resolveAuthenticatedShareChannels,
  WorkflowShareRequestError
} from "@/lib/workflow-share-client";

const mocks = vi.hoisted(() => ({
  createSupabaseAdminClient: vi.fn(),
  getWorkspaceUser: vi.fn(),
  loadOwnedWorkpackOperationContext: vi.fn(),
  loadServerShareRecipients: vi.fn(),
  resolveReviewedLocalizationAuthority: vi.fn(),
  readReviewedLocalizationEnvelopes: vi.fn(),
  resolveWebhookConfig: vi.fn(),
  isLiveDispatchEnabled: vi.fn()
}));

vi.mock("@/lib/supabase-admin", () => ({
  createSupabaseAdminClient: mocks.createSupabaseAdminClient,
  getWorkspaceUser: mocks.getWorkspaceUser
}));

vi.mock("@/lib/workpack-commercial-store", () => ({
  loadOwnedWorkpackOperationContext: mocks.loadOwnedWorkpackOperationContext,
  loadServerShareRecipients: mocks.loadServerShareRecipients
}));

vi.mock("@/lib/reviewed-localization-envelope", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/reviewed-localization-envelope")>();
  return {
    ...actual,
    resolveReviewedLocalizationAuthority: mocks.resolveReviewedLocalizationAuthority,
    readReviewedLocalizationEnvelopes: mocks.readReviewedLocalizationEnvelopes
  };
});

vi.mock("@/lib/n8n-webhook", () => ({
  resolveWebhookConfig: mocks.resolveWebhookConfig,
  isLiveDispatchEnabled: mocks.isLiveDispatchEnabled
}));

const WORKPACK_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const WORKER_ID = "11111111-1111-4111-8111-111111111111";

function request(body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/settings/channels/resolve", {
    method: "POST",
    headers: {
      authorization: "Bearer test-token",
      "content-type": "application/json"
    },
    body: JSON.stringify(body)
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.SAFECLAW_CHANNEL_CONFIG_REVISION = "7";
  process.env.SAFECLAW_CHANNEL_CONFIG_DIGEST_KEY_ID = "channel-key-2026-07";
  process.env.SAFECLAW_CHANNEL_AVAILABILITY_SECRET = "availability-secret-abcdefghijklmnopqrstuvwxyz-01";
  process.env.SAFECLAW_CHANNEL_CONFIG_BINDING_SECRET = "binding-secret-abcdefghijklmnopqrstuvwxyz-02";
  process.env.SAFECLAW_REVIEWED_LOCALIZATION_SECRET = "localization-secret-abcdefghijklmnopqrstuvwxyz-03";
  mocks.createSupabaseAdminClient.mockReturnValue({});
  mocks.getWorkspaceUser.mockResolvedValue({ id: "user-1", email: "owner@example.com" });
  mocks.loadOwnedWorkpackOperationContext.mockResolvedValue({
    ok: true,
    context: {
      organizationId: "org-1",
      siteId: "site-1",
      workpackId: WORKPACK_ID,
      question: "server workpack",
      generatedAt: "2026-07-14T00:00:00.000Z",
      evidenceSummary: {},
      shareAuthority: {
        workpack: { question: "server" },
        readiness: { canShare: true, status: "ready", summary: "공유 준비됨", reasons: [] }
      }
    }
  });
  mocks.loadServerShareRecipients.mockResolvedValue({
    ok: true,
    recipients: [{
      workerId: WORKER_ID,
      displayName: "Nguyen",
      languageCode: "vi",
      role: "viewer",
      workerSnapshot: {
        workerId: WORKER_ID,
        displayName: "Nguyen",
        languageCode: "vi",
        phone: "010-1111-2222",
        email: "nguyen@example.com"
      }
    }]
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
  mocks.resolveWebhookConfig.mockReturnValue({ url: "https://relay.example/hook", token: "relay-token" });
  mocks.isLiveDispatchEnabled.mockReturnValue(true);
});

describe("channel availability route", () => {
  it("uses the requestedChannels DTO through the actual client and route handler", async () => {
    const { POST } = await import("@/app/api/settings/channels/resolve/route");
    const routeFetcher = async (input: string, init: RequestInit): Promise<Response> => POST(new NextRequest(
      `http://localhost${input}`,
      { method: init.method, headers: init.headers, body: init.body }
    ));

    const resolution = await resolveAuthenticatedShareChannels(routeFetcher, {
      authToken: "test-token",
      workpackId: WORKPACK_ID,
      canonicalWorkpackRevision: "a".repeat(64),
      workerIds: [WORKER_ID],
      requestedChannels: ["email", "sms"]
    });

    expect(resolution.ready).toBe(true);
    expect(resolution.availabilityToken).toBeTruthy();
    expect(resolution.requestedChannels).toEqual(["email", "sms"]);
    expect(mocks.loadServerShareRecipients).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      requestedWorkerIds: [WORKER_ID]
    }));
    expect(JSON.stringify(resolution)).not.toContain("availability-secret");
    expect(JSON.stringify(resolution)).not.toContain("binding-secret");
  });

  it("returns the split worker-language blocker without creating a fallback token", async () => {
    mocks.resolveReviewedLocalizationAuthority.mockReturnValueOnce({
      ok: false,
      reasonCode: "recipient_locale_invalid",
      owner: "workers",
      validatedSupportedCode: "vi"
    });
    const { POST } = await import("@/app/api/settings/channels/resolve/route");

    const response = await POST(request({
      workpackId: WORKPACK_ID,
      canonicalWorkpackRevision: "a".repeat(64),
      recipients: [WORKER_ID],
      requestedChannels: ["sms"]
    }));
    const body = await response.json() as Record<string, unknown>;

    expect(response.status).toBe(409);
    expect(body).toMatchObject({
      ok: false,
      reasonCode: "recipient_locale_invalid",
      owner: "workers"
    });
    expect(body.availabilityToken).toBeUndefined();
  });

  it("preserves typed locale ownership through the actual route and client without downstream calls", async () => {
    mocks.resolveReviewedLocalizationAuthority.mockReturnValueOnce({
      ok: false,
      reasonCode: "translation_incomplete",
      owner: "document",
      validatedSupportedCode: "vi"
    });
    const { POST } = await import("@/app/api/settings/channels/resolve/route");
    const paths: string[] = [];
    const routeFetcher = async (input: string, init: RequestInit): Promise<Response> => {
      paths.push(input);
      return POST(new NextRequest(`http://localhost${input}`, {
        method: init.method,
        headers: init.headers,
        body: init.body
      }));
    };

    let failure: unknown;
    try {
      await resolveAuthenticatedShareChannels(routeFetcher, {
        authToken: "test-token",
        workpackId: WORKPACK_ID,
        canonicalWorkpackRevision: "a".repeat(64),
        workerIds: [WORKER_ID],
        requestedChannels: ["sms"]
      });
    } catch (error) {
      failure = error;
    }

    expect(failure).toBeInstanceOf(WorkflowShareRequestError);
    expect(failure).toMatchObject({
      status: 409,
      reasonCode: "translation_incomplete",
      owner: "document",
      validatedLanguage: "vi"
    });
    expect(paths).toEqual(["/api/settings/channels/resolve"]);
  });
});
