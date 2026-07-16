import { describe, expect, it } from "vitest";

import {
  DISPOSABLE_PROJECT_ACK,
  EXPECTED_HEAD,
  redactSecrets,
  runTenantIsolationHarness,
} from "../scripts/supabase_tenant_isolation_harness.mjs";
import {
  STORAGE_SCENARIOS,
  TABLE_SCENARIOS,
  TENANT_ISOLATION_MANIFEST,
} from "../scripts/supabase_tenant_isolation_manifest.mjs";

const TEST_REF = "abcdefghijklmnopqrst";
const PRODUCTION_REF = "zyxwvutsrqponmlkjihg";

function validEnv(): Record<string, string> {
  return {
    SUPABASE_TENANT_TEST_PROJECT_REF: TEST_REF,
    SUPABASE_PRODUCTION_PROJECT_REF: PRODUCTION_REF,
    SUPABASE_TENANT_TEST_DISPOSABLE_ACK: DISPOSABLE_PROJECT_ACK,
    SUPABASE_TENANT_TEST_EXPECTED_HEAD: EXPECTED_HEAD,
    SUPABASE_TENANT_TEST_ANON_KEY: "anon-secret-value",
    SUPABASE_TENANT_TEST_USER_A_JWT: "user-a-secret-value",
    SUPABASE_TENANT_TEST_USER_B_JWT: "user-b-secret-value",
  };
}

function requestCounter() {
  let count = 0;
  let receivedContext: unknown;
  return {
    executor: {
      async executeScenario(context: unknown) {
        count += 1;
        receivedContext = context;
        return { passed: true, cleanupPassed: true, residualCount: 0 };
      },
    },
    count: () => count,
    context: () => receivedContext,
  };
}

describe("Supabase tenant-isolation manifest", () => {
  it("contains exactly 13 tables x 4 scenarios plus 4 storage scenarios", () => {
    expect(TENANT_ISOLATION_MANIFEST.tables).toHaveLength(13);
    expect(TABLE_SCENARIOS).toHaveLength(52);
    expect(STORAGE_SCENARIOS).toHaveLength(4);
    expect(TENANT_ISOLATION_MANIFEST.scenarios).toHaveLength(56);
  });

  it("represents positive controls and fail-closed cleanup/residual rules", () => {
    const scenarios = TENANT_ISOLATION_MANIFEST.scenarios;
    expect(scenarios.filter((scenario) => scenario.control === "positive").length).toBeGreaterThan(0);
    expect(scenarios.filter((scenario) => scenario.expected === "deny").length).toBeGreaterThan(0);
    for (const scenario of scenarios) {
      expect(scenario.cleanup.run).toBe("always");
      expect(scenario.cleanup.credential).toBe("fixture_owner");
      expect(scenario.residual.expectedCount).toBe(0);
      expect(scenario.residual.onMismatch).toBe("fail_closed");
    }
  });
});

describe("Supabase tenant-isolation harness preflight", () => {
  it.each([
    "SUPABASE_TENANT_TEST_PROJECT_REF",
    "SUPABASE_PRODUCTION_PROJECT_REF",
    "SUPABASE_TENANT_TEST_DISPOSABLE_ACK",
    "SUPABASE_TENANT_TEST_EXPECTED_HEAD",
    "SUPABASE_TENANT_TEST_ANON_KEY",
    "SUPABASE_TENANT_TEST_USER_A_JWT",
    "SUPABASE_TENANT_TEST_USER_B_JWT",
  ])("makes zero requests when %s is missing", async (missingKey) => {
    const env = validEnv();
    delete env[missingKey];
    const counter = requestCounter();

    const result = await runTenantIsolationHarness({
      env,
      actualHead: EXPECTED_HEAD,
      mode: "execute",
      executor: counter.executor,
    });

    expect(result.ok).toBe(false);
    expect(result.requestCount).toBe(0);
    expect(counter.count()).toBe(0);
  });

  it.each([
    ["disposable ACK mismatch", { SUPABASE_TENANT_TEST_DISPOSABLE_ACK: "no" }, EXPECTED_HEAD],
    ["expected-head env mismatch", { SUPABASE_TENANT_TEST_EXPECTED_HEAD: "0".repeat(40) }, EXPECTED_HEAD],
    ["actual HEAD mismatch", {}, "1".repeat(40)],
    ["production and disposable refs match", { SUPABASE_PRODUCTION_PROJECT_REF: TEST_REF }, EXPECTED_HEAD],
  ])("makes zero requests on %s", async (_label, override, actualHead) => {
    const counter = requestCounter();
    const result = await runTenantIsolationHarness({
      env: { ...validEnv(), ...override },
      actualHead,
      mode: "execute",
      executor: counter.executor,
    });

    expect(result.ok).toBe(false);
    expect(result.requestCount).toBe(0);
    expect(counter.count()).toBe(0);
  });

  it("does not execute in default dry-run mode even when every gate passes", async () => {
    const counter = requestCounter();
    const result = await runTenantIsolationHarness({
      env: validEnv(),
      actualHead: EXPECTED_HEAD,
      executor: counter.executor,
    });

    expect(result.ok).toBe(true);
    expect(result.mode).toBe("dry-run");
    expect(result.requestCount).toBe(0);
    expect(counter.count()).toBe(0);
  });

  it("executes all 56 scenarios only after every gate passes", async () => {
    const counter = requestCounter();
    const result = await runTenantIsolationHarness({
      env: validEnv(),
      actualHead: EXPECTED_HEAD,
      mode: "execute",
      executor: counter.executor,
    });

    expect(result.ok).toBe(true);
    expect(result.requestCount).toBe(56);
    expect(counter.count()).toBe(56);
    expect(JSON.stringify(counter.context())).not.toMatch(/service.?role/i);
  });

  it("redacts secrets recursively from reports and errors", () => {
    const secret = "jwt-super-secret-value";
    const redacted = redactSecrets({
      token: secret,
      nested: { authorization: `Bearer ${secret}` },
      message: `request failed for ${secret}`,
    }, [secret]);
    const serialized = JSON.stringify(redacted);

    expect(serialized).not.toContain(secret);
    expect(serialized).not.toContain(`Bearer ${secret}`);
    expect(serialized).toContain("[REDACTED]");
  });
});
