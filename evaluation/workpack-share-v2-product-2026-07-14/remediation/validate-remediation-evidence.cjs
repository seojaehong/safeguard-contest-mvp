const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const REPO_ROOT = path.resolve(__dirname, "../../..");
const EVIDENCE_PATH = path.join(__dirname, "contract-evidence.json");
const PRODUCT = "fc2bd1783fcc413981306f689d67bb6c659a985e";
const PRODUCT_PARENT = "bec9dd71f2a249bc184abea477e911afd10845ca";
const PRODUCT_TREE = "7ce7fee2d80967f02d32b80e110067f581e1c07b";
const REMEDIATION_PARENT = "0befdc1799b419d7b379cbbbf10d7e2320cd7d46";
const EXACT_BASE = "f45bba17bcce0d8ebb2690f82d014dbe42ae8191";
const REJECTED_PRODUCT = "bec9dd71f2a249bc184abea477e911afd10845ca";
const REJECTED_TREE = "7bf80b0c99f43c1e71adff00274d035a0bc61fcd";
const CURRENT_INTEGRATION = "67d2c9e28e7278c58f46b46c2512c7133d88d1d3";
const PREVIOUS_INTEGRATION = "ea7aa7223a056c884d5b0ba55563d602af328451";
const ONTOLOGY = "ff093fae30c331816f0068f9075b91b151d05813";
const ONTOLOGY_BASE = "f98ae7d16746dfe9fedbeea892e5af7ebb56f9a5";
const BROWSER_BLOB = "840dbcea9708e7670297b4dddc46a7f3398eb42f";
const REMOTE_REF = "refs/heads/feat/workpack-share-v2-product";
const attackModes = new Set([
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
  "red_reclassified"
]);

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function sha256(filePath) {
  return crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex");
}

function run(command, args, options = {}) {
  return spawnSync(command, args, {
    cwd: REPO_ROOT,
    encoding: "utf8",
    ...options
  });
}

function git(args, expectedStatus = 0) {
  const result = run("git", args);
  assert.equal(result.status, expectedStatus, `git ${args.join(" ")} failed: ${result.stderr}`);
  return result.stdout.trim();
}

function assertKeys(value, keys, label) {
  assert.equal(typeof value, "object", `${label} must be an object`);
  assert.notEqual(value, null, `${label} must not be null`);
  assert.deepEqual(Object.keys(value).sort(), [...keys].sort(), `${label} has a missing or unknown key`);
}

