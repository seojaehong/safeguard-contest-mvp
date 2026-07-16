import { describe, expect, test } from "vitest";

import {
  attachGenerationEvidence,
  verifyAskResponseGenerationEvidence,
} from "@/lib/generation-evidence";
import { buildMockAskResponse, mockSearchResults } from "@/lib/mock-data";
import { buildDocpackResult } from "@/lib/mcp-tools";
import type { ActiveEvidenceChainPack } from "@/lib/ontology/evidence-chain";
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

function buildCanonicalPack(input = "고소작업"): ActiveEvidenceChainPack {
  const knowledge = buildPublishedSafetyKnowledge(publishedGraph, input);
  if (!knowledge.found || !knowledge.evidenceContract) {
    throw new Error("expected canonical Phase A evidence contract");
  }
  return knowledge.evidenceContract;
}

function buildResponse(question: string): AskResponse {
  return buildMockAskResponse(
    question,
    mockSearchResults.slice(0, 3),
    "mock",
    "Phase A canonical product materialization test",
  );
}

function expectNoInventedScore(value: unknown): void {
  const serialized = JSON.stringify(value);
  expect(serialized).not.toContain('"likelihood"');
  expect(serialized).not.toContain('"severity"');
  expect(serialized).not.toContain('"riskLevel"');
}

