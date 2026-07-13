// 아침 자동 브리핑 — "시키지 않아도 출근하는 안전관리자" (SafeClaw 2 기둥 4).
//
// Vercel cron이 매일 06:00 KST에 app/api/briefing/run을 호출한다. 이 파일은 그 라우트가
// 쓰는 순수 로직만 모아둔다: 대상 사이트 목록 결정(DB 우선 → env 폴백), 생성된
// AskResponse로부터 이메일 제목/본문·n8n 전파 payload를 만드는 것.
// Supabase/네트워크 의존성 없음 — vitest로 바로 검증 가능.

import type { AskResponse } from "@/lib/types";
import {
  applyPhaseADocumentAuthorityMarker,
  assessPhaseAReviewAuthority,
  buildPhaseADocumentAuthorityMarker,
} from "@/lib/phase-a-review";

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

/** cron 1회 실행에서 처리할 최대 사이트 수 — Vercel maxDuration(300s) 타임아웃 보호. */
export const MAX_BRIEFING_SITES = 10;

/** sites 테이블에서 조회한 브리핑 설정 row (briefing_enabled=true 필터 후). */
export type BriefingSiteRow = {
  name: string | null;
  briefing_question: string | null;
  briefing_email: string | null;
};

/**
 * DB에서 조회한 briefing_enabled 사이트 row들을 BriefingSite로 정규화한다.
 * name/question/email(유효 이메일) 중 하나라도 비면 그 row만 제외한다 — env
 * parseBriefingSites와 동일한 관용 규칙.
 */
export function sitesFromBriefingRows(rows: readonly BriefingSiteRow[]): BriefingSite[] {
  return rows.flatMap((row): BriefingSite[] => {
    const { name, briefing_question: question, briefing_email: email } = row;
    if (!isNonEmptyString(name) || !isNonEmptyString(question) || !isValidEmail(email)) return [];
    return [{ name: name.trim(), question: question.trim(), email: email.trim() }];
  });
}

export type ResolveBriefingSitesResult = {
  sites: BriefingSite[];
  /** 어떤 소스가 채택됐는지 — 로그/응답 진단용. */
  source: "db" | "env" | "none";
  /** MAX_BRIEFING_SITES 상한으로 잘렸으면 true (라우트에서 경고 로그). */
  truncated: boolean;
  error?: string;
};

/**
 * 브리핑 대상 사이트 결정 로직: DB 우선, env 폴백.
 * - dbRows가 null(조회 실패/Supabase 미설정)이거나 유효 row 0건이면 env BRIEFING_SITES로
 *   폴백한다(하위호환).
 * - 어느 소스든 MAX_BRIEFING_SITES 상한을 적용하고 truncated로 알린다.
 */
export function resolveBriefingSites(
  dbRows: readonly BriefingSiteRow[] | null,
  envRaw: string | undefined | null
): ResolveBriefingSitesResult {
  if (dbRows) {
    const dbSites = sitesFromBriefingRows(dbRows);
    if (dbSites.length > 0) {
      return {
        sites: dbSites.slice(0, MAX_BRIEFING_SITES),
        source: "db",
        truncated: dbSites.length > MAX_BRIEFING_SITES
      };
    }
  }

  const parsed = parseBriefingSites(envRaw);
  return {
    sites: parsed.sites.slice(0, MAX_BRIEFING_SITES),
    source: parsed.sites.length > 0 ? "env" : "none",
    truncated: parsed.sites.length > MAX_BRIEFING_SITES,
    error: parsed.error
  };
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
  const phaseAAuthority = assessPhaseAReviewAuthority(response.phaseAReview);
  const phaseAReview = response.phaseAReview;
  const materializationCoverage = phaseAReview?.materializationCoverage;

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
    buildPhaseADocumentAuthorityMarker(response.phaseAReview),
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
    "[Phase A 근거 검토]",
    `- 상태: ${phaseAAuthority.authoritative ? "확인 완료" : "검토 필요"}`,
    `- 문서 반영 ${materializationCoverage?.materializedRecordCount ?? 0}/${materializationCoverage?.expectedRecordCount ?? 0}`,
    `- 미해결 stableKey ${materializationCoverage?.unresolvedStableKeys.length ?? 0}건`,
    `- 사람 확인 ${phaseAReview?.humanConfirmation.status === "confirmed" ? "완료" : "대기"}`,
    `- 다음 조치: ${phaseAAuthority.authoritative ? "확인된 범위에서 공유 가능" : phaseAReview?.actionableReason || phaseAAuthority.reason}`,
    "",
    "[문서팩 링크]",
    link
  ].join("\n");

  return { subject, body };
}

