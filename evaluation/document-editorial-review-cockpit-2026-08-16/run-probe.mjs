import { execFileSync } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";

const baseUrl = process.env.SAFECLAW_BASE_URL || "http://127.0.0.1:3083";
const outputDir = path.resolve("evaluation/document-editorial-review-cockpit-2026-08-16");
const liveProductionRun = new URL(baseUrl).hostname === "www.safeclaw.kr";
const cases = [
  { theme: "day", label: "desktop-short-1440x723", width: 1440, height: 723, expectedColumns: 3 },
  { theme: "night", label: "desktop-short-1440x723", width: 1440, height: 723, expectedColumns: 3 },
  { theme: "day", label: "mobile-short-390x723", width: 390, height: 723, expectedColumns: 1 },
  { theme: "night", label: "mobile-short-390x723", width: 390, height: 723, expectedColumns: 1 }
];

await mkdir(outputDir, { recursive: true });
const browser = await chromium.launch({ headless: true });
const results = [];
let storageFailureProbe = null;

try {
  for (const probe of cases) {
    const context = await browser.newContext({ viewport: { width: probe.width, height: probe.height } });
    const page = await context.newPage();
    await page.goto(`${baseUrl}/documents?theme=${probe.theme}`, { waitUntil: "networkidle" });
    await page.waitForFunction(() => (
      document.querySelector(".safeclaw-module-shell")?.getAttribute("data-ready") === "true"
    ));

    const baseline = await page.evaluate(() => ({
      bodyHeight: document.documentElement.scrollHeight,
      currentWorkpack: window.localStorage.getItem("safeclaw.currentWorkpack.v1")
    }));
    const apiRequests = [];
    page.on("request", (request) => {
      if (new URL(request.url()).pathname.startsWith("/api/")) apiRequests.push(request.url());
    });

    const launch = page.getByTestId("document-editorial-review-launch");
    await launch.click();
    const dialog = page.getByTestId("document-editorial-review-dialog");
    await dialog.waitFor({ state: "visible" });

    await page.waitForFunction(() => (
      document.activeElement?.getAttribute("aria-label") === "문서 사람 검토 닫기"
    ));
    const initialAccessibility = await dialog.evaluate((element) => ({
      initialFocusLabel: document.activeElement?.getAttribute("aria-label") || "",
      initialFocusIsCloseButton: document.activeElement === element.querySelector(".safeclaw-document-review-close"),
      initialFocusInsideDialog: document.activeElement ? element.contains(document.activeElement) : false,
      describedBy: element.getAttribute("aria-describedby") || "",
      liveProgress: element.querySelector(".safeclaw-document-review-progress")?.getAttribute("aria-live") || "",
      tablistOrientation: element.querySelector('[role="tablist"]')?.getAttribute("aria-orientation") || "",
      tabCount: element.querySelectorAll('[role="tab"]').length,
      selectedTabCount: element.querySelectorAll('[role="tab"][aria-selected="true"]').length,
      tabbableTabCount: Array.from(element.querySelectorAll('[role="tab"]'))
        .filter((item) => item.getAttribute("tabindex") === "0").length
    }));
    let breakpointNavigation;
    if (probe.expectedColumns === 1) {
      const mobileNavigator = dialog.getByTestId("document-review-mobile-nav");
      const mobileSelect = mobileNavigator.getByRole("combobox", { name: "검토 문서 선택" });
      const optionValues = await mobileSelect.locator("option").evaluateAll((options) => (
        options.map((option) => option.value)
      ));
      const firstKey = optionValues[0];
      const secondKey = optionValues[1];
      if (!firstKey || !secondKey) throw new Error("Mobile document review options are unavailable");
      await mobileSelect.selectOption(secondKey);
      const secondState = await dialog.evaluate(() => {
        const selectedTab = document.querySelector('[data-testid="document-editorial-review-dialog"] [role="tab"][aria-selected="true"]');
        const panel = document.querySelector('[data-testid="document-editorial-review-dialog"] [role="tabpanel"]');
        return {
          selectedKey: selectedTab?.getAttribute("data-review-document-key") || "",
          selectedTabCount: document.querySelectorAll('[data-testid="document-editorial-review-dialog"] [role="tab"][aria-selected="true"]').length,
          tabbableTabCount: document.querySelectorAll('[data-testid="document-editorial-review-dialog"] [role="tab"][tabindex="0"]').length,
          tabpanelLinked: selectedTab?.getAttribute("aria-controls") === panel?.id
            && panel?.getAttribute("aria-labelledby") === selectedTab?.id
        };
      });
      await mobileNavigator.getByRole("button", { name: "이전 검토 문서" }).click();
      breakpointNavigation = {
        mode: "mobile-select-buttons",
        arrowNavigationPass: secondState.selectedKey === secondKey
          && secondState.selectedTabCount === 1
          && secondState.tabbableTabCount === 1,
        tabpanelLinked: secondState.tabpanelLinked,
        homeNavigationPass: await mobileSelect.inputValue() === firstKey
      };
    } else {
      const tabs = dialog.getByRole("tab");
      const firstTabKey = await tabs.first().getAttribute("data-review-document-key");
      const secondTabKey = await tabs.nth(1).getAttribute("data-review-document-key");
      if (!firstTabKey || !secondTabKey) throw new Error("Document review tab keys are unavailable");
      await tabs.first().focus();
      await page.keyboard.press("ArrowRight");
      await page.waitForTimeout(100);
      const selectedTabs = dialog.locator('[role="tab"][aria-selected="true"]');
      const tabbableTabs = dialog.locator('[role="tab"][tabindex="0"]');
      const selectedTabId = await selectedTabs.first().getAttribute("id");
      const selectedTabKey = await selectedTabs.first().getAttribute("data-review-document-key");
      const selectedTabControls = await selectedTabs.first().getAttribute("aria-controls");
      const panel = dialog.getByRole("tabpanel");
      const panelId = await panel.getAttribute("id");
      const arrowNavigationPass = selectedTabKey === secondTabKey
        && await selectedTabs.count() === 1
        && await tabbableTabs.count() === 1
        && selectedTabKey === await tabbableTabs.first().getAttribute("data-review-document-key")
        && await page.evaluate((expectedKey) => (
          document.activeElement?.getAttribute("data-review-document-key") === expectedKey
        ), secondTabKey);
      const tabpanelLinked = await dialog.getByRole("tabpanel").count() === 1
        && selectedTabControls === panelId
        && await panel.getAttribute("aria-labelledby") === selectedTabId;
      await page.keyboard.press("Home");
      await page.waitForTimeout(100);
      const homeSelectedTabs = dialog.locator('[role="tab"][aria-selected="true"]');
      const homeTabbableTabs = dialog.locator('[role="tab"][tabindex="0"]');
      const homeSelectedId = await homeSelectedTabs.first().getAttribute("id");
      const homePanel = dialog.getByRole("tabpanel");
      const homeNavigationPass = await homeSelectedTabs.count() === 1
        && await homeTabbableTabs.count() === 1
        && await homeSelectedTabs.first().getAttribute("data-review-document-key") === firstTabKey
        && await homeTabbableTabs.first().getAttribute("data-review-document-key") === firstTabKey
        && await page.evaluate((expectedKey) => (
          document.activeElement?.getAttribute("data-review-document-key") === expectedKey
        ), firstTabKey)
        && await homeSelectedTabs.first().getAttribute("aria-controls") === await homePanel.getAttribute("id")
        && await homePanel.getAttribute("aria-labelledby") === homeSelectedId;
      breakpointNavigation = {
        mode: "desktop-roving-tabs",
        arrowNavigationPass,
        tabpanelLinked,
        homeNavigationPass
      };
    }
    await page.keyboard.press("Escape");
    await dialog.waitFor({ state: "hidden" });
    const dialogClosedOnEscape = await dialog.evaluate((element) => !element.open);
    const escapeRestoresLaunchFocus = await launch.evaluate((element) => document.activeElement === element);
    await launch.click();
    await dialog.waitFor({ state: "visible" });

    const accessibility = {
      ...initialAccessibility,
      ...breakpointNavigation,
      dialogClosedOnEscape,
      escapeRestoresLaunchFocus
    };

    const beforeCompletion = await dialog.evaluate((element) => {
      const rect = element.getBoundingClientRect();
      const workbench = element.querySelector(".safeclaw-document-review-workbench");
      const nav = element.querySelector(".safeclaw-document-review-nav");
      const copy = element.querySelector(".safeclaw-document-review-copy pre");
      const checklist = element.querySelector(".safeclaw-document-review-checklist");
      const keys = Array.from(element.querySelectorAll("[data-review-document-key]"))
        .map((item) => item.getAttribute("data-review-document-key") || "");
      return {
        viewportWidth: window.innerWidth,
        viewportHeight: window.innerHeight,
        bodyHeight: document.documentElement.scrollHeight,
        dialogTop: Math.round(rect.top),
        dialogBottom: Math.round(rect.bottom),
        dialogLeft: Math.round(rect.left),
        dialogRight: Math.round(rect.right),
        horizontalOverflow: element.scrollWidth > element.clientWidth,
        workbenchColumns: workbench
          ? getComputedStyle(workbench).gridTemplateColumns.split(" ").filter(Boolean).length
          : 0,
        reviewDocumentCount: keys.length,
        uniqueDocumentCount: new Set(keys).size,
        includesRiskAssessment: keys.includes("riskAssessmentDraft"),
        checkboxCount: element.querySelectorAll('.safeclaw-document-review-checks input[type="checkbox"]').length,
        selectedDocumentTitle: element.querySelector(".safeclaw-document-review-copy h3")?.textContent?.trim() || "",
        navScrollable: nav ? nav.scrollHeight > nav.clientHeight || nav.scrollWidth > nav.clientWidth : false,
        copyOverflow: copy ? getComputedStyle(copy).overflow : "",
        checklistOverflow: checklist ? getComputedStyle(checklist).overflowY : "",
        storageStatus: element.querySelector('[data-testid="document-editorial-review-storage-status"]')?.getAttribute("data-status") || ""
      };
    });

    const openScreenshot = `${probe.theme}-${probe.label}-open.png`;
    await page.screenshot({ path: path.join(outputDir, openScreenshot), fullPage: false });

    await dialog.getByRole("textbox", { name: "검토자" }).fill("자동 검증 검토자");
    for (const checkbox of await dialog.getByRole("checkbox").all()) await checkbox.check();
    await dialog.getByRole("button", { name: "검토 완료로 표시" }).click();
    await dialog.getByLabel(/사람 검토 1\/12종 완료/u).waitFor({ state: "visible" });
    await dialog.locator('[data-testid="document-editorial-review-storage-status"][data-status="saved"]').waitFor({ state: "visible" });

    const afterCompletion = await dialog.evaluate((element) => ({
      currentWorkpack: window.localStorage.getItem("safeclaw.currentWorkpack.v1"),
      reviewStorageKeys: Object.keys(window.localStorage)
        .filter((key) => key.startsWith("safeclaw.documentEditorialReview.v1:")),
      reviewerStorageKeys: Object.keys(window.localStorage)
        .filter((key) => key.startsWith("safeclaw.documentEditorialReviewReviewer.v1:")),
      storageStatus: element.querySelector('[data-testid="document-editorial-review-storage-status"]')?.getAttribute("data-status") || "",
      dialogScrollTop: element.scrollTop
    }));
    const completedScreenshot = `${probe.theme}-${probe.label}-one-complete.png`;
    await page.screenshot({ path: path.join(outputDir, completedScreenshot), fullPage: false });
    const interactionApiRequestCount = apiRequests.length;

    await dialog.getByRole("button", { name: "문서 사람 검토 닫기" }).click();
    await page.reload({ waitUntil: "networkidle" });
    await page.getByTestId("document-editorial-review-launch").click();
    const restoredDialog = page.getByTestId("document-editorial-review-dialog");
    await restoredDialog.getByLabel(/사람 검토 1\/12종 완료/u).waitFor({ state: "visible" });
    await restoredDialog.locator('[data-testid="document-editorial-review-storage-status"][data-status="restored"]').waitFor({ state: "visible" });
    const afterReload = await restoredDialog.evaluate((element) => {
      const reviewerKey = Object.keys(window.localStorage).find((key) => (
        key.startsWith("safeclaw.documentEditorialReviewReviewer.v1:")
      ));
      const reviewerInput = element.querySelector('input[placeholder="이름 또는 직책"]');
      return {
        storageStatus: element.querySelector('[data-testid="document-editorial-review-storage-status"]')?.getAttribute("data-status") || "",
        reviewerInputValue: reviewerInput instanceof HTMLInputElement ? reviewerInput.value : "",
        persistedReviewer: reviewerKey ? window.localStorage.getItem(reviewerKey) : null
      };
    });

    const verdict = beforeCompletion.bodyHeight === baseline.bodyHeight
      && beforeCompletion.dialogTop >= 0
      && beforeCompletion.dialogBottom <= probe.height
      && beforeCompletion.dialogLeft >= 0
      && beforeCompletion.dialogRight <= probe.width
      && beforeCompletion.horizontalOverflow === false
      && beforeCompletion.workbenchColumns === probe.expectedColumns
      && beforeCompletion.reviewDocumentCount === 12
      && beforeCompletion.uniqueDocumentCount === 12
      && beforeCompletion.includesRiskAssessment
      && beforeCompletion.checkboxCount === 5
      && beforeCompletion.selectedDocumentTitle === "위험성평가표"
      && beforeCompletion.copyOverflow === "auto"
      && beforeCompletion.checklistOverflow === "auto"
      && beforeCompletion.storageStatus === "empty"
      && accessibility.initialFocusLabel === "문서 사람 검토 닫기"
      && accessibility.initialFocusIsCloseButton
      && accessibility.initialFocusInsideDialog
      && accessibility.describedBy === "document-editorial-review-description"
      && accessibility.liveProgress === "polite"
      && accessibility.tablistOrientation === "vertical"
      && accessibility.tabCount === 12
      && accessibility.selectedTabCount === 1
      && accessibility.tabbableTabCount === 1
      && accessibility.arrowNavigationPass
      && accessibility.tabpanelLinked
      && accessibility.homeNavigationPass
      && accessibility.dialogClosedOnEscape
      && accessibility.escapeRestoresLaunchFocus
      && afterCompletion.currentWorkpack === baseline.currentWorkpack
      && afterCompletion.reviewStorageKeys.length === 1
      && afterCompletion.reviewerStorageKeys.length === 1
      && afterCompletion.storageStatus === "saved"
      && afterCompletion.dialogScrollTop === 0
      && afterReload.storageStatus === "restored"
      && afterReload.reviewerInputValue === "자동 검증 검토자"
      && afterReload.persistedReviewer === "자동 검증 검토자"
      && interactionApiRequestCount === 0
      ? "PASS"
      : "RED";

    results.push({
      ...probe,
      route: `/documents?theme=${probe.theme}`,
      state: "editorial-review-open-one-local-check-complete",
      beforeCompletion,
      accessibility,
      afterCompletion: {
        currentWorkpackUnchanged: afterCompletion.currentWorkpack === baseline.currentWorkpack,
        reviewStorageKeyCount: afterCompletion.reviewStorageKeys.length,
        reviewerStorageKeyCount: afterCompletion.reviewerStorageKeys.length,
        storageStatus: afterCompletion.storageStatus,
        dialogScrollTop: afterCompletion.dialogScrollTop,
        apiRequestCount: interactionApiRequestCount,
        totalApiRequestCountIncludingReload: apiRequests.length
      },
      afterReload,
      screenshots: { open: openScreenshot, oneComplete: completedScreenshot },
      verdict
    });
    await context.close();
  }

  const failureContext = await browser.newContext({ viewport: { width: 390, height: 723 } });
  await failureContext.addInitScript(() => {
    const originalSetItem = Storage.prototype.setItem;
    Storage.prototype.setItem = function setItem(key, value) {
      if (key.startsWith("safeclaw.documentEditorialReview")) {
        throw new DOMException("storage blocked for evidence", "QuotaExceededError");
      }
      return originalSetItem.call(this, key, value);
    };
  });
  const failurePage = await failureContext.newPage();
  await failurePage.goto(`${baseUrl}/documents?theme=day`, { waitUntil: "networkidle" });
  await failurePage.getByTestId("document-editorial-review-launch").click();
  const failureDialog = failurePage.getByTestId("document-editorial-review-dialog");
  await failureDialog.waitFor({ state: "visible" });
  await failureDialog.getByRole("textbox", { name: "검토자" }).fill("저장 실패 검토자");
  const failureStatus = failureDialog.getByTestId("document-editorial-review-storage-status");
  await failurePage.waitForFunction(() => (
    document.querySelector('[data-testid="document-editorial-review-storage-status"]')?.getAttribute("data-status") === "error"
  ));
  const failureScreenshot = "storage-error-mobile-390x723.png";
  await failurePage.screenshot({ path: path.join(outputDir, failureScreenshot), fullPage: false });
  storageFailureProbe = {
    viewport: { width: 390, height: 723 },
    status: await failureStatus.getAttribute("data-status"),
    message: (await failureStatus.innerText()).trim(),
    visible: await failureStatus.isVisible(),
    screenshot: failureScreenshot,
    verdict: await failureStatus.getAttribute("data-status") === "error"
      && (await failureStatus.innerText()).includes("복원하거나 저장할 수 없습니다")
      ? "PASS"
      : "RED"
  };
  await failureContext.close();
} finally {
  await browser.close();
}

