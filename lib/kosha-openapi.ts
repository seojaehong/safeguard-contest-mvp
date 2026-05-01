import { IntegrationMode } from "./types";

type JsonRecord = Record<string, unknown>;

export type KoshaOpenApiEvidence = {
  source: "kosha-openapi";
  mode: IntegrationMode;
  detail: string;
  references: Array<{
    title: string;
    service: "안전보건법령 스마트검색" | "안전보건자료 링크" | "MSDS" | "건설업 일별 중대재해";
    summary: string;
    url: string;
    reflectedIn: string[];
  }>;
};

type KoshaOpenApiReference = KoshaOpenApiEvidence["references"][number];

const serviceKey = process.env.DATA_GO_KR_SERVICE_KEY?.trim() || process.env.PUBLIC_DATA_API_KEY?.trim() || "";
const REQUEST_TIMEOUT_MS = 8_000;
const KOSHA_SMART_SEARCH_URL = "http://apis.data.go.kr/B552468/srch/smartSearch";
const KOSHA_MEDIA_URL = "https://apis.data.go.kr/B552468/selectMediaList01/getselectMediaList01";
const KOSHA_CONSTRUCTION_DAILY_URL = "https://apis.data.go.kr/B552468/constDsstr01/getconstDsstr01";

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
    isRecord(value.response) && isRecord(value.response.body) ? value.response.body.total_media : undefined,
    isRecord(value.body) && isRecord(value.body.items) ? value.body.items.item : undefined,
    isRecord(value.body) ? value.body.total_media : undefined,
    value.data,
    value.list,
    value.result
  ];

  for (const candidate of candidates) {
    if (Array.isArray(candidate)) return candidate.filter(isRecord);
    if (isRecord(candidate)) return [candidate];
  }

  return [];
}

function pickKeyword(question: string) {
  const candidates = ["보호구", "비계", "추락", "지게차", "끼임", "용접", "화재", "밀폐공간", "감전", "MSDS", "세척제", "화학물질"];
  return candidates.find((keyword) => question.includes(keyword)) || "위험성평가";
}

