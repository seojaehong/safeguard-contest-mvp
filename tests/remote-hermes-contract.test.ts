import { describe, expect, it } from "vitest";

import {
  createRemoteHermesAttemptEnvelope,
  createRemoteHermesAttemptReceipt,
  createRemoteHermesReplayGuard,
  createRemoteHermesLogicalRequest,
  digestRemoteHermesValue,
  signRemoteHermesDigest,
  validateRemoteHermesResponse,
  type RemoteHermesClaimsProjection,
  type RemoteHermesPromptProjection,
} from "@/lib/remote-hermes-contract";

function logicalRequest() {
  const promptProjection: RemoteHermesPromptProjection = {
    schemaVersion: "prompt-projection/v1",
    jurisdiction: "KR",
    language: "ko",
    outputIntent: "safety_chat",
    taskIntent: "naturalize_safety_claims",
  };
  const claimsProjection: RemoteHermesClaimsProjection = {
    schemaVersion: "claims-projection/v1",
    entries: [{
      claimId: "claim:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      claimKind: "control",
      publicCorpusAttestation: "verified_public_safety_corpus",
      citations: [{
        citationId: "citation:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
        sourceLabelCode: "kosha_guide",
        provenanceClass: "kosha_guide",
        sourceRefDigest: "cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
      }],
    }],
    fieldClassifications: {
      "/entries/0/claimId": "opaque_claim_id",
      "/entries/0/claimKind": "closed_claim_kind",
      "/entries/0/publicCorpusAttestation": "verified_public_corpus_attestation",
      "/entries/0/citations/0/citationId": "opaque_citation_id",
      "/entries/0/citations/0/sourceLabelCode": "closed_source_label_code",
      "/entries/0/citations/0/provenanceClass": "public_provenance_class",
      "/entries/0/citations/0/sourceRefDigest": "non_reversible_source_digest",
    },
  };
  return createRemoteHermesLogicalRequest({
    runId: "run-1",
    organizationId: "org-1",
    siteId: "site-1",
    actorRef: "actor-opaque-1",
    evidenceDigest: "dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd",
    promptProjection,
    claimsProjection,
    policyVersion: "remote-naturalizer-policy/v1",
    logicalBudget: {
      deadlineAt: "2026-07-16T15:00:00.000Z",
      providerCalls: 1,
      outputBytes: 8192,
      retryAllowance: 0,
    },
  });
}

