import { NextRequest, NextResponse } from "next/server";
import {
  createSupabaseAdminClient,
  ensureWorkspaceContext,
  getWorkspaceUser,
  type WorkspaceDatabase,
  type WorkspaceUser,
} from "@/lib/supabase-admin";
import {
  buildMcpTokenInsert,
  buildMcpTokenLabel,
  createPlaintextMcpToken,
  isTokenOwnedByScope,
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
): Promise<McpTokenOwnerScope & { organizations: OrganizationSummary[]; sites: SiteSummary[] }> {
  const { data: organizations, error: organizationError } = await client
    .from("organizations")
    .select("id,name")
    .eq("owner_id", user.id);

  if (organizationError) throw organizationError;

  const organizationIds = (organizations || []).map((organization) => organization.id);
  const { data: sites, error: siteError } = organizationIds.length
    ? await client
      .from("sites")
      .select("id,name,organization_id")
      .in("organization_id", organizationIds)
    : { data: [], error: null };

  if (siteError) throw siteError;

  return {
    organizations: organizations || [],
    sites: sites || [],
    organizationIds,
    siteIds: (sites || []).map((site) => site.id),
  };
}

export async function GET(request: NextRequest) {
  const client = createSupabaseAdminClient();
  if (!client) {
    return NextResponse.json({
      ok: false,
      configured: false,
      tokens: [],
      message: "Supabase 저장소가 아직 설정되지 않았습니다.",
    });
  }

  const user = await getWorkspaceUser(client, request.headers);
  if (!user) {
    return NextResponse.json({
      ok: false,
      configured: true,
      tokens: [],
      message: "관리자 로그인이 필요합니다.",
    }, { status: 401 });
  }

  try {
    const scope = await loadOwnerScope(client, user);
    if (!scope.organizationIds.length && !scope.siteIds.length) {
      return NextResponse.json({
        ok: true,
        configured: true,
        tokens: [],
        message: "아직 연결 토큰이 없습니다. 기본 현장을 만든 뒤 발급할 수 있습니다.",
      });
    }

    const { data, error } = await client
      .from("mcp_tokens")
      .select("id,label,site_id,org_id,scopes,disabled,last_used_at,created_at")
      .or([
        scope.organizationIds.length ? `org_id.in.(${scope.organizationIds.join(",")})` : "",
        scope.siteIds.length ? `site_id.in.(${scope.siteIds.join(",")})` : "",
      ].filter(Boolean).join(","))
      .order("created_at", { ascending: false });

    if (error) throw error;

    const siteNameById = new Map(scope.sites.map((site) => [site.id, site.name]));
    const tokens = (data || [])
      .filter((token) => isTokenOwnedByScope(token, scope))
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
      message: tokens.length ? "연결 토큰 목록을 불러왔습니다." : "아직 연결 토큰이 없습니다.",
    });
  } catch (error) {
    console.error("mcp token list failed", error);
    return NextResponse.json({
      ok: false,
      configured: true,
      tokens: [],
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

