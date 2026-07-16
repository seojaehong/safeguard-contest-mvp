import { attachGenerationEvidence } from "@/lib/generation-evidence";
import {
  validateCanonicalEvidenceChainPack,
  type ActiveEvidenceChainPack,
  type ObligationClassification,
} from "@/lib/ontology/evidence-chain";
import { validateRiskAssessmentRows, type RiskAssessmentRow } from "@/lib/risk-assessment-schema";
import type { AskResponse } from "@/lib/types";

export type PhaseAProductAuthorityState = "review_required";

export type PhaseAProductProvenance = {
  taskNodeIds: string[];
  sifAccidentCitedUids: string[];
  hazardNodeIds: string[];
  controlNodeIds: string[];
  koshaGuidanceCitedUids: string[];
  lawCitedUids: string[];
  articleNodeIds: string[];
};

export type PhaseAProductControlProvenance = {
  taskNodeId: string;
  sifAccidentCitedUids: string[];
  sifEvidence: ActiveEvidenceChainPack["hazardPriority"];
  hazardNodeId: string;
  controlNodeId: string;
  koshaGuidanceCitedUids: string[];
  koshaGuidanceEvidence: ActiveEvidenceChainPack["controls"][number]["guidanceEvidence"];
  lawRelation: "mandatedBy";
  lawCitedUids: string[];
  lawEvidence: ActiveEvidenceChainPack["controls"][number]["lawEvidence"];
  articleNodeIds: string[];
};

export type PhaseAProductControl = {
  controlId: string;
  nodeId: string;
  label: string;
  applicabilityCondition: string;
  confirmationQuestion: string;
  sourceClassification: ObligationClassification;
  classification: "review_required";
  authorityState: PhaseAProductAuthorityState;
  provenance: PhaseAProductControlProvenance;
};

export type PhaseAProductDocumentRow = {
  stableKey: string;
  document: "risk_assessment" | "tbm";
  rowOrSection: string;
  controlId: string;
  controlLabel: string;
  applicabilityCondition: string;
  confirmationQuestion: string;
  sourceClassification: ObligationClassification;
  classification: "review_required";
  verificationStatus: "review_required";
  provenance: PhaseAProductControlProvenance;
};

export type PhaseAProductMaterialization = {
  schemaVersion: "phase-a-product-materialization/v1";
  chainId: ActiveEvidenceChainPack["chainId"];
  reportedEvidenceChainState: "review_required";
  evidenceChainState: "review_required";
  authorityState: PhaseAProductAuthorityState;
  outputStatus: "review_required_draft";
  task: ActiveEvidenceChainPack["task"];
  accidents: ActiveEvidenceChainPack["hazardPriority"];
  hazard: ActiveEvidenceChainPack["hazard"];
  controls: PhaseAProductControl[];
  documentRows: PhaseAProductDocumentRow[];
  verifiedDocumentRows: [];
  provenance: PhaseAProductProvenance;
  coverage: {
    expectedDocumentRows: number;
    materializedDocumentRows: number;
    verifiedDocumentRows: 0;
  };
  humanConfirmation: {
    required: true;
    status: "pending";
    message: string;
  };
  reviewMessage: string;
};

type BuildPhaseAProductMaterializationInput = {
  evidencePack: ActiveEvidenceChainPack | null;
};

const REVIEW_MESSAGE = "Canonical 근거 연결은 검토용으로만 조립되었습니다. 사람 확인 전에는 검증된 문서 행으로 사용할 수 없습니다.";

function unique(values: readonly string[]): string[] {
  return [...new Set(values)];
}

