import { createHash } from "node:crypto";

import type { DbHarnessPacket } from "@/lib/db-harness";
import {
  getSafetyReferenceDisplayTitle,
  isKoshaSupportingCitationEligible,
  isSafetyReferenceDirectEligible,
  type SafetyReferenceItem
} from "@/lib/safety-reference-catalog";
import type { SearchResult } from "@/lib/types";

export type GroundedGenerationSource = Readonly<{
  referenceKey: string;
  kind: "direct" | "sif" | "kosha" | "law";
  sourceId: string;
  title: string;
  summary: string;
  aliases: readonly string[];
  controls: readonly string[];
}>;

export type GroundedGenerationPacket = Readonly<{
  version: "grounded-generation-v1";
  sourceIdentity: string;
  status: "ready" | "review_required";
  llmRole: "naturalize_only";
  sources: readonly GroundedGenerationSource[];
}>;

export type GroundingViolation = Readonly<{
  code: "unknown_reference" | "control_provenance_missing" | "control_claim_not_in_packet";
  path: string;
  value: string;
}>;

export type GroundedGenerationValidation = Readonly<{
  status: "grounded" | "review_required";
  violations: readonly GroundingViolation[];
}>;

function uniqueStrings(values: readonly (string | null | undefined)[]): string[] {
  return [...new Set(values.map((value) => value?.trim()).filter((value): value is string => Boolean(value)))];
}

function compareCanonical(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function canonicalizeSources(
  input: readonly GroundedGenerationSource[]
): GroundedGenerationSource[] {
  const grouped = new Map<string, GroundedGenerationSource[]>();
  for (const source of input) {
    const canonical = {
      ...source,
      aliases: [...source.aliases].sort(compareCanonical),
      controls: [...source.controls].sort(compareCanonical)
    };
    const existing = grouped.get(canonical.referenceKey) || [];
    existing.push(canonical);
    grouped.set(canonical.referenceKey, existing);
  }

  return [...grouped.values()].map((duplicates) => {
    const ordered = [...duplicates].sort((left, right) => (
      compareCanonical(JSON.stringify(left), JSON.stringify(right))
    ));
    const representative = ordered[0];
    return {
      ...representative,
      aliases: uniqueStrings(ordered.flatMap((source) => source.aliases)).sort(compareCanonical),
      controls: uniqueStrings(ordered.flatMap((source) => source.controls)).sort(compareCanonical)
    };
  });
}

function safetySource(
  item: SafetyReferenceItem,
  kind: GroundedGenerationSource["kind"],
  referenceKey: string
): GroundedGenerationSource {
  const title = getSafetyReferenceDisplayTitle(item);
  return {
    referenceKey,
    kind,
    sourceId: item.source_id,
    title,
    summary: item.short_summary || item.summary,
    aliases: uniqueStrings([
      referenceKey,
      item.id,
      item.source_id,
      title,
      item.kosha_guide?.referenceId,
      item.kosha_guide?.stableDocumentKey,
      item.kosha_guide?.evidenceRef
    ]),
    controls: uniqueStrings(item.controls)
  };
}

function legalSource(item: SearchResult): GroundedGenerationSource {
  const referenceKey = `LAW:${item.id}`;
  return {
    referenceKey,
    kind: "law",
    sourceId: item.id,
    title: item.title,
    summary: item.summary,
    aliases: uniqueStrings([referenceKey, item.id, item.title, item.citation, item.sourceUrl]),
    controls: []
  };
}

function deepFreeze<T>(value: T): T {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) deepFreeze(child);
  }
  return value;
}

