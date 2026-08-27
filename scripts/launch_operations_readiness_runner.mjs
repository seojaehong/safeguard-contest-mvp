import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { chromium } from "playwright";

const baseUrl = (process.env.SAFECLAW_BASE_URL || "https://www.safeclaw.kr").replace(/\/$/u, "");
const outputDir = path.resolve(
  process.env.SAFECLAW_OUTPUT_DIR
    || "evaluation/launch-operations-readiness-2026-08-26",
);

const viewports = [
  { name: "desktop-day", width: 1440, height: 723, theme: "day" },
  { name: "desktop-night", width: 1440, height: 723, theme: "night" },
  { name: "mobile-day", width: 390, height: 723, theme: "day" },
  { name: "mobile-night", width: 390, height: 723, theme: "night" },
];

function countGridColumns(value) {
  return value.trim().split(/\s+/u).filter(Boolean).length;
}

async function fetchBuildInfo() {
  const response = await fetch(`${baseUrl}/api/build-info?codexCacheBust=launch-operations-readiness`);
  const payload = await response.json();
  return { status: response.status, ...payload };
}

await fs.mkdir(outputDir, { recursive: true });
const productionBuild = await fetchBuildInfo();
const browser = await chromium.launch({ headless: true });
const rows = [];

try {
  for (const viewport of viewports) {
    const context = await browser.newContext({
      colorScheme: viewport.theme === "night" ? "dark" : "light",
      viewport: { width: viewport.width, height: viewport.height },
    });
    const page = await context.newPage();
    const browserConsoleErrors = [];
    page.on("console", (message) => {
      if (message.type() === "error") browserConsoleErrors.push(message.text());
    });
    page.on("pageerror", (error) => browserConsoleErrors.push(error.message));

    await page.goto(`${baseUrl}/ops/api?theme=${viewport.theme}`, {
      waitUntil: "networkidle",
      timeout: 60_000,
    });
    const root = page.getByTestId("launch-operations-readiness");
    await root.waitFor({ state: "visible", timeout: 30_000 });
    const metrics = await root.evaluate((element) => {
      const rect = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      return {
        root: {
          left: rect.left,
          top: rect.top,
          right: rect.right,
          bottom: rect.bottom,
          width: rect.width,
          height: rect.height,
        },
        columns: style.gridTemplateColumns,
        cardCount: element.querySelectorAll(":scope > article").length,
        localHorizontalScroll: element.scrollWidth > element.clientWidth,
        publicAdmission: element.getAttribute("data-public-admission") || "",
        publicAdmissionConfiguration: element.getAttribute("data-public-admission-configuration") || "",
        providerDispatch: element.getAttribute("data-provider-dispatch") || "",
        photoVision: element.getAttribute("data-photo-vision") || "",
        text: element.textContent?.replace(/\s+/gu, " ").trim() || "",
      };
    });
    const pageMetrics = await page.evaluate(() => ({
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight,
      bodyWidth: document.body.scrollWidth,
      bodyHeight: document.body.scrollHeight,
      documentWidth: document.documentElement.scrollWidth,
      documentHeight: document.documentElement.scrollHeight,
      horizontalOverflow: document.documentElement.scrollWidth > window.innerWidth,
    }));
    const screenshot = path.join(outputDir, `${viewport.name}.png`);
    await page.screenshot({ path: screenshot, fullPage: false });

    const desktop = viewport.width >= 1024;
    const row = {
      ...viewport,
      ...pageMetrics,
      ...metrics,
      gridColumnCount: countGridColumns(metrics.columns),
      firstViewport: metrics.root.bottom <= viewport.height,
      configurationLabelPresent: metrics.text.includes("분산 설정 없음"),
      browserConsoleErrors,
      screenshot: path.relative(process.cwd(), screenshot).replaceAll("\\", "/"),
    };
    row.ok = row.cardCount === 4
      && row.firstViewport
      && row.horizontalOverflow === false
      && row.publicAdmission === "unavailable"
      && row.publicAdmissionConfiguration === "absent"
      && row.providerDispatch === "preview_only"
      && row.photoVision === "ready"
      && row.configurationLabelPresent
      && row.browserConsoleErrors.length === 0
      && (desktop
        ? row.gridColumnCount === 4 && row.localHorizontalScroll === false
        : row.gridColumnCount === 4 && row.localHorizontalScroll === true);
    rows.push(row);
    await context.close();
  }
} finally {
  await browser.close();
}

const passed = rows.filter((row) => row.ok).length;
const report = {
  schemaVersion: "safeclaw-launch-operations-readiness/v2",
  generatedAt: new Date().toISOString(),
  mode: baseUrl.includes("safeclaw.kr") ? "live-production" : "local-production",
  baseUrl,
  sourceHead: productionBuild.commitSha || "",
  productCommit: productionBuild.commitSha || "",
  productionBuild,
  verdict: passed === rows.length
    ? "PASS_LIVE_PRODUCTION_LAUNCH_OPERATIONS_CONFIGURATION_TRUTH"
    : "RED_LAUNCH_OPERATIONS_CONFIGURATION_TRUTH",
  rows,
  summary: {
    total: rows.length,
    passed,
    failed: rows.length - passed,
    configurationState: rows[0]?.publicAdmissionConfiguration || "",
  },
  boundaries: {
    distributedAdmissionConfigured: false,
    distributedAdmissionActivationRequired: true,
    providerDispatchReady: false,
    dbMutationPerformed: false,
    providerDispatchCalled: false,
    shareSessionCreated: false,
    wikiPublished: false,
    embeddingOrVectorMutationPerformed: false,
    koshaRegistryMutated: false,
    exactSavedShareVerdict: "MISSING_EVIDENCE",
    fullyAutomatedLaunchClaimAllowed: false,
  },
};

await fs.writeFile(path.join(outputDir, "report.json"), `${JSON.stringify(report, null, 2)}\n`, "utf8");
const markdown = `# Launch Operations Readiness\n\nVerdict: \`${report.verdict}\`\n\n- Route: \`${baseUrl}/ops/api\`\n- Production: \`${report.sourceHead}\`\n- Viewports: ${passed}/${rows.length} PASS\n- Admission configuration: \`${report.summary.configurationState}\`\n- Desktop: four-column capability cockpit inside the first viewport.\n- Mobile: four-column local-scroll task rail inside the first viewport.\n- Browser console errors: ${rows.reduce((sum, row) => sum + row.browserConsoleErrors.length, 0)}.\n\n## Boundary\n\nThis proves the operator-facing capability cockpit reports configuration truth. It does not activate distributed admission, authorize provider dispatch, shorten unrelated route bodies, or prove an exact saved Share session. No database, provider, Share-session, vector, Wiki, or KOSHA registry mutation occurred. Exact saved Share remains \`MISSING_EVIDENCE\`.\n`;
await fs.writeFile(path.join(outputDir, "report.md"), markdown, "utf8");
process.stdout.write(`${JSON.stringify({ verdict: report.verdict, total: rows.length, passed }, null, 2)}\n`);
if (passed !== rows.length) process.exitCode = 1;
