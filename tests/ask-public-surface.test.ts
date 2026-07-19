import { describe, expect, it } from "vitest";

import { sanitizeAskResponsePublicSurface } from "@/lib/ask-public-surface";
import type { AskResponse } from "@/lib/types";

function minimalResponse(): AskResponse {
  const response = {
    question: "테스트 작업",
    answer: "핵심 판단",
    practicalPoints: [],
    citations: [],
    sourceMix: {
      total: 0,
      counts: {},
      koreanLawMcp: {
        enabled: false,
        configured: false,
        keySource: "none",
        summary: "미설정"
      }
    },
    mode: "live",
    scenario: {
      companyName: "세이프",
      companyType: "건설업",
      siteName: "현장",
      workSummary: "외벽 도장",
      workerCount: 5,
      weatherNote: "확인 필요"
    },
    externalData: {},
    riskSummary: {
      title: "위험",
      riskLevel: "상",
      topRisk: "추락",
      immediateActions: []
    },
    deliverables: {
      riskAssessmentDraft: "위험성평가",
      tbmBriefing: "TBM",
      tbmLogDraft: "TBM 기록",
      safetyEducationRecordDraft: "교육 기록",
      safetyEducationPoints: [],
      tbmQuestions: [],
      kakaoMessage: "공유 메시지",
      tbmBriefingStructured: {
        title: "TBM",
        hazards: [],
        measures: [{
          hazardRef: 1,
          action: "작업 전 확인",
          owner: "작업반장",
          evidenceRefs: ["DB 하네스 직접근거"],
          verification: "DB 하네스 근거와 현장 확인으로 검증"
        }],
        stopCriteria: [],
        confirmationQuestions: []
      },
      tbmLogStructured: {
        meeting: { date: "2026-07-20", location: "현장", leader: "작업반장", attendees: [] },
        hazardsDiscussed: [],
        controlsConfirmed: [],
        workerConfirmations: [],
        safetyEducation: {
          topic: "교육",
          materials: "DB 하네스 직접근거 / KOSHA 공식자료"
        },
        unaddressedItems: []
      }
    },
    status: {
      lawgo: "live",
      ai: "live",
      weather: "live",
      work24: "live",
      kosha: "live",
      summary: "라이브 응답",
      detail: "AI_MODE=enhanced (DB 하네스 row-first / fallback path)",
      policyNote: "OpenAI 응답은 timeout 20000ms, retry 없음, 실패 시 graceful fallback 정책을 따릅니다."
    },
    structured: {
      riskAssessmentRows: [{
        process: "외벽도장",
        task: "비계 작업",
        hazard: "추락",
        currentRisk: "상",
        currentControls: "점검",
        additionalControls: "보완",
        residualRisk: "중",
        owner: "작업반장",
        verification: "DB 하네스 근거와 현장 사진·TBM 확인으로 조치 반영 여부를 확인",
        evidenceRefs: ["DB 하네스 보조근거"]
      }],
      tbmRiskLinks: [{
        riskRowIndex: 0,
        briefingPoint: "비계 점검",
        confirmQuestion: "확인했습니까?",
        evidenceRefs: ["DB 하네스 직접근거"]
      }]
    },
    qualityContract: {
      overall: "ready",
      summary: "DB 하네스 계약 확인",
      fallback: { hasFallback: false, modes: {} },
      items: [{
        key: "fallback",
        label: "DB 하네스 계약",
        status: "ready",
        detail: "DB 하네스 근거 준비"
      }],
      ontology: { status: "ready", verdict: "통과", missingControlCount: 0 },
      evidence: { status: "ready", mappedCount: 1, requiredCount: 1 },
      structured: { status: "ready" },
      persistence: { status: "ready" },
      dbHarness: {
        status: "ready",
        llmRole: "naturalize_only",
        llmOutputScope: "rewrite_fixed_evidence_only",
        evidenceAuthority: "db_harness",
        providerRetryScope: "naturalization_retry_only",
        fallbackChainAllowed: false,
        genericProseSubstitutionAllowed: false,
        missingEvidencePolicy: "surface_review_required",
        documentCoverage: [],
        missingEvidence: []
      }
    },
    dbHarness: {
      packet: {},
      promptContext: "DB 하네스가 원천이다.",
      summary: {
        mode: "hybrid",
        llmRole: "naturalize_only",
        llmOutputScope: "rewrite_fixed_evidence_only",
        evidenceAuthority: "db_harness",
        providerRetryScope: "naturalization_retry_only",
        fallbackChainAllowed: false,
        genericProseSubstitutionAllowed: false,
        missingEvidencePolicy: "surface_review_required",
        directEvidence: 1,
        sifCases: 0,
        supportingEvidence: 0,
        improvementMemory: 0,
        workpackMemory: 0,
        missingEvidence: [],
        documentCoverage: [],
        retrievalContract: {},
        ontologyStatus: "ready"
      }
    }
  };
  return response as unknown as AskResponse;
}

describe("sanitizeAskResponsePublicSurface", () => {
  it("removes internal harness and fallback terms from visible response fields while preserving machine evidence", () => {
    const sanitized = sanitizeAskResponsePublicSurface(minimalResponse());
    const publicSurface = JSON.stringify({
      status: sanitized.status,
      deliverables: sanitized.deliverables,
      structured: sanitized.structured,
      qualityContract: sanitized.qualityContract
    });

    expect(publicSurface).toContain("고정 근거");
    expect(publicSurface).toContain("생성 모드: 강화");
    expect(publicSurface).toContain("위험요인 표 우선");
    expect(publicSurface).not.toMatch(/DB 하네스|AI_MODE|row-first|deterministic|fallback path|graceful fallback/u);
    expect(sanitized.qualityContract?.items[0]?.key).toBe("fallback");
    expect(sanitized.dbHarness?.promptContext).toContain("DB 하네스");
  });
});
