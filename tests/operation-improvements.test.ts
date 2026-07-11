import { describe, expect, it } from "vitest";

import {
  MAX_INPUT_HAZARD_PHOTO_FILES,
  buildAcceptedHazardPhotoAppendix,
  buildAcceptedHazardPhotoHarnessImprovements,
  buildHazardPhotoCandidateKey,
  buildHazardPhotoCandidates,
  buildPhotoAnalysisCandidate,
  canAcceptHazardPhotoCandidate,
  parseHazardPhotoWorkspaceResponse
} from "@/lib/operation-improvements";

function confirmedReview() {
  return {
    harness: {
      authority: "safeclaw-db-mcp" as const,
      status: "confirmed" as const,
      evidence: [{
        sourceId: "confirmed-reference",
        sourceType: "safeclaw-db" as const,
        title: "확정 근거",
        excerpt: "후보별 직접 근거"
      }],
      confirmedControls: [{
        text: "확정 통제",
        evidenceSourceIds: ["confirmed-reference"]
      }],
      confirmedAt: "2026-07-11T00:00:00.000Z",
      errorMessage: null
    },
    userDecision: {
      status: "pending" as const,
      allowed: ["accepted", "rejected"] as Array<"accepted" | "rejected">,
      requiresHarnessConfirmation: true as const,
      reason: null,
      decidedAt: null
    }
  };
}

describe("operation improvement photo analysis candidate", () => {
  it("returns an empty candidate until both before and after photos are attached", () => {
    const candidate = buildPhotoAnalysisCandidate({
      beforePhoto: { name: "before.png" },
      afterPhoto: null,
      workSummary: "성수동 외벽 도장 작업",
      topRisk: "추락"
    });

    expect(candidate).toBe("");
  });

  it("turns before and after photos into a reviewable improvement candidate", () => {
    const candidate = buildPhotoAnalysisCandidate({
      beforePhoto: { name: "before.png" },
      afterPhoto: { name: "after.png" },
      workSummary: "성수동 외벽 도장 작업",
      topRisk: "추락",
      reflectedDocuments: ["위험성평가표", "TBM 브리핑", "TBM 기록"]
    });

    expect(candidate).toContain("Before/After 사진 비교 후보");
    expect(candidate).toContain("성수동 외벽 도장 작업");
    expect(candidate).toContain("추락");
    expect(candidate).toContain("위험성평가표");
    expect(candidate).toContain("TBM 브리핑");
  });
});

