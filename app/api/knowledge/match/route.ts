import { NextRequest, NextResponse } from "next/server";
import {
  getSafetyKnowledgeLegalMap,
  getSafetyKnowledgeSources,
  getSafetyKnowledgeTemplates,
  matchSafetyKnowledge
} from "@/lib/safety-knowledge";

export const dynamic = "force-dynamic";

function readLimit(value: string | null) {
  if (!value) return 4;
  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed)) return 4;
  return Math.min(Math.max(parsed, 1), 10);
}

export async function GET(request: NextRequest) {
  const question = request.nextUrl.searchParams.get("question")?.trim() || "";
  const limit = readLimit(request.nextUrl.searchParams.get("limit"));
  if (!question) {
    return NextResponse.json(
      { ok: false, message: "question query is required" },
      { status: 400 }
    );
  }

  try {
    const matches = matchSafetyKnowledge(question, limit);
    return NextResponse.json({
      ok: true,
      source: "safety-knowledge-seed",
      storageMode: "seed",
      question,
      matches,
      sourceCount: getSafetyKnowledgeSources().length,
      legalMapCount: getSafetyKnowledgeLegalMap().length,
      templateCount: getSafetyKnowledgeTemplates().length
    });
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
  const body = await request.json().catch(() => null) as unknown;
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

  const matches = matchSafetyKnowledge(question, limit);
  return NextResponse.json({
    ok: true,
    source: "safety-knowledge-seed",
    storageMode: "seed",
    question,
    matches
  });
}
