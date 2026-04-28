import { IntegrationMode } from "./types";

export type KoshaEducationRecommendation = {
  title: string;
  provider: string;
  target: string;
  educationMethod: string;
  url: string;
  reason: string;
  fitLabel: "공식 포털" | "대상 적합" | "현장 적합" | "조건부 후보";
  fitReason: string;
};

type KoshaEduApiResponse = {
  result?: string;
  message?: string;
  payload?: {
    eduTrgtList?: Array<{
      eduTrgtCd?: string;
      comCdNm?: string;
    }>;
    eduCrsList?: Array<Record<string, unknown>>;
    eduInstList?: Array<{
      crclmSrcSeCd?: string;
      comCdNm?: string;
    }>;
    eduSrchList?: Array<{
      id?: string;
      label?: string;
    }>;
  };
};

const BASE_URL = "https://edu.kosha.or.kr";
const API_BASE = `${BASE_URL}/api/portal24/bizG/p/GETEA02001`;
const TIMEOUT_MS = 20_000;

function hasAny(value: string, keywords: string[]) {
  return keywords.some((keyword) => value.includes(keyword));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readString(record: Record<string, unknown>, key: string) {
  const value = record[key];
  return typeof value === "string" || typeof value === "number" ? String(value) : "";
}

function compactDate(value: string) {
  if (!/^\d{8}$/.test(value)) return value;
  return `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}`;
}

async function postKoshaEdu(endpoint: string, body: Record<string, unknown>) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(`${API_BASE}/${endpoint}`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "origin": BASE_URL,
        "referer": `${BASE_URL}/`,
        "user-agent": "SafeGuard safety-workpack"
      },
      body: JSON.stringify(body),
      signal: controller.signal,
      cache: "no-store"
    });
    const text = await response.text();
    if (!response.ok) {
      throw new Error(`KOSHA EDU ${endpoint} returned ${response.status}: ${text.slice(0, 160)}`);
    }
    const parsed = JSON.parse(text) as unknown;
    if (!isRecord(parsed)) {
      throw new Error(`KOSHA EDU ${endpoint} returned non-object response`);
    }
    return parsed as KoshaEduApiResponse;
  } finally {
    clearTimeout(timeout);
  }
}

function classifyQuestion(question: string) {
  const normalized = question.toLowerCase();
  return {
    asksForeignWorker: hasAny(normalized, ["외국인", "다국어", "이주", "foreign", "베트남", "중국", "몽골"]),
    asksLogistics: hasAny(normalized, ["지게차", "물류", "상하차", "동선", "하역"]),
    asksConstruction: hasAny(normalized, ["건설", "비계", "추락", "외벽", "도장", "고소"]),
    asksManagement: hasAny(normalized, ["관리감독", "사업주", "경영책임", "도급", "협력"])
  };
}

function buildFallbackRecommendations(question: string, targetNames: string[]): KoshaEducationRecommendation[] {
  const flags = classifyQuestion(question);
  const recommendations: KoshaEducationRecommendation[] = [
    {
      title: "KOSHA 안전보건교육포털 교육과정 검색",
      provider: "한국산업안전보건공단",
      target: targetNames.includes("근로자") ? "근로자" : "전체",
      educationMethod: "집체·온라인·혼합 과정",
      url: BASE_URL,
      reason: "KOSHA 공식 교육포털에서 작업 전 안전교육, 근로자 교육, 관리감독자 교육 후보를 확인합니다.",
      fitLabel: "공식 포털",
      fitReason: "공단 교육포털 live 메타데이터를 확인한 뒤 공식 검색 화면으로 연결합니다."
    }
  ];

  if (flags.asksForeignWorker && targetNames.includes("외국인근로자")) {
    recommendations.unshift({
      title: "외국인근로자 대상 안전보건교육 확인",
      provider: "한국산업안전보건공단",
      target: "외국인근로자",
      educationMethod: "교육포털 대상별 과정 확인",
      url: BASE_URL,
      reason: "외국인 근로자 또는 다국어 안내 맥락이 있어 KOSHA 교육대상 코드의 외국인근로자 항목을 연결합니다.",
      fitLabel: "대상 적합",
      fitReason: "KOSHA 교육포털 대상 목록에서 외국인근로자 항목을 live 확인했습니다."
    });
  }

  if (flags.asksLogistics || flags.asksConstruction || flags.asksManagement) {
    recommendations.push({
      title: flags.asksManagement ? "관리감독자·사업주 안전보건교육 확인" : "작업유형별 안전보건교육 확인",
      provider: "한국산업안전보건공단",
      target: flags.asksManagement ? "사업주·관리감독자" : "근로자·관리감독자",
      educationMethod: "교육포털 과정 검색",
      url: BASE_URL,
      reason: "현장 위험 키워드를 교육포털 검색 조건으로 넘겨 후속 안전교육 후보를 확인합니다.",
      fitLabel: "현장 적합",
      fitReason: flags.asksLogistics
        ? "지게차·물류 작업은 작업 전 동선통제와 운반하역 안전교육 확인이 필요합니다."
        : flags.asksConstruction
          ? "건설·추락 작업은 보호구, 작업발판, 작업중지 기준 교육과 직접 연결됩니다."
          : "도급·관리감독 맥락은 사업주와 관리감독자 교육 확인으로 연결됩니다."
    });
  }

  return recommendations.slice(0, 3);
}