describe("hazard photo candidates", () => {
  it("preserves partial status and candidate review authority in the workspace DTO", () => {
    const parsed = parseHazardPhotoWorkspaceResponse({
      ok: true,
      message: "1장 분석, 1장 실패",
      analysis: {
        status: "partial",
        provider: "openai",
        providerMode: "live",
        model: "gpt-4.1-mini-2026-06-01",
        providerResponses: [{
          photoId: "photo-1",
          responseId: "resp_workspace_vision",
          model: "gpt-4.1-mini-2026-06-01",
          createdAt: 1_783_500_000
        }],
        fileValidation: {
          mode: "signature_only",
          decodesPixels: false,
          signatureBytes: 12,
          description: "signature only"
        },
        summary: "부분 분석 결과",
        ocrText: "",
        siteSignals: ["비계"],
        counts: {
          submitted: 2,
          analyzed: 1,
          rejected: 0,
          failed: 1,
          unconfigured: 0,
          candidates: 2,
          harnessConfirmed: 1,
          harnessInsufficient: 1
        },
        images: [{
          name: "failed.jpg",
          status: "failed",
          error: { message: "provider timeout" }
        }],
        candidates: [
          {
            id: "confirmed-candidate",
            label: "비계 추락 위험 후보",
            detail: "작업발판 외측 노출 가능성",
            severity: "review",
            evidence: "",
            reflectedDocuments: [],
            sourcePhotoNames: ["scaffold.jpg"],
            harness: {
              authority: "safeclaw-db-mcp",
              status: "confirmed",
              evidence: [{
                sourceId: "fall-reference",
                sourceType: "safeclaw-db",
                title: "비계 추락 예방",
                excerpt: "작업발판 안전난간",
                catalogSourceId: "kosha-guide-source",
                sourceUrl: "https://safety.example/kosha-guide",
                itemType: "guideline",
                evidenceRole: "direct",
                retrievals: [{
                  channel: "direct",
                  query: "비계 추락",
                  mode: "ranked-rpc",
                  source: "ranked",
                  vectorAttempted: false,
                  vectorOk: false,
                  vectorModel: "text-embedding-3-small"
                }]
              }],
              confirmedControls: [{
                text: "작업발판 안전난간 상태 확인",
                evidenceSourceIds: ["fall-reference"]
              }],
              confirmedAt: "2026-07-11T00:00:00.000Z",
              errorMessage: null
            },
            userDecision: {
              status: "pending",
              allowed: ["accepted", "rejected"],
              requiresHarnessConfirmation: true,
              reason: null,
              decidedAt: null
            }
          },
          {
            id: "insufficient-candidate",
            label: "일반 검토 후보",
            detail: "추가 근거 필요",
            severity: "review",
            evidence: "",
            reflectedDocuments: [],
            sourcePhotoNames: ["scaffold.jpg"],
            harness: {
              authority: "safeclaw-db-mcp",
              status: "insufficient",
              evidence: [],
              confirmedControls: [],
              confirmedAt: null,
              errorMessage: "positive relevance not established"
            },
            userDecision: {
              status: "pending",
              allowed: ["rejected"],
              requiresHarnessConfirmation: true,
              reason: null,
              decidedAt: null
            }
          }
        ]
      }
    }, true);

    expect(parsed.analysis.status).toBe("partial");
    expect(parsed.analysis.model).toBe("gpt-4.1-mini-2026-06-01");
    expect(parsed.analysis.providerResponses).toEqual([expect.objectContaining({
      responseId: "resp_workspace_vision",
      model: "gpt-4.1-mini-2026-06-01"
    })]);
    expect(parsed.analysis.fileValidation).toMatchObject({ mode: "signature_only", decodesPixels: false });
    expect(parsed.analysis.counts).toMatchObject({ analyzed: 1, failed: 1 });
    expect(parsed.analysis.failures).toEqual([{
      name: "failed.jpg",
      status: "failed",
      message: "provider timeout"
    }]);
    const confirmedCandidate = parsed.analysis.candidates[0];
    const insufficientCandidate = parsed.analysis.candidates[1];
    const confirmedHarness = confirmedCandidate?.harness;
    const confirmedDecision = confirmedCandidate?.userDecision;
    expect(confirmedCandidate).toBeDefined();
    expect(insufficientCandidate).toBeDefined();
    expect(confirmedHarness?.status).toBe("confirmed");
    expect(confirmedHarness?.evidence[0]).toMatchObject({
      catalogSourceId: "kosha-guide-source",
      sourceUrl: "https://safety.example/kosha-guide",
      retrievals: [expect.objectContaining({ channel: "direct", mode: "ranked-rpc" })]
    });
    expect(confirmedDecision?.allowed).toEqual(["accepted", "rejected"]);
    if (!confirmedCandidate || !insufficientCandidate || !confirmedHarness || !confirmedDecision) {
      throw new Error("Expected parsed workspace candidates");
    }
    expect(canAcceptHazardPhotoCandidate(confirmedCandidate)).toBe(true);
    expect(canAcceptHazardPhotoCandidate(insufficientCandidate)).toBe(false);
  });

  it("adds only harness-confirmed candidates even when insufficient keys are selected", () => {
    const confirmed = {
      source: "vision" as const,
      label: "비계 추락 위험 후보",
      detail: "작업발판 외측 노출 가능성",
      sourcePhotoNames: ["scaffold.jpg"],
      harness: {
        authority: "safeclaw-db-mcp" as const,
        status: "confirmed" as const,
        evidence: [{
          sourceId: "fall-reference",
          sourceType: "safeclaw-db" as const,
          title: "비계 추락 예방",
          excerpt: "작업발판 안전난간"
        }],
        confirmedControls: [{
          text: "작업발판 안전난간 상태 확인",
          evidenceSourceIds: ["fall-reference"]
        }],
        confirmedAt: "2026-07-11T00:00:00.000Z",
        errorMessage: null
      },
      userDecision: {
        status: "pending" as const,
        allowed: ["accepted", "rejected"] as Array<"accepted" | "rejected">,
        requiresHarnessConfirmation: true as const,
        reason: null,
        decidedAt: null
      }
    };
    const insufficient = {
      ...confirmed,
      label: "일반 검토 후보",
      harness: {
        ...confirmed.harness,
        status: "insufficient" as const,
        evidence: [],
        confirmedControls: [],
        confirmedAt: null,
        errorMessage: "positive relevance not established"
      },
      userDecision: {
        ...confirmed.userDecision,
        allowed: ["rejected"] as Array<"accepted" | "rejected">
      }
    };
    const acceptedCandidateKeys = [
      buildHazardPhotoCandidateKey(confirmed),
      buildHazardPhotoCandidateKey(insufficient)
    ];

    const appendix = buildAcceptedHazardPhotoAppendix({
      candidates: [confirmed, insufficient],
      acceptedCandidateKeys
    });
    const improvements = buildAcceptedHazardPhotoHarnessImprovements({
      taskLabel: "외벽 도장",
      candidates: [confirmed, insufficient],
      acceptedCandidateKeys
    });

    expect(appendix).toContain("비계 추락 위험 후보");
    expect(appendix).not.toContain("일반 검토 후보");
    expect(improvements.map((item) => item.hazardLabel)).toEqual(["비계 추락 위험 후보"]);
  });

  it("keeps the input photo cap aligned with the vision API route", () => {
    expect(MAX_INPUT_HAZARD_PHOTO_FILES).toBe(10);
  });

  it("does not create candidates until a photo is attached", () => {
    expect(buildHazardPhotoCandidates("성수동 외벽 도장 작업", null)).toEqual([]);
  });

  it("returns reviewable hazard candidates from narrative and photo hints", () => {
    const candidates = buildHazardPhotoCandidates(
      "외벽 도장 작업, 이동식 비계 사용, 작업자 5명",
      "scaffold-before.jpg"
    );

    expect(candidates).toContainEqual({
      label: "추락·낙하 위험",
      detail: "고소 작업, 비계, 개구부, 낙하물 가능성을 확인합니다."
    });
  });

  it("falls back to a manual site-photo review candidate", () => {
    const candidates = buildHazardPhotoCandidates("실내 점검", "site-photo.png");

    expect(candidates).toEqual([
      {
        label: "현장 사진 검토 필요",
        detail: "작업면, 보호구, 출입통제, 장비 배치 여부를 후보로 검토합니다."
      }
    ]);
  });

  it("builds a stable key for user accepted photo candidates", () => {
    const key = buildHazardPhotoCandidateKey({
      source: "vision",
      label: "추락·낙하 위험",
      detail: "개구부 주변 통제가 부족합니다.",
      sourcePhotoNames: [" Workface.JPG "]
    });

    expect(key).toBe("vision::추락·낙하 위험::개구부 주변 통제가 부족합니다.::workface.jpg");
  });

  it("adds only accepted photo hazards to the generation appendix", () => {
    const accepted = {
      source: "vision" as const,
      label: "추락·낙하 위험",
      detail: "개구부 주변 통제가 부족합니다.",
      severity: "high" as const,
      evidence: "사진의 개구부와 통제선 미확인",
      reflectedDocuments: ["위험성평가표", "TBM 브리핑"],
      sourcePhotoNames: ["workface.jpg"],
      ...confirmedReview()
    };
    const ignored = {
      source: "vision" as const,
      label: "차량·장비 동선",
      detail: "사진상 장비 접근로가 명확하지 않습니다.",
      severity: "review" as const,
      sourcePhotoNames: ["workface.jpg"]
    };

    const appendix = buildAcceptedHazardPhotoAppendix({
      candidates: [accepted, ignored],
      acceptedCandidateKeys: [buildHazardPhotoCandidateKey(accepted)],
      summary: "외벽 작업면 사진입니다.",
      ocrText: "추락주의",
      siteSignals: ["외벽", "개구부"],
      photoCount: 3
    });

    expect(appendix).toContain("[사용자 추가 사진 위험요인 후보]");
    expect(appendix).toContain("추락·낙하 위험(high)");
    expect(appendix).toContain("위험성평가표");
    expect(appendix).toContain("사진 수: 3장");
    expect(appendix).toContain("사진 신호: 외벽 · 개구부");
    expect(appendix).toContain("추락주의");
    expect(appendix).not.toContain("차량·장비 동선");
  });

  it("preserves grounded provenance in the generation appendix for accepted photo hazards", () => {
    const accepted = {
      id: "photo-1-candidate-1",
      source: "vision" as const,
      label: "작업발판 외측 추락 위험",
      detail: "작업면 가장자리 난간 상태를 현장 확인해야 합니다.",
      severity: "high" as const,
      evidence: "workface.jpg에서 작업면 단부가 노출되어 보임",
      reflectedDocuments: ["위험성평가표", "TBM 브리핑"],
      sourcePhotoNames: ["workface.jpg", "detail.jpg"],
      harness: {
        authority: "safeclaw-db-mcp" as const,
        status: "confirmed" as const,
        evidence: [{
          sourceId: "fall-reference",
          sourceType: "safeclaw-db" as const,
          title: "비계 추락 예방",
          excerpt: "작업발판 안전난간과 끝막이판 상태를 확인합니다.",
          catalogSourceId: "kosha-guide-source",
          sourceUrl: "https://safety.example/kosha-guide",
          itemType: "guideline",
          evidenceRole: "direct" as const,
          retrievals: [{
            channel: "direct" as const,
            query: "비계 추락",
            mode: "ranked-rpc" as const,
            source: "ranked" as const,
            vectorAttempted: false,
            vectorOk: false,
            vectorModel: "text-embedding-3-small"
          }]
        }],
        confirmedControls: [{
          text: "작업발판 안전난간 상태 확인",
          evidenceSourceIds: ["fall-reference"]
        }],
        confirmedAt: "2026-07-11T00:00:00.000Z",
        errorMessage: null
      },
      userDecision: {
        status: "pending" as const,
        allowed: ["accepted", "rejected"] as Array<"accepted" | "rejected">,
        requiresHarnessConfirmation: true as const,
        reason: null,
        decidedAt: null
      }
    };

    const appendix = buildAcceptedHazardPhotoAppendix({
      candidates: [accepted],
      acceptedCandidateKeys: [buildHazardPhotoCandidateKey(accepted)],
      summary: "작업발판 외측이 열려 보입니다.",
      ocrText: "추락주의",
      siteSignals: ["비계", "외벽"],
      photoCount: 2,
      provider: "openai",
      providerMode: "live",
      model: "gpt-4.1-mini-2026-06-01",
      providerResponses: [{
        photoId: "photo-1",
        responseId: "resp_workspace_vision",
        model: "gpt-4.1-mini-2026-06-01",
        createdAt: 1_783_500_000
      }]
    });

    expect(appendix).toContain("후보 키: vision::작업발판 외측 추락 위험::작업면 가장자리 난간 상태를 현장 확인해야 합니다.::workface.jpg|detail.jpg");
    expect(appendix).toContain("모델: openai/live/gpt-4.1-mini-2026-06-01");
    expect(appendix).toContain("응답 메타: photo-1=resp_workspace_vision@gpt-4.1-mini-2026-06-01");
    expect(appendix).toContain("근거 출처: 비계 추락 예방#fall-reference");
    expect(appendix).toContain("확정 통제: 작업발판 안전난간 상태 확인");
  });

  it("turns accepted photo hazards into DB harness improvement memory", () => {
    const accepted = {
      source: "vision" as const,
      label: "작업발판 외측 추락 위험",
      detail: "외벽 도장 작업면 가장자리의 난간 상태를 현장 확인해야 합니다.",
      severity: "high" as const,
      evidence: "scaffold.jpg에서 작업면 가장자리가 노출되어 보임",
      reflectedDocuments: ["위험성평가표", "TBM 브리핑"],
      sourcePhotoNames: ["scaffold.jpg"],
      ...confirmedReview()
    };
    const ignored = {
      source: "local" as const,
      label: "보호구 착용 확인",
      detail: "작업자 보호구 상태를 확인합니다.",
      severity: "review" as const
    };

    const improvements = buildAcceptedHazardPhotoHarnessImprovements({
      taskLabel: "성수동 외벽 도장 작업",
      candidates: [accepted, ignored],
      acceptedCandidateKeys: [buildHazardPhotoCandidateKey(accepted)],
      summary: "작업발판 외측이 보입니다.",
      ocrText: "추락주의",
      siteSignals: ["비계", "단부"],
      photoCount: 2,
      provider: "openai",
      providerMode: "live",
      model: "gpt-4.1-mini-2026-06-01",
      providerResponses: [{
        photoId: "photo-1",
        responseId: "resp_workspace_vision",
        model: "gpt-4.1-mini-2026-06-01",
        createdAt: 1_783_500_000
      }]
    });

    expect(improvements).toHaveLength(1);
    expect(improvements[0]).toMatchObject({
      taskLabel: "성수동 외벽 도장 작업",
      hazardLabel: "작업발판 외측 추락 위험",
      improvementText: "사진 위험요인 확인 및 조치 후보: 외벽 도장 작업면 가장자리의 난간 상태를 현장 확인해야 합니다.",
      reflectedDocuments: ["위험성평가표", "TBM 브리핑"],
      sourceType: "photo_analysis",
      visionStatus: "analyzed",
      analysisMode: "vision_ocr",
      photoPairAttached: false,
      visionUserLabel: "vision/OCR 사진 분석",
      visionProvider: "openai",
      visionModel: "gpt-4.1-mini-2026-06-01",
      ocrText: "추락주의",
      sourcePhotoNames: ["scaffold.jpg"],
      photoCount: 2,
      siteSignals: ["비계", "단부"],
      visionEvidence: "scaffold.jpg에서 작업면 가장자리가 노출되어 보임"
    });
    expect(improvements[0].visionSummary).toContain("scaffold.jpg");
    expect(improvements[0].visionSummary).toContain("사진수: 2장");
    expect(improvements[0].visionSummary).toContain("신호: 비계 · 단부");
    expect(improvements[0].detectedHazards).toContain("작업발판 외측 추락 위험");
    expect(improvements[0].detectedHazards).toContain("severity:high");
    expect(improvements[0].photoHazardProvenance).toMatchObject({
      candidateKey: "vision::작업발판 외측 추락 위험::외벽 도장 작업면 가장자리의 난간 상태를 현장 확인해야 합니다.::scaffold.jpg",
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
        text: "확정 통제",
        evidenceSourceIds: ["confirmed-reference"]
      }]
    });
  });
});
