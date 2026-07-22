import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { chromium } from "playwright";

const outDir = path.resolve("evaluation/workspace-bounded-workbench-current-2026-07-22");
fs.mkdirSync(outDir, { recursive: true });

const baseUrl = process.env.SAFECLAW_BASE_URL || "https://www.safeclaw.kr";
const checkedAt = new Date().toISOString();
const sourceHead = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
const buildInfo = await fetch(`${baseUrl}/api/build-info?codexCacheBust=bounded-workbench-${Date.now()}`)
  .then((response) => response.json());
const baseHostname = new URL(baseUrl).hostname;
const isLiveProductionBase = baseHostname === "www.safeclaw.kr" || baseHostname === "safeclaw.kr";

const viewports = [
  { label: "desktop-short-1440x723", width: 1440, height: 723 },
  { label: "mobile-390x723", width: 390, height: 723 },
];
const themes = ["day", "night"];
const inputText = "서울 성수동 외벽 도장 작업, 작업자 5명, 신규 작업자 1명, 오후 강풍 예보. 이동식 비계와 자재 양중 동선 확인 필요.";
const fixtureSessionId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const fixtureWorkerId = "11111111-1111-4111-8111-111111111111";

const fixtureSessionPayload = {
  ok: true,
  configured: true,
  session: {
    id: fixtureSessionId,
    workpackId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    shareScope: "invited",
    question: "부산 해운대 천장 누수 보수 · 고소작업 · 베트남 작업자 1명",
    status: "active",
    expiresAt: "2099-01-01T00:00:00.000Z",
    accessPolicy: {
      anonymousAllowed: false,
      manualLanguageSwitchAllowed: true,
      requireKnownWorkerSnapshot: true,
    },
    documents: [
      {
        key: "riskAssessmentDraft",
        title: "위험성평가표",
        body: "추락 위험: 이동식 비계 고정과 안전대 착용을 확인합니다.",
      },
      {
        key: "tbmBriefing",
        title: "TBM 브리핑",
        body: "강풍 시 작업을 중지하고 관리감독자에게 보고합니다.",
      },
      {
        key: "tbmLogDraft",
        title: "TBM 기록",
        body: "작업자 전원이 위험요인과 작업중지 기준을 확인했습니다.",
      },
    ],
    recipientMessage: {
      languageCode: "vi",
      title: "Tiếng Việt 안내",
      body: "Dừng công việc khi gió mạnh.\nKiểm tra dây an toàn trước khi làm việc.",
    },
    recipients: [{
      workerId: fixtureWorkerId,
      displayName: "Server Nguyen",
      languageCode: "vi",
    }],
  },
  message: "공유 세션을 조회했습니다.",
};

function roundRect(element) {
  if (!element) return null;
  const box = element.getBoundingClientRect();
  const style = getComputedStyle(element);
  return {
    left: Math.round(box.left),
    right: Math.round(box.right),
    top: Math.round(box.top),
    bottom: Math.round(box.bottom),
    width: Math.round(box.width),
    height: Math.round(box.height),
    display: style.display,
    position: style.position,
  };
}

async function settle(page) {
  await page.evaluate(async () => {
    await document.fonts.ready;
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  });
}

