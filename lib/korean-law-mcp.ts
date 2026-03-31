import "server-only";

import { cleanHtml, extractHangContent, flattenContent } from "korean-law-mcp/lib/article-parser";
import { LawApiClient } from "korean-law-mcp/lib/api-client";
import { extractTag, parseInterpretationXML, parsePrecedentXML, stripHtml } from "korean-law-mcp/lib/xml-parser";
import { DetailRecord, SearchResult } from "./types";

type KoreanLawMcpSourceType = "law" | "precedent" | "interpretation";
type JsonRecord = Record<string, any>;

type KoreanLawMcpConfig = {
  enabled: boolean;
  apiKey: string;
  configured: boolean;
  keySource: "KOREAN_LAW_MCP_LAW_OC" | "LAWGO_OC" | "none";
};

const KLM_LAW_PREFIX = "klm-law-";
const KLM_PRECEDENT_PREFIX = "klm-prec-";
const KLM_INTERPRETATION_PREFIX = "klm-expc-";
const DEFAULT_SEARCH_LIMIT = 3;

function getConfig(): KoreanLawMcpConfig {
  const explicitKey = process.env.KOREAN_LAW_MCP_LAW_OC?.trim() || "";
  const fallbackKey = process.env.LAWGO_OC?.trim() || "";
  const apiKey = explicitKey || fallbackKey;

  return {
    enabled: process.env.KOREAN_LAW_MCP_ENABLED === "true",
    apiKey,
    configured: process.env.KOREAN_LAW_MCP_ENABLED === "true" && Boolean(apiKey),
    keySource: explicitKey ? "KOREAN_LAW_MCP_LAW_OC" : fallbackKey ? "LAWGO_OC" : "none"
  };
}

function createClient() {
  const config = getConfig();
  if (!config.enabled) {
    throw new Error("KOREAN_LAW_MCP_ENABLED가 false라 보강 검색을 사용하지 않습니다.");
  }
  if (!config.apiKey) {
    throw new Error("KOREAN_LAW_MCP_LAW_OC 또는 LAWGO_OC가 필요합니다.");
  }
  return new LawApiClient({ apiKey: config.apiKey });
}

function normalizeText(text?: string | null) {
  return stripHtml(text || "").replace(/\s+/g, " ").trim();
}

function truncateText(text: string, maxLength = 180) {
  const normalized = normalizeText(text);
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, maxLength - 1).trimEnd()}…`;
}

function compact(parts: Array<string | undefined | null>) {
  return parts.map((part) => normalizeText(part)).filter(Boolean);
}

function buildSummary(parts: Array<string | undefined | null>, fallback: string) {
  const normalizedParts = compact(parts);
  return normalizedParts.length ? normalizedParts.join(" · ") : fallback;
}

function toArray<T>(value: T | T[] | undefined | null): T[] {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

function buildId(type: KoreanLawMcpSourceType, rawId: string) {
  if (type === "law") return `${KLM_LAW_PREFIX}${rawId}`;
  if (type === "precedent") return `${KLM_PRECEDENT_PREFIX}${rawId}`;
  return `${KLM_INTERPRETATION_PREFIX}${rawId}`;
}

function parseId(id: string): { type: KoreanLawMcpSourceType; rawId: string } | null {
  if (id.startsWith(KLM_LAW_PREFIX)) {
    return { type: "law", rawId: id.slice(KLM_LAW_PREFIX.length) };
  }
  if (id.startsWith(KLM_PRECEDENT_PREFIX)) {
    return { type: "precedent", rawId: id.slice(KLM_PRECEDENT_PREFIX.length) };
  }
  if (id.startsWith(KLM_INTERPRETATION_PREFIX)) {
    return { type: "interpretation", rawId: id.slice(KLM_INTERPRETATION_PREFIX.length) };
  }
  return null;
}

export function isKoreanLawMcpId(id: string) {
  return Boolean(parseId(id));
}

export function getKoreanLawMcpStatus() {
  const config = getConfig();
  return {
    enabled: config.enabled,
    configured: config.configured,
    keySource: config.keySource,
    summary: !config.enabled
      ? "korean-law-mcp 비활성화"
      : config.configured
        ? `korean-law-mcp 활성화 (${config.keySource})`
        : "korean-law-mcp 활성화 상태지만 API 키 미설정"
  };
}

function dedupeResults(results: SearchResult[]) {
  const seen = new Set<string>();
  const merged: SearchResult[] = [];

  for (const item of results) {
    const key = `${item.type}:${normalizeText(item.title)}`.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(item);
  }

  return merged;
}

function parseLawSearchResults(xml: string, limit: number): SearchResult[] {
  const matches = Array.from(xml.matchAll(/<law\b[^>]*>([\s\S]*?)<\/law>/g));

  return matches.slice(0, limit).flatMap((match) => {
    const content = match[1];
    const mst = normalizeText(extractTag(content, "법령일련번호"));
    const lawId = normalizeText(extractTag(content, "법령ID"));
    const title = normalizeText(extractTag(content, "법령명한글") || extractTag(content, "법령명"));

    if (!mst || !title) return [];

    const lawType = normalizeText(extractTag(content, "법령구분명"));
    const promDate = normalizeText(extractTag(content, "공포일자"));
    const department = normalizeText(extractTag(content, "소관부처명"));

    return [
      {
        id: buildId("law", mst),
        type: "law" as const,
        title,
        summary: buildSummary(
          [department, lawType, promDate ? `공포 ${promDate}` : undefined],
          "korean-law-mcp 법령 검색 결과"
        ),
        citation: promDate ? `공포 ${promDate}` : lawType || undefined,
        sourceLabel: "korean-law-mcp · 법령",
        sourceSystem: "korean-law-mcp" as const,
        sourceUrl: lawId ? `https://www.law.go.kr/lsInfoP.do?lsiSeq=${lawId}` : "https://www.law.go.kr/",
        tags: compact([lawType, department, "보강검색"])
      }
    ];
  });
}

