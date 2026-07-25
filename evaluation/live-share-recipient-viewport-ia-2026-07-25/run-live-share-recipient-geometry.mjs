#!/usr/bin/env node
// @ts-check

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { execFileSync } from "node:child_process";
import { chromium } from "playwright";

const OUT_DIR = path.join("evaluation", "live-share-recipient-viewport-ia-2026-07-25");
const DEFAULT_BASE_URL = "https://safeguard-contest-81mcrhsmb-seojaehongs-projects.vercel.app";
const EXPECTED_LIVE_COMMIT = "c7621c9dcbd04443c81456d248df73790de64490";
const SESSION_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const WORKER_ID = "11111111-1111-4111-8111-111111111111";

const viewports = [
  { label: "desktop-1440x723", width: 1440, height: 723, desktop: true, minimumRootWidth: 1040 },
  { label: "desktop-1024x768", width: 1024, height: 768, desktop: true, minimumRootWidth: 976 },
  { label: "mobile-390x723", width: 390, height: 723, desktop: false, minimumRootWidth: 0 },
];

const sessionPayload = {
  ok: true,
  configured: true,
  session: {
    id: SESSION_ID,
    workpackId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    shareScope: "invited",
    question: "지하 기계실 배관 교체와 고소 용접 작업을 동시에 수행하며 작업구역 분리, 화재감시자 배치, 환기 상태와 비상대피 동선을 확인합니다. ".repeat(8).trim(),
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
        body: `추락 위험: 이동식 비계 고정과 안전대 착용을 확인합니다.\n${"작업 전 확인사항과 작업중지 기준을 현장 책임자와 다시 확인합니다. ".repeat(32).trim()}`,
      },
      {
        key: "tbmBriefing",
        title: "TBM 브리핑",
        body: `강풍 시 작업을 중지하고 관리감독자에게 보고합니다.\n${"작업 전 확인사항과 작업중지 기준을 현장 책임자와 다시 확인합니다. ".repeat(32).trim()}`,
      },
      {
        key: "tbmLogDraft",
        title: "TBM 기록",
        body: `작업자 전원이 위험요인과 작업중지 기준을 확인했습니다.\n${"작업 전 확인사항과 작업중지 기준을 현장 책임자와 다시 확인합니다. ".repeat(32).trim()}`,
      },
    ],
    recipientMessage: {
      languageCode: "vi",
      title: "Tiếng Việt 안내",
      body: "Dừng công việc khi điều kiện không an toàn. Kiểm tra khu vực, thiết bị bảo hộ và lối thoát hiểm trước khi bắt đầu. ".repeat(18).trim(),
    },
    recipients: [
      {
        workerId: WORKER_ID,
        displayName: "Server Nguyen",
        languageCode: "vi",
      },
      {
        workerId: "22222222-2222-4222-8222-222222222222",
        displayName: "Worker Kim",
        languageCode: "ko",
      },
      {
        workerId: "33333333-3333-4333-8333-333333333333",
        displayName: "Worker Lee",
        languageCode: "en",
      },
      {
        workerId: "44444444-4444-4444-8444-444444444444",
        displayName: "Worker Somchai",
        languageCode: "th",
      },
    ],
  },
  message: "공유 세션을 조회했습니다.",
};

/**
 * @param {string[]} argv
 */
function parseArgs(argv) {
  const options = {
    baseUrl: process.env.SAFECLAW_BASE_URL || DEFAULT_BASE_URL,
    outputDir: OUT_DIR,
    expectedLiveCommit: process.env.SAFECLAW_EXPECTED_LIVE_COMMIT || EXPECTED_LIVE_COMMIT,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--base-url") {
      options.baseUrl = argv[index + 1] || options.baseUrl;
      index += 1;
    } else if (arg === "--output") {
      options.outputDir = argv[index + 1] || options.outputDir;
      index += 1;
    } else if (arg === "--expected-live-commit") {
      options.expectedLiveCommit = argv[index + 1] || options.expectedLiveCommit;
      index += 1;
    }
  }
  return options;
}

function gitHead() {
  try {
    return execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
  } catch {
    return "unknown";
  }
}

/**
 * @param {string} baseUrl
 */
async function readBuildInfo(baseUrl) {
  const url = new URL("/api/build-info", baseUrl);
  url.searchParams.set("codexCacheBust", `share-recipient-geometry-${Date.now()}`);
  const response = await fetch(url, { cache: "no-store" });
  const body = await response.json().catch(() => ({}));
  return {
    ok: response.ok,
    status: response.status,
    body,
    commitSha: typeof body?.commitSha === "string" ? body.commitSha : "",
  };
}

