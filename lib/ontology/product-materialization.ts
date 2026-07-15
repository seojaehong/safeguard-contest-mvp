import type { AskResponse } from "@/lib/types";
import { attachGenerationEvidence } from "@/lib/generation-evidence";
import type { RiskAssessmentRow } from "@/lib/risk-assessment-schema";
import { validateRiskAssessmentRows } from "@/lib/risk-assessment-schema";
import type {
  ActiveEvidenceChainPack,
  EvidenceMaterialization,
  ObligationClassification,
  ResolvedEvidenceControl,
} from "@/lib/ontology/evidence-chain";

export type PhaseAEvidenceChainState =
  | "resolved"
  | "review_required"
  | "unverified"
  | "not_registered"
  | "not_evaluated";

export type PhaseAProductAuthorityState = "verified" | "review_required";

export type PhaseAProductProvenance = {
  taskNodeId: string;
  sifAccidentCitedUids: string[];
  hazardNodeId: string;
  controlNodeId: string;
  koshaGuidanceCitedUids: string[];
  lawRelation: "mandatedBy";
  lawCitedUids: string[];
  articleNodeIds: string[];
};

export type PhaseAProductControl = {
  controlId: string;
  nodeId: string;
  label: string;
  applicabilityCondition: string;
  sourceClassification: ObligationClassification;
  classification: ObligationClassification;
  authorityState: PhaseAProductAuthorityState;
  provenance: PhaseAProductProvenance;
};

export type PhaseAProductDocumentRow = {
  stableKey: string;
  document: "risk_assessment" | "tbm";
  rowOrSection: string;
  controlId: string;
  controlLabel: string;
  classification: ObligationClassification;
  verificationStatus: PhaseAProductAuthorityState;
  provenance: PhaseAProductProvenance;
};

export type PhaseAProductMaterialization = {
  schemaVersion: "phase-a-product-materialization/v1";
  chainId: ActiveEvidenceChainPack["chainId"];
  reportedEvidenceChainState: PhaseAEvidenceChainState;
  evidenceChainState: "resolved" | "review_required";
  authorityState: PhaseAProductAuthorityState;
  outputStatus: "grounded_draft" | "review_required_draft";
  task: ActiveEvidenceChainPack["task"];
  accidents: ActiveEvidenceChainPack["hazardPriority"];
  hazard: ActiveEvidenceChainPack["hazard"];
  controls: PhaseAProductControl[];
  documentRows: PhaseAProductDocumentRow[];
  verifiedDocumentRows: PhaseAProductDocumentRow[];
  coverage: {
    expectedDocumentRows: number;
    materializedDocumentRows: number;
    verifiedDocumentRows: number;
  };
  humanConfirmation: {
    required: true;
    status: "pending";
  };
};

type BuildPhaseAProductMaterializationInput = {
  evidenceChainState: PhaseAEvidenceChainState;
  evidencePack: ActiveEvidenceChainPack | null;
};

function isResolvedReviewState(source: { reviewState: string; resolution: string }): boolean {
  return (
    (source.reviewState === "verified" || source.reviewState === "published") &&
    source.resolution === "resolved"
  );
}

function isPublishedLaw(source: ResolvedEvidenceControl["lawEvidence"][number]): boolean {
  return (
    source.sourceType === "law" &&
    source.relation === "mandatedBy" &&
    source.reviewState === "published" &&
    source.resolution === "resolved" &&
    Boolean(source.graphArticleNodeId)
  );
}

function sameStrings(actual: readonly string[], expected: readonly string[]): boolean {
  return (
    actual.length === expected.length &&
    actual.every((value, index) => value === expected[index])
  );
}

