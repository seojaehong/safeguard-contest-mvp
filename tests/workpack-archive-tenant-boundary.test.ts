import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createSupabaseAdminClient: vi.fn(),
  getWorkspaceUser: vi.fn()
}));

vi.mock("@/lib/supabase-admin", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/supabase-admin")>();
  return {
    ...actual,
    createSupabaseAdminClient: mocks.createSupabaseAdminClient,
    getWorkspaceUser: mocks.getWorkspaceUser
  };
});

function archiveRequest(): NextRequest {
  return new NextRequest("http://localhost/api/workpacks", {
    headers: { authorization: "Bearer test-token" }
  });
}

function makeArchiveClient() {
  const siteFilters: Array<[string, unknown]> = [];
  const client = {
    from(table: string) {
      if (table === "organizations") {
        return {
          select() {
            return {
              eq: async () => ({
                data: [{ id: "org-owned", name: "Owned Org" }],
                error: null
              })
            };
          }
        };
      }
      if (table === "workpacks") {
        return {
          select() {
            return {
              in() {
                return {
                  order() {
                    return {
                      limit: async () => ({
                        data: [{
                          id: "workpack-1",
                          organization_id: "org-owned",
                          site_id: "site-foreign",
                          question: "owned workpack with stale foreign site reference",
                          scenario: {},
                          deliverables: {},
                          worker_summary: {},
                          status: {},
                          created_at: "2026-08-01T00:00:00.000Z",
                          updated_at: "2026-08-01T00:00:00.000Z"
                        }],
                        error: null
                      })
                    };
                  }
                };
              }
            };
          }
        };
      }
      if (table === "sites") {
        const query = {
          select() {
            return query;
          },
          in(column: string, value: unknown) {
            siteFilters.push([column, value]);
            return query;
          },
          then(resolve: (value: { data: unknown[]; error: null }) => void) {
            const hasOwnedOrganizationFilter = siteFilters.some(([column, value]) => (
              column === "organization_id"
              && Array.isArray(value)
              && value.includes("org-owned")
            ));
            resolve({
              data: hasOwnedOrganizationFilter
                ? []
                : [{
                  id: "site-foreign",
                  name: "Foreign Site",
                  industry: "foreign industry",
                  region: "foreign region",
                  organization_id: "org-foreign"
                }],
              error: null
            });
          }
        };
        return query;
      }
      throw new Error(`Unexpected table ${table}`);
    }
  };

  return {
    client,
    siteFilters: () => siteFilters
  };
}

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  mocks.getWorkspaceUser.mockResolvedValue({ id: "user-1", email: "owner@example.com" });
});

describe("workpack archive tenant boundary", () => {
  it("does not enrich owned archive rows with a foreign site UUID", async () => {
    const fake = makeArchiveClient();
    mocks.createSupabaseAdminClient.mockReturnValue(fake.client);
    const { GET } = await import("@/app/api/workpacks/route");

    const response = await GET(archiveRequest());
    const body = await response.json() as {
      workpacks: Array<{ siteName: string; industry: string | null; region: string | null }>;
    };

    expect(response.status).toBe(200);
    expect(fake.siteFilters()).toContainEqual(["id", ["site-foreign"]]);
    expect(fake.siteFilters()).toContainEqual(["organization_id", ["org-owned"]]);
    expect(body.workpacks[0]).toMatchObject({
      siteName: "기본 현장",
      industry: null,
      region: null
    });
  });
});
