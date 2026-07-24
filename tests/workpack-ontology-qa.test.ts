import { beforeEach, describe, expect, it, vi } from "vitest";

import { buildMockAskResponse, mockSearchResults } from "@/lib/mock-data";
import { resolveReviewTaskLabel } from "@/lib/mcp-tools";
import {
  applyOntologyQaRemediation,
  attachOntologyQaResult,
  attachWebOntologyQa,
  buildOntologyQaSource
} from "@/lib/workpack-ontology-qa";
import { reviewDocpack } from "@/lib/ontology/qa-review-tool";
import type { QaReviewFound } from "@/lib/ontology/qa-review";

vi.mock("@/lib/ontology/qa-review-tool", () => ({
  reviewDocpack: vi.fn()
}));

const qaPass: QaReviewFound = {
  reviewable: true,
  task: "용접",
  covered: { hazards: ["화재"], controls: ["화재감시자 배치"], articles: [] },
  missing: { hazards: [], controls: [], articles: [] },
  coverageRate: 1,
  verdict: "통과",
  advisory: "검수 고지"
};

const qaMissing: QaReviewFound = {
  reviewable: true,
  task: "밀폐공간 작업",
  covered: { hazards: ["산소결핍 질식"], controls: ["적정공기 유지 환기"], articles: [] },
  missing: {
    hazards: ["유해가스 중독"],
    controls: [
      {
        control: "감시인 외부 배치 및 연락설비",
        articles: ["기준규칙 제623조(감시인의 배치 등)"]
      },
      {
        control: "대피용 기구(공기호흡기·사다리·섬유로프) 비치",
        articles: ["기준규칙 제625조(대피용 기구의 비치)"]
      }
    ],
    articles: ["기준규칙 제623조(감시인의 배치 등)"]
  },
  coverageRate: 0.5,
  verdict: "보완 권장",
  advisory: "검수 고지"
};

