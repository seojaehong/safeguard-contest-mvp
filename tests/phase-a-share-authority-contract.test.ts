import { describe, expect, it } from "vitest";
import {
  PHASE_A_SHARE_CONTRACT_BASE_PRODUCT_HEAD,
  PHASE_A_SHARE_CONTRACT_PRODUCT_HEAD,
  PHASE_A_SHARE_CONTRACT_REVIEW_HEAD,
  PHASE_A_SHARE_SEMANTIC_CONFLICT_PATHS,
  assessPhaseAShareJointAuthority,
  type ShareV2DispatchBindingAuthority,
} from "@/lib/phase-a-share-authority-contract";
import type { PhaseAWorkpackAuthority } from "@/lib/workpack-authority";
import type { PhaseAReview } from "@/lib/types";

const WORKPACK_ID = "7f3e3568-9326-82e5-a22c-1f74b465dbf0";
const SESSION_ID = "44ac6cc7-f4b3-4f39-aa73-07cc9d76d5fb";
const REVISION = "2026-07-14T04:00:00.000Z";
const CANONICAL_REVISION = "a".repeat(64);
const PLAN_DIGEST = `sha256:${"b".repeat(64)}`;

const confirmation: Extract<PhaseAReview["humanConfirmation"], { status: "confirmed" }> = {
  required: true,
  status: "confirmed",
  confirmationId: "23f264e0-65fb-4f0f-92a7-21a30d4c6931",
  confirmedAt: "2026-07-14T03:59:00.000Z",
  issuedBy: "safeclaw_server",
  workpackId: WORKPACK_ID,
  reviewer: {
    principalType: "authenticated_workspace_user",
    userId: "user-phase-a",
    sessionFingerprint: `sha256:${"c".repeat(64)}`,
  },
  chainId: "work-at-height-fall",
  planDigest: PLAN_DIGEST,
};

const generationSeal = {
  version: "safeclaw-generation-evidence/v1" as const,
  algorithm: "HMAC-SHA256" as const,
  signature: "A".repeat(43),
  generatedAt: "2026-07-14T03:55:00.000Z",
  responseContentDigest: `sha256:${"D".repeat(43)}`,
};

const authority: PhaseAWorkpackAuthority = {
  version: "safeclaw-workpack-authority/v1",
  workpackId: WORKPACK_ID,
  revision: REVISION,
  updatedAt: REVISION,
  generationSeal,
  idempotency: {
    version: "safeclaw-workpack-idempotency/v1",
    deterministicId: WORKPACK_ID,
    scopeDigest: `sha256:${"d".repeat(64)}`,
    generationSealAtCreate: generationSeal,
  },
};

const phaseAReview = {
  verdict: "통과",
  verified: true,
  evidenceChainState: "resolved",
  groundingStatus: "resolved",
  outputStatus: "grounded_draft",
  verifiedRecords: 1,
  planBinding: {
    version: "phase-a-plan-binding/v1",
    chainId: confirmation.chainId,
    planDigest: PLAN_DIGEST,
    expectedStableKeys: ["work-at-height-fall:risk-assessment:test"],
    createdAt: "2026-07-14T03:55:00.000Z",
  },
  materializationCoverage: {
    version: "phase-a-materialization-coverage/v1",
    requiredStableKeys: ["work-at-height-fall:risk-assessment:test"],
    materializedStableKeys: ["work-at-height-fall:risk-assessment:test"],
    missingStableKeys: [],
    exact: true,
  },
  humanConfirmation: confirmation,
  actionableReason: "서버 확인 완료",
};

const evidenceSummary: Record<string, unknown> = {
  phaseAReview,
  generationEvidence: {
    version: generationSeal.version,
    algorithm: generationSeal.algorithm,
    signature: generationSeal.signature,
    snapshot: {
      generatedAt: generationSeal.generatedAt,
      responseContentDigest: generationSeal.responseContentDigest,
    },
  },
  reviewedLocalizationEnvelopes: { en: { status: "reviewed" } },
};

const dispatchBinding: ShareV2DispatchBindingAuthority = {
  version: "share-dispatch-binding/v1",
  sessionIdentity: {
    shareSessionId: SESSION_ID,
    organizationId: "organization-phase-a",
    siteId: "site-phase-a",
    workpackId: WORKPACK_ID,
    createdBy: "user-phase-a",
  },
  canonicalWorkpackRevision: CANONICAL_REVISION,
  normalizedWorkpackDigest: "e".repeat(64),
  recipientSnapshotDigest: "f".repeat(64),
  requestedChannels: ["sms"],
  channelConfigurationVersion: "channel-configuration/v2",
  channelConfigurationRevision: 3,
  channelConfigurationDigestKeyId: "share-key-1",
  channelConfigurationDigest: "1".repeat(64),
  localePayloadDigest: "2".repeat(64),
  createdAt: REVISION,
  bindingDigest: "3".repeat(64),
};

