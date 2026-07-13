import { beforeEach, describe, expect, test, vi } from "vitest";

import { buildMockAskResponse, mockSearchResults } from "@/lib/mock-data";
import { assembleGraph } from "@/lib/ontology/graph-store";
import { SEED_EDGES, SEED_NODES } from "@/lib/ontology/seed/core-triples";

const mocks = vi.hoisted(() => ({
  loadGraph: vi.fn(),
  runAsk: vi.fn(),
}));

vi.mock("@/lib/ontology/graph-store", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/ontology/graph-store")>();
  return {
    ...actual,
    loadGraph: mocks.loadGraph,
  };
});

vi.mock("@/lib/search", () => ({
  runAsk: mocks.runAsk,
}));

import { runPhaseAGroundedAsk } from "@/lib/ontology/grounded-ask";

const firstSnapshot = assembleGraph(
  SEED_NODES.filter((node) => node.review_state === "published"),
  SEED_EDGES.filter((edge) => edge.review_state === "published"),
);
const differingSnapshot = assembleGraph([], []);

describe("Phase A request snapshot reuse", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.loadGraph
      .mockResolvedValueOnce({
        ok: true,
        configured: true,
        scope: "published",
        graph: firstSnapshot,
        message: "loaded first snapshot",
      })
      .mockResolvedValueOnce({
        ok: true,
        configured: true,
        scope: "published",
        graph: differingSnapshot,
        message: "loaded differing snapshot",
      });
    mocks.runAsk.mockResolvedValue(
      buildMockAskResponse(
        "차량계 하역운반기계 인접 작업",
        mockSearchResults.slice(0, 3),
        "mock",
        "snapshot reuse test",
      ),
    );
  });

  test("loads one published graph and passes that exact snapshot into runAsk", async () => {
    await runPhaseAGroundedAsk("차량계 하역운반기계 인접 작업", {
      aiMode: "enhanced",
    });

    expect(mocks.loadGraph).toHaveBeenCalledTimes(1);
    expect(mocks.runAsk).toHaveBeenCalledWith(
      "차량계 하역운반기계 인접 작업",
      expect.objectContaining({
        phaseAGraphSnapshot: firstSnapshot,
      }),
    );
  });
});
