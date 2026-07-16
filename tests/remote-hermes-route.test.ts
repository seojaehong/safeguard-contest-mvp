import { describe, expect, it, vi } from "vitest";

import { createProductionEngineAdapter } from "@/lib/openclaw-broker-route";
import { assessEngineRuntimeReadiness } from "@/lib/engine-runtime-readiness-policy";
import {
  createRemoteHermesPolicyAttestation,
  digestRemoteHermesValue,
  signRemoteHermesDigest,
} from "@/lib/remote-hermes-contract";

function createRemoteEnv() {
  const now = Date.now();
  return {
    SAFECLAW_ENGINE_MODE: "remote-hermes",
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
      issuedAt: new Date(now - 1_000).toISOString(),
      expiresAt: new Date(now + 60_000).toISOString(),
      keyId: "hermes-response-key",
      signingSecret: "v".repeat(32),
    })),
  };
}

function signedPolicyWith(overrides: Record<string, unknown>): string {
  const base = createRemoteHermesPolicyAttestation({
    serviceId: "hermes-service",
    endpointOrigin: "https://hermes.example.test",
    issuedAt: new Date(Date.now() - 1_000).toISOString(),
    expiresAt: new Date(Date.now() + 60_000).toISOString(),
    keyId: "hermes-response-key",
    signingSecret: "v".repeat(32),
  }) as unknown as Record<string, unknown>;
  const unsigned = Object.fromEntries(Object.entries(base).filter(([key]) => (
    key !== "attestationDigest" && key !== "receipt"
  )));
  Object.assign(unsigned, overrides);
  const attestationDigest = digestRemoteHermesValue(unsigned);
  return JSON.stringify({
    ...unsigned,
    attestationDigest,
    receipt: {
      keyId: "hermes-response-key",
      signature: signRemoteHermesDigest(
        "v".repeat(32),
        "safeclaw-remote-policy-attestation/v1:hermes-service",
        attestationDigest,
      ),
    },
  });
}

