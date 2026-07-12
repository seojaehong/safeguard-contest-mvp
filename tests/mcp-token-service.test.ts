import { describe, expect, it } from "vitest";
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { MCP_TOOL_NAMES, hashToken } from "@/lib/mcp-auth";
import {
  DEFAULT_MCP_SCOPES,
  MCP_ENDPOINT_URL,
  buildMcpTokenCursorFilter,
  buildMcpTokenInsert,
  buildMcpTokenLabel,
  buildMcpTokenOwnerFilter,
  buildOpenClawHarnessAgentCommand,
  buildOpenClawInstallCommand,
  buildOpenClawModelStatusCommand,
  buildOpenClawOauthLoginCommand,
  buildOpenClawProbeCommand,
  canIssueMoreMcpTokens,
  createPlaintextMcpToken,
  encodeMcpTokenListCursor,
  isTokenOwnedByScope,
  parseMcpTokenListCursor,
  resolveMcpTokenListLimit,
} from "@/lib/mcp-token-service";

describe("createPlaintextMcpToken", () => {
  it("creates a SafeClaw-prefixed random token", () => {
    const token = createPlaintextMcpToken();
    expect(token).toMatch(/^sclaw_[A-Za-z0-9_-]+$/);
    expect(token.length).toBeGreaterThan(20);
  });
});

describe("buildMcpTokenLabel", () => {
  it("uses the requested label when provided", () => {
    expect(buildMcpTokenLabel("안산공장", "  외부 AI 연결  ")).toBe("외부 AI 연결");
  });

  it("falls back to the site name", () => {
    expect(buildMcpTokenLabel("안산공장")).toBe("내 AI 연결 - 안산공장");
    expect(buildMcpTokenLabel(null)).toBe("내 AI 연결 - 기본 현장");
  });
});

describe("buildMcpTokenInsert", () => {
  it("hashes the plaintext token and never returns it", () => {
    const insert = buildMcpTokenInsert({
      plaintextToken: "sclaw_secret",
      label: "내 AI 연결",
      siteId: "site-1",
      orgId: "org-1",
    });

    expect(insert).toEqual({
      token_hash: hashToken("sclaw_secret"),
      label: "내 AI 연결",
      site_id: "site-1",
      org_id: "org-1",
      scopes: [...DEFAULT_MCP_SCOPES],
    });
    expect(insert as unknown as Record<string, unknown>).not.toHaveProperty("plaintextToken");
  });

  it("issues explicit SafeClaw tool scopes instead of a future-expanding wildcard", () => {
    expect(DEFAULT_MCP_SCOPES).toEqual(MCP_TOOL_NAMES.map((toolName) => `tools:${toolName}`));
    expect(DEFAULT_MCP_SCOPES).not.toContain("tools:*");
  });

  it("keeps the operator CLI on the same explicit tool contract", () => {
    const script = readFileSync(join(process.cwd(), "scripts/issue-mcp-token.mjs"), "utf8");

    expect(script).toContain('import { MCP_TOOL_SCOPES } from "../lib/mcp-tool-contract.mjs";');
    expect(script).toContain("scopes: [...MCP_TOOL_SCOPES]");
    expect(script).not.toContain('scopes: ["tools:*"]');
  });
});

describe("isTokenOwnedByScope", () => {
  const scope = { organizationIds: ["org-1"], siteIds: ["site-1"] };

  it("accepts tokens bound to an owned organization or site", () => {
    expect(isTokenOwnedByScope({ org_id: "org-1", site_id: null }, scope)).toBe(true);
    expect(isTokenOwnedByScope({ org_id: null, site_id: "site-1" }, scope)).toBe(true);
  });

  it("rejects unbound or foreign tokens", () => {
    expect(isTokenOwnedByScope({ org_id: null, site_id: null }, scope)).toBe(false);
    expect(isTokenOwnedByScope({ org_id: "org-2", site_id: "site-2" }, scope)).toBe(false);
  });
});

describe("resolveMcpTokenListLimit", () => {
  it("defaults to a bounded recent-token list", () => {
    expect(resolveMcpTokenListLimit(null)).toBe(25);
    expect(resolveMcpTokenListLimit("")).toBe(25);
    expect(resolveMcpTokenListLimit("abc")).toBe(25);
    expect(resolveMcpTokenListLimit("-10")).toBe(25);
  });

  it("uses valid positive limits up to the public maximum", () => {
    expect(resolveMcpTokenListLimit("10")).toBe(10);
    expect(resolveMcpTokenListLimit("50")).toBe(50);
    expect(resolveMcpTokenListLimit("5000")).toBe(50);
  });
});

