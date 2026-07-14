import type { SupportedLanguageCode } from "@/lib/foreign-worker";

const HANGUL_PATTERN = /[\u1100-\u11ff\u3130-\u318f\ua960-\ua97f\uac00-\ud7a3\ud7b0-\ud7ff\uffa0-\uffdc]/;
const SEMANTIC_TEXT_PATTERN = /[\p{L}\p{N}]/u;
const ENGLISH_FALLBACK_MARKERS = new Set([
  "alert",
  "before",
  "check",
  "construction",
  "core",
  "fall",
  "guardrail",
  "hazard",
  "height",
  "inspect",
  "job",
  "location",
  "main",
  "notice",
  "operation",
  "painting",
  "report",
  "risk",
  "safety",
  "site",
  "start",
  "starting",
  "stop",
  "task",
  "work",
  "workplace"
]);

export function hasLocalizedSemanticText(value: string): boolean {
  return SEMANTIC_TEXT_PATTERN.test(value);
}

export function containsHangulResidue(value: string): boolean {
  return HANGUL_PATTERN.test(value);
}

export function isFullEnglishFallback(
  values: string[],
  locale: SupportedLanguageCode
): boolean {
  if (locale === "en" || values.some((value) => !/^[\x00-\x7f]+$/u.test(value))) return false;
  const tokens = new Set(values
    .flatMap((value) => value.toLowerCase().split(/[^a-z]+/u))
    .filter(Boolean));
  let markerCount = 0;
  for (const marker of ENGLISH_FALLBACK_MARKERS) {
    if (tokens.has(marker)) markerCount += 1;
  }
  return markerCount >= 6;
}
