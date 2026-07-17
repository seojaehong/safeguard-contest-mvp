import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createSupabaseAdminClient: vi.fn(),
  ensureWorkspaceContext: vi.fn(),
  getWorkspaceUser: vi.fn(),
}));

vi.mock("@/lib/supabase-admin", () => ({
  createSupabaseAdminClient: mocks.createSupabaseAdminClient,
  ensureWorkspaceContext: mocks.ensureWorkspaceContext,
  getWorkspaceUser: mocks.getWorkspaceUser,
  toJson: (value: unknown) => value,
}));

const OWNED_WORKPACK_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const FOREIGN_WORKPACK_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const DISPATCH_LOG_IDEMPOTENCY_KEY = "dispatch-v1-44444444-4444-4444-8444-444444444444-deadbeef";

type WorkpackLookup = {
  data: { id: string; organization_id: string; site_id: string | null } | null;
  error: { message: string } | null;
};

function jsonRequest(workpackId?: string): NextRequest {
  return new NextRequest("http://localhost/api/dispatch-logs", {
    method: "POST",
    headers: {
      authorization: "Bearer test-token",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      ...(workpackId ? { workpackId } : {}),
      idempotencyKey: DISPATCH_LOG_IDEMPOTENCY_KEY,
      scenario: { region: "서울" },
      logs: [{
        channel: "sms",
        targetLabel: "작업자 A",
        payload: { idempotencyKey: "dispatch-v1-55555555-5555-4555-8555-555555555555-badf00d0" },
      }],
    }),
  });
}

function fakeClient(workpackLookup: WorkpackLookup) {
  let insertPayload: unknown = null;
  let workpackLookupCount = 0;
  const workpackFilters: Array<[string, unknown]> = [];

  return {
    client: {
      from(table: string) {
        if (table === "workpacks") {
          workpackLookupCount += 1;
          const query = {
            select() { return query; },
            eq(column: string, value: unknown) {
              workpackFilters.push([column, value]);
              return query;
            },
            maybeSingle: async () => workpackLookup,
          };
          return query;
        }
        if (table === "dispatch_logs") {
          return {
            insert: async (payload: unknown) => {
              insertPayload = payload;
              return { error: null };
            },
          };
        }
        throw new Error(`Unexpected table ${table}`);
      },
    },
    insertPayload: () => insertPayload,
    workpackLookupCount: () => workpackLookupCount,
    workpackFilters: () => workpackFilters,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getWorkspaceUser.mockResolvedValue({ id: "user-1", email: "owner@example.com" });
  mocks.ensureWorkspaceContext.mockResolvedValue({ organizationId: "org-1", siteId: "site-1" });
});