function mapPrecedentSearchResults(xml: string, limit: number): SearchResult[] {
  const parsed = parsePrecedentXML(xml);

  return parsed.items.slice(0, limit).map((item) => ({
    id: buildId("precedent", item.판례일련번호),
    type: "precedent" as const,
    title: normalizeText(item.판례명) || `판례 ${item.판례일련번호}`,
    summary: buildSummary(
      [item.법원명, item.선고일자 ? `선고 ${item.선고일자}` : undefined, item.사건번호],
      "korean-law-mcp 판례 검색 결과"
    ),
    citation: buildSummary([item.법원명, item.사건번호], "판례"),
    sourceLabel: "korean-law-mcp · 판례",
    sourceSystem: "korean-law-mcp" as const,
    sourceUrl: item.판례상세링크 || "https://www.law.go.kr/",
    tags: compact([item.법원명, item.판결유형, "보강검색"])
  }));
}

function mapInterpretationSearchResults(xml: string, limit: number): SearchResult[] {
  const parsed = parseInterpretationXML(xml);

  return parsed.items.slice(0, limit).map((item) => ({
    id: buildId("interpretation", item.법령해석례일련번호),
    type: "interpretation" as const,
    title: normalizeText(item.안건명) || `해석례 ${item.법령해석례일련번호}`,
    summary: buildSummary(
      [item.해석기관명, item.회신일자 ? `회신 ${item.회신일자}` : undefined, truncateText(item.질의요지, 80)],
      "korean-law-mcp 해석례 검색 결과"
    ),
    citation: buildSummary([item.해석기관명, item.법령해석례번호], "해석례"),
    sourceLabel: "korean-law-mcp · 해석례",
    sourceSystem: "korean-law-mcp" as const,
    sourceUrl: item.법령해석례상세링크 || "https://www.law.go.kr/",
    tags: compact([item.해석기관명, item.소관부처명, "보강검색"])
  }));
}

export async function searchKoreanLawMcp(query: string, limit = DEFAULT_SEARCH_LIMIT): Promise<SearchResult[]> {
  const normalizedQuery = query.trim();
  const config = getConfig();

  if (!normalizedQuery || !config.enabled || !config.apiKey) {
    return [];
  }

  const client = createClient();

  const [lawXml, precedentXml, interpretationXml] = await Promise.all([
    client.searchLaw(normalizedQuery).catch(() => ""),
    client.fetchApi({
      endpoint: "lawSearch.do",
      target: "prec",
      extraParams: { query: normalizedQuery, display: String(limit), page: "1" }
    }).catch(() => ""),
    client.fetchApi({
      endpoint: "lawSearch.do",
      target: "expc",
      extraParams: { query: normalizedQuery, display: String(limit), page: "1" }
    }).catch(() => "")
  ]);

  return dedupeResults([
    ...parseLawSearchResults(lawXml, limit),
    ...mapPrecedentSearchResults(precedentXml, limit),
    ...mapInterpretationSearchResults(interpretationXml, limit)
  ]);
}