function stripMarkup(value: string) {
  return value
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function pickSmartSearchCategory(question: string) {
  if (["중대재해", "중대재해처벌"].some((keyword) => question.includes(keyword))) return "8";
  if (["가이드", "KOSHA GUIDE", "지침", "작업지침"].some((keyword) => question.includes(keyword))) return "7";
  if (["교육", "자료", "외국인", "다국어", "동영상", "PPT"].some((keyword) => question.includes(keyword))) return "6";
  return "0";
}

function pickMediaIndustryCode(question: string) {
  if (["건설", "비계", "추락", "외벽"].some((keyword) => question.includes(keyword))) return "3";
  if (["제조", "용접", "절단", "금속", "화학"].some((keyword) => question.includes(keyword))) return "2";
  if (["물류", "창고", "서비스", "청소", "시설", "세척"].some((keyword) => question.includes(keyword))) return "4";
  return "1";
}

function pickMediaAccidentTypeCode(question: string) {
  if (["추락", "떨어", "비계", "고소"].some((keyword) => question.includes(keyword))) return "11000001";
  if (["끼임", "협착", "지게차"].some((keyword) => question.includes(keyword))) return "11000007";
  if (["충돌", "부딪", "동선"].some((keyword) => question.includes(keyword))) return "11000004";
  if (["깔림", "전도", "뒤집"].some((keyword) => question.includes(keyword))) return "11000003";
  if (["화재", "용접", "불티"].some((keyword) => question.includes(keyword))) return "11000011";
  if (["폭발", "파열"].some((keyword) => question.includes(keyword))) return "11000010";
  if (["감전", "전기"].some((keyword) => question.includes(keyword))) return "11000009";
  if (["넘어짐", "미끄럼", "우천"].some((keyword) => question.includes(keyword))) return "11000002";
  if (["화학", "세척제", "물질", "MSDS"].some((keyword) => question.includes(keyword))) return "11000014";
  if (["절단", "베임", "찔림"].some((keyword) => question.includes(keyword))) return "11000008";
  if (["무리한", "수작업", "중량", "박스", "근골격"].some((keyword) => question.includes(keyword))) return "11000012";
  return "";
}

function pickForeignLanguageCode(question: string) {
  if (["베트남", "vietnam"].some((keyword) => question.toLowerCase().includes(keyword.toLowerCase()))) return "6200110";
  if (["중국", "china", "chinese"].some((keyword) => question.toLowerCase().includes(keyword.toLowerCase()))) return "6130110";
  if (["몽골", "mongol"].some((keyword) => question.toLowerCase().includes(keyword.toLowerCase()))) return "6150110";
  if (["태국", "thai"].some((keyword) => question.toLowerCase().includes(keyword.toLowerCase()))) return "6180110";
  if (["우즈벡", "uzbek"].some((keyword) => question.toLowerCase().includes(keyword.toLowerCase()))) return "6190110";
  if (["외국인", "다국어", "foreign"].some((keyword) => question.toLowerCase().includes(keyword.toLowerCase()))) return "6200110";
  return "";
}

function isConstructionScenario(question: string) {
  return ["건설", "비계", "추락", "외벽", "고소", "슬라브", "굴착", "철근", "콘크리트"].some((keyword) => question.includes(keyword));
}

function toYyyymmdd(date: Date) {
  return `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, "0")}${String(date.getDate()).padStart(2, "0")}`;
}

function kstDateOffset(days: number) {
  const now = new Date();
  const utc = now.getTime() + now.getTimezoneOffset() * 60_000;
  const kst = new Date(utc + 9 * 60 * 60_000);
  kst.setDate(kst.getDate() + days);
  return toYyyymmdd(kst);
}

function pickChemicalKeyword(question: string) {
  const candidates = ["톨루엔", "아세톤", "메탄올", "에탄올", "염산", "수산화나트륨", "세척제", "페인트", "신나"];
  return candidates.find((keyword) => question.includes(keyword)) || "";
}

async function fetchText(url: string) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      cache: "no-store",
      signal: controller.signal,
      headers: { accept: "application/json, application/xml;q=0.9, text/plain;q=0.8, */*;q=0.7" }
    });
    const text = await response.text();
    if (!response.ok) {
      throw new Error(text.slice(0, 160) || `HTTP ${response.status}`);
    }
    return text;
  } finally {
    clearTimeout(timeout);
  }
}

function parseJsonRecords(text: string) {
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
        return { records: [], detail: `${resultCode}${resultMessage ? ` / ${resultMessage}` : ""}` };
      }
    }
    return { records: readArrayEnvelope(parsed), detail: "정상 응답" };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { records: [], detail: `JSON 파싱 실패: ${message}` };
  }
}

function parseJsonRecordsWithBody(text: string) {
  try {
    const parsed = JSON.parse(text) as unknown;
    const base = parseJsonRecords(text);
    if (base.records.length) return base;
    if (isRecord(parsed) && isRecord(parsed.body)) {
      return {
        records: readArrayEnvelope(parsed.body),
        detail: "정상 응답"
      };
    }
    return base;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { records: [], detail: `JSON 파싱 실패: ${message}` };
  }
}

function parseXmlItems(text: string) {
  const itemMatches = [...text.matchAll(/<item>([\s\S]*?)<\/item>/g)];
  return itemMatches.map((match) => {
    const body = match[1] || "";
    const record: JsonRecord = {};
    [...body.matchAll(/<([A-Za-z0-9_]+)>([\s\S]*?)<\/\1>/g)].forEach((item) => {
      record[item[1]] = item[2].replace(/<!\[CDATA\[|\]\]>/g, "").trim();
    });
    return record;
  });
}

type KoshaOpenApiFetchResult = KoshaOpenApiReference[] | { detail: string };

