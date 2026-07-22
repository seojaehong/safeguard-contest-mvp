import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { chromium } from "playwright";

const outDir = path.resolve("evaluation/documents-long-form-ia-2026-07-22");
fs.mkdirSync(outDir, { recursive: true });

const baseUrl = process.env.SAFECLAW_BASE_URL || "https://www.safeclaw.kr";
const checkedAt = new Date().toISOString();
const sourceHead = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
const build = await (await fetch(`${baseUrl}/api/build-info?codexCacheBust=documents-long-form-${Date.now()}`)).json();
const isLiveProductionBase = /^https:\/\/(?:www\.)?safeclaw\.kr(?:\/|$)/u.test(baseUrl);

const viewports = [
  { label: "desktop-short-1440x723", width: 1440, height: 723 },
  { label: "desktop-1440x900", width: 1440, height: 900 },
  { label: "mobile-390x844", width: 390, height: 844 },
];

async function settle(page) {
  await page.evaluate(async () => {
    await document.fonts.ready;
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  });
}

async function waitForRiskCockpitLanding(page) {
  await page.waitForFunction(() => {
    const shell = document.querySelector(".workpack-shell")?.getBoundingClientRect();
    const toolbar = document.querySelector(".document-toolbar")?.getBoundingClientRect();
    const fieldStrip = document.querySelector('[data-testid="document-section-field-strip"]')?.getBoundingClientRect();
    const actions = document.querySelector('[data-testid="document-section-actions"]')?.getBoundingClientRect();
    const firstRiskRowHeader = document.querySelector('[data-testid="risk-row-editor-row"] summary')?.getBoundingClientRect();
    const firstRiskHazardField = document.querySelector('[aria-label="행 1 유해·위험요인"]')?.getBoundingClientRect();
    return Boolean(
      shell
        && toolbar
        && fieldStrip
        && actions
        && firstRiskRowHeader
        && firstRiskHazardField
        && fieldStrip.top >= toolbar.bottom + 4
        && actions.bottom <= shell.bottom
        && firstRiskRowHeader.bottom <= window.innerHeight
        && firstRiskHazardField.top <= window.innerHeight
    );
  }, undefined, { timeout: 1_000 });
}

