import { createHash } from "node:crypto";

import { describe, expect, it, vi } from "vitest";

import type { ClawChatEvent } from "@/lib/agent-loop";
import * as clawTools from "@/lib/claw-tools";
import { buildDbHarnessPacket } from "@/lib/db-harness";
import type { BrokerRequestContext } from "@/lib/engine-adapter";
import type {
  SafetyReferenceItem,
  SafetyReferenceSearchResult,
} from "@/lib/safety-reference-catalog";
import * as safetyReferenceServer from "@/lib/safety-reference-catalog-server";
import {
  createExperimentalHermesAdapter,
  createSafeClawHermesComposition,
} from "@/lib/hermes-engine-adapter";
import {
  createProductionEngineAdapter,
  type ProductionEngineAdapterDependencies,
} from "@/lib/openclaw-broker-route";

const context: BrokerRequestContext = {
  userId: "user-1",
  organizationId: "org-1",
  siteId: "site-1",
  site: { siteName: "성수 현장", region: "서울", briefingQuestion: null },
};

const localPocEnv = {
  SAFECLAW_ENGINE_MODE: "experimental-hermes",
  SAFECLAW_HERMES_LOCAL_POC: "1",
};

const executeClawTool = clawTools.executeClawTool;

function sifReference(): SafetyReferenceItem {
  return {
    id: "sif-1",
    source_id: "kosha-sif-archive",
    item_type: "sif-case",
    category: "건설",
    subcategory: null,
    title: "오늘 작업 위험 점검 SIF 추락 사례",
    summary: "오늘 작업의 추락 위험과 작업발판 점검 사례",
    body: "재해개요: 작업발판에서 추락했습니다. 위험성 감소대책: 난간을 확인하고 안전대를 체결합니다.",
    keywords: ["오늘", "작업", "위험", "점검", "추락"],
    risk_tags: ["추락"],
    primary_documents: ["위험성평가표", "TBM 브리핑", "TBM 기록"],
    controls: ["작업발판과 난간 확인", "안전대 체결"],
    evidence_role: "supporting",
    retrieval_source: "ranked",
  };
}

function verifiedKoshaReference(): SafetyReferenceItem {
  const body = "오늘 작업 전 작업발판, 난간, 안전대 상태를 점검합니다.";
  const officialUrl = "https://portal.kosha.or.kr/archive/resources/tech-support/search/all";
  return {
    ...sifReference(),
    id: "kosha-guide-1",
    source_id: "kosha-technical-guidelines",
    item_type: "technical-guideline",
    title: "G-67-2011 오늘 작업 위험 점검 기술지침",
    summary: "외벽 작업의 추락 예방 점검 지침",
    body,
    source_url: officialUrl,
    kosha_guide: {
      referenceId: "kosha-guide-1",
      stableDocumentKey: "G-67",
      version: "G-67-2011",
      quality: "accepted",
      lifecycle: "current",
      bodyKind: "native",
      anchors: [{ page: 1, excerpt: body }],
      evidenceRef: "KOSHA G-67-2011 p.1",
      directEligible: true,
      officialUrl,
      officialFileId: "fixture-kosha-guide-1",
      publicationDate: "2011-01-01",
      officialVersion: "G-67-2011",
      officialStatus: "current",
      pdfSha256: "b".repeat(64),
      bodySha256: createHash("sha256").update(body).digest("hex"),
    },
  };
}

function groundedHarnessResult(question = "오늘 작업 위험을 점검해줘") {
  const packet = buildDbHarnessPacket({
    question,
    references: [sifReference(), verifiedKoshaReference()],
    retrieval: { mode: "ranked-rpc", message: "required evidence resolved" },
  });
  return {
    engine: "safeclaw-db-harness" as const,
    packet,
    referenceSearch: [
      { source: "sif_cases", ok: true, configured: true, count: 1, retrievalMode: "ranked-rpc" },
      { source: "supporting_evidence", ok: true, configured: true, count: 1, retrievalMode: "ranked-rpc" },
    ],
  };
}

