import { AskResponse, DetailRecord, SearchResult } from "./types";
import { selectFallbackAccidentCases } from "./accident-cases";
import { buildForeignWorkerBriefing, buildForeignWorkerTransmission, getDefaultForeignWorkerLanguages } from "./foreign-worker";

type ScenarioProfile = {
  id: string;
  companyName: string;
  companyType: string;
  siteName: string;
  workName: string;
  processName: string;
  weatherNote: string;
  riskLevel: AskResponse["riskSummary"]["riskLevel"];
  topRisk: string;
  hazards: [string, string, string];
  actions: [string, string, string];
  educationName: string;
  educationTargets: string;
  questions: [string, string, string];
  educationPoints: [string, string, string];
  keywords: string[];
};

export const mockDetails: DetailRecord[] = [
  {
    id: "law-osha-main",
    type: "law",
    title: "산업안전보건법",
    citation: "산업안전보건법",
    summary: "사업주의 안전·보건 조치 의무, 도급·위탁 관련 책임, 유해·위험 요인 예방체계를 규정하는 핵심 법령",
    body: "산업안전보건법은 사업주가 근로자의 안전과 건강을 보호하기 위해 필요한 조치를 하도록 규정한다. 위험성평가, 안전보건교육, 보호구, 도급 시 안전조치, 유해물질 관리 등 산업현장 전반의 최소 기준이 된다.",
    points: [
      "사업주 안전조치 의무 확인",
      "도급·하청 구조에서 책임주체 확인",
      "교육/보호구/위험성평가 문서 여부 점검"
    ],
    sourceUrl: "https://www.law.go.kr/",
    sourceLabel: "법제처 법령",
    sourceSystem: "mock",
    tags: ["산안법", "안전조치", "위험성평가"]
  },
  {
    id: "law-serious-accident",
    type: "law",
    title: "중대재해 처벌 등에 관한 법률",
    citation: "중대재해처벌법",
    summary: "경영책임자 등의 안전보건 확보의무와 중대산업재해 발생 시 책임구조를 다루는 법령",
    body: "중대재해처벌법은 경영책임자 등이 안전보건 확보의무를 이행하지 않아 중대산업재해가 발생한 경우의 책임을 규정한다. 안전보건관리체계, 재발방지대책, 도급·용역·위탁 관리가 핵심 쟁점이다.",
    points: [
      "경영책임자 의무를 체크리스트로 쪼개서 확인",
      "하청·도급 현장 관리체계 문서화 필요",
      "사고 후 대응보다 사전 증빙체계가 중요"
    ],
    sourceUrl: "https://www.law.go.kr/",
    sourceLabel: "법제처 법령",
    sourceSystem: "mock",
    tags: ["중대재해", "경영책임자", "도급"]
  },
  {
    id: "prec-subcontract-safety",
    type: "precedent",
    title: "하청 작업 안전보건조치 관련 판례 예시",
    citation: "판례 예시 / 하청 안전보건 책임",
    summary: "도급 구조에서 원청의 관리·감독 범위와 안전조치 의무를 둘러싼 쟁점을 보여주는 판례 예시",
    body: "원청 또는 도급인의 현장 지배력, 작업방법 관여 정도, 보호구 지급 및 작업지시 체계, 위험인지 가능성 등이 책임 판단의 핵심 요소로 제시된다.",
    points: [
      "현장 지배·관리 가능성 여부",
      "위험인지 및 예방 가능성 여부",
      "실질 지휘·감독 관계 존재 여부"
    ],
    sourceUrl: "https://www.law.go.kr/",
    sourceLabel: "법제처 판례",
    sourceSystem: "mock",
    tags: ["판례", "도급", "원청책임"]
  },
  {
    id: "prec-safety-training",
    type: "precedent",
    title: "안전교육·보호구 미비 관련 판례 예시",
    citation: "판례 예시 / 교육·보호구",
    summary: "보호구 지급, 사용지도, 안전교육의 실질 이행 여부가 분쟁에서 어떻게 다뤄지는지 보여주는 예시",
    body: "단순 지급 사실보다 실제 교육과 착용 지도, 현장점검, 반복위험에 대한 재교육 여부가 중요한 판단 요소로 나타난다.",
    points: [
      "지급 사실보다 교육·지도·점검이 중요",
      "반복작업/고위험작업은 추가 교육 필요",
      "증빙기록의 유무가 결과에 영향"
    ],
    sourceUrl: "https://www.law.go.kr/",
    sourceLabel: "법제처 판례",
    sourceSystem: "mock",
    tags: ["판례", "안전교육", "보호구"]
  }
];

export const mockSearchResults: SearchResult[] = mockDetails.map((item) => ({
  id: item.id,
  type: item.type,
  title: item.title,
  summary: item.summary,
  citation: item.citation,
  sourceLabel: item.sourceLabel || (item.type === "law" ? "법제처 법령" : "법제처 판례"),
  sourceSystem: item.sourceSystem || "mock",
  sourceUrl: item.sourceUrl,
  tags: item.tags
}));

