import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { assessPhaseAReviewAuthority, buildPhaseAReviewUiState } from "@/lib/phase-a-review";
import type { PhaseAReview } from "@/lib/types";

type PhaseAReviewWithCoverage = PhaseAReview & {
  materializationCoverage: {
    status: "complete" | "partial" | "missing";
    expectedRecordCount: number;
    materializedRecordCount: number;
    expectedStableKeys: string[];
    materializedStableKeys: string[];
    unresolvedStableKeys: string[];
  };
};

const pendingReview: PhaseAReviewWithCoverage = {
  verdict: "검토 필요",
  verified: false,
  evidenceChainState: "review_required",
  groundingStatus: "review_required",
  outputStatus: "review_required_draft",
  verifiedRecords: 0,
  materializationCoverage: {
    status: "missing",
    expectedRecordCount: 2,
    materializedRecordCount: 0,
    expectedStableKeys: ["chain:risk:control", "chain:tbm:control"],
    materializedStableKeys: [],
    unresolvedStableKeys: ["chain:risk:control", "chain:tbm:control"],
  },
  humanConfirmation: { required: true, status: "pending" },
  actionableReason: "Phase A source resolution과 사람 확인이 필요합니다.",
};

const readyReview: PhaseAReviewWithCoverage = {
  verdict: "통과",
  verified: true,
  evidenceChainState: "resolved",
  groundingStatus: "resolved",
  outputStatus: "grounded_draft",
  verifiedRecords: 2,
  materializationCoverage: {
    status: "complete",
    expectedRecordCount: 2,
    materializedRecordCount: 2,
    expectedStableKeys: ["chain:risk:control", "chain:tbm:control"],
    materializedStableKeys: ["chain:risk:control", "chain:tbm:control"],
    unresolvedStableKeys: [],
  },
  humanConfirmation: { required: true, status: "confirmed" },
  actionableReason: "Phase A 근거와 문서 반영 실적을 사람이 확인했습니다.",
};

function read(relativePath: string): string {
  return readFileSync(join(process.cwd(), relativePath), "utf8");
}

describe("Phase A citation authority UI", () => {
  it.each([
    ["pending", pendingReview],
    ["missing", undefined],
  ] as const)("projects %s evidence as non-authoritative candidates", (_state, review) => {
    expect(buildPhaseAReviewUiState(review)).toMatchObject({
      authoritative: false,
      connectionLabel: "근거 검토 필요",
      directEvidenceLabel: "연결 후보",
      supportingEvidenceLabel: "보조 후보",
      lawCitationLabel: "법제처 확인 후보",
      evidenceHeading: "근거 연결 후보",
      reflectionLabel: "검토 위치 후보",
    });
  });

  it("projects connected and direct labels only for confirmed materialization", () => {
    expect(buildPhaseAReviewUiState(readyReview)).toMatchObject({
      authoritative: true,
      connectionLabel: "근거 연결됨",
      directEvidenceLabel: "직접 근거",
      supportingEvidenceLabel: "보조 근거",
      lawCitationLabel: "법제처 인용",
      evidenceHeading: "직접 근거와 보조 근거",
      reflectionLabel: "반영 라벨",
    });
  });

  it("keeps a confirmed 1/N materialization review-required and non-shareable", () => {
    const partialReview: PhaseAReviewWithCoverage = {
      ...readyReview,
      verifiedRecords: 1,
      materializationCoverage: {
        ...readyReview.materializationCoverage,
        status: "partial",
        materializedRecordCount: 1,
        materializedStableKeys: ["chain:risk:control"],
        unresolvedStableKeys: ["chain:tbm:control"],
      },
    };

    expect(assessPhaseAReviewAuthority(partialReview)).toMatchObject({
      authoritative: false,
    });
    expect(buildPhaseAReviewUiState(partialReview)).toMatchObject({
      authoritative: false,
      connectionLabel: "근거 검토 필요",
    });
  });

  it("rejects duplicate stableKeys even when counts claim full coverage", () => {
    const duplicatedReview: PhaseAReviewWithCoverage = {
      ...readyReview,
      materializationCoverage: {
        ...readyReview.materializationCoverage,
        materializedStableKeys: ["chain:risk:control", "chain:risk:control"],
      },
    };

    expect(assessPhaseAReviewAuthority(duplicatedReview).authoritative).toBe(false);
  });

  it("wires phaseAReview and the shared authority projection into citation surfaces", () => {
    const answerPanel = read("components/AnswerPanel.tsx");
    const answerPanelDisplay = read("lib/answer-panel-display.ts");
    const citationList = read("components/CitationList.tsx");
    const askPage = read("app/ask/page.tsx");
    const fieldWorkspace = read("components/FieldOperationsWorkspace.tsx");
    const currentModules = read("components/CurrentWorkpackModules.tsx");
    const workpackEditor = read("components/WorkpackEditor.tsx");

    expect(answerPanel).toContain("buildPhaseAReviewUiState(data.phaseAReview)");
    expect(answerPanel).toContain("phaseAState.connectionLabel");
    expect(answerPanel).toContain("phaseAState.authoritative ? data.status.summary");
    expect(answerPanelDisplay).toContain("buildPhaseAReviewUiState(data.phaseAReview)");

    expect(citationList).toContain("phaseAReview?: PhaseAReview");
    expect(citationList).toContain("buildPhaseAReviewUiState(phaseAReview)");
    expect(citationList).toContain("phaseAState.directEvidenceLabel");
    expect(citationList).toContain("phaseAState.lawCitationLabel");
    expect(citationList).toContain("phaseAState.reflectionLabel");
    expect(citationList).toContain('href={href}');
    expect(citationList).toContain('target="_blank" rel="noopener noreferrer"');

    expect(askPage).toMatch(
      /<CitationList\s+citations=\{data\.citations\}\s+question=\{q\}\s+phaseAReview=\{data\.phaseAReview\}/,
    );
    expect(fieldWorkspace).toContain("buildPhaseAReviewUiState(data.phaseAReview)");
    expect(fieldWorkspace).toMatch(
      /<CitationList\s+citations=\{data\.citations\}\s+question=\{data\.question\}\s+phaseAReview=\{data\.phaseAReview\}/,
    );
    expect(currentModules).toContain("buildPhaseAReviewUiState(current.data.phaseAReview)");
    expect(currentModules).toContain("phaseAState.evidenceHeading");
    expect(currentModules).toMatch(/<WorkpackEditor\s+data=\{current\.data\}/);
    expect(workpackEditor).toContain(
      "workpackSummaryDraft: data.deliverables.workpackSummaryDraft",
    );
    expect(workpackEditor).toContain("buildPhaseAReviewUiState(data.phaseAReview)");
    expect(workpackEditor).toContain("phaseAState.evidenceHeading");
    expect(workpackEditor).toContain("phaseAState.directEvidenceLabel");
    expect(workpackEditor).toContain("phaseAState.connectionLabel");
    expect(currentModules).toMatch(
      /<CitationList\s+citations=\{current\.data\.citations\}\s+question=\{current\.data\.question\}\s+phaseAReview=\{current\.data\.phaseAReview\}/,
    );
  });
});
