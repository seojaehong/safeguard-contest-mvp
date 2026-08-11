import { NextRequest, NextResponse } from "next/server";
import {
  getSafetyKnowledgeLegalMap,
  getSafetyKnowledgeSources,
  getSafetyKnowledgeTemplates,
  matchSafetyKnowledge
} from "@/lib/safety-knowledge";
import {
  enforcePublicJsonRequestBodyBudget,
  isOverCharBudget,
  publicWorkBudgetExceeded,
  PUBLIC_KNOWLEDGE_MATCH_REQUEST_MAX_BYTES,
  PUBLIC_KNOWLEDGE_QUESTION_MAX_CHARS,
} from "@/lib/public-work-budget";
import { createRateLimiter } from "@/lib/rate-limit";
import {
  applyPublicRateLimitHeader,
  checkPublicRateLimit,
  publicRateLimitResponse,
  type PublicRateLimitDecision,
} from "@/lib/public-distributed-rate-limit";

export const dynamic = "force-dynamic";
const limiter = createRateLimiter({ limit: 60, windowMs: 60_000 });

async function checkAdmission(request: NextRequest): Promise<PublicRateLimitDecision> {
  return checkPublicRateLimit({
    request,
    namespace: "public-knowledge-match",
    limit: 60,
    windowMs: 60_000,
    instanceLimiter: limiter,
  });
}

function readLimit(value: string | null) {
  if (!value) return 4;
  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed)) return 4;
  return Math.min(Math.max(parsed, 1), 10);
}

export async function GET(request: NextRequest) {
  const rateLimit = await checkAdmission(request);
  const limited = publicRateLimitResponse(rateLimit);
  if (limited) return limited;
  const question = request.nextUrl.searchParams.get("question")?.trim() || "";
  const limit = readLimit(request.nextUrl.searchParams.get("limit"));
  if (!question) {
    return NextResponse.json(
      { ok: false, message: "question query is required" },
      { status: 400 }
    );
  }
  if (isOverCharBudget(question, PUBLIC_KNOWLEDGE_QUESTION_MAX_CHARS)) {
    return applyPublicRateLimitHeader(
      publicWorkBudgetExceeded("question exceeds the public knowledge work budget", PUBLIC_KNOWLEDGE_QUESTION_MAX_CHARS),
      rateLimit,
    );
  }

  try {
    const matches = matchSafetyKnowledge(question, limit);
    return applyPublicRateLimitHeader(NextResponse.json({
      ok: true,
      source: "safety-knowledge-seed",
      storageMode: "seed",
      question,
      matches,
      sourceCount: getSafetyKnowledgeSources().length,
      legalMapCount: getSafetyKnowledgeLegalMap().length,
      templateCount: getSafetyKnowledgeTemplates().length
    }), rateLimit);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("knowledge match route failed", error);
    return NextResponse.json(
      { ok: false, message },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const rateLimit = await checkAdmission(request);
  const limited = publicRateLimitResponse(rateLimit);
  if (limited) return limited;
  const bodyBudget = await enforcePublicJsonRequestBodyBudget(
    request,
    PUBLIC_KNOWLEDGE_MATCH_REQUEST_MAX_BYTES,
    "request body exceeds the public knowledge byte budget",
  );
  if (!bodyBudget.ok) return applyPublicRateLimitHeader(bodyBudget.response, rateLimit);
  const body = await bodyBudget.request.json().catch(() => null) as unknown;
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return NextResponse.json(
      { ok: false, message: "JSON object body is required" },
      { status: 400 }
    );
  }

  const record = body as Record<string, unknown>;
  const question = typeof record.question === "string" ? record.question.trim() : "";
  const limit = typeof record.limit === "number" ? Math.min(Math.max(Math.trunc(record.limit), 1), 10) : 4;

  if (!question) {
    return NextResponse.json(
      { ok: false, message: "question is required" },
      { status: 400 }
    );
  }
  if (isOverCharBudget(question, PUBLIC_KNOWLEDGE_QUESTION_MAX_CHARS)) {
    return applyPublicRateLimitHeader(
      publicWorkBudgetExceeded("question exceeds the public knowledge work budget", PUBLIC_KNOWLEDGE_QUESTION_MAX_CHARS),
      rateLimit,
    );
  }

  const matches = matchSafetyKnowledge(question, limit);
  return applyPublicRateLimitHeader(NextResponse.json({
    ok: true,
    source: "safety-knowledge-seed",
    storageMode: "seed",
    question,
    matches
  }), rateLimit);
}
