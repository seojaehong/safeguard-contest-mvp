import { getDetail as getLawGoDetail, searchAll as searchLawGo } from "./lawgo";
import { getKoreanLawMcpDetail, getKoreanLawMcpStatus, isKoreanLawMcpId, searchKoreanLawMcp } from "./korean-law-mcp";
import { mockSearchResults } from "./mock-data";
import { DetailRecord, SearchResult } from "./types";

function filterMockResults(query: string) {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) return mockSearchResults;

  return mockSearchResults.filter((item) => {
    const haystack = [item.title, item.summary, item.citation || "", ...(item.tags || [])].join(" ").toLowerCase();
    return haystack.includes(normalizedQuery);
  });
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
  const primary = await searchLawGo(query).catch(() => filterMockResults(query));
  const secondary = await searchKoreanLawMcp(query).catch(() => []);

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
