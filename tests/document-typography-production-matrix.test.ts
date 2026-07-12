import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Browser } from "playwright";

import {
  startIsolatedNextBrowserHarness,
  type IsolatedNextBrowserHarness,
} from "./helpers/isolated-next-browser-harness";

const productionMatrix = process.env.DOCUMENT_TYPOGRAPHY_PROD_MATRIX === "1" ? describe : describe.skip;
let harness: IsolatedNextBrowserHarness | null = null;
let browser: Browser | null = null;

productionMatrix("document typography production matrix", () => {
  beforeAll(async () => {
    harness = await startIsolatedNextBrowserHarness({
      slug: "document-typography-matrix",
      initialPath: "/documents?theme=day",
      portSalt: 9431,
      mode: "prod",
    });
    browser = harness.browser;
  }, 90_000);

  afterAll(async () => {
    await harness?.stop();
  }, 30_000);

  it("keeps document heading hierarchy and horizontal geometry stable", async () => {
    if (!browser || !harness) throw new Error("Production browser harness was not started");
    expect(harness.mode).toBe("prod");

    for (const viewport of [
      { width: 1440, height: 900, pageTitle: "40px", sectionTitle: "28px" },
      { width: 390, height: 844, pageTitle: "32px", sectionTitle: "24px" },
    ] as const) {
      for (const route of ["/reports?theme=day", "/reports?theme=night"] as const) {
        const page = await browser.newPage({ viewport });
        await page.goto(`${harness.baseUrl}${route}`, { waitUntil: "networkidle" });
        await page.getByRole("button", { name: "샘플 미리보기" }).click();
        await page.locator(".safeclaw-workdoc-shell").waitFor({ state: "visible" });
        const titleSelector = ".safeclaw-module-shell.module-variant-document .safeclaw-workdoc-header h2";
        const title = page.locator(titleSelector).first();
        await title.waitFor({ state: "visible" });
        await expect(title.evaluate((element) => getComputedStyle(element).fontSize)).resolves.toBe(viewport.pageTitle);

        if (route.startsWith("/reports")) {
          const sectionTitle = page.locator(
            ".safeclaw-module-shell.module-variant-document .safeclaw-workdoc-section-head h3",
          ).first();
          await sectionTitle.waitFor({ state: "visible" });
          await expect(sectionTitle.evaluate((element) => getComputedStyle(element).fontSize)).resolves.toBe(
            viewport.sectionTitle,
          );
        }

        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
        expect(overflow, `${route} at ${viewport.width}px`).toBeLessThanOrEqual(0);
        await page.close();
      }
    }
  }, 90_000);
});
