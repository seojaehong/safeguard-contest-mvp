import { describe, expect, it, vi } from "vitest";

import type { ClawChatEvent } from "@/lib/agent-loop";
import {
  BrokerError,
  ENGINE_ADAPTER_CONTRACT_VERSION,
  SAFECLAW_ENGINE_AUTHORITY,
  createGuardedEngineAdapter,
  createUnavailableEngineAdapter,
  resolveEngineMode,
  type BrokerRequestContext,
  type EngineAdapter,
} from "@/lib/engine-adapter";

const context: BrokerRequestContext = {
  userId: "user-1",
  organizationId: "org-1",
  siteId: "site-1",
  site: { siteName: "성수 현장", region: null, briefingQuestion: null },
};

const testMetadata = {
  contractVersion: ENGINE_ADAPTER_CONTRACT_VERSION,
  runtime: "unavailable" as const,
  authority: SAFECLAW_ENGINE_AUTHORITY,
};

function deferred(): { promise: Promise<void>; resolve: () => void } {
  let resolve = (): void => undefined;
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

function runInput() {
  return {
    context,
    prompt: "test",
    emit: (_event: ClawChatEvent): void => undefined,
    signal: new AbortController().signal,
  };
}

describe("engine adapter policy", () => {
  it("defaults to disabled and rejects local mode on Vercel", () => {
    expect(resolveEngineMode({})).toBe("disabled");
    expect(resolveEngineMode({ SAFECLAW_ENGINE_MODE: "local-openclaw", VERCEL: "1" })).toBe("disabled");
    expect(resolveEngineMode({ SAFECLAW_ENGINE_MODE: "local-openclaw" })).toBe("local-openclaw");
  });

  it("enables Hermes only as an explicit local experimental path", () => {
    expect(resolveEngineMode({ SAFECLAW_ENGINE_MODE: "experimental-hermes" })).toBe("disabled");
    expect(resolveEngineMode({
      SAFECLAW_ENGINE_MODE: "experimental-hermes",
      SAFECLAW_HERMES_LOCAL_POC: "1",
    })).toBe("experimental-hermes");
    expect(resolveEngineMode({
      SAFECLAW_ENGINE_MODE: "experimental-hermes",
      SAFECLAW_HERMES_LOCAL_POC: "1",
      VERCEL: "1",
    })).toBe("disabled");
  });

  it("exposes no executable capabilities until an enforcing sidecar exists", () => {
    expect(createUnavailableEngineAdapter().capabilities).toEqual([]);
  });

  it("publishes the versioned SafeClaw authority boundary on every adapter", () => {
    const engine = createUnavailableEngineAdapter();

    expect(engine).toMatchObject({
      contractVersion: "engine-adapter/v1",
      runtime: "unavailable",
      authority: {
        systemOfRecord: "safeclaw-mcp-db-harness",
        toolExecutionBoundary: "safeclaw-mcp-interceptor",
        canMutate: false,
        canPublish: false,
        humanConfirmationRequired: true,
      },
    });
    expect(createGuardedEngineAdapter(engine)).toMatchObject({
      contractVersion: "engine-adapter/v1",
      runtime: "unavailable",
      authority: engine.authority,
    });
  });

  it("uses a stable fail-closed unavailable adapter", async () => {
    const engine = createUnavailableEngineAdapter();
    await expect(engine.checkAvailability(context)).rejects.toMatchObject({
      code: "ENGINE_UNAVAILABLE",
      status: 503,
    });
    await expect(engine.run(runInput())).rejects.toBeInstanceOf(BrokerError);
  });

  it("treats the deferred relay mode as disabled instead of exposing partial config", () => {
    expect(resolveEngineMode({ SAFECLAW_ENGINE_MODE: "relay" })).toBe("disabled");
  });

  it("enforces one concurrent run per instance and releases the slot", async () => {
    const first = deferred();
    const base: EngineAdapter = {
      id: "blocking",
      ...testMetadata,
      capabilities: [],
      checkAvailability: async () => undefined,
      run: vi.fn(async () => first.promise),
    };
    const guarded = createGuardedEngineAdapter(base, { maxConcurrent: 1, timeoutMs: 5_000 });

    const firstRun = guarded.run(runInput());
    await expect(guarded.run(runInput())).rejects.toMatchObject({ code: "ENGINE_BUSY", status: 503 });
    first.resolve();
    await firstRun;
    await expect(guarded.run(runInput())).resolves.toBeUndefined();
  });

  it("aborts timed-out work and releases capacity for the next run", async () => {
    let calls = 0;
    const base: EngineAdapter = {
      id: "timeout",
      ...testMetadata,
      capabilities: [],
      checkAvailability: async () => undefined,
      run: vi.fn(async ({ signal }) => {
        calls += 1;
        if (calls > 1) return;
        await new Promise<void>((_resolve, reject) => {
          signal.addEventListener("abort", () => reject(signal.reason), { once: true });
        });
      }),
    };
    const guarded = createGuardedEngineAdapter(base, { maxConcurrent: 1, timeoutMs: 10 });

    await expect(guarded.run(runInput())).rejects.toMatchObject({ code: "ENGINE_TIMEOUT", status: 503 });
    await expect(guarded.run(runInput())).resolves.toBeUndefined();
  });

  it("counts availability preflight against the same maxConcurrent run slot", async () => {
    const firstPreflight = deferred();
    let activePreflights = 0;
    let maxActivePreflights = 0;
    let preflightCalls = 0;
    const base: EngineAdapter = {
      id: "preflight-blocking",
      ...testMetadata,
      capabilities: [],
      checkAvailability: async () => {
        preflightCalls += 1;
        activePreflights += 1;
        maxActivePreflights = Math.max(maxActivePreflights, activePreflights);
        try {
          if (preflightCalls === 1) await firstPreflight.promise;
        } finally {
          activePreflights -= 1;
        }
      },
      run: vi.fn(async () => undefined),
    };
    const guarded = createGuardedEngineAdapter(base, { maxConcurrent: 1, timeoutMs: 5_000 });

    const activeCheck = guarded.checkAvailability(context);
    await vi.waitFor(() => expect(activePreflights).toBe(1));
    const competingCheck = guarded.checkAvailability(context);
    const competingRun = guarded.run(runInput());
    firstPreflight.resolve();
    await expect(activeCheck).resolves.toBeUndefined();

    await expect(competingCheck).rejects.toMatchObject({ code: "ENGINE_BUSY", status: 503 });
    await expect(competingRun).rejects.toMatchObject({ code: "ENGINE_BUSY", status: 503 });
    expect(maxActivePreflights).toBe(1);
  });

  it("forwards caller aborts into availability preflight and releases the slot", async () => {
    let observedSignal: AbortSignal | undefined;
    const base: EngineAdapter = {
      id: "preflight-abort-aware",
      ...testMetadata,
      capabilities: [],
      checkAvailability: async (_context, signal) => {
        if (!signal) throw new Error("missing preflight signal");
        observedSignal = signal;
        await new Promise<void>((_resolve, reject) => {
          signal.addEventListener("abort", () => reject(signal.reason), { once: true });
        });
      },
      run: vi.fn(async () => undefined),
    };
    const guarded = createGuardedEngineAdapter(base, { maxConcurrent: 1, timeoutMs: 5_000 });
    const controller = new AbortController();
    const reason = new BrokerError("ENGINE_EXECUTION_FAILED", 500);

    const preflight = guarded.checkAvailability(context, controller.signal);
    void preflight.catch(() => undefined);
    await vi.waitFor(() => expect(observedSignal).toBeDefined());
    controller.abort(reason);

    await expect(preflight).rejects.toBe(reason);
    expect(observedSignal?.aborted).toBe(true);
    await expect(guarded.run(runInput())).resolves.toBeUndefined();
  });

  it("keeps the concurrency slot occupied until aborted execution confirms close", async () => {
    const childClosed = deferred();
    let abortObserved = false;
    const base: EngineAdapter = {
      id: "close-aware",
      ...testMetadata,
      capabilities: [],
      checkAvailability: async () => undefined,
      run: async ({ signal }) => {
        await new Promise<void>((_resolve, reject) => {
          signal.addEventListener("abort", () => {
            abortObserved = true;
            void childClosed.promise.then(() => reject(signal.reason));
          }, { once: true });
        });
      },
    };
    const guarded = createGuardedEngineAdapter(base, { maxConcurrent: 1, timeoutMs: 10 });
    const first = guarded.run(runInput());
    let settled = false;
    void first.catch(() => { settled = true; });

    await new Promise((resolve) => setTimeout(resolve, 25));
    expect(abortObserved).toBe(true);
    expect(settled).toBe(false);
    await expect(guarded.run(runInput())).rejects.toMatchObject({ code: "ENGINE_BUSY" });

    childClosed.resolve();
    await expect(first).rejects.toMatchObject({ code: "ENGINE_TIMEOUT" });
  });
});
