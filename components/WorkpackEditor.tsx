"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AskResponse } from "@/lib/types";
import {
  evaluatePublicSafetyRubric,
  rubricCategoryLabel,
  rubricStatusLabel,
  type RubricDocumentKey,
  type RubricEvaluationItem
} from "@/lib/safety-document-rubric";

declare global {
  var measureTextWidth: ((font: string, text: string) => number) | undefined;
}

export type DocumentKey =
  | "workpackSummaryDraft"
  | "riskAssessmentDraft"
  | "workPlanDraft"
  | "workPermitDraft"
  | "tbmBriefing"
  | "tbmLogDraft"
  | "safetyEducationRecordDraft"
  | "emergencyResponseDraft"
  | "photoEvidenceDraft"
  | "foreignWorkerBriefing"
  | "foreignWorkerTransmission"
  | "kakaoMessage";

export type WorkpackDocumentValues = Record<DocumentKey, string>;

const rubricDocumentKeys: RubricDocumentKey[] = [
  "workpackSummaryDraft",
  "riskAssessmentDraft",
  "workPlanDraft",
  "tbmBriefing",
  "tbmLogDraft",
  "safetyEducationRecordDraft",
  "emergencyResponseDraft",
  "photoEvidenceDraft",
  "foreignWorkerBriefing",
  "foreignWorkerTransmission",
  "kakaoMessage"
];

function isRubricDocumentKey(key: DocumentKey): key is RubricDocumentKey {
  return rubricDocumentKeys.includes(key as RubricDocumentKey);
}

type EditableDocument = {
  key: DocumentKey;
  title: string;
  description: string;
  fileBase: string;
};

type RhwpModule = typeof import("@rhwp/core");
type SheetRow = {
  document: string;
  section: string;
  item: string;
  content: string;
};
type TemplateKind = "sheet" | "word" | "hwp";
type TemplatePreset = {
  kind: TemplateKind;
  label: string;
  description: string;
  previewTitle: string;
  previewBullets: string[];
};
type SafetyFormProfile = {
  code: string;
  subtitle: string;
  layout: "generic" | "risk" | "workPlan" | "permit" | "tbmBriefing" | "tbmLog" | "education" | "photo";
  primaryColumn: string;
  actionColumn: string;
  confirmationRows: string[];
  approvalLabels: string[];
};
type SectionGroup = {
  section: string;
  rows: SheetRow[];
};
type RemediationDraft = {
  itemId: string;
  text: string;
  status: "ready" | "error";
  message: string;
  providerLabel: string | null;
  policyNote: string;
  catalogStatus: {
    configured: boolean;
    ok: boolean;
    count: number;
    message: string;
  } | null;
  sources: Array<{
    title: string;
    agency: string;
    url: string;
    sourceType: string;
  }>;
};

let rhwpModulePromise: Promise<RhwpModule> | null = null;

const templatePresets: TemplatePreset[] = [
  {
    kind: "sheet",
    label: "Excel 시트형",
    description: "현장 표 양식처럼 행·열로 입력하고 결재 파일에 붙이기 좋은 형태",
    previewTitle: "표지 + 섹션 요약 + 확인 칸",
    previewBullets: ["섹션별 행·열 구조", "No./항목/내용/확인 컬럼", "인쇄 폭 1페이지 기준"]
  },
  {
    kind: "word",
    label: "Word 보고서형",
    description: "본문과 표를 함께 보여주는 점검 보고서형 문서",
    previewTitle: "보고서 헤더 + 본문 표",
    previewBullets: ["제목/메타/섹션 헤더", "본문형 설명과 표 혼합", "원청·관리자 보고용"]
  },
  {
    kind: "hwp",
    label: "HWPX 제출형",
    description: "한글 문서에서 열기 쉬운 공식 서식 항목 중심 문서",
    previewTitle: "한글 서식 + 확인/서명란",
    previewBullets: ["공식 서식 항목명 유지", "확인자·관리감독자 서명란", "한컴오피스 제출 흐름"]
  }
];

const documentMeta: EditableDocument[] = [
  {
    key: "workpackSummaryDraft",
    title: "점검결과 요약",
    description: "현장명, 작업조건, 핵심 위험, 즉시조치, 연결 상태를 첫 장으로 정리합니다.",
    fileBase: "workpack-summary"
  },
  {
    key: "riskAssessmentDraft",
    title: "위험성평가표",
    description: "KOSHA 절차에 맞춰 사전준비, 위험요인, 감소대책, 조치 확인을 정리합니다.",
    fileBase: "risk-assessment"
  },
  {
    key: "workPlanDraft",
    title: "작업계획서",
    description: "작업구간, 작업순서, 장비·인원, 허가·첨부, 작업중지 기준을 정리합니다.",
    fileBase: "work-plan"
  },
  {
    key: "workPermitDraft",
    title: "안전작업허가 확인서",
    description: "위험작업 허가, 작업시간, 격리·차단, 화재·가스·보호구, 종료 확인을 분리합니다.",
    fileBase: "work-permit"
  },
  {
    key: "tbmBriefing",
    title: "TBM/작업 전 안전점검회의",
    description: "작업내용, 위험요인, 안전대책, 참석자 확인을 브리핑 형식으로 정리합니다.",
    fileBase: "tbm-briefing"
  },
  {
    key: "tbmLogDraft",
    title: "TBM 기록",
    description: "작업일지·모바일 앱·사진·영상 기록까지 함께 남기는 회의 기록입니다.",
    fileBase: "tbm-log"
  },
  {
    key: "safetyEducationRecordDraft",
    title: "안전보건교육 기록",
    description: "교육대상, 교육내용, 확인방법, 후속 교육 추천을 분리해 남깁니다.",
    fileBase: "safety-education"
  },
  {
    key: "emergencyResponseDraft",
    title: "비상대응 절차",
    description: "사고 징후, 초기조치, 보고체계, 현장보존, 재발방지 흐름을 정리합니다.",
    fileBase: "emergency-response"
  },
  {
    key: "photoEvidenceDraft",
    title: "사진/증빙",
    description: "작업 전·후 사진, TBM/교육 증빙, 확인자와 보관 위치를 남깁니다.",
    fileBase: "photo-evidence"
  },
  {
    key: "foreignWorkerBriefing",
    title: "외국인 근로자 출력본",
    description: "쉬운 한국어와 상위 체류국가 언어 기본팩을 함께 제공하는 교육용 출력본입니다.",
    fileBase: "foreign-worker-briefing"
  },
  {
    key: "foreignWorkerTransmission",
    title: "외국인 근로자 전송본",
    description: "문자·카카오·밴드로 전송하기 좋은 짧은 다국어 안전공지입니다.",
    fileBase: "foreign-worker-message"
  },
  {
    key: "kakaoMessage",
    title: "현장 공유 메시지",
    description: "카카오톡·문자·단체방에 붙여넣기 좋은 축약본입니다.",
    fileBase: "field-message"
  }
];

