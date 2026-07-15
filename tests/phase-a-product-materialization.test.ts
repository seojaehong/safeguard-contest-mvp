import { describe, expect, test } from "vitest";

import {
  attachGenerationEvidence,
  verifyAskResponseGenerationEvidence,
} from "@/lib/generation-evidence";
import { buildMockAskResponse, mockSearchResults } from "@/lib/mock-data";
import { buildDocpackResult } from "@/lib/mcp-tools";
import type {
  ActiveEvidenceChainPack,
  ObligationClassification,
} from "@/lib/ontology/evidence-chain";
import { assembleGraph } from "@/lib/ontology/graph-store";
import { buildPublishedSafetyKnowledge } from "@/lib/ontology/knowledge-tool";
import {
  buildPhaseAProductMaterialization,
  materializePhaseAProductIntoResponse,
} from "@/lib/ontology/product-materialization";
import { SEED_EDGES, SEED_NODES } from "@/lib/ontology/seed/core-triples";
import type { RiskAssessmentRow } from "@/lib/risk-assessment-schema";
import type { AskResponse } from "@/lib/types";
import {
  buildReopenData,
  buildWorkpackEvidenceSummary,
} from "@/lib/workpack-store";

const publishedGraph = assembleGraph(
  SEED_NODES.filter((node) => node.review_state === "published"),
  SEED_EDGES.filter((edge) => edge.review_state === "published"),
);

const cases = [
  {
    input: "고소작업",
    chainId: "work-at-height-fall",
    taskNodeId: "Task_work_at_height",
    hazardNodeId: "Hazard_추락",
    sifCount: 2,
    controlCount: 3,
  },
  {
    input: "지게차 상하차",
    chainId: "vehicle-machinery-entrapment",
    taskNodeId: "Task_forklift_loading",
    hazardNodeId: "Hazard_충돌_협착_끼임",
    sifCount: 2,
    controlCount: 1,
  },
  {
    input: "전기 작업",
    chainId: "electrical-work-electrocution",
    taskNodeId: "Task_electrical_work",
    hazardNodeId: "Hazard_감전_직접_간접_접촉",
    sifCount: 3,
    controlCount: 5,
  },
] as const;

function buildSyntheticRelabeledPack(input = "고소작업"): ActiveEvidenceChainPack {
  const knowledge = buildPublishedSafetyKnowledge(publishedGraph, input);
  if (!knowledge.found || !knowledge.evidenceContract) {
    throw new Error("expected Phase A evidence contract");
  }
  const pack = structuredClone(knowledge.evidenceContract);
  for (const source of [...pack.hazardPriority, ...pack.guidance, ...pack.law]) {
    source.reviewState = "published";
    source.resolution = "resolved";
  }
  for (const control of pack.controls) {
    for (const source of [...control.guidanceEvidence, ...control.lawEvidence]) {
      source.reviewState = "published";
      source.resolution = "resolved";
    }
    control.guidanceStatus = control.guidanceEvidence.length > 0 ? "verified" : "missing";
    control.guidanceReviewRequired = false;
    const classification: ObligationClassification = control.guidanceEvidence.length > 0
      ? "statutory_mandate_with_guidance"
      : "statutory_mandate";
    control.obligation.classification = classification;
    const plan = pack.materialization.find((item) => item.controlId === control.controlId);
    if (!plan) throw new Error(`expected materialization plan for ${control.controlId}`);
    plan.obligation.classification = classification;
    plan.guidanceStatus = control.guidanceStatus;
    plan.guidanceReviewRequired = false;
  }
  return pack;
}

function expectNoPhaseAScore(response: AskResponse): void {
  expect(response.structured?.riskAssessmentRows ?? []).toEqual([]);
  expect(response.structured?.tbmRiskLinks ?? []).toEqual([]);
  const serialized = JSON.stringify(response.structured) ?? "";
  expect(serialized).not.toContain('"riskLevel":"high"');
  expect(serialized).not.toContain('"likelihood":3');
  expect(serialized).not.toContain('"severity":4');
}