async function fetchSmartSearch(question: string): Promise<KoshaOpenApiFetchResult> {
  const keyword = pickKeyword(question);
  const url = new URL(KOSHA_SMART_SEARCH_URL);
  url.searchParams.set("serviceKey", serviceKey);
  url.searchParams.set("pageNo", "1");
  url.searchParams.set("numOfRows", "5");
  url.searchParams.set("searchValue", keyword);
  url.searchParams.set("category", pickSmartSearchCategory(question));

  try {
    const parsed = parseJsonRecords(await fetchText(url.toString()));
    if (!parsed.records.length) return { detail: `smartSearch searchValue=${keyword}: ${parsed.detail}` };
    return parsed.records.slice(0, 2).map((record) => ({
      title: readString(record, ["title", "ttl", "sj", "lawNm", "guideNm"]) || `KOSHA 스마트검색: ${keyword}`,
      service: "안전보건법령 스마트검색" as const,
      summary: stripMarkup(readString(record, ["summary", "contents", "cn", "content", "desc", "highlight_content"])) || "KOSHA 안전보건법령 스마트검색에서 관련 자료를 확인했습니다.",
      url: readString(record, ["filepath", "url", "link", "detailUrl"]) || KOSHA_SMART_SEARCH_URL,
      reflectedIn: ["문서 반영 근거", "위험성평가표", "TBM"]
    }));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { detail: `smartSearch searchValue=${keyword}: ${message}` };
  }
}

async function fetchSafetyMedia(question: string): Promise<KoshaOpenApiFetchResult> {
  const accidentTypeCode = pickMediaAccidentTypeCode(question);
  const languageCode = pickForeignLanguageCode(question);
  const url = new URL(KOSHA_MEDIA_URL);
  url.searchParams.set("serviceKey", serviceKey);
  url.searchParams.set("pageNo", "1");
  url.searchParams.set("numOfRows", "5");
  url.searchParams.set("_type", "json");
  url.searchParams.set("ctgr01", "12");
  url.searchParams.set("ctgr02", pickMediaIndustryCode(question));
  if (accidentTypeCode) url.searchParams.set("ctgr03", accidentTypeCode);
  if (languageCode) url.searchParams.set("ctgr04", languageCode);
  url.searchParams.set("ctgr04_kr", "Y");

  try {
    const parsed = parseJsonRecords(await fetchText(url.toString()));
    if (!parsed.records.length) return { detail: parsed.detail };
    return parsed.records.slice(0, 2).map((record) => ({
      title: readString(record, ["title", "ttl", "mediaTitle", "sj", "dataNm", "name"]) || "KOSHA 안전보건자료",
      service: "안전보건자료 링크" as const,
      summary: stripMarkup(readString(record, ["summary", "contents", "desc", "mediaCn", "cont", "dataCn"])) || "KOSHA 안전보건자료 링크 서비스에서 관련 자료를 확인했습니다.",
      url: readString(record, ["url", "link", "mediaUrl", "fileUrl", "filepath"]) || KOSHA_MEDIA_URL,
      reflectedIn: ["안전보건교육 기록", "외국인 근로자 출력본", "문서 반영 근거"]
    }));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { detail: message };
  }
}

