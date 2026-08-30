import { NextRequest, NextResponse } from "next/server";
import { isRecord, readString } from "@/lib/workspace-api";
import {
  buildReadConfirmationDraft,
  type ShareRecipientInput,
  findShareSessionRecipient,
  verifyShareRecipientContact
} from "@/lib/workpack-commercial";
import {
  buildReadConfirmationId,
  matchesReadConfirmationIdentity,
  type ReadConfirmationIdentity
} from "@/lib/read-confirmation-idempotency";
import {
  createSupabaseAdminClient,
  toJson,
  type WorkspaceDatabase
} from "@/lib/supabase-admin";
import { loadActivePublicShareSession } from "@/lib/workpack-commercial-store";
import { createConcurrencyGuard, createRateLimiter } from "@/lib/rate-limit";
import {
  acquirePublicConcurrencyLease,
  applyPublicRateLimitHeader,
  checkPublicRateLimit,
  publicRateLimitResponse,
  type PublicRateLimitDecision
} from "@/lib/public-distributed-rate-limit";
import {
  enforcePublicJsonRequestBodyBudget,
  PUBLIC_SHARE_ACK_REQUEST_MAX_BYTES
} from "@/lib/public-work-budget";

export const dynamic = "force-dynamic";

const SHARE_READ_LIMIT = 60;
const SHARE_READ_CONCURRENCY = 16;
const SHARE_READ_LEASE_MS = 10_000;
const SHARE_ACK_LIMIT = 20;
const SHARE_ACK_PREBODY_LIMIT = 60;
const SHARE_ACK_PREBODY_CONCURRENCY = 8;
const SHARE_ACK_PREBODY_LEASE_MS = 15_000;
const SHARE_RATE_WINDOW_MS = 60_000;
const shareReadCallerLimiter = createRateLimiter({
  limit: SHARE_READ_LIMIT,
  windowMs: SHARE_RATE_WINDOW_MS
});
const shareReadCapabilityLimiter = createRateLimiter({
  limit: SHARE_READ_LIMIT,
  windowMs: SHARE_RATE_WINDOW_MS
});
const shareReadConcurrency = createConcurrencyGuard(SHARE_READ_CONCURRENCY);
const shareAckLimiter = createRateLimiter({
  limit: SHARE_ACK_LIMIT,
  windowMs: SHARE_RATE_WINDOW_MS
});
const shareAckPreBodyLimiter = createRateLimiter({
  limit: SHARE_ACK_PREBODY_LIMIT,
  windowMs: SHARE_RATE_WINDOW_MS
});
const shareAckPreBodyConcurrency = createConcurrencyGuard(SHARE_ACK_PREBODY_CONCURRENCY);

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

function shareAckPreBodyConcurrencyResponse(decision: PublicRateLimitDecision): Response {
  const response = NextResponse.json({
    ok: false,
    code: "SHARE_ACK_PREBODY_CONCURRENCY_LIMIT",
    confirmationId: null,
    message: "열람 확인 요청이 많습니다. 잠시 후 다시 시도해 주세요.",
    retryAfterSeconds: 1
  }, {
    status: 503,
    headers: { "Retry-After": "1" }
  });
  applyPublicRateLimitHeader(response, decision);
  response.headers.set("X-SafeClaw-Work-Unit", "share-ack-body");
  return response;
}

function shareReadConcurrencyResponse(decision: PublicRateLimitDecision): Response {
  const response = NextResponse.json({
    ok: false,
    code: "SHARE_READ_CONCURRENCY_LIMIT",
    session: null,
    message: "공유 세션 조회가 많습니다. 잠시 후 다시 시도해 주세요.",
    retryAfterSeconds: 1
  }, {
    status: 503,
    headers: { "Retry-After": "1" }
  });
  applyPublicRateLimitHeader(response, decision);
  response.headers.set("X-SafeClaw-Work-Unit", "share-session-read");
  return response;
}

