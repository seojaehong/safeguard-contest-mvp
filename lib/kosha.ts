import { IntegrationMode } from "./types";

const references = {
  construction: [
    {
      title: "KOSHA 작업 전 안전점검회의(TBM) 안내",
      category: "TBM 운영",
      summary: "작업 전 안전점검회의 운영 취지와 현장 적용 포인트를 설명하는 공식 안내입니다.",
      impact: "작업 전 브리핑 구조와 질문 항목을 공식 운영 흐름에 맞추는 근거로 사용합니다.",
      url: "https://www.kosha.or.kr/kosha/business/constructionLife.do?mode=view&articleNo=459856&article.offset=0&articleLimit=10"
    },
    {
      title: "KOSHA 위험성평가 교육자료",
      category: "위험성평가",
      summary: "위험성평가표 작성과 유해·위험요인 도출 기준을 참고할 수 있는 공식 교육자료입니다.",
      impact: "위험성평가표의 유해·위험요인, 감소대책, 잔여 위험성 표현을 정렬하는 기준으로 사용합니다.",
      url: "https://edu.kosha.or.kr/headquater/support/pds/filedownload/20240618161529_4648504880514822912_pdf"
    }
  ],
  logistics: [
    {
      title: "지게차의 안전작업에 관한 기술지원규정",
      category: "지게차 작업",
      summary: "지게차 작업 시 안전장치, 하역장소, 작업방법을 정리한 KOSHA 기술지원규정입니다.",
      impact: "물류·상하차 시나리오의 동선 분리, 하역구역 통제, 운전 전 점검 문구를 만드는 근거로 사용합니다.",
      url: "https://oshri.kosha.or.kr/kosha/info/koshaGuideData.do?articleNo=453866&mode=view"
    },
    {
      title: "지게차의 안전작업계획서 작성지침",
      category: "작업계획",
      summary: "지게차 작업계획 수립과 안전조치 반영 포인트를 참고할 수 있는 KOSHA 자료입니다.",
      impact: "상하차·피킹 시나리오에서 작업계획과 신호수 배치 체크포인트를 설명하는 보강 근거입니다.",
      url: "https://oshri.kosha.or.kr/kosha/intro/northernGyeonggiBranch_A.do?articleNo=351943&attachNo=199463&mode=download"
    }
  ],
  manufacturing: [
    {
      title: "화기작업 화재·폭발 예방 매뉴얼",
      category: "화기작업",
      summary: "용접·용단 등 화기작업 전 허가, 가연물 제거, 화재감시를 정리한 공식 매뉴얼입니다.",
      impact: "용접·절단 시나리오의 화재감시자, 작업허가, 가연물 통제 문구를 강화하는 근거입니다.",
      url: "https://kosha.or.kr/kosha/data/screening_e.do?articleNo=235017&attachNo=113021&mode=download"
    },
    {
      title: "용접·용단 작업 화재폭발 예방 제도 개선 연구",
      category: "사고예방 연구",
      summary: "용접·용단 작업에서 불티, 가연물, 사전점검의 중요성을 정리한 KOSHA 연구보고서입니다.",
      impact: "제조업 시나리오에서 사전 점검과 작업허가를 단순 권고가 아닌 사고예방 근거로 설명할 수 있습니다.",
      url: "https://www.kosha.or.kr/oshri/publication/researchReportSearch.do?article.offset=0&articleLimit=5&articleNo=411108&mode=view"
    }
  ],
  facility: [
    {
      title: "밀폐공간 위험관리에 관한 기술지침",
      category: "협소공간",
      summary: "밀폐공간과 유사한 위험공간 관리 시 참고할 수 있는 KOSHA 기술지침 목록입니다.",
      impact: "지하 기계실 시나리오의 단독작업 금지, 출입 관리, 위험공간 인지 문구를 뒷받침합니다.",
      url: "https://www.kosha.or.kr/kosha/data/guidanceX.do"
    },
    {
      title: "KOSHA Guide 및 법령 간 연계성",
      category: "법령 연계",
      summary: "KOSHA Guide와 산업안전보건 관련 기준규칙의 연결 관계를 정리한 공식 자료입니다.",
      impact: "시설관리 시나리오에서 KOSHA 자료가 법령 보강 축이라는 점을 심사위원에게 설명하는 근거입니다.",
      url: "https://kosha.or.kr/cms/resFileDownload.do?fileName=KOSHA_Guide_%EB%B0%8F_%EB%B2%95%EB%A0%B9_%EA%B0%84_%EC%97%B0%EA%B3%84%EC%84%B1%28Guide_%EA%B8%B0%EC%A4%80%29.pdf&siteId=kosha&type=etc"
    }
  ]
};

export async function fetchKoshaReferences(question: string): Promise<{
  source: "kosha";
  mode: IntegrationMode;
  detail: string;
  references: Array<{ title: string; category: string; summary: string; impact: string; url: string }>;
}> {
  const normalized = question.toLowerCase();
  const selected = normalized.includes("지게차") || normalized.includes("물류")
    ? references.logistics
    : normalized.includes("용접") || normalized.includes("절단") || normalized.includes("화기")
      ? references.manufacturing
      : normalized.includes("기계실") || normalized.includes("감전") || normalized.includes("누수")
        ? references.facility
        : references.construction;

  return {
    source: "kosha",
    mode: "fallback",
    detail: "KOSHA는 현재 공식 Guide·교육자료를 시나리오별로 매핑해 위험성평가와 TBM 문구를 보강하고 있으며, 별도 API 어댑터는 다음 단계에서 추가 연결 예정입니다.",
    references: selected
  };
}
