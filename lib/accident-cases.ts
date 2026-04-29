import { AccidentCase, IntegrationMode } from "./types";

type AccidentCaseResult = {
  source: "kosha-accident";
  mode: IntegrationMode;
  detail: string;
  cases: AccidentCase[];
};

type JsonRecord = Record<string, unknown>;
type RankedAccidentCase = AccidentCase & { rank: number };
type ParseResult =
  | { kind: "ok"; cases: AccidentCase[]; detail: string }
  | { kind: "empty"; cases: []; detail: string }
  | { kind: "api_error" | "parse_error"; cases: []; detail: string };

type FetchOptions = {
  requestTimeoutMs?: number;
  retryCount?: number;
  budgetLabel?: string;
};

const serviceKey = process.env.DATA_GO_KR_SERVICE_KEY?.trim() || process.env.PUBLIC_DATA_API_KEY?.trim() || "";
const REQUEST_TIMEOUT_MS = 20_000;
const RETRY_COUNT = 1;
const FALLBACK_SOURCE_URL = "https://www.kosha.or.kr/kosha/data/industrialAccidentStatus.do";

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readString(record: JsonRecord, keys: string[]) {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number") return String(value);
  }
  return "";
}

function readArrayEnvelope(value: unknown): JsonRecord[] {
  if (Array.isArray(value)) return value.filter(isRecord);
  if (!isRecord(value)) return [];

  const candidates: unknown[] = [
    value.items,
    isRecord(value.items) ? value.items.item : undefined,
    isRecord(value.response) && isRecord(value.response.body) && isRecord(value.response.body.items) ? value.response.body.items.item : undefined,
    isRecord(value.body) && isRecord(value.body.items) ? value.body.items.item : undefined,
    value.data,
    value.list
  ];

  for (const candidate of candidates) {
    if (Array.isArray(candidate)) return candidate.filter(isRecord);
    if (isRecord(candidate)) return [candidate];
  }

  return [];
}

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchWithTimeout(url: string, timeoutMs: number) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      cache: "no-store",
      signal: controller.signal,
      headers: { accept: "application/json, text/plain;q=0.9, */*;q=0.8" }
    });
    const text = await response.text();
    if (!response.ok) {
      throw new Error(text.slice(0, 180) || `HTTP ${response.status}`);
    }
    return text;
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchWithRetry(url: string, options: Required<FetchOptions>) {
  let lastError: unknown;
  for (let attempt = 0; attempt <= options.retryCount; attempt += 1) {
    try {
      return await fetchWithTimeout(url, options.requestTimeoutMs);
    } catch (error) {
      lastError = error;
      if (attempt < options.retryCount) await wait(400);
    }
  }
  const message = lastError instanceof Error ? lastError.message : String(lastError);
  throw new Error(`${options.budgetLabel}: ${message}`);
}

function appendCommonParams(url: URL, question: string) {
  url.searchParams.set("pageNo", "1");
  url.searchParams.set("numOfRows", "100");
  url.searchParams.set("callApiId", "1060");
  url.searchParams.set("_type", "json");

  const keyword = pickKeyword(question);
  const business = pickBusiness(question);
  if (keyword) url.searchParams.set("keyword", keyword);
  if (business) url.searchParams.set("business", business);
}

function buildUrl(question: string, key: string) {
  const url = new URL("https://apis.data.go.kr/B552468/disaster_api02/getdisaster_api02");
  url.searchParams.set("serviceKey", key);
  appendCommonParams(url, question);
  return url.toString();
}

function buildRawServiceKeyUrl(question: string, key: string) {
  const url = new URL("https://apis.data.go.kr/B552468/disaster_api02/getdisaster_api02");
  appendCommonParams(url, question);
  const query = url.searchParams.toString();
  return `${url.origin}${url.pathname}?serviceKey=${key}&${query}`;
}

function safeDecodeServiceKey(key: string) {
  try {
    return decodeURIComponent(key);
  } catch (error) {
    console.warn("KOSHA accident service key decode failed", error);
    return key;
  }
}

