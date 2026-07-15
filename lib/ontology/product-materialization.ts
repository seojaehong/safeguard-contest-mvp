import type { AskResponse } from "@/lib/types";
import { attachGenerationEvidence } from "@/lib/generation-evidence";
import type { ActiveEvidenceChainPack } from "@/lib/ontology/evidence-chain";

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

export type PhaseAProductMaterialization = {
  schemaVersion: "phase-a-product-materialization/v1";
  chainId: null;
  reportedEvidenceChainState: "review_required";
  evidenceChainState: "review_required";
  authorityState: PhaseAProductAuthorityState;
  outputStatus: "review_required_draft";
  task: null;
  accidents: [];
  hazard: null;
  controls: [];
  documentRows: [];
  verifiedDocumentRows: [];
  provenance: PhaseAProductProvenance;
  coverage: {
    expectedDocumentRows: number;
    materializedDocumentRows: number;
    verifiedDocumentRows: number;
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

const REVIEW_MESSAGE = "신뢰 가능한 생산 provenance가 없어 근거 항목을 저장하지 않았습니다. 사람 확인이 필요합니다.";

export function buildPhaseAProductMaterialization(
  input: BuildPhaseAProductMaterializationInput,
): PhaseAProductMaterialization | null {
  if (!input.evidencePack) return null;

  const authorityState: PhaseAProductAuthorityState = "review_required";
  return {
    schemaVersion: "phase-a-product-materialization/v1",
    chainId: null,
    reportedEvidenceChainState: "review_required",
    evidenceChainState: "review_required",
    authorityState,
    outputStatus: "review_required_draft",
    task: null,
    accidents: [],
    hazard: null,
    controls: [],
    documentRows: [],
    verifiedDocumentRows: [],
    provenance: {
      taskNodeIds: [],
      sifAccidentCitedUids: [],
      hazardNodeIds: [],
      controlNodeIds: [],
      koshaGuidanceCitedUids: [],
      lawCitedUids: [],
      articleNodeIds: [],
    },
    coverage: {
      expectedDocumentRows: 0,
      materializedDocumentRows: 0,
      verifiedDocumentRows: 0,
    },
    humanConfirmation: { required: true, status: "pending", message: REVIEW_MESSAGE },
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
  const rebuiltProduct = buildPhaseAProductMaterialization({
    evidencePack,
  });
  if (!rebuiltProduct) {
    throw new Error("Phase A product materialization requires an evidence pack");
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
