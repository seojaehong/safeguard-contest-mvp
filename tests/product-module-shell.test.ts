import { spawn, spawnSync, type ChildProcessWithoutNullStreams } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { chromium, type Browser, type Page } from "playwright";

const port = 3231;
const baseUrl = `http://127.0.0.1:${port}`;
const routes = [
  "/home",
  "/documents",
  "/workers",
  "/evidence",
  "/knowledge",
  "/settings",
  "/reports",
  "/tbm",
  "/archive",
  "/ops/api",
  "/ask",
  "/dispatch"
] as const;
const screenshotRoutes = new Set<string>(["/documents", "/workers", "/tbm", "/ops/api"]);
const screenshotRoot = path.join(process.cwd(), "output", "playwright", "2026-07-10", "module-shell-hardening");
const distDir = path.join(".next-c7-module-shell", String(process.pid));
let server: ChildProcessWithoutNullStreams | null = null;
let browser: Browser | null = null;
let serverExit: { code: number | null; signal: NodeJS.Signals | null } | null = null;
const serverOutput: string[] = [];

function resolveNextModule(): string {
  const candidates = [
    path.join(process.cwd(), "node_modules", "next"),
    path.resolve(process.cwd(), "..", "..", "node_modules", "next")
  ];
  const nextModule = candidates.find((candidate) => fs.existsSync(path.join(candidate, "package.json")));
  if (!nextModule) throw new Error(`Unable to locate Next.js. Checked: ${candidates.join(", ")}`);
  return nextModule;
}

async function waitForHttp(url: string, timeoutMs = 60_000): Promise<void> {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    assertServerAlive(`waiting for ${url}`);
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {
      // The focused browser harness owns server startup.
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`Timed out waiting for ${url}\n${serverOutput.slice(-20).join("")}`);
}

function serverDiagnostics(): string {
  const exit = serverExit
    ? `exit code=${serverExit.code ?? "null"} signal=${serverExit.signal ?? "null"}`
    : "server process still registered";
  return `Next dev ${exit}\n--- latest server output ---\n${serverOutput.slice(-40).join("").trim() || "(no output)"}`;
}

function assertServerAlive(stage: string): void {
  if (serverExit) throw new Error(`Next dev exited while ${stage}.\n${serverDiagnostics()}`);
}

async function stopServer(): Promise<void> {
  const processId = server?.pid;
  if (!processId || serverExit) return;

  if (process.platform === "win32") {
    spawnSync("taskkill.exe", ["/PID", String(processId), "/T", "/F"], {
      encoding: "utf8",
      windowsHide: true
    });
  } else {
    server?.kill("SIGTERM");
  }
}

async function openModule(page: Page, route: string): Promise<void> {
  let lastError: unknown = null;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    assertServerAlive(`opening ${route} (attempt ${attempt})`);
    try {
      await page.goto(`${baseUrl}${route}?theme=day`, {
        waitUntil: "domcontentloaded",
        timeout: 40_000
      });
      await page.locator("[data-testid='page-decision-header']").waitFor({
        state: "visible",
        timeout: 20_000
      });
      await page.locator(".safeclaw-module-shell[data-ready='true']").waitFor({
        state: "attached",
        timeout: 20_000
      });
      return;
    } catch (error) {
      lastError = error;
      if (serverExit || attempt === 3) break;
      await page.waitForTimeout(300);
    }
  }
  throw new Error(`Failed to open ${route}: ${String(lastError)}\n${serverDiagnostics()}`);
}

