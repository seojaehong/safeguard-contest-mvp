import { NextResponse } from "next/server";
import { enforceRequestBodyBudget } from "@/lib/mcp-work-budget";

export const PUBLIC_ASK_QUESTION_MAX_CHARS = 1_200;
export const PUBLIC_ASK_HARNESS_MEMORY_MAX_CHARS = 32_000;
export const PUBLIC_ASK_REQUEST_MAX_BYTES = 128 * 1_024;
export const PUBLIC_KNOWLEDGE_QUESTION_MAX_CHARS = 900;
export const PUBLIC_KNOWLEDGE_MATCH_REQUEST_MAX_BYTES = 16 * 1_024;
export const PUBLIC_KNOWLEDGE_REGENERATION_REQUEST_MAX_BYTES = 128 * 1_024;
export const KNOWLEDGE_WRITE_REQUEST_MAX_BYTES = 64 * 1_024;
export const PUBLIC_KNOWLEDGE_RAW_EVENTS_MAX_COUNT = 12;
export const PUBLIC_KNOWLEDGE_RAW_EVENT_MAX_CHARS = 8_000;
export const PUBLIC_REMEDIATION_QUESTION_MAX_CHARS = 900;
export const PUBLIC_REMEDIATION_DOCUMENT_MAX_CHARS = 4_000;
export const PUBLIC_REMEDIATION_REQUEST_MAX_BYTES = 16 * 1_024;
export const PUBLIC_SHARE_ACK_REQUEST_MAX_BYTES = 16 * 1_024;
export const WORKPACK_IMPROVEMENT_JSON_REQUEST_MAX_BYTES = 16 * 1_024;
export const WORKPACK_IMPROVEMENT_LABEL_MAX_CHARS = 500;
export const WORKPACK_IMPROVEMENT_TEXT_MAX_CHARS = 8_000;
export const WORKPACK_IMPROVEMENT_REFLECTED_DOCUMENTS_MAX_COUNT = 12;
export const WORKPACK_IMPROVEMENT_REFLECTED_DOCUMENT_MAX_CHARS = 120;
export const WORKFLOW_DISPATCH_REQUEST_MAX_BYTES = 64 * 1_024;
export const AUTHENTICATED_BRIEFING_REQUEST_MAX_BYTES = 64 * 1_024;
export const AUTHENTICATED_WORKER_REQUEST_MAX_BYTES = 512 * 1_024;
export const AUTHENTICATED_EDUCATION_REQUEST_MAX_BYTES = 2 * 1_024 * 1_024;
export const AUTHENTICATED_WORKPACK_REQUEST_MAX_BYTES = 4 * 1_024 * 1_024;
export const AUTHENTICATED_COMMERCIAL_REQUEST_MAX_BYTES = 256 * 1_024;
export const PUBLIC_WEATHER_QUESTION_MAX_CHARS = 240;
export const PUBLIC_LEGAL_SEARCH_QUERY_MAX_CHARS = 240;
export const PUBLIC_SAFETY_REFERENCE_QUERY_MAX_CHARS = 500;
export const PUBLIC_SAFETY_REFERENCE_FILTER_MAX_CHARS = 128;
export const PUBLIC_JSON_BODY_READ_TIMEOUT_MS = 10_000;
export const AUTHENTICATED_JSON_BODY_READ_TIMEOUT_MS = 10_000;
export const PUBLIC_MULTIPART_BODY_READ_TIMEOUT_MS = 10_000;

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
  }, {
    timeoutMs: PUBLIC_JSON_BODY_READ_TIMEOUT_MS,
    timeoutError: {
      code: "PUBLIC_JSON_BODY_READ_TIMEOUT",
      error: `Public JSON request body was not received within ${PUBLIC_JSON_BODY_READ_TIMEOUT_MS}ms.`,
    },
  });
}

export async function enforceAuthenticatedJsonRequestBodyBudget(
  request: Request,
  maxBytes: number,
) {
  return enforceRequestBodyBudget(request, maxBytes, {
    code: "AUTHENTICATED_JSON_BODY_TOO_LARGE",
    error: `Authenticated JSON request body exceeds the ${maxBytes}-byte limit.`,
  }, {
    timeoutMs: AUTHENTICATED_JSON_BODY_READ_TIMEOUT_MS,
    timeoutError: {
      code: "AUTHENTICATED_JSON_BODY_READ_TIMEOUT",
      error: `Authenticated JSON request body was not received within ${AUTHENTICATED_JSON_BODY_READ_TIMEOUT_MS}ms.`,
    },
  });
}

export async function enforcePublicMultipartRequestBodyBudget(
  request: Request,
  maxBytes: number,
  message: string,
) {
  return enforceRequestBodyBudget(request, maxBytes, {
    code: "PUBLIC_MULTIPART_BODY_TOO_LARGE",
    error: message,
  }, {
    timeoutMs: PUBLIC_MULTIPART_BODY_READ_TIMEOUT_MS,
    timeoutError: {
      code: "PUBLIC_MULTIPART_BODY_READ_TIMEOUT",
      error: `Multipart request body was not received within ${PUBLIC_MULTIPART_BODY_READ_TIMEOUT_MS}ms.`,
    },
  });
}