export const fieldScenarioProfiles: ScenarioProfile[] = [
  {
    id: "construction-painting",
    companyName: "세이프건설",
    companyType: "건설업",
    siteName: "서울 성수동 근린생활시설 현장",
    workName: "외벽 도장 작업",
    processName: "이동식 비계 사용 외벽 도장, 자재 상하차, 하부 통제",
    weatherNote: "오후 강풍 예보, 이동식 비계 흔들림 주의",
    riskLevel: "상",
    topRisk: "강풍 상황에서 이동식 비계가 흔들리며 작업자가 추락하거나 비계가 전도될 위험",
    hazards: [
      "이동식 비계 승·하강 및 작업발판 이동 중 추락",
      "강풍 시 비계 전도와 공구·자재 낙하",
      "지게차 동선 인접 구간에서 작업자 충돌"
    ],
    actions: [
      "작업 전 비계 고정핀, 바퀴 잠금, 작업발판 상태 점검",
      "풍속 상승 또는 돌풍 체감 시 즉시 작업중지 후 지상 대기",
      "작업반장 주도로 보호구 착용과 작업구간 출입통제를 확인"
    ],
    educationName: "외벽 도장 작업 전 위험요인 및 보호구 착용 교육",
    educationTargets: "외벽 도장 작업자, 신호수, 신규 투입자",
    questions: [
      "강풍 시 작업중지 판단은 누가 하고, 팀원에게 어떻게 전파할 것인가?",
      "이동식 비계 고정상태와 보호구 착용은 누가 상호 확인했는가?",
      "지게차 동선 접근금지 구역과 신호수 위치를 전원이 알고 있는가?"
    ],
    educationPoints: [
      "강풍 체감 또는 비계 흔들림 발생 시 즉시 작업중지 후 지상 대기",
      "이동식 비계 작업 전 바퀴 잠금, 발판 고정, 안전난간 상태를 상호 확인",
      "지게차 접근 시 신호수 지시에 따라 이동하고 작업반경 내 무단 진입 금지"
    ],
    keywords: ["성수", "도장", "비계", "강풍", "건설", "외벽"]
  },
  {
    id: "logistics-forklift",
    companyName: "한빛로지스",
    companyType: "물류업",
    siteName: "인천 남동공단 물류센터",
    workName: "상하차 및 피킹 작업",
    processName: "지게차 상하차, 랙 피킹, 출하 동선 분리",
    weatherNote: "실내 작업, 출하량 증가로 동선 혼잡",
    riskLevel: "상",
    topRisk: "지게차 동선과 보행 동선이 겹치면서 충돌하거나 적재물이 낙하할 위험",
    hazards: [
      "지게차 회차 구간에서 보행자 충돌",
      "상부 랙 피킹 중 적재물 낙하",
      "출하 집중 시간대 교차동선 혼잡"
    ],
    actions: [
      "지게차 전용 동선과 보행 동선을 바닥표시와 차단봉으로 분리",
      "상하차 구간 진입 전 신호수 배치와 후진 경보 확인",
      "고중량 적재물 하역 전 작업반경을 비우고 낙하위험 구역을 통제"
    ],
    educationName: "물류센터 지게차 동선 및 적재물 낙하 예방 교육",
    educationTargets: "지게차 운전자, 피킹 작업자, 신규 출하 인력",
    questions: [
      "후진·회차 구간에서 보행자 통제는 누가 책임지고 있는가?",
      "상부 랙 작업 전 낙하위험 구역을 모두 비웠는가?",
      "신규 투입자가 지게차 경고음과 진입금지 구역을 이해했는가?"
    ],
    educationPoints: [
      "지게차 접근 시 작업을 멈추고 신호수 지시에 따라 이동",
      "상부 랙 피킹 전 헬멧 착용과 낙하위험 구역 비우기",
      "출하 집중 시간대에는 교차동선 대신 일방통행 동선 준수"
    ],
    keywords: ["물류", "지게차", "상하차", "피킹", "출하", "로지스"]
  },
  {
    id: "manufacturing-hotwork",
    companyName: "그린메탈",
    companyType: "제조업",
    siteName: "창원 산업단지 금속가공 공장",
    workName: "용접·절단 화기작업",
    processName: "금속 절단, 아크 용접, 가연물 통제, 화재감시",
    weatherNote: "실내 공정, 용접 흄과 비산불꽃 집중 관리 필요",
    riskLevel: "상",
    topRisk: "용접 비산불꽃과 가연물이 맞물리며 화재가 발생하거나 작업자가 화상·흡입 위험에 노출될 수 있음",
    hazards: [
      "용접 비산불꽃에 의한 화재",
      "절단 작업 중 화상 및 보호구 미착용",
      "용접 흄 체류로 인한 호흡기 노출"
    ],
    actions: [
      "화기작업 전 가연물 제거와 소화기 배치, 화재감시자 지정",
      "용접면·방염장갑·보안경 등 보호구 착용 상태 확인",
      "국소배기와 환기설비를 가동하고 밀폐구역 작업을 제한"
    ],
    educationName: "화기작업 허가 및 용접 화재예방 교육",
    educationTargets: "용접공, 절단작업자, 화재감시자",
    questions: [
      "오늘 작업구역에서 제거되지 않은 가연물은 없는가?",
      "화재감시자와 비상소화 설비 위치를 모두 알고 있는가?",
      "환기 불량 구역에서 작업중지 기준을 공유했는가?"
    ],
    educationPoints: [
      "화기작업 허가 확인 후 가연물 제거와 차폐막 설치",
      "용접 작업 전 방염장갑, 보안경, 용접면 착용 상태 확인",
      "흄 체류나 화재 징후 발견 시 즉시 작업중지 후 보고"
    ],
    keywords: ["용접", "절단", "화기", "제조", "금속", "메탈"]
  },
  {
    id: "facility-maintenance",
    companyName: "이지시설관리",
    companyType: "시설관리업",
    siteName: "서울 강남 복합건물 지하 기계실",
    workName: "지하 기계실 점검 및 정비 작업",
    processName: "펌프·배관 점검, 전기판넬 주변 정리, 협소공간 출입",
    weatherNote: "지하 협소공간, 미끄럼 및 감전 위험 동시 관리",
    riskLevel: "중",
    topRisk: "누수와 습기로 인해 미끄러짐과 감전 위험이 동시에 발생할 수 있음",
    hazards: [
      "누수 구간 미끄러짐",
      "전기판넬 주변 정비 중 감전",
      "협소공간 출입 시 단독작업 위험"
    ],
    actions: [
      "누수 구간 즉시 표시 후 미끄럼 방지조치와 배수 확인",
      "전기판넬 접근 전 차단·잠금표시와 절연 보호구 확인",
      "지하 기계실 출입 시 2인 1조와 연락체계를 유지"
    ],
    educationName: "시설관리 협소공간·감전 예방 교육",
    educationTargets: "시설관리 기사, 전기 협력업체, 신규 점검 인력",
    questions: [
      "전기 차단·잠금표시 절차를 작업 전 모두 확인했는가?",
      "누수 구간과 미끄럼 위험 구역을 전원이 알고 있는가?",
      "협소공간 출입 시 연락체계와 비상호출 수단을 준비했는가?"
    ],
    educationPoints: [
      "누수 구간 발견 즉시 표시하고 임시 배수 후 작업 진행",
      "차단기 잠금표시 없이 전기판넬에 접근하지 않기",
      "협소공간은 단독 출입을 금지하고 2인 1조 원칙 준수"
    ],
    keywords: ["시설", "기계실", "지하", "감전", "누수", "시설관리"]
  },
  {
    id: "cleaning-chemical",
    companyName: "클린온",
    companyType: "서비스업",
    siteName: "광주 하남산단 공장 세척 구역",
    workName: "공장 바닥 세척 및 화학세제 사용",
    processName: "화학세제 희석, 바닥 세척, 습윤구역 통제, 환기",
    weatherNote: "실내 환기 제한, 화학물질 노출과 미끄럼 위험 동시 관리",
    riskLevel: "중",
    topRisk: "화학세제 노출과 젖은 바닥 미끄럼이 동시에 발생해 눈·피부 손상과 넘어짐 위험이 있음",
    hazards: [
      "화학세제 희석·사용 중 눈과 피부 노출",
      "젖은 바닥에서 미끄러짐",
      "환기 제한으로 인한 냄새와 흡입 노출"
    ],
    actions: [
      "세제 희석비와 물질안전보건자료 확인 후 보안경·장갑 착용",
      "세척 구역 출입통제와 미끄럼 주의 표지 설치",
      "환기팬 가동과 작업시간 분산, 이상 증상 발생 시 작업중지"
    ],
    educationName: "화학세제 사용 및 미끄럼 예방 안전교육",
    educationTargets: "청소 작업자, 외국인 근로자, 신규 투입자",
    questions: [
      "세제 희석비와 금지 혼합 물질을 전원이 이해했는가?",
      "젖은 바닥 출입통제와 우회 동선을 표시했는가?",
      "외국인 근로자에게 쉬운 문장으로 보호구와 작업중지 기준을 설명했는가?"
    ],
    educationPoints: [
      "화학세제 사용 전 보안경·장갑 착용과 희석비 확인",
      "세척 직후 젖은 바닥에는 작업자 외 출입 금지",
      "눈·피부 자극이나 어지러움 발생 시 즉시 작업중지 후 보고"
    ],
    keywords: ["청소", "세척", "화학", "세제", "외국인", "서비스", "클린"]
  },
  {
    id: "warehouse-heat",
    companyName: "대성창고",
    companyType: "창고업",
    siteName: "대구 달서구 물류창고",
    workName: "고중량 박스 적재 및 수작업 운반",
    processName: "박스 적재, 핸드파렛트 이동, 지게차 보조 운반, 휴식관리",
    weatherNote: "폭염주의 수준, 온열질환과 근골격계 부담 관리 필요",
    riskLevel: "중",
    topRisk: "폭염 환경에서 고중량 박스 운반이 반복되어 온열질환과 근골격계 부담이 커질 수 있음",
    hazards: [
      "고온 창고 내 장시간 운반으로 인한 온열질환",
      "고중량 박스 반복 취급으로 인한 허리·어깨 부담",
      "지게차 보조 이동 중 보행자 충돌"
    ],
    actions: [
      "작업 전 물·그늘·휴식 기준과 이상 증상 보고 절차 공유",
      "2인 1조 운반과 이동대차 사용, 허리 비틀림 작업 금지",
      "지게차 이동구간 접근금지와 신호수 위치 확인"
    ],
    educationName: "폭염·근골격계 부담작업 예방 교육",
    educationTargets: "창고 작업자, 고령 숙련자, 지게차 보조 작업자",
    questions: [
      "온열질환 의심 증상과 즉시 보고 기준을 전원이 알고 있는가?",
      "고중량 박스는 2인 1조 또는 이동대차로 처리하는가?",
      "지게차 보조 이동 시 보행자 대기 위치가 표시되어 있는가?"
    ],
    educationPoints: [
      "어지러움·두통·구토감 발생 시 즉시 작업중지 후 그늘 휴식",
      "무리한 단독 운반 금지, 이동대차와 2인 1조 원칙 준수",
      "지게차 이동 시 작업반경 밖에서 신호수 지시를 대기"
    ],
    keywords: ["대구", "창고", "폭염", "온열", "고중량", "숙련", "고령"]
  }
];