function validateClosedSchema(evidence) {
  assertKeys(evidence, [
    "schemaVersion", "evidenceId", "status", "amendment", "sourceIdentity", "productCensus",
    "redRun", "isolationIncident", "verification", "browser", "serverAuthority", "integration",
    "generatedArtifacts", "reviewBoundary", "artifacts"
  ], "evidence");
  assertKeys(evidence.amendment, ["amendmentId", "commit", "parentCommit", "validatorPath"], "amendment");
  assertKeys(evidence.sourceIdentity, [
    "exactBase", "remediationParent", "rejectedProductCommit", "rejectedProductTree", "productCommit",
    "productParent", "productTree", "browserTestBlob", "remoteRef", "remoteShaAtProductPush"
  ], "sourceIdentity");
  assertKeys(evidence.productCensus, [
    "path", "sha256", "wholeSeriesCommitCount", "wholeSeriesChangedFileCount", "wholeSeriesAddedFileCount",
    "wholeSeriesModifiedFileCount", "remediationChangedFileCount", "remediationAddedFileCount",
    "remediationModifiedFileCount", "browserFixChangedFileCount"
  ], "productCensus");
  assertKeys(evidence.redRun, [
    "logPath", "logSha256", "metricsPath", "metricsSha256", "classificationPath", "classificationSha256",
    "exitCode", "runnerTestsPassed", "runnerTestsFailed", "runnerTestCount", "matrixRowsExecuted",
    "matrixRowsUnexecuted", "durationSeconds", "productCauseCount", "browserExpectationCauseCount"
  ], "redRun");
  assertKeys(evidence.isolationIncident, [
    "path", "sha256", "contaminatedRunCount", "contaminatedRunsCountedAsPass",
    "currentShareTestProcessCount", "processLogPath", "processLogSha256"
  ], "isolationIncident");
  assertKeys(evidence.verification, ["unit", "typecheck", "staticAudit", "build", "browser"], "verification");
  assertKeys(evidence.verification.unit, [
    "command", "logPath", "logSha256", "exitCode", "testFilesPassed", "testsPassed", "testsSkipped", "durationSeconds"
  ], "verification.unit");
  assertKeys(evidence.verification.typecheck, ["command", "logPath", "logSha256", "exitCode"], "verification.typecheck");
  assertKeys(evidence.verification.staticAudit, [
    "command", "logPath", "logSha256", "exitCode", "violationCount", "coverageIssueCount", "importantDeclarationCount"
  ], "verification.staticAudit");
  assertKeys(evidence.verification.build, [
    "command", "logPath", "logSha256", "exitCode", "nextVersion", "staticPagesGenerated"
  ], "verification.build");
  assertKeys(evidence.verification.browser, [
    "command", "logPath", "logSha256", "exitCode", "runnerTestsPassed", "durationSeconds"
  ], "verification.browser");
  assertKeys(evidence.browser, [
    "metricsPath", "metricsSha256", "matrixRowsExpected", "matrixRowsExecuted", "matrixRowsUnexecuted",
    "uniqueMatrixRows", "mobile390x844Rows", "legacy391Rows", "owningRootText200Rows",
    "rootAttributeMutationMaximum", "descendantInlineMutationTotal", "directLeafInlineMutationTotal",
    "pseudoFailureCount", "maximumHorizontalOverflowCssPx", "maximumPanelOverflowCssPx",
    "touchTargetFailureCount", "overlapFailureCount", "nestedScrollFailureCount", "clippedTextFailureCount",
    "languageAuthorityCheckCount", "reviewVariantCheckCount", "staleBindingVariantCheckCount"
  ], "browser");
  assertKeys(evidence.serverAuthority, [
    "channelResolverRequestField", "actualRouteClientContractTested", "browserMockDelegatesTypedContract",
    "acceptedAndPartialRequireConfiguredProvider", "unconfiguredProviderState", "unconfiguredProviderCalled",
    "providerReceiptStrictlyParsed", "durableIdempotencyStore", "durableIdempotencyCasColumn",
    "workflowRouteOwnsDispatchLogPersistence", "clientAuthoredDispatchLogsRejected", "noDatabaseMigration",
    "externalCapabilityBlocker"
  ], "serverAuthority");
  assertKeys(evidence.integration, [
    "currentIntegrationHead", "previousIntegrationHead", "currentMergeTreeExitCode", "currentMergeTreeResultTree",
    "currentMainPathOverlapCount", "koshaDeltaPathCount", "koshaPathOverlapCount", "wholeSeriesGitCherryPlusCount",
    "ontologyCandidate", "ontologyMergeBase", "ontologyPathOverlapCount", "ontologyContentConflictCount",
    "preservesRevision", "preservesUpdatedAt", "preservesEvidenceSummary", "preservesConfirmationCas",
    "preservesDispatchCas", "directIntegrationReadinessClaimed", "semanticConflictReviewRequired",
    "adoptionPath", "adoptionSha256", "conflictContractPath", "conflictContractSha256"
  ], "integration");
  assertKeys(evidence.generatedArtifacts, [
    "restorationPath", "restorationSha256", "trackedPngFileCount", "mismatchCount", "includedInProductCommitCount"
  ], "generatedArtifacts");
  assertKeys(evidence.reviewBoundary, [
    "freshIndependentReviewRequired", "freshIndependentReviewStatus", "selfApproved", "integratedIntoMain", "completionClaim"
  ], "reviewBoundary");
  assert.equal(Array.isArray(evidence.artifacts), true, "artifacts must be an array");
  for (const [index, artifact] of evidence.artifacts.entries()) {
    assertKeys(artifact, ["path", "sha256"], `artifacts[${index}]`);
  }
}

