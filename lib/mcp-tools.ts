// SafeClaw MCP 도구 계층의 순수 변환부.
//
// route.ts(app/api/mcp/[transport]/route.ts)는 인증·전송(Streamable HTTP)만 담당하고,
// 실제 lib 함수 호출 결과를 MCP 도구 응답으로 바꾸는 "순수 변환"은 이 모듈에 모은다.
// 여기에는 외부 호출(fetch/AI)이 없다 — 이미 얻은 결과 객체를 받아 도구 페이로드로
// 정형화만 한다. 덕분에 vitest로 스키마 절단·인용 게이트·에러 매핑을 순수 함수로 검증할 수 있다.

import type { AskResponse } from "./types";
import type { AccidentCase } from "./types";
import { gateCitations } from "./law-citation-gate";
import { sanitizeContacts, OFFICIAL_CONTACTS } from "./safety-contacts";
import { getEvidenceLabel, SMSA_ARTICLE_MAP, type SmsaEvidenceLabel } from "./smsa-mapping";
import type { KnowledgeResult } from "./ontology/query";
import type { OntologyNode } from "./ontology/schema";

/** MCP 도구가 반환하는 CallToolResult의 최소 형태 (SDK 타입과 호환). */
export type McpToolResult = {
  content: Array<{ type: "text"; text: string }>;
  isError?: boolean;
};

/** 임의의 JSON 직렬화 가능한 페이로드를 텍스트 콘텐츠 도구 응답으로 감싼다. */
export function toToolResult(payload: unknown): McpToolResult {
  return { content: [{ type: "text", text: JSON.stringify(payload, null, 2) }] };
}

/** 도구 실행 실패를 MCP 오류 응답(isError)으로 매핑한다. */
export function toToolError(error: unknown): McpToolResult {
  const message = error instanceof Error ? error.message : String(error);
  return {
    content: [{ type: "text", text: JSON.stringify({ error: message }, null, 2) }],
    isError: true,
  };
}

// ── generate_safety_docpack ───────────────────────────────────────────────

const DOCPACK_PREVIEW_CHARS = 500;

/**
 * AskResponse.deliverables 중 산문 문자열 문서 필드. 프리뷰(앞 500자 + 총길이)의
 * 대상이며, 각 키는 get_evidence_mapping / evidenceLabels와 같은 키 공간을 쓴다.
 */
const DOCPACK_DOCUMENT_KEYS = [
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
  "kakaoMessage",
] as const;

export type DocpackDocumentPreview = {
  preview: string;
  totalLength: number;
  truncated: boolean;
};

export type DocpackResult = {
  summary: string;
  scenario: AskResponse["scenario"];
  mode: AskResponse["mode"];
  evidenceLabels?: Record<string, SmsaEvidenceLabel>;
  documents: Record<string, DocpackDocumentPreview | string>;
  fullDocumentsNote: string;
};

/**
 * runAsk 결과를 문서팩 도구 응답으로 정형화한다.
 * - includeFull=false(기본): 각 문서는 앞 500자 프리뷰 + 총길이 메타만.
 * - includeFull=true: 각 문서 전체 본문.
 */
export function buildDocpackResult(response: AskResponse, includeFull = false): DocpackResult {
  const deliverables = response.deliverables as unknown as Record<string, unknown>;
  const documents: Record<string, DocpackDocumentPreview | string> = {};

  for (const key of DOCPACK_DOCUMENT_KEYS) {
    const value = deliverables[key];
    if (typeof value !== "string" || value.length === 0) continue;
    if (includeFull) {
      documents[key] = value;
    } else {
      documents[key] = {
        preview: value.slice(0, DOCPACK_PREVIEW_CHARS),
        totalLength: value.length,
        truncated: value.length > DOCPACK_PREVIEW_CHARS,
      };
    }
  }

  const result: DocpackResult = {
    summary: response.status.summary,
    scenario: response.scenario,
    mode: response.mode,
    documents,
    fullDocumentsNote: includeFull
      ? "전체 문서 본문이 포함되었습니다."
      : "각 문서는 앞 500자 프리뷰입니다. 전체 본문이 필요하면 includeFull=true로 다시 호출하세요.",
  };
  if (response.evidenceLabels) {
    result.evidenceLabels = response.evidenceLabels;
  }
  return result;
}

// ── validate_safety_citations ─────────────────────────────────────────────

// 조문/별표 인용 토큰: "제38조", "제241조의2", "별표4 제3호" 형태.
const CITATION_TOKEN_RE = /별표\s*\d+\s*제\d+호|제\d+조(?:의\d+)?/g;

function extractCitationTokens(text: string): string[] {
  return text.match(CITATION_TOKEN_RE) ?? [];
}

export type ValidateCitationsResult = {
  gatedText: string;
  removedCitations: string[];
};

/**
 * law-citation-gate로 초안을 검증하고, 화이트리스트에 없어 일반 문구로 치환된
 * 인용 토큰 목록을 함께 반환한다. removedCitations는 입력에는 있으나 게이트 통과
 * 텍스트에는 사라진 조문/별표 인용을 입력 등장 순서대로 담는다.
 */
