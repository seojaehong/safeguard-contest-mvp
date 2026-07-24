import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(scriptDir, "..", "..");
const outputDir = process.env.SAFECLAW_OUTPUT_DIR
  ? path.resolve(rootDir, process.env.SAFECLAW_OUTPUT_DIR)
  : scriptDir;
const baseUrl = (process.env.SAFECLAW_BASE_URL || "https://www.safeclaw.kr").replace(/\/+$/u, "");
const isLocalBase = /^https?:\/\/(?:127\.0\.0\.1|localhost)(?::|\/|$)/u.test(baseUrl);
const sessionId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const workerId = "11111111-1111-4111-8111-111111111111";
const viewports = [
  { label: "desktop-short-1440x723", width: 1440, height: 723 },
  { label: "desktop-1440x900", width: 1440, height: 900 },
  { label: "mobile-390x723", width: 390, height: 723 },
];
const themes = ["day", "night"];
const acceptanceContract = Object.freeze({
  routeSplitAloneAcceptedAsFix: false,
  desktopMinRegions: 2,
  mobileMaxRootHeightRatio: 1.5,
  confirmationMustRemainInFirstViewport: true,
  longTaskMustUseLocalScroll: true,
  documentGroupCollapsedByDefault: true,
  exactSavedSessionRequiredForUserSpecificPass: true,
});

const documents = [
  ["riskAssessmentDraft", "위험성평가표", "추락 위험: 이동식 비계 고정과 안전대 착용을 확인합니다."],
  ["tbmBriefing", "TBM 브리핑", "강풍 시 작업을 중지하고 관리감독자에게 보고합니다."],
  ["tbmLogDraft", "TBM 기록", "작업자 전원이 위험요인과 작업중지 기준을 확인했습니다."],
].map(([key, title, body]) => ({
  key,
  title,
  body: `${body}\n${"작업 전 확인사항과 작업중지 기준을 현장 책임자와 다시 확인합니다. ".repeat(32).trim()}`,
}));

const fixture = {
  ok: true,
  configured: true,
  session: {
    id: sessionId,
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
    documents,
    recipientMessage: {
      languageCode: "vi",
      title: "Tiếng Việt 안내",
      body: "Dừng công việc khi điều kiện không an toàn. Kiểm tra khu vực, thiết bị bảo hộ và lối thoát hiểm trước khi bắt đầu. ".repeat(18).trim(),
    },
    recipients: [
      { workerId, displayName: "Server Nguyen", languageCode: "vi" },
      { workerId: "22222222-2222-4222-8222-222222222222", displayName: "Worker Kim", languageCode: "ko" },
      { workerId: "33333333-3333-4333-8333-333333333333", displayName: "Worker Lee", languageCode: "en" },
      { workerId: "44444444-4444-4444-8444-444444444444", displayName: "Worker Somchai", languageCode: "th" },
    ],
  },
  message: "공유 세션을 조회했습니다.",
};

function readHead() {
  return execFileSync("git", ["rev-parse", "HEAD"], { cwd: rootDir, encoding: "utf8" }).trim();
}

async function readBuildInfo() {
  const response = await fetch(`${baseUrl}/api/build-info?codexCacheBust=share-long-${Date.now()}`);
  if (!response.ok) throw new Error(`build-info returned ${response.status}`);
  return response.json();
}

function evaluateRow(metrics) {
  const desktop = metrics.viewportWidth >= 900;
  const common = metrics.confirmationBottom <= metrics.viewportHeight
    && metrics.taskBodyContained === true
    && metrics.documentsPanelOpen === false
    && metrics.previewContainedCount >= 1
    && metrics.collapsedDocumentCount === 3
    && metrics.outsideCards === 0
    && metrics.horizontalOverflow === false;
  const pass = desktop
    ? common
      && metrics.rootWidthRatio >= 0.78
      && metrics.desktopXRegionCount >= 2
      && metrics.noticeLeft > metrics.confirmationRight
      && metrics.rootHeightRatio <= 1.5
    : common && metrics.rootWidth <= metrics.viewportWidth;
  const boundedMobileRoot = desktop || metrics.rootHeightRatio <= acceptanceContract.mobileMaxRootHeightRatio;
  return {
    layoutVerdict: pass && boundedMobileRoot ? "PASS" : "RED",
    exactSavedSessionVerdict: "MISSING_EVIDENCE",
    overallVerdict: pass && boundedMobileRoot ? "PASS_SCOPED" : "RED",
  };
}

const sourceHead = readHead();
const productionBuild = await readBuildInfo();
fs.mkdirSync(outputDir, { recursive: true });
const browser = await chromium.launch({ headless: true });
const rows = [];