export function buildGroundedGenerationPacket(input: {
  dbHarnessPacket: DbHarnessPacket;
  legalCandidates: readonly SearchResult[];
  eligibleKoshaIds: ReadonlySet<string>;
}): GroundedGenerationPacket {
  const direct = input.dbHarnessPacket.directEvidence
    .filter(isSafetyReferenceDirectEligible)
    .map((item) => safetySource(item, "direct", `DB:${item.id}`));
  const sif = input.dbHarnessPacket.sifCases
    .filter((item) => item.item_type === "sif-case")
    .map((item) => safetySource(item, "sif", `SIF:${item.id}`));
  const kosha = input.dbHarnessPacket.supportingEvidence
    .filter((item) => input.eligibleKoshaIds.has(item.id) && isKoshaSupportingCitationEligible(item))
    .map((item) => {
      const stableKey = item.kosha_guide?.stableDocumentKey || item.id;
      const version = item.kosha_guide?.version;
      return safetySource(item, "kosha", `KOSHA:${stableKey}${version ? `@${version}` : ""}`);
    });
  const law = input.legalCandidates.map(legalSource);
  const kindOrder: Readonly<Record<GroundedGenerationSource["kind"], number>> = {
    direct: 0,
    sif: 1,
    kosha: 2,
    law: 3
  };
  const sources = canonicalizeSources([...direct, ...sif, ...kosha, ...law])
    .sort((left, right) => (
      kindOrder[left.kind] - kindOrder[right.kind]
      || compareCanonical(left.referenceKey, right.referenceKey)
      || compareCanonical(left.sourceId, right.sourceId)
    ));
  const status = input.dbHarnessPacket.ontologyChecklist.status === "ready" && sources.length > 0
    ? "ready"
    : "review_required";
  const identityPayload = JSON.stringify({
    version: "grounded-generation-v1",
    status,
    llmRole: "naturalize_only",
    sources: sources.map((source) => ({
        referenceKey: source.referenceKey,
        kind: source.kind,
        sourceId: source.sourceId,
        title: source.title,
        summary: source.summary,
        aliases: source.aliases,
        controls: source.controls
      }))
  });
  const packet: GroundedGenerationPacket = {
    version: "grounded-generation-v1",
    sourceIdentity: createHash("sha256").update(identityPayload).digest("hex"),
    status,
    llmRole: "naturalize_only",
    sources
  };
  return deepFreeze(packet);
}

function normalize(value: string): string {
  return value.replace(/\s+/g, " ").trim().toLocaleLowerCase("ko-KR");
}

function isFieldVerificationSentinel(value: string): boolean {
  return normalize(value) === "현장 확인 필요";
}

function sourceMatchesReference(source: GroundedGenerationSource, reference: string): boolean {
  const normalizedReference = normalize(reference);
  const typedReference = /^(DB|SIF|KOSHA|LAW):/i.test(reference.trim());
  if (typedReference) return normalize(source.referenceKey) === normalizedReference;
  return source.aliases.some((alias) => normalize(alias) === normalizedReference);
}

function matchingSources(packet: GroundedGenerationPacket, reference: string): readonly GroundedGenerationSource[] {
  return packet.sources.filter((source) => sourceMatchesReference(source, reference));
}

const KOSHA_REFERENCE_RE = /\b[A-Z](?:-[A-Z])?-\d{1,4}-\d{4}\b/g;
const LAW_REFERENCE_RE = /제\d+조(?:의\d+)?/g;

type ExplicitReference = { kind: "kosha" | "law"; value: string };

function collectExplicitReferences(value: string): ExplicitReference[] {
  return [
    ...(value.match(KOSHA_REFERENCE_RE) || []).map((match) => ({ kind: "kosha" as const, value: match })),
    ...(value.match(LAW_REFERENCE_RE) || []).map((match) => ({ kind: "law" as const, value: match }))
  ];
}

function sourceHasExplicitReference(source: GroundedGenerationSource, reference: ExplicitReference): boolean {
  if (source.kind !== reference.kind) return false;
  const sourceText = [source.referenceKey, source.title, source.summary, ...source.aliases].join("\n");
  return collectExplicitReferences(sourceText).some((candidate) => (
    candidate.kind === reference.kind && normalize(candidate.value) === normalize(reference.value)
  ));
}

function controlClaimMatches(
  claim: string,
  control: string,
  controlSources: readonly GroundedGenerationSource[]
): boolean {
  const canonicalClaim = claim.replace(/\s+/g, " ").trim();
  const canonicalControl = control.replace(/\s+/g, " ").trim();
  const normalizedClaim = normalize(canonicalClaim);
  const normalizedControl = normalize(canonicalControl);
  if (normalizedClaim === normalizedControl) return true;
  if (!normalizedClaim.startsWith(normalizedControl)) return false;
  const suffix = canonicalClaim.slice(canonicalControl.length).trim();
  if (!/^(?:\([^()]+\)\s*)+$/.test(suffix)) return false;
  const citationGroups = [...suffix.matchAll(/\(([^()]+)\)/g)].map((match) => match[1].trim());
  return citationGroups.length > 0 && citationGroups.every((citation) => {
    const references = collectExplicitReferences(citation);
    return references.length === 1
      && normalize(references[0].value) === normalize(citation)
      && controlSources.some((source) => sourceHasExplicitReference(source, references[0]));
  });
}

