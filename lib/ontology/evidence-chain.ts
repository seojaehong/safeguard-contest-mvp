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

export type EvidenceMaterializationPlan = {
  controlId: string;
  controlLabel: string;
  applicabilityCondition: string;
  obligation: ControlObligation;
  lawCitedUids: string[];
  guidanceCitedUids: string[];
  guidanceStatus: "missing" | "unresolved" | "verified";
  guidanceReviewRequired: boolean;
  guidanceProvenance: Array<{
    itemCitedUid: string;
    productionItemId: string;
    snapshotItemId: string;
    chunkId: string;
    chunkSha256: string;
    page: number;
    location: string;
    bridgeResolution: "unresolved";
  }>;
  sifCitedUids: string[];
  targets: [EvidenceMaterializationTarget, EvidenceMaterializationTarget];
};

export type EvidenceMaterializationDocumentKey =
  | "riskAssessmentDraft"
  | "tbmBriefing"
  | "tbmLogDraft";

export type EvidenceMaterializationRecord = {
  materialized: true;
  stableKey: string;
  controlId: string;
  controlLabel: string;
  documentKey: EvidenceMaterializationDocumentKey;
  plannedLocation: string;
  citedUids: string[];
  location: {
    kind: "line";
    lineNumber: number;
    excerpt: string;
  };
};

export type ResolvedEvidenceControl = {
  controlId: string;
  graphControlNodeId: string;
  label: string;
  applicabilityCondition: string;
  lawEvidence: LawEvidenceRecord[];
  guidanceEvidence: KoshaGuidanceRecord[];
  guidanceStatus: "missing" | "unresolved" | "verified";
  guidanceReviewRequired: boolean;
  obligation: ControlObligation;
  confirmationQuestion: string;
};

export type EvidenceChainPack = {
  contractVersion: typeof EVIDENCE_CHAIN_CONTRACT_VERSION;
  assemblyTrace: EvidenceAssemblyStage[];
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
  reviewOnlyGuidance: KoshaGuidanceRecord[];
  law: LawEvidenceRecord[];
  controls: ResolvedEvidenceControl[];
  applicability: {
    authority: "scope_only";
    fieldHistory: string[];
    weather: string[];
  };
  materializationTargets: EvidenceMaterializationPlan[];
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
      productionChunkBridge: "absent";
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
      graphPublicationState: "published";
      inferenceState: "verified";
      pack: EvidenceChainPack;
    }
  | {
      resolved: false;
      published: false;
      graphPublicationState: "published";
      inferenceState: "review_required";
      reason: "evidence_chain_review_required";
      message: string;
      pack: EvidenceChainPack;
    }
  | {
      resolved: false;
      published: false;
      graphPublicationState: "unverified";
      inferenceState: "unverified";
      reason:
        | "not_registered"
        | "published_task_missing"
        | "published_hazard_missing"
        | "published_law_missing"
        | "published_control_missing"
        | "published_task_hazard_edge_missing"
        | "published_hazard_control_edge_missing"
        | "published_control_law_edge_missing";
      message: string;
      candidateChainId?: EvidenceChainDefinition["chainId"];
      canonicalTaskLabel?: string;
    };

export type EvidenceChainResolveOptions = {
  guidanceResolutions?: Readonly<Record<string, EvidenceReviewStatus>>;
  onAssemblyStage?: (stage: EvidenceAssemblyStage) => void;
  applicability?: {
    fieldHistory?: readonly string[];
    weather?: readonly string[];
  };
};

export type EvidenceAssemblyStage =
  | "task_graph"
  | "sif_accident"
  | "kosha_guidance"
  | "current_law";

export type EvidenceChainState =
  | "resolved"
  | "review_required"
  | "unverified"
  | "not_registered"
  | "not_evaluated";

export type ResolvedEvidenceCitation = {
  citedUid: string;
  parsed: ParsedCitedUid | null;
};

