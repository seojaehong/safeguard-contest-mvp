import {
  inspectStoredCurrentWorkpack,
  type StoredCurrentWorkpack
} from "@/lib/current-workpack";
import type {
  OperationImprovement,
  OperationImprovementStatus
} from "@/lib/operation-improvement-history";
import { isRfc3339OffsetTimestamp } from "@/lib/rfc3339-timestamp";
import type { RiskAssessmentRow, RiskLevel } from "@/lib/risk-assessment-schema";

export type ReportPeriod = "daily" | "weekly" | "monthly" | "custom";

export type ReportDateRange = {
  start: string;
  end: string;
};

export type ReportPhotoApproval = {
  improvementId: string;
  beforePhotoName: string;
  afterPhotoName: string;
};

export type ReportSourceMode = "browser_local" | "server_saved" | "sample";

export type ReportSourceMetadata = {
  mode: ReportSourceMode;
  scope: "current_browser" | "server_workpack" | "sample_preview";
  workpackId?: string;
  workpackSavedAt: string;
  workpackGeneratedAt?: string;
  riskRowTimeBasis: "workpack_saved_at";
  limitations: string[];
};

export type ReportProvenancePresentation = {
  label: "샘플 데이터" | "브라우저 최근 작업팩" | "서버 저장 작업팩";
  savedTimeLabel: "미리보기 준비" | "브라우저 저장" | "서버 저장";
};

