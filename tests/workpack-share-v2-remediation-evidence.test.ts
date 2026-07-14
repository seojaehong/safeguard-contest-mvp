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
const bindingManifest = path.join(
  "evaluation",
  "workpack-share-v2-product-2026-07-14",
  "remediation",
  "source-binding-manifest.json",
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
  "hang_reclassified",
  "stale_current_main",
  "stale_main_tree",
  "kosha_overlap",
  "ontology_cas_omission",
  "log_hash_tamper",
  "missing_incident",
  "missing_harness_red",
  "stale_browser_blob",
  "stale_harness_blob",
  "red_reclassified",
  "harness_red_reclassified",
  "missing_binding_manifest",
  "stale_binding_product",
  "stale_binding_integration",
  "stale_binding_ontology_product",
  "stale_binding_ontology_evidence",
  "missing_authority_ref",
  "wrong_authority_ref",
  "missing_ontology_authority_ref",
  "wrong_ontology_authority_ref",
  "unknown_binding_key",
  "stale_evidence_binding_hash",
  "stale_scope_race_count",
  "revision_domain_conflation",
  "evidence_summary_overlay_omission",
  "stale_localization_trust",
  "localization_scope_invalidation_omission",
  "share_workspace_state_omission",
] as const;

function runValidator(attackMode?: (typeof attackModes)[number]) {
  const arguments_ = attackMode === "missing_binding_manifest"
    ? ["--attack", attackMode]
    : [
        "--binding-manifest",
        bindingManifest,
        ...(attackMode ? ["--attack", attackMode] : []),
      ];
  return spawnSync(process.execPath, [validator, ...arguments_], {
    cwd: root,
    encoding: "utf8",
  });
}

describe("Share v2 remediation evidence contract", () => {
  it("accepts only committed evidence bound to manifest authorities and HOLD", () => {
    const result = runValidator();

    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).toContain("remediation-evidence-valid-hold");
    expect(result.stdout).toContain('"browserRunnerTests":130');
    expect(result.stdout).toContain('"browserRowsExecuted":128');
    expect(result.stdout).toContain('"scopeRaceChecks":4');
    expect(result.stdout).toContain('"ontologyShareConflictCount":7');
    expect(result.stdout).toContain('"shareProcessesAfter":0');
    expect(result.stdout).toContain('"independentReview":"pending"');
    expect(result.stdout).toContain('"hold":true');
  }, 30_000);

  it.each(attackModes)("rejects the %s attack fail closed", (attackMode) => {
    const result = runValidator(attackMode);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain(`[remediation-evidence-rejected:${attackMode}]`);
    expect(result.stdout).not.toContain("remediation-evidence-valid-hold");
  }, 30_000);
});
