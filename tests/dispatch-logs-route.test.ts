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
const LOG_ID = "99999999-9999-4999-8999-999999999999";

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
  const insertResult = {
    error: null,
    select: vi.fn().mockResolvedValue({ data: [{ id: LOG_ID }], error: null })
  };
  mocks.createSupabaseAdminClient.mockReturnValue({
    from: vi.fn((table: string) => {
      if (table !== "dispatch_logs") throw new Error(`Unexpected table ${table}`);
      return { insert: vi.fn(() => insertResult) };
    })
  });
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
  it("returns selected row IDs and never treats savedCount alone as persistence proof", async () => {
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
    const body = await response.json() as { savedCount?: number; logIds?: string[] };

    expect(response.status).toBe(200);
    expect(body.savedCount).toBe(1);
    expect(body.logIds).toEqual([LOG_ID]);
  });

  it("fails closed when insert succeeds without returned row IDs", async () => {
    const client = {
      from: vi.fn(() => ({
        insert: vi.fn(() => ({
          select: vi.fn().mockResolvedValue({ data: [], error: null })
        }))
      }))
    };
    mocks.createSupabaseAdminClient.mockReturnValueOnce(client);
    const { POST } = await import("@/app/api/dispatch-logs/route");

    const response = await POST(request({
      workpackId: WORKPACK_ID,
      logs: [{ channel: "email", providerStatus: "unknown" }]
    }));
    const body = await response.json() as { savedCount?: number; logIds?: string[] };

    expect(response.status).toBe(500);
    expect(body.savedCount).toBe(0);
    expect(body.logIds).toEqual([]);
  });
});
