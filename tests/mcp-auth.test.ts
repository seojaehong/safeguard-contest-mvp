import { afterEach, describe, expect, it, vi } from "vitest";

import { createSupabaseAdminClient } from "@/lib/supabase-admin";

import {
  MCP_TOOL_NAMES,
  McpToolScopeError,
  asAuthContext,
  buildDbContext,
  buildEnvContext,
  computeEnablement,
  decideAuthContext,
  hashToken,
  isMcpToolAllowed,
  isMcpToolName,
  isReadOnlyMcpTool,
  matchesLegacyToken,
  normalizeScopes,
  parseLegacyTokens,
  requireMcpToolScope,
  resolveMcpAuth,
  type McpTokenRow,
} from "@/lib/mcp-auth";

vi.mock("@/lib/supabase-admin", () => ({
  createSupabaseAdminClient: vi.fn(),
}));

type AuthTable = "mcp_tokens" | "sites";
type AuthFilter = { column: string; value: unknown };

function makeAuthClient(input: {
  tokenRow: McpTokenRow;
  siteRow?: { id: string; organization_id: string } | null;
  siteError?: Error | null;
}) {
  const siteFilters: AuthFilter[] = [];
  const selectedTables: AuthTable[] = [];
  const tokenSelectQuery = {
    eq() {
      return tokenSelectQuery;
    },
    async maybeSingle() {
      return { data: input.tokenRow, error: null };
    },
  };
  const siteSelectQuery = {
    eq(column: string, value: unknown) {
      siteFilters.push({ column, value });
      return siteSelectQuery;
    },
    async maybeSingle() {
      return { data: input.siteRow ?? null, error: input.siteError ?? null };
    },
  };
  const client = {
    from(table: AuthTable) {
      selectedTables.push(table);
      return {
        select() {
          return table === "mcp_tokens" ? tokenSelectQuery : siteSelectQuery;
        },
        update() {
          return {
            eq() {
              return Promise.resolve({ error: null });
            },
          };
        },
      };
    },
  };
  return {
    client: client as unknown as NonNullable<ReturnType<typeof createSupabaseAdminClient>>,
    selectedTables,
    siteFilters,
  };
}

afterEach(() => {
  vi.clearAllMocks();
  vi.unstubAllEnvs();
});

describe("hashToken", () => {
  it("produces the known sha256 hex vector and is deterministic", () => {
    // sha256("abc") 표준 벡터.
    const expected = "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad";
    expect(hashToken("abc")).toBe(expected);
    expect(hashToken("abc")).toBe(hashToken("abc"));
  });

  it("trims before hashing so padded and clean tokens match", () => {
    expect(hashToken("  sclaw_xyz  ")).toBe(hashToken("sclaw_xyz"));
  });
});

describe("parseLegacyTokens", () => {
  it("splits, trims, and drops blanks", () => {
    const set = parseLegacyTokens(" a , b ,, c ");
    expect([...set].sort()).toEqual(["a", "b", "c"]);
  });

  it("returns empty set for undefined/blank", () => {
    expect(parseLegacyTokens(undefined).size).toBe(0);
    expect(parseLegacyTokens("   ").size).toBe(0);
  });
});

describe("matchesLegacyToken", () => {
  it("matches after trimming the incoming token", () => {
    const set = parseLegacyTokens("token-a,token-b");
    expect(matchesLegacyToken("  token-b  ", set)).toBe(true);
    expect(matchesLegacyToken("token-c", set)).toBe(false);
  });
});

describe("normalizeScopes", () => {
  it("normalizes and deduplicates an all-known non-empty string array", () => {
    expect(normalizeScopes([
      " tools:get_weather_signals ",
      "tools:get_weather_signals",
      "tools:read",
    ])).toEqual(["tools:get_weather_signals", "tools:read"]);
  });

  it("fails closed for malformed or empty DB scope values", () => {
    expect(normalizeScopes(null)).toEqual([]);
    expect(normalizeScopes([])).toEqual([]);
    expect(normalizeScopes([1, 2])).toEqual([]);
    expect(normalizeScopes("tools:*")).toEqual([]);
  });

  it("denies the entire array when one entry is malformed or unknown", () => {
    expect(normalizeScopes(["tools:write", 1])).toEqual([]);
    expect(normalizeScopes(["tools:read", "tools:unknown_future_tool"])).toEqual([]);
    expect(normalizeScopes(["tools:read", "   "])).toEqual([]);
  });
});