export type ActiveEvidenceChainPack = Omit<
  EvidenceChainPack,
  "reviewOnlyEvidence" | "reviewOnlyGuidance"
>;

export type EvidenceChainDiagnostics = Pick<
  EvidenceChainPack,
  "reviewOnlyEvidence" | "reviewOnlyGuidance"
>;

export type NaturalizerEvidencePack = ActiveEvidenceChainPack;

export type NaturalizedEvidenceChain = {
  fixedPack: NaturalizerEvidencePack;
  reviewOnlyEvidence: SifEvidenceRecord[];
  reviewOnlyGuidance: KoshaGuidanceRecord[];
  naturalizedText: string;
  llmRole: "naturalize_only";
  providerFallback: "preserve_current_provider_fallback";
  qualityCheck: {
    required: true;
    status: "pending" | "passed" | "failed";
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
  return reviewRequired(
    "SIF 또는 기타 참고근거만으로 법적 의무나 기술지침 적용을 자동 결정하지 않고 사람의 검토를 요구합니다.",
  );
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
  const clone = { ...source, chunk: { ...source.chunk } };
  const corpusBlocked =
    !KOSHA_CORPUS_STATE.launchReady ||
    KOSHA_CORPUS_STATE.bodyMissingCount > 0 ||
    KOSHA_CORPUS_STATE.downloadProvenance === "incomplete" ||
    KOSHA_CORPUS_STATE.productionChunkBridge === "absent";
  if (corpusBlocked) {
    return { ...clone, reviewState: "draft", resolution: "unresolved" };
  }
  const override = resolutions?.[source.citedUid];
  return override ? { ...clone, ...override } : clone;
}

function planMaterializationTargets(
  definition: EvidenceChainDefinition,
  controls: readonly ResolvedEvidenceControl[],
  sifEvidence: readonly SifEvidenceRecord[],
): EvidenceMaterializationPlan[] {
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
      guidanceStatus: control.guidanceStatus,
      guidanceReviewRequired: control.guidanceReviewRequired,
      guidanceProvenance: control.guidanceEvidence.map((source) => ({
        itemCitedUid: source.citedUid,
        productionItemId: source.productionItemId,
        snapshotItemId: source.itemId,
        chunkId: source.chunk.chunkId,
        chunkSha256: source.chunk.chunkSha256,
        page: source.chunk.page,
        location: source.chunk.location,
        bridgeResolution: source.provenanceBridge,
      })),
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

const MATERIALIZATION_DOCUMENT_KEYS: Readonly<
  Record<EvidenceMaterializationTarget["document"], readonly EvidenceMaterializationDocumentKey[]>
> = {
  risk_assessment: ["riskAssessmentDraft"],
  tbm: ["tbmBriefing", "tbmLogDraft"],
};

export function verifyEvidenceMaterialization(input: {
  evidenceChainState: EvidenceChainState;
  pack: Pick<EvidenceChainPack, "materializationTargets">;
  documents: Partial<Record<EvidenceMaterializationDocumentKey, string>>;
}): EvidenceMaterializationRecord[] {
  if (input.evidenceChainState !== "resolved") return [];

  const records: EvidenceMaterializationRecord[] = [];
  for (const plan of input.pack.materializationTargets) {
    if (plan.obligation.classification === "review_required") continue;
    const plannedCitedUids = [
      ...plan.lawCitedUids,
      ...plan.guidanceCitedUids,
      ...plan.sifCitedUids,
    ];
    for (const target of plan.targets) {
      for (const documentKey of MATERIALIZATION_DOCUMENT_KEYS[target.document]) {
        const document = input.documents[documentKey];
        if (!document) continue;
        const lines = document.split(/\r?\n/);
        for (const [index, rawLine] of lines.entries()) {
          const line = rawLine.normalize("NFC");
          if (!line.includes(plan.controlLabel.normalize("NFC"))) continue;
          const citedUids = plannedCitedUids.filter((citedUid) => line.includes(citedUid));
          if (citedUids.length === 0) continue;
          records.push({
            materialized: true,
            stableKey: target.stableKey,
            controlId: plan.controlId,
            controlLabel: plan.controlLabel,
            documentKey,
            plannedLocation: target.rowOrSection,
            citedUids,
            location: {
              kind: "line",
              lineNumber: index + 1,
              excerpt: rawLine.trim(),
            },
          });
          break;
        }
      }
    }
  }
  return records;
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
  const guidanceByEvidenceId = new Map(guidance.map((source) => [source.evidenceId, source]));
  return definition.controls.map((control) => {
    const lawEvidence = control.lawArticles.map((articleNo) => {
      const source = lawByArticle.get(articleNo);
      if (!source) throw new Error(`control ${control.controlId}의 법령 evidence 누락: 제${articleNo}조`);
      return source;
    });
    const guidanceEvidence = control.guidanceEvidenceIds.map((evidenceId) => {
      const source = guidanceByEvidenceId.get(evidenceId);
      if (!source) throw new Error(`control ${control.controlId}의 KOSHA evidence 누락: ${evidenceId}`);
      return source;
    });
    const guidanceStatus = guidanceEvidence.length === 0
      ? "missing"
      : guidanceEvidence.some(
          (source) => source.reviewState === "draft" || source.resolution === "unresolved",
        )
        ? "unresolved"
        : "verified";
    return {
      controlId: control.controlId,
      graphControlNodeId: control.graphControlNodeId,
      label: control.label,
      applicabilityCondition: control.applicabilityCondition,
      lawEvidence,
      guidanceEvidence,
      guidanceStatus,
      guidanceReviewRequired: guidanceStatus !== "verified",
      obligation: classifyControlObligation([...lawEvidence, ...guidanceEvidence]),
      confirmationQuestion: control.confirmationQuestion,
    };
  });
}

function aggregateGuidanceStatus(guidance: readonly KoshaGuidanceRecord[]): EvidenceReviewStatus {
  if (
    !KOSHA_CORPUS_STATE.launchReady ||
    KOSHA_CORPUS_STATE.bodyMissingCount > 0 ||
    KOSHA_CORPUS_STATE.downloadProvenance === "incomplete" ||
    KOSHA_CORPUS_STATE.productionChunkBridge === "absent"
  ) {
    return { reviewState: "draft", resolution: "unresolved" };
  }
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
      graphPublicationState: "unverified",
      inferenceState: "unverified",
      reason: "not_registered",
      message: "입력과 정확히 일치하는 Phase A canonical Task 또는 alias가 없어 evidence chain을 게시하지 않습니다.",
    };
  }

  const assemblyTrace: EvidenceAssemblyStage[] = [];
  const recordAssemblyStage = (stage: EvidenceAssemblyStage): void => {
    assemblyTrace.push(stage);
    options.onAssemblyStage?.(stage);
  };

  recordAssemblyStage("task_graph");
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
      graphPublicationState: "unverified",
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
      graphPublicationState: "unverified",
      inferenceState: "unverified",
      reason: "published_hazard_missing",
      message: "canonical Hazard가 published 부분그래프에 존재하지 않아 evidence chain을 게시하지 않습니다.",
      candidateChainId: matched.definition.chainId,
      canonicalTaskLabel: matched.definition.canonicalTaskLabel,
    };
  }

  const hasTaskHazardEdge = runtime.edges.some(
    (edge) =>
      edge.src === task.node_id &&
      edge.rel === "entailsHazard" &&
      edge.dst === hazard.node_id,
  );
  if (!hasTaskHazardEdge) {
    return {
      resolved: false,
      published: false,
      graphPublicationState: "unverified",
      inferenceState: "unverified",
      reason: "published_task_hazard_edge_missing",
      message: "canonical Task-entailsHazard-Hazard published 간선이 없어 evidence chain을 게시하지 않습니다.",
      candidateChainId: matched.definition.chainId,
      canonicalTaskLabel: matched.definition.canonicalTaskLabel,
    };
  }

  for (const controlDefinition of matched.definition.controls) {
    const controlNode = runtime.nodes.find(
      (node) =>
        node.node_id === controlDefinition.graphControlNodeId && node.kind === "Control",
    );
    if (!controlNode) {
      return {
        resolved: false,
        published: false,
        graphPublicationState: "unverified",
        inferenceState: "unverified",
        reason: "published_control_missing",
        message: `${controlDefinition.controlId} Control이 published 부분그래프에 없어 evidence chain을 게시하지 않습니다.`,
        candidateChainId: matched.definition.chainId,
        canonicalTaskLabel: matched.definition.canonicalTaskLabel,
      };
    }
    const hasHazardControlEdge = runtime.edges.some(
      (edge) =>
        edge.src === hazard.node_id &&
        edge.rel === "mitigatedBy" &&
        edge.dst === controlNode.node_id,
    );
    if (!hasHazardControlEdge) {
      return {
        resolved: false,
        published: false,
        graphPublicationState: "unverified",
        inferenceState: "unverified",
        reason: "published_hazard_control_edge_missing",
        message: `${controlDefinition.controlId}의 Hazard-mitigatedBy-Control published 간선이 없어 evidence chain을 게시하지 않습니다.`,
        candidateChainId: matched.definition.chainId,
        canonicalTaskLabel: matched.definition.canonicalTaskLabel,
      };
    }
  }

  recordAssemblyStage("sif_accident");
  const hazardPriority = [...matched.definition.sif].sort(
    (left, right) => left.rank - right.rank || left.itemId.localeCompare(right.itemId, "ko"),
  );
  const reviewOnlyEvidence = matched.definition.reviewOnlyEvidence.map((source) => ({ ...source }));

  recordAssemblyStage("kosha_guidance");
  const allGuidance = matched.definition.guidance.map((source) =>
    applyGuidanceResolution(source, options.guidanceResolutions),
  );
  const guidance = allGuidance.filter((source) => source.registryMapping === "mapped");
  const reviewOnlyGuidance = allGuidance.filter((source) => source.registryMapping !== "mapped");
  const guidanceStatus = aggregateGuidanceStatus(guidance);

  recordAssemblyStage("current_law");
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
      graphPublicationState: "unverified",
      inferenceState: "unverified",
      reason: "published_law_missing",
      message: `제${missingPublishedLaw.articleNo}조 Article이 published 부분그래프에 없어 evidence chain을 게시하지 않습니다.`,
      candidateChainId: matched.definition.chainId,
      canonicalTaskLabel: matched.definition.canonicalTaskLabel,
    };
  }
  for (const controlDefinition of matched.definition.controls) {
    for (const articleNo of controlDefinition.lawArticles) {
      const lawSource = law.find((source) => source.articleNo === articleNo);
      const hasControlLawEdge = lawSource?.graphArticleNodeId
        ? runtime.edges.some(
            (edge) =>
              edge.src === controlDefinition.graphControlNodeId &&
              edge.rel === "mandatedBy" &&
              edge.dst === lawSource.graphArticleNodeId,
          )
        : false;
      if (!hasControlLawEdge) {
        return {
          resolved: false,
          published: false,
          graphPublicationState: "unverified",
          inferenceState: "unverified",
          reason: "published_control_law_edge_missing",
          message: `${controlDefinition.controlId}의 Control-mandatedBy-Article 제${articleNo}조 published 간선이 없어 evidence chain을 게시하지 않습니다.`,
          candidateChainId: matched.definition.chainId,
          canonicalTaskLabel: matched.definition.canonicalTaskLabel,
        };
      }
    }
  }
  const controls = resolveControls(matched.definition, law, guidance);

  const pack: EvidenceChainPack = {
    contractVersion: EVIDENCE_CHAIN_CONTRACT_VERSION,
    assemblyTrace: [...assemblyTrace],
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
    reviewOnlyGuidance,
    law,
    controls,
    applicability: {
      authority: "scope_only",
      fieldHistory: [...(options.applicability?.fieldHistory ?? [])],
      weather: [...(options.applicability?.weather ?? [])],
    },
    materializationTargets: planMaterializationTargets(
      matched.definition,
      controls,
      hazardPriority,
    ),
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
        productionChunkBridge: KOSHA_CORPUS_STATE.productionChunkBridge,
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
  if (guidanceStatus.resolution === "unresolved") {
    return {
      resolved: false,
      published: false,
      graphPublicationState: "published",
      inferenceState: "review_required",
      reason: "evidence_chain_review_required",
      message:
        "published 그래프 경로는 확인되었으나 KOSHA production/local provenance bridge 또는 corpus gate가 미해결이어서 조립된 evidence chain을 게시하지 않습니다.",
      pack,
    };
  }

  return {
    resolved: true,
    published: true,
    graphPublicationState: "published",
    inferenceState: "verified",
    pack,
  };
}

