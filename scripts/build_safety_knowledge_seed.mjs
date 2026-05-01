#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const dataDir = path.join(root, "data", "safety-knowledge");
const knowledgeDir = path.join(root, "knowledge");
const wikiDir = path.join(knowledgeDir, "wiki");
const evaluationDir = path.join(root, "evaluation", "safety-knowledge-seed");

const now = new Date().toISOString();
const REQUEST_TIMEOUT_MS = 12_000;

function loadEnvLocal() {
  const envPath = path.join(root, ".env.local");
  if (!fs.existsSync(envPath)) return;
  const content = fs.readFileSync(envPath, "utf8");
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const separator = trimmed.indexOf("=");
    if (separator < 1) continue;
    const key = trimmed.slice(0, separator).trim();
    if (process.env[key]) continue;
    const rawValue = trimmed.slice(separator + 1).trim();
    process.env[key] = rawValue.replace(/^['"]|['"]$/g, "");
  }
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function writeJson(filePath, payload) {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
}

function writeText(filePath, content) {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, content, "utf8");
}

function slug(value) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9가-힣]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function stripMarkup(value) {
  return String(value || "")
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readString(record, keys) {
  if (!isRecord(record)) return "";
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) return stripMarkup(value);
    if (typeof value === "number") return String(value);
  }
  return "";
}

function readArrayEnvelope(value) {
  if (Array.isArray(value)) return value.filter(isRecord);
  if (!isRecord(value)) return [];
  const candidates = [
    value.items,
    isRecord(value.items) ? value.items.item : undefined,
    isRecord(value.response) && isRecord(value.response.body) && isRecord(value.response.body.items) ? value.response.body.items.item : undefined,
    isRecord(value.response) && isRecord(value.response.body) ? value.response.body.total_media : undefined,
    isRecord(value.body) && isRecord(value.body.items) ? value.body.items.item : undefined,
    isRecord(value.body) ? value.body.total_media : undefined,
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

async function fetchText(url, options = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs || REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      cache: "no-store",
      signal: controller.signal,
      headers: {
        accept: "application/json, application/xml;q=0.9, text/plain;q=0.8, */*;q=0.7",
        "user-agent": "SafeGuard/1.0 knowledge-seed (+https://safeguard-contest-mvp.vercel.app)"
      }
    });
    const text = await response.text();
    if (!response.ok) throw new Error(text.slice(0, 240) || `HTTP ${response.status}`);
    return text;
  } finally {
    clearTimeout(timeout);
  }
}

function parseJsonRecords(text) {
  try {
    const parsed = JSON.parse(text);
    if (isRecord(parsed)) {
      const header = isRecord(parsed.header)
        ? parsed.header
        : isRecord(parsed.response) && isRecord(parsed.response.header)
          ? parsed.response.header
          : undefined;
      const resultCode = readString(header, ["resultCode", "returnReasonCode"]);
      const resultMessage = readString(header, ["resultMsg", "returnAuthMsg", "message"]);
      if (resultCode && resultCode !== "00") {
        return { records: [], detail: `${resultCode}${resultMessage ? ` / ${resultMessage}` : ""}` };
      }
    }
    return { records: readArrayEnvelope(parsed), detail: "ok" };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { records: [], detail: `parse_error: ${message}` };
  }
}

