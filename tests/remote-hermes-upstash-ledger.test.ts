import { describe, expect, it, vi } from "vitest";

import {
  createConfiguredRemoteHermesAttemptLedger,
} from "@/lib/remote-hermes-upstash-ledger";
import type {
  RemoteHermesAttemptEnvelope,
  RemoteHermesTerminalRecord,
} from "@/lib/remote-hermes-contract";

const issuedAt = "2026-08-14T00:00:00.000Z";
const expiresAt = "2026-08-14T00:00:15.000Z";
const attemptDigest = "a".repeat(64);

function attempt(): RemoteHermesAttemptEnvelope {
  return {
    attemptId: "attempt-1",
    issuedAt,
    expiresAt,
    attemptEnvelopeDigest: attemptDigest,
  } as RemoteHermesAttemptEnvelope;
}

function terminal(): RemoteHermesTerminalRecord {
  return {
    organizationId: "org-private",
    siteId: "site-private",
    runId: "run-1",
    requestId: "request-1",
    attemptId: "attempt-1",
    logicalRequestDigest: "b".repeat(64),
    attemptEnvelopeDigest: attemptDigest,
    terminalStatus: "failure",
    latencyMs: 20,
    error: { code: "REMOTE_PROVIDER_UNAVAILABLE", origin: "gateway" },
  };
}

function environment() {
  return {
    SAFECLAW_REMOTE_HERMES_LEDGER_MODE: "upstash",
    UPSTASH_REDIS_REST_URL: "https://ledger.example.test",
    UPSTASH_REDIS_REST_TOKEN: "secret-token",
  };
}

function response(result: unknown): Response {
  return new Response(JSON.stringify({ result }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

describe("remote Hermes Upstash attempt ledger", () => {
  it("stays disabled unless the durable ledger is explicitly selected", () => {
    expect(createConfiguredRemoteHermesAttemptLedger({ environment: {} })).toBeUndefined();
    expect(createConfiguredRemoteHermesAttemptLedger({
      environment: {
        UPSTASH_REDIS_REST_URL: "https://ledger.example.test",
        UPSTASH_REDIS_REST_TOKEN: "secret-token",
      },
    })).toBeUndefined();
  });

  it("fails closed when explicit configuration is incomplete or unsafe", () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
    expect(createConfiguredRemoteHermesAttemptLedger({
      environment: { SAFECLAW_REMOTE_HERMES_LEDGER_MODE: "upstash" },
    })).toBeUndefined();
    expect(createConfiguredRemoteHermesAttemptLedger({
      environment: {
        SAFECLAW_REMOTE_HERMES_LEDGER_MODE: "upstash",
        UPSTASH_REDIS_REST_URL: "http://ledger.example.test",
        UPSTASH_REDIS_REST_TOKEN: "secret-token",
      },
    })).toBeUndefined();
    expect(error).toHaveBeenCalledTimes(2);
    error.mockRestore();
  });

  it("atomically reserves an attempt and returns a contract-valid receipt", async () => {
    let capturedInit: RequestInit | undefined;
    const fetchMock = vi.fn(async (
      _input: string | URL | Request,
      init?: RequestInit,
    ): Promise<Response> => {
      capturedInit = init;
      return response(1);
    });
    const ledger = createConfiguredRemoteHermesAttemptLedger({
      environment: environment(),
      fetchImpl: fetchMock as typeof fetch,
      now: () => new Date("2026-08-14T00:00:01.000Z"),
    });
    if (!ledger) throw new Error("expected configured ledger");

    const receipt = await ledger.reserve(attempt(), new AbortController().signal);

    expect(receipt).toMatchObject({
      receiptId: "ledger-attempt-1",
      attemptEnvelopeDigest: attemptDigest,
      reservedAt: "2026-08-14T00:00:01.000Z",
      receiptDigest: expect.stringMatching(/^[a-f0-9]{64}$/u),
    });
    expect(fetchMock).toHaveBeenCalledOnce();
    const body = String(capturedInit?.body);
    expect(body).toContain(`safeclaw:remote-hermes:v1:attempt:${attemptDigest}`);
    expect(body).not.toContain("org-private");
    expect(body).not.toContain("site-private");
  });

  it("rejects a duplicate atomic reservation", async () => {
    const ledger = createConfiguredRemoteHermesAttemptLedger({
      environment: environment(),
      fetchImpl: async () => response(0),
      now: () => new Date("2026-08-14T00:00:01.000Z"),
    });
    if (!ledger) throw new Error("expected configured ledger");

    await expect(ledger.reserve(attempt(), new AbortController().signal))
      .rejects.toThrow("already reserved");
  });

  it("persists only a terminal digest and preserves duplicate semantics", async () => {
    let capturedInit: RequestInit | undefined;
    const fetchMock = vi.fn(async (
      _input: string | URL | Request,
      init?: RequestInit,
    ): Promise<Response> => {
      capturedInit = init;
      return response(1);
    });
    const ledger = createConfiguredRemoteHermesAttemptLedger({
      environment: environment(),
      fetchImpl: fetchMock as typeof fetch,
    });
    if (!ledger) throw new Error("expected configured ledger");

    await expect(ledger.recordTerminal(terminal(), new AbortController().signal))
      .resolves.toBe("recorded");
    const body = String(capturedInit?.body);
    expect(body).toContain(`safeclaw:remote-hermes:v1:terminal:${attemptDigest}`);
    expect(body).toMatch(/[a-f0-9]{64}/u);
    expect(body).not.toContain("org-private");
    expect(body).not.toContain("site-private");

    const duplicate = createConfiguredRemoteHermesAttemptLedger({
      environment: environment(),
      fetchImpl: async () => response(0),
    });
    if (!duplicate) throw new Error("expected configured ledger");
    await expect(duplicate.recordTerminal(terminal(), new AbortController().signal))
      .resolves.toBe("duplicate");
  });

  it("fails closed when terminal persistence has no durable reservation", async () => {
    const ledger = createConfiguredRemoteHermesAttemptLedger({
      environment: environment(),
      fetchImpl: async () => response(-1),
    });
    if (!ledger) throw new Error("expected configured ledger");

    await expect(ledger.recordTerminal(terminal(), new AbortController().signal))
      .rejects.toThrow("no durable reservation");
  });

  it("propagates caller cancellation before opening the ledger network path", async () => {
    const fetchImpl = vi.fn<typeof fetch>();
    const ledger = createConfiguredRemoteHermesAttemptLedger({
      environment: environment(),
      fetchImpl,
      now: () => new Date("2026-08-14T00:00:01.000Z"),
    });
    if (!ledger) throw new Error("expected configured ledger");
    const controller = new AbortController();
    controller.abort(new Error("caller canceled"));

    await expect(ledger.reserve(attempt(), controller.signal)).rejects.toThrow("caller canceled");
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
