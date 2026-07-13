import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient, getWorkspaceUser } from "@/lib/supabase-admin";
import { verifyAskResponseGenerationEvidence } from "@/lib/generation-evidence";
import {
  readReviewedLocalizationEnvelopes,
  resolveReviewedLocalizationAuthority
} from "@/lib/reviewed-localization-envelope";
import { buildReopenData } from "@/lib/workpack-store";
import { readWorkpackShareServerConfig } from "@/lib/workpack-share-server-config";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(request: NextRequest, context: RouteContext) {
  const client = createSupabaseAdminClient();
  if (!client) {
    return NextResponse.json({
      ok: false,
      configured: false,
      canReopen: false,
      workpack: null,
      blockers: ["Supabase 관리자 저장소가 설정되지 않았습니다."],
      message: "서버 아카이브 연결 전입니다. 로컬 최근 작업만 다시 열 수 있습니다."
    });
  }

  const user = await getWorkspaceUser(client, request.headers);
  if (!user) {
    return NextResponse.json({
      ok: false,
      configured: true,
      canReopen: false,
      workpack: null,
      blockers: ["관리자 세션이 필요합니다."],
      message: "관리자 로그인 후 저장된 문서팩 상세를 불러올 수 있습니다."
    }, { status: 401 });
  }

  const { id } = await context.params;
  if (!id) {
    return NextResponse.json({
      ok: false,
      configured: true,
      canReopen: false,
      workpack: null,
      blockers: ["문서팩 ID가 없습니다."],
      message: "다시 열 문서팩 ID를 확인해야 합니다."
    }, { status: 400 });
  }

  const { data: organizations, error: organizationError } = await client
    .from("organizations")
    .select("id")
    .eq("owner_id", user.id);

  if (organizationError) {
    console.error("workpack detail organization fetch failed", organizationError);
    return NextResponse.json({
      ok: false,
      configured: true,
      canReopen: false,
      workpack: null,
      blockers: ["사용자 조직 조회에 실패했습니다."],
      message: "문서팩 권한 확인 중 오류가 발생했습니다."
    }, { status: 500 });
  }

  const organizationIds = (organizations || []).map((organization) => organization.id);
  if (!organizationIds.length) {
    return NextResponse.json({
      ok: false,
      configured: true,
      canReopen: false,
      workpack: null,
      blockers: ["현재 관리자 계정에 연결된 조직이 없습니다."],
      message: "이 계정에서 접근 가능한 문서팩 이력이 없습니다."
    }, { status: 404 });
  }

  const { data: workpack, error: workpackError } = await client
    .from("workpacks")
    .select("id,organization_id,site_id,question,scenario,deliverables,evidence_summary,worker_summary,status,created_at,updated_at")
    .eq("id", id)
    .in("organization_id", organizationIds)
    .maybeSingle();

  if (workpackError) {
    console.error("workpack detail fetch failed", workpackError);
    return NextResponse.json({
      ok: false,
      configured: true,
      canReopen: false,
      workpack: null,
      blockers: ["workpacks 상세 조회에 실패했습니다."],
      message: "문서팩 상세를 불러오지 못했습니다."
    }, { status: 500 });
  }

  if (!workpack) {
    return NextResponse.json({
      ok: false,
      configured: true,
      canReopen: false,
      workpack: null,
      blockers: ["요청한 문서팩을 찾을 수 없거나 현재 계정 권한 밖입니다."],
      message: "저장된 문서팩 상세를 찾지 못했습니다."
    }, { status: 404 });
  }

  const reopen = buildReopenData({
    question: workpack.question,
    scenario: workpack.scenario,
    deliverables: workpack.deliverables,
    evidenceSummary: workpack.evidence_summary,
    status: workpack.status
  });
  const shareLocalization = (() => {
    if (!reopen.data) {
      return {
        ok: false as const,
        reasonCode: "workpack_unavailable" as const
      };
    }
    const generationVerification = verifyAskResponseGenerationEvidence(
      reopen.data,
      process.env.SAFECLAW_GENERATION_EVIDENCE_SECRET
    );
    if (!generationVerification.ok) {
      return {
        ok: false as const,
        reasonCode: "generation_evidence_invalid" as const,
        code: generationVerification.code
      };
    }
    const serverConfig = readWorkpackShareServerConfig(process.env);
    if (!serverConfig.ok) {
      return {
        ok: false as const,
        reasonCode: "configuration_unresolved" as const,
        invalidConfigurationKeys: serverConfig.invalidKeys
      };
    }
    const authority = resolveReviewedLocalizationAuthority({
      workpackId: workpack.id,
      response: reopen.data,
      reviewedEnvelopes: readReviewedLocalizationEnvelopes(workpack.evidence_summary),
      recipients: [],
      secret: serverConfig.config.reviewedLocalizationSecret
    });
    if (!authority.ok) return authority;
    return {
      ok: true as const,
      canonicalWorkpackRevision: authority.canonicalWorkpackRevision,
      normalizedWorkpackDigest: authority.normalizedWorkpackDigest,
      reviewedEnvelopes: authority.verifiedEnvelopes
    };
  })();

  return NextResponse.json({
    ok: true,
    configured: true,
    canReopen: Boolean(reopen.data),
    workpack: {
      id: workpack.id,
      question: workpack.question,
      scenario: workpack.scenario,
      deliverables: workpack.deliverables,
      evidenceSummary: workpack.evidence_summary,
      workerSummary: workpack.worker_summary,
      status: workpack.status,
      createdAt: workpack.created_at,
      updatedAt: workpack.updated_at,
      reopenData: reopen.data
    },
    shareLocalization,
    blockers: reopen.blockers,
    message: reopen.data
      ? "저장된 문서팩 상세를 불러왔습니다."
      : "저장된 문서팩은 조회됐지만 현재 저장 형식만으로는 문서팩 화면을 완전히 복원할 수 없습니다."
  });
}
