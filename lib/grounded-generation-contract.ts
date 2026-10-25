import { createHash } from "node:crypto";

import type { DbHarnessPacket } from "@/lib/db-harness";
import {
  getKoshaGroundingDecision,
  getSafetyReferenceDisplayTitle,
  isKoshaSupportingCitationEligible,
  isKoshaTechnicalReference,
  isOverseasSafetyReference,
  isSafetyReferenceDirectEligible,
  isSafetyReferenceReviewMetaControl,
  OVERSEAS_REFERENCE_NOTICE,
  type SafetyReferenceItem
} from "@/lib/safety-reference-catalog";
import type { SearchResult } from "@/lib/types";

// PR-12(2026-10-26): ontology = 생성 전에 주입한 온톨로지 published 조치(결정 3 안 A, 조치 1건 = 출처 1건, 조문 연결),
// overseas = 국외 참고 사례(country≠KR) — 참고 표시로만 싣고 controls·조문 매핑에 쓰지 않는다.
export type GroundedGenerationSource = Readonly<{
  referenceKey: string;
  kind: "direct" | "ontology" | "sif" | "kosha" | "law" | "overseas";
  sourceId: string;
  title: string;
  summary: string;
  aliases: readonly string[];
  controls: readonly string[];
}>;

export type OntologyControlEvidence = Readonly<{
  controlId: string;
  controlLabel: string;
  taskLabel: string;
  hazardLabel: string;
  articles: readonly Readonly<{ nodeId: string; label: string; law: string; articleNo: string }>[];
}>;

export type GroundedGenerationPacket = Readonly<{
  version: "grounded-generation-v1";
  sourceIdentity: string;
  /** ready = controls 를 가진 국내 출처가 1건 이상. 체크리스트 부족은 status 가 아니라 checklist(진단 배지)로만 남긴다(H1). */
  status: "ready" | "review_required";
  checklist: Readonly<{ status: "ready" | "review_required"; missing: readonly string[] }>;
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
    // H5: 「검토 필요」 운영 뷰의 메타 문구(「관리감독자 검토 완료 전 …」 등)는 작업자 조치가 아니다 — controls 로 싣지 않는다.
    controls: uniqueStrings(item.controls).filter((control) => !isSafetyReferenceReviewMetaControl(control))
  };
}

function overseasSource(item: SafetyReferenceItem): GroundedGenerationSource {
  const referenceKey = `OVS:${item.id}`;
  const title = getSafetyReferenceDisplayTitle(item);
  return {
    referenceKey,
    kind: "overseas",
    sourceId: item.id,
    title,
    summary: `${OVERSEAS_REFERENCE_NOTICE} ${item.country ? `[${item.country}] ` : ""}${item.summary || ""}`.trim(),
    aliases: uniqueStrings([referenceKey, item.id, item.source_id, title]),
    controls: []
  };
}

const LAW_NAME_ALIASES: Readonly<Record<string, readonly string[]>> = {
  "산업안전보건기준에 관한 규칙": ["산업안전보건기준에 관한 규칙", "안전보건규칙", "기준규칙"],
  "산업안전보건법 시행규칙": ["산업안전보건법 시행규칙"],
  "산업안전보건법 시행령": ["산업안전보건법 시행령"],
  "산업안전보건법": ["산업안전보건법"],
  "중대재해 처벌 등에 관한 법률": ["중대재해 처벌 등에 관한 법률", "중대재해처벌법"]
};

