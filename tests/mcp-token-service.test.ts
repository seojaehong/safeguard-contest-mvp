import { describe, expect, it } from "vitest";

import { hashToken } from "@/lib/mcp-auth";
import {
  DEFAULT_MCP_SCOPES,
  MCP_ENDPOINT_URL,
  buildMcpTokenInsert,
  buildMcpTokenLabel,
  buildOpenClawInstallCommand,
  buildOpenClawProbeCommand,
  createPlaintextMcpToken,
  isTokenOwnedByScope,
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

describe("OpenClaw command helpers", () => {
  it("uses the production double-mcp endpoint and probe command", () => {
    expect(MCP_ENDPOINT_URL).toBe("https://www.safeclaw.kr/api/mcp/mcp");
    expect(buildOpenClawInstallCommand("sclaw_token")).toContain("Authorization=Bearer sclaw_token");
    expect(buildOpenClawInstallCommand("sclaw_token")).toContain(MCP_ENDPOINT_URL);
    expect(buildOpenClawProbeCommand()).toBe("openclaw --profile safeclaw mcp probe safeclaw");
  });
});

