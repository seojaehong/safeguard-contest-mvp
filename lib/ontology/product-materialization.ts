import { attachGenerationEvidence } from "@/lib/generation-evidence";
import {
  buildCanonicalProductEvidenceIdentity,
  validateCanonicalEvidenceChainPack,
  type ActiveEvidenceChainPack,
  type CanonicalProductEvidenceIdentity,
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
  pack: CanonicalProductEvidenceIdentity,
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

  return buildPhaseAProductFromCanonicalEvidence(structuredClone(input.evidencePack));
}

function buildPhaseAProductFromCanonicalEvidence(
  pack: CanonicalProductEvidenceIdentity,
): PhaseAProductMaterialization {
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
  const canonicalEvidence = buildCanonicalProductEvidenceIdentity(product.task.input);
  const canonicalProduct = canonicalEvidence
    ? buildPhaseAProductFromCanonicalEvidence(canonicalEvidence)
    : null;
  if (!canonicalProduct || JSON.stringify(product) !== JSON.stringify(canonicalProduct)) {
    throw new Error("Phase A materialization failed canonical product identity validation");
  }
}

function rowBlock(row: PhaseAProductDocumentRow): string {
  const guidance = row.provenance.koshaGuidanceEvidence.length > 0
    ? row.provenance.koshaGuidanceEvidence
      .map((source) => (
        `${source.guideCode} p.${source.chunk.page}: ${source.chunk.supportStatement} (${source.citedUid})`
      ))
      .join("\n")
    : "현장 확인 필요";
  const law = row.provenance.lawEvidence.length > 0
    ? row.provenance.lawEvidence
      .map((source) => (
        `${source.title} 제${source.articleNo}조 (${source.citedUid})`
      ))
      .join("\n")
    : "현장 확인 필요";
  const path = [
    `작업(${row.provenance.taskNodeId})`,
    `SIF 유사사례(${row.provenance.sifAccidentCitedUids.join(", ")})`,
    `위험요인(${row.provenance.hazardNodeId})`,
    `조치(${row.provenance.controlNodeId}: ${row.controlLabel})`,
    `법령조항(${row.provenance.articleNodeIds.join(", ")})`,
  ].join(" -> ");
  return [
    `[${row.rowOrSection}]`,
    `검토행 ID: ${row.stableKey}`,
    "상태: 검토 필요",
    `적용조건: ${row.applicabilityCondition}`,
    `확인질문: ${row.confirmationQuestion}`,
    `근거 연결: ${path}`,
    `SIF 유사사례 근거: ${row.provenance.sifAccidentCitedUids.join(", ")}`,
    `KOSHA 기술지침 근거:\n${guidance}`,
    `법령 근거:\n${law}`,
    "사람 확인: pending",
  ].join("\n");
}

type CanonicalRowBlock = {
  stableKey: string;
  block: string;
};

const CANONICAL_ROW_BLOCK_PATTERN = /<!-- safeclaw:phase-a-canonical-row:start stableKey="([^"\r\n]+)" -->\r?\n[\s\S]*?\r?\n<!-- safeclaw:phase-a-canonical-row:end stableKey="\1" -->/g;

function canonicalRowBlock(row: PhaseAProductDocumentRow): string {
  return [
    `<!-- safeclaw:phase-a-canonical-row:start stableKey="${row.stableKey}" -->`,
    rowBlock(row),
    `<!-- safeclaw:phase-a-canonical-row:end stableKey="${row.stableKey}" -->`,
  ].join("\n");
}

function parseCanonicalRowBlocks(document: string): CanonicalRowBlock[] {
  return [...document.matchAll(CANONICAL_ROW_BLOCK_PATTERN)].map((match) => ({
    stableKey: match[1] ?? "",
    block: match[0].replace(/\r\n/g, "\n"),
  }));
}

function hasCompleteCanonicalRowBlock(
  blocks: readonly CanonicalRowBlock[],
  row: PhaseAProductDocumentRow,
): boolean {
  const expected = canonicalRowBlock(row);
  return blocks.some((block) => block.stableKey === row.stableKey && block.block === expected);
}

function prependMissingRows(
  document: string,
  rows: readonly PhaseAProductDocumentRow[],
): string {
  const ownedBlocks = parseCanonicalRowBlocks(document);
  const missing = rows.filter((row) => !hasCompleteCanonicalRowBlock(ownedBlocks, row));
  if (missing.length === 0) return document;
  const prefix = missing.map(canonicalRowBlock).join("\n\n");
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
