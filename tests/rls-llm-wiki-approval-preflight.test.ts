import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { describe, expect, it } from "vitest";

const SCRIPT_PATH = resolve(process.cwd(), "scripts/rls_llm_wiki_approval_preflight.mjs");

function writeJson(root: string, relativePath: string, value: unknown): void {
  const path = join(root, relativePath);
  mkdirSync(resolve(path, ".."), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
}

function writeText(root: string, relativePath: string, value: string): void {
  const path = join(root, relativePath);
  mkdirSync(resolve(path, ".."), { recursive: true });
  writeFileSync(path, value);
}

function fixtureRoot(): string {
  const root = mkdtempSync(join(tmpdir(), "safeclaw-approval-preflight-"));
  execFileSync("git", ["init"], { cwd: root, stdio: "ignore" });
  execFileSync("git", ["config", "user.email", "codex@example.test"], { cwd: root, stdio: "ignore" });
  execFileSync("git", ["config", "user.name", "Codex"], { cwd: root, stdio: "ignore" });
  writeJson(root, "evaluation/supabase-rls-approval-2026-07-17/report.json", {
    status: "approval_required",
    launchIsolationProven: false,
    mutation: { database: false, schema: false, data: false },
    liveHeadEvidence: { policyCatalogVerified: false },
  });
  writeText(root, "evaluation/supabase-rls-approval-2026-07-17/approval-checklist.md", [
    "## A. Authoritative Target",
    "## B. Required Read-Only Catalog SQL",
    "pg_class",
    "pg_policies",
    "information_schema.role_table_grants",
    "storage.objects",
    "## C. Disposable Tenant A/B Contract",
    "## D. Service-Role And Storage Contract",
    "## E. Completion Gate",
  ].join("\n"));
  writeJson(root, "evaluation/llm-wiki-rls-approval-2026-07-17/report.json", {
    verdict: "red_approval_required",
    launchProven: false,
    databaseConnected: false,
    databaseMutationPerformed: false,
    migrationAdded: false,
    publicationPerformed: false,
  });
  writeText(root, "evaluation/llm-wiki-rls-approval-2026-07-17/report.md", "Until all blockers close, publication remains unavailable.\n");
  writeText(root, "evaluation/llm-wiki-rls-approval-2026-07-17/proposed-non-executable-publication-design.sql.txt", "-- non-executable design only, not a migration\n");
  writeJson(root, "evaluation/northstar-open-gates-current-2026-07-19/report.json", {
    gates: {
      supabase_rls_launch_isolation: { status: "approval_gated" },
      llm_wiki_publication: { status: "approval_gated" },
    },
  });
  writeText(root, "scripts/supabase_tenant_isolation_manifest.mjs", "export const TENANT_ISOLATION_MANIFEST = { version: 3, scenarios: [] };\n");
  writeText(root, "scripts/supabase_tenant_isolation_harness.mjs", "export const marker = 'blocked_unreviewed_live_adapter'; export const launch = 'launchProven: false';\n");
  writeText(root, "lib/knowledge-governance.ts", [
    'export const candidate = { owner: "hermes_or_llm", publicationState: "unpublished", publishAllowed: false };',
    'export const KNOWLEDGE_REVIEW_AUTHORITY_ORDER = ["sif", "kosha", "law", "organization_history", "site_history", "external_context"];',
    'export const review = { contractVersion: "knowledge-candidate-review.v1", status: "human_review_required", sifControlsAreNonStatutoryEvidence: true, koshaGuidanceIsNonStatutory: true, statutoryClaimsRequireLawProvenance: true, tenantMemoryPublicPromotionAllowed: false, siteManagerAcceptanceRequiredBeforeWorkpackUse: true, machineEvidenceReplacesHumanReview: false };',
  ].join("\n"));
  writeText(root, "lib/knowledge-candidate-route.ts", [
    'export const message = "DB 저장과 ontology publish는 수행하지 않았습니다.";',
    'export const prompt = "SIF 재해·통제 근거 → KOSHA 기술지침 → 현행 법령\\nSIF와 KOSHA는 법적 의무가 아니며\\n문서팩 적용 전 현장 책임자 확인";',
    "export const response = { reviewContract, };",
  ].join("\n"));
  writeText(root, "app/api/knowledge/review/route.ts", 'export const boundary = { publicationState: "unpublished", ontologyPublished: false };\n');
  writeJson(root, "evaluation/hermes-knowledge-review-selected-workbench-2026-08-14/report.json", {
    verdict: "PASS_LIVE_PRODUCTION_HERMES_REVIEW_AUTHORITY_UI",
    sourceHead: null,
    productCommit: null,
    productionCommit: null,
    afterLive: {
      verdict: "PASS_LIVE_PRODUCTION_HERMES_REVIEW_AUTHORITY_UI",
      viewportCount: 8,
      passedCount: 8,
      failedCount: 0,
    },
    authorityContract: {
      sourceOrder: ["SIF", "KOSHA", "law", "organization_history", "site_history", "external_context"],
      statutoryClaimsRequireLawProvenance: true,
      tenantMemoryPublicPromotionAllowed: false,
      siteManagerAcceptanceRequiredBeforeWorkpackUse: true,
      humanReviewRequired: true,
      machineEvidenceReplacesHumanReview: false,
    },
    workbenchContract: {
      candidateCount: 3,
      selectedCandidateCount: 1,
      selectedBodyCount: 1,
      desktopColumns: 2,
      mobileColumns: 1,
      candidateBodyInternalScroll: true,
    },
    mutationBoundary: {
      dbMutationPerformed: false,
      providerDispatchCalled: false,
      shareSessionCreated: false,
      ontologyPublicationPerformed: false,
    },
    remainingBoundaries: {
      exactSavedShareVerdict: "MISSING_EVIDENCE",
      llmWikiPublication: "APPROVAL_GATED",
      supabaseRlsLaunchIsolation: "APPROVAL_GATED",
    },
  });
  writeJson(root, "evaluation/hermes-knowledge-review-evidence-inspector-2026-08-14/report.json", {
    verdict: "PASS_LIVE_PRODUCTION_HERMES_REVIEW_EVIDENCE_INSPECTOR",
    sourceHead: null,
    productCommit: null,
    productionCommit: null,
    liveAfterDeploymentRequired: false,
    afterLive: {
      verdict: "PASS_LIVE_PRODUCTION_HERMES_REVIEW_EVIDENCE_INSPECTOR",
      viewportCount: 8,
      passedCount: 8,
      failedCount: 0,
      productionAligned: true,
      browserErrorCount: 0,
    },
    evidenceContract: {
      itemLimit: 20,
      fixtureItemCount: 5,
      authorityCountsMatchReviewContract: true,
      desktopCandidateAndEvidenceMounted: true,
      desktopEvidenceColumns: 2,
      mobileMountedPaneCount: 1,
      mobileCandidateEvidenceSegmentedControl: true,
      publicOfficialHttpsLinkCount: 3,
      privateEvidenceRawIdentityExposed: false,
      evidenceInternalScroll: true,
      horizontalOverflow: false,
    },
    verification: {
      focusedAndAdjacentTests: { files: 8, tests: 117, status: "PASS" },
      typecheck: "PASS",
      build: "PASS",
      staticPages: 28,
    },
    mutationBoundary: {
      dbMutationPerformed: false,
      providerDispatchCalled: false,
      shareSessionCreated: false,
      ontologyPublicationPerformed: false,
      vectorOrEmbeddingMutationPerformed: false,
      wikiPublicationPerformed: false,
      koshaRegistryMutationPerformed: false,
    },
    securityBoundary: {
      immutableOriginal18FindingBaselinePreserved: true,
      freshFullRepositoryScanRequired: true,
      securityComplete: false,
    },
    remainingBoundaries: {
      exactSavedShareVerdict: "MISSING_EVIDENCE",
      llmWikiPublication: "APPROVAL_GATED",
      supabaseRlsLaunchIsolation: "APPROVAL_GATED",
      providerDispatchPersistence: "APPROVAL_GATED",
    },
  });
  writeText(root, "supabase/migrations/008_safety_ontology.sql", "create table safety_ontology_nodes(id text primary key);\n");
  execFileSync("git", ["add", "."], { cwd: root, stdio: "ignore" });
  execFileSync("git", ["commit", "-m", "fixture"], { cwd: root, stdio: "ignore" });
  const productCommit = execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).trim();
  for (const relativePath of [
    "evaluation/hermes-knowledge-review-selected-workbench-2026-08-14/report.json",
    "evaluation/hermes-knowledge-review-evidence-inspector-2026-08-14/report.json",
  ]) {
    const absolutePath = join(root, relativePath);
    const report = JSON.parse(readFileSync(absolutePath, "utf8")) as {
      sourceHead: string | null;
      productCommit: string | null;
      productionCommit: string | null;
    };
    report.sourceHead = productCommit;
    report.productCommit = productCommit;
    report.productionCommit = productCommit;
    writeFileSync(absolutePath, `${JSON.stringify(report, null, 2)}\n`);
  }
  execFileSync("git", ["add", "."], { cwd: root, stdio: "ignore" });
  execFileSync("git", ["commit", "-m", "bind evidence"], { cwd: root, stdio: "ignore" });
  return root;
}