function evaluateVerdicts(metrics) {
  const desktop = metrics.viewportWidth >= 1000;
  const firstActionLimit = desktop ? Math.min(metrics.viewportHeight, 640) : 760;
  const hazardVisibleHeight = Math.max(
    0,
    Math.min(metrics.firstRiskHazardFieldBottom, metrics.workpackShellBottom, metrics.viewportHeight)
      - Math.max(metrics.firstRiskHazardFieldTop, metrics.workpackShellTop, 0),
  );
  const firstActionCockpitPass = metrics.selectedDocumentTitle === "위험성평가표"
    && metrics.workpackShellBottom <= metrics.viewportHeight
    && metrics.fieldStripBottom <= metrics.workpackShellBottom
    && metrics.sectionActionsBottom <= Math.min(metrics.workpackShellBottom, firstActionLimit)
    && metrics.horizontalOverflow === false
    && metrics.outsideElements === 0
    && metrics.stickyOverlapCount === 0;
  const sameDocumentReselectLandingPass = metrics.sameDocumentReselectMeasured === true
    && metrics.selectedDocumentTitle === "위험성평가표"
    && metrics.fieldStripBottom <= metrics.workpackShellBottom
    && metrics.sectionActionsBottom <= Math.min(metrics.workpackShellBottom, firstActionLimit)
    && metrics.firstRiskRowHeaderBottom <= metrics.viewportHeight
    && metrics.firstRiskHazardFieldTop <= metrics.viewportHeight
    && metrics.firstRiskHazardFieldTop < metrics.rawTextareaTop
    && metrics.horizontalOverflow === false
    && metrics.outsideElements === 0;
  const selectedEditorFieldFirstPass = metrics.selectedDocumentTitle === "위험성평가표"
    && metrics.firstRiskRowHeaderBottom <= metrics.viewportHeight
    && metrics.firstRiskHazardFieldTop <= metrics.viewportHeight
    && hazardVisibleHeight >= 44
    && metrics.firstRiskHazardFieldTop < metrics.rawTextareaTop
    && metrics.sectionActionsBottom < metrics.rawTextareaTop
    && metrics.rawTextareaSecondary === true
    && metrics.firstRiskRowHeaderText.includes("근거")
    && metrics.firstRiskRowHeaderText.includes("확인");
  const allDocumentLongFormPass = metrics.visibleFullDocumentBodiesInViewport <= 1
    && metrics.supportingDocumentsOpenDefault === false
    && metrics.supportingDocButtonsVisibleDefault === 0
    && metrics.fullDocumentBodiesRenderedSerially === false;
  const selectedEditorDepthPass = metrics.workpackShellScrollHeight <= (desktop ? 1700 : 1500)
    && metrics.renderedTextareas <= 4
    && metrics.defaultOpenSectionCount <= 1;
  return {
    firstActionCockpitVerdict: firstActionCockpitPass ? "PASS" : "RED",
    selectedEditorFieldFirstVerdict: selectedEditorFieldFirstPass ? "PASS" : "RED",
    sameDocumentReselectLandingVerdict: metrics.sameDocumentReselectMeasured === true
      ? sameDocumentReselectLandingPass ? "PASS" : "RED"
      : "n/a",
    allDocumentLongFormVerdict: allDocumentLongFormPass ? "PASS" : "RED",
    selectedEditorDepthVerdict: selectedEditorDepthPass ? "PASS" : "RED",
    overallDocumentsIAVerdict: firstActionCockpitPass && selectedEditorFieldFirstPass && allDocumentLongFormPass && selectedEditorDepthPass
      ? "PASS"
      : firstActionCockpitPass || selectedEditorFieldFirstPass || allDocumentLongFormPass
        ? "PARTIAL"
        : "RED",
  };
}

function summarizeMetric(metrics) {
  return {
    bodyRatio: metrics.bodyHeightRatio,
    shell: `${metrics.workpackShellTop}-${metrics.workpackShellBottom}/${metrics.workpackShellScrollHeight}`,
    selected: metrics.selectedDocumentTitle,
    actionsBottom: metrics.sectionActionsBottom,
    hazardBottom: metrics.firstRiskHazardFieldBottom,
    rawTextareaTop: metrics.rawTextareaTop,
    textareas: metrics.renderedTextareas,
    inViewportBodies: metrics.visibleFullDocumentBodiesInViewport,
    supportingOpen: metrics.supportingDocumentsOpenDefault,
    supportingVisibleButtons: metrics.supportingDocButtonsVisibleDefault,
  };
}

