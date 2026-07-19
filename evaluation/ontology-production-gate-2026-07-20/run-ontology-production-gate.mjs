import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright";

const outDir = path.dirname(new URL(import.meta.url).pathname).replace(/^\/([A-Za-z]:)/u, "$1");

const build = await (await fetch("https://www.safeclaw.kr/api/build-info")).json();
const browser = await chromium.launch({ headless: true });
const variants = [
  { name: "desktop-day", width: 1440, height: 900, theme: "day" },
  { name: "mobile-day", width: 390, height: 844, theme: "day" },
  { name: "desktop-night", width: 1440, height: 900, theme: "night" },
  { name: "mobile-night", width: 390, height: 844, theme: "night" }
];
const results = [];

for (const variant of variants) {
  const page = await browser.newPage({
    viewport: { width: variant.width, height: variant.height },
    deviceScaleFactor: 1
  });
  await page.goto(`https://www.safeclaw.kr/ontology?theme=${variant.theme}`, {
    waitUntil: "networkidle",
    timeout: 60_000
  });
  await page.evaluate(async () => {
    await document.fonts.ready;
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  });

  const metrics = await page.evaluate(() => {
    const toRect = (element) => {
      if (!element) return null;
      const rect = element.getBoundingClientRect();
      return {
        x: rect.x,
        y: rect.y,
        w: rect.width,
        h: rect.height,
        bottom: rect.bottom,
        display: getComputedStyle(element).display
      };
    };
    const graphNodes = [...document.querySelectorAll("[data-testid='ontology-neighborhood-node']")]
      .filter((element) => {
        const rect = element.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0;
      })
      .map((element) => {
        const rect = element.getBoundingClientRect();
        return {
          left: rect.left,
          top: rect.top,
          right: rect.right,
          bottom: rect.bottom
        };
      });
    let overlapPairs = 0;
    for (let i = 0; i < graphNodes.length; i += 1) {
      for (let j = i + 1; j < graphNodes.length; j += 1) {
        const a = graphNodes[i];
        const b = graphNodes[j];
        if (a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top) {
          overlapPairs += 1;
        }
      }
    }

    const outside = [...document.querySelectorAll("body *")]
      .filter((element) => {
        const rect = element.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0 && (rect.right > innerWidth + 1 || rect.left < -1);
      }).length;

    return {
      title: document.title,
      body: {
        width: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth,
        height: document.documentElement.scrollHeight,
        clientHeight: document.documentElement.clientHeight,
        overflowX: document.documentElement.scrollWidth > document.documentElement.clientWidth
      },
      root: toRect(document.querySelector("[data-testid='ontology-explorer-root']")),
      graph: toRect(document.querySelector("[data-testid='ontology-neighborhood-graph']")),
      mobileRelations: toRect(document.querySelector("[data-testid='ontology-mobile-relations']")),
      visibleGraphNodes: graphNodes.length,
      overlapPairs,
      outside,
      relationButtons: [...document.querySelectorAll("[data-testid='ontology-mobile-relations'] button")]
        .filter((element) => {
          const rect = element.getBoundingClientRect();
          return rect.width > 0 && rect.height > 0;
        }).length,
      visibleText: document.body.innerText.slice(0, 2400)
    };
  });

  const screenshot = path.join(outDir, `${variant.name}.png`);
  await page.screenshot({ path: screenshot, fullPage: true });
  results.push({
    name: variant.name,
    url: page.url(),
    viewport: { width: variant.width, height: variant.height },
    screenshot,
    metrics
  });
  await page.close();
}

await browser.close();

fs.writeFileSync(
  path.join(outDir, "metrics.json"),
  `${JSON.stringify({ checkedAt: new Date().toISOString(), build, results }, null, 2)}\n`
);
