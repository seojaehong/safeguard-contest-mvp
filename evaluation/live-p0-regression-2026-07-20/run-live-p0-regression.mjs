import { chromium } from "playwright";
import { writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";

const outDir = join(process.cwd(), "evaluation", "live-p0-regression-2026-07-20");
const baseUrl = "https://www.safeclaw.kr";

function rectOverlap(a, b) {
  const x = Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left));
  const y = Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
  return x > 2 && y > 2;
}

function luminance([r, g, b]) {
  const values = [r, g, b].map((value) => {
    const channel = value / 255;
    return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * values[0] + 0.7152 * values[1] + 0.0722 * values[2];
}

function contrastRatio(fg, bg) {
  const a = luminance(fg);
  const b = luminance(bg);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

function parseRgb(value) {
  const match = value.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  return match ? [Number(match[1]), Number(match[2]), Number(match[3])] : null;
}

async function getBuildInfo(page) {
  const response = await page.goto(`${baseUrl}/api/build-info`, { waitUntil: "networkidle" });
  if (!response || !response.ok()) return { ok: false, status: response?.status() ?? null };
  return JSON.parse(await response.text());
}

async function auditRoute(page, path, viewport) {
  await page.setViewportSize(viewport);
  await page.goto(`${baseUrl}${path}`, { waitUntil: "networkidle" });
  await page.waitForTimeout(500);
  return page.evaluate(({ path }) => {
    function parseRgbInPage(value) {
      const match = value.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
      return match ? [Number(match[1]), Number(match[2]), Number(match[3])] : null;
    }
    function luminanceInPage(rgb) {
      const values = rgb.map((value) => {
        const channel = value / 255;
        return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
      });
      return 0.2126 * values[0] + 0.7152 * values[1] + 0.0722 * values[2];
    }
    function contrastRatioInPage(fg, bg) {
      const a = luminanceInPage(fg);
      const b = luminanceInPage(bg);
      return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
    }
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const all = [...document.querySelectorAll("*")];
    const visible = all.filter((element) => {
      const rect = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      return rect.width > 0 && rect.height > 0 && style.visibility !== "hidden" && style.display !== "none";
    });
    const outside = visible.filter((element) => {
      const rect = element.getBoundingClientRect();
      return rect.right > viewportWidth + 1 || rect.left < -1;
    }).length;
    const text = document.body.innerText || "";
    const internalTerms = ["DB 하네스", "qualityContract", "ontologyQa", "Obsidian", "JSONL", "API path"]
      .filter((term) => text.includes(term));
    const yellowContrastFailures = visible.flatMap((element) => {
      const style = getComputedStyle(element);
      const fg = parseRgbInPage(style.color);
      const bg = parseRgbInPage(style.backgroundColor);
      if (!fg || !bg || style.backgroundColor === "rgba(0, 0, 0, 0)") return [];
      const ratio = contrastRatioInPage(fg, bg);
      const yellowish = bg[0] > 220 && bg[1] > 160 && bg[2] < 90;
      if (!yellowish || ratio >= 4.5) return [];
      const rect = element.getBoundingClientRect();
      return [{
        text: (element.textContent || "").trim().slice(0, 60),
        selector: element.className || element.tagName.toLowerCase(),
        color: style.color,
        backgroundColor: style.backgroundColor,
        ratio: Number(ratio.toFixed(2)),
        rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height }
      }];
    }).slice(0, 20);
    return {
      path,
      viewport: { width: viewportWidth, height: viewportHeight },
      documentWidth: document.documentElement.scrollWidth,
      bodyWidth: document.body.scrollWidth,
      documentHeight: document.documentElement.scrollHeight,
      horizontalOverflow: document.documentElement.scrollWidth > viewportWidth + 1 || document.body.scrollWidth > viewportWidth + 1,
      outside,
      internalTerms,
      yellowContrastFailures
    };
  }, { path });
}

async function auditOntology(page, viewport) {
  await page.setViewportSize(viewport);
  await page.goto(`${baseUrl}/ontology`, { waitUntil: "networkidle" });
  await page.waitForTimeout(800);
  return page.evaluate(() => {
    function rectOverlapInPage(a, b) {
      const x = Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left));
      const y = Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
      return x > 2 && y > 2;
    }
    const candidates = [...document.querySelectorAll("article, [role='button'], button")]
      .filter((element) => {
        const rect = element.getBoundingClientRect();
        const text = (element.textContent || "").trim();
        return text && rect.width > 20 && rect.height > 16 && rect.top > 0;
      })
      .map((element) => {
        const rect = element.getBoundingClientRect();
        const style = getComputedStyle(element);
        return {
          text: (element.textContent || "").trim().slice(0, 40),
          rect: { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom, width: rect.width, height: rect.height },
          color: style.color,
          backgroundColor: style.backgroundColor
        };
      });
    let overlapPairs = 0;
    for (let i = 0; i < candidates.length; i += 1) {
      for (let j = i + 1; j < candidates.length; j += 1) {
        if (rectOverlapInPage(candidates[i].rect, candidates[j].rect)) overlapPairs += 1;
      }
    }
    return {
      visibleNodeLikeCount: candidates.length,
      overlapPairs,
      sample: candidates.slice(0, 12)
    };
  });
}

