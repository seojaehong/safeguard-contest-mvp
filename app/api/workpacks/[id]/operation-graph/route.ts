import { NextRequest, NextResponse } from "next/server";
import type { HarnessImprovement } from "@/lib/db-harness";
import { buildOperationMemoryGraph } from "@/lib/ontology/operation-memory";
import { searchSafetyReferences } from "@/lib/safety-reference-catalog";
import {
  createSupabaseAdminClient,
  getWorkspaceUser
} from "@/lib/supabase-admin";
import { normalizeLearningVisionPayload } from "@/lib/workpack-learning-export";
import { readString } from "@/lib/workspace-api";
import { loadOwnedWorkpackOperationContext } from "@/lib/workpack-commercial-store";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ id: string }>;
};

type ReadConfirmation = {
  displayName: string;
  languageCode: string;
  readAt: string;
};

function readStringArray(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function normalizeImprovementSourceType(value: string | null): HarnessImprovement["sourceType"] {
  if (value === "manual" || value === "photo_analysis" || value === "operator_note") return value;
  return "operator_note";
}

async function loadImprovementMemory(
  client: NonNullable<ReturnType<typeof createSupabaseAdminClient>>,
  workpackId: string
): Promise<HarnessImprovement[]> {
  try {
    const { data, error } = await client
      .from("workpack_improvements")
      .select("id,task_label,hazard_label,improvement_text,reflected_documents,source_type,analysis_payload,created_at")
      .eq("workpack_id", workpackId)
      .order("created_at", { ascending: false });

    if (error) {
      console.warn("operation graph improvement memory unavailable", error);
      return [];
    }

    return (data || []).map((row) => ({
      id: row.id,
      taskLabel: row.task_label,
      hazardLabel: row.hazard_label,
      improvementText: row.improvement_text,
      reflectedDocuments: readStringArray(row.reflected_documents),
      sourceType: normalizeImprovementSourceType(row.source_type),
      ...normalizeLearningVisionPayload(row.analysis_payload)
    }));
  } catch (error) {
    console.warn("operation graph improvement memory load failed", error);
    return [];
  }
}

async function loadReadConfirmations(
  client: NonNullable<ReturnType<typeof createSupabaseAdminClient>>,
  workpackId: string
): Promise<ReadConfirmation[]> {
  try {
    const { data, error } = await client
      .from("workpack_read_confirmations")
      .select("worker_display_name,language_code,read_at")
      .eq("workpack_id", workpackId)
      .order("read_at", { ascending: true });

    if (error) {
      console.warn("operation graph read confirmations unavailable", error);
      return [];
    }

    return (data || []).map((row) => ({
      displayName: row.worker_display_name,
      languageCode: row.language_code,
      readAt: row.read_at
    }));
  } catch (error) {
    console.warn("operation graph read confirmations load failed", error);
    return [];
  }
}

export async function GET(request: NextRequest, context: RouteContext) {
  const client = createSupabaseAdminClient();
  if (!client) {
    return NextResponse.json({ ok: false, configured: false, message: "Supabase 저장소가 아직 설정되지 않았습니다." }, { status: 503 });
  }

  const user = await getWorkspaceUser(client, request.headers);
  if (!user) {
    return NextResponse.json({ ok: false, configured: true, message: "관리자 로그인이 필요합니다." }, { status: 401 });
  }

  const { id } = await context.params;
  const owned = await loadOwnedWorkpackOperationContext(client, user, id);
  if (!owned.ok) {
    return NextResponse.json({ ok: false, configured: true, message: owned.message }, { status: owned.status });
  }

  const [references, improvements, confirmations] = await Promise.all([
    searchSafetyReferences({ query: owned.context.question, limit: 12 }),
    loadImprovementMemory(client, owned.context.workpackId),
    loadReadConfirmations(client, owned.context.workpackId)
  ]);

  const graph = buildOperationMemoryGraph({
    workpack: {
      id: owned.context.workpackId,
      question: owned.context.question,
      generatedAt: owned.context.generatedAt,
      taskLabel: readString(owned.context.question, "현장 작업")
    },
    references: references.items,
    improvements,
    confirmations
  });

  return NextResponse.json({
    ok: true,
    configured: true,
    graph,
    source: {
      referenceCount: references.count,
      improvementCount: improvements.length,
      confirmationCount: confirmations.length,
      retrievalMode: references.retrievalMode,
      vectorSearch: references.vectorSearch
    },
    message: "작업팩의 근거, 개선사항, 확인 이력을 운영 온톨로지 그래프로 조립했습니다."
  });
}
