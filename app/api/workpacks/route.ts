import { NextRequest, NextResponse } from "next/server";
import {
  createSupabaseAdminClient,
  getWorkspaceUser,
  resolveAuthenticatedWorkspaceContext,
} from "@/lib/supabase-admin";
import { documentKeysFromDeliverables } from "@/lib/evidence-file";
import type { AskResponse } from "@/lib/types";
import { isRecord, parseScenarioContext } from "@/lib/workspace-api";
import { verifyAskResponseGenerationEvidence } from "@/lib/generation-evidence";
import {
  buildPhaseAWorkpackAuthority,
  buildPhaseAWorkpackIdempotencyBinding,
  buildReopenData,
  buildWorkpackEvidenceSummary,
  buildWorkpackInsertPayload,
  phaseAWorkpackIdempotencyBindingsEqual,
} from "@/lib/workpack-store";
import { parsePhaseAWorkpackIdempotencyBinding } from "@/lib/workpack-authority";

export const dynamic = "force-dynamic";

function readAskResponse(value: unknown): AskResponse | null {
  if (!isRecord(value)) return null;
  if (
    typeof value.question !== "string" ||
    !isRecord(value.scenario) ||
    !isRecord(value.deliverables) ||
    !isRecord(value.externalData) ||
    !isRecord(value.riskSummary) ||
    !isRecord(value.status)
  ) {
    return null;
  }
  return value as AskResponse;
}

function databaseErrorCode(error: unknown): string | null {
  return isRecord(error) && typeof error.code === "string" ? error.code : null;
}

function workspaceContextError(error: unknown): { code: string; message: string; status: number } | null {
  if (
    !isRecord(error)
    || typeof error.code !== "string"
    || !error.code.startsWith("workspace_scope_")
    || error.status !== 409
    || typeof error.message !== "string"
  ) {
    return null;
  }
  return { code: error.code, message: error.message, status: error.status };
}

export async function GET(request: NextRequest) {
  const client = createSupabaseAdminClient();
  if (!client) {
    return NextResponse.json({
      ok: true,
      configured: false,
      workpacks: [],
      summary: {
        savedWorkpackCount: 0,
        lastGeneratedAt: null
      },
      message: "서버 아카이브 연결 전입니다. 운영 저장소를 연결하면 저장된 문서팩 이력이 표시됩니다."
    });
  }

  const user = await getWorkspaceUser(client, request.headers);
  if (!user) {
    return NextResponse.json({
      ok: false,
      configured: true,
      workpacks: [],
      summary: {
        savedWorkpackCount: 0,
        lastGeneratedAt: null
      },
      message: "관리자 세션이 확인되면 저장된 문서팩 이력을 불러옵니다."
    }, { status: 401 });
  }

  const limitParam = Number(request.nextUrl.searchParams.get("limit") || "20");
  const limit = Number.isFinite(limitParam) ? Math.min(Math.max(limitParam, 1), 50) : 20;

  const { data: organizations, error: organizationError } = await client
    .from("organizations")
    .select("id,name")
    .eq("owner_id", user.id);

  if (organizationError) {
    console.error("workpack archive organization fetch failed", organizationError);
    return NextResponse.json({
      ok: false,
      configured: true,
      workpacks: [],
      summary: {
        savedWorkpackCount: 0,
        lastGeneratedAt: null
      },
      message: "현재 작업 이력 저장소 응답을 확인하는 중입니다. 잠시 후 다시 조회해 주세요."
    }, { status: 500 });
  }

  const organizationIds = (organizations || []).map((organization) => organization.id);
  if (!organizationIds.length) {
    return NextResponse.json({
      ok: true,
      configured: true,
      workpacks: [],
      summary: {
        savedWorkpackCount: 0,
        lastGeneratedAt: null
      },
      message: "아직 저장된 문서팩 이력이 없습니다. 작업공간에서 문서팩을 저장하면 이곳에 표시됩니다."
    });
  }

  const { data: workpacks, error: workpackError } = await client
    .from("workpacks")
    .select("id,organization_id,site_id,question,scenario,deliverables,worker_summary,status,created_at,updated_at")
    .in("organization_id", organizationIds)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (workpackError) {
    console.error("workpack archive fetch failed", workpackError);
    return NextResponse.json({
      ok: false,
      configured: true,
      workpacks: [],
      summary: {
        savedWorkpackCount: 0,
        lastGeneratedAt: null
      },
      message: "문서팩 이력을 불러오지 못했습니다. 로컬 최근 작업은 계속 사용할 수 있습니다."
    }, { status: 500 });
  }

  const siteIds = Array.from(new Set((workpacks || []).map((workpack) => workpack.site_id).filter((id): id is string => Boolean(id))));
  const { data: sites, error: siteError } = siteIds.length
    ? await client.from("sites").select("id,name,industry,region").in("id", siteIds)
    : { data: [], error: null };

  if (siteError) {
    console.error("workpack archive site fetch failed", siteError);
  }

  const siteMap = new Map((sites || []).map((site) => [site.id, site]));
  const organizationMap = new Map((organizations || []).map((organization) => [organization.id, organization.name]));

  const archiveWorkpacks = (workpacks || []).map((workpack) => {
    const site = workpack.site_id ? siteMap.get(workpack.site_id) : null;
    const encodedId = encodeURIComponent(workpack.id);
    return {
      id: workpack.id,
      organizationName: organizationMap.get(workpack.organization_id) || "SafeClaw Pilot",
      siteName: site?.name || "기본 현장",
      industry: site?.industry || null,
      region: site?.region || null,
      question: workpack.question,
      scenario: workpack.scenario,
      documentKeys: documentKeysFromDeliverables(workpack.deliverables),
      workerSummary: workpack.worker_summary,
      status: workpack.status,
      createdAt: workpack.created_at,
      updatedAt: workpack.updated_at,
      lastGeneratedAt: workpack.updated_at || workpack.created_at,
      reopenHref: `/documents?workpackId=${encodedId}`,
      editHref: `/documents?workpackId=${encodedId}`
    };
  });

  return NextResponse.json({
    ok: true,
    configured: true,
    workpacks: archiveWorkpacks,
    summary: {
      savedWorkpackCount: archiveWorkpacks.length,
      lastGeneratedAt: archiveWorkpacks[0]?.lastGeneratedAt || null
    },
    message: archiveWorkpacks.length
      ? "저장된 문서팩 이력을 불러왔습니다."
      : "아직 저장된 문서팩 이력이 없습니다. 작업공간에서 문서팩을 저장하면 이곳에 표시됩니다."
  });
}

