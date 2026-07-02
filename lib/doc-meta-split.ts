// Separates internal pipeline evidence/reference logs ("[반영 근거]", "[문서 반영]",
// "[KOSHA ... 직접 인용]", "[공식 서식 기준 보강]", "[근거 요약]" 등) from the
// field-facing body of a generated document.
//
// Background (2026-07-02 prod evidence): workPlanDraft / tbmBriefing /
// safetyEducationRecordDraft are assembled in lib/search.ts by concatenating a
// template body with a chain of appendix blocks that cite where each control
// statement came from (KOSHA references, law citations, internal knowledge DB
// matches). Those blocks are legitimate for provenance/debugging, but they are
// not meant to ship inside a document a field crew prints and uses on-site —
// in the worst observed cases the meta blocks made up roughly half the
// document. This module is a pure, generic separator: once a known meta
// section header line is found, everything from that line to the end of the
// text is treated as meta and split off — regardless of whether the meta was
// appended by code (the confirmed case for the three fields above) or ever
// produced by a model (kept as a safety net for any future AI-authored text).

export type DocumentMetaSplit = {
  body: string;
  meta: string;
};

// Prefixes are matched against a trimmed, standalone "[...]" line. Kept as
// prefixes (not exact strings) because several appendix builders parameterize
// the header, e.g. "[반영 근거: 작업계획서]", "[근거 요약: 유사 재해사례]".
//
// Note: "[KOSHA" is intentionally NOT a bare prefix here — lib/search.ts also
// builds a substantive, non-meta "[KOSHA 교육포털 연계]" appendix (a
// recommended-course list, not an evidence log), which must NOT be swept
// away. Only the citation-style "...직접 인용" phrasing (e.g.
// "[KOSHA 기술지침/기술지원규정 직접 인용]") marks a block as a meta
// evidence-log; see META_HEADER_SUBSTRINGS below.
const META_HEADER_PREFIXES = [
  "[반영 근거",
  "[문서 반영",
  "[공식 서식 기준 보강",
  "[근거 요약"
] as const;

const META_HEADER_SUBSTRINGS = ["직접 인용"] as const;

function isMetaHeaderLine(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed.startsWith("[") || !trimmed.endsWith("]")) return false;
  if (META_HEADER_PREFIXES.some((prefix) => trimmed.startsWith(prefix))) return true;
  return META_HEADER_SUBSTRINGS.some((substring) => trimmed.includes(substring));
}

/**
 * Splits `text` at the first recognized meta-section header line. Everything
 * before that line is `body`; the header line and everything after it
 * (to the end of the text) is `meta`. If no such header is found, `body` is
 * the entire input unchanged and `meta` is `""`.
 */
export function splitDocumentMeta(text: string): DocumentMetaSplit {
  if (!text) return { body: text ?? "", meta: "" };

  const lines = text.split("\n");
  const metaStartIndex = lines.findIndex((line) => isMetaHeaderLine(line));

  if (metaStartIndex === -1) {
    return { body: text, meta: "" };
  }

  const body = lines.slice(0, metaStartIndex).join("\n").trimEnd();
  const meta = lines.slice(metaStartIndex).join("\n").trim();

  return { body, meta };
}