/**
 * @param {import("playwright").Page} page
 */
async function settle(page) {
  await page.evaluate(async () => {
    await document.fonts.ready;
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  });
}

/**
 * @param {import("playwright").Page} page
 */
async function collectMetrics(page) {
  return page.evaluate(async () => {
    window.scrollTo(0, 0);
    await new Promise((resolve) => requestAnimationFrame(() => resolve(undefined)));
    const root = document.querySelector(".safeclaw-share-recipient-page");
    const confirmButton = [...document.querySelectorAll("button")]
      .find((item) => item.textContent?.trim() === "Tôi đã xem");
    const notice = document.querySelector(".safeclaw-share-recipient-card-notice");
    const taskBody = document.querySelector(".safeclaw-share-recipient-task-body");
    const documentsPanel = document.querySelector(".safeclaw-share-recipient-card-documents");
    const previews = [...document.querySelectorAll(".safeclaw-share-recipient-preview")];
    const documents = [...document.querySelectorAll(".safeclaw-share-recipient-document")];
    const cards = [...document.querySelectorAll(".safeclaw-share-recipient-card")];
    const rootRect = root?.getBoundingClientRect();
    const confirmationCard = confirmButton?.closest(".safeclaw-share-recipient-card");
    const confirmationRect = confirmationCard?.getBoundingClientRect();
    const confirmButtonRect = confirmButton?.getBoundingClientRect();
    const noticeRect = notice?.getBoundingClientRect();
    const distinctLefts = Array.from(new Set(cards
      .map((item) => Math.round(item.getBoundingClientRect().left / 40) * 40)
      .filter((left) => left > 0)))
      .sort((a, b) => a - b);
    const outsideCardCount = cards.filter((item) => {
      const rect = item.getBoundingClientRect();
      return rect.left < -0.5 || rect.right > window.innerWidth + 0.5;
    }).length;
    const horizontalOverflow = document.documentElement.scrollWidth > document.documentElement.clientWidth;
    const initialMetrics = {
      bodyHeight: document.documentElement.scrollHeight,
      bodyHeightRatio: Number((document.documentElement.scrollHeight / window.innerHeight).toFixed(2)),
      rootWidth: Math.round(rootRect?.width ?? 0),
      rootWidthRatio: Number(((rootRect?.width ?? 0) / window.innerWidth).toFixed(2)),
      rootHeight: Math.round(rootRect?.height ?? 0),
      rootBottom: Math.round(rootRect?.bottom ?? 0),
      viewportHeight: window.innerHeight,
      viewportWidth: window.innerWidth,
      confirmationBottom: Math.round(confirmButtonRect?.bottom ?? 0),
      confirmationLeft: Math.round(confirmationRect?.left ?? 0),
      confirmationRight: Math.round(confirmationRect?.right ?? 0),
      noticeLeft: Math.round(noticeRect?.left ?? 0),
      distinctLeftRegionCount: distinctLefts.length,
      horizontalOverflow,
      outsideCards: outsideCardCount,
      taskBodyClientHeight: Math.round(taskBody?.clientHeight ?? 0),
      taskBodyScrollHeight: Math.round(taskBody?.scrollHeight ?? 0),
      documentsPanelOpen: documentsPanel instanceof HTMLDetailsElement ? documentsPanel.open : null,
      previewContainedCount: previews.filter((item) => item.scrollHeight > item.clientHeight && item.clientHeight <= 220).length,
      collapsedDocumentCount: documents.filter((item) => item instanceof HTMLDetailsElement && !item.open).length,
    };
    window.scrollTo(0, Math.min(260, Math.max(0, document.documentElement.scrollHeight - window.innerHeight)));
    await new Promise((resolve) => requestAnimationFrame(() => resolve(undefined)));
    const scrolledConfirmationRect = confirmationCard?.getBoundingClientRect();
    const overlapTargets = [
      ...document.querySelectorAll(
        ".safeclaw-module-nav, .safeclaw-page-decision-header, .safeclaw-shared-header, .safeclaw-module-rail, header"
      ),
    ].filter((item) => (
      item !== confirmationCard
      && !(confirmationCard?.contains(item) ?? false)
      && (confirmationCard ? !item.contains(confirmationCard) : true)
    ));
    const overlapsConfirmation = (item) => {
      if (!scrolledConfirmationRect) return false;
      const rect = item.getBoundingClientRect();
      return rect.width > 0
        && rect.height > 0
        && rect.left < scrolledConfirmationRect.right
        && rect.right > scrolledConfirmationRect.left
        && rect.top < scrolledConfirmationRect.bottom
        && rect.bottom > scrolledConfirmationRect.top;
    };
    return {
      ...initialMetrics,
      stickyHeaderOverlapCount: overlapTargets.filter(overlapsConfirmation).length,
    };
  });
}

