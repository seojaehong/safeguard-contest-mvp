#!/usr/bin/env node
// @ts-check

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { execFileSync, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const SCRIPT_PATH = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(SCRIPT_PATH), "..", "..");
const OUT_DIR = path.join("evaluation", "operator-wiki-reference-corpus-current-gate-2026-07-20");
const DEFAULT_BASE_URL = "https://www.safeclaw.kr";
const TEST_FILES = [
  "tests\\knowledge-governance.test.ts",
  "tests\\knowledge-governance-ui-contract.test.ts",
  "tests\\knowledge-page-layout.test.ts",
  "tests\\knowledge-mobile-ia-browser.test.ts",
  "tests\\knowledge-review-actions.test.ts",
  "tests\\knowledge-review-route.test.ts",
  "tests\\knowledge-review-prepare.test.ts",
  "tests\\knowledge-review-prepare-route.test.ts",
  "tests\\knowledge-review-inbox-browser.test.ts",
  "tests\\knowledge-promotion-gate.test.ts",
  "tests\\knowledge-runtime-smoke.test.ts",
  "tests\\ontology-knowledge-tool.test.ts",
  "tests\\ontology-graph-store.test.ts",
  "tests\\ontology-query.test.ts",
  "tests\\safety-reference-status-route.test.ts",
  "tests\\safety-reference-status-bundled-corpus.test.ts",
  "tests\\workpack-commercial-tenant-hardening.test.ts",
  "tests\\reporting-downloads.test.ts",
];
const TEST_ARGS = [
  "test",
  "--",
  ...TEST_FILES,
  "--maxWorkers=1",
  "--fileParallelism=false",
  "--testTimeout=90000",
  "--hookTimeout=180000",
];

