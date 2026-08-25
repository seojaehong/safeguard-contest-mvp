import { createHash } from "node:crypto";
import type { KnowledgeRawEvent } from "@/lib/safety-knowledge";

export type KnowledgePromotionStageId =
  | "knowledge_event"
  | "candidate"
  | "human_review"
  | "published_ontology";

export type KnowledgeAuthorityId =
  | "sif"
  | "kosha"
  | "law"
  | "organization_history"
  | "site_history"
  | "hermes_llm";

type KnowledgeAuthority =
  | "incident_control_evidence"
  | "technical_guidance"
  | "statutory_source"
  | "operation_memory"
  | "context_evidence"
  | "none";

type KnowledgeScope =
  | "public_reference"
  | "organization_private"
  | "site_private"
  | "event_context"
  | "candidate_only";

type LegalDutyRole =
  | "statutory_source"
  | "non_statutory_reference"
  | "operational_evidence_only"
  | "no_authority";

export type KnowledgePromotionStage = {
  id: KnowledgePromotionStageId;
  sequence: string;
  label: string;
  detail: string;
  owner: "safeclaw_ingest" | "hermes_or_llm" | "human_reviewer" | "safeclaw_published_store";
  ownerLabel: string;
  publicationState: "unpublished" | "review_gate" | "published";
  stateLabel: string;
  reviewRequired: boolean;
  dbMutationAllowed: boolean;
  publishAllowed: boolean;
  nextStage: KnowledgePromotionStageId | null;
};

export type KnowledgeAuthorityLane = {
  id: KnowledgeAuthorityId;
  label: string;
  authority: KnowledgeAuthority;
  authorityLabel: string;
  scope: KnowledgeScope;
  scopeLabel: string;
  legalDutyRole: LegalDutyRole;
  legalDutyLabel: string;
  provenanceRule: string;
  publishAllowed: boolean;
};

export type KnowledgeTenantContext = {
  organizationId: string;
  siteId: string;
};

type KnowledgeReviewMetadataValue = string | number | boolean | null;

export type KnowledgeEventReference = {
  sourceId: string;
  capturedAt: string;
  digestAlgorithm: "sha256";
  digest: string;
};

export type KnowledgePayloadEvidence = {
  digestAlgorithm: "sha256";
  digest: string;
  byteLength: number;
  topLevelKeyCount: number;
  omittedTopLevelKeyCount: number;
  reviewMetadata: Record<string, KnowledgeReviewMetadataValue>;
  metadataTruncated: boolean;
};

export type KnowledgeEventProvenance = {
  source: KnowledgeRawEvent["source"];
  eventReference: KnowledgeEventReference;
  tenantContext: KnowledgeTenantContext;
  payloadEvidence: KnowledgePayloadEvidence;
  authorityId: KnowledgeAuthorityId | "external_context";
  authority: KnowledgeAuthority;
  scope: KnowledgeScope;
  legalDutyRole: LegalDutyRole;
};

export type KnowledgeCandidate = {
  contractVersion: "knowledge-candidate.v2";
  stage: "candidate";
  reviewStatus: "pending_review";
  publicationState: "unpublished";
  generatedBy: "hermes_or_llm" | "safeclaw_candidate_builder";
  providerLabel: string | null;
  authority: "none";
  nextStage: "human_review";
  dbMutationAllowed: false;
  dbMutationPerformed: false;
  publishAllowed: false;
  question: string;
  generatedText: string;
  matchedHazardIds: string[];
  tenantContext: KnowledgeTenantContext;
  provenance: KnowledgeEventProvenance[];
};

export const KNOWLEDGE_REVIEW_AUTHORITY_ORDER = [
  "sif",
  "kosha",
  "law",
  "organization_history",
  "site_history",
  "external_context"
] as const;

type KnowledgeReviewAuthorityId = typeof KNOWLEDGE_REVIEW_AUTHORITY_ORDER[number];

