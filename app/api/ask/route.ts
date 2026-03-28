import { NextRequest, NextResponse } from "next/server";
import { runAsk } from "@/lib/search";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const question = typeof body.question === "string" ? body.question : "산업안전 실무 질문";
  const result = await runAsk(question);
  return NextResponse.json(result);
}
