import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";

import {
  buildAuthenticatedPhaseAReviewerPrincipal,
  issuePhaseAReviewConfirmation,
  PhaseAConfirmationError,
} from "@/lib/phase-a-confirmation";
import { EVIDENCE_CHAIN_REGISTRY } from "@/lib/ontology/evidence-chain-registry";
import type { PhaseAPlanBinding } from "@/lib/ontology/evidence-chain";
import { applyPhaseADocumentAuthorityMarker } from "@/lib/phase-a-review";
import { attachQualityContract } from "@/lib/quality-contract";
import {
  attachGenerationEvidence,
  verifyAskResponseGenerationEvidence,
} from "@/lib/generation-evidence";
import { createLogger } from "@/lib/logger";
import {
  createSupabaseAdminClient,
  getWorkspaceUser,
  toJson,
  type WorkspaceDatabase,
} from "@/lib/supabase-admin";
import { loadOwnedWorkpackOperationContext } from "@/lib/workpack-commercial-store";
import { buildWorkpackEvidenceSummary } from "@/lib/workpack-store";
import type { AskResponse } from "@/lib/types";

export const dynamic = "force-dynamic";

const log = createLogger("workpacks/phase-a-confirmation");
const PLAN_DIGEST_PATTERN = /^sha256:[a-f0-9]{64}$/;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const DOCUMENT_KEYS = [
  "workpackSummaryDraft",
  "riskAssessmentDraft",
  "workPlanDraft",
  "tbmBriefing",
  "tbmLogDraft",
  "safetyEducationRecordDraft",
  "emergencyResponseDraft",
  "photoEvidenceDraft",
  "foreignWorkerBriefing",
  "foreignWorkerTransmission",
  "kakaoMessage",
] as const;

type RouteContext = {
  params: Promise<{ id: string }>;
};

