import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { chromium } from "playwright";

const args = new Map();
for (let index = 2; index < process.argv.length; index += 2) {
  const key = process.argv[index];
  const value = process.argv[index + 1];
  if (!key?.startsWith("--") || !value) {
    throw new Error(`Invalid argument pair at ${key || "<missing>"}`);
  }
  args.set(key.slice(2), value);
}

const baseUrl = (args.get("base-url") || "https://www.safeclaw.kr").replace(/\/$/, "");
const expectedCommit = args.get("expected-commit");
const outputName = args.get("output");
if (!expectedCommit || !outputName) {
  throw new Error("Required arguments: --expected-commit <sha> --output <directory-name>");
}

const artifactRoot = path.dirname(new URL(import.meta.url).pathname.replace(/^\/(.:)/, "$1"));
const outputDir = path.join(artifactRoot, outputName);
fs.mkdirSync(outputDir, { recursive: true });
const fixtureData = JSON.parse(fs.readFileSync(
  path.join(process.cwd(), "evaluation", "2026-07-05-two-track-prod-smoke", "api-ask-response.json"),
  "utf8",
));
const storedFixture = {
  savedAt: "2026-08-27T09:00:00+09:00",
  source: "workspace",
  generationFingerprint: "dispatch-first-viewport-fixture",
  data: fixtureData,
  workerSnapshot: {
    savedAt: "2026-08-27T09:00:00+09:00",
    source: "workspace",
    workers: [{
      id: "worker-dispatch-geometry",
      displayName: "Vietnamese worker",
      role: "Welding worker",
      joinedAt: "2026-08-27",
      experienceLevel: "middle",
      experienceSummary: "Field experience confirmed",
      nationality: "Vietnam",
      languageCode: "vi",
      languageLabel: "Vietnamese",
      isNewWorker: false,
      isForeignWorker: true,
      trainingStatus: "training scheduled today",
      trainingSummary: "Vietnamese briefing required",
      phone: "01000000003",
    }],
    selectedWorkerIds: ["worker-dispatch-geometry"],
  },
};

const buildResponse = await fetch(`${baseUrl}/api/build-info?codexCacheBust=${encodeURIComponent(expectedCommit)}`);
if (!buildResponse.ok) {
  throw new Error(`Build marker request failed: HTTP ${buildResponse.status}`);
}
const productionBuild = await buildResponse.json();
if (productionBuild.commitSha !== expectedCommit) {
  throw new Error(`Production marker mismatch: expected ${expectedCommit}, received ${productionBuild.commitSha || "missing"}`);
}

const scenarios = [
  { id: "desktop-day", theme: "day", width: 1440, height: 723 },
  { id: "desktop-night", theme: "night", width: 1440, height: 723 },
  { id: "mobile-day", theme: "day", width: 390, height: 723 },
  { id: "mobile-night", theme: "night", width: 390, height: 723 },
];

function desktopVerdict(metrics) {
  const sameRow = new Set(metrics.channelCards.map((card) => card.top)).size === 1;
  const distinctColumns = new Set(metrics.channelCards.map((card) => card.left)).size === 3;
  return metrics.horizontalOverflow === 0
    && metrics.rootWidth >= 1040
    && metrics.rootScrollHeight <= metrics.rootClientHeight + 1
    && metrics.primaryBottom <= metrics.viewportHeight
    && metrics.previewBottom <= metrics.viewportHeight
    && metrics.channelActionBottom <= metrics.viewportHeight
    && metrics.previewLeft >= metrics.primaryRight
    && metrics.titleFontSize <= 20
    && metrics.statusReasonFontSize <= 14
    && metrics.channelHeadingFontSize <= 14
    && metrics.channelCards.length === 3
    && distinctColumns
    && sameRow
    && metrics.channelCards.every((card) => card.width >= 150 && card.height <= 80)
    && metrics.linesScrollHeight >= metrics.linesClientHeight
    && metrics.linesOverflowY === "auto";
}

function mobileVerdict(metrics) {
  return metrics.horizontalOverflow === 0
    && metrics.rootOverflowY === "auto"
    && metrics.rootScrollHeight >= metrics.rootClientHeight
    && metrics.summaryBottom <= metrics.viewportHeight
    && metrics.primaryBottom <= metrics.viewportHeight
    && metrics.primaryTop >= metrics.summaryBottom
    && metrics.previewTop >= metrics.primaryBottom
    && metrics.titleFontSize <= 20
    && metrics.statusReasonFontSize <= 14
    && metrics.linesScrollHeight >= metrics.linesClientHeight
    && metrics.linesOverflowY === "auto"
    && metrics.configCards.length === 3
    && metrics.configCards.every((card) => card.display === "none" && card.height === 0);
}

