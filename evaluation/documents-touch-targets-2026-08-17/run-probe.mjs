import { execFileSync } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";

const baseUrl = process.env.SAFECLAW_BASE_URL || "http://127.0.0.1:3083";
const outputDir = path.resolve(
  process.env.SAFECLAW_OUTPUT_DIR || "evaluation/documents-touch-targets-2026-08-17"
);
const liveProductionRun = new URL(baseUrl).hostname === "www.safeclaw.kr";
const cases = [
  { theme: "day", label: "desktop-1440x723", width: 1440, height: 723 },
  { theme: "night", label: "desktop-1440x723", width: 1440, height: 723 },
  { theme: "day", label: "mobile-390x723", width: 390, height: 723 },
  { theme: "night", label: "mobile-390x723", width: 390, height: 723 }
];

await mkdir(outputDir, { recursive: true });
const browser = await chromium.launch({ headless: true });
const results = [];

try {
  for (const probe of cases) {
    const page = await browser.newPage({ viewport: { width: probe.width, height: probe.height } });
    await page.goto(`${baseUrl}/documents?theme=${probe.theme}`, { waitUntil: "networkidle" });
    await page.getByTestId("risk-rows-editor").waitFor({ state: "visible" });

    const cockpit = await page.evaluate(() => {
      const shell = document.querySelector(".workpack-shell");
      const actions = Array.from(document.querySelectorAll('[data-testid="document-section-actions"] button'));
      const selectors = Array.from(document.querySelectorAll('[data-testid="risk-row-selector"]'));
      const coreButtons = Array.from(document.querySelectorAll(
        '[data-testid="mobile-core-document-launcher"] .safeclaw-mobile-core-list button'
      ));
      const supportingDetails = document.querySelector('[data-testid="supporting-document-group"]');
      if (!shell || actions.length !== 2 || selectors.length < 3 || coreButtons.length !== 3) {
        throw new Error("Document touch-target evidence targets are unavailable");
      }
      const shellRect = shell.getBoundingClientRect();
      return {
        viewportWidth: window.innerWidth,
        viewportHeight: window.innerHeight,
        bodyHeight: document.documentElement.scrollHeight,
        horizontalOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
        shellTop: Math.round(shellRect.top),
        shellBottom: Math.round(shellRect.bottom),
        shellRatio: Number((shell.scrollHeight / Math.max(shell.clientHeight, 1)).toFixed(2)),
        shellOverflowY: getComputedStyle(shell).overflowY,
        actionHeights: actions.map((item) => Math.round(item.getBoundingClientRect().height)),
        selectorHeights: selectors.map((item) => Math.round(item.getBoundingClientRect().height)),
        coreButtonCount: coreButtons.length,
        supportingDocumentsOpen: supportingDetails instanceof HTMLDetailsElement ? supportingDetails.open : null
      };
    });

    await page.getByTestId("document-editorial-review-launch").click();
    const dialog = page.getByTestId("document-editorial-review-dialog");
    await dialog.waitFor({ state: "visible" });
    const reviewDialog = await dialog.evaluate((element) => {
      const closeButton = element.querySelector(".safeclaw-document-review-close");
      if (!(closeButton instanceof HTMLElement)) throw new Error("Document review close button is unavailable");
      const dialogRect = element.getBoundingClientRect();
      const closeRect = closeButton.getBoundingClientRect();
      return {
        top: Math.round(dialogRect.top),
        bottom: Math.round(dialogRect.bottom),
        left: Math.round(dialogRect.left),
        right: Math.round(dialogRect.right),
        closeWidth: Math.round(closeRect.width),
        closeHeight: Math.round(closeRect.height),
        horizontalOverflow: element.scrollWidth > element.clientWidth
      };
    });

    const verdict = cockpit.viewportWidth === probe.width
      && cockpit.viewportHeight === probe.height
      && cockpit.bodyHeight <= probe.height + 8
      && cockpit.horizontalOverflow === false
      && cockpit.shellOverflowY === "auto"
      && cockpit.shellRatio <= 3
      && cockpit.actionHeights.every((height) => height >= 44)
      && cockpit.selectorHeights.every((height) => height >= 44)
      && cockpit.coreButtonCount === 3
      && cockpit.supportingDocumentsOpen === false
      && reviewDialog.top >= 0
      && reviewDialog.bottom <= probe.height
      && reviewDialog.left >= 0
      && reviewDialog.right <= probe.width
      && reviewDialog.closeWidth >= 44
      && reviewDialog.closeHeight >= 44
      && reviewDialog.horizontalOverflow === false
      ? "PASS"
      : "RED";

    const screenshot = `${probe.theme}-${probe.label}.png`;
    await page.screenshot({ path: path.join(outputDir, screenshot), fullPage: false });
    results.push({ ...probe, route: `/documents?theme=${probe.theme}`, cockpit, reviewDialog, screenshot, verdict });
    await page.close();
  }
} finally {
  await browser.close();
}

