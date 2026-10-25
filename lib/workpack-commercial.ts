import { buildPhotoAnalysisCandidate } from "@/lib/operation-improvements";

type ShareRecipientRole = "viewer" | "editor";
type ShareScope = "invited" | "organization";
type PhotoKind = "before" | "after";
export type WorkpackDispatchChannel = "email" | "sms" | "kakao";

export type ServerWorkerRow = {
  id: string;
  organization_id: string;
  site_id: string | null;
  external_key: string;
  display_name: string;
  role: string;
  joined_at: string | null;
  experience_summary: string | null;
  nationality: string | null;
  language_code: string | null;
  language_label: string | null;
  is_new_worker: boolean;
  is_foreign_worker: boolean;
  training_status: string;
  training_summary: string | null;
  phone: string | null;
  email: string | null;
};

export type ShareRecipientInput = {
  workerId?: string;
  displayName: string;
  languageCode?: string;
  role?: ShareRecipientRole;
  workerSnapshot?: Record<string, unknown>;
};

export type ShareSessionDraft = {
  organization_id: string;
  site_id: string | null;
  workpack_id: string;
  share_scope: ShareScope;
  recipients_snapshot: Array<{
    workerId: string | null;
    displayName: string;
    languageCode: string;
    role: ShareRecipientRole;
    workerSnapshot?: Record<string, unknown>;
  }>;
  access_policy: {
    anonymousAllowed: false;
    manualLanguageSwitchAllowed: true;
    requireKnownWorkerSnapshot: true;
  };
  status: "active";
  created_by: string | null;
};

export type ReadConfirmationDraft = {
  ok: true;
  insert: {
    organization_id: string;
    site_id: string | null;
    workpack_id: string;
    share_session_id: string | null;
    worker_id: string | null;
    worker_display_name: string;
    worker_snapshot: Record<string, unknown>;
    language_code: string;
    confirmation_method: "button" | "admin_marked";
  };
} | {
  ok: false;
  message: string;
};

export type ImprovementDraft = {
  organization_id: string;
  site_id: string | null;
  workpack_id: string;
  task_label: string;
  hazard_label: string;
  improvement_text: string;
  reflected_documents: string[];
  review_status: "candidate";
  source_type: "manual" | "photo_analysis";
  photo_summary: {
    beforePhotoName: string | null;
    afterPhotoName: string | null;
  };
  created_by: string | null;
};

const DEFAULT_REFLECTED_DOCUMENTS = ["위험성평가표", "TBM 브리핑", "TBM 기록"];

function cleanLabel(value: string, fallback: string) {
  const trimmed = value.trim();
  return trimmed || fallback;
}

function cleanLanguageCode(value: string | undefined) {
  const trimmed = value?.trim().toLowerCase();
  return trimmed || "ko";
}

function cleanRole(value: ShareRecipientRole | undefined): ShareRecipientRole {
  return value === "editor" ? "editor" : "viewer";
}

function cleanReflectedDocuments(value: string[] | undefined) {
  const cleaned = (value || DEFAULT_REFLECTED_DOCUMENTS)
    .map((item) => item.trim())
    .filter(Boolean);
  return cleaned.length ? Array.from(new Set(cleaned)) : DEFAULT_REFLECTED_DOCUMENTS;
}