function hasExactMaterializationPlan(
  control: ResolvedEvidenceControl,
  plan: EvidenceMaterialization,
  pack: ActiveEvidenceChainPack,
): boolean {
  const expectedTargets = [
    `${pack.chainId}:risk-assessment:${control.controlId}`,
    `${pack.chainId}:tbm:${control.controlId}`,
  ];
  return (
    plan.controlId === control.controlId &&
    plan.controlLabel === control.label &&
    plan.applicabilityCondition === control.applicabilityCondition &&
    plan.obligation.classification === control.obligation.classification &&
    sameStrings(plan.sifCitedUids, pack.hazardPriority.map((source) => source.citedUid)) &&
    sameStrings(plan.lawCitedUids, control.lawEvidence.map((source) => source.citedUid)) &&
    sameStrings(
      plan.guidanceCitedUids,
      control.guidanceEvidence.map((source) => source.citedUid),
    ) &&
    sameStrings(plan.targets.map((target) => target.stableKey), expectedTargets) &&
    plan.targets[0]?.document === "risk_assessment" &&
    plan.targets[1]?.document === "tbm"
  );
}

function hasRequiredControlEvidence(
  control: ResolvedEvidenceControl,
  plan: EvidenceMaterialization,
): boolean {
  const lawReady =
    plan.lawCitedUids.length > 0 &&
    control.lawEvidence.length === plan.lawCitedUids.length &&
    control.lawEvidence.every(isPublishedLaw);
  const guidanceReady =
    plan.guidanceCitedUids.length > 0 &&
    control.guidanceStatus === "verified" &&
    !control.guidanceReviewRequired &&
    control.guidanceEvidence.length === plan.guidanceCitedUids.length &&
    control.guidanceEvidence.every(isResolvedReviewState);

  switch (control.obligation.classification) {
    case "statutory_mandate":
      return lawReady;
    case "technical_guidance_only":
      return guidanceReady;
    case "statutory_mandate_with_guidance":
      return lawReady && guidanceReady;
    case "review_required":
      return false;
  }
}

function hasAuthoritativeEvidence(
  state: PhaseAEvidenceChainState,
  pack: ActiveEvidenceChainPack,
): boolean {
  if (state !== "resolved") return false;
  if (pack.task.publicationState !== "published" || pack.hazard.authority !== "published_graph") {
    return false;
  }
  if (
    pack.hazardPriority.length === 0 ||
    !pack.hazardPriority.every(isResolvedReviewState) ||
    pack.law.some((source) => !isPublishedLaw(source)) ||
    pack.guidance.some((source) => !isResolvedReviewState(source)) ||
    pack.controls.length === 0 ||
    pack.controls.length !== pack.materialization.length
  ) {
    return false;
  }

  const stableKeys = new Set<string>();
  return pack.controls.every((control, index) => {
    const plan = pack.materialization[index];
    if (
      !plan ||
      !hasExactMaterializationPlan(control, plan, pack) ||
      !hasRequiredControlEvidence(control, plan)
    ) {
      return false;
    }
    for (const target of plan.targets) {
      if (stableKeys.has(target.stableKey)) return false;
      stableKeys.add(target.stableKey);
    }
    return true;
  });
}

function buildProvenance(
  pack: ActiveEvidenceChainPack,
  control: ResolvedEvidenceControl,
): PhaseAProductProvenance {
  return {
    taskNodeId: pack.task.nodeId,
    sifAccidentCitedUids: pack.hazardPriority.map((source) => source.citedUid),
    hazardNodeId: pack.hazard.nodeId,
    controlNodeId: control.graphControlNodeId,
    koshaGuidanceCitedUids: control.guidanceEvidence.map((source) => source.citedUid),
    lawRelation: "mandatedBy",
    lawCitedUids: control.lawEvidence.map((source) => source.citedUid),
    articleNodeIds: control.lawEvidence.flatMap((source) =>
      source.graphArticleNodeId ? [source.graphArticleNodeId] : [],
    ),
  };
}

