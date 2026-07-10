import { spawn, spawnSync, type ChildProcessWithoutNullStreams } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { chromium, type Browser, type Page } from "playwright";

const port = 3231;
const baseUrl = `http://127.0.0.1:${port}`;
const routes = ["/home", "/documents", "/workers", "/evidence", "/knowledge", "/settings"] as const;
const screenshotRoot = path.join(process.cwd(), "output", "playwright", "c7-batch1-module-shell");
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
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    assertServerAlive(`opening ${route} (attempt ${attempt})`);
    try {
      await page.goto(`${baseUrl}${route}?theme=day`, {
        waitUntil: "domcontentloaded",
        timeout: 20_000
      });
      await page.locator("[data-testid='page-decision-header']").waitFor({
        state: "visible",
        timeout: 12_000
      });
      await page.locator(".safeclaw-module-shell[data-ready='true']").waitFor({
        state: "attached",
        timeout: 12_000
      });
      return;
    } catch (error) {
      lastError = error;
      if (serverExit || attempt === 2) break;
      await page.waitForTimeout(300);
    }
  }
  throw new Error(`Failed to open ${route}: ${String(lastError)}\n${serverDiagnostics()}`);
}

async function readShellMetrics(page: Page) {
  return await page.evaluate(() => {
    function intersects(first: DOMRect, second: DOMRect) {
      return first.left < second.right
        && first.right > second.left
        && first.top < second.bottom
        && first.bottom > second.top;
    }

    function contrastRatio(foreground: string, background: string) {
      const channels = (value: string) => {
        const matches = value.match(/[\d.]+/g);
        if (!matches || matches.length < 3) throw new Error(`Unsupported color: ${value}`);
        return matches.slice(0, 3).map((channel) => {
          const normalized = Number(channel) / 255;
          return normalized <= 0.04045
            ? normalized / 12.92
            : ((normalized + 0.055) / 1.055) ** 2.4;
        });
      };
      const luminance = (value: string) => {
        const [red, green, blue] = channels(value);
        return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
      };
      const foregroundLuminance = luminance(foreground);
      const backgroundLuminance = luminance(background);
      const lighter = Math.max(foregroundLuminance, backgroundLuminance);
      const darker = Math.min(foregroundLuminance, backgroundLuminance);
      return (lighter + 0.05) / (darker + 0.05);
    }

    const shell = document.querySelector<HTMLElement>(".safeclaw-module-shell");
    const rail = document.querySelector<HTMLElement>(".safeclaw-module-rail");
    const header = document.querySelector<HTMLElement>("[data-testid='page-decision-header']");
    const heading = header?.querySelector<HTMLElement>("h1");
    const command = header?.querySelector<HTMLElement>("[data-principal-command]");
    if (!shell || !rail || !header || !heading || !command) throw new Error("Missing product shell contract target");

    const shellStyle = getComputedStyle(shell);
    const railStyle = getComputedStyle(rail);
    const headerRect = header.getBoundingClientRect();
    const headingRect = heading.getBoundingClientRect();
    const commandRect = command.getBoundingClientRect();
    const railRect = rail.getBoundingClientRect();
    const overflowers = Array.from(document.body.querySelectorAll<HTMLElement>("*"))
      .filter((element) => {
        const style = getComputedStyle(element);
        if (style.display === "none" || style.visibility === "hidden") return false;
        const rect = element.getBoundingClientRect();
        return rect.width > 0 && (rect.left < -1 || rect.right > window.innerWidth + 1);
      })
      .slice(0, 8)
      .map((element) => ({
        className: element.className.toString(),
        tagName: element.tagName,
        rect: element.getBoundingClientRect().toJSON()
      }));
    const cardTextContrasts = Array.from(document.querySelectorAll<HTMLElement>(
      ".safeclaw-module-shell .card > :is(p, strong, span, h2, h3, small),"
      + ".safeclaw-module-shell .safeclaw-module-grid article > :is(p, strong, span, h2, h3, small)"
    )).map((element) => {
      const surface = element.closest<HTMLElement>(".card, .safeclaw-module-grid article");
      if (!surface) return Number.POSITIVE_INFINITY;
      return contrastRatio(getComputedStyle(element).color, getComputedStyle(surface).backgroundColor);
    });

    return {
      h1Count: document.querySelectorAll("h1").length,
      principalCommandCount: document.querySelectorAll("[data-principal-command]").length,
      documentOverflow: document.documentElement.scrollWidth - window.innerWidth,
      overflowers,
      headingCommandOverlap: intersects(headingRect, commandRect),
      railHeaderOverlap: intersects(railRect, headerRect),
      maxCardRadius: Math.max(
        ...Array.from(document.querySelectorAll<HTMLElement>(".safeclaw-module-shell .card, .safeclaw-module-grid article"))
          .map((element) => Number.parseFloat(getComputedStyle(element).borderTopLeftRadius) || 0),
        0
      ),
      shellContrast: contrastRatio(shellStyle.color, shellStyle.backgroundColor),
      railBackground: railStyle.backgroundColor,
      railContrast: contrastRatio(railStyle.color, railStyle.backgroundColor),
      cardTextContrast: Math.min(...cardTextContrasts, Number.POSITIVE_INFINITY)
    };
  });
}

