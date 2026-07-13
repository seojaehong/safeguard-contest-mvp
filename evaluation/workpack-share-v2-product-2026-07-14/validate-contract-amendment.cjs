"use strict";

const assert = require("node:assert/strict");
const childProcess = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const AMENDMENT_DIR = __dirname;
const REPO_ROOT = path.resolve(AMENDMENT_DIR, "..", "..");
const AMENDMENT_PATH = path.join(AMENDMENT_DIR, "contract-amendment.json");
const MARKDOWN_PATH = path.join(AMENDMENT_DIR, "contract-amendment.md");

const SOURCE_BASE = "f98ae7d16746dfe9fedbeea892e5af7ebb56f9a5";
const CANDIDATE = "c590cf184df352d5d319fae64cca087e77a31ba8";
const EVIDENCE = "f45bba17bcce0d8ebb2690f82d014dbe42ae8191";

const HISTORICAL_FILES = [
  {
    role: "target_ready_spec_markdown",
    path: "evaluation/workpack-share-v2-2026-07-13/spec.md",
    commit: CANDIDATE,
    gitBlob: "82290bc98c21342665d87c706c648143e3c7c6b3",
  },
  {
    role: "target_ready_spec_json",
    path: "evaluation/workpack-share-v2-2026-07-13/spec.json",
    commit: CANDIDATE,
    gitBlob: "80f0d9672e87c992f194bf598768d5a7d0d48d84",
  },
  {
    role: "target_ready_spec_validator",
    path: "evaluation/workpack-share-v2-2026-07-13/validate-spec.cjs",
    commit: CANDIDATE,
    gitBlob: "327556f49837bc012edf790ffda0f9f0f0af1d86",
  },
  {
    role: "target_ready_review_evidence",
    path: "evaluation/workpack-share-v2-2026-07-13/review-evidence.json",
    commit: EVIDENCE,
    gitBlob: "1bca7b1c78d046fc68082022f5f12a3d1fc33c82",
  },
];

const FIXTURE_STATES = [
  "empty",
  "selected",
  "channel_unavailable",
  "review_required",
  "workpack_revalidation",
  "logged_out",
  "blocked",
  "ready",
  "sending",
  "result_accepted",
  "result_partial",
  "fail_session",
  "fail_dispatch",
  "fail_dispatch_unpersisted",
  "offline",
  "stale",
];

const LANGUAGES = ["ko", "vi", "zh", "th", "uz", "mn", "ne", "km", "id", "my", "tl", "en"];
const ATTACK_MODES = [
  "missing_amendment",
  "stale_candidate_sha",
  "stale_evidence_sha",
  "stale_blob_hash",
  "unknown_key",
  "legacy_mobile_reintroduced",
  "per_node_scaling_reintroduced",
];

function git(arguments_) {
  return childProcess.execFileSync("git", arguments_, {
    cwd: REPO_ROOT,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
}

function assertCleanHistoricalPath(filePath) {
  const workingTree = childProcess.spawnSync("git", ["diff", "--quiet", "--", filePath], {
    cwd: REPO_ROOT,
    encoding: "utf8",
  });
  const index = childProcess.spawnSync("git", ["diff", "--cached", "--quiet", "--", filePath], {
    cwd: REPO_ROOT,
    encoding: "utf8",
  });

  assert.equal(workingTree.status, 0, `historical file has uncommitted edits: ${filePath}`);
  assert.equal(index.status, 0, `historical file has staged edits: ${filePath}`);
}

function assertDeepEqual(actual, expected, label) {
  try {
    assert.deepEqual(actual, expected);
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`${label}: ${error.message}`);
    }
    throw error;
  }
}

