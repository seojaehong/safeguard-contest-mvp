import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Browser } from "playwright";
import {
  startIsolatedNextBrowserHarness,
  type IsolatedNextBrowserHarness
} from "./helpers/isolated-next-browser-harness";

let baseUrl = "";
let browser: Browser | null = null;
let harness: IsolatedNextBrowserHarness | null = null;

describe("documents editor layout", () => {
  beforeAll(async () => {
    harness = await startIsolatedNextBrowserHarness({
      slug: "documents-editor-layout",
      initialPath: "/documents",
      portSalt: 3228
    });
    baseUrl = harness.baseUrl;
    browser = harness.browser;
  }, 90_000);

  afterAll(async () => {
    await harness?.stop();
  }, 30_000);

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
    expect(metrics.shell.backgroundColor).toBe("rgb(255, 255, 255)");
    expect(metrics.sidebar.backgroundColor).toBe("rgb(255, 255, 255)");
    expect(metrics.editor.backgroundColor).toBe("rgb(255, 255, 255)");
    expect(metrics.editor.color).not.toBe("rgb(246, 245, 239)");
    expect(metrics.sidebar.right).toBeLessThanOrEqual(metrics.editor.left - 12);
    expect(metrics.editor.borderRadius).toBeGreaterThanOrEqual(6);
    expect(metrics.editor.borderRadius).toBeLessThanOrEqual(8);
    expect(metrics.textarea.backgroundColor).toBe("rgb(255, 255, 255)");
    expect(metrics.textarea.borderTopWidth).toBeGreaterThanOrEqual(1);
    expect(metrics.textarea.lineHeight / metrics.textarea.fontSize).toBeGreaterThanOrEqual(1.68);
    expect(metrics.activeTab.backgroundColor).not.toBe("rgb(108, 111, 247)");
    expect(metrics.activeTab.color).not.toBe("rgb(255, 255, 255)");
    expect(metrics.sheetExportPanel.backgroundColor).toBe("rgb(255, 255, 255)");
    expect(metrics.sheetExportPanel.borderRadius).toBeLessThanOrEqual(8);
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
      const tableWrap = document.querySelector(".submission-preview-panel .safety-form-table-wrap");
      const sectionTitle = document.querySelector(".submission-preview-panel .safety-form-section-stack h3");
      const firstHeader = document.querySelector(".submission-preview-panel .safety-form-preview th");
      if (!editor || !preview || !tableWrap || !sectionTitle || !firstHeader) throw new Error("Missing submission preview targets");
      const editorRect = editor.getBoundingClientRect();
      const previewRect = preview.getBoundingClientRect();
      const previewStyle = getComputedStyle(preview);
      const tableWrapStyle = getComputedStyle(tableWrap);
      const sectionTitleStyle = getComputedStyle(sectionTitle);
      const firstHeaderStyle = getComputedStyle(firstHeader);
      return {
        viewportWidth: window.innerWidth,
        scrollWidth: document.documentElement.scrollWidth,
        editorLeft: Math.round(editorRect.left),
        editorRight: Math.round(editorRect.right),
        previewLeft: Math.round(previewRect.left),
        previewRight: Math.round(previewRect.right),
        previewOverflowX: previewStyle.overflowX,
        previewBackground: previewStyle.backgroundColor,
        previewColor: previewStyle.color,
        tableWrapBorderRadius: Number.parseFloat(tableWrapStyle.borderRadius),
        tableWrapBorderColor: tableWrapStyle.borderTopColor,
        sectionTitleBackground: sectionTitleStyle.backgroundColor,
        sectionTitleColor: sectionTitleStyle.color,
        sectionTitleBorderRadius: Number.parseFloat(sectionTitleStyle.borderRadius),
        firstHeaderBackground: firstHeaderStyle.backgroundColor,
        firstHeaderColor: firstHeaderStyle.color,
        firstHeaderBorderColor: firstHeaderStyle.borderBottomColor
      };
    });

    expect(metrics.scrollWidth).toBeLessThanOrEqual(metrics.viewportWidth + 1);
    expect(metrics.previewLeft).toBeGreaterThanOrEqual(metrics.editorLeft);
    expect(metrics.previewRight).toBeLessThanOrEqual(metrics.editorRight);
    expect(metrics.previewOverflowX).toBe("auto");
    expect(metrics.previewBackground).toBe("rgb(255, 255, 255)");
    expect(metrics.previewColor).not.toBe("rgb(246, 245, 239)");
    expect(metrics.tableWrapBorderRadius).toBeGreaterThanOrEqual(8);
    expect(metrics.tableWrapBorderRadius).toBeLessThanOrEqual(8);
    expect(metrics.tableWrapBorderColor).toBe("rgb(231, 234, 238)");
    expect(metrics.sectionTitleBackground).toBe("rgb(244, 245, 247)");
    expect(metrics.sectionTitleColor).toBe("rgb(23, 25, 29)");
    expect(metrics.sectionTitleBorderRadius).toBeGreaterThanOrEqual(6);
    expect(metrics.firstHeaderBackground).toBe("rgb(244, 245, 247)");
    expect(metrics.firstHeaderColor).toBe("rgb(23, 25, 29)");
    expect(metrics.firstHeaderBorderColor).toBe("rgb(231, 234, 238)");
  }, 90_000);

  it("keeps exported HTML document styling aligned with the workspace system", async () => {
    if (!browser) throw new Error("Browser was not started");
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    await page.addInitScript(() => {
      type CapturedDownload = { type: string; text: string };
      const captureTarget = window as unknown as { __safeclawDownloads: CapturedDownload[] };
      captureTarget.__safeclawDownloads = [];
      const originalCreateObjectUrl = URL.createObjectURL.bind(URL);
      URL.createObjectURL = (object: Blob | MediaSource) => {
        if (object instanceof Blob && /html|text|msword|excel/.test(object.type)) {
          void object.text().then((text) => {
            captureTarget.__safeclawDownloads.push({ type: object.type, text });
          });
        }
        return originalCreateObjectUrl(object);
      };
    });

    await page.goto(`${baseUrl}/documents`, { waitUntil: "networkidle" });
    await page.locator(".workpack-shell").scrollIntoViewIfNeeded();
    await page.locator(".download-bar details summary", { hasText: "베타 형식" }).click();
    await page.locator(".advanced-download-grid button", { hasText: "HTML" }).click();
    await page.waitForFunction(() => {
      const captureTarget = window as unknown as { __safeclawDownloads?: Array<{ text: string }> };
      return Boolean(captureTarget.__safeclawDownloads?.some((item) => item.text.includes("safety-form-page")));
    });

    const html = await page.evaluate(() => {
      const captureTarget = window as unknown as { __safeclawDownloads?: Array<{ text: string }> };
      return captureTarget.__safeclawDownloads?.find((item) => item.text.includes("safety-form-page"))?.text || "";
    });

    expect(html).toContain("#fafafb");
    expect(html).toContain("#e6e8eb");
    expect(html).toContain("border-radius: 12px");
    expect(html).not.toContain("#ece7dc");
    expect(html).not.toContain("#f2ead9");
    expect(html).not.toContain("background: #161b22");
    expect(html).not.toContain("background: #285f45");
    expect(html).not.toContain("border: 2px solid #161b22");
  }, 90_000);
});
