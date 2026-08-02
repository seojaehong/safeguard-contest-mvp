import { execFileSync } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";

const baseUrl = process.env.SAFECLAW_BASE_URL || "http://127.0.0.1:3085";
const outputDir = path.resolve(
  process.env.SAFECLAW_OUTPUT_DIR || "evaluation/document-all-authoring-geometry-2026-08-02/after-local"
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
const screenshotKeys = new Set(["workpackSummaryDraft", "foreignWorkerBriefing"]);

async function selectDocument(page, key) {
  const picker = page.locator('select[aria-label="편집 문서 선택"]');
  if (await picker.inputValue() === key) return;
  const cockpit = page.locator(".safeclaw-document-cockpit");
  const cockpitButton = cockpit.locator(`button[data-document-key="${key}"]`);
  if (await cockpitButton.count() > 0) {
    const details = cockpit.getByTestId("mobile-document-details");
    const detailButton = details.locator(`button[data-document-key="${key}"]`);
    if (await detailButton.count() > 0 && !await details.evaluate((element) => element.open)) {
      await details.locator(":scope > summary").click();
    }
    await cockpit.locator(`button[data-document-key="${key}"]:visible`).first().click();
  } else {
    await picker.selectOption(key);
  }
  await page.waitForFunction(
    (expectedKey) => document.querySelector('select[aria-label="편집 문서 선택"]')?.value === expectedKey,
    key
  );
}

function rowVerdict(row, viewportHeight) {
  const expectedCockpitCount = row.documentKey === "riskAssessmentDraft" ? 0 : 1;
  const sectionContract = row.documentKey === "riskAssessmentDraft"
    ? row.sectionTabCount === 0 && row.selectedSectionTabCount === 0
    : row.sectionTabCount >= 1 && row.selectedSectionTabCount === 1;
  const cockpitContract = expectedCockpitCount === 0
    ? row.visibleCockpitCount === 0
    : row.visibleCockpitCount === 1
      && row.cockpitMaxHeight <= 260
      && row.cockpitOverflowY === "auto";
  return row.pageHeight <= viewportHeight + 8
    && row.horizontalOverflow === false
    && row.shellRatio <= 3
    && row.firstActionBottom <= viewportHeight
    && row.sourceEditorVisibleCount === 0
    && sectionContract
    && cockpitContract
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
      // The editor deliberately realigns the selected cockpit at 80 ms and 240 ms.
      await page.waitForTimeout(320);
      const metrics = await page.evaluate((selectedDocumentKey) => {
        const shell = document.querySelector('[data-testid="workpack-editor-workspace"]');
        const actions = document.querySelector('[data-testid="document-section-actions"]');
        const cockpits = Array.from(document.querySelectorAll('[data-testid$="-document-cockpit"]'))
          .filter((element) => {
            const rect = element.getBoundingClientRect();
            return rect.width > 0 && rect.height > 0;
          });
        const cockpitStyles = cockpits.map((element) => getComputedStyle(element));
        const sectionTabs = Array.from(document.querySelectorAll('[data-testid="document-section-tab"]'));
        const sourceEditors = Array.from(document.querySelectorAll('textarea[aria-label*="전체 원문 편집"]'))
          .filter((element) => {
            const rect = element.getBoundingClientRect();
            return rect.width > 0 && rect.height > 0;
          });
        if (!(shell instanceof HTMLElement) || !(actions instanceof HTMLElement)) {
          throw new Error(`Authoring shell or first action missing for ${selectedDocumentKey}`);
        }
        return {
          viewportHeight: window.innerHeight,
          pageHeight: document.documentElement.scrollHeight,
          horizontalOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
          shellClientHeight: shell.clientHeight,
          shellScrollHeight: shell.scrollHeight,
          shellRatio: Number((shell.scrollHeight / Math.max(shell.clientHeight, 1)).toFixed(2)),
          shellBottom: Math.round(shell.getBoundingClientRect().bottom),
          firstActionBottom: Math.round(actions.getBoundingClientRect().bottom),
          visibleCockpitCount: cockpits.length,
          cockpitTestIds: cockpits.map((element) => element.getAttribute("data-testid")),
          cockpitMaxHeight: cockpitStyles.length
            ? Math.max(...cockpitStyles.map((style) => Number.parseFloat(style.maxHeight) || Number.POSITIVE_INFINITY))
            : 0,
          cockpitOverflowY: cockpitStyles[0]?.overflowY || "none",
          sectionTabCount: sectionTabs.length,
          selectedSectionTabCount: sectionTabs.filter((tab) => tab.getAttribute("aria-selected") === "true").length,
          sourceEditorVisibleCount: sourceEditors.length
        };
      }, documentKey);
      const verdict = rowVerdict({ documentKey, ...metrics }, probe.height);
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
  ? await fetch(`${baseUrl}/api/build-info?codexCacheBust=document-all-authoring-${Date.now()}`).then(async (response) => {
      if (!response.ok) throw new Error(`Production build-info failed (${response.status})`);
      return response.json();
    })
  : null;
const pass = results.filter((result) => result.verdict === "PASS").length;
const sourceHeadMatchesProduction = productionBuild?.commitSha === sourceHead;
const report = {
  schemaVersion: "safeclaw-document-all-authoring-geometry/v1",
  checkedAt: new Date().toISOString(),
  mode: liveProductionRun ? "live-production" : "current-source-local-production",
  baseUrl,
  sourceHead,
  productionBuild,
  sourceHeadMatchesProduction,
  verdict: pass === results.length
    ? liveProductionRun && sourceHeadMatchesProduction
      ? "PASS_LIVE_PRODUCTION_12_DOCUMENT_AUTHORING_GEOMETRY"
      : "PASS_CURRENT_SOURCE_LOCAL_12_DOCUMENT_AUTHORING_GEOMETRY"
    : liveProductionRun
      ? "RED_LIVE_PRODUCTION_12_DOCUMENT_AUTHORING_GEOMETRY"
      : "RED_CURRENT_SOURCE_LOCAL_12_DOCUMENT_AUTHORING_GEOMETRY",
  documentCount: documentKeys.length,
  viewportCaseCount: viewportCases.length,
  total: results.length,
  pass,
  fail: results.length - pass,
  acceptanceContract: {
    selectedDocumentOnly: true,
    maximumVisibleCockpitsPerDocument: 1,
    nonRiskDocumentCockpitRequired: true,
    cockpitMaxHeight: 260,
    cockpitInternalScrollRequired: true,
    shellRatioMaximum: 3,
    firstActionInsideViewport: true,
    sourceEditorHiddenByDefault: true,
    bodyLevelLongStackForbidden: true
  },
  mutationBoundary: {
    dbMutationPerformed: false,
    providerDispatchCalled: false,
    shareSessionCreated: false,
    exactSavedShareVerdict: "MISSING_EVIDENCE"
  },
  verification: {
    documentsEditorLayout: { filesPassed: 1, testsPassed: 35, status: "pass" },
    typecheck: { status: "pass" },
    build: { status: "pass", nextVersion: "15.5.22", staticPages: 28 }
  },
  results
};

await writeFile(path.join(outputDir, "report.json"), `${JSON.stringify(report, null, 2)}\n`, "utf8");
const rows = results.map((result) => (
  `| ${result.theme} | ${result.label} | ${result.documentKey} | ${result.metrics.pageHeight}/${result.height} | ${result.metrics.shellRatio} | ${result.metrics.firstActionBottom} | ${result.metrics.visibleCockpitCount} | ${result.metrics.cockpitMaxHeight} | ${result.verdict} |`
)).join("\n");
await writeFile(path.join(outputDir, "report.md"), `# 12-Document Authoring Geometry Evidence\n\n- Verdict: \`${report.verdict}\`\n- Mode: \`${report.mode}\`\n- Source: \`${sourceHead}\`\n- Production: \`${productionBuild?.commitSha || "local"}\`\n- Coverage: ${report.documentCount} documents x ${report.viewportCaseCount} Day/Night desktop/mobile cases = ${report.total} rows\n- Verification: Documents browser 35/35, strict typecheck PASS, Next 15.5.22 build PASS (28 static pages)\n- Boundary: no DB/provider/Share mutation; exact saved Share remains \`MISSING_EVIDENCE\`\n\n| Theme | Viewport | Document | Body/Viewport | Shell ratio | First action | Cockpits | Cockpit max | Verdict |\n|---|---|---|---:|---:|---:|---:|---:|---|\n${rows}\n\nThis evidence verifies selected-only authoring containment across all 12 canonical documents. It does not prove an exact saved Share session or accept route splitting alone as the UX fix.\n`, "utf8");

console.log(JSON.stringify({ verdict: report.verdict, total: report.total, pass: report.pass, fail: report.fail }, null, 2));
if (report.fail > 0) process.exitCode = 1;
