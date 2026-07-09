import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { chromium, type Browser } from "playwright";

const port = 3233;
const baseUrl = `http://127.0.0.1:${port}`;
let server: ChildProcessWithoutNullStreams | null = null;
let browser: Browser | null = null;
const serverOutput: string[] = [];

const desktopRoutes = ["/home", "/documents", "/evidence", "/reports", "/settings/ai-connect"] as const;
const mobileRoutes = ["/home", "/documents", "/reports", "/settings/ai-connect"] as const;

type ModuleShellMetrics = {
  route: string;
  hasShell: boolean;
  shellBackground: string;
  shellColor: string;
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

function resolveNextBin(): string {
  const candidates = [
    path.join(process.cwd(), "node_modules", "next", "dist", "bin", "next"),
    path.resolve(process.cwd(), "..", "..", "node_modules", "next", "dist", "bin", "next")
  ];
  const nextBin = candidates.find((candidate) => fs.existsSync(candidate));
  if (!nextBin) {
    throw new Error(`Unable to locate next dev binary. Checked: ${candidates.join(", ")}`);
  }
  return nextBin;
}

async function waitForHttp(url: string, timeoutMs = 60_000): Promise<void> {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {
      // The dev server is still booting.
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`Timed out waiting for ${url}\n${serverOutput.slice(-20).join("")}`);
}

async function readModuleMetrics(route: string, viewport: { width: number; height: number }): Promise<ModuleShellMetrics> {
  if (!browser) throw new Error("Browser was not started");
  const page = await browser.newPage({ viewport });
  await page.goto(`${baseUrl}${route}`, { waitUntil: "networkidle" });
  const metrics = await page.evaluate((currentRoute) => {
    const shell = document.querySelector(".safeclaw-module-shell");
    const rail = document.querySelector(".safeclaw-module-rail");
    const nav = document.querySelector(".safeclaw-module-nav");
    const hero = document.querySelector(".safeclaw-module-hero");
    const h1 = document.querySelector(".safeclaw-module-hero h1");
    if (!shell || !rail || !nav || !hero || !h1) {
      return {
        route: currentRoute,
        hasShell: false,
        shellBackground: "",
        shellColor: "",
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
    const nextBin = resolveNextBin();
    server = spawn(process.execPath, [nextBin, "dev", "--port", String(port)], {
      cwd: process.cwd(),
      env: { ...process.env, NEXT_TELEMETRY_DISABLED: "1" }
    });
    server.stdout.on("data", (chunk: Buffer) => serverOutput.push(chunk.toString()));
    server.stderr.on("data", (chunk: Buffer) => serverOutput.push(chunk.toString()));
    await waitForHttp(`${baseUrl}/documents`);
    browser = await chromium.launch({ headless: true });
  }, 90_000);

  afterAll(async () => {
    await browser?.close();
    if (server && !server.killed) {
      server.kill();
    }
  });

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
        expect(metrics.documentIndexButtonBackground, metrics.route).toBe("rgb(245, 246, 248)");
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
        expect(metrics.documentIndexButtonBackground, metrics.route).toBe("rgb(245, 246, 248)");
      }
      expect(metrics.horizontalOverflow, metrics.route).toBe(false);
    }
  }, 120_000);
});
