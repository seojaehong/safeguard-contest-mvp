import { IntegrationMode } from "./types";

type LocationConfig = {
  label: string;
  area1: string;
  nx: number;
  ny: number;
};

type ForecastItem = {
  category: string;
  fcstDate?: string;
  fcstTime?: string;
  baseDate?: string;
  baseTime?: string;
  obsrValue?: string;
  fcstValue?: string;
};

type WeatherEnvelope = {
  response?: {
    header?: {
      resultCode?: string;
      resultMsg?: string;
    };
    body?: {
      items?: {
        item?: ForecastItem[] | ForecastItem;
      };
    };
  };
};

type KmaSignal = {
  endpoint: "초단기실황" | "초단기예보" | "단기예보";
  mode: IntegrationMode;
  summary: string;
  detail: string;
  forecastTime?: string;
  temperatureC?: string;
  windSpeedMps?: string;
  precipitationProbability?: string;
  precipitationType?: string;
};

type WeatherSignal = {
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
  signals: KmaSignal[];
};

const serviceKey = process.env.DATA_GO_KR_SERVICE_KEY?.trim() || process.env.PUBLIC_DATA_API_KEY?.trim() || "";
const weatherCache = new Map<string, {
  expiresAt: number;
  value: WeatherSignal;
}>();

const KMA_TIMEOUT_MS = 20_000;
const KMA_RETRY_COUNT = 1;

const locationMap: Array<{ keywords: string[]; config: LocationConfig }> = [
  { keywords: ["성수", "강남", "서울"], config: { label: "서울", area1: "11", nx: 61, ny: 125 } },
  { keywords: ["인천", "남동"], config: { label: "인천", area1: "28", nx: 55, ny: 124 } },
  { keywords: ["안산", "경기"], config: { label: "안산", area1: "41", nx: 58, ny: 121 } },
  { keywords: ["부산", "해운대"], config: { label: "부산", area1: "26", nx: 99, ny: 75 } },
  { keywords: ["광주", "하남산단"], config: { label: "광주", area1: "29", nx: 58, ny: 74 } },
  { keywords: ["대구", "달서"], config: { label: "대구", area1: "27", nx: 89, ny: 90 } },
  { keywords: ["창원"], config: { label: "창원", area1: "48", nx: 91, ny: 77 } },
  { keywords: ["강남 복합건물"], config: { label: "서울", area1: "11", nx: 61, ny: 125 } }
];

function pickLocation(question: string) {
  const normalized = question.toLowerCase();
  return locationMap.find((item) => item.keywords.some((keyword) => normalized.includes(keyword.toLowerCase())))?.config || locationMap[0].config;
}

function toKst(now = new Date()) {
  const utc = now.getTime() + now.getTimezoneOffset() * 60_000;
  return new Date(utc + 9 * 60 * 60_000);
}

function yyyymmdd(date: Date) {
  return `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, "0")}${String(date.getDate()).padStart(2, "0")}`;
}

function formatKmaBaseDate(now = new Date()) {
  const kst = toKst(now);
  const hhmm = Number(`${String(kst.getHours()).padStart(2, "0")}00`);
  const candidates = [2300, 2000, 1700, 1400, 1100, 800, 500, 200];
  const base = candidates.find((value) => hhmm >= value);

  if (base) {
    return { baseDate: yyyymmdd(kst), baseTime: String(base).padStart(4, "0") };
  }

  const previous = new Date(kst.getTime() - 24 * 60 * 60_000);
  return {
    baseDate: yyyymmdd(previous),
    baseTime: "2300"
  };
}

function formatUltraNowBase(now = new Date()) {
  const kst = toKst(now);
  if (kst.getMinutes() < 45) {
    kst.setHours(kst.getHours() - 1);
  }
  return {
    baseDate: yyyymmdd(kst),
    baseTime: `${String(kst.getHours()).padStart(2, "0")}00`
  };
}

