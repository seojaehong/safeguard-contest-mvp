export const RISK_ASSESSMENT_FORM_ID = "riskAssessment" as const;

export const FOUR_M_VALUES = ["Man", "Machine", "Media", "Management"] as const;
export const ACCIDENT_TYPE_VALUES = [
  "fall",
  "slip",
  "struckBy",
  "caughtIn",
  "cut",
  "burn",
  "electricShock",
  "chemicalExposure",
  "asphyxiation",
  "heatIllness",
  "traffic",
  "collapse",
  "fireExplosion",
  "other"
] as const;
export const RISK_LEVEL_VALUES = ["low", "medium", "high"] as const;
export const VERIFICATION_STATUS_VALUES = ["planned", "done", "needsReview"] as const;

export type FourM = (typeof FOUR_M_VALUES)[number];
export type AccidentType = (typeof ACCIDENT_TYPE_VALUES)[number];
export type RiskLevel = (typeof RISK_LEVEL_VALUES)[number];
export type VerificationStatus = (typeof VERIFICATION_STATUS_VALUES)[number];

export type RiskAssessmentRow = {
  location: string;
  process: string;
  task: string;
  equipment: string;
  hazard: string;
  fourM: FourM;
  accidentType: AccidentType;
  currentControls: string;
  likelihood: number;
  severity: number;
  riskLevel: RiskLevel;
  additionalControls: string;
  owner: string;
  due: string;
  verification: string;
  verificationStatus: VerificationStatus;
  verificationDate: string;
  verificationChecker: string;
  whyLikelihood: string;
  whySeverity: string;
  evidenceRefs: string[];
};

export type RiskAssessmentValidationIssue = {
  rowIndex: number;
  field: keyof RiskAssessmentRow | "row";
  message: string;
};

export type RiskAssessmentValidationResult = {
  ok: boolean;
  rows: RiskAssessmentRow[];
  issues: RiskAssessmentValidationIssue[];
};

type JsonSchemaProperty = {
  type: "string" | "number" | "array";
  enum?: readonly string[];
  minimum?: number;
  maximum?: number;
  items?: { type: "string" };
  minItems?: number;
  pattern?: string;
};

type JsonSchema = {
  type: "object";
  required: readonly string[];
  properties: Record<keyof RiskAssessmentRow, JsonSchemaProperty>;
  additionalProperties: false;
};

export type FormSchemaRegistryEntry = {
  id: typeof RISK_ASSESSMENT_FORM_ID;
  version: "2026-05-08";
  title: string;
  rowSchema: JsonSchema;
};

const REQUIRED_FIELDS: readonly (keyof RiskAssessmentRow)[] = [
  "location",
  "process",
  "task",
  "equipment",
  "hazard",
  "fourM",
  "accidentType",
  "currentControls",
  "likelihood",
  "severity",
  "riskLevel",
  "additionalControls",
  "owner",
  "due",
  "verification",
  "verificationStatus",
  "verificationDate",
  "verificationChecker",
  "whyLikelihood",
  "whySeverity",
  "evidenceRefs"
];

export const riskAssessmentSchemaRegistryEntry: FormSchemaRegistryEntry = {
  id: RISK_ASSESSMENT_FORM_ID,
  version: "2026-05-08",
  title: "위험성평가표 structured rows",
  rowSchema: {
    type: "object",
    required: REQUIRED_FIELDS,
    additionalProperties: false,
    properties: {
      location: { type: "string" },
      process: { type: "string" },
      task: { type: "string" },
      equipment: { type: "string" },
      hazard: { type: "string" },
      fourM: { type: "string", enum: FOUR_M_VALUES },
      accidentType: { type: "string", enum: ACCIDENT_TYPE_VALUES },
      currentControls: { type: "string" },
      likelihood: { type: "number", minimum: 1, maximum: 5 },
      severity: { type: "number", minimum: 1, maximum: 5 },
      riskLevel: { type: "string", enum: RISK_LEVEL_VALUES },
      additionalControls: { type: "string" },
      owner: { type: "string" },
      due: { type: "string", pattern: "^\\d{4}-\\d{2}-\\d{2}$|^현장 확인$" },
      verification: { type: "string" },
      verificationStatus: { type: "string", enum: VERIFICATION_STATUS_VALUES },
      verificationDate: { type: "string", pattern: "^\\d{4}-\\d{2}-\\d{2}$|^현장 확인$" },
      verificationChecker: { type: "string" },
      whyLikelihood: { type: "string" },
      whySeverity: { type: "string" },
      evidenceRefs: { type: "array", items: { type: "string" }, minItems: 1 }
    }
  }
};

