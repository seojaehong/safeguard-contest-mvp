"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { AskResponse, type EducationRecordStructured, type PermitInspectionStructured, type WorkPlanStructured } from "@/lib/types";
import {
  ACCIDENT_TYPE_VALUES,
  FOUR_M_VALUES,
  VERIFICATION_STATUS_VALUES,
  validateRiskAssessmentRows,
  type RiskAssessmentRow
} from "@/lib/risk-assessment-schema";
import {
  evaluatePublicSafetyRubric,
  rubricCategoryLabel,
  rubricStatusLabel,
  type RubricDocumentKey,
  type RubricEvaluationItem
} from "@/lib/safety-document-rubric";
import { buildWorkpackGenerationFingerprint } from "@/lib/current-workpack";
import {
  areRiskAssessmentRowsRepresentedInDraft,
  buildStructuredDocumentSections,
  groupSubmissionPreviewRows,
  isCanonicalRiskAssessmentExportSafe,
  isMetaSection,
  replaceStructuredDocumentSection,
  serializeRiskAssessmentRowsToDraft,
  updateRiskAssessmentRowField,
  type DocumentKey
} from "./workpack-editor-structure";
import styles from "./WorkpackEditor.module.css";

declare global {
  var measureTextWidth: ((font: string, text: string) => number) | undefined;
}

export type { DocumentKey } from "./workpack-editor-structure";

export type WorkpackDocumentValues = Record<DocumentKey, string>;

export type WorkpackDeliverablesChange = {
  source: "generated" | "stored-draft" | "user-edit";
  requiresRevalidation: boolean;
};

const rubricDocumentKeys: RubricDocumentKey[] = [
  "workpackSummaryDraft",
  "riskAssessmentDraft",
  "workPlanDraft",
  "tbmBriefing",
  "tbmLogDraft",
  "safetyEducationRecordDraft",
  "emergencyResponseDraft",
  "photoEvidenceDraft",
  "foreignWorkerBriefing",
  "foreignWorkerTransmission",
  "kakaoMessage"
];

function isRubricDocumentKey(key: DocumentKey): key is RubricDocumentKey {
  return rubricDocumentKeys.includes(key as RubricDocumentKey);
}

type EditableDocument = {
  key: DocumentKey;
  title: string;
  description: string;
  fileBase: string;
};

type RhwpModule = typeof import("@rhwp/core");
type SheetRow = {
  document: string;
  section: string;
  item: string;
  content: string;
};
type TemplateKind = "sheet" | "word" | "hwp";
type TemplatePreset = {
  kind: TemplateKind;
  label: string;
  description: string;
  previewTitle: string;
  previewBullets: string[];
};
type CustomerTemplateField = {
  key: string;
  label: string;
  mapsTo: string;
  appliesTo: string;
};

const accidentTypeLabels: Record<RiskAssessmentRow["accidentType"], string> = {
  fall: "추락",
  slip: "미끄러짐·넘어짐",
  struckBy: "충돌·맞음",
  caughtIn: "끼임",
  cut: "베임",
  burn: "화상",
  collapse: "붕괴",
  fireExplosion: "화재·폭발",
  electricShock: "감전",
  chemicalExposure: "유해물질 노출",
  asphyxiation: "질식",
  heatIllness: "온열질환",
  traffic: "차량 충돌",
  other: "기타"
};

const verificationStatusLabels: Record<RiskAssessmentRow["verificationStatus"], string> = {
  planned: "확인 예정",
  done: "확인 완료",
  needsReview: "재확인 필요"
};

function createEmptyRiskAssessmentRow(data: AskResponse): RiskAssessmentRow {
  return {
    location: data.scenario.siteName,
    process: data.scenario.workSummary,
    task: "",
    equipment: "",
    hazard: "",
    fourM: "Man",
    accidentType: "other",
    currentControls: "",
    likelihood: 1,
    severity: 1,
    riskLevel: "low",
    additionalControls: "",
    owner: "",
    due: "현장 확인",
    verification: "",
    verificationStatus: "planned",
    verificationDate: "현장 확인",
    verificationChecker: "",
    whyLikelihood: "",
    whySeverity: "",
    evidenceRefs: []
  };
}
type SafetyFormProfile = {
  code: string;
  subtitle: string;
  layout: "generic" | "risk" | "workPlan" | "permit" | "tbmBriefing" | "tbmLog" | "education" | "photo";
  primaryColumn: string;
  actionColumn: string;
  confirmationRows: string[];
  approvalLabels: string[];
};
type RemediationDraft = {
  itemId: string;
  text: string;
  status: "ready" | "error";
  message: string;
  providerLabel: string | null;
  policyNote: string;
  catalogStatus: {
    configured: boolean;
    ok: boolean;
    count: number;
    message: string;
  } | null;
  sources: Array<{
    title: string;
    agency: string;
    url: string;
    sourceType: string;
    roleLabel: string;
    reflectionLabel: string;
  }>;
};

let rhwpModulePromise: Promise<RhwpModule> | null = null;

const templatePresets: TemplatePreset[] = [
  {
    kind: "sheet",
    label: "XLS(HTML 호환)",
    description: "Excel에서 열 수 있는 HTML 기반 .xls 표 양식입니다.",
    previewTitle: "표지 + 섹션 요약 + 확인 칸",
    previewBullets: ["섹션별 행·열 구조", "No./항목/내용/확인 컬럼", "바이너리 XLSX가 아닌 HTML 호환 파일"]
  },
  {
    kind: "word",
    label: "Word 보고서형",
    description: "본문과 표를 함께 보여주는 점검 보고서형 문서",
    previewTitle: "보고서 헤더 + 본문 표",
    previewBullets: ["제목/메타/섹션 헤더", "본문형 설명과 표 혼합", "원청·관리자 보고용"]
  },
  {
    kind: "hwp",
    label: "HWPX 제출형 초안",
    description: "rhwp로 생성한 한글 제출 보조 초안입니다. 원본 한글 서식 1:1 복제는 아닙니다.",
    previewTitle: "rhwp 한글 문서 + 확인/서명란",
    previewBullets: ["공식 서식 항목명 유지", "확인자·관리감독자 서명란", "원본 셀·결재칸은 제출 전 확인"]
  }
];

const customerTemplateFields: CustomerTemplateField[] = [
  { key: "siteName", label: "현장명", mapsTo: "scenario.siteName", appliesTo: "표지, 작업개요, 결재란" },
  { key: "workName", label: "작업명", mapsTo: "scenario.workName / 정제된 작업내용", appliesTo: "작업계획서, TBM, 교육기록" },
  { key: "riskFactors", label: "주요 유해·위험요인", mapsTo: "riskAssessmentDraft rows", appliesTo: "위험성평가표, TBM" },
  { key: "controls", label: "감소대책", mapsTo: "risk controls / immediate actions", appliesTo: "위험성평가표, 작업허가, TBM" },
  { key: "workers", label: "작업자·교육대상", mapsTo: "worker summary", appliesTo: "TBM 기록, 안전보건교육 기록" },
  { key: "educationContent", label: "교육내용", mapsTo: "safetyEducationRecordDraft", appliesTo: "교육일지, 외국인 안내문" },
  { key: "approver", label: "확인자·승인자", mapsTo: "user-entered approval line", appliesTo: "결재란, 서명란" }
];

const documentMeta: EditableDocument[] = [
  {
    key: "workpackSummaryDraft",
    title: "점검결과 요약",
    description: "현장명, 작업조건, 핵심 위험, 즉시조치, 연결 상태를 첫 장으로 정리합니다.",
    fileBase: "workpack-summary"
  },
  {
    key: "riskAssessmentDraft",
    title: "위험성평가표",
    description: "KOSHA 절차에 맞춰 사전준비, 위험요인, 감소대책, 조치 확인을 정리합니다.",
    fileBase: "risk-assessment"
  },
  {
    key: "workPlanDraft",
    title: "작업계획서",
    description: "작업구간, 작업순서, 장비·인원, 허가·첨부, 작업중지 기준을 정리합니다.",
    fileBase: "work-plan"
  },
  {
    key: "workPermitDraft",
    title: "안전작업허가 확인서",
    description: "위험작업 허가, 작업시간, 격리·차단, 화재·가스·보호구, 종료 확인을 분리합니다.",
    fileBase: "work-permit"
  },
  {
    key: "tbmBriefing",
    title: "TBM/작업 전 안전점검회의",
    description: "작업내용, 위험요인, 안전대책, 참석자 확인을 브리핑 형식으로 정리합니다.",
    fileBase: "tbm-briefing"
  },
  {
    key: "tbmLogDraft",
    title: "TBM 기록",
    description: "작업일지·모바일 앱·사진·영상 기록까지 함께 남기는 회의 기록입니다.",
    fileBase: "tbm-log"
  },
  {
    key: "safetyEducationRecordDraft",
    title: "안전보건교육 기록",
    description: "교육대상, 교육내용, 확인방법, 후속 교육 추천을 분리해 남깁니다.",
    fileBase: "safety-education"
  },
  {
    key: "emergencyResponseDraft",
    title: "비상대응 절차",
    description: "사고 징후, 초기조치, 보고체계, 현장보존, 재발방지 흐름을 정리합니다.",
    fileBase: "emergency-response"
  },
  {
    key: "photoEvidenceDraft",
    title: "사진/증빙",
    description: "작업 전·후 사진, TBM/교육 증빙, 확인자와 보관 위치를 남깁니다.",
    fileBase: "photo-evidence"
  },
  {
    key: "foreignWorkerBriefing",
    title: "외국인 근로자 출력본",
    description: "쉬운 한국어와 상위 체류국가 언어 기본팩을 함께 제공하는 교육용 출력본입니다.",
    fileBase: "foreign-worker-briefing"
  },
  {
    key: "foreignWorkerTransmission",
    title: "외국인 근로자 전송본",
    description: "문자·카카오·밴드로 전송하기 좋은 짧은 다국어 안전공지입니다.",
    fileBase: "foreign-worker-message"
  },
  {
    key: "kakaoMessage",
    title: "현장 공유 메시지",
    description: "카카오톡·문자·단체방에 붙여넣기 좋은 축약본입니다.",
    fileBase: "field-message"
  }
];

function documentTabId(key: DocumentKey) {
  return `workpack-document-tab-${key}`;
}

const documentCoverageLabels: Partial<Record<DocumentKey, string>> = {
  riskAssessmentDraft: "위험성평가표",
  tbmBriefing: "TBM 브리핑",
  tbmLogDraft: "TBM 기록"
};

const CORE_DOCUMENT_KEYS: readonly DocumentKey[] = ["riskAssessmentDraft", "tbmBriefing", "tbmLogDraft"];
const coreDocumentKeySet = new Set<DocumentKey>(CORE_DOCUMENT_KEYS);
const coreDocumentMeta = documentMeta.filter((item) => coreDocumentKeySet.has(item.key));
const supportingDocumentMeta = documentMeta.filter((item) => !coreDocumentKeySet.has(item.key));
const SUPPORTING_DOCUMENT_KEYS: readonly DocumentKey[] = supportingDocumentMeta.map((item) => item.key);

const DEFAULT_SELECTED_DOCUMENT_KEY: DocumentKey = "riskAssessmentDraft";