function formatUltraForecastBase(now = new Date()) {
  const kst = toKst(now);
  if (kst.getMinutes() < 45) {
    kst.setHours(kst.getHours() - 1);
  }
  return {
    baseDate: yyyymmdd(kst),
    baseTime: `${String(kst.getHours()).padStart(2, "0")}30`
  };
}

function skyLabel(value?: string) {
  if (value === "1") return "맑음";
  if (value === "3") return "구름많음";
  if (value === "4") return "흐림";
  return "정보없음";
}

function precipitationLabel(value?: string) {
  if (!value || value === "0") return "강수없음";
  if (value === "1") return "비";
  if (value === "2") return "비/눈";
  if (value === "3") return "눈";
  if (value === "4") return "소나기";
  if (value === "5") return "빗방울";
  if (value === "6") return "빗방울눈날림";
  if (value === "7") return "눈날림";
  return "강수정보";
}

function valueByCategory(items: ForecastItem[], category: string, key: "obsrValue" | "fcstValue") {
  return items.find((item) => item.category === category)?.[key] || "";
}

async function fetchWithTimeout(url: string, label: string) {
  let lastError: Error | null = null;
  for (let attempt = 0; attempt <= KMA_RETRY_COUNT; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), KMA_TIMEOUT_MS);
    try {
      const response = await fetch(url, { cache: "no-store", signal: controller.signal });
      const text = await response.text();
      if (!response.ok) {
        throw new Error(text.slice(0, 180) || `${label} HTTP ${response.status}`);
      }
      return text;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
    } finally {
      clearTimeout(timeout);
    }
  }
  throw lastError || new Error(`${label} 호출 실패`);
}

async function fetchKmaItems(
  endpoint: "getUltraSrtNcst" | "getUltraSrtFcst" | "getVilageFcst",
  params: { baseDate: string; baseTime: string; nx: number; ny: number; numOfRows: string }
) {
  const url = new URL(`https://apis.data.go.kr/1360000/VilageFcstInfoService_2.0/${endpoint}`);
  url.searchParams.set("serviceKey", serviceKey);
  url.searchParams.set("pageNo", "1");
  url.searchParams.set("numOfRows", params.numOfRows);
  url.searchParams.set("dataType", "JSON");
  url.searchParams.set("base_date", params.baseDate);
  url.searchParams.set("base_time", params.baseTime);
  url.searchParams.set("nx", String(params.nx));
  url.searchParams.set("ny", String(params.ny));

  const text = await fetchWithTimeout(url.toString(), endpoint);
  const parsed = JSON.parse(text) as WeatherEnvelope;
  const resultCode = parsed.response?.header?.resultCode;
  if (resultCode && resultCode !== "00") {
    throw new Error(parsed.response?.header?.resultMsg || `${endpoint} resultCode ${resultCode}`);
  }
  const item = parsed.response?.body?.items?.item;
  const items = Array.isArray(item) ? item : item ? [item] : [];
  if (!items.length) {
    throw new Error(parsed.response?.header?.resultMsg || `${endpoint} 응답이 비어 있습니다.`);
  }
  return items;
}

async function fetchUltraNowSignal(location: LocationConfig): Promise<KmaSignal> {
  const { baseDate, baseTime } = formatUltraNowBase();
  try {
    const items = await fetchKmaItems("getUltraSrtNcst", {
      baseDate,
      baseTime,
      nx: location.nx,
      ny: location.ny,
      numOfRows: "20"
    });
    const temperature = valueByCategory(items, "T1H", "obsrValue");
    const windSpeed = valueByCategory(items, "WSD", "obsrValue");
    const precipitationType = valueByCategory(items, "PTY", "obsrValue");
    const rain = valueByCategory(items, "RN1", "obsrValue");

    return {
      endpoint: "초단기실황",
      mode: "live",
      summary: `현재 ${precipitationLabel(precipitationType)}, 기온 ${temperature || "-"}℃, 풍속 ${windSpeed || "-"}m/s, 1시간 강수 ${rain || "0"}mm`,
      forecastTime: `${baseDate} ${baseTime}`,
      temperatureC: temperature,
      windSpeedMps: windSpeed,
      precipitationType: precipitationLabel(precipitationType),
      detail: `기상청 초단기실황 호출 성공 (${location.label}, base ${baseDate} ${baseTime})`
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      endpoint: "초단기실황",
      mode: "fallback",
      summary: "현재 실황 연결 보류",
      detail: `기상청 초단기실황 연결 점검 필요: ${message}`
    };
  }
}

