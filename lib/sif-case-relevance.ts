// SIF(중대재해) 유사사례가 이 작업과 맞는지 가른다. 안전 지식 DB 검색 순위만으로는 밀폐공간 작업에
// 열처리로 폭발, 화재 작업에 리프트 추락 사례가 붙었다(261101 MCP 실측). DB 스키마·재적재 없이
// 지금 sif-case 항목이 가진 칸(title·summary·risk_tags·keywords)만으로 재정렬·제외한다.
//
// 매칭 키(조사 문서 SIF_소스지도_종합_261101 §4): 업종·작업·기인물·재해형태.
// - 작업·기인물(장소·설비) = WORK_CONTEXTS. 사례와 작업 설명이 하나도 겹치지 않으면 제외한다.
// - 재해형태 = lib/db-harness.ts koshaHazardFamiliesFromText(KOSHA 지침 근거 고르기와 같은 사전).
//   순서(점수)에만 쓰고 제외 근거로 쓰지 않는다. 작업 설명에는 재해형태가 잘 안 적히고(「굴착공사」에 「붕괴」 없음),
//   행의 재해유형은 생성 결과라 굴착 작업의 붕괴 사례를 잘못 뺀다(261101 시험).
// - 업종: 지금 항목에는 제조업등 시트의 업종 칸이 요약 260자 안에 남지 않는 경우가 많아 키로 쓰지 않는다.
import { koshaHazardFamiliesFromText, type KoshaHazardFamily } from "@/lib/db-harness";
import type { SafetyReferenceItem } from "@/lib/safety-reference-catalog";
import { CHEMICAL_SUBSTANCE, CONFINED_IDENTITY } from "@/lib/task-scenario-profiles";

type WorkContext = { label: string; pattern: RegExp };

// 작업·장소·기인물 묶음. 밀폐공간·화학물질은 작업 분류(task-scenario-profiles)의 식별식을 그대로 쓰고
// 사례 문장에 흔한 「배관 안」「덕트 내부」만 더한다.
const WORK_CONTEXTS: readonly WorkContext[] = [
  { label: "밀폐공간", pattern: new RegExp(`${CONFINED_IDENTITY.source}|밀폐|(?:배관|덕트|탱크|용기|저수조|맨홀)\\s*(?:안|내부)|피트|사일로`, "u") },
  { label: "화기·용접", pattern: /용접|용단|화기\s*작업|불꽃|불티|토치|그라인더|가스\s*절단/u },
  { label: "화학물질·인화성", pattern: new RegExp(`${CHEMICAL_SUBSTANCE.source}|도장|도료|희석제|유증기|가연성\\s*증기|LPG|프로판`, "u") },
  { label: "고소·개구부", pattern: /고소|사다리|비계|지붕|개구부|단부|작업발판|달비계|리프트|승강기/u },
  { label: "차량·운반기계", pattern: /지게차|화물차|트럭|덤프|굴착기|크레인|차량|컨베이어|운반대차/u },
  { label: "기계·설비", pattern: /프레스|롤러|사출|성형기|금형|분쇄기|혼합기|회전체|가동부/u },
  { label: "굴착·토사", pattern: /굴착|흙막이|토사|사면|터파기/u },
  { label: "전기", pattern: /전기\s*(?:작업|설비)|분전반|배전|충전부|활선|고압선/u },
  { label: "폭염·온열", pattern: /폭염|온열|열사병|고온\s*작업/u }
];

// 같은 사고로 함께 적히는 재해형태는 같은 묶음으로 본다(화재·폭발 ↔ 화상, 질식 ↔ 유해물질 노출).
const FAMILY_GROUP: Readonly<Partial<Record<KoshaHazardFamily, string>>> = {
  fire_or_explosion: "화재·폭발·화상",
  burn: "화재·폭발·화상",
  asphyxiation: "질식·유해물질",
  chemical_exposure: "질식·유해물질",
  fall: "추락",
  caught_in: "끼임",
  collision: "충돌",
  electrical: "감전",
  falling_object: "낙하·맞음",
  collapse_or_overturn: "붕괴·전도",
  slip_or_trip: "넘어짐",
  cut: "베임·절단",
  heat_illness: "온열질환",
  drowning: "익사",
  noise: "소음",
  ergonomic: "근골격계"
};

function workContextsOf(text: string): Set<string> {
  return new Set(WORK_CONTEXTS.filter(({ pattern }) => pattern.test(text)).map(({ label }) => label));
}

function familyGroupsOf(text: string): Set<string> {
  return new Set([...koshaHazardFamiliesFromText(text)].map((family) => FAMILY_GROUP[family] ?? family));
}

export type SifRelevance = {
  /** 2 × 겹친 작업 묶음 수 + 겹친 재해형태 묶음 수. 순서만 정하고 확률이 아니다. */
  score: number;
  matchedWork: string[];
  matchedAccidentTypes: string[];
};

export type SifRelevanceQuery = {
  /** 작업 설명(호출 질문 + 시나리오 작업 요약). 작업·장소·기인물 키는 여기서만 뽑는다(생성된 행은 쓰지 않는다). */
  workText: string;
  /** 재해형태 키를 더 뽑을 글(본표 행의 재해유형 라벨 등). */
  accidentTypeText?: string;
};

export type SifRelevanceDecision<T> =
  | { kept: true; item: T; relevance: SifRelevance }
  | { kept: false; item: T; reason: string };

function caseText(item: SafetyReferenceItem): string {
  return [item.title, item.summary, item.body || "", ...(item.risk_tags || []), ...(item.keywords || [])].join(" ");
}

export function judgeSifCase(item: SafetyReferenceItem, query: SifRelevanceQuery): SifRelevanceDecision<SafetyReferenceItem> {
  const text = caseText(item);
  const queryWork = workContextsOf(query.workText);
  const caseWork = workContextsOf(text);
  const queryTypes = familyGroupsOf(`${query.workText} ${query.accidentTypeText ?? ""}`);
  const caseTypes = familyGroupsOf(text);
  const matchedWork = [...caseWork].filter((label) => queryWork.has(label));
  const matchedAccidentTypes = [...caseTypes].filter((label) => queryTypes.has(label));

  if (queryWork.size && !matchedWork.length) {
    return {
      kept: false,
      item,
      reason: `작업·장소·기인물이 다름(사례: ${[...caseWork].join("·") || "확인 안 됨"} / 작업: ${[...queryWork].join("·")})`
    };
  }
  return { kept: true, item, relevance: { score: matchedWork.length * 2 + matchedAccidentTypes.length, matchedWork, matchedAccidentTypes } };
}

/** 관련 있는 사례만 점수 높은 순(같으면 검색 순서)으로 남기고, 뺀 사례는 이유와 함께 돌려준다. */
export function rankSifCases(items: readonly SafetyReferenceItem[], query: SifRelevanceQuery): {
  kept: Array<{ item: SafetyReferenceItem; relevance: SifRelevance }>;
  dropped: Array<{ item: SafetyReferenceItem; reason: string }>;
} {
  const decisions = items.map((item, index) => ({ index, decision: judgeSifCase(item, query) }));
  const kept = decisions
    .flatMap(({ index, decision }) => (decision.kept ? [{ index, item: decision.item, relevance: decision.relevance }] : []))
    .sort((left, right) => right.relevance.score - left.relevance.score || left.index - right.index)
    .map(({ item, relevance }) => ({ item, relevance }));
  const dropped = decisions.flatMap(({ decision }) => (decision.kept ? [] : [{ item: decision.item, reason: decision.reason }]));
  return { kept, dropped };
}