export async function GET(request: NextRequest, context: RouteContext) {
  const callerAdmission = await checkPublicRateLimit({
    request,
    namespace: "share-session-read-caller",
    limit: SHARE_READ_LIMIT,
    windowMs: SHARE_RATE_WINDOW_MS,
    instanceLimiter: shareReadCallerLimiter,
    requireDistributedInProduction: true
  });
  const callerLimited = publicRateLimitResponse(callerAdmission);
  if (callerLimited) return callerLimited;

  const { sessionId } = await context.params;
  const searchParams = request.nextUrl.searchParams;
  const workerId = searchParams.get("workerId") || undefined;
  const admission = await checkPublicRateLimit({
    request,
    identifier: `${sessionId}:${workerId || "anonymous"}`,
    namespace: "share-session-read",
    limit: SHARE_READ_LIMIT,
    windowMs: SHARE_RATE_WINDOW_MS,
    instanceLimiter: shareReadCapabilityLimiter,
    requireDistributedInProduction: true
  });
  const limited = publicRateLimitResponse(admission);
  if (limited) return limited;

  let releaseRead: (() => void | Promise<void>) | null;
  try {
    const distributedRelease = await acquirePublicConcurrencyLease({
      concurrency: SHARE_READ_CONCURRENCY,
      leaseMs: SHARE_READ_LEASE_MS,
      namespace: "share-session-read",
      requireDistributedInProduction: true
    });
    releaseRead = distributedRelease === undefined
      ? shareReadConcurrency.tryAcquire()
      : distributedRelease;
  } catch (error) {
    console.error("public Share read concurrency admission unavailable", error);
    return shareReadConcurrencyResponse(callerAdmission);
  }
  if (!releaseRead) return shareReadConcurrencyResponse(callerAdmission);

  try {
    const client = createSupabaseAdminClient();
    if (!client) {
      return NextResponse.json({ ok: false, configured: false, session: null, message: "Supabase 저장소가 아직 설정되지 않았습니다." });
    }

    const activeSession = await loadActivePublicShareSession(client, {
      shareSessionId: sessionId,
      workerId
    });

    if (!activeSession.ok) {
      return NextResponse.json({ ok: false, configured: true, session: null, message: activeSession.message }, { status: activeSession.status });
    }

    const authorizedRecipient = workerId
      ? findShareSessionRecipient(activeSession.session.recipients, workerId)
      : null;

    if (!authorizedRecipient && activeSession.session.accessPolicy.requireKnownWorkerSnapshot) {
      return NextResponse.json({
        ok: false,
        configured: true,
        session: null,
        message: "초대된 작업자 링크로 다시 접속해 주세요."
      }, { status: 403 });
    }
    if (!authorizedRecipient && !activeSession.session.accessPolicy.anonymousAllowed) {
      return NextResponse.json({
        ok: false,
        configured: true,
        session: null,
        message: "초대된 작업자 링크로 다시 접속해 주세요."
      }, { status: 403 });
    }

    const recipientHints = authorizedRecipient
      ? buildPublicRecipientHint([authorizedRecipient]).slice(0, 1)
      : [];

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
        recipients: recipientHints,
        documents: activeSession.session.documents,
        recipientMessage: activeSession.session.recipientMessage
      },
      message: "공유 세션을 조회했습니다."
    });
  } finally {
    await releaseRead();
  }
}

