import { NextResponse } from "next/server";
import { enforceRequestBodyBudget } from "@/lib/mcp-work-budget";

export const PUBLIC_ASK_QUESTION_MAX_CHARS = 1_200;
export const PUBLIC_ASK_HARNESS_MEMORY_MAX_CHARS = 32_000;
export const PUBLIC_ASK_REQUEST_MAX_BYTES = 128 * 1_024;
export const PUBLIC_KNOWLEDGE_QUESTION_MAX_CHARS = 900;
export const PUBLIC_KNOWLEDGE_MATCH_REQUEST_MAX_BYTES = 16 * 1_024;
export const PUBLIC_KNOWLEDGE_RAW_EVENTS_MAX_COUNT = 12;
export const PUBLIC_KNOWLEDGE_RAW_EVENT_MAX_CHARS = 8_000;
export const PUBLIC_REMEDIATION_QUESTION_MAX_CHARS = 900;
export const PUBLIC_REMEDIATION_DOCUMENT_MAX_CHARS = 4_000;
export const PUBLIC_WEATHER_QUESTION_MAX_CHARS = 240;
export const PUBLIC_LEGAL_SEARCH_QUERY_MAX_CHARS = 240;
export const PUBLIC_SAFETY_REFERENCE_QUERY_MAX_CHARS = 500;
export const PUBLIC_SAFETY_REFERENCE_FILTER_MAX_CHARS = 128;

export type PublicWorkBudgetError = {
  ok: false;
  message: string;
  code: "PUBLIC_WORK_BUDGET_EXCEEDED";
  limit: number;
};

export function publicWorkBudgetExceeded(message: string, limit: number) {
  return NextResponse.json(
    {
      ok: false,
      code: "PUBLIC_WORK_BUDGET_EXCEEDED",
      message,
      limit
    } satisfies PublicWorkBudgetError,
    { status: 413 }
  );
}

export function serializedCharLength(value: unknown): number {
  try {
    return JSON.stringify(value).length;
  } catch {
    return Number.POSITIVE_INFINITY;
  }
}

export function isOverCharBudget(value: string, maxChars: number): boolean {
  return Array.from(value).length > maxChars;
}

export async function enforcePublicJsonRequestBodyBudget(
  request: Request,
  maxBytes: number,
  message: string,
) {
  return enforceRequestBodyBudget(request, maxBytes, {
    code: "PUBLIC_WORK_BUDGET_EXCEEDED",
    error: message,
  });
}
