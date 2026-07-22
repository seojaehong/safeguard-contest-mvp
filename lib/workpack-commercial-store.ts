import type { SupabaseClient } from "@supabase/supabase-js";
import type { WorkspaceDatabase, WorkspaceUser } from "@/lib/supabase-admin";
import type { AskResponse } from "@/lib/types";
import { assessWorkpackReadiness, type WorkpackReadiness } from "@/lib/workpack-readiness";
import { buildReopenData, type ReopenWorkpackInput } from "@/lib/workpack-store";
import { verifyAskResponseGenerationEvidence } from "@/lib/generation-evidence";
import {
  buildServerShareRecipients,
  parseShareSessionRecipients,
  type ServerShareRecipientsResult,
  type ShareRecipientInput
} from "@/lib/workpack-commercial";

export type StoredWorkpackShareAuthority = {
  workpack: AskResponse | null;
  readiness: WorkpackReadiness;
};

export function assessStoredWorkpackShareAuthority(input: ReopenWorkpackInput): StoredWorkpackShareAuthority {
  const reopened = buildReopenData(input);
  if (!reopened.data) {
    return {
      workpack: null,
      readiness: {
        canShare: false,
        status: "blocked",
        summary: "저장된 작업팩 검증 필요",
        reasons: reopened.blockers
      }
    };
  }

  const readiness = assessWorkpackReadiness(reopened.data);
  if (!reopened.data.generationEvidence) {
    return {
      workpack: reopened.data,
      readiness: {
        canShare: false,
        status: "blocked",
        summary: "공유 전 보완 필요",
        reasons: [...readiness.reasons, "생성 근거 봉인 확인 필요"]
      }
    };
  }

  const verification = verifyAskResponseGenerationEvidence(
    reopened.data,
    process.env.SAFECLAW_GENERATION_EVIDENCE_SECRET
  );
  if (!verification.ok) {
    return {
      workpack: reopened.data,
      readiness: {
        canShare: false,
        status: "blocked",
        summary: "공유 전 보완 필요",
        reasons: [...readiness.reasons, "생성 근거 서명 검증 필요"]
      }
    };
  }

  return { workpack: reopened.data, readiness };
}

export type WorkpackOperationContext = {
  organizationId: string;
  siteId: string | null;
  workpackId: string;
  question: string;
  generatedAt: string;
  shareAuthority: StoredWorkpackShareAuthority;
};

export type ActiveOwnedShareSession = {
  id: string;
  workpackId: string;
  recipients: ShareRecipientInput[];
  expiresAt: string | null;
};

export type ShareAccessPolicy = {
  anonymousAllowed: boolean;
  manualLanguageSwitchAllowed: boolean;
  requireKnownWorkerSnapshot: boolean;
};

export type PublicShareSession = {
  id: string;
  organizationId: string;
  siteId: string | null;
  workpackId: string;
  shareScope: "invited" | "organization";
  recipients: ShareRecipientInput[];
  accessPolicy: ShareAccessPolicy;
  status: "active" | "revoked" | "expired";
  expiresAt: string | null;
  question: string;
  documents: PublicShareDocument[];
  recipientMessage: PublicShareRecipientMessage | null;
};

export type PublicShareDocument = {
  key: "riskAssessmentDraft" | "tbmBriefing" | "tbmLogDraft";
  title: string;
  body: string;
};

export type PublicShareRecipientMessage = {
  languageCode: string;
  title: string;
  body: string;
};

export type PublicShareSessionResult = {
  ok: true;
  session: PublicShareSession;
} | {
  ok: false;
  status: number;
  message: string;
};

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type ActiveOwnedShareSessionResult = {
  ok: true;
  session: ActiveOwnedShareSession;
} | {
  ok: false;
  status: number;
  message: string;
};

