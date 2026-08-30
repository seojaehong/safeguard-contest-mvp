import { NextRequest, NextResponse } from "next/server";
import type { HarnessImprovement } from "@/lib/db-harness";
import { buildOperationMemoryGraph } from "@/lib/ontology/operation-memory";
import { searchSafetyReferences } from "@/lib/safety-reference-catalog-server";
import {
  buildGenerationEvidenceComparison,
  generationEvidenceReferences,
  mergeGenerationImprovements,
  verifyAskResponseGenerationEvidence
} from "@/lib/generation-evidence";
import {
  createSupabaseAdminClient,
  getWorkspaceUser
} from "@/lib/supabase-admin";
import { normalizeLearningVisionPayload } from "@/lib/workpack-learning-export";
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
  input: { organizationId: string; siteId: string | null; workpackId: string }
): Promise<HarnessImprovement[]> {
  try {
    let improvementQuery = client
      .from("workpack_improvements")
      .select("id,task_label,hazard_label,improvement_text,reflected_documents,review_status,source_type,analysis_payload,created_at")
      .eq("workpack_id", input.workpackId)
      .eq("organization_id", input.organizationId)
      .in("review_status", ["approved", "reflected"]);
    improvementQuery = input.siteId === null
      ? improvementQuery.is("site_id", null)
      : improvementQuery.eq("site_id", input.siteId);
    const { data, error } = await improvementQuery.order("created_at", { ascending: false });

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
  input: { organizationId: string; siteId: string | null; workpackId: string }
): Promise<ReadConfirmation[]> {
  try {
    let confirmationQuery = client
      .from("workpack_read_confirmations")
      .select("worker_display_name,language_code,read_at")
      .eq("workpack_id", input.workpackId)
      .eq("organization_id", input.organizationId);
    confirmationQuery = input.siteId === null
      ? confirmationQuery.is("site_id", null)
      : confirmationQuery.eq("site_id", input.siteId);
    const { data, error } = await confirmationQuery.order("read_at", { ascending: true });

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

  const storedWorkpack = owned.context.shareAuthority.workpack;
  if (!storedWorkpack) {
    return NextResponse.json({
      ok: false,
      configured: true,
      message: "저장된 작업팩을 authoritative 생성 결과로 복원할 수 없습니다."
    }, { status: 409 });
  }
  const verification = verifyAskResponseGenerationEvidence(
    storedWorkpack,
    process.env.SAFECLAW_GENERATION_EVIDENCE_SECRET
  );
  if (!verification.ok) {
    return NextResponse.json({
      ok: false,
      configured: true,
      code: `generation_evidence_${verification.code}`,
      message: verification.message
    }, { status: verification.code === "secret_unconfigured" ? 503 : 409 });
  }

  const comparisonRequested = request.nextUrl.searchParams.get("comparison") === "true";
  const childScope = {
    organizationId: owned.context.organizationId,
    siteId: owned.context.siteId,
    workpackId: owned.context.workpackId
  };
  const [improvements, confirmations, comparisonSearch] = await Promise.all([
    loadImprovementMemory(client, childScope),
    loadReadConfirmations(client, childScope),
    comparisonRequested
      ? searchSafetyReferences({ query: verification.snapshot.question, limit: 12 })
      : Promise.resolve(null)
  ]);
  const references = generationEvidenceReferences(verification.snapshot);
  const mergedImprovements = mergeGenerationImprovements(verification.snapshot, improvements);

  const graph = buildOperationMemoryGraph({
    workpack: {
      id: owned.context.workpackId,
      question: verification.snapshot.question,
      generatedAt: verification.snapshot.generatedAt,
      taskLabel: verification.snapshot.scenario.workSummary
    },
    references,
    improvements: mergedImprovements,
    relatedWorkpacks: verification.snapshot.dbHarnessPacket.workpackMemory,
    confirmations
  });
  const comparison = comparisonSearch
    ? buildGenerationEvidenceComparison(comparisonSearch, new Date().toISOString())
    : undefined;

  return NextResponse.json({
    ok: true,
    configured: true,
    graph,
    source: {
      referenceCount: references.length,
      generationReferenceCount: references.length,
      improvementCount: mergedImprovements.length,
      confirmationCount: confirmations.length,
      retrievalMode: verification.snapshot.dbHarnessPacket.retrievalContract.mode,
      vectorSearch: verification.snapshot.dbHarnessPacket.retrievalContract.vector,
      generationEvidenceVersion: storedWorkpack.generationEvidence?.version
    },
    ...(comparison ? { comparison } : {}),
    message: "작업팩의 근거, 개선사항, 확인 이력을 운영 온톨로지 그래프로 조립했습니다."
  });
}
