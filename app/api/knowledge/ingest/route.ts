import { NextRequest, NextResponse } from "next/server";
import {
  buildKnowledgeRegenerationBundle,
  normalizeKnowledgeRawEvent
} from "@/lib/safety-knowledge";
import {
  createSupabaseAdminClient,
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
        storageMode: "rejected",
        errors: normalized.errors,
        message: "원본 이벤트 스키마를 확인해야 합니다."
      },
      { status: 400 }
    );
  }

  const siteId = typeof body === "object"
    && body !== null
    && !Array.isArray(body)
    && typeof (body as Record<string, unknown>).siteId === "string"
    ? ((body as Record<string, unknown>).siteId as string).trim()
    : "";
  const requestedOrganizationId = typeof body === "object"
    && body !== null
    && !Array.isArray(body)
    && typeof (body as Record<string, unknown>).organizationId === "string"
    ? ((body as Record<string, unknown>).organizationId as string).trim()
    : "";
  if (!siteId) {
    return NextResponse.json({
      ok: false,
      configured: true,
      message: "저장할 siteId가 필요합니다."
    }, { status: 400 });
  }

  const title = normalized.event.title;
  const question = `${title} ${normalized.event.reflectedDocuments.join(" ")}`;
  const regenerationBundle = buildKnowledgeRegenerationBundle(question, [normalized.event]);
  const client = createSupabaseAdminClient();
  if (!client) {
    return NextResponse.json({
      ok: false,
      configured: false,
      message: "지식 이벤트 저장소가 설정되지 않았습니다."
    }, { status: 503 });
  }

  const user = await getWorkspaceUser(client, request.headers);
  if (!user) {
    return NextResponse.json({
      ok: false,
      configured: true,
      message: "로그인이 필요합니다."
    }, { status: 401 });
  }
  let savedEventId: string | null = null;
  let savedRunId: string | null = null;

  try {
    if (client && user) {
      const { data: site, error: siteError } = await client
        .from("sites")
        .select("id,organization_id")
        .eq("id", siteId)
        .maybeSingle();
      if (siteError) throw siteError;
      if (!site) {
        return NextResponse.json({
          ok: false,
          configured: true,
          message: "접근할 수 있는 현장을 찾지 못했습니다."
        }, { status: 404 });
      }
      if (requestedOrganizationId && requestedOrganizationId !== site.organization_id) {
        return NextResponse.json({
          ok: false,
          configured: true,
          message: "접근할 수 있는 현장을 찾지 못했습니다."
        }, { status: 404 });
      }

      const { data: organization, error: organizationError } = await client
        .from("organizations")
        .select("id")
        .eq("id", site.organization_id)
        .eq("owner_id", user.id)
        .maybeSingle();
      if (organizationError) throw organizationError;
      if (!organization) {
        return NextResponse.json({
          ok: false,
          configured: true,
          message: "접근할 수 있는 현장을 찾지 못했습니다."
        }, { status: 404 });
      }

      const context = { organizationId: organization.id, siteId: site.id };
      const proposedWikiUpdate = {
        hazardIds: regenerationBundle.matchedHazards.map((hazard) => hazard.id),
        documentNames: normalized.event.reflectedDocuments,
        sourceTitle: normalized.event.title,
        reviewRequired: true
      };
      const eventMutableValues = {
        captured_at: normalized.event.capturedAt,
        title: normalized.event.title,
        url: normalized.event.url || null,
        payload: toJson(normalized.event.payload),
        related_hazard_ids: normalized.event.relatedHazardIds,
        reflected_documents: normalized.event.reflectedDocuments,
        proposed_wiki_update: toJson(proposedWikiUpdate)
      };
      const updateExistingEvent = async (eventId: string) => {
        const { data, error } = await client
          .from("knowledge_events")
          .update(eventMutableValues)
          .eq("id", eventId)
          .eq("organization_id", context.organizationId)
          .eq("site_id", context.siteId)
          .eq("source", normalized.event.source)
          .eq("source_id", normalized.event.sourceId)
          .select("id")
          .maybeSingle();
        if (error) throw error;
        return data?.id || null;
      };

      const { data: existingEvent, error: existingEventError } = await client
        .from("knowledge_events")
        .select("id,site_id")
        .eq("organization_id", context.organizationId)
        .eq("source", normalized.event.source)
        .eq("source_id", normalized.event.sourceId)
        .maybeSingle();
      if (existingEventError) throw existingEventError;
      if (existingEvent && existingEvent.site_id !== context.siteId) {
        return NextResponse.json({
          ok: false,
          configured: true,
          message: "동일한 원본 이벤트가 다른 현장에 이미 귀속되어 있습니다."
        }, { status: 409 });
      }

      if (existingEvent) {
        savedEventId = await updateExistingEvent(existingEvent.id);
        if (!savedEventId) {
          return NextResponse.json({
            ok: false,
            configured: true,
            message: "원본 이벤트의 현장 귀속이 변경되어 갱신하지 않았습니다."
          }, { status: 409 });
        }
      } else {
        const { data: eventData, error: eventError } = await client
          .from("knowledge_events")
          .insert({
            organization_id: context.organizationId,
            site_id: context.siteId,
            source: normalized.event.source,
            source_id: normalized.event.sourceId,
            ...eventMutableValues,
            created_by: user.id
          })
          .select("id")
          .single();

        if (!eventError) {
          savedEventId = eventData.id;
        } else if (eventError.code === "23505") {
          const { data: concurrentEvent, error: concurrentEventError } = await client
            .from("knowledge_events")
            .select("id,site_id")
            .eq("organization_id", context.organizationId)
            .eq("source", normalized.event.source)
            .eq("source_id", normalized.event.sourceId)
            .maybeSingle();
          if (concurrentEventError) throw concurrentEventError;
          if (!concurrentEvent) throw eventError;
          if (concurrentEvent.site_id !== context.siteId) {
            return NextResponse.json({
              ok: false,
              configured: true,
              message: "동일한 원본 이벤트가 다른 현장에 이미 귀속되어 있습니다."
            }, { status: 409 });
          }

          savedEventId = await updateExistingEvent(concurrentEvent.id);
          if (!savedEventId) {
            return NextResponse.json({
              ok: false,
              configured: true,
              message: "원본 이벤트의 현장 귀속이 변경되어 갱신하지 않았습니다."
            }, { status: 409 });
          }
        } else {
          throw eventError;
        }
      }

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
        configured: true,
        storageMode: "persistent-error",
        event: normalized.event,
        message: `원본 이벤트 검증은 성공했지만 저장에 실패했습니다. 사유: ${message}`
      },
      { status: 500 }
    );
  }

  return NextResponse.json({
    ok: true,
    configured: true,
    storageMode: "persistent",
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
    message: "원본 이벤트를 knowledge_events에 누적하고 AI 재생성 run 초안을 저장했습니다."
  });
}
