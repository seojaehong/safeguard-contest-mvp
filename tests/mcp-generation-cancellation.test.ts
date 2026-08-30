import { afterEach, describe, expect, test, vi } from "vitest";

import type { McpAuthContext } from "@/lib/mcp-auth";
import {
  createGenerateReviewedSafetyDocpackHandler,
  createGenerateSafetyDocpackHandler,
} from "@/lib/mcp-docpack-handler";
import { buildMockAskResponse, mockSearchResults } from "@/lib/mock-data";
import { assembleGraph, loadGraph } from "@/lib/ontology/graph-store";
import { buildPublishedSafetyKnowledge } from "@/lib/ontology/knowledge-tool";
import type { QaReviewFound } from "@/lib/ontology/qa-review";
import { SEED_EDGES, SEED_NODES } from "@/lib/ontology/seed/core-triples";

const AUTH_CONTEXT: McpAuthContext = {
  siteId: "site-cancellation",
  orgId: "org-cancellation",
  scopes: ["tools:write"],
  source: "db",
  tokenId: "token-cancellation",
};

const publishedGraph = assembleGraph(
  SEED_NODES.filter((node) => node.review_state === "published"),
  SEED_EDGES.filter((edge) => edge.review_state === "published"),
);

function waitForAbort(signal: AbortSignal): Promise<never> {
  return new Promise((_, reject) => {
    signal.addEventListener("abort", () => reject(signal.reason), { once: true });
  });
}

function mockResponse(question: string) {
  return buildMockAskResponse(
    question,
    mockSearchResults.slice(0, 3),
    "mock",
    "MCP cancellation contract test",
  );
}

describe("MCP document generation cancellation", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  test("aborts both ontology graph fetches instead of converting cancellation into a fallback result", async () => {
    vi.stubEnv("SUPABASE_URL", "https://ontology-cancellation.test");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "ontology-cancellation-key");
    const signals: AbortSignal[] = [];
    vi.stubGlobal("fetch", vi.fn(async (_input: string | URL | Request, init?: RequestInit) => {
      if (!init?.signal) throw new Error("missing ontology AbortSignal");
      signals.push(init.signal);
      return waitForAbort(init.signal);
    }));
    const controller = new AbortController();
    const pending = loadGraph("published", controller.signal);

    await vi.waitFor(() => expect(signals).toHaveLength(2));
    const reason = new DOMException("client disconnected", "AbortError");
    controller.abort(reason);

    await expect(pending).rejects.toBe(reason);
    expect(signals.every((signal) => signal === controller.signal)).toBe(true);
  });

  test("threads one signal through knowledge and generation and stops before persistence", async () => {
    const controller = new AbortController();
    let generationSignal: AbortSignal | undefined;
    const getWorkpackRepository = vi.fn(() => null);
    const handler = createGenerateSafetyDocpackHandler({
      defaultMode: "full",
      queryKnowledge: async (query, signal) => {
        expect(signal).toBe(controller.signal);
        return buildPublishedSafetyKnowledge(publishedGraph, query);
      },
      generateResponse: async (_question, _mode, _grounding, signal) => {
        if (!signal) throw new Error("missing generation AbortSignal");
        generationSignal = signal;
        return waitForAbort(signal);
      },
      getWorkpackRepository,
      getGenerationEvidenceSecret: () => undefined,
    });
    const pending = handler(
      { question: "외벽 고소작업", mode: "full" },
      AUTH_CONTEXT,
      { signal: controller.signal },
    );

    await vi.waitFor(() => expect(generationSignal).toBe(controller.signal));
    const reason = new DOMException("client disconnected", "AbortError");
    controller.abort(reason);

    await expect(pending).rejects.toBe(reason);
    expect(getWorkpackRepository).not.toHaveBeenCalled();
  });

  test("cancels reviewed QA before the persistence boundary", async () => {
    const controller = new AbortController();
    let reviewSignal: AbortSignal | undefined;
    const persistResponse = vi.fn(async () => null);
    const handler = createGenerateReviewedSafetyDocpackHandler({
      defaultMode: "full",
      queryKnowledge: async (query, signal) => {
        expect(signal).toBe(controller.signal);
        return buildPublishedSafetyKnowledge(publishedGraph, query);
      },
      generateResponse: async (question, _mode, _grounding, signal) => {
        expect(signal).toBe(controller.signal);
        return mockResponse(question);
      },
      reviewResponse: async (_task, _documentText, signal): Promise<QaReviewFound> => {
        if (!signal) throw new Error("missing review AbortSignal");
        reviewSignal = signal;
        return waitForAbort(signal);
      },
      persistResponse,
      getGenerationEvidenceSecret: () => undefined,
    });
    const pending = handler(
      {
        question: "외벽 고소작업 문서팩",
        task: "고소작업",
        mode: "full",
      },
      AUTH_CONTEXT,
      { signal: controller.signal },
    );

    await vi.waitFor(() => expect(reviewSignal).toBe(controller.signal));
    const reason = new DOMException("client disconnected", "AbortError");
    controller.abort(reason);

    await expect(pending).rejects.toBe(reason);
    expect(persistResponse).not.toHaveBeenCalled();
  });
});
