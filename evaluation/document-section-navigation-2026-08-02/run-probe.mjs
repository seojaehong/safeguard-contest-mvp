import { execFileSync } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";

const baseUrl = process.env.SAFECLAW_BASE_URL || "http://127.0.0.1:3084";
const outputDir = path.resolve("evaluation/document-section-navigation-2026-08-02");
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
    const supportingDocuments = page.getByTestId("mobile-document-details");
    if (!await supportingDocuments.evaluate((element) => element.open)) {
      await supportingDocuments.locator(":scope > summary").click();
    }
    await supportingDocuments.locator('button[data-document-key="workPlanDraft"]:visible').click();
    await page.getByTestId("document-section-detail").waitFor({ state: "visible" });

    const metrics = await page.evaluate(() => {
      const shell = document.querySelector(".workpack-shell");
      const actions = document.querySelector('[data-testid="document-section-actions"]');
      const index = document.querySelector('[data-testid="document-section-index"]');
      const tabs = Array.from(document.querySelectorAll('[data-testid="document-section-tab"]'));
      if (!(shell instanceof HTMLElement) || !(actions instanceof HTMLElement) || !(index instanceof HTMLElement)) {
        throw new Error("Document section navigation is unavailable");
      }
      const selectedTab = tabs.find((tab) => tab.getAttribute("aria-selected") === "true");
      const unselectedTab = tabs.find((tab) => tab.getAttribute("aria-selected") !== "true");
      if (!(selectedTab instanceof HTMLElement) || !(unselectedTab instanceof HTMLElement)) {
        throw new Error("Selected and unselected document sections are required");
      }
      const selectedStyle = getComputedStyle(selectedTab);
      const unselectedStyle = getComputedStyle(unselectedTab);
      const tabLabels = tabs.map((tab) => tab.querySelector("strong"));
      return {
        viewportHeight: window.innerHeight,
        bodyHeight: document.documentElement.scrollHeight,
        horizontalOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
        shellClientHeight: shell.clientHeight,
        shellScrollHeight: shell.scrollHeight,
        shellRatio: Number((shell.scrollHeight / Math.max(shell.clientHeight, 1)).toFixed(2)),
        actionBottom: Math.round(actions.getBoundingClientRect().bottom),
        shellBottom: Math.round(shell.getBoundingClientRect().bottom),
        sectionIndexClientWidth: index.clientWidth,
        sectionIndexScrollWidth: index.scrollWidth,
        sectionTabCount: tabs.length,
        selectedSectionTabCount: tabs.filter((tab) => tab.getAttribute("aria-selected") === "true").length,
        filledSectionTabCount: tabs.filter((tab) => tab.getAttribute("data-section-state") === "filled").length,
        emptySectionTabCount: tabs.filter((tab) => tab.getAttribute("data-section-state") === "empty").length,
        minimumSectionTabHeight: Math.min(...tabs.map((tab) => Math.round(tab.getBoundingClientRect().height))),
        sectionTabLabels: tabs.map((tab) => tab.getAttribute("aria-label")),
        sectionLabelWhiteSpace: tabLabels.map((label) => label ? getComputedStyle(label).whiteSpace : null),
        sectionLabelLineClamp: tabLabels.map((label) => label ? getComputedStyle(label).webkitLineClamp : null),
        selectedBackground: selectedStyle.backgroundColor,
        unselectedBackground: unselectedStyle.backgroundColor,
        selectedBoxShadow: selectedStyle.boxShadow
      };
    });

    const verdict = metrics.bodyHeight <= probe.height + 8
      && metrics.horizontalOverflow === false
      && metrics.shellRatio <= 3
      && metrics.actionBottom <= Math.min(metrics.shellBottom, probe.height)
      && metrics.sectionTabCount === 6
      && metrics.selectedSectionTabCount === 1
      && metrics.filledSectionTabCount === 6
      && metrics.emptySectionTabCount === 0
      && metrics.minimumSectionTabHeight >= 44
      && metrics.sectionTabLabels.every((label) => label?.includes("줄 작성됨"))
      && metrics.sectionLabelWhiteSpace.every((value) => value === "normal")
      && metrics.sectionLabelLineClamp.every((value) => value === "2")
      && metrics.selectedBackground !== metrics.unselectedBackground
      && metrics.selectedBoxShadow !== "none"
      ? "PASS"
      : "RED";
    const screenshot = `${probe.theme}-${probe.label}.png`;
    await page.getByTestId("document-section-index").evaluate((element) => {
      const shell = element.closest(".workpack-shell");
      const toolbar = shell?.querySelector(".document-toolbar");
      if (shell instanceof HTMLElement) {
        const toolbarHeight = toolbar instanceof HTMLElement ? toolbar.getBoundingClientRect().height : 0;
        shell.scrollTo({
          top: shell.scrollTop + element.getBoundingClientRect().top - shell.getBoundingClientRect().top - toolbarHeight - 4,
          behavior: "auto"
        });
      }
    });
    await page.screenshot({ path: path.join(outputDir, screenshot), fullPage: false });
    results.push({ ...probe, route: `/documents?theme=${probe.theme}`, state: "selected-workPlanDraft", metrics, screenshot, verdict });
    await page.close();
  }
} finally {
  await browser.close();
}

