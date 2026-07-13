import { describe, expect, it } from "vitest";

import type { AskResponse } from "@/lib/types";
import type { QaReviewFound } from "@/lib/ontology/qa-review";
import {
  buildPhaseAGenerationGrounding,
  type PhaseAGenerationGrounding,
} from "@/lib/ontology/evidence-chain";
import { assembleGraph } from "@/lib/ontology/graph-store";
import { buildPublishedSafetyKnowledge } from "@/lib/ontology/knowledge-tool";
import { SEED_EDGES, SEED_NODES } from "@/lib/ontology/seed/core-triples";
import { OFFICIAL_CONTACTS } from "@/lib/safety-contacts";
import {
  buildAccidentCasesResult,
  buildDiagnosticQaReviewResult,
  buildDocpackResult,
  buildReviewedDocpackResult,
  buildHarnessAgentResult,
  resolveReviewTaskLabel,
  buildEvidenceMappingResult,
  buildSanitizeContactsResult,
  buildWeatherResult,
  isSupportedWeatherRegion,
  toToolError,
  toToolResult,
  validateCitations,
} from "@/lib/mcp-tools";

function makeAskResponse(overrides: Partial<AskResponse> = {}): AskResponse {
  const base = {
    scenario: {
      siteName: "테스트현장",
      companyName: "테스트건설",
      companyType: "건설업",
      workSummary: "비계 해체",
      workerCount: 5,
      weatherNote: "",
    },
    mode: "mock",
    status: { summary: "검증용 요약" },
    deliverables: {
      riskAssessmentDraft: "가".repeat(650),
      tbmBriefing: "짧은 TBM 브리핑",
      workpackSummaryDraft: "",
    },
  };
  return { ...base, ...overrides } as unknown as AskResponse;
}

const publishedGraph = assembleGraph(
  SEED_NODES.filter((node) => node.review_state === "published"),
  SEED_EDGES.filter((edge) => edge.review_state === "published"),
);

function makePhaseAGrounding(evidenceChainState: "resolved" | "review_required") {
  const knowledge = buildPublishedSafetyKnowledge(publishedGraph, "차량계 하역운반기계 인접 작업");
  if (!knowledge.found || !knowledge.evidenceContract) {
    throw new Error("expected vehicle evidence contract");
  }
  const evidencePack = evidenceChainState === "resolved"
    ? {
        ...knowledge.evidenceContract,
        hazardPriority: knowledge.evidenceContract.hazardPriority.map((source) => ({
          ...source,
          reviewState: "published" as const,
          resolution: "resolved" as const,
        })),
      }
    : knowledge.evidenceContract;
  return buildPhaseAGenerationGrounding({
    evidenceChainState,
    evidencePack,
  });
}

function focusGroundingOnFirstPlan(
  grounding: PhaseAGenerationGrounding,
): PhaseAGenerationGrounding {
  const plan = grounding.materializationTargets[0];
  const control = grounding.evidencePack?.controls.find(
    (candidate) => candidate.controlId === plan?.controlId,
  );
  if (!plan || !control || !grounding.evidencePack) {
    throw new Error("expected focused materialization plan");
  }
  return {
    ...grounding,
    evidencePack: {
      ...grounding.evidencePack,
      controls: [control],
      materializationTargets: [plan],
    },
    materializationTargets: [plan],
  };
}

function passingQaReview(): QaReviewFound {
  return {
    reviewable: true,
    task: "지게차 상하차",
    covered: { hazards: ["끼임"], controls: ["출입통제"], articles: ["산업안전보건기준에 관한 규칙 제172조"] },
    missing: { hazards: [], controls: [], articles: [] },
    coverageRate: 1,
    verdict: "통과",
    advisory: "검수 고지",
  };
}

describe("validateCitations", () => {
  it("removes an unverified article citation and keeps a verified one", () => {
    const text =
      "산업안전보건법 제38조에 따라 조치하고, 산업안전보건법 제999조도 확인한다.";
    const result = validateCitations(text);
    expect(result.gatedText).toContain("제38조");
    expect(result.gatedText).not.toContain("제999조");
    expect(result.removedCitations).toEqual(["제999조"]);
  });

  it("returns no removed citations for text without article references", () => {
    const result = validateCitations("현장 안전수칙을 준수한다.");
    expect(result.removedCitations).toEqual([]);
    expect(result.gatedText).toBe("현장 안전수칙을 준수한다.");
  });
});

