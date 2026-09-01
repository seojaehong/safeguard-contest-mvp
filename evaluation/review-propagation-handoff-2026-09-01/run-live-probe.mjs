import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { chromium } from "playwright";

const artifactDir = dirname(fileURLToPath(import.meta.url));
const screenshotDir = join(artifactDir, "after-live", "screenshots");
const baseUrl = (process.env.SAFECLAW_BASE_URL || "https://www.safeclaw.kr").replace(/\/$/u, "");
const cacheBust = `review-handoff-${Date.now()}`;
const currentWorkpackStorageKey = "safeclaw.currentWorkpack.v1";
const generationFingerprint = `live-template-${cacheBust}`;
const productCommit = "4bfcf5163d56e7a7c6f94df331718d2a528a2364";
const evidenceCommit = "b1dc11d6cdf1c8e19ccc0c024f099276f779fb47";
const geometryCommit = "e0651e99910a78d7b70cde4629d1697c7f559d2b";
const cascadeFixCommit = "7af241265a21fec02f79830ec8e598c287735db0";

async function buildInfo() {
  const response = await fetch(`${baseUrl}/api/build-info?codexCacheBust=${cacheBust}`);
  if (!response.ok) throw new Error(`build-info failed: ${response.status}`);
  return response.json();
}

async function measure(page, route, screenshotName) {
  await page.goto(`${baseUrl}${route}${route.includes("?") ? "&" : "?"}codexCacheBust=${cacheBust}`, {
    waitUntil: "networkidle",
    timeout: 60_000
  });
  await page.locator("body").waitFor({ state: "visible", timeout: 30_000 });
  const metrics = await page.evaluate(() => {
    const rect = (selector) => document.querySelector(selector)?.getBoundingClientRect() || null;
    const handoff = document.querySelector("[data-review-propagation-handoff]");
    const reviewButton = document.querySelector('[data-testid="document-editorial-review-launch"]');
    const statusRail = document.querySelector("[data-share-desktop-status-rail]");
    const body = document.body;
    const root = document.documentElement;
    return {
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight,
      pageHeight: Math.max(body.scrollHeight, root.scrollHeight),
      pageWidth: Math.max(body.scrollWidth, root.scrollWidth),
      horizontalOverflow: Math.max(body.scrollWidth, root.scrollWidth) - window.innerWidth,
      handoffDisplay: handoff ? getComputedStyle(handoff).display : "missing",
      handoffText: handoff?.textContent?.replace(/\s+/gu, " ").trim() || "",
      reviewButtonAriaLabel: reviewButton?.getAttribute("aria-label") || "",
      reviewButtonRect: rect('[data-testid="document-editorial-review-launch"]'),
      statusRailDisplay: statusRail ? getComputedStyle(statusRail).display : "missing",
      statusRailText: statusRail?.textContent?.replace(/\s+/gu, " ").trim() || "",
      statusRailRect: rect("[data-share-desktop-status-rail]"),
      previewRect: rect("[data-share-preview]"),
      primaryRect: rect("[data-share-primary]")
    };
  });
  await page.screenshot({ path: join(screenshotDir, screenshotName), fullPage: true });
  return metrics;
}

async function templateWorkpack() {
  const response = await fetch(`${baseUrl}/api/ask`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      question: "서울 물류센터 이동식 비계 작업, 베트남 작업자 포함. 위험성평가와 TBM 문서를 준비해줘.",
      aiMode: "template"
    })
  });
  if (!response.ok) throw new Error(`template workpack failed: ${response.status}`);
  return response.json();
}

async function seedCurrentWorkpack(page, data) {
  await page.addInitScript(({ key, value }) => {
    window.localStorage.setItem(key, value);
  }, {
    key: currentWorkpackStorageKey,
    value: JSON.stringify({
      savedAt: new Date().toISOString(),
      source: "workspace",
      generationFingerprint,
      data
    })
  });
}

async function measureShare(page, screenshotName) {
  await page.goto(`${baseUrl}/workspace?theme=day&codexCacheBust=${cacheBust}`, {
    waitUntil: "networkidle",
    timeout: 60_000
  });
  await page.locator(".workspace-document-page").waitFor({ state: "visible", timeout: 30_000 });
  await page.getByLabel("작업공간 메뉴").getByRole("button").filter({ hasText: "공유" }).click();
  await page.locator("[data-share-root]").waitFor({ state: "visible", timeout: 30_000 });
  await page.evaluate(async () => {
    await document.fonts.ready;
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  });
  const metrics = await page.evaluate(() => {
    const rect = (selector) => document.querySelector(selector)?.getBoundingClientRect() || null;
    const handoff = document.querySelector("[data-review-propagation-handoff]");
    const statusRail = document.querySelector("[data-share-desktop-status-rail]");
    const body = document.body;
    const root = document.documentElement;
    return {
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight,
      pageHeight: Math.max(body.scrollHeight, root.scrollHeight),
      pageWidth: Math.max(body.scrollWidth, root.scrollWidth),
      horizontalOverflow: Math.max(body.scrollWidth, root.scrollWidth) - window.innerWidth,
      handoffDisplay: handoff ? getComputedStyle(handoff).display : "missing",
      handoffText: handoff?.textContent?.replace(/\s+/gu, " ").trim() || "",
      statusRailDisplay: statusRail ? getComputedStyle(statusRail).display : "missing",
      statusRailText: statusRail?.textContent?.replace(/\s+/gu, " ").trim() || "",
      statusRailRect: rect("[data-share-desktop-status-rail]"),
      previewRect: rect("[data-share-preview]"),
      primaryRect: rect("[data-share-primary]")
    };
  });
  await page.screenshot({ path: join(screenshotDir, screenshotName), fullPage: true });
  return metrics;
}