export function validateCitations(text: string): ValidateCitationsResult {
  const gatedText = gateCitations(text);
  const before = extractCitationTokens(text);
  const after = extractCitationTokens(gatedText);

  const afterCounts = new Map<string, number>();
  for (const token of after) afterCounts.set(token, (afterCounts.get(token) ?? 0) + 1);

  const removedCitations: string[] = [];
  for (const token of before) {
    const remaining = afterCounts.get(token) ?? 0;
    if (remaining > 0) {
      afterCounts.set(token, remaining - 1);
    } else {
      removedCitations.push(token);
    }
  }
  return { gatedText, removedCitations };
}

// ── sanitize_emergency_contacts ───────────────────────────────────────────

export type SanitizeContactsResult = {
  sanitizedText: string;
  changed: boolean;
  officialContacts: typeof OFFICIAL_CONTACTS;
};

/**
 * 초안에서 기관명+전화번호 조합을 중립 플레이스홀더로 치환하고, 공식 화이트리스트
 * 연락처(119 / 근로복지공단 / 안전보건공단 / 고용노동부)를 함께 반환한다.
 */
export function buildSanitizeContactsResult(text: string): SanitizeContactsResult {
  const sanitizedText = sanitizeContacts(text);
  return {
    sanitizedText,
    changed: sanitizedText !== text,
    officialContacts: OFFICIAL_CONTACTS,
  };
}

// ── get_weather_signals ───────────────────────────────────────────────────

// WeatherSignal 타입은 lib/weather.ts 내부에 있어 export되지 않으므로, 도구가
// 노출하는 필드만 구조적으로 받는다(전체를 그대로 통과시키지 않고 요약).
export type WeatherSignalLike = {
  source: string;
  mode: string;
  locationLabel: string;
  summary: string;
  forecastTime?: string;
  temperatureC?: string;
  windSpeedMps?: string;
  precipitationProbability?: string;
  actions: string[];
  detail: string;
  signals: Array<{ endpoint: string; mode: string; summary: string }>;
};

export type WeatherResult = {
  region: string;
  mode: string;
  summary: string;
  temperatureC?: string;
  windSpeedMps?: string;
  precipitationProbability?: string;
  actions: string[];
  signals: Array<{ endpoint: string; mode: string; summary: string }>;
  requestedRegion: string;
  resolvedRegion: string;
  fallbackRegion: boolean;
};

// lib/weather.ts의 pickLocation()이 실제로 매칭하는 지역 키워드를 여기서 그대로
// 복제한다(pickLocation 자체는 export되지 않고, weather.ts는 이 작업 범위에서
// 수정 금지). 요청 지역명이 아래 키워드 중 어느 것과도 매칭되지 않으면
// pickLocation은 기본값(서울)으로 폴백한다 — 이 판정을 wrapper에서 재현한다.
// 지원 지역: 서울/인천/안산/부산/광주/대구/창원.
const SUPPORTED_WEATHER_REGIONS: Array<{ label: string; keywords: string[] }> = [
  { label: "서울", keywords: ["성수", "강남", "서울", "강남 복합건물"] },
  { label: "인천", keywords: ["인천", "남동"] },
  { label: "안산", keywords: ["안산", "경기"] },
  { label: "부산", keywords: ["부산", "해운대"] },
  { label: "광주", keywords: ["광주", "하남산단"] },
  { label: "대구", keywords: ["대구", "달서"] },
  { label: "창원", keywords: ["창원"] },
];

/**
 * 요청 지역명이 지원 지역 키워드 중 하나라도 매칭되는지 판정한다.
 * 매칭되지 않으면 lib/weather.ts의 pickLocation()이 기본값(서울)으로 폴백한다.
 */
export function isSupportedWeatherRegion(region: string): boolean {
  const normalized = region.toLowerCase();
  return SUPPORTED_WEATHER_REGIONS.some((entry) =>
    entry.keywords.some((keyword) => normalized.includes(keyword.toLowerCase()))
  );
}

/** fetchWeatherSignal 결과를 실황·특보 요약 도구 응답으로 정형화한다. */
export function buildWeatherResult(region: string, signal: WeatherSignalLike): WeatherResult {
  const resolvedRegion = signal.locationLabel || region;
  const fallbackRegion = !isSupportedWeatherRegion(region);
  return {
    region: resolvedRegion,
    mode: signal.mode,
    summary: signal.summary,
    temperatureC: signal.temperatureC,
    windSpeedMps: signal.windSpeedMps,
    precipitationProbability: signal.precipitationProbability,
    actions: signal.actions,
    signals: (signal.signals ?? []).map((s) => ({
      endpoint: s.endpoint,
      mode: s.mode,
      summary: s.summary,
    })),
    requestedRegion: region,
    resolvedRegion,
    fallbackRegion,
  };
}

// ── search_accident_cases ─────────────────────────────────────────────────

export type AccidentCaseSummary = {
  title: string;
  industry?: string;
  accidentType?: string;
  summary: string;
  preventionPoint: string;
  sourceUrl?: string;
  matchedReason: string;
};

