import { describe, expect, it, vi } from "vitest";

import type { ClawChatEvent } from "@/lib/agent-loop";
import {
  BrokerError,
  ENGINE_TOOL_EFFECTS,
  createGuardedEngineAdapter,
  createUnavailableEngineAdapter,
  parseRelayAdapterConfig,
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

  it("publishes only read, compute, and unpersisted draft effects", () => {
    expect(ENGINE_TOOL_EFFECTS).toEqual(["read", "compute", "draft_write"]);
    expect(ENGINE_TOOL_EFFECTS).not.toContain("db_write");
  });

  it("uses a stable fail-closed unavailable adapter", async () => {
    const engine = createUnavailableEngineAdapter();
    await expect(engine.checkAvailability(context)).rejects.toMatchObject({
      code: "ENGINE_UNAVAILABLE",
      status: 503,
    });
    await expect(engine.run(runInput())).rejects.toBeInstanceOf(BrokerError);
  });

  it("accepts only a fixed allowlisted HTTPS relay origin", () => {
    expect(parseRelayAdapterConfig({
      SAFECLAW_RELAY_ORIGIN: "https://relay.safeclaw.example",
      SAFECLAW_RELAY_ORIGIN_ALLOWLIST: "https://relay.safeclaw.example,https://backup.safeclaw.example",
      SAFECLAW_RELAY_SIGNING_KEY_ID: "broker-key-1",
    })).toEqual({
      origin: "https://relay.safeclaw.example",
      allowedOrigins: ["https://relay.safeclaw.example", "https://backup.safeclaw.example"],
      signingKeyId: "broker-key-1",
      maxTtlSeconds: 60,
    });

    expect(() => parseRelayAdapterConfig({
      SAFECLAW_RELAY_ORIGIN: "http://127.0.0.1:8787",
      SAFECLAW_RELAY_ORIGIN_ALLOWLIST: "http://127.0.0.1:8787",
      SAFECLAW_RELAY_SIGNING_KEY_ID: "broker-key-1",
    })).toThrow("RELAY_CONFIG_INVALID");
    expect(() => parseRelayAdapterConfig({
      SAFECLAW_RELAY_ORIGIN: "https://attacker.example",
      SAFECLAW_RELAY_ORIGIN_ALLOWLIST: "https://relay.safeclaw.example",
      SAFECLAW_RELAY_SIGNING_KEY_ID: "broker-key-1",
    })).toThrow("RELAY_CONFIG_INVALID");
  });

  it("enforces one concurrent run per instance and releases the slot", async () => {
    const first = deferred();
    const base: EngineAdapter = {
      id: "blocking",
      capabilities: ENGINE_TOOL_EFFECTS,
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
      capabilities: ENGINE_TOOL_EFFECTS,
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
});
