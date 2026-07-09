import { describe, expect, it } from "vitest";

import { attachQualityContract, buildQualityContract } from "@/lib/quality-contract";
import { buildMockAskResponse, mockSearchResults } from "@/lib/mock-data";
import type { AskResponse, TbmBriefingStructured, TbmLogStructured, WorkPlanStructured } from "@/lib/types";
import type { RiskAssessmentRow } from "@/lib/risk-assessment-schema";
import { buildDbHarnessPacket, buildHarnessPromptContext } from "@/lib/db-harness";
import type { SafetyReferenceItem } from "@/lib/safety-reference-catalog";

const question = "세이프건설 서울 현장 고소 작업 위험성평가와 TBM을 만들어줘.";

const harnessReferences: SafetyReferenceItem[] = [
  {
    id: "sif-fall",
    source_id: "sif",
    item_type: "sif-case",
    category: "건설",
    subcategory: "고소작업",
    title: "고소 작업 추락 SIF 사례",
    summary: "작업대 난간 미확인으로 추락 위험이 발생한 사례",
    keywords: ["고소", "추락"],
    risk_tags: ["추락"],
    primary_documents: ["위험성평가표", "TBM 브리핑", "TBM 기록"],
    controls: ["난간 확인", "안전대 착용", "하부 통제"],
    evidence_role: "direct"
  }
];

const riskRow: RiskAssessmentRow = {
  location: "서울 현장",
  process: "고소 작업",
  task: "작업대 설치",
  equipment: "작업대",
  hazard: "추락 위험",
  fourM: "Media",
  accidentType: "fall",
  currentControls: "작업 전 난간 확인",
  likelihood: 2,
  severity: 3,
  riskLevel: "high",
  additionalControls: "개구부 덮개와 안전대 착용 확인",
  owner: "현장소장",
  due: "작업 전",
  verification: "사진 기록과 TBM 확인",
  verificationStatus: "planned",
  verificationDate: "2026-07-08",
  verificationChecker: "안전관리자",
  whyLikelihood: "고소 작업대 이동 중 접근 가능성이 있습니다.",
  whySeverity: "추락 시 중상 가능성이 있습니다.",
  evidenceRefs: ["riskAssessmentDraft", "tbmBriefing"]
};

const workPlanStructured: WorkPlanStructured = {
  workOverview: {
    workName: "고소 작업",
    description: "작업대 설치 후 상부 배관을 점검합니다.",
    workerCount: 4,
    location: "서울 현장",
    condition: "실내 작업",
    equipment: ["작업대"]
  },
  workSteps: [
    {
      stepNo: 1,
      action: "작업대 설치",
      equipment: "작업대",
      safetyMeasure: "난간과 바퀴 잠금 확인",
      owner: "현장소장",
      relatedRiskRowIndex: [0],
      evidenceRefs: ["riskAssessmentDraft"],
      verification: "작업 전 사진 기록"
    }
  ],
  stopCriteria: ["난간 미설치", "바퀴 잠금 불량", "보호구 미착용"],
  emergencyResponse: {
    contacts: [{ role: "현장소장", phone: "현장 비상망" }],
    evacRoute: "동측 출입구",
    firstAid: "추락 사고 발생 시 즉시 작업중지 후 신고"
  },
  approvers: {
    author: "작성자",
    reviewer: "검토자",
    approver: "승인자"
  }
};

const tbmBriefingStructured: TbmBriefingStructured = {
  meta: {
    dateTime: "2026-07-08 08:30",
    location: "서울 현장",
    target: "전 작업자",
    attendees: "출석부 서명"
  },
  todayWork: {
    name: "고소 작업",
    location: "서울 현장",
    time: "09:00-17:00",
    equipment: ["작업대"]
  },
  hazards: [{ category: "Media", description: "추락 위험" }],
  measures: [{ hazardRef: 1, action: "난간과 안전대 확인", owner: "현장소장" }],
  stopCriteria: ["난간 미설치", "보호구 미착용", "강풍"],
  confirmTopics: ["난간 확인", "안전대 착용", "작업구역 통제"],
  photoEvidenceLocation: "현장 공유 드라이브"
};

const tbmLogStructured: TbmLogStructured = {
  meta: {
    dateTime: "2026-07-08 08:40",
    location: "서울 현장",
    workType: "고소 작업",
    instructor: "현장소장"
  },
  attendance: {
    expected: 4,
    actual: 4,
    attendees: ["작업자 A"],
    absenceReason: "없음",
    confirmationMethod: "출석부 서명"
  },
  todayWork: {
    name: "고소 작업",
    location: "서울 현장",
    time: "09:00-17:00",
    equipment: ["작업대"]
  },
  workerConfirmations: ["난간 확인", "안전대 착용", "작업구역 통제"],
  hazardsDiscussed: [{ category: "Media", description: "추락 위험", relatedRiskRowIndex: 0 }],
  safetyEducation: {
    topic: "고소 작업 추락 예방",
    keyPoints: ["작업대 고정", "안전대 착용", "하부 통제"],
    materials: "KOSHA 지침"
  },
  unaddressedItems: [],
  photoEvidence: {
    captureLocations: ["작업대"],
    storagePath: "현장 공유 드라이브"
  },
  signatures: {
    author: "작성자",
    reviewer: "검토자",
    approver: "승인자"
  }
};

