import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";

const DEFAULT_OUTPUT_DIR = "evaluation/rls-llm-wiki-approval-preflight-current-2026-07-20";

const REQUIRED_FILES = Object.freeze({
  rlsReport: "evaluation/supabase-rls-approval-2026-07-17/report.json",
  rlsChecklist: "evaluation/supabase-rls-approval-2026-07-17/approval-checklist.md",
  wikiReport: "evaluation/llm-wiki-rls-approval-2026-07-17/report.json",
  wikiReportMd: "evaluation/llm-wiki-rls-approval-2026-07-17/report.md",
  wikiSqlDesign: "evaluation/llm-wiki-rls-approval-2026-07-17/proposed-non-executable-publication-design.sql.txt",
  tenantHarness: "scripts/supabase_tenant_isolation_harness.mjs",
  tenantManifest: "scripts/supabase_tenant_isolation_manifest.mjs",
  knowledgeGovernance: "lib/knowledge-governance.ts",
  knowledgeCandidateRoute: "lib/knowledge-candidate-route.ts",
  knowledgeReviewRoute: "app/api/knowledge/review/route.ts",
  hermesReviewAuthorityUi: "evaluation/hermes-knowledge-review-authority-ui-2026-07-25/report.json",
});

const NORTHSTAR_REPORT_CANDIDATES = Object.freeze([
  "evaluation/northstar-open-gates-current/report.json",
  "evaluation/northstar-open-gates-current-2026-07-19/report.json",
]);

const CHECKLIST_SECTIONS = Object.freeze([
  "## A. Authoritative Target",
  "## B. Required Read-Only Catalog SQL",
  "## C. Disposable Tenant A/B Contract",
  "## D. Service-Role And Storage Contract",
  "## E. Completion Gate",
]);

const REQUIRED_SQL_TERMS = Object.freeze([
  "pg_class",
  "pg_policies",
  "information_schema.role_table_grants",
  "storage.objects",
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
  const fullPath = resolve(root, relativePath);
  if (!existsSync(fullPath)) throw new Error(`Missing required file: ${relativePath}`);
  return readFileSync(fullPath, "utf8");
}

function readJson(root, relativePath) {
  return JSON.parse(readText(root, relativePath));
}

function firstExistingPath(root, relativePaths) {
  return relativePaths.find((relativePath) => existsSync(resolve(root, relativePath))) ?? null;
}

function currentHead(root) {
  try {
    return execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).trim();
  } catch {
    return null;
  }
}

function sha256File(root, relativePath) {
  return createHash("sha256").update(readFileSync(resolve(root, relativePath))).digest("hex");
}

function artifactIntegrity(root, relativePath) {
  const absolutePath = resolve(root, relativePath);
  const stat = statSync(absolutePath);
  return {
    path: relativePath,
    bytes: stat.size,
    sha256: sha256File(root, relativePath)
  };
}

function check(id, passed, message) {
  return {
    id,
    passed,
    message: passed ? "ok" : message,
  };
}

function includesAll(text, needles) {
  return needles.every((needle) => text.includes(needle));
}

function gateState(report, gateId) {
  const gates = report?.gates;
  if (Array.isArray(gates)) return gates.find((gate) => gate?.id === gateId)?.state;
  return gates?.[gateId]?.status ?? gates?.[gateId]?.state;
}

function sourceFiles(root, relativeRoot) {
  const absoluteRoot = resolve(root, relativeRoot);
  if (!existsSync(absoluteRoot)) return [];
  const files = [];
  const visit = (directory) => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const absolutePath = join(directory, entry.name);
      if (entry.isDirectory()) visit(absolutePath);
      else if (entry.isFile() && /\.(?:ts|tsx|js|mjs|sql)$/u.test(entry.name)) {
        files.push({
          absolutePath,
          relativePath: relative(root, absolutePath).replaceAll("\\", "/"),
        });
      }
    }
  };
  visit(absoluteRoot);
  return files;
}