function validateManifest(evidence) {
  validateClosedSchema(evidence);
  assert.equal(evidence.schemaVersion, "safeclaw-workpack-share-v2-remediation-evidence/v1");
  assert.equal(evidence.evidenceId, "workpack-share-v2-remediation-2026-07-14");
  assert.equal(evidence.status, "IMPLEMENTATION_EVIDENCE_COMPLETE_REVIEW_PENDING");
  assert.equal(evidence.amendment.commit, "e2f16da5efd09e393a459b5efd0a9e51d9f6a558");
  assert.equal(evidence.sourceIdentity.exactBase, EXACT_BASE);
  assert.equal(evidence.sourceIdentity.remediationParent, REMEDIATION_PARENT);
  assert.equal(evidence.sourceIdentity.rejectedProductCommit, REJECTED_PRODUCT);
  assert.equal(evidence.sourceIdentity.rejectedProductTree, REJECTED_TREE);
  assert.equal(evidence.sourceIdentity.productCommit, PRODUCT);
  assert.equal(evidence.sourceIdentity.productParent, PRODUCT_PARENT);
  assert.equal(evidence.sourceIdentity.productTree, PRODUCT_TREE);
  assert.equal(evidence.sourceIdentity.browserTestBlob, BROWSER_BLOB);
  assert.equal(evidence.sourceIdentity.remoteRef, REMOTE_REF);
  assert.equal(evidence.sourceIdentity.remoteShaAtProductPush, PRODUCT);
  assert.deepEqual({
    wholeSeriesCommitCount: evidence.productCensus.wholeSeriesCommitCount,
    wholeSeriesChangedFileCount: evidence.productCensus.wholeSeriesChangedFileCount,
    wholeSeriesAddedFileCount: evidence.productCensus.wholeSeriesAddedFileCount,
    wholeSeriesModifiedFileCount: evidence.productCensus.wholeSeriesModifiedFileCount,
    remediationChangedFileCount: evidence.productCensus.remediationChangedFileCount,
    remediationAddedFileCount: evidence.productCensus.remediationAddedFileCount,
    remediationModifiedFileCount: evidence.productCensus.remediationModifiedFileCount,
    browserFixChangedFileCount: evidence.productCensus.browserFixChangedFileCount
  }, {
    wholeSeriesCommitCount: 7,
    wholeSeriesChangedFileCount: 78,
    wholeSeriesAddedFileCount: 53,
    wholeSeriesModifiedFileCount: 25,
    remediationChangedFileCount: 24,
    remediationAddedFileCount: 6,
    remediationModifiedFileCount: 18,
    browserFixChangedFileCount: 2
  });
  assert.deepEqual({
    exitCode: evidence.redRun.exitCode,
    passed: evidence.redRun.runnerTestsPassed,
    failed: evidence.redRun.runnerTestsFailed,
    total: evidence.redRun.runnerTestCount,
    executed: evidence.redRun.matrixRowsExecuted,
    unexecuted: evidence.redRun.matrixRowsUnexecuted,
    productCauses: evidence.redRun.productCauseCount,
    expectationCauses: evidence.redRun.browserExpectationCauseCount
  }, { exitCode: 1, passed: 113, failed: 17, total: 130, executed: 111, unexecuted: 17, productCauses: 8, expectationCauses: 9 });
  assert.equal(evidence.isolationIncident.contaminatedRunCount, 2);
  assert.equal(evidence.isolationIncident.contaminatedRunsCountedAsPass, 0);
  assert.equal(evidence.isolationIncident.currentShareTestProcessCount, 0);
  assert.equal(evidence.browser.matrixRowsExpected, 128);
  assert.equal(evidence.browser.matrixRowsExecuted, 128);
  assert.equal(evidence.browser.matrixRowsUnexecuted, 0);
  assert.equal(evidence.browser.uniqueMatrixRows, 128);
  assert.equal(evidence.browser.mobile390x844Rows, 64);
  assert.equal(evidence.browser.legacy391Rows, 0);
  assert.equal(evidence.browser.owningRootText200Rows, 64);
  assert.equal(evidence.browser.rootAttributeMutationMaximum, 1);
  assert.equal(evidence.browser.descendantInlineMutationTotal, 0);
  assert.equal(evidence.browser.directLeafInlineMutationTotal, 0);
  for (const field of [
    "pseudoFailureCount", "maximumHorizontalOverflowCssPx", "maximumPanelOverflowCssPx", "touchTargetFailureCount",
    "overlapFailureCount", "nestedScrollFailureCount", "clippedTextFailureCount"
  ]) assert.equal(evidence.browser[field], 0, `${field} must remain zero`);
  assert.equal(evidence.serverAuthority.channelResolverRequestField, "requestedChannels");
  assert.equal(evidence.serverAuthority.actualRouteClientContractTested, true);
  assert.equal(evidence.serverAuthority.browserMockDelegatesTypedContract, true);
  assert.equal(evidence.serverAuthority.acceptedAndPartialRequireConfiguredProvider, true);
  assert.equal(evidence.serverAuthority.unconfiguredProviderState, "blocked");
  assert.equal(evidence.serverAuthority.unconfiguredProviderCalled, false);
  assert.equal(evidence.serverAuthority.providerReceiptStrictlyParsed, true);
  assert.equal(evidence.serverAuthority.workflowRouteOwnsDispatchLogPersistence, true);
  assert.equal(evidence.serverAuthority.clientAuthoredDispatchLogsRejected, true);
  assert.equal(evidence.serverAuthority.noDatabaseMigration, true);
  assert.equal(evidence.integration.currentIntegrationHead, CURRENT_INTEGRATION);
  assert.equal(evidence.integration.previousIntegrationHead, PREVIOUS_INTEGRATION);
  assert.equal(evidence.integration.currentMergeTreeExitCode, 0);
  assert.equal(evidence.integration.currentMergeTreeResultTree, "d370929311230df359aad787905fefbc6b018b34");
  assert.equal(evidence.integration.currentMainPathOverlapCount, 0);
  assert.equal(evidence.integration.koshaDeltaPathCount, 26);
  assert.equal(evidence.integration.koshaPathOverlapCount, 0);
  assert.equal(evidence.integration.wholeSeriesGitCherryPlusCount, 7);
  assert.equal(evidence.integration.ontologyCandidate, ONTOLOGY);
  assert.equal(evidence.integration.ontologyMergeBase, ONTOLOGY_BASE);
  assert.equal(evidence.integration.ontologyPathOverlapCount, 5);
  assert.equal(evidence.integration.ontologyContentConflictCount, 3);
  for (const field of ["preservesRevision", "preservesUpdatedAt", "preservesEvidenceSummary", "preservesConfirmationCas", "preservesDispatchCas"]) {
    assert.equal(evidence.integration[field], true, `${field} must be preserved`);
  }
  assert.equal(evidence.integration.directIntegrationReadinessClaimed, false);
  assert.equal(evidence.integration.semanticConflictReviewRequired, true);
  assert.deepEqual(evidence.generatedArtifacts, {
    restorationPath: "evaluation/workpack-share-v2-product-2026-07-14/remediation/generated-artifact-restoration.json",
    restorationSha256: "ba5286d2d9bfd0d411dd38a35df8792348227a32c2f47e429dd5835e5ae423ce",
    trackedPngFileCount: 16,
    mismatchCount: 0,
    includedInProductCommitCount: 0
  });
  assert.deepEqual(evidence.reviewBoundary, {
    freshIndependentReviewRequired: true,
    freshIndependentReviewStatus: "pending",
    selfApproved: false,
    integratedIntoMain: false,
    completionClaim: "implementation_evidence_complete_review_pending"
  });
}