async function readShellMetrics(page: Page) {
  return await page.evaluate(() => {
    type Color = { red: number; green: number; blue: number; alpha: number };

    function intersects(first: DOMRect, second: DOMRect) {
      return first.left < second.right
        && first.right > second.left
        && first.top < second.bottom
        && first.bottom > second.top;
    }

    function parseColor(value: string): Color {
      const matches = value.match(/[\d.]+/g);
      if (!matches || matches.length < 3) throw new Error(`Unsupported color: ${value}`);
      const scale = value.startsWith("color(srgb") ? 255 : 1;
      return {
        red: Number(matches[0]) * scale,
        green: Number(matches[1]) * scale,
        blue: Number(matches[2]) * scale,
        alpha: matches[3] === undefined ? 1 : Number(matches[3])
      };
    }

    function composite(top: Color, bottom: Color): Color {
      const alpha = top.alpha + bottom.alpha * (1 - top.alpha);
      if (alpha === 0) return { red: 0, green: 0, blue: 0, alpha: 0 };
      return {
        red: (top.red * top.alpha + bottom.red * bottom.alpha * (1 - top.alpha)) / alpha,
        green: (top.green * top.alpha + bottom.green * bottom.alpha * (1 - top.alpha)) / alpha,
        blue: (top.blue * top.alpha + bottom.blue * bottom.alpha * (1 - top.alpha)) / alpha,
        alpha
      };
    }

    function resolvedBackground(element: HTMLElement): Color {
      let result: Color = { red: 0, green: 0, blue: 0, alpha: 0 };
      let current: HTMLElement | null = element;
      while (current) {
        result = composite(result, parseColor(getComputedStyle(current).backgroundColor));
        if (result.alpha >= 0.999) return result;
        current = current.parentElement;
      }
      return composite(result, { red: 255, green: 255, blue: 255, alpha: 1 });
    }

    function contrastRatio(foreground: Color, background: Color) {
      const luminance = (color: Color) => {
        const channels = [color.red, color.green, color.blue].map((channel) => {
          const normalized = channel / 255;
          return normalized <= 0.04045
            ? normalized / 12.92
            : ((normalized + 0.055) / 1.055) ** 2.4;
        });
        return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
      };
      const foregroundLuminance = luminance(foreground);
      const backgroundLuminance = luminance(background);
      const lighter = Math.max(foregroundLuminance, backgroundLuminance);
      const darker = Math.min(foregroundLuminance, backgroundLuminance);
      return (lighter + 0.05) / (darker + 0.05);
    }

    function elementContrast(element: HTMLElement) {
      const background = resolvedBackground(element);
      const foreground = composite(parseColor(getComputedStyle(element).color), background);
      return contrastRatio(foreground, background);
    }

    function isVisible(element: HTMLElement) {
      const style = getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return style.display !== "none" && style.visibility !== "hidden" && rect.width > 0 && rect.height > 0;
    }

    const shell = document.querySelector<HTMLElement>(".safeclaw-module-shell");
    const rail = document.querySelector<HTMLElement>(".safeclaw-module-rail");
    const nav = document.querySelector<HTMLElement>(".safeclaw-module-nav");
    const main = document.querySelector<HTMLElement>(".safeclaw-module-main");
    const header = document.querySelector<HTMLElement>("[data-testid='page-decision-header']");
    const heading = header?.querySelector<HTMLElement>("h1");
    const command = header?.querySelector<HTMLElement>("[data-principal-command]");
    if (!shell || !rail || !nav || !main || !header || !heading || !command) {
      throw new Error("Missing product shell contract target");
    }

    const shellStyle = getComputedStyle(shell);
    const railStyle = getComputedStyle(rail);
    const navStyle = getComputedStyle(nav);
    const mainStyle = getComputedStyle(main);
    const headerRect = header.getBoundingClientRect();
    const headingRect = heading.getBoundingClientRect();
    const commandRect = command.getBoundingClientRect();
    const railRect = rail.getBoundingClientRect();
    const isContainedByHorizontalScroller = (element: HTMLElement) => {
      let ancestor = element.parentElement;
      while (ancestor && ancestor !== document.body) {
        const ancestorStyle = getComputedStyle(ancestor);
        const ancestorRect = ancestor.getBoundingClientRect();
        const clipsHorizontally = (ancestorStyle.overflowX === "auto" || ancestorStyle.overflowX === "scroll")
          && ancestor.scrollWidth > ancestor.clientWidth + 1;
        const scrollerIsInViewport = ancestorRect.left >= -1 && ancestorRect.right <= window.innerWidth + 1;
        if (clipsHorizontally && scrollerIsInViewport) return true;
        ancestor = ancestor.parentElement;
      }
      return false;
    };
    const overflowers = Array.from(document.body.querySelectorAll<HTMLElement>("*"))
      .filter((element) => {
        const style = getComputedStyle(element);
        if (style.display === "none" || style.visibility === "hidden") return false;
        const rect = element.getBoundingClientRect();
        return rect.width > 0
          && (rect.left < -1 || rect.right > window.innerWidth + 1)
          && !isContainedByHorizontalScroller(element);
      })
      .slice(0, 8)
      .map((element) => ({
        className: element.className.toString(),
        tagName: element.tagName,
        rect: element.getBoundingClientRect().toJSON()
      }));
    const surfaceSelector = [
      ".card",
      ".safeclaw-module-grid article",
      ".safeclaw-module-panel",
      ".safeclaw-worker-table article",
      ".safeclaw-archive-list article",
      ".safeclaw-tbm-board article",
      ".safeclaw-document-cockpit",
      ".workpack-sidebar",
      ".document-editor",
      ".workflow-panel",
      ".dispatch-panel",
      ".knowledge-status-grid > article"
    ].map((selector) => `.safeclaw-module-shell ${selector}`).join(",");
    const surfaces = Array.from(document.querySelectorAll<HTMLElement>(surfaceSelector));
    const surfaceTextMetrics = surfaces.flatMap((surface) => (
      Array.from(surface.querySelectorAll<HTMLElement>("p, strong, span, h2, h3, small, label"))
        .filter(isVisible)
        .filter((element) => Boolean(element.textContent?.trim()))
        .map((element) => {
          const background = resolvedBackground(element);
          const style = getComputedStyle(element);
          return {
            className: element.className.toString(),
            parentClassName: element.parentElement?.className.toString() ?? "",
            tagName: element.tagName,
            text: element.textContent?.trim().replace(/\s+/g, " ").slice(0, 80) ?? "",
            color: style.color,
            background: `rgb(${Math.round(background.red)}, ${Math.round(background.green)}, ${Math.round(background.blue)})`,
            ratio: elementContrast(element)
          };
        })
    ));
    const subtleTextContrasts = Array.from(document.querySelectorAll<HTMLElement>(
      ".safeclaw-module-rail > p, .safeclaw-module-rail h2,"
      + " .safeclaw-module-rail a span, .safeclaw-module-rail a small,"
      + " .safeclaw-page-decision-copy p, .safeclaw-page-decision-action span"
    )).filter(isVisible).map(elementContrast);
    const navTextContrasts = Array.from(nav.querySelectorAll<HTMLElement>("span, b, button"))
      .filter(isVisible)
      .map(elementContrast);
    const workerRowTextContrasts = Array.from(document.querySelectorAll<HTMLElement>(
      ".safeclaw-worker-table article :is(strong, small, p)"
    )).filter(isVisible).map(elementContrast);
    const formControlContrasts = Array.from(document.querySelectorAll<HTMLElement>(
      ".safeclaw-module-content :is(input, textarea, select)"
    )).filter(isVisible).map(elementContrast);
    const chromeControlBackgrounds = Array.from(document.querySelectorAll<HTMLElement>(
      ".safeclaw-module-menu-button, .safeclaw-module-theme-toggle button"
    )).filter(isVisible).map((element) => getComputedStyle(element).backgroundColor);
    const principalInteractive = command.querySelector<HTMLElement>("a, button");
    const skipLink = document.querySelector<HTMLAnchorElement>(".safeclaw-skip-link");
    const mainTarget = document.getElementById("safeclaw-module-main");

    return {
      h1Count: document.querySelectorAll("h1").length,
      principalCommandCount: document.querySelectorAll("[data-principal-command]").length,
      principalInteractiveCount: command.querySelectorAll("a, button").length,
      principalBackground: principalInteractive ? getComputedStyle(principalInteractive).backgroundColor : null,
      skipLinkHref: skipLink?.getAttribute("href") ?? null,
      mainTargetTag: mainTarget?.tagName ?? null,
      mainTargetTabIndex: mainTarget?.getAttribute("tabindex") ?? null,
      documentOverflow: document.documentElement.scrollWidth - window.innerWidth,
      overflowers,
      headingCommandOverlap: intersects(headingRect, commandRect),
      railHeaderOverlap: intersects(railRect, headerRect),
      maxCardRadius: Math.max(
        ...surfaces.map((element) => Number.parseFloat(getComputedStyle(element).borderTopLeftRadius) || 0),
        0
      ),
      shellBackground: shellStyle.backgroundColor,
      shellOverflowX: shellStyle.overflowX,
      mainOverflowX: mainStyle.overflowX,
      surface2Token: shellStyle.getPropertyValue("--workspace-surface-2").trim().toLowerCase(),
      shellContrast: elementContrast(shell),
      railBackground: railStyle.backgroundColor,
      railContrast: elementContrast(rail),
      navBackground: navStyle.backgroundColor,
      navTextContrast: Math.min(...navTextContrasts, Number.POSITIVE_INFINITY),
      subtleTextContrast: Math.min(...subtleTextContrasts, Number.POSITIVE_INFINITY),
      surfaceContrastFailures: surfaceTextMetrics.filter((metric) => metric.ratio < 4.5).slice(0, 12),
      workerRowTextContrast: Math.min(...workerRowTextContrasts, Number.POSITIVE_INFINITY),
      formControlContrast: Math.min(...formControlContrasts, Number.POSITIVE_INFINITY),
      chromeControlBackgrounds
    };
  });
}

