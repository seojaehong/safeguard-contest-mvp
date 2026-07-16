import { attachGenerationEvidence } from "@/lib/generation-evidence";
import {
  validateCanonicalEvidenceChainPack,
  type ActiveEvidenceChainPack,
  type ObligationClassification,
} from "@/lib/ontology/evidence-chain";
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

export function materializePhaseAProductIntoResponse(
  response: AskResponse,
  evidencePack: ActiveEvidenceChainPack,
  options: MaterializePhaseAProductOptions = {},
): AskResponse {
  const rebuiltProduct = buildPhaseAProductMaterialization({ evidencePack });
  if (!rebuiltProduct) {
    throw new Error("Phase A product materialization failed canonical registry validation");
  }
  const materialized: AskResponse = {
    ...response,
    phaseAProduct: rebuiltProduct,
  };
  const generatedAt = response.generationEvidence?.snapshot.generatedAt;
  return generatedAt
    ? attachGenerationEvidence(materialized, {
        secret: options.generationEvidenceSecret,
        generatedAt,
      })
    : materialized;
}
