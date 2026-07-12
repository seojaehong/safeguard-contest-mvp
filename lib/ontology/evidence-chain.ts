import type { OntologyGraph } from "@/lib/ontology/graph-store";
import {
  CURRENT_LAW_EFFECTIVE_DATE,
  EVIDENCE_CHAIN_CONTRACT_VERSION,
  EVIDENCE_CHAIN_REGISTRY,
  KOSHA_CORPUS_STATE,
  SIF_CORPUS_STATE,
  getLawEvidence,
  type EvidenceChainDefinition,
  type EvidenceReviewStatus,
  type KoshaGuidanceRecord,
  type LawEvidenceRecord,
  type SifEvidenceRecord,
} from "@/lib/ontology/evidence-chain-registry";
import {
  normalizeLabel,
  parseCitedUid,
  type ParsedCitedUid,
  type ReviewState,
} from "@/lib/ontology/schema";

export type LawControlEvidenceSource = EvidenceReviewStatus & {
  sourceType: "law";
  relation: "mandatedBy";
  citedUid: string;
};

export type GuidanceControlEvidenceSource = EvidenceReviewStatus & {
  sourceType: "kosha_guidance";
  citedUid: string;
};

export type SifControlEvidenceSource = EvidenceReviewStatus & {
  sourceType: "sif_case";
  citedUid: string;
};

export type ControlEvidenceSource =
  | LawControlEvidenceSource
  | GuidanceControlEvidenceSource
  | SifControlEvidenceSource;

export type ObligationClassification =
  | "statutory_mandate"
  | "technical_guidance_only"
  | "statutory_mandate_with_guidance"
  | "neither"
  | "review_required";

export type ControlObligation = {
  classification: ObligationClassification;
  categoricalLegalDuty: boolean;
  statement: string;
};

export type EvidenceMaterializationTarget = {
  document: "risk_assessment" | "tbm";
  rowOrSection: string;
  stableKey: string;
};

export type EvidenceMaterialization = {
  controlId: string;
  controlLabel: string;
  applicabilityCondition: string;
  obligation: ControlObligation;
  lawCitedUids: string[];
  guidanceCitedUids: string[];
  sifCitedUids: string[];
  targets: [EvidenceMaterializationTarget, EvidenceMaterializationTarget];
};

export type ResolvedEvidenceControl = {
  controlId: string;
  label: string;
  applicabilityCondition: string;
  lawEvidence: LawEvidenceRecord[];
  guidanceEvidence: KoshaGuidanceRecord[];
  obligation: ControlObligation;
  confirmationQuestion: string;
};

export type EvidenceChainPack = {
  contractVersion: typeof EVIDENCE_CHAIN_CONTRACT_VERSION;
  chainId: EvidenceChainDefinition["chainId"];
  chainLabel: string;
  task: {
    nodeId: string;
    label: string;
    input: string;
    match: "canonical" | "alias";
    publicationState: "published";
  };
  hazard: {
    nodeId: string;
    label: string;
    authority: "published_graph";
  };
  hazardPriority: SifEvidenceRecord[];
  reviewOnlyEvidence: SifEvidenceRecord[];
  guidance: KoshaGuidanceRecord[];
  law: LawEvidenceRecord[];
  controls: ResolvedEvidenceControl[];
  applicability: {
    authority: "scope_only";
    fieldHistory: string[];
    weather: string[];
  };
  materialization: EvidenceMaterialization[];
  provenance: {
    runtimeGraph: {
      scope: "published_only";
      nodeStates: ReviewState[];
      edgeStates: ReviewState[];
      taskNodeId: string;
      hazardNodeId: string;
    };
    lawLayer: {
      authority: "current_law_validates_mandatedBy";
      effectiveDate: typeof CURRENT_LAW_EFFECTIVE_DATE;
      publishedGraphArticleNodeIds: string[];
      officialCurrentOverlayArticles: string[];
    };
    guidanceOverlay: {
      authority: "technical_guidance_only";
      reviewState: ReviewState;
      resolution: "resolved" | "unresolved";
      launchReady: false;
      bodyMissingCount: number;
      downloadProvenance: "incomplete";
    };
    sifOverlay: typeof SIF_CORPUS_STATE & {
      authority: "hazard_priority_only";
    };
  };
  pipeline: {
    stages: readonly [
      "input",
      "canonical_task_alias_match",
      "published_subgraph",
      "evidence_pack",
      "llm_naturalize_only",
      "quality_check",
      "human_confirm",
    ];
    llmRole: "naturalize_only";
    fixedPackImmutable: true;
    qualityCheckRequired: true;
    humanConfirmationRequired: true;
    providerFallback: "preserve_current_provider_fallback";
  };
};

