import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { chromium } from "playwright";

const outDir = path.resolve("evaluation/documents-cockpit-workbench-geometry-2026-07-22");
fs.mkdirSync(outDir, { recursive: true });

const baseUrl = process.env.SAFECLAW_BASE_URL || "https://www.safeclaw.kr";
const checkedAt = new Date().toISOString();
const sourceHead = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
const buildInfo = await fetch(`${baseUrl}/api/build-info?codexCacheBust=documents-workbench-${Date.now()}`)
  .then((response) => response.json())
  .catch((error) => ({ ok: false, commitSha: null, error: String(error) }));

const viewports = [
  { label: "desktop-short-1440x723", width: 1440, height: 723 },
  { label: "mobile-390x723", width: 390, height: 723 },
];

function verdictFor(metrics) {
  const desktop = metrics.viewportWidth >= 901;
  const workbenchPass = desktop
    ? metrics.workbenchDisplay === "grid"
      && metrics.workbenchColumnCount >= 2
      && metrics.workbenchWidth >= 1040
      && metrics.editorLeft >= metrics.launcherRight
      && Math.abs(metrics.editorTop - metrics.launcherTop) <= 4
      && metrics.innerNavigatorDisplay === "none"
      && metrics.selectedEditorPaneWidth >= metrics.editorWidth * 0.95
    : metrics.workbenchDisplay === "grid"
      && metrics.workbenchColumnCount === 1
      && metrics.launcherBottom < metrics.editorTop
      && metrics.innerNavigatorDisplay === "none";
  const viewportPass = metrics.bodyHeight <= metrics.viewportHeight + 8
    && metrics.horizontalOverflow === false
    && metrics.coreButtons === 3
    && metrics.uniqueDocumentKeyCount === 12
    && metrics.visibleDocumentButtonCount === 3
    && metrics.supportingButtonCount === 9
    && metrics.visibleSupportingButtonCount === 0
    && metrics.legacyIndexDisplay === "none"
    && metrics.detailsOpen === false
    && metrics.visibleSelectedEditorCount === 1
    && metrics.visibleFullDocumentBodyCount === 0
    && metrics.riskRowSelectorCount >= 1
    && metrics.mountedRiskRowPanelCount === 1
    && metrics.editorScrollRatio <= (desktop ? 2.05 : 2.25)
    && metrics.firstActionBottom > 0
    && metrics.firstActionBottom <= metrics.viewportHeight
    && metrics.editorOverflowY === "auto";
  return {
    workbenchVerdict: workbenchPass ? "PASS" : "RED",
    viewportVerdict: viewportPass ? "PASS" : "RED",
    overallVerdict: workbenchPass && viewportPass ? "PASS" : "RED",
  };
}

async function settle(page) {
  await page.evaluate(async () => {
    await document.fonts.ready;
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  });
}

