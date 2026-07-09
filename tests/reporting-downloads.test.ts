import { describe, expect, it } from "vitest";

import { buildStoredCurrentWorkpack } from "@/lib/current-workpack";
import {
  operationImprovementToHarnessImprovement,
  parseOperationImprovements
} from "@/lib/operation-improvement-history";
import {
  buildReportCsv,
  buildReportLearningJsonl,
  buildReportLearningMarkdown,
  buildReportMarkdown,
  buildReportSnapshot
} from "@/lib/reporting-downloads";
import type { OperationImprovement } from "@/lib/operation-improvement-history";
import type { RiskAssessmentRow } from "@/lib/risk-assessment-schema";
import { buildMockAskResponse, mockSearchResults } from "@/lib/mock-data";

const riskRow: RiskAssessmentRow = {
  location: "서울 성수동",
  process: "외벽 도장",
  task: "이동식 비계 작업",
  equipment: "이동식 비계",
  hazard: "추락 위험",
  fourM: "Media",
  accidentType: "fall",
  currentControls: "작업 전 비계 상태 육안 확인",
  likelihood: 3,
  severity: 4,
  riskLevel: "high",
  additionalControls: "난간 보강, 바퀴 잠금, 안전대 체결 사진을 작업 전 확인",
  owner: "현장소장",
  due: "2026-07-08",
  verification: "TBM 확인 및 Before/After 사진 기록",
  verificationStatus: "planned",
  verificationDate: "2026-07-08",
  verificationChecker: "안전관리자",
  whyLikelihood: "강풍 예보와 비계 이동이 함께 있어 노출 가능성이 높습니다.",
  whySeverity: "추락 시 중상 가능성이 있습니다.",
  evidenceRefs: ["riskAssessmentDraft", "tbmBriefing"]
};

function makeWorkpack() {
  const response = buildMockAskResponse(
    "세이프건설 서울 성수동 외벽 도장 작업. 이동식 비계 사용, 작업자 5명.",
    mockSearchResults.slice(0, 2),
    "live",
    "리포트 테스트"
  );

  return buildStoredCurrentWorkpack({
    ...response,
    scenario: {
      ...response.scenario,
      companyName: "세이프건설",
      siteName: "서울 성수동",
      companyType: "시설관리·유지보수",
      workSummary: "외벽 도장",
      workerCount: 5,
      weatherNote: "오후 강풍 예보"
    },
    structured: {
      riskAssessmentRows: [riskRow],
      tbmRiskLinks: [],
      riskAssessmentValidation: {
        ok: true,
        issueCount: 0,
        issues: []
      }
    }
  });
}

const improvements: OperationImprovement[] = [
  {
    id: "imp-1",
    createdAt: "2026-07-08T08:30:00.000Z",
    siteName: "서울 성수동",
    workSummary: "외벽 도장",
    hazardLabel: "추락 위험",
    improvementText: "비계 난간과 바퀴 잠금 상태를 보강하고 TBM에서 재확인",
    reflectedDocuments: ["위험성평가표", "TBM 브리핑", "TBM 기록"],
    beforePhotoName: "before-scaffold.jpg",
    afterPhotoName: "after-guardrail.jpg",
    photoAnalysisSummary: "Before/After 사진 비교 후보",
    sourceType: "photo_analysis",
    visionProvider: "openai",
    visionModel: "gpt-4.1-mini",
    sourcePhotoNames: ["before-scaffold.jpg", "after-guardrail.jpg"],
    photoCount: 2,
    siteSignals: ["비계", "단부"],
    visionEvidence: "after-guardrail.jpg에서 난간 보강 확인"
  },
  {
    id: "imp-old",
    createdAt: "2026-06-01T08:30:00.000Z",
    siteName: "서울 성수동",
    workSummary: "외벽 도장",
    hazardLabel: "자재 적치",
    improvementText: "통로 자재를 정리",
    reflectedDocuments: ["위험성평가표"]
  }
];