async function readMetrics(page, stateLabel) {
  await settle(page);
  return page.evaluate((label) => {
    const rect = (selector) => {
      const element = document.querySelector(selector);
      if (!element) return null;
      const box = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      return {
        top: Math.round(box.top),
        bottom: Math.round(box.bottom),
        left: Math.round(box.left),
        right: Math.round(box.right),
        width: Math.round(box.width),
        height: Math.round(box.height),
        display: style.display,
        visibility: style.visibility,
        overflowY: style.overflowY,
        position: style.position,
      };
    };
    const isVisible = (element) => {
      const box = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      const browserVisible = typeof element.checkVisibility === "function"
        ? element.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true })
        : true;
      return browserVisible && box.width > 0 && box.height > 0 && style.display !== "none" && style.visibility !== "hidden";
    };
    const inViewport = (element) => {
      const box = element.getBoundingClientRect();
      return isVisible(element) && box.bottom > 0 && box.top < window.innerHeight;
    };
    const outsideElements = [...document.querySelectorAll("body *")].filter((element) => {
      const box = element.getBoundingClientRect();
      return box.width > 0 && box.height > 0 && (box.left < -1 || box.right > window.innerWidth + 1);
    }).length;
    const shell = document.querySelector(".workpack-shell");
    const toolbar = document.querySelector(".document-toolbar");
    const fieldStrip = document.querySelector('[data-testid="document-section-field-strip"]');
    const actions = document.querySelector('[data-testid="document-section-actions"]');
    const hazard = document.querySelector('[aria-label="행 1 유해·위험요인"]');
    const rawTextarea = document.querySelector(".document-source-textarea, .document-section-textarea");
    const supportingGroup = document.querySelector('[data-testid="supporting-document-group"]');
    const supportingButtons = [...document.querySelectorAll('[data-testid="supporting-document-group"] button')];
    const allTabButtons = [...document.querySelectorAll(".doc-tab-list button")];
    const coreButtons = allTabButtons.filter((button) =>
      ["riskAssessmentDraft", "tbmBriefing", "tbmLogDraft"].includes(button.getAttribute("data-document-key") || "")
    );
    const textareas = [...document.querySelectorAll(".document-textarea")];
    const sectionAccordions = [...document.querySelectorAll('[data-testid="document-section-accordion"]')];
    const stickyCandidates = [...document.querySelectorAll("body *")].filter((element) => {
      const style = getComputedStyle(element);
      const box = element.getBoundingClientRect();
      return box.width > 0 && box.height > 0 && (style.position === "sticky" || style.position === "fixed");
    });
    const overlap = (a, b) => {
      if (!a || !b) return false;
      const ar = a.getBoundingClientRect();
      const br = b.getBoundingClientRect();
      return ar.left < br.right && ar.right > br.left && ar.top < br.bottom && ar.bottom > br.top;
    };
    const rawRect = rawTextarea?.getBoundingClientRect();
    const shellRect = shell?.getBoundingClientRect();
    const visibleFullDocumentBodiesInViewport = textareas.filter(inViewport).length;
    const supportGroupOpen = supportingGroup instanceof HTMLDetailsElement ? supportingGroup.open : false;
    const supportVisibleButtons = supportingButtons.filter(isVisible).length;
    const firstRiskHeaderText = document.querySelector('[data-testid="risk-row-editor-row"] summary')?.textContent?.replace(/\s+/gu, " ").trim() || "";
    return {
      stateLabel: label,
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight,
      bodyHeight: document.documentElement.scrollHeight,
      bodyHeightRatio: Number((document.documentElement.scrollHeight / window.innerHeight).toFixed(2)),
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
      horizontalOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
      outsideElements,
      selectedDocumentTitle: document.querySelector(".document-toolbar .h2")?.textContent?.trim() || "",
      selectedDocumentSummary: document.querySelector('[data-testid="selected-document-drilldown-summary"]')?.textContent?.replace(/\s+/gu, " ").trim() || "",
      workpackShellTop: Math.round(shellRect?.top ?? 0),
      workpackShellBottom: Math.round(shellRect?.bottom ?? 0),
      workpackShellHeight: Math.round(shellRect?.height ?? 0),
      workpackShellClientHeight: shell?.clientHeight ?? 0,
      workpackShellScrollHeight: shell?.scrollHeight ?? 0,
      workpackShellOverflowY: shell ? getComputedStyle(shell).overflowY : "",
      toolbar: rect(".document-toolbar"),
      toolbarBottom: Math.round(toolbar?.getBoundingClientRect().bottom ?? 0),
      fieldStrip: rect('[data-testid="document-section-field-strip"]'),
      fieldStripBottom: Math.round(fieldStrip?.getBoundingClientRect().bottom ?? 0),
      sectionActions: rect('[data-testid="document-section-actions"]'),
      sectionActionsBottom: Math.round(actions?.getBoundingClientRect().bottom ?? 0),
      firstRiskRowHeader: rect('[data-testid="risk-row-editor-row"] summary'),
      firstRiskRowHeaderBottom: Math.round(document.querySelector('[data-testid="risk-row-editor-row"] summary')?.getBoundingClientRect().bottom ?? 0),
      firstRiskRowHeaderText: firstRiskHeaderText,
      firstRiskHazardField: rect('[aria-label="행 1 유해·위험요인"]'),
      firstRiskHazardFieldTop: Math.round(hazard?.getBoundingClientRect().top ?? 0),
      firstRiskHazardFieldBottom: Math.round(hazard?.getBoundingClientRect().bottom ?? 0),
      rawTextarea: rect(".document-source-textarea, .document-section-textarea"),
      rawTextareaTop: Math.round(rawRect?.top ?? 0),
      rawTextareaBottom: Math.round(rawRect?.bottom ?? 0),
      rawTextareaSecondary: Boolean(rawRect && shellRect && rawRect.top > shellRect.bottom),
      sameDocumentReselectMeasured: label === "same-document-reselect-riskAssessmentDraft",
      renderedTextareas: textareas.length,
      visibleFullDocumentBodiesInViewport,
      fullDocumentBodiesRenderedSerially: textareas.length > 2 || visibleFullDocumentBodiesInViewport > 1,
      defaultOpenSectionCount: sectionAccordions.filter((item) => item.open).length,
      supportingDocumentsOpenDefault: supportGroupOpen,
      supportingDocButtonsVisibleDefault: supportVisibleButtons,
      supportingDocButtonCount: supportingButtons.length,
      allDocTabButtonCount: allTabButtons.length,
      coreDocButtonCount: coreButtons.length,
      mobileCoreLauncher: rect('[data-testid="mobile-core-document-launcher"]'),
      riskLauncherPressed: document.querySelector('[data-testid="mobile-core-document-launcher"] button[data-document-key="riskAssessmentDraft"]')?.getAttribute("aria-pressed") || "",
      stickyOverlapCount: stickyCandidates.filter((item) => rawTextarea ? overlap(item, rawTextarea) : false).length,
      stickyCandidates: stickyCandidates.slice(0, 8).map((item) => {
        const box = item.getBoundingClientRect();
        return {
          className: String(item.className || item.tagName).slice(0, 80),
          top: Math.round(box.top),
          bottom: Math.round(box.bottom),
          position: getComputedStyle(item).position,
        };
      }),
    };
  }, stateLabel);
}

