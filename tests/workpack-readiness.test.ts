import { describe, expect, it } from "vitest";

import { buildMockAskResponse, mockSearchResults } from "@/lib/mock-data";
import { buildDbHarnessPacket, buildHarnessPromptContext } from "@/lib/db-harness";
import { assembleGraph } from "@/lib/ontology/graph-store";
import type { QaReviewFound } from "@/lib/ontology/qa-review";
import {
  applyWorkpackDeliverablesChange,
  assessWorkpackReadiness,
  buildWorkpackDeliverablesFingerprint,
  buildWorkpackRevalidationBasis,
  parsePublishedOntologyGraph,
  revalidateEditedWorkpack
} from "@/lib/workpack-readiness";
import type { AskResponse, QualityContract } from "@/lib/types";
import type { SafetyReferenceItem } from "@/lib/safety-reference-catalog";

const readyQuality: QualityContract = {
  overall: "ready",
  summary: "공유 전 핵심 항목이 준비됐습니다.",
  generatedAt: "2026-07-09T00:00:00.000Z",
  items: [
    {
      key: "integrity",
      label: "문서 본문 검수",
      status: "ready",
      detail: "핵심 문서 3/3종의 본문 placeholder와 필수 문구를 확인했습니다."
    }
  ],
  fallback: { hasFallback: false, modes: {} },
  ontology: {
    status: "ready",
    matchCount: 1,
    verdict: "통과",
    detail: "안전조치 검수 통과"
  },
  evidence: {
    status: "ready",
    mappedCount: 3,
    requiredCount: 3,
    detail: "증빙 매핑 완료"
  },
  structured: {
    status: "ready",
    readyCount: 4,
    requiredCount: 4,
    detail: "구조화 완료"
  },
  integrity: {
    status: "ready",
    checkedCount: 3,
    blockedCount: 0,
    blockedKeys: [],
    detail: "핵심 문서 3/3종의 본문 placeholder와 필수 문구를 확인했습니다."
  },
  persistence: {
    status: "ready",
    requiresLogin: true,
    detail: "저장 준비"
  },
  dbHarness: {
    status: "ready",
    directEvidenceCount: 1,
    sifCaseCount: 1,
    supportingEvidenceCount: 1,
    missingEvidence: [],
    documentCoverage: [
      { document: "위험성평가표", covered: true, evidenceTypes: ["directEvidence"] },
      { document: "TBM 브리핑", covered: true, evidenceTypes: ["sifCase"] },
      { document: "TBM 기록", covered: true, evidenceTypes: ["supportingEvidence"] }
    ],
    detail: "DB 하네스 준비"
  }
};

const harnessReferences: SafetyReferenceItem[] = [
  {
    id: "sif-fall-workpack-readiness",
    source_id: "sif",
    item_type: "sif-case",
    category: "건설",
    subcategory: "외벽 도장",
    title: "외벽 도장 추락 SIF 사례",
    summary: "외벽 도장 작업 중 작업발판 점검 미흡으로 추락 위험이 발생한 사례",
    keywords: ["외벽", "도장", "추락"],
    risk_tags: ["추락"],
    primary_documents: ["위험성평가표", "TBM 브리핑", "TBM 기록"],
    controls: ["작업발판 점검", "추락 위험 확인"],
    evidence_role: "direct"
  }
];