function validateArtifactHashes(evidence) {
  const paths = new Set();
  for (const artifact of evidence.artifacts) {
    assert.equal(paths.has(artifact.path), false, `duplicate artifact ${artifact.path}`);
    paths.add(artifact.path);
    const fullPath = path.join(REPO_ROOT, artifact.path);
    assert.equal(fs.existsSync(fullPath), true, `missing artifact ${artifact.path}`);
    assert.equal(sha256(fullPath), artifact.sha256, `artifact hash mismatch ${artifact.path}`);
  }
  for (const item of [
    [evidence.productCensus.path, evidence.productCensus.sha256],
    [evidence.redRun.logPath, evidence.redRun.logSha256],
    [evidence.redRun.metricsPath, evidence.redRun.metricsSha256],
    [evidence.redRun.classificationPath, evidence.redRun.classificationSha256],
    [evidence.isolationIncident.path, evidence.isolationIncident.sha256],
    [evidence.isolationIncident.processLogPath, evidence.isolationIncident.processLogSha256],
    [evidence.browser.metricsPath, evidence.browser.metricsSha256],
    [evidence.integration.adoptionPath, evidence.integration.adoptionSha256],
    [evidence.integration.conflictContractPath, evidence.integration.conflictContractSha256]
  ]) {
    assert.equal(paths.has(item[0]), true, `${item[0]} missing from artifacts`);
    assert.equal(sha256(path.join(REPO_ROOT, item[0])), item[1]);
  }
}