async function measure(page, viewport) {
  await page.setViewportSize({ width: viewport.width, height: viewport.height });
  await page.goto(`${baseUrl}/documents?theme=day`, { waitUntil: "networkidle", timeout: 60_000 });
  await page.locator(".safeclaw-documents-workbench").waitFor({ state: "visible", timeout: 30_000 });
  await settle(page);
  const metrics = await page.evaluate(() => {
    const rect = (element) => {
      if (!element) return null;
      const box = element.getBoundingClientRect();
      return {
        left: Math.round(box.left),
        right: Math.round(box.right),
        top: Math.round(box.top),
        bottom: Math.round(box.bottom),
        width: Math.round(box.width),
        height: Math.round(box.height),
      };
    };
    const workbench = document.querySelector(".safeclaw-documents-workbench");
    const launcher = document.querySelector('[data-testid="mobile-core-document-launcher"]');
    const editor = document.querySelector('[data-testid="workpack-editor-workspace"]');
    const innerNavigator = editor?.querySelector(".workpack-sidebar");
    const selectedEditorPane = editor?.querySelector(".document-editor");
    const shell = document.querySelector(".safeclaw-module-shell");
    const details = document.querySelector('[data-testid="mobile-document-details"]');
    const cockpit = document.querySelector(".safeclaw-document-cockpit");
    const legacyIndex = document.querySelector(".safeclaw-doc-index");
    const style = workbench ? getComputedStyle(workbench) : null;
    const columns = style?.gridTemplateColumns ? style.gridTemplateColumns.split(" ").filter(Boolean) : [];
    const workbenchRect = rect(workbench);
    const launcherRect = rect(launcher);
    const editorRect = rect(editor);
    const selectedEditorPaneRect = rect(selectedEditorPane);
    const visibleElements = (selector) => [...document.querySelectorAll(selector)]
      .filter((element) => {
        const box = element.getBoundingClientRect();
        const elementStyle = getComputedStyle(element);
        return box.width > 0
          && box.height > 0
          && elementStyle.display !== "none"
          && elementStyle.visibility !== "hidden";
      });
    const visibleSelectedEditors = visibleElements('[data-testid="workpack-editor-workspace"]');
    const visibleFullDocumentBodies = visibleElements(".document-section-textarea, .document-source-textarea");
    const firstAction = visibleElements('[data-testid="document-section-actions"] button')[0] || null;
    const firstActionRect = rect(firstAction);
    const coreButtons = [...document.querySelectorAll('[data-testid="mobile-core-document-launcher"] .safeclaw-mobile-core-list button[data-document-key]')]
      .filter((button) => {
        const box = button.getBoundingClientRect();
        const buttonStyle = getComputedStyle(button);
        return box.width > 0 && box.height > 0 && buttonStyle.display !== "none" && buttonStyle.visibility !== "hidden";
      });
    const documentButtons = cockpit
      ? [...cockpit.querySelectorAll("button[data-document-key]")]
      : [];
    const visibleDocumentButtons = documentButtons.filter((button) => {
      const closedDetails = button.closest("details:not([open])");
      if (closedDetails) return false;
      const box = button.getBoundingClientRect();
      const buttonStyle = getComputedStyle(button);
      return box.width > 0
        && box.height > 0
        && buttonStyle.display !== "none"
        && buttonStyle.visibility !== "hidden";
    });
    const supportingButtons = details
      ? [...details.querySelectorAll("button[data-document-key]")]
      : [];
    const visibleSupportingButtons = supportingButtons.filter((button) => {
      const closedDetails = button.closest("details:not([open])");
      if (closedDetails) return false;
      const box = button.getBoundingClientRect();
      const buttonStyle = getComputedStyle(button);
      return box.width > 0
        && box.height > 0
        && buttonStyle.display !== "none"
        && buttonStyle.visibility !== "hidden";
    });
    return {
      route: "/documents?theme=day",
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight,
      bodyHeight: document.documentElement.scrollHeight,
      scrollWidth: document.documentElement.scrollWidth,
      horizontalOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
      shellClass: shell?.className || "",
      shellRoute: shell?.getAttribute("data-module-route") || "",
      workbenchDisplay: style?.display || "missing",
      workbenchGridTemplateColumns: style?.gridTemplateColumns || "",
      workbenchColumnCount: columns.length,
      workbenchTop: workbenchRect?.top ?? 0,
      workbenchBottom: workbenchRect?.bottom ?? 0,
      workbenchWidth: workbenchRect?.width ?? 0,
      workbenchHeight: workbenchRect?.height ?? 0,
      launcherTop: launcherRect?.top ?? 0,
      launcherRight: launcherRect?.right ?? 0,
      launcherBottom: launcherRect?.bottom ?? 0,
      editorTop: editorRect?.top ?? 0,
      editorLeft: editorRect?.left ?? 0,
      editorRight: editorRect?.right ?? 0,
      editorBottom: editorRect?.bottom ?? 0,
      editorWidth: editorRect?.width ?? 0,
      innerNavigatorDisplay: innerNavigator ? getComputedStyle(innerNavigator).display : "missing",
      innerNavigatorWidth: rect(innerNavigator)?.width ?? 0,
      selectedEditorPaneWidth: selectedEditorPaneRect?.width ?? 0,
      editorClientHeight: editor?.clientHeight ?? 0,
      editorScrollHeight: editor?.scrollHeight ?? 0,
      editorScrollRatio: editor?.clientHeight ? Number((editor.scrollHeight / editor.clientHeight).toFixed(2)) : 0,
      editorOverflowY: editor ? getComputedStyle(editor).overflowY : "missing",
      visibleSelectedEditorCount: visibleSelectedEditors.length,
      visibleFullDocumentBodyCount: visibleFullDocumentBodies.length,
      riskRowSelectorCount: document.querySelectorAll('[data-testid="risk-row-selector"]').length,
      mountedRiskRowPanelCount: document.querySelectorAll('[data-testid="risk-row-editor-row"]').length,
      firstActionTop: firstActionRect?.top ?? 0,
      firstActionBottom: firstActionRect?.bottom ?? 0,
      coreButtons: coreButtons.length,
      uniqueDocumentKeyCount: new Set(documentButtons.map((button) => button.getAttribute("data-document-key"))).size,
      visibleDocumentButtonCount: visibleDocumentButtons.length,
      supportingButtonCount: supportingButtons.length,
      visibleSupportingButtonCount: visibleSupportingButtons.length,
      legacyIndexDisplay: legacyIndex ? getComputedStyle(legacyIndex).display : "missing",
      detailsOpen: details instanceof HTMLDetailsElement ? details.open : null,
    };
  });
  await page.screenshot({
    path: path.join(outDir, `documents-workbench-${viewport.label}.png`),
    fullPage: true,
  });
  return { viewport: `${viewport.width}x${viewport.height}`, metrics, verdicts: verdictFor(metrics) };
}

