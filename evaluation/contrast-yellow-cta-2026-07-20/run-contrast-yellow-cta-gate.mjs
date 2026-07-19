import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright";

const outDir = path.dirname(new URL(import.meta.url).pathname).replace(/^\/([A-Za-z]:)/u, "$1");
fs.mkdirSync(outDir, { recursive: true });

function srgb(channel) {
  const value = channel / 255;
  return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
}

function luminance(rgb) {
  return 0.2126 * srgb(rgb[0]) + 0.7152 * srgb(rgb[1]) + 0.0722 * srgb(rgb[2]);
}

function contrast(foreground, background) {
  const first = luminance(foreground);
  const second = luminance(background);
  return (Math.max(first, second) + 0.05) / (Math.min(first, second) + 0.05);
}

const build = await (await fetch("https://www.safeclaw.kr/api/build-info")).json();
const browser = await chromium.launch({ headless: true });
const routes = ["/", "/documents", "/roadmap", "/why", "/settings/ai-connect", "/search", "/worker", "/workers", "/archive", "/home"];
const results = [];

for (const route of routes) {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
  await page.goto(`https://www.safeclaw.kr${route}?theme=day`, { waitUntil: "networkidle", timeout: 60_000 });
  await page.evaluate(async () => {
    await document.fonts.ready;
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  });
  const elements = await page.evaluate(() => {
    const parseRgb = (value) => {
      const channels = value.match(/[\d.]+/g)?.slice(0, 3).map(Number);
      return channels?.length === 3 ? channels : null;
    };
    return [...document.querySelectorAll("a, button, [role='button'], .safeclaw-shared-action, .button")]
      .map((element) => {
        const rect = element.getBoundingClientRect();
        const style = getComputedStyle(element);
        return {
          tag: element.tagName.toLowerCase(),
          className: String(element.getAttribute("class") || "").slice(0, 160),
          text: String(element.textContent || element.getAttribute("aria-label") || "").replace(/\s+/gu, " ").trim().slice(0, 80),
          visible: rect.width > 0 && rect.height > 0 && style.display !== "none" && style.visibility !== "hidden",
          color: style.color,
          background: style.backgroundColor,
          foregroundRgb: parseRgb(style.color),
          backgroundRgb: parseRgb(style.backgroundColor),
          rect: { x: Math.round(rect.x), y: Math.round(rect.y), w: Math.round(rect.width), h: Math.round(rect.height) }
        };
      })
      .filter((item) => item.visible && item.foregroundRgb && item.backgroundRgb && item.background !== "rgba(0, 0, 0, 0)");
  });
  const failures = elements
    .map((item) => ({ ...item, contrast: contrast(item.foregroundRgb, item.backgroundRgb) }))
    .filter((item) => item.contrast < 4.5);
  const screenshot = path.join(outDir, `${route === "/" ? "root" : route.slice(1).replaceAll("/", "-")}.png`);
  await page.screenshot({ path: screenshot, fullPage: true });
  results.push({ route, url: page.url(), screenshot, failureCount: failures.length, failures });
  await page.close();
}

await browser.close();
fs.writeFileSync(
  path.join(outDir, "metrics.json"),
  `${JSON.stringify({ checkedAt: new Date().toISOString(), build, routes, results }, null, 2)}\n`
);