function validateGitBinding(evidence) {
  assert.equal(git(["rev-parse", `${PRODUCT}^{commit}`]), PRODUCT);
  assert.equal(git(["rev-parse", `${PRODUCT}^{tree}`]), PRODUCT_TREE);
  assert.equal(git(["rev-parse", `${PRODUCT}^`]), PRODUCT_PARENT);
  assert.equal(git(["rev-parse", `${REJECTED_PRODUCT}^{tree}`]), REJECTED_TREE);
  assert.equal(git(["rev-parse", `${PRODUCT}:tests/workpack-share-v2-browser.test.ts`]), BROWSER_BLOB);
  assert.equal(git(["merge-base", PRODUCT, CURRENT_INTEGRATION]), EXACT_BASE);
  assert.equal(git(["merge-base", PRODUCT, ONTOLOGY]), ONTOLOGY_BASE);
  assert.equal(git(["rev-parse", "origin/feat/phase-a-evidence-integration"]), CURRENT_INTEGRATION);
  assert.equal(git(["rev-parse", "origin/fix/phase-a-ontology-target-ready"]), ONTOLOGY);

  const remoteRows = git(["ls-remote", "--heads", "origin", REMOTE_REF]).split(/\r?\n/u).filter(Boolean);
  assert.equal(remoteRows.length, 1, "Share remote ref missing or ambiguous");
  const remoteSha = remoteRows[0].split(/\s+/u)[0];
  assert.equal(git(["merge-base", "--is-ancestor", PRODUCT, remoteSha]), "");

  const series = git(["rev-list", "--reverse", "--ancestry-path", `${EXACT_BASE}..${PRODUCT}`]).split(/\r?\n/u).filter(Boolean);
  assert.equal(series.length, 7);
  const cherry = git(["cherry", "-v", CURRENT_INTEGRATION, PRODUCT, EXACT_BASE]).split(/\r?\n/u).filter(Boolean);
  assert.equal(cherry.length, 7);
  assert.equal(cherry.every((line) => line.startsWith("+ ")), true, "current integration unexpectedly adopted a Share patch");

  const mainMerge = run("git", ["merge-tree", "--write-tree", PRODUCT, CURRENT_INTEGRATION]);
  assert.equal(mainMerge.status, 0, mainMerge.stderr);
  assert.equal(mainMerge.stdout.trim(), "d370929311230df359aad787905fefbc6b018b34");
  const ontologyMerge = run("git", ["merge-tree", "--write-tree", PRODUCT, ONTOLOGY]);
  assert.equal(ontologyMerge.status, 1, "ontology merge-tree must remain review-blocked");
  for (const conflictPath of [
    "components/FieldOperationsWorkspace.tsx",
    "lib/workpack-commercial-store.ts",
    "tests/workpack-share-authority-routes.test.ts"
  ]) assert.equal(ontologyMerge.stdout.includes(`CONFLICT (content): Merge conflict in ${conflictPath}`), true, conflictPath);

  const sharePaths = new Set(git(["diff", "--name-only", `${EXACT_BASE}..${PRODUCT}`]).split(/\r?\n/u).filter(Boolean));
  const mainPaths = git(["diff", "--name-only", `${EXACT_BASE}..${CURRENT_INTEGRATION}`]).split(/\r?\n/u).filter(Boolean);
  assert.equal(mainPaths.filter((file) => sharePaths.has(file)).length, 0);
  const koshaPaths = git(["diff", "--name-only", `${PREVIOUS_INTEGRATION}..${CURRENT_INTEGRATION}`]).split(/\r?\n/u).filter(Boolean);
  assert.equal(koshaPaths.length, 26);
  assert.equal(koshaPaths.filter((file) => sharePaths.has(file)).length, 0);
  const remediationStoreDiff = run("git", ["diff", "--quiet", `${REMEDIATION_PARENT}..${PRODUCT}`, "--", "lib/workpack-commercial-store.ts"]);
  assert.equal(remediationStoreDiff.status, 0, "remediation branch altered ontology-owned commercial store");

  const amendmentValidator = run(process.execPath, [path.join(REPO_ROOT, evidence.amendment.validatorPath)]);
  assert.equal(amendmentValidator.status, 0, amendmentValidator.stderr);
  assert.equal(amendmentValidator.stdout.includes("contract-amendment-valid"), true);
}

function validateProductCensus(evidence) {
  const census = readJson(path.join(REPO_ROOT, evidence.productCensus.path));
  assert.equal(census.schemaVersion, "safeclaw-workpack-share-v2-remediation-changed-file-census/v1");
  assert.equal(census.productCommit, PRODUCT);
  assert.equal(census.productTree, PRODUCT_TREE);
  assert.equal(census.exactBase, EXACT_BASE);
  assert.equal(census.remediationParent, REMEDIATION_PARENT);
  assert.equal(census.wholeSeries.changedFileCount, 78);
  assert.equal(census.wholeSeries.addedFileCount, 53);
  assert.equal(census.wholeSeries.modifiedFileCount, 25);
  assert.equal(census.wholeSeries.deletedFileCount, 0);
  assert.equal(census.wholeSeries.files.length, 78);
  assert.equal(census.remediation.changedFileCount, 24);
  assert.equal(census.remediation.files.length, 24);
  assert.equal(census.browserFixCommit.changedFileCount, 2);
  assert.deepEqual(census.browserFixCommit.files.map((item) => item.path).sort(), [
    "components/WorkflowSharePanel.tsx",
    "tests/workpack-share-v2-browser.test.ts"
  ]);
  for (const section of [census.wholeSeries, census.remediation, census.authorityCommit, census.browserFixCommit]) {
    assert.equal(new Set(section.files.map((item) => item.path)).size, section.files.length);
    for (const item of section.files) {
      assert.equal(item.status === "A" || item.status === "M", true);
      assert.equal(git(["rev-parse", `${PRODUCT}:${item.path}`]), item.gitBlob, item.path);
    }
  }
  assert.equal(census.remediation.files.some((item) => item.path === "lib/workpack-commercial-store.ts"), false);
}