function validateControlObject(
  record: Record<string, unknown>,
  fields: readonly string[],
  packet: GroundedGenerationPacket,
  path: string,
  violations: GroundingViolation[]
): void {
  const evidenceRefs = Array.isArray(record.evidenceRefs)
    ? record.evidenceRefs.filter((value): value is string => typeof value === "string" && value.trim().length > 0)
    : [];
  const controlSources = evidenceRefs
    .flatMap((reference) => matchingSources(packet, reference))
    .filter((source) => source.controls.length > 0);
  for (const field of fields) {
    const controlValue = record[field];
    if (typeof controlValue !== "string" || controlValue.trim().length === 0) continue;
    if (isFieldVerificationSentinel(controlValue)) continue;
    if (controlSources.length === 0) {
      violations.push({ code: "control_provenance_missing", path: `${path}.${field}`, value: controlValue });
      continue;
    }
    const matchesPacketControl = controlSources.some((source) => source.controls.some((control) => {
      return controlClaimMatches(controlValue, control, controlSources);
    }));
    if (!matchesPacketControl) {
      violations.push({ code: "control_claim_not_in_packet", path: `${path}.${field}`, value: controlValue });
    }
  }
}

function recordOf(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function validateUnreferencedControlValue(
  value: unknown,
  packet: GroundedGenerationPacket,
  path: string,
  violations: GroundingViolation[]
): void {
  if (typeof value !== "string" || value.trim().length === 0 || isFieldVerificationSentinel(value)) return;
  const controlSources = packet.sources.filter((source) => source.controls.length > 0);
  const grounded = controlSources.some((source) => source.controls.some((control) => (
    controlClaimMatches(value, control, controlSources)
  )));
  if (!grounded) violations.push({ code: "control_claim_not_in_packet", path, value });
}

function validateUnreferencedControlArray(
  value: unknown,
  packet: GroundedGenerationPacket,
  path: string,
  violations: GroundingViolation[]
): void {
  if (!Array.isArray(value)) return;
  value.forEach((item, index) => {
    validateUnreferencedControlValue(item, packet, `${path}[${index}]`, violations);
  });
}

function validateSchemaControls(
  output: Record<string, unknown>,
  packet: GroundedGenerationPacket,
  violations: GroundingViolation[]
): void {
  const validateArray = (container: unknown, fields: readonly string[], path: string): void => {
    if (!Array.isArray(container)) return;
    container.forEach((item, index) => {
      if (item && typeof item === "object" && !Array.isArray(item)) {
        validateControlObject(item as Record<string, unknown>, fields, packet, `${path}[${index}]`, violations);
      }
    });
  };
  validateArray(output.structuredRiskRows, ["currentControls", "additionalControls"], "$.structuredRiskRows");
  validateArray(output.tbmRiskLinks, ["control"], "$.tbmRiskLinks");

  const workPlan = recordOf(output.workPlanStructured);
  if (workPlan) {
    validateArray(workPlan.workSteps, ["safetyMeasure"], "$.workPlanStructured.workSteps");
    validateUnreferencedControlArray(workPlan.stopCriteria, packet, "$.workPlanStructured.stopCriteria", violations);
    validateUnreferencedControlValue(
      recordOf(workPlan.emergencyResponse)?.firstAid,
      packet,
      "$.workPlanStructured.emergencyResponse.firstAid",
      violations
    );
  }
  const tbmBriefing = recordOf(output.tbmBriefingStructured);
  if (tbmBriefing) {
    validateArray(tbmBriefing.measures, ["action"], "$.tbmBriefingStructured.measures");
    validateUnreferencedControlArray(tbmBriefing.stopCriteria, packet, "$.tbmBriefingStructured.stopCriteria", violations);
  }
  const permit = recordOf(output.permitInspectionStructured);
  if (permit) {
    validateArray(permit.conditions, ["requirement", "action"], "$.permitInspectionStructured.conditions");
    const completionChecks = Array.isArray(permit.completionChecks) ? permit.completionChecks : [];
    completionChecks.forEach((item, index) => {
      validateUnreferencedControlValue(
        recordOf(item)?.method,
        packet,
        `$.permitInspectionStructured.completionChecks[${index}].method`,
        violations
      );
    });
  }
  const tbmLog = recordOf(output.tbmLogStructured);
  if (tbmLog) {
    validateArray(tbmLog.unaddressedItems, ["plannedAction"], "$.tbmLogStructured.unaddressedItems");
    validateUnreferencedControlArray(tbmLog.workerConfirmations, packet, "$.tbmLogStructured.workerConfirmations", violations);
    validateUnreferencedControlArray(
      recordOf(tbmLog.safetyEducation)?.keyPoints,
      packet,
      "$.tbmLogStructured.safetyEducation.keyPoints",
      violations
    );
  }
  const education = recordOf(output.educationRecordStructured);
  if (education) {
    const curriculum = Array.isArray(education.curriculum) ? education.curriculum : [];
    curriculum.forEach((item, index) => {
      validateUnreferencedControlArray(
        recordOf(item)?.keyPoints,
        packet,
        `$.educationRecordStructured.curriculum[${index}].keyPoints`,
        violations
      );
    });
  }
}

const NARRATIVE_CONTROL_FIELDS = new Set([
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
]);

const DESCRIPTIVE_SENTENCE_END_RE = /(?:입니다|이다|있습니다|있다|없습니다|없다|같습니다|같다|높습니다|높다|낮습니다|낮다)[.!?]?$/;
const ACTIONABLE_SENTENCE_END_RE = /(?:다|것|하세요|하십시오|금지|중지)[.!?]?$/;
const NOMINAL_CLAUSE_TOKEN_RE = /^[가-힣A-Za-z0-9·()/-]+$/;

function isInstructionShapedNominalClause(value: string): boolean {
  const clause = value.replace(/[.!?]+$/, "").trim();
  if (!clause || /^(?:\[.*\]|\(.*\))$/.test(clause) || /[:：]$/.test(clause)) return false;
  const tokens = clause.split(/\s+/);
  return tokens.length >= 2
    && tokens.length <= 4
    && clause.length <= 30
    && tokens.every((token) => NOMINAL_CLAUSE_TOKEN_RE.test(token));
}

function isActionableNarrativeSentence(value: string): boolean {
  const sentence = value.trim();
  return !DESCRIPTIVE_SENTENCE_END_RE.test(sentence)
    && (ACTIONABLE_SENTENCE_END_RE.test(sentence) || isInstructionShapedNominalClause(sentence));
}

function narrativeSentences(value: string): string[] {
  return (value.match(/[^.!?\n]+[.!?]?/g) || [])
    .map((sentence) => sentence.trim())
    .filter(Boolean);
}

function stripNarrativePrefix(value: string): string {
  return value
    .replace(/^(?:[-*•]\s*|\d+[.)]\s*)+/, "")
    .replace(/^(?:(?:감소대책|즉시\s*조치|안전\s*조치|통제\s*조치|조치)\s*[:：-]\s*)+/, "")
    .trim();
}

