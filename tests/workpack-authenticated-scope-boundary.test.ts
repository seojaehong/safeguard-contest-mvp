import type { NextRequest } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { buildDbHarnessPacket } from "@/lib/db-harness";
import { attachGenerationEvidence } from "@/lib/generation-evidence";
import { buildMockAskResponse } from "@/lib/mock-data";
import type { WorkspaceDatabase } from "@/lib/supabase-admin";
import type { AskResponse } from "@/lib/types";

const SECRET = "workpack-authenticated-scope-boundary-secret";
const USER_ID = "11111111-1111-4111-8111-111111111111";
const ORGANIZATION_ID = "22222222-2222-4222-8222-222222222222";
const SITE_ID = "33333333-3333-4333-8333-333333333333";
const FOREIGN_ORGANIZATION_ID = "44444444-4444-4444-8444-444444444444";
const STALE_SITE_ID = "55555555-5555-4555-8555-555555555555";

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

type Row = Record<string, unknown>;
type Filter = {
  column: string;
  value: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function responseWithHarness(): AskResponse {
  const question = "성수동 외벽 도장 작업";
  const response = buildMockAskResponse(question, [], "mock", "test");
  const packet = buildDbHarnessPacket({ question, references: [] });
  return {
    ...response,
    dbHarness: {
      packet,
      promptContext: "server generation harness",
      summary: {
        mode: packet.mode,
        llmRole: packet.generationContract.llmRole,
        llmOutputScope: packet.generationContract.llmOutputScope,
        evidenceAuthority: packet.generationContract.evidenceAuthority,
        providerRetryScope: packet.generationContract.providerRetryScope,
        fallbackChainAllowed: packet.generationContract.fallbackChainAllowed,
        genericProseSubstitutionAllowed: packet.generationContract.genericProseSubstitutionAllowed,
        missingEvidencePolicy: packet.generationContract.missingEvidencePolicy,
        directEvidence: 0,
        sifCases: 0,
        supportingEvidence: 0,
        improvementMemory: 0,
        workpackMemory: 0,
        missingEvidence: packet.generationContract.missingEvidence,
        documentCoverage: packet.generationContract.documentCoverage,
        retrievalContract: packet.retrievalContract,
        ontologyStatus: packet.ontologyChecklist.status,
      },
    },
  };
}

function jsonRequest(body: unknown): NextRequest {
  return {
    headers: new Headers({ authorization: "Bearer test-token" }),
    json: async () => body,
  } as unknown as NextRequest;
}

function matchesFilters(row: Row, filters: readonly Filter[]): boolean {
  return filters.every((filter) => row[filter.column] === filter.value);
}

function makeScopedClient(input: {
  organizations?: Row[];
  sites?: Row[];
} = {}) {
  const organizations = [...(input.organizations ?? [{
    id: ORGANIZATION_ID,
    owner_id: USER_ID,
    name: "성수 조직",
  }])];
  const sites = [...(input.sites ?? [{
    id: SITE_ID,
    organization_id: ORGANIZATION_ID,
    name: "성수 현장",
  }])];
  const workpacks: Row[] = [];
  const insertedOrganizations: Row[] = [];
  const insertedSites: Row[] = [];

  function tableRows(table: string): Row[] {
    if (table === "organizations") return organizations;
    if (table === "sites") return sites;
    if (table === "workpacks") return workpacks;
    throw new Error(`Unexpected table ${table}`);
  }

  function selectQuery(table: string) {
    const filters: Filter[] = [];
    const query = {
      eq(column: string, value: string) {
        filters.push({ column, value });
        return query;
      },
      limit: async (count: number) => ({
        data: tableRows(table).filter((row) => matchesFilters(row, filters)).slice(0, count),
        error: null,
      }),
      maybeSingle: async () => ({
        data: tableRows(table).find((row) => matchesFilters(row, filters)) ?? null,
        error: null,
      }),
    };
    return query;
  }

  const client = {
    from(table: string) {
      return {
        select() {
          return selectQuery(table);
        },
        insert(payload: Row) {
          const row = { ...payload };
          if (table === "organizations") {
            organizations.push(row);
            insertedOrganizations.push(row);
          } else if (table === "sites") {
            sites.push(row);
            insertedSites.push(row);
          } else if (table === "workpacks") {
            workpacks.push({
              ...row,
              created_at: "2026-07-14T02:00:00.000Z",
              updated_at: "2026-07-14T02:00:00.000Z",
            });
          } else {
            throw new Error(`Unexpected insert table ${table}`);
          }
          return {
            select() {
              return {
                single: async () => ({
                  data: table === "workpacks" ? workpacks[workpacks.length - 1] : { id: row.id },
                  error: null,
                }),
              };
            },
          };
        },
      };
    },
  };

  return {
    client: client as unknown as SupabaseClient<WorkspaceDatabase>,
    insertedOrganizationCount: () => insertedOrganizations.length,
    insertedSiteCount: () => insertedSites.length,
    insertedWorkpackCount: () => workpacks.length,
  };
}

describe("workpack authenticated workspace scope boundary", () => {
  beforeEach(() => {
    process.env.SAFECLAW_GENERATION_EVIDENCE_SECRET = SECRET;
    mocks.getWorkspaceUser.mockResolvedValue({ id: USER_ID, email: "user@example.com" });
  });

  afterEach(() => {
    delete process.env.SAFECLAW_GENERATION_EVIDENCE_SECRET;
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("fails closed on missing scope without auto-creating organization, site, or workpack rows", async () => {
    const fake = makeScopedClient({ organizations: [], sites: [] });
    mocks.createSupabaseAdminClient.mockReturnValue(fake.client);
    const sealed = attachGenerationEvidence(responseWithHarness(), {
      secret: SECRET,
      generatedAt: "2026-07-14T02:00:00.000Z",
    });
    const { POST } = await import("@/app/api/workpacks/route");

    const response = await POST(jsonRequest({ data: sealed }));
    const body = await response.json() as Record<string, unknown>;

    expect(response.status).toBe(409);
    expect(body).toMatchObject({
      ok: false,
      code: "workspace_scope_required",
      workpackId: null,
    });
    expect(fake.insertedOrganizationCount()).toBe(0);
    expect(fake.insertedSiteCount()).toBe(0);
    expect(fake.insertedWorkpackCount()).toBe(0);
  });

  it.each([
    ["partial site-only scope", { siteId: SITE_ID }, "workspace_scope_incomplete"],
    [
      "foreign organization scope",
      { organizationId: FOREIGN_ORGANIZATION_ID, siteId: SITE_ID },
      "workspace_scope_forbidden",
    ],
    [
      "stale site scope",
      { organizationId: ORGANIZATION_ID, siteId: STALE_SITE_ID },
      "workspace_scope_forbidden",
    ],
  ])("fails closed on %s before inserting a workpack", async (_label, workspaceScope, expectedCode) => {
    const fake = makeScopedClient();
    mocks.createSupabaseAdminClient.mockReturnValue(fake.client);
    const sealed = attachGenerationEvidence(responseWithHarness(), {
      secret: SECRET,
      generatedAt: "2026-07-14T02:00:00.000Z",
    });
    const { POST } = await import("@/app/api/workpacks/route");

    const response = await POST(jsonRequest({ data: sealed, workspaceScope }));
    const body = await response.json() as Record<string, unknown>;

    expect(response.status).toBe(409);
    expect(body).toMatchObject({
      ok: false,
      code: expectedCode,
      workpackId: null,
    });
    expect(fake.insertedWorkpackCount()).toBe(0);
  });

  it("exercises the real resolver boundary instead of a resolver-wide mock", async () => {
    const source = await import("@/lib/supabase-admin");

    expect(vi.isMockFunction(source.resolveAuthenticatedWorkspaceContext)).toBe(false);
    expect(vi.isMockFunction(source.ensureWorkspaceContext)).toBe(false);
  });
});
