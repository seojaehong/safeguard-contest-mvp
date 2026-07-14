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
import { attachDbHarnessFallback, buildSafetyReferenceRiskRows, buildSafetyReferenceSurfaceItem, buildTbmRiskLinks, normalizeSafetyTermTypos, runAsk } from "@/lib/search";
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

  it("keeps raw reference provenance immutable while exposing operational controls to the UI", () => {
    const rawReference = verifiedKoshaReference({
      id: "d-c-13-surface",
      item_type: "technical-support-regulation",
      title: "D-C-13-2026 외벽도장보수공사에 안전작업에 관한 기술지원규정",
      controls: [
        "작업발판·난간·개구부 상태 확인",
        "안전대 체결 및 작업반경 출입통제",
        "가동부 방호덮개와 비상정지장치 확인",
        "정비 전 전원 차단 및 잠금표지"
      ]
    });
    const rawControls = [...rawReference.controls];

    const surface = buildSafetyReferenceSurfaceItem(rawReference);

    expect(surface.controls.join(" ")).toMatch(/비계|작업발판|안전난간|안전대/);
    expect(surface.controls.join(" ")).not.toMatch(/방호덮개|비상정지장치|잠금표지/);
    expect(surface.shortSummary).not.toMatch(/방호덮개|비상정지장치|잠금표지/);
    expect(rawReference.controls).toEqual(rawControls);
  });

  it("rebuilds mobile-dock packet labels from operational controls without mutating provenance", () => {
    const rawReference = reference({
      id: "machinery-mobile-dock-packet",
      source_id: "kosha-machinery-catalog",
      item_type: "machinery",
      category: "운수·창고및통신업",
      title: "469 · 운수·창고및통신업 · 창고업",
      summary: "기계설비명: 이동식도크. 컨테이너와 결합하여 지게차로 상하차 작업을 하는 장비",
      keywords: ["창고업", "이동식도크", "Mobile dock"],
      risk_tags: ["지게차"],
      controls: [
        "가동부 방호덮개 설치 및 비상정지장치 작동 확인",
        "정비 전 전원 차단 및 잠금표지(LOTO)"
      ],
      short_summary: "가동부 방호덮개 설치 · 정비 전 전원 차단 및 잠금표지(LOTO)",
      document_reflection_label: "위험성평가표에 가동부 방호덮개 설치 반영",
      operation_signal_label: "기계설비 관리대책을 작업 전 확인"
    });
    const rawSnapshot = {
      controls: [...rawReference.controls],
      shortSummary: rawReference.short_summary,
      documentReflectionLabel: rawReference.document_reflection_label,
      operationSignalLabel: rawReference.operation_signal_label
    };

    const packet = buildDbHarnessPacket({
      question: "외벽 도장 현장 자재 반입 지게차 상하차와 작업자 통행 동선이 겹친다.",
      references: [rawReference]
    });
    const packetReference = [
      ...packet.directEvidence,
      ...packet.sifCases,
      ...packet.supportingEvidence
    ].find((item) => item.id === rawReference.id);
    expect(packetReference).toBeDefined();
    if (!packetReference) return;
    const packetText = [
      ...(packetReference?.controls || []),
      packetReference?.short_summary || "",
      packetReference?.document_reflection_label || "",
      packetReference?.operation_signal_label || ""
    ].join(" ");

    expect(packetReference.controls.join(" ")).toMatch(/지게차.*보행|보행.*지게차/);
    expect(packetText).not.toMatch(/방호덮개|비상정지장치|잠금표지|LOTO/);
    expect(rawReference.controls).toEqual(rawSnapshot.controls);
    expect(rawReference.short_summary).toBe(rawSnapshot.shortSummary);
    expect(rawReference.document_reflection_label).toBe(rawSnapshot.documentReflectionLabel);
    expect(rawReference.operation_signal_label).toBe(rawSnapshot.operationSignalLabel);
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

function verifiedKoshaReference(overrides: Partial<SafetyReferenceItem> = {}): SafetyReferenceItem {
  const item = reference({
    item_type: "technical-guideline",
    ...overrides,
    evidence_role: "supporting"
  });
  const version = item.title.match(/[A-Z](?:-[A-Z])?-\d+(?:-\d+)?-\d{4}/u)?.[0] || `KOSHA-${item.id}-2026`;
  const body = overrides.body ?? item.summary;

  return {
    ...item,
    body,
    evidence_role: "supporting",
    kosha_guide: {
      referenceId: item.id,
      stableDocumentKey: version.replace(/-\d{4}$/u, ""),
      version,
      quality: "accepted",
      lifecycle: "current",
      bodyKind: "native",
      anchors: [{ page: 1, excerpt: body.slice(0, 240) }],
      evidenceRef: `KOSHA 근거 ${item.id} p.1: ${item.summary}`,
      directEligible: true
    }
  };
}

function archiveSifReference(): SafetyReferenceItem {
  return reference({
    id: "sif-archive-readable",
    title: "1919 / 기타의사업 / 시설관리및사업지원서비스업",
    category: "기타의사업",
    subcategory: "시설관리및사업지원서비스업",
    summary: [
      "연번: 1919",
      "재해개요: 2024. 3. 11. 피해자가 지하 기계실 배수펌프 점검 중 산소결핍으로 쓰러지고, 구조 과정에서 불시기동된 펌프에 끼임.",
      "기인물: 배수펌프",
      "위험성 감소대책: 산소농도 측정, 강제환기, 전원 차단 및 잠금표지"
    ].join("\n"),
    body: "재해개요: 2024. 3. 11. 피해자가 지하 기계실 배수펌프 점검 중 산소결핍으로 쓰러지고, 구조 과정에서 불시기동된 펌프에 끼임.",
    keywords: ["배수펌프", "산소결핍", "끼임"],
    risk_tags: ["질식", "끼임"],
    controls: ["산소농도 측정", "전원 차단 및 잠금표지"],
    retrieval_source: "ranked"
  });
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

  it("keeps retrieval failures and grounded photo provenance in the same packet", () => {
    const packet = buildDbHarnessPacket({
      question: "성수동 외벽 도장 작업발판 점검",
      references: [reference()],
      improvements: [{
        id: "improvement-cross-contract",
        taskLabel: "성수동 외벽 도장",
        hazardLabel: "작업발판 단부 추락",
        improvementText: "난간 보강 후 작업",
        reflectedDocuments: ["위험성평가표", "TBM 브리핑"],
        sourceType: "photo_analysis",
        photoHazardProvenance: {
          candidateKey: "candidate-cross-contract",
          source: "vision",
          provider: "openai",
          providerMode: "live",
          model: "gpt-4.1-mini",
          providerResponses: [{
            photoId: "before-photo",
            responseId: "response-1",
            model: "gpt-4.1-mini",
            createdAt: 1783753200
          }],
          evidence: [{
            sourceId: "sif-1",
            sourceType: "safeclaw-db",
            title: "외벽 도장 중 추락 사례",
            excerpt: "작업발판과 난간 상태 미확인",
            retrievals: [{
              channel: "sif",
              query: "외벽 도장 작업발판",
              mode: "hybrid-vector-rpc",
              source: "hybrid",
              vectorAttempted: true,
              vectorOk: false,
              vectorModel: "text-embedding-3-small"
            }]
          }],
          confirmedControls: [{
            text: "작업발판과 난간 상태 확인",
            evidenceSourceIds: ["sif-1"]
          }],
          confirmedAt: "2026-07-11T15:00:00+09:00"
        }
      }],
      retrieval: {
        errorCode: "safety_reference_search_failed",
        mode: "hybrid-vector-rpc",
        vectorSearch: {
          enabled: true,
          attempted: true,
          ok: false,
          errorCode: "safety_reference_vector_failed",
          reason: "rpc-failed",
          count: 0,
          model: "text-embedding-3-small",
          message: "벡터 RPC 조회 실패"
        },
        message: "근거 검색 일부 실패"
      }
    });

    expect(packet.retrievalContract).toMatchObject({
      errorCode: "safety_reference_search_failed",
      mode: "hybrid-vector-rpc",
      vector: {
        errorCode: "safety_reference_vector_failed",
        enabled: true,
        attempted: true,
        ready: false,
        reason: "rpc-failed"
      }
    });
    expect(packet.improvementMemory[0]?.photoHazardProvenance).toMatchObject({
      candidateKey: "candidate-cross-contract",
      providerMode: "live",
      confirmedControls: [{
        text: "작업발판과 난간 상태 확인",
        evidenceSourceIds: ["sif-1"]
      }]
    });
  });

  it("carries vector retrieval status into the DB harness packet after approval", () => {
    const packet = buildDbHarnessPacket({
      question: "성수동 외벽 도장 작업",
      references: [
        reference({ retrieval_source: "hybrid", vector_similarity: 0.82 }),
        verifiedKoshaReference({
          id: "guide-1",
          item_type: "technical-guideline",
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
      directEvidence: 0,
      sifCases: 1,
      supportingEvidence: 2,
      hybrid: 1,
      ranked: 1
    });
    expect(promptContext).toContain("검색 경로: hybrid-vector-rpc / vector=ready");
    expect(promptContext).toContain("hybrid 1, vector 0, ranked 1");
    expect(promptContext).toContain("KOSHA_SUPPORTING_BODY_JSON");
    expect(promptContext).toContain("KOSHA 외벽 도장 지침");
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
        ocrText: "작업중 출입금지",
        photoHazardProvenance: {
          candidateId: "photo-1-candidate-1",
          candidateKey: "vision::추락::오전 작업 전 이동식 비계 난간을 보강함::before.jpg|after.jpg",
          source: "vision",
          provider: "openai",
          providerMode: "live",
          model: "gpt-4.1-mini-2026-06-01",
          providerResponses: [{
            photoId: "photo-1",
            responseId: "resp_workspace_vision",
            model: "gpt-4.1-mini-2026-06-01",
            createdAt: 1_783_500_000
          }],
          evidence: [{
            sourceId: "fall-reference",
            sourceType: "safeclaw-db",
            title: "비계 추락 예방",
            excerpt: "작업발판 안전난간 상태를 확인합니다."
          }],
          confirmedControls: [{
            text: "이동식 비계 난간 보강",
            evidenceSourceIds: ["fall-reference"]
          }],
          confirmedAt: "2026-07-11T00:00:00.000Z"
        }
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
    expect(harnessMemory.improvements[0]?.photoHazardProvenance).toMatchObject({
      candidateId: "photo-1-candidate-1",
      candidateKey: "vision::추락::오전 작업 전 이동식 비계 난간을 보강함::before.jpg|after.jpg",
      source: "vision",
      provider: "openai",
      providerMode: "live",
      model: "gpt-4.1-mini-2026-06-01",
      providerResponses: [{
        photoId: "photo-1",
        responseId: "resp_workspace_vision",
        model: "gpt-4.1-mini-2026-06-01",
        createdAt: 1_783_500_000
      }],
      confirmedControls: [{
        text: "이동식 비계 난간 보강",
        evidenceSourceIds: ["fall-reference"]
      }]
    });
  });

  it("builds the visible judgment summary from the DB harness packet before generic answer text", () => {
    const packet = buildDbHarnessPacket({
      question: "성수동 외벽 도장 작업",
      references: [
        reference(),
        verifiedKoshaReference({
          id: "guide-1",
          item_type: "technical-guideline",
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
    expect(answer).toContain("KOSHA 기술 보조지침: KOSHA 외벽 도장 추락 예방 지침");
    expect(answer).not.toContain("직접 근거: KOSHA 외벽 도장 추락 예방 지침");
    expect(answer).toContain("SIF 유사사례: 외벽 도장 중 추락 사례");
    expect(answer).toContain("작업 전 난간 보강 사진 확인");
    expect(answer).toContain("작업발판 사전 점검");
    expect(answer).not.toContain("일반 AI 답변");
    expect(answer).not.toMatch(/fallback|OPENAI_API_KEY|timeout|AI_MODE/i);
    expect(points[0]).toContain("문서 반영 전 확인");
    expect(points).toContain("위험성평가표에 같은 위험요인·조치·확인자를 연결");
  });

  it("keeps KOSHA-only packets review-required without independent action controls", () => {
    const koshaOnlyControl = "EXCLUDED_KOSHA_ONLY_CONTROL";
    const koshaOnly = verifiedKoshaReference({
      id: "kosha-only-guide",
      item_type: "technical-guideline",
      title: "KOSHA 단독 기술지침",
      summary: "직접 근거 없이 기술지침만 검색된 상태",
      keywords: ["단독", "기술지침"],
      risk_tags: ["추락"],
      controls: [koshaOnlyControl]
    });
    const packet = buildDbHarnessPacket({
      question: "외벽 도장 추락",
      references: [koshaOnly]
    });
    const answer = buildDbHarnessAnswer(packet);
    const actionSection = answer.split("2) 오늘 문서에 먼저 반영할 조치")[1]?.split("3) 보강 필요")[0] ?? "";
    const points = buildDbHarnessPracticalPoints(packet);

    expect(packet.ontologyChecklist.status).toBe("review_required");
    expect(packet.directEvidence).toEqual([]);
    expect(packet.sifCases).toEqual([]);
    expect(packet.supportingEvidence.map((item) => item.id)).toEqual([koshaOnly.id]);
    expect(answer).toContain("보강 필요");
    expect(answer).toContain("SIF 유사사례");
    expect(answer).toContain("기술 보조지침 후보");
    expect(answer).toContain(koshaOnly.title);
    expect(actionSection).not.toContain(koshaOnlyControl);
    expect(points.join("\n")).not.toContain(koshaOnlyControl);
    expect(points).toContain("위험성평가표 근거 보강 후 전파");
  });

  it("keeps fire controls and energy isolation in the bounded DB harness surface", () => {
    const maintenanceFire = reference({
      id: "sif-forklift-maintenance-fire-packet",
      title: "LPG 지게차 연료계통 정비 중 화재·폭발 사례",
      summary: "지게차 연료계통을 수리하던 중 잔류 가스가 누출되고 점화원과 접촉해 화재가 발생",
      keywords: ["지게차", "정비", "연료 누출", "화재", "폭발", "LOTO"],
      risk_tags: ["지게차", "화재", "폭발"],
      controls: ["충전 구역 환기", "정비 전 전원 차단 및 잠금표지(LOTO)"]
    });

    const packet = buildDbHarnessPacket({
      question: "LPG 지게차 연료계통 정비 작업",
      references: [maintenanceFire]
    });
    const packetReference = packet.sifCases.find((item) => item.id === maintenanceFire.id);
    const promptContext = buildHarnessPromptContext(packet);
    const answer = buildDbHarnessAnswer(packet);

    expect(packetReference).toBeDefined();
    expect(packetReference?.controls).toHaveLength(2);
    expect(packetReference?.controls.join(" ")).toMatch(/연료|가스|누출/);
    expect(packetReference?.controls.join(" ")).toMatch(/환기|점화원|소화기/);
    expect(packetReference?.controls.join(" ")).toMatch(/차단|잠금표지|LOTO/);
    expect(promptContext).toMatch(/차단|잠금표지|LOTO/);
    expect(answer).toMatch(/차단|잠금표지|LOTO/);
  });

  it("keeps molten-metal explosion controls in the bounded DB harness surface", () => {
    const moltenMetalSif = reference({
      id: "sif-아카이브-제조업등-00851",
      title: "851 / 제조업 / 도가니 원료 투입 중 용탕 폭발",
      summary: "지게차로 운반한 원료의 수분이 도가니 용탕과 접촉하면서 증기폭발이 발생한 사례",
      keywords: ["지게차", "도가니", "용탕", "수분", "증기폭발"],
      risk_tags: ["지게차", "화재", "폭발", "화상"],
      controls: [
        "지게차 연료·가스·배터리 누출 및 충전·주유 설비 상태 확인",
        "충전·주유 구역 환기, 점화원 통제 및 적합 소화기 비치"
      ]
    });

    const packet = buildDbHarnessPacket({
      question: "도가니에 지게차로 원료를 운반해 투입하는 작업",
      references: [moltenMetalSif]
    });
    const packetReference = packet.sifCases.find((item) => item.id === moltenMetalSif.id);
    const answer = buildDbHarnessAnswer(packet);

    expect(packetReference?.controls.join(" ")).toMatch(/건조|수분 제거|수분 유입/);
    expect(packetReference?.controls.join(" ")).toMatch(/냉각수|출입통제|방열|보호구/);
    expect(packetReference?.controls.join(" ")).not.toMatch(/지게차 연료|배터리|충전|주유/);
    expect(answer).toMatch(/용탕|수분|냉각수|증기폭발/);
    expect(answer).not.toMatch(/지게차 연료|배터리|충전|주유/);
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

  it("surfaces readable SIF display titles in harness prompts and deterministic risk evidence", () => {
    const rawTitle = "1919 / 기타의사업 / 시설관리및사업지원서비스업";
    const readableTitle = "지하 기계실 배수펌프 점검 중 산소결핍으로 쓰러지고, 구조 과정에서 불시기동된 펌프에 끼임 사례";
    const archiveSif = reference({
      id: "sif-archive-readable",
      title: rawTitle,
      category: "기타의사업",
      subcategory: "시설관리및사업지원서비스업",
      summary: [
        "연번: 1919",
        "재해개요: 2024. 3. 11. 피해자가 지하 기계실 배수펌프 점검 중 산소결핍으로 쓰러지고, 구조 과정에서 불시기동된 펌프에 끼임.",
        "기인물: 배수펌프",
        "위험성 감소대책: 산소농도 측정, 강제환기, 전원 차단 및 잠금표지"
      ].join("\n"),
      body: "재해개요: 2024. 3. 11. 피해자가 지하 기계실 배수펌프 점검 중 산소결핍으로 쓰러지고, 구조 과정에서 불시기동된 펌프에 끼임.",
      keywords: ["배수펌프", "산소결핍", "끼임"],
      risk_tags: ["질식", "끼임"],
      controls: ["산소농도 측정", "전원 차단 및 잠금표지"],
      retrieval_source: "ranked"
    });
    const packet = buildDbHarnessPacket({
      question: "지하 기계실 배수펌프 점검",
      references: [archiveSif]
    });
    const promptContext = buildHarnessPromptContext(packet);
    const rows = buildSafetyReferenceRiskRows(
      buildMockAskResponse("지하 기계실 배수펌프 점검", mockSearchResults, "mock", "테스트"),
      [archiveSif],
      "실내 작업",
      "지하 기계실 배수펌프 점검 산소농도 LOTO"
    );

    expect(promptContext).toContain(readableTitle);
    expect(promptContext).not.toContain(rawTitle);
    expect(rows.some((row) => row.evidenceRefs?.includes(readableTitle))).toBe(true);
    expect(rows.every((row) => !row.evidenceRefs?.includes(rawTitle))).toBe(true);
  });

  it("uses cleaned SIF summaries for risk-row text when archive rows have no controls", () => {
    const response = buildMockAskResponse(
      "탱크 내부 청소 작업, 질식 위험",
      mockSearchResults,
      "mock",
      "테스트"
    );
    const rows = buildSafetyReferenceRiskRows(response, [
      reference({
        id: "sif-labeled-summary-no-controls",
        title: "2020 / 제조업 / 금속제품제조업",
        category: "제조업",
        subcategory: "금속제품제조업",
        summary: [
          "연번: 2020",
          "재해개요: 2019년 03월경 피재자가 탱크 내부 청소 중 질식함.",
          "기인물: 탱크",
          "위험성 감소대책(예시): 산소농도 측정 및 환기"
        ].join("\n"),
        body: "",
        keywords: ["탱크", "청소", "질식"],
        risk_tags: ["질식"],
        controls: [],
        primary_documents: ["위험성평가표", "TBM 브리핑", "TBM 기록"],
        evidence_role: "supporting",
        retrieval_source: "ranked"
      })
    ], "실내 작업", "탱크 내부 청소 질식");

    const rowText = rows.map((row) => [
      row.hazard,
      row.currentControls,
      row.additionalControls,
      ...(row.evidenceRefs || [])
    ].join(" ")).join("\n");

    expect(rows.length).toBeGreaterThan(0);
    expect(rowText).toContain("탱크 내부 청소 중 질식함");
    expect(rowText).not.toMatch(/연번:|재해개요:|기인물:/u);
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
        id: "process-direct-1",
        source_id: "official-construction-process",
        item_type: "construction-process",
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
      verifiedKoshaReference({
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
    expect(rows.some((row) => row.evidenceRefs.some((ref) => (
      ref.startsWith("KOSHA 근거 generic-kosha-1")
    )))).toBe(true);
    expect(rows.some((row) => row.evidenceRefs.includes("G-67-2011 건물 외벽 청소 작업에 관한 기술지침"))).toBe(false);
    expect(rows.every((row) => !/위험.*관련 위험/.test(row.hazard))).toBe(true);
  });

  it("attaches KOSHA support only to SIF or non-KOSHA direct parents", () => {
    const response = buildMockAskResponse(
      "지게차 보행자 동선 충돌",
      mockSearchResults,
      "mock",
      "테스트"
    );
    const nonKoshaSupporting = reference({
      id: "non-kosha-supporting-parent",
      source_id: "field-note",
      item_type: "risk-manual",
      category: "운반하역",
      subcategory: "지게차",
      title: "일반 보조 지게차 동선 메모",
      summary: "지게차와 보행자 동선을 분리한다.",
      keywords: ["지게차", "보행자", "동선", "충돌"],
      risk_tags: ["충돌"],
      controls: ["GENERIC_SUPPORT_PARENT_CONTROL"],
      evidence_role: "supporting",
      retrieval_source: "ranked"
    });
    const directParent = reference({
      id: "direct-forklift-parent",
      source_id: "official-machinery-catalog",
      item_type: "machinery",
      category: "운반하역",
      subcategory: "지게차",
      title: "지게차 보행자 충돌 직접 근거",
      summary: "지게차 운행경로와 보행자 통행 동선을 분리한다.",
      keywords: ["지게차", "보행자", "동선", "충돌"],
      risk_tags: ["충돌"],
      controls: ["지게차 운행경로와 보행자 통행 동선을 분리한다."],
      evidence_role: "direct",
      retrieval_source: "ranked"
    });
    const sifParent = reference({
      id: "sif-forklift-parent",
      item_type: "sif-case",
      category: "운반하역",
      subcategory: "지게차",
      title: "지게차 후진 중 보행자 충돌 SIF 사례",
      summary: "지게차 후진 경로에 보행자가 진입해 충돌한 중대사고 사례",
      keywords: ["지게차", "보행자", "동선", "충돌"],
      risk_tags: ["충돌"],
      controls: ["지게차 후진 전 경보와 유도자를 확인한다."],
      evidence_role: "supporting",
      retrieval_source: "ranked"
    });
    const verifiedKosha = verifiedKoshaReference({
      id: "kosha-forklift-support",
      item_type: "technical-guideline",
      category: "운반하역",
      subcategory: "지게차",
      title: "KOSHA 지게차 동선 기술지침",
      summary: "지게차와 보행자 동선을 분리한다.",
      keywords: ["지게차", "보행자", "동선", "충돌"],
      risk_tags: ["충돌"],
      controls: ["KOSHA_VERIFIED_SUPPORT_CONTROL"],
      retrieval_source: "ranked"
    });
    const conflictingKosha = verifiedKoshaReference({
      id: "kosha-conflicting-fire-support",
      item_type: "technical-guideline",
      category: "화재",
      subcategory: "도장",
      title: "KOSHA 화재 기술지침",
      summary: "도료와 유기용제 점화원을 제거한다.",
      keywords: ["도료", "유기용제", "화재"],
      risk_tags: ["화재"],
      controls: ["KOSHA_CONFLICTING_CONTROL"],
      retrieval_source: "ranked"
    });
    const unverifiedKosha = verifiedKoshaReference({
      id: "kosha-unverified-support",
      item_type: "technical-guideline",
      category: "운반하역",
      subcategory: "지게차",
      title: "KOSHA 검증전 지게차 기술지침",
      summary: "EXCLUDED_UNVERIFIED_KOSHA_CONTROL",
      keywords: ["지게차", "보행자", "동선", "충돌"],
      risk_tags: ["충돌"],
      controls: ["EXCLUDED_UNVERIFIED_KOSHA_CONTROL"],
      retrieval_source: "ranked"
    });
    unverifiedKosha.kosha_guide = {
      ...unverifiedKosha.kosha_guide!,
      quality: "review_required",
      directEligible: false,
      evidenceRef: "KOSHA 근거 kosha-unverified-support p.1: EXCLUDED_UNVERIFIED_KOSHA_CONTROL"
    };

    const supportingOnlyRows = buildSafetyReferenceRiskRows(
      response,
      [nonKoshaSupporting, verifiedKosha],
      "맑음",
      "지게차 보행자 동선 충돌"
    );
    const directRows = buildSafetyReferenceRiskRows(
      response,
      [directParent, verifiedKosha, conflictingKosha, unverifiedKosha],
      "맑음",
      "지게차 보행자 동선 충돌"
    );
    const sifRows = buildSafetyReferenceRiskRows(
      response,
      [sifParent, verifiedKosha],
      "맑음",
      "지게차 보행자 동선 충돌"
    );
    const directText = directRows.map((row) => row.evidenceRefs.join(" ")).join("\n");
    const sifText = sifRows.map((row) => row.evidenceRefs.join(" ")).join("\n");

    expect(supportingOnlyRows).toEqual([]);
    expect(directText).toContain("KOSHA 근거 kosha-forklift-support");
    expect(sifText).toContain("KOSHA 근거 kosha-forklift-support");
    expect(directText).not.toContain("KOSHA_CONFLICTING_CONTROL");
    expect(directText).not.toContain("EXCLUDED_UNVERIFIED_KOSHA_CONTROL");
    expect(validateRiskAssessmentRows(directRows).issues).toEqual([]);
    expect(validateRiskAssessmentRows(sifRows).issues).toEqual([]);
  });

  it("aligns B-E-17 paint evidence to fire and explosion controls without changing raw provenance", () => {
    const paintReference = verifiedKoshaReference({
      id: "b-e-17-paint",
      source_id: "kosha-technical-support-regulations-2025",
      item_type: "technical-support-regulation",
      category: "산업안전일반분야",
      subcategory: "기술지원규정",
      title: "B-E-17-2026 도장 공정에서의 화재·폭발위험방지",
      summary: "도료와 유기용제 증기가 체류하는 도장 공정의 화재·폭발 방지 기준",
      keywords: ["도장", "도료", "유기용제"],
      risk_tags: ["화재", "폭발"],
      controls: ["가동부 방호덮개 설치", "정비 전 전원 차단 및 잠금표지"],
      retrieval_source: "ranked"
    });
    const rawControls = [...paintReference.controls];
    const response = buildMockAskResponse("도장 공정 화재·폭발", mockSearchResults, "mock", "테스트");
    const rows = buildSafetyReferenceRiskRows(response, [paintReference], "실내 작업", "도장 공정 화재 폭발 유기용제");
    const surface = buildSafetyReferenceSurfaceItem(paintReference);
    const controls = surface.controls.join(" ");
    const promptContext = buildHarnessPromptContext(buildDbHarnessPacket({
      question: "도장 공정 화재 폭발 유기용제",
      references: [paintReference]
    }));

    expect(controls).toMatch(/도료|유기용제|환기/);
    expect(controls).toMatch(/점화원|화기|방폭|MSDS|보호구|소화기/);
    expect(controls).not.toContain("가동부 방호덮개");
    expect(promptContext).not.toMatch(/가동부 방호덮개|정비 전 전원 차단/);
    expect(controls.trim()).not.toBe("정비 전 전원 차단 및 잠금표지");
    expect(surface.supportingCitationEligible).toBe(true);
    expect(surface.directEligible).toBe(false);
    expect(rows).toEqual([]);
    expect(paintReference.controls).toEqual(rawControls);
  });

  it("aligns B-E-20 electrostatic coating evidence to grounding and explosion controls", () => {
    const electrostaticReference = verifiedKoshaReference({
      id: "b-e-20-electrostatic",
      source_id: "kosha-technical-support-regulations-2025",
      item_type: "technical-support-regulation",
      category: "전기안전분야",
      subcategory: "기술지원규정",
      title: "B-E-20-2026 정전도장기",
      summary: "정전도장기의 정전기 방전과 도료 증기 점화 방지 기준",
      keywords: ["정전도장", "정전기", "접지"],
      risk_tags: ["화재", "폭발"],
      controls: ["가동부 방호덮개 설치", "정비 전 전원 차단 및 잠금표지"],
      retrieval_source: "ranked"
    });
    const response = buildMockAskResponse("정전도장기 화재·폭발", mockSearchResults, "mock", "테스트");
    const rows = buildSafetyReferenceRiskRows(response, [electrostaticReference], "실내 작업", "정전도장 정전기 접지 화재 폭발");
    const surface = buildSafetyReferenceSurfaceItem(electrostaticReference);
    const controls = surface.controls.join(" ");

    expect(controls).toMatch(/접지|정전기 제거/);
    expect(controls).toMatch(/방폭|환기|점화원|화기/);
    expect(controls).not.toContain("가동부 방호덮개");
    expect(surface.supportingCitationEligible).toBe(true);
    expect(surface.directEligible).toBe(false);
    expect(rows).toEqual([]);
  });

  it("keeps the canonical exterior-painting workpack free of machinery and electrostatic false positives", () => {
    const question = [
      "세이프건설 서울 성수동 근린생활시설 외벽 도장 작업.",
      "이동식 비계를 사용하고 작업자 5명 중 신규 투입자 1명이 포함된다.",
      "오후 강풍 예보가 있으며 자재 반입 지게차 동선과 작업자 통행 동선이 겹친다."
    ].join(" ");
    const response = buildMockAskResponse(question, mockSearchResults, "mock", "테스트");
    const references = [
      verifiedKoshaReference({
        id: "d-c-13-exterior-painting",
        source_id: "kosha-technical-support-regulations-2025",
        item_type: "technical-support-regulation",
        category: "건설안전분야",
        subcategory: "기술지원규정",
        title: "D-C-13-2026 외벽도장보수공사에 안전작업에 관한 기술지원규정",
        summary: "외벽 도장 보수공사의 비계, 추락방지, 작업발판 안전 기준",
        keywords: ["외벽도장", "비계", "추락"],
        risk_tags: ["추락", "비계"],
        controls: [
          "작업발판·난간·개구부 상태 확인",
          "안전대 체결 및 작업반경 출입통제",
          "가동부 방호덮개와 비상정지장치 확인",
          "정비 전 전원 차단 및 잠금표지"
        ],
        retrieval_source: "rest"
      }),
      verifiedKoshaReference({
        id: "b-e-17-paint-fire",
        source_id: "kosha-technical-support-regulations-2025",
        item_type: "technical-support-regulation",
        category: "전기안전분야",
        subcategory: "기술지원규정",
        title: "B-E-17-2026 도장 공정에서의 화재·폭발위험방지에 관한 기술지원규정",
        summary: "도료와 유기용제 증기 점화 방지 기준",
        keywords: ["도장", "도료", "유기용제"],
        risk_tags: ["화재", "폭발"],
        controls: ["가동부 방호덮개와 비상정지장치 확인", "정비 전 전원 차단 및 잠금표지"],
        retrieval_source: "rest"
      }),
      reference({
        id: "b-e-20-electrostatic",
        source_id: "kosha-technical-support-regulations-2025",
        item_type: "technical-support-regulation",
        category: "전기안전분야",
        subcategory: "기술지원규정",
        title: "B-E-20-2026 정전도장기 제작 및 설치에 관한 기술지원규정",
        summary: "정전도장기의 정전기 방전과 도료 증기 점화 방지 기준",
        keywords: ["정전도장", "정전기", "접지"],
        risk_tags: ["화재", "폭발"],
        controls: ["가동부 방호덮개와 비상정지장치 확인", "정비 전 전원 차단 및 잠금표지"],
        evidence_role: "direct",
        retrieval_source: "rest"
      }),
      reference({
        id: "sif-exterior-fall",
        title: "외벽 도장 중 이동식 비계 추락 사례",
        summary: "외벽 도장 중 이동식 비계 작업발판에서 추락한 고위험 사례",
        keywords: ["외벽 도장", "이동식 비계", "추락"],
        risk_tags: ["추락"],
        controls: ["작업발판·난간·개구부 상태 확인", "안전대 체결 및 작업반경 출입통제"],
        evidence_role: "supporting",
        retrieval_source: "rest"
      }),
      reference({
        id: "paint-solvent-direct",
        source_id: "official-risk-manual",
        item_type: "risk-manual",
        category: "도장",
        subcategory: "유기용제",
        title: "외벽 도장 유기용제 화재·폭발 직접 근거",
        summary: "도료와 유기용제 증기가 체류하면 점화원에 의해 화재·폭발할 수 있다.",
        keywords: ["도장", "도료", "유기용제", "화재", "폭발"],
        risk_tags: ["화재·폭발"],
        controls: ["도료·유기용제 용기 밀폐 및 환기", "점화원 제거, 소화기 배치 및 MSDS 보호구 확인"],
        evidence_role: "direct",
        retrieval_source: "rest"
      }),
      reference({
        id: "forklift-traffic",
        source_id: "official-machinery-catalog",
        item_type: "machinery",
        category: "운반하역",
        subcategory: "지게차",
        title: "지게차와 보행자 교차 동선 충돌 예방 기준",
        summary: "자재 반입 지게차와 작업자 통행 동선을 분리하고 신호수를 배치한다.",
        keywords: ["지게차", "보행자", "동선", "충돌"],
        risk_tags: ["충돌"],
        controls: ["지게차 동선과 보행 동선 분리", "신호수 배치 및 후진 경보 확인"],
        evidence_role: "direct",
        retrieval_source: "rest"
      })
    ];

    const rows = buildSafetyReferenceRiskRows(response, references, "오후 강풍 예보", question);
    const rowText = rows.map((row) => [
      row.hazard,
      row.currentControls,
      row.additionalControls,
      ...row.evidenceRefs
    ].join(" ")).join("\n");
    const fallRow = rows.find((row) => row.evidenceRefs.includes("외벽 도장 중 이동식 비계 추락 사례"));
    const paintRow = rows.find((row) => row.evidenceRefs.includes("외벽 도장 유기용제 화재·폭발 직접 근거"));
    const links = buildTbmRiskLinks(rows, "오후 강풍 예보");
    const packet = buildDbHarnessPacket({ question, references });
    const packetText = [
      ...packet.directEvidence,
      ...packet.sifCases,
      ...packet.supportingEvidence
    ].map((item) => `${item.title} ${item.controls.join(" ")}`).join("\n");
    const harnessAnswer = buildDbHarnessAnswer(packet);

    expect(rowText).toMatch(/추락|비계/);
    expect(rowText).toMatch(/강풍|돌풍/);
    expect(rowText).toMatch(/지게차.*동선|동선.*지게차/);
    expect(rowText).toMatch(/도료|유기용제/);
    expect(rowText).toContain("KOSHA 근거 d-c-13-exterior-painting");
    expect(rowText).toContain("KOSHA 근거 b-e-17-paint-fire");
    expect(fallRow?.evidenceRefs.some((ref) => ref.startsWith("KOSHA 근거 d-c-13-exterior-painting"))).toBe(true);
    expect(fallRow?.evidenceRefs.some((ref) => ref.startsWith("KOSHA 근거 b-e-17-paint-fire"))).toBe(false);
    expect(paintRow?.evidenceRefs.some((ref) => ref.startsWith("KOSHA 근거 b-e-17-paint-fire"))).toBe(true);
    expect(paintRow?.evidenceRefs.some((ref) => ref.startsWith("KOSHA 근거 d-c-13-exterior-painting"))).toBe(false);
    expect(rowText).not.toMatch(/기계 가동부|방호덮개|정비 중 불시기동/);
    expect(rowText).not.toMatch(/정전도장|정전도장기|피도장물 접지/);
    expect(links.some((link) => /지게차.*동선|동선.*지게차/.test(`${link.hazard} ${link.control}`))).toBe(true);
    expect(packetText).not.toMatch(/정전도장|정전도장기|피도장물 접지/);
    expect(harnessAnswer).not.toMatch(/기계 가동부|방호덮개|정비 중 불시기동/);
    expect(harnessAnswer).toMatch(/지게차.*동선|동선.*지게차/);
    expect(validateRiskAssessmentRows(rows).issues).toEqual([]);
  });

  it("aligns G-67 exterior cleaning evidence and carries the same controls and refs into TBM links", () => {
    const exteriorReference = verifiedKoshaReference({
      id: "g-67-exterior-cleaning",
      source_id: "kosha-technical-guidelines",
      item_type: "technical-guideline",
      category: "산업안전일반분야",
      subcategory: "기술지침",
      title: "G-67-2011 건물 외벽 청소",
      summary: "건물 외벽에서 로프와 작업대를 사용해 청소하는 작업",
      keywords: ["건물 외벽", "청소", "로프"],
      risk_tags: [],
      controls: ["작업 전 유해·위험요인 확인", "관리감독자 확인 후 작업 시작"],
      retrieval_source: "ranked"
    });
    const directReference = reference({
      id: "exterior-cleaning-direct",
      source_id: "official-construction-process",
      item_type: "construction-process",
      category: "외벽 청소",
      subcategory: "로프 작업",
      title: "건물 외벽 로프 청소 추락 직접 근거",
      summary: "건물 외벽 로프 청소 중 작업대와 구명줄 상태 미확인으로 추락할 수 있다.",
      keywords: ["건물 외벽", "청소", "로프", "추락"],
      risk_tags: ["추락"],
      controls: ["작업로프·안전대·구명줄 상태 확인", "작업발판·난간 확인 및 하부 출입 통제"],
      evidence_role: "direct",
      retrieval_source: "ranked"
    });
    const response = buildMockAskResponse("건물 외벽 청소", mockSearchResults, "mock", "테스트");
    const rows = buildSafetyReferenceRiskRows(response, [directReference, exteriorReference], "맑음", "건물 외벽 청소 로프 추락");
    const row = rows.find((candidate) => candidate.evidenceRefs.includes(directReference.title));
    const controls = `${row?.currentControls} ${row?.additionalControls}`;

    expect(row?.hazard).toMatch(/외벽.*추락|추락.*외벽/);
    expect(row?.hazard).not.toContain("유해·위험요인 미확인");
    expect(controls).toMatch(/작업로프|안전대|구명줄|작업발판|난간|하부 출입 통제/);
    expect(row?.evidenceRefs.some((ref) => ref.startsWith("KOSHA 근거 g-67-exterior-cleaning"))).toBe(true);
    expect(validateRiskAssessmentRows(rows).issues).toEqual([]);

    expect(row).toBeDefined();
    if (!row) return;
    const link = buildTbmRiskLinks([row], "맑음")[0];
    expect(link.control).toBe(row.additionalControls);
    expect(link.evidenceRefs).toEqual(row.evidenceRefs);
  });

  it("retains confined-space pump and actual machinery controls while generic evidence stays review-required", () => {
    const confinedReference = reference({
      id: "confined-pump-controls",
      item_type: "sif-case",
      category: "밀폐공간",
      title: "지하 기계실 배수펌프 정비 중 산소결핍 및 불시기동 끼임 사례",
      summary: "밀폐공간 진입 중 산소결핍과 배수펌프 불시기동 위험",
      keywords: ["밀폐공간", "배수펌프", "산소농도", "LOTO"],
      risk_tags: ["질식", "끼임"],
      controls: ["산소·유해가스 농도 측정", "강제환기 및 감시인 배치", "배수펌프 전원 차단 및 잠금표지"],
      retrieval_source: "ranked"
    });
    const machineryReference = reference({
      id: "machinery-loto-controls",
      item_type: "machinery",
      category: "기계안전",
      title: "프레스 점검 및 정비 안전",
      summary: "프레스 가동부 끼임과 정비 중 불시기동 방지",
      keywords: ["프레스", "정비", "LOTO"],
      risk_tags: ["끼임"],
      controls: ["가동부 방호덮개 설치", "비상정지장치 작동 확인", "정비 전 전원 차단 및 잠금표지(LOTO)"],
      evidence_role: "direct",
      retrieval_source: "ranked"
    });
    const genericReference = reference({
      id: "generic-review-required",
      item_type: "technical-guideline",
      category: "산업안전일반분야",
      title: "일반 작업 안전 참고자료",
      summary: "작업 전 일반 안전사항을 확인합니다.",
      keywords: ["일반", "안전"],
      risk_tags: [],
      controls: ["작업 전 유해·위험요인 확인", "관리감독자 확인 후 작업 시작"],
      evidence_role: "supporting",
      retrieval_source: "rest"
    });
    const response = buildMockAskResponse("설비 점검", mockSearchResults, "mock", "테스트");
    const rows = buildSafetyReferenceRiskRows(
      response,
      [confinedReference, machineryReference, genericReference],
      "실내 작업",
      "밀폐공간 배수펌프 프레스 정비 일반 작업"
    );
    const confinedRow = rows.find((candidate) => candidate.evidenceRefs.includes(confinedReference.title));
    const machineryRow = rows.find((candidate) => candidate.evidenceRefs.includes(machineryReference.title));
    const genericRow = rows.find((candidate) => candidate.evidenceRefs.includes(genericReference.title));

    expect(`${confinedRow?.currentControls} ${confinedRow?.additionalControls}`).toMatch(/산소.*유해가스|유해가스.*산소/);
    expect(`${confinedRow?.currentControls} ${confinedRow?.additionalControls}`).toMatch(/환기.*감시인|감시인.*환기/);
    expect(`${confinedRow?.currentControls} ${confinedRow?.additionalControls}`).toMatch(/전원 차단.*잠금표지|LOTO/);
    expect(`${machineryRow?.currentControls} ${machineryRow?.additionalControls}`).toMatch(/방호덮개/);
    expect(`${machineryRow?.currentControls} ${machineryRow?.additionalControls}`).toMatch(/비상정지/);
    expect(`${machineryRow?.currentControls} ${machineryRow?.additionalControls}`).toMatch(/잠금표지|LOTO/);
    expect(genericRow).toBeUndefined();
    expect(rows.map((row) => row.evidenceRefs.join(" ")).join(" ")).not.toContain(genericReference.title);
    expect(validateRiskAssessmentRows(rows).issues).toEqual([]);
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
    expect(response.generationTrace).toMatchObject({
      traceId: expect.any(String),
      askMode: "template",
      answer: {
        provider: "safeclaw",
        model: null,
        composition: "safeclaw_db_harness",
        upstream: {
          provider: "mock",
          model: null,
          fallbackUsed: false,
          usedInFinal: false
        }
      },
      deliverables: {
        attempted: false,
        provider: "safeclaw",
        modelPerDocument: {
          riskAssessmentDraft: {
            provider: "safeclaw",
            model: null,
            source: "deterministic",
            fallbackUsed: false
          }
        }
      },
      fallbackUsed: false
    });
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
    expect(response.generationTrace).toMatchObject({
      traceId: expect.any(String),
      askMode: "enhanced",
      deliverables: {
        attempted: false,
        provider: "safeclaw",
        modelPerDocument: {
          riskAssessmentDraft: {
            provider: "safeclaw",
            model: null,
            source: "deterministic",
            fallbackUsed: false
          }
        }
      }
    });
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

  it("exports readable SIF evidence labels while JSONL preserves raw title provenance", () => {
    const rawTitle = "1919 / 기타의사업 / 시설관리및사업지원서비스업";
    const readableTitle = "지하 기계실 배수펌프 점검 중 산소결핍으로 쓰러지고, 구조 과정에서 불시기동된 펌프에 끼임 사례";
    const input = {
      workpackId: "wp-sif-readable",
      generatedAt: "2026-07-08T00:00:00.000Z",
      question: "지하 기계실 배수펌프 점검",
      taskLabel: "지하 기계실 배수펌프 점검",
      references: [archiveSifReference()],
      improvements: [],
      confirmations: []
    };

    const markdown = buildWorkpackLearningMarkdown(input);
    const jsonl = buildWorkpackLearningJsonl(input);
    const obsidianFile = buildWorkpackLearningFile(input, "obsidian");
    const referenceEvent = jsonl
      .split("\n")
      .map((line) => JSON.parse(line) as { eventType: string; payload: Record<string, unknown> })
      .find((line) => line.eventType === "reference");

    expect(markdown).toContain(`- ${readableTitle}`);
    expect(markdown).not.toContain(`- ${rawTitle}`);
    expect(obsidianFile.content).toContain(`[[Evidence/${readableTitle}]]`);
    expect(obsidianFile.content).not.toContain(`[[Evidence/${rawTitle}]]`);
    expect(referenceEvent?.payload).toMatchObject({
      title: rawTitle,
      displayTitle: readableTitle
    });
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