const officialSources = [
  {
    id: "kosha-risk-assessment-program",
    agency: "KOSHA",
    title: "KOSHA 위험성평가 사업안내",
    sourceType: "official-guide",
    url: "https://www.kosha.or.kr/kosha/business/rskassessment.do",
    appliesTo: ["riskAssessment", "safetyEducation"],
    summary: "유해·위험요인 파악, 위험성 결정, 감소대책 수립·실행, 공유·기록 흐름을 위험성평가 문서 구조에 반영한다."
  },
  {
    id: "kosha-4m-risk-manual",
    agency: "KOSHA",
    title: "KOSHA 4M 기법 위험성평가 메뉴얼",
    sourceType: "official-manual",
    url: "https://oshri.kosha.or.kr/kosha/data/rskassessmentd.do?articleNo=84457&mode=view",
    appliesTo: ["riskAssessment"],
    summary: "Man, Machine, Media, Management 관점으로 위험요인을 점검하고 위험성평가표의 누락을 줄인다."
  },
  {
    id: "kosha-tbm-ops",
    agency: "KOSHA",
    title: "작업 전 안전점검회의(TBM) OPS",
    sourceType: "official-guide",
    url: "https://edu.kosha.or.kr/headquater/support/assist/noticeboard/details?bbsEsntlNo=2913",
    appliesTo: ["tbmBriefing", "tbmLog", "safetyEducation"],
    summary: "작업내용, 위험요인, 안전대책, 참석자 확인, 기록 메모 항목을 TBM 문서에 반영한다."
  },
  {
    id: "moel-tbm-education-credit",
    agency: "MOEL",
    title: "TBM 정기교육 시간 인정 안내",
    sourceType: "press",
    url: "https://www.moel.go.kr/news/enews/report/enewsView.do?news_seq=16488",
    appliesTo: ["tbmLog", "safetyEducation"],
    summary: "위험성평가 결과를 반영한 TBM을 교육 증빙으로 활용할 수 있음을 안전교육 기록에 보조 문구로 반영한다."
  },
  {
    id: "kosha-safety-education-guidebook",
    agency: "KOSHA",
    title: "산업안전보건교육 가이드북",
    sourceType: "official-guidebook",
    url: "https://oshri.kosha.or.kr/kosha/intro/gyeonggiBranch_A.do?articleNo=414441&attachNo=233889&mode=download",
    appliesTo: ["safetyEducation"],
    summary: "교육대상, 교육내용, 확인방법, 후속 교육 추천 항목을 안전보건교육 기록에 분리한다."
  },
  {
    id: "kosha-forklift-plan",
    agency: "KOSHA",
    title: "지게차의 안전작업계획서 작성지침",
    sourceType: "official-guide",
    url: "https://oshri.kosha.or.kr/kosha/intro/northernGyeonggiBranch_A.do?articleNo=351943&attachNo=199463&mode=download",
    appliesTo: ["riskAssessment", "workPlan", "tbmBriefing"],
    summary: "지게차 작업계획, 운행경로, 신호방법, 접근금지구역 확인 항목을 보강한다."
  },
  {
    id: "kosha-hot-work-manual",
    agency: "KOSHA",
    title: "화기작업 화재·폭발 예방 매뉴얼",
    sourceType: "official-manual",
    url: "https://kosha.or.kr/kosha/data/screening_e.do?articleNo=235017&attachNo=113021&mode=download",
    appliesTo: ["riskAssessment", "tbmBriefing", "safetyEducation", "emergencyResponse"],
    summary: "작업허가, 가연물 제거, 화재감시자, 소화설비 확인 문구를 보강한다."
  },
  {
    id: "kosha-smart-search",
    agency: "KOSHA",
    title: "안전보건법령 스마트검색",
    sourceType: "open-api",
    url: "https://apis.data.go.kr/B552468/srch/smartSearch",
    appliesTo: ["evidence", "riskAssessment", "tbmBriefing"],
    summary: "법령, KOSHA GUIDE, 안전보건 미디어 자료를 키워드로 검색해 문서 반영 근거 후보를 찾는다."
  },
  {
    id: "kosha-media-link",
    agency: "KOSHA",
    title: "안전보건자료 링크 서비스",
    sourceType: "open-api",
    url: "https://apis.data.go.kr/B552468/selectMediaList01/getselectMediaList01",
    appliesTo: ["safetyEducation", "foreignWorkerBriefing", "evidence"],
    summary: "제작형태, 업종, 재해유형, 외국어 조건으로 교육·홍보 자료 링크를 찾는다."
  },
  {
    id: "kosha-domestic-accident-cases",
    agency: "KOSHA",
    title: "국내재해사례 게시판 정보 조회서비스",
    sourceType: "open-api",
    url: "https://apis.data.go.kr/B552468/disaster_api02/getdisaster_api02",
    appliesTo: ["riskAssessment", "tbmBriefing", "safetyEducation", "emergencyResponse"],
    summary: "유사 재해사례를 위험성평가와 TBM 예방 포인트에 연결한다."
  },
  {
    id: "kosha-fatal-accident-board",
    agency: "KOSHA",
    title: "사고사망 게시판 정보 조회서비스",
    sourceType: "open-api",
    url: "https://apis.data.go.kr/B552468/news_api02/getNews_api02",
    appliesTo: ["riskAssessment", "tbmBriefing", "emergencyResponse"],
    summary: "사고사망 일자, 장소, 사고개요, 피해 규모를 예방 포인트에 연결한다."
  },
  {
    id: "kosha-msds",
    agency: "KOSHA",
    title: "물질안전보건자료 조회 서비스",
    sourceType: "open-api",
    url: "https://apis.data.go.kr/B552468/msdschem/getChemList",
    appliesTo: ["chemical", "riskAssessment", "safetyEducation", "emergencyResponse"],
    summary: "화학물질 유해성, 응급조치, 누출, 보호구, 법적 규제 항목의 원문 근거를 연결한다."
  },
  {
    id: "lawgo-industrial-safety-law",
    agency: "MOLEG",
    title: "법제처 국가법령정보 산업안전보건법",
    sourceType: "law",
    url: "https://www.law.go.kr/법령/산업안전보건법",
    appliesTo: ["legalEvidence", "riskAssessment", "safetyEducation"],
    summary: "사업주와 근로자의 안전보건 조치 의무를 문서 근거 초안에 연결한다."
  },
  {
    id: "lawgo-serious-accident-law",
    agency: "MOLEG",
    title: "법제처 국가법령정보 중대재해 처벌 등에 관한 법률",
    sourceType: "law",
    url: "https://www.law.go.kr/법령/중대재해처벌등에관한법률",
    appliesTo: ["emergencyResponse", "riskAssessment"],
    summary: "경영책임자 등의 안전보건 확보 의무를 비상대응과 관리체계 점검 문구에 보조 반영한다."
  }
];

