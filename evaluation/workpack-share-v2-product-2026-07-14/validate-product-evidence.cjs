"use strict";

const assert = require("node:assert/strict");
const childProcess = require("node:child_process");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const EVIDENCE_DIR = __dirname;
const REPO_ROOT = path.resolve(EVIDENCE_DIR, "..", "..");
const EVIDENCE_PATH = path.join(EVIDENCE_DIR, "contract-evidence.json");
const AMENDMENT_PATH = path.join(EVIDENCE_DIR, "contract-amendment.json");
const AMENDMENT_VALIDATOR_PATH = path.join(EVIDENCE_DIR, "validate-contract-amendment.cjs");
const AMENDMENT_COMMIT = "e2f16da5efd09e393a459b5efd0a9e51d9f6a558";
const AMENDMENT_PARENT = "4aed97940472d874b65008fd880b21c4e178d173";
const PRODUCT_COMMIT = "fae7059e588c5b571cf4fb5918884cd8c5ef1365";
const PRODUCT_PARENT = AMENDMENT_COMMIT;
const PRODUCT_REMOTE_REF = "refs/heads/feat/workpack-share-v2-product";
const PRODUCT_CENSUS_PATH = "evaluation/workpack-share-v2-product-2026-07-14/logs/product-changed-files.json";
const PRODUCT_CENSUS_SHA256 = "7cde4344c685de46f9fd765186190193d3d42a8c40095296069da8ca23045299";

const AMENDMENT_FILES = [
  {
    path: "evaluation/workpack-share-v2-product-2026-07-14/contract-amendment.json",
    gitBlob: "0718c65b71cfacef316709199e88c9c7fba5c345",
  },
  {
    path: "evaluation/workpack-share-v2-product-2026-07-14/contract-amendment.md",
    gitBlob: "e7538f29acd75fbd0e44de280f7f84579be89876",
  },
  {
    path: "evaluation/workpack-share-v2-product-2026-07-14/validate-contract-amendment.cjs",
    gitBlob: "35ab4cc288175d50417fb5c50e5770fdf8bd280b",
  },
  {
    path: "tests/workpack-share-v2-contract-amendment.test.ts",
    gitBlob: "4149f0fac42cccbe5ce6c5a7b1e14e1d7c2529f4",
  },
];

const PRODUCT_FILES = [
  {
    path: "components/WorkflowSharePanel.module.css",
    gitBlob: "7e86049b1155c6c651396fb58decd138583b7830",
  },
  {
    path: "components/WorkflowSharePanel.tsx",
    gitBlob: "c26cbf09b1bc830a5f4695993cbeae926446f0b3",
  },
  {
    path: "components/WorkflowSharePolicy.ts",
    gitBlob: "647ac09ceeaf8d81b8e0ca628ed0131d0c640b1b",
  },
  {
    path: "tests/fixtures/workpack-share-v2.ts",
    gitBlob: "7567a9ba16d2ca0a507ef08a0390a1e8870d5553",
  },
  {
    path: "tests/workpack-share-v2-browser.test.ts",
    gitBlob: "ab1cfbf1506526c04fb0843ad340133b68357714",
  },
];

