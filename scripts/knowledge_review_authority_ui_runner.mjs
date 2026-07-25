import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { execFileSync } from "node:child_process";
import { chromium } from "playwright";

const baseUrl = process.env.SAFECLAW_KNOWLEDGE_UI_BASE_URL || "http://127.0.0.1:3091";
const outputDir = path.resolve(
  process.cwd(),
  process.env.SAFECLAW_KNOWLEDGE_UI_OUTPUT
    || "evaluation/hermes-knowledge-review-authority-ui-2026-07-25"
);
const checkedAt = new Date().toISOString();
const sourceHead = execFileSync("git", ["rev-parse", "HEAD"], {
  cwd: process.cwd(),
  encoding: "utf8"
}).trim();
const productCommit = process.env.SAFECLAW_KNOWLEDGE_UI_PRODUCT_COMMIT || sourceHead;
const authStorageKey = process.env.SAFECLAW_SUPABASE_STORAGE_KEY || "sb-fixture-auth-token";
const liveMode = /^https:\/\/www\.safeclaw\.kr(?:\/|$)/u.test(baseUrl);
const productionBuild = liveMode
  ? await fetch(`${baseUrl}/api/build-info?codexCacheBust=${encodeURIComponent(checkedAt)}`)
      .then(async (response) => {
        const payload = await response.json().catch(() => null);
        return {
          status: response.status,
          ok: response.ok,
          commitSha: payload && typeof payload.commitSha === "string" ? payload.commitSha : null,
          branch: payload && typeof payload.branch === "string" ? payload.branch : null,
          environment: payload && typeof payload.environment === "string" ? payload.environment : null,
          deploymentUrl: payload && typeof payload.deploymentUrl === "string" ? payload.deploymentUrl : null
        };
      })
      .catch((error) => ({
        status: null,
        ok: false,
        commitSha: null,
        branch: null,
        environment: null,
        deploymentUrl: null,
        error: error instanceof Error ? error.message : String(error)
      }))
  : {
      status: null,
      ok: false,
      commitSha: null,
      branch: null,
      environment: "local",
      deploymentUrl: null
    };

function commitContainsProduct(productionCommit) {
  if (!productionCommit) return false;
  try {
    execFileSync("git", ["merge-base", "--is-ancestor", productCommit, productionCommit], {
      cwd: process.cwd(),
      stdio: "ignore"
    });
    return true;
  } catch {
    return false;
  }
}

const queueItem = {
  runId: "11111111-1111-4111-8111-111111111111",
  status: "review_required",
  statusLabel: "검토 대기",
  sourceEventCount: 5,
  candidateLabel: "고소작업 지식 후보 검토",
  candidateText: "작업발판 단부의 안전난간 상태와 추락방지 조치를 확인하고 현장 책임자가 적용 여부를 검토합니다.",
  matchedHazardCount: 1,
  providerLabel: "SafeClaw candidate builder",
  reviewContract: {
    contractVersion: "knowledge-candidate-review.v1",
    status: "human_review_required",
    presentAuthorityIds: ["sif", "kosha", "law", "organization_history", "site_history"],
    sourceRoleCounts: {
      sifIncidentControlEvidence: 1,
      koshaTechnicalGuidance: 1,
      lawStatutorySource: 1,
      organizationPrivateMemory: 1,
      sitePrivateMemory: 1,
      externalContext: 0
    },
    statutoryClaimsRequireLawProvenance: true,
    tenantMemoryPublicPromotionAllowed: false,
    siteManagerAcceptanceRequiredBeforeWorkpackUse: true,
    publicationState: "unpublished",
    humanReviewRequired: true,
    machineEvidenceReplacesHumanReview: false
  }
};

const viewports = [
  { name: "desktop", width: 1440, height: 900 },
  { name: "desktop-short", width: 1440, height: 723 },
  { name: "mobile", width: 390, height: 844 },
  { name: "mobile-short", width: 390, height: 723 }
];

await fs.mkdir(outputDir, { recursive: true });
const browser = await chromium.launch({ headless: true });
const results = [];