describe("buildDocpackResult", () => {
  it("previews string documents to 500 chars with total length and truncated flag", () => {
    const result = buildDocpackResult(makeAskResponse());
    const risk = result.documents.riskAssessmentDraft;
    expect(typeof risk).toBe("object");
    if (typeof risk === "object") {
      expect(risk.preview.length).toBe(500);
      expect(risk.totalLength).toBe(650);
      expect(risk.truncated).toBe(true);
    }
    // 빈 문자열 문서는 생략된다.
    expect(result.documents.workpackSummaryDraft).toBeUndefined();
    expect(result.summary).toBe("검증용 요약");
    expect(result.mode).toBe("mock");
  });

  it("returns full document bodies when includeFull is true", () => {
    const result = buildDocpackResult(makeAskResponse(), true);
    expect(result.documents.riskAssessmentDraft).toBe("가".repeat(650));
    expect(result.fullDocumentsNote).toContain("전체");
  });

  it("includes evidenceLabels only when present on the response", () => {
    const withLabels = buildDocpackResult(
      makeAskResponse({
        evidenceLabels: { riskAssessmentDraft: { article: "중대재해처벌법 시행령 제4조 제3호", purpose: "증빙" } },
      })
    );
    expect(withLabels.evidenceLabels).toBeDefined();
    const withoutLabels = buildDocpackResult(makeAskResponse());
    expect(withoutLabels.evidenceLabels).toBeUndefined();
  });

  it("projects only public Phase A provenance and never returns the raw evidence pack", () => {
    const grounding = makePhaseAGrounding("review_required");
    const result = buildDocpackResult(makeAskResponse(), true, undefined, grounding);
    const serialized = JSON.stringify(result);

    expect(result).not.toHaveProperty("evidenceContract");
    expect(result).toHaveProperty("publicEvidence");
    expect(serialized).not.toContain("graphControlNodeId");
    expect(serialized).not.toContain("graphArticleNodeId");
    expect(serialized).not.toContain("taskNodeId");
    expect(serialized).not.toContain("hazardNodeId");
    expect(serialized).not.toContain('"input"');
    expect(serialized).not.toContain("snapshotItemId");
    expect(serialized).not.toContain("chunkSha256");
    expect(result.publicEvidence).toMatchObject({
      schemaVersion: "phase-a-public-evidence/v1",
      authority: "review_required",
      sources: {
        sif: expect.any(Array),
        kosha: expect.any(Array),
        law: expect.any(Array),
      },
    });
  });

  it("reports plans but no verified materialization for review-required evidence", () => {
    const phaseAGrounding = makePhaseAGrounding("review_required");

    const result = buildDocpackResult(makeAskResponse({
      deliverables: {
        ...makeAskResponse().deliverables,
        riskAssessmentDraft:
          "작업발판 설치 | law:산업안전보건기준에 관한 규칙:제42조",
      },
    }), false, undefined, phaseAGrounding);

    expect(result.evidenceMaterialization).toMatchObject({
      evidenceChainState: "review_required",
      operationSequence: [
        "task_graph",
        "sif_accident",
        "kosha_guidance",
        "current_law",
        "document_materialization",
      ],
      humanConfirmation: { required: true, status: "pending" },
      verifiedRecords: [],
      coverage: {
        status: "missing",
        expectedRecordCount: phaseAGrounding.planBinding?.expectedRecordCount,
        materializedRecordCount: 0,
        expectedStableKeys: phaseAGrounding.planBinding?.expectedStableKeys,
        materializedStableKeys: [],
        unresolvedStableKeys: phaseAGrounding.planBinding?.expectedStableKeys,
      },
    });
    expect(result.evidenceMaterialization?.plannedTargets).toHaveLength(
      phaseAGrounding.planBinding?.expectedRecordCount ?? 0,
    );
  });

  it.each([
    {
      classification: "statutory_mandate" as const,
      expectedGuidance: [] as string[],
      expectedLaw: ["law:test:article-1"],
    },
    {
      classification: "technical_guidance_only" as const,
      expectedGuidance: ["kosha:test:guide-1"],
      expectedLaw: [] as string[],
    },
    {
      classification: "statutory_mandate_with_guidance" as const,
      expectedGuidance: ["kosha:test:guide-1"],
      expectedLaw: ["law:test:article-1"],
    },
    {
      classification: "review_required" as const,
      expectedGuidance: [] as string[],
      expectedLaw: [] as string[],
    },
  ])(
    "keeps SIF hazard priority separate from $classification control evidence",
    ({ classification, expectedGuidance, expectedLaw }) => {
      const grounding = focusGroundingOnFirstPlan(makePhaseAGrounding("resolved"));
      const plan = grounding.materializationTargets[0];
      if (!plan) throw new Error("expected public materialization plan");
      const sifCitedUid = "sif:test:case-1";
      const guidanceCitedUid = "kosha:test:guide-1";
      const lawCitedUid = "law:test:article-1";
      const classifiedPlan = {
        ...plan,
        obligation: {
          ...plan.obligation,
          classification,
          categoricalLegalDuty: classification === "statutory_mandate"
            || classification === "statutory_mandate_with_guidance",
        },
        sifCitedUids: [sifCitedUid],
        guidanceCitedUids: [guidanceCitedUid],
        lawCitedUids: [lawCitedUid],
      };
      const classifiedGrounding: PhaseAGenerationGrounding = {
        ...grounding,
        materializationTargets: [classifiedPlan],
      };

      const result = buildDocpackResult(makeAskResponse(), false, undefined, classifiedGrounding);
      const targets = result.evidenceMaterialization?.plannedTargets;
      expect(targets).toHaveLength(2);
      for (const target of targets ?? []) {
        expect(target.hazardPriorityRelation).toBe("evidencedBy");
        expect(target.hazardPriorityCitedUids).toEqual([sifCitedUid]);
        expect(target.controlGuidanceCitedUids).toEqual(expectedGuidance);
        expect(target.controlMandateCitedUids).toEqual(expectedLaw);
        expect(target.controlRequiredCitedUids).toEqual([...expectedGuidance, ...expectedLaw]);
        expect(target.requiredCitedUids).toEqual(target.controlRequiredCitedUids);
        expect(target.requiredCitedUidsSemantics).toBe("control_required_only_excludes_sif");
        expect(target.controlRequiredCitedUids).not.toContain(sifCitedUid);
        expect(target.requiredCitedUids).not.toContain(sifCitedUid);
      }
    },
  );
});