function runPreflight(root: string, output = "evaluation/out"): { readonly report: Record<string, unknown>; readonly stdout: string; readonly status: number | null } {
  const result = spawnSync(process.execPath, [SCRIPT_PATH, "--root", root, "--output", output], {
    cwd: process.cwd(),
    encoding: "utf8",
  });
  if (result.error) throw result.error;
  const report = JSON.parse(readFileSync(join(root, output, "report.json"), "utf8")) as Record<string, unknown>;
  return { report, stdout: result.stdout, status: result.status };
}

describe("RLS / LLM Wiki approval preflight", () => {
  it("writes the current approval packet to the current dated evidence directory by default", () => {
    const root = fixtureRoot();
    const result = spawnSync(process.execPath, [SCRIPT_PATH, "--root", root], {
      cwd: process.cwd(),
      encoding: "utf8",
    });

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("rls-llm-wiki-approval-preflight-current-2026-07-20");
    const report = JSON.parse(
      readFileSync(join(root, "evaluation/rls-llm-wiki-approval-preflight-current-2026-07-20/report.json"), "utf8"),
    ) as Record<string, unknown>;
    expect(report.overall).toBe("approval_ready_open");
    expect(report.dbMutationPerformed).toBe(false);
    expect(report.networkOpened).toBe(false);
  });

  it("emits an approval-ready-open packet without claiming launch readiness", () => {
    const root = fixtureRoot();
    const { report, stdout, status } = runPreflight(root);

    expect(status).toBe(0);
    expect(stdout).toContain("approval_ready_open");
    expect(report.overall).toBe("approval_ready_open");
    expect(report.launchReadiness).toBe(false);
    expect(report.dbMutationPerformed).toBe(false);
    expect(report.networkOpened).toBe(false);
    expect(report.schemaMutationAuthorized).toBe(false);
    expect(report.approvalRequired).toBe(true);
    expect(report.failedCheckIds).toEqual([]);
    expect(report.sourceSha).toEqual(expect.stringMatching(/^[0-9a-f]{40}$/u));
    expect(report.artifactIntegrity).toEqual(expect.arrayContaining([
      expect.objectContaining({
        path: "evaluation/supabase-rls-approval-2026-07-17/report.json",
        bytes: expect.any(Number),
        sha256: expect.stringMatching(/^[0-9a-f]{64}$/u),
      }),
      expect.objectContaining({
        path: "evaluation/llm-wiki-rls-approval-2026-07-17/report.json",
        bytes: expect.any(Number),
        sha256: expect.stringMatching(/^[0-9a-f]{64}$/u),
      }),
      expect.objectContaining({
        path: "evaluation/northstar-open-gates-current-2026-07-19/report.json",
        bytes: expect.any(Number),
        sha256: expect.stringMatching(/^[0-9a-f]{64}$/u),
      }),
      expect.objectContaining({
        path: "evaluation/hermes-knowledge-review-selected-workbench-2026-08-14/report.json",
        bytes: expect.any(Number),
        sha256: expect.stringMatching(/^[0-9a-f]{64}$/u),
      }),
      expect.objectContaining({
        path: "evaluation/hermes-knowledge-review-evidence-inspector-2026-08-14/report.json",
        bytes: expect.any(Number),
        sha256: expect.stringMatching(/^[0-9a-f]{64}$/u),
      }),
    ]));
    expect(report.approvalEvidenceBinding).toMatchObject({
      verified: true,
      packetDigest: expect.stringMatching(/^[0-9a-f]{64}$/u),
    });
    expect(JSON.stringify(report)).toContain("publication_ddl_rpc");
    expect(report.publicationSurfaceInventory).toMatchObject({
      publicationRpcCallHits: [],
      publicationSqlFunctionHits: [],
      publicationLedgerMigrationHits: [],
      publicationRoutePaths: [],
    });
    expect(report.hermesReviewAuthorityUi).toMatchObject({
      verdict: "PASS_LIVE_PRODUCTION_HERMES_REVIEW_AUTHORITY_UI",
      liveViewportCount: 8,
      livePassedCount: 8,
      candidateCount: 3,
      selectedCandidateCount: 1,
      selectedBodyCount: 1,
      desktopColumns: 2,
      mobileColumns: 1,
      candidateBodyInternalScroll: true,
      authorityOrder: ["SIF", "KOSHA", "law", "organization_history", "site_history", "external_context"],
      humanReviewRequired: true,
      machineEvidenceReplacesHumanReview: false,
      exactSavedShareVerdict: "MISSING_EVIDENCE",
      llmWikiPublication: "APPROVAL_GATED",
      supabaseRlsLaunchIsolation: "APPROVAL_GATED",
    });
    expect(report.hermesReviewEvidenceInspector).toMatchObject({
      verdict: "PASS_LIVE_PRODUCTION_HERMES_REVIEW_EVIDENCE_INSPECTOR",
      liveViewportCount: 8,
      livePassedCount: 8,
      productionAligned: true,
      itemLimit: 20,
      fixtureItemCount: 5,
      desktopEvidenceColumns: 2,
      mobileMountedPaneCount: 1,
      publicOfficialHttpsLinkCount: 3,
      privateEvidenceRawIdentityExposed: false,
      exactSavedShareVerdict: "MISSING_EVIDENCE",
      llmWikiPublication: "APPROVAL_GATED",
      supabaseRlsLaunchIsolation: "APPROVAL_GATED",
      providerDispatchPersistence: "APPROVAL_GATED",
    });
  });

  it("fails closed if a source packet claims RLS launch readiness", () => {
    const root = fixtureRoot();
    writeJson(root, "evaluation/supabase-rls-approval-2026-07-17/report.json", {
      status: "approval_required",
      launchIsolationProven: true,
      mutation: { database: false, schema: false, data: false },
      liveHeadEvidence: { policyCatalogVerified: false },
    });

    const { report, status } = runPreflight(root);
    expect(status).toBe(1);
    expect(report.overall).toBe("blocked_preflight_failed");
    const typedReport = report as {
      readonly failedCheckIds: readonly string[];
    };
    expect(typedReport.failedCheckIds).toContain("rls_launch_not_proven");
  });

  it("fails closed if the SQL companion moves under migrations or stops warning that it is non-executable", () => {
    const root = fixtureRoot();
    writeText(root, "evaluation/llm-wiki-rls-approval-2026-07-17/proposed-non-executable-publication-design.sql.txt", "create table unsafe_publication_attempts(id uuid);\n");

    const { report, status } = runPreflight(root);
    expect(status).toBe(1);
    expect(report.overall).toBe("blocked_preflight_failed");
    const typedReport = report as {
      readonly failedCheckIds: readonly string[];
    };
    expect(typedReport.failedCheckIds).toEqual(expect.arrayContaining([
      "wiki_sql_design_non_executable",
      "approval_inputs_match_current_head_and_digest_binding",
    ]));
  });

  it("fails closed when an executable wiki publication RPC migration appears", () => {
    const root = fixtureRoot();
    writeText(root, "supabase/migrations/099_publish_wiki.sql", [
      "create or replace function public.publish_reviewed_ontology()",
      "returns void language sql as $$ select null; $$;",
    ].join("\n"));

    const { report, status } = runPreflight(root);

    expect(status).toBe(1);
    expect(report.overall).toBe("blocked_preflight_failed");
    const typedReport = report as {
      readonly failedCheckIds: readonly string[];
      readonly publicationSurfaceInventory: {
        readonly publicationSqlFunctionHits: readonly string[];
      };
    };
    expect(typedReport.failedCheckIds).toContain("wiki_no_executable_publication_surface");
    expect(typedReport.publicationSurfaceInventory.publicationSqlFunctionHits).toEqual([
      "supabase/migrations/099_publish_wiki.sql",
    ]);
  });

  it("fails closed when Hermes candidate governance becomes publishing", () => {
    const root = fixtureRoot();
    writeText(root, "lib/knowledge-governance.ts", [
      'export const candidate = { owner: "hermes_or_llm", publicationState: "published", publishAllowed: true };',
    ].join("\n"));

    const { report, status } = runPreflight(root);

    expect(status).toBe(1);
    expect(report.overall).toBe("blocked_preflight_failed");
    const typedReport = report as {
      readonly failedCheckIds: readonly string[];
    };
    expect(typedReport.failedCheckIds).toContain("hermes_llm_candidate_stays_unpublished");
  });

  it("fails closed when the candidate route drops the reviewer authority contract", () => {
    const root = fixtureRoot();
    writeText(
      root,
      "lib/knowledge-candidate-route.ts",
      'export const message = "DB 저장과 ontology publish는 수행하지 않았습니다.";\n',
    );

    const { report, status } = runPreflight(root);

    expect(status).toBe(1);
    expect(report.overall).toBe("blocked_preflight_failed");
    const typedReport = report as {
      readonly failedCheckIds: readonly string[];
    };
    expect(typedReport.failedCheckIds).toContain("knowledge_candidate_prompt_authority_separation");
    expect(typedReport.failedCheckIds).not.toContain("knowledge_candidate_route_non_publishing");
  });

  it("fails closed when Hermes evidence mixes source and production commits", () => {
    const root = fixtureRoot();
    const reportPath = join(root, "evaluation/hermes-knowledge-review-evidence-inspector-2026-08-14/report.json");
    const evidence = JSON.parse(readFileSync(reportPath, "utf8")) as { productionCommit: string };
    evidence.productionCommit = "f".repeat(40);
    writeFileSync(reportPath, `${JSON.stringify(evidence, null, 2)}\n`);

    const { report, status } = runPreflight(root);
    expect(status).toBe(1);
    expect(report.overall).toBe("blocked_preflight_failed");
    expect(report.failedCheckIds).toEqual(expect.arrayContaining([
      "hermes_evidence_uses_one_source_live_commit",
      "approval_inputs_match_current_head_and_digest_binding",
    ]));
  });

  it("fails closed when Hermes reviewer evidence claims publication or RLS completion", () => {
    const root = fixtureRoot();
    const reportPath = "evaluation/hermes-knowledge-review-selected-workbench-2026-08-14/report.json";
    const report = JSON.parse(readFileSync(join(root, reportPath), "utf8")) as {
      remainingBoundaries: {
        exactSavedShareVerdict: string;
        llmWikiPublication: string;
        supabaseRlsLaunchIsolation: string;
      };
    };
    report.remainingBoundaries.exactSavedShareVerdict = "PASS";
    report.remainingBoundaries.llmWikiPublication = "PROVEN";
    report.remainingBoundaries.supabaseRlsLaunchIsolation = "PROVEN";
    writeJson(root, reportPath, report);

    const { report: resultReport, status } = runPreflight(root);

    expect(status).toBe(1);
    expect(resultReport.overall).toBe("blocked_preflight_failed");
    const typedReport = resultReport as {
      readonly failedCheckIds: readonly string[];
    };
    expect(typedReport.failedCheckIds).toContain("hermes_review_authority_boundaries_open");
  });

  it("fails closed when the Hermes evidence inspector overclaims publication or exposes private identity", () => {
    const root = fixtureRoot();
    const reportPath = "evaluation/hermes-knowledge-review-evidence-inspector-2026-08-14/report.json";
    const report = JSON.parse(readFileSync(join(root, reportPath), "utf8")) as {
      evidenceContract: { privateEvidenceRawIdentityExposed: boolean };
      remainingBoundaries: {
        exactSavedShareVerdict: string;
        llmWikiPublication: string;
        supabaseRlsLaunchIsolation: string;
        providerDispatchPersistence: string;
      };
    };
    report.evidenceContract.privateEvidenceRawIdentityExposed = true;
    report.remainingBoundaries.exactSavedShareVerdict = "PASS";
    report.remainingBoundaries.llmWikiPublication = "PROVEN";
    writeJson(root, reportPath, report);

    const { report: resultReport, status } = runPreflight(root);

    expect(status).toBe(1);
    expect(resultReport.overall).toBe("blocked_preflight_failed");
    const typedReport = resultReport as { readonly failedCheckIds: readonly string[] };
    expect(typedReport.failedCheckIds).toContain("hermes_review_evidence_inspector_contract");
    expect(typedReport.failedCheckIds).toContain("hermes_review_evidence_inspector_boundaries_open");
  });

  it("prefers the current northstar open-gate packet over the legacy dated packet", () => {
    const root = fixtureRoot();
    writeJson(root, "evaluation/northstar-open-gates-current-2026-07-19/report.json", {
      gates: {
        supabase_rls_launch_isolation: { status: "proven" },
        llm_wiki_publication: { status: "proven" },
      },
    });
    writeJson(root, "evaluation/northstar-open-gates-current/report.json", {
      gates: [
        { id: "supabase_rls_launch_isolation", state: "approval_gated" },
        { id: "llm_wiki_publication", state: "approval_gated" },
      ],
    });
    execFileSync("git", ["add", "."], { cwd: root, stdio: "ignore" });
    execFileSync("git", ["commit", "-m", "prefer current northstar"], { cwd: root, stdio: "ignore" });

    const { report, status } = runPreflight(root);

    expect(status).toBe(0);
    expect(report.overall).toBe("approval_ready_open");
    expect(report.inputs).toMatchObject({
      northstarReport: "evaluation/northstar-open-gates-current/report.json",
    });
  });
});
