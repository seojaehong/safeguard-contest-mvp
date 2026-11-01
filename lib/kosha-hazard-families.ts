// 재해형태 사전. KOSHA 지침 근거 고르기(lib/db-harness.ts)와 SIF 사례 관련성(lib/sif-case-relevance.ts)이 같이 쓴다.
// db-harness 가 sif-case-relevance 를 부르므로 순환 import 를 피하려고 따로 둔다.
export type KoshaHazardFamily =
  | "asphyxiation"
  | "burn"
  | "caught_in"
  | "chemical_exposure"
  | "collision"
  | "collapse_or_overturn"
  | "cut"
  | "drowning"
  | "electrical"
  | "ergonomic"
  | "fall"
  | "falling_object"
  | "fire_or_explosion"
  | "heat_illness"
  | "noise"
  | "slip_or_trip";

const KOSHA_HAZARD_FAMILY_PATTERNS: ReadonlyArray<{
  family: KoshaHazardFamily;
  pattern: RegExp;
}> = [
  { family: "collision", pattern: /충돌|교통사고|차량\s*충돌|부딪|접촉\s*사고/u },
  { family: "fire_or_explosion", pattern: /화재|폭발|점화|발화|연료\s*누출|연료누출|가스\s*누출|인화성|가연물|용탕/u },
  { family: "fall", pattern: /추락|떨어짐|낙상/u },
  { family: "caught_in", pattern: /끼임|협착|말림|불시기동|가동부/u },
  { family: "electrical", pattern: /감전|누전|충전부|활선|전기.*접촉/u },
  { family: "asphyxiation", pattern: /질식|산소결핍|밀폐공간|유해가스/u },
  { family: "falling_object", pattern: /낙하|비래|인양|양중/u },
  { family: "collapse_or_overturn", pattern: /붕괴|도괴|전복|전도/u },
  { family: "slip_or_trip", pattern: /미끄|넘어짐|걸려\s*넘어/u },
  { family: "chemical_exposure", pattern: /중독|화학물질|유해물질|분진|가스\s*노출|세정제/u },
  { family: "burn", pattern: /화상|고온|용탕/u },
  { family: "cut", pattern: /절단|베임/u },
  { family: "heat_illness", pattern: /폭염|온열|열사병/u },
  { family: "drowning", pattern: /익사|물에\s*빠/u },
  { family: "noise", pattern: /소음|청력/u },
  { family: "ergonomic", pattern: /근골격|중량물|요통/u }
];

export function koshaHazardFamiliesFromText(text: string): Set<KoshaHazardFamily> {
  const semanticText = text.normalize("NFC").toLowerCase();
  return new Set(KOSHA_HAZARD_FAMILY_PATTERNS
    .filter(({ pattern }) => pattern.test(semanticText))
    .map(({ family }) => family));
}
