import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient, getWorkspaceUser } from "@/lib/supabase-admin";
import { verifyAskResponseGenerationEvidence } from "@/lib/generation-evidence";
import { isRecord } from "@/lib/workspace-api";
import { parsePhaseAWorkpackIdempotencyBinding } from "@/lib/workpack-authority";
import {
  buildPhaseAWorkpackAuthority,
  buildPhaseAWorkpackIdempotencyBindingFromSeal,
  buildReopenData,
  phaseAWorkpackIdempotencyBindingsEqual,
} from "@/lib/workpack-store";

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
    .select("id,organization_id,site_id,created_by,question,scenario,deliverables,evidence_summary,worker_summary,status,created_at,updated_at")
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
  const storedEvidenceSummary = isRecord(workpack.evidence_summary)
    ? workpack.evidence_summary
    : null;
  const storedIdempotency = parsePhaseAWorkpackIdempotencyBinding(
    storedEvidenceSummary?.workpackAuthorityBinding,
  );
  const verification = reopen.data
    ? verifyAskResponseGenerationEvidence(
        reopen.data,
        process.env.SAFECLAW_GENERATION_EVIDENCE_SECRET,
      )
    : null;
  const expectedIdempotency = storedIdempotency && workpack.created_by === user.id
    ? buildPhaseAWorkpackIdempotencyBindingFromSeal({
        organizationId: workpack.organization_id,
        siteId: workpack.site_id,
        userId: user.id,
        generationSealAtCreate: storedIdempotency.generationSealAtCreate,
      })
    : null;
  const exactServerAuthority = Boolean(
    reopen.data
    && verification?.ok
    && storedIdempotency
    && expectedIdempotency
    && workpack.id === storedIdempotency.deterministicId
    && phaseAWorkpackIdempotencyBindingsEqual(storedIdempotency, expectedIdempotency)
  );
  const authority = exactServerAuthority && reopen.data && storedIdempotency
    ? buildPhaseAWorkpackAuthority({
        workpackId: workpack.id,
        revision: workpack.updated_at,
        response: reopen.data,
        idempotency: storedIdempotency,
      })
    : null;
  const blockers = [...reopen.blockers];
  if (!storedIdempotency) {
    blockers.push("서버 workpack 행에 결정적 생성 바인딩이 없어 권위 연결을 확인할 수 없습니다.");
  } else if (!expectedIdempotency || !phaseAWorkpackIdempotencyBindingsEqual(storedIdempotency, expectedIdempotency)) {
    blockers.push("서버 workpack 행의 사용자·조직·현장 생성 바인딩이 현재 권한 범위와 일치하지 않습니다.");
  }
  if (verification?.ok === false) {
    blockers.push(`서버 generation seal 재검증 실패: ${verification.message}`);
  }
  if (reopen.data && verification?.ok && storedIdempotency && workpack.id !== storedIdempotency.deterministicId) {
    blockers.push("서버 workpack ID가 저장된 결정적 생성 바인딩과 일치하지 않습니다.");
  }

  return NextResponse.json({
    ok: exactServerAuthority,
    configured: true,
    canReopen: exactServerAuthority,
    authority,
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
      reopenData: exactServerAuthority ? reopen.data : null
    },
    blockers,
    message: exactServerAuthority
      ? "서버 행 ID, revision, 생성 봉인을 재검증해 저장된 문서팩을 불러왔습니다."
      : "저장된 문서팩은 조회됐지만 서버 권위 바인딩을 재검증하지 못해 연결과 내보내기를 차단했습니다."
  }, {
    status: verification?.ok === false && verification.code === "secret_unconfigured" ? 503 : 200,
    headers: { "cache-control": "no-store" },
  });
}