type ShellMetrics = Awaited<ReturnType<typeof readShellMetrics>>;

function expectThemeMetrics(metrics: ShellMetrics, route: string, theme: "day" | "night") {
  const expected = theme === "day"
    ? { canvas: "rgb(250, 250, 251)", rail: "rgb(255, 255, 255)", surface2: "#f4f5f7", accent: "rgb(81, 72, 216)" }
    : { canvas: "rgb(1, 1, 2)", rail: "rgb(15, 16, 17)", surface2: "#141516", accent: "rgb(139, 141, 252)" };

  expect.soft(metrics.h1Count, `${route} ${theme} should have one h1`).toBe(1);
  expect.soft(metrics.principalCommandCount, `${route} ${theme} should have one principal command`).toBe(1);
  expect.soft(metrics.principalInteractiveCount, `${route} ${theme} should expose one principal action`).toBe(1);
  expect.soft(metrics.skipLinkHref, `${route} ${theme} should expose a skip link`).toBe("#safeclaw-module-main");
  expect.soft(metrics.mainTargetTag, `${route} ${theme} should target the main landmark`).toBe("MAIN");
  expect.soft(metrics.mainTargetTabIndex, `${route} ${theme} main target should be programmatically focusable`).toBe("-1");
  expect.soft(metrics.documentOverflow, `${route} ${theme} should not overflow the viewport`).toBeLessThanOrEqual(1);
  expect.soft(metrics.overflowers, `${route} ${theme} should have no visible horizontal overflowers`).toEqual([]);
  expect.soft(metrics.headingCommandOverlap, `${route} ${theme} heading and command should not overlap`).toBe(false);
  expect.soft(metrics.railHeaderOverlap, `${route} ${theme} rail and header should not overlap`).toBe(false);
  expect.soft(metrics.maxCardRadius, `${route} ${theme} cards should stay at or below 8px`).toBeLessThanOrEqual(8);
  expect.soft(metrics.shellBackground, `${route} ${theme} canvas token should be stable`).toBe(expected.canvas);
  expect.soft(metrics.surface2Token, `${route} ${theme} secondary surface token should be stable`).toBe(expected.surface2);
  expect.soft(metrics.shellOverflowX, `${route} ${theme} shell should use bounded layout instead of clipping`).not.toMatch(/clip|hidden/);
  expect.soft(metrics.mainOverflowX, `${route} ${theme} main should use bounded layout instead of clipping`).not.toMatch(/clip|hidden/);
  expect.soft(metrics.shellContrast, `${route} ${theme} shell text should meet AA contrast`).toBeGreaterThanOrEqual(4.5);
  expect.soft(metrics.railBackground, `${route} ${theme} rail surface should match the theme`).toBe(expected.rail);
  expect.soft(metrics.navBackground, `${route} ${theme} nav surface should match the theme`).toBe(expected.rail);
  expect.soft(metrics.railContrast, `${route} ${theme} rail text should meet AA contrast`).toBeGreaterThanOrEqual(4.5);
  expect.soft(metrics.navTextContrast, `${route} ${theme} nav text should meet AA contrast`).toBeGreaterThanOrEqual(4.5);
  expect.soft(metrics.subtleTextContrast, `${route} ${theme} subtle text should meet AA contrast`).toBeGreaterThanOrEqual(4.5);
  expect.soft(metrics.surfaceContrastFailures, `${route} ${theme} surface text should meet AA contrast`).toEqual([]);
  expect.soft(metrics.workerRowTextContrast, `${route} ${theme} worker rows should meet AA contrast`).toBeGreaterThanOrEqual(4.5);
  expect.soft(metrics.formControlContrast, `${route} ${theme} form controls should meet AA contrast`).toBeGreaterThanOrEqual(4.5);
  expect.soft(metrics.chromeControlBackgrounds, `${route} ${theme} chrome controls should not inherit the legacy primary yellow`)
    .not.toContain("rgb(255, 220, 46)");
  expect.soft(metrics.chromeControlBackgrounds, `${route} ${theme} chrome controls should stay secondary to the principal command`)
    .not.toContain(expected.accent);
}

