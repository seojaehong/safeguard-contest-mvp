import { IntegrationMode } from "./types";

type LocationConfig = {
  label: string;
  area1: string;
  nx: number;
  ny: number;
};

type ForecastItem = {
  category: string;
  fcstDate: string;
  fcstTime: string;
  fcstValue: string;
};

type WeatherEnvelope = {
  response?: {
    header?: {
      resultCode?: string;
      resultMsg?: string;
    };
    body?: {
      items?: {
        item?: ForecastItem[];
      };
    };
  };
};

const serviceKey = process.env.DATA_GO_KR_SERVICE_KEY?.trim() || process.env.PUBLIC_DATA_API_KEY?.trim() || "";
const weatherCache = new Map<string, {
  expiresAt: number;
  value: Awaited<ReturnType<typeof fetchWeatherSignal>>;
}>();

const locationMap: Array<{ keywords: string[]; config: LocationConfig }> = [
  { keywords: ["성수", "강남", "서울"], config: { label: "서울", area1: "11", nx: 61, ny: 125 } },
  { keywords: ["인천", "남동"], config: { label: "인천", area1: "28", nx: 55, ny: 124 } },
  { keywords: ["창원"], config: { label: "창원", area1: "48", nx: 91, ny: 77 } },
  { keywords: ["강남 복합건물"], config: { label: "서울", area1: "11", nx: 61, ny: 125 } }
];

function pickLocation(question: string) {
  const normalized = question.toLowerCase();
  return locationMap.find((item) => item.keywords.some((keyword) => normalized.includes(keyword.toLowerCase())))?.config || locationMap[0].config;
}

function formatKmaBaseDate(now = new Date()) {
  const utc = now.getTime() + now.getTimezoneOffset() * 60_000;
  const kst = new Date(utc + 9 * 60 * 60_000);
  const date = `${kst.getFullYear()}${String(kst.getMonth() + 1).padStart(2, "0")}${String(kst.getDate()).padStart(2, "0")}`;
  const hhmm = Number(`${String(kst.getHours()).padStart(2, "0")}00`);
  const candidates = [2300, 2000, 1700, 1400, 1100, 800, 500, 200];
  const base = candidates.find((value) => hhmm >= value);

  if (base) {
    return { baseDate: date, baseTime: String(base).padStart(4, "0") };
  }

  const previous = new Date(kst.getTime() - 24 * 60 * 60_000);
  return {
    baseDate: `${previous.getFullYear()}${String(previous.getMonth() + 1).padStart(2, "0")}${String(previous.getDate()).padStart(2, "0")}`,
    baseTime: "2300"
  };
}

function skyLabel(value?: string) {
  if (value === "1") return "맑음";
  if (value === "3") return "구름많음";
  if (value === "4") return "흐림";
  return "정보없음";
}

function precipitationLabel(value?: string) {
  if (value === "1") return "비";
  if (value === "2") return "비/눈";
  if (value === "3") return "눈";
  if (value === "4") return "소나기";
  return "강수없음";
}

function pickForecastSnapshot(items: ForecastItem[]) {
  const firstTime = items[0]?.fcstTime;
  const firstDate = items[0]?.fcstDate;
  const current = items.filter((item) => item.fcstDate === firstDate && item.fcstTime === firstTime);
  const byCategory = new Map(current.map((item) => [item.category, item.fcstValue]));

  const windSpeed = byCategory.get("WSD") || "";
  const precipitationProbability = byCategory.get("POP") || "";
  const precipitationType = byCategory.get("PTY") || "";
  const temperature = byCategory.get("TMP") || "";
  const sky = byCategory.get("SKY") || "";

  const actions: string[] = [];
  if (Number(windSpeed || "0") >= 7) {
    actions.push("강풍 가능성이 있어 고소작업과 비계 작업의 작업중지 기준을 재확인");
  }
  if (Number(precipitationProbability || "0") >= 60 || precipitationType !== "0") {
    actions.push("강수 가능성이 있어 미끄럼·감전 위험 구역과 누전 방지 조치를 점검");
  }
  if (!actions.length) {
    actions.push("현재 예보 기준 특보 수준은 아니지만 작업 전 기상 변화에 따른 중지 기준을 공유");
  }

  return {
    forecastTime: `${firstDate || ""} ${firstTime || ""}`,
    temperatureC: temperature,
    windSpeedMps: windSpeed,
    precipitationProbability,
    summary: `${skyLabel(sky)}, ${precipitationLabel(precipitationType)}, 기온 ${temperature || "-"}℃, 풍속 ${windSpeed || "-"}m/s`,
    actions
  };
}

