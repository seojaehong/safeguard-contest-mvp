import { NextRequest, NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  createSupabaseAdminClient,
  getWorkspaceUser,
  type WorkspaceDatabase,
  type WorkspaceUser,
} from "@/lib/supabase-admin";
import { isTokenOwnedByScope, type McpTokenOwnerScope } from "@/lib/mcp-token-service";

export const dynamic = "force-dynamic";

async function loadOwnerScope(
  client: SupabaseClient<WorkspaceDatabase>,
  user: WorkspaceUser
): Promise<McpTokenOwnerScope> {
  const { data: organizations, error: organizationError } = await client
    .from("organizations")
    .select("id")
    .eq("owner_id", user.id);

  if (organizationError) throw organizationError;
  const organizationIds = (organizations || []).map((organization) => organization.id);

  const { data: sites, error: siteError } = organizationIds.length
    ? await client
      .from("sites")
      .select("id")
      .in("organization_id", organizationIds)
    : { data: [], error: null };

  if (siteError) throw siteError;
  return {
    organizationIds,
    siteIds: (sites || []).map((site) => site.id),
  };
}

async function disableToken(request: NextRequest, id: string) {
  const client = createSupabaseAdminClient();
  if (!client) {
    return NextResponse.json({
      ok: false,
      configured: false,
      message: "Supabase 저장소가 아직 설정되지 않았습니다.",
    });
  }

  const user = await getWorkspaceUser(client, request.headers);
  if (!user) {
    return NextResponse.json({
      ok: false,
      configured: true,
      message: "관리자 로그인이 필요합니다.",
    }, { status: 401 });
  }

  try {
    const scope = await loadOwnerScope(client, user);
    const { data: token, error: selectError } = await client
      .from("mcp_tokens")
      .select("id,site_id,org_id,disabled")
      .eq("id", id)
      .maybeSingle();

    if (selectError) throw selectError;
    if (!token || !isTokenOwnedByScope(token, scope)) {
      return NextResponse.json({
        ok: false,
        configured: true,
        message: "해당 연결 토큰을 찾을 수 없습니다.",
      }, { status: 404 });
    }

    const { error: updateError } = await client
      .from("mcp_tokens")
      .update({ disabled: true })
      .eq("id", id);

    if (updateError) throw updateError;

    return NextResponse.json({
      ok: true,
      configured: true,
      message: token.disabled ? "이미 비활성화된 연결 토큰입니다." : "연결 토큰을 비활성화했습니다.",
    });
  } catch (error) {
    console.error("mcp token disable failed", error);
    return NextResponse.json({
      ok: false,
      configured: true,
      message: "연결 토큰 비활성화에 실패했습니다.",
    }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  return disableToken(request, id);
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  return disableToken(request, id);
}