/**
 * @param {typeof viewports[number]} viewport
 * @param {Awaited<ReturnType<typeof collectMetrics>>} metrics
 * @param {number} mutationRequestCount
 */
function evaluateViewport(viewport, metrics, mutationRequestCount) {
  const commonPass = metrics.confirmationBottom <= viewport.height
    && metrics.previewContainedCount >= 1
    && metrics.collapsedDocumentCount === 3
    && metrics.outsideCards === 0
    && metrics.horizontalOverflow === false
    && mutationRequestCount === 0
    && metrics.taskBodyScrollHeight > metrics.taskBodyClientHeight
    && metrics.taskBodyClientHeight <= (viewport.desktop ? 132 : 112)
    && metrics.documentsPanelOpen === false
    && metrics.rootHeight <= Math.ceil(metrics.viewportHeight * 1.5);
  const responsivePass = viewport.desktop
    ? metrics.rootWidth >= viewport.minimumRootWidth
      && metrics.rootWidthRatio >= 0.82
      && metrics.distinctLeftRegionCount >= 2
      && metrics.stickyHeaderOverlapCount === 0
      && metrics.noticeLeft > metrics.confirmationRight
    : metrics.rootWidth <= viewport.width;
  return commonPass && responsivePass;
}

/**
 * @param {unknown} value
 */