export function buildSourceMix(citations: SearchResult[]): NonNullable<AskResponse["sourceMix"]> {
  const counts = citations.reduce<Record<string, number>>((acc, item) => {
    const key = item.sourceSystem || "unknown";
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});

  return {
    total: citations.length,
    counts,
    koreanLawMcp: {
      enabled: false,
      configured: false,
      keySource: "none",
      summary: "korean-law-mcp 비활성화"
    }
  };
}

const defaultQuestion = "서울 성수동 근린생활시설 외벽 도장 작업. 이동식 비계 사용, 작업자 5명, 오후 강풍 예보. 오늘 TBM과 위험성평가 초안을 만들어줘.";

function inferWorkerCount(question: string) {
  const workerMatch = question.match(/(\d+)\s*명/);
  return workerMatch ? Number(workerMatch[1]) : 5;
}

function pickScenarioProfile(question: string) {
  const normalized = question.trim().toLowerCase();

  const scored = fieldScenarioProfiles.map((profile) => ({
    profile,
    score: profile.keywords.reduce((acc, keyword) => acc + (normalized.includes(keyword.toLowerCase()) ? 1 : 0), 0)
  }));

  scored.sort((a, b) => b.score - a.score);
  return scored[0]?.score ? scored[0].profile : fieldScenarioProfiles[0];
}