describe("MCP tool scope enforcement", () => {
  const context = (scopes: string[]) => ({
    siteId: "site-1",
    orgId: "org-1",
    scopes,
    source: "db" as const,
    tokenId: "token-1",
  });

  it("allows explicit tool scopes and the legacy operator wildcard", () => {
    expect(isMcpToolAllowed(context(["tools:get_weather_signals"]), "get_weather_signals")).toBe(true);
    expect(isMcpToolAllowed(context(["tools:get_weather_signals"]), "generate_safety_docpack")).toBe(false);
    expect(isMcpToolAllowed(context(["tools:*"]), "generate_safety_docpack")).toBe(true);
  });

  it("maps read and write roles to their bounded tool sets", () => {
    expect(isMcpToolAllowed(context(["tools:read"]), "query_safety_knowledge")).toBe(true);
    expect(isMcpToolAllowed(context(["tools:read"]), "generate_reviewed_safety_docpack")).toBe(false);
    expect(isMcpToolAllowed(context(["tools:write"]), "generate_reviewed_safety_docpack")).toBe(true);
    expect(isMcpToolAllowed(context(["tools:write"]), "get_weather_signals")).toBe(false);
  });

  it("fails closed when auth context or an allowed scope is missing", () => {
    expect(isMcpToolAllowed(null, "get_weather_signals")).toBe(false);
    expect(isMcpToolAllowed(context([]), "get_weather_signals")).toBe(false);
    expect(() => requireMcpToolScope(null, "get_weather_signals")).toThrow(McpToolScopeError);
    expect(() => requireMcpToolScope(context([]), "get_weather_signals")).toThrowError(
      expect.objectContaining({ code: "MCP_TOOL_FORBIDDEN" }),
    );
  });

  it("defines one stable unique name for every exposed SafeClaw MCP tool", () => {
    expect(new Set(MCP_TOOL_NAMES).size).toBe(MCP_TOOL_NAMES.length);
    expect(MCP_TOOL_NAMES).toEqual([
      "run_safeclaw_harness_agent",
      "generate_reviewed_safety_docpack",
      "generate_safety_docpack",
      "get_weather_signals",
      "validate_safety_citations",
      "sanitize_emergency_contacts",
      "search_accident_cases",
      "get_evidence_mapping",
      "query_safety_knowledge",
      "qa_review_docpack",
    ]);
  });

  it("classifies untrusted engine tool names against the MCP contract", () => {
    expect(isMcpToolName("run_safeclaw_harness_agent")).toBe(true);
    expect(isMcpToolName("unknown_engine_tool")).toBe(false);
    expect(isReadOnlyMcpTool("query_safety_knowledge")).toBe(true);
    expect(isReadOnlyMcpTool("generate_reviewed_safety_docpack")).toBe(false);
    expect(isReadOnlyMcpTool("generate_safety_docpack")).toBe(false);
  });
});

describe("buildDbContext", () => {
  const row: McpTokenRow = {
    id: "tok-1",
    site_id: "site-1",
    org_id: "org-1",
    scopes: ["tools:*"],
    disabled: false,
  };

  it("maps an active row to a db context", () => {
    expect(buildDbContext(row)).toEqual({
      siteId: "site-1",
      orgId: "org-1",
      scopes: ["tools:*"],
      source: "db",
      tokenId: "tok-1",
    });
  });

  it("returns null for a disabled row or missing row", () => {
    expect(buildDbContext({ ...row, disabled: true })).toBeNull();
    expect(buildDbContext(null)).toBeNull();
    expect(buildDbContext(undefined)).toBeNull();
  });

  it("nulls missing site/org and normalizes bad scopes", () => {
    const ctx = buildDbContext({ id: "t", site_id: null, org_id: null, scopes: "oops", disabled: false });
    expect(ctx).toEqual({ siteId: null, orgId: null, scopes: [], source: "db", tokenId: "t" });
  });
});

describe("buildEnvContext", () => {
  it("is a full-trust, site-unbound context", () => {
    expect(buildEnvContext()).toEqual({
      siteId: null,
      orgId: null,
      scopes: ["tools:*"],
      source: "env",
      tokenId: null,
    });
  });
});