export async function loadServerShareRecipients(
  client: SupabaseClient<WorkspaceDatabase>,
  input: { organizationId: string; siteId: string | null; requestedWorkerIds: string[] }
): Promise<ServerShareRecipientsResult> {
  let workerQuery = client
    .from("workers")
    .select("id,organization_id,site_id,external_key,display_name,role,joined_at,experience_summary,nationality,language_code,language_label,is_new_worker,is_foreign_worker,training_status,training_summary,phone,email")
    .in("id", input.requestedWorkerIds)
    .eq("organization_id", input.organizationId);
  workerQuery = input.siteId === null
    ? workerQuery.is("site_id", null)
    : workerQuery.eq("site_id", input.siteId);
  const { data, error } = await workerQuery;

  if (error) {
    console.error("share recipient worker fetch failed", error);
    return { ok: false, message: "공유 대상 작업자 명부를 조회하지 못했습니다." };
  }

  return buildServerShareRecipients({ ...input, workers: data || [] });
}

export async function loadActiveOwnedShareSession(
  client: SupabaseClient<WorkspaceDatabase>,
  input: {
    organizationId: string;
    siteId: string | null;
    workpackId: string;
    shareSessionId: string;
    userId: string;
    now?: Date;
  }
): Promise<ActiveOwnedShareSessionResult> {
  let shareSessionQuery = client
    .from("workpack_share_sessions")
    .select("id,organization_id,site_id,workpack_id,recipients_snapshot,status,expires_at,created_by")
    .eq("id", input.shareSessionId)
    .eq("workpack_id", input.workpackId)
    .eq("organization_id", input.organizationId)
    .eq("created_by", input.userId);
  shareSessionQuery = input.siteId === null
    ? shareSessionQuery.is("site_id", null)
    : shareSessionQuery.eq("site_id", input.siteId);
  const { data, error } = await shareSessionQuery.maybeSingle();

  if (error) {
    console.error("owned share session fetch failed", error);
    return { ok: false, status: 500, message: "공유 세션 권한을 확인하지 못했습니다." };
  }
  if (!data ||
    data.organization_id !== input.organizationId ||
    data.workpack_id !== input.workpackId ||
    data.created_by !== input.userId ||
    data.site_id !== input.siteId) {
    return { ok: false, status: 404, message: "현재 작업팩에 속한 공유 세션을 찾지 못했습니다." };
  }
  if (data.status !== "active") {
    return { ok: false, status: 409, message: "활성 상태의 공유 세션만 사용할 수 있습니다." };
  }

  const now = input.now || new Date();
  if (data.expires_at) {
    const expiresAt = new Date(data.expires_at).getTime();
    if (!Number.isFinite(expiresAt) || expiresAt <= now.getTime()) {
      return { ok: false, status: 409, message: "공유 세션이 만료되었거나 만료 시각이 올바르지 않습니다." };
    }
  }

  const recipients = parseShareSessionRecipients(data.recipients_snapshot);
  if (!recipients.length) {
    return { ok: false, status: 409, message: "공유 세션의 서버 작업자 snapshot을 확인할 수 없습니다." };
  }

  return {
    ok: true,
    session: {
      id: data.id,
      workpackId: data.workpack_id,
      recipients,
      expiresAt: data.expires_at
    }
  };
}

