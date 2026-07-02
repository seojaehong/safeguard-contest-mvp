// 아침 자동 브리핑 — "시키지 않아도 출근하는 안전관리자" (SafeClaw 2 기둥 4).
//
// Vercel cron이 매일 06:00 KST에 app/api/briefing/run을 호출한다. 이 파일은 그 라우트가
// 쓰는 순수 로직만 모아둔다: env로 받은 대상 사이트 목록 파싱, 생성된 AskResponse로부터
// 이메일 제목/본문을 만드는 것. Supabase/네트워크 의존성 없음 — vitest로 바로 검증 가능.

import type { AskResponse } from "@/lib/types";

export type BriefingSite = {
  name: string;
  question: string;
  email: string;
};

export type ParseBriefingSitesResult = {
  sites: BriefingSite[];
  error?: string;
};

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isValidEmail(value: unknown): value is string {
  return isNonEmptyString(value) && value.includes("@");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * env BRIEFING_SITES(JSON 배열 문자열)를 파싱한다.
 * - env 미설정/빈 문자열: sites: []
 * - JSON 파싱 실패, 또는 배열이 아님: sites: [], error 메시지
 * - 배열 원소 중 name/question/email(유효 이메일) 중 하나라도 없으면 그 원소만 제외한다
 *   (배열 전체를 무효화하지 않는다).
 */
export function parseBriefingSites(raw: string | undefined | null): ParseBriefingSitesResult {
  if (!isNonEmptyString(raw)) {
    return { sites: [] };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { sites: [], error: "BRIEFING_SITES가 유효한 JSON이 아닙니다." };
  }

  if (!Array.isArray(parsed)) {
    return { sites: [], error: "BRIEFING_SITES는 JSON 배열이어야 합니다." };
  }

  const sites: BriefingSite[] = parsed.flatMap((entry): BriefingSite[] => {
    if (!isRecord(entry)) return [];
    const { name, question, email } = entry;
    if (!isNonEmptyString(name) || !isNonEmptyString(question) || !isValidEmail(email)) return [];
    return [{ name: name.trim(), question: question.trim(), email: email.trim() }];
  });

  if (sites.length === 0) {
    return { sites, error: "BRIEFING_SITES에 유효한 사이트 항목이 없습니다." };
  }

  return { sites };
}

export type BriefingEmail = {
  subject: string;
  body: string;
};

function firstNonEmpty(...values: Array<string | undefined | null>): string {
  for (const value of values) {
    if (isNonEmptyString(value)) return value.trim();
  }
  return "";
}

const EVIDENCE_FILE_URL = "https://www.safeclaw.kr/evidence-file";

function documentPackLink(workpackId?: string | null): string {
  if (isNonEmptyString(workpackId)) {
    return `https://www.safeclaw.kr/documents?workpackId=${encodeURIComponent(workpackId)}`;
  }
  return EVIDENCE_FILE_URL;
}

/**
 * runAsk() 결과와 사이트명으로 아침 브리핑 이메일 제목/본문을 만든다.
 * workpackId를 주면(저장 성공 시) 문서팩 재열람 링크를, 없으면 방어 파일(evidence-file)
 * 링크를 안내한다.
 */
export function buildBriefingEmail(response: AskResponse, siteName: string, workpackId?: string | null): BriefingEmail {
  const subject = `오늘의 안전 브리핑 — ${siteName}`;

  const weatherSummary = firstNonEmpty(
    response.externalData?.weather?.summary,
    response.scenario?.weatherNote,
    "기상 신호 확인 전"
  );

  const topRisk = firstNonEmpty(response.riskSummary?.topRisk, "핵심 위험 요인 확인 전");
  const riskLevel = firstNonEmpty(response.riskSummary?.riskLevel, "-");

  const immediateActions = (response.riskSummary?.immediateActions || []).filter(isNonEmptyString);
  const actionsText = immediateActions.length
    ? immediateActions.map((action, index) => `${index + 1}. ${action}`).join("\n")
    : "1. 확인된 즉시 조치 없음 — 현장 브리핑 시 추가 확인 필요";

  const link = documentPackLink(workpackId);

  const body = [
    `${siteName} 오늘의 안전 브리핑입니다.`,
    "",
    "[기상 요약]",
    weatherSummary,
    "",
    "[핵심 판단]",
    `- 위험 수준: ${riskLevel}`,
    `- 핵심 위험: ${topRisk}`,
    "",
    "[즉시 조치]",
    actionsText,
    "",
    "[문서팩 링크]",
    link
  ].join("\n");

  return { subject, body };
}
