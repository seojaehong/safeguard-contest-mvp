import { NextRequest, NextResponse } from "next/server";
import {
  createSupabaseAdminClient,
  getWorkspaceUser
} from "@/lib/supabase-admin";
import {
  applyKnowledgeReviewAction,
  KnowledgeReviewError,
  loadKnowledgeReviewInbox,
  parseKnowledgeReviewRequest
} from "@/lib/knowledge-review";

export const dynamic = "force-dynamic";

function unconfiguredResponse() {
  return NextResponse.json({
    ok: false,
    configured: false,
    atomic: false,
    compensationRequired: false,
    message: "사람 검토 저장소가 설정되지 않았습니다."
  }, { status: 503 });
}

export async function GET(request: NextRequest) {
  const client = createSupabaseAdminClient();
  if (!client) return unconfiguredResponse();

  const user = await getWorkspaceUser(client, request.headers);
  if (!user) {
    return NextResponse.json({
      ok: false,
      configured: true,
      atomic: false,
      compensationRequired: false,
      message: "로그인이 필요합니다."
    }, { status: 401 });
  }

  try {
    const inbox = await loadKnowledgeReviewInbox(client, user);
    return NextResponse.json({
      ok: true,
      configured: true,
      atomic: false,
      compensationRequired: false,
      ...inbox
    });
  } catch (error) {
    console.error("knowledge review inbox fetch failed", error);
    return NextResponse.json({
      ok: false,
      configured: true,
      atomic: false,
      compensationRequired: false,
      message: "사람 검토 목록을 불러오지 못했습니다."
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const client = createSupabaseAdminClient();
  if (!client) return unconfiguredResponse();

  const user = await getWorkspaceUser(client, request.headers);
  if (!user) {
    return NextResponse.json({
      ok: false,
      configured: true,
      atomic: false,
      compensationRequired: false,
      message: "로그인이 필요합니다."
    }, { status: 401 });
  }

  const parsedBody = await request.json().catch((): unknown => null);
  const reviewRequest = parseKnowledgeReviewRequest(parsedBody);
  if (!reviewRequest) {
    return NextResponse.json({
      ok: false,
      configured: true,
      code: "invalid_review_action",
      atomic: false,
      compensationRequired: false,
      message: "runId와 허용된 검토 action을 확인해 주세요."
    }, { status: 400 });
  }

  try {
    const result = await applyKnowledgeReviewAction(client, user, reviewRequest);
    return NextResponse.json({
      configured: true,
      ...result,
      message: reviewRequest.action === "reject"
        ? "지식 후보를 반려했습니다."
        : "사람 검토 결과를 저장했습니다. 공개 또는 온톨로지 반영은 수행하지 않았습니다."
    });
  } catch (error) {
    if (error instanceof KnowledgeReviewError) {
      if (error.status >= 500) {
        console.error("knowledge review action failed", {
          code: error.code,
          compensationRequired: error.compensationRequired,
          updates: error.updates,
          cause: error.cause
        });
      }
      return NextResponse.json({
        ok: false,
        configured: true,
        code: error.code,
        atomic: false,
        compensationRequired: error.compensationRequired,
        updates: error.updates,
        message: error.message
      }, { status: error.status });
    }

    console.error("knowledge review action failed", error);
    return NextResponse.json({
      ok: false,
      configured: true,
      code: "review_action_failed",
      atomic: false,
      compensationRequired: false,
      updates: { runUpdated: false, eventsUpdated: false },
      message: "사람 검토 결과를 저장하지 못했습니다."
    }, { status: 500 });
  }
}