function mapCourse(course: Record<string, unknown>, question: string): KoshaEducationRecommendation | null {
  const title = readString(course, "hmpgExpsrCrclmNm");
  if (!title) return null;
  const flags = classifyQuestion(question);
  const url = `${BASE_URL}/?crclmEstblNo=${encodeURIComponent(readString(course, "crclmEstblNo"))}&crclmCyclNo=${encodeURIComponent(readString(course, "crclmCyclNo"))}&eduYr=${encodeURIComponent(readString(course, "eduYr"))}`;
  const target = readString(course, "eduFldLclsfNm") || readString(course, "eduTrgtCd") || "안전보건교육";
  const method = readString(course, "onlineYn") === "OFF"
    ? "집체교육"
    : readString(course, "onlineYn") === "ON"
      ? "온라인"
      : readString(course, "eduWayCd") || "교육포털";
  const schedule = readString(course, "eduYmd") || [
    compactDate(readString(course, "eduBgngYmd")),
    compactDate(readString(course, "eduEndYmd"))
  ].filter(Boolean).join(" ~ ");
  const place = readString(course, "eduPlcNm");
  const capacity = [readString(course, "aplyNope"), readString(course, "eduPscpCnt")]
    .filter(Boolean)
    .join("/");
  const fitLabel = flags.asksForeignWorker && title.includes("외국인")
    ? "대상 적합"
    : title.includes("안전") || title.includes("위험") || title.includes("관리감독")
      ? "현장 적합"
      : "조건부 후보";

  return {
    title,
    provider: readString(course, "eduInstNm") || "한국산업안전보건공단",
    target,
    educationMethod: method,
    url,
    reason: [schedule, place, capacity ? `신청/정원 ${capacity}` : ""].filter(Boolean).join(" · ") || "KOSHA 교육포털 과정목록 API에서 조회된 교육 후보입니다.",
    fitLabel,
    fitReason: fitLabel === "조건부 후보"
      ? "교육명과 현장 위험 키워드가 직접 일치하는지 관리자 확인이 필요합니다."
      : "교육명 또는 대상이 현장 위험 키워드와 연결됩니다."
  };
}

function scoreCourse(question: string, course: KoshaEducationRecommendation) {
  const normalized = question.toLowerCase();
  const haystack = `${course.title} ${course.target} ${course.reason}`.toLowerCase();
  let score = 0;

  for (const keyword of ["외국인", "다국어", "이주"]) {
    if (normalized.includes(keyword) && haystack.includes("외국인")) score += 30;
  }
  for (const keyword of ["건설", "비계", "추락", "굴착", "크레인"]) {
    if (normalized.includes(keyword) && hasAny(haystack, ["건설", "위험성", "안전보건", "중대재해"])) score += 12;
  }
  for (const keyword of ["지게차", "물류", "상하차"]) {
    if (normalized.includes(keyword) && hasAny(haystack, ["지게차", "운반", "안전보건"])) score += 12;
  }
  for (const keyword of ["관리감독", "사업주", "경영책임"]) {
    if (normalized.includes(keyword) && hasAny(haystack, ["관리감독", "사업주", "경영책임", "중대재해"])) score += 12;
  }
  if (hasAny(haystack, ["안전", "위험성", "중대재해", "외국인"])) score += 5;
  if (course.fitLabel === "대상 적합") score += 8;
  if (course.fitLabel === "현장 적합") score += 4;

  return score;
}

