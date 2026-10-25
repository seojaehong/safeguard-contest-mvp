// 안전보건교육 기록에 고정으로 싣는 법정 문구 묶음(PR-08).
// 템플릿 기록(lib/mock-data.ts)과 AI 기록(lib/search.ts) 양쪽에 같은 묶음을 쓴다.
// 2026-10-25 법제처 원문 확인: 안전보건규칙 제37조·제140조·제560조·제562조·제567조·제641조,
// 시행규칙 제26조, 별표 5 제1호라목 제34호.
import { buildEducationCourseTable, formatEducationCourseTableLines } from "./education-course-table";
import { hasHeatCondition } from "./task-scenario-profiles";

export type EducationRecordContext = {
  question: string;
  taskId: string | null | undefined;
  companyType: string;
  workerCount: number;
};

export const EDUCATION_COURSE_TABLE_HEADER = "[교육 종류·법정 시간 확인표]";
export const CONFINED_SPACE_NOTICE_HEADER = "[밀폐공간 작업 전 주지사항(안전보건규칙 제641조)]";
export const EDUCATION_RETENTION_LINE = "보존 기간: 사업장 규정·관할 지청 확인";

// 제641조 각 호(작업근로자·감시인에게 작업 시작 전 알리고 숙지 여부를 확인)
const CONFINED_SPACE_NOTICE_ITEMS = [
  "밀폐공간의 위험성",
  "산소 및 유해가스농도 측정에 관한 사항",
  "환기설비의 가동 등 안전한 작업방법에 관한 사항",
  "보호구의 착용과 사용방법에 관한 사항",
  "사고 시 구조요청을 할 수 있는 관할 소방관서 등 비상연락처 및 응급조치에 관한 사항",
  "제625조에 따른 대피용 기구의 위치 및 사용방법"
];

// 시행규칙 별표 5 제1호라목 제34호(밀폐공간에서의 작업) 개별내용
const CONFINED_SPACE_SPECIAL_ITEMS = [
  "산소농도 측정 및 작업환경에 관한 사항",
  "사고 시의 응급처치 및 비상 시 구출에 관한 사항",
  "보호구 착용 및 보호 장비 사용에 관한 사항",
  "작업내용ㆍ안전작업방법 및 절차에 관한 사항",
  "장비ㆍ설비 및 시설 등의 안전점검에 관한 사항"
];

export function isConfinedSpaceEducation(ctx: EducationRecordContext): boolean {
  return ctx.taskId === "confined-space" || (ctx.taskId === "pump-confined" && /밀폐/.test(ctx.question));
}

export function buildConfinedSpaceNoticeSection(): string[] {
  return [
    CONFINED_SPACE_NOTICE_HEADER,
    ...CONFINED_SPACE_NOTICE_ITEMS.map((item, index) => `${index + 1}. ${item}: □ 주지 □ 숙지 확인`),
    "",
    "[특별교육 개별내용(시행규칙 별표5 제1호라목 제34호 밀폐공간에서의 작업)]",
    ...CONFINED_SPACE_SPECIAL_ITEMS.map((item) => `- ${item}: □ 실시 □ 미실시`),
    "특별교육 이수 확인: □ 이수(이수일 ____-__-__, 시간 ____) □ 미이수 — 미이수자는 밀폐공간 작업에 배치하지 않음",
    "측정자 교육 확인: 산소·유해가스 측정자 성명(현장 기재) / 측정기 사용법 교육 □ 확인",
    "도급인 확인: 협력업체 작업이면 도급인의 안전보건 정보 제공·작업 확인 □ 확인 □ 자체 작업(도급 아님)"
  ];
}

function parseFeelsLike(question: string): number | null {
  const match = /체감\s*(?:온도\s*)?(\d+(?:\.\d+)?)\s*(?:도|℃)/.exec(question);
  return match ? Number(match[1]) : null;
}

