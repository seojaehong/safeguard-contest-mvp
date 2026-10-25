// 사용자 문서 출력 게이트 (PR-14).
//
// 생성 파이프라인이 문서 본문에 남기는 내부 문구(온톨로지·파싱·검수 보완·SIF ID·
// 검색 경로·원시 태그·영문 enum·문서 키)를 사용자에게 나가기 직전에 걸러 낸다.
// - 문서 생성: lib/search.ts runAsk 의 마지막 단계(온톨로지 QA 뒤, 품질 계약·봉인 앞)
// - 내보내기: app/api/export/{pdf,xlsx,hwp} 가 받은 본문 + xlsx 통합문서 셀
// - 편집 화면: HWPX·Word·XLS 텍스트 서식
// 원칙: 문장 단위 치환만 한다(문단 구조를 깨지 않는다). 구간을 통째로 지우지 않는다 —
// 「[내부 안전지식 DB 반영]」 구간에는 구조화 위험행의 문장이 실려 있어(편집기의 본문-행 일치 판정이
// 이 문장을 본다) 머리줄과 내부 표지만 바꾼다. 같은 입력에 두 번 돌려도 결과가 같다.

import {
  accidentTypeLabel,
  DOCUMENT_KEY_NAMES,
  enumCellLabel,
  fourMLabel,
  riskLevelLabel,
  riskManagementNumber,
  riskManagementNumberLabel,
  verificationStatusLabel
} from "@/lib/document-display-labels";
import { getDocumentTitle } from "@/lib/document-titles";

/** 사용자 문서에 0회여야 하는 내부 문구. 시험·스모크가 같은 목록을 본다. */
export const USER_OUTPUT_FORBIDDEN_PATTERNS: ReadonlyArray<{ rule: string; pattern: RegExp }> = [
  { rule: "온톨로지", pattern: /온톨로지/u },
  { rule: "파싱", pattern: /파싱/u },
  { rule: "검수 보완", pattern: /검수 보완/u },
  { rule: "SIF ID", pattern: /SIF:\s*sif-/iu },
  { rule: "검색 경로", pattern: /검색:\s*(?:rest|ranked|vector|hybrid|local-tag|local-ranked|local-hybrid)\b/u },
  { rule: "원시 태그", pattern: /원시 태그/u },
  { rule: "DB 하네스", pattern: /DB\s*하네스/u },
  { rule: "기상 API", pattern: /기상 API/u },
  { rule: "evidence UI", pattern: /evidence UI|metadata에서/u },
  { rule: "내부 안전지식 DB", pattern: /내부 안전지식 DB/u },
  { rule: "내부 반영 위치", pattern: /\b[a-z]+(?:_[a-z]+)* \/ 반영 위치/u },
  {
    rule: "영문 enum 줄",
    pattern: /^\s*(?:-\s*)?(?:위험등급|위험수준|위험도|4M|재해형태|재해유형|확인상태)\s*:\s*(?:high|medium|low|Man|Machine|Media|Management|planned|done|needsReview|[a-z]+[A-Z][A-Za-z]*)\s*$/mu
  },
  { rule: "문서 키", pattern: new RegExp(`\\b(?:${DOCUMENT_KEY_NAMES.join("|")})\\b`, "u") },
  // 위험성평가 관리번호의 taskId 기반 영문 코드(RA-press-1·RA-confined-space-1). 운영 4건 15행이 이 게이트를 지나 나갔다(2026-10-25).
  { rule: "위험성평가 관리번호 코드", pattern: /\bRA-[a-z]+(?:-[a-z]+)*-\d+\b/u }
];

export type UserOutputLeak = { rule: string; sample: string };

/** 본문에서 금지 문구를 찾는다(시험·감사용). */
export function findUserOutputLeaks(text: string): UserOutputLeak[] {
  const leaks: UserOutputLeak[] = [];
  for (const { rule, pattern } of USER_OUTPUT_FORBIDDEN_PATTERNS) {
    const match = pattern.exec(text);
    if (!match) continue;
    const start = Math.max(0, match.index - 20);
    leaks.push({ rule, sample: text.slice(start, match.index + match[0].length + 20) });
  }
  return leaks;
}

// 내부용 구간 머리줄과 그 줄 머리의 영문 반영 키(「permit / 반영 위치」)를 사람이 읽을 말로 바꾼다.
function rewriteInternalSections(text: string): string {
  return text
    .replace(/^(\s*)\[내부 안전지식 DB 반영([^\]]*)\]\s*$/gmu, "$1[안전 참고자료 반영$2]")
    .replace(/^(\s*-\s*)[a-z]+(?:_[a-z]+)* \/ 반영 위치/gmu, "$1반영 위치");
}

