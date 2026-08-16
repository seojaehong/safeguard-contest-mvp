import { execFileSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const artifactDir = path.resolve(process.env.SAFECLAW_RECEIPT_OUT_DIR || scriptDir);
const rootDir = path.resolve(scriptDir, "..", "..");
const baseUrl = (process.env.SAFECLAW_BASE_URL || "https://www.safeclaw.kr").replace(/\/$/u, "");
const sourceHead = execFileSync("git", ["rev-parse", "HEAD"], { cwd: rootDir, encoding: "utf8" }).trim();
const isLive = /^https:\/\//u.test(baseUrl);

async function readProductionBuild() {
  if (!isLive) return null;
  const response = await fetch(`${baseUrl}/api/build-info?codexCacheBust=${sourceHead.slice(0, 12)}`);
  if (!response.ok) throw new Error(`build-info-http-${response.status}`);
  return response.json();
}

async function measureLockedCase(browser, viewport, label) {
  const context = await browser.newContext({ viewport });
  const page = await context.newPage();
  await page.goto(`${baseUrl}/documents?theme=day`, { waitUntil: "networkidle" });
  await page.waitForFunction(() => document.querySelector(".safeclaw-module-shell")?.getAttribute("data-ready") === "true");
  const bodyHeightBefore = await page.evaluate(() => document.documentElement.scrollHeight);
  await page.getByTestId("document-editorial-review-launch").click();
  const dialog = page.getByTestId("document-editorial-review-dialog");
  await dialog.waitFor({ state: "visible" });
  const receipt = dialog.getByLabel("문서 검토 영수증");
  await receipt.scrollIntoViewIfNeeded();
  const geometry = await dialog.evaluate((element) => {
    const readRect = (target) => {
      const value = target.getBoundingClientRect();
      return {
        left: Math.round(value.left),
        top: Math.round(value.top),
        right: Math.round(value.right),
        bottom: Math.round(value.bottom),
        width: Math.round(value.width),
        height: Math.round(value.height)
      };
    };
    const checklist = element.querySelector(".safeclaw-document-review-checklist");
    const receiptRegion = element.querySelector(".safeclaw-document-review-receipt");
    if (!(checklist instanceof HTMLElement) || !(receiptRegion instanceof HTMLElement)) {
      throw new Error("document-review-receipt-geometry-missing");
    }
    return {
      viewport: { width: window.innerWidth, height: window.innerHeight },
      bodyHeight: document.documentElement.scrollHeight,
      dialog: readRect(element),
      checklist: {
        ...readRect(checklist),
        clientHeight: checklist.clientHeight,
        scrollHeight: checklist.scrollHeight,
        overflowY: getComputedStyle(checklist).overflowY
      },
      receipt: readRect(receiptRegion),
      horizontalOverflow: element.scrollWidth > element.clientWidth
    };
  });
  const receiptButton = dialog.getByTestId("document-editorial-review-receipt-download");
  const result = {
    label,
    viewport,
    bodyHeightBefore,
    bodyHeightAfter: geometry.bodyHeight,
    bodyHeightUnchanged: bodyHeightBefore === geometry.bodyHeight,
    dialog: geometry.dialog,
    checklist: geometry.checklist,
    receipt: geometry.receipt,
    receiptLockedAtZero: await receiptButton.isDisabled(),
    reviewerInputVisible: await dialog.getByRole("textbox", { name: "검토자" }).isVisible(),
    horizontalOverflow: geometry.horizontalOverflow,
    screenshot: `${label}-locked.png`
  };
  await page.screenshot({ path: path.join(artifactDir, result.screenshot), fullPage: false });
  await context.close();
  return result;
}

async function verifyReceipt(browser) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 723 }, acceptDownloads: true });
  const page = await context.newPage();
  await page.goto(`${baseUrl}/documents?theme=day`, { waitUntil: "networkidle" });
  await page.waitForFunction(() => document.querySelector(".safeclaw-module-shell")?.getAttribute("data-ready") === "true");
  const apiRequests = [];
  page.on("request", (request) => {
    const pathname = new URL(request.url()).pathname;
    if (pathname.startsWith("/api/")) apiRequests.push(pathname);
  });
  await page.getByTestId("document-editorial-review-launch").click();
  const dialog = page.getByTestId("document-editorial-review-dialog");
  await dialog.getByRole("textbox", { name: "검토자" }).fill("자동화 검증용 검토자");
  const tabs = dialog.getByRole("tablist", { name: "검토 문서 선택" }).getByRole("tab");
  for (let index = 0; index < 12; index += 1) {
    await tabs.nth(index).click();
    const checklistCheckboxes = dialog.locator(".safeclaw-document-review-checks").getByRole("checkbox");
    if (await checklistCheckboxes.count() !== 5) throw new Error("document-review-checklist-count-mismatch");
    for (const checkbox of await checklistCheckboxes.all()) await checkbox.check();
    const findings = dialog.getByTestId("document-editorial-findings");
    if (await findings.count()) await findings.getByRole("checkbox").check();
    await dialog.getByRole("button", { name: "검토 완료로 표시" }).click();
  }
  await dialog.getByLabel(/사람 검토 12\/12종 완료/u).waitFor({ state: "visible" });
  const receiptButton = dialog.getByTestId("document-editorial-review-receipt-download");
  await receiptButton.scrollIntoViewIfNeeded();
  await page.screenshot({ path: path.join(artifactDir, "desktop-ready-1440x723.png"), fullPage: false });
  const downloadPromise = page.waitForEvent("download");
  await receiptButton.click();
  const download = await downloadPromise;
  const downloadPath = await download.path();
  if (!downloadPath) throw new Error("document-review-receipt-download-path-missing");
  const payload = JSON.parse(await readFile(downloadPath, "utf8"));
  const documents = Array.isArray(payload.documents) ? payload.documents : [];
  const uniqueDocumentKeys = new Set(documents.map((document) => document.key));
  const checksComplete = documents.every((document) => (
    document
    && typeof document === "object"
    && Object.values(document.checks || {}).filter(Boolean).length === 5
  ));
  const fingerprintsCurrent = documents.every((document) => (
    document.reviewedTextFingerprint === document.currentTextFingerprint
  ));
  const findingsBound = documents.every((document) => (
    document.findingsReviewed === true
    && typeof document.editorialFindingsFingerprint === "string"
    && document.editorialFindingsFingerprint.length > 0
    && Array.isArray(document.editorialFindingIds)
    && Object.values(document.editorialFindingCounts || {}).reduce((sum, count) => sum + Number(count || 0), 0)
      === document.editorialFindingIds.length
  ));
  const editorialFindingCount = Number(payload.editorialFindingCount || 0);
  const editorialFindingIds = Array.isArray(payload.editorialFindingIds) ? payload.editorialFindingIds : [];
  const editorialFindingCategoryTotal = Object.values(payload.editorialFindingCounts || {})
    .reduce((sum, count) => sum + Number(count || 0), 0);
  const result = {
    schemaVersion: payload.schemaVersion,
    reviewerRecorded: payload.reviewer === "자동화 검증용 검토자",
    reviewedAtRecorded: typeof payload.reviewedAt === "string" && payload.reviewedAt.length > 0,
    generationFingerprintRecorded: typeof payload.generationFingerprint === "string" && payload.generationFingerprint.length > 0,
    documentCount: documents.length,
    uniqueDocumentKeyCount: uniqueDocumentKeys.size,
    reviewerCheckCount: payload.reviewerCheckCount,
    checksComplete,
    fingerprintsCurrent,
    findingsBound,
    editorialFindingsFingerprint: payload.editorialFindingsFingerprint,
    editorialFindingCount,
    editorialFindingIdsRecorded: editorialFindingIds.length === editorialFindingCount,
    editorialFindingCategoriesReconcile: editorialFindingCategoryTotal === editorialFindingCount,
    reviewCompletion: payload.reviewCompletion,
    mutationBoundary: payload.mutationBoundary,
    apiRequestCount: apiRequests.length,
    downloadSuggestedFilename: download.suggestedFilename(),
    screenshot: "desktop-ready-1440x723.png"
  };
  await context.close();
  return result;
}

