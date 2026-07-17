import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createSupabaseAdminClient: vi.fn(),
  getWorkspaceUser: vi.fn(),
}));

vi.mock("@/lib/supabase-admin", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/supabase-admin")>();
  return {
    ...actual,
    createSupabaseAdminClient: mocks.createSupabaseAdminClient,
    getWorkspaceUser: mocks.getWorkspaceUser,
  };
});

type QueryResult = {
  data: Record<string, unknown> | null;
  error: { message: string } | null;
};

function request(overrides: Record<string, unknown> = {}): NextRequest {
  return new NextRequest("http://localhost/api/knowledge/ingest", {
    method: "POST",
    headers: {
      authorization: "Bearer test-token",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      siteId: "site-1",
      source: "manual",
      sourceId: "event-1",
      capturedAt: "2026-07-17T00:00:00.000Z",
      title: "이동식 비계 작업 검토",
      reflectedDocuments: ["위험성평가표"],
      ...overrides,
    }),
  });
}

function fakeClient(options: {
  site?: QueryResult;
  organization?: QueryResult;
  existingEvent?: QueryResult;
} = {}) {
  const writes: Array<{ table: string; payload: unknown }> = [];

  return {
    client: {
      from(table: string) {
        if (table === "sites" || table === "organizations") {
          const result = table === "sites"
            ? options.site ?? { data: { id: "site-1", organization_id: "org-1" }, error: null }
            : options.organization ?? { data: { id: "org-1" }, error: null };
          const query = {
            select: () => query,
            eq: () => query,
            maybeSingle: async () => result,
          };
          return query;
        }

        if (table === "knowledge_events") {
          const query = {
            select: () => query,
            eq: () => query,
            maybeSingle: async () => options.existingEvent ?? { data: null, error: null },
            upsert(payload: unknown) {
              writes.push({ table, payload });
              return {
                select: () => ({
                  single: async () => ({ data: { id: "event-db-1" }, error: null }),
                }),
              };
            },
            insert(payload: unknown) {
              writes.push({ table, payload });
              return {
                select: () => ({
                  single: async () => ({ data: { id: "event-db-1" }, error: null }),
                }),
              };
            },
            update(payload: unknown) {
              writes.push({ table, payload });
              return query;
            },
            single: async () => ({ data: { id: "event-db-1" }, error: null }),
          };
          return query;
        }

        if (table === "knowledge_regeneration_runs") {
          return {
            insert(payload: unknown) {
              writes.push({ table, payload });
              return {
                select: () => ({
                  single: async () => ({ data: { id: "run-db-1" }, error: null }),
                }),
              };
            },
          };
        }

        throw new Error(`Unexpected table ${table}`);
      },
    },
    writes,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getWorkspaceUser.mockResolvedValue({ id: "user-1", email: "owner@example.com" });
});

describe("knowledge ingest tenant binding", () => {
  it("rejects an otherwise valid event when siteId is missing", async () => {
    const fake = fakeClient();
    mocks.createSupabaseAdminClient.mockReturnValue(fake.client);
    const { POST } = await import("@/app/api/knowledge/ingest/route");

    const response = await POST(request({ siteId: undefined }));

    expect(response.status).toBe(400);
    expect(fake.writes).toEqual([]);
  });

  it("fails closed when the persistent store is not configured", async () => {
    mocks.createSupabaseAdminClient.mockReturnValue(null);
    const { POST } = await import("@/app/api/knowledge/ingest/route");

    const response = await POST(request());

    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({ ok: false, configured: false });
  });

  it("rejects an unauthenticated ingest before ownership lookup or writes", async () => {
    const fake = fakeClient();
    mocks.createSupabaseAdminClient.mockReturnValue(fake.client);
    mocks.getWorkspaceUser.mockResolvedValue(null);
    const { POST } = await import("@/app/api/knowledge/ingest/route");

    const response = await POST(request());

    expect(response.status).toBe(401);
    expect(fake.writes).toEqual([]);
  });

  it("rejects a site whose organization is not owned by the authenticated user", async () => {
    const fake = fakeClient({
      site: { data: { id: "site-1", organization_id: "org-foreign" }, error: null },
      organization: { data: null, error: null },
    });
    mocks.createSupabaseAdminClient.mockReturnValue(fake.client);
    const { POST } = await import("@/app/api/knowledge/ingest/route");

    const response = await POST(request());

    expect(response.status).toBe(404);
    expect(fake.writes).toEqual([]);
  });

  it("rejects an explicit organizationId that contradicts the owned site", async () => {
    const fake = fakeClient();
    mocks.createSupabaseAdminClient.mockReturnValue(fake.client);
    const { POST } = await import("@/app/api/knowledge/ingest/route");

    const response = await POST(request({ organizationId: "org-foreign" }));

    expect(response.status).toBe(404);
    expect(fake.writes).toEqual([]);
  });

  it("rejects a source identity already attributed to another site in the organization", async () => {
    const fake = fakeClient({
      existingEvent: {
        data: { id: "event-existing", site_id: "site-other" },
        error: null,
      },
    });
    mocks.createSupabaseAdminClient.mockReturnValue(fake.client);
    const { POST } = await import("@/app/api/knowledge/ingest/route");

    const response = await POST(request());

    expect(response.status).toBe(409);
    expect(fake.writes).toEqual([]);
  });

  it("persists both rows with the authenticated site's organization and site", async () => {
    const fake = fakeClient();
    mocks.createSupabaseAdminClient.mockReturnValue(fake.client);
    const { POST } = await import("@/app/api/knowledge/ingest/route");

    const response = await POST(request({ organizationId: "org-1" }));

    expect(response.status).toBe(200);
    expect(fake.writes).toHaveLength(2);
    expect(fake.writes[0]).toMatchObject({
      table: "knowledge_events",
      payload: { organization_id: "org-1", site_id: "site-1", created_by: "user-1" },
    });
    expect(fake.writes[1]).toMatchObject({
      table: "knowledge_regeneration_runs",
      payload: { organization_id: "org-1", site_id: "site-1", created_by: "user-1" },
    });
    expect(await response.json()).toMatchObject({
      ok: true,
      storageMode: "persistent",
      savedEventId: "event-db-1",
      savedRunId: "run-db-1",
    });
  });

  it("reuses an existing same-site event without changing its attribution", async () => {
    const fake = fakeClient({
      existingEvent: {
        data: { id: "event-existing", site_id: "site-1" },
        error: null,
      },
    });
    mocks.createSupabaseAdminClient.mockReturnValue(fake.client);
    const { POST } = await import("@/app/api/knowledge/ingest/route");

    const response = await POST(request());
    const payload = await response.json() as Record<string, unknown>;

    expect(response.status).toBe(200);
    expect(fake.writes).toHaveLength(1);
    expect(fake.writes[0]).toMatchObject({ table: "knowledge_regeneration_runs" });
    expect(payload.savedEventId).toBe("event-existing");
  });
});
