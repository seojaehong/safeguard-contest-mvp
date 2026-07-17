import { NextRequest, NextResponse } from "next/server";
import { isRecord, readString } from "@/lib/workspace-api";
import {
  buildReadConfirmationDraft,
  type ShareRecipientInput,
  findShareSessionRecipient
} from "@/lib/workpack-commercial";
import {
  createSupabaseAdminClient,
  toJson,
  type WorkspaceDatabase
} from "@/lib/supabase-admin";
import { loadActivePublicShareSession } from "@/lib/workpack-commercial-store";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{
    sessionId: string;
  }>;
};

function sanitizeLanguageCode(value: unknown): string {
  const code = readString(value, "ko").trim().toLowerCase();
  return code || "ko";
}

function buildPublicRecipientHint(recipients: ShareRecipientInput[]) {
  return recipients.map((recipient) => ({
    workerId: recipient.workerId,
    displayName: recipient.displayName,
    languageCode: recipient.languageCode || "ko"
  }));
}

export async function GET(request: NextRequest, context: RouteContext) {
  const client = createSupabaseAdminClient();
  if (!client) {
    return NextResponse.json({ ok: false, configured: false, session: null, message: "Supabase 저장소가 아직 설정되지 않았습니다." });
  }

  const { sessionId } = await context.params;
  const searchParams = request.nextUrl.searchParams;
  const workerId = searchParams.get("workerId") || undefined;

  const activeSession = await loadActivePublicShareSession(client, {
    shareSessionId: sessionId,
    workerId
  });

  if (!activeSession.ok) {
    return NextResponse.json({ ok: false, configured: true, session: null, message: activeSession.message }, { status: activeSession.status });
  }

  return NextResponse.json({
    ok: true,
    configured: true,
    session: {
      id: activeSession.session.id,
      workpackId: activeSession.session.workpackId,
      shareScope: activeSession.session.shareScope,
      question: activeSession.session.question,
      status: activeSession.session.status,
      expiresAt: activeSession.session.expiresAt,
      accessPolicy: activeSession.session.accessPolicy,
      recipients: activeSession.session.accessPolicy.anonymousAllowed
        ? buildPublicRecipientHint(activeSession.session.recipients).slice(0, 10)
        : []
    },
    message: "공유 세션을 조회했습니다."
  });
}

export async function POST(request: NextRequest, context: RouteContext) {
  const client = createSupabaseAdminClient();
  if (!client) {
    return NextResponse.json({ ok: false, configured: false, confirmationId: null, message: "Supabase 저장소가 아직 설정되지 않았습니다." });
  }

  const { sessionId } = await context.params;
  const searchParams = request.nextUrl.searchParams;
  const queryWorkerId = searchParams.get("workerId") || undefined;

  const parsed = await request.json().catch((): unknown => ({}));
  const body = isRecord(parsed) ? parsed : {};
  const bodyWorkerId = readString(body.workerId);
  const workerId = bodyWorkerId || queryWorkerId || undefined;
  const displayName = readString(body.displayName);
  const languageCode = sanitizeLanguageCode(body.languageCode);
  const manualWorkerSnapshot = isRecord(body.workerSnapshot) ? body.workerSnapshot : {};

  const activeSession = await loadActivePublicShareSession(client, {
    shareSessionId: sessionId,
    workerId
  });

  if (!activeSession.ok) {
    return NextResponse.json({ ok: false, configured: true, confirmationId: null, message: activeSession.message }, { status: activeSession.status });
  }

  const resolvedLanguageCode = sanitizeLanguageCode(
    activeSession.session.recipients.find((recipient) => recipient.workerId === workerId)?.languageCode
      || languageCode
      || activeSession.session.recipients[0]?.languageCode
      || "ko"
  );
  const authorizedRecipient = workerId
    ? findShareSessionRecipient(activeSession.session.recipients, workerId)
    : null;

  const resolvedDisplayName = activeSession.session.accessPolicy.anonymousAllowed && authorizedRecipient?.displayName
    ? authorizedRecipient.displayName
    : displayName;
  const resolvedWorkerId = workerId || null;
  const resolvedSnapshot = activeSession.session.accessPolicy.anonymousAllowed && authorizedRecipient?.workerSnapshot
    ? authorizedRecipient.workerSnapshot
    : {
      ...manualWorkerSnapshot,
      source: "public-share",
      shareSessionId: activeSession.session.id,
      workpackId: activeSession.session.workpackId,
      createdAt: new Date().toISOString()
    };

  const draft = buildReadConfirmationDraft({
    organizationId: activeSession.session.organizationId,
    siteId: activeSession.session.siteId,
    workpackId: activeSession.session.workpackId,
    shareSessionId: activeSession.session.id,
    workerId: resolvedWorkerId,
    displayName: resolvedDisplayName,
    workerSnapshot: resolvedSnapshot,
    languageCode: resolvedLanguageCode
  });

  if (!draft.ok) {
    return NextResponse.json({ ok: false, configured: true, confirmationId: null, message: draft.message }, { status: 400 });
  }

  const existingQuery = client
    .from("workpack_read_confirmations")
    .select("id")
    .eq("workpack_id", activeSession.session.workpackId)
    .eq("share_session_id", activeSession.session.id)
    .eq("confirmation_method", "button");
  if (resolvedWorkerId) {
    existingQuery.eq("worker_id", resolvedWorkerId);
  } else {
    existingQuery.eq("worker_display_name", resolvedDisplayName);
  }
  const { data: existing, error: existingError } = await existingQuery.maybeSingle();

  if (existingError) {
    console.error("public share confirmation idempotency check failed", existingError);
    return NextResponse.json({ ok: false, configured: true, confirmationId: null, message: "열람 확인 중복 여부를 확인하지 못했습니다." }, { status: 500 });
  }
  if (existing?.id) {
    return NextResponse.json({
      ok: true,
      configured: true,
      confirmationId: existing.id,
      idempotent: true,
      message: "이미 저장된 작업자 열람 확인입니다."
    });
  }

  const insert: WorkspaceDatabase["public"]["Tables"]["workpack_read_confirmations"]["Insert"] = {
    organization_id: draft.insert.organization_id,
    site_id: draft.insert.site_id,
    workpack_id: draft.insert.workpack_id,
    share_session_id: draft.insert.share_session_id,
    worker_id: draft.insert.worker_id,
    worker_display_name: draft.insert.worker_display_name,
    worker_snapshot: toJson(draft.insert.worker_snapshot),
    language_code: draft.insert.language_code,
    confirmation_method: "button"
  };

  const { data, error } = await client
    .from("workpack_read_confirmations")
    .insert(insert)
    .select("id")
    .single();

  if (error) {
    console.error("public share confirmation create failed", error);
    return NextResponse.json({ ok: false, configured: true, confirmationId: null, message: "열람 확인 저장에 실패했습니다." }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    configured: true,
    confirmationId: data.id,
    message: "작업자 열람 확인을 저장했습니다."
  });
}