function makeResponse(): AskResponse {
  const packet = buildDbHarnessPacket({
    question: "성수동 외벽 도장 작업",
    references: harnessReferences
  });
  return {
    ...buildMockAskResponse("성수동 외벽 도장 작업", mockSearchResults.slice(0, 3), "live", "test"),
    qualityContract: readyQuality,
    ontologyQa: {
      reviewTask: "외벽 도장",
      result: {
        reviewable: true,
        task: "외벽 도장",
        covered: { hazards: ["추락"], controls: ["작업발판 점검"], articles: [] },
        missing: { hazards: [], controls: [], articles: [] },
        coverageRate: 1,
        verdict: "통과",
        advisory: "검수 통과"
      },
      sourceDocumentKeys: ["riskAssessmentDraft", "tbmBriefing"],
      detail: "안전조치 검수 통과"
    },
    dbHarness: {
      packet,
      promptContext: buildHarnessPromptContext(packet),
      summary: {
        mode: "db_harness_first",
        llmRole: "naturalize_only",
        llmOutputScope: "rewrite_fixed_evidence_only",
        evidenceAuthority: "db_harness",
        providerRetryScope: "naturalization_retry_only",
        fallbackChainAllowed: false,
        genericProseSubstitutionAllowed: false,
        missingEvidencePolicy: "surface_review_required",
        directEvidence: 1,
        sifCases: 1,
        supportingEvidence: 1,
        improvementMemory: 0,
        workpackMemory: 0,
        missingEvidence: [],
        documentCoverage: readyQuality.dbHarness.documentCoverage,
        retrievalContract: {} as NonNullable<AskResponse["dbHarness"]>["summary"]["retrievalContract"],
        ontologyStatus: "ready"
      }
    }
  };
}

function makeAmbiguousTaskGraph() {
  return assembleGraph(
    [
      {
        node_id: "Task_welding_work",
        kind: "Task",
        label: "용접 작업",
        text_excerpt: null,
        cited_uids: ["manual:launch-p1-test"],
        meta: {},
        review_state: "published"
      },
      {
        node_id: "Task_hot_work",
        kind: "Task",
        label: "화기 작업",
        text_excerpt: null,
        cited_uids: ["manual:launch-p1-test"],
        meta: {},
        review_state: "published"
      },
      {
        node_id: "Hazard_welding_fume",
        kind: "Hazard",
        label: "용접흄",
        text_excerpt: null,
        cited_uids: ["manual:launch-p1-test"],
        meta: {},
        review_state: "published"
      },
      {
        node_id: "Hazard_fire",
        kind: "Hazard",
        label: "화재",
        text_excerpt: null,
        cited_uids: ["manual:launch-p1-test"],
        meta: {},
        review_state: "published"
      },
      {
        node_id: "Control_welding_mask",
        kind: "Control",
        label: "용접면 착용",
        text_excerpt: null,
        cited_uids: ["manual:launch-p1-test"],
        meta: {},
        review_state: "published"
      },
      {
        node_id: "Control_fire_blanket",
        kind: "Control",
        label: "방화포 설치",
        text_excerpt: null,
        cited_uids: ["manual:launch-p1-test"],
        meta: {},
        review_state: "published"
      }
    ],
    [
      {
        src: "Task_welding_work",
        rel: "entailsHazard",
        dst: "Hazard_welding_fume",
        cited_uids: ["manual:launch-p1-test"],
        meta: {},
        review_state: "published"
      },
      {
        src: "Hazard_welding_fume",
        rel: "mitigatedBy",
        dst: "Control_welding_mask",
        cited_uids: ["manual:launch-p1-test"],
        meta: {},
        review_state: "published"
      },
      {
        src: "Task_hot_work",
        rel: "entailsHazard",
        dst: "Hazard_fire",
        cited_uids: ["manual:launch-p1-test"],
        meta: {},
        review_state: "published"
      },
      {
        src: "Hazard_fire",
        rel: "mitigatedBy",
        dst: "Control_fire_blanket",
        cited_uids: ["manual:launch-p1-test"],
        meta: {},
        review_state: "published"
      }
    ]
  );
}