async function measureDocuments(page, state, theme) {
  await settle(page);
  return page.evaluate(({ stateLabel, themeName }) => {
    const visible = (element) => {
      const box = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      const browserVisible = typeof element.checkVisibility === "function"
        ? element.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true })
        : true;
      return browserVisible && box.width > 0 && box.height > 0 && style.display !== "none" && style.visibility !== "hidden";
    };
    const inViewport = (element) => {
      const box = element.getBoundingClientRect();
      return visible(element) && box.bottom > 0 && box.top < window.innerHeight;
    };
    const outsideElements = [...document.querySelectorAll("body *")].filter((element) => {
      const box = element.getBoundingClientRect();
      return box.width > 0 && box.height > 0 && (box.left < -1 || box.right > window.innerWidth + 1);
    }).length;
    const shell = document.querySelector(".workpack-shell");
    const actions = document.querySelector('[data-testid="document-section-actions"]');
    const hazard = document.querySelector('[aria-label="행 1 유해·위험요인"]');
    const rawTextarea = document.querySelector(".document-source-textarea, .document-section-textarea");
    const supportingGroup = document.querySelector('[data-testid="supporting-document-group"]');
    const allTabButtons = [...document.querySelectorAll(".doc-tab-list button")];
    const coreButtons = allTabButtons.filter((button) =>
      ["riskAssessmentDraft", "tbmBriefing", "tbmLogDraft"].includes(button.getAttribute("data-document-key") || "")
    );
    const mobileOptions = [...document.querySelectorAll('select[aria-label="편집 문서 선택"] option')];
    const documentBodies = [...document.querySelectorAll('[data-testid="editor-document-body"], [role="tabpanel"]')];
    const rawEditors = [...document.querySelectorAll(".document-source-textarea, .document-section-textarea")];
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
    const shellRect = shell?.getBoundingClientRect();
    const hazardRect = hazard?.getBoundingClientRect();
    const hazardVisibleHeight = Math.max(
      0,
      Math.min(hazardRect?.bottom ?? 0, shellRect?.bottom ?? 0, window.innerHeight)
        - Math.max(hazardRect?.top ?? 0, shellRect?.top ?? 0, 0),
    );
    const supportOpen = supportingGroup instanceof HTMLDetailsElement ? supportingGroup.open : false;
    const actionsBottom = Math.round(actions?.getBoundingClientRect().bottom ?? 0);
    const hazardBottom = Math.round(hazardRect?.bottom ?? 0);
    const bodyHeightRatio = Number((document.documentElement.scrollHeight / window.innerHeight).toFixed(2));
    const localScrollRatio = shell ? Number((shell.scrollHeight / Math.max(1, shell.clientHeight)).toFixed(2)) : null;
    return {
      route: `/documents?theme=${themeName}`,
      theme: themeName,
      sessionKind: "live",
      state: stateLabel,
      viewport: `${window.innerWidth}x${window.innerHeight}`,
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight,
      bodyHeight: document.documentElement.scrollHeight,
      bodyHeightRatio,
      bodyTargetPass: bodyHeightRatio <= 1.5,
      bodyHardRed: bodyHeightRatio > 2,
      horizontalOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
      outsideElements,
      selectedDocumentTitle: document.querySelector(".document-toolbar .h2")?.textContent?.trim() || "",
      selectedEditorTop: Math.round(document.querySelector(".document-editor")?.getBoundingClientRect().top ?? 0),
      selectedEditorBottom: Math.round(document.querySelector(".document-editor")?.getBoundingClientRect().bottom ?? 0),
      workpackShellTop: Math.round(shellRect?.top ?? 0),
      workpackShellBottom: Math.round(shellRect?.bottom ?? 0),
      workpackShellClientHeight: shell?.clientHeight ?? 0,
      workpackShellScrollHeight: shell?.scrollHeight ?? 0,
      workpackShellScrollRatio: localScrollRatio,
      firstActionBottom: actionsBottom,
      firstHazardBottom: hazardBottom,
      firstHazardVisibleHeight: Math.round(hazardVisibleHeight),
      rawTextareaTop: Math.round(rawTextarea?.getBoundingClientRect().top ?? 0),
      visibleSelectedEditorCount: document.querySelector(".document-editor") && visible(document.querySelector(".document-editor")) ? 1 : 0,
      visibleFullDocumentBodyCount: documentBodies.filter(inViewport).length,
      visibleRawEditorCount: rawEditors.filter(inViewport).length,
      fullDocumentBodiesSeriallyVisible: documentBodies.filter(inViewport).length > 1 || rawEditors.filter(inViewport).length > 1,
      supportingDocsOpenDefault: supportOpen,
      supportingDocButtonCount: document.querySelectorAll('[data-testid="supporting-document-group"] button').length,
      supportingDocButtonsVisible: [...document.querySelectorAll('[data-testid="supporting-document-group"] button')].filter(visible).length,
      allDocumentLauncherCount: allTabButtons.length || mobileOptions.length,
      coreDocButtonCount: coreButtons.length || mobileOptions.filter((option) => ["위험성평가표", "TBM 브리핑", "TBM 기록"].includes(option.textContent?.trim() || "")).length,
      stickyOverlapCount: stickyCandidates.filter((element) => rawTextarea ? overlap(element, rawTextarea) : false).length,
      supportingLauncherMovesEditorOutOfView: supportOpen && (actionsBottom > window.innerHeight || hazardBottom > window.innerHeight || (hazardRect?.top ?? 0) < 0),
    };
  }, { stateLabel: state, themeName: theme });
}