const hazardSeeds = [
  {
    id: "fall-scaffold",
    title: "비계·고소작업 추락",
    keywords: ["비계", "추락", "고소", "외벽", "작업발판", "안전대"],
    primaryDocuments: ["riskAssessment", "tbmBriefing", "safetyEducation", "photoEvidence"],
    controls: ["작업발판·난간·바퀴 잠금 확인", "안전대와 안전모 착용 확인", "강풍·우천 시 작업중지 기준 공유", "추락 위험구역 출입통제"],
    sourceIds: ["kosha-risk-assessment-program", "kosha-4m-risk-manual", "kosha-smart-search", "lawgo-industrial-safety-law"]
  },
  {
    id: "forklift-traffic",
    title: "지게차·보행자 동선 충돌",
    keywords: ["지게차", "동선", "상하차", "보행자", "충돌", "끼임"],
    primaryDocuments: ["riskAssessment", "workPlan", "tbmBriefing", "tbmLog"],
    controls: ["지게차 운행경로와 보행동선 분리", "신호수 배치와 사각지대 확인", "하역구역 접근금지 표시", "운전 전 점검과 후진 경보 확인"],
    sourceIds: ["kosha-forklift-plan", "kosha-domestic-accident-cases", "kosha-smart-search", "lawgo-industrial-safety-law"]
  },
  {
    id: "hot-work-fire",
    title: "용접·절단 화기작업 화재",
    keywords: ["용접", "절단", "화기", "불티", "가연물", "화재감시자"],
    primaryDocuments: ["riskAssessment", "workPlan", "tbmBriefing", "emergencyResponse"],
    controls: ["화기작업 허가와 화재감시자 지정", "가연물 제거 또는 방염포 설치", "소화기와 비상대응 경로 확인", "작업 후 잔불 확인"],
    sourceIds: ["kosha-hot-work-manual", "kosha-msds", "kosha-fatal-accident-board", "lawgo-industrial-safety-law"]
  },
  {
    id: "confined-space",
    title: "밀폐공간 산소결핍·중독",
    keywords: ["밀폐공간", "맨홀", "탱크", "산소결핍", "유해가스", "환기"],
    primaryDocuments: ["riskAssessment", "tbmBriefing", "safetyEducation", "emergencyResponse"],
    controls: ["출입 전 산소·유해가스 측정", "환기와 감시인 배치", "구조장비와 구조절차 공유", "단독작업 금지"],
    sourceIds: ["kosha-smart-search", "kosha-domestic-accident-cases", "lawgo-industrial-safety-law"]
  },
  {
    id: "chemical-msds",
    title: "화학물질·세척제 노출",
    keywords: ["화학물질", "세척제", "MSDS", "유해성", "누출", "보호구"],
    primaryDocuments: ["riskAssessment", "safetyEducation", "emergencyResponse", "foreignWorkerBriefing"],
    controls: ["MSDS 확인", "보안경·장갑·호흡보호구 지정", "누출 시 대피·환기·차단 절차 공유", "외국인 근로자 쉬운 문장 안내"],
    sourceIds: ["kosha-msds", "kosha-media-link", "lawgo-industrial-safety-law"]
  },
  {
    id: "weather-wind-rain-heat",
    title: "강풍·우천·폭염 작업조건",
    keywords: ["강풍", "우천", "폭염", "미끄럼", "기상특보", "풍속"],
    primaryDocuments: ["riskAssessment", "tbmBriefing", "tbmLog", "workPlan"],
    controls: ["기상청 현재·예보 신호 확인", "작업중지 판단자 지정", "미끄럼·전도 위험구역 통제", "휴식·수분·그늘 기준 공유"],
    sourceIds: ["kosha-risk-assessment-program", "lawgo-industrial-safety-law"]
  },
  {
    id: "foreign-worker-briefing",
    title: "외국인 근로자 안전교육·전송",
    keywords: ["외국인", "다국어", "신규", "베트남어", "중국어", "몽골어", "태국어"],
    primaryDocuments: ["foreignWorkerBriefing", "foreignWorkerTransmission", "safetyEducation", "dispatch"],
    controls: ["쉬운 한국어 우선 작성", "국적·주 사용 언어별 핵심 문장 제공", "관리자 또는 통역 확인 문구 포함", "전송 로그와 교육 확인 기록 연결"],
    sourceIds: ["kosha-media-link", "kosha-safety-education-guidebook", "moel-tbm-education-credit"]
  },
  {
    id: "risk-assessment-tbm-loop",
    title: "위험성평가·TBM·교육 닫힌 루프",
    keywords: ["위험성평가", "TBM", "안전교육", "작업 전", "기록"],
    primaryDocuments: ["workpackSummary", "riskAssessment", "tbmBriefing", "tbmLog", "safetyEducation"],
    controls: ["위험요인 파악", "감소대책 수립", "TBM 공유", "교육 확인", "사진·증빙 보관"],
    sourceIds: ["kosha-risk-assessment-program", "kosha-tbm-ops", "moel-tbm-education-credit", "kosha-safety-education-guidebook"]
  }
];

