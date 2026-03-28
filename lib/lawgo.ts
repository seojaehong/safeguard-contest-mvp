import { mockDetails, mockSearchResults } from "./mock-data";
import { DetailRecord, SearchResult } from "./types";

const mockMode = process.env.LAWGO_MOCK_MODE !== "false";
const oc = process.env.LAWGO_OC;

function ensureConfigured() {
  if (!oc) {
    throw new Error("LAWGO_OC is not set. For now use LAWGO_MOCK_MODE=true.");
  }
}

export async function searchAll(query: string): Promise<SearchResult[]> {
  if (mockMode) {
    const q = query.trim().toLowerCase();
    if (!q) return mockSearchResults;
    return mockSearchResults.filter((item) => {
      const hay = [item.title, item.summary, item.citation || "", ...(item.tags || [])].join(" ").toLowerCase();
      return hay.includes(q);
    });
  }

  ensureConfigured();
  throw new Error("Live Law.go integration adapter will be connected when key/IP registration is finalized tomorrow.");
}

export async function getDetail(id: string): Promise<DetailRecord | null> {
  if (mockMode) return mockDetails.find((item) => item.id === id) || null;
  ensureConfigured();
  throw new Error("Live Law.go detail adapter pending final key/IP registration.");
}
