import { getDetail as getLawGoDetail, searchAll as searchLawGo } from "./lawgo";
import { getKoreanLawMcpDetail, getKoreanLawMcpStatus, isKoreanLawMcpId, searchKoreanLawMcp } from "./korean-law-mcp";
import { mockSearchResults } from "./mock-data";
import { DetailRecord, SearchResult } from "./types";

const SEARCH_TIMEOUT_MS = 20_000;
const RETRY_DELAY_MS = 400;

async function wait(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function withTimeout<T>(task: Promise<T>, timeoutMs: number, label: string): Promise<T> {
  let timeoutHandle: NodeJS.Timeout | undefined;

  const timeoutPromise = new Promise<T>((_, reject) => {
    timeoutHandle = setTimeout(() => reject(new Error(`${label} timeout after ${timeoutMs}ms`)), timeoutMs);
  });

  try {
    return await Promise.race([task, timeoutPromise]);
  } finally {
    if (timeoutHandle) clearTimeout(timeoutHandle);
  }
}

async function withRetry<T>(runner: () => Promise<T>, attempts: number, label: string): Promise<T> {
  let lastError: unknown;

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      return await runner();
    } catch (error) {
      lastError = error;
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

export async function searchLegalSources(query: string): Promise<SearchResult[]> {
  const primary = await withRetry(
    () => withTimeout(searchLawGo(query), SEARCH_TIMEOUT_MS, "Law.go search"),
    2,
    "Law.go search"
  ).catch(() => filterMockResults(query));

  const secondary = await withRetry(
    () => withTimeout(searchKoreanLawMcp(query), SEARCH_TIMEOUT_MS, "korean-law-mcp search"),
    2,
    "korean-law-mcp search"
  ).catch(() => []);

  return mergeResults(primary, secondary).slice(0, 10);
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