export async function POST(request: NextRequest) {
  const client = createSupabaseAdminClient();
  if (!client) {
    return NextResponse.json({ ok: false, configured: false, workpackId: null, message: "Supabase 저장소가 아직 설정되지 않았습니다." });
  }

  const user = await getWorkspaceUser(client, request.headers);
  if (!user) {
    return NextResponse.json({ ok: false, configured: true, workpackId: null, message: "관리자 로그인이 필요합니다." }, { status: 401 });
  }

  const parsed = await request.json().catch((): unknown => ({}));
  const body = isRecord(parsed) ? parsed : {};
  const askResponse = readAskResponse(body.data);
  if (!askResponse) {
    return NextResponse.json({
      ok: false,
      configured: true,
      workpackId: null,
      code: "generation_evidence_unsealed",
      message: "봉인된 서버 생성 결과 전체가 필요합니다. 다시 생성한 뒤 저장해 주세요."
    }, { status: 400 });
  }

  const verification = verifyAskResponseGenerationEvidence(
    askResponse,
    process.env.SAFECLAW_GENERATION_EVIDENCE_SECRET
  );
  if (!verification.ok) {
    const secretMissing = verification.code === "secret_unconfigured";
    return NextResponse.json({
      ok: false,
      configured: true,
      workpackId: null,
      code: secretMissing
        ? "generation_evidence_secret_unconfigured"
        : `generation_evidence_${verification.code}`,
      message: verification.message
    }, { status: secretMissing ? 503 : 400 });
  }

  const question = verification.snapshot.question;
  const scenario = verification.snapshot.scenario;
  const deliverables = askResponse.deliverables;
  const status = askResponse.status;
  if (askResponse.phaseAReview?.humanConfirmation.status === "confirmed") {
    return NextResponse.json({
      ok: false,
      configured: true,
      workpackId: null,
      code: "confirmed_workpack_authority_required",
      message: "확인 완료 작업팩은 새 행으로 저장할 수 없습니다. 정확한 서버 작업팩 ID를 다시 검증해 재개해야 합니다.",
    }, { status: 409, headers: { "cache-control": "no-store" } });
  }
  let context;
  try {
    context = await resolveAuthenticatedWorkspaceContext(
      client,
      user,
      body.workspaceScope,
      parseScenarioContext(scenario),
    );
  } catch (error) {
    const scopeError = workspaceContextError(error);
    if (scopeError) {
      return NextResponse.json({
        ok: false,
        configured: true,
        workpackId: null,
        code: scopeError.code,
        message: scopeError.message,
      }, { status: scopeError.status, headers: { "cache-control": "no-store" } });
    }
    console.error("workpack workspace context resolution failed", {
      errorCode: databaseErrorCode(error) || "unknown",
    });
    return NextResponse.json({
      ok: false,
      configured: true,
      workpackId: null,
      code: "workspace_scope_resolution_failed",
      message: "조직과 현장 권한을 확인하지 못했습니다.",
    }, { status: 500, headers: { "cache-control": "no-store" } });
  }
  const idempotency = buildPhaseAWorkpackIdempotencyBinding({
    organizationId: context.organizationId,
    siteId: context.siteId,
    userId: user.id,
    response: askResponse,
  });
  const workpackId = idempotency.deterministicId;
  const authoritativeEvidenceSummary = buildWorkpackEvidenceSummary(
    askResponse,
    verification.snapshot,
    idempotency,
  );

  const { data, error } = await client
    .from("workpacks")
    .insert(buildWorkpackInsertPayload({
      id: workpackId,
      organizationId: context.organizationId,
      siteId: context.siteId,
      question,
      scenario,
      deliverables,
      evidenceSummary: authoritativeEvidenceSummary,
      workerSummary: body.workerSummary || {},
      status,
      createdBy: user.id
    }))
    .select("id,organization_id,site_id,created_by,question,scenario,deliverables,evidence_summary,status,created_at,updated_at")
    .single();

  if (error) {
    if (databaseErrorCode(error) !== "23505") {
      console.error("workpack save failed", { errorCode: databaseErrorCode(error) || "unknown" });
      return NextResponse.json({ ok: false, configured: true, workpackId: null, message: "문서팩 저장에 실패했습니다." }, { status: 500 });
    }

    const { data: existing, error: existingError } = await client
      .from("workpacks")
      .select("id,organization_id,site_id,created_by,question,scenario,deliverables,evidence_summary,status,created_at,updated_at")
      .eq("id", workpackId)
      .maybeSingle();
    if (existingError) {
      console.error("workpack idempotent reopen failed", {
        errorCode: databaseErrorCode(existingError) || "unknown",
      });
      return NextResponse.json({
        ok: false,
        configured: true,
        workpackId: null,
        code: "workpack_idempotency_lookup_failed",
        message: "기존 작업팩 재개 여부를 확인하지 못했습니다.",
      }, { status: 500 });
    }

    const existingEvidenceSummary = existing && isRecord(existing.evidence_summary)
      ? existing.evidence_summary
      : null;
    const existingIdempotency = parsePhaseAWorkpackIdempotencyBinding(
      existingEvidenceSummary?.workpackAuthorityBinding,
    );
    const ownedExactScope = Boolean(
      existing
      && existing.id === workpackId
      && existing.organization_id === context.organizationId
      && existing.site_id === context.siteId
      && existing.created_by === user.id
    );
    if (!existing || !ownedExactScope || !existingIdempotency || !phaseAWorkpackIdempotencyBindingsEqual(existingIdempotency, idempotency)) {
      return NextResponse.json({
        ok: false,
        configured: true,
        workpackId: null,
        code: "workpack_idempotency_collision",
        message: "서버 작업팩 ID 충돌을 안전하게 재개할 수 없어 저장을 차단했습니다.",
      }, { status: 409 });
    }

    const reopened = buildReopenData({
      question: existing.question,
      scenario: existing.scenario,
      deliverables: existing.deliverables,
      evidenceSummary: existing.evidence_summary,
      status: existing.status,
    });
    const reopenedVerification = reopened.data
      ? verifyAskResponseGenerationEvidence(reopened.data, process.env.SAFECLAW_GENERATION_EVIDENCE_SECRET)
      : null;
    if (!reopened.data || !reopenedVerification?.ok) {
      const secretMissing = reopenedVerification?.ok === false
        && reopenedVerification.code === "secret_unconfigured";
      return NextResponse.json({
        ok: false,
        configured: true,
        workpackId: null,
        code: secretMissing
          ? "generation_evidence_secret_unconfigured"
          : "workpack_idempotency_reopen_unverified",
        message: secretMissing
          ? reopenedVerification.message
          : "기존 작업팩의 서버 생성 봉인을 재검증하지 못해 재개를 차단했습니다.",
      }, { status: secretMissing ? 503 : 409 });
    }
    const authority = buildPhaseAWorkpackAuthority({
      workpackId,
      revision: existing.updated_at,
      response: reopened.data,
      idempotency: existingIdempotency,
    });
    return NextResponse.json({
      ok: true,
      configured: true,
      workpackId,
      created: false,
      reopened: true,
      authority,
      workpack: reopened.data,
      message: "기존 서버 작업팩과 생성 봉인을 재검증해 같은 작업을 재개했습니다.",
    }, { headers: { "cache-control": "no-store" } });
  }

  const authority = buildPhaseAWorkpackAuthority({
    workpackId: data.id,
    revision: data.updated_at,
    response: askResponse,
    idempotency,
  });
  return NextResponse.json({
    ok: true,
    configured: true,
    workpackId: data.id,
    created: true,
    reopened: false,
    authority,
    workpack: askResponse,
    message: "문서팩과 작업 배치 요약을 저장했습니다.",
  }, { headers: { "cache-control": "no-store" } });
}