function sanitizeFileName(value: string) {
  return value.replace(/[\\/:*?"<>|]/g, "-").replace(/\s+/g, "-").slice(0, 80) || "safeclaw";
}

const SAVE_ANNOUNCEMENT_DELAY_MS = 450;

export function buildGenerationEvidenceFingerprint(data: AskResponse) {
  return buildWorkpackGenerationFingerprint(data);
}

function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function rowText(row: SheetRow) {
  return [row.item, row.content].filter(Boolean).join(" ");
}

function findRows(rows: SheetRow[], patterns: string[], fallbackCount = 3) {
  const matched = rows.filter((row) => {
    const text = rowText(row);
    return patterns.some((pattern) => text.includes(pattern));
  });
  return (matched.length ? matched : rows).slice(0, fallbackCount);
}

function compactContent(row: SheetRow | undefined, fallback: string) {
  if (!row) return fallback;
  return row.content || row.item || fallback;
}

function previewRowItem(row: SheetRow, fallback: string) {
  const item = row.item.trim();
  if (item && !/^\d+[-\s]*$/.test(item)) return item;

  const content = compactContent(row, fallback).replace(/\s+/g, " ").trim();
  const firstClause = content
    .split(/[.。]/)[0]
    .split(/[,(（]/)[0]
    .trim();
  const label = firstClause || content || item || fallback;
  return label.length > 34 ? `${label.slice(0, 34)}...` : label;
}

function buildTbmBridgeRows(data: AskResponse, riskRows: SheetRow[]) {
  const riskItems = findRows(riskRows, ["위험", "추락", "전도", "충돌", "끼임", "화재", "중독", "노출"], 4);
  const weatherSignals = data.externalData.weather.actions.length
    ? data.externalData.weather.actions
    : [data.externalData.weather.summary || data.scenario.weatherNote];
  return riskItems.map((row, index) => ({
    risk: compactContent(row, data.riskSummary.topRisk),
    weather: weatherSignals[index % weatherSignals.length] || data.scenario.weatherNote,
    source: "위험성평가표 → TBM",
    message: "위험성평가 결과를 작업 전 공유 · 이해 확인 · 위험 시 즉시 작업중지"
  }));
}

function isTbmDocumentKey(key: DocumentKey) {
  return key === "tbmBriefing" || key === "tbmLogDraft";
}

function isExecutionDocumentKey(key: DocumentKey) {
  return key === "workPlanDraft" || key === "workPermitDraft";
}

function isEducationDocumentKey(key: DocumentKey) {
  return key === "safetyEducationRecordDraft";
}

function isEmergencyDocumentKey(key: DocumentKey) {
  return key === "emergencyResponseDraft";
}

function isPhotoEvidenceDocumentKey(key: DocumentKey) {
  return key === "photoEvidenceDraft";
}

function isTransmissionDocumentKey(key: DocumentKey) {
  return key === "foreignWorkerTransmission" || key === "kakaoMessage";
}

function compactList(items: readonly string[], fallback: string, limit: number) {
  const compacted = items.map((item) => item.trim()).filter(Boolean);
  return (compacted.length ? compacted : [fallback]).slice(0, limit);
}

function TbmDocumentCockpit({ data, documentKey }: { data: AskResponse; documentKey: DocumentKey }) {
  if (!isTbmDocumentKey(documentKey)) return null;
  const actions = compactList(data.riskSummary.immediateActions, data.riskSummary.topRisk, 3);
  const questions = compactList(data.deliverables.tbmQuestions, "오늘 위험요인과 작업중지 기준을 전원이 설명할 수 있나요?", 3);
  const practicalPoints = compactList(data.practicalPoints, data.riskSummary.topRisk, 3);
  const weatherSignal = data.externalData.weather.summary || data.scenario.weatherNote || "현장 확인";

  return (
    <section className={styles.tbmCockpit} data-testid="tbm-document-cockpit" aria-label="TBM 진행 요약">
      <div className={styles.tbmCockpitHeader}>
        <div>
          <span className="eyebrow">TBM 진행 cockpit</span>
          <strong>{documentKey === "tbmLogDraft" ? "기록 전 확인할 질문과 조치" : "브리핑 전에 바로 읽을 핵심"}</strong>
        </div>
        <span>{data.scenario.workerCount.toLocaleString("ko-KR")}명 · 위험도 {data.riskSummary.riskLevel}</span>
      </div>
      <div className={styles.tbmCockpitGrid}>
        <article>
          <b>오늘 작업</b>
          <strong>{data.scenario.workSummary}</strong>
          <small>{weatherSignal}</small>
        </article>
        <article>
          <b>핵심 위험</b>
          <strong>{data.riskSummary.topRisk}</strong>
          <small>{practicalPoints[0]}</small>
        </article>
      </div>
      <div className={styles.tbmCockpitColumns}>
        <div>
          <b>진행 질문</b>
          <ol>
            {questions.map((question) => <li key={question}>{question}</li>)}
          </ol>
        </div>
        <div>
          <b>즉시 조치</b>
          <ol>
            {actions.map((action) => <li key={action}>{action}</li>)}
          </ol>
        </div>
      </div>
    </section>
  );
}

function getWorkPlanStructured(data: AskResponse): WorkPlanStructured | null {
  const deliverables = data.deliverables as { workPlanStructured?: WorkPlanStructured };
  return deliverables.workPlanStructured ?? null;
}

function getPermitInspectionStructured(data: AskResponse): PermitInspectionStructured {
  const deliverables = data.deliverables as { permitInspectionStructured?: PermitInspectionStructured };
  return deliverables.permitInspectionStructured ?? buildPermitInspectionStructured(data);
}

function WorkExecutionDocumentCockpit({ data, documentKey }: { data: AskResponse; documentKey: DocumentKey }) {
  if (!isExecutionDocumentKey(documentKey)) return null;
  const workPlan = getWorkPlanStructured(data);
  const permit = getPermitInspectionStructured(data);
  const steps = workPlan?.workSteps.slice(0, 3) ?? [];
  const stopCriteria = compactList(workPlan?.stopCriteria ?? data.riskSummary.immediateActions, data.riskSummary.topRisk, 3);
  const conditions = permit.conditions.slice(0, 3);
  const requiredAttachments = permit.attachments.filter((attachment) => attachment.required);
  const blockedAttachments = requiredAttachments.filter((attachment) => attachment.status !== "첨부");
  const completionChecks = permit.completionChecks.slice(0, 2);
  const isPermit = documentKey === "workPermitDraft";

  return (
    <section className={styles.tbmCockpit} data-testid="execution-document-cockpit" aria-label="작업 실행 요약">
      <div className={styles.tbmCockpitHeader}>
        <div>
          <span className="eyebrow">작업 실행 cockpit</span>
          <strong>{isPermit ? "허가 조건과 첨부 확인" : "작업 순서와 중지 기준"}</strong>
        </div>
        <span>{data.scenario.workerCount.toLocaleString("ko-KR")}명 · {isPermit ? permit.basicInfo.permitType : data.riskSummary.riskLevel}</span>
      </div>
      <div className={styles.tbmCockpitGrid}>
        <article>
          <b>{isPermit ? "허가 조건" : "첫 작업"}</b>
          <strong>{isPermit ? conditions[0]?.requirement ?? data.riskSummary.topRisk : steps[0]?.action ?? data.scenario.workSummary}</strong>
          <small>{isPermit ? conditions[0]?.action ?? data.riskSummary.immediateActions[0] ?? "작업 전 확인" : steps[0]?.safetyMeasure ?? data.riskSummary.immediateActions[0] ?? "작업 전 확인"}</small>
        </article>
        <article>
          <b>{isPermit ? "첨부 상태" : "작업중지"}</b>
          <strong>{isPermit ? `${blockedAttachments.length.toLocaleString("ko-KR")}건 보완 · ${requiredAttachments.length.toLocaleString("ko-KR")}건 필수` : stopCriteria[0]}</strong>
          <small>{isPermit ? blockedAttachments[0]?.name ?? "필수 첨부 확인" : stopCriteria[1] ?? data.scenario.weatherNote}</small>
        </article>
      </div>
      <div className={styles.tbmCockpitColumns}>
        <div>
          <b>{isPermit ? "허가 조건" : "작업 순서"}</b>
          <ol>
            {(isPermit ? conditions : steps).map((item, index) => (
              <li key={isPermit ? `${conditions[index]?.category}-${conditions[index]?.requirement}` : `${steps[index]?.stepNo}-${steps[index]?.action}`}>
                {isPermit
                  ? `${conditions[index]?.category} · ${conditions[index]?.requirement}`
                  : `${steps[index]?.action} · ${steps[index]?.safetyMeasure}`}
              </li>
            ))}
            {!isPermit && !steps.length ? <li>{data.scenario.workSummary}</li> : null}
          </ol>
        </div>
        <div>
          <b>{isPermit ? "첨부/종료" : "중지 기준"}</b>
          <ol>
            {(isPermit ? [...blockedAttachments.slice(0, 2).map((attachment) => `${attachment.name} · ${attachment.status}`), ...completionChecks.map((check) => `${check.item} · ${check.status}`)].slice(0, 3) : stopCriteria).map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}

function getEducationRecordStructured(data: AskResponse): EducationRecordStructured | null {
  const deliverables = data.deliverables as { educationRecordStructured?: EducationRecordStructured };
  return deliverables.educationRecordStructured ?? null;
}

function EducationDocumentCockpit({ data, documentKey }: { data: AskResponse; documentKey: DocumentKey }) {
  if (!isEducationDocumentKey(documentKey)) return null;
  const education = getEducationRecordStructured(data);
  const curriculum = education?.curriculum.slice(0, 3) ?? [];
  const points = compactList(data.deliverables.safetyEducationPoints, data.riskSummary.topRisk, 3);
  const topics = curriculum.length
    ? curriculum.map((item) => `${item.topic} · ${item.keyPoints[0] ?? item.lawCitation}`)
    : points;
  const understandingCheck = education?.understandingCheck || "질문 · 복창 · 서명으로 이해 여부 확인";
  const tbmLink = education?.tbmLink || compactList(data.deliverables.tbmQuestions, "TBM에서 작업중지 기준을 다시 확인", 1)[0];

  return (
    <section className={styles.tbmCockpit} data-testid="education-document-cockpit" aria-label="교육 진행 요약">
      <div className={styles.tbmCockpitHeader}>
        <div>
          <span className="eyebrow">교육 진행 cockpit</span>
          <strong>{education?.educationName || "교육 대상과 이해확인"}</strong>
        </div>
        <span>{data.scenario.workerCount.toLocaleString("ko-KR")}명 · {education?.type || "작업 전 교육"}</span>
      </div>
      <div className={styles.tbmCockpitGrid}>
        <article>
          <b>교육 대상</b>
          <strong>{education?.target || `${data.scenario.workerCount.toLocaleString("ko-KR")}명 현장 작업자`}</strong>
          <small>{education?.location || data.scenario.siteName}</small>
        </article>
        <article>
          <b>이해 확인</b>
          <strong>{understandingCheck}</strong>
          <small>{education?.followupRecommendation || "미이해자는 추가 설명 후 재확인"}</small>
        </article>
      </div>
      <div className={styles.tbmCockpitColumns}>
        <div>
          <b>교육 내용</b>
          <ol>
            {topics.map((topic) => <li key={topic}>{topic}</li>)}
          </ol>
        </div>
        <div>
          <b>TBM 연계</b>
          <ol>
            <li>{tbmLink}</li>
            <li>{data.riskSummary.topRisk}</li>
            <li>{data.riskSummary.immediateActions[0] || "작업중지 기준 확인"}</li>
          </ol>
        </div>
      </div>
    </section>
  );
}

function EmergencyDocumentCockpit({ data, documentKey }: { data: AskResponse; documentKey: DocumentKey }) {
  if (!isEmergencyDocumentKey(documentKey)) return null;
  const stopSignals = compactList(
    [
      ...data.riskSummary.immediateActions,
      ...data.externalData.weather.actions,
      data.scenario.weatherNote
    ],
    data.riskSummary.topRisk,
    3
  );
  const responseFlow = compactList(
    [
      "작업 즉시 중지 · 위험구역 이탈",
      "관리감독자에게 상황 보고",
      "현장보존 후 재발방지 조치 기록"
    ],
    "작업중지 후 보고·보존·재발방지",
    3
  );
  const contactRoles = compactList(
    ["작업반장", "관리감독자", "안전관리자"],
    "현장 비상연락망 확인",
    3
  );

  return (
    <section className={styles.tbmCockpit} data-testid="emergency-document-cockpit" aria-label="비상대응 진행 요약">
      <div className={styles.tbmCockpitHeader}>
        <div>
          <span className="eyebrow">비상대응 cockpit</span>
          <strong>중지 · 보고 · 보존 흐름</strong>
        </div>
        <span>{data.scenario.siteName} · {data.riskSummary.riskLevel}</span>
      </div>
      <div className={styles.tbmCockpitGrid}>
        <article>
          <b>즉시 중지 기준</b>
          <strong>{data.riskSummary.topRisk}</strong>
          <small>{stopSignals[0]}</small>
        </article>
        <article>
          <b>보고 역할</b>
          <strong>{contactRoles.join(" → ")}</strong>
          <small>번호는 현장 승인 연락망으로 별도 확인</small>
        </article>
      </div>
      <div className={styles.tbmCockpitColumns}>
        <div>
          <b>초기조치</b>
          <ol>
            {responseFlow.map((item) => <li key={item}>{item}</li>)}
          </ol>
        </div>
        <div>
          <b>현장보존</b>
          <ol>
            <li>추가 접근 통제와 2차 위험 확인</li>
            <li>사진·TBM·조치 기록을 같은 문서팩에 보관</li>
            <li>{data.riskSummary.immediateActions[0] || "재발방지 조치 담당자 지정"}</li>
          </ol>
        </div>
      </div>
    </section>
  );
}

function PhotoEvidenceDocumentCockpit({ data, documentKey }: { data: AskResponse; documentKey: DocumentKey }) {
  if (!isPhotoEvidenceDocumentKey(documentKey)) return null;
  const evidenceTargets = compactList(
    [
      data.riskSummary.topRisk,
      ...data.riskSummary.immediateActions,
      "TBM 참석·교육 확인"
    ],
    "작업 전·후 사진과 조치 확인",
    3
  );
  const capturePlan = compactList(
    [
      "작업 전 위험구역·보호구·통제 상태",
      "조치 후 개선상태·표지·차단 확인",
      "TBM·교육 참석 또는 모바일 기록"
    ],
    "작업 전·후 사진과 확인자 기록",
    3
  );
  const storageSignals = compactList(
    [
      "파일명에 공종·일자·위치 포함",
      "문서팩·작업일지·모바일 앱 보관 위치 기록",
      "확인자와 재점검 필요 여부 표시"
    ],
    "증빙 보관 위치와 확인자 기록",
    3
  );

  return (
    <section className={styles.tbmCockpit} data-testid="photo-document-cockpit" aria-label="사진 증빙 진행 요약">
      <div className={styles.tbmCockpitHeader}>
        <div>
          <span className="eyebrow">사진·증빙 cockpit</span>
          <strong>촬영 · 보관 · 연결 근거</strong>
        </div>
        <span>{data.scenario.siteName} · {data.scenario.workerCount.toLocaleString("ko-KR")}명</span>
      </div>
      <div className={styles.tbmCockpitGrid}>
        <article>
          <b>촬영 우선순위</b>
          <strong>{evidenceTargets[0]}</strong>
          <small>{capturePlan[0]}</small>
        </article>
        <article>
          <b>보관 확인</b>
          <strong>문서팩과 현장 기록 위치 연결</strong>
          <small>{storageSignals[0]}</small>
        </article>
      </div>
      <div className={styles.tbmCockpitColumns}>
        <div>
          <b>촬영 항목</b>
          <ol>
            {capturePlan.map((item) => <li key={item}>{item}</li>)}
          </ol>
        </div>
        <div>
          <b>연결 근거</b>
          <ol>
            {storageSignals.map((item) => <li key={item}>{item}</li>)}
          </ol>
        </div>
      </div>
    </section>
  );
}

function TransmissionDocumentCockpit({ data, documentKey }: { data: AskResponse; documentKey: DocumentKey }) {
  if (!isTransmissionDocumentKey(documentKey)) return null;
  const isForeignTransmission = documentKey === "foreignWorkerTransmission";
  const languages = compactList(
    data.deliverables.foreignWorkerLanguages.map((language) => `${language.label} / ${language.nativeLabel}`),
    "쉬운 한국어",
    3
  );
  const sourceMessage = isForeignTransmission ? data.deliverables.foreignWorkerTransmission : data.deliverables.kakaoMessage;
  const messageLines = compactList(
    sourceMessage.split(/\r?\n/u),
    data.riskSummary.topRisk,
    3
  );
  const channelFlow = isForeignTransmission
    ? ["대상 언어 확인", "짧은 전송본 복사", "관리자 확인 후 전파"]
    : ["단체방 붙여넣기", "TBM에서 다시 읽기", "작업 전 이해 확인"];

  return (
    <section className={styles.tbmCockpit} data-testid="transmission-document-cockpit" aria-label="전송 진행 요약">
      <div className={styles.tbmCockpitHeader}>
        <div>
          <span className="eyebrow">전송 cockpit</span>
          <strong>{isForeignTransmission ? "언어 · 대상 · 확인 흐름" : "공유 · 복창 · 시작 전 확인"}</strong>
        </div>
        <span>{isForeignTransmission ? `${languages.length.toLocaleString("ko-KR")}개 언어 우선` : "카카오·문자·밴드"}</span>
      </div>
      <div className={styles.tbmCockpitGrid}>
        <article>
          <b>{isForeignTransmission ? "언어 대상" : "전송 채널"}</b>
          <strong>{isForeignTransmission ? languages.join(" · ") : "현장 단체방 / 문자"}</strong>
          <small>{isForeignTransmission ? "최종 발송 전 통역·관리자 확인" : "실제 발송 전 현장 책임자 승인"}</small>
        </article>
        <article>
          <b>핵심 위험</b>
          <strong>{data.riskSummary.topRisk}</strong>
          <small>{data.riskSummary.immediateActions[0] || data.scenario.weatherNote}</small>
        </article>
      </div>
      <div className={styles.tbmCockpitColumns}>
        <div>
          <b>전송 전 확인</b>
          <ol>
            {channelFlow.map((item) => <li key={item}>{item}</li>)}
          </ol>
        </div>
        <div>
          <b>미리보기 핵심</b>
          <ol>
            {messageLines.map((item) => <li key={item}>{item}</li>)}
          </ol>
        </div>
      </div>
    </section>
  );
}

function inferDisasterType(text: string, index: number) {
  if (/추락|떨어|비계|고소|발판/.test(text)) return "추락";
  if (/전도|넘어|미끄|우천|바닥/.test(text)) return "전도/미끄럼";
  if (/충돌|지게차|동선|차량|운반/.test(text)) return "충돌/끼임";
  if (/화재|용접|화기|폭발/.test(text)) return "화재/폭발";
  if (/화학|중독|질식|밀폐|가스|노출/.test(text)) return "중독/노출";
  return index % 2 === 0 ? "협착/충돌" : "기타 재해";
}

function inferRiskFactor4M(text: string, index: number) {
  if (/지게차|장비|기계|비계|발판|공구|차량/.test(text)) return "Machine";
  if (/강풍|우천|폭염|날씨|바닥|밀폐|고소|작업장소/.test(text)) return "Media";
  if (/신규|미숙련|보호구|교육|작업자|근로자/.test(text)) return "Man";
  if (/작업중지|통제|감독|유도자|신호수|절차/.test(text)) return "Management";
  return ["Man", "Machine", "Media", "Management"][index % 4];
}

function inferEquipment(text: string, scenario: AskResponse["scenario"], index: number) {
  if (/지게차|운반|하역/.test(text)) return "지게차/운반장비";
  if (/비계|고소|발판/.test(text)) return "비계/작업발판";
  if (/용접|화기/.test(text)) return "용접기/화기장비";
  if (/화학|세척|약품/.test(text)) return "세척제/MSDS";
  if (/밀폐|가스|질식/.test(text)) return "가스측정기/환기설비";
  return index % 2 === 0 ? "작업장비/공도구" : scenario.companyType;
}

function buildPermitDraft(data: AskResponse) {
  const actionList = data.riskSummary.immediateActions.map((action, index) => `${index + 1}. ${action}`).join("\n");
  const weatherActions = data.externalData.weather.actions.slice(0, 2).map((action, index) => `${index + 1}. ${action}`).join("\n");
  return [
    "[1. 허가 기본정보]",
    `허가대상 작업: ${data.scenario.workSummary}`,
    `작업현장: ${data.scenario.siteName}`,
    `작업일시: ${new Date().toLocaleDateString("ko-KR")} 작업 전 확인`,
    `작업인원: ${data.scenario.workerCount.toLocaleString("ko-KR")}명`,
    "허가구분: 위험작업 / 작업계획서·위험성평가표 첨부 확인",
    "",
    "[2. 작업 전 허가조건]",
    `핵심위험: ${data.riskSummary.topRisk}`,
    `필수조치:\n${actionList}`,
    `기상·환경 확인:\n${weatherActions || data.scenario.weatherNote}`,
    "보호구: 안전모, 안전화, 작업특성별 보호구 착용 확인",
    "",
    "[3. 첨부서류 체크리스트]",
    "작업계획서: □ 첨부 □ 보완필요",
    "위험성평가표: □ 첨부 □ 보완필요",
    "TBM 참석명단: □ 첨부 □ 보완필요",
    "장비 제원/검사증/운전원 자격: □ 해당 □ 비해당 □ 보완필요",
    "MSDS/화기·밀폐·고소작업 별도 허가: □ 해당 □ 비해당 □ 보완필요",
    "사진/작업계획도/통제구역 표시: □ 첨부 □ 보완필요",
    "",
    "[4. 종료 확인]",
    "작업종료: □ 원상복구 □ 잔류위험 없음 □ 미조치사항 있음",
    "미조치사항 및 후속조치:",
    "종료 확인자:"
  ].join("\n");
}

function resolveInitialWorkPermitDraft(data: AskResponse) {
  if (data.deliverables.workPermitDraft === "") return "";
  return withSubmitReadiness(
    "허가서/첨부 안전작업허가 확인서",
    data.deliverables.workPermitDraft ?? buildPermitDraft(data),
    data
  );
}

function inferPermitType(data: AskResponse): PermitInspectionStructured["basicInfo"]["permitType"] {
  const text = `${data.question} ${data.scenario.workSummary} ${data.riskSummary.topRisk}`;
  if (/비계|고소|추락|지붕|외벽/.test(text)) return "고소작업";
  if (/용접|화기|절단|불꽃/.test(text)) return "화기작업";
  if (/밀폐|질식|산소|탱크|맨홀/.test(text)) return "밀폐공간";
  if (/전기|정전|감전|분전반/.test(text)) return "전기작업";
  if (/지게차|크레인|굴삭|중장비|하역/.test(text)) return "중장비작업";
  if (/화학|약품|MSDS|세척|누출/.test(text)) return "화학물질";
  return "일반 위험작업";
}

function conditionCategoryFromRisk(row: NonNullable<AskResponse["structured"]>["riskAssessmentRows"][number]): PermitInspectionStructured["conditions"][number]["category"] {
  if (row.fourM === "Machine") return "장비·동선";
  if (row.fourM === "Media") return "기상·환경";
  if (row.fourM === "Man") return "보호구";
  return "교육·TBM";
}

function primaryConditionCategory(permitType: PermitInspectionStructured["basicInfo"]["permitType"]): PermitInspectionStructured["conditions"][number]["category"] {
  if (permitType === "화기작업") return "화재·폭발";
  if (permitType === "밀폐공간") return "질식·가스";
  if (permitType === "고소작업") return "추락·낙하";
  return "장비·동선";
}

function buildPermitInspectionStructured(data: AskResponse): PermitInspectionStructured {
  const permitType = inferPermitType(data);
  const today = new Date().toLocaleDateString("ko-KR");
  const riskRows = data.structured?.riskAssessmentRows ?? [];
  const topRows = riskRows.slice(0, 4);
  const weatherActions = data.externalData.weather.actions.slice(0, 2);
  const immediateActions = data.riskSummary.immediateActions.slice(0, 3);
  const questionAndWork = `${data.question} ${data.scenario.workSummary}`;

  const conditions: PermitInspectionStructured["conditions"] = [
    {
      category: "작업구역",
      requirement: "작업구역 출입통제와 작업반경 표시",
      action: immediateActions[0] || "작업 전 위험구역을 표시하고 관계자 외 접근을 제한",
      owner: "작업반장",
      status: "확인 전",
      relatedRiskRowIndex: riskRows.length ? 0 : undefined,
      evidenceRefs: riskRows[0]?.evidenceRefs || ["위험성평가표"],
      verification: riskRows[0]?.verification || "작업 전 통제구역 사진과 TBM 복창으로 확인"
    },
    {
      category: primaryConditionCategory(permitType),
      requirement: `${permitType} 핵심 위험 사전 통제`,
      action: immediateActions[1] || data.riskSummary.topRisk,
      owner: "관리감독자",
      status: "확인 전",
      relatedRiskRowIndex: riskRows.length ? Math.min(1, riskRows.length - 1) : undefined,
      evidenceRefs: riskRows[Math.min(1, Math.max(0, riskRows.length - 1))]?.evidenceRefs || ["위험성평가표"],
      verification: riskRows[Math.min(1, Math.max(0, riskRows.length - 1))]?.verification || "관리감독자가 핵심 위험 조치 이행을 확인"
    },
    {
      category: "기상·환경",
      requirement: "기상 정보와 현장 체감 조건 확인",
      action: weatherActions.join(" / ") || data.scenario.weatherNote || "기상·현장 조건 확인 후 작업 여부 결정",
      owner: "안전관리자",
      status: "확인 전",
      relatedRiskRowIndex: riskRows.length ? Math.min(1, riskRows.length - 1) : undefined,
      evidenceRefs: riskRows[Math.min(1, Math.max(0, riskRows.length - 1))]?.evidenceRefs || ["기상청 현재·예보", "위험성평가표"],
      verification: "기상 신호와 현장 체감 조건을 함께 확인"
    },
    {
      category: "교육·TBM",
      requirement: "위험성평가 결과와 작업중지 기준 TBM 공유",
      action: immediateActions[2] || "작업 전 TBM에서 위험요인과 중지기준을 전원 확인",
      owner: "TBM 리더",
      status: "확인 전",
      relatedRiskRowIndex: riskRows.length ? Math.min(2, riskRows.length - 1) : undefined,
      evidenceRefs: riskRows[Math.min(2, Math.max(0, riskRows.length - 1))]?.evidenceRefs || ["TBM 기록", "위험성평가표"],
      verification: "TBM 참석자 서명과 구두 복창으로 확인"
    }
  ];

  topRows.forEach((row, index) => {
    conditions.push({
      category: conditionCategoryFromRisk(row),
      requirement: row.hazard,
      action: row.additionalControls,
      owner: row.owner || "담당자 지정",
      status: "확인 전",
      relatedRiskRowIndex: index,
      evidenceRefs: row.evidenceRefs,
      verification: row.verification
    });
  });

  return {
    basicInfo: {
      permitNo: "현장 발급",
      permitType,
      workName: data.scenario.workSummary || "작업명 확인",
      location: data.scenario.siteName || "작업장소 확인",
      workDate: today,
      workerCount: data.scenario.workerCount,
      requester: "작업반장",
      approver: "관리감독자"
    },
    conditions,
    attachments: [
      { name: "작업계획서", required: true, status: "첨부", note: "작업순서·장비·인원·중지기준 확인" },
      { name: "위험성평가표", required: true, status: riskRows.length ? "첨부" : "보완 필요", note: "유해·위험요인과 감소대책 확인" },
      { name: "TBM 참석명단", required: true, status: "보완 필요", note: "작업 전 공유 후 참석자 서명" },
      { name: "장비 제원/검사증/운전원 자격", required: /중장비|지게차|크레인|장비/.test(questionAndWork), status: "보완 필요", note: "해당 장비 사용 시 첨부" },
      { name: "MSDS/화기·밀폐·고소작업 별도 확인", required: permitType !== "일반 위험작업", status: "보완 필요", note: `${permitType} 조건 확인` },
      { name: "사진/작업계획도/통제구역 표시", required: true, status: "보완 필요", note: "작업 전·후 증빙 보관" }
    ],
    completionChecks: [
      { item: "작업구역 원상복구", method: "통제선·잔재물·공도구 회수 사진 확인", owner: "작업반장", status: "확인 전" },
      { item: "잔류위험 확인", method: "미조치 위험요인 여부를 관리감독자가 확인", owner: "관리감독자", status: "확인 전" },
      { item: "교육·TBM 기록 보관", method: "참석자 서명과 사진증빙 보관 위치 기록", owner: "안전관리자", status: "확인 전" }
    ],
    approvers: {
      requester: "작업반장",
      safetyManager: "안전관리자",
      siteManager: "현장소장",
      completionChecker: "종료 확인자"
    }
  };
}

function withSubmitReadiness(title: string, body: string, data: AskResponse) {
  const readinessLabel = `서식상태: 준제출형 - ${title} 제출 필수 항목을 반영한 현장 검토용입니다.`;
  if (body.includes(readinessLabel) && body.includes("[필수 확인 항목]")) {
    return body;
  }
  const references = data.externalData.kosha.references.map((item) => item.title).join(" / ");
  return [
    "[제출상태]",
    readinessLabel,
    "원본 재현 한계: 발주처 지정 직인, 허가번호, 결재선, 표 병합 레이아웃은 제출 전 원본 양식으로 확인 필요",
    "",
    "[필수 확인 항목]",
    `기상: ${data.externalData.weather.summary || data.scenario.weatherNote}`,
    `위험요인: ${data.riskSummary.topRisk}`,
    "확인/서명란: 작성자 / 관리감독자 / 안전관리자 / 현장책임자",
    `근거 반영: ${references || "공식 근거 확인 필요"}`,
    "증빙: 사진/영상 증빙, 참석자 서명, 개선조치 전후 기록",
    "",
    "[제출 본문]",
    body
  ].join("\n");
}

function getSafetyFormProfile(key: DocumentKey): SafetyFormProfile {
  if (key === "riskAssessmentDraft") {
    return {
      code: "SC-RISK-01",
      subtitle: "위험성평가 및 감소대책 확인서",
      layout: "risk",
      primaryColumn: "위험요인",
      actionColumn: "감소대책 / 잔여위험",
      confirmationRows: ["위험요인 확인", "감소대책 담당 지정", "작업 전 공유", "잔여위험 승인"],
      approvalLabels: ["작성", "검토", "승인"]
    };
  }

  if (key === "workPlanDraft") {
    return {
      code: "SC-WP-01",
      subtitle: "작업계획서 및 작업순서 확인서",
      layout: "workPlan",
      primaryColumn: "작업계획 항목",
      actionColumn: "작성 내용 / 기준",
      confirmationRows: ["작업구간 확인", "작업순서 확인", "장비·인원 확인", "작업중지 기준 공유"],
      approvalLabels: ["작성", "검토", "승인"]
    };
  }

  if (key === "workPermitDraft") {
    return {
      code: "SC-PTW-01",
      subtitle: "허가서/첨부 및 위험작업 종료 확인서",
      layout: "permit",
      primaryColumn: "허가 항목",
      actionColumn: "확인 내용 / 조건",
      confirmationRows: ["허가대상 확인", "격리·차단 확인", "보호구 확인", "종료 확인"],
      approvalLabels: ["신청", "허가", "종료"]
    };
  }

  if (key === "tbmLogDraft") {
    return {
      code: "SC-TBM-01",
      subtitle: "TBM 일지 및 작업 전 안전점검 회의록",
      layout: "tbmLog",
      primaryColumn: "점검/논의 항목",
      actionColumn: "전달 내용 / 조치",
      confirmationRows: ["보호구 확인", "건강상태 확인", "음주 여부 확인", "참석자 확인"],
      approvalLabels: ["담당", "소장"]
    };
  }

  if (key === "tbmBriefing") {
    return {
      code: "SC-TBM-01",
      subtitle: "TBM 및 작업 전 안전점검 회의록",
      layout: "tbmBriefing",
      primaryColumn: "점검/논의 항목",
      actionColumn: "전달 내용 / 조치",
      confirmationRows: ["작업내용 공유", "위험요인 전달", "작업중지 기준 확인", "참석자 확인"],
      approvalLabels: ["진행", "관리감독", "보관"]
    };
  }

  if (key === "safetyEducationRecordDraft" || key === "foreignWorkerBriefing") {
    return {
      code: "SC-EDU-01",
      subtitle: "안전보건교육 실시 및 이해 확인서",
      layout: "education",
      primaryColumn: "교육 항목",
      actionColumn: "교육 내용 / 확인 방법",
      confirmationRows: ["교육대상 확인", "교육자료 사용", "이해도 확인", "추가교육 필요성"],
      approvalLabels: ["교육자", "확인자", "보관"]
    };
  }

  return {
    code: "SC-WP-01",
    subtitle: "SafeClaw 현장 안전문서 확인서",
    layout: key === "photoEvidenceDraft" ? "photo" : "generic",
    primaryColumn: "항목",
    actionColumn: "내용 / 조치",
    confirmationRows: ["현장조건 확인", "담당자 확인", "작업 전 공유", "보관 위치 확인"],
    approvalLabels: ["작성", "확인", "보관"]
  };
}

function formCss(pageMargin = "36px") {
  return `
    body { margin: 0; background: #fafafb; color: #1a1b1e; font-family: "Malgun Gothic", "Apple SD Gothic Neo", "Noto Sans KR", sans-serif; font-size: 10pt; font-weight: 400; line-height: 15pt; letter-spacing: 0; }
    .safety-form-page { max-width: 1080px; margin: ${pageMargin} auto; background: #ffffff; border: 1px solid #e6e8eb; border-radius: 12px; box-shadow: none; overflow: hidden; }
    .form-head { display: grid; grid-template-columns: 1fr 240px; border-bottom: 1px solid #e6e8eb; }
    .form-title { padding: 20px 24px; }
    .form-title span { display: inline-block; margin-bottom: 8px; color: #5c6169; font-size: 8pt; font-weight: 400; line-height: 11pt; letter-spacing: 0; }
    .form-title h1 { margin: 0; font-size: 20pt; font-weight: 700; line-height: 24pt; letter-spacing: -0.02em; }
    .form-title p { margin: 8px 0 0; color: #5c6169; font-size: 8pt; font-weight: 400; line-height: 11pt; letter-spacing: 0; }
    .approval-grid { display: grid; grid-template-columns: repeat(var(--approval-count, 3), 1fr); border-left: 1px solid #e6e8eb; }
    .approval-cell { display: grid; grid-template-rows: 34px 1fr; min-height: 108px; border-left: 1px solid #e6e8eb; text-align: center; }
    .approval-cell:first-child { border-left: 0; }
    .approval-cell b { display: grid; place-items: center; background: #f4f5f7; border-bottom: 1px solid #e6e8eb; font-size: 8.5pt; font-weight: 700; line-height: 12pt; letter-spacing: 0; }
    .approval-cell em { display: grid; place-items: end center; padding-bottom: 12px; color: #8a8f98; font-size: 8pt; font-weight: 400; line-height: 11pt; letter-spacing: 0; font-style: normal; }
    .meta-grid { display: grid; grid-template-columns: repeat(4, 1fr); border-bottom: 1px solid #e6e8eb; }
    .meta-item { min-height: 58px; border-right: 1px solid #e6e8eb; }
    .meta-item:last-child { border-right: 0; }
    .meta-item b { display: block; padding: 7px 10px; background: #f4f5f7; color: #5c6169; font-size: 8.5pt; font-weight: 700; line-height: 12pt; letter-spacing: 0; }
    .meta-item span { display: block; padding: 10px; font-size: 10pt; font-weight: 400; line-height: 15pt; letter-spacing: 0; }
    .check-grid { display: grid; grid-template-columns: repeat(4, 1fr); border-bottom: 1px solid #e6e8eb; }
    .check-grid div { padding: 10px; border-right: 1px solid #e6e8eb; font-size: 8.5pt; font-weight: 400; line-height: 12pt; letter-spacing: 0; }
    .check-grid div:last-child { border-right: 0; }
    .section-block { padding: 18px 22px 4px; }
    .section-label { display: inline-flex; align-items: center; min-height: 30px; margin-bottom: 10px; padding: 5px 12px; border: 1px solid #e6e8eb; border-radius: 8px; background: #f4f5f7; color: #1a1b1e; font-size: 14pt; font-weight: 700; line-height: 18pt; letter-spacing: -0.01em; }
    table { width: 100%; border-collapse: collapse; table-layout: fixed; margin-bottom: 16px; }
    th, td { border: 1px solid #e6e8eb; padding: 9px 10px; vertical-align: top; word-break: keep-all; font-size: 8.5pt; font-weight: 400; line-height: 12pt; letter-spacing: 0; font-variant-numeric: tabular-nums; }
    th { background: #f4f5f7; color: #1a1b1e; font-weight: 700; text-align: center; }
    .center { text-align: center; }
    .check-cell { text-align: center; color: #5c6169; font-weight: 700; }
    .signature-grid { display: grid; grid-template-columns: repeat(4, 1fr); margin: 10px 22px 22px; border: 1px solid #e6e8eb; border-radius: 8px; overflow: hidden; }
    .signature-grid div { min-height: 62px; padding: 9px 10px; border-right: 1px solid #e6e8eb; font-size: 8.5pt; font-weight: 400; line-height: 12pt; letter-spacing: 0; }
    .signature-grid div:last-child { border-right: 0; }
    .signature-grid b { display: block; margin-bottom: 18px; }
    .form-note { margin: 0 22px 22px; color: #5c6169; font-size: 8pt; font-weight: 400; line-height: 11pt; letter-spacing: 0; }
    .section-help { margin: 0 0 10px; color: #5c6169; font-size: 8pt; font-weight: 400; line-height: 11pt; letter-spacing: 0; }
    .mini-table th { background: #f4f5f7; color: #1a1b1e; }
    .form-layout-risk .form-title span,
    .form-layout-workPlan .form-title span,
    .form-layout-permit .form-title span,
    .form-layout-tbmBriefing .form-title span,
    .form-layout-tbmLog .form-title span { color: #6c6ff7; background: transparent; }
    .form-layout-risk .check-grid div { background: #fff8f7; }
    .form-layout-workPlan .check-grid div { background: #f8f9ff; }
    .form-layout-permit .check-grid div { background: #fffaf0; }
    .form-layout-tbmBriefing .meta-item b, .form-layout-tbmBriefing .mini-table th,
    .form-layout-tbmLog .meta-item b, .form-layout-tbmLog .mini-table th { background: #f4f5f7; color: #1a1b1e; }
    .form-layout-tbmBriefing .check-grid div, .form-layout-tbmLog .check-grid div { background: #f8fbf9; }
    .form-lineage { margin: 0; padding: 10px 22px; border-bottom: 1px solid #e6e8eb; background: #f8f9fb; color: #5c6169; font-size: 8pt; font-weight: 400; line-height: 11pt; letter-spacing: 0; }
    .risk-table th, .risk-table td { padding: 7px 6px; }
    .risk-level-high { background: #ffe3df; font-weight: 900; color: #a83224; }
    .permit-check td:nth-child(2), .permit-check td:nth-child(3) { text-align: center; font-weight: 900; }
    .attendee-table td { height: 42px; }
    .tbm-daily-table th, .tbm-daily-table td { padding: 6px 5px; }
    .tbm-check-list td:first-child { width: 28%; font-weight: 800; background: #f8f9fb; }
    .tbm-two-column td { min-height: 92px; }
    .tbm-attendance th, .tbm-attendance td { text-align: center; padding: 5px 4px; }
    .tbm-attendance td:nth-child(3), .tbm-attendance td:nth-child(9) { text-align: left; }
    @media print { body { background: #ffffff; } .safety-form-page { margin: 0; box-shadow: none; max-width: none; border-radius: 0; } }
  `;
}

const documentPreviewCss = `
  .document-print-typography { font-family: "Malgun Gothic", "Apple SD Gothic Neo", "Noto Sans KR", sans-serif; font-size: 10pt; font-weight: 400; line-height: 15pt; letter-spacing: 0; }
  .document-print-typography .safety-form-preview-head strong { font-family: inherit; font-size: 20pt; font-weight: 700; line-height: 24pt; letter-spacing: -0.02em; }
  .document-print-typography .safety-form-bridge h3,
  .document-print-typography .safety-form-section-stack h3 { font-family: inherit; font-size: 14pt; font-weight: 700; line-height: 18pt; letter-spacing: -0.01em; }
  .document-print-typography .safety-form-meta-grid span { font-family: inherit; font-size: 10pt; font-weight: 400; line-height: 15pt; letter-spacing: 0; }
  .document-print-typography th,
  .document-print-typography td { font-family: inherit; font-size: 8.5pt; font-weight: 400; line-height: 12pt; letter-spacing: 0; font-variant-numeric: tabular-nums; }
  .document-print-typography th { font-weight: 700; }
  .document-print-typography .safety-form-preview-head small,
  .document-print-typography .safety-form-preview-head span { font-size: 8pt; font-weight: 400; line-height: 11pt; letter-spacing: 0; font-family: inherit; }
  .document-print-typography .approval-preview b { font-size: 8.5pt; font-weight: 700; line-height: 12pt; letter-spacing: 0; font-family: inherit; }
  .document-print-typography .approval-preview em { font-size: 8pt; font-weight: 400; line-height: 11pt; letter-spacing: 0; font-family: inherit; }
  .document-print-typography .safety-form-meta-grid b { font-size: 8.5pt; font-weight: 700; line-height: 12pt; letter-spacing: 0; font-family: inherit; }
  .document-print-typography .safety-form-check-row span { font-size: 8.5pt; font-weight: 400; line-height: 12pt; letter-spacing: 0; font-family: inherit; }
  .document-print-typography .safety-form-signatures span { font-size: 8.5pt; font-weight: 400; line-height: 12pt; letter-spacing: 0; font-family: inherit; }
  .safeclaw-module-shell.module-variant-document .document-editor .submission-preview-panel .safety-form-preview.document-print-typography .safety-form-preview-head strong { letter-spacing: -0.02em; }
  .safeclaw-module-shell.module-variant-document .document-editor .submission-preview-panel .safety-form-preview.document-print-typography .safety-form-bridge h3,
  .safeclaw-module-shell.module-variant-document .document-editor .submission-preview-panel .safety-form-preview.document-print-typography .safety-form-section-stack h3 { letter-spacing: -0.01em; }
  .safeclaw-module-shell.module-variant-document .safeclaw-module-content .document-print-typography .safety-form-preview-head small,
  .safeclaw-module-shell.module-variant-document .safeclaw-module-content .document-print-typography .safety-form-preview-head span { line-height: 11pt; }
`;

function buildGenericSections(rows: SheetRow[], profile: SafetyFormProfile) {
  return groupSubmissionPreviewRows(rows).map((group) => `
    <section class="section-block">
      <div class="section-label">${escapeHtml(group.section)}</div>
      <table>
        <colgroup><col style="width: 7%;" /><col style="width: 21%;" /><col style="width: 52%;" /><col style="width: 20%;" /></colgroup>
        <thead><tr><th>번호</th><th>${escapeHtml(profile.primaryColumn)}</th><th>${escapeHtml(profile.actionColumn)}</th><th>확인/담당</th></tr></thead>
        <tbody>
          ${group.rows.map((row, index) => `<tr><td class="center">${index + 1}</td><td>${escapeHtml(row.item)}</td><td>${escapeHtml(row.content)}</td><td class="check-cell">□ 확인<br />담당: ______</td></tr>`).join("")}
        </tbody>
      </table>
    </section>
  `).join("");
}

function buildRiskAssessmentSections(rows: SheetRow[], scenario: AskResponse["scenario"]) {
  const hazardRows = findRows(rows, ["위험", "추락", "전도", "충돌", "화재", "중독", "끼임"], 4);
  const controlRows = findRows(rows, ["조치", "대책", "점검", "통제", "작업중지"], 4);
  const controlFor = (index: number) => compactContent(controlRows[index] || controlRows[0], "작업 전 통제대책을 지정하고 이행 여부를 확인");
  return `
    <section class="section-block">
      <div class="section-label">1. 사전준비</div>
      <table class="mini-table">
        <colgroup><col style="width: 16%;" /><col style="width: 34%;" /><col style="width: 16%;" /><col style="width: 34%;" /></colgroup>
        <tbody>
          <tr><th>평가대상 작업</th><td>${escapeHtml(scenario.workSummary)}</td><th>평가방법</th><td>4M + 가능성·중대성 판단</td></tr>
          <tr><th>작업장소</th><td>${escapeHtml(scenario.siteName)}</td><th>참여자</th><td>관리감독자, 작업반장, 근로자 대표</td></tr>
          <tr><th>작업조건</th><td>${escapeHtml(scenario.weatherNote)}</td><th>검토자료</th><td>작업계획서, TBM, KOSHA 자료, 법령 근거</td></tr>
        </tbody>
      </table>
    </section>
    <section class="section-block">
      <div class="section-label">2. 유해·위험요인 파악 및 위험성 결정</div>
      <p class="section-help">제공 서식 기준에 맞춰 단위공종, 작업장소, 사용 장비, 재해형태, 가능성·중대성·등급을 분리합니다.</p>
      <table class="risk-table">
        <colgroup>
          <col style="width: 8%;" /><col style="width: 10%;" /><col style="width: 10%;" /><col style="width: 8%;" />
          <col style="width: 18%;" /><col style="width: 8%;" /><col style="width: 6%;" /><col style="width: 6%;" />
          <col style="width: 6%;" /><col style="width: 20%;" />
        </colgroup>
        <thead><tr><th>단위공종</th><th>작업장소</th><th>장비/도구</th><th>4M</th><th>유해·위험요인</th><th>재해형태</th><th>가능성</th><th>중대성</th><th>등급</th><th>현재 안전조치</th></tr></thead>
        <tbody>
          ${hazardRows.map((row, index) => {
            const text = rowText(row);
            return `<tr>
            <td>${escapeHtml(scenario.workSummary)}</td>
            <td>${escapeHtml(scenario.siteName)}</td>
            <td>${escapeHtml(inferEquipment(text, scenario, index))}</td>
            <td class="center">${escapeHtml(inferRiskFactor4M(text, index))}</td>
            <td>${escapeHtml(compactContent(row, "작업 중 유해·위험요인"))}</td>
            <td>${escapeHtml(inferDisasterType(text, index))}</td>
            <td class="center">중</td>
            <td class="center">상</td>
            <td class="center risk-level-high">상</td>
            <td>${escapeHtml(controlFor(index))}</td>
          </tr>`;
          }).join("")}
        </tbody>
      </table>
    </section>
    <section class="section-block">
      <div class="section-label">3. 감소대책 수립·실행 및 이행확인</div>
      <table>
        <colgroup><col style="width: 32%;" /><col style="width: 28%;" /><col style="width: 14%;" /><col style="width: 12%;" /><col style="width: 14%;" /></colgroup>
        <thead><tr><th>추가 감소대책</th><th>확인 근거/증빙</th><th>조치담당자</th><th>조치기한</th><th>확인자 서명</th></tr></thead>
        <tbody>
          ${controlRows.map((row, index) => `<tr><td>${escapeHtml(compactContent(row, "감소대책"))}</td><td>TBM 공유, 사진/점검 기록, 작업 전 확인</td><td>작업반장</td><td>작업 전</td><td>________</td></tr>`).join("")}
        </tbody>
      </table>
    </section>
    <section class="section-block">
      <div class="section-label">4. 위험성평가 회의록 및 재평가 기준</div>
      <table>
        <colgroup><col style="width: 20%;" /><col style="width: 30%;" /><col style="width: 20%;" /><col style="width: 30%;" /></colgroup>
        <tbody>
          <tr><th>회의일시</th><td>____년 ____월 ____일 ____시</td><th>참석대상</th><td>관리감독자, 작업반장, 작업자 대표</td></tr>
          <tr><th>재평가 사유</th><td>공법·장비·인원·기상 조건 변경</td><th>재평가 기준</th><td>상 등급 잔류위험 또는 작업중지 발생 시</td></tr>
          <tr><th>주요 결정</th><td colspan="3">□ 감소대책 이행 후 작업 □ 보완 후 재평가 □ 작업중지 유지</td></tr>
        </tbody>
      </table>
    </section>
    <section class="section-block">
      <div class="section-label">5. 공유·교육 및 조치 확인</div>
      <table>
        <thead><tr><th>공유 대상</th><th>공유 방법</th><th>이해 확인</th><th>미조치/재평가 필요</th></tr></thead>
        <tbody><tr><td>투입 근로자 전원</td><td>작업 전 TBM 및 안전보건교육</td><td>구두 복창·서명</td><td>□ 없음 □ 있음: ____________________</td></tr></tbody>
      </table>
    </section>
  `;
}

function buildWorkPlanSections(rows: SheetRow[], scenario: AskResponse["scenario"]) {
  const sequenceRows = findRows(rows, ["순서", "작업", "구간", "장비", "인원"], 5);
  const stopRows = findRows(rows, ["중지", "강풍", "우천", "위험", "비상"], 3);
  return `
    <section class="section-block">
      <div class="section-label">1. 작업개요 및 관리자 지정</div>
      <table class="mini-table">
        <tbody>
          <tr><th>공사명/현장</th><td>${escapeHtml(scenario.siteName)}</td><th>해당 작업</th><td>${escapeHtml(scenario.workSummary)}</td></tr>
          <tr><th>작업업체</th><td>${escapeHtml(scenario.companyName)}</td><th>작업인원</th><td>${scenario.workerCount.toLocaleString("ko-KR")}명</td></tr>
          <tr><th>작업일시</th><td>____년 ____월 ____일 ____시</td><th>작업지휘자</th><td>성명/연락처: ____________________</td></tr>
        </tbody>
      </table>
    </section>
    <section class="section-block">
      <div class="section-label">2. 세부 작업순서</div>
      <table>
        <colgroup><col style="width: 8%;" /><col style="width: 24%;" /><col style="width: 38%;" /><col style="width: 16%;" /><col style="width: 14%;" /></colgroup>
        <thead><tr><th>번호</th><th>세부작업</th><th>작업방법/안전관리대책</th><th>담당</th><th>확인</th></tr></thead>
        <tbody>
          ${sequenceRows.map((row, index) => `<tr><td class="center">${index + 1}</td><td>${escapeHtml(row.item)}</td><td>${escapeHtml(row.content)}</td><td>작업반장</td><td>□</td></tr>`).join("")}
        </tbody>
      </table>
    </section>
    <section class="section-block">
      <div class="section-label">3. 장비·인원·첨부서류 확인</div>
      <table class="permit-check">
        <thead><tr><th>확인 항목</th><th>해당</th><th>첨부/확인</th><th>비고</th></tr></thead>
        <tbody>
          <tr><td>장비 제원표, 검사증, 운전원 자격</td><td>□</td><td>□</td><td>해당 장비 사용 시 첨부</td></tr>
          <tr><td>위험성평가표 및 TBM 참석명단</td><td>■</td><td>□</td><td>작업 전 최종본 확인</td></tr>
          <tr><td>작업계획도, 통제구역, 유도자 배치도</td><td>□</td><td>□</td><td>현장 게시 권장</td></tr>
          <tr><td>보험·자격·이수증·사업자등록 등 기본 서류</td><td>□</td><td>□</td><td>발주자/원청 요구 시 첨부</td></tr>
          <tr><td>MSDS, 안전인증서, 안전검사합격증</td><td>□</td><td>□</td><td>화학물질·장비 사용 시 첨부</td></tr>
        </tbody>
      </table>
    </section>
    <section class="section-block">
      <div class="section-label">4. 작업중지 기준 및 비상대응</div>
      <table>
        <thead><tr><th>중지 기준</th><th>판단자</th><th>전파 방법</th><th>재개 조건</th></tr></thead>
        <tbody>
          ${stopRows.map((row) => `<tr><td>${escapeHtml(compactContent(row, scenario.weatherNote))}</td><td>관리감독자</td><td>TBM/문자/무전</td><td>위험요인 제거 후 재확인</td></tr>`).join("")}
        </tbody>
      </table>
    </section>
    <section class="section-block">
      <div class="section-label">5. 작업계획도 및 역할 지정</div>
      <table>
        <colgroup><col style="width: 18%;" /><col style="width: 32%;" /><col style="width: 18%;" /><col style="width: 32%;" /></colgroup>
        <tbody>
          <tr><th>작업계획도</th><td>□ 첨부 □ 현장 게시 □ 보완 필요</td><th>통제구역</th><td>□ 표시 □ 접근금지 □ 유도자 배치</td></tr>
          <tr><th>작업지휘자</th><td>성명/연락처: ____________________</td><th>유도자/신호수</th><td>성명/연락처: ____________________</td></tr>
          <tr><th>운전원/장비담당</th><td>자격·면허 확인: □</td><th>감시자</th><td>위험작업 해당 시 지정: □</td></tr>
        </tbody>
      </table>
    </section>
  `;
}

function buildPermitSections(rows: SheetRow[], scenario: AskResponse["scenario"]) {
  const permitRows = findRows(rows, ["허가", "작업", "핵심", "보호구", "첨부", "종료"], 6);
  return `
    <section class="section-block">
      <div class="section-label">1. 허가 기본정보</div>
      <table class="mini-table">
        <tbody>
          <tr><th>허가번호</th><td>PTW-${new Date().getFullYear()}-____</td><th>작업명</th><td>${escapeHtml(scenario.workSummary)}</td></tr>
          <tr><th>작업장소</th><td>${escapeHtml(scenario.siteName)}</td><th>작업시간</th><td>____:____ ~ ____:____</td></tr>
          <tr><th>신청자</th><td>____________________</td><th>허가자</th><td>____________________</td></tr>
        </tbody>
      </table>
    </section>
    <section class="section-block">
      <div class="section-label">2. 작업 전 허가조건</div>
      <table class="permit-check">
        <thead><tr><th>확인 항목</th><th>적합</th><th>보완</th><th>확인 내용</th></tr></thead>
        <tbody>
          ${permitRows.slice(0, 4).map((row) => `<tr><td>${escapeHtml(row.item)}</td><td>□</td><td>□</td><td>${escapeHtml(row.content)}</td></tr>`).join("")}
        </tbody>
      </table>
    </section>
    <section class="section-block">
      <div class="section-label">3. 첨부서류 체크리스트</div>
      <table class="permit-check">
        <thead><tr><th>첨부서류</th><th>해당</th><th>첨부</th><th>비고</th></tr></thead>
        <tbody>
          <tr><td>작업계획서</td><td>■</td><td>□</td><td>작업순서·장비·인원 포함</td></tr>
          <tr><td>위험성평가표</td><td>■</td><td>□</td><td>감소대책·담당·기한 포함</td></tr>
          <tr><td>TBM 참석명단/교육기록</td><td>■</td><td>□</td><td>성명·소속·직위·서명</td></tr>
          <tr><td>장비 검사증/자격증/MSDS/작업계획도</td><td>□</td><td>□</td><td>해당 작업 시 첨부</td></tr>
          <tr><td>보험가입증명·자격/면허·안전교육 이수증</td><td>□</td><td>□</td><td>원청 제출 요구 시 첨부</td></tr>
          <tr><td>작업반경도·인양능력표·정비/점검 이력</td><td>□</td><td>□</td><td>장비·중량물 작업 시 첨부</td></tr>
        </tbody>
      </table>
    </section>
    <section class="section-block">
      <div class="section-label">4. 종료 확인</div>
      <table><thead><tr><th>종료 상태</th><th>잔류위험</th><th>원상복구</th><th>종료 확인자</th></tr></thead><tbody><tr><td>□ 완료 □ 중단</td><td>□ 없음 □ 있음</td><td>□ 확인</td><td>성명/서명: __________</td></tr></tbody></table>
    </section>
  `;
}

function buildEducationSections(rows: SheetRow[], scenario: AskResponse["scenario"]) {
  const educationRows = findRows(rows, ["교육", "보호구", "위험", "확인", "이해", "작업중지"], 6);
  return `
    <section class="section-block">
      <div class="section-label">1. 교육 실시 개요</div>
      <table class="mini-table">
        <tbody>
          <tr><th>교육명</th><td>${escapeHtml(scenario.workSummary)} 작업 전 안전보건교육</td><th>교육일시</th><td>____년 ____월 ____일 ____시</td></tr>
          <tr><th>교육장소</th><td>${escapeHtml(scenario.siteName)}</td><th>교육대상</th><td>투입 근로자 ${scenario.workerCount.toLocaleString("ko-KR")}명</td></tr>
          <tr><th>교육자</th><td>관리감독자 / 작업반장</td><th>교육방법</th><td>TBM, 현장 시연, 구두 이해 확인</td></tr>
        </tbody>
      </table>
    </section>
    <section class="section-block">
      <div class="section-label">2. 교육 내용 및 이해 확인</div>
      <table>
        <colgroup><col style="width: 8%;" /><col style="width: 24%;" /><col style="width: 38%;" /><col style="width: 15%;" /><col style="width: 15%;" /></colgroup>
        <thead><tr><th>번호</th><th>교육 항목</th><th>주요 내용</th><th>확인 방법</th><th>추가교육</th></tr></thead>
        <tbody>
          ${educationRows.map((row, index) => `<tr><td class="center">${index + 1}</td><td>${escapeHtml(row.item)}</td><td>${escapeHtml(row.content)}</td><td>□ 질문 □ 복창 □ 서명</td><td>□ 필요 □ 불필요</td></tr>`).join("")}
        </tbody>
      </table>
    </section>
    <section class="section-block">
      <div class="section-label">3. 교육 참석자 확인</div>
      <table class="attendee-table">
        <thead><tr><th>번호</th><th>성명</th><th>소속</th><th>역할/직종</th><th>언어</th><th>서명</th></tr></thead>
        <tbody>
          ${Array.from({ length: Math.max(4, Math.min(10, scenario.workerCount)) }, (_, index) => `<tr><td class="center">${index + 1}</td><td></td><td></td><td></td><td>한국어</td><td></td></tr>`).join("")}
        </tbody>
      </table>
    </section>
    <section class="section-block">
      <div class="section-label">4. 미이해자 및 후속 조치</div>
      <table><thead><tr><th>대상자</th><th>미이해 내용</th><th>재교육 방법</th><th>완료 확인</th></tr></thead><tbody><tr><td></td><td></td><td></td><td>□ 완료 □ 추적</td></tr></tbody></table>
    </section>
  `;
}

function buildTbmLogSections(rows: SheetRow[], scenario: AskResponse["scenario"]) {
  const agendaRows = findRows(rows, ["위험", "조치", "확인", "보호구", "작업중지", "질문"], 5);
  const dailyRiskText = agendaRows.slice(0, 3).map((row) => compactContent(row, "금일 위험요인")).join("<br />");
  const educationText = agendaRows.slice(0, 4).map((row, index) => `${index + 1}. ${escapeHtml(row.item)} - ${escapeHtml(row.content)}`).join("<br />");
  const attendeeHalf = Math.max(10, Math.min(20, Math.ceil(scenario.workerCount / 2)));
  const attendanceRows = Array.from({ length: attendeeHalf }, (_, index) => {
    const leftNo = index + 1;
    const rightNo = index + attendeeHalf + 1;
    return `<tr>
      <td>${leftNo}</td><td></td><td></td><td>□</td><td>□</td><td></td>
      <td>${rightNo}</td><td></td><td></td><td>□</td><td>□</td><td></td>
    </tr>`;
  }).join("");
  return `
    <section class="section-block">
      <div class="section-label">1. TBM 일지 기본정보</div>
      <table class="mini-table tbm-daily-table">
        <tbody>
          <tr><th>공종</th><td>${escapeHtml(scenario.workSummary)}</td><th>일자</th><td>____년 ____월 ____일</td></tr>
          <tr><th>현장</th><td>${escapeHtml(scenario.siteName)}</td><th>작업인원</th><td>${scenario.workerCount.toLocaleString("ko-KR")}명</td></tr>
          <tr><th>진행자</th><td>작업반장 / 관리감독자</td><th>기상·조건</th><td>${escapeHtml(scenario.weatherNote)}</td></tr>
        </tbody>
      </table>
    </section>
    <section class="section-block">
      <div class="section-label">2. 근로자 확인 사항</div>
      <table class="tbm-check-list">
        <tbody>
          <tr><td>개인 보호구 착용 상태</td><td>□ 안전모 □ 안전화 □ 각반 □ 복장 □ 턱끈 □ 작업별 보호구</td></tr>
          <tr><td>건강상태</td><td>□ 고혈압 □ 당뇨 □ 어지러움 □ 근골격계 통증 □ 기타 질병/이상 없음</td></tr>
          <tr><td>음주 여부</td><td>□ 이상 없음 □ 확인 필요: ____________________</td></tr>
        </tbody>
      </table>
    </section>
    <section class="section-block">
      <div class="section-label">3. 금일 작업사항 및 위험요인</div>
      <table class="tbm-two-column">
        <colgroup><col style="width: 50%;" /><col style="width: 50%;" /></colgroup>
        <thead><tr><th>금일 작업사항</th><th>금일 위험요인</th></tr></thead>
        <tbody><tr><td>${escapeHtml(scenario.workSummary)}</td><td>${dailyRiskText || "작업 전 위험요인 확인 및 공유"}</td></tr></tbody>
      </table>
    </section>
    <section class="section-block">
      <div class="section-label">4. 일일 안전교육 및 전달사항</div>
      <table>
        <tbody><tr><td>${educationText || "작업 전 안전교육, 작업중지 기준, 비상연락체계를 전달하고 이해 여부를 확인합니다."}</td></tr></tbody>
      </table>
    </section>
    <section class="section-block">
      <div class="section-label">5. 참석자 명단</div>
      <table class="tbm-attendance">
        <colgroup>
          <col style="width: 5%;" /><col style="width: 9%;" /><col style="width: 14%;" /><col style="width: 6%;" /><col style="width: 6%;" /><col style="width: 10%;" />
          <col style="width: 5%;" /><col style="width: 9%;" /><col style="width: 14%;" /><col style="width: 6%;" /><col style="width: 6%;" /><col style="width: 10%;" />
        </colgroup>
        <thead><tr><th>연번</th><th>직종</th><th>성명</th><th>오전</th><th>오후</th><th>비고</th><th>연번</th><th>직종</th><th>성명</th><th>오전</th><th>오후</th><th>비고</th></tr></thead>
        <tbody>
          ${attendanceRows}
        </tbody>
      </table>
    </section>
    <section class="section-block">
      <div class="section-label">6. 인원 집계 및 확인자</div>
      <table class="tbm-daily-table">
        <thead><tr><th>분류</th><th>인원</th><th>담당</th><th>비고</th></tr></thead>
        <tbody>
          <tr><td>근로자</td><td>${scenario.workerCount.toLocaleString("ko-KR")}명</td><td>담당자</td><td></td></tr>
          <tr><td>관리자</td><td></td><td>현장소장</td><td></td></tr>
        </tbody>
      </table>
    </section>
    <section class="section-block">
      <div class="section-label">7. 미조치 및 사진·영상 증빙</div>
      <table><thead><tr><th>미조치 위험요인</th><th>후속조치</th><th>사진/영상 파일명</th><th>확인자</th></tr></thead><tbody><tr><td></td><td></td><td></td><td></td></tr></tbody></table>
    </section>
  `;
}

function buildTbmBriefingSections(rows: SheetRow[], scenario: AskResponse["scenario"], data: AskResponse, riskRows: SheetRow[]) {
  const bridgeRows = buildTbmBridgeRows(data, riskRows.length ? riskRows : rows);
  const questionRows = findRows(rows, ["질문", "확인", "누가", "알고", "복창"], 3);
  const weatherText = data.externalData.weather.summary || data.scenario.weatherNote;
  return `
    <section class="section-block">
      <div class="section-label">1. 작업 전 브리핑 개요</div>
      <table class="mini-table">
        <tbody>
          <tr><th>현장</th><td>${escapeHtml(scenario.siteName)}</td><th>작업</th><td>${escapeHtml(scenario.workSummary)}</td></tr>
          <tr><th>위험수준</th><td>${escapeHtml(data.riskSummary.riskLevel)}</td><th>기상 신호</th><td>${escapeHtml(weatherText)}</td></tr>
          <tr><th>진행자</th><td>작업반장 / 관리감독자</td><th>참석 대상</th><td>투입 근로자 전원</td></tr>
        </tbody>
      </table>
    </section>
    <section class="section-block">
      <div class="section-label">2. 위험성평가 기반 TBM 전달</div>
      <table>
        <colgroup><col style="width: 7%;" /><col style="width: 28%;" /><col style="width: 24%;" /><col style="width: 16%;" /><col style="width: 17%;" /><col style="width: 8%;" /></colgroup>
        <thead><tr><th>번호</th><th>주요 유해·위험요인</th><th>기상/환경 반영</th><th>출처 연결</th><th>작업중지 기준</th><th>복창</th></tr></thead>
        <tbody>
          ${bridgeRows.map((row, index) => `<tr>
            <td class="center">${index + 1}</td>
            <td>${escapeHtml(row.risk)}</td>
            <td>${escapeHtml(row.weather)}</td>
            <td>${escapeHtml(row.source)}</td>
            <td>${escapeHtml(row.message)}</td>
            <td class="center">□</td>
          </tr>`).join("")}
        </tbody>
      </table>
    </section>
    <section class="section-block">
      <div class="section-label">3. 확인 질문</div>
      <table>
        <thead><tr><th>질문</th><th>기대 답변</th><th>미이해자 조치</th></tr></thead>
        <tbody>
          ${questionRows.map((row) => `<tr><td>${escapeHtml(compactContent(row, "오늘 작업중지 기준을 누가 판단합니까?"))}</td><td>작업중지 기준과 보고자를 구두로 답변</td><td>작업 전 재설명 후 서명</td></tr>`).join("")}
        </tbody>
      </table>
    </section>
    <section class="section-block">
      <div class="section-label">4. 보호구·통제·증빙</div>
      <table>
        <thead><tr><th>보호구</th><th>통제구역</th><th>사진/영상 증빙</th><th>관리자 확인</th></tr></thead>
        <tbody><tr><td>□ 착용 확인</td><td>□ 접근금지 표시 □ 유도자 배치</td><td>□ TBM 사진 □ 작업 전 점검 사진</td><td>서명: __________</td></tr></tbody>
      </table>
    </section>
  `;
}

function buildTbmWeatherRiskBridge(data: AskResponse, riskRows: SheetRow[]) {
  const bridgeRows = buildTbmBridgeRows(data, riskRows);
  return `
    <section class="section-block">
      <div class="section-label">위험성평가·기상 정보 반영</div>
      <table>
        <colgroup><col style="width: 7%;" /><col style="width: 27%;" /><col style="width: 26%;" /><col style="width: 16%;" /><col style="width: 24%;" /></colgroup>
        <thead><tr><th>번호</th><th>주요 유해·위험요인</th><th>오늘 기상/환경 신호</th><th>출처 연결</th><th>TBM 전달 문구</th></tr></thead>
        <tbody>
          ${bridgeRows.map((row, index) => `<tr>
            <td class="center">${index + 1}</td>
            <td>${escapeHtml(row.risk)}</td>
            <td>${escapeHtml(row.weather)}</td>
            <td>${escapeHtml(row.source)}</td>
            <td>${escapeHtml(row.message)}</td>
          </tr>`).join("")}
        </tbody>
      </table>
    </section>
  `;
}

function buildSafetyFormMarkup(
  title: string,
  rows: SheetRow[],
  scenario: AskResponse["scenario"],
  profile: SafetyFormProfile,
  data?: AskResponse,
  riskRows: SheetRow[] = []
) {
  const bridgeSections = data && (profile.layout === "tbmBriefing" || profile.layout === "tbmLog")
    ? buildTbmWeatherRiskBridge(data, riskRows.length ? riskRows : rows)
    : "";
  const sections = profile.layout === "risk"
    ? buildRiskAssessmentSections(rows, scenario)
    : profile.layout === "workPlan"
      ? buildWorkPlanSections(rows, scenario)
      : profile.layout === "permit"
        ? buildPermitSections(rows, scenario)
        : profile.layout === "tbmLog"
          ? `${bridgeSections}${buildTbmLogSections(rows, scenario)}`
          : profile.layout === "tbmBriefing"
            ? (data ? buildTbmBriefingSections(rows, scenario, data, riskRows) : buildGenericSections(rows, profile))
            : profile.layout === "education"
              ? buildEducationSections(rows, scenario)
              : buildGenericSections(rows, profile);
  const approvalCells = profile.approvalLabels.map((label) => `
    <div class="approval-cell"><b>${escapeHtml(label)}</b><em>서명</em></div>
  `).join("");
  const confirmationCells = profile.confirmationRows.map((label) => `
    <div>□ ${escapeHtml(label)}</div>
  `).join("");

  return `
  <article class="safety-form-page form-layout-${profile.layout}">
    <header class="form-head">
      <div class="form-title">
        <span>${escapeHtml(profile.code)}</span>
        <h1>${escapeHtml(title)}</h1>
        <p>${escapeHtml(profile.subtitle)} · SafeClaw 공식자료 기반 현장 검토용 초안</p>
      </div>
      <div class="approval-grid" style="--approval-count: ${profile.approvalLabels.length};">${approvalCells}</div>
    </header>
    <p class="form-lineage">서식 구분: ${escapeHtml(profile.subtitle)} · 원본 서식 1:1 재현이 아니라 현장 입력값과 공식자료를 정리한 검토용 출력입니다.</p>
    <div class="meta-grid">
      <div class="meta-item"><b>사업장</b><span>${escapeHtml(scenario.companyName)}</span></div>
      <div class="meta-item"><b>현장/공정</b><span>${escapeHtml(scenario.siteName)}</span></div>
      <div class="meta-item"><b>작업내용</b><span>${escapeHtml(scenario.workSummary)}</span></div>
      <div class="meta-item"><b>인원/조건</b><span>${scenario.workerCount.toLocaleString("ko-KR")}명 · ${escapeHtml(scenario.weatherNote)}</span></div>
    </div>
    <div class="check-grid">${confirmationCells}</div>
    ${sections}
    <div class="signature-grid">
      <div><b>작성자</b>성명/서명:</div>
      <div><b>관리감독자</b>성명/서명:</div>
      <div><b>교육/TBM 확인자</b>성명/서명:</div>
      <div><b>보관 위치</b>문서번호/철:</div>
    </div>
    <p class="form-note">본 문서는 현장 확인 전 초안입니다. 발주처 지정 원본 양식, 작업 전 위험요인, 참석자, 작업중지 기준, 서명란을 최종 확인한 뒤 사용하세요.</p>
  </article>`;
}

function buildHtml(
  title: string,
  rows: SheetRow[],
  scenario: AskResponse["scenario"],
  profile: SafetyFormProfile,
  data?: AskResponse,
  riskRows: SheetRow[] = []
) {
  return `<!doctype html>
<html lang="ko">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(title)}</title>
  <style>
    ${formCss()}
  </style>
</head>
<body>
  ${buildSafetyFormMarkup(title, rows, scenario, profile, data, riskRows)}
</body>
</html>`;
}

// First-line meta keys that show up as `key: value` even outside a meta section.
const META_KEY_PATTERNS = [
  /^서식상태$/,
  /^연결 상태$/,
  /^생성일자$/,
  /^생성시각$/,
  /^제출상태$/,
  /^원본 재현 한계/,
  /^반영 근거$/,
  /^법령·해석례$/,
  /^판례 보조$/,
  /^내부 참고자료 반영$/,
  /^주의$/,
  /^위험성평가 연결$/,
  /^TBM 연결$/,
  /^교육 연결$/,
  /^신호$/,  // 기상 신호 등
  /^감소대책$/,  // META 섹션 내부의 감소대책 (실제 위험성평가표 §4와 다른 위치)
  /^확인기준$/,
  /^관련 법령 확인 대상$/
];

function isMetaKey(key: string) {
  return META_KEY_PATTERNS.some((pattern) => pattern.test(key));
}

/**
 * Robust key:value matcher — only the FIRST colon at top level (outside any
 * unmatched parens / brackets) counts. Prevents lines like
 * "- 위험요인 (KOSHA 지침 C-59-2022: 인용)" from being split at the inner colon.
 */
function matchTopLevelKeyValue(line: string): { key: string; value: string } | null {
  let depth = 0;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (ch === "(" || ch === "[" || ch === "{") depth += 1;
    else if (ch === ")" || ch === "]" || ch === "}") depth = Math.max(0, depth - 1);
    else if (depth === 0 && (ch === ":" || ch === "：")) {
      const key = line.slice(0, i).trim();
      const value = line.slice(i + 1).trim();
      // require both sides non-empty + key isn't just punctuation
      if (key && value && /[^\s\-·:：]/.test(key)) {
        return { key, value };
      }
      return null;
    }
  }
  return null;
}

function parseSheetRows(title: string, body: string): SheetRow[] {
  const rows: SheetRow[] = [];
  let section = "기본정보";
  let itemNumber = 1;
  let metaActive = false;

  body.split(/\r?\n/).forEach((rawLine) => {
    const line = rawLine.trim();
    if (!line) return;

    const sectionMatch = line.match(/^\[(.+)\]$/);
    if (sectionMatch) {
      section = sectionMatch[1];
      metaActive = isMetaSection(section);
      itemNumber = 1;
      return;
    }
    if (metaActive) return;

    // Defensive: keyed pattern must NOT match colons inside parentheses
    // (e.g., "...(KOSHA 지침 X-XX-YYYY: 인용)" should stay as one cell, not split).
    // Approach: only consider top-level `:` — find the first `:` before any unmatched
    // opening parenthesis. If the first `:` lives inside (), treat as plain content.
    const keyedMatch = matchTopLevelKeyValue(line);
    const numbered = line.match(/^(\d+)\.\s*(.+)$/);
    const bullet = line.match(/^[-ㆍ]\s*(.+)$/);

    if (keyedMatch) {
      const { key, value } = keyedMatch;
      if (isMetaKey(key)) return;
      rows.push({ document: title, section, item: key, content: value });
      return;
    }
    if (numbered) {
      rows.push({ document: title, section, item: numbered[1].trim(), content: numbered[2].trim() });
      return;
    }
    if (bullet) {
      rows.push({ document: title, section, item: String(itemNumber), content: bullet[1].trim() });
      itemNumber += 1;
      return;
    }

    rows.push({ document: title, section, item: String(itemNumber), content: line });
    itemNumber += 1;
  });

  return rows;
}

function buildRowsForDocument(meta: EditableDocument, values: Record<DocumentKey, string>) {
  return parseSheetRows(meta.title, values[meta.key]);
}

function buildRowsForAll(values: Record<DocumentKey, string>) {
  return documentMeta.flatMap((meta) => buildRowsForDocument(meta, values));
}

function buildLaunchSheetRows(values: Record<DocumentKey, string>) {
  const sheetMap: Array<{ sheet: string; keys: DocumentKey[] }> = [
    { sheet: "0. 문서팩 요약", keys: ["workpackSummaryDraft"] },
    { sheet: "1. 위험성평가", keys: ["riskAssessmentDraft"] },
    { sheet: "2. 작업계획·허가", keys: ["workPlanDraft", "workPermitDraft"] },
    { sheet: "3. TBM 및 일일점검", keys: ["tbmBriefing", "tbmLogDraft"] },
    { sheet: "4. 안전보건교육", keys: ["safetyEducationRecordDraft", "foreignWorkerBriefing", "foreignWorkerTransmission"] },
    { sheet: "5. 비상대응", keys: ["emergencyResponseDraft"] },
    { sheet: "6. 사진/증빙", keys: ["photoEvidenceDraft"] }
  ];

  const documentRows = sheetMap.flatMap(({ sheet, keys }) => (
    keys.flatMap((key) => {
      const meta = documentMeta.find((item) => item.key === key);
      if (!meta) return [];
      return buildRowsForDocument(meta, values).map((row) => ({ ...row, section: `${sheet} / ${row.section}` }));
    })
  ));
  const rubricRows = evaluatePublicSafetyRubric(values).items.map((item) => ({
    document: "제출 전 점검",
    section: `7. 제출 전 점검 / ${rubricCategoryLabel(item.category)}`,
    item: item.title,
    content: `${rubricStatusLabel(item.status)} · ${item.description} · 보완: ${item.improvementAction} · 리서치: ${item.researchAction}`
  }));

  return [...documentRows, ...rubricRows];
}

function escapeCell(value: string) {
  return `"${value.replace(/"/g, "\"\"")}"`;
}

function buildDelimited(rows: SheetRow[], delimiter: "," | "\t") {
  const header = ["문서", "섹션", "항목", "내용"];
  const body = rows.map((row) => [row.document, row.section, row.item, row.content]
    .map((value) => delimiter === "," ? escapeCell(value) : value.replace(/\t/g, " ").replace(/\r?\n/g, " "))
    .join(delimiter));
  return [header.join(delimiter), ...body].join("\n");
}

function buildExcelHtml(
  title: string,
  rows: SheetRow[],
  scenario: AskResponse["scenario"],
  profile: SafetyFormProfile,
  data?: AskResponse,
  riskRows: SheetRow[] = []
) {
  if (profile.layout === "risk" || profile.layout === "workPlan" || profile.layout === "permit" || profile.layout === "tbmLog" || profile.layout === "tbmBriefing" || profile.layout === "education") {
    return `<!doctype html>
<html lang="ko">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(title)}</title>
  <style>
    ${formCss("18px")}
    body { background: #ffffff; }
    .safety-form-page { box-shadow: none; }
  </style>
</head>
<body>
  ${buildSafetyFormMarkup(title, rows, scenario, profile, data, riskRows)}
</body>
</html>`;
  }
  const grouped = rows.reduce<Record<string, SheetRow[]>>((acc, row) => {
    acc[row.section] = [...(acc[row.section] || []), row];
    return acc;
  }, {});
  const summaryRows = Object.entries(grouped).map(([section, sectionRows]) => `
    <tr>
      <td>${escapeHtml(section)}</td>
      <td>${sectionRows.length}</td>
      <td>${escapeHtml(sectionRows.slice(0, 2).map((row) => row.item).join(", "))}</td>
    </tr>
  `).join("");
  const tableRows = Object.entries(grouped).map(([section, sectionRows]) => `
    <tr class="section-row"><td colspan="5">${escapeHtml(section)}</td></tr>
    ${sectionRows.map((row, index) => `<tr><td class="center">${index + 1}</td><td>${escapeHtml(row.item)}</td><td>${escapeHtml(row.content)}</td><td class="check-cell">□ 확인</td><td>담당: ______</td></tr>`).join("")}
  `).join("");
  const confirmationRows = profile.confirmationRows.map((row) => `<td>□ ${escapeHtml(row)}</td>`).join("");
  const approvalRows = profile.approvalLabels.map((label) => `<td>${escapeHtml(label)}<br /><br />서명: ______</td>`).join("");
  return `<!doctype html>
<html lang="ko">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(title)}</title>
  <!--[if gte mso 9]>
  <xml>
    <x:ExcelWorkbook>
      <x:ExcelWorksheets>
        <x:ExcelWorksheet>
          <x:Name>${escapeHtml(title).slice(0, 28)}</x:Name>
          <x:WorksheetOptions><x:FitToPage/><x:Print><x:FitWidth>1</x:FitWidth><x:FitHeight>0</x:FitHeight></x:Print></x:WorksheetOptions>
        </x:ExcelWorksheet>
      </x:ExcelWorksheets>
    </x:ExcelWorkbook>
  </xml>
  <![endif]-->
  <style>
    body { font-family: "Malgun Gothic", "Apple SD Gothic Neo", "Noto Sans KR", sans-serif; color: #17201d; font-size: 10pt; font-weight: 400; line-height: 15pt; letter-spacing: 0; }
    .cover { border: 2px solid #1f4d43; background: #e8f1ed; padding: 18px; margin-bottom: 14px; }
    .cover h1 { margin: 0 0 8px; font-size: 20pt; font-weight: 700; line-height: 24pt; letter-spacing: -0.02em; }
    .cover p { margin: 0; color: #5e6677; font-size: 8pt; font-weight: 400; line-height: 11pt; letter-spacing: 0; }
    .meta-grid td { background: #fffdf8; }
    .meta-grid .label { background: #21594f; color: #ffffff; font-weight: 700; text-align: center; width: 16%; }
    table { border-collapse: collapse; width: 100%; table-layout: fixed; font-family: "Malgun Gothic", "Apple SD Gothic Neo", "Noto Sans KR", sans-serif; margin-bottom: 14px; }
    th, td { border: 1px solid #9aa4b2; padding: 8px; vertical-align: top; font-size: 8.5pt; font-weight: 400; line-height: 12pt; letter-spacing: 0; font-variant-numeric: tabular-nums; mso-number-format:"\\@"; word-break: keep-all; }
    th { background: #1f4d43; color: #ffffff; font-weight: 700; text-align: center; }
    .summary th { background: #6f4b26; }
    .section-row td { background: #e8f1ed; color: #1f4d43; font-size: 14pt; font-weight: 700; line-height: 18pt; letter-spacing: -0.01em; border-top: 2px solid #1f4d43; }
    .center { text-align: center; width: 42px; }
    .check-cell { text-align: center; color: #6f4b26; width: 90px; }
    .confirm td, .approval td { text-align: center; font-weight: 700; }
    .note { color: #5e6677; font-size: 8pt; font-weight: 400; line-height: 11pt; letter-spacing: 0; margin-top: 10px; }
  </style>
</head>
<body>
  <div class="cover">
    <h1>${escapeHtml(title)}</h1>
    <p>${escapeHtml(profile.subtitle)} · SafeClaw 현장 문서팩 · 검토/확인/서명용 HTML 호환 XLS</p>
  </div>
  <table class="meta-grid">
    <tbody>
      <tr><td class="label">사업장</td><td>${escapeHtml(scenario.companyName)}</td><td class="label">현장/공정</td><td>${escapeHtml(scenario.siteName)}</td></tr>
      <tr><td class="label">작업내용</td><td>${escapeHtml(scenario.workSummary)}</td><td class="label">인원/조건</td><td>${scenario.workerCount.toLocaleString("ko-KR")}명 · ${escapeHtml(scenario.weatherNote)}</td></tr>
    </tbody>
  </table>
  <table class="confirm"><tbody><tr>${confirmationRows}</tr></tbody></table>
  <table class="summary">
    <colgroup><col style="width: 34%;" /><col style="width: 12%;" /><col style="width: 54%;" /></colgroup>
    <thead><tr><th>섹션</th><th>항목 수</th><th>주요 항목</th></tr></thead>
    <tbody>${summaryRows}</tbody>
  </table>
  <table>
    <colgroup><col style="width: 6%;" /><col style="width: 22%;" /><col style="width: 52%;" /><col style="width: 10%;" /><col style="width: 10%;" /></colgroup>
    <thead><tr><th>번호</th><th>${escapeHtml(profile.primaryColumn)}</th><th>${escapeHtml(profile.actionColumn)}</th><th>확인</th><th>담당</th></tr></thead>
    <tbody>${tableRows}</tbody>
  </table>
  <table class="approval"><tbody><tr>${approvalRows}<td>보관 위치<br /><br />______</td></tr></tbody></table>
  <p class="note">본 파일은 Excel에서 열 수 있는 HTML 호환 .xls 초안입니다. 현장관리자가 작업 전 최종 확인 후 사용하세요.</p>
</body>
</html>`;
}

function buildLaunchWorkbookHtml(title: string, rows: SheetRow[]) {
  const groups = rows.reduce<Record<string, SheetRow[]>>((acc, row) => {
    const [sheet] = row.section.split(" / ");
    acc[sheet] = [...(acc[sheet] || []), row];
    return acc;
  }, {});
  const sections = Object.entries(groups).map(([sheet, sheetRows]) => `
    <h2>${escapeHtml(sheet)}</h2>
    <table>
      <thead><tr><th>문서</th><th>섹션</th><th>항목</th><th>내용</th></tr></thead>
      <tbody>${sheetRows.map((row) => `<tr><td>${escapeHtml(row.document)}</td><td>${escapeHtml(row.section.replace(`${sheet} / `, ""))}</td><td>${escapeHtml(row.item)}</td><td>${escapeHtml(row.content)}</td></tr>`).join("")}</tbody>
    </table>
  `).join("");

  return `<!doctype html>
<html lang="ko">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(title)}</title>
  <style>
    body { font-family: "Malgun Gothic", "Apple SD Gothic Neo", "Noto Sans KR", sans-serif; color: #17201d; font-size: 10pt; font-weight: 400; line-height: 15pt; letter-spacing: 0; }
    .cover { border: 2px solid #1f4d43; background: #e8f1ed; padding: 18px; margin-bottom: 16px; }
    .cover h1 { margin: 0 0 8px; font-size: 20pt; font-weight: 700; line-height: 24pt; letter-spacing: -0.02em; }
    .cover p { margin: 0; color: #5e6677; font-size: 8pt; font-weight: 400; line-height: 11pt; letter-spacing: 0; }
    h2 { margin: 24px 0 8px; color: #21594f; border-left: 5px solid #21594f; padding-left: 9px; font-size: 14pt; font-weight: 700; line-height: 18pt; letter-spacing: -0.01em; }
    table { border-collapse: collapse; width: 100%; table-layout: fixed; margin-bottom: 18px; }
    th, td { border: 1px solid #9aa4b2; padding: 8px; vertical-align: top; font-size: 8.5pt; font-weight: 400; line-height: 12pt; letter-spacing: 0; font-variant-numeric: tabular-nums; mso-number-format:"\\@"; word-break: keep-all; }
    th { background: #1f4d43; color: #ffffff; font-weight: 700; text-align: center; }
    td:nth-child(1) { width: 18%; }
    td:nth-child(2) { width: 20%; }
    td:nth-child(3) { width: 12%; text-align: center; }
  </style>
</head>
<body>
  <div class="cover">
    <h1>${escapeHtml(title)}</h1>
    <p>위험성평가·작업계획·TBM·안전보건교육·비상대응·증빙을 한 파일에 묶은 현장 검토용 Excel 문서팩입니다.</p>
  </div>
  ${sections}
</body>
</html>`;
}

function buildWordHtml(
  title: string,
  rows: SheetRow[],
  scenario: AskResponse["scenario"],
  profile: SafetyFormProfile,
  data?: AskResponse,
  riskRows: SheetRow[] = []
) {
  return `<!doctype html>
<html lang="ko">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(title)}</title>
  <style>
    ${formCss("20px")}
    body { background: #ffffff; }
    .safety-form-page { box-shadow: none; }
  </style>
</head>
<body>
  ${buildSafetyFormMarkup(title, rows, scenario, profile, data, riskRows)}
</body>
</html>`;
}

function buildHwpTemplateText(
  title: string,
  rows: SheetRow[],
  profile: SafetyFormProfile,
  scenario: AskResponse["scenario"],
  data?: AskResponse,
  riskRows: SheetRow[] = []
) {
  const grouped = rows.reduce<Record<string, SheetRow[]>>((acc, row) => {
    acc[row.section] = [...(acc[row.section] || []), row];
    return acc;
  }, {});
  const tbmBridgeLines = data && (profile.layout === "tbmBriefing" || profile.layout === "tbmLog")
    ? [
        "[위험성평가·기상 정보 반영]",
        ...buildTbmBridgeRows(data, riskRows).flatMap((row, index) => [
          `${index + 1}. 주요 유해·위험요인: ${row.risk}`,
          `   오늘 기상/환경 신호: ${row.weather}`,
          `   출처 연결: ${row.source}`,
          `   TBM 전달 문구: ${row.message}`
        ]),
        ""
      ]
    : [];
  const layoutNotice = profile.layout === "risk"
    ? [
        "[서식 구조]",
        "단위공종 / 작업장소 / 사용 기계기구·장비 / 유해·위험요인 / 재해형태 / 가능성 / 중대성 / 등급 / 감소대책 / 조치담당자 / 조치기한 / 확인자 서명",
        ""
      ]
    : profile.layout === "workPlan"
      ? [
          "[서식 구조]",
          "작업개요 / 세부 작업순서 / 장비·인원·첨부서류 / 작업중지 기준 / 비상대응 / 확인자 서명",
          ""
        ]
      : profile.layout === "permit"
        ? [
            "[서식 구조]",
            "허가번호 / 작업시간 / 신청자·허가자 / 작업 전 허가조건 / 첨부서류 체크리스트 / 종료 확인",
            ""
          ]
        : profile.layout === "tbmLog"
          ? [
              "[서식 구조]",
              "담당·소장 결재 / 공종·일자 / 근로자 확인사항 / 금일 작업사항 / 금일 위험요인 / 일일 안전교육 및 전달사항 / 참석자 명단(NO·직종·성명·오전·오후·비고) / 인원 집계 / 미조치 및 사진·영상 증빙",
              ""
            ]
          : profile.layout === "education"
            ? [
                "[서식 구조]",
                "교육 실시 개요 / 교육 내용 및 이해 확인 / 참석자 명단(성명·소속·역할·언어·서명) / 미이해자 및 후속 조치",
                ""
              ]
            : [];

  return [
    `${title}(초안)`,
    "SafeClaw 공식자료 기반 서식 · 현장 검토 후 사용",
    `현장: ${scenario.siteName}`,
    `작업: ${scenario.workSummary}`,
    "",
    ...layoutNotice,
    ...tbmBridgeLines,
    ...Object.entries(grouped).flatMap(([section, sectionRows]) => [
      `[${section}]`,
      ...sectionRows.map((row) => `${row.item}. ${row.content}`),
      ""
    ]),
    "[확인/서명]",
    "작성자: ____________________",
    "관리감독자: ____________________",
    "교육/TBM 확인자: ____________________",
    "보관 위치: ____________________",
    "확인일시: ______년 ____월 ____일 ____시 ____분"
  ].join("\n");
}

async function loadRhwp() {
  if (!rhwpModulePromise) {
    rhwpModulePromise = (async () => {
      let canvasContext: CanvasRenderingContext2D | null = null;
      let lastFont = "";
      globalThis.measureTextWidth = (font: string, text: string) => {
        if (!canvasContext) {
          canvasContext = document.createElement("canvas").getContext("2d");
        }
        if (!canvasContext) return text.length * 12;
        if (font !== lastFont) {
          canvasContext.font = font;
          lastFont = font;
        }
        return canvasContext.measureText(text).width;
      };

      const rhwp = await import("@rhwp/core");
      await rhwp.default({ module_or_path: "/rhwp_bg.wasm" });
      return rhwp;
    })();
  }

  return rhwpModulePromise;
}

async function buildHwpxWithRhwp(body: string) {
  const { HwpDocument } = await loadRhwp();
  const document = HwpDocument.createEmpty();
  try {
    document.createBlankDocument();
    document.insertText(0, 0, 0, body);
    const exported = document.exportHwpx();
    const buffer = new ArrayBuffer(exported.byteLength);
    new Uint8Array(buffer).set(exported);
    return new Blob([buffer], { type: "application/hwp+zip" });
  } finally {
    document.free();
  }
}

function buildCombinedText(values: Record<DocumentKey, string>) {
  const rubricText = evaluatePublicSafetyRubric(values).items.map((item) => (
    `- [${rubricCategoryLabel(item.category)}] ${item.title}: ${rubricStatusLabel(item.status)}\n  보완: ${item.improvementAction}\n  리서치: ${item.researchAction}`
  )).join("\n");

  return [
    documentMeta.map((item) => `# ${item.title}\n\n${values[item.key]}`).join("\n\n---\n\n"),
    `# 제출 전 점검\n\n${rubricText}`
  ].join("\n\n---\n\n");
}

type StoredEditorDraft = {
  version: 1;
  values: WorkpackDocumentValues;
  dirtyKeys: DocumentKey[];
  draftRiskRows?: RiskAssessmentRow[];
  riskRowIds?: string[];
  canonicalRiskRows?: RiskAssessmentRow[];
  canonicalRiskText?: string;
};

function parseStoredRiskRows(value: unknown): RiskAssessmentRow[] | null {
  if (!Array.isArray(value)) return null;
  const stringFields = [
    "location", "process", "task", "equipment", "hazard", "currentControls",
    "additionalControls", "owner", "due", "verification", "verificationDate",
    "verificationChecker", "whyLikelihood", "whySeverity"
  ] as const;
  const rows: RiskAssessmentRow[] = [];

  for (const item of value) {
    const row = readObject(item);
    if (!row || !stringFields.every((field) => typeof row[field] === "string")) return null;
    if (row.controlId !== undefined && typeof row.controlId !== "string") return null;
    if (!FOUR_M_VALUES.includes(row.fourM as RiskAssessmentRow["fourM"])) return null;
    if (!ACCIDENT_TYPE_VALUES.includes(row.accidentType as RiskAssessmentRow["accidentType"])) return null;
    if (!VERIFICATION_STATUS_VALUES.includes(row.verificationStatus as RiskAssessmentRow["verificationStatus"])) return null;
    if (!["low", "medium", "high"].includes(String(row.riskLevel))) return null;
    if (!Number.isInteger(row.likelihood) || !Number.isInteger(row.severity)) return null;
    if (!Array.isArray(row.evidenceRefs) || !row.evidenceRefs.every((ref) => typeof ref === "string")) return null;

    rows.push({
      ...(typeof row.controlId === "string" && row.controlId ? { controlId: row.controlId } : {}),
      location: row.location as string,
      process: row.process as string,
      task: row.task as string,
      equipment: row.equipment as string,
      hazard: row.hazard as string,
      fourM: row.fourM as RiskAssessmentRow["fourM"],
      accidentType: row.accidentType as RiskAssessmentRow["accidentType"],
      currentControls: row.currentControls as string,
      likelihood: row.likelihood as number,
      severity: row.severity as number,
      riskLevel: row.riskLevel as RiskAssessmentRow["riskLevel"],
      additionalControls: row.additionalControls as string,
      owner: row.owner as string,
      due: row.due as string,
      verification: row.verification as string,
      verificationStatus: row.verificationStatus as RiskAssessmentRow["verificationStatus"],
      verificationDate: row.verificationDate as string,
      verificationChecker: row.verificationChecker as string,
      whyLikelihood: row.whyLikelihood as string,
      whySeverity: row.whySeverity as string,
      evidenceRefs: row.evidenceRefs as string[]
    });
  }
  return rows;
}

function parseStoredRiskRowIds(value: unknown, rowCount: number): string[] | null {
  if (!Array.isArray(value) || value.length !== rowCount) return null;
  const ids = value.filter((id): id is string => typeof id === "string" && id.length > 0);
  return ids.length === rowCount && new Set(ids).size === ids.length ? ids : null;
}

function isDocumentKey(value: unknown): value is DocumentKey {
  return typeof value === "string" && documentMeta.some((item) => item.key === value);
}

function parseDocumentValues(value: unknown, fallback: WorkpackDocumentValues): WorkpackDocumentValues {
  const record = readObject(value) || {};
  return documentMeta.reduce<WorkpackDocumentValues>((acc, item) => {
    const documentValue = record[item.key];
    acc[item.key] = typeof documentValue === "string" ? documentValue : fallback[item.key];
    return acc;
  }, { ...fallback });
}

function parseStoredDraft(
  raw: string | null,
  fallback: WorkpackDocumentValues,
  fallbackRiskRows: RiskAssessmentRow[]
): StoredEditorDraft {
  if (!raw) return { version: 1, values: fallback, dirtyKeys: [] };

  try {
    const parsed: unknown = JSON.parse(raw);
    const record = readObject(parsed);
    if (!record) return { version: 1, values: fallback, dirtyKeys: [] };

    const parsedValues = parseDocumentValues(record.values || record, fallback);
    const storedDirtyKeys = Array.isArray(record.dirtyKeys)
      ? record.dirtyKeys.filter(isDocumentKey)
      : documentMeta.filter((item) => parsedValues[item.key] !== fallback[item.key]).map((item) => item.key);
    const dirtyKeys = [...new Set(storedDirtyKeys)];
    const values = dirtyKeys.reduce<WorkpackDocumentValues>((acc, key) => {
      acc[key] = parsedValues[key];
      return acc;
    }, { ...fallback });
    const canonicalRiskText = typeof record.canonicalRiskText === "string"
      ? record.canonicalRiskText
      : undefined;
    const draftRiskRows = parseStoredRiskRows(record.draftRiskRows);
    const restoredRiskRows = draftRiskRows ?? fallbackRiskRows;
    const riskRowIds = parseStoredRiskRowIds(record.riskRowIds, restoredRiskRows.length) ?? undefined;
    const parsedRiskRows = validateRiskAssessmentRows(record.canonicalRiskRows);
    const hasStoredCanonicalRows = parsedRiskRows.ok
      && canonicalRiskText !== undefined
      && isCanonicalRiskAssessmentExportSafe(parsedRiskRows.rows, canonicalRiskText, values.riskAssessmentDraft);
    const hasCurrentStructuredDraft = draftRiskRows !== null
      && canonicalRiskText !== undefined
      && canonicalRiskText === values.riskAssessmentDraft
      && serializeRiskAssessmentRowsToDraft(draftRiskRows) === canonicalRiskText;
    return {
      version: 1,
      values,
      dirtyKeys,
      draftRiskRows: restoredRiskRows,
      riskRowIds,
      canonicalRiskRows: hasStoredCanonicalRows ? parsedRiskRows.rows : restoredRiskRows,
      canonicalRiskText: hasStoredCanonicalRows || hasCurrentStructuredDraft ? canonicalRiskText : undefined
    };
  } catch (error) {
    console.warn("workpack local draft parse failed", error);
    return { version: 1, values: fallback, dirtyKeys: [] };
  }
}

function readObject(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function readText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function readRemediationDraft(itemId: string, value: unknown): RemediationDraft {
  const record = readObject(value);
  if (!record) {
    return {
      itemId,
      text: "",
      status: "error",
      message: "보완 제안 응답을 읽지 못했습니다.",
      providerLabel: null,
      policyNote: "",
      catalogStatus: null,
      sources: []
    };
  }

  const sourcesValue = record.sources;
  const sources = Array.isArray(sourcesValue)
    ? sourcesValue.map((source) => {
        const sourceRecord = readObject(source);
        return sourceRecord
          ? {
              title: readText(sourceRecord.title),
              agency: readText(sourceRecord.agency),
              url: readText(sourceRecord.url) || "/knowledge",
              sourceType: readText(sourceRecord.sourceType) || "source",
              roleLabel: readText(sourceRecord.roleLabel),
              reflectionLabel: readText(sourceRecord.reflectionLabel)
            }
          : null;
      }).filter((source): source is RemediationDraft["sources"][number] => Boolean(source && source.title))
    : [];
  const catalogStatusRecord = readObject(record.catalogStatus);

  return {
    itemId,
    text: readText(record.text),
    status: record.ok === true ? "ready" : "error",
    message: readText(record.message) || (record.ok === true ? "보완 제안을 생성했습니다." : "보완 제안을 생성하지 못했습니다."),
    providerLabel: readText(record.providerLabel) || null,
    policyNote: readText(record.policyNote),
    catalogStatus: catalogStatusRecord
      ? {
          configured: catalogStatusRecord.configured === true,
          ok: catalogStatusRecord.ok === true,
          count: typeof catalogStatusRecord.count === "number" ? catalogStatusRecord.count : 0,
          message: readText(catalogStatusRecord.message)
        }
      : null,
    sources
  };
}

function SafetyDocumentPreview({
  title,
  rows,
  scenario,
  profile,
  data,
  riskRows
}: {
  title: string;
  rows: SheetRow[];
  scenario: AskResponse["scenario"];
  profile: SafetyFormProfile;
  data: AskResponse;
  riskRows: SheetRow[];
}) {
  const groups = groupSubmissionPreviewRows(rows);
  const tbmBridgeRows = profile.layout === "tbmBriefing" || profile.layout === "tbmLog"
    ? buildTbmBridgeRows(data, riskRows)
    : [];
  const tableLabels = profile.layout === "risk"
    ? { primary: "유해·위험요인", action: "재해형태 / 감소대책", confirm: "등급 / 담당" }
    : profile.layout === "workPlan"
      ? { primary: "작업순서/대상", action: "작업방법 / 안전관리대책", confirm: "확인자" }
    : profile.layout === "permit"
        ? { primary: "허가 항목", action: "허가조건 / 첨부서류", confirm: "적합/보완" }
        : profile.layout === "tbmBriefing" || profile.layout === "tbmLog"
          ? { primary: "전달 항목", action: "전달 내용 / 작업중지 기준", confirm: "복창/서명" }
          : { primary: profile.primaryColumn, action: profile.actionColumn, confirm: "확인/담당" };

  return (
    <div className="safety-form-preview document-print-typography" aria-label={`${title} 서식 미리보기`}>
      <style>{documentPreviewCss}</style>
      <div className="safety-form-preview-head">
        <div>
          <span>{profile.code}</span>
          <strong>{title}</strong>
          <small>{profile.subtitle}</small>
        </div>
        <div className="approval-preview" aria-label="결재란">
          {profile.approvalLabels.map((label) => (
            <div key={label}>
              <b>{label}</b>
              <em>서명</em>
            </div>
          ))}
        </div>
      </div>
      <div className="safety-form-meta-grid">
        <div><b>사업장</b><span>{scenario.companyName}</span></div>
        <div><b>현장/공정</b><span>{scenario.siteName}</span></div>
        <div><b>작업내용</b><span>{scenario.workSummary}</span></div>
        <div><b>인원/조건</b><span>{scenario.workerCount.toLocaleString("ko-KR")}명 · {scenario.weatherNote}</span></div>
      </div>
      <div className="safety-form-check-row">
        {profile.confirmationRows.map((row) => (
          <span key={row}>□ {row}</span>
        ))}
      </div>
      {tbmBridgeRows.length ? (
        <section className="safety-form-bridge" aria-label="위험성평가와 기상 정보 반영">
          <h3>위험성평가·기상 정보 반영</h3>
          <div className="safety-form-table-wrap">
            <table>
              <thead>
                <tr>
                  <th>번호</th>
                  <th>주요 유해·위험요인</th>
                  <th>오늘 기상/환경 신호</th>
                  <th>출처 연결</th>
                  <th>TBM 전달 문구</th>
                </tr>
              </thead>
              <tbody>
                {tbmBridgeRows.map((row, index) => (
                  <tr key={`${row.risk}-${index}`}>
                    <td>{index + 1}</td>
                    <td>{row.risk}</td>
                    <td>{row.weather}</td>
                    <td>{row.source}</td>
                    <td>{row.message}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}
      <div className="safety-form-section-stack">
        {groups.map((group) => (
          <section key={group.section}>
            <h3>{group.section}</h3>
            <div className="safety-form-table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>번호</th>
                    <th>{tableLabels.primary}</th>
                    <th>{tableLabels.action}</th>
                    <th>{tableLabels.confirm}</th>
                  </tr>
                </thead>
                <tbody>
                  {group.rows.map((row, index) => (
                    <tr key={`${group.section}-${row.item}-${index}`}>
                      <td>{index + 1}</td>
                      <td>{previewRowItem(row, tableLabels.primary)}</td>
                      <td>{row.content}</td>
                      <td>□ 확인<br />담당: ___</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        ))}
      </div>
      <div className="safety-form-signatures">
        <span>작성자 서명</span>
        <span>관리감독자 서명</span>
        <span>교육/TBM 확인</span>
        <span>보관 위치</span>
      </div>
    </div>
  );
}

function RiskAssessmentRowsEditor({
  rows,
  rowIds,
  validation,
  isCurrent,
  isLocked,
  onConfirmStructuredEdit,
  onRowChange,
  onFieldFocus,
  onAdd,
  onRemove
}: {
  rows: RiskAssessmentRow[];
  rowIds: string[];
  validation: ReturnType<typeof validateRiskAssessmentRows>;
  isCurrent: boolean;
  isLocked: boolean;
  onConfirmStructuredEdit: () => void;
  onRowChange: <K extends keyof RiskAssessmentRow>(rowIndex: number, field: K, value: RiskAssessmentRow[K]) => void;
  onFieldFocus?: (element: HTMLElement) => void;
  onAdd: () => void;
  onRemove: (rowIndex: number) => void;
}) {
  const rowIdSignature = rowIds.join("\u001f");
  const [expandedRiskRowIds, setExpandedRiskRowIds] = useState<Set<string>>(() => (
    new Set(rowIds[0] ? [rowIds[0]] : [])
  ));

  useEffect(() => {
    const currentRowIds = new Set(rowIds);
    setExpandedRiskRowIds((current) => {
      const retained = Array.from(current).filter((id) => currentRowIds.has(id));
      return new Set(retained.length ? retained : rowIds[0] ? [rowIds[0]] : []);
    });
  }, [rowIdSignature]);

  const fieldErrorProps = (
    rowIndex: number,
    rowId: string,
    field: keyof RiskAssessmentRow
  ): { "aria-invalid"?: true; "aria-describedby"?: string } => {
    const hasError = validation.issues.some((issue) => issue.rowIndex === rowIndex && issue.field === field);
    return hasError
      ? { "aria-invalid": true, "aria-describedby": `risk-row-${rowId}-${field}-error` }
      : {};
  };

  return (
    <section className={styles.riskRowsEditor} data-testid="risk-rows-editor" aria-label="위험성평가 구조화 행 편집">
      <header className={styles.riskRowsHeader}>
        <div>
          <span className="eyebrow">평가 행</span>
          <strong>{rows.length.toLocaleString("ko-KR")}개 위험 항목</strong>
          <small className={validation.ok && isCurrent ? styles.rowStatusReady : styles.rowStatusBlocked}>
            {validation.ok && isCurrent ? "미리보기·내보내기 동기화됨" : "구조행 내보내기 보류 · 필수값 또는 원문 일치 확인"}
          </small>
        </div>
        <button type="button" className={styles.addRiskRowButton} onClick={onAdd} disabled={isLocked}>
          <span aria-hidden="true">+</span>
          위험 항목
        </button>
      </header>

      {isLocked ? (
        <div className={styles.riskRowsLockNotice} role="alert">
          <p>현재 원문과 구조화 행이 다릅니다. 일반 구조 편집은 원문을 덮어쓸 수 있어 잠겨 있습니다.</p>
          <button type="button" onClick={onConfirmStructuredEdit}>구조 편집으로 전환</button>
        </div>
      ) : null}

      <fieldset
        className={styles.riskRowsFieldset}
        disabled={isLocked}
        onFocusCapture={(event) => {
          if (event.target instanceof HTMLElement) onFieldFocus?.(event.target);
        }}
      >
      <div className={styles.riskRowsList}>
        {rows.map((row, rowIndex) => {
          const rowId = rowIds[rowIndex] ?? `risk-row-${rowIndex}`;
          const rowIssues = validation.issues.filter((issue) => issue.rowIndex === rowIndex);
          const isExpanded = rowIssues.length > 0 || expandedRiskRowIds.has(rowId);
          return (
            <details
              className={styles.riskRow}
              key={rowId}
              data-testid="risk-row-editor-row"
              open={rowIndex === 0 || isExpanded}
              onToggle={(event) => {
                const isOpen = event.currentTarget.open;
                setExpandedRiskRowIds((current) => {
                  const next = new Set(current);
                  if (isOpen || rowIssues.length > 0) next.add(rowId);
                  else next.delete(rowId);
                  return next;
                });
              }}
            >
              <summary className={styles.riskRowHeader}>
                <div>
                  <span>{String(rowIndex + 1).padStart(2, "0")}</span>
                  <strong>{row.task || row.hazard || "새 위험 항목"}</strong>
                  <small className={styles.riskRowSummaryMeta}>
                    {accidentTypeLabels[row.accidentType]} · 위험등급 {row.riskLevel} · 근거 {row.evidenceRefs.length.toLocaleString("ko-KR")}건 · 확인 {verificationStatusLabels[row.verificationStatus]}
                  </small>
                </div>
                <button
                  type="button"
                  className={styles.removeRiskRowButton}
                  aria-label={`행 ${rowIndex + 1} 삭제`}
                  title="위험 항목 삭제"
                  onClick={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    onRemove(rowIndex);
                  }}
                >
                  <span aria-hidden="true">×</span>
                </button>
              </summary>

              <div className={styles.riskRowPrimaryGrid}>
                <label className={styles.riskRowWideField}>
                  <span>유해·위험요인</span>
                  <textarea
                    aria-label={`행 ${rowIndex + 1} 유해·위험요인`}
                    {...fieldErrorProps(rowIndex, rowId, "hazard")}
                    rows={2}
                    value={row.hazard}
                    onChange={(event) => onRowChange(rowIndex, "hazard", event.target.value)}
                  />
                </label>
              </div>

              <details className={styles.riskRowDetails} data-testid="risk-row-details">
                <summary>행 상세 편집</summary>
                <div className={styles.riskRowPrimaryGrid}>
                  <label>
                    <span>세부작업</span>
                    <input
                      aria-label={`행 ${rowIndex + 1} 세부작업`}
                      {...fieldErrorProps(rowIndex, rowId, "task")}
                      value={row.task}
                      onChange={(event) => onRowChange(rowIndex, "task", event.target.value)}
                    />
                  </label>
                  <label>
                    <span>작업장소</span>
                    <input
                      aria-label={`행 ${rowIndex + 1} 작업장소`}
                      {...fieldErrorProps(rowIndex, rowId, "location")}
                      value={row.location}
                      onChange={(event) => onRowChange(rowIndex, "location", event.target.value)}
                    />
                  </label>
                  <label className={styles.riskRowWideField}>
                    <span>추가 감소대책</span>
                    <textarea
                      aria-label={`행 ${rowIndex + 1} 추가 감소대책`}
                      {...fieldErrorProps(rowIndex, rowId, "additionalControls")}
                      rows={2}
                      value={row.additionalControls}
                      onChange={(event) => onRowChange(rowIndex, "additionalControls", event.target.value)}
                    />
                  </label>
                </div>
                <div className={styles.riskScaleGrid}>
                  <label>
                    <span>4M</span>
                    <select
                      aria-label={`행 ${rowIndex + 1} 4M`}
                      {...fieldErrorProps(rowIndex, rowId, "fourM")}
                      value={row.fourM}
                      onChange={(event) => onRowChange(rowIndex, "fourM", event.target.value as RiskAssessmentRow["fourM"])}
                    >
                      {FOUR_M_VALUES.map((value) => <option key={value} value={value}>{value}</option>)}
                    </select>
                  </label>
                  <label>
                    <span>재해형태</span>
                    <select
                      aria-label={`행 ${rowIndex + 1} 재해형태`}
                      {...fieldErrorProps(rowIndex, rowId, "accidentType")}
                      value={row.accidentType}
                      onChange={(event) => onRowChange(rowIndex, "accidentType", event.target.value as RiskAssessmentRow["accidentType"])}
                    >
                      {ACCIDENT_TYPE_VALUES.map((value) => <option key={value} value={value}>{accidentTypeLabels[value]}</option>)}
                    </select>
                  </label>
                  <label>
                    <span>가능성</span>
                    <select
                      aria-label={`행 ${rowIndex + 1} 가능성`}
                      {...fieldErrorProps(rowIndex, rowId, "likelihood")}
                      value={row.likelihood}
                      onChange={(event) => onRowChange(rowIndex, "likelihood", Number(event.target.value))}
                    >
                      {[1, 2, 3, 4, 5].map((value) => <option key={value} value={value}>{value}</option>)}
                    </select>
                  </label>
                  <label>
                    <span>중대성</span>
                    <select
                      aria-label={`행 ${rowIndex + 1} 중대성`}
                      {...fieldErrorProps(rowIndex, rowId, "severity")}
                      value={row.severity}
                      onChange={(event) => onRowChange(rowIndex, "severity", Number(event.target.value))}
                    >
                      {[1, 2, 3, 4, 5].map((value) => <option key={value} value={value}>{value}</option>)}
                    </select>
                  </label>
                  <div className={styles.riskLevelValue}>
                    <span>위험등급</span>
                    <strong data-risk-level={row.riskLevel}>{row.riskLevel}</strong>
                  </div>
                </div>
                <div className={styles.riskRowDetailGrid}>
                  <label><span>관리번호</span><input aria-label={`행 ${rowIndex + 1} 관리번호`} {...fieldErrorProps(rowIndex, rowId, "controlId")} value={row.controlId || ""} onChange={(event) => onRowChange(rowIndex, "controlId", event.target.value || undefined)} /></label>
                  <label><span>공정</span><input aria-label={`행 ${rowIndex + 1} 공정`} {...fieldErrorProps(rowIndex, rowId, "process")} value={row.process} onChange={(event) => onRowChange(rowIndex, "process", event.target.value)} /></label>
                  <label><span>장비/도구</span><input aria-label={`행 ${rowIndex + 1} 장비 도구`} {...fieldErrorProps(rowIndex, rowId, "equipment")} value={row.equipment} onChange={(event) => onRowChange(rowIndex, "equipment", event.target.value)} /></label>
                  <label><span>조치담당자</span><input aria-label={`행 ${rowIndex + 1} 조치담당자`} {...fieldErrorProps(rowIndex, rowId, "owner")} value={row.owner} onChange={(event) => onRowChange(rowIndex, "owner", event.target.value)} /></label>
                  <label className={styles.riskRowWideField}><span>현재 안전조치</span><textarea aria-label={`행 ${rowIndex + 1} 현재 안전조치`} {...fieldErrorProps(rowIndex, rowId, "currentControls")} rows={2} value={row.currentControls} onChange={(event) => onRowChange(rowIndex, "currentControls", event.target.value)} /></label>
                  <label><span>조치기한</span><input aria-label={`행 ${rowIndex + 1} 조치기한`} {...fieldErrorProps(rowIndex, rowId, "due")} value={row.due} onChange={(event) => onRowChange(rowIndex, "due", event.target.value)} /></label>
                  <label><span>확인상태</span><select aria-label={`행 ${rowIndex + 1} 확인상태`} {...fieldErrorProps(rowIndex, rowId, "verificationStatus")} value={row.verificationStatus} onChange={(event) => onRowChange(rowIndex, "verificationStatus", event.target.value as RiskAssessmentRow["verificationStatus"])}>{VERIFICATION_STATUS_VALUES.map((value) => <option key={value} value={value}>{verificationStatusLabels[value]}</option>)}</select></label>
                  <label><span>확인일</span><input aria-label={`행 ${rowIndex + 1} 확인일`} {...fieldErrorProps(rowIndex, rowId, "verificationDate")} value={row.verificationDate} onChange={(event) => onRowChange(rowIndex, "verificationDate", event.target.value)} /></label>
                  <label><span>확인자</span><input aria-label={`행 ${rowIndex + 1} 확인자`} {...fieldErrorProps(rowIndex, rowId, "verificationChecker")} value={row.verificationChecker} onChange={(event) => onRowChange(rowIndex, "verificationChecker", event.target.value)} /></label>
                  <label className={styles.riskRowWideField}><span>확인방법</span><textarea aria-label={`행 ${rowIndex + 1} 확인방법`} {...fieldErrorProps(rowIndex, rowId, "verification")} rows={2} value={row.verification} onChange={(event) => onRowChange(rowIndex, "verification", event.target.value)} /></label>
                  <label className={styles.riskRowWideField}><span>가능성 판단근거</span><textarea aria-label={`행 ${rowIndex + 1} 가능성 판단근거`} {...fieldErrorProps(rowIndex, rowId, "whyLikelihood")} rows={2} value={row.whyLikelihood} onChange={(event) => onRowChange(rowIndex, "whyLikelihood", event.target.value)} /></label>
                  <label className={styles.riskRowWideField}><span>중대성 판단근거</span><textarea aria-label={`행 ${rowIndex + 1} 중대성 판단근거`} {...fieldErrorProps(rowIndex, rowId, "whySeverity")} rows={2} value={row.whySeverity} onChange={(event) => onRowChange(rowIndex, "whySeverity", event.target.value)} /></label>
                  <label className={styles.riskRowWideField}><span>근거 자료</span><textarea aria-label={`행 ${rowIndex + 1} 근거 자료`} {...fieldErrorProps(rowIndex, rowId, "evidenceRefs")} rows={2} value={row.evidenceRefs.join("\n")} onChange={(event) => onRowChange(rowIndex, "evidenceRefs", event.target.value.split(/\r?\n|\|/u).map((item) => item.trim()).filter(Boolean))} /></label>
                </div>
              </details>

              {rowIssues.length ? (
                <p className={styles.riskRowIssues} role="status">
                  필수값 확인: {rowIssues.map((issue) => (
                    <span id={`risk-row-${rowId}-${issue.field}-error`} key={`${issue.field}-${issue.message}`}>
                      {String(issue.field)}: {issue.message}.{" "}
                    </span>
                  ))}
                </p>
              ) : null}
            </details>
          );
        })}
      </div>
      </fieldset>
    </section>
  );
}

export function WorkpackEditor({
  data,
  generationFingerprint,
  focusToken = 0,
  requestedDocumentKey,
  onSelectedDocumentChange,
  onDeliverablesChange
}: {
  data: AskResponse;
  generationFingerprint?: string;
  focusToken?: number;
  requestedDocumentKey?: DocumentKey;
  onSelectedDocumentChange?: (key: DocumentKey) => void;
  onDeliverablesChange?: (values: WorkpackDocumentValues, change: WorkpackDeliverablesChange) => void;
}) {
  const initialValues = useMemo<WorkpackDocumentValues>(
    () => ({
      workpackSummaryDraft: data.deliverables.workpackSummaryDraft,
      riskAssessmentDraft: withSubmitReadiness("위험성평가표", data.deliverables.riskAssessmentDraft, data),
      workPlanDraft: withSubmitReadiness("작업계획서", data.deliverables.workPlanDraft, data),
      workPermitDraft: resolveInitialWorkPermitDraft(data),
      tbmBriefing: withSubmitReadiness("TBM 브리핑", data.deliverables.tbmBriefing, data),
      tbmLogDraft: withSubmitReadiness("TBM 일지", data.deliverables.tbmLogDraft, data),
      safetyEducationRecordDraft: withSubmitReadiness("안전교육", data.deliverables.safetyEducationRecordDraft, data),
      emergencyResponseDraft: data.deliverables.emergencyResponseDraft,
      photoEvidenceDraft: data.deliverables.photoEvidenceDraft,
      foreignWorkerBriefing: data.deliverables.foreignWorkerBriefing,
      foreignWorkerTransmission: data.deliverables.foreignWorkerTransmission,
      kakaoMessage: data.deliverables.kakaoMessage
    }),
    [data]
  );
  const storageKey = useMemo(
    () => `safeclaw-workpack:${data.scenario.companyName}:${data.scenario.siteName}:${data.question}:${generationFingerprint || buildGenerationEvidenceFingerprint(data)}`,
    [data, generationFingerprint]
  );
  const initialRiskRows = useMemo(
    () => data.structured?.riskAssessmentRows ?? [],
    [data]
  );
  const [selectedKey, setSelectedKey] = useState<DocumentKey>(() => requestedDocumentKey ?? DEFAULT_SELECTED_DOCUMENT_KEY);
  const [values, setValues] = useState<WorkpackDocumentValues>(initialValues);
  const [dirtyDocumentKeys, setDirtyDocumentKeys] = useState<DocumentKey[]>([]);
  const [canonicalRiskRows, setCanonicalRiskRows] = useState<RiskAssessmentRow[]>(initialRiskRows);
  const [riskRowIds, setRiskRowIds] = useState<string[]>(() => initialRiskRows.map((_row, index) => `generated-risk-row-${index}`));
  const [canonicalRiskText, setCanonicalRiskText] = useState<string | null>(null);
  const [hydratedStorageKey, setHydratedStorageKey] = useState<string | null>(null);
  const [hwpxStatus, setHwpxStatus] = useState<"idle" | "building" | "error">("idle");
  const [xlsxStatus, setXlsxStatus] = useState<"idle" | "building" | "error">("idle");
  const [hwpStatus, setHwpStatus] = useState<"idle" | "building" | "error">("idle");
  const [imageStatus, setImageStatus] = useState<"idle" | "error">("idle");
  const [sheetStatus, setSheetStatus] = useState<"idle" | "copied" | "error">("idle");
  const [templateKind, setTemplateKind] = useState<TemplateKind>("sheet");
  const [editorMode, setEditorMode] = useState<"structured" | "source">("structured");
  const [lastEditedAt, setLastEditedAt] = useState<Date | null>(null);
  const [saveStatusLabel, setSaveStatusLabel] = useState("자동 저장");
  const [saveAnnouncement, setSaveAnnouncement] = useState("");
  const [showFocusCue, setShowFocusCue] = useState(false);
  const [submissionPreviewOpen, setSubmissionPreviewOpen] = useState(false);
  const [supportingDocumentsOpen, setSupportingDocumentsOpen] = useState(false);
  const [remediationDrafts, setRemediationDrafts] = useState<Record<string, RemediationDraft>>({});
  const [remediationLoadingId, setRemediationLoadingId] = useState<string | null>(null);
  const documentBodyRef = useRef<HTMLDivElement | null>(null);
  const workpackShellRef = useRef<HTMLElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const onDeliverablesChangeRef = useRef(onDeliverablesChange);
  const onSelectedDocumentChangeRef = useRef(onSelectedDocumentChange);
  const saveAnnouncementTimerRef = useRef<number | null>(null);
  const nextRiskRowIdRef = useRef(initialRiskRows.length);
  const pendingChangeRef = useRef<WorkpackDeliverablesChange>({
    source: "generated",
    requiresRevalidation: false
  });
  const selected = documentMeta.find((item) => item.key === selectedKey) || documentMeta[0];
  const selectedSupportingDocument = supportingDocumentMeta.some((item) => item.key === selected.key);
  const selectedTemplate = templatePresets.find((preset) => preset.kind === templateKind) || templatePresets[0];
  const selectedText = values[selected.key];
  const structuredDocument = useMemo(
    () => buildStructuredDocumentSections(selected.key, selectedText),
    [selected.key, selectedText]
  );
  const structuredSectionIdSignature = useMemo(
    () => structuredDocument.body.map((section) => section.id).join("|"),
    [structuredDocument.body]
  );
  const [expandedStructuredSectionId, setExpandedStructuredSectionId] = useState<string | null>(
    () => structuredDocument.body[0]?.id ?? null
  );
  const selectedHasIntentionalEmptyPermitDraft = selected.key === "workPermitDraft"
    && selectedText === ""
    && (
      Object.prototype.hasOwnProperty.call(data.deliverables, "workPermitDraft")
      || dirtyDocumentKeys.includes("workPermitDraft")
    );
  const selectedUsesEditedText = dirtyDocumentKeys.includes(selected.key)
    || selectedText !== initialValues[selected.key]
    || selectedHasIntentionalEmptyPermitDraft;
  const baseName = sanitizeFileName(`${data.scenario.companyName}-${selected.fileBase}`);
  const selectedRows = buildRowsForDocument(selected, values);
  const riskAssessmentMeta = documentMeta.find((item) => item.key === "riskAssessmentDraft") || documentMeta[1];
  const riskAssessmentRows = buildRowsForDocument(riskAssessmentMeta, values);
  const canonicalRiskValidation = useMemo(
    () => validateRiskAssessmentRows(canonicalRiskRows),
    [canonicalRiskRows]
  );
  const canonicalRiskRowsAreCurrent = canonicalRiskText
    ? isCanonicalRiskAssessmentExportSafe(canonicalRiskRows, canonicalRiskText, values.riskAssessmentDraft)
    : !dirtyDocumentKeys.includes("riskAssessmentDraft")
      && values.riskAssessmentDraft === initialValues.riskAssessmentDraft
      && areRiskAssessmentRowsRepresentedInDraft(canonicalRiskRows, values.riskAssessmentDraft);
  const expectedInitialCanonicalRiskText = withSubmitReadiness(
    "위험성평가표",
    serializeRiskAssessmentRowsToDraft(initialRiskRows),
    data
  );
  const initialRiskTextIsExactlyCanonical = initialRiskRows.length > 0
    && initialValues.riskAssessmentDraft === expectedInitialCanonicalRiskText;
  const structuredRiskEditLocked = canonicalRiskText === null
    ? dirtyDocumentKeys.includes("riskAssessmentDraft")
      || values.riskAssessmentDraft !== initialValues.riskAssessmentDraft
      || !initialRiskTextIsExactlyCanonical
    : canonicalRiskText !== values.riskAssessmentDraft;
  const selectedUsesCanonicalRiskRows = selected.key === "riskAssessmentDraft"
    && canonicalRiskRowsAreCurrent;
  const selectedFormProfile = getSafetyFormProfile(selected.key);
  const rubricEvaluation = useMemo(() => evaluatePublicSafetyRubric(values), [values]);
  const selectedRubricItems = useMemo(() => {
    const key = selected.key;
    if (!isRubricDocumentKey(key)) return [];
    return rubricEvaluation.items.filter((item) => item.documents.includes(key));
  }, [rubricEvaluation.items, selected.key]);
  const selectedQualityIssues = selectedRubricItems.filter((item) => item.status !== "fulfilled").length;
  const totalQualityIssues = rubricEvaluation.summary.total - rubricEvaluation.summary.fulfilled;
  const selectedEvidenceLabel = data.evidenceLabels?.[selected.key];
  const harnessSummary = data.dbHarness?.summary;
  const harnessPacket = data.dbHarness?.packet;
  const selectedCoverage = useMemo(() => {
    const coverageLabel = documentCoverageLabels[selected.key];
    if (!coverageLabel || !harnessSummary) return null;
    return harnessSummary.documentCoverage.find((item) => item.document === coverageLabel) || null;
  }, [harnessSummary, selected.key]);
  const evidenceHighlights = useMemo(() => {
    const references = [
      ...(harnessPacket?.directEvidence || []).map((item) => ({
        id: `direct-${item.id}`,
        badge: item.evidence_role_label || "직접 근거",
        title: item.display_title || item.title,
        summary: item.display_summary || item.short_summary || item.summary,
        href: item.source_url || null
      })),
      ...(harnessPacket?.sifCases || []).map((item) => ({
        id: `sif-${item.id}`,
        badge: item.source_kind_label || "SIF 사례",
        title: item.display_title || item.title,
        summary: item.display_summary || item.short_summary || item.summary,
        href: item.source_url || null
      })),
      ...(harnessPacket?.supportingEvidence || []).map((item) => ({
        id: `support-${item.id}`,
        badge: item.evidence_role_label || "보조 근거",
        title: item.display_title || item.title,
        summary: item.display_summary || item.short_summary || item.summary,
        href: item.source_url || null
      }))
    ];

    if (references.length) return references.slice(0, 4);
    return data.citations.slice(0, 4).map((citation) => ({
      id: citation.id,
      badge: citation.sourceLabel,
      title: citation.title,
      summary: citation.citation || citation.summary,
      href: citation.sourceUrl || null
    }));
  }, [data.citations, harnessPacket]);
  const evidenceStats = useMemo(() => {
    const directEvidenceCount = harnessSummary?.directEvidence ?? 0;
    const sifCaseCount = harnessSummary?.sifCases ?? 0;
    const supportingEvidenceCount = harnessSummary?.supportingEvidence ?? 0;

    return [
      {
        label: "직접 근거",
        value: directEvidenceCount,
        description: selectedEvidenceLabel?.article || "문서 라벨 미지정"
      },
      {
        label: "유사사례",
        value: sifCaseCount,
        description: harnessSummary ? "검증 근거 기준" : "현재 페이지 기준"
      },
      {
        label: "인용/보조",
        value: harnessSummary ? supportingEvidenceCount + data.citations.length : data.citations.length,
        description: `${data.citations.length.toLocaleString("ko-KR")}건 화면 인용`
      }
    ];
  }, [data.citations.length, harnessSummary, selectedEvidenceLabel]);
  const selectedEvidenceCount = evidenceStats.reduce((sum, item) => sum + item.value, 0);
  const selectedDrilldownSummary = `${structuredDocument.body.length.toLocaleString("ko-KR")}섹션 · 근거 ${selectedEvidenceCount.toLocaleString("ko-KR")}건 · 확인 ${selectedQualityIssues.toLocaleString("ko-KR")}건`;

  useEffect(() => {
    onDeliverablesChangeRef.current = onDeliverablesChange;
  }, [onDeliverablesChange]);

  useEffect(() => {
    onSelectedDocumentChangeRef.current = onSelectedDocumentChange;
  }, [onSelectedDocumentChange]);

  useEffect(() => {
    if (dirtyDocumentKeys.includes("riskAssessmentDraft") || canonicalRiskText) return;
    setCanonicalRiskRows(initialRiskRows);
  }, [canonicalRiskText, dirtyDocumentKeys, initialRiskRows]);

  useEffect(() => {
    onSelectedDocumentChangeRef.current?.(selected.key);
  }, [selected.key]);

  useEffect(() => {
    if (selectedSupportingDocument) setSupportingDocumentsOpen(true);
  }, [selectedSupportingDocument]);

  useEffect(() => {
    setEditorMode("structured");
  }, [selected.key]);

  useEffect(() => {
    const sectionIds = structuredDocument.body.map((section) => section.id);
    setExpandedStructuredSectionId((current) => {
      if (current && sectionIds.includes(current)) return current;
      return sectionIds[0] ?? null;
    });
  }, [structuredDocument.body, structuredSectionIdSignature]);

  useEffect(() => () => {
    if (saveAnnouncementTimerRef.current) {
      window.clearTimeout(saveAnnouncementTimerRef.current);
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (hydratedStorageKey === storageKey) return;

    setHydratedStorageKey(null);
    const stored = parseStoredDraft(window.localStorage.getItem(storageKey), initialValues, initialRiskRows);
    const restoredDraft = stored.dirtyKeys.length > 0;
    pendingChangeRef.current = {
      source: restoredDraft ? "stored-draft" : "generated",
      requiresRevalidation: restoredDraft
    };
    setValues(stored.values);
    setDirtyDocumentKeys(stored.dirtyKeys);
    const restoredRiskRows = stored.draftRiskRows ?? stored.canonicalRiskRows ?? initialRiskRows;
    setCanonicalRiskRows(restoredRiskRows);
    setRiskRowIds(stored.riskRowIds ?? restoredRiskRows.map((_row, index) => `stored-risk-row-${index}`));
    nextRiskRowIdRef.current = restoredRiskRows.length;
    setCanonicalRiskText(stored.canonicalRiskText ?? null);
    setLastEditedAt(null);
    if (saveAnnouncementTimerRef.current) {
      window.clearTimeout(saveAnnouncementTimerRef.current);
    }
    if (restoredDraft) {
      setSaveStatusLabel("저장본 복원됨");
      setSaveAnnouncement("저장된 편집본을 복원했습니다.");
    } else {
      setSaveStatusLabel("자동 저장");
      setSaveAnnouncement("");
    }
    setHydratedStorageKey(storageKey);
  }, [hydratedStorageKey, initialRiskRows, initialValues, storageKey]);

  useEffect(() => {
    if (hydratedStorageKey !== storageKey) return;
    if (typeof window !== "undefined") {
      try {
        const storedDraft: StoredEditorDraft = {
          version: 1,
          values,
          dirtyKeys: dirtyDocumentKeys,
          draftRiskRows: canonicalRiskRows,
          riskRowIds,
          ...(canonicalRiskText
            && canonicalRiskText === values.riskAssessmentDraft
            && serializeRiskAssessmentRowsToDraft(canonicalRiskRows) === canonicalRiskText
            ? {
                canonicalRiskText,
                ...(canonicalRiskRowsAreCurrent ? { canonicalRiskRows } : {})
              }
            : {})
        };
        window.localStorage.setItem(storageKey, JSON.stringify(storedDraft));
      } catch (error) {
        console.warn("workpack local draft save failed", error);
        setSaveStatusLabel("저장 실패");
        setSaveAnnouncement("편집 내용 저장에 실패했습니다.");
      }
    }
    onDeliverablesChangeRef.current?.(values, pendingChangeRef.current);
    if (saveAnnouncementTimerRef.current) {
      window.clearTimeout(saveAnnouncementTimerRef.current);
    }
    if (pendingChangeRef.current.source === "stored-draft") {
      setSaveStatusLabel("저장본 복원됨");
      return;
    }
    if (dirtyDocumentKeys.length > 0) {
      const savedAt = lastEditedAt;
      setSaveStatusLabel("저장 중...");
      setSaveAnnouncement("");
      saveAnnouncementTimerRef.current = window.setTimeout(() => {
        const timeLabel = (savedAt || new Date()).toLocaleTimeString("ko-KR", {
          hour: "2-digit",
          minute: "2-digit"
        });
        setSaveStatusLabel(`저장됨 ${timeLabel}`);
        setSaveAnnouncement(`저장됨 ${timeLabel}`);
      }, SAVE_ANNOUNCEMENT_DELAY_MS);
      return;
    }
    setSaveStatusLabel("자동 저장");
    setSaveAnnouncement("");
  }, [canonicalRiskRows, canonicalRiskRowsAreCurrent, canonicalRiskText, dirtyDocumentKeys, hydratedStorageKey, lastEditedAt, riskRowIds, storageKey, values]);

  useEffect(() => {
    if (!focusToken) return;

    if (requestedDocumentKey) {
      setSelectedKey(requestedDocumentKey);
    }
    setShowFocusCue(true);
    const root = document.documentElement;
    const previousScrollBehavior = root.style.scrollBehavior;
    root.style.scrollBehavior = "auto";
    documentBodyRef.current?.scrollIntoView({ behavior: "auto", block: "start" });
    root.style.scrollBehavior = previousScrollBehavior;
    const focusFrame = window.requestAnimationFrame(() => {
      textareaRef.current?.focus({ preventScroll: true });
    });
    const focusTimer = window.setTimeout(() => textareaRef.current?.focus({ preventScroll: true }), 120);
    const backupFocusTimer = window.setTimeout(() => textareaRef.current?.focus({ preventScroll: true }), 320);
    const timer = window.setTimeout(() => setShowFocusCue(false), 2200);
    return () => {
      window.cancelAnimationFrame(focusFrame);
      window.clearTimeout(focusTimer);
      window.clearTimeout(backupFocusTimer);
      window.clearTimeout(timer);
    };
  }, [focusToken, requestedDocumentKey]);

  function alignPaneTargetBelowToolbar(target: HTMLElement | null) {
    const shell = workpackShellRef.current;
    if (!shell || !target || shell.scrollHeight <= shell.clientHeight) return;

    const shellRect = shell.getBoundingClientRect();
    const targetRect = target.getBoundingClientRect();
    const toolbar = documentBodyRef.current?.querySelector<HTMLElement>(".document-toolbar") || null;
    const toolbarRect = toolbar?.getBoundingClientRect();
    const visibleTop = toolbarRect && toolbarRect.bottom > shellRect.top && toolbarRect.top < shellRect.bottom
      ? toolbarRect.bottom
      : shellRect.top;
    const comfortableTargetTop = Math.min(
      shellRect.bottom - 80,
      visibleTop + Math.max(32, shell.clientHeight * 0.18)
    );
    const targetIsVisible = targetRect.bottom > visibleTop
      && targetRect.top >= visibleTop
      && targetRect.top <= comfortableTargetTop;
    if (targetIsVisible) return;

    const padding = 8;
    const nextScrollTop = shell.scrollTop + targetRect.top - visibleTop - padding;
    shell.scrollTo({
      top: Math.max(0, nextScrollTop),
      behavior: "auto"
    });
  }

  useLayoutEffect(() => {
    if (!expandedStructuredSectionId) return;
    const firstSectionId = structuredDocument.body[0]?.id ?? null;
    const shouldPreferRiskRow = selected.key === "riskAssessmentDraft" && expandedStructuredSectionId === firstSectionId;
    const riskRowTarget = shouldPreferRiskRow
      ? documentBodyRef.current?.querySelector<HTMLElement>('[data-testid="risk-row-editor-row"]')
        || documentBodyRef.current?.querySelector<HTMLElement>('[data-testid="risk-rows-editor"]')
        || null
      : null;
    if (riskRowTarget) {
      alignPaneTargetBelowToolbar(riskRowTarget);
      return;
    }
    const tbmCockpitTarget = isTbmDocumentKey(selected.key)
      ? documentBodyRef.current?.querySelector<HTMLElement>('[data-testid="tbm-document-cockpit"]') || null
      : null;
    if (tbmCockpitTarget) {
      alignPaneTargetBelowToolbar(tbmCockpitTarget);
      return;
    }
    const executionCockpitTarget = isExecutionDocumentKey(selected.key)
      ? documentBodyRef.current?.querySelector<HTMLElement>('[data-testid="execution-document-cockpit"]') || null
      : null;
    if (executionCockpitTarget) {
      alignPaneTargetBelowToolbar(executionCockpitTarget);
      return;
    }
    const educationCockpitTarget = isEducationDocumentKey(selected.key)
      ? documentBodyRef.current?.querySelector<HTMLElement>('[data-testid="education-document-cockpit"]') || null
      : null;
    if (educationCockpitTarget) {
      alignPaneTargetBelowToolbar(educationCockpitTarget);
      return;
    }
    const emergencyCockpitTarget = isEmergencyDocumentKey(selected.key)
      ? documentBodyRef.current?.querySelector<HTMLElement>('[data-testid="emergency-document-cockpit"]') || null
      : null;
    if (emergencyCockpitTarget) {
      alignPaneTargetBelowToolbar(emergencyCockpitTarget);
      return;
    }
    const photoCockpitTarget = isPhotoEvidenceDocumentKey(selected.key)
      ? documentBodyRef.current?.querySelector<HTMLElement>('[data-testid="photo-document-cockpit"]') || null
      : null;
    if (photoCockpitTarget) {
      alignPaneTargetBelowToolbar(photoCockpitTarget);
      return;
    }
    const transmissionCockpitTarget = isTransmissionDocumentKey(selected.key)
      ? documentBodyRef.current?.querySelector<HTMLElement>('[data-testid="transmission-document-cockpit"]') || null
      : null;
    if (transmissionCockpitTarget) {
      alignPaneTargetBelowToolbar(transmissionCockpitTarget);
      return;
    }
    const activeSection = Array.from(
      documentBodyRef.current?.querySelectorAll<HTMLElement>("[data-section-id]") || []
    ).find((section) => section.dataset.sectionId === expandedStructuredSectionId) || null;
    const target = activeSection?.querySelector<HTMLElement>("textarea")
      || activeSection?.querySelector<HTMLElement>('[data-testid="document-section-field-strip"]')
      || activeSection
      || null;
    alignPaneTargetBelowToolbar(target);
  }, [expandedStructuredSectionId, selected.key, structuredDocument.body]);

  useLayoutEffect(() => {
    const alignSelectedDocument = () => {
      const target = selected.key === "riskAssessmentDraft"
        ? documentBodyRef.current?.querySelector<HTMLElement>('[data-testid="risk-row-editor-row"]')
          || documentBodyRef.current?.querySelector<HTMLElement>('[data-testid="risk-rows-editor"]')
          || documentBodyRef.current?.querySelector<HTMLElement>('[data-testid="document-section-field-strip"]')
          || null
        : isTbmDocumentKey(selected.key)
          ? documentBodyRef.current?.querySelector<HTMLElement>('[data-testid="tbm-document-cockpit"]')
            || documentBodyRef.current?.querySelector<HTMLElement>('[data-testid="document-section-field-strip"]')
            || null
        : isExecutionDocumentKey(selected.key)
          ? documentBodyRef.current?.querySelector<HTMLElement>('[data-testid="execution-document-cockpit"]')
            || documentBodyRef.current?.querySelector<HTMLElement>('[data-testid="document-section-field-strip"]')
            || null
        : isEducationDocumentKey(selected.key)
          ? documentBodyRef.current?.querySelector<HTMLElement>('[data-testid="education-document-cockpit"]')
            || documentBodyRef.current?.querySelector<HTMLElement>('[data-testid="document-section-field-strip"]')
            || null
        : isEmergencyDocumentKey(selected.key)
          ? documentBodyRef.current?.querySelector<HTMLElement>('[data-testid="emergency-document-cockpit"]')
            || documentBodyRef.current?.querySelector<HTMLElement>('[data-testid="document-section-field-strip"]')
            || null
        : isPhotoEvidenceDocumentKey(selected.key)
          ? documentBodyRef.current?.querySelector<HTMLElement>('[data-testid="photo-document-cockpit"]')
            || documentBodyRef.current?.querySelector<HTMLElement>('[data-testid="document-section-field-strip"]')
            || null
        : isTransmissionDocumentKey(selected.key)
          ? documentBodyRef.current?.querySelector<HTMLElement>('[data-testid="transmission-document-cockpit"]')
            || documentBodyRef.current?.querySelector<HTMLElement>('[data-testid="document-section-field-strip"]')
            || null
        : documentBodyRef.current?.querySelector<HTMLElement>('[data-testid="document-section-field-strip"]')
        || textareaRef.current
        || documentBodyRef.current;
      alignPaneTargetBelowToolbar(target);
    };
    const alignFrame = window.requestAnimationFrame(alignSelectedDocument);
    const alignTimer = window.setTimeout(alignSelectedDocument, 80);
    return () => {
      window.cancelAnimationFrame(alignFrame);
      window.clearTimeout(alignTimer);
    };
  }, [selected.key]);

  function updateValue(value: string, options: { preserveCanonicalRiskRows?: boolean } = {}) {
    pendingChangeRef.current = { source: "user-edit", requiresRevalidation: true };
    if (selected.key === "riskAssessmentDraft" && !options.preserveCanonicalRiskRows) {
      setCanonicalRiskText(null);
    }
    setValues((current) => ({ ...current, [selected.key]: value }));
    setDirtyDocumentKeys((current) => current.includes(selected.key) ? current : [...current, selected.key]);
    setLastEditedAt(new Date());
  }

  function syncCanonicalRiskRows(nextRows: RiskAssessmentRow[]) {
    const serialized = serializeRiskAssessmentRowsToDraft(nextRows);
    setCanonicalRiskRows(nextRows);
    setCanonicalRiskText(serialized);
    updateValue(serialized, { preserveCanonicalRiskRows: true });
  }

  function updateCanonicalRiskRow<K extends keyof RiskAssessmentRow>(
    rowIndex: number,
    field: K,
    value: RiskAssessmentRow[K]
  ) {
    const nextRows = canonicalRiskRows.map((row, index) => (
      index === rowIndex ? updateRiskAssessmentRowField(row, field, value) : row
    ));
    syncCanonicalRiskRows(nextRows);
  }

  function addCanonicalRiskRow() {
    const nextId = `draft-risk-row-${Date.now()}-${nextRiskRowIdRef.current}`;
    nextRiskRowIdRef.current += 1;
    setRiskRowIds((current) => [...current, nextId]);
    syncCanonicalRiskRows([...canonicalRiskRows, createEmptyRiskAssessmentRow(data)]);
  }

  function removeCanonicalRiskRow(rowIndex: number) {
    setRiskRowIds((current) => current.filter((_id, index) => index !== rowIndex));
    syncCanonicalRiskRows(canonicalRiskRows.filter((_row, index) => index !== rowIndex));
  }

  function confirmStructuredRiskEdit() {
    syncCanonicalRiskRows(canonicalRiskRows);
  }

  function updateStructuredSection(sectionId: string, value: string) {
    const section = structuredDocument.body.find((item) => item.id === sectionId);
    if (!section) {
      console.error("structured document section is unavailable", { sectionId, documentKey: selected.key });
      setSaveStatusLabel("저장 실패");
      return;
    }
    try {
      updateValue(replaceStructuredDocumentSection(selectedText, section, value));
    } catch (error) {
      console.error("structured document section update failed", error);
      setSaveStatusLabel("저장 실패");
    }
  }

  function openDocumentUtilityPanel(targetTestId: "editor-evidence-panel" | "editor-quality-panel") {
    const root = workpackShellRef.current || documentBodyRef.current;
    const drawer = root?.querySelector<HTMLDetailsElement>('[data-testid="editor-provenance-drawer"]');
    if (drawer) drawer.open = true;
    window.requestAnimationFrame(() => {
      const target = root?.querySelector<HTMLElement>(`[data-testid="${targetTestId}"]`) || null;
      alignPaneTargetBelowToolbar(target);
      target?.focus({ preventScroll: true });
    });
  }

  function selectDocumentKey(key: DocumentKey) {
    if (supportingDocumentMeta.some((item) => item.key === key)) {
      setSupportingDocumentsOpen(true);
    }
    setSelectedKey(key);
    window.requestAnimationFrame(() => {
      document.getElementById(documentTabId(key))?.focus();
    });
  }

  function handleDocumentTabKeyDown(event: ReactKeyboardEvent<HTMLButtonElement>, key: DocumentKey, keys: readonly DocumentKey[]) {
    let nextIndex: number | null = null;
    const index = keys.indexOf(key);
    if (index < 0) return;
    if (event.key === "ArrowRight" || event.key === "ArrowDown") {
      nextIndex = (index + 1) % keys.length;
    } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
      nextIndex = (index - 1 + keys.length) % keys.length;
    } else if (event.key === "Home") {
      nextIndex = 0;
    } else if (event.key === "End") {
      nextIndex = keys.length - 1;
    }

    if (nextIndex === null) return;
    event.preventDefault();
    selectDocumentKey(keys[nextIndex]);
  }

  function updateRemediationDraft(itemId: string, text: string) {
    setRemediationDrafts((current) => {
      const existing = current[itemId];
      if (!existing) return current;
      return {
        ...current,
        [itemId]: {
          ...existing,
          text
        }
      };
    });
  }

  function insertRemediationDraft(itemId: string) {
    const draft = remediationDrafts[itemId];
    if (!draft || !draft.text.trim()) return;
    const separator = selectedText.trim() ? "\n\n" : "";
    updateValue(`${selectedText.trimEnd()}${separator}${draft.text.trim()}`);
    setRemediationDrafts((current) => {
      const next = { ...current };
      delete next[itemId];
      return next;
    });
    window.setTimeout(() => textareaRef.current?.focus({ preventScroll: true }), 80);
  }

  async function requestRemediation(item: RubricEvaluationItem) {
    setRemediationLoadingId(item.id);
    try {
      const response = await fetch("/api/workpack/remediate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          question: data.question,
          documentKey: selected.key,
          documentText: selectedText,
          rubricItemId: item.id
        })
      });
      const payload = await response.json().catch(() => null) as unknown;
      const draft = readRemediationDraft(item.id, payload);
      setRemediationDrafts((current) => ({
        ...current,
        [item.id]: response.ok ? draft : { ...draft, status: "error" }
      }));
    } catch (error) {
      console.error("workpack remediation request failed", error);
      setRemediationDrafts((current) => ({
        ...current,
        [item.id]: {
          itemId: item.id,
          text: "",
          status: "error",
          message: "보완 제안 요청 중 오류가 발생했습니다.",
          providerLabel: null,
          policyNote: "",
          catalogStatus: null,
          sources: []
        }
      }));
    } finally {
      setRemediationLoadingId(null);
    }
  }

  function downloadText() {
    downloadBlob(new Blob([selectedText], { type: "text/plain;charset=utf-8" }), `${baseName}.txt`);
  }

  function downloadJson() {
    const payload = {
      title: selected.title,
      scenario: data.scenario,
      document: selectedText,
      generatedAt: new Date().toISOString()
    };
    downloadBlob(new Blob([JSON.stringify(payload, null, 2)], { type: "application/json;charset=utf-8" }), `${baseName}.json`);
  }

  function downloadHtml() {
    downloadBlob(
      new Blob([buildHtml(selected.title, selectedRows, data.scenario, selectedFormProfile, data, riskAssessmentRows)], { type: "text/html;charset=utf-8" }),
      `${baseName}.html`
    );
  }

  function downloadCsv() {
    const rows = buildRowsForDocument(selected, values);
    downloadBlob(new Blob([`\uFEFF${buildDelimited(rows, ",")}`], { type: "text/csv;charset=utf-8" }), `${baseName}.csv`);
  }

  function downloadXls() {
    // Legacy HTML-as-.xls — kept for backward compatibility but new UI prefers downloadXlsx().
    downloadBlob(
      new Blob([buildExcelHtml(selected.title, selectedRows, data.scenario, selectedFormProfile, data, riskAssessmentRows)], { type: "application/vnd.ms-excel;charset=utf-8" }),
      `${baseName}.xls`
    );
  }

  async function downloadXlsx() {
    setXlsxStatus("building");
    try {
      // schema-first 경로: AI가 셀 단위 객체를 반환했으면 산문 → row parser → table 경로 우회.
      // parseSheetRows 손실 없이 표 양식에 직접 매핑.
      const dl = data.deliverables as {
        workPlanStructured?: unknown;
        permitInspectionStructured?: unknown;
        tbmBriefingStructured?: unknown;
        tbmLogStructured?: unknown;
        educationRecordStructured?: unknown;
      };
      type StructuredMode = "workPlanStructured" | "permitInspectionStructured" | "tbmBriefingStructured" | "tbmLogStructured" | "educationRecordStructured";
      let structuredMode: StructuredMode | null = null;
      let structuredPayload: unknown = null;
      if (selected.key === "workPlanDraft" && dl?.workPlanStructured) {
        structuredMode = "workPlanStructured";
        structuredPayload = dl.workPlanStructured;
      } else if (selected.key === "workPermitDraft" && !selectedHasIntentionalEmptyPermitDraft) {
        structuredMode = "permitInspectionStructured";
        structuredPayload = dl?.permitInspectionStructured || buildPermitInspectionStructured(data);
      } else if (selected.key === "tbmBriefing" && dl?.tbmBriefingStructured) {
        structuredMode = "tbmBriefingStructured";
        structuredPayload = dl.tbmBriefingStructured;
      } else if (selected.key === "tbmLogDraft" && dl?.tbmLogStructured) {
        structuredMode = "tbmLogStructured";
        structuredPayload = dl.tbmLogStructured;
      } else if (selected.key === "safetyEducationRecordDraft" && dl?.educationRecordStructured) {
        structuredMode = "educationRecordStructured";
        structuredPayload = dl.educationRecordStructured;
      }
      const requestBody = structuredMode
        ? {
            mode: structuredMode,
            edited: selectedUsesEditedText,
            scenario: data.scenario,
            structured: structuredPayload,
            rows: selectedRows
          }
        : {
            mode: "single",
            edited: selectedUsesEditedText && !selectedUsesCanonicalRiskRows,
            title: selected.title,
            rows: selectedRows,
            profile: selectedFormProfile,
            scenario: data.scenario,
            riskAssessmentRows: selectedUsesCanonicalRiskRows
              ? canonicalRiskRows
              : selectedUsesEditedText ? undefined : data.structured?.riskAssessmentRows
          };
      const response = await fetch("/api/export/xlsx", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(requestBody)
      });
      if (!response.ok) {
        throw new Error(`xlsx export failed (${response.status})`);
      }
      const blob = await response.blob();
      downloadBlob(blob, `${baseName}.xlsx`);
      setXlsxStatus("idle");
    } catch (error) {
      console.error("xlsx export failed", error);
      setXlsxStatus("error");
    }
  }

  async function downloadHwp() {
    setHwpStatus("building");
    try {
      const response = await fetch("/api/export/hwp", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          edited: selectedUsesEditedText && !selectedUsesCanonicalRiskRows,
          title: selected.title,
          rows: selectedRows,
          profile: selectedFormProfile,
          scenario: data.scenario,
          riskAssessmentRows: selectedUsesCanonicalRiskRows
            ? canonicalRiskRows
            : selectedUsesEditedText ? undefined : data.structured?.riskAssessmentRows
        })
      });
      if (!response.ok) {
        throw new Error(`hwp export failed (${response.status})`);
      }
      const blob = await response.blob();
      downloadBlob(blob, `${baseName}.hwp`);
      setHwpStatus("idle");
    } catch (error) {
      console.error("hwp export failed", error);
      setHwpStatus("error");
    }
  }


  function downloadDoc() {
    downloadBlob(
      new Blob([buildWordHtml(selected.title, selectedRows, data.scenario, selectedFormProfile, data, riskAssessmentRows)], { type: "application/msword;charset=utf-8" }),
      `${baseName}.doc`
    );
  }

  function downloadJpg() {
    setImageStatus("idle");
    const markup = buildSafetyFormMarkup(selected.title, selectedRows, data.scenario, selectedFormProfile, data, riskAssessmentRows);
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1240" height="1754">
      <rect width="100%" height="100%" fill="#fafafb"/>
      <foreignObject x="34" y="34" width="1172" height="1686">
        <div xmlns="http://www.w3.org/1999/xhtml">
          <style>${formCss("0")}</style>
          ${markup}
        </div>
      </foreignObject>
    </svg>`;
    const image = new Image();
    const svgUrl = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml;charset=utf-8" }));
    image.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = 1240;
      canvas.height = 1754;
      const context = canvas.getContext("2d");
      if (!context) return;
      context.fillStyle = "#fafafb";
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(image, 0, 0);
      canvas.toBlob((blob) => {
        if (blob) downloadBlob(blob, `${baseName}.jpg`);
        URL.revokeObjectURL(svgUrl);
      }, "image/jpeg", 0.92);
    };
    image.onerror = () => {
      console.error("JPG export failed: SVG image could not be rendered");
      URL.revokeObjectURL(svgUrl);
      setImageStatus("error");
    };
    image.src = svgUrl;
  }

  async function downloadHwpx() {
    setHwpxStatus("building");
    try {
      const blob = await buildHwpxWithRhwp(buildHwpTemplateText(selected.title, selectedRows, selectedFormProfile, data.scenario, data, riskAssessmentRows));
      downloadBlob(blob, `${baseName}.hwpx`);
      setHwpxStatus("idle");
    } catch (error) {
      console.error("rhwp HWPX export failed", error);
      setHwpxStatus("error");
    }
  }

  function downloadAll() {
    const combined = buildCombinedText(values);
    downloadBlob(new Blob([combined], { type: "text/plain;charset=utf-8" }), `${sanitizeFileName(data.scenario.companyName)}-safeclaw-workpack.txt`);
  }

  function downloadAllCsv() {
    const rows = buildLaunchSheetRows(values);
    downloadBlob(new Blob([`\uFEFF${buildDelimited(rows, ",")}`], { type: "text/csv;charset=utf-8" }), `${sanitizeFileName(data.scenario.companyName)}-safeclaw-workpack.csv`);
  }

  function downloadAllXls() {
    const rows = buildLaunchSheetRows(values);
    downloadBlob(new Blob([buildLaunchWorkbookHtml("SafeClaw 문서팩", rows)], { type: "application/vnd.ms-excel;charset=utf-8" }), `${sanitizeFileName(data.scenario.companyName)}-safeclaw-workpack.xls`);
  }

  function downloadSheetsTsv() {
    const rows = buildLaunchSheetRows(values);
    downloadBlob(
      new Blob([`\uFEFF${buildDelimited(rows, "\t")}`], { type: "text/tab-separated-values;charset=utf-8" }),
      `${sanitizeFileName(data.scenario.companyName)}-google-sheets.tsv`
    );
  }

  function downloadTemplate() {
    if (templateKind === "sheet") {
      downloadXls();
      return;
    }
    if (templateKind === "word") {
      downloadDoc();
      return;
    }
    void downloadHwpx();
  }

  async function copySheetsTsv() {
    const confirmed = window.confirm("새 Google Sheets를 열고 표 데이터를 클립보드에 복사합니다. 열린 빈 시트의 A1 셀에 Ctrl+V로 붙여넣으면 문서팩 표가 들어갑니다.");
    if (!confirmed) return;

    const rows = buildLaunchSheetRows(values);
    const sheetWindow = window.open("https://sheets.new", "_blank", "noopener,noreferrer");
    try {
      await navigator.clipboard.writeText(buildDelimited(rows, "\t"));
      setSheetStatus("copied");
      if (!sheetWindow) {
        window.location.href = "https://sheets.new";
      }
    } catch (error) {
      console.error("Google Sheets TSV copy failed", error);
      setSheetStatus("error");
      downloadSheetsTsv();
      if (!sheetWindow) {
        window.location.href = "https://sheets.new";
      }
    }
  }

  async function printPdf() {
    const popup = window.open("", "_blank", "width=900,height=1100");
    if (!popup) {
      console.error("PDF print window was blocked");
      downloadHtml();
      return;
    }
    popup.document.write("<!doctype html><html lang=\"ko\"><head><meta charset=\"utf-8\" /><title>SafeClaw PDF 준비 중</title></head><body><p>제출용 PDF 화면을 준비하고 있습니다.</p></body></html>");
    popup.document.close();

    try {
      const response = await fetch("/api/export/pdf?format=html", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          title: selected.title,
          scenario: data.scenario,
          rows: selectedRows,
          riskRows: riskAssessmentRows,
          documentText: selectedText,
          riskLevel: data.riskSummary.riskLevel,
          topRisk: data.riskSummary.topRisk
        })
      });
      if (!response.ok) {
        throw new Error(`PDF print source failed with ${response.status}`);
      }
      const contentType = response.headers.get("content-type") || "";
      if (!contentType.includes("text/html")) {
        throw new Error(`PDF print source returned unexpected content type: ${contentType || "unknown"}`);
      }
      const html = await response.text();
      popup.document.open();
      popup.document.write(html);
      popup.document.close();
      popup.focus();
      popup.print();
    } catch (error) {
      console.error("server PDF print source failed", error);
      popup.document.open();
      popup.document.write(buildHtml(selected.title, selectedRows, data.scenario, selectedFormProfile, data, riskAssessmentRows));
      popup.document.close();
      popup.focus();
      popup.print();
    }
  }

  const renderDocumentTab = (item: (typeof documentMeta)[number], keys: readonly DocumentKey[]) => {
    const documentIndex = documentMeta.findIndex((candidate) => candidate.key === item.key);
    return (
      <button
        key={item.key}
        id={documentTabId(item.key)}
        type="button"
        role="tab"
        className={`doc-tab ${item.key === selected.key ? "active" : ""}`}
        onClick={() => selectDocumentKey(item.key)}
        onKeyDown={(event) => handleDocumentTabKeyDown(event, item.key, keys)}
        aria-selected={item.key === selected.key}
        aria-controls="workpack-document-body"
        tabIndex={item.key === selected.key ? 0 : -1}
      >
        <span className={styles.documentIndex}>{String(documentIndex + 1).padStart(2, "0")}</span>
        <strong>{item.title}</strong>
        <span className={styles.documentDescription}>{item.description}</span>
      </button>
    );
  };

  return (
    <section
      className={`workpack-shell ${styles.workspace}`}
      id="workpack"
      data-testid="workpack-editor-workspace"
      ref={workpackShellRef}
    >
      <aside className={`workpack-sidebar card list ${styles.navigator}`} aria-label="문서팩 문서 목록">
        <div className={styles.navigatorHeader}>
          <div className="eyebrow">문서팩</div>
          <div className="h2">오늘 문서</div>
          <p className="muted">{documentMeta.length.toLocaleString("ko-KR")}개 문서 · 브라우저 자동 저장</p>
        </div>

        <label className={styles.mobileDocumentPicker}>
          <span>편집 문서</span>
          <select
            aria-label="편집 문서 선택"
            value={selected.key}
            onChange={(event) => setSelectedKey(event.target.value as DocumentKey)}
          >
            {documentMeta.map((item) => (
              <option key={item.key} value={item.key}>{item.title}</option>
            ))}
          </select>
        </label>

        <div className={`doc-tab-list ${styles.documentTabs}`} role="tablist" aria-label="핵심 문서 선택">
          {coreDocumentMeta.map((item) => renderDocumentTab(item, CORE_DOCUMENT_KEYS))}
        </div>

        <details
          className={styles.supportingDocumentGroup}
          data-testid="supporting-document-group"
          open={supportingDocumentsOpen || selectedSupportingDocument}
          onToggle={(event) => setSupportingDocumentsOpen(event.currentTarget.open)}
        >
          <summary>
            <span>지원 문서 {supportingDocumentMeta.length.toLocaleString("ko-KR")}종</span>
            <strong>{selectedSupportingDocument ? selected.title : "제출·교육·전송 세부 문서"}</strong>
          </summary>
          <div className={`doc-tab-list ${styles.documentTabs} ${styles.supportingDocumentTabs}`} role="tablist" aria-label="지원 문서 선택">
            {supportingDocumentMeta.map((item) => renderDocumentTab(item, SUPPORTING_DOCUMENT_KEYS))}
          </div>
        </details>
      </aside>

      <div className={`card document-editor ${styles.editor} ${showFocusCue ? "editor-focus-cue" : ""}`}>
        <div
          className={styles.documentBody}
          id="workpack-document-body"
          data-testid="editor-document-body"
          role="tabpanel"
          aria-labelledby={documentTabId(selected.key)}
          ref={documentBodyRef}
        >
          <header className={`document-toolbar ${styles.documentHeader}`}>
            <div className={styles.documentHeading}>
              <div className="eyebrow">문서 본문</div>
              <div className="h2">{selected.title}</div>
              <p className="muted">{selected.description}</p>
            </div>
            <div className={`editor-document-meta ${styles.documentMeta}`}>
              <span className={`editor-save-state ${styles.saveState}`}>{saveStatusLabel}</span>
              <span data-testid="selected-document-drilldown-summary">{selectedDrilldownSummary}</span>
              <span>{selectedText.length.toLocaleString("ko-KR")}자</span>
              {lastEditedAt ? (
                <span>수정 {lastEditedAt.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })}</span>
              ) : null}
              <span
                data-testid="editor-save-status"
                role="status"
                aria-live="polite"
                className={styles.visuallyHidden}
              >
                {saveAnnouncement}
              </span>
            </div>
          </header>

          {showFocusCue ? (
            <p className={`editor-focus-message ${styles.focusMessage}`}>
              {selected.title} 본문 편집을 시작합니다.
            </p>
          ) : null}

          <div className={styles.editorModeBar}>
            <div>
              <span className="eyebrow">문서 유형</span>
              <strong>{structuredDocument.profile.label}</strong>
            </div>
            <div className={styles.editorModeControl} role="group" aria-label="본문 편집 방식">
              <button
                type="button"
                aria-pressed={editorMode === "structured"}
                onClick={() => setEditorMode("structured")}
              >
                구조화
              </button>
              <button
                type="button"
                aria-pressed={editorMode === "source"}
                onClick={() => setEditorMode("source")}
              >
                원문
              </button>
            </div>
          </div>

          {editorMode === "structured" ? (
            <div
              className={styles.structuredEditor}
              data-testid="document-structured-editor"
              data-editor-kind={structuredDocument.profile.kind}
            >
              {selected.key === "riskAssessmentDraft" ? (
                <RiskAssessmentRowsEditor
                  rows={canonicalRiskRows}
                  rowIds={riskRowIds}
                  validation={canonicalRiskValidation}
                  isCurrent={canonicalRiskRowsAreCurrent}
                  isLocked={structuredRiskEditLocked}
                  onConfirmStructuredEdit={confirmStructuredRiskEdit}
                  onRowChange={updateCanonicalRiskRow}
                  onFieldFocus={alignPaneTargetBelowToolbar}
                  onAdd={addCanonicalRiskRow}
                  onRemove={removeCanonicalRiskRow}
                />
              ) : null}
              {isTbmDocumentKey(selected.key) ? (
                <TbmDocumentCockpit data={data} documentKey={selected.key} />
              ) : null}
              {isExecutionDocumentKey(selected.key) ? (
                <WorkExecutionDocumentCockpit data={data} documentKey={selected.key} />
              ) : null}
              {isEducationDocumentKey(selected.key) ? (
                <EducationDocumentCockpit data={data} documentKey={selected.key} />
              ) : null}
              {isEmergencyDocumentKey(selected.key) ? (
                <EmergencyDocumentCockpit data={data} documentKey={selected.key} />
              ) : null}
              {isPhotoEvidenceDocumentKey(selected.key) ? (
                <PhotoEvidenceDocumentCockpit data={data} documentKey={selected.key} />
              ) : null}
              {isTransmissionDocumentKey(selected.key) ? (
                <TransmissionDocumentCockpit data={data} documentKey={selected.key} />
              ) : null}
              {structuredDocument.body.map((section, index) => {
                const inputId = `document-section-${selected.key}-${index}`;
                const sectionLineCount = section.value.split(/\r?\n/u).filter((line) => line.trim().length > 0).length;
                const lineCount = Math.min(5, Math.max(3, section.value.split(/\r?\n/u).length + 1));
                const isSectionOpen = expandedStructuredSectionId === section.id;
                const selectSection = () => setExpandedStructuredSectionId(section.id);
                return (
                  <details
                    key={section.id}
                    className={styles.documentSection}
                    data-testid="document-section-accordion"
                    data-section-kind="body"
                    data-section-id={section.id}
                    data-section-open={isSectionOpen ? "true" : "false"}
                    open={isSectionOpen}
                  >
                    <summary
                      aria-expanded={isSectionOpen}
                      onClick={(event) => {
                        event.preventDefault();
                        selectSection();
                      }}
                      onKeyDown={(event) => {
                        if (event.key !== "Enter" && event.key !== " ") return;
                        event.preventDefault();
                        selectSection();
                      }}
                    >
                      <span>{String(index + 1).padStart(2, "0")}</span>
                      <strong>{section.label}</strong>
                      <em className={styles.documentSectionMeta}>
                        {sectionLineCount.toLocaleString("ko-KR")}줄 · {isSectionOpen ? "편집 중" : "펼치기"}
                      </em>
                    </summary>
                    {isSectionOpen ? (
                      <div className={styles.documentSectionFieldStrip} data-testid="document-section-field-strip">
                        <span>
                          <b>{selected.key === "riskAssessmentDraft" ? "첫 위험행" : "현재 편집 필드"}</b>
                          <strong>
                            {selected.key === "riskAssessmentDraft"
                              ? canonicalRiskRows[0]?.task || canonicalRiskRows[0]?.hazard || section.label
                              : section.label}
                          </strong>
                        </span>
                        <span>
                          <b>{selected.key === "riskAssessmentDraft" ? "4M/등급" : "근거"}</b>
                          <strong>
                            {selected.key === "riskAssessmentDraft" && canonicalRiskRows[0]
                              ? `${canonicalRiskRows[0].fourM} · ${canonicalRiskRows[0].riskLevel}`
                              : `${selectedRows.length.toLocaleString("ko-KR")}건 연결`}
                          </strong>
                        </span>
                        <span>
                          <b>{selected.key === "riskAssessmentDraft" ? "근거/점검" : "점검"}</b>
                          <strong>
                            {selected.key === "riskAssessmentDraft"
                              ? `${(canonicalRiskRows[0]?.evidenceRefs.length ?? selectedRows.length).toLocaleString("ko-KR")}건 · ${selectedUsesEditedText ? "재확인" : "초안"}`
                              : selectedUsesEditedText ? "수정본 재확인" : "초안 확인"}
                          </strong>
                        </span>
                      </div>
                    ) : null}
                    {isSectionOpen ? (
                      <div className={styles.documentSectionActions} data-testid="document-section-actions">
                        <button type="button" onClick={() => openDocumentUtilityPanel("editor-evidence-panel")}>
                          근거 보기
                        </button>
                        <button type="button" onClick={() => openDocumentUtilityPanel("editor-quality-panel")}>
                          점검 보기
                        </button>
                      </div>
                    ) : null}
                    <textarea
                      id={inputId}
                      ref={index === 0 ? textareaRef : undefined}
                      className={`document-textarea document-section-textarea ${styles.sectionTextarea}`}
                      value={section.value}
                      rows={lineCount}
                      onChange={(event) => updateStructuredSection(section.id, event.target.value)}
                      aria-label={index === 0 ? `${selected.title} 편집` : `${selected.title} ${section.label} 편집`}
                    />
                  </details>
                );
              })}
            </div>
          ) : (
            <textarea
              ref={textareaRef}
              className={`document-textarea document-source-textarea ${styles.sourceTextarea}`}
              value={selectedText}
              rows={Math.min(16, Math.max(12, selectedText.split(/\r?\n/u).length + 1))}
              onChange={(event) => updateValue(event.target.value)}
              aria-label={`${selected.title} 전체 원문 편집`}
            />
          )}
          <p className={`muted small ${styles.documentFootnote}`}>
            발주처 원본 양식, 직인, 결재선은 제출 전 확인 대상입니다.
          </p>
        </div>

        <div className={styles.secondaryTools} data-testid="editor-secondary-tools" aria-label="문서 보조 도구">
          <details className={styles.utilityPanel} data-testid="editor-provenance-drawer">
            <summary className={styles.utilitySummary}>
              <span>
                <b>
                  근거 {evidenceStats.reduce((sum, item) => sum + item.value, 0).toLocaleString("ko-KR")}건 · 확인 필요 {selectedQualityIssues.toLocaleString("ko-KR")}건
                </b>
              </span>
            </summary>
            <div className={`${styles.utilityContent} ${styles.provenanceContent}`}>
            <section className={styles.provenanceSection} data-testid="editor-evidence-panel" tabIndex={-1}>
              <div className={styles.sectionHeading}>
                <div>
                  <span className="eyebrow">생성 근거</span>
                  <strong>{selected.title}에 연결된 근거</strong>
                </div>
                <a className="knowledge-link" href="/knowledge">지식 DB</a>
              </div>
              <div className="rubric-stack">
                {evidenceStats.map((item) => (
                  <div key={item.label} className="rubric-item fulfilled">
                    <span>{item.label}</span>
                    <strong>{item.value.toLocaleString("ko-KR")}건</strong>
                    <em>{item.description}</em>
                  </div>
                ))}
              </div>
              {evidenceHighlights.length ? (
                <div className={styles.evidenceList}>
                  {evidenceHighlights.map((item) => item.href ? (
                    <a key={item.id} href={item.href} target="_blank" rel="noreferrer">
                      <span>{item.badge}</span>
                      <strong>{item.title}</strong>
                      <small>{item.summary}</small>
                    </a>
                  ) : (
                    <article key={item.id}>
                      <span>{item.badge}</span>
                      <strong>{item.title}</strong>
                      <small>{item.summary}</small>
                    </article>
                  ))}
                </div>
              ) : (
                <p className="muted small">연결된 출처가 없습니다. 제출 전 근거 확인이 필요합니다.</p>
              )}
              {selectedCoverage ? (
                <p className="muted small">
                  {selectedCoverage.document} 커버리지: {selectedCoverage.covered ? "연결됨" : "보강 필요"}
                  {selectedCoverage.evidenceTypes.length ? ` · ${selectedCoverage.evidenceTypes.join(" · ")}` : ""}
                </p>
              ) : null}
            </section>

          <section className={styles.provenanceSection} data-testid="editor-quality-panel" tabIndex={-1}>
            <div className={`${styles.utilityContent} ${styles.qualityContent}`}>
              <div className={styles.sectionHeading}>
                <div>
                  <span className="eyebrow">현재 문서</span>
                  <strong>{selected.title} 제출 전 점검</strong>
                </div>
              </div>
              <div className="selected-rubric-strip" aria-label={`${selected.title} 제출 전 점검`}>
                {selectedRubricItems.length ? selectedRubricItems.map((item) => {
                  const draft = remediationDrafts[item.id];
                  return (
                    <div key={item.id} className={`selected-rubric-item ${item.status}`}>
                      <span>{rubricCategoryLabel(item.category)}</span>
                      <strong>{item.title}</strong>
                      <small>{rubricStatusLabel(item.status)} · {item.status === "fulfilled" ? "현재 문서에 반영되어 있습니다." : item.improvementAction}</small>
                      {item.status !== "fulfilled" ? (
                        <div className="remediation-actions">
                          <button
                            type="button"
                            className="button secondary"
                            onClick={() => requestRemediation(item)}
                            disabled={remediationLoadingId === item.id}
                          >
                            {remediationLoadingId === item.id ? "보완 생성 중" : "보완 문구 생성"}
                          </button>
                        </div>
                      ) : null}
                      {draft ? (
                        <div className={`remediation-draft ${draft.status}`}>
                          <div className="compact-head">
                            <span className="eyebrow">AI 보완 제안</span>
                            <strong>{draft.status === "ready" ? "편집 후 삽입 가능" : "생성 확인 필요"}</strong>
                          </div>
                          <textarea
                            className="remediation-textarea"
                            value={draft.text}
                            onChange={(event) => updateRemediationDraft(item.id, event.target.value)}
                            aria-label={`${item.title} 보완 제안 편집`}
                          />
                          <p className="muted small">
                            {draft.providerLabel ? `${draft.providerLabel} · ` : ""}
                            {draft.policyNote || draft.message}
                          </p>
                          {draft.catalogStatus && !draft.catalogStatus.ok ? (
                            <p className="export-error">
                              지식 DB 근거는 점검 필요 상태입니다. {draft.catalogStatus.message}
                            </p>
                          ) : null}
                          {draft.sources.length ? (
                            <div className="remediation-sources">
                              {draft.sources.map((source) => (
                                <a key={`${item.id}-${source.title}`} href={source.url} target="_blank" rel="noreferrer">
                                  <span>{source.roleLabel || (source.sourceType === "catalog" ? "지식 DB" : "기본 근거")}</span>
                                  {source.agency} · {source.title}
                                  {source.reflectionLabel ? <small>{source.reflectionLabel}</small> : null}
                                </a>
                              ))}
                            </div>
                          ) : null}
                          <div className="remediation-actions">
                            <button
                              type="button"
                              className="button"
                              onClick={() => insertRemediationDraft(item.id)}
                              disabled={draft.status !== "ready" || !draft.text.trim()}
                            >
                              문서에 삽입
                            </button>
                            <button
                              type="button"
                              className="button secondary"
                              onClick={() => setRemediationDrafts((current) => {
                                const next = { ...current };
                                delete next[item.id];
                                return next;
                              })}
                            >
                              닫기
                            </button>
                          </div>
                        </div>
                      ) : null}
                    </div>
                  );
                }) : (
                  <div className="selected-rubric-item fulfilled">
                    <span>현장 운영 추천</span>
                    <strong>문서별 직접 점검 항목 없음</strong>
                    <small>전체 문서팩 점검에서 공통 보강 항목을 확인할 수 있습니다.</small>
                  </div>
                )}
              </div>

              <div className="rubric-panel" aria-label="전체 문서팩 제출 전 점검">
                <div className="compact-head">
                  <span className="eyebrow">전체 문서팩</span>
                  <strong>{totalQualityIssues ? `${totalQualityIssues}개 보강 대상` : "점검 완료"}</strong>
                </div>
                <div className="rubric-meter" aria-hidden="true">
                  <span style={{ width: `${(rubricEvaluation.summary.fulfilled / rubricEvaluation.summary.total) * 100}%` }} />
                </div>
                <div className="rubric-stack">
                  {rubricEvaluation.items.slice(0, 6).map((item) => (
                    <div key={item.id} className={`rubric-item ${item.status}`}>
                      <span>{rubricCategoryLabel(item.category)}</span>
                      <strong>{item.title}</strong>
                      <em>{rubricStatusLabel(item.status)}</em>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>

          <section className={styles.provenanceSection} data-testid="editor-graph-panel">
            <div className={styles.utilityContent}>
              <div className={styles.sectionHeading}>
                <div>
                  <span className="eyebrow">문서 연결</span>
                  <strong>현장 입력에서 제출본까지</strong>
                </div>
              </div>
              <ol className={styles.lineageGraph} aria-label={`${selected.title} 생성 연결`}>
                {[
                  { label: "현장 입력", value: data.scenario.workSummary },
                  { label: "핵심 위험", value: data.riskSummary.topRisk },
                  { label: "현재 문서", value: selected.title },
                  { label: "제출본", value: "PDF · XLSX · HWP" }
                ].map((node) => (
                  <li key={node.label}>
                    <span>{node.label}</span>
                    <strong>{node.value}</strong>
                  </li>
                ))}
              </ol>
            </div>
          </section>

          <section
            className={styles.provenanceSection}
            data-testid="editor-provenance-appendices"
            aria-label="원문에서 분리한 근거 부록"
          >
            <div className={styles.utilityContent}>
              <div className={styles.sectionHeading}>
                <div>
                  <span className="eyebrow">근거 부록</span>
                  <strong>제출 본문과 분리해 보존한 원문</strong>
                </div>
              </div>
              {structuredDocument.appendices.length ? (
                <div className={styles.appendixList}>
                  {structuredDocument.appendices.map((section) => (
                    <article key={section.id}>
                      <strong>{section.label}</strong>
                      <pre>{section.value || "내용 없음"}</pre>
                    </article>
                  ))}
                </div>
              ) : (
                <p className="muted small">현재 문서에는 분리된 근거 부록이 없습니다.</p>
              )}
            </div>
          </section>
            </div>
          </details>

          <details className={styles.utilityPanel} data-testid="editor-export-panel">
            <summary className={styles.utilitySummary}>
              <span>
                <b>내보내기</b>
                <small>정식 제출본과 호환 형식</small>
              </span>
              <em>PDF · XLSX · HWP</em>
            </summary>
            <div className={`${styles.utilityContent} ${styles.exportContent}`}>
              <div className={`download-bar ${styles.primaryExports}`}>
                <button type="button" className="button" onClick={() => void downloadXlsx()} disabled={xlsxStatus === "building"} title="OOXML 정식 .xlsx 양식 (시트/헤더/표/서명란)">
                  {xlsxStatus === "building" ? "Excel 생성 중" : "Excel 표 양식(.xlsx)"}
                </button>
                <button type="button" className="button" onClick={() => void downloadHwp()} disabled={hwpStatus === "building"} title="한컴 native .hwp 표 양식 (격자 표 + 셀)">
                  {hwpStatus === "building" ? "한글 표 생성 중" : "한글 표 양식(.hwp)"}
                </button>
                <button type="button" className="button secondary" onClick={() => void printPdf()}>PDF(브라우저 인쇄)</button>
                <details className="advanced-downloads inline">
                  <summary>베타 형식</summary>
                  <div className="advanced-download-grid">
                    <button type="button" className="button secondary" onClick={downloadHwpx} disabled={hwpxStatus === "building"} title="rhwp 텍스트 기반 HWPX 초안 (표 미지원)">
                      {hwpxStatus === "building" ? "HWPX 생성 중" : ".hwpx 텍스트 초안"}
                    </button>
                    <button type="button" className="button secondary" onClick={downloadXls} title="구버전 호환 HTML 기반 .xls (Excel 보안 경고 가능)">XLS(구형 호환)</button>
                    <button type="button" className="button secondary" onClick={downloadDoc} title="Word 또는 한글에서 열 수 있는 보고서형 문서">DOC</button>
                    <button type="button" className="button secondary" onClick={downloadText} title="메신저·메일 본문에 붙여넣기 쉬운 순수 텍스트">TXT</button>
                    <button type="button" className="button secondary" onClick={downloadJson} title="외부 시스템 연동과 자동화용 구조화 데이터">JSON</button>
                    <button type="button" className="button secondary" onClick={downloadCsv} title="엑셀·구글시트 업로드용 행 데이터">CSV</button>
                    <button type="button" className="button secondary" onClick={downloadHtml} title="웹 게시·브라우저 인쇄용 문서">HTML</button>
                    <button type="button" className="button secondary" onClick={downloadJpg} title="단톡방 이미지 공유와 현장 게시용 이미지">JPG</button>
                  </div>
                </details>
              </div>

              {xlsxStatus === "error" ? (
                <p className="export-error">Excel(.xlsx) 생성 중 오류가 발생했습니다. 잠시 후 다시 시도하거나 PDF 또는 구형 호환 XLS를 사용해 주세요.</p>
              ) : null}
              {hwpStatus === "error" ? (
                <p className="export-error">한글 표(.hwp) 생성 중 오류가 발생했습니다. .hwpx 텍스트 초안 또는 PDF를 사용해 주세요.</p>
              ) : null}
              {hwpxStatus === "error" ? (
                <p className="export-error">HWPX 생성 중 오류가 발생했습니다. TXT 또는 HTML로 먼저 내려받아 주세요.</p>
              ) : null}
              {imageStatus === "error" ? (
                <p className="export-error">JPG 변환 중 오류가 발생했습니다. HTML 또는 PDF 저장/인쇄를 먼저 사용해 주세요.</p>
              ) : null}

              <div className={`sheet-export-panel ${styles.exportWorkbench}`}>
                <div className="template-picker" aria-label="서식 템플릿 선택">
                  {templatePresets.map((preset) => (
                    <button
                      key={preset.kind}
                      type="button"
                      className={`template-card ${preset.kind === templateKind ? "active" : ""}`}
                      onClick={() => setTemplateKind(preset.kind)}
                      aria-label={`${preset.label} 서식 선택`}
                      aria-pressed={preset.kind === templateKind}
                    >
                      <strong>{preset.label}</strong>
                      <span>{preset.description}</span>
                    </button>
                  ))}
                </div>
                <div className={`template-preview template-${templateKind}`} aria-live="polite">
                  <span>{selectedTemplate.label} 미리보기</span>
                  <strong>{selectedTemplate.previewTitle}</strong>
                  <ul>
                    {selectedTemplate.previewBullets.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </div>
                <details className="customer-template-panel">
                  <summary>사업장 서식 매핑 준비</summary>
                  <div className="customer-template-copy">
                    <strong>지금은 SafeClaw 표준 제출형으로 출력합니다.</strong>
                    <p>
                      고객사 원본 XLSX/HWPX 서식은 온보딩 때 업로드하고, 아래 공통 필드를 한 번 매핑한 뒤
                      같은 현장에서 반복 렌더링하는 흐름으로 확장합니다. 자동 덮어쓰기는 하지 않고 제출 전
                      사용자가 확인합니다.
                    </p>
                  </div>
                  <div className="customer-template-stage" aria-label="사업장 서식 적용 단계">
                    <article>
                      <span>01</span>
                      <strong>원본 서식 수집</strong>
                      <p>사업장 위험성평가표, 작업계획서, TBM, 교육일지 원본을 등록합니다.</p>
                    </article>
                    <article>
                      <span>02</span>
                      <strong>필드 매핑</strong>
                      <p>현장명, 작업명, 위험요인, 감소대책, 결재란을 SafeClaw 문서팩과 연결합니다.</p>
                    </article>
                    <article>
                      <span>03</span>
                      <strong>검수 후 반복 출력</strong>
                      <p>검수된 서식만 고객사 제출본으로 쓰고, 원본 셀 단위 복제는 별도 QA로 잠급니다.</p>
                    </article>
                  </div>
                  <div className="customer-template-field-grid" aria-label="고객사 서식 매핑 필드">
                    {customerTemplateFields.map((field) => (
                      <article key={field.key}>
                        <span>{field.label}</span>
                        <strong>{field.mapsTo}</strong>
                        <p>{field.appliesTo}</p>
                      </article>
                    ))}
                  </div>
                </details>
                <button type="button" className="button" onClick={downloadTemplate}>선택 서식 다운로드</button>
                <p className="muted small">
                  PDF는 브라우저 인쇄/저장, XLS는 HTML 호환 파일, HWPX는 rhwp 제출형 초안입니다.
                </p>
                <details className="advanced-downloads">
                  <summary>전체 문서팩 다운로드</summary>
                  <div className="advanced-download-grid">
                    <button type="button" className="button secondary" onClick={downloadAll}>전체 TXT</button>
                    <button type="button" className="button secondary" onClick={downloadAllCsv}>전체 CSV</button>
                    <button type="button" className="button secondary" onClick={downloadAllXls}>전체 XLS</button>
                  </div>
                </details>
                <div className="sheets-action-box">
                  <button type="button" className="button" onClick={copySheetsTsv}>새 Google Sheets 열기 + 표 복사</button>
                  <button type="button" className="button secondary" onClick={downloadSheetsTsv}>Sheets용 TSV 다운로드</button>
                  <p className="muted small">Google 계정 연결 없이 자동 입력은 하지 않습니다. 새 시트가 열리면 A1 셀에 붙여넣거나 TSV를 업로드해 사용하세요.</p>
                </div>
                {sheetStatus === "copied" ? <p className="muted small">표 데이터를 복사했습니다. 열린 Google Sheets의 A1 셀에 Ctrl+V로 붙여넣어 주세요.</p> : null}
                {sheetStatus === "error" ? <p className="export-error">클립보드 복사에 실패해 TSV 파일을 내려받았습니다. Google Sheets에서 파일 가져오기로 업로드해 주세요.</p> : null}
              </div>
            </div>
          </details>

          <details
            className={`submission-preview-panel ${styles.utilityPanel}`}
            onToggle={(event) => setSubmissionPreviewOpen(event.currentTarget.open)}
          >
            <summary className={styles.utilitySummary}>
              <span>
                <b>제출 양식 미리보기</b>
                <small>표, 결재선, 인쇄 레이아웃</small>
              </span>
              <em>인쇄물</em>
            </summary>
            {submissionPreviewOpen ? (
              <div className={styles.utilityContent}>
                <p className="muted small">다운로드와 출력에 사용되는 제출형 표 서식입니다.</p>
                <SafetyDocumentPreview
                  title={selected.title}
                  rows={selectedRows}
                  scenario={data.scenario}
                  profile={selectedFormProfile}
                  data={data}
                  riskRows={riskAssessmentRows}
                />
              </div>
            ) : null}
          </details>
        </div>
      </div>
    </section>
  );
}
