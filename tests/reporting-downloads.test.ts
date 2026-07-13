import { describe, expect, it } from "vitest";

import {
  buildStoredCurrentWorkpack,
  inspectStoredCurrentWorkpack,
  parseStoredCurrentWorkpack
} from "@/lib/current-workpack";
import {
  operationImprovementToHarnessImprovement,
  parseOperationImprovements
} from "@/lib/operation-improvement-history";
import {
  buildReportCsv,
  buildReportJson,
  buildReportLearningJsonl,
  buildReportLearningMarkdown,
  buildReportMarkdown,
  buildReportSnapshot,
  inspectServerReportWorkpackPayload,
  resolveReportViewState
} from "@/lib/reporting-downloads";
import type { OperationImprovement } from "@/lib/operation-improvement-history";
import type { RiskAssessmentRow } from "@/lib/risk-assessment-schema";
import { buildMockAskResponse, mockSearchResults } from "@/lib/mock-data";
import { attachQualityContract } from "@/lib/quality-contract";

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

const electricalRow: RiskAssessmentRow = {
  ...riskRow,
  location: "부산 물류센터",
  process: "전기 설비",
  task: "분전반 점검",
  hazard: "감전 위험",
  riskLevel: "medium",
  owner: "전기팀",
  verificationStatus: "done"
};

function makeWorkpack(riskRows: RiskAssessmentRow[] = [riskRow]) {
  const response = buildMockAskResponse(
    "세이프건설 서울 성수동 외벽 도장 작업. 이동식 비계 사용, 작업자 5명.",
    mockSearchResults.slice(0, 2),
    "live",
    "리포트 테스트"
  );

  const workpack = buildStoredCurrentWorkpack({
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
      riskAssessmentRows: riskRows,
      tbmRiskLinks: [],
      riskAssessmentValidation: {
        ok: true,
        issueCount: 0,
        issues: []
      }
    }
  });

  return {
    ...workpack,
    savedAt: "2026-07-08T08:00:00.000Z"
  };
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
    status: "candidate",
    riskAssociation: {
      siteName: riskRow.location,
      process: riskRow.process,
      task: riskRow.task,
      hazard: riskRow.hazard
    },
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

const mixedImprovements: OperationImprovement[] = [
  improvements[0],
  {
    ...improvements[0],
    id: "imp-electrical",
    siteName: "부산 물류센터",
    workSummary: "분전반 점검",
    hazardLabel: "감전 위험",
    improvementText: "절연 보호구와 잠금 절차를 확인",
    status: "reflected",
    riskAssociation: {
      siteName: electricalRow.location,
      process: electricalRow.process,
      task: electricalRow.task,
      hazard: electricalRow.hazard
    }
  }
];

function buildMixedSnapshot(filters: Record<string, string>) {
  return buildReportSnapshot({
    workpack: makeWorkpack([riskRow, electricalRow]),
    improvements: mixedImprovements,
    period: "weekly",
    filters,
    now: new Date("2026-07-08T12:00:00.000Z")
  });
}