function buildControlProvenance(
  pack: ActiveEvidenceChainPack,
  control: ActiveEvidenceChainPack["controls"][number],
): PhaseAProductControlProvenance {
  return {
    taskNodeId: pack.task.nodeId,
    sifAccidentCitedUids: pack.hazardPriority.map((source) => source.citedUid),
    sifEvidence: pack.hazardPriority,
    hazardNodeId: pack.hazard.nodeId,
    controlNodeId: control.graphControlNodeId,
    koshaGuidanceCitedUids: control.guidanceEvidence.map((source) => source.citedUid),
    koshaGuidanceEvidence: control.guidanceEvidence,
    lawRelation: "mandatedBy",
    lawCitedUids: control.lawEvidence.map((source) => source.citedUid),
    lawEvidence: control.lawEvidence,
    articleNodeIds: control.lawEvidence.flatMap((source) => (
      source.graphArticleNodeId ? [source.graphArticleNodeId] : []
    )),
  };
}

export function buildPhaseAProductMaterialization(
  input: BuildPhaseAProductMaterializationInput,
): PhaseAProductMaterialization | null {
  if (!input.evidencePack || !validateCanonicalEvidenceChainPack(input.evidencePack)) {
    return null;
  }

  const pack = structuredClone(input.evidencePack);
  const controls = pack.controls.map((control): PhaseAProductControl => ({
    controlId: control.controlId,
    nodeId: control.graphControlNodeId,
    label: control.label,
    applicabilityCondition: control.applicabilityCondition,
    confirmationQuestion: control.confirmationQuestion,
    sourceClassification: control.obligation.classification,
    classification: "review_required",
    authorityState: "review_required",
    provenance: buildControlProvenance(pack, control),
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
      applicabilityCondition: control.applicabilityCondition,
      confirmationQuestion: control.confirmationQuestion,
      sourceClassification: control.sourceClassification,
      classification: "review_required",
      verificationStatus: "review_required",
      provenance: control.provenance,
    }));
  });
  const controlProvenance = controls.map((control) => control.provenance);

  return {
    schemaVersion: "phase-a-product-materialization/v1",
    chainId: pack.chainId,
    reportedEvidenceChainState: "review_required",
    evidenceChainState: "review_required",
    authorityState: "review_required",
    outputStatus: "review_required_draft",
    task: pack.task,
    accidents: pack.hazardPriority,
    hazard: pack.hazard,
    controls,
    documentRows,
    verifiedDocumentRows: [],
    provenance: {
      taskNodeIds: [pack.task.nodeId],
      sifAccidentCitedUids: pack.hazardPriority.map((source) => source.citedUid),
      hazardNodeIds: [pack.hazard.nodeId],
      controlNodeIds: controls.map((control) => control.nodeId),
      koshaGuidanceCitedUids: unique(controlProvenance.flatMap(
        (provenance) => provenance.koshaGuidanceCitedUids,
      )),
      lawCitedUids: unique(controlProvenance.flatMap(
        (provenance) => provenance.lawCitedUids,
      )),
      articleNodeIds: unique(controlProvenance.flatMap(
        (provenance) => provenance.articleNodeIds,
      )),
    },
    coverage: {
      expectedDocumentRows: controls.length * 2,
      materializedDocumentRows: documentRows.length,
      verifiedDocumentRows: 0,
    },
    humanConfirmation: {
      required: true,
      status: "pending",
      message: REVIEW_MESSAGE,
    },
    reviewMessage: REVIEW_MESSAGE,
  };
}

type MaterializePhaseAProductOptions = {
  generationEvidenceSecret?: string;
};

function assertReviewRequiredProduct(product: PhaseAProductMaterialization): void {
  const valid = product.authorityState === "review_required"
    && product.evidenceChainState === "review_required"
    && product.reportedEvidenceChainState === "review_required"
    && product.outputStatus === "review_required_draft"
    && product.verifiedDocumentRows.length === 0
    && product.coverage.verifiedDocumentRows === 0
    && product.humanConfirmation.required
    && product.humanConfirmation.status === "pending"
    && product.controls.every((control) => (
      control.authorityState === "review_required"
      && control.classification === "review_required"
    ))
    && product.documentRows.every((row) => (
      row.classification === "review_required"
      && row.verificationStatus === "review_required"
    ));
  if (!valid) {
    throw new Error("Phase A product must remain review_required with human confirmation pending");
  }
}

