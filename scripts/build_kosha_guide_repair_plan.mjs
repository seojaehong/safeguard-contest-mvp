import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

const DEFAULT_INPUT = "evaluation/kosha-guide-approval-current-2026-07-20/report.json";
const DEFAULT_OUTPUT = "evaluation/kosha-guide-approval-current-2026-07-20/repair-plan.json";

function parseArguments(argv) {
  const options = {
    input: DEFAULT_INPUT,
    output: DEFAULT_OUTPUT
  };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--input" || argument === "--output") {
      const value = argv[index + 1];
      if (!value) throw new Error(`${argument} requires a value`);
      options[argument.slice(2)] = value;
      index += 1;
      continue;
    }
    if (argument === "--help") {
      console.log("Usage: node scripts/build_kosha_guide_repair_plan.mjs [--input report.json] [--output repair-plan.json]");
      process.exit(0);
    }
    throw new Error(`Unknown argument: ${argument}`);
  }
  return options;
}

function asRecord(value, label) {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(`${label}-not-record`);
  }
  return value;
}

function asArray(value, label) {
  if (!Array.isArray(value)) throw new Error(`${label}-not-array`);
  return value;
}

function asNumber(value, label) {
  if (typeof value !== "number") throw new Error(`${label}-not-number`);
  return value;
}

function readReport(path) {
  return asRecord(JSON.parse(readFileSync(path, "utf8")), "report");
}

function compactRow(row) {
  const record = asRecord(row, "repair-row");
  return Object.fromEntries(
    Object.entries(record)
      .filter(([, value]) => value !== undefined && value !== null && value !== "")
      .map(([key, value]) => [key, value])
  );
}

