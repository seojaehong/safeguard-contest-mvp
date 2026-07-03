// Statutory-article citation gate. Stops the model from hallucinating 산업안전보건법 /
// 시행규칙 / 기준규칙(안전보건규칙) article numbers into generated text documents
// (2026-07-02 prod smoke — see task-4 brief).
//
// Prod failures caught (article number is real-looking but the (법령, 조번호) combo
// does not exist / is misattributed):
//   - "시행규칙 제35조(위험성평가)" — real answer is 법 제36조.
//   - "시행규칙 제100조 차량계" — real answer is 기준규칙 제171조~.
//   - "시행규칙 제9조 외국인 특수교육" — no such article.
//   - "시행규칙 제121/133/134조" — content belongs to 기준규칙, not 시행규칙.
//
// Note on scope: this gate can only catch citations to (법령, 조번호) combinations
// that don't exist in the whitelist. It cannot catch a citation to a *real* article
// number with a *wrong topic* (e.g. "법 제39조 추락방지" — 제39조 is a real article,
// just about 보건조치, not 추락방지) — that requires semantic review, not citation
// validation.

export type LawCategory = "법" | "시행규칙" | "기준규칙";

function range(start: number, end: number): string[] {
  const out: string[] = [];
  for (let n = start; n <= end; n++) out.push(String(n));
  return out;
}

export const VERIFIED_ARTICLES: Readonly<Record<LawCategory, ReadonlySet<string>>> = {
  법: new Set(["29", "36", "37", "38", "39", "41", "51", "52", "54", "57", "110", "114"]),
  시행규칙: new Set(["67", "73"]),
  기준규칙: new Set([
    "32",
    "38",
    "39",
    "40",
    "86",
    ...range(171, 179),
    ...range(180, 183),
    "241",
    "241의2",
    "562",
    "566",
    "567",
    // 2026-07-03 온톨로지 시드 법제처 검증분 (44개 신규 조문).
    // 산출 기준: seed/core-triples.json의 published 기준규칙 Article 노드(56개) 중
    // 기존 화이트리스트에 없는 것만 추가(감수 교정 — md 후보표의 보조근거 제54조·제132조는
    // 실제 Article 노드가 아니라 제외). scripts/ontology/gen-whitelist.mjs로 감사.
    ...range(42, 45), // 고소작업: 추락방지·개구부 방호·안전대 부착설비·지붕 위 위험 방지
    "13", // 안전난간의 구조 및 설치요건 (고소작업)
    ...range(55, 60), // 비계: 작업발판 적재하중/구조·조립해체·점검보수·강관비계
    "62", // 강관틀비계 (비계)
    "134", // 방호장치의 조정 (크레인 양중)
    "137", // 해지장치의 사용 (크레인 양중)
    "140", // 폭풍에 의한 이탈 방지 (크레인 양중)
    "146", // 크레인 작업 시의 조치 (크레인 양중)
    "187", // 승강설비 (지게차 상하차)
    "232", // 폭발 또는 화재 등의 예방 (화기 작업·도장)
    "236", // 화재 위험이 있는 작업의 장소 등 (용접·화기 작업)
    "239", // 위험물 등이 있는 장소에서 화기 등의 사용 금지 (화기 작업)
    "240", // 유류 등이 있는 배관이나 용기의 용접 등 (화기 작업)
    "301", // 전기 기계·기구 등의 충전부 방호 (전기 작업)
    "302", // 전기 기계·기구의 접지 (전기 작업·용접)
    "319", // 정전전로에서의 전기작업 (전기 작업)
    "321", // 충전전로에서의 전기작업 (전기 작업)
    "323", // 절연용 보호구 등의 사용 (전기 작업)
    "385", // 중량물 취급 (하역·운반)
    "387", // 꼬임이 끊어진 섬유로프 등의 사용 금지 (하역·운반)
    ...range(389, 391), // 하역·운반: 화물 빼내기 금지·하역작업장 조치기준·하적단 간격
    "393", // 화물의 적재 (하역·운반·지게차)
    "422", // 관리대상 유해물질과 관계되는 설비 (도장·용접)
    "429", // 국소배기장치의 성능 (도장)
    "450", // 호흡용 보호구의 지급 등 (도장)
    "451", // 보호복 등의 비치 등 (도장)
    ...range(619, 625), // 밀폐공간: 프로그램 수립·환기·인원 점검·출입 금지·감시인·안전대·대피기구
    "619의2" // 산소 및 유해가스 농도의 측정 및 기록 등 (밀폐공간)
  ])
};

const GENERIC_LAW_TERM = "산업안전보건법령";

// Ordered longest/most-specific first: alternation is tried in order at each match
// attempt, so a compound phrase like "산업안전보건법 시행규칙" must be checked before
// the bare "시행규칙" fallback, or the "산업안전보건법 " prefix would be left dangling
// after the invalid-citation collapse.
const LAW_PHRASE_PATTERNS: ReadonlyArray<{ re: RegExp; category: LawCategory }> = [
  { re: /(산업안전보건법\s*시행규칙)$/, category: "시행규칙" },
  { re: /((?:산업안전보건)?기준에\s*관한\s*규칙)$/, category: "기준규칙" },
  { re: /(안전보건규칙)$/, category: "기준규칙" },
  { re: /(기준규칙)$/, category: "기준규칙" },
  { re: /(시행규칙)$/, category: "시행규칙" },
  { re: /(산업안전보건법)$/, category: "법" },
  // Bare "법" abbreviation, but only as an isolated token (not the tail of an
  // unrelated compound word like "방법") — the character immediately before it
  // must be non-Hangul or the start of the window.
  { re: /(?:^|[^가-힣])(법)$/, category: "법" }
];

