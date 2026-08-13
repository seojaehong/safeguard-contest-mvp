import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createSupabaseAdminClient: vi.fn(),
  getWorkspaceUser: vi.fn(),
}));

vi.mock("@/lib/supabase-admin", () => ({
  createSupabaseAdminClient: mocks.createSupabaseAdminClient,
  getWorkspaceUser: mocks.getWorkspaceUser,
}));

function request(): NextRequest {
  return new NextRequest("http://localhost/api/dispatch-logs", {
    method: "POST",
    headers: {
      authorization: "Bearer test-token",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      workpackId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      idempotencyKey: "dispatch-v1-44444444-4444-4444-8444-444444444444-deadbeef",
      logs: [{
        channel: "email",
        provider: "attacker-controlled-provider",
        providerStatus: "sent",
        workflowRunId: "attacker-controlled-receipt",
      }],
    }),
  });
}

function fakeClient() {
  const from = vi.fn(() => ({ insert: vi.fn() }));
  return { client: { from }, from };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getWorkspaceUser.mockResolvedValue({ id: "user-1", email: "owner@example.com" });
});

describe("dispatch log provider receipt boundary", () => {
  it("fails closed when the persistent store is unavailable", async () => {
    mocks.createSupabaseAdminClient.mockReturnValue(null);
    const { POST } = await import("@/app/api/dispatch-logs/route");

    const response = await POST(request());

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ ok: false, configured: false, savedCount: 0 });
  });

  it("rejects unauthenticated archive writes", async () => {
    const fake = fakeClient();
    mocks.createSupabaseAdminClient.mockReturnValue(fake.client);
    mocks.getWorkspaceUser.mockResolvedValue(null);
    const { POST } = await import("@/app/api/dispatch-logs/route");

    const response = await POST(request());

    expect(response.status).toBe(401);
    expect(fake.from).not.toHaveBeenCalled();
  });

  it("rejects client-asserted provider outcomes before any database write", async () => {
    const fake = fakeClient();
    mocks.createSupabaseAdminClient.mockReturnValue(fake.client);
    const { POST } = await import("@/app/api/dispatch-logs/route");

    const response = await POST(request());
    const body = await response.json() as Record<string, unknown>;

    expect(response.status).toBe(409);
    expect(body).toMatchObject({
      ok: false,
      savedCount: 0,
      code: "dispatch_log_server_receipt_required",
      providerDispatchIdempotencySupported: false,
    });
    expect(fake.from).not.toHaveBeenCalled();
  });
});