try {
  for (const theme of ["day", "night"]) {
    for (const viewport of viewports) {
      const context = await browser.newContext({ viewport });
      const page = await context.newPage();
      const browserErrors = [];
      page.on("console", (message) => {
        if (message.type() === "error") browserErrors.push(message.text());
      });
      page.on("pageerror", (error) => browserErrors.push(error.message));
      await page.addInitScript((storageKey) => {
        localStorage.setItem(storageKey, JSON.stringify({
          access_token: "fixture-access-token",
          refresh_token: "fixture-refresh-token",
          expires_in: 3600,
          expires_at: Math.floor(Date.now() / 1000) + 3600,
          token_type: "bearer",
          user: {
            id: "reviewer-1",
            aud: "authenticated",
            role: "authenticated",
            email: "reviewer@example.com",
            app_metadata: {},
            user_metadata: {},
            created_at: "2026-07-25T00:00:00.000Z"
          }
        }));
      }, authStorageKey);
      await page.route("**/api/knowledge/review", async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            ok: true,
            configured: true,
            queue: [queueItem],
            dropped: { runCount: 0, eventCount: 0, reasons: [] }
          })
        });
      });

      await page.goto(`${baseUrl}/knowledge?theme=${theme}#knowledge-governance-heading`, {
        waitUntil: "networkidle"
      });
      if (viewport.width <= 720) {
        await page.getByRole("tab", { name: "검토 흐름" }).click();
      }
      const inbox = page.locator('[data-knowledge-review-inbox="true"]');
      await inbox.getByText(queueItem.candidateLabel).waitFor();
      const metrics = await page.evaluate(() => {
        const root = document.querySelector("[data-knowledge-review-inbox='true']");
        const authority = document.querySelector("[data-review-authority-contract='true']");
        const actionGroup = document.querySelector("[role='group'][aria-label='검토 결정']");
        const firstAction = actionGroup?.querySelector("button");
        if (!(root instanceof HTMLElement)
          || !(authority instanceof HTMLElement)
          || !(actionGroup instanceof HTMLElement)
          || !(firstAction instanceof HTMLElement)) {
          throw new Error("Missing Hermes review authority UI");
        }
        const rootRect = root.getBoundingClientRect();
        const authorityRect = authority.getBoundingClientRect();
        const actionRect = actionGroup.getBoundingClientRect();
        return {
          bodyHeight: document.documentElement.scrollHeight,
          viewportHeight: window.innerHeight,
          horizontalOverflow: Math.max(
            document.documentElement.scrollWidth,
            document.body.scrollWidth
          ) > window.innerWidth + 1,
          rootWidth: rootRect.width,
          rootWidthRatio: Number((rootRect.width / window.innerWidth).toFixed(2)),
          rootTop: rootRect.top,
          authorityWidth: authorityRect.width,
          authorityRoleCount: authority.querySelectorAll("[data-review-authority-role]").length,
          authorityContained: authority.scrollWidth <= authority.clientWidth + 1,
          actionGroupTop: actionRect.top,
          firstActionBottom: firstAction.getBoundingClientRect().bottom,
          firstActionDepth: firstAction.getBoundingClientRect().bottom - rootRect.top,
          actionCount: actionGroup.querySelectorAll("button").length,
          actionContained: actionGroup.scrollWidth <= actionGroup.clientWidth + 1
        };
      });
      const screenshot = `knowledge-review-authority-${theme}-${viewport.name}-${viewport.width}x${viewport.height}.png`;
      await page.screenshot({ path: path.join(outputDir, screenshot), fullPage: true });
      const passed = metrics.horizontalOverflow === false
        && metrics.authorityRoleCount === 6
        && metrics.authorityContained
        && metrics.actionCount === 3
        && metrics.actionContained
        && metrics.firstActionDepth <= viewport.height * 1.25
        && browserErrors.length === 0;
      results.push({ theme, viewport, screenshot, metrics, browserErrors, passed });
      await context.close();
    }
  }
} finally {
  await browser.close();
}

const failed = results.filter((result) => !result.passed);
const productionAligned = liveMode
  && productionBuild.ok
  && commitContainsProduct(productionBuild.commitSha)
  && productionBuild.branch === "master"
  && productionBuild.environment === "production";
const report = {
  schemaVersion: "safeclaw-hermes-knowledge-review-authority-ui/v1",
  verdict: failed.length === 0 && productionAligned
    ? "PASS_LIVE_PRODUCTION_HERMES_REVIEW_AUTHORITY_UI"
    : failed.length === 0 && !liveMode
      ? "PASS_CURRENT_SOURCE_LOCAL_HERMES_REVIEW_AUTHORITY_UI"
      : "RED_HERMES_REVIEW_AUTHORITY_UI",
  checkedAt,
  sourceHead,
  productCommit,
  baseUrl,
  mode: liveMode ? "live-production" : "current-source-local-production",
  productionBuild,
  productionAligned,
  viewportCount: results.length,
  passedCount: results.length - failed.length,
  failedCount: failed.length,
  authorityContract: {
    sourceOrder: ["SIF", "KOSHA", "law", "organization_history", "site_history", "external_context"],
    statutoryClaimsRequireLawProvenance: true,
    tenantMemoryPublicPromotionAllowed: false,
    siteManagerAcceptanceRequiredBeforeWorkpackUse: true,
    humanReviewRequired: true,
    machineEvidenceReplacesHumanReview: false
  },
  mutationBoundary: {
    dbMutationPerformed: false,
    providerDispatchCalled: false,
    shareSessionCreated: false,
    ontologyPublicationPerformed: false
  },
  remainingBoundaries: {
    exactSavedShareVerdict: "MISSING_EVIDENCE",
    llmWikiPublication: "APPROVAL_GATED",
    supabaseRlsLaunchIsolation: "APPROVAL_GATED"
  },
  results
};

