// @ts-check

import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const DEFAULT_OUTPUT_DIR = "evaluation/distributed-admission-activation-approval-2026-08-29";
const REQUIRED_FILES = Object.freeze({
  distributedAdmissionSource: "lib/public-distributed-rate-limit.ts",
  remoteHermesLedgerSource: "lib/remote-hermes-upstash-ledger.ts",
  readinessEvidence: "evaluation/public-search-distributed-rate-limit-readiness-2026-08-02/report.json",
  launchOperationsEvidence: "evaluation/launch-operations-readiness-2026-08-26/report.json",
});
const REQUIRED_VARIABLES = Object.freeze([
  "UPSTASH_REDIS_REST_URL",
  "UPSTASH_REDIS_REST_TOKEN",
]);

function parseArgs(argv) {
  const args = { root: process.cwd(), output: DEFAULT_OUTPUT_DIR };
  for (let index = 2; index < argv.length; index += 1) {
    const item = argv[index];
    const next = argv[index + 1];
    if (item === "--root" && next) {
      args.root = next;
      index += 1;
    } else if (item === "--output" && next) {
      args.output = next;
      index += 1;
    } else {
      throw new Error(`Unknown or incomplete argument: ${item}`);
    }
  }
  return args;
}

function readText(root, relativePath) {
  const filePath = resolve(root, relativePath);
  if (!existsSync(filePath)) throw new Error(`Missing required file: ${relativePath}`);
  return readFileSync(filePath, "utf8");
}

function readJson(root, relativePath) {
  return JSON.parse(readText(root, relativePath));
}