function assess(overrides: {
  authority?: PhaseAWorkpackAuthority;
  confirmation?: typeof confirmation;
  updatedAt?: string;
  evidenceSummary?: Record<string, unknown>;
  dispatchBinding?: ShareV2DispatchBindingAuthority;
} = {}) {
  return assessPhaseAShareJointAuthority({
    phaseAAuthority: overrides.authority ?? authority,
    exactConfirmation: overrides.confirmation ?? confirmation,
    share: {
      workpackId: WORKPACK_ID,
      updatedAt: overrides.updatedAt ?? REVISION,
      evidenceSummary: overrides.evidenceSummary ?? evidenceSummary,
      canonicalWorkpackRevision: CANONICAL_REVISION,
      dispatchBindingValidation: {
        ok: true,
        binding: overrides.dispatchBinding ?? dispatchBinding,
      },
    },
  });
}

describe("Phase A and Share v2 joint authority contract", () => {
  it("is bound to the exact Share review and product heads", () => {
    expect(PHASE_A_SHARE_CONTRACT_REVIEW_HEAD).toBe("22de1180d69263f7c08ac0ed0cfda0894e2db7f5");
    expect(PHASE_A_SHARE_CONTRACT_BASE_PRODUCT_HEAD).toBe("fc2bd1783fcc413981306f689d67bb6c659a985e");
    expect(PHASE_A_SHARE_CONTRACT_PRODUCT_HEAD).toBe("7141baac3e0abca146ef6c110093c1c0643760a2");
    expect(PHASE_A_SHARE_SEMANTIC_CONFLICT_PATHS).toEqual([
      "app/api/workpacks/[id]/route.ts",
      "components/FieldOperationsWorkspace.tsx",
      "components/SafeGuardCommandCenter.tsx",
      "lib/workpack-commercial-store.ts",
      "tests/workpack-generation-evidence-route.test.ts",
      "tests/workpack-share-authority-routes.test.ts",
    ]);
  });

  it("preserves exact Phase A and Share authority fields", () => {
    const result = assess();

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.authority.phaseA.revision).toBe(REVISION);
    expect(result.authority.phaseA.generationSeal).toEqual(generationSeal);
    expect(result.authority.phaseA.exactConfirmation).toEqual(confirmation);
    expect(result.authority.share.updatedAt).toBe(REVISION);
    expect(result.authority.share.evidenceSummary).toBe(evidenceSummary);
    expect(result.authority.share.dispatchBinding).toBe(dispatchBinding);
    expect(result.authority.share.canonicalWorkpackRevision).toBe(CANONICAL_REVISION);
  });

  it("fails closed when Share is based on an older server row revision", () => {
    expect(assess({ updatedAt: "2026-07-14T03:58:00.000Z" })).toEqual({
      ok: false,
      reasonCode: "workpack_revision_mismatch",
    });
  });

  it("fails closed when Share evidence drops the exact confirmation", () => {
    const staleSummary = {
      ...evidenceSummary,
      phaseAReview: {
        ...phaseAReview,
        humanConfirmation: { required: true, status: "pending" },
      },
    };
    expect(assess({ evidenceSummary: staleSummary })).toEqual({
      ok: false,
      reasonCode: "phase_a_confirmation_mismatch",
    });
  });

  it("fails closed when Share evidence or dispatch binding targets another generation", () => {
    const changedEvidence = {
      ...evidenceSummary,
      generationEvidence: {
        ...(evidenceSummary.generationEvidence as Record<string, unknown>),
        signature: "Z".repeat(43),
      },
    };
    expect(assess({ evidenceSummary: changedEvidence })).toEqual({
      ok: false,
      reasonCode: "generation_seal_mismatch",
    });

    expect(assess({
      dispatchBinding: {
        ...dispatchBinding,
        canonicalWorkpackRevision: "4".repeat(64),
      },
    })).toEqual({
      ok: false,
      reasonCode: "share_dispatch_binding_mismatch",
    });
  });

  it("propagates Share v2 dispatch validation failure", () => {
    const result = assessPhaseAShareJointAuthority({
      phaseAAuthority: authority,
      exactConfirmation: confirmation,
      share: {
        workpackId: WORKPACK_ID,
        updatedAt: REVISION,
        evidenceSummary,
        canonicalWorkpackRevision: CANONICAL_REVISION,
        dispatchBindingValidation: {
          ok: false,
          reasonCode: "session_binding_missing_or_malformed",
        },
      },
    });

    expect(result).toEqual({ ok: false, reasonCode: "share_dispatch_binding_invalid" });
  });
});
