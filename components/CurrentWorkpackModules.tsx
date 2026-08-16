"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { createClient, type Session } from "@supabase/supabase-js";
import { CitationList } from "@/components/CitationList";
import { WorkflowSharePanel } from "@/components/WorkflowSharePanel";
import {
  WorkpackEditor,
  type DocumentKey,
  type WorkpackDeliverablesChange,
  type WorkpackDocumentValues
} from "@/components/WorkpackEditor";
import {
  buildStoredCurrentWorkpack,
  buildWorkpackGenerationFingerprint,
  CURRENT_WORKPACK_STORAGE_KEY,
  parseStoredCurrentWorkpack,
  type CurrentDispatchSnapshot,
  type CurrentWorkerSnapshot
} from "@/lib/current-workpack";
import {
  classifyDeliverablePresence,
  type DeliverablePresenceStatus
} from "@/lib/deliverable-integrity-policy";
import type { AskResponse } from "@/lib/types";
import { formatDispatchProviderStatus } from "@/lib/web-safe-presentation";
import { applyWorkpackDeliverablesChange } from "@/lib/workpack-readiness";
import {
  buildDefaultWorkers,
  buildEducationRecordDrafts,
  buildRecipientSuggestions,
  buildWorkerDispatchTargets,
  maskEmail,
  maskPhone,
  summarizeWorkers,
  type RecipientSuggestion,
  type WorkerDispatchTarget,
  type WorkerExperienceLevel,
  type WorkerProfile,
  type WorkerTrainingStatus
} from "@/lib/workspace";

type CurrentWorkpackSnapshot = {
  data: AskResponse;
  isCurrent: boolean;
  savedAt: string | null;
  generationFingerprint: string;
  workerSnapshot?: CurrentWorkerSnapshot;
  dispatchSnapshot?: CurrentDispatchSnapshot;
};

type CurrentWorkpackState = CurrentWorkpackSnapshot & {
  reopenMessage: string | null;
  reopenStatus: "idle" | "loading" | "ready" | "blocked";
  updateData: (data: AskResponse) => void;
  updateWorkerSnapshot: (workerSnapshot: CurrentWorkerSnapshot) => void;
  updateDispatchSnapshot: (dispatchSnapshot: CurrentDispatchSnapshot | undefined) => void;
};

type LaunchDocument = {
  key: DocumentKey;
  title: string;
  tier: "핵심" | "제출" | "보조";
  owner: string;
  description: string;
};

type DeliverableDocumentKey = Extract<DocumentKey, keyof AskResponse["deliverables"]>;
type ArchiveWorkpack = {
  id: string;
  organizationName: string;
  siteName: string;
  industry: string | null;
  region: string | null;
  question: string;
  createdAt: string;
  updatedAt: string;
  reopenHref: string;
};
type ArchiveDispatchLog = {
  id: string;
  siteName: string;
  channel: string;
  targetLabel: string | null;
  languageCode: string | null;
  provider: string | null;
  providerStatus: string | null;
  workflowRunId: string | null;
  failureReason: string | null;
  createdAt: string;
};
type ServerArchiveState = {
  status: "idle" | "loading" | "ready" | "login-required" | "unconfigured" | "error";
  message: string;
  workpacks: ArchiveWorkpack[];
  dispatchLogs: ArchiveDispatchLog[];
};
type EvidenceRole = "direct" | "supporting";
type EvidenceCard = {
  id: string;
  title: string;
  summary: string;
  sourceLabel: string;
  role: EvidenceRole;
  roleLabel: string;
  reflectedDocuments: string[];
  reflectionLabel: string;
  href: string;
};

const launchDocuments: LaunchDocument[] = [
  {
    key: "riskAssessmentDraft",
    title: "위험성평가표",
    tier: "핵심",
    owner: "작업 전 판단",
    description: "4M 위험요인과 감소대책을 먼저 확인합니다."
  },
  {
    key: "tbmBriefing",
    title: "TBM 브리핑",
    tier: "핵심",
    owner: "작업반장",
    description: "작업 전 읽고 확인 질문으로 전환합니다."
  },
  {
    key: "foreignWorkerTransmission",
    title: "외국인 전송본",
    tier: "제출",
    owner: "현장 전파",
    description: "언어별 짧은 공지와 관리자 확인 문구를 씁니다."
  },
  {
    key: "workPlanDraft",
    title: "작업계획서",
    tier: "제출",
    owner: "관리감독자",
    description: "작업순서, 중지기준, 확인 근거를 묶습니다."
  },
  {
    key: "workPermitDraft",
    title: "안전작업허가 확인서",
    tier: "제출",
    owner: "작업 허가",
    description: "위험작업 허가, 격리·차단, 종료 확인을 정리합니다."
  },
  {
    key: "safetyEducationRecordDraft",
    title: "안전보건교육 기록",
    tier: "제출",
    owner: "교육 확인",
    description: "교육대상, 내용, 확인방법을 남깁니다."
  },
  {
    key: "tbmLogDraft",
    title: "TBM 기록",
    tier: "핵심",
    owner: "기록 보관",
    description: "참석자, 보호구, 미조치 위험요인을 확인합니다."
  },
  {
    key: "workpackSummaryDraft",
    title: "점검결과 요약",
    tier: "보조",
    owner: "보고 요약",
    description: "오늘 문서팩의 핵심 판단을 한 장으로 압축합니다."
  },
  {
    key: "emergencyResponseDraft",
    title: "비상대응 절차",
    tier: "보조",
    owner: "사고 대응",
    description: "중지, 초기조치, 보고체계를 정리합니다."
  },
  {
    key: "photoEvidenceDraft",
    title: "사진·증빙",
    tier: "보조",
    owner: "증빙 보관",
    description: "촬영자, 확인자, 보관 위치를 남깁니다."
  },
  {
    key: "foreignWorkerBriefing",
    title: "외국인 근로자 출력본",
    tier: "제출",
    owner: "교육 출력",
    description: "쉬운 한국어와 기본 다국어 교육본을 확인합니다."
  },
  {
    key: "kakaoMessage",
    title: "현장 공유 메시지",
    tier: "보조",
    owner: "현장 공유",
    description: "메신저와 단체방에 사용할 축약본을 확인합니다."
  }
];

const editorialReviewChecks = [
  { key: "scenario", label: "현장·작업 맥락이 현재 시나리오와 일치" },
  { key: "hazards", label: "위험요인과 근로자 특성이 빠짐없이 반영" },
  { key: "controls", label: "안전조치가 구체적이고 현장에서 실행 가능" },
  { key: "legal", label: "법령·KOSHA 표현에 과장이나 대체 주장 없음" },
  { key: "wording", label: "중복·템플릿 잔재·미완성 문구 없음" }
] as const;

const editorialCanonicalDocumentKeys: DocumentKey[] = [
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
];

type EditorialReviewCheckKey = (typeof editorialReviewChecks)[number]["key"];
type EditorialReviewEntry = {
  checks: Partial<Record<EditorialReviewCheckKey, boolean>>;
  findingsReviewed: boolean;
  reviewedFindingsFingerprint: string | null;
  note: string;
  completedAt: string | null;
  reviewedTextFingerprint: string | null;
};
type EditorialReviewState = Partial<Record<DocumentKey, EditorialReviewEntry>>;

type EditorialReviewReceiptDocument = {
  key: DocumentKey;
  title: string;
  tier: LaunchDocument["tier"];
  owner: string;
  completedAt: string;
  reviewedTextFingerprint: string;
  currentTextFingerprint: string;
  findingsReviewed: true;
  editorialFindingsFingerprint: string;
  editorialFindingIds: string[];
  editorialFindingCounts: Partial<Record<EditorialFindingCategory, number>>;
  checks: Record<EditorialReviewCheckKey, true>;
  note: string;
};

function emptyEditorialReviewEntry(): EditorialReviewEntry {
  return {
    checks: {},
    findingsReviewed: false,
    reviewedFindingsFingerprint: null,
    note: "",
    completedAt: null,
    reviewedTextFingerprint: null
  };
}

function editorialTextFingerprint(text: string): string {
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash = Math.imul(hash ^ text.charCodeAt(index), 16777619);
  }
  return `${text.length}:${(hash >>> 0).toString(16)}`;
}

type EditorialFindingCategory =
  | "generic-template-overuse"
  | "legal-reference-consistency"
  | "independent-document-context"
  | "cross-document-hazard-consistency"
  | "cross-document-control-consistency"
  | "document-role-prefix-variant"
  | "human-review-required";

type EditorialDuplicateFinding = {
  id: string;
  kind: "exact" | "near";
  category: EditorialFindingCategory;
  documentKeys: DocumentKey[];
  label: string;
  excerpt: string;
};

const editorialFindingLabels: Record<EditorialFindingCategory, string> = {
  "generic-template-overuse": "일반 템플릿 반복",
  "legal-reference-consistency": "법령 근거 일관성",
  "independent-document-context": "문서별 현장 맥락",
  "cross-document-hazard-consistency": "위험요인 전달 일관성",
  "cross-document-control-consistency": "안전조치 전달 일관성",
  "document-role-prefix-variant": "문서 역할별 표현",
  "human-review-required": "사람 판단 필요"
};

function normalizeEditorialLine(value: string): string {
  return value.replace(/\s+/gu, " ").trim();
}

function splitEditorialReviewLines(value: string): string[] {
  return value
    .split(/\r?\n/gu)
    .map((line) => normalizeEditorialLine(line.replace(/^\s*(?:[-*•]|\d+[.)])\s*/u, "")))
    .filter((line) => line.length >= 28)
    .filter((line) => !/^(?:문서명|현장명|회사명|작성일|작업일|작업명|목적|대상|장소)\s*[:：]/u.test(line));
}

function editorialLineTokens(value: string): Set<string> {
  return new Set(
    value.toLocaleLowerCase()
      .replace(/[^\p{L}\p{N}\s]/gu, " ")
      .split(/\s+/gu)
      .filter((token) => token.length >= 2)
  );
}

function editorialJaccard(left: Set<string>, right: Set<string>): number {
  const union = new Set([...left, ...right]);
  if (!union.size) return 0;
  let intersection = 0;
  left.forEach((token) => {
    if (right.has(token)) intersection += 1;
  });
  return intersection / union.size;
}

function stripEditorialRolePrefix(value: string): string {
  return normalizeEditorialLine(value)
    .replace(/^[⚠️\s]*/u, "")
    .replace(/^\[\d+\.\s*(.+)\]$/u, "$1")
    .replace(/^(?:작업조건\s*판단|작업조건|기상\s*및\s*작업조건|TBM\s*조건확인|TBM\s*기록조건|작업\s*전\s*조건확인|허가\s*전\s*조건확인|교육\s*전\s*조건확인|비상대응\s*조건|촬영\s*확인조건|핵심\s*위험요인|핵심\s*위험|핵심위험|가장\s*큰\s*위험|유해·위험요인|위험요인\s*\d+|현재\s*안전조치|안전조치\s*\d+|조치내용|공정|작업구간|세부작업|단계별\s*안전조치|즉시\s*조치|필수조치|작업중지\s*기준|변경관리\s*확인)\s*[:：]\s*/u, "")
    .toLocaleLowerCase();
}

function classifyEditorialExact(line: string): EditorialFindingCategory {
  if (
    /현장\s*조건\s*미지정.{0,30}작업\s*전\s*실제\s*환경\s*확인\s*필요/u.test(line)
    || /현장\s*여건에\s*맞는\s*담당자.{0,80}전파\s*전\s*관리자가\s*확인/u.test(line)
  ) return "generic-template-overuse";
  if (/^(?:필수\s*안전조치\s*반영|관련\s*조문\s*확인)\s*[:：]/u.test(line)) {
    return "legal-reference-consistency";
  }
  if (/^(?:작업조건|기상\s*및\s*작업조건)\s*[:：]/u.test(line)) {
    return "independent-document-context";
  }
  if (/(?:확인|통제|차단|지정|작업중지|작업\s*보류|착용|분리|복창|가동)/u.test(line)) {
    return "cross-document-control-consistency";
  }
  return "human-review-required";
}

