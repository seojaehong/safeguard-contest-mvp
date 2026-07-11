import { describe, expect, it, vi } from "vitest";

import type { ClawChatEvent } from "@/lib/agent-loop";
import {
  BrokerError,
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

  it("exposes no executable capabilities until an enforcing sidecar exists", () => {
    expect(createUnavailableEngineAdapter().capabilities).toEqual([]);
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

  it("keeps the concurrency slot occupied until aborted execution confirms close", async () => {
    const childClosed = deferred();
    let abortObserved = false;
    const base: EngineAdapter = {
      id: "close-aware",
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