/** 폭염작업 교육 강조사항(EDU-05). 실내·옥외를 가르지 않고 질문의 폭염·체감 수치를 읽는다. */
export function buildHeatEmphasisLines(question: string): string[] {
  if (!hasHeatCondition(question)) return [];
  const feels = parseFeelsLike(question);
  const outdoor = /옥외|야외|도로|건설|지붕|포장/.test(question) && !/창고|실내|공장|물류/.test(question);
  const lines = [
    feels !== null && feels >= 33
      ? `체감온도 ${feels}도: 매 2시간 이내 20분 이상 휴식(안전보건규칙 제560조제3항)`
      : "체감온도 33도 이상이 되면 매 2시간 이내 20분 이상 휴식(안전보건규칙 제560조제3항)",
    "냉방·통풍 가동 또는 작업시간대 조정으로 폭염 노출을 줄임(안전보건규칙 제560조제2항)",
    "작업 전 온열질환 증상·예방조치·응급조치 요령 고지, 작업장소 체감온도와 조치사항을 일자별로 기록(안전보건규칙 제562조제2항)",
    "열사병 등 의심 증상이 있으면 즉시 작업을 멈추고 119(관할 소방관서)에 신고(안전보건규칙 제562조제3항)",
    outdoor
      ? "옥외 작업은 휴식시간에 쓸 그늘진 장소를 제공(안전보건규칙 제567조제2항)"
      : "휴식은 작업장소와 격리된 휴게시설에서(안전보건규칙 제567조제1항·제3항)"
  ];
  if (/고령/.test(question)) lines.push("고령 작업자는 휴식·수분 섭취를 관찰하는 담당자를 정해 상태를 확인");
  return lines;
}

/** 이동식 크레인 등 인양 장비가 있는 작업의 강풍 작업중지 기준(EDU-07). */
export function buildCraneWindLines(question: string): string[] {
  if (!/크레인/.test(question)) return [];
  const tower = /타워\s*크레인/.test(question);
  return [
    "크레인 인양 작업은 장비 정격·제조사 풍속 한계를 작업 전에 확인하고, 바람 등으로 위험해질 우려가 있으면 작업을 중지(안전보건규칙 제37조제1항, 중지 판단자: 관리감독자, 성명 현장 기재)",
    ...(tower ? ["타워크레인: 순간풍속 초당 10미터 초과 시 설치·수리·점검·해체 중지, 15미터 초과 시 운전 중지(안전보건규칙 제37조제2항)"] : [])
  ];
}

export function buildEducationCourseSection(ctx: EducationRecordContext): { lines: string[]; determined: boolean } {
  const table = buildEducationCourseTable(ctx);
  return { lines: [EDUCATION_COURSE_TABLE_HEADER, ...formatEducationCourseTableLines(table)], determined: table.determined };
}

/**
 * AI 가 쓴 교육기록에 법정 묶음(확인표·제641조·폭염·크레인·보존 기간)이 빠졌으면 덧붙인다.
 * 이미 있는 묶음은 다시 붙이지 않는다.
 */
export function ensureEducationRecordSections(text: string, ctx: EducationRecordContext): string {
  const blocks: string[] = [];
  if (!text.includes(EDUCATION_COURSE_TABLE_HEADER)) blocks.push(buildEducationCourseSection(ctx).lines.join("\n"));
  if (isConfinedSpaceEducation(ctx) && !text.includes(CONFINED_SPACE_NOTICE_HEADER)) {
    blocks.push(buildConfinedSpaceNoticeSection().join("\n"));
  }
  const heat = buildHeatEmphasisLines(ctx.question);
  const crane = buildCraneWindLines(ctx.question);
  const extra = [...(/제560조제3항/.test(text) ? [] : heat), ...(/제37조제1항/.test(text) ? [] : crane)];
  if (extra.length) blocks.push(["[법정 강조사항]", ...extra.map((line) => `- ${line}`)].join("\n"));
  if (!text.includes(EDUCATION_RETENTION_LINE)) blocks.push(`[기록 보존]\n${EDUCATION_RETENTION_LINE}`);
  if (!blocks.length) return text;
  return `${text.trimEnd()}\n\n${blocks.join("\n\n")}`;
}