describe("buildReviewedDocpackResult", () => {
  it("keeps a 1/N materialization non-authoritative before the human gate", () => {
    const qaReview = passingQaReview();
    const phaseAGrounding = makePhaseAGrounding("resolved");
    const target = phaseAGrounding.materializationTargets[0];
    const lawUid = target?.lawCitedUids[0];
    if (!target || !lawUid) throw new Error("expected resolved materialization target");
    const materializedDraft = [
      `[${target.targets[0].rowOrSection}]`,
      `${target.controlLabel} | ${lawUid}.`,
    ].join("\n").padEnd(650, "가");
    const result = buildReviewedDocpackResult(
      makeAskResponse({
        deliverables: {
          ...makeAskResponse().deliverables,
          riskAssessmentDraft: materializedDraft,
        },
      }),
      qaReview,
      "지게차 상하차",
      false,
      undefined,
      phaseAGrounding,
    );

    expect(result.engine).toBe("safeclaw-runAsk");
    expect(result.qualityPipeline).toEqual(["generate_safety_docpack", "qa_review_docpack"]);
    expect(result.reviewStatus).toMatchObject({
      verdict: "검토 필요",
      verified: false,
      groundingStatus: "resolved",
      reasonCode: "verified_materialization_missing",
      humanConfirmation: { required: true, status: "pending" },
    });
    expect(result.qa).toMatchObject({
      authoritative: false,
      diagnostic: qaReview,
    });
    expect(result.docpack.evidenceMaterialization?.verifiedRecords.length).toBeGreaterThan(0);
    expect(result.docpack.evidenceMaterialization).toMatchObject({
      coverage: {
        status: "partial",
        materializedRecordCount: 1,
      },
    });
    expect(result.docpack.documents.riskAssessmentDraft).toMatchObject({
      totalLength: 650,
      truncated: true,
    });
    expect(result.openClawUsageNote).toContain("검토 필요");
    expect(result.openClawUsageNote).toContain("verified 근거로 사용하지 마세요");
    expect(result.openClawUsageNote).not.toContain("최종 답변의 근거로 사용");
  });

  it("recognizes full stableKey coverage without bypassing human confirmation", () => {
    const qaReview = passingQaReview();
    const phaseAGrounding = focusGroundingOnFirstPlan(makePhaseAGrounding("resolved"));
    const target = phaseAGrounding.materializationTargets[0];
    const lawUid = target?.lawCitedUids[0];
    if (!target || !lawUid) throw new Error("expected focused materialization target");
    const riskLine = [
      `[${target.targets[0].rowOrSection}]`,
      `${target.controlLabel} | ${lawUid}`,
    ].join("\n");
    const tbmLine = [
      `[${target.targets[1].rowOrSection}]`,
      `${target.controlLabel} | ${lawUid}`,
    ].join("\n");

    const result = buildReviewedDocpackResult(
      makeAskResponse({
        deliverables: {
          ...makeAskResponse().deliverables,
          riskAssessmentDraft: riskLine,
          tbmBriefing: tbmLine,
        },
      }),
      qaReview,
      "지게차 상하차",
      false,
      undefined,
      phaseAGrounding,
    );

    expect(result.docpack.evidenceMaterialization).toMatchObject({
      coverage: {
        status: "complete",
        expectedRecordCount: 2,
        materializedRecordCount: 2,
        unresolvedStableKeys: [],
      },
    });
    expect(result.reviewStatus).toMatchObject({
      verdict: "검토 필요",
      verified: false,
      reasonCode: "human_confirmation_pending",
    });
  });

  it("keeps a passing legacy QA non-authoritative when verified records are zero", () => {
    const qaReview = passingQaReview();
    const result = buildReviewedDocpackResult(
      makeAskResponse(),
      qaReview,
      "지게차 상하차",
      false,
      undefined,
      makePhaseAGrounding("resolved"),
    );

    expect(result.docpack.evidenceMaterialization).toMatchObject({
      verifiedRecords: [],
      humanConfirmation: { required: true, status: "pending" },
    });
    expect(result.reviewStatus).toMatchObject({
      verdict: "검토 필요",
      verified: false,
      groundingStatus: "resolved",
      reasonCode: "verified_materialization_missing",
      humanConfirmation: { required: true, status: "pending" },
    });
    expect(result.qa).toMatchObject({ authoritative: false, diagnostic: qaReview });
  });

  it("does not pass resolved grounding when coverage QA is not passing", () => {
    const qaReview: QaReviewFound = {
      ...passingQaReview(),
      missing: {
        hazards: [],
        controls: [{ control: "출입통제", articles: ["제172조"] }],
        articles: [],
      },
      coverageRate: 0,
      verdict: "보완 권장",
    };
    const result = buildReviewedDocpackResult(
      makeAskResponse(),
      qaReview,
      "지게차 상하차",
      false,
      undefined,
      makePhaseAGrounding("resolved"),
    );

    expect(result.reviewStatus).toMatchObject({
      verdict: "검토 필요",
      verified: false,
      groundingStatus: "resolved",
      reasonCode: "qa_coverage_not_passed",
    });
    expect(result.qa).toMatchObject({ authoritative: false, diagnostic: qaReview });
  });

  it.each(["review_required", "missing"] as const)(
    "keeps a diagnostic QA pass non-authoritative for %s grounding",
    (groundingStatus) => {
      const phaseAGrounding = groundingStatus === "review_required"
        ? makePhaseAGrounding("review_required")
        : buildPhaseAGenerationGrounding({
            evidenceChainState: "not_evaluated",
            evidencePack: null,
          });
      const qaReview = passingQaReview();
      const result = buildReviewedDocpackResult(
        makeAskResponse(),
        qaReview,
        "지게차 상하차",
        false,
        undefined,
        phaseAGrounding,
      );

      expect(result.reviewStatus).toMatchObject({
        verdict: "검토 필요",
        verified: false,
        groundingStatus,
        reasonCode: groundingStatus === "review_required"
          ? "phase_a_review_required"
          : "phase_a_evidence_missing",
        humanConfirmation: { required: true, status: "pending" },
      });
      expect(result.reviewStatus.actionableReason.length).toBeGreaterThan(10);
      expect(result.qa).toMatchObject({
        authoritative: false,
        diagnostic: expect.objectContaining({ verdict: "통과" }),
      });
      expect(result.docpack.evidenceMaterialization).toMatchObject({
        verifiedRecords: [],
        humanConfirmation: { required: true, status: "pending" },
      });
      expect(result.openClawUsageNote).toContain("검토 필요");
      expect(result.openClawUsageNote).toContain("verified 근거로 사용하지 마세요");
      expect(result.openClawUsageNote).not.toContain("최종 답변의 근거로 사용");
    },
  );
});