const browser = await chromium.launch({ headless: true });
const results = [];

for (const viewport of viewports) {
  const page = await browser.newPage({
    viewport: { width: viewport.width, height: viewport.height },
    deviceScaleFactor: 1,
  });
  try {
    await page.goto(`${baseUrl}/documents?theme=day`, { waitUntil: "networkidle", timeout: 60_000 });
    await page.locator(".workpack-shell").waitFor({ state: "visible", timeout: 30_000 });
    await settle(page);
    const defaultMetrics = await readMetrics(page, "default-documents-overview");
    const defaultVerdicts = evaluateVerdicts(defaultMetrics);
    await page.screenshot({
      path: path.join(outDir, `documents-default-${viewport.label}.png`),
      fullPage: true,
    });
    results.push({
      route: "/documents?theme=day",
      state: "default overview/cockpit",
      viewport,
      metrics: defaultMetrics,
      verdicts: defaultVerdicts,
      summary: summarizeMetric(defaultMetrics),
    });

    const riskButton = page.locator('[data-testid="mobile-core-document-launcher"] button[data-document-key="riskAssessmentDraft"]').first();
    if (await riskButton.count()) {
      await riskButton.click();
      try {
        await waitForRiskCockpitLanding(page);
      } catch {
        await settle(page);
      }
    }
    const selectedMetrics = await readMetrics(page, "same-document-reselect-riskAssessmentDraft");
    const selectedVerdicts = evaluateVerdicts(selectedMetrics);
    await page.screenshot({
      path: path.join(outDir, `documents-selected-risk-${viewport.label}.png`),
      fullPage: true,
    });
    results.push({
      route: "/documents?theme=day",
      state: "same-document riskAssessmentDraft reselect landing",
      viewport,
      metrics: selectedMetrics,
      verdicts: selectedVerdicts,
      summary: summarizeMetric(selectedMetrics),
    });

    const supportSummary = page.locator('[data-testid="supporting-document-group"] > summary').first();
    if (await supportSummary.count()) {
      const isOpen = await page.locator('[data-testid="supporting-document-group"]').evaluate((element) => element instanceof HTMLDetailsElement && element.open);
      if (!isOpen) {
        await supportSummary.click();
        await settle(page);
      }
    }
    const expandedMetrics = await readMetrics(page, "all-document-launcher-expanded");
    await page.screenshot({
      path: path.join(outDir, `documents-all-launchers-${viewport.label}.png`),
      fullPage: true,
    });
    results.push({
      route: "/documents?theme=day",
      state: "all 12 document launcher exposure",
      viewport,
      metrics: expandedMetrics,
      verdicts: {
        launcherExposureVerdict: expandedMetrics.allDocTabButtonCount >= 12
          && expandedMetrics.supportingDocButtonsVisibleDefault >= 9
          && expandedMetrics.visibleFullDocumentBodiesInViewport <= 1
          && expandedMetrics.horizontalOverflow === false
          ? "PASS"
          : "RED",
        allDocumentLongFormVerdict: expandedMetrics.fullDocumentBodiesRenderedSerially ? "RED" : "PASS",
        selectedEditorDepthVerdict: expandedMetrics.workpackShellScrollHeight <= (viewport.width >= 1000 ? 1700 : 1500)
          ? "PASS"
          : "RED",
      },
      summary: summarizeMetric(expandedMetrics),
    });
  } catch (error) {
    results.push({
      route: "/documents?theme=day",
      state: "probe-error",
      viewport,
      verdicts: { overallDocumentsIAVerdict: "ERROR" },
      error: error instanceof Error ? error.message : String(error),
    });
  } finally {
    await page.close();
  }
}