async function readVisibleTouchTargets(page: Page) {
  return await page.locator(
    ".safeclaw-module-brand, .safeclaw-module-menu-button, .safeclaw-module-theme-toggle button,"
    + " .safeclaw-module-principal-command :is(a, button), .safeclaw-module-rail nav a"
  ).evaluateAll((elements) => elements.flatMap((element) => {
    const target = element as HTMLElement;
    const rect = target.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return [];
    return [{
      label: target.textContent?.trim() || target.getAttribute("aria-label") || target.tagName,
      width: rect.width,
      height: rect.height
    }];
  }));
}

type ScreenshotPixel = { red: number; green: number; blue: number };

type ScreenshotPixelAudit = {
  railPixels: ScreenshotPixel[];
  navPixels: ScreenshotPixel[];
  mainPixels: ScreenshotPixel[];
  brandContrastPixels: number;
  activeNavContrastPixels: number | null;
};

async function settleThemeFrame(page: Page): Promise<void> {
  await page.evaluate(() => new Promise<void>((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  }));
}

async function readScreenshotPixelAudit(page: Page, screenshotPath?: string): Promise<ScreenshotPixelAudit> {
  const geometry = await page.evaluate(() => {
    const rail = document.querySelector<HTMLElement>(".safeclaw-module-rail");
    const nav = document.querySelector<HTMLElement>(".safeclaw-module-nav");
    const main = document.querySelector<HTMLElement>(".safeclaw-module-main");
    const decision = document.querySelector<HTMLElement>(".safeclaw-page-decision-header");
    const brandText = document.querySelector<HTMLElement>(".safeclaw-module-brand strong");
    const activeNavText = document.querySelector<HTMLElement>(".safeclaw-module-rail a.active strong");
    if (!rail || !nav || !main || !decision || !brandText) {
      throw new Error("Missing screenshot pixel audit target");
    }

    const railRect = rail.getBoundingClientRect();
    const navRect = nav.getBoundingClientRect();
    const mainRect = main.getBoundingClientRect();
    const decisionRect = decision.getBoundingClientRect();
    const toRect = (rect: DOMRect) => ({
      left: Math.floor(rect.left),
      top: Math.floor(rect.top),
      right: Math.ceil(rect.right),
      bottom: Math.ceil(rect.bottom)
    });

    return {
      railPoints: [
        { x: Math.round(railRect.right - 8), y: Math.round(railRect.top + 24) },
        { x: Math.round(railRect.right - 8), y: Math.round(railRect.top + railRect.height / 2) },
        { x: Math.round(railRect.right - 8), y: Math.round(Math.min(window.innerHeight - 24, railRect.bottom - 24)) }
      ],
      navPoints: [
        { x: Math.round(navRect.left + 6), y: Math.round(navRect.top + navRect.height / 2) },
        { x: Math.round(navRect.right - 6), y: Math.round(navRect.top + navRect.height / 2) }
      ],
      mainPoints: [
        { x: Math.round(mainRect.right - 8), y: Math.round(Math.min(window.innerHeight - 8, decisionRect.bottom + 10)) }
      ],
      brandRect: toRect(brandText.getBoundingClientRect()),
      activeNavRect: activeNavText && activeNavText.getBoundingClientRect().width > 0
        ? toRect(activeNavText.getBoundingClientRect())
        : null
    };
  });
  const screenshot = await page.screenshot({
    path: screenshotPath,
    fullPage: false
  });
  const base64 = screenshot.toString("base64");

  return await page.evaluate(async ({ encodedPng, targets }) => {
    type Pixel = { red: number; green: number; blue: number };
    type Rect = { left: number; top: number; right: number; bottom: number };
    const binary = atob(encodedPng);
    const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
    const bitmap = await createImageBitmap(new Blob([bytes], { type: "image/png" }));
    const canvas = document.createElement("canvas");
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) throw new Error("Unable to create screenshot pixel context");
    context.drawImage(bitmap, 0, 0);

    const pixelAt = (point: { x: number; y: number }): Pixel => {
      const x = Math.max(0, Math.min(canvas.width - 1, point.x));
      const y = Math.max(0, Math.min(canvas.height - 1, point.y));
      const [red, green, blue] = context.getImageData(x, y, 1, 1).data;
      return { red, green, blue };
    };
    const luminance = (pixel: Pixel) => {
      const channels = [pixel.red, pixel.green, pixel.blue].map((channel) => {
        const normalized = channel / 255;
        return normalized <= 0.04045
          ? normalized / 12.92
          : ((normalized + 0.055) / 1.055) ** 2.4;
      });
      return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
    };
    const contrastRatio = (first: Pixel, second: Pixel) => {
      const firstLuminance = luminance(first);
      const secondLuminance = luminance(second);
      return (Math.max(firstLuminance, secondLuminance) + 0.05)
        / (Math.min(firstLuminance, secondLuminance) + 0.05);
    };
    const contrastingPixelCount = (rect: Rect, background: Pixel) => {
      const left = Math.max(0, rect.left);
      const top = Math.max(0, rect.top);
      const right = Math.min(canvas.width, rect.right);
      const bottom = Math.min(canvas.height, rect.bottom);
      let count = 0;
      for (let y = top; y < bottom; y += 1) {
        for (let x = left; x < right; x += 1) {
          if (contrastRatio(pixelAt({ x, y }), background) >= 4.5) count += 1;
        }
      }
      return count;
    };

    const railPixels = targets.railPoints.map(pixelAt);
    const navPixels = targets.navPoints.map(pixelAt);
    const mainPixels = targets.mainPoints.map(pixelAt);
    const railBackground = railPixels[0];
    return {
      railPixels,
      navPixels,
      mainPixels,
      brandContrastPixels: contrastingPixelCount(targets.brandRect, railBackground),
      activeNavContrastPixels: targets.activeNavRect
        ? contrastingPixelCount(targets.activeNavRect, railBackground)
        : null
    };
  }, { encodedPng: base64, targets: geometry });
}

