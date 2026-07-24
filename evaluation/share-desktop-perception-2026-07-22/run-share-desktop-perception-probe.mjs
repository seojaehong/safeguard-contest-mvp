import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { chromium } from "playwright";

const outDir = path.resolve("evaluation/share-desktop-perception-2026-07-22");
fs.mkdirSync(outDir, { recursive: true });

const baseUrl = process.env.SAFECLAW_BASE_URL || "https://www.safeclaw.kr";
const sourceHead = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
const checkedAt = new Date().toISOString();
const build = await (await fetch(`${baseUrl}/api/build-info?codexCacheBust=share-perception-${Date.now()}`)).json();

const sessionId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const workerId = "11111111-1111-4111-8111-111111111111";
const inputText = "서울 성수동 외벽 도장 작업, 작업자 5명, 신규 작업자 1명, 오후 강풍 예보. 이동식 비계와 자재 양중 동선 확인 필요.";

const sessionPayload = {
  ok: true,
  configured: true,
  session: {
    id: sessionId,
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
      workerId,
      displayName: "Server Nguyen",
      languageCode: "vi",
    }],
  },
  message: "공유 세션을 조회했습니다.",
};

const viewports = [
  { label: "desktop-short-1440x723", width: 1440, height: 723 },
  { label: "desktop-1440x900", width: 1440, height: 900 },
  { label: "mobile-390x844", width: 390, height: 844 },
];

function passCriteria(metrics, kind) {
  const desktop = metrics.viewportWidth >= 1000;
  if (kind === "workspaceShare") {
    return desktop
      ? metrics.rootWidthRatio >= 0.78
        && metrics.distinctFirstViewportRegions >= 2
        && metrics.primaryBottom <= metrics.viewportHeight
        && metrics.previewBottom <= metrics.viewportHeight
        && metrics.previewRightOfPrimary === true
        && metrics.horizontalOverflow === false
        && metrics.outsideElements === 0
        && metrics.mobileSummaryDisplay === "none"
      : metrics.primaryBottom <= metrics.viewportHeight
        && metrics.previewBottom <= metrics.viewportHeight
        && metrics.horizontalOverflow === false
        && metrics.outsideElements === 0;
  }
  return desktop
    ? metrics.rootWidthRatio >= 0.78
      && metrics.distinctFirstViewportRegions >= 2
      && metrics.confirmButtonBottom <= Math.min(metrics.viewportHeight, 640)
      && metrics.primaryRightRegionLeft > metrics.primaryLeftRegionRight
      && metrics.horizontalOverflow === false
      && metrics.outsideElements === 0
    : metrics.confirmButtonBottom <= 760
      && metrics.confirmButtonBottom < metrics.documentsTop
      && metrics.horizontalOverflow === false
      && metrics.outsideElements === 0;
}

function classifyPerception(metrics, kind) {
  const desktop = metrics.viewportWidth >= 1000;
  const literalStackPass = desktop
    ? metrics.distinctFirstViewportRegions >= 2
      && metrics.horizontalOverflow === false
      && metrics.outsideElements === 0
    : metrics.horizontalOverflow === false && metrics.outsideElements === 0;
  const breadthPass = desktop
    ? metrics.rootWidthRatio >= 0.78
    : true;
  const primaryPass = kind === "workspaceShare"
    ? metrics.primaryBottom <= metrics.viewportHeight
      && (desktop ? metrics.previewBottom <= metrics.viewportHeight : true)
    : metrics.confirmButtonBottom <= (desktop ? Math.min(metrics.viewportHeight, 640) : 760);
  return {
    literalStackVerdict: literalStackPass ? "PASS" : "RED",
    fullWorkbenchBreadthVerdict: breadthPass ? "PASS" : "RED",
    firstActionVerdict: primaryPass ? "PASS" : "RED",
    perceivedFullWorkbenchVerdict: literalStackPass && breadthPass && primaryPass ? "PASS" : "RED",
    rootWidthRatioThreshold: desktop ? 0.78 : null,
    rootWidthRatioInterpretation: desktop
      ? metrics.rootWidthRatio >= 0.78
        ? "uses enough 1440px desktop breadth for this gate"
        : "literal columns may exist, but root/content width is narrow enough to feel like a centered mobile card"
      : "mobile is intentionally single-column",
  };
}

async function settle(page) {
  await page.evaluate(async () => {
    await document.fonts.ready;
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  });
}

function screenshotName(routeName, viewportLabel) {
  return `${routeName}-${viewportLabel}.png`;
}

