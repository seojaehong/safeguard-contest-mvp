import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { attachGenerationEvidence } from "@/lib/generation-evidence";
import { buildBriefingDispatchWorkpack } from "@/lib/briefing";
import { buildMockAskResponse, mockSearchResults } from "@/lib/mock-data";
import { buildPhaseAGenerationGrounding } from "@/lib/ontology/evidence-chain";
import { runAsk } from "@/lib/search";
import type { SafetyReferenceSearchResult } from "@/lib/safety-reference-catalog";
import type { SearchResult } from "@/lib/types";
import { assembleGraph } from "@/lib/ontology/graph-store";
import { buildPublishedSafetyKnowledge } from "@/lib/ontology/knowledge-tool";
import { SEED_EDGES, SEED_NODES } from "@/lib/ontology/seed/core-triples";

const mocks = vi.hoisted(() => ({
  enhanceLegalEvidenceMappings: vi.fn(),
  generateAllDeliverablesWithDiagnostics: vi.fn(),
  generateAnswer: vi.fn(),
  searchSafetyReferences: vi.fn(),
  attachWebOntologyQa: vi.fn()
}));

vi.mock("@/lib/workpack-ontology-qa", () => ({
  attachWebOntologyQa: mocks.attachWebOntologyQa
}));

vi.mock("@/lib/ai", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/ai")>();
  return {
    ...original,
    enhanceLegalEvidenceMappings: mocks.enhanceLegalEvidenceMappings,
    generateAnswer: mocks.generateAnswer
  };
});

vi.mock("@/lib/ai-deliverables", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/ai-deliverables")>();
  return {
    ...original,
    generateAllDeliverablesWithDiagnostics: mocks.generateAllDeliverablesWithDiagnostics
  };
});

vi.mock("@/lib/safety-reference-catalog", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/safety-reference-catalog")>();
  return {
    ...original,
    searchSafetyReferences: mocks.searchSafetyReferences
  };
});

function successfulSafetyReferenceSearch(): SafetyReferenceSearchResult {
  return {
    ok: true,
    configured: true,
    query: "성수동 외벽 도장 작업",
    count: 0,
    items: [],
    retrievalMode: "ranked-rpc",
    vectorSearch: {
      enabled: false,
      attempted: false,
      ok: false,
      reason: "disabled",
      count: 0,
      model: "text-embedding-3-small",
      message: "벡터 검색 비활성"
    },
    message: "안전 지식 DB 조회 완료"
  };
}