describe("MCP token list cursors", () => {
  it("round-trips an opaque cursor from a token row", () => {
    const cursor = encodeMcpTokenListCursor({
      created_at: "2026-07-05T10:00:00.000Z",
      id: "11111111-1111-4111-8111-111111111111",
    });

    expect(cursor).toBeTruthy();
    expect(parseMcpTokenListCursor(cursor)).toEqual({
      createdAt: "2026-07-05T10:00:00.000Z",
      id: "11111111-1111-4111-8111-111111111111",
    });
  });

  it("rejects malformed cursors", () => {
    expect(parseMcpTokenListCursor(null)).toBeNull();
    expect(parseMcpTokenListCursor("not-base64-json")).toBeNull();
    expect(parseMcpTokenListCursor(Buffer.from(JSON.stringify({ createdAt: "bad", id: "t" })).toString("base64url"))).toBeNull();
    expect(parseMcpTokenListCursor(Buffer.from(JSON.stringify({ createdAt: "2026-07-05T10:00:00.000Z", id: "token-1" })).toString("base64url"))).toBeNull();
    expect(encodeMcpTokenListCursor({ created_at: null, id: "token-1" })).toBeNull();
  });
});

describe("MCP token list query filters", () => {
  const orgId = "11111111-1111-4111-8111-111111111111";
  const siteId = "22222222-2222-4222-8222-222222222222";

  it("builds a bounded owner filter from valid UUID scope identifiers", () => {
    expect(buildMcpTokenOwnerFilter({ organizationIds: [orgId], siteIds: [siteId] })).toBe(
      `org_id.in.(${orgId}),site_id.in.(${siteId})`
    );
    expect(buildMcpTokenOwnerFilter({ organizationIds: [orgId], siteIds: [] })).toBe(`org_id.in.(${orgId})`);
    expect(buildMcpTokenOwnerFilter({ organizationIds: [], siteIds: [siteId] })).toBe(`site_id.in.(${siteId})`);
  });

  it("drops malformed owner ids before composing a PostgREST filter", () => {
    expect(buildMcpTokenOwnerFilter({
      organizationIds: [orgId, "org-1"],
      siteIds: ["site-1", siteId],
    })).toBe(`org_id.in.(${orgId}),site_id.in.(${siteId})`);
    expect(buildMcpTokenOwnerFilter({ organizationIds: ["org-1"], siteIds: ["site-1"] })).toBeNull();
  });

  it("builds the keyset cursor filter used after the owner filter", () => {
    expect(buildMcpTokenCursorFilter({
      createdAt: "2026-07-05T10:00:00.000Z",
      id: orgId,
    })).toBe(`created_at.lt.2026-07-05T10:00:00.000Z,and(created_at.eq.2026-07-05T10:00:00.000Z,id.lt.${orgId})`);
    expect(buildMcpTokenCursorFilter(null)).toBeNull();
  });

  it("keeps owner and cursor filters as separate PostgREST or parameters", () => {
    const client = createClient("https://example.supabase.co", "anon-key");
    const ownerFilter = buildMcpTokenOwnerFilter({ organizationIds: [orgId], siteIds: [siteId] });
    const cursorFilter = buildMcpTokenCursorFilter({
      createdAt: "2026-07-05T10:00:00.000Z",
      id: orgId,
    });
    if (!ownerFilter || !cursorFilter) throw new Error("expected test filters");

    const query = client
      .from("mcp_tokens")
      .select("id")
      .or(ownerFilter)
      .or(cursorFilter);
    const queryUrl = (query as unknown as { url: URL }).url;

    expect(queryUrl.searchParams.getAll("or")).toEqual([
      `(${ownerFilter})`,
      `(${cursorFilter})`,
    ]);
  });
});

describe("canIssueMoreMcpTokens", () => {
  it("allows issuance below the active-token cap", () => {
    expect(canIssueMoreMcpTokens(0)).toBe(true);
    expect(canIssueMoreMcpTokens(49)).toBe(true);
  });

  it("blocks issuance at or above the active-token cap", () => {
    expect(canIssueMoreMcpTokens(50)).toBe(false);
    expect(canIssueMoreMcpTokens(500)).toBe(false);
  });
});

describe("OpenClaw command helpers", () => {
  it("uses the production double-mcp endpoint and probe command", () => {
    expect(MCP_ENDPOINT_URL).toBe("https://www.safeclaw.kr/api/mcp/mcp");
    expect(buildOpenClawInstallCommand("sclaw_token")).toContain("Authorization=Bearer sclaw_token");
    expect(buildOpenClawInstallCommand("sclaw_token")).toContain(MCP_ENDPOINT_URL);
    expect(buildOpenClawProbeCommand()).toBe("openclaw --profile safeclaw mcp probe safeclaw");
    expect(buildOpenClawOauthLoginCommand()).toContain("models auth login --provider openai");
    expect(buildOpenClawModelStatusCommand()).toBe("openclaw --profile safeclaw models status");
    expect(buildOpenClawHarnessAgentCommand()).toContain("run_safeclaw_harness_agent");
  });
});

