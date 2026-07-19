import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright";

const root = process.cwd();
const outputDir = path.resolve(root, "evaluation/northstar-live-ui-current-2026-07-19");
const screenshotDir = path.join(outputDir, "screenshots");
const baseUrl = process.env.SAFECLAW_LIVE_BASE_URL ?? "https://www.safeclaw.kr";

const viewports = [
  { name: "desktop", width: 1440, height: 900 },
  { name: "mobile", width: 390, height: 844 },
];

const routeChecks = [
  { name: "workspace-day", path: "/workspace?theme=day" },
  { name: "workspace-night", path: "/workspace?theme=night" },
  { name: "documents-day", path: "/documents?theme=day" },
  { name: "reports-day", path: "/reports?theme=day" },
  { name: "share-vi-invalid", path: "/share/not-a-session?lang=vi&workerId=11111111-1111-4111-8111-111111111111" },
  { name: "ontology-day", path: "/ontology?theme=day" },
  { name: "why-day", path: "/why?theme=day" },
];

const internalTerms = [
  "DB 하네스",
  "품질 계약",
  "Obsidian",
  "JSONL",
  "published_ontology",
  "dryrun",
  "fallback",
  "qualityContract",
  "ontologyQa",
];

function safeName(value) {
  return value.replace(/[^a-z0-9가-힣_-]+/giu, "-").replace(/^-|-$/gu, "");
}

function parseRgb(value) {
  const channels = (value.match(/[\d.]+/gu) ?? []).slice(0, 3).map(Number);
  if (channels.length !== 3) return null;
  return value.startsWith("color(srgb") ? channels.map((channel) => channel * 255) : channels;
}

function luminanceChannel(value) {
  const normalized = value / 255;
  return normalized <= 0.03928 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
}

function contrastRatio(foreground, background) {
  const foregroundLuminance = 0.2126 * luminanceChannel(foreground[0])
    + 0.7152 * luminanceChannel(foreground[1])
    + 0.0722 * luminanceChannel(foreground[2]);
  const backgroundLuminance = 0.2126 * luminanceChannel(background[0])
    + 0.7152 * luminanceChannel(background[1])
    + 0.0722 * luminanceChannel(background[2]);
  const lighter = Math.max(foregroundLuminance, backgroundLuminance);
  const darker = Math.min(foregroundLuminance, backgroundLuminance);
  return (lighter + 0.05) / (darker + 0.05);
}

