import { describe, expect, test, vi } from "vitest";

import { buildMockAskResponse, mockSearchResults } from "@/lib/mock-data";
import type { McpAuthContext } from "@/lib/mcp-auth";
import {
  createGenerateReviewedSafetyDocpackHandler,
  createGenerateSafetyDocpackHandler,
} from "@/lib/mcp-docpack-handler";
import type { McpToolResult, SafetyKnowledgeResult } from "@/lib/mcp-tools";
import type {
  ActiveEvidenceChainPack,
  PhaseAGenerationGrounding,
} from "@/lib/ontology/evidence-chain";
import { assembleGraph } from "@/lib/ontology/graph-store";
import { buildPublishedSafetyKnowledge } from "@/lib/ontology/knowledge-tool";
import { SEED_EDGES, SEED_NODES } from "@/lib/ontology/seed/core-triples";

const publishedGraph = assembleGraph(
  SEED_NODES.filter((node) => node.review_state === "published"),
  SEED_EDGES.filter((edge) => edge.review_state === "published"),
);
const authContext: McpAuthContext = {
  siteId: null,
  orgId: null,
  scopes: ["tools:generate_safety_docpack"],
  source: "env",
  tokenId: null,
};
const tenantAuthContext: McpAuthContext = {
  siteId: "site-a",
  orgId: "org-a",
  scopes: ["tools:generate_safety_docpack"],
  source: "db",
  tokenId: "token-a",
};

type CanonicalPackForgery = {
  field: "task" | "control" | "evidence" | "law";
  mutate: (pack: ActiveEvidenceChainPack) => void;
};

const CANONICAL_PACK_FORGERIES: readonly CanonicalPackForgery[] = [
  {
    field: "task",
    mutate: (pack) => {
      pack.task.nodeId = "Task_forged";
    },
  },
  {
    field: "control",
    mutate: (pack) => {
      const control = pack.controls[0];
      if (!control) throw new Error("expected canonical control");
      control.graphControlNodeId = "Control_forged";
    },
  },
  {
    field: "evidence",
    mutate: (pack) => {
      const evidence = pack.hazardPriority[0];
      if (!evidence) throw new Error("expected canonical SIF evidence");
      evidence.citedUid = "ref:safety_reference_items:forged";
    },
  },
  {
    field: "law",
    mutate: (pack) => {
      const law = pack.controls[0]?.lawEvidence[0];
      if (!law) throw new Error("expected canonical law evidence");
      law.citedUid = "law:forged:제999조";
    },
  },
];

const FORGED_MCP_CASES = (["plain", "reviewed"] as const).flatMap((route) =>
  CANONICAL_PACK_FORGERIES.map((forgery) => ({ route, ...forgery })),
);

const MALFORMED_MCP_CASES = (["plain", "reviewed"] as const).flatMap((route) => [
  {
    route,
    field: "task",
    mutate: (pack: ActiveEvidenceChainPack): void => {
      Reflect.set(pack, "task", null);
    },
  },
  {
    route,
    field: "applicability",
    mutate: (pack: ActiveEvidenceChainPack): void => {
      Reflect.set(pack, "applicability", null);
    },
  },
]);

function parseToolPayload(result: McpToolResult): Record<string, unknown> {
  const parsed: unknown = JSON.parse(result.content[0]?.text ?? "null");
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("expected MCP JSON object payload");
  }
  return parsed as Record<string, unknown>;
}

