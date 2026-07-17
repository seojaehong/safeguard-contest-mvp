import { describe, expect, it } from "vitest";

import {
  DISPOSABLE_PROJECT_ACK,
  redactSecrets,
  runTenantIsolationHarness,
  validateScenarioObservation,
} from "../scripts/supabase_tenant_isolation_harness.mjs";
import type {
  HarnessEnvironment,
  Scenario,
  ScenarioExecutor,
  ScenarioObservation,
  ServiceRoleVerifier,
} from "../scripts/supabase_tenant_isolation_harness.mjs";
import {
  CROSS_TENANT_DENY_ASSERTIONS,
  OWN_TENANT_POSITIVE_CONTROLS,
  TENANT_ISOLATION_MANIFEST,
} from "../scripts/supabase_tenant_isolation_manifest.mjs";

const RUNTIME_EXPECTED_HEAD = "a".repeat(40);
const TEST_REF = "abcdefghijklmnopqrst";
const PRODUCTION_REF = "zyxwvutsrqponmlkjihg";

function validEnv(): HarnessEnvironment {
  return {
    SUPABASE_TENANT_TEST_PROJECT_REF: TEST_REF,
    SUPABASE_PRODUCTION_PROJECT_REF: PRODUCTION_REF,
    SUPABASE_TENANT_TEST_DISPOSABLE_ACK: DISPOSABLE_PROJECT_ACK,
    SUPABASE_TENANT_TEST_EXPECTED_HEAD: RUNTIME_EXPECTED_HEAD,
    SUPABASE_TENANT_TEST_ANON_KEY: "anon-secret-value",
    SUPABASE_TENANT_TEST_USER_A_JWT: "user-a-secret-value",
    SUPABASE_TENANT_TEST_USER_B_JWT: "user-b-secret-value",
  };
}

function validObservation(scenario: Scenario): ScenarioObservation {
  const mutatesOwnFixture = scenario.control === "positive" && scenario.operation !== "SELECT";
  return {
    httpStatus: scenario.expectedHttpStatuses[0],
    affectedRows: scenario.expectedAffectedRows,
    returnedRows: scenario.expectedReturnedRows,
    beforeFingerprint: "before-state",
    afterFingerprint: mutatesOwnFixture ? "after-state" : "before-state",
    foreignUnchanged: true,
  };
}

function successfulHarness() {
  const executeContexts: unknown[] = [];
  const cleanupContexts: unknown[] = [];
  const foreignVerifyContexts: unknown[] = [];
  let residualCalls = 0;
  const executor: ScenarioExecutor = {
    async executeScenario(context) {
      executeContexts.push(context);
      return validObservation(context.scenario);
    },
    async cleanupScenario(context) {
      cleanupContexts.push(context);
      return { httpStatus: 204, affectedRows: 1 };
    },
  };
  const verifier: ServiceRoleVerifier = {
    async verifyForeignState(context) {
      foreignVerifyContexts.push(context);
      return {
        affectedRows: 0,
        beforeFingerprint: context.beforeFingerprint,
        afterFingerprint: context.beforeFingerprint,
        foreignUnchanged: true,
      };
    },
    async verifyResidualZero() {
      residualCalls += 1;
      return { tableRows: 0, storageObjects: 0 };
    },
  };
  return {
    executor,
    verifier,
    executeContexts,
    cleanupContexts,
    foreignVerifyContexts,
    residualCalls: () => residualCalls,
  };
}