export type EvidenceChainResolution =
  | {
      resolved: true;
      published: true;
      inferenceState: "verified";
      pack: EvidenceChainPack;
    }
  | {
      resolved: false;
      published: false;
      inferenceState: "unverified";
      reason:
        | "not_registered"
        | "published_task_missing"
        | "published_hazard_missing"
        | "published_law_missing";
      message: string;
      candidateChainId?: EvidenceChainDefinition["chainId"];
      canonicalTaskLabel?: string;
    };

export type EvidenceChainResolveOptions = {
  guidanceResolutions?: Readonly<Record<string, EvidenceReviewStatus>>;
  applicability?: {
    fieldHistory?: readonly string[];
    weather?: readonly string[];
  };
};

export type ResolvedEvidenceCitation = {
  citedUid: string;
  parsed: ParsedCitedUid | null;
};

export type NaturalizedEvidenceChain = {
  fixedPack: EvidenceChainPack;
  naturalizedText: string;
  llmRole: "naturalize_only";
  providerFallback: "preserve_current_provider_fallback";
  qualityCheck: {
    required: true;
    status: "pending";
  };
  humanConfirmation:
    | { required: true; status: "pending" }
    | {
        required: true;
        status: "confirmed";
        reviewerId: string;
        confirmedAt: string;
      };
};

function reviewRequired(statement: string): ControlObligation {
  return {
    classification: "review_required",
    categoricalLegalDuty: false,
    statement,
  };
}

export function classifyControlObligation(
  sources: readonly ControlEvidenceSource[],
): ControlObligation {
  const hasDraftOrUnresolved = sources.some(
    (source) => source.reviewState === "draft" || source.resolution === "unresolved",
  );
  if (hasDraftOrUnresolved) {
    return reviewRequired("미검증 또는 미해결 근거가 포함되어 있어 법적 의무 여부를 확정하지 않고 사람의 검토를 요구합니다.");
  }

  const hasUnpublishedLaw = sources.some(
    (source) => source.sourceType === "law" && source.reviewState !== "published",
  );
  if (hasUnpublishedLaw) {
    return reviewRequired("published 상태의 현행 법령 근거가 없어 법적 의무 여부를 확정하지 않습니다.");
  }

  const hasPublishedLaw = sources.some(
    (source) =>
      source.sourceType === "law" &&
      source.relation === "mandatedBy" &&
      source.reviewState === "published" &&
      source.resolution === "resolved",
  );
  const hasVerifiedGuidance = sources.some(
    (source) =>
      source.sourceType === "kosha_guidance" &&
      (source.reviewState === "verified" || source.reviewState === "published") &&
      source.resolution === "resolved",
  );

  if (hasPublishedLaw && hasVerifiedGuidance) {
    return {
      classification: "statutory_mandate_with_guidance",
      categoricalLegalDuty: true,
      statement: "published 현행 법령의 mandatedBy 근거와 별도의 검증된 KOSHA 기술지침이 함께 확인되었습니다.",
    };
  }
  if (hasPublishedLaw) {
    return {
      classification: "statutory_mandate",
      categoricalLegalDuty: true,
      statement: "published 현행 법령의 mandatedBy 근거가 확인되었습니다.",
    };
  }
  if (hasVerifiedGuidance) {
    return {
      classification: "technical_guidance_only",
      categoricalLegalDuty: false,
      statement: "검증된 KOSHA 기술지침 근거이며 법령상 mandatedBy 근거로 취급하지 않습니다.",
    };
  }
  return {
    classification: "neither",
    categoricalLegalDuty: false,
    statement: "SIF 또는 기타 참고근거만으로 법적 의무나 기술지침 적용을 자동 결정하지 않습니다.",
  };
}

