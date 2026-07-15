import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { beforeEach, describe, expect, test, vi } from "vitest";

import { buildMockAskResponse, mockSearchResults } from "@/lib/mock-data";
import type { McpAuthContext } from "@/lib/mcp-auth";
import type { McpToolResult } from "@/lib/mcp-tools";
import { assembleGraph } from "@/lib/ontology/graph-store";
import { buildPublishedSafetyKnowledge } from "@/lib/ontology/knowledge-tool";
import type { QaReviewFound } from "@/lib/ontology/qa-review";
import { SEED_EDGES, SEED_NODES } from "@/lib/ontology/seed/core-triples";

const mocks = vi.hoisted(() => ({
  querySafetyKnowledge: vi.fn(),
  reviewDocpack: vi.fn(),
  runAsk: vi.fn(),
}));

vi.mock("mcp-handler", () => ({
  createMcpHandler: vi.fn(() => vi.fn()),
  withMcpAuth: vi.fn((handler: unknown) => handler),
}));

vi.mock("@/lib/search", () => ({
  runAsk: mocks.runAsk,
}));

vi.mock("@/lib/ontology/knowledge-tool", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/ontology/knowledge-tool")>();
  return {
    ...original,
    querySafetyKnowledge: mocks.querySafetyKnowledge,
  };
});

vi.mock("@/lib/ontology/qa-review-tool", () => ({
  reviewDocpack: mocks.reviewDocpack,
}));

vi.mock("@/lib/supabase-admin", () => ({
  createSupabaseAdminClient: vi.fn(() => null),
}));

import { registerTools } from "@/app/api/mcp/[transport]/implementation";

type RegisteredTool = {
  invoke: (args: unknown, extra: unknown) => Promise<McpToolResult>;
};

const AUTH_CONTEXT: McpAuthContext = {
  siteId: "site-route-test",
  orgId: "org-route-test",
  scopes: ["tools:write"],
  source: "db",
  tokenId: "token-route-test",
};

const publishedGraph = assembleGraph(
  SEED_NODES.filter((node) => node.review_state === "published"),
  SEED_EDGES.filter((edge) => edge.review_state === "published"),
);

function passingQa(task: string): QaReviewFound {
  return {
    reviewable: true,
    task,
    covered: { hazards: [], controls: [], articles: [] },
    missing: { hazards: [], controls: [], articles: [] },
    coverageRate: 1,
    verdict: "통과",
    advisory: "검수 고지",
  };
}

function parseToolPayload(result: McpToolResult): Record<string, unknown> {
  const parsed: unknown = JSON.parse(result.content[0]?.text ?? "null");
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new Error("Expected an MCP JSON object payload.");
  }
  return parsed as Record<string, unknown>;
}

function captureReviewedRouteTool(): RegisteredTool {
  const tools = new Map<string, RegisteredTool>();
  const server = {
    registerTool(
      name: string,
      _config: unknown,
      invoke: RegisteredTool["invoke"],
    ): object {
      tools.set(name, { invoke });
      return {};
    },
  };
  registerTools(server as unknown as McpServer);
  const tool = tools.get("generate_reviewed_safety_docpack");
  if (!tool) throw new Error("Reviewed docpack tool was not registered by the Next MCP route.");
  return tool;
}

describe("Next MCP route reviewed task binding", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.runAsk.mockImplementation(async (question: string) =>
      buildMockAskResponse(
        question,
        mockSearchResults.slice(0, 3),
        "mock",
        "Next MCP route task-binding test",
      ),
    );
    mocks.querySafetyKnowledge.mockImplementation(async (task: string) =>
      buildPublishedSafetyKnowledge(publishedGraph, task),
    );
    mocks.reviewDocpack.mockImplementation(async (task: string) => passingQa(task));
  });

  test.each([
    "미확정인 고소작업을 수행합니다",
    "고소작업을 진행할지 검토",
    "고소작업은 아직 결정되지 않음",
    "하지 않는 고소작업을 위한 문서팩",
    "취소된 고소작업을 수행합니다",
    "고소작업을 수행할 예정으로 작업계획서와 장비 상태 및 인원 배치를 모두 확인했지만 최종적으로 하지 않음",
  ])("does not attach Phase A provenance for unsupported intent: %s", async (question) => {
    const result = await captureReviewedRouteTool().invoke(
      { question, task: "고소작업", mode: "template", includeFull: true },
      { authInfo: { extra: AUTH_CONTEXT } },
    );
    const payload = parseToolPayload(result);
    const docpack = payload.docpack;
    if (typeof docpack !== "object" || docpack === null || Array.isArray(docpack)) {
      throw new Error("Expected an MCP reviewed docpack payload.");
    }

    expect(docpack).not.toHaveProperty("phaseAProduct");
    expect(payload).not.toHaveProperty("phaseAReviewStatus");
  });

  test("preserves a valid canonical question with a registered alias task", async () => {
    const result = await captureReviewedRouteTool().invoke(
      {
        question: "외벽 고소작업을 위한 문서팩",
        task: "높은 곳 작업",
        mode: "template",
        includeFull: true,
      },
      { authInfo: { extra: AUTH_CONTEXT } },
    );

    expect(parseToolPayload(result)).toMatchObject({
      reviewTask: "고소작업",
      docpack: {
        phaseAProduct: {
          chainId: null,
          provenance: expect.objectContaining({ controlNodeIds: [], lawCitedUids: [] }),
        },
      },
    });
  });
});