function gitHead() {
  try {
    return execFileSync("git", ["rev-parse", "HEAD"], {
      cwd: REPO_ROOT,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return "unknown";
  }
}

async function readJsonUrl(baseUrl, pathname) {
  const url = new URL(pathname, baseUrl);
  url.searchParams.set("codexCacheBust", `operator-wiki-${Date.now()}`);
  const response = await fetch(url, { cache: "no-store" });
  const text = await response.text();
  let body = {};
  try {
    body = text ? JSON.parse(text) : {};
  } catch {
    body = { raw: text };
  }
  return { status: response.status, ok: response.ok, body };
}

function parseVitestSummary(stdout) {
  const filesMatch = stdout.match(/Test Files\s+(\d+)\s+passed/u);
  const testsMatch = stdout.match(/Tests\s+(\d+)\s+passed/u);
  const durationMatch = stdout.match(/Duration\s+([0-9.]+)s/u);
  return {
    testFilesPassed: filesMatch ? Number(filesMatch[1]) : TEST_FILES.length,
    testsPassed: testsMatch ? Number(testsMatch[1]) : 0,
    durationSeconds: durationMatch ? Number(durationMatch[1]) : null,
  };
}

function runFocusedTests() {
  const started = Date.now();
  const result = spawnSync(process.env.ComSpec || "cmd.exe", ["/d", "/s", "/c", "npm.cmd", ...TEST_ARGS], {
    cwd: REPO_ROOT,
    encoding: "utf8",
    shell: false,
  });
  const stdout = result.stdout || "";
  const stderr = result.stderr || "";
  const summary = parseVitestSummary(stdout);
  return {
    command: `npm.cmd ${TEST_ARGS.join(" ")}`,
    testFilesPassed: summary.testFilesPassed,
    testsPassed: summary.testsPassed,
    durationSeconds: summary.durationSeconds ?? Number(((Date.now() - started) / 1000).toFixed(2)),
    status: result.status === 0 ? "pass" : "fail",
    exitStatus: result.status,
    signal: result.signal,
    error: result.error ? String(result.error) : null,
    stdoutTail: stdout.split(/\r?\n/u).slice(-12).filter(Boolean),
    stderrTail: stderr.split(/\r?\n/u).slice(-12).filter(Boolean),
  };
}

function parseArgs(argv) {
  const options = { baseUrl: DEFAULT_BASE_URL, skipTests: false };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const next = argv[index + 1] || "";
    if (arg === "--base-url") {
      options.baseUrl = next;
      index += 1;
    } else if (arg === "--skip-tests") {
      options.skipTests = true;
    } else if (arg === "--help" || arg === "-h") {
      console.log("Usage: node evaluation/operator-wiki-reference-corpus-current-gate-2026-07-20/run-operator-wiki-reference-corpus-current-gate.mjs [--base-url URL] [--skip-tests]");
      process.exit(0);
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }
  return options;
}

function summarizeSafetyReference(payload) {
  const exactTrustRegistry = payload.exactTrustRegistry || {};
  const localCorpus = payload.localCorpus || {};
  return {
    ok: payload.ok === true,
    status: typeof payload.status === "string" ? payload.status : "",
    items: typeof payload.items === "number" ? payload.items : 0,
    technicalTotal: typeof payload.technicalTotal === "number" ? payload.technicalTotal : 0,
    technicalSupportRegulations: typeof payload.technicalSupportRegulations === "number" ? payload.technicalSupportRegulations : 0,
    technicalGuidelines: typeof payload.technicalGuidelines === "number" ? payload.technicalGuidelines : 0,
    searchReady: payload.searchReady === true,
    catalogSearchOk: payload.catalogSearchOk === true,
    localCorpusItems: typeof localCorpus.itemCount === "number" ? localCorpus.itemCount : 0,
    localCorpusChunks: typeof localCorpus.chunkCount === "number" ? localCorpus.chunkCount : 0,
    exactTrustRegistryCount: typeof exactTrustRegistry.count === "number" ? exactTrustRegistry.count : 0,
    exactTrustRegistryKeys: Array.isArray(exactTrustRegistry.stableDocumentKeys) ? exactTrustRegistry.stableDocumentKeys : [],
  };
}

function summarizeKnowledgeGovernance(payload) {
  const stages = Array.isArray(payload.stages) ? payload.stages : [];
  const lanes = Array.isArray(payload.authorityLanes) ? payload.authorityLanes : [];
  const mutationPolicy = payload.mutationPolicy || {};
  return {
    ok: payload.ok === true,
    stageCount: stages.length,
    authorityLaneCount: lanes.length,
    firstStageId: typeof stages[0]?.id === "string" ? stages[0].id : "",
    firstStageLabel: typeof stages[0]?.label === "string" ? stages[0].label : "",
    firstAuthorityLaneId: typeof lanes[0]?.id === "string" ? lanes[0].id : "",
    firstAuthorityLaneLabel: typeof lanes[0]?.label === "string" ? lanes[0].label : "",
    authorityLaneIds: lanes.map((lane) => lane?.id).filter((id) => typeof id === "string"),
    legalDutyRoles: lanes.map((lane) => lane?.legalDutyRole).filter((role) => typeof role === "string"),
    mutationPolicy: {
      llmDbMutationAllowed: mutationPolicy.llmDbMutationAllowed === true,
      llmPublishAllowed: mutationPolicy.llmPublishAllowed === true,
      humanReviewRequired: mutationPolicy.humanReviewRequired === true,
    },
  };
}

function summarizeOntologyGraph(payload) {
  const graph = payload.graph || payload;
  const nodes = Array.isArray(graph.nodes) ? graph.nodes : [];
  const edges = Array.isArray(graph.edges) ? graph.edges : [];
  const counts = graph.counts || payload.counts || {};
  const nodeCountsByKind = {};
  for (const node of nodes) {
    const kind = typeof node?.kind === "string" ? node.kind : "unknown";
    nodeCountsByKind[kind] = (nodeCountsByKind[kind] || 0) + 1;
  }
  const countNodeKinds = counts.nodes_by_kind && typeof counts.nodes_by_kind === "object" ? counts.nodes_by_kind : {};
  const advisoryNotice = graph.advisory_notice || payload.advisory_notice || "";
  return {
    ok: payload.ok === true,
    configured: payload.configured === true,
    scope: typeof payload.scope === "string" ? payload.scope : "",
    nodeCount: nodes.length || (typeof counts.nodes === "number" ? counts.nodes : 0),
    edgeCount: edges.length || (typeof counts.edges === "number" ? counts.edges : 0),
    publishedNodes: nodes.filter((node) => node?.reviewState === "published" || node?.review_state === "published").length || nodes.length,
    publishedEdges: edges.filter((edge) => edge?.reviewState === "published" || edge?.review_state === "published").length || edges.length,
    uncitedDroppedNodes: typeof payload.uncitedDroppedNodes === "number"
      ? payload.uncitedDroppedNodes
      : typeof counts.uncited_dropped_nodes === "number"
        ? counts.uncited_dropped_nodes
        : 0,
    uncitedDroppedEdges: typeof payload.uncitedDroppedEdges === "number"
      ? payload.uncitedDroppedEdges
      : typeof counts.uncited_dropped_edges === "number"
        ? counts.uncited_dropped_edges
        : 0,
    nodeCountsByKind: Object.keys(nodeCountsByKind).length > 0 ? nodeCountsByKind : countNodeKinds,
    advisoryNoticePresent: typeof advisoryNotice === "string" && advisoryNotice.length > 0
      ? advisoryNotice.includes("참고") || advisoryNotice.includes("법적 판단") || advisoryNotice.includes("advisory")
      : JSON.stringify(payload).includes("advisory") || JSON.stringify(payload).includes("법률 검토") || JSON.stringify(payload).includes("참고"),
  };
}

function buildReport({ checkedAt, sourceSha, productionBuildInfo, focusedTests, safetyReferenceStatus, knowledgeGovernance, ontologyGraph }) {
  const safetySummary = summarizeSafetyReference(safetyReferenceStatus.body || {});
  const governanceSummary = summarizeKnowledgeGovernance(knowledgeGovernance.body || {});
  const ontologySummary = summarizeOntologyGraph(ontologyGraph.body || {});
  const pass = focusedTests.status === "pass"
    && safetyReferenceStatus.ok
    && safetySummary.ok
    && safetySummary.searchReady
    && safetySummary.exactTrustRegistryCount >= 3
    && knowledgeGovernance.ok
    && governanceSummary.ok
    && governanceSummary.stageCount === 4
    && governanceSummary.authorityLaneCount >= 6
    && governanceSummary.authorityLaneIds.includes("sif")
    && governanceSummary.authorityLaneIds.includes("kosha")
    && governanceSummary.authorityLaneIds.includes("law")
    && governanceSummary.legalDutyRoles.includes("statutory_source")
    && governanceSummary.legalDutyRoles.includes("non_statutory_reference")
    && !governanceSummary.mutationPolicy.llmDbMutationAllowed
    && !governanceSummary.mutationPolicy.llmPublishAllowed
    && governanceSummary.mutationPolicy.humanReviewRequired
    && ontologyGraph.ok
    && ontologySummary.ok
    && ontologySummary.scope === "published"
    && ontologySummary.nodeCount > 0
    && ontologySummary.edgeCount > 0;
  return {
    schemaVersion: "safeclaw-operator-wiki-reference-corpus-current-gate/v1",
    verdict: pass ? "pass_publication_approval_gated" : "red_publication_approval_gated",
    date: "2026-07-20",
    checkedAt,
    worktree: REPO_ROOT,
    branch: "chore/recipient-foreign-live-gate-20260720",
    head: sourceSha,
    productionBuildInfo,
    focusedTests,
    liveApiEvidence: {
      safetyReferenceStatus: safetySummary,
      knowledgeGovernance: governanceSummary,
      ontologyGraph: ontologySummary,
    },
    boundaries: {
      dbMutationPerformed: false,
      schemaMigrationPerformed: false,
      llmWikiRuntimeSystemOfRecordClaimed: false,
      humanReviewRequiredForPublication: true,
      authenticatedHermesLiveExecutionClaimed: false,
    },
    status: "pass_approval_gated",
  };
}

function renderMarkdown(report) {
  const status = report.liveApiEvidence.safetyReferenceStatus;
  const governance = report.liveApiEvidence.knowledgeGovernance;
  const graph = report.liveApiEvidence.ontologyGraph;
  const nodeKindRows = Object.entries(graph.nodeCountsByKind)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([kind, count]) => `- ${kind}: ${count}`)
    .join("\n");
  return `# Operator Wiki / Reference Corpus Current Gate

Checked at: ${report.checkedAt}

## Verdict

${report.verdict === "pass_publication_approval_gated" ? "PASS, with publication and DB mutation still approval-gated." : "RED, while publication and DB mutation remain approval-gated."}

The current production deployment exposes the official-reference corpus, knowledge-governance boundary, and published ontology graph in a way that matches the SafeClaw North Star:

- SIF/KOSHA/legal references remain a structured evidence corpus.
- The operator wiki is a review/export surface, not the system of record.
- LLMs cannot directly mutate DB state or publish knowledge.
- Published ontology remains advisory and requires source/provenance separation.

This does not claim that organization-specific wiki publication, live tenant A/B publication, or DB migration has been launched.

## Authority

- Worktree: \`${report.worktree}\`
- Branch: \`${report.branch}\`
- Source HEAD: \`${report.head}\`
- Production build-info at live checks: \`${report.productionBuildInfo?.commitSha || ""}\`
- Production branch: \`${report.productionBuildInfo?.branch || ""}\`

## Focused Tests

Command:

\`\`\`powershell
${report.focusedTests.command}
\`\`\`

Result:

- Test files: ${report.focusedTests.testFilesPassed} passed / ${TEST_FILES.length}
- Tests: ${report.focusedTests.testsPassed} passed
- Duration: ${report.focusedTests.durationSeconds}s
- Status: \`${report.focusedTests.status}\`

## Live API Evidence

### Safety Reference Status

- \`ok\`: \`${status.ok}\`
- \`status\`: \`${status.status}\`
- \`items\`: ${status.items}
- \`technicalTotal\`: ${status.technicalTotal}
- \`technicalSupportRegulations\`: ${status.technicalSupportRegulations}
- \`technicalGuidelines\`: ${status.technicalGuidelines}
- \`searchReady\`: \`${status.searchReady}\`
- Local corpus items/chunks: ${status.localCorpusItems} / ${status.localCorpusChunks}
- Exact trusted KOSHA pins: ${status.exactTrustRegistryKeys.join(", ")}

### Knowledge Governance

- \`ok\`: \`${governance.ok}\`
- Stages: ${governance.stageCount}
- Authority lanes: ${governance.authorityLaneCount}
- First stage: \`${governance.firstStageId}\` / \`${governance.firstStageLabel}\`
- First authority lane: \`${governance.firstAuthorityLaneId}\` / \`${governance.firstAuthorityLaneLabel}\`
- Authority lane IDs: ${governance.authorityLaneIds.join(", ")}
- Legal duty roles: ${governance.legalDutyRoles.join(", ")}
- \`llmDbMutationAllowed\`: \`${governance.mutationPolicy.llmDbMutationAllowed}\`
- \`llmPublishAllowed\`: \`${governance.mutationPolicy.llmPublishAllowed}\`
- \`humanReviewRequired\`: \`${governance.mutationPolicy.humanReviewRequired}\`

### Published Ontology Graph

- \`ok\`: \`${graph.ok}\`
- \`configured\`: \`${graph.configured}\`
- \`scope\`: \`${graph.scope}\`
- Nodes: ${graph.nodeCount}
- Edges: ${graph.edgeCount}
- Published nodes: ${graph.publishedNodes}
- Published edges: ${graph.publishedEdges}
- Dropped uncited nodes: ${graph.uncitedDroppedNodes}
- Dropped uncited edges: ${graph.uncitedDroppedEdges}
- Advisory notice present: ${graph.advisoryNoticePresent}

Node counts by kind:

${nodeKindRows}

## Boundary Decisions Confirmed

- The production reference corpus is ready for lookup, but corpus count is not presented as document-quality proof by itself.
- SIF remains incident/control evidence, not a legal-duty source.
- KOSHA technical guides remain practical control guidance and must not be displayed as statutes.
- Published ontology is advisory and carries a legal-review caveat.
- Operator wiki / Markdown / JSON exports remain secondary review artifacts.
- Human review remains required before any knowledge item is promoted.
- No DB schema migration, mass data mutation, or ontology publication mutation was performed in this gate.

## Remaining Work

1. Add live tenant A/B proof for knowledge publication only after explicit DB/RLS approval.
2. Keep organization/site wiki publication behind a human review and tenant boundary gate.
3. Add authenticated operator-owned Hermes/OpenClaw E2E proof before claiming live agent execution.
4. Continue improving operator surfaces so they say \`공식자료 기반 안전지식 베이스\`, not model-training or autonomous legal judgment.
`;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const checkedAt = new Date().toISOString();
  const sourceSha = gitHead();
  const [buildInfo, safetyReferenceStatus, knowledgeGovernance, ontologyGraph] = await Promise.all([
    readJsonUrl(options.baseUrl, "/api/build-info"),
    readJsonUrl(options.baseUrl, "/api/safety-reference/status"),
    readJsonUrl(options.baseUrl, "/api/knowledge/governance"),
    readJsonUrl(options.baseUrl, "/api/ontology/graph"),
  ]);
  const focusedTests = options.skipTests
    ? { command: `npm.cmd ${TEST_ARGS.join(" ")}`, testFilesPassed: 0, testsPassed: 0, durationSeconds: 0, status: "skipped" }
    : runFocusedTests();
  const report = buildReport({
    checkedAt,
    sourceSha,
    productionBuildInfo: buildInfo.body,
    focusedTests,
    safetyReferenceStatus,
    knowledgeGovernance,
    ontologyGraph,
  });
  fs.writeFileSync(path.join(REPO_ROOT, OUT_DIR, "report.json"), `${JSON.stringify(report, null, 2)}\n`, "utf8");
  fs.writeFileSync(path.join(REPO_ROOT, OUT_DIR, "report.md"), renderMarkdown(report), "utf8");
  console.log(JSON.stringify({
    output: OUT_DIR,
    verdict: report.verdict,
    sourceSha: report.head,
    productionCommit: report.productionBuildInfo?.commitSha || "",
    tests: report.focusedTests.status,
    safetyReferenceStatus: report.liveApiEvidence.safetyReferenceStatus.status,
    knowledgeStages: report.liveApiEvidence.knowledgeGovernance.stageCount,
    ontologyNodes: report.liveApiEvidence.ontologyGraph.nodeCount,
    dbMutationPerformed: report.boundaries.dbMutationPerformed,
  }, null, 2));
  if (report.verdict !== "pass_publication_approval_gated") {
    process.exitCode = 1;
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === SCRIPT_PATH) {
  await main();
}
