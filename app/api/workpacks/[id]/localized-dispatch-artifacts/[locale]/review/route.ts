import { NextRequest, NextResponse } from "next/server";

import { parseSupportedLanguageCode } from "@/lib/foreign-worker";
import { verifyAskResponseGenerationEvidence } from "@/lib/generation-evidence";
import {
  buildReviewedLocalizationEnvelope,
  buildSourceDocumentDigest,
  parseLocalizedDispatchArtifactDraft,
  readReviewedLocalizationEnvelopes,
  resolveReviewedLocalizationAuthority,
  verifyReviewedLocalizationEnvelope
} from "@/lib/reviewed-localization-envelope";
import {
  createSupabaseAdminClient,
  getWorkspaceUser,
  toJson
} from "@/lib/supabase-admin";
import { isRecord } from "@/lib/workspace-api";
import { loadOwnedWorkpackOperationContext } from "@/lib/workpack-commercial-store";
import { readWorkpackShareServerConfig } from "@/lib/workpack-share-server-config";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ id: string; locale: string }>;
};

function readArtifactRevision(value: unknown): number {
  if (!isRecord(value) || !isRecord(value.artifact)) return 0;
  const revision = value.artifact.artifactRevision;
  return typeof revision === "number" && Number.isSafeInteger(revision) && revision > 0 ? revision : 0;
}

