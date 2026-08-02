import { NextRequest, NextResponse } from "next/server";
import { readSafetyReferenceLimit } from "@/lib/safety-reference-catalog";
import { searchSafetyReferences } from "@/lib/safety-reference-catalog-server";
import { createRateLimiter } from "@/lib/rate-limit";
import { enforceRateLimit } from "@/lib/api-guard";
import {
  isOverCharBudget,
  publicWorkBudgetExceeded,
  PUBLIC_SAFETY_REFERENCE_FILTER_MAX_CHARS,
  PUBLIC_SAFETY_REFERENCE_QUERY_MAX_CHARS,
} from "@/lib/public-work-budget";

export const dynamic = "force-dynamic";

const limiter = createRateLimiter({ limit: 30, windowMs: 60_000 });
const inFlightSearches = new Map<string, ReturnType<typeof searchSafetyReferences>>();

function normalizeSearchValue(value: string): string {
  return value.replace(/\s+/gu, " ").trim();
}

function isOversizedFilter(value: string | undefined): boolean {
  return value !== undefined
    && isOverCharBudget(value, PUBLIC_SAFETY_REFERENCE_FILTER_MAX_CHARS);
}

function searchCoalesced(
  input: Parameters<typeof searchSafetyReferences>[0],
): ReturnType<typeof searchSafetyReferences> {
  const key = JSON.stringify(input);
  const existing = inFlightSearches.get(key);
  if (existing) return existing;
  const pending = searchSafetyReferences(input).finally(() => {
    inFlightSearches.delete(key);
  });
  inFlightSearches.set(key, pending);
  return pending;
}

export async function GET(request: NextRequest) {
  const limited = enforceRateLimit(request, limiter);
  if (limited) return limited;

  const query = normalizeSearchValue(request.nextUrl.searchParams.get("q") || "");
  const limit = readSafetyReferenceLimit(request.nextUrl.searchParams.get("limit"));
  const itemType = normalizeSearchValue(request.nextUrl.searchParams.get("itemType") || "") || undefined;
  const sourceId = normalizeSearchValue(request.nextUrl.searchParams.get("sourceId") || "") || undefined;
  const riskTag = normalizeSearchValue(request.nextUrl.searchParams.get("riskTag") || "") || undefined;
  const evidenceRoleParam = request.nextUrl.searchParams.get("evidenceRole");
  const evidenceRole = evidenceRoleParam === "direct" || evidenceRoleParam === "supporting"
    ? evidenceRoleParam
    : undefined;

  if (isOverCharBudget(query, PUBLIC_SAFETY_REFERENCE_QUERY_MAX_CHARS)) {
    return publicWorkBudgetExceeded(
      "q exceeds the public safety-reference work budget",
      PUBLIC_SAFETY_REFERENCE_QUERY_MAX_CHARS,
    );
  }
  if ([itemType, sourceId, riskTag].some(isOversizedFilter)) {
    return publicWorkBudgetExceeded(
      "filter exceeds the public safety-reference work budget",
      PUBLIC_SAFETY_REFERENCE_FILTER_MAX_CHARS,
    );
  }

  const result = await searchCoalesced({
    query,
    limit,
    itemType,
    sourceId,
    riskTag,
    evidenceRole
  });

  return NextResponse.json(result, { status: result.ok ? 200 : 503 });
}