export type KnowledgeCandidateReviewContract = {
  contractVersion: "knowledge-candidate-review.v1";
  status: "human_review_required";
  authorityOrder: readonly KnowledgeReviewAuthorityId[];
  presentAuthorityIds: KnowledgeReviewAuthorityId[];
  sourceRoleCounts: {
    sifIncidentControlEvidence: number;
    koshaTechnicalGuidance: number;
    lawStatutorySource: number;
    organizationPrivateMemory: number;
    sitePrivateMemory: number;
    externalContext: number;
  };
  sifControlsAreNonStatutoryEvidence: true;
  koshaGuidanceIsNonStatutory: true;
  statutoryClaimsRequireLawProvenance: true;
  tenantMemoryPublicPromotionAllowed: false;
  siteManagerAcceptanceRequiredBeforeWorkpackUse: true;
  publicationState: "unpublished";
  humanReviewRequired: true;
  machineEvidenceReplacesHumanReview: false;
  dbMutationAllowed: false;
  publishAllowed: false;
};

export const KNOWLEDGE_CANDIDATE_REQUIRED_SECTIONS = [
  { id: "hazard_summary", label: "위험요인 요약" },
  { id: "document_targets", label: "문서 반영 위치" },
  { id: "controls", label: "통제대책" },
  { id: "review_items", label: "검수 필요 항목" }
] as const;

type KnowledgeCandidateRequiredSectionId = typeof KNOWLEDGE_CANDIDATE_REQUIRED_SECTIONS[number]["id"];

export type KnowledgeCandidateContentReadiness = {
  contractVersion: "knowledge-candidate-content-readiness.v1";
  status: "ready_for_human_review" | "revision_required";
  requiredSectionCount: 4;
  presentSectionCount: number;
  nonEmptySectionCount: number;
  sections: Array<{
    id: KnowledgeCandidateRequiredSectionId;
    label: string;
    present: boolean;
    nonEmpty: boolean;
  }>;
  placeholderFindingCount: number;
  legalOverclaimFindingCount: number;
  statutoryClaimDetected: boolean;
  lawProvenancePresent: boolean;
  hazardGroundingPresent: boolean;
  unresolvedReviewItems: string[];
  humanReviewCompleted: false;
  publicationState: "unpublished";
  publishAllowed: false;
};

