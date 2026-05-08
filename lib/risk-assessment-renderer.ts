export type StructuredRiskAssessmentRow = {
  id?: string;
  section?: string;
  unitTask: string;
  hazard: string;
  currentControls?: string;
  likelihood?: string;
  severity?: string;
  riskLevel?: string;
  additionalControls: string;
  owner?: string;
  dueDate?: string;
  status?: string;
  evidence?: string;
  // PR #28 schema fields preserved additively for KOSHA-aligned renderers.
  // All optional so legacy callers (sheet-row fallbacks) keep working.
  location?: string;
  process?: string;
  equipment?: string;
  fourM?: string;
  accidentType?: string;
  verificationStatus?: string;
  verificationDate?: string;
  verificationChecker?: string;
  whyLikelihood?: string;
  whySeverity?: string;
  evidenceRefsList?: string[];
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

export function parseStructuredRiskAssessmentRows(value: unknown): StructuredRiskAssessmentRow[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item): StructuredRiskAssessmentRow[] => {
    if (!isRecord(item)) return [];
    const processName = readString(item, ["process", "section", "category", "phase"]);
    const unitTask = readString(item, ["unitTask", "task", "activity", "work", "workStep", "process"]);
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

    const evidenceRefsList = Array.isArray(item.evidenceRefs)
      ? item.evidenceRefs.filter((ref): ref is string => typeof ref === "string")
      : [];

    return [{
      id: readString(item, ["id", "no"]),
      section: processName || "위험성평가",
      unitTask: unitTask || "세부작업 확인",
      hazard: hazard || "유해·위험요인 확인",
      currentControls: readString(item, ["currentControls", "currentControl", "existingControls", "safetyMeasures", "현재조치"]),
      likelihood: readString(item, ["likelihood", "possibility", "frequency", "가능성"]),
      severity: readString(item, ["severity", "impact", "중대성"]),
      riskLevel: readString(item, ["riskLevel", "risk", "level", "위험성"], "확인"),
      additionalControls: additionalControls || "감소대책 현장 확인",
      owner: readString(item, ["owner", "assignee", "personInCharge", "담당자"], "작업반장"),
      dueDate: readString(item, ["dueDate", "due", "deadline", "targetDate", "기한"], "작업 전"),
      status: readString(item, ["status", "completionStatus", "verification", "확인"], "□"),
      evidence: readString(item, ["evidence", "proof", "attachment", "증빙"]) || evidenceRefsList.join(", "),
      // KOSHA 18-column fields (additive, optional)
      location: readString(item, ["location", "workLocation", "작업장소"]),
      process: processName,
      equipment: readString(item, ["equipment", "tool", "tools", "장비", "장비도구"]),
      fourM: readString(item, ["fourM", "fourMCategory", "4M"]),
      accidentType: readString(item, ["accidentType", "재해유형"]),
      verificationStatus: readString(item, ["verificationStatus", "확인상태"]),
      verificationDate: readString(item, ["verificationDate", "확인일"]),
      verificationChecker: readString(item, ["verificationChecker", "확인자"]),
      whyLikelihood: readString(item, ["whyLikelihood"]),
      whySeverity: readString(item, ["whySeverity"]),
      evidenceRefsList
    }];
  });
}

export function structuredRiskRowsFromSheetRows(rows: SheetRow[]): StructuredRiskAssessmentRow[] {
  return rows.map((row, index) => ({
    id: String(index + 1),
    section: row.section || "위험성평가",
    unitTask: row.section || "세부작업 확인",
    hazard: row.item || "유해·위험요인 확인",
    currentControls: "",
    likelihood: "",
    severity: "",
    riskLevel: "확인",
    additionalControls: row.content || "감소대책 현장 확인",
    owner: "작업반장",
    dueDate: "작업 전",
    status: "□",
    evidence: ""
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
    row.currentControls ? `현재조치: ${row.currentControls}` : "",
    `감소대책: ${row.additionalControls}`,
    row.owner ? `담당: ${row.owner}` : "",
    row.dueDate ? `기한: ${row.dueDate}` : "",
    row.evidence ? `증빙: ${row.evidence}` : ""
  ].filter(Boolean).join("\n");
}