function publicationSurfaceInventory(root) {
  const files = [
    ...sourceFiles(root, "app"),
    ...sourceFiles(root, "lib"),
    ...sourceFiles(root, "supabase/migrations"),
  ];
  const publicationRpcCallHits = [];
  const publicationSqlFunctionHits = [];
  const publicationLedgerMigrationHits = [];
  const publicationRoutePaths = [];
  for (const file of files) {
    const text = readFileSync(file.absolutePath, "utf8");
    if (/\.rpc\s*\(\s*["'`](?:publish_reviewed_ontology|rollback_ontology_publication)["'`]/u.test(text)) {
      publicationRpcCallHits.push(file.relativePath);
    }
    if (
      file.relativePath.startsWith("supabase/migrations/") &&
      /create\s+(?:or\s+replace\s+)?function\s+(?:public\.)?(?:publish_reviewed_ontology|rollback_ontology_publication)\s*\(/iu.test(text)
    ) {
      publicationSqlFunctionHits.push(file.relativePath);
    }
    if (
      file.relativePath.startsWith("supabase/migrations/") &&
      /create\s+table[\s\S]{0,120}(?:ontology_publication|ontology_graph_version|publication_ledger)/iu.test(text)
    ) {
      publicationLedgerMigrationHits.push(file.relativePath);
    }
    if (
      file.relativePath.startsWith("app/api/knowledge/") &&
      /(?:^|\/)(?:publish|publication)(?:\/|$)/iu.test(file.relativePath)
    ) {
      publicationRoutePaths.push(file.relativePath);
    }
  }
  return {
    scannedFileCount: files.length,
    publicationRpcCallHits: [...new Set(publicationRpcCallHits)].sort(),
    publicationSqlFunctionHits: [...new Set(publicationSqlFunctionHits)].sort(),
    publicationLedgerMigrationHits: [...new Set(publicationLedgerMigrationHits)].sort(),
    publicationRoutePaths: [...new Set(publicationRoutePaths)].sort(),
  };
}

function buildPreflight({ root }) {
  const northstarReportPath = firstExistingPath(root, NORTHSTAR_REPORT_CANDIDATES);
  const missingFiles = Object.entries(REQUIRED_FILES)
    .filter(([, relativePath]) => !existsSync(resolve(root, relativePath)))
    .map(([id, relativePath]) => ({ id, relativePath }));
  if (!northstarReportPath) {
    missingFiles.push({
      id: "northstarReport",
      relativePath: NORTHSTAR_REPORT_CANDIDATES.join(" or "),
    });
  }
  if (missingFiles.length > 0) {
    return {
      schemaVersion: "safeclaw-rls-llm-wiki-approval-preflight/v1",
      generatedAt: new Date().toISOString(),
      sourceSha: currentHead(root),
      overall: "blocked_missing_files",
      launchReadiness: false,
      dbMutationPerformed: false,
      networkOpened: false,
      missingFiles,
      checks: missingFiles.map((file) => check(`file:${file.id}`, false, `Missing ${file.relativePath}`)),
    };
  }

  const rlsReport = readJson(root, REQUIRED_FILES.rlsReport);
  const rlsChecklist = readText(root, REQUIRED_FILES.rlsChecklist);
  const wikiReport = readJson(root, REQUIRED_FILES.wikiReport);
  const wikiReportMd = readText(root, REQUIRED_FILES.wikiReportMd);
  const wikiSqlDesign = readText(root, REQUIRED_FILES.wikiSqlDesign);
  const northstarReport = readJson(root, northstarReportPath);
  const tenantManifestText = readText(root, REQUIRED_FILES.tenantManifest);
  const tenantHarnessText = readText(root, REQUIRED_FILES.tenantHarness);
  const knowledgeGovernanceText = readText(root, REQUIRED_FILES.knowledgeGovernance);
  const knowledgeCandidateRouteText = readText(root, REQUIRED_FILES.knowledgeCandidateRoute);
  const knowledgeReviewRouteText = readText(root, REQUIRED_FILES.knowledgeReviewRoute);
  const hermesReviewAuthorityUi = readJson(root, REQUIRED_FILES.hermesReviewAuthorityUi);
  const publicationSurface = publicationSurfaceInventory(root);
  const hermesAuthority = hermesReviewAuthorityUi.authorityContract ?? {};
  const hermesMutation = hermesReviewAuthorityUi.mutationBoundary ?? {};
  const hermesBoundaries = hermesReviewAuthorityUi.remainingBoundaries ?? {};
  const hermesAfterLive = hermesReviewAuthorityUi.afterLive ?? {};

  const checks = [
    check("rls_status_approval_required", rlsReport.status === "approval_required", "Supabase RLS packet must stay approval_required."),
    check("rls_launch_not_proven", rlsReport.launchIsolationProven === false, "Supabase RLS packet must not claim launch isolation."),
    check("rls_non_mutating", rlsReport.mutation?.database === false && rlsReport.mutation?.schema === false && rlsReport.mutation?.data === false, "Supabase RLS packet must remain non-mutating."),
    check("rls_catalog_missing_is_explicit", rlsReport.liveHeadEvidence?.policyCatalogVerified === false, "Live pg_catalog proof must remain explicit while missing."),
    check("checklist_sections_present", includesAll(rlsChecklist, CHECKLIST_SECTIONS), "Approval checklist is missing a required section."),
    check("checklist_sql_boundaries_present", includesAll(rlsChecklist, REQUIRED_SQL_TERMS), "Approval checklist is missing required SQL/storage inspection terms."),
    check("wiki_verdict_red", wikiReport.verdict === "red_approval_required", "LLM Wiki packet must stay RED before approval."),
    check("wiki_launch_not_proven", wikiReport.launchProven === false, "LLM Wiki packet must not claim launch readiness."),
    check("wiki_non_mutating", wikiReport.databaseConnected === false && wikiReport.databaseMutationPerformed === false && wikiReport.migrationAdded === false && wikiReport.publicationPerformed === false, "LLM Wiki packet must remain non-mutating."),
    check("wiki_publication_unavailable", wikiReportMd.includes("publication remains unavailable") || wikiReportMd.includes("Publication remains unavailable"), "Report must clearly state publication remains unavailable."),
    check("wiki_sql_design_non_executable", /non-executable|not a migration|not execute|do not execute/iu.test(wikiSqlDesign), "SQL companion must be labeled non-executable."),
    check("wiki_sql_design_not_migration_path", !REQUIRED_FILES.wikiSqlDesign.startsWith("supabase/migrations/"), "SQL companion must not live under migrations."),
    check("tenant_manifest_v3", tenantManifestText.includes("version: 3") && tenantManifestText.includes("scenarios"), "Tenant-isolation manifest v3 must be present."),
    check("tenant_harness_no_live_adapter", tenantHarnessText.includes("blocked_unreviewed_live_adapter") && tenantHarnessText.includes("launchProven: false"), "Tenant harness must fail closed without reviewed live adapters."),
    check(
      "hermes_llm_candidate_stays_unpublished",
      /owner:\s*"hermes_or_llm"[\s\S]{0,400}publicationState:\s*"unpublished"[\s\S]{0,250}publishAllowed:\s*false/u.test(
        knowledgeGovernanceText,
      ),
      "Hermes/LLM candidate governance must remain unpublished and non-publishing.",
    ),
    check(
      "knowledge_candidate_review_authority_order",
      /KNOWLEDGE_REVIEW_AUTHORITY_ORDER\s*=\s*\[[\s\S]*?"sif"[\s\S]*?"kosha"[\s\S]*?"law"[\s\S]*?"organization_history"[\s\S]*?"site_history"[\s\S]*?"external_context"/u.test(
        knowledgeGovernanceText,
      ),
      "Knowledge candidate review must preserve the SIF, KOSHA, law, organization, site, and external-context authority order.",
    ),
    check(
      "knowledge_candidate_review_boundary",
      includesAll(knowledgeGovernanceText, [
        'contractVersion: "knowledge-candidate-review.v1"',
        'status: "human_review_required"',
        "sifControlsAreNonStatutoryEvidence: true",
        "koshaGuidanceIsNonStatutory: true",
        "statutoryClaimsRequireLawProvenance: true",
        "tenantMemoryPublicPromotionAllowed: false",
        "siteManagerAcceptanceRequiredBeforeWorkpackUse: true",
        "machineEvidenceReplacesHumanReview: false",
      ]),
      "Knowledge candidate reviewer contract must keep authority, tenant-memory, and human-review boundaries explicit.",
    ),
    check(
      "knowledge_candidate_prompt_authority_separation",
      includesAll(knowledgeCandidateRouteText, [
        "SIF 재해·통제 근거 → KOSHA 기술지침 → 현행 법령",
        "SIF와 KOSHA는 법적 의무가 아니며",
        "문서팩 적용 전 현장 책임자 확인",
        "reviewContract,",
      ]),
      "Knowledge candidate prompt and response must expose the ordered authority and site-review contract.",
    ),
    check(
      "knowledge_candidate_route_non_publishing",
      knowledgeCandidateRouteText.includes("DB 저장과 ontology publish는 수행하지 않았습니다."),
      "Knowledge candidate route must explicitly remain memory-only and non-publishing.",
    ),
    check(
      "knowledge_review_route_non_publishing",
      knowledgeReviewRouteText.includes('publicationState: "unpublished"') &&
        knowledgeReviewRouteText.includes("ontologyPublished: false"),
      "Knowledge review route must preserve unpublished, non-published responses.",
    ),
    check(
      "hermes_review_authority_ui_live",
      hermesReviewAuthorityUi.verdict === "PASS_LIVE_PRODUCTION_HERMES_REVIEW_AUTHORITY_UI" &&
        hermesAfterLive.verdict === "PASS_LIVE_PRODUCTION_HERMES_REVIEW_AUTHORITY_UI" &&
        hermesAfterLive.viewportCount === 8 &&
        hermesAfterLive.passedCount === 8 &&
        hermesAfterLive.failedCount === 0,
      "Hermes reviewer authority UI must retain its measured 8/8 live viewport contract.",
    ),
    check(
      "hermes_review_authority_contract",
      JSON.stringify(hermesAuthority.sourceOrder) === JSON.stringify([
        "SIF",
        "KOSHA",
        "law",
        "organization_history",
        "site_history",
        "external_context",
      ]) &&
        hermesAuthority.statutoryClaimsRequireLawProvenance === true &&
        hermesAuthority.tenantMemoryPublicPromotionAllowed === false &&
        hermesAuthority.siteManagerAcceptanceRequiredBeforeWorkpackUse === true &&
        hermesAuthority.humanReviewRequired === true &&
        hermesAuthority.machineEvidenceReplacesHumanReview === false,
      "Hermes reviewer UI must preserve authority order, law provenance, tenant-memory, and human-review boundaries.",
    ),
    check(
      "hermes_review_authority_non_mutating",
      hermesMutation.dbMutationPerformed === false &&
        hermesMutation.providerDispatchCalled === false &&
        hermesMutation.shareSessionCreated === false &&
        hermesMutation.ontologyPublicationPerformed === false,
      "Hermes reviewer UI evidence must remain non-mutating and non-publishing.",
    ),
    check(
      "hermes_review_authority_boundaries_open",
      hermesBoundaries.exactSavedShareVerdict === "MISSING_EVIDENCE" &&
        hermesBoundaries.llmWikiPublication === "APPROVAL_GATED" &&
        hermesBoundaries.supabaseRlsLaunchIsolation === "APPROVAL_GATED",
      "Hermes reviewer UI evidence must not close exact Share, LLM Wiki publication, or RLS launch isolation.",
    ),
    check(
      "wiki_no_executable_publication_surface",
      publicationSurface.publicationRpcCallHits.length === 0 &&
        publicationSurface.publicationSqlFunctionHits.length === 0 &&
        publicationSurface.publicationLedgerMigrationHits.length === 0 &&
        publicationSurface.publicationRoutePaths.length === 0,
      "Executable publication RPC, migration, ledger, or route surface exists before approval.",
    ),
    check("northstar_rls_gate_approval_gated", gateState(northstarReport, "supabase_rls_launch_isolation") === "approval_gated", "North Star RLS gate must remain approval_gated."),
    check("northstar_wiki_gate_approval_gated", gateState(northstarReport, "llm_wiki_publication") === "approval_gated", "North Star LLM Wiki gate must remain approval_gated."),
  ];

  const failedChecks = checks.filter((item) => !item.passed);
  const inputs = {
    ...REQUIRED_FILES,
    northstarReport: northstarReportPath,
  };
  const artifactIntegrityRows = Object.values(inputs).map((relativePath) => artifactIntegrity(root, relativePath));
  return {
    schemaVersion: "safeclaw-rls-llm-wiki-approval-preflight/v1",
    generatedAt: new Date().toISOString(),
    sourceSha: currentHead(root),
    overall: failedChecks.length === 0 ? "approval_ready_open" : "blocked_preflight_failed",
    launchReadiness: false,
    dbMutationPerformed: false,
    networkOpened: false,
    schemaMutationAuthorized: false,
    approvalRequired: true,
    approvalsNeeded: [
      "authoritative_supabase_project_and_secret_free_catalog_snapshot",
      "disposable_two_tenant_ab_negative_matrix",
      "storage_objects_cross_tenant_isolation",
      "service_role_route_idor_and_state_invariance",
      "llm_wiki_publication_ddl_rpc_and_grant_approval",
      "publication_atomicity_idempotency_rollback_and_leak_tests",
    ],
    forbiddenClaims: [
      "RLS launch isolation proven",
      "LLM Wiki publication available",
      "Hermes or an LLM can publish ontology candidates directly",
      "production migration approved",
      "service-role routes are safe because table RLS exists",
    ],
    inputs,
    artifactIntegrity: artifactIntegrityRows,
    hermesReviewAuthorityUi: {
      verdict: hermesReviewAuthorityUi.verdict ?? null,
      sourceHead: hermesReviewAuthorityUi.sourceHead ?? null,
      productCommit: hermesReviewAuthorityUi.productCommit ?? null,
      productionCommit: hermesReviewAuthorityUi.productionCommit ?? null,
      liveViewportCount: hermesAfterLive.viewportCount ?? null,
      livePassedCount: hermesAfterLive.passedCount ?? null,
      authorityOrder: hermesAuthority.sourceOrder ?? [],
      humanReviewRequired: hermesAuthority.humanReviewRequired === true,
      machineEvidenceReplacesHumanReview: hermesAuthority.machineEvidenceReplacesHumanReview === true,
      exactSavedShareVerdict: hermesBoundaries.exactSavedShareVerdict ?? null,
      llmWikiPublication: hermesBoundaries.llmWikiPublication ?? null,
      supabaseRlsLaunchIsolation: hermesBoundaries.supabaseRlsLaunchIsolation ?? null,
    },
    publicationSurfaceInventory: publicationSurface,
    checks,
    failedCheckIds: failedChecks.map((item) => item.id),
  };
}

function renderMarkdown(report) {
  const failed = report.failedCheckIds ?? [];
  const approvals = report.approvalsNeeded ?? [];
  const lines = [
    "# RLS / LLM Wiki Approval Preflight",
    "",
    `Generated: \`${report.generatedAt}\``,
    `Source SHA: \`${report.sourceSha ?? "unknown"}\``,
    `Overall: \`${report.overall}\``,
    `Launch readiness: \`${report.launchReadiness}\``,
    `DB mutation performed: \`${report.dbMutationPerformed}\``,
    `Network opened: \`${report.networkOpened}\``,
    "",
    "## Verdict",
    "",
    report.overall === "approval_ready_open"
      ? "The approval packet is internally ready for operator review, but launch readiness remains false until approved live catalog, tenant A/B, Storage, service-role, and publication RPC gates are executed."
      : "The approval packet is not ready for operator review because at least one preflight check failed.",
    "",
    "## Failed Checks",
    "",
    failed.length === 0 ? "- None" : failed.map((id) => `- ${id}`).join("\n"),
    "",
    "## Required Approvals Still Open",
    "",
    ...approvals.map((item) => `- ${item}`),
    "",
    "## Hermes Reviewer Authority UI",
    "",
    `- Verdict: \`${report.hermesReviewAuthorityUi?.verdict ?? "missing"}\``,
    `- Live viewports: \`${report.hermesReviewAuthorityUi?.livePassedCount ?? 0}/${report.hermesReviewAuthorityUi?.liveViewportCount ?? 0}\``,
    `- Authority order: \`${report.hermesReviewAuthorityUi?.authorityOrder?.join(" -> ") || "missing"}\``,
    `- Human review required: \`${report.hermesReviewAuthorityUi?.humanReviewRequired === true}\``,
    `- Machine evidence replaces human review: \`${report.hermesReviewAuthorityUi?.machineEvidenceReplacesHumanReview === true}\``,
    `- Exact saved Share: \`${report.hermesReviewAuthorityUi?.exactSavedShareVerdict ?? "MISSING_EVIDENCE"}\``,
    `- LLM Wiki / RLS: \`${report.hermesReviewAuthorityUi?.llmWikiPublication ?? "APPROVAL_GATED"}\` / \`${report.hermesReviewAuthorityUi?.supabaseRlsLaunchIsolation ?? "APPROVAL_GATED"}\``,
    "",
    "## Checks",
    "",
    "| Check | Result | Message |",
    "| --- | --- | --- |",
    ...report.checks.map((item) => `| \`${item.id}\` | ${item.passed ? "PASS" : "FAIL"} | ${item.message.replaceAll("|", "\\|")} |`),
    "",
    "## Non-Mutation Contract",
    "",
    "- No Supabase connection is opened by this script.",
    "- No SQL, migration, RPC, schema, storage, ontology, or tenant-data mutation is executed.",
    "- This artifact is an approval preflight only, not a launch proof.",
    "",
  ];
  return `${lines.join("\n")}\n`;
}

function writeReports(outputDir, report) {
  mkdirSync(outputDir, { recursive: true });
  writeFileSync(resolve(outputDir, "report.json"), `${JSON.stringify(report, null, 2)}\n`);
  writeFileSync(resolve(outputDir, "report.md"), renderMarkdown(report));
}

async function main() {
  const args = parseArgs(process.argv);
  const root = resolve(args.root);
  const output = resolve(root, args.output);
  const report = buildPreflight({ root });
  writeReports(output, report);
  process.stdout.write(`${JSON.stringify({ output, overall: report.overall, failedCheckIds: report.failedCheckIds }, null, 2)}\n`);
  if (report.overall !== "approval_ready_open") process.exitCode = 1;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.stack : String(error)}\n`);
    process.exitCode = 1;
  });
}

export { buildPreflight, renderMarkdown };
