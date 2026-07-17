import { chromium } from "playwright";
import { describe, expect, it } from "vitest";

const baseUrl = process.env.ONTOLOGY_BASE_URL;

function luminanceChannel(value: number) {
  const normalized = value / 255;
  return normalized <= 0.03928 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
}

function contrastRatio(foreground: number[], background: number[]) {
  const luminance = (rgb: number[]) => 0.2126 * luminanceChannel(rgb[0])
    + 0.7152 * luminanceChannel(rgb[1])
    + 0.0722 * luminanceChannel(rgb[2]);
  const foregroundLuminance = luminance(foreground);
  const backgroundLuminance = luminance(background);
  return (Math.max(foregroundLuminance, backgroundLuminance) + 0.05)
    / (Math.min(foregroundLuminance, backgroundLuminance) + 0.05);
}

describe.skipIf(!baseUrl)("ontology tablet layout", () => {
  for (const theme of ["day", "night"] as const) {
    it(`keeps the 1024px ${theme} layout inside the viewport`, async () => {
      const browser = await chromium.launch({ headless: true });
      const page = await browser.newPage({ viewport: { width: 1024, height: 768 } });

      try {
        await page.goto(`${baseUrl}/ontology?theme=${theme}`, { waitUntil: "networkidle" });
        await page.locator('[data-module-route="/ontology"][data-ready="true"]').waitFor();
        await page.getByRole("button", { name: "확장 관계" }).click();
        const graph = page.locator('[data-testid="ontology-neighborhood-graph"]').first();
        await graph.waitFor({ state: "visible" });
        await graph.scrollIntoViewIfNeeded();

        const metrics = await page.evaluate(() => {
          const visibleElements = Array.from(document.body.querySelectorAll<HTMLElement>("*"))
            .filter((element) => {
              const style = getComputedStyle(element);
              const rect = element.getBoundingClientRect();
              return style.display !== "none"
                && style.visibility !== "hidden"
                && rect.width > 0
                && rect.height > 0;
            });
          const outsideElements = visibleElements
            .filter((element) => {
              const rect = element.getBoundingClientRect();
              return rect.left < -1 || rect.right > window.innerWidth + 1;
            })
            .map((element) => ({
              tag: element.tagName.toLowerCase(),
              className: element.className,
              testId: element.dataset.testid ?? null
            }));
          const graphElement = document.querySelector<HTMLElement>('[data-testid="ontology-neighborhood-graph"]');
          if (!graphElement) throw new Error("Ontology neighborhood graph was not rendered");
          const graphRect = graphElement.getBoundingClientRect();
          const nodes = Array.from(graphElement.querySelectorAll<HTMLElement>('[data-testid="ontology-neighborhood-node"]'))
            .filter((element) => {
              const style = getComputedStyle(element);
              const rect = element.getBoundingClientRect();
              return style.display !== "none" && style.visibility !== "hidden" && rect.width > 0 && rect.height > 0;
            });
          const nodeRects = nodes.map((element) => element.getBoundingClientRect());
          let overlapPairs = 0;
          for (let left = 0; left < nodeRects.length; left += 1) {
            for (let right = left + 1; right < nodeRects.length; right += 1) {
              const overlapX = Math.min(nodeRects[left].right, nodeRects[right].right)
                - Math.max(nodeRects[left].left, nodeRects[right].left);
              const overlapY = Math.min(nodeRects[left].bottom, nodeRects[right].bottom)
                - Math.max(nodeRects[left].top, nodeRects[right].top);
              if (overlapX > 0 && overlapY > 0) overlapPairs += 1;
            }
          }
          const clippedNodes = nodeRects.filter((rect) => rect.left < graphRect.left - 1
            || rect.right > graphRect.right + 1
            || rect.top < graphRect.top - 1
            || rect.bottom > graphRect.bottom + 1).length;
          const parseRgb = (value: string) => {
            const channels = (value.match(/[\d.]+/g) || []).slice(0, 3).map(Number);
            return value.startsWith("color(srgb")
              ? channels.map((channel) => channel * 255)
              : channels;
          };
          const nodeContrasts = nodes.map((element) => {
            const style = getComputedStyle(element);
            return { foreground: parseRgb(style.color), background: parseRgb(style.backgroundColor) };
          });

          return {
            documentOverflow: Math.max(document.documentElement.scrollWidth - window.innerWidth, 0),
            bodyOverflow: Math.max(document.body.scrollWidth - window.innerWidth, 0),
            outsideElements,
            graphVisible: graphRect.top >= -1
              && graphRect.bottom <= window.innerHeight + 1
              && graphRect.left >= -1
              && graphRect.right <= window.innerWidth + 1,
            visibleNodes: nodes.length,
            overlapPairs,
            clippedNodes,
            nodeContrasts
          };
        });
        const minimumNodeContrast = Math.min(...metrics.nodeContrasts.map(
          ({ foreground, background }) => contrastRatio(foreground, background)
        ));

        expect(metrics.documentOverflow).toBe(0);
        expect(metrics.bodyOverflow).toBe(0);
        expect(metrics.outsideElements).toEqual([]);
        expect(metrics.graphVisible).toBe(true);
        expect(metrics.visibleNodes).toBe(15);
        expect(metrics.overlapPairs).toBe(0);
        expect(metrics.clippedNodes).toBe(0);
        expect(minimumNodeContrast).toBeGreaterThanOrEqual(4.5);
      } finally {
        await browser.close();
      }
    }, 45_000);
  }
});