describe("Supabase tenant-isolation manifest", () => {
  it("contains both A-to-B and B-to-A cross-tenant deny assertions", () => {
    expect(TENANT_ISOLATION_MANIFEST.tables).toHaveLength(13);
    expect(CROSS_TENANT_DENY_ASSERTIONS).toHaveLength(112);
    expect(CROSS_TENANT_DENY_ASSERTIONS.filter((scenario) => scenario.resourceType === "table")).toHaveLength(104);
    expect(CROSS_TENANT_DENY_ASSERTIONS.filter((scenario) => scenario.resourceType === "storage")).toHaveLength(8);
    expect(new Set(CROSS_TENANT_DENY_ASSERTIONS.map((scenario) => scenario.direction))).toEqual(
      new Set(["a_to_b", "b_to_a"]),
    );
    expect(new Set(CROSS_TENANT_DENY_ASSERTIONS.map((scenario) => scenario.operation))).toEqual(
      new Set(["SELECT", "INSERT", "UPDATE", "DELETE"]),
    );
    expect(CROSS_TENANT_DENY_ASSERTIONS.every((scenario) => scenario.expected === "deny")).toBe(true);
  });

  it("keeps matching A and B own-tenant controls separate from denies", () => {
    expect(OWN_TENANT_POSITIVE_CONTROLS).toHaveLength(112);
    expect(OWN_TENANT_POSITIVE_CONTROLS.every((scenario) => scenario.control === "positive")).toBe(true);
    expect(new Set(OWN_TENANT_POSITIVE_CONTROLS.map((scenario) => scenario.direction))).toEqual(
      new Set(["a_to_a", "b_to_b"]),
    );
    expect(TENANT_ISOLATION_MANIFEST.scenarios).toHaveLength(224);
    expect(TENANT_ISOLATION_MANIFEST.denyAssertionCount).toBe(112);
    expect(TENANT_ISOLATION_MANIFEST.positiveControlCount).toBe(112);
  });

  it("builds positive scenario IDs from normalized same-tenant directions", () => {
    expect(OWN_TENANT_POSITIVE_CONTROLS.every((scenario) => (
      scenario.id.includes(`:positive:${scenario.direction}:`)
    ))).toBe(true);
    expect(OWN_TENANT_POSITIVE_CONTROLS.some((scenario) => (
      scenario.id.includes(":positive:a_to_b:") || scenario.id.includes(":positive:b_to_a:")
    ))).toBe(false);
  });

  it("requires always-cleanup and a separate final residual-zero check", () => {
    for (const scenario of TENANT_ISOLATION_MANIFEST.scenarios) {
      expect(scenario.cleanup.run).toBe("always");
      expect(scenario.cleanup.phase).toBe("scenario_finally");
    }
    expect(TENANT_ISOLATION_MANIFEST.execution.finalResidualVerification).toEqual({
      credential: "service_role_verifier",
      expectedTableRows: 0,
      expectedStorageObjects: 0,
      onMismatch: "fail_closed",
    });
  });
});

describe("Supabase tenant-isolation preflight", () => {
  it.each([
    "SUPABASE_TENANT_TEST_PROJECT_REF",
    "SUPABASE_PRODUCTION_PROJECT_REF",
    "SUPABASE_TENANT_TEST_DISPOSABLE_ACK",
    "SUPABASE_TENANT_TEST_EXPECTED_HEAD",
    "SUPABASE_TENANT_TEST_ANON_KEY",
    "SUPABASE_TENANT_TEST_USER_A_JWT",
    "SUPABASE_TENANT_TEST_USER_B_JWT",
  ] satisfies Array<keyof HarnessEnvironment>)("calls no hook when %s is missing", async (missingKey) => {
    const env = validEnv();
    delete env[missingKey];
    const harness = successfulHarness();
    const result = await runTenantIsolationHarness({
      env,
      actualHead: RUNTIME_EXPECTED_HEAD,
      mode: "execute",
      executor: harness.executor,
      verifier: harness.verifier,
    });
    expect(result.ok).toBe(false);
    expect(result.requestCount).toBe(0);
    expect(harness.executeContexts).toHaveLength(0);
    expect(harness.cleanupContexts).toHaveLength(0);
    expect(harness.foreignVerifyContexts).toHaveLength(0);
    expect(harness.residualCalls()).toBe(0);
  });

  it.each([
    ["disposable ACK", { SUPABASE_TENANT_TEST_DISPOSABLE_ACK: "no" }, RUNTIME_EXPECTED_HEAD],
    ["expected HEAD", { SUPABASE_TENANT_TEST_EXPECTED_HEAD: "0".repeat(40) }, RUNTIME_EXPECTED_HEAD],
    ["actual HEAD", {}, "1".repeat(40)],
    ["different production ref", { SUPABASE_PRODUCTION_PROJECT_REF: TEST_REF }, RUNTIME_EXPECTED_HEAD],
  ] satisfies Array<[string, Partial<HarnessEnvironment>, string]>)("calls no hook on mismatched %s gate", async (_label, override, actualHead) => {
    const harness = successfulHarness();
    const result = await runTenantIsolationHarness({
      env: { ...validEnv(), ...override },
      actualHead,
      mode: "execute",
      executor: harness.executor,
      verifier: harness.verifier,
    });
    expect(result.ok).toBe(false);
    expect(result.requestCount).toBe(0);
    expect(harness.executeContexts).toHaveLength(0);
    expect(harness.residualCalls()).toBe(0);
  });
});

