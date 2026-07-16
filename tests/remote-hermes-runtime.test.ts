import { describe, expect, it, vi } from "vitest";

import { buildDbHarnessPacket } from "@/lib/db-harness";
import type { HermesPlannerInput, HermesPlannerTextOutput } from "@/lib/hermes-engine-adapter";
import {
  digestRemoteHermesValue,
  createRemoteHermesPolicyAttestation,
  signRemoteHermesDigest,
  type RemoteHermesAttemptEnvelope,
} from "@/lib/remote-hermes-contract";
import {
  createRemoteHermesRuntime,
  readRemoteHermesResponseBody,
} from "@/lib/remote-hermes-runtime";

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

  it("makes one tool-free request containing only closed projections and emits attested claims", async () => {
    const sensitivePrompt = "김민수 010-1234-5678 성수동 현장 사진을 보고 점검해줘";
    const packet = buildDbHarnessPacket({ question: sensitivePrompt, references: [] });
    let outbound = "";
    const fetchImpl = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      outbound = String(init?.body ?? "");
      const attempt = JSON.parse(outbound) as RemoteHermesAttemptEnvelope;
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
          claimId: attempt.claimsProjection.entries[0].claimId,
          citationIds: [attempt.claimsProjection.entries[0].citations[0].citationId],
        }],
      };
      const responseEnvelopeDigest = digestRemoteHermesValue(unsigned);
      const serviceId = "hermes-service";
      return new Response(JSON.stringify({
        ...unsigned,
        responseEnvelopeDigest,
        serviceReceipt: {
          responseEnvelopeDigest,
          attemptEnvelopeDigest: attempt.attemptEnvelopeDigest,
          requestNonce: attempt.nonce,
          serviceId,
          keyId: "hermes-response-key",
          signature: signRemoteHermesDigest(
            "v".repeat(32),
            `safeclaw-engine-remote-response/v1:${serviceId}:${attempt.attemptEnvelopeDigest}`,
            responseEnvelopeDigest,
          ),
        },
      }), { status: 200, headers: { "Content-Type": "application/json" } });
    });
    const env = {
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
      SAFECLAW_REMOTE_HERMES_POLICY_ATTESTATION: JSON.stringify(
        createRemoteHermesPolicyAttestation({
          serviceId: "hermes-service",
          endpointOrigin: "https://hermes.example.test",
          issuedAt: "2026-07-16T14:58:59.000Z",
          expiresAt: "2026-07-16T15:59:00.000Z",
          keyId: "hermes-response-key",
          signingSecret: "v".repeat(32),
        }),
      ),
    };
    const runtime = createRemoteHermesRuntime({
      env,
      fetchImpl,
      resolveHostname: async () => ["93.184.216.34"],
      now: () => new Date("2026-07-16T14:59:00.000Z"),
      randomId: (() => {
        const ids = ["run-1", "request-1", "attempt-1"];
        return () => ids.shift() ?? "unexpected-id";
      })(),
      randomNonce: () => "nonce-1",
    });
    expect(runtime).toBeDefined();
    if (!runtime) return;
    const emitted: HermesPlannerTextOutput[] = [];
    const input: HermesPlannerInput = {
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
      prompt: sensitivePrompt,
      evidencePacket: packet,
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
      emitText: (output) => emitted.push(output),
      signal: new AbortController().signal,
      requestReadTool: async () => ({ forbidden: true }),
    };

    const privateFetch = vi.fn();
    const privateRuntime = createRemoteHermesRuntime({
      env,
      fetchImpl: privateFetch,
      resolveHostname: async () => ["169.254.169.254"],
      now: () => new Date("2026-07-16T14:59:00.000Z"),
      randomId: (() => {
        let counter = 0;
        return () => `private-${counter += 1}`;
      })(),
      randomNonce: () => "private-nonce",
    });
    expect(privateRuntime).toBeDefined();
    if (!privateRuntime) return;
    await expect(privateRuntime.planner(input)).rejects.toMatchObject({
      code: "ENGINE_EXECUTION_ATTESTATION_UNPROVEN",
    });
    expect(privateFetch).not.toHaveBeenCalled();

    const unclassifiedFetch = vi.fn();
    const unclassifiedRuntime = createRemoteHermesRuntime({
      env,
      fetchImpl: unclassifiedFetch,
      resolveHostname: async () => ["93.184.216.34"],
      now: () => new Date("2026-07-16T14:59:00.000Z"),
      randomId: () => "unclassified-run",
      randomNonce: () => "unclassified-nonce",
    });
    expect(unclassifiedRuntime).toBeDefined();
    if (!unclassifiedRuntime) return;
    const unclassifiedInput: HermesPlannerInput = {
      ...input,
      evidenceClaims: input.evidenceClaims.map((claim) => ({
        ...claim,
        citations: claim.citations.map((citation) => ({ ...citation })),
      })),
    };
    delete (unclassifiedInput.evidenceClaims[0] as {
      remotePublicProvenance?: "verified_public_safety_corpus";
    }).remotePublicProvenance;
    await expect(unclassifiedRuntime.planner(unclassifiedInput)).rejects.toMatchObject({
      code: "ENGINE_EXECUTION_ATTESTATION_UNPROVEN",
    });
    expect(unclassifiedFetch).not.toHaveBeenCalled();

    let dnsLookup = 0;
    const rebindingRuntime = createRemoteHermesRuntime({
      env,
      fetchImpl,
      resolveHostname: async () => {
        dnsLookup += 1;
        return dnsLookup === 1 ? ["93.184.216.34"] : ["169.254.169.254"];
      },
      now: () => new Date("2026-07-16T14:59:00.000Z"),
      randomId: (() => {
        let counter = 0;
        return () => `rebind-${counter += 1}`;
      })(),
      randomNonce: () => "rebind-nonce",
    });
    expect(rebindingRuntime).toBeDefined();
    if (!rebindingRuntime) return;
    await expect(rebindingRuntime.planner(input)).rejects.toMatchObject({
      code: "ENGINE_EXECUTION_ATTESTATION_UNPROVEN",
    });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    fetchImpl.mockClear();
    outbound = "";

    await runtime.planner(input);

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(fetchImpl.mock.calls[0]?.[1]).toMatchObject({ redirect: "error" });
    expect(outbound).not.toContain(sensitivePrompt);
    expect(outbound).not.toContain("작업 전 추락 방지 설비를 확인합니다.");
    expect(outbound).not.toContain("KOSHA 실행지침: 내부 렌더 라벨");
    expect(outbound).not.toContain("KOSHA 실행지침");
    expect(outbound).not.toMatch(/김민수|010-1234-5678|성수 현장|서울|improvementMemory|workpackMemory|requestReadTool|mcp|oauth|supabase/i);
    expect(JSON.parse(outbound)).toMatchObject({
      promptProjection: {
        jurisdiction: "KR",
        language: "ko",
        outputIntent: "safety_chat",
        taskIntent: "naturalize_safety_claims",
      },
      attemptNumber: 1,
      claimsProjection: {
        entries: [{
          claimId: `claim:${"a".repeat(64)}`,
          claimKind: "control",
          citations: [{
            citationId: `citation:${"b".repeat(64)}`,
            sourceLabelCode: "kosha_guide",
            provenanceClass: "kosha_guide",
            sourceRefDigest: "c".repeat(64),
          }],
        }],
      },
    });
    expect(emitted[0]?.attestation.claims).toEqual([{
      claimId: `claim:${"a".repeat(64)}`,
      citationIds: [`citation:${"b".repeat(64)}`],
    }]);
  });
});