describe("reporting downloads", () => {
  it("builds a period report with risk rows and photo improvements", () => {
    const snapshot = buildReportSnapshot({
      workpack: makeWorkpack(),
      improvements,
      period: "weekly",
      now: new Date("2026-07-08T12:00:00.000Z")
    });

    expect(snapshot.title).toContain("서울 성수동");
    expect(snapshot.summary.riskRows).toBe(1);
    expect(snapshot.summary.highRiskRows).toBe(1);
    expect(snapshot.summary.improvements).toBe(1);
    expect(snapshot.summary.photoImprovements).toBe(1);
    expect(snapshot.groups.byProcess[0]?.label).toBe("외벽 도장");
    expect(snapshot.groups.byDocument.map((group) => group.label)).toContain("TBM 기록");
  });

  it("renders As-Is/To-Be markdown without external submission wording", () => {
    const snapshot = buildReportSnapshot({
      workpack: makeWorkpack(),
      improvements,
      period: "weekly",
      now: new Date("2026-07-08T12:00:00.000Z")
    });
    const markdown = buildReportMarkdown(snapshot);

    expect(markdown).toContain("## 위험성평가 As-Is / To-Be");
    expect(markdown).toContain("Before/After 사진");
    expect(markdown).toContain("before-scaffold.jpg");
    expect(markdown).not.toContain("KRAS");
    expect(markdown).not.toContain("자동 제출");
  });

  it("exports a csv that combines risk and improvement rows", () => {
    const snapshot = buildReportSnapshot({
      workpack: makeWorkpack(),
      improvements,
      period: "monthly",
      now: new Date("2026-07-08T12:00:00.000Z")
    });
    const csv = buildReportCsv(snapshot);

    expect(csv.startsWith("\uFEFF구분,현장")).toBe(true);
    expect(csv).toContain("위험성평가");
    expect(csv).toContain("개선사항");
    expect(csv).toContain("난간 보강");
  });

  it("exports a period learning corpus as JSONL events", () => {
    const snapshot = buildReportSnapshot({
      workpack: makeWorkpack(),
      improvements,
      period: "weekly",
      now: new Date("2026-07-08T12:00:00.000Z")
    });
    const events = buildReportLearningJsonl(snapshot)
      .trim()
      .split("\n")
      .map((line) => JSON.parse(line) as { eventType: string; payload: Record<string, unknown> });

    expect(events.map((event) => event.eventType)).toContain("period_summary");
    expect(events.map((event) => event.eventType)).toContain("governance");
    expect(events.map((event) => event.eventType)).toContain("risk_row");
    expect(events.map((event) => event.eventType)).toContain("improvement");
    expect(events.map((event) => event.eventType)).toContain("classification_group");
    expect(events.find((event) => event.eventType === "improvement")?.payload).toMatchObject({
      hazardLabel: "추락 위험",
      sourceLabel: "Before/After 사진"
    });
    expect(events.find((event) => event.eventType === "governance")?.payload).toMatchObject({
      authority: "operator_review_corpus",
      runtimeAuthority: false,
      modelFineTuning: false
    });
    expect(events.some((event) => event.eventType === "classification_group" && event.payload.groupType === "risk_level")).toBe(true);
  });

  it("exports a readable operation corpus markdown without fine-tuning claims", () => {
    const snapshot = buildReportSnapshot({
      workpack: makeWorkpack(),
      improvements,
      period: "weekly",
      now: new Date("2026-07-08T12:00:00.000Z")
    });
    const markdown = buildReportLearningMarkdown(snapshot);

    expect(markdown).toContain("운영 코퍼스");
    expect(markdown).toContain("## 운영 메모리 계약");
    expect(markdown).toContain("authority: operator_review_corpus");
    expect(markdown).toContain("재생성 가능한 코퍼스");
    expect(markdown).toContain("## 개선 이벤트");
    expect(markdown).toContain("Before/After 사진");
    expect(markdown).toContain("## 분류 인덱스");
    expect(markdown).not.toContain("파인튜닝 완료");
    expect(markdown).not.toContain("학습 완료");
  });

  it("parses local improvement history defensively", () => {
    const parsed = parseOperationImprovements(JSON.stringify([
      improvements[0],
      { id: "bad", createdAt: "2026-07-08T00:00:00.000Z" }
    ]));

    expect(parsed).toHaveLength(1);
    expect(parsed[0]?.id).toBe("imp-1");
  });

  it("keeps local before/after vision evidence when converted to harness memory", () => {
    const parsed = parseOperationImprovements(JSON.stringify([improvements[0]]));
    const memory = operationImprovementToHarnessImprovement(parsed[0]);

    expect(memory).toMatchObject({
      sourceType: "photo_analysis",
      visionProvider: "openai",
      visionModel: "gpt-4.1-mini",
      sourcePhotoNames: ["before-scaffold.jpg", "after-guardrail.jpg"],
      photoCount: 2,
      siteSignals: ["비계", "단부"],
      visionEvidence: "after-guardrail.jpg에서 난간 보강 확인"
    });
    expect(memory.visionSummary).toContain("Before/After 사진 비교 후보");
  });
});
