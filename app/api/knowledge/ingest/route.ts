import { NextRequest, NextResponse } from "next/server";
import {
  buildKnowledgeRegenerationBundle,
  normalizeKnowledgeRawEvent
} from "@/lib/safety-knowledge";

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

  return NextResponse.json({
    ok: true,
    configured: false,
    storageMode: "stateless",
    event: normalized.event,
    proposedWikiUpdate: {
      hazardIds: regenerationBundle.matchedHazards.map((hazard) => hazard.id),
      documentNames: normalized.event.reflectedDocuments,
      sourceTitle: normalized.event.title,
      reviewRequired: true
    },
    regenerationBundle,
    message: "원본 이벤트를 검증했습니다. 영구 누적은 Supabase knowledge_events migration 승인 후 활성화합니다."
  });
}
