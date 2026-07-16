import { resolveEngineMode, type EngineMode, type EnvLike } from "@/lib/engine-adapter";

export type EngineRequestedMode = EngineMode | "unsupported";
export type EngineRuntimeReadinessState =
  | "disabled"
  | "configuration-required"
  | "local-attestation-required";
export type EngineRuntimeReadinessIssue =
  | "unsupported-mode"
  | "vercel-local-runtime-forbidden"
  | "local-runtime-flag-required"
  | "hermes-poc-flag-required"
  | "organization-binding-required"
  | "site-binding-required";

export type EngineRuntimeReadiness = {
  requestedMode: EngineRequestedMode;
  resolvedMode: EngineMode;
  state: EngineRuntimeReadinessState;
  issueCodes: readonly EngineRuntimeReadinessIssue[];
};

function requestedMode(env: EnvLike): EngineRequestedMode {
  const value = env.SAFECLAW_ENGINE_MODE?.trim();
  if (!value || value === "disabled") return "disabled";
  if (value === "local-openclaw" || value === "experimental-hermes") return value;
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