function findDefinition(input: string): {
  definition: EvidenceChainDefinition;
  match: "canonical" | "alias";
} | null {
  const normalizedInput = normalizeLabel(input);
  if (!normalizedInput) return null;
  for (const definition of EVIDENCE_CHAIN_REGISTRY) {
    if (normalizeLabel(definition.canonicalTaskLabel) === normalizedInput) {
      return { definition, match: "canonical" };
    }
    if (definition.aliases.some((alias) => normalizeLabel(alias) === normalizedInput)) {
      return { definition, match: "alias" };
    }
  }
  return null;
}

function publishedRuntimeGraph(graph: OntologyGraph): Pick<OntologyGraph, "nodes" | "edges"> {
  const nodes = graph.nodes.filter((node) => node.review_state === "published");
  const nodeIds = new Set(nodes.map((node) => node.node_id));
  const edges = graph.edges.filter(
    (edge) =>
      edge.review_state === "published" && nodeIds.has(edge.src) && nodeIds.has(edge.dst),
  );
  return { nodes, edges };
}

function applyGuidanceResolution(
  source: KoshaGuidanceRecord,
  resolutions: Readonly<Record<string, EvidenceReviewStatus>> | undefined,
): KoshaGuidanceRecord {
  const override = resolutions?.[source.citedUid];
  return override ? { ...source, ...override } : { ...source, chunk: { ...source.chunk } };
}

function materialize(
  definition: EvidenceChainDefinition,
  controls: readonly ResolvedEvidenceControl[],
  sifEvidence: readonly SifEvidenceRecord[],
): EvidenceMaterialization[] {
  const sifCitedUids = sifEvidence.map((source) => source.citedUid);
  return controls.map((control, index) => {
    const sourceDefinition = definition.controls[index];
    if (!sourceDefinition || sourceDefinition.controlId !== control.controlId) {
      throw new Error(`evidence-chain control order mismatch: ${control.controlId}`);
    }
    return {
      controlId: control.controlId,
      controlLabel: control.label,
      applicabilityCondition: control.applicabilityCondition,
      obligation: control.obligation,
      lawCitedUids: control.lawEvidence.map((source) => source.citedUid),
      guidanceCitedUids: control.guidanceEvidence.map((source) => source.citedUid),
      sifCitedUids: [...sifCitedUids],
      targets: [
        {
          document: "risk_assessment",
          rowOrSection: sourceDefinition.riskAssessmentSection,
          stableKey: `${definition.chainId}:risk-assessment:${control.controlId}`,
        },
        {
          document: "tbm",
          rowOrSection: sourceDefinition.tbmSection,
          stableKey: `${definition.chainId}:tbm:${control.controlId}`,
        },
      ],
    };
  });
}

function requireLaw(articleNo: string): LawEvidenceRecord {
  const source = getLawEvidence(articleNo);
  if (!source) throw new Error(`등록되지 않은 법령 evidence: 제${articleNo}조`);
  return { ...source };
}

function resolveControls(
  definition: EvidenceChainDefinition,
  law: readonly LawEvidenceRecord[],
  guidance: readonly KoshaGuidanceRecord[],
): ResolvedEvidenceControl[] {
  const lawByArticle = new Map(law.map((source) => [source.articleNo, source]));
  const guidanceByItem = new Map(guidance.map((source) => [source.itemId, source]));
  return definition.controls.map((control) => {
    const lawEvidence = control.lawArticles.map((articleNo) => {
      const source = lawByArticle.get(articleNo);
      if (!source) throw new Error(`control ${control.controlId}의 법령 evidence 누락: 제${articleNo}조`);
      return source;
    });
    const guidanceEvidence = control.guidanceItemIds.map((itemId) => {
      const source = guidanceByItem.get(itemId);
      if (!source) throw new Error(`control ${control.controlId}의 KOSHA evidence 누락: ${itemId}`);
      return source;
    });
    return {
      controlId: control.controlId,
      label: control.label,
      applicabilityCondition: control.applicabilityCondition,
      lawEvidence,
      guidanceEvidence,
      obligation: classifyControlObligation([...lawEvidence, ...guidanceEvidence]),
      confirmationQuestion: control.confirmationQuestion,
    };
  });
}

