import { describe, expect, it, vi } from "vitest";

import { createProductionEngineAdapter } from "@/lib/openclaw-broker-route";
import { assessEngineRuntimeReadiness } from "@/lib/engine-runtime-readiness-policy";

const remoteEnv = {
  SAFECLAW_ENGINE_MODE: "remote-hermes",
  SAFECLAW_REMOTE_HERMES_ENDPOINT: "https://hermes.example.test/v1/naturalize",
  SAFECLAW_REMOTE_HERMES_TENANT_ALLOWLIST: "org-1:site-1",
  SAFECLAW_REMOTE_HERMES_ISSUER: "safeclaw-control-plane",
  SAFECLAW_REMOTE_HERMES_AUDIENCE: "hermes-gateway",
  SAFECLAW_REMOTE_HERMES_REQUEST_KEY_ID: "safeclaw-request-key",
  SAFECLAW_REMOTE_HERMES_REQUEST_SIGNING_SECRET: "s".repeat(32),
  SAFECLAW_REMOTE_HERMES_SERVICE_ID: "hermes-service",
  SAFECLAW_REMOTE_HERMES_RESPONSE_KEY_ID: "hermes-response-key",
  SAFECLAW_REMOTE_HERMES_RESPONSE_VERIFICATION_SECRET: "v".repeat(32),
};

describe("remote Hermes production route", () => {
  it("composes a tool-free naturalizer without widening SafeClaw authority", () => {
    const engine = createProductionEngineAdapter(remoteEnv);

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
      ...remoteEnv,
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
      ...remoteEnv,
      VERCEL: "1",
    })).toEqual({
      requestedMode: "remote-hermes",
      resolvedMode: "remote-hermes",
      state: "remote-attestation-required",
      issueCodes: [],
    });

    expect(assessEngineRuntimeReadiness({
      SAFECLAW_ENGINE_MODE: "remote-hermes",
    })).toMatchObject({
      state: "configuration-required",
      issueCodes: [
        "remote-endpoint-required",
        "remote-tenant-allowlist-required",
        "remote-request-signer-required",
        "remote-response-verifier-required",
      ],
    });
  });
});
