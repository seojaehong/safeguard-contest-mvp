import { AskResponse, DetailRecord, SearchResult } from "./types";

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

function inferScenario(question: string) {
  const normalized = question.trim() || defaultQuestion;
  const workerMatch = normalized.match(/(\d+)\s*명/);
  const workerCount = workerMatch ? Number(workerMatch[1]) : 5;

  return {
    siteName: normalized.includes("성수") ? "서울 성수동 근린생활시설 현장" : "대표 데모 현장",
    workSummary: normalized,
    workerCount,
    weatherNote: normalized.includes("강풍") ? "오후 강풍 예보, 이동식 비계 흔들림 주의" : "기본 위험요인 중심 점검"
  };
}

export function buildMockAskResponse(question: string, citations: SearchResult[], mode: AskResponse["mode"], statusDetail: string): AskResponse {
  const scenario = inferScenario(question);

  return {
    question: question.trim() || defaultQuestion,
    answer: [
      `${scenario.siteName}의 주요 위험은 이동식 비계 작업 중 추락과 강풍에 따른 전도 가능성입니다.`,
      "MVP 데모에서는 현장 설명 한 줄만 입력해도 위험 요약, 위험성평가 초안, TBM 브리핑, TBM 일지 초안을 한 번에 생성하는 흐름을 보여줍니다.",
      "실무에서는 작업 전 비계 고정상태, 추락방호, 작업중지 기준, 작업자 역할 분담을 먼저 확인해야 합니다."
    ].join("\n\n"),
    practicalPoints: [
      "작업 시작 전 비계 바퀴 고정과 아웃트리거 상태를 재확인한다",
      "풍속 상승 시 외벽 가장자리 작업을 즉시 중지하는 기준을 공유한다",
      "작업자 5명 전원이 추락방지구와 보호구 착용 여부를 상호 점검한다"
    ],
    citations,
    sourceMix: buildSourceMix(citations),
    mode,
    scenario,
    riskSummary: {
      title: "이동식 비계 외벽 도장 작업",
      riskLevel: "상",
      topRisk: "강풍 상황에서 이동식 비계가 흔들리며 작업자가 추락하거나 비계가 전도될 위험",
      immediateActions: [
        "작업 전 비계 고정핀, 바퀴 잠금, 작업발판 상태 점검",
        "풍속 상승 또는 돌풍 체감 시 즉시 작업중지 후 지상 대기",
        "작업반장 주도로 보호구 착용과 작업구간 출입통제를 확인"
      ]
    },
    deliverables: {
      riskAssessmentDraft: [
        "1. 작업명: 이동식 비계를 활용한 외벽 도장 작업",
        "2. 주요 유해·위험요인: 추락, 비계 전도, 도장자재 낙하, 강풍으로 인한 자세 불안정",
        "3. 위험성 수준: 상",
        "4. 감소대책: 비계 점검표 확인, 바퀴 잠금 및 수평 확보, 추락방지구 착용, 강풍 시 작업중지, 하부 출입통제",
        "5. 확인 책임자: 현장소장 / 작업반장"
      ].join("\n"),
      tbmBriefing: [
        "오늘 작업은 외벽 도장 작업이며 이동식 비계를 사용합니다.",
        "가장 큰 위험은 추락과 강풍으로 인한 비계 흔들림입니다.",
        "비계 고정상태와 발판 상태를 먼저 확인하고, 보호구 미착용자는 작업에 투입하지 않습니다.",
        "돌풍이 불거나 비계 흔들림이 느껴지면 즉시 '작업중지'를 선언하고 지상으로 이동합니다.",
        "하부 통제구역 밖 인원 접근을 막고 자재 낙하에 주의합니다."
      ].join("\n"),
      tbmLogDraft: [
        "TBM 일시: 2026-03-29 08:00",
        `대상 작업: ${scenario.workSummary}`,
        `참석 인원: ${scenario.workerCount}명`,
        "전달 사항: 비계 점검, 추락방지구 착용, 강풍 시 작업중지, 하부 출입통제",
        "작업자 확인: 전원 구두 복창 및 서명 예정"
      ].join("\n"),
      kakaoMessage: [
        "[오늘 작업 안전공지]",
        `현장: ${scenario.siteName}`,
        "작업: 이동식 비계 외벽 도장",
        "핵심위험: 강풍 시 비계 흔들림 및 추락",
        "필수조치: 비계 바퀴 잠금 확인 / 안전대-보호구 착용 / 돌풍 시 즉시 작업중지 / 하부 출입통제",
        "TBM 내용 확인 후 작업 시작 바랍니다."
      ].join("\n")
    },
    status: {
      lawgo: mode === "live" ? "live" : mode === "fallback" ? "fallback" : "mock",
      ai: mode === "live" ? "live" : mode === "fallback" ? "fallback" : "mock",
      summary: mode === "live" ? "라이브 응답" : mode === "fallback" ? "라이브 실패 후 데모 응답으로 전환" : "데모 응답",
      detail: statusDetail,
      policyNote: "실 API 호출은 timeout 20초, 1회 retry, 실패 시 graceful fallback 정책을 따릅니다."
    }
  };
}