async function fetchMsds(question: string): Promise<KoshaOpenApiFetchResult> {
  const chemical = pickChemicalKeyword(question);
  if (!chemical) return { detail: "화학물질 키워드가 없어 MSDS 호출을 건너뜁니다." };

  const params = ["chemNm", "chemName", "searchWrd", "keyword"];
  const details: string[] = [];
  for (const param of params) {
    const url = new URL("https://apis.data.go.kr/B552468/msdschem/getChemList");
    url.searchParams.set("serviceKey", serviceKey);
    url.searchParams.set("pageNo", "1");
    url.searchParams.set("numOfRows", "5");
    url.searchParams.set(param, chemical);
    try {
      const text = await fetchText(url.toString());
      const records = parseXmlItems(text);
      if (records.length) {
        return records.slice(0, 2).map((record) => ({
          title: readString(record, ["chemNm", "chemName", "chemKorNm", "name"]) || `MSDS: ${chemical}`,
          service: "MSDS" as const,
          summary: "KOSHA 물질안전보건자료 목록에서 화학물질 정보를 확인했습니다.",
          url: "https://apis.data.go.kr/B552468/msdschem/getChemList",
          reflectedIn: ["위험성평가표", "안전보건교육 기록", "비상대응 절차"]
        }));
      }
      details.push(`${param}: 응답 항목 없음`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      details.push(`${param}: ${message}`);
    }
  }

  return { detail: details.join(" | ") };
}

async function fetchConstructionDailyDisaster(question: string): Promise<KoshaOpenApiFetchResult> {
  if (!isConstructionScenario(question)) {
    return { detail: "건설업 작업 키워드가 없어 건설업 일별 중대재해 현황 호출을 건너뜁니다." };
  }

  const candidateDates = [
    ...Array.from({ length: 14 }, (_, index) => kstDateOffset(-index)),
    "20190827"
  ];
  const details: string[] = [];

  for (const dsstrDy of candidateDates) {
    const url = new URL(KOSHA_CONSTRUCTION_DAILY_URL);
    url.searchParams.set("serviceKey", serviceKey);
    url.searchParams.set("pageNo", "1");
    url.searchParams.set("numOfRows", "5");
    url.searchParams.set("callApiId", "1010");
    url.searchParams.set("dsstrDy", dsstrDy);

    try {
      const parsed = parseJsonRecordsWithBody(await fetchText(url.toString()));
      if (!parsed.records.length) {
        details.push(`${dsstrDy}: ${parsed.detail}, 항목 없음`);
        continue;
      }

      return parsed.records.slice(0, 2).map((record) => {
        const disasterType = readString(record, ["dsstrKndNm", "disasterType", "재해유형"]);
        const workProcess = readString(record, ["jobPrcsNm", "dtlJobPrcsNm", "작업공정"]);
        const place = readString(record, ["ocmtNm", "place", "발생장소"]);
        const detail = readString(record, ["dsstrDtlCn", "contents", "내용"]);
        const prevention = readString(record, ["rsknsDcrsMsrsCn", "prevention", "감소대책"]);

        return {
          title: `건설업 일별 중대재해 ${disasterType || "현황"}${workProcess ? ` · ${workProcess}` : ""}`,
          service: "건설업 일별 중대재해" as const,
          summary: stripMarkup([
            place ? `장소: ${place}` : "",
            detail ? `사례: ${detail}` : "",
            prevention ? `감소대책: ${prevention}` : ""
          ].filter(Boolean).join(" / ")) || "KOSHA 건설업 일별 중대재해 현황에서 작업 관련 중대재해 사례를 확인했습니다.",
          url: KOSHA_CONSTRUCTION_DAILY_URL,
          reflectedIn: ["위험성평가표", "TBM", "비상대응 절차", "문서 반영 근거"]
        };
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      details.push(`${dsstrDy}: ${message}`);
    }
  }

  return { detail: `건설업 일별 중대재해 현황 표시 항목 없음. ${details.slice(0, 5).join(" / ")}` };
}

export async function fetchKoshaOpenApiEvidence(question: string): Promise<KoshaOpenApiEvidence> {
  if (!serviceKey) {
    return {
      source: "kosha-openapi",
      mode: "fallback",
      detail: "DATA_GO_KR_SERVICE_KEY가 없어 KOSHA 세부 OpenAPI 연결을 확인해야 합니다.",
      references: []
    };
  }

  const [smartSearch, media, msds, constructionDaily] = await Promise.all([
    fetchSmartSearch(question),
    fetchSafetyMedia(question),
    fetchMsds(question),
    fetchConstructionDailyDisaster(question)
  ]);
  const references = [smartSearch, media, msds, constructionDaily]
    .flatMap((item): KoshaOpenApiReference[] => Array.isArray(item) ? item : [])
    .slice(0, 5);
  const details = [smartSearch, media, msds, constructionDaily]
    .filter((item): item is { detail: string } => !Array.isArray(item))
    .map((item) => item.detail)
    .filter(Boolean);

  return {
    source: "kosha-openapi",
    mode: references.length ? "live" : "fallback",
    detail: references.length
      ? `KOSHA 세부 OpenAPI ${references.length}건을 문서 반영 근거로 연결했습니다.${details.length ? ` 보류 상세: ${details.join(" / ")}` : ""}`
      : `KOSHA 세부 OpenAPI 호출은 수행했지만 표시 가능한 항목이 없습니다. ${details.join(" / ")}`,
    references
  };
}