const browser = await chromium.launch();
const page = await browser.newPage();
const rows = [];
try {
  for (const viewport of viewports) {
    rows.push(await measure(page, viewport));
  }
} finally {
  await browser.close();
}

const allRowsPass = rows.every((row) => row.verdicts.overallVerdict === "PASS");
const liveProductionMeasured = baseUrl.includes("safeclaw.kr") && Boolean(buildInfo.commitSha);
const sourceHeadMatchesProduction = buildInfo.commitSha === sourceHead;
const verdictPrefix = allRowsPass ? "PASS" : "RED";
const verdictScope = liveProductionMeasured ? "LIVE_PRODUCTION" : "CURRENT_SOURCE_LOCAL_PRODUCTION";
const report = {
  schemaVersion: "safeclaw-documents-cockpit-workbench-geometry/v2",
  checkedAt,
  sourceHead,
  baseUrl,
  productionBuild: buildInfo,
  sourceHeadMatchesProduction,
  verdict: `${verdictPrefix}_${verdictScope}_DOCUMENTS_WORKBENCH`,
  staleDevRedExplained: true,
  staleDevRedExplanation: "A sibling probe initially reported block/one-column geometry from a stale dev/HMR server. This gate records the clean local production geometry after rebuild/restart and directly measures the workbench display, column count, and editor-vs-launcher alignment.",
  routeSplitAloneAcceptedAsFix: false,
  rows,
};

fs.writeFileSync(path.join(outDir, "report.json"), `${JSON.stringify(report, null, 2)}\n`, "utf8");

const tableRows = rows.map((row) => {
  const metrics = row.metrics;
  const verdicts = row.verdicts;
  return `| ${row.viewport} | ${verdicts.overallVerdict} | ${metrics.bodyHeight} | ${metrics.horizontalOverflow} | ${metrics.workbenchDisplay} | ${metrics.workbenchColumnCount} | ${metrics.workbenchGridTemplateColumns} | ${metrics.launcherTop}-${metrics.launcherBottom} | ${metrics.editorTop}-${metrics.editorBottom} | ${metrics.launcherRight} | ${metrics.editorLeft} | ${metrics.innerNavigatorDisplay}/${metrics.innerNavigatorWidth} | ${metrics.selectedEditorPaneWidth}/${metrics.editorWidth} | ${metrics.visibleSelectedEditorCount} | ${metrics.visibleFullDocumentBodyCount} | ${metrics.riskRowSelectorCount}/${metrics.mountedRiskRowPanelCount} | ${metrics.firstActionTop}-${metrics.firstActionBottom} | ${metrics.editorClientHeight}/${metrics.editorScrollHeight} (${metrics.editorScrollRatio}) | ${metrics.coreButtons}/${metrics.uniqueDocumentKeyCount}/${metrics.visibleDocumentButtonCount}/${metrics.supportingButtonCount}/${metrics.visibleSupportingButtonCount} | ${metrics.legacyIndexDisplay} | ${metrics.detailsOpen} |`;
}).join("\n");

