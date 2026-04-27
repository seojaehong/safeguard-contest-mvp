import { IntegrationMode } from "./types";

type KoshaReference = {
  title: string;
  category: string;
  summary: string;
  impact: string;
  url: string;
  sourceKind: "guide" | "manual" | "education" | "research" | "board";
  appliedTo: string[];
  verified?: boolean;
};

const REQUEST_TIMEOUT_MS = 20_000;
const RETRY_COUNT = 1;

const references: Record<"construction" | "logistics" | "manufacturing" | "facility", KoshaReference[]> = {
  construction: [
    {
      title: "KOSHA 작업 전 안전점검회의(TBM) 안내",
      category: "TBM 운영",
      summary: "작업 전 안전점검회의 운영 취지와 현장 적용 포인트를 설명하는 공식 안내입니다.",
      impact: "작업 전 브리핑 구조와 질문 항목을 공식 운영 흐름에 맞추는 근거로 사용합니다.",
      url: "https://www.kosha.or.kr/kosha/business/constructionLife.do?mode=view&articleNo=459856&article.offset=0&articleLimit=10",
      sourceKind: "board",
      appliedTo: ["TBM 브리핑", "TBM 회의록", "안전교육일지"]
    },
    {
      title: "KOSHA 위험성평가 교육자료",
      category: "위험성평가",
      summary: "위험성평가표 작성과 유해·위험요인 도출 기준을 참고할 수 있는 공식 교육자료입니다.",
      impact: "위험성평가표의 유해·위험요인, 감소대책, 잔여 위험성 표현을 정렬하는 기준으로 사용합니다.",
      url: "https://edu.kosha.or.kr/headquater/support/pds/filedownload/20240618161529_4648504880514822912_pdf",
      sourceKind: "education",
      appliedTo: ["위험성평가표", "안전교육일지"]
    },
    {
      title: "KOSHA Guide: 추락재해 예방",
      category: "추락 예방",
      summary: "고소작업, 이동식 비계, 개구부 등 추락 위험 작업 전 확인할 점검 항목을 보강하는 공식 가이드 축입니다.",
      impact: "외벽 도장·비계 작업에서 작업중지 기준, 보호구 착용, 작업발판 점검 문구를 강화합니다.",
      url: "https://www.kosha.or.kr/kosha/data/guidanceX.do",
      sourceKind: "guide",
      appliedTo: ["위험성평가표", "TBM 브리핑", "안전교육일지"]
    }
  ],
  logistics: [
    {
      title: "지게차의 안전작업에 관한 기술지원규정",
      category: "지게차 작업",
      summary: "지게차 작업 시 안전장치, 하역장소, 작업방법을 정리한 KOSHA 기술지원규정입니다.",
      impact: "물류·상하차 시나리오의 동선 분리, 하역구역 통제, 운전 전 점검 문구를 만드는 근거로 사용합니다.",
      url: "https://oshri.kosha.or.kr/kosha/info/koshaGuideData.do?articleNo=453866&mode=view",
      sourceKind: "guide",
      appliedTo: ["위험성평가표", "TBM 브리핑"]
    },
    {
      title: "지게차의 안전작업계획서 작성지침",
      category: "작업계획",
      summary: "지게차 작업계획 수립과 안전조치 반영 포인트를 참고할 수 있는 KOSHA 자료입니다.",
      impact: "상하차·피킹 시나리오에서 작업계획과 신호수 배치 체크포인트를 설명하는 보강 근거입니다.",
      url: "https://oshri.kosha.or.kr/kosha/intro/northernGyeonggiBranch_A.do?articleNo=351943&attachNo=199463&mode=download",
      sourceKind: "manual",
      appliedTo: ["위험성평가표", "TBM 회의록"]
    }
  ],
  manufacturing: [
    {
      title: "화기작업 화재·폭발 예방 매뉴얼",
      category: "화기작업",
      summary: "용접·용단 등 화기작업 전 허가, 가연물 제거, 화재감시를 정리한 공식 매뉴얼입니다.",
      impact: "용접·절단 시나리오의 화재감시자, 작업허가, 가연물 통제 문구를 강화하는 근거입니다.",
      url: "https://kosha.or.kr/kosha/data/screening_e.do?articleNo=235017&attachNo=113021&mode=download",
      sourceKind: "manual",
      appliedTo: ["위험성평가표", "TBM 브리핑", "안전교육일지"]
    },
    {
      title: "용접·용단 작업 화재폭발 예방 제도 개선 연구",
      category: "사고예방 연구",
      summary: "용접·용단 작업에서 불티, 가연물, 사전점검의 중요성을 정리한 KOSHA 연구보고서입니다.",
      impact: "제조업 시나리오에서 사전 점검과 작업허가를 단순 권고가 아닌 사고예방 근거로 설명할 수 있습니다.",
      url: "https://www.kosha.or.kr/oshri/publication/researchReportSearch.do?article.offset=0&articleLimit=5&articleNo=411108&mode=view",
      sourceKind: "research",
      appliedTo: ["위험성평가표", "안전교육일지"]
    }
  ],
  facility: [
    {
      title: "밀폐공간 위험관리에 관한 기술지침",
      category: "협소공간",
      summary: "밀폐공간과 유사한 위험공간 관리 시 참고할 수 있는 KOSHA 기술지침 목록입니다.",
      impact: "지하 기계실 시나리오의 단독작업 금지, 출입 관리, 위험공간 인지 문구를 뒷받침합니다.",
      url: "https://www.kosha.or.kr/kosha/data/guidanceX.do",
      sourceKind: "guide",
      appliedTo: ["위험성평가표", "TBM 브리핑"]
    },
    {
      title: "KOSHA Guide 및 법령 간 연계성",
      category: "법령 연계",
      summary: "KOSHA Guide와 산업안전보건 관련 기준규칙의 연결 관계를 정리한 공식 자료입니다.",
      impact: "시설관리 시나리오에서 KOSHA 자료가 법령 보강 축이라는 점을 심사위원에게 설명하는 근거입니다.",
      url: "https://kosha.or.kr/cms/resFileDownload.do?fileName=KOSHA_Guide_%EB%B0%8F_%EB%B2%95%EB%A0%B9_%EA%B0%84_%EC%97%B0%EA%B3%84%EC%84%B1%28Guide_%EA%B8%B0%EC%A4%80%29.pdf&siteId=kosha&type=etc",
      sourceKind: "research",
      appliedTo: ["근거 출처", "위험성평가표"]
    }
  ]
};

