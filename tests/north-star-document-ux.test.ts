import { existsSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import type { Browser, Page } from "playwright";
import { buildSampleWorkpack } from "@/lib/sample-workpack";
import {
  startIsolatedNextBrowserHarness,
  type IsolatedNextBrowserHarness
} from "./helpers/isolated-next-browser-harness";

let baseUrl = "";
let browser: Browser | null = null;
let harness: IsolatedNextBrowserHarness | null = null;

type Theme = "day" | "night";
type ViewportCase = {
  label: string;
  width: 1440 | 391;
  height: 900 | 844;
  theme: Theme;
};

const viewportCases: ViewportCase[] = [
  { label: "desktop-day", width: 1440, height: 900, theme: "day" },
  { label: "desktop-night", width: 1440, height: 900, theme: "night" },
  { label: "mobile-day", width: 391, height: 844, theme: "day" },
  { label: "mobile-night", width: 391, height: 844, theme: "night" }
];
const metricRows: Array<Record<string, unknown>> = [];
const evaluationDirectory = path.join(process.cwd(), "evaluation", "north-star-document-ux-24h-2026-07-14");
const productionBuildIdPath = path.join(process.cwd(), ".next", "BUILD_ID");
const hasProductionBuild = existsSync(productionBuildIdPath);
const productionBrowserSuite = hasProductionBuild ? describe : describe.skip;
const productionBrowserSuiteName = hasProductionBuild
  ? "North Star document cockpit and editor UX"
  : "North Star document cockpit and editor UX [skipped: missing .next/BUILD_ID; run npm.cmd run build first]";

type ViewportGeometry = {
  clippedControls: string[];
  fixedOrStickyElements: string[];
  horizontalOverflow: number;
  interactionOverlaps: string[];
  nestedScrollContainers: string[];
  overlayOverlaps: string[];
  tooSmallTouchTargets: string[];
};

async function openGeneratedWorkspace(page: Page, theme: Theme) {
  const sample = buildSampleWorkpack();
  await page.addInitScript(() => {
    window.localStorage.setItem("safeclaw.aiMode", "template");
  });
  await page.route("**/api/weather?**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ ok: true, weather: null })
    });
  });
  await page.route("**/api/ask", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(sample)
    });
  });

  await page.goto(`${baseUrl}/workspace?scenario=seoul-construction-windy&theme=${theme}`, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: /안전 문서 생성/ }).click();
  await page.locator(".document-preview-pane").waitFor({ state: "visible" });
}