function validateContract(contract) {
  assertDeepEqual(Object.keys(contract).sort(), [
    "amendmentId",
    "censusRemap",
    "effectiveScope",
    "immutableAuthority",
    "replacementAuthority",
    "schemaVersion",
    "status",
    "supersededLegacyTokens",
    "validation",
  ].sort(), "closed top-level schema");

  assert.equal(contract.schemaVersion, "safeclaw-workpack-share-v2-contract-amendment/v1");
  assert.equal(contract.amendmentId, "workpack-share-v2-product-2026-07-14");
  assert.equal(contract.status, "AUTHORITATIVE_ADDITIVE_ERRATUM");

  assertDeepEqual(contract.effectiveScope, {
    historicalAuthorityPreserved: true,
    historicalDirectory: "evaluation/workpack-share-v2-2026-07-13",
    amendmentDirectory: "evaluation/workpack-share-v2-product-2026-07-14",
    productBranchExactBase: EVIDENCE,
    authorityRule: "The immutable target-ready files remain historical evidence; this additive amendment exclusively replaces the selected mobile viewport and text-scaling delivery contract for Share v2 product and browser evidence.",
  }, "effectiveScope");

  assertDeepEqual(contract.immutableAuthority, {
    gitObjectHashAlgorithm: "sha1",
    sourceBaseCommit: SOURCE_BASE,
    targetReadySpecCommit: CANDIDATE,
    reviewEvidenceCommit: EVIDENCE,
    files: HISTORICAL_FILES,
  }, "immutableAuthority");

  assertDeepEqual(contract.supersededLegacyTokens, [
    {
      id: "selected_mobile_viewport",
      token: "391x844",
      disposition: "historical_only_not_product_authority",
    },
    {
      id: "per_node_text_scaling",
      token: "computed_text_200 per-node/leaf fontSize/lineHeight mutation",
      disposition: "historical_only_not_product_authority",
    },
  ], "supersededLegacyTokens");

  assertDeepEqual(contract.replacementAuthority, {
    mobileViewport: {
      widthCssPx: 390,
      heightCssPx: 844,
      exact: true,
      selectedEvidenceOnly: true,
    },
    textScaling: {
      baselineModeId: "normal_100",
      scaledModeId: "owning_root_text_200",
      scaleFactor: 2,
      owningMechanismCount: 1,
      deliveryMechanism: "product-owned root data attribute with CSS cascade",
      rootSelector: "[data-share-root]",
      rootAttribute: "data-share-text-scale",
      baselineValue: "100",
      scaledValue: "200",
      rootAttributeMutationCount: 1,
      descendantStyleMutationCount: 0,
      directLeafInlineMutationCount: 0,
      cssTransformAllowed: false,
      cssZoomAllowed: false,
      viewportMutationAllowed: false,
      deviceScaleMutationAllowed: false,
    },
    measurement: {
      baselineCapturedBeforeMutation: true,
      rootMechanismAppliedExactlyOnce: true,
      freshDomRunsPerScaledCase: 2,
      requiredSurfaces: [
        "computed_style_cascade",
        "pseudo_elements_before_after",
        "media_and_layout_reflow",
        "localized_text_wrap_and_growth",
        "button_hit_area",
        "horizontal_overflow",
        "unintended_overlap",
        "nested_vertical_scroll",
      ],
      pseudoElements: ["::before", "::after"],
      minimumInteractiveTargetCssPx: 44,
      maximumHorizontalOverflowCssPx: 0,
      maximumUnintendedOverlapCount: 0,
      maximumNestedVerticalScrollCount: 0,
    },
  }, "replacementAuthority");

  assertDeepEqual(contract.censusRemap, {
    caseIdTemplate: "{environmentId}:{fixtureId}:{scaleModeId}",
    environmentCount: 4,
    fixtureCount: 16,
    scaleModeCount: 2,
    exactCaseCount: 128,
    formula: "4 environments * 16 fixtures * 2 scale modes",
    countChanged: false,
    countExplanation: "The count is recomputed, not preserved by assertion: the mobile viewport and scaled mode are deterministic one-for-one replacements, so all axis cardinalities remain 4, 16, and 2.",
    environments: [
      { id: "day-desktop", theme: "day", viewport: "1440x1000" },
      { id: "night-desktop", theme: "night", viewport: "1440x1000" },
      { id: "day-mobile", theme: "day", viewport: "390x844" },
      { id: "night-mobile", theme: "night", viewport: "390x844" },
    ],
    scaleModes: [
      { id: "normal_100", replacementFor: "normal_100", caseCount: 64 },
      { id: "owning_root_text_200", replacementFor: "computed_text_200", caseCount: 64 },
    ],
    fixtureStates: FIXTURE_STATES,
    languages: LANGUAGES,
    preservedAxes: ["fixture_state", "language_authority", "theme", "desktop_viewport"],
    remappedAxes: ["mobile_viewport_391_to_390", "computed_per_node_to_owning_root_scale"],
  }, "censusRemap");

  assert.equal(
    contract.censusRemap.environmentCount
      * contract.censusRemap.fixtureCount
      * contract.censusRemap.scaleModeCount,
    contract.censusRemap.exactCaseCount,
    "census arithmetic must be derived",
  );
  assert.equal(
    contract.censusRemap.scaleModes.reduce((total, mode) => total + mode.caseCount, 0),
    contract.censusRemap.exactCaseCount,
    "scale-mode row counts must add to the census",
  );

  assertDeepEqual(contract.validation, {
    validator: "evaluation/workpack-share-v2-product-2026-07-14/validate-contract-amendment.cjs",
    productEvidenceSchemaVersion: "safeclaw-workpack-share-v2-contract-evidence/v1",
    productEvidenceRequiresAmendmentCommit: true,
    closedSchema: true,
    unknownKeysAllowed: false,
    historicalFilesMayContainSupersededTokens: true,
    activeProductFilesMayContainSupersededTokens: false,
    attackModes: ATTACK_MODES,
  }, "validation");
}

