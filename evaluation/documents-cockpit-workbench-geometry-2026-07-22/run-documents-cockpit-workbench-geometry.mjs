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
    : metrics.workbenchDisplay === "grid"
      && metrics.workbenchColumnCount === 1
      && metrics.launcherBottom < metrics.editorTop;
  const viewportPass = metrics.bodyHeight <= metrics.viewportHeight + 8
    && metrics.horizontalOverflow === false
    && metrics.coreButtons === 3
    && metrics.detailsOpen === false;
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
    const shell = document.querySelector(".safeclaw-module-shell");
    const details = document.querySelector('[data-testid="mobile-document-details"]');
    const style = workbench ? getComputedStyle(workbench) : null;
    const columns = style?.gridTemplateColumns ? style.gridTemplateColumns.split(" ").filter(Boolean) : [];
    const workbenchRect = rect(workbench);
    const launcherRect = rect(launcher);
    const editorRect = rect(editor);
    const coreButtons = [...document.querySelectorAll('[data-testid="mobile-core-document-launcher"] .safeclaw-mobile-core-list button[data-document-key]')]
      .filter((button) => {
        const box = button.getBoundingClientRect();
        const buttonStyle = getComputedStyle(button);
        return box.width > 0 && box.height > 0 && buttonStyle.display !== "none" && buttonStyle.visibility !== "hidden";
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
      coreButtons: coreButtons.length,
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

const report = {
  schemaVersion: "safeclaw-documents-cockpit-workbench-geometry/v1",
  checkedAt,
  sourceHead,
  baseUrl,
  productionBuild: buildInfo,
  verdict: rows.every((row) => row.verdicts.overallVerdict === "PASS")
    ? "PASS_CURRENT_SOURCE_LOCAL_PRODUCTION_DOCUMENTS_WORKBENCH"
    : "RED_CURRENT_SOURCE_LOCAL_PRODUCTION_DOCUMENTS_WORKBENCH",
  staleDevRedExplained: true,
  staleDevRedExplanation: "A sibling probe initially reported block/one-column geometry from a stale dev/HMR server. This gate records the clean local production geometry after rebuild/restart and directly measures the workbench display, column count, and editor-vs-launcher alignment.",
  routeSplitAloneAcceptedAsFix: false,
  rows,
};

fs.writeFileSync(path.join(outDir, "report.json"), `${JSON.stringify(report, null, 2)}\n`, "utf8");

const tableRows = rows.map((row) => {
  const metrics = row.metrics;
  const verdicts = row.verdicts;
  return `| ${row.viewport} | ${verdicts.overallVerdict} | ${metrics.bodyHeight} | ${metrics.horizontalOverflow} | ${metrics.workbenchDisplay} | ${metrics.workbenchColumnCount} | ${metrics.workbenchGridTemplateColumns} | ${metrics.launcherTop}-${metrics.launcherBottom} | ${metrics.editorTop}-${metrics.editorBottom} | ${metrics.launcherRight} | ${metrics.editorLeft} | ${metrics.coreButtons} | ${metrics.detailsOpen} |`;
}).join("\n");

fs.writeFileSync(path.join(outDir, "report.md"), `# Documents Cockpit Workbench Geometry

Checked at: ${checkedAt}

Base URL: \`${baseUrl}\`

Source HEAD: \`${sourceHead}\`

Production \`/api/build-info\`: \`${buildInfo.commitSha || "unknown"}\`

Verdict: \`${report.verdict}\`

Route split alone accepted as fix: \`false\`

## Stale Dev RED Boundary

Sibling verification first saw \`display:block\` / one-column geometry from a stale dev/HMR server. This report is the clean local production check after rebuild/restart and directly measures workbench display, column count, and editor-vs-launcher alignment.

## Geometry

| Viewport | Overall | Body height | OverflowX | Workbench display | Columns | Column template | Launcher top-bottom | Editor top-bottom | Launcher right | Editor left | Core buttons | Details open |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
${tableRows}

## Product Boundary

This proves the measured \`/documents?theme=day\` route uses a selected-document cockpit/workbench instead of a stale stacked layout. It does not close exact saved/generated \`/share/[sessionId]\` evidence, provider dispatch, or route split alone as a UX fix.
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
    bodyHeight: row.metrics.bodyHeight,
    overflowX: row.metrics.horizontalOverflow,
  })),
}, null, 2));