function documentsVerdict(metrics) {
  const firstTaskPass = metrics.selectedDocumentTitle === "위험성평가표"
    && metrics.firstActionBottom <= metrics.viewportHeight
    && metrics.firstHazardBottom <= metrics.viewportHeight
    && metrics.firstHazardVisibleHeight >= 44
    && metrics.visibleSelectedEditorCount === 1
    && metrics.horizontalOverflow === false
    && metrics.outsideElements === 0
    && metrics.stickyOverlapCount === 0;
  const longContentContained = metrics.fullDocumentBodiesSeriallyVisible === false
    && metrics.supportingLauncherMovesEditorOutOfView === false
    && metrics.visibleFullDocumentBodyCount <= 1;
  return {
    firstTaskVerdict: firstTaskPass ? "PASS" : "RED",
    bodyHeightVerdict: metrics.bodyTargetPass ? "PASS" : metrics.bodyHardRed ? "RED" : "PARTIAL",
    longContentContainmentVerdict: longContentContained ? "PASS" : "RED",
    detailDepthVerdict: metrics.workpackShellScrollRatio <= 3 ? "PASS" : metrics.workpackShellScrollRatio <= 5 ? "PARTIAL" : "RED",
    overallVerdict: firstTaskPass && longContentContained && !metrics.bodyHardRed ? "PASS" : "RED",
  };
}

async function measureWorkspaceShare(page, theme) {
  await page.addInitScript(() => {
    window.localStorage.clear();
    window.localStorage.setItem("safeclaw.aiMode", "template");
  });
  await page.goto(`${baseUrl}/workspace?theme=${theme}`, { waitUntil: "networkidle", timeout: 60_000 });
  await page.locator("textarea").first().fill(inputText);
  await page.getByRole("button", { name: /안전 문서 생성/u }).click();
  await page.locator(".workspace-document-page").waitFor({ state: "visible", timeout: 60_000 });
  await page.getByText(/12\/12 생성|안전 문서팩 3종 준비 완료/u).first().waitFor({ timeout: 60_000 });
  await page.getByLabel("작업공간 메뉴").getByRole("button").filter({ hasText: "공유" }).click();
  await page.locator("[data-share-root]").waitFor({ state: "visible", timeout: 30_000 });
  await settle(page);
  return page.evaluate((themeName) => {
    const readRect = (element) => {
      if (!element) return null;
      const box = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      return {
        left: Math.round(box.left),
        right: Math.round(box.right),
        top: Math.round(box.top),
        bottom: Math.round(box.bottom),
        width: Math.round(box.width),
        height: Math.round(box.height),
        display: style.display,
        position: style.position,
      };
    };
    const rect = (selector) => {
      const element = document.querySelector(selector);
      return readRect(element);
    };
    const root = rect("[data-share-root]");
    const primary = rect("[data-share-primary]");
    const preview = rect("[data-share-preview]");
    const target = rect("[data-share-owner='targets']");
    const channel = rect("[data-share-owner='channels']");
    const language = rect("[data-share-owner='language-preview']");
    const candidates = [primary, preview, target, channel, language].filter((item) => item && item.top < window.innerHeight);
    const outsideElements = [...document.querySelectorAll("body *")].filter((element) => {
      const box = element.getBoundingClientRect();
      return box.width > 0 && box.height > 0 && (box.left < -1 || box.right > window.innerWidth + 1);
    }).length;
    return {
      route: `/workspace?share&theme=${themeName}`,
      theme: themeName,
      sessionKind: "generated",
      exactSavedUserSessionReproduced: false,
      viewport: `${window.innerWidth}x${window.innerHeight}`,
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight,
      pageHeight: document.documentElement.scrollHeight,
      pageHeightRatio: Number((document.documentElement.scrollHeight / window.innerHeight).toFixed(2)),
      root,
      rootWidthRatio: root ? Number((root.width / window.innerWidth).toFixed(2)) : 0,
      primaryBottom: primary?.bottom ?? 0,
      previewBottom: preview?.bottom ?? 0,
      desktopXRegionCount: new Set(candidates.map((item) => Math.round(item.left / 80) * 80)).size,
      previewRightOfPrimary: Boolean(preview && primary && preview.left > primary.right),
      horizontalOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
      outsideElements,
      provenanceLocalVisible: Boolean(document.querySelector("[data-share-owner='language-preview']")),
    };
  }, theme);
}