try {
  for (const theme of themes) {
    for (const viewport of viewports) {
      const page = await browser.newPage({ viewport });
      try {
        await page.route("**/api/share-sessions/**", async (route) => {
          if (route.request().method() !== "GET") {
            await route.abort("blockedbyclient");
            return;
          }
          await route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify(fixture),
          });
        });
        await page.goto(
          `${baseUrl}/share/${sessionId}?workerId=${workerId}&theme=${theme}`,
          { waitUntil: "networkidle", timeout: 60_000 },
        );
        await page.getByText("Kiểm tra gói tài liệu", { exact: true }).waitFor({ timeout: 30_000 });
        const metrics = await page.evaluate(({ themeName, viewportLabel }) => {
          const root = document.querySelector(".safeclaw-share-recipient-page");
          const confirmButton = [...document.querySelectorAll("button")]
            .find((item) => item.textContent?.trim() === "Tôi đã xem");
          const confirmationCard = confirmButton?.closest(".safeclaw-share-recipient-card");
          const notice = document.querySelector(".safeclaw-share-recipient-card-notice");
          const taskBody = document.querySelector(".safeclaw-share-recipient-task-body");
          const documentsPanel = document.querySelector(".safeclaw-share-recipient-card-documents");
          const previews = [...document.querySelectorAll(".safeclaw-share-recipient-preview")];
          const documentDetails = [...document.querySelectorAll(".safeclaw-share-recipient-document")];
          const cards = [...document.querySelectorAll(".safeclaw-share-recipient-card")];
          const rootRect = root?.getBoundingClientRect();
          const confirmationRect = confirmationCard?.getBoundingClientRect();
          const noticeRect = notice?.getBoundingClientRect();
          const firstViewportCards = cards.filter((card) => card.getBoundingClientRect().top < window.innerHeight);
          return {
            route: "/share/[sessionId]",
            sessionKind: "long-content-fixture",
            exactSavedUserSessionReproduced: false,
            theme: themeName,
            viewport: viewportLabel,
            viewportWidth: window.innerWidth,
            viewportHeight: window.innerHeight,
            pageHeight: document.documentElement.scrollHeight,
            pageHeightRatio: Number((document.documentElement.scrollHeight / window.innerHeight).toFixed(2)),
            rootWidth: Math.round(rootRect?.width ?? 0),
            rootWidthRatio: Number(((rootRect?.width ?? 0) / window.innerWidth).toFixed(2)),
            rootHeightRatio: Number(((rootRect?.height ?? 0) / window.innerHeight).toFixed(2)),
            confirmationBottom: Math.round(confirmButton?.getBoundingClientRect().bottom ?? 0),
            confirmationRight: Math.round(confirmationRect?.right ?? 0),
            noticeLeft: Math.round(noticeRect?.left ?? 0),
            taskBodyClientHeight: Math.round(taskBody?.clientHeight ?? 0),
            taskBodyScrollHeight: Math.round(taskBody?.scrollHeight ?? 0),
            taskBodyContained: (taskBody?.scrollHeight ?? 0) > (taskBody?.clientHeight ?? 0),
            documentsPanelOpen: documentsPanel?.open ?? null,
            desktopXRegionCount: new Set(firstViewportCards.map((card) => (
              Math.round(card.getBoundingClientRect().left / 80) * 80
            ))).size,
            previewContainedCount: previews.filter((preview) => (
              preview.scrollHeight > preview.clientHeight && preview.clientHeight <= 220
            )).length,
            collapsedDocumentCount: documentDetails.filter((detail) => !detail.open).length,
            outsideCards: cards.filter((card) => {
              const rect = card.getBoundingClientRect();
              return rect.left < -0.5 || rect.right > window.innerWidth + 0.5;
            }).length,
            horizontalOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
          };
        }, { themeName: theme, viewportLabel: viewport.label });
        rows.push({ metrics, verdicts: evaluateRow(metrics) });
        await page.screenshot({
          path: path.join(outputDir, `${theme}-${viewport.label}.png`),
          fullPage: true,
        });
      } catch (error) {
        rows.push({
          metrics: {
            route: "/share/[sessionId]",
            sessionKind: "long-content-fixture",
            exactSavedUserSessionReproduced: false,
            theme,
            viewport: viewport.label,
          },
          verdicts: {
            layoutVerdict: "ERROR",
            exactSavedSessionVerdict: "MISSING_EVIDENCE",
            overallVerdict: "ERROR",
            error: error instanceof Error ? error.message : String(error),
          },
        });
      } finally {
        await page.close();
      }
    }
  }
} finally {
  await browser.close();
}

