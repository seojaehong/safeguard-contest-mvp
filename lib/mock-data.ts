import { DetailRecord, SearchResult } from "./types";

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
    tags: ["판례", "안전교육", "보호구"]
  }
];

export const mockSearchResults: SearchResult[] = mockDetails.map((item) => ({
  id: item.id,
  type: item.type,
  title: item.title,
  summary: item.summary,
  citation: item.citation,
  sourceLabel: item.type === "law" ? "법제처 법령" : "법제처 판례",
  tags: item.tags
}));
