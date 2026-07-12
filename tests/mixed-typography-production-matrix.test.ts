import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Browser } from "playwright";

import {
  startIsolatedNextBrowserHarness,
  type IsolatedNextBrowserHarness,
} from "./helpers/isolated-next-browser-harness";

const productionMatrix = process.env.MIXED_TYPOGRAPHY_PROD_MATRIX === "1" ? describe : describe.skip;
let harness: IsolatedNextBrowserHarness | null = null;
let browser: Browser | null = null;

productionMatrix("mixed typography production matrix", () => {
  beforeAll(async () => {
    harness = await startIsolatedNextBrowserHarness({
      slug: "mixed-typography-matrix",
      initialPath: "/workspace?theme=day",
      portSalt: 9467,
      mode: "prod",
    });
    browser = harness.browser;
  }, 90_000);

  afterAll(async () => {
    await harness?.stop();
  }, 30_000);

  it("renders caption, HUD, control, and support roles on their canonical fonts", async () => {
    if (!browser || !harness) throw new Error("Production browser harness was not started");
    expect(harness.mode).toBe("prod");

    for (const theme of ["day", "night"] as const) {
      const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
      await page.goto(`${harness.baseUrl}/workspace?theme=${theme}`, { waitUntil: "networkidle" });
      const metrics = await page.evaluate(() => {
        const read = (selector: string) => {
          const element = document.querySelector(selector);
          if (!element) throw new Error(`Missing typography target: ${selector}`);
          const style = getComputedStyle(element);
          return {
            firstFont: style.fontFamily.split(",")[0].trim().replace(/^['"]|['"]$/gu, ""),
            size: style.fontSize,
            weight: style.fontWeight,
          };
        };
        return {
          brand: read(".command-center-shell .brand-lockup small"),
          hud: read(".command-center-shell .topbar-status span"),
          control: read(".command-center-shell .workspace-side-group button span"),
          caption: read(".command-center-shell .workspace-side-group button small"),
          support: read(".command-center-shell .workspace-source-status b"),
          sourceHud: read(".command-center-shell .workspace-source-status small"),
          overflow: document.documentElement.scrollWidth - window.innerWidth,
        };
      });
      expect(metrics.brand).toMatchObject({ firstFont: "Pretendard", size: "12px", weight: "600" });
      expect(metrics.hud).toMatchObject({ firstFont: "Geist Mono", size: "11px", weight: "700" });
      expect(metrics.control).toMatchObject({ size: "14px", weight: "700" });
      expect(metrics.caption).toMatchObject({ size: "12px", weight: "600" });
      expect(metrics.support).toMatchObject({ size: "14px", weight: "500" });
      expect(metrics.sourceHud).toMatchObject({ firstFont: "Geist Mono", size: "11px", weight: "700" });
      expect(metrics.overflow).toBeLessThanOrEqual(0);
      await page.close();
    }

    const documentPage = await browser.newPage({ viewport: { width: 1180, height: 860 } });
    await documentPage.goto(`${harness.baseUrl}/documents?theme=day`, { waitUntil: "networkidle" });
    await documentPage.locator(".submission-preview-panel summary").click();
    const tableMetrics = await documentPage.locator(".submission-preview-panel .safety-form-preview").evaluate((preview) => {
      const header = preview.querySelector("th");
      const cell = preview.querySelector("td");
      if (!header || !cell) throw new Error("Missing safety form table typography targets");
      return {
        header: { size: getComputedStyle(header).fontSize, weight: getComputedStyle(header).fontWeight },
        cell: { size: getComputedStyle(cell).fontSize, weight: getComputedStyle(cell).fontWeight },
        overflow: document.documentElement.scrollWidth - window.innerWidth,
      };
    });
    expect(tableMetrics.header).toEqual({ size: "12px", weight: "700" });
    expect(tableMetrics.cell).toEqual({ size: "12px", weight: "600" });
    expect(tableMetrics.overflow).toBeLessThanOrEqual(0);
    await documentPage.close();

    for (const route of ["/workspace?theme=day", "/documents?theme=night"] as const) {
      const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
      await page.goto(`${harness.baseUrl}${route}`, { waitUntil: "networkidle" });
      expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth), route).toBeLessThanOrEqual(0);
      await page.close();
    }
  }, 120_000);
});