describe("buildHarnessAgentResult", () => {
  it("separates the DB harness agent from general document generation", () => {
    const result = buildHarnessAgentResult({
      question: "성수동 외벽 도장 작업",
      references: [{
        id: "sif-1",
        source_id: "kosha-sif",
        item_type: "sif-case",
        category: "건설",
        subcategory: null,
        title: "외벽 도장 중 추락",
        summary: "재해개요: 외벽 도장 중 추락",
        body: "재해개요: 외벽 도장 중 추락. 위험성 감소대책: 난간 보강.",
        keywords: ["외벽", "도장"],
        risk_tags: ["추락"],
        primary_documents: ["위험성평가표", "TBM 브리핑", "TBM 기록"],
        controls: ["난간 보강"],
        evidence_role: "supporting",
      }],
      workpackMemory: [{
        id: "wp-1",
        question: "지난 외벽 도장 작업",
        generatedAt: "2026-07-01T09:00:00.000Z",
        reflectedDocuments: ["위험성평가표"],
        statusLabel: "저장된 작업팩",
      }],
      referenceSearch: [],
      auth: { source: "db", siteId: "site-1", orgId: "org-1", tokenBound: true },
    });

    expect(result.agentKind).toBe("safeclaw_harness_engineering_agent");
    expect(result.qualityPipeline).toContain("build_db_harness_packet");
    expect(result.packet.generationContract.llmRole).toBe("naturalize_only");
    expect(result.packet.generationContract.fallbackChainAllowed).toBe(false);
    expect(result.packet.retrievalContract.mode).toBe("unconfigured");
    expect(result.promptContext).toContain("작업이력");
    expect(result.openClawUsageNote).toContain("OpenClaw");
  });

  it("keeps search retrieval mode and vector status in the harness agent payload", () => {
    const result = buildHarnessAgentResult({
      question: "성수동 외벽 도장 작업",
      references: [{
        id: "sif-1",
        source_id: "kosha-sif",
        item_type: "sif-case",
        category: "건설",
        subcategory: null,
        title: "외벽 도장 중 추락",
        summary: "재해개요: 외벽 도장 중 추락",
        keywords: ["외벽", "도장"],
        risk_tags: ["추락"],
        primary_documents: ["위험성평가표", "TBM 브리핑"],
        controls: ["난간 보강"],
        evidence_role: "supporting",
        retrieval_source: "hybrid",
      }],
      referenceSearch: [{
        source: "sif_cases",
        ok: true,
        configured: true,
        query: "성수동 외벽 도장 작업",
        count: 1,
        retrievalMode: "hybrid-vector-rpc",
        vectorSearch: {
          enabled: true,
          attempted: true,
          ok: true,
          reason: "ready",
          count: 1,
          model: "text-embedding-3-small",
          message: "SIF 임베딩 RPC 결과를 사용했습니다.",
        },
        message: "vector+ranked",
      }],
    });

    expect(result.packet.retrievalContract.mode).toBe("hybrid-vector-rpc");
    expect(result.packet.retrievalContract.vector.ready).toBe(true);
    expect(result.packet.retrievalContract.sourceCounts.hybrid).toBe(1);
    expect(result.promptContext).toContain("검색 경로: hybrid-vector-rpc / vector=ready");
  });
});

