import type { PhaseAReview } from "@/lib/types";
import {
  parsePhaseAWorkpackAuthority,
  phaseAWorkpackGenerationSealsEqual,
  readPhaseAWorkpackGenerationSeal,
  type PhaseAWorkpackAuthority,
  type PhaseAWorkpackGenerationSeal,
} from "@/lib/workpack-authority";

export const PHASE_A_SHARE_CONTRACT_REVIEW_HEAD =
  "22de1180d69263f7c08ac0ed0cfda0894e2db7f5" as const;
export const PHASE_A_SHARE_CONTRACT_PRODUCT_HEAD =
  "fc2bd1783fcc413981306f689d67bb6c659a985e" as const;

type ExactPhaseAConfirmation = Extract<
  PhaseAReview["humanConfirmation"],
  { status: "confirmed" }
>;

export type ShareV2DispatchBindingAuthority = {
  version: "share-dispatch-binding/v1";
  sessionIdentity: {
    shareSessionId: string;
    organizationId: string;
    siteId: string | null;
    workpackId: string;
    createdBy: string;
  };
  canonicalWorkpackRevision: string;
  normalizedWorkpackDigest: string;
  recipientSnapshotDigest: string;
  requestedChannels: Array<"email" | "sms" | "kakao">;
  channelConfigurationVersion: "channel-configuration/v2";
  channelConfigurationRevision: number;
  channelConfigurationDigestKeyId: string;
  channelConfigurationDigest: string;
  localePayloadDigest: string;
  createdAt: string;
  bindingDigest: string;
};

export type ShareV2DispatchBindingValidation =
  | { ok: true; binding: ShareV2DispatchBindingAuthority }
  | { ok: false; reasonCode: string };

export type PhaseAShareJointAuthority = {
  version: "phase-a-share-joint-authority/v1";
  workpackId: string;
  phaseA: {
    revision: string;
    generationSeal: PhaseAWorkpackGenerationSeal;
    exactConfirmation: ExactPhaseAConfirmation;
  };
  share: {
    updatedAt: string;
    evidenceSummary: Readonly<Record<string, unknown>>;
    canonicalWorkpackRevision: string;
    dispatchBinding: ShareV2DispatchBindingAuthority;
  };
};

export type PhaseAShareJointAuthorityFailureReason =
  | "phase_a_authority_invalid"
  | "workpack_id_mismatch"
  | "workpack_revision_mismatch"
  | "phase_a_confirmation_mismatch"
  | "share_evidence_summary_invalid"
  | "generation_seal_mismatch"
  | "share_canonical_revision_invalid"
  | "share_dispatch_binding_invalid"
  | "share_dispatch_binding_mismatch";

export type PhaseAShareJointAuthorityAssessment =
  | { ok: true; authority: PhaseAShareJointAuthority }
  | { ok: false; reasonCode: PhaseAShareJointAuthorityFailureReason };

type ShareV2AuthorityInput = {
  workpackId: string;
  updatedAt: string;
  evidenceSummary: unknown;
  canonicalWorkpackRevision: string;
  dispatchBindingValidation: ShareV2DispatchBindingValidation;
};

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SHA256_PATTERN = /^[a-f0-9]{64}$/i;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readStoredGenerationSeal(
  evidenceSummary: Record<string, unknown>,
): PhaseAWorkpackGenerationSeal | null {
  const generationEvidence = isRecord(evidenceSummary.generationEvidence)
    ? evidenceSummary.generationEvidence
    : null;
  const snapshot = generationEvidence && isRecord(generationEvidence.snapshot)
    ? generationEvidence.snapshot
    : null;
  if (!generationEvidence || !snapshot) return null;
  return readPhaseAWorkpackGenerationSeal({
    version: generationEvidence.version,
    algorithm: generationEvidence.algorithm,
    signature: generationEvidence.signature,
    generatedAt: snapshot.generatedAt,
    responseContentDigest: snapshot.responseContentDigest,
  });
}

function storedConfirmationMatches(
  evidenceSummary: Record<string, unknown>,
  expected: ExactPhaseAConfirmation,
): boolean {
  const review = isRecord(evidenceSummary.phaseAReview) ? evidenceSummary.phaseAReview : null;
  const confirmation = review && isRecord(review.humanConfirmation)
    ? review.humanConfirmation
    : null;
  const reviewer = confirmation && isRecord(confirmation.reviewer)
    ? confirmation.reviewer
    : null;
  const planBinding = review && isRecord(review.planBinding) ? review.planBinding : null;
  return Boolean(
    confirmation
    && reviewer
    && planBinding
    && confirmation.required === true
    && confirmation.status === "confirmed"
    && confirmation.confirmationId === expected.confirmationId
    && confirmation.confirmedAt === expected.confirmedAt
    && confirmation.issuedBy === expected.issuedBy
    && confirmation.workpackId === expected.workpackId
    && confirmation.chainId === expected.chainId
    && confirmation.planDigest === expected.planDigest
    && reviewer.principalType === expected.reviewer.principalType
    && reviewer.userId === expected.reviewer.userId
    && reviewer.sessionFingerprint === expected.reviewer.sessionFingerprint
    && planBinding.chainId === expected.chainId
    && planBinding.planDigest === expected.planDigest
  );
}

