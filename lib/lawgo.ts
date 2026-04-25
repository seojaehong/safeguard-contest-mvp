import { mockDetails, mockSearchResults } from "./mock-data";
import { DetailRecord, SearchResult } from "./types";

const mockMode = process.env.LAWGO_MOCK_MODE !== "false";
const oc = process.env.LAWGO_OC?.trim() || "";
const baseUrl = "https://www.law.go.kr/DRF";

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
    candidates.push("산업안전");
  }

  if (tokens.length) {
    candidates.push(tokens.slice(0, 3).join(" "));
    candidates.push(tokens.slice(0, 2).join(" "));
  }

  candidates.push(normalized);

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
    throw new Error("LAWGO_OC is not set. For now use LAWGO_MOCK_MODE=true.");
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
      sourceUrl: lawId ? `https://www.law.go.kr/lsInfoP.do?lsiSeq=${lawId}` : "https://www.law.go.kr/",
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
  for (const candidate of candidates) {
    const [laws, precedents, interpretations] = await Promise.all([
      fetchLawGo("lawSearch.do", { target: "law", query: candidate }).then(parseLawResults).catch(() => []),
      fetchLawGo("lawSearch.do", { target: "prec", query: candidate }).then(parsePrecResults).catch(() => []),
      fetchLawGo("lawSearch.do", { target: "expc", query: candidate }).then(parseExpcResults).catch(() => [])
    ]);

    const merged = dedupe([...laws, ...precedents, ...interpretations]).slice(0, 10);
    if (merged.length) {
      return merged;
    }
  }

  return [];
}

export async function getDetail(id: string): Promise<DetailRecord | null> {
  if (mockMode) return mockDetails.find((item) => item.id === id) || null;
  ensureConfigured();

  const parsed = parseLawId(id);
  if (!parsed) return null;

  const url = new URL(`${baseUrl}/lawService.do`);
  url.searchParams.set("OC", oc);
  url.searchParams.set("target", parsed.type);
  url.searchParams.set("type", "JSON");
  if (parsed.type === "law") url.searchParams.set("MST", parsed.raw);
  else url.searchParams.set("ID", parsed.raw);

  const response = await fetch(url.toString(), { cache: "no-store" });
  const text = await response.text();
  if (!response.ok) return null;
  const data = JSON.parse(text) as Record<string, any>;

  if (parsed.type === "law") {
    const basic = data?.법령?.기본정보 || {};
    const department = typeof basic.소관부처 === "object" ? basic.소관부처?.content : basic.소관부처;
    const body = JSON.stringify(data?.법령?.조문?.조문단위 || []).slice(0, 1200);
    return {
      id,
      type: "law",
      title: basic.법령명_한글 || `법령 ${parsed.raw}`,
      citation: compact([basic.법종구분?.content, basic.공포번호 ? `공포 ${basic.공포번호}` : undefined]).join(" · "),
      summary: compact([department, basic.시행일자 ? `시행 ${basic.시행일자}` : undefined]).join(" · "),
      body: body || "Law.go 법령 상세 본문을 불러왔습니다.",
      points: compact([
        department ? `소관부처 ${department}` : undefined,
        basic.시행일자 ? `시행일 ${basic.시행일자}` : undefined
      ]),
      sourceLabel: "Law.go 법령",
      sourceSystem: "lawgo",
      sourceUrl: basic.법령ID ? `https://www.law.go.kr/lsInfoP.do?lsiSeq=${basic.법령ID}` : "https://www.law.go.kr/"
    };
  }

  if (parsed.type === "prec") {
    const prec = data?.PrecService || {};
    return {
      id,
      type: "precedent",
      title: prec.사건명 || `판례 ${parsed.raw}`,
      citation: compact([prec.법원명, prec.사건번호, prec.선고일자 ? `선고 ${prec.선고일자}` : undefined]).join(" · "),
      summary: stripHtml(prec.판결요지 || prec.판시사항 || "Law.go 판례 상세"),
      body: stripHtml(prec.판례내용 || ""),
      points: compact([
        prec.법원명 ? `법원 ${prec.법원명}` : undefined,
        prec.사건번호 ? `사건번호 ${prec.사건번호}` : undefined
      ]),
      sourceLabel: "Law.go 판례",
      sourceSystem: "lawgo",
      sourceUrl: "https://www.law.go.kr/"
    };
  }

  const expc = data?.ExpcService || {};
  return {
    id,
    type: "interpretation",
    title: expc.안건명 || `해석례 ${parsed.raw}`,
    citation: compact([expc.해석기관명, expc.회신일자 ? `회신 ${expc.회신일자}` : undefined]).join(" · "),
    summary: stripHtml(expc.회답 || expc.질의요지 || "Law.go 해석례 상세"),
    body: stripHtml(`${expc.질의요지 || ""}\n\n${expc.이유 || ""}`),
    points: compact([
      expc.질의기관명 ? `질의기관 ${expc.질의기관명}` : undefined,
      expc.해석기관명 ? `해석기관 ${expc.해석기관명}` : undefined
    ]),
    sourceLabel: "Law.go 해석례",
    sourceSystem: "lawgo",
    sourceUrl: "https://www.law.go.kr/"
  };
}