async function measureRecipientFixture(page, theme) {
  await page.route("**/api/share-sessions/**", async (route) => {
    if (route.request().method() === "POST") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ ok: true, configured: true, confirmationId: "confirmation-bounded-workbench" }),
      });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(fixtureSessionPayload),
    });
  });
  await page.goto(`${baseUrl}/share/${fixtureSessionId}?workerId=${fixtureWorkerId}&theme=${theme}`, {
    waitUntil: "networkidle",
    timeout: 60_000,
  });
  await page.locator(".safeclaw-share-recipient-page").waitFor({ state: "visible", timeout: 30_000 });
  await settle(page);
  return page.evaluate((themeName) => {
    const readRect = (element) => {
      if (!element) return null;
      const box = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      return {
        left: Math.round(box.left),
        right: Math.round(box.right),
        top: Math.round(box.top),
        bottom: Math.round(box.bottom),
        width: Math.round(box.width),
        height: Math.round(box.height),
        display: style.display,
        position: style.position,
      };
    };
    const root = document.querySelector(".safeclaw-share-recipient-page");
    const confirmButton = [...document.querySelectorAll("button")].find((button) => button.textContent?.trim() === "Tôi đã xem");
    const cards = [...document.querySelectorAll(".safeclaw-share-recipient-card")]
      .map((card) => readRect(card))
      .filter((item) => item && item.width > 0 && item.height > 0);
    const firstViewportCards = cards.filter((item) => item.top < window.innerHeight);
    const outsideElements = [...document.querySelectorAll("body *")].filter((element) => {
      const box = element.getBoundingClientRect();
      return box.width > 0 && box.height > 0 && (box.left < -1 || box.right > window.innerWidth + 1);
    }).length;
    return {
      route: `/share/${"sessionId"}?workerId=${"workerId"}&theme=${themeName}`,
      theme: themeName,
      sessionKind: "fixture",
      exactSavedUserSessionReproduced: false,
      viewport: `${window.innerWidth}x${window.innerHeight}`,
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight,
      pageHeight: document.documentElement.scrollHeight,
      pageHeightRatio: Number((document.documentElement.scrollHeight / window.innerHeight).toFixed(2)),
      root: readRect(root),
      rootWidthRatio: root ? Number((root.getBoundingClientRect().width / window.innerWidth).toFixed(2)) : 0,
      confirmButtonBottom: Math.round(confirmButton?.getBoundingClientRect().bottom ?? 0),
      desktopXRegionCount: new Set(firstViewportCards.map((item) => Math.round(item.left / 80) * 80)).size,
      horizontalOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
      outsideElements,
      provenanceLocalVisible: firstViewportCards.length >= 2,
    };
  }, theme);
}

function shareVerdict(metrics) {
  const desktop = metrics.viewportWidth >= 1000;
  const primaryBottom = metrics.primaryBottom ?? metrics.confirmButtonBottom ?? 0;
  const pass = desktop
    ? metrics.rootWidthRatio >= 0.78
      && metrics.desktopXRegionCount >= 2
      && primaryBottom <= metrics.viewportHeight
      && metrics.horizontalOverflow === false
      && metrics.outsideElements === 0
    : primaryBottom <= metrics.viewportHeight
      && metrics.horizontalOverflow === false
      && metrics.outsideElements === 0;
  return {
    desktopWorkbenchVerdict: pass ? "PASS" : "RED",
    exactSavedSessionVerdict: metrics.exactSavedUserSessionReproduced ? "PASS" : "MISSING_EVIDENCE",
    overallVerdict: pass ? "PASS_SCOPED" : "RED",
  };
}

const browser = await chromium.launch({ headless: true });
const documentRows = [];
const shareRows = [];