async function collectRoute(page, route, viewport) {
  await page.setViewportSize({ width: viewport.width, height: viewport.height });
  const response = await page.goto(`${baseUrl}${route.path}`, {
    waitUntil: "networkidle",
    timeout: 45_000,
  });
  await page.evaluate(async () => {
    await document.fonts.ready;
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  });

  const metric = await page.evaluate((terms) => {
    const parseRgbInPage = (value) => {
      const channels = (value.match(/[\d.]+/gu) ?? []).slice(0, 3).map(Number);
      if (channels.length !== 3) return null;
      return value.startsWith("color(srgb") ? channels.map((channel) => channel * 255) : channels;
    };
    const luminanceChannelInPage = (value) => {
      const normalized = value / 255;
      return normalized <= 0.03928 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
    };
    const contrastRatioInPage = (foreground, background) => {
      const foregroundLuminance = 0.2126 * luminanceChannelInPage(foreground[0])
        + 0.7152 * luminanceChannelInPage(foreground[1])
        + 0.0722 * luminanceChannelInPage(foreground[2]);
      const backgroundLuminance = 0.2126 * luminanceChannelInPage(background[0])
        + 0.7152 * luminanceChannelInPage(background[1])
        + 0.0722 * luminanceChannelInPage(background[2]);
      const lighter = Math.max(foregroundLuminance, backgroundLuminance);
      const darker = Math.min(foregroundLuminance, backgroundLuminance);
      return (lighter + 0.05) / (darker + 0.05);
    };
    const visible = (element) => {
      const style = window.getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return style.display !== "none"
        && style.visibility !== "hidden"
        && rect.width > 0
        && rect.height > 0;
    };
    const elements = [...document.querySelectorAll("body *")].filter(visible);
    const controls = elements.filter((element) => {
      const tag = element.tagName.toLowerCase();
      const role = element.getAttribute("role");
      return ["button", "input", "select", "textarea", "summary", "a"].includes(tag)
        || role === "button"
        || role === "link";
    });
    const outside = elements.filter((element) => {
      const rect = element.getBoundingClientRect();
      return rect.left < -0.5 || rect.right > window.innerWidth + 0.5;
    });
    const bodyText = document.body.innerText;
    const termHits = terms
      .map((term) => ({ term, count: (bodyText.match(new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g")) ?? []).length }))
      .filter((item) => item.count > 0);
    const elementText = (element) => (element.innerText ?? element.textContent ?? "").trim();
    const contrastIssues = elements
      .filter((element) => elementText(element).length > 0)
      .slice(0, 600)
      .map((element) => {
        const style = window.getComputedStyle(element);
        const foreground = parseRgbInPage(style.color);
        let background = parseRgbInPage(style.backgroundColor);
        let parent = element.parentElement;
        while (background && background.every((channel) => channel === 0) && parent) {
          const parentBackground = parseRgbInPage(window.getComputedStyle(parent).backgroundColor);
          if (parentBackground && !parentBackground.every((channel) => channel === 0)) {
            background = parentBackground;
            break;
          }
          parent = parent.parentElement;
        }
        if (!foreground || !background) return null;
        const ratio = contrastRatioInPage(foreground, background);
        const rect = element.getBoundingClientRect();
        return ratio < 4.5 && rect.width >= 20 && rect.height >= 12
          ? {
              text: elementText(element).replace(/\s+/gu, " ").slice(0, 60),
              ratio: Math.round(ratio * 100) / 100,
              color: style.color,
              background: style.backgroundColor,
            }
          : null;
      })
      .filter(Boolean)
      .slice(0, 12);
    const ontologyNodes = [...document.querySelectorAll('[data-testid="ontology-neighborhood-node"]')]
      .filter(visible)
      .map((element) => element.getBoundingClientRect());
    let ontologyOverlapPairs = 0;
    for (let left = 0; left < ontologyNodes.length; left += 1) {
      for (let right = left + 1; right < ontologyNodes.length; right += 1) {
        const overlapX = Math.min(ontologyNodes[left].right, ontologyNodes[right].right) - Math.max(ontologyNodes[left].left, ontologyNodes[right].left);
        const overlapY = Math.min(ontologyNodes[left].bottom, ontologyNodes[right].bottom) - Math.max(ontologyNodes[left].top, ontologyNodes[right].top);
        if (overlapX > 0 && overlapY > 0) ontologyOverlapPairs += 1;
      }
    }
    const sharePortalChrome = {
      vietnameseReview: bodyText.includes("Kiểm tra gói tài liệu"),
      koreanReview: bodyText.includes("문서팩 검토"),
      loadingSessionVi: bodyText.includes("Đang tải thông tin phiên"),
      loadingSessionKo: bodyText.includes("세션 정보를 조회하는 중입니다"),
    };
    return {
      title: document.title,
      finalUrl: location.href,
      documentWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
      bodyScrollWidth: document.body.scrollWidth,
      horizontalOverflow: Math.max(
        document.documentElement.scrollWidth - document.documentElement.clientWidth,
        document.body.scrollWidth - document.documentElement.clientWidth,
        0,
      ),
      outsideElementCount: outside.length,
      sub44ControlCount: controls.filter((element) => {
        const rect = element.getBoundingClientRect();
        return rect.width < 44 || rect.height < 44;
      }).length,
      minControlHeight: controls.length
        ? Math.round(Math.min(...controls.map((element) => element.getBoundingClientRect().height)) * 100) / 100
        : null,
      internalTermHits: termHits,
      contrastIssues,
      ontologyVisibleNodes: ontologyNodes.length,
      ontologyOverlapPairs,
      sharePortalChrome,
      bodySample: bodyText.replace(/\s+/gu, " ").slice(0, 240),
    };
  }, internalTerms);

  const shouldScreenshot = viewport.name === "mobile"
    && ["workspace-day", "share-vi-invalid", "ontology-day", "why-day"].includes(route.name);
  let screenshotPath = null;
  if (shouldScreenshot) {
    screenshotPath = path.join(screenshotDir, `${safeName(route.name)}-${viewport.name}.png`);
    await page.screenshot({ path: screenshotPath, fullPage: true });
  }
  return {
    route: route.name,
    path: route.path,
    viewport: viewport.name,
    width: viewport.width,
    height: viewport.height,
    status: response?.status() ?? null,
    okStatus: response ? response.status() < 500 : false,
    screenshotPath,
    ...metric,
  };
}

fs.mkdirSync(screenshotDir, { recursive: true });
const browser = await chromium.launch({ headless: true });
const rows = [];
try {
  const page = await browser.newPage();
  for (const viewport of viewports) {
    for (const route of routeChecks) {
      rows.push(await collectRoute(page, route, viewport));
    }
  }
} finally {
  await browser.close();
}

const blockers = rows.flatMap((row) => {
  const findings = [];
  if (!row.okStatus) findings.push({ severity: "P1", route: row.route, viewport: row.viewport, issue: `HTTP status ${row.status}` });
  if (row.horizontalOverflow > 0) findings.push({ severity: "P1", route: row.route, viewport: row.viewport, issue: `horizontal overflow ${row.horizontalOverflow}px` });
  if (row.outsideElementCount > 0 && row.viewport === "mobile") findings.push({ severity: "P1", route: row.route, viewport: row.viewport, issue: `outside elements ${row.outsideElementCount}` });
  if (row.route === "ontology-day" && row.ontologyOverlapPairs > 0) findings.push({ severity: "P1", route: row.route, viewport: row.viewport, issue: `ontology overlap pairs ${row.ontologyOverlapPairs}` });
  if (row.route === "share-vi-invalid" && row.viewport === "mobile" && !row.sharePortalChrome.vietnameseReview) {
    findings.push({ severity: "P1", route: row.route, viewport: row.viewport, issue: "Vietnamese recipient chrome missing" });
  }
  if (row.route === "share-vi-invalid" && row.viewport === "mobile" && row.sharePortalChrome.koreanReview) {
    findings.push({ severity: "P2", route: row.route, viewport: row.viewport, issue: "Korean recipient chrome leaked into Vietnamese shell" });
  }
  if (row.internalTermHits.length > 0) {
    findings.push({
      severity: "P2",
      route: row.route,
      viewport: row.viewport,
      issue: `internal terms visible: ${row.internalTermHits.map((item) => `${item.term}(${item.count})`).join(", ")}`,
    });
  }
  if (row.contrastIssues.length > 0) {
    findings.push({
      severity: "P2",
      route: row.route,
      viewport: row.viewport,
      issue: `contrast samples below AA: ${row.contrastIssues.slice(0, 3).map((item) => `${item.text} ${item.ratio}`).join("; ")}`,
    });
  }
  return findings;
});

const summary = {
  generatedAt: new Date().toISOString(),
  baseUrl,
  rowCount: rows.length,
  pass: blockers.filter((item) => item.severity === "P1").length === 0,
  p1Count: blockers.filter((item) => item.severity === "P1").length,
  p2Count: blockers.filter((item) => item.severity === "P2").length,
};

fs.writeFileSync(
  path.join(outputDir, "report.json"),
  `${JSON.stringify({ summary, blockers, rows }, null, 2)}\n`,
  "utf8",
);

const lines = [
  "# SafeClaw Live UI Current Gate",
  "",
  `- Generated: ${summary.generatedAt}`,
  `- Base URL: ${baseUrl}`,
  `- Rows: ${summary.rowCount}`,
  `- P1: ${summary.p1Count}`,
  `- P2: ${summary.p2Count}`,
  `- Launch UI smoke: ${summary.pass ? "PASS" : "REVIEW REQUIRED"}`,
  "",
  "## Findings",
  "",
  ...(
    blockers.length === 0
      ? ["- No P1/P2 findings in this bounded smoke."]
      : blockers.map((finding) => `- [${finding.severity}] ${finding.viewport} ${finding.route}: ${finding.issue}`)
  ),
  "",
  "## Route Metrics",
  "",
  "| Route | Viewport | Status | Overflow | Outside | Sub-44 | Internal Terms |",
  "| --- | --- | ---: | ---: | ---: | ---: | --- |",
  ...rows.map((row) => `| ${row.route} | ${row.viewport} | ${row.status ?? "n/a"} | ${row.horizontalOverflow} | ${row.outsideElementCount} | ${row.sub44ControlCount} | ${row.internalTermHits.map((item) => `${item.term}:${item.count}`).join(", ") || "-"} |`),
  "",
  "## Screenshots",
  "",
  ...rows
    .filter((row) => row.screenshotPath)
    .map((row) => `- ${row.route} ${row.viewport}: ${path.relative(root, row.screenshotPath).replaceAll("\\", "/")}`),
  "",
];

fs.writeFileSync(path.join(outputDir, "report.md"), `${lines.join("\n")}\n`, "utf8");

console.log(JSON.stringify(summary, null, 2));
