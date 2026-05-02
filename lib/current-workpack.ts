import type { AskResponse } from "@/lib/types";

export const CURRENT_WORKPACK_STORAGE_KEY = "safeclaw.currentWorkpack.v1";

export type StoredCurrentWorkpack = {
  savedAt: string;
  source: "workspace";
  data: AskResponse;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function parseStoredCurrentWorkpack(raw: string | null): StoredCurrentWorkpack | null {
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed) || typeof parsed.savedAt !== "string" || !isRecord(parsed.data)) {
      return null;
    }
    const data = parsed.data;
    if (
      typeof data.question !== "string" ||
      !isRecord(data.scenario) ||
      !isRecord(data.deliverables) ||
      !isRecord(data.externalData) ||
      !isRecord(data.riskSummary)
    ) {
      return null;
    }

    return {
      savedAt: parsed.savedAt,
      source: "workspace",
      data: data as AskResponse
    };
  } catch (error) {
    console.warn("safeclaw current workpack parse failed", error);
    return null;
  }
}

export function buildStoredCurrentWorkpack(data: AskResponse): StoredCurrentWorkpack {
  return {
    savedAt: new Date().toISOString(),
    source: "workspace",
    data
  };
}