function classifyEditorialNear(
  left: { key: DocumentKey; line: string },
  right: { key: DocumentKey; line: string }
): EditorialFindingCategory {
  const combined = `${left.line} ${right.line}`;
  const pair = `${left.key}->${right.key}`;
  if (
    /작업조건|조건확인/u.test(combined)
    && /^workpackSummaryDraft->(?:foreignWorkerBriefing|foreignWorkerTransmission|kakaoMessage)$/u.test(pair)
  ) return "independent-document-context";
  if (
    /위험요인|위험\]/u.test(combined)
    && /^(?:workpackSummaryDraft->safetyEducationRecordDraft|riskAssessmentDraft->(?:tbmBriefing|tbmLogDraft|photoEvidenceDraft))$/u.test(pair)
  ) return "cross-document-hazard-consistency";
  if (
    /안전조치|조치내용|단계별\s*안전조치|즉시\s*조치|필수조치/u.test(combined)
    && /^(?:riskAssessmentDraft->workPermitDraft|workPlanDraft->(?:safetyEducationRecordDraft|kakaoMessage)|workPermitDraft->(?:foreignWorkerBriefing|foreignWorkerTransmission|kakaoMessage))$/u.test(pair)
  ) return "cross-document-control-consistency";
  if (stripEditorialRolePrefix(left.line) === stripEditorialRolePrefix(right.line)) {
    return "document-role-prefix-variant";
  }
  return "human-review-required";
}

function buildEditorialDuplicateFindings(data: AskResponse): EditorialDuplicateFinding[] {
  const lines = editorialCanonicalDocumentKeys.flatMap((key) => (
    [...new Set(splitEditorialReviewLines(buildDerivedDocumentText(data, key)))].map((line) => ({
      key,
      line,
      normalized: line.toLocaleLowerCase()
    }))
  ));
  const exactGroups = new Map<string, { line: string; documentKeys: Set<DocumentKey> }>();
  lines.forEach((item) => {
    const group = exactGroups.get(item.normalized) || { line: item.line, documentKeys: new Set<DocumentKey>() };
    group.documentKeys.add(item.key);
    exactGroups.set(item.normalized, group);
  });
  const findings: EditorialDuplicateFinding[] = [...exactGroups.values()]
    .filter((group) => group.documentKeys.size >= 4)
    .map((group) => {
      const documentKeys = [...group.documentKeys];
      const category = classifyEditorialExact(group.line);
      const excerpt = group.line.slice(0, 180);
      return {
        id: editorialTextFingerprint(`exact|${category}|${documentKeys.join(",")}|${group.line}`),
        kind: "exact" as const,
        category,
        documentKeys,
        label: editorialFindingLabels[category],
        excerpt
      };
    });

  let nearCount = 0;
  for (let leftIndex = 0; leftIndex < lines.length && nearCount < 20; leftIndex += 1) {
    const left = lines[leftIndex];
    const leftTokens = editorialLineTokens(left.line);
    if (leftTokens.size < 5) continue;
    for (let rightIndex = leftIndex + 1; rightIndex < lines.length && nearCount < 20; rightIndex += 1) {
      const right = lines[rightIndex];
      if (left.key === right.key || left.normalized === right.normalized) continue;
      const roleNormalizedMatch = stripEditorialRolePrefix(left.line) === stripEditorialRolePrefix(right.line);
      if (editorialJaccard(leftTokens, editorialLineTokens(right.line)) < 0.9 && !roleNormalizedMatch) continue;
      const category = classifyEditorialNear(left, right);
      const documentKeys = [left.key, right.key];
      findings.push({
        id: editorialTextFingerprint(`near|${category}|${documentKeys.join(",")}|${left.line}|${right.line}`),
        kind: "near",
        category,
        documentKeys,
        label: editorialFindingLabels[category],
        excerpt: `${left.line.slice(0, 82)} ↔ ${right.line.slice(0, 82)}`
      });
      nearCount += 1;
    }
  }
  return findings;
}

function editorialFindingsFingerprint(findings: EditorialDuplicateFinding[]): string {
  return editorialTextFingerprint(findings.map((finding) => finding.id).sort().join("|"));
}

function editorialFindingCounts(
  findings: EditorialDuplicateFinding[]
): Partial<Record<EditorialFindingCategory, number>> {
  return findings.reduce<Partial<Record<EditorialFindingCategory, number>>>((counts, finding) => ({
    ...counts,
    [finding.category]: (counts[finding.category] || 0) + 1
  }), {});
}

function parseEditorialReviewState(raw: string | null): EditorialReviewState {
  if (!raw) return {};

  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};

    const record = parsed as Record<string, unknown>;
    const state: EditorialReviewState = {};
    launchDocuments.forEach((document) => {
      const candidate = record[document.key];
      if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) return;

      const entry = candidate as Record<string, unknown>;
      const rawChecks = entry.checks;
      const checks: Partial<Record<EditorialReviewCheckKey, boolean>> = {};
      if (rawChecks && typeof rawChecks === "object" && !Array.isArray(rawChecks)) {
        const checkRecord = rawChecks as Record<string, unknown>;
        editorialReviewChecks.forEach((check) => {
          if (checkRecord[check.key] === true) checks[check.key] = true;
        });
      }

      state[document.key] = {
        checks,
        findingsReviewed: entry.findingsReviewed === true,
        reviewedFindingsFingerprint: typeof entry.reviewedFindingsFingerprint === "string"
          ? entry.reviewedFindingsFingerprint
          : null,
        note: typeof entry.note === "string" ? entry.note.slice(0, 2000) : "",
        completedAt: typeof entry.completedAt === "string" ? entry.completedAt : null,
        reviewedTextFingerprint: typeof entry.reviewedTextFingerprint === "string"
          ? entry.reviewedTextFingerprint
          : null
      };
    });
    return state;
  } catch (error) {
    console.warn("document editorial review state parse failed", error);
    return {};
  }
}

function editorialReviewIsCurrent(
  data: AskResponse,
  key: DocumentKey,
  entry: EditorialReviewEntry | undefined,
  findings: EditorialDuplicateFinding[]
): boolean {
  if (!entry?.completedAt || typeof entry.reviewedTextFingerprint !== "string") return false;
  if (!editorialReviewChecks.every((check) => entry.checks[check.key] === true)) return false;
  if (findings.length > 0 && (
    entry.findingsReviewed !== true
    || entry.reviewedFindingsFingerprint !== editorialFindingsFingerprint(findings)
  )) return false;
  return entry.reviewedTextFingerprint === editorialTextFingerprint(buildDerivedDocumentText(data, key));
}

const workerRoleOptions = [
  "현장관리자",
  "관리감독자",
  "작업반장",
  "작업자",
  "신호수",
  "지게차 운전자",
  "화기감시자",
  "안전관리자"
] as const;

const workerLanguageOptions = [
  { nationality: "대한민국", languageCode: "ko", languageLabel: "한국어" },
  { nationality: "베트남", languageCode: "vi", languageLabel: "베트남어" },
  { nationality: "중국", languageCode: "zh", languageLabel: "중국어" },
  { nationality: "태국", languageCode: "th", languageLabel: "태국어" },
  { nationality: "우즈베키스탄", languageCode: "uz", languageLabel: "우즈베크어" },
  { nationality: "몽골", languageCode: "mn", languageLabel: "몽골어" },
  { nationality: "네팔", languageCode: "ne", languageLabel: "네팔어" },
  { nationality: "캄보디아", languageCode: "km", languageLabel: "크메르어" },
  { nationality: "인도네시아", languageCode: "id", languageLabel: "인도네시아어" },
  { nationality: "미얀마", languageCode: "my", languageLabel: "미얀마어" },
  { nationality: "필리핀", languageCode: "tl", languageLabel: "필리핀어" },
  { nationality: "기타", languageCode: "en", languageLabel: "영어" }
] as const;

const workerTrainingStatusOptions: WorkerTrainingStatus[] = ["이수", "당일 교육 예정", "확인 필요"];
const workerExperienceLevelOptions: WorkerExperienceLevel[] = ["숙련", "중간", "신규"];
const evidenceDocumentLabels: Record<string, string> = {
  riskAssessment: "위험성평가표",
  riskAssessmentDraft: "위험성평가표",
  tbmBriefing: "TBM 브리핑",
  tbmLog: "TBM 기록",
  tbmLogDraft: "TBM 기록",
  safetyEducation: "안전보건교육 기록",
  safetyEducationRecordDraft: "안전보건교육 기록",
  workPlan: "작업계획서",
  workPlanDraft: "작업계획서",
  emergencyResponse: "비상대응 절차",
  emergencyResponseDraft: "비상대응 절차",
  workpackSummary: "점검결과 요약",
  workpackSummaryDraft: "점검결과 요약",
  foreignWorkerBriefing: "외국인 브리핑",
  foreignWorkerTransmission: "외국인 전송본",
  managerTraining: "관리자 후속교육",
  chemical: "화학물질 교육"
};