export function buildPhaseAProductMaterialization(
  input: BuildPhaseAProductMaterializationInput,
): PhaseAProductMaterialization | null {
  if (!input.evidencePack) return null;

  const pack = input.evidencePack;
  const authoritative = hasAuthoritativeEvidence(input.evidenceChainState, pack);
  const authorityState: PhaseAProductAuthorityState = authoritative ? "verified" : "review_required";
  const controls = pack.controls.map((control): PhaseAProductControl => ({
    controlId: control.controlId,
    nodeId: control.graphControlNodeId,
    label: control.label,
    applicabilityCondition: control.applicabilityCondition,
    sourceClassification: control.obligation.classification,
    classification: authoritative ? control.obligation.classification : "review_required",
    authorityState,
    provenance: buildProvenance(pack, control),
  }));
  const controlsById = new Map(controls.map((control) => [control.controlId, control]));
  const documentRows = pack.materialization.flatMap((plan) => {
    const control = controlsById.get(plan.controlId);
    if (!control) return [];
    return plan.targets.map((target): PhaseAProductDocumentRow => ({
      stableKey: target.stableKey,
      document: target.document,
      rowOrSection: target.rowOrSection,
      controlId: control.controlId,
      controlLabel: control.label,
      classification: control.classification,
      verificationStatus: authorityState,
      provenance: control.provenance,
    }));
  });
  const verifiedDocumentRows = authoritative ? documentRows : [];

  return {
    schemaVersion: "phase-a-product-materialization/v1",
    chainId: pack.chainId,
    reportedEvidenceChainState: input.evidenceChainState,
    evidenceChainState: authoritative ? "resolved" : "review_required",
    authorityState,
    outputStatus: authoritative ? "grounded_draft" : "review_required_draft",
    task: pack.task,
    accidents: pack.hazardPriority,
    hazard: pack.hazard,
    controls,
    documentRows,
    verifiedDocumentRows,
    coverage: {
      expectedDocumentRows: pack.controls.length * 2,
      materializedDocumentRows: documentRows.length,
      verifiedDocumentRows: verifiedDocumentRows.length,
    },
    humanConfirmation: { required: true, status: "pending" },
  };
}

function rowBlock(row: PhaseAProductDocumentRow): string {
  const stateLabel = row.verificationStatus === "verified" ? "근거 연결 검증됨" : "검토 필요";
  const guidance = row.provenance.koshaGuidanceCitedUids.length > 0
    ? row.provenance.koshaGuidanceCitedUids.join(", ")
    : "현장 확인 필요";
  const path = [
    `Task(${row.provenance.taskNodeId})`,
    `SIF/Accident(${row.provenance.sifAccidentCitedUids.join(", ")})`,
    `Hazard(${row.provenance.hazardNodeId})`,
    `KOSHA Control(${row.provenance.controlNodeId}: ${row.controlLabel})`,
    `mandatedBy Article(${row.provenance.articleNodeIds.join(", ")})`,
  ].join(" -> ");
  return [
    `[${row.rowOrSection}]`,
    `stableKey: ${row.stableKey}`,
    `상태: ${stateLabel}`,
    `분류: ${row.classification}`,
    `근거 경로: ${path}`,
    `SIF/Accident UID: ${row.provenance.sifAccidentCitedUids.join(", ")}`,
    `KOSHA guidance UID: ${guidance}`,
    `mandatedBy law UID: ${row.provenance.lawCitedUids.join(", ")}`,
    "사람 확인: pending",
  ].join("\n");
}

function prependMissingRows(
  document: string,
  rows: readonly PhaseAProductDocumentRow[],
): string {
  const missing = rows.filter((row) => !document.includes(`stableKey: ${row.stableKey}`));
  if (missing.length === 0) return document;
  const prefix = missing.map(rowBlock).join("\n\n");
  return document.trim().length > 0 ? `${prefix}\n\n${document}` : prefix;
}

function accidentTypeForChain(
  chainId: PhaseAProductMaterialization["chainId"],
): RiskAssessmentRow["accidentType"] {
  switch (chainId) {
    case "work-at-height-fall":
      return "fall";
    case "vehicle-machinery-entrapment":
      return "caughtIn";
    case "electrical-work-electrocution":
      return "electricShock";
  }
}