function parseShareAccessPolicy(value: unknown): ShareAccessPolicy {
  const payload = typeof value === "object" && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
  return {
    anonymousAllowed: payload.anonymousAllowed === true,
    manualLanguageSwitchAllowed: payload.manualLanguageSwitchAllowed !== false,
    requireKnownWorkerSnapshot: payload.requireKnownWorkerSnapshot !== false
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isPostgrestNoRowsError(error: unknown): boolean {
  return isRecord(error) && error.code === "PGRST116";
}

function readPublicString(value: unknown, maxLength = 2_400): string {
  if (typeof value !== "string") return "";
  return value
    .replace(/\r\n/g, "\n")
    .replace(/\n{4,}/g, "\n\n\n")
    .trim()
    .slice(0, maxLength);
}

function readDeliverables(value: unknown): Record<string, unknown> {
  return isRecord(value) ? value : {};
}

function buildPublicShareDocuments(deliverablesValue: unknown): PublicShareDocument[] {
  const deliverables = readDeliverables(deliverablesValue);
  const candidates: PublicShareDocument[] = [
    {
      key: "riskAssessmentDraft",
      title: "위험성평가표",
      body: readPublicString(deliverables.riskAssessmentDraft)
    },
    {
      key: "tbmBriefing",
      title: "TBM 브리핑",
      body: readPublicString(deliverables.tbmBriefing)
    },
    {
      key: "tbmLogDraft",
      title: "TBM 기록",
      body: readPublicString(deliverables.tbmLogDraft)
    }
  ];
  return candidates.filter((document) => document.body.length > 0);
}

function buildPublicRecipientMessage(
  deliverablesValue: unknown,
  languageCode: string
): PublicShareRecipientMessage | null {
  const deliverables = readDeliverables(deliverablesValue);
  const normalizedLanguageCode = languageCode.trim().toLowerCase() || "ko";
  if (normalizedLanguageCode === "ko") {
    const body = readPublicString(deliverables.kakaoMessage, 1_800);
    return body ? { languageCode: "ko", title: "한국어 전송본", body } : null;
  }

  const languages = Array.isArray(deliverables.foreignWorkerLanguages)
    ? deliverables.foreignWorkerLanguages
    : [];
  for (const item of languages) {
    if (!isRecord(item)) continue;
    const code = readPublicString(item.code, 24).toLowerCase();
    if (code !== normalizedLanguageCode) continue;
    const nativeLabel = readPublicString(item.nativeLabel, 80);
    const lines = Array.isArray(item.lines)
      ? item.lines.map((line) => readPublicString(line, 500)).filter(Boolean)
      : [];
    if (!lines.length) continue;
    return {
      languageCode: code,
      title: nativeLabel ? `${nativeLabel} 안내` : `${code} 안내`,
      body: lines.join("\n")
    };
  }

  return null;
}

export async function loadActivePublicShareSession(
  client: SupabaseClient<WorkspaceDatabase>,
  input: {
    shareSessionId: string;
    workerId?: string;
    now?: Date;
  }
): Promise<PublicShareSessionResult> {
  if (!UUID_PATTERN.test(input.shareSessionId)) {
    return { ok: false, status: 400, message: "공유 세션 식별 형식이 올바르지 않습니다." };
  }

  const { data: sessionRows, error } = await client
    .from("workpack_share_sessions")
    .select("id,organization_id,site_id,workpack_id,share_scope,recipients_snapshot,access_policy,status,expires_at")
    .eq("id", input.shareSessionId)
    .limit(1);

  if (error) {
    if (isPostgrestNoRowsError(error)) {
      return { ok: false, status: 404, message: "유효한 공유 세션을 찾지 못했습니다." };
    }
    console.error("public share session fetch failed", error);
    return { ok: false, status: 500, message: "공유 세션을 확인하지 못했습니다." };
  }

  const sessionData = Array.isArray(sessionRows) ? sessionRows[0] : null;
  if (!sessionData || sessionData.status !== "active") {
    return { ok: false, status: 404, message: "유효한 공유 세션을 찾지 못했습니다." };
  }

  const accessPolicy = parseShareAccessPolicy(sessionData.access_policy);
  if (sessionData.expires_at) {
    const now = input.now || new Date();
    const expiresAt = new Date(sessionData.expires_at).getTime();
    if (!Number.isFinite(expiresAt) || expiresAt <= now.getTime()) {
      return { ok: false, status: 410, message: "공유 세션이 만료되었거나 만료 시각이 올바르지 않습니다." };
    }
  }

  const recipients = parseShareSessionRecipients(sessionData.recipients_snapshot);
  if (sessionData.share_scope === "invited" && !recipients.length) {
    return { ok: false, status: 409, message: "공유 세션 수신자 정보를 확인할 수 없습니다." };
  }

  const requestedWorkerId = input.workerId?.trim() || "";
  if (sessionData.share_scope === "invited" && !accessPolicy.anonymousAllowed) {
    if (!requestedWorkerId || !UUID_PATTERN.test(requestedWorkerId)) {
      return { ok: false, status: 400, message: "공유 세션 접근에는 작업자 식별자가 필요합니다." };
    }
    const authorizedRecipient = recipients.find((recipient) => recipient.workerId === requestedWorkerId);
    if (!authorizedRecipient) {
      return { ok: false, status: 403, message: "공유 세션에 등록된 작업자만 열람 가능합니다." };
    }
    if (accessPolicy.requireKnownWorkerSnapshot && !authorizedRecipient.workerSnapshot) {
      return { ok: false, status: 409, message: "공유 세션에 필요한 작업자 식별 정보가 없어 열람할 수 없습니다." };
    }
  }

  if (sessionData.share_scope === "organization" && !accessPolicy.anonymousAllowed && !requestedWorkerId) {
    return { ok: false, status: 400, message: "이 공유 방식은 별도 식별이 필요합니다." };
  }

  const { data: workpackData, error: workpackError } = await client
    .from("workpacks")
    .select("question,deliverables")
    .eq("id", sessionData.workpack_id)
    .maybeSingle();

  if (workpackError) {
    console.error("public share workpack fetch failed", workpackError);
    return { ok: false, status: 500, message: "작업팩 정보를 확인하지 못했습니다." };
  }
  if (!workpackData || typeof workpackData.question !== "string" || !workpackData.question.trim()) {
    return { ok: false, status: 404, message: "연결된 작업 정보를 찾지 못했습니다." };
  }

  const shareScope = sessionData.share_scope === "organization" ? "organization" : "invited";
  const requestedRecipient = requestedWorkerId
    ? recipients.find((recipient) => recipient.workerId === requestedWorkerId)
    : recipients[0];
  const requestedLanguageCode = requestedRecipient?.languageCode || "ko";

  return {
    ok: true,
    session: {
      id: sessionData.id,
      organizationId: sessionData.organization_id,
      siteId: sessionData.site_id,
      workpackId: sessionData.workpack_id,
      shareScope,
      recipients,
      accessPolicy,
      status: sessionData.status as "active" | "revoked" | "expired",
      expiresAt: sessionData.expires_at,
      question: workpackData.question,
      documents: buildPublicShareDocuments(workpackData.deliverables),
      recipientMessage: buildPublicRecipientMessage(workpackData.deliverables, requestedLanguageCode)
    }
  };
}

export type WorkpackOperationContextResult = {
  ok: true;
  context: WorkpackOperationContext;
} | {
  ok: false;
  status: number;
  message: string;
};

export async function loadOwnedWorkpackOperationContext(
  client: SupabaseClient<WorkspaceDatabase>,
  user: WorkspaceUser,
  workpackId: string
): Promise<WorkpackOperationContextResult> {
  const { data: organizations, error: organizationError } = await client
    .from("organizations")
    .select("id")
    .eq("owner_id", user.id);

  if (organizationError) {
    console.error("commercial workpack organization fetch failed", organizationError);
    return {
      ok: false,
      status: 500,
      message: "작업공간 권한 확인 중 오류가 발생했습니다."
    };
  }

  const organizationIds = (organizations || []).map((organization) => organization.id);
  if (!organizationIds.length) {
    return {
      ok: false,
      status: 404,
      message: "현재 관리자 계정에 연결된 조직이 없습니다."
    };
  }

  const { data: workpack, error: workpackError } = await client
    .from("workpacks")
    .select("id,organization_id,site_id,question,scenario,deliverables,evidence_summary,status,created_at")
    .eq("id", workpackId)
    .in("organization_id", organizationIds)
    .maybeSingle();

  if (workpackError) {
    console.error("commercial workpack fetch failed", workpackError);
    return {
      ok: false,
      status: 500,
      message: "작업팩을 조회하지 못했습니다."
    };
  }

  if (!workpack) {
    return {
      ok: false,
      status: 404,
      message: "작업팩을 찾을 수 없거나 현재 계정 권한 밖입니다."
    };
  }

  return {
    ok: true,
    context: {
      organizationId: workpack.organization_id,
      siteId: workpack.site_id,
      workpackId: workpack.id,
      question: workpack.question,
      generatedAt: workpack.created_at,
      shareAuthority: assessStoredWorkpackShareAuthority({
        question: workpack.question,
        scenario: workpack.scenario,
        deliverables: workpack.deliverables,
        evidenceSummary: workpack.evidence_summary,
        status: workpack.status
      })
    }
  };
}