for (const theme of themes) {
  for (const viewport of viewports) {
    const docPage = await browser.newPage({ viewport: { width: viewport.width, height: viewport.height }, deviceScaleFactor: 1 });
    try {
      await docPage.goto(`${baseUrl}/documents?theme=${theme}`, { waitUntil: "networkidle", timeout: 60_000 });
      await docPage.locator(".workpack-shell").waitFor({ state: "visible", timeout: 30_000 });
      const defaultMetrics = await measureDocuments(docPage, "default", theme);
      documentRows.push({ metrics: defaultMetrics, verdicts: documentsVerdict(defaultMetrics) });
      await docPage.screenshot({ path: path.join(outDir, `documents-default-${theme}-${viewport.label}.png`), fullPage: true });

      const riskButton = docPage.locator('[data-testid="mobile-core-document-launcher"] button[data-document-key="riskAssessmentDraft"]').first();
      if (await riskButton.count()) {
        await riskButton.click();
        await settle(docPage);
      }
      const selectedMetrics = await measureDocuments(docPage, "selected-riskAssessmentDraft", theme);
      documentRows.push({ metrics: selectedMetrics, verdicts: documentsVerdict(selectedMetrics) });

      const supportSummary = docPage.locator('[data-testid="supporting-document-group"] > summary').first();
      if (await supportSummary.count()) {
        const visible = await supportSummary.evaluate((element) => {
          const box = element.getBoundingClientRect();
          const style = getComputedStyle(element);
          return box.width > 0 && box.height > 0 && style.display !== "none" && style.visibility !== "hidden";
        });
        const open = await docPage.locator('[data-testid="supporting-document-group"]').evaluate((element) =>
          element instanceof HTMLDetailsElement && element.open
        );
        if (visible && !open) {
          await supportSummary.click();
          await settle(docPage);
        }
      }
      const allMetrics = await measureDocuments(docPage, "supporting-9-expanded-index", theme);
      documentRows.push({ metrics: allMetrics, verdicts: documentsVerdict(allMetrics) });
      await docPage.screenshot({ path: path.join(outDir, `documents-supporting-expanded-${theme}-${viewport.label}.png`), fullPage: true });
    } catch (error) {
      documentRows.push({
        metrics: { route: `/documents?theme=${theme}`, theme, state: "probe-error", viewport: `${viewport.width}x${viewport.height}` },
        verdicts: { overallVerdict: "ERROR", error: error instanceof Error ? error.message : String(error) },
      });
    } finally {
      await docPage.close();
    }

    const sharePage = await browser.newPage({ viewport: { width: viewport.width, height: viewport.height }, deviceScaleFactor: 1 });
    try {
      const metrics = await measureWorkspaceShare(sharePage, theme);
      shareRows.push({ metrics, verdicts: shareVerdict(metrics) });
      await sharePage.screenshot({ path: path.join(outDir, `workspace-share-${theme}-${viewport.label}.png`), fullPage: true });
    } catch (error) {
      shareRows.push({
        metrics: { route: `/workspace?share&theme=${theme}`, theme, sessionKind: "generated", viewport: `${viewport.width}x${viewport.height}` },
        verdicts: { overallVerdict: "ERROR", error: error instanceof Error ? error.message : String(error) },
      });
    } finally {
      await sharePage.close();
    }

    const recipientPage = await browser.newPage({ viewport: { width: viewport.width, height: viewport.height }, deviceScaleFactor: 1 });
    try {
      const metrics = await measureRecipientFixture(recipientPage, theme);
      shareRows.push({ metrics, verdicts: shareVerdict(metrics) });
      await recipientPage.screenshot({ path: path.join(outDir, `recipient-fixture-${theme}-${viewport.label}.png`), fullPage: true });
    } catch (error) {
      shareRows.push({
        metrics: { route: "/share/[sessionId]", theme, sessionKind: "fixture", viewport: `${viewport.width}x${viewport.height}` },
        verdicts: { overallVerdict: "ERROR", error: error instanceof Error ? error.message : String(error) },
      });
    } finally {
      await recipientPage.close();
    }
  }
}

await browser.close();

const missingExactSavedSession = {
  route: "/share/[sessionId] exact saved/generated user session",
  sessionKind: "saved-exact",
  exactSavedUserSessionReproduced: false,
  verdict: "MISSING_EVIDENCE",
  reason: "No concrete production share session URL, saved session id, or user-observed generated payload was available. Fixture/generated PASS remains scoped and cannot close the exact user complaint.",
};

