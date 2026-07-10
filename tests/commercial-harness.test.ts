import { describe, expect, it } from "vitest";

import {
  buildDbHarnessAnswer,
  buildDbHarnessPacket,
  buildDbHarnessPracticalPoints,
  buildDbHarnessSurfaceContract,
  buildHarnessPromptContext,
  hasDocumentCoverage,
  parseHarnessMemoryInput
} from "@/lib/db-harness";
import { buildMockAskResponse, mockSearchResults } from "@/lib/mock-data";
import { validateRiskAssessmentRows } from "@/lib/risk-assessment-schema";
import { attachDbHarnessFallback, buildSafetyReferenceRiskRows, normalizeSafetyTermTypos, runAsk } from "@/lib/search";
import { buildSifEmbeddingBatchManifest, buildSifEmbeddingCorpus, isEmbeddableSifReferenceItem, toSifEmbeddingJsonl } from "@/lib/sif-embedding-corpus";
import type { SafetyReferenceItem } from "@/lib/safety-reference-catalog";
import {
  buildWorkpackLearningFile,
  buildWorkpackLearningJsonl,
  buildWorkpackLearningMarkdown,
  normalizeLearningVisionPayload,
  normalizeWorkpackLearningFormat
} from "@/lib/workpack-learning-export";

describe("safety term normalization", () => {
  it("blocks observed forklift typos before generated documents reach the UI", () => {
    const text = "지게브 동선과 비계 설치 위치를 구분하고, 지게브 후진 시 신호수를 배치한다.";

    expect(normalizeSafetyTermTypos(text)).toBe(
      "지게차 동선과 비계 설치 위치를 구분하고, 지게차 후진 시 신호수를 배치한다."
    );
  });
});

function reference(overrides: Partial<SafetyReferenceItem> = {}): SafetyReferenceItem {
  return {
    id: "sif-1",
    source_id: "kosha-sif-archive-20260401",
    item_type: "sif-case",
    category: "건설",
    subcategory: null,
    title: "외벽 도장 중 추락 사례",
    summary: "이동식 비계에서 추락 위험이 확인된 사례",
    body: "재해개요: 작업발판과 난간 상태 미확인으로 추락 위험이 확인됨. 위험성 감소대책: 작업발판·난간 확인.",
    keywords: ["외벽", "도장", "추락"],
    risk_tags: ["추락"],
    primary_documents: ["위험성평가표", "TBM 브리핑", "TBM 기록"],
    controls: ["작업발판·난간 확인", "안전대 체결"],
    evidence_role: "supporting",
    ...overrides
  };
}

describe("SIF embedding corpus", () => {
  it("keeps only SIF cases and creates stable embedding text", () => {
    const corpus = buildSifEmbeddingCorpus([
      reference(),
      reference({ id: "guide-1", item_type: "technical-guideline", title: "기술지침" })
    ]);

    expect(corpus).toHaveLength(1);
    expect(corpus[0].referenceItemId).toBe("sif-1");
    expect(corpus[0].embeddingText).toContain("산업재해 고위험요인(SIF) 사례");
    expect(corpus[0].embeddingText).toContain("작업발판");
    expect(corpus[0].contentHash).toHaveLength(64);
    expect(toSifEmbeddingJsonl(corpus)).toContain("\"referenceItemId\":\"sif-1\"");
  });

  it("skips SIF spreadsheet header rows before embedding", () => {
    const header = reference({
      id: "sif-header",
      title: "공종 / 작업명",
      summary: "고위험작업·상황: 공종 column_4: 작업명",
      body: "고위험작업·상황: 공종 column_4: 작업명",
      risk_tags: []
    });

    expect(isEmbeddableSifReferenceItem(header)).toBe(false);
    expect(buildSifEmbeddingCorpus([header])).toEqual([]);
  });

  it("builds an approval-gated deterministic batch manifest before embedding upload", () => {
    const corpus = buildSifEmbeddingCorpus([
      reference({ id: "sif-1" }),
      reference({ id: "sif-2", title: "지게차 동선 충돌 사례" }),
      reference({ id: "sif-3", title: "작업발판 단부 추락 사례" })
    ]);
    const manifest = buildSifEmbeddingBatchManifest(corpus, {
      embeddingModel: "text-embedding-3-small",
      batchSize: 2,
      generatedAt: "2026-07-09T00:00:00.000Z"
    });

    expect(manifest.recordCount).toBe(3);
    expect(manifest.batchCount).toBe(2);
    expect(manifest.batches.map((batch) => batch.recordCount)).toEqual([2, 1]);
    expect(manifest.corpusHash).toHaveLength(64);
    expect(manifest.batches[0].referenceItemIds).toEqual(["sif-1", "sif-2"]);
    expect(manifest.approvalGate.dbMutationPerformed).toBe(false);
    expect(manifest.approvalGate.requiresApprovedUploadFlag).toBe(true);
  });
});