const templateSeeds = [
  {
    id: "risk-assessment",
    title: "위험성평가표",
    requiredSections: ["사전준비", "유해·위험요인 파악", "위험성 결정", "감소대책 수립 및 실행", "공유·교육", "조치 확인"],
    reflectedSources: ["kosha-risk-assessment-program", "kosha-4m-risk-manual", "lawgo-industrial-safety-law"]
  },
  {
    id: "tbm",
    title: "TBM/작업 전 안전점검회의",
    requiredSections: ["작업내용", "위험요인", "안전대책", "참석자 확인", "사진·영상 기록 메모"],
    reflectedSources: ["kosha-tbm-ops", "moel-tbm-education-credit"]
  },
  {
    id: "safety-education",
    title: "안전보건교육 기록",
    requiredSections: ["교육명", "교육일시", "교육대상", "교육내용", "확인방법", "후속 교육"],
    reflectedSources: ["kosha-safety-education-guidebook", "moel-tbm-education-credit", "kosha-media-link"]
  },
  {
    id: "work-plan",
    title: "작업계획서",
    requiredSections: ["작업개요", "작업순서", "장비·인원·허가 확인", "작업중지 기준", "확인 근거"],
    reflectedSources: ["kosha-forklift-plan", "kosha-hot-work-manual", "lawgo-industrial-safety-law"]
  }
];

const trainingSeeds = [
  {
    id: "work24-foreign-worker-employment-education",
    title: "외국인근로자 취업교육",
    provider: "고용24/직업훈련 정보",
    appliesTo: ["foreignWorkerBriefing", "safetyEducation"],
    fitRule: "외국인, 신규 투입자, 다국어, 쉬운 문장 안내가 있는 현장에서 후속 교육 후보로 노출한다.",
    caution: "당일 TBM 또는 사업장 자체 안전보건교육을 대체하지 않는다."
  },
  {
    id: "kosha-skillup-construction-safety",
    title: "건설안전기사·건설안전 관련 과정",
    provider: "KOSHA/안전보건교육포털 또는 Work24",
    appliesTo: ["safetyEducation", "managerTraining"],
    fitRule: "건설, 비계, 추락, 작업계획서 키워드가 있는 현장에서 관리자·감독자 후속 교육 후보로 노출한다.",
    caution: "현장 작업 전 교육 확인과 별도로 후속 역량 강화용으로 표시한다."
  },
  {
    id: "kosha-chemical-msds-education",
    title: "화학물질·MSDS 안전교육",
    provider: "KOSHA 안전보건자료/교육자료",
    appliesTo: ["chemical", "safetyEducation"],
    fitRule: "세척제, 산성 약품, 용제, 페인트, 신나, MSDS 키워드가 있는 현장에서 우선 노출한다.",
    caution: "물질별 최신 MSDS 원문 확인 후 사용한다."
  }
];

function sourceMap() {
  return new Map(officialSources.map((source) => [source.id, source]));
}

function buildLegalMap() {
  return [
    {
      id: "industrial-safety-health-act-general-duty",
      sourceId: "lawgo-industrial-safety-law",
      title: "산업안전보건법 사업주·근로자 안전보건 조치",
      appliesTo: ["riskAssessment", "tbmBriefing", "safetyEducation"],
      plainLanguage: "사업주와 근로자가 산업재해 예방을 위해 지켜야 할 기준과 조치 의무를 현장 문서의 기본 근거로 쓴다.",
      caution: "조문 번호와 최신 시행일은 Law.go 원문에서 다시 확인한다."
    },
    {
      id: "industrial-safety-health-act-education",
      sourceId: "lawgo-industrial-safety-law",
      title: "산업안전보건법 안전보건교육",
      appliesTo: ["safetyEducation", "tbmLog"],
      plainLanguage: "작업 전 교육, 보호구, 작업중지 기준, 신규 투입자 안내를 안전보건교육 기록으로 남기는 근거 축이다.",
      caution: "교육 인정 여부는 작업 내용과 기록 방식에 따라 현장 검토가 필요하다."
    },
    {
      id: "serious-accident-prevention-system",
      sourceId: "lawgo-serious-accident-law",
      title: "중대재해처벌법 안전보건 확보 체계",
      appliesTo: ["emergencyResponse", "workpackSummary"],
      plainLanguage: "위험요인 확인, 개선대책, 보고체계, 재발방지 기록을 관리체계 점검 문구로 연결한다.",
      caution: "법적 책임 판단을 대신하지 않고 관리체계 기록 보조 근거로만 쓴다."
    }
  ];
}

