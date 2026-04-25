import { mockDetails, mockSearchResults } from "./mock-data";
import { DetailRecord, SearchResult } from "./types";

const mockMode = process.env.LAWGO_MOCK_MODE !== "false";
const oc = process.env.LAWGO_OC;

function tokenizeQuery(query: string) {
  return query
    .toLowerCase()
    .split(/[\s,./()\-]+/)
    .map((token) => token.trim())
    .filter((token) => token.length >= 2);
}

function scoreMockResult(item: SearchResult, query: string) {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) return 1;

  const haystack = [item.title, item.summary, item.citation || "", ...(item.tags || [])].join(" ").toLowerCase();
  const tokens = tokenizeQuery(normalizedQuery);

  if (haystack.includes(normalizedQuery)) {
    return 100;
  }

  let score = 0;
  for (const token of tokens) {
    if (haystack.includes(token)) {
      score += item.title.toLowerCase().includes(token) ? 3 : 1;
    }
  }

  return score;
}

function ensureConfigured() {
  if (!oc) {
    throw new Error("LAWGO_OC is not set. For now use LAWGO_MOCK_MODE=true.");
  }
}

export async function searchAll(query: string): Promise<SearchResult[]> {
  if (mockMode) {
    const q = query.trim();
    if (!q) return mockSearchResults;

    return mockSearchResults
      .map((item) => ({ item, score: scoreMockResult(item, q) }))
      .filter((entry) => entry.score > 0)
      .sort((a, b) => b.score - a.score)
      .map((entry) => entry.item);
  }

  ensureConfigured();
  throw new Error("Live Law.go integration adapter will be connected when key/IP registration is finalized tomorrow.");
}

export async function getDetail(id: string): Promise<DetailRecord | null> {
  if (mockMode) return mockDetails.find((item) => item.id === id) || null;
  ensureConfigured();
  throw new Error("Live Law.go detail adapter pending final key/IP registration.");
}
