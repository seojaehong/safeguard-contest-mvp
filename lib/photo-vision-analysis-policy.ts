import {
  isSafetyReferenceCompatibleWithQuery,
  scoreSafetyReferenceQueryMatch,
  type SafetyReferenceItem
} from "@/lib/safety-reference-catalog";

export const HAZARD_PHOTO_SIGNATURE_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif"
] as const;

export type HazardPhotoSignatureMimeType = typeof HAZARD_PHOTO_SIGNATURE_MIME_TYPES[number];

export type HazardPhotoModelObservation = {
  kind: "visual" | "ocr";
  text: string;
};

export type HazardPhotoModelCandidate = {
  label: string;
  observation: string;
  inference: string;
};

export type HazardPhotoCandidateReferenceInput = Pick<
  HazardPhotoModelCandidate,
  "label" | "observation" | "inference"
>;

export type HazardPhotoModelPayload = {
  summary: string;
  observations: HazardPhotoModelObservation[];
  candidates: HazardPhotoModelCandidate[];
  ocrText: string;
  siteSignals: string[];
};

export type HazardPhotoHarnessStatus = "pending" | "confirmed" | "insufficient";
export type HazardPhotoUserDecisionStatus = "pending" | "accepted" | "rejected";
export type HazardPhotoFinalDecision = Exclude<HazardPhotoUserDecisionStatus, "pending">;

export type HazardPhotoUserDecision = {
  status: HazardPhotoUserDecisionStatus;
  allowed: HazardPhotoFinalDecision[];
  requiresHarnessConfirmation: true;
  reason: string | null;
  decidedAt: string | null;
};

export type HazardPhotoDecisionTransitionResult =
  | { ok: true; code: null; decision: HazardPhotoUserDecision }
  | {
    ok: false;
    code: "harness_confirmation_required" | "decision_already_final";
    decision: HazardPhotoUserDecision;
  };

export const HAZARD_PHOTO_MODEL_LIMITS = {
  summary: 500,
  observation: 500,
  candidateLabel: 160,
  inference: 500,
  ocrText: 2_000,
  siteSignal: 120,
  observations: 20,
  siteSignals: 12,
  candidates: 4
} as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function assertWithinLimit(value: string, path: string, maximum: number): string {
  if (value.length > maximum) throw new Error(`${path} exceeds maximum length ${maximum}`);
  return value;
}

function readRequiredString(value: unknown, path: string, maximum: number): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`${path} must be a non-empty string`);
  }
  return assertWithinLimit(value.trim(), path, maximum);
}

function readOptionalString(value: unknown, path: string, maximum: number): string {
  if (value === undefined) return "";
  if (typeof value !== "string") throw new Error(`${path} must be a string`);
  return assertWithinLimit(value.trim(), path, maximum);
}

function readOptionalStringArray(
  value: unknown,
  path: string,
  maximumItems: number,
  maximumLength: number
): string[] {
  if (value === undefined) return [];
  if (!Array.isArray(value)) throw new Error(`${path} must be an array`);
  if (value.length > maximumItems) throw new Error(`${path} exceeds maximum item count ${maximumItems}`);
  return value.map((item, index) => readRequiredString(item, `${path}[${index}]`, maximumLength));
}

function assertAllowedKeys(value: Record<string, unknown>, allowed: readonly string[], path: string): void {
  const allowedKeys = new Set(allowed);
  const unexpected = Object.keys(value).find((key) => !allowedKeys.has(key));
  if (unexpected) throw new Error(`${path}.${unexpected} is not allowed in candidate-only model output`);
}

const LEGAL_OR_EVIDENCE_CLAIM = /(?:산업안전보건법|산안법|법령|법률|법적|법규|근거|제\s*\d+\s*조|\bKOSHA\b|\bSIF\b|\bevidence\b|\blegal\b|\bstatute\b|\bregulation\b|\bcompliance\b)/iu;
const CONTROL_CLAIM = /(?:(?:설치|착용|제거|통제|확보|배치|교체|보강|중지|금지|사용|점검|교육|조치).{0,12}(?:필요|해야|하여야|권고|요구|의무|즉시)|\b(?:must|should|required|recommended|install|remove|control|mitigation)\b)/iu;

function assertCandidateOnlyNarrative(value: string, path: string): void {
  if (LEGAL_OR_EVIDENCE_CLAIM.test(value) || CONTROL_CLAIM.test(value)) {
    throw new Error(`${path} contains a control, evidence, or legal-authority claim outside candidate-only scope`);
  }
}