function rowBlock(row: PhaseAProductDocumentRow): string {
  const guidance = row.provenance.koshaGuidanceCitedUids.length > 0
    ? row.provenance.koshaGuidanceCitedUids.join(", ")
    : "현장 확인 필요";
  const path = [
    `Task(${row.provenance.taskNodeId})`,
    `SIF/Accident(${row.provenance.sifAccidentCitedUids.join(", ")})`,
    `Hazard(${row.provenance.hazardNodeId})`,
    `Control(${row.provenance.controlNodeId}: ${row.controlLabel})`,
    `mandatedBy Article(${row.provenance.articleNodeIds.join(", ")})`,
  ].join(" -> ");
  return [
    `[${row.rowOrSection}]`,
    `stableKey: ${row.stableKey}`,
    "상태: 검토 필요",
    `적용조건: ${row.applicabilityCondition}`,
    `확인질문: ${row.confirmationQuestion}`,
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

function projectExistingRiskRows(
  rows: readonly RiskAssessmentRow[],
  product: PhaseAProductMaterialization,
): RiskAssessmentRow[] {
  const reviewRowsByControlId = new Map(
    product.documentRows
      .filter((row) => row.document === "risk_assessment")
      .map((row) => [row.controlId, row]),
  );
  return rows.map((row) => {
    if (!row.controlId) return row;
    const reviewRow = reviewRowsByControlId.get(row.controlId);
    if (!reviewRow) return row;
    return {
      ...row,
      verification: `review_required: ${reviewRow.stableKey}`,
      verificationStatus: "needsReview",
      evidenceRefs: unique([
        ...row.evidenceRefs,
        `phase-a-stable-key:${reviewRow.stableKey}`,
        reviewRow.provenance.taskNodeId,
        ...reviewRow.provenance.sifAccidentCitedUids,
        reviewRow.provenance.hazardNodeId,
        reviewRow.provenance.controlNodeId,
        ...reviewRow.provenance.koshaGuidanceCitedUids,
        ...reviewRow.provenance.lawCitedUids,
        ...reviewRow.provenance.articleNodeIds,
      ]),
    };
  });
}

export function materializePhaseAProductDocuments(
  response: AskResponse,
  product: PhaseAProductMaterialization,
  options: MaterializePhaseAProductOptions = {},
): AskResponse {
  assertReviewRequiredProduct(product);
  const riskRows = product.documentRows.filter((row) => row.document === "risk_assessment");
  const tbmRows = product.documentRows.filter((row) => row.document === "tbm");
  const projectedRows = response.structured
    ? projectExistingRiskRows(response.structured.riskAssessmentRows, product)
    : null;
  const validation = projectedRows ? validateRiskAssessmentRows(projectedRows) : null;
  const materialized: AskResponse = {
    ...response,
    deliverables: {
      ...response.deliverables,
      riskAssessmentDraft: prependMissingRows(response.deliverables.riskAssessmentDraft, riskRows),
      tbmBriefing: prependMissingRows(response.deliverables.tbmBriefing, tbmRows),
    },
    structured: response.structured && projectedRows && validation
      ? {
          ...response.structured,
          riskAssessmentRows: projectedRows,
          riskAssessmentValidation: {
            ok: validation.ok,
            issueCount: validation.issues.length,
            issues: validation.issues,
          },
        }
      : response.structured,
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

export function materializePhaseAProductIntoResponse(
  response: AskResponse,
  evidencePack: ActiveEvidenceChainPack,
  options: MaterializePhaseAProductOptions = {},
): AskResponse {
  const rebuiltProduct = buildPhaseAProductMaterialization({ evidencePack });
  if (!rebuiltProduct) {
    throw new Error("Phase A product materialization failed canonical registry validation");
  }
  return materializePhaseAProductDocuments(response, rebuiltProduct, options);
}
