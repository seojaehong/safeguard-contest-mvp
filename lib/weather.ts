import { IntegrationMode } from "./types";

type LocationConfig = {
  label: string;
  area1: string;
  areaNo: string;
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
  endpoint:
    | "초단기실황"
    | "초단기예보"
    | "단기예보"
    | "기상특보"
    | "영향예보"
    | "생활기상 자외선"
    | "실시간 홍반자외선";
  mode: IntegrationMode;
  summary: string;
  detail: string;
  forecastTime?: string;
  temperatureC?: string;
  windSpeedMps?: string;
  precipitationProbability?: string;
  precipitationType?: string;
  uvIndex?: string;
  heatRiskLevel?: "보통" | "높음" | "매우높음" | "위험";
};

type WeatherWarningItem = {
  title?: string;
  tmFc?: string;
  stnId?: string;
  stnNm?: string;
  wrn?: string;
  lvl?: string;
  cmd?: string;
};

type WeatherWarningEnvelope = {
  response?: {
    header?: {
      resultCode?: string;
      resultMsg?: string;
    };
    body?: {
      items?: {
        item?: WeatherWarningItem[] | WeatherWarningItem;
      };
    };
  };
};

type ImpactForecastItem = {
  regId?: string;
  regName?: string;
  tmEf?: string;
  clsfc?: string;
  value?: string;
};

type ImpactForecastEnvelope = {
  response?: {
    header?: {
      resultCode?: string;
      resultMsg?: string;
    };
    body?: {
      items?: {
        item?: ImpactForecastItem[] | ImpactForecastItem;
      };
    };
  };
};

type LivingWeatherIndexItem = {
  areaNo?: string;
  date?: string;
  today?: string;
  tomorrow?: string;
  theDayAfterTomorrow?: string;
  h0?: string;
  h3?: string;
  h6?: string;
  h9?: string;
  h12?: string;
  h15?: string;
  h18?: string;
  h21?: string;
  h24?: string;
  h27?: string;
  h30?: string;
  h33?: string;
  h36?: string;
  h39?: string;
  h42?: string;
  h45?: string;
  h48?: string;
  h51?: string;
  h54?: string;
  h57?: string;
  h60?: string;
  h63?: string;
  h66?: string;
  h69?: string;
  h72?: string;
  value?: string;
  idx?: string;
  uv?: string;
};