function dispatchBindingMatches(
  binding: ShareV2DispatchBindingAuthority,
  workpackId: string,
  canonicalWorkpackRevision: string,
): boolean {
  return binding.version === "share-dispatch-binding/v1"
    && UUID_PATTERN.test(binding.sessionIdentity.shareSessionId)
    && binding.sessionIdentity.workpackId === workpackId
    && binding.canonicalWorkpackRevision === canonicalWorkpackRevision
    && SHA256_PATTERN.test(binding.normalizedWorkpackDigest)
    && SHA256_PATTERN.test(binding.recipientSnapshotDigest)
    && binding.requestedChannels.length > 0
    && binding.requestedChannels.every((channel) => (
      channel === "email" || channel === "sms" || channel === "kakao"
    ))
    && binding.channelConfigurationVersion === "channel-configuration/v2"
    && Number.isSafeInteger(binding.channelConfigurationRevision)
    && binding.channelConfigurationRevision >= 0
    && binding.channelConfigurationDigestKeyId.trim().length > 0
    && SHA256_PATTERN.test(binding.channelConfigurationDigest)
    && SHA256_PATTERN.test(binding.localePayloadDigest)
    && Number.isFinite(Date.parse(binding.createdAt))
    && SHA256_PATTERN.test(binding.bindingDigest);
}

export function assessPhaseAShareJointAuthority(input: {
  phaseAAuthority: PhaseAWorkpackAuthority;
  exactConfirmation: ExactPhaseAConfirmation;
  share: ShareV2AuthorityInput;
}): PhaseAShareJointAuthorityAssessment {
  const phaseAAuthority = parsePhaseAWorkpackAuthority(input.phaseAAuthority);
  if (!phaseAAuthority) return { ok: false, reasonCode: "phase_a_authority_invalid" };
  if (
    input.share.workpackId !== phaseAAuthority.workpackId
    || input.exactConfirmation.workpackId !== phaseAAuthority.workpackId
  ) {
    return { ok: false, reasonCode: "workpack_id_mismatch" };
  }
  if (input.share.updatedAt !== phaseAAuthority.revision) {
    return { ok: false, reasonCode: "workpack_revision_mismatch" };
  }
  if (!isRecord(input.share.evidenceSummary)) {
    return { ok: false, reasonCode: "share_evidence_summary_invalid" };
  }
  if (!storedConfirmationMatches(input.share.evidenceSummary, input.exactConfirmation)) {
    return { ok: false, reasonCode: "phase_a_confirmation_mismatch" };
  }
  const storedSeal = readStoredGenerationSeal(input.share.evidenceSummary);
  if (
    !storedSeal
    || !phaseAWorkpackGenerationSealsEqual(storedSeal, phaseAAuthority.generationSeal)
  ) {
    return { ok: false, reasonCode: "generation_seal_mismatch" };
  }
  if (!SHA256_PATTERN.test(input.share.canonicalWorkpackRevision)) {
    return { ok: false, reasonCode: "share_canonical_revision_invalid" };
  }
  if (!input.share.dispatchBindingValidation.ok) {
    return { ok: false, reasonCode: "share_dispatch_binding_invalid" };
  }
  const dispatchBinding = input.share.dispatchBindingValidation.binding;
  if (!dispatchBindingMatches(
    dispatchBinding,
    phaseAAuthority.workpackId,
    input.share.canonicalWorkpackRevision,
  )) {
    return { ok: false, reasonCode: "share_dispatch_binding_mismatch" };
  }
  return {
    ok: true,
    authority: {
      version: "phase-a-share-joint-authority/v1",
      workpackId: phaseAAuthority.workpackId,
      phaseA: {
        revision: phaseAAuthority.revision,
        generationSeal: phaseAAuthority.generationSeal,
        exactConfirmation: input.exactConfirmation,
      },
      share: {
        updatedAt: input.share.updatedAt,
        evidenceSummary: input.share.evidenceSummary,
        canonicalWorkpackRevision: input.share.canonicalWorkpackRevision,
        dispatchBinding,
      },
    },
  };
}