async function fetchUltraForecastSignal(location: LocationConfig): Promise<KmaSignal> {
  const { baseDate, baseTime } = formatUltraForecastBase();
  try {
    const items = await fetchKmaItems("getUltraSrtFcst", {
      baseDate,
      baseTime,
      nx: location.nx,
      ny: location.ny,
      numOfRows: "60"
    });
    const firstTime = items[0]?.fcstTime;
    const firstDate = items[0]?.fcstDate;
    const current = items.filter((item) => item.fcstDate === firstDate && item.fcstTime === firstTime);
    const temperature = valueByCategory(current, "T1H", "fcstValue");
    const windSpeed = valueByCategory(current, "WSD", "fcstValue");
    const precipitationType = valueByCategory(current, "PTY", "fcstValue");
    const sky = valueByCategory(current, "SKY", "fcstValue");

    return {
      endpoint: "초단기예보",
      mode: "live",
      summary: `단시간 ${skyLabel(sky)}, ${precipitationLabel(precipitationType)}, 기온 ${temperature || "-"}℃, 풍속 ${windSpeed || "-"}m/s`,
      forecastTime: `${firstDate || baseDate} ${firstTime || baseTime}`,
      temperatureC: temperature,
      windSpeedMps: windSpeed,
      precipitationType: precipitationLabel(precipitationType),
      detail: `기상청 초단기예보 호출 성공 (${location.label}, base ${baseDate} ${baseTime})`
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      endpoint: "초단기예보",
      mode: "fallback",
      summary: "단시간 예보 연결 보류",
      detail: `기상청 초단기예보 연결 점검 필요: ${message}`
    };
  }
}

async function fetchVillageForecastSignal(location: LocationConfig): Promise<KmaSignal> {
  const { baseDate, baseTime } = formatKmaBaseDate();
  try {
    const items = await fetchKmaItems("getVilageFcst", {
      baseDate,
      baseTime,
      nx: location.nx,
      ny: location.ny,
      numOfRows: "80"
    });
    const firstTime = items[0]?.fcstTime;
    const firstDate = items[0]?.fcstDate;
    const current = items.filter((item) => item.fcstDate === firstDate && item.fcstTime === firstTime);
    const temperature = valueByCategory(current, "TMP", "fcstValue");
    const windSpeed = valueByCategory(current, "WSD", "fcstValue");
    const precipitationProbability = valueByCategory(current, "POP", "fcstValue");
    const precipitationType = valueByCategory(current, "PTY", "fcstValue");
    const sky = valueByCategory(current, "SKY", "fcstValue");

    return {
      endpoint: "단기예보",
      mode: "live",
      summary: `${skyLabel(sky)}, ${precipitationLabel(precipitationType)}, 기온 ${temperature || "-"}℃, 풍속 ${windSpeed || "-"}m/s, 강수확률 ${precipitationProbability || "-"}%`,
      forecastTime: `${firstDate || baseDate} ${firstTime || baseTime}`,
      temperatureC: temperature,
      windSpeedMps: windSpeed,
      precipitationProbability,
      precipitationType: precipitationLabel(precipitationType),
      detail: `기상청 단기예보 호출 성공 (${location.label}, base ${baseDate} ${baseTime})`
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      endpoint: "단기예보",
      mode: "fallback",
      summary: "단기예보 연결 보류",
      detail: `기상청 단기예보 연결 점검 필요: ${message}`
    };
  }
}