describe("product module shell", () => {
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
  });

  for (const viewport of [
    { name: "desktop", width: 1440, height: 900 },
    { name: "mobile", width: 390, height: 844 }
  ] as const) {
    it(`keeps the shared shell bounded and operable on ${viewport.name}`, async () => {
      if (!browser) throw new Error("Browser was not started");
      const page = await browser.newPage({ viewport });
      page.setDefaultTimeout(12_000);

      try {
        for (const route of routes) {
          await openModule(page, route);

          const dayCanvas = await page.locator(".safeclaw-module-shell").evaluate((element) => getComputedStyle(element).backgroundColor);
          const dayRail = await page.locator(".safeclaw-module-rail").evaluate((element) => getComputedStyle(element).backgroundColor);
          const metrics = await readShellMetrics(page);
          expect.soft(metrics.h1Count, `${route} should have one h1`).toBe(1);
          expect.soft(metrics.principalCommandCount, `${route} should have one principal command`).toBe(1);
          expect.soft(metrics.documentOverflow, `${route} should not overflow the viewport`).toBeLessThanOrEqual(1);
          expect.soft(metrics.overflowers, `${route} should have no visible horizontal overflowers`).toEqual([]);
          expect.soft(metrics.headingCommandOverlap, `${route} heading and command should not overlap`).toBe(false);
          expect.soft(metrics.railHeaderOverlap, `${route} rail and header should not overlap`).toBe(false);
          expect.soft(metrics.maxCardRadius, `${route} cards should stay at or below 8px`).toBeLessThanOrEqual(8);
          expect.soft(metrics.shellContrast, `${route} shell text should meet AA contrast`).toBeGreaterThanOrEqual(4.5);
          expect.soft(metrics.railBackground, `${route} should use the Day rail surface`).toBe("rgb(255, 255, 255)");
          expect.soft(metrics.railContrast, `${route} rail text should meet AA contrast`).toBeGreaterThanOrEqual(4.5);
          expect.soft(metrics.cardTextContrast, `${route} card text should meet AA contrast`).toBeGreaterThanOrEqual(4.5);

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
            await menuButton.click();
            await page.waitForFunction(
              () => document.querySelector("[aria-controls='safeclaw-module-navigation']")?.getAttribute("aria-expanded") === "false"
            );
          }

          await page.getByRole("button", { name: "Night" }).click();
          await page.waitForFunction(() => document.querySelector(".safeclaw-module-shell")?.getAttribute("data-theme") === "night");
          const nightCanvas = await page.locator(".safeclaw-module-shell").evaluate((element) => getComputedStyle(element).backgroundColor);
          expect.soft(nightCanvas, `${route} should expose a distinct Night canvas`).not.toBe(dayCanvas);
          await page.getByRole("button", { name: "Day" }).click();
          await page.waitForFunction(() => document.querySelector(".safeclaw-module-shell")?.getAttribute("data-theme") === "day");
          await page.waitForFunction(
            (expectedCanvas) => {
              const shell = document.querySelector(".safeclaw-module-shell");
              return shell ? getComputedStyle(shell).backgroundColor === expectedCanvas : false;
            },
            dayCanvas
          );
          await page.waitForFunction(
            (expectedRail) => {
              const rail = document.querySelector(".safeclaw-module-rail");
              return rail ? getComputedStyle(rail).backgroundColor === expectedRail : false;
            },
            dayRail
          );
          await page.evaluate(() => new Promise<void>((resolve) => {
            requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
          }));

          const slug = route.slice(1);
          await page.screenshot({
            path: path.join(screenshotRoot, `${viewport.name}-${slug}.png`),
            fullPage: false
          });
        }
      } catch (error) {
        throw new Error(`${String(error)}\n${serverDiagnostics()}`);
      } finally {
        await page.close();
      }
    }, 90_000);
  }
});