function sanitizeFileName(value: string) {
  return value.replace(/[\\/:*?"<>|]/g, "-").replace(/\s+/g, "-").slice(0, 80) || "safeclaw";
}

function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function groupRowsBySection(rows: SheetRow[]) {
  return rows.reduce<SectionGroup[]>((groups, row) => {
    const existing = groups.find((group) => group.section === row.section);
    if (existing) {
      existing.rows.push(row);
      return groups;
    }
    groups.push({ section: row.section, rows: [row] });
    return groups;
  }, []);
}

function rowText(row: SheetRow) {
  return [row.item, row.content].filter(Boolean).join(" ");
}

function findRows(rows: SheetRow[], patterns: string[], fallbackCount = 3) {
  const matched = rows.filter((row) => {
    const text = rowText(row);
    return patterns.some((pattern) => text.includes(pattern));
  });
  return (matched.length ? matched : rows).slice(0, fallbackCount);
}

function compactContent(row: SheetRow | undefined, fallback: string) {
  if (!row) return fallback;
  return row.content || row.item || fallback;
}

function buildTbmBridgeRows(data: AskResponse, riskRows: SheetRow[]) {
  const riskItems = findRows(riskRows, ["위험", "추락", "전도", "충돌", "끼임", "화재", "중독", "노출"], 4);
  const weatherSignals = data.externalData.weather.actions.length
    ? data.externalData.weather.actions
    : [data.externalData.weather.summary || data.scenario.weatherNote];
  return riskItems.map((row, index) => ({
    risk: compactContent(row, data.riskSummary.topRisk),
    weather: weatherSignals[index % weatherSignals.length] || data.scenario.weatherNote,
    message: "작업 전 공유 · 이해 확인 · 위험 시 즉시 작업중지"
  }));
}

function inferDisasterType(text: string, index: number) {
  if (/추락|떨어|비계|고소|발판/.test(text)) return "추락";
  if (/전도|넘어|미끄|우천|바닥/.test(text)) return "전도/미끄럼";
  if (/충돌|지게차|동선|차량|운반/.test(text)) return "충돌/끼임";
  if (/화재|용접|화기|폭발/.test(text)) return "화재/폭발";
  if (/화학|중독|질식|밀폐|가스|노출/.test(text)) return "중독/노출";
  return index % 2 === 0 ? "협착/충돌" : "기타 재해";
}

function inferRiskFactor4M(text: string, index: number) {
  if (/지게차|장비|기계|비계|발판|공구|차량/.test(text)) return "Machine";
  if (/강풍|우천|폭염|날씨|바닥|밀폐|고소|작업장소/.test(text)) return "Media";
  if (/신규|미숙련|보호구|교육|작업자|근로자/.test(text)) return "Man";
  if (/작업중지|통제|감독|유도자|신호수|절차/.test(text)) return "Management";
  return ["Man", "Machine", "Media", "Management"][index % 4];
}

function inferEquipment(text: string, scenario: AskResponse["scenario"], index: number) {
  if (/지게차|운반|하역/.test(text)) return "지게차/운반장비";
  if (/비계|고소|발판/.test(text)) return "비계/작업발판";
  if (/용접|화기/.test(text)) return "용접기/화기장비";
  if (/화학|세척|약품/.test(text)) return "세척제/MSDS";
  if (/밀폐|가스|질식/.test(text)) return "가스측정기/환기설비";
  return index % 2 === 0 ? "작업장비/공도구" : scenario.companyType;
}

function buildPermitDraft(data: AskResponse) {
  const actionList = data.riskSummary.immediateActions.map((action, index) => `${index + 1}. ${action}`).join("\n");
  const weatherActions = data.externalData.weather.actions.slice(0, 2).map((action, index) => `${index + 1}. ${action}`).join("\n");
  return [
    "[1. 허가 기본정보]",
    `허가대상 작업: ${data.scenario.workSummary}`,
    `작업현장: ${data.scenario.siteName}`,
    `작업일시: ${new Date().toLocaleDateString("ko-KR")} 작업 전 확인`,
    `작업인원: ${data.scenario.workerCount.toLocaleString("ko-KR")}명`,
    "허가구분: 위험작업 / 작업계획서·위험성평가표 첨부 확인",
    "",
    "[2. 작업 전 허가조건]",
    `핵심위험: ${data.riskSummary.topRisk}`,
    `필수조치:\n${actionList}`,
    `기상·환경 확인:\n${weatherActions || data.scenario.weatherNote}`,
    "보호구: 안전모, 안전화, 작업특성별 보호구 착용 확인",
    "",
    "[3. 첨부서류 체크리스트]",
    "작업계획서: □ 첨부 □ 보완필요",
    "위험성평가표: □ 첨부 □ 보완필요",
    "TBM 참석명단: □ 첨부 □ 보완필요",
    "장비 제원/검사증/운전원 자격: □ 해당 □ 비해당 □ 보완필요",
    "MSDS/화기·밀폐·고소작업 별도 허가: □ 해당 □ 비해당 □ 보완필요",
    "사진/작업계획도/통제구역 표시: □ 첨부 □ 보완필요",
    "",
    "[4. 종료 확인]",
    "작업종료: □ 원상복구 □ 잔류위험 없음 □ 미조치사항 있음",
    "미조치사항 및 후속조치:",
    "종료 확인자:"
  ].join("\n");
}

function getSafetyFormProfile(key: DocumentKey): SafetyFormProfile {
  if (key === "riskAssessmentDraft") {
    return {
      code: "SC-RISK-01",
      subtitle: "위험성평가 및 감소대책 확인서",
      layout: "risk",
      primaryColumn: "위험요인",
      actionColumn: "감소대책 / 잔여위험",
      confirmationRows: ["위험요인 확인", "감소대책 담당 지정", "작업 전 공유", "잔여위험 승인"],
      approvalLabels: ["작성", "검토", "승인"]
    };
  }

  if (key === "workPlanDraft") {
    return {
      code: "SC-WP-01",
      subtitle: "작업계획서 및 작업순서 확인서",
      layout: "workPlan",
      primaryColumn: "작업계획 항목",
      actionColumn: "작성 내용 / 기준",
      confirmationRows: ["작업구간 확인", "작업순서 확인", "장비·인원 확인", "작업중지 기준 공유"],
      approvalLabels: ["작성", "검토", "승인"]
    };
  }

  if (key === "workPermitDraft") {
    return {
      code: "SC-PTW-01",
      subtitle: "위험작업 허가 및 종료 확인서",
      layout: "permit",
      primaryColumn: "허가 항목",
      actionColumn: "확인 내용 / 조건",
      confirmationRows: ["허가대상 확인", "격리·차단 확인", "보호구 확인", "종료 확인"],
      approvalLabels: ["신청", "허가", "종료"]
    };
  }

  if (key === "tbmBriefing" || key === "tbmLogDraft") {
    return {
      code: "SC-TBM-01",
      subtitle: "TBM 및 작업 전 안전점검 회의록",
      layout: key === "tbmLogDraft" ? "tbmLog" : "tbmBriefing",
      primaryColumn: "점검/논의 항목",
      actionColumn: "전달 내용 / 조치",
      confirmationRows: ["작업내용 공유", "위험요인 전달", "작업중지 기준 확인", "참석자 확인"],
      approvalLabels: ["진행", "관리감독", "보관"]
    };
  }

  if (key === "safetyEducationRecordDraft" || key === "foreignWorkerBriefing") {
    return {
      code: "SC-EDU-01",
      subtitle: "안전보건교육 실시 및 이해 확인서",
      layout: "education",
      primaryColumn: "교육 항목",
      actionColumn: "교육 내용 / 확인 방법",
      confirmationRows: ["교육대상 확인", "교육자료 사용", "이해도 확인", "추가교육 필요성"],
      approvalLabels: ["교육자", "확인자", "보관"]
    };
  }

  return {
    code: "SC-WP-01",
    subtitle: "SafeClaw 현장 안전문서 확인서",
    layout: key === "photoEvidenceDraft" ? "photo" : "generic",
    primaryColumn: "항목",
    actionColumn: "내용 / 조치",
    confirmationRows: ["현장조건 확인", "담당자 확인", "작업 전 공유", "보관 위치 확인"],
    approvalLabels: ["작성", "확인", "보관"]
  };
}

function formCss(pageMargin = "36px") {
  return `
    body { margin: 0; background: #ece7dc; color: #161b22; font-family: "Malgun Gothic", "Noto Sans KR", sans-serif; }
    .safety-form-page { max-width: 1080px; margin: ${pageMargin} auto; background: #fffdf8; border: 2px solid #161b22; box-shadow: 8px 8px 0 rgba(22, 27, 34, 0.12); }
    .form-head { display: grid; grid-template-columns: 1fr 240px; border-bottom: 2px solid #161b22; }
    .form-title { padding: 20px 24px; }
    .form-title span { display: inline-block; margin-bottom: 8px; color: #21594f; font-size: 12px; font-weight: 900; letter-spacing: 0.12em; }
    .form-title h1 { margin: 0; font-size: 28px; letter-spacing: -0.02em; }
    .form-title p { margin: 8px 0 0; color: #4c5665; font-size: 13px; }
    .approval-grid { display: grid; grid-template-columns: repeat(3, 1fr); border-left: 2px solid #161b22; }
    .approval-cell { display: grid; grid-template-rows: 34px 1fr; min-height: 108px; border-left: 1px solid #161b22; text-align: center; }
    .approval-cell:first-child { border-left: 0; }
    .approval-cell b { display: grid; place-items: center; background: #f2ead9; border-bottom: 1px solid #161b22; font-size: 12px; }
    .approval-cell em { display: grid; place-items: end center; padding-bottom: 12px; color: #707887; font-size: 12px; font-style: normal; }
    .meta-grid { display: grid; grid-template-columns: repeat(4, 1fr); border-bottom: 2px solid #161b22; }
    .meta-item { min-height: 58px; border-right: 1px solid #161b22; }
    .meta-item:last-child { border-right: 0; }
    .meta-item b { display: block; padding: 7px 10px; background: #21594f; color: #ffffff; font-size: 11px; }
    .meta-item span { display: block; padding: 10px; font-size: 13px; line-height: 1.35; }
    .check-grid { display: grid; grid-template-columns: repeat(4, 1fr); border-bottom: 2px solid #161b22; }
    .check-grid div { padding: 10px; border-right: 1px solid #161b22; font-size: 12px; font-weight: 800; }
    .check-grid div:last-child { border-right: 0; }
    .section-block { padding: 18px 22px 4px; }
    .section-label { display: inline-flex; align-items: center; min-height: 30px; margin-bottom: 8px; padding: 5px 12px; background: #161b22; color: #fffdf8; font-size: 13px; font-weight: 900; }
    table { width: 100%; border-collapse: collapse; table-layout: fixed; margin-bottom: 16px; }
    th, td { border: 1px solid #161b22; padding: 9px 10px; vertical-align: top; word-break: keep-all; line-height: 1.48; }
    th { background: #f2ead9; font-size: 12px; text-align: center; }
    td { font-size: 12px; }
    .center { text-align: center; }
    .check-cell { text-align: center; color: #5e6677; font-weight: 800; }
    .signature-grid { display: grid; grid-template-columns: repeat(4, 1fr); margin: 10px 22px 22px; border: 1px solid #161b22; }
    .signature-grid div { min-height: 62px; padding: 9px 10px; border-right: 1px solid #161b22; font-size: 12px; }
    .signature-grid div:last-child { border-right: 0; }
    .signature-grid b { display: block; margin-bottom: 18px; }
    .form-note { margin: 0 22px 22px; color: #596373; font-size: 12px; }
    .section-help { margin: 0 0 10px; color: #596373; font-size: 12px; line-height: 1.5; }
    .mini-table th { background: #21594f; color: #fffdf8; }
    .risk-table th, .risk-table td { font-size: 11px; padding: 7px 6px; }
    .risk-level-high { background: #ffe3df; font-weight: 900; color: #a83224; }
    .permit-check td:nth-child(2), .permit-check td:nth-child(3) { text-align: center; font-weight: 900; }
    .attendee-table td { height: 42px; }
    @media print { body { background: #ffffff; } .safety-form-page { margin: 0; box-shadow: none; max-width: none; } }
  `;
}

function buildGenericSections(rows: SheetRow[], profile: SafetyFormProfile) {
  return groupRowsBySection(rows).map((group) => `
    <section class="section-block">
      <div class="section-label">${escapeHtml(group.section)}</div>
      <table>
        <colgroup><col style="width: 7%;" /><col style="width: 21%;" /><col style="width: 52%;" /><col style="width: 20%;" /></colgroup>
        <thead><tr><th>No.</th><th>${escapeHtml(profile.primaryColumn)}</th><th>${escapeHtml(profile.actionColumn)}</th><th>확인/담당</th></tr></thead>
        <tbody>
          ${group.rows.map((row, index) => `<tr><td class="center">${index + 1}</td><td>${escapeHtml(row.item)}</td><td>${escapeHtml(row.content)}</td><td class="check-cell">□ 확인<br />담당: ______</td></tr>`).join("")}
        </tbody>
      </table>
    </section>
  `).join("");
}

function buildRiskAssessmentSections(rows: SheetRow[], scenario: AskResponse["scenario"]) {
  const hazardRows = findRows(rows, ["위험", "추락", "전도", "충돌", "화재", "중독", "끼임"], 4);
  const controlRows = findRows(rows, ["조치", "대책", "점검", "통제", "작업중지"], 4);
  const controlFor = (index: number) => compactContent(controlRows[index] || controlRows[0], "작업 전 통제대책을 지정하고 이행 여부를 확인");
  return `
    <section class="section-block">
      <div class="section-label">1. 사전준비</div>
      <table class="mini-table">
        <colgroup><col style="width: 16%;" /><col style="width: 34%;" /><col style="width: 16%;" /><col style="width: 34%;" /></colgroup>
        <tbody>
          <tr><th>평가대상 작업</th><td>${escapeHtml(scenario.workSummary)}</td><th>평가방법</th><td>4M + 가능성·중대성 판단</td></tr>
          <tr><th>작업장소</th><td>${escapeHtml(scenario.siteName)}</td><th>참여자</th><td>관리감독자, 작업반장, 근로자 대표</td></tr>
          <tr><th>작업조건</th><td>${escapeHtml(scenario.weatherNote)}</td><th>검토자료</th><td>작업계획서, TBM, KOSHA 자료, 법령 근거</td></tr>
        </tbody>
      </table>
    </section>
    <section class="section-block">
      <div class="section-label">2. 유해·위험요인 파악 및 위험성 결정</div>
      <p class="section-help">제공 서식 기준에 맞춰 단위공종, 작업장소, 사용 장비, 재해형태, 가능성·중대성·등급을 분리합니다.</p>
      <table class="risk-table">
        <colgroup>
          <col style="width: 8%;" /><col style="width: 10%;" /><col style="width: 10%;" /><col style="width: 8%;" />
          <col style="width: 18%;" /><col style="width: 8%;" /><col style="width: 6%;" /><col style="width: 6%;" />
          <col style="width: 6%;" /><col style="width: 20%;" />
        </colgroup>
        <thead><tr><th>단위공종</th><th>작업장소</th><th>장비/도구</th><th>4M</th><th>유해·위험요인</th><th>재해형태</th><th>가능성</th><th>중대성</th><th>등급</th><th>현재 안전조치</th></tr></thead>
        <tbody>
          ${hazardRows.map((row, index) => {
            const text = rowText(row);
            return `<tr>
            <td>${escapeHtml(scenario.workSummary)}</td>
            <td>${escapeHtml(scenario.siteName)}</td>
            <td>${escapeHtml(inferEquipment(text, scenario, index))}</td>
            <td class="center">${escapeHtml(inferRiskFactor4M(text, index))}</td>
            <td>${escapeHtml(compactContent(row, "작업 중 유해·위험요인"))}</td>
            <td>${escapeHtml(inferDisasterType(text, index))}</td>
            <td class="center">중</td>
            <td class="center">상</td>
            <td class="center risk-level-high">상</td>
            <td>${escapeHtml(controlFor(index))}</td>
          </tr>`;
          }).join("")}
        </tbody>
      </table>
    </section>
    <section class="section-block">
      <div class="section-label">3. 감소대책 수립·실행 및 이행확인</div>
      <table>
        <colgroup><col style="width: 32%;" /><col style="width: 28%;" /><col style="width: 14%;" /><col style="width: 12%;" /><col style="width: 14%;" /></colgroup>
        <thead><tr><th>추가 감소대책</th><th>확인 근거/증빙</th><th>조치담당자</th><th>조치기한</th><th>확인자 서명</th></tr></thead>
        <tbody>
          ${controlRows.map((row, index) => `<tr><td>${escapeHtml(compactContent(row, "감소대책"))}</td><td>TBM 공유, 사진/점검 기록, 작업 전 확인</td><td>작업반장</td><td>작업 전</td><td>________</td></tr>`).join("")}
        </tbody>
      </table>
    </section>
    <section class="section-block">
      <div class="section-label">4. 위험성평가 회의록 및 재평가 기준</div>
      <table>
        <colgroup><col style="width: 20%;" /><col style="width: 30%;" /><col style="width: 20%;" /><col style="width: 30%;" /></colgroup>
        <tbody>
          <tr><th>회의일시</th><td>____년 ____월 ____일 ____시</td><th>참석대상</th><td>관리감독자, 작업반장, 작업자 대표</td></tr>
          <tr><th>재평가 사유</th><td>공법·장비·인원·기상 조건 변경</td><th>재평가 기준</th><td>상 등급 잔류위험 또는 작업중지 발생 시</td></tr>
          <tr><th>주요 결정</th><td colspan="3">□ 감소대책 이행 후 작업 □ 보완 후 재평가 □ 작업중지 유지</td></tr>
        </tbody>
      </table>
    </section>
    <section class="section-block">
      <div class="section-label">5. 공유·교육 및 조치 확인</div>
      <table>
        <thead><tr><th>공유 대상</th><th>공유 방법</th><th>이해 확인</th><th>미조치/재평가 필요</th></tr></thead>
        <tbody><tr><td>투입 근로자 전원</td><td>작업 전 TBM 및 안전보건교육</td><td>구두 복창·서명</td><td>□ 없음 □ 있음: ____________________</td></tr></tbody>
      </table>
    </section>
  `;
}

function buildWorkPlanSections(rows: SheetRow[], scenario: AskResponse["scenario"]) {
  const sequenceRows = findRows(rows, ["순서", "작업", "구간", "장비", "인원"], 5);
  const stopRows = findRows(rows, ["중지", "강풍", "우천", "위험", "비상"], 3);
  return `
    <section class="section-block">
      <div class="section-label">1. 작업개요 및 관리자 지정</div>
      <table class="mini-table">
        <tbody>
          <tr><th>공사명/현장</th><td>${escapeHtml(scenario.siteName)}</td><th>해당 작업</th><td>${escapeHtml(scenario.workSummary)}</td></tr>
          <tr><th>작업업체</th><td>${escapeHtml(scenario.companyName)}</td><th>작업인원</th><td>${scenario.workerCount.toLocaleString("ko-KR")}명</td></tr>
          <tr><th>작업일시</th><td>____년 ____월 ____일 ____시</td><th>작업지휘자</th><td>성명/연락처: ____________________</td></tr>
        </tbody>
      </table>
    </section>
    <section class="section-block">
      <div class="section-label">2. 세부 작업순서</div>
      <table>
        <colgroup><col style="width: 8%;" /><col style="width: 24%;" /><col style="width: 38%;" /><col style="width: 16%;" /><col style="width: 14%;" /></colgroup>
        <thead><tr><th>No.</th><th>세부작업</th><th>작업방법/안전관리대책</th><th>담당</th><th>확인</th></tr></thead>
        <tbody>
          ${sequenceRows.map((row, index) => `<tr><td class="center">${index + 1}</td><td>${escapeHtml(row.item)}</td><td>${escapeHtml(row.content)}</td><td>작업반장</td><td>□</td></tr>`).join("")}
        </tbody>
      </table>
    </section>
    <section class="section-block">
      <div class="section-label">3. 장비·인원·첨부서류 확인</div>
      <table class="permit-check">
        <thead><tr><th>확인 항목</th><th>해당</th><th>첨부/확인</th><th>비고</th></tr></thead>
        <tbody>
          <tr><td>장비 제원표, 검사증, 운전원 자격</td><td>□</td><td>□</td><td>해당 장비 사용 시 첨부</td></tr>
          <tr><td>위험성평가표 및 TBM 참석명단</td><td>■</td><td>□</td><td>작업 전 최종본 확인</td></tr>
          <tr><td>작업계획도, 통제구역, 유도자 배치도</td><td>□</td><td>□</td><td>현장 게시 권장</td></tr>
          <tr><td>보험·자격·이수증·사업자등록 등 기본 서류</td><td>□</td><td>□</td><td>발주자/원청 요구 시 첨부</td></tr>
          <tr><td>MSDS, 안전인증서, 안전검사합격증</td><td>□</td><td>□</td><td>화학물질·장비 사용 시 첨부</td></tr>
        </tbody>
      </table>
    </section>
    <section class="section-block">
      <div class="section-label">4. 작업중지 기준 및 비상대응</div>
      <table>
        <thead><tr><th>중지 기준</th><th>판단자</th><th>전파 방법</th><th>재개 조건</th></tr></thead>
        <tbody>
          ${stopRows.map((row) => `<tr><td>${escapeHtml(compactContent(row, scenario.weatherNote))}</td><td>관리감독자</td><td>TBM/문자/무전</td><td>위험요인 제거 후 재확인</td></tr>`).join("")}
        </tbody>
      </table>
    </section>
    <section class="section-block">
      <div class="section-label">5. 작업계획도 및 역할 지정</div>
      <table>
        <colgroup><col style="width: 18%;" /><col style="width: 32%;" /><col style="width: 18%;" /><col style="width: 32%;" /></colgroup>
        <tbody>
          <tr><th>작업계획도</th><td>□ 첨부 □ 현장 게시 □ 보완 필요</td><th>통제구역</th><td>□ 표시 □ 접근금지 □ 유도자 배치</td></tr>
          <tr><th>작업지휘자</th><td>성명/연락처: ____________________</td><th>유도자/신호수</th><td>성명/연락처: ____________________</td></tr>
          <tr><th>운전원/장비담당</th><td>자격·면허 확인: □</td><th>감시자</th><td>위험작업 해당 시 지정: □</td></tr>
        </tbody>
      </table>
    </section>
  `;
}

function buildPermitSections(rows: SheetRow[], scenario: AskResponse["scenario"]) {
  const permitRows = findRows(rows, ["허가", "작업", "핵심", "보호구", "첨부", "종료"], 6);
  return `
    <section class="section-block">
      <div class="section-label">1. 허가 기본정보</div>
      <table class="mini-table">
        <tbody>
          <tr><th>허가번호</th><td>PTW-${new Date().getFullYear()}-____</td><th>작업명</th><td>${escapeHtml(scenario.workSummary)}</td></tr>
          <tr><th>작업장소</th><td>${escapeHtml(scenario.siteName)}</td><th>작업시간</th><td>____:____ ~ ____:____</td></tr>
          <tr><th>신청자</th><td>____________________</td><th>허가자</th><td>____________________</td></tr>
        </tbody>
      </table>
    </section>
    <section class="section-block">
      <div class="section-label">2. 작업 전 허가조건</div>
      <table class="permit-check">
        <thead><tr><th>확인 항목</th><th>적합</th><th>보완</th><th>확인 내용</th></tr></thead>
        <tbody>
          ${permitRows.slice(0, 4).map((row) => `<tr><td>${escapeHtml(row.item)}</td><td>□</td><td>□</td><td>${escapeHtml(row.content)}</td></tr>`).join("")}
        </tbody>
      </table>
    </section>
    <section class="section-block">
      <div class="section-label">3. 첨부서류 체크리스트</div>
      <table class="permit-check">
        <thead><tr><th>첨부서류</th><th>해당</th><th>첨부</th><th>비고</th></tr></thead>
        <tbody>
          <tr><td>작업계획서</td><td>■</td><td>□</td><td>작업순서·장비·인원 포함</td></tr>
          <tr><td>위험성평가표</td><td>■</td><td>□</td><td>감소대책·담당·기한 포함</td></tr>
          <tr><td>TBM 참석명단/교육기록</td><td>■</td><td>□</td><td>성명·소속·직위·서명</td></tr>
          <tr><td>장비 검사증/자격증/MSDS/작업계획도</td><td>□</td><td>□</td><td>해당 작업 시 첨부</td></tr>
          <tr><td>보험가입증명·자격/면허·안전교육 이수증</td><td>□</td><td>□</td><td>원청 제출 요구 시 첨부</td></tr>
          <tr><td>작업반경도·인양능력표·정비/점검 이력</td><td>□</td><td>□</td><td>장비·중량물 작업 시 첨부</td></tr>
        </tbody>
      </table>
    </section>
    <section class="section-block">
      <div class="section-label">4. 종료 확인</div>
      <table><thead><tr><th>종료 상태</th><th>잔류위험</th><th>원상복구</th><th>종료 확인자</th></tr></thead><tbody><tr><td>□ 완료 □ 중단</td><td>□ 없음 □ 있음</td><td>□ 확인</td><td>성명/서명: __________</td></tr></tbody></table>
    </section>
  `;
}

function buildTbmLogSections(rows: SheetRow[], scenario: AskResponse["scenario"]) {
  const agendaRows = findRows(rows, ["위험", "조치", "확인", "보호구", "작업중지", "질문"], 5);
  return `
    <section class="section-block">
      <div class="section-label">1. TBM 회의 정보</div>
      <table class="mini-table">
        <tbody>
          <tr><th>일시</th><td>____년 ____월 ____일 ____시</td><th>장소</th><td>${escapeHtml(scenario.siteName)}</td></tr>
          <tr><th>작업내용</th><td>${escapeHtml(scenario.workSummary)}</td><th>진행자</th><td>작업반장 / 관리감독자</td></tr>
        </tbody>
      </table>
    </section>
    <section class="section-block">
      <div class="section-label">2. 공유 내용 및 이해 확인</div>
      <table>
        <colgroup><col style="width: 8%;" /><col style="width: 26%;" /><col style="width: 42%;" /><col style="width: 12%;" /><col style="width: 12%;" /></colgroup>
        <thead><tr><th>No.</th><th>공유 항목</th><th>전달 내용</th><th>복창/질문</th><th>확인</th></tr></thead>
        <tbody>
          ${agendaRows.map((row, index) => `<tr><td class="center">${index + 1}</td><td>${escapeHtml(row.item)}</td><td>${escapeHtml(row.content)}</td><td>□</td><td>□</td></tr>`).join("")}
        </tbody>
      </table>
    </section>
    <section class="section-block">
      <div class="section-label">3. 참석자 명단</div>
      <table class="attendee-table">
        <thead><tr><th>연번</th><th>성명</th><th>소속</th><th>직위/역할</th><th>서명</th></tr></thead>
        <tbody>
          ${Array.from({ length: Math.max(4, Math.min(8, scenario.workerCount)) }, (_, index) => `<tr><td class="center">${index + 1}</td><td></td><td></td><td></td><td></td></tr>`).join("")}
        </tbody>
      </table>
    </section>
    <section class="section-block">
      <div class="section-label">4. 미조치 및 사진·영상 증빙</div>
      <table><thead><tr><th>미조치 위험요인</th><th>후속조치</th><th>사진/영상 파일명</th><th>확인자</th></tr></thead><tbody><tr><td></td><td></td><td></td><td></td></tr></tbody></table>
    </section>
  `;
}

function buildTbmBriefingSections(rows: SheetRow[], scenario: AskResponse["scenario"], data: AskResponse, riskRows: SheetRow[]) {
  const bridgeRows = buildTbmBridgeRows(data, riskRows.length ? riskRows : rows);
  const questionRows = findRows(rows, ["질문", "확인", "누가", "알고", "복창"], 3);
  const weatherText = data.externalData.weather.summary || data.scenario.weatherNote;
  return `
    <section class="section-block">
      <div class="section-label">1. 작업 전 브리핑 개요</div>
      <table class="mini-table">
        <tbody>
          <tr><th>현장</th><td>${escapeHtml(scenario.siteName)}</td><th>작업</th><td>${escapeHtml(scenario.workSummary)}</td></tr>
          <tr><th>위험수준</th><td>${escapeHtml(data.riskSummary.riskLevel)}</td><th>기상 신호</th><td>${escapeHtml(weatherText)}</td></tr>
          <tr><th>진행자</th><td>작업반장 / 관리감독자</td><th>참석 대상</th><td>투입 근로자 전원</td></tr>
        </tbody>
      </table>
    </section>
    <section class="section-block">
      <div class="section-label">2. 위험성평가 기반 TBM 전달</div>
      <table>
        <colgroup><col style="width: 8%;" /><col style="width: 32%;" /><col style="width: 28%;" /><col style="width: 20%;" /><col style="width: 12%;" /></colgroup>
        <thead><tr><th>No.</th><th>주요 유해·위험요인</th><th>기상/환경 반영</th><th>작업중지 기준</th><th>복창</th></tr></thead>
        <tbody>
          ${bridgeRows.map((row, index) => `<tr>
            <td class="center">${index + 1}</td>
            <td>${escapeHtml(row.risk)}</td>
            <td>${escapeHtml(row.weather)}</td>
            <td>${escapeHtml(row.message)}</td>
            <td class="center">□</td>
          </tr>`).join("")}
        </tbody>
      </table>
    </section>
    <section class="section-block">
      <div class="section-label">3. 확인 질문</div>
      <table>
        <thead><tr><th>질문</th><th>기대 답변</th><th>미이해자 조치</th></tr></thead>
        <tbody>
          ${questionRows.map((row) => `<tr><td>${escapeHtml(compactContent(row, "오늘 작업중지 기준을 누가 판단합니까?"))}</td><td>작업중지 기준과 보고자를 구두로 답변</td><td>작업 전 재설명 후 서명</td></tr>`).join("")}
        </tbody>
      </table>
    </section>
    <section class="section-block">
      <div class="section-label">4. 보호구·통제·증빙</div>
      <table>
        <thead><tr><th>보호구</th><th>통제구역</th><th>사진/영상 증빙</th><th>관리자 확인</th></tr></thead>
        <tbody><tr><td>□ 착용 확인</td><td>□ 접근금지 표시 □ 유도자 배치</td><td>□ TBM 사진 □ 작업 전 점검 사진</td><td>서명: __________</td></tr></tbody>
      </table>
    </section>
  `;
}

function buildTbmWeatherRiskBridge(data: AskResponse, riskRows: SheetRow[]) {
  const bridgeRows = buildTbmBridgeRows(data, riskRows);
  return `
    <section class="section-block">
      <div class="section-label">위험성평가·기상 API 반영</div>
      <table>
        <colgroup><col style="width: 8%;" /><col style="width: 34%;" /><col style="width: 34%;" /><col style="width: 24%;" /></colgroup>
        <thead><tr><th>No.</th><th>주요 유해·위험요인</th><th>오늘 기상/환경 신호</th><th>TBM 전달 문구</th></tr></thead>
        <tbody>
          ${bridgeRows.map((row, index) => `<tr>
            <td class="center">${index + 1}</td>
            <td>${escapeHtml(row.risk)}</td>
            <td>${escapeHtml(row.weather)}</td>
            <td>${escapeHtml(row.message)}</td>
          </tr>`).join("")}
        </tbody>
      </table>
    </section>
  `;
}

function buildSafetyFormMarkup(
  title: string,
  rows: SheetRow[],
  scenario: AskResponse["scenario"],
  profile: SafetyFormProfile,
  data?: AskResponse,
  riskRows: SheetRow[] = []
) {
  const bridgeSections = data && (profile.layout === "tbmBriefing" || profile.layout === "tbmLog")
    ? buildTbmWeatherRiskBridge(data, riskRows.length ? riskRows : rows)
    : "";
  const sections = profile.layout === "risk"
    ? buildRiskAssessmentSections(rows, scenario)
    : profile.layout === "workPlan"
      ? buildWorkPlanSections(rows, scenario)
      : profile.layout === "permit"
        ? buildPermitSections(rows, scenario)
        : profile.layout === "tbmLog"
          ? `${bridgeSections}${buildTbmLogSections(rows, scenario)}`
          : profile.layout === "tbmBriefing"
            ? (data ? buildTbmBriefingSections(rows, scenario, data, riskRows) : buildGenericSections(rows, profile))
            : buildGenericSections(rows, profile);
  const approvalCells = profile.approvalLabels.map((label) => `
    <div class="approval-cell"><b>${escapeHtml(label)}</b><em>서명</em></div>
  `).join("");
  const confirmationCells = profile.confirmationRows.map((label) => `
    <div>□ ${escapeHtml(label)}</div>
  `).join("");

  return `
  <article class="safety-form-page">
    <header class="form-head">
      <div class="form-title">
        <span>${escapeHtml(profile.code)}</span>
        <h1>${escapeHtml(title)}</h1>
        <p>${escapeHtml(profile.subtitle)} · SafeClaw 공식자료 기반 초안</p>
      </div>
      <div class="approval-grid">${approvalCells}</div>
    </header>
    <div class="meta-grid">
      <div class="meta-item"><b>사업장</b><span>${escapeHtml(scenario.companyName)}</span></div>
      <div class="meta-item"><b>현장/공정</b><span>${escapeHtml(scenario.siteName)}</span></div>
      <div class="meta-item"><b>작업내용</b><span>${escapeHtml(scenario.workSummary)}</span></div>
      <div class="meta-item"><b>인원/조건</b><span>${scenario.workerCount.toLocaleString("ko-KR")}명 · ${escapeHtml(scenario.weatherNote)}</span></div>
    </div>
    <div class="check-grid">${confirmationCells}</div>
    ${sections}
    <div class="signature-grid">
      <div><b>작성자</b>성명/서명:</div>
      <div><b>관리감독자</b>성명/서명:</div>
      <div><b>교육/TBM 확인자</b>성명/서명:</div>
      <div><b>보관 위치</b>문서번호/철:</div>
    </div>
    <p class="form-note">본 문서는 현장 확인 전 초안입니다. 작업 전 위험요인, 참석자, 작업중지 기준, 서명란을 최종 확인한 뒤 사용하세요.</p>
  </article>`;
}

function buildHtml(
  title: string,
  rows: SheetRow[],
  scenario: AskResponse["scenario"],
  profile: SafetyFormProfile,
  data?: AskResponse,
  riskRows: SheetRow[] = []
) {
  return `<!doctype html>
<html lang="ko">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(title)}</title>
  <style>
    ${formCss()}
  </style>
</head>
<body>
  ${buildSafetyFormMarkup(title, rows, scenario, profile, data, riskRows)}
</body>
</html>`;
}

function parseSheetRows(title: string, body: string): SheetRow[] {
  const rows: SheetRow[] = [];
  let section = "기본정보";
  let itemNumber = 1;

  body.split(/\r?\n/).forEach((rawLine) => {
    const line = rawLine.trim();
    if (!line) return;

    const sectionMatch = line.match(/^\[(.+)\]$/);
    if (sectionMatch) {
      section = sectionMatch[1];
      itemNumber = 1;
      return;
    }

    const keyed = line.match(/^([^:：]+)[:：]\s*(.+)$/);
    const numbered = line.match(/^(\d+)\.\s*(.+)$/);
    const bullet = line.match(/^[-ㆍ]\s*(.+)$/);

    if (keyed) {
      rows.push({ document: title, section, item: keyed[1].trim(), content: keyed[2].trim() });
      return;
    }
    if (numbered) {
      rows.push({ document: title, section, item: numbered[1].trim(), content: numbered[2].trim() });
      return;
    }
    if (bullet) {
      rows.push({ document: title, section, item: String(itemNumber), content: bullet[1].trim() });
      itemNumber += 1;
      return;
    }

    rows.push({ document: title, section, item: String(itemNumber), content: line });
    itemNumber += 1;
  });

  return rows;
}

function buildRowsForDocument(meta: EditableDocument, values: Record<DocumentKey, string>) {
  return parseSheetRows(meta.title, values[meta.key]);
}

function buildRowsForAll(values: Record<DocumentKey, string>) {
  return documentMeta.flatMap((meta) => buildRowsForDocument(meta, values));
}

function buildLaunchSheetRows(values: Record<DocumentKey, string>) {
  const sheetMap: Array<{ sheet: string; keys: DocumentKey[] }> = [
    { sheet: "0. 문서팩 요약", keys: ["workpackSummaryDraft"] },
    { sheet: "1. 위험성평가", keys: ["riskAssessmentDraft"] },
    { sheet: "2. 작업계획·허가", keys: ["workPlanDraft", "workPermitDraft"] },
    { sheet: "3. TBM 및 일일점검", keys: ["tbmBriefing", "tbmLogDraft"] },
    { sheet: "4. 안전보건교육", keys: ["safetyEducationRecordDraft", "foreignWorkerBriefing", "foreignWorkerTransmission"] },
    { sheet: "5. 비상대응", keys: ["emergencyResponseDraft"] },
    { sheet: "6. 사진/증빙", keys: ["photoEvidenceDraft"] }
  ];

  const documentRows = sheetMap.flatMap(({ sheet, keys }) => (
    keys.flatMap((key) => {
      const meta = documentMeta.find((item) => item.key === key);
      if (!meta) return [];
      return buildRowsForDocument(meta, values).map((row) => ({ ...row, section: `${sheet} / ${row.section}` }));
    })
  ));
  const rubricRows = evaluatePublicSafetyRubric(values).items.map((item) => ({
    document: "제출 전 점검",
    section: `7. 제출 전 점검 / ${rubricCategoryLabel(item.category)}`,
    item: item.title,
    content: `${rubricStatusLabel(item.status)} · ${item.description} · 보완: ${item.improvementAction} · 리서치: ${item.researchAction}`
  }));

  return [...documentRows, ...rubricRows];
}

function escapeCell(value: string) {
  return `"${value.replace(/"/g, "\"\"")}"`;
}

function buildDelimited(rows: SheetRow[], delimiter: "," | "\t") {
  const header = ["문서", "섹션", "항목", "내용"];
  const body = rows.map((row) => [row.document, row.section, row.item, row.content]
    .map((value) => delimiter === "," ? escapeCell(value) : value.replace(/\t/g, " ").replace(/\r?\n/g, " "))
    .join(delimiter));
  return [header.join(delimiter), ...body].join("\n");
}

function buildExcelHtml(
  title: string,
  rows: SheetRow[],
  scenario: AskResponse["scenario"],
  profile: SafetyFormProfile,
  data?: AskResponse,
  riskRows: SheetRow[] = []
) {
  if (profile.layout === "risk" || profile.layout === "workPlan" || profile.layout === "permit" || profile.layout === "tbmLog" || profile.layout === "tbmBriefing") {
    return `<!doctype html>
<html lang="ko">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(title)}</title>
  <style>
    ${formCss("18px")}
    body { background: #ffffff; }
    .safety-form-page { box-shadow: none; }
  </style>
</head>
<body>
  ${buildSafetyFormMarkup(title, rows, scenario, profile, data, riskRows)}
</body>
</html>`;
  }
  const grouped = rows.reduce<Record<string, SheetRow[]>>((acc, row) => {
    acc[row.section] = [...(acc[row.section] || []), row];
    return acc;
  }, {});
  const summaryRows = Object.entries(grouped).map(([section, sectionRows]) => `
    <tr>
      <td>${escapeHtml(section)}</td>
      <td>${sectionRows.length}</td>
      <td>${escapeHtml(sectionRows.slice(0, 2).map((row) => row.item).join(", "))}</td>
    </tr>
  `).join("");
  const tableRows = Object.entries(grouped).map(([section, sectionRows]) => `
    <tr class="section-row"><td colspan="5">${escapeHtml(section)}</td></tr>
    ${sectionRows.map((row, index) => `<tr><td class="center">${index + 1}</td><td>${escapeHtml(row.item)}</td><td>${escapeHtml(row.content)}</td><td class="check-cell">□ 확인</td><td>담당: ______</td></tr>`).join("")}
  `).join("");
  const confirmationRows = profile.confirmationRows.map((row) => `<td>□ ${escapeHtml(row)}</td>`).join("");
  const approvalRows = profile.approvalLabels.map((label) => `<td>${escapeHtml(label)}<br /><br />서명: ______</td>`).join("");
  return `<!doctype html>
<html lang="ko">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(title)}</title>
  <!--[if gte mso 9]>
  <xml>
    <x:ExcelWorkbook>
      <x:ExcelWorksheets>
        <x:ExcelWorksheet>
          <x:Name>${escapeHtml(title).slice(0, 28)}</x:Name>
          <x:WorksheetOptions><x:FitToPage/><x:Print><x:FitWidth>1</x:FitWidth><x:FitHeight>0</x:FitHeight></x:Print></x:WorksheetOptions>
        </x:ExcelWorksheet>
      </x:ExcelWorksheets>
    </x:ExcelWorkbook>
  </xml>
  <![endif]-->
  <style>
    body { font-family: "Malgun Gothic", "Noto Sans KR", sans-serif; color: #17201d; }
    .cover { border: 2px solid #1f4d43; background: #e8f1ed; padding: 18px; margin-bottom: 14px; }
    .cover h1 { margin: 0 0 8px; font-size: 22px; }
    .cover p { margin: 0; color: #5e6677; }
    .meta-grid td { background: #fffdf8; }
    .meta-grid .label { background: #21594f; color: #ffffff; font-weight: 700; text-align: center; width: 16%; }
    table { border-collapse: collapse; width: 100%; table-layout: fixed; font-family: "Malgun Gothic", sans-serif; margin-bottom: 14px; }
    th, td { border: 1px solid #9aa4b2; padding: 8px; vertical-align: top; mso-number-format:"\\@"; word-break: keep-all; }
    th { background: #1f4d43; color: #ffffff; font-weight: 700; text-align: center; }
    .summary th { background: #6f4b26; }
    .section-row td { background: #e8f1ed; color: #1f4d43; font-weight: 700; font-size: 14px; border-top: 2px solid #1f4d43; }
    .center { text-align: center; width: 42px; }
    .check-cell { text-align: center; color: #6f4b26; width: 90px; }
    .confirm td, .approval td { text-align: center; font-weight: 700; }
    .note { color: #5e6677; font-size: 12px; margin-top: 10px; }
  </style>
</head>
<body>
  <div class="cover">
    <h1>${escapeHtml(title)}</h1>
    <p>${escapeHtml(profile.subtitle)} · SafeClaw 현장 문서팩 · 검토/확인/서명용 Excel 서식</p>
  </div>
  <table class="meta-grid">
    <tbody>
      <tr><td class="label">사업장</td><td>${escapeHtml(scenario.companyName)}</td><td class="label">현장/공정</td><td>${escapeHtml(scenario.siteName)}</td></tr>
      <tr><td class="label">작업내용</td><td>${escapeHtml(scenario.workSummary)}</td><td class="label">인원/조건</td><td>${scenario.workerCount.toLocaleString("ko-KR")}명 · ${escapeHtml(scenario.weatherNote)}</td></tr>
    </tbody>
  </table>
  <table class="confirm"><tbody><tr>${confirmationRows}</tr></tbody></table>
  <table class="summary">
    <colgroup><col style="width: 34%;" /><col style="width: 12%;" /><col style="width: 54%;" /></colgroup>
    <thead><tr><th>섹션</th><th>항목 수</th><th>주요 항목</th></tr></thead>
    <tbody>${summaryRows}</tbody>
  </table>
  <table>
    <colgroup><col style="width: 6%;" /><col style="width: 22%;" /><col style="width: 52%;" /><col style="width: 10%;" /><col style="width: 10%;" /></colgroup>
    <thead><tr><th>No.</th><th>${escapeHtml(profile.primaryColumn)}</th><th>${escapeHtml(profile.actionColumn)}</th><th>확인</th><th>담당</th></tr></thead>
    <tbody>${tableRows}</tbody>
  </table>
  <table class="approval"><tbody><tr>${approvalRows}<td>보관 위치<br /><br />______</td></tr></tbody></table>
  <p class="note">본 파일은 공식자료 기반 초안입니다. 현장관리자가 작업 전 최종 확인 후 사용하세요.</p>
</body>
</html>`;
}

function buildLaunchWorkbookHtml(title: string, rows: SheetRow[]) {
  const groups = rows.reduce<Record<string, SheetRow[]>>((acc, row) => {
    const [sheet] = row.section.split(" / ");
    acc[sheet] = [...(acc[sheet] || []), row];
    return acc;
  }, {});
  const sections = Object.entries(groups).map(([sheet, sheetRows]) => `
    <h2>${escapeHtml(sheet)}</h2>
    <table>
      <thead><tr><th>문서</th><th>섹션</th><th>항목</th><th>내용</th></tr></thead>
      <tbody>${sheetRows.map((row) => `<tr><td>${escapeHtml(row.document)}</td><td>${escapeHtml(row.section.replace(`${sheet} / `, ""))}</td><td>${escapeHtml(row.item)}</td><td>${escapeHtml(row.content)}</td></tr>`).join("")}</tbody>
    </table>
  `).join("");

  return `<!doctype html>
<html lang="ko">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(title)}</title>
  <style>
    body { font-family: "Malgun Gothic", "Noto Sans KR", sans-serif; color: #17201d; }
    .cover { border: 2px solid #1f4d43; background: #e8f1ed; padding: 18px; margin-bottom: 16px; }
    .cover h1 { margin: 0 0 8px; font-size: 24px; }
    .cover p { margin: 0; color: #5e6677; }
    h2 { margin: 24px 0 8px; color: #21594f; border-left: 5px solid #21594f; padding-left: 9px; }
    table { border-collapse: collapse; width: 100%; table-layout: fixed; margin-bottom: 18px; }
    th, td { border: 1px solid #9aa4b2; padding: 8px; vertical-align: top; mso-number-format:"\\@"; word-break: keep-all; }
    th { background: #1f4d43; color: #ffffff; font-weight: 700; text-align: center; }
    td:nth-child(1) { width: 18%; }
    td:nth-child(2) { width: 20%; }
    td:nth-child(3) { width: 12%; text-align: center; }
  </style>
</head>
<body>
  <div class="cover">
    <h1>${escapeHtml(title)}</h1>
    <p>위험성평가·작업계획·TBM·안전보건교육·비상대응·증빙을 한 파일에 묶은 현장 검토용 Excel 문서팩입니다.</p>
  </div>
  ${sections}
</body>
</html>`;
}

function buildWordHtml(
  title: string,
  rows: SheetRow[],
  scenario: AskResponse["scenario"],
  profile: SafetyFormProfile,
  data?: AskResponse,
  riskRows: SheetRow[] = []
) {
  return `<!doctype html>
<html lang="ko">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(title)}</title>
  <style>
    ${formCss("20px")}
    body { background: #ffffff; }
    .safety-form-page { box-shadow: none; }
  </style>
</head>
<body>
  ${buildSafetyFormMarkup(title, rows, scenario, profile, data, riskRows)}
</body>
</html>`;
}

function buildHwpTemplateText(
  title: string,
  rows: SheetRow[],
  profile: SafetyFormProfile,
  scenario: AskResponse["scenario"],
  data?: AskResponse,
  riskRows: SheetRow[] = []
) {
  const grouped = rows.reduce<Record<string, SheetRow[]>>((acc, row) => {
    acc[row.section] = [...(acc[row.section] || []), row];
    return acc;
  }, {});
  const tbmBridgeLines = data && (profile.layout === "tbmBriefing" || profile.layout === "tbmLog")
    ? [
        "[위험성평가·기상 API 반영]",
        ...buildTbmBridgeRows(data, riskRows).flatMap((row, index) => [
          `${index + 1}. 주요 유해·위험요인: ${row.risk}`,
          `   오늘 기상/환경 신호: ${row.weather}`,
          `   TBM 전달 문구: ${row.message}`
        ]),
        ""
      ]
    : [];
  const layoutNotice = profile.layout === "risk"
    ? [
        "[서식 구조]",
        "단위공종 / 작업장소 / 사용 기계기구·장비 / 유해·위험요인 / 재해형태 / 가능성 / 중대성 / 등급 / 감소대책 / 조치담당자 / 조치기한 / 확인자 서명",
        ""
      ]
    : profile.layout === "workPlan"
      ? [
          "[서식 구조]",
          "작업개요 / 세부 작업순서 / 장비·인원·첨부서류 / 작업중지 기준 / 비상대응 / 확인자 서명",
          ""
        ]
      : profile.layout === "permit"
        ? [
            "[서식 구조]",
            "허가번호 / 작업시간 / 신청자·허가자 / 작업 전 허가조건 / 첨부서류 체크리스트 / 종료 확인",
            ""
          ]
        : profile.layout === "tbmLog"
          ? [
              "[서식 구조]",
              "회의 정보 / 공유 내용 / 참석자 명단(성명·소속·직위·서명) / 미조치 및 사진·영상 증빙",
              ""
            ]
          : [];

  return [
    `${title}(초안)`,
    "SafeClaw 공식자료 기반 서식 · 현장 검토 후 사용",
    `현장: ${scenario.siteName}`,
    `작업: ${scenario.workSummary}`,
    "",
    ...layoutNotice,
    ...tbmBridgeLines,
    ...Object.entries(grouped).flatMap(([section, sectionRows]) => [
      `[${section}]`,
      ...sectionRows.map((row) => `${row.item}. ${row.content}`),
      ""
    ]),
    "[확인/서명]",
    "작성자: ____________________",
    "관리감독자: ____________________",
    "교육/TBM 확인자: ____________________",
    "보관 위치: ____________________",
    "확인일시: ______년 ____월 ____일 ____시 ____분"
  ].join("\n");
}

async function loadRhwp() {
  if (!rhwpModulePromise) {
    rhwpModulePromise = (async () => {
      let canvasContext: CanvasRenderingContext2D | null = null;
      let lastFont = "";
      globalThis.measureTextWidth = (font: string, text: string) => {
        if (!canvasContext) {
          canvasContext = document.createElement("canvas").getContext("2d");
        }
        if (!canvasContext) return text.length * 12;
        if (font !== lastFont) {
          canvasContext.font = font;
          lastFont = font;
        }
        return canvasContext.measureText(text).width;
      };

      const rhwp = await import("@rhwp/core");
      await rhwp.default({ module_or_path: "/rhwp_bg.wasm" });
      return rhwp;
    })();
  }

  return rhwpModulePromise;
}

async function buildHwpxWithRhwp(body: string) {
  const { HwpDocument } = await loadRhwp();
  const document = HwpDocument.createEmpty();
  try {
    document.createBlankDocument();
    document.insertText(0, 0, 0, body);
    const exported = document.exportHwpx();
    const buffer = new ArrayBuffer(exported.byteLength);
    new Uint8Array(buffer).set(exported);
    return new Blob([buffer], { type: "application/hwp+zip" });
  } finally {
    document.free();
  }
}

function buildCombinedText(values: Record<DocumentKey, string>) {
  const rubricText = evaluatePublicSafetyRubric(values).items.map((item) => (
    `- [${rubricCategoryLabel(item.category)}] ${item.title}: ${rubricStatusLabel(item.status)}\n  보완: ${item.improvementAction}\n  리서치: ${item.researchAction}`
  )).join("\n");

  return [
    documentMeta.map((item) => `# ${item.title}\n\n${values[item.key]}`).join("\n\n---\n\n"),
    `# 제출 전 점검\n\n${rubricText}`
  ].join("\n\n---\n\n");
}

function parseStoredValues(raw: string | null, fallback: Record<DocumentKey, string>) {
  if (!raw) return fallback;

  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return fallback;

    const record = parsed as Partial<Record<DocumentKey, unknown>>;
    return documentMeta.reduce<Record<DocumentKey, string>>((acc, item) => {
      const value = record[item.key];
      acc[item.key] = typeof value === "string" ? value : fallback[item.key];
      return acc;
    }, { ...fallback });
  } catch (error) {
    console.warn("workpack local draft parse failed", error);
    return fallback;
  }
}

function readObject(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function readText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function readRemediationDraft(itemId: string, value: unknown): RemediationDraft {
  const record = readObject(value);
  if (!record) {
    return {
      itemId,
      text: "",
      status: "error",
      message: "보완 제안 응답을 읽지 못했습니다.",
      providerLabel: null,
      policyNote: "",
      catalogStatus: null,
      sources: []
    };
  }

  const sourcesValue = record.sources;
  const sources = Array.isArray(sourcesValue)
    ? sourcesValue.map((source) => {
        const sourceRecord = readObject(source);
        return sourceRecord
          ? {
              title: readText(sourceRecord.title),
              agency: readText(sourceRecord.agency),
              url: readText(sourceRecord.url) || "/knowledge",
              sourceType: readText(sourceRecord.sourceType) || "source"
            }
          : null;
      }).filter((source): source is RemediationDraft["sources"][number] => Boolean(source && source.title))
    : [];
  const catalogStatusRecord = readObject(record.catalogStatus);

  return {
    itemId,
    text: readText(record.text),
    status: record.ok === true ? "ready" : "error",
    message: readText(record.message) || (record.ok === true ? "보완 제안을 생성했습니다." : "보완 제안을 생성하지 못했습니다."),
    providerLabel: readText(record.providerLabel) || null,
    policyNote: readText(record.policyNote),
    catalogStatus: catalogStatusRecord
      ? {
          configured: catalogStatusRecord.configured === true,
          ok: catalogStatusRecord.ok === true,
          count: typeof catalogStatusRecord.count === "number" ? catalogStatusRecord.count : 0,
          message: readText(catalogStatusRecord.message)
        }
      : null,
    sources
  };
}

function SafetyDocumentPreview({
  title,
  rows,
  scenario,
  profile,
  data,
  riskRows
}: {
  title: string;
  rows: SheetRow[];
  scenario: AskResponse["scenario"];
  profile: SafetyFormProfile;
  data: AskResponse;
  riskRows: SheetRow[];
}) {
  const groups = groupRowsBySection(rows);
  const previewGroups = groups.slice(0, 3);
  const tbmBridgeRows = profile.layout === "tbmBriefing" || profile.layout === "tbmLog"
    ? buildTbmBridgeRows(data, riskRows)
    : [];
  const tableLabels = profile.layout === "risk"
    ? { primary: "유해·위험요인", action: "재해형태 / 감소대책", confirm: "등급 / 담당" }
    : profile.layout === "workPlan"
      ? { primary: "작업순서/대상", action: "작업방법 / 안전관리대책", confirm: "확인자" }
      : profile.layout === "permit"
        ? { primary: "허가 항목", action: "허가조건 / 첨부서류", confirm: "적합/보완" }
        : profile.layout === "tbmBriefing" || profile.layout === "tbmLog"
          ? { primary: "공유 항목", action: "전달 내용 / 작업중지 기준", confirm: "복창/서명" }
          : { primary: profile.primaryColumn, action: profile.actionColumn, confirm: "확인/담당" };

  return (
    <div className="safety-form-preview" aria-label={`${title} 서식 미리보기`}>
      <div className="safety-form-preview-head">
        <div>
          <span>{profile.code}</span>
          <strong>{title}</strong>
          <small>{profile.subtitle}</small>
        </div>
        <div className="approval-preview" aria-label="결재란">
          {profile.approvalLabels.map((label) => (
            <div key={label}>
              <b>{label}</b>
              <em>서명</em>
            </div>
          ))}
        </div>
      </div>
      <div className="safety-form-meta-grid">
        <div><b>사업장</b><span>{scenario.companyName}</span></div>
        <div><b>현장/공정</b><span>{scenario.siteName}</span></div>
        <div><b>작업내용</b><span>{scenario.workSummary}</span></div>
        <div><b>인원/조건</b><span>{scenario.workerCount.toLocaleString("ko-KR")}명 · {scenario.weatherNote}</span></div>
      </div>
      <div className="safety-form-check-row">
        {profile.confirmationRows.map((row) => (
          <span key={row}>□ {row}</span>
        ))}
      </div>
      {tbmBridgeRows.length ? (
        <section className="safety-form-bridge" aria-label="위험성평가와 기상 API 반영">
          <h3>위험성평가·기상 API 반영</h3>
          <div className="safety-form-table-wrap">
            <table>
              <thead>
                <tr>
                  <th>No.</th>
                  <th>주요 유해·위험요인</th>
                  <th>오늘 기상/환경 신호</th>
                  <th>TBM 전달 문구</th>
                </tr>
              </thead>
              <tbody>
                {tbmBridgeRows.map((row, index) => (
                  <tr key={`${row.risk}-${index}`}>
                    <td>{index + 1}</td>
                    <td>{row.risk}</td>
                    <td>{row.weather}</td>
                    <td>{row.message}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}
      <div className="safety-form-section-stack">
        {previewGroups.map((group) => (
          <section key={group.section}>
            <h3>{group.section}</h3>
            <div className="safety-form-table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>No.</th>
                    <th>{tableLabels.primary}</th>
                    <th>{tableLabels.action}</th>
                    <th>{tableLabels.confirm}</th>
                  </tr>
                </thead>
                <tbody>
                  {group.rows.slice(0, 4).map((row, index) => (
                    <tr key={`${group.section}-${row.item}-${index}`}>
                      <td>{index + 1}</td>
                      <td>{row.item}</td>
                      <td>{row.content}</td>
                      <td>□ 확인<br />담당: ___</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        ))}
      </div>
      <div className="safety-form-signatures">
        <span>작성자 서명</span>
        <span>관리감독자 서명</span>
        <span>교육/TBM 확인</span>
        <span>보관 위치</span>
      </div>
    </div>
  );
}

export function WorkpackEditor({
  data,
  focusToken = 0,
  requestedDocumentKey,
  onDeliverablesChange
}: {
  data: AskResponse;
  focusToken?: number;
  requestedDocumentKey?: DocumentKey;
  onDeliverablesChange?: (values: WorkpackDocumentValues) => void;
}) {
  const initialValues = useMemo<WorkpackDocumentValues>(
    () => ({
      workpackSummaryDraft: data.deliverables.workpackSummaryDraft,
      riskAssessmentDraft: data.deliverables.riskAssessmentDraft,
      workPlanDraft: data.deliverables.workPlanDraft,
      workPermitDraft: buildPermitDraft(data),
      tbmBriefing: data.deliverables.tbmBriefing,
      tbmLogDraft: data.deliverables.tbmLogDraft,
      safetyEducationRecordDraft: data.deliverables.safetyEducationRecordDraft,
      emergencyResponseDraft: data.deliverables.emergencyResponseDraft,
      photoEvidenceDraft: data.deliverables.photoEvidenceDraft,
      foreignWorkerBriefing: data.deliverables.foreignWorkerBriefing,
      foreignWorkerTransmission: data.deliverables.foreignWorkerTransmission,
      kakaoMessage: data.deliverables.kakaoMessage
    }),
    [data]
  );
  const storageKey = useMemo(
    () => `safeclaw-workpack:${data.scenario.companyName}:${data.scenario.siteName}:${data.question}`,
    [data.question, data.scenario.companyName, data.scenario.siteName]
  );
  const [selectedKey, setSelectedKey] = useState<DocumentKey>("workpackSummaryDraft");
  const [values, setValues] = useState<WorkpackDocumentValues>(initialValues);
  const [hwpxStatus, setHwpxStatus] = useState<"idle" | "building" | "error">("idle");
  const [imageStatus, setImageStatus] = useState<"idle" | "error">("idle");
  const [sheetStatus, setSheetStatus] = useState<"idle" | "copied" | "error">("idle");
  const [templateKind, setTemplateKind] = useState<TemplateKind>("sheet");
  const [lastEditedAt, setLastEditedAt] = useState<Date | null>(null);
  const [showFocusCue, setShowFocusCue] = useState(false);
  const [remediationDrafts, setRemediationDrafts] = useState<Record<string, RemediationDraft>>({});
  const [remediationLoadingId, setRemediationLoadingId] = useState<string | null>(null);
  const editorRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const selected = documentMeta.find((item) => item.key === selectedKey) || documentMeta[0];
  const selectedTemplate = templatePresets.find((preset) => preset.kind === templateKind) || templatePresets[0];
  const selectedText = values[selected.key];
  const baseName = sanitizeFileName(`${data.scenario.companyName}-${selected.fileBase}`);
  const selectedRows = buildRowsForDocument(selected, values);
  const riskAssessmentMeta = documentMeta.find((item) => item.key === "riskAssessmentDraft") || documentMeta[1];
  const riskAssessmentRows = buildRowsForDocument(riskAssessmentMeta, values);
  const selectedFormProfile = getSafetyFormProfile(selected.key);
  const rubricEvaluation = useMemo(() => evaluatePublicSafetyRubric(values), [values]);
  const selectedRubricItems = useMemo(() => {
    const key = selected.key;
    if (!isRubricDocumentKey(key)) return [];
    return rubricEvaluation.items.filter((item) => item.documents.includes(key));
  }, [rubricEvaluation.items, selected.key]);

  useEffect(() => {
    if (typeof window === "undefined") {
      setValues(initialValues);
      onDeliverablesChange?.(initialValues);
      return;
    }

    const stored = parseStoredValues(window.localStorage.getItem(storageKey), initialValues);
    setValues(stored);
    onDeliverablesChange?.(stored);
    setLastEditedAt(null);
  }, [initialValues, onDeliverablesChange, storageKey]);

  useEffect(() => {
    if (!focusToken) return;

    if (requestedDocumentKey) {
      setSelectedKey(requestedDocumentKey);
    }
    setShowFocusCue(true);
    editorRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    window.setTimeout(() => textareaRef.current?.focus({ preventScroll: true }), 360);
    const timer = window.setTimeout(() => setShowFocusCue(false), 2200);
    return () => window.clearTimeout(timer);
  }, [focusToken, requestedDocumentKey]);

  function saveLocalDraft(nextValues: WorkpackDocumentValues) {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(nextValues));
    } catch (error) {
      console.warn("workpack local draft save failed", error);
    }
  }

  function updateValue(value: string) {
    setValues((current) => {
      const nextValues = { ...current, [selected.key]: value };
      saveLocalDraft(nextValues);
      onDeliverablesChange?.(nextValues);
      return nextValues;
    });
    setLastEditedAt(new Date());
  }

  function updateRemediationDraft(itemId: string, text: string) {
    setRemediationDrafts((current) => {
      const existing = current[itemId];
      if (!existing) return current;
      return {
        ...current,
        [itemId]: {
          ...existing,
          text
        }
      };
    });
  }

  function insertRemediationDraft(itemId: string) {
    const draft = remediationDrafts[itemId];
    if (!draft || !draft.text.trim()) return;
    const separator = selectedText.trim() ? "\n\n" : "";
    updateValue(`${selectedText.trimEnd()}${separator}${draft.text.trim()}`);
    setRemediationDrafts((current) => {
      const next = { ...current };
      delete next[itemId];
      return next;
    });
    window.setTimeout(() => textareaRef.current?.focus({ preventScroll: true }), 120);
  }

  async function requestRemediation(item: RubricEvaluationItem) {
    setRemediationLoadingId(item.id);
    try {
      const response = await fetch("/api/workpack/remediate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          question: data.question,
          documentKey: selected.key,
          documentText: selectedText,
          rubricItemId: item.id
        })
      });
      const payload = await response.json().catch(() => null) as unknown;
      const draft = readRemediationDraft(item.id, payload);
      setRemediationDrafts((current) => ({
        ...current,
        [item.id]: response.ok ? draft : { ...draft, status: "error" }
      }));
    } catch (error) {
      console.error("workpack remediation request failed", error);
      setRemediationDrafts((current) => ({
        ...current,
        [item.id]: {
          itemId: item.id,
          text: "",
          status: "error",
          message: "보완 제안 요청 중 오류가 발생했습니다.",
          providerLabel: null,
          policyNote: "",
          catalogStatus: null,
          sources: []
        }
      }));
    } finally {
      setRemediationLoadingId(null);
    }
  }

  function downloadText() {
    downloadBlob(new Blob([selectedText], { type: "text/plain;charset=utf-8" }), `${baseName}.txt`);
  }

  function downloadJson() {
    const payload = {
      title: selected.title,
      scenario: data.scenario,
      document: selectedText,
      generatedAt: new Date().toISOString()
    };
    downloadBlob(new Blob([JSON.stringify(payload, null, 2)], { type: "application/json;charset=utf-8" }), `${baseName}.json`);
  }

  function downloadHtml() {
    downloadBlob(
      new Blob([buildHtml(selected.title, selectedRows, data.scenario, selectedFormProfile, data, riskAssessmentRows)], { type: "text/html;charset=utf-8" }),
      `${baseName}.html`
    );
  }

  function downloadCsv() {
    const rows = buildRowsForDocument(selected, values);
    downloadBlob(new Blob([`\uFEFF${buildDelimited(rows, ",")}`], { type: "text/csv;charset=utf-8" }), `${baseName}.csv`);
  }

  function downloadXls() {
    downloadBlob(
      new Blob([buildExcelHtml(selected.title, selectedRows, data.scenario, selectedFormProfile, data, riskAssessmentRows)], { type: "application/vnd.ms-excel;charset=utf-8" }),
      `${baseName}.xls`
    );
  }

  function downloadDoc() {
    downloadBlob(
      new Blob([buildWordHtml(selected.title, selectedRows, data.scenario, selectedFormProfile, data, riskAssessmentRows)], { type: "application/msword;charset=utf-8" }),
      `${baseName}.doc`
    );
  }

  function downloadJpg() {
    setImageStatus("idle");
    const markup = buildSafetyFormMarkup(selected.title, selectedRows, data.scenario, selectedFormProfile, data, riskAssessmentRows);
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1240" height="1754">
      <rect width="100%" height="100%" fill="#ece7dc"/>
      <foreignObject x="34" y="34" width="1172" height="1686">
        <div xmlns="http://www.w3.org/1999/xhtml">
          <style>${formCss("0")}</style>
          ${markup}
        </div>
      </foreignObject>
    </svg>`;
    const image = new Image();
    const svgUrl = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml;charset=utf-8" }));
    image.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = 1240;
      canvas.height = 1754;
      const context = canvas.getContext("2d");
      if (!context) return;
      context.fillStyle = "#fffaf1";
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(image, 0, 0);
      canvas.toBlob((blob) => {
        if (blob) downloadBlob(blob, `${baseName}.jpg`);
        URL.revokeObjectURL(svgUrl);
      }, "image/jpeg", 0.92);
    };
    image.onerror = () => {
      console.error("JPG export failed: SVG image could not be rendered");
      URL.revokeObjectURL(svgUrl);
      setImageStatus("error");
    };
    image.src = svgUrl;
  }

  async function downloadHwpx() {
    setHwpxStatus("building");
    try {
      const blob = await buildHwpxWithRhwp(buildHwpTemplateText(selected.title, selectedRows, selectedFormProfile, data.scenario, data, riskAssessmentRows));
      downloadBlob(blob, `${baseName}.hwpx`);
      setHwpxStatus("idle");
    } catch (error) {
      console.error("rhwp HWPX export failed", error);
      setHwpxStatus("error");
    }
  }

  function downloadAll() {
    const combined = buildCombinedText(values);
    downloadBlob(new Blob([combined], { type: "text/plain;charset=utf-8" }), `${sanitizeFileName(data.scenario.companyName)}-safeclaw-workpack.txt`);
  }

  function downloadAllCsv() {
    const rows = buildLaunchSheetRows(values);
    downloadBlob(new Blob([`\uFEFF${buildDelimited(rows, ",")}`], { type: "text/csv;charset=utf-8" }), `${sanitizeFileName(data.scenario.companyName)}-safeclaw-workpack.csv`);
  }

  function downloadAllXls() {
    const rows = buildLaunchSheetRows(values);
    downloadBlob(new Blob([buildLaunchWorkbookHtml("SafeClaw 문서팩", rows)], { type: "application/vnd.ms-excel;charset=utf-8" }), `${sanitizeFileName(data.scenario.companyName)}-safeclaw-workpack.xls`);
  }

  function downloadSheetsTsv() {
    const rows = buildLaunchSheetRows(values);
    downloadBlob(
      new Blob([`\uFEFF${buildDelimited(rows, "\t")}`], { type: "text/tab-separated-values;charset=utf-8" }),
      `${sanitizeFileName(data.scenario.companyName)}-google-sheets.tsv`
    );
  }

  function downloadTemplate() {
    if (templateKind === "sheet") {
      downloadXls();
      return;
    }
    if (templateKind === "word") {
      downloadDoc();
      return;
    }
    void downloadHwpx();
  }

  async function copySheetsTsv() {
    const confirmed = window.confirm("새 Google Sheets를 열고 표 데이터를 클립보드에 복사합니다. 열린 빈 시트의 A1 셀에 Ctrl+V로 붙여넣으면 문서팩 표가 들어갑니다.");
    if (!confirmed) return;

    const rows = buildLaunchSheetRows(values);
    const sheetWindow = window.open("https://sheets.new", "_blank", "noopener,noreferrer");
    try {
      await navigator.clipboard.writeText(buildDelimited(rows, "\t"));
      setSheetStatus("copied");
      if (!sheetWindow) {
        window.location.href = "https://sheets.new";
      }
    } catch (error) {
      console.error("Google Sheets TSV copy failed", error);
      setSheetStatus("error");
      downloadSheetsTsv();
      if (!sheetWindow) {
        window.location.href = "https://sheets.new";
      }
    }
  }

  function printPdf() {
    const popup = window.open("", "_blank", "width=900,height=1100");
    if (!popup) {
      console.error("PDF print window was blocked");
      downloadHtml();
      return;
    }
    popup.document.write(buildHtml(selected.title, selectedRows, data.scenario, selectedFormProfile, data, riskAssessmentRows));
    popup.document.close();
    popup.focus();
    popup.print();
  }

  return (
    <section className="workpack-shell" id="workpack">
      <div className="workpack-sidebar card list">
          <div>
          <div className="eyebrow">SafeClaw 문서팩</div>
          <div className="h2">오늘 문서팩</div>
          <p className="muted">현장에서 바로 수정하고 내려받을 수 있는 작업 전 산출물입니다.</p>
        </div>
        <div className="doc-tab-list">
          {documentMeta.map((item) => (
            <button
              key={item.key}
              type="button"
              className={`doc-tab ${item.key === selected.key ? "active" : ""}`}
              onClick={() => setSelectedKey(item.key)}
            >
              <strong>{item.title}</strong>
              <span>{item.description}</span>
            </button>
          ))}
        </div>
        <div className="sheet-export-panel">
          <div className="template-picker" aria-label="서식 템플릿 선택">
            {templatePresets.map((preset) => (
              <button
                key={preset.kind}
                type="button"
                className={`template-card ${preset.kind === templateKind ? "active" : ""}`}
                onClick={() => setTemplateKind(preset.kind)}
                aria-label={`${preset.label} 서식 선택`}
                aria-pressed={preset.kind === templateKind}
              >
                <strong>{preset.label}</strong>
                <span>{preset.description}</span>
              </button>
            ))}
          </div>
          <div className={`template-preview template-${templateKind}`} aria-live="polite">
            <span>{selectedTemplate.label} 미리보기</span>
            <strong>{selectedTemplate.previewTitle}</strong>
            <ul>
              {selectedTemplate.previewBullets.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
          <button type="button" className="button" onClick={downloadTemplate}>선택 서식 다운로드</button>
          <details className="advanced-downloads">
            <summary>전체 다운로드</summary>
            <div className="advanced-download-grid">
              <button type="button" className="button secondary" onClick={downloadAll}>전체 TXT</button>
              <button type="button" className="button secondary" onClick={downloadAllCsv}>전체 CSV</button>
              <button type="button" className="button secondary" onClick={downloadAllXls}>전체 XLS</button>
            </div>
          </details>
          <div className="sheets-action-box">
            <button type="button" className="button" onClick={copySheetsTsv}>새 Google Sheets 열기 + 표 복사</button>
            <button type="button" className="button secondary" onClick={downloadSheetsTsv}>Sheets용 TSV 다운로드</button>
            <p className="muted small">Google API/OAuth 없이 자동 입력은 하지 않습니다. 새 시트가 열리면 A1 셀에 붙여넣거나 TSV를 업로드해 사용하세요.</p>
          </div>
          {sheetStatus === "copied" ? <p className="muted small">표 데이터를 복사했습니다. 열린 Google Sheets의 A1 셀에 Ctrl+V로 붙여넣어 주세요.</p> : null}
          {sheetStatus === "error" ? <p className="export-error">클립보드 복사에 실패해 TSV 파일을 내려받았습니다. Google Sheets에서 파일 가져오기로 업로드해 주세요.</p> : null}
          <a className="knowledge-link" href="/knowledge">LLM 위키·지식 DB 확인</a>
          <div className="rubric-panel" aria-label="제출 전 점검">
            <div className="compact-head">
              <span className="eyebrow">제출 전 점검</span>
              <strong>점검 진행</strong>
            </div>
            <p className="muted small">
              공통 안전서류와 법령 기반 필수 확인을 먼저 보고, 공공기관 제출 품질 항목은 보강 대상으로 분리합니다.
            </p>
            <div className="rubric-meter" aria-hidden="true">
              <span style={{ width: `${(rubricEvaluation.summary.fulfilled / rubricEvaluation.summary.total) * 100}%` }} />
            </div>
            <div className="rubric-stack">
              {rubricEvaluation.items.slice(0, 6).map((item) => (
                <div key={item.id} className={`rubric-item ${item.status}`}>
                  <span>{rubricCategoryLabel(item.category)}</span>
                  <strong>{item.title}</strong>
                  <em>{rubricStatusLabel(item.status)}</em>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className={`card document-editor ${showFocusCue ? "editor-focus-cue" : ""}`} ref={editorRef}>
        <div className="document-toolbar">
          <div>
            <div className="eyebrow">편집 문서</div>
            <div className="h2">{selected.title}</div>
            <p className="muted">{selected.description}</p>
            <p className="editor-status" aria-live="polite">
              자동저장됨(이 브라우저) · 이력 저장은 관리자 로그인 후 · {selectedText.length.toLocaleString("ko-KR")}자
              {lastEditedAt ? ` · 마지막 수정 ${lastEditedAt.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })}` : ""}
            </p>
          </div>
          <div className="download-bar">
            <button type="button" className="button secondary" onClick={printPdf}>PDF 저장/인쇄</button>
            <button type="button" className="button secondary" onClick={downloadXls}>XLS</button>
            <button type="button" className="button" onClick={downloadHwpx} disabled={hwpxStatus === "building"}>
              {hwpxStatus === "building" ? "HWPX 생성 중" : "HWPX"}
            </button>
            <details className="advanced-downloads inline">
              <summary>베타 형식</summary>
              <div className="advanced-download-grid">
                <button type="button" className="button secondary" onClick={downloadDoc} title="Word 또는 한글에서 열 수 있는 보고서형 문서">DOC</button>
                <button type="button" className="button secondary" onClick={downloadText} title="메신저·메일 본문에 붙여넣기 쉬운 순수 텍스트">TXT</button>
                <button type="button" className="button secondary" onClick={downloadJson} title="외부 시스템 연동과 자동화용 구조화 데이터">JSON</button>
                <button type="button" className="button secondary" onClick={downloadCsv} title="엑셀·구글시트 업로드용 행 데이터">CSV</button>
                <button type="button" className="button secondary" onClick={downloadHtml} title="웹 게시·브라우저 인쇄용 문서">HTML</button>
                <button type="button" className="button secondary" onClick={downloadJpg} title="단톡방 이미지 공유와 현장 게시용 이미지">JPG</button>
              </div>
            </details>
          </div>
        </div>
        {hwpxStatus === "error" ? (
          <p className="export-error">HWPX 생성 중 오류가 발생했습니다. TXT 또는 HTML로 먼저 내려받아 주세요.</p>
        ) : null}
        {imageStatus === "error" ? (
          <p className="export-error">JPG 변환 중 오류가 발생했습니다. HTML 또는 PDF 저장/인쇄를 먼저 사용해 주세요.</p>
        ) : null}
        {showFocusCue ? (
          <p className="editor-focus-message" aria-live="polite">
            편집 영역입니다. 내용을 수정하면 이 브라우저에 자동 저장되고, PDF·XLS·HWPX로 바로 내려받을 수 있습니다.
          </p>
        ) : null}
        <SafetyDocumentPreview
          title={selected.title}
          rows={selectedRows}
          scenario={data.scenario}
          profile={selectedFormProfile}
          data={data}
          riskRows={riskAssessmentRows}
        />
        <div className="selected-rubric-strip" aria-label={`${selected.title} 제출 전 점검`}>
          {selectedRubricItems.length ? selectedRubricItems.map((item) => {
            const draft = remediationDrafts[item.id];
            return (
              <div key={item.id} className={`selected-rubric-item ${item.status}`}>
                <span>{rubricCategoryLabel(item.category)}</span>
                <strong>{item.title}</strong>
                <small>{rubricStatusLabel(item.status)} · {item.status === "fulfilled" ? "현재 문서에 반영되어 있습니다." : item.improvementAction}</small>
                {item.status !== "fulfilled" ? (
                  <div className="remediation-actions">
                    <button
                      type="button"
                      className="button secondary"
                      onClick={() => requestRemediation(item)}
                      disabled={remediationLoadingId === item.id}
                    >
                      {remediationLoadingId === item.id ? "보완 생성 중" : "보완 문구 생성"}
                    </button>
                  </div>
                ) : null}
                {draft ? (
                  <div className={`remediation-draft ${draft.status}`}>
                    <div className="compact-head">
                      <span className="eyebrow">AI 보완 제안</span>
                      <strong>{draft.status === "ready" ? "편집 후 삽입 가능" : "생성 확인 필요"}</strong>
                    </div>
                    <textarea
                      className="remediation-textarea"
                      value={draft.text}
                      onChange={(event) => updateRemediationDraft(item.id, event.target.value)}
                      aria-label={`${item.title} 보완 제안 편집`}
                    />
                    <p className="muted small">
                      {draft.providerLabel ? `${draft.providerLabel} · ` : ""}
                      {draft.policyNote || draft.message}
                    </p>
                    {draft.catalogStatus && !draft.catalogStatus.ok ? (
                      <p className="export-error">
                        지식 DB 근거는 점검 필요 상태입니다. {draft.catalogStatus.message}
                      </p>
                    ) : null}
                    {draft.sources.length ? (
                      <div className="remediation-sources">
                        {draft.sources.map((source) => (
                          <a key={`${item.id}-${source.title}`} href={source.url} target="_blank" rel="noreferrer">
                            <span>{source.sourceType === "catalog" ? "지식 DB" : "기본 근거"}</span>
                            {source.agency} · {source.title}
                          </a>
                        ))}
                      </div>
                    ) : null}
                    <div className="remediation-actions">
                      <button
                        type="button"
                        className="button"
                        onClick={() => insertRemediationDraft(item.id)}
                        disabled={draft.status !== "ready" || !draft.text.trim()}
                      >
                        문서에 삽입
                      </button>
                      <button
                        type="button"
                        className="button secondary"
                        onClick={() => setRemediationDrafts((current) => {
                          const next = { ...current };
                          delete next[item.id];
                          return next;
                        })}
                      >
                        닫기
                      </button>
                    </div>
                  </div>
                ) : null}
              </div>
            );
          }) : (
            <div className="selected-rubric-item fulfilled">
              <span>현장 운영 추천</span>
              <strong>문서별 직접 점검 항목 없음</strong>
              <small>전체 문서팩 점검 패널에서 공통 보강 항목을 확인하세요.</small>
            </div>
          )}
        </div>
        <textarea
          ref={textareaRef}
          className="document-textarea"
          value={selectedText}
          onChange={(event) => updateValue(event.target.value)}
          aria-label={`${selected.title} 편집`}
        />
      </div>
    </section>
  );
}