export async function PUT(request: NextRequest, context: RouteContext) {
  const client = createSupabaseAdminClient();
  if (!client) {
    return NextResponse.json({ ok: false, message: "Supabase 저장소가 설정되지 않았습니다." }, { status: 503 });
  }
  const user = await getWorkspaceUser(client, request.headers);
  if (!user) {
    return NextResponse.json({ ok: false, message: "관리자 로그인이 필요합니다." }, { status: 401 });
  }
  const { id, locale: rawLocale } = await context.params;
  const locale = parseSupportedLanguageCode(rawLocale);
  if (locale.status !== "supported") {
    return NextResponse.json({ ok: false, reasonCode: "recipient_locale_invalid", message: "검토 언어 코드를 확인해 주세요." }, { status: 400 });
  }
  const parsed = await request.json().catch((error): unknown => {
    console.warn("reviewed localization body parse failed", error);
    return {};
  });
  const body = isRecord(parsed) ? parsed : {};
  const expectedWorkpackRevision = typeof body.expectedWorkpackRevision === "string"
    ? body.expectedWorkpackRevision.trim()
    : "";
  const requestedSourceDigest = typeof body.sourceDocumentDigest === "string"
    ? body.sourceDocumentDigest.trim()
    : "";
  const decision = body.decision === "approved" || body.decision === "rejected" ? body.decision : null;
  const artifact = parseLocalizedDispatchArtifactDraft(body.artifact, locale.locale);
  if (!expectedWorkpackRevision || !requestedSourceDigest || !decision || !artifact) {
    return NextResponse.json({ ok: false, message: "번역 artifact와 검토 입력을 확인해 주세요." }, { status: 400 });
  }
  const serverConfig = readWorkpackShareServerConfig(process.env);
  if (!serverConfig.ok) {
    return NextResponse.json({
      ok: false,
      invalidConfigurationKeys: serverConfig.invalidKeys,
      message: "번역 검토 서명 설정을 확인해 주세요."
    }, { status: 503 });
  }
  const owned = await loadOwnedWorkpackOperationContext(client, user, id);
  if (!owned.ok) {
    return NextResponse.json({ ok: false, message: owned.message }, { status: owned.status });
  }
  const response = owned.context.shareAuthority.workpack;
  if (!response) {
    return NextResponse.json({ ok: false, message: "검토할 작업팩 본문을 복원하지 못했습니다." }, { status: 409 });
  }
  const generationVerification = verifyAskResponseGenerationEvidence(
    response,
    process.env.SAFECLAW_GENERATION_EVIDENCE_SECRET
  );
  if (!generationVerification.ok) {
    console.warn("reviewed localization blocked by generation evidence", {
      code: generationVerification.code,
      workpackId: owned.context.workpackId
    });
    return NextResponse.json({
      ok: false,
      reasonCode: "generation_evidence_invalid",
      message: generationVerification.message
    }, { status: generationVerification.code === "secret_unconfigured" ? 503 : 409 });
  }
  const reviewedEnvelopes = readReviewedLocalizationEnvelopes(owned.context.evidenceSummary);
  const currentAuthority = resolveReviewedLocalizationAuthority({
    workpackId: owned.context.workpackId,
    response,
    reviewedEnvelopes,
    recipients: [],
    secret: serverConfig.config.reviewedLocalizationSecret
  });
  if (!currentAuthority.ok) {
    return NextResponse.json({ ...currentAuthority }, { status: 409 });
  }
  if (currentAuthority.canonicalWorkpackRevision !== expectedWorkpackRevision) {
    return NextResponse.json({
      ok: false,
      reasonCode: "workpack_revision_or_digest_changed",
      message: "작업팩이 변경되어 번역본을 다시 확인해야 합니다."
    }, { status: 409 });
  }
  const sourceDocumentDigest = buildSourceDocumentDigest(response);
  if (sourceDocumentDigest !== requestedSourceDigest) {
    return NextResponse.json({
      ok: false,
      reasonCode: "translation_incomplete",
      message: "번역 원문 digest가 현재 작업팩과 일치하지 않습니다."
    }, { status: 409 });
  }

  const now = new Date().toISOString();
  const envelope = buildReviewedLocalizationEnvelope({
    workpackId: owned.context.workpackId,
    response,
    artifact,
    artifactRevision: readArtifactRevision(reviewedEnvelopes[locale.locale]) + 1,
    decision,
    reviewerId: user.id,
    reviewerDisplayName: user.email || user.id,
    reviewedAt: now,
    signedAt: now,
    secret: serverConfig.config.reviewedLocalizationSecret
  });
  const verified = verifyReviewedLocalizationEnvelope({
    workpackId: owned.context.workpackId,
    response,
    envelope,
    secret: serverConfig.config.reviewedLocalizationSecret
  });
  if (!verified.ok) {
    return NextResponse.json({ ...verified, message: "번역 artifact 완전성 검사를 통과하지 못했습니다." }, { status: 400 });
  }
  const originalEvidence = isRecord(owned.context.evidenceSummary) ? owned.context.evidenceSummary : {};
  const nextEvidenceSummary = {
    ...originalEvidence,
    reviewedLocalizationEnvelopes: {
      ...reviewedEnvelopes,
      [locale.locale]: envelope
    }
  };
  const { data, error } = await client
    .from("workpacks")
    .update({
      evidence_summary: toJson(nextEvidenceSummary),
      updated_at: now
    })
    .eq("id", owned.context.workpackId)
    .eq("updated_at", owned.context.updatedAt)
    .select("id")
    .maybeSingle();
  if (error) {
    console.error("reviewed localization compare-and-swap failed", error);
    return NextResponse.json({ ok: false, message: "번역 검토본 저장에 실패했습니다." }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({
      ok: false,
      reasonCode: "workpack_revision_or_digest_changed",
      message: "작업팩이 동시에 변경되어 번역 검토본을 저장하지 않았습니다."
    }, { status: 409 });
  }
  const nextAuthority = resolveReviewedLocalizationAuthority({
    workpackId: owned.context.workpackId,
    response,
    reviewedEnvelopes: nextEvidenceSummary.reviewedLocalizationEnvelopes,
    recipients: [],
    secret: serverConfig.config.reviewedLocalizationSecret
  });
  if (!nextAuthority.ok) {
    console.error("saved reviewed localization did not revalidate", nextAuthority);
    return NextResponse.json({ ok: false, message: "저장된 번역 검토본을 다시 검증하지 못했습니다." }, { status: 500 });
  }
  return NextResponse.json({
    ok: true,
    workpackId: owned.context.workpackId,
    targetLocale: locale.locale,
    envelope,
    canonicalWorkpackRevision: nextAuthority.canonicalWorkpackRevision
  });
}