function aggregateGuidanceStatus(guidance: readonly KoshaGuidanceRecord[]): EvidenceReviewStatus {
  if (guidance.some((source) => source.resolution === "unresolved" || source.reviewState === "draft")) {
    return { reviewState: "draft", resolution: "unresolved" };
  }
  if (guidance.every((source) => source.reviewState === "published")) {
    return { reviewState: "published", resolution: "resolved" };
  }
  return { reviewState: "verified", resolution: "resolved" };
}

export function resolveEvidenceChain(
  graph: OntologyGraph,
  input: string,
  options: EvidenceChainResolveOptions = {},
): EvidenceChainResolution {
  const matched = findDefinition(input);
  if (!matched) {
    return {
      resolved: false,
      published: false,
      inferenceState: "unverified",
      reason: "not_registered",
      message: "입력과 정확히 일치하는 Phase A canonical Task 또는 alias가 없어 evidence chain을 게시하지 않습니다.",
    };
  }

  const runtime = publishedRuntimeGraph(graph);
  const task = runtime.nodes.find(
    (node) =>
      node.node_id === matched.definition.canonicalTaskNodeId &&
      node.kind === "Task" &&
      normalizeLabel(node.label) === normalizeLabel(matched.definition.canonicalTaskLabel),
  );
  if (!task) {
    return {
      resolved: false,
      published: false,
      inferenceState: "unverified",
      reason: "published_task_missing",
      message: "canonical Task가 published 부분그래프에 정확히 존재하지 않아 추론 결과를 게시하지 않습니다.",
      candidateChainId: matched.definition.chainId,
      canonicalTaskLabel: matched.definition.canonicalTaskLabel,
    };
  }

  const hazard = runtime.nodes.find(
    (node) => node.node_id === matched.definition.hazard.nodeId && node.kind === "Hazard",
  );
  if (!hazard) {
    return {
      resolved: false,
      published: false,
      inferenceState: "unverified",
      reason: "published_hazard_missing",
      message: "canonical Hazard가 published 부분그래프에 존재하지 않아 evidence chain을 게시하지 않습니다.",
      candidateChainId: matched.definition.chainId,
      canonicalTaskLabel: matched.definition.canonicalTaskLabel,
    };
  }

  const law = matched.definition.lawArticles.map(requireLaw);
  const missingPublishedLaw = law.find(
    (source) =>
      source.layer === "published_graph" &&
      (!source.graphArticleNodeId ||
        !runtime.nodes.some(
          (node) => node.node_id === source.graphArticleNodeId && node.kind === "Article",
        )),
  );
  if (missingPublishedLaw) {
    return {
      resolved: false,
      published: false,
      inferenceState: "unverified",
      reason: "published_law_missing",
      message: `제${missingPublishedLaw.articleNo}조 Article이 published 부분그래프에 없어 evidence chain을 게시하지 않습니다.`,
      candidateChainId: matched.definition.chainId,
      canonicalTaskLabel: matched.definition.canonicalTaskLabel,
    };
  }
  const guidance = matched.definition.guidance.map((source) =>
    applyGuidanceResolution(source, options.guidanceResolutions),
  );
  const controls = resolveControls(matched.definition, law, guidance);
  const hazardPriority = [...matched.definition.sif].sort(
    (left, right) => left.rank - right.rank || left.itemId.localeCompare(right.itemId, "ko"),
  );
  const reviewOnlyEvidence = matched.definition.reviewOnlyEvidence.map((source) => ({ ...source }));
  const guidanceStatus = aggregateGuidanceStatus(guidance);

  const pack: EvidenceChainPack = {
    contractVersion: EVIDENCE_CHAIN_CONTRACT_VERSION,
    chainId: matched.definition.chainId,
    chainLabel: matched.definition.label,
    task: {
      nodeId: task.node_id,
      label: task.label,
      input,
      match: matched.match,
      publicationState: "published",
    },
    hazard: {
      nodeId: hazard.node_id,
      label: matched.definition.hazard.label,
      authority: "published_graph",
    },
    hazardPriority,
    reviewOnlyEvidence,
    guidance,
    law,
    controls,
    applicability: {
      authority: "scope_only",
      fieldHistory: [...(options.applicability?.fieldHistory ?? [])],
      weather: [...(options.applicability?.weather ?? [])],
    },
    materialization: [],
    provenance: {
      runtimeGraph: {
        scope: "published_only",
        nodeStates: ["published"],
        edgeStates: ["published"],
        taskNodeId: task.node_id,
        hazardNodeId: hazard.node_id,
      },
      lawLayer: {
        authority: "current_law_validates_mandatedBy",
        effectiveDate: CURRENT_LAW_EFFECTIVE_DATE,
        publishedGraphArticleNodeIds: law.flatMap((source) =>
          source.graphArticleNodeId ? [source.graphArticleNodeId] : [],
        ),
        officialCurrentOverlayArticles: law
          .filter((source) => source.layer === "official_current_overlay")
          .map((source) => source.articleNo),
      },
      guidanceOverlay: {
        authority: "technical_guidance_only",
        reviewState: guidanceStatus.reviewState,
        resolution: guidanceStatus.resolution,
        launchReady: KOSHA_CORPUS_STATE.launchReady,
        bodyMissingCount: KOSHA_CORPUS_STATE.bodyMissingCount,
        downloadProvenance: KOSHA_CORPUS_STATE.downloadProvenance,
      },
      sifOverlay: {
        ...SIF_CORPUS_STATE,
        authority: "hazard_priority_only",
      },
    },
    pipeline: {
      stages: [
        "input",
        "canonical_task_alias_match",
        "published_subgraph",
        "evidence_pack",
        "llm_naturalize_only",
        "quality_check",
        "human_confirm",
      ],
      llmRole: "naturalize_only",
      fixedPackImmutable: true,
      qualityCheckRequired: true,
      humanConfirmationRequired: true,
      providerFallback: "preserve_current_provider_fallback",
    },
  };
  pack.materialization = materialize(matched.definition, controls, hazardPriority);

  return {
    resolved: true,
    published: true,
    inferenceState: "verified",
    pack,
  };
}