const failures = rows.filter((row) => row.verdicts.overallVerdict !== "PASS_SCOPED");
const report = {
  checkedAt: new Date().toISOString(),
  baseUrl,
  sourceHead,
  productionBuild,
  verdict: failures.length === 0
    ? isLocalBase
      ? "PASS_CURRENT_SOURCE_LOCAL_PRODUCTION_LONG_CONTENT_FIXTURE_EXACT_SAVED_MISSING"
      : "PASS_LIVE_PRODUCTION_LONG_CONTENT_FIXTURE_EXACT_SAVED_MISSING"
    : isLocalBase
      ? "RED_CURRENT_SOURCE_LOCAL_PRODUCTION_LONG_CONTENT_FIXTURE"
      : "RED_LIVE_PRODUCTION_LONG_CONTENT_FIXTURE",
  route: "/share/[sessionId]",
  sessionKind: "long-content-fixture",
  routeSplitAloneAcceptedAsFix: acceptanceContract.routeSplitAloneAcceptedAsFix,
  acceptedStructure: "first-viewport confirmation cockpit plus desktop multi-region workbench plus bounded internal task/message preview and collapsed document drilldown",
  acceptance: acceptanceContract,
  exactSavedUserSessionReproduced: false,
  exactSavedSessionVerdict: "MISSING_EVIDENCE",
  dbMutationPerformed: false,
  shareSessionCreated: false,
  providerDispatchLiveClaimed: false,
  externalProviderCalled: false,
  requestContract: {
    livePageLoaded: true,
    shareSessionGetMocked: true,
    nonGetShareSessionRequestsBlocked: true,
  },
  fixtureProfile: {
    documentCount: documents.length,
    recipientCount: fixture.session.recipients.length,
    questionLength: fixture.session.question.length,
    recipientMessageLength: fixture.session.recipientMessage.body.length,
    documentBodyLengths: documents.map((document) => document.body.length),
  },
  rows,
  failures,
  boundary: {
    allowedClaim: isLocalBase
      ? "The current-source local production recipient UI contains a route-controlled maximum-content fixture in the expected desktop/mobile workbench geometry."
      : "The deployed recipient UI contains a route-controlled maximum-content fixture in the expected desktop/mobile workbench geometry.",
    forbiddenClaim: "A concrete saved/generated production share session was reproduced or persisted.",
    exactEvidenceNextStep: "Provide an existing production /share/[sessionId]?workerId=... URL or approve the DB-backed share-session creation flow.",
  },
};

fs.writeFileSync(path.join(outputDir, "report.json"), `${JSON.stringify(report, null, 2)}\n`);

const tableRows = rows.map((row) => {
  const metrics = row.metrics;
  return `| ${metrics.theme} | ${metrics.viewport} | ${row.verdicts.overallVerdict} | ${metrics.pageHeightRatio ?? "-"} | ${metrics.rootWidthRatio ?? "-"} | ${metrics.rootHeightRatio ?? "-"} | ${metrics.desktopXRegionCount ?? "-"} | ${metrics.confirmationBottom ?? "-"} | ${metrics.taskBodyContained ?? "-"} | ${metrics.previewContainedCount ?? "-"} | ${metrics.collapsedDocumentCount ?? "-"} | ${metrics.outsideCards ?? "-"} | ${metrics.horizontalOverflow ?? "-"} |`;
}).join("\n");

const markdown = `# Share Recipient Long-Content Fixture Gate

Checked at: \`${report.checkedAt}\`

Base URL: \`${baseUrl}\`

Source HEAD: \`${sourceHead}\`

Production commit: \`${productionBuild.commitSha ?? "unknown"}\`

Verdict: \`${report.verdict}\`

Exact saved/generated session: \`MISSING_EVIDENCE\`

## Scope

This gate loads the ${isLocalBase ? "current-source local production" : "deployed"} recipient page and replaces only the Share-session GET response with a route-controlled long-content fixture. Non-GET Share-session requests are blocked. It measures layout resilience without creating a Share session, writing to the DB, confirming receipt, or dispatching a provider message.

Route split alone accepted as the fix: \`false\`

Accepted structure: ${report.acceptedStructure}

| Theme | Viewport | Overall | Page ratio | Root width ratio | Root height ratio | X regions | Confirm bottom | Task contained | Contained previews | Collapsed docs | Outside cards | OverflowX |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
${tableRows}

## Fixture Profile

- Documents: ${report.fixtureProfile.documentCount}
- Recipients/languages: ${report.fixtureProfile.recipientCount}
- Question characters: ${report.fixtureProfile.questionLength}
- Recipient-message characters: ${report.fixtureProfile.recipientMessageLength}
- Document body characters: ${report.fixtureProfile.documentBodyLengths.join(", ")}

## Evidence Boundary

- Allowed: ${report.boundary.allowedClaim}
- Forbidden: ${report.boundary.forbiddenClaim}
- Next exact proof: ${report.boundary.exactEvidenceNextStep}
- DB mutation performed: \`false\`
- Share session created: \`false\`
- Provider dispatch claimed: \`false\`
`;

fs.writeFileSync(path.join(outputDir, "report.md"), markdown);
console.log(JSON.stringify({
  output: path.relative(rootDir, outputDir),
  verdict: report.verdict,
  sourceHead,
  productionCommit: productionBuild.commitSha ?? null,
  rows: rows.length,
  failures: failures.length,
  exactSavedSessionVerdict: report.exactSavedSessionVerdict,
}, null, 2));
