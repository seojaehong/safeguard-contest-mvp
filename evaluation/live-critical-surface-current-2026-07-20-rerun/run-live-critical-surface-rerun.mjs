import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright";

const outDir = path.dirname(new URL(import.meta.url).pathname).replace(/^\/([A-Za-z]:)/u, "$1");
const screenshotDir = path.join(outDir, "screenshots");
fs.mkdirSync(screenshotDir, { recursive: true });

const baseUrl = "https://www.safeclaw.kr";
const routes = [
  "/",
  "/workspace",
  "/why",
  "/ontology",
  "/knowledge",
  "/documents",
  "/reports",
  "/share/not-a-session?lang=vi",
];
const viewports = [
  { name: "desktop", width: 1440, height: 900 },
  { name: "mobile", width: 390, height: 844 },
];

function normalizeRouteName(route) {
  return route.replace(/^\//u, "").replace(/[^a-z0-9]+/giu, "-").replace(/^-|-$/gu, "") || "root";
}

async function readBuildInfo() {
  const response = await fetch(`${baseUrl}/api/build-info`);
  return await response.json();
}

async function measurePage(page) {
  return await page.evaluate(() => {
    const bodyText = document.body.innerText || "";
    const under44 = Array.from(document.querySelectorAll("a,button,summary,input,select,textarea,[role='button']"))
      .map((element) => {
        const rect = element.getBoundingClientRect();
        return {
          text: (element.textContent || element.getAttribute("aria-label") || "").trim().slice(0, 80),
          w: Math.round(rect.width),
          h: Math.round(rect.height),
          visible: rect.width > 0 && rect.height > 0,
        };
      })
      .filter((item) => item.visible && (item.w < 44 || item.h < 44));
    const outside = Array.from(document.body.querySelectorAll("*"))
      .filter((element) => {
        const rect = element.getBoundingClientRect();
        const style = getComputedStyle(element);
        if (style.visibility === "hidden" || style.display === "none") return false;
        return rect.width > 1 && rect.height > 1 && (rect.left < -1 || rect.right > window.innerWidth + 1);
      }).length;
    const internalTerms = ["DB 하네스", "품질 계약", "published_ontology", "human_review", "fallback", "Obsidian", "JSONL"]
      .filter((term) => bodyText.includes(term));
    return {
      title: document.title,
      scrollHeight: document.documentElement.scrollHeight,
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
      heightRatio: Number((document.documentElement.scrollHeight / window.innerHeight).toFixed(2)),
      horizontalOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
      outsideCount: outside,
      under44Count: under44.length,
      under44Samples: under44.slice(0, 8),
      internalTerms,
      bodySample: bodyText.slice(0, 600),
    };
  });
}

const buildInfo = await readBuildInfo();
const browser = await chromium.launch({ headless: true });
const rows = [];
const findings = [];

try {
  for (const viewport of viewports) {
    const context = await browser.newContext({
      viewport: { width: viewport.width, height: viewport.height },
      deviceScaleFactor: 1,
    });
    const page = await context.newPage();
    for (const route of routes) {
      const url = `${baseUrl}${route}`;
      const response = await page.goto(url, { waitUntil: "networkidle", timeout: 60_000 });
      const metrics = await measurePage(page);
      const screenshot = `screenshots/${viewport.name}-${normalizeRouteName(route)}.png`;
      await page.screenshot({ path: path.join(outDir, screenshot), fullPage: true });
      const row = {
        route,
        viewport: viewport.name,
        status: response?.status() ?? null,
        url: page.url(),
        screenshot,
        ...metrics,
      };
      rows.push(row);
      if (row.status !== 200) findings.push({ route, viewport: viewport.name, severity: "P1", message: `HTTP ${row.status}` });
      if (row.horizontalOverflow || row.outsideCount > 0) {
        findings.push({ route, viewport: viewport.name, severity: "P1", message: "horizontal overflow or outside elements detected" });
      }
      if (row.internalTerms.length > 0) {
        findings.push({ route, viewport: viewport.name, severity: "P2", message: `internal terms visible: ${row.internalTerms.join(", ")}` });
      }
      if (viewport.name === "mobile" && route === "/" && row.heightRatio > 10) {
        findings.push({ route, viewport: viewport.name, severity: "P3", message: `mobile root remains long (${row.heightRatio}x viewport)` });
      }
    }
    await context.close();
  }
} finally {
  await browser.close();
}

const report = {
  checkedAt: new Date().toISOString(),
  baseUrl,
  buildInfo,
  routes,
  viewports,
  findings,
  rows,
};

fs.writeFileSync(path.join(outDir, "report.json"), `${JSON.stringify(report, null, 2)}\n`, "utf8");

const tableRows = rows.map((row) => (
  `| ${row.route} | ${row.viewport} | ${row.status} | ${row.scrollHeight} (${row.heightRatio}x) | ${row.horizontalOverflow ? "yes" : "no"} | ${row.outsideCount} | ${row.under44Count} | ${row.internalTerms.join(", ") || "-"} |`
));
const md = [
  "# Live Critical Surface Current Rerun",
  "",
  `- Checked: ${report.checkedAt}`,
  `- Build marker: ${buildInfo.commitSha || "unknown"}`,
  `- Findings: ${findings.length}`,
  "",
  "## Findings",
  "",
  ...(findings.length ? findings.map((finding) => `- ${finding.severity}: ${finding.route} ${finding.viewport} - ${finding.message}`) : ["None."]),
  "",
  "## Rows",
  "",
  "| Route | Viewport | Status | Height | Overflow | Outside | Under44 | Internal terms |",
  "| --- | --- | ---: | ---: | --- | ---: | ---: | --- |",
  ...tableRows,
  "",
].join("\n");
fs.writeFileSync(path.join(outDir, "report.md"), md, "utf8");

console.log(JSON.stringify({
  build: buildInfo.commitSha || null,
  findings: findings.length,
  report: path.join(outDir, "report.md"),
}, null, 2));
process.exitCode = findings.some((finding) => finding.severity !== "P3") ? 1 : 0;
