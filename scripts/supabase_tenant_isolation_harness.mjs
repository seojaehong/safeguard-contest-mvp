import { execFileSync } from "node:child_process";
import { pathToFileURL } from "node:url";

import { TENANT_ISOLATION_MANIFEST } from "./supabase_tenant_isolation_manifest.mjs";

export const DISPOSABLE_PROJECT_ACK = "I_ACKNOWLEDGE_THIS_IS_A_DISPOSABLE_SUPABASE_PROJECT";

const REQUIRED_SECRETS = Object.freeze([
  "SUPABASE_TENANT_TEST_ANON_KEY",
  "SUPABASE_TENANT_TEST_USER_A_JWT",
  "SUPABASE_TENANT_TEST_USER_B_JWT",
]);

function redactString(value, secrets) {
  let redacted = value.replace(/Bearer\s+[^\s"']+/gi, "Bearer [REDACTED]");
  for (const secret of secrets.filter(Boolean)) redacted = redacted.split(secret).join("[REDACTED]");
  return redacted;
}

export function redactSecrets(value, secrets = []) {
  if (typeof value === "string") return redactString(value, secrets);
  if (Array.isArray(value)) return value.map((item) => redactSecrets(item, secrets));
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [
      key,
      /(authorization|token|jwt|secret|key)$/i.test(key) && item
        ? "[REDACTED]"
        : redactSecrets(item, secrets),
    ]));
  }
  return value;
}

function isProjectRef(value) {
  return typeof value === "string" && /^[a-z]{20}$/.test(value);
}

function isCommitSha(value) {
  return typeof value === "string" && /^[0-9a-f]{40}$/.test(value);
}

function check(id, passed, message) {
  return Object.freeze({ id, passed, message: passed ? "ok" : message });
}

export function evaluatePreflight({ env, actualHead }) {
  const testRef = env.SUPABASE_TENANT_TEST_PROJECT_REF ?? "";
  const productionRef = env.SUPABASE_PRODUCTION_PROJECT_REF ?? "";
  const configuredHead = env.SUPABASE_TENANT_TEST_EXPECTED_HEAD ?? "";
  const checks = [
    check("disposable_project_ref_present", isProjectRef(testRef), "A valid disposable project ref is required."),
    check("production_project_ref_present", isProjectRef(productionRef), "A valid production project ref is required."),
    check("disposable_ref_differs_from_production", Boolean(testRef && productionRef && testRef !== productionRef), "Disposable and production refs must differ."),
    check("disposable_project_ack", env.SUPABASE_TENANT_TEST_DISPOSABLE_ACK === DISPOSABLE_PROJECT_ACK, "Exact disposable-project ACK is required."),
    check("configured_expected_head", isCommitSha(configuredHead), "A full lowercase 40-character expected HEAD is required."),
    check("actual_expected_head", Boolean(configuredHead && actualHead === configuredHead), "Current HEAD does not match the explicitly configured expected HEAD."),
    ...REQUIRED_SECRETS.map((name) => check(`secret_present:${name}`, Boolean(env[name]), `${name} is required.`)),
  ];
  return Object.freeze({
    ok: checks.every((item) => item.passed),
    checks: Object.freeze(checks),
    failedCheckIds: Object.freeze(checks.filter((item) => !item.passed).map((item) => item.id)),
  });
}

export function validateScenarioObservation(scenario, observation) {
  const stateChanged = observation?.beforeFingerprint !== observation?.afterFingerprint;
  const checks = [
    check("http_status", scenario.expectedHttpStatuses.includes(observation?.httpStatus), "Unexpected HTTP status."),
    check("affected_rows", observation?.affectedRows === scenario.expectedAffectedRows, "Unexpected affected row/object count."),
    check("returned_rows", observation?.returnedRows === scenario.expectedReturnedRows, "Unexpected returned row/object count."),
    check("before_fingerprint", typeof observation?.beforeFingerprint === "string" && observation.beforeFingerprint.length > 0, "Missing before fingerprint."),
    check("after_fingerprint", typeof observation?.afterFingerprint === "string" && observation.afterFingerprint.length > 0, "Missing after fingerprint."),
    check("before_after", stateChanged === scenario.expectedStateChange, "Before/after state does not match the expected mutation."),
    check("foreign_unchanged", observation?.foreignUnchanged === true, "Foreign tenant state was not proven unchanged."),
  ];
  return {
    ok: checks.every((item) => item.passed),
    checks,
    failedCheckIds: checks.filter((item) => !item.passed).map((item) => item.id),
  };
}

function validateForeignVerification(verification, expectedFingerprint) {
  return verification?.affectedRows === 0
    && verification?.beforeFingerprint === expectedFingerprint
    && verification?.afterFingerprint === expectedFingerprint
    && verification?.foreignUnchanged === true;
}

function executorContext(scenario, env) {
  return Object.freeze({
    scenario,
    endpoint: `https://${env.SUPABASE_TENANT_TEST_PROJECT_REF}.supabase.co`,
    clients: Object.freeze({
      tenantA: Object.freeze({ anonKey: env.SUPABASE_TENANT_TEST_ANON_KEY, accessToken: env.SUPABASE_TENANT_TEST_USER_A_JWT }),
      tenantB: Object.freeze({ anonKey: env.SUPABASE_TENANT_TEST_ANON_KEY, accessToken: env.SUPABASE_TENANT_TEST_USER_B_JWT }),
    }),
  });
}

function errorMessage(error) {
  return error instanceof Error ? error.message : String(error);
}

