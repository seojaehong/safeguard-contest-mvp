import { NextRequest, NextResponse } from "next/server";
import { generateKnowledgeText } from "@/lib/ai";
import { buildKnowledgeCandidateDraft } from "@/lib/knowledge-candidate-route";
import {
  KnowledgeReviewPrepareError,
  prepareKnowledgeReviewCandidate
} from "@/lib/knowledge-review-prepare";
import {
  createSupabaseAdminClient,
  getWorkspaceUser
} from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function POST(request: NextRequest) {
  const client = createSupabaseAdminClient();
  if (!client) {
    return NextResponse.json({
      ok: false,
      configured: false,
      message: "사람 검토 저장소가 설정되지 않았습니다."
    }, { status: 503 });
  }

  const user = await getWorkspaceUser(client, request.headers);
  if (!user) {
    return NextResponse.json({
      ok: false,
      configured: true,
      message: "로그인이 필요합니다."
    }, { status: 401 });
  }

  const body = await request.json().catch((): unknown => null);
  const runId = typeof body === "object"
    && body !== null
    && !Array.isArray(body)
    && typeof (body as Record<string, unknown>).runId === "string"
    ? ((body as Record<string, unknown>).runId as string).trim()
    : "";
  if (!runId) {
    return NextResponse.json({
      ok: false,
      configured: true,
      code: "prepare_run_id_required",
      message: "runId가 필요합니다."
    }, { status: 400 });
  }

  try {
    const result = await prepareKnowledgeReviewCandidate(client, user, { runId }, {
      buildCandidate: async (input) => {
        const built = await buildKnowledgeCandidateDraft({
          question: input.question,
          rawEvents: input.rawEvents,
          tenantContext: input.tenantContext,
          generate: true
        }, { generateText: generateKnowledgeText });
        return {
          candidate: built.candidate,
          configured: built.generated.configured,
          providerLabel: built.generated.providerLabel
        };
      }
    });
    return NextResponse.json({
      ...result,
      message: "검토용 지식 후보를 저장했습니다. 공개 또는 온톨로지 반영은 수행하지 않았습니다."
    });
  } catch (error) {
    if (error instanceof KnowledgeReviewPrepareError) {
      if (error.status >= 500) {
        console.error("knowledge review preparation failed", {
          code: error.code,
          cause: error.cause
        });
      }
      return NextResponse.json({
        ok: false,
        configured: true,
        code: error.code,
        message: error.message
      }, { status: error.status });
    }

    console.error("knowledge review preparation failed", error);
    return NextResponse.json({
      ok: false,
      configured: true,
      code: "prepare_failed",
      message: "지식 후보를 준비하지 못했습니다."
    }, { status: 500 });
  }
}
