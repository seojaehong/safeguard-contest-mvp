import type { AskResponse } from "@/lib/types";

const INTERNAL_TOP_LEVEL_KEYS = new Set([
  "dbHarness",
  "generationEvidence",
  "generationTrace"
]);

const PUBLIC_TEXT_KEYS = new Set([
  "detail",
  "policyNote",
  "summary",
  "label",
  "materials",
  "verification",
  "evidenceRef",
  "evidenceRefs",
  "failureReason"
]);

function sanitizePublicText(value: string): string {
  return value
    .replace(/AI_MODE=enhanced/gi, "생성 모드: 강화")
    .replace(/AI_MODE=template/gi, "생성 모드: 템플릿")
    .replace(/AI_MODE=full_ai/gi, "생성 모드: 전체 보강")
    .replace(/DB\s*하네스/g, "고정 근거")
    .replace(/DB harness deterministic/gi, "고정 근거 기반")
    .replace(/\brow-first\b/gi, "위험요인 표 우선")
    .replace(/\bdeterministic\b/gi, "규칙 기반")
    .replace(/graceful fallback 정책/gi, "보조 응답 정책")
    .replace(/\bfallback path\b/gi, "보조 응답 경로")
    .replace(/\bfallback\b/gi, "보조 응답");
}

function cloneAndSanitize(value: unknown, path: readonly string[] = []): unknown {
  if (path.length === 1 && INTERNAL_TOP_LEVEL_KEYS.has(path[0])) return value;

  if (typeof value === "string") {
    const key = path[path.length - 1] || "";
    const parentKey = path[path.length - 2] || "";
    const shouldSanitize = PUBLIC_TEXT_KEYS.has(key) || PUBLIC_TEXT_KEYS.has(parentKey);
    return shouldSanitize ? sanitizePublicText(value) : value;
  }

  if (Array.isArray(value)) {
    return value.map((item, index) => cloneAndSanitize(item, [...path, String(index)]));
  }

  if (typeof value === "object" && value !== null) {
    return Object.fromEntries(Object.entries(value).map(([key, child]) => [
      key,
      cloneAndSanitize(child, [...path, key])
    ]));
  }

  return value;
}

export function sanitizeAskResponsePublicSurface<T extends AskResponse>(response: T): T {
  return cloneAndSanitize(response) as T;
}