export function resolveEvidenceCitations(pack: EvidenceChainPack): ResolvedEvidenceCitation[] {
  const citedUids = new Set<string>();
  for (const source of pack.hazardPriority) citedUids.add(source.citedUid);
  for (const source of pack.guidance) {
    citedUids.add(source.citedUid);
  }
  for (const source of pack.law) citedUids.add(source.citedUid);
  return Array.from(citedUids)
    .sort((left, right) => left.localeCompare(right, "ko"))
    .map((citedUid) => ({ citedUid, parsed: parseCitedUid(citedUid) }));
}

function deepFreeze(value: unknown): void {
  if (typeof value !== "object" || value === null || Object.isFrozen(value)) return;
  for (const key of Reflect.ownKeys(value)) {
    deepFreeze(Reflect.get(value, key));
  }
  Object.freeze(value);
}

function immutableClone<Value>(value: Value): Value {
  const clone = structuredClone(value);
  deepFreeze(clone);
  return clone;
}

export function splitEvidenceChainPack(fixedPack: EvidenceChainPack): {
  activePack: ActiveEvidenceChainPack;
  diagnostics: EvidenceChainDiagnostics;
} {
  const { reviewOnlyEvidence, reviewOnlyGuidance, ...activePack } = fixedPack;
  return {
    activePack,
    diagnostics: { reviewOnlyEvidence, reviewOnlyGuidance },
  };
}

