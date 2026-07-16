import { resolveEngineMode, type EngineMode, type EnvLike } from "@/lib/engine-adapter";

export type EngineRequestedMode = EngineMode | "unsupported";
export type EngineRuntimeReadinessState =
  | "disabled"
  | "configuration-required"
  | "local-attestation-required"
  | "remote-attestation-required";
export type EngineRuntimeReadinessIssue =
  | "unsupported-mode"
  | "vercel-local-runtime-forbidden"
  | "local-runtime-flag-required"
  | "hermes-poc-flag-required"
  | "organization-binding-required"
  | "site-binding-required"
  | "remote-endpoint-required"
  | "remote-tenant-allowlist-required"
  | "remote-request-signer-required"
  | "remote-response-verifier-required";

export type EngineRuntimeReadiness = {
  requestedMode: EngineRequestedMode;
  resolvedMode: EngineMode;
  state: EngineRuntimeReadinessState;
  issueCodes: readonly EngineRuntimeReadinessIssue[];
};

function requestedMode(env: EnvLike): EngineRequestedMode {
  const value = env.SAFECLAW_ENGINE_MODE?.trim();
  if (!value || value === "disabled") return "disabled";
  if (value === "local-openclaw" || value === "experimental-hermes" || value === "remote-hermes") {
    return value;
  }
  return "unsupported";
}

export function assessEngineRuntimeReadiness(env: EnvLike): EngineRuntimeReadiness {
  const requested = requestedMode(env);
  const resolved = resolveEngineMode(env);
  if (requested === "disabled") {
    return {
      requestedMode: requested,
      resolvedMode: resolved,
      state: "disabled",
      issueCodes: [],
    };
  }
  if (requested === "unsupported") {
    return {
      requestedMode: requested,
      resolvedMode: resolved,
      state: "configuration-required",
      issueCodes: ["unsupported-mode"],
    };
  }

  if (requested === "remote-hermes") {
    const issueCodes: EngineRuntimeReadinessIssue[] = [];
    let endpointReady = false;
    try {
      const endpoint = new URL(env.SAFECLAW_REMOTE_HERMES_ENDPOINT?.trim() ?? "");
      endpointReady = endpoint.protocol === "https:" && !endpoint.username && !endpoint.password && !endpoint.hash;
    } catch {
      endpointReady = false;
    }
    if (!endpointReady) issueCodes.push("remote-endpoint-required");
    const allowlist = env.SAFECLAW_REMOTE_HERMES_TENANT_ALLOWLIST?.trim();
    if (!allowlist || allowlist.split(",").some((entry) => (
      !/^[A-Za-z0-9._-]+:[A-Za-z0-9._-]+$/u.test(entry.trim())
    ))) {
      issueCodes.push("remote-tenant-allowlist-required");
    }
    if (!env.SAFECLAW_REMOTE_HERMES_ISSUER?.trim()
      || !env.SAFECLAW_REMOTE_HERMES_AUDIENCE?.trim()
      || !env.SAFECLAW_REMOTE_HERMES_REQUEST_KEY_ID?.trim()
      || Buffer.byteLength(env.SAFECLAW_REMOTE_HERMES_REQUEST_SIGNING_SECRET?.trim() ?? "", "utf8") < 32) {
      issueCodes.push("remote-request-signer-required");
    }
    if (!env.SAFECLAW_REMOTE_HERMES_SERVICE_ID?.trim()
      || !env.SAFECLAW_REMOTE_HERMES_RESPONSE_KEY_ID?.trim()
      || Buffer.byteLength(env.SAFECLAW_REMOTE_HERMES_RESPONSE_VERIFICATION_SECRET?.trim() ?? "", "utf8") < 32) {
      issueCodes.push("remote-response-verifier-required");
    }
    return {
      requestedMode: requested,
      resolvedMode: resolved,
      state: issueCodes.length > 0 ? "configuration-required" : "remote-attestation-required",
      issueCodes,
    };
  }

  const issueCodes: EngineRuntimeReadinessIssue[] = [];
  if (env.VERCEL) issueCodes.push("vercel-local-runtime-forbidden");
  if (requested === "experimental-hermes" && env.SAFECLAW_HERMES_LOCAL_POC !== "1") {
    issueCodes.push("hermes-poc-flag-required");
  }
  if (env.OPENCLAW_LOCAL?.trim() !== "1") issueCodes.push("local-runtime-flag-required");
  if (requested === "experimental-hermes") {
    if (!env.SAFECLAW_HERMES_BOUND_ORGANIZATION_ID?.trim()) {
      issueCodes.push("organization-binding-required");
    }
    if (!env.SAFECLAW_HERMES_BOUND_SITE_ID?.trim()) {
      issueCodes.push("site-binding-required");
    }
  }

  return {
    requestedMode: requested,
    resolvedMode: resolved,
    state: issueCodes.length > 0 ? "configuration-required" : "local-attestation-required",
    issueCodes,
  };
}
