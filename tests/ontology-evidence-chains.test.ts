import { describe, expect, test } from "vitest";

import { buildDbHarnessPacket } from "@/lib/db-harness";
import { assembleGraph, type OntologyGraph } from "@/lib/ontology/graph-store";
import {
  classifyControlObligation,
  confirmNaturalizedEvidenceChain,
  naturalizeEvidenceChain,
  resolveEvidenceChain,
  resolveEvidenceCitations,
  type ControlEvidenceSource,
} from "@/lib/ontology/evidence-chain";
import {
  EVIDENCE_CHAIN_CONTRACT_VERSION,
  EXCLUDED_KOSHA_ITEM_IDS,
  SIF_CORPUS_STATE,
} from "@/lib/ontology/evidence-chain-registry";
import { buildPublishedSafetyKnowledge } from "@/lib/ontology/knowledge-tool";
import { SEED_EDGES, SEED_NODES } from "@/lib/ontology/seed/core-triples";
import { EDGE_RELS, NODE_KINDS } from "@/lib/ontology/schema";

const publishedGraph = assembleGraph(
  SEED_NODES.filter((node) => node.review_state === "published"),
  SEED_EDGES.filter((edge) => edge.review_state === "published"),
);

function requireResolved(input: string) {
  const resolution = resolveEvidenceChain(publishedGraph, input);
  expect(resolution.resolved).toBe(true);
  if (!resolution.resolved) throw new Error(`expected resolved chain for ${input}`);
  return resolution.pack;
}

const publishedLaw: ControlEvidenceSource = {
  sourceType: "law",
  relation: "mandatedBy",
  citedUid: "law:산업안전보건기준에 관한 규칙:제42조",
  reviewState: "published",
  resolution: "resolved",
};

const verifiedGuidance: ControlEvidenceSource = {
  sourceType: "kosha_guidance",
  citedUid: "ref:safety_reference_items:kosha-verified",
  reviewState: "verified",
  resolution: "resolved",
};

const publishedSif: ControlEvidenceSource = {
  sourceType: "sif_case",
  citedUid: "ref:safety_reference_items:sif-published",
  reviewState: "published",
  resolution: "resolved",
};