export type ServerReportWorkpack = {
  id: string;
  workpack: StoredCurrentWorkpack;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function hasStringFields(value: Record<string, unknown>, fields: readonly string[]): boolean {
  return fields.every((field) => typeof value[field] === "string");
}

function isCitation(value: unknown): boolean {
  if (!isRecord(value) || !hasStringFields(value, ["id", "type", "title", "summary", "sourceLabel"])) {
    return false;
  }
  return (value.citation === undefined || typeof value.citation === "string")
    && (value.sourceUrl === undefined || typeof value.sourceUrl === "string")
    && (value.tags === undefined || isStringArray(value.tags));
}

function isScenario(value: unknown): boolean {
  return isRecord(value)
    && hasStringFields(value, ["siteName", "companyName", "companyType", "workSummary", "weatherNote"])
    && typeof value.workerCount === "number"
    && Number.isFinite(value.workerCount);
}

function isForeignWorkerLanguage(value: unknown): boolean {
  return isRecord(value)
    && hasStringFields(value, ["code", "label", "nativeLabel", "rationale"])
    && isStringArray(value.lines);
}

function isDeliverables(value: unknown): boolean {
  if (!isRecord(value) || !hasStringFields(value, [
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
  ])) {
    return false;
  }
  return Array.isArray(value.foreignWorkerLanguages)
    && value.foreignWorkerLanguages.every(isForeignWorkerLanguage)
    && isStringArray(value.safetyEducationPoints)
    && isStringArray(value.tbmQuestions);
}

function isExternalData(value: unknown): boolean {
  if (!isRecord(value)) return false;
  const weather = value.weather;
  const training = value.training;
  const koshaEducation = value.koshaEducation;
  const kosha = value.kosha;
  const accidentCases = value.accidentCases;
  return isRecord(weather)
    && hasStringFields(weather, ["source", "mode", "locationLabel", "summary", "detail"])
    && isStringArray(weather.actions)
    && isRecord(training)
    && hasStringFields(training, ["source", "mode", "detail"])
    && Array.isArray(training.recommendations)
    && isRecord(koshaEducation)
    && hasStringFields(koshaEducation, ["source", "mode", "detail"])
    && Array.isArray(koshaEducation.recommendations)
    && isRecord(kosha)
    && hasStringFields(kosha, ["source", "mode", "detail"])
    && Array.isArray(kosha.references)
    && isRecord(accidentCases)
    && hasStringFields(accidentCases, ["source", "mode", "detail"])
    && Array.isArray(accidentCases.cases);
}

function isRiskSummary(value: unknown): boolean {
  return isRecord(value)
    && hasStringFields(value, ["title", "riskLevel", "topRisk"])
    && ["상", "중", "하", "현장 확인 필요"].includes(value.riskLevel as string)
    && isStringArray(value.immediateActions);
}

function isStatus(value: unknown): boolean {
  if (!isRecord(value) || !hasStringFields(value, [
    "lawgo",
    "ai",
    "weather",
    "work24",
    "kosha",
    "summary",
    "detail"
  ])) {
    return false;
  }
  return [value.lawgo, value.ai, value.weather, value.work24, value.kosha]
    .every((mode) => mode === "mock" || mode === "live" || mode === "fallback");
}

function isRiskAssessmentRow(value: unknown): boolean {
  return isRecord(value)
    && (!("controlId" in value)
      || (typeof value.controlId === "string" && value.controlId.trim().length > 0))
    && hasStringFields(value, [
      "location",
      "process",
      "task",
      "equipment",
      "hazard",
      "fourM",
      "accidentType",
      "currentControls",
      "additionalControls",
      "owner",
      "due",
      "verification",
      "verificationStatus",
      "verificationDate",
      "verificationChecker",
      "whyLikelihood",
      "whySeverity"
    ])
    && typeof value.likelihood === "number"
    && Number.isFinite(value.likelihood)
    && typeof value.severity === "number"
    && Number.isFinite(value.severity)
    && (value.riskLevel === "high" || value.riskLevel === "medium" || value.riskLevel === "low")
    && isStringArray(value.evidenceRefs);
}

function isStructuredData(value: unknown): boolean {
  if (value === undefined) return true;
  if (!isRecord(value) || !Array.isArray(value.riskAssessmentRows)) return false;
  if (!value.riskAssessmentRows.every(isRiskAssessmentRow)) return false;
  if (!isRecord(value.riskAssessmentValidation)) return false;
  return typeof value.riskAssessmentValidation.ok === "boolean"
    && typeof value.riskAssessmentValidation.issueCount === "number"
    && Array.isArray(value.riskAssessmentValidation.issues);
}

function isGenerationEvidence(value: unknown): boolean {
  if (value === undefined) return true;
  return isRecord(value)
    && typeof value.signature === "string"
    && isRecord(value.snapshot)
    && typeof value.snapshot.generatedAt === "string";
}

function isServerAskResponse(value: unknown): value is Record<string, unknown> {
  return isRecord(value)
    && hasStringFields(value, ["question", "answer", "mode"])
    && (value.mode === "mock" || value.mode === "live" || value.mode === "fallback")
    && isStringArray(value.practicalPoints)
    && Array.isArray(value.citations)
    && value.citations.every(isCitation)
    && isScenario(value.scenario)
    && isDeliverables(value.deliverables)
    && isExternalData(value.externalData)
    && isRiskSummary(value.riskSummary)
    && isStatus(value.status)
    && isStructuredData(value.structured)
    && isGenerationEvidence(value.generationEvidence);
}

export function inspectServerReportWorkpackPayload(
  payload: unknown,
  requestedId: string
): ServerReportWorkpack | null {
  if (!isRecord(payload) || payload.canReopen !== true || !isRecord(payload.workpack)) return null;
  const serverWorkpack = payload.workpack;
  const id = typeof serverWorkpack.id === "string" ? serverWorkpack.id : "";
  if (!id || id !== requestedId || !isServerAskResponse(serverWorkpack.reopenData)) return null;

  const savedAt = [serverWorkpack.updatedAt, serverWorkpack.createdAt].find((value) => (
    typeof value === "string" && isRfc3339OffsetTimestamp(value)
  ));
  if (typeof savedAt !== "string") return null;

  const inspected = inspectStoredCurrentWorkpack(JSON.stringify({
    savedAt,
    source: "workspace",
    data: serverWorkpack.reopenData
  }));
  return inspected.status === "valid" ? { id, workpack: inspected.workpack } : null;
}

export type ReportImprovementStatus = OperationImprovementStatus;

export type ReportFilters = {
  process?: string;
  task?: string;
  riskLevel?: RiskLevel;
  improvementStatus?: ReportImprovementStatus;
  site?: string;
  assignee?: string;
};

export type RiskReportRow = {
  index: number;
  siteName: string;
  process: string;
  task: string;
  riskLevel: RiskLevel;
  riskLevelLabel: string;
  assignee: string;
  hazard: string;
  currentControls: string;
  additionalControls: string;
  owner: string;
  due: string;
  verification: string;
  evidenceRefs: string[];
};

export type ImprovementReportItem = {
  id: string;
  createdAt: string;
  siteName: string;
  process: string;
  task: string;
  riskLevel?: RiskLevel;
  riskLevelLabel: string;
  improvementStatus: ReportImprovementStatus;
  improvementStatusLabel: string;
  assignee: string;
  workSummary: string;
  hazardLabel: string;
  asIs: string;
  toBe: string;
  reflectedDocuments: string[];
  sourceLabel: "개선 전/개선 후 사진" | "관리자 메모";
  hasPhotoPair: boolean;
  photoApproved: boolean;
  photoNames: string[];
  linkedRiskIndex?: number;
};

export type ReportGroup = {
  label: string;
  count: number;
  highRiskCount: number;
  improvementCount: number;
};

export type ReportFacetOption<T extends string = string> = {
  value: T;
  label: string;
  count: number;
};

export type ReportSnapshot = {
  generatedAt: string;
  period: ReportPeriod;
  periodLabel: string;
  dateRange: ReportDateRange;
  filters: ReportFilters;
  title: string;
  fileBaseName: string;
  source: ReportSourceMetadata;
  scenario: {
    companyName: string;
    siteName: string;
    workSummary: string;
    workerCount: number;
    weatherNote: string;
  };
  summary: {
    riskRows: number;
    highRiskRows: number;
    improvements: number;
    photoCandidates: number;
    photoImprovements: number;
    evidenceRefs: number;
  };
  riskRows: RiskReportRow[];
  improvements: ImprovementReportItem[];
  facets: {
    processes: ReportFacetOption[];
    tasks: ReportFacetOption[];
    riskLevels: Array<ReportFacetOption<RiskLevel>>;
    improvementStatuses: Array<ReportFacetOption<ReportImprovementStatus>>;
    sites: ReportFacetOption[];
    assignees: ReportFacetOption[];
  };
  groups: {
    byProcess: ReportGroup[];
    byTask: ReportGroup[];
    byRiskLevel: ReportGroup[];
    byDocument: ReportGroup[];
  };
  notes: string[];
};

export type ReportLearningEvent = {
  eventType: "governance" | "period_summary" | "workpack" | "risk_row" | "improvement" | "classification_group";
  generatedAt: string;
  period: ReportPeriod;
  siteName: string;
  source: ReportSourceMetadata;
  payload: Record<string, unknown>;
};

export type ReportViewState = {
  status: "empty" | "ready" | "blocked" | "error";
  title: string;
  detail: string;
  canDownload: boolean;
};

export function resolveReportProvenancePresentation(
  source: ReportSourceMetadata
): ReportProvenancePresentation {
  if (source.mode === "sample") {
    return { label: "샘플 데이터", savedTimeLabel: "미리보기 준비" };
  }
  if (source.mode === "server_saved") {
    return { label: "서버 저장 작업팩", savedTimeLabel: "서버 저장" };
  }
  return { label: "브라우저 최근 작업팩", savedTimeLabel: "브라우저 저장" };
}

export function toggleReportPhotoApproval(
  current: readonly ReportPhotoApproval[],
  improvements: readonly OperationImprovement[],
  improvementId: string
): ReportPhotoApproval[] {
  const candidates = improvements.flatMap((item): ReportPhotoApproval[] => {
    if (item.id !== improvementId || !item.beforePhotoName || !item.afterPhotoName) return [];
    return [{
      improvementId,
      beforePhotoName: item.beforePhotoName,
      afterPhotoName: item.afterPhotoName
    }];
  });
  const withoutImprovement = current.filter((approval) => approval.improvementId !== improvementId);
  if (candidates.length !== 1) return withoutImprovement;
  const candidate = candidates[0];
  const alreadyApproved = current.some((approval) => (
    approval.improvementId === candidate.improvementId
    && approval.beforePhotoName === candidate.beforePhotoName
    && approval.afterPhotoName === candidate.afterPhotoName
  ));
  return alreadyApproved ? withoutImprovement : [...withoutImprovement, candidate];
}

export function resolveReportViewState(
  snapshot: ReportSnapshot | null,
  errorMessage?: string | null
): ReportViewState {
  if (errorMessage) {
    return {
      status: "error",
      title: "리포트를 준비하지 못했습니다.",
      detail: errorMessage,
      canDownload: false
    };
  }
  if (snapshot?.source.mode === "sample") {
    return {
      status: "blocked",
      title: "다운로드 잠김",
      detail: "샘플 데이터는 미리보기 전용이며 모든 내보내기가 비활성화됩니다.",
      canDownload: false
    };
  }
  if (!snapshot) {
    return {
      status: "empty",
      title: "최근 작업팩이 없습니다.",
      detail: "작업공간에서 문서팩을 만든 뒤 리포트로 돌아오세요.",
      canDownload: false
    };
  }
  if (snapshot.summary.riskRows + snapshot.summary.improvements === 0) {
    return {
      status: "empty",
      title: "조건에 맞는 리포트가 없습니다.",
      detail: "기간 또는 필터를 조정하세요.",
      canDownload: false
    };
  }
  return {
    status: "ready",
    title: "다운로드 준비됨",
    detail: `위험 ${snapshot.summary.riskRows}건 · 개선 ${snapshot.summary.improvements}건`,
    canDownload: true
  };
}

const PERIOD_LABELS: Record<ReportPeriod, string> = {
  daily: "오늘 작업 리포트",
  weekly: "주간 리포트",
  monthly: "월간 리포트",
  custom: "사용자 기간 리포트"
};

const RISK_LEVEL_LABELS: Record<RiskLevel, string> = {
  high: "상",
  medium: "중",
  low: "하"
};

const IMPROVEMENT_STATUS_LABELS: Record<ReportImprovementStatus, string> = {
  candidate: "후보",
  approved: "승인됨",
  rejected: "반려됨",
  reflected: "반영됨",
  proposed: "제안됨",
  in_progress: "진행 중",
  on_hold: "보류됨",
  completed: "완료됨",
  verified: "검증됨"
};

const KST_OFFSET_MILLISECONDS = 9 * 60 * 60 * 1000;

const REPORT_LEARNING_GOVERNANCE = {
  memoryScope: "period_operation_memory_export",
  authority: "operator_review_corpus",
  promotionStatus: "draft_candidate",
  runtimeAuthority: false,
  modelFineTuning: false,
  nextUse: [
    "관리자 검토 후 다음 위험성평가와 TBM 생성 시 과거 개선사항으로 조회합니다.",
    "개선 전/개선 후 사진은 승인된 항목만 공식 운영 이력으로 승격합니다."
  ],
  guardrails: [
    "이 파일은 모델 가중치 변경 산출물이 아닙니다.",
    "검토 전 항목은 사용자 근거처럼 노출하지 않습니다.",
    "DB 하네스가 먼저 근거와 개선사항을 고정하고 LLM은 문장화에만 사용합니다."
  ]
} as const;

function startOfPeriod(period: ReportPeriod, now: Date) {
  const start = new Date(now.getTime() + KST_OFFSET_MILLISECONDS);
  start.setUTCHours(0, 0, 0, 0);
  if (period === "weekly") {
    const day = start.getUTCDay();
    const mondayOffset = day === 0 ? -6 : 1 - day;
    start.setUTCDate(start.getUTCDate() + mondayOffset);
  }
  if (period === "monthly") {
    start.setUTCDate(1);
  }
  return new Date(start.getTime() - KST_OFFSET_MILLISECONDS);
}

function parseDateBoundary(value: string, endOfDay: boolean) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) {
    throw new Error("사용자 기간은 YYYY-MM-DD 형식이어야 합니다.");
  }
  const year = Number(match[1]);
  const monthIndex = Number(match[2]) - 1;
  const day = Number(match[3]);
  const calendarDate = new Date(Date.UTC(year, monthIndex, day));
  if (
    calendarDate.getUTCFullYear() !== year
    || calendarDate.getUTCMonth() !== monthIndex
    || calendarDate.getUTCDate() !== day
  ) {
    throw new Error("사용자 기간에 올바른 날짜를 입력하세요.");
  }
  const localMilliseconds = Date.UTC(
    year,
    monthIndex,
    day,
    endOfDay ? 23 : 0,
    endOfDay ? 59 : 0,
    endOfDay ? 59 : 0,
    endOfDay ? 999 : 0
  );
  return new Date(localMilliseconds - KST_OFFSET_MILLISECONDS);
}