function buildWorkerId() {
  return `worker-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function defaultWorkerDraft(): WorkerProfile {
  return {
    id: buildWorkerId(),
    displayName: "",
    role: "작업자",
    joinedAt: new Date().toISOString().slice(0, 10),
    experienceLevel: "중간",
    experienceSummary: "작업 전 TBM에서 역할과 위험요인을 확인합니다.",
    nationality: "대한민국",
    languageCode: "ko",
    languageLabel: "한국어",
    isNewWorker: false,
    isForeignWorker: false,
    trainingStatus: "당일 교육 예정",
    trainingSummary: "작업 전 교육 확인 필요",
    phone: "",
    email: ""
  };
}

function syncWorkerLanguage(worker: WorkerProfile, languageCode: string): WorkerProfile {
  const option = workerLanguageOptions.find((item) => item.languageCode === languageCode) || workerLanguageOptions[0];
  return {
    ...worker,
    nationality: option.nationality,
    languageCode: option.languageCode,
    languageLabel: option.languageLabel,
    isForeignWorker: option.languageCode !== "ko"
  };
}

function syncWorkerNationality(worker: WorkerProfile, nationality: string): WorkerProfile {
  const option = workerLanguageOptions.find((item) => item.nationality === nationality) || workerLanguageOptions[0];
  return syncWorkerLanguage(worker, option.languageCode);
}

function buildDraftLanguagePreview(worker: WorkerProfile, data: AskResponse) {
  if (worker.languageCode === "ko") {
    return {
      title: "한국어 교육 확인",
      lines: [
        `${worker.role || "작업자"}에게 작업 전 TBM과 안전교육 내용을 한국어로 확인합니다.`,
        "연락처가 있으면 메일·문자 전파에만 사용하고, 카카오·밴드는 승인 전까지 제외합니다."
      ]
    };
  }

  const language = data.deliverables.foreignWorkerLanguages.find((item) => item.code === worker.languageCode);
  return {
    title: `${worker.languageLabel} 전송 전 미리보기`,
    lines: language?.lines.length
      ? language.lines.slice(0, 3)
      : [
        `${worker.languageLabel} 전송본을 생성한 뒤 현장 통역 또는 해당 언어 가능자가 확인합니다.`,
        "작업, 핵심 위험, 중지 기준을 쉬운 문장으로 안내하고 이해 여부를 기록합니다."
      ]
  };
}

function buildWorkerSnapshot(workers: WorkerProfile[], previous?: CurrentWorkerSnapshot): CurrentWorkerSnapshot {
  const workerIds = workers.map((worker) => worker.id);
  const selectedWorkerIds = previous?.selectedWorkerIds.length
    ? previous.selectedWorkerIds.filter((id) => workerIds.includes(id))
    : workerIds;

  return {
    savedAt: new Date().toISOString(),
    source: "workspace",
    workers,
    selectedWorkerIds: selectedWorkerIds.length ? selectedWorkerIds : workerIds
  };
}

function buildDispatchSnapshot(workers: WorkerProfile[]): CurrentDispatchSnapshot | undefined {
  const recipientSuggestions = buildRecipientSuggestions(workers);
  const targetWorkers = buildWorkerDispatchTargets(workers);
  if (!recipientSuggestions.length && !targetWorkers.length) return undefined;
  return {
    savedAt: new Date().toISOString(),
    source: "workspace",
    recipientSuggestions,
    targetWorkers
  };
}

function readResponseMessage(payload: unknown, fallback: string) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return fallback;
  const record = payload as Record<string, unknown>;
  return typeof record.message === "string" ? record.message : fallback;
}

function readBlockers(payload: unknown) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return [];
  const record = payload as Record<string, unknown>;
  return Array.isArray(record.blockers) ? record.blockers.filter((item): item is string => typeof item === "string") : [];
}

function readReopenData(payload: unknown): AskResponse | null {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return null;
  const record = payload as Record<string, unknown>;
  if (!record.canReopen || !record.workpack || typeof record.workpack !== "object" || Array.isArray(record.workpack)) return null;
  const workpack = record.workpack as Record<string, unknown>;
  const reopenData = workpack.reopenData;
  if (!reopenData || typeof reopenData !== "object" || Array.isArray(reopenData)) return null;
  const candidate = reopenData as Record<string, unknown>;
  if (
    typeof candidate.question !== "string" ||
    !candidate.scenario ||
    typeof candidate.scenario !== "object" ||
    Array.isArray(candidate.scenario) ||
    !candidate.deliverables ||
    typeof candidate.deliverables !== "object" ||
    Array.isArray(candidate.deliverables) ||
    !candidate.externalData ||
    typeof candidate.externalData !== "object" ||
    Array.isArray(candidate.externalData) ||
    !candidate.riskSummary ||
    typeof candidate.riskSummary !== "object" ||
    Array.isArray(candidate.riskSummary)
  ) {
    return null;
  }
  return candidate as AskResponse;
}

function createBrowserSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return null;
  return createClient(url, anonKey);
}

function readArchiveWorkpacks(value: unknown): ArchiveWorkpack[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item): ArchiveWorkpack[] => {
    if (!item || typeof item !== "object" || Array.isArray(item)) return [];
    const record = item as Record<string, unknown>;
    const id = typeof record.id === "string" ? record.id : "";
    const siteName = typeof record.siteName === "string" ? record.siteName : "기본 현장";
    const question = typeof record.question === "string" ? record.question : "";
    const createdAt = typeof record.createdAt === "string" ? record.createdAt : "";
    if (!id || !createdAt) return [];
    return [{
      id,
      organizationName: typeof record.organizationName === "string" ? record.organizationName : "SafeClaw Pilot",
      siteName,
      industry: typeof record.industry === "string" ? record.industry : null,
      region: typeof record.region === "string" ? record.region : null,
      question,
      createdAt,
      updatedAt: typeof record.updatedAt === "string" ? record.updatedAt : createdAt,
      reopenHref: typeof record.reopenHref === "string" ? record.reopenHref : `/documents?workpackId=${encodeURIComponent(id)}`
    }];
  });
}

function readArchiveDispatchLogs(value: unknown): ArchiveDispatchLog[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item): ArchiveDispatchLog[] => {
    if (!item || typeof item !== "object" || Array.isArray(item)) return [];
    const record = item as Record<string, unknown>;
    const id = typeof record.id === "string" ? record.id : "";
    const channel = typeof record.channel === "string" ? record.channel : "";
    const createdAt = typeof record.createdAt === "string" ? record.createdAt : "";
    if (!id || !channel || !createdAt) return [];
    return [{
      id,
      siteName: typeof record.siteName === "string" ? record.siteName : "기본 현장",
      channel,
      targetLabel: typeof record.targetLabel === "string" ? record.targetLabel : null,
      languageCode: typeof record.languageCode === "string" ? record.languageCode : null,
      provider: typeof record.provider === "string" ? record.provider : null,
      providerStatus: typeof record.providerStatus === "string" ? record.providerStatus : null,
      workflowRunId: typeof record.workflowRunId === "string" ? record.workflowRunId : null,
      failureReason: typeof record.failureReason === "string" ? record.failureReason : null,
      createdAt
    }];
  });
}

async function readSession(): Promise<Session | null> {
  const client = createBrowserSupabaseClient();
  if (!client) return null;
  const { data, error } = await client.auth.getSession();
  if (error) {
    console.error("archive session read failed", error);
    return null;
  }
  return data.session;
}

function useCurrentWorkpack(sample: AskResponse): CurrentWorkpackState {
  const [state, setState] = useState<CurrentWorkpackSnapshot>({
    data: sample,
    isCurrent: false,
    savedAt: null,
    generationFingerprint: buildWorkpackGenerationFingerprint(sample)
  });
  const [reopenMessage, setReopenMessage] = useState<string | null>(null);
  const [reopenStatus, setReopenStatus] = useState<"idle" | "loading" | "ready" | "blocked">("idle");

  useEffect(() => {
    const stored = parseStoredCurrentWorkpack(window.localStorage.getItem(CURRENT_WORKPACK_STORAGE_KEY));
    if (stored) {
      setState({
        data: stored.data,
        isCurrent: true,
        savedAt: stored.savedAt,
        generationFingerprint: stored.generationFingerprint,
        workerSnapshot: stored.workerSnapshot,
        dispatchSnapshot: stored.dispatchSnapshot
      });
    }

    const workpackId = new URLSearchParams(window.location.search).get("workpackId");
    if (!workpackId) return;
    const requestedWorkpackId = workpackId;
    setReopenStatus("loading");
    setReopenMessage("서버 아카이브에서 저장 문서팩 상세를 확인하고 있습니다. 복원 가능한 데이터가 있으면 현재 문서 화면에 바로 반영합니다.");

    let cancelled = false;
    async function reopenServerWorkpack() {
      const session = await readSession();
      if (!session) {
        if (!cancelled) {
          setReopenStatus("blocked");
          setReopenMessage("관리자 로그인 세션이 없어 이 서버 문서팩을 열 수 없습니다. 지금은 브라우저 최근 작업을 표시합니다. 관리자 로그인 후 아카이브에서 다시 열어 주세요.");
        }
        return;
      }

      try {
        const response = await fetch(`/api/workpacks/${encodeURIComponent(requestedWorkpackId)}`, {
          headers: { authorization: `Bearer ${session.access_token}` }
        });
        const payload: unknown = await response.json().catch((): unknown => ({}));
        const reopenData = response.ok ? readReopenData(payload) : null;
        if (!reopenData) {
          const blockers = readBlockers(payload);
          if (!cancelled) {
            setReopenStatus("blocked");
            setReopenMessage(blockers.length
              ? `저장 문서팩 상세는 조회됐지만 문서 화면 복원에 필요한 데이터가 부족합니다: ${blockers.join(" / ")}. 브라우저 최근 작업을 대신 표시합니다.`
              : `${readResponseMessage(payload, "저장 문서팩을 다시 열지 못했습니다.")} 브라우저 최근 작업을 대신 표시합니다.`);
          }
          return;
        }

        const nextStored = buildStoredCurrentWorkpack(reopenData);
        window.localStorage.setItem(CURRENT_WORKPACK_STORAGE_KEY, JSON.stringify(nextStored));
        if (!cancelled) {
          setState({
            data: reopenData,
            isCurrent: true,
            savedAt: nextStored.savedAt,
            generationFingerprint: nextStored.generationFingerprint
          });
          setReopenStatus("ready");
          setReopenMessage("서버 아카이브의 저장 문서팩을 현재 문서 화면으로 복원했습니다. 문서와 근거 요약은 현재 작업으로 저장됐고, 작업자·전파 저장본은 저장된 항목이 있을 때만 별도 화면에서 이어집니다.");
        }
      } catch (error) {
        console.error("server workpack reopen failed", error);
        if (!cancelled) {
          setReopenStatus("blocked");
          setReopenMessage("저장 문서팩 상세 조회 중 오류가 발생했습니다. 브라우저 최근 작업을 표시합니다. 아카이브에서 새로고침 후 다시 시도해 주세요.");
        }
      }
    }

    void reopenServerWorkpack();
    return () => {
      cancelled = true;
    };
  }, []);

  const updateData = useCallback((nextData: AskResponse) => {
    setState((current) => ({
      ...current,
      data: nextData,
      savedAt: current.isCurrent ? new Date().toISOString() : current.savedAt
    }));
  }, []);

  const updateWorkerSnapshot = useCallback((workerSnapshot: CurrentWorkerSnapshot) => {
    setState((current) => {
      const nextState: CurrentWorkpackSnapshot = {
        ...current,
        isCurrent: true,
        savedAt: new Date().toISOString(),
        workerSnapshot
      };
      window.localStorage.setItem(
        CURRENT_WORKPACK_STORAGE_KEY,
        JSON.stringify(buildStoredCurrentWorkpack(nextState.data, {
          generationFingerprint: nextState.generationFingerprint,
          workerSnapshot,
          dispatchSnapshot: nextState.dispatchSnapshot
        }))
      );
      return nextState;
    });
  }, []);

  const updateDispatchSnapshot = useCallback((dispatchSnapshot: CurrentDispatchSnapshot | undefined) => {
    setState((current) => {
      const nextState: CurrentWorkpackSnapshot = {
        ...current,
        isCurrent: true,
        savedAt: new Date().toISOString(),
        dispatchSnapshot
      };
      window.localStorage.setItem(
        CURRENT_WORKPACK_STORAGE_KEY,
        JSON.stringify(buildStoredCurrentWorkpack(nextState.data, {
          generationFingerprint: nextState.generationFingerprint,
          workerSnapshot: nextState.workerSnapshot,
          dispatchSnapshot
        }))
      );
      return nextState;
    });
  }, []);

  return { ...state, reopenMessage, reopenStatus, updateData, updateWorkerSnapshot, updateDispatchSnapshot };
}

function isPlaceholderRecipient(value: string) {
  const normalized = value.trim().toLowerCase();
  const digits = normalized.replace(/[^0-9]/g, "");
  return normalized.endsWith("@safeguard.local") || /^0100+0[0-9]$/.test(digits) || /^0100000000[0-9]$/.test(digits);
}

function filterRealRecipientSuggestions(recipients: RecipientSuggestion[]) {
  return recipients.filter((recipient) => !isPlaceholderRecipient(recipient.value));
}

function filterRealDispatchTargets(targets: WorkerDispatchTarget[]) {
  return targets.filter((target) => Boolean(target.phoneMasked || target.emailMasked));
}

function selectedWorkerSnapshotWorkers(snapshot: CurrentWorkerSnapshot | undefined) {
  if (!snapshot) return [];
  if (!snapshot.selectedWorkerIds.length) return snapshot.workers;
  const selected = snapshot.workers.filter((worker) => snapshot.selectedWorkerIds.includes(worker.id));
  return selected.length ? selected : snapshot.workers;
}

function currentRouteWorkers(current: CurrentWorkpackState): WorkerProfile[] {
  const snapshotWorkers = selectedWorkerSnapshotWorkers(current.workerSnapshot);
  return snapshotWorkers.length ? snapshotWorkers : buildDefaultWorkers(current.data);
}

function formatSavedAt(savedAt: string | null) {
  if (!savedAt) return "";
  const date = new Date(savedAt);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("ko-KR", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
}

function CurrentWorkpackBanner({ isCurrent, savedAt }: { isCurrent: boolean; savedAt: string | null }) {
  return (
    <section className={`safeclaw-current-workpack ${isCurrent ? "live" : "sample"}`} aria-live="polite">
      <span>{isCurrent ? "현재 작업 연결" : "기본 예시 표시"}</span>
      <strong>
        {isCurrent
          ? `작업공간에서 생성한 최신 문서팩을 사용합니다${formatSavedAt(savedAt) ? ` · ${formatSavedAt(savedAt)}` : ""}.`
          : "아직 생성된 문서팩이 없어 기본 예시 데이터로 화면을 보여줍니다. 실제 저장·전파는 작업 입력 후 진행합니다."}
      </strong>
    </section>
  );
}

function excerpt(text: string, maxLength = 190) {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, maxLength).trim()}...`;
}

function buildDerivedDocumentText(data: AskResponse, key: DocumentKey) {
  const storedDraft = data.deliverables[key];
  if (typeof storedDraft === "string" && storedDraft.trim()) return storedDraft;

  return "생성 누락 · 재생성 필요";
}