describe("Phase A runtime evidence bridge", () => {
  test("awaits knowledge, passes the exact immutable grounding to generation, and reuses its pack", async () => {
    const events: string[] = [];
    let providerGrounding: PhaseAGenerationGrounding | undefined;
    const queried = buildPublishedSafetyKnowledge(publishedGraph, "고소작업");
    const knowledge: SafetyKnowledgeResult = queried.found
      ? { ...queried, phaseAProduct: null }
      : queried;
    const handler = createGenerateSafetyDocpackHandler({
      defaultMode: "full",
      queryKnowledge: async () => {
        events.push("query:start");
        await Promise.resolve();
        events.push("query:end");
        return knowledge;
      },
      generateResponse: async (question, _mode, grounding) => {
        events.push("generate");
        providerGrounding = grounding;
        return buildMockAskResponse(
          question,
          mockSearchResults.slice(0, 3),
          "mock",
          "runtime evidence bridge test",
        );
      },
      getWorkpackRepository: () => null,
      getGenerationEvidenceSecret: () => undefined,
    });

    const result = await handler(
      { question: "고소작업", mode: "template", includeFull: true },
      authContext,
    );
    const payload = parseToolPayload(result);

    expect(events).toEqual(["query:start", "query:end", "generate"]);
    expect(providerGrounding).toBeDefined();
    expect(Object.isFrozen(providerGrounding)).toBe(true);
    expect(Object.isFrozen(providerGrounding?.evidencePack)).toBe(true);
    expect(payload).toMatchObject({
      phaseAProduct: {
        chainId: "work-at-height-fall",
        authorityState: "review_required",
        verifiedDocumentRows: [],
        documentRows: expect.arrayContaining([
          expect.objectContaining({
            stableKey: "work-at-height-fall:risk-assessment:fall-work-platform",
            verificationStatus: "review_required",
          }),
        ]),
        provenance: expect.objectContaining({
          taskNodeIds: ["Task_work_at_height"],
          hazardNodeIds: ["Hazard_추락"],
          controlNodeIds: expect.any(Array),
          lawCitedUids: expect.any(Array),
        }),
      },
    });
  });

  test("serializes the reviewed MCP path with the same grounding contract", async () => {
    const events: string[] = [];
    let providerGrounding: PhaseAGenerationGrounding | undefined;
    const handler = createGenerateReviewedSafetyDocpackHandler({
      defaultMode: "full",
      queryKnowledge: async (query) => {
        events.push("query");
        return buildPublishedSafetyKnowledge(publishedGraph, query);
      },
      generateResponse: async (question, _mode, grounding) => {
        events.push("generate");
        providerGrounding = grounding;
        return buildMockAskResponse(
          question,
          mockSearchResults.slice(0, 3),
          "mock",
          "reviewed runtime evidence bridge test",
        );
      },
      reviewResponse: async (task) => {
        events.push("review");
        return {
          reviewable: true,
          task,
          covered: { hazards: [], controls: [], articles: [] },
          missing: { hazards: [], controls: [], articles: [] },
          coverageRate: 1,
          verdict: "통과",
          advisory: "검수 고지",
        };
      },
      persistResponse: async () => null,
      getGenerationEvidenceSecret: () => undefined,
    });

    const result = await handler({
      question: "외벽 고소작업을 위한 문서팩",
      task: "높은 곳 작업",
      mode: "template",
      includeFull: true,
    }, authContext);

    expect(events).toEqual(["query", "generate", "review"]);
    expect(providerGrounding?.evidencePack?.chainId).toBe("work-at-height-fall");
    expect(parseToolPayload(result)).toMatchObject({
      docpack: {
        phaseAProduct: {
          chainId: "work-at-height-fall",
          authorityState: "review_required",
          verifiedDocumentRows: [],
          provenance: expect.objectContaining({
            controlNodeIds: expect.any(Array),
            lawCitedUids: expect.any(Array),
          }),
        },
      },
    });
  });

  test("does not apply an empty Phase A allowlist to an unregistered plain question", async () => {
    let providerGrounding: PhaseAGenerationGrounding | undefined;
    const handler = createGenerateSafetyDocpackHandler({
      defaultMode: "full",
      queryKnowledge: async (query) => buildPublishedSafetyKnowledge(publishedGraph, query),
      generateResponse: async (question, _mode, grounding) => {
        providerGrounding = grounding;
        return buildMockAskResponse(question, mockSearchResults.slice(0, 3), "mock", "general question");
      },
      getWorkpackRepository: () => null,
      getGenerationEvidenceSecret: () => undefined,
    });

    await handler({ question: "일반 정리 작업 문서팩", mode: "template" }, authContext);

    expect(providerGrounding).toBeUndefined();
  });

  test.each(FORGED_MCP_CASES)(
    "fails closed before the provider for a forged $field field on the $route route",
    async ({ route, mutate }) => {
      const provider = vi.fn(async (question: string) => buildMockAskResponse(
        question,
        mockSearchResults.slice(0, 3),
        "mock",
        "forged canonical pack must not reach provider",
      ));
      const reviewResponse = vi.fn(async () => ({
        reviewable: false as const,
        message: "review must not run",
        registeredTasks: [],
      }));
      const persistResponse = vi.fn(async () => null);
      const getWorkpackRepository = vi.fn(() => {
        throw new Error("plain persistence must not initialize");
      });
      const queryKnowledge = async (): Promise<SafetyKnowledgeResult> => {
        const knowledge = buildPublishedSafetyKnowledge(publishedGraph, "고소작업");
        if (!knowledge.found || !knowledge.evidenceContract) {
          throw new Error("expected canonical evidence pack");
        }
        const forgedPack = structuredClone(knowledge.evidenceContract);
        mutate(forgedPack);
        return {
          ...knowledge,
          evidenceContract: forgedPack,
          phaseAProduct: null,
        };
      };

      const result = route === "plain"
        ? await createGenerateSafetyDocpackHandler({
            defaultMode: "full",
            queryKnowledge,
            generateResponse: provider,
            getWorkpackRepository,
            getGenerationEvidenceSecret: () => undefined,
          })({ question: "고소작업", mode: "template" }, tenantAuthContext)
        : await createGenerateReviewedSafetyDocpackHandler({
            defaultMode: "full",
            queryKnowledge,
            generateResponse: provider,
            reviewResponse,
            persistResponse,
            getGenerationEvidenceSecret: () => undefined,
          })({
            question: "고소작업 문서팩",
            task: "고소작업",
            mode: "template",
          }, tenantAuthContext);

      expect(parseToolPayload(result)).toMatchObject({
        status: "review_required",
        evidenceChainState: "review_required",
        reason: "canonical_evidence_pack_mismatch",
        failClosed: true,
      });
      expect(provider).toHaveBeenCalledTimes(0);
      if (route === "plain") {
        expect(getWorkpackRepository).toHaveBeenCalledTimes(0);
      } else {
        expect(reviewResponse).toHaveBeenCalledTimes(0);
        expect(persistResponse).toHaveBeenCalledTimes(0);
      }
    },
  );

  test.each(MALFORMED_MCP_CASES)(
    "fails closed before every side effect for malformed $field on the $route route",
    async ({ route, mutate }) => {
      const provider = vi.fn(async (question: string) => buildMockAskResponse(
        question,
        mockSearchResults.slice(0, 3),
        "mock",
        "malformed canonical pack must not reach provider",
      ));
      const reviewResponse = vi.fn(async () => ({
        reviewable: false as const,
        message: "review must not run",
        registeredTasks: [],
      }));
      const persistResponse = vi.fn(async () => null);
      const getWorkpackRepository = vi.fn(() => {
        throw new Error("plain persistence must not initialize");
      });
      const queryKnowledge = async (): Promise<SafetyKnowledgeResult> => {
        const knowledge = buildPublishedSafetyKnowledge(publishedGraph, "고소작업");
        if (!knowledge.found || !knowledge.evidenceContract) {
          throw new Error("expected canonical evidence pack");
        }
        const malformedPack = structuredClone(knowledge.evidenceContract);
        mutate(malformedPack);
        return {
          ...knowledge,
          evidenceContract: malformedPack,
          phaseAProduct: null,
        };
      };

      const result = route === "plain"
        ? await createGenerateSafetyDocpackHandler({
            defaultMode: "full",
            queryKnowledge,
            generateResponse: provider,
            getWorkpackRepository,
            getGenerationEvidenceSecret: () => undefined,
          })({ question: "고소작업", mode: "template" }, tenantAuthContext)
        : await createGenerateReviewedSafetyDocpackHandler({
            defaultMode: "full",
            queryKnowledge,
            generateResponse: provider,
            reviewResponse,
            persistResponse,
            getGenerationEvidenceSecret: () => undefined,
          })({
            question: "고소작업 문서팩",
            task: "고소작업",
            mode: "template",
          }, tenantAuthContext);

      expect(parseToolPayload(result)).toMatchObject({
        status: "review_required",
        evidenceChainState: "review_required",
        reason: "canonical_evidence_pack_mismatch",
        failClosed: true,
      });
      expect(provider).toHaveBeenCalledTimes(0);
      if (route === "plain") {
        expect(getWorkpackRepository).toHaveBeenCalledTimes(0);
      } else {
        expect(reviewResponse).toHaveBeenCalledTimes(0);
        expect(persistResponse).toHaveBeenCalledTimes(0);
      }
    },
  );

  test.each([
    ["plain", createGenerateSafetyDocpackHandler, { question: "고소작업", mode: "template" }],
    ["reviewed", createGenerateReviewedSafetyDocpackHandler, {
      question: "고소작업 문서팩",
      task: "고소작업",
      mode: "template",
    }],
  ] as const)("surfaces %s MCP knowledge rejection without calling the provider", async (
    _label,
    createHandler,
    input,
  ) => {
    const provider = vi.fn();
    const knowledgeError = new Error("knowledge unavailable");
    const common = {
      defaultMode: "full" as const,
      queryKnowledge: async () => Promise.reject(knowledgeError),
      generateResponse: provider,
      getGenerationEvidenceSecret: () => undefined,
    };
    const handler = createHandler === createGenerateSafetyDocpackHandler
      ? createGenerateSafetyDocpackHandler({
          ...common,
          getWorkpackRepository: () => null,
        })
      : createGenerateReviewedSafetyDocpackHandler({
          ...common,
          reviewResponse: async () => { throw new Error("review must not run"); },
          persistResponse: async () => null,
        });

    await expect(handler(input as never, authContext)).rejects.toBe(knowledgeError);
    expect(provider).not.toHaveBeenCalled();
  });
});