function customDateRange(dateRange?: ReportDateRange) {
  if (!dateRange?.start || !dateRange.end) {
    throw new Error("사용자 기간의 시작일과 종료일을 모두 선택하세요.");
  }
  const start = parseDateBoundary(dateRange.start, false);
  const end = parseDateBoundary(dateRange.end, true);
  if (start > end) {
    throw new Error("사용자 기간의 시작일은 종료일보다 늦을 수 없습니다.");
  }
  return { start, end };
}

function resolveDateRange(period: ReportPeriod, now: Date, dateRange?: ReportDateRange): ReportDateRange {
  if (period === "custom") {
    customDateRange(dateRange);
    return { start: dateRange!.start, end: dateRange!.end };
  }
  return {
    start: formatKstDate(startOfPeriod(period, now)),
    end: formatKstDate(now)
  };
}

function normalizeFilters(filters?: ReportFilters): ReportFilters {
  return {
    ...(filters?.process ? { process: filters.process } : {}),
    ...(filters?.task ? { task: filters.task } : {}),
    ...(filters?.riskLevel ? { riskLevel: filters.riskLevel } : {}),
    ...(filters?.improvementStatus ? { improvementStatus: filters.improvementStatus } : {}),
    ...(filters?.site ? { site: filters.site } : {}),
    ...(filters?.assignee ? { assignee: filters.assignee } : {})
  };
}

function isWithinPeriod(isoDate: string, period: ReportPeriod, now: Date, dateRange?: ReportDateRange) {
  if (!isRfc3339OffsetTimestamp(isoDate)) return false;
  const date = new Date(isoDate);
  if (period === "custom") {
    const range = customDateRange(dateRange);
    return date >= range.start && date <= range.end;
  }
  return date >= startOfPeriod(period, now) && date <= now;
}

