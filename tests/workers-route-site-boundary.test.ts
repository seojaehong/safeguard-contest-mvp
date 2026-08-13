import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createSupabaseAdminClient: vi.fn(),
  ensureWorkspaceContext: vi.fn(),
  getWorkspaceUser: vi.fn()
}));

vi.mock("@/lib/supabase-admin", () => ({
  createSupabaseAdminClient: mocks.createSupabaseAdminClient,
  ensureWorkspaceContext: mocks.ensureWorkspaceContext,
  getWorkspaceUser: mocks.getWorkspaceUser
}));

type WorkerBinding = {
  external_key: string;
  site_id: string | null;
};

type QueryResult<T> = {
  data: T;
  error: { message: string } | null;
};

function workerRequest(): NextRequest {
  return new NextRequest("http://localhost/api/workers", {
    method: "POST",
    headers: {
      authorization: "Bearer test-token",
      "content-type": "application/json"
    },
    body: JSON.stringify({
      scenario: { companyName: "테스트 사업장", siteName: "서울 현장" },
      workers: [{ id: "worker-1", displayName: "작업자 1", role: "작업자" }]
    })
  });
}

function fakeClient(options: {
  list?: QueryResult<WorkerBinding[]>;
  lookup?: QueryResult<WorkerBinding[]>;
  upsert?: QueryResult<Array<{ id: string; external_key: string }>>;
} = {}) {
  const calls: Array<{ method: string; args: unknown[] }> = [];
  let upserted: unknown = null;

  const listQuery = {
    select(...args: unknown[]) { calls.push({ method: "select", args }); return listQuery; },
    eq(...args: unknown[]) { calls.push({ method: "eq", args }); return listQuery; },
    in: async (...args: unknown[]) => {
      calls.push({ method: "in", args });
      return options.lookup ?? { data: [], error: null };
    },
    order: async (...args: unknown[]) => {
      calls.push({ method: "order", args });
      return options.list ?? { data: [], error: null };
    }
  };

  return {
    client: {
      from(table: string) {
        if (table !== "workers") throw new Error(`Unexpected table ${table}`);
        return {
          select: listQuery.select,
          upsert(payload: unknown, ...args: unknown[]) {
            upserted = payload;
            calls.push({ method: "upsert", args });
            return {
              select: async (...selectArgs: unknown[]) => {
                calls.push({ method: "upsert.select", args: selectArgs });
                return options.upsert ?? {
                  data: [{ id: "worker-db-1", external_key: "worker-1" }],
                  error: null
                };
              }
            };
          }
        };
      }
    },
    calls: () => calls,
    upserted: () => upserted
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getWorkspaceUser.mockResolvedValue({ id: "user-1", email: "owner@example.com" });
  mocks.ensureWorkspaceContext.mockResolvedValue({ organizationId: "org-1", siteId: "site-1" });
});

describe("worker route site boundary", () => {
  it("scopes worker history to the resolved organization and site", async () => {
    const fake = fakeClient({ list: { data: [], error: null } });
    mocks.createSupabaseAdminClient.mockReturnValue(fake.client);
    const { GET } = await import("@/app/api/workers/route");

    const response = await GET(new NextRequest("http://localhost/api/workers?siteName=서울%20현장", {
      headers: { authorization: "Bearer test-token" }
    }));

    expect(response.status).toBe(200);
    expect(fake.calls()).toEqual(expect.arrayContaining([
      { method: "eq", args: ["organization_id", "org-1"] },
      { method: "eq", args: ["site_id", "site-1"] }
    ]));
  });

  it.each([
    ["another site", "site-2"],
    ["legacy unscoped storage", null]
  ])("rejects implicit worker transfer from %s", async (_label, siteId) => {
    const fake = fakeClient({
      lookup: { data: [{ external_key: "worker-1", site_id: siteId }], error: null }
    });
    mocks.createSupabaseAdminClient.mockReturnValue(fake.client);
    const { POST } = await import("@/app/api/workers/route");

    const response = await POST(workerRequest());
    const body = await response.json() as { code?: string; workerKeys?: string[] };

    expect(response.status).toBe(409);
    expect(body).toMatchObject({
      code: "WORKER_SITE_TRANSFER_REQUIRED",
      workerKeys: ["worker-1"]
    });
    expect(fake.upserted()).toBeNull();
  });

  it("fails closed when existing worker bindings cannot be checked", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const fake = fakeClient({
      lookup: { data: [], error: { message: "lookup failed" } }
    });
    mocks.createSupabaseAdminClient.mockReturnValue(fake.client);
    const { POST } = await import("@/app/api/workers/route");

    const response = await POST(workerRequest());

    expect(response.status).toBe(500);
    expect(fake.upserted()).toBeNull();
    expect(error).toHaveBeenCalled();
    error.mockRestore();
  });

  it("preserves same-site worker updates", async () => {
    const fake = fakeClient({
      lookup: { data: [{ external_key: "worker-1", site_id: "site-1" }], error: null }
    });
    mocks.createSupabaseAdminClient.mockReturnValue(fake.client);
    const { POST } = await import("@/app/api/workers/route");

    const response = await POST(workerRequest());

    expect(response.status).toBe(200);
    expect(fake.calls()).toEqual(expect.arrayContaining([
      { method: "eq", args: ["organization_id", "org-1"] },
      { method: "in", args: ["external_key", ["worker-1"]] }
    ]));
    expect(fake.upserted()).toEqual([
      expect.objectContaining({
        organization_id: "org-1",
        site_id: "site-1",
        external_key: "worker-1"
      })
    ]);
  });
});
