import { NextRequest, NextResponse } from "next/server";
import {
  KnowledgeRawEvent,
  buildKnowledgeRegenerationBundle,
  normalizeKnowledgeRawEvent
} from "@/lib/safety-knowledge";

export const dynamic = "force-dynamic";

function readRawEvents(value: unknown) {
  if (!Array.isArray(value)) {
    return { events: [] as KnowledgeRawEvent[], errors: [] as string[] };
  }

  const events: KnowledgeRawEvent[] = [];
  const errors: string[] = [];

  value.forEach((item, index) => {
    const normalized = normalizeKnowledgeRawEvent(item);
    if (normalized.ok) {
      events.push(normalized.event);
    } else {
      errors.push(`rawEvents[${index}]: ${normalized.errors.join(", ")}`);
    }
  });

  return { events, errors };
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

  const { events, errors } = readRawEvents(record.rawEvents);
  if (errors.length) {
    return NextResponse.json(
      { ok: false, message: "rawEvents validation failed", errors },
      { status: 400 }
    );
  }

  const bundle = buildKnowledgeRegenerationBundle(question, events, limit);

  return NextResponse.json({
    ok: true,
    configured: false,
    storageMode: "stateless",
    bundle,
    aiReady: true,
    message: "AI 재생성에 바로 투입할 수 있는 보수적 지식 번들을 생성했습니다. 실제 LLM 호출은 제품 생성 경로에서 별도로 수행합니다."
  });
}