function ontologySource(evidence: OntologyControlEvidence): GroundedGenerationSource {
  const referenceKey = `ONT:${evidence.controlId}`;
  const articleAliases = evidence.articles.flatMap((article) => [
    article.label,
    ...(LAW_NAME_ALIASES[article.law] || [article.law]).map((law) => `${law} 제${article.articleNo}조`)
  ]);
  return {
    referenceKey,
    kind: "ontology",
    sourceId: evidence.controlId,
    title: evidence.controlLabel,
    summary: `${evidence.taskLabel} · ${evidence.hazardLabel} · 근거 ${evidence.articles.map((article) => article.label).join(", ")}`,
    aliases: uniqueStrings([referenceKey, evidence.controlId, evidence.controlLabel, ...articleAliases]),
    controls: [evidence.controlLabel]
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
  /** 생성 전에 조회한 온톨로지 published 조치(lib/grounding-ontology-injection.ts). */
  ontologySources?: readonly OntologyControlEvidence[];
}): GroundedGenerationPacket {
  const allReferences = [
    ...input.dbHarnessPacket.directEvidence,
    ...input.dbHarnessPacket.sifCases,
    ...input.dbHarnessPacket.supportingEvidence
  ];
  const overseas = allReferences.filter(isOverseasSafetyReference).map(overseasSource);
  const domestic = (items: readonly SafetyReferenceItem[]) => items.filter((item) => !isOverseasSafetyReference(item));
  const direct = domestic(input.dbHarnessPacket.directEvidence)
    .filter((item) => !isKoshaTechnicalReference(item) && isSafetyReferenceDirectEligible(item))
    .map((item) => safetySource(item, "direct", `DB:${item.id}`));
  const ontology = (input.ontologySources || []).map(ontologySource);
  const sif = domestic(input.dbHarnessPacket.sifCases)
    .filter((item) => item.item_type === "sif-case")
    .map((item) => safetySource(item, "sif", `SIF:${item.id}`));
  const kosha = domestic([
    ...input.dbHarnessPacket.directEvidence,
    ...input.dbHarnessPacket.supportingEvidence
  ])
    .filter(isKoshaTechnicalReference)
    .filter((item) => input.eligibleKoshaIds.has(item.id) && isKoshaSupportingCitationEligible(item))
    .map((item) => {
      const grounding = getKoshaGroundingDecision(item);
      const stableKey = item.kosha_guide?.stableDocumentKey
        || grounding?.metadata?.stableDocumentKey
        || item.id;
      const version = item.kosha_guide?.version || grounding?.metadata?.version;
      return safetySource(item, "kosha", `KOSHA:${stableKey}${version ? `@${version}` : ""}`);
    });
  const law = input.legalCandidates.map(legalSource);
  const kindOrder: Readonly<Record<GroundedGenerationSource["kind"], number>> = {
    direct: 0,
    ontology: 1,
    sif: 2,
    kosha: 3,
    law: 4,
    overseas: 5
  };
  const sources = canonicalizeSources([...direct, ...ontology, ...sif, ...kosha, ...law, ...overseas])
    .sort((left, right) => (
      kindOrder[left.kind] - kindOrder[right.kind]
      || compareCanonical(left.referenceKey, right.referenceKey)
      || compareCanonical(left.sourceId, right.sourceId)
    ));
  // H1(결정 2): 체크리스트 부족(TBM 기록 근거 없음 등)은 생성을 막지 않는다. 출처가 0건이면 빈 출력도 review_required.
  const status = sources.some((source) => source.kind !== "overseas" && source.controls.length > 0)
    ? "ready"
    : "review_required";
  const checklist = {
    status: input.dbHarnessPacket.ontologyChecklist.status,
    missing: uniqueStrings(input.dbHarnessPacket.ontologyChecklist.missing)
  };
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
    checklist,
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
  const typedReference = /^(DB|ONT|SIF|KOSHA|LAW|OVS):/i.test(reference.trim());
  if (typedReference) return normalize(source.referenceKey) === normalizedReference;
  return source.aliases.some((alias) => normalize(alias) === normalizedReference);
}

function matchingSources(packet: GroundedGenerationPacket, reference: string): readonly GroundedGenerationSource[] {
  return packet.sources.filter((source) => sourceMatchesReference(source, reference));
}

const KOSHA_REFERENCE_RE = /\b[A-Z](?:-[A-Z])?-\d{1,4}-\d{4}\b/g;
// H6(결정 5): 조문은 법령명과 함께 써야 근거가 된다. 맨 「제N조」는 어느 출처와도 맞지 않는다(law: null).
const LAW_NAME_PATTERN = "산업안전보건기준에\\s*관한\\s*규칙|안전보건규칙|기준규칙|산업안전보건법\\s*시행규칙|산업안전보건법\\s*시행령|산업안전보건법|중대재해\\s*처벌\\s*등에\\s*관한\\s*법률|중대재해처벌법";
const LAW_REFERENCE_RE = new RegExp(`(?:(${LAW_NAME_PATTERN})\\s*)?(제\\d+조(?:의\\d+)?)`, "g");

