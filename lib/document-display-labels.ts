// 사용자 문서·화면에 나가는 표시용 한글 이름 사전 (PR-14).
//
// 데이터 모델 값(enum: high·Man·fireExplosion·planned·riskAssessmentDraft 등)은
// 그대로 두고, 화면·인쇄·xlsx·hwp·hwpx·카톡으로 나가기 직전에 이 사전으로만
// 바꿔 쓴다. 같은 enum 을 파일마다 다르게 옮기던 것(높음/상, 예정/확인 예정,
// 미끄러짐/미끄러짐·넘어짐)을 여기 한 곳으로 모았다.
// 위험등급 표기는 「상·중·하」(결정 15, 2026-10-25).

import { getDocumentTitle, DOCUMENT_TITLES } from "@/lib/document-titles";
import type { AccidentType, FourM, RiskLevel, VerificationStatus } from "@/lib/risk-assessment-schema";

export const FOUR_M_DISPLAY_LABELS: Readonly<Record<FourM, string>> = {
  Man: "인적 요인",
  Machine: "기계·설비 요인",
  Media: "작업환경 요인",
  Management: "관리 요인"
};

export const ACCIDENT_TYPE_DISPLAY_LABELS: Readonly<Record<AccidentType, string>> = {
  fall: "추락",
  slip: "미끄러짐",
  struckBy: "맞음",
  caughtIn: "끼임",
  cut: "베임",
  burn: "화상",
  collapse: "붕괴",
  fireExplosion: "화재·폭발",
  electricShock: "감전",
  chemicalExposure: "화학물질 노출",
  asphyxiation: "질식",
  heatIllness: "온열질환",
  traffic: "교통사고",
  other: "기타"
};

export const RISK_LEVEL_DISPLAY_LABELS: Readonly<Record<RiskLevel, string>> = {
  high: "상",
  medium: "중",
  low: "하"
};

export const VERIFICATION_STATUS_DISPLAY_LABELS: Readonly<Record<VerificationStatus, string>> = {
  planned: "조치 예정",
  done: "조치 완료",
  needsReview: "검토 필요"
};

function lookup<K extends string>(labels: Readonly<Record<K, string>>, value: string | null | undefined): string | null {
  const text = typeof value === "string" ? value.trim() : "";
  if (!text) return null;
  if (Object.prototype.hasOwnProperty.call(labels, text)) return labels[text as K];
  return null;
}

/** 4M 값 → 한글. 사전에 없는 값(이미 한글 등)은 그대로 돌려준다. */
export function fourMLabel(value: string | null | undefined): string {
  return lookup(FOUR_M_DISPLAY_LABELS, value) ?? (value ?? "").trim();
}

/** 재해형태 값 → 한글. */
export function accidentTypeLabel(value: string | null | undefined): string {
  return lookup(ACCIDENT_TYPE_DISPLAY_LABELS, value) ?? (value ?? "").trim();
}

/** 위험등급 값 → 상·중·하. 대소문자를 가리지 않는다. */
export function riskLevelLabel(value: string | null | undefined): string {
  const text = (value ?? "").trim();
  return lookup(RISK_LEVEL_DISPLAY_LABELS, text.toLowerCase()) ?? text;
}

/** 확인상태 값 → 한글. needsreview 처럼 소문자로 와도 받는다. */
export function verificationStatusLabel(value: string | null | undefined): string {
  const text = (value ?? "").trim();
  if (text.toLowerCase() === "needsreview") return VERIFICATION_STATUS_DISPLAY_LABELS.needsReview;
  return lookup(VERIFICATION_STATUS_DISPLAY_LABELS, text.toLowerCase()) ?? text;
}

/** 문서 키(riskAssessmentDraft 등) → 한글 문서명. 문서 키가 아니면 그대로. */
export function documentKeyLabel(value: string): string {
  return getDocumentTitle(value);
}

export const DOCUMENT_KEY_NAMES: readonly string[] = Object.keys(DOCUMENT_TITLES);

/**
 * 셀 하나가 통째로 enum 값일 때만 한글로 바꾼다(「high」→「상」, 「needsReview」→「검토 필요」).
 * 문장 속 영단어는 건드리지 않는다. 바꿀 값이 아니면 null.
 */
export function enumCellLabel(value: string): string | null {
  const text = value.trim();
  if (!text) return null;
  return lookup(RISK_LEVEL_DISPLAY_LABELS, text)
    ?? lookup(VERIFICATION_STATUS_DISPLAY_LABELS, text)
    ?? lookup(FOUR_M_DISPLAY_LABELS, text)
    ?? (text === "other" ? null : lookup(ACCIDENT_TYPE_DISPLAY_LABELS, text))
    ?? (Object.prototype.hasOwnProperty.call(DOCUMENT_TITLES, text) ? DOCUMENT_TITLES[text] : null);
}

// 위험성평가 관리번호 (RA-10/COPY, 2026-10-26).
// 기본 틀은 행마다 `RA-<작업 유형 id>-<순번>`(RA-press-1·RA-confined-space-1) 을 관리번호로 만들었고,
// 이 값이 초안 본문 「관리번호:」 줄과 편집 화면에 그대로 나갔다(운영 4건 15행). 사용자에게 나가는
// 관리번호는 한글·숫자만 쓴다 — 「위험성평가-01」. Phase A 의 의미 있는 control id(fall-work-platform 등)와
// 사람이 적은 값은 건드리지 않는다(연결 키·편집 값이라 그대로 둬야 한다).
export const RISK_CONTROL_CODE_PATTERN = /^RA-[a-z]+(?:-[a-z]+)*-\d+$/iu;

/** 0부터 세는 행 순번 → 「위험성평가-01」. 두 자리 미만은 0 을 채우고, 100 이상은 그대로 쓴다. */
export function riskManagementNumber(index: number): string {
  return `위험성평가-${String(index + 1).padStart(2, "0")}`;
}

/**
 * 관리번호 표시값. 기본 틀 영문 코드(RA-…-N)면 행 순번으로 「위험성평가-NN」을 만들고,
 * 그 밖의 값(빈칸·한글·사람이 적은 값·Phase A control id)은 그대로 돌려준다.
 */
export function riskManagementNumberLabel(controlId: string | null | undefined, index: number): string {
  const text = typeof controlId === "string" ? controlId.trim() : "";
  if (!text) return "";
  return RISK_CONTROL_CODE_PATTERN.test(text) ? riskManagementNumber(index) : text;
}

// 근거 목록에 섞여 들어오는 내부 출처 표지 — 사람이 읽을 자료명이 아니다.
const INTERNAL_EVIDENCE_REF_PATTERNS: readonly RegExp[] = [
  /^DB\s*하네스\s*(?:직접|보조)\s*근거$/u,
  /^고정 근거\s*(?:직접|보조)\s*근거$/u,
  /^(?:직접|보조)\s*근거$/u,
  /^검색:\s*\S+$/u,
  /^safety_reference_items$/u,
  /^[a-z]+(?:[-_][a-z]+)+$/u
];

/** 근거 목록을 사람이 읽을 자료명으로 바꾼다. 문서 키는 문서명으로, 내부 출처 표지는 뺀다. */
export function evidenceRefsForDisplay(refs: readonly string[] | null | undefined): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const raw of refs ?? []) {
    const text = typeof raw === "string" ? raw.trim() : "";
    if (!text) continue;
    if (INTERNAL_EVIDENCE_REF_PATTERNS.some((pattern) => pattern.test(text))) continue;
    const label = documentKeyLabel(text);
    if (seen.has(label)) continue;
    seen.add(label);
    result.push(label);
  }
  return result;
}