export function createPendingHazardPhotoUserDecision(
  harnessStatus: HazardPhotoHarnessStatus
): HazardPhotoUserDecision {
  return {
    status: "pending",
    allowed: harnessStatus === "confirmed" ? ["accepted", "rejected"] : ["rejected"],
    requiresHarnessConfirmation: true,
    reason: null,
    decidedAt: null
  };
}

export function transitionHazardPhotoUserDecision(input: {
  harnessStatus: HazardPhotoHarnessStatus;
  decision: HazardPhotoUserDecision;
  nextStatus: HazardPhotoFinalDecision;
  reason: string | null;
  decidedAt: string;
}): HazardPhotoDecisionTransitionResult {
  if (input.decision.status !== "pending") {
    return { ok: false, code: "decision_already_final", decision: input.decision };
  }
  if (input.nextStatus === "accepted" && input.harnessStatus !== "confirmed") {
    return { ok: false, code: "harness_confirmation_required", decision: input.decision };
  }
  return {
    ok: true,
    code: null,
    decision: {
      status: input.nextStatus,
      allowed: [],
      requiresHarnessConfirmation: true,
      reason: input.reason?.trim() || null,
      decidedAt: input.decidedAt
    }
  };
}

function candidateRelevanceQuery(candidate: HazardPhotoCandidateReferenceInput): string {
  return [candidate.label, candidate.observation, candidate.inference]
    .map((value) => value.trim())
    .filter(Boolean)
    .join(" ")
    .slice(0, 2_800);
}

const HAZARD_RELEVANCE_TERMS = [
  "밀폐공간",
  "배수펌프",
  "산소결핍",
  "유해가스",
  "지게차",
  "보행자",
  "비계",
  "작업발판",
  "개구부",
  "난간",
  "외벽",
  "도장",
  "도료",
  "유기용제",
  "강풍",
  "추락",
  "동선",
  "충돌",
  "협착",
  "끼임",
  "감전",
  "누수",
  "화재",
  "폭발",
  "굴착",
  "붕괴",
  "보호구",
  "안전대",
  "사다리",
  "크레인",
  "차량"
] as const;

const RELEVANCE_STOPWORDS = new Set([
  "가능성",
  "가까이",
  "각각",
  "구역",
  "보입니다",
  "위험",
  "작업",
  "작업자",
  "점검",
  "현장",
  "현장에서",
  "확인",
  "확인해야",
  "후보"
]);

function normalizeRelevanceText(value: string): string {
  return value.toLocaleLowerCase().replace(/[^\p{L}\p{N}\s]/gu, " ").replace(/\s+/g, " ").trim();
}

function candidateSpecificTerms(candidate: HazardPhotoCandidateReferenceInput): string[] {
  const normalized = normalizeRelevanceText(candidateRelevanceQuery(candidate));
  const hazardTerms = HAZARD_RELEVANCE_TERMS.filter((term) => normalized.includes(term));
  const ordinaryTerms = normalized.split(" ")
    .filter((term) => term.length >= 2 && !RELEVANCE_STOPWORDS.has(term));
  return [...new Set([...hazardTerms, ...ordinaryTerms])];
}

function referenceRelevanceText(reference: SafetyReferenceItem): string {
  return normalizeRelevanceText([
    reference.title,
    reference.summary,
    reference.body || "",
    reference.category || "",
    reference.subcategory || "",
    ...reference.keywords,
    ...reference.risk_tags,
    ...reference.controls
  ].join(" "));
}

export function buildHazardCandidateReferenceQuery(input: {
  question: string;
  candidate: HazardPhotoCandidateReferenceInput;
}): string {
  return [
    candidateRelevanceQuery(input.candidate),
    input.question.trim() ? `현장 맥락: ${input.question.trim()}` : ""
  ].filter(Boolean).join(" ").slice(0, 4_000);
}

export function filterPositivelyRelevantHazardReferences(
  candidate: HazardPhotoCandidateReferenceInput,
  references: SafetyReferenceItem[]
): SafetyReferenceItem[] {
  const query = candidateRelevanceQuery(candidate);
  const specificTerms = candidateSpecificTerms(candidate);
  if (!specificTerms.length) return [];
  return references.filter((reference) =>
    isSafetyReferenceCompatibleWithQuery(query, reference) &&
    scoreSafetyReferenceQueryMatch(query, reference) >= 2 &&
    specificTerms.some((term) => referenceRelevanceText(reference).includes(term))
  );
}