export function naturalizeEvidenceChain(
  fixedPack: EvidenceChainPack,
  naturalizedText: string,
): NaturalizedEvidenceChain {
  const { activePack, diagnostics } = splitEvidenceChainPack(fixedPack);
  return {
    fixedPack: immutableClone(activePack),
    reviewOnlyEvidence: immutableClone(diagnostics.reviewOnlyEvidence),
    reviewOnlyGuidance: immutableClone(diagnostics.reviewOnlyGuidance),
    naturalizedText,
    llmRole: "naturalize_only",
    providerFallback: "preserve_current_provider_fallback",
    qualityCheck: { required: true, status: "pending" },
    humanConfirmation: { required: true, status: "pending" },
  };
}

export function recordNaturalizedEvidenceChainQuality(
  naturalized: NaturalizedEvidenceChain,
  status: "passed" | "failed",
): NaturalizedEvidenceChain {
  return {
    ...naturalized,
    qualityCheck: { required: true, status },
    humanConfirmation:
      status === "failed"
        ? { required: true, status: "pending" }
        : naturalized.humanConfirmation,
  };
}

export function confirmNaturalizedEvidenceChain(
  naturalized: NaturalizedEvidenceChain,
  confirmation: { reviewerId: string; confirmedAt: string },
): NaturalizedEvidenceChain {
  if (naturalized.qualityCheck.status !== "passed") {
    throw new Error("human confirmation 전에 quality check status가 passed여야 합니다.");
  }
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