async function measureWorkspaceShare(page) {
  await page.addInitScript(() => {
    window.localStorage.clear();
    window.localStorage.setItem("safeclaw.aiMode", "template");
  });
  await page.goto(`${baseUrl}/workspace?theme=day`, { waitUntil: "networkidle", timeout: 60_000 });
  await page.locator("textarea").first().fill(inputText);
  await page.getByRole("button", { name: /안전 문서 생성/u }).click();
  await page.locator(".workspace-document-page").waitFor({ state: "visible", timeout: 60_000 });
  await page.getByText(/12\/12 생성|안전 문서팩 3종 준비 완료/u).first().waitFor({ timeout: 60_000 });
  await page.getByLabel("작업공간 메뉴").getByRole("button").filter({ hasText: "공유" }).click();
  await page.locator("[data-share-root]").waitFor({ state: "visible", timeout: 30_000 });
  await settle(page);
  return page.evaluate(() => {
    const rect = (selector) => {
      const element = document.querySelector(selector);
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
    const visibleRect = (selector) => {
      const element = [...document.querySelectorAll(selector)].find((item) => {
        const style = getComputedStyle(item);
        const box = item.getBoundingClientRect();
        return style.display !== "none" && style.visibility !== "hidden" && box.width > 0 && box.height > 0;
      });
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
    const root = rect("[data-share-root]");
    const form = rect(".share-form-shell");
    const preview = rect("[data-share-preview]");
    const primary = visibleRect("[data-share-primary]");
    const target = rect("[data-share-owner='targets']");
    const channel = rect("[data-share-owner='channels']");
    const language = rect("[data-share-owner='language-preview']");
    const mobileSummary = document.querySelector("[data-share-mobile-summary]");
    const channelCards = [...document.querySelectorAll(".channel-grid .channel-card")].map((card) => {
      const box = card.getBoundingClientRect();
      return {
        width: Math.round(box.width),
        height: Math.round(box.height),
        left: Math.round(box.left),
        right: Math.round(box.right),
      };
    });
    const firstViewportRects = [primary, preview, target, channel, language]
      .filter(Boolean)
      .filter((item) => item.top < window.innerHeight && item.width > 0 && item.height > 0);
    const distinctFirstViewportRegions = new Set(firstViewportRects.map((item) => Math.round(item.left / 80) * 80)).size;
    const outsideElements = [...document.querySelectorAll("body *")].filter((element) => {
      const box = element.getBoundingClientRect();
      return box.width > 0 && box.height > 0 && (box.left < -1 || box.right > window.innerWidth + 1);
    }).length;
    return {
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight,
      pageHeight: document.documentElement.scrollHeight,
      pageHeightRatio: Number((document.documentElement.scrollHeight / window.innerHeight).toFixed(2)),
      root,
      rootWidthRatio: root ? Number((root.width / window.innerWidth).toFixed(2)) : 0,
      form,
      preview,
      primary,
      target,
      channel,
      language,
      channelCards,
      distinctFirstViewportRegions,
      primaryBottom: primary?.bottom ?? 0,
      previewBottom: preview?.bottom ?? 0,
      previewRightOfPrimary: Boolean(preview && primary && preview.left > primary.right),
      mobileSummaryDisplay: mobileSummary ? getComputedStyle(mobileSummary).display : "missing",
      horizontalOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
      outsideElements,
    };
  });
}

async function measureRecipient(page) {
  await page.route("**/api/share-sessions/**", async (route) => {
    if (route.request().method() === "POST") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          ok: true,
          configured: true,
          confirmationId: "confirmation-perception",
          message: "작업자 열람 확인을 저장했습니다.",
        }),
      });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(sessionPayload),
    });
  });
  await page.goto(`${baseUrl}/share/${sessionId}?workerId=${workerId}`, { waitUntil: "networkidle", timeout: 60_000 });
  await page.locator(".safeclaw-share-recipient-page").waitFor({ state: "visible", timeout: 30_000 });
  await settle(page);
  return page.evaluate(() => {
    const cardRect = (predicate) => {
      const element = [...document.querySelectorAll(".safeclaw-share-recipient-card")].find((item) => predicate(item.innerText));
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
    const rect = (selector) => {
      const element = document.querySelector(selector);
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
    const root = rect(".safeclaw-share-recipient-page");
    const task = rect(".safeclaw-share-recipient-card-task");
    const notice = rect(".safeclaw-share-recipient-card-notice");
    const identity = rect(".safeclaw-share-recipient-card-identity");
    const confirm = rect(".safeclaw-share-recipient-card-confirm");
    const docs = cardRect((text) => text.includes("3 tài liệu chính") || text.includes("3 core documents"));
    const confirmButton = [...document.querySelectorAll("button")].find((item) => item.innerText.trim() === "Tôi đã xem");
    const confirmButtonRect = confirmButton ? (() => {
      const box = confirmButton.getBoundingClientRect();
      return {
        left: Math.round(box.left),
        right: Math.round(box.right),
        top: Math.round(box.top),
        bottom: Math.round(box.bottom),
        width: Math.round(box.width),
        height: Math.round(box.height),
      };
    })() : null;
    const cards = [...document.querySelectorAll(".safeclaw-share-recipient-card")];
    const visibleCards = cards.map((card) => {
      const box = card.getBoundingClientRect();
      return {
        left: Math.round(box.left),
        right: Math.round(box.right),
        top: Math.round(box.top),
        bottom: Math.round(box.bottom),
        width: Math.round(box.width),
        height: Math.round(box.height),
      };
    }).filter((item) => item.width > 0 && item.height > 0);
    const firstViewportCards = visibleCards.filter((item) => item.top < window.innerHeight);
    const distinctFirstViewportRegions = new Set(firstViewportCards.map((item) => Math.round(item.left / 80) * 80)).size;
    const leftColumnCards = firstViewportCards.filter((item) => item.left < window.innerWidth / 2);
    const rightColumnCards = firstViewportCards.filter((item) => item.left >= window.innerWidth / 2);
    const primaryLeftRegionRight = Math.max(0, ...leftColumnCards.map((item) => item.right));
    const primaryRightRegionLeft = Math.min(window.innerWidth, ...rightColumnCards.map((item) => item.left));
    const outsideElements = [...document.querySelectorAll("body *")].filter((element) => {
      const box = element.getBoundingClientRect();
      return box.width > 0 && box.height > 0 && (box.left < -1 || box.right > window.innerWidth + 1);
    }).length;
    return {
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight,
      pageHeight: document.documentElement.scrollHeight,
      pageHeightRatio: Number((document.documentElement.scrollHeight / window.innerHeight).toFixed(2)),
      root,
      rootWidthRatio: root ? Number((root.width / window.innerWidth).toFixed(2)) : 0,
      task,
      notice,
      identity,
      confirm,
      docs,
      confirmButton: confirmButtonRect,
      confirmButtonBottom: confirmButtonRect?.bottom ?? 0,
      documentsTop: docs?.top ?? 9999,
      distinctFirstViewportRegions,
      primaryLeftRegionRight,
      primaryRightRegionLeft,
      cardWidths: visibleCards.map((item) => item.width),
      horizontalOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
      outsideElements,
    };
  });
}

const browser = await chromium.launch({ headless: true });
const results = [];

for (const viewport of viewports) {
  const workspacePage = await browser.newPage({
    viewport: { width: viewport.width, height: viewport.height },
    deviceScaleFactor: 1,
  });
  try {
    const metrics = await measureWorkspaceShare(workspacePage);
    await workspacePage.screenshot({
      path: path.join(outDir, screenshotName("workspace-share", viewport.label)),
      fullPage: true,
    });
    results.push({
      route: "/workspace share step",
      viewport,
      metrics,
      perception: classifyPerception(metrics, "workspaceShare"),
      verdict: passCriteria(metrics, "workspaceShare") ? "PASS" : "RED",
    });
  } catch (error) {
    results.push({
      route: "/workspace share step",
      viewport,
      verdict: "ERROR",
      error: error instanceof Error ? error.message : String(error),
    });
  } finally {
    await workspacePage.close();
  }

  const recipientPage = await browser.newPage({
    viewport: { width: viewport.width, height: viewport.height },
    deviceScaleFactor: 1,
  });
  try {
    const metrics = await measureRecipient(recipientPage);
    await recipientPage.screenshot({
      path: path.join(outDir, screenshotName("recipient-share", viewport.label)),
      fullPage: true,
    });
    results.push({
      route: "/share/[sessionId] invited recipient fixture",
      viewport,
      metrics,
      perception: classifyPerception(metrics, "recipientShare"),
      verdict: passCriteria(metrics, "recipientShare") ? "PASS" : "RED",
    });
  } catch (error) {
    results.push({
      route: "/share/[sessionId] invited recipient fixture",
      viewport,
      verdict: "ERROR",
      error: error instanceof Error ? error.message : String(error),
    });
  } finally {
    await recipientPage.close();
  }
}

await browser.close();

const failed = results.filter((item) => item.verdict !== "PASS");
const report = {
  schemaVersion: "safeclaw-share-desktop-perception/v1",
  checkedAt,
  baseUrl,
  sourceHead,
  productionBuild: build,
  providerDispatchLiveClaimed: false,
  dbMutationPerformed: false,
  routeSplitAloneAcceptedAsFix: false,
  verdict: failed.length === 0
    ? "PASS_LIVE_PRODUCTION_SCOPED_WORKSPACE_AND_INVITED_FIXTURE"
    : "RED_REPRODUCED_OR_ERROR",
  interpretation: failed.length === 0
    ? "Current measured live Workspace Share and invited recipient Share routes use first-viewport desktop workbench geometry. This does not disprove a different user-visible saved/generated session; if that exact session still looks like a narrow mobile card, reproduce it with this width-ratio/grid gate before changing product code."
    : "At least one measured route failed the full-workbench perception gate. Literal two-column geometry and perceived full-workbench breadth are separated: a route can have two columns and still fail if the root/content width is too narrow for a 1440px desktop.",
  acceptance: {
    desktop: [
      "root/content width ratio >= 0.78",
      "at least two visually distinct first-viewport x regions",
      "primary CTA/confirmation inside first viewport",
      "preview/notice/result region inside first viewport",
      "horizontal overflow false and outside elements 0",
    ],
    mobile: [
      "primary CTA/confirmation before long details",
      "horizontal overflow false and outside elements 0",
    ],
  },
  perceptionModel: {
    literalStackPass: "distinct first-viewport x regions >= 2 and no horizontal overflow",
    fullWorkbenchBreadthPass: "desktop root/content width ratio >= 0.78; a 980px cap on 1440px is about 0.68 and is treated as perceived narrow-card RED",
    firstActionPass: "primary CTA/confirmation is in the first viewport",
    finalPass: "all three pass together",
    note: "form/preview widths are recorded, but outer whitespace/root cap is evaluated separately because a fixed preview can feel mobile-like even in a two-column grid.",
  },
  results,
};

fs.writeFileSync(path.join(outDir, "report.json"), `${JSON.stringify(report, null, 2)}\n`, "utf8");

const rows = results.map((item) => {
  const metrics = item.metrics || {};
  const perception = item.perception || {};
  return `| ${item.route} | ${item.viewport.label} | ${item.verdict} | ${perception.literalStackVerdict ?? "n/a"} | ${perception.fullWorkbenchBreadthVerdict ?? "n/a"} | ${perception.perceivedFullWorkbenchVerdict ?? "n/a"} | ${metrics.rootWidthRatio ?? "n/a"} | ${metrics.distinctFirstViewportRegions ?? "n/a"} | ${metrics.primaryBottom ?? metrics.confirmButtonBottom ?? "n/a"} | ${metrics.previewBottom ?? metrics.documentsTop ?? "n/a"} | ${metrics.horizontalOverflow ?? "n/a"} | ${metrics.outsideElements ?? "n/a"} |`;
});

fs.writeFileSync(path.join(outDir, "report.md"), `# Share Desktop Perception Probe

Checked at: ${checkedAt}

Base URL: \`${baseUrl}\`

Source HEAD: \`${sourceHead}\`

Production commit: \`${build.commitSha || "unknown"}\`

Verdict: \`${report.verdict}\`

Provider live dispatch claimed: \`false\`

DB mutation performed: \`false\`

Route/page split alone accepted as fix: \`false\`

## Interpretation

${report.interpretation}

This artifact separates measured geometry from user perception. A route only passes when the actual first viewport uses enough desktop width, exposes meaningful distinct regions, keeps the primary action visible, and has no horizontal overflow. It does not claim provider dispatch readiness.

Literal two-column and perceived full-workbench breadth are separate checks. A route can be non-stacked but still RED if the root/content container is capped too narrowly for a 1440px desktop. A 980px cap on 1440px is about 0.68 and is treated as desktop full-workbench breadth insufficient.

## Metrics

| Route | Viewport | Verdict | Literal stack | Breadth | Perceived workbench | Root width ratio | Distinct first-viewport regions | Primary/confirm bottom | Preview/docs top-bottom | Horizontal overflow | Outside elements |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
${rows.join("\n")}

## Remaining UX Boundary

- This PASS covers the measured live Workspace Share flow and invited recipient fixture, not every possible saved/generated user session.
- If a user-visible session still looks like a narrow mobile card on desktop, reproduce that exact state with this width-ratio/grid gate before changing product code.
- Documents long-form editing remains a separate selected-detail/drilldown IA debt.
- Provider live dispatch remains approval-gated.
`, "utf8");

console.log(JSON.stringify({
  output: path.relative(process.cwd(), outDir),
  verdict: report.verdict,
  sourceHead,
  productionCommit: build.commitSha,
  failed: failed.map((item) => ({ route: item.route, viewport: item.viewport.label, verdict: item.verdict })),
}, null, 2));