function buildAccidentCases() {
  return [
    {
      id: "accident-fall-scaffold",
      hazardId: "fall-scaffold",
      title: "비계·작업발판 추락 유사사례",
      industry: "건설업",
      accidentType: "추락",
      summary: "작업발판, 난간, 안전대, 강풍 조건을 점검하지 않으면 추락 위험이 커진다.",
      preventionPoint: "작업 전 비계 고정, 난간, 안전대, 작업중지 기준을 TBM에서 확인한다.",
      sourceIds: ["kosha-domestic-accident-cases", "kosha-fatal-accident-board"]
    },
    {
      id: "accident-forklift-contact",
      hazardId: "forklift-traffic",
      title: "지게차와 보행자 동선 겹침 유사사례",
      industry: "물류·제조",
      accidentType: "충돌·끼임",
      summary: "하역구역에서 보행자와 지게차 동선이 겹치면 충돌·끼임 위험이 높다.",
      preventionPoint: "운행경로 분리, 신호수, 접근금지 표시, 후진 경보 확인을 작업 전 체크한다.",
      sourceIds: ["kosha-domestic-accident-cases", "kosha-forklift-plan"]
    },
    {
      id: "accident-hot-work-fire",
      hazardId: "hot-work-fire",
      title: "용접 불티 화재 유사사례",
      industry: "제조·건설",
      accidentType: "화재",
      summary: "용접·절단 불티가 가연물에 옮겨 붙으면 작업 종료 후에도 화재로 이어질 수 있다.",
      preventionPoint: "화기작업 허가, 가연물 제거, 화재감시자, 잔불 확인을 기록한다.",
      sourceIds: ["kosha-hot-work-manual", "kosha-fatal-accident-board"]
    },
    {
      id: "accident-confined-space-poisoning",
      hazardId: "confined-space",
      title: "밀폐공간 산소결핍·중독 유사사례",
      industry: "시설·건설",
      accidentType: "질식·중독",
      summary: "출입 전 측정과 환기 없이 들어가면 산소결핍 또는 유해가스 중독 위험이 있다.",
      preventionPoint: "산소·유해가스 측정, 환기, 감시인, 구조절차를 작업 전 확인한다.",
      sourceIds: ["kosha-domestic-accident-cases", "kosha-smart-search"]
    },
    {
      id: "accident-chemical-exposure",
      hazardId: "chemical-msds",
      title: "세척제·용제 노출 유사사례",
      industry: "제조·서비스",
      accidentType: "화학물질 노출",
      summary: "MSDS 확인 없이 세척제나 용제를 취급하면 피부·호흡기 노출과 누출 대응 실패 위험이 있다.",
      preventionPoint: "MSDS, 보호구, 환기, 누출 시 대피·차단 절차를 안전교육에 반영한다.",
      sourceIds: ["kosha-msds", "kosha-media-link"]
    }
  ];
}

