import type { StoredCurrentWorkpack } from "@/lib/current-workpack";
import type { OperationImprovement } from "@/lib/operation-improvement-history";
import type { RiskAssessmentRow, RiskLevel } from "@/lib/risk-assessment-schema";

export type ReportPeriod = "daily" | "weekly" | "monthly";

export type RiskReportRow = {
  index: number;
  process: string;
  task: string;
  riskLevel: RiskLevel;
  riskLevelLabel: string;
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
  workSummary: string;
  hazardLabel: string;
  asIs: string;
  toBe: string;
  reflectedDocuments: string[];
  sourceLabel: "Before/After 사진" | "관리자 메모";
  photoNames: string[];
};

export type ReportGroup = {
  label: string;
  count: number;
  highRiskCount: number;
  improvementCount: number;
};

export type ReportSnapshot = {
  generatedAt: string;
  period: ReportPeriod;
  periodLabel: string;
  title: string;
  fileBaseName: string;
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
    photoImprovements: number;
    evidenceRefs: number;
  };
  riskRows: RiskReportRow[];
  improvements: ImprovementReportItem[];
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
  payload: Record<string, unknown>;
};

const PERIOD_LABELS: Record<ReportPeriod, string> = {
  daily: "오늘 작업 리포트",
  weekly: "주간 리포트",
  monthly: "월간 리포트"
};

const RISK_LEVEL_LABELS: Record<RiskLevel, string> = {
  high: "상",
  medium: "중",
  low: "하"
};

const REPORT_LEARNING_GOVERNANCE = {
  memoryScope: "period_operation_memory_export",
  authority: "operator_review_corpus",
  promotionStatus: "draft_candidate",
  runtimeAuthority: false,
  modelFineTuning: false,
  nextUse: [
    "관리자 검토 후 다음 위험성평가와 TBM 생성 시 과거 개선사항으로 조회합니다.",
    "Before/After 사진 개선은 승인된 항목만 공식 운영 이력으로 승격합니다."
  ],
  guardrails: [
    "이 파일은 모델 파인튜닝 산출물이 아닙니다.",
    "검토 전 항목은 사용자 근거처럼 노출하지 않습니다.",
    "DB 하네스가 먼저 근거와 개선사항을 고정하고 LLM은 문장화에만 사용합니다."
  ]
} as const;

function startOfPeriod(period: ReportPeriod, now: Date) {
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  if (period === "weekly") {
    const day = start.getDay();
    const mondayOffset = day === 0 ? -6 : 1 - day;
    start.setDate(start.getDate() + mondayOffset);
  }
  if (period === "monthly") {
    start.setDate(1);
  }
  return start;
}

function isWithinPeriod(isoDate: string, period: ReportPeriod, now: Date) {
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) return true;
  return date >= startOfPeriod(period, now) && date <= now;
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value || "현장 확인";
  return new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
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
    process: row.process,
    task: row.task,
    riskLevel: row.riskLevel,
    riskLevelLabel: RISK_LEVEL_LABELS[row.riskLevel],
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
  if (!risk.topRisk) return [];
  const riskLevel = risk.riskLevel === "상" ? "high" : risk.riskLevel === "중" ? "medium" : "low";
  return [{
    index: 1,
    process: workpack.data.scenario.companyType || "현장 작업",
    task: workpack.data.scenario.workSummary || "작업 확인",
    riskLevel,
    riskLevelLabel: RISK_LEVEL_LABELS[riskLevel],
    hazard: risk.topRisk,
    currentControls: "현재 조치 현장 확인",
    additionalControls: risk.immediateActions.join(" · ") || "추가 조치 현장 확인",
    owner: "관리감독자",
    due: "현장 확인",
    verification: "TBM 및 사진 증빙 확인",
    evidenceRefs: ["riskAssessmentDraft", "tbmBriefing"]
  }];
}