function sanitizeWorkSummary(question: string, fallback: string) {
  const normalized = (question.trim() || fallback)
    .replace(/\s+/g, " ")
    .replace(/오늘\s*/g, "")
    .replace(/(위험성평가|위험성 평가|TBM|안전보건교육|안전교육|기록|초안|문서팩|작업계획서|일지)(와|과|,|·|\s)*/g, "")
    .replace(/(까지\s*)?(반영해|포함해|연계해|고려해)?\s*(만들어\s*줘|작성해\s*줘|생성해\s*줘|정리해\s*줘|만들어주세요|작성해주세요|생성해주세요|정리해주세요)\.?$/i, "")
    .replace(/[,.]\s*$/, "")
    .trim();

  const sentences = normalized.split(/(?<=[.!?。])\s+/).filter(Boolean);
  const workSentence = sentences.find((sentence) => /작업|점검|운반|도장|상하차|용접|세척|굴착|피킹|적재/.test(sentence));
  return (workSentence || normalized || fallback).replace(/\.$/, "").trim();
}

function format4mLine(hazard: string) {
  const checks = [
    ["Man", /신규|작업자|외국인|고령|숙련|보호구|추락|끼임|충돌|낙하/.test(hazard) ? "중점" : "확인"],
    ["Machine", /비계|지게차|장비|도구|용접|세척기|대차|펌프|랙|팔레트|전도|끼임|낙하/.test(hazard) ? "중점" : "확인"],
    ["Media", /강풍|우천|폭염|고온|환기|밀폐|젖음|작업환경|동선|흄|비산|출하|혼잡/.test(hazard) ? "중점" : "확인"],
    ["Management", /통제|신호|작업중지|관리|교육|허가|동선|감시|분리|혼잡|화재/.test(hazard) ? "중점" : "확인"]
  ];

  return `   - 4M 체크: ${checks.map(([label, status]) => `${label}:${status === "중점" ? "■" : "□"}`).join(" ")} / 중점 확인: ${checks.filter(([, status]) => status === "중점").map(([label]) => label).join(", ") || "현장 확인"}`;
}

function inferScenario(question: string) {
  const normalized = question.trim() || defaultQuestion;
  const workerCount = inferWorkerCount(normalized);
  const profile = pickScenarioProfile(normalized);
  const workSummary = sanitizeWorkSummary(normalized, profile.workName);

  return {
    companyName: profile.companyName,
    companyType: profile.companyType,
    siteName: profile.siteName,
    workSummary,
    workerCount,
    weatherNote: normalized.includes("강풍")
      ? "오후 강풍 예보, 작업중지 기준 공유 필요"
      : /우천|젖음|비|강수/.test(normalized)
        ? "우천 후 바닥 젖음, 미끄럼·동선 분리 기준 공유 필요"
        : /고온|폭염|온열/.test(normalized)
          ? "고온 작업조건, 온열질환 예방과 휴식 기준 공유 필요"
          : profile.weatherNote,
    profile
  };
}

