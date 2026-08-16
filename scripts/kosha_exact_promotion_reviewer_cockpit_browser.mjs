#!/usr/bin/env node
// @ts-check

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { execFileSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";
import { chromium } from "playwright";

const SCRIPT_PATH = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(SCRIPT_PATH), "..");
const DEFAULT_OUTPUT_DIR = path.join(
  "evaluation",
  "kosha-exact-promotion-reviewer-cockpit-2026-07-25",
);

/**
 * @param {string} rootDir
 */
function gitHead(rootDir) {
  return execFileSync("git", ["rev-parse", "HEAD"], {
    cwd: rootDir,
    encoding: "utf8",
  }).trim();
}

/**
 * @param {string[]} argv
 */
function parseArgs(argv) {
  const options = { rootDir: REPO_ROOT, outputDir: DEFAULT_OUTPUT_DIR };
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === "--root") options.rootDir = path.resolve(argv[++index] || "");
    else if (value === "--output") options.outputDir = argv[++index] || "";
    else throw new Error(`kosha-reviewer-cockpit-browser-unknown-argument:${value}`);
  }
  return options;
}

/**
 * @param {{rootDir: string, outputDir: string}} options
 */
export async function runBrowserProbe(options) {
  const outputDir = path.resolve(options.rootDir, options.outputDir);
  const htmlPath = path.join(outputDir, "index.html");
  if (!fs.existsSync(htmlPath)) throw new Error("kosha-reviewer-cockpit-browser-html-missing");
  const browser = await chromium.launch({ headless: true });
  const cases = [
    { name: "desktop-1440x723", width: 1440, height: 723, mobileView: null },
    { name: "mobile-evidence-390x723", width: 390, height: 723, mobileView: "evidence" },
    { name: "mobile-review-390x723", width: 390, height: 723, mobileView: "review" },
  ];
  const results = [];
  let draftStorageIdentity = null;
  try {
    for (const probe of cases) {
      const page = await browser.newPage({ viewport: { width: probe.width, height: probe.height } });
      await page.goto(pathToFileURL(htmlPath).href, { waitUntil: "load" });
      await page.focus('[data-candidate-button="0"]');
      await page.keyboard.press("End");
      const candidateEndState = await page.evaluate(() => ({
        selectedIndex: [...document.querySelectorAll("[data-candidate-button]")]
          .findIndex((button) => button.getAttribute("aria-selected") === "true"),
        focusedIndex: [...document.querySelectorAll("[data-candidate-button]")]
          .findIndex((button) => button === document.activeElement),
      }));
      await page.keyboard.press("Home");
      const candidateHomeState = await page.evaluate(() => ({
        selectedIndex: [...document.querySelectorAll("[data-candidate-button]")]
          .findIndex((button) => button.getAttribute("aria-selected") === "true"),
        focusedIndex: [...document.querySelectorAll("[data-candidate-button]")]
          .findIndex((button) => button === document.activeElement),
      }));
      let mobileKeyboardState = null;
      if (probe.mobileView) {
        await page.focus('[data-mobile-mode="0:evidence"]');
        await page.keyboard.press("End");
        const reviewSelected = await page.getAttribute('[data-mobile-mode="0:review"]', "aria-selected");
        const reviewFocused = await page.evaluate(() => document.activeElement?.getAttribute("data-mobile-mode"));
        await page.keyboard.press("Home");
        const evidenceSelected = await page.getAttribute('[data-mobile-mode="0:evidence"]', "aria-selected");
        const evidenceFocused = await page.evaluate(() => document.activeElement?.getAttribute("data-mobile-mode"));
        mobileKeyboardState = { reviewSelected, reviewFocused, evidenceSelected, evidenceFocused };
      }
      if (probe.mobileView === "review") {
        await page.click('[data-mobile-mode="0:review"]');
      }
      const metrics = await page.evaluate(() => {
        const element = (selector) => document.querySelector(selector);
        const rectangle = (selector) => element(selector)?.getBoundingClientRect() ?? null;
        const style = (selector) => {
          const target = element(selector);
          return target ? getComputedStyle(target) : null;
        };
        const visiblePanels = [...document.querySelectorAll("[data-candidate-panel]")]
          .filter((panel) => !panel.hidden);
        return {
          viewport: { width: innerWidth, height: innerHeight },
          body: {
            scrollWidth: document.documentElement.scrollWidth,
            clientWidth: document.documentElement.clientWidth,
            scrollHeight: document.documentElement.scrollHeight,
            clientHeight: document.documentElement.clientHeight,
          },
          workspace: rectangle(".workspace"),
          candidateRail: rectangle(".candidate-rail"),
          candidatePanel: rectangle('[data-candidate-panel="0"]'),
          evidencePane: rectangle(".evidence-pane"),
          reviewPane: rectangle(".review-pane"),
          candidatePanelColumns: style('[data-candidate-panel="0"]')?.gridTemplateColumns ?? "",
          mobileModeDisplay: style(".mobile-mode")?.display ?? "",
          evidenceDisplay: style(".evidence-pane")?.display ?? "",
          reviewDisplay: style(".review-pane")?.display ?? "",
          visibleCandidatePanelCount: visiblePanels.length,
          candidateButtonCount: document.querySelectorAll("[data-candidate-button]").length,
          candidateTablistRole: element(".candidate-list")?.getAttribute("role") ?? "",
          candidateTablistOrientation: element(".candidate-list")?.getAttribute("aria-orientation") ?? "",
          selectedCandidateTabCount: document.querySelectorAll('[data-candidate-button][aria-selected="true"]').length,
          tabbableCandidateTabCount: [...document.querySelectorAll("[data-candidate-button]")]
            .filter((button) => button.tabIndex === 0).length,
          candidateControlLinksValid: [...document.querySelectorAll("[data-candidate-button]")]
            .every((button) => {
              const panel = document.getElementById(button.getAttribute("aria-controls") || "");
              return panel?.getAttribute("aria-labelledby") === button.id;
            }),
          progressLiveRole: element("[data-progress-live]")?.getAttribute("role") ?? "",
          progressLiveMode: element("[data-progress-live]")?.getAttribute("aria-live") ?? "",
          mobileTablistRole: element(".mobile-mode")?.getAttribute("role") ?? "",
          selectedMobileTabCount: document.querySelectorAll('[data-candidate-panel="0"] [data-mobile-mode][aria-selected="true"]').length,
          tabbableMobileTabCount: [...document.querySelectorAll('[data-candidate-panel="0"] [data-mobile-mode]')]
            .filter((button) => button.tabIndex === 0).length,
          mobileControlLinksValid: [...document.querySelectorAll('[data-candidate-panel="0"] [data-mobile-mode]')]
            .every((button) => {
              const pane = document.getElementById(button.getAttribute("aria-controls") || "");
              return pane?.getAttribute("role") === (innerWidth <= 767 ? "tabpanel" : null)
                && (innerWidth > 767 || pane?.getAttribute("aria-labelledby") === button.id);
            }),
          selectedCandidateMobilePaneRoleCount: document.querySelectorAll(
            '[data-candidate-panel="0"] [data-mobile-pane][role="tabpanel"]',
          ).length,
          selectedCandidateVisibleMobilePaneCount: [...document.querySelectorAll(
            '[data-candidate-panel="0"] [data-mobile-pane]',
          )].filter((pane) => !pane.hidden).length,
          requiredCheckCount: document.querySelectorAll("input[data-check]").length,
          semanticGroupCount: document.querySelectorAll(".evidence-group").length,
          exportInitiallyDisabled: element("[data-export]") instanceof HTMLButtonElement
            && element("[data-export]").disabled,
          firstEvidenceBottom: rectangle(".evidence-group")?.bottom ?? null,
          firstCheckBottom: rectangle(".check-row")?.bottom ?? null,
          horizontalOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
        };
      });
      const screenshot = path.join(outputDir, `${probe.name}.png`);
      await page.screenshot({ path: screenshot, fullPage: false });
      results.push({
        name: probe.name,
        ...metrics,
        candidateEndState,
        candidateHomeState,
        mobileKeyboardState,
        screenshot: path.relative(options.rootDir, screenshot),
      });
      await page.close();
    }
    const storagePage = await browser.newPage({ viewport: { width: 1440, height: 723 } });
    await storagePage.goto(pathToFileURL(htmlPath).href, { waitUntil: "load" });
    await storagePage.check('[data-check="0:0"]');
    await storagePage.reload({ waitUntil: "load" });
    const sameFingerprintPreserved = await storagePage.isChecked('[data-check="0:0"]');
    const staleEnvelopeInjected = await storagePage.evaluate(() => {
      const storageKey = "safeclaw-kosha-reviewer-cockpit-v2";
      const stored = JSON.parse(localStorage.getItem(storageKey) || "null");
      if (!stored || !Array.isArray(stored.rows)) return false;
      stored.candidateFingerprint = "stale-candidate-fingerprint";
      localStorage.setItem(storageKey, JSON.stringify(stored));
      return true;
    });
    await storagePage.reload({ waitUntil: "load" });
    const staleFingerprintDiscarded = !(await storagePage.isChecked('[data-check="0:0"]'));
    const staleExportDisabled = await storagePage.isDisabled("[data-export]");
    const staleDraftNotice = (await storagePage.textContent("[data-progress-live]")) || "";
    draftStorageIdentity = {
      sameFingerprintPreserved,
      staleEnvelopeInjected,
      staleFingerprintDiscarded,
      staleExportDisabled,
      staleDraftNotice,
    };
    await storagePage.close();
  } finally {
    await browser.close();
  }

  const desktop = results.find((row) => row.name === "desktop-1440x723");
  const mobileEvidence = results.find((row) => row.name === "mobile-evidence-390x723");
  const mobileReview = results.find((row) => row.name === "mobile-review-390x723");
  const allRowsPass = results.every((row) => (
    row.body.scrollHeight === row.viewport.height
    && row.body.scrollWidth === row.viewport.width
    && row.visibleCandidatePanelCount === 1
    && row.candidateButtonCount === 8
    && row.candidateTablistRole === "tablist"
    && row.candidateTablistOrientation === (row.viewport.width <= 767 ? "horizontal" : "vertical")
    && row.selectedCandidateTabCount === 1
    && row.tabbableCandidateTabCount === 1
    && row.candidateControlLinksValid
    && row.candidateEndState.selectedIndex === 7
    && row.candidateEndState.focusedIndex === 7
    && row.candidateHomeState.selectedIndex === 0
    && row.candidateHomeState.focusedIndex === 0
    && row.progressLiveRole === "status"
    && row.progressLiveMode === "polite"
    && row.mobileTablistRole === "tablist"
    && row.selectedMobileTabCount === 1
    && row.tabbableMobileTabCount === 1
    && row.mobileControlLinksValid
    && row.selectedCandidateMobilePaneRoleCount === (row.viewport.width <= 767 ? 2 : 0)
    && row.selectedCandidateVisibleMobilePaneCount === (row.viewport.width <= 767 ? 1 : 2)
    && row.requiredCheckCount === 40
    && row.semanticGroupCount === 24
    && row.exportInitiallyDisabled
    && !row.horizontalOverflow
  ));
  const desktopPass = Boolean(
    desktop
    && desktop.candidateRail?.width === 230
    && desktop.evidencePane?.width >= 800
    && desktop.reviewPane?.width >= 340
    && desktop.mobileModeDisplay === "none"
    && typeof desktop.firstEvidenceBottom === "number"
    && desktop.firstEvidenceBottom <= desktop.viewport.height
    && typeof desktop.firstCheckBottom === "number"
    && desktop.firstCheckBottom <= desktop.viewport.height,
  );
  const mobilePass = Boolean(
    mobileEvidence
    && mobileReview
    && mobileEvidence.mobileModeDisplay === "grid"
    && mobileEvidence.evidenceDisplay !== "none"
    && mobileEvidence.reviewDisplay === "none"
    && mobileReview.evidenceDisplay === "none"
    && mobileReview.reviewDisplay !== "none"
    && mobileEvidence.mobileKeyboardState?.reviewSelected === "true"
    && mobileEvidence.mobileKeyboardState?.reviewFocused === "0:review"
    && mobileEvidence.mobileKeyboardState?.evidenceSelected === "true"
    && mobileEvidence.mobileKeyboardState?.evidenceFocused === "0:evidence"
    && mobileReview.mobileKeyboardState?.reviewSelected === "true"
    && mobileReview.mobileKeyboardState?.reviewFocused === "0:review"
    && mobileReview.mobileKeyboardState?.evidenceSelected === "true"
    && mobileReview.mobileKeyboardState?.evidenceFocused === "0:evidence"
    && typeof mobileEvidence.firstEvidenceBottom === "number"
    && mobileEvidence.firstEvidenceBottom <= mobileEvidence.viewport.height
    && typeof mobileReview.firstCheckBottom === "number"
    && mobileReview.firstCheckBottom <= mobileReview.viewport.height,
  );
  const responsiveTabPanelPass = results.every((row) => (
    row.mobileControlLinksValid
    && row.selectedCandidateMobilePaneRoleCount === (row.viewport.width <= 767 ? 2 : 0)
    && row.selectedCandidateVisibleMobilePaneCount === (row.viewport.width <= 767 ? 1 : 2)
  ));
  const draftStorageIdentityPass = Boolean(
    draftStorageIdentity?.sameFingerprintPreserved
    && draftStorageIdentity?.staleEnvelopeInjected
    && draftStorageIdentity?.staleFingerprintDiscarded
    && draftStorageIdentity?.staleExportDisabled
    && draftStorageIdentity?.staleDraftNotice.includes("후보 구성이 변경되어 이전 검토 초안을 복원하지 않았습니다."),
  );
  const verdict = allRowsPass
    && desktopPass
    && mobilePass
    && responsiveTabPanelPass
    && draftStorageIdentityPass
    ? "PASS_LOCAL_KOSHA_REVIEWER_COCKPIT_GEOMETRY"
    : "RED_LOCAL_KOSHA_REVIEWER_COCKPIT_GEOMETRY";
  const report = {
    schemaVersion: "safeclaw-kosha-exact-promotion-reviewer-cockpit-browser/v1",
    verdict,
    checkedAt: new Date().toISOString(),
    sourceHead: gitHead(options.rootDir),
    cases: results.length,
    passedCases: results.filter(() => allRowsPass).length,
    desktopPass,
    mobilePass,
    responsiveTabPanelPass,
    draftStorageIdentityPass,
    draftStorageIdentity,
    results,
    mutationBoundary: {
      dbMutationPerformed: false,
      providerDispatchCalled: false,
      shareSessionCreated: false,
      embeddingGenerated: false,
      vectorUploadPerformed: false,
      exactTrustRegistryMutationPerformed: false,
      exactPromotionPerformed: false,
    },
    remainingBoundary: {
      humanReviewCompleted: false,
      separatePromotionApprovalRequired: true,
    },
  };
  fs.writeFileSync(path.join(outputDir, "browser-report.json"), `${JSON.stringify(report, null, 2)}\n`, "utf8");
  fs.writeFileSync(path.join(outputDir, "browser-report.md"), `# KOSHA Reviewer Cockpit Browser Geometry

Verdict: \`${report.verdict}\`

- Cases: ${report.cases}
- Desktop bounded three-zone: ${report.desktopPass}
- Mobile evidence/review switch: ${report.mobilePass}
- Body height: desktop ${desktop?.body.scrollHeight}/${desktop?.viewport.height}, mobile ${mobileEvidence?.body.scrollHeight}/${mobileEvidence?.viewport.height}
- Desktop widths: rail ${desktop?.candidateRail?.width}, evidence ${desktop?.evidencePane?.width}, review ${desktop?.reviewPane?.width}
- Initial export disabled: ${results.every((row) => row.exportInitiallyDisabled)}
- Candidate tabs: ${results.every((row) => row.selectedCandidateTabCount === 1 && row.tabbableCandidateTabCount === 1)}
- Candidate End/Home keyboard: ${results.every((row) => row.candidateEndState.selectedIndex === 7 && row.candidateHomeState.selectedIndex === 0)}
- Mobile evidence/review keyboard: ${[mobileEvidence, mobileReview].every((row) => row?.mobileKeyboardState?.reviewFocused === "0:review" && row?.mobileKeyboardState?.evidenceFocused === "0:evidence")}
- Breakpoint-correct tabpanels: ${report.responsiveTabPanelPass}
- Candidate-bound draft restore: ${report.draftStorageIdentityPass}
- Live progress status: ${results.every((row) => row.progressLiveRole === "status" && row.progressLiveMode === "polite")}
- Horizontal overflow: ${results.some((row) => row.horizontalOverflow)}

## Boundary

The browser probe performs no DB, provider, Share, embedding, vector, publication, or exact-registry mutation. It does not complete human review and does not approve exact-trust promotion.
`, "utf8");
  if (verdict.startsWith("RED_")) process.exitCode = 1;
  return report;
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === SCRIPT_PATH;
if (isMain) {
  const report = await runBrowserProbe(parseArgs(process.argv.slice(2)));
  process.stdout.write(`${JSON.stringify({
    verdict: report.verdict,
    cases: report.cases,
    desktopPass: report.desktopPass,
    mobilePass: report.mobilePass,
    responsiveTabPanelPass: report.responsiveTabPanelPass,
    draftStorageIdentityPass: report.draftStorageIdentityPass,
  }, null, 2)}\n`);
}
