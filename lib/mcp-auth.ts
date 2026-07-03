// SafeClaw MCP 인증 — 테넌트 스코프 토큰 해석.
//
// route.ts(app/api/mcp/[transport]/route.ts)의 verifyToken이 이 모듈로 Bearer 토큰을
// {siteId, orgId, scopes} 컨텍스트로 해석한다. 두 가지 소스:
//   1. DB(mcp_tokens): Bearer의 sha256 해시로 조회(disabled=false). 사이트/조직에 귀속된
//      테넌트 토큰. Supabase 서비스 롤이 있을 때만 사용 가능.
//   2. env 레거시(SAFECLAW_MCP_TOKENS): 콤마 구분 전체 신뢰 토큰. 기존 운영자 토큰 무중단
//      유지용 폴백. DB 미매칭 시에만 사용한다.
//
// 보안 불변식:
//   - 평문 토큰은 절대 저장/로그하지 않는다. DB에는 sha256 hex만, 컨텍스트에는 토큰 없음.
//   - RLS로 mcp_tokens는 service_role 전용 → createSupabaseAdminClient(서비스 롤)로만 조회.

import { createHash } from "node:crypto";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { createLogger } from "@/lib/logger";

const log = createLogger("mcp-auth");

export type McpAuthSource = "db" | "env";

/** MCP 도구 핸들러에 전달되는 인증 컨텍스트. 평문 토큰을 포함하지 않는다. */
export interface McpAuthContext {
  siteId: string | null;
  orgId: string | null;
  scopes: string[];
  source: McpAuthSource;
  /** DB 토큰이면 mcp_tokens.id, env 레거시면 null. */
  tokenId: string | null;
}

/** decideAuthContext가 다루는 mcp_tokens 행의 최소 형태. */
export interface McpTokenRow {
  id: string;
  site_id: string | null;
  org_id: string | null;
  scopes: unknown;
  disabled: boolean;
}

const DEFAULT_SCOPES = ["tools:*"] as const;

// ── 순수부 (vitest 대상) ────────────────────────────────────────────────────

/** 토큰 평문(트림)의 sha256 hex. DB 저장 해시·조회 키와 반드시 동일 규칙이어야 한다. */
export function hashToken(token: string): string {
  return createHash("sha256").update(token.trim(), "utf8").digest("hex");
}

/** env SAFECLAW_MCP_TOKENS(콤마 구분)를 트림·공백제거한 집합으로 파싱한다. */
export function parseLegacyTokens(raw: string | undefined | null): Set<string> {
  if (!raw || !raw.trim()) return new Set();
  return new Set(
    raw
      .split(",")
      .map((token) => token.trim())
      .filter(Boolean)
  );
}

/** 트림한 토큰이 레거시 집합에 있는지. */
export function matchesLegacyToken(token: string, legacyTokens: Set<string>): boolean {
  return legacyTokens.has(token.trim());
}

/** scopes 컬럼(jsonb)을 문자열 배열로 정규화한다. 형태가 어긋나면 기본값. */
export function normalizeScopes(value: unknown): string[] {
  if (Array.isArray(value) && value.every((s) => typeof s === "string") && value.length > 0) {
    return value as string[];
  }
  return [...DEFAULT_SCOPES];
}

/** mcp_tokens 행 → 컨텍스트. 행이 없거나 disabled면 null(=DB 매칭 실패). */
export function buildDbContext(row: McpTokenRow | null | undefined): McpAuthContext | null {
  if (!row || row.disabled) return null;
  return {
    siteId: row.site_id ?? null,
    orgId: row.org_id ?? null,
    scopes: normalizeScopes(row.scopes),
    source: "db",
    tokenId: row.id,
  };
}

/** env 레거시 토큰 → 전체 신뢰 컨텍스트(사이트/조직 미귀속). */
export function buildEnvContext(): McpAuthContext {
  return { siteId: null, orgId: null, scopes: [...DEFAULT_SCOPES], source: "env", tokenId: null };
}