function documentPresenceLabel(data: AskResponse, key: DocumentKey): {
  status: DeliverablePresenceStatus;
  label: string;
} {
  const presence = classifyDeliverablePresence(data.deliverables[key]);
  if (presence.status === "explicitNotApplicable") {
    return {
      status: presence.status,
      label: `해당 없음 · ${excerpt(presence.reason, 34)}`
    };
  }
  if (presence.status === "missingUnexpected") {
    return {
      status: presence.status,
      label: "생성 누락 · 재생성 필요"
    };
  }
  return {
    status: presence.status,
    label: ""
  };
}

function buildDeliverablePatch(values: WorkpackDocumentValues) {
  const patch: Partial<AskResponse["deliverables"]> = {};
  (Object.keys(values) as DocumentKey[]).forEach((key) => {
    patch[key] = values[key];
  });
  return patch;
}

function countLaunchDocuments(data: AskResponse) {
  return launchDocuments.filter((item) => {
    const documentText = data.deliverables[item.key];
    return typeof documentText === "string" && Boolean(documentText.trim());
  }).length;
}

function countEvidence(data: AskResponse) {
  const kosha = data.externalData.kosha.references.length;
  const accident = data.externalData.accidentCases.cases.length;
  const openApi = data.externalData.koshaOpenApi?.references.length || 0;
  const knowledge = data.externalData.safetyKnowledge?.matches.length || 0;
  return data.citations.length + kosha + accident + openApi + knowledge;
}

function mapDocumentLabels(values: string[], fallback: string[]): string[] {
  const labels = values.map((value) => evidenceDocumentLabels[value] || value).filter((value) => value.trim());
  const selected = labels.length ? labels : fallback;
  return Array.from(new Set(selected));
}

function buildReflectionLabel(documents: string[], summary: string) {
  const documentLabel = documents.slice(0, 3).join(" · ") || "문서 보완 후보";
  return `${documentLabel}에 ${excerpt(summary, 56)}`;
}

function normalizeEvidenceSummary(summary: string) {
  return excerpt(summary, 110);
}

function buildEvidenceCards(data: AskResponse): EvidenceCard[] {
  const weatherCard: EvidenceCard = {
    id: "weather-current",
    title: `${data.externalData.weather.locationLabel} 기상 위험`,
    summary: data.externalData.weather.summary,
    sourceLabel: "기상청",
    role: "supporting",
    roleLabel: "현장 조건 보조 근거",
    reflectedDocuments: ["위험성평가표", "작업계획서", "TBM 브리핑"],
    reflectionLabel: "위험성평가표 · 작업계획서 · TBM 브리핑에 작업중지/보호구 확인 기준으로 반영",
    href: "/weather"
  };
  const trainingCards: EvidenceCard[] = [
    ...data.externalData.training.recommendations.map((item, index) => ({
      id: `work24-training-${index}`,
      title: item.title,
      summary: item.fitReason || item.reason,
      sourceLabel: item.institution,
      role: "supporting" as const,
      roleLabel: "교육 편성 보조 근거",
      reflectedDocuments: ["안전보건교육 기록", "외국인 브리핑"],
      reflectionLabel: "안전보건교육 기록 · 외국인 브리핑에 교육 주제와 이해 확인으로 반영",
      href: item.url
    })),
    ...data.externalData.koshaEducation.recommendations.map((item, index) => ({
      id: `kosha-education-${index}`,
      title: item.title,
      summary: item.fitReason || item.reason,
      sourceLabel: item.provider,
      role: "supporting" as const,
      roleLabel: "후속교육 보조 근거",
      reflectedDocuments: ["안전보건교육 기록", "관리자 후속교육"],
      reflectionLabel: "안전보건교육 기록 · 관리자 후속교육에 교육 주제와 확인 질문으로 반영",
      href: item.url
    }))
  ];
  const koshaCards = data.externalData.kosha.references.map((item, index): EvidenceCard => {
    const summary = item.impact || item.summary;
    const reflectedDocuments = mapDocumentLabels(item.appliedTo || item.appliesTo || item.templateHints || [], ["위험성평가표", "TBM 브리핑"]);
    return {
      id: `kosha-reference-${index}`,
      title: item.title,
      summary,
      sourceLabel: item.agency || "KOSHA",
      role: "direct",
      roleLabel: "문서 문구 직접 근거",
      reflectedDocuments,
      reflectionLabel: buildReflectionLabel(reflectedDocuments, summary),
      href: item.url
    };
  });
  const openApiCards = (data.externalData.koshaOpenApi?.references || []).map((item, index): EvidenceCard => {
    const role = item.service === "건설업 일별 중대재해" ? "supporting" : "direct";
    const reflectedDocuments = mapDocumentLabels(item.reflectedIn, ["위험성평가표", "작업계획서"]);
    return {
      id: `kosha-openapi-${index}`,
      title: item.title,
      summary: item.summary,
      sourceLabel: item.service,
      role,
      roleLabel: role === "direct" ? "공공 API 직접 근거" : "사례 기반 보조 근거",
      reflectedDocuments,
      reflectionLabel: buildReflectionLabel(reflectedDocuments, item.summary),
      href: item.url
    };
  });
  const accidentCards = data.externalData.accidentCases.cases.map((item, index): EvidenceCard => ({
    id: `accident-case-${index}`,
    title: item.title,
    summary: item.preventionPoint,
    sourceLabel: item.sourceType === "fatal-accident" ? "중대재해 사례" : "재해사례",
    role: "supporting",
    roleLabel: "사례 기반 보조 근거",
    reflectedDocuments: ["위험성평가표", "TBM 브리핑", "비상대응 절차"],
    reflectionLabel: "위험성평가표 · TBM 브리핑 · 비상대응 절차에 유사사고 예방 포인트로 반영",
    href: item.sourceUrl || "/knowledge"
  }));
  const knowledgeCards = (data.externalData.safetyKnowledge?.matches || []).map((item): EvidenceCard => ({
    id: `knowledge-${item.id}`,
    title: item.title,
    summary: item.shortSummary || item.controls.slice(0, 2).join(" / ") || item.sourceTitles.join(" / "),
    sourceLabel: "안전 지식 DB",
    role: item.evidenceRole || "direct",
    roleLabel: item.roleLabel || "내장 지식 직접 근거",
    reflectedDocuments: mapDocumentLabels(item.primaryDocuments, ["위험성평가표", "TBM 브리핑"]),
    reflectionLabel: item.documentReflectionLabel || buildReflectionLabel(mapDocumentLabels(item.primaryDocuments, ["위험성평가표", "TBM 브리핑"]), item.controls[0] || item.title),
    href: "/knowledge"
  }));

  return [weatherCard, ...koshaCards, ...openApiCards, ...accidentCards, ...trainingCards, ...knowledgeCards];
}

function EvidenceCardList({ title, cards }: { title: string; cards: EvidenceCard[] }) {
  const visibleCards = cards.slice(0, 6);
  const hiddenCount = cards.length - visibleCards.length;

  return (
    <section className="safeclaw-evidence-group">
      <div className="compact-head">
        <span>{title}</span>
        <strong>{cards.length}건</strong>
      </div>
      <div className="safeclaw-module-list">
        {visibleCards.map((item) => (
          <a key={item.id} href={item.href} target={item.href.startsWith("/") ? undefined : "_blank"} rel={item.href.startsWith("/") ? undefined : "noreferrer"}>
            <div className="row">
              <span className="badge">{item.roleLabel}</span>
              <span className="badge">{item.sourceLabel}</span>
            </div>
            <strong>{item.title}</strong>
            <small>{normalizeEvidenceSummary(item.summary)}</small>
            <small>반영 라벨: {item.reflectionLabel}</small>
          </a>
        ))}
      </div>
      {hiddenCount > 0 ? (
        <p className="muted small">
          추가 근거 {hiddenCount.toLocaleString("ko-KR")}건은 문서 본문에 붙이지 않고, 필요 시 지식 DB 검색에서 세부 확인합니다.
        </p>
      ) : null}
    </section>
  );
}

function DocumentCockpit({
  data,
  selectedDocumentKey,
  onSelectDocument,
  reviewedDocumentCount,
  onOpenEditorialReview
}: {
  data: AskResponse;
  selectedDocumentKey?: DocumentKey;
  onSelectDocument: (key: DocumentKey) => void;
  reviewedDocumentCount: number;
  onOpenEditorialReview: () => void;
}) {
  const primaryDocuments = launchDocuments.filter((item) => item.tier === "핵심");
  const remainingDocuments = launchDocuments.filter((item) => item.tier !== "핵심");
  const readyDocumentCount = countLaunchDocuments(data);
  const remainingDetailsRef = useRef<HTMLDetailsElement>(null);

  return (
    <section className="safeclaw-document-cockpit" aria-label="문서팩 운영 요약">
      <section className="safeclaw-mobile-document-priority" data-testid="mobile-core-document-launcher">
        <span>오늘 문서</span>
        <h2>핵심 3종</h2>
        <div className="safeclaw-mobile-core-list">
          {primaryDocuments.map((item) => {
            const presence = documentPresenceLabel(data, item.key);
            return (
              <button
                key={item.key}
                type="button"
                data-document-key={item.key}
                data-document-presence={presence.status}
                aria-label={item.title}
                aria-pressed={selectedDocumentKey === item.key}
                onClick={() => onSelectDocument(item.key)}
              >
                <strong>{item.title}</strong>
                {presence.label ? <small>{presence.label}</small> : null}
              </button>
            );
          })}
        </div>

        <details
          ref={remainingDetailsRef}
          className="safeclaw-mobile-document-details"
          data-testid="mobile-document-details"
        >
          <summary>지원 문서 {remainingDocuments.length}종 · 제출 정보</summary>
          <div className="safeclaw-mobile-remaining-list">
            {remainingDocuments.map((item) => {
              const presence = documentPresenceLabel(data, item.key);
              return (
                <button
                  key={item.key}
                  type="button"
                  data-document-key={item.key}
                  data-document-presence={presence.status}
                  aria-label={item.title}
                  aria-pressed={selectedDocumentKey === item.key}
                  onClick={() => {
                    onSelectDocument(item.key);
                    if (remainingDetailsRef.current) remainingDetailsRef.current.open = false;
                  }}
                >
                  <small>{item.tier} · {item.owner}</small>
                  <strong>{item.title}</strong>
                  {presence.label ? <small className="safeclaw-document-presence">{presence.label}</small> : null}
                </button>
              );
            })}
          </div>
          <div className="safeclaw-mobile-primary-preview" data-testid="mobile-primary-preview">
            {primaryDocuments.map((item) => (
              <div key={item.key}>
                <strong>{item.title}</strong>
                <p>{excerpt(buildDerivedDocumentText(data, item.key), 96)}</p>
              </div>
            ))}
          </div>
          <dl className="safeclaw-mobile-submission-facts" data-testid="mobile-submission-facts">
            <div>
              <dt>작성</dt>
              <dd>{readyDocumentCount}/{launchDocuments.length}종</dd>
            </div>
            <div>
              <dt>근거</dt>
              <dd>{countEvidence(data)}건</dd>
            </div>
            <div>
              <dt>출력</dt>
              <dd>PDF · XLS · HWPX</dd>
            </div>
          </dl>
          <div className="safeclaw-mobile-detail-actions">
            <a href="/evidence">문서 근거</a>
            <a href="/dispatch">현장 전파</a>
          </div>
        </details>
        <button
          type="button"
          className="safeclaw-document-review-launch"
          data-testid="document-editorial-review-launch"
          onClick={onOpenEditorialReview}
        >
          <span>문서 사람 검토</span>
          <strong>{reviewedDocumentCount}/{launchDocuments.length}</strong>
        </button>
      </section>

      <aside className="safeclaw-doc-index">
        <span>문서 인덱스</span>
        <h2>3종 핵심. 9종 추가.</h2>
        <div className="safeclaw-doc-index-list">
          {launchDocuments.map((item, index) => (
            <button key={item.key} type="button" data-document-key={item.key} onClick={() => onSelectDocument(item.key)}>
              <small>{String(index + 1).padStart(2, "0")} · {item.tier}</small>
              <strong>{item.title}</strong>
              <em>{item.owner}</em>
            </button>
          ))}
        </div>
      </aside>

      <article className="safeclaw-doc-primary">
        <span>오늘 먼저 볼 문서</span>
        <h2>{data.scenario.siteName}</h2>
        <p>{data.scenario.workSummary}</p>
        <div className="safeclaw-doc-primary-grid">
          {primaryDocuments.map((item) => (
            <section key={item.key}>
              <small>{item.owner}</small>
              <strong>{item.title}</strong>
              <p>{excerpt(buildDerivedDocumentText(data, item.key))}</p>
            </section>
          ))}
        </div>
      </article>

      <aside className="safeclaw-doc-export">
        <span>제출 준비</span>
        <h2>{readyDocumentCount}/{launchDocuments.length}종 작성.</h2>
        <dl>
          <div>
            <dt>위험도</dt>
            <dd>{data.riskSummary.riskLevel}</dd>
          </div>
          <div>
            <dt>근거 연결</dt>
            <dd>{countEvidence(data)}건</dd>
          </div>
          <div>
            <dt>정식 출력</dt>
            <dd>PDF · XLS · HWPX</dd>
          </div>
        </dl>
        <a href="/evidence">문서 반영 근거 확인</a>
        <a href="/dispatch">메일·문자 전파로 이동</a>
      </aside>
    </section>
  );
}

