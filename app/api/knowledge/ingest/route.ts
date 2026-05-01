import { NextRequest, NextResponse } from "next/server";
import {
  buildKnowledgeRegenerationBundle,
  normalizeKnowledgeRawEvent
} from "@/lib/safety-knowledge";
import {
  createSupabaseAdminClient,
  ensureWorkspaceContext,
  getWorkspaceUser,
  toJson
} from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null) as unknown;
  const normalized = normalizeKnowledgeRawEvent(body);

  if (!normalized.ok) {
    return NextResponse.json(
      {
        ok: false,
        configured: false,
        storageMode: "stateless",
        errors: normalized.errors,
        message: "원본 이벤트 스키마를 확인해야 합니다."
      },
      { status: 400 }
    );
  }

  const title = normalized.event.title;
  const question = `${title} ${normalized.event.reflectedDocuments.join(" ")}`;
  const regenerationBundle = buildKnowledgeRegenerationBundle(question, [normalized.event]);
  const client = createSupabaseAdminClient();
  const user = client ? await getWorkspaceUser(client, request.headers) : null;
  let savedEventId: string | null = null;
  let savedRunId: string | null = null;

  try {
    if (client && user) {
      const context = await ensureWorkspaceContext(client, user, {
        companyName: "SafeClaw Knowledge",
        siteName: "기초 지식 DB",
        companyType: "산업안전",
        region: "전국"
      });
      const proposedWikiUpdate = {
        hazardIds: regenerationBundle.matchedHazards.map((hazard) => hazard.id),
        documentNames: normalized.event.reflectedDocuments,
        sourceTitle: normalized.event.title,
        reviewRequired: true
      };

      const { data: eventData, error: eventError } = await client
        .from("knowledge_events")
        .upsert({
          organization_id: context.organizationId,
          site_id: context.siteId,
          source: normalized.event.source,
          source_id: normalized.event.sourceId,
          captured_at: normalized.event.capturedAt,
          title: normalized.event.title,
          url: normalized.event.url || null,
          payload: toJson(normalized.event.payload),
          related_hazard_ids: normalized.event.relatedHazardIds,
          reflected_documents: normalized.event.reflectedDocuments,
          proposed_wiki_update: toJson(proposedWikiUpdate),
          created_by: user.id
        }, { onConflict: "organization_id,source,source_id" })
        .select("id")
        .single();

      if (eventError) throw eventError;
      savedEventId = eventData.id;

      const { data: runData, error: runError } = await client
        .from("knowledge_regeneration_runs")
        .insert({
          organization_id: context.organizationId,
          site_id: context.siteId,
          question,
          raw_event_ids: [savedEventId],
          matched_hazards: toJson(regenerationBundle.matchedHazards),
          templates: toJson(regenerationBundle.templates),
          ai_instruction: regenerationBundle.aiInstruction,
          generated_output: toJson({}),
          provider: null,
          status: "draft",
          created_by: user.id
        })
        .select("id")
        .single();

      if (runError) throw runError;
      savedRunId = runData.id;
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("knowledge ingest persistence failed", error);
    return NextResponse.json(
      {
        ok: false,
        configured: Boolean(client),
        storageMode: "persistent-error",
        event: normalized.event,
        message: `원본 이벤트 검증은 성공했지만 저장에 실패했습니다. 사유: ${message}`
      },
      { status: 500 }
    );
  }

  return NextResponse.json({
    ok: true,
    configured: Boolean(client),
    storageMode: savedEventId ? "persistent" : "stateless",
    savedEventId,
    savedRunId,
    event: normalized.event,
    proposedWikiUpdate: {
      hazardIds: regenerationBundle.matchedHazards.map((hazard) => hazard.id),
      documentNames: normalized.event.reflectedDocuments,
      sourceTitle: normalized.event.title,
      reviewRequired: true
    },
    regenerationBundle,
    message: savedEventId
      ? "원본 이벤트를 knowledge_events에 누적하고 AI 재생성 run 초안을 저장했습니다."
      : "원본 이벤트를 검증했습니다. 저장하려면 관리자 로그인과 Supabase 설정이 필요합니다."
  });
}