function buildRepairPlan(report) {
  const inventory = asRecord(report.inventory, "inventory");
  const comparison = asRecord(inventory.officialComparison, "officialComparison");
  const quality = asRecord(report.corpusQuality, "corpusQuality");
  const retrieval = asRecord(report.retrieval, "retrieval");
  const refreshPlan = asRecord(report.refreshPlan, "refreshPlan");
  const dryRun = asRecord(refreshPlan.dryRun, "refreshPlan.dryRun");
  const dryRunCounts = asRecord(dryRun.counts, "refreshPlan.dryRun.counts");

  const versionUpdates = asArray(comparison.versionMismatches, "versionMismatches").map(compactRow);
  const retiredRows = asArray(comparison.staleLocalRows, "staleLocalRows").map(compactRow);
  const operationalReviewRows = asArray(
    quality.operationalControlReviewRequiredRows,
    "operationalControlReviewRequiredRows"
  ).map(compactRow);
  const operationalSecondaryRows = asArray(
    quality.operationalControlContaminationRows,
    "operationalControlContaminationRows"
  ).map(compactRow);
  const duplicateSummaryDetails = asArray(
    quality.duplicateSummaryDetails,
    "duplicateSummaryDetails"
  ).map(compactRow);
  const untestedBranches = asArray(retrieval.untestedBranches, "retrieval.untestedBranches")
    .map((value) => String(value));
  const downstreamFailures = asArray(retrieval.downstream, "retrieval.downstream")
    .map((value) => asRecord(value, "downstream"))
    .filter((item) => asArray(item.failures, "downstream.failures").length > 0)
    .map((item) => ({
      scenarioId: String(item.scenarioId),
      branch: String(item.branch),
      executionStatus: String(item.executionStatus),
      failures: asArray(item.failures, "downstream.failures").map((failure) => String(failure))
    }));

  const workstreams = [
    {
      id: "provenance_and_status_backfill_dry_run",
      mutationAllowedByThisRun: false,
      count: asNumber(quality.missingSourceUrlCount, "missingSourceUrlCount"),
      action: "Backfill official URL, file ID, published date, current/retired status, and content hash.",
      exitCriteria: "All active KOSHA Guide rows have official provenance or are quarantined outside active retrieval."
    },
    {
      id: "body_hydration_or_ocr_review",
      mutationAllowedByThisRun: false,
      count: asNumber(quality.emptyBodyCount, "emptyBodyCount"),
      action: "Hydrate source PDF text or attach reviewed OCR body.",
      exitCriteria: "Every launch row has non-empty source-grounded body text or is excluded from active retrieval."
    },
    {
      id: "summary_regeneration",
      mutationAllowedByThisRun: false,
      count: asNumber(quality.duplicateSummaryRows, "duplicateSummaryRows"),
      action: "Replace fallback or reused summaries with source-grounded summaries.",
      exitCriteria: "Fallback-template summaries are zero for active KOSHA Guide retrieval rows."
    },
    {
      id: "version_state_reconciliation",
      mutationAllowedByThisRun: false,
      count: versionUpdates.length + retiredRows.length,
      action: "Review official version updates and retired local rows.",
      exitCriteria: "Version update/retire dry-run is approved item by item before mutation."
    },
    {
      id: "control_causality_review",
      mutationAllowedByThisRun: false,
      count: operationalReviewRows.length + operationalSecondaryRows.length,
      action: "Review heuristic-delta and cross-domain operational controls against source bodies.",
      exitCriteria: "Controls are source-derived, task-relevant, and cross-domain contamination fixtures pass."
    },
    {
      id: "retrieval_branch_observation",
      mutationAllowedByThisRun: false,
      count: untestedBranches.length,
      action: "Observe ranked and hybrid production retrieval branches with document reflection checks.",
      exitCriteria: "KOSHA evidence and task-specific controls are reflected into documents without generic prose-only matches.",
      countSemantics: "scenario-branch pairs, not unique branch names"
    }
  ];

  const plan = {
    schemaVersion: "safeclaw-kosha-guide-repair-plan/v1",
    generatedAt: new Date().toISOString(),
    sourceAudit: "evaluation/kosha-guide-approval-current-2026-07-20/report.json",
    decision: "approval_required_before_mutation_or_embedding",
    readOnly: true,
    dbMutationPerformed: false,
    uploadPerformed: false,
    embeddingGenerated: false,
    dryRunCounts: {
      insert: asNumber(dryRunCounts.insert, "dryRunCounts.insert"),
      update: asNumber(dryRunCounts.update, "dryRunCounts.update"),
      retire: asNumber(dryRunCounts.retire, "dryRunCounts.retire"),
      unchanged: asNumber(dryRunCounts.unchanged, "dryRunCounts.unchanged")
    },
    evidenceCoverage: [
      {
        workstreamId: "provenance_and_status_backfill_dry_run",
        coverage: "count_only",
        count: asNumber(quality.missingSourceUrlCount, "missingSourceUrlCount"),
        rowLevelEvidenceAvailable: false,
        reason: "The current audit records missing official provenance counts, but does not include all 1040 row identifiers in the evaluation artifact."
      },
      {
        workstreamId: "body_hydration_or_ocr_review",
        coverage: "count_only",
        count: asNumber(quality.emptyBodyCount, "emptyBodyCount"),
        rowLevelEvidenceAvailable: false,
        reason: "The current audit records empty-body counts and parse accounting, but does not include all 818 row identifiers in the evaluation artifact."
      },
      {
        workstreamId: "summary_regeneration",
        coverage: "group_sample",
        count: asNumber(quality.duplicateSummaryRows, "duplicateSummaryRows"),
        rowLevelEvidenceAvailable: false,
        reason: "The current audit includes duplicate summary groups and sample IDs, not a complete 822-row manifest."
      },
      {
        workstreamId: "version_state_reconciliation",
        coverage: "row_level_complete",
        count: versionUpdates.length + retiredRows.length,
        rowLevelEvidenceAvailable: true,
        reason: "The current audit includes every official version mismatch and retired local row."
      },
      {
        workstreamId: "control_causality_review",
        coverage: "row_level_complete",
        count: operationalReviewRows.length + operationalSecondaryRows.length,
        rowLevelEvidenceAvailable: true,
        reason: "The current audit includes every operational review-required row and remaining secondary candidate row."
      },
      {
        workstreamId: "retrieval_branch_observation",
        coverage: "scenario_branch_level_complete",
        count: untestedBranches.length,
        rowLevelEvidenceAvailable: true,
        reason: "The current audit includes every untested retrieval scenario-branch pair."
      }
    ],
    workstreams,
    rowSets: {
      versionUpdates,
      retiredRows,
      operationalControlReviewRequiredRows: operationalReviewRows,
      operationalControlSecondaryCandidateRows: operationalSecondaryRows,
      duplicateSummaryGroups: duplicateSummaryDetails,
      untestedRetrievalBranches: untestedBranches,
      downstreamReflectionFailures: downstreamFailures
    },
    approvalGate: {
      mutationAllowedByThisRun: false,
      requiredBeforeMutation: "explicit user approval after reviewed per-item dry-run",
      requiredBeforeEmbedding: "official provenance/body/control/retrieval branch blockers closed"
    }
  };

  return plan;
}

