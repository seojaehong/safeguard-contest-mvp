import { describe, expect, it } from "vitest";

import type { ClawChatEvent } from "@/lib/agent-loop";
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

  it("routes the Evidence Harness through tenant-scoped SafeClaw composition", async () => {
    let harnessResult: unknown;
    const composition = createSafeClawHermesComposition(async ({ requestReadTool }) => {
      harnessResult = await requestReadTool({
        toolName: "run_safeclaw_harness_agent",
        input: { question: "성수동 외벽 도장 작업" },
      });
    });
    const engine = createProductionEngineAdapter(localPocEnv, {
      experimentalHermes: composition,
    });

    await engine.run(runInput());

    expect(harnessResult).toMatchObject({
      engine: "safeclaw-db-harness",
      auth: {
        source: "db",
        siteId: "site-1",
        orgId: "org-1",
        tokenBound: true,
      },
      packet: {
        generationContract: {
          llmRole: "naturalize_only",
          evidenceAuthority: "db_harness",
          fallbackChainAllowed: false,
          genericProseSubstitutionAllowed: false,
        },
      },
    });
  }, 15_000);

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
    const engine = createExperimentalHermesAdapter({
      env: localPocEnv,
      composition: createSafeClawHermesComposition(async (plannerInput) => {
        expect(plannerInput).not.toHaveProperty("emit");
        const result = await plannerInput.requestReadTool({
          toolName: "get_evidence_mapping",
          input: { docType: "riskAssessment" },
        });
        plannerInput.emitText(JSON.stringify(result));
      }),
    });

    await expect(engine.checkAvailability(context)).resolves.toBeUndefined();
    await expect(engine.run(runInput((event) => events.push(event)))).resolves.toBeUndefined();

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
    const engine = createExperimentalHermesAdapter({
      env: localPocEnv,
      composition: createSafeClawHermesComposition(async ({ requestReadTool }) => {
        await requestReadTool({ toolName, input: {} });
      }),
    });

    await expect(engine.run(runInput())).rejects.toMatchObject({
      code: "ENGINE_TOOL_FORBIDDEN",
      status: 403,
    });
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
