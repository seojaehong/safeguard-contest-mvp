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
    await page.evaluate(() => window.scrollTo(0, 260));
    await page.waitForTimeout(100);

    const metrics = await page.evaluate(() => {
      const topbar = document.querySelector(".command-topbar");
      const sideNav = document.querySelector(".workspace-side-nav");
      const heading = document.querySelector(".command-copy h1");
      const topbarRect = topbar?.getBoundingClientRect();
      const sideNavRect = sideNav?.getBoundingClientRect();
      const headingRect = heading?.getBoundingClientRect();
      return {
        scrollY: Math.round(window.scrollY),
        topbarBottom: topbarRect ? Math.round(topbarRect.bottom) : null,
        sideNavTop: sideNavRect ? Math.round(sideNavRect.top) : null,
        headingTop: headingRect ? Math.round(headingRect.top) : null
      };
    });

    expect(metrics.scrollY).toBeGreaterThanOrEqual(120);
    expect(metrics.topbarBottom).not.toBeNull();
    expect(metrics.sideNavTop).not.toBeNull();
    expect(metrics.headingTop).not.toBeNull();
    expect(metrics.topbarBottom).toBeLessThanOrEqual(0);
  }, 90_000);
});