/**
 * n8n "safeguard.workpack.dispatch" 계약의 operatorNote를 만든다.
 * 형식: "[아침 자동 브리핑] {사이트명} — {기상 요약 1줄}".
 * 기상 요약이 여러 줄이면 첫 줄만 쓴다.
 */
export function buildBriefingOperatorNote(siteName: string, weatherSummary: string | undefined | null): string {
  const weather = firstNonEmpty(weatherSummary, "기상 신호 확인 전");
  const firstLine = weather.split("\n")[0].trim();
  return `[아침 자동 브리핑] ${siteName} — ${firstLine}`;
}

/**
 * n8n이 이미 처리하는 "safeguard.workpack.dispatch" 계약의 workpack 필드를 만든다.
 * components/WorkflowSharePanel.tsx buildBriefPayload(수동 현장 전파의 검증된 payload)와
 * 같은 shape를 유지해 n8n 워크플로우 무수정으로 재사용한다. message에는 브리핑 이메일
 * 본문을 넣는다(관리자 대상 한국어 브리핑).
 */
export function buildBriefingDispatchWorkpack(
  response: AskResponse,
  siteName: string,
  workpackId?: string | null
): Record<string, unknown> {
  const email = buildBriefingEmail(response, siteName, workpackId);
  const phaseAAuthority = assessPhaseAReviewAuthority(response.phaseAReview);
  const citations = response.citations.slice(0, 5);
  const kosha = response.externalData.kosha.references.slice(0, 3);
  const koshaEducation = response.externalData.koshaEducation.recommendations.slice(0, 3);
  const accidentCases = response.externalData.accidentCases.cases.slice(0, 3);
  const documentCopy = (body: string): string =>
    applyPhaseADocumentAuthorityMarker(body, response.phaseAReview);

  return {
    companyName: response.scenario.companyName,
    siteName,
    workSummary: response.scenario.workSummary,
    riskLevel: response.riskSummary.riskLevel,
    topRisk: response.riskSummary.topRisk,
    immediateActions: response.riskSummary.immediateActions,
    phaseAReview: response.phaseAReview,
    reviewAuthority: {
      authoritative: phaseAAuthority.authoritative,
      reason: phaseAAuthority.reason
    },
    message: email.body,
    messageTarget: "manager",
    messageLanguage: {
      code: "ko",
      label: "한국어",
      nativeLabel: "한국어"
    },
    documents: {
      workpackSummaryDraft: documentCopy(response.deliverables.workpackSummaryDraft),
      riskAssessmentDraft: documentCopy(response.deliverables.riskAssessmentDraft),
      workPlanDraft: documentCopy(response.deliverables.workPlanDraft),
      tbmBriefing: documentCopy(response.deliverables.tbmBriefing),
      tbmLogDraft: documentCopy(response.deliverables.tbmLogDraft),
      safetyEducationRecordDraft: documentCopy(response.deliverables.safetyEducationRecordDraft),
      emergencyResponseDraft: documentCopy(response.deliverables.emergencyResponseDraft),
      photoEvidenceDraft: documentCopy(response.deliverables.photoEvidenceDraft),
      foreignWorkerBriefing: documentCopy(response.deliverables.foreignWorkerBriefing),
      foreignWorkerTransmission: documentCopy(response.deliverables.foreignWorkerTransmission),
      foreignWorkerLanguages: response.deliverables.foreignWorkerLanguages
    },
    evidence: {
      authoritative: phaseAAuthority.authoritative,
      citations: phaseAAuthority.authoritative ? citations : [],
      weather: response.externalData.weather,
      training: response.externalData.training.recommendations.slice(0, 3),
      koshaEducation: phaseAAuthority.authoritative ? koshaEducation : [],
      kosha: phaseAAuthority.authoritative ? kosha : [],
      accidentCases: phaseAAuthority.authoritative ? accidentCases : [],
      diagnostic: phaseAAuthority.authoritative
        ? undefined
        : {
            citations,
            kosha,
            koshaEducation,
            accidentCases,
            ontologyQa: response.ontologyQa
          }
    },
    targetWorkers: [],
    status: response.status
  };
}
