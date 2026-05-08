export type StructuredRiskAssessmentRow = {
  id?: string;
  location?: string;
  section?: string;
  process?: string;
  unitTask: string;
  equipment?: string;
  hazard: string;
  fourM?: string;
  accidentType?: string;
  currentControls?: string;
  likelihood?: string;
  severity?: string;
  riskLevel?: string;
  additionalControls: string;
  owner?: string;
  dueDate?: string;
  due?: string;
  status?: string;
  verification?: string;
  verificationStatus?: string;
  verificationDate?: string;
  verificationChecker?: string;
  whyLikelihood?: string;
  whySeverity?: string;
  evidence?: string;
  evidenceRefsList?: string[];
  evidenceRefs?: string[];
};

type SheetRow = {
  document: string;
  section: string;
  item: string;
  content: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function readString(record: Record<string, unknown>, keys: string[], fallback = ""): string {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
  }
  return fallback;
}

function readStringArray(record: Record<string, unknown>, keys: string[]): string[] {
  for (const key of keys) {
    const value = record[key];
    if (Array.isArray(value)) {
      const strings = value.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
      if (strings.length) return strings.map((item) => item.trim());
    }
    if (typeof value === "string" && value.trim()) {
      return value.split(/[,\n]/).map((item) => item.trim()).filter(Boolean);
    }
  }
  return [];
}

export function parseStructuredRiskAssessmentRows(value: unknown): StructuredRiskAssessmentRow[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item): StructuredRiskAssessmentRow[] => {
    if (!isRecord(item)) return [];
    const process = readString(item, ["process", "section", "category", "phase"]);
    const unitTask = readString(item, ["unitTask", "task", "activity", "work", "workStep", "process", "세부작업"]);
    const hazard = readString(item, ["hazard", "hazardFactor", "riskFactor", "danger", "유해위험요인"]);
    const additionalControls = readString(item, [
      "additionalControls",
      "additionalControl",
      "control",
      "controls",
      "improvement",
      "countermeasure",
      "reductionMeasure",
      "감소대책"
    ]);
    if (!unitTask && !hazard && !additionalControls) return [];

    const evidenceRefs = readStringArray(item, ["evidenceRefs", "evidenceReferences", "근거"]);
    const evidenceRefsList = evidenceRefs;
    const due = readString(item, ["due", "dueDate", "deadline", "targetDate", "기한"], "작업 전");
    const verificationStatus = readString(item, ["verificationStatus", "status", "completionStatus", "확인상태"], "planned");

    return [{
      id: readString(item, ["id", "no"]),
      location: readString(item, ["location", "place", "workplace", "작업장소"]),
      section: process || "위험성평가",
      process: process || "위험성평가",
      unitTask: unitTask || "세부작업 확인",
      equipment: readString(item, ["equipment", "tools", "machine", "장비도구", "장비·도구"]),
      hazard: hazard || "유해·위험요인 확인",
      fourM: readString(item, ["fourM", "4M", "fourMCategory"], "Management"),
      accidentType: readString(item, ["accidentType", "accident", "injuryType", "재해유형"], "other"),
      currentControls: readString(item, ["currentControls", "currentControl", "existingControls", "safetyMeasures", "현재조치"]),
      likelihood: readString(item, ["likelihood", "possibility", "frequency", "가능성"]),
      severity: readString(item, ["severity", "impact", "중대성"]),
      riskLevel: readString(item, ["riskLevel", "risk", "level", "위험성"], "확인"),
      additionalControls: additionalControls || "감소대책 현장 확인",
      owner: readString(item, ["owner", "assignee", "personInCharge", "담당자"], "작업반장"),
      dueDate: due,
      due,
      status: verificationStatus,
      verification: readString(item, ["verification", "confirmation", "확인"], "현장 확인"),
      verificationStatus,
      verificationDate: readString(item, ["verificationDate", "checkDate", "확인일"], "현장 확인"),
      verificationChecker: readString(item, ["verificationChecker", "checker", "확인자"], "관리감독자"),
      whyLikelihood: readString(item, ["whyLikelihood", "likelihoodReason", "가능성근거"]),
      whySeverity: readString(item, ["whySeverity", "severityReason", "중대성근거"]),
      evidence: readString(item, ["evidence", "proof", "attachment", "증빙"])
        || evidenceRefs.join(", "),
      evidenceRefsList,
      evidenceRefs
    }];
  });
}

export function structuredRiskRowsFromSheetRows(rows: SheetRow[]): StructuredRiskAssessmentRow[] {
  return rows.map((row, index) => ({
    id: String(index + 1),
    location: "현장 확인",
    section: row.section || "위험성평가",
    process: row.section || "위험성평가",
    unitTask: row.section || "세부작업 확인",
    equipment: "장비·도구 확인",
    hazard: row.item || "유해·위험요인 확인",
    fourM: "Management",
    accidentType: "other",
    currentControls: "",
    likelihood: "",
    severity: "",
    riskLevel: "확인",
    additionalControls: row.content || "감소대책 현장 확인",
    owner: "작업반장",
    dueDate: "작업 전",
    due: "작업 전",
    status: "planned",
    verification: "현장 확인",
    verificationStatus: "planned",
    verificationDate: "현장 확인",
    verificationChecker: "관리감독자",
    whyLikelihood: "",
    whySeverity: "",
    evidence: "",
    evidenceRefs: []
  }));
}

export function resolveRiskAssessmentRows(args: {
  structuredRows?: StructuredRiskAssessmentRow[];
  fallbackRows: SheetRow[];
}): StructuredRiskAssessmentRow[] {
  return args.structuredRows && args.structuredRows.length
    ? args.structuredRows
    : structuredRiskRowsFromSheetRows(args.fallbackRows);
}

export function buildRiskAssessmentText(row: StructuredRiskAssessmentRow): string {
  return [
    row.location ? `작업장소: ${row.location}` : "",
    row.equipment ? `장비·도구: ${row.equipment}` : "",
    row.fourM ? `4M: ${row.fourM}` : "",
    row.accidentType ? `재해유형: ${row.accidentType}` : "",
    row.currentControls ? `현재조치: ${row.currentControls}` : "",
    row.likelihood || row.severity || row.riskLevel ? `위험성: 가능성 ${row.likelihood || "확인"} / 중대성 ${row.severity || "확인"} / ${row.riskLevel || "확인"}` : "",
    `감소대책: ${row.additionalControls}`,
    row.whyLikelihood ? `가능성 근거: ${row.whyLikelihood}` : "",
    row.whySeverity ? `중대성 근거: ${row.whySeverity}` : "",
    row.owner ? `담당: ${row.owner}` : "",
    row.dueDate || row.due ? `기한: ${row.dueDate || row.due}` : "",
    row.verificationChecker || row.verificationDate ? `확인: ${row.verificationChecker || "관리감독자"} / ${row.verificationDate || "현장 확인"} / ${row.verificationStatus || row.status || "planned"}` : "",
    row.evidence ? `증빙: ${row.evidence}` : ""
  ].filter(Boolean).join("\n");
}
