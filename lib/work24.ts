import { IntegrationMode } from "./types";

type Work24Course = {
  title: string;
  institution: string;
  startDate: string;
  endDate: string;
  cost?: string;
  target?: string;
  url: string;
  reason: string;
};

const authKey = process.env.WORK24_AUTH_KEY?.trim() || "";

const areaMap: Array<{ keywords: string[]; area1: string }> = [
  { keywords: ["서울", "성수", "강남"], area1: "11" },
  { keywords: ["인천", "남동"], area1: "28" },
  { keywords: ["창원"], area1: "48" }
];

function pickArea1(question: string) {
  const normalized = question.toLowerCase();
  return areaMap.find((item) => item.keywords.some((keyword) => normalized.includes(keyword.toLowerCase())))?.area1;
}

function currentDateRange() {
  const now = new Date();
  const start = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}`;
  const future = new Date(now.getTime() + 60 * 24 * 60 * 60_000);
  const end = `${future.getFullYear()}${String(future.getMonth() + 1).padStart(2, "0")}${String(future.getDate()).padStart(2, "0")}`;
  return { start, end };
}

function extractTag(xml: string, tag: string) {
  const match = xml.match(new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`));
  return match?.[1]?.replace(/<!\[CDATA\[|\]\]>/g, "").trim() || "";
}

function parseCourses(xml: string) {
  return Array.from(xml.matchAll(/<scn_list>([\s\S]*?)<\/scn_list>/g)).map((match) => {
    const content = match[1];
    const title = extractTag(content, "title");
    const institution = extractTag(content, "subTitle");
    const startDate = extractTag(content, "traStartDate");
    const endDate = extractTag(content, "traEndDate");
    const cost = extractTag(content, "realMan");
    const target = extractTag(content, "trainTarget");
    const url = extractTag(content, "titleLink");
    const reason = title.includes("외국인")
      ? "외국인 근로자 취업·안전교육 연계에 바로 활용 가능한 과정"
      : title.includes("안전") || title.includes("MSDS") || title.includes("ISO 45001")
        ? "현장 안전역량과 사업주 후속 교육 연계에 적합한 과정"
        : "사업주훈련 기반 후속 교육 추천 과정";

    return {
      title,
      institution,
      startDate,
      endDate,
      cost: cost ? `${Number(cost).toLocaleString("ko-KR")}원` : undefined,
      target,
      url,
      reason
    };
  }).filter((item) => item.title && item.url);
}

async function fetchCourseXml(params: Record<string, string>) {
  const { start, end } = currentDateRange();
  const url = new URL("https://www.work24.go.kr/cm/openApi/call/hr/callOpenApiSvcInfo311L01.do");
  url.searchParams.set("authKey", authKey);
  url.searchParams.set("returnType", "XML");
  url.searchParams.set("outType", "1");
  url.searchParams.set("pageNum", "1");
  url.searchParams.set("pageSize", "5");
  url.searchParams.set("srchTraStDt", start);
  url.searchParams.set("srchTraEndDt", end);
  url.searchParams.set("sort", "ASC");
  url.searchParams.set("sortCol", "2");

  Object.entries(params).forEach(([key, value]) => {
    if (value) url.searchParams.set(key, value);
  });

  const response = await fetch(url.toString(), { cache: "no-store" });
  const text = await response.text();
  if (!response.ok || text.includes("<error>")) {
    throw new Error(text.slice(0, 200));
  }
  return text;
}

export async function fetchTrainingRecommendations(question: string): Promise<{
  source: "work24";
  mode: IntegrationMode;
  detail: string;
  recommendations: Work24Course[];
}> {
  if (!authKey) {
    return {
      source: "work24",
      mode: "fallback",
      detail: "WORK24_AUTH_KEY가 없어 고용24 사업주훈련 live 호출을 수행하지 못했습니다.",
      recommendations: []
    };
  }

  const area1 = pickArea1(question);

  try {
    const [foreignXml, safetyXml] = await Promise.all([
      fetchCourseXml({ srchNcs1: "23", srchTraProcessNm: "외국인", ...(area1 ? { srchTraArea1: area1 } : {}) }),
      fetchCourseXml({ srchNcs1: "23", srchTraProcessNm: "안전", ...(area1 ? { srchTraArea1: area1 } : {}) })
    ]);

    const merged = [...parseCourses(foreignXml), ...parseCourses(safetyXml)];
    const unique = merged.filter((item, index, arr) => arr.findIndex((other) => other.title === item.title && other.startDate === item.startDate) === index).slice(0, 3);

    return {
      source: "work24",
      mode: unique.length ? "live" : "fallback",
      detail: unique.length
        ? `고용24 사업주훈련 live 호출 성공${area1 ? ` (지역코드 ${area1})` : ""}`
        : "고용24 사업주훈련 live 호출은 성공했지만 추천 결과가 비어 있습니다.",
      recommendations: unique
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      source: "work24",
      mode: "fallback",
      detail: `고용24 사업주훈련 fallback: ${message}`,
      recommendations: []
    };
  }
}
