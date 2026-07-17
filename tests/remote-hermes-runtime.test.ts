import { describe, expect, it, vi } from "vitest";

import { buildDbHarnessPacket } from "@/lib/db-harness";
import type { HermesPlannerInput, HermesPlannerTextOutput } from "@/lib/hermes-engine-adapter";
import {
  digestRemoteHermesValue,
  createRemoteHermesPolicyAttestation,
  signRemoteHermesDigest,
  type RemoteHermesAttemptEnvelope,
  type RemoteHermesTerminalRecord,
} from "@/lib/remote-hermes-contract";
import {
  createRemoteHermesRuntime,
  readRemoteHermesResponseBody,
  REMOTE_HERMES_EXECUTION_TIMEOUT_MS,
  REMOTE_HERMES_TERMINAL_PERSIST_TIMEOUT_MS,
  type RemoteHermesAttemptLedger,
  type RemoteHermesRuntimeDependencies,
  type RemoteHermesTrustedConnection,
} from "@/lib/remote-hermes-runtime";

const now = new Date("2026-07-16T14:59:00.000Z");
const SAFE_DIAGNOSTICS_REF = `diag_${"a".repeat(64)}`;

type AttemptReceipt = {
  version: "remote-hermes-attempt-ledger-receipt/v1";
  receiptId: string;
  attemptEnvelopeDigest: string;
  reservedAt: string;
  receiptDigest: string;
};

function remoteEnv(): Record<string, string> {
  return {
    SAFECLAW_REMOTE_HERMES_ENDPOINT: "https://hermes.example.test/v1/naturalize",
    SAFECLAW_REMOTE_HERMES_HOST_ALLOWLIST: "hermes.example.test",
    SAFECLAW_REMOTE_HERMES_TENANT_ALLOWLIST: "org-1:site-1",
    SAFECLAW_REMOTE_HERMES_ISSUER: "safeclaw-control-plane",
    SAFECLAW_REMOTE_HERMES_AUDIENCE: "hermes-gateway",
    SAFECLAW_REMOTE_HERMES_REQUEST_KEY_ID: "safeclaw-request-key",
    SAFECLAW_REMOTE_HERMES_REQUEST_SIGNING_SECRET: "s".repeat(32),
    SAFECLAW_REMOTE_HERMES_SERVICE_ID: "hermes-service",
    SAFECLAW_REMOTE_HERMES_RESPONSE_KEY_ID: "hermes-response-key",
    SAFECLAW_REMOTE_HERMES_RESPONSE_VERIFICATION_SECRET: "v".repeat(32),
    SAFECLAW_REMOTE_HERMES_POLICY_ATTESTATION: JSON.stringify(createRemoteHermesPolicyAttestation({
      serviceId: "hermes-service",
      endpointOrigin: "https://hermes.example.test",
      issuedAt: "2026-07-16T14:58:59.000Z",
      expiresAt: "2026-07-16T15:59:00.000Z",
      keyId: "hermes-response-key",
      signingSecret: "v".repeat(32),
    })),
  };
}

function plannerInput(): HermesPlannerInput {
  return {
    contractVersion: "engine-adapter/v1",
    authority: {
      systemOfRecord: "safeclaw-mcp-db-harness",
      toolExecutionBoundary: "safeclaw-mcp-interceptor",
      canMutate: false,
      canPublish: false,
      humanConfirmationRequired: true,
    },
    context: {
      userId: "user-1",
      organizationId: "org-1",
      siteId: "site-1",
      site: { siteName: "성수 현장", region: "서울", briefingQuestion: null },
    },
    prompt: "김민수 010-1234-5678 성수동 현장 사진을 보고 점검해줘",
    evidencePacket: buildDbHarnessPacket({ question: "김민수 010-1234-5678 성수동 현장 사진을 보고 점검해줘", references: [] }),
    evidenceDigest: "d".repeat(64),
    evidenceClaims: [{
      claimId: `claim:${"a".repeat(64)}`,
      text: "작업 전 추락 방지 설비를 확인합니다.",
      claimKind: "control",
      remotePublicProvenance: "verified_public_safety_corpus",
      citations: [{
        citationId: `citation:${"b".repeat(64)}`,
        label: "KOSHA 실행지침: 내부 렌더 라벨",
        provenanceClass: "kosha_guide",
        sourceRefDigest: "c".repeat(64),
      }],
    }],
    evidenceExclusions: [],
    emitText: () => undefined,
    signal: new AbortController().signal,
    requestReadTool: async () => ({ forbidden: true }),
  };
}

function receiptFor(attempt: RemoteHermesAttemptEnvelope): AttemptReceipt {
  const unsigned = {
    version: "remote-hermes-attempt-ledger-receipt/v1" as const,
    receiptId: "ledger-receipt-1",
    attemptEnvelopeDigest: attempt.attemptEnvelopeDigest,
    reservedAt: now.toISOString(),
  };
  return { ...unsigned, receiptDigest: digestRemoteHermesValue(unsigned) };
}