async function fetchKoshaSmartSearch(keyword, serviceKey) {
  if (!serviceKey) return { mode: "not_configured", keyword, records: [], detail: "DATA_GO_KR_SERVICE_KEY 없음" };
  const url = new URL("https://apis.data.go.kr/B552468/srch/smartSearch");
  url.searchParams.set("serviceKey", serviceKey);
  url.searchParams.set("pageNo", "1");
  url.searchParams.set("numOfRows", "5");
  url.searchParams.set("searchValue", keyword);
  url.searchParams.set("category", "0");
  try {
    const parsed = parseJsonRecords(await fetchText(url.toString()));
    return {
      mode: parsed.records.length ? "live" : "empty",
      keyword,
      records: parsed.records.slice(0, 5).map((record) => ({
        title: readString(record, ["title", "ttl", "sj", "lawNm", "guideNm"]) || `KOSHA 스마트검색: ${keyword}`,
        summary: readString(record, ["summary", "contents", "cn", "content", "desc", "highlight_content"]) || "KOSHA 스마트검색 응답 항목",
        sourceUrl: readString(record, ["filepath", "url", "link", "detailUrl"]) || "https://apis.data.go.kr/B552468/srch/smartSearch"
      })),
      detail: parsed.detail
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { mode: "error", keyword, records: [], detail: message };
  }
}

async function fetchKoshaMedia(keyword, serviceKey) {
  if (!serviceKey) return { mode: "not_configured", keyword, records: [], detail: "DATA_GO_KR_SERVICE_KEY 없음" };
  const url = new URL("https://apis.data.go.kr/B552468/selectMediaList01/getselectMediaList01");
  url.searchParams.set("serviceKey", serviceKey);
  url.searchParams.set("pageNo", "1");
  url.searchParams.set("numOfRows", "5");
  url.searchParams.set("_type", "json");
  url.searchParams.set("ctgr01", "12");
  if (["비계", "추락", "강풍"].some((item) => keyword.includes(item))) url.searchParams.set("ctgr02", "3");
  if (["용접", "화학", "MSDS"].some((item) => keyword.includes(item))) url.searchParams.set("ctgr02", "2");
  if (["지게차", "물류"].some((item) => keyword.includes(item))) url.searchParams.set("ctgr02", "4");
  try {
    const parsed = parseJsonRecords(await fetchText(url.toString()));
    return {
      mode: parsed.records.length ? "live" : "empty",
      keyword,
      records: parsed.records.slice(0, 5).map((record) => ({
        title: readString(record, ["title", "ttl", "mediaTitle", "sj", "dataNm", "name"]) || `KOSHA 안전보건자료: ${keyword}`,
        summary: readString(record, ["summary", "contents", "desc", "mediaCn", "cont", "dataCn"]) || "KOSHA 안전보건자료 링크 응답 항목",
        sourceUrl: readString(record, ["url", "link", "mediaUrl", "fileUrl", "filepath"]) || "https://apis.data.go.kr/B552468/selectMediaList01/getselectMediaList01"
      })),
      detail: parsed.detail
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { mode: "error", keyword, records: [], detail: message };
  }
}

async function collectLiveSupplements() {
  const serviceKey = (process.env.DATA_GO_KR_SERVICE_KEY || process.env.PUBLIC_DATA_API_KEY || "").trim();
  const keywords = ["비계 추락", "지게차 충돌", "용접 화재", "밀폐공간", "MSDS 화학물질", "외국인 안전교육", "위험성평가 TBM"];
  const smartSearch = [];
  const media = [];
  for (const keyword of keywords) {
    smartSearch.push(await fetchKoshaSmartSearch(keyword, serviceKey));
    media.push(await fetchKoshaMedia(keyword, serviceKey));
  }
  return {
    generatedAt: now,
    serviceKeyConfigured: Boolean(serviceKey),
    smartSearch,
    media
  };
}

function buildHazards(liveSupplements) {
  const liveByKeyword = new Map();
  for (const item of [...liveSupplements.smartSearch, ...liveSupplements.media]) {
    liveByKeyword.set(item.keyword, item);
  }
  return hazardSeeds.map((hazard) => {
    const relatedLive = [...liveByKeyword.entries()]
      .filter(([keyword]) => hazard.keywords.some((hazardKeyword) => keyword.includes(hazardKeyword) || hazardKeyword.includes(keyword.split(" ")[0])))
      .flatMap(([, item]) => item.records || [])
      .slice(0, 4);
    return {
      ...hazard,
      liveEvidence: relatedLive,
      qualityFlags: {
        hasOfficialSource: hazard.sourceIds.some((id) => officialSources.some((source) => source.id === id)),
        hasControls: hazard.controls.length >= 3,
        hasDocumentMapping: hazard.primaryDocuments.length >= 3,
        hasSourceUrl: hazard.sourceIds.every((id) => officialSources.some((source) => source.id === id && source.url.startsWith("http")))
      }
    };
  });
}

function validateKnowledgeBase(payload) {
  const checks = [];
  const add = (name, pass, detail) => checks.push({ name, verdict: pass ? "pass" : "blocked", detail });

  add("hazard-count", payload.hazards.length >= 8, `${payload.hazards.length}개 위험요인`);
  add("official-source-count", payload.sources.length >= 12, `${payload.sources.length}개 공식 출처`);
  add("legal-map-count", payload.legalMap.length >= 3, `${payload.legalMap.length}개 법령 매핑`);
  add("template-count", payload.templates.length >= 4, `${payload.templates.length}개 서식 매핑`);
  add("accident-case-count", payload.accidentCases.length >= 5, `${payload.accidentCases.length}개 재해사례 seed`);
  add("source-url-preserved", payload.sources.every((source) => source.url.startsWith("http")), "모든 공식 출처 URL 보존");
  add("hazard-document-mapping", payload.hazards.every((hazard) => hazard.primaryDocuments.length >= 3), "모든 위험요인 문서 반영 위치 보유");
  add("controls-present", payload.hazards.every((hazard) => hazard.controls.length >= 3), "모든 위험요인 통제대책 보유");
  add("live-attempt-recorded", payload.liveSupplements.smartSearch.length > 0 && payload.liveSupplements.media.length > 0, "KOSHA OpenAPI live 수집 시도 기록");
  add("no-secret-leak", !JSON.stringify(payload).includes(process.env.DATA_GO_KR_SERVICE_KEY || "__NO_KEY__"), "서비스키 미저장");

  return {
    verdict: checks.some((check) => check.verdict === "blocked") ? "blocked" : "pass",
    checks
  };
}

function hazardMarkdown(hazard, sources) {
  const relatedSources = hazard.sourceIds.map((id) => sources.get(id)).filter(Boolean);
  return `# ${hazard.title}

## 적용 키워드

${hazard.keywords.map((keyword) => `- ${keyword}`).join("\n")}

## 문서 반영 위치

${hazard.primaryDocuments.map((doc) => `- ${doc}`).join("\n")}

## 현장 통제 포인트

${hazard.controls.map((control) => `- ${control}`).join("\n")}

## 공식 근거

${relatedSources.map((source) => `- [${source.title}](${source.url}) - ${source.summary}`).join("\n")}

## live 보강 근거

${hazard.liveEvidence.length ? hazard.liveEvidence.map((item) => `- ${item.title}: ${item.summary}`).join("\n") : "- 이번 수집에서 표시 가능한 live 보강 항목은 없었습니다. 공식 seed 근거를 사용합니다."}

## 사용 주의

이 문서는 공식자료 기반 초안입니다. 최종 문구와 적용 여부는 현장 조건과 원문 자료를 확인한 뒤 사용합니다.
`;
}

function formMarkdown(template, sources) {
  const relatedSources = template.reflectedSources.map((id) => sources.get(id)).filter(Boolean);
  return `# ${template.title}

## 필수 섹션

${template.requiredSections.map((section) => `- ${section}`).join("\n")}

## 반영 근거

${relatedSources.map((source) => `- [${source.title}](${source.url}) - ${source.summary}`).join("\n")}

## 사용 원칙

- SafeGuard 산출물은 공식자료 기반 초안입니다.
- 현장관리자는 작업 조건, 작업자 구성, 원청 요구 서식을 확인한 뒤 사용합니다.
- 출력물에는 확인자와 서명란을 유지합니다.
`;
}

function writeWiki(payload) {
  const sources = sourceMap();
  writeText(path.join(knowledgeDir, "SCHEMA.md"), `# SafeGuard Safety Knowledge Schema

## 목적

SafeGuard의 안전지식 베이스는 공식 출처 기반 초안 생성을 돕는 seed DB입니다. 법령 원문이나 KOSHA 원문을 대체하지 않습니다.

## 주요 파일

- \`data/safety-knowledge/manifest.json\`: 전체 출처와 생성 상태
- \`data/safety-knowledge/hazards.json\`: 위험요인별 키워드, 통제대책, 문서 반영 위치
- \`data/safety-knowledge/legal-map.json\`: 법령 근거 초안 매핑
- \`data/safety-knowledge/kosha-resources.json\`: KOSHA/MOEL/법제처 공식 출처
- \`data/safety-knowledge/accident-cases.json\`: 유사 재해사례 seed
- \`data/safety-knowledge/training-map.json\`: 후속 교육 추천 seed
- \`data/safety-knowledge/templates.json\`: 서식별 필수 항목

## 품질 기준

- 원문 URL을 보존한다.
- 문서 반영 위치를 명시한다.
- LLM 요약만 저장하지 않는다.
- 법적 효력 보장 표현을 쓰지 않는다.
- API 키와 비밀값을 저장하지 않는다.
`);

  writeText(path.join(knowledgeDir, "log.md"), `# SafeGuard Safety Knowledge Log

- ${now}: Phase 0 seed DB 생성. 대표 위험요인, 공식자료, 법령 매핑, 재해사례, 교육 추천, 서식 기준을 구축함.
- ${now}: KOSHA OpenAPI live 수집 시도 결과를 manifest와 evaluation report에 기록함.
`);

  writeText(path.join(wikiDir, "index.md"), `# SafeGuard 안전지식 Wiki

이 wiki는 SafeGuard 문서팩 생성을 보강하기 위한 공식자료 기반 seed 지식층입니다.

## 위험요인

${payload.hazards.map((hazard) => `- [${hazard.title}](hazards/${hazard.id}.md)`).join("\n")}

## 서식

${payload.templates.map((template) => `- [${template.title}](forms/${template.id}.md)`).join("\n")}

## 주의

이 wiki는 공식자료 기반 초안 생성 보조 자료입니다. 최종 판단은 현장 조건과 원문 자료 확인 후 진행합니다.
`);

  for (const hazard of payload.hazards) {
    writeText(path.join(wikiDir, "hazards", `${hazard.id}.md`), hazardMarkdown(hazard, sources));
  }
  for (const template of payload.templates) {
    writeText(path.join(wikiDir, "forms", `${template.id}.md`), formMarkdown(template, sources));
  }
}

function writeEvaluationReport(payload, validation) {
  const liveModes = [
    ...payload.liveSupplements.smartSearch.map((item) => item.mode),
    ...payload.liveSupplements.media.map((item) => item.mode)
  ];
  const liveCount = liveModes.filter((mode) => mode === "live").length;
  const emptyCount = liveModes.filter((mode) => mode === "empty").length;
  const errorCount = liveModes.filter((mode) => mode === "error").length;

  writeJson(path.join(evaluationDir, "safety-knowledge-seed-report.json"), {
    generatedAt: now,
    verdict: validation.verdict,
    counts: {
      hazards: payload.hazards.length,
      officialSources: payload.sources.length,
      legalMappings: payload.legalMap.length,
      accidentCases: payload.accidentCases.length,
      trainingItems: payload.trainingMap.length,
      templates: payload.templates.length,
      liveOpenApiResults: liveCount,
      emptyOpenApiResults: emptyCount,
      failedOpenApiResults: errorCount
    },
    checks: validation.checks,
    artifacts: payload.manifest.artifacts
  });

  writeText(path.join(evaluationDir, "safety-knowledge-seed-report.md"), `# SafeGuard 안전지식 Seed DB 수집 리포트

## 판정

- 결과: \`${validation.verdict}\`
- 생성 시각: ${now}

## 수집 범위

- 위험요인: ${payload.hazards.length}개
- 공식 출처: ${payload.sources.length}개
- 법령 매핑: ${payload.legalMap.length}개
- 재해사례 seed: ${payload.accidentCases.length}개
- 교육 추천 seed: ${payload.trainingMap.length}개
- 서식 기준: ${payload.templates.length}개

## Live 수집 시도

- KOSHA OpenAPI 표시 항목: ${liveCount}건
- 응답은 받았으나 표시 항목 없음: ${emptyCount}건
- 호출 실패: ${errorCount}건

## 품질 게이트

${validation.checks.map((check) => `- ${check.verdict === "pass" ? "통과" : "차단"}: ${check.name} - ${check.detail}`).join("\n")}

## 산출물

${payload.manifest.artifacts.map((artifact) => `- \`${artifact}\``).join("\n")}

## 사용 원칙

이 seed DB는 공식자료 기반 초안 생성 보조 자료입니다. 법령 원문, KOSHA 원문, 사업장 내부 기준을 대체하지 않습니다.
`);
}

loadEnvLocal();

const liveSupplements = await collectLiveSupplements();
const hazards = buildHazards(liveSupplements);
const sources = officialSources;
const legalMap = buildLegalMap();
const accidentCases = buildAccidentCases();
const trainingMap = trainingSeeds;
const templates = templateSeeds;
const manifest = {
  generatedAt: now,
  version: "phase0-seed",
  policy: {
    crawlMode: "curated-official-seed",
    sourcePolicy: "official-url-preserved",
    legalDisclaimer: "공식자료 기반 초안이며 원문 확인 후 사용"
  },
  artifacts: [
    "data/safety-knowledge/manifest.json",
    "data/safety-knowledge/hazards.json",
    "data/safety-knowledge/legal-map.json",
    "data/safety-knowledge/kosha-resources.json",
    "data/safety-knowledge/accident-cases.json",
    "data/safety-knowledge/training-map.json",
    "data/safety-knowledge/templates.json",
    "knowledge/SCHEMA.md",
    "knowledge/log.md",
    "knowledge/wiki/index.md",
    "knowledge/wiki/hazards/*.md",
    "knowledge/wiki/forms/*.md",
    "evaluation/safety-knowledge-seed/safety-knowledge-seed-report.json",
    "evaluation/safety-knowledge-seed/safety-knowledge-seed-report.md"
  ],
  counts: {
    hazards: hazards.length,
    officialSources: sources.length,
    legalMappings: legalMap.length,
    accidentCases: accidentCases.length,
    trainingItems: trainingMap.length,
    templates: templates.length
  }
};

const payload = {
  manifest,
  hazards,
  sources,
  legalMap,
  accidentCases,
  trainingMap,
  templates,
  liveSupplements
};
const validation = validateKnowledgeBase(payload);

writeJson(path.join(dataDir, "manifest.json"), manifest);
writeJson(path.join(dataDir, "hazards.json"), hazards);
writeJson(path.join(dataDir, "legal-map.json"), legalMap);
writeJson(path.join(dataDir, "kosha-resources.json"), sources);
writeJson(path.join(dataDir, "accident-cases.json"), accidentCases);
writeJson(path.join(dataDir, "training-map.json"), trainingMap);
writeJson(path.join(dataDir, "templates.json"), templates);
writeJson(path.join(dataDir, "live-supplements.json"), liveSupplements);
writeWiki(payload);
writeEvaluationReport(payload, validation);

console.log(JSON.stringify({
  verdict: validation.verdict,
  counts: manifest.counts,
  outDir: path.relative(root, dataDir),
  report: path.relative(root, path.join(evaluationDir, "safety-knowledge-seed-report.json"))
}, null, 2));

process.exit(validation.verdict === "blocked" ? 1 : 0);