function DocumentEditorialReviewDialog({
  data,
  generationFingerprint,
  open,
  selectedDocumentKey,
  onClose,
  onEditDocument,
  onReviewedDocumentCountChange
}: {
  data: AskResponse;
  generationFingerprint: string;
  open: boolean;
  selectedDocumentKey: DocumentKey;
  onClose: () => void;
  onEditDocument: (key: DocumentKey) => void;
  onReviewedDocumentCountChange: (count: number) => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const storageKey = `safeclaw.documentEditorialReview.v1:${generationFingerprint}`;
  const reviewerStorageKey = `safeclaw.documentEditorialReviewReviewer.v1:${generationFingerprint}`;
  const [activeDocumentKey, setActiveDocumentKey] = useState<DocumentKey>(selectedDocumentKey);
  const [reviewState, setReviewState] = useState<EditorialReviewState>({});
  const [reviewer, setReviewer] = useState("");
  const [loadedStorageKey, setLoadedStorageKey] = useState<string | null>(null);
  const editorialFindings = useMemo(() => buildEditorialDuplicateFindings(data), [data]);
  const findingsByDocument = useMemo(() => Object.fromEntries(launchDocuments.map((document) => [
    document.key,
    editorialFindings.filter((finding) => finding.documentKeys.includes(document.key))
  ])) as Record<DocumentKey, EditorialDuplicateFinding[]>, [editorialFindings]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      setReviewState(parseEditorialReviewState(window.localStorage.getItem(storageKey)));
    } catch (error) {
      console.warn("document editorial review state load failed", error);
      setReviewState({});
    }
    setLoadedStorageKey(storageKey);
  }, [storageKey]);

  useEffect(() => {
    if (typeof window === "undefined" || loadedStorageKey !== storageKey) return;
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(reviewState));
    } catch (error) {
      console.warn("document editorial review state save failed", error);
    }
  }, [loadedStorageKey, reviewState, storageKey]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      setReviewer((window.localStorage.getItem(reviewerStorageKey) || "").slice(0, 120));
    } catch (error) {
      console.warn("document editorial reviewer load failed", error);
      setReviewer("");
    }
  }, [reviewerStorageKey]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(reviewerStorageKey, reviewer);
    } catch (error) {
      console.warn("document editorial reviewer save failed", error);
    }
  }, [reviewer, reviewerStorageKey]);

  useEffect(() => {
    const reviewedCount = launchDocuments.filter((document) => (
      editorialReviewIsCurrent(data, document.key, reviewState[document.key], findingsByDocument[document.key])
    )).length;
    onReviewedDocumentCountChange(reviewedCount);
  }, [data, findingsByDocument, onReviewedDocumentCountChange, reviewState]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open) {
      setActiveDocumentKey(selectedDocumentKey);
      if (!dialog.open) {
        dialog.showModal();
        window.requestAnimationFrame(() => {
          dialog.querySelector<HTMLButtonElement>(".safeclaw-document-review-close")?.focus();
        });
      }
      return;
    }
    if (dialog.open) dialog.close();
  }, [open, selectedDocumentKey]);

  const activeDocument = launchDocuments.find((document) => document.key === activeDocumentKey) || launchDocuments[0];
  const activeDocumentIndex = launchDocuments.findIndex((document) => document.key === activeDocument.key);
  const activeEntry = reviewState[activeDocument.key] || emptyEditorialReviewEntry();
  const activeFindings = findingsByDocument[activeDocument.key];
  const activeFindingsFingerprint = editorialFindingsFingerprint(activeFindings);
  const activeFindingsReviewed = activeFindings.length === 0 || (
    activeEntry.findingsReviewed === true
    && activeEntry.reviewedFindingsFingerprint === activeFindingsFingerprint
  );
  const presence = documentPresenceLabel(data, activeDocument.key);
  const checksComplete = editorialReviewChecks.every((check) => activeEntry.checks[check.key] === true);
  const canComplete = checksComplete && activeFindingsReviewed && presence.status !== "missingUnexpected";
  const activeReviewIsCurrent = editorialReviewIsCurrent(data, activeDocument.key, activeEntry, activeFindings);
  const activeReviewIsStale = Boolean(activeEntry.completedAt) && !activeReviewIsCurrent;
  const completedDocumentCount = launchDocuments.filter((document) => (
    editorialReviewIsCurrent(data, document.key, reviewState[document.key], findingsByDocument[document.key])
  )).length;
  const receiptReady = completedDocumentCount === launchDocuments.length && reviewer.trim().length > 0;

  function updateEntry(updater: (entry: EditorialReviewEntry) => EditorialReviewEntry) {
    setReviewState((current) => ({
      ...current,
      [activeDocument.key]: updater(current[activeDocument.key] || emptyEditorialReviewEntry())
    }));
  }

  function toggleCheck(checkKey: EditorialReviewCheckKey) {
    updateEntry((entry) => {
      const checks = { ...entry.checks, [checkKey]: entry.checks[checkKey] !== true };
      return {
        ...entry,
        checks,
        completedAt: editorialReviewChecks.every((check) => checks[check.key] === true)
          ? entry.completedAt
          : null,
        reviewedTextFingerprint: editorialReviewChecks.every((check) => checks[check.key] === true)
          ? entry.reviewedTextFingerprint
          : null
      };
    });
  }

  function toggleFindingsReviewed() {
    updateEntry((entry) => {
      const findingsReviewed = !(
        entry.findingsReviewed === true
        && entry.reviewedFindingsFingerprint === activeFindingsFingerprint
      );
      return {
        ...entry,
        findingsReviewed,
        reviewedFindingsFingerprint: findingsReviewed ? activeFindingsFingerprint : null,
        completedAt: findingsReviewed ? entry.completedAt : null,
        reviewedTextFingerprint: findingsReviewed ? entry.reviewedTextFingerprint : null
      };
    });
  }

  function toggleComplete() {
    if (!activeReviewIsCurrent && !canComplete) return;
    updateEntry((entry) => ({
      ...entry,
      completedAt: activeReviewIsCurrent ? null : new Date().toISOString(),
      reviewedTextFingerprint: activeReviewIsCurrent
        ? null
        : editorialTextFingerprint(buildDerivedDocumentText(data, activeDocument.key))
    }));
  }

  function downloadReviewReceipt() {
    if (!receiptReady || typeof window === "undefined") return;

    const documents = launchDocuments.map<EditorialReviewReceiptDocument>((document) => {
      const entry = reviewState[document.key];
      const currentTextFingerprint = editorialTextFingerprint(buildDerivedDocumentText(data, document.key));
      const documentFindings = findingsByDocument[document.key];
      const currentFindingsFingerprint = editorialFindingsFingerprint(documentFindings);
      if (!entry?.completedAt || entry.reviewedTextFingerprint !== currentTextFingerprint) {
        throw new Error(`document-editorial-review-receipt-stale:${document.key}`);
      }
      if (documentFindings.length > 0 && (
        entry.findingsReviewed !== true
        || entry.reviewedFindingsFingerprint !== currentFindingsFingerprint
      )) {
        throw new Error(`document-editorial-review-receipt-findings-unreviewed:${document.key}`);
      }

      const checks = Object.fromEntries(editorialReviewChecks.map((check) => {
        if (entry.checks[check.key] !== true) {
          throw new Error(`document-editorial-review-receipt-incomplete:${document.key}:${check.key}`);
        }
        return [check.key, true] as const;
      })) as Record<EditorialReviewCheckKey, true>;

      return {
        key: document.key,
        title: document.title,
        tier: document.tier,
        owner: document.owner,
        completedAt: entry.completedAt,
        reviewedTextFingerprint: entry.reviewedTextFingerprint,
        currentTextFingerprint,
        findingsReviewed: true,
        editorialFindingsFingerprint: currentFindingsFingerprint,
        editorialFindingIds: documentFindings.map((finding) => finding.id),
        editorialFindingCounts: editorialFindingCounts(documentFindings),
        checks,
        note: entry.note
      };
    });
    const reviewedAt = documents.reduce((latest, document) => (
      document.completedAt > latest ? document.completedAt : latest
    ), documents[0]?.completedAt || new Date().toISOString());
    const receipt = {
      schemaVersion: "safeclaw-document-editorial-review-receipt/v2",
      exportedAt: new Date().toISOString(),
      reviewer: reviewer.trim(),
      reviewedAt,
      generationFingerprint,
      canonicalDocumentCount: launchDocuments.length,
      reviewerCheckCount: editorialReviewChecks.length,
      editorialFindingsFingerprint: editorialFindingsFingerprint(editorialFindings),
      editorialFindingCount: editorialFindings.length,
      editorialFindingIds: editorialFindings.map((finding) => finding.id),
      editorialFindingCounts: editorialFindingCounts(editorialFindings),
      reviewCompletion: {
        localChecklistCompleted: true,
        editorialFindingsReviewed: true,
        reviewerSelfAttested: true,
        reviewerIdentityVerified: false,
        serverRecorded: false,
        approvalGranted: false
      },
      documents,
      mutationBoundary: {
        dbMutationPerformed: false,
        providerDispatchCalled: false,
        shareSessionCreated: false,
        vectorRuntimeCalled: false,
        wikiPublished: false,
        koshaRegistryMutationPerformed: false,
        exactSavedShareVerdict: "MISSING_EVIDENCE"
      }
    };
    const blob = new Blob([`${JSON.stringify(receipt, null, 2)}\n`], { type: "application/json;charset=utf-8" });
    const url = window.URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    const filenameFingerprint = generationFingerprint.replace(/[^a-zA-Z0-9_-]/gu, "-").slice(0, 24);
    anchor.href = url;
    anchor.download = `safeclaw-document-review-${filenameFingerprint || "receipt"}.json`;
    try {
      document.body.appendChild(anchor);
      anchor.click();
    } finally {
      anchor.remove();
      window.URL.revokeObjectURL(url);
    }
  }

  function moveDocumentFocus(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    let nextIndex = index;
    if (event.key === "ArrowDown" || event.key === "ArrowRight") {
      nextIndex = (index + 1) % launchDocuments.length;
    } else if (event.key === "ArrowUp" || event.key === "ArrowLeft") {
      nextIndex = (index - 1 + launchDocuments.length) % launchDocuments.length;
    } else if (event.key === "Home") {
      nextIndex = 0;
    } else if (event.key === "End") {
      nextIndex = launchDocuments.length - 1;
    } else {
      return;
    }
    event.preventDefault();
    const nextDocument = launchDocuments[nextIndex];
    setActiveDocumentKey(nextDocument.key);
    dialogRef.current
      ?.querySelector<HTMLButtonElement>(`[data-review-document-key="${nextDocument.key}"]`)
      ?.focus();
  }

  function moveMobileDocument(offset: -1 | 1) {
    const nextIndex = (activeDocumentIndex + offset + launchDocuments.length) % launchDocuments.length;
    setActiveDocumentKey(launchDocuments[nextIndex].key);
  }

  return (
    <dialog
      ref={dialogRef}
      className="safeclaw-document-review-dialog"
      data-testid="document-editorial-review-dialog"
      aria-labelledby="document-editorial-review-title"
      aria-describedby="document-editorial-review-description"
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClose={onClose}
    >
      <header className="safeclaw-document-review-header">
        <div>
          <span>12종 문서 · 사람 검토</span>
          <h2 id="document-editorial-review-title">문서별 최종 문구 확인</h2>
          <p id="document-editorial-review-description">자동 검사는 준비 상태를 보조합니다. 최종 완료는 사람이 각 문서를 읽고 직접 표시합니다.</p>
        </div>
        <div className="safeclaw-document-review-progress" aria-live="polite" aria-label={`사람 검토 ${completedDocumentCount}/${launchDocuments.length}종 완료`}>
          <strong>{completedDocumentCount}/{launchDocuments.length}</strong>
          <span>이 브라우저에 저장</span>
        </div>
        <button type="button" className="safeclaw-document-review-close" aria-label="문서 사람 검토 닫기" onClick={onClose}>×</button>
      </header>

      <div className="safeclaw-document-review-workbench">
        <div className="safeclaw-document-review-mobile-nav" data-testid="document-review-mobile-nav">
          <button type="button" aria-label="이전 검토 문서" title="이전 검토 문서" onClick={() => moveMobileDocument(-1)}>←</button>
          <label>
            <span>검토 문서</span>
            <select
              aria-label="검토 문서 선택"
              value={activeDocument.key}
              onChange={(event) => setActiveDocumentKey(event.target.value as DocumentKey)}
            >
              {launchDocuments.map((document, index) => (
                <option key={document.key} value={document.key}>
                  {String(index + 1).padStart(2, "0")}/{launchDocuments.length} · {document.title} · {document.tier}
                </option>
              ))}
            </select>
          </label>
          <button type="button" aria-label="다음 검토 문서" title="다음 검토 문서" onClick={() => moveMobileDocument(1)}>→</button>
        </div>
        <nav className="safeclaw-document-review-nav" role="tablist" aria-label="검토 문서 선택" aria-orientation="vertical">
          {launchDocuments.map((document, index) => {
            const entry = reviewState[document.key];
            const complete = editorialReviewIsCurrent(data, document.key, entry, findingsByDocument[document.key]);
            const stale = Boolean(entry?.completedAt) && !complete;
            const documentPresence = documentPresenceLabel(data, document.key);
            return (
              <button
                key={document.key}
                type="button"
                id={`document-editorial-review-tab-${document.key}`}
                role="tab"
                data-review-document-key={document.key}
                aria-selected={activeDocument.key === document.key}
                aria-controls="document-editorial-review-panel"
                tabIndex={activeDocument.key === document.key ? 0 : -1}
                onClick={() => setActiveDocumentKey(document.key)}
                onKeyDown={(event) => moveDocumentFocus(event, index)}
              >
                <small>{String(index + 1).padStart(2, "0")} · {document.tier}</small>
                <strong>{document.title}</strong>
                <span className={complete ? "complete" : documentPresence.status === "missingUnexpected" ? "missing" : "pending"}>
                  {complete ? "검토 완료" : documentPresence.status === "missingUnexpected" ? "생성 누락" : stale ? "검토 갱신 필요" : "검토 대기"}
                </span>
              </button>
            );
          })}
        </nav>

        <section
          id="document-editorial-review-panel"
          className="safeclaw-document-review-copy"
          role="tabpanel"
          aria-labelledby={`document-editorial-review-tab-${activeDocument.key}`}
          tabIndex={0}
        >
          <header>
            <div>
              <span>{activeDocument.tier} · {activeDocument.owner}</span>
              <h3>{activeDocument.title}</h3>
            </div>
            {presence.label ? <strong data-presence={presence.status}>{presence.label}</strong> : <strong data-presence="presentNonEmpty">작성됨</strong>}
          </header>
          <pre data-testid="document-editorial-review-copy">{buildDerivedDocumentText(data, activeDocument.key)}</pre>
        </section>

        <aside className="safeclaw-document-review-checklist" aria-label={`${activeDocument.title} 사람 검토 항목`}>
          <header>
            <span>사람 검토 항목</span>
            <strong>{editorialReviewChecks.filter((check) => activeEntry.checks[check.key] === true).length}/{editorialReviewChecks.length}</strong>
          </header>
          <div className="safeclaw-document-review-checks">
            {editorialReviewChecks.map((check) => (
              <label key={check.key}>
                <input
                  type="checkbox"
                  checked={activeEntry.checks[check.key] === true}
                  onChange={() => toggleCheck(check.key)}
                />
                <span>{check.label}</span>
              </label>
            ))}
          </div>
          {activeFindings.length > 0 ? (
            <section className="safeclaw-document-review-findings" data-testid="document-editorial-findings" aria-label={`${activeDocument.title} 자동 중복 검토 후보`}>
              <header>
                <span>자동 중복 검토 후보</span>
                <strong>{activeFindings.length}</strong>
              </header>
              <div role="list">
                {activeFindings.map((finding) => (
                  <article key={finding.id} role="listitem" data-finding-category={finding.category}>
                    <strong>{finding.label}</strong>
                    <small>{finding.kind === "exact" ? "같은 문장" : "유사 문장"} · {finding.excerpt}</small>
                  </article>
                ))}
              </div>
              <label>
                <input
                  type="checkbox"
                  checked={activeFindingsReviewed}
                  onChange={toggleFindingsReviewed}
                />
                <span>표시된 {activeFindings.length}건을 읽고 문서 역할상 필요한 반복인지 확인</span>
              </label>
            </section>
          ) : (
            <p className="muted small" data-testid="document-editorial-findings-empty">이 문서와 연결된 자동 중복 후보가 없습니다.</p>
          )}
          <label className="safeclaw-document-review-note">
            <span>검토 메모</span>
            <textarea
              value={activeEntry.note}
              maxLength={2000}
              rows={4}
              placeholder="수정할 문구나 현장 확인사항"
              onChange={(event) => updateEntry((entry) => ({ ...entry, note: event.target.value }))}
            />
          </label>
          {presence.status === "missingUnexpected" ? <p className="export-error">생성 누락 문서는 재생성 전 완료할 수 없습니다.</p> : null}
          {activeReviewIsStale && presence.status !== "missingUnexpected" ? <p className="muted small">검토 후 문구가 변경되어 다시 확인해야 합니다.</p> : null}
          <div className="safeclaw-document-review-actions">
            <button
              type="button"
              className="button secondary"
              onClick={() => {
                onEditDocument(activeDocument.key);
                onClose();
              }}
            >
              편집기로 열기
            </button>
            <button
              type="button"
              className="button"
              disabled={!activeReviewIsCurrent && !canComplete}
              onClick={toggleComplete}
            >
              {activeReviewIsCurrent ? "완료 취소" : activeReviewIsStale ? "다시 검토 완료" : "검토 완료로 표시"}
            </button>
          </div>
          <section className="safeclaw-document-review-receipt" aria-label="문서 검토 영수증">
            <label>
              <span>검토자</span>
              <input
                type="text"
                value={reviewer}
                maxLength={120}
                autoComplete="name"
                placeholder="이름 또는 직책"
                onChange={(event) => setReviewer(event.target.value)}
              />
            </label>
            <button
              type="button"
              className="button secondary"
              data-testid="document-editorial-review-receipt-download"
              disabled={!receiptReady}
              onClick={downloadReviewReceipt}
            >
              검토 영수증 받기
            </button>
            <small role="status" aria-live="polite">
              {receiptReady
                ? "12종 현재 문구와 검토자 정보가 준비됐습니다."
                : `12종 완료와 검토자 입력 후 열립니다. 현재 ${completedDocumentCount}/${launchDocuments.length}종`}
            </small>
          </section>
        </aside>
      </div>
    </dialog>
  );
}