function currentHead(root) {
  try {
    return execFileSync("git", ["rev-parse", "HEAD"], {
      cwd: root,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return null;
  }
}

function check(id, passed, message) {
  return { id, passed, message: passed ? "ok" : message };
}

function includesAll(text, needles) {
  return needles.every((needle) => text.includes(needle));
}

function sameStringSet(left, right) {
  return left.length === right.length && [...left].sort().every((item, index) => item === [...right].sort()[index]);
}

export function buildDistributedAdmissionActivationPreflight({ root }) {
  const missingFiles = Object.entries(REQUIRED_FILES)
    .filter(([, relativePath]) => !existsSync(resolve(root, relativePath)))
    .map(([id, relativePath]) => ({ id, relativePath }));
  if (missingFiles.length > 0) {
    return {
      schemaVersion: "safeclaw-distributed-admission-activation-preflight/v1",
      generatedAt: new Date().toISOString(),
      sourceSha: currentHead(root),
      verdict: "BLOCKED_DISTRIBUTED_ADMISSION_ACTIVATION_PREFLIGHT_MISSING_INPUTS",
      overall: "blocked_missing_files",
      operatorApprovalRequired: true,
      configurationChangeApproved: false,
      activationPerformed: false,
      ephemeralRedisMutationPerformed: false,
      missingFiles,
      checks: missingFiles.map((file) => check(`file:${file.id}`, false, `Missing ${file.relativePath}`)),
      failedCheckIds: missingFiles.map((file) => `file:${file.id}`),
    };
  }

  const admissionSource = readText(root, REQUIRED_FILES.distributedAdmissionSource);
  const hermesSource = readText(root, REQUIRED_FILES.remoteHermesLedgerSource);
  const readiness = readJson(root, REQUIRED_FILES.readinessEvidence);
  const operations = readJson(root, REQUIRED_FILES.launchOperationsEvidence);
  const sourceSha = currentHead(root);
  const readinessVariables = Array.isArray(readiness.configuration?.requiredVariables)
    ? readiness.configuration.requiredVariables.filter((item) => typeof item === "string")
    : [];
  const operationBoundaries = operations.boundaries ?? {};
  const readinessBoundary = readiness.boundary ?? {};
  const operationRows = Array.isArray(operations.rows) ? operations.rows : [];

  const checks = [
    check(
      "current_production_is_fail_closed_before_provider_work",
      readiness.verdict === "PASS_LIVE_PRODUCTION_PUBLIC_SEARCH_DISTRIBUTED_CONFIGURATION_TRUTH"
        && readiness.configuration?.configurationState === "absent"
        && readiness.configuration?.productionConfigured === false
        && readiness.configuration?.distributedActivationPending === true
        && readiness.currentSourceContract?.productionRequiresDistributedAdmission === true
        && readiness.currentSourceContract?.absentConfigurationFailsClosedBeforeProviderWork === true,
      "Current live evidence must retain absent-configuration fail-closed behavior before provider work.",
    ),
    check(
      "required_secret_pair_is_exact_and_not_recorded",
      sameStringSet(readinessVariables, REQUIRED_VARIABLES),
      "The approval packet must require exactly the Upstash REST URL and token without storing values.",
    ),
    check(
      "source_rejects_partial_or_unsafe_configuration",
      includesAll(admissionSource, [
        "if (!url || !token) return { state: \"invalid\" }",
        "parsed.protocol !== \"https:\"",
        "distributed limiter configuration is incomplete or unsafe",
        "distributed concurrency configuration is incomplete or unsafe",
      ]),
      "Distributed admission must reject partial credentials and unsafe URLs.",
    ),
    check(
      "source_uses_namespaced_hashed_rate_and_lease_keys",
      includesAll(admissionSource, [
        "safeclaw:public-rate:${namespace}:${digest}",
        "safeclaw:public-concurrency:${namespace}",
        "createHash(\"sha256\").update(identifier)",
        "CONCURRENCY_ACQUIRE_SCRIPT",
        "CONCURRENCY_RELEASE_SCRIPT",
      ]),
      "Rate and concurrency keys must stay namespaced, client identifiers hashed, and lease operations atomic.",
    ),
    check(
      "remote_hermes_ledger_requires_separate_explicit_mode",
      includesAll(hermesSource, [
        "SAFECLAW_REMOTE_HERMES_LEDGER_MODE?.trim() !== \"upstash\"",
        "safeclaw:remote-hermes:v1",
      ]),
      "Adding shared Upstash credentials must not silently activate the remote Hermes ledger.",
    ),
    check(
      "operations_ui_reports_activation_boundary",
      operations.verdict === "PASS_LIVE_PRODUCTION_LAUNCH_OPERATIONS_CONFIGURATION_TRUTH"
        && operations.summary?.configurationState === "absent"
        && operationBoundaries.distributedAdmissionConfigured === false
        && operationBoundaries.distributedAdmissionActivationRequired === true
        && operationBoundaries.providerDispatchReady === false
        && operationBoundaries.fullyAutomatedLaunchClaimAllowed === false,
      "The live operations cockpit must show configuration absent and preserve separate launch/provider approvals.",
    ),
    check(
      "launch_operations_evidence_matches_current_head",
      sourceSha !== null
        && operations.sourceHead === sourceSha
        && operations.productCommit === sourceSha
        && operations.productionBuild?.commitSha === sourceSha
        && operationRows.length === 4
        && operationRows.every((row) => row.ok === true
          && row.publicAdmission === "unavailable"
          && row.publicAdmissionConfiguration === "absent"
          && row.providerDispatch === "preview_only"),
      "The approval packet must be bound to the current source/live commit and all four current operations viewports.",
    ),
    check(
      "no_mutation_or_security_completion_overclaim",
      readinessBoundary.dbMutationPerformed === false
        && readinessBoundary.providerDispatchCalled === false
        && readinessBoundary.shareSessionCreated === false
        && readinessBoundary.vectorMutationPerformed === false
        && readinessBoundary.wikiPublicationPerformed === false
        && readinessBoundary.koshaRegistryMutationPerformed === false
        && readinessBoundary.exactSavedShareVerdict === "MISSING_EVIDENCE"
        && operationBoundaries.dbMutationPerformed === false
        && operationBoundaries.providerDispatchCalled === false
        && operationBoundaries.shareSessionCreated === false
        && operationBoundaries.exactSavedShareVerdict === "MISSING_EVIDENCE",
      "Activation preparation must preserve every mutation boundary and exact saved Share gap.",
    ),
  ];
  const failedChecks = checks.filter((item) => !item.passed);
  const ready = failedChecks.length === 0;

  return {
    schemaVersion: "safeclaw-distributed-admission-activation-preflight/v1",
    generatedAt: new Date().toISOString(),
    sourceSha,
    productionCommit: typeof operations.productionBuild?.commitSha === "string"
      ? operations.productionBuild.commitSha
      : null,
    sourceMatchesProduction: sourceSha !== null && operations.productionBuild?.commitSha === sourceSha,
    verdict: ready
      ? "APPROVAL_REQUIRED_DISTRIBUTED_ADMISSION_ACTIVATION_NO_MUTATION"
      : "BLOCKED_DISTRIBUTED_ADMISSION_ACTIVATION_PREFLIGHT_FAILED",
    overall: ready ? "approval_ready_open" : "blocked_preflight_failed",
    operatorApprovalRequired: true,
    configurationChangeApproved: false,
    activationPerformed: false,
    runtimeBehavioralProbePerformed: false,
    secretValuesInspected: false,
    secretValuesRecorded: false,
    ephemeralRedisMutationPerformed: false,
    requestedChange: {
      platform: "Vercel",
      environment: "Production",
      requiredVariables: REQUIRED_VARIABLES,
      remoteHermesLedgerModeChangeRequested: false,
    },
    currentRuntimeTruth: {
      operationsVerdict: operations.verdict,
      viewportPassCount: operationRows.filter((row) => row.ok === true).length,
      viewportCount: operationRows.length,
      configurationState: operations.summary?.configurationState ?? null,
      publicAdmission: operationRows[0]?.publicAdmission ?? null,
      providerDispatch: operationRows[0]?.providerDispatch ?? null,
    },
    sharedCredentialBoundary: {
      publicAdmissionWouldUseCredentials: true,
      remoteHermesLedgerWouldUseCredentialsOnlyWhenExplicitModeIsUpstash: true,
      remoteHermesLedgerEnabledByThisChange: false,
    },
    requiredApproval: {
      id: "configure-production-distributed-admission",
      reason: "The operator change stores production secrets and the required behavioral probe creates short-lived Upstash counter and lease keys.",
    },
    postApprovalValidation: [
      "Deploy once with both Production-scoped variables set; never commit their values.",
      "GET /api/export/pdf and require admission.configurationState=ready without treating syntax readiness as connectivity proof.",
      "Run one bounded invalid-payload POST /api/export/pdf to prove Upstash counter and lease commands succeed before document rendering; expect validation failure, no provider call, and no database mutation.",
      "Verify /ops/api reports distributed admission ready while provider dispatch remains preview_only and exact saved Share remains MISSING_EVIDENCE.",
      "Run bounded Ask/Search/Knowledge probes and a fresh Standard repository scan before closing immutable findings or claiming security completion.",
    ],
    rollbackPlan: [
      "Remove both Production-scoped Upstash variables together and redeploy.",
      "Require public provider-backed routes to return DISTRIBUTED_RATE_LIMIT_UNAVAILABLE before provider work.",
      "Confirm provider dispatch, DB, Share-session, vector, Wiki, and KOSHA registry boundaries remain unchanged.",
    ],
    forbiddenBeforeApproval: [
      "Write either Upstash Production secret.",
      "Create distributed rate or concurrency keys.",
      "Enable SAFECLAW_REMOTE_HERMES_LEDGER_MODE=upstash as part of this change.",
      "Execute provider generation or dispatch.",
      "Claim distributed admission is operational from configurationState=ready alone.",
      "Close exact saved Share, database/RLS, Wiki, vector, provider persistence, or KOSHA promotion gates.",
    ],
    mutationBoundary: {
      dbSchemaMutationPerformed: false,
      dbDataMutationPerformed: false,
      providerCallPerformed: false,
      providerDispatchCalled: false,
      shareSessionCreated: false,
      vectorOrEmbeddingMutationPerformed: false,
      wikiPublicationPerformed: false,
      koshaRegistryMutationPerformed: false,
      exactSavedShareVerdict: "MISSING_EVIDENCE",
    },
    checks,
    failedCheckIds: failedChecks.map((item) => item.id),
    inputs: REQUIRED_FILES,
  };
}

export function renderDistributedAdmissionActivationPreflightMarkdown(report) {
  return `# Distributed Admission Activation Approval Preflight

Generated: \`${report.generatedAt}\`
Source SHA: \`${report.sourceSha ?? "unknown"}\`
Production commit: \`${report.productionCommit ?? "unknown"}\`
Source matches production: \`${report.sourceMatchesProduction}\`
Verdict: \`${report.verdict}\`
Operator approval required: \`${report.operatorApprovalRequired}\`
Activation performed: \`${report.activationPerformed}\`
Ephemeral Redis mutation performed: \`${report.ephemeralRedisMutationPerformed}\`

## Decision

${report.overall === "approval_ready_open"
  ? "The source and live truth are ready for an operator decision. This packet does not apply secrets or activate distributed admission."
  : "The activation packet is blocked because at least one fail-closed prerequisite is missing."}

## Requested Change

- Platform/environment: \`${report.requestedChange?.platform ?? "unknown"}\` / \`${report.requestedChange?.environment ?? "unknown"}\`
- Variables: ${(report.requestedChange?.requiredVariables ?? []).map((item) => `\`${item}\``).join(", ") || "None"}
- Secret values inspected or recorded: \`${report.secretValuesInspected}\` / \`${report.secretValuesRecorded}\`
- Remote Hermes ledger enabled by this change: \`${report.sharedCredentialBoundary?.remoteHermesLedgerEnabledByThisChange}\`
- Current runtime: \`${report.currentRuntimeTruth?.configurationState ?? "unknown"}\` admission, \`${report.currentRuntimeTruth?.providerDispatch ?? "unknown"}\` dispatch
- Current operations viewports: \`${report.currentRuntimeTruth?.viewportPassCount ?? 0}/${report.currentRuntimeTruth?.viewportCount ?? 0}\` PASS

## Checks

| Check | Result | Message |
| --- | --- | --- |
${report.checks.map((item) => `| \`${item.id}\` | ${item.passed ? "PASS" : "FAIL"} | ${item.message.replaceAll("|", "\\|")} |`).join("\n")}