function expectScreenshotPixelAudit(
  audit: ScreenshotPixelAudit,
  theme: "day" | "night",
  label: string
): void {
  const expected = theme === "day"
    ? { rail: { red: 255, green: 255, blue: 255 }, nav: { red: 255, green: 255, blue: 255 }, main: { red: 250, green: 250, blue: 251 } }
    : { rail: { red: 15, green: 16, blue: 17 }, nav: { red: 15, green: 16, blue: 17 }, main: { red: 1, green: 1, blue: 2 } };
  const channelDelta = (pixel: ScreenshotPixel, target: ScreenshotPixel) => Math.max(
    Math.abs(pixel.red - target.red),
    Math.abs(pixel.green - target.green),
    Math.abs(pixel.blue - target.blue)
  );

  for (const pixel of audit.railPixels) {
    expect.soft(channelDelta(pixel, expected.rail), `${label} rail screenshot pixel ${JSON.stringify(pixel)}`).toBeLessThanOrEqual(2);
  }
  for (const pixel of audit.navPixels) {
    expect.soft(channelDelta(pixel, expected.nav), `${label} nav screenshot pixel ${JSON.stringify(pixel)}`).toBeLessThanOrEqual(2);
  }
  for (const pixel of audit.mainPixels) {
    expect.soft(channelDelta(pixel, expected.main), `${label} main screenshot pixel ${JSON.stringify(pixel)}`).toBeLessThanOrEqual(2);
  }
  expect.soft(audit.brandContrastPixels, `${label} brand glyphs should remain visible in the screenshot`).toBeGreaterThanOrEqual(8);
  if (audit.activeNavContrastPixels !== null) {
    expect.soft(audit.activeNavContrastPixels, `${label} active nav glyphs should remain visible in the screenshot`).toBeGreaterThanOrEqual(8);
  }
}