describe("Supabase tenant-isolation observation validation", () => {
  it.each([
    ["HTTP status", { httpStatus: 500 }],
    ["affected rows", { affectedRows: 1 }],
    ["returned rows", { returnedRows: 1 }],
    ["before/after state", { afterFingerprint: "mutated" }],
    ["foreign unchanged", { foreignUnchanged: false }],
  ] satisfies Array<[string, Partial<ScenarioObservation>]>)("fails a deny assertion on wrong %s", (_label, override) => {
    const scenario = CROSS_TENANT_DENY_ASSERTIONS.find((item) => item.operation === "SELECT");
    if (!scenario) throw new Error("Missing SELECT deny assertion");
    const observation = { ...validObservation(scenario), passed: true, ...override };
    expect(validateScenarioObservation(scenario, observation).ok).toBe(false);
  });

  it("does not accept a passed boolean as evidence", () => {
    const scenario = CROSS_TENANT_DENY_ASSERTIONS.find((item) => item.operation === "UPDATE");
    if (!scenario) throw new Error("Missing UPDATE deny assertion");
    const observation = { ...validObservation(scenario), affectedRows: 9, passed: true };
    expect(validateScenarioObservation(scenario, observation).ok).toBe(false);
  });
});

describe("Supabase tenant-isolation execution lifecycle", () => {
  it("validates all 224 observations and keeps service-role hooks outside executor context", async () => {
    const harness = successfulHarness();
    const result = await runTenantIsolationHarness({
      env: validEnv(),
      actualHead: RUNTIME_EXPECTED_HEAD,
      mode: "execute",
      executor: harness.executor,
      verifier: harness.verifier,
    });
    expect(result.ok).toBe(false);
    expect(result.executionStatus).toBe("executed_contract_test");
    expect(result.contractValidated).toBe(true);
    expect(result.liveExecutorAvailable).toBe(false);
    expect(result.launchProven).toBe(false);
    expect(result.error).toContain("no reviewed live executor");
    expect(result.requestCount).toBe(224);
    expect(harness.executeContexts).toHaveLength(224);
    expect(harness.cleanupContexts).toHaveLength(224);
    expect(harness.foreignVerifyContexts).toHaveLength(56);
    expect(harness.residualCalls()).toBe(1);
    expect(result.results).toHaveLength(224);
    expect(result.results?.[0]).toMatchObject({
      observation: {
        httpStatus: 200,
        affectedRows: 0,
        returnedRows: 0,
        beforeFingerprint: "before-state",
        afterFingerprint: "before-state",
        foreignUnchanged: true,
      },
      cleanupObservation: { httpStatus: 204, affectedRows: 1 },
    });
    expect(result.results?.filter((item) => item.foreignVerification !== null)).toHaveLength(56);
    for (const rawContext of harness.executeContexts) {
      const context = rawContext as { clients: Record<string, unknown> } & Record<string, unknown>;
      expect(Object.keys(context).filter((key) => key !== "scenario")).not.toContain("serviceRoleClient");
      expect(Object.keys(context.clients)).toEqual(["tenantA", "tenantB"]);
    }
    expect(JSON.stringify(harness.foreignVerifyContexts)).toContain("service_role_verifier");
  });

  it("runs cleanup in finally and the final residual verifier after executor failure", async () => {
    const harness = successfulHarness();
    harness.executor.executeScenario = async () => {
      throw new Error("actor request failed");
    };
    const result = await runTenantIsolationHarness({
      env: validEnv(),
      actualHead: RUNTIME_EXPECTED_HEAD,
      mode: "execute",
      executor: harness.executor,
      verifier: harness.verifier,
    });
    expect(result.ok).toBe(false);
    expect(harness.cleanupContexts).toHaveLength(1);
    expect(harness.residualCalls()).toBe(1);
  });

  it("fails closed when the final service-role residual verifier finds data", async () => {
    const harness = successfulHarness();
    harness.verifier.verifyResidualZero = async () => ({ tableRows: 1, storageObjects: 0 });
    const result = await runTenantIsolationHarness({
      env: validEnv(),
      actualHead: RUNTIME_EXPECTED_HEAD,
      mode: "execute",
      executor: harness.executor,
      verifier: harness.verifier,
    });
    expect(result.ok).toBe(false);
    expect(result.residualVerification).toEqual({ tableRows: 1, storageObjects: 0, passed: false });
  });

  it("fails closed when a hidden UPDATE/DELETE verifier detects mutation", async () => {
    const harness = successfulHarness();
    harness.verifier.verifyForeignState = async (context) => ({
      affectedRows: 1,
      beforeFingerprint: context.beforeFingerprint,
      afterFingerprint: "changed-by-hidden-update",
      foreignUnchanged: false,
    });
    const result = await runTenantIsolationHarness({
      env: validEnv(),
      actualHead: RUNTIME_EXPECTED_HEAD,
      mode: "execute",
      executor: harness.executor,
      verifier: harness.verifier,
    });
    expect(result.ok).toBe(false);
    expect(harness.cleanupContexts.length).toBeGreaterThan(0);
    expect(harness.residualCalls()).toBe(1);
  });

  it("reports network-free dry-run as RED because no live executor ran", async () => {
    const harness = successfulHarness();
    const result = await runTenantIsolationHarness({
      env: validEnv(),
      actualHead: RUNTIME_EXPECTED_HEAD,
      executor: harness.executor,
      verifier: harness.verifier,
    });
    expect(result.ok).toBe(false);
    expect(result.mode).toBe("dry-run");
    expect(result.executionStatus).toBe("not_executed");
    expect(result.adapterHooksProvided).toBe(true);
    expect(result.liveExecutorAvailable).toBe(false);
    expect(result.launchProven).toBe(false);
    expect(result.error).toContain("no live executor");
    expect(result.requestCount).toBe(0);
    expect(harness.executeContexts).toHaveLength(0);
  });

  it("fails closed when execute mode has no live adapter", async () => {
    const result = await runTenantIsolationHarness({
      env: validEnv(),
      actualHead: RUNTIME_EXPECTED_HEAD,
      mode: "execute",
    });
    expect(result.ok).toBe(false);
    expect(result.executionStatus).toBe("blocked_no_live_adapter");
    expect(result.liveExecutorAvailable).toBe(false);
    expect(result.adapterHooksProvided).toBe(false);
    expect(result.launchProven).toBe(false);
    expect(result.requestCount).toBe(0);
    expect(result.error).toBe("Actor executor and cleanup hook are required.");
  });

  it("cannot turn injected fake adapters into launch proof with a caller-supplied live-reviewed label", async () => {
    const harness = successfulHarness();
    const result = await runTenantIsolationHarness({
      env: validEnv(),
      actualHead: RUNTIME_EXPECTED_HEAD,
      mode: "execute",
      adapterMode: "live-reviewed",
      executor: harness.executor,
      verifier: harness.verifier,
    });
    expect(result.ok).toBe(false);
    expect(result.executionStatus).toBe("blocked_unreviewed_live_adapter");
    expect(result.liveExecutorAvailable).toBe(false);
    expect(result.contractValidated).toBe(false);
    expect(result.launchProven).toBe(false);
    expect(result.requestCount).toBe(0);
    expect(harness.executeContexts).toHaveLength(0);
    expect(harness.cleanupContexts).toHaveLength(0);
    expect(harness.foreignVerifyContexts).toHaveLength(0);
    expect(harness.residualCalls()).toBe(0);
  });

  it("redacts secrets recursively from reports and errors", () => {
    const secret = "jwt-super-secret-value";
    const serialized = JSON.stringify(redactSecrets({
      token: secret,
      nested: { authorization: `Bearer ${secret}` },
      message: `request failed for ${secret}`,
    }, [secret]));
    expect(serialized).not.toContain(secret);
    expect(serialized).toContain("[REDACTED]");
  });
});
