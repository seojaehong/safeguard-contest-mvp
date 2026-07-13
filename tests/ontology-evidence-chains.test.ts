import { describe, expect, test } from "vitest";

import { buildDbHarnessPacket } from "@/lib/db-harness";
import { assembleGraph, type OntologyGraph } from "@/lib/ontology/graph-store";
import {
  classifyControlObligation,
  confirmNaturalizedEvidenceChain,
  naturalizeEvidenceChain,
  recordNaturalizedEvidenceChainQuality,
  resolveEvidenceChain,
  resolveEvidenceCitations,
  type ControlEvidenceSource,
  type ObligationClassification,
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
        ["kosha-07e82640daba8e37ebb73cdb", "D-C-7", "dd07e81d5176bd73484f685e", 58],
        ["kosha-1cad3b4b264aa96277dcfae8", "A-G-1", "57c50cf2248cf860969982a4", 7],
      ],
      articleNos: ["42", "43", "44"],
    },
    {
      input: "차량계·기계 인접작업",
      chainId: "vehicle-machinery-entrapment",
      hazard: "끼임",
      sifIds: ["sif-아카이브-건설업-00024", "sif-아카이브-건설업-00074"],
      guides: [
        ["kosha-2817664393f505499a71d63d", "C-48", "1602e569f8fbe9c789d06cbc", 4],
        ["kosha-32d7faa3ac4ef74e48d959d4", "D-C-4", "318945791a391ef2ab83fc8b", 20],
        ["kosha-c6bba4fd3e9a9305c1edce41", "B-M-37", "9a5c5df7fc303f229134ead0", 15],
        ["kosha-c6bba4fd3e9a9305c1edce41", "B-M-37", "6f5898c423e8425d84201656", 40],
      ],
      articleNos: ["172"],
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
        ["kosha-7161ec0c8b05f2cccbe519b3", "B-E-10", "c300b03bbb724268225a73f7", 9],
        ["kosha-a8a1ea385da644ac8f48149f", "B-E-11", "7f40eb9fd888ee9a78bde37e", 7],
        ["kosha-a8a1ea385da644ac8f48149f", "B-E-11", "ddd57dc246a2ae6e93f5aa14", 15],
        ["kosha-a8a1ea385da644ac8f48149f", "B-E-11", "1828d0072421b7434a65cdba", 16],
        ["kosha-7e511f17893129148a46714c", "B-E-9", "77d92b287dac21705c7eff74", 10],
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
    ["차량계 하역운반기계 인접 작업", "vehicle-machinery-entrapment", "Task_forklift_loading"],
    ["전기 설비 작업", "electrical-work-electrocution", "Task_electrical_work"],
  ])("maps alias '%s' to the exact published canonical Task", (input, chainId, taskNodeId) => {
    const pack = requireResolved(input);
    expect(pack.chainId).toBe(chainId);
    expect(pack.task.nodeId).toBe(taskNodeId);
    expect(pack.task.match).toBe("alias");
    expect(pack.task.publicationState).toBe("published");
  });

  test("does not infer a forklift Task from a construction-machinery input", () => {
    expect(resolveEvidenceChain(publishedGraph, "건설기계 인접 작업")).toMatchObject({
      resolved: false,
      published: false,
      reason: "not_registered",
    });
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

  test("uses Article 172 only for the forklift contact-control condition", () => {
    const pack = requireResolved("차량계·기계 인접작업");
    expect(pack.law).toEqual([
      expect.objectContaining({
        articleNo: "172",
        graphArticleNodeId: "Article_기준규칙_172",
        layer: "published_graph",
        officialUrl:
          "https://www.law.go.kr/LSW/lsLawLinkInfo.do?chrClsCd=010202&lsJoLnkSeq=1000727233",
      }),
    ]);
    expect(pack.controls).toEqual([
      expect.objectContaining({
        controlId: "vehicle-contact-prevention",
        graphControlNodeId: "Control_유도자_배치_및_접촉위험구역_출입통제",
        applicabilityCondition: expect.stringContaining("차량계 하역운반기계등"),
      }),
    ]);
    expect(JSON.stringify(pack)).not.toContain("제200조");
    expect(JSON.stringify(pack)).not.toContain("Article_기준규칙_200");
    expect(JSON.stringify(pack)).not.toContain("machine-maintenance-isolation");
  });

  test("maps only directly supported KOSHA chunks to controls", () => {
    const fall = requireResolved("고소작업");
    expect(
      fall.controls.map((control) => [
        control.controlId,
        control.guidanceEvidence.map((source) => [source.guideCode, source.chunk.chunkId]),
        control.guidanceStatus,
        control.guidanceReviewRequired,
      ]),
    ).toEqual([
      [
        "fall-work-platform",
        [
          ["D-C-7", "kosha-chunk-784b7f55fa7a16fe52255cec"],
          ["A-G-1", "kosha-chunk-57c50cf2248cf860969982a4"],
        ],
        "unresolved",
        true,
      ],
      [
        "fall-opening-guard",
        [["A-G-1", "kosha-chunk-57c50cf2248cf860969982a4"]],
        "unresolved",
        true,
      ],
      [
        "fall-anchor",
        [["D-C-7", "kosha-chunk-dd07e81d5176bd73484f685e"]],
        "unresolved",
        true,
      ],
    ]);
    expect(fall.controls.find((control) => control.controlId === "fall-anchor")?.applicabilityCondition).toContain(
      "높이 2미터 이상",
    );
    expect(fall.controls.find((control) => control.controlId === "fall-anchor")?.applicabilityCondition).toContain(
      "안전대를 착용",
    );

    const entrapment = requireResolved("차량계·기계 인접작업");
    expect(entrapment.controls[0]?.guidanceEvidence).toEqual([]);
    expect(entrapment.controls[0]?.guidanceStatus).toBe("missing");
    expect(entrapment.controls[0]?.guidanceReviewRequired).toBe(true);

    const electrical = requireResolved("전기작업");
    expect(
      electrical.controls.map((control) => [
        control.controlId,
        control.guidanceEvidence.map((source) => [source.guideCode, source.chunk.chunkId]),
      ]),
    ).toEqual([
      [
        "electrical-live-part-guarding",
        [
          ["B-E-11", "kosha-chunk-7f40eb9fd888ee9a78bde37e"],
          ["B-E-11", "kosha-chunk-ddd57dc246a2ae6e93f5aa14"],
        ],
      ],
      [
        "electrical-grounding",
        [["B-E-9", "kosha-chunk-77d92b287dac21705c7eff74"]],
      ],
      [
        "electrical-deenergized-isolation",
        [["B-E-10", "kosha-chunk-c300b03bbb724268225a73f7"]],
      ],
      [
        "electrical-live-work-distance",
        [
          ["B-E-11", "kosha-chunk-ddd57dc246a2ae6e93f5aa14"],
          ["B-E-11", "kosha-chunk-1828d0072421b7434a65cdba"],
        ],
      ],
      [
        "electrical-insulating-ppe",
        [["B-E-11", "kosha-chunk-1828d0072421b7434a65cdba"]],
      ],
    ]);
  });

  test("marks unsupported or out-of-scope chunks without forcing them onto a Control", () => {
    const fall = requireResolved("고소작업");
    expect(
      fall.guidance.find((source) => source.guideCode === "C-74")?.registryMapping,
    ).toBe("direct_support_missing");

    const entrapment = requireResolved("차량계·기계 인접작업");
    expect(
      entrapment.guidance.map((source) => [
        source.guideCode,
        source.chunk.chunkId,
        source.registryMapping,
      ]),
    ).toEqual([
      ["C-48", "kosha-chunk-1602e569f8fbe9c789d06cbc", "task_scope_mismatch"],
      ["D-C-4", "kosha-chunk-318945791a391ef2ab83fc8b", "task_scope_mismatch"],
      ["B-M-37", "kosha-chunk-9a5c5df7fc303f229134ead0", "registry_control_missing"],
      ["B-M-37", "kosha-chunk-6f5898c423e8425d84201656", "task_scope_mismatch"],
    ]);
    expect(JSON.stringify(entrapment.controls)).not.toContain("9a5c5df7fc303f229134ead0");
    expect(JSON.stringify(entrapment.controls)).not.toContain("6f5898c423e8425d84201656");
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
  type ExpectedClassification =
    | "statutory_mandate"
    | "technical_guidance_only"
    | "statutory_mandate_with_guidance"
    | "review_required";
  type Equal<Left, Right> =
    (<Value>() => Value extends Left ? 1 : 2) extends
    (<Value>() => Value extends Right ? 1 : 2)
      ? true
      : false;
  const classificationUnionIsExact: Equal<ObligationClassification, ExpectedClassification> = true;

  test.each([
    ["published mandatedBy law only", [publishedLaw], "statutory_mandate"],
    ["verified KOSHA only", [verifiedGuidance], "technical_guidance_only"],
    [
      "published law and verified KOSHA",
      [publishedLaw, verifiedGuidance],
      "statutory_mandate_with_guidance",
    ],
    ["SIF only", [publishedSif], "review_required"],
  ] as const)("classifies %s", (_label, sources, expected) => {
    expect(classificationUnionIsExact).toBe(true);
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

  test("keeps the global KOSHA corpus gate dominant over malicious resolution overrides", () => {
    const unresolved = requireResolved("고소작업");
    expect(unresolved.controls.find((control) => control.guidanceEvidence.length > 0)?.obligation.classification).toBe(
      "review_required",
    );

    const guidanceResolutions = Object.fromEntries(
      unresolved.guidance.map((source) => [
        source.citedUid,
        { reviewState: "published" as const, resolution: "resolved" as const },
      ]),
    );
    const resolved = resolveEvidenceChain(publishedGraph, "고소작업", { guidanceResolutions });
    expect(resolved.resolved).toBe(true);
    if (!resolved.resolved) throw new Error("expected resolved chain");
    expect(resolved.pack.guidance.every((source) => source.reviewState === "draft")).toBe(true);
    expect(resolved.pack.guidance.every((source) => source.resolution === "unresolved")).toBe(true);
    expect(resolved.pack.provenance.guidanceOverlay).toMatchObject({
      reviewState: "draft",
      resolution: "unresolved",
      launchReady: false,
      bodyMissingCount: 1,
      downloadProvenance: "incomplete",
      productionChunkBridge: "absent",
    });
    expect(
      resolved.pack.controls.find((control) => control.guidanceEvidence.length > 0)?.obligation.classification,
    ).toBe("review_required");
    expect(
      resolved.pack.controls.some(
        (control) => control.obligation.classification === "statutory_mandate_with_guidance",
      ),
    ).toBe(false);
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

  test.each([
    {
      label: "Task-entailsHazard edge missing",
      input: "차량계·기계 인접작업",
      mutate: (graph: OntologyGraph): OntologyGraph => ({
        ...graph,
        edges: graph.edges.filter(
          (edge) =>
            !(
              edge.src === "Task_forklift_loading" &&
              edge.rel === "entailsHazard" &&
              edge.dst === "Hazard_충돌_협착_끼임"
            ),
        ),
      }),
      reason: "published_task_hazard_edge_missing",
    },
    {
      label: "Hazard-mitigatedBy-Control edge missing",
      input: "차량계·기계 인접작업",
      mutate: (graph: OntologyGraph): OntologyGraph => ({
        ...graph,
        edges: graph.edges.filter(
          (edge) =>
            !(
              edge.src === "Hazard_충돌_협착_끼임" &&
              edge.rel === "mitigatedBy" &&
              edge.dst === "Control_유도자_배치_및_접촉위험구역_출입통제"
            ),
        ),
      }),
      reason: "published_hazard_control_edge_missing",
    },
    {
      label: "Control-mandatedBy-Article edge missing",
      input: "차량계·기계 인접작업",
      mutate: (graph: OntologyGraph): OntologyGraph => ({
        ...graph,
        edges: graph.edges.filter(
          (edge) =>
            !(
              edge.src === "Control_유도자_배치_및_접촉위험구역_출입통제" &&
              edge.rel === "mandatedBy" &&
              edge.dst === "Article_기준규칙_172"
            ),
        ),
      }),
      reason: "published_control_law_edge_missing",
    },
  ])("fails closed when $label", ({ input, mutate, reason }) => {
    expect(resolveEvidenceChain(mutate(publishedGraph), input)).toMatchObject({
      resolved: false,
      published: false,
      reason,
    });
  });

  test.each([
    {
      label: "Task-entailsHazard-Hazard",
      src: "Task_forklift_loading",
      rel: "entailsHazard",
      dst: "Hazard_충돌_협착_끼임",
      reason: "published_task_hazard_edge_missing",
    },
    {
      label: "Hazard-mitigatedBy-Control",
      src: "Hazard_충돌_협착_끼임",
      rel: "mitigatedBy",
      dst: "Control_유도자_배치_및_접촉위험구역_출입통제",
      reason: "published_hazard_control_edge_missing",
    },
    {
      label: "Control-mandatedBy-Article",
      src: "Control_유도자_배치_및_접촉위험구역_출입통제",
      rel: "mandatedBy",
      dst: "Article_기준규칙_172",
      reason: "published_control_law_edge_missing",
    },
  ] as const)("fails closed for draft or wrong-direction $label edges", ({ src, rel, dst, reason }) => {
    const edge = publishedGraph.edges.find(
      (candidate) =>
        candidate.src === src && candidate.rel === rel && candidate.dst === dst,
    );
    if (!edge) throw new Error("required seed edge missing");
    const withoutEdge = publishedGraph.edges.filter((candidate) => candidate !== edge);
    const draftGraph: OntologyGraph = {
      ...publishedGraph,
      edges: [...withoutEdge, { ...edge, review_state: "draft" }],
    };
    const reversedGraph: OntologyGraph = {
      ...publishedGraph,
      edges: [
        ...withoutEdge,
        { ...edge, src: edge.dst, dst: edge.src },
      ],
    };

    expect(resolveEvidenceChain(draftGraph, "차량계·기계 인접작업")).toMatchObject({
      resolved: false,
      reason,
    });
    expect(resolveEvidenceChain(reversedGraph, "차량계·기계 인접작업")).toMatchObject({
      resolved: false,
      reason,
    });
  });

  test("fails closed when a required published Control endpoint is missing", () => {
    const graphWithoutControl: OntologyGraph = {
      ...publishedGraph,
      nodes: publishedGraph.nodes.filter(
        (node) => node.node_id !== "Control_유도자_배치_및_접촉위험구역_출입통제",
      ),
    };
    expect(resolveEvidenceChain(graphWithoutControl, "차량계·기계 인접작업")).toMatchObject({
      resolved: false,
      reason: "published_control_missing",
    });
  });

  test("fails closed when the required published Hazard endpoint is missing", () => {
    const graphWithoutHazard: OntologyGraph = {
      ...publishedGraph,
      nodes: publishedGraph.nodes.filter((node) => node.node_id !== "Hazard_충돌_협착_끼임"),
    };
    expect(resolveEvidenceChain(graphWithoutHazard, "차량계·기계 인접작업")).toMatchObject({
      resolved: false,
      reason: "published_hazard_missing",
    });
  });

  test("resolves every emitted cited UID through the existing parser", () => {
    const citations = resolveEvidenceCitations(requireResolved("전기작업"));
    expect(citations.length).toBeGreaterThan(0);
    expect(citations.every((citation) => citation.parsed !== null)).toBe(true);
    expect(citations.some((citation) => citation.parsed?.namespace === "law")).toBe(true);
    expect(citations.some((citation) => citation.parsed?.namespace === "ref")).toBe(true);
    expect(citations.some((citation) => citation.parsed?.namespace === "manual")).toBe(true);
  });

  test("uses production item UIDs and labels local recovery chunks as snapshot provenance", () => {
    const pack = requireResolved("전기작업");
    expect(Array.from(new Set(pack.guidance.map((source) => source.productionItemId)))).toEqual([
      "technical-support-09-0002-b-e-10-2026-정전전로-및-그-인근에서의-전기작업에-관한-기술지원규정",
      "technical-support-09-0003-b-e-11-2026-충전전로-및-그-인근에서의-전기작업에-관한-기술지원규정",
      "technical-support-09-0022-b-e-9-2026-접지설비에-관한-기술지원규정",
    ]);
    for (const source of pack.guidance) {
      expect(source.citedUid).toBe(`ref:safety_reference_items:${source.productionItemId}`);
      expect(source.citedUid).not.toContain(source.itemId);
      expect(source.chunk.chunkId).toMatch(/^kosha-chunk-/);
      expect(source.chunk.chunkCitedUid).toMatch(/^manual:kosha-body-recovery-2026-07-12-v3\//);
      expect(source.chunk.location).toBe(`physical_page_${source.chunk.page}`);
      expect(source.provenanceBridge).toBe("unresolved");
      expect(source.productionRowStatus).toBe("ready");
      expect(source.localSnapshotState).toBe("current-unverified");
    }
  });

  test("retains exact production row IDs separately from local item and chunk IDs", () => {
    const productionIds = new Set(
      ["고소작업", "차량계·기계 인접작업", "전기작업"].flatMap((input) =>
        requireResolved(input).guidance.map((source) => source.productionItemId),
      ),
    );
    expect(productionIds).toEqual(new Set([
      "technical-support-01-0043-c-74-2015-건설공사의-고소작업대-안전보건작업지침",
      "technical-support-01-0073-d-c-7-2026-비계-구조-및-안전작업에-관한-기술지원규정",
      "technical-support-06-0001-a-g-1-2025-추락방호망-설치-기술지원규정-수직형-추락방망-설치",
      "technical-support-01-0024-c-48-2022-건설기계-안전보건작업지침",
      "technical-support-01-0070-d-c-4-2025-굴착기-안전보건작업-기술지원규정",
      "technical-support-02-0033-b-m-37-2026-회전기계-등의-끼임-절단재해-예방을-위한-기술지원규정",
      "technical-support-09-0002-b-e-10-2026-정전전로-및-그-인근에서의-전기작업에-관한-기술지원규정",
      "technical-support-09-0003-b-e-11-2026-충전전로-및-그-인근에서의-전기작업에-관한-기술지원규정",
      "technical-support-09-0022-b-e-9-2026-접지설비에-관한-기술지원규정",
    ]));
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
      expect(mapping.guidanceReviewRequired).toBe(mapping.guidanceStatus !== "verified");
      for (const source of mapping.guidanceProvenance) {
        expect(source.itemCitedUid).toMatch(/^ref:safety_reference_items:technical-support-/);
        expect(source.snapshotItemId).toMatch(/^kosha-/);
        expect(source.chunkId).toMatch(/^kosha-chunk-/);
        expect(source.chunkCitedUid).toMatch(/^manual:kosha-body-recovery-2026-07-12-v3\//);
        expect(source.location).toBe(`physical_page_${source.page}`);
        expect(source.bridgeResolution).toBe("unresolved");
      }
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

  test("requires passed quality and explicit human confirmation after naturalization", () => {
    const naturalized = naturalizeEvidenceChain(requireResolved("전기작업"), "고정 근거팩 문장화 결과");
    expect(naturalized.humanConfirmation).toEqual({ required: true, status: "pending" });

    expect(() =>
      confirmNaturalizedEvidenceChain(naturalized, {
        reviewerId: "safety-reviewer-1",
        confirmedAt: "2026-07-13T08:00:00+09:00",
      }),
    ).toThrow(/quality check.*passed/i);

    const failed = recordNaturalizedEvidenceChainQuality(naturalized, "failed");
    expect(() =>
      confirmNaturalizedEvidenceChain(failed, {
        reviewerId: "safety-reviewer-1",
        confirmedAt: "2026-07-13T08:00:00+09:00",
      }),
    ).toThrow(/quality check.*passed/i);

    const passed = recordNaturalizedEvidenceChainQuality(naturalized, "passed");

    const confirmed = confirmNaturalizedEvidenceChain(passed, {
      reviewerId: "safety-reviewer-1",
      confirmedAt: "2026-07-13T08:00:00+09:00",
    });
    expect(confirmed.humanConfirmation).toEqual({
      required: true,
      status: "confirmed",
      reviewerId: "safety-reviewer-1",
      confirmedAt: "2026-07-13T08:00:00+09:00",
    });
    expect(confirmed.qualityCheck).toEqual({ required: true, status: "passed" });
  });

  test("isolates and freezes the fixed evidence pack across confirmation", () => {
    const sourcePack = requireResolved("전기작업");
    const originalLabel = sourcePack.controls[0]?.label;
    const naturalized = naturalizeEvidenceChain(sourcePack, "고정 근거팩 문장화 결과");
    const passed = recordNaturalizedEvidenceChainQuality(naturalized, "passed");
    const confirmed = confirmNaturalizedEvidenceChain(passed, {
      reviewerId: "safety-reviewer-1",
      confirmedAt: "2026-07-13T08:00:00+09:00",
    });

    if (sourcePack.controls[0]) sourcePack.controls[0].label = "mutated after confirmation";
    expect(confirmed.fixedPack.controls[0]?.label).toBe(originalLabel);
    expect(Object.isFrozen(confirmed.fixedPack)).toBe(true);
    expect(Object.isFrozen(confirmed.fixedPack.controls)).toBe(true);
    expect(Object.isFrozen(confirmed.fixedPack.controls[0])).toBe(true);
  });

  test("builds query_safety_knowledge as a layered evidence contract while retaining core fields", () => {
    const payload = buildPublishedSafetyKnowledge(publishedGraph, "전기 설비 작업");
    expect(payload.found).toBe(true);
    if (!payload.found) throw new Error("expected found knowledge");

    expect(payload.task).toBe("전기 작업");
    expect(payload.hazards.length).toBeGreaterThan(0);
    expect(payload.provenance).toBe("법제처 검증 시드 v1");
    expect(payload.coreProvenance).toBe("법제처 검증 시드 v1");
    expect(payload.evidenceContract?.contractVersion).toBe(EVIDENCE_CHAIN_CONTRACT_VERSION);
    expect(payload.evidenceContract?.pipeline.llmRole).toBe("naturalize_only");
    expect(payload.evidenceContract?.pipeline.humanConfirmationRequired).toBe(true);
    expect(payload.evidenceChainState).toBe("review_required");
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