function buildUrlCandidates(question: string) {
  const candidates = [
    { label: "urlsearchparams:raw", url: buildUrl(question, serviceKey) },
    { label: "raw-query:raw", url: buildRawServiceKeyUrl(question, serviceKey) }
  ];
  const decodedKey = safeDecodeServiceKey(serviceKey);
  if (decodedKey !== serviceKey) {
    candidates.push(
      { label: "urlsearchparams:decoded", url: buildUrl(question, decodedKey) },
      { label: "raw-query:decoded", url: buildRawServiceKeyUrl(question, decodedKey) }
    );
  }

  const seen = new Set<string>();
  return candidates.filter((candidate) => {
    if (seen.has(candidate.url)) return false;
    seen.add(candidate.url);
    return true;
  });
}

function pickKeyword(question: string) {
  const candidates = ["비계", "추락", "지게차", "충돌", "용접", "화재", "절단", "감전", "밀폐", "화학", "세척", "폭염", "온열"];
  return candidates.find((keyword) => question.includes(keyword)) || "산업재해";
}

function pickBusiness(question: string) {
  if (["건설", "비계", "추락", "외벽"].some((keyword) => question.includes(keyword))) return "건설업";
  if (["물류", "지게차", "상하차", "창고"].some((keyword) => question.includes(keyword))) return "운수창고업";
  if (["제조", "용접", "절단", "금속"].some((keyword) => question.includes(keyword))) return "제조업";
  if (["청소", "세척", "서비스"].some((keyword) => question.includes(keyword))) return "서비스업";
  return "";
}

function matchedReasonFor(question: string, item: AccidentCase) {
  const haystack = `${item.title} ${item.industry || ""} ${item.accidentType || ""} ${item.summary}`.toLowerCase();
  const tokens = question
    .toLowerCase()
    .split(/[\s,./()\-]+/)
    .map((token) => token.trim())
    .filter((token) => token.length >= 2);
  const matched = tokens.filter((token) => haystack.includes(token)).slice(0, 3);
  return matched.length
    ? `현재 입력의 ${matched.join(", ")} 키워드와 유사 재해사례를 연결했습니다.`
    : "현재 작업과 같은 산업안전 핵심 위험을 예방 포인트로 연결했습니다.";
}

function rankAccidentCase(question: string, item: AccidentCase): RankedAccidentCase {
  const normalized = question.toLowerCase();
  const haystack = `${item.title} ${item.industry || ""} ${item.accidentType || ""} ${item.summary}`.toLowerCase();
  const signals = [
    "비계",
    "추락",
    "떨어",
    "지게차",
    "충돌",
    "끼임",
    "용접",
    "절단",
    "화재",
    "폭발",
    "감전",
    "밀폐",
    "화학",
    "세척",
    "폭염",
    "온열"
  ];
  const matchedSignals = signals.filter((signal) => normalized.includes(signal) && haystack.includes(signal));
  const business = pickBusiness(question);
  const businessScore = business && item.industry?.includes(business.replace("운수창고업", "창고")) ? 8 : 0;
  const directScore = matchedSignals.length * 5;
  const titleScore = matchedSignals.filter((signal) => item.title.toLowerCase().includes(signal)).length * 3;

  return {
    ...item,
    rank: businessScore + directScore + titleScore
  };
}

function toAccidentCase(question: string, record: JsonRecord): AccidentCase | null {
  const title = readString(record, ["title", "accidentTitle", "sagoNm", "caseTitle", "keyword", "재해명", "사고명", "제목"]);
  const summary = readString(record, ["summary", "accidentContent", "sagoCn", "caseSummary", "contents", "content", "재해개요", "사고개요", "내용"]);
  const preventionPoint = readString(record, ["prevention", "preventCn", "preventiveMeasure", "preventionPoint", "예방대책", "재발방지대책"]);
  const industry = readString(record, ["industry", "business", "업종", "산업"]);
  const accidentType = readString(record, ["accidentType", "disasterType", "keyword", "재해유형", "사고유형"]);
  const sourceUrl = readString(record, ["sourceUrl", "url", "link", "상세URL"]);
  const boardNo = readString(record, ["boardno", "boardNo", "게시글번호"]);

  if (!title && !summary) return null;

  const item = {
    title: title || "KOSHA 국내재해사례",
    industry: industry || undefined,
    accidentType: accidentType || undefined,
    summary: summary || "KOSHA 국내재해사례 API에서 유사 재해사례를 확인했습니다.",
    preventionPoint: preventionPoint || "작업 전 위험요인 공유, 보호구 착용, 작업중지 기준 확인을 예방 포인트로 적용합니다.",
    sourceUrl: sourceUrl || (boardNo ? `https://www.kosha.or.kr/kosha/data/industrialAccidentStatus.do?mode=view&boardNo=${boardNo}` : FALLBACK_SOURCE_URL),
    matchedReason: ""
  };

  return {
    ...item,
    matchedReason: matchedReasonFor(question, item)
  };
}

