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

describe("North Star document cockpit and editor UX", () => {
  beforeAll(async () => {
    harness = await startIsolatedNextBrowserHarness({
      slug: "north-star-document-ux",
      initialPath: "/workspace",
      portSalt: 5921
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
            && /^(?:auto|scroll)$/u.test(style.overflowY)
            && element.scrollHeight > element.clientHeight + 1;
        })
        .length;
      return {
        viewportWidth: window.innerWidth,
        scrollWidth: document.documentElement.scrollWidth,
        nestedScrollCount: mobile ? nestedScrollCount : 0,
        drawerHeight: Math.round(document.querySelector<HTMLElement>('[data-testid="document-provenance-drawer"]')?.getBoundingClientRect().height || 0)
      };
    }, width === 391);

    await page.locator(".doc-card-actions button", { hasText: "편집" }).click();
    await page.getByTestId("document-structured-editor").waitFor({ state: "visible" });
    const editorDrawer = page.getByTestId("editor-provenance-drawer");
    await expect.poll(() => editorDrawer.locator(":scope > summary").textContent()).toMatch(/^근거 \d+건 · 확인 필요 \d+건$/u);
    expect(await page.getByTestId("document-structured-editor").getAttribute("data-editor-kind")).toBe("risk-assessment");
    expect(await page.locator('[data-section-kind="body"] .document-section-textarea').count()).toBeGreaterThanOrEqual(4);
    expect(await page.getByTestId("editor-provenance-appendices").count()).toBe(1);
    expect(await page.locator('select[aria-label="편집 문서 선택"] option').count()).toBe(12);
    const exactProvenanceSummaryCount = await page.locator("details > summary").evaluateAll((summaries) => (
      summaries.filter((summary) => /^근거 \d+건 · 확인 필요 \d+건$/u.test(summary.textContent?.trim() || "")).length
    ));
    expect(exactProvenanceSummaryCount).toBe(1);

    const editorMetrics = await page.evaluate((mobile) => {
      const surface = document.querySelector<HTMLElement>(".document-editor-surface");
      const body = document.querySelector<HTMLElement>('[data-testid="editor-document-body"]');
      const structured = document.querySelector<HTMLElement>('[data-testid="document-structured-editor"]');
      if (!surface || !body || !structured) throw new Error("Missing structured editor geometry target");
      const surfaceRect = surface.getBoundingClientRect();
      const bodyRect = body.getBoundingClientRect();
      const isInsideClosedDetails = (element: HTMLElement) => {
        let parent = element.parentElement;
        while (parent && parent !== surface) {
          if (parent instanceof HTMLDetailsElement && !parent.open) {
            const summary = parent.querySelector(":scope > summary");
            if (!summary?.contains(element)) return true;
          }
          parent = parent.parentElement;
        }
        return false;
      };
      const visibleTouchTargets = Array.from(
        surface.querySelectorAll<HTMLElement>('button, summary, select')
      ).filter((element) => (
        !isInsideClosedDetails(element)
        && element.getClientRects().length > 0
        && getComputedStyle(element).visibility !== "hidden"
      ));
      const tooSmallTouchTargets = mobile
        ? visibleTouchTargets
          .filter((element) => {
            const rect = element.getBoundingClientRect();
            return rect.width < 44 || rect.height < 44;
          })
          .map((element) => `${element.tagName}:${(element.textContent || element.getAttribute("aria-label") || "").trim().slice(0, 30)}`)
        : [];
      const sectionTextareas = Array.from(structured.querySelectorAll<HTMLElement>(".document-section-textarea"));
      const sectionOverlaps = sectionTextareas.slice(1).filter((element, index) => {
        const previous = sectionTextareas[index];
        return previous.getBoundingClientRect().bottom > element.getBoundingClientRect().top + 0.5;
      }).length;
      const nestedScrollCount = Array.from(surface.querySelectorAll<HTMLElement>("*"))
        .filter((element) => {
          const style = getComputedStyle(element);
          return !isInsideClosedDetails(element)
            && /^(?:auto|scroll)$/u.test(style.overflowY)
            && element.scrollHeight > element.clientHeight + 1;
        })
        .length;
      return {
        viewportWidth: window.innerWidth,
        viewportHeight: window.innerHeight,
        scrollWidth: document.documentElement.scrollWidth,
        bodyOffset: Math.round(bodyRect.top - surfaceRect.top),
        nestedScrollCount: mobile ? nestedScrollCount : 0,
        tooSmallTouchTargets,
        sectionOverlaps,
        sectionCount: sectionTextareas.length
      };
    }, width === 391);

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
    expect(editorMetrics.nestedScrollCount).toBe(0);
    expect(editorMetrics.bodyOffset).toBeLessThanOrEqual(width === 391 ? 230 : 300);
    expect(editorMetrics.tooSmallTouchTargets).toEqual([]);
    expect(editorMetrics.sectionOverlaps).toBe(0);
  }, 90_000);
});