const documentFailures = documentRows.filter((row) => row.verdicts.overallVerdict !== "PASS");
const documentDetailDepthDebts = documentRows.filter((row) => row.verdicts.detailDepthVerdict && row.verdicts.detailDepthVerdict !== "PASS");
const shareFailures = shareRows.filter((row) => row.verdicts.overallVerdict === "RED" || row.verdicts.overallVerdict === "ERROR");
const passVerdict = isLiveProductionBase
  ? "PASS_LIVE_PRODUCTION_SCOPED_WITH_EXACT_SESSION_GAP"
  : "PASS_CURRENT_SOURCE_LOCAL_PRODUCTION_SCOPED_WITH_EXACT_SESSION_GAP";
const partialDetailDepthVerdict = isLiveProductionBase
  ? "PARTIAL_LIVE_PRODUCTION_SCOPED_DETAIL_DEPTH_DEBT_WITH_EXACT_SESSION_GAP"
  : "PARTIAL_CURRENT_SOURCE_LOCAL_PRODUCTION_SCOPED_DETAIL_DEPTH_DEBT_WITH_EXACT_SESSION_GAP";
const redVerdict = isLiveProductionBase
  ? "PARTIAL_OR_RED_LIVE_PRODUCTION_MEASURED"
  : "PARTIAL_OR_RED_CURRENT_SOURCE_LOCAL_PRODUCTION_MEASURED";
const report = {
  schemaVersion: "safeclaw-workspace-bounded-workbench-current/v1",
  checkedAt,
  baseUrl,
  measurementMode: isLiveProductionBase ? "live-production" : "current-source-local-production",
  sourceHead,
  productionCommit: buildInfo.commitSha || "",
  productionBuild: buildInfo,
  routeSplitAloneAcceptedAsFix: false,
  providerDispatchLiveClaimed: false,
  externalProviderCalled: false,
  dbMutationPerformed: false,
  verdict: documentFailures.length === 0 && shareFailures.length === 0
    ? documentDetailDepthDebts.length === 0 ? passVerdict : partialDetailDepthVerdict
    : redVerdict,
  interpretation: "This gate measures the bounded-workbench contract directly. Route/page split is orientation only; PASS requires first-task visibility and bounded simultaneous scope, while exact saved Share sessions remain separate evidence. Detail-depth debt tracks whether long work moved into a local shell that can still feel long even when body-level page height is bounded.",
  acceptance: {
    documents: {
      desktopTargetScreens: 1.5,
      desktopHardRedScreens: 2,
      mobileViewport: "390x723",
      primaryTask: "selected risk-assessment action row and first hazard field inside viewport; only one selected editor/body visible; supporting 9 must not move the selected editor out of view",
    },
    shareResult: {
      desktopMinColumns: 2,
      exactSavedSessionRequiredForUserSpecificPass: true,
      primaryTask: "desktop workbench regions with primary action in viewport; mobile stack allowed only for 390px",
    },
  },
  documents: documentRows,
  documentDetailDepthDebts: documentDetailDepthDebts.map((row) => ({
    route: row.metrics.route,
    theme: row.metrics.theme,
    state: row.metrics.state,
    viewport: row.metrics.viewport,
    workpackShellScrollRatio: row.metrics.workpackShellScrollRatio,
    detailDepthVerdict: row.verdicts.detailDepthVerdict,
  })),
  share: shareRows,
  exactSavedSession: missingExactSavedSession,
};

fs.writeFileSync(path.join(outDir, "report.json"), `${JSON.stringify(report, null, 2)}\n`, "utf8");

function documentsRow(row) {
  const metrics = row.metrics;
  const verdicts = row.verdicts;
  return `| ${metrics.route} | ${metrics.theme} | ${metrics.state} | ${metrics.viewport} | ${verdicts.overallVerdict} | ${verdicts.firstTaskVerdict || "n/a"} | ${verdicts.bodyHeightVerdict || "n/a"} | ${verdicts.longContentContainmentVerdict || "n/a"} | ${verdicts.detailDepthVerdict || "n/a"} | ${metrics.bodyHeightRatio ?? "n/a"} | ${metrics.workpackShellScrollRatio ?? "n/a"} | ${metrics.firstActionBottom ?? "n/a"} | ${metrics.firstHazardBottom ?? "n/a"} | ${metrics.visibleSelectedEditorCount ?? "n/a"} | ${metrics.visibleFullDocumentBodyCount ?? "n/a"} | ${metrics.supportingDocsOpenDefault ?? "n/a"} | ${metrics.supportingLauncherMovesEditorOutOfView ?? "n/a"} | ${metrics.stickyOverlapCount ?? "n/a"} | ${metrics.horizontalOverflow ?? "n/a"} |`;
}