export async function runTenantIsolationHarness({ env = process.env, actualHead = "", mode = "dry-run", adapterMode = "contract-test", executor, verifier } = {}) {
  const secrets = REQUIRED_SECRETS.map((name) => env[name] ?? "");
  const preflight = evaluatePreflight({ env, actualHead });
  const base = {
    ok: false,
    mode,
    executionStatus: mode === "execute" ? "blocked_no_live_adapter" : "not_executed",
    adapterMode,
    adapterHooksProvided: Boolean(executor && verifier),
    liveExecutorAvailable: false,
    contractValidated: false,
    launchProven: false,
    expectedHead: env.SUPABASE_TENANT_TEST_EXPECTED_HEAD ?? null,
    actualHead,
    denyAssertionCount: TENANT_ISOLATION_MANIFEST.denyAssertionCount,
    positiveControlCount: TENANT_ISOLATION_MANIFEST.positiveControlCount,
    manifestCount: TENANT_ISOLATION_MANIFEST.scenarios.length,
    requestCount: 0,
    cleanupCount: 0,
    verifierCount: 0,
    preflight,
  };

  if (!preflight.ok) return redactSecrets(base, secrets);
  if (mode !== "execute") {
    return redactSecrets({
      ...base,
      error: "Network-free contract validation only; no live executor was invoked.",
    }, secrets);
  }
  if (adapterMode === "live-reviewed") {
    return redactSecrets({
      ...base,
      executionStatus: "blocked_unreviewed_live_adapter",
      error: "This non-executing packet has no reviewed live-adapter identity registry.",
    }, secrets);
  }
  if (!executor || typeof executor.executeScenario !== "function" || typeof executor.cleanupScenario !== "function") {
    return redactSecrets({ ...base, ok: false, error: "Actor executor and cleanup hook are required." }, secrets);
  }
  if (!verifier || typeof verifier.verifyForeignState !== "function" || typeof verifier.verifyResidualZero !== "function") {
    return redactSecrets({ ...base, ok: false, error: "Service-role verifier hooks are required." }, secrets);
  }

  const results = [];
  let requestCount = 0;
  let cleanupCount = 0;
  let verifierCount = 0;
  let failure = null;
  let residualVerification = null;

  try {
    for (const scenario of TENANT_ISOLATION_MANIFEST.scenarios) {
      const context = executorContext(scenario, env);
      let observation = null;
      let validation = null;
      let foreignVerification = null;
      let cleanupObservation = null;
      let scenarioFailure = null;
      try {
        requestCount += 1;
        observation = await executor.executeScenario(context);
        validation = validateScenarioObservation(scenario, observation);
        if (!validation.ok) scenarioFailure = `Observation failed: ${validation.failedCheckIds.join(", ")}`;

        if (!scenarioFailure && scenario.requiresServiceRoleVerification) {
          verifierCount += 1;
          foreignVerification = await verifier.verifyForeignState({
            credential: "service_role_verifier",
            scenario,
            beforeFingerprint: observation.beforeFingerprint,
            afterFingerprint: observation.afterFingerprint,
          });
          if (!validateForeignVerification(foreignVerification, observation.beforeFingerprint)) {
            scenarioFailure = "Service-role verifier detected a hidden foreign mutation.";
          }
        }
      } catch (error) {
        scenarioFailure = errorMessage(error);
      } finally {
        try {
          cleanupCount += 1;
          cleanupObservation = await executor.cleanupScenario(context);
          if (!cleanupObservation || !Number.isInteger(cleanupObservation.httpStatus) || cleanupObservation.httpStatus < 200 || cleanupObservation.httpStatus >= 300 || !Number.isInteger(cleanupObservation.affectedRows) || cleanupObservation.affectedRows < 0) {
            scenarioFailure = scenarioFailure ?? "Cleanup did not return valid HTTP and affected-row evidence.";
          }
        } catch (error) {
          scenarioFailure = scenarioFailure ?? `Cleanup failed: ${errorMessage(error)}`;
        }
      }

      results.push({
        id: scenario.id,
        passed: scenarioFailure === null,
        observation,
        validation,
        foreignVerification,
        cleanupObservation,
      });
      if (scenarioFailure) {
        failure = `Scenario failed closed: ${scenario.id}: ${scenarioFailure}`;
        break;
      }
    }
  } finally {
    try {
      verifierCount += 1;
      const residual = await verifier.verifyResidualZero({
        credential: "service_role_verifier",
        manifest: TENANT_ISOLATION_MANIFEST,
        expectedTableRows: 0,
        expectedStorageObjects: 0,
      });
      residualVerification = {
        tableRows: residual.tableRows,
        storageObjects: residual.storageObjects,
        passed: residual.tableRows === 0 && residual.storageObjects === 0,
      };
      if (!residualVerification.passed) failure = failure ?? "Final residual-zero verification failed.";
    } catch (error) {
      residualVerification = { tableRows: null, storageObjects: null, passed: false };
      failure = failure ?? `Final residual-zero verification failed: ${errorMessage(error)}`;
    }
  }

  const contractValidated = failure === null && results.length === TENANT_ISOLATION_MANIFEST.scenarios.length;
  return redactSecrets({
    ...base,
    ok: false,
    executionStatus: "executed_contract_test",
    contractValidated,
    launchProven: false,
    requestCount,
    cleanupCount,
    verifierCount,
    results,
    residualVerification,
    ...(failure
      ? { error: failure }
      : { error: "Contract adapters completed; no reviewed live executor ran." }),
  }, secrets);
}

function currentHead() {
  try {
    return execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
  } catch (error) {
    throw new Error(`Unable to read git HEAD: ${errorMessage(error)}`);
  }
}

async function main() {
  const mode = process.argv.includes("--execute") ? "execute" : "dry-run";
  const result = await runTenantIsolationHarness({ env: process.env, actualHead: currentHead(), mode });
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  if (!result.ok || mode === "execute") process.exitCode = 1;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) await main();
