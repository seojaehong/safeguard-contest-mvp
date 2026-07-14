import { describe, expect, it } from "vitest";
import type { KnowledgeRawEvent } from "@/lib/safety-knowledge";
import {
  KNOWLEDGE_AUTHORITY_LANES,
  KNOWLEDGE_PROMOTION_STAGES,
  buildKnowledgeCandidate,
  classifyKnowledgeEvent
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

describe("knowledge governance contract", () => {
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
    expect(classifyKnowledgeEvent(lawEvent)).toMatchObject({
      authorityId: "law",
      authority: "statutory_source",
      scope: "public_reference"
    });

    const candidate = buildKnowledgeCandidate({
      question: "추락 위험 통제대책을 검토해줘",
      rawEvents: [lawEvent],
      matchedHazardIds: ["hazard-fall"],
      generatedText: "검토용 초안",
      providerLabel: "Hermes"
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
      sourceId: "law-42",
      authorityId: "law",
      scope: "public_reference"
    });
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

    expect(classifyKnowledgeEvent(genericAccident)).toMatchObject({
      authorityId: "external_context",
      authority: "incident_control_evidence",
      scope: "public_reference"
    });
    expect(classifyKnowledgeEvent(explicitSif)).toMatchObject({
      authorityId: "sif",
      authority: "incident_control_evidence",
      scope: "public_reference"
    });
    expect(classifyKnowledgeEvent(unscopedManual)).toMatchObject({
      authorityId: "external_context",
      authority: "operation_memory",
      scope: "event_context"
    });
    expect(classifyKnowledgeEvent(organizationMemory)).toMatchObject({
      authorityId: "organization_history",
      authority: "operation_memory",
      scope: "organization_private"
    });
  });
});
