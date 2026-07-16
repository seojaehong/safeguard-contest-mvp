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

const WORKPACK_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const WORKER_ID = "11111111-1111-4111-8111-111111111111";

type OwnedRow = {
  id: string;
  organization_id: string;
  site_id: string | null;
};

type LookupResult<T> = {
  data: T;
  error: { message: string } | null;
};

function requestBody(options: {
  workpackId?: string;
  workerDatabaseId?: string;
} = {}): NextRequest {
  return new NextRequest("http://localhost/api/education-records", {
    method: "POST",
    headers: {
      authorization: "Bearer test-token",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      ...(options.workpackId ? { workpackId: options.workpackId } : {}),
      scenario: { region: "서울" },
      records: [{ workerId: "worker-local", topic: "작업 전 TBM" }],
      workers: [{ id: "worker-local", displayName: "작업자 A" }],
      workerMap: options.workerDatabaseId
        ? { "worker-local": options.workerDatabaseId }
        : {},
    }),
  });
}

function fakeClient(options: {
  workpack?: LookupResult<OwnedRow | null>;
  workers?: LookupResult<OwnedRow[]>;
}) {
  let inserted: unknown = null;
  const calls: Array<{ table: string; method: string; args: unknown[] }> = [];

  return {
    client: {
      from(table: string) {
        if (table === "education_records") {
          return {
            insert: async (payload: unknown) => {
              inserted = payload;
              return { error: null };
            },
          };
        }

        if (table === "workpacks") {
          const query = {
            select(...args: unknown[]) { calls.push({ table, method: "select", args }); return query; },
            eq(...args: unknown[]) { calls.push({ table, method: "eq", args }); return query; },
            maybeSingle: async () => options.workpack ?? { data: null, error: null },
          };
          return query;
        }

        if (table === "workers") {
          const result = options.workers ?? { data: [], error: null };
          const query = {
            select(...args: unknown[]) { calls.push({ table, method: "select", args }); return query; },
            in(...args: unknown[]) { calls.push({ table, method: "in", args }); return query; },
            eq(...args: unknown[]) { calls.push({ table, method: "eq", args }); return query; },
            then<TResult1 = LookupResult<OwnedRow[]>, TResult2 = never>(
              onFulfilled?: ((value: LookupResult<OwnedRow[]>) => TResult1 | PromiseLike<TResult1>) | null,
              onRejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
            ) {
              return Promise.resolve(result).then(onFulfilled, onRejected);
            },
          };
          return query;
        }

        throw new Error(`Unexpected table ${table}`);
      },
    },
    calls: () => calls,
    inserted: () => inserted,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getWorkspaceUser.mockResolvedValue({ id: "user-1", email: "owner@example.com" });
  mocks.ensureWorkspaceContext.mockResolvedValue({ organizationId: "org-1", siteId: "site-1" });
});