function markdownCell(value) {
  return String(value).replaceAll("|", "/").replace(/\r?\n/gu, " ");
}

function writeMarkdown(plan, path) {
  const versionRows = plan.rowSets.versionUpdates
    .map((item) => `| \`${item.stableKey}\` | \`${item.localCode}\` | \`${item.officialCode}\` | ${markdownCell(item.internalPath)} |`)
    .join("\n") || "| - | - | - | - |";
  const retireRows = plan.rowSets.retiredRows
    .map((item) => `| \`${item.stableKey}\` | \`${item.localCode}\` | ${markdownCell(item.internalPath)} | ${item.officialRetired === true ? "yes" : "no"} |`)
    .join("\n") || "| - | - | - | - |";
  const workstreamRows = plan.workstreams
    .map((item) => `| \`${item.id}\` | ${item.count.toLocaleString("ko-KR")} | ${item.mutationAllowedByThisRun ? "yes" : "no"} | ${markdownCell(item.action)} | ${markdownCell(item.countSemantics || "-")} | ${markdownCell(item.exitCriteria)} |`)
    .join("\n");
  const coverageRows = plan.evidenceCoverage
    .map((item) => `| \`${item.workstreamId}\` | ${item.coverage} | ${item.count.toLocaleString("ko-KR")} | ${item.rowLevelEvidenceAvailable ? "yes" : "no"} | ${markdownCell(item.reason)} |`)
    .join("\n");
  const controlRows = [
    ...plan.rowSets.operationalControlReviewRequiredRows.slice(0, 10),
    ...plan.rowSets.operationalControlSecondaryCandidateRows
  ].map((item) =>
    `| \`${item.id}\` | ${markdownCell(item.title)} | ${markdownCell(JSON.stringify(item.unlabelledFlags || item.flags || []))} |`
  ).join("\n") || "| - | - | - |";
  const retrievalRows = plan.rowSets.downstreamReflectionFailures
    .map((item) => `| ${item.scenarioId} | ${item.branch} | ${item.executionStatus} | ${markdownCell(item.failures.join("; "))} |`)
    .join("\n") || "| - | - | - | - |";

  const body = `# KOSHA Guide Repair Plan

Generated at: ${plan.generatedAt}

## Decision

\`${plan.decision}\`

This plan is a read-only repair queue. It does not authorize DB mutation, upload, embedding generation, or vector enablement.

## Workstreams

| Workstream | Count | Mutation allowed | Action | Count semantics | Exit criteria |
| --- | ---: | --- | --- | --- | --- |
${workstreamRows}

## Evidence Coverage

| Workstream | Coverage | Count | Row-level evidence available | Reason |
| --- | --- | ---: | --- | --- |
${coverageRows}

## Version Updates

| Stable key | Local | Official | Local path |
| --- | --- | --- | --- |
${versionRows}

## Retired Local Rows

| Stable key | Local | Local path | Official retired |
| --- | --- | --- | --- |
${retireRows}

## Control Causality Review Samples

| Row | Title | Flags |
| --- | --- | --- |
${controlRows}

## Retrieval Reflection Failures

| Scenario | Branch | Status | Failures |
| --- | --- | --- | --- |
${retrievalRows}

## Approval Gate

- Mutation allowed by this run: ${plan.approvalGate.mutationAllowedByThisRun}
- Required before mutation: ${plan.approvalGate.requiredBeforeMutation}
- Required before embedding: ${plan.approvalGate.requiredBeforeEmbedding}
`;
  writeFileSync(path, body, "utf8");
}

const options = parseArguments(process.argv.slice(2));
const inputPath = resolve(options.input);
const outputPath = resolve(options.output);
const markdownPath = outputPath.replace(/\.json$/u, ".md");
const report = readReport(inputPath);
const plan = buildRepairPlan(report);
mkdirSync(dirname(outputPath), { recursive: true });
writeFileSync(outputPath, `${JSON.stringify(plan, null, 2)}\n`, "utf8");
writeMarkdown(plan, markdownPath);
console.log(JSON.stringify({
  output: outputPath,
  markdown: markdownPath,
  workstreams: plan.workstreams.length,
  versionUpdates: plan.rowSets.versionUpdates.length,
  retiredRows: plan.rowSets.retiredRows.length,
  mutationAllowedByThisRun: plan.approvalGate.mutationAllowedByThisRun
}, null, 2));
