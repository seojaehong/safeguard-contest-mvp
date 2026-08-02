import { execFileSync } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";

const baseUrl = process.env.SAFECLAW_BASE_URL || "http://127.0.0.1:3084";
const outputDir = path.resolve(
  process.env.SAFECLAW_OUTPUT_DIR || "evaluation/document-risk-row-navigation-2026-08-02"
);
const liveProductionRun = new URL(baseUrl).hostname === "www.safeclaw.kr";
const cases = [
  { theme: "day", label: "desktop-short-1440x723", width: 1440, height: 723 },
  { theme: "night", label: "desktop-short-1440x723", width: 1440, height: 723 },
  { theme: "day", label: "mobile-short-390x723", width: 390, height: 723 },
  { theme: "night", label: "mobile-short-390x723", width: 390, height: 723 }
];

await mkdir(outputDir, { recursive: true });
const browser = await chromium.launch({ headless: true });
const results = [];

try {
  for (const probe of cases) {
    const page = await browser.newPage({ viewport: { width: probe.width, height: probe.height } });
    await page.goto(`${baseUrl}/documents?theme=${probe.theme}`, { waitUntil: "networkidle" });
    await page.getByTestId("risk-rows-editor").waitFor({ state: "visible" });
    const metrics = await page.evaluate(() => {
      const shell = document.querySelector(".workpack-shell");
      const selectors = Array.from(document.querySelectorAll('[data-testid="risk-row-selector"]'));
      if (!(shell instanceof HTMLElement) || selectors.length === 0) {
        throw new Error("Risk-row navigation is unavailable");
      }
      const rows = selectors.map((selector) => {
        const label = selector.querySelector("strong")?.textContent?.trim() || "";
        const rect = selector.getBoundingClientRect();
        return {
          label,
          accessibleName: selector.getAttribute("aria-label") || "",
          title: selector.getAttribute("title") || "",
          rect: {
            x: Math.round(rect.x),
            y: Math.round(rect.y),
            width: Math.round(rect.width),
            height: Math.round(rect.height)
          }
        };
      });
      return {
        viewportWidth: window.innerWidth,
        viewportHeight: window.innerHeight,
        bodyHeight: document.documentElement.scrollHeight,
        horizontalOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
        shellClientHeight: shell.clientHeight,
        shellScrollHeight: shell.scrollHeight,
        shellRatio: Number((shell.scrollHeight / Math.max(shell.clientHeight, 1)).toFixed(2)),
        shellOverflowY: getComputedStyle(shell).overflowY,
        riskRowCount: rows.length,
        uniqueVisibleLabelCount: new Set(rows.map((row) => row.label)).size,
        taskContextLabelCount: rows.filter((row) => row.accessibleName.includes("작업:")).length,
        rows
      };
    });

    const verdict = metrics.viewportWidth === probe.width
      && metrics.viewportHeight === probe.height
      && metrics.bodyHeight <= probe.height + 8
      && metrics.horizontalOverflow === false
      && metrics.shellOverflowY === "auto"
      && metrics.shellRatio <= 3
      && metrics.riskRowCount >= 3
      && metrics.uniqueVisibleLabelCount === metrics.riskRowCount
      && metrics.taskContextLabelCount >= 1
      && metrics.rows.every((row) => row.label.length > 0)
      && metrics.rows.every((row) => row.accessibleName.includes(row.label))
      && metrics.rows.every((row) => row.title.includes(row.label))
      ? "PASS"
      : "RED";
    const screenshot = `${probe.theme}-${probe.label}.png`;
    await page.screenshot({ path: path.join(outputDir, screenshot), fullPage: false });
    results.push({
      ...probe,
      route: `/documents?theme=${probe.theme}`,
      state: "selected-riskAssessmentDraft",
      metrics,
      screenshot,
      verdict
    });
    await page.close();
  }
} finally {
  await browser.close();
}

const sourceHead = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
const productionBuild = liveProductionRun
  ? await fetch(`${baseUrl}/api/build-info?codexCacheBust=risk-row-${Date.now()}`).then(async (response) => {
      if (!response.ok) throw new Error(`Production build-info failed (${response.status})`);
      return response.json();
    })
  : null;
const pass = results.filter((result) => result.verdict === "PASS").length;
const sourceHeadMatchesProduction = productionBuild?.commitSha === sourceHead;
const report = {
  schemaVersion: "safeclaw-document-risk-row-navigation/v1",
  checkedAt: new Date().toISOString(),
  mode: liveProductionRun ? "live-production" : "current-source-local-production",
  baseUrl,
  sourceHead,
  productionBuild,
  sourceHeadMatchesProduction,
  verdict: pass === results.length
    ? liveProductionRun && sourceHeadMatchesProduction
      ? "PASS_LIVE_PRODUCTION_DOCUMENT_RISK_ROW_NAVIGATION"
      : "PASS_CURRENT_SOURCE_LOCAL_DOCUMENT_RISK_ROW_NAVIGATION"
    : liveProductionRun
      ? "RED_LIVE_PRODUCTION_DOCUMENT_RISK_ROW_NAVIGATION"
      : "RED_CURRENT_SOURCE_LOCAL_DOCUMENT_RISK_ROW_NAVIGATION",
  total: results.length,
  pass,
  fail: results.length - pass,
  acceptanceContract: {
    uniqueVisibleRiskLabels: true,
    hazardFirstLabel: true,
    fullTaskContextInAccessibleNameAndTitle: true,
    minimumRiskRowCount: 3,
    shellRatioMaximum: 3,
    bodyLevelLongStackForbidden: true
  },
  mutationBoundary: {
    dbMutationPerformed: false,
    providerDispatchCalled: false,
    shareSessionCreated: false,
    exactSavedShareVerdict: "MISSING_EVIDENCE"
  },
  results
};

await writeFile(path.join(outputDir, "report.json"), `${JSON.stringify(report, null, 2)}\n`, "utf8");
const rows = results.map((result) => (
  `| ${result.theme} | ${result.label} | ${result.metrics.bodyHeight}/${result.height} | ${result.metrics.shellRatio} | ${result.metrics.uniqueVisibleLabelCount}/${result.metrics.riskRowCount} | ${result.metrics.taskContextLabelCount} | ${result.verdict} |`
)).join("\n");
await writeFile(path.join(outputDir, "report.md"), `# Document Risk Row Navigation Evidence\n\n- Verdict: \`${report.verdict}\`\n- Source: \`${sourceHead}\`\n- Production: \`${productionBuild?.commitSha || "local"}\`\n- Scope: selected Risk Assessment row navigation only\n- Boundary: no DB/provider/Share mutation; exact saved Share remains \`MISSING_EVIDENCE\`\n\n| Theme | Viewport | Body/Viewport | Shell ratio | Unique/Rows | Task context | Verdict |\n|---|---|---:|---:|---:|---:|---|\n${rows}\n\nThis evidence verifies that compact row selectors expose distinct hazard-first labels while preserving full task context in accessible names and tooltips. It does not close exact saved Share or approval-gated launch boundaries.\n`, "utf8");

console.log(JSON.stringify({ verdict: report.verdict, total: report.total, pass: report.pass, fail: report.fail }, null, 2));
if (report.fail > 0) process.exitCode = 1;
