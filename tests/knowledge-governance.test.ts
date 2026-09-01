import { describe, expect, it } from "vitest";
import type { KnowledgeRawEvent } from "@/lib/safety-knowledge";
import {
  KNOWLEDGE_AUTHORITY_LANES,
  KNOWLEDGE_PROMOTION_STAGES,
  buildKnowledgeCandidate,
  buildKnowledgeCandidateReviewContract,
  classifyKnowledgeEvent,
  evaluateKnowledgeCandidateContentReadiness,
  readKnowledgeSifReviewTitles
} from "@/lib/knowledge-governance";

const lawEvent: KnowledgeRawEvent = {
  source: "lawgo",
  sourceId: "law-42",
  capturedAt: "2026-07-14T10:00:00.000Z",
  title: "산업안전보건법 현행 조문",
  url: "https://www.law.go.kr/",
  payload: { article: "42" },
  relatedHazardIds: ["hazard-fall"],
  reflectedDocuments: ["위험성평가표"]
};

const tenantContext = {
  organizationId: "org-knowledge-1",
  siteId: "site-knowledge-1"
};

describe("knowledge governance contract", () => {
  it("keeps only bounded public SIF titles for reviewer-visible evidence", () => {
    const baseSif: KnowledgeRawEvent = {
      ...lawEvent,
      source: "kosha-accident",
      sourceId: "sif-safe",
      title: "SIF 비계 추락 사고 통제 사례",
      payload: { item_type: "sif-case" }
    };

    expect(readKnowledgeSifReviewTitles([
      baseSif,
      { ...baseSif, sourceId: "sif-private", title: "SIF 사고 worker@example.com" },
      { ...baseSif, sourceId: "generic", title: "일반 사고", payload: { item_type: "accident" } },
      { ...baseSif, sourceId: "duplicate" }
    ])).toEqual(["SIF 비계 추락 사고 통제 사례"]);
  });

  it("keeps the promotion path explicit and blocks machine publication", () => {
    expect(KNOWLEDGE_PROMOTION_STAGES.map((stage) => stage.id)).toEqual([
      "knowledge_event",
      "candidate",
      "human_review",
      "published_ontology"
    ]);

    const candidate = KNOWLEDGE_PROMOTION_STAGES.find((stage) => stage.id === "candidate");
    const review = KNOWLEDGE_PROMOTION_STAGES.find((stage) => stage.id === "human_review");

    expect(candidate).toMatchObject({
      owner: "hermes_or_llm",
      publicationState: "unpublished",
      dbMutationAllowed: false,
      publishAllowed: false,
      nextStage: "human_review"
    });
    expect(review).toMatchObject({
      owner: "human_reviewer",
      reviewRequired: true,
      publishAllowed: false,
      nextStage: "published_ontology"
    });
  });

  it("does not confuse SIF, KOSHA, law, tenant history, or LLM authority", () => {
    const lanes = Object.fromEntries(
      KNOWLEDGE_AUTHORITY_LANES.map((lane) => [lane.id, lane])
    );

    expect(lanes.sif).toMatchObject({
      authority: "incident_control_evidence",
      scope: "public_reference",
      legalDutyRole: "non_statutory_reference"
    });
    expect(lanes.kosha).toMatchObject({
      authority: "technical_guidance",
      scope: "public_reference",
      legalDutyRole: "non_statutory_reference"
    });
    expect(lanes.law).toMatchObject({
      authority: "statutory_source",
      scope: "public_reference",
      legalDutyRole: "statutory_source"
    });
    expect(lanes.organization_history).toMatchObject({
      authority: "operation_memory",
      scope: "organization_private",
      legalDutyRole: "operational_evidence_only"
    });
    expect(lanes.site_history).toMatchObject({
      authority: "operation_memory",
      scope: "site_private",
      legalDutyRole: "operational_evidence_only"
    });
    expect(lanes.hermes_llm).toMatchObject({
      authority: "none",
      scope: "candidate_only",
      legalDutyRole: "no_authority",
      publishAllowed: false
    });
  });

  it("classifies existing raw-event DTOs without elevating a candidate's authority", () => {
    expect(classifyKnowledgeEvent(lawEvent, tenantContext)).toMatchObject({
      authorityId: "law",
      authority: "statutory_source",
      scope: "public_reference",
      tenantContext
    });

    const candidate = buildKnowledgeCandidate({
      question: "추락 위험 통제대책을 검토해줘",
      rawEvents: [lawEvent],
      matchedHazardIds: ["hazard-fall"],
      generatedText: "검토용 초안",
      providerLabel: "Hermes",
      tenantContext
    });

    expect(candidate).toMatchObject({
      stage: "candidate",
      reviewStatus: "pending_review",
      publicationState: "unpublished",
      generatedBy: "hermes_or_llm",
      authority: "none",
      nextStage: "human_review",
      dbMutationAllowed: false,
      dbMutationPerformed: false,
      publishAllowed: false
    });
    expect(candidate.provenance).toHaveLength(1);
    expect(candidate.provenance[0]).toMatchObject({
      eventReference: {
        sourceId: "law-42",
        digestAlgorithm: "sha256"
      },
      authorityId: "law",
      scope: "public_reference",
      tenantContext
    });
  });

  it("refuses to build a candidate without raw event provenance", () => {
    expect(() => buildKnowledgeCandidate({
      question: "추락 위험 통제대책을 검토해줘",
      rawEvents: [],
      matchedHazardIds: ["hazard-fall"],
      generatedText: "검토용 초안",
      providerLabel: "Hermes",
      tenantContext
    })).toThrow("At least one raw event is required to build a knowledge candidate");
  });

  it("uses a deterministic event snapshot digest that changes with raw content", () => {
    const first = classifyKnowledgeEvent(lawEvent, tenantContext);
    const repeated = classifyKnowledgeEvent({ ...lawEvent }, tenantContext);
    const changed = classifyKnowledgeEvent({
      ...lawEvent,
      payload: { article: "43" }
    }, tenantContext);

    expect(repeated.eventReference.digest).toBe(first.eventReference.digest);
    expect(changed.eventReference.digest).not.toBe(first.eventReference.digest);
    expect(changed.payloadEvidence.digest).not.toBe(first.payloadEvidence.digest);
  });

  it("requires explicit provenance metadata before calling an event SIF or tenant memory", () => {
    const genericAccident: KnowledgeRawEvent = {
      ...lawEvent,
      source: "kosha-accident",
      sourceId: "accident-1",
      title: "공개 재해사례",
      payload: {}
    };
    const explicitSif: KnowledgeRawEvent = {
      ...genericAccident,
      sourceId: "sif-1",
      payload: { item_type: "sif-case" }
    };
    const unscopedManual: KnowledgeRawEvent = {
      ...lawEvent,
      source: "manual",
      sourceId: "manual-1",
      title: "현장 메모",
      payload: {}
    };
    const organizationMemory: KnowledgeRawEvent = {
      ...unscopedManual,
      sourceId: "organization-1",
      payload: { provenanceScope: "organization" }
    };

    expect(classifyKnowledgeEvent(genericAccident, tenantContext)).toMatchObject({
      authorityId: "external_context",
      authority: "incident_control_evidence",
      scope: "public_reference"
    });
    expect(classifyKnowledgeEvent(explicitSif, tenantContext)).toMatchObject({
      authorityId: "sif",
      authority: "incident_control_evidence",
      scope: "public_reference"
    });
    expect(classifyKnowledgeEvent(unscopedManual, tenantContext)).toMatchObject({
      authorityId: "external_context",
      authority: "operation_memory",
      scope: "event_context"
    });
    expect(classifyKnowledgeEvent(organizationMemory, tenantContext)).toMatchObject({
      authorityId: "organization_history",
      authority: "operation_memory",
      scope: "organization_private"
    });
  });

  it("builds an ordered reviewer contract without elevating evidence or tenant memory", () => {
    const events: KnowledgeRawEvent[] = [
      {
        ...lawEvent,
        source: "kosha-accident",
        sourceId: "sif-1",
        payload: { item_type: "sif-case" }
      },
      {
        ...lawEvent,
        source: "kosha",
        sourceId: "kosha-1",
        payload: { guideCode: "C-12" }
      },
      lawEvent,
      {
        ...lawEvent,
        source: "manual",
        sourceId: "organization-1",
        payload: { provenanceScope: "organization" }
      },
      {
        ...lawEvent,
        source: "manual",
        sourceId: "site-1",
        payload: { provenanceScope: "site" }
      }
    ];
    const candidate = buildKnowledgeCandidate({
      question: "추락 위험 통제대책을 검토해줘",
      rawEvents: events,
      matchedHazardIds: ["hazard-fall"],
      generatedText: "검토용 초안",
      providerLabel: "Hermes",
      tenantContext
    });

    expect(buildKnowledgeCandidateReviewContract(candidate)).toEqual({
      contractVersion: "knowledge-candidate-review.v1",
      status: "human_review_required",
      authorityOrder: [
        "sif",
        "kosha",
        "law",
        "organization_history",
        "site_history",
        "external_context"
      ],
      presentAuthorityIds: [
        "sif",
        "kosha",
        "law",
        "organization_history",
        "site_history"
      ],
      sourceRoleCounts: {
        sifIncidentControlEvidence: 1,
        koshaTechnicalGuidance: 1,
        lawStatutorySource: 1,
        organizationPrivateMemory: 1,
        sitePrivateMemory: 1,
        externalContext: 0
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
    });
  });

  it("requires all four non-empty Wiki review sections before human approval", () => {
    const candidate = buildKnowledgeCandidate({
      question: "추락 위험 통제대책을 검토해줘",
      rawEvents: [lawEvent],
      matchedHazardIds: ["hazard-fall"],
      generatedText: [
        "1) 위험요인 요약: 작업발판 단부 추락 위험",
        "2) 문서 반영 위치: 위험성평가표와 TBM 브리핑",
        "3) 통제대책: 안전난간 설치 상태를 작업 전 확인",
        "4) 검수 필요 항목: 현장 책임자가 실제 설치 상태 확인"
      ].join("\n"),
      providerLabel: "Hermes",
      tenantContext
    });

    expect(evaluateKnowledgeCandidateContentReadiness(candidate)).toMatchObject({
      status: "ready_for_human_review",
      requiredSectionCount: 4,
      presentSectionCount: 4,
      nonEmptySectionCount: 4,
      placeholderFindingCount: 0,
      legalOverclaimFindingCount: 0,
      lawProvenancePresent: true,
      hazardGroundingPresent: true,
      unresolvedReviewItems: [],
      humanReviewCompleted: false,
      publicationState: "unpublished",
      publishAllowed: false
    });
  });

  it("fails Wiki review readiness for missing, empty, and placeholder sections", () => {
    const candidate = buildKnowledgeCandidate({
      question: "추락 위험 통제대책을 검토해줘",
      rawEvents: [lawEvent],
      matchedHazardIds: ["hazard-fall"],
      generatedText: [
        "## 위험요인 요약",
        "추락 위험",
        "## 문서 반영 위치",
        "작성 필요",
        "## 통제대책",
        ""
      ].join("\n"),
      providerLabel: "Hermes",
      tenantContext
    });

    expect(evaluateKnowledgeCandidateContentReadiness(candidate)).toMatchObject({
      status: "revision_required",
      presentSectionCount: 3,
      nonEmptySectionCount: 2,
      placeholderFindingCount: 1
    });
    expect(evaluateKnowledgeCandidateContentReadiness(candidate).unresolvedReviewItems).toEqual(expect.arrayContaining([
      "empty_section:controls",
      "missing_section:review_items",
      "placeholder_content"
    ]));
  });

  it("fails Wiki review readiness for legal overclaim or statutory claims without law provenance", () => {
    const manualEvent: KnowledgeRawEvent = {
      ...lawEvent,
      source: "manual",
      sourceId: "site-note",
      payload: { provenanceScope: "site" }
    };
    const candidate = buildKnowledgeCandidate({
      question: "현장 지식 후보를 검토해줘",
      rawEvents: [manualEvent],
      matchedHazardIds: ["hazard-fall"],
      generatedText: [
        "1) 위험요인 요약: 추락 위험",
        "2) 문서 반영 위치: 위험성평가표",
        "3) 통제대책: 이 문서는 법적 의무를 대체하며 산업안전보건법에 따라 자동 준수된다.",
        "4) 검수 필요 항목: 현장 상태 확인"
      ].join("\n"),
      providerLabel: "Hermes",
      tenantContext
    });
    const readiness = evaluateKnowledgeCandidateContentReadiness(candidate);

    expect(readiness).toMatchObject({
      status: "revision_required",
      legalOverclaimFindingCount: 2,
      statutoryClaimDetected: true,
      lawProvenancePresent: false
    });
    expect(readiness.unresolvedReviewItems).toContain("statutory_claim_without_law_provenance");
  });

  it("fails Wiki review readiness when linked SIF provenance is not visible", () => {
    const sifEvent: KnowledgeRawEvent = {
      ...lawEvent,
      source: "kosha-accident",
      sourceId: "sif-fall",
      title: "SIF 추락 사고 통제 사례",
      payload: { item_type: "sif-case" }
    };
    const candidate = buildKnowledgeCandidate({
      question: "추락 위험 통제대책을 검토해줘",
      rawEvents: [lawEvent, sifEvent],
      matchedHazardIds: ["hazard-fall"],
      generatedText: [
        "1) 위험요인 요약: 작업발판 단부 추락 위험",
        "2) 문서 반영 위치: 위험성평가표와 TBM 브리핑",
        "3) 통제대책: 안전난간 설치 상태를 작업 전 확인",
        "4) 검수 필요 항목: KOSHA 기술자료와 현행 법령 후보를 확인"
      ].join("\n"),
      providerLabel: "Hermes",
      tenantContext
    });

    expect(evaluateKnowledgeCandidateContentReadiness(candidate)).toMatchObject({
      status: "revision_required",
      sifProvenancePresent: true,
      sifEvidenceVisible: false,
      unresolvedReviewItems: ["sif_provenance_not_visible"]
    });
  });

  it("fails closed when a multi-hazard candidate body omits one canonical hazard", () => {
    const candidate = buildKnowledgeCandidate({
      question: "추락과 지게차 충돌 위험 통제대책을 검토해줘",
      rawEvents: [lawEvent],
      matchedHazardIds: ["fall-scaffold", "forklift-traffic"],
      generatedText: [
        "1) 위험요인 요약: 작업발판 단부 추락 위험",
        "2) 문서 반영 위치: 위험성평가표와 TBM 브리핑",
        "3) 통제대책: 안전난간과 작업구역 분리 상태 확인",
        "4) 검수 필요 항목: 현장 책임자가 적용 상태 확인"
      ].join("\n"),
      providerLabel: "Hermes",
      tenantContext
    });

    expect(evaluateKnowledgeCandidateContentReadiness(candidate)).toMatchObject({
      status: "revision_required",
      hazardGroundingPresent: true,
      matchedHazardCount: 2,
      bodyGroundedHazardCount: 1,
      bodyHazardCoverageComplete: false,
      missingBodyHazardIds: ["forklift-traffic"],
      unresolvedReviewItems: ["candidate_body_hazard_coverage_incomplete"]
    });
  });

  it("accepts body grounding only when every matched canonical hazard is visible", () => {
    const candidate = buildKnowledgeCandidate({
      question: "추락과 지게차 충돌 위험 통제대책을 검토해줘",
      rawEvents: [lawEvent],
      matchedHazardIds: ["fall-scaffold", "forklift-traffic"],
      generatedText: [
        "1) 위험요인 요약: 작업발판 단부 추락과 지게차·보행자 충돌 위험",
        "2) 문서 반영 위치: 위험성평가표와 TBM 브리핑",
        "3) 통제대책: 안전난간과 지게차 운행구역 분리 상태 확인",
        "4) 검수 필요 항목: 현장 책임자가 적용 상태 확인"
      ].join("\n"),
      providerLabel: "Hermes",
      tenantContext
    });

    expect(evaluateKnowledgeCandidateContentReadiness(candidate)).toMatchObject({
      status: "ready_for_human_review",
      matchedHazardCount: 2,
      bodyGroundedHazardCount: 2,
      bodyHazardCoverageComplete: true,
      missingBodyHazardIds: [],
      unresolvedReviewItems: []
    });
  });

  it("does not treat matched hazard metadata as textual hazard grounding", () => {
    const candidate = buildKnowledgeCandidate({
      question: "현장 지식 후보를 검토해줘",
      rawEvents: [lawEvent],
      matchedHazardIds: ["chemical-msds"],
      generatedText: [
        "1) 위험요인 요약: 작업 조건을 확인합니다.",
        "2) 문서 반영 위치: 위험성평가표",
        "3) 통제대책: 현장 조건에 맞는 조치를 확인합니다.",
        "4) 검수 필요 항목: 현장 책임자 확인"
      ].join("\n"),
      providerLabel: "Hermes",
      tenantContext
    });

    expect(evaluateKnowledgeCandidateContentReadiness(candidate)).toMatchObject({
      status: "revision_required",
      hazardGroundingPresent: false,
      unresolvedReviewItems: ["hazard_grounding_missing"]
    });
  });
});