function shareRow(row) {
  const metrics = row.metrics;
  const verdicts = row.verdicts;
  return `| ${metrics.route} | ${metrics.theme} | ${metrics.sessionKind} | ${metrics.viewport} | ${verdicts.overallVerdict} | ${verdicts.desktopWorkbenchVerdict || "n/a"} | ${verdicts.exactSavedSessionVerdict || "n/a"} | ${metrics.pageHeightRatio ?? "n/a"} | ${metrics.rootWidthRatio ?? "n/a"} | ${metrics.desktopXRegionCount ?? "n/a"} | ${metrics.primaryBottom ?? metrics.confirmButtonBottom ?? "n/a"} | ${metrics.horizontalOverflow ?? "n/a"} |`;
}

fs.writeFileSync(path.join(outDir, "report.md"), `# Workspace Bounded Workbench Current Gate

Checked at: ${checkedAt}

Base URL: \`${baseUrl}\`

Source HEAD: \`${sourceHead}\`

Production \`/api/build-info\`: \`${report.productionCommit || "unknown"}\`

Verdict: \`${report.verdict}\`

Route split alone accepted as fix: \`false\`

Provider live dispatch claimed: \`false\`

External provider called: \`false\`

DB mutation performed: \`false\`

## Interpretation

${report.interpretation}

Allowed claim: measured routes can pass the scoped bounded-workbench contract when their rows pass. Forbidden claim: page split alone fixes the long-page issue, or fixture/generated Share proof closes an exact saved user session.

## Documents

| Route | Theme | State | Viewport | Overall | First task | Body height | Long containment | Detail depth | Body ratio | Shell scroll ratio | First action bottom | Hazard bottom | Selected editors | Full bodies visible | Supporting open | Support moves editor | Sticky overlap | OverflowX |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
${documentRows.map(documentsRow).join("\n")}

## Documents Detail-Depth Debt

${documentDetailDepthDebts.length
    ? documentDetailDepthDebts.map((row) => `- ${row.metrics.route} ${row.metrics.theme} ${row.metrics.state} ${row.metrics.viewport}: shell scroll ratio ${row.metrics.workpackShellScrollRatio} => ${row.verdicts.detailDepthVerdict}`).join("\n")
    : "- none"}

## Share / Result

| Route | Theme | Session kind | Viewport | Overall | Desktop workbench | Exact saved session | Page ratio | Root width ratio | X regions | Primary bottom | OverflowX |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
${shareRows.map(shareRow).join("\n")}

## Missing Exact Session Evidence

- Route: \`${missingExactSavedSession.route}\`
- Verdict: \`${missingExactSavedSession.verdict}\`
- Reason: ${missingExactSavedSession.reason}

## Product Structure Decision

사용자 질문에 대한 답은 유지한다: 페이지 수를 늘리는 것만으로는 해결이 아니다. 실제 해결은 route split plus first-viewport cockpit plus selected-only bounded workbench plus drilldown/local scroll이다. Documents는 core-3/supporting-9 index와 선택 문서 1개 작업대여야 하고, Share/Result는 desktop에서 2-3 region workbench여야 한다.
`, "utf8");

console.log(JSON.stringify({
  output: path.relative(process.cwd(), outDir),
  verdict: report.verdict,
  sourceHead,
  productionCommit: buildInfo.commitSha,
  documentFailures: documentFailures.map((row) => ({
    route: row.metrics.route,
    theme: row.metrics.theme,
    state: row.metrics.state,
    viewport: row.metrics.viewport,
    verdicts: row.verdicts,
  })),
  documentDetailDepthDebts: documentDetailDepthDebts.map((row) => ({
    route: row.metrics.route,
    theme: row.metrics.theme,
    state: row.metrics.state,
    viewport: row.metrics.viewport,
    workpackShellScrollRatio: row.metrics.workpackShellScrollRatio,
    detailDepthVerdict: row.verdicts.detailDepthVerdict,
  })),
  shareFailures: shareFailures.map((row) => ({
    route: row.metrics.route,
    theme: row.metrics.theme,
    sessionKind: row.metrics.sessionKind,
    viewport: row.metrics.viewport,
    verdicts: row.verdicts,
  })),
  exactSavedSession: missingExactSavedSession.verdict,
}, null, 2));
