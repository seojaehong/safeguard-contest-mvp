import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Browser } from "playwright";
import {
  startIsolatedNextBrowserHarness,
  type IsolatedNextBrowserHarness
} from "./helpers/isolated-next-browser-harness";

let baseUrl = "";
let browser: Browser | null = null;
let harness: IsolatedNextBrowserHarness | null = null;

const themes = ["day", "night"] as const;

describe("why comparison layout", () => {
  beforeAll(async () => {
    harness = await startIsolatedNextBrowserHarness({
      slug: "why-mobile-layout",
      initialPath: "/why?theme=day",
      portSalt: 47,
      timeoutMs: 120_000
    });
    baseUrl = harness.baseUrl;
    browser = harness.browser;
  }, 140_000);

  afterAll(async () => {
    await harness?.stop();
  }, 90_000);

  for (const theme of themes) {
    it(`renders readable stacked comparison cards without horizontal overflow in ${theme} mode`, async () => {
      if (!browser) throw new Error("Browser was not started");
      const page = await browser.newPage({ viewport: { width: 390, height: 844 } });

      try {
        await page.goto(`${baseUrl}/why?theme=${theme}`, { waitUntil: "networkidle" });
        await page.locator(".safeclaw-module-shell[data-ready='true']").waitFor();

        const metrics = await page.evaluate(() => {
          const table = document.querySelector("[data-why-comparison], .comparison-table");
          if (!table) throw new Error("Missing why comparison table");

          const visibleElements = Array.from(document.body.querySelectorAll<HTMLElement>("*"))
            .filter((element) => {
              const style = getComputedStyle(element);
              const rect = element.getBoundingClientRect();
              return style.display !== "none" && style.visibility !== "hidden" && rect.width > 0 && rect.height > 0;
            });
          const outsideViewport = visibleElements.filter((element) => {
            const rect = element.getBoundingClientRect();
            return rect.left < -1 || rect.right > window.innerWidth + 1;
          });
          const textElements = visibleElements.filter((element) => {
            const hasDirectText = Array.from(element.childNodes).some(
              (node) => node.nodeType === Node.TEXT_NODE && Boolean(node.textContent?.trim())
            );
            return hasDirectText;
          });
          const unreadableText = textElements.filter((element) => {
            const rect = element.getBoundingClientRect();
            const style = getComputedStyle(element);
            return rect.width < 1
              || rect.left < -1
              || rect.right > window.innerWidth + 1
              || Number.parseFloat(style.fontSize) < 12
              || Number.parseFloat(style.lineHeight) < Number.parseFloat(style.fontSize);
          });
          const controls = visibleElements.filter(
            (element) => element.matches("a[href], button, input, select, textarea")
          );
          const undersizedControls = controls.filter((element) => {
            const rect = element.getBoundingClientRect();
            return rect.width < 44 || rect.height < 44;
          });
          const bodyRows = Array.from(table.querySelectorAll<HTMLElement>("tbody tr, :scope > [role='row']:not(.comparison-head)"));
          const labeledCells = Array.from(table.querySelectorAll<HTMLElement>("tbody td"));
          const rowWidths = bodyRows.map((row) => Math.round(row.getBoundingClientRect().width));
          const tableWidth = Math.round(table.getBoundingClientRect().width);
          const firstRowDisplay = bodyRows[0] ? getComputedStyle(bodyRows[0]).display : "missing";
          const visibleLabels = labeledCells.map((cell) => getComputedStyle(cell, "::before").content);

          return {
            tableTag: table.tagName,
            columnHeaderCount: table.querySelectorAll("thead th[scope='col']").length,
            rowHeaderCount: table.querySelectorAll("tbody th[scope='row']").length,
            documentOverflow: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) - window.innerWidth,
            outsideViewport: outsideViewport.map((element) => element.tagName.toLowerCase()),
            unreadableText: unreadableText.map((element) => element.textContent?.trim().slice(0, 80) ?? ""),
            undersizedControls: undersizedControls.map((element) => element.textContent?.trim().slice(0, 80) ?? ""),
            rowCount: bodyRows.length,
            tableWidth,
            rowWidths,
            firstRowDisplay,
            visibleLabels
          };
        });

        if (process.env.WHY_MOBILE_AUDIT === "1") {
          console.info(`WHY_MOBILE_AUDIT ${JSON.stringify({ viewport: "390x844", theme, ...metrics })}`);
        }

        expect(metrics.documentOverflow).toBe(0);
        expect(metrics.tableTag).toBe("TABLE");
        expect(metrics.columnHeaderCount).toBe(5);
        expect(metrics.rowHeaderCount).toBe(5);
        expect(metrics.outsideViewport).toEqual([]);
        expect(metrics.unreadableText).toEqual([]);
        expect(metrics.undersizedControls).toEqual([]);
        expect(metrics.rowCount).toBe(5);
        expect(metrics.firstRowDisplay).toBe("grid");
        expect(metrics.rowWidths.every((width) => width === metrics.tableWidth)).toBe(true);
        expect(metrics.visibleLabels.every((label) => label !== "none" && label !== "normal" && label !== "\"\"")).toBe(true);
      } finally {
        await page.close();
      }
    }, 45_000);
  }

  for (const theme of themes) {
    it(`preserves the five-column comparison table on desktop in ${theme} mode`, async () => {
      if (!browser) throw new Error("Browser was not started");
      const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

      try {
        await page.goto(`${baseUrl}/why?theme=${theme}`, { waitUntil: "networkidle" });
        await page.locator(".safeclaw-module-shell[data-ready='true']").waitFor();
        const metrics = await page.locator("[data-why-comparison], .comparison-table").evaluate((table) => {
          const head = table.querySelector("thead tr, .comparison-head");
          const firstRow = table.querySelector("tbody tr, :scope > [role='row']:not(.comparison-head)");
          if (!head || !firstRow) throw new Error("Missing desktop comparison rows");
          const parseRgb = (value: string) => (value.match(/[\d.]+/g) ?? []).slice(0, 3).map(Number);
          const luminance = (channels: number[]) => {
            const [red, green, blue] = channels.map((channel) => {
              const normalized = channel / 255;
              return normalized <= 0.04045
                ? normalized / 12.92
                : ((normalized + 0.055) / 1.055) ** 2.4;
            });
            return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
          };
          const contrasts = Array.from(head.children).map((cell) => {
            const style = getComputedStyle(cell);
            const foreground = luminance(parseRgb(style.color));
            const background = luminance(parseRgb(style.backgroundColor));
            return (Math.max(foreground, background) + 0.05) / (Math.min(foreground, background) + 0.05);
          });
          return {
            headColumns: head.children.length,
            rowColumns: firstRow.children.length,
            headDisplay: getComputedStyle(head).display,
            rowDisplay: getComputedStyle(firstRow).display,
            tableWidth: Math.round(table.getBoundingClientRect().width),
            documentOverflow: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) - window.innerWidth,
            minimumHeaderContrast: Math.min(...contrasts)
          };
        });

        if (process.env.WHY_MOBILE_AUDIT === "1") {
          console.info(`WHY_DESKTOP_AUDIT ${JSON.stringify({ viewport: "1440x900", theme, ...metrics })}`);
        }

        expect(metrics).toMatchObject({
          headColumns: 5,
          rowColumns: 5,
          headDisplay: "grid",
          rowDisplay: "grid",
          tableWidth: metrics.tableWidth,
          documentOverflow: 0
        });
        expect(metrics.tableWidth).toBeGreaterThan(900);
        expect(metrics.minimumHeaderContrast).toBeGreaterThanOrEqual(4.5);
      } finally {
        await page.close();
      }
    }, 45_000);
  }
});