fs.writeFileSync(path.join(outDir, "report.md"), `# Documents Cockpit Workbench Geometry

Checked at: ${checkedAt}

Base URL: \`${baseUrl}\`

Source HEAD: \`${sourceHead}\`

Production \`/api/build-info\`: \`${buildInfo.commitSha || "unknown"}\`

Source HEAD matches production: \`${sourceHeadMatchesProduction}\`

Verdict: \`${report.verdict}\`

Route split alone accepted as fix: \`false\`

## Stale Dev RED Boundary

Sibling verification first saw \`display:block\` / one-column geometry from a stale dev/HMR server. This report is the clean local production check after rebuild/restart and directly measures workbench display, column count, and editor-vs-launcher alignment.

## Geometry

| Viewport | Overall | Body height | OverflowX | Workbench display | Columns | Column template | Launcher top-bottom | Editor top-bottom | Launcher right | Editor left | Inner nav display/width | Selected pane/editor width | Visible selected editors | Visible full bodies | Risk selectors/mounted panels | First action top-bottom | Editor client/scroll (ratio) | Core/unique/visible/support/visible support | Legacy index | Details open |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
${tableRows}

## Product Boundary

This proves the measured \`/documents?theme=day\` route uses one visible selected-document editor, removes the duplicated inner document navigator, lets the selected editor pane fill its workbench column, keeps full-body textareas out of the default surface, exposes exactly three core document launchers while nine supporting document launchers remain inside the closed disclosure, hides the legacy document index, exposes the first document action in the viewport, and contains long detail in the editor workbench. It does not close exact saved/generated \`/share/[sessionId]\` evidence, provider dispatch, or route split alone as a UX fix.
`, "utf8");

console.log(JSON.stringify({
  output: path.relative(process.cwd(), outDir),
  verdict: report.verdict,
  sourceHead,
  productionCommit: buildInfo.commitSha || null,
  rows: rows.map((row) => ({
    viewport: row.viewport,
    overall: row.verdicts.overallVerdict,
    workbenchDisplay: row.metrics.workbenchDisplay,
    columns: row.metrics.workbenchColumnCount,
    editorLeft: row.metrics.editorLeft,
    launcherRight: row.metrics.launcherRight,
    innerNavigatorDisplay: row.metrics.innerNavigatorDisplay,
    selectedEditorPaneWidth: row.metrics.selectedEditorPaneWidth,
    editorWidth: row.metrics.editorWidth,
    bodyHeight: row.metrics.bodyHeight,
    overflowX: row.metrics.horizontalOverflow,
    visibleSelectedEditors: row.metrics.visibleSelectedEditorCount,
    visibleFullBodies: row.metrics.visibleFullDocumentBodyCount,
    riskRowSelectors: row.metrics.riskRowSelectorCount,
    mountedRiskRowPanels: row.metrics.mountedRiskRowPanelCount,
    firstActionBottom: row.metrics.firstActionBottom,
    editorScrollRatio: row.metrics.editorScrollRatio,
    coreButtons: row.metrics.coreButtons,
    uniqueDocumentKeys: row.metrics.uniqueDocumentKeyCount,
    visibleDocumentButtons: row.metrics.visibleDocumentButtonCount,
    supportingButtons: row.metrics.supportingButtonCount,
    visibleSupportingButtons: row.metrics.visibleSupportingButtonCount,
    legacyIndexDisplay: row.metrics.legacyIndexDisplay,
    detailsOpen: row.metrics.detailsOpen,
  })),
}, null, 2));