describe("product module shell", () => {
  it("uses one 900px breakpoint for the shared module shell", () => {
    const css = fs.readFileSync(path.join(process.cwd(), "app", "globals.css"), "utf8");
    const legacyModuleBreakpoints = css.match(/@media \(max-width: 980px\) \{\s+\.safeclaw-module-shell/g) ?? [];
    expect(legacyModuleBreakpoints).toHaveLength(0);
  });

  beforeAll(async () => {
    fs.mkdirSync(screenshotRoot, { recursive: true });
    const serverScript = `
      const http = require("node:http");
      const imported = require(${JSON.stringify(resolveNextModule())});
      const createNextServer = imported.default || imported;
      const app = createNextServer({
        dev: true,
        dir: process.cwd(),
        hostname: "127.0.0.1",
        port: ${port},
        conf: { distDir: ${JSON.stringify(distDir)} }
      });
      let httpServer;
      async function shutdown() {
        if (httpServer) await new Promise((resolve) => httpServer.close(resolve));
        await app.close();
        process.exit(0);
      }
      process.on("SIGTERM", () => void shutdown());
      process.on("SIGINT", () => void shutdown());
      app.prepare()
        .then(() => {
          const handler = app.getRequestHandler();
          httpServer = http.createServer((request, response) => {
            handler(request, response).catch((error) => {
              console.error(error);
              if (!response.headersSent) response.statusCode = 500;
              response.end("Internal test server error");
            });
          });
          httpServer.listen(${port}, "127.0.0.1", () => console.log("C7_SERVER_READY"));
        })
        .catch((error) => {
          console.error(error);
          process.exit(1);
        });
    `;
    server = spawn(process.execPath, ["-e", serverScript], {
      cwd: process.cwd(),
      env: { ...process.env, NEXT_TELEMETRY_DISABLED: "1" },
      windowsHide: true
    });
    server.stdout.on("data", (chunk: Buffer) => serverOutput.push(chunk.toString()));
    server.stderr.on("data", (chunk: Buffer) => serverOutput.push(chunk.toString()));
    server.on("exit", (code, signal) => {
      serverExit = { code, signal };
    });
    await waitForHttp(`${baseUrl}/home?theme=day`);
    browser = await chromium.launch({ headless: true });
  }, 60_000);

  afterAll(async () => {
    await browser?.close();
    await stopServer();
    const absoluteDistDir = path.resolve(process.cwd(), distDir);
    if (!absoluteDistDir.startsWith(`${path.resolve(process.cwd())}${path.sep}`)) {
      throw new Error(`Refusing to remove unexpected test dist directory: ${absoluteDistDir}`);
    }
    fs.rmSync(absoluteDistDir, { recursive: true, force: true });
  }, 30_000);

  for (const viewport of [
    { name: "desktop", width: 1440, height: 900 },
    { name: "mobile", width: 390, height: 844 }
  ] as const) {
    it(`keeps the shared shell bounded and operable on ${viewport.name}`, async () => {
      if (!browser) throw new Error("Browser was not started");
      const page = await browser.newPage({ viewport });
      page.setDefaultTimeout(20_000);

      try {
        for (const route of routes) {
          await openModule(page, route);

          const dayMetrics = await readShellMetrics(page);
          expectThemeMetrics(dayMetrics, route, "day");

          if (route === "/knowledge") {
            const knowledgeColumns = await page.locator(".knowledge-status-grid:not(.compact)").evaluate(
              (element) => getComputedStyle(element).gridTemplateColumns.split(" ").filter(Boolean).length
            );
            expect.soft(knowledgeColumns).toBe(viewport.name === "mobile" ? 1 : 3);
          }

          if (viewport.name === "mobile") {
            const menuButton = page.getByRole("button", { name: "메뉴" });
            expect.soft(await menuButton.isVisible()).toBe(true);
            expect.soft(await menuButton.getAttribute("aria-expanded")).toBe("false");
            await menuButton.click();
            await page.waitForFunction(
              () => document.querySelector("[aria-controls='safeclaw-module-navigation']")?.getAttribute("aria-expanded") === "true"
            );
            const touchTargets = await readVisibleTouchTargets(page);
            for (const target of touchTargets) {
              expect.soft(target.width, `${route} ${target.label} touch target width`).toBeGreaterThanOrEqual(44);
              expect.soft(target.height, `${route} ${target.label} touch target height`).toBeGreaterThanOrEqual(44);
            }
            await menuButton.click();
            await page.waitForFunction(
              () => document.querySelector("[aria-controls='safeclaw-module-navigation']")?.getAttribute("aria-expanded") === "false"
            );
          }

          await page.getByRole("button", { name: "Night" }).click();
          await page.waitForFunction(() => document.querySelector(".safeclaw-module-shell")?.getAttribute("data-theme") === "night");
          await settleThemeFrame(page);
          const nightMetrics = await readShellMetrics(page);
          expectThemeMetrics(nightMetrics, route, "night");
          expect.soft(nightMetrics.shellBackground, `${route} should expose a distinct Night canvas`).not.toBe(dayMetrics.shellBackground);

          const slug = route.slice(1).replaceAll("/", "-");
          const nightScreenshotPath = path.join(screenshotRoot, `${viewport.name}-${slug}-night.png`);
          const auditNightChrome = (viewport.name === "desktop" && route === "/documents")
            || (viewport.name === "mobile" && route === "/tbm");
          if (auditNightChrome) {
            const firstAudit = await readScreenshotPixelAudit(page);
            await settleThemeFrame(page);
            const stableAudit = await readScreenshotPixelAudit(page, nightScreenshotPath);
            const label = `${route} ${viewport.name} night`;
            expectScreenshotPixelAudit(firstAudit, "night", `${label} initial frame`);
            expectScreenshotPixelAudit(stableAudit, "night", `${label} stable frame`);
            expect.soft(stableAudit.railPixels, `${label} rail pixels should be stable across frames`).toEqual(firstAudit.railPixels);
            expect.soft(stableAudit.navPixels, `${label} nav pixels should be stable across frames`).toEqual(firstAudit.navPixels);
            expect.soft(stableAudit.mainPixels, `${label} main pixels should be stable across frames`).toEqual(firstAudit.mainPixels);
          } else if (screenshotRoutes.has(route)) {
            await page.screenshot({
              path: nightScreenshotPath,
              fullPage: false
            });
          }

          await page.getByRole("button", { name: "Day" }).click();
          await page.waitForFunction(() => document.querySelector(".safeclaw-module-shell")?.getAttribute("data-theme") === "day");
          await page.waitForFunction(
            (expectedCanvas) => {
              const shell = document.querySelector(".safeclaw-module-shell");
              return shell ? getComputedStyle(shell).backgroundColor === expectedCanvas : false;
            },
            dayMetrics.shellBackground
          );
          await page.waitForFunction(
            (expectedRail) => {
              const rail = document.querySelector(".safeclaw-module-rail");
              return rail ? getComputedStyle(rail).backgroundColor === expectedRail : false;
            },
            dayMetrics.railBackground
          );
          await settleThemeFrame(page);

          const dayScreenshotPath = path.join(screenshotRoot, `${viewport.name}-${slug}-day.png`);
          if (route === "/tbm") {
            const firstAudit = await readScreenshotPixelAudit(page);
            await settleThemeFrame(page);
            const stableAudit = await readScreenshotPixelAudit(page, dayScreenshotPath);
            const label = `${route} ${viewport.name} day`;
            expectScreenshotPixelAudit(firstAudit, "day", `${label} initial frame`);
            expectScreenshotPixelAudit(stableAudit, "day", `${label} stable frame`);
            expect.soft(stableAudit.railPixels, `${label} rail pixels should be stable across frames`).toEqual(firstAudit.railPixels);
            expect.soft(stableAudit.navPixels, `${label} nav pixels should be stable across frames`).toEqual(firstAudit.navPixels);
            expect.soft(stableAudit.mainPixels, `${label} main pixels should be stable across frames`).toEqual(firstAudit.mainPixels);
          } else if (screenshotRoutes.has(route)) {
            await page.screenshot({
              path: dayScreenshotPath,
              fullPage: false
            });
          }
        }
      } catch (error) {
        throw new Error(`${String(error)}\n${serverDiagnostics()}`);
      } finally {
        await page.close();
      }
    }, 240_000);
  }
});