const browser = await chromium.launch({ headless: true });
const rows = [];
try {
  for (const scenario of scenarios) {
    const page = await browser.newPage({ viewport: { width: scenario.width, height: scenario.height } });
    try {
      await page.addInitScript((stored) => {
        window.localStorage.setItem("safeclaw.currentWorkpack.v1", JSON.stringify(stored));
      }, storedFixture);
      await page.goto(`${baseUrl}/dispatch?theme=${scenario.theme}`, { waitUntil: "networkidle", timeout: 60_000 });
      await page.locator("[data-share-root]").waitFor({ state: "visible", timeout: 30_000 });
      await page.evaluate(async () => {
        await document.fonts.ready;
        await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      });

      const metrics = await page.evaluate(() => {
        const required = (selector) => {
          const element = document.querySelector(selector);
          if (!(element instanceof HTMLElement)) throw new Error(`Missing ${selector}`);
          return element;
        };
        const visiblePrimary = [...document.querySelectorAll("[data-share-primary]")]
          .find((element) => element instanceof HTMLElement && getComputedStyle(element).display !== "none");
        if (!(visiblePrimary instanceof HTMLElement)) throw new Error("Missing visible primary action");
        const root = required("[data-share-root]");
        const preview = required("[data-share-preview]");
        const lines = required(".message-preview-lines");
        const title = required(".share-workflow-header > div:first-child > strong");
        const statusReason = required(".share-status-pill strong");
        const rootRect = root.getBoundingClientRect();
        const previewRect = preview.getBoundingClientRect();
        const primaryRect = visiblePrimary.getBoundingClientRect();
        const base = {
          viewportHeight: window.innerHeight,
          pageHeight: document.documentElement.scrollHeight,
          rootTop: rootRect.top,
          rootBottom: rootRect.bottom,
          rootWidth: rootRect.width,
          rootHeight: rootRect.height,
          rootClientHeight: root.clientHeight,
          rootScrollHeight: root.scrollHeight,
          rootOverflowY: getComputedStyle(root).overflowY,
          previewTop: previewRect.top,
          previewBottom: previewRect.bottom,
          previewLeft: previewRect.left,
          primaryTop: primaryRect.top,
          primaryBottom: primaryRect.bottom,
          primaryRight: primaryRect.right,
          linesClientHeight: lines.clientHeight,
          linesScrollHeight: lines.scrollHeight,
          linesOverflowY: getComputedStyle(lines).overflowY,
          titleFontSize: Number.parseFloat(getComputedStyle(title).fontSize),
          statusReasonFontSize: Number.parseFloat(getComputedStyle(statusReason).fontSize),
          horizontalOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        };
        if (window.innerWidth >= 960) {
          const channelHeading = required("[data-share-owner='channels'] .share-form-card-head strong");
          const channelActions = [...document.querySelectorAll("[data-share-owner='channels'] .command-actions :is(a, button)")];
          const channelCards = [...document.querySelectorAll(".channel-grid .channel-card")];
          return {
            ...base,
            channelHeadingFontSize: Number.parseFloat(getComputedStyle(channelHeading).fontSize),
            channelActionBottom: Math.max(...channelActions.map((element) => element.getBoundingClientRect().bottom)),
            channelCards: channelCards.map((element) => {
              const rect = element.getBoundingClientRect();
              return { left: Math.round(rect.left), top: Math.round(rect.top), width: Math.round(rect.width), height: Math.round(rect.height) };
            }),
          };
        }
        const summary = required("[data-share-mobile-summary]");
        const configCards = [...document.querySelectorAll(".share-config-card")];
        const summaryRect = summary.getBoundingClientRect();
        return {
          ...base,
          summaryBottom: summaryRect.bottom,
          configCards: configCards.map((element) => ({
            display: getComputedStyle(element).display,
            height: Math.round(element.getBoundingClientRect().height),
          })),
        };
      });

      const isDesktop = scenario.width >= 960;
      const pass = isDesktop ? desktopVerdict(metrics) : mobileVerdict(metrics);
      const screenshot = `${scenario.id}.png`;
      await page.screenshot({ path: path.join(outputDir, screenshot), fullPage: true });
      rows.push({ ...scenario, route: `/dispatch?theme=${scenario.theme}`, verdict: pass ? "PASS" : "RED", metrics, screenshot });
    } finally {
      await page.close();
    }
  }
} finally {
  await browser.close();
}

const passCount = rows.filter((row) => row.verdict === "PASS").length;
const report = {
  schemaVersion: "safeclaw-dispatch-first-viewport-containment-stage/v1",
  checkedAt: new Date().toISOString(),
  mode: baseUrl.includes("127.0.0.1") || baseUrl.includes("localhost") ? "current-source-local-production" : "live-production",
  baseUrl,
  sourceHead: expectedCommit,
  productionBuild,
  route: "/dispatch",
  total: rows.length,
  pass: passCount,
  fail: rows.length - passCount,
  verdict: passCount === rows.length ? "PASS" : "RED",
  rows,
  mutationBoundary: {
    dbMutationPerformed: false,
    shareSessionCreated: false,
    providerDispatchCalled: false,
    embeddingOrVectorMutationPerformed: false,
    wikiPublicationPerformed: false,
    koshaRegistryMutationPerformed: false,
  },
  remainingBoundaries: {
    exactSavedShareVerdict: "MISSING_EVIDENCE",
    exactSavedShareUserSessionReproduced: false,
    routeSplitAloneAcceptedAsFix: false,
  },
};
fs.writeFileSync(path.join(outputDir, "report.json"), `${JSON.stringify(report, null, 2)}\n`, "utf8");
process.stdout.write(`${JSON.stringify({ outputDir, verdict: report.verdict, pass: report.pass, fail: report.fail })}\n`);
process.exitCode = report.fail === 0 ? 0 : 1;
