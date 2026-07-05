import { randomBytes } from "node:crypto";
import { hashToken } from "@/lib/mcp-auth";
import { MCP_ENDPOINT_URL, buildOpenClawInstallCommand, buildOpenClawProbeCommand } from "@/lib/mcp-connect";
import type { Json } from "@/lib/supabase-admin";

export const DEFAULT_MCP_SCOPES = ["tools:*"] as const;
export const DEFAULT_MCP_TOKEN_LIST_LIMIT = 25;
export const MAX_MCP_TOKEN_LIST_LIMIT = 50;

export type McpTokenOwnerScope = {
  organizationIds: string[];
  siteIds: string[];
};

export type McpTokenOwnershipCandidate = {
  org_id: string | null;
  site_id: string | null;
};

export function createPlaintextMcpToken(): string {
  return `sclaw_${randomBytes(32).toString("base64url")}`;
}

export function buildMcpTokenLabel(siteName: string | null | undefined, requestedLabel?: string): string {
  const cleanRequested = requestedLabel?.trim();
  if (cleanRequested) return cleanRequested.slice(0, 120);
  const cleanSiteName = siteName?.trim() || "기본 현장";
  return `내 AI 연결 - ${cleanSiteName}`.slice(0, 120);
}

export function buildMcpTokenInsert(input: {
  plaintextToken: string;
  label: string;
  siteId: string;
  orgId: string;
}): {
  token_hash: string;
  label: string;
  site_id: string;
  org_id: string;
  scopes: Json;
} {
  return {
    token_hash: hashToken(input.plaintextToken),
    label: input.label,
    site_id: input.siteId,
    org_id: input.orgId,
    scopes: [...DEFAULT_MCP_SCOPES] as Json,
  };
}

export function resolveMcpTokenListLimit(rawLimit: string | null | undefined): number {
  const parsed = Number.parseInt(rawLimit || "", 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return DEFAULT_MCP_TOKEN_LIST_LIMIT;
  return Math.min(parsed, MAX_MCP_TOKEN_LIST_LIMIT);
}

export function isTokenOwnedByScope(
  token: McpTokenOwnershipCandidate,
  scope: McpTokenOwnerScope
): boolean {
  if (token.org_id && scope.organizationIds.includes(token.org_id)) return true;
  if (token.site_id && scope.siteIds.includes(token.site_id)) return true;
  return false;
}

export { MCP_ENDPOINT_URL, buildOpenClawInstallCommand, buildOpenClawProbeCommand };