function validateRedAndIsolation(evidence) {
  const redLog = fs.readFileSync(path.join(REPO_ROOT, evidence.redRun.logPath), "utf8");
  assert.equal(redLog.includes("Tests  17 failed | 113 passed (130)"), true);
  assert.equal(redLog.includes("Duration  1260.09s"), true);
  assert.equal(redLog.includes("[explicit-exit-code] 1"), true);
  const redMetrics = readJson(path.join(REPO_ROOT, evidence.redRun.metricsPath));
  assert.equal(redMetrics.sourceIdentity.productCommit, REJECTED_PRODUCT);
  assert.equal(redMetrics.sourceIdentity.productTree, REJECTED_TREE);
  assert.equal(redMetrics.status, "partial");
  assert.equal(redMetrics.census.executedCaseCount, 111);
  assert.equal(redMetrics.census.unexecutedCaseCount, 17);
  const classification = readJson(path.join(REPO_ROOT, evidence.redRun.classificationPath));
  assert.equal(classification.rows.length, 17);
  assert.equal(new Set(classification.rows.map((row) => row.caseId)).size, 17);
  const groups = Object.fromEntries(classification.groups.map((group) => [group.category, group.count]));
  assert.deepEqual(groups, {
    async_persistence_settlement_contract: 1,
    navigation_settlement_contract: 8,
    product_state_transition: 8
  });
  assert.equal(classification.rows.filter((row) => row.responsibility === "product").length, 8);
  assert.equal(classification.rows.filter((row) => row.responsibility === "browser_test_expectation").length, 9);

  const incident = readJson(path.join(REPO_ROOT, evidence.isolationIncident.path));
  assert.equal(incident.status, "resolved_contaminated_results_invalid");
  assert.equal(incident.observedConcurrentRuns.length, 2);
  assert.equal(incident.observedConcurrentRuns.every((item) => item.validEvidence === false), true);
  assert.equal(incident.evidencePolicy.contaminatedRunsCountedAsPass, 0);
  assert.equal(incident.cleanup.shareTestProcessesAfterCleanup, 0);
  assert.equal(incident.cleanup.shareTempNextProcessesAfterCleanup, 0);
  const processLog = fs.readFileSync(path.join(REPO_ROOT, evidence.isolationIncident.processLogPath), "utf8");
  assert.equal(processLog.includes("share_test_process_count=0"), true);
  assert.equal(processLog.includes("share_vitest_process_count=0"), true);
  assert.equal(processLog.includes("share_next_process_count=0"), true);
  assert.equal(processLog.includes("explicit_exit_code=0"), true);
}

function validateVerification(evidence) {
  for (const check of Object.values(evidence.verification)) {
    const log = fs.readFileSync(path.join(REPO_ROOT, check.logPath), "utf8");
    assert.equal(check.exitCode, 0);
    assert.equal(log.includes(`[product-sha] ${PRODUCT}`), true, check.logPath);
    assert.equal(log.includes(`[product-tree] ${PRODUCT_TREE}`), true, check.logPath);
    assert.equal(log.includes("[explicit-exit-code] 0"), true, check.logPath);
  }
  const unit = fs.readFileSync(path.join(REPO_ROOT, evidence.verification.unit.logPath), "utf8");
  assert.equal(unit.includes("Test Files  22 passed (22)"), true);
  assert.equal(unit.includes("Tests  230 passed | 128 skipped (358)"), true);
  const staticAudit = fs.readFileSync(path.join(REPO_ROOT, evidence.verification.staticAudit.logPath), "utf8");
  assert.equal(staticAudit.includes('"violationCount": 0'), true);
  assert.equal(staticAudit.includes('"coverageIssues": 0'), true);
  const build = fs.readFileSync(path.join(REPO_ROOT, evidence.verification.build.logPath), "utf8");
  assert.equal(build.includes("Next.js 15.5.20"), true);
  assert.equal(build.includes("Generating static pages (27/27)"), true);
  const browser = fs.readFileSync(path.join(REPO_ROOT, evidence.verification.browser.logPath), "utf8");
  assert.equal(browser.includes("Tests  130 passed (130)"), true);
  assert.equal(browser.includes("Duration  1290.02s"), true);
}