type ConfirmationRequest = {
  chainId: PhaseAPlanBinding["chainId"];
  planDigest: string;
  confirmationId?: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseConfirmationRequest(value: unknown): ConfirmationRequest | null {
  if (!isRecord(value) || typeof value.chainId !== "string" || typeof value.planDigest !== "string") {
    return null;
  }
  const chainId = EVIDENCE_CHAIN_REGISTRY.find((item) => item.chainId === value.chainId)?.chainId ?? null;
  if (!chainId || !PLAN_DIGEST_PATTERN.test(value.planDigest)) return null;
  if (typeof value.confirmationId !== "undefined") {
    if (typeof value.confirmationId !== "string" || !UUID_PATTERN.test(value.confirmationId)) return null;
    return { chainId, planDigest: value.planDigest, confirmationId: value.confirmationId };
  }
  return { chainId, planDigest: value.planDigest };
}

function confirmedDocuments(
  deliverables: AskResponse["deliverables"],
  review: NonNullable<AskResponse["phaseAReview"]>,
): AskResponse["deliverables"] {
  const next = { ...deliverables };
  for (const key of DOCUMENT_KEYS) {
    next[key] = applyPhaseADocumentAuthorityMarker(next[key], review);
  }
  return next;
}

function errorType(error: unknown): string {
  return error instanceof Error ? error.name : typeof error;
}

function nextWorkpackRevision(currentRevision: string, now: Date): string {
  const currentRevisionMs = Date.parse(currentRevision);
  const nextRevisionMs = Number.isFinite(currentRevisionMs)
    ? Math.max(now.getTime(), currentRevisionMs + 1)
    : now.getTime();
  return new Date(nextRevisionMs).toISOString();
}

function revisionConflictResponse(confirmationId?: string) {
  return NextResponse.json({
    ok: false,
    code: "phase_a_confirmation_revision_conflict",
    ...(confirmationId ? { confirmationId } : {}),
    message: confirmationId
      ? "다른 요청이 먼저 확인을 저장했습니다. 반환된 확인 ID로 멱등 재시도하세요."
      : "다른 요청이 먼저 작업팩을 변경했습니다. 최신 상태를 다시 확인하세요.",
  }, { status: 409, headers: { "cache-control": "no-store" } });
}

export async function POST(request: NextRequest, context: RouteContext) {
  const client = createSupabaseAdminClient();
  if (!client) {
    return NextResponse.json({
      ok: false,
      code: "phase_a_confirmation_store_unconfigured",
      message: "Phase A 확인 저장소가 설정되지 않았습니다.",
    }, { status: 503, headers: { "cache-control": "no-store" } });
  }

  const user = await getWorkspaceUser(client, request.headers);
  const principal = user
    ? buildAuthenticatedPhaseAReviewerPrincipal({
        userId: user.id,
        authorization: request.headers.get("authorization") ?? "",
      })
    : null;
  if (!user || !principal) {
    return NextResponse.json({
      ok: false,
      code: "phase_a_confirmation_auth_required",
      message: "인증된 검토자 세션이 필요합니다.",
    }, { status: 401, headers: { "cache-control": "no-store" } });
  }

  const parsed = parseConfirmationRequest(await request.json().catch((): unknown => null));
  if (!parsed) {
    return NextResponse.json({
      ok: false,
      code: "phase_a_confirmation_request_invalid",
      message: "서버 plan binding과 일치하는 확인 요청이 필요합니다.",
    }, { status: 400, headers: { "cache-control": "no-store" } });
  }

  const { id } = await context.params;
  const owned = await loadOwnedWorkpackOperationContext(client, user, id);
  if (!owned.ok) {
    return NextResponse.json({
      ok: false,
      code: "phase_a_confirmation_workpack_unavailable",
      message: owned.message,
    }, { status: owned.status, headers: { "cache-control": "no-store" } });
  }
  const stored = owned.context.shareAuthority.workpack;
  if (!stored?.phaseAReview) {
    return NextResponse.json({
      ok: false,
      code: "phase_a_confirmation_review_unavailable",
      message: "서버에서 검증 가능한 Phase A 검토 상태가 없습니다.",
    }, { status: 409, headers: { "cache-control": "no-store" } });
  }

  const secret = process.env.SAFECLAW_GENERATION_EVIDENCE_SECRET;
  const existingEvidence = verifyAskResponseGenerationEvidence(stored, secret);
  if (!existingEvidence.ok) {
    return NextResponse.json({
      ok: false,
      code: "phase_a_confirmation_generation_evidence_invalid",
      message: "서버 생성 근거 봉인을 확인할 수 없어 Phase A 확인을 저장하지 않았습니다.",
    }, {
      status: existingEvidence.code === "secret_unconfigured" ? 503 : 409,
      headers: { "cache-control": "no-store" },
    });
  }

  try {
    const wasAlreadyConfirmed = stored.phaseAReview.humanConfirmation.status === "confirmed";
    const confirmationNow = new Date();
    const confirmedReview = issuePhaseAReviewConfirmation({
      review: stored.phaseAReview,
      workpackId: owned.context.workpackId,
      principal,
      requestedBinding: parsed,
      requestedConfirmationId: parsed.confirmationId,
      now: confirmationNow,
      createConfirmationId: randomUUID,
    });
    if (wasAlreadyConfirmed) {
      return NextResponse.json({
        ok: true,
        confirmationId: confirmedReview.humanConfirmation.status === "confirmed"
          ? confirmedReview.humanConfirmation.confirmationId
          : null,
        phaseAReview: confirmedReview,
        workpack: stored,
        message: "기존 Phase A 확인을 멱등하게 재사용했습니다.",
      }, { headers: { "cache-control": "no-store" } });
    }
    const confirmedAt = confirmedReview.humanConfirmation.status === "confirmed"
      ? confirmedReview.humanConfirmation.confirmedAt
      : confirmationNow.toISOString();
    const confirmedResponse = attachQualityContract({
      ...stored,
      answer: applyPhaseADocumentAuthorityMarker(stored.answer, confirmedReview),
      deliverables: confirmedDocuments(stored.deliverables, confirmedReview),
      phaseAReview: confirmedReview,
      status: {
        ...stored.status,
        summary: "Phase A 근거 및 사람 확인 완료",
      },
      generationEvidence: undefined,
      generationEvidenceError: undefined,
    }, confirmedAt);
    const resealed = attachGenerationEvidence(confirmedResponse, {
      secret,
      generatedAt: existingEvidence.snapshot.generatedAt,
    });
    const resealedVerification = verifyAskResponseGenerationEvidence(resealed, secret);
    if (!resealedVerification.ok || !resealed.generationEvidence) {
      return NextResponse.json({
        ok: false,
        code: "phase_a_confirmation_reseal_failed",
        message: "Phase A 확인 결과를 서버에서 다시 봉인하지 못했습니다.",
      }, { status: 500, headers: { "cache-control": "no-store" } });
    }

    const evidenceSummary = buildWorkpackEvidenceSummary(
      resealed,
      resealedVerification.snapshot,
    );
    const update: WorkspaceDatabase["public"]["Tables"]["workpacks"]["Update"] = {
      deliverables: toJson(resealed.deliverables),
      evidence_summary: toJson(evidenceSummary),
      quality_contract: toJson(resealed.qualityContract ?? {}),
      status: toJson(resealed.status),
      updated_at: nextWorkpackRevision(owned.context.revision, confirmationNow),
    };
    const { data: persisted, error } = await client
      .from("workpacks")
      .update(update)
      .eq("id", owned.context.workpackId)
      .eq("organization_id", owned.context.organizationId)
      .eq("updated_at", owned.context.revision)
      .select("id")
      .maybeSingle();
    if (error) {
      log.error("persist_failed", {
        errorType: errorType(error),
        errorCode: "phase_a_confirmation_persist_failed",
      });
      return NextResponse.json({
        ok: false,
        code: "phase_a_confirmation_persist_failed",
        message: "Phase A 확인 결과를 저장하지 못했습니다.",
      }, { status: 500, headers: { "cache-control": "no-store" } });
    }
    if (!persisted) {
      const concurrent = await loadOwnedWorkpackOperationContext(client, user, id);
      if (!concurrent.ok) return revisionConflictResponse();
      const concurrentStored = concurrent.context.shareAuthority.workpack;
      const concurrentEvidence = concurrentStored
        ? verifyAskResponseGenerationEvidence(concurrentStored, secret)
        : null;
      const concurrentConfirmation = concurrentStored?.phaseAReview?.humanConfirmation;
      if (
        concurrentEvidence?.ok &&
        concurrentStored?.phaseAReview &&
        concurrentConfirmation?.status === "confirmed"
      ) {
        try {
          issuePhaseAReviewConfirmation({
            review: concurrentStored.phaseAReview,
            workpackId: concurrent.context.workpackId,
            principal,
            requestedBinding: parsed,
            requestedConfirmationId: concurrentConfirmation.confirmationId,
            now: confirmationNow,
            createConfirmationId: randomUUID,
          });
          return revisionConflictResponse(concurrentConfirmation.confirmationId);
        } catch (conflictError) {
          log.warn("revision_conflict_binding_mismatch", {
            errorType: errorType(conflictError),
            errorCode: conflictError instanceof PhaseAConfirmationError
              ? conflictError.code
              : "phase_a_confirmation_conflict_validation_failed",
          });
        }
      }
      return revisionConflictResponse();
    }

    return NextResponse.json({
      ok: true,
      confirmationId: confirmedReview.humanConfirmation.status === "confirmed"
        ? confirmedReview.humanConfirmation.confirmationId
        : null,
      phaseAReview: confirmedReview,
      workpack: resealed,
      message: "Phase A 근거와 문서 반영 실적 확인을 저장했습니다.",
    }, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    if (error instanceof PhaseAConfirmationError) {
      return NextResponse.json({
        ok: false,
        code: error.code,
        message: error.message,
      }, { status: 409, headers: { "cache-control": "no-store" } });
    }
    log.error("confirmation_failed", {
      errorType: errorType(error),
      errorCode: "phase_a_confirmation_failed",
    });
    return NextResponse.json({
      ok: false,
      code: "phase_a_confirmation_failed",
      message: "Phase A 확인을 완료하지 못했습니다.",
    }, { status: 500, headers: { "cache-control": "no-store" } });
  }
}
