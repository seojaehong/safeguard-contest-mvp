const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const REPO_ROOT = path.resolve(__dirname, "../../..");
const EVIDENCE_PATH = path.join(__dirname, "p1-evidence.json");
const BINDING_ARGUMENT = "--binding-manifest";
const attackModes = new Set([
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
  "share_workspace_state_omission"
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
  assert.equal(Array.isArray(value), false, `${label} must not be an array`);
  assert.deepEqual(Object.keys(value).sort(), [...keys].sort(), `${label} has a missing or unknown key`);
}

function assertSha(value, label) {
  assert.equal(typeof value, "string", `${label} must be a string`);
  assert.match(value, /^[0-9a-f]{40}$/u, `${label} must be an exact SHA`);
}

function assertSha256(value, label) {
  assert.equal(typeof value, "string", `${label} must be a string`);
  assert.match(value, /^[0-9a-f]{64}$/u, `${label} must be a SHA-256 digest`);
}

function lines(value) {
  return value.split(/\r?\n/u).filter(Boolean);
}

function pathOverlap(left, right) {
  const rightSet = new Set(right);
  return left.filter((item) => rightSet.has(item)).sort();
}

function validateBindingSchema(binding) {
  assertKeys(binding, [
    "schemaVersion", "manifestId", "product", "integration", "ontology", "historicalEvidence"
  ], "binding");
  assertKeys(binding.product, [
    "commitRef", "commit", "parent", "tree", "requestScopeCommit", "requestScopeParent",
    "requestScopeTree", "browserTestBlob", "harnessHelperBlob", "harnessTestBlob", "remoteBranchRef"
  ], "binding.product");
  assertKeys(binding.integration, [
    "authorityRef", "commit", "tree", "mergeBase", "trackingRef"
  ], "binding.integration");
  assertKeys(binding.ontology, [
    "productAuthorityRef", "productCommit", "productTree", "mergeBase", "evidenceAuthorityRef",
    "evidenceCommit", "evidenceTree", "evidenceParent", "evidenceTrackingRef"
  ], "binding.ontology");
  assertKeys(binding.historicalEvidence, ["commit", "path", "blob"], "binding.historicalEvidence");
  assert.equal(binding.schemaVersion, "safeclaw-workpack-share-v2-source-binding/v2");
  assert.equal(binding.manifestId, "workpack-share-v2-p1-remediation-2026-07-14");
  for (const [label, value] of [
    ["product.commit", binding.product.commit],
    ["product.parent", binding.product.parent],
    ["product.tree", binding.product.tree],
    ["product.requestScopeCommit", binding.product.requestScopeCommit],
    ["product.requestScopeParent", binding.product.requestScopeParent],
    ["product.requestScopeTree", binding.product.requestScopeTree],
    ["product.browserTestBlob", binding.product.browserTestBlob],
    ["product.harnessHelperBlob", binding.product.harnessHelperBlob],
    ["product.harnessTestBlob", binding.product.harnessTestBlob],
    ["integration.commit", binding.integration.commit],
    ["integration.tree", binding.integration.tree],
    ["integration.mergeBase", binding.integration.mergeBase],
    ["ontology.productCommit", binding.ontology.productCommit],
    ["ontology.productTree", binding.ontology.productTree],
    ["ontology.mergeBase", binding.ontology.mergeBase],
    ["ontology.evidenceCommit", binding.ontology.evidenceCommit],
    ["ontology.evidenceTree", binding.ontology.evidenceTree],
    ["ontology.evidenceParent", binding.ontology.evidenceParent],
    ["historicalEvidence.commit", binding.historicalEvidence.commit],
    ["historicalEvidence.blob", binding.historicalEvidence.blob]
  ]) assertSha(value, label);
  assert.equal(binding.product.commitRef, `${binding.product.commit}^{commit}`);
  assert.equal(binding.product.parent, binding.product.requestScopeCommit);
  assert.equal(binding.integration.authorityRef, `${binding.integration.commit}^{commit}`);
  assert.equal(binding.ontology.productAuthorityRef, `${binding.ontology.productCommit}^{commit}`);
  assert.equal(binding.ontology.evidenceAuthorityRef, `${binding.ontology.evidenceCommit}^{commit}`);
  assert.equal(binding.ontology.evidenceParent, binding.ontology.productCommit);
  assert.equal(binding.product.remoteBranchRef, "refs/heads/feat/workpack-share-v2-product");
  assert.equal(binding.integration.trackingRef, "refs/remotes/origin/feat/phase-a-evidence-integration");
  assert.equal(binding.ontology.evidenceTrackingRef, "refs/remotes/origin/fix/phase-a-ontology-target-ready");
}

function validateEvidenceSchema(evidence) {
  assertKeys(evidence, [
    "schemaVersion", "evidenceId", "status", "sourceBinding", "sourceIdentity", "authorities",
    "historicalEvidence", "tdd", "verification", "browser", "productCensus", "integration",
    "generatedArtifacts", "scopeAudit", "reviewBoundary", "artifacts"
  ], "evidence");
  assertKeys(evidence.sourceBinding, ["path", "sha256"], "sourceBinding");
  assertKeys(evidence.sourceIdentity, [
    "productCommit", "productParent", "productTree", "requestScopeCommit", "requestScopeParent",
    "browserTestBlob", "harnessHelperBlob", "harnessTestBlob", "remoteBranchRef"
  ], "sourceIdentity");
  assertKeys(evidence.authorities, ["main", "ontology"], "authorities");
  assertKeys(evidence.authorities.main, [
    "commit", "tree", "mergeBase", "mergeTreeExitCode", "mergeTreeResultTree", "pathOverlapCount"
  ], "authorities.main");
  assertKeys(evidence.authorities.ontology, [
    "productCommit", "productTree", "evidenceCommit", "evidenceTree", "evidenceParent", "mergeBase",
    "mergeTreeExitCode", "mergeTreeResultTree", "pathOverlapCount", "contentConflictCount"
  ], "authorities.ontology");
  assertKeys(evidence.historicalEvidence, ["commit", "path", "blob"], "historicalEvidence");
  assertKeys(evidence.tdd, [
    "requestScopeRed", "harnessRed", "excludedRuns", "harnessGreen", "finalGreen"
  ], "tdd");
  assertKeys(evidence.tdd.requestScopeRed, [
    "logPath", "logSha256", "baselineCommit", "baselineTree", "sourceState", "exitCode",
    "runnerTestsFailed", "runnerTestsSkipped", "expectedDispatchRequestCount", "actualDispatchRequestCount"
  ], "tdd.requestScopeRed");
  assertKeys(evidence.tdd.harnessRed, [
    "logPath", "logSha256", "baselineProductCommit", "baselineProductTree", "sourceState", "exitCode",
    "testFilesFailed", "testsFailed", "failureMessage"
  ], "tdd.harnessRed");
  assertKeys(evidence.tdd.excludedRuns, [
    "count", "countedAsPass", "paths", "hangIncidentPath", "hangIncidentSha256",
    "hangDisposition", "hangEvidenceExitCode"
  ], "tdd.excludedRuns");
  assertKeys(evidence.tdd.harnessGreen, [
    "logPath", "logSha256", "exitCode", "singleScenarioRuns"
  ], "tdd.harnessGreen");
  assertKeys(evidence.tdd.finalGreen, [
    "browserLogPath", "browserLogSha256", "metricsPath", "metricsSha256", "scopeRaceChecks"
  ], "tdd.finalGreen");
  assert.equal(Array.isArray(evidence.tdd.excludedRuns.paths), true);
  assert.equal(Array.isArray(evidence.tdd.harnessGreen.singleScenarioRuns), true);
  for (const [index, item] of evidence.tdd.harnessGreen.singleScenarioRuns.entries()) {
    assertKeys(item, [
      "logPath", "logSha256", "wallClockTimeoutSeconds", "exitCode", "shareTestProcessesAfter"
    ], `tdd.harnessGreen.singleScenarioRuns[${index}]`);
  }
  assertKeys(evidence.verification, ["unit", "typecheck", "staticAudit", "build", "browser"], "verification");
  assertKeys(evidence.verification.unit, [
    "command", "logPath", "logSha256", "exitCode", "testFilesPassed", "testsPassed", "testsSkipped",
    "durationSeconds", "shareTestProcessesAfter"
  ], "verification.unit");
  assertKeys(evidence.verification.typecheck, ["command", "logPath", "logSha256", "exitCode"], "verification.typecheck");
  assertKeys(evidence.verification.staticAudit, [
    "command", "logPath", "logSha256", "exitCode", "violationCount", "coverageIssueCount", "importantDeclarationCount"
  ], "verification.staticAudit");
  assertKeys(evidence.verification.build, [
    "command", "logPath", "logSha256", "exitCode", "nextVersion", "staticPagesGenerated"
  ], "verification.build");
  assertKeys(evidence.verification.browser, [
    "command", "logPath", "logSha256", "exitCode", "runnerTestsPassed", "durationSeconds",
    "wallClockSeconds", "wallClockTimeoutSeconds", "timeoutTriggered", "shareTestProcessesAfter"
  ], "verification.browser");
  assertKeys(evidence.browser, [
    "matrixRowsExpected", "matrixRowsExecuted", "matrixRowsUnexecuted", "uniqueMatrixRows",
    "mobile390x844Rows", "legacy391Rows", "owningRootText200Rows", "scopeRaceCheckCount",
    "rootAttributeMutationMaximum", "descendantInlineMutationTotal", "directLeafInlineMutationTotal",
    "pseudoFailureCount", "maximumHorizontalOverflowCssPx", "maximumPanelOverflowCssPx",
    "touchTargetFailureCount", "overlapFailureCount", "nestedScrollFailureCount", "clippedTextFailureCount"
  ], "browser");
  assertKeys(evidence.productCensus, [
    "path", "sha256", "requestScopeChangedFileCount", "harnessChangedFileCount", "combinedChangedFileCount"
  ], "productCensus");
  assertKeys(evidence.integration, [
    "adoptionPath", "adoptionSha256", "mergeTreeLogPath", "mergeTreeLogSha256", "cherryLogPath",
    "cherryLogSha256", "pathOverlapLogPath", "pathOverlapLogSha256", "seriesPath", "seriesSha256",
    "seriesGitCherryPlusCount", "currentMainPathOverlapCount", "koshaPathOverlapCount", "ontologyContractPath",
    "ontologyContractSha256", "ontologyPathOverlapCount", "ontologyContentConflictCount", "preservesRevision",
    "preservesUpdatedAt", "preservesEvidenceSummary", "preservesDistinctRevisionDomains",
    "preservesRawEvidenceSummaryOverlay", "revalidatesStaleLocalizationEnvelopes",
    "invalidatesAuthorityOnLocalizationReview", "preservesShareWorkspaceState", "preservesConfirmationCas",
    "preservesDispatchCas", "preservesRequestScopeGuard", "preservesHarnessTeardown",
    "directIntegrationReadinessClaimed", "semanticConflictReviewRequired"
  ], "integration");
  assertKeys(evidence.generatedArtifacts, [
    "path", "sha256", "scopeExcludedFileCount", "trackedStaticAuditFileCount", "trackedPngFileCount",
    "historicalMetricFileCount", "mismatchCount", "includedInProductCommitCount"
  ], "generatedArtifacts");
  assertKeys(evidence.scopeAudit, [
    "path", "sha256", "strictAnyHitCount", "forbiddenPathCount", "ontologyOrKoshaFileCount",
    "dbSchemaMigrationFileCount"
  ], "scopeAudit");
  assertKeys(evidence.reviewBoundary, [
    "freshShareIndependentReviewRequired", "freshShareIndependentReviewStatus",
    "freshOntologyIndependentReviewRequired", "freshOntologyIndependentReviewStatus", "selfApproved",
    "integratedIntoMain", "hold", "completionClaim"
  ], "reviewBoundary");
  assert.equal(Array.isArray(evidence.artifacts), true);
  for (const [index, artifact] of evidence.artifacts.entries()) {
    assertKeys(artifact, ["path", "sha256"], `artifacts[${index}]`);
  }
  assert.equal(evidence.schemaVersion, "safeclaw-workpack-share-v2-p1-evidence/v2");
  assert.equal(evidence.evidenceId, "workpack-share-v2-p1-remediation-2026-07-14");
  assert.equal(evidence.status, "HOLD_FRESH_INDEPENDENT_REVIEWS");
}

function validateBindingEvidence(binding, evidence, bindingPath, bindingHash) {
  assert.equal(evidence.sourceBinding.path, path.relative(REPO_ROOT, bindingPath).replace(/\\/gu, "/"));
  assert.equal(evidence.sourceBinding.sha256, bindingHash);
  assert.deepEqual(evidence.sourceIdentity, {
    productCommit: binding.product.commit,
    productParent: binding.product.parent,
    productTree: binding.product.tree,
    requestScopeCommit: binding.product.requestScopeCommit,
    requestScopeParent: binding.product.requestScopeParent,
    browserTestBlob: binding.product.browserTestBlob,
    harnessHelperBlob: binding.product.harnessHelperBlob,
    harnessTestBlob: binding.product.harnessTestBlob,
    remoteBranchRef: binding.product.remoteBranchRef
  });
  assert.deepEqual(evidence.authorities, {
    main: {
      commit: binding.integration.commit,
      tree: binding.integration.tree,
      mergeBase: binding.integration.mergeBase,
      mergeTreeExitCode: 0,
      mergeTreeResultTree: evidence.authorities.main.mergeTreeResultTree,
      pathOverlapCount: 0
    },
    ontology: {
      productCommit: binding.ontology.productCommit,
      productTree: binding.ontology.productTree,
      evidenceCommit: binding.ontology.evidenceCommit,
      evidenceTree: binding.ontology.evidenceTree,
      evidenceParent: binding.ontology.evidenceParent,
      mergeBase: binding.ontology.mergeBase,
      mergeTreeExitCode: 1,
      mergeTreeResultTree: evidence.authorities.ontology.mergeTreeResultTree,
      pathOverlapCount: 8,
      contentConflictCount: 7
    }
  });
  assert.deepEqual(evidence.historicalEvidence, binding.historicalEvidence);
}

function validateArtifactHashes(evidence) {
  const artifactPaths = new Set();
  for (const artifact of evidence.artifacts) {
    assert.equal(artifactPaths.has(artifact.path), false, `duplicate artifact ${artifact.path}`);
    artifactPaths.add(artifact.path);
    const fullPath = path.join(REPO_ROOT, artifact.path);
    assert.equal(fs.existsSync(fullPath), true, `missing artifact ${artifact.path}`);
    assert.equal(sha256(fullPath), artifact.sha256, `artifact hash mismatch ${artifact.path}`);
  }
  for (const [artifactPath, digest] of [
    [evidence.sourceBinding.path, evidence.sourceBinding.sha256],
    [evidence.tdd.requestScopeRed.logPath, evidence.tdd.requestScopeRed.logSha256],
    [evidence.tdd.harnessRed.logPath, evidence.tdd.harnessRed.logSha256],
    [evidence.tdd.excludedRuns.hangIncidentPath, evidence.tdd.excludedRuns.hangIncidentSha256],
    [evidence.tdd.harnessGreen.logPath, evidence.tdd.harnessGreen.logSha256],
    [evidence.tdd.finalGreen.browserLogPath, evidence.tdd.finalGreen.browserLogSha256],
    [evidence.tdd.finalGreen.metricsPath, evidence.tdd.finalGreen.metricsSha256],
    [evidence.productCensus.path, evidence.productCensus.sha256],
    [evidence.integration.adoptionPath, evidence.integration.adoptionSha256],
    [evidence.integration.mergeTreeLogPath, evidence.integration.mergeTreeLogSha256],
    [evidence.integration.cherryLogPath, evidence.integration.cherryLogSha256],
    [evidence.integration.pathOverlapLogPath, evidence.integration.pathOverlapLogSha256],
    [evidence.integration.seriesPath, evidence.integration.seriesSha256],
    [evidence.integration.ontologyContractPath, evidence.integration.ontologyContractSha256],
    [evidence.generatedArtifacts.path, evidence.generatedArtifacts.sha256],
    [evidence.scopeAudit.path, evidence.scopeAudit.sha256]
  ]) {
    assert.equal(artifactPaths.has(artifactPath), true, `${artifactPath} missing from artifacts`);
    assert.equal(sha256(path.join(REPO_ROOT, artifactPath)), digest, `${artifactPath} reference hash mismatch`);
  }
  for (const run of evidence.tdd.harnessGreen.singleScenarioRuns) {
    assert.equal(artifactPaths.has(run.logPath), true, `${run.logPath} missing from artifacts`);
    assert.equal(sha256(path.join(REPO_ROOT, run.logPath)), run.logSha256);
  }
}

function validateGitBinding(binding, evidence) {
  const product = binding.product.commit;
  const main = binding.integration.commit;
  const ontology = binding.ontology.productCommit;
  assert.equal(git(["rev-parse", binding.product.commitRef]), product);
  assert.equal(git(["rev-parse", `${product}^{tree}`]), binding.product.tree);
  assert.equal(git(["rev-parse", `${product}^`]), binding.product.parent);
  assert.equal(git(["rev-parse", `${binding.product.requestScopeCommit}^{tree}`]), binding.product.requestScopeTree);
  assert.equal(git(["rev-parse", `${binding.product.requestScopeCommit}^`]), binding.product.requestScopeParent);
  assert.equal(git(["rev-parse", `${product}:tests/workpack-share-v2-browser.test.ts`]), binding.product.browserTestBlob);
  assert.equal(git(["rev-parse", `${product}:tests/helpers/isolated-next-browser-harness.ts`]), binding.product.harnessHelperBlob);
  assert.equal(git(["rev-parse", `${product}:tests/workpack-share-v2-browser-harness.test.ts`]), binding.product.harnessTestBlob);
  assert.equal(git(["rev-parse", binding.integration.authorityRef]), main);
  assert.equal(git(["rev-parse", `${main}^{tree}`]), binding.integration.tree);
  assert.equal(git(["rev-parse", binding.integration.trackingRef]), main, "authoritative main tracking ref moved");
  assert.equal(git(["merge-base", main, product]), binding.integration.mergeBase);
  assert.equal(git(["rev-parse", binding.ontology.productAuthorityRef]), ontology);
  assert.equal(git(["rev-parse", `${ontology}^{tree}`]), binding.ontology.productTree);
  assert.equal(git(["rev-parse", binding.ontology.evidenceAuthorityRef]), binding.ontology.evidenceCommit);
  assert.equal(git(["rev-parse", `${binding.ontology.evidenceCommit}^{tree}`]), binding.ontology.evidenceTree);
  assert.equal(git(["rev-parse", `${binding.ontology.evidenceCommit}^`]), binding.ontology.evidenceParent);
  assert.equal(git(["rev-parse", binding.ontology.evidenceTrackingRef]), binding.ontology.evidenceCommit, "ontology evidence tracking ref moved");
  assert.equal(git(["merge-base", ontology, product]), binding.ontology.mergeBase);
  assert.equal(git(["rev-parse", `${binding.historicalEvidence.commit}:${binding.historicalEvidence.path}`]), binding.historicalEvidence.blob);

  const remoteRows = lines(git(["ls-remote", "--heads", "origin", binding.product.remoteBranchRef]));
  assert.equal(remoteRows.length, 1, "Share remote ref missing or ambiguous");
  const remoteSha = remoteRows[0].split(/\s+/u)[0];
  assert.equal(git(["merge-base", "--is-ancestor", product, remoteSha]), "");

  const adoption = readJson(path.join(REPO_ROOT, evidence.integration.adoptionPath));
  assert.equal(adoption.schemaVersion, "safeclaw-workpack-share-v2-p1-integration-adoption/v2");
  assert.equal(adoption.product.commit, product);
  assert.equal(adoption.product.tree, binding.product.tree);
  assert.equal(adoption.authoritativeMain.authorityRef, binding.integration.authorityRef);
  assert.equal(adoption.authoritativeMain.commit, main);
  assert.equal(adoption.authoritativeMain.tree, binding.integration.tree);
  assert.equal(adoption.ontology.productCommit, ontology);
  assert.equal(adoption.ontology.evidenceCommit, binding.ontology.evidenceCommit);
  assert.equal(adoption.status, "HOLD_FRESH_REVIEWS_AND_SEMANTIC_CONFLICT_RESOLUTION");

  const series = lines(git(["rev-list", "--reverse", "--ancestry-path", `${binding.integration.mergeBase}..${product}`]));
  assert.equal(series.length, 10);
  assert.deepEqual(adoption.series.map((item) => item.commit), series);
  const cherry = lines(git(["cherry", "-v", main, product, binding.integration.mergeBase]));
  assert.equal(cherry.length, series.length);
  assert.equal(cherry.every((line) => line.startsWith("+ ")), true, "authoritative main unexpectedly adopted a Share patch");
  assert.equal(evidence.integration.seriesGitCherryPlusCount, cherry.length);

  const mainMerge = run("git", ["merge-tree", "--write-tree", main, product]);
  assert.equal(mainMerge.status, 0, mainMerge.stderr);
  assert.equal(mainMerge.stdout.trim(), adoption.authoritativeMain.mergeTreeResultTree);
  assert.equal(mainMerge.stdout.trim(), evidence.authorities.main.mergeTreeResultTree);
  const shareMainPaths = lines(git(["diff", "--name-only", `${binding.integration.mergeBase}..${product}`]));
  const mainPaths = lines(git(["diff", "--name-only", `${binding.integration.mergeBase}..${main}`]));
  const mainOverlap = pathOverlap(shareMainPaths, mainPaths);
  assert.deepEqual(mainOverlap, []);
  assert.equal(evidence.integration.currentMainPathOverlapCount, 0);
  assert.equal(evidence.integration.koshaPathOverlapCount, 0);

  const ontologyMerge = run("git", ["merge-tree", "--write-tree", ontology, product]);
  assert.equal(ontologyMerge.status, 1, "ontology merge-tree must remain review-blocked");
  const ontologyOutput = lines(ontologyMerge.stdout);
  assert.equal(ontologyOutput[0], evidence.authorities.ontology.mergeTreeResultTree);
  const actualConflictFiles = ontologyOutput
    .filter((line) => line.startsWith("CONFLICT (content): Merge conflict in "))
    .map((line) => line.replace("CONFLICT (content): Merge conflict in ", ""));
  const expectedConflictFiles = [
    "app/api/workpacks/[id]/route.ts",
    "components/FieldOperationsWorkspace.tsx",
    "components/SafeGuardCommandCenter.tsx",
    "lib/workpack-commercial-store.ts",
    "tests/helpers/isolated-next-browser-harness.ts",
    "tests/workpack-generation-evidence-route.test.ts",
    "tests/workpack-share-authority-routes.test.ts"
  ];
  assert.deepEqual(actualConflictFiles, expectedConflictFiles);
  const shareOntologyPaths = lines(git(["diff", "--name-only", `${binding.ontology.mergeBase}..${product}`]));
  const ontologyPaths = lines(git(["diff", "--name-only", `${binding.ontology.mergeBase}..${ontology}`]));
  const ontologyOverlap = pathOverlap(shareOntologyPaths, ontologyPaths);
  assert.deepEqual(ontologyOverlap, [
    "app/api/workpacks/[id]/route.ts",
    "components/CurrentWorkpackModules.tsx",
    "components/FieldOperationsWorkspace.tsx",
    "components/SafeGuardCommandCenter.tsx",
    "lib/workpack-commercial-store.ts",
    "tests/helpers/isolated-next-browser-harness.ts",
    "tests/workpack-generation-evidence-route.test.ts",
    "tests/workpack-share-authority-routes.test.ts"
  ]);
  assert.equal(evidence.integration.ontologyPathOverlapCount, ontologyOverlap.length);
  assert.equal(evidence.integration.ontologyContentConflictCount, actualConflictFiles.length);

  const conflict = readJson(path.join(REPO_ROOT, evidence.integration.ontologyContractPath));
  assertKeys(conflict, [
    "schemaVersion", "shareProduct", "authoritativeMain", "ontology", "requestScopeReconciliation",
    "finalMergeTree", "overlap", "requiredResolution", "prohibitedResolution", "integrationStatus"
  ], "ontologyConflictContract");
  assert.equal(conflict.schemaVersion, "safeclaw-workpack-share-v2-p1-ontology-conflict-contract/v3");
  assert.equal(conflict.shareProduct.commit, product);
  assert.equal(conflict.authoritativeMain.commit, main);
  assert.equal(conflict.authoritativeMain.mergeTreeResultTree, mainMerge.stdout.trim());
  assert.equal(conflict.ontology.productCommit, ontology);
  assert.equal(conflict.ontology.evidenceCommit, binding.ontology.evidenceCommit);
  assert.equal(conflict.finalMergeTree.resultTree, ontologyOutput[0]);
  assert.deepEqual(conflict.finalMergeTree.contentConflictFiles, expectedConflictFiles);
  assert.equal(conflict.overlap.pathCount, 8);
  assertKeys(conflict.requiredResolution, [
    "shareAuthorityFields", "ontologyWorkpackOperationContextFields", "revisionDomains",
    "ontologyServerAuthority", "evidenceSummaryOverlay", "localizationEnvelopeHandling",
    "localizationReviewInvalidation", "confirmationCas", "shareRequestScope", "dispatchCas",
    "shareWorkspaceState", "harnessTeardown", "testResolution"
  ], "ontologyConflictContract.requiredResolution");
  assert.deepEqual(conflict.requiredResolution.shareAuthorityFields, ["canonicalWorkpackRevision"]);
  assert.deepEqual(
    conflict.requiredResolution.ontologyWorkpackOperationContextFields,
    ["revision", "updatedAt", "evidenceSummary"]
  );
  assert.match(conflict.requiredResolution.revisionDomains, /SHA-256 content hash/u);
  assert.match(conflict.requiredResolution.revisionDomains, /RFC3339 workpacks\.updated_at CAS value/u);
  assert.match(conflict.requiredResolution.revisionDomains, /Neither domain may substitute/u);
  assert.match(conflict.requiredResolution.evidenceSummaryOverlay, /full raw evidence_summary object/u);
  assert.match(conflict.requiredResolution.evidenceSummaryOverlay, /reviewedLocalizationEnvelopes, dispatch, localization/u);
  assert.match(conflict.requiredResolution.localizationEnvelopeHandling, /stale reviewedLocalizationEnvelopes are revalidated/u);
  assert.match(conflict.requiredResolution.localizationReviewInvalidation, /invalidates Phase A authority and the Share request scope/u);
  assert.match(conflict.requiredResolution.localizationReviewInvalidation, /reread the authenticated row/u);
  for (const token of [
    "initialWorkpackId", "initialWorkpackAuthority", "requiresRevalidation", "theme/workspaceTheme",
    "validated Share URL state", "request-scope identity/version guards"
  ]) assert.equal(conflict.requiredResolution.shareWorkspaceState.includes(token), true, `missing ${token}`);
  assert.equal(conflict.integrationStatus, "HOLD_FRESH_REVIEWS_AND_SEMANTIC_CONFLICT_RESOLUTION");
  for (const field of [
    "preservesRevision", "preservesUpdatedAt", "preservesEvidenceSummary", "preservesDistinctRevisionDomains",
    "preservesRawEvidenceSummaryOverlay", "revalidatesStaleLocalizationEnvelopes",
    "invalidatesAuthorityOnLocalizationReview", "preservesShareWorkspaceState", "preservesConfirmationCas",
    "preservesDispatchCas", "preservesRequestScopeGuard", "preservesHarnessTeardown"
  ]) assert.equal(evidence.integration[field], true, `${field} must be preserved`);
  assert.equal(evidence.integration.directIntegrationReadinessClaimed, false);
  assert.equal(evidence.integration.semanticConflictReviewRequired, true);
  assert.equal(run("git", [
    "diff", "--quiet", `${binding.product.requestScopeParent}..${product}`, "--", "lib/workpack-commercial-store.ts"
  ]).status, 0, "P1 remediation changed ontology-owned commercial store");
}

function validateProductCensus(binding, evidence) {
  const census = readJson(path.join(REPO_ROOT, evidence.productCensus.path));
  assert.equal(census.schemaVersion, "safeclaw-workpack-share-v2-p1-product-census/v2");
  assert.deepEqual(census.finalProduct, {
    commit: binding.product.commit,
    parent: binding.product.parent,
    tree: binding.product.tree
  });
  assert.equal(census.commits.length, 2);
  assert.equal(census.commits[0].commit, binding.product.requestScopeCommit);
  assert.equal(census.commits[0].parent, binding.product.requestScopeParent);
  assert.equal(census.commits[0].changedFileCount, 5);
  assert.equal(census.commits[1].commit, binding.product.commit);
  assert.equal(census.commits[1].parent, binding.product.parent);
  assert.equal(census.commits[1].changedFileCount, 2);
  for (const candidate of census.commits) {
    const actualPaths = lines(git(["diff", "--name-only", `${candidate.parent}..${candidate.commit}`]));
    assert.equal(actualPaths.length, candidate.changedFileCount);
    assert.deepEqual(candidate.files.map((item) => item.path), actualPaths);
    for (const item of candidate.files) {
      assert.equal(git(["rev-parse", `${candidate.commit}:${item.path}`]), item.gitBlob, item.path);
    }
  }
  const combinedPaths = lines(git(["diff", "--name-only", `${census.combined.fromExclusive}..${census.combined.toInclusive}`]));
  assert.equal(census.combined.toInclusive, binding.product.commit);
  assert.equal(census.combined.changedFileCount, 7);
  assert.deepEqual(census.combined.files, combinedPaths);
  assert.equal(census.forbiddenPathCount, 0);
  assert.equal(census.strictAnyHitCount, 0);
  assert.equal(census.status, "pass");
  assert.equal(evidence.productCensus.requestScopeChangedFileCount, 5);
  assert.equal(evidence.productCensus.harnessChangedFileCount, 2);
  assert.equal(evidence.productCensus.combinedChangedFileCount, 7);
}

function validateTdd(evidence) {
  const requestRed = fs.readFileSync(path.join(REPO_ROOT, evidence.tdd.requestScopeRed.logPath), "utf8");
  assert.equal(evidence.tdd.requestScopeRed.sourceState, "precommit_test_worktree");
  assert.equal(evidence.tdd.requestScopeRed.exitCode, 1);
  assert.equal(evidence.tdd.requestScopeRed.expectedDispatchRequestCount, 0);
  assert.equal(evidence.tdd.requestScopeRed.actualDispatchRequestCount, 1);
  assert.equal(requestRed.includes("Tests  1 failed | 129 skipped (130)"), true);
  assert.equal(requestRed.includes("AssertionError: expected 1 to be +0"), true);
  assert.equal(requestRed.includes("[explicit-exit] 1"), true);

  const harnessRed = fs.readFileSync(path.join(REPO_ROOT, evidence.tdd.harnessRed.logPath), "utf8");
  assert.equal(evidence.tdd.harnessRed.sourceState, "precommit-harness-test-worktree");
  assert.equal(evidence.tdd.harnessRed.exitCode, 1);
  assert.equal(harnessRed.includes("promise resolved \"undefined\" instead of rejecting"), true);
  assert.equal(harnessRed.includes("Tests  1 failed (1)"), true);
  assert.equal(harnessRed.includes("[explicit-exit-code] 1"), true);

  assert.equal(evidence.tdd.excludedRuns.countedAsPass, 0);
  assert.equal(evidence.tdd.excludedRuns.count, evidence.tdd.excludedRuns.paths.length);
  const hang = fs.readFileSync(path.join(REPO_ROOT, evidence.tdd.excludedRuns.hangIncidentPath), "utf8");
  assert.equal(evidence.tdd.excludedRuns.hangDisposition, "INVALID_TEARDOWN_HANG");
  assert.equal(evidence.tdd.excludedRuns.hangEvidenceExitCode, 124);
  assert.equal(hang.includes("[hang-audit-status] INVALID_TEARDOWN_HANG"), true);
  assert.equal(hang.includes("[hang-process-ids] pwsh=25592 vitest=29976 worker=39156 next_harness=24768"), true);
  assert.equal(hang.includes("[bounded-run-explicit-exit-code] 124"), true);

  const harnessGreen = fs.readFileSync(path.join(REPO_ROOT, evidence.tdd.harnessGreen.logPath), "utf8");
  assert.equal(evidence.tdd.harnessGreen.exitCode, 0);
  assert.equal(harnessGreen.includes("Tests  1 passed (1)"), true);
  assert.equal(harnessGreen.includes("[explicit-exit-code] 0"), true);
  for (const scenario of evidence.tdd.harnessGreen.singleScenarioRuns) {
    const log = fs.readFileSync(path.join(REPO_ROOT, scenario.logPath), "utf8");
    assert.equal(scenario.wallClockTimeoutSeconds, 180);
    assert.equal(scenario.exitCode, 0);
    assert.equal(scenario.shareTestProcessesAfter, 0);
    assert.equal(log.includes("Tests  1 passed | 129 skipped (130)"), true);
    assert.equal(log.includes("[share-test-processes-after] 0"), true);
    assert.equal(log.includes("[explicit-exit-code] 0"), true);
  }
  assert.equal(evidence.tdd.finalGreen.scopeRaceChecks, 4);
}

function validateVerification(binding, evidence) {
  for (const check of Object.values(evidence.verification)) {
    const log = fs.readFileSync(path.join(REPO_ROOT, check.logPath), "utf8");
    assert.equal(check.exitCode, 0);
    assert.equal(log.includes(`[product-sha] ${binding.product.commit}`), true, check.logPath);
    assert.equal(log.includes(`[product-tree] ${binding.product.tree}`), true, check.logPath);
    assert.equal(log.includes("[explicit-exit-code] 0"), true, check.logPath);
  }
  const unit = fs.readFileSync(path.join(REPO_ROOT, evidence.verification.unit.logPath), "utf8");
  assert.equal(unit.includes(`Test Files  ${evidence.verification.unit.testFilesPassed} passed (${evidence.verification.unit.testFilesPassed})`), true);
  assert.equal(unit.includes(`Tests  ${evidence.verification.unit.testsPassed} passed | ${evidence.verification.unit.testsSkipped} skipped`), true);
  assert.equal(unit.includes("[share-test-processes-after] 0"), true);
  const staticAudit = fs.readFileSync(path.join(REPO_ROOT, evidence.verification.staticAudit.logPath), "utf8");
  assert.equal(staticAudit.includes('"violationCount": 0'), true);
  assert.equal(staticAudit.includes('"coverageIssues": 0'), true);
  assert.equal(staticAudit.includes('"importantDeclarations": 0'), true);
  const build = fs.readFileSync(path.join(REPO_ROOT, evidence.verification.build.logPath), "utf8");
  assert.equal(build.includes(`Next.js ${evidence.verification.build.nextVersion}`), true);
  assert.equal(build.includes(`Generating static pages (${evidence.verification.build.staticPagesGenerated}/${evidence.verification.build.staticPagesGenerated})`), true);
  const browser = fs.readFileSync(path.join(REPO_ROOT, evidence.verification.browser.logPath), "utf8");
  assert.equal(browser.includes(`Tests  ${evidence.verification.browser.runnerTestsPassed} passed (${evidence.verification.browser.runnerTestsPassed})`), true);
  assert.equal(browser.includes("[timeout-triggered] false"), true);
  assert.equal(browser.includes("[vitest-process-exit-code] 0"), true);
  assert.equal(browser.includes("[share-test-processes-after] 0"), true);
  assert.equal(evidence.verification.browser.timeoutTriggered, false);
  assert.equal(evidence.verification.browser.shareTestProcessesAfter, 0);
}

function validateBrowserMetrics(binding, evidence) {
  const metrics = readJson(path.join(REPO_ROOT, evidence.tdd.finalGreen.metricsPath));
  assert.equal(metrics.schemaVersion, "safeclaw-workpack-share-v2-browser-metrics/v1");
  assert.deepEqual(metrics.sourceIdentity, {
    productCommit: binding.product.commit,
    productTree: binding.product.tree,
    browserTestBlob: binding.product.browserTestBlob
  });
  assert.equal(metrics.status, "complete");
  assert.equal(metrics.census.expectedCaseCount, 128);
  assert.equal(metrics.census.executedCaseCount, 128);
  assert.equal(metrics.census.unexecutedCaseCount, 0);
  assert.deepEqual(metrics.authority.mobileViewport, { width: 390, height: 844 });
  assert.equal(metrics.authority.requiredRootMutationCount, 1);
  assert.equal(metrics.authority.requiredDescendantStyleMutationCount, 0);
  assert.equal(metrics.authority.requiredDirectLeafInlineMutationCount, 0);
  assert.equal(metrics.rows.length, 128);
  assert.equal(new Set(metrics.rows.map((row) => row.caseId)).size, 128);
  let mobile390 = 0;
  let root200 = 0;
  let scopeRaceChecks = 0;
  for (const row of metrics.rows) {
    assert.equal(row.productCommit, binding.product.commit);
    assert.equal(row.productTree, binding.product.tree);
    assert.notEqual(row.viewport.width, 391, row.caseId);
    if (row.environmentId.endsWith("-mobile")) {
      assert.deepEqual(row.viewport, { width: 390, height: 844 }, row.caseId);
      mobile390 += 1;
    }
    if (row.scaleModeId === "owning_root_text_200") {
      root200 += 1;
      assert.equal(row.rootScale.rootAttributeMutationCount, 1, row.caseId);
      assert.equal(row.rootScale.descendantStyleMutationCount, 0, row.caseId);
      assert.equal(row.rootScale.directLeafInlineMutationCount, 0, row.caseId);
      assert.equal(row.rootScale.pseudoFailureCount, 0, row.caseId);
    } else {
      assert.equal(row.scaleModeId, "normal_100", row.caseId);
      assert.equal(row.rootScale, null, row.caseId);
    }
    for (const field of [
      "maximumHorizontalOverflow", "maximumPanelOverflow", "touchTargetFailureCount", "overlapFailureCount",
      "nestedScrollFailureCount", "clippedTextFailureCount"
    ]) assert.equal(row.geometry[field], 0, `${row.caseId}:${field}`);
    scopeRaceChecks += row.scopeRaceChecks;
  }
  assert.equal(mobile390, 64);
  assert.equal(root200, 64);
  assert.equal(scopeRaceChecks, 4);
  assert.equal(metrics.rows.find((row) => row.caseId === "day-desktop:sending:normal_100").scopeRaceChecks, 4);
  assert.equal(evidence.browser.mobile390x844Rows, 64);
  assert.equal(evidence.browser.legacy391Rows, 0);
  assert.equal(evidence.browser.owningRootText200Rows, 64);
  assert.equal(evidence.browser.scopeRaceCheckCount, 4);
  assert.equal(evidence.tdd.finalGreen.scopeRaceChecks, 4);
  assert.equal(evidence.browser.descendantInlineMutationTotal, 0);
  assert.equal(evidence.browser.directLeafInlineMutationTotal, 0);
  for (const field of [
    "pseudoFailureCount", "maximumHorizontalOverflowCssPx", "maximumPanelOverflowCssPx",
    "touchTargetFailureCount", "overlapFailureCount", "nestedScrollFailureCount", "clippedTextFailureCount"
  ]) assert.equal(evidence.browser[field], 0, `${field} must remain zero`);
}

function validateProductSource(binding) {
  const panel = git(["show", `${binding.product.commit}:components/WorkflowSharePanel.tsx`]);
  for (const token of [
    "buildWorkflowShareRequestScopeKey", "sendRequestLifecycleRef", "isCurrentRequest", "requestChannels",
    "if (!isCurrentRequest()) return", "if (isCurrentRequest()) setSending(false)"
  ]) assert.equal(panel.includes(token), true, `Share panel missing ${token}`);
  assert.equal(panel.includes("disabled={sending}"), false, "channel scope cannot change while dispatch is in flight");
  const route = git(["show", `${binding.product.commit}:app/api/workflow/dispatch/route.ts`]);
  for (const token of [
    "provider_adapter_unavailable", "providerCalled: false", "compareAndSwapDispatchGate",
    "server-dispatch-receipt/v1", ".from(\"dispatch_logs\").insert", ".eq(\"updated_at\", row.updatedAt)"
  ]) assert.equal(route.includes(token), true, `dispatch route missing ${token}`);
  const helper = git(["show", `${binding.product.commit}:tests/helpers/isolated-next-browser-harness.ts`]);
  for (const token of [
    "result.error || result.status !== 0", "Windows taskkill failed", "server.once(\"close\"",
    "Browser harness PID ${processId} close"
  ]) assert.equal(helper.includes(token), true, `browser harness missing ${token}`);
  const harnessTest = git(["show", `${binding.product.commit}:tests/workpack-share-v2-browser-harness.test.ts`]);
  assert.equal(harnessTest.includes("rejects teardown when Windows process-tree termination is not verified"), true);
}

function validateGeneratedAndScope(binding, evidence) {
  const restoration = readJson(path.join(REPO_ROOT, evidence.generatedArtifacts.path));
  assert.equal(restoration.schemaVersion, "safeclaw-workpack-share-v2-generated-restoration/v2");
  assert.equal(restoration.productCommit, binding.product.commit);
  assert.equal(restoration.productParent, binding.product.parent);
  assert.equal(restoration.scopeExcluded.classification, "scope-excluded generated changes");
  assert.equal(restoration.scopeExcluded.fileCount, 17);
  assert.equal(restoration.scopeExcluded.trackedStaticAuditFileCount, 1);
  assert.equal(restoration.scopeExcluded.trackedPngFileCount, 16);
  assert.equal(restoration.scopeExcluded.includedInProductCommitCount, 0);
  assert.equal(restoration.scopeExcluded.mismatchCount, 0);
  assert.equal(restoration.scopeExcluded.parentHeadWorktreeHashesEqual, true);
  assert.equal(restoration.historicalEvidenceRestoration.fileCount, 1);
  assert.equal(restoration.historicalEvidenceRestoration.mismatchCount, 0);
  for (const group of [restoration.scopeExcluded, restoration.historicalEvidenceRestoration]) {
    for (const item of group.files) {
      assert.equal(item.allEqual, true, item.path);
      assert.equal(git(["rev-parse", `${binding.product.parent}:${item.path}`]), item.parentBlob);
      assert.equal(git(["rev-parse", `${binding.product.commit}:${item.path}`]), item.headBlob);
      assert.equal(git(["hash-object", "--", item.path]), item.worktreeBlob);
    }
  }
  assert.equal(evidence.generatedArtifacts.scopeExcludedFileCount, 17);
  assert.equal(evidence.generatedArtifacts.trackedStaticAuditFileCount, 1);
  assert.equal(evidence.generatedArtifacts.trackedPngFileCount, 16);
  assert.equal(evidence.generatedArtifacts.historicalMetricFileCount, 1);
  assert.equal(evidence.generatedArtifacts.mismatchCount, 0);
  assert.equal(evidence.generatedArtifacts.includedInProductCommitCount, 0);

  const scope = readJson(path.join(REPO_ROOT, evidence.scopeAudit.path));
  assert.equal(scope.schemaVersion, "safeclaw-workpack-share-v2-p1-scope-audit/v2");
  assert.equal(scope.productCommit, binding.product.commit);
  assert.equal(scope.productParent, binding.product.parent);
  assert.equal(scope.strictAnyHitCount, 0);
  assert.equal(scope.forbiddenPathCount, 0);
  assert.equal(scope.ontologyOrKoshaFileCount, 0);
  assert.equal(scope.dbSchemaMigrationFileCount, 0);
  assert.equal(scope.scopeExcludedGeneratedFileCount, 17);
  assert.equal(scope.historicalMetricsRestoredCount, 1);
  assert.equal(scope.status, "pass");
}

function applyAttack(evidence, binding, attack) {
  if (attack === null || attack === "missing_binding_manifest") return;
  if (attack === "missing_amendment") delete evidence.historicalEvidence;
  if (attack === "stale_product_sha") evidence.sourceIdentity.productCommit = binding.product.parent;
  if (attack === "stale_product_tree") evidence.sourceIdentity.productTree = "0".repeat(40);
  if (attack === "precommit_source") evidence.sourceIdentity.productCommit = "precommit_worktree";
  if (attack === "unknown_key") evidence.browser.unknownMetric = 0;
  if (attack === "legacy_391") evidence.browser.legacy391Rows = 1;
  if (attack === "per_node_mutation") evidence.browser.descendantInlineMutationTotal = 1;
  if (attack === "contaminated_pass") evidence.tdd.excludedRuns.countedAsPass = 1;
  if (attack === "hang_reclassified") evidence.tdd.excludedRuns.hangDisposition = "PASS";
  if (attack === "stale_current_main") evidence.authorities.main.commit = binding.integration.mergeBase;
  if (attack === "stale_main_tree") evidence.authorities.main.tree = "0".repeat(40);
  if (attack === "kosha_overlap") evidence.integration.koshaPathOverlapCount = 1;
  if (attack === "ontology_cas_omission") evidence.integration.preservesConfirmationCas = false;
  if (attack === "log_hash_tamper") evidence.artifacts[0].sha256 = "0".repeat(64);
  if (attack === "missing_incident") delete evidence.tdd.excludedRuns;
  if (attack === "missing_harness_red") delete evidence.tdd.harnessRed;
  if (attack === "stale_browser_blob") evidence.sourceIdentity.browserTestBlob = "0".repeat(40);
  if (attack === "stale_harness_blob") evidence.sourceIdentity.harnessHelperBlob = "0".repeat(40);
  if (attack === "red_reclassified") evidence.tdd.requestScopeRed.actualDispatchRequestCount = 0;
  if (attack === "harness_red_reclassified") evidence.tdd.harnessRed.exitCode = 0;
  if (attack === "stale_binding_product") {
    binding.product.commit = binding.product.parent;
    binding.product.commitRef = `${binding.product.parent}^{commit}`;
  }
  if (attack === "stale_binding_integration") {
    binding.integration.commit = binding.integration.mergeBase;
    binding.integration.authorityRef = `${binding.integration.mergeBase}^{commit}`;
  }
  if (attack === "stale_binding_ontology_product") {
    binding.ontology.productCommit = binding.ontology.mergeBase;
    binding.ontology.productAuthorityRef = `${binding.ontology.mergeBase}^{commit}`;
  }
  if (attack === "stale_binding_ontology_evidence") {
    binding.ontology.evidenceCommit = binding.ontology.productCommit;
    binding.ontology.evidenceAuthorityRef = `${binding.ontology.productCommit}^{commit}`;
  }
  if (attack === "missing_authority_ref") delete binding.integration.authorityRef;
  if (attack === "wrong_authority_ref") binding.integration.authorityRef = "HEAD^{commit}";
  if (attack === "missing_ontology_authority_ref") delete binding.ontology.productAuthorityRef;
  if (attack === "wrong_ontology_authority_ref") binding.ontology.productAuthorityRef = "HEAD^{commit}";
  if (attack === "unknown_binding_key") binding.integration.unknownRef = "refs/heads/main";
  if (attack === "stale_evidence_binding_hash") evidence.sourceBinding.sha256 = "0".repeat(64);
  if (attack === "stale_scope_race_count") evidence.browser.scopeRaceCheckCount = 0;
  if (attack === "revision_domain_conflation") evidence.integration.preservesDistinctRevisionDomains = false;
  if (attack === "evidence_summary_overlay_omission") evidence.integration.preservesRawEvidenceSummaryOverlay = false;
  if (attack === "stale_localization_trust") evidence.integration.revalidatesStaleLocalizationEnvelopes = false;
  if (attack === "localization_scope_invalidation_omission") evidence.integration.invalidatesAuthorityOnLocalizationReview = false;
  if (attack === "share_workspace_state_omission") evidence.integration.preservesShareWorkspaceState = false;
}

function main() {
  const arguments_ = process.argv.slice(2);
  const attackIndex = arguments_.indexOf("--attack");
  const attack = attackIndex >= 0 ? arguments_[attackIndex + 1] : null;
  if (attack !== null && !attackModes.has(attack)) {
    process.stderr.write(`[remediation-evidence-invalid-attack] ${attack}\n`);
    process.exit(2);
  }
  try {
    const bindingIndex = arguments_.indexOf(BINDING_ARGUMENT);
    if (bindingIndex < 0 || !arguments_[bindingIndex + 1]) {
      throw new Error(`${BINDING_ARGUMENT} is required`);
    }
    const bindingPath = path.resolve(REPO_ROOT, arguments_[bindingIndex + 1]);
    const relativeBindingPath = path.relative(REPO_ROOT, bindingPath);
    assert.equal(relativeBindingPath.startsWith(".."), false, "binding manifest must be inside the repository");
    assert.equal(fs.existsSync(bindingPath), true, "binding manifest is missing");
    const bindingHash = sha256(bindingPath);
    const binding = readJson(bindingPath);
    const evidence = readJson(EVIDENCE_PATH);
    applyAttack(evidence, binding, attack);
    validateBindingSchema(binding);
    validateEvidenceSchema(evidence);
    validateBindingEvidence(binding, evidence, bindingPath, bindingHash);
    validateArtifactHashes(evidence);
    validateGitBinding(binding, evidence);
    validateProductCensus(binding, evidence);
    validateTdd(evidence);
    validateVerification(binding, evidence);
    validateBrowserMetrics(binding, evidence);
    validateProductSource(binding);
    validateGeneratedAndScope(binding, evidence);
    assert.deepEqual(evidence.reviewBoundary, {
      freshShareIndependentReviewRequired: true,
      freshShareIndependentReviewStatus: "pending",
      freshOntologyIndependentReviewRequired: true,
      freshOntologyIndependentReviewStatus: "pending",
      selfApproved: false,
      integratedIntoMain: false,
      hold: true,
      completionClaim: "implementation_evidence_complete_hold_for_fresh_reviews"
    });
    process.stdout.write(`${JSON.stringify({
      status: "remediation-evidence-valid-hold",
      productCommit: binding.product.commit,
      productTree: binding.product.tree,
      authoritativeMain: binding.integration.commit,
      ontologyProduct: binding.ontology.productCommit,
      ontologyEvidence: binding.ontology.evidenceCommit,
      mainShareMergeTree: evidence.authorities.main.mergeTreeResultTree,
      ontologyShareConflictCount: evidence.authorities.ontology.contentConflictCount,
      browserRunnerTests: evidence.verification.browser.runnerTestsPassed,
      browserRowsExecuted: evidence.browser.matrixRowsExecuted,
      scopeRaceChecks: evidence.browser.scopeRaceCheckCount,
      shareProcessesAfter: evidence.verification.browser.shareTestProcessesAfter,
      independentReview: "pending",
      hold: true
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
