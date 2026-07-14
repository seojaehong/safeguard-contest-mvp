import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createSupabaseAdminClient: vi.fn(),
  getWorkspaceUser: vi.fn(),
  loadOwnedWorkpackOperationContext: vi.fn()
}));

vi.mock("@/lib/supabase-admin", () => ({
  createSupabaseAdminClient: mocks.createSupabaseAdminClient,
  getWorkspaceUser: mocks.getWorkspaceUser,
  ensureWorkspaceContext: vi.fn().mockResolvedValue({ organizationId: "org-1", siteId: "site-1" }),
  toJson: (value: unknown) => value
}));

vi.mock("@/lib/workpack-commercial-store", () => ({
  loadOwnedWorkpackOperationContext: mocks.loadOwnedWorkpackOperationContext
}));

const WORKPACK_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

function request(body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/dispatch-logs", {
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
  mocks.createSupabaseAdminClient.mockReturnValue({ from: vi.fn() });
  mocks.getWorkspaceUser.mockResolvedValue({ id: "user-1", email: "owner@example.com" });
  mocks.loadOwnedWorkpackOperationContext.mockResolvedValue({
    ok: true,
    context: {
      organizationId: "org-1",
      siteId: "site-1",
      workpackId: WORKPACK_ID
    }
  });
});

describe("dispatch log persistence authority", () => {
  it("rejects client-authored provider, status and payload evidence", async () => {
    const { POST } = await import("@/app/api/dispatch-logs/route");

    const response = await POST(request({
      workpackId: WORKPACK_ID,
      logs: [{
        channel: "sms",
        targetLabel: "Nguyen",
        languageCode: "vi",
        provider: "safe-fixture",
        providerStatus: "accepted",
        payload: { shareSessionId: "33333333-3333-4333-8333-333333333333" }
      }]
    }));
    const body = await response.json() as { reasonCode?: string; savedCount?: number; logIds?: string[] };

    expect(response.status).toBe(409);
    expect(body.reasonCode).toBe("server_dispatch_receipt_required");
    expect(body.savedCount).toBe(0);
    expect(body.logIds).toEqual([]);
    expect(mocks.loadOwnedWorkpackOperationContext).not.toHaveBeenCalled();
    expect(mocks.createSupabaseAdminClient.mock.results[0]?.value.from).not.toHaveBeenCalled();
  });
});
