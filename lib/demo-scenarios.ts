export type DemoScenario = {
  id: string;
  label: string;
  region: string;
  industry: string;
  companyName: string;
  weatherSignal: string;
  hasForeignWorkers: boolean;
  skillMix: "숙련자 중심" | "신규 혼재" | "외국인·신규 혼재";
  workType: string;
  equipment: string[];
  question: string;
};

export const demoScenarios: DemoScenario[] = [
  {
    id: "seoul-construction-windy",
    label: "서울 건설 · 강풍 · 신규 혼재",
    region: "서울 성수동",
    industry: "건설업",
    companyName: "세이프건설",
    weatherSignal: "오후 강풍 예보",
    hasForeignWorkers: false,
    skillMix: "신규 혼재",
    workType: "외벽 도장 및 이동식 비계 작업",
    equipment: ["이동식 비계", "지게차"],
    question: "세이프건설 서울 성수동 근린생활시설 외벽 도장 작업. 이동식 비계 사용, 작업자 5명, 신규 투입자 1명, 오후 강풍 예보. 추락과 지게차 동선 위험을 반영해 오늘 위험성평가와 TBM, 안전보건교육 기록을 만들어줘."
  },
  {
    id: "incheon-logistics-rain",
    label: "인천 물류 · 우천 · 숙련자 중심",
    region: "인천 남동공단",
    industry: "물류업",
    companyName: "한빛로지스",
    weatherSignal: "우천 후 바닥 젖음",
    hasForeignWorkers: false,
    skillMix: "숙련자 중심",
    workType: "지게차 상하차 및 피킹",
    equipment: ["지게차", "랙", "팔레트"],
    question: "한빛로지스 인천 남동공단 물류센터 지게차 상하차 작업. 숙련 지게차 운전자 2명과 피킹 인력 6명, 우천 후 출입구 바닥 젖음, 보행 동선과 지게차 동선이 겹친다. 오늘 위험성평가와 TBM, 안전보건교육 기록을 만들어줘."
  },
  {
    id: "ansan-manufacturing-foreign-hotwork",
    label: "안산 제조 · 화기 · 외국인 포함",
    region: "경기 안산",
    industry: "제조업",
    companyName: "그린메탈",
    weatherSignal: "실내 고온·환기 불량",
    hasForeignWorkers: true,
    skillMix: "외국인·신규 혼재",
    workType: "용접·절단 화기작업",
    equipment: ["용접기", "절단기", "소화기"],
    question: "그린메탈 경기 안산 공장 배관 용접·절단 화기작업. 외국인 근로자 2명과 신규 작업자 1명 포함, 작업자 6명, 실내 고온과 환기 불량, 가연물 인접. 화재감시자와 다국어 안전교육까지 반영해 위험성평가, TBM, 안전보건교육 기록을 만들어줘."
  },
  {
    id: "busan-facility-confined",
    label: "부산 시설 · 밀폐공간 · 2인 작업",
    region: "부산 해운대",
    industry: "시설관리업",
    companyName: "이지시설관리",
    weatherSignal: "집중호우 후 지하 누수",
    hasForeignWorkers: false,
    skillMix: "신규 혼재",
    workType: "지하 기계실 배수펌프 점검",
    equipment: ["배수펌프", "전기판넬", "휴대용 조명"],
    question: "이지시설관리 부산 해운대 복합건물 지하 기계실 배수펌프 점검. 집중호우 후 누수, 밀폐공간 가능성, 감전과 산소결핍 우려, 작업자 2명 중 1명은 신규 투입자. 작업 전 위험성평가와 TBM, 안전보건교육 기록을 만들어줘."
  },
  {
    id: "gwangju-cleaning-foreign-chemical",
    label: "광주 청소 · 화학물질 · 외국인 포함",
    region: "광주 하남산단",
    industry: "서비스업",
    companyName: "클린온",
    weatherSignal: "실내 환기 제한",
    hasForeignWorkers: true,
    skillMix: "외국인·신규 혼재",
    workType: "공장 바닥 세척 및 화학세제 사용",
    equipment: ["세척기", "화학세제", "보안경"],
    question: "클린온 광주 하남산단 공장 바닥 세척 작업. 외국인 근로자 3명 포함, 신규 투입자 2명, 화학세제 사용과 실내 환기 제한, 미끄럼 위험이 있다. 쉬운 문장 안전교육과 후속 교육 추천까지 포함해 위험성평가, TBM, 안전보건교육 기록을 만들어줘."
  },
  {
    id: "daegu-warehouse-heat",
    label: "대구 창고 · 폭염 · 고령 숙련자",
    region: "대구 달서구",
    industry: "창고업",
    companyName: "대성창고",
    weatherSignal: "폭염주의 수준",
    hasForeignWorkers: false,
    skillMix: "숙련자 중심",
    workType: "고중량 박스 적재 및 수작업 운반",
    equipment: ["핸드파렛트", "이동대차", "냉방설비"],
    question: "대성창고 대구 달서구 창고 고중량 박스 적재 작업. 숙련 작업자 5명 중 고령 작업자 2명, 폭염주의 수준, 수작업 운반과 지게차 보조 이동이 있다. 온열질환과 근골격계 위험까지 반영해 위험성평가, TBM, 안전보건교육 기록을 만들어줘."
  }
];

export const defaultDemoScenario = demoScenarios[0];