type LivingWeatherIndexEnvelope = {
  response?: {
    header?: {
      resultCode?: string;
      resultMsg?: string;
    };
    body?: {
      items?: {
        item?: LivingWeatherIndexItem[] | LivingWeatherIndexItem;
      };
    };
  };
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
const kierErythemalUvEndpoint = process.env.KIER_ERYTHEMAL_UV_ENDPOINT?.trim() || "";
const weatherCache = new Map<string, {
  expiresAt: number;
  value: WeatherSignal;
}>();

const KMA_TIMEOUT_MS = 20_000;
const KMA_RETRY_COUNT = 1;

const locationMap: Array<{ keywords: string[]; config: LocationConfig }> = [
  { keywords: ["성수", "강남", "서울"], config: { label: "서울", area1: "11", areaNo: "1100000000", nx: 61, ny: 125 } },
  { keywords: ["인천", "남동"], config: { label: "인천", area1: "28", areaNo: "2800000000", nx: 55, ny: 124 } },
  { keywords: ["안산", "경기"], config: { label: "안산", area1: "41", areaNo: "4100000000", nx: 58, ny: 121 } },
  { keywords: ["부산", "해운대"], config: { label: "부산", area1: "26", areaNo: "2600000000", nx: 99, ny: 75 } },
  { keywords: ["광주", "하남산단"], config: { label: "광주", area1: "29", areaNo: "2900000000", nx: 58, ny: 74 } },
  { keywords: ["대구", "달서"], config: { label: "대구", area1: "27", areaNo: "2700000000", nx: 89, ny: 90 } },
  { keywords: ["창원"], config: { label: "창원", area1: "48", areaNo: "4800000000", nx: 91, ny: 77 } },
  { keywords: ["강남 복합건물"], config: { label: "서울", area1: "11", areaNo: "1100000000", nx: 61, ny: 125 } }
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

function yyyymmddOffset(days: number, now = new Date()) {
  const kst = toKst(now);
  kst.setDate(kst.getDate() + days);
  return yyyymmdd(kst);
}

function formatLivingIndexTime(now = new Date()) {
  const kst = toKst(now);
  const hour = kst.getHours();
  const baseHour = hour < 6 ? "1800" : hour < 18 ? "0600" : "1800";
  if (hour < 6) {
    kst.setDate(kst.getDate() - 1);
  }
  return `${yyyymmdd(kst)}${baseHour.slice(0, 2)}`;
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

function isOutdoorHeatContext(question: string) {
  return /옥외|실외|야외|외벽|지붕|도로|조경|도장|건설|비계|고소|하역|폭염|자외선|여름|한여름|온열|열사병|열탈진|열경련/.test(question);
}

function uvRiskLabel(value?: string) {
  const numeric = Number(value || "");
  if (!Number.isFinite(numeric)) return "";
  if (numeric >= 11) return "위험";
  if (numeric >= 8) return "매우높음";
  if (numeric >= 6) return "높음";
  if (numeric >= 3) return "보통";
  return "낮음";
}

function heatRiskLevelByTemperature(value?: string): KmaSignal["heatRiskLevel"] | undefined {
  const numeric = Number(value || "");
  if (!Number.isFinite(numeric)) return undefined;
  if (numeric >= 35) return "위험";
  if (numeric >= 33) return "매우높음";
  if (numeric >= 31) return "높음";
  return undefined;
}

function firstIndexValue(item: LivingWeatherIndexItem) {
  const keys: Array<keyof LivingWeatherIndexItem> = [
    "h0",
    "h3",
    "h6",
    "h9",
    "h12",
    "h15",
    "h18",
    "h21",
    "today",
    "value",
    "idx",
    "uv"
  ];
  return keys.map((key) => item[key]).find((value) => typeof value === "string" && value.trim()) || "";
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

function normalizeArray<T>(item?: T[] | T) {
  if (Array.isArray(item)) return item;
  return item ? [item] : [];
}

async function fetchWarningSignal(location: LocationConfig): Promise<KmaSignal> {
  try {
    const url = new URL("https://apis.data.go.kr/1360000/WthrWrnInfoService/getWthrWrnList");
    url.searchParams.set("serviceKey", serviceKey);
    url.searchParams.set("pageNo", "1");
    url.searchParams.set("numOfRows", "20");
    url.searchParams.set("dataType", "JSON");
    url.searchParams.set("stnId", "108");
    url.searchParams.set("fromTmFc", yyyymmddOffset(-1));
    url.searchParams.set("toTmFc", yyyymmddOffset(1));

    const text = await fetchWithTimeout(url.toString(), "기상특보");
    const parsed = JSON.parse(text) as WeatherWarningEnvelope;
    const resultCode = parsed.response?.header?.resultCode;
    if (resultCode && resultCode !== "00") {
      throw new Error(parsed.response?.header?.resultMsg || `기상특보 resultCode ${resultCode}`);
    }
    const items = normalizeArray(parsed.response?.body?.items?.item);
    const relevant = items.filter((item) => {
      const haystack = `${item.title || ""} ${item.stnNm || ""}`;
      return !item.stnNm || haystack.includes(location.label) || haystack.includes("전국");
    });
    const picked = relevant[0] || items[0];

    return {
      endpoint: "기상특보",
      mode: "live",
      summary: picked
        ? `최근 특보 확인: ${picked.title || picked.stnNm || "특보 정보"}`
        : "최근 발표 특보 없음",
      forecastTime: picked?.tmFc,
      detail: picked
        ? `기상청 기상특보 조회 성공 (${picked.stnNm || "전국"}, ${picked.tmFc || "발표시각 미표기"})`
        : `기상청 기상특보 조회 성공 (${location.label}, 최근 특보 없음)`
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      endpoint: "기상특보",
      mode: "fallback",
      summary: "기상특보 연결 보류",
      detail: `기상청 기상특보 연결 점검 필요: ${message}`
    };
  }
}

async function fetchImpactForecastSignal(location: LocationConfig): Promise<KmaSignal> {
  try {
    const url = new URL("https://apis.data.go.kr/1360000/ImpactInfoService/getHWImpactValue");
    url.searchParams.set("serviceKey", serviceKey);
    url.searchParams.set("pageNo", "1");
    url.searchParams.set("numOfRows", "30");
    url.searchParams.set("dataType", "JSON");
    url.searchParams.set("tm", yyyymmddOffset(0));

    const text = await fetchWithTimeout(url.toString(), "영향예보");
    const parsed = JSON.parse(text) as ImpactForecastEnvelope;
    const resultCode = parsed.response?.header?.resultCode;
    if (resultCode && resultCode !== "00") {
      throw new Error(parsed.response?.header?.resultMsg || `영향예보 resultCode ${resultCode}`);
    }
    const items = normalizeArray(parsed.response?.body?.items?.item);
    const relevant = items.filter((item) => {
      const haystack = `${item.regName || ""} ${item.clsfc || ""}`;
      return haystack.includes(location.label) || item.clsfc === "산업";
    });
    const picked = relevant.find((item) => item.clsfc === "산업") || relevant[0] || items[0];

    return {
      endpoint: "영향예보",
      mode: "live",
      summary: picked
        ? `영향예보 ${picked.clsfc || "분야"} ${picked.value || "정보"} (${picked.regName || location.label})`
        : "폭염·한파 영향예보 발표 없음",
      forecastTime: picked?.tmEf,
      detail: picked
        ? `기상청 영향예보 조회 성공 (${picked.regName || location.label}, ${picked.clsfc || "분야 미표기"})`
        : `기상청 영향예보 조회 성공 (${location.label}, 발표 자료 없음)`
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      endpoint: "영향예보",
      mode: "fallback",
      summary: "영향예보 연결 보류",
      detail: `기상청 영향예보 연결 점검 필요: ${message}`
    };
  }
}

async function fetchLivingUvSignal(location: LocationConfig): Promise<KmaSignal> {
  try {
    const url = new URL("https://apis.data.go.kr/1360000/LivingWthrIdxServiceV4/getUVIdxV4");
    url.searchParams.set("serviceKey", serviceKey);
    url.searchParams.set("pageNo", "1");
    url.searchParams.set("numOfRows", "10");
    url.searchParams.set("dataType", "JSON");
    url.searchParams.set("areaNo", location.areaNo);
    url.searchParams.set("time", formatLivingIndexTime());

    const text = await fetchWithTimeout(url.toString(), "생활기상 자외선");
    const parsed = JSON.parse(text) as LivingWeatherIndexEnvelope;
    const resultCode = parsed.response?.header?.resultCode;
    if (resultCode && resultCode !== "00") {
      throw new Error(parsed.response?.header?.resultMsg || `생활기상 자외선 resultCode ${resultCode}`);
    }
    const item = normalizeArray(parsed.response?.body?.items?.item)[0];
    if (!item) {
      throw new Error(parsed.response?.header?.resultMsg || "생활기상 자외선 응답이 비어 있습니다.");
    }

    const uvIndex = firstIndexValue(item);
    const risk = uvRiskLabel(uvIndex);
    return {
      endpoint: "생활기상 자외선",
      mode: "live",
      summary: `자외선지수 ${uvIndex || "정보없음"}${risk ? ` (${risk})` : ""}`,
      forecastTime: item.date,
      uvIndex,
      detail: `기상청 생활기상지수 자외선 조회 성공 (${location.label}, areaNo ${location.areaNo})`
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      endpoint: "생활기상 자외선",
      mode: "fallback",
      summary: "자외선지수 연결 보류",
      detail: `기상청 생활기상지수 자외선 연결 점검 필요: ${message}`
    };
  }
}

async function fetchErythemalUvSignal(location: LocationConfig): Promise<KmaSignal> {
  if (!kierErythemalUvEndpoint) {
    return {
      endpoint: "실시간 홍반자외선",
      mode: "fallback",
      summary: "실시간 홍반자외선 endpoint 설정 대기",
      detail: "KIER_ERYTHEMAL_UV_ENDPOINT가 없어 한국에너지기술연구원 실시간 홍반자외선 API는 제출서류상 확장 데이터로 분리합니다."
    };
  }

  try {
    const url = new URL(kierErythemalUvEndpoint);
    url.searchParams.set("serviceKey", serviceKey);
    url.searchParams.set("pageNo", url.searchParams.get("pageNo") || "1");
    url.searchParams.set("numOfRows", url.searchParams.get("numOfRows") || "10");
    if (!url.searchParams.has("dataType")) {
      url.searchParams.set("dataType", "JSON");
    }
    if (!url.searchParams.has("areaNo")) {
      url.searchParams.set("areaNo", location.areaNo);
    }
    if (!url.searchParams.has("nx")) {
      url.searchParams.set("nx", String(location.nx));
    }
    if (!url.searchParams.has("ny")) {
      url.searchParams.set("ny", String(location.ny));
    }

    const text = await fetchWithTimeout(url.toString(), "실시간 홍반자외선");
    const parsed = JSON.parse(text) as LivingWeatherIndexEnvelope;
    const resultCode = parsed.response?.header?.resultCode;
    if (resultCode && resultCode !== "00") {
      throw new Error(parsed.response?.header?.resultMsg || `실시간 홍반자외선 resultCode ${resultCode}`);
    }
    const item = normalizeArray(parsed.response?.body?.items?.item)[0];
    const uvIndex = item ? firstIndexValue(item) : "";
    const risk = uvRiskLabel(uvIndex);

    return {
      endpoint: "실시간 홍반자외선",
      mode: "live",
      summary: `홍반자외선 ${uvIndex || "확인됨"}${risk ? ` (${risk})` : ""}`,
      forecastTime: item?.date,
      uvIndex,
      detail: `한국에너지기술연구원 실시간 홍반자외선 조회 성공 (${location.label})`
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      endpoint: "실시간 홍반자외선",
      mode: "fallback",
      summary: "실시간 홍반자외선 연결 보류",
      detail: `한국에너지기술연구원 실시간 홍반자외선 연결 점검 필요: ${message}`
    };
  }
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
  const warning = liveSignals.find((signal) => signal.endpoint === "기상특보" && !signal.summary.includes("없음"));
  const impact = liveSignals.find((signal) => signal.endpoint === "영향예보" && /주의|경고|위험|심각/.test(signal.summary));
  const outdoorHeatLevel = liveSignals
    .map((signal) => heatRiskLevelByTemperature(signal.temperatureC) || signal.heatRiskLevel)
    .find((level): level is "높음" | "매우높음" | "위험" => Boolean(level));
  const uvSignal = liveSignals.find((signal) => {
    if (signal.endpoint !== "생활기상 자외선" && signal.endpoint !== "실시간 홍반자외선") return false;
    const label = uvRiskLabel(signal.uvIndex);
    return label === "높음" || label === "매우높음" || label === "위험";
  });

  const actions: string[] = [];
  if (warning) {
    actions.push("기상특보가 확인되어 작업 전 작업중지 기준과 옥외·고소작업 허용 여부를 관리감독자가 재판단");
  }
  if (impact) {
    actions.push("폭염·한파 영향예보가 확인되어 휴식, 음수, 보온·냉방, 취약 작업자 배치를 별도 점검");
  }
  if (outdoorHeatLevel) {
    actions.push("옥외작업 폭염 위험이 있어 물·그늘·휴식, 신규·고령·중작업자 상태 확인, 14~17시 작업 조절 기준을 TBM에서 공유");
  }
  if (uvSignal) {
    actions.push("자외선 노출 위험이 높아 차광 보호구, 긴소매 작업복, 그늘 휴식, 피부 이상 징후 확인을 교육기록에 포함");
  }
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
  const outdoorHeatContext = isOutdoorHeatContext(question);

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
        { endpoint: "단기예보", mode: "fallback", summary: "서비스 키 필요", detail: "서비스 키 필요" },
        ...(outdoorHeatContext
          ? [
              { endpoint: "생활기상 자외선" as const, mode: "fallback" as const, summary: "서비스 키 필요", detail: "서비스 키 필요" }
            ]
          : [])
      ]
    };
  }

  const { baseDate, baseTime } = formatKmaBaseDate();
  const ultraNow = formatUltraNowBase();
  const ultraForecast = formatUltraForecastBase();
  const cacheKey = `${location.label}:${outdoorHeatContext ? "outdoor" : "standard"}:${ultraNow.baseDate}:${ultraNow.baseTime}:${ultraForecast.baseTime}:${baseDate}:${baseTime}`;
  const cached = weatherCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return {
      ...cached.value,
      detail: `${cached.value.detail} / in-memory cache`
    };
  }

  const baseSignals = await Promise.all([
    fetchUltraNowSignal(location),
    fetchUltraForecastSignal(location),
    fetchVillageForecastSignal(location),
    fetchWarningSignal(location),
    fetchImpactForecastSignal(location)
  ]);
  const outdoorSignals = outdoorHeatContext
    ? await Promise.all([
        fetchLivingUvSignal(location),
        fetchErythemalUvSignal(location)
      ])
    : [];
  const signals = [...baseSignals, ...outdoorSignals];
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