function validateNarrativeControls(
  output: Record<string, unknown>,
  packet: GroundedGenerationPacket,
  violations: GroundingViolation[]
): void {
  const controlSources = packet.sources.filter((source) => source.controls.length > 0);
  for (const [field, value] of Object.entries(output)) {
    if (!NARRATIVE_CONTROL_FIELDS.has(field) || typeof value !== "string") continue;
    for (const sentence of narrativeSentences(value)) {
      const claim = stripNarrativePrefix(sentence);
      const grounded = controlSources.some((source) => source.controls.some((control) => (
        controlClaimMatches(claim, control, controlSources)
      )));
      if (!grounded && isActionableNarrativeSentence(claim) && !isFieldVerificationSentinel(claim)) {
        violations.push({ code: "control_claim_not_in_packet", path: `$.${field}`, value: sentence });
      }
    }
  }
}

function validateNode(
  node: unknown,
  packet: GroundedGenerationPacket,
  path: string,
  violations: GroundingViolation[]
): void {
  if (typeof node === "string") {
    for (const reference of collectExplicitReferences(node)) {
      if (!packet.sources.some((source) => sourceHasExplicitReference(source, reference))) {
        violations.push({ code: "unknown_reference", path, value: reference.value });
      }
    }
    return;
  }
  if (Array.isArray(node)) {
    node.forEach((item, index) => validateNode(item, packet, `${path}[${index}]`, violations));
    return;
  }
  if (!node || typeof node !== "object") return;

  const record = node as Record<string, unknown>;
  const evidenceRefs = Array.isArray(record.evidenceRefs)
    ? record.evidenceRefs.filter((value): value is string => typeof value === "string" && value.trim().length > 0)
    : [];
  for (const reference of evidenceRefs) {
    if (matchingSources(packet, reference).length === 0) {
      violations.push({ code: "unknown_reference", path: `${path}.evidenceRefs`, value: reference });
    }
  }

  for (const [key, value] of Object.entries(record)) {
    if (key === "evidenceRefs") continue;
    validateNode(value, packet, path ? `${path}.${key}` : key, violations);
  }
}

export function validateGroundedGenerationOutput(
  output: unknown,
  packet: GroundedGenerationPacket
): GroundedGenerationValidation {
  const violations: GroundingViolation[] = [];
  validateNode(output, packet, "$", violations);
  if (output && typeof output === "object" && !Array.isArray(output)) {
    const record = output as Record<string, unknown>;
    validateSchemaControls(record, packet, violations);
    validateNarrativeControls(record, packet, violations);
  }
  return deepFreeze({
    status: packet.status === "ready" && violations.length === 0 ? "grounded" : "review_required",
    violations
  });
}

export function serializeGroundedGenerationPacket(packet: GroundedGenerationPacket): string {
  return JSON.stringify(packet);
}
