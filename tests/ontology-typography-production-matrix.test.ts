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

async function expectRole(
  page: Page,
  selectors: readonly string[],
  expected: TypographyMetric,
): Promise<void> {
  for (const selector of selectors) {
    const metric = await readMetric(page, selector);
    expect(metric, selector).toMatchObject(expected);
    expect(metric.tracking, selector).toBeCloseTo(expected.tracking, 2);
  }
}

const renderedOntologyFamilies = {
  support: [
    ".ontology-operation-loop > p",
    ".operation-memory-copy p",
    ".ontology-graph-shell > p",
    ".operation-memory-list-item strong",
    ".ontology-kind-list strong",
  ],
  hud: [
    ".ontology-operation-loop code",
    ".ontology-operation-flow span",
    ".operation-memory-actions button",
    ".operation-memory-stats span",
    ".operation-memory-detail > span",
    ".operation-memory-detail dt",
    ".ontology-graph-point > span",
    ".ontology-graph-stats span",
    ".ontology-graph-legend span",
    ".ontology-node-row span",
    ".ontology-map-column > span",
  ],
  componentTitle: [
    ".ontology-operation-flow strong",
    ".operation-memory-detail > strong",
    ".ontology-graph-popover strong",
    ".ontology-node-row strong",
    ".ontology-hover-card strong",
  ],
  caption: [
    ".ontology-operation-flow small",
    ".operation-memory-point strong",
    ".operation-memory-point small",
    ".operation-memory-detail p",
    ".operation-memory-list-item small",
    ".ontology-graph-point strong",
    ".ontology-graph-point small",
    ".ontology-graph-popover p",
    ".ontology-node-row small",
  ],
  table: [
    ".operation-memory-detail dd",
    ".operation-memory-detail li span",
    ".ontology-graph-popover li span",
    ".ontology-hover-card p",
    ".ontology-hover-card li span",
  ],
} as const;

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

        await expectRole(page, renderedOntologyFamilies.support, { firstFont: "Pretendard", size: "14px", weight: "500", lineHeight: 22.4, tracking: 0 });
        await expectRole(page, renderedOntologyFamilies.hud, { firstFont: "Geist Mono", size: "11px", weight: "700", lineHeight: 16, tracking: 0.88 });
        await expectRole(page, renderedOntologyFamilies.componentTitle, { firstFont: "Pretendard", size: "20px", weight: "700", lineHeight: 27, tracking: -0.3 });
        await expectRole(page, renderedOntologyFamilies.caption, { firstFont: "Pretendard", size: "12px", weight: "600", lineHeight: 18, tracking: 0 });
        await expectRole(page, renderedOntologyFamilies.table, { firstFont: "Pretendard", size: "13px", weight: "500", lineHeight: 20, tracking: 0 });

        const nodeRow = page.locator(".ontology-node-row").filter({ has: page.locator(".ontology-hover-card") }).first();
        const hoverCard = nodeRow.locator(".ontology-hover-card");
        expect(await hoverCard.evaluate((element) => getComputedStyle(element).opacity)).toBe("0");
        await nodeRow.hover();
        await page.waitForFunction((element) => getComputedStyle(element).opacity === "1", await hoverCard.elementHandle());
        expect(await hoverCard.evaluate((element) => {
          const rect = element.getBoundingClientRect();
          return rect.width > 0 && rect.height > 0 && rect.right > 0 && rect.left < window.innerWidth;
        })).toBe(true);
        expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);
        await page.close();
      }
    }

    for (const viewport of [
      { width: 1440, height: 900 },
      { width: 390, height: 844 },
      { width: 1440, height: 320 },
    ] as const) {
      for (const theme of ["day", "night"] as const) {
        const page = await browser.newPage({ viewport });
        const stored = buildStoredCurrentWorkpack(buildSampleWorkpack());
        await page.addInitScript(
          ({ key, value }) => window.localStorage.setItem(key, value),
          { key: CURRENT_WORKPACK_STORAGE_KEY, value: JSON.stringify(stored) },
        );
        await page.goto(`${harness.baseUrl}/workspace?theme=${theme}`, { waitUntil: "networkidle" });
        await page.locator(".workspace-document-page").waitFor({ state: "visible" });
        await page.locator(".doc-card-actions button", { hasText: "편집" }).click();
        await page.locator(".workspace-operation-memory").waitFor({ state: "visible" });
        await expectRole(page, [".workspace-operation-memory .operation-memory-detail > strong"], { firstFont: "Pretendard", size: "20px", weight: "700", lineHeight: 27, tracking: -0.3 });
        await expectRole(page, [".workspace-operation-memory .operation-memory-list-item small"], { firstFont: "Pretendard", size: "12px", weight: "600", lineHeight: 18, tracking: 0 });
        await expectRole(page, [".workspace-operation-memory .operation-memory-detail dd"], { firstFont: "Pretendard", size: "13px", weight: "500", lineHeight: 20, tracking: 0 });
        await expectRole(page, [".workspace-operation-memory .operation-memory-detail > span"], { firstFont: "Geist Mono", size: "11px", weight: "700", lineHeight: 16, tracking: 0.88 });
        expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);
        await page.close();
      }
    }
  }, 180_000);
});