function makeLiveStructuredResponse(): AskResponse {
  const base = buildMockAskResponse(question, mockSearchResults.slice(0, 3), "live", "테스트");
  const packet = buildDbHarnessPacket({
    question,
    references: harnessReferences
  });

  return {
    ...base,
    mode: "live",
    externalData: {
      ...base.externalData,
      weather: { ...base.externalData.weather, mode: "live" },
      training: { ...base.externalData.training, mode: "live" },
      koshaEducation: { ...base.externalData.koshaEducation, mode: "live" },
      kosha: { ...base.externalData.kosha, mode: "live" },
      accidentCases: { ...base.externalData.accidentCases, mode: "live" },
      safetyKnowledge: {
        source: "safety-knowledge",
        mode: "live",
        detail: "온톨로지 매칭",
        matches: [
          {
            id: "knowledge-fall",
            title: "고소 작업 추락 예방",
            primaryDocuments: ["riskAssessmentDraft", "tbmBriefing"],
            controls: ["난간 확인", "안전대 착용"],
            sourceTitles: ["KOSHA 지침"],
            legalMappingTitles: ["산업안전보건기준"],
            evidenceRole: "direct",
            roleLabel: "직접 근거",
            shortSummary: "고소 작업 추락 예방 조치",
            documentReflectionLabel: "문서 반영"
          }
        ]
      },
      safetyReference: {
        source: "safety-reference-catalog",
        mode: "live",
        query: "고소 작업",
        count: 1,
        totalItems: 1,
        message: "연결됨",
        items: []
      }
    },
    deliverables: {
      ...base.deliverables,
      workPlanStructured,
      tbmBriefingStructured,
      tbmLogStructured
    },
    structured: {
      riskAssessmentRows: [riskRow],
      tbmRiskLinks: [],
      riskAssessmentValidation: {
        ok: true,
        issueCount: 0,
        issues: []
      }
    },
    dbHarness: {
      packet,
      promptContext: buildHarnessPromptContext(packet),
      summary: {
        mode: packet.mode,
        llmRole: packet.generationContract.llmRole,
        fallbackChainAllowed: packet.generationContract.fallbackChainAllowed,
        directEvidence: packet.directEvidence.length,
        sifCases: packet.sifCases.length,
        supportingEvidence: packet.supportingEvidence.length,
        improvementMemory: packet.improvementMemory.length,
        workpackMemory: packet.workpackMemory.length,
        missingEvidence: packet.generationContract.missingEvidence,
        documentCoverage: packet.generationContract.documentCoverage,
        ontologyStatus: packet.ontologyChecklist.status
      }
    },
    status: {
      ...base.status,
      lawgo: "live",
      ai: "live",
      weather: "live",
      work24: "live",
      kosha: "live"
    }
  };
}

describe("qualityContract", () => {
  it("marks mock workpacks as blocked and exposes fallback modes", () => {
    const response = buildMockAskResponse(question, mockSearchResults.slice(0, 3), "mock", "테스트");

    expect(response.qualityContract?.overall).toBe("blocked");
    expect(response.qualityContract?.fallback.hasFallback).toBe(true);
    expect(response.qualityContract?.evidence.mappedCount).toBe(response.qualityContract?.evidence.requiredCount);
    expect(response.qualityContract?.ontology.status).toBe("degraded");
    expect(response.qualityContract?.structured.status).toBe("blocked");
    expect(response.qualityContract?.dbHarness.status).toBe("blocked");
    expect(response.qualityContract?.structured.detail).not.toContain("fallback");
    expect(response.qualityContract?.items.map((item) => item.label)).toContain("문서 구조 검수");
    expect(response.qualityContract?.items.map((item) => item.label)).toContain("DB 하네스 계약");
  });

  it("marks live ontology, evidence, structured, and persistence readiness as ready", () => {
    const contract = buildQualityContract(makeLiveStructuredResponse(), "2026-07-08T00:00:00.000Z");

    expect(contract.overall).toBe("ready");
    expect(contract.fallback.hasFallback).toBe(false);
    expect(contract.ontology.matchCount).toBe(1);
    expect(contract.evidence.mappedCount).toBe(contract.evidence.requiredCount);
    expect(contract.structured.readyCount).toBe(contract.structured.requiredCount);
    expect(contract.dbHarness.status).toBe("ready");
    expect(contract.dbHarness.llmRole).toBe("naturalize_only");
    expect(contract.dbHarness.fallbackChainAllowed).toBe(false);
    expect(contract.dbHarness.documentCoverage.every((item) => item.covered)).toBe(true);
    expect(contract.persistence.status).toBe("ready");
  });

  it("attaches the contract without mutating the source response", () => {
    const response = makeLiveStructuredResponse();
    const attached = attachQualityContract(response, "2026-07-08T00:00:00.000Z");

    expect(response.qualityContract?.overall).toBe("blocked");
    expect(attached.qualityContract?.overall).toBe("ready");
    expect(attached).not.toBe(response);
  });
});
