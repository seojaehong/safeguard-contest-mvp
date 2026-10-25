// 위험성평가 출력용 한글 라벨 — 화면 미리보기·인쇄·Word·xlsx·hwp·pdf 가 모두 이 맵을 쓴다.
// 결정(2026-10-25, COPY-12): 위험등급 표기는 「상·중·하」로 통일한다.
import type { AccidentType, FourM, RiskLevel, VerificationStatus } from "@/lib/risk-assessment-schema";

export const RISK_LEVEL_LABELS = {
  high: "상",
  medium: "중",
  low: "하"
} satisfies Readonly<Record<RiskLevel, string>>;

export const FOUR_M_LABELS = {
  Man: "인적 요인",
  Machine: "기계·설비 요인",
  Media: "작업환경 요인",
  Management: "관리 요인"
} satisfies Readonly<Record<FourM, string>>;

export const ACCIDENT_TYPE_LABELS = {
  fall: "추락",
  slip: "미끄러짐",
  struckBy: "맞음",
  caughtIn: "끼임",
  cut: "베임",
  burn: "화상",
  electricShock: "감전",
  chemicalExposure: "화학물질 노출",
  asphyxiation: "질식",
  heatIllness: "온열질환",
  traffic: "교통사고",
  collapse: "붕괴",
  fireExplosion: "화재·폭발",
  other: "기타"
} satisfies Readonly<Record<AccidentType, string>>;

export const VERIFICATION_STATUS_LABELS = {
  planned: "조치 예정",
  done: "조치 완료",
  needsReview: "검토 필요"
} satisfies Readonly<Record<VerificationStatus, string>>;

const RISK_LEVEL_ALIASES: Readonly<Record<string, RiskLevel>> = {
  high: "high",
  medium: "medium",
  low: "low",
  상: "high",
  중: "medium",
  하: "low",
  높음: "high",
  보통: "medium",
  낮음: "low"
};

function lookup<T extends string>(labels: Readonly<Record<T, string>>, value: string | undefined): string | undefined {
  const normalized = value?.trim();
  if (!normalized) return undefined;
  return normalized in labels ? labels[normalized as T] : undefined;
}

/** 영문 원값이나 다른 표기(높음·보통·낮음)를 「상·중·하」로 바꾼다. 모르는 값은 빈칸으로 둔다. */
export function riskLevelLabel(value: string | undefined): string {
  const key = value?.trim();
  if (!key) return "";
  const canonical = RISK_LEVEL_ALIASES[key] ?? RISK_LEVEL_ALIASES[key.toLowerCase()];
  return canonical ? RISK_LEVEL_LABELS[canonical] : "";
}

export function fourMLabel(value: string | undefined): string {
  return lookup(FOUR_M_LABELS, value) ?? (value?.trim() && !/^[A-Za-z]+$/.test(value.trim()) ? value.trim() : "");
}

export function accidentTypeLabel(value: string | undefined): string {
  return lookup(ACCIDENT_TYPE_LABELS, value) ?? (value?.trim() && !/^[A-Za-z]+$/.test(value.trim()) ? value.trim() : "");
}

export function verificationStatusLabel(value: string | undefined): string {
  const normalized = value?.trim();
  if (!normalized) return "";
  if (normalized.toLowerCase() === "needsreview") return VERIFICATION_STATUS_LABELS.needsReview;
  return lookup(VERIFICATION_STATUS_LABELS, normalized) ?? (/^[A-Za-z]+$/.test(normalized) ? "" : normalized);
}

export function riskLevelFromScores(likelihood: number, severity: number): RiskLevel {
  const score = likelihood * severity;
  if (score >= 10) return "high";
  if (score >= 5) return "medium";
  return "low";
}

const RISK_LEVEL_ORDER: readonly RiskLevel[] = ["low", "medium", "high"];

/** 평가표 행의 가장 높은 등급(「상·중·하」). 행이 없으면 빈 문자열. 요약 위험수준은 이 값과 같아야 한다(EXP-09). */
export function summarizeRiskLevel(rows: ReadonlyArray<{ riskLevel?: string }>): "상" | "중" | "하" | "" {
  let best = -1;
  for (const row of rows) {
    const label = riskLevelLabel(row.riskLevel);
    const canonical = label ? RISK_LEVEL_ALIASES[label] : undefined;
    if (!canonical) continue;
    best = Math.max(best, RISK_LEVEL_ORDER.indexOf(canonical));
  }
  return best < 0 ? "" : RISK_LEVEL_LABELS[RISK_LEVEL_ORDER[best]] as "상" | "중" | "하";
}

/**
 * 위험성 결정 척도와 허용 기준. 출력물 머리에 그대로 싣는다.
 * 기준값은 lib/risk-assessment-schema.ts 의 등급 검증(곱 10 이상 상, 5 이상 중)과 같다.
 */
export const RISK_SCALE_LINES = [
  "위험성 결정 방법: 가능성(1~5) × 중대성(1~5)의 곱으로 정합니다.",
  "등급: 곱 10 이상 「상」 · 5~9 「중」 · 4 이하 「하」",
  "허용 기준: 「하」는 현 상태로 관리합니다. 「중」·「상」은 감소대책을 실행한 뒤 다시 평가합니다. 사업장 기준이 다르면 고쳐 씁니다."
] as const;

export const RISK_RETENTION_NOTE = "이 기록은 3년간 보존합니다(산업안전보건법 시행규칙 제37조의4제2항).";
