import { describe, expect, it, vi } from "vitest";

import type { ClawChatEvent } from "@/lib/agent-loop";
import type { BrokerRequestContext } from "@/lib/engine-adapter";
import { createExperimentalHermesAdapter } from "@/lib/hermes-engine-adapter";
import { createProductionEngineAdapter } from "@/lib/openclaw-broker-route";

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

function runInput(emit: (event: ClawChatEvent) => void = () => undefined) {
  return {
    context,
    prompt: "오늘 작업 위험을 점검해줘",
    emit,
    signal: new AbortController().signal,
  };
}

describe("experimental Hermes EngineAdapter", () => {
  it("requires explicit local dependencies at the production composition boundary", () => {
    expect(createProductionEngineAdapter(localPocEnv)).toMatchObject({
      id: "unavailable",
      runtime: "unavailable",
    });

    const engine = createProductionEngineAdapter(localPocEnv, {
      experimentalHermes: {
        planner: async () => undefined,
        executeReadTool: async () => undefined,
      },
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
      planner: async () => undefined,
      executeReadTool: async () => undefined,
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

  it("delegates a read intent to the SafeClaw-owned executor with tenant context", async () => {
    const events: ClawChatEvent[] = [];
    const executeReadTool = vi.fn(async () => ({ packetId: "harness-packet-1" }));
    const engine = createExperimentalHermesAdapter({
      env: localPocEnv,
      executeReadTool,
      planner: async (plannerInput) => {
        expect(plannerInput).not.toHaveProperty("emit");
        const result = await plannerInput.requestReadTool({
          toolName: "run_safeclaw_harness_agent",
          input: { question: "고소작업" },
        });
        plannerInput.emitText(JSON.stringify(result));
      },
    });

    await expect(engine.checkAvailability(context)).resolves.toBeUndefined();
    await expect(engine.run(runInput((event) => events.push(event)))).resolves.toBeUndefined();

    expect(executeReadTool).toHaveBeenCalledWith(expect.objectContaining({
      context,
      toolName: "run_safeclaw_harness_agent",
      input: { question: "고소작업" },
    }));
    expect(events).toContainEqual({ kind: "text-delta", text: '{"packetId":"harness-packet-1"}' });
  });

  it.each([
    "generate_reviewed_safety_docpack",
    "generate_safety_docpack",
    "unknown_engine_tool",
  ])("rejects forbidden tool intent %s before the executor", async (toolName) => {
    const executeReadTool = vi.fn(async () => undefined);
    const engine = createExperimentalHermesAdapter({
      env: localPocEnv,
      executeReadTool,
      planner: async ({ requestReadTool }) => {
        await requestReadTool({ toolName, input: {} });
      },
    });

    await expect(engine.run(runInput())).rejects.toMatchObject({
      code: "ENGINE_TOOL_FORBIDDEN",
      status: 403,
    });
    expect(executeReadTool).not.toHaveBeenCalled();
  });

  it("fails closed when constructed outside the explicit local POC mode", async () => {
    const engine = createExperimentalHermesAdapter({
      env: { SAFECLAW_ENGINE_MODE: "experimental-hermes" },
      planner: async () => undefined,
      executeReadTool: async () => undefined,
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