describe("Phase A canonical evidence-chain registry", () => {
  test("preserves the existing seven node kinds and seven edge relations", () => {
    expect(NODE_KINDS).toHaveLength(7);
    expect(EDGE_RELS).toHaveLength(7);
  });

  test.each([
    {
      input: "고소작업",
      chainId: "work-at-height-fall",
      hazard: "추락",
      sifIds: ["sif-아카이브-건설업-00323", "sif-아카이브-건설업-00668"],
      guides: [
        ["kosha-a3c8a491f835c6eaf5109705", "C-74", "470a9a64364fcf013b0127ff", 11],
        ["kosha-07e82640daba8e37ebb73cdb", "D-C-7", "784b7f55fa7a16fe52255cec", 19],
      ],
      articleNos: ["42", "43", "44"],
    },
    {
      input: "차량계·기계 인접작업",
      chainId: "vehicle-machinery-entrapment",
      hazard: "끼임",
      sifIds: ["sif-아카이브-건설업-00024", "sif-아카이브-건설업-00074"],
      guides: [
        ["kosha-2817664393f505499a71d63d", "C-48", "1602e569", 4],
        ["kosha-32d7faa3ac4ef74e48d959d4", "D-C-4", "318945", 20],
        ["kosha-c6bba4fd3e9a9305c1edce41", "B-M-37", "9a5c5d", 15],
      ],
      articleNos: ["92", "200"],
    },
    {
      input: "전기작업",
      chainId: "electrical-work-electrocution",
      hazard: "감전",
      sifIds: [
        "sif-아카이브-건설업-01798",
        "sif-아카이브-건설업-01879",
        "sif-아카이브-건설업-01819",
      ],
      guides: [
        ["kosha-7161ec0c8b05f2cccbe519b3", "B-E-10", "c300b03", 9],
        ["kosha-a8a1ea385da644ac8f48149f", "B-E-11", "1828d007", 16],
      ],
      articleNos: ["301", "302", "319", "321", "323"],
    },
  ])("resolves $chainId with the approved evidence set", ({
    input,
    chainId,
    hazard,
    sifIds,
    guides,
    articleNos,
  }) => {
    const pack = requireResolved(input);

    expect(pack.contractVersion).toBe(EVIDENCE_CHAIN_CONTRACT_VERSION);
    expect(pack.chainId).toBe(chainId);
    expect(pack.hazard.label).toBe(hazard);
    expect(pack.hazardPriority.map((source) => source.itemId)).toEqual(sifIds);
    expect(
      pack.guidance.map((source) => [
        source.itemId,
        source.guideCode,
        source.chunk.chunkIdFragment,
        source.chunk.page,
      ]),
    ).toEqual(guides);
    expect(pack.law.map((source) => source.articleNo)).toEqual(articleNos);
    expect(pack.law.every((source) => source.effectiveDate === "2026-03-02")).toBe(true);
    expect(pack.law.every((source) => new URL(source.officialUrl).hostname.endsWith("law.go.kr"))).toBe(true);
  });

  test.each([
    ["고소 작업대 작업", "work-at-height-fall", "Task_work_at_height"],
    ["건설기계 인접 작업", "vehicle-machinery-entrapment", "Task_forklift_loading"],
    ["전기 설비 작업", "electrical-work-electrocution", "Task_electrical_work"],
  ])("maps alias '%s' to the exact published canonical Task", (input, chainId, taskNodeId) => {
    const pack = requireResolved(input);
    expect(pack.chainId).toBe(chainId);
    expect(pack.task.nodeId).toBe(taskNodeId);
    expect(pack.task.match).toBe("alias");
    expect(pack.task.publicationState).toBe("published");
  });

  test("ranks SIF deterministically and keeps 01985 review-only", () => {
    const pack = requireResolved("차량계·기계 인접작업");
    expect(pack.hazardPriority.map((source) => source.rank)).toEqual([1, 2]);
    expect(pack.hazardPriority.map((source) => source.itemId)).not.toContain(
      "sif-아카이브-건설업-01985",
    );
    expect(pack.reviewOnlyEvidence).toEqual([
      expect.objectContaining({
        itemId: "sif-아카이브-건설업-01985",
        autoConfirm: false,
        reviewState: "draft",
      }),
    ]);
    expect(EXCLUDED_KOSHA_ITEM_IDS).toContain("kosha-60492776122f8b433994fc10");
    expect(JSON.stringify(pack)).not.toContain("kosha-60492776122f8b433994fc10");
  });

  test("reports the SIF corpus as prepared but not embedded, uploaded, or promoted", () => {
    expect(SIF_CORPUS_STATE).toEqual({
      prepared: true,
      embedded: false,
      uploaded: false,
      ontologyPromoted: false,
    });
  });
});

describe("control obligation classifier", () => {
  test.each([
    ["published mandatedBy law only", [publishedLaw], "statutory_mandate"],
    ["verified KOSHA only", [verifiedGuidance], "technical_guidance_only"],
    [
      "published law and verified KOSHA",
      [publishedLaw, verifiedGuidance],
      "statutory_mandate_with_guidance",
    ],
    ["SIF only", [publishedSif], "neither"],
  ] as const)("classifies %s", (_label, sources, expected) => {
    expect(classifyControlObligation(sources).classification).toBe(expected);
  });

  test("forces review_required for any draft or unresolved source without categorical duty wording", () => {
    const classification = classifyControlObligation([
      publishedLaw,
      { ...verifiedGuidance, reviewState: "draft", resolution: "unresolved" },
    ]);

    expect(classification.classification).toBe("review_required");
    expect(classification.categoricalLegalDuty).toBe(false);
    expect(classification.statement).not.toMatch(/법정 의무입니다|법적 의무입니다|반드시 준수해야 합니다/);
  });

  test("keeps selected current-unverified KOSHA guidance review-required until resolution overrides are supplied", () => {
    const unresolved = requireResolved("고소작업");
    expect(unresolved.controls.every((control) => control.obligation.classification === "review_required")).toBe(
      true,
    );

    const guidanceResolutions = Object.fromEntries(
      unresolved.guidance.map((source) => [
        source.citedUid,
        { reviewState: "verified" as const, resolution: "resolved" as const },
      ]),
    );
    const resolved = resolveEvidenceChain(publishedGraph, "고소작업", { guidanceResolutions });
    expect(resolved.resolved).toBe(true);
    if (!resolved.resolved) throw new Error("expected resolved chain");
    expect(
      resolved.pack.controls.every(
        (control) => control.obligation.classification === "statutory_mandate_with_guidance",
      ),
    ).toBe(true);
  });
});