const SECTION_HEADING_PATTERN = /^\s*(?:#{1,6}\s*)?(?:\*{1,2})?\s*(?:\d+\s*[.)]|[①②③④])?\s*(위험요인\s*요약|문서\s*반영\s*위치|통제\s*대책|검수\s*필요\s*항목)\s*(?:\*{1,2})?\s*(?::|：|-)?\s*(.*)$/u;
const PLACEHOLDER_PATTERNS = [
  /\b(?:todo|tbd)\b/iu,
  /(?:작성|내용|정보|항목)\s*(?:필요|예정)/u,
  /추후\s*(?:입력|작성|확인)/u,
  /(?:임시|샘플)\s*(?:문구|텍스트)/u,
  /(?:여기에|아래에)\s*(?:입력|작성)/u
] as const;
const LEGAL_OVERCLAIM_PATTERNS = [
  /법적\s*효력(?:을|이)?\s*(?:보장|확정)/u,
  /(?:법령|법적\s*의무|법정\s*(?:교육|서류|절차))(?:을|를)?\s*(?:대체|갈음)/u,
  /(?:자동|완전)\s*(?:준수|충족)/u,
  /법적\s*(?:책임|의무)(?:이|가)?\s*(?:면제|없어짐)/u
] as const;
const STATUTORY_CLAIM_PATTERNS = [
  /법령상/u,
  /법적\s*의무/u,
  /법정\s*(?:교육|서류|절차)/u,
  /산업안전보건법(?:에|에\s*따라|상)/u,
  /(?:법률|시행령|시행규칙)(?:에|에\s*따라|상)/u
] as const;
const HAZARD_GROUNDING_PATTERN = /추락|끼임|감전|화재|폭발|충돌|전도|질식|양중|화학|유해|고소|굴착|밀폐|산소결핍|누출|지게차/u;

function readKnowledgeCandidateSections(text: string): Map<KnowledgeCandidateRequiredSectionId, string> {
  const labelToId = new Map<string, KnowledgeCandidateRequiredSectionId>(
    KNOWLEDGE_CANDIDATE_REQUIRED_SECTIONS.map((section) => [section.label.replace(/\s+/gu, ""), section.id])
  );
  const sections = new Map<KnowledgeCandidateRequiredSectionId, string[]>();
  let activeSection: KnowledgeCandidateRequiredSectionId | null = null;

  for (const line of text.replace(/\r\n?/gu, "\n").split("\n")) {
    const heading = line.match(SECTION_HEADING_PATTERN);
    if (heading) {
      activeSection = labelToId.get((heading[1] ?? "").replace(/\s+/gu, "")) ?? null;
      if (activeSection) sections.set(activeSection, [(heading[2] ?? "").trim()]);
      continue;
    }
    if (activeSection) sections.get(activeSection)?.push(line.trim());
  }

  return new Map([...sections.entries()].map(([id, lines]) => [
    id,
    lines.join("\n").replace(/\s+/gu, " ").trim()
  ]));
}

export function evaluateKnowledgeCandidateContentReadiness(
  candidate: KnowledgeCandidate
): KnowledgeCandidateContentReadiness {
  const sectionText = readKnowledgeCandidateSections(candidate.generatedText);
  const sections = KNOWLEDGE_CANDIDATE_REQUIRED_SECTIONS.map((section) => {
    const content = sectionText.get(section.id);
    return {
      ...section,
      present: content !== undefined,
      nonEmpty: Boolean(content)
    };
  });
  const placeholderFindingCount = PLACEHOLDER_PATTERNS.filter((pattern) => pattern.test(candidate.generatedText)).length;
  const legalOverclaimFindingCount = LEGAL_OVERCLAIM_PATTERNS.filter((pattern) => pattern.test(candidate.generatedText)).length;
  const statutoryClaimDetected = STATUTORY_CLAIM_PATTERNS.some((pattern) => pattern.test(candidate.generatedText));
  const lawProvenancePresent = candidate.provenance.some((item) => item.authorityId === "law");
  const hazardGroundingPresent = HAZARD_GROUNDING_PATTERN.test(sectionText.get("hazard_summary") ?? "");
  const unresolvedReviewItems = [
    ...sections.filter((section) => !section.present).map((section) => `missing_section:${section.id}`),
    ...sections.filter((section) => section.present && !section.nonEmpty).map((section) => `empty_section:${section.id}`),
    ...(placeholderFindingCount > 0 ? ["placeholder_content"] : []),
    ...(legalOverclaimFindingCount > 0 ? ["legal_overclaim"] : []),
    ...(statutoryClaimDetected && !lawProvenancePresent ? ["statutory_claim_without_law_provenance"] : []),
    ...(!hazardGroundingPresent ? ["hazard_grounding_missing"] : [])
  ];

  return {
    contractVersion: "knowledge-candidate-content-readiness.v1",
    status: unresolvedReviewItems.length === 0 ? "ready_for_human_review" : "revision_required",
    requiredSectionCount: 4,
    presentSectionCount: sections.filter((section) => section.present).length,
    nonEmptySectionCount: sections.filter((section) => section.nonEmpty).length,
    sections,
    placeholderFindingCount,
    legalOverclaimFindingCount,
    statutoryClaimDetected,
    lawProvenancePresent,
    hazardGroundingPresent,
    unresolvedReviewItems,
    humanReviewCompleted: false,
    publicationState: "unpublished",
    publishAllowed: false
  };
}

export const KNOWLEDGE_PROMOTION_STAGES: readonly KnowledgePromotionStage[] = [
  {
    id: "knowledge_event",
    sequence: "01",
    label: "원본 이벤트",
    detail: "수집 시점, 출처, 원문 링크와 현장 범위를 보존한 knowledge_events 기록",
    owner: "safeclaw_ingest",
    ownerLabel: "SafeClaw 수집",
    publicationState: "unpublished",
    stateLabel: "원본 · 미게시",
    reviewRequired: false,
    dbMutationAllowed: true,
    publishAllowed: false,
    nextStage: "candidate"
  },
  {
    id: "candidate",
    sequence: "02",
    label: "지식 후보",
    detail: "Hermes/LLM이 원본 provenance를 붙여 만드는 검토용 제안",
    owner: "hermes_or_llm",
    ownerLabel: "Hermes / LLM",
    publicationState: "unpublished",
    stateLabel: "후보 · 미게시",
    reviewRequired: true,
    dbMutationAllowed: false,
    publishAllowed: false,
    nextStage: "human_review"
  },
  {
    id: "human_review",
    sequence: "03",
    label: "사람 검토",
    detail: "출처, 권위, 적용 범위와 충돌 여부를 사람이 판정하는 승인 게이트",
    owner: "human_reviewer",
    ownerLabel: "검토 책임자",
    publicationState: "review_gate",
    stateLabel: "필수 검토",
    reviewRequired: true,
    dbMutationAllowed: false,
    publishAllowed: false,
    nextStage: "published_ontology"
  },
  {
    id: "published_ontology",
    sequence: "04",
    label: "Published ontology",
    detail: "별도 승인과 감사 요건을 통과한 기존 published 부분그래프",
    owner: "safeclaw_published_store",
    ownerLabel: "SafeClaw system of record",
    publicationState: "published",
    stateLabel: "읽기 전용",
    reviewRequired: false,
    dbMutationAllowed: false,
    publishAllowed: false,
    nextStage: null
  }
] as const;

export const KNOWLEDGE_AUTHORITY_LANES: readonly KnowledgeAuthorityLane[] = [
  {
    id: "sif",
    label: "SIF 재해·통제 근거",
    authority: "incident_control_evidence",
    authorityLabel: "재해·통제 근거",
    scope: "public_reference",
    scopeLabel: "공개 참조",
    legalDutyRole: "non_statutory_reference",
    legalDutyLabel: "법적 의무 아님",
    provenanceRule: "중대재해 패턴과 통제 근거로 추적하며 법령 출처로 대체하지 않음",
    publishAllowed: false
  },
  {
    id: "kosha",
    label: "KOSHA Guide",
    authority: "technical_guidance",
    authorityLabel: "기술 지침",
    scope: "public_reference",
    scopeLabel: "공개 참조",
    legalDutyRole: "non_statutory_reference",
    legalDutyLabel: "법적 의무 아님",
    provenanceRule: "기술적 실행 방법과 통제대책 근거로 사용하며 법적 강제성과 분리",
    publishAllowed: false
  },
  {
    id: "law",
    label: "현행 법령",
    authority: "statutory_source",
    authorityLabel: "법적 근거",
    scope: "public_reference",
    scopeLabel: "공개 참조",
    legalDutyRole: "statutory_source",
    legalDutyLabel: "현행성 확인 필수",
    provenanceRule: "공식 조문, 시행일과 개정 상태를 확인한 경우에만 법적 의무 근거로 사용",
    publishAllowed: false
  },
  {
    id: "organization_history",
    label: "조직 이력",
    authority: "operation_memory",
    authorityLabel: "운영 이력",
    scope: "organization_private",
    scopeLabel: "조직 전용",
    legalDutyRole: "operational_evidence_only",
    legalDutyLabel: "운영 증거만",
    provenanceRule: "해당 조직의 작업팩과 개선 이력으로 제한하고 공개 참조와 섞지 않음",
    publishAllowed: false
  },
  {
    id: "site_history",
    label: "현장 이력",
    authority: "operation_memory",
    authorityLabel: "운영 이력",
    scope: "site_private",
    scopeLabel: "현장 전용",
    legalDutyRole: "operational_evidence_only",
    legalDutyLabel: "운영 증거만",
    provenanceRule: "해당 현장의 관찰과 조치 이력으로 제한하고 조직 밖 승격을 허용하지 않음",
    publishAllowed: false
  },
  {
    id: "hermes_llm",
    label: "Hermes / LLM",
    authority: "none",
    authorityLabel: "권위 없음",
    scope: "candidate_only",
    scopeLabel: "후보 전용",
    legalDutyRole: "no_authority",
    legalDutyLabel: "판정 권한 없음",
    provenanceRule: "근거를 재작성한 후보만 만들며 DB 수정과 ontology publish를 수행하지 않음",
    publishAllowed: false
  }
] as const;

export const KNOWLEDGE_MUTATION_POLICY = {
  llmDbMutationAllowed: false,
  llmPublishAllowed: false,
  humanReviewRequired: true
} as const;

const externalContext = {
  authorityId: "external_context",
  authority: "context_evidence",
  scope: "event_context",
  legalDutyRole: "no_authority"
} as const;

type ProvenanceClassification = Pick<
  KnowledgeEventProvenance,
  "authorityId" | "authority" | "scope" | "legalDutyRole"
>;

const genericAccident: ProvenanceClassification = {
  authorityId: "external_context",
  authority: "incident_control_evidence",
  scope: "public_reference",
  legalDutyRole: "non_statutory_reference"
};

const sifEvidence: ProvenanceClassification = {
  authorityId: "sif",
  authority: "incident_control_evidence",
  scope: "public_reference",
  legalDutyRole: "non_statutory_reference"
};

const unscopedOperationMemory: ProvenanceClassification = {
  authorityId: "external_context",
  authority: "operation_memory",
  scope: "event_context",
  legalDutyRole: "operational_evidence_only"
};

const eventSourceAuthority: Record<Exclude<
  KnowledgeRawEvent["source"],
  "kosha-accident" | "manual"
>, ProvenanceClassification> = {
  lawgo: {
    authorityId: "law",
    authority: "statutory_source",
    scope: "public_reference",
    legalDutyRole: "statutory_source"
  },
  kosha: {
    authorityId: "kosha",
    authority: "technical_guidance",
    scope: "public_reference",
    legalDutyRole: "non_statutory_reference"
  },
  "kosha-openapi": {
    authorityId: "kosha",
    authority: "technical_guidance",
    scope: "public_reference",
    legalDutyRole: "non_statutory_reference"
  },
  kma: externalContext,
  work24: externalContext
};

function readPayloadString(event: KnowledgeRawEvent, keys: string[]): string {
  for (const key of keys) {
    const value = event.payload[key];
    if (typeof value === "string" && value.trim()) return value.trim().toLowerCase();
  }
  return "";
}

function classifyEventAuthority(event: KnowledgeRawEvent): ProvenanceClassification {
  if (event.source === "kosha-accident") {
    const itemType = readPayloadString(event, ["item_type", "itemType"]);
    return itemType === "sif-case" ? sifEvidence : genericAccident;
  }

  if (event.source === "manual") {
    const provenanceScope = readPayloadString(event, ["provenanceScope", "provenance_scope"]);
    if (provenanceScope === "organization") {
      return {
        authorityId: "organization_history",
        authority: "operation_memory",
        scope: "organization_private",
        legalDutyRole: "operational_evidence_only"
      };
    }
    if (provenanceScope === "site") {
      return {
        authorityId: "site_history",
        authority: "operation_memory",
        scope: "site_private",
        legalDutyRole: "operational_evidence_only"
      };
    }
    return unscopedOperationMemory;
  }

  return eventSourceAuthority[event.source];
}

const REVIEW_METADATA_KEYS = [
  "article",
  "articleNo",
  "article_number",
  "effectiveDate",
  "guideCode",
  "guide_code",
  "itemType",
  "item_type",
  "provenanceScope",
  "provenance_scope"
] as const;
const MAX_REVIEW_METADATA_KEYS = 8;
const MAX_REVIEW_METADATA_LENGTH = 96;

function canonicalJson(value: unknown): string {
  if (value === null) return "null";
  if (Array.isArray(value)) {
    return `[${value.map(canonicalJson).join(",")}]`;
  }

  if (typeof value === "string") return JSON.stringify(value);
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "number") return Number.isFinite(value) ? String(value) : "null";
  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    const entries = Object.keys(record)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalJson(record[key])}`);
    return `{${entries.join(",")}}`;
  }

  return JSON.stringify(String(value));
}

function sha256(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function readBoundedMetadataValue(value: unknown): {
  value: KnowledgeReviewMetadataValue;
  truncated: boolean;
} | null {
  if (value === null || typeof value === "number" || typeof value === "boolean") {
    return { value, truncated: false };
  }
  if (typeof value !== "string") return null;

  const normalized = value.replace(/\s+/g, " ").trim();
  if (normalized.length <= MAX_REVIEW_METADATA_LENGTH) {
    return { value: normalized, truncated: false };
  }
  return {
    value: normalized.slice(0, MAX_REVIEW_METADATA_LENGTH),
    truncated: true
  };
}

function buildPayloadEvidence(payload: Record<string, unknown>): KnowledgePayloadEvidence {
  const canonicalPayload = canonicalJson(payload);
  const reviewMetadata: Record<string, KnowledgeReviewMetadataValue> = {};
  let metadataTruncated = false;

  for (const key of REVIEW_METADATA_KEYS) {
    if (!(key in payload)) continue;
    if (Object.keys(reviewMetadata).length >= MAX_REVIEW_METADATA_KEYS) {
      metadataTruncated = true;
      continue;
    }

    const bounded = readBoundedMetadataValue(payload[key]);
    if (!bounded) continue;
    reviewMetadata[key] = bounded.value;
    metadataTruncated ||= bounded.truncated;
  }

  const topLevelKeyCount = Object.keys(payload).length;
  return {
    digestAlgorithm: "sha256",
    digest: sha256(canonicalPayload),
    byteLength: new TextEncoder().encode(canonicalPayload).byteLength,
    topLevelKeyCount,
    omittedTopLevelKeyCount: Math.max(topLevelKeyCount - Object.keys(reviewMetadata).length, 0),
    reviewMetadata,
    metadataTruncated
  };
}

export function classifyKnowledgeEvent(
  event: KnowledgeRawEvent,
  tenantContext: KnowledgeTenantContext
): KnowledgeEventProvenance {
  const payloadEvidence = buildPayloadEvidence(event.payload);
  const referenceDigest = sha256(canonicalJson({
    source: event.source,
    sourceId: event.sourceId,
    capturedAt: event.capturedAt,
    title: event.title,
    url: event.url || null,
    payloadDigest: payloadEvidence.digest,
    relatedHazardIds: event.relatedHazardIds,
    reflectedDocuments: event.reflectedDocuments,
    tenantContext
  }));

  return {
    source: event.source,
    eventReference: {
      sourceId: event.sourceId,
      capturedAt: event.capturedAt,
      digestAlgorithm: "sha256",
      digest: referenceDigest
    },
    tenantContext: { ...tenantContext },
    payloadEvidence,
    ...classifyEventAuthority(event)
  };
}

export function buildKnowledgeCandidate(input: {
  question: string;
  rawEvents: KnowledgeRawEvent[];
  matchedHazardIds: string[];
  generatedText: string;
  providerLabel: string | null;
  tenantContext: KnowledgeTenantContext;
}): KnowledgeCandidate {
  if (input.rawEvents.length === 0) {
    throw new Error("At least one raw event is required to build a knowledge candidate");
  }

  return {
    contractVersion: "knowledge-candidate.v2",
    stage: "candidate",
    reviewStatus: "pending_review",
    publicationState: "unpublished",
    generatedBy: input.providerLabel ? "hermes_or_llm" : "safeclaw_candidate_builder",
    providerLabel: input.providerLabel,
    authority: "none",
    nextStage: "human_review",
    dbMutationAllowed: false,
    dbMutationPerformed: false,
    publishAllowed: false,
    question: input.question,
    generatedText: input.generatedText,
    matchedHazardIds: [...new Set(input.matchedHazardIds)],
    tenantContext: { ...input.tenantContext },
    provenance: input.rawEvents.map((event) => classifyKnowledgeEvent(event, input.tenantContext))
  };
}

export function buildKnowledgeCandidateReviewContract(
  candidate: KnowledgeCandidate
): KnowledgeCandidateReviewContract {
  const authorityCounts = new Map<KnowledgeReviewAuthorityId, number>(
    KNOWLEDGE_REVIEW_AUTHORITY_ORDER.map((authorityId) => [authorityId, 0])
  );

  for (const provenance of candidate.provenance) {
    const authorityId = provenance.authorityId;
    if (authorityId === "hermes_llm") continue;
    authorityCounts.set(authorityId, (authorityCounts.get(authorityId) ?? 0) + 1);
  }

  return {
    contractVersion: "knowledge-candidate-review.v1",
    status: "human_review_required",
    authorityOrder: KNOWLEDGE_REVIEW_AUTHORITY_ORDER,
    presentAuthorityIds: KNOWLEDGE_REVIEW_AUTHORITY_ORDER.filter(
      (authorityId) => (authorityCounts.get(authorityId) ?? 0) > 0
    ),
    sourceRoleCounts: {
      sifIncidentControlEvidence: authorityCounts.get("sif") ?? 0,
      koshaTechnicalGuidance: authorityCounts.get("kosha") ?? 0,
      lawStatutorySource: authorityCounts.get("law") ?? 0,
      organizationPrivateMemory: authorityCounts.get("organization_history") ?? 0,
      sitePrivateMemory: authorityCounts.get("site_history") ?? 0,
      externalContext: authorityCounts.get("external_context") ?? 0
    },
    sifControlsAreNonStatutoryEvidence: true,
    koshaGuidanceIsNonStatutory: true,
    statutoryClaimsRequireLawProvenance: true,
    tenantMemoryPublicPromotionAllowed: false,
    siteManagerAcceptanceRequiredBeforeWorkpackUse: true,
    publicationState: "unpublished",
    humanReviewRequired: true,
    machineEvidenceReplacesHumanReview: false,
    dbMutationAllowed: false,
    publishAllowed: false
  };
}
