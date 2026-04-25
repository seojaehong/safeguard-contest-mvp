import { IntegrationMode } from "./types";

const references = {
  construction: [
    {
      title: "KOSHA 작업 전 안전점검회의(TBM) 안내",
      summary: "작업 전 안전점검회의 운영 취지와 현장 적용 포인트를 설명하는 공식 안내입니다.",
      url: "https://www.kosha.or.kr/kosha/business/constructionLife.do?mode=view&articleNo=459856&article.offset=0&articleLimit=10"
    },
    {
      title: "KOSHA 위험성평가 교육자료",
      summary: "위험성평가표 작성과 유해·위험요인 도출 기준을 참고할 수 있는 공식 교육자료입니다.",
      url: "https://edu.kosha.or.kr/headquater/support/pds/filedownload/20240618161529_4648504880514822912_pdf"
    }
  ],
  logistics: [
    {
      title: "KOSHA 안전보건자료",
      summary: "지게차 동선, 상하차, 보행자 충돌 예방에 활용할 수 있는 안전보건자료 모음입니다.",
      url: "https://www.kosha.or.kr/kosha/index.do"
    }
  ],
  manufacturing: [
    {
      title: "KOSHA 안전보건자료",
      summary: "용접·절단 화기작업, MSDS, 화재예방 자료를 추가로 찾을 때 활용하는 공식 포털입니다.",
      url: "https://www.kosha.or.kr/kosha/index.do"
    }
  ],
  facility: [
    {
      title: "KOSHA 안전보건자료",
      summary: "감전, 미끄럼, 협소공간 작업 예방 자료를 확인할 수 있는 공식 포털입니다.",
      url: "https://www.kosha.or.kr/kosha/index.do"
    }
  ]
};

export async function fetchKoshaReferences(question: string): Promise<{
  source: "kosha";
  mode: IntegrationMode;
  detail: string;
  references: Array<{ title: string; summary: string; url: string }>;
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
    detail: "KOSHA는 현재 공식 가이드 링크 보강 경로를 우선 사용하고 있으며, 별도 API 어댑터는 다음 단계에서 추가 연결 예정입니다.",
    references: selected
  };
}