function normalizeImprovement(item: OperationImprovement): ImprovementReportItem {
  const photoNames = uniqueStrings([item.beforePhotoName || "", item.afterPhotoName || ""]);
  const asIs = item.beforePhotoName
    ? `개선 전 사진: ${item.beforePhotoName}`
    : `${item.hazardLabel} 관련 기존 위험 또는 미조치 상태`;
  const toBe = item.afterPhotoName
    ? `${item.improvementText} / 개선 후 사진: ${item.afterPhotoName}`
    : item.improvementText;

  return {
    id: item.id,
    createdAt: item.createdAt,
    siteName: item.siteName,
    workSummary: item.workSummary,
    hazardLabel: item.hazardLabel,
    asIs,
    toBe,
    reflectedDocuments: uniqueStrings(item.reflectedDocuments),
    sourceLabel: photoNames.length >= 2 ? "Before/After 사진" : "관리자 메모",
    photoNames
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
    current.improvementCount += improvements.filter((item) => item.workSummary.includes(row.task) || item.hazardLabel.includes(row.hazard)).length;
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

function buildNotes(workpack: StoredCurrentWorkpack, improvements: readonly ImprovementReportItem[]) {
  const notes = [
    "이 리포트는 현재 브라우저의 최신 작업팩과 저장된 개선사항 후보를 기준으로 생성됩니다.",
    "Before/After 사진 개선사항은 관리자가 확인한 뒤 공식 이력으로 승격하는 흐름을 전제로 합니다."
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
  now?: Date;
}): ReportSnapshot {
  const now = input.now || new Date();
  const data = input.workpack.data;
  const riskRows = data.structured?.riskAssessmentRows.length
    ? data.structured.riskAssessmentRows.map(normalizeRiskRow)
    : fallbackRiskRow(input.workpack);
  const improvements = input.improvements
    .filter((item) => isWithinPeriod(item.createdAt, input.period, now))
    .map(normalizeImprovement);
  const evidenceRefs = uniqueStrings(riskRows.flatMap((row) => row.evidenceRefs));
  const generatedAt = now.toISOString();
  const periodLabel = PERIOD_LABELS[input.period];
  const siteName = data.scenario.siteName || "현장";

  return {
    generatedAt,
    period: input.period,
    periodLabel,
    title: `${siteName} ${periodLabel}`,
    fileBaseName: `${slugSegment(siteName)}-${input.period}-safety-report`,
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
      photoImprovements: improvements.filter((item) => item.sourceLabel === "Before/After 사진").length,
      evidenceRefs: evidenceRefs.length
    },
    riskRows,
    improvements,
    groups: {
      byProcess: groupRiskRows(riskRows, improvements, "process"),
      byTask: groupRiskRows(riskRows, improvements, "task"),
      byRiskLevel: groupRiskRows(riskRows, improvements, "riskLevelLabel"),
      byDocument: groupByDocument(improvements)
    },
    notes: buildNotes(input.workpack, improvements)
  };
}

function csvEscape(value: string | number) {
  const text = String(value);
  if (!/[",\n\r]/.test(text)) return text;
  return `"${text.replace(/"/g, "\"\"")}"`;
}

function toCsv(rows: Array<Array<string | number>>) {
  return `\uFEFF${rows.map((row) => row.map(csvEscape).join(",")).join("\n")}\n`;
}

export function buildReportCsv(snapshot: ReportSnapshot) {
  const header = ["구분", "현장", "공정", "작업", "위험등급", "위험요인", "As-Is", "To-Be", "반영문서", "근거"];
  const riskRows = snapshot.riskRows.map((row): Array<string | number> => [
    "위험성평가",
    snapshot.scenario.siteName,
    row.process,
    row.task,
    row.riskLevelLabel,
    row.hazard,
    row.currentControls,
    row.additionalControls,
    "위험성평가표 · TBM",
    row.evidenceRefs.join(" · ")
  ]);
  const improvementRows = snapshot.improvements.map((item): Array<string | number> => [
    "개선사항",
    item.siteName,
    "현장 개선",
    item.workSummary,
    "",
    item.hazardLabel,
    item.asIs,
    item.toBe,
    item.reflectedDocuments.join(" · "),
    item.sourceLabel
  ]);
  return toCsv([header, ...riskRows, ...improvementRows]);
}

export function buildReportMarkdown(snapshot: ReportSnapshot) {
  const lines = [
    `# ${snapshot.title}`,
    "",
    `생성시각: ${formatDate(snapshot.generatedAt)}`,
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
    `- Before/After 사진 개선: ${snapshot.summary.photoImprovements}건`,
    "",
    "## 위험성평가 As-Is / To-Be",
    ""
  ];

  snapshot.riskRows.forEach((row) => {
    lines.push(`### ${row.index}. ${row.task} · ${row.hazard} [${row.riskLevelLabel}]`);
    lines.push(`- As-Is: ${row.currentControls}`);
    lines.push(`- To-Be: ${row.additionalControls}`);
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
      lines.push(`- As-Is: ${item.asIs}`);
      lines.push(`- To-Be: ${item.toBe}`);
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
    siteName: snapshot.scenario.siteName
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
        sourceLabel: item.sourceLabel,
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
    `- siteName: ${snapshot.scenario.siteName}`,
    `- workSummary: ${snapshot.scenario.workSummary}`,
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
    "- 모델 파인튜닝 산출물이 아니라, DB 하네스가 먼저 고정할 수 있는 재생성 가능한 코퍼스입니다.",
    "",
    "## 기간 요약",
    "",
    `- 위험성평가 행: ${snapshot.summary.riskRows}건`,
    `- 고위험 행: ${snapshot.summary.highRiskRows}건`,
    `- 개선사항: ${snapshot.summary.improvements}건`,
    `- Before/After 사진 개선: ${snapshot.summary.photoImprovements}건`,
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
