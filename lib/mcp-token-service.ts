import { randomBytes } from "node:crypto";
import { MCP_TOOL_NAMES, hashToken } from "@/lib/mcp-auth";
import {
  MCP_ENDPOINT_URL,
  buildOpenClawHarnessAgentCommand,
  buildOpenClawInstallCommand,
  buildOpenClawModelStatusCommand,
  buildOpenClawOauthLoginCommand,
  buildOpenClawProbeCommand,
} from "@/lib/mcp-connect";
import type { Json } from "@/lib/supabase-admin";

export const DEFAULT_MCP_SCOPES = MCP_TOOL_NAMES.map((toolName) => `tools:${toolName}`);
export const DEFAULT_MCP_TOKEN_LIST_LIMIT = 25;
export const MAX_MCP_TOKEN_LIST_LIMIT = 50;
export const MAX_ACTIVE_MCP_TOKENS_PER_SITE = 50;

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ISO_TIMESTAMP_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|[+-]\d{2}:\d{2})$/;

export type McpTokenOwnerScope = {
  organizationIds: string[];
  siteIds: string[];
};

export type McpTokenOwnershipCandidate = {
  org_id: string | null;
  site_id: string | null;
};

export type McpTokenListCursor = {
  createdAt: string;
  id: string;
};

export type McpTokenListCursorRow = {
  created_at: string | null;
  id: string;
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

export function canIssueMoreMcpTokens(activeTokenCount: number): boolean {
  return activeTokenCount < MAX_ACTIVE_MCP_TOKENS_PER_SITE;
}

export function encodeMcpTokenListCursor(row: McpTokenListCursorRow): string | null {
  if (!row.created_at || !row.id) return null;
  return Buffer
    .from(JSON.stringify({ createdAt: row.created_at, id: row.id }), "utf8")
    .toString("base64url");
}

export function parseMcpTokenListCursor(rawCursor: string | null | undefined): McpTokenListCursor | null {
  if (!rawCursor) return null;
  try {
    const decoded = Buffer.from(rawCursor, "base64url").toString("utf8");
    const parsed = JSON.parse(decoded) as unknown;
    if (!parsed || typeof parsed !== "object") return null;
    const candidate = parsed as Partial<McpTokenListCursor>;
    if (typeof candidate.createdAt !== "string" || !ISO_TIMESTAMP_PATTERN.test(candidate.createdAt) || Number.isNaN(Date.parse(candidate.createdAt))) return null;
    if (typeof candidate.id !== "string" || !UUID_PATTERN.test(candidate.id)) return null;
    return { createdAt: candidate.createdAt, id: candidate.id };
  } catch {
    return null;
  }
}

export function buildMcpTokenOwnerFilter(scope: McpTokenOwnerScope): string | null {
  const organizationIds = scope.organizationIds.filter((id) => UUID_PATTERN.test(id));
  const siteIds = scope.siteIds.filter((id) => UUID_PATTERN.test(id));
  const filters = [
    organizationIds.length ? `org_id.in.(${organizationIds.join(",")})` : "",
    siteIds.length ? `site_id.in.(${siteIds.join(",")})` : "",
  ].filter(Boolean);
  return filters.length ? filters.join(",") : null;
}

export function buildMcpTokenCursorFilter(cursor: McpTokenListCursor | null): string | null {
  if (!cursor) return null;
  return `created_at.lt.${cursor.createdAt},and(created_at.eq.${cursor.createdAt},id.lt.${cursor.id})`;
}

export function isTokenOwnedByScope(
  token: McpTokenOwnershipCandidate,
  scope: McpTokenOwnerScope
): boolean {
  if (token.org_id && scope.organizationIds.includes(token.org_id)) return true;
  if (token.site_id && scope.siteIds.includes(token.site_id)) return true;
  return false;
}

export {
  MCP_ENDPOINT_URL,
  buildOpenClawHarnessAgentCommand,
  buildOpenClawInstallCommand,
  buildOpenClawModelStatusCommand,
  buildOpenClawOauthLoginCommand,
  buildOpenClawProbeCommand,
};