function json(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const checkedAt = new Date().toISOString();
  fs.mkdirSync(options.outputDir, { recursive: true });
  const screenshotDir = path.join(options.outputDir, "screenshots");
  fs.mkdirSync(screenshotDir, { recursive: true });
  const sourceHead = gitHead();
  const buildInfo = await readBuildInfo(options.baseUrl);
  const liveCommitMatchesExpected = buildInfo.commitSha === options.expectedLiveCommit;
  const browser = await chromium.launch({ headless: true });
  const rows = [];
  try {
    for (const viewport of viewports) {
      const page = await browser.newPage({
        deviceScaleFactor: 1,
        viewport: { width: viewport.width, height: viewport.height },
      });
      const apiRequests = [];
      let mutationRequestCount = 0;
      await page.route("**/api/share-sessions/**", async (route) => {
        const request = route.request();
        apiRequests.push({ method: request.method(), url: request.url() });
        if (request.method() !== "GET") {
          mutationRequestCount += 1;
          await route.fulfill({
            status: 405,
            contentType: "application/json",
            body: JSON.stringify({ ok: false, message: "Fixture mutation is blocked." }),
          });
          return;
        }
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(sessionPayload),
        });
      });
      const pageErrors = [];
      const consoleErrors = [];
      page.on("pageerror", (error) => {
        pageErrors.push(error.message);
      });
      page.on("console", (message) => {
        if (message.type() === "error") consoleErrors.push(message.text());
      });
      try {
        const url = new URL(`/share/${SESSION_ID}`, options.baseUrl);
        url.searchParams.set("workerId", WORKER_ID);
        url.searchParams.set("codexCacheBust", `share-recipient-${Date.now()}-${viewport.label}`);
        const response = await page.goto(url.toString(), { waitUntil: "networkidle", timeout: 60_000 });
        await settle(page);
        const bodyText = await page.locator("body").innerText({ timeout: 10_000 });
        const metrics = await collectMetrics(page);
        const screenshotName = `share-recipient-fixture-${viewport.label}.png`;
        await page.screenshot({ path: path.join(screenshotDir, screenshotName), fullPage: true });
        const passed = evaluateViewport(viewport, metrics, mutationRequestCount)
          && response !== null
          && response.status() < 400
          && bodyText.includes("Kiểm tra gói tài liệu")
          && bodyText.includes("Dừng công việc khi điều kiện không an toàn")
          && pageErrors.length === 0;
        rows.push({
          viewport: viewport.label,
          requestedViewport: { width: viewport.width, height: viewport.height },
          urlPath: `${url.pathname}?workerId=${WORKER_ID}`,
          httpStatus: response?.status() ?? null,
          passed,
          verdict: passed ? "PASS_SCOPED_INVITED_FIXTURE_SHARE_GEOMETRY" : "RED_SCOPED_INVITED_FIXTURE_SHARE_GEOMETRY",
          metrics,
          apiRequestCount: apiRequests.length,
          mutationRequestCount,
          pageErrors,
          consoleErrors,
          screenshot: path.join(options.outputDir, "screenshots", screenshotName).replaceAll("\\", "/"),
        });
      } catch (error) {
        rows.push({
          viewport: viewport.label,
          requestedViewport: { width: viewport.width, height: viewport.height },
          passed: false,
          verdict: "ERROR_SCOPED_INVITED_FIXTURE_SHARE_GEOMETRY",
          error: error instanceof Error ? error.message : String(error),
          apiRequestCount: apiRequests.length,
          mutationRequestCount,
          pageErrors,
          consoleErrors,
        });
      } finally {
        await page.close();
      }
    }
  } finally {
    await browser.close();
  }

  const passed = liveCommitMatchesExpected && rows.every((row) => row.passed === true);
  const report = {
    schemaVersion: "safeclaw-live-share-recipient-viewport-ia/v1",
    checkedAt,
    baseUrl: options.baseUrl,
    sourceHead,
    expectedLiveCommit: options.expectedLiveCommit,
    liveBuildInfo: buildInfo.body,
    liveCommit: buildInfo.commitSha,
    liveCommitMatchesExpected,
    verdict: passed
      ? "PASS_LIVE_PRODUCTION_SCOPED_INVITED_FIXTURE_SHARE_GEOMETRY_EXACT_SAVED_MISSING"
      : "RED_LIVE_PRODUCTION_SCOPED_INVITED_FIXTURE_SHARE_GEOMETRY",
    scopedInvitedFixtureAccepted: passed,
    exactSavedUserSessionReproduced: false,
    exactSavedShareEvidence: "MISSING_EVIDENCE",
    userDesktopMobileLikeShareComplaintClosed: false,
    dbMutationPerformed: false,
    providerDispatchPerformed: false,
    rows,
    boundaries: {
      liveProductAssetsMeasured: true,
      shareSessionApiFulfilledByFixture: true,
      fixtureProofAcceptedAsExactSavedSession: false,
      exactSavedSessionStillRequiresConcreteProductionShareUrl: true,
      noConfirmationClickPerformed: true,
      nonGetShareSessionRequestsBlocked: true,
    },
  };
  fs.writeFileSync(path.join(options.outputDir, "report.json"), json(report), "utf8");
  const table = rows.map((row) => {
    const metrics = row.metrics || {};
    return `| ${row.viewport} | ${row.verdict} | ${metrics.rootWidth ?? "n/a"} | ${metrics.rootWidthRatio ?? "n/a"} | ${metrics.distinctLeftRegionCount ?? "n/a"} | ${metrics.confirmationBottom ?? "n/a"} | ${metrics.rootHeight ?? "n/a"}/${metrics.viewportHeight ?? "n/a"} | ${metrics.horizontalOverflow ?? "n/a"} | ${metrics.stickyHeaderOverlapCount ?? "n/a"} | ${row.mutationRequestCount ?? "n/a"} |`;
  }).join("\n");
  fs.writeFileSync(path.join(options.outputDir, "report.md"), `# Live Share Recipient Viewport IA Geometry

Checked at: \`${checkedAt}\`

Base URL: \`${options.baseUrl}\`

Source HEAD: \`${sourceHead}\`

Live commit: \`${buildInfo.commitSha || "unknown"}\`

Expected live commit: \`${options.expectedLiveCommit}\`

Verdict: \`${report.verdict}\`

## Boundary

- This measures live production page assets from Vercel after PR #90 reached production.
- The \`/api/share-sessions\` read is fulfilled with the bounded invited-worker fixture from the PR #90 browser contract.
- No confirmation click, provider dispatch, DB write, exact share creation, or saved share-session mutation was performed.
- Exact saved user \`/share/[sessionId]\` evidence remains \`MISSING_EVIDENCE\`.
- This scoped fixture proof does not close the exact saved user-session complaint.

## Geometry

| Viewport | Verdict | Root width | Width ratio | X regions | Confirm bottom | Root/viewport height | Overflow | Sticky overlap | Mutations |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
${table}

## Screenshots

${rows.map((row) => `- ${row.viewport}: \`${row.screenshot || "not captured"}\``).join("\n")}
`, "utf8");
  console.log(json({
    output: options.outputDir,
    verdict: report.verdict,
    liveCommit: report.liveCommit,
    liveCommitMatchesExpected,
    passedRows: rows.filter((row) => row.passed).length,
    totalRows: rows.length,
    exactSavedShareEvidence: report.exactSavedShareEvidence,
    dbMutationPerformed: report.dbMutationPerformed,
  }));
  if (!passed) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