describe("web workpack ontology QA", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("builds a QA source from the generated workpack documents", () => {
    const response = buildMockAskResponse("서울 현장 고소 작업", mockSearchResults.slice(0, 2), "mock", "test");
    const source = buildOntologyQaSource(response);

    expect(source.text).toContain("[riskAssessmentDraft]");
    expect(source.text).toContain("[tbmBriefing]");
    expect(source.documentKeys).toContain("riskAssessmentDraft");
    expect(source.documentKeys).toContain("safetyEducationRecordDraft");
  });

  it("uses the same vague-task correction path as MCP reviewed docpack tools", async () => {
    vi.mocked(reviewDocpack).mockResolvedValueOnce(qaPass);
    const question = "안산 공장 옥외 배관 용접·절단 화기작업. 화재감시자 필요.";
    const response = buildMockAskResponse(question, mockSearchResults.slice(0, 2), "live", "test");
    const reviewed = await attachWebOntologyQa(response, question);

    expect(resolveReviewTaskLabel("일반 작업", question)).toBe("용접");
    expect(reviewDocpack).toHaveBeenCalledWith("용접", expect.stringContaining("화재감시자"));
    expect(reviewed.ontologyQa?.reviewTask).toBe("용접");
    expect(reviewed.ontologyQa?.result.reviewable).toBe(true);
  });

  it("attaches review verdicts without mutating the source response", () => {
    const response = buildMockAskResponse("용접 작업", mockSearchResults.slice(0, 2), "live", "test");
    const reviewed = attachOntologyQaResult(response, "용접", qaPass, ["riskAssessmentDraft"]);

    expect(response.ontologyQa).toBeUndefined();
    expect(reviewed.ontologyQa?.reviewTask).toBe("용접");
    expect(reviewed.ontologyQa?.detail).toContain("안전조치 검수");
    expect(reviewed.ontologyQa?.detail).not.toContain("riskAssessmentDraft");
  });

  it("remediates missing ontology controls into documents before rereview", async () => {
    vi.mocked(reviewDocpack)
      .mockResolvedValueOnce(qaMissing)
      .mockResolvedValueOnce({
        ...qaPass,
        task: "밀폐공간 작업",
        covered: {
          hazards: ["산소결핍 질식", "유해가스 중독"],
          controls: ["적정공기 유지 환기", "감시인 외부 배치 및 연락설비", "대피용 기구(공기호흡기·사다리·섬유로프) 비치"],
          articles: []
        },
        missing: { hazards: [], controls: [], articles: [] }
      });
    const response = buildMockAskResponse("부산 지하 기계실 밀폐공간 작업", mockSearchResults.slice(0, 2), "live", "test");
    const reviewed = await attachWebOntologyQa(response, "부산 지하 기계실 밀폐공간 작업");

    expect(reviewDocpack).toHaveBeenCalledTimes(2);
    expect(vi.mocked(reviewDocpack).mock.calls[1]?.[1]).toContain("감시인 외부 배치 및 연락설비");
    expect(vi.mocked(reviewDocpack).mock.calls[1]?.[1]).toContain("대피용 기구(공기호흡기·사다리·섬유로프) 비치");
    expect(reviewed.deliverables.riskAssessmentDraft).toContain("[온톨로지 QA 보완 반영 - 위험성평가]");
    expect(reviewed.deliverables.tbmBriefing).toContain("작업 전 확인: 감시인 외부 배치 및 연락설비");
    expect(reviewed.ontologyQa?.result.reviewable && reviewed.ontologyQa.result.verdict).toBe("통과");
  });

  it("does not mutate the source response when applying ontology remediation", () => {
    const response = buildMockAskResponse("부산 지하 기계실 밀폐공간 작업", mockSearchResults.slice(0, 2), "live", "test");
    const remediated = applyOntologyQaRemediation(response, "밀폐공간 작업", qaMissing);

    expect(response.deliverables.riskAssessmentDraft).not.toContain("감시인 외부 배치 및 연락설비");
    expect(remediated.deliverables.riskAssessmentDraft).toContain("감시인 외부 배치 및 연락설비");
    expect(remediated.deliverables.emergencyResponseDraft).toContain("대피용 기구(공기호흡기·사다리·섬유로프) 비치");
  });

  it("records ontology remediation checks in each document role instead of one copied disclaimer", () => {
    const response = buildMockAskResponse("부산 지하 기계실 밀폐공간 작업", mockSearchResults.slice(0, 2), "live", "test");
    const remediated = applyOntologyQaRemediation(response, "밀폐공간 작업", qaMissing);
    const remediatedDocuments = [
      remediated.deliverables.riskAssessmentDraft,
      remediated.deliverables.workPlanDraft,
      remediated.deliverables.safetyEducationRecordDraft,
      remediated.deliverables.emergencyResponseDraft
    ];

    expect(remediatedDocuments.every((document) => (
      !document.includes("현장 여건에 맞는 담당자·확인시각·측정값은 전파 전 관리자가 확인합니다.")
    ))).toBe(true);
    expect(remediated.deliverables.riskAssessmentDraft).toContain("잔여 위험을 평가 기록에 남깁니다.");
    expect(remediated.deliverables.workPlanDraft).toContain("계획서 확인란에 기록합니다.");
    expect(remediated.deliverables.safetyEducationRecordDraft).toContain("교육 기록에 남깁니다.");
    expect(remediated.deliverables.emergencyResponseDraft).toContain("대피·연락 조건을 확인");
  });

  it("keeps ontology QA exception PII and secrets out of result detail and structured logs", async () => {
    const privateFailure = "resident=900101-1234567 Authorization=Bearer ontology-secret";
    vi.mocked(reviewDocpack).mockRejectedValueOnce(new Error(privateFailure));
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const response = buildMockAskResponse(
      "부산 지하 기계실 밀폐공간 작업",
      mockSearchResults.slice(0, 2),
      "live",
      "test"
    );

    const reviewed = await attachWebOntologyQa(response, "부산 지하 기계실 밀폐공간 작업");

    expect(reviewed.ontologyQa).toMatchObject({
      detail: "안전조치 검수를 완료하지 못했습니다. 검수 상태를 확인한 뒤 전송하세요.",
      result: {
        reviewable: false,
        errorCode: "ontology_qa_failed",
        message: "안전조치 검수를 완료하지 못했습니다. 검수 상태를 확인한 뒤 전송하세요."
      }
    });
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('"event":"ontology_qa_failed"'));
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('"errorType":"Error"'));

    const publicSurface = JSON.stringify(reviewed.ontologyQa);
    const internalLogs = JSON.stringify(warnSpy.mock.calls);
    expect(publicSurface).not.toContain("900101-1234567");
    expect(publicSurface).not.toContain("ontology-secret");
    expect(internalLogs).not.toContain("900101-1234567");
    expect(internalLogs).not.toContain("ontology-secret");
  });
});