function formatKstDate(date: Date) {
  return new Date(date.getTime() + KST_OFFSET_MILLISECONDS).toISOString().slice(0, 10);
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value || "현장 확인";
  return new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Seoul"
  }).format(date);
}

function slugSegment(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9가-힣._-]+/g, "")
    .replace(/^-+|-+$/g, "") || "safeclaw";
}

function uniqueStrings(values: readonly string[]) {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
}

function normalizeRiskRow(row: RiskAssessmentRow, index: number): RiskReportRow {
  return {
    index: index + 1,
    siteName: row.location,
    process: row.process,
    task: row.task,
    riskLevel: row.riskLevel,
    riskLevelLabel: RISK_LEVEL_LABELS[row.riskLevel],
    assignee: row.owner || "미지정",
    hazard: row.hazard,
    currentControls: row.currentControls,
    additionalControls: row.additionalControls,
    owner: row.owner,
    due: row.due,
    verification: row.verification,
    evidenceRefs: uniqueStrings(row.evidenceRefs)
  };
}

function fallbackRiskRow(workpack: StoredCurrentWorkpack): RiskReportRow[] {
  const risk = workpack.data.riskSummary;
  if (!risk.topRisk || risk.riskLevel === "현장 확인 필요") return [];
  const riskLevel = risk.riskLevel === "상" ? "high" : risk.riskLevel === "중" ? "medium" : "low";
  return [{
    index: 1,
    siteName: workpack.data.scenario.siteName || "현장",
    process: workpack.data.scenario.companyType || "현장 작업",
    task: workpack.data.scenario.workSummary || "작업 확인",
    riskLevel,
    riskLevelLabel: RISK_LEVEL_LABELS[riskLevel],
    assignee: "관리감독자",
    hazard: risk.topRisk,
    currentControls: "현재 조치 현장 확인",
    additionalControls: risk.immediateActions.join(" · ") || "추가 조치 현장 확인",
    owner: "관리감독자",
    due: "현장 확인",
    verification: "TBM 및 사진 증빙 확인",
    evidenceRefs: ["riskAssessmentDraft", "tbmBriefing"]
  }];
}

function normalizeImprovement(
  item: OperationImprovement,
  riskRows: readonly RiskReportRow[],
  photoApprovals: readonly ReportPhotoApproval[]
): ImprovementReportItem {
  const association = item.riskAssociation;
  const matchingRisks = association && item.siteName.trim() === association.siteName
    ? riskRows.filter((row) => (
      row.siteName === association.siteName
      && row.process === association.process
      && row.task === association.task
      && row.hazard === association.hazard
    ))
    : [];
  const matchedRisk = matchingRisks.length === 1 ? matchingRisks[0] : undefined;
  const candidatePhotoNames = uniqueStrings([item.beforePhotoName || "", item.afterPhotoName || ""]);
  const hasPhotoPair = Boolean(item.beforePhotoName && item.afterPhotoName);
  const photoApproved = hasPhotoPair && photoApprovals.some((approval) => (
    approval.improvementId === item.id
    && approval.beforePhotoName === item.beforePhotoName
    && approval.afterPhotoName === item.afterPhotoName
  ));
  const photoNames = photoApproved ? candidatePhotoNames : [];
  const improvementStatus: ReportImprovementStatus = item.status || "candidate";
  const asIs = photoApproved && item.beforePhotoName
    ? `개선 전 사진: ${item.beforePhotoName}`
    : `${item.hazardLabel} 관련 기존 위험 또는 미조치 상태`;
  const toBe = photoApproved && item.afterPhotoName
    ? `${item.improvementText} / 개선 후 사진: ${item.afterPhotoName}`
    : item.improvementText;

  return {
    id: item.id,
    createdAt: item.createdAt,
    siteName: item.siteName,
    process: matchedRisk?.process || "미연결",
    task: matchedRisk?.task || item.workSummary,
    riskLevel: matchedRisk?.riskLevel,
    riskLevelLabel: matchedRisk?.riskLevelLabel || "",
    improvementStatus,
    improvementStatusLabel: IMPROVEMENT_STATUS_LABELS[improvementStatus],
    assignee: matchedRisk?.assignee || "미지정",
    workSummary: item.workSummary,
    hazardLabel: item.hazardLabel,
    asIs,
    toBe,
    reflectedDocuments: uniqueStrings(item.reflectedDocuments),
    sourceLabel: hasPhotoPair ? "개선 전/개선 후 사진" : "관리자 메모",
    hasPhotoPair,
    photoApproved,
    photoNames,
    linkedRiskIndex: matchedRisk?.index
  };
}

function emptyGroup(label: string): ReportGroup {
  return {
    label,
    count: 0,
    highRiskCount: 0,
    improvementCount: 0
  };
}

function sortGroups(groups: Map<string, ReportGroup>) {
  return Array.from(groups.values()).sort((a, b) => {
    if (b.highRiskCount !== a.highRiskCount) return b.highRiskCount - a.highRiskCount;
    if (b.improvementCount !== a.improvementCount) return b.improvementCount - a.improvementCount;
    return b.count - a.count;
  });
}

function groupRiskRows(
  riskRows: readonly RiskReportRow[],
  improvements: readonly ImprovementReportItem[],
  field: "process" | "task" | "riskLevelLabel"
) {
  const groups = new Map<string, ReportGroup>();
  riskRows.forEach((row) => {
    const label = field === "riskLevelLabel" ? row.riskLevelLabel : row[field];
    const current = groups.get(label) || emptyGroup(label);
    current.count += 1;
    if (row.riskLevel === "high") current.highRiskCount += 1;
    current.improvementCount += improvements.filter((item) => item.linkedRiskIndex === row.index).length;
    groups.set(label, current);
  });
  return sortGroups(groups);
}

function groupByDocument(improvements: readonly ImprovementReportItem[]) {
  const groups = new Map<string, ReportGroup>();
  improvements.forEach((item) => {
    item.reflectedDocuments.forEach((document) => {
      const current = groups.get(document) || emptyGroup(document);
      current.count += 1;
      current.improvementCount += 1;
      groups.set(document, current);
    });
  });
  return sortGroups(groups);
}