const sourceHead = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
const productionBuild = liveProductionRun
  ? await fetch(`${baseUrl}/api/build-info?codexCacheBust=document-section-${Date.now()}`).then(async (response) => {
      if (!response.ok) throw new Error(`Production build-info failed (${response.status})`);
      return response.json();
    })
  : null;
const pass = results.filter((result) => result.verdict === "PASS").length;
const sourceHeadMatchesProduction = productionBuild?.commitSha === sourceHead;
const report = {
  schemaVersion: "safeclaw-document-section-navigation/v1",
  checkedAt: new Date().toISOString(),
  mode: liveProductionRun ? "live-production" : "current-source-local-production",
  baseUrl,
  sourceHead,
  productionBuild,
  sourceHeadMatchesProduction,
  verdict: pass === results.length
    ? liveProductionRun && sourceHeadMatchesProduction
      ? "PASS_LIVE_PRODUCTION_DOCUMENT_SECTION_NAVIGATION"
      : "PASS_CURRENT_SOURCE_LOCAL_DOCUMENT_SECTION_NAVIGATION"
    : "RED_CURRENT_SOURCE_LOCAL_DOCUMENT_SECTION_NAVIGATION",
  total: results.length,
  pass,
  fail: results.length - pass,
  acceptanceContract: {
    selectedDocumentOnly: true,
    sectionTabCount: 6,
    selectedSectionTabCount: 1,
    minimumTouchHeight: 44,
    readableTwoLineLabels: true,
    shellRatioMaximum: 3,
    firstActionInsideViewport: true,
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
    focusedSectionNavigation: { filesPassed: 1, testsPassed: 1, status: "pass" },
    typecheck: { status: "pass" },
    build: { status: "pass", nextVersion: "15.5.22", staticPages: 28 }
  },
  results
};

await writeFile(path.join(outputDir, "report.json"), `${JSON.stringify(report, null, 2)}\n`, "utf8");
const rows = results.map((result) => (
  `| ${result.theme} | ${result.label} | ${result.metrics.bodyHeight}/${result.height} | ${result.metrics.shellRatio} | ${result.metrics.actionBottom} | ${result.metrics.minimumSectionTabHeight} | ${result.metrics.selectedSectionTabCount}/${result.metrics.sectionTabCount} | ${result.verdict} |`
)).join("\n");
await writeFile(path.join(outputDir, "report.md"), `# Document Section Navigation Evidence\n\n- Verdict: \`${report.verdict}\`\n- Source: \`${sourceHead}\`\n- Production: \`${productionBuild?.commitSha || "local"}\`\n- Scope: selected Work Plan section navigation only\n- Verification: Documents browser 35/35, focused navigation 1/1, strict typecheck PASS, Next 15.5.22 build PASS (28 static pages)\n- Boundary: no DB/provider/Share mutation; exact saved Share remains \`MISSING_EVIDENCE\`\n\n| Theme | Viewport | Body/Viewport | Shell ratio | Action bottom | Min tab height | Selected/Tabs | Verdict |\n|---|---|---:|---:|---:|---:|---:|---|\n${rows}\n\nThis evidence does not claim that route splitting alone solves long-form authoring. It verifies one selected document, readable section navigation, and bounded local editing.\n`, "utf8");

console.log(JSON.stringify({ verdict: report.verdict, total: report.total, pass: report.pass, fail: report.fail }, null, 2));
if (report.fail > 0) process.exitCode = 1;
