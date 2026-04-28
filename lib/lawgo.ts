import { mockDetails, mockSearchResults } from "./mock-data";
import { DetailRecord, SearchResult } from "./types";

const oc = process.env.LAWGO_OC?.trim() || process.env.LAW_OC?.trim() || "";
const mockMode = process.env.LAWGO_MOCK_MODE === "force" || !oc;
const baseUrl = "https://www.law.go.kr/DRF";

type JsonRecord = Record<string, unknown>;

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readRecord(record: JsonRecord | undefined, key: string): JsonRecord | undefined {
  const value = record?.[key];
  return isRecord(value) ? value : undefined;
}

function readValue(record: JsonRecord | undefined, key: string): unknown {
  return record?.[key];
}

function readArrayRecords(value: unknown): JsonRecord[] {
  if (Array.isArray(value)) return value.filter(isRecord);
  if (isRecord(value)) return [value];
  return [];
}

function readNestedUnitRecords(record: JsonRecord | undefined, key: string, unitKey: string): JsonRecord[] {
  const wrappers = readArrayRecords(readValue(record, key));
  return wrappers.flatMap((wrapper) => {
    const units = readArrayRecords(readValue(wrapper, unitKey));
    return units.length ? units : [wrapper];
  });
}

function readString(record: JsonRecord | undefined, key: string) {
  const value = record?.[key];
  if (typeof value === "string") return value;
  if (typeof value === "number") return String(value);
  if (isRecord(value)) {
    const content = value.content;
    if (typeof content === "string") return content;
    if (typeof content === "number") return String(content);
  }
  return "";
}

function readContent(value: unknown) {
  if (typeof value === "string") return value;
  if (typeof value === "number") return String(value);
  if (isRecord(value)) {
    const content = value.content;
    if (typeof content === "string") return content;
    if (typeof content === "number") return String(content);
  }
  return "";
}

function tokenizeQuery(query: string) {
  return query
    .toLowerCase()
    .split(/[\s,./()\-]+/)
    .map((token) => token.trim())
    .filter((token) => token.length >= 2);
}

function buildLiveQueries(query: string) {
  const normalized = query.trim();
  const tokens = tokenizeQuery(normalized);
  const candidates: string[] = [];
  const looksLikeNaturalSentence =
    normalized.length > 30 || /[.!?,]/.test(normalized) || ["작업", "현장", "위험", "초안", "만들어줘", "알려줘"].some((keyword) => normalized.includes(keyword));
  const hasSafetyKeywords = tokens.some((token) =>
    ["비계", "추락", "지게차", "강풍", "도장", "용접", "절단", "감전", "밀폐", "화기"].some((keyword) => token.includes(keyword))
  );

  if (hasSafetyKeywords || looksLikeNaturalSentence) {
    candidates.push("산업안전보건법");
    candidates.push("산업안전보건기준에 관한 규칙");
    candidates.push("위험성평가");
    candidates.push("산업안전 안전조치");
  }

  if (normalized.includes("비계") || normalized.includes("추락") || normalized.includes("고소")) {
    candidates.push("추락 안전조치");
    candidates.push("비계 추락");
  }

  if (normalized.includes("지게차") || normalized.includes("충돌") || normalized.includes("동선")) {
    candidates.push("지게차 안전조치");
    candidates.push("충돌 안전조치");
  }

  if (normalized.includes("교육") || normalized.includes("보호구") || normalized.includes("신규")) {
    candidates.push("산업안전보건교육");
    candidates.push("안전교육 보호구");
  }

  if (normalized.includes("도급") || normalized.includes("하청") || normalized.includes("협력")) {
    candidates.push("중대재해 처벌 등에 관한 법률");
    candidates.push("도급 안전보건조치");
  }

  if (tokens.length) {
    candidates.push(tokens.slice(0, 3).join(" "));
    candidates.push(tokens.slice(0, 2).join(" "));
  }

  candidates.push(normalized);

  return [...new Set(candidates.filter(Boolean))];
}

function buildPrecedentQueries(query: string) {
  const normalized = query.trim();
  const candidates = [
    ...buildLiveQueries(query),
    "산업재해 손해배상 안전조치",
    "안전교육 보호구 산업재해",
    "추락 안전조치 산업재해",
    "도급 안전보건조치 산업재해"
  ];

  if (normalized.includes("지게차")) {
    candidates.unshift("지게차 산업재해");
  }

  if (normalized.includes("비계") || normalized.includes("추락")) {
    candidates.unshift("비계 추락 산업재해");
  }

  return [...new Set(candidates.filter(Boolean))];
}