function formatLawArticlePreview(lawData: JsonRecord) {
  const rawUnits = lawData.조문 && typeof lawData.조문 === "object" ? lawData.조문.조문단위 : undefined;
  const articleUnits = toArray<JsonRecord>(rawUnits as JsonRecord | JsonRecord[] | undefined);
  const previews: string[] = [];

  for (const unit of articleUnits) {
    if (unit.조문여부 !== "조문") continue;

    const joNum = normalizeText(unit.조문번호);
    const joBranch = normalizeText(unit.조문가지번호);
    const joTitle = normalizeText(unit.조문제목);
    const displayNum = joBranch && joBranch !== "0" ? `제${joNum}조의${joBranch}` : joNum ? `제${joNum}조` : "조문";

    const rawContent = unit.조문내용;
    let mainContent = "";

    if (rawContent) {
      const flattened = flattenContent(rawContent);
      const normalized = normalizeText(flattened);
      if (normalized) {
        const headerPattern = new RegExp(`^${displayNum.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?:\\([^)]*\\))?\\s*`);
        mainContent = normalized.replace(headerPattern, "").trim();
      }
    }

    const paragraphContent = unit.항 ? normalizeText(extractHangContent(unit.항)) : "";
    const body = cleanHtml([mainContent, paragraphContent].filter(Boolean).join("\n")).trim();

    if (body) {
      previews.push(`${displayNum}${joTitle ? ` ${joTitle}` : ""}\n${body}`);
    }

    if (previews.length >= 4) break;
  }

  const totalArticleCount = articleUnits.filter((unit) => unit.조문여부 === "조문").length;

  if (!previews.length) {
    return "korean-law-mcp를 통해 법령 메타데이터는 확인했지만 조문 본문 요약은 파싱하지 못했습니다.";
  }

  if (totalArticleCount > previews.length) {
    previews.push(`… 총 ${totalArticleCount}개 조문 중 앞 ${previews.length}개 조문만 발췌했습니다.`);
  }

  return previews.join("\n\n");
}

function buildDetailRecord(partial: Omit<DetailRecord, "sourceLabel" | "sourceSystem">): DetailRecord {
  return {
    ...partial,
    sourceLabel: partial.type === "law"
      ? "korean-law-mcp · 법령"
      : partial.type === "precedent"
        ? "korean-law-mcp · 판례"
        : "korean-law-mcp · 해석례",
    sourceSystem: "korean-law-mcp"
  };
}

async function loadLawDetail(client: LawApiClient, mst: string): Promise<DetailRecord | null> {
  const jsonText = await client.getLawText({ mst });
  const data = JSON.parse(jsonText) as JsonRecord;
  const lawData = data.법령 as JsonRecord | undefined;
  if (!lawData) return null;

  const basicInfo = ((lawData.기본정보 || lawData) as JsonRecord) || {};
  const lawName = normalizeText(basicInfo.법령명_한글 || basicInfo.법령명한글 || basicInfo.법령명) || `법령 ${mst}`;
  const promDate = normalizeText(basicInfo.공포일자);
  const effDate = normalizeText(basicInfo.시행일자 || basicInfo.최종시행일자);
  const department = normalizeText(basicInfo.소관부처명 || basicInfo.소관부처);
  const lawId = normalizeText(basicInfo.법령ID);
  const lawType = normalizeText(basicInfo.법령구분명);

  const rawUnits = lawData.조문 && typeof lawData.조문 === "object" ? lawData.조문.조문단위 : undefined;
  const articleUnits = toArray<JsonRecord>(rawUnits as JsonRecord | JsonRecord[] | undefined).filter((unit) => unit.조문여부 === "조문");
  const articleTitles = articleUnits
    .map((unit) => {
      const articleNo = normalizeText(unit.조문번호);
      const articleBranch = normalizeText(unit.조문가지번호);
      const articleTitle = normalizeText(unit.조문제목);
      if (!articleNo) return "";
      const label = articleBranch && articleBranch !== "0" ? `제${articleNo}조의${articleBranch}` : `제${articleNo}조`;
      return articleTitle ? `${label} ${articleTitle}` : label;
    })
    .filter(Boolean)
    .slice(0, 3);

  return buildDetailRecord({
    id: buildId("law", mst),
    type: "law",
    title: lawName,
    citation: buildSummary([promDate ? `공포 ${promDate}` : undefined, effDate ? `시행 ${effDate}` : undefined], lawType || "법령"),
    summary: buildSummary([department, lawType, articleUnits.length ? `조문 ${articleUnits.length}개` : undefined], "korean-law-mcp 법령 상세"),
    body: formatLawArticlePreview(lawData),
    points: compact([
      department ? `소관부처 ${department}` : undefined,
      promDate ? `공포일 ${promDate}` : undefined,
      effDate ? `시행일 ${effDate}` : undefined,
      articleTitles.length ? `주요 조문 ${articleTitles.join(", ")}` : undefined
    ]),
    sourceUrl: lawId ? `https://www.law.go.kr/lsInfoP.do?lsiSeq=${lawId}` : "https://www.law.go.kr/",
    tags: compact([lawType, department, "korean-law-mcp"])
  });
}