await mkdir(screenshotDir, { recursive: true });
const productionBuild = await buildInfo();
const generatedWorkpack = await templateWorkpack();
const browser = await chromium.launch({ headless: true });
try {
  const desktop = await browser.newPage({ viewport: { width: 1440, height: 723 } });
  const mobile = await browser.newPage({ viewport: { width: 390, height: 723 } });
  await seedCurrentWorkpack(desktop, generatedWorkpack);
  await seedCurrentWorkpack(mobile, generatedWorkpack);
  const documentsDesktop = await measure(desktop, "/documents?theme=day", "documents-desktop-short.png");
  const shareDesktop = await measureShare(desktop, "share-desktop-short.png");
  const documentsMobile = await measure(mobile, "/documents?theme=day", "documents-mobile-short.png");
  const shareMobile = await measureShare(mobile, "share-mobile-short.png");
  const checks = {
    productionContainsProductCommit: [productCommit, evidenceCommit, geometryCommit, cascadeFixCommit]
      .includes(productionBuild.commitSha),
    documentsDesktopReviewBoundaryVisible: documentsDesktop.handoffText.includes("문서 사람 검토")
      && documentsDesktop.handoffText.includes("문서 승인 아님"),
    documentsMobileReviewBoundaryAccessible: documentsMobile.reviewButtonAriaLabel.includes("브라우저 저장, 승인 아님"),
    shareDesktopSemanticRailVisible: shareDesktop.statusRailDisplay === "grid"
      && ["문서 검토", "Hermes 후보", "전송 이력"].every((label) => shareDesktop.statusRailText.includes(label)),
    shareMobileSemanticHandoffVisible: shareMobile.handoffDisplay === "grid"
      && ["문서 사람 검토", "Hermes 지식 후보", "공유·전송"].every((label) => shareMobile.handoffText.includes(label)),
    noHorizontalOverflow: [documentsDesktop, shareDesktop, documentsMobile, shareMobile]
      .every((row) => row.horizontalOverflow <= 0),
    desktopPrimaryInViewport: Boolean(shareDesktop.primaryRect)
      && shareDesktop.primaryRect.bottom <= shareDesktop.viewportHeight,
    desktopPreviewInViewport: Boolean(shareDesktop.previewRect)
      && shareDesktop.previewRect.bottom <= shareDesktop.viewportHeight,
    desktopStatusRailInViewport: Boolean(shareDesktop.statusRailRect)
      && shareDesktop.statusRailRect.bottom <= shareDesktop.viewportHeight,
    mobilePrimaryInViewport: Boolean(shareMobile.primaryRect)
      && shareMobile.primaryRect.bottom <= shareMobile.viewportHeight
  };
  const passed = Object.values(checks).every(Boolean);
  const report = {
    schema: "safeclaw-review-propagation-handoff-live/v1",
    generatedAt: new Date().toISOString(),
    verdict: passed
      ? "PASS_LIVE_PRODUCTION_REVIEW_PROPAGATION_HANDOFF"
      : "RED_LIVE_PRODUCTION_REVIEW_PROPAGATION_HANDOFF",
    baseUrl,
    productionBuild,
    checks,
    metrics: { documentsDesktop, shareDesktop, documentsMobile, shareMobile },
    mutationBoundary: {
      templateAskExecuted: true,
      templateAskProviderCalled: false,
      dbMutationPerformed: false,
      providerDispatchCalled: false,
      shareSessionCreated: false,
      vectorMutationPerformed: false,
      wikiPublicationPerformed: false,
      koshaRegistryMutationPerformed: false
    },
    remainingBoundaries: {
      exactSavedShareVerdict: "MISSING_EVIDENCE",
      hermesHumanCandidateReviewCompleted: false
    }
  };
  await writeFile(join(artifactDir, "after-live", "report.json"), `${JSON.stringify(report, null, 2)}\n`, "utf8");
  console.log(JSON.stringify({ verdict: report.verdict, productionCommit: productionBuild.commitSha, checks }, null, 2));
  if (!passed) process.exitCode = 1;
} finally {
  await browser.close();
}