function scoreMockResult(item: SearchResult, query: string) {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) return 1;

  const haystack = [item.title, item.summary, item.citation || "", ...(item.tags || [])].join(" ").toLowerCase();
  const tokens = tokenizeQuery(normalizedQuery);

  if (haystack.includes(normalizedQuery)) {
    return 100;
  }

  let score = 0;
  for (const token of tokens) {
    if (haystack.includes(token)) {
      score += item.title.toLowerCase().includes(token) ? 3 : 1;
    }
  }

  return score;
}

function ensureConfigured() {
  if (!oc) {
    throw new Error("LAWGO_OC or LAW_OC is not set. Law.go credentials are required for hosted evidence search.");
  }
}

function extractTag(xml: string, tag: string) {
  const match = xml.match(new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`));
  return match?.[1]?.replace(/<!\[CDATA\[|\]\]>/g, "").trim() || "";
}

function stripHtml(text: string) {
  return text.replace(/<br\s*\/?>/gi, "\n").replace(/<[^>]+>/g, "").replace(/\s+\n/g, "\n").trim();
}

function compact(parts: Array<string | undefined>) {
  return parts.map((part) => (part || "").trim()).filter(Boolean);
}

function normalizeLawText(text: string) {
  return stripHtml(text)
    .replace(/\u00a0/g, " ")
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function isSafetyArticle(text: string) {
  return /안전|보건|위험|유해|교육|보호구|작업|도급|기계|추락|비계|중지|관리감독|조치|근로자|사업주/.test(text);
}

function lawSourceUrl(lawSerial: string) {
  return lawSerial ? `https://www.law.go.kr/lsInfoP.do?lsiSeq=${encodeURIComponent(lawSerial)}` : "https://www.law.go.kr/";
}

function removeDuplicateArticleHeading(text: string, heading: string, articleTitle: string) {
  let normalized = normalizeLawText(text);
  if (!normalized) return "";

  const escapedHeading = heading.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  normalized = normalized.replace(new RegExp(`^${escapedHeading}\\s*`), "").trim();

  if (articleTitle) {
    const escapedTitle = articleTitle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    normalized = normalized.replace(new RegExp(`^\\(${escapedTitle}\\)\\s*`), "").trim();
    normalized = normalized.replace(new RegExp(`^${escapedHeading}\\(${escapedTitle}\\)\\s*`), "").trim();
  }

  return normalized;
}

function formatNestedLawLine(text: string, depth: 1 | 2) {
  const normalized = normalizeLawText(text);
  if (!normalized) return "";
  return `${depth === 1 ? "  " : "    "}${normalized}`;
}

function formatArticleUnit(article: JsonRecord) {
  const articleNo = readString(article, "조문번호") || readString(article, "조문키");
  const articleTitle = readString(article, "조문제목");
  const heading = compact([
    articleNo ? `제${articleNo}조` : undefined,
    articleTitle ? `(${articleTitle})` : undefined
  ]).join("");
  const articleContent = removeDuplicateArticleHeading(readString(article, "조문내용"), heading, articleTitle);
  const paragraphs = readNestedUnitRecords(article, "항", "항단위")
    .map((paragraph) => {
      const paragraphText = normalizeLawText(readString(paragraph, "항내용"));
      const subItems = readNestedUnitRecords(paragraph, "호", "호단위")
        .map((subItem) => {
          const subItemText = formatNestedLawLine(readString(subItem, "호내용"), 1);
          const mokItems = readNestedUnitRecords(subItem, "목", "목단위")
            .map((mokItem) => formatNestedLawLine(readString(mokItem, "목내용"), 2))
            .filter(Boolean);
          return [subItemText, ...mokItems].filter(Boolean).join("\n");
        })
        .filter(Boolean)
        .filter((subItem) => subItem.trim() !== paragraphText.trim());
      return [paragraphText, ...subItems].filter(Boolean).join("\n");
    })
    .filter(Boolean);

  return [heading, articleContent, ...paragraphs].filter(Boolean).join("\n").trim();
}

function buildLawDocumentReflection() {
  return [
    "[현장 문서 반영]",
    "- 위험성평가표: 유해·위험요인 파악, 위험성 결정, 감소대책 수립의 기준 근거로 사용합니다.",
    "- TBM 기록: 작업중지 기준, 보호구 착용, 위험구역 통제, 역할 확인 문구를 설명하는 근거로 사용합니다.",
    "- 안전보건교육 기록: 신규·외국인·미숙련 근로자에게 반드시 공유한 내용과 이해 확인 항목을 남기는 근거로 사용합니다.",
    "- 작업계획서: 현장 조건, 작업순서, 감시자·신호수 배치, 사진 증빙 항목을 보강하는 근거로 사용합니다."
  ].join("\n");
}

function formatLawDetailBody(articleUnits: JsonRecord[]) {
  const articleTexts = articleUnits.map(formatArticleUnit).filter(Boolean);
  const safetyArticles = articleTexts.filter(isSafetyArticle);
  const selectedArticles = (safetyArticles.length ? safetyArticles : articleTexts).slice(0, 8);

  return [
    buildLawDocumentReflection(),
    "",
    "[주요 조문 요약]",
    selectedArticles.length
      ? selectedArticles.join("\n\n")
      : "Law.go 상세 원문에서 조문을 직접 확인해 주세요. SafeGuard는 이 근거를 현장 문서 초안 작성 보조 근거로만 사용합니다."
  ].join("\n");
}

function buildLawFallbackDetail(id: string, raw: string): DetailRecord {
  return {
    id,
    type: "law",
    title: `법령 ${raw}`,
    citation: "Law.go 법령",
    summary: "Law.go 상세 응답을 즉시 해석하지 못해 원문 확인 링크와 문서 반영 기준을 먼저 표시합니다.",
    body: formatLawDetailBody([]),
    points: [
      "위험성평가·TBM·안전보건교육 기록의 근거 초안으로만 사용합니다.",
      "원문 링크에서 최신 법령 본문을 함께 확인해야 합니다."
    ],
    sourceLabel: "Law.go 법령",
    sourceSystem: "lawgo",
    sourceUrl: lawSourceUrl(raw)
  };
}

function parseLawResults(xml: string): SearchResult[] {
  return Array.from(xml.matchAll(/<law\b[^>]*>([\s\S]*?)<\/law>/g)).slice(0, 4).map((match) => {
    const content = match[1];
    const mst = extractTag(content, "법령일련번호");
    const title = extractTag(content, "법령명한글") || extractTag(content, "법령명");
    const lawType = extractTag(content, "법령구분명");
    const promDate = extractTag(content, "공포일자");
    const department = extractTag(content, "소관부처명");
    const lawId = extractTag(content, "법령ID");

    return {
      id: mst ? `lawgo-law-${mst}` : `lawgo-law-${title}`,
      type: "law" as const,
      title,
      summary: compact([department, lawType, promDate ? `공포 ${promDate}` : undefined]).join(" · ") || "Law.go 법령 검색 결과",
      citation: compact([lawType, promDate ? `공포 ${promDate}` : undefined]).join(" · ") || undefined,
      sourceLabel: "Law.go 법령",
      sourceSystem: "lawgo" as const,
      sourceUrl: mst ? lawSourceUrl(mst) : lawId ? `https://www.law.go.kr/법령/${encodeURIComponent(title)}` : "https://www.law.go.kr/",
      tags: compact([lawType, department, "Law.go"])
    };
  }).filter((item) => item.title);
}

function parsePrecResults(xml: string): SearchResult[] {
  return Array.from(xml.matchAll(/<prec\b[^>]*>([\s\S]*?)<\/prec>/g)).slice(0, 3).map((match) => {
    const content = match[1];
    const id = extractTag(content, "판례일련번호");
    const title = extractTag(content, "사건명");
    const court = extractTag(content, "법원명");
    const caseNumber = extractTag(content, "사건번호");
    const decisionDate = extractTag(content, "선고일자");
    const detailPath = extractTag(content, "판례상세링크");

    return {
      id: id ? `lawgo-prec-${id}` : `lawgo-prec-${title}`,
      type: "precedent" as const,
      title,
      summary: compact([court, caseNumber, decisionDate ? `선고 ${decisionDate}` : undefined]).join(" · ") || "Law.go 판례 검색 결과",
      citation: compact([court, caseNumber]).join(" · ") || undefined,
      sourceLabel: "Law.go 판례",
      sourceSystem: "lawgo" as const,
      sourceUrl: detailPath ? `https://www.law.go.kr${detailPath}` : "https://www.law.go.kr/",
      tags: compact([court, "Law.go"])
    };
  }).filter((item) => item.title);
}

function parseExpcResults(xml: string): SearchResult[] {
  return Array.from(xml.matchAll(/<expc\b[^>]*>([\s\S]*?)<\/expc>/g)).slice(0, 3).map((match) => {
    const content = match[1];
    const id = extractTag(content, "법령해석례일련번호");
    const title = extractTag(content, "안건명");
    const agency = extractTag(content, "회신기관명");
    const questionAgency = extractTag(content, "질의기관명");
    const responseDate = extractTag(content, "회신일자");
    const detailPath = extractTag(content, "법령해석례상세링크");

    return {
      id: id ? `lawgo-expc-${id}` : `lawgo-expc-${title}`,
      type: "interpretation" as const,
      title,
      summary: compact([agency, questionAgency, responseDate ? `회신 ${responseDate}` : undefined]).join(" · ") || "Law.go 해석례 검색 결과",
      citation: compact([agency, responseDate ? `회신 ${responseDate}` : undefined]).join(" · ") || undefined,
      sourceLabel: "Law.go 해석례",
      sourceSystem: "lawgo" as const,
      sourceUrl: detailPath ? `https://www.law.go.kr${detailPath}` : "https://www.law.go.kr/",
      tags: compact([agency, questionAgency, "Law.go"])
    };
  }).filter((item) => item.title);
}

async function fetchLawGo(endpoint: string, params: Record<string, string>) {
  ensureConfigured();
  const url = new URL(`${baseUrl}/${endpoint}`);
  url.searchParams.set("OC", oc);
  url.searchParams.set("type", "XML");
  Object.entries(params).forEach(([key, value]) => {
    if (value) url.searchParams.set(key, value);
  });
  const response = await fetch(url.toString(), { cache: "no-store" });
  const text = await response.text();
  if (!response.ok) {
    throw new Error(text.slice(0, 160));
  }
  return text;
}

function dedupe(results: SearchResult[]) {
  const seen = new Set<string>();
  return results.filter((item) => {
    const key = `${item.type}:${item.title}`.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function parseLawId(id: string) {
  if (id.startsWith("lawgo-law-")) return { type: "law" as const, raw: id.slice("lawgo-law-".length) };
  if (id.startsWith("lawgo-prec-")) return { type: "prec" as const, raw: id.slice("lawgo-prec-".length) };
  if (id.startsWith("lawgo-expc-")) return { type: "expc" as const, raw: id.slice("lawgo-expc-".length) };
  return null;
}

export async function searchAll(query: string): Promise<SearchResult[]> {
  if (mockMode) {
    const q = query.trim();
    if (!q) return mockSearchResults;

    return mockSearchResults
      .map((item) => ({ item, score: scoreMockResult(item, q) }))
      .filter((entry) => entry.score > 0)
      .sort((a, b) => b.score - a.score)
      .map((entry) => entry.item);
  }

  const candidates = buildLiveQueries(query);
  let bestResults: SearchResult[] = [];

  for (const candidate of candidates) {
    const [laws, precedents, interpretations] = await Promise.all([
      fetchLawGo("lawSearch.do", { target: "law", query: candidate }).then(parseLawResults).catch(() => []),
      fetchLawGo("lawSearch.do", { target: "prec", query: candidate }).then(parsePrecResults).catch(() => []),
      fetchLawGo("lawSearch.do", { target: "expc", query: candidate }).then(parseExpcResults).catch(() => [])
    ]);

    const merged = dedupe([...laws, ...interpretations, ...precedents]).slice(0, 10);
    if (precedents.length) {
      return merged;
    }
    if (!bestResults.length && merged.length) {
      bestResults = merged;
    }
  }

  const precedentResults = await searchLawGoPrecedents(query, 4).catch(() => []);
  if (precedentResults.length) {
    return dedupe([...precedentResults, ...bestResults]).slice(0, 10);
  }

  return bestResults;
}

export async function searchLawGoPrecedents(query: string, limit = 4): Promise<SearchResult[]> {
  if (mockMode) {
    return mockSearchResults.filter((item) => item.type === "precedent").slice(0, limit);
  }

  const collected: SearchResult[] = [];
  for (const candidate of buildPrecedentQueries(query)) {
    const precedents = await fetchLawGo("lawSearch.do", { target: "prec", query: candidate })
      .then(parsePrecResults)
      .catch(() => []);

    collected.push(...precedents.map((item) => ({
      ...item,
      tags: compact([...(item.tags || []), "Law.go 판례검색", candidate])
    })));

    const merged = dedupe(collected);
    if (merged.length) {
      return merged.slice(0, limit);
    }
  }

  return [];
}

export async function getDetail(id: string): Promise<DetailRecord | null> {
  const parsed = parseLawId(id);
  if (mockMode) {
    const mock = mockDetails.find((item) => item.id === id);
    if (mock) return mock;
    if (parsed?.type === "law") return buildLawFallbackDetail(id, parsed.raw);
    return null;
  }
  ensureConfigured();

  if (!parsed) return null;

  const url = new URL(`${baseUrl}/lawService.do`);
  url.searchParams.set("OC", oc);
  url.searchParams.set("target", parsed.type);
  url.searchParams.set("type", "JSON");
  if (parsed.type === "law") url.searchParams.set("MST", parsed.raw);
  else url.searchParams.set("ID", parsed.raw);

  let response: Response;
  let text: string;
  try {
    response = await fetch(url.toString(), { cache: "no-store" });
    text = await response.text();
  } catch (error) {
    console.error("Failed to fetch Law.go detail response", error);
    return parsed.type === "law" ? buildLawFallbackDetail(id, parsed.raw) : null;
  }
  if (!response.ok) {
    console.error("Law.go detail response was not ok", { status: response.status, type: parsed.type, id });
    return parsed.type === "law" ? buildLawFallbackDetail(id, parsed.raw) : null;
  }
  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(text) as unknown;
  } catch (error) {
    console.error("Failed to parse Law.go detail response", error);
    return parsed.type === "law" ? buildLawFallbackDetail(id, parsed.raw) : null;
  }
  if (!isRecord(parsedJson)) return parsed.type === "law" ? buildLawFallbackDetail(id, parsed.raw) : null;

  if (parsed.type === "law") {
    const law = readRecord(parsedJson, "법령");
    if (!law) return buildLawFallbackDetail(id, parsed.raw);
    const basic = readRecord(law, "기본정보") || {};
    const articles = readArrayRecords(readValue(readRecord(law, "조문"), "조문단위"));
    const department = readString(basic, "소관부처");
    const body = formatLawDetailBody(articles);
    const lawName = readString(basic, "법령명_한글");
    const lawKind = readContent(basic.법종구분);
    const promNo = readString(basic, "공포번호");
    const effectiveDate = readString(basic, "시행일자");
    return {
      id,
      type: "law",
      title: lawName || `법령 ${parsed.raw}`,
      citation: compact([lawKind, promNo ? `공포 ${promNo}` : undefined]).join(" · "),
      summary: compact([department, effectiveDate ? `시행 ${effectiveDate}` : undefined]).join(" · "),
      body: body || "Law.go 법령 상세 본문을 불러왔습니다.",
      points: compact([
        department ? `소관부처 ${department}` : undefined,
        effectiveDate ? `시행일 ${effectiveDate}` : undefined,
        "위험성평가·TBM·안전보건교육 기록의 반영 근거로 사용",
        "법률 검토 최종 의견이 아니라 현장 문서 초안 작성 보조 근거"
      ]),
      sourceLabel: "Law.go 법령",
      sourceSystem: "lawgo",
      sourceUrl: lawSourceUrl(parsed.raw)
    };
  }

  if (parsed.type === "prec") {
    const prec = readRecord(parsedJson, "PrecService") || {};
    const title = readString(prec, "사건명");
    const court = readString(prec, "법원명");
    const caseNumber = readString(prec, "사건번호");
    const decisionDate = readString(prec, "선고일자");
    return {
      id,
      type: "precedent",
      title: title || `판례 ${parsed.raw}`,
      citation: compact([court, caseNumber, decisionDate ? `선고 ${decisionDate}` : undefined]).join(" · "),
      summary: stripHtml(readString(prec, "판결요지") || readString(prec, "판시사항") || "Law.go 판례 상세"),
      body: stripHtml(readString(prec, "판례내용")),
      points: compact([
        court ? `법원 ${court}` : undefined,
        caseNumber ? `사건번호 ${caseNumber}` : undefined
      ]),
      sourceLabel: "Law.go 판례",
      sourceSystem: "lawgo",
      sourceUrl: "https://www.law.go.kr/"
    };
  }

  const expc = readRecord(parsedJson, "ExpcService") || {};
  const title = readString(expc, "안건명");
  const agency = readString(expc, "해석기관명");
  const responseDate = readString(expc, "회신일자");
  const question = readString(expc, "질의요지");
  const reason = readString(expc, "이유");
  const answer = readString(expc, "회답");
  const questionAgency = readString(expc, "질의기관명");
  return {
    id,
    type: "interpretation",
    title: title || `해석례 ${parsed.raw}`,
    citation: compact([agency, responseDate ? `회신 ${responseDate}` : undefined]).join(" · "),
    summary: stripHtml(answer || question || "Law.go 해석례 상세"),
    body: stripHtml(`${question}\n\n${reason}`),
    points: compact([
      questionAgency ? `질의기관 ${questionAgency}` : undefined,
      agency ? `해석기관 ${agency}` : undefined
    ]),
    sourceLabel: "Law.go 해석례",
    sourceSystem: "lawgo",
    sourceUrl: "https://www.law.go.kr/"
  };
}