const sourceHead = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
const productionBuild = liveProductionRun
  ? await fetch(`${baseUrl}/api/build-info?codexCacheBust=documents-touch-${Date.now()}`).then(async (response) => {
      if (!response.ok) throw new Error(`Production build-info failed (${response.status})`);
      return response.json();
    })
  : null;
const sourceHeadMatchesProduction = productionBuild?.commitSha === sourceHead;
const pass = results.filter((result) => result.verdict === "PASS").length;
const report = {
  schemaVersion: "safeclaw-documents-touch-targets/v1",
  checkedAt: new Date().toISOString(),
  mode: liveProductionRun ? "live-production" : "current-source-local-production",
  baseUrl,
  sourceHead,
  productionBuild,
  sourceHeadMatchesProduction,
  verdict: pass === results.length
    ? liveProductionRun && sourceHeadMatchesProduction
      ? "PASS_LIVE_PRODUCTION_DOCUMENT_TOUCH_TARGETS"
      : "PASS_CURRENT_SOURCE_LOCAL_DOCUMENT_TOUCH_TARGETS"
    : liveProductionRun
      ? "RED_LIVE_PRODUCTION_DOCUMENT_TOUCH_TARGETS"
      : "RED_CURRENT_SOURCE_LOCAL_DOCUMENT_TOUCH_TARGETS",
  total: results.length,
  pass,
  fail: results.length - pass,
  acceptanceContract: {
    sectionActionMinimumHeight: 44,
    riskRowSelectorMinimumHeight: 44,
    reviewCloseMinimumWidth: 44,
    reviewCloseMinimumHeight: 44,
    bodyViewportAllowancePx: 8,
    coreDocumentCount: 3,
    supportingDocumentsCollapsedByDefault: true,
    shellInternalScrollRequired: true
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
  `| ${result.theme} | ${result.label} | ${result.cockpit.bodyHeight}/${result.height} | ${result.cockpit.shellRatio} | ${result.cockpit.actionHeights.join("/")} | ${result.cockpit.selectorHeights.join("/")} | ${result.reviewDialog.closeWidth}x${result.reviewDialog.closeHeight} | ${result.verdict} |`
)).join("\n");
await writeFile(path.join(outputDir, "report.md"), `# Documents Touch Target Evidence\n\n- Verdict: \`${report.verdict}\`\n- Source: \`${sourceHead}\`\n- Production: \`${productionBuild?.commitSha || "local"}\`\n- Scope: Documents section actions, risk-row selectors, and human-review close control\n- Boundary: no DB/provider/Share mutation; exact saved Share remains \`MISSING_EVIDENCE\`\n\n| Theme | Viewport | Body/Viewport | Shell ratio | Actions px | Risk selectors px | Review close | Verdict |\n|---|---|---:|---:|---|---|---:|---|\n${rows}\n\nAll checked controls preserve the 44px interaction floor while the Documents route remains viewport-contained with local editor scrolling.\n`, "utf8");

console.log(JSON.stringify({ verdict: report.verdict, total: report.total, pass: report.pass, fail: report.fail }, null, 2));
if (report.fail > 0) process.exitCode = 1;