async function auditWorkspaceEmpty(page) {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.context().clearCookies();
  await page.goto(`${baseUrl}/workspace`, { waitUntil: "networkidle" });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: "networkidle" });
  const button = page.getByRole("button", { name: /생성/ }).first();
  await button.click().catch(() => null);
  await page.waitForTimeout(700);
  return page.evaluate(() => {
    const text = document.body.innerText || "";
    const active = document.activeElement;
    return {
      hasAlertRole: document.querySelectorAll("[role='alert']").length,
      hasErrorText: /입력|현장 상황|작성|필수|한 줄/u.test(text),
      activeTag: active?.tagName ?? null,
      activeName: active?.getAttribute("aria-label") || active?.getAttribute("name") || active?.id || null,
      textareaValueLength: document.querySelector("textarea")?.value.length ?? null
    };
  });
}

await mkdir(outDir, { recursive: true });
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();

const buildInfo = await getBuildInfo(page);
const desktop = { width: 1440, height: 900 };
const mobile = { width: 390, height: 844 };
const routes = ["/ontology", "/why", "/workspace", "/documents", "/reports", "/knowledge"];
const routeAudits = [];
for (const route of routes) {
  routeAudits.push(await auditRoute(page, route, desktop));
  routeAudits.push(await auditRoute(page, route, mobile));
}
const ontologyDesktop = await auditOntology(page, desktop);
const ontologyMobile = await auditOntology(page, mobile);
const workspaceEmpty = await auditWorkspaceEmpty(page);

await browser.close();

const findings = [];
for (const route of routeAudits) {
  if (route.horizontalOverflow || route.outside > 0) findings.push({ severity: "P1", route: route.path, viewport: route.viewport, issue: "horizontal-overflow", outside: route.outside });
  if (route.yellowContrastFailures.length) findings.push({ severity: "P2", route: route.path, viewport: route.viewport, issue: "yellow-contrast", count: route.yellowContrastFailures.length, sample: route.yellowContrastFailures[0] });
  if (route.internalTerms.length) findings.push({ severity: "P2", route: route.path, viewport: route.viewport, issue: "internal-terms", terms: route.internalTerms });
}
if (ontologyDesktop.overlapPairs > 0) findings.push({ severity: "P1", route: "/ontology", viewport: desktop, issue: "node-overlap", overlapPairs: ontologyDesktop.overlapPairs });
if (ontologyMobile.overlapPairs > 0) findings.push({ severity: "P1", route: "/ontology", viewport: mobile, issue: "node-overlap", overlapPairs: ontologyMobile.overlapPairs });
if (!workspaceEmpty.hasAlertRole && !workspaceEmpty.hasErrorText) findings.push({ severity: "P1", route: "/workspace", viewport: mobile, issue: "empty-submit-no-feedback", workspaceEmpty });

const report = {
  generatedAt: new Date().toISOString(),
  buildInfo,
  routeAudits,
  ontologyDesktop,
  ontologyMobile,
  workspaceEmpty,
  findings
};

await writeFile(join(outDir, "report.json"), JSON.stringify(report, null, 2), "utf8");
await writeFile(join(outDir, "report.md"), [
  "# Live P0 Regression Audit",
  "",
  `Generated at: ${report.generatedAt}`,
  "",
  `Production commit: \`${buildInfo.commitSha || "unknown"}\``,
  "",
  `Findings: ${findings.length}`,
  "",
  "## Findings",
  "",
  findings.length
    ? findings.map((finding) => `- ${finding.severity} ${finding.route} ${finding.issue}: ${JSON.stringify(finding)}`).join("\n")
    : "- No findings from this focused regression gate.",
  "",
  "## Workspace Empty Submit",
  "",
  "```json",
  JSON.stringify(workspaceEmpty, null, 2),
  "```",
  "",
  "## Ontology",
  "",
  `- Desktop overlap pairs: ${ontologyDesktop.overlapPairs}`,
  `- Mobile overlap pairs: ${ontologyMobile.overlapPairs}`,
  "",
  "## Route Summary",
  "",
  "| Route | Viewport | Overflow | Outside | Internal terms | Yellow contrast failures |",
  "| --- | ---: | ---: | ---: | --- | ---: |",
  ...routeAudits.map((route) => `| ${route.path} | ${route.viewport.width} | ${route.horizontalOverflow} | ${route.outside} | ${route.internalTerms.join(", ") || "-"} | ${route.yellowContrastFailures.length} |`)
].join("\n"), "utf8");

console.log(JSON.stringify({
  buildInfo,
  findingCount: findings.length,
  findings: findings.slice(0, 12),
  reportPath: join(outDir, "report.md")
}, null, 2));