// 문장 단위 치환. 순서가 중요하다(긴 문구 먼저).
const PHRASE_REPLACEMENTS: ReadonlyArray<readonly [RegExp, string]> = [
  // 섹션 머리줄·검수 줄 머리(온톨로지 QA 보완 → 추가 안전조치 확인)
  [/온톨로지 QA 보완 반영/gu, "추가 안전조치 확인"],
  [/온톨로지 QA/gu, "안전조치 점검"],
  [/온톨로지/gu, "안전지식 체계"],
  [/검수 보완 작업:/gu, "확인 대상 작업:"],
  [/검수 보완 전달:/gu, "추가 전달 사항:"],
  [/검수 보완 확인:/gu, "추가 확인 대상:"],
  [/검수 보완/gu, "추가 확인"],
  [/누락 위험요인 확인:/gu, "추가 위험요인 확인:"],
  // 중대재해 참고자료 줄
  [/내부 참고자료 반영:\s*중대재해처벌법 실무서 파싱 요약을 바탕으로/gu, "참고자료: 중대재해처벌법 해설 자료를 바탕으로"],
  [/실무서 파싱 요약/gu, "해설 자료"],
  [/파싱 요약/gu, "요약"],
  [/파싱/gu, "정리"],
  // SIF 사례 ID — 괄호째 지운다
  [/\s*\(\s*SIF:\s*sif-[^)]*\)/giu, ""],
  [/\s*SIF:\s*sif-[^\s,;)\]]+/giu, ""],
  // 검수 메모
  [/원시 태그·관리대책을/gu, "사고사례 관리대책을"],
  [/원시 태그/gu, "사고사례 분류"],
  // 검색 경로
  [/\s*(?:\/|·|,)?\s*검색:\s*(?:rest|ranked|vector|hybrid|local-tag|local-ranked|local-hybrid)\b/gu, ""],
  // 내부 출처 표지
  [/DB\s*하네스\s*직접\s*근거/gu, "직접 근거"],
  [/DB\s*하네스\s*보조\s*근거/gu, "보조 근거"],
  [/DB\s*하네스\s*근거/gu, "근거 자료"],
  [/DB\s*하네스/gu, "근거 자료"],
  // 기상·출처 안내 문장
  [/기상 API 결과/gu, "기상청 예보 확인 결과"],
  [/기상 API/gu, "기상청 예보"],
  [/원문성 근거는 evidence UI\/metadata에서 확인/gu, "근거 원문은 문서팩 근거 화면에서 확인"],
  [/evidence UI\/metadata/gu, "문서팩 근거 화면"],
  // AI 가 쓴 「Man(사람)」 꼴 4M 표기 → 괄호 안 한글만
  [/\b(?:Man|Machine|Media|Management)\(([^)]+)\)/gu, "$1"]
];

// 위험성평가 관리번호 영문 코드(RA-<taskId>-<순번>) → 「위험성평가-NN」.
// 본문 글에는 행 순번이 없으므로 코드 끝의 순번을 쓴다(기본 틀은 1부터 행 순서대로 매기므로 구조화 행과 같다).
const RISK_CONTROL_CODE_IN_TEXT = /\bRA-[a-z]+(?:-[a-z]+)*-(\d+)\b/gu;

function rewriteRiskControlCodes(text: string): string {
  return text.replace(RISK_CONTROL_CODE_IN_TEXT, (_all, ordinal: string) => riskManagementNumber(Number(ordinal) - 1));
}

const DOCUMENT_KEY_PATTERN = new RegExp(`\\b(${DOCUMENT_KEY_NAMES.join("|")})\\b`, "gu");

// 「라벨: enum」 줄 — 라벨에 맞는 사전으로 바꾼다.
const LABELLED_ENUM_LINE = /^(\s*(?:-\s*)?)(위험등급|위험수준|위험도|4M|재해형태|재해유형|확인상태)(\s*:\s*)(\S+)(\s*)$/gmu;

function localizeLabelledEnum(label: string, value: string): string {
  switch (label) {
    case "4M":
      return fourMLabel(value);
    case "재해형태":
    case "재해유형":
      return accidentTypeLabel(value);
    case "확인상태":
      return verificationStatusLabel(value);
    default:
      return riskLevelLabel(value);
  }
}

/** 문서 본문 문자열 하나를 사용자용으로 거른다. */
export function gateUserOutputText(text: string): string {
  if (!text) return text;
  let next = rewriteInternalSections(text);
  for (const [pattern, replacement] of PHRASE_REPLACEMENTS) next = next.replace(pattern, replacement);
  next = next.replace(LABELLED_ENUM_LINE, (_all, lead: string, label: string, sep: string, value: string, tail: string) => (
    `${lead}${label}${sep}${localizeLabelledEnum(label, value)}${tail}`
  ));
  next = next.replace(DOCUMENT_KEY_PATTERN, (key: string) => getDocumentTitle(key));
  next = rewriteRiskControlCodes(next);
  return next;
}

