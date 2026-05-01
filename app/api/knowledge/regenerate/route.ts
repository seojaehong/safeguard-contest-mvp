import { NextRequest, NextResponse } from "next/server";
import {
  KnowledgeRawEvent,
  buildKnowledgeRegenerationBundle,
  normalizeKnowledgeRawEvent
} from "@/lib/safety-knowledge";
import {
  createSupabaseAdminClient,
  ensureWorkspaceContext,
  getWorkspaceUser,
  toJson
} from "@/lib/supabase-admin";
import { generateKnowledgeText } from "@/lib/ai";

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
  const client = createSupabaseAdminClient();
  const user = client ? await getWorkspaceUser(client, request.headers) : null;
  let savedRunId: string | null = null;

  try {
    if (client && user) {
      const context = await ensureWorkspaceContext(client, user, {
        companyName: "SafeGuard Knowledge",
        siteName: "기초 지식 DB",
        companyType: "산업안전",
        region: "전국"
      });
      const { data, error } = await client
        .from("knowledge_regeneration_runs")
        .insert({
          organization_id: context.organizationId,
          site_id: context.siteId,
          question,
          raw_event_ids: [],
          matched_hazards: toJson(bundle.matchedHazards),
          templates: toJson(bundle.templates),
          ai_instruction: bundle.aiInstruction,
          generated_output: toJson({
            text: generated.text,
            policyNote: generated.policyNote
          }),
          provider: generated.providerLabel,
          status: generated.text ? "generated" : "draft",
          created_by: user.id
        })
        .select("id")
        .single();

      if (error) throw error;
      savedRunId = data.id;
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("knowledge regenerate persistence failed", error);
    return NextResponse.json(
      {
        ok: false,
        configured: Boolean(client),
        storageMode: "persistent-error",
        message: `AI 재생성 번들은 생성했지만 저장에 실패했습니다. 사유: ${message}`,
        bundle
      },
      { status: 500 }
    );
  }

  return NextResponse.json({
    ok: true,
    configured: Boolean(client),
    storageMode: savedRunId ? "persistent" : "stateless",
    savedRunId,
    bundle,
    aiReady: true,
    generated,
    message: savedRunId
      ? "AI 재생성에 바로 투입할 수 있는 지식 번들을 만들고 run 초안을 저장했습니다."
      : "AI 재생성에 바로 투입할 수 있는 지식 번들을 생성했습니다. 저장하려면 관리자 로그인과 Supabase 설정이 필요합니다."
  });
}