export async function POST(request: NextRequest, context: RouteContext) {
  const preBodyAdmission = await checkPublicRateLimit({
    request,
    namespace: "share-session-ack-prebody",
    limit: SHARE_ACK_PREBODY_LIMIT,
    windowMs: SHARE_RATE_WINDOW_MS,
    instanceLimiter: shareAckPreBodyLimiter,
    requireDistributedInProduction: true
  });
  const preBodyLimited = publicRateLimitResponse(preBodyAdmission);
  if (preBodyLimited) return preBodyLimited;

  let releasePreBody: (() => void | Promise<void>) | null;
  try {
    const distributedRelease = await acquirePublicConcurrencyLease({
      concurrency: SHARE_ACK_PREBODY_CONCURRENCY,
      leaseMs: SHARE_ACK_PREBODY_LEASE_MS,
      namespace: "share-session-ack-prebody-body",
      requireDistributedInProduction: true
    });
    releasePreBody = distributedRelease === undefined
      ? shareAckPreBodyConcurrency.tryAcquire()
      : distributedRelease;
  } catch (error) {
    console.error("public Share acknowledgement pre-body admission unavailable", error);
    return shareAckPreBodyConcurrencyResponse(preBodyAdmission);
  }
  if (!releasePreBody) return shareAckPreBodyConcurrencyResponse(preBodyAdmission);

  let bodyBudget: Awaited<ReturnType<typeof enforcePublicJsonRequestBodyBudget>>;
  let parsed: unknown;
  try {
    bodyBudget = await enforcePublicJsonRequestBodyBudget(
      request,
      PUBLIC_SHARE_ACK_REQUEST_MAX_BYTES,
      "request body exceeds the public Share acknowledgement byte budget",
    );
    if (!bodyBudget.ok) return applyPublicRateLimitHeader(bodyBudget.response, preBodyAdmission);
    parsed = await bodyBudget.request.json().catch((): unknown => ({}));
  } finally {
    await releasePreBody();
  }

  const { sessionId } = await context.params;
  const searchParams = request.nextUrl.searchParams;
  const queryWorkerId = searchParams.get("workerId") || undefined;
  const body = isRecord(parsed) ? parsed : {};
  const bodyWorkerId = readString(body.workerId);
  const workerId = queryWorkerId || bodyWorkerId || undefined;
  const admission = await checkPublicRateLimit({
    request,
    identifier: `${sessionId}:${workerId || "anonymous"}`,
    namespace: "share-session-ack",
    limit: SHARE_ACK_LIMIT,
    windowMs: SHARE_RATE_WINDOW_MS,
    instanceLimiter: shareAckLimiter,
    requireDistributedInProduction: true
  });
  const limited = publicRateLimitResponse(admission);
  if (limited) return limited;

  const client = createSupabaseAdminClient();
  if (!client) {
    return NextResponse.json({ ok: false, configured: false, confirmationId: null, message: "Supabase 저장소가 아직 설정되지 않았습니다." });
  }

  const displayName = readString(body.displayName);
  const recipientVerification = readString(body.recipientVerification);
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

  if (!authorizedRecipient && activeSession.session.accessPolicy.requireKnownWorkerSnapshot) {
    return NextResponse.json({
      ok: false,
      configured: true,
      confirmationId: null,
      message: "초대된 작업자 식별자가 확인되지 않아 열람 확인을 저장할 수 없습니다."
    }, { status: 403 });
  }
  if (!authorizedRecipient && !activeSession.session.accessPolicy.anonymousAllowed) {
    return NextResponse.json({
      ok: false,
      configured: true,
      confirmationId: null,
      message: "초대된 작업자 링크로 다시 접속해 주세요."
    }, { status: 403 });
  }

  if (authorizedRecipient) {
    const verification = verifyShareRecipientContact(authorizedRecipient, recipientVerification);
    if (!verification.ok) {
      const contactUnavailable = verification.reason === "recipient_contact_unavailable";
      return NextResponse.json({
        ok: false,
        configured: true,
        confirmationId: null,
        code: contactUnavailable
          ? "SHARE_RECIPIENT_CONTACT_UNAVAILABLE"
          : "SHARE_RECIPIENT_VERIFICATION_REQUIRED",
        message: contactUnavailable
          ? "초대 연락처가 없어 열람 확인을 저장할 수 없습니다. 관리자에게 연락처 등록을 요청해 주세요."
          : "초대 연락처 확인값이 일치해야 작업자 열람 확인을 저장할 수 있습니다."
      }, { status: contactUnavailable ? 409 : 403 });
    }
  }

  const resolvedDisplayName = authorizedRecipient?.displayName || displayName;
  const resolvedWorkerId = workerId || null;
  const resolvedSnapshot = authorizedRecipient?.workerSnapshot
    || {
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

  const identity: ReadConfirmationIdentity = {
    organizationId: draft.insert.organization_id,
    siteId: draft.insert.site_id ?? null,
    workpackId: draft.insert.workpack_id,
    shareSessionId: draft.insert.share_session_id || activeSession.session.id,
    workerId: draft.insert.worker_id ?? null,
    workerDisplayName: draft.insert.worker_display_name,
    confirmationMethod: "button"
  };
  const existingQuery = client
    .from("workpack_read_confirmations")
    .select("id,organization_id,site_id,workpack_id,share_session_id,worker_id,worker_display_name,confirmation_method")
    .eq("organization_id", identity.organizationId)
    .eq("workpack_id", identity.workpackId)
    .eq("share_session_id", identity.shareSessionId)
    .eq("confirmation_method", identity.confirmationMethod);
  if (identity.siteId === null) {
    existingQuery.is("site_id", null);
  } else {
    existingQuery.eq("site_id", identity.siteId);
  }
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
  if (existing && !matchesReadConfirmationIdentity(existing, identity)) {
    console.error("public share confirmation idempotency identity mismatch");
    return NextResponse.json({ ok: false, configured: true, confirmationId: null, message: "기존 열람 확인의 귀속을 확인하지 못했습니다." }, { status: 409 });
  }
  if (existing) {
    return NextResponse.json({
      ok: true,
      configured: true,
      confirmationId: existing.id,
      idempotent: true,
      message: "이미 저장된 작업자 열람 확인입니다."
    });
  }

  const insert: WorkspaceDatabase["public"]["Tables"]["workpack_read_confirmations"]["Insert"] = {
    id: buildReadConfirmationId(identity),
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

  if (error?.code === "23505") {
    const { data: concurrent, error: concurrentError } = await client
      .from("workpack_read_confirmations")
      .select("id,organization_id,site_id,workpack_id,share_session_id,worker_id,worker_display_name,confirmation_method")
      .eq("id", insert.id || buildReadConfirmationId(identity))
      .maybeSingle();
    if (concurrentError || !matchesReadConfirmationIdentity(concurrent, identity)) {
      console.error("public share confirmation primary-key conflict mismatch", concurrentError);
      return NextResponse.json({ ok: false, configured: true, confirmationId: null, message: "열람 확인 충돌의 귀속을 확인하지 못했습니다." }, { status: 409 });
    }
    return NextResponse.json({
      ok: true,
      configured: true,
      confirmationId: concurrent.id,
      idempotent: true,
      message: "이미 저장된 작업자 열람 확인입니다."
    });
  }
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
