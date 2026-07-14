import { NextRequest, NextResponse } from "next/server";
import {
  KnowledgeRawEvent,
  buildKnowledgeRegenerationBundle,
  normalizeKnowledgeRawEvent
} from "@/lib/safety-knowledge";
import { generateKnowledgeText } from "@/lib/ai";
import { buildKnowledgeCandidate } from "@/lib/knowledge-governance";

export const dynamic = "force-dynamic";
export const maxDuration = 120; // 2min — single Vertex call with 1 retry

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

function buildKnowledgePrompt(bundle: ReturnType<typeof buildKnowledgeRegenerationBundle>) {
  const hazards = bundle.matchedHazards.map((hazard, index) => [
    `${index + 1}. ${hazard.title}`,
    `- 문서: ${hazard.primaryDocuments.join(", ")}`,
    `- 통제대책: ${hazard.controls.join(" / ")}`,
    `- 근거: ${hazard.sources.map((source) => source.title).join(" / ") || "기초 지식 DB"}`
  ].join("\n"));

  return [
    "당신은 산업안전 지식 위키 편집자다.",
    "목표는 현장 문서팩 재생성에 쓸 수 있는 보수적인 지식 초안을 만드는 것이다.",
    "이 출력은 사람 검토 전 후보이며 DB 수정, 승인, 게시를 지시하거나 주장하지 않는다.",
    "법적 효력 보장 표현은 쓰지 말고, 공식 근거 기반 보조자료와 현장 확인 필요를 명확히 표시하라.",
    "출력은 1) 위험요인 요약 2) 문서 반영 위치 3) 통제대책 4) 검수 필요 항목 순서로 작성하라.",
    `질문: ${bundle.question}`,
    "매칭 위험요인:",
    ...hazards,
    "원본 이벤트:",
    JSON.stringify(bundle.rawEvents, null, 2)
  ].join("\n");
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
  const shouldGenerate = record.generate === true;

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
  const generated = shouldGenerate
    ? await generateKnowledgeText(buildKnowledgePrompt(bundle))
    : {
        configured: false,
        text: "",
        providerLabel: null,
        policyNote: "generate=true가 아니어서 AI 초안 생성을 건너뛰었습니다."
      };
  const candidate = buildKnowledgeCandidate({
    question,
    rawEvents: bundle.rawEvents,
    matchedHazardIds: bundle.matchedHazards.map((hazard) => hazard.id),
    generatedText: generated.text,
    providerLabel: generated.providerLabel
  });

  return NextResponse.json({
    ok: true,
    configured: generated.configured,
    storageMode: "stateless_candidate",
    savedRunId: null,
    bundle,
    candidate,
    aiReady: true,
    generated,
    message: "검토용 지식 후보를 메모리에서 생성했습니다. DB 저장과 ontology publish는 수행하지 않았습니다."
  });
}
