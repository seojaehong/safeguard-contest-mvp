import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Browser, Page } from "playwright";
import { buildStoredCurrentWorkpack, CURRENT_WORKPACK_STORAGE_KEY } from "@/lib/current-workpack";
import { buildSampleWorkpack } from "@/lib/sample-workpack";

import {
  startIsolatedNextBrowserHarness,
  type IsolatedNextBrowserHarness,
} from "./helpers/isolated-next-browser-harness";

const productionMatrix = process.env.ONTOLOGY_TYPOGRAPHY_PROD_MATRIX === "1" ? describe : describe.skip;
let harness: IsolatedNextBrowserHarness | null = null;
let browser: Browser | null = null;

type TypographyMetric = {
  firstFont: string;
  size: string;
  weight: string;
  lineHeight: number;
  tracking: number;
};

async function readMetric(page: Page, selector: string): Promise<TypographyMetric> {
  return page.locator(selector).first().evaluate((element) => {
    const style = getComputedStyle(element);
    return {
      firstFont: style.fontFamily.split(",")[0].trim().replace(/^['"]|['"]$/gu, ""),
      size: style.fontSize,
      weight: style.fontWeight,
      lineHeight: Number.parseFloat(style.lineHeight),
      tracking: Number.parseFloat(style.letterSpacing) || 0,
    };
  });
}

productionMatrix("ontology typography production matrix", () => {
  beforeAll(async () => {
    harness = await startIsolatedNextBrowserHarness({
      slug: "ontology-typography-matrix",
      initialPath: "/ontology?theme=day",
      portSalt: 9511,
      mode: "prod",
    });
    browser = harness.browser;
  }, 90_000);

  afterAll(async () => {
    await harness?.stop();
  }, 30_000);

  it("keeps ontology roles, popovers, and operation-memory regression geometry stable", async () => {
    if (!browser || !harness) throw new Error("Production browser harness was not started");
    expect(harness.mode).toBe("prod");

    for (const viewport of [
      { width: 1440, height: 900 },
      { width: 390, height: 844 },
      { width: 1440, height: 320 },
    ] as const) {
      for (const theme of ["day", "night"] as const) {
        const page = await browser.newPage({ viewport });
        await page.goto(`${harness.baseUrl}/ontology?theme=${theme}`, { waitUntil: "networkidle" });
        await page.locator(".safeclaw-module-shell[data-ready='true']").waitFor();

        const support = await readMetric(page, ".ontology-operation-loop > p");
        const hud = await readMetric(page, ".ontology-operation-flow span");
        const componentTitle = await readMetric(page, ".ontology-operation-flow strong");
        const caption = await readMetric(page, ".ontology-operation-flow small");
        const table = await readMetric(page, ".operation-memory-detail dd");
        expect(support).toMatchObject({ firstFont: "Pretendard", size: "14px", weight: "500", lineHeight: 22.4, tracking: 0 });
        expect(hud).toMatchObject({ firstFont: "Geist Mono", size: "11px", weight: "700", lineHeight: 16 });
        expect(hud.tracking).toBeCloseTo(0.88, 2);
        expect(componentTitle).toMatchObject({ firstFont: "Pretendard", size: "20px", weight: "700", lineHeight: 27 });
        expect(componentTitle.tracking).toBeCloseTo(-0.3, 2);
        expect(caption).toMatchObject({ firstFont: "Pretendard", size: "12px", weight: "600", lineHeight: 18, tracking: 0 });
        expect(table).toMatchObject({ firstFont: "Pretendard", size: "13px", weight: "500", lineHeight: 20, tracking: 0 });

        const nodeRow = page.locator(".ontology-node-row").filter({ has: page.locator(".ontology-hover-card") }).first();
        await nodeRow.hover();
        expect(await nodeRow.locator(".ontology-hover-card").count()).toBe(1);
        expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);
        await page.close();
      }
    }

    for (const theme of ["day", "night"] as const) {
      const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
      const stored = buildStoredCurrentWorkpack(buildSampleWorkpack());
      await page.addInitScript(
        ({ key, value }) => window.localStorage.setItem(key, value),
        { key: CURRENT_WORKPACK_STORAGE_KEY, value: JSON.stringify(stored) },
      );
      await page.goto(`${harness.baseUrl}/workspace?theme=${theme}`, { waitUntil: "networkidle" });
      await page.locator(".workspace-document-page").waitFor({ state: "visible" });
      await page.locator(".doc-card-actions button", { hasText: "편집" }).click();
      await page.locator(".workspace-operation-memory").waitFor({ state: "visible" });
      const title = await readMetric(page, ".workspace-operation-memory .operation-memory-detail > strong");
      const caption = await readMetric(page, ".workspace-operation-memory .operation-memory-list-item small");
      expect(title).toMatchObject({ firstFont: "Pretendard", size: "20px", weight: "700", lineHeight: 27 });
      expect(caption).toMatchObject({ firstFont: "Pretendard", size: "12px", weight: "600", lineHeight: 18, tracking: 0 });
      expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);
      await page.close();
    }
  }, 120_000);
});