export const FORM_SCHEMA_REGISTRY = {
  [RISK_ASSESSMENT_FORM_ID]: riskAssessmentSchemaRegistryEntry
} as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isEnumValue<T extends readonly string[]>(value: unknown, values: T): value is T[number] {
  return typeof value === "string" && values.includes(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isRiskScale(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 1 && value <= 5;
}

function expectedRiskLevel(likelihood: number, severity: number): RiskLevel {
  const value = likelihood * severity;
  if (value >= 10) return "high";
  if (value >= 5) return "medium";
  return "low";
}

function parseEvidenceRefs(value: unknown): string[] | null {
  if (!Array.isArray(value)) return null;
  const refs = value.filter((item): item is string => isNonEmptyString(item)).map((item) => item.trim());
  return refs.length ? refs : null;
}

function parseRiskAssessmentRow(value: unknown, rowIndex: number): { row: RiskAssessmentRow | null; issues: RiskAssessmentValidationIssue[] } {
  const issues: RiskAssessmentValidationIssue[] = [];
  if (!isRecord(value)) {
    return {
      row: null,
      issues: [{ rowIndex, field: "row", message: "row must be an object" }]
    };
  }

  for (const field of REQUIRED_FIELDS) {
    if (!(field in value)) {
      issues.push({ rowIndex, field, message: "required field is missing" });
    }
  }

  const stringFields = [
    "location",
    "process",
    "task",
    "equipment",
    "hazard",
    "currentControls",
    "additionalControls",
    "owner",
    "due",
    "verification",
    "verificationDate",
    "verificationChecker",
    "whyLikelihood",
    "whySeverity"
  ] as const;
  for (const field of stringFields) {
    if (!isNonEmptyString(value[field])) {
      issues.push({ rowIndex, field, message: "must be a non-empty string" });
    }
  }

  if (!isEnumValue(value.fourM, FOUR_M_VALUES)) {
    issues.push({ rowIndex, field: "fourM", message: `must be one of ${FOUR_M_VALUES.join(", ")}` });
  }
  if (!isEnumValue(value.accidentType, ACCIDENT_TYPE_VALUES)) {
    issues.push({ rowIndex, field: "accidentType", message: `must be one of ${ACCIDENT_TYPE_VALUES.join(", ")}` });
  }
  if (!isRiskScale(value.likelihood)) {
    issues.push({ rowIndex, field: "likelihood", message: "must be an integer from 1 to 5" });
  }
  if (!isRiskScale(value.severity)) {
    issues.push({ rowIndex, field: "severity", message: "must be an integer from 1 to 5" });
  }
  if (!isEnumValue(value.riskLevel, RISK_LEVEL_VALUES)) {
    issues.push({ rowIndex, field: "riskLevel", message: `must be one of ${RISK_LEVEL_VALUES.join(", ")}` });
  }
  if (!isEnumValue(value.verificationStatus, VERIFICATION_STATUS_VALUES)) {
    issues.push({ rowIndex, field: "verificationStatus", message: `must be one of ${VERIFICATION_STATUS_VALUES.join(", ")}` });
  }

  const evidenceRefs = parseEvidenceRefs(value.evidenceRefs);
  if (!evidenceRefs) {
    issues.push({ rowIndex, field: "evidenceRefs", message: "must include at least one non-empty string" });
  }
  if (isNonEmptyString(value.due) && !/^\d{4}-\d{2}-\d{2}$|^현장 확인$/.test(value.due.trim())) {
    issues.push({ rowIndex, field: "due", message: "must be YYYY-MM-DD or 현장 확인" });
  }
  if (isNonEmptyString(value.verificationDate) && !/^\d{4}-\d{2}-\d{2}$|^현장 확인$/.test(value.verificationDate.trim())) {
    issues.push({ rowIndex, field: "verificationDate", message: "must be YYYY-MM-DD or 현장 확인" });
  }

  if (
    isRiskScale(value.likelihood)
    && isRiskScale(value.severity)
    && isEnumValue(value.riskLevel, RISK_LEVEL_VALUES)
  ) {
    const expected = expectedRiskLevel(value.likelihood, value.severity);
    if (value.riskLevel !== expected) {
      issues.push({ rowIndex, field: "riskLevel", message: `must match likelihood and severity as ${expected}` });
    }
  }

  if (issues.length || !evidenceRefs) {
    return { row: null, issues };
  }

  return {
    row: {
      location: String(value.location).trim(),
      process: String(value.process).trim(),
      task: String(value.task).trim(),
      equipment: String(value.equipment).trim(),
      hazard: String(value.hazard).trim(),
      fourM: value.fourM as FourM,
      accidentType: value.accidentType as AccidentType,
      currentControls: String(value.currentControls).trim(),
      likelihood: value.likelihood as number,
      severity: value.severity as number,
      riskLevel: value.riskLevel as RiskLevel,
      additionalControls: String(value.additionalControls).trim(),
      owner: String(value.owner).trim(),
      due: String(value.due).trim(),
      verification: String(value.verification).trim(),
      verificationStatus: value.verificationStatus as VerificationStatus,
      verificationDate: String(value.verificationDate).trim(),
      verificationChecker: String(value.verificationChecker).trim(),
      whyLikelihood: String(value.whyLikelihood).trim(),
      whySeverity: String(value.whySeverity).trim(),
      evidenceRefs
    },
    issues
  };
}

export function extractRiskAssessmentRows(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  if (!isRecord(value)) return [];
  const rows = value.rows ?? value.riskAssessmentRows ?? value.structuredRiskRows;
  return Array.isArray(rows) ? rows : [];
}

export function validateRiskAssessmentRows(value: unknown): RiskAssessmentValidationResult {
  const inputRows = extractRiskAssessmentRows(value);
  const rows: RiskAssessmentRow[] = [];
  const issues: RiskAssessmentValidationIssue[] = [];

  inputRows.forEach((inputRow, index) => {
    const parsed = parseRiskAssessmentRow(inputRow, index);
    issues.push(...parsed.issues);
    if (parsed.row) rows.push(parsed.row);
  });

  if (!inputRows.length) {
    issues.push({ rowIndex: -1, field: "row", message: "risk assessment rows array is missing or empty" });
  }

  return {
    ok: rows.length === inputRows.length && issues.length === 0,
    rows,
    issues
  };
}