function successResponse(attempt: RemoteHermesAttemptEnvelope, receipt: AttemptReceipt): Response {
  const unsigned = {
    responseVersion: "engine-remote-response/v1" as const,
    kind: "success" as const,
    runId: attempt.runId,
    logicalRequestDigest: attempt.logicalRequestDigest,
    requestId: attempt.requestId,
    attemptId: attempt.attemptId,
    organizationId: attempt.organizationId,
    siteId: attempt.siteId,
    attemptEnvelopeDigest: attempt.attemptEnvelopeDigest,
    attemptLedgerReceiptDigest: receipt.receiptDigest,
    promptProjectionDigest: attempt.promptProjectionDigest,
    claimsProjectionDigest: attempt.claimsProjectionDigest,
    evidenceDigest: attempt.evidenceDigest,
    usage: {
      providerRef: "provider-opaque",
      modelRef: "model-opaque",
      inputTokens: null,
      outputTokens: null,
      usageComplete: false,
    },
    latencyMs: 10,
    terminalStatus: "succeeded" as const,
    selectedClaims: [{
      claimId: attempt.claimsProjection.entries[0]?.claimId,
      citationIds: [attempt.claimsProjection.entries[0]?.citations[0]?.citationId],
    }],
  };
  const responseEnvelopeDigest = digestRemoteHermesValue(unsigned);
  return new Response(JSON.stringify({
    ...unsigned,
    responseEnvelopeDigest,
    serviceReceipt: {
      responseEnvelopeDigest,
      attemptEnvelopeDigest: attempt.attemptEnvelopeDigest,
      requestNonce: attempt.nonce,
      serviceId: "hermes-service",
      keyId: "hermes-response-key",
      signature: signRemoteHermesDigest(
        "v".repeat(32),
        `safeclaw-engine-remote-response/v1:hermes-service:${attempt.attemptEnvelopeDigest}`,
        responseEnvelopeDigest,
      ),
    },
  }), { status: 200, headers: { "Content-Type": "application/json" } });
}

function ledgerWith(
  reserve: RemoteHermesAttemptLedger["reserve"],
): RemoteHermesAttemptLedger {
  return {
    reserve,
    recordTerminal: async () => "recorded" as const,
  };
}

function trustedConnection(): RemoteHermesTrustedConnection {
  return {
    version: "remote-hermes-connected-origin/v1",
    endpointOrigin: "https://hermes.example.test",
    connectedOrigin: "https://hermes.example.test",
    connectedAddress: "93.184.216.34",
    redirects: 0,
    serviceId: "hermes-service",
    policyAttestationDigest: JSON.parse(remoteEnv().SAFECLAW_REMOTE_HERMES_POLICY_ATTESTATION).attestationDigest,
  };
}

function failureResponse(
  attempt: RemoteHermesAttemptEnvelope,
  receipt: AttemptReceipt,
  diagnosticsRef = SAFE_DIAGNOSTICS_REF,
): Response {
  const unsigned = {
    responseVersion: "engine-remote-response/v1" as const,
    kind: "failure" as const,
    runId: attempt.runId,
    logicalRequestDigest: attempt.logicalRequestDigest,
    requestId: attempt.requestId,
    attemptId: attempt.attemptId,
    organizationId: attempt.organizationId,
    siteId: attempt.siteId,
    attemptEnvelopeDigest: attempt.attemptEnvelopeDigest,
    attemptLedgerReceiptDigest: receipt.receiptDigest,
    promptProjectionDigest: attempt.promptProjectionDigest,
    claimsProjectionDigest: attempt.claimsProjectionDigest,
    evidenceDigest: attempt.evidenceDigest,
    usage: {
      providerRef: "provider-opaque",
      modelRef: "model-opaque",
      inputTokens: 17,
      outputTokens: 0,
      usageComplete: true,
    },
    latencyMs: 12,
    terminalStatus: "failed" as const,
    error: {
      taxonomyVersion: "engine-remote-error/v1" as const,
      code: "REMOTE_PROVIDER_UNAVAILABLE" as const,
      origin: "worker" as const,
      diagnosticsRef,
    },
  };
  const responseEnvelopeDigest = digestRemoteHermesValue(unsigned);
  return new Response(JSON.stringify({
    ...unsigned,
    responseEnvelopeDigest,
    serviceReceipt: {
      responseEnvelopeDigest,
      attemptEnvelopeDigest: attempt.attemptEnvelopeDigest,
      requestNonce: attempt.nonce,
      serviceId: "hermes-service",
      keyId: "hermes-response-key",
      signature: signRemoteHermesDigest(
        "v".repeat(32),
        `safeclaw-engine-remote-response/v1:hermes-service:${attempt.attemptEnvelopeDigest}`,
        responseEnvelopeDigest,
      ),
    },
  }), { status: 200, headers: { "Content-Type": "application/json" } });
}

function runtimeDependencies(overrides: Record<string, unknown> = {}): RemoteHermesRuntimeDependencies {
  return {
    env: remoteEnv(),
    now: () => now,
    randomId: (() => {
      const ids = ["run-1", "request-1", "attempt-1"];
      return () => ids.shift() ?? "unexpected-id";
    })(),
    randomNonce: () => "nonce-1",
    ...overrides,
  } as RemoteHermesRuntimeDependencies;
}

