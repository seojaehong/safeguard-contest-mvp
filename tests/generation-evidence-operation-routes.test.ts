import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { buildDbHarnessPacket } from "@/lib/db-harness";
import { attachGenerationEvidence } from "@/lib/generation-evidence";
import { buildMockAskResponse } from "@/lib/mock-data";
import type { SafetyReferenceItem, SafetyReferenceSearchResult } from "@/lib/safety-reference-catalog";
import type { AskResponse } from "@/lib/types";

const SECRET = "operation-route-generation-evidence-secret";
const mocks = vi.hoisted(() => ({
  searchSafetyReferences: vi.fn(),
  loadOwnedWorkpackOperationContext: vi.fn()
}));

vi.mock("@/lib/safety-reference-catalog", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/safety-reference-catalog")>();
  return {
    ...original,
    searchSafetyReferences: mocks.searchSafetyReferences
  };
});

vi.mock("@/lib/supabase-admin", () => ({
  createSupabaseAdminClient: () => fakeClient(),
  getWorkspaceUser: async () => ({ id: "user-1", email: "user@example.com" })
}));

vi.mock("@/lib/workpack-commercial-store", () => ({
  loadOwnedWorkpackOperationContext: mocks.loadOwnedWorkpackOperationContext
}));

function reference(id: string, title: string): SafetyReferenceItem {
  return {
    id,
    source_id: "sif",
    item_type: "sif-case",
    category: "건설",
    subcategory: "외벽",
    title,
    summary: `${title} 요약`,
    keywords: ["외벽", "도장"],
    risk_tags: ["추락"],
    primary_documents: ["위험성평가표", "TBM 브리핑", "TBM 기록"],
    controls: ["강풍 시 작업중지"],
    evidence_role: "direct",
    reflected_documents: ["TBM 기록"],
    retrieval_source: "ranked"
  };
}

function sealedResponse(): AskResponse {
  const question = "성수동 외벽 도장 작업";
  const generatedReference = reference("generation-ref", "생성 당시 비계 추락 사례");
  const response = buildMockAskResponse(question, [], "live", "test");
  const packet = buildDbHarnessPacket({ question, references: [generatedReference] });
  const withHarness: AskResponse = {
    ...response,
    dbHarness: {
      packet,
      promptContext: "server generation harness",
      summary: {
        mode: packet.mode,
        llmRole: packet.generationContract.llmRole,
        llmOutputScope: packet.generationContract.llmOutputScope,
        evidenceAuthority: packet.generationContract.evidenceAuthority,
        providerRetryScope: packet.generationContract.providerRetryScope,
        fallbackChainAllowed: packet.generationContract.fallbackChainAllowed,
        genericProseSubstitutionAllowed: packet.generationContract.genericProseSubstitutionAllowed,
        missingEvidencePolicy: packet.generationContract.missingEvidencePolicy,
        directEvidence: packet.directEvidence.length,
        sifCases: packet.sifCases.length,
        supportingEvidence: packet.supportingEvidence.length,
        improvementMemory: 0,
        workpackMemory: 0,
        missingEvidence: packet.generationContract.missingEvidence,
        documentCoverage: packet.generationContract.documentCoverage,
        retrievalContract: packet.retrievalContract,
        ontologyStatus: packet.ontologyChecklist.status
      }
    }
  };
  return attachGenerationEvidence(withHarness, {
    secret: SECRET,
    generatedAt: "2026-07-10T09:30:00.000Z"
  });
}

function fakeClient() {
  const result = { data: [], error: null };
  const query = {
    select() { return query; },
    eq() { return query; },
    order: async () => result
  };
  return { from: () => query };
}

function searchResult(item: SafetyReferenceItem): SafetyReferenceSearchResult {
  return {
    ok: true,
    configured: true,
    query: "성수동 외벽 도장 작업",
    count: 1,
    items: [item],
    retrievalMode: "ranked-rpc",
    vectorSearch: {
      enabled: false,
      attempted: false,
      ok: false,
      reason: "disabled",
      count: 0,
      model: "text-embedding-3-small",
      message: "disabled"
    },
    message: "comparison catalog"
  };
}

