import { execFileSync } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";

const baseUrl = process.env.SAFECLAW_BASE_URL || "http://127.0.0.1:3085";
const outputDir = path.resolve(
  process.env.SAFECLAW_OUTPUT_DIR || "evaluation/document-risk-row-mobile-order-2026-08-02"
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
      const tabs = document.querySelector('[role="tablist"][aria-label="위험 항목 선택"]');
      const panel = document.querySelector('[data-testid="risk-row-editor-row"]');
      const hazardField = document.querySelector('[aria-label="행 1 유해·위험요인"]');
      if (!shell || !tabs || !panel || !hazardField) {
        const missing = [
          !shell ? "shell" : "",
          !tabs ? "tabs" : "",
          !panel ? "panel" : "",
          !hazardField ? "hazardField" : ""
        ].filter(Boolean).join(",");
        throw new Error(`Risk-row mobile ordering targets are unavailable: ${missing}`);
      }
      const shellRect = shell.getBoundingClientRect();
      const tabsRect = tabs.getBoundingClientRect();
      const panelRect = panel.getBoundingClientRect();
      const hazardRect = hazardField.getBoundingClientRect();
      return {
        viewportWidth: window.innerWidth,
        viewportHeight: window.innerHeight,
        bodyHeight: document.documentElement.scrollHeight,
        horizontalOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
        shellClientHeight: shell.clientHeight,
        shellScrollHeight: shell.scrollHeight,
        shellRatio: Number((shell.scrollHeight / Math.max(shell.clientHeight, 1)).toFixed(2)),
        shellOverflowY: getComputedStyle(shell).overflowY,
        shellTop: Math.round(shellRect.top),
        shellBottom: Math.round(shellRect.bottom),
        tabsTop: Math.round(tabsRect.top),
        tabsBottom: Math.round(tabsRect.bottom),
        panelTop: Math.round(panelRect.top),
        hazardFieldBottom: Math.round(hazardRect.bottom),
        tabsBeforePanel: tabsRect.bottom <= panelRect.top + 1,
        tabsVisibleInShell: tabsRect.bottom > shellRect.top && tabsRect.top < shellRect.bottom,
        hazardFieldVisibleInShell: hazardRect.bottom > shellRect.top && hazardRect.top < shellRect.bottom,
        selectorCount: tabs.querySelectorAll('[data-testid="risk-row-selector"]').length
      };
    });

    const verdict = metrics.viewportWidth === probe.width
      && metrics.viewportHeight === probe.height
      && metrics.bodyHeight <= probe.height + 8
      && metrics.horizontalOverflow === false
      && metrics.shellOverflowY === "auto"
      && metrics.shellRatio <= 3
      && metrics.selectorCount >= 3
      && metrics.tabsBeforePanel
      && metrics.tabsVisibleInShell
      && metrics.hazardFieldVisibleInShell
      && metrics.hazardFieldBottom <= probe.height
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
  ? await fetch(`${baseUrl}/api/build-info?codexCacheBust=risk-row-order-${Date.now()}`).then(async (response) => {
      if (!response.ok) throw new Error(`Production build-info failed (${response.status})`);
      return response.json();
    })
  : null;
const pass = results.filter((result) => result.verdict === "PASS").length;
const sourceHeadMatchesProduction = productionBuild?.commitSha === sourceHead;
const report = {
  schemaVersion: "safeclaw-document-risk-row-mobile-order/v1",
  checkedAt: new Date().toISOString(),
  mode: liveProductionRun ? "live-production" : "current-source-local-production",
  baseUrl,
  sourceHead,
  productionBuild,
  sourceHeadMatchesProduction,
  verdict: pass === results.length
    ? liveProductionRun && sourceHeadMatchesProduction
      ? "PASS_LIVE_PRODUCTION_DOCUMENT_RISK_ROW_MOBILE_ORDER"
      : "PASS_CURRENT_SOURCE_LOCAL_DOCUMENT_RISK_ROW_MOBILE_ORDER"
    : liveProductionRun
      ? "RED_LIVE_PRODUCTION_DOCUMENT_RISK_ROW_MOBILE_ORDER"
      : "RED_CURRENT_SOURCE_LOCAL_DOCUMENT_RISK_ROW_MOBILE_ORDER",
  total: results.length,
  pass,
  fail: results.length - pass,
  acceptanceContract: {
    selectorRailBeforeActiveEditor: true,
    selectorRailVisibleInShell: true,
    firstHazardFieldVisibleInViewport: true,
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
  `| ${result.theme} | ${result.label} | ${result.metrics.bodyHeight}/${result.height} | ${result.metrics.shellRatio} | ${result.metrics.tabsBottom}/${result.metrics.panelTop} | ${result.metrics.hazardFieldBottom} | ${result.verdict} |`
)).join("\n");
await writeFile(path.join(outputDir, "report.md"), `# Document Risk Row Mobile Order Evidence\n\n- Verdict: \`${report.verdict}\`\n- Source: \`${sourceHead}\`\n- Production: \`${productionBuild?.commitSha || "local"}\`\n- Scope: selected Risk Assessment row-selector ordering only\n- Boundary: no DB/provider/Share mutation; exact saved Share remains \`MISSING_EVIDENCE\`\n\n| Theme | Viewport | Body/Viewport | Shell ratio | Tabs bottom/Panel top | Hazard bottom | Verdict |\n|---|---|---:|---:|---:|---:|---|\n${rows}\n\nThe selector rail must precede the active row editor on desktop and mobile while the first hazard field remains inside the short viewport.\n`, "utf8");

console.log(JSON.stringify({ verdict: report.verdict, total: report.total, pass: report.pass, fail: report.fail }, null, 2));
if (report.fail > 0) process.exitCode = 1;