/**
 * 인증 결정(순수). DB 매칭이 우선, 없으면 env 레거시, 둘 다 아니면 null.
 * IO(DB 조회·env 읽기)는 호출부가 수행하고 결과만 주입한다.
 */
export function decideAuthContext(input: {
  dbRow: McpTokenRow | null | undefined;
  legacyTokens: Set<string>;
  token: string;
}): McpAuthContext | null {
  const dbContext = buildDbContext(input.dbRow);
  if (dbContext) return dbContext;
  if (matchesLegacyToken(input.token, input.legacyTokens)) return buildEnvContext();
  return null;
}

/** env 토큰 존재 여부 또는 Supabase 설정 여부로 MCP 계층 활성화 판정(순수). */
export function computeEnablement(input: { hasEnvTokens: boolean; hasSupabase: boolean }): boolean {
  return input.hasEnvTokens || input.hasSupabase;
}

/** AuthInfo.extra 등에서 받은 임의 값이 McpAuthContext 형태인지 확인해 반환한다. */
export function asAuthContext(value: unknown): McpAuthContext | null {
  if (!value || typeof value !== "object") return null;
  const v = value as Record<string, unknown>;
  if (v.source !== "db" && v.source !== "env") return null;
  if (!Array.isArray(v.scopes)) return null;
  return {
    siteId: typeof v.siteId === "string" ? v.siteId : null,
    orgId: typeof v.orgId === "string" ? v.orgId : null,
    scopes: v.scopes.filter((s): s is string => typeof s === "string"),
    source: v.source,
    tokenId: typeof v.tokenId === "string" ? v.tokenId : null,
  };
}

// ── IO부 ────────────────────────────────────────────────────────────────────

function supabaseConfigured(): boolean {
  return Boolean(
    (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL) &&
      process.env.SUPABASE_SERVICE_ROLE_KEY
  );
}

/** MCP 계층이 켜져 있는지(env 토큰 존재 또는 Supabase 서비스 롤 설정). */
export function isMcpEnabled(): boolean {
  return computeEnablement({
    hasEnvTokens: parseLegacyTokens(process.env.SAFECLAW_MCP_TOKENS).size > 0,
    hasSupabase: supabaseConfigured(),
  });
}

/**
 * Bearer 토큰을 인증 컨텍스트로 해석한다.
 * 1) Supabase 서비스 롤이 있으면 sha256 해시로 mcp_tokens 조회(disabled=false).
 *    매칭 시 last_used_at을 fire-and-forget으로 갱신.
 * 2) DB 미매칭/미설정이면 env 레거시 토큰으로 폴백.
 * 어느 쪽도 아니면 null(=인증 실패).
 */
export async function resolveMcpAuth(bearerToken: string | undefined | null): Promise<McpAuthContext | null> {
  const token = bearerToken?.trim();
  if (!token) return null;

  const legacyTokens = parseLegacyTokens(process.env.SAFECLAW_MCP_TOKENS);

  let dbRow: McpTokenRow | null = null;
  const client = createSupabaseAdminClient();
  if (client) {
    try {
      const tokenHash = hashToken(token);
      const { data, error } = await client
        .from("mcp_tokens")
        .select("id, site_id, org_id, scopes, disabled")
        .eq("token_hash", tokenHash)
        .eq("disabled", false)
        .maybeSingle();
      if (error) {
        log.warn("mcp_tokens 조회 실패 — env 폴백으로 진행", error);
      } else if (data) {
        dbRow = data as McpTokenRow;
        // last_used_at 갱신은 fire-and-forget(응답 경로를 막지 않는다).
        void client
          .from("mcp_tokens")
          .update({ last_used_at: new Date().toISOString() })
          .eq("id", data.id)
          .then(({ error: updateError }) => {
            if (updateError) log.debug("last_used_at 갱신 실패", updateError);
          });
      }
    } catch (error) {
      log.warn("mcp_tokens 조회 예외 — env 폴백으로 진행", error);
    }
  }

  return decideAuthContext({ dbRow, legacyTokens, token });
}
