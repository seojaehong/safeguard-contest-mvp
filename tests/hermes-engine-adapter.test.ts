import { describe, expect, it, vi } from "vitest";

import type { ClawChatEvent } from "@/lib/agent-loop";
import * as clawTools from "@/lib/claw-tools";
import { buildDbHarnessPacket } from "@/lib/db-harness";
import type { BrokerRequestContext } from "@/lib/engine-adapter";
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

function mockHarnessPreload() {
  const packet = buildDbHarnessPacket({ question: "오늘 작업 위험을 점검해줘", references: [] });
  return vi.spyOn(clawTools, "executeClawTool").mockImplementation(
    async (toolName, input, authContext) => toolName === "run_safeclaw_harness_agent"
      ? { engine: "safeclaw-db-harness", packet }
      : executeClawTool(toolName, input, authContext),
  );
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
    const packet = buildDbHarnessPacket({
      question: "오늘 작업 위험을 점검해줘",
      references: [],
    });
    const executeSpy = vi.spyOn(clawTools, "executeClawTool").mockImplementation(async (toolName) => {
      expect(toolName).toBe("run_safeclaw_harness_agent");
      order.push("harness");
      return { engine: "safeclaw-db-harness", packet };
    });
    const composition = createSafeClawHermesComposition(async ({ evidencePacket }) => {
      order.push("planner");
      expect(evidencePacket).toStrictEqual(packet);
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

  it("rejects planner text emitted without the required Evidence Harness packet", async () => {
    const packet = buildDbHarnessPacket({ question: "근거 확인", references: [] });
    const executeSpy = vi.spyOn(clawTools, "executeClawTool").mockResolvedValueOnce({
      engine: "safeclaw-db-harness",
      packet,
    });
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
    const packet = buildDbHarnessPacket({ question: "근거 확인", references: [] });
    const executeSpy = vi.spyOn(clawTools, "executeClawTool").mockResolvedValue({
      engine: "safeclaw-db-harness",
      packet,
    });
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
          evidencePacket: plannerInput.evidencePacket,
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