describe("published runtime gate and provenance", () => {
  test("fails closed when the exact canonical Task is absent", () => {
    const graphWithoutTask: OntologyGraph = {
      ...publishedGraph,
      nodes: publishedGraph.nodes.filter((node) => node.node_id !== "Task_work_at_height"),
    };
    const resolution = resolveEvidenceChain(graphWithoutTask, "고소작업");

    expect(resolution).toMatchObject({
      resolved: false,
      published: false,
      inferenceState: "unverified",
      reason: "published_task_missing",
    });
    expect(resolution).not.toHaveProperty("pack");
  });

  test("filters a mixed graph to a published-only runtime subgraph", () => {
    const mixedGraph = assembleGraph(SEED_NODES, SEED_EDGES);
    const pack = resolveEvidenceChain(mixedGraph, "전기작업");
    expect(pack.resolved).toBe(true);
    if (!pack.resolved) throw new Error("expected resolved chain");

    expect(pack.pack.provenance.runtimeGraph.scope).toBe("published_only");
    expect(pack.pack.provenance.runtimeGraph.nodeStates).toEqual(["published"]);
    expect(pack.pack.provenance.guidanceOverlay.reviewState).toBe("draft");
    expect(pack.pack.provenance.guidanceOverlay.resolution).toBe("unresolved");
  });

  test("fails closed when a registry law marked as published_graph is absent from the runtime graph", () => {
    const graphWithoutArticle: OntologyGraph = {
      ...publishedGraph,
      nodes: publishedGraph.nodes.filter((node) => node.node_id !== "Article_기준규칙_301"),
    };
    const resolution = resolveEvidenceChain(graphWithoutArticle, "전기작업");

    expect(resolution).toMatchObject({
      resolved: false,
      published: false,
      inferenceState: "unverified",
      reason: "published_law_missing",
    });
  });

  test("resolves every emitted cited UID through the existing parser", () => {
    const citations = resolveEvidenceCitations(requireResolved("전기작업"));
    expect(citations.length).toBeGreaterThan(0);
    expect(citations.every((citation) => citation.parsed !== null)).toBe(true);
    expect(citations.some((citation) => citation.parsed?.namespace === "law")).toBe(true);
    expect(citations.some((citation) => citation.parsed?.namespace === "ref")).toBe(true);
  });

  test("keeps KOSHA guidance separate from Article and mandatedBy law evidence", () => {
    const pack = requireResolved("전기작업");
    expect(pack.guidance.every((source) => source.sourceType === "kosha_guidance")).toBe(true);
    expect(pack.guidance.every((source) => !("relation" in source))).toBe(true);
    expect(pack.law.every((source) => source.sourceType === "law" && source.relation === "mandatedBy")).toBe(
      true,
    );
    for (const control of pack.controls) {
      expect(control.lawEvidence.every((source) => source.sourceType === "law")).toBe(true);
      expect(control.guidanceEvidence.every((source) => source.sourceType === "kosha_guidance")).toBe(true);
      expect(control).not.toHaveProperty("isLegalDuty");
    }
  });
});

