import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright";

const outDir = path.dirname(new URL(import.meta.url).pathname).replace(/^\/([A-Za-z]:)/u, "$1");
fs.mkdirSync(outDir, { recursive: true });

const build = await (await fetch("https://www.safeclaw.kr/api/build-info")).json();
const browser = await chromium.launch({ headless: true });
const variants = [
  { name: "desktop-day", width: 1440, height: 900, theme: "day" },
  { name: "mobile-day", width: 390, height: 844, theme: "day" },
  { name: "mobile-night", width: 390, height: 844, theme: "night" }
];
const results = [];

for (const variant of variants) {
  const page = await browser.newPage({ viewport: { width: variant.width, height: variant.height }, deviceScaleFactor: 1 });
  await page.goto(`https://www.safeclaw.kr/why?theme=${variant.theme}`, { waitUntil: "networkidle", timeout: 60_000 });
  await page.evaluate(async () => {
    await document.fonts.ready;
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  });
  const metrics = await page.evaluate(() => {
    const table = document.querySelector("[data-why-comparison]");
    const tableRect = table?.getBoundingClientRect();
    const outside = [...document.querySelectorAll("body *")]
      .filter((element) => {
        const rect = element.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0 && (rect.right > innerWidth + 1 || rect.left < -1);
      })
      .map((element) => {
        const rect = element.getBoundingClientRect();
        return {
          tag: element.tagName.toLowerCase(),
          className: String(element.getAttribute("class") || "").slice(0, 100),
          text: String(element.textContent || "").replace(/\s+/gu, " ").trim().slice(0, 80),
          left: Math.round(rect.left),
          right: Math.round(rect.right),
          width: Math.round(rect.width)
        };
      });
    return {
      body: {
        width: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth,
        height: document.documentElement.scrollHeight,
        clientHeight: document.documentElement.clientHeight,
        overflowX: document.documentElement.scrollWidth > document.documentElement.clientWidth
      },
      table: tableRect ? {
        x: Math.round(tableRect.x),
        width: Math.round(tableRect.width),
        right: Math.round(tableRect.right)
      } : null,
      outsideCount: outside.length,
      outside,
      textSample: document.body.innerText.slice(0, 1200)
    };
  });
  const screenshot = path.join(outDir, `${variant.name}.png`);
  await page.screenshot({ path: screenshot, fullPage: true });
  results.push({ name: variant.name, viewport: variant, url: page.url(), screenshot, metrics });
  await page.close();
}

await browser.close();
fs.writeFileSync(
  path.join(outDir, "metrics.json"),
  `${JSON.stringify({ checkedAt: new Date().toISOString(), build, results }, null, 2)}\n`
);