function buildWorkpackSummaryDraft(scenario: ReturnType<typeof inferScenario>) {
  const { profile } = scenario;

  return [
    "점검결과 요약(초안)",
    "현장 문서팩 첫 장 · 작업 전 검토용",
    "",
    `업체명: ${scenario.companyName}`,
    `업종: ${scenario.companyType}`,
    `현장명: ${scenario.siteName}`,
    `작업명: ${profile.workName}`,
    `작업인원: ${scenario.workerCount}명`,
    `작업조건: ${scenario.weatherNote}`,
    "",
    "[핵심 판단]",
    `- 위험수준: ${profile.riskLevel}`,
    `- 핵심 위험: ${profile.topRisk}`,
    "",
    "[즉시 조치]",
    `1. ${profile.actions[0]}`,
    `2. ${profile.actions[1]}`,
    `3. ${profile.actions[2]}`,
    "",
    "[문서팩 구성]",
    "- 위험성평가표: 위험요인, 감소대책, 담당자, 확인 근거",
    "- 작업계획서: 작업구간, 작업순서, 장비·인원, 작업중지 기준",
    "- TBM 및 일일점검: 작업 전 질문, 참석자 확인, 작업 전·중·후 확인",
    "- 안전보건교육: 교육대상, 교육내용, 이해도 확인, 후속 교육",
    "- 비상대응: 즉시조치, 보고체계, 현장보존, 재발방지",
    "- 사진/증빙: 조치 전·후 사진, 설명, 확인자"
  ].join("\n");
}

function buildOfficialStyleRiskAssessment(scenario: ReturnType<typeof inferScenario>) {
  const { profile } = scenario;

  return [
    "위험성평가표(초안)",
    "공식자료 기반: KOSHA 위험성평가 절차 및 4M 기법 참고",
    "",
    `업체명: ${scenario.companyName}`,
    `업종: ${scenario.companyType}`,
    `작업명: ${profile.workName}`,
    `공정/세부작업: ${profile.processName}`,
    `작업장소: ${scenario.siteName}`,
    `작업인원: ${scenario.workerCount}명`,
    `기상 및 작업조건: ${scenario.weatherNote}`,
    "",
    "[1. 사전준비]",
    `- 평가대상 작업: ${profile.workName}`,
    "- 참여자: 현장소장, 관리감독자, 작업반장, 해당 작업자",
    "- 확인자료: 작업계획, 기상조건, 장비·보호구 상태, 최근 TBM 기록",
    "",
    "[2. 유해·위험요인 파악]",
    `1. 세부작업: ${profile.hazards[0]}`,
    `   - 유해·위험요인: ${profile.hazards[0]}`,
    format4mLine(profile.hazards[0]),
    "",
    `2. 세부작업: ${profile.hazards[1]}`,
    `   - 유해·위험요인: ${profile.hazards[1]}`,
    format4mLine(profile.hazards[1]),
    "",
    `3. 세부작업: ${profile.hazards[2]}`,
    `   - 유해·위험요인: ${profile.hazards[2]}`,
    format4mLine(profile.hazards[2]),
    "",
    "[3. 위험성 결정]",
    `1. ${profile.hazards[0]}`,
    `   - 현재 위험성: ${profile.riskLevel}`,
    "   - 판단근거: 사고 발생 가능성과 중대성을 함께 고려",
    `2. ${profile.hazards[1]}`,
    `   - 현재 위험성: ${profile.riskLevel === "상" ? "상" : "중"}`,
    "   - 판단근거: 작업 전 통제 여부와 노출 빈도 확인",
    `3. ${profile.hazards[2]}`,
    "   - 현재 위험성: 중",
    "   - 판단근거: 관리감독 및 작업자 숙지 여부 확인",
    "",
    "[4. 감소대책 수립 및 실행]",
    `1. ${profile.actions[0]}`,
    "   - 실행시점: 작업 시작 전",
    "   - 담당: 관리감독자 / 작업반장",
    "   - 잔여 위험성: 중",
    `2. ${profile.actions[1]}`,
    "   - 실행시점: 작업 시작 전 및 작업 중 수시",
    "   - 담당: 작업반장 / 신호수",
    "   - 잔여 위험성: 중",
    `3. ${profile.actions[2]}`,
    "   - 실행시점: TBM 직후",
    "   - 담당: 전 작업자",
    "   - 잔여 위험성: 하",
    "",
    "[5. 공유·교육]",
    "- 위험성평가 결과는 TBM에서 구두 설명하고, 작업자 이해 여부를 확인합니다.",
    "- 신규 투입자와 외국인 근로자는 쉬운 문장 또는 다국어 보조 설명을 추가합니다.",
    "",
    "[6. 조치 확인]",
    "위험성평가 실시자: 현장소장 / 관리감독자",
    "근로자 참여 확인: 작업 전 TBM에서 공유 및 복창 확인",
    "조치 완료 예정일: 작업 시작 전 즉시",
    "미조치 항목 처리: 작업 보류 또는 책임자 승인 후 재평가"
  ].join("\n");
}