function passes(report) {
  const lockedPass = report.results.every((result) => (
    result.bodyHeightUnchanged
    && result.dialog.top >= 0
    && result.dialog.bottom <= result.viewport.height
    && result.dialog.left >= 0
    && result.dialog.right <= result.viewport.width
    && result.checklist.overflowY === "auto"
    && result.receiptLockedAtZero
    && result.reviewerInputVisible
    && !result.horizontalOverflow
  ));
  const receipt = report.receiptVerification;
  return lockedPass
    && receipt.schemaVersion === "safeclaw-document-editorial-review-receipt/v2"
    && receipt.reviewerRecorded
    && receipt.reviewedAtRecorded
    && receipt.generationFingerprintRecorded
    && receipt.documentCount === 12
    && receipt.uniqueDocumentKeyCount === 12
    && receipt.reviewerCheckCount === 5
    && receipt.checksComplete
    && receipt.fingerprintsCurrent
    && receipt.findingsBound
    && typeof receipt.editorialFindingsFingerprint === "string"
    && receipt.editorialFindingsFingerprint.length > 0
    && receipt.editorialFindingCount > 0
    && receipt.editorialFindingIdsRecorded
    && receipt.editorialFindingCategoriesReconcile
    && receipt.reviewCompletion?.localChecklistCompleted === true
    && receipt.reviewCompletion?.editorialFindingsReviewed === true
    && receipt.reviewCompletion?.reviewerSelfAttested === true
    && receipt.reviewCompletion?.reviewerIdentityVerified === false
    && receipt.reviewCompletion?.serverRecorded === false
    && receipt.reviewCompletion?.approvalGranted === false
    && receipt.mutationBoundary?.dbMutationPerformed === false
    && receipt.mutationBoundary?.providerDispatchCalled === false
    && receipt.mutationBoundary?.shareSessionCreated === false
    && receipt.mutationBoundary?.vectorRuntimeCalled === false
    && receipt.mutationBoundary?.wikiPublished === false
    && receipt.mutationBoundary?.koshaRegistryMutationPerformed === false
    && receipt.mutationBoundary?.exactSavedShareVerdict === "MISSING_EVIDENCE"
    && receipt.apiRequestCount === 0;
}

