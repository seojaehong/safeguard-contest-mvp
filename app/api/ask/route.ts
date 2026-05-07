import { NextRequest, NextResponse } from "next/server";
import { runAsk } from "@/lib/search";
import type { AiMode } from "@/lib/ai-deliverables";

export const dynamic = "force-dynamic";

const ALLOWED_MODES: AiMode[] = ["template", "enhanced", "full"];

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const question = typeof body.question === "string" ? body.question : "산업안전 실무 질문";
  const requestedMode = typeof body.aiMode === "string" ? (body.aiMode as AiMode) : undefined;
  const aiMode = requestedMode && ALLOWED_MODES.includes(requestedMode) ? requestedMode : undefined;
  const result = await runAsk(question, { aiMode });
  return NextResponse.json(result);
}