function searchResult(
  query: string,
  items: SafetyReferenceItem[],
  overrides: Partial<SafetyReferenceSearchResult> = {},
): SafetyReferenceSearchResult {
  return {
    ok: true,
    configured: true,
    query,
    count: items.length,
    items,
    retrievalMode: "ranked-rpc",
    vectorSearch: {
      enabled: false,
      attempted: false,
      ok: false,
      reason: "disabled",
      count: 0,
      model: "text-embedding-3-small",
      message: "vector disabled",
    },
    message: "controlled search boundary",
    ...overrides,
  };
}

function mockHarnessPreload() {
  const harnessResult = groundedHarnessResult();
  return vi.spyOn(clawTools, "executeClawTool").mockImplementation(
    async (toolName, input, authContext) => toolName === "run_safeclaw_harness_agent"
      ? harnessResult
      : executeClawTool(toolName, input, authContext),
  );
}

function freezeRecursivelyForTest<T>(value: T): T {
  if (typeof value === "object" && value !== null && !Object.isFrozen(value)) {
    for (const child of Object.values(value)) freezeRecursivelyForTest(child);
    Object.freeze(value);
  }
  return value;
}

function runInput(emit: (event: ClawChatEvent) => void = () => undefined) {
  return {
    context,
    prompt: "오늘 작업 위험을 점검해줘",
    emit,
    signal: new AbortController().signal,
  };
}