const VERIFICATION_CHECKS = [
  {
    id: "focused_regression",
    command: "npm.cmd test -- tests/workpack-share-server-config.test.ts tests/reviewed-localization-envelope.test.ts tests/reviewed-localization-route.test.ts tests/workpack-generation-evidence-route.test.ts tests/workpack-share-authority.test.ts tests/foreign-worker-languages.test.ts tests/workpack-commercial.test.ts tests/channel-availability.test.ts tests/channel-availability-route.test.ts tests/dispatch-logs-route.test.ts tests/workpack-share-authority-routes.test.ts tests/workspace-pages.test.ts tests/workflow-share-client.test.ts tests/workflow-share-panel-behavior.test.ts tests/workspace-workers.test.ts tests/frontend-shared-surfaces.test.ts tests/product-module-shell.test.ts tests/documents-editor-layout.test.ts tests/workpack-share-v2-contract-amendment.test.ts tests/workpack-share-v2-product-evidence.test.ts tests/workpack-share-v2-browser.test.ts --maxWorkers=1 --no-file-parallelism",
    status: "pass",
    exitCode: 0,
    logPath: "evaluation/workpack-share-v2-product-2026-07-14/logs/final-unit.log",
    logSha256: "9282b4a70a333e09292a75eeaac0fbdd588eba73f7a48573f210ed800b195191",
  },
  {
    id: "strict_typecheck",
    command: "npm.cmd run typecheck",
    status: "pass",
    exitCode: 0,
    logPath: "evaluation/workpack-share-v2-product-2026-07-14/logs/final-typecheck.log",
    logSha256: "8d5084cdc8c6cf2df972583ee0cc28c49331cc4dd9293112763bd5a66ab97ef5",
  },
  {
    id: "production_build",
    command: "npm.cmd run build",
    status: "pass",
    exitCode: 0,
    logPath: "evaluation/workpack-share-v2-product-2026-07-14/logs/final-build.log",
    logSha256: "0d455c0eba59e1ac946f0e5d29a786303c3401c7db59aa5ec6ad06888a0acc45",
  },
  {
    id: "frontend_consistency",
    command: "npm.cmd run audit:frontend-consistency",
    status: "pass",
    exitCode: 0,
    logPath: "evaluation/workpack-share-v2-product-2026-07-14/logs/final-frontend-audit.log",
    logSha256: "3afa70156c95a01ea53626004dda5e29001d95af876e864f120b606f4c127e44",
  },
  {
    id: "product_diff_check",
    command: "git diff --cached --check",
    status: "pass",
    exitCode: 0,
    logPath: "evaluation/workpack-share-v2-product-2026-07-14/logs/final-product-diff-check.log",
    logSha256: "eaeabd49e626fb3cadd60b4fdff4dd6ab3c66f1f7590363a073abf76bea21051",
  },
  {
    id: "product_secret_scan",
    command: "PowerShell staged-added-lines high-confidence secret scan",
    status: "pass",
    exitCode: 0,
    logPath: "evaluation/workpack-share-v2-product-2026-07-14/logs/final-product-secret-scan.json",
    logSha256: "f18016fd41701dd556d03782c1fac1f2c4e9b74e1ff4886e2535a7af01ac29b4",
  },
  {
    id: "product_pull_rebase",
    command: "git pull --rebase origin feat/phase-a-evidence-integration",
    status: "pass",
    exitCode: 0,
    logPath: "evaluation/workpack-share-v2-product-2026-07-14/logs/product-pull-rebase.log",
    logSha256: "eb4bf026473e26fd786765b913261b84f299ebd5142ffb8baa0f30069924541c",
  },
];

const RESTORATION_EVIDENCE = {
  path: "evaluation/workpack-share-v2-product-2026-07-14/logs/generated-artifact-restoration.json",
  sha256: "998aa6869faf6e086c6456c6943e98109afcb13d8ca5ae310f5b57c42211bdd0",
  fileCount: 16,
  mismatchCount: 0,
  parentHeadWorktreeHashesEqual: true,
};