async function tryFetchCourses(question: string) {
  const flags = classifyQuestion(question);
  const eduWayCd = ["01", "02", "03", "04", "05"];
  const targetCandidates = flags.asksForeignWorker
    ? ["48", "34", "00"]
    : flags.asksManagement
      ? ["10", "12", "00"]
      : ["34", "12", "00"];
  const collected: KoshaEducationRecommendation[] = [];

  for (const eduTrgtCd of targetCandidates) {
    const instResponse = await postKoshaEdu("selectEduInst", { eduWayCd, eduTrgtCd: [eduTrgtCd] }).catch(() => null);
    const instList = instResponse?.payload?.eduInstList || [
      { crclmSrcSeCd: "10", comCdNm: "공단 일선기관" },
      { crclmSrcSeCd: "20", comCdNm: "공단 교육원" },
      { crclmSrcSeCd: "30", comCdNm: "공단 본부" }
    ];

    for (const inst of instList.slice(0, 3)) {
      const sourceCode = inst.crclmSrcSeCd || "10";
      const searchResponse = await postKoshaEdu("selectRgnSrchSeCd", {
        eduWayCd,
        eduTrgtCd: [eduTrgtCd],
        eduInstCd: sourceCode
      }).catch(() => null);
      const comboSrch1 = searchResponse?.payload?.eduSrchList?.[0]?.id || "ALL";
      const response = await postKoshaEdu("selectEduCrsList", {
        eduWayCd,
        eduTrgtCd: [eduTrgtCd],
        crclmSrcSeCd: sourceCode,
        rgnSeCd: "ALL",
        chargedEduYn: "ALL",
        aplyYn: "ALL",
        comboSrch1,
        comboSrch2: "ALL",
        srchInfo: "",
        rgnInclYn: false,
        eduRgnCd: "ALL",
        sortByOrder: 1,
        page: 1,
        rowsPerPage: 12,
        totalCount: 0
      }).catch(() => null);

      const courses = response?.payload?.eduCrsList || [];
      collected.push(...courses.map((course) => mapCourse(course, question)).filter((course): course is KoshaEducationRecommendation => Boolean(course)));
      if (collected.length >= 12) break;
    }
    if (collected.length >= 12) break;
  }

  return collected
    .map((course) => ({ course, score: scoreCourse(question, course) }))
    .sort((a, b) => b.score - a.score)
    .map((entry) => entry.course)
    .filter((item, index, arr) => arr.findIndex((other) => other.title === item.title && other.reason === item.reason) === index)
    .slice(0, 3);
}

export async function fetchKoshaEducationRecommendations(question: string): Promise<{
  source: "kosha-edu";
  mode: IntegrationMode;
  detail: string;
  recommendations: KoshaEducationRecommendation[];
}> {
  try {
    const [targetResponse, courseRecommendations] = await Promise.all([
      postKoshaEdu("selectEduTrgt", { eduWayCd: ["01", "02", "03", "04", "05"] }),
      tryFetchCourses(question).catch(() => [])
    ]);
    const targetNames = (targetResponse.payload?.eduTrgtList || [])
      .map((target) => target.comCdNm || "")
      .filter(Boolean);
    const fallback = buildFallbackRecommendations(question, targetNames);
    const recommendations = [...courseRecommendations, ...fallback]
      .filter((item, index, arr) => arr.findIndex((other) => other.title === item.title && other.target === item.target) === index)
      .slice(0, 3);

    return {
      source: "kosha-edu",
      mode: "live",
      detail: `KOSHA 교육포털 메타데이터 확인 성공. 교육대상 ${targetNames.length}개, 과정 후보 ${courseRecommendations.length}건을 반영했습니다.`,
      recommendations
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      source: "kosha-edu",
      mode: "fallback",
      detail: `KOSHA 교육포털 연결 점검 필요: ${message}`,
      recommendations: buildFallbackRecommendations(question, ["근로자", "외국인근로자", "관리감독자"])
    };
  }
}