describe("experimental Hermes EngineAdapter", () => {
  if (false) {
    const arbitraryExecutorComposition = {
      planner: async () => undefined,
      executeReadTool: async () => undefined,
    };
    createProductionEngineAdapter(localPocEnv, {
      // @ts-expect-error arbitrary executor injection is outside the public composition contract
      experimentalHermes: arbitraryExecutorComposition,
    });
  }

  it("rejects an arbitrarily injected read executor at runtime", () => {
    const forgedDependencies = {
      experimentalHermes: {
        planner: async () => undefined,
        executeReadTool: async () => undefined,
      },
    } as unknown as ProductionEngineAdapterDependencies;

    expect(() => createProductionEngineAdapter(localPocEnv, forgedDependencies)).toThrowError(
      expect.objectContaining({
        code: "ENGINE_EXECUTION_ATTESTATION_UNPROVEN",
        status: 503,
      }),
    );
  });

  it("preloads the Evidence Harness packet exactly before planner execution", async () => {
    const order: string[] = [];
    const harnessResult = groundedHarnessResult();
    const executeSpy = vi.spyOn(clawTools, "executeClawTool").mockImplementation(async (toolName) => {
      expect(toolName).toBe("run_safeclaw_harness_agent");
      order.push("harness");
      return harnessResult;
    });
    const composition = createSafeClawHermesComposition(async ({ evidencePacket }) => {
      order.push("planner");
      expect(evidencePacket).toStrictEqual(harnessResult.packet);
    });
    const engine = createProductionEngineAdapter(localPocEnv, {
      experimentalHermes: composition,
    });

    let harnessCalls = 0;
    try {
      await engine.run(runInput());
      harnessCalls = executeSpy.mock.calls.length;
    } finally {
      executeSpy.mockRestore();
    }

    expect(order).toEqual(["harness", "planner"]);
    expect(harnessCalls).toBe(1);
  }, 15_000);

  it("accepts the production executeClawTool Harness packet with controlled grounded searches", async () => {
    const searchSpy = vi.spyOn(safetyReferenceServer, "searchSafetyReferences").mockImplementation(
      async (options) => {
        if (options.itemType === "sif-case") {
          return searchResult(options.query, [sifReference()]);
        }
        if (options.evidenceRole === "supporting") {
          return searchResult(options.query, [verifiedKoshaReference()]);
        }
        return searchResult(options.query, []);
      },
    );
    let plannerCalls = 0;
    const engine = createExperimentalHermesAdapter({
      env: localPocEnv,
      composition: createSafeClawHermesComposition(async ({ evidencePacket }) => {
        plannerCalls += 1;
        expect(evidencePacket.sifCases).toHaveLength(1);
        expect(evidencePacket.supportingEvidence.some(
          (item) => item.item_type === "technical-guideline",
        )).toBe(true);
        expect(evidencePacket.ontologyChecklist.status).toBe("ready");
      }),
    });

    let searchCalls = 0;
    try {
      await expect(engine.run(runInput())).resolves.toBeUndefined();
      searchCalls = searchSpy.mock.calls.length;
    } finally {
      searchSpy.mockRestore();
    }

    expect(searchCalls).toBe(3);
    expect(plannerCalls).toBe(1);
  });

  it.each([
    {
      name: "empty searches",
      result: (query: string) => searchResult(query, []),
    },
    {
      name: "failed searches",
      result: (query: string) => searchResult(query, [], {
        ok: false,
        errorCode: "safety_reference_search_failed",
        retrievalMode: "unconfigured",
        message: "controlled search failure",
      }),
    },
  ])("blocks planner on production Harness $name", async ({ result }) => {
    const searchSpy = vi.spyOn(safetyReferenceServer, "searchSafetyReferences").mockImplementation(
      async (options) => result(options.query),
    );
    let plannerCalls = 0;
    const events: ClawChatEvent[] = [];
    const engine = createExperimentalHermesAdapter({
      env: localPocEnv,
      composition: createSafeClawHermesComposition(async () => {
        plannerCalls += 1;
      }),
    });

    let searchCalls = 0;
    try {
      await expect(engine.run(runInput((event) => events.push(event)))).rejects.toMatchObject({
        code: "ENGINE_EXECUTION_ATTESTATION_UNPROVEN",
        status: 503,
      });
      searchCalls = searchSpy.mock.calls.length;
    } finally {
      searchSpy.mockRestore();
    }

    expect(searchCalls).toBe(3);
    expect(plannerCalls).toBe(0);
    expect(events).toEqual([]);
  });

  it("fails closed before planner and output when Evidence Harness retrieval fails", async () => {
    const executeSpy = vi.spyOn(clawTools, "executeClawTool").mockRejectedValueOnce(
      new Error("harness unavailable"),
    );
    let plannerCalled = false;
    const events: ClawChatEvent[] = [];
    const engine = createExperimentalHermesAdapter({
      env: localPocEnv,
      composition: createSafeClawHermesComposition(async ({ emitText, evidencePacket }) => {
        plannerCalled = true;
        emitText({ text: "근거 없는 출력", evidencePacket });
      }),
    });

    try {
      await expect(engine.run(runInput((event) => events.push(event)))).rejects.toMatchObject({
        code: "ENGINE_EXECUTION_FAILED",
        status: 500,
      });
    } finally {
      executeSpy.mockRestore();
    }

    expect(plannerCalled).toBe(false);
    expect(events).toEqual([]);
  });

  it("fails closed before planner when the resolved Harness packet is empty", async () => {
    const packet = buildDbHarnessPacket({
      question: "오늘 작업 위험을 점검해줘",
      references: [],
    });
    const executeSpy = vi.spyOn(clawTools, "executeClawTool").mockResolvedValueOnce({
      engine: "safeclaw-db-harness",
      packet,
      referenceSearch: [
        { source: "sif_cases", ok: true, configured: true, count: 0, retrievalMode: "unconfigured" },
        { source: "supporting_evidence", ok: true, configured: true, count: 0, retrievalMode: "unconfigured" },
      ],
    });
    let plannerCalls = 0;
    const events: ClawChatEvent[] = [];
    const engine = createExperimentalHermesAdapter({
      env: localPocEnv,
      composition: createSafeClawHermesComposition(async () => {
        plannerCalls += 1;
      }),
    });

    try {
      await expect(engine.run(runInput((event) => events.push(event)))).rejects.toMatchObject({
        code: "ENGINE_EXECUTION_ATTESTATION_UNPROVEN",
        status: 503,
      });
    } finally {
      executeSpy.mockRestore();
    }

    expect(plannerCalls).toBe(0);
    expect(events).toEqual([]);
  });

  it("fails closed before planner when required Harness retrieval resolves ok false", async () => {
    const harnessResult = groundedHarnessResult();
    harnessResult.referenceSearch[0] = {
      source: "sif_cases",
      ok: false,
      configured: true,
      count: 0,
      retrievalMode: "ranked-rpc",
    };
    const executeSpy = vi.spyOn(clawTools, "executeClawTool").mockResolvedValueOnce(harnessResult);
    let plannerCalls = 0;
    const events: ClawChatEvent[] = [];
    const engine = createExperimentalHermesAdapter({
      env: localPocEnv,
      composition: createSafeClawHermesComposition(async () => {
        plannerCalls += 1;
      }),
    });

    try {
      await expect(engine.run(runInput((event) => events.push(event)))).rejects.toMatchObject({
        code: "ENGINE_EXECUTION_ATTESTATION_UNPROVEN",
        status: 503,
      });
    } finally {
      executeSpy.mockRestore();
    }

    expect(plannerCalls).toBe(0);
    expect(events).toEqual([]);
  });

  it("fails closed before planner when the Harness packet belongs to another question", async () => {
    const executeSpy = vi.spyOn(clawTools, "executeClawTool").mockResolvedValueOnce(
      groundedHarnessResult("다른 작업 질문"),
    );
    let plannerCalls = 0;
    const events: ClawChatEvent[] = [];
    const engine = createExperimentalHermesAdapter({
      env: localPocEnv,
      composition: createSafeClawHermesComposition(async () => {
        plannerCalls += 1;
      }),
    });

    try {
      await expect(engine.run(runInput((event) => events.push(event)))).rejects.toMatchObject({
        code: "ENGINE_EXECUTION_ATTESTATION_UNPROVEN",
        status: 503,
      });
    } finally {
      executeSpy.mockRestore();
    }

    expect(plannerCalls).toBe(0);
    expect(events).toEqual([]);
  });

  it("binds the Harness question to the trimmed current prompt", async () => {
    const executeSpy = vi.spyOn(clawTools, "executeClawTool").mockResolvedValueOnce(
      groundedHarnessResult(),
    );
    let plannerCalls = 0;
    const engine = createExperimentalHermesAdapter({
      env: localPocEnv,
      composition: createSafeClawHermesComposition(async ({ evidencePacket }) => {
        plannerCalls += 1;
        expect(evidencePacket.question).toBe("오늘 작업 위험을 점검해줘");
      }),
    });

    try {
      await expect(engine.run({
        ...runInput(),
        prompt: "  오늘 작업 위험을 점검해줘  ",
      })).resolves.toBeUndefined();
    } finally {
      executeSpy.mockRestore();
    }

    expect(plannerCalls).toBe(1);
  });

  it("fails closed before planner when the Harness packet is partial", async () => {
    const harnessResult = groundedHarnessResult();
    const executeSpy = vi.spyOn(clawTools, "executeClawTool").mockResolvedValueOnce({
      ...harnessResult,
      packet: {
        ...harnessResult.packet,
        retrievalContract: undefined,
      },
    });
    let plannerCalls = 0;
    const events: ClawChatEvent[] = [];
    const engine = createExperimentalHermesAdapter({
      env: localPocEnv,
      composition: createSafeClawHermesComposition(async () => {
        plannerCalls += 1;
      }),
    });

    try {
      await expect(engine.run(runInput((event) => events.push(event)))).rejects.toMatchObject({
        code: "ENGINE_EXECUTION_ATTESTATION_UNPROVEN",
        status: 503,
      });
    } finally {
      executeSpy.mockRestore();
    }

    expect(plannerCalls).toBe(0);
    expect(events).toEqual([]);
  });

  it("fails closed before planner when required retrieval status is partial", async () => {
    const harnessResult = groundedHarnessResult();
    const executeSpy = vi.spyOn(clawTools, "executeClawTool").mockResolvedValueOnce({
      ...harnessResult,
      packet: {
        ...harnessResult.packet,
        retrievalContract: {
          ...harnessResult.packet.retrievalContract,
          vector: undefined,
        },
      },
    });
    let plannerCalls = 0;
    const engine = createExperimentalHermesAdapter({
      env: localPocEnv,
      composition: createSafeClawHermesComposition(async () => {
        plannerCalls += 1;
      }),
    });

    try {
      await expect(engine.run(runInput())).rejects.toMatchObject({
        code: "ENGINE_EXECUTION_ATTESTATION_UNPROVEN",
        status: 503,
      });
    } finally {
      executeSpy.mockRestore();
    }

    expect(plannerCalls).toBe(0);
  });

  it("fails closed before planner when KOSHA evidence is unresolved", async () => {
    const unresolvedKosha = verifiedKoshaReference();
    if (!unresolvedKosha.kosha_guide) throw new Error("test fixture requires KOSHA metadata");
    unresolvedKosha.kosha_guide.quality = "review_required";
    const packet = buildDbHarnessPacket({
      question: "오늘 작업 위험을 점검해줘",
      references: [sifReference(), unresolvedKosha],
      retrieval: { mode: "ranked-rpc", message: "unresolved KOSHA evidence" },
    });
    const executeSpy = vi.spyOn(clawTools, "executeClawTool").mockResolvedValueOnce({
      ...groundedHarnessResult(),
      packet,
    });
    let plannerCalls = 0;
    const engine = createExperimentalHermesAdapter({
      env: localPocEnv,
      composition: createSafeClawHermesComposition(async () => {
        plannerCalls += 1;
      }),
    });

    try {
      await expect(engine.run(runInput())).rejects.toMatchObject({
        code: "ENGINE_EXECUTION_ATTESTATION_UNPROVEN",
        status: 503,
      });
    } finally {
      executeSpy.mockRestore();
    }

    expect(plannerCalls).toBe(0);
  });

  it("blocks output when planner mutates the same attested packet object", async () => {
    const executeSpy = vi.spyOn(clawTools, "executeClawTool").mockResolvedValueOnce(
      groundedHarnessResult(),
    );
    const events: ClawChatEvent[] = [];
    const engine = createExperimentalHermesAdapter({
      env: localPocEnv,
      composition: createSafeClawHermesComposition(async ({ evidencePacket, emitText }) => {
        expect(Object.isFrozen(evidencePacket)).toBe(true);
        expect(Object.isFrozen(evidencePacket.retrievalContract)).toBe(true);
        (evidencePacket as unknown as { question: string }).question = "planner가 바꾼 질문";
        emitText({ text: "변조된 packet 출력", evidencePacket });
      }),
    });

    try {
      await expect(engine.run(runInput((event) => events.push(event)))).rejects.toBeDefined();
    } finally {
      executeSpy.mockRestore();
    }

    expect(events).toEqual([]);
  });

  it("blocks output when planner returns a different-question packet", async () => {
    const executeSpy = vi.spyOn(clawTools, "executeClawTool").mockResolvedValueOnce(
      groundedHarnessResult(),
    );
    const events: ClawChatEvent[] = [];
    const engine = createExperimentalHermesAdapter({
      env: localPocEnv,
      composition: createSafeClawHermesComposition(async ({ evidencePacket, emitText }) => {
        const otherQuestionPacket = structuredClone(evidencePacket);
        (otherQuestionPacket as unknown as { question: string }).question = "다른 질문";
        emitText({ text: "다른 질문 packet 출력", evidencePacket: otherQuestionPacket });
      }),
    });

    try {
      await expect(engine.run(runInput((event) => events.push(event)))).rejects.toMatchObject({
        code: "ENGINE_EXECUTION_ATTESTATION_UNPROVEN",
        status: 503,
      });
    } finally {
      executeSpy.mockRestore();
    }

    expect(events).toEqual([]);
  });

  it("rejects planner output that resubmits the planner input packet object", async () => {
    const executeSpy = vi.spyOn(clawTools, "executeClawTool").mockResolvedValueOnce(
      groundedHarnessResult(),
    );
    const events: ClawChatEvent[] = [];
    const engine = createExperimentalHermesAdapter({
      env: localPocEnv,
      composition: createSafeClawHermesComposition(async ({ evidencePacket, emitText }) => {
        emitText({ text: "same object", evidencePacket });
      }),
    });

    try {
      await expect(engine.run(runInput((event) => events.push(event)))).rejects.toMatchObject({
        code: "ENGINE_EXECUTION_ATTESTATION_UNPROVEN",
        status: 503,
      });
    } finally {
      executeSpy.mockRestore();
    }

    expect(events).toEqual([]);
  });

  it("rejects a mutable deep clone with the same attested packet content", async () => {
    const executeSpy = vi.spyOn(clawTools, "executeClawTool").mockResolvedValueOnce(
      groundedHarnessResult(),
    );
    const events: ClawChatEvent[] = [];
    const engine = createExperimentalHermesAdapter({
      env: localPocEnv,
      composition: createSafeClawHermesComposition(async ({ evidencePacket, emitText }) => {
        emitText({ text: "attested output", evidencePacket: structuredClone(evidencePacket) });
      }),
    });

    try {
      await expect(engine.run(runInput((event) => events.push(event)))).rejects.toMatchObject({
        code: "ENGINE_EXECUTION_ATTESTATION_UNPROVEN",
        status: 503,
      });
    } finally {
      executeSpy.mockRestore();
    }

    expect(events).toEqual([]);
  });

  it("rejects a separate packet with only its root object frozen", async () => {
    const executeSpy = vi.spyOn(clawTools, "executeClawTool").mockResolvedValueOnce(
      groundedHarnessResult(),
    );
    const events: ClawChatEvent[] = [];
    const engine = createExperimentalHermesAdapter({
      env: localPocEnv,
      composition: createSafeClawHermesComposition(async ({ evidencePacket, emitText }) => {
        const rootOnlyFrozen = structuredClone(evidencePacket);
        Object.freeze(rootOnlyFrozen);
        expect(Object.isFrozen(rootOnlyFrozen)).toBe(true);
        expect(Object.isFrozen(rootOnlyFrozen.sifCases)).toBe(false);
        emitText({ text: "root only", evidencePacket: rootOnlyFrozen });
      }),
    });

    try {
      await expect(engine.run(runInput((event) => events.push(event)))).rejects.toMatchObject({
        code: "ENGINE_EXECUTION_ATTESTATION_UNPROVEN",
        status: 503,
      });
    } finally {
      executeSpy.mockRestore();
    }

    expect(events).toEqual([]);
  });

  it("accepts a recursively frozen separate packet with attested content", async () => {
    const executeSpy = vi.spyOn(clawTools, "executeClawTool").mockResolvedValueOnce(
      groundedHarnessResult(),
    );
    const events: ClawChatEvent[] = [];
    const engine = createExperimentalHermesAdapter({
      env: localPocEnv,
      composition: createSafeClawHermesComposition(async ({ evidencePacket, emitText }) => {
        const frozenClone = freezeRecursivelyForTest(structuredClone(evidencePacket));
        expect(frozenClone).not.toBe(evidencePacket);
        expect(Object.isFrozen(frozenClone)).toBe(true);
        expect(Object.isFrozen(frozenClone.sifCases)).toBe(true);
        expect(Object.isFrozen(frozenClone.sifCases[0]?.controls)).toBe(true);
        emitText({ text: "attested output", evidencePacket: frozenClone });
      }),
    });

    try {
      await expect(engine.run(runInput((event) => events.push(event)))).resolves.toBeUndefined();
    } finally {
      executeSpy.mockRestore();
    }

    expect(events).toContainEqual({ kind: "text-delta", text: "attested output" });
  });

  it("rejects planner text emitted without the required Evidence Harness packet", async () => {
    const executeSpy = vi.spyOn(clawTools, "executeClawTool").mockResolvedValueOnce(
      groundedHarnessResult(),
    );
    const events: ClawChatEvent[] = [];
    const engine = createExperimentalHermesAdapter({
      env: localPocEnv,
      composition: createSafeClawHermesComposition(async ({ emitText }) => {
        (emitText as unknown as (text: string) => void)("packet 증명 없는 출력");
      }),
    });

    try {
      await expect(engine.run(runInput((event) => events.push(event)))).rejects.toMatchObject({
        code: "ENGINE_EXECUTION_ATTESTATION_UNPROVEN",
        status: 503,
      });
    } finally {
      executeSpy.mockRestore();
    }

    expect(events).toEqual([]);
  });

  it("attributes scoped Harness access to broker-authenticated site and organization", async () => {
    const composition = createSafeClawHermesComposition(async () => undefined);

    const result = await composition.readExecutor.execute({
      context,
      toolName: "run_safeclaw_harness_agent",
      input: { question: "성수동 외벽 도장 작업" },
      signal: new AbortController().signal,
    });

    expect(result).toMatchObject({
      auth: {
        source: "broker",
        siteId: "site-1",
        orgId: "org-1",
        tokenBound: false,
      },
    });
    expect((result as { auth: object }).auth).not.toHaveProperty("userId");
  }, 15_000);

  it("reserves the Evidence Harness for the mandatory adapter preload", async () => {
    const executeSpy = vi.spyOn(clawTools, "executeClawTool").mockResolvedValue(
      groundedHarnessResult(),
    );
    const engine = createExperimentalHermesAdapter({
      env: localPocEnv,
      composition: createSafeClawHermesComposition(async ({ requestReadTool }) => {
        await requestReadTool({
          toolName: "run_safeclaw_harness_agent",
          input: { question: "planner 재조회" },
        });
      }),
    });

    let calls = 0;
    try {
      await expect(engine.run(runInput())).rejects.toMatchObject({
        code: "ENGINE_TOOL_FORBIDDEN",
        status: 403,
      });
      calls = executeSpy.mock.calls.length;
    } finally {
      executeSpy.mockRestore();
    }

    expect(calls).toBe(1);
  });

  it("requires explicit local dependencies at the production composition boundary", () => {
    expect(createProductionEngineAdapter(localPocEnv)).toMatchObject({
      id: "unavailable",
      runtime: "unavailable",
    });

    const engine = createProductionEngineAdapter(localPocEnv, {
      experimentalHermes: createSafeClawHermesComposition(async () => undefined),
    });

    expect(engine).toMatchObject({
      id: "experimental-hermes",
      runtime: "hermes",
      contractVersion: "engine-adapter/v1",
    });
  });

  it("identifies itself as a versioned engine with no mutation or publish authority", () => {
    const engine = createExperimentalHermesAdapter({
      env: localPocEnv,
      composition: createSafeClawHermesComposition(async () => undefined),
    });

    expect(engine).toMatchObject({
      id: "experimental-hermes",
      contractVersion: "engine-adapter/v1",
      runtime: "hermes",
      capabilities: ["stream_text", "request_read_tool"],
      authority: {
        systemOfRecord: "safeclaw-mcp-db-harness",
        toolExecutionBoundary: "safeclaw-mcp-interceptor",
        canMutate: false,
        canPublish: false,
        humanConfirmationRequired: true,
      },
    });
  });

  it("streams a fixed SafeClaw read-tool result as text only", async () => {
    const events: ClawChatEvent[] = [];
    const executeSpy = mockHarnessPreload();
    const engine = createExperimentalHermesAdapter({
      env: localPocEnv,
      composition: createSafeClawHermesComposition(async (plannerInput) => {
        expect(plannerInput).not.toHaveProperty("emit");
        const result = await plannerInput.requestReadTool({
          toolName: "get_evidence_mapping",
          input: { docType: "riskAssessment" },
        });
        plannerInput.emitText({
          text: JSON.stringify(result),
          evidencePacket: freezeRecursivelyForTest(structuredClone(plannerInput.evidencePacket)),
        });
      }),
    });

    try {
      await expect(engine.checkAvailability(context)).resolves.toBeUndefined();
      await expect(engine.run(runInput((event) => events.push(event)))).resolves.toBeUndefined();
    } finally {
      executeSpy.mockRestore();
    }

    expect(events).toContainEqual(expect.objectContaining({
      kind: "text-delta",
      text: expect.stringContaining("riskAssessment"),
    }));
  });

  it.each([
    "generate_reviewed_safety_docpack",
    "generate_safety_docpack",
    "publish_organization_knowledge",
    "unknown_engine_tool",
  ])("rejects forbidden tool intent %s before the executor", async (toolName) => {
    const executeSpy = mockHarnessPreload();
    const engine = createExperimentalHermesAdapter({
      env: localPocEnv,
      composition: createSafeClawHermesComposition(async ({ requestReadTool }) => {
        await requestReadTool({ toolName, input: {} });
      }),
    });

    try {
      await expect(engine.run(runInput())).rejects.toMatchObject({
        code: "ENGINE_TOOL_FORBIDDEN",
        status: 403,
      });
    } finally {
      executeSpy.mockRestore();
    }
  });

  it("fails closed when constructed outside the explicit local POC mode", async () => {
    const engine = createExperimentalHermesAdapter({
      env: { SAFECLAW_ENGINE_MODE: "experimental-hermes" },
      composition: createSafeClawHermesComposition(async () => undefined),
    });

    await expect(engine.checkAvailability(context)).rejects.toMatchObject({
      code: "ENGINE_UNAVAILABLE",
      status: 503,
    });
    await expect(engine.run(runInput())).rejects.toMatchObject({
      code: "ENGINE_UNAVAILABLE",
      status: 503,
    });
  });
});