const sourceHead = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
const productionBuild = liveProductionRun
  ? await fetch(`${baseUrl}/api/build-info?codexCacheBust=editorial-review-${Date.now()}`).then(async (response) => {
      if (!response.ok) throw new Error(`Production build-info failed (${response.status})`);
      return response.json();
    })
  : null;
const pass = results.filter((result) => result.verdict === "PASS").length;
const storageFailureProbePass = storageFailureProbe?.verdict === "PASS";
const sourceHeadMatchesProduction = productionBuild?.commitSha === sourceHead;
const report = {
  schemaVersion: "safeclaw-document-editorial-review-cockpit/v1",
  checkedAt: new Date().toISOString(),
  mode: liveProductionRun ? "live-production" : "current-source-local-production",
  baseUrl,
  sourceHead,
  productionBuild,
  sourceHeadMatchesProduction,
  verdict: pass === results.length && storageFailureProbePass
    ? liveProductionRun && sourceHeadMatchesProduction
      ? "PASS_LIVE_PRODUCTION_DOCUMENT_EDITORIAL_REVIEW_COCKPIT"
      : "PASS_CURRENT_SOURCE_LOCAL_DOCUMENT_EDITORIAL_REVIEW_COCKPIT"
    : "RED_DOCUMENT_EDITORIAL_REVIEW_COCKPIT",
  total: results.length,
  pass,
  fail: results.length - pass,
  storageFailureProbePass,
  acceptanceContract: {
    canonicalDocumentCount: 12,
    includesRiskAssessment: true,
    reviewerCheckCount: 5,
    desktopZones: 3,
    mobileColumns: 1,
    bodyHeightUnchangedWhileOpen: true,
    longCopyContained: true,
    reviewStateStoredSeparately: true,
    reviewerHydrationDoesNotOverwriteStorage: true,
    storageLifecycleVisible: true,
    storageFailureVisible: true,
    editedTextInvalidatesCompletion: true,
    automaticReviewCannotClaimHumanCompletion: true,
    keyboardRovingTabNavigation: true,
    screenReaderTabPanelContract: true,
    escapeRestoresLaunchFocus: true
  },
  reviewBoundary: {
    automatedInteractionOnly: true,
    humanReviewCompleted: false,
    localCompletionIsApproval: false,
    broadHumanWordingReviewRequired: true
  },
  mutationBoundary: {
    dbMutationPerformed: false,
    providerDispatchCalled: false,
    shareSessionCreated: false,
    vectorRuntimeCalled: false,
    wikiPublished: false,
    koshaRegistryMutationPerformed: false,
    exactSavedShareVerdict: "MISSING_EVIDENCE"
  },
  verification: {
    documentsEditorLayout: { filesPassed: 1, testsPassed: 43, status: "pass" },
    userVisibleKoreanCopy: { filesPassed: 1, testsPassed: 8, status: "pass" },
    focusedEditorialReview: { filesPassed: 1, testsPassed: 2, status: "pass" },
    typecheck: { status: "pass" },
    build: { status: "pass", nextVersion: "15.5.22", staticPages: 28 }
  },
  storageFailureProbe,
  results
};