function buildFacetOptions<T extends string>(values: Array<{ value: T; label: string }>): Array<ReportFacetOption<T>> {
  const options = new Map<T, ReportFacetOption<T>>();
  values.forEach(({ value, label }) => {
    if (!value) return;
    const current = options.get(value);
    if (current) {
      current.count += 1;
      return;
    }
    options.set(value, { value, label, count: 1 });
  });
  return Array.from(options.values());
}

function buildNotes(
  workpack: StoredCurrentWorkpack,
  improvements: readonly ImprovementReportItem[],
  source: ReportSourceMetadata
) {
  const notes = [
    source.scope === "sample_preview"
      ? "이 리포트는 샘플 미리보기 데이터로 생성되며 실제 현장 전체 범위를 나타내지 않습니다."
      : source.scope === "server_workpack"
        ? "이 리포트는 서버에 저장된 해당 작업팩만 기준으로 생성됩니다."
        : "이 리포트는 현재 브라우저의 최신 작업팩과 저장된 개선사항 후보만 기준으로 생성됩니다.",
    "위험행의 기간 포함 여부는 행별 생성시각이 아닌 작업팩 저장시각을 기준으로 판단합니다.",
    "개선 전/개선 후 사진 포함 승인 항목만 다운로드 산출물에 기록됩니다."
  ];
  if (!workpack.data.structured?.riskAssessmentRows.length) {
    notes.push("구조화 위험성평가 행이 없어서 핵심 위험 요약으로 대체했습니다.");
  }
  if (!improvements.length) {
    notes.push("선택한 기간에 저장된 개선사항 후보가 없습니다.");
  }
  return notes;
}

export function buildReportSnapshot(input: {
  workpack: StoredCurrentWorkpack;
  improvements: OperationImprovement[];
  period: ReportPeriod;
  dateRange?: ReportDateRange;
  filters?: ReportFilters;
  photoApprovals?: readonly ReportPhotoApproval[];
  sourceMode?: ReportSourceMode;
  sourceWorkpackId?: string;
  now?: Date;
}): ReportSnapshot {
  if (!isRfc3339OffsetTimestamp(input.workpack.savedAt)) {
    throw new Error("작업팩 저장시각은 유효한 RFC3339 offset 시각이어야 합니다.");
  }
  const now = input.now || new Date();
  const dateRange = resolveDateRange(input.period, now, input.dateRange);
  const filters = normalizeFilters(input.filters);
  const data = input.workpack.data;
  const sourceMode = input.sourceMode || "browser_local";
  const generatedAtCandidates = [
    data.generationEvidence?.snapshot.generatedAt,
    data.qualityContract?.generatedAt
  ];
  const workpackGeneratedAt = generatedAtCandidates.find((value) => (
    typeof value === "string" && isRfc3339OffsetTimestamp(value)
  ));
  const source: ReportSourceMetadata = {
    mode: sourceMode,
    scope: sourceMode === "sample"
      ? "sample_preview"
      : sourceMode === "server_saved"
        ? "server_workpack"
        : "current_browser",
    ...(sourceMode === "server_saved" && input.sourceWorkpackId
      ? { workpackId: input.sourceWorkpackId }
      : {}),
    workpackSavedAt: input.workpack.savedAt,
    ...(workpackGeneratedAt ? { workpackGeneratedAt } : {}),
    riskRowTimeBasis: "workpack_saved_at",
    limitations: sourceMode === "sample"
      ? ["sample_data_only", "not_full_operational_history", "risk_rows_share_workpack_timestamp"]
      : sourceMode === "server_saved"
        ? ["server_saved_workpack_only", "not_full_operational_history", "risk_rows_share_workpack_timestamp"]
        : ["current_browser_only", "not_full_operational_history", "risk_rows_share_workpack_timestamp"]
  };
  const allRiskRows = isWithinPeriod(input.workpack.savedAt, input.period, now, dateRange)
    ? data.structured?.riskAssessmentRows.length
      ? data.structured.riskAssessmentRows.map(normalizeRiskRow)
      : fallbackRiskRow(input.workpack)
    : [];
  const photoApprovals = input.photoApprovals || [];
  const allImprovements = (sourceMode === "sample" ? [] : input.improvements)
    .filter((item) => isWithinPeriod(item.createdAt, input.period, now, dateRange))
    .map((item) => normalizeImprovement(item, allRiskRows, photoApprovals));
  const facets: ReportSnapshot["facets"] = {
    processes: buildFacetOptions([
      ...allRiskRows.map((row) => ({ value: row.process, label: row.process })),
      ...allImprovements.map((item) => ({ value: item.process, label: item.process }))
    ]),
    tasks: buildFacetOptions([
      ...allRiskRows.map((row) => ({ value: row.task, label: row.task })),
      ...allImprovements.map((item) => ({ value: item.task, label: item.task }))
    ]),
    riskLevels: buildFacetOptions([
      ...allRiskRows.map((row) => ({ value: row.riskLevel, label: row.riskLevelLabel })),
      ...allImprovements.flatMap((item) => item.riskLevel
        ? [{ value: item.riskLevel, label: item.riskLevelLabel }]
        : [])
    ]),
    improvementStatuses: buildFacetOptions([
      ...allImprovements.map((item) => ({ value: item.improvementStatus, label: item.improvementStatusLabel }))
    ]),
    sites: buildFacetOptions([
      ...allRiskRows.map((row) => ({ value: row.siteName, label: row.siteName })),
      ...allImprovements.map((item) => ({ value: item.siteName, label: item.siteName }))
    ]),
    assignees: buildFacetOptions([
      ...allRiskRows.map((row) => ({ value: row.assignee, label: row.assignee })),
      ...allImprovements.map((item) => ({ value: item.assignee, label: item.assignee }))
    ])
  };
  const riskRows = allRiskRows.filter((row) => (
    (!filters.process || row.process === filters.process) &&
    (!filters.task || row.task === filters.task) &&
    (!filters.riskLevel || row.riskLevel === filters.riskLevel) &&
    (!filters.improvementStatus || allImprovements.some((item) => (
      item.linkedRiskIndex === row.index && item.improvementStatus === filters.improvementStatus
    ))) &&
    (!filters.site || row.siteName === filters.site) &&
    (!filters.assignee || row.assignee === filters.assignee)
  ));
  const improvements = allImprovements.filter((item) => (
    (!filters.process || item.process === filters.process) &&
    (!filters.task || item.task === filters.task) &&
    (!filters.riskLevel || item.riskLevel === filters.riskLevel) &&
    (!filters.improvementStatus || item.improvementStatus === filters.improvementStatus) &&
    (!filters.site || item.siteName === filters.site) &&
    (!filters.assignee || item.assignee === filters.assignee)
  ));
  const evidenceRefs = uniqueStrings(riskRows.flatMap((row) => row.evidenceRefs));
  const generatedAt = now.toISOString();
  const periodLabel = input.period === "custom"
    ? `${dateRange.start.replaceAll("-", ".")} - ${dateRange.end.replaceAll("-", ".")} 사용자 기간 리포트`
    : PERIOD_LABELS[input.period];
  const periodFileSegment = input.period === "custom"
    ? `${dateRange.start}-to-${dateRange.end}`
    : input.period;
  const siteName = filters.site || data.scenario.siteName || "현장";

  return {
    generatedAt,
    period: input.period,
    periodLabel,
    dateRange,
    filters,
    title: `${siteName} ${periodLabel}`,
    fileBaseName: `${slugSegment(siteName)}-${periodFileSegment}-safety-report`,
    source,
    scenario: {
      companyName: data.scenario.companyName,
      siteName,
      workSummary: data.scenario.workSummary,
      workerCount: data.scenario.workerCount,
      weatherNote: data.scenario.weatherNote
    },
    summary: {
      riskRows: riskRows.length,
      highRiskRows: riskRows.filter((row) => row.riskLevel === "high").length,
      improvements: improvements.length,
      photoCandidates: improvements.filter((item) => item.hasPhotoPair).length,
      photoImprovements: improvements.filter((item) => item.photoApproved).length,
      evidenceRefs: evidenceRefs.length
    },
    riskRows,
    improvements,
    facets,
    groups: {
      byProcess: groupRiskRows(riskRows, improvements, "process"),
      byTask: groupRiskRows(riskRows, improvements, "task"),
      byRiskLevel: groupRiskRows(riskRows, improvements, "riskLevelLabel"),
      byDocument: groupByDocument(improvements)
    },
    notes: buildNotes(input.workpack, improvements, source)
  };
}