describe("Phase A product materialization", () => {
  test("never promotes a synthetic fully relabeled evidence pack above review-required", () => {
    const pack = buildSyntheticRelabeledPack();
    const product = buildPhaseAProductMaterialization({ evidencePack: pack });

    expect(product).toMatchObject({
      chainId: null,
      reportedEvidenceChainState: "review_required",
      evidenceChainState: "review_required",
      authorityState: "review_required",
      outputStatus: "review_required_draft",
      verifiedDocumentRows: [],
      humanConfirmation: { required: true, status: "pending" },
    });
    expect(product?.controls).toEqual([]);
    expect(product?.documentRows).toEqual([]);
    expect(product?.provenance).toEqual({
      taskNodeIds: [],
      sifAccidentCitedUids: [],
      hazardNodeIds: [],
      controlNodeIds: [],
      koshaGuidanceCitedUids: [],
      lawCitedUids: [],
      articleNodeIds: [],
    });
  });

  test("does not persist caller-controlled provenance or document prose", () => {
    const pack = buildSyntheticRelabeledPack();
    pack.task.nodeId = "CALLER_TASK_NODE_SENTINEL";
    pack.task.label = "CALLER_TASK_LABEL_SENTINEL";
    pack.hazard.nodeId = "CALLER_HAZARD_NODE_SENTINEL";
    pack.hazard.label = "CALLER_HAZARD_LABEL_SENTINEL";
    const source = pack.hazardPriority[0];
    const control = pack.controls[0];
    const plan = pack.materialization[0];
    if (!source || !control || !plan) throw new Error("expected mutable Phase A fixture");
    source.citedUid = "CALLER_SIF_UID_SENTINEL";
    control.controlId = "CALLER_CONTROL_ID_SENTINEL";
    control.graphControlNodeId = "CALLER_CONTROL_NODE_SENTINEL";
    control.label = "CALLER_CONTROL_LABEL_SENTINEL";
    control.applicabilityCondition = "CALLER_APPLICABILITY_SENTINEL";
    control.obligation.classification = "technical_guidance_only";
    plan.controlId = control.controlId;
    plan.controlLabel = control.label;
    plan.obligation.classification = "technical_guidance_only";
    plan.targets[0].stableKey = "CALLER_STABLE_KEY_SENTINEL";

    const response = materializePhaseAProductIntoResponse(
      buildMockAskResponse("고소작업", mockSearchResults.slice(0, 3), "mock", "caller provenance test"),
      pack,
    );
    const serialized = JSON.stringify({
      phaseAProduct: response.phaseAProduct,
      riskAssessmentDraft: response.deliverables.riskAssessmentDraft,
      tbmBriefing: response.deliverables.tbmBriefing,
    });

    expect(response.phaseAProduct).toMatchObject({
      chainId: null,
      authorityState: "review_required",
      evidenceChainState: "review_required",
      task: null,
      accidents: [],
      hazard: null,
      controls: [],
      provenance: {
        taskNodeIds: [],
        sifAccidentCitedUids: [],
        hazardNodeIds: [],
        controlNodeIds: [],
        koshaGuidanceCitedUids: [],
        lawCitedUids: [],
        articleNodeIds: [],
      },
      humanConfirmation: {
        required: true,
        status: "pending",
        message: expect.stringContaining("사람 확인"),
      },
      reviewMessage: expect.stringContaining("사람 확인"),
    });
    expect(serialized).not.toContain("CALLER_");
    expect(serialized).not.toContain("technical_guidance_only");
    expect(response.phaseAProduct?.documentRows).toEqual([]);
  });

  test.each(cases)(
    "returns empty review-required provenance for loader chain $chainId",
    ({ input }) => {
      const knowledge = buildPublishedSafetyKnowledge(publishedGraph, input);
      if (!knowledge.found || !knowledge.phaseAProduct || !knowledge.evidenceContract) {
        throw new Error(`expected Phase A product evidence for ${input}`);
      }

      const original = buildMockAskResponse(
        input,
        mockSearchResults.slice(0, 3),
        "mock",
        "Phase A review artifact test",
      );
      const response = materializePhaseAProductIntoResponse(
        original,
        knowledge.evidenceContract,
      );
      const product = response.phaseAProduct;
      expect(product).toMatchObject({
        chainId: null,
        authorityState: "review_required",
        evidenceChainState: "review_required",
        task: null,
        hazard: null,
        accidents: [],
        controls: [],
        documentRows: [],
        verifiedDocumentRows: [],
        coverage: {
          expectedDocumentRows: 0,
          materializedDocumentRows: 0,
          verifiedDocumentRows: 0,
        },
      });
      expect(product?.provenance).toEqual({
        taskNodeIds: [],
        sifAccidentCitedUids: [],
        hazardNodeIds: [],
        controlNodeIds: [],
        koshaGuidanceCitedUids: [],
        lawCitedUids: [],
        articleNodeIds: [],
      });
      expect(response.deliverables).toEqual(original.deliverables);
      expectNoPhaseAScore(response);

      const docpack = buildDocpackResult(response, true);
      expect(docpack.phaseAProduct?.provenance).toEqual(product?.provenance);
    },
  );

  test.each([
    {
      label: "source review state",
      mutate(pack: ActiveEvidenceChainPack): void {
        const source = pack.hazardPriority[0];
        if (!source) throw new Error("expected SIF source");
        source.reviewState = "draft";
        source.resolution = "unresolved";
      },
    },
    {
      label: "source UID",
      mutate(pack: ActiveEvidenceChainPack): void {
        const source = pack.hazardPriority[0];
        if (!source) throw new Error("expected SIF source");
        source.citedUid = "ref:safety_reference_items:forged-sif-source";
      },
    },
    {
      label: "control provenance",
      mutate(pack: ActiveEvidenceChainPack): void {
        const control = pack.controls[0];
        if (!control) throw new Error("expected control");
        control.graphControlNodeId = "Control_forged";
      },
    },
  ])("never scores a synthetic or mutated pack: $label", ({ mutate }) => {
    const pack = buildSyntheticRelabeledPack();
    mutate(pack);

    const response = materializePhaseAProductIntoResponse(
      buildMockAskResponse("고소작업", mockSearchResults.slice(0, 3), "mock", "Phase A mutation test"),
      pack,
    );

    expectNoPhaseAScore(response);
    expect(response.phaseAProduct).toMatchObject({
      authorityState: "review_required",
      evidenceChainState: "review_required",
      verifiedDocumentRows: [],
    });
  });

  test("preserves existing unrelated risk rows and TBM links byte-for-byte", () => {
    const pack = buildSyntheticRelabeledPack();
    const existingRow: RiskAssessmentRow = {
      location: "EXISTING_LOCATION",
      process: "EXISTING_PROCESS",
      task: "EXISTING_TASK",
      equipment: "EXISTING_EQUIPMENT",
      hazard: "NON_CANONICAL_EXISTING_HAZARD",
      fourM: "Media",
      accidentType: "fall",
      currentControls: "EXISTING_CURRENT_CONTROL",
      likelihood: 3,
      severity: 4,
      riskLevel: "high",
      additionalControls: "NON_CANONICAL_EXISTING_CONTROL",
      owner: "EXISTING_OWNER",
      due: "EXISTING_DUE",
      verification: "EXISTING_VERIFICATION",
      verificationStatus: "planned",
      verificationDate: "EXISTING_DATE",
      verificationChecker: "EXISTING_CHECKER",
      whyLikelihood: "EXISTING_LIKELIHOOD",
      whySeverity: "EXISTING_SEVERITY",
      evidenceRefs: ["NON_CANONICAL_REF"],
    };
    const original = buildMockAskResponse(
      "고소작업",
      mockSearchResults.slice(0, 3),
      "mock",
      "Phase A unrelated row preservation test",
    );
    const attacked: AskResponse = {
      ...original,
      structured: {
        riskAssessmentRows: [existingRow],
        riskAssessmentValidation: { ok: true, issueCount: 0, issues: [] },
        tbmRiskLinks: [{
          riskRowIndex: 0,
          hazard: existingRow.hazard,
          control: existingRow.additionalControls,
          weatherSignal: "EXISTING_WEATHER",
          confirmQuestion: "EXISTING_QUESTION",
          owner: existingRow.owner,
          verification: existingRow.verification,
          evidenceRefs: existingRow.evidenceRefs,
        }],
      },
    };

    const expectedRows = structuredClone(attacked.structured?.riskAssessmentRows);
    const expectedLinks = structuredClone(attacked.structured?.tbmRiskLinks);
    const expectedRowsJson = JSON.stringify(expectedRows);
    const expectedLinksJson = JSON.stringify(expectedLinks);

    const materialized = materializePhaseAProductIntoResponse(attacked, pack);

    expect(materialized.structured?.riskAssessmentRows).toEqual(expectedRows);
    expect(materialized.structured?.tbmRiskLinks).toEqual(expectedLinks);
    expect(JSON.stringify(materialized.structured?.riskAssessmentRows)).toBe(expectedRowsJson);
    expect(JSON.stringify(materialized.structured?.tbmRiskLinks)).toBe(expectedLinksJson);
  });

  test("materialization is idempotent by stable review row key", () => {
    const pack = buildSyntheticRelabeledPack("전기 작업");
    const original = buildMockAskResponse(
      "전기 작업",
      mockSearchResults.slice(0, 3),
      "mock",
      "Phase A idempotency test",
    );

    const once = materializePhaseAProductIntoResponse(original, pack);
    const twice = materializePhaseAProductIntoResponse(once, pack);

    expect(twice.deliverables.riskAssessmentDraft).toBe(once.deliverables.riskAssessmentDraft);
    expect(twice.deliverables.tbmBriefing).toBe(once.deliverables.tbmBriefing);
    expectNoPhaseAScore(twice);
  });

  test("reseals review-only materialization and survives evidence-summary reopen", () => {
    const secret = "phase-a-materialization-secret";
    const knowledge = buildPublishedSafetyKnowledge(publishedGraph, "지게차 상하차");
    if (!knowledge.found || !knowledge.phaseAProduct || !knowledge.evidenceContract) {
      throw new Error("expected entrapment Phase A product evidence");
    }
    const base = buildMockAskResponse(
      "지게차 상하차",
      mockSearchResults.slice(0, 3),
      "mock",
      "Phase A generation evidence test",
    );
    const sealed = attachGenerationEvidence({
      ...base,
      dbHarness: { packet: {} } as NonNullable<AskResponse["dbHarness"]>,
    }, {
      secret,
      generatedAt: "2026-07-14T12:00:00.000Z",
    });

    const materialized = materializePhaseAProductIntoResponse(
      sealed,
      knowledge.evidenceContract,
      { generationEvidenceSecret: secret },
    );
    const verification = verifyAskResponseGenerationEvidence(materialized, secret);
    expect(verification.ok).toBe(true);
    if (!verification.ok) throw new Error(verification.message);

    const reopened = buildReopenData({
      question: materialized.question,
      scenario: materialized.scenario,
      deliverables: materialized.deliverables,
      evidenceSummary: buildWorkpackEvidenceSummary(materialized, verification.snapshot),
      status: materialized.status,
    });

    expect(reopened.blockers).toEqual([]);
    expect(reopened.data?.phaseAProduct).toEqual(knowledge.phaseAProduct);
    expect(reopened.data && verifyAskResponseGenerationEvidence(reopened.data, secret).ok).toBe(true);
    if (reopened.data) expectNoPhaseAScore(reopened.data);
  });
});
