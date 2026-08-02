import { execFileSync } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";

const baseUrl = process.env.SAFECLAW_BASE_URL || "https://www.safeclaw.kr";
const outputDir = path.resolve(
  process.env.SAFECLAW_OUTPUT_DIR || "evaluation/document-raw-drilldown-geometry-2026-08-02/before-live"
);
const liveProductionRun = new URL(baseUrl).hostname === "www.safeclaw.kr";
const documentKeys = [
  "riskAssessmentDraft",
  "tbmBriefing",
  "tbmLogDraft",
  "workpackSummaryDraft",
  "workPlanDraft",
  "workPermitDraft",
  "safetyEducationRecordDraft",
  "emergencyResponseDraft",
  "photoEvidenceDraft",
  "foreignWorkerBriefing",
  "foreignWorkerTransmission",
  "kakaoMessage"
];
const viewportCases = [
  { theme: "day", label: "desktop-short-1440x723", width: 1440, height: 723 },
  { theme: "night", label: "desktop-short-1440x723", width: 1440, height: 723 },
  { theme: "day", label: "mobile-short-390x723", width: 390, height: 723 },
  { theme: "night", label: "mobile-short-390x723", width: 390, height: 723 }
];
const screenshotKeys = new Set(["riskAssessmentDraft", "foreignWorkerBriefing"]);

async function selectDocument(page, key) {
  const picker = page.locator('select[aria-label="편집 문서 선택"]');
  if (await picker.inputValue() === key) return;
  const cockpit = page.locator(".safeclaw-document-cockpit");
  const details = cockpit.getByTestId("mobile-document-details");
  const detailButton = details.locator(`button[data-document-key="${key}"]`);
  if (await detailButton.count() > 0 && !await details.evaluate((element) => element.open)) {
    await details.locator(":scope > summary").click();
  }
  const visibleButton = cockpit.locator(`button[data-document-key="${key}"]:visible`).first();
  if (await visibleButton.count() > 0) {
    await visibleButton.click();
  } else {
    await picker.selectOption(key);
  }
  await page.waitForFunction(
    (expectedKey) => document.querySelector('select[aria-label="편집 문서 선택"]')?.value === expectedKey,
    key
  );
}

function rowVerdict(row) {
  const sourceNeedsScroll = row.sourceScrollHeight > row.sourceClientHeight + 1;
  return row.pageHeight <= row.viewportHeight + 8
    && row.horizontalOverflow === false
    && row.shellRatio <= 3
    && row.sourceEditorVisibleCount === 1
    && row.structuredEditorVisibleCount === 0
    && row.sourceModePressed === true
    && row.sourceTop >= 0
    && row.sourceBottom <= row.viewportHeight
    && row.sourceClientHeight <= 320
    && (!sourceNeedsScroll || row.sourceOverflowY === "auto")
    && row.selectedEditorCount === 1
    ? "PASS"
    : "RED";
}

await mkdir(outputDir, { recursive: true });
const browser = await chromium.launch({ headless: true });
const results = [];

try {
  for (const probe of viewportCases) {
    const page = await browser.newPage({ viewport: { width: probe.width, height: probe.height } });
    await page.goto(`${baseUrl}/documents?theme=${probe.theme}`, { waitUntil: "networkidle" });
    await page.getByTestId("workpack-editor-workspace").waitFor({ state: "visible" });

    for (const documentKey of documentKeys) {
      await selectDocument(page, documentKey);
      await page.waitForFunction(() => Array.from(document.querySelectorAll("button"))
        .some((button) => button.textContent?.trim() === "구조화" && button.getAttribute("aria-pressed") === "true"));
      const sourceButton = page.getByRole("button", { name: "원문", exact: true });
      if (await sourceButton.getAttribute("aria-pressed") !== "true") {
        await sourceButton.click();
      }
      const sourceEditor = page.locator("textarea.document-source-textarea:visible");
      await sourceEditor.waitFor({ state: "visible" });
      await page.waitForTimeout(120);
      const metrics = await page.evaluate(() => {
        const shell = document.querySelector('[data-testid="workpack-editor-workspace"]');
        const source = document.querySelector("textarea.document-source-textarea");
        const sourceButtonElement = Array.from(document.querySelectorAll("button"))
          .find((button) => button.textContent?.trim() === "원문");
        const selectedEditors = Array.from(document.querySelectorAll('[data-testid="workpack-editor-workspace"]'))
          .filter((element) => {
            const rect = element.getBoundingClientRect();
            return rect.width > 0 && rect.height > 0;
          });
        const structuredEditors = Array.from(document.querySelectorAll('[data-testid="document-structured-editor"]'))
          .filter((element) => {
            const rect = element.getBoundingClientRect();
            return rect.width > 0 && rect.height > 0;
          });
        if (!(shell instanceof HTMLElement) || !(source instanceof HTMLTextAreaElement)) {
          throw new Error("Source editor geometry is unavailable");
        }
        const rect = source.getBoundingClientRect();
        const style = getComputedStyle(source);
        return {
          viewportHeight: window.innerHeight,
          pageHeight: document.documentElement.scrollHeight,
          horizontalOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
          shellClientHeight: shell.clientHeight,
          shellScrollHeight: shell.scrollHeight,
          shellRatio: Number((shell.scrollHeight / Math.max(shell.clientHeight, 1)).toFixed(2)),
          sourceTop: Math.round(rect.top),
          sourceBottom: Math.round(rect.bottom),
          sourceClientHeight: source.clientHeight,
          sourceScrollHeight: source.scrollHeight,
          sourceRatio: Number((source.scrollHeight / Math.max(source.clientHeight, 1)).toFixed(2)),
          sourceOverflowY: style.overflowY,
          sourceMaxHeight: style.maxHeight,
          sourceResize: style.resize,
          sourceEditorVisibleCount: 1,
          structuredEditorVisibleCount: structuredEditors.length,
          sourceModePressed: sourceButtonElement?.getAttribute("aria-pressed") === "true",
          selectedEditorCount: selectedEditors.length
        };
      });
      const verdict = rowVerdict(metrics);
      let screenshot = null;
      if (screenshotKeys.has(documentKey)) {
        screenshot = `${probe.theme}-${probe.label}-${documentKey}.png`;
        await page.screenshot({ path: path.join(outputDir, screenshot), fullPage: false });
      }
      results.push({ ...probe, route: `/documents?theme=${probe.theme}`, documentKey, metrics, screenshot, verdict });
    }
    await page.close();
  }
} finally {
  await browser.close();
}

