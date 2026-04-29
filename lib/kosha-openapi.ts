import { IntegrationMode } from "./types";

type JsonRecord = Record<string, unknown>;

export type KoshaOpenApiEvidence = {
  source: "kosha-openapi";
  mode: IntegrationMode;
  detail: string;
  references: Array<{
    title: string;
    service: "안전보건법령 스마트검색" | "안전보건자료 링크" | "MSDS";
    summary: string;
    url: string;
    reflectedIn: string[];
  }>;
};

type KoshaOpenApiReference = KoshaOpenApiEvidence["references"][number];

const serviceKey = process.env.DATA_GO_KR_SERVICE_KEY?.trim() || process.env.PUBLIC_DATA_API_KEY?.trim() || "";
const REQUEST_TIMEOUT_MS = 8_000;

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
  const params = ["keyword", "searchKeyword", "srchWrd", "query"];
  const details: string[] = [];

  for (const param of params) {
    const url = new URL("https://apis.data.go.kr/B552468/srch/smartSearch");
    url.searchParams.set("serviceKey", serviceKey);
    url.searchParams.set("pageNo", "1");
    url.searchParams.set("numOfRows", "5");
    url.searchParams.set("_type", "json");
    url.searchParams.set(param, keyword);
    try {
      const parsed = parseJsonRecords(await fetchText(url.toString()));
      if (parsed.records.length) {
        return parsed.records.slice(0, 2).map((record) => ({
          title: readString(record, ["title", "ttl", "sj", "lawNm", "guideNm"]) || `KOSHA 스마트검색: ${keyword}`,
          service: "안전보건법령 스마트검색" as const,
          summary: readString(record, ["summary", "contents", "cn", "content", "desc"]) || "KOSHA 안전보건법령 스마트검색에서 관련 자료를 확인했습니다.",
          url: readString(record, ["url", "link", "detailUrl"]) || "https://apis.data.go.kr/B552468/srch/smartSearch",
          reflectedIn: ["문서 반영 근거", "위험성평가표", "TBM"]
        }));
      }
      details.push(`${param}: ${parsed.detail}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      details.push(`${param}: ${message}`);
    }
  }

  return { detail: details.join(" | ") };
}

async function fetchSafetyMedia(question: string): Promise<KoshaOpenApiFetchResult> {
  const keyword = pickKeyword(question);
  const url = new URL("https://apis.data.go.kr/B552468/selectMediaList01/getselectMediaList01");
  url.searchParams.set("serviceKey", serviceKey);
  url.searchParams.set("pageNo", "1");
  url.searchParams.set("numOfRows", "5");
  url.searchParams.set("_type", "json");
  url.searchParams.set("keyword", keyword);

  try {
    const parsed = parseJsonRecords(await fetchText(url.toString()));
    if (!parsed.records.length) return { detail: parsed.detail };
    return parsed.records.slice(0, 2).map((record) => ({
      title: readString(record, ["title", "ttl", "mediaTitle", "sj"]) || `KOSHA 안전보건자료: ${keyword}`,
      service: "안전보건자료 링크" as const,
      summary: readString(record, ["summary", "contents", "desc", "mediaCn"]) || "KOSHA 안전보건자료 링크 서비스에서 관련 자료를 확인했습니다.",
      url: readString(record, ["url", "link", "mediaUrl", "fileUrl"]) || "https://apis.data.go.kr/B552468/selectMediaList01/getselectMediaList01",
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

export async function fetchKoshaOpenApiEvidence(question: string): Promise<KoshaOpenApiEvidence> {
  if (!serviceKey) {
    return {
      source: "kosha-openapi",
      mode: "fallback",
      detail: "DATA_GO_KR_SERVICE_KEY가 없어 KOSHA 세부 OpenAPI 연결을 확인해야 합니다.",
      references: []
    };
  }

  const [smartSearch, media, msds] = await Promise.all([
    fetchSmartSearch(question),
    fetchSafetyMedia(question),
    fetchMsds(question)
  ]);
  const references = [smartSearch, media, msds]
    .flatMap((item): KoshaOpenApiReference[] => Array.isArray(item) ? item : [])
    .slice(0, 5);
  const details = [smartSearch, media, msds]
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
