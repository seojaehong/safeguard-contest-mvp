import { describe, expect, it } from "vitest";

import {
  buildAuthenticatedPhaseAReviewerPrincipal,
  issuePhaseAReviewConfirmation,
  PhaseAConfirmationError,
} from "@/lib/phase-a-confirmation";
import { buildCanonicalPhaseAPlanBinding } from "@/lib/ontology/evidence-chain";
import { assessPhaseAReviewAuthority, parsePhaseAReview } from "@/lib/phase-a-review";
import type { PhaseAReview } from "@/lib/types";

const WORKPACK_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const CONFIRMATION_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const NOW = new Date(Date.now() - 60_000);

function completePendingReview(): PhaseAReview {
  const planBinding = structuredClone(
    buildCanonicalPhaseAPlanBinding("vehicle-machinery-entrapment"),
  );
  return {
    verdict: "검토 필요",
    verified: false,
    evidenceChainState: "resolved",
    groundingStatus: "resolved",
    outputStatus: "grounded_draft",
    verifiedRecords: planBinding.expectedRecordCount,
    planBinding,
    materializationCoverage: {
      status: "complete",
      chainId: planBinding.chainId,
      planDigest: planBinding.planDigest,
      expectedRecordCount: planBinding.expectedRecordCount,
      materializedRecordCount: planBinding.expectedRecordCount,
      expectedStableKeys: [...planBinding.expectedStableKeys],
      materializedStableKeys: [...planBinding.expectedStableKeys],
      unresolvedStableKeys: [],
    },
    humanConfirmation: { required: true, status: "pending" },
    actionableReason: "사람 확인이 필요합니다.",
  };
}

function principal(token = "server-validated-session-token") {
  return buildAuthenticatedPhaseAReviewerPrincipal({
    userId: "user-1",
    authorization: `Bearer ${token}`,
  });
}

describe("server-bound Phase A confirmation", () => {
  it("issues authority from server identity/time and permits only an identical idempotent retry", () => {
    const review = completePendingReview();
    const reviewer = principal();
    expect(reviewer).not.toBeNull();
    if (!reviewer || !review.planBinding) throw new Error("expected confirmation inputs");

    const confirmed = issuePhaseAReviewConfirmation({
      review,
      workpackId: WORKPACK_ID,
      principal: reviewer,
      requestedBinding: review.planBinding,
      now: NOW,
      createConfirmationId: () => CONFIRMATION_ID,
    });

    expect(confirmed.humanConfirmation).toEqual({
      required: true,
      status: "confirmed",
      confirmationId: CONFIRMATION_ID,
      confirmedAt: NOW.toISOString(),
      issuedBy: "safeclaw_server",
      workpackId: WORKPACK_ID,
      reviewer,
      chainId: review.planBinding.chainId,
      planDigest: review.planBinding.planDigest,
    });
    expect(JSON.stringify(confirmed)).not.toContain("server-validated-session-token");
    expect(assessPhaseAReviewAuthority(confirmed).authoritative).toBe(true);

    const retried = issuePhaseAReviewConfirmation({
      review: confirmed,
      workpackId: WORKPACK_ID,
      principal: reviewer,
      requestedBinding: review.planBinding,
      requestedConfirmationId: CONFIRMATION_ID,
      now: new Date(NOW.getTime() + 1_000),
      createConfirmationId: () => "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
    });
    expect(retried).toEqual(confirmed);
  });

  it.each([
    ["different confirmation", { confirmationId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc" }],
    ["different session", { token: "different-valid-session" }],
    ["different chain digest", { planDigest: `sha256:${"f".repeat(64)}` }],
  ] as const)("rejects replay or binding mismatch for %s", (_label, mismatch) => {
    const review = completePendingReview();
    const originalPrincipal = principal();
    if (!originalPrincipal || !review.planBinding) throw new Error("expected confirmation inputs");
    const confirmed = issuePhaseAReviewConfirmation({
      review,
      workpackId: WORKPACK_ID,
      principal: originalPrincipal,
      requestedBinding: review.planBinding,
      now: NOW,
      createConfirmationId: () => CONFIRMATION_ID,
    });
    const replayPrincipal = "token" in mismatch ? principal(mismatch.token) : originalPrincipal;
    if (!replayPrincipal) throw new Error("expected replay principal");
    const requestedBinding = {
      ...review.planBinding,
      planDigest: "planDigest" in mismatch ? mismatch.planDigest : review.planBinding.planDigest,
    };

    expect(() => issuePhaseAReviewConfirmation({
      review: confirmed,
      workpackId: WORKPACK_ID,
      principal: replayPrincipal,
      requestedBinding,
      requestedConfirmationId: "confirmationId" in mismatch
        ? mismatch.confirmationId
        : CONFIRMATION_ID,
      now: NOW,
      createConfirmationId: () => "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
    })).toThrow(PhaseAConfirmationError);
  });

  it("rejects legacy client identity/time and a future server confirmation during structural parse", () => {
    const review = completePendingReview();
    if (!review.planBinding) throw new Error("expected plan binding");
    const legacy = {
      ...review,
      verdict: "통과",
      verified: true,
      humanConfirmation: {
        required: true,
        status: "confirmed",
        reviewerId: "client-supplied-reviewer",
        confirmedAt: NOW.toISOString(),
        chainId: review.planBinding.chainId,
        planDigest: review.planBinding.planDigest,
      },
    };
    expect(parsePhaseAReview(legacy, { nowMs: NOW.getTime() })).toBeNull();

    const reviewer = principal();
    if (!reviewer) throw new Error("expected reviewer principal");
    const confirmed = issuePhaseAReviewConfirmation({
      review,
      workpackId: WORKPACK_ID,
      principal: reviewer,
      requestedBinding: review.planBinding,
      now: new Date(NOW.getTime() + 10 * 60_000),
      createConfirmationId: () => CONFIRMATION_ID,
    });
    expect(parsePhaseAReview(confirmed, { nowMs: NOW.getTime() })).toBeNull();
  });
});