describe("remote Hermes runtime", () => {
  it("cancels an oversized response stream before buffering beyond the cap", async () => {
    const cancel = vi.fn();
    const response = new Response(new ReadableStream<Uint8Array>({
      pull(controller) {
        controller.enqueue(new Uint8Array(12));
      },
      cancel,
    }));

    await expect(readRemoteHermesResponseBody(
      response,
      new AbortController().signal,
      10,
    )).rejects.toThrow("bounded envelope size");
    expect(cancel).toHaveBeenCalledTimes(1);
  });

  it("keeps the deadline active while consuming the response body", async () => {
    const cancel = vi.fn();
    const response = new Response(new ReadableStream<Uint8Array>({ cancel }));
    const controller = new AbortController();
    const pending = readRemoteHermesResponseBody(response, controller.signal, 100);
    controller.abort(new Error("deadline"));

    await expect(pending).rejects.toThrow("deadline");
    expect(cancel).toHaveBeenCalledTimes(1);
  });

  it("does not create a runnable remote runtime from environment configuration alone", () => {
    const runtime = createRemoteHermesRuntime(runtimeDependencies());

    expect(runtime).toBeUndefined();
  });

  it("does not create a runnable runtime from a reserve-only ledger", () => {
    const incompleteLedger = {
      reserve: async (attempt: RemoteHermesAttemptEnvelope) => receiptFor(attempt),
    } as unknown as RemoteHermesAttemptLedger;

    expect(createRemoteHermesRuntime(runtimeDependencies({
      attemptLedger: incompleteLedger,
      trustedTransport: { dispatch: vi.fn() },
    }))).toBeUndefined();
  });

  it("revalidates policy expiry before each injected runtime attempt", async () => {
    let current = now;
    const runtime = createRemoteHermesRuntime(runtimeDependencies({
      now: () => current,
      attemptLedger: ledgerWith(async (attempt: RemoteHermesAttemptEnvelope) => receiptFor(attempt)),
      trustedTransport: { dispatch: vi.fn() },
    }));
    expect(runtime).toBeDefined();
    if (!runtime) return;
    current = new Date("2026-07-16T15:59:00.000Z");

    await expect(runtime.attestRuntime({
      userId: "user-1",
      organizationId: "org-1",
      siteId: "site-1",
      site: { siteName: "현장", region: "서울", briefingQuestion: null },
    })).rejects.toMatchObject({ code: "ENGINE_EXECUTION_ATTESTATION_UNPROVEN" });
  });

  it("writes and freezes an attempt ledger receipt before its trusted transport dispatch", async () => {
    const sequence: string[] = [];
    const emitted: HermesPlannerTextOutput[] = [];
    let outbound = "";
    const ledger = {
      reserve: vi.fn(async (attempt: RemoteHermesAttemptEnvelope) => {
        sequence.push("ledger");
        return receiptFor(attempt);
      }),
      recordTerminal: vi.fn(async (record: RemoteHermesTerminalRecord) => {
        sequence.push("terminal");
        expect(Object.isFrozen(record)).toBe(true);
        expect(Object.isFrozen(record.usage)).toBe(true);
        return "recorded" as const;
      }),
    };
    const transport = {
      dispatch: vi.fn(async ({ body, attemptReceipt }: { body: string; attemptReceipt: AttemptReceipt }) => {
        sequence.push("transport");
        outbound = body;
        const payload = JSON.parse(body) as {
          attempt: RemoteHermesAttemptEnvelope;
          attemptReceipt: AttemptReceipt;
        };
        expect(Object.isFrozen(attemptReceipt)).toBe(true);
        return {
          response: successResponse(payload.attempt, payload.attemptReceipt),
          connection: {
            version: "remote-hermes-connected-origin/v1",
            endpointOrigin: "https://hermes.example.test",
            connectedOrigin: "https://hermes.example.test",
            connectedAddress: "93.184.216.34",
            redirects: 0,
            serviceId: "hermes-service",
            policyAttestationDigest: JSON.parse(remoteEnv().SAFECLAW_REMOTE_HERMES_POLICY_ATTESTATION).attestationDigest,
          },
        };
      }),
    };
    const runtime = createRemoteHermesRuntime(runtimeDependencies({
      attemptLedger: ledger,
      trustedTransport: transport,
    }));
    expect(runtime).toBeDefined();
    if (!runtime) return;

    const input = plannerInput();
    input.emitText = (output) => emitted.push(output);
    await runtime.planner(input);

    expect(sequence).toEqual(["ledger", "transport", "terminal"]);
    expect(ledger.reserve).toHaveBeenCalledTimes(1);
    expect(transport.dispatch).toHaveBeenCalledTimes(1);
    expect(ledger.recordTerminal).toHaveBeenCalledWith(expect.objectContaining({
      organizationId: "org-1",
      siteId: "site-1",
      runId: "run-1",
      requestId: "request-1",
      attemptId: "attempt-1",
      logicalRequestDigest: expect.stringMatching(/^[a-f0-9]{64}$/u),
      attemptEnvelopeDigest: expect.stringMatching(/^[a-f0-9]{64}$/u),
      responseEnvelopeDigest: expect.stringMatching(/^[a-f0-9]{64}$/u),
      terminalStatus: "success",
      latencyMs: 10,
      usage: {
        providerRef: "provider-opaque",
        modelRef: "model-opaque",
        inputTokens: null,
        outputTokens: null,
        usageComplete: false,
      },
    }), expect.any(AbortSignal));
    expect(outbound).not.toMatch(/김민수|010-1234-5678|성수동|성수 현장|작업 전 추락 방지 설비|내부 렌더 라벨|oauth|supabase/iu);
    expect(emitted[0]?.attestation.claims).toEqual([{
      claimId: `claim:${"a".repeat(64)}`,
      citationIds: [`citation:${"b".repeat(64)}`],
    }]);
  });

  it("keeps replay retryable when terminal persistence fails before a later successful record", async () => {
    const emitted: HermesPlannerTextOutput[] = [];
    const ledger = {
      reserve: async (attempt: RemoteHermesAttemptEnvelope) => receiptFor(attempt),
      recordTerminal: vi.fn()
        .mockRejectedValueOnce(new Error("terminal write failed"))
        .mockResolvedValueOnce("recorded" as const),
    };
    const transport = {
      dispatch: vi.fn(async ({ body }: { body: string }) => {
        const payload = JSON.parse(body) as {
          attempt: RemoteHermesAttemptEnvelope;
          attemptReceipt: AttemptReceipt;
        };
        return {
          response: successResponse(payload.attempt, payload.attemptReceipt),
          connection: {
            version: "remote-hermes-connected-origin/v1" as const,
            endpointOrigin: "https://hermes.example.test",
            connectedOrigin: "https://hermes.example.test",
            connectedAddress: "93.184.216.34",
            redirects: 0 as const,
            serviceId: "hermes-service",
            policyAttestationDigest: JSON.parse(remoteEnv().SAFECLAW_REMOTE_HERMES_POLICY_ATTESTATION).attestationDigest,
          },
        };
      }),
    };
    const runtime = createRemoteHermesRuntime(runtimeDependencies({
      attemptLedger: ledger,
      trustedTransport: transport,
      randomId: (() => {
        const ids = ["run-1", "request-1", "attempt-1", "run-1", "request-1", "attempt-1"];
        return () => ids.shift() ?? "unexpected-id";
      })(),
    }));
    expect(runtime).toBeDefined();
    if (!runtime) return;
    const input = plannerInput();
    input.emitText = (output) => emitted.push(output);

    await expect(runtime.planner(input)).rejects.toMatchObject({
      code: "ENGINE_EXECUTION_ATTESTATION_UNPROVEN",
    });
    expect(emitted).toEqual([]);

    const retryInput = plannerInput();
    retryInput.emitText = (output) => emitted.push(output);
    await expect(runtime.planner(retryInput)).resolves.toBeUndefined();
    expect(ledger.recordTerminal).toHaveBeenCalledTimes(2);
    expect(emitted).toHaveLength(1);
  });

  it("records a signed remote failure before failing closed", async () => {
    const sequence: string[] = [];
    const terminalRecords: RemoteHermesTerminalRecord[] = [];
    const ledger = {
      reserve: async (attempt: RemoteHermesAttemptEnvelope) => receiptFor(attempt),
      recordTerminal: vi.fn(async (record: RemoteHermesTerminalRecord) => {
        sequence.push("terminal");
        expect(Object.isFrozen(record)).toBe(true);
        expect(Object.isFrozen(record.usage)).toBe(true);
        if (record.terminalStatus === "failure") expect(Object.isFrozen(record.error)).toBe(true);
        terminalRecords.push(record);
        return "recorded" as const;
      }),
    };
    const transport = {
      dispatch: vi.fn(async ({ body }: { body: string }) => {
        sequence.push("transport");
        const payload = JSON.parse(body) as {
          attempt: RemoteHermesAttemptEnvelope;
          attemptReceipt: AttemptReceipt;
        };
        return {
          response: failureResponse(payload.attempt, payload.attemptReceipt),
          connection: {
            version: "remote-hermes-connected-origin/v1" as const,
            endpointOrigin: "https://hermes.example.test",
            connectedOrigin: "https://hermes.example.test",
            connectedAddress: "93.184.216.34",
            redirects: 0 as const,
            serviceId: "hermes-service",
            policyAttestationDigest: JSON.parse(remoteEnv().SAFECLAW_REMOTE_HERMES_POLICY_ATTESTATION).attestationDigest,
          },
        };
      }),
    };
    const runtime = createRemoteHermesRuntime(runtimeDependencies({ attemptLedger: ledger, trustedTransport: transport }));
    expect(runtime).toBeDefined();
    if (!runtime) return;

    await expect(runtime.planner(plannerInput())).rejects.toMatchObject({ code: "ENGINE_EXECUTION_FAILED" });
    expect(sequence).toEqual(["transport", "terminal"]);
    expect(terminalRecords).toEqual([expect.objectContaining({
      terminalStatus: "failure",
      error: {
        code: "REMOTE_PROVIDER_UNAVAILABLE",
        origin: "worker",
        diagnosticsRef: SAFE_DIAGNOSTICS_REF,
      },
      usage: expect.objectContaining({ inputTokens: 17, outputTokens: 0, usageComplete: true }),
      latencyMs: 12,
    })]);
  });

  it.each(["throw", "duplicate", "timeout"] as const)(
    "preserves a signed remote failure when terminal persistence returns %s",
    async (terminalOutcome) => {
      if (terminalOutcome === "timeout") vi.useFakeTimers();
      try {
        const emitted: HermesPlannerTextOutput[] = [];
        const terminalFailure = new Error("terminal ledger unavailable");
        const ledger = {
          reserve: async (attempt: RemoteHermesAttemptEnvelope) => receiptFor(attempt),
          recordTerminal: vi.fn(async () => {
            if (terminalOutcome === "throw") throw terminalFailure;
            if (terminalOutcome === "timeout") return await new Promise<never>(() => undefined);
            return "duplicate" as const;
          }),
        };
        const transport = {
          dispatch: vi.fn(async ({ body }: { body: string }) => {
            const payload = JSON.parse(body) as {
              attempt: RemoteHermesAttemptEnvelope;
              attemptReceipt: AttemptReceipt;
            };
            return {
              response: failureResponse(payload.attempt, payload.attemptReceipt),
              connection: trustedConnection(),
            };
          }),
        };
        const runtime = createRemoteHermesRuntime(runtimeDependencies({ attemptLedger: ledger, trustedTransport: transport }));
        expect(runtime).toBeDefined();
        if (!runtime) return;
        const input = plannerInput();
        input.emitText = (output) => emitted.push(output);

        const caughtPromise = runtime.planner(input).then(
          () => undefined,
          (error: unknown) => error,
        );
        if (terminalOutcome === "timeout") {
          await vi.advanceTimersByTimeAsync(0);
          expect(ledger.recordTerminal).toHaveBeenCalledTimes(1);
          await vi.advanceTimersByTimeAsync(REMOTE_HERMES_TERMINAL_PERSIST_TIMEOUT_MS);
        }
        const caught = await caughtPromise;
        expect(caught).toMatchObject({
          code: "ENGINE_EXECUTION_FAILED",
          cause: expect.any(AggregateError),
        });
        const aggregate = (caught as Error & { cause: AggregateError }).cause;
        expect(aggregate.errors).toHaveLength(2);
        expect(aggregate.errors[0]).toMatchObject({ code: "ENGINE_EXECUTION_FAILED" });
        expect(aggregate.errors[1]).toMatchObject({ code: "ENGINE_EXECUTION_ATTESTATION_UNPROVEN" });
        if (terminalOutcome === "timeout") {
          expect((aggregate.errors[1] as Error & { cause?: unknown }).cause).toMatchObject({
            message: "remote Hermes terminal persistence deadline exceeded",
          });
          expect(vi.getTimerCount()).toBe(0);
        }
        expect(ledger.recordTerminal).toHaveBeenCalledTimes(1);
        expect(emitted).toEqual([]);
      } finally {
        if (terminalOutcome === "timeout") vi.useRealTimers();
      }
    },
  );

  it("rejects duplicate terminal records before any replayed output", async () => {
    const terminalKeys = new Set<string>();
    const emitted: HermesPlannerTextOutput[] = [];
    const ledger = {
      reserve: async (attempt: RemoteHermesAttemptEnvelope) => receiptFor(attempt),
      recordTerminal: async (record: RemoteHermesTerminalRecord) => {
        const key = `${record.organizationId}:${record.siteId}:${record.attemptId}`;
        if (terminalKeys.has(key)) return "duplicate" as const;
        terminalKeys.add(key);
        return "recorded" as const;
      },
    };
    const transport = {
      dispatch: vi.fn(async ({ body }: { body: string }) => {
        const payload = JSON.parse(body) as {
          attempt: RemoteHermesAttemptEnvelope;
          attemptReceipt: AttemptReceipt;
        };
        return {
          response: successResponse(payload.attempt, payload.attemptReceipt),
          connection: {
            version: "remote-hermes-connected-origin/v1" as const,
            endpointOrigin: "https://hermes.example.test",
            connectedOrigin: "https://hermes.example.test",
            connectedAddress: "93.184.216.34",
            redirects: 0 as const,
            serviceId: "hermes-service",
            policyAttestationDigest: JSON.parse(remoteEnv().SAFECLAW_REMOTE_HERMES_POLICY_ATTESTATION).attestationDigest,
          },
        };
      }),
    };
    const runtime = createRemoteHermesRuntime(runtimeDependencies({
      attemptLedger: ledger,
      trustedTransport: transport,
      randomId: (() => {
        const ids = ["run-1", "request-1", "attempt-1", "run-1", "request-1", "attempt-1"];
        return () => ids.shift() ?? "unexpected-id";
      })(),
    }));
    expect(runtime).toBeDefined();
    if (!runtime) return;
    const first = plannerInput();
    first.emitText = (output) => emitted.push(output);
    await runtime.planner(first);
    const second = plannerInput();
    second.emitText = (output) => emitted.push(output);

    await expect(runtime.planner(second)).rejects.toMatchObject({
      code: "ENGINE_EXECUTION_ATTESTATION_UNPROVEN",
    });
    expect(transport.dispatch).toHaveBeenCalledTimes(2);
    expect(terminalKeys.size).toBe(1);
    expect(emitted).toHaveLength(1);
  });

  it.each([
    ["transport", "REMOTE_TRANSPORT_UNAVAILABLE"],
    ["http", "REMOTE_TRANSPORT_UNAVAILABLE"],
    ["body", "REMOTE_RESPONSE_INVALID"],
    ["json", "REMOTE_RESPONSE_INVALID"],
    ["signature", "REMOTE_RESPONSE_SIGNATURE_INVALID"],
  ] as const)("records a gateway terminal failure after reserved %s failure", async (phase, errorCode) => {
    const terminalRecords: RemoteHermesTerminalRecord[] = [];
    const ledger = {
      reserve: async (attempt: RemoteHermesAttemptEnvelope) => receiptFor(attempt),
      recordTerminal: vi.fn(async (record: RemoteHermesTerminalRecord) => {
        terminalRecords.push(record);
        return "recorded" as const;
      }),
    };
    const transport = {
      dispatch: vi.fn(async ({ body }: { body: string }) => {
        if (phase === "transport") throw new Error("transport raw secret");
        const payload = JSON.parse(body) as {
          attempt: RemoteHermesAttemptEnvelope;
          attemptReceipt: AttemptReceipt;
        };
        let response: Response;
        if (phase === "http") {
          response = new Response("upstream raw secret", { status: 503 });
        } else if (phase === "body") {
          response = new Response(new ReadableStream<Uint8Array>({
            start(controller) {
              controller.error(new Error("body raw secret"));
            },
          }));
        } else if (phase === "json") {
          response = new Response("not-json raw secret", { status: 200 });
        } else {
          const signed = await successResponse(payload.attempt, payload.attemptReceipt).json() as {
            serviceReceipt: { signature: string };
          };
          signed.serviceReceipt.signature = "0".repeat(64);
          response = new Response(JSON.stringify(signed), { status: 200 });
        }
        return { response, connection: trustedConnection() };
      }),
    };
    const runtime = createRemoteHermesRuntime(runtimeDependencies({ attemptLedger: ledger, trustedTransport: transport }));
    expect(runtime).toBeDefined();
    if (!runtime) return;

    await expect(runtime.planner(plannerInput())).rejects.toBeDefined();
    expect(ledger.recordTerminal).toHaveBeenCalledTimes(1);
    expect(terminalRecords).toEqual([expect.objectContaining({
      organizationId: "org-1",
      siteId: "site-1",
      runId: "run-1",
      requestId: "request-1",
      attemptId: "attempt-1",
      logicalRequestDigest: expect.stringMatching(/^[a-f0-9]{64}$/u),
      attemptEnvelopeDigest: expect.stringMatching(/^[a-f0-9]{64}$/u),
      terminalStatus: "failure",
      latencyMs: expect.any(Number),
      error: { code: errorCode, origin: "gateway" },
    })]);
    expect(terminalRecords[0]).not.toHaveProperty("responseEnvelopeDigest");
    expect(terminalRecords[0]).not.toHaveProperty("usage");
    expect(JSON.stringify(terminalRecords)).not.toMatch(/raw secret/iu);
  });

  it.each([
    "password:abc123",
    "token_abcdef",
    "p010-1234-5678",
    "https://attacker.example/detail",
    "operator@example.test",
    "내부 오류 상세",
  ])("rejects non-opaque signed diagnostics without persisting %s", async (diagnosticsRef) => {
    const terminalRecords: RemoteHermesTerminalRecord[] = [];
    const ledger = {
      reserve: async (attempt: RemoteHermesAttemptEnvelope) => receiptFor(attempt),
      recordTerminal: vi.fn(async (record: RemoteHermesTerminalRecord) => {
        terminalRecords.push(record);
        return "recorded" as const;
      }),
    };
    const transport = {
      dispatch: vi.fn(async ({ body }: { body: string }) => {
        const payload = JSON.parse(body) as {
          attempt: RemoteHermesAttemptEnvelope;
          attemptReceipt: AttemptReceipt;
        };
        return {
          response: failureResponse(payload.attempt, payload.attemptReceipt, diagnosticsRef),
          connection: trustedConnection(),
        };
      }),
    };
    const runtime = createRemoteHermesRuntime(runtimeDependencies({ attemptLedger: ledger, trustedTransport: transport }));
    expect(runtime).toBeDefined();
    if (!runtime) return;

    await expect(runtime.planner(plannerInput())).rejects.toMatchObject({
      code: "ENGINE_EXECUTION_ATTESTATION_UNPROVEN",
    });
    expect(terminalRecords).toEqual([expect.objectContaining({
      terminalStatus: "failure",
      error: { code: "REMOTE_RESPONSE_INVALID", origin: "gateway" },
    })]);
    expect(JSON.stringify(terminalRecords)).not.toContain(diagnosticsRef);
  });

  it("uses a fresh non-aborted signal to close the terminal after caller abort", async () => {
    const callerController = new AbortController();
    let terminalSignal: AbortSignal | undefined;
    const ledger = {
      reserve: async (attempt: RemoteHermesAttemptEnvelope) => receiptFor(attempt),
      recordTerminal: vi.fn(async (_record: RemoteHermesTerminalRecord, signal: AbortSignal) => {
        terminalSignal = signal;
        expect(signal).not.toBe(callerController.signal);
        expect(signal.aborted).toBe(false);
        return "recorded" as const;
      }),
    };
    const transport = {
      dispatch: vi.fn(async ({ signal }: { signal: AbortSignal }) => await new Promise<never>((_resolve, reject) => {
        signal.addEventListener("abort", () => reject(signal.reason), { once: true });
      })),
    };
    const runtime = createRemoteHermesRuntime(runtimeDependencies({ attemptLedger: ledger, trustedTransport: transport }));
    expect(runtime).toBeDefined();
    if (!runtime) return;
    const input = plannerInput();
    input.signal = callerController.signal;
    const pending = runtime.planner(input);
    await vi.waitFor(() => expect(transport.dispatch).toHaveBeenCalledTimes(1));
    callerController.abort(new Error("caller aborted"));

    await expect(pending).rejects.toMatchObject({ code: "ENGINE_TIMEOUT" });
    expect(ledger.recordTerminal).toHaveBeenCalledTimes(1);
    expect(terminalSignal?.aborted).toBe(false);
  });

  it("uses an independent signal to close the terminal after execution timeout", async () => {
    vi.useFakeTimers();
    try {
      let executionSignal: AbortSignal | undefined;
      let terminalSignal: AbortSignal | undefined;
      const ledger = {
        reserve: async (attempt: RemoteHermesAttemptEnvelope) => receiptFor(attempt),
        recordTerminal: vi.fn(async (_record: RemoteHermesTerminalRecord, signal: AbortSignal) => {
          terminalSignal = signal;
          expect(signal).not.toBe(executionSignal);
          expect(signal.aborted).toBe(false);
          return "recorded" as const;
        }),
      };
      const transport = {
        dispatch: vi.fn(async ({ signal }: { signal: AbortSignal }) => {
          executionSignal = signal;
          return await new Promise<never>((_resolve, reject) => {
            signal.addEventListener("abort", () => reject(signal.reason), { once: true });
          });
        }),
      };
      const runtime = createRemoteHermesRuntime(runtimeDependencies({ attemptLedger: ledger, trustedTransport: transport }));
      expect(runtime).toBeDefined();
      if (!runtime) return;
      const pending = runtime.planner(plannerInput());
      const rejection = expect(pending).rejects.toMatchObject({ code: "ENGINE_TIMEOUT" });
      await vi.advanceTimersByTimeAsync(REMOTE_HERMES_EXECUTION_TIMEOUT_MS);

      await rejection;
      expect(ledger.recordTerminal).toHaveBeenCalledTimes(1);
      expect(terminalSignal?.aborted).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });

  it("bounds terminal persistence after abort without masking the timeout", async () => {
    vi.useFakeTimers();
    try {
      const callerController = new AbortController();
      let terminalSignal: AbortSignal | undefined;
      const ledger = {
        reserve: async (attempt: RemoteHermesAttemptEnvelope) => receiptFor(attempt),
        recordTerminal: vi.fn(async (_record: RemoteHermesTerminalRecord, signal: AbortSignal) => {
          terminalSignal = signal;
          return await new Promise<never>(() => undefined);
        }),
      };
      const transport = {
        dispatch: vi.fn(async ({ signal }: { signal: AbortSignal }) => await new Promise<never>((_resolve, reject) => {
          signal.addEventListener("abort", () => reject(signal.reason), { once: true });
        })),
      };
      const runtime = createRemoteHermesRuntime(runtimeDependencies({ attemptLedger: ledger, trustedTransport: transport }));
      expect(runtime).toBeDefined();
      if (!runtime) return;
      const input = plannerInput();
      input.signal = callerController.signal;
      const pending = runtime.planner(input);
      const rejection = expect(pending).rejects.toMatchObject({ code: "ENGINE_TIMEOUT" });
      await vi.waitFor(() => expect(transport.dispatch).toHaveBeenCalledTimes(1));
      callerController.abort(new Error("caller aborted"));
      await vi.waitFor(() => expect(ledger.recordTerminal).toHaveBeenCalledTimes(1));
      await vi.advanceTimersByTimeAsync(REMOTE_HERMES_TERMINAL_PERSIST_TIMEOUT_MS);

      await rejection;
      expect(terminalSignal?.aborted).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });

  it.each([
    ["transport", "throw", "ENGINE_EXECUTION_FAILED"],
    ["transport", "duplicate", "ENGINE_EXECUTION_FAILED"],
    ["validation", "throw", "ENGINE_EXECUTION_ATTESTATION_UNPROVEN"],
    ["validation", "duplicate", "ENGINE_EXECUTION_ATTESTATION_UNPROVEN"],
  ] as const)("preserves the original %s classification when terminal close returns %s", async (phase, terminalOutcome, expectedCode) => {
    const ledgerFailure = new Error("terminal ledger unavailable");
    const ledger = {
      reserve: async (attempt: RemoteHermesAttemptEnvelope) => receiptFor(attempt),
      recordTerminal: vi.fn(async () => {
        if (terminalOutcome === "throw") throw ledgerFailure;
        return "duplicate" as const;
      }),
    };
    const transport = {
      dispatch: vi.fn(async ({ body }: { body: string }) => {
        if (phase === "transport") throw new Error("transport unavailable");
        const payload = JSON.parse(body) as {
          attempt: RemoteHermesAttemptEnvelope;
          attemptReceipt: AttemptReceipt;
        };
        const signed = await successResponse(payload.attempt, payload.attemptReceipt).json() as {
          serviceReceipt: { signature: string };
        };
        signed.serviceReceipt.signature = "0".repeat(64);
        return {
          response: new Response(JSON.stringify(signed), { status: 200 }),
          connection: trustedConnection(),
        };
      }),
    };
    const runtime = createRemoteHermesRuntime(runtimeDependencies({ attemptLedger: ledger, trustedTransport: transport }));
    expect(runtime).toBeDefined();
    if (!runtime) return;
    const emitted: HermesPlannerTextOutput[] = [];
    const input = plannerInput();
    input.emitText = (output) => emitted.push(output);

    let caught: unknown;
    try {
      await runtime.planner(input);
    } catch (error) {
      caught = error;
    }
    expect(caught).toMatchObject({ code: expectedCode, cause: expect.any(AggregateError) });
    expect((caught as Error & { cause: AggregateError }).cause.errors).toHaveLength(2);
    expect(ledger.recordTerminal).toHaveBeenCalledTimes(1);
    expect(emitted).toEqual([]);
  });

  it("rejects a ledger receipt reserved before its attempt was issued", async () => {
    const transport = { dispatch: vi.fn() };
    const runtime = createRemoteHermesRuntime(runtimeDependencies({
      attemptLedger: ledgerWith(
        async (attempt: RemoteHermesAttemptEnvelope) => {
          const unsigned = {
            version: "remote-hermes-attempt-ledger-receipt/v1" as const,
            receiptId: "ledger-receipt-early",
            attemptEnvelopeDigest: attempt.attemptEnvelopeDigest,
            reservedAt: "2026-07-16T14:58:59.000Z",
          };
          return { ...unsigned, receiptDigest: digestRemoteHermesValue(unsigned) };
        },
      ),
      trustedTransport: transport,
    }));
    expect(runtime).toBeDefined();
    if (!runtime) return;

    await expect(runtime.planner(plannerInput())).rejects.toMatchObject({
      code: "ENGINE_EXECUTION_ATTESTATION_UNPROVEN",
    });
    expect(transport.dispatch).not.toHaveBeenCalled();
  });

  it("rejects unclassified evidence before reserving or dispatching", async () => {
    const ledger = ledgerWith(vi.fn());
    const transport = { dispatch: vi.fn() };
    const runtime = createRemoteHermesRuntime(runtimeDependencies({
      attemptLedger: ledger,
      trustedTransport: transport,
    }));
    expect(runtime).toBeDefined();
    if (!runtime) return;
    const input = plannerInput();
    delete (input.evidenceClaims[0] as {
      remotePublicProvenance?: "verified_public_safety_corpus";
    }).remotePublicProvenance;

    await expect(runtime.planner(input)).rejects.toMatchObject({
      code: "ENGINE_EXECUTION_ATTESTATION_UNPROVEN",
    });
    expect(ledger.reserve).not.toHaveBeenCalled();
    expect(transport.dispatch).not.toHaveBeenCalled();
  });

  it("keeps transport at zero when the durable attempt ledger cannot reserve the attempt", async () => {
    const transport = { dispatch: vi.fn() };
    const runtime = createRemoteHermesRuntime(runtimeDependencies({
      attemptLedger: ledgerWith(async () => { throw new Error("ledger write failed"); }),
      trustedTransport: transport,
    }));
    expect(runtime).toBeDefined();
    if (!runtime) return;

    await expect(runtime.planner(plannerInput())).rejects.toMatchObject({
      code: "ENGINE_EXECUTION_ATTESTATION_UNPROVEN",
    });
    expect(transport.dispatch).not.toHaveBeenCalled();
  });

  it("aborts a pending attempt-ledger reservation with the caller deadline", async () => {
    const transport = { dispatch: vi.fn() };
    const controller = new AbortController();
    const runtime = createRemoteHermesRuntime(runtimeDependencies({
      attemptLedger: ledgerWith(async () => await new Promise<AttemptReceipt>(() => undefined)),
      trustedTransport: transport,
    }));
    expect(runtime).toBeDefined();
    if (!runtime) return;
    const input = plannerInput();
    input.signal = controller.signal;
    const pending = runtime.planner(input);
    controller.abort(new Error("caller cancelled"));

    await expect(pending).rejects.toMatchObject({ code: "ENGINE_TIMEOUT" });
    expect(transport.dispatch).not.toHaveBeenCalled();
  });

  it("rejects a rebinding transport report instead of accepting a signed response", async () => {
    const ledger = ledgerWith(async (attempt: RemoteHermesAttemptEnvelope) => receiptFor(attempt));
    const transport = {
      dispatch: vi.fn(async ({ body }: { body: string }) => {
        const payload = JSON.parse(body) as {
          attempt: RemoteHermesAttemptEnvelope;
          attemptReceipt: AttemptReceipt;
        };
        return {
          response: successResponse(payload.attempt, payload.attemptReceipt),
          connection: {
            version: "remote-hermes-connected-origin/v1",
            endpointOrigin: "https://hermes.example.test",
            connectedOrigin: "https://hermes.example.test",
            connectedAddress: "169.254.169.254",
            redirects: 0,
            serviceId: "hermes-service",
            policyAttestationDigest: JSON.parse(remoteEnv().SAFECLAW_REMOTE_HERMES_POLICY_ATTESTATION).attestationDigest,
          },
        };
      }),
    };
    const runtime = createRemoteHermesRuntime(runtimeDependencies({
      attemptLedger: ledger,
      trustedTransport: transport,
    }));
    expect(runtime).toBeDefined();
    if (!runtime) return;
    const emitted: HermesPlannerTextOutput[] = [];
    const input = plannerInput();
    input.emitText = (output) => emitted.push(output);

    await expect(runtime.planner(input)).rejects.toMatchObject({
      code: "ENGINE_EXECUTION_ATTESTATION_UNPROVEN",
    });
    expect(transport.dispatch).toHaveBeenCalledTimes(1);
    expect(emitted).toEqual([]);
  });

  it("rejects IPv4-mapped private IPv6 connection reports", async () => {
    const ledger = ledgerWith(async (attempt: RemoteHermesAttemptEnvelope) => receiptFor(attempt));
    const transport = {
      dispatch: vi.fn(async ({ body }: { body: string }) => {
        const payload = JSON.parse(body) as {
          attempt: RemoteHermesAttemptEnvelope;
          attemptReceipt: AttemptReceipt;
        };
        return {
          response: successResponse(payload.attempt, payload.attemptReceipt),
          connection: {
            version: "remote-hermes-connected-origin/v1",
            endpointOrigin: "https://hermes.example.test",
            connectedOrigin: "https://hermes.example.test",
            connectedAddress: "::ffff:172.16.0.1",
            redirects: 0,
            serviceId: "hermes-service",
            policyAttestationDigest: JSON.parse(remoteEnv().SAFECLAW_REMOTE_HERMES_POLICY_ATTESTATION).attestationDigest,
          },
        };
      }),
    };
    const runtime = createRemoteHermesRuntime(runtimeDependencies({
      attemptLedger: ledger,
      trustedTransport: transport,
    }));
    expect(runtime).toBeDefined();
    if (!runtime) return;

    await expect(runtime.planner(plannerInput())).rejects.toMatchObject({
      code: "ENGINE_EXECUTION_ATTESTATION_UNPROVEN",
    });
  });

  it.each([
    ["redirect", { redirects: 1 }],
    ["endpoint origin", { endpointOrigin: "https://attacker.example.test" }],
    ["connected origin", { connectedOrigin: "https://attacker.example.test" }],
    ["service identity", { serviceId: "attacker-service" }],
    ["policy attestation", { policyAttestationDigest: "0".repeat(64) }],
  ])("rejects a mismatched trusted-connection %s report and cancels its body", async (_label, override) => {
    const cancel = vi.fn();
    const ledger = ledgerWith(async (attempt: RemoteHermesAttemptEnvelope) => receiptFor(attempt));
    const transport = {
      dispatch: vi.fn(async () => ({
        response: new Response(new ReadableStream<Uint8Array>({ cancel })),
        connection: {
          version: "remote-hermes-connected-origin/v1",
          endpointOrigin: "https://hermes.example.test",
          connectedOrigin: "https://hermes.example.test",
          connectedAddress: "93.184.216.34",
          redirects: 0,
          serviceId: "hermes-service",
          policyAttestationDigest: JSON.parse(remoteEnv().SAFECLAW_REMOTE_HERMES_POLICY_ATTESTATION).attestationDigest,
          ...override,
        } as unknown as RemoteHermesTrustedConnection,
      })),
    };
    const runtime = createRemoteHermesRuntime(runtimeDependencies({
      attemptLedger: ledger,
      trustedTransport: transport,
    }));
    expect(runtime).toBeDefined();
    if (!runtime) return;

    await expect(runtime.planner(plannerInput())).rejects.toMatchObject({
      code: "ENGINE_EXECUTION_ATTESTATION_UNPROVEN",
    });
    expect(cancel).toHaveBeenCalledTimes(1);
  });
});
