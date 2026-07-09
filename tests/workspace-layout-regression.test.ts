import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { chromium, type Browser } from "playwright";

const port = 3227;
const baseUrl = `http://127.0.0.1:${port}`;
let server: ChildProcessWithoutNullStreams | null = null;
let browser: Browser | null = null;
const serverOutput: string[] = [];

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

describe("workspace layout regression", () => {
  beforeAll(async () => {
    const nextBin = resolveNextBin();
    server = spawn(process.execPath, [nextBin, "dev", "--port", String(port)], {
      cwd: process.cwd(),
      env: { ...process.env, NEXT_TELEMETRY_DISABLED: "1" }
    });
    server.stdout.on("data", (chunk: Buffer) => serverOutput.push(chunk.toString()));
    server.stderr.on("data", (chunk: Buffer) => serverOutput.push(chunk.toString()));
    await waitForHttp(`${baseUrl}/workspace?theme=night`);
    browser = await chromium.launch({ headless: true });
  }, 90_000);

  afterAll(async () => {
    await browser?.close();
    if (server && !server.killed) {
      server.kill();
    }
  });

  it("does not pin the large workspace topbar over menu and content while scrolling", async () => {
    if (!browser) throw new Error("Browser was not started");
    const page = await browser.newPage({ viewport: { width: 1440, height: 720 } });
    await page.goto(`${baseUrl}/workspace?theme=night`, { waitUntil: "networkidle" });
    await page.waitForFunction(() => {
      const scroller = document.scrollingElement;
      return Boolean(scroller && scroller.scrollHeight > window.innerHeight + 160);
    });
    await page.evaluate(() => window.scrollTo(0, 260));
    await page.waitForFunction(() => window.scrollY >= 120);

    const metrics = await page.evaluate(() => {
      const topbar = document.querySelector(".command-topbar");
      const sideNav = document.querySelector(".workspace-side-nav");
      const heading = document.querySelector(".command-copy h1");
      const topbarRect = topbar?.getBoundingClientRect();
      const sideNavRect = sideNav?.getBoundingClientRect();
      const headingRect = heading?.getBoundingClientRect();
      const topbarStyle = topbar ? getComputedStyle(topbar) : null;
      return {
        scrollY: Math.round(window.scrollY),
        topbarBottom: topbarRect ? Math.round(topbarRect.bottom) : null,
        topbarPosition: topbarStyle?.position || null,
        sideNavTop: sideNavRect ? Math.round(sideNavRect.top) : null,
        headingTop: headingRect ? Math.round(headingRect.top) : null
      };
    });

    expect(metrics.scrollY).toBeGreaterThanOrEqual(120);
    expect(metrics.topbarBottom).not.toBeNull();
    expect(metrics.sideNavTop).not.toBeNull();
    expect(metrics.headingTop).not.toBeNull();
    expect(metrics.topbarPosition).toBe("relative");
    expect(metrics.topbarBottom).toBeLessThanOrEqual(0);
  }, 90_000);

  it("lets the day topbar scroll away on wide short presentation screens", async () => {
    if (!browser) throw new Error("Browser was not started");
    const page = await browser.newPage({ viewport: { width: 2048, height: 638 } });
    await page.goto(`${baseUrl}/workspace?theme=day`, { waitUntil: "networkidle" });
    await page.waitForFunction(() => {
      const scroller = document.scrollingElement;
      return Boolean(scroller && scroller.scrollHeight > window.innerHeight + 160);
    });
    await page.evaluate(() => window.scrollTo(0, 260));
    await page.waitForFunction(() => window.scrollY >= 120);

    const metrics = await page.evaluate(() => {
      const topbar = document.querySelector(".command-topbar");
      const heading = document.querySelector(".workspace-input-page .command-copy h1");
      const textarea = document.querySelector(".workspace-input-page .command-console-input");
      const topbarRect = topbar?.getBoundingClientRect();
      const headingRect = heading?.getBoundingClientRect();
      const textareaRect = textarea?.getBoundingClientRect();
      const topbarStyle = topbar ? getComputedStyle(topbar) : null;
      return {
        scrollY: Math.round(window.scrollY),
        topbarBottom: topbarRect ? Math.round(topbarRect.bottom) : null,
        topbarPosition: topbarStyle?.position || null,
        headingTop: headingRect ? Math.round(headingRect.top) : null,
        headingBottom: headingRect ? Math.round(headingRect.bottom) : null,
        textareaTop: textareaRect ? Math.round(textareaRect.top) : null
      };
    });

    expect(metrics.scrollY).toBeGreaterThanOrEqual(120);
    expect(metrics.topbarBottom).not.toBeNull();
    expect(metrics.headingTop).not.toBeNull();
    expect(metrics.headingBottom).not.toBeNull();
    expect(metrics.textareaTop).not.toBeNull();
    expect(metrics.topbarPosition).toBe("relative");
    expect(metrics.topbarBottom).toBeLessThanOrEqual(0);
    expect(metrics.headingBottom).toBeLessThanOrEqual(metrics.textareaTop! - 16);
  }, 90_000);

  it("keeps the workspace first impression typography solid and readable", async () => {
    if (!browser) throw new Error("Browser was not started");
    const page = await browser.newPage({ viewport: { width: 1440, height: 720 } });
    await page.goto(`${baseUrl}/workspace?theme=night`, { waitUntil: "networkidle" });

    const metrics = await page.evaluate(() => {
      const heading = document.querySelector(".workspace-input-page .command-copy h1");
      const description = document.querySelector(".workspace-input-page .command-copy p");
      const input = document.querySelector(".workspace-input-page .command-console-input");
      const sideNav = document.querySelector(".workspace-side-nav");
      const sideButton = document.querySelector(".workspace-side-group button");
      if (!heading || !description || !input || !sideNav || !sideButton) {
        throw new Error("Workspace typography targets were not found");
      }
      const headingStyle = getComputedStyle(heading);
      const descriptionStyle = getComputedStyle(description);
      const inputStyle = getComputedStyle(input);
      const sideNavStyle = getComputedStyle(sideNav);
      const sideButtonRect = sideButton.getBoundingClientRect();
      return {
        headingWeight: Number.parseFloat(headingStyle.fontWeight),
        headingLineHeight: Number.parseFloat(headingStyle.lineHeight),
        headingFontSize: Number.parseFloat(headingStyle.fontSize),
        headingLetterSpacing: headingStyle.letterSpacing,
        descriptionWeight: Number.parseFloat(descriptionStyle.fontWeight),
        inputLineHeight: Number.parseFloat(inputStyle.lineHeight),
        inputFontSize: Number.parseFloat(inputStyle.fontSize),
        sideGap: Number.parseFloat(sideNavStyle.gap),
        sideButtonHeight: Math.round(sideButtonRect.height)
      };
    });

    expect(metrics.headingWeight).toBeGreaterThanOrEqual(880);
    expect(metrics.headingLineHeight / metrics.headingFontSize).toBeGreaterThanOrEqual(1.1);
    expect(["0px", "normal"]).toContain(metrics.headingLetterSpacing);
    expect(metrics.descriptionWeight).toBeGreaterThanOrEqual(600);
    expect(metrics.inputLineHeight / metrics.inputFontSize).toBeGreaterThanOrEqual(1.75);
    expect(metrics.sideGap).toBeGreaterThanOrEqual(18);
    expect(metrics.sideButtonHeight).toBeGreaterThanOrEqual(48);
  }, 90_000);

  it("keeps the day workspace shell from overlapping the first-screen composer", async () => {
    if (!browser) throw new Error("Browser was not started");
    const page = await browser.newPage({ viewport: { width: 1600, height: 820 } });
    await page.goto(`${baseUrl}/workspace?theme=day`, { waitUntil: "networkidle" });

    const metrics = await page.evaluate(() => {
      function readRect(selector: string) {
        const element = document.querySelector(selector);
        if (!element) throw new Error(`Missing layout target: ${selector}`);
        const rect = element.getBoundingClientRect();
        const style = getComputedStyle(element);
        return {
          top: Math.round(rect.top),
          right: Math.round(rect.right),
          bottom: Math.round(rect.bottom),
          left: Math.round(rect.left),
          width: Math.round(rect.width),
          height: Math.round(rect.height),
          borderTopWidth: Number.parseFloat(style.borderTopWidth),
          backgroundColor: style.backgroundColor,
          scrollTop: element instanceof HTMLTextAreaElement ? element.scrollTop : 0,
          clientHeight: element instanceof HTMLTextAreaElement ? element.clientHeight : Math.round(rect.height),
          scrollHeight: element instanceof HTMLTextAreaElement ? element.scrollHeight : Math.round(rect.height)
        };
      }

      const topbar = readRect(".command-topbar");
      const viewport = readRect(".command-viewport");
      const sideNav = readRect(".workspace-side-nav");
      const main = readRect(".command-main");
      const heading = readRect(".workspace-input-page .command-copy h1");
      const textarea = readRect(".workspace-input-page .command-console-input");

      return {
        topbar,
        viewport,
        sideNav,
        main,
        heading,
        textarea
      };
    });

    expect(metrics.topbar.bottom).toBeLessThanOrEqual(metrics.viewport.top - 8);
    expect(metrics.sideNav.right).toBeLessThanOrEqual(metrics.main.left - 8);
    expect(metrics.heading.bottom).toBeLessThanOrEqual(metrics.textarea.top - 16);
    expect(metrics.textarea.borderTopWidth).toBeGreaterThanOrEqual(1);
    expect(metrics.textarea.backgroundColor).not.toBe("rgba(0, 0, 0, 0)");
    expect(metrics.textarea.scrollTop).toBe(0);
    expect(metrics.textarea.clientHeight).toBeGreaterThanOrEqual(140);
    expect(metrics.textarea.scrollHeight).toBeLessThanOrEqual(metrics.textarea.clientHeight + 96);
  }, 90_000);
});