export async function fetchWeatherSignal(question: string): Promise<{
  source: "kma";
  mode: IntegrationMode;
  locationLabel: string;
  summary: string;
  forecastTime?: string;
  temperatureC?: string;
  windSpeedMps?: string;
  precipitationProbability?: string;
  actions: string[];
  detail: string;
}> {
  const location = pickLocation(question);

  if (!serviceKey) {
    return {
      source: "kma",
      mode: "fallback",
      locationLabel: location.label,
      summary: "기상청 서비스 키가 없어 현장 기상 주의 문구를 보수적으로 적용합니다.",
      actions: ["작업 전 기상 변화에 따른 작업중지 기준을 공유"],
      detail: "DATA_GO_KR_SERVICE_KEY 또는 PUBLIC_DATA_API_KEY가 없어 기상청 예보 연결을 확인해야 합니다."
    };
  }

  const { baseDate, baseTime } = formatKmaBaseDate();
  const cacheKey = `${location.label}:${baseDate}:${baseTime}`;
  const cached = weatherCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return {
      ...cached.value,
      detail: `${cached.value.detail} / in-memory cache`
    };
  }

  const url = new URL("https://apis.data.go.kr/1360000/VilageFcstInfoService_2.0/getVilageFcst");
  url.searchParams.set("serviceKey", serviceKey);
  url.searchParams.set("pageNo", "1");
  url.searchParams.set("numOfRows", "60");
  url.searchParams.set("dataType", "JSON");
  url.searchParams.set("base_date", baseDate);
  url.searchParams.set("base_time", baseTime);
  url.searchParams.set("nx", String(location.nx));
  url.searchParams.set("ny", String(location.ny));

  try {
    const response = await fetch(url.toString(), { cache: "no-store" });
    const text = await response.text();
    if (!response.ok) {
      throw new Error(text.slice(0, 160) || `HTTP ${response.status}`);
    }
    const parsed = JSON.parse(text) as WeatherEnvelope;
    const items = parsed.response?.body?.items?.item || [];
    if (!items.length) {
      throw new Error(parsed.response?.header?.resultMsg || "기상청 응답이 비어 있습니다.");
    }

    const snapshot = pickForecastSnapshot(items);
    const value = {
      source: "kma",
      mode: "live",
      locationLabel: location.label,
      summary: snapshot.summary,
      forecastTime: snapshot.forecastTime,
      temperatureC: snapshot.temperatureC,
      windSpeedMps: snapshot.windSpeedMps,
      precipitationProbability: snapshot.precipitationProbability,
      actions: snapshot.actions,
      detail: `기상청 단기예보 호출 성공 (${location.label}, base ${baseDate} ${baseTime})`
    } as const;
    weatherCache.set(cacheKey, {
      expiresAt: Date.now() + 30 * 60_000,
      value
    });
    return value;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      source: "kma",
      mode: "fallback",
      locationLabel: location.label,
      summary: "기상청 호출에 실패해 현장 기상 주의 문구를 보수적으로 적용합니다.",
      actions: ["기상 변화 가능성을 고려해 작업중지 기준과 대피 절차를 재확인"],
      detail: `기상청 단기예보 연결 점검 필요: ${message}`
    };
  }
}