export function selectFallbackAccidentCases(question: string): AccidentCase[] {
  const lower = question.toLowerCase();
  const fallback: AccidentCase[] = [
    {
      title: "이동식 비계 작업 중 추락 재해사례",
      industry: "건설업",
      accidentType: "추락",
      summary: "외벽·고소 작업에서 비계 고정, 난간, 바퀴 잠금 상태가 미흡하면 작업자가 추락하거나 비계가 전도될 수 있습니다.",
      preventionPoint: "작업 전 바퀴 잠금, 난간·발판 고정, 안전대 착용, 강풍 시 작업중지 기준을 TBM에서 복창합니다.",
      sourceUrl: FALLBACK_SOURCE_URL,
      matchedReason: "비계·추락·강풍 작업 조건과 직접 연결되는 예방 사례입니다."
    },
    {
      title: "지게차 후진 중 보행자 충돌 재해사례",
      industry: "물류업",
      accidentType: "충돌",
      summary: "상하차 구역에서 지게차 동선과 보행 동선이 겹치면 후진·회차 중 충돌 위험이 커집니다.",
      preventionPoint: "보행 동선 분리, 신호수 배치, 후진 경보 확인, 진입금지 구역 표시를 작업 전 확인합니다.",
      sourceUrl: FALLBACK_SOURCE_URL,
      matchedReason: "지게차·동선·상하차 키워드와 연결되는 유사 재해사례입니다."
    },
    {
      title: "용접 불티에 의한 화재 재해사례",
      industry: "제조업",
      accidentType: "화재",
      summary: "용접·절단 작업 중 비산불꽃이 가연물에 닿으면 작업장 화재와 화상 사고로 이어질 수 있습니다.",
      preventionPoint: "가연물 제거, 차폐막 설치, 소화기 배치, 화재감시자 지정, 작업 후 잔불 확인을 기록합니다.",
      sourceUrl: FALLBACK_SOURCE_URL,
      matchedReason: "용접·절단·화기작업의 예방 포인트와 연결됩니다."
    },
    {
      title: "세척 작업 중 화학물질 노출 및 미끄럼 재해사례",
      industry: "서비스업",
      accidentType: "화학물질·넘어짐",
      summary: "세척제 희석, 젖은 바닥, 환기 부족이 겹치면 눈·피부 노출과 미끄럼 사고가 동시에 발생할 수 있습니다.",
      preventionPoint: "MSDS 확인, 보안경·장갑 착용, 출입통제 표지, 환기, 이상 증상 발생 시 작업중지를 교육합니다.",
      sourceUrl: FALLBACK_SOURCE_URL,
      matchedReason: "화학세제·세척·외국인 신규 투입자 교육과 연결되는 사례입니다."
    },
    {
      title: "지하 기계실 점검 중 감전·미끄럼 재해사례",
      industry: "시설관리업",
      accidentType: "감전·넘어짐",
      summary: "누수와 습기가 있는 지하 기계실에서 전기설비를 점검하면 감전과 미끄럼 위험이 동시에 발생합니다.",
      preventionPoint: "차단·잠금표시, 절연 보호구, 2인 1조, 누수구역 표시와 배수 확인을 작업 전 조치합니다.",
      sourceUrl: FALLBACK_SOURCE_URL,
      matchedReason: "시설관리·지하·감전·누수 작업 조건과 연결됩니다."
    }
  ];

  if (["지게차", "물류", "상하차"].some((keyword) => lower.includes(keyword))) return [fallback[1], fallback[0], fallback[3]];
  if (["용접", "절단", "화기", "제조"].some((keyword) => lower.includes(keyword))) return [fallback[2], fallback[0], fallback[4]];
  if (["세척", "화학", "청소", "외국인"].some((keyword) => lower.includes(keyword))) return [fallback[3], fallback[1], fallback[0]];
  if (["기계실", "감전", "지하", "시설"].some((keyword) => lower.includes(keyword))) return [fallback[4], fallback[3], fallback[1]];
  return [fallback[0], fallback[1], fallback[2]];
}