describe("resolveReviewTaskLabel", () => {
  it("corrects a vague model-supplied task from the work question", () => {
    expect(
      resolveReviewTaskLabel(
        "일반 작업",
        "안산 공장 옥외 배관 용접·절단 화기작업. 화재감시자 필요."
      )
    ).toBe("용접");
  });

  it("keeps a registered task label when the model supplied one", () => {
    expect(resolveReviewTaskLabel("화기 작업", "용접·절단 작업")).toBe("화기 작업");
  });
});

describe("buildSanitizeContactsResult", () => {
  it("replaces a fabricated institution+number and returns official contacts", () => {
    const result = buildSanitizeContactsResult("안전보건공단 안산지사 031-555-7788로 신고한다.");
    expect(result.changed).toBe(true);
    expect(result.sanitizedText).not.toContain("031-555-7788");
    expect(result.officialContacts).toEqual(OFFICIAL_CONTACTS);
  });

  it("leaves whitelisted official numbers untouched", () => {
    const result = buildSanitizeContactsResult("근로복지공단 1588-0075로 문의한다.");
    expect(result.changed).toBe(false);
    expect(result.sanitizedText).toContain("1588-0075");
  });
});

describe("buildEvidenceMappingResult", () => {
  it("returns a mapped label for a known docType", () => {
    const result = buildEvidenceMappingResult("riskAssessment");
    expect(result.mapped).toBe(true);
    expect(result.label?.article).toContain("중대재해처벌법 시행령 제4조");
  });

  it("returns mapped=false for an unmapped docType", () => {
    const result = buildEvidenceMappingResult("workpackSummaryDraft");
    expect(result.mapped).toBe(false);
    expect(result.label).toBeUndefined();
  });

  it("returns the full mapping table when docType is omitted", () => {
    const result = buildEvidenceMappingResult();
    expect(result.allMappings).toBeDefined();
    expect(result.allMappings?.riskAssessment).toBeDefined();
  });
});