type ExplicitReference =
  | { kind: "kosha"; value: string }
  | { kind: "law"; value: string; law: string | null; article: string };

function canonicalLawName(raw: string): string {
  const compact = raw.replace(/\s+/g, "");
  if (/^(?:산업안전보건기준에관한규칙|안전보건규칙|기준규칙)$/.test(compact)) return "산업안전보건기준에 관한 규칙";
  if (compact === "산업안전보건법시행규칙") return "산업안전보건법 시행규칙";
  if (compact === "산업안전보건법시행령") return "산업안전보건법 시행령";
  if (compact === "산업안전보건법") return "산업안전보건법";
  if (/^(?:중대재해처벌등에관한법률|중대재해처벌법)$/.test(compact)) return "중대재해 처벌 등에 관한 법률";
  return compact;
}

function collectExplicitReferences(value: string): ExplicitReference[] {
  const references: ExplicitReference[] = (value.match(KOSHA_REFERENCE_RE) || [])
    .map((match) => ({ kind: "kosha" as const, value: match }));
  for (const match of value.matchAll(LAW_REFERENCE_RE)) {
    references.push({
      kind: "law",
      value: match[0].replace(/\s+/g, " ").trim(),
      law: match[1] ? canonicalLawName(match[1]) : null,
      article: match[2]
    });
  }
  return references;
}

function sourceHasExplicitReference(source: GroundedGenerationSource, reference: ExplicitReference): boolean {
  if (reference.kind === "kosha") {
    if (source.kind !== "kosha") return false;
    const sourceText = [source.referenceKey, source.title, source.summary, ...source.aliases].join("\n");
    return collectExplicitReferences(sourceText).some((candidate) => (
      candidate.kind === "kosha" && normalize(candidate.value) === normalize(reference.value)
    ));
  }
  // 조문은 법령·온톨로지 출처만 댈 수 있다. 국외 참고 사례(overseas)는 조문 매핑에 쓰지 않는다.
  if (reference.law === null) return false;
  if (source.kind !== "law" && source.kind !== "ontology") return false;
  const sourceText = [source.referenceKey, source.title, source.summary, ...source.aliases].join("\n");
  return collectExplicitReferences(sourceText).some((candidate) => (
    candidate.kind === "law"
    && candidate.law === reference.law
    && normalize(candidate.article) === normalize(reference.article)
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
  validateUnreferencedControlArray(
    output.safetyEducationPoints,
    packet,
    "$.safetyEducationPoints",
    violations
  );
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
const DESCRIPTIVE_NOMINAL_FIELD_LABELS = new Set(["작업 장소", "사용 장비"]);

function isInstructionShapedNominalClause(value: string): boolean {
  const clause = value.replace(/[.!?]+$/, "").trim();
  if (!clause || /^(?:\[.*\]|\(.*\))$/.test(clause) || /[:：]$/.test(clause)) return false;
  const tokens = clause.split(/\s+/);
  if (tokens.length < 2 || tokens.length > 6 || clause.length > 30) return false;
  if (!tokens.every((token) => NOMINAL_CLAUSE_TOKEN_RE.test(token))) return false;
  const metadataLabel = tokens.slice(0, 2).join(" ");
  return tokens.length < 3 || !DESCRIPTIVE_NOMINAL_FIELD_LABELS.has(metadataLabel);
}

function isActionableNarrativeSentence(value: string): boolean {
  const sentence = value.trim();
  return !DESCRIPTIVE_SENTENCE_END_RE.test(sentence)
    && (ACTIONABLE_SENTENCE_END_RE.test(sentence) || isInstructionShapedNominalClause(sentence));
}

function narrativeSentences(value: string): string[] {
  // 「2.5m」처럼 숫자 사이 마침표는 문장 끝이 아니다.
  return (value.match(/(?:\d\.\d|[^.!?\n])+[.!?]?/g) || [])
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
