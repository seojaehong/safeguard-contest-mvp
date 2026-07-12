import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Browser } from "playwright";

import {
  startIsolatedNextBrowserHarness,
  type IsolatedNextBrowserHarness,
} from "./helpers/isolated-next-browser-harness";

const productionMatrix = process.env.FONT_FAMILY_PROD_MATRIX === "1" ? describe : describe.skip;
let harness: IsolatedNextBrowserHarness | null = null;
let browser: Browser | null = null;

productionMatrix("font family production matrix", () => {
  beforeAll(async () => {
    harness = await startIsolatedNextBrowserHarness({
      slug: "font-family-matrix",
      initialPath: "/workspace?theme=day",
      portSalt: 9317,
      mode: "prod",
    });
    browser = harness.browser;
  }, 90_000);

  afterAll(async () => {
    await harness?.stop();
  }, 30_000);

  it("resolves product and telemetry roles through their canonical first fonts", async () => {
    if (!browser || !harness) throw new Error("Production browser harness was not started");
    expect(harness.mode).toBe("prod");
    const scenarios = [
      { path: "/workspace?theme=day", selector: ".command-center-shell.workspace-theme-day", firstFont: "Pretendard" },
      { path: "/workspace?theme=night", selector: ".command-center-shell.workspace-theme-night", firstFont: "Pretendard" },
      { path: "/documents?theme=day", selector: ".safeclaw-module-shell.module-variant-document", firstFont: "Pretendard" },
    ] as const;

    for (const scenario of scenarios) {
      const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
      await page.goto(`${harness.baseUrl}${scenario.path}`, { waitUntil: "networkidle" });
      const target = page.locator(scenario.selector).first();
      await target.waitFor({ state: "visible" });
      const firstFont = await target.evaluate((element) => getComputedStyle(element).fontFamily
        .split(",")[0]
        .trim()
        .replace(/^['"]|['"]$/gu, ""));
      expect(firstFont, `${scenario.path} ${scenario.selector}`).toBe(scenario.firstFont);
      await page.close();
    }

    const tokenPage = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    await tokenPage.goto(`${harness.baseUrl}/documents?theme=day`, { waitUntil: "networkidle" });
    const hudFirstFont = await tokenPage.locator(":root").evaluate((element) => getComputedStyle(element)
      .getPropertyValue("--font-hud")
      .split(",")[0]
      .trim()
      .replace(/^['"]|['"]$/gu, ""));
    expect(hudFirstFont).toBe("Geist Mono");
    await tokenPage.close();
  }, 90_000);
});
