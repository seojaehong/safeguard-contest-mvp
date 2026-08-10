import { getDetail as getLawGoDetail, searchAll as searchLawGo, searchLawGoPrecedents } from "./lawgo";
import { getKoreanLawMcpDetail, getKoreanLawMcpStatus, isKoreanLawMcpId, searchKoreanLawMcp } from "./korean-law-mcp";
import { mockSearchResults } from "./mock-data";
import { DetailRecord, SearchResult } from "./types";

const SEARCH_TIMEOUT_MS = 5_000;
const RETRY_DELAY_MS = 400;

async function wait(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function withTimeout<T>(
  runner: (signal: AbortSignal) => Promise<T>,
  timeoutMs: number,
  label: string,
  callerSignal?: AbortSignal
): Promise<T> {
  const controller = new AbortController();
  const abortFromCaller = () => controller.abort(callerSignal?.reason);
  if (callerSignal?.aborted) abortFromCaller();
  else callerSignal?.addEventListener("abort", abortFromCaller, { once: true });
  let timeoutHandle: NodeJS.Timeout | undefined;

  const timeoutPromise = new Promise<T>((_, reject) => {
    timeoutHandle = setTimeout(() => {
      const error = new Error(`${label} timeout after ${timeoutMs}ms`);
      controller.abort(error);
      reject(error);
    }, timeoutMs);
  });

  try {
    return await Promise.race([runner(controller.signal), timeoutPromise]);
  } finally {
    if (timeoutHandle) clearTimeout(timeoutHandle);
    callerSignal?.removeEventListener("abort", abortFromCaller);
  }
}

async function withRetry<T>(
  runner: () => Promise<T>,
  attempts: number,
  label: string,
  signal?: AbortSignal
): Promise<T> {
  let lastError: unknown;

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    signal?.throwIfAborted();
    try {
      return await runner();
    } catch (error) {
      lastError = error;
      signal?.throwIfAborted();
      if (attempt < attempts - 1) {
        await wait(RETRY_DELAY_MS);
      }
    }
  }

  throw lastError instanceof Error ? lastError : new Error(`${label} failed`);
}

function filterMockResults(query: string) {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) return mockSearchResults;

  const tokens = normalizedQuery
    .split(/[\s,./()\-]+/)
    .map((token) => token.trim())
    .filter((token) => token.length >= 2);

  return mockSearchResults
    .map((item) => {
      const haystack = [item.title, item.summary, item.citation || "", ...(item.tags || [])].join(" ").toLowerCase();
      if (haystack.includes(normalizedQuery)) {
        return { item, score: 100 };
      }

      let score = 0;
      for (const token of tokens) {
        if (haystack.includes(token)) {
          score += item.title.toLowerCase().includes(token) ? 3 : 1;
        }
      }

      return { item, score };
    })
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((entry) => entry.item);
}

function mergeResults(primary: SearchResult[], secondary: SearchResult[]) {
  const seen = new Set<string>();
  const merged: SearchResult[] = [];

  for (const item of [...primary, ...secondary]) {
    const key = `${item.type}:${item.title}`.trim().toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(item);
  }

  return merged;
}

function buildMappedPrecedents(precedents: SearchResult[]) {
  return precedents.map((item) => ({
    ...item,
    summary: item.summary.includes("오늘 작업")
      ? item.summary
      : `${item.summary} · 오늘 작업의 위험요인과 연결해 관리감독·교육·보호구·작업중지 판단 근거로 검토합니다.`,
    tags: [...(item.tags || []), "작업위험 매핑"]
  }));
}

function rankLegalResults(results: SearchResult[]) {
  const typeWeight: Record<SearchResult["type"], number> = {
    law: 0,
    interpretation: 1,
    precedent: 2
  };
  const systemWeight: Record<string, number> = {
    lawgo: 0,
    "korean-law-mcp": 1,
    mock: 2
  };

  return [...results].sort((a, b) => {
    const typeDiff = typeWeight[a.type] - typeWeight[b.type];
    if (typeDiff !== 0) return typeDiff;

    const systemDiff = (systemWeight[a.sourceSystem || "mock"] ?? 3) - (systemWeight[b.sourceSystem || "mock"] ?? 3);
    if (systemDiff !== 0) return systemDiff;

    return a.title.localeCompare(b.title, "ko");
  });
}

export async function searchLegalSources(query: string, signal?: AbortSignal): Promise<SearchResult[]> {
  const primary = await withRetry(
    () => withTimeout((requestSignal) => searchLawGo(query, requestSignal), SEARCH_TIMEOUT_MS, "Law.go search", signal),
    2,
    "Law.go search",
    signal
  ).catch((error) => {
    signal?.throwIfAborted();
    return filterMockResults(query);
  });
  const fallbackPrimary =
    (primary.some((item) => item.type === "law") && primary.length) || query.trim() === "산업안전보건법"
      ? []
      : await withRetry(
          () => withTimeout(
            (requestSignal) => searchLawGo("산업안전보건법", requestSignal),
            SEARCH_TIMEOUT_MS,
            "Law.go fallback search",
            signal
          ),
          2,
          "Law.go fallback search",
          signal
        ).catch((error) => {
          signal?.throwIfAborted();
          return [];
        });

  const secondary = await withRetry(
    () => withTimeout((requestSignal) => searchKoreanLawMcp(query, 3, requestSignal), SEARCH_TIMEOUT_MS, "korean-law-mcp search", signal),
    2,
    "korean-law-mcp search",
    signal
  ).catch((error) => {
    signal?.throwIfAborted();
    return [];
  });

  const merged = mergeResults(mergeResults(primary, fallbackPrimary), secondary);
  const livePrecedentCount = merged.filter((item) => item.type === "precedent" && item.sourceSystem !== "mock").length;
  const mappedPrecedents = livePrecedentCount
    ? []
    : await withRetry(
        () => withTimeout(
          (requestSignal) => searchLawGoPrecedents(query, 3, requestSignal),
          SEARCH_TIMEOUT_MS,
          "Law.go precedent mapping",
          signal
        ),
        2,
        "Law.go precedent mapping",
        signal
      ).then(buildMappedPrecedents).catch((error) => {
        signal?.throwIfAborted();
        return [];
      });

  return rankLegalResults(mergeResults(merged, mappedPrecedents)).slice(0, 10);
}

export async function loadLegalDetail(id: string): Promise<DetailRecord | null> {
  if (isKoreanLawMcpId(id)) {
    return getKoreanLawMcpDetail(id);
  }

  return getLawGoDetail(id).catch(() => null);
}

export function summarizeLegalSourceMix(results: SearchResult[]) {
  const counts = results.reduce<Record<string, number>>((acc, item) => {
    const key = item.sourceSystem || "unknown";
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});

  return {
    total: results.length,
    counts,
    koreanLawMcp: getKoreanLawMcpStatus()
  };
}
