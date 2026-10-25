import { IntegrationMode } from "./types";
import { readBoundedResponseText } from "./server/upstream-http";
import { createLogger } from "./logger";
import { isMismatchedWorkerCourse, matchesTaskKeyword } from "./education-course-fit";

const log = createLogger("work24");

export const WORK24_RESPONSE_MAX_BYTES = 256 * 1_024;
export const WORK24_REQUEST_TIMEOUT_MS = 20_000;

type Work24Course = {
  title: string;
  institution: string;
  startDate: string;
  endDate: string;
  cost?: string;
  target?: string;
  url: string;
  reason: string;
  fitLabel: "현장 적합" | "대상 적합" | "조건부 후보";
  fitReason: string;
  rank: number;
};

type PublicWork24Course = Omit<Work24Course, "rank">;

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
      reason,
      fitLabel: "조건부 후보" as const,
      fitReason: "현장 상황과 교육명 매칭 전 원천 과정입니다.",
      rank: 50
    };
  }).filter((item) => item.title && item.url);
}

export const WORK24_EXCLUDED_RANK = 99;

export function scoreCourseFit(question: string, course: Work24Course): Work24Course {
  const normalized = question.toLowerCase();
  const title = course.title.toLowerCase();
  const target = (course.target || "").toLowerCase();
  const text = `${title} ${target}`;
  const asksForeignWorker = ["외국인", "이주", "다국어", "foreign"].some((keyword) => normalized.includes(keyword));
  const isSafetyCourse = ["안전", "산업안전", "보호구", "위험", "msds", "관리감독"].some((keyword) => text.includes(keyword));
  const isForeignCourse = text.includes("외국인");

  // 업종(선원·수산)이나 대상(경영책임자·사업주)이 다른 과정은 근로자 후속 교육 후보에서 뺀다(EDU-08).
  if (isMismatchedWorkerCourse(question, text)) {
    return {
      ...course,
      fitLabel: "조건부 후보",
      fitReason: "교육 대상 또는 업종이 현장 근로자와 달라 후속 교육 후보로 쓰지 않습니다.",
      rank: WORK24_EXCLUDED_RANK
    };
  }

  if (asksForeignWorker && isForeignCourse) {
    return {
      ...course,
      fitLabel: "대상 적합",
      fitReason: "질문에 외국인 근로자 또는 다국어 안내가 포함되어 교육 대상이 직접 맞습니다.",
      rank: 10
    };
  }

  // 「현장 적합」은 오늘 작업 키워드가 과정명·대상에 직접 있을 때만 쓴다.
  if (isSafetyCourse && matchesTaskKeyword(question, text)) {
    return {
      ...course,
      fitLabel: "현장 적합",
      fitReason: "작업 위험 키워드와 교육 주제가 직접 연결되어 당일 후속 교육 후보로 적합합니다.",
      rank: 12
    };
  }

  if (isSafetyCourse) {
    return {
      ...course,
      fitLabel: "조건부 후보",
      fitReason: "일반 안전 과정이라 오늘 작업과 직접 맞는지 관리자가 확인해야 하는 후보입니다.",
      rank: 30
    };
  }

  if (isForeignCourse) {
    return {
      ...course,
      fitLabel: "조건부 후보",
      fitReason: "외국인 근로자가 실제 투입되는 현장일 때만 직접 연계하는 후속 교육 후보입니다.",
      rank: asksForeignWorker ? 20 : 35
    };
  }

  return {
    ...course,
    fitLabel: "조건부 후보",
    fitReason: "현장 위험과 직접 매칭되지는 않아 보조 후보로만 표시합니다.",
    rank: 60
  };
}

async function fetchCourseXml(params: Record<string, string>, signal?: AbortSignal) {
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

  const controller = new AbortController();
  const abortFromCaller = () => controller.abort(signal?.reason);
  signal?.throwIfAborted();
  signal?.addEventListener("abort", abortFromCaller, { once: true });
  const timeout = setTimeout(
    () => controller.abort(new Error(`Work24 request timeout after ${WORK24_REQUEST_TIMEOUT_MS}ms`)),
    WORK24_REQUEST_TIMEOUT_MS,
  );

  try {
    const response = await fetch(url.toString(), { cache: "no-store", signal: controller.signal });
    const text = await readBoundedResponseText(response, {
      label: "Work24 course response",
      maxBytes: WORK24_RESPONSE_MAX_BYTES,
    });
    if (!response.ok || text.includes("<error>")) {
      throw new Error(text.slice(0, 200));
    }
    return text;
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener("abort", abortFromCaller);
  }
}

export async function fetchTrainingRecommendations(question: string, signal?: AbortSignal): Promise<{
  source: "work24";
  mode: IntegrationMode;
  detail: string;
  recommendations: PublicWork24Course[];
}> {
  if (!authKey) {
    return {
      source: "work24",
      mode: "fallback",
      detail: "WORK24_AUTH_KEY가 없어 고용24 사업주훈련 연결을 확인해야 합니다.",
      recommendations: []
    };
  }

  const area1 = pickArea1(question);

  try {
    const [foreignXml, safetyXml] = await Promise.all([
      fetchCourseXml({ srchNcs1: "23", srchTraProcessNm: "외국인", ...(area1 ? { srchTraArea1: area1 } : {}) }, signal),
      fetchCourseXml({ srchNcs1: "23", srchTraProcessNm: "안전", ...(area1 ? { srchTraArea1: area1 } : {}) }, signal)
    ]);

    const merged = [...parseCourses(foreignXml), ...parseCourses(safetyXml)]
      .map((item) => scoreCourseFit(question, item))
      .filter((item) => item.rank < WORK24_EXCLUDED_RANK)
      .sort((a, b) => a.rank - b.rank);
    const unique = merged
      .filter((item, index, arr) => arr.findIndex((other) => other.title === item.title && other.startDate === item.startDate) === index)
      .slice(0, 3);
    const recommendations = unique.map(({ rank, ...item }) => item);

    return {
      source: "work24",
      mode: recommendations.length ? "live" : "fallback",
      detail: recommendations.length
        ? `고용24 사업주훈련 호출 성공${area1 ? ` (지역코드 ${area1})` : ""}. 교육 적합성은 현장 키워드와 대상 일치 여부로 재정렬했습니다.`
        : "고용24 사업주훈련 호출은 성공했지만 추천 결과가 비어 있습니다.",
      recommendations
    };
  } catch (error) {
    signal?.throwIfAborted();
    log.warn("training provider request failed", { error });
    return {
      source: "work24",
      mode: "fallback",
      detail: "고용24 사업주훈련 연결 점검이 필요합니다.",
      recommendations: []
    };
  }
}