function buildOfficialStyleWorkPlan(scenario: ReturnType<typeof inferScenario>) {
  const { profile } = scenario;

  return [
    "작업계획서(초안)",
    "현장 서식 기준: 작업구간, 작업순서, 장비·인원, 허가·첨부, 확인자 중심",
    "",
    `공사명: ${scenario.siteName}`,
    `작업구간: ${profile.processName}`,
    `작성자: 관리감독자 / 작업반장`,
    "확인자: 현장소장 / 안전관리자",
    "작성일: 작업 시작 전",
    "",
    "[1. 작업개요]",
    `- 작업명: ${profile.workName}`,
    `- 작업내용: ${scenario.workSummary}`,
    `- 작업인원: ${scenario.workerCount}명`,
    `- 작업조건: ${scenario.weatherNote}`,
    "",
    "[2. 작업순서]",
    "- 작업 전 작업구역 설정, 보호구 확인, 장비 상태 점검",
    `- 주요 작업 수행: ${profile.processName}`,
    "- 작업 중 위험구역 출입통제와 작업중지 기준 수시 확인",
    "- 작업 종료 후 정리정돈, 잔여 위험요인 확인, 사진/기록 보관",
    "",
    "[3. 장비·인원·허가 확인]",
    "- 장비/도구: 작업계획서 또는 안전작업허가서 첨부자료로 확인",
    "- 작업자: 신규 투입자, 외국인 근로자, 협력업체 인원 별도 확인",
    "- 허가/첨부: 고위험 작업은 안전작업허가서, 위험성평가표, TBM 기록을 함께 보관",
    "",
    "[4. 작업중지 기준]",
    `- ${profile.questions[0]}`,
    `- ${profile.questions[1]}`,
    `- ${profile.questions[2]}`,
    "",
    "[5. 확인 근거]",
    "- 위험성평가표, TBM 기록, 안전보건교육 기록, 사진/영상 증빙을 같은 문서팩으로 묶어 확인합니다."
  ].join("\n");
}

function buildOfficialStyleTbmBriefing(scenario: ReturnType<typeof inferScenario>) {
  const { profile } = scenario;

  return [
    "작업 전 안전점검회의(TBM) 브리핑(초안)",
    "공식자료 기반: KOSHA TBM OPS 및 고용노동부 TBM 교육시간 인정 안내 참고",
    "",
    "일시: 작업 시작 전",
    `장소: ${scenario.siteName}`,
    `업체명: ${scenario.companyName}`,
    `오늘 작업: ${profile.workName}`,
    `참석 대상: 작업자 ${scenario.workerCount}명, 작업반장, 관리감독자`,
    "",
    "[1. 작업내용]",
    `- ${scenario.workSummary}`,
    `- 기상 및 작업조건: ${scenario.weatherNote}`,
    "",
    "[2. 위험요인]",
    `1. ${profile.hazards[0]}`,
    `2. ${profile.hazards[1]}`,
    `3. ${profile.hazards[2]}`,
    "",
    "[3. 안전대책]",
    `- ${profile.actions[0]}`,
    `- ${profile.actions[1]}`,
    `- ${profile.actions[2]}`,
    "",
    "[4. 참석자 확인]",
    "- 작업자는 핵심 위험요인과 작업중지 기준을 구두 복창합니다.",
    "- 보호구 착용 상태와 위험구역 통제 상태를 상호 확인합니다.",
    "- 신규 투입자와 외국인 근로자는 이해 여부를 추가 확인합니다.",
    "",
    "[5. 사진·영상 기록 메모]",
    "- 작업일지, 모바일 앱, 사진, 영상 등 현장 기록 수단에 TBM 실시 여부를 남깁니다.",
    "- 위험성평가 결과를 반영한 TBM 기록은 안전보건교육 증빙으로 활용 가능 여부를 검토합니다.",
    "",
    "[확인 질문]",
    `1. ${profile.questions[0]}`,
    `2. ${profile.questions[1]}`,
    `3. ${profile.questions[2]}`
  ].join("\n");
}

function buildEmergencyResponseDraft(scenario: ReturnType<typeof inferScenario>) {
  const { profile } = scenario;

  return [
    "비상대응 절차(초안)",
    "중대재해·산업재해 발생 대비 현장 초기대응 기록",
    "",
    `현장명: ${scenario.siteName}`,
    `작업명: ${profile.workName}`,
    "적용대상: 현장소장, 관리감독자, 작업반장, 작업자, 협력업체",
    "",
    "[1. 사고 징후 및 즉시 중지]",
    `- 핵심 위험: ${profile.topRisk}`,
    "- 사고 징후, 아차사고, 위험 발견 시 작업자는 즉시 작업을 중지하고 작업반장에게 보고합니다.",
    "- 추가 피해 가능성이 있으면 위험구역 접근을 통제하고 전원을 안전한 장소로 이동시킵니다.",
    "",
    "[2. 초기조치]",
    "- 부상자 구조와 응급조치를 우선하되, 구조자 2차 사고 위험을 먼저 확인합니다.",
    "- 전기, 화기, 장비, 차량 등 추가 위험원을 정지 또는 격리합니다.",
    "- 필요한 경우 119, 원청/발주자, 안전관리자에게 즉시 연락합니다.",
    "",
    "[3. 보고체계]",
    "- 최초 발견자 → 작업반장 → 관리감독자 → 현장소장 → 발주자/원청 안전 담당 순으로 보고합니다.",
    "- 보고 내용은 사고시간, 장소, 작업내용, 피해상황, 초기조치, 추가 위험 여부를 포함합니다.",
    "",
    "[4. 현장보존 및 재발방지]",
    "- 인명구조와 추가 피해 방지를 제외하고 현장을 임의 변경하지 않습니다.",
    "- 사진/영상, TBM 기록, 위험성평가표, 교육 기록을 함께 보관합니다.",
    "- 재개 전 위험성평가를 다시 수행하고 감소대책 이행 여부를 확인합니다."
  ].join("\n");
}

