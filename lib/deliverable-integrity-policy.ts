export type IntegrityVerdict = "pass" | "blocked";

export type IntegrityIssueCode =
  | "missing_document"
  | "too_short"
  | "placeholder_heavy"
  | "missing_required_term"
  | "missing_scenario_term";

export type IntegrityIssue = {
  code: IntegrityIssueCode;
  detail: string;
};

export type TextDocumentAuditInput = {
  key: string;
  title: string;
  text: string | undefined;
  requiredTerms?: readonly string[];
  scenarioTerms?: readonly string[];
  minChars?: number;
};

export type TextDocumentAudit = {
  key: string;
  title: string;
  verdict: IntegrityVerdict;
  charCount: number;
  placeholderCount: number;
  missingRequiredTerms: string[];
  missingScenarioTerms: string[];
  issues: IntegrityIssue[];
};

export type AskDeliverablesAuditInput = {
  deliverables: Record<string, unknown>;
  requiredKeys?: readonly string[];
  requiredTermsByKey?: Record<string, readonly string[]>;
  scenarioTerms?: readonly string[];
  minCharsByKey?: Record<string, number>;
};

export type IntegritySummary = {
  verdict: IntegrityVerdict;
  totalCount: number;
  passCount: number;
  blockedCount: number;
};

export type DeliverablePresenceStatus =
  | "presentNonEmpty"
  | "explicitNotApplicable"
  | "missingUnexpected";

export type DeliverablePresence = {
  status: DeliverablePresenceStatus;
  reason: string;
};

export const CANONICAL_DELIVERABLE_KEYS = [
  "workpackSummaryDraft",
  "riskAssessmentDraft",
  "workPlanDraft",
  "workPermitDraft",
  "tbmBriefing",
  "tbmLogDraft",
  "safetyEducationRecordDraft",
  "emergencyResponseDraft",
  "photoEvidenceDraft",
  "foreignWorkerBriefing",
  "foreignWorkerTransmission",
  "kakaoMessage"
] as const;

export const REQUIRED_DELIVERABLE_KEYS = CANONICAL_DELIVERABLE_KEYS;

const defaultRequiredTermsByKey: Record<string, readonly string[]> = {
  workpackSummaryDraft: ["작업", "위험", "조치"],
  riskAssessmentDraft: ["위험성평가", "위험요인", "감소대책"],
  workPlanDraft: ["작업계획", "작업", "안전조치"],
  workPermitDraft: ["허가", "격리", "차단", "종료", "작업시간", "보호구"],
  tbmBriefing: ["TBM", "위험", "확인"],
  tbmLogDraft: ["TBM", "참석", "확인"],
  safetyEducationRecordDraft: ["안전보건교육", "교육", "확인"],
  emergencyResponseDraft: ["비상", "연락", "대응"],
  photoEvidenceDraft: ["사진", "증빙", "확인"],
  foreignWorkerBriefing: ["외국인", "보호구", "확인"],
  foreignWorkerTransmission: ["외국인", "작업", "확인"],
  kakaoMessage: ["작업", "위험", "확인"]
};

const unresolvedPlaceholderPatterns = [
  /TODO/gi,
  /TBD/gi,
  /lorem ipsum/gi,
  /샘플/g,
  /예시/g,
  /dummy/gi,
  /placeholder/gi,
  /현장 확인 필요/g
];

const blankPattern = /____+/g;
const allowedBlankLinePattern = /(확인|서명|관리감독자|근로자|작성자|확인일시|일시)/;

function normalizeText(value: string | undefined): string {
  return typeof value === "string" ? value.trim() : "";
}

export function classifyDeliverablePresence(value: unknown): DeliverablePresence {
  const normalized = typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";
  if (!normalized) {
    return {
      status: "missingUnexpected",
      reason: "문서 원본이 비어 있어 재생성이 필요합니다."
    };
  }

  const notApplicableMatch = normalized.match(/해당\s*없음\s*(?:[:：\-–—]\s*|\(\s*)(.+?)(?:\)|$)/u);
  const reason = notApplicableMatch?.[1]?.trim() ?? "";
  if (/해당\s*없음/u.test(normalized)) {
    return reason.length >= 5
      ? { status: "explicitNotApplicable", reason }
      : {
        status: "missingUnexpected",
        reason: "해당 없음 표시는 있으나 사용자가 확인할 사유가 없습니다."
      };
  }

  return {
    status: "presentNonEmpty",
    reason: ""
  };
}

function countPlaceholders(text: string): number {
  const unresolvedCount = unresolvedPlaceholderPatterns.reduce((count, pattern) => count + (text.match(pattern)?.length ?? 0), 0);
  const blankCount = text.split(/\r?\n/).reduce((count, line) => {
    if (allowedBlankLinePattern.test(line)) return count;
    return count + (line.match(blankPattern)?.length ?? 0);
  }, 0);
  return unresolvedCount + blankCount;
}

function findMissingTerms(text: string, terms: readonly string[]): string[] {
  return terms.filter((term) => term.trim().length > 0 && !text.includes(term));
}

export function auditTextDocument(input: TextDocumentAuditInput): TextDocumentAudit {
  const text = normalizeText(input.text);
  const minChars = input.minChars ?? 80;
  const placeholderCount = countPlaceholders(text);
  const missingRequiredTerms = findMissingTerms(text, input.requiredTerms ?? []);
  const missingScenarioTerms = findMissingTerms(text, input.scenarioTerms ?? []);
  const issues: IntegrityIssue[] = [];

  if (!text) {
    issues.push({ code: "missing_document", detail: "문서 본문이 비어 있습니다." });
  }
  if (text.length > 0 && text.length < minChars) {
    issues.push({ code: "too_short", detail: `본문 길이 ${text.length}자가 최소 기준 ${minChars}자보다 짧습니다.` });
  }
  if (placeholderCount >= 2) {
    issues.push({ code: "placeholder_heavy", detail: `placeholder 또는 현장 확인 문구가 ${placeholderCount}개 남아 있습니다.` });
  }
  if (missingRequiredTerms.length) {
    issues.push({ code: "missing_required_term", detail: `필수 문구 누락: ${missingRequiredTerms.join(", ")}` });
  }
  if (missingScenarioTerms.length) {
    issues.push({ code: "missing_scenario_term", detail: `시나리오 핵심어 누락: ${missingScenarioTerms.join(", ")}` });
  }

  return {
    key: input.key,
    title: input.title,
    verdict: issues.length ? "blocked" : "pass",
    charCount: text.length,
    placeholderCount,
    missingRequiredTerms,
    missingScenarioTerms,
    issues
  };
}

export function auditAskDeliverables(input: AskDeliverablesAuditInput): TextDocumentAudit[] {
  const requiredKeys = input.requiredKeys ?? REQUIRED_DELIVERABLE_KEYS;
  return requiredKeys.map((key) => {
    const value = input.deliverables[key];
    return auditTextDocument({
      key,
      title: key,
      text: typeof value === "string" ? value : undefined,
      requiredTerms: input.requiredTermsByKey?.[key] ?? defaultRequiredTermsByKey[key] ?? [],
      scenarioTerms: input.scenarioTerms ? [...input.scenarioTerms] : [],
      minChars: input.minCharsByKey?.[key]
    });
  });
}

export function summarizeIntegrityItems(items: readonly TextDocumentAudit[]): IntegritySummary {
  const blockedCount = items.filter((item) => item.verdict === "blocked").length;
  return {
    verdict: blockedCount > 0 ? "blocked" : "pass",
    totalCount: items.length,
    passCount: items.length - blockedCount,
    blockedCount
  };
}