function fourMForChain(
  chainId: PhaseAProductMaterialization["chainId"],
): RiskAssessmentRow["fourM"] {
  return chainId === "work-at-height-fall" ? "Media" : "Machine";
}

function buildRiskRow(
  response: AskResponse,
  product: PhaseAProductMaterialization,
  documentRow: PhaseAProductDocumentRow,
): RiskAssessmentRow {
  const stableReference = `phase-a-stable-key:${documentRow.stableKey}`;
  return {
    location: response.scenario.siteName || "현장 확인",
    process: product.task.label,
    task: product.task.label,
    equipment: "현장 확인",
    hazard: product.hazard.label,
    fourM: fourMForChain(product.chainId),
    accidentType: accidentTypeForChain(product.chainId),
    currentControls: "현장 확인 필요",
    likelihood: 3,
    severity: 4,
    riskLevel: "high",
    additionalControls: `${documentRow.controlLabel} / 적용조건: ${
      product.controls.find((control) => control.controlId === documentRow.controlId)
        ?.applicabilityCondition || "현장 확인 필요"
    }`,
    owner: "현장 책임자",
    due: "현장 확인",
    verification: `${documentRow.verificationStatus}: ${documentRow.stableKey}`,
    verificationStatus: documentRow.verificationStatus === "verified" ? "planned" : "needsReview",
    verificationDate: "현장 확인",
    verificationChecker: "현장 확인",
    whyLikelihood: "SIF/Accident 위험 우선순위 근거를 반영하고 현장 빈도를 확인해야 합니다.",
    whySeverity: "중대재해 가능 위험으로 보수적으로 평가하며 사람의 확인이 필요합니다.",
    evidenceRefs: [
      stableReference,
      documentRow.provenance.taskNodeId,
      ...documentRow.provenance.sifAccidentCitedUids,
      documentRow.provenance.hazardNodeId,
      documentRow.provenance.controlNodeId,
      ...documentRow.provenance.koshaGuidanceCitedUids,
      ...documentRow.provenance.lawCitedUids,
      ...documentRow.provenance.articleNodeIds,
    ],
  };
}

export function materializePhaseAProductDocuments(
  response: AskResponse,
  product: PhaseAProductMaterialization,
  options: { generationEvidenceSecret?: string } = {},
): AskResponse {
  const riskRows = product.documentRows.filter((row) => row.document === "risk_assessment");
  const tbmRows = product.documentRows.filter((row) => row.document === "tbm");
  const existingRiskRows = response.structured?.riskAssessmentRows ?? [];
  const existingStableKeys = new Set(
    existingRiskRows.flatMap((row) =>
      row.evidenceRefs
        .filter((reference) => reference.startsWith("phase-a-stable-key:"))
        .map((reference) => reference.slice("phase-a-stable-key:".length)),
    ),
  );
  const appendedRiskRows = riskRows
    .filter((row) => !existingStableKeys.has(row.stableKey))
    .map((row) => buildRiskRow(response, product, row));
  const structuredRows = [...existingRiskRows, ...appendedRiskRows];
  const validation = validateRiskAssessmentRows(structuredRows);

  const materialized: AskResponse = {
    ...response,
    deliverables: {
      ...response.deliverables,
      riskAssessmentDraft: prependMissingRows(response.deliverables.riskAssessmentDraft, riskRows),
      tbmBriefing: prependMissingRows(response.deliverables.tbmBriefing, tbmRows),
    },
    structured: {
      ...response.structured,
      riskAssessmentRows: structuredRows,
      riskAssessmentValidation: {
        ok: validation.ok,
        issueCount: validation.issues.length,
        issues: validation.issues,
      },
    },
    phaseAProduct: product,
  };
  const generatedAt = response.generationEvidence?.snapshot.generatedAt;
  return generatedAt
    ? attachGenerationEvidence(materialized, {
        secret: options.generationEvidenceSecret,
        generatedAt,
      })
    : materialized;
}
