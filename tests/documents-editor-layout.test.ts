import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Browser } from "playwright";
import { buildStoredCurrentWorkpack, CURRENT_WORKPACK_STORAGE_KEY } from "@/lib/current-workpack";
import { buildSampleWorkpack } from "@/lib/sample-workpack";
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

  it("opens a requested document in an editor-first workspace with secondary tools collapsed", async () => {
    if (!browser) throw new Error("Browser was not started");
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    await page.goto(`${baseUrl}/documents`, { waitUntil: "networkidle" });

    await page.locator(".safeclaw-doc-index-list button", { hasText: "위험성평가표" }).click();
    await page.waitForFunction(() => document.activeElement?.getAttribute("aria-label") === "위험성평가표 편집");

    const contract = await page.evaluate(() => {
      const shell = document.querySelector('[data-testid="workpack-editor-workspace"]');
      const documentBody = document.querySelector('[data-testid="editor-document-body"]');
      const secondaryTools = document.querySelector('[data-testid="editor-secondary-tools"]');
      const textarea = document.querySelector<HTMLTextAreaElement>('.document-textarea[aria-label="위험성평가표 편집"]');
      const evidencePanel = document.querySelector<HTMLDetailsElement>('[data-testid="editor-evidence-panel"]');
      const qualityPanel = document.querySelector<HTMLDetailsElement>('[data-testid="editor-quality-panel"]');
      const graphPanel = document.querySelector<HTMLDetailsElement>('[data-testid="editor-graph-panel"]');
      const exportPanel = document.querySelector<HTMLDetailsElement>('[data-testid="editor-export-panel"]');
      const previewPanel = document.querySelector<HTMLDetailsElement>('.submission-preview-panel');
      const documentSelect = document.querySelector<HTMLSelectElement>('select[aria-label="편집 문서 선택"]');
      const topbar = document.querySelector(".safeclaw-module-nav");
      if (!shell || !documentBody || !secondaryTools || !textarea || !evidencePanel || !qualityPanel || !graphPanel || !exportPanel || !previewPanel || !documentSelect || !topbar) {
        throw new Error("Missing editor-first workspace contract target");
      }

      const bodyRect = documentBody.getBoundingClientRect();
      const toolsRect = secondaryTools.getBoundingClientRect();
      const topbarRect = topbar.getBoundingClientRect();
      return {
        activeLabel: document.activeElement?.getAttribute("aria-label"),
        bodyBeforeTools: Boolean(documentBody.compareDocumentPosition(secondaryTools) & Node.DOCUMENT_POSITION_FOLLOWING),
        bodyTop: Math.round(bodyRect.top),
        topbarBottom: Math.round(topbarRect.bottom),
        toolsTop: Math.round(toolsRect.top),
        textareaLength: textarea.value.length,
        selectedDocument: documentSelect.value,
        documentCount: documentSelect.options.length,
        evidenceOpen: evidencePanel.open,
        qualityOpen: qualityPanel.open,
        graphOpen: graphPanel.open,
        exportOpen: exportPanel.open,
        previewOpen: previewPanel.open
      };
    });

    expect(contract.activeLabel).toBe("위험성평가표 편집");
    expect(contract.selectedDocument).toBe("riskAssessmentDraft");
    expect(contract.documentCount).toBe(12);
    expect(contract.textareaLength).toBeGreaterThan(100);
    expect(contract.bodyBeforeTools).toBe(true);
    expect(contract.bodyTop).toBeGreaterThanOrEqual(contract.topbarBottom + 8);
    expect(contract.bodyTop).toBeLessThanOrEqual(contract.topbarBottom + 96);
    expect(contract.bodyTop).toBeLessThan(contract.toolsTop);
    expect(contract.evidenceOpen).toBe(false);
    expect(contract.qualityOpen).toBe(false);
    expect(contract.graphOpen).toBe(false);
    expect(contract.exportOpen).toBe(false);
    expect(contract.previewOpen).toBe(false);
  }, 90_000);

  it("does not enter a maximum update-depth loop for a real current workpack", async () => {
    if (!browser) throw new Error("Browser was not started");
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    const stored = buildStoredCurrentWorkpack(buildSampleWorkpack());
    await page.addInitScript(({ storageKey, serialized }) => {
      window.localStorage.setItem(storageKey, serialized);
      const target = window as typeof window & { __safeclawCurrentWorkpackWrites?: number };
      target.__safeclawCurrentWorkpackWrites = 0;
      const originalSetItem = Storage.prototype.setItem;
      Storage.prototype.setItem = function setItem(key: string, value: string) {
        if (key === storageKey) {
          target.__safeclawCurrentWorkpackWrites = (target.__safeclawCurrentWorkpackWrites || 0) + 1;
        }
        return originalSetItem.call(this, key, value);
      };
    }, { storageKey: CURRENT_WORKPACK_STORAGE_KEY, serialized: JSON.stringify(stored) });
    const runtimeErrors: string[] = [];
    page.on("console", (message) => {
      if (message.type() === "error") runtimeErrors.push(message.text());
    });
    page.on("pageerror", (error) => runtimeErrors.push(error.message));

    await page.goto(`${baseUrl}/documents`, { waitUntil: "networkidle" });
    await page.getByRole("textbox", { name: "점검결과 요약 편집" }).waitFor({ state: "visible" });
    await page.waitForTimeout(750);
    const writeCount = await page.evaluate(() => (
      (window as typeof window & { __safeclawCurrentWorkpackWrites?: number }).__safeclawCurrentWorkpackWrites || 0
    ));

    expect(runtimeErrors.join("\n")).not.toMatch(/maximum update depth|too many re-renders/i);
    expect(writeCount).toBeLessThanOrEqual(4);
  }, 90_000);

  it("restores an edited browser draft after a full reload with the same draft key", async () => {
    if (!browser) throw new Error("Browser was not started");
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    const sentinel = "SAFECLAW_RELOAD_DRAFT_PRESERVED";

    await page.goto(`${baseUrl}/documents`, { waitUntil: "networkidle" });
    await page.getByRole("tab", { name: /위험성평가표/ }).click();
    const editor = page.getByRole("textbox", { name: "위험성평가표 편집" });
    const editedValue = `${await editor.inputValue()}\n${sentinel}`;
    await editor.fill(editedValue);
    await expect.poll(async () => page.evaluate((marker) => (
      Object.keys(window.localStorage)
        .filter((key) => key.startsWith("safeclaw-workpack:"))
        .some((key) => window.localStorage.getItem(key)?.includes(marker))
    ), sentinel)).toBe(true);
    const keysBeforeReload = await page.evaluate(() => (
      Object.keys(window.localStorage).filter((key) => key.startsWith("safeclaw-workpack:")).sort()
    ));

    await page.reload({ waitUntil: "networkidle" });
    await page.getByRole("tab", { name: /위험성평가표/ }).click();
    await expect.poll(() => page.getByRole("textbox", { name: "위험성평가표 편집" }).inputValue()).toBe(editedValue);
    const keysAfterReload = await page.evaluate(() => (
      Object.keys(window.localStorage).filter((key) => key.startsWith("safeclaw-workpack:")).sort()
    ));

    expect(keysAfterReload).toEqual(keysBeforeReload);
  }, 90_000);

  it("keeps every Day document metadata label at AA text contrast", async () => {
    if (!browser) throw new Error("Browser was not started");
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    await page.goto(`${baseUrl}/documents?theme=day`, { waitUntil: "networkidle" });

    const ratios = await page.locator(".document-toolbar > div:last-child > span").evaluateAll((elements) => {
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
      return elements.map((element) => {
        const style = getComputedStyle(element);
        const foreground = luminance(style.color);
        const background = luminance(style.backgroundColor);
        return {
          text: element.textContent?.trim() || "",
          ratio: (Math.max(foreground, background) + 0.05) / (Math.min(foreground, background) + 0.05)
        };
      });
    });

    expect(ratios.length).toBeGreaterThanOrEqual(2);
    ratios.forEach(({ text, ratio }) => expect(ratio, text).toBeGreaterThanOrEqual(4.5));
  }, 90_000);

  it("supports roving keyboard navigation across document tabs", async () => {
    if (!browser) throw new Error("Browser was not started");
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    await page.goto(`${baseUrl}/documents`, { waitUntil: "networkidle" });
    await page.locator('[data-testid="workpack-editor-workspace"]').scrollIntoViewIfNeeded();

    const tabs = page.getByRole("tab");
    expect(await tabs.count()).toBe(12);
    expect(await tabs.evaluateAll((items) => items.map((item) => item.tabIndex))).toEqual([
      0, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1
    ]);

    const summaryTab = page.getByRole("tab", { name: /점검결과 요약/ });
    const riskTab = page.getByRole("tab", { name: /위험성평가표/ });
    const workPlanTab = page.getByRole("tab", { name: /작업계획서/ });
    const messageTab = page.getByRole("tab", { name: /현장 공유 메시지/ });
    const documentSelect = page.locator('select[aria-label="편집 문서 선택"]');
    const panel = page.locator('[data-testid="editor-document-body"]');

    await summaryTab.focus();
    await summaryTab.press("End");
    expect(await documentSelect.inputValue()).toBe("kakaoMessage");
    expect(await messageTab.evaluate((element) => document.activeElement === element)).toBe(true);

    await messageTab.press("Home");
    expect(await documentSelect.inputValue()).toBe("workpackSummaryDraft");
    expect(await summaryTab.evaluate((element) => document.activeElement === element)).toBe(true);

    await summaryTab.press("ArrowRight");
    expect(await documentSelect.inputValue()).toBe("riskAssessmentDraft");
    await riskTab.press("ArrowDown");
    expect(await documentSelect.inputValue()).toBe("workPlanDraft");
    await workPlanTab.press("ArrowLeft");
    expect(await documentSelect.inputValue()).toBe("riskAssessmentDraft");
    await riskTab.press("ArrowUp");
    expect(await documentSelect.inputValue()).toBe("workpackSummaryDraft");

    expect(await panel.getAttribute("aria-labelledby")).toBe("workpack-document-tab-workpackSummaryDraft");
    expect(await tabs.evaluateAll((items) => items.map((item) => item.tabIndex))).toEqual([
      0, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1
    ]);
  }, 90_000);

  it("keeps the editor workspace and expanded tools contained at 390px", async () => {
    if (!browser) throw new Error("Browser was not started");
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    await page.goto(`${baseUrl}/documents`, { waitUntil: "networkidle" });
    await page.locator('[data-testid="workpack-editor-workspace"]').scrollIntoViewIfNeeded();

    const documentSelect = page.locator('select[aria-label="편집 문서 선택"]');
    await documentSelect.selectOption("tbmBriefing");
    await page.locator('[data-testid="editor-evidence-panel"] > summary').click();
    await page.locator('[data-testid="editor-quality-panel"] > summary').click();
    await page.locator('[data-testid="editor-graph-panel"] > summary').click();
    await page.locator('[data-testid="editor-export-panel"] > summary').click();

    const metrics = await page.evaluate(() => {
      const viewportWidth = window.innerWidth;
      const selectors = [
        '[data-testid="workpack-editor-workspace"]',
        '[data-testid="editor-document-body"]',
        '[data-testid="editor-secondary-tools"]',
        'select[aria-label="편집 문서 선택"]',
        ".document-textarea",
        '[data-testid="editor-evidence-panel"]',
        '[data-testid="editor-quality-panel"]',
        '[data-testid="editor-graph-panel"]',
        '[data-testid="editor-export-panel"]'
      ];
      const bounds = selectors.map((selector) => {
        const element = document.querySelector(selector);
        if (!element) throw new Error(`Missing mobile layout target: ${selector}`);
        const rect = element.getBoundingClientRect();
        return { selector, left: Math.round(rect.left), right: Math.round(rect.right), width: Math.round(rect.width) };
      });
      const desktopTabs = document.querySelector(".doc-tab-list");
      const mobileSelect = document.querySelector('select[aria-label="편집 문서 선택"]');
      if (!desktopTabs || !mobileSelect) throw new Error("Missing responsive document navigation");
      return {
        viewportWidth,
        scrollWidth: document.documentElement.scrollWidth,
        bounds,
        desktopTabsDisplay: getComputedStyle(desktopTabs).display,
        mobileSelectDisplay: getComputedStyle(mobileSelect).display,
        textareaLabel: document.querySelector(".document-textarea")?.getAttribute("aria-label")
      };
    });

    expect(metrics.scrollWidth).toBeLessThanOrEqual(metrics.viewportWidth + 1);
    expect(metrics.desktopTabsDisplay).toBe("none");
    expect(metrics.mobileSelectDisplay).not.toBe("none");
    expect(metrics.textareaLabel).toBe("TBM/작업 전 안전점검회의 편집");
    metrics.bounds.forEach((rect) => {
      expect(rect.left, rect.selector).toBeGreaterThanOrEqual(0);
      expect(rect.right, rect.selector).toBeLessThanOrEqual(metrics.viewportWidth + 1);
      expect(rect.width, rect.selector).toBeGreaterThan(0);
    });
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
    await page.locator('[data-testid="editor-export-panel"] > summary').click();
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