describe("remote Hermes production route", () => {
  it("keeps traffic disabled without a signed remote policy attestation", async () => {
    const fetchImpl = vi.fn();
    const env = createRemoteEnv();
    delete (env as { SAFECLAW_REMOTE_HERMES_POLICY_ATTESTATION?: string }).SAFECLAW_REMOTE_HERMES_POLICY_ATTESTATION;
    const engine = createProductionEngineAdapter(env, {
      remoteHermes: { fetchImpl },
    });
    const context = {
      userId: "user-1",
      organizationId: "org-1",
      siteId: "site-1",
      site: { siteName: "현장", region: "서울", briefingQuestion: null },
    };

    await expect(engine.checkAvailability(context)).rejects.toMatchObject({
      code: "ENGINE_UNAVAILABLE",
      status: 503,
    });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("rejects an attested HTTPS IP-literal endpoint before network access", async () => {
    const fetchImpl = vi.fn();
    const env = createRemoteEnv();
    env.SAFECLAW_REMOTE_HERMES_ENDPOINT = "https://127.0.0.1/v1/naturalize";
    env.SAFECLAW_REMOTE_HERMES_HOST_ALLOWLIST = "127.0.0.1";
    env.SAFECLAW_REMOTE_HERMES_POLICY_ATTESTATION = JSON.stringify(
      createRemoteHermesPolicyAttestation({
        serviceId: "hermes-service",
        endpointOrigin: "https://127.0.0.1",
        issuedAt: new Date(Date.now() - 1_000).toISOString(),
        expiresAt: new Date(Date.now() + 60_000).toISOString(),
        keyId: "hermes-response-key",
        signingSecret: "v".repeat(32),
      }),
    );
    const engine = createProductionEngineAdapter(env, { remoteHermes: { fetchImpl } });

    await expect(engine.checkAvailability({
      userId: "user-1",
      organizationId: "org-1",
      siteId: "site-1",
      site: { siteName: "현장", region: "서울", briefingQuestion: null },
    })).rejects.toMatchObject({ code: "ENGINE_UNAVAILABLE" });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it.each([
    ["non-empty tool allowlist", { toolPolicy: { allow: ["read"], deny: ["*"] } }],
    ["wrong service identity", { serviceId: "attacker-service" }],
    ["optional preflight", { preflightMode: "optional" }],
    ["process-local ledger", { ledgerMode: "process-local" }],
    ["process-local replay", { replayMode: "process-local" }],
  ])("rejects signed policy attestation with %s", async (_label, overrides) => {
    const fetchImpl = vi.fn();
    const env = createRemoteEnv();
    env.SAFECLAW_REMOTE_HERMES_POLICY_ATTESTATION = signedPolicyWith(overrides);
    const engine = createProductionEngineAdapter(env, { remoteHermes: { fetchImpl } });

    await expect(engine.checkAvailability({
      userId: "user-1",
      organizationId: "org-1",
      siteId: "site-1",
      site: { siteName: "현장", region: "서울", briefingQuestion: null },
    })).rejects.toMatchObject({ code: "ENGINE_UNAVAILABLE" });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("revalidates policy attestation expiry before every adapter attempt", async () => {
    let now = new Date();
    const fetchImpl = vi.fn();
    const engine = createProductionEngineAdapter(createRemoteEnv(), {
      remoteHermes: { fetchImpl, now: () => now },
    });
    now = new Date(now.getTime() + 120_000);

    await expect(engine.checkAvailability({
      userId: "user-1",
      organizationId: "org-1",
      siteId: "site-1",
      site: { siteName: "현장", region: "서울", briefingQuestion: null },
    })).rejects.toMatchObject({ code: "ENGINE_EXECUTION_ATTESTATION_UNPROVEN" });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("composes a tool-free naturalizer without widening SafeClaw authority", () => {
    const engine = createProductionEngineAdapter(createRemoteEnv());

    expect(engine).toMatchObject({
      id: "remote-hermes",
      runtime: "hermes",
      capabilities: ["stream_text"],
      authority: {
        canMutate: false,
        canPublish: false,
        humanConfirmationRequired: true,
      },
    });
  });

  it.each([
    "SAFECLAW_REMOTE_HERMES_ENDPOINT",
    "SAFECLAW_REMOTE_HERMES_TENANT_ALLOWLIST",
    "SAFECLAW_REMOTE_HERMES_REQUEST_SIGNING_SECRET",
  ] as const)("fails closed with zero network calls when %s is missing", async (missingKey) => {
    const fetchImpl = vi.fn();
    const engine = createProductionEngineAdapter({
      ...createRemoteEnv(),
      [missingKey]: undefined,
    }, { remoteHermes: { fetchImpl } });
    const context = {
      userId: "user-1",
      organizationId: "org-1",
      siteId: "site-1",
      site: { siteName: "현장", region: "서울", briefingQuestion: null },
    };

    await expect(engine.checkAvailability(context)).rejects.toMatchObject({
      code: "ENGINE_UNAVAILABLE",
      status: 503,
    });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("reports remote configuration separately from local OpenClaw attestation", () => {
    expect(assessEngineRuntimeReadiness({
      ...createRemoteEnv(),
      VERCEL: "1",
    })).toEqual({
      requestedMode: "remote-hermes",
      resolvedMode: "remote-hermes",
      state: "remote-evaluation-ready",
      issueCodes: [],
    });

    expect(assessEngineRuntimeReadiness({
      SAFECLAW_ENGINE_MODE: "remote-hermes",
    })).toMatchObject({
      state: "configuration-required",
      issueCodes: [
        "remote-host-allowlist-required",
        "remote-endpoint-required",
        "remote-tenant-allowlist-required",
        "remote-request-signer-required",
        "remote-response-verifier-required",
        "remote-policy-attestation-required",
      ],
    });
  });

  it("uses the runtime URL normalization and hostname allowlist policy in readiness", () => {
    const env = createRemoteEnv();
    env.SAFECLAW_REMOTE_HERMES_ENDPOINT = "https://hermes.example.test:443/v1/naturalize";

    expect(assessEngineRuntimeReadiness(env)).toMatchObject({
      state: "configuration-required",
      issueCodes: expect.arrayContaining(["remote-endpoint-required"]),
    });

    const missingAllowlist = createRemoteEnv();
    delete (missingAllowlist as { SAFECLAW_REMOTE_HERMES_HOST_ALLOWLIST?: string })
      .SAFECLAW_REMOTE_HERMES_HOST_ALLOWLIST;
    expect(assessEngineRuntimeReadiness(missingAllowlist)).toMatchObject({
      state: "configuration-required",
      issueCodes: expect.arrayContaining(["remote-host-allowlist-required"]),
    });
  });
});