function stripXmlForDetail(text: string) {
  return text
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 240);
}

function parseAccidentCases(question: string, text: string): ParseResult {
  const trimmed = text.trim();
  if (!trimmed) {
    return {
      kind: "empty",
      cases: [],
      detail: "KOSHA 국내재해사례 API 응답이 비어 있습니다."
    };
  }

  if (trimmed.startsWith("<")) {
    return {
      kind: "parse_error",
      cases: [],
      detail: `KOSHA 국내재해사례 API가 JSON이 아닌 XML/HTML 응답을 반환했습니다: ${stripXmlForDetail(trimmed)}`
    };
  }

  try {
    const parsed = JSON.parse(text) as unknown;
    if (isRecord(parsed)) {
      const header = isRecord(parsed.header)
        ? parsed.header
        : isRecord(parsed.response) && isRecord(parsed.response.header)
          ? parsed.response.header
          : undefined;
      const resultCode = header ? readString(header, ["resultCode", "returnReasonCode"]) : "";
      const resultMessage = header ? readString(header, ["resultMsg", "returnAuthMsg", "message"]) : "";
      if (resultCode && resultCode !== "00") {
        return {
          kind: "api_error",
          cases: [],
          detail: `KOSHA 국내재해사례 API 오류 응답: ${resultCode}${resultMessage ? ` / ${resultMessage}` : ""}`
        };
      }
    }

    const cases = readArrayEnvelope(parsed)
      .map((record) => toAccidentCase(question, record))
      .filter((item): item is AccidentCase => Boolean(item))
      .map((item) => rankAccidentCase(question, item))
      .sort((a, b) => b.rank - a.rank)
      .map(({ rank, ...item }) => item)
      .slice(0, 3);

    if (!cases.length) {
      return {
        kind: "empty",
        cases: [],
        detail: "KOSHA 국내재해사례 API 호출은 완료됐지만 응답에서 표시 가능한 사례를 찾지 못했습니다."
      };
    }

    return {
      kind: "ok",
      cases,
      detail: "KOSHA 국내재해사례 후보 API live 호출 성공. 유사 사례를 TBM과 교육 문구에 반영했습니다."
    };
  } catch {
    return {
      kind: "parse_error",
      cases: [],
      detail: `KOSHA 국내재해사례 API JSON 파싱 실패: ${trimmed.slice(0, 240)}`
    };
  }
}

export async function fetchAccidentCases(question: string, options: FetchOptions = {}): Promise<AccidentCaseResult> {
  const resolvedOptions: Required<FetchOptions> = {
    requestTimeoutMs: options.requestTimeoutMs ?? REQUEST_TIMEOUT_MS,
    retryCount: options.retryCount ?? RETRY_COUNT,
    budgetLabel: options.budgetLabel ?? "KOSHA accident case request"
  };

  if (!serviceKey) {
    return {
      source: "kosha-accident",
      mode: "fallback",
      detail: "DATA_GO_KR_SERVICE_KEY가 없어 KOSHA 국내재해사례 연결을 확인해야 합니다.",
      cases: selectFallbackAccidentCases(question)
    };
  }

  const failureDetails: string[] = [];
  try {
    const candidates = buildUrlCandidates(question);
    for (const candidate of candidates) {
      try {
        const text = await fetchWithRetry(candidate.url, {
          ...resolvedOptions,
          budgetLabel: `${resolvedOptions.budgetLabel} (${candidate.label})`
        });
        const parsed = parseAccidentCases(question, text);
        if (parsed.kind === "ok") {
          return {
            source: "kosha-accident",
            mode: "live",
            detail: `${parsed.detail} 연결 방식: ${candidate.label}`,
            cases: parsed.cases
          };
        }
        failureDetails.push(`${candidate.label}: ${parsed.detail}`);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        failureDetails.push(`${candidate.label}: ${message}`);
      }
    }

    return {
      source: "kosha-accident",
      mode: "fallback",
      detail: `KOSHA 국내재해사례 API 후보 호출이 모두 실패했습니다. ${failureDetails.join(" | ")} 기본 재해사례 근거로 전환했습니다.`,
      cases: selectFallbackAccidentCases(question)
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      source: "kosha-accident",
      mode: "fallback",
      detail: `KOSHA 국내재해사례 연결 점검 필요: ${message}`,
      cases: selectFallbackAccidentCases(question)
    };
  }
}
