import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { assessEngineRuntimeReadiness } from "@/lib/engine-runtime-readiness-policy";

describe("engine runtime readiness policy", () => {
  it("keeps the engine explicitly disabled by default", () => {
    expect(assessEngineRuntimeReadiness({})).toEqual({
      requestedMode: "disabled",
      resolvedMode: "disabled",
      state: "disabled",
      issueCodes: [],
    });
  });

  it("reports every missing Hermes local POC boundary without exposing values", () => {
    expect(assessEngineRuntimeReadiness({
      SAFECLAW_ENGINE_MODE: "experimental-hermes",
    })).toEqual({
      requestedMode: "experimental-hermes",
      resolvedMode: "disabled",
      state: "configuration-required",
      issueCodes: [
        "hermes-poc-flag-required",
        "local-runtime-flag-required",
        "organization-binding-required",
        "site-binding-required",
      ],
    });
  });

  it("marks the fully bounded Hermes local POC as awaiting runtime attestation", () => {
    expect(assessEngineRuntimeReadiness({
      SAFECLAW_ENGINE_MODE: "experimental-hermes",
      SAFECLAW_HERMES_LOCAL_POC: "1",
      OPENCLAW_LOCAL: "1",
      SAFECLAW_HERMES_BOUND_ORGANIZATION_ID: "org-1",
      SAFECLAW_HERMES_BOUND_SITE_ID: "site-1",
    })).toEqual({
      requestedMode: "experimental-hermes",
      resolvedMode: "experimental-hermes",
      state: "local-attestation-required",
      issueCodes: [],
    });
  });

  it("fails closed on Vercel even when every local Hermes flag is present", () => {
    expect(assessEngineRuntimeReadiness({
      SAFECLAW_ENGINE_MODE: "experimental-hermes",
      SAFECLAW_HERMES_LOCAL_POC: "1",
      OPENCLAW_LOCAL: "1",
      SAFECLAW_HERMES_BOUND_ORGANIZATION_ID: "org-1",
      SAFECLAW_HERMES_BOUND_SITE_ID: "site-1",
      VERCEL: "1",
    })).toEqual({
      requestedMode: "experimental-hermes",
      resolvedMode: "disabled",
      state: "configuration-required",
      issueCodes: ["vercel-local-runtime-forbidden"],
    });
  });

  it("requires an explicit local runtime flag for local OpenClaw", () => {
    expect(assessEngineRuntimeReadiness({
      SAFECLAW_ENGINE_MODE: "local-openclaw",
    })).toMatchObject({
      requestedMode: "local-openclaw",
      resolvedMode: "local-openclaw",
      state: "configuration-required",
      issueCodes: ["local-runtime-flag-required"],
    });
  });

  it("uses the same trimmed local flag semantics as the OpenClaw runtime config", () => {
    expect(assessEngineRuntimeReadiness({
      SAFECLAW_ENGINE_MODE: "local-openclaw",
      OPENCLAW_LOCAL: " 1 ",
    })).toMatchObject({
      state: "local-attestation-required",
      issueCodes: [],
    });
  });

  it("rejects unsupported modes instead of silently presenting them as ready", () => {
    expect(assessEngineRuntimeReadiness({
      SAFECLAW_ENGINE_MODE: "remote-hermes",
    })).toEqual({
      requestedMode: "unsupported",
      resolvedMode: "disabled",
      state: "configuration-required",
      issueCodes: ["unsupported-mode"],
    });
  });

  it("documents the complete local runtime contract without credential values", () => {
    const example = fs.readFileSync(path.join(process.cwd(), ".env.example"), "utf8");
    for (const key of [
      "SAFECLAW_ENGINE_MODE",
      "SAFECLAW_HERMES_LOCAL_POC",
      "OPENCLAW_LOCAL",
      "OPENCLAW_BIN",
      "OPENCLAW_PROFILE",
      "OPENCLAW_AGENT",
      "OPENCLAW_CHAT_MODEL",
      "OPENCLAW_CHAT_TIMEOUT_MS",
      "OPENCLAW_MAX_CONCURRENT",
      "SAFECLAW_HERMES_BOUND_ORGANIZATION_ID",
      "SAFECLAW_HERMES_BOUND_SITE_ID",
    ]) {
      expect(example).toMatch(new RegExp(`^${key}=`, "mu"));
    }
    expect(example).toMatch(/^# OPENCLAW_MODEL=$/mu);
    expect(example).not.toMatch(/SAFECLAW_SMOKE_BEARER_TOKEN=\S+/u);
    expect(example).not.toMatch(/SAFECLAW_HERMES_BOUND_(?:ORGANIZATION|SITE)_ID=\S+/u);
  });
});
