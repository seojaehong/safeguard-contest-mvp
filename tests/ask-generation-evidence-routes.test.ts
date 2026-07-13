import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { buildDbHarnessPacket } from "@/lib/db-harness";
import { buildMockAskResponse } from "@/lib/mock-data";
import { assembleGraph } from "@/lib/ontology/graph-store";
import type { AskResponse } from "@/lib/types";

const mocks = vi.hoisted(() => ({
  querySafetyKnowledge: vi.fn(),
  resolveSafetyKnowledgeSnapshot: vi.fn(),
  runAsk: vi.fn(),
}));

vi.mock("@/lib/search", () => ({
  runAsk: mocks.runAsk
}));

vi.mock("@/lib/ontology/knowledge-tool", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/ontology/knowledge-tool")>();
  return {
    ...actual,
    querySafetyKnowledge: mocks.querySafetyKnowledge,
    resolveSafetyKnowledgeSnapshot: mocks.resolveSafetyKnowledgeSnapshot,
  };
});

const graphSnapshot = assembleGraph([], []);

function responseWithHarness(): AskResponse {
  const question = "성수동 외벽 도장 작업";
  const response = buildMockAskResponse(question, [], "mock", "test");
  const packet = buildDbHarnessPacket({ question, references: [] });
  return {
    ...response,
    generationTrace: {
      traceId: "trace-ask-route-test",
      askMode: "full",
      answer: {
        provider: "openai",
        model: "gpt-4.1-mini"
      },
      deliverables: {
        attempted: true,
        provider: "anthropic",
        modelPerDocument: {
          riskAssessment: {
            provider: "anthropic",
            model: "claude-opus-4-8"
          }
        }
      },
      fallbackUsed: false
    },
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
        directEvidence: 0,
        sifCases: 0,
        supportingEvidence: 0,
        improvementMemory: 0,
        workpackMemory: 0,
        missingEvidence: packet.generationContract.missingEvidence,
        documentCoverage: packet.generationContract.documentCoverage,
        retrievalContract: packet.retrievalContract,
        ontologyStatus: packet.ontologyChecklist.status
      }
    }
  };
}

function request(path: string): NextRequest {
  return new NextRequest(`http://localhost${path}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-forwarded-for": `203.0.113.${path.includes("stream") ? "41" : "40"}`
    },
    body: JSON.stringify({ question: "성수동 외벽 도장 작업" })
  });
}

describe("ask generation evidence routes", () => {
  beforeEach(() => {
    process.env.SAFECLAW_GENERATION_EVIDENCE_SECRET = "ask-route-generation-evidence-secret";
    const evidence = {
      found: false,
      message: "Phase A Task 미등록",
      registeredTasks: [],
      evidenceContract: null,
      evidenceDiagnostics: null,
      evidenceChainState: "not_registered" as const,
    };
    mocks.querySafetyKnowledge.mockResolvedValue(evidence);
    mocks.resolveSafetyKnowledgeSnapshot.mockResolvedValue({ evidence, graphSnapshot });
    mocks.runAsk.mockResolvedValue(responseWithHarness());
  });

  afterEach(() => {
    delete process.env.SAFECLAW_GENERATION_EVIDENCE_SECRET;
    vi.clearAllMocks();
  });

  it("attaches generation evidence to the JSON response", async () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => undefined);
    const { POST } = await import("@/app/api/ask/route");
    const response = await POST(request("/api/ask"));
    const body = await response.json() as AskResponse;

    expect(body.generationEvidence).toMatchObject({
      version: "safeclaw-generation-evidence/v1",
      algorithm: "HMAC-SHA256"
    });
    expect(body.generationEvidence?.snapshot.dbHarnessPacket).toEqual(body.dbHarness?.packet);
    expect(body.generationEvidence?.snapshot.generationTrace).toEqual(body.generationTrace);
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining("[api/ask] safeclaw_generation_trace"));
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('"traceId":"trace-ask-route-test"'));
    expect(mocks.resolveSafetyKnowledgeSnapshot).toHaveBeenCalledWith(
      "성수동 외벽 도장 작업",
      expect.objectContaining({
        signal: expect.any(AbortSignal),
        timeoutMs: expect.any(Number),
      }),
    );
    expect(mocks.querySafetyKnowledge).not.toHaveBeenCalled();
    expect(mocks.runAsk).toHaveBeenCalledWith(
      "성수동 외벽 도장 작업",
      expect.objectContaining({
        phaseAGrounding: expect.objectContaining({
          evidenceChainState: "not_registered",
          groundingStatus: "missing",
          evidencePack: null,
          generationPolicy: expect.objectContaining({
            llmRole: "naturalize_only",
            outputStatus: "missing_evidence_draft",
          }),
        }),
        phaseAGraphSnapshot: graphSnapshot,
      }),
    );
    logSpy.mockRestore();
  });

  it("attaches generation evidence to the SSE final payload", async () => {
    const { POST } = await import("@/app/api/ask/stream/route");
    const response = await POST(request("/api/ask/stream"));
    const body = await response.text();

    expect(body).toContain('"kind":"final"');
    expect(body).toContain('"version":"safeclaw-generation-evidence/v1"');
    expect(body).toContain('"algorithm":"HMAC-SHA256"');
    expect(mocks.resolveSafetyKnowledgeSnapshot).toHaveBeenCalledWith(
      "성수동 외벽 도장 작업",
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
    expect(mocks.runAsk).toHaveBeenCalledWith(
      "성수동 외벽 도장 작업",
      expect.objectContaining({
        phaseAGrounding: expect.objectContaining({
          groundingStatus: "missing",
          generationPolicy: expect.objectContaining({ llmRole: "naturalize_only" }),
        }),
        phaseAGraphSnapshot: graphSnapshot,
        onProgress: expect.any(Function),
      }),
    );
  });

  it("keeps the JSON route available with explicit missing grounding when ontology lookup throws", async () => {
    const secret = "PRIVATE_ROUTE_ONTOLOGY_FAILURE";
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    mocks.resolveSafetyKnowledgeSnapshot.mockRejectedValueOnce(new Error(secret));

    const { POST } = await import("@/app/api/ask/route");
    const response = await POST(request("/api/ask"));

    expect(response.status).toBe(200);
    expect(mocks.runAsk).toHaveBeenCalledWith(
      "성수동 외벽 도장 작업",
      expect.objectContaining({
        phaseAGrounding: expect.objectContaining({
          evidenceChainState: "not_evaluated",
          groundingStatus: "missing",
          allowedCitedUids: [],
          generationPolicy: expect.objectContaining({ outputStatus: "missing_evidence_draft" }),
        }),
      }),
    );
    expect(JSON.stringify(errorSpy.mock.calls)).not.toContain(secret);
    errorSpy.mockRestore();
  });

  it("does not expose raw internal errors through the SSE response", async () => {
    mocks.runAsk.mockRejectedValueOnce(new Error("PII_MARKER worker=Kim secret=internal"));
    const { POST } = await import("@/app/api/ask/stream/route");
    const response = await POST(request("/api/ask/stream"));
    const body = await response.text();

    expect(body).toContain('"kind":"error"');
    expect(body).toContain("요청 처리 중 오류가 발생했습니다");
    expect(body).not.toContain("PII_MARKER");
    expect(body).not.toContain("secret=internal");
  });
});