function hasSnapshot(value: Record<string, unknown>) {
  return Object.keys(value).length > 0;
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type ServerShareRecipientsResult = {
  ok: true;
  recipients: ShareRecipientInput[];
} | {
  ok: false;
  message: string;
};

export type ShareRecipientIdsResult = {
  ok: true;
  workerIds: string[];
} | {
  ok: false;
  message: string;
};

function validateWorkerIds(workerIds: string[]): ShareRecipientIdsResult {
  if (!workerIds.length) {
    return { ok: false, message: "공유 대상 작업자를 한 명 이상 선택해 주세요." };
  }
  if (workerIds.some((workerId) => !UUID_PATTERN.test(workerId))) {
    return { ok: false, message: "유효하지 않은 작업자 식별자가 포함되어 있습니다." };
  }
  if (new Set(workerIds).size !== workerIds.length) {
    return { ok: false, message: "중복된 작업자는 공유 대상에 포함할 수 없습니다." };
  }
  return { ok: true, workerIds };
}

export function parseShareRecipientIds(value: unknown): ShareRecipientIdsResult {
  if (!Array.isArray(value)) return validateWorkerIds([]);
  const workerIds: string[] = [];
  for (const item of value) {
    if (typeof item === "string") {
      workerIds.push(item.trim());
      continue;
    }
    if (typeof item !== "object" || item === null || Array.isArray(item)) {
      return { ok: false, message: "공유 대상 작업자 형식이 올바르지 않습니다." };
    }
    const workerId = typeof (item as Record<string, unknown>).workerId === "string"
      ? ((item as Record<string, unknown>).workerId as string).trim()
      : "";
    workerIds.push(workerId);
  }
  return validateWorkerIds(workerIds);
}

export function buildServerShareRecipients(input: {
  organizationId: string;
  siteId: string | null;
  requestedWorkerIds: string[];
  workers: ServerWorkerRow[];
}): ServerShareRecipientsResult {
  const workerIds = input.requestedWorkerIds.map((workerId) => workerId.trim());
  const validated = validateWorkerIds(workerIds);
  if (!validated.ok) return validated;

  const workersById = new Map(input.workers.map((worker) => [worker.id, worker]));
  if (workerIds.some((workerId) => !workersById.has(workerId))) {
    return { ok: false, message: "서버 작업자 명부에서 공유 대상을 확인하지 못했습니다." };
  }

  const foreignWorker = workerIds
    .map((workerId) => workersById.get(workerId))
    .find((worker) => worker && (
      worker.organization_id !== input.organizationId ||
      (input.siteId !== null && worker.site_id !== input.siteId)
    ));
  if (foreignWorker) {
    return { ok: false, message: "현재 작업팩 조직 또는 현장 밖의 작업자는 공유 대상이 될 수 없습니다." };
  }

  return {
    ok: true,
    recipients: workerIds.map((workerId) => {
      const worker = workersById.get(workerId) as ServerWorkerRow;
      const languageCode = cleanLanguageCode(worker.language_code || undefined);
      return {
        workerId: worker.id,
        displayName: worker.display_name,
        languageCode,
        role: "viewer",
        workerSnapshot: {
          workerId: worker.id,
          externalKey: worker.external_key,
          displayName: worker.display_name,
          workerRole: worker.role,
          joinedAt: worker.joined_at,
          experienceSummary: worker.experience_summary,
          nationality: worker.nationality,
          languageCode,
          languageLabel: worker.language_label,
          isNewWorker: worker.is_new_worker,
          isForeignWorker: worker.is_foreign_worker,
          trainingStatus: worker.training_status,
          trainingSummary: worker.training_summary,
          phone: worker.phone,
          email: worker.email
        }
      };
    })
  };
}

export function parseShareSessionRecipients(value: unknown): ShareRecipientInput[] {
  if (!Array.isArray(value) || !value.length) return [];
  const recipients: ShareRecipientInput[] = [];
  for (const item of value) {
    if (typeof item !== "object" || item === null || Array.isArray(item)) return [];
    const record = item as Record<string, unknown>;
    const workerId = typeof record.workerId === "string" ? record.workerId.trim() : "";
    const displayName = typeof record.displayName === "string" ? record.displayName.trim() : "";
    const workerSnapshot = typeof record.workerSnapshot === "object" && record.workerSnapshot !== null && !Array.isArray(record.workerSnapshot)
      ? record.workerSnapshot as Record<string, unknown>
      : null;
    if (!UUID_PATTERN.test(workerId) || !displayName || !workerSnapshot || !hasSnapshot(workerSnapshot)) return [];
    if (workerSnapshot.workerId !== workerId || workerSnapshot.displayName !== displayName) return [];
    recipients.push({
      workerId,
      displayName,
      languageCode: cleanLanguageCode(typeof record.languageCode === "string" ? record.languageCode : undefined),
      role: record.role === "editor" ? "editor" : "viewer",
      workerSnapshot
    });
  }
  const workerIds = recipients.map((recipient) => recipient.workerId as string);
  return new Set(workerIds).size === workerIds.length ? recipients : [];
}

export function findShareSessionRecipient(recipients: ShareRecipientInput[], workerId: string) {
  return recipients.find((recipient) => recipient.workerId === workerId) || null;
}

function readSnapshotContact(recipient: ShareRecipientInput, key: "phone" | "email") {
  const value = recipient.workerSnapshot?.[key];
  return typeof value === "string" ? value.trim() : "";
}

function normalizePhoneVerification(value: string): string {
  return value.replace(/\D/gu, "");
}

function normalizeEmailVerification(value: string): string {
  return value.trim().toLowerCase();
}

export type ShareRecipientContactVerification = {
  ok: true;
  method: "phone" | "email";
} | {
  ok: false;
  reason: "missing_verification" | "recipient_contact_unavailable" | "verification_mismatch";
};

export function verifyShareRecipientContact(
  recipient: ShareRecipientInput,
  verification: string
): ShareRecipientContactVerification {
  const candidate = verification.trim();
  if (!candidate) return { ok: false, reason: "missing_verification" };

  const phone = normalizePhoneVerification(readSnapshotContact(recipient, "phone"));
  const email = normalizeEmailVerification(readSnapshotContact(recipient, "email"));
  if (!phone && !email) {
    return { ok: false, reason: "recipient_contact_unavailable" };
  }

  const candidatePhone = normalizePhoneVerification(candidate);
  if (phone.length >= 8 && candidatePhone === phone) {
    return { ok: true, method: "phone" };
  }
  if (email && candidate.includes("@") && normalizeEmailVerification(candidate) === email) {
    return { ok: true, method: "email" };
  }
  return { ok: false, reason: "verification_mismatch" };
}

export function validateDispatchContacts(input: {
  channels: WorkpackDispatchChannel[];
  recipients: ShareRecipientInput[];
}): { ok: true } | { ok: false; message: string } {
  if (!input.recipients.length) {
    return { ok: false, message: "공유 세션에 전파할 작업자가 없습니다." };
  }

  const missing = input.recipients.flatMap((recipient) => {
    const channels = input.channels.filter((channel) => (
      channel === "email"
        ? !readSnapshotContact(recipient, "email")
        : !readSnapshotContact(recipient, "phone")
    ));
    return channels.length ? [`${recipient.displayName}: ${channels.join(", ")}`] : [];
  });

  if (missing.length) {
    return {
      ok: false,
      message: `공유 세션 snapshot에 채널 연락처가 없는 작업자가 있습니다. ${missing.join(" / ")}`
    };
  }

  return { ok: true };
}

// 작업자 연락처 보유기간(2026-10-25 결정 19): 공유 세션이 중지되면 즉시, 만료되면 30일 뒤
// 스냅숏의 연락처(phone·email)를 지운다. SafeClaw 는 고객사의 수탁자로 처리한다.
export const SHARE_CONTACT_RETENTION_DAYS_AFTER_EXPIRY = 30;
const SNAPSHOT_CONTACT_KEYS = ["phone", "email"] as const;

export function stripWorkerSnapshotContacts(snapshot: Record<string, unknown>): Record<string, unknown> {
  const next: Record<string, unknown> = { ...snapshot };
  for (const key of SNAPSHOT_CONTACT_KEYS) delete next[key];
  return next;
}

export function countRecipientSnapshotContacts(recipientsSnapshot: unknown): number {
  if (!Array.isArray(recipientsSnapshot)) return 0;
  let count = 0;
  for (const recipient of recipientsSnapshot) {
    if (typeof recipient !== "object" || recipient === null) continue;
    const snapshot = (recipient as Record<string, unknown>).workerSnapshot;
    if (typeof snapshot !== "object" || snapshot === null) continue;
    for (const key of SNAPSHOT_CONTACT_KEYS) {
      const value = (snapshot as Record<string, unknown>)[key];
      if (typeof value === "string" && value.trim()) count += 1;
    }
  }
  return count;
}

export function stripRecipientSnapshotContacts(recipientsSnapshot: unknown): unknown[] {
  if (!Array.isArray(recipientsSnapshot)) return [];
  return recipientsSnapshot.map((recipient) => {
    if (typeof recipient !== "object" || recipient === null || Array.isArray(recipient)) return recipient;
    const record = recipient as Record<string, unknown>;
    const snapshot = record.workerSnapshot;
    if (typeof snapshot !== "object" || snapshot === null || Array.isArray(snapshot)) return record;
    return { ...record, workerSnapshot: stripWorkerSnapshotContacts(snapshot as Record<string, unknown>) };
  });
}

export function shareContactPurgeCutoff(now: Date = new Date()): string {
  return new Date(now.getTime() - SHARE_CONTACT_RETENTION_DAYS_AFTER_EXPIRY * 24 * 60 * 60 * 1_000).toISOString();
}

export function buildShareSessionDraft(input: {
  organizationId: string;
  siteId: string | null;
  workpackId: string;
  createdBy: string | null;
  recipients?: ShareRecipientInput[];
  shareScope?: ShareScope;
}): ShareSessionDraft {
  return {
    organization_id: input.organizationId,
    site_id: input.siteId,
    workpack_id: input.workpackId,
    share_scope: input.shareScope || "invited",
    recipients_snapshot: (input.recipients || []).map((recipient) => ({
      workerId: recipient.workerId?.trim() || null,
      displayName: cleanLabel(recipient.displayName, "작업자"),
      languageCode: cleanLanguageCode(recipient.languageCode),
      role: cleanRole(recipient.role),
      workerSnapshot: {
        ...(recipient.workerSnapshot || {}),
        workerId: recipient.workerId?.trim() || null,
        displayName: cleanLabel(recipient.displayName, "작업자"),
        languageCode: cleanLanguageCode(recipient.languageCode),
        role: cleanRole(recipient.role)
      }
    })),
    access_policy: {
      anonymousAllowed: false,
      manualLanguageSwitchAllowed: true,
      requireKnownWorkerSnapshot: true
    },
    status: "active",
    created_by: input.createdBy
  };
}

export function buildReadConfirmationDraft(input: {
  organizationId: string;
  siteId: string | null;
  workpackId: string;
  shareSessionId?: string | null;
  workerId?: string | null;
  displayName: string;
  workerSnapshot: Record<string, unknown>;
  languageCode?: string;
  confirmationMethod?: "button" | "admin_marked";
}): ReadConfirmationDraft {
  const displayName = input.displayName.trim();
  if (!displayName) {
    return {
      ok: false,
      message: "작업자 표시명이 확인되어야 열람 확인을 저장할 수 있습니다."
    };
  }

  if (!hasSnapshot(input.workerSnapshot)) {
    return {
      ok: false,
      message: "작업자 snapshot이 확인되어야 열람 확인을 저장할 수 있습니다."
    };
  }

  return {
    ok: true,
    insert: {
      organization_id: input.organizationId,
      site_id: input.siteId,
      workpack_id: input.workpackId,
      share_session_id: input.shareSessionId || null,
      worker_id: input.workerId?.trim() || null,
      worker_display_name: displayName,
      // 열람 확인 기록에는 연락처를 남기지 않는다 — 확인은 이미 끝났고, 보유기간 정리 대상을 줄인다.
      worker_snapshot: {
        ...stripWorkerSnapshotContacts(input.workerSnapshot),
        displayName
      },
      language_code: cleanLanguageCode(input.languageCode),
      confirmation_method: input.confirmationMethod === "admin_marked" ? "admin_marked" : "button"
    }
  };
}

export function buildImprovementDraft(input: {
  organizationId: string;
  siteId: string | null;
  workpackId: string;
  taskLabel: string;
  hazardLabel: string;
  improvementText?: string;
  beforePhotoName?: string | null;
  afterPhotoName?: string | null;
  reflectedDocuments?: string[];
  createdBy?: string | null;
}): ImprovementDraft {
  const beforePhotoName = input.beforePhotoName?.trim() || null;
  const afterPhotoName = input.afterPhotoName?.trim() || null;
  const sourceType = beforePhotoName && afterPhotoName ? "photo_analysis" : "manual";
  const taskLabel = cleanLabel(input.taskLabel, "현장 작업");
  const hazardLabel = cleanLabel(input.hazardLabel, "핵심 위험");
  const reflectedDocuments = cleanReflectedDocuments(input.reflectedDocuments);
  const photoCandidate = buildPhotoAnalysisCandidate({
    beforePhoto: beforePhotoName ? { name: beforePhotoName } : null,
    afterPhoto: afterPhotoName ? { name: afterPhotoName } : null,
    workSummary: taskLabel,
    topRisk: hazardLabel,
    reflectedDocuments
  });

  return {
    organization_id: input.organizationId,
    site_id: input.siteId,
    workpack_id: input.workpackId,
    task_label: taskLabel,
    hazard_label: hazardLabel,
    improvement_text: input.improvementText?.trim() || photoCandidate || "현장 개선사항 후보를 입력해 주세요.",
    reflected_documents: reflectedDocuments,
    review_status: "candidate",
    source_type: sourceType,
    photo_summary: {
      beforePhotoName,
      afterPhotoName
    },
    created_by: input.createdBy || null
  };
}

export function buildImprovementPhotoPath(input: {
  organizationId: string;
  workpackId: string;
  improvementId: string;
  kind: PhotoKind;
  fileName: string;
}) {
  const safeFileName = input.fileName
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9._-]+/g, "")
    .replace(/^-+|-+$/g, "") || "photo";

  return [
    "organizations",
    input.organizationId,
    "workpacks",
    input.workpackId,
    "improvements",
    input.improvementId,
    `${input.kind}-${safeFileName}`
  ].join("/");
}