describe("DB harness packet", () => {
  it("requires SIF evidence and locks the LLM into naturalization only", () => {
    const packet = buildDbHarnessPacket({
      question: "성수동 외벽 도장 작업",
      references: [reference()],
      improvements: [{
        id: "imp-1",
        taskLabel: "성수동 외벽 도장",
        hazardLabel: "추락",
        improvementText: "작업발판 난간 보강",
        reflectedDocuments: ["위험성평가표", "TBM 브리핑"],
        sourceType: "photo_analysis",
        visionStatus: "analyzed",
        analysisMode: "vision_ocr",
        photoPairAttached: true,
        visionUserLabel: "vision/OCR 분석 완료",
        visionSummary: "난간이 보강된 것으로 보입니다.",
        detectedHazards: ["추락", "하부 통제 미흡"],
        observedImprovement: "작업발판 외측 난간 보강",
        ocrText: "추락주의"
      }]
    });
    const promptContext = buildHarnessPromptContext(packet);
    const surfaceContract = buildDbHarnessSurfaceContract(packet);

    expect(packet.mode).toBe("db_harness_first");
    expect(packet.sifCases).toHaveLength(1);
    expect(packet.generationContract.llmRole).toBe("naturalize_only");
    expect(packet.generationContract.llmOutputScope).toBe("rewrite_fixed_evidence_only");
    expect(packet.generationContract.evidenceAuthority).toBe("db_harness");
    expect(packet.generationContract.providerRetryScope).toBe("naturalization_retry_only");
    expect(packet.generationContract.fallbackChainAllowed).toBe(false);
    expect(packet.generationContract.genericProseSubstitutionAllowed).toBe(false);
    expect(packet.generationContract.missingEvidencePolicy).toBe("surface_review_required");
    expect(packet.retrievalContract).toMatchObject({
      source: "safety_reference_items",
      mode: "rest-ilike",
      vector: {
        enabled: false,
        attempted: false,
        ready: false,
        reason: "disabled"
      },
      sourceCounts: {
        directEvidence: 0,
        sifCases: 1,
        supportingEvidence: 1
      }
    });
    expect(packet.generationContract.documentCoverage).toEqual([
      { document: "위험성평가표", covered: true, evidenceTypes: ["sifCase", "supportingEvidence", "improvementMemory"] },
      { document: "TBM 브리핑", covered: true, evidenceTypes: ["sifCase", "supportingEvidence", "improvementMemory"] },
      { document: "TBM 기록", covered: true, evidenceTypes: ["sifCase", "supportingEvidence"] }
    ]);
    expect(hasDocumentCoverage(packet, "TBM 기록")).toBe(true);
    expect(promptContext).toContain("DB harness가 고정한 근거");
    expect(promptContext).toContain("근거 권위: safety_reference_items");
    expect(promptContext).toContain("검색 경로: rest-ilike / vector=disabled");
    expect(promptContext).toContain("검색 출처: direct 0, SIF 1, supporting 1");
    expect(promptContext).toContain("제공자 재시도");
    expect(promptContext).toContain("문장화 실패 복구에만 허용");
    expect(promptContext).toContain("산문으로 메우지 않는다");
    expect(promptContext).toContain("visionStatus: analyzed");
    expect(promptContext).toContain("analysisMode: vision_ocr");
    expect(promptContext).toContain("photoPair: before/after attached");
    expect(promptContext).toContain("visionLabel: vision/OCR 분석 완료");
    expect(promptContext).toContain("detected: 추락, 하부 통제 미흡");
    expect(promptContext).toContain("observed: 작업발판 외측 난간 보강");
    expect(promptContext).toContain("ocr: 추락주의");
    expect(surfaceContract).toMatchObject({
      label: "DB 하네스 계약",
      status: "locked",
      headline: "DB 근거 고정 · LLM 문장화 전용",
      meta: "rest-ilike · vector 승인 전"
    });
    expect(surfaceContract.detail).toContain("고정 근거");
    expect(surfaceContract.detail).toContain("필수 문서 3/3종 커버");
    expect(surfaceContract.missing).toEqual([]);
  });

  it("carries vector retrieval status into the DB harness packet after approval", () => {
    const packet = buildDbHarnessPacket({
      question: "성수동 외벽 도장 작업",
      references: [
        reference({ retrieval_source: "hybrid", vector_similarity: 0.82 }),
        reference({
          id: "guide-1",
          item_type: "technical-guideline",
          evidence_role: "direct",
          retrieval_source: "ranked",
          title: "KOSHA 외벽 도장 지침"
        })
      ],
      retrieval: {
        mode: "hybrid-vector-rpc",
        vectorSearch: {
          enabled: true,
          attempted: true,
          ok: true,
          reason: "ready",
          count: 1,
          model: "text-embedding-3-small",
          message: "SIF 임베딩 RPC 결과를 ranked/text 근거와 함께 사용했습니다."
        },
        message: "vector+ranked 하이브리드"
      }
    });
    const promptContext = buildHarnessPromptContext(packet);

    expect(packet.retrievalContract.mode).toBe("hybrid-vector-rpc");
    expect(packet.retrievalContract.vector).toMatchObject({
      enabled: true,
      attempted: true,
      ready: true,
      reason: "ready"
    });
    expect(packet.retrievalContract.sourceCounts).toMatchObject({
      directEvidence: 1,
      sifCases: 1,
      supportingEvidence: 1,
      hybrid: 1,
      ranked: 1
    });
    expect(promptContext).toContain("검색 경로: hybrid-vector-rpc / vector=ready");
    expect(promptContext).toContain("hybrid 1, vector 0, ranked 1");
  });

  it("marks missing SIF as review-required", () => {
    const packet = buildDbHarnessPacket({
      question: "성수동 외벽 도장 작업",
      references: [reference({ item_type: "technical-guideline", evidence_role: "direct" })]
    });
    const surfaceContract = buildDbHarnessSurfaceContract(packet);

    expect(packet.ontologyChecklist.status).toBe("review_required");
    expect(packet.ontologyChecklist.missing).toContain("SIF 유사사례");
    expect(surfaceContract.status).toBe("review_required");
    expect(surfaceContract.missing).toContain("SIF 유사사례");
  });

  it("accepts client-supplied operation improvement memory for the generation harness", () => {
    const harnessMemory = parseHarnessMemoryInput({
      improvements: [{
        id: "local-improvement-1",
        taskLabel: "성수동 외벽 도장",
        hazardLabel: "추락",
        improvementText: "오전 작업 전 이동식 비계 난간을 보강함",
        reflectedDocuments: ["위험성평가표", "TBM 브리핑", "TBM 기록"],
        sourceType: "photo_analysis",
        visionStatus: "analyzed",
        analysisMode: "vision_ocr",
        photoPairAttached: true,
        visionSummary: "After 사진에서 난간 보강이 확인됩니다.",
        detectedHazards: ["추락"],
        observedImprovement: "비계 단부 난간 보강",
        ocrText: "작업중 출입금지"
      }, {
        id: "",
        taskLabel: "invalid",
        hazardLabel: "invalid",
        improvementText: "invalid",
        reflectedDocuments: [],
        sourceType: "manual"
      }],
      workpackMemory: [{
        id: "wp-1",
        question: "지난주 성수동 외벽 도장",
        generatedAt: "2026-07-08T00:00:00.000Z",
        reflectedDocuments: ["위험성평가표"],
        statusLabel: "문서팩 준비됨"
      }]
    });
    const packet = buildDbHarnessPacket({
      question: "성수동 외벽 도장 작업",
      references: [reference()],
      improvements: harnessMemory.improvements,
      workpackMemory: harnessMemory.workpackMemory
    });
    const promptContext = buildHarnessPromptContext(packet);

    expect(harnessMemory.improvements).toHaveLength(1);
    expect(harnessMemory.workpackMemory).toHaveLength(1);
    expect(packet.improvementMemory).toHaveLength(1);
    expect(packet.workpackMemory).toHaveLength(1);
    expect(packet.generationContract.missingEvidence).toEqual([]);
    expect(packet.generationContract.documentCoverage.every((item) => item.covered)).toBe(true);
    expect(promptContext).toContain("개선이력: 추락 -> 오전 작업 전 이동식 비계 난간을 보강함");
    expect(promptContext).toContain("visionStatus: analyzed");
    expect(promptContext).toContain("작업이력: 2026-07-08T00:00:00.000Z · 지난주 성수동 외벽 도장 · 문서팩 준비됨");
  });

  it("builds the visible judgment summary from the DB harness packet before generic answer text", () => {
    const packet = buildDbHarnessPacket({
      question: "성수동 외벽 도장 작업",
      references: [
        reference(),
        reference({
          id: "guide-1",
          item_type: "technical-guideline",
          evidence_role: "direct",
          title: "KOSHA 외벽 도장 추락 예방 지침",
          controls: ["작업발판 사전 점검", "하부 출입 통제"]
        })
      ],
      improvements: [{
        id: "imp-1",
        taskLabel: "성수동 외벽 도장",
        hazardLabel: "추락",
        improvementText: "작업 전 난간 보강 사진 확인",
        reflectedDocuments: ["위험성평가표", "TBM 브리핑", "TBM 기록"],
        sourceType: "photo_analysis",
        detectedHazards: ["추락"]
      }]
    });
    const answer = buildDbHarnessAnswer(packet);
    const points = buildDbHarnessPracticalPoints(packet);

    expect(answer).toContain("1) 하네스 판단");
    expect(answer).toContain("직접 근거: KOSHA 외벽 도장 추락 예방 지침");
    expect(answer).toContain("SIF 유사사례: 외벽 도장 중 추락 사례");
    expect(answer).toContain("작업 전 난간 보강 사진 확인");
    expect(answer).not.toContain("일반 AI 답변");
    expect(answer).not.toMatch(/fallback|OPENAI_API_KEY|timeout|AI_MODE/i);
    expect(points[0]).toContain("문서 반영 전 확인");
    expect(points).toContain("위험성평가표에 같은 위험요인·조치·확인자를 연결");
  });

  it("does not fall back to generic LLM prose when the DB harness has no evidence", () => {
    const packet = buildDbHarnessPacket({
      question: "성수동 외벽 도장 작업",
      references: []
    });
    const answer = buildDbHarnessAnswer(packet);
    const points = buildDbHarnessPracticalPoints(packet);

    expect(packet.generationContract.fallbackChainAllowed).toBe(false);
    expect(packet.generationContract.genericProseSubstitutionAllowed).toBe(false);
    expect(packet.generationContract.documentCoverage.every((item) => item.covered)).toBe(false);
    expect(answer).toContain("DB 하네스가 사용할 직접 근거");
    expect(answer).toContain("보강 필요");
    expect(answer).not.toContain("일반 AI 답변");
    expect(answer).not.toMatch(/fallback|OPENAI_API_KEY|timeout|AI_MODE/i);
    expect(points).toContain("위험성평가표 근거 보강 후 전파");
    expect(points).not.toContain("일반 체크포인트");
  });
});