function validateBrowserMetrics(evidence) {
  const metrics = readJson(path.join(REPO_ROOT, evidence.browser.metricsPath));
  assert.equal(metrics.schemaVersion, "safeclaw-workpack-share-v2-browser-metrics/v1");
  assert.equal(metrics.contractAmendmentCommit, evidence.amendment.commit);
  assert.deepEqual(metrics.sourceIdentity, {
    productCommit: PRODUCT,
    productTree: PRODUCT_TREE,
    browserTestBlob: BROWSER_BLOB
  });
  assert.equal(metrics.status, "complete");
  assert.deepEqual(metrics.census, {
    formula: "4 environments * 16 fixtures * 2 scale modes",
    expectedCaseCount: 128,
    executedCaseCount: 128,
    unexecutedCaseCount: 0,
    uniqueExecutedCaseCount: 128,
    normal100Count: 64,
    owningRootText200Count: 64
  });
  assert.deepEqual(metrics.authority.mobileViewport, { width: 390, height: 844 });
  assert.equal(metrics.authority.rootSelector, "[data-share-root]");
  assert.equal(metrics.authority.rootAttribute, "data-share-text-scale");
  assert.equal(metrics.authority.requiredRootMutationCount, 1);
  assert.equal(metrics.authority.requiredDescendantStyleMutationCount, 0);
  assert.equal(metrics.authority.requiredDirectLeafInlineMutationCount, 0);
  assert.equal(metrics.rows.length, 128);
  assert.equal(new Set(metrics.rows.map((row) => row.caseId)).size, 128);

  let mobile390 = 0;
  let root200 = 0;
  let languageChecks = 0;
  let reviewChecks = 0;
  let staleChecks = 0;
  for (const row of metrics.rows) {
    assert.equal(row.productCommit, PRODUCT);
    assert.equal(row.productTree, PRODUCT_TREE);
    assert.equal(row.viewport.width === 391, false, row.caseId);
    if (row.environmentId.endsWith("-mobile")) {
      assert.deepEqual(row.viewport, { width: 390, height: 844 }, row.caseId);
      mobile390 += 1;
    }
    if (row.scaleModeId === "owning_root_text_200") {
      root200 += 1;
      assert.equal(row.freshDomRuns, 2, row.caseId);
      assert.equal(row.rootScale.rootAttributeMutationCount, 1, row.caseId);
      assert.equal(row.rootScale.descendantStyleMutationCount, 0, row.caseId);
      assert.equal(row.rootScale.directLeafInlineMutationCount, 0, row.caseId);
      assert.equal(row.rootScale.pseudoElementInspectionCount > 0, true, row.caseId);
      assert.equal(row.rootScale.pseudoFailureCount, 0, row.caseId);
      assert.equal(row.rootScale.mediaQueryStable, true, row.caseId);
      assert.equal(row.rootScale.containerQueryStable, true, row.caseId);
    } else {
      assert.equal(row.scaleModeId, "normal_100", row.caseId);
      assert.equal(row.freshDomRuns, 1, row.caseId);
      assert.equal(row.rootScale, null, row.caseId);
    }
    for (const field of [
      "maximumHorizontalOverflow", "maximumPanelOverflow", "touchTargetFailureCount", "overlapFailureCount",
      "nestedScrollFailureCount", "clippedTextFailureCount"
    ]) assert.equal(row.geometry[field], 0, `${row.caseId}:${field}`);
    languageChecks += row.languageAuthorityChecks;
    reviewChecks += row.reviewVariantChecks;
    staleChecks += row.staleVariantChecks;
  }
  assert.equal(mobile390, 64);
  assert.equal(root200, 64);
  assert.equal(languageChecks, 192);
  assert.equal(reviewChecks, 80);
  assert.equal(staleChecks, 32);

  const css = git(["show", `${PRODUCT}:components/WorkflowSharePanel.module.css`]);
  assert.equal(/max-height|overflow-y/iu.test(css), false, "Share preview reintroduced nested scrolling");
  const browserSource = git(["show", `${PRODUCT}:tests/workpack-share-v2-browser.test.ts`]);
  assert.equal(/skipNested|excludeNested|nestedScrollAllowlist/iu.test(browserSource), false);
}

function validateServerAuthoritySource() {
  const route = git(["show", `${PRODUCT}:app/api/workflow/dispatch/route.ts`]);
  for (const token of [
    "provider_adapter_unavailable", "providerCalled: false", "compareAndSwapDispatchGate", "dispatch_evidence_unpersisted",
    "server-dispatch-receipt/v1", ".from(\"dispatch_logs\").insert", ".eq(\"updated_at\", row.updatedAt)"
  ]) assert.equal(route.includes(token), true, `dispatch route missing ${token}`);
  const provider = git(["show", `${PRODUCT}:lib/workflow-dispatch-provider.ts`]);
  assert.equal(provider.includes('providerStatus: "live"'), true);
  assert.equal(provider.includes("strict JSON response required"), true);
  const client = git(["show", `${PRODUCT}:lib/workflow-share-client.ts`]);
  assert.equal(client.includes("requestedChannels: request.requestedChannels"), true);
  assert.equal(client.includes("전파 응답의 서버 receipt binding이 올바르지 않습니다."), true);
  const dispatchLogs = git(["show", `${PRODUCT}:app/api/dispatch-logs/route.ts`]);
  assert.equal(dispatchLogs.includes('reasonCode: "server_dispatch_receipt_required"'), true);
  assert.equal(dispatchLogs.includes("전파 이력은 workflow dispatch 라우트가 검증된 서버 receipt와 함께 저장합니다."), true);
}