function csvEscape(value: string | number) {
  const raw = String(value);
  const trimmedStart = raw.trimStart();
  const text = /^[=+\-@]/.test(trimmedStart) || /^[\t\r]/.test(raw) ? `'${raw}` : raw;
  if (!/[",\n\r]/.test(text)) return text;
  return `"${text.replace(/"/g, "\"\"")}"`;
}

function toCsv(rows: Array<Array<string | number>>) {
  return `\uFEFF${rows.map((row) => row.map(csvEscape).join(",")).join("\n")}\n`;
}

export function buildReportCsv(snapshot: ReportSnapshot) {
  const header = [
    "구분",
    "현장",
    "공정",
    "작업",
    "위험등급",
    "개선상태",
    "담당자",
    "위험요인",
    "개선 전",
    "개선 후",
    "반영문서",
    "근거",
    "승인사진",
    "데이터범위",
    "데이터모드",
    "작업팩ID",
    "작업팩저장시각",
    "작업팩생성시각",
    "위험행시간기준",
    "데이터제한"
  ];
  const metadataRow: Array<string | number> = [
    "메타데이터",
    snapshot.scenario.siteName,
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    "source_metadata",
    "",
    snapshot.source.scope,
    snapshot.source.mode,
    snapshot.source.workpackId || "",
    snapshot.source.workpackSavedAt,
    snapshot.source.workpackGeneratedAt || "",
    snapshot.source.riskRowTimeBasis,
    snapshot.source.limitations.join(" · ")
  ];
  const riskRows = snapshot.riskRows.map((row): Array<string | number> => [
    "위험성평가",
    row.siteName,
    row.process,
    row.task,
    row.riskLevelLabel,
    "",
    row.assignee,
    row.hazard,
    row.currentControls,
    row.additionalControls,
    "위험성평가표 · TBM",
    row.evidenceRefs.join(" · "),
    "",
    snapshot.source.scope,
    snapshot.source.mode,
    snapshot.source.workpackId || "",
    snapshot.source.workpackSavedAt,
    snapshot.source.workpackGeneratedAt || "",
    snapshot.source.riskRowTimeBasis,
    snapshot.source.limitations.join(" · ")
  ]);
  const improvementRows = snapshot.improvements.map((item): Array<string | number> => [
    "개선사항",
    item.siteName,
    item.process,
    item.task,
    item.riskLevelLabel,
    item.improvementStatusLabel,
    item.assignee,
    item.hazardLabel,
    item.asIs,
    item.toBe,
    item.reflectedDocuments.join(" · "),
    item.sourceLabel,
    item.photoNames.join(" · "),
    snapshot.source.scope,
    snapshot.source.mode,
    snapshot.source.workpackId || "",
    snapshot.source.workpackSavedAt,
    snapshot.source.workpackGeneratedAt || "",
    snapshot.source.riskRowTimeBasis,
    snapshot.source.limitations.join(" · ")
  ]);
  return toCsv([header, metadataRow, ...riskRows, ...improvementRows]);
}

function reportFilterLines(snapshot: ReportSnapshot) {
  const filters = snapshot.filters;
  const riskLevelLabel = snapshot.facets.riskLevels.find((option) => option.value === filters.riskLevel)?.label;
  const improvementStatusLabel = snapshot.facets.improvementStatuses.find(
    (option) => option.value === filters.improvementStatus
  )?.label;
  return [
    filters.process ? `- 공정: ${filters.process}` : "",
    filters.task ? `- 작업: ${filters.task}` : "",
    filters.riskLevel ? `- 위험등급: ${riskLevelLabel || filters.riskLevel}` : "",
    filters.improvementStatus ? `- 개선상태: ${improvementStatusLabel || filters.improvementStatus}` : "",
    filters.site ? `- 현장: ${filters.site}` : "",
    filters.assignee ? `- 담당자: ${filters.assignee}` : ""
  ].filter(Boolean);
}

export function buildReportMarkdown(snapshot: ReportSnapshot) {
  const filterLines = reportFilterLines(snapshot);
  const lines = [
    `# ${snapshot.title}`,
    "",
    `생성시각: ${formatDate(snapshot.generatedAt)}`,
    "",
    "## 적용 조건",
    "",
    `- 기간: ${snapshot.periodLabel}`,
    ...(filterLines.length ? filterLines : ["- 분류: 전체"]),
    "",
    "## 데이터 범위",
    "",
    `- scope: ${snapshot.source.scope}`,
    `- mode: ${snapshot.source.mode}`,
    ...(snapshot.source.workpackId ? [`- workpackId: ${snapshot.source.workpackId}`] : []),
    `- workpackSavedAt: ${snapshot.source.workpackSavedAt}`,
    `- workpackGeneratedAt: ${snapshot.source.workpackGeneratedAt || "unavailable"}`,
    `- riskRowTimeBasis: ${snapshot.source.riskRowTimeBasis}`,
    `- limitations: ${snapshot.source.limitations.join(", ")}`,
    "",
    "## 현장 요약",
    "",
    `- 회사: ${snapshot.scenario.companyName || "확인 필요"}`,
    `- 현장: ${snapshot.scenario.siteName}`,
    `- 작업: ${snapshot.scenario.workSummary}`,
    `- 인원: ${snapshot.scenario.workerCount}명`,
    `- 기상/조건: ${snapshot.scenario.weatherNote || "확인 필요"}`,
    "",
    "## 핵심 지표",
    "",
    `- 위험성평가 행: ${snapshot.summary.riskRows}건`,
    `- 고위험 행: ${snapshot.summary.highRiskRows}건`,
    `- 개선사항 후보: ${snapshot.summary.improvements}건`,
    `- 개선 전/개선 후 사진 후보: ${snapshot.summary.photoCandidates}건`,
    `- 승인된 개선 전/개선 후 사진: ${snapshot.summary.photoImprovements}건`,
    "",
    "## 위험성평가 개선 전 / 개선 후",
    ""
  ];

  snapshot.riskRows.forEach((row) => {
    lines.push(`### ${row.index}. ${row.task} · ${row.hazard} [${row.riskLevelLabel}]`);
    lines.push(`- 개선 전: ${row.currentControls}`);
    lines.push(`- 개선 후: ${row.additionalControls}`);
    lines.push(`- 담당/기한: ${row.owner} · ${row.due}`);
    lines.push(`- 확인: ${row.verification}`);
    lines.push(`- 근거: ${row.evidenceRefs.join(", ") || "현장 확인"}`);
    lines.push("");
  });

  lines.push("## 오늘/기간 개선사항");
  lines.push("");
  if (snapshot.improvements.length) {
    snapshot.improvements.forEach((item) => {
      lines.push(`### ${formatDate(item.createdAt)} · ${item.hazardLabel}`);
      lines.push(`- 출처: ${item.sourceLabel}`);
      lines.push(`- 개선 전: ${item.asIs}`);
      lines.push(`- 개선 후: ${item.toBe}`);
      lines.push(`- 반영 문서: ${item.reflectedDocuments.join(", ") || "확인 필요"}`);
      if (item.photoNames.length) lines.push(`- 사진: ${item.photoNames.join(", ")}`);
      lines.push("");
    });
  } else {
    lines.push("- 선택한 기간에 저장된 개선사항 후보가 없습니다.");
    lines.push("");
  }

  lines.push("## 분류별 요약");
  lines.push("");
  for (const [title, groups] of [
    ["공정별", snapshot.groups.byProcess],
    ["작업별", snapshot.groups.byTask],
    ["위험등급별", snapshot.groups.byRiskLevel],
    ["문서반영별", snapshot.groups.byDocument]
  ] as const) {
    lines.push(`### ${title}`);
    if (groups.length) {
      groups.forEach((group) => {
        lines.push(`- ${group.label}: 위험 ${group.count}건, 고위험 ${group.highRiskCount}건, 개선 ${group.improvementCount}건`);
      });
    } else {
      lines.push("- 해당 항목 없음");
    }
    lines.push("");
  }

  lines.push("## 확인 메모");
  lines.push("");
  snapshot.notes.forEach((note) => lines.push(`- ${note}`));
  lines.push("");
  return lines.join("\n");
}

export function buildReportJson(snapshot: ReportSnapshot) {
  return JSON.stringify(snapshot, null, 2);
}

function buildLearningEvents(snapshot: ReportSnapshot): ReportLearningEvent[] {
  const base = {
    generatedAt: snapshot.generatedAt,
    period: snapshot.period,
    siteName: snapshot.scenario.siteName,
    source: snapshot.source
  };
  return [
    {
      ...base,
      eventType: "governance",
      payload: REPORT_LEARNING_GOVERNANCE
    },
    {
      ...base,
      eventType: "period_summary",
      payload: {
        title: snapshot.title,
        dateRange: snapshot.dateRange,
        filters: snapshot.filters,
        companyName: snapshot.scenario.companyName,
        workSummary: snapshot.scenario.workSummary,
        workerCount: snapshot.scenario.workerCount,
        weatherNote: snapshot.scenario.weatherNote,
        summary: snapshot.summary
      }
    },
    {
      ...base,
      eventType: "workpack",
      payload: {
        companyName: snapshot.scenario.companyName,
        siteName: snapshot.scenario.siteName,
        workSummary: snapshot.scenario.workSummary,
        workerCount: snapshot.scenario.workerCount,
        evidenceRefs: uniqueStrings(snapshot.riskRows.flatMap((row) => row.evidenceRefs))
      }
    },
    ...snapshot.riskRows.map((row) => ({
      ...base,
      eventType: "risk_row" as const,
      payload: {
        index: row.index,
        process: row.process,
        task: row.task,
        hazard: row.hazard,
        riskLevel: row.riskLevel,
        riskLevelLabel: row.riskLevelLabel,
        asIs: row.currentControls,
        toBe: row.additionalControls,
        owner: row.owner,
        due: row.due,
        verification: row.verification,
        evidenceRefs: row.evidenceRefs
      }
    })),
    ...snapshot.improvements.map((item) => ({
      ...base,
      eventType: "improvement" as const,
      payload: {
        improvementId: item.id,
        createdAt: item.createdAt,
        workSummary: item.workSummary,
        hazardLabel: item.hazardLabel,
        asIs: item.asIs,
        toBe: item.toBe,
        reflectedDocuments: item.reflectedDocuments,
        improvementStatus: item.improvementStatus,
        improvementStatusLabel: item.improvementStatusLabel,
        assignee: item.assignee,
        sourceLabel: item.sourceLabel,
        photoApproved: item.photoApproved,
        photoNames: item.photoNames
      }
    })),
    ...([
      ["process", snapshot.groups.byProcess],
      ["task", snapshot.groups.byTask],
      ["risk_level", snapshot.groups.byRiskLevel],
      ["document", snapshot.groups.byDocument]
    ] as const).flatMap(([groupType, groups]) => groups.map((group) => ({
      ...base,
      eventType: "classification_group" as const,
      payload: {
        groupType,
        label: group.label,
        count: group.count,
        highRiskCount: group.highRiskCount,
        improvementCount: group.improvementCount
      }
    })))
  ];
}

export function buildReportLearningJsonl(snapshot: ReportSnapshot) {
  return `${buildLearningEvents(snapshot).map((event) => JSON.stringify(event)).join("\n")}\n`;
}

export function buildReportLearningMarkdown(snapshot: ReportSnapshot) {
  const lines = [
    `# ${snapshot.title} 운영 코퍼스`,
    "",
    `- generatedAt: ${formatDate(snapshot.generatedAt)}`,
    `- period: ${snapshot.period}`,
    `- dateRange: ${snapshot.dateRange.start}..${snapshot.dateRange.end}`,
    `- filters: ${JSON.stringify(snapshot.filters)}`,
    `- siteName: ${snapshot.scenario.siteName}`,
    `- workSummary: ${snapshot.scenario.workSummary}`,
    `- sourceScope: ${snapshot.source.scope}`,
    `- sourceMode: ${snapshot.source.mode}`,
    ...(snapshot.source.workpackId ? [`- workpackId: ${snapshot.source.workpackId}`] : []),
    `- workpackSavedAt: ${snapshot.source.workpackSavedAt}`,
    `- workpackGeneratedAt: ${snapshot.source.workpackGeneratedAt || "unavailable"}`,
    `- riskRowTimeBasis: ${snapshot.source.riskRowTimeBasis}`,
    `- sourceLimitations: ${snapshot.source.limitations.join(", ")}`,
    "",
    "## 운영 메모리 계약",
    "",
    `- scope: ${REPORT_LEARNING_GOVERNANCE.memoryScope}`,
    `- authority: ${REPORT_LEARNING_GOVERNANCE.authority}`,
    `- promotionStatus: ${REPORT_LEARNING_GOVERNANCE.promotionStatus}`,
    `- runtimeAuthority: ${REPORT_LEARNING_GOVERNANCE.runtimeAuthority ? "yes" : "no"}`,
    `- modelFineTuning: ${REPORT_LEARNING_GOVERNANCE.modelFineTuning ? "yes" : "no"}`,
    `- nextUse: ${REPORT_LEARNING_GOVERNANCE.nextUse.join(" / ")}`,
    `- guardrails: ${REPORT_LEARNING_GOVERNANCE.guardrails.join(" / ")}`,
    "",
    "## 재사용 목적",
    "",
    "- 다음 위험성평가와 TBM 생성 시 과거 작업, 위험요인, 개선사항, 근거 반영 위치를 다시 조회하기 위한 운영 이벤트입니다.",
    "- 모델 가중치 변경 산출물이 아니라, DB 하네스가 먼저 고정할 수 있는 재생성 가능한 코퍼스입니다.",
    "- 개선 전/개선 후 사진 포함 승인 항목만 운영 메모리에 사진 파일명을 기록합니다.",
    "",
    "## 기간 요약",
    "",
    `- 위험성평가 행: ${snapshot.summary.riskRows}건`,
    `- 고위험 행: ${snapshot.summary.highRiskRows}건`,
    `- 개선사항: ${snapshot.summary.improvements}건`,
    `- 개선 전/개선 후 사진 후보: ${snapshot.summary.photoCandidates}건`,
    `- 승인된 개선 전/개선 후 사진: ${snapshot.summary.photoImprovements}건`,
    "",
    "## 위험 이벤트",
    ""
  ];

  snapshot.riskRows.forEach((row) => {
    lines.push(`### ${row.process} / ${row.task}`);
    lines.push(`- hazard: ${row.hazard}`);
    lines.push(`- riskLevel: ${row.riskLevelLabel}`);
    lines.push(`- asIs: ${row.currentControls}`);
    lines.push(`- toBe: ${row.additionalControls}`);
    lines.push(`- evidenceRefs: ${row.evidenceRefs.join(", ") || "현장 확인"}`);
    lines.push("");
  });

  lines.push("## 개선 이벤트", "");
  if (snapshot.improvements.length) {
    snapshot.improvements.forEach((item) => {
      lines.push(`### ${formatDate(item.createdAt)} / ${item.hazardLabel}`);
      lines.push(`- source: ${item.sourceLabel}`);
      lines.push(`- asIs: ${item.asIs}`);
      lines.push(`- toBe: ${item.toBe}`);
      lines.push(`- reflectedDocuments: ${item.reflectedDocuments.join(", ") || "확인 필요"}`);
      if (item.photoNames.length) lines.push(`- photos: ${item.photoNames.join(", ")}`);
      lines.push("");
    });
  } else {
    lines.push("- 선택한 기간에 저장된 개선 이벤트가 없습니다.", "");
  }

  lines.push("## 분류 인덱스", "");
  for (const [title, groups] of [
    ["공정별", snapshot.groups.byProcess],
    ["작업별", snapshot.groups.byTask],
    ["위험등급별", snapshot.groups.byRiskLevel],
    ["문서반영별", snapshot.groups.byDocument]
  ] as const) {
    lines.push(`### ${title}`);
    if (groups.length) {
      groups.forEach((group) => {
        lines.push(`- ${group.label}: risk=${group.count}, high=${group.highRiskCount}, improvement=${group.improvementCount}`);
      });
    } else {
      lines.push("- 해당 항목 없음");
    }
    lines.push("");
  }

  return lines.join("\n");
}