describe("dispatch log tenant boundary", () => {
  it("rejects a workpack that is not owned by the resolved organization and site", async () => {
    const fake = fakeClient({ data: null, error: null });
    mocks.createSupabaseAdminClient.mockReturnValue(fake.client);
    const { POST } = await import("@/app/api/dispatch-logs/route");

    const response = await POST(jsonRequest(FOREIGN_WORKPACK_ID));
    const body = await response.json() as { code?: string };

    expect(response.status).toBe(404);
    expect(body.code).toBe("dispatch_workpack_not_owned");
    expect(fake.insertPayload()).toBeNull();
  });

  it("fails closed when workpack ownership cannot be verified", async () => {
    const fake = fakeClient({ data: null, error: { message: "lookup failed" } });
    mocks.createSupabaseAdminClient.mockReturnValue(fake.client);
    const { POST } = await import("@/app/api/dispatch-logs/route");

    const response = await POST(jsonRequest(OWNED_WORKPACK_ID));
    const body = await response.json() as { code?: string };

    expect(response.status).toBe(500);
    expect(body.code).toBe("dispatch_workpack_verification_failed");
    expect(fake.insertPayload()).toBeNull();
  });

  it("rejects a malformed workpack identifier before querying Supabase", async () => {
    const fake = fakeClient({ data: null, error: null });
    mocks.createSupabaseAdminClient.mockReturnValue(fake.client);
    const { POST } = await import("@/app/api/dispatch-logs/route");

    const response = await POST(jsonRequest("invalid-id"));
    const body = await response.json() as { code?: string };

    expect(response.status).toBe(400);
    expect(body.code).toBe("dispatch_workpack_id_invalid");
    expect(mocks.ensureWorkspaceContext).not.toHaveBeenCalled();
    expect(fake.workpackLookupCount()).toBe(0);
    expect(fake.insertPayload()).toBeNull();
  });

  it("rejects dispatch log saves without a valid request idempotency key before querying Supabase", async () => {
    const fake = fakeClient({ data: null, error: null });
    mocks.createSupabaseAdminClient.mockReturnValue(fake.client);
    const { POST } = await import("@/app/api/dispatch-logs/route");

    const response = await POST(new NextRequest("http://localhost/api/dispatch-logs", {
      method: "POST",
      headers: {
        authorization: "Bearer test-token",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        workpackId: OWNED_WORKPACK_ID,
        scenario: { region: "서울" },
        logs: [{ channel: "sms", targetLabel: "작업자 A" }],
      }),
    }));
    const body = await response.json() as { code?: string };

    expect(response.status).toBe(400);
    expect(body.code).toBe("dispatch_log_idempotency_key_invalid");
    expect(mocks.ensureWorkspaceContext).not.toHaveBeenCalled();
    expect(fake.workpackLookupCount()).toBe(0);
    expect(fake.insertPayload()).toBeNull();
  });

  it.each([
    ["organization", { id: OWNED_WORKPACK_ID, organization_id: "org-foreign", site_id: "site-1" }],
    ["site", { id: OWNED_WORKPACK_ID, organization_id: "org-1", site_id: "site-foreign" }],
  ])("rejects a workpack whose returned %s binding contradicts the resolved context", async (_binding, data) => {
    const fake = fakeClient({ data, error: null });
    mocks.createSupabaseAdminClient.mockReturnValue(fake.client);
    const { POST } = await import("@/app/api/dispatch-logs/route");

    const response = await POST(jsonRequest(OWNED_WORKPACK_ID));

    expect(response.status).toBe(404);
    expect(fake.insertPayload()).toBeNull();
  });

  it("persists only a workpack verified for the resolved organization and site", async () => {
    const fake = fakeClient({
      data: { id: OWNED_WORKPACK_ID, organization_id: "org-1", site_id: "site-1" },
      error: null,
    });
    mocks.createSupabaseAdminClient.mockReturnValue(fake.client);
    const { POST } = await import("@/app/api/dispatch-logs/route");

    const response = await POST(jsonRequest(OWNED_WORKPACK_ID));

    expect(response.status).toBe(200);
    expect(fake.workpackFilters()).toEqual([
      ["id", OWNED_WORKPACK_ID],
      ["organization_id", "org-1"],
      ["site_id", "site-1"],
    ]);
    expect(fake.insertPayload()).toEqual([
      expect.objectContaining({
        organization_id: "org-1",
        site_id: "site-1",
        workpack_id: OWNED_WORKPACK_ID,
        payload: expect.objectContaining({
          idempotencyKey: DISPATCH_LOG_IDEMPOTENCY_KEY,
        }),
      }),
    ]);
  });

  it("preserves the existing no-workpack dispatch path without an ownership lookup", async () => {
    const fake = fakeClient({ data: null, error: null });
    mocks.createSupabaseAdminClient.mockReturnValue(fake.client);
    const { POST } = await import("@/app/api/dispatch-logs/route");

    const response = await POST(jsonRequest());

    expect(response.status).toBe(200);
    expect(fake.workpackLookupCount()).toBe(0);
    expect(fake.insertPayload()).toEqual([
      expect.objectContaining({ workpack_id: null }),
    ]);
  });
});