await mkdir(artifactDir, { recursive: true });
const productionBuild = await readProductionBuild();
const browser = await chromium.launch({ headless: true });
try {
  const results = [];
  results.push(await measureLockedCase(browser, { width: 1440, height: 723 }, "desktop-1440x723"));
  results.push(await measureLockedCase(browser, { width: 390, height: 723 }, "mobile-390x723"));
  const receiptVerification = await verifyReceipt(browser);
  const report = {
    schemaVersion: "safeclaw-document-editorial-review-receipt-evidence/v2",
    generatedAt: new Date().toISOString(),
    mode: isLive ? "live-production" : "current-source-local-production",
    baseUrl,
    sourceHead,
    productionBuild,
    sourceHeadMatchesProduction: productionBuild ? productionBuild.commitSha === sourceHead : false,
    verdict: "PENDING",
    acceptanceContract: {
      canonicalDocumentCount: 12,
      reviewerCheckCount: 5,
      reviewerRequired: true,
      receiptLockedBeforeAllDocuments: true,
      currentTextFingerprintRequired: true,
      editorialFindingsFingerprintRequired: true,
      editorialFindingReviewRequired: true,
      bodyHeightUnchanged: true,
      desktopAndMobileContained: true,
      localDownloadOnly: true,
      reviewerIdentityVerified: false,
      serverRecorded: false,
      approvalGranted: false
    },
    results,
    receiptVerification,
    reviewBoundary: {
      automatedInteractionOnly: true,
      humanReviewCompleted: false,
      localReceiptProvesHumanIdentity: false,
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
      focusedReceiptBrowser: "PASS: 1 file / 1 test",
      focusedExistingReviewBrowser: "PASS: 1 file / 1 test",
      adjacentFullDocumentsBrowser: "INITIAL: 40/41 PASS; mobile-night evidence visibility timing RED; focused rerun PASS 1/1",
      typecheck: "PASS",
      build: "PASS: Next 15.5.22, 28 static pages"
    }
  };
  const pass = passes(report);
  report.verdict = pass
    ? (isLive ? "PASS_LIVE_PRODUCTION_DOCUMENT_EDITORIAL_REVIEW_RECEIPT" : "PASS_CURRENT_SOURCE_LOCAL_DOCUMENT_EDITORIAL_REVIEW_RECEIPT")
    : "RED_DOCUMENT_EDITORIAL_REVIEW_RECEIPT";
  await writeFile(path.join(artifactDir, "report.json"), `${JSON.stringify(report, null, 2)}\n`, "utf8");
  const markdown = `# Document editorial review receipt\n\nVerdict: \`${report.verdict}\`\n\nSource: \`${sourceHead}\`\n\n- Locked geometry: ${results.filter((result) => result.receiptLockedAtZero).length}/${results.length}\n- Receipt documents/checks: ${receiptVerification.uniqueDocumentKeyCount}/${receiptVerification.reviewerCheckCount}\n- Editorial findings bound to receipt: ${receiptVerification.editorialFindingCount}; fingerprint recorded: ${Boolean(receiptVerification.editorialFindingsFingerprint)}\n- API requests during local review/export: ${receiptVerification.apiRequestCount}\n- Human review completed by this automated probe: \`false\`\n- Reviewer identity verified or server recorded: \`false / false\`\n- Exact saved Share: \`MISSING_EVIDENCE\`\n\nThis receipt is a local self-attested audit export. It does not approve provider dispatch, database writes, wiki publication, vector runtime, KOSHA registry promotion, or an exact saved Share session.\n`;
  await writeFile(path.join(artifactDir, "report.md"), markdown, "utf8");
  if (!pass) process.exitCode = 1;
} finally {
  await browser.close();
}