function buildSections(sections: Array<{ label: string; text?: string | null }>) {
  return sections
    .map(({ label, text }) => {
      const normalized = normalizeText(text);
      if (!normalized) return "";
      return `${label}\n${normalized}`;
    })
    .filter(Boolean)
    .join("\n\n");
}

async function loadPrecedentDetail(client: LawApiClient, id: string): Promise<DetailRecord | null> {
  const responseText = await client.fetchApi({
    endpoint: "lawService.do",
    target: "prec",
    type: "JSON",
    extraParams: { ID: id }
  });

  const data = JSON.parse(responseText) as JsonRecord;
  const prec = data.PrecService as JsonRecord | undefined;
  if (!prec) return null;

  const title = normalizeText(prec.사건명) || `판례 ${id}`;
  const court = normalizeText(prec.법원명);
  const caseNumber = normalizeText(prec.사건번호);
  const decisionDate = normalizeText(prec.선고일자);
  const caseType = normalizeText(prec.사건종류명);
  const judgmentType = normalizeText(prec.판결유형);
  const summarySource = normalizeText(prec.판결요지 || prec.판시사항 || prec.판례내용);

  return buildDetailRecord({
    id: buildId("precedent", id),
    type: "precedent",
    title,
    citation: buildSummary([court, caseNumber, decisionDate ? `선고 ${decisionDate}` : undefined], "판례"),
    summary: truncateText(summarySource || buildSummary([caseType, judgmentType], "korean-law-mcp 판례 상세"), 220),
    body: buildSections([
      { label: "판시사항", text: prec.판시사항 },
      { label: "판결요지", text: prec.판결요지 },
      { label: "참조조문", text: prec.참조조문 },
      { label: "전문", text: prec.판례내용 }
    ]),
    points: compact([
      court ? `법원 ${court}` : undefined,
      caseNumber ? `사건번호 ${caseNumber}` : undefined,
      decisionDate ? `선고일 ${decisionDate}` : undefined,
      judgmentType ? `판결유형 ${judgmentType}` : undefined
    ]),
    sourceUrl: "https://www.law.go.kr/",
    tags: compact([court, caseType, judgmentType, "korean-law-mcp"])
  });
}

async function loadInterpretationDetail(client: LawApiClient, id: string): Promise<DetailRecord | null> {
  const responseText = await client.fetchApi({
    endpoint: "lawService.do",
    target: "expc",
    type: "JSON",
    extraParams: { ID: id }
  });

  const data = JSON.parse(responseText) as JsonRecord;
  const interpretation = data.ExpcService as JsonRecord | undefined;
  if (!interpretation) return null;

  const title = normalizeText(interpretation.안건명) || `해석례 ${id}`;
  const interpretationNumber = normalizeText(interpretation.법령해석례일련번호 || interpretation.안건번호);
  const responseDate = normalizeText(interpretation.해석일자 || interpretation.회신일자);
  const interpretationAgency = normalizeText(interpretation.해석기관명);
  const requestingAgency = normalizeText(interpretation.질의기관명);
  const answer = normalizeText(interpretation.회답);

  return buildDetailRecord({
    id: buildId("interpretation", id),
    type: "interpretation",
    title,
    citation: buildSummary([interpretationAgency, responseDate ? `회신 ${responseDate}` : undefined], "해석례"),
    summary: truncateText(answer || normalizeText(interpretation.질의요지) || "korean-law-mcp 해석례 상세", 220),
    body: buildSections([
      { label: "질의요지", text: interpretation.질의요지 },
      { label: "회답", text: interpretation.회답 },
      { label: "이유", text: interpretation.이유 }
    ]),
    points: compact([
      interpretationNumber ? `해석례번호 ${interpretationNumber}` : undefined,
      responseDate ? `회신일 ${responseDate}` : undefined,
      requestingAgency ? `질의기관 ${requestingAgency}` : undefined,
      interpretationAgency ? `해석기관 ${interpretationAgency}` : undefined
    ]),
    sourceUrl: "https://www.law.go.kr/",
    tags: compact([interpretationAgency, requestingAgency, "korean-law-mcp"])
  });
}

export async function getKoreanLawMcpDetail(id: string): Promise<DetailRecord | null> {
  const parsed = parseId(id);
  const config = getConfig();

  if (!parsed || !config.enabled || !config.apiKey) {
    return null;
  }

  const client = createClient();

  if (parsed.type === "law") {
    return loadLawDetail(client, parsed.rawId).catch(() => null);
  }

  if (parsed.type === "precedent") {
    return loadPrecedentDetail(client, parsed.rawId).catch(() => null);
  }

  return loadInterpretationDetail(client, parsed.rawId).catch(() => null);
}
