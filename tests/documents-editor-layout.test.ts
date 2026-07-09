import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { chromium, type Browser } from "playwright";

const port = 3228;
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

describe("documents editor layout", () => {
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

  it("keeps the document editor in the same light workbench system", async () => {
    if (!browser) throw new Error("Browser was not started");
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    await page.goto(`${baseUrl}/documents`, { waitUntil: "networkidle" });
    await page.locator(".workpack-shell").scrollIntoViewIfNeeded();

    const metrics = await page.evaluate(() => {
      function readRect(selector: string) {
        const element = document.querySelector(selector);
        if (!element) throw new Error(`Missing layout target: ${selector}`);
        const rect = element.getBoundingClientRect();
        const style = getComputedStyle(element);
        return {
          top: Math.round(rect.top),
          bottom: Math.round(rect.bottom),
          left: Math.round(rect.left),
          right: Math.round(rect.right),
          width: Math.round(rect.width),
          height: Math.round(rect.height),
          display: style.display,
          backgroundColor: style.backgroundColor,
          color: style.color,
          borderRadius: Number.parseFloat(style.borderRadius),
          borderTopWidth: Number.parseFloat(style.borderTopWidth),
          overflowX: style.overflowX,
          lineHeight: Number.parseFloat(style.lineHeight),
          fontSize: Number.parseFloat(style.fontSize)
        };
      }

      const shell = readRect(".workpack-shell");
      const sidebar = readRect(".workpack-sidebar");
      const editor = readRect(".document-editor");
      const textarea = readRect(".document-textarea");
      const activeTab = readRect(".doc-tab.active");
      const sheetExportPanel = readRect(".sheet-export-panel");
      const previewPanel = readRect(".submission-preview-panel");
      const previewDisplay = getComputedStyle(document.querySelector(".submission-preview-panel .safety-form-preview") as Element).display;

      return {
        viewportWidth: window.innerWidth,
        scrollWidth: document.documentElement.scrollWidth,
        shell,
        sidebar,
        editor,
        textarea,
        activeTab,
        sheetExportPanel,
        previewPanel,
        previewDisplay
      };
    });

    expect(metrics.scrollWidth).toBeLessThanOrEqual(metrics.viewportWidth + 1);
    expect(metrics.shell.display).toBe("grid");
    expect(metrics.shell.backgroundColor).toBe("rgba(0, 0, 0, 0)");
    expect(metrics.sidebar.backgroundColor).toBe("rgb(255, 255, 255)");
    expect(metrics.editor.backgroundColor).toBe("rgb(255, 255, 255)");
    expect(metrics.editor.color).not.toBe("rgb(246, 245, 239)");
    expect(metrics.sidebar.right).toBeLessThanOrEqual(metrics.editor.left - 12);
    expect(metrics.editor.borderRadius).toBeGreaterThanOrEqual(9);
    expect(metrics.textarea.backgroundColor).toBe("rgb(255, 255, 255)");
    expect(metrics.textarea.borderTopWidth).toBeGreaterThanOrEqual(1);
    expect(metrics.textarea.lineHeight / metrics.textarea.fontSize).toBeGreaterThanOrEqual(1.68);
    expect(metrics.activeTab.backgroundColor).not.toBe("rgb(108, 111, 247)");
    expect(metrics.activeTab.color).not.toBe("rgb(255, 255, 255)");
    expect(metrics.sheetExportPanel.backgroundColor).toBe("rgba(0, 0, 0, 0)");
    expect(metrics.sheetExportPanel.color).not.toBe("rgb(246, 245, 239)");
    expect(metrics.previewPanel.backgroundColor).not.toBe("rgba(14, 14, 18, 0.78)");
    expect(metrics.previewDisplay).toBe("none");
  }, 90_000);

  it("keeps the opened submission preview contained", async () => {
    if (!browser) throw new Error("Browser was not started");
    const page = await browser.newPage({ viewport: { width: 1180, height: 860 } });
    await page.goto(`${baseUrl}/documents`, { waitUntil: "networkidle" });
    await page.locator(".workpack-shell").scrollIntoViewIfNeeded();
    await page.locator(".submission-preview-panel summary").click();

    const metrics = await page.evaluate(() => {
      const editor = document.querySelector(".document-editor");
      const preview = document.querySelector(".submission-preview-panel .safety-form-preview");
      if (!editor || !preview) throw new Error("Missing submission preview targets");
      const editorRect = editor.getBoundingClientRect();
      const previewRect = preview.getBoundingClientRect();
      const previewStyle = getComputedStyle(preview);
      return {
        viewportWidth: window.innerWidth,
        scrollWidth: document.documentElement.scrollWidth,
        editorLeft: Math.round(editorRect.left),
        editorRight: Math.round(editorRect.right),
        previewLeft: Math.round(previewRect.left),
        previewRight: Math.round(previewRect.right),
        previewOverflowX: previewStyle.overflowX,
        previewBackground: previewStyle.backgroundColor,
        previewColor: previewStyle.color
      };
    });

    expect(metrics.scrollWidth).toBeLessThanOrEqual(metrics.viewportWidth + 1);
    expect(metrics.previewLeft).toBeGreaterThanOrEqual(metrics.editorLeft);
    expect(metrics.previewRight).toBeLessThanOrEqual(metrics.editorRight);
    expect(metrics.previewOverflowX).toBe("auto");
    expect(metrics.previewBackground).toBe("rgb(255, 255, 255)");
    expect(metrics.previewColor).not.toBe("rgb(246, 245, 239)");
  }, 90_000);
});