function ownedContext() {
  const workpack = sealedResponse();
  return {
    ok: true,
    context: {
      organizationId: "org-1",
      siteId: "site-1",
      workpackId: "workpack-1",
      question: workpack.question,
      generatedAt: "2026-07-10T10:00:00.000Z",
      shareAuthority: {
        workpack,
        readiness: { canShare: true, status: "ready", summary: "ready", reasons: [] }
      }
    }
  };
}

describe("saved generation evidence operation routes", () => {
  beforeEach(() => {
    process.env.SAFECLAW_GENERATION_EVIDENCE_SECRET = SECRET;
    mocks.loadOwnedWorkpackOperationContext.mockResolvedValue(ownedContext());
    mocks.searchSafetyReferences.mockResolvedValue(
      searchResult(reference("current-ref", "현재 카탈로그 신규 사례"))
    );
  });

  afterEach(() => {
    delete process.env.SAFECLAW_GENERATION_EVIDENCE_SECRET;
    vi.clearAllMocks();
  });

  it("keeps the operation graph invariant when the catalog drifts", async () => {
    const { GET } = await import("@/app/api/workpacks/[id]/operation-graph/route");
    const request = new NextRequest("http://localhost/api/workpacks/workpack-1/operation-graph");
    const response = await GET(request, { params: Promise.resolve({ id: "workpack-1" }) });
    const body = await response.json() as {
      graph: { nodes: Array<{ id: string; label: string }> };
      comparison?: unknown;
    };

    expect(mocks.searchSafetyReferences).not.toHaveBeenCalled();
    expect(body.graph.nodes).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: "evidence:generation-ref", label: "생성 당시 비계 추락 사례" })
    ]));
    expect(body.graph.nodes).not.toEqual(expect.arrayContaining([
      expect.objectContaining({ id: "evidence:current-ref" })
    ]));
    expect(body.comparison).toBeUndefined();
  });

  it("separates an opt-in fresh search as comparison-only", async () => {
    const { GET } = await import("@/app/api/workpacks/[id]/operation-graph/route");
    const request = new NextRequest(
      "http://localhost/api/workpacks/workpack-1/operation-graph?comparison=true"
    );
    const response = await GET(request, { params: Promise.resolve({ id: "workpack-1" }) });
    const body = await response.json() as {
      graph: { nodes: Array<{ id: string }> };
      comparison: Record<string, unknown>;
    };

    expect(mocks.searchSafetyReferences).toHaveBeenCalledOnce();
    expect(body.graph.nodes).not.toEqual(expect.arrayContaining([
      expect.objectContaining({ id: "evidence:current-ref" })
    ]));
    expect(body.graph.nodes).not.toEqual(expect.arrayContaining([
      expect.objectContaining({ id: expect.stringContaining("d-c-13-2026") })
    ]));
    expect(body.comparison).toMatchObject({
      query: "성수동 외벽 도장 작업",
      mode: "comparison_only",
      not_used_for_generation: true,
      count: 2
    });
    expect(body.comparison.items).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: "current-ref" }),
      expect.objectContaining({ id: expect.stringContaining("d-c-13-2026") })
    ]));
    expect(body.comparison.retrievedAt).toEqual(expect.any(String));
  });

  it("builds the learning export from the generation snapshot without a fresh search", async () => {
    const { GET } = await import("@/app/api/workpacks/[id]/learning-export/route");
    const request = new NextRequest("http://localhost/api/workpacks/workpack-1/learning-export?format=jsonl");
    const response = await GET(request, { params: Promise.resolve({ id: "workpack-1" }) });
    const body = await response.text();

    expect(mocks.searchSafetyReferences).not.toHaveBeenCalled();
    expect(body).toContain('"referenceItemId":"generation-ref"');
    expect(body).not.toContain('"referenceItemId":"current-ref"');
    expect(response.headers.get("x-safeclaw-generation-reference-count")).toBe("1");
  });
});
