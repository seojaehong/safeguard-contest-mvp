import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Browser } from "playwright";
import {
  startIsolatedNextBrowserHarness,
  type IsolatedNextBrowserHarness
} from "./helpers/isolated-next-browser-harness";

let baseUrl = "";
let browser: Browser | null = null;
let harness: IsolatedNextBrowserHarness | null = null;

const desktopRoutes = ["/home", "/documents", "/evidence", "/reports", "/settings/ai-connect"] as const;
const mobileRoutes = ["/home", "/documents", "/reports", "/settings/ai-connect"] as const;

type ModuleShellMetrics = {
  route: string;
  hasShell: boolean;
  shellBackground: string;
  shellColor: string;
  shellColumnCount: number;
  railBackground: string;
  railHeight: number;
  navTop: number;
  navHeight: number;
  heroTop: number;
  h1Top: number;
  h1Color: string;
  cockpitBackground: string | null;
  documentIndexButtonBackground: string | null;
  horizontalOverflow: boolean;
};

async function readModuleMetrics(route: string, viewport: { width: number; height: number }): Promise<ModuleShellMetrics> {
  if (!browser) throw new Error("Browser was not started");
  const page = await browser.newPage({ viewport });
  await page.goto(`${baseUrl}${route}`, { waitUntil: "networkidle" });
  const metrics = await page.evaluate((currentRoute) => {
    const shell = document.querySelector(".safeclaw-module-shell");
    const rail = document.querySelector(".safeclaw-module-rail");
    const nav = document.querySelector(".safeclaw-module-nav");
    const hero = document.querySelector(".safeclaw-page-decision-header");
    const h1 = document.querySelector(".safeclaw-page-decision-header h1");
    if (!shell || !rail || !nav || !hero || !h1) {
      return {
        route: currentRoute,
        hasShell: false,
        shellBackground: "",
        shellColor: "",
        shellColumnCount: 0,
        railBackground: "",
        railHeight: 0,
        navTop: 0,
        navHeight: 0,
        heroTop: 0,
        h1Top: 0,
        h1Color: "",
        cockpitBackground: null,
        documentIndexButtonBackground: null,
        horizontalOverflow: document.documentElement.scrollWidth > window.innerWidth + 1
      };
    }
    const cockpit = document.querySelector(".safeclaw-document-cockpit");
    const documentIndexButton = document.querySelector(".safeclaw-doc-index-list button");
    const shellStyle = getComputedStyle(shell);
    const railStyle = getComputedStyle(rail);
    const h1Style = getComputedStyle(h1);
    const railRect = rail.getBoundingClientRect();
    const navRect = nav.getBoundingClientRect();
    const heroRect = hero.getBoundingClientRect();
    const h1Rect = h1.getBoundingClientRect();
    return {
      route: currentRoute,
      hasShell: true,
      shellBackground: shellStyle.backgroundColor,
      shellColor: shellStyle.color,
      shellColumnCount: shellStyle.gridTemplateColumns.split(" ").filter(Boolean).length,
      railBackground: railStyle.backgroundColor,
      railHeight: Math.round(railRect.height),
      navTop: Math.round(navRect.top),
      navHeight: Math.round(navRect.height),
      heroTop: Math.round(heroRect.top),
      h1Top: Math.round(h1Rect.top),
      h1Color: h1Style.color,
      cockpitBackground: cockpit ? getComputedStyle(cockpit).backgroundColor : null,
      documentIndexButtonBackground: documentIndexButton ? getComputedStyle(documentIndexButton).backgroundColor : null,
      horizontalOverflow: document.documentElement.scrollWidth > window.innerWidth + 1
    };
  }, route);
  await page.close();
  return metrics;
}

describe("module shell design regression", () => {
  beforeAll(async () => {
    harness = await startIsolatedNextBrowserHarness({
      slug: "module-shell-design",
      initialPath: "/documents",
      portSalt: 3233
    });
    baseUrl = harness.baseUrl;
    browser = harness.browser;
  }, 90_000);

  afterAll(async () => {
    await harness?.stop();
  }, 30_000);

  it("uses the workspace daylight shell on core module desktop pages", async () => {
    const results = await Promise.all(
      desktopRoutes.map((route) => readModuleMetrics(route, { width: 1440, height: 900 }))
    );

    for (const metrics of results) {
      expect(metrics.hasShell, metrics.route).toBe(true);
      expect(metrics.shellBackground, metrics.route).toBe("rgb(250, 250, 251)");
      expect(metrics.shellColor, metrics.route).toBe("rgb(23, 25, 29)");
      expect(metrics.h1Color, metrics.route).toBe("rgb(23, 25, 29)");
      expect(metrics.railBackground, metrics.route).not.toBe("rgb(1, 1, 2)");
      if (metrics.route === "/documents") {
        expect(metrics.cockpitBackground, metrics.route).toBe("rgb(255, 255, 255)");
        expect(metrics.documentIndexButtonBackground, metrics.route).toBe("rgb(244, 245, 247)");
      }
      expect(metrics.heroTop, metrics.route).toBeLessThanOrEqual(70);
      expect(metrics.horizontalOverflow, metrics.route).toBe(false);
    }
  }, 120_000);

  it("keeps mobile module navigation compact enough for the page title to appear early", async () => {
    const results = await Promise.all(
      mobileRoutes.map((route) => readModuleMetrics(route, { width: 390, height: 844 }))
    );

    for (const metrics of results) {
      expect(metrics.hasShell, metrics.route).toBe(true);
      expect(metrics.railHeight, metrics.route).toBeLessThanOrEqual(150);
      expect(metrics.navTop, metrics.route).toBeLessThanOrEqual(150);
      expect(metrics.navHeight, metrics.route).toBeLessThanOrEqual(90);
      expect(metrics.heroTop, metrics.route).toBeLessThanOrEqual(260);
      expect(metrics.h1Top, metrics.route).toBeLessThanOrEqual(330);
      expect(metrics.h1Color, metrics.route).toBe("rgb(23, 25, 29)");
      if (metrics.route === "/documents") {
        expect(metrics.cockpitBackground, metrics.route).toBe("rgb(255, 255, 255)");
        expect(metrics.documentIndexButtonBackground, metrics.route).toBe("rgb(244, 245, 247)");
      }
      expect(metrics.horizontalOverflow, metrics.route).toBe(false);
    }
  }, 120_000);

  it("keeps the module rail in the desktop shell above the unified 900px breakpoint", async () => {
    const metrics = await readModuleMetrics("/home", { width: 940, height: 820 });

    expect(metrics.hasShell).toBe(true);
    expect(metrics.shellColumnCount).toBe(2);
    expect(metrics.railHeight).toBeGreaterThanOrEqual(820);
    expect(metrics.navTop).toBe(0);
    expect(metrics.horizontalOverflow).toBe(false);
  }, 90_000);
});
