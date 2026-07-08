import { buildPhotoAnalysisCandidate } from "@/lib/operation-improvements";

type ShareRecipientRole = "viewer" | "editor";
type ShareScope = "invited" | "organization";
type PhotoKind = "before" | "after";

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
    confirmation_method: "button";
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
      worker_snapshot: {
        ...input.workerSnapshot,
        displayName
      },
      language_code: cleanLanguageCode(input.languageCode),
      confirmation_method: "button"
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
