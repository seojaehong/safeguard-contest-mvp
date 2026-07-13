import path from "node:path";
import { spawnSync } from "node:child_process";

import { describe, expect, it } from "vitest";

const root = process.cwd();
const validator = path.join(
  root,
  "evaluation",
  "workpack-share-v2-product-2026-07-14",
  "validate-contract-amendment.cjs",
);
const attackModes = [
  "missing_amendment",
  "stale_candidate_sha",
  "stale_evidence_sha",
  "stale_blob_hash",
  "unknown_key",
  "legacy_mobile_reintroduced",
  "per_node_scaling_reintroduced",
] as const;

function runValidator(...arguments_: string[]) {
  return spawnSync(process.execPath, [validator, ...arguments_], {
    cwd: root,
    encoding: "utf8",
  });
}

describe("Share v2 product contract amendment", () => {
  it("accepts the additive amendment bound to the immutable target-ready authority", () => {
    const result = runValidator();

    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).toContain("workpack-share-v2-product-2026-07-14");
    expect(result.stdout).toContain("contract-amendment-valid");
  });

  it.each(attackModes)("rejects the %s contract attack fail-closed", (attackMode) => {
    const result = runValidator("--attack", attackMode);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain(`[contract-amendment-rejected:${attackMode}]`);
    expect(result.stdout).not.toContain("contract-amendment-valid");
  });
});