export type AccidentCasesResult = {
  keyword: string;
  mode: string;
  count: number;
  cases: AccidentCaseSummary[];
};

/** fetchAccidentCases 결과를 유사 재해사례 요약 도구 응답으로 정형화한다. */
export function buildAccidentCasesResult(
  keyword: string,
  result: { mode: string; cases: AccidentCase[] }
): AccidentCasesResult {
  return {
    keyword,
    mode: result.mode,
    count: result.cases.length,
    cases: result.cases.map((c) => ({
      title: c.title,
      industry: c.industry,
      accidentType: c.accidentType,
      summary: c.summary,
      preventionPoint: c.preventionPoint,
      sourceUrl: c.sourceUrl,
      matchedReason: c.matchedReason,
    })),
  };
}

// ── get_evidence_mapping ──────────────────────────────────────────────────

export type EvidenceMappingResult = {
  docType?: string;
  label?: SmsaEvidenceLabel;
  mapped: boolean;
  allMappings?: Record<string, SmsaEvidenceLabel>;
  note: string;
};

/**
 * 중대재해처벌법 시행령 제4조 증빙 매핑을 반환한다.
 * - docType 지정 시: 해당 문서 타입의 라벨(없으면 mapped=false).
 * - docType 미지정 시: 전체 매핑 테이블.
 */
export function buildEvidenceMappingResult(docType?: string): EvidenceMappingResult {
  if (docType && docType.length > 0) {
    const label = getEvidenceLabel(docType);
    return {
      docType,
      label: label ?? undefined,
      mapped: label !== null,
      note:
        label !== null
          ? "중대재해처벌법 시행령 제4조 증빙 라벨입니다."
          : "이 문서 타입은 시행령 제4조 조항과 직접 대응되지 않습니다(요약/허가서 등).",
    };
  }
  return {
    mapped: true,
    allMappings: { ...SMSA_ARTICLE_MAP },
    note: "문서 타입 → 중대재해처벌법 시행령 제4조 증빙 라벨 전체 매핑입니다.",
  };
}

// ── query_safety_knowledge ────────────────────────────────────────────────

/** 안전 지식 그래프 조회 결과의 출처 표기(고정 문자열). */
export const ONTOLOGY_PROVENANCE = "법제처 검증 시드 v1";

export type KnowledgeArticleView = {
  label: string;
  articleNo?: string;
  law?: string;
};

export type KnowledgeControlView = {
  control: string;
  articles: string[];
};

/** duties가 단독 충족이 아니라 이행 증빙의 일부임을 명시하는 고정 문구. */
export const DUTIES_NOTE =
  "각 의무는 해당 문서·조문이 이행 증빙의 일부(단독 충족 아님)라는 의미이며, 중처법 의무의 완전한 이행은 안전보건관리체계 전반의 구축·이행으로 판단합니다.";

export type SafetyKnowledgeFound = {
  found: true;
  matchedBy: "task" | "hazard";
  task: string | null;
  hazards: string[];
  controls: KnowledgeControlView[];
  articles: KnowledgeArticleView[];
  accidents: string[];
  duties: string[];
  dutiesNote: string;
  provenance: string;
};

export type SafetyKnowledgeNotFound = {
  found: false;
  message: string;
  registeredTasks: string[];
};

export type SafetyKnowledgeResult = SafetyKnowledgeFound | SafetyKnowledgeNotFound;

function articleView(node: OntologyNode): KnowledgeArticleView {
  const meta = node.meta as Record<string, unknown>;
  const articleNo = typeof meta.article_no === "string" ? meta.article_no : undefined;
  const law = typeof meta.law === "string" ? meta.law : undefined;
  return { label: node.label, articleNo, law };
}

/**
 * queryKnowledge 결과를 query_safety_knowledge 도구 페이로드로 정형화한다.
 * - 매칭 성공: task/hazards/controls(각 조문 병기)/articles(조번호+제목)/accidents/duties + provenance.
 * - 매칭 실패(result=null): "미등록 작업유형" 안내 + 등록된 Task 라벨 목록.
 */
export function buildSafetyKnowledgeResult(
  query: string,
  result: KnowledgeResult | null,
  registeredTasks: string[]
): SafetyKnowledgeResult {
  if (!result) {
    return {
      found: false,
      message: `'${query}'은(는) 등록된 작업유형·위험요인이 아닙니다. 아래 등록된 작업유형 중 하나로 다시 조회하거나, 검증된 조문 없이 답할 때는 validate_safety_citations로 자체 검증하세요.`,
      registeredTasks,
    };
  }
  return {
    found: true,
    matchedBy: result.matchedBy,
    task: result.task?.label ?? null,
    hazards: result.hazards.map((h) => h.label),
    controls: result.controls.map((c) => ({
      control: c.control.label,
      articles: c.articles.map((a) => a.label),
    })),
    articles: result.articles.map(articleView),
    accidents: result.accidents.map((a) => a.label),
    duties: result.duties.map((d) => d.label),
    dutiesNote: DUTIES_NOTE,
    provenance: ONTOLOGY_PROVENANCE,
  };
}