export function parseHazardPhotoModelPayload(value: unknown): HazardPhotoModelPayload {
  if (!isRecord(value)) throw new Error("Hazard photo output must be an object");
  assertAllowedKeys(value, ["summary", "observations", "candidates", "ocrText", "siteSignals"], "output");
  if (!Array.isArray(value.observations) || value.observations.length === 0) {
    throw new Error("observations must contain at least one valid observation");
  }
  if (value.observations.length > HAZARD_PHOTO_MODEL_LIMITS.observations) {
    throw new Error(`observations exceeds maximum item count ${HAZARD_PHOTO_MODEL_LIMITS.observations}`);
  }
  const observations = value.observations.map((item, index): HazardPhotoModelObservation => {
    if (!isRecord(item)) throw new Error(`observations[${index}] must be an object`);
    assertAllowedKeys(item, ["kind", "text"], `observations[${index}]`);
    if (item.kind !== "visual" && item.kind !== "ocr") {
      throw new Error(`observations[${index}].kind must be visual or ocr`);
    }
    return {
      kind: item.kind,
      text: readRequiredString(
        item.text,
        `observations[${index}].text`,
        HAZARD_PHOTO_MODEL_LIMITS.observation
      )
    };
  });

  if (!Array.isArray(value.candidates) || value.candidates.length === 0) {
    throw new Error("candidates must contain at least one valid candidate");
  }
  if (value.candidates.length > HAZARD_PHOTO_MODEL_LIMITS.candidates) {
    throw new Error(`candidates must contain at most ${HAZARD_PHOTO_MODEL_LIMITS.candidates} items`);
  }
  const candidates = value.candidates.map((item, index): HazardPhotoModelCandidate => {
    if (!isRecord(item)) throw new Error(`candidates[${index}] must be an object`);
    assertAllowedKeys(item, ["label", "observation", "inference"], `candidates[${index}]`);
    const candidate = {
      label: readRequiredString(
        item.label,
        `candidates[${index}].label`,
        HAZARD_PHOTO_MODEL_LIMITS.candidateLabel
      ),
      observation: readRequiredString(
        item.observation,
        `candidates[${index}].observation`,
        HAZARD_PHOTO_MODEL_LIMITS.observation
      ),
      inference: readRequiredString(
        item.inference,
        `candidates[${index}].inference`,
        HAZARD_PHOTO_MODEL_LIMITS.inference
      )
    };
    assertCandidateOnlyNarrative(candidate.label, `candidates[${index}].label`);
    assertCandidateOnlyNarrative(candidate.inference, `candidates[${index}].inference`);
    return candidate;
  });

  const summary = readOptionalString(value.summary, "summary", HAZARD_PHOTO_MODEL_LIMITS.summary);
  const siteSignals = readOptionalStringArray(
    value.siteSignals,
    "siteSignals",
    HAZARD_PHOTO_MODEL_LIMITS.siteSignals,
    HAZARD_PHOTO_MODEL_LIMITS.siteSignal
  );
  assertCandidateOnlyNarrative(summary, "summary");
  siteSignals.forEach((signal, index) => assertCandidateOnlyNarrative(signal, `siteSignals[${index}]`));

  return {
    summary,
    observations,
    candidates,
    ocrText: readOptionalString(value.ocrText, "ocrText", HAZARD_PHOTO_MODEL_LIMITS.ocrText),
    siteSignals
  };
}

function startsWith(bytes: Uint8Array, signature: readonly number[]): boolean {
  return signature.every((value, index) => bytes[index] === value);
}

export function hasMatchingHazardPhotoSignature(
  mimeType: HazardPhotoSignatureMimeType,
  bytes: Uint8Array
): boolean {
  switch (mimeType) {
    case "image/jpeg":
      return startsWith(bytes, [0xff, 0xd8, 0xff]);
    case "image/png":
      return startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    case "image/webp":
      return startsWith(bytes, [0x52, 0x49, 0x46, 0x46]) &&
        startsWith(bytes.slice(8), [0x57, 0x45, 0x42, 0x50]);
    case "image/gif":
      return startsWith(bytes, [0x47, 0x49, 0x46, 0x38, 0x37, 0x61]) ||
        startsWith(bytes, [0x47, 0x49, 0x46, 0x38, 0x39, 0x61]);
  }
}