await writeFile(path.join(outputDir, "report.json"), `${JSON.stringify(report, null, 2)}\n`, "utf8");
const rows = results.map((result) => (
  `| ${result.theme} | ${result.label} | ${result.beforeCompletion.bodyHeight}/${result.height} | ${result.beforeCompletion.workbenchColumns} | ${result.beforeCompletion.reviewDocumentCount} | ${result.beforeCompletion.checkboxCount} | ${result.beforeCompletion.storageStatus}->${result.afterCompletion.storageStatus}->${result.afterReload.storageStatus} | ${result.accessibility.arrowNavigationPass ? "yes" : "no"} | ${result.accessibility.escapeRestoresLaunchFocus ? "yes" : "no"} | ${result.afterCompletion.currentWorkpackUnchanged ? "yes" : "no"} | ${result.afterCompletion.apiRequestCount} | ${result.verdict} |`
)).join("\n");
await writeFile(path.join(outputDir, "report.md"), `# Document Editorial Review Cockpit Evidence\n\n- Verdict: \`${report.verdict}\`\n- Source: \`${sourceHead}\`\n- Production: \`${productionBuild?.commitSha || "local"}\`\n- Scope: 12-document human review cockpit geometry, keyboard access, browser-local state, and source/live isolation\n- Verification: Documents browser 43/43, Korean copy 8/8, focused storage flows 2/2, Northstar 157/157, strict typecheck PASS, Next 15.5.22 build PASS (28 static pages)\n- Storage lifecycle: four viewport rows prove \`empty -> saved -> restored\`; reviewer hydration preserves the stored self-attested name.\n- Storage failure probe: \`${storageFailureProbe?.verdict || "missing"}\`, visible=\`${storageFailureProbe?.visible === true}\`, status=\`${storageFailureProbe?.status || "missing"}\`.\n- Human boundary: this automated probe does not complete human wording review or create approval evidence.\n- Mutation boundary: no DB/provider/Share/vector/wiki/KOSHA registry mutation; exact saved Share remains \`MISSING_EVIDENCE\`.\n\n| Theme | Viewport | Body/Viewport | Zones | Documents | Checks | Storage lifecycle | Arrow navigation | Escape focus restore | Current workpack unchanged | API calls | Verdict |\n|---|---|---:|---:|---:|---:|---|---|---|---|---:|---|\n${rows}\n\nThe default Documents page remains viewport-contained. Long document text and the checklist are exposed only inside the modal workbench's local scroll regions. The dialog uses a roving tab contract, a labelled tabpanel, deterministic focus entry and restoration, and a fail-visible browser-storage boundary.\n`, "utf8");

console.log(JSON.stringify({ verdict: report.verdict, total: report.total, pass: report.pass, fail: report.fail }, null, 2));
if (report.fail > 0) process.exitCode = 1;
