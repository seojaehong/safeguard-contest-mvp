import { describe, expect, it } from "vitest";

import {
  buildAnswerPanelStatusNotes,
  sanitizeAnswerForDisplay,
  type AnswerPanelPublicStatusInput
} from "@/lib/answer-panel-display";
import { buildCanonicalPhaseAPlanBinding } from "@/lib/ontology/evidence-chain";
import type { PhaseAReview } from "@/lib/types";

const planBinding = structuredClone(
  buildCanonicalPhaseAPlanBinding("vehicle-machinery-entrapment"),
);
const planDigest = planBinding.planDigest;

const pendingReview: PhaseAReview = {
  verdict: "검토 필요",
  verified: false,
  evidenceChainState: "review_required",
  groundingStatus: "review_required",
  outputStatus: "review_required_draft",
  verifiedRecords: 0,
  planBinding,
  materializationCoverage: {
    status: "missing",
    chainId: planBinding.chainId,
    planDigest,
    expectedRecordCount: 2,
    materializedRecordCount: 0,
    expectedStableKeys: [...planBinding.expectedStableKeys],
    materializedStableKeys: [],
    unresolvedStableKeys: [...planBinding.expectedStableKeys],
  },
  humanConfirmation: { required: true, status: "pending" },
  actionableReason: "Phase A source resolution과 사람 확인이 필요합니다.",
};

const readyReview: PhaseAReview = {
  verdict: "통과",
  verified: true,
  evidenceChainState: "resolved",
  groundingStatus: "resolved",
  outputStatus: "grounded_draft",
  verifiedRecords: 2,
  planBinding,
  materializationCoverage: {
    status: "complete",
    chainId: planBinding.chainId,
    planDigest,
    expectedRecordCount: 2,
    materializedRecordCount: 2,
    expectedStableKeys: [...planBinding.expectedStableKeys],
    materializedStableKeys: [...planBinding.expectedStableKeys],
    unresolvedStableKeys: [],
  },
  humanConfirmation: {
    required: true,
    status: "confirmed",
    reviewerId: "reviewer-001",
    confirmedAt: "2026-07-14T03:00:00.000Z",
    chainId: planBinding.chainId,
    planDigest,
  },
  actionableReason: "Phase A 근거와 문서 반영 실적을 사람이 확인했습니다.",
};

function statusInput(
  phaseAReview?: PhaseAReview,
): AnswerPanelPublicStatusInput & { phaseAReview?: PhaseAReview } {
  return {
    phaseAReview,
    status: {
      lawgo: "live",
      weather: "fallback",
      kosha: "live",
      work24: "mock"
    },
    externalData: {
      safetyReference: {
        mode: "live",
        count: 42
      }
    },
    dbHarness: {
      summary: {
        directEvidence: 3,
        sifCases: 2
      }
    },
    qualityContract: {
      summary: "근거와 문서 반영 위치를 확인했습니다."
    }
  };
}

describe("answer panel display copy", () => {
  it("removes internal provider and fallback diagnostics from visible answer text", () => {
    const answer = [
      "Law.go와 OpenAI 응답을 결합했습니다. OPENAI_API_KEY가 없어 fallback 정책을 따릅니다.",
      "",
      "1) 핵심 판단",
      "하청 작업 전 원청과 하청의 안전보건 조치 이행 자료를 확인합니다.",
      "",
      "OpenAI 응답은 timeout 20000ms, retry 없음, 실패 시 graceful fallback 정책을 따릅니다."
    ].join("\n");

    const sanitized = sanitizeAnswerForDisplay(answer);

    expect(sanitized).toContain("핵심 판단");
    expect(sanitized).not.toMatch(/OpenAI|OPENAI_API_KEY|fallback|timeout|retry|graceful/i);
  });

  it.each([
    ["pending", pendingReview],
    ["missing", undefined],
  ] as const)("fails closed for %s Phase A status notes", (_state, review) => {
    const notes = buildAnswerPanelStatusNotes(statusInput(review)).join(" / ");

    expect(notes).toContain("법령 근거: 연결 후보");
    expect(notes).toContain("KOSHA 자료: 연결 후보");
    expect(notes).toContain("기상 신호: 보조 근거로 표시");
    expect(notes).toContain("DB 하네스: 연결 후보 3건 · SIF 위험 우선순위 후보 2건");
    expect(notes).not.toContain("법령 근거: 연결됨");
    expect(notes).not.toContain("직접 근거");
    expect(notes).not.toMatch(/fallback|OPENAI_API_KEY|timeout|AI_MODE/i);
  });

  it("uses connected and direct status notes only for confirmed Phase A authority", () => {
    const notes = buildAnswerPanelStatusNotes(statusInput(readyReview)).join(" / ");

    expect(notes).toContain("법령 근거: 연결됨");
    expect(notes).toContain("KOSHA 자료: 연결됨");
    expect(notes).toContain("DB 하네스: 직접 근거 3건 · SIF 사례 2건");
  });
});
