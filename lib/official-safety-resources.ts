export type OfficialSafetyResource = {
  id: string;
  agency: "KOSHA" | "MOEL";
  title: string;
  kind: "guide" | "manual" | "education" | "research" | "board" | "press";
  category: string;
  url: string;
  appliesTo: string[];
  summary: string;
  impact: string;
  templateHints: string[];
};

const resources: OfficialSafetyResource[] = [
  {
    id: "kosha-risk-assessment-program",
    agency: "KOSHA",
    title: "KOSHA 위험성평가 사업안내",
    kind: "guide",
    category: "위험성평가 절차",
    url: "https://www.kosha.or.kr/kosha/business/rskassessment.do",
    appliesTo: ["위험성평가표", "안전교육일지"],
    summary: "위험성평가를 유해·위험요인 파악, 위험성 결정, 감소대책 수립·실행, 공유·기록 흐름으로 정리하는 공식 안내입니다.",
    impact: "위험성평가표의 사전준비, 위험요인 파악, 감소대책, 조치 확인 항목을 정렬합니다.",
    templateHints: ["사전준비", "유해·위험요인 파악", "위험성 결정", "감소대책 수립 및 실행", "공유·교육", "조치 확인"]
  },
  {
    id: "kosha-4m-risk-manual",
    agency: "KOSHA",
    title: "KOSHA 4M 기법 위험성평가 메뉴얼",
    kind: "manual",
    category: "4M 위험성평가",
    url: "https://oshri.kosha.or.kr/kosha/data/rskassessmentd.do?articleNo=84457&mode=view",
    appliesTo: ["위험성평가표"],
    summary: "Man, Machine, Media, Management 관점으로 위험요인을 빠짐없이 점검하는 위험성평가 참고자료입니다.",
    impact: "작업자, 장비, 작업환경, 관리체계 관점의 누락 점검 문구를 위험성평가표에 반영합니다.",
    templateHints: ["Man: 작업자", "Machine: 장비·도구", "Media: 작업환경", "Management: 관리체계"]
  },
  {
    id: "kosha-risk-assessment-education",
    agency: "KOSHA",
    title: "KOSHA 위험성평가 교육자료",
    kind: "education",
    category: "위험성평가 교육",
    url: "https://edu.kosha.or.kr/headquater/support/pds/filedownload/20240618161529_4648504880514822912_pdf",
    appliesTo: ["위험성평가표", "안전교육일지"],
    summary: "위험성평가 작성과 작업자 공유 교육에 활용할 수 있는 KOSHA 교육자료입니다.",
    impact: "위험성평가 결과를 작업자 교육·공유 기록으로 연결하는 문구를 보강합니다.",
    templateHints: ["작업자 참여", "위험성평가 결과 공유", "교육 실시", "개선대책 확인"]
  },
  {
    id: "kosha-tbm-ops",
    agency: "KOSHA",
    title: "KOSHA 작업 전 안전점검회의(TBM) OPS",
    kind: "board",
    category: "TBM 운영",
    url: "https://edu.kosha.or.kr/headquater/support/assist/noticeboard/details?bbsEsntlNo=2913",
    appliesTo: ["TBM 브리핑", "TBM 회의록", "안전교육일지"],
    summary: "작업 전 안전점검회의 목적과 진행 흐름을 현장 브리핑에 맞춰 정리하는 공식 안내 축입니다.",
    impact: "TBM의 작업내용, 위험요인, 안전대책, 참석자 확인, 기록 메모 항목을 고정합니다.",
    templateHints: ["작업내용", "위험요인", "안전대책", "참석자 확인", "사진·영상 기록 메모"]
  },
  {
    id: "moel-tbm-education-credit",
    agency: "MOEL",
    title: "고용노동부 TBM 정기교육 시간 인정 안내",
    kind: "press",
    category: "교육 인정",
    url: "https://www.moel.go.kr/news/enews/report/enewsView.do?news_seq=16488",
    appliesTo: ["TBM 회의록", "안전교육일지"],
    summary: "위험성평가 결과를 반영한 TBM을 산업안전보건 정기교육 시간으로 인정할 수 있다는 고용노동부 안내입니다.",
    impact: "TBM 기록을 교육 증빙으로 활용할 수 있음을 안전교육 기록에 단정적이지 않게 반영합니다.",
    templateHints: ["작업일지", "모바일 앱", "동영상", "회의자료", "교육시간 인정 검토"]
  },
  {
    id: "kosha-safety-education-guidebook",
    agency: "KOSHA",
    title: "산업안전보건교육 가이드북",
    kind: "education",
    category: "안전보건교육",
    url: "https://oshri.kosha.or.kr/kosha/intro/gyeonggiBranch_A.do?articleNo=414441&attachNo=233889&mode=download",
    appliesTo: ["안전교육일지"],
    summary: "안전보건교육 대상, 내용, 확인 방식 정리에 참고할 수 있는 교육 가이드북입니다.",
    impact: "교육대상, 교육내용, 확인방법, 후속 교육 추천 항목을 안전교육 기록에 분리합니다.",
    templateHints: ["교육대상", "교육내용", "확인방법", "후속 교육"]
  },
  {
    id: "kosha-forklift-guide",
    agency: "KOSHA",
    title: "지게차의 안전작업에 관한 기술지원규정",
    kind: "guide",
    category: "지게차 작업",
    url: "https://oshri.kosha.or.kr/kosha/info/koshaGuideData.do?articleNo=453866&mode=view",
    appliesTo: ["위험성평가표", "TBM 브리핑"],
    summary: "지게차 작업 시 안전장치, 하역장소, 작업방법을 정리한 KOSHA 기술지원규정입니다.",
    impact: "동선 분리, 하역구역 통제, 운전 전 점검 문구를 위험성평가와 TBM에 반영합니다.",
    templateHints: ["동선 분리", "하역구역 통제", "운전 전 점검", "신호수 배치"]
  },
  {
    id: "kosha-forklift-plan",
    agency: "KOSHA",
    title: "지게차의 안전작업계획서 작성지침",
    kind: "manual",
    category: "작업계획",
    url: "https://oshri.kosha.or.kr/kosha/intro/northernGyeonggiBranch_A.do?articleNo=351943&attachNo=199463&mode=download",
    appliesTo: ["위험성평가표", "TBM 회의록"],
    summary: "지게차 작업계획 수립과 안전조치 반영 포인트를 참고할 수 있는 KOSHA 자료입니다.",
    impact: "지게차 작업계획, 신호수, 접근금지구역 확인 항목을 보강합니다.",
    templateHints: ["작업계획", "운행경로", "접근금지구역", "신호방법"]
  },
  {
    id: "kosha-hot-work-manual",
    agency: "KOSHA",
    title: "화기작업 화재·폭발 예방 매뉴얼",
    kind: "manual",
    category: "화기작업",
    url: "https://kosha.or.kr/kosha/data/screening_e.do?articleNo=235017&attachNo=113021&mode=download",
    appliesTo: ["위험성평가표", "TBM 브리핑", "안전교육일지"],
    summary: "용접·용단 등 화기작업 전 허가, 가연물 제거, 화재감시를 정리한 공식 매뉴얼입니다.",
    impact: "작업허가, 가연물 통제, 화재감시자 배치 문구를 보강합니다.",
    templateHints: ["작업허가", "가연물 제거", "화재감시자", "소화설비"]
  },
  {
    id: "kosha-confined-space-guide",
    agency: "KOSHA",
    title: "KOSHA Guide 밀폐공간 위험관리",
    kind: "guide",
    category: "밀폐공간",
    url: "https://www.kosha.or.kr/kosha/data/guidanceX.do",
    appliesTo: ["위험성평가표", "TBM 브리핑", "안전교육일지"],
    summary: "밀폐공간과 위험공간 출입 전 관리 기준을 확인할 수 있는 KOSHA Guide 축입니다.",
    impact: "출입 전 산소·유해가스 확인, 감시인 배치, 구조절차 공유 문구를 반영합니다.",
    templateHints: ["출입 전 측정", "환기", "감시인", "구조절차"]
  }
];

function containsAny(value: string, keywords: string[]) {
  return keywords.some((keyword) => value.includes(keyword));
}

export function pickOfficialSafetyResources(question: string) {
  const normalized = question.toLowerCase();
  const selected = resources.filter((resource) => {
    if (["kosha-risk-assessment-program", "kosha-risk-assessment-education", "kosha-tbm-ops", "moel-tbm-education-credit", "kosha-safety-education-guidebook"].includes(resource.id)) {
      return true;
    }
    if (resource.id.includes("forklift")) {
      return containsAny(normalized, ["지게차", "물류", "상하차", "동선"]);
    }
    if (resource.id.includes("hot-work")) {
      return containsAny(normalized, ["용접", "절단", "화기", "불티"]);
    }
    if (resource.id.includes("confined")) {
      return containsAny(normalized, ["밀폐", "기계실", "감전", "누수", "지하"]);
    }
    return false;
  });

  return selected.slice(0, 8);
}

export function getOfficialSafetyResources() {
  return resources;
}