function buildPhotoEvidenceDraft(scenario: ReturnType<typeof inferScenario>) {
  const { profile } = scenario;

  return [
    "사진/증빙 기록(초안)",
    "현장 점검 및 제출 대응용 첨부 슬롯",
    "",
    `현장명: ${scenario.siteName}`,
    `작업명: ${profile.workName}`,
    "",
    "[1. 작업 전 사진]",
    "- 작업구역 전경:",
    "- 보호구 착용 상태:",
    "- 장비/도구 점검 상태:",
    "- 위험구역 출입통제 상태:",
    "",
    "[2. 조치 전·후 사진]",
    `- 위험요인 1: ${profile.hazards[0]}`,
    `- 조치내용: ${profile.actions[0]}`,
    `- 위험요인 2: ${profile.hazards[1]}`,
    `- 조치내용: ${profile.actions[1]}`,
    "",
    "[3. TBM 및 교육 증빙]",
    "- TBM 실시 사진 또는 모바일 기록:",
    "- 참석자 확인 또는 서명:",
    "- 신규/외국인 근로자 이해도 확인:",
    "",
    "[4. 확인자]",
    "- 촬영자:",
    "- 확인자:",
    "- 보관 위치: 작업일지, 모바일 앱, 문서팩 첨부자료"
  ].join("\n");
}

function buildOfficialStyleTbmLog(scenario: ReturnType<typeof inferScenario>) {
  const { profile } = scenario;

  return [
    "작업 전 안전점검회의(TBM) 기록(초안)",
    "공식자료 기반: 작업일지·모바일 앱·사진·영상 등 다양한 기록 인정 취지 참고",
    "",
    "일시: 2026-04-25 08:00",
    `업체명: ${scenario.companyName}`,
    `작업장소: ${scenario.siteName}`,
    `작업내용: ${scenario.workSummary}`,
    `참석인원: ${scenario.workerCount}명`,
    "실시자: 작업반장 / 관리감독자",
    "",
    "[작업내용]",
    `- ${profile.workName}`,
    "",
    "[위험요인]",
    `- ${profile.hazards[0]}`,
    `- ${profile.hazards[1]}`,
    `- ${profile.hazards[2]}`,
    "",
    "[안전대책]",
    `- ${profile.actions[0]}`,
    `- ${profile.actions[1]}`,
    `- ${profile.actions[2]}`,
    "",
    "[참석자 확인]",
    "TBM 내용 숙지 여부: 전원 구두 복창 및 서명 예정",
    "보호구 착용 상태: 상호 점검",
    "위험구역 표시 및 통제: 확인",
    "",
    "[사진·영상 기록 메모]",
    "- 작업 전 현장 상태, 보호구 착용, 위험구역 통제 사진을 기록합니다.",
    "- 모바일 앱 또는 작업일지에 TBM 실시 시각과 참석자를 남깁니다.",
    "",
    "[미조치 위험요인 / 후속조치]",
    `- ${profile.questions[0]}`,
    `- ${profile.questions[1]}`
  ].join("\n");
}

function buildOfficialStyleSafetyEducationRecord(scenario: ReturnType<typeof inferScenario>) {
  const { profile } = scenario;

  return [
    "안전보건교육 기록(초안)",
    "공식자료 기반: 산업안전보건교육 가이드북 및 TBM 교육시간 인정 안내 참고",
    "",
    `교육명: ${profile.educationName}`,
    "교육구분: 당일 작업 전 안전보건교육 및 TBM 연계 기록",
    "교육일시: 작업 시작 전 15분",
    `교육장소: ${scenario.siteName}`,
    `교육대상: ${profile.educationTargets}, 총 ${scenario.workerCount}명`,
    "교육 실시자: 현장소장 / 관리감독자",
    "확인자: 작업반장 / 작업자 대표",
    "",
    "[교육대상]",
    `- ${profile.educationTargets}, 총 ${scenario.workerCount}명`,
    "- 신규 투입자, 외국인 근로자, 작업변경자는 이해 여부를 별도 확인합니다.",
    "",
    "[교육내용]",
    `- 오늘 작업 개요: ${scenario.workSummary}`,
    `- 작업 조건: ${scenario.weatherNote}`,
    `- 핵심 위험요인: ${profile.hazards.join(", ")}`,
    `- 즉시 조치: ${profile.actions.join(", ")}`,
    "",
    "[보호구 및 작업방법 강조사항]",
    `- ${profile.educationPoints[0]}`,
    `- ${profile.educationPoints[1]}`,
    `- ${profile.educationPoints[2]}`,
    "",
    "[확인방법]",
    "- 신규 투입자 포함 전원이 작업중지 기준을 구두 복창",
    "- 보호구 착용 상태를 상호 점검 후 서명 예정",
    "- 작업일지, 모바일 앱, 사진, 영상 등 현장 기록 수단에 교육 실시 사실을 남김",
    "",
    "[TBM 기록 연계]",
    "- 위험성평가 결과를 반영한 TBM 기록은 정기교육 증빙으로 활용 가능 여부를 검토합니다.",
    "- 본 기록은 법정 제출 서식을 대체하는 문서가 아니라 현장 기록 보조용 초안입니다.",
    "",
    "[후속 교육 추천]",
    "- 고용24 사업주훈련 또는 외국인 근로자 관련 교육은 현장 대상과 교육명이 맞는 경우에만 후속 후보로 연결합니다."
  ].join("\n");
}