async function wait(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchWithTimeout(url: string): Promise<boolean> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      cache: "no-store",
      redirect: "follow",
      signal: controller.signal,
      headers: {
        "User-Agent": "SafeGuard contest MVP official-resource-check"
      }
    });
    const text = await response.text().catch(() => "");
    return response.ok && (text.length > 0 || response.headers.has("content-type"));
  } finally {
    clearTimeout(timeout);
  }
}

async function verifyReference(reference: KoshaReference): Promise<KoshaReference> {
  let verified = false;
  let lastError: unknown;

  for (let attempt = 0; attempt <= RETRY_COUNT; attempt += 1) {
    try {
      verified = await fetchWithTimeout(reference.url);
      if (verified) break;
    } catch (error) {
      lastError = error;
      if (attempt < RETRY_COUNT) await wait(400);
    }
  }

  if (lastError && !verified) {
    console.warn("KOSHA reference verification failed", reference.url, lastError);
  }

  return { ...reference, verified };
}

function pickReferences(question: string) {
  const normalized = question.toLowerCase();
  const groups: KoshaReference[][] = [];

  if (normalized.includes("비계") || normalized.includes("추락") || normalized.includes("고소") || normalized.includes("외벽") || normalized.includes("건설")) {
    groups.push(references.construction);
  }
  if (normalized.includes("지게차") || normalized.includes("물류") || normalized.includes("상하차") || normalized.includes("동선")) {
    groups.push(references.logistics);
  }
  if (normalized.includes("용접") || normalized.includes("절단") || normalized.includes("화기")) {
    groups.push(references.manufacturing);
  }
  if (normalized.includes("기계실") || normalized.includes("감전") || normalized.includes("누수") || normalized.includes("밀폐")) {
    groups.push(references.facility);
  }
  if (!groups.length) {
    groups.push(references.construction);
  }

  return groups.flat().filter((item, index, arr) => arr.findIndex((other) => other.url === item.url) === index).slice(0, 4);
}

export async function fetchKoshaReferences(question: string): Promise<{
  source: "kosha";
  mode: IntegrationMode;
  detail: string;
  references: KoshaReference[];
}> {
  const selected = pickReferences(question);
  const verifiedReferences = await Promise.all(selected.map((reference) => verifyReference(reference)));
  const verifiedCount = verifiedReferences.filter((reference) => reference.verified).length;

  return {
    source: "kosha",
    mode: verifiedCount ? "live" : "fallback",
    detail: verifiedCount
      ? `KOSHA 공식 매뉴얼·Guide URL ${verifiedCount}건 확인. 확인된 자료의 요약과 반영 위치를 위험성평가·TBM·교육 문구에 적용했습니다.`
      : "KOSHA 공식 자료 URL 확인에 실패해 사전 매핑된 Guide·교육자료 요약을 사용했습니다.",
    references: verifiedReferences
  };
}