export function CurrentDocumentsModule({ sample }: { sample: AskResponse }) {
  const current = useCurrentWorkpack(sample);
  const currentRef = useRef(current);
  const [focusToken, setFocusToken] = useState(0);
  const [requestedDocumentKey, setRequestedDocumentKey] = useState<DocumentKey | undefined>();
  const [selectedDocumentKey, setSelectedDocumentKey] = useState<DocumentKey>("riskAssessmentDraft");
  const [editorialReviewOpen, setEditorialReviewOpen] = useState(false);
  const [reviewedDocumentCount, setReviewedDocumentCount] = useState(0);
  useEffect(() => {
    currentRef.current = current;
  }, [current]);

  const updateCurrentDeliverables = useCallback((values: WorkpackDocumentValues, change: WorkpackDeliverablesChange) => {
    const snapshot = currentRef.current;
    if (typeof window === "undefined") return;

    const patch = buildDeliverablePatch(values);
    const documentKeys = Object.keys(patch) as DeliverableDocumentKey[];
    if (documentKeys.every((key) => snapshot.data.deliverables[key] === patch[key])) return;

    const nextData = applyWorkpackDeliverablesChange(snapshot.data, patch, change);

    if (snapshot.isCurrent) {
      window.localStorage.setItem(
        CURRENT_WORKPACK_STORAGE_KEY,
        JSON.stringify(buildStoredCurrentWorkpack(nextData, {
          generationFingerprint: snapshot.generationFingerprint,
          workerSnapshot: snapshot.workerSnapshot,
          dispatchSnapshot: snapshot.dispatchSnapshot
        }))
      );
    }
    snapshot.updateData(nextData);
  }, []);

  function selectDocument(key: DocumentKey) {
    setRequestedDocumentKey(key);
    setSelectedDocumentKey(key);
    setFocusToken((value) => value + 1);
  }

  return (
    <>
      <CurrentWorkpackBanner isCurrent={current.isCurrent} savedAt={current.savedAt} />
      {current.reopenMessage ? (
        <section className="safeclaw-module-panel" aria-live="polite">
          <span>아카이브 다시 열기</span>
          <h2>
            {current.reopenStatus === "ready"
              ? "저장 문서팩을 열었습니다."
              : current.reopenStatus === "loading" ? "저장 문서팩을 확인하고 있습니다." : "저장 문서팩 복원 확인 필요"}
          </h2>
          <p className={current.reopenStatus === "blocked" ? "export-error" : "muted small"}>{current.reopenMessage}</p>
          {current.reopenStatus === "blocked" ? (
            <div className="command-actions">
              <a href="/archive" className="button secondary">아카이브로 돌아가기</a>
              <a href="/workspace" className="button">새 작업공간에서 생성</a>
            </div>
          ) : null}
        </section>
      ) : null}
      <section className="safeclaw-documents-workbench" aria-label="선택 문서 작업대">
        <DocumentCockpit
          data={current.data}
          selectedDocumentKey={selectedDocumentKey}
          onSelectDocument={selectDocument}
          reviewedDocumentCount={reviewedDocumentCount}
          onOpenEditorialReview={() => setEditorialReviewOpen(true)}
        />
        <WorkpackEditor
          data={current.data}
          generationFingerprint={current.generationFingerprint}
          focusToken={focusToken}
          requestedDocumentKey={requestedDocumentKey}
          onSelectedDocumentChange={setSelectedDocumentKey}
          onDeliverablesChange={updateCurrentDeliverables}
        />
      </section>
      <DocumentEditorialReviewDialog
        data={current.data}
        generationFingerprint={current.generationFingerprint}
        open={editorialReviewOpen}
        selectedDocumentKey={selectedDocumentKey}
        onClose={() => setEditorialReviewOpen(false)}
        onEditDocument={selectDocument}
        onReviewedDocumentCountChange={setReviewedDocumentCount}
      />
    </>
  );
}

