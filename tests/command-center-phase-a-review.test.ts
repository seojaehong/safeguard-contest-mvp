import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { buildPhaseAReviewUiState } from "@/lib/phase-a-review";
import type { PhaseAReview } from "@/lib/types";

const pendingReview: PhaseAReview = {
  verdict: "검토 필요",
  verified: false,
  evidenceChainState: "review_required",
  groundingStatus: "review_required",
  outputStatus: "review_required_draft",
  verifiedRecords: 0,
  humanConfirmation: { required: true, status: "pending" },
  actionableReason: "Phase A source resolution을 완료하세요."
};

describe("SafeGuardCommandCenter Phase A review surface", () => {
  it("projects pending Phase A evidence as a visible warning instead of a QA pass", () => {
    expect(buildPhaseAReviewUiState(pendingReview)).toMatchObject({
      authoritative: false,
      status: "검토 필요",
      detail: "Phase A 근거 및 사람 확인 미완료",
      tone: "warn"
    });
  });

  it("wires the Phase A projection into the actual command-center readiness rail", () => {
    const source = readFileSync(
      join(process.cwd(), "components", "SafeGuardCommandCenter.tsx"),
      "utf8"
    );

    expect(source).toContain('buildPhaseAReviewUiState');
    expect(source).toContain('buildPhaseAReviewUiState(data?.phaseAReview)');
    expect(source).toContain('buildPhaseAReviewUiState(data.phaseAReview)');
  });
});