export function buildMockAskResponse(question: string, citations: SearchResult[], mode: AskResponse["mode"], statusDetail: string): AskResponse {
  const scenario = inferScenario(question);
  const profile = scenario.profile;
  const responseScenario = {
    companyName: scenario.companyName,
    companyType: scenario.companyType,
    siteName: scenario.siteName,
    workSummary: scenario.workSummary,
    workerCount: scenario.workerCount,
    weatherNote: scenario.weatherNote
  };
  const riskSummary = {
    title: `${scenario.companyType} ${profile.workName}`,
    riskLevel: profile.riskLevel,
    topRisk: profile.topRisk,
    immediateActions: [
      profile.actions[0],
      profile.actions[1],
      profile.actions[2]
    ]
  };
  const foreignWorkerInput = {
    question: question.trim() || defaultQuestion,
    scenario: responseScenario,
    riskSummary
  };

  return {
    question: question.trim() || defaultQuestion,
    answer: [
      `${scenario.companyName} ${scenario.siteName}의 주요 위험은 ${profile.topRisk}입니다.`,
      `${scenario.companyType} 현장 기준으로 위험 요약, 위험성평가 초안, TBM 브리핑, TBM 일지, 안전교육 기록을 한 번에 생성하는 흐름을 제공합니다.`,
      "실무에서는 작업 전 위험구역 통제, 보호구 확인, 신규 투입자 이해 여부까지 같이 확인해야 합니다."
    ].join("\n\n"),
    practicalPoints: [
      profile.actions[0],
      profile.actions[1],
      profile.actions[2]
    ],
    citations,
    sourceMix: buildSourceMix(citations),
    mode,
    scenario: responseScenario,
    externalData: {
      weather: {
        source: "kma",
        mode: "mock",
        locationLabel: scenario.siteName,
        summary: scenario.weatherNote,
        actions: [profile.actions[1]],
        detail: "대표 시나리오 기반 기상 주의 문구"
      },
      training: {
        source: "work24",
        mode: "mock",
        detail: "현장 예시 기반 교육 연계 문구",
        recommendations: []
      },
      koshaEducation: {
        source: "kosha-edu",
        mode: "fallback",
        detail: "대표 시나리오 기반 KOSHA 교육포털 연계 문구",
        recommendations: [
          {
            title: "KOSHA 안전보건교육포털 교육과정 검색",
            provider: "한국산업안전보건공단",
            target: "근로자·관리감독자",
            educationMethod: "집체·온라인·혼합 과정",
            url: "https://edu.kosha.or.kr/",
            reason: "KOSHA 공식 교육포털에서 후속 안전교육 후보를 확인합니다.",
            fitLabel: "공식 포털",
            fitReason: "공식 교육포털 연계 fallback 후보입니다."
          }
        ]
      },
      kosha: {
        source: "kosha",
        mode: "fallback",
        detail: "대표 시나리오 기반 KOSHA 가이드 보강 문구",
        references: []
      },
      accidentCases: {
        source: "kosha-accident",
        mode: "fallback",
        detail: "대표 시나리오 기반 유사 재해사례 보강 문구",
        cases: selectFallbackAccidentCases(question)
      }
    },
    riskSummary,
    deliverables: {
      workpackSummaryDraft: buildWorkpackSummaryDraft(scenario),
      riskAssessmentDraft: buildOfficialStyleRiskAssessment(scenario),
      workPlanDraft: buildOfficialStyleWorkPlan(scenario),
      tbmBriefing: buildOfficialStyleTbmBriefing(scenario),
      tbmLogDraft: buildOfficialStyleTbmLog(scenario),
      safetyEducationRecordDraft: buildOfficialStyleSafetyEducationRecord(scenario),
      emergencyResponseDraft: buildEmergencyResponseDraft(scenario),
      photoEvidenceDraft: buildPhotoEvidenceDraft(scenario),
      foreignWorkerBriefing: buildForeignWorkerBriefing(foreignWorkerInput),
      foreignWorkerTransmission: buildForeignWorkerTransmission(foreignWorkerInput),
      foreignWorkerLanguages: getDefaultForeignWorkerLanguages(foreignWorkerInput.question),
      safetyEducationPoints: [
        profile.educationPoints[0],
        profile.educationPoints[1],
        profile.educationPoints[2]
      ],
      tbmQuestions: [
        profile.questions[0],
        profile.questions[1],
        profile.questions[2]
      ],
      kakaoMessage: [
        `[오늘 작업 안전공지] ${scenario.companyName}`,
        `현장: ${scenario.siteName}`,
        `작업: ${profile.workName}`,
        `핵심위험: ${profile.topRisk}`,
        `필수조치: ${profile.actions[0]} / ${profile.actions[1]} / ${profile.actions[2]}`,
        "TBM 및 당일 안전교육 내용 확인 후 작업 시작 바랍니다."
      ].join("\n")
    },
    status: {
      lawgo: mode === "live" ? "live" : mode === "fallback" ? "fallback" : "mock",
      ai: mode === "live" ? "live" : mode === "fallback" ? "fallback" : "mock",
      weather: "mock",
      work24: "mock",
      kosha: "fallback",
      summary: mode === "live" ? "연결됨" : mode === "fallback" ? "일부 근거 보류" : "연결 점검 필요",
      detail: statusDetail,
      policyNote: "실 API 호출은 timeout 20초, 1회 retry, 실패 시 graceful fallback 정책을 따릅니다."
    }
  };
}