await browser.close();

const defaultAndSelected = results.filter((item) => "overallDocumentsIAVerdict" in (item.verdicts || {}));
const allOverallPass = defaultAndSelected.every((item) => item.verdicts.overallDocumentsIAVerdict === "PASS");
const anyRed = results.some((item) => Object.values(item.verdicts || {}).includes("RED") || Object.values(item.verdicts || {}).includes("ERROR"));
const report = {
  schemaVersion: "safeclaw-documents-long-form-ia/v1",
  checkedAt,
  baseUrl,
  sourceHead,
  productionBuild: build,
  providerDispatchLiveClaimed: false,
  dbMutationPerformed: false,
  routeSplitAloneAcceptedAsFix: false,
  routeSplitVerdict: "PASS_ORIENTATION_ONLY",
  verdict: allOverallPass && !anyRed
    ? isLiveProductionBase ? "PASS_LIVE_PRODUCTION_MEASURED" : "PASS_CURRENT_SOURCE_LOCAL_PRODUCTION"
    : anyRed
      ? isLiveProductionBase ? "PARTIAL_LIVE_PRODUCTION_MEASURED" : "PARTIAL_CURRENT_SOURCE_LOCAL_PRODUCTION"
      : isLiveProductionBase ? "PASS_LIVE_PRODUCTION_MEASURED" : "PASS_CURRENT_SOURCE_LOCAL_PRODUCTION",
  interpretation: "This gate separates first-action cockpit proof from the user's perceived long Documents concern. It does not claim the whole Documents page is short merely because the first risk-assessment action is visible.",
  verdictModel: {
    routeSplitVerdict: "route/page split can pass for orientation but is not accepted as the length fix",
    firstActionCockpitVerdict: "selected document header, field strip, evidence/recheck CTA, shell containment, sticky overlap 0, and no horizontal overflow",
    selectedEditorFieldFirstVerdict: "risk row header and hazard field appear before raw textarea; row header carries evidence and verification context",
    sameDocumentReselectLandingVerdict: "same risk document launcher/reselect settles inside one second with action row, first risk row header, and hazard field top before raw textarea; full field visibility remains covered by Field-first",
    allDocumentLongFormVerdict: "RED if many full bodies/raw editors render serially by default, supporting docs are open by default, or all-12 launcher exposure behaves like a long page instead of bounded navigation",
    selectedEditorDepthVerdict: "RED if the selected document editor shell remains deeper than the bounded target even though the first action is visible",
    overallDocumentsIAVerdict: "PASS only when first-action cockpit, selected field-first editor, all-document containment, and selected-editor depth all pass",
  },
  results,
};