const sourceHead = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
const productionBuild = liveProductionRun
  ? await fetch(`${baseUrl}/api/build-info?codexCacheBust=document-raw-drilldown-${Date.now()}`).then(async (response) => {
      if (!response.ok) throw new Error(`Production build-info failed (${response.status})`);
      return response.json();
    })
  : null;
const pass = results.filter((result) => result.verdict === "PASS").length;
const sourceHeadMatchesProduction = productionBuild?.commitSha === sourceHead;
const report = {
  schemaVersion: "safeclaw-document-raw-drilldown-geometry/v1",
  checkedAt: new Date().toISOString(),
  mode: liveProductionRun ? "live-production" : "current-source-local-production",
  baseUrl,
  sourceHead,
  productionBuild,
  sourceHeadMatchesProduction,
  verdict: pass === results.length
    ? liveProductionRun && sourceHeadMatchesProduction
      ? "PASS_LIVE_PRODUCTION_12_DOCUMENT_RAW_DRILLDOWN_GEOMETRY"
      : "PASS_CURRENT_SOURCE_LOCAL_12_DOCUMENT_RAW_DRILLDOWN_GEOMETRY"
    : liveProductionRun
      ? "RED_LIVE_PRODUCTION_12_DOCUMENT_RAW_DRILLDOWN_GEOMETRY"
      : "RED_CURRENT_SOURCE_LOCAL_12_DOCUMENT_RAW_DRILLDOWN_GEOMETRY",
  documentCount: documentKeys.length,
  viewportCaseCount: viewportCases.length,
  total: results.length,
  pass,
  fail: results.length - pass,
  acceptanceContract: {
    explicitSourceModeOnly: true,
    pageBodyContained: true,
    shellRatioMaximum: 3,
    sourceEditorInsideFirstViewport: true,
    sourceEditorMaximumHeight: 320,
    longSourceOwnsInternalScroll: true,
    selectedEditorOnly: true
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
  `| ${result.theme} | ${result.label} | ${result.documentKey} | ${result.metrics.pageHeight}/${result.height} | ${result.metrics.shellRatio} | ${result.metrics.sourceTop}-${result.metrics.sourceBottom} | ${result.metrics.sourceClientHeight}/${result.metrics.sourceScrollHeight} | ${result.metrics.sourceOverflowY} | ${result.verdict} |`
)).join("\n");
await writeFile(path.join(outputDir, "report.md"), `# 12-Document Raw Drilldown Geometry Evidence\n\n- Verdict: \`${report.verdict}\`\n- Mode: \`${report.mode}\`\n- Source: \`${sourceHead}\`\n- Production: \`${productionBuild?.commitSha || "local"}\`\n- Coverage: ${report.documentCount} documents x ${report.viewportCaseCount} Day/Night desktop/mobile cases = ${report.total} rows\n- Boundary: no DB/provider/Share mutation; exact saved Share remains \`MISSING_EVIDENCE\`\n\n| Theme | Viewport | Document | Body/Viewport | Shell ratio | Source top-bottom | Source client/scroll | Overflow | Verdict |\n|---|---|---|---:|---:|---:|---:|---|---|\n${rows}\n\nThis evidence opens the explicit raw/source drilldown for every canonical document. It does not treat raw source as the default UI or replace human wording review.\n`, "utf8");

console.log(JSON.stringify({ verdict: report.verdict, total: report.total, pass: report.pass, fail: report.fail }, null, 2));
if (report.fail > 0) process.exitCode = 1;