export function CurrentEvidenceModule({ sample }: { sample: AskResponse }) {
  const current = useCurrentWorkpack(sample);
  const evidenceCards = buildEvidenceCards(current.data);
  const directEvidence = evidenceCards.filter((item) => item.role === "direct");
  const supportingEvidence = evidenceCards.filter((item) => item.role === "supporting");

  return (
    <>
      <CurrentWorkpackBanner isCurrent={current.isCurrent} savedAt={current.savedAt} />
      <section className="safeclaw-module-grid two">
        <article className="safeclaw-module-panel">
          <span>문서 반영 근거</span>
          <h2>직접 근거와 보조 근거</h2>
          <p>법령·KOSHA 공식 기준은 문서 문구를 직접 뒷받침하고, 재해사례·기상·후속교육은 현장 판단을 보조하는 근거로 분리합니다.</p>
          {directEvidence.length ? <EvidenceCardList title="직접 근거" cards={directEvidence} /> : null}
          {supportingEvidence.length ? <EvidenceCardList title="보조 근거" cards={supportingEvidence} /> : null}
          {!evidenceCards.length ? <a href="/knowledge">공식자료는 지식 DB와 작업공간 근거 패널에서 확인합니다.</a> : null}
        </article>
        <CitationList citations={current.data.citations} question={current.data.question} />
      </section>
    </>
  );
}

