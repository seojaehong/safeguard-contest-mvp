import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { buildCanonicalPhaseAPlanBinding } from "@/lib/ontology/evidence-chain";
import { assessPhaseAReviewAuthority, buildPhaseAReviewUiState } from "@/lib/phase-a-review";
import type { PhaseAPlanBinding } from "@/lib/ontology/evidence-chain";
import type { PhaseAReview } from "@/lib/types";

type PlanBinding = PhaseAPlanBinding;

type PhaseAReviewWithCoverage = Omit<
  PhaseAReview,
  "materializationCoverage"
> & {
  planBinding: PlanBinding;
  materializationCoverage: {
    status: "complete" | "partial" | "missing";
    chainId: PlanBinding["chainId"];
    planDigest: string;
    expectedRecordCount: number;
    materializedRecordCount: number;
    expectedStableKeys: string[];
    materializedStableKeys: string[];
    unresolvedStableKeys: string[];
  };
};

type ConfirmedHumanConfirmation = Extract<
  PhaseAReviewWithCoverage["humanConfirmation"],
  { status: "confirmed" }
>;

const planBinding: PlanBinding = structuredClone(
  buildCanonicalPhaseAPlanBinding("vehicle-machinery-entrapment"),
);
const planDigest = planBinding.planDigest;
const confirmedHumanConfirmation: ConfirmedHumanConfirmation = {
  required: true,
  status: "confirmed",
  confirmationId: "11111111-1111-4111-8111-111111111111",
  confirmedAt: "2026-07-13T18:00:00.000Z",
  issuedBy: "safeclaw_server",
  workpackId: "22222222-2222-4222-8222-222222222222",
  reviewer: {
    principalType: "authenticated_workspace_user",
    userId: "reviewer-001",
    sessionFingerprint: `sha256:${"a".repeat(64)}`,
  },
  chainId: planBinding.chainId,
  planDigest,
};

const pendingReview: PhaseAReviewWithCoverage = {
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

const readyReview: PhaseAReviewWithCoverage = {
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
  humanConfirmation: confirmedHumanConfirmation,
  actionableReason: "Phase A 근거와 문서 반영 실적을 사람이 확인했습니다.",
};

function read(relativePath: string): string {
  return readFileSync(join(process.cwd(), relativePath), "utf8");
}

describe("Phase A citation authority UI", () => {
  it("logs every rejected generation source without leaking the rejected value", () => {
    const source = read("lib/search.ts");
    const capture = source.match(/async function captureGenerationSource[\s\S]*?\r?\n}\r?\n/)?.[0] ?? "";

    expect(capture).toContain("sourceLabel: PhaseAGenerationSourceLabel");
    expect(capture).toContain("catch (error)");
    expect(capture).toContain('log.warn("phase a generation source rejected"');
    expect(capture).toContain("...safeFailureContext(error)");
    expect(capture).not.toContain("error,");
    expect(source).toContain('captureGenerationSource("kosha-technical-guidance", koshaPromise)');
    expect(source).toContain('captureGenerationSource("sif-safety-reference", safetyReferencePromise)');
  });

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
        materializedStableKeys: [planBinding.expectedStableKeys[0]],
        unresolvedStableKeys: [planBinding.expectedStableKeys[1]],
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

  it("rejects a client-shrunk singleton expected set against the server plan binding", () => {
    const shrunkReview: PhaseAReviewWithCoverage = {
      ...readyReview,
      verifiedRecords: 1,
      materializationCoverage: {
        ...readyReview.materializationCoverage,
        expectedRecordCount: 1,
        materializedRecordCount: 1,
        expectedStableKeys: [planBinding.expectedStableKeys[0]],
        materializedStableKeys: [planBinding.expectedStableKeys[0]],
        unresolvedStableKeys: [],
      },
    };

    expect(assessPhaseAReviewAuthority(shrunkReview).authoritative).toBe(false);
  });

  it("rejects duplicate server-plan stableKeys even when the DTO claims complete coverage", () => {
    const duplicatePlanReview: PhaseAReviewWithCoverage = {
      ...readyReview,
      planBinding: {
        ...readyReview.planBinding,
        expectedStableKeys: [planBinding.expectedStableKeys[0], planBinding.expectedStableKeys[0]],
      },
    };

    expect(assessPhaseAReviewAuthority(duplicatePlanReview).authoritative).toBe(false);
  });

  it("rejects a forged digest even when every DTO field repeats the forged value", () => {
    const forgedDigest = `sha256:${"f".repeat(64)}`;
    const forgedReview: PhaseAReviewWithCoverage = {
      ...readyReview,
      planBinding: { ...readyReview.planBinding, planDigest: forgedDigest },
      materializationCoverage: {
        ...readyReview.materializationCoverage,
        planDigest: forgedDigest,
      },
      humanConfirmation: {
        ...confirmedHumanConfirmation,
        planDigest: forgedDigest,
      },
    };

    expect(assessPhaseAReviewAuthority(forgedReview).authoritative).toBe(false);
  });

  it.each([
    ["blank reviewer", { reviewer: { ...confirmedHumanConfirmation.reviewer, userId: "" } }],
    ["invalid time", { confirmedAt: "not-an-iso-timestamp" }],
    ["different plan", { planDigest: `sha256:${"b".repeat(64)}` }],
  ] as const)("rejects human confirmation bound to %s", (_label, override) => {
    const invalidConfirmation: PhaseAReviewWithCoverage = {
      ...readyReview,
      humanConfirmation: {
        ...confirmedHumanConfirmation,
        ...override,
      },
    };

    expect(assessPhaseAReviewAuthority(invalidConfirmation).authoritative).toBe(false);
  });

  it("rejects duplicate stableKeys even when counts claim full coverage", () => {
    const duplicatedReview: PhaseAReviewWithCoverage = {
      ...readyReview,
      materializationCoverage: {
        ...readyReview.materializationCoverage,
        materializedStableKeys: [planBinding.expectedStableKeys[0], planBinding.expectedStableKeys[0]],
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
      "workpackSummaryDraft: generationData.deliverables.workpackSummaryDraft",
    );
    expect(workpackEditor).toContain("buildPhaseAReviewUiState(effectivePhaseAReview)");
    expect(workpackEditor).toContain("phaseAState.evidenceHeading");
    expect(workpackEditor).toContain("phaseAState.directEvidenceLabel");
    expect(workpackEditor).toContain("phaseAState.connectionLabel");
    expect(currentModules).toMatch(
      /<CitationList\s+citations=\{current\.data\.citations\}\s+question=\{current\.data\.question\}\s+phaseAReview=\{current\.data\.phaseAReview\}/,
    );
  });
});
