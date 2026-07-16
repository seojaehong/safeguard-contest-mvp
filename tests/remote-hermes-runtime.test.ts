import { describe, expect, it, vi } from "vitest";

import { buildDbHarnessPacket } from "@/lib/db-harness";
import type { HermesPlannerInput, HermesPlannerTextOutput } from "@/lib/hermes-engine-adapter";
import {
  digestRemoteHermesValue,
  signRemoteHermesDigest,
  type RemoteHermesAttemptEnvelope,
} from "@/lib/remote-hermes-contract";
import { createRemoteHermesRuntime } from "@/lib/remote-hermes-runtime";

describe("remote Hermes runtime", () => {
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
    const runtime = createRemoteHermesRuntime({
      env: {
        SAFECLAW_REMOTE_HERMES_ENDPOINT: "https://hermes.example.test/v1/naturalize",
        SAFECLAW_REMOTE_HERMES_TENANT_ALLOWLIST: "org-1:site-1",
        SAFECLAW_REMOTE_HERMES_ISSUER: "safeclaw-control-plane",
        SAFECLAW_REMOTE_HERMES_AUDIENCE: "hermes-gateway",
        SAFECLAW_REMOTE_HERMES_REQUEST_KEY_ID: "safeclaw-request-key",
        SAFECLAW_REMOTE_HERMES_REQUEST_SIGNING_SECRET: "s".repeat(32),
        SAFECLAW_REMOTE_HERMES_SERVICE_ID: "hermes-service",
        SAFECLAW_REMOTE_HERMES_RESPONSE_KEY_ID: "hermes-response-key",
        SAFECLAW_REMOTE_HERMES_RESPONSE_VERIFICATION_SECRET: "v".repeat(32),
      },
      fetchImpl,
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
        citations: [{
          citationId: `citation:${"b".repeat(64)}`,
          label: "KOSHA 실행지침: 내부 렌더 라벨",
          publicLabel: "KOSHA 실행지침",
          provenanceClass: "kosha_guide",
          sourceRefDigest: "c".repeat(64),
        }],
      }],
      emitText: (output) => emitted.push(output),
      signal: new AbortController().signal,
      requestReadTool: async () => ({ forbidden: true }),
    };

    await runtime.planner(input);

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(outbound).not.toContain(sensitivePrompt);
    expect(outbound).not.toMatch(/김민수|010-1234-5678|성수 현장|서울|improvementMemory|workpackMemory|requestReadTool|mcp|oauth|supabase/i);
    expect(JSON.parse(outbound)).toMatchObject({
      promptProjection: {
        jurisdiction: "KR",
        language: "ko",
        outputIntent: "safety_chat",
        taskIntent: "naturalize_safety_claims",
      },
      attemptNumber: 1,
    });
    expect(emitted[0]?.attestation.claims).toEqual([{
      claimId: `claim:${"a".repeat(64)}`,
      citationIds: [`citation:${"b".repeat(64)}`],
    }]);
  });
});