describe("pipeline and document materialization contract", () => {
  test("materializes controls and evidence deterministically into risk-assessment and TBM targets", () => {
    const first = requireResolved("전기작업");
    const second = requireResolved("전기작업");

    expect(first.materialization).toEqual(second.materialization);
    expect(first.materialization).toHaveLength(first.controls.length);
    for (const mapping of first.materialization) {
      expect(mapping.targets.map((target) => target.document)).toEqual(["risk_assessment", "tbm"]);
      expect(mapping.targets.every((target) => target.rowOrSection.length > 0)).toBe(true);
      expect(mapping.lawCitedUids.every((uid) => uid.startsWith("law:"))).toBe(true);
      expect(mapping.guidanceCitedUids.every((uid) => uid.startsWith("ref:"))).toBe(true);
    }
  });

  test("uses field history and weather only as applicability context", () => {
    const resolution = resolveEvidenceChain(publishedGraph, "고소작업", {
      applicability: {
        fieldHistory: ["동일 작업구역에서 개구부 지적 이력"],
        weather: ["강풍 예보"],
      },
    });
    expect(resolution.resolved).toBe(true);
    if (!resolution.resolved) throw new Error("expected resolved chain");
    expect(resolution.pack.applicability.authority).toBe("scope_only");
    expect(resolution.pack.applicability.fieldHistory).toEqual(["동일 작업구역에서 개구부 지적 이력"]);
    expect(resolution.pack.applicability.weather).toEqual(["강풍 예보"]);
  });

  test("naturalize_only leaves the fixed pack unchanged and preserves the existing DB harness role", () => {
    const pack = requireResolved("고소작업");
    const before = structuredClone(pack);
    const naturalized = naturalizeEvidenceChain(pack, "고소작업의 추락 위험과 검토대상 조치를 설명합니다.");
    const harness = buildDbHarnessPacket({ question: "고소작업", references: [] });

    expect(pack).toEqual(before);
    expect(naturalized.fixedPack).toEqual(before);
    expect(naturalized.llmRole).toBe("naturalize_only");
    expect(naturalized.providerFallback).toBe("preserve_current_provider_fallback");
    expect(harness.generationContract.llmRole).toBe("naturalize_only");
  });

  test("requires an explicit human confirmation after naturalization", () => {
    const naturalized = naturalizeEvidenceChain(requireResolved("전기작업"), "고정 근거팩 문장화 결과");
    expect(naturalized.humanConfirmation).toEqual({ required: true, status: "pending" });

    const confirmed = confirmNaturalizedEvidenceChain(naturalized, {
      reviewerId: "safety-reviewer-1",
      confirmedAt: "2026-07-13T08:00:00+09:00",
    });
    expect(confirmed.humanConfirmation).toEqual({
      required: true,
      status: "confirmed",
      reviewerId: "safety-reviewer-1",
      confirmedAt: "2026-07-13T08:00:00+09:00",
    });
  });

  test("builds query_safety_knowledge as a layered evidence contract while retaining core fields", () => {
    const payload = buildPublishedSafetyKnowledge(publishedGraph, "전기 설비 작업");
    expect(payload.found).toBe(true);
    if (!payload.found) throw new Error("expected found knowledge");

    expect(payload.task).toBe("전기 작업");
    expect(payload.hazards.length).toBeGreaterThan(0);
    expect(payload.provenance).toBe("SafeClaw 계층형 안전근거 계약 phase-a/v1");
    expect(payload.coreProvenance).toBe("법제처 검증 시드 v1");
    expect(payload.evidenceContract?.contractVersion).toBe(EVIDENCE_CHAIN_CONTRACT_VERSION);
    expect(payload.evidenceContract?.pipeline.llmRole).toBe("naturalize_only");
    expect(payload.evidenceContract?.pipeline.humanConfirmationRequired).toBe(true);
    expect(payload.evidenceContract?.pipeline.stages).toEqual([
      "input",
      "canonical_task_alias_match",
      "published_subgraph",
      "evidence_pack",
      "llm_naturalize_only",
      "quality_check",
      "human_confirm",
    ]);
  });
});