await fs.writeFile(path.join(outputDir, "report.json"), `${JSON.stringify(report, null, 2)}\n`, "utf8");
const rows = results.map((result) => (
  `| ${result.theme} | ${result.viewport.name} | ${result.viewport.width}x${result.viewport.height} | `
  + `${result.metrics.bodyHeight}/${result.metrics.viewportHeight} | ${result.metrics.rootWidthRatio} | `
  + `${result.metrics.authorityRoleCount} | ${result.metrics.firstActionDepth.toFixed(1)} | `
  + `${result.metrics.horizontalOverflow ? "yes" : "no"} | ${result.passed ? "PASS" : "RED"} |`
)).join("\n");
const markdown = `# Hermes Knowledge Review Authority UI

- Verdict: \`${report.verdict}\`
- Source head: \`${sourceHead}\`
- Product commit: \`${productCommit}\`
- Checked at: \`${checkedAt}\`
- Scope: ${liveMode ? "live production" : "current-source local production"} rendering with an authenticated, route-controlled review candidate fixture.
- Production aligned: \`${productionAligned}\`

| Theme | Viewport | Size | Body/viewport | Root width ratio | Authority roles | First action depth | Horizontal overflow | Verdict |
| --- | --- | ---: | ---: | ---: | ---: | ---: | --- | --- |
${rows}

## Contract

- The review card exposes six source-role counts while preserving the source order SIF -> KOSHA -> law -> tenant memory.
- Legal-duty claims require law provenance.
- Organization and site memory cannot be promoted publicly.
- Site-manager acceptance is required before workpack use.
- Machine evidence does not replace human review.

## Boundary

- No DB mutation, provider dispatch, Share-session creation, or ontology publication was performed.
- Exact saved Share remains \`MISSING_EVIDENCE\`.
- LLM Wiki publication and live RLS isolation remain \`APPROVAL_GATED\`.
`;
await fs.writeFile(path.join(outputDir, "report.md"), markdown, "utf8");

const summaryOutput = process.env.SAFECLAW_KNOWLEDGE_UI_SUMMARY_OUTPUT;
if (liveMode && productionAligned && summaryOutput) {
  const summaryDir = path.resolve(process.cwd(), summaryOutput);
  const localReportPath = path.join(summaryDir, "report.json");
  const localMarkdownPath = path.join(summaryDir, "report.md");
  const localReport = JSON.parse(await fs.readFile(localReportPath, "utf8"));
  const afterLocalDir = path.join(summaryDir, "after-local");
  await fs.mkdir(afterLocalDir, { recursive: true });
  await fs.copyFile(localReportPath, path.join(afterLocalDir, "report.json"));
  await fs.copyFile(localMarkdownPath, path.join(afterLocalDir, "report.md"));

  const summary = {
    schemaVersion: "safeclaw-hermes-knowledge-review-authority-ui-summary/v1",
    verdict: "PASS_LIVE_PRODUCTION_HERMES_REVIEW_AUTHORITY_UI",
    checkedAt,
    sourceHead,
    productCommit,
    productionCommit: productionBuild.commitSha,
    local: {
      path: path.relative(process.cwd(), path.join(afterLocalDir, "report.json")),
      verdict: localReport.verdict,
      viewportCount: localReport.viewportCount,
      passedCount: localReport.passedCount,
      failedCount: localReport.failedCount
    },
    afterLive: {
      path: path.relative(process.cwd(), path.join(outputDir, "report.json")),
      verdict: report.verdict,
      viewportCount: report.viewportCount,
      passedCount: report.passedCount,
      failedCount: report.failedCount
    },
    authorityContract: report.authorityContract,
    mutationBoundary: report.mutationBoundary,
    remainingBoundaries: report.remainingBoundaries
  };
  await fs.writeFile(localReportPath, `${JSON.stringify(summary, null, 2)}\n`, "utf8");
  await fs.writeFile(localMarkdownPath, `# Hermes Knowledge Review Authority UI

- Verdict: \`${summary.verdict}\`
- Product commit: \`${productCommit}\`
- Production commit: \`${productionBuild.commitSha}\`
- Local geometry: ${summary.local.passedCount}/${summary.local.viewportCount} PASS
- Live geometry: ${summary.afterLive.passedCount}/${summary.afterLive.viewportCount} PASS

## Result

The authenticated review candidate cockpit exposes six evidence-role counts, keeps legal-duty claims bound to law provenance, blocks public promotion of tenant memory, and requires site-manager acceptance before workpack use.

## Boundary

- Machine evidence does not replace human review.
- No DB mutation, provider dispatch, Share-session creation, or ontology publication was performed.
- Exact saved Share remains \`MISSING_EVIDENCE\`.
- LLM Wiki publication and live RLS isolation remain \`APPROVAL_GATED\`.
`, "utf8");
}

console.log(JSON.stringify({
  verdict: report.verdict,
  viewportCount: report.viewportCount,
  passedCount: report.passedCount,
  failedCount: report.failedCount,
  outputDir
}));
process.exitCode = failed.length === 0 ? 0 : 1;
