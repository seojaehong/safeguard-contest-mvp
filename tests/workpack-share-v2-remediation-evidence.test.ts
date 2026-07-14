import path from "node:path";
import { spawnSync } from "node:child_process";

import { describe, expect, it } from "vitest";

const root = process.cwd();
const validator = path.join(
  root,
  "evaluation",
  "workpack-share-v2-product-2026-07-14",
  "remediation",
  "validate-remediation-evidence.cjs",
);
const attackModes = [
  "missing_amendment",
  "stale_product_sha",
  "stale_product_tree",
  "precommit_source",
  "unknown_key",
  "legacy_391",
  "per_node_mutation",
  "contaminated_pass",
  "stale_current_main",
  "kosha_overlap",
  "ontology_cas_omission",
  "log_hash_tamper",
  "missing_incident",
  "stale_browser_blob",
  "red_reclassified",
] as const;

function runValidator(...arguments_: string[]) {
  return spawnSync(process.execPath, [validator, ...arguments_], {
    cwd: root,
    encoding: "utf8",
  });
}

describe("Share v2 remediation evidence contract", () => {
  it("accepts only post-commit evidence bound to the current integration authority", () => {
    const result = runValidator();

    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).toContain("remediation-evidence-valid");
    expect(result.stdout).toContain('"browserRunnerTests":130');
    expect(result.stdout).toContain('"browserRowsExecuted":128');
    expect(result.stdout).toContain('"koshaPathOverlapCount":0');
    expect(result.stdout).toContain('"independentReview":"pending"');
  }, 30_000);

  it.each(attackModes)("rejects the %s attack fail closed", (attackMode) => {
    const result = runValidator("--attack", attackMode);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain(`[remediation-evidence-rejected:${attackMode}]`);
    expect(result.stdout).not.toContain("remediation-evidence-valid");
  }, 30_000);
});