describe("buildWeatherResult", () => {
  it("summarizes a weather signal into region/summary/actions", () => {
    const result = buildWeatherResult("서울", {
      source: "kma",
      mode: "mock",
      locationLabel: "서울",
      summary: "맑음",
      temperatureC: "25",
      windSpeedMps: "2",
      precipitationProbability: "10",
      actions: ["작업 전 기상 확인"],
      detail: "상세",
      signals: [{ endpoint: "초단기실황", mode: "mock", summary: "실황 요약" }],
    });
    expect(result.region).toBe("서울");
    expect(result.summary).toBe("맑음");
    expect(result.actions).toEqual(["작업 전 기상 확인"]);
    expect(result.signals[0].endpoint).toBe("초단기실황");
  });

  it("marks fallbackRegion=false and echoes requested/resolved region for a supported region", () => {
    const result = buildWeatherResult("부산 해운대 현장", {
      source: "kma",
      mode: "live",
      locationLabel: "부산",
      summary: "맑음",
      actions: [],
      detail: "상세",
      signals: [],
    });
    expect(result.requestedRegion).toBe("부산 해운대 현장");
    expect(result.resolvedRegion).toBe("부산");
    expect(result.fallbackRegion).toBe(false);
  });

  it("marks fallbackRegion=true when an unsupported region falls back to the default (서울)", () => {
    const result = buildWeatherResult("제주", {
      source: "kma",
      mode: "live",
      locationLabel: "서울",
      summary: "맑음",
      actions: [],
      detail: "상세",
      signals: [],
    });
    expect(result.requestedRegion).toBe("제주");
    expect(result.resolvedRegion).toBe("서울");
    expect(result.fallbackRegion).toBe(true);
  });

  it("treats an explicit 서울 request as a genuine match, not a fallback", () => {
    const result = buildWeatherResult("서울", {
      source: "kma",
      mode: "live",
      locationLabel: "서울",
      summary: "맑음",
      actions: [],
      detail: "상세",
      signals: [],
    });
    expect(result.fallbackRegion).toBe(false);
  });
});