type LawPhraseMatch = { category: LawCategory; phraseStart: number };

// Looks for a law-name keyword ending at the tail of `window` (i.e. immediately
// before the citation it precedes, modulo trailing whitespace). Returns null when
// no recognizable keyword is found — the caller preserves the citation unchanged
// in that case (conservative, avoids false positives).
function findLawPhrase(window: string): LawPhraseMatch | null {
  const trimmed = window.replace(/\s+$/, "");
  for (const { re, category } of LAW_PHRASE_PATTERNS) {
    const m = re.exec(trimmed);
    if (m) {
      const phrase = m[1];
      return { category, phraseStart: trimmed.length - phrase.length };
    }
  }
  return null;
}

const WINDOW_SIZE = 40;
const ARTICLE_RE = /제(\d+)조(?:의(\d+))?/g;
const ANNEX_ITEM_RE = /별표\s*(\d+)\s*제\s*\d+\s*호/g;

// "제121/133/134조" — slash-separated article enumeration. Expanded to
// "제121조, 제133조, 제134조" before the main gate pass runs, so each article
// number is checked (and, if unverified, removed) individually instead of the
// whole slash run silently passing through as one unmatched token.
const SLASH_ARTICLE_LIST_RE = /제((?:\d+(?:의\d+)?\/)+\d+(?:의\d+)?)조/g;

function expandSlashArticleLists(text: string): string {
  return text.replace(SLASH_ARTICLE_LIST_RE, (_whole, list: string) =>
    list
      .split("/")
      .map((n) => `제${n}조`)
      .join(", ")
  );
}

// Gap between two consecutive "제N조" citations that consists only of list
// enumeration punctuation/words (콤마, 가운뎃점, "및", "부터", "까지", "~"/"-"
// range dashes, and whitespace). When a gap matches this, the law-name context
// resolved for the preceding citation is carried forward to the next one, so a
// law-name window match on the first item of a list ("시행규칙 제121조, 제133조,
// 제134조") applies to every item in the list, not just the first.
const LIST_CONNECTOR_RE = /^(?:[\s,·~-]|및|부터|까지)*$/;

// "별표N 제M호" citations can't be verified against any whitelist here, so the
// item-number half is always dropped, leaving just "별표N".
function sanitizeAnnexReferences(text: string): string {
  return text.replace(ANNEX_ITEM_RE, (_whole, annexNumber: string) => `별표${annexNumber}`);
}

function sanitizeArticleReferences(rawText: string): string {
  const text = expandSlashArticleLists(rawText);
  let result = "";
  let cursor = 0;
  let prevMatchEnd: number | null = null;
  let activeCategory: LawCategory | null = null;
  ARTICLE_RE.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = ARTICLE_RE.exec(text)) !== null) {
    const matchStart = match.index;
    const matchEnd = matchStart + match[0].length;
    const windowStart = Math.max(cursor, matchStart - WINDOW_SIZE);
    const window = text.slice(windowStart, matchStart);
    const lawPhrase = findLawPhrase(window);

    // A list-connector-only gap ("제121조, 제133조" / "제171조부터 제179조까지")
    // carries the previously resolved law-name category forward, so a law
    // name that only appears once before a nested-article list still applies
    // to every item in it.
    const gapIsListConnector =
      prevMatchEnd !== null && LIST_CONNECTOR_RE.test(text.slice(prevMatchEnd, matchStart));
    const propagatedCategory = gapIsListConnector ? activeCategory : null;
    const category = lawPhrase?.category ?? propagatedCategory;

    if (lawPhrase) {
      activeCategory = lawPhrase.category;
    } else if (!gapIsListConnector) {
      activeCategory = null;
    }
    prevMatchEnd = matchEnd;

    if (!category) {
      // Law name undetermined in the 40-char lookback (and no list context to
      // inherit one from) — preserve as-is.
      result += text.slice(cursor, matchEnd);
      cursor = matchEnd;
      continue;
    }

    const jo = match[1];
    const ui = match[2];
    const articleKey = ui ? `${jo}의${ui}` : jo;

    if (VERIFIED_ARTICLES[category].has(articleKey)) {
      result += text.slice(cursor, matchEnd);
      cursor = matchEnd;
      continue;
    }

    if (lawPhrase) {
      const phraseAbsoluteStart = windowStart + lawPhrase.phraseStart;
      result += text.slice(cursor, phraseAbsoluteStart);
      result += GENERIC_LAW_TERM;
      cursor = matchEnd;
      continue;
    }

    // Unverified via a propagated (list-inherited) category: there is no
    // local law-name text to collapse, so only the article citation itself
    // is replaced.
    result += text.slice(cursor, matchStart);
    result += GENERIC_LAW_TERM;
    cursor = matchEnd;
  }
  result += text.slice(cursor);
  return result;
}

/**
 * Removes law-article citations whose (법령 카테고리, 조번호) combination is not on
 * the verified whitelist, collapsing them to the generic "산업안전보건법령" term.
 * Verified combinations and citations whose law name can't be determined within the
 * preceding 40 characters are left untouched.
 */
export function gateCitations(text: string): string {
  return sanitizeArticleReferences(sanitizeAnnexReferences(text));
}