describe("Phase A product materialization", () => {
  test.each(cases)(
    "materializes canonical review rows and provenance for $chainId",
    ({ input, chainId, taskNodeId, hazardNodeId, sifCount, controlCount }) => {
      const product = buildPhaseAProductMaterialization({
        evidencePack: buildCanonicalPack(input),
      });

      expect(product).toMatchObject({
        chainId,
        reportedEvidenceChainState: "review_required",
        evidenceChainState: "review_required",
        authorityState: "review_required",
        outputStatus: "review_required_draft",
        task: { nodeId: taskNodeId, publicationState: "published" },
        hazard: { nodeId: hazardNodeId, authority: "published_graph" },
        verifiedDocumentRows: [],
        humanConfirmation: { required: true, status: "pending" },
        coverage: {
          expectedDocumentRows: controlCount * 2,
          materializedDocumentRows: controlCount * 2,
          verifiedDocumentRows: 0,
        },
        provenance: {
          taskNodeIds: [taskNodeId],
          hazardNodeIds: [hazardNodeId],
        },
      });
      expect(product?.accidents).toHaveLength(sifCount);
      expect(product?.controls).toHaveLength(controlCount);
      expect(product?.provenance.sifAccidentCitedUids).toHaveLength(sifCount);
      expect(product?.provenance.controlNodeIds).toHaveLength(controlCount);
      expect(product?.provenance.lawCitedUids.length).toBeGreaterThan(0);
      expect(product?.documentRows).toHaveLength(controlCount * 2);
      expect(product?.documentRows.filter((row) => row.document === "risk_assessment"))
        .toHaveLength(controlCount);
      expect(product?.documentRows.filter((row) => row.document === "tbm"))
        .toHaveLength(controlCount);
      expect(product?.documentRows.every((row) => (
        row.classification === "review_required"
        && row.verificationStatus === "review_required"
        && row.provenance.lawRelation === "mandatedBy"
      ))).toBe(true);
      expect(new Set(product?.documentRows.map((row) => row.stableKey)).size)
        .toBe(controlCount * 2);
      expectNoInventedScore(product);
    },
  );

  test("preserves mapped KOSHA provenance without treating it as verified", () => {
    const product = buildPhaseAProductMaterialization({
      evidencePack: buildCanonicalPack("고소작업"),
    });

    expect(product?.provenance.koshaGuidanceCitedUids.length).toBeGreaterThan(0);
    expect(product?.controls.some((control) => (
      control.provenance.koshaGuidanceCitedUids.length > 0
    ))).toBe(true);
    expect(product?.controls.every((control) => (
      control.authorityState === "review_required"
      && control.classification === "review_required"
    ))).toBe(true);
    const row = product?.documentRows.find((candidate) => (
      candidate.controlId === "fall-work-platform"
      && candidate.document === "risk_assessment"
    ));
    expect(row?.provenance.sifEvidence).toEqual(product?.accidents);
    expect(row?.provenance.koshaGuidanceEvidence).toEqual(
      buildCanonicalPack("고소작업").controls[0]?.guidanceEvidence,
    );
    expect(row?.provenance.koshaGuidanceEvidence[0]?.chunk).toMatchObject({
      chunkId: expect.stringMatching(/^kosha-chunk-/u),
      chunkSha256: expect.stringMatching(/^[a-f0-9]{64}$/u),
      page: expect.any(Number),
      location: expect.stringMatching(/^physical_page_/u),
    });
    expect(row?.provenance.lawEvidence[0]).toMatchObject({
      relation: "mandatedBy",
      graphArticleNodeId: "Article_기준규칙_42",
      officialUrl: expect.stringMatching(/^https:\/\//u),
    });
    expect(product?.verifiedDocumentRows).toEqual([]);
  });

  test.each([
    {
      label: "task node",
      mutate(pack: ActiveEvidenceChainPack): void {
        pack.task.nodeId = "Task_forged";
      },
    },
    {
      label: "SIF citation",
      mutate(pack: ActiveEvidenceChainPack): void {
        const source = pack.hazardPriority[0];
        if (!source) throw new Error("expected SIF source");
        source.citedUid = "ref:safety_reference_items:forged";
      },
    },
    {
      label: "control node",
      mutate(pack: ActiveEvidenceChainPack): void {
        const control = pack.controls[0];
        if (!control) throw new Error("expected control");
        control.graphControlNodeId = "Control_forged";
      },
    },
    {
      label: "KOSHA review state",
      mutate(pack: ActiveEvidenceChainPack): void {
        const source = pack.guidance[0];
        if (!source) throw new Error("expected KOSHA source");
        source.reviewState = "published";
        source.resolution = "resolved";
      },
    },
    {
      label: "KOSHA citation",
      mutate(pack: ActiveEvidenceChainPack): void {
        const source = pack.controls[0]?.guidanceEvidence[0];
        if (!source) throw new Error("expected KOSHA source");
        source.citedUid = "ref:safety_reference_items:forged";
      },
    },
    {
      label: "law citation",
      mutate(pack: ActiveEvidenceChainPack): void {
        const source = pack.controls[0]?.lawEvidence[0];
        if (!source) throw new Error("expected law source");
        source.citedUid = "law:forged:제999조";
      },
    },
    {
      label: "review row stable key",
      mutate(pack: ActiveEvidenceChainPack): void {
        const target = pack.materialization[0]?.targets[0];
        if (!target) throw new Error("expected review target");
        target.stableKey = "forged:stable:key";
      },
    },
  ])("fails closed when canonical pack $label is forged", ({ mutate }) => {
    const pack = structuredClone(buildCanonicalPack());
    mutate(pack);

    expect(buildPhaseAProductMaterialization({ evidencePack: pack })).toBeNull();
    expect(() => materializePhaseAProductIntoResponse(buildResponse("고소작업"), pack))
      .toThrow("canonical registry validation");
  });

  test("is deterministic and leaves existing scored rows byte-for-byte unchanged", () => {
    const pack = buildCanonicalPack("전기 작업");
    const existingRow: RiskAssessmentRow = {
      location: "EXISTING_LOCATION",
      process: "EXISTING_PROCESS",
      task: "EXISTING_TASK",
      equipment: "EXISTING_EQUIPMENT",
      hazard: "EXISTING_HAZARD",
      fourM: "Media",
      accidentType: "fall",
      currentControls: "EXISTING_CURRENT_CONTROL",
      likelihood: 3,
      severity: 4,
      riskLevel: "high",
      additionalControls: "EXISTING_ADDITIONAL_CONTROL",
      owner: "EXISTING_OWNER",
      due: "EXISTING_DUE",
      verification: "EXISTING_VERIFICATION",
      verificationStatus: "planned",
      verificationDate: "EXISTING_DATE",
      verificationChecker: "EXISTING_CHECKER",
      whyLikelihood: "EXISTING_LIKELIHOOD",
      whySeverity: "EXISTING_SEVERITY",
      evidenceRefs: ["EXISTING_REF"],
    };
    const original: AskResponse = {
      ...buildResponse("전기 작업"),
      structured: {
        riskAssessmentRows: [existingRow],
        riskAssessmentValidation: { ok: true, issueCount: 0, issues: [] },
        tbmRiskLinks: [],
      },
    };
    const structuredJson = JSON.stringify(original.structured);

    const once = materializePhaseAProductIntoResponse(original, pack);
    const twice = materializePhaseAProductIntoResponse(once, pack);

    expect(JSON.stringify(once.phaseAProduct)).toBe(JSON.stringify(twice.phaseAProduct));
    expect(JSON.stringify(once.structured)).toBe(structuredJson);
    expect(JSON.stringify(twice.structured)).toBe(structuredJson);
    expect(once.deliverables).toEqual(original.deliverables);
  });

  test("reseals canonical review rows and survives evidence-summary reopen", () => {
    const secret = "phase-a-materialization-secret";
    const pack = buildCanonicalPack("지게차 상하차");
    const sealed = attachGenerationEvidence({
      ...buildResponse("지게차 상하차"),
      dbHarness: { packet: {} } as NonNullable<AskResponse["dbHarness"]>,
    }, {
      secret,
      generatedAt: "2026-07-14T12:00:00.000Z",
    });

    const materialized = materializePhaseAProductIntoResponse(sealed, pack, {
      generationEvidenceSecret: secret,
    });
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
    expect(reopened.data?.phaseAProduct).toEqual(materialized.phaseAProduct);
    expect(reopened.data?.phaseAProduct?.verifiedDocumentRows).toEqual([]);
    expect(reopened.data && verifyAskResponseGenerationEvidence(reopened.data, secret).ok)
      .toBe(true);
    expect(buildDocpackResult(materialized, true).phaseAProduct)
      .toEqual(materialized.phaseAProduct);
  });
});
