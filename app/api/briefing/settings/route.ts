// 아침 브리핑 설정 API — 로그인 사용자가 자기 사이트의 브리핑 설정
// (briefing_enabled / briefing_question / briefing_email)을 조회·저장한다.
// 인증은 기존 워크스페이스 API(app/api/workpacks 등)와 동일한
// getWorkspaceUser(Bearer 토큰) 패턴을 재사용한다.

import { NextRequest, NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  createSupabaseAdminClient,
  ensureWorkspaceContext,
  getWorkspaceUser,
  type WorkspaceDatabase,
  type WorkspaceUser
} from "@/lib/supabase-admin";
import { isRecord } from "@/lib/workspace-api";
import { resolveBriefingEmailDispatchStatus } from "@/lib/server/briefing-dispatch-status";
import {
  AUTHENTICATED_BRIEFING_REQUEST_MAX_BYTES,
  enforceAuthenticatedJsonRequestBodyBudget,
} from "@/lib/public-work-budget";

export const dynamic = "force-dynamic";

type BriefingSettings = {
  enabled: boolean;
  question: string;
  email: string;
};

const DEFAULT_SETTINGS: BriefingSettings = { enabled: false, question: "", email: "" };

/** 사용자의 첫 조직 → 첫 사이트를 읽기 전용으로 찾는다(없으면 null — 암묵 생성 금지). */
async function findOwnedSite(client: SupabaseClient<WorkspaceDatabase>, user: WorkspaceUser) {
  const { data: organization, error: organizationError } = await client
    .from("organizations")
    .select("id")
    .eq("owner_id", user.id)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (organizationError) throw organizationError;
  if (!organization) return null;

  const { data: site, error: siteError } = await client
    .from("sites")
    .select("id,name,briefing_enabled,briefing_question,briefing_email")
    .eq("organization_id", organization.id)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (siteError) throw siteError;
  return site;
}

export async function GET(request: NextRequest) {
  const dispatch = resolveBriefingEmailDispatchStatus();
  const client = createSupabaseAdminClient();
  if (!client) {
    return NextResponse.json({
      ok: false,
      configured: false,
      dispatch,
      settings: DEFAULT_SETTINGS,
      message: "Supabase 저장소가 아직 설정되지 않았습니다."
    });
  }

  const user = await getWorkspaceUser(client, request.headers);
  if (!user) {
    return NextResponse.json({
      ok: false,
      configured: true,
      dispatch,
      settings: DEFAULT_SETTINGS,
      message: "관리자 로그인이 필요합니다."
    }, { status: 401 });
  }

  try {
    const site = await findOwnedSite(client, user);
    return NextResponse.json({
      ok: true,
      configured: true,
      dispatch,
      siteName: site?.name || null,
      settings: site
        ? {
          enabled: Boolean(site.briefing_enabled),
          question: site.briefing_question || "",
          email: site.briefing_email || user.email || ""
        }
        : { ...DEFAULT_SETTINGS, email: user.email || "" },
      message: site ? "브리핑 설정을 불러왔습니다." : "아직 저장된 사이트가 없습니다. 저장하면 기본 현장이 만들어집니다."
    });
  } catch (error) {
    console.error("briefing settings fetch failed", error);
    return NextResponse.json({
      ok: false,
      configured: true,
      dispatch,
      settings: DEFAULT_SETTINGS,
      message: "브리핑 설정을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요."
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const dispatch = resolveBriefingEmailDispatchStatus();
  const client = createSupabaseAdminClient();
  if (!client) {
    return NextResponse.json({ ok: false, configured: false, dispatch, message: "Supabase 저장소가 아직 설정되지 않았습니다." });
  }

  const user = await getWorkspaceUser(client, request.headers);
  if (!user) {
    return NextResponse.json({ ok: false, configured: true, dispatch, message: "관리자 로그인이 필요합니다." }, { status: 401 });
  }

  const bodyBudget = await enforceAuthenticatedJsonRequestBodyBudget(request, AUTHENTICATED_BRIEFING_REQUEST_MAX_BYTES);
  if (!bodyBudget.ok) return bodyBudget.response;
  const parsed = await bodyBudget.request.json().catch((): unknown => ({}));
  const body = isRecord(parsed) ? parsed : {};

  const enabled = body.enabled === true;
  const question = typeof body.question === "string" ? body.question.trim().slice(0, 500) : "";
  const email = typeof body.email === "string" ? body.email.trim().slice(0, 200) : "";

  if (enabled && (!question || !email.includes("@"))) {
    return NextResponse.json({
      ok: false,
      configured: true,
      dispatch,
      message: "브리핑을 켜려면 작업 설명과 유효한 수신 이메일이 필요합니다."
    }, { status: 400 });
  }

  try {
    const context = await ensureWorkspaceContext(client, user, {});

    const { error } = await client
      .from("sites")
      .update({
        briefing_enabled: enabled,
        briefing_question: question || null,
        briefing_email: email || null,
        updated_at: new Date().toISOString()
      })
      .eq("id", context.siteId);

    if (error) throw error;

    return NextResponse.json({
      ok: true,
      configured: true,
      dispatch,
      settings: { enabled, question, email },
      message: enabled
        ? dispatch.emailReady
          ? "아침 브리핑을 켰습니다. 매일 06:00(KST)에 문서팩 생성과 이메일 발송이 실행됩니다."
          : "아침 문서팩 자동 생성을 켰습니다. 이메일 실제 발송은 중복 방지 저장 계약 승인 전까지 잠겨 있습니다."
        : "아침 브리핑 설정을 저장했습니다(현재 꺼짐)."
    });
  } catch (error) {
    console.error("briefing settings save failed", error);
    return NextResponse.json({
      ok: false,
      configured: true,
      dispatch,
      message: "브리핑 설정 저장에 실패했습니다. 마이그레이션(005_briefing_settings.sql) 적용 여부를 확인해 주세요."
    }, { status: 500 });
  }
}