/** 표 칸 하나: 통째로 enum 이면 한글로, 아니면 본문 게이트. */
export function gateUserOutputCell(value: string): string {
  return enumCellLabel(value) ?? gateUserOutputText(value);
}

// 내보내기 요청 본문에서 표 칸으로 쓰이는 키 — 통째 enum 을 한글로 바꾼다.
// structuredRiskRows 의 riskLevel·fourM 등 enum 필드는 각 빌더가 사전으로 옮기므로 건드리지 않는다.
const EXPORT_CELL_KEYS = new Set(["content", "item", "value", "section", "detail", "note"]);
const EXPORT_ENUM_KEYS = new Set([
  "riskLevel",
  "fourM",
  "accidentType",
  "verificationStatus",
  "status",
  "category",
  "format",
  "layout",
  "kind",
  "documentKey",
  "key",
  "mode",
  "code",
  "id",
  "controlId"
]);

/**
 * 내보내기 요청 본문 전체를 사용자용으로 거른다. 문자열 값만 바꾸고 구조·enum 필드는 그대로 둔다.
 */
export function gateExportPayload<T>(value: T, key = ""): T {
  if (typeof value === "string") {
    if (EXPORT_ENUM_KEYS.has(key)) return value;
    return (EXPORT_CELL_KEYS.has(key) ? gateUserOutputCell(value) : gateUserOutputText(value)) as T;
  }
  if (Array.isArray(value)) return value.map((item) => gateExportPayload(item, key)) as T;
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([childKey, child]) => [childKey, gateExportPayload(child, childKey)])
    ) as T;
  }
  return value;
}

type DeliverablesLike = Record<string, unknown>;

/** 응답의 deliverables(문자열·문자열 배열)만 거른다. structured 는 데이터라 그대로 둔다. */
export function gateDeliverables<T extends DeliverablesLike>(deliverables: T): T {
  const next: DeliverablesLike = { ...deliverables };
  for (const [key, value] of Object.entries(deliverables)) {
    if (typeof value === "string") next[key] = gateUserOutputText(value);
    else if (Array.isArray(value)) next[key] = value.map((item) => (typeof item === "string" ? gateUserOutputText(item) : item));
  }
  return next as T;
}

// 위험성평가 구조화 행 중 사람이 읽는 문장 칸. 본문(riskAssessmentDraft)과 같은 게이트를 거쳐야
// 편집기의 「구조화 행이 본문에 그대로 있는가」 판정(areRiskAssessmentRowsRepresentedInDraft)이 유지된다.
// enum(fourM·accidentType·riskLevel·verificationStatus)과 evidenceRefs(출처 추적 데이터)는 그대로 둔다.
const RISK_ROW_TEXT_FIELDS = [
  "location",
  "process",
  "task",
  "equipment",
  "hazard",
  "currentControls",
  "additionalControls",
  "owner",
  "due",
  "verification",
  "verificationDate",
  "verificationChecker",
  "whyLikelihood",
  "whySeverity"
] as const;

function gateRiskRowText<T>(row: T, index: number): T {
  if (!row || typeof row !== "object") return row;
  const next: Record<string, unknown> = { ...(row as Record<string, unknown>) };
  for (const field of RISK_ROW_TEXT_FIELDS) {
    const value = next[field];
    if (typeof value === "string") next[field] = gateUserOutputText(value);
  }
  // 관리번호: 기본 틀 영문 코드(RA-…-N)만 「위험성평가-NN」으로. Phase A control id 와 사람이 적은 값은 그대로(연결 키).
  if (typeof next.controlId === "string") {
    const label = riskManagementNumberLabel(next.controlId, index);
    if (label !== next.controlId) next.controlId = label;
  }
  return next as T;
}

function gateStructuredRiskRows<S>(structured: S): S {
  if (!structured || typeof structured !== "object") return structured;
  const record = structured as Record<string, unknown>;
  if (!Array.isArray(record.riskAssessmentRows)) return structured;
  return { ...record, riskAssessmentRows: record.riskAssessmentRows.map((row, index) => gateRiskRowText(row, index)) } as S;
}

export function gateAskResponseUserOutput<T extends { deliverables: DeliverablesLike; structured?: unknown }>(response: T): T {
  const gated = { ...response, deliverables: gateDeliverables(response.deliverables) };
  if ("structured" in response && response.structured) gated.structured = gateStructuredRiskRows(response.structured);
  return gated;
}
