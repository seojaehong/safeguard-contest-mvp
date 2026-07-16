import { execFileSync } from "node:child_process";
import { pathToFileURL } from "node:url";

import { TENANT_ISOLATION_MANIFEST } from "./supabase_tenant_isolation_manifest.mjs";

export const EXPECTED_HEAD = "530efbfafb30c6145c1536172b260ff644845846";
export const DISPOSABLE_PROJECT_ACK = "I_ACKNOWLEDGE_THIS_IS_A_DISPOSABLE_SUPABASE_PROJECT";

const REQUIRED_SECRETS = Object.freeze([
  "SUPABASE_TENANT_TEST_ANON_KEY",
  "SUPABASE_TENANT_TEST_USER_A_JWT",
  "SUPABASE_TENANT_TEST_USER_B_JWT",
]);

function redactString(value, secrets) {
  let redacted = value.replace(/Bearer\s+[^\s"']+/gi, "Bearer [REDACTED]");
  for (const secret of secrets.filter(Boolean)) {
    redacted = redacted.split(secret).join("[REDACTED]");
  }
  return redacted;
}

export function redactSecrets(value, secrets = []) {
  if (typeof value === "string") {
    return redactString(value, secrets);
  }
  if (Array.isArray(value)) {
    return value.map((item) => redactSecrets(item, secrets));
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => {
      if (/(authorization|token|jwt|secret|key)$/i.test(key)) {
        return [key, item ? "[REDACTED]" : item];
      }
      return [key, redactSecrets(item, secrets)];
    }));
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

export async function runTenantIsolationHarness({
  env = process.env,
  actualHead = "",
  mode = "dry-run",
  executor,
} = {}) {
  const secrets = REQUIRED_SECRETS.map((name) => env[name] ?? "");
  const preflight = evaluatePreflight({ env, actualHead });
  const base = {
    ok: preflight.ok,
    mode,
    expectedHead: EXPECTED_HEAD,
    manifestCount: TENANT_ISOLATION_MANIFEST.scenarios.length,
    requestCount: 0,
    preflight,
  };

  if (!preflight.ok || mode !== "execute") {
    return redactSecrets(base, secrets);
  }
  if (!executor || typeof executor.executeScenario !== "function") {
    return redactSecrets({ ...base, ok: false, error: "No scenario executor configured; execution remains fail-closed." }, secrets);
  }

  const results = [];
  let requestCount = 0;
  for (const scenario of TENANT_ISOLATION_MANIFEST.scenarios) {
    try {
      requestCount += 1;
      const result = await executor.executeScenario(executorContext(scenario, env));
      const passed = result?.passed === true
        && result?.cleanupPassed === true
        && result?.residualCount === scenario.residual.expectedCount;
      results.push({ id: scenario.id, passed });
      if (!passed) {
        return redactSecrets({ ...base, ok: false, requestCount, results, error: `Scenario failed closed: ${scenario.id}` }, secrets);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return redactSecrets({ ...base, ok: false, requestCount, results, error: message }, secrets);
    }
  }

  return redactSecrets({ ...base, ok: true, requestCount, results }, secrets);
}

function currentHead() {
  try {
    return execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Unable to read git HEAD: ${message}`);
  }
}

async function main() {
  const mode = process.argv.includes("--execute") ? "execute" : "dry-run";
  const result = await runTenantIsolationHarness({ env: process.env, actualHead: currentHead(), mode });
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  if (!result.ok || mode === "execute") {
    process.exitCode = 1;
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  await main();
}