const ENVIRONMENTS = [
  { id: "day-desktop", width: 1440, height: 1000 },
  { id: "night-desktop", width: 1440, height: 1000 },
  { id: "day-mobile", width: 390, height: 844 },
  { id: "night-mobile", width: 390, height: 844 },
];
const FIXTURES = [
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
const SCALE_MODES = ["normal_100", "owning_root_text_200"];
const EXPECTED_STATES = {
  empty: "no_recipients",
  selected: "selected",
  channel_unavailable: "selected",
  review_required: "review_required",
  workpack_revalidation: "workpack_revalidation",
  logged_out: "logged_out",
  blocked: "blocked",
  ready: "ready",
  sending: "sending",
  result_accepted: "success",
  result_partial: "partial",
  fail_session: "fail",
  fail_dispatch: "fail",
  fail_dispatch_unpersisted: "fail",
  offline: "offline",
  stale: "stale",
};
const ATTACK_MODES = [
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
];
const ACTIVE_PRODUCT_FILES = [
  "components/WorkflowSharePanel.tsx",
  "components/WorkflowSharePanel.module.css",
  "components/WorkflowSharePolicy.ts",
  "tests/fixtures/workpack-share-v2.ts",
];

function assertDeepEqual(actual, expected, label) {
  try {
    assert.deepEqual(actual, expected);
  } catch (error) {
    if (error instanceof Error) throw new Error(`${label}: ${error.message}`);
    throw error;
  }
}

function assertClosedObject(value, keys, label) {
  assert.equal(typeof value, "object", `${label} must be an object`);
  assert.notEqual(value, null, `${label} must not be null`);
  assert.equal(Array.isArray(value), false, `${label} must not be an array`);
  assertDeepEqual(Object.keys(value).sort(), [...keys].sort(), `${label} keys`);
}

function git(arguments_) {
  return childProcess.execFileSync("git", arguments_, {
    cwd: REPO_ROOT,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
}

function sha256(filePath) {
  return crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex");
}

function validateEvidenceManifest(evidence) {
  assertClosedObject(evidence, [
    "schemaVersion",
    "evidenceId",
    "status",
    "amendment",
    "productCommit",
    "browserRun",
    "census",
    "authorityObservations",
    "verificationChecks",
    "generatedArtifactRestoration",
    "reviewBoundary",
  ], "evidence");
  assert.equal(evidence.schemaVersion, "safeclaw-workpack-share-v2-contract-evidence/v1");
  assert.equal(evidence.evidenceId, "workpack-share-v2-product-browser-2026-07-14");
  assert.equal(evidence.status, "BROWSER_EVIDENCE_COMPLETE_REVIEW_PENDING");

  assertDeepEqual(evidence.amendment, {
    amendmentId: "workpack-share-v2-product-2026-07-14",
    commit: AMENDMENT_COMMIT,
    parentCommit: AMENDMENT_PARENT,
    files: AMENDMENT_FILES,
  }, "evidence.amendment");
  assertDeepEqual(evidence.productCommit, {
    commit: PRODUCT_COMMIT,
    parentCommit: PRODUCT_PARENT,
    remoteRef: PRODUCT_REMOTE_REF,
    remoteShaAtProductPush: PRODUCT_COMMIT,
    remoteMatchedProductCommitAtProductPush: true,
    currentRemoteMayAdvanceByEvidenceCommit: true,
    changedFileCount: PRODUCT_FILES.length,
    changedFileCensusPath: PRODUCT_CENSUS_PATH,
    changedFileCensusSha256: PRODUCT_CENSUS_SHA256,
    files: PRODUCT_FILES,
  }, "evidence.productCommit");
  assertDeepEqual(evidence.browserRun, {
    command: "$env:WORKPACK_SHARE_V2_BROWSER='1'; npm.cmd test -- tests/workpack-share-v2-browser.test.ts --maxWorkers=1 --no-file-parallelism",
    testFile: "tests/workpack-share-v2-browser.test.ts",
    metricsPath: "evaluation/workpack-share-v2-product-2026-07-14/logs/browser-metrics.json",
    metricsSha256: "83844c30856e8aabae28b23f3db805ba60338fcf9010227dcabe758bd996c131",
    logPath: "evaluation/workpack-share-v2-product-2026-07-14/logs/final-browser.log",
    logSha256: "451425132ca58be2f5887acbd10f1afb0ef6be8b67a00c2a463fa6d1a16b7104",
    runnerTestsPassed: 130,
    browserRowsExecuted: 128,
    browserRowsUnexecuted: 0,
    durationSeconds: 1545.46,
  }, "evidence.browserRun");
  assertDeepEqual(evidence.census, {
    formula: "4 environments * 16 fixtures * 2 scale modes",
    environmentCount: 4,
    fixtureCount: 16,
    scaleModeCount: 2,
    exactCaseCount: 128,
    normal100Count: 64,
    owningRootText200Count: 64,
    mobile390x844Count: 64,
    legacy391Count: 0,
    uniqueCaseCount: 128,
  }, "evidence.census");
  assertDeepEqual(evidence.authorityObservations, {
    rootAttributeMutationMaximum: 1,
    descendantStyleMutationMaximum: 0,
    directLeafInlineMutationMaximum: 0,
    pseudoFailureCount: 0,
    maximumHorizontalOverflowCssPx: 0,
    maximumPanelOverflowCssPx: 0,
    touchTargetFailureCount: 0,
    overlapFailureCount: 0,
    nestedScrollFailureCount: 0,
    clippedTextFailureCount: 0,
    languageAuthorityCheckCount: 192,
    reviewVariantCheckCount: 80,
    staleBindingVariantCheckCount: 32,
  }, "evidence.authorityObservations");
  assertDeepEqual(evidence.verificationChecks, VERIFICATION_CHECKS, "evidence.verificationChecks");
  assertDeepEqual(
    evidence.generatedArtifactRestoration,
    RESTORATION_EVIDENCE,
    "evidence.generatedArtifactRestoration",
  );
  assertDeepEqual(evidence.reviewBoundary, {
    freshIndependentReviewRequired: true,
    freshIndependentReviewStatus: "pending",
    selfApproved: false,
    integratedIntoMain: false,
    completionClaim: "implementation_evidence_complete_review_pending",
  }, "evidence.reviewBoundary");
}

function validateAmendmentBinding(evidence, amendmentPath) {
  assert.equal(fs.existsSync(amendmentPath), true, "committed amendment is missing");
  assert.equal(git(["rev-parse", `${evidence.amendment.commit}^{commit}`]), AMENDMENT_COMMIT);
  assert.equal(git(["rev-parse", `${evidence.amendment.commit}^`]), AMENDMENT_PARENT);
  const ancestor = childProcess.spawnSync("git", ["merge-base", "--is-ancestor", evidence.amendment.commit, "HEAD"], {
    cwd: REPO_ROOT,
    encoding: "utf8",
  });
  assert.equal(ancestor.status, 0, "amendment commit is not an ancestor of HEAD");

  const changedFiles = git(["diff-tree", "--no-commit-id", "--name-only", "-r", evidence.amendment.commit])
    .split(/\r?\n/u)
    .filter(Boolean)
    .sort();
  assertDeepEqual(changedFiles, AMENDMENT_FILES.map((file) => file.path).sort(), "amendment commit file scope");
  for (const file of evidence.amendment.files) {
    assert.equal(git(["rev-parse", `${evidence.amendment.commit}:${file.path}`]), file.gitBlob, `${file.path} amendment blob`);
    assert.equal(git(["rev-parse", `HEAD:${file.path}`]), file.gitBlob, `${file.path} current blob`);
  }

  const amendmentValidator = childProcess.spawnSync(process.execPath, [AMENDMENT_VALIDATOR_PATH], {
    cwd: REPO_ROOT,
    encoding: "utf8",
  });
  assert.equal(amendmentValidator.status, 0, amendmentValidator.stderr || "amendment validator failed");
  assert.equal(amendmentValidator.stdout.includes("contract-amendment-valid"), true);
}

function validateProductBinding(evidence, validateRemote) {
  assert.equal(git(["rev-parse", `${evidence.productCommit.commit}^{commit}`]), PRODUCT_COMMIT);
  assert.equal(git(["rev-parse", `${evidence.productCommit.commit}^`]), PRODUCT_PARENT);
  const ancestor = childProcess.spawnSync("git", ["merge-base", "--is-ancestor", PRODUCT_COMMIT, "HEAD"], {
    cwd: REPO_ROOT,
    encoding: "utf8",
  });
  assert.equal(ancestor.status, 0, "product commit is not an ancestor of HEAD");

  const changedFiles = git(["diff-tree", "--no-commit-id", "--name-only", "-r", PRODUCT_COMMIT])
    .split(/\r?\n/u)
    .filter(Boolean)
    .sort();
  assertDeepEqual(changedFiles, PRODUCT_FILES.map((file) => file.path).sort(), "product commit file scope");
  for (const file of PRODUCT_FILES) {
    assert.equal(git(["rev-parse", `${PRODUCT_COMMIT}:${file.path}`]), file.gitBlob, `${file.path} product blob`);
    assert.equal(git(["rev-parse", `HEAD:${file.path}`]), file.gitBlob, `${file.path} current blob`);
  }

  const censusPath = path.join(REPO_ROOT, evidence.productCommit.changedFileCensusPath);
  assert.equal(fs.existsSync(censusPath), true, "product changed-file census is missing");
  assert.equal(sha256(censusPath), evidence.productCommit.changedFileCensusSha256, "product census hash changed");
  const census = JSON.parse(fs.readFileSync(censusPath, "utf8"));
  assertClosedObject(census, [
    "schemaVersion",
    "commit",
    "parent",
    "changedFileCount",
    "files",
  ], "product changed-file census");
  assert.equal(census.schemaVersion, "safeclaw-changed-file-census/v1");
  assert.equal(census.commit, PRODUCT_COMMIT);
  assert.equal(census.parent, PRODUCT_PARENT);
  assert.equal(census.changedFileCount, PRODUCT_FILES.length);
  assert.equal(Array.isArray(census.files), true);
  census.files.forEach((file, index) => {
    assertClosedObject(file, ["path", "gitBlob"], `product census file ${index}`);
  });
  assertDeepEqual(census.files, PRODUCT_FILES, "product changed-file census files");

  if (!validateRemote) return null;
  const remoteRows = git(["ls-remote", "--heads", "origin", evidence.productCommit.remoteRef])
    .split(/\r?\n/u)
    .filter(Boolean);
  assert.equal(remoteRows.length, 1, "product remote ref is missing or ambiguous");
  const [remoteSha, remoteRef] = remoteRows[0].split(/\s+/u);
  assert.equal(remoteRef, PRODUCT_REMOTE_REF, "product remote ref changed");
  const remoteContainsProduct = childProcess.spawnSync(
    "git",
    ["merge-base", "--is-ancestor", PRODUCT_COMMIT, remoteSha],
    { cwd: REPO_ROOT, encoding: "utf8" },
  );
  assert.equal(remoteContainsProduct.status, 0, "current product remote does not contain the bound product commit");
  return remoteSha;
}

function validateVerificationChecks(evidence) {
  for (const check of evidence.verificationChecks) {
    assertClosedObject(check, [
      "id",
      "command",
      "status",
      "exitCode",
      "logPath",
      "logSha256",
    ], `verification check ${check.id || "unknown"}`);
    const logPath = path.join(REPO_ROOT, check.logPath);
    assert.equal(fs.existsSync(logPath), true, `${check.id} log is missing`);
    assert.equal(sha256(logPath), check.logSha256, `${check.id} log hash changed`);

    if (check.id === "product_secret_scan") {
      const scan = JSON.parse(fs.readFileSync(logPath, "utf8"));
      assertClosedObject(scan, [
        "command",
        "stagedFileCount",
        "patternCount",
        "hitCount",
        "hitIds",
        "status",
      ], "product secret scan");
      assert.equal(scan.command, "staged-added-lines high-confidence secret scan");
      assert.equal(scan.stagedFileCount, PRODUCT_FILES.length);
      assert.equal(scan.patternCount, 5);
      assert.equal(scan.hitCount, 0);
      assertDeepEqual(scan.hitIds, [], "product secret scan hits");
      assert.equal(scan.status, "pass");
      continue;
    }

    const log = fs.readFileSync(logPath, "utf8");
    if (check.id === "product_diff_check") {
      assert.equal(log.includes("[exit-code] 0"), true, "product diff check has no zero exit marker");
      continue;
    }
    assert.equal(log.includes("[evidence-exit-code] 0"), true, `${check.id} has no zero exit marker`);
    if (check.id === "focused_regression") {
      assert.equal(/Test Files\s+21 passed \(21\)/u.test(log), true, "focused regression file count changed");
      assert.equal(/Tests\s+173 passed \| 128 skipped \(301\)/u.test(log), true, "focused regression count changed");
    } else if (check.id === "strict_typecheck") {
      assert.equal(log.includes("tsc --noEmit --incremental false"), true, "typecheck command changed");
    } else if (check.id === "production_build") {
      assert.equal(log.includes("Compiled successfully"), true, "production build completion marker is missing");
    } else if (check.id === "frontend_consistency") {
      assert.equal(log.includes('"violationCount": 0'), true, "frontend audit violation count changed");
    } else if (check.id === "product_pull_rebase") {
      assert.equal(log.includes("is up to date"), true, "product pull-rebase completion marker is missing");
    }
  }
}

function validateGeneratedArtifactRestoration(evidence) {
  const restorationPath = path.join(REPO_ROOT, evidence.generatedArtifactRestoration.path);
  assert.equal(fs.existsSync(restorationPath), true, "generated-artifact restoration evidence is missing");
  assert.equal(
    sha256(restorationPath),
    evidence.generatedArtifactRestoration.sha256,
    "generated-artifact restoration hash changed",
  );
  const restoration = JSON.parse(fs.readFileSync(restorationPath, "utf8"));
  assertClosedObject(restoration, [
    "schemaVersion",
    "productCommit",
    "parentCommit",
    "fileCount",
    "mismatchCount",
    "files",
  ], "generated-artifact restoration");
  assert.equal(restoration.schemaVersion, "safeclaw-generated-artifact-restoration/v1");
  assert.equal(restoration.productCommit, PRODUCT_COMMIT);
  assert.equal(restoration.parentCommit, PRODUCT_PARENT);
  assert.equal(restoration.fileCount, 16);
  assert.equal(restoration.mismatchCount, 0);
  assert.equal(Array.isArray(restoration.files), true);
  assert.equal(restoration.files.length, 16);

  const paths = new Set();
  for (const artifact of restoration.files) {
    assertClosedObject(artifact, [
      "path",
      "parentBlob",
      "headBlob",
      "worktreeBlob",
      "allEqual",
    ], `restored artifact ${artifact.path || "unknown"}`);
    assert.equal(
      artifact.path.startsWith("output/playwright/2026-07-10/module-shell-hardening/"),
      true,
      `restored artifact escaped the expected directory: ${artifact.path}`,
    );
    assert.equal(paths.has(artifact.path), false, `duplicate restored artifact: ${artifact.path}`);
    paths.add(artifact.path);
    assert.equal(git(["rev-parse", `${PRODUCT_PARENT}:${artifact.path}`]), artifact.parentBlob);
    assert.equal(git(["rev-parse", `${PRODUCT_COMMIT}:${artifact.path}`]), artifact.headBlob);
    assert.equal(git(["hash-object", artifact.path]), artifact.worktreeBlob);
    assert.equal(artifact.parentBlob, artifact.headBlob, `${artifact.path} parent/head mismatch`);
    assert.equal(artifact.headBlob, artifact.worktreeBlob, `${artifact.path} head/worktree mismatch`);
    assert.equal(artifact.allEqual, true, `${artifact.path} was not restored`);
  }
  const artifactStatus = git([
    "status",
    "--porcelain=v1",
    "--",
    "output/playwright/2026-07-10/module-shell-hardening",
  ]);
  assert.equal(artifactStatus, "", "restored generated artifacts are still dirty");
}

function validateBrowserMetricRow(row) {
  assertClosedObject(row, [
    "caseId",
    "contractAmendmentCommit",
    "environmentId",
    "fixtureId",
    "scaleModeId",
    "viewport",
    "expectedState",
    "freshDomRuns",
    "languageAuthorityChecks",
    "reviewVariantChecks",
    "staleVariantChecks",
    "geometry",
    "rootScale",
  ], `metrics row ${row.caseId || "unknown"}`);
  assertClosedObject(row.viewport, ["width", "height"], `${row.caseId}.viewport`);
  assertClosedObject(row.geometry, [
    "maximumHorizontalOverflow",
    "maximumPanelOverflow",
    "touchTargetFailureCount",
    "overlapFailureCount",
    "nestedScrollFailureCount",
    "clippedTextFailureCount",
  ], `${row.caseId}.geometry`);
  assertDeepEqual(row.geometry, {
    maximumHorizontalOverflow: 0,
    maximumPanelOverflow: 0,
    touchTargetFailureCount: 0,
    overlapFailureCount: 0,
    nestedScrollFailureCount: 0,
    clippedTextFailureCount: 0,
  }, `${row.caseId}.geometry values`);

  const environment = ENVIRONMENTS.find((candidate) => candidate.id === row.environmentId);
  assert.notEqual(environment, undefined, `${row.caseId} environment`);
  assert.equal(FIXTURES.includes(row.fixtureId), true, `${row.caseId} fixture`);
  assert.equal(SCALE_MODES.includes(row.scaleModeId), true, `${row.caseId} scale mode`);
  assert.equal(row.caseId, `${row.environmentId}:${row.fixtureId}:${row.scaleModeId}`);
  assert.equal(row.contractAmendmentCommit, AMENDMENT_COMMIT);
  assertDeepEqual(row.viewport, { width: environment.width, height: environment.height }, `${row.caseId} viewport`);
  assert.equal(row.expectedState, EXPECTED_STATES[row.fixtureId], `${row.caseId} state`);
  assert.equal(row.languageAuthorityChecks, row.fixtureId === "ready" ? 24 : 0);
  assert.equal(row.reviewVariantChecks, row.fixtureId === "review_required" ? 10 : 0);
  assert.equal(row.staleVariantChecks, row.fixtureId === "stale" ? 4 : 0);

  if (row.scaleModeId === "normal_100") {
    assert.equal(row.freshDomRuns, 1);
    assert.equal(row.rootScale, null);
    return;
  }
  assert.equal(row.freshDomRuns, 2);
  assertClosedObject(row.rootScale, [
    "rootAttributeMutationCount",
    "descendantStyleMutationCount",
    "directLeafInlineMutationCount",
    "pseudoElementInspectionCount",
    "pseudoFailureCount",
    "mediaQueryStable",
    "containerQueryStable",
  ], `${row.caseId}.rootScale`);
  assert.equal(row.rootScale.rootAttributeMutationCount, 1);
  assert.equal(row.rootScale.descendantStyleMutationCount, 0);
  assert.equal(row.rootScale.directLeafInlineMutationCount, 0);
  assert.equal(row.rootScale.pseudoElementInspectionCount > 0, true);
  assert.equal(row.rootScale.pseudoFailureCount, 0);
  assert.equal(row.rootScale.mediaQueryStable, true);
  assert.equal(row.rootScale.containerQueryStable, true);
}

function validateBrowserMetrics(evidence, metrics) {
  assertClosedObject(metrics, [
    "schemaVersion",
    "amendmentId",
    "contractAmendmentCommit",
    "generatedAt",
    "status",
    "census",
    "authority",
    "rows",
  ], "browser metrics");
  assert.equal(metrics.schemaVersion, "safeclaw-workpack-share-v2-browser-metrics/v1");
  assert.equal(metrics.amendmentId, evidence.amendment.amendmentId);
  assert.equal(metrics.contractAmendmentCommit, evidence.amendment.commit);
  assert.equal(Number.isFinite(Date.parse(metrics.generatedAt)), true);
  assert.equal(metrics.status, "complete");
  assertDeepEqual(metrics.census, {
    formula: evidence.census.formula,
    expectedCaseCount: 128,
    executedCaseCount: 128,
    unexecutedCaseCount: 0,
    uniqueExecutedCaseCount: 128,
    normal100Count: 64,
    owningRootText200Count: 64,
  }, "browser metrics census");
  assertDeepEqual(metrics.authority, {
    desktopViewport: { width: 1440, height: 1000 },
    mobileViewport: { width: 390, height: 844 },
    rootSelector: "[data-share-root]",
    rootAttribute: "data-share-text-scale",
    requiredRootMutationCount: 1,
    requiredDescendantStyleMutationCount: 0,
    requiredDirectLeafInlineMutationCount: 0,
  }, "browser metrics authority");
  assert.equal(Array.isArray(metrics.rows), true);
  assert.equal(metrics.rows.length, 128);
  metrics.rows.forEach(validateBrowserMetricRow);

  const actualCaseIds = metrics.rows.map((row) => row.caseId);
  const expectedCaseIds = ENVIRONMENTS.flatMap((environment) => (
    FIXTURES.flatMap((fixture) => SCALE_MODES.map((scaleMode) => `${environment.id}:${fixture}:${scaleMode}`))
  ));
  assertDeepEqual([...actualCaseIds].sort(), expectedCaseIds.sort(), "browser case census");
  assert.equal(new Set(actualCaseIds).size, 128);
  assert.equal(metrics.rows.filter((row) => row.viewport.width === 390 && row.viewport.height === 844).length, 64);
  assert.equal(metrics.rows.filter((row) => row.viewport.width === 391).length, 0);
  assert.equal(metrics.rows.reduce((total, row) => total + row.languageAuthorityChecks, 0), 192);
  assert.equal(metrics.rows.reduce((total, row) => total + row.reviewVariantChecks, 0), 80);
  assert.equal(metrics.rows.reduce((total, row) => total + row.staleVariantChecks, 0), 32);
}

function validateEvidenceFiles(evidence, metrics) {
  const metricsPath = path.join(REPO_ROOT, evidence.browserRun.metricsPath);
  const logPath = path.join(REPO_ROOT, evidence.browserRun.logPath);
  assert.equal(fs.existsSync(metricsPath), true, "browser metrics are missing");
  assert.equal(fs.existsSync(logPath), true, "browser log is missing");
  assert.equal(sha256(metricsPath), evidence.browserRun.metricsSha256, "browser metrics hash changed");
  assert.equal(sha256(logPath), evidence.browserRun.logSha256, "browser log hash changed");
  const log = fs.readFileSync(logPath, "utf8");
  assert.equal(/Tests\s+130 passed \(130\)/u.test(log), true, "browser log has no 130-pass completion marker");
  assert.equal(log.includes("Duration  1545.46s"), true, "browser log duration changed");
  validateBrowserMetrics(evidence, metrics);
}

function validateActiveProductSource(extraSource = "") {
  const source = ACTIVE_PRODUCT_FILES.map((filePath) => (
    fs.readFileSync(path.join(REPO_ROOT, filePath), "utf8")
  )).join("\n") + extraSource;
  const forbidden = [
    { id: "legacy_mobile_viewport", pattern: /391\s*[x×]\s*844/iu },
    { id: "leaf_font_size_mutation", pattern: /\.style\.fontSize\s*=/u },
    { id: "leaf_line_height_mutation", pattern: /\.style\.lineHeight\s*=/u },
    { id: "font_size_set_property", pattern: /\.style\.setProperty\(\s*["']font-size["']/u },
    { id: "line_height_set_property", pattern: /\.style\.setProperty\(\s*["']line-height["']/u },
  ];
  const matches = forbidden.filter((rule) => rule.pattern.test(source)).map((rule) => rule.id);
  assertDeepEqual(matches, [], "active product legacy recurrence");
}

function applyAttack(evidence, metrics, attack) {
  if (attack === "stale_amendment_sha") {
    evidence.amendment.commit = "0000000000000000000000000000000000000000";
  } else if (attack === "stale_amendment_blob") {
    evidence.amendment.files[0].gitBlob = "0000000000000000000000000000000000000000";
  } else if (attack === "unknown_evidence_key") {
    evidence.browserRun.syntheticPass = true;
  } else if (attack === "legacy_mobile_row") {
    const mobile = metrics.rows.find((row) => row.environmentId === "day-mobile");
    if (!mobile) throw new Error("attack fixture has no mobile row");
    mobile.viewport.width = 391;
  } else if (attack === "per_node_metric_reintroduced") {
    const scaled = metrics.rows.find((row) => row.scaleModeId === "owning_root_text_200");
    if (!scaled || !scaled.rootScale) throw new Error("attack fixture has no scaled row");
    scaled.rootScale.descendantStyleMutationCount = 48;
  } else if (attack === "stale_product_remote_sha") {
    evidence.productCommit.remoteShaAtProductPush = "0000000000000000000000000000000000000000";
  } else if (attack === "changed_file_census_tampered") {
    evidence.productCommit.changedFileCensusSha256 = "0".repeat(64);
  } else if (attack === "verification_log_hash_tampered") {
    evidence.verificationChecks[0].logSha256 = "0".repeat(64);
  } else if (attack === "restoration_mismatch_reintroduced") {
    evidence.generatedArtifactRestoration.mismatchCount = 1;
  }
}

function parseArguments(arguments_) {
  if (arguments_.length === 0) return { attack: null };
  if (arguments_.length !== 2 || arguments_[0] !== "--attack" || !ATTACK_MODES.includes(arguments_[1])) {
    throw new Error(`unsupported arguments: ${arguments_.join(" ")}`);
  }
  return { attack: arguments_[1] };
}

function main() {
  const { attack } = parseArguments(process.argv.slice(2));
  try {
    const evidence = JSON.parse(fs.readFileSync(EVIDENCE_PATH, "utf8"));
    const metrics = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, evidence.browserRun.metricsPath), "utf8"));
    applyAttack(evidence, metrics, attack);
    validateEvidenceManifest(evidence);
    validateAmendmentBinding(
      evidence,
      attack === "missing_erratum" ? path.join(EVIDENCE_DIR, "missing-contract-amendment.json") : AMENDMENT_PATH,
    );
    const currentRemoteSha = validateProductBinding(evidence, attack === null);
    validateEvidenceFiles(evidence, metrics);
    validateVerificationChecks(evidence);
    validateGeneratedArtifactRestoration(evidence);
    validateActiveProductSource(
      attack === "legacy_active_source_reintroduced"
        ? "\nlegacy selected viewport 391x844; node.style.fontSize = '32px';"
        : "",
    );
    if (attack !== null) throw new Error(`attack unexpectedly passed: ${attack}`);

    process.stdout.write(`${JSON.stringify({
      status: "product-evidence-valid",
      amendmentCommit: evidence.amendment.commit,
      productCommit: evidence.productCommit.commit,
      productRemoteShaAtProductPush: evidence.productCommit.remoteShaAtProductPush,
      currentRemoteSha,
      executedCaseCount: metrics.census.executedCaseCount,
      unexecutedCaseCount: metrics.census.unexecutedCaseCount,
      restoredArtifactCount: evidence.generatedArtifactRestoration.fileCount,
    })}\n`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (attack !== null) {
      process.stderr.write(`[product-evidence-rejected:${attack}] ${message}\n`);
    } else {
      process.stderr.write(`[product-evidence-invalid] ${message}\n`);
    }
    process.exitCode = 1;
  }
}

main();