describe("runAsk DB harness mode", () => {
  it("turns safety reference matches into deterministic risk rows before generic baseline rows", () => {
    const response = buildMockAskResponse(
      "성수동 외벽 도장 작업, 이동식 비계 사용, 오후 강풍 예보",
      mockSearchResults,
      "mock",
      "테스트"
    );
    const rows = buildSafetyReferenceRiskRows(response, [
      reference({
        id: "kosha-direct-1",
        item_type: "technical-guideline",
        category: "추락",
        subcategory: "이동식 비계",
        title: "이동식 비계 작업발판·난간 점검 지침",
        summary: "외벽 도장 작업 전 난간, 작업발판, 아웃트리거 상태를 확인합니다.",
        controls: ["작업발판·난간·아웃트리거 사전 점검", "강풍 시 상부 작업 중지"],
        evidence_role: "direct",
        retrieval_source: "ranked"
      }),
      reference({
        id: "sif-support-1",
        item_type: "sif-case",
        category: "SIF",
        subcategory: "추락",
        title: "외벽 도장 중 이동식 비계 추락 사례",
        controls: ["작업 전 방호조치 사진 확인", "TBM에서 작업중지 기준 복창"],
        evidence_role: "supporting",
        retrieval_source: "hybrid"
      }),
      reference({
        id: "generic-kosha-1",
        item_type: "technical-guideline",
        category: "산업안전일반분야",
        subcategory: "기술지침",
        title: "G-67-2011 건물 외벽 청소 작업에 관한 기술지침",
        controls: ["작업 전 유해·위험요인 확인", "관리감독자 확인 후 작업 시작"],
        evidence_role: "supporting",
        retrieval_source: "rest"
      })
    ], "오후 강풍 예보");

    expect(rows.length).toBeGreaterThanOrEqual(5);
    expect(validateRiskAssessmentRows(rows).issues).toEqual([]);
    expect(rows[0].hazard).toContain("추락 위험");
    expect(rows[0].hazard).toContain("작업발판·난간·아웃트리거");
    expect(rows[0].hazard).toMatch(/미점검|미확인|미이행/);
    expect(rows[0].hazard).not.toContain("이동식 비계 작업발판·난간 점검 지침");
    expect(rows[0].currentControls).toContain("작업발판·난간·아웃트리거 사전 점검");
    expect(rows[0].additionalControls).toContain("강풍 시 상부 작업 중지");
    expect(rows[0].evidenceRefs).toEqual(expect.arrayContaining([
      "DB 하네스 직접근거",
      "이동식 비계 작업발판·난간 점검 지침",
      "검색: ranked"
    ]));
    expect(rows.some((row) => row.evidenceRefs?.includes("외벽 도장 중 이동식 비계 추락 사례"))).toBe(true);
    expect(rows.every((row) => !/^[A-Z]-[A-Z]-\d{1,4}-\d{4}/.test(row.hazard))).toBe(true);
    expect(rows.every((row) => !/기술지원규정|기술지침/.test(row.hazard))).toBe(true);
    const genericHazardRow = rows.find((row) => row.hazard.includes("유해·위험요인 미확인"));
    expect(genericHazardRow).toBeDefined();
    expect(genericHazardRow?.hazard).not.toContain("관련 위험");
    expect(rows.every((row) => !/위험.*관련 위험/.test(row.hazard))).toBe(true);
  });

  it("preserves upstream task-specific rerank order when building risk rows", () => {
    const response = buildMockAskResponse(
      "부산 해운대 지하 기계실 배수펌프 점검, 밀폐공간 진입 전 환기와 산소농도 측정, LOTO, 누수 바닥",
      mockSearchResults,
      "mock",
      "테스트"
    );
    const rows = buildSafetyReferenceRiskRows(response, [
      reference({
        id: "confined-sif-first",
        item_type: "sif-case",
        category: "기타의사업",
        subcategory: "시설관리및사업지원서비스업",
        title: "지하 기계실 배수펌프 정비 중 산소결핍 및 불시기동 끼임 사례",
        summary: "밀폐공간 진입 전 산소농도 측정, 환기, 감시인 배치, 배수펌프 전원 차단 및 잠금표지 미흡",
        controls: ["진입 전 산소·유해가스 농도 측정", "배수펌프 전원 차단 및 잠금표지"],
        evidence_role: "supporting",
        retrieval_source: "ranked"
      }),
      reference({
        id: "broad-direct-second",
        item_type: "technical-support-regulation",
        category: "산업안전일반분야",
        subcategory: "기술지원규정",
        title: "A-G-15-2026 중소규모 사업장 비상조치계획 작성에 관한 기술지원규정",
        summary: "사업장 비상조치계획 작성과 연락체계 기준",
        controls: ["비상조치계획 수립", "연락체계 확인"],
        evidence_role: "direct",
        retrieval_source: "ranked"
      })
    ], "단시간 구름많음", "부산 해운대 지하 기계실 배수펌프 점검, 밀폐공간 진입 전 환기와 산소농도 측정, LOTO, 누수 바닥");

    expect(rows[0].evidenceRefs).toEqual(expect.arrayContaining([
      "지하 기계실 배수펌프 정비 중 산소결핍 및 불시기동 끼임 사례"
    ]));
    expect(rows[0].hazard).toMatch(/산소|질식|끼임|배수펌프|잠금표지/);
  });

  it("keeps template mode inside the DB harness contract without generic LLM fallback prose", async () => {
    const response = await runAsk("성수동 외벽 도장 작업", {
      aiMode: "template",
      harnessMemory: {
        improvements: [{
          id: "imp-template-1",
          taskLabel: "성수동 외벽 도장",
          hazardLabel: "추락",
          improvementText: "작업 전 난간 보강 사진 확인",
          reflectedDocuments: ["위험성평가표", "TBM 브리핑"],
          sourceType: "photo_analysis",
          visionStatus: "analyzed",
          analysisMode: "vision_ocr",
          photoPairAttached: true
        }]
      }
    });

    expect(response.mode).toBe("mock");
    expect(response.dbHarness?.packet.mode).toBe("db_harness_first");
    expect(response.dbHarness?.summary.llmRole).toBe("naturalize_only");
    expect(response.dbHarness?.summary.llmOutputScope).toBe("rewrite_fixed_evidence_only");
    expect(response.dbHarness?.summary.evidenceAuthority).toBe("db_harness");
    expect(response.dbHarness?.summary.providerRetryScope).toBe("naturalization_retry_only");
    expect(response.dbHarness?.summary.fallbackChainAllowed).toBe(false);
    expect(response.dbHarness?.summary.genericProseSubstitutionAllowed).toBe(false);
    expect(response.dbHarness?.summary.missingEvidencePolicy).toBe("surface_review_required");
    expect(response.dbHarness?.summary.documentCoverage.some((item) => item.document === "위험성평가표" && item.covered)).toBe(true);
    expect(response.dbHarness?.summary.improvementMemory).toBe(1);
    expect(response.answer).toContain("하네스 판단");
    expect(response.answer).toContain("작업 전 난간 보강 사진 확인");
    expect(response.deliverables.riskAssessmentDraft).toContain("작업 전 난간 보강 사진 확인");
    expect(response.deliverables.tbmBriefing).toContain("작업 전 난간 보강 사진 확인");
    expect(response.deliverables.tbmLogDraft).toContain("작업 전 난간 보강 사진 확인");
    expect(response.deliverables.riskAssessmentDraft.indexOf("[오늘 개선·이력 반영 - 위험성평가]")).toBeLessThan(120);
    expect(response.deliverables.tbmBriefing.indexOf("[오늘 개선·이력 반영 - TBM]")).toBeLessThan(120);
    expect(response.deliverables.tbmLogDraft.indexOf("[오늘 개선·이력 반영 - 확인 기록]")).toBeLessThan(120);
    expect(response.deliverables.photoEvidenceDraft).toContain("Before/After 사진 첨부");
    expect(response.answer).not.toMatch(/fallback|OPENAI_API_KEY|timeout/i);
    expect(response.practicalPoints).toContain("문서 반영 전 확인: 작업 전 난간 보강 사진 확인");
    expect(response.qualityContract?.dbHarness.status).toBe("blocked");
  });

  it("keeps enhanced mode row-first without waiting for AI document bodies", async () => {
    const response = await runAsk("성수동 외벽 도장 작업, 이동식 비계 사용, 작업자 5명, 오후 강풍 예보", {
      aiMode: "enhanced",
      harnessMemory: {
        improvements: [{
          id: "imp-enhanced-row-1",
          taskLabel: "성수동 외벽 도장 작업",
          hazardLabel: "작업발판 외측 추락 위험",
          improvementText: "사진 위험요인 확인 및 조치 후보: 작업면 가장자리 난간 상태를 현장 확인",
          reflectedDocuments: ["위험성평가표", "TBM 브리핑", "TBM 기록"],
          sourceType: "photo_analysis",
          visionStatus: "analyzed",
          analysisMode: "vision_ocr",
          photoPairAttached: false,
          detectedHazards: ["작업발판 외측 추락 위험", "severity:high"],
          observedImprovement: "난간·끝막이판 설치 여부 확인",
          sourcePhotoNames: ["before.jpg"],
          siteSignals: ["비계", "외벽", "단부"],
          visionEvidence: "before.jpg에서 작업면 단부가 노출되어 보임"
        }]
      }
    });

    expect(response.generationMode).toBe("enhanced");
    expect(response.status.detail).toContain("AI_MODE=enhanced (DB 하네스 row-first");
    expect(response.status.detail).toMatch(/structured rows=(DB harness deterministic|deterministic baseline)/);
    expect(response.status.detail).toContain("TBM structured=deterministic from risk rows");
    expect(response.status.detail).not.toContain("문서 생성기 미응답");
    expect(response.status.detail).not.toContain("Gemini 본문");
    expect(response.structured?.riskAssessmentRows.length).toBeGreaterThanOrEqual(5);
    expect(response.structured?.riskAssessmentRows.some((row) => row.hazard.includes("작업발판 외측 추락 위험"))).toBe(true);
    expect(response.structured?.tbmRiskLinks?.some((link) => link.hazard.includes("작업발판 외측 추락 위험"))).toBe(true);
    expect(response.structured?.tbmRiskLinks?.every((link) => !/위험\s*위험/.test(link.confirmQuestion))).toBe(true);
    expect(response.deliverables.tbmBriefingStructured?.hazards.length).toBeGreaterThan(0);
    expect(response.deliverables.tbmLogStructured?.hazardsDiscussed.length).toBeGreaterThan(0);
  }, 20_000);

  it("turns accepted photo hazard memory into deterministic risk rows and TBM links", async () => {
    const response = await runAsk("성수동 외벽 도장 작업, 이동식 비계 사용", {
      aiMode: "template",
      harnessMemory: {
        improvements: [{
          id: "input-photo-hazard-1",
          taskLabel: "성수동 외벽 도장 작업",
          hazardLabel: "작업발판 외측 추락 위험",
          improvementText: "사진 위험요인 확인 및 조치 후보: 작업면 가장자리 난간 상태를 현장 확인",
          reflectedDocuments: ["위험성평가표", "TBM 브리핑", "TBM 기록"],
          sourceType: "photo_analysis",
          visionStatus: "analyzed",
          analysisMode: "vision_ocr",
          photoPairAttached: false,
          visionUserLabel: "vision/OCR 사진 분석",
          visionSummary: "작업발판 외측이 노출되어 보입니다.",
          detectedHazards: ["작업발판 외측 추락 위험", "severity:high"],
          observedImprovement: "난간·끝막이판 설치 여부 확인",
          ocrText: "추락주의",
          sourcePhotoNames: ["scaffold-before.jpg", "scaffold-after.jpg"],
          photoCount: 2,
          siteSignals: ["비계", "외벽", "단부"],
          visionEvidence: "scaffold-before.jpg에서 작업면 단부가 노출되어 보임"
        }]
      }
    });

    const photoRow = response.structured?.riskAssessmentRows.find((row) =>
      row.hazard.includes("작업발판 외측 추락 위험")
    );
    expect(photoRow).toMatchObject({
      task: "성수동 외벽 도장 작업",
      hazard: "작업발판 외측 추락 위험",
      riskLevel: "high",
      verificationStatus: "planned",
      verificationChecker: "관리감독자"
    });
    expect(photoRow?.currentControls).toContain("사진 위험요인 확인");
    expect(photoRow?.additionalControls).toContain("난간·끝막이판 설치 여부 확인");
    expect(photoRow?.evidenceRefs).toEqual(expect.arrayContaining([
      "사진: scaffold-before.jpg, scaffold-after.jpg",
      "OCR: 추락주의",
      "vision/OCR 사진 분석"
    ]));

    const photoLink = response.structured?.tbmRiskLinks?.find((link) =>
      link.hazard.includes("작업발판 외측 추락 위험")
    );
    expect(photoLink?.confirmQuestion).toContain("작업발판 외측 추락 위험");
    expect(photoLink?.evidenceRefs).toContain("vision/OCR 사진 분석");
  });

  it("wraps provider fallback output with the DB harness contract before returning it", () => {
    const question = "성수동 외벽 도장 작업";
    const response = attachDbHarnessFallback(
      buildMockAskResponse(
        question,
        [],
        "fallback",
        "외부 생성 실패"
      ),
      {
        question,
        harnessMemory: {
          improvements: [{
            id: "imp-fallback-1",
            taskLabel: "성수동 외벽 도장",
            hazardLabel: "추락",
            improvementText: "비계 난간 보강 전후 사진을 TBM에 반영",
            reflectedDocuments: ["위험성평가표", "TBM 브리핑"],
            sourceType: "photo_analysis",
            visionStatus: "analyzed",
            analysisMode: "vision_ocr",
            photoPairAttached: true,
            visionUserLabel: "사진 2장 분석 완료",
            visionSummary: "상부 난간 보강과 하부 통제선 설치가 확인됩니다.",
            detectedHazards: ["추락", "하부 낙하물"],
            observedImprovement: "상부 난간 추가 설치",
            ocrText: "추락주의",
            sourcePhotoNames: ["before.jpg", "after.jpg"],
            siteSignals: ["외벽", "이동식 비계"],
            visionEvidence: "after 사진에서 중간난간과 끝막이판이 식별됨"
          }],
          workpackMemory: []
        }
      }
    );

    expect(response.mode).toBe("fallback");
    expect(response.dbHarness?.packet.mode).toBe("db_harness_first");
    expect(response.dbHarness?.summary.llmRole).toBe("naturalize_only");
    expect(response.dbHarness?.summary.fallbackChainAllowed).toBe(false);
    expect(response.dbHarness?.summary.genericProseSubstitutionAllowed).toBe(false);
    expect(response.dbHarness?.summary.improvementMemory).toBe(1);
    expect(response.answer).toContain("하네스 판단");
    expect(response.answer).toContain("비계 난간 보강 전후 사진을 TBM에 반영");
    expect(response.deliverables.riskAssessmentDraft).toContain("비계 난간 보강 전후 사진을 TBM에 반영");
    expect(response.deliverables.tbmBriefing).toContain("비계 난간 보강 전후 사진을 TBM에 반영");
    expect(response.deliverables.tbmLogDraft).toContain("비계 난간 보강 전후 사진을 TBM에 반영");
    expect(response.deliverables.riskAssessmentDraft.indexOf("[오늘 개선·이력 반영 - 위험성평가]")).toBeLessThan(120);
    expect(response.deliverables.tbmBriefing.indexOf("[오늘 개선·이력 반영 - TBM]")).toBeLessThan(120);
    expect(response.deliverables.tbmLogDraft.indexOf("[오늘 개선·이력 반영 - 확인 기록]")).toBeLessThan(120);
    expect(response.deliverables.photoEvidenceDraft).toContain("Before/After 사진 첨부");
    expect(response.deliverables.photoEvidenceDraft).toContain("before.jpg, after.jpg");
    expect(response.deliverables.photoEvidenceDraft).toContain("추락주의");
    expect(response.deliverables.photoEvidenceDraft).toContain("after 사진에서 중간난간과 끝막이판이 식별됨");
    expect(response.deliverables.riskAssessmentDraft).toContain("추락, 하부 낙하물");
    expect(response.answer).not.toContain("외부 생성 실패");
    expect(response.status.detail).toContain("DB 하네스 계약");
    expect(response.qualityContract?.dbHarness.status).toBe("blocked");
  });
});

