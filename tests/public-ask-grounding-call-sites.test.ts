import { readFileSync } from "node:fs";
import { join } from "node:path";
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { buildMockAskResponse, mockSearchResults } from "@/lib/mock-data";
import { assembleGraph } from "@/lib/ontology/graph-store";

const mocks = vi.hoisted(() => ({
  querySafetyKnowledge: vi.fn(),
  resolveSafetyKnowledgeSnapshot: vi.fn(),
  runAsk: vi.fn(),
  isLiveDispatchEnabled: vi.fn(),
  postWebhookWithTimeout: vi.fn(),
  resolveWebhookConfig: vi.fn(),
}));

vi.mock("@/lib/search", () => ({
  runAsk: mocks.runAsk,
}));

vi.mock("@/lib/ontology/knowledge-tool", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/ontology/knowledge-tool")>();
  return {
    ...actual,
    querySafetyKnowledge: mocks.querySafetyKnowledge,
    resolveSafetyKnowledgeSnapshot: mocks.resolveSafetyKnowledgeSnapshot,
  };
});

vi.mock("@/lib/supabase-admin", () => ({
  createSupabaseAdminClient: () => null,
}));

vi.mock("@/lib/n8n-webhook", () => ({
  isLiveDispatchEnabled: mocks.isLiveDispatchEnabled,
  postWebhookWithTimeout: mocks.postWebhookWithTimeout,
  resolveWebhookConfig: mocks.resolveWebhookConfig,
}));

function missingKnowledge() {
  return {
    found: false,
    message: "Phase A Task 미등록",
    registeredTasks: [],
    evidenceContract: null,
    evidenceDiagnostics: null,
    evidenceChainState: "not_registered" as const,
  };
}

const graphSnapshot = assembleGraph([], []);

describe("public ask Phase A grounding call sites", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.CRON_SECRET = "briefing-test-secret";
    process.env.BRIEFING_SITES = JSON.stringify([{
      name: "안산 제조공장",
      question: "등록되지 않은 설비 점검",
      email: "safety@example.com",
    }]);
    mocks.querySafetyKnowledge.mockResolvedValue(missingKnowledge());
    mocks.resolveSafetyKnowledgeSnapshot.mockResolvedValue({
      evidence: missingKnowledge(),
      graphSnapshot,
    });
    mocks.isLiveDispatchEnabled.mockReturnValue(true);
    mocks.resolveWebhookConfig.mockReturnValue({
      url: "https://dispatch.example.test/webhook",
      token: "dispatch-test-token"
    });
    mocks.postWebhookWithTimeout.mockResolvedValue({ ok: true });
    mocks.runAsk.mockImplementation(async (question: string) =>
      buildMockAskResponse(question, mockSearchResults.slice(0, 2), "mock", "grounded call-site test")
    );
  });

  afterEach(() => {
    delete process.env.CRON_SECRET;
    delete process.env.BRIEFING_SITES;
    vi.restoreAllMocks();
  });

  it("keeps the server-rendered ask page on the grounded call path", () => {
    const source = readFileSync(join(process.cwd(), "app", "ask", "page.tsx"), "utf8");

    expect(source).toContain('import { runPhaseAGroundedAsk } from "@/lib/ontology/grounded-ask"');
    expect(source).toContain("const data = await runPhaseAGroundedAsk(q)");
    expect(source).not.toMatch(/\brunAsk\s*\(/);
  });

  it("grounds every briefing site question before enhanced runAsk", async () => {
    const { GET } = await import("@/app/api/briefing/run/route");
    const response = await GET(new NextRequest("http://localhost/api/briefing/run", {
      headers: { authorization: "Bearer briefing-test-secret" },
    }));

    expect(response.status).toBe(200);
    expect(mocks.resolveSafetyKnowledgeSnapshot).toHaveBeenCalledWith(
      "등록되지 않은 설비 점검",
      expect.objectContaining({
        signal: expect.any(AbortSignal),
        timeoutMs: expect.any(Number),
      }),
    );
    expect(mocks.querySafetyKnowledge).not.toHaveBeenCalled();
    expect(mocks.runAsk).toHaveBeenCalledWith(
      "등록되지 않은 설비 점검",
      expect.objectContaining({
        aiMode: "enhanced",
        phaseAGrounding: expect.objectContaining({
          groundingStatus: "missing",
          generationPolicy: expect.objectContaining({ llmRole: "naturalize_only" }),
        }),
        phaseAGraphSnapshot: graphSnapshot,
      }),
    );
  });

  it("fails closed before automatic dispatch when Phase A review is missing", async () => {
    const { GET } = await import("@/app/api/briefing/run/route");
    const response = await GET(new NextRequest("http://localhost/api/briefing/run", {
      headers: { authorization: "Bearer briefing-test-secret" },
    }));
    const body = await response.json() as {
      results: Array<{ emailed: boolean; message?: string }>;
    };

    expect(body.results[0]).toMatchObject({ emailed: false });
    expect(body.results[0]?.message).toContain("Phase A");
    expect(body.results[0]?.message).toContain("blocked");
    expect(mocks.postWebhookWithTimeout).not.toHaveBeenCalled();
  });
});