function validateGeneratedArtifactRestoration(evidence) {
  const restoration = readJson(path.join(REPO_ROOT, evidence.generatedArtifacts.restorationPath));
  assert.equal(restoration.productCommit, PRODUCT);
  assert.equal(restoration.productParent, PRODUCT_PARENT);
  assert.equal(restoration.fileCount, 16);
  assert.equal(restoration.mismatchCount, 0);
  assert.equal(restoration.parentHeadWorktreeHashesEqual, true);
  for (const item of restoration.files) {
    assert.equal(item.allEqual, true, item.path);
    assert.equal(git(["rev-parse", `${PRODUCT_PARENT}:${item.path}`]), item.parentBlob);
    assert.equal(git(["rev-parse", `${PRODUCT}:${item.path}`]), item.headBlob);
    assert.equal(git(["hash-object", "--", item.path]), item.worktreeBlob);
  }
}

function applyAttack(evidence, attack) {
  if (attack === null) return;
  if (attack === "missing_amendment") delete evidence.amendment;
  if (attack === "stale_product_sha") evidence.sourceIdentity.productCommit = REJECTED_PRODUCT;
  if (attack === "stale_product_tree") evidence.sourceIdentity.productTree = REJECTED_TREE;
  if (attack === "precommit_source") evidence.sourceIdentity.productCommit = "precommit_worktree";
  if (attack === "unknown_key") evidence.browser.unknownMetric = 0;
  if (attack === "legacy_391") evidence.browser.legacy391Rows = 1;
  if (attack === "per_node_mutation") evidence.browser.descendantInlineMutationTotal = 1;
  if (attack === "contaminated_pass") evidence.isolationIncident.contaminatedRunsCountedAsPass = 1;
  if (attack === "stale_current_main") evidence.integration.currentIntegrationHead = PREVIOUS_INTEGRATION;
  if (attack === "kosha_overlap") evidence.integration.koshaPathOverlapCount = 1;
  if (attack === "ontology_cas_omission") evidence.integration.preservesConfirmationCas = false;
  if (attack === "log_hash_tamper") evidence.artifacts[0].sha256 = "0".repeat(64);
  if (attack === "missing_incident") delete evidence.isolationIncident;
  if (attack === "stale_browser_blob") evidence.sourceIdentity.browserTestBlob = "94e5698054226fda901dd991572438ca72044397";
  if (attack === "red_reclassified") evidence.redRun.productCauseCount = 0;
}

function main() {
  const arguments_ = process.argv.slice(2);
  const attackIndex = arguments_.indexOf("--attack");
  const attack = attackIndex >= 0 ? arguments_[attackIndex + 1] : null;
  if (attack !== null && !attackModes.has(attack)) {
    process.stderr.write(`[remediation-evidence-invalid-attack] ${attack}\n`);
    process.exit(2);
  }
  const evidence = readJson(EVIDENCE_PATH);
  applyAttack(evidence, attack);
  try {
    validateManifest(evidence);
    validateArtifactHashes(evidence);
    validateGitBinding(evidence);
    validateProductCensus(evidence);
    validateRedAndIsolation(evidence);
    validateVerification(evidence);
    validateBrowserMetrics(evidence);
    validateServerAuthoritySource();
    validateGeneratedArtifactRestoration(evidence);
    process.stdout.write(`${JSON.stringify({
      status: "remediation-evidence-valid",
      productCommit: PRODUCT,
      productTree: PRODUCT_TREE,
      currentIntegrationHead: CURRENT_INTEGRATION,
      browserRunnerTests: 130,
      browserRowsExecuted: 128,
      browserRowsUnexecuted: 0,
      koshaPathOverlapCount: 0,
      independentReview: "pending"
    })}\n`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (attack !== null) {
      process.stderr.write(`[remediation-evidence-rejected:${attack}] ${message}\n`);
    } else {
      const detail = error instanceof Error && error.stack ? error.stack : message;
      process.stderr.write(`[remediation-evidence-invalid] ${detail}\n`);
    }
    process.exit(1);
  }
}

main();