describe("workpack readiness", () => {
  it("captures only the authoritative original review task for later edited-content revalidation", () => {
    const response = makeResponse();
    response.question = "외벽 도장 작업에서 이동식 비계를 사용한다.";
    response.scenario.workSummary = "외벽 도장";
    response.ontologyQa = {
      ...response.ontologyQa!,
      reviewTask: "외벽 도장"
    };

    expect(buildWorkpackRevalidationBasis(response)).toEqual({
      reviewTasks: ["외벽 도장"],
      source: "generated-ontology-qa"
    });

    response.ontologyQa = undefined;
    expect(buildWorkpackRevalidationBasis(response)).toBeNull();
  });

  it("changes the canonical deliverables fingerprint after any edited document change", () => {
    const response = makeResponse();
    const before = buildWorkpackDeliverablesFingerprint(response.deliverables);
    const edited = applyWorkpackDeliverablesChange(response, {
      tbmBriefing: `${response.deliverables.tbmBriefing}\n추가 편집`
    });

    expect(buildWorkpackDeliverablesFingerprint(edited.deliverables)).not.toBe(before);
    expect(buildWorkpackDeliverablesFingerprint(structuredClone(response.deliverables))).toBe(before);
  });

  it("rejects graph payloads that are not explicitly published or lose required rows during assembly", () => {
    expect(parsePublishedOntologyGraph({
      ok: true,
      scope: "all",
      graph: { nodes: [], edges: [] }
    })).toBeNull();
    expect(parsePublishedOntologyGraph({
      ok: true,
      scope: "published",
      graph: {
        nodes: [{ node_id: "invalid", cited_uids: [] }],
        edges: []
      }
    })).toBeNull();
  });

  it("blocks normal sharing when generated output still has review blockers", () => {
    const response = makeResponse();
    const incompleteQa: QaReviewFound = {
      reviewable: true,
      task: "외벽 도장",
      covered: { hazards: ["추락"], controls: ["작업발판 점검"], articles: [] },
      missing: {
        hazards: [],
        controls: [{ control: "하부 출입통제", articles: ["산업안전보건기준"] }],
        articles: []
      },
      coverageRate: 0.5,
      verdict: "미흡",
      advisory: "검수 미흡"
    };
    response.ontologyQa = {
      ...response.ontologyQa!,
      result: incompleteQa
    };
    response.qualityContract = {
      ...readyQuality,
      overall: "degraded",
      summary: "보완 항목이 남았습니다.",
      dbHarness: {
        ...readyQuality.dbHarness,
        missingEvidence: ["TBM 기록 근거"],
        status: "degraded"
      }
    };
    response.dbHarness = {
      ...response.dbHarness!,
      summary: {
        ...response.dbHarness!.summary,
        missingEvidence: ["TBM 기록 근거"],
        ontologyStatus: "review_required"
      }
    };
    response.deliverables.tbmBriefing += "\n[결재] 작성 ___ / 검토 ___ / 승인 ___";

    const readiness = assessWorkpackReadiness(response);

    expect(readiness.canShare).toBe(false);
    expect(readiness.status).toBe("blocked");
    expect(readiness.summary).toBe("공유 전 보완 필요");
    expect(readiness.reasons.join(" / ")).toContain("안전조치 검수 미통과");
    expect(readiness.reasons.join(" / ")).toContain("품질 검수 보완 필요");
    expect(readiness.reasons.join(" / ")).toContain("검증 근거 보강 필요");
    expect(readiness.reasons.join(" / ")).toContain("결재·서명 placeholder 확인 필요");
  });

  it("allows sharing only when quality, ontology, DB harness, and placeholders are clean", () => {
    const readiness = assessWorkpackReadiness(makeResponse());

    expect(readiness.canShare).toBe(true);
    expect(readiness.status).toBe("ready");
    expect(readiness.summary).toBe("공유 준비됨");
    expect(readiness.reasons).toEqual([]);
  });

  it("fails closed when required quality or ontology review data is missing", () => {
    const response = makeResponse();
    response.qualityContract = undefined;
    response.ontologyQa = undefined;

    const readiness = assessWorkpackReadiness(response);

    expect(readiness.canShare).toBe(false);
    expect(readiness.reasons).toContain("품질 검수 확인 필요");
    expect(readiness.reasons).toContain("안전조치 검수 정보 확인 필요");
  });

  it("requires explicit revalidation after a reviewed workpack is edited", () => {
    const response = makeResponse();
    const edited = applyWorkpackDeliverablesChange(
      response,
      { tbmBriefing: `${response.deliverables.tbmBriefing}\n편집된 안전대책` },
      { requiresRevalidation: true }
    );
    const readiness = assessWorkpackReadiness(edited, { requiresRevalidation: true });

    expect(edited.ontologyQa).toBeUndefined();
    expect(edited.qualityContract?.overall).toBe("blocked");
    expect(edited.qualityContract?.ontology.status).toBe("pending");
    expect(edited.dbHarness).toBe(response.dbHarness);
    expect(edited.deliverables.tbmBriefing).toContain("편집된 안전대책");
    expect(readiness.canShare).toBe(false);
    expect(readiness.status).toBe("blocked");
    expect(readiness.summary).toBe("편집 후 재검수 필요");
    expect(readiness.reasons).toContain("편집된 문서 재검수 필요");
  });

  it("revalidates the edited canonical text and only unlocks a newly passing review", () => {
    const graph = assembleGraph(
      [
        {
          node_id: "Task_high_work",
          kind: "Task",
          label: "외벽 도장",
          text_excerpt: null,
          cited_uids: ["manual:launch-p0-test"],
          meta: {},
          review_state: "published"
        },
        {
          node_id: "Hazard_fall",
          kind: "Hazard",
          label: "추락",
          text_excerpt: null,
          cited_uids: ["manual:launch-p0-test"],
          meta: {},
          review_state: "published"
        },
        {
          node_id: "Control_platform",
          kind: "Control",
          label: "작업발판 점검",
          text_excerpt: null,
          cited_uids: ["manual:launch-p0-test"],
          meta: {},
          review_state: "published"
        }
      ],
      [
        {
          src: "Task_high_work",
          rel: "entailsHazard",
          dst: "Hazard_fall",
          cited_uids: ["manual:launch-p0-test"],
          meta: {},
          review_state: "published"
        },
        {
          src: "Hazard_fall",
          rel: "mitigatedBy",
          dst: "Control_platform",
          cited_uids: ["manual:launch-p0-test"],
          meta: {},
          review_state: "published"
        }
      ]
    );
    const response = makeResponse();
    response.question = "외벽 도장 작업에서 이동식 비계를 사용한다.";
    response.scenario.workSummary = "외벽 도장";
    response.deliverables.workPlanDraft = "";
    response.deliverables.emergencyResponseDraft = "";
    response.ontologyQa = {
      ...response.ontologyQa!,
      reviewTask: "외벽 도장",
      detail: "STALE_QA_MUST_NOT_RETURN"
    };
    const basis = buildWorkpackRevalidationBasis(response);
    const edited = applyWorkpackDeliverablesChange(
      response,
      {
        tbmBriefing: [
          "TBM 사용자 편집 본문",
          "외벽 도장 작업 전 추락 위험을 확인하고 작업발판 점검을 완료한다.",
          "작업자는 TBM에서 보호구 착용, 하부 통제, 작업발판 점검 상태를 복창 확인한다.",
          "관리감독자는 작업 시작 전 사진 기록과 근로자 확인을 남긴다."
        ].join("\n")
      },
      { requiresRevalidation: true }
    );

    const revalidated = revalidateEditedWorkpack(edited, basis, graph, "2026-07-17T00:00:00.000Z");
    const readiness = assessWorkpackReadiness(revalidated);

    expect(revalidated.deliverables.tbmBriefing).toContain("사용자 편집 본문");
    expect(revalidated.ontologyQa?.result.reviewable).toBe(true);
    expect(revalidated.ontologyQa?.result.reviewable && revalidated.ontologyQa.result.verdict).toBe("통과");
    expect(revalidated.ontologyQa?.detail).not.toContain("STALE_QA_MUST_NOT_RETURN");
    expect(revalidated.ontologyQa?.sourceDocumentKeys).toEqual([
      "riskAssessmentDraft",
      "tbmBriefing",
      "tbmLogDraft",
      "safetyEducationRecordDraft"
    ]);
    expect(revalidated.qualityContract?.generatedAt).toBe("2026-07-17T00:00:00.000Z");
    expect(readiness.canShare).toBe(true);
  });

  it("recomputes core document body integrity after deterministic revalidation", () => {
    const graph = assembleGraph(
      [
        {
          node_id: "Task_high_work",
          kind: "Task",
          label: "외벽 도장",
          text_excerpt: null,
          cited_uids: ["manual:launch-p0-test"],
          meta: {},
          review_state: "published"
        },
        {
          node_id: "Hazard_fall",
          kind: "Hazard",
          label: "추락",
          text_excerpt: null,
          cited_uids: ["manual:launch-p0-test"],
          meta: {},
          review_state: "published"
        },
        {
          node_id: "Control_platform",
          kind: "Control",
          label: "작업발판 점검",
          text_excerpt: null,
          cited_uids: ["manual:launch-p0-test"],
          meta: {},
          review_state: "published"
        }
      ],
      [
        {
          src: "Task_high_work",
          rel: "entailsHazard",
          dst: "Hazard_fall",
          cited_uids: ["manual:launch-p0-test"],
          meta: {},
          review_state: "published"
        },
        {
          src: "Hazard_fall",
          rel: "mitigatedBy",
          dst: "Control_platform",
          cited_uids: ["manual:launch-p0-test"],
          meta: {},
          review_state: "published"
        }
      ]
    );
    const response = makeResponse();
    const basis = buildWorkpackRevalidationBasis(response);
    const edited = applyWorkpackDeliverablesChange(
      response,
      {
        riskAssessmentDraft: [
          "위험성평가표",
          "회사명: ____",
          "작업장소: 현장 확인 필요",
          "TODO"
        ].join("\n"),
        tbmBriefing: "추락 위험을 확인하고 작업발판 점검을 완료한다."
      },
      { requiresRevalidation: true }
    );

    const revalidated = revalidateEditedWorkpack(edited, basis, graph, "2026-07-17T00:00:00.000Z");
    const readiness = assessWorkpackReadiness(revalidated);

    expect(revalidated.ontologyQa?.result.reviewable).toBe(true);
    expect(revalidated.ontologyQa?.result.reviewable && revalidated.ontologyQa.result.verdict).toBe("통과");
    expect(revalidated.qualityContract?.integrity?.status).toBe("blocked");
    expect(revalidated.qualityContract?.integrity?.blockedKeys).toContain("riskAssessmentDraft");
    expect(revalidated.qualityContract?.overall).toBe("blocked");
    expect(readiness.canShare).toBe(false);
    expect(readiness.reasons).toContain("품질 검수 보완 필요");
  });

  it("fails closed when deterministic revalidation cannot review the edited task", () => {
    const response = makeResponse();
    const basis = buildWorkpackRevalidationBasis(response);
    const edited = applyWorkpackDeliverablesChange(
      response,
      { tbmBriefing: "사용자 편집 본문" },
      { requiresRevalidation: true }
    );
    const emptyGraph = assembleGraph([], []);

    const revalidated = revalidateEditedWorkpack(edited, basis, emptyGraph, "2026-07-17T00:00:00.000Z");
    const readiness = assessWorkpackReadiness(revalidated);

    expect(revalidated.ontologyQa?.result.reviewable).toBe(false);
    expect(readiness.canShare).toBe(false);
    expect(readiness.reasons).toContain("안전조치 검수 미통과");
  });

  it("fails closed without an unambiguous authoritative revalidation basis", () => {
    const edited = applyWorkpackDeliverablesChange(
      makeResponse(),
      { tbmBriefing: "외벽 도장과 비계 작업 안전조치를 모두 편집했다." },
      { requiresRevalidation: true }
    );
    const graph = assembleGraph([], []);

    const missingBasis = revalidateEditedWorkpack(edited, null, graph, "2026-07-17T00:00:00.000Z");
    const ambiguousBasis = revalidateEditedWorkpack(edited, {
      reviewTasks: ["외벽 도장", "비계 조립·해체"],
      source: "generated-ontology-qa"
    }, graph, "2026-07-17T00:00:00.000Z");

    for (const result of [missingBasis, ambiguousBasis]) {
      expect(result.ontologyQa?.result.reviewable).toBe(false);
      expect(assessWorkpackReadiness(result).canShare).toBe(false);
    }
  });

  it("fails closed when a broad task identity would aggregate multiple published tasks", () => {
    const response = makeResponse();
    const edited = applyWorkpackDeliverablesChange(
      response,
      {
        tbmBriefing: "용접흄과 화재 위험을 확인하고 용접면 착용 및 방화포 설치를 완료한다."
      },
      { requiresRevalidation: true }
    );

    const revalidated = revalidateEditedWorkpack(edited, {
      reviewTasks: ["작업"],
      source: "generated-ontology-qa"
    }, makeAmbiguousTaskGraph(), "2026-07-17T00:00:00.000Z");

    expect(revalidated.ontologyQa?.result.reviewable).toBe(false);
    expect(revalidated.qualityContract?.overall).toBe("blocked");
    expect(assessWorkpackReadiness(revalidated).canShare).toBe(false);
  });

  it("reviews only the single published task whose normalized label exactly matches", () => {
    const response = makeResponse();
    const edited = applyWorkpackDeliverablesChange(
      response,
      {
        riskAssessmentDraft: "",
        workPlanDraft: "",
        tbmBriefing: "TBM 용접흄 위험을 확인하고 용접면 착용을 완료한다. 작업 전 근로자 확인과 보호구 착용 확인을 기록한다.",
        tbmLogDraft: "",
        safetyEducationRecordDraft: "",
        emergencyResponseDraft: ""
      },
      { requiresRevalidation: true }
    );

    const revalidated = revalidateEditedWorkpack(edited, {
      reviewTasks: ["용접 작업"],
      source: "generated-ontology-qa"
    }, makeAmbiguousTaskGraph(), "2026-07-17T00:00:00.000Z");

    expect(revalidated.ontologyQa?.result.reviewable).toBe(true);
    if (!revalidated.ontologyQa?.result.reviewable) throw new Error("Expected exact task review");
    expect(revalidated.ontologyQa.result.task).toBe("용접 작업");
    expect(revalidated.ontologyQa.result.covered.controls).toEqual(["용접면 착용"]);
    expect(revalidated.ontologyQa.sourceDocumentKeys).toEqual(["tbmBriefing"]);
    expect(revalidated.qualityContract?.integrity?.status).toBe("blocked");
    expect(assessWorkpackReadiness(revalidated).canShare).toBe(false);
  });

  it("resolves an approved registry alias only to its canonical published Task", () => {
    const graph = assembleGraph(
      [
        {
          node_id: "Task_work_at_height",
          kind: "Task",
          label: "고소작업",
          text_excerpt: null,
          cited_uids: ["manual:launch-p1-alias-test"],
          meta: {},
          review_state: "published"
        },
        {
          node_id: "Hazard_fall",
          kind: "Hazard",
          label: "추락",
          text_excerpt: null,
          cited_uids: ["manual:launch-p1-alias-test"],
          meta: {},
          review_state: "published"
        },
        {
          node_id: "Control_platform",
          kind: "Control",
          label: "작업발판 점검",
          text_excerpt: null,
          cited_uids: ["manual:launch-p1-alias-test"],
          meta: {},
          review_state: "published"
        }
      ],
      [
        {
          src: "Task_work_at_height",
          rel: "entailsHazard",
          dst: "Hazard_fall",
          cited_uids: ["manual:launch-p1-alias-test"],
          meta: {},
          review_state: "published"
        },
        {
          src: "Hazard_fall",
          rel: "mitigatedBy",
          dst: "Control_platform",
          cited_uids: ["manual:launch-p1-alias-test"],
          meta: {},
          review_state: "published"
        }
      ]
    );
    const response = makeResponse();
    const edited = applyWorkpackDeliverablesChange(
      response,
      {
        tbmBriefing: [
          "TBM 고소작업 추락 위험을 확인하고 작업발판 점검을 완료한다.",
          "작업자는 작업발판 점검, 보호구 착용, 하부 통제 상태를 확인한다.",
          "관리감독자는 TBM 참석 확인과 사진 기록을 남긴다."
        ].join("\n")
      },
      { requiresRevalidation: true }
    );

    const revalidated = revalidateEditedWorkpack(edited, {
      reviewTasks: ["높은 곳 작업"],
      source: "generated-ontology-qa"
    }, graph, "2026-07-17T00:00:00.000Z");

    expect(revalidated.ontologyQa?.result.reviewable).toBe(true);
    if (!revalidated.ontologyQa?.result.reviewable) throw new Error("Expected approved alias review");
    expect(revalidated.ontologyQa.result.task).toBe("고소작업");
    expect(revalidated.qualityContract?.overall).toBe("ready");
  });

  it("fails closed when multiple published Task nodes have the same exact normalized label", () => {
    const graph = makeAmbiguousTaskGraph();
    const duplicateTaskGraph = assembleGraph([
      ...graph.nodes,
      {
        node_id: "Task_welding_work_duplicate",
        kind: "Task",
        label: "용접작업",
        text_excerpt: null,
        cited_uids: ["manual:launch-p1-test"],
        meta: {},
        review_state: "published"
      }
    ], graph.edges);
    const response = makeResponse();
    const edited = applyWorkpackDeliverablesChange(
      response,
      { tbmBriefing: "용접흄 위험을 확인하고 용접면 착용을 완료한다." },
      { requiresRevalidation: true }
    );

    const revalidated = revalidateEditedWorkpack(edited, {
      reviewTasks: ["용접 작업"],
      source: "generated-ontology-qa"
    }, duplicateTaskGraph, "2026-07-17T00:00:00.000Z");

    expect(revalidated.ontologyQa?.result.reviewable).toBe(false);
    expect(revalidated.qualityContract?.overall).toBe("blocked");
    expect(assessWorkpackReadiness(revalidated).canShare).toBe(false);
  });

  it("fails closed when the published task has no required hazard-control evidence path", () => {
    const response = makeResponse();
    const basis = buildWorkpackRevalidationBasis(response);
    const edited = applyWorkpackDeliverablesChange(
      response,
      { tbmBriefing: "사용자 편집 본문" },
      { requiresRevalidation: true }
    );
    const taskOnlyGraph = assembleGraph([{
      node_id: "Task_high_work",
      kind: "Task",
      label: "외벽 도장",
      text_excerpt: null,
      cited_uids: ["manual:published-test-task"],
      meta: {},
      review_state: "published"
    }], []);
    expect(taskOnlyGraph.nodes).toHaveLength(1);

    const revalidated = revalidateEditedWorkpack(
      edited,
      basis,
      taskOnlyGraph,
      "2026-07-17T00:00:00.000Z"
    );

    expect(revalidated.ontologyQa?.result.reviewable).toBe(false);
    expect(revalidated.qualityContract?.overall).toBe("blocked");
    expect(assessWorkpackReadiness(revalidated).canShare).toBe(false);
  });
});