describe("reporting downloads", () => {
  it("rejects invalid workpack savedAt values and excludes invalid direct improvement timestamps", () => {
    const workpack = makeWorkpack();
    for (const savedAt of ["2026-02-30T00:00:00Z", "2026-07-08T08:00:00"]) {
      expect(parseStoredCurrentWorkpack(JSON.stringify({ ...workpack, savedAt }))).toBeNull();
      expect(() => buildReportSnapshot({
        workpack: { ...workpack, savedAt },
        improvements: [],
        period: "weekly",
        now: new Date("2026-07-08T12:00:00.000Z")
      })).toThrowError("작업팩 저장시각은 유효한 RFC3339 offset 시각이어야 합니다.");
    }

    const snapshot = buildReportSnapshot({
      workpack,
      improvements: [
        { ...improvements[0], id: "valid-offset", createdAt: "2026-07-08T17:30:00+09:00" },
        { ...improvements[0], id: "rollover", createdAt: "2026-02-30T08:30:00Z" },
        { ...improvements[0], id: "no-offset", createdAt: "2026-07-08T08:30:00" }
      ],
      period: "weekly",
      now: new Date("2026-07-08T12:00:00.000Z")
    });

    expect(snapshot.improvements.map((item) => item.id)).toEqual(["valid-offset"]);
  });

  it("filters risk rows by the workpack timestamp for the selected period", () => {
    const workpack = {
      ...makeWorkpack(),
      savedAt: "2026-07-08T08:00:00.000Z"
    };

    const snapshot = buildReportSnapshot({
      workpack,
      improvements: [],
      period: "custom",
      dateRange: { start: "2026-07-09", end: "2026-07-09" },
      now: new Date("2026-07-09T12:00:00.000Z")
    });

    expect(snapshot.riskRows).toEqual([]);
  });

  it("uses KST calendar boundaries consistently for custom periods", () => {
    const snapshot = buildReportSnapshot({
      workpack: {
        ...makeWorkpack(),
        savedAt: "2026-07-09T15:00:00.000Z"
      },
      improvements: [
        { ...improvements[0], id: "before-kst-day", createdAt: "2026-07-09T14:59:59.999Z" },
        { ...improvements[0], id: "start-kst-day", createdAt: "2026-07-09T15:00:00.000Z" },
        { ...improvements[0], id: "end-kst-day", createdAt: "2026-07-10T14:59:59.999Z" },
        { ...improvements[0], id: "after-kst-day", createdAt: "2026-07-10T15:00:00.000Z" }
      ],
      period: "custom",
      dateRange: { start: "2026-07-10", end: "2026-07-10" },
      now: new Date("2026-07-10T03:00:00.000Z")
    });

    expect(snapshot.riskRows).toHaveLength(1);
    expect(snapshot.improvements.map((item) => item.id)).toEqual([
      "start-kst-day",
      "end-kst-day"
    ]);
  });

  it("uses KST Monday and month starts for rolling period reports", () => {
    const boundaryItems: OperationImprovement[] = [
      { ...improvements[0], id: "before-month", createdAt: "2026-06-30T14:59:59.999Z" },
      { ...improvements[0], id: "month-start", createdAt: "2026-06-30T15:00:00.000Z" },
      { ...improvements[0], id: "before-week", createdAt: "2026-07-05T14:59:59.999Z" },
      { ...improvements[0], id: "week-start", createdAt: "2026-07-05T15:00:00.000Z" }
    ];
    const monthly = buildReportSnapshot({
      workpack: makeWorkpack(),
      improvements: boundaryItems,
      period: "monthly",
      now: new Date("2026-07-08T12:00:00.000Z")
    });
    const weekly = buildReportSnapshot({
      workpack: makeWorkpack(),
      improvements: boundaryItems,
      period: "weekly",
      now: new Date("2026-07-08T12:00:00.000Z")
    });

    expect(monthly.improvements.map((item) => item.id)).toEqual([
      "month-start",
      "before-week",
      "week-start"
    ]);
    expect(weekly.improvements.map((item) => item.id)).toEqual(["week-start"]);
    expect(monthly.dateRange.start).toBe("2026-07-01");
    expect(weekly.dateRange.start).toBe("2026-07-06");
  });

  it("builds an inclusive custom-period report with a stable range filename", () => {
    const snapshot = buildReportSnapshot({
      workpack: makeWorkpack(),
      improvements: [
        { ...improvements[0], id: "imp-before", createdAt: "2026-07-06T14:59:59.999Z" },
        improvements[0],
        { ...improvements[0], id: "imp-after", createdAt: "2026-07-09T15:00:00.000Z" }
      ],
      period: "custom",
      dateRange: { start: "2026-07-07", end: "2026-07-09" },
      now: new Date("2026-07-11T12:00:00.000Z")
    });

    expect(snapshot.periodLabel).toBe("2026.07.07 - 2026.07.09 사용자 기간 리포트");
    expect(snapshot.fileBaseName).toContain("2026-07-07-to-2026-07-09");
    expect(snapshot.improvements.map((item) => item.id)).toEqual(["imp-1"]);
  });

  it("rejects incomplete and reversed custom date ranges with exact messages", () => {
    expect(() => buildReportSnapshot({
      workpack: makeWorkpack(),
      improvements: [],
      period: "custom"
    })).toThrowError("사용자 기간의 시작일과 종료일을 모두 선택하세요.");

    expect(() => buildReportSnapshot({
      workpack: makeWorkpack(),
      improvements: [],
      period: "custom",
      dateRange: { start: "2026-07-10", end: "2026-07-09" }
    })).toThrowError("사용자 기간의 시작일은 종료일보다 늦을 수 없습니다.");
  });

  it("builds a period report with risk rows and photo improvements", () => {
    const snapshot = buildReportSnapshot({
      workpack: makeWorkpack(),
      improvements,
      period: "weekly",
      photoApprovals: [{
        improvementId: "imp-1",
        beforePhotoName: "before-scaffold.jpg",
        afterPhotoName: "after-guardrail.jpg"
      }],
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

  it("does not infer improvement status from risk verification or photo approval", () => {
    const snapshot = buildReportSnapshot({
      workpack: makeWorkpack([electricalRow]),
      improvements: [{
        ...improvements[0],
        id: "status-independent",
        siteName: electricalRow.location,
        workSummary: electricalRow.task,
        hazardLabel: electricalRow.hazard
      }],
      period: "weekly",
      photoApprovals: [{
        improvementId: "status-independent",
        beforePhotoName: "before-scaffold.jpg",
        afterPhotoName: "after-guardrail.jpg"
      }],
      now: new Date("2026-07-08T12:00:00.000Z")
    });

    expect(snapshot.improvements[0]?.improvementStatus).toBe("candidate");
    expect(snapshot.riskRows[0]).not.toHaveProperty("improvementStatus");

    const reflectedFilter = buildReportSnapshot({
      workpack: makeWorkpack([electricalRow]),
      improvements: [{
        ...improvements[0],
        id: "status-independent",
        siteName: electricalRow.location,
        workSummary: electricalRow.task,
        hazardLabel: electricalRow.hazard,
        riskAssociation: {
          siteName: electricalRow.location,
          process: electricalRow.process,
          task: electricalRow.task,
          hazard: electricalRow.hazard
        }
      }],
      period: "weekly",
      filters: { improvementStatus: "reflected" },
      now: new Date("2026-07-08T12:00:00.000Z")
    });

    expect(reflectedFilter.riskRows).toEqual([]);
    expect(reflectedFilter.improvements).toEqual([]);
  });

  it("preserves an explicit status stored on the improvement", () => {
    const reflectedImprovement = {
      ...improvements[0],
      status: "reflected"
    } as OperationImprovement & { status: "reflected" };
    const snapshot = buildReportSnapshot({
      workpack: makeWorkpack(),
      improvements: [reflectedImprovement],
      period: "weekly",
      now: new Date("2026-07-08T12:00:00.000Z")
    });

    expect(snapshot.improvements[0]?.improvementStatus).toBe("reflected");
    expect(snapshot.improvements[0]?.improvementStatusLabel).toBe("반영됨");
  });

  it("preserves legacy improvement statuses in report rows, filters, and labels", () => {
    const snapshot = buildReportSnapshot({
      workpack: makeWorkpack(),
      improvements: [
        { ...improvements[0], id: "legacy-proposed", status: "proposed" },
        { ...improvements[0], id: "legacy-in-progress", status: "in_progress" },
        { ...improvements[0], id: "legacy-on-hold", status: "on_hold" },
        { ...improvements[0], id: "legacy-completed", status: "completed" },
        { ...improvements[0], id: "legacy-verified", status: "verified" }
      ],
      period: "weekly",
      now: new Date("2026-07-08T12:00:00.000Z")
    });

    expect(snapshot.improvements.map((item) => [item.id, item.improvementStatus, item.improvementStatusLabel])).toEqual([
      ["legacy-proposed", "proposed", "제안됨"],
      ["legacy-in-progress", "in_progress", "진행 중"],
      ["legacy-on-hold", "on_hold", "보류됨"],
      ["legacy-completed", "completed", "완료됨"],
      ["legacy-verified", "verified", "검증됨"]
    ]);
    expect(snapshot.facets.improvementStatuses).toEqual(expect.arrayContaining([
      expect.objectContaining({ value: "proposed", label: "제안됨" }),
      expect.objectContaining({ value: "in_progress", label: "진행 중" }),
      expect.objectContaining({ value: "on_hold", label: "보류됨" }),
      expect.objectContaining({ value: "completed", label: "완료됨" }),
      expect.objectContaining({ value: "verified", label: "검증됨" })
    ]));

    const filtered = buildReportSnapshot({
      workpack: makeWorkpack(),
      improvements: [
        { ...improvements[0], id: "legacy-proposed", status: "proposed" },
        { ...improvements[0], id: "legacy-completed", status: "completed" }
      ],
      period: "weekly",
      filters: { improvementStatus: "completed" },
      now: new Date("2026-07-08T12:00:00.000Z")
    });

    expect(filtered.improvements.map((item) => item.id)).toEqual(["legacy-completed"]);
  });

  it("keeps sample previews non-downloadable until a valid real workpack exists", () => {
    const snapshot = buildReportSnapshot({
      workpack: makeWorkpack(),
      improvements: [],
      period: "weekly",
      sourceMode: "sample",
      now: new Date("2026-07-08T12:00:00.000Z")
    });
    const viewState = resolveReportViewState(snapshot);

    expect(viewState).toEqual({
      status: "blocked",
      title: "다운로드 잠김",
      detail: "샘플 데이터는 미리보기 전용이며 모든 내보내기가 비활성화됩니다.",
      canDownload: false
    });
  });

  it("treats a normally missing current workpack as a calm empty state", () => {
    expect(resolveReportViewState(null)).toEqual({
      status: "empty",
      title: "최근 작업팩이 없습니다.",
      detail: "작업공간에서 문서팩을 만든 뒤 리포트로 돌아오세요.",
      canDownload: false
    });
  });

  it("links an improvement only through its exact explicit risk association", () => {
    const secondRisk = {
      ...electricalRow,
      location: riskRow.location,
      hazard: riskRow.hazard
    };
    const explicitlyLinked = {
      ...improvements[0],
      riskAssociation: {
        siteName: secondRisk.location,
        process: secondRisk.process,
        task: secondRisk.task,
        hazard: secondRisk.hazard
      }
    } as OperationImprovement & {
      riskAssociation: { siteName: string; process: string; task: string; hazard: string };
    };
    const snapshot = buildReportSnapshot({
      workpack: makeWorkpack([riskRow, secondRisk]),
      improvements: [explicitlyLinked],
      period: "weekly",
      now: new Date("2026-07-08T12:00:00.000Z")
    });

    expect(snapshot.improvements[0]?.process).toBe(secondRisk.process);
    expect(snapshot.improvements[0]?.task).toBe(secondRisk.task);
    expect(snapshot.improvements[0]?.linkedRiskIndex).toBe(2);
  });

  it("fails closed for missing or ambiguous risk associations", () => {
    const legacyImprovement: OperationImprovement = {
      ...improvements[0],
      id: "legacy-unlinked",
      riskAssociation: undefined
    };
    const ambiguousImprovement: OperationImprovement = {
      ...improvements[0],
      id: "ambiguous-link"
    };
    const snapshot = buildReportSnapshot({
      workpack: makeWorkpack([riskRow, { ...riskRow }]),
      improvements: [legacyImprovement, ambiguousImprovement],
      period: "weekly",
      now: new Date("2026-07-08T12:00:00.000Z")
    });
    const filtered = buildReportSnapshot({
      workpack: makeWorkpack([riskRow, { ...riskRow }]),
      improvements: [legacyImprovement, ambiguousImprovement],
      period: "weekly",
      filters: { process: riskRow.process },
      now: new Date("2026-07-08T12:00:00.000Z")
    });

    expect(snapshot.improvements.map((item) => item.process)).toEqual(["미연결", "미연결"]);
    expect(snapshot.improvements.every((item) => item.linkedRiskIndex === undefined)).toBe(true);
    expect(filtered.improvements).toEqual([]);
  });

  it("fails closed when an explicit risk association conflicts with the improvement site", () => {
    const snapshot = buildReportSnapshot({
      workpack: makeWorkpack(),
      improvements: [{
        ...improvements[0],
        id: "cross-site-conflict",
        siteName: "부산 물류센터",
        workSummary: "부산 설비 점검",
        riskAssociation: {
          siteName: riskRow.location,
          process: riskRow.process,
          task: riskRow.task,
          hazard: riskRow.hazard
        }
      }],
      period: "weekly",
      now: new Date("2026-07-08T12:00:00.000Z")
    });

    expect(snapshot.improvements[0]).toMatchObject({
      siteName: "부산 물류센터",
      process: "미연결",
      task: "부산 설비 점검",
      assignee: "미지정"
    });
    expect(snapshot.improvements[0]?.linkedRiskIndex).toBeUndefined();
  });

  it("exposes row ownership as assignee rather than a fictional team", () => {
    const linkedImprovement = {
      ...improvements[0],
      riskAssociation: {
        siteName: riskRow.location,
        process: riskRow.process,
        task: riskRow.task,
        hazard: riskRow.hazard
      }
    } as OperationImprovement & {
      riskAssociation: { siteName: string; process: string; task: string; hazard: string };
    };
    const snapshot = buildReportSnapshot({
      workpack: makeWorkpack(),
      improvements: [linkedImprovement],
      period: "weekly",
      now: new Date("2026-07-08T12:00:00.000Z")
    });

    expect(snapshot.riskRows[0]?.assignee).toBe("현장소장");
    expect(snapshot.improvements[0]?.assignee).toBe("현장소장");
    expect(snapshot.facets.assignees.map((option) => option.value)).toEqual(["현장소장"]);
    expect(snapshot.filters).not.toHaveProperty("team");
  });

  it("filters risk rows and their matched improvements by process", () => {
    const snapshot = buildMixedSnapshot({ process: "외벽 도장" });

    expect(snapshot.riskRows.map((row) => row.hazard)).toEqual(["추락 위험"]);
    expect(snapshot.improvements.map((item) => item.id)).toEqual(["imp-1"]);
  });

  it("filters risk rows and their matched improvements by task", () => {
    const snapshot = buildMixedSnapshot({ task: "분전반 점검" });

    expect(snapshot.riskRows.map((row) => row.hazard)).toEqual(["감전 위험"]);
    expect(snapshot.improvements.map((item) => item.id)).toEqual(["imp-electrical"]);
  });

  it("filters risk rows and their matched improvements by risk level", () => {
    const snapshot = buildMixedSnapshot({ riskLevel: "medium" });

    expect(snapshot.riskRows.map((row) => row.hazard)).toEqual(["감전 위험"]);
    expect(snapshot.improvements.map((item) => item.id)).toEqual(["imp-electrical"]);
  });

  it("filters risk rows and their matched improvements by improvement status", () => {
    const snapshot = buildMixedSnapshot({ improvementStatus: "reflected" });

    expect(snapshot.riskRows.map((row) => row.hazard)).toEqual(["감전 위험"]);
    expect(snapshot.improvements.map((item) => item.id)).toEqual(["imp-electrical"]);
    expect(snapshot.improvements[0]?.improvementStatusLabel).toBe("반영됨");
  });

  it("filters risk rows and improvements by site", () => {
    const snapshot = buildMixedSnapshot({ site: "부산 물류센터" });

    expect(snapshot.riskRows.map((row) => row.hazard)).toEqual(["감전 위험"]);
    expect(snapshot.improvements.map((item) => item.id)).toEqual(["imp-electrical"]);
  });

  it("filters risk rows and their matched improvements by assignee", () => {
    const snapshot = buildMixedSnapshot({ assignee: "전기팀" });

    expect(snapshot.riskRows.map((row) => row.hazard)).toEqual(["감전 위험"]);
    expect(snapshot.improvements.map((item) => item.id)).toEqual(["imp-electrical"]);
  });

  it("exposes six report facets from the unfiltered source rows", () => {
    const snapshot = buildMixedSnapshot({});

    expect(snapshot.facets.processes.map((option) => option.value)).toEqual(["외벽 도장", "전기 설비"]);
    expect(snapshot.facets.tasks.map((option) => option.value)).toEqual(["이동식 비계 작업", "분전반 점검"]);
    expect(snapshot.facets.riskLevels).toEqual([
      expect.objectContaining({ value: "high", label: "상" }),
      expect.objectContaining({ value: "medium", label: "중" })
    ]);
    expect(snapshot.facets.improvementStatuses).toEqual([
      expect.objectContaining({ value: "candidate", label: "후보" }),
      expect.objectContaining({ value: "reflected", label: "반영됨" })
    ]);
    expect(snapshot.facets.sites.map((option) => option.value)).toEqual(["서울 성수동", "부산 물류센터"]);
    expect(snapshot.facets.assignees.map((option) => option.value)).toEqual(["현장소장", "전기팀"]);
  });

  it("includes before and after photo names only after explicit report approval", () => {
    const baseInput = {
      workpack: makeWorkpack(),
      improvements: [improvements[0]],
      period: "weekly" as const,
      now: new Date("2026-07-08T12:00:00.000Z")
    };
    const unapproved = buildReportSnapshot(baseInput);
    const approved = buildReportSnapshot({
      ...baseInput,
      photoApprovals: [{
        improvementId: "imp-1",
        beforePhotoName: "before-scaffold.jpg",
        afterPhotoName: "after-guardrail.jpg"
      }]
    });

    expect(unapproved.summary.photoCandidates).toBe(1);
    expect(unapproved.summary.photoImprovements).toBe(0);
    expect(unapproved.improvements[0]?.photoNames).toEqual([]);
    expect(buildReportMarkdown(unapproved)).not.toContain("before-scaffold.jpg");
    expect(buildReportCsv(unapproved)).not.toContain("before-scaffold.jpg");
    expect(buildReportJson(unapproved)).not.toContain("after-guardrail.jpg");
    expect(approved.summary.photoImprovements).toBe(1);
    expect(approved.improvements[0]?.photoNames).toEqual(["before-scaffold.jpg", "after-guardrail.jpg"]);
    expect(buildReportMarkdown(approved)).toContain("before-scaffold.jpg");
    expect(buildReportCsv(approved)).toContain("before-scaffold.jpg · after-guardrail.jpg");
    expect(buildReportJson(approved)).toContain("after-guardrail.jpg");
  });

  it("binds photo approval to the exact improvement and photo pair", () => {
    const baseInput = {
      workpack: makeWorkpack(),
      improvements: [improvements[0]],
      period: "weekly" as const,
      now: new Date("2026-07-08T12:00:00.000Z")
    };
    const approval = {
      improvementId: "imp-1",
      beforePhotoName: "before-scaffold.jpg",
      afterPhotoName: "after-guardrail.jpg"
    };
    const approved = buildReportSnapshot({ ...baseInput, photoApprovals: [approval] });
    const changedPair = buildReportSnapshot({
      ...baseInput,
      improvements: [{ ...improvements[0], afterPhotoName: "replacement.jpg" }],
      photoApprovals: [approval]
    });

    expect(approved.improvements[0]?.photoApproved).toBe(true);
    expect(changedPair.improvements[0]?.photoApproved).toBe(false);
    expect(changedPair.improvements[0]?.photoNames).toEqual([]);
  });

  it("resolves exact empty, download-ready, and error states", () => {
    const readySnapshot = buildMixedSnapshot({});
    const emptySnapshot = buildMixedSnapshot({ process: "없는 공정" });

    expect(resolveReportViewState(readySnapshot)).toEqual({
      status: "ready",
      title: "다운로드 준비됨",
      detail: "위험 2건 · 개선 2건",
      canDownload: true
    });
    expect(resolveReportViewState(emptySnapshot)).toEqual({
      status: "empty",
      title: "조건에 맞는 리포트가 없습니다.",
      detail: "기간 또는 필터를 조정하세요.",
      canDownload: false
    });
    expect(resolveReportViewState(null, "사용자 기간 오류")).toEqual({
      status: "error",
      title: "리포트를 준비하지 못했습니다.",
      detail: "사용자 기간 오류",
      canDownload: false
    });
  });

  it("records the selected date range and filters in JSON and markdown exports", () => {
    const snapshot = buildReportSnapshot({
      workpack: makeWorkpack([riskRow, electricalRow]),
      improvements: mixedImprovements,
      period: "custom",
      dateRange: { start: "2026-07-07", end: "2026-07-09" },
      filters: {
        process: "전기 설비",
        site: "부산 물류센터",
        assignee: "전기팀"
      },
      now: new Date("2026-07-11T12:00:00.000Z")
    });
    const json = JSON.parse(buildReportJson(snapshot)) as {
      dateRange: { start: string; end: string };
      filters: Record<string, string>;
    };
    const markdown = buildReportMarkdown(snapshot);

    expect(snapshot.title).toContain("부산 물류센터");
    expect(json.dateRange).toEqual({ start: "2026-07-07", end: "2026-07-09" });
    expect(json.filters).toEqual({ process: "전기 설비", site: "부산 물류센터", assignee: "전기팀" });
    expect(markdown).toContain("## 적용 조건");
    expect(markdown).toContain("- 기간: 2026.07.07 - 2026.07.09 사용자 기간 리포트");
    expect(markdown).toContain("- 공정: 전기 설비");
    expect(markdown).toContain("- 현장: 부산 물류센터");
    expect(markdown).toContain("- 담당자: 전기팀");
  });

  it("distinguishes sample, browser recent, and server-saved provenance", () => {
    const generatedAt = "2026-07-08T07:45:00.000Z";
    const generatedWorkpack = makeWorkpack();
    generatedWorkpack.data = attachQualityContract(generatedWorkpack.data, generatedAt);
    const localSnapshot = buildReportSnapshot({
      workpack: generatedWorkpack,
      improvements: [improvements[0]],
      period: "weekly",
      sourceMode: "browser_local",
      now: new Date("2026-07-08T12:00:00.000Z")
    });
    const serverSnapshot = buildReportSnapshot({
      workpack: generatedWorkpack,
      improvements: [],
      period: "weekly",
      sourceMode: "server_saved",
      sourceWorkpackId: "server-workpack-1",
      now: new Date("2026-07-08T12:00:00.000Z")
    });
    const sampleSnapshot = buildReportSnapshot({
      workpack: generatedWorkpack,
      improvements: [],
      period: "weekly",
      sourceMode: "sample",
      now: new Date("2026-07-08T12:00:00.000Z")
    });

    expect(localSnapshot.source).toMatchObject({
      mode: "browser_local",
      scope: "current_browser",
      workpackGeneratedAt: generatedAt
    });
    expect(serverSnapshot.source).toMatchObject({
      mode: "server_saved",
      scope: "server_workpack",
      workpackId: "server-workpack-1",
      workpackGeneratedAt: generatedAt
    });
    expect(sampleSnapshot.source).toMatchObject({
      mode: "sample",
      scope: "sample_preview",
      workpackGeneratedAt: generatedAt
    });
    expect(sampleSnapshot.source.riskRowTimeBasis).toBe("workpack_saved_at");
    for (const [snapshot, scope, mode, limitation] of [
      [localSnapshot, "현재 브라우저 작업팩", "브라우저 로컬 저장", "현재 브라우저 작업팩만 포함"],
      [serverSnapshot, "서버 저장 작업팩", "서버 저장", "서버 저장 작업팩 1건만 포함"],
      [sampleSnapshot, "샘플 미리보기", "샘플 미리보기", "샘플 데이터만 포함"]
    ] as const) {
      expect(buildReportJson(snapshot)).toContain(snapshot.source.scope);
      expect(buildReportJson(snapshot)).toContain(snapshot.source.mode);
      expect(buildReportJson(snapshot)).toContain("workpack_saved_at");
      for (const presented of [
        buildReportCsv(snapshot),
        buildReportMarkdown(snapshot),
        buildReportLearningJsonl(snapshot),
        buildReportLearningMarkdown(snapshot)
      ]) {
        expect(presented).toContain(scope);
        expect(presented).toContain(mode);
        expect(presented).toContain("작업팩 저장 시각");
        expect(presented).toContain(limitation);
        expect(presented).toContain(snapshot.source.workpackSavedAt);
        expect(presented).toContain(generatedAt);
        expect(presented).not.toMatch(/current_browser|server_workpack|sample_preview|browser_local|server_saved|workpack_saved_at|current_browser_only|server_saved_workpack_only|sample_data_only/u);
      }
    }
  });

  it("neutralizes unknown typed source values at every user-output boundary", () => {
    const snapshot = buildReportSnapshot({
      workpack: makeWorkpack(),
      improvements: [],
      period: "weekly",
      now: new Date("2026-07-08T12:00:00.000Z")
    });
    const unknownSnapshot = {
      ...snapshot,
      source: {
        ...snapshot.source,
        mode: "future_report_mode",
        scope: "future_report_scope",
        riskRowTimeBasis: "future_time_basis",
        limitations: ["future_report_limitation"]
      }
    } as unknown as typeof snapshot;
    const rawTokens = /future_report_mode|future_report_scope|future_time_basis|future_report_limitation/u;

    expect(buildReportJson(unknownSnapshot)).toMatch(rawTokens);
    for (const presented of [
      buildReportCsv(unknownSnapshot),
      buildReportMarkdown(unknownSnapshot),
      buildReportLearningJsonl(unknownSnapshot),
      buildReportLearningMarkdown(unknownSnapshot)
    ]) {
      expect(presented).toContain("분류 검토 필요");
      expect(presented).not.toMatch(rawTokens);
    }
  });

  it("neutralizes unknown period, risk, and improvement enums in every presentation", () => {
    const snapshot = buildReportSnapshot({
      workpack: makeWorkpack(),
      improvements: [improvements[0]],
      period: "weekly",
      now: new Date("2026-07-08T12:00:00.000Z")
    });
    const unknownSnapshot = {
      ...snapshot,
      period: "future_period",
      filters: {
        riskLevel: "future_risk_level",
        improvementStatus: "future_improvement_status"
      },
      riskRows: snapshot.riskRows.map((row) => ({ ...row, riskLevel: "future_risk_level" })),
      improvements: snapshot.improvements.map((item) => ({
        ...item,
        improvementStatus: "future_improvement_status"
      }))
    } as unknown as typeof snapshot;
    const rawTokens = /future_period|future_risk_level|future_improvement_status/u;

    expect(buildReportJson(unknownSnapshot)).toMatch(rawTokens);
    for (const presented of [
      buildReportCsv(unknownSnapshot),
      buildReportMarkdown(unknownSnapshot),
      buildReportLearningJsonl(unknownSnapshot),
      buildReportLearningMarkdown(unknownSnapshot)
    ]) {
      expect(presented).toContain("분류 검토 필요");
      expect(presented).not.toMatch(rawTokens);
    }
  });

  it("validates a server reopen payload before fingerprinting it", () => {
    const workpack = makeWorkpack();
    const validPayload = {
      canReopen: true,
      workpack: {
        id: "server-workpack-validated",
        createdAt: "2026-07-08T07:55:00.000Z",
        updatedAt: "2026-07-08T08:00:00.000Z",
        reopenData: workpack.data
      }
    };

    const parsed = inspectServerReportWorkpackPayload(validPayload, "server-workpack-validated");
    expect(parsed).toMatchObject({
      id: "server-workpack-validated",
      workpack: {
        savedAt: "2026-07-08T08:00:00.000Z",
        data: { question: workpack.data.question }
      }
    });

    const malformedCandidates: unknown[] = [
      { ...workpack.data, citations: [null] },
      { ...workpack.data, practicalPoints: ["valid", null] },
      { ...workpack.data, scenario: { ...workpack.data.scenario, workSummary: 42 } },
      { ...workpack.data, deliverables: { ...workpack.data.deliverables, riskAssessmentDraft: null } },
      { ...workpack.data, externalData: [] },
      { ...workpack.data, riskSummary: { ...workpack.data.riskSummary, immediateActions: "legacy" } },
      { ...workpack.data, status: { ...workpack.data.status, summary: 42 } },
      {
        ...workpack.data,
        structured: {
          ...workpack.data.structured,
          riskAssessmentRows: [{ ...riskRow, evidenceRefs: ["valid", null] }]
        }
      }
    ];
    for (const reopenData of malformedCandidates) {
      const malformedPayload = {
        ...validPayload,
        workpack: { ...validPayload.workpack, reopenData }
      };
      expect(() => inspectServerReportWorkpackPayload(
        malformedPayload,
        "server-workpack-validated"
      )).not.toThrow();
      expect(inspectServerReportWorkpackPayload(
        malformedPayload,
        "server-workpack-validated"
      )).toBeNull();
    }
  });

  it("strips caller-provided authoritative improvements from every sample export", () => {
    const authoritativeSentinel = "AUTHORITATIVE_IMPROVEMENT_MUST_NOT_SERIALIZE";
    const sampleSnapshot = buildReportSnapshot({
      workpack: makeWorkpack(),
      improvements: [{
        ...improvements[0],
        id: "authoritative-improvement",
        improvementText: authoritativeSentinel
      }],
      period: "weekly",
      sourceMode: "sample",
      now: new Date("2026-07-08T12:00:00.000Z")
    });

    expect(sampleSnapshot.improvements).toEqual([]);
    expect(sampleSnapshot.summary.improvements).toBe(0);
    expect(sampleSnapshot.facets.improvementStatuses).toEqual([]);
    expect(sampleSnapshot.groups.byDocument).toEqual([]);
    for (const exported of [
      buildReportCsv(sampleSnapshot),
      buildReportJson(sampleSnapshot),
      buildReportMarkdown(sampleSnapshot),
      buildReportLearningJsonl(sampleSnapshot),
      buildReportLearningMarkdown(sampleSnapshot)
    ]) {
      expect(exported).not.toContain(authoritativeSentinel);
      expect(exported).not.toContain("authoritative-improvement");
    }
  });

  it("surfaces an honest parse error when the stored current-workpack timestamp is legacy or invalid", () => {
    const workpack = makeWorkpack();
    const result = inspectStoredCurrentWorkpack(JSON.stringify({
      ...workpack,
      savedAt: "2026-07-08T08:00:00"
    }));

    expect(result).toEqual({
      status: "invalid",
      reason: "현재 작업팩 저장시각이 유효한 RFC3339 offset 시각이 아니어서 증빙 리포트를 복원할 수 없습니다."
    });
  });

  it("keeps complete source metadata in CSV when filters produce no data rows", () => {
    const snapshot = buildReportSnapshot({
      workpack: makeWorkpack(),
      improvements: [improvements[0]],
      period: "weekly",
      filters: { process: "없는 공정" },
      sourceMode: "browser_local",
      now: new Date("2026-07-08T12:00:00.000Z")
    });
    const csv = buildReportCsv(snapshot);

    expect(snapshot.riskRows).toEqual([]);
    expect(snapshot.improvements).toEqual([]);
    expect(csv).toContain("현재 브라우저 작업팩");
    expect(csv).toContain("현재 브라우저 작업팩만 포함");
    expect(csv).toContain("작업팩 저장 시각");
    expect(csv).not.toMatch(/current_browser|workpack_saved_at|source_metadata/u);
    expect(csv).toContain(snapshot.source.workpackSavedAt);
  });

  it("renders improvement comparison markdown without external submission wording", () => {
    const snapshot = buildReportSnapshot({
      workpack: makeWorkpack(),
      improvements,
      period: "weekly",
      photoApprovals: [{
        improvementId: "imp-1",
        beforePhotoName: "before-scaffold.jpg",
        afterPhotoName: "after-guardrail.jpg"
      }],
      now: new Date("2026-07-08T12:00:00.000Z")
    });
    const markdown = buildReportMarkdown(snapshot);

    expect(markdown).toContain("## 위험성평가 개선 전 / 개선 후");
    expect(markdown).toContain("개선 전/개선 후 사진");
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

  it("presents every known risk and improvement enum across user exports", () => {
    const lowRiskRow: RiskAssessmentRow = {
      ...riskRow,
      location: "인천 정비동",
      process: "정비",
      task: "공구 점검",
      hazard: "낙하 위험",
      riskLevel: "low"
    };
    const statuses = [
      ["candidate", "후보"],
      ["approved", "승인됨"],
      ["rejected", "반려됨"],
      ["reflected", "반영됨"],
      ["proposed", "제안됨"],
      ["in_progress", "진행 중"],
      ["on_hold", "보류됨"],
      ["completed", "완료됨"],
      ["verified", "검증됨"]
    ] as const;
    const snapshot = buildReportSnapshot({
      workpack: makeWorkpack([riskRow, electricalRow, lowRiskRow]),
      improvements: statuses.map(([status], index) => ({
        ...improvements[0],
        id: `known-status-${index}`,
        status
      })),
      period: "weekly",
      now: new Date("2026-07-08T12:00:00.000Z")
    });

    for (const presented of [
      buildReportCsv(snapshot),
      buildReportMarkdown(snapshot),
      buildReportLearningJsonl(snapshot),
      buildReportLearningMarkdown(snapshot)
    ]) {
      for (const label of ["상", "중", "하"]) expect(presented).toContain(label);
      for (const [, label] of statuses) expect(presented).toContain(label);
      for (const [value] of statuses) expect(presented).not.toContain(`"${value}"`);
      expect(presented).not.toMatch(/"(?:high|medium|low)"/u);
    }
  });

  it("neutralizes formula-capable values in every CSV cell", () => {
    const maliciousRisk: RiskAssessmentRow = {
      ...riskRow,
      hazard: "=2+3",
      currentControls: "+SUM(A1)",
      additionalControls: "-1+1",
      owner: "@SUM(A1)"
    };
    const snapshot = buildReportSnapshot({
      workpack: makeWorkpack([maliciousRisk]),
      improvements: [],
      period: "weekly",
      now: new Date("2026-07-08T12:00:00.000Z")
    });
    const csv = buildReportCsv(snapshot);

    expect(csv).toContain(",'=2+3,");
    expect(csv).toContain(",'+SUM(A1),");
    expect(csv).toContain(",'-1+1,");
    expect(csv).toContain(",'@SUM(A1),");
    expect(csv).not.toContain(",=2+3,");
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

    expect(events.map((event) => event.eventType)).toContain("기간 요약");
    expect(events.map((event) => event.eventType)).toContain("운영 기준");
    expect(events.map((event) => event.eventType)).toContain("위험행");
    expect(events.map((event) => event.eventType)).toContain("개선사항");
    expect(events.map((event) => event.eventType)).toContain("분류 그룹");
    expect(events.find((event) => event.eventType === "개선사항")?.payload).toMatchObject({
      hazardLabel: "추락 위험",
      improvementStatus: "후보",
      sourceLabel: "개선 전/개선 후 사진"
    });
    expect(events.find((event) => event.eventType === "위험행")?.payload.riskLevel).toBe("상");
    expect(events.find((event) => event.eventType === "운영 기준")?.payload).toMatchObject({
      authority: "운영자 검토 코퍼스",
      runtimeAuthority: false,
      modelFineTuning: false
    });
    expect(buildReportLearningJsonl(snapshot)).not.toContain("operator_review_corpus");
    expect(events.every((event) => (event as { period?: string }).period === "주간")).toBe(true);
    expect(events.some((event) => event.eventType === "분류 그룹" && event.payload.groupType === "위험등급")).toBe(true);
    expect(buildReportLearningJsonl(snapshot)).not.toMatch(/period_summary|risk_row|classification_group|risk_level|\bweekly\b|\bhigh\b|\bcandidate\b/u);
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
    expect(markdown).toContain("권한: 운영자 검토 코퍼스");
    expect(markdown).not.toContain("operator_review_corpus");
    expect(markdown).toContain("재생성 가능한 코퍼스");
    expect(markdown).toContain("## 개선 이벤트");
    expect(markdown).toContain("개선 전/개선 후 사진");
    expect(markdown).toContain("## 분류 인덱스");
    expect(markdown).not.toContain("파인튜닝 완료");
    expect(markdown).not.toContain("학습 완료");
  });

  it("uses Korean improvement boundaries in CSV and Markdown while preserving corpus event keys", () => {
    const localizedRiskRow: RiskAssessmentRow = {
      ...riskRow,
      verification: "TBM 확인 및 개선 전/개선 후 사진 기록"
    };
    const snapshot = buildReportSnapshot({
      workpack: makeWorkpack([localizedRiskRow]),
      improvements,
      period: "weekly",
      now: new Date("2026-07-08T12:00:00.000Z")
    });
    const csv = buildReportCsv(snapshot);
    const reportMarkdown = buildReportMarkdown(snapshot);
    const corpusMarkdown = buildReportLearningMarkdown(snapshot);
    const events = buildReportLearningJsonl(snapshot)
      .trim()
      .split("\n")
      .map((line) => JSON.parse(line) as { eventType: string; payload: Record<string, unknown> });

    for (const presentation of [csv, reportMarkdown, corpusMarkdown]) {
      expect(presentation).not.toMatch(/\b(?:As-Is|To-Be|Before\/After)\b/u);
      expect(presentation).toContain("개선 전");
      expect(presentation).toContain("개선 후");
    }
    const riskEvent = events.find((event) => event.eventType === "위험행");
    const improvementEvent = events.find((event) => event.eventType === "개선사항");
    expect(riskEvent?.payload).toHaveProperty("asIs");
    expect(riskEvent?.payload).toHaveProperty("toBe");
    expect(improvementEvent?.payload).toHaveProperty("asIs");
    expect(improvementEvent?.payload).toHaveProperty("toBe");
    expect(improvementEvent?.payload.sourceLabel).toBe("개선 전/개선 후 사진");
  });

  it("parses local improvement history defensively", () => {
    const parsed = parseOperationImprovements(JSON.stringify([
      improvements[0],
      { ...improvements[0], id: "invalid-date", createdAt: "not-a-date" },
      { id: "bad", createdAt: "2026-07-08T00:00:00.000Z" }
    ]));

    expect(parsed).toHaveLength(1);
    expect(parsed[0]?.id).toBe("imp-1");
    expect(parsed[0]?.status).toBe("candidate");
    expect(parsed[0]?.riskAssociation).toEqual(improvements[0].riskAssociation);
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