export function resolveEvidenceCitations(pack: EvidenceChainPack): ResolvedEvidenceCitation[] {
  const citedUids = new Set<string>();
  for (const source of [...pack.hazardPriority, ...pack.reviewOnlyEvidence]) {
    citedUids.add(source.citedUid);
  }
  for (const source of pack.guidance) {
    citedUids.add(source.citedUid);
    if (source.chunk.chunkCitedUid) citedUids.add(source.chunk.chunkCitedUid);
  }
  for (const source of pack.law) citedUids.add(source.citedUid);
  return Array.from(citedUids)
    .sort((left, right) => left.localeCompare(right, "ko"))
    .map((citedUid) => ({ citedUid, parsed: parseCitedUid(citedUid) }));
}

export function naturalizeEvidenceChain(
  fixedPack: EvidenceChainPack,
  naturalizedText: string,
): NaturalizedEvidenceChain {
  return {
    fixedPack,
    naturalizedText,
    llmRole: "naturalize_only",
    providerFallback: "preserve_current_provider_fallback",
    qualityCheck: { required: true, status: "pending" },
    humanConfirmation: { required: true, status: "pending" },
  };
}

export function confirmNaturalizedEvidenceChain(
  naturalized: NaturalizedEvidenceChain,
  confirmation: { reviewerId: string; confirmedAt: string },
): NaturalizedEvidenceChain {
  const reviewerId = confirmation.reviewerId.trim();
  const confirmedAt = confirmation.confirmedAt.trim();
  if (!reviewerId || !confirmedAt) {
    throw new Error("human confirmation에는 reviewerId와 confirmedAt이 필요합니다.");
  }
  return {
    ...naturalized,
    humanConfirmation: {
      required: true,
      status: "confirmed",
      reviewerId,
      confirmedAt,
    },
  };
}