productionBrowserSuite(productionBrowserSuiteName, () => {
  beforeAll(async () => {
    harness = await startIsolatedNextBrowserHarness({
      slug: "north-star-document-ux",
      initialPath: "/workspace",
      portSalt: 5921,
      mode: "prod"
    });
    baseUrl = harness.baseUrl;
    browser = harness.browser;
  }, 90_000);

  afterAll(async () => {
    await harness?.stop();
    await mkdir(path.join(evaluationDirectory, "screenshots"), { recursive: true });
    await writeFile(
      path.join(evaluationDirectory, "browser-metrics.json"),
      `${JSON.stringify({
        authorityBase: "01ba1c924e5ab19803bdb86527fce9eccfc1ab60",
        expectedRows: viewportCases.length,
        actualRows: metricRows.length,
        rows: metricRows
      }, null, 2)}\n`,
      "utf8"
    );
  }, 90_000);

  afterEach(async () => {
    if (!browser) return;
    await Promise.all(browser.contexts().map((context) => context.close()));
  }, 30_000);

  it.each(viewportCases)("keeps $label review and editing surfaces focused", async ({ width, height, theme, label }) => {
    if (!browser) throw new Error("Browser was not started");
    expect(harness?.mode).toBe("prod");
    const page = await browser.newPage({ viewport: { width, height } });
    await openGeneratedWorkspace(page, theme);

    const reviewDrawer = page.getByTestId("document-provenance-drawer");
    await reviewDrawer.waitFor({ state: "visible" });
    const reviewSummary = reviewDrawer.locator(":scope > summary");
    await expect.poll(() => reviewSummary.textContent()).toMatch(/^근거 \d+건 · 확인 필요 \d+건$/u);
    expect(await page.locator(".document-workbench .document-check-details").count()).toBe(0);
    expect(await page.locator(".document-workbench .doc-card-evidence-badge").count()).toBe(0);
    expect(await page.locator(".document-workbench .workbench-evidence-rail").count()).toBe(0);
    expect((await page.locator(".document-viewer-list").textContent()) || "").not.toMatch(/핵심 · 0\d/u);

    await reviewSummary.click();
    expect((await reviewDrawer.textContent()) || "").toContain("작성 근거");
    expect((await reviewDrawer.textContent()) || "").toContain("안전조치 확인");
    expect(await reviewDrawer.locator('a[target="_blank"]').count()).toBeGreaterThan(0);
    await reviewSummary.click();

    const reviewMetrics = await page.evaluate((mobile) => {
      const root = document.querySelector(".document-workbench");
      if (!root) throw new Error("Missing review workbench");
      const isInsideClosedDetails = (element: HTMLElement) => {
        let parent = element.parentElement;
        while (parent && parent !== root) {
          if (parent instanceof HTMLDetailsElement && !parent.open) {
            const summary = parent.querySelector(":scope > summary");
            if (!summary?.contains(element)) return true;
          }
          parent = parent.parentElement;
        }
        return false;
      };
      const nestedScrollCount = Array.from(root.querySelectorAll<HTMLElement>("*"))
        .filter((element) => {
          const style = getComputedStyle(element);
          return !isInsideClosedDetails(element)
            && !element.matches(".document-preview-pane pre")
            && /^(?:auto|scroll)$/u.test(style.overflowY)
            && element.scrollHeight > element.clientHeight + 1;
        })
        .length;
      return {
        viewportWidth: window.innerWidth,
        viewportHeight: window.innerHeight,
        pageHeight: document.documentElement.scrollHeight,
        scrollWidth: document.documentElement.scrollWidth,
        nestedScrollCount: mobile ? nestedScrollCount : 0,
        previewClientHeight: Math.round(document.querySelector<HTMLElement>(".document-preview-pane pre")?.clientHeight || 0),
        previewScrollHeight: Math.round(document.querySelector<HTMLElement>(".document-preview-pane pre")?.scrollHeight || 0),
        previewOverflowY: getComputedStyle(document.querySelector<HTMLElement>(".document-preview-pane pre") || document.body).overflowY,
        drawerHeight: Math.round(document.querySelector<HTMLElement>('[data-testid="document-provenance-drawer"]')?.getBoundingClientRect().height || 0)
      };
    }, width === 391);
    if (width === 391) {
      expect(reviewMetrics.previewClientHeight).toBeLessThanOrEqual(360);
      expect(reviewMetrics.previewScrollHeight).toBeGreaterThanOrEqual(reviewMetrics.previewClientHeight);
      expect(reviewMetrics.previewOverflowY).toBe("auto");
      expect(reviewMetrics.pageHeight).toBeLessThanOrEqual(reviewMetrics.viewportHeight * 2.25);
    }

    await page.locator(".doc-card-actions button", { hasText: "편집" }).click();
    await page.getByTestId("document-structured-editor").waitFor({ state: "visible" });
    const editorDrawer = page.getByTestId("editor-provenance-drawer");
    await expect.poll(() => editorDrawer.locator(":scope > summary").textContent()).toMatch(/^근거 \d+건 · 확인 필요 \d+건$/u);
    expect(await page.getByTestId("document-structured-editor").getAttribute("data-editor-kind")).toBe("risk-assessment");
    expect(await page.locator('[data-section-kind="body"] .document-section-textarea').count()).toBeGreaterThanOrEqual(4);
    const rowDisclosureMetrics = await page.getByTestId("risk-row-editor-row").evaluateAll((rows) => ({
      total: rows.length,
      open: rows.filter((row) => row instanceof HTMLDetailsElement && row.open).length
    }));
    if (rowDisclosureMetrics.total > 1) {
      expect(rowDisclosureMetrics.open).toBe(0);
      await page.getByTestId("risk-row-editor-row").first().locator("summary").click();
      await expect.poll(() => page.getByTestId("risk-row-editor-row").first().evaluate((row) => (
        row instanceof HTMLDetailsElement ? row.open : false
      ))).toBe(true);
    }
    expect(await page.getByTestId("editor-provenance-appendices").count()).toBe(1);
    expect(await page.locator('select[aria-label="편집 문서 선택"] option').count()).toBe(12);
    const exactProvenanceSummaryCount = await page.locator("details > summary").evaluateAll((summaries) => (
      summaries.filter((summary) => /^근거 \d+건 · 확인 필요 \d+건$/u.test(summary.textContent?.trim() || "")).length
    ));
    expect(exactProvenanceSummaryCount).toBe(1);
    await editorDrawer.locator(":scope > summary").click();
    await page.locator('[data-testid="editor-evidence-panel"] .knowledge-link').waitFor({ state: "visible" });

    const editorMetrics = await page.evaluate(() => {
      const surface = document.querySelector<HTMLElement>(".document-editor-surface");
      const body = document.querySelector<HTMLElement>('[data-testid="editor-document-body"]');
      const structured = document.querySelector<HTMLElement>('[data-testid="document-structured-editor"]');
      if (!surface || !body || !structured) throw new Error("Missing structured editor geometry target");
      const surfaceRect = surface.getBoundingClientRect();
      const bodyRect = body.getBoundingClientRect();
      const isInsideClosedDetails = (element: HTMLElement) => {
        let parent = element.parentElement;
        while (parent) {
          if (parent instanceof HTMLDetailsElement && !parent.open) {
            const summary = parent.querySelector(":scope > summary");
            if (!summary?.contains(element)) return true;
          }
          parent = parent.parentElement;
        }
        return false;
      };
      const isVisible = (element: HTMLElement) => {
        const style = getComputedStyle(element);
        const rect = element.getBoundingClientRect();
        return !isInsideClosedDetails(element)
          && element.getClientRects().length > 0
          && style.display !== "none"
          && style.visibility !== "hidden"
          && Number.parseFloat(style.opacity) > 0
          && rect.right > 0
          && rect.left < window.innerWidth
          && rect.bottom > 0
          && rect.top < window.innerHeight;
      };
      const visibleTouchTargets = Array.from(document.querySelectorAll<HTMLElement>(
        'button, summary, select, a[href], input:not([type="hidden"]), textarea, [role="button"], [tabindex]:not([tabindex="-1"])'
      )).filter((element) => (
        !isInsideClosedDetails(element)
        && isVisible(element)
      ));
      const targetLabel = (element: HTMLElement) => {
        const text = (element.getAttribute("aria-label") || element.textContent || element.getAttribute("href") || "")
          .trim()
          .replace(/\s+/gu, " ")
          .slice(0, 40);
        const testId = element.getAttribute("data-testid");
        return `${element.tagName.toLowerCase()}${testId ? `[${testId}]` : ""}:${text}`;
      };
      const tooSmallTouchTargets = visibleTouchTargets
        .filter((element) => {
          const rect = element.getBoundingClientRect();
          return rect.width < 44 || rect.height < 44;
        })
        .map(targetLabel);
      const findOverlapPairs = (elements: HTMLElement[]) => {
        const pairs: string[] = [];
        elements.forEach((first, firstIndex) => {
          const firstRect = first.getBoundingClientRect();
          elements.slice(firstIndex + 1).forEach((second) => {
            if (first.contains(second) || second.contains(first)) return;
            const secondRect = second.getBoundingClientRect();
            const overlapWidth = Math.min(firstRect.right, secondRect.right) - Math.max(firstRect.left, secondRect.left);
            const overlapHeight = Math.min(firstRect.bottom, secondRect.bottom) - Math.max(firstRect.top, secondRect.top);
            if (overlapWidth > 1 && overlapHeight > 1) {
              pairs.push(`${targetLabel(first)} <> ${targetLabel(second)}`);
            }
          });
        });
        return pairs;
      };
      const positionedTargets = Array.from(document.querySelectorAll<HTMLElement>("body *"))
        .filter((element) => {
          const position = getComputedStyle(element).position;
          return (position === "fixed" || position === "sticky") && isVisible(element);
        });
      const interactionOverlaps = findOverlapPairs(visibleTouchTargets);
      const overlayOverlaps = positionedTargets.flatMap((overlay) => visibleTouchTargets
        .filter((control) => !overlay.contains(control) && !control.contains(overlay))
        .filter((control) => {
          const overlayRect = overlay.getBoundingClientRect();
          const controlRect = control.getBoundingClientRect();
          const overlapWidth = Math.min(overlayRect.right, controlRect.right) - Math.max(overlayRect.left, controlRect.left);
          const overlapHeight = Math.min(overlayRect.bottom, controlRect.bottom) - Math.max(overlayRect.top, controlRect.top);
          return overlapWidth > 1 && overlapHeight > 1;
        })
        .map((control) => `${targetLabel(overlay)} <> ${targetLabel(control)}`));
      const clippedControls = visibleTouchTargets.filter((element) => {
        const rect = element.getBoundingClientRect();
        if (rect.left < -1 || rect.right > window.innerWidth + 1) return true;
        let ancestor = element.parentElement;
        while (ancestor && ancestor !== document.body) {
          const style = getComputedStyle(ancestor);
          if (/(?:hidden|clip)/u.test(`${style.overflowX} ${style.overflowY}`)) {
            const ancestorRect = ancestor.getBoundingClientRect();
            if (
              rect.left < ancestorRect.left - 1
              || rect.right > ancestorRect.right + 1
              || rect.top < ancestorRect.top - 1
              || rect.bottom > ancestorRect.bottom + 1
            ) return true;
          }
          ancestor = ancestor.parentElement;
        }
        return false;
      }).map(targetLabel);
      const sectionTextareas = Array.from(structured.querySelectorAll<HTMLElement>(".document-section-textarea"))
        .filter(isVisible);
      const sectionOverlaps = sectionTextareas.slice(1).filter((element, index) => {
        const previous = sectionTextareas[index];
        return previous.getBoundingClientRect().bottom > element.getBoundingClientRect().top + 0.5;
      }).length;
      const nestedScrollContainers = Array.from(document.querySelectorAll<HTMLElement>("body *"))
        .filter((element) => {
          const style = getComputedStyle(element);
          return isVisible(element)
            && /^(?:auto|scroll)$/u.test(style.overflowY)
            && element.scrollHeight > element.clientHeight + 1;
        })
        .map(targetLabel);
      const viewportGeometry: ViewportGeometry = {
        clippedControls,
        fixedOrStickyElements: positionedTargets.map(targetLabel),
        horizontalOverflow: Math.max(0, document.documentElement.scrollWidth - window.innerWidth),
        interactionOverlaps,
        nestedScrollContainers,
        overlayOverlaps,
        tooSmallTouchTargets
      };
      return {
        viewportWidth: window.innerWidth,
        viewportHeight: window.innerHeight,
        scrollWidth: document.documentElement.scrollWidth,
        bodyOffset: Math.round(bodyRect.top - surfaceRect.top),
        overlapPolicy: {
          documentedExcludedPairs: [],
          ignoredNonPairs: ["ancestor-descendant", "closed-details-content", "outside-current-viewport"]
        },
        viewportGeometry,
        sectionOverlaps,
        sectionCount: sectionTextareas.length
      };
    });

    const metricRow = { label, theme, width, height, review: reviewMetrics, editor: editorMetrics };
    metricRows.push(metricRow);
    await mkdir(path.join(evaluationDirectory, "screenshots"), { recursive: true });
    await page.screenshot({
      path: path.join(evaluationDirectory, "screenshots", `${label}-editor.png`),
      fullPage: false
    });
    console.log(`NORTH_STAR_DOCUMENT_METRIC ${JSON.stringify(metricRow)}`);
    expect(reviewMetrics.viewportWidth).toBe(width);
    expect(reviewMetrics.scrollWidth).toBeLessThanOrEqual(width + 1);
    expect(reviewMetrics.nestedScrollCount).toBe(0);
    expect(editorMetrics.scrollWidth).toBeLessThanOrEqual(width + 1);
    expect(editorMetrics.viewportGeometry.horizontalOverflow).toBe(0);
    expect(editorMetrics.viewportGeometry.nestedScrollContainers).toEqual([]);
    expect(editorMetrics.bodyOffset).toBeLessThanOrEqual(width === 391 ? 230 : 300);
    expect(editorMetrics.viewportGeometry.tooSmallTouchTargets).toEqual([]);
    expect(editorMetrics.viewportGeometry.clippedControls).toEqual([]);
    expect(editorMetrics.viewportGeometry.interactionOverlaps).toEqual([]);
    expect(editorMetrics.viewportGeometry.overlayOverlaps).toEqual([]);
    expect(editorMetrics.sectionOverlaps).toBe(0);
  }, 90_000);
});
