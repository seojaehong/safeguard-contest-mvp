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
      const candidateEndState = await page.evaluate(() => {
        const buttons = [...document.querySelectorAll("[data-candidate-button]")];
        const selectedIndex = buttons.findIndex((button) => button.getAttribute("aria-selected") === "true");
        const selectedRect = buttons[selectedIndex]?.getBoundingClientRect();
        const listRect = document.querySelector(".candidate-list")?.getBoundingClientRect();
        return {
          selectedIndex,
          focusedIndex: buttons.findIndex((button) => button === document.activeElement),
          selectedFullyVisible: Boolean(selectedRect && listRect
            && selectedRect.left >= listRect.left
            && selectedRect.right <= listRect.right),
        };
      });
      await page.keyboard.press("Home");
      const candidateHomeState = await page.evaluate(() => {
        const buttons = [...document.querySelectorAll("[data-candidate-button]")];
        const selectedIndex = buttons.findIndex((button) => button.getAttribute("aria-selected") === "true");
        const selectedRect = buttons[selectedIndex]?.getBoundingClientRect();
        const listRect = document.querySelector(".candidate-list")?.getBoundingClientRect();
        return {
          selectedIndex,
          focusedIndex: buttons.findIndex((button) => button === document.activeElement),
          selectedFullyVisible: Boolean(selectedRect && listRect
            && selectedRect.left >= listRect.left
            && selectedRect.right <= listRect.right),
        };
      });
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
          candidateList: rectangle(".candidate-list"),
          candidateRailHeaderDisplay: style(".candidate-rail-header")?.display ?? "",
          candidateContext: rectangle("[data-candidate-context]"),
          candidateContextText: element("[data-candidate-context]")?.textContent?.trim() ?? "",
          selectedCandidateText: element('[data-candidate-button][aria-selected="true"]')?.textContent?.replace(/\s+/g, " ").trim() ?? "",
          firstCandidateButtonWidth: rectangle('[data-candidate-button="0"]')?.width ?? 0,
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
          draftStatusRole: element("[data-draft-status]")?.getAttribute("role") ?? "",
          draftStatusLiveMode: element("[data-draft-status]")?.getAttribute("aria-live") ?? "",
          draftStatusText: element("[data-draft-status]")?.textContent?.trim() ?? "",
          draftStatusVisible: element("[data-draft-status]") instanceof HTMLElement
            && element("[data-draft-status]").getClientRects().length > 0,
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
          evidenceReceiptCount: document.querySelectorAll("[data-evidence-receipt]").length,
          evidenceReadingCueCount: document.querySelectorAll(".evidence-reading-cue").length,
          rawExcerptDisclosureCount: document.querySelectorAll(".evidence-source-excerpt").length,
          openRawExcerptDisclosureCount: document.querySelectorAll(".evidence-source-excerpt[open]").length,
          rawExcerptTextPreserved: [...document.querySelectorAll(".evidence-source-excerpt p")]
            .every((paragraph) => (paragraph.textContent || "").trim().length > 0),
          exportInitiallyDisabled: element("[data-export]") instanceof HTMLButtonElement
            && element("[data-export]").disabled,
          nextIncompleteVisible: element("[data-next-incomplete]") instanceof HTMLButtonElement
            && element("[data-next-incomplete]").getClientRects().length > 0,
          nextIncompleteInitiallyEnabled: element("[data-next-incomplete]") instanceof HTMLButtonElement
            && !element("[data-next-incomplete]").disabled,
          firstEvidenceBottom: rectangle(".evidence-group")?.bottom ?? null,
          firstEvidenceReceiptBottom: rectangle("[data-evidence-receipt]")?.bottom ?? null,
          firstEvidenceReadingCueBottom: rectangle(".evidence-reading-cue")?.bottom ?? null,
          firstCheckBottom: rectangle(".check-row")?.bottom ?? null,
          horizontalOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
        };
      });
      let receiptAccess = null;
      if (metrics.evidenceDisplay !== "none") {
        const firstReceipt = page.locator("[data-evidence-receipt]").first();
        await firstReceipt.scrollIntoViewIfNeeded();
        receiptAccess = await page.evaluate(() => {
          const receipt = document.querySelector("[data-evidence-receipt]")?.getBoundingClientRect();
          const pane = document.querySelector(".evidence-pane")?.getBoundingClientRect();
          if (!receipt || !pane) return null;
          return {
            receiptTop: receipt.top,
            receiptBottom: receipt.bottom,
            paneTop: pane.top,
            paneBottom: pane.bottom,
            fullyVisibleInsidePane: receipt.top >= pane.top && receipt.bottom <= pane.bottom,
          };
        });
      }
      const screenshot = path.join(outputDir, `${probe.name}.png`);
      await page.screenshot({ path: screenshot, fullPage: false });
      results.push({
        name: probe.name,
        ...metrics,
        candidateEndState,
        candidateHomeState,
        mobileKeyboardState,
        receiptAccess,
        screenshot: path.relative(options.rootDir, screenshot),
      });
      await page.close();
    }
    const storagePage = await browser.newPage({ viewport: { width: 1440, height: 723 } });
    await storagePage.goto(pathToFileURL(htmlPath).href, { waitUntil: "load" });
    await storagePage.evaluate(() => localStorage.clear());
    await storagePage.reload({ waitUntil: "load" });
    const emptyDraftStatus = (await storagePage.textContent("[data-draft-status]")) || "";
    await storagePage.check('[data-check="0:0"]');
    const changedDraftStatus = (await storagePage.textContent("[data-draft-status]")) || "";
    await storagePage.reload({ waitUntil: "load" });
    const sameFingerprintPreserved = await storagePage.isChecked('[data-check="0:0"]');
    const restoredDraftStatus = (await storagePage.textContent("[data-draft-status]")) || "";
    const staleEnvelopeResult = await storagePage.evaluate(() => {
      const storageKey = "safeclaw-kosha-reviewer-cockpit-v4";
      const stored = JSON.parse(localStorage.getItem(storageKey) || "null");
      if (!stored || !Array.isArray(stored.rows)) return false;
      const fingerprint = JSON.parse(stored.candidateFingerprint || "null");
      if (!Array.isArray(fingerprint) || !fingerprint[0]?.bodySourceIdentitySha256) return false;
      const sourceIdentityPresent = fingerprint.every((row) => (
        typeof row.bodySnapshotId === "string"
        && typeof row.bodySourceIdentitySha256 === "string"
        && typeof row.officialCurrentTitle === "string"
        && typeof row.sourceTitle === "string"
        && typeof row.titleReconciled === "boolean"
        && typeof row.bodySha256 === "string"
        && typeof row.pdfSha256 === "string"
        && Array.isArray(row.evidenceReceipts)
        && row.evidenceReceipts.every((group) => Array.isArray(group.pageReceipts)
          && group.pageReceipts.every((receipt) => typeof receipt.normalizedTextSha256 === "string"))
      ));
      fingerprint[0].evidenceReceipts[0].pageReceipts[0].normalizedTextSha256 = "0".repeat(64);
      stored.candidateFingerprint = JSON.stringify(fingerprint);
      localStorage.setItem(storageKey, JSON.stringify(stored));
      return sourceIdentityPresent;
    });
    await storagePage.reload({ waitUntil: "load" });
    const staleFingerprintDiscarded = !(await storagePage.isChecked('[data-check="0:0"]'));
    const staleExportDisabled = await storagePage.isDisabled("[data-export]");
    const staleDraftNotice = (await storagePage.textContent("[data-progress-live]")) || "";
    const staleDraftStatus = (await storagePage.textContent("[data-draft-status]")) || "";
    await storagePage.click("[data-next-incomplete]");
    const nextIncompleteInitialSelectedIndex = await storagePage.evaluate(() => (
      [...document.querySelectorAll("[data-candidate-button]")]
        .findIndex((button) => button.getAttribute("aria-selected") === "true")
    ));
    for (let checkIndex = 0; checkIndex < 5; checkIndex += 1) {
      await storagePage.check(`[data-check="1:${checkIndex}"]`);
    }
    await storagePage.fill("[data-reviewer='1']", "검토자");
    await storagePage.fill("[data-reviewed-at='1']", "2026-08-27T10:30");
    await storagePage.check("[data-human-confirm='1']");
    await storagePage.click('[data-candidate-button="0"]');
    await storagePage.click("[data-next-incomplete]");
    const nextIncompleteSkippedCompletedIndex = await storagePage.evaluate(() => (
      [...document.querySelectorAll("[data-candidate-button]")]
        .findIndex((button) => button.getAttribute("aria-selected") === "true")
    ));
    await storagePage.click('[data-candidate-button="2"]');
    const titleReconciliationAccess = await storagePage.evaluate(() => {
      const panel = document.querySelector('[data-candidate-panel="2"]');
      const provenance = panel?.querySelector('[data-title-provenance="A-G-1"]');
      const heading = panel?.querySelector(".candidate-heading h1");
      return {
        candidateVisible: panel instanceof HTMLElement && !panel.hidden,
        officialCurrentTitleVisible: heading?.textContent?.includes("수직형 추락방망 설치 기술지원규정 포함") === true,
        corpusSourceTitleVisible: provenance?.textContent?.includes("수직형 추락방망 설치") === true,
        provenanceFullyVisible: provenance instanceof HTMLElement
          && provenance.getBoundingClientRect().bottom <= panel?.querySelector(".evidence-pane")?.getBoundingClientRect().bottom,
      };
    });
    const titleReconciliationScreenshot = path.join(outputDir, "desktop-title-provenance-1440x723.png");
    await storagePage.screenshot({ path: titleReconciliationScreenshot, fullPage: false });
    draftStorageIdentity = {
      sameFingerprintPreserved,
      sourceIdentityPresent: staleEnvelopeResult,
      staleEnvelopeInjected: staleEnvelopeResult,
      staleFingerprintDiscarded,
      staleExportDisabled,
      staleDraftNotice,
      emptyDraftStatus,
      changedDraftStatus,
      restoredDraftStatus,
      staleDraftStatus,
      nextIncompleteInitialSelectedIndex,
      nextIncompleteSkippedCompletedIndex,
    };
    draftStorageIdentity.titleReconciliationAccess = titleReconciliationAccess;
    draftStorageIdentity.titleReconciliationScreenshot = path.relative(options.rootDir, titleReconciliationScreenshot);
    await storagePage.close();
    const failurePage = await browser.newPage({ viewport: { width: 390, height: 723 } });
    await failurePage.addInitScript(() => {
      Storage.prototype.setItem = () => {
        throw new DOMException("storage unavailable", "QuotaExceededError");
      };
    });
    await failurePage.goto(pathToFileURL(htmlPath).href, { waitUntil: "load" });
    draftStorageIdentity.saveFailureStatus = (await failurePage.textContent("[data-draft-status]")) || "";
    await failurePage.close();
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
    && row.candidateEndState.selectedFullyVisible
    && row.candidateHomeState.selectedIndex === 0
    && row.candidateHomeState.focusedIndex === 0
    && row.candidateHomeState.selectedFullyVisible
    && row.candidateRailHeaderDisplay === "flex"
    && row.candidateContextText === "후보 1/8 · 현재 0/8 · 전체 0/64"
    && row.candidateContext?.top >= row.candidateRail?.top
    && row.candidateContext?.bottom <= row.candidateRail?.bottom
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
    && row.evidenceReceiptCount >= 24
    && row.evidenceReadingCueCount === 24
    && row.rawExcerptDisclosureCount === 24
    && row.openRawExcerptDisclosureCount === 0
    && row.rawExcerptTextPreserved
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
    && typeof desktop.firstEvidenceReceiptBottom === "number"
    && desktop.firstEvidenceReceiptBottom <= desktop.viewport.height
    && desktop.receiptAccess?.fullyVisibleInsidePane === true
    && typeof desktop.firstEvidenceReadingCueBottom === "number"
    && desktop.firstEvidenceReadingCueBottom <= desktop.viewport.height
    && typeof desktop.firstCheckBottom === "number"
    && desktop.firstCheckBottom <= desktop.viewport.height,
  );
  const mobilePass = Boolean(
    mobileEvidence
    && mobileReview
    && mobileEvidence.mobileModeDisplay === "grid"
    && mobileEvidence.firstCandidateButtonWidth >= 170
    && mobileEvidence.selectedCandidateText.includes("후보 1/8")
    && mobileEvidence.selectedCandidateText.includes("0/8")
    && mobileEvidence.candidateEndState.selectedFullyVisible
    && mobileEvidence.candidateHomeState.selectedFullyVisible
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
    && typeof mobileEvidence.firstEvidenceReceiptBottom === "number"
    && mobileEvidence.firstEvidenceReceiptBottom <= mobileEvidence.viewport.height
    && mobileEvidence.receiptAccess?.fullyVisibleInsidePane === true
    && typeof mobileEvidence.firstEvidenceReadingCueBottom === "number"
    && mobileEvidence.firstEvidenceReadingCueBottom <= mobileEvidence.viewport.height
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
    && draftStorageIdentity?.sourceIdentityPresent
    && draftStorageIdentity?.staleEnvelopeInjected
    && draftStorageIdentity?.staleFingerprintDiscarded
    && draftStorageIdentity?.staleExportDisabled
    && draftStorageIdentity?.staleDraftNotice.includes("후보 구성이 변경되어 이전 검토 초안을 복원하지 않았습니다.")
    && draftStorageIdentity?.emptyDraftStatus === "로컬 초안 · 빈 상태 저장됨"
    && draftStorageIdentity?.changedDraftStatus === "로컬 초안 · 변경사항 저장됨"
    && draftStorageIdentity?.restoredDraftStatus === "로컬 초안 · 저장된 입력 복원됨"
    && draftStorageIdentity?.staleDraftStatus === "로컬 초안 · 이전 초안 제외 · 빈 상태 저장됨"
    && draftStorageIdentity?.saveFailureStatus === "로컬 초안 · 저장 실패 · 입력은 현재 화면에만 유지",
  );
  const titleReconciliationPass = Boolean(
    draftStorageIdentity?.titleReconciliationAccess?.candidateVisible
    && draftStorageIdentity?.titleReconciliationAccess?.officialCurrentTitleVisible
    && draftStorageIdentity?.titleReconciliationAccess?.corpusSourceTitleVisible
    && draftStorageIdentity?.titleReconciliationAccess?.provenanceFullyVisible,
  );
  const candidateNavigationReadabilityPass = Boolean(
    results.every((row) => (
      row.candidateEndState?.selectedFullyVisible === true
      && row.candidateHomeState?.selectedFullyVisible === true
      && row.candidateContextText === "후보 1/8 · 현재 0/8 · 전체 0/64"
      && row.candidateRailHeaderDisplay === "flex"
      && row.candidateContext?.top >= row.candidateRail?.top
      && row.candidateContext?.bottom <= row.candidateRail?.bottom
    ))
    && mobileEvidence?.firstCandidateButtonWidth >= 170
    && mobileEvidence?.selectedCandidateText.includes("후보 1/8")
    && mobileEvidence?.selectedCandidateText.includes("0/8"),
  );
  const evidenceReadingHierarchyPass = results.every((row) => (
    row.evidenceReadingCueCount === 24
    && row.rawExcerptDisclosureCount === 24
    && row.openRawExcerptDisclosureCount === 0
    && row.rawExcerptTextPreserved === true
  ));
  const mobileCandidateProgressVisibilityPass = results.every((row) => (
    row.candidateRailHeaderDisplay === "flex"
    && row.candidateContextText === "후보 1/8 · 현재 0/8 · 전체 0/64"
    && row.candidateContext?.top >= row.candidateRail?.top
    && row.candidateContext?.bottom <= row.candidateRail?.bottom
  ));
  const draftPersistenceVisibilityPass = results.every((row) => (
    row.draftStatusRole === "status"
    && row.draftStatusLiveMode === "polite"
    && row.draftStatusVisible === true
    && row.draftStatusText.startsWith("로컬 초안 ·")
  ))
    && draftStorageIdentityPass;
  const nextIncompleteNavigationPass = results.every((row) => (
    row.nextIncompleteVisible === true
    && row.nextIncompleteInitiallyEnabled === true
  ))
    && draftStorageIdentity?.nextIncompleteInitialSelectedIndex === 1
    && draftStorageIdentity?.nextIncompleteSkippedCompletedIndex === 2;
  const verdict = allRowsPass
    && desktopPass
    && mobilePass
    && responsiveTabPanelPass
    && draftStorageIdentityPass
    && titleReconciliationPass
    && candidateNavigationReadabilityPass
    && evidenceReadingHierarchyPass
    && mobileCandidateProgressVisibilityPass
    && draftPersistenceVisibilityPass
    && nextIncompleteNavigationPass
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
    titleReconciliationPass,
    candidateNavigationReadabilityPass,
    evidenceReadingHierarchyPass,
    mobileCandidateProgressVisibilityPass,
    draftPersistenceVisibilityPass,
    nextIncompleteNavigationPass,
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
- Candidate End/Home visibility: ${results.every((row) => row.candidateEndState.selectedFullyVisible && row.candidateHomeState.selectedFullyVisible)}
- Candidate context: ${mobileEvidence?.candidateContextText || "missing"}
- Mobile candidate width: ${mobileEvidence?.firstCandidateButtonWidth || 0}
- Mobile evidence/review keyboard: ${[mobileEvidence, mobileReview].every((row) => row?.mobileKeyboardState?.reviewFocused === "0:review" && row?.mobileKeyboardState?.evidenceFocused === "0:evidence")}
- Breakpoint-correct tabpanels: ${report.responsiveTabPanelPass}
- Candidate-bound draft restore: ${report.draftStorageIdentityPass}
- Official/corpus title provenance: ${report.titleReconciliationPass}
- Candidate navigation readability: ${report.candidateNavigationReadabilityPass}
- Evidence reading hierarchy: ${report.evidenceReadingHierarchyPass}
- Mobile candidate progress visibility: ${report.mobileCandidateProgressVisibilityPass}
- Draft persistence visibility: ${report.draftPersistenceVisibilityPass}
- Next incomplete navigation: ${report.nextIncompleteNavigationPass}
- Evidence page receipts visible: ${results.every((row) => row.evidenceReceiptCount >= 24)}
- Draft fingerprint contains source identity: ${report.draftStorageIdentity?.sourceIdentityPresent}
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
    candidateNavigationReadabilityPass: report.candidateNavigationReadabilityPass,
    evidenceReadingHierarchyPass: report.evidenceReadingHierarchyPass,
  }, null, 2)}\n`);
}