fs.writeFileSync(path.join(outDir, "report.json"), `${JSON.stringify(report, null, 2)}\n`, "utf8");

const rows = results.map((item) => {
  const metrics = item.metrics || {};
  const verdicts = item.verdicts || {};
  return `| ${item.state} | ${item.viewport.label} | ${verdicts.overallDocumentsIAVerdict || verdicts.launcherExposureVerdict || "n/a"} | ${verdicts.firstActionCockpitVerdict || "n/a"} | ${verdicts.selectedEditorFieldFirstVerdict || "n/a"} | ${verdicts.sameDocumentReselectLandingVerdict || "n/a"} | ${verdicts.allDocumentLongFormVerdict || "n/a"} | ${verdicts.selectedEditorDepthVerdict || "n/a"} | ${metrics.bodyHeightRatio ?? "n/a"} | ${metrics.sectionActionsBottom ?? "n/a"} | ${metrics.firstRiskHazardFieldBottom ?? "n/a"} | ${metrics.rawTextareaTop ?? "n/a"} | ${metrics.visibleFullDocumentBodiesInViewport ?? "n/a"} | ${metrics.supportingDocumentsOpenDefault ?? "n/a"} | ${metrics.workpackShellScrollHeight ?? "n/a"} | ${metrics.horizontalOverflow ?? "n/a"} | ${metrics.outsideElements ?? "n/a"} |`;
});

fs.writeFileSync(path.join(outDir, "report.md"), `# Documents Long-Form IA Probe

Checked at: ${checkedAt}

Base URL: \`${baseUrl}\`

Source HEAD: \`${sourceHead}\`

Production commit: \`${build.commitSha || "unknown"}\`

Verdict: \`${report.verdict}\`

Provider live dispatch claimed: \`false\`

DB mutation performed: \`false\`

Route/page split alone accepted as fix: \`false\`

Route split verdict: \`${report.routeSplitVerdict}\`

## Interpretation

${report.interpretation}

Allowed claim: selected risk-assessment cockpit and first field/action surfaces are live-measured when the per-state metrics pass. Forbidden claim: "Documents page is short" or "full 12-document authoring IA is solved" based only on first-action visibility.

## Metrics

| State | Viewport | Overall/launcher | First action | Field-first | Reselect landing | All-doc containment | Selected-editor depth | Body ratio | CTA bottom | Hazard bottom | Raw textarea top | Bodies in viewport | Supporting open | Shell scrollHeight | OverflowX | Outside |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
${rows.join("\n")}

## Remaining UX Boundary

- Product commit \`${sourceHead.slice(0, 8)}\` is a scoped risk-assessment cockpit remediation: desktop-short, desktop 1440x900, and mobile same-document risk reselect now record first action, field-first, and reselect landing PASS when the table above shows PASS. It does not close all-12 document containment or full 12-document authoring IA.
- If \`allDocumentLongFormVerdict\` is RED or PARTIAL, product work should stay bounded to the documents route/component shell: master-detail, selected-only detail, accordion, local scroll, or drawer.
- Supporting document launcher visibility is not itself the launch fix. Default closed supporting nav is acceptable, but the all-12 exposure state remains a follow-up when it still behaves like a long serial document surface rather than bounded navigation.
- Do not use page count as the fix. Route split only helps orientation; long bodies must be locally contained.
- Share desktop perception is measured separately in \`evaluation/share-desktop-perception-2026-07-22/report.json\`.
`, "utf8");

console.log(JSON.stringify({
  output: path.relative(process.cwd(), outDir),
  verdict: report.verdict,
  sourceHead,
  productionCommit: build.commitSha,
  summaries: results.map((item) => ({
    state: item.state,
    viewport: item.viewport.label,
    verdicts: item.verdicts,
    summary: item.summary,
  })),
}, null, 2));
