import { chromium } from "playwright";
import { describe, expect, it } from "vitest";

const baseUrl = process.env.ONTOLOGY_BASE_URL;

describe.skipIf(!baseUrl)("ontology tablet layout", () => {
  for (const theme of ["day", "night"] as const) {
    it(`keeps the 1024px ${theme} layout inside the viewport`, async () => {
      const browser = await chromium.launch({ headless: true });
      const page = await browser.newPage({ viewport: { width: 1024, height: 768 } });

      try {
        await page.goto(`${baseUrl}/ontology?theme=${theme}`, { waitUntil: "networkidle" });
        await page.locator('[data-module-route="/ontology"][data-ready="true"]').waitFor();

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

          return {
            documentOverflow: Math.max(document.documentElement.scrollWidth - window.innerWidth, 0),
            bodyOverflow: Math.max(document.body.scrollWidth - window.innerWidth, 0),
            outsideElements
          };
        });

        expect(metrics.documentOverflow).toBe(0);
        expect(metrics.bodyOverflow).toBe(0);
        expect(metrics.outsideElements).toEqual([]);
      } finally {
        await browser.close();
      }
    }, 45_000);
  }
});