describe("workpack learning export", () => {
  it("exports daily work memory as markdown and jsonl", () => {
    const input = {
      workpackId: "wp-1",
      generatedAt: "2026-07-08T00:00:00.000Z",
      question: "성수동 외벽 도장 작업",
      taskLabel: "성수동 외벽 도장",
      references: [reference()],
      improvements: [{
        id: "imp-1",
        taskLabel: "성수동 외벽 도장",
        hazardLabel: "추락",
        improvementText: "난간 보강",
        reflectedDocuments: ["위험성평가표"],
        sourceType: "photo_analysis" as const,
        visionStatus: "analyzed" as const,
        analysisMode: "vision_ocr" as const,
        photoPairAttached: true,
        visionUserLabel: "vision/OCR 분석 완료",
        visionProvider: "openai",
        visionModel: "gpt-4.1-mini",
        visionSummary: "난간 보강이 확인됩니다.",
        detectedHazards: ["추락"],
        observedImprovement: "난간 보강 후 작업구역 통제가 보입니다.",
        ocrText: "추락주의",
        sourcePhotoNames: ["before.jpg", "after.jpg"],
        photoCount: 2,
        siteSignals: ["비계", "단부"],
        visionEvidence: "after.jpg에서 난간 보강 확인"
      }],
      confirmations: [{ displayName: "Nguyen", languageCode: "vi", readAt: "2026-07-08T09:20:00.000Z" }]
    };

    const markdown = buildWorkpackLearningMarkdown(input);
    const jsonl = buildWorkpackLearningJsonl(input);
    const file = buildWorkpackLearningFile(input, "jsonl");
    const obsidianFile = buildWorkpackLearningFile(input, "obsidian");

    expect(markdown).toContain("# 성수동 외벽 도장");
    expect(markdown).toContain("## 운영 메모리 계약");
    expect(markdown).toContain("promotionStatus: draft_candidate");
    expect(markdown).toContain("runtimeAuthority: no");
    expect(markdown).toContain("modelFineTuning: no");
    expect(markdown).toContain("모델 파인튜닝 산출물이 아닙니다.");
    expect(markdown).toContain("## 운영 그래프");
    expect(markdown).toContain("- hazards: 1");
    expect(markdown).toContain("- improvements: 1");
    expect(markdown).toContain("- acks: 1");
    expect(markdown).toContain("난간 보강");
    expect(markdown).toContain("visionStatus: analyzed");
    expect(markdown).toContain("analysisMode: vision_ocr");
    expect(markdown).toContain("photoPairAttached: yes");
    expect(markdown).toContain("visionLabel: vision/OCR 분석 완료");
    expect(markdown).toContain("visionModel: gpt-4.1-mini");
    expect(markdown).toContain("detectedHazards: 추락");
    expect(markdown).toContain("observedImprovement: 난간 보강 후 작업구역 통제가 보입니다.");
    expect(markdown).toContain("ocr: 추락주의");
    expect(markdown).toContain("sourcePhotos: before.jpg, after.jpg");
    expect(markdown).toContain("photoCount: 2");
    expect(markdown).toContain("siteSignals: 비계, 단부");
    expect(markdown).toContain("photoEvidence: after.jpg에서 난간 보강 확인");
    expect(jsonl.split("\n")).toHaveLength(6);
    expect(jsonl).toContain("\"eventType\":\"governance\"");
    expect(jsonl).toContain("\"promotionStatus\":\"draft_candidate\"");
    expect(jsonl).toContain("\"runtimeAuthority\":false");
    expect(jsonl).toContain("\"modelFineTuning\":false");
    expect(jsonl).toContain("\"eventType\":\"operation_graph\"");
    expect(jsonl).toContain("\"kind\":\"Workpack\"");
    expect(jsonl).toContain("\"kind\":\"Improvement\"");
    expect(jsonl).toContain("\"relation\":\"hasImprovement\"");
    expect(jsonl).toContain("\"eventType\":\"improvement\"");
    expect(jsonl).toContain("\"visionStatus\":\"analyzed\"");
    expect(jsonl).toContain("\"analysisMode\":\"vision_ocr\"");
    expect(jsonl).toContain("\"photoPairAttached\":true");
    expect(jsonl).toContain("\"visionUserLabel\":\"vision/OCR 분석 완료\"");
    expect(jsonl).toContain("\"visionModel\":\"gpt-4.1-mini\"");
    expect(jsonl).toContain("\"detectedHazards\":[\"추락\"]");
    expect(jsonl).toContain("\"observedImprovement\":\"난간 보강 후 작업구역 통제가 보입니다.\"");
    expect(jsonl).toContain("\"ocrText\":\"추락주의\"");
    expect(jsonl).toContain("\"sourcePhotoNames\":[\"before.jpg\",\"after.jpg\"]");
    expect(jsonl).toContain("\"photoCount\":2");
    expect(jsonl).toContain("\"siteSignals\":[\"비계\",\"단부\"]");
    expect(jsonl).toContain("\"visionEvidence\":\"after.jpg에서 난간 보강 확인\"");
    expect(file.fileName).toBe("성수동-외벽-도장-learning.jsonl");
    expect(file.contentType).toContain("application/x-ndjson");
    expect(file.content.endsWith("\n")).toBe(true);
    expect(obsidianFile.fileName).toBe("성수동-외벽-도장-learning-obsidian.md");
    expect(obsidianFile.content).toContain("safeclaw_memory_scope: operation_memory_export");
    expect(obsidianFile.content).toContain("[[Workpack/성수동 외벽 도장]]");
    expect(obsidianFile.content).toContain("[[Hazard/추락]]");
    expect(obsidianFile.content).toContain("[[Improvement/난간 보강]]");
    expect(obsidianFile.content).toContain("--hasImprovement-->");
    expect(normalizeWorkpackLearningFormat("jsonl")).toBe("jsonl");
    expect(normalizeWorkpackLearningFormat("obsidian")).toBe("obsidian");
    expect(normalizeWorkpackLearningFormat("bad")).toBe("markdown");
  });

  it("preserves long vision/OCR payloads for memory export instead of clipping to UI summary length", () => {
    const longOcr = `작업중 출입금지 ${"비계 하부 통제 표지 ".repeat(20)}`.trim();
    const observedImprovement = `난간 설치와 하부 통제선 보강 확인. ${"작업발판 단부 보강 ".repeat(12)}`.trim();
    const normalized = normalizeLearningVisionPayload({
      status: "analyzed",
      analysisMode: "vision_ocr",
      photoPairAttached: true,
      userLabel: "vision/OCR 분석 완료",
      provider: "openai",
      model: "gpt-4.1-mini",
      summary: "개선 후 난간과 통제선이 보입니다.",
      detectedHazards: ["추락", "하부 통제 미흡"],
      observedImprovement,
      ocrText: longOcr,
      errorMessage: ""
    });

    expect(normalized.visionStatus).toBe("analyzed");
    expect(normalized.analysisMode).toBe("vision_ocr");
    expect(normalized.photoPairAttached).toBe(true);
    expect(normalized.visionUserLabel).toBe("vision/OCR 분석 완료");
    expect(normalized.visionProvider).toBe("openai");
    expect(normalized.visionModel).toBe("gpt-4.1-mini");
    expect(normalized.detectedHazards).toEqual(["추락", "하부 통제 미흡"]);
    expect(normalized.observedImprovement).toBe(observedImprovement);
    expect(normalized.ocrText).toBe(longOcr);
    expect(normalized.ocrText?.length).toBeGreaterThan(120);
  });
});