function validateGitAuthority(contract) {
  assert.equal(git(["rev-parse", `${CANDIDATE}^`]), SOURCE_BASE, "candidate parent changed");
  assert.equal(git(["rev-parse", `${EVIDENCE}^`]), CANDIDATE, "evidence parent changed");

  const candidateFiles = git(["diff-tree", "--no-commit-id", "--name-only", "-r", CANDIDATE])
    .split(/\r?\n/u)
    .filter(Boolean)
    .sort();
  const evidenceFiles = git(["diff-tree", "--no-commit-id", "--name-only", "-r", EVIDENCE])
    .split(/\r?\n/u)
    .filter(Boolean)
    .sort();

  assertDeepEqual(candidateFiles, HISTORICAL_FILES.slice(0, 3).map((file) => file.path).sort(), "candidate file scope");
  assertDeepEqual(evidenceFiles, [HISTORICAL_FILES[3].path], "evidence file scope");

  for (const file of contract.immutableAuthority.files) {
    assert.equal(git(["rev-parse", `${file.commit}:${file.path}`]), file.gitBlob, `${file.role} commit blob changed`);
    assert.equal(git(["rev-parse", `HEAD:${file.path}`]), file.gitBlob, `${file.role} HEAD blob changed`);
    assertCleanHistoricalPath(file.path);
  }

  const reviewEvidencePath = path.join(REPO_ROOT, HISTORICAL_FILES[3].path);
  const reviewEvidence = JSON.parse(fs.readFileSync(reviewEvidencePath, "utf8"));
  assert.equal(reviewEvidence.sourceBase, SOURCE_BASE, "review evidence source base changed");
  assert.equal(reviewEvidence.candidate, CANDIDATE, "review evidence candidate changed");
  assert.equal(reviewEvidence.evidenceCommitContract.requiredParent, CANDIDATE, "review evidence parent contract changed");
}

function validateMarkdown(contract) {
  const markdown = fs.readFileSync(MARKDOWN_PATH, "utf8");
  const requiredTokens = [
    contract.amendmentId,
    contract.status,
    SOURCE_BASE,
    CANDIDATE,
    EVIDENCE,
    ...HISTORICAL_FILES.flatMap((file) => [file.path, file.gitBlob]),
    "391x844",
    "computed_text_200 per-node/leaf fontSize/lineHeight mutation",
    "390x844",
    "owning_root_text_200",
    "descendant style mutation count",
    "direct leaf inline mutation count",
    "4 * 16 * 2 = 128",
  ];

  for (const token of requiredTokens) {
    assert.equal(markdown.includes(token), true, `contract-amendment.md missing ${token}`);
  }
}

function parseArguments(arguments_) {
  if (arguments_.length === 0) return { attack: null };
  if (arguments_.length !== 2 || arguments_[0] !== "--attack" || !ATTACK_MODES.includes(arguments_[1])) {
    throw new Error(`unsupported arguments: ${arguments_.join(" ")}`);
  }
  return { attack: arguments_[1] };
}

function applyAttack(contract, attack) {
  if (attack === "stale_candidate_sha") {
    contract.immutableAuthority.targetReadySpecCommit = "0000000000000000000000000000000000000000";
  } else if (attack === "stale_evidence_sha") {
    contract.immutableAuthority.reviewEvidenceCommit = "0000000000000000000000000000000000000000";
  } else if (attack === "stale_blob_hash") {
    contract.immutableAuthority.files[0].gitBlob = "0000000000000000000000000000000000000000";
  } else if (attack === "unknown_key") {
    contract.replacementAuthority.mobileViewport.authorityOverride = true;
  } else if (attack === "legacy_mobile_reintroduced") {
    contract.replacementAuthority.mobileViewport.widthCssPx = 391;
  } else if (attack === "per_node_scaling_reintroduced") {
    contract.replacementAuthority.textScaling.deliveryMechanism = "per-node leaf fontSize and lineHeight mutation";
  }
}

function main() {
  const { attack } = parseArguments(process.argv.slice(2));
  const sourcePath = attack === "missing_amendment"
    ? path.join(AMENDMENT_DIR, "missing-contract-amendment.json")
    : AMENDMENT_PATH;

  try {
    const contract = JSON.parse(fs.readFileSync(sourcePath, "utf8"));
    applyAttack(contract, attack);
    validateContract(contract);
    validateGitAuthority(contract);
    validateMarkdown(contract);

    if (attack !== null) {
      throw new Error(`attack unexpectedly passed: ${attack}`);
    }

    process.stdout.write(`${JSON.stringify({
      amendmentId: contract.amendmentId,
      status: "contract-amendment-valid",
      exactCaseCount: contract.censusRemap.exactCaseCount,
    })}\n`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (attack !== null) {
      process.stderr.write(`[contract-amendment-rejected:${attack}] ${message}\n`);
    } else {
      process.stderr.write(`[contract-amendment-invalid] ${message}\n`);
    }
    process.exitCode = 1;
  }
}

main();
