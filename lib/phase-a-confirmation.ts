import { createHash } from "node:crypto";

import type { PhaseAPlanBinding } from "@/lib/ontology/evidence-chain";
import { isPhaseAReviewReadyForConfirmation } from "@/lib/phase-a-review";
import type { PhaseAReviewerPrincipal, PhaseAReview } from "@/lib/types";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type PhaseAConfirmationErrorCode =
  | "confirmation_not_ready"
  | "confirmation_binding_mismatch"
  | "confirmation_id_invalid"
  | "confirmation_replay_mismatch";

export class PhaseAConfirmationError extends Error {
  readonly code: PhaseAConfirmationErrorCode;

  constructor(code: PhaseAConfirmationErrorCode, message: string) {
    super(message);
    this.name = "PhaseAConfirmationError";
    this.code = code;
  }
}

export function buildAuthenticatedPhaseAReviewerPrincipal(input: {
  userId: string;
  authorization: string;
}): PhaseAReviewerPrincipal | null {
  const userId = input.userId.trim();
  const token = input.authorization.startsWith("Bearer ")
    ? input.authorization.slice("Bearer ".length).trim()
    : "";
  if (!userId || !token) return null;
  return {
    principalType: "authenticated_workspace_user",
    userId,
    sessionFingerprint: `sha256:${createHash("sha256").update(token, "utf8").digest("hex")}`,
  };
}

function principalsMatch(
  left: PhaseAReviewerPrincipal,
  right: PhaseAReviewerPrincipal,
): boolean {
  return left.principalType === right.principalType &&
    left.userId === right.userId &&
    left.sessionFingerprint === right.sessionFingerprint;
}

function requestedBindingMatches(
  review: PhaseAReview,
  requested: Pick<PhaseAPlanBinding, "chainId" | "planDigest">,
): boolean {
  return Boolean(
    review.planBinding &&
    requested.chainId === review.planBinding.chainId &&
    requested.planDigest === review.planBinding.planDigest,
  );
}

export function issuePhaseAReviewConfirmation(input: {
  review: PhaseAReview;
  workpackId: string;
  principal: PhaseAReviewerPrincipal;
  requestedBinding: Pick<PhaseAPlanBinding, "chainId" | "planDigest">;
  requestedConfirmationId?: string;
  now: Date;
  createConfirmationId: () => string;
}): PhaseAReview {
  if (!UUID_PATTERN.test(input.workpackId) || !requestedBindingMatches(input.review, input.requestedBinding)) {
    throw new PhaseAConfirmationError(
      "confirmation_binding_mismatch",
      "확인 요청이 서버의 Phase A plan binding과 일치하지 않습니다.",
    );
  }

  const current = input.review.humanConfirmation;
  if (current.status === "confirmed") {
    const exactRetry = input.requestedConfirmationId === current.confirmationId &&
      current.workpackId === input.workpackId &&
      current.chainId === input.requestedBinding.chainId &&
      current.planDigest === input.requestedBinding.planDigest &&
      principalsMatch(current.reviewer, input.principal);
    if (!exactRetry) {
      throw new PhaseAConfirmationError(
        "confirmation_replay_mismatch",
        "기존 Phase A 확인과 일치하는 멱등 재시도만 허용됩니다.",
      );
    }
    return input.review;
  }

  if (input.requestedConfirmationId) {
    throw new PhaseAConfirmationError(
      "confirmation_replay_mismatch",
      "발급되지 않은 Phase A 확인 ID를 재사용할 수 없습니다.",
    );
  }
  if (!isPhaseAReviewReadyForConfirmation(input.review)) {
    throw new PhaseAConfirmationError(
      "confirmation_not_ready",
      "전체 materialization과 resolved grounding이 완료된 문서팩만 확인할 수 있습니다.",
    );
  }
  const confirmationId = input.createConfirmationId();
  if (!UUID_PATTERN.test(confirmationId) || !Number.isFinite(input.now.getTime())) {
    throw new PhaseAConfirmationError(
      "confirmation_id_invalid",
      "서버 확인 식별자 또는 시간이 올바르지 않습니다.",
    );
  }
  const binding = input.review.planBinding;
  if (!binding) {
    throw new PhaseAConfirmationError(
      "confirmation_not_ready",
      "서버 Phase A plan binding이 없습니다.",
    );
  }
  return {
    ...input.review,
    verdict: "통과",
    verified: true,
    humanConfirmation: {
      required: true,
      status: "confirmed",
      confirmationId,
      confirmedAt: input.now.toISOString(),
      issuedBy: "safeclaw_server",
      workpackId: input.workpackId,
      reviewer: input.principal,
      chainId: binding.chainId,
      planDigest: binding.planDigest,
    },
    actionableReason: "Phase A 근거와 문서 반영 실적을 인증된 검토자가 확인했습니다.",
  };
}