describe("generation trace failure privacy", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.enhanceLegalEvidenceMappings.mockImplementation(
      async (_question: string, citations: SearchResult[]) => citations
    );
    mocks.generateAnswer.mockImplementation(async (question: string, citations: SearchResult[]) => ({
      response: buildMockAskResponse(
        question,
        citations.length ? citations : mockSearchResults.slice(0, 2),
        "mock",
        "provider unavailable in privacy test"
      ),
      trace: {
        provider: "mock",
        model: null,
        fallbackUsed: false
      }
    }));
    mocks.attachWebOntologyQa.mockImplementation(async (response: unknown) => response);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("keeps safety-reference failures safe in the final payload, evidence, and logs", async () => {
    const privateFailure = "resident=900101-1234567 api_key=sk-private-safety-reference";
    mocks.searchSafetyReferences.mockRejectedValue(new Error(privateFailure));
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);

    const response = await runAsk("성수동 외벽 도장 작업", { aiMode: "enhanced" });
    const sealed = attachGenerationEvidence(response, {
      secret: "test-generation-evidence-secret",
      generatedAt: "2026-07-11T00:00:00.000Z"
    });

    expect(response.externalData.safetyReference).toMatchObject({
      mode: "fallback",
      errorCode: "safety_reference_search_failed",
      message: "안전 지식 DB 조회를 완료하지 못했습니다. 잠시 후 다시 시도해 주세요."
    });
    expect(sealed.generationEvidence?.snapshot.dbHarnessPacket.retrievalContract).toMatchObject({
      errorCode: "safety_reference_search_failed",
      message: "안전 지식 DB 조회를 완료하지 못했습니다. 잠시 후 다시 시도해 주세요."
    });

    const publicSurface = JSON.stringify({ response, sealed });
    const internalLogs = JSON.stringify(errorSpy.mock.calls);
    expect(publicSurface).not.toContain("900101-1234567");
    expect(publicSurface).not.toContain("sk-private-safety-reference");
    expect(internalLogs).not.toContain("900101-1234567");
    expect(internalLogs).not.toContain("sk-private-safety-reference");
  }, 30_000);

  it("keeps a successful full-mode provider draft as non-authoring upstream provenance", async () => {
    mocks.searchSafetyReferences.mockResolvedValue(successfulSafetyReferenceSearch());
    mocks.generateAnswer.mockImplementation(async (question: string, citations: SearchResult[]) => {
      const providerResponse = buildMockAskResponse(question, citations, "live", "provider success");
      return {
        response: {
          ...providerResponse,
          answer: "provider-only-draft-must-not-be-final"
        },
        trace: {
          provider: "openai",
          model: "gpt-4.1-mini",
          fallbackUsed: false
        }
      };
    });
    mocks.generateAllDeliverablesWithDiagnostics.mockResolvedValue({
      deliverables: {
        riskAssessmentDraft: "provider risk assessment"
      },
      diagnostics: {
        geminiAvailable: true,
        providerAvailable: true,
        configuredProvider: "vertex",
        groupResults: [{ group: "riskAssessment", status: "fulfilled" }],
        filledKeys: ["riskAssessmentDraft"],
        trace: {
          attempted: true,
          provider: "vertex",
          modelPerDocument: {
            riskAssessmentDraft: {
              provider: "vertex",
              model: "gemini-2.5-flash",
              source: "provider",
              fallbackUsed: false
            }
          },
          fallbackUsed: false
        }
      }
    });

    const graphSnapshot = assembleGraph(
      SEED_NODES.filter((node) => node.review_state === "published"),
      SEED_EDGES.filter((edge) => edge.review_state === "published"),
    );
    const evidence = buildPublishedSafetyKnowledge(graphSnapshot, "고소작업");
    if (!evidence.found || !evidence.evidenceContract) {
      throw new Error("expected Phase A evidence pack");
    }
    const phaseAGrounding = buildPhaseAGenerationGrounding({
      evidenceChainState: evidence.evidenceChainState,
      evidencePack: evidence.evidenceContract,
    });
    const response = await runAsk("성수동 외벽 도장 작업", {
      aiMode: "full",
      phaseAGrounding,
      phaseAGraphSnapshot: graphSnapshot,
      harnessMemory: {
        improvements: [],
        workpackMemory: [],
      },
    });

    const answerOptions = mocks.generateAnswer.mock.calls[0]?.[2];
    const deliverableInput = mocks.generateAllDeliverablesWithDiagnostics.mock.calls[0]?.[0];
    const generationSnapshot = answerOptions?.phaseAGenerationSnapshot;
    expect(generationSnapshot).toBe(deliverableInput?.phaseAGenerationSnapshot);
    expect(generationSnapshot).toMatchObject({
      schemaVersion: "phase-a-generation-snapshot/v1",
      planBinding: expect.objectContaining({ chainId: "work-at-height-fall" }),
      orderedOntologyEvidence: [
        expect.objectContaining({ role: "hazard_priority_only", sourceType: "sif_case" }),
        expect.objectContaining({ role: "kosha_technical_guidance", sourceType: "kosha_guidance" }),
        expect.objectContaining({ role: "current_law_mandate", sourceType: "law" }),
      ],
      contextualInputs: expect.arrayContaining([
        expect.objectContaining({ kind: "site_context", digest: expect.stringMatching(/^sha256:/) }),
        expect.objectContaining({ kind: "history", digest: expect.stringMatching(/^sha256:/) }),
        expect.objectContaining({ kind: "weather", digest: expect.stringMatching(/^sha256:/) }),
        expect.objectContaining({ kind: "legal_search", digest: expect.stringMatching(/^sha256:/) }),
        expect.objectContaining({ kind: "training", digest: expect.stringMatching(/^sha256:/) }),
        expect.objectContaining({ kind: "kosha_education", digest: expect.stringMatching(/^sha256:/) }),
        expect.objectContaining({ kind: "kosha_reference", digest: expect.stringMatching(/^sha256:/) }),
        expect.objectContaining({ kind: "kosha_openapi", digest: expect.stringMatching(/^sha256:/) }),
        expect.objectContaining({ kind: "accident_case", digest: expect.stringMatching(/^sha256:/) }),
        expect.objectContaining({ kind: "safety_reference", digest: expect.stringMatching(/^sha256:/) }),
      ]),
      snapshotDigest: expect.stringMatching(/^sha256:/),
    });
    expect(Object.isFrozen(generationSnapshot)).toBe(true);
    expect(Object.isFrozen(generationSnapshot?.orderedOntologyEvidence)).toBe(true);
    expect(Object.isFrozen(generationSnapshot?.contextualInputs)).toBe(true);

    expect(response.answer).toContain("하네스 판단");
    expect(response.answer).not.toContain("provider-only-draft-must-not-be-final");
    expect(response.generationTrace).toMatchObject({
      askMode: "full",
      answer: {
        provider: "safeclaw",
        model: null,
        composition: "safeclaw_db_harness",
        upstream: {
          provider: "openai",
          model: "gpt-4.1-mini",
          fallbackUsed: false,
          usedInFinal: false
        }
      },
      deliverables: {
        attempted: true,
        modelPerDocument: {
          riskAssessmentDraft: {
            provider: "vertex",
            model: "gemini-2.5-flash",
            source: "provider",
            fallbackUsed: false
          }
        }
      }
    });
  }, 30_000);

  it("skips the raw citation-mapping provider prompt when Phase A grounding is present", async () => {
    mocks.searchSafetyReferences.mockResolvedValue(successfulSafetyReferenceSearch());
    const phaseAGrounding = buildPhaseAGenerationGrounding({
      evidenceChainState: "not_evaluated",
      evidencePack: null,
    });

    await runAsk("RAW_MAPPING_PROMPT_MUST_NOT_RUN", {
      aiMode: "enhanced",
      phaseAGrounding,
    });

    expect(mocks.enhanceLegalEvidenceMappings).not.toHaveBeenCalled();
    expect(mocks.generateAnswer).toHaveBeenCalledWith(
      "RAW_MAPPING_PROMPT_MUST_NOT_RUN",
      expect.any(Array),
      expect.objectContaining({ phaseAGrounding }),
    );
  }, 30_000);

  it("passes the exact grounding graph snapshot into post-generation ontology QA", async () => {
    mocks.searchSafetyReferences.mockResolvedValue(successfulSafetyReferenceSearch());
    const graphSnapshot = assembleGraph(
      SEED_NODES.filter((node) => node.review_state === "published"),
      SEED_EDGES.filter((edge) => edge.review_state === "published")
    );
    const phaseAGrounding = buildPhaseAGenerationGrounding({
      evidenceChainState: "not_evaluated",
      evidencePack: null
    });

    await runAsk("SNAPSHOT_REUSE_FOR_QA", {
      aiMode: "enhanced",
      phaseAGrounding,
      phaseAGraphSnapshot: graphSnapshot
    });

    expect(mocks.attachWebOntologyQa).toHaveBeenCalledWith(
      expect.any(Object),
      "SNAPSHOT_REUSE_FOR_QA",
      graphSnapshot
    );
  }, 30_000);

  it("fails closed with explicit missing Phase A grounding when a caller omits it", async () => {
    mocks.searchSafetyReferences.mockResolvedValue(successfulSafetyReferenceSearch());

    const response = await runAsk("PUBLIC_ASK_WITHOUT_GROUNDING", { aiMode: "enhanced" });

    expect(mocks.enhanceLegalEvidenceMappings).not.toHaveBeenCalled();
    expect(mocks.generateAnswer).toHaveBeenCalledWith(
      "PUBLIC_ASK_WITHOUT_GROUNDING",
      expect.any(Array),
      expect.objectContaining({
        phaseAGrounding: expect.objectContaining({
          evidenceChainState: "not_evaluated",
          groundingStatus: "missing",
          evidencePack: null,
          allowedCitedUids: [],
          generationPolicy: expect.objectContaining({
            llmRole: "naturalize_only",
            outputStatus: "missing_evidence_draft",
          }),
        }),
      }),
    );
    expect(response.phaseAReview).toMatchObject({
      verdict: "검토 필요",
      verified: false,
      groundingStatus: "missing",
      outputStatus: "missing_evidence_draft",
      verifiedRecords: 0,
      humanConfirmation: { required: true, status: "pending" },
    });
  }, 30_000);

  it("keeps the public template path provider-free and explicitly human-pending", async () => {
    const response = await runAsk("PUBLIC_TEMPLATE_WITHOUT_GROUNDING", { aiMode: "template" });

    expect(mocks.enhanceLegalEvidenceMappings).not.toHaveBeenCalled();
    expect(mocks.generateAnswer).not.toHaveBeenCalled();
    expect(mocks.generateAllDeliverablesWithDiagnostics).not.toHaveBeenCalled();
    expect(response.generationTrace).toMatchObject({
      askMode: "template",
      deliverables: { attempted: false },
    });
    expect(response.phaseAReview).toMatchObject({
      verdict: "검토 필요",
      verified: false,
      groundingStatus: "missing",
      outputStatus: "missing_evidence_draft",
      verifiedRecords: 0,
      materializationCoverage: {
        status: "missing",
        expectedRecordCount: 0,
        materializedRecordCount: 0,
        expectedStableKeys: [],
        materializedStableKeys: [],
        unresolvedStableKeys: [],
      },
      humanConfirmation: { required: true, status: "pending" },
    });
    expect(response.deliverables.workpackSummaryDraft).toContain("법령 근거: 검토 필요");
    expect(response.deliverables.workpackSummaryDraft).not.toContain("법령 근거: 연결됨");
    for (const body of [
      response.deliverables.riskAssessmentDraft,
      response.deliverables.tbmBriefing,
      response.deliverables.tbmLogDraft,
      response.deliverables.safetyEducationRecordDraft,
    ]) {
      expect(body).toContain("법령 근거: 검토 필요");
      expect(body).toContain("공식자료 연결 후보");
      expect(body).not.toContain("법령 근거: 연결됨");
    }

    const dispatch = buildBriefingDispatchWorkpack(response, "테스트 현장");
    expect(dispatch).toMatchObject({
      reviewAuthority: { authoritative: false },
      documents: {
        workpackSummaryDraft: expect.stringContaining("법령 근거: 검토 필요"),
      },
    });
    expect(JSON.stringify(dispatch)).not.toContain("법령 근거: 연결됨");
    const dispatchDocuments = dispatch.documents;
    if (typeof dispatchDocuments !== "object" || dispatchDocuments === null) {
      throw new Error("expected briefing dispatch documents");
    }
    expect(Reflect.get(dispatchDocuments, "riskAssessmentDraft")).toContain("법령 근거: 검토 필요");
    expect(Reflect.get(dispatchDocuments, "tbmBriefing")).toContain("법령 근거: 검토 필요");
  });
});