describe("decideAuthContext", () => {
  const dbRow: McpTokenRow = { id: "t", site_id: "s", org_id: "o", scopes: ["tools:*"], disabled: false };
  const legacy = parseLegacyTokens("legacy-token");

  it("prefers a db row over the env legacy match", () => {
    const ctx = decideAuthContext({ dbRow, legacyTokens: legacy, token: "legacy-token" });
    expect(ctx?.source).toBe("db");
    expect(ctx?.siteId).toBe("s");
  });

  it("falls back to env when there is no db row", () => {
    const ctx = decideAuthContext({ dbRow: null, legacyTokens: legacy, token: "legacy-token" });
    expect(ctx?.source).toBe("env");
  });

  it("returns null when neither db nor env matches", () => {
    expect(decideAuthContext({ dbRow: null, legacyTokens: legacy, token: "unknown" })).toBeNull();
  });

  it("does not fall back to env for a disabled db row that also is not a legacy token", () => {
    const disabled = { ...dbRow, disabled: true };
    expect(decideAuthContext({ dbRow: disabled, legacyTokens: legacy, token: "unknown" })).toBeNull();
  });
});

describe("computeEnablement", () => {
  it("is enabled when either env tokens or supabase is present", () => {
    expect(computeEnablement({ hasEnvTokens: true, hasSupabase: false })).toBe(true);
    expect(computeEnablement({ hasEnvTokens: false, hasSupabase: true })).toBe(true);
    expect(computeEnablement({ hasEnvTokens: false, hasSupabase: false })).toBe(false);
  });
});

describe("asAuthContext", () => {
  it("accepts a valid context shape and ignores any stray token field", () => {
    const parsed = asAuthContext({
      siteId: "s",
      orgId: "o",
      scopes: ["tools:*"],
      source: "db",
      tokenId: "t",
      token: "PLAINTEXT-SHOULD-NOT-SURVIVE",
    });
    expect(parsed).toEqual({ siteId: "s", orgId: "o", scopes: ["tools:*"], source: "db", tokenId: "t" });
    expect(parsed as unknown as Record<string, unknown>).not.toHaveProperty("token");
  });

  it("rejects malformed values", () => {
    expect(asAuthContext(null)).toBeNull();
    expect(asAuthContext({ source: "bogus", scopes: [] })).toBeNull();
    expect(asAuthContext({ source: "db", scopes: "nope" })).toBeNull();
  });
});

describe("resolveMcpAuth tenant identity", () => {
  const tokenRow: McpTokenRow = {
    id: "token-1",
    site_id: "site-1",
    org_id: "org-1",
    scopes: ["tools:read"],
    disabled: false,
  };

  it("preserves a site token when the existing sites contract proves its organization", async () => {
    const fake = makeAuthClient({
      tokenRow,
      siteRow: { id: "site-1", organization_id: "org-1" },
    });
    vi.mocked(createSupabaseAdminClient).mockReturnValue(fake.client);

    await expect(resolveMcpAuth("persisted-token")).resolves.toEqual({
      siteId: "site-1",
      orgId: "org-1",
      scopes: ["tools:read"],
      source: "db",
      tokenId: "token-1",
    });
    expect(fake.siteFilters).toEqual([
      { column: "id", value: "site-1" },
      { column: "organization_id", value: "org-1" },
    ]);
  });

  it("fails closed without env fallback when the site and organization do not match", async () => {
    vi.stubEnv("SAFECLAW_MCP_TOKENS", "persisted-token");
    const fake = makeAuthClient({ tokenRow, siteRow: null });
    vi.mocked(createSupabaseAdminClient).mockReturnValue(fake.client);

    await expect(resolveMcpAuth("persisted-token")).resolves.toBeNull();
    expect(fake.selectedTables).toContain("sites");
  });

  it("fails closed when the site ownership lookup cannot prove consistency", async () => {
    const fake = makeAuthClient({
      tokenRow,
      siteError: new Error("private site lookup failure"),
    });
    vi.mocked(createSupabaseAdminClient).mockReturnValue(fake.client);

    await expect(resolveMcpAuth("persisted-token")).resolves.toBeNull();
  });

  it("rejects a persisted site token that has no organization to verify", async () => {
    const fake = makeAuthClient({ tokenRow: { ...tokenRow, org_id: null } });
    vi.mocked(createSupabaseAdminClient).mockReturnValue(fake.client);

    await expect(resolveMcpAuth("persisted-token")).resolves.toBeNull();
    expect(fake.selectedTables).not.toContain("sites");
  });

  it("preserves an organization-scoped token without requiring a site lookup", async () => {
    const fake = makeAuthClient({ tokenRow: { ...tokenRow, site_id: null } });
    vi.mocked(createSupabaseAdminClient).mockReturnValue(fake.client);

    await expect(resolveMcpAuth("persisted-token")).resolves.toEqual({
      siteId: null,
      orgId: "org-1",
      scopes: ["tools:read"],
      source: "db",
      tokenId: "token-1",
    });
    expect(fake.selectedTables).not.toContain("sites");
  });
});