describe("remote Hermes contract", () => {
  it("bounds process-local replay state and cleans up only after TTL expiry", () => {
    let now = 0;
    const guard = createRemoteHermesReplayGuard({
      ttlMs: 100,
      maxEntries: 2,
      now: () => now,
    });

    expect(guard.consume("receipt-a")).toBe(true);
    expect(guard.consume("receipt-a")).toBe(false);
    expect(guard.consume("receipt-b")).toBe(true);
    expect(guard.consume("receipt-c")).toBe(false);
    now = 101;
    expect(guard.consume("receipt-c")).toBe(true);
  });

  it("builds a closed logical request from minimized prompt and public claims projections", () => {
    const promptProjection: RemoteHermesPromptProjection = {
      schemaVersion: "prompt-projection/v1",
      jurisdiction: "KR",
      language: "ko",
      outputIntent: "safety_chat",
      taskIntent: "naturalize_safety_claims",
    };
    const claimsProjection: RemoteHermesClaimsProjection = {
      schemaVersion: "claims-projection/v1",
      entries: [{
        claimId: "claim:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        claimKind: "control",
        publicCorpusAttestation: "verified_public_safety_corpus",
        citations: [{
          citationId: "citation:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
          sourceLabelCode: "kosha_guide",
          provenanceClass: "kosha_guide",
          sourceRefDigest: "cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
        }],
      }],
      fieldClassifications: {
        "/entries/0/claimId": "opaque_claim_id",
        "/entries/0/claimKind": "closed_claim_kind",
        "/entries/0/publicCorpusAttestation": "verified_public_corpus_attestation",
        "/entries/0/citations/0/citationId": "opaque_citation_id",
        "/entries/0/citations/0/sourceLabelCode": "closed_source_label_code",
        "/entries/0/citations/0/provenanceClass": "public_provenance_class",
        "/entries/0/citations/0/sourceRefDigest": "non_reversible_source_digest",
      },
    };

    const request = logicalRequest();

    expect(request).toMatchObject({
      contractVersion: "engine-remote/v1",
      purpose: "naturalize_only",
      promptProjection,
      claimsProjection,
      logicalRequestDigest: expect.stringMatching(/^[a-f0-9]{64}$/u),
    });
    expect(JSON.stringify(request)).not.toMatch(/raw user words|tenant memory|photo bytes|oauth token|supabase key/i);
  });

  it("keeps the logical digest stable while signing each fresh attempt envelope", () => {
    const logical = logicalRequest();
    const common = {
      logical,
      attemptNumber: 1 as const,
      attemptBudget: { providerCalls: 1 as const, outputBytes: 8192 },
      issuer: "safeclaw-control-plane",
      audience: "hermes-gateway",
      keyId: "safeclaw-key-1",
      signingSecret: "s".repeat(32),
    };
    const first = createRemoteHermesAttemptEnvelope({
      ...common,
      requestId: "request-1",
      attemptId: "attempt-1",
      nonce: "nonce-1",
      issuedAt: "2026-07-16T14:59:00.000Z",
      expiresAt: "2026-07-16T14:59:30.000Z",
    });
    const second = createRemoteHermesAttemptEnvelope({
      ...common,
      requestId: "request-2",
      attemptId: "attempt-2",
      nonce: "nonce-2",
      issuedAt: "2026-07-16T14:59:01.000Z",
      expiresAt: "2026-07-16T14:59:31.000Z",
    });

    expect(first.logicalRequestDigest).toBe(second.logicalRequestDigest);
    expect(first.logicalRequestDigest).toBe(logical.logicalRequestDigest);
    expect(first.attemptEnvelopeDigest).not.toBe(second.attemptEnvelopeDigest);
    expect(first.serviceAssertion.signature).not.toBe(second.serviceAssertion.signature);
  });

  it.each([
    ["text", "김민수"],
    ["text", "서울시 성동구 성수동 123-4"],
    ["text", "국민은행 123456-78-901234"],
    ["text", "M12345678"],
    ["text", "900101-5123456"],
    ["displayLabel", "성수 2공구 A현장"],
  ])("rejects arbitrary %s field carrying identity data: %s", (field, sensitiveValue) => {
    const base = logicalRequest();
    const claimsProjection = structuredClone(base.claimsProjection) as RemoteHermesClaimsProjection;
    const entry = claimsProjection.entries[0] as unknown as Record<string, unknown>;
    if (field === "displayLabel") {
      const citation = (entry.citations as unknown[])[0] as Record<string, unknown>;
      citation[field] = sensitiveValue;
    } else {
      entry[field] = sensitiveValue;
    }

    expect(() => createRemoteHermesLogicalRequest({
      runId: base.runId,
      organizationId: base.organizationId,
      siteId: base.siteId,
      actorRef: base.actorRef,
      evidenceDigest: base.evidenceDigest,
      promptProjection: base.promptProjection,
      claimsProjection,
      policyVersion: base.policyVersion,
      logicalBudget: base.logicalBudget,
    })).toThrow(expect.objectContaining({ code: "REMOTE_REQUEST_INVALID" }));
  });

  it("validates every response binding and consumes the signed receipt once", () => {
    const attempt = createRemoteHermesAttemptEnvelope({
      logical: logicalRequest(),
      requestId: "request-1",
      attemptId: "attempt-1",
      attemptNumber: 1,
      attemptBudget: { providerCalls: 1, outputBytes: 8192 },
      issuer: "safeclaw-control-plane",
      audience: "hermes-gateway",
      keyId: "safeclaw-key-1",
      signingSecret: "s".repeat(32),
      nonce: "nonce-1",
      issuedAt: "2026-07-16T14:59:00.000Z",
      expiresAt: "2026-07-16T14:59:30.000Z",
    });
    const attemptReceipt = createRemoteHermesAttemptReceipt({
      receiptId: "ledger-receipt-1",
      attemptEnvelopeDigest: attempt.attemptEnvelopeDigest,
      reservedAt: "2026-07-16T14:59:00.000Z",
    });
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
      attemptLedgerReceiptDigest: attemptReceipt.receiptDigest,
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
      latencyMs: 25,
      terminalStatus: "succeeded" as const,
      selectedClaims: [{
        claimId: attempt.claimsProjection.entries[0].claimId,
        citationIds: [attempt.claimsProjection.entries[0].citations[0].citationId],
      }],
    };
    const responseEnvelopeDigest = digestRemoteHermesValue(unsigned);
    const serviceId = "hermes-service";
    const response = {
      ...unsigned,
      responseEnvelopeDigest,
      serviceReceipt: {
        responseEnvelopeDigest,
        attemptEnvelopeDigest: attempt.attemptEnvelopeDigest,
        requestNonce: attempt.nonce,
        serviceId,
        keyId: "hermes-key-1",
        signature: signRemoteHermesDigest(
          "v".repeat(32),
          `safeclaw-engine-remote-response/v1:${serviceId}:${attempt.attemptEnvelopeDigest}`,
          responseEnvelopeDigest,
        ),
      },
    };
    const replayGuard = createRemoteHermesReplayGuard();

    expect(() => validateRemoteHermesResponse({
      response: { ...response, organizationId: "org-attacker" },
      attempt,
      attemptReceiptDigest: attemptReceipt.receiptDigest,
      expectedServiceId: serviceId,
      expectedKeyId: "hermes-key-1",
      verificationSecret: "v".repeat(32),
      now: new Date("2026-07-16T14:59:20.000Z"),
      replayGuard: createRemoteHermesReplayGuard(),
    })).toThrow(expect.objectContaining({ code: "REMOTE_TENANT_BINDING_REJECTED" }));
    expect(() => validateRemoteHermesResponse({
      response,
      attempt,
      attemptReceiptDigest: attemptReceipt.receiptDigest,
      expectedServiceId: serviceId,
      expectedKeyId: "hermes-key-1",
      verificationSecret: "v".repeat(32),
      now: new Date("2026-07-16T14:59:31.000Z"),
      replayGuard: createRemoteHermesReplayGuard(),
    })).toThrow(expect.objectContaining({ code: "REMOTE_EXPIRED" }));
    expect(() => validateRemoteHermesResponse({
      response,
      attempt,
      attemptReceiptDigest: attemptReceipt.receiptDigest,
      expectedServiceId: serviceId,
      expectedKeyId: "hermes-key-1",
      verificationSecret: "v".repeat(32),
      now: new Date("2026-07-16T14:59:30.000Z"),
      replayGuard: createRemoteHermesReplayGuard(),
    })).toThrow(expect.objectContaining({ code: "REMOTE_EXPIRED" }));
    expect(() => validateRemoteHermesResponse({
      response: { ...response, responseEnvelopeDigest: "0".repeat(64) },
      attempt,
      attemptReceiptDigest: attemptReceipt.receiptDigest,
      expectedServiceId: serviceId,
      expectedKeyId: "hermes-key-1",
      verificationSecret: "v".repeat(32),
      now: new Date("2026-07-16T14:59:20.000Z"),
      replayGuard: createRemoteHermesReplayGuard(),
    })).toThrow(expect.objectContaining({ code: "REMOTE_RESPONSE_INVALID" }));
    expect(() => validateRemoteHermesResponse({
      response: {
        ...response,
        serviceReceipt: { ...response.serviceReceipt, signature: "0".repeat(64) },
      },
      attempt,
      attemptReceiptDigest: attemptReceipt.receiptDigest,
      expectedServiceId: serviceId,
      expectedKeyId: "hermes-key-1",
      verificationSecret: "v".repeat(32),
      now: new Date("2026-07-16T14:59:20.000Z"),
      replayGuard: createRemoteHermesReplayGuard(),
    })).toThrow(expect.objectContaining({ code: "REMOTE_RESPONSE_SIGNATURE_INVALID" }));

    expect(validateRemoteHermesResponse({
      response,
      attempt,
      attemptReceiptDigest: attemptReceipt.receiptDigest,
      expectedServiceId: serviceId,
      expectedKeyId: "hermes-key-1",
      verificationSecret: "v".repeat(32),
      now: new Date("2026-07-16T14:59:20.000Z"),
      replayGuard,
    })).toMatchObject({ kind: "success", selectedClaims: unsigned.selectedClaims });
    expect(() => validateRemoteHermesResponse({
      response,
      attempt,
      attemptReceiptDigest: attemptReceipt.receiptDigest,
      expectedServiceId: serviceId,
      expectedKeyId: "hermes-key-1",
      verificationSecret: "v".repeat(32),
      now: new Date("2026-07-16T14:59:20.000Z"),
      replayGuard,
    })).toThrow(expect.objectContaining({ code: "REMOTE_REPLAY_REJECTED" }));

    const unsignedFailure = {
      responseVersion: "engine-remote-response/v1" as const,
      kind: "failure" as const,
      runId: attempt.runId,
      logicalRequestDigest: attempt.logicalRequestDigest,
      requestId: attempt.requestId,
      attemptId: attempt.attemptId,
      organizationId: attempt.organizationId,
      siteId: attempt.siteId,
      attemptEnvelopeDigest: attempt.attemptEnvelopeDigest,
      attemptLedgerReceiptDigest: attemptReceipt.receiptDigest,
      promptProjectionDigest: attempt.promptProjectionDigest,
      claimsProjectionDigest: attempt.claimsProjectionDigest,
      evidenceDigest: attempt.evidenceDigest,
      usage: unsigned.usage,
      latencyMs: 30,
      terminalStatus: "failed" as const,
      error: {
        taxonomyVersion: "engine-remote-error/v1" as const,
        code: "REMOTE_PROVIDER_TIMEOUT" as const,
        origin: "worker" as const,
      },
    };
    const failureDigest = digestRemoteHermesValue(unsignedFailure);
    const failureResponse = {
      ...unsignedFailure,
      responseEnvelopeDigest: failureDigest,
      serviceReceipt: {
        responseEnvelopeDigest: failureDigest,
        attemptEnvelopeDigest: attempt.attemptEnvelopeDigest,
        requestNonce: attempt.nonce,
        serviceId,
        keyId: "hermes-key-1",
        signature: signRemoteHermesDigest(
          "v".repeat(32),
          `safeclaw-engine-remote-response/v1:${serviceId}:${attempt.attemptEnvelopeDigest}`,
          failureDigest,
        ),
      },
    };
    expect(validateRemoteHermesResponse({
      response: failureResponse,
      attempt,
      attemptReceiptDigest: attemptReceipt.receiptDigest,
      expectedServiceId: serviceId,
      expectedKeyId: "hermes-key-1",
      verificationSecret: "v".repeat(32),
      now: new Date("2026-07-16T14:59:20.000Z"),
      replayGuard: createRemoteHermesReplayGuard(),
    })).toMatchObject({
      kind: "failure",
      error: { code: "REMOTE_PROVIDER_TIMEOUT" },
    });

    const verifyOnlyGuard = createRemoteHermesReplayGuard();
    expect(validateRemoteHermesResponse({
      response,
      attempt,
      attemptReceiptDigest: attemptReceipt.receiptDigest,
      expectedServiceId: serviceId,
      expectedKeyId: "hermes-key-1",
      verificationSecret: "v".repeat(32),
      now: new Date("2026-07-16T14:59:20.000Z"),
      replayGuard: verifyOnlyGuard,
      consumeReplay: false,
    })).toMatchObject({ kind: "success" });
    expect(validateRemoteHermesResponse({
      response,
      attempt,
      attemptReceiptDigest: attemptReceipt.receiptDigest,
      expectedServiceId: serviceId,
      expectedKeyId: "hermes-key-1",
      verificationSecret: "v".repeat(32),
      now: new Date("2026-07-16T14:59:20.000Z"),
      replayGuard: verifyOnlyGuard,
      consumeReplay: false,
    })).toMatchObject({ kind: "success" });
    expect(verifyOnlyGuard.consume(`${attempt.nonce}:${responseEnvelopeDigest}`)).toBe(true);

    for (const diagnosticsRef of [
      "https://attacker.example/detail",
      "operator@example.test",
      "010-1234-5678",
      "raw detail with spaces",
      "내부 오류 상세",
      "UPPERCASE-ID",
    ]) {
      const unsafeFailure = {
        ...unsignedFailure,
        error: { ...unsignedFailure.error, diagnosticsRef },
      };
      const unsafeDigest = digestRemoteHermesValue(unsafeFailure);
      expect(() => validateRemoteHermesResponse({
        response: {
          ...unsafeFailure,
          responseEnvelopeDigest: unsafeDigest,
          serviceReceipt: {
            responseEnvelopeDigest: unsafeDigest,
            attemptEnvelopeDigest: attempt.attemptEnvelopeDigest,
            requestNonce: attempt.nonce,
            serviceId,
            keyId: "hermes-key-1",
            signature: signRemoteHermesDigest(
              "v".repeat(32),
              `safeclaw-engine-remote-response/v1:${serviceId}:${attempt.attemptEnvelopeDigest}`,
              unsafeDigest,
            ),
          },
        },
        attempt,
        attemptReceiptDigest: attemptReceipt.receiptDigest,
        expectedServiceId: serviceId,
        expectedKeyId: "hermes-key-1",
        verificationSecret: "v".repeat(32),
        now: new Date("2026-07-16T14:59:20.000Z"),
        replayGuard: createRemoteHermesReplayGuard(),
      })).toThrow(expect.objectContaining({ code: "REMOTE_RESPONSE_INVALID" }));
    }
  });
});
