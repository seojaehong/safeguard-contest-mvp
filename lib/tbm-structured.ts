import type { AskResponse, TbmBriefingStructured, TbmLogStructured } from "./types";
import type { RiskAssessmentRow } from "./risk-assessment-schema";
import { formatWorkerCount, hasKnownWorkerCount } from "./scenario-display";

// 위험성평가 행에서 TBM 브리핑·기록 구조(서명표 포함)를 결정적으로 만든다.
// lib/search.ts 와 lib/mock-data.ts(template 경로)가 함께 쓰므로 순환 import 를 피해 따로 둔다.
// 결정 10(2026-10-25): 모든 모드에서 구조화 TBM 을 기본으로 낸다.

type TbmHazardCategory = TbmBriefingStructured["hazards"][number]["category"];

function compactTbmText(value: string | undefined, fallback: string, maxLength: number): string {
  const text = (value || fallback).replace(/\s+/g, " ").trim() || fallback;
  if (text.length <= maxLength) return text;
  return `${text.slice(0, Math.max(0, maxLength - 3)).trimEnd()}...`;
}

function uniqueNonEmpty(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function tbmCategory(row: RiskAssessmentRow): TbmHazardCategory {
  return row.fourM;
}

function equipmentFromScenarioRows(scenario: AskResponse["scenario"], rows: RiskAssessmentRow[]): string[] {
  const fromRows = rows.flatMap((row) => row.equipment.split(/[,/·]/).map((part) => part.trim()));
  const values = uniqueNonEmpty(fromRows);
  if (values.length) return values.slice(0, 5);
  return uniqueNonEmpty([scenario.workSummary, "보호구", "작업구역 표지"]).slice(0, 5);
}

function tbmRows(rows: RiskAssessmentRow[]): RiskAssessmentRow[] {
  return rows.length ? rows.slice(0, 5) : [];
}

function fillTbmList(values: string[], fallbacks: string[], count: number): string[] {
  const filled = uniqueNonEmpty([...values, ...fallbacks]).slice(0, count);
  return filled.length >= count ? filled : [...filled, ...fallbacks].slice(0, count);
}

export function buildTbmBriefingStructuredFromRiskRows(
  scenario: AskResponse["scenario"],
  rows: RiskAssessmentRow[],
  weatherSummary: string
): TbmBriefingStructured {
  const selectedRows = tbmRows(rows);
  const hazards = selectedRows.map((row) => ({
    category: tbmCategory(row),
    description: compactTbmText(row.hazard, "작업 전 위험요인 확인", 60)
  }));
  const safeHazards = hazards.length ? hazards : [
    { category: "Management" as const, description: "작업 전 위험요인 확인" }
  ];
  const measures = selectedRows.map((row, index) => ({
    hazardRef: Math.min(index + 1, safeHazards.length),
    action: compactTbmText(row.additionalControls || row.currentControls, "작업 전 안전조치 확인", 80),
    owner: compactTbmText(row.owner, "작업반장", 30),
    evidenceRefs: [...row.evidenceRefs]
  }));
  const stopCriteria = fillTbmList(
    [
      weatherSummary ? `기상 신호 이상 시 작업중지: ${compactTbmText(weatherSummary, "", 46)}` : "",
      ...selectedRows
        .filter((row) => row.riskLevel === "high")
        .map((row) => `${compactTbmText(row.hazard, "고위험", 32)} 조치 전 작업 금지`)
    ],
    ["보호구 미착용 시 작업 금지", "통제구역 이탈 시 작업 중지", "관리감독자 확인 전 작업 재개 금지"],
    5
  );
  const confirmTopics = fillTbmList(
    selectedRows.map((row) => `${compactTbmText(row.hazard, "위험요인", 34)} 조치를 확인했습니까?`),
    ["작업중지 기준을 이해했습니까?", "비상연락과 대피경로를 확인했습니까?", "사진 증빙 위치를 확인했습니까?", "작업자 동선을 확인했습니까?", "보호구 착용을 확인했습니까?"],
    5
  );

  return {
    meta: {
      dateTime: "____년 __월 __일 __:__ (현장 기재)",
      location: scenario.siteName,
      target: hasKnownWorkerCount(scenario.workerCount) ? `전 작업자 ${formatWorkerCount(scenario.workerCount)}` : "전 작업자(인원 확인 필요)",
      attendees: "현장 서명 또는 열람 확인 버튼"
    },
    todayWork: {
      name: scenario.workSummary,
      location: scenario.siteName,
      time: "작업 전",
      equipment: equipmentFromScenarioRows(scenario, selectedRows)
    },
    hazards: safeHazards,
    measures: measures.length ? measures : [{
      hazardRef: 1,
      action: "작업 전 안전조치 확인",
      owner: "작업반장",
      evidenceRefs: []
    }],
    stopCriteria,
    confirmTopics,
    photoEvidenceLocation: "작업 전·중·후 사진을 문서팩 사진 증빙에 첨부"
  };
}

export function buildTbmLogStructuredFromRiskRows(
  scenario: AskResponse["scenario"],
  rows: RiskAssessmentRow[],
  weatherSummary: string
): TbmLogStructured {
  const selectedRows = tbmRows(rows);
  // PR-15: 인원을 모르면 1명으로 채우지 않는다. 예정 인원은 0(확인 필요)으로 두고 명단도 비운다.
  // 서명표 빈 칸은 출력기(xlsx 등)가 최소 1줄을 만든다.
  const workerCount = hasKnownWorkerCount(scenario.workerCount) ? scenario.workerCount : 0;
  const confirmations = fillTbmList(
    selectedRows.map((row) => `${compactTbmText(row.hazard, "위험요인", 34)} 조치 확인`),
    ["작업중지 기준 공유", "보호구 착용 확인", "비상연락망 확인", "사진 증빙 위치 공유", "작업자 동선 확인"],
    5
  );
  const keyPoints = fillTbmList(
    [
      ...selectedRows.map((row) => compactTbmText(row.additionalControls || row.currentControls, "작업 전 안전조치 확인", 70)),
      weatherSummary ? `기상 신호 확인: ${compactTbmText(weatherSummary, "기상 확인", 46)}` : ""
    ],
    ["위험성평가 결과를 TBM에서 재확인", "현장 변경사항은 즉시 작업반장에게 보고", "작업중지 기준 발생 시 즉시 대피"],
    5
  );
  const unaddressedItems = selectedRows
    .filter((row) => row.verificationStatus === "needsReview")
    .slice(0, 3)
    .map((row) => ({
      item: compactTbmText(row.hazard, "보완 필요 위험요인", 50),
      plannedAction: compactTbmText(row.additionalControls || row.verification, "관리감독자 확인 후 작업 재개", 70),
      owner: compactTbmText(row.owner, "작업반장", 30),
      dueDate: row.due || "현장 확인",
      evidenceRefs: [...row.evidenceRefs]
    }));

  return {
    meta: {
      dateTime: "____년 __월 __일 __:__ (현장 기재)",
      location: scenario.siteName,
      workType: scenario.workSummary,
      instructor: "작업반장"
    },
    attendance: {
      expected: workerCount,
      // 회의 전 초안이므로 실제 참석 인원·명단·결석 사유는 비워 두고 서명표 칸만 작업자 수만큼 만든다(TBM-04·08).
      actual: 0,
      attendees: Array.from({ length: workerCount }, () => ""),
      absenceReason: "현장 기재",
      confirmationMethod: "현장 서명 또는 열람 확인 버튼"
    },
    todayWork: {
      name: scenario.workSummary,
      location: scenario.siteName,
      time: "작업 전·중",
      equipment: equipmentFromScenarioRows(scenario, selectedRows)
    },
    workerConfirmations: confirmations,
    hazardsDiscussed: (selectedRows.length ? selectedRows : []).slice(0, 5).map((row, index) => ({
      category: tbmCategory(row),
      description: compactTbmText(row.hazard, "작업 전 위험요인 확인", 60),
      relatedRiskRowIndex: index
    })),
    safetyEducation: {
      topic: `${scenario.workSummary} 작업 전 위험성평가 공유`,
      keyPoints,
      materials: uniqueNonEmpty(selectedRows.flatMap((row) => row.evidenceRefs)).slice(0, 4).join(" / ") || "위험성평가표, KOSHA 자료, 현장 사진"
    },
    unaddressedItems,
    photoEvidence: {
      captureLocations: uniqueNonEmpty([scenario.siteName, scenario.workSummary]).slice(0, 3),
      storagePath: "SafeClaw 문서팩 사진 증빙"
    },
    signatures: {
      author: "작성자",
      reviewer: "검토자",
      approver: "승인자"
    }
  };
}
