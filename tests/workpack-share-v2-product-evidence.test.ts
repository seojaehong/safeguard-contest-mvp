import path from "node:path";
import { spawnSync } from "node:child_process";

import { describe, expect, it } from "vitest";

const root = process.cwd();
const validator = path.join(
  root,
  "evaluation",
  "workpack-share-v2-product-2026-07-14",
  "validate-product-evidence.cjs",
);
const attackModes = [
  "missing_erratum",
  "stale_amendment_sha",
  "stale_amendment_blob",
  "unknown_evidence_key",
  "legacy_mobile_row",
  "per_node_metric_reintroduced",
  "legacy_active_source_reintroduced",
  "stale_product_remote_sha",
  "changed_file_census_tampered",
  "verification_log_hash_tampered",
  "restoration_mismatch_reintroduced",
] as const;

function runValidator(...arguments_: string[]) {
  return spawnSync(process.execPath, [validator, ...arguments_], {
    cwd: root,
    encoding: "utf8",
  });
}

describe("Share v2 product evidence contract", () => {
  it("accepts only browser evidence bound to the committed amendment", () => {
    const result = runValidator();

    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).toContain("product-evidence-valid");
    expect(result.stdout).toContain('"executedCaseCount":128');
    expect(result.stdout).toContain('"unexecutedCaseCount":0');
  }, 20_000);

  it.each(attackModes)("rejects the %s evidence attack fail-closed", (attackMode) => {
    const result = runValidator("--attack", attackMode);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain(`[product-evidence-rejected:${attackMode}]`);
    expect(result.stdout).not.toContain("product-evidence-valid");
  }, 20_000);
});