function buildWeatherActions(signals: KmaSignal[]) {
  const liveSignals = signals.filter((signal) => signal.mode === "live");
  const windValues = liveSignals
    .map((signal) => Number(signal.windSpeedMps || "0"))
    .filter((value) => Number.isFinite(value));
  const maxWind = Math.max(0, ...windValues);
  const maxPop = Math.max(0, ...liveSignals.map((signal) => Number(signal.precipitationProbability || "0")).filter((value) => Number.isFinite(value)));
  const hasRain = liveSignals.some((signal) => signal.precipitationType && signal.precipitationType !== "강수없음");

  const actions: string[] = [];
  if (maxWind >= 7) {
    actions.push("강풍 가능성이 있어 고소작업과 비계 작업의 작업중지 기준을 재확인");
  }
  if (maxPop >= 60 || hasRain) {
    actions.push("강수 가능성이 있어 미끄럼·감전 위험 구역과 누전 방지 조치를 점검");
  }
  if (!actions.length) {
    actions.push("현재 예보 기준 특보 수준은 아니지만 작업 전 기상 변화에 따른 중지 기준을 공유");
  }
  return actions;
}

function composeSummary(signals: KmaSignal[]) {
  const preferred = signals.find((signal) => signal.endpoint === "초단기예보" && signal.mode === "live")
    || signals.find((signal) => signal.endpoint === "단기예보" && signal.mode === "live")
    || signals.find((signal) => signal.mode === "live");
  if (!preferred) return "기상청 호출에 실패해 현장 기상 주의 문구를 보수적으로 적용합니다.";
  const liveLabels = signals.filter((signal) => signal.mode === "live").map((signal) => signal.endpoint).join("/");
  return `${preferred.summary} (${liveLabels} 반영)`;
}

export async function fetchWeatherSignal(question: string): Promise<WeatherSignal> {
  const location = pickLocation(question);

  if (!serviceKey) {
    return {
      source: "kma",
      mode: "fallback",
      locationLabel: location.label,
      summary: "기상청 서비스 키가 없어 현장 기상 주의 문구를 보수적으로 적용합니다.",
      actions: ["작업 전 기상 변화에 따른 작업중지 기준을 공유"],
      detail: "DATA_GO_KR_SERVICE_KEY 또는 PUBLIC_DATA_API_KEY가 없어 기상청 예보 연결을 확인해야 합니다.",
      signals: [
        { endpoint: "초단기실황", mode: "fallback", summary: "서비스 키 필요", detail: "서비스 키 필요" },
        { endpoint: "초단기예보", mode: "fallback", summary: "서비스 키 필요", detail: "서비스 키 필요" },
        { endpoint: "단기예보", mode: "fallback", summary: "서비스 키 필요", detail: "서비스 키 필요" }
      ]
    };
  }

  const { baseDate, baseTime } = formatKmaBaseDate();
  const ultraNow = formatUltraNowBase();
  const ultraForecast = formatUltraForecastBase();
  const cacheKey = `${location.label}:${ultraNow.baseDate}:${ultraNow.baseTime}:${ultraForecast.baseTime}:${baseDate}:${baseTime}`;
  const cached = weatherCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return {
      ...cached.value,
      detail: `${cached.value.detail} / in-memory cache`
    };
  }

  const signals = await Promise.all([
    fetchUltraNowSignal(location),
    fetchUltraForecastSignal(location),
    fetchVillageForecastSignal(location)
  ]);
  const liveSignals = signals.filter((signal) => signal.mode === "live");
  const preferred = liveSignals.find((signal) => signal.endpoint === "초단기예보")
    || liveSignals.find((signal) => signal.endpoint === "단기예보")
    || liveSignals[0];
  const mode: IntegrationMode = liveSignals.length ? "live" : "fallback";
  const value: WeatherSignal = {
    source: "kma",
    mode,
    locationLabel: location.label,
    summary: composeSummary(signals),
    forecastTime: preferred?.forecastTime,
    temperatureC: preferred?.temperatureC,
    windSpeedMps: preferred?.windSpeedMps,
    precipitationProbability: preferred?.precipitationProbability,
    actions: buildWeatherActions(signals),
    detail: signals.map((signal) => signal.detail).join(" / "),
    signals
  };
  weatherCache.set(cacheKey, {
    expiresAt: Date.now() + 10 * 60_000,
    value
  });
  return value;
}