## Post-approval Validation

${report.postApprovalValidation.map((item) => `- ${item}`).join("\n")}

## Rollback

${report.rollbackPlan.map((item) => `- ${item}`).join("\n")}

## Forbidden Before Approval

${report.forbiddenBeforeApproval.map((item) => `- ${item}`).join("\n")}

## Preserved Boundary

- No DB, provider, Share-session, vector, Wiki, or KOSHA registry mutation occurred.
- Exact saved Share remains \`${report.mutationBoundary.exactSavedShareVerdict}\`.
- A fresh Standard scan remains required before any security-complete claim.
`;
}

function writeReports(outputDir, report) {
  mkdirSync(outputDir, { recursive: true });
  writeFileSync(resolve(outputDir, "report.json"), `${JSON.stringify(report, null, 2)}\n`);
  writeFileSync(resolve(outputDir, "report.md"), renderDistributedAdmissionActivationPreflightMarkdown(report));
}

async function main() {
  const args = parseArgs(process.argv);
  const root = resolve(args.root);
  const output = resolve(root, args.output);
  const report = buildDistributedAdmissionActivationPreflight({ root });
  writeReports(output, report);
  process.stdout.write(`${JSON.stringify({ output, verdict: report.verdict, failedCheckIds: report.failedCheckIds }, null, 2)}\n`);
}

if (process.argv[1]?.endsWith("distributed_admission_activation_preflight.mjs")) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
}