describe("isSupportedWeatherRegion", () => {
  it("returns true for supported region keywords", () => {
    expect(isSupportedWeatherRegion("인천 남동공단")).toBe(true);
    expect(isSupportedWeatherRegion("안산")).toBe(true);
    expect(isSupportedWeatherRegion("창원")).toBe(true);
  });

  it("returns false for unsupported region names", () => {
    expect(isSupportedWeatherRegion("제주")).toBe(false);
    expect(isSupportedWeatherRegion("전주")).toBe(false);
  });
});

describe("buildAccidentCasesResult", () => {
  it("summarizes accident cases with count and matched reason", () => {
    const result = buildAccidentCasesResult("비계 추락", {
      mode: "mock",
      cases: [
        {
          title: "비계 추락 사고",
          summary: "3층 비계에서 추락",
          preventionPoint: "안전대 착용",
          matchedReason: "키워드 일치",
        },
      ],
    });
    expect(result.count).toBe(1);
    expect(result.keyword).toBe("비계 추락");
    expect(result.cases[0].title).toBe("비계 추락 사고");
  });
});

describe("tool result helpers", () => {
  it("serializes standalone QA as a diagnostic-only fail-closed MCP contract", () => {
    const result = toToolResult(buildDiagnosticQaReviewResult(passingQaReview()));
    const payload = JSON.parse(result.content[0].text) as Record<string, unknown>;

    expect(payload).not.toHaveProperty("verdict");
    expect(payload).toMatchObject({
      authority: "diagnostic_only",
      reviewStatus: {
        status: "review_required",
        verdict: "검토 필요",
        verified: false,
        authoritative: false,
        humanConfirmation: { required: true, status: "pending" },
      },
      qa: {
        authority: "diagnostic_only",
        diagnostic: { verdict: "통과" },
      },
    });
  });

  it("toToolResult wraps payload as JSON text content", () => {
    const result = toToolResult({ a: 1 });
    expect(result.content[0].type).toBe("text");
    expect(JSON.parse(result.content[0].text)).toEqual({ a: 1 });
  });

  it("toToolError maps Error and non-Error to isError content", () => {
    const fromError = toToolError(new Error("boom"));
    expect(fromError.isError).toBe(true);
    expect(JSON.parse(fromError.content[0].text)).toEqual({
      code: "MCP_TOOL_INTERNAL_ERROR",
      error: "도구 실행 중 오류가 발생했습니다.",
    });
    const fromString = toToolError("plain");
    expect(fromString.isError).toBe(true);
    expect(JSON.parse(fromString.content[0].text)).toEqual({
      code: "MCP_TOOL_INTERNAL_ERROR",
      error: "도구 실행 중 오류가 발생했습니다.",
    });
  });

  it("toToolError fixes authorization output without exposing internal fields", () => {
    const error = Object.assign(new Error("scope details for tenant-secret"), {
      code: "MCP_TOOL_FORBIDDEN",
      secret: "must-not-leak",
    });
    const payload = JSON.parse(toToolError(error).content[0].text) as Record<string, unknown>;

    expect(payload).toEqual({ code: "MCP_TOOL_FORBIDDEN", error: "도구 권한이 없습니다." });
    expect(payload).not.toHaveProperty("secret");
    expect(toToolError(error).content[0].text).not.toContain("tenant-secret");
  });

  it("toToolError hides transport and Supabase-like internal exception details", () => {
    const internal = Object.assign(
      new Error('Supabase response: {"message":"JWT secret leaked","details":"private-row"}'),
      { code: "PGRST301", details: "service-role-secret" },
    );
    const serialized = toToolError(internal).content[0].text;

    expect(JSON.parse(serialized)).toEqual({
      code: "MCP_TOOL_INTERNAL_ERROR",
      error: "도구 실행 중 오류가 발생했습니다.",
    });
    expect(serialized).not.toContain("Supabase");
    expect(serialized).not.toContain("PGRST301");
    expect(serialized).not.toContain("JWT secret leaked");
    expect(serialized).not.toContain("private-row");
    expect(serialized).not.toContain("service-role-secret");
  });
});
