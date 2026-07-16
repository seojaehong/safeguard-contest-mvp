function normalizedTokens(query: string): readonly string[] {
  return query
    .normalize("NFKC")
    .toLocaleLowerCase("ko-KR")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .split(/\s+/u)
    .filter(Boolean);
}

function hasExactOrCompoundTerm(tokens: readonly string[], term: string): boolean {
  const particlePattern = /^(?:은|는|이|가|을|를|의|에|에서|과|와|로|으로)$/u;
  return tokens.some((token) => {
    if (token === term) return true;
    return token.startsWith(term) && particlePattern.test(token.slice(term.length));
  });
}

function hasAny(tokens: readonly string[], terms: readonly string[]): boolean {
  return terms.some((term) => hasExactOrCompoundTerm(tokens, term));
}

function hasScaffoldTerm(tokens: readonly string[]): boolean {
  return tokens.some((token) => /^(?:(?:이동식|강관|시스템|달)?비계(?:조립|해체|설치|작업|점검)?|작업발판|아웃트리거|벽이음)(?:은|는|이|가|을|를|의|에|에서|과|와|로|으로)?$/u.test(token));
}

function hasExteriorWallTerm(tokens: readonly string[]): boolean {
  return tokens.some((token) => /^외벽(?:도장|보수|청소|작업)?(?:은|는|이|가|을|를|의|에|에서|과|와|로|으로)?$/u.test(token));
}

function hasOperationalTerm(tokens: readonly string[]): boolean {
  return tokens.some((token) => /^(?:작업|공사|조립|해체|설치|사용|점검|안전점검|안전기준|도장|보수|청소|안전|기준|붕괴|예방|조립작업|해체작업|설치작업|도장작업|보수작업)(?:은|는|이|가|을|를|의|에|에서|과|와|로|으로)?$/u.test(token));
}

export function exactKoshaReferenceAppliesToQuery(stableDocumentKey: string, query: string): boolean {
  const tokens = normalizedTokens(query);
  if (stableDocumentKey === "D-C-7") {
    const scaffold = hasScaffoldTerm(tokens);
    const operational = hasOperationalTerm(tokens);
    const commercial = hasAny(tokens, ["구매", "견적", "납품", "판매", "가격"]);
    return scaffold && operational && (!commercial || hasAny(tokens, ["작업", "조립", "해체", "설치", "사용", "점검", "안전점검", "안전"])
      || tokens.some((token) => /^(?:조립|해체|설치)작업$/u.test(token)));
  }
  if (stableDocumentKey !== "D-C-13") return false;

  const exteriorWall = hasExteriorWallTerm(tokens);
  const exteriorWork = hasAny(tokens, ["도장", "페인트", "보수", "비계", "작업발판", "곤돌라"])
    || tokens.some((token) => /^외벽(?:도장|보수|청소|작업)$/u.test(token));
  const commercial = hasAny(tokens, ["구매", "견적", "납품", "판매", "가격"]);
  const explicitOperation = hasOperationalTerm(tokens);
  const operational = explicitOperation || (!commercial && exteriorWork);
  if (exteriorWall && exteriorWork && operational) return true;

  const building = hasAny(tokens, ["아파트", "공동주택", "건물", "건축물"]);
  const suspendedScaffold = hasExactOrCompoundTerm(tokens, "달비계");
  const ropeWork = hasExactOrCompoundTerm(tokens, "로프")
    && hasAny(tokens, ["작업", "도장", "페인트", "보수", "청소", "안전", "점검", "안전점검"]);
  return building && (suspendedScaffold || ropeWork) && operational;
}