export function CurrentWorkersModule({ sample }: { sample: AskResponse }) {
  const current = useCurrentWorkpack(sample);
  const [editableWorkers, setEditableWorkers] = useState<WorkerProfile[]>(() => currentRouteWorkers(current));
  const [draft, setDraft] = useState<WorkerProfile>(() => defaultWorkerDraft());
  const [editingWorkerId, setEditingWorkerId] = useState<string | null>(null);
  const [contactConsent, setContactConsent] = useState(false);
  const [workerSaveState, setWorkerSaveState] = useState<{
    status: "local" | "saving" | "saved" | "login-required" | "error";
    message: string;
  }>({
    status: "local",
    message: "브라우저 작업공간에서 명단을 편집합니다. 관리자 로그인 후 서버 이력에 저장할 수 있습니다."
  });
  const records = buildEducationRecordDrafts(editableWorkers, current.data.scenario.workSummary);
  const summary = summarizeWorkers(editableWorkers);
  const workerSourceLabel = current.workerSnapshot ? "현재 작업공간 저장본" : current.isCurrent ? "현재 문서팩에서 기본 추정" : "기본 예시";
  const draftLanguagePreview = buildDraftLanguagePreview(draft, current.data);

  useEffect(() => {
    setEditableWorkers(currentRouteWorkers(current));
  }, [current.data, current.workerSnapshot]);

  function persistWorkerSnapshot(nextWorkers: WorkerProfile[]) {
    const workerSnapshot = buildWorkerSnapshot(nextWorkers, current.workerSnapshot);
    const dispatchSnapshot = buildDispatchSnapshot(nextWorkers);
    setEditableWorkers(nextWorkers);
    current.updateWorkerSnapshot(workerSnapshot);
    current.updateDispatchSnapshot(dispatchSnapshot);
    setWorkerSaveState({
      status: "local",
      message: "작업자 명단이 이 브라우저의 현재 작업공간에 반영됐습니다. 전파 화면 수신자에도 함께 적용됩니다."
    });
  }

  function resetDraft() {
    setDraft(defaultWorkerDraft());
    setEditingWorkerId(null);
    setContactConsent(false);
  }

  function startEditWorker(worker: WorkerProfile) {
    setDraft({ ...worker });
    setEditingWorkerId(worker.id);
    setContactConsent(Boolean(worker.phone || worker.email));
  }

  function saveDraftWorker() {
    const displayName = draft.displayName.trim();
    const phone = draft.phone?.trim() || "";
    const email = draft.email?.trim() || "";
    if (!displayName) {
      setWorkerSaveState({
        status: "error",
        message: "표시명을 입력해야 명단에 반영할 수 있습니다."
      });
      return;
    }
    if ((phone || email) && !contactConsent) {
      setWorkerSaveState({
        status: "error",
        message: "연락처를 사용하는 경우 메일·문자 전파와 교육 확인 목적 고지가 필요합니다. 카카오·밴드는 사용하지 않습니다."
      });
      return;
    }

    const nextWorker: WorkerProfile = {
      ...draft,
      displayName,
      phone: phone || undefined,
      email: email || undefined,
      isNewWorker: draft.experienceLevel === "신규" || draft.isNewWorker,
      isForeignWorker: draft.languageCode !== "ko",
      trainingSummary: draft.trainingSummary.trim() || "작업 전 교육 확인 필요",
      experienceSummary: draft.experienceSummary.trim() || "작업 배치 전 역할과 위험요인을 확인합니다."
    };
    const nextWorkers = editingWorkerId
      ? editableWorkers.map((worker) => worker.id === editingWorkerId ? nextWorker : worker)
      : [...editableWorkers, { ...nextWorker, id: draft.id || buildWorkerId() }];

    persistWorkerSnapshot(nextWorkers);
    resetDraft();
  }

  async function saveWorkersToServer() {
    if (!current.isCurrent) {
      setWorkerSaveState({
        status: "login-required",
        message: "먼저 작업공간에서 문서팩을 생성해야 서버 이력에 연결할 수 있습니다."
      });
      return;
    }
    const session = await readSession();
    if (!session) {
      setWorkerSaveState({
        status: "login-required",
        message: "관리자 로그인 후 작업자 명단을 서버 이력에 저장합니다. 지금 편집 내용은 브라우저 작업공간에 유지됩니다."
      });
      return;
    }

    setWorkerSaveState({ status: "saving", message: "작업자 명단을 서버 이력에 저장하는 중입니다." });
    try {
      const response = await fetch("/api/workers", {
        method: "POST",
        headers: {
          authorization: `Bearer ${session.access_token}`,
          "content-type": "application/json"
        },
        body: JSON.stringify({
          scenario: current.data.scenario,
          workers: editableWorkers
        })
      });
      const payload: unknown = await response.json().catch((): unknown => ({}));
      if (!response.ok) {
        setWorkerSaveState({
          status: "error",
          message: readResponseMessage(payload, "작업자 명단 저장에 실패했습니다.")
        });
        return;
      }
      setWorkerSaveState({
        status: "saved",
        message: readResponseMessage(payload, "관리자 이력에 작업자 명단을 저장했습니다.")
      });
    } catch (error) {
      console.error("worker server save failed", error);
      setWorkerSaveState({
        status: "error",
        message: "작업자 명단 저장 요청 중 오류가 발생했습니다."
      });
    }
  }

  return (
    <>
      <CurrentWorkpackBanner isCurrent={current.isCurrent} savedAt={current.savedAt} />
      <section className="safeclaw-module-grid four">
        <article><span>선택</span><strong>{summary.selectedCount}명</strong></article>
        <article><span>외국인</span><strong>{summary.foreignCount}명</strong></article>
        <article><span>신규</span><strong>{summary.newCount}명</strong></article>
        <article><span>교육 확인</span><strong>{summary.educationPendingCount ? "필요" : "완료"}</strong></article>
      </section>
      <section className="safeclaw-module-panel">
        <span>작업 투입 적합성 카드 · {workerSourceLabel}</span>
        <h2>{current.workerSnapshot ? "작업공간에서 편집한 명단입니다." : "저장된 명단이 없어 기본 명단으로 표시합니다."}</h2>
        <p className={workerSaveState.status === "error" ? "export-error" : "muted small"}>{workerSaveState.message}</p>
        <div className="safeclaw-worker-table">
          {editableWorkers.map((worker) => {
            const record = records.find((item) => item.workerId === worker.id);
            return (
              <article key={worker.id}>
                <strong>{worker.displayName}</strong>
                <p>{worker.role} · {worker.nationality} · {worker.languageLabel}</p>
                <small>
                  {worker.phone ? `문자 ${maskPhone(worker.phone)}` : "휴대폰 필요"}
                  {worker.email ? ` · 메일 ${maskEmail(worker.email)}` : ""}
                  {" · "}{record?.memo || worker.trainingSummary}
                </small>
                {worker.isForeignWorker ? (
                  <p className="muted small">외국인 안내: {worker.languageLabel} 미리보기 확인 후 메일·문자로만 전파</p>
                ) : null}
                <div className="command-actions">
                  <button type="button" className="button secondary" onClick={() => startEditWorker(worker)}>수정</button>
                </div>
              </article>
            );
          })}
        </div>
      </section>
      <section className="safeclaw-module-panel">
        <span>{editingWorkerId ? "작업자 정보 수정" : "작업자 빠른 추가"}</span>
        <h2>{editingWorkerId ? "선택한 작업자의 연락처와 교육 상태를 바로 고칩니다." : "역할·국적·언어를 선택해서 전파 대상까지 연결합니다."}</h2>
        <p className="muted small">
          휴대폰은 문자, 이메일은 메일 전파에만 사용합니다. 카카오·밴드는 승인 대기 상태라 명단 저장이나 전송 대상에 포함하지 않습니다.
        </p>
        <div className="two-inputs">
          <label>
            <span className="field-label">표시명</span>
            <input
              className="input"
              value={draft.displayName}
              onChange={(event) => setDraft((currentDraft) => ({ ...currentDraft, displayName: event.target.value }))}
              placeholder="예: 응우옌 반 안"
            />
          </label>
          <label>
            <span className="field-label">역할</span>
            <select
              className="input"
              value={draft.role}
              onChange={(event) => setDraft((currentDraft) => ({ ...currentDraft, role: event.target.value }))}
            >
              {workerRoleOptions.map((role) => <option key={role} value={role}>{role}</option>)}
            </select>
          </label>
          <label>
            <span className="field-label">국적</span>
            <select
              className="input"
              value={draft.nationality}
              onChange={(event) => setDraft((currentDraft) => syncWorkerNationality(currentDraft, event.target.value))}
            >
              {workerLanguageOptions.map((item) => (
                <option key={item.nationality} value={item.nationality}>{item.nationality}</option>
              ))}
            </select>
          </label>
          <label>
            <span className="field-label">주 사용 언어</span>
            <select
              className="input"
              value={draft.languageCode}
              onChange={(event) => setDraft((currentDraft) => syncWorkerLanguage(currentDraft, event.target.value))}
            >
              {workerLanguageOptions.map((item) => (
                <option key={item.languageCode} value={item.languageCode}>{item.languageLabel}</option>
              ))}
            </select>
          </label>
          <label>
            <span className="field-label">숙련도</span>
            <select
              className="input"
              value={draft.experienceLevel}
              onChange={(event) => {
                const experienceLevel = event.target.value as WorkerExperienceLevel;
                setDraft((currentDraft) => ({
                  ...currentDraft,
                  experienceLevel,
                  isNewWorker: experienceLevel === "신규"
                }));
              }}
            >
              {workerExperienceLevelOptions.map((level) => <option key={level} value={level}>{level}</option>)}
            </select>
          </label>
          <label>
            <span className="field-label">교육상태</span>
            <select
              className="input"
              value={draft.trainingStatus}
              onChange={(event) => setDraft((currentDraft) => ({
                ...currentDraft,
                trainingStatus: event.target.value as WorkerTrainingStatus
              }))}
            >
              {workerTrainingStatusOptions.map((status) => <option key={status} value={status}>{status}</option>)}
            </select>
          </label>
          <label>
            <span className="field-label">현장 투입일</span>
            <input
              className="input"
              type="date"
              value={draft.joinedAt}
              onChange={(event) => setDraft((currentDraft) => ({ ...currentDraft, joinedAt: event.target.value }))}
            />
          </label>
          <label>
            <span className="field-label">휴대폰</span>
            <input
              className="input"
              value={draft.phone || ""}
              onChange={(event) => setDraft((currentDraft) => ({ ...currentDraft, phone: event.target.value }))}
              placeholder="010-0000-0000"
            />
          </label>
          <label>
            <span className="field-label">이메일</span>
            <input
              className="input"
              value={draft.email || ""}
              onChange={(event) => setDraft((currentDraft) => ({ ...currentDraft, email: event.target.value }))}
              placeholder="name@safeclaw.kr"
            />
          </label>
        </div>
        <div className="worker-language-preview" aria-live="polite">
          <div>
            <span className="eyebrow">언어 미리보기</span>
            <strong>{draftLanguagePreview.title}</strong>
          </div>
          <ul>
            {draftLanguagePreview.lines.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
          {draft.languageCode !== "ko" ? (
            <p>전송 전 현장 통역 또는 해당 언어 가능자가 문구를 확인하고, 근로자가 이해했음을 교육 기록에 남깁니다.</p>
          ) : null}
        </div>
        <div className="consent-check">
          <input
            type="checkbox"
            aria-label="교육 확인 및 현장 전파 목적 개인정보 사용 동의"
            checked={contactConsent}
            onChange={(event) => setContactConsent(event.target.checked)}
          />
          <span>연락처·국적·언어 정보는 안전교육 확인과 메일·문자 현장 전파 목적으로만 사용합니다. 카카오·밴드 전파는 별도 승인 전까지 제외합니다.</span>
        </div>
        <div className="command-actions">
          <button type="button" className="button" onClick={saveDraftWorker}>
            {editingWorkerId ? "수정 반영" : "명단에 추가"}
          </button>
          <button type="button" className="button secondary" onClick={resetDraft}>
            {editingWorkerId ? "수정 취소" : "입력 초기화"}
          </button>
          <button type="button" className="button secondary" onClick={saveWorkersToServer} disabled={workerSaveState.status === "saving"}>
            {workerSaveState.status === "saving" ? "서버 저장 중" : "관리자 이력 저장"}
          </button>
        </div>
      </section>
    </>
  );
}

export function CurrentDispatchModule({ sample }: { sample: AskResponse }) {
  const current = useCurrentWorkpack(sample);
  const workers = currentRouteWorkers(current);
  const recipientSuggestions = current.dispatchSnapshot?.recipientSuggestions.length
    ? filterRealRecipientSuggestions(current.dispatchSnapshot.recipientSuggestions)
    : filterRealRecipientSuggestions(buildRecipientSuggestions(workers));
  const targetWorkers = current.dispatchSnapshot?.targetWorkers.length
    ? filterRealDispatchTargets(current.dispatchSnapshot.targetWorkers)
    : recipientSuggestions.length ? filterRealDispatchTargets(buildWorkerDispatchTargets(workers)) : [];
  const dispatchSourceLabel = current.dispatchSnapshot ? "작업공간 전파 저장본" : current.workerSnapshot ? "작업자 저장본에서 재계산" : "기본 예시 기반";

  return (
    <>
      <CurrentWorkpackBanner isCurrent={current.isCurrent} savedAt={current.savedAt} />
      <section className="safeclaw-module-grid two">
        {current.isCurrent ? (
          <WorkflowSharePanel
            data={current.data}
            recipientSuggestions={recipientSuggestions}
            targetWorkers={targetWorkers}
          />
        ) : (
          <article className="safeclaw-module-panel">
            <span>전파 대기</span>
            <h2>작업 입력 후 실제 전파.</h2>
            <p>기본 예시 데이터는 메시지 형태만 확인합니다. 메일·문자 실발송은 작업공간에서 문서팩을 생성한 뒤 진행합니다.</p>
            <a href="/workspace">작업 입력으로 이동</a>
          </article>
        )}
        <article className="safeclaw-module-panel">
          <span>제출 기준 채널</span>
          <h2>메일·문자 우선.</h2>
          <p>전송 전 수신자, 채널, 언어, 메시지 미리보기를 확인한 뒤 전송 서비스 결과를 채널별로 표시합니다. 현재 대상 기준: {dispatchSourceLabel}.</p>
          {!recipientSuggestions.length ? (
            <p className="export-error">기본 예시 연락처는 실발송 대상에서 제외했습니다. 수신자를 직접 입력해야 전송할 수 있습니다.</p>
          ) : null}
          <ul>
            <li>메일: 관리자·원청 보고</li>
            <li>문자: 작업자 즉시 공지</li>
            <li>카카오·밴드: 이번 제출 범위에서는 보류</li>
          </ul>
        </article>
      </section>
    </>
  );
}

export function CurrentArchiveModule({ sample }: { sample: AskResponse }) {
  const current = useCurrentWorkpack(sample);
  const [serverArchive, setServerArchive] = useState<ServerArchiveState>({
    status: "idle",
    message: "관리자 로그인 후 서버 이력을 조회합니다.",
    workpacks: [],
    dispatchLogs: []
  });
  const workers = currentRouteWorkers(current);
  const dispatchTargets = current.dispatchSnapshot?.targetWorkers.length
    ? current.dispatchSnapshot.targetWorkers
    : buildWorkerDispatchTargets(workers);
  const savedLabel = current.isCurrent ? formatSavedAt(current.savedAt) : "";
  const hasWorkerSnapshot = Boolean(current.workerSnapshot);
  const hasDispatchSnapshot = Boolean(current.dispatchSnapshot);
  const browserArchiveLabel = current.isCurrent ? "브라우저 최신 저장본" : "브라우저 저장본 없음";
  const supabaseLoginAvailable = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

  async function loadServerArchive() {
    if (!supabaseLoginAvailable) {
      setServerArchive({
        status: "unconfigured",
        message: "관리자 이력 저장소 연결 전입니다. 지금은 이 브라우저의 최근 작업을 이어서 사용할 수 있습니다.",
        workpacks: [],
        dispatchLogs: []
      });
      return;
    }

    setServerArchive((currentState) => ({
      ...currentState,
      status: "loading",
      message: "관리자 서버 이력을 불러오는 중입니다."
    }));

    const session = await readSession();
    if (!session) {
      setServerArchive({
        status: "login-required",
        message: "관리자 로그인 후 저장된 문서팩과 전파 이력을 불러올 수 있습니다.",
        workpacks: [],
        dispatchLogs: []
      });
      return;
    }

    try {
      const headers = { authorization: `Bearer ${session.access_token}` };
      const [workpackResponse, dispatchResponse] = await Promise.all([
        fetch("/api/workpacks?limit=12", { headers }),
        fetch("/api/dispatch-logs?limit=12", { headers })
      ]);
      const workpackPayload = await workpackResponse.json().catch((): unknown => ({}));
      const dispatchPayload = await dispatchResponse.json().catch((): unknown => ({}));
      const workpackRecord = workpackPayload && typeof workpackPayload === "object" && !Array.isArray(workpackPayload)
        ? workpackPayload as Record<string, unknown>
        : {};
      const dispatchRecord = dispatchPayload && typeof dispatchPayload === "object" && !Array.isArray(dispatchPayload)
        ? dispatchPayload as Record<string, unknown>
        : {};

      if (!workpackResponse.ok || !dispatchResponse.ok) {
        setServerArchive({
          status: "error",
          message: `${typeof workpackRecord.message === "string" ? workpackRecord.message : "문서팩 이력 조회 확인 필요"} / ${typeof dispatchRecord.message === "string" ? dispatchRecord.message : "전파 이력 조회 확인 필요"}`,
          workpacks: [],
          dispatchLogs: []
        });
        return;
      }

      setServerArchive({
        status: "ready",
        message: typeof workpackRecord.message === "string" ? workpackRecord.message : "관리자 서버 이력을 불러왔습니다.",
        workpacks: readArchiveWorkpacks(workpackRecord.workpacks),
        dispatchLogs: readArchiveDispatchLogs(dispatchRecord.logs)
      });
    } catch (error) {
      console.error("server archive fetch failed", error);
      setServerArchive({
        status: "error",
        message: "서버 이력 조회 중 오류가 발생했습니다.",
        workpacks: [],
        dispatchLogs: []
      });
    }
  }

  return (
    <>
      <CurrentWorkpackBanner isCurrent={current.isCurrent} savedAt={current.savedAt} />
      <section className="safeclaw-module-grid four">
        <article><span>로컬 상태</span><strong>{browserArchiveLabel}</strong></article>
        <article><span>작업자 명단</span><strong>{hasWorkerSnapshot ? `${workers.length}명` : "없음"}</strong></article>
        <article><span>관리자 저장</span><strong>{supabaseLoginAvailable ? "연결 가능" : "연결 전"}</strong></article>
        <article><span>서버 이력</span><strong>{serverArchive.status === "ready" ? `${serverArchive.workpacks.length}건` : "조회 대기"}</strong></article>
      </section>
      {!current.isCurrent ? (
        <section className="safeclaw-module-panel">
          <span>저장된 이력 없음</span>
          <h2>작업 입력 후 이력이 생깁니다.</h2>
          <p>아직 이 브라우저에 생성된 문서팩이 없습니다. 기본 예시의 숫자를 이력처럼 보여주지 않고, 실제 작업 생성 후 최신 스냅샷을 표시합니다. 관리자 로그인 상태라면 아래에서 서버 이력은 바로 조회할 수 있습니다.</p>
          <a href="/workspace">작업 입력으로 이동</a>
        </section>
      ) : (
      <>
      <section className="safeclaw-module-panel">
        <span>최근 작업 스냅샷 · 로컬</span>
        <h2>{current.data.scenario.siteName}</h2>
        <p>{current.data.riskSummary.topRisk}</p>
        <div className="safeclaw-archive-list">
          <article>
            <strong>문서팩 열기</strong>
            <code>/documents</code>
            <p>최신 작업의 편집, 정식 출력, 보완 제안을 이어서 처리합니다.</p>
          </article>
          <article>
            <strong>근거 확인</strong>
            <code>/evidence</code>
            <p>법령, KOSHA, 재해사례, 지식 DB 근거가 문서에 어떻게 반영됐는지 확인합니다.</p>
          </article>
          <article>
            <strong>서버 아카이브</strong>
            <code>workpacks · dispatch_logs</code>
            <p>관리자 로그인 세션이 있으면 Supabase에 저장된 문서팩과 전파 이력을 같은 화면에서 불러옵니다.</p>
          </article>
        </div>
        <p className="muted small">전파 대상 기준: {hasDispatchSnapshot ? `작업공간 전파 저장본 ${dispatchTargets.length}명` : "전파 저장본 없음, 현재 작업자 명단에서 재계산"} · 갱신 시각: {savedLabel || "대기"}.</p>
        <p className="export-error">로컬 스냅샷과 서버 이력은 구분합니다. 제출 증빙은 관리자 로그인 후 저장된 서버 이력만 사용하세요.</p>
      </section>
      </>
      )}
      <section className="safeclaw-module-panel">
        <div className="compact-head">
          <div>
            <span>관리자 서버 이력</span>
            <h2>문서팩·전파 로그.</h2>
          </div>
          <button type="button" className="button secondary" onClick={loadServerArchive} disabled={serverArchive.status === "loading"}>
            {serverArchive.status === "loading" ? "조회 중" : "서버 이력 조회"}
          </button>
        </div>
        <p className={serverArchive.status === "error" || serverArchive.status === "login-required" ? "export-error" : "muted small"}>
          {serverArchive.message}
        </p>
        {serverArchive.status === "ready" ? (
          <div className="safeclaw-archive-list">
            {serverArchive.workpacks.length ? serverArchive.workpacks.map((item) => (
              <article key={item.id}>
                <strong>{item.siteName}</strong>
                <code>{new Date(item.createdAt).toLocaleString("ko-KR")}</code>
                <p>{excerpt(item.question, 150)}</p>
                <a href={item.reopenHref}>저장 문서팩 다시 열기</a>
              </article>
            )) : (
              <article>
                <strong>문서팩 이력 없음</strong>
                <code>workpacks</code>
                <p>작업공간에서 문서팩을 저장하면 이 목록에 표시됩니다.</p>
              </article>
            )}
            {serverArchive.dispatchLogs.length ? serverArchive.dispatchLogs.slice(0, 6).map((log) => (
              <article key={log.id}>
                <strong>{log.channel} · {formatDispatchProviderStatus(log.providerStatus)}</strong>
                <code>{log.workflowRunId || log.provider || "dispatch_logs"}</code>
                <p>{log.targetLabel || "수신자"} · {log.siteName} · {new Date(log.createdAt).toLocaleString("ko-KR")}{log.failureReason ? ` · ${log.failureReason}` : ""}</p>
              </article>
            )) : null}
          </div>
        ) : null}
      </section>
    </>
  );
}
