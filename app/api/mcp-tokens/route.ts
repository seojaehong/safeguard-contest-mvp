import { NextRequest, NextResponse } from "next/server";
import {
  createSupabaseAdminClient,
  ensureWorkspaceContext,
  getWorkspaceUser,
  type WorkspaceDatabase,
  type WorkspaceUser,
} from "@/lib/supabase-admin";
import {
  buildMcpTokenCursorFilter,
  buildMcpTokenInsert,
  buildMcpTokenLabel,
  buildMcpTokenOwnerFilter,
  canIssueMoreMcpTokens,
  createPlaintextMcpToken,
  encodeMcpTokenListCursor,
  isTokenOwnedByScope,
  parseMcpTokenListCursor,
  resolveMcpTokenListLimit,
  type McpTokenOwnerScope,
} from "@/lib/mcp-token-service";
import { isRecord } from "@/lib/workspace-api";
import type { SupabaseClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

type SiteSummary = { id: string; name: string; organization_id: string };
type OrganizationSummary = { id: string; name: string };

async function loadOwnerScope(
  client: SupabaseClient<WorkspaceDatabase>,
  user: WorkspaceUser
): Promise<McpTokenOwnerScope & { organizations: OrganizationSummary[] }> {
  const { data: organizations, error: organizationError } = await client
    .from("organizations")
    .select("id,name")
    .eq("owner_id", user.id);

  if (organizationError) throw organizationError;

  const organizationIds = (organizations || []).map((organization) => organization.id);

  return {
    organizations: organizations || [],
    organizationIds,
    siteIds: [],
  };
}

async function loadSiteNamesForTokens(
  client: SupabaseClient<WorkspaceDatabase>,
  siteIds: string[],
  organizationIds: string[]
): Promise<Map<string, string>> {
  const uniqueSiteIds = Array.from(new Set(siteIds)).filter(Boolean);
  if (!uniqueSiteIds.length || !organizationIds.length) return new Map();

  const { data: sites, error } = await client
    .from("sites")
    .select("id,name,organization_id")
    .in("id", uniqueSiteIds)
    .in("organization_id", organizationIds);

  if (error) throw error;
  return new Map((sites || []).map((site: SiteSummary) => [site.id, site.name]));
}

export async function GET(request: NextRequest) {
  const limit = resolveMcpTokenListLimit(request.nextUrl.searchParams.get("limit"));
  const cursor = parseMcpTokenListCursor(request.nextUrl.searchParams.get("cursor"));
  const fetchLimit = limit + 1;
  const client = createSupabaseAdminClient();
  if (!client) {
    return NextResponse.json({
      ok: false,
      configured: false,
      tokens: [],
      limit,
      hasMore: false,
      nextCursor: null,
      message: "Supabase 저장소가 아직 설정되지 않았습니다.",
    });
  }

  const user = await getWorkspaceUser(client, request.headers);
  if (!user) {
    return NextResponse.json({
      ok: false,
      configured: true,
      tokens: [],
      limit,
      hasMore: false,
      nextCursor: null,
      message: "관리자 로그인이 필요합니다.",
    }, { status: 401 });
  }

  try {
    const scope = await loadOwnerScope(client, user);
    if (!scope.organizationIds.length) {
      return NextResponse.json({
        ok: true,
        configured: true,
        tokens: [],
        limit,
        hasMore: false,
        nextCursor: null,
        message: "아직 연결 토큰이 없습니다. 기본 현장을 만든 뒤 발급할 수 있습니다.",
      });
    }

    const ownerFilter = buildMcpTokenOwnerFilter(scope);
    if (!ownerFilter) {
      console.error("mcp token list owner scope did not contain valid UUID identifiers", {
        organizationCount: scope.organizationIds.length,
        siteCount: scope.siteIds.length,
      });
      return NextResponse.json({
        ok: true,
        configured: true,
        tokens: [],
        limit,
        hasMore: false,
        nextCursor: null,
        message: "아직 연결 토큰이 없습니다.",
      });
    }

    let query = client
      .from("mcp_tokens")
      .select("id,label,site_id,org_id,scopes,disabled,last_used_at,created_at")
      .or(ownerFilter)
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .range(0, fetchLimit - 1);

    const cursorFilter = buildMcpTokenCursorFilter(cursor);
    if (cursorFilter) query = query.or(cursorFilter);

    const { data, error } = await query;

    if (error) throw error;

    const ownedRows = (data || [])
      .filter((token) => isTokenOwnedByScope(token, scope))
    const pageRows = ownedRows.slice(0, limit);
    const siteNameById = await loadSiteNamesForTokens(
      client,
      pageRows.map((token) => token.site_id).filter((id): id is string => Boolean(id)),
      scope.organizationIds,
    );
    const nextCursor = ownedRows.length > limit && pageRows.length
      ? encodeMcpTokenListCursor(pageRows[pageRows.length - 1])
      : null;
    const tokens = pageRows
      .map((token) => ({
        id: token.id,
        label: token.label || "내 AI 연결",
        siteName: token.site_id ? siteNameById.get(token.site_id) || "기본 현장" : "전체 현장",
        scopes: token.scopes,
        disabled: token.disabled,
        lastUsedAt: token.last_used_at,
        createdAt: token.created_at,
      }));

    return NextResponse.json({
      ok: true,
      configured: true,
      tokens,
      limit,
      hasMore: Boolean(nextCursor),
      nextCursor,
      message: tokens.length ? "연결 토큰 목록을 불러왔습니다." : "아직 연결 토큰이 없습니다.",
    });
  } catch (error) {
    console.error("mcp token list failed", error);
    return NextResponse.json({
      ok: false,
      configured: true,
      tokens: [],
      limit,
      hasMore: false,
      nextCursor: null,
      message: "연결 토큰 목록을 불러오지 못했습니다.",
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const client = createSupabaseAdminClient();
  if (!client) {
    return NextResponse.json({
      ok: false,
      configured: false,
      token: null,
      message: "Supabase 저장소가 아직 설정되지 않았습니다.",
    });
  }

  const user = await getWorkspaceUser(client, request.headers);
  if (!user) {
    return NextResponse.json({
      ok: false,
      configured: true,
      token: null,
      message: "관리자 로그인이 필요합니다.",
    }, { status: 401 });
  }

  const parsed = await request.json().catch((): unknown => ({}));
  const body = isRecord(parsed) ? parsed : {};
  const requestedLabel = typeof body.label === "string" ? body.label : undefined;

  try {
    const context = await ensureWorkspaceContext(client, user, {});
    const { data: site, error: siteError } = await client
      .from("sites")
      .select("id,name,organization_id")
      .eq("id", context.siteId)
      .single();

    if (siteError) throw siteError;

    const { count: activeTokenCount, error: countError } = await client
      .from("mcp_tokens")
      .select("id", { count: "exact", head: true })
      .eq("site_id", context.siteId)
      .eq("disabled", false);

    if (countError) throw countError;
    if (!canIssueMoreMcpTokens(activeTokenCount || 0)) {
      return NextResponse.json({
        ok: false,
        configured: true,
        token: null,
        message: "이 현장의 활성 연결 토큰이 너무 많습니다. 사용하지 않는 토큰을 끈 뒤 다시 발급해 주세요.",
      }, { status: 409 });
    }

    const plaintextToken = createPlaintextMcpToken();
    const label = buildMcpTokenLabel(site.name, requestedLabel);
    const insert = buildMcpTokenInsert({
      plaintextToken,
      label,
      siteId: context.siteId,
      orgId: context.organizationId,
    });

    const { data, error } = await client
      .from("mcp_tokens")
      .insert(insert)
      .select("id,label,site_id,org_id,scopes,disabled,last_used_at,created_at")
      .single();

    if (error) throw error;

    return NextResponse.json({
      ok: true,
      configured: true,
      plaintextToken,
      token: {
        id: data.id,
        label: data.label || label,
        siteName: site.name,
        scopes: data.scopes,
        disabled: data.disabled,
        lastUsedAt: data.last_used_at,
        createdAt: data.created_at,
      },
      message: "연결 토큰을 발급했습니다. 평문 토큰은 이 화면에서 한 번만 표시됩니다.",
    });
  } catch (error) {
    console.error("mcp token issue failed", error);
    return NextResponse.json({
      ok: false,
      configured: true,
      token: null,
      message: "연결 토큰 발급에 실패했습니다.",
    }, { status: 500 });
  }
}