describe("education record tenant boundary", () => {
  it("rejects a workpack outside the resolved organization and site", async () => {
    const fake = fakeClient({ workpack: { data: null, error: null } });
    mocks.createSupabaseAdminClient.mockReturnValue(fake.client);
    const { POST } = await import("@/app/api/education-records/route");

    const response = await POST(requestBody({ workpackId: WORKPACK_ID }));

    expect(response.status).toBe(404);
    expect(fake.inserted()).toBeNull();
  });

  it("rejects a worker outside the resolved organization and site", async () => {
    const fake = fakeClient({ workers: { data: [], error: null } });
    mocks.createSupabaseAdminClient.mockReturnValue(fake.client);
    const { POST } = await import("@/app/api/education-records/route");

    const response = await POST(requestBody({ workerDatabaseId: WORKER_ID }));

    expect(response.status).toBe(404);
    expect(fake.inserted()).toBeNull();
  });

  it.each([
    ["organization", { id: WORKPACK_ID, organization_id: "org-foreign", site_id: "site-1" }],
    ["site", { id: WORKPACK_ID, organization_id: "org-1", site_id: "site-foreign" }],
  ])("rejects a returned workpack whose %s binding contradicts the context", async (_binding, data) => {
    const fake = fakeClient({ workpack: { data, error: null } });
    mocks.createSupabaseAdminClient.mockReturnValue(fake.client);
    const { POST } = await import("@/app/api/education-records/route");

    const response = await POST(requestBody({ workpackId: WORKPACK_ID }));

    expect(response.status).toBe(404);
    expect(fake.inserted()).toBeNull();
  });

  it.each([
    ["organization", { id: WORKER_ID, organization_id: "org-foreign", site_id: "site-1" }],
    ["site", { id: WORKER_ID, organization_id: "org-1", site_id: "site-foreign" }],
  ])("rejects a returned worker whose %s binding contradicts the context", async (_binding, worker) => {
    const fake = fakeClient({ workers: { data: [worker], error: null } });
    mocks.createSupabaseAdminClient.mockReturnValue(fake.client);
    const { POST } = await import("@/app/api/education-records/route");

    const response = await POST(requestBody({ workerDatabaseId: WORKER_ID }));

    expect(response.status).toBe(404);
    expect(fake.inserted()).toBeNull();
  });

  it.each([
    ["workpack", { workpackId: "invalid-id" }],
    ["worker", { workerDatabaseId: "invalid-id" }],
  ])("rejects a malformed %s UUID before resolving workspace context", async (_label, input) => {
    const fake = fakeClient({});
    mocks.createSupabaseAdminClient.mockReturnValue(fake.client);
    const { POST } = await import("@/app/api/education-records/route");

    const response = await POST(requestBody(input));

    expect(response.status).toBe(400);
    expect(mocks.ensureWorkspaceContext).not.toHaveBeenCalled();
    expect(fake.inserted()).toBeNull();
  });

  it("fails closed when a relationship lookup fails", async () => {
    const fake = fakeClient({
      workpack: { data: null, error: { message: "lookup failed" } },
    });
    mocks.createSupabaseAdminClient.mockReturnValue(fake.client);
    const { POST } = await import("@/app/api/education-records/route");

    const response = await POST(requestBody({ workpackId: WORKPACK_ID }));

    expect(response.status).toBe(500);
    expect(fake.inserted()).toBeNull();
  });

  it("fails closed when worker ownership lookup fails", async () => {
    const fake = fakeClient({ workers: { data: [], error: { message: "lookup failed" } } });
    mocks.createSupabaseAdminClient.mockReturnValue(fake.client);
    const { POST } = await import("@/app/api/education-records/route");

    const response = await POST(requestBody({ workerDatabaseId: WORKER_ID }));

    expect(response.status).toBe(500);
    expect(fake.inserted()).toBeNull();
  });

  it("persists only same-organization and same-site relationships", async () => {
    const ownedWorkpack = { id: WORKPACK_ID, organization_id: "org-1", site_id: "site-1" };
    const ownedWorker = { id: WORKER_ID, organization_id: "org-1", site_id: "site-1" };
    const fake = fakeClient({
      workpack: { data: ownedWorkpack, error: null },
      workers: { data: [ownedWorker], error: null },
    });
    mocks.createSupabaseAdminClient.mockReturnValue(fake.client);
    const { POST } = await import("@/app/api/education-records/route");

    const response = await POST(requestBody({
      workpackId: WORKPACK_ID,
      workerDatabaseId: WORKER_ID,
    }));

    expect(response.status).toBe(200);
    expect(fake.calls()).toEqual(expect.arrayContaining([
      { table: "workpacks", method: "eq", args: ["id", WORKPACK_ID] },
      { table: "workpacks", method: "eq", args: ["organization_id", "org-1"] },
      { table: "workpacks", method: "eq", args: ["site_id", "site-1"] },
      { table: "workers", method: "in", args: ["id", [WORKER_ID]] },
      { table: "workers", method: "eq", args: ["organization_id", "org-1"] },
      { table: "workers", method: "eq", args: ["site_id", "site-1"] },
    ]));
    expect(fake.inserted()).toEqual([
      expect.objectContaining({
        organization_id: "org-1",
        site_id: "site-1",
        workpack_id: WORKPACK_ID,
        worker_id: WORKER_ID,
      }),
    ]);
  });

  it("preserves records with no workpack or persisted worker reference", async () => {
    const fake = fakeClient({});
    mocks.createSupabaseAdminClient.mockReturnValue(fake.client);
    const { POST } = await import("@/app/api/education-records/route");

    const response = await POST(requestBody());

    expect(response.status).toBe(200);
    expect(fake.calls()).toEqual([]);
    expect(fake.inserted()).toEqual([
      expect.objectContaining({ workpack_id: null, worker_id: null }),
    ]);
  });
});
