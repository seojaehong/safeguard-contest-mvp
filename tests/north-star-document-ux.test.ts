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
// CI 는 빌드를 시험보다 먼저 한다(ci.yml). CI 에서 빌드가 없으면 skip 하지 않고 실패시킨다.
const requireProductionBuild = Boolean(process.env.CI);
const productionBrowserSuite = hasProductionBuild || requireProductionBuild ? describe : describe.skip;
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
  const deepReview = page.getByTestId("document-deep-review");
  const isOpen = await deepReview.evaluate((element) => (element as HTMLDetailsElement).open);
  if (!isOpen) {
    await deepReview.locator("> summary").click();
  }
  await page.locator(".document-preview-pane").waitFor({ state: "visible" });
}

productionBrowserSuite(productionBrowserSuiteName, () => {
  beforeAll(async () => {
    if (!hasProductionBuild) throw new Error("CI requires .next/BUILD_ID before this suite; run npm run build first");
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
        criteriaRevision: "2026-10-30-current-editor-geometry",
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
    const riskSelectors = page.getByTestId("risk-row-selector");
    expect(await riskSelectors.count()).toBeGreaterThanOrEqual(4);
    expect(await page.getByTestId("risk-row-editor-row").count()).toBe(1);
    const editedHazard = "이동식 비계 추락 위험 확인 — 합성 편집 시험";
    const hazardInput = page.getByTestId("risk-row-editor-row").getByRole("textbox", { name: /유해·위험요인/u });
    await hazardInput.fill(editedHazard);
    await riskSelectors.nth(1).click();
    expect(await page.getByTestId("risk-row-editor-row").count()).toBe(1);
    await riskSelectors.last().click();
    await expect.poll(() => riskSelectors.last().getAttribute("aria-selected")).toBe("true");
    await riskSelectors.first().click();
    await expect.poll(() => hazardInput.inputValue()).toBe(editedHazard);
    expect(await page.getByTestId("editor-provenance-appendices").count()).toBe(1);
    expect(await page.locator('select[aria-label="편집 문서 선택"] option').count()).toBe(12);
    const exactProvenanceSummaryCount = await page.locator("details > summary").evaluateAll((summaries) => (
      summaries.filter((summary) => /^근거 \d+건 · 확인 필요 \d+건$/u.test(summary.textContent?.trim() || "")).length
    ));
    expect(exactProvenanceSummaryCount).toBe(1);
    await editorDrawer.locator(":scope > summary").click();
    await page.locator('[data-testid="editor-evidence-panel"] .knowledge-link').waitFor({ state: "visible" });
    await page.evaluate(async () => {
      await document.fonts.ready;
      await new Promise<void>((resolve, reject) => {
        const timer = window.setTimeout(() => reject(new Error("Editor alignment did not settle")), 5_000);
        let previous = "";
        let stableSince = performance.now();
        const sample = () => {
          const key = JSON.stringify([window.scrollY, ...Array.from(document.querySelectorAll<HTMLElement>(".document-editor-surface, .field-workspace-editor-focus, .document-editor"))
            .flatMap((element) => [element.scrollTop, ...[element.getBoundingClientRect().x, element.getBoundingClientRect().y, element.getBoundingClientRect().height].map((value) => Math.round(value))])]);
          if (key !== previous) { previous = key; stableSince = performance.now(); }
          // WorkpackEditor realigns after 80/240ms and after web fonts load.
          if (performance.now() - stableSince >= 300) { window.clearTimeout(timer); resolve(); }
          else window.requestAnimationFrame(sample);
        };
        window.requestAnimationFrame(sample);
      });
    });

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
      const paintedRect = (element: HTMLElement) => {
        const rect = element.getBoundingClientRect();
        let left = Math.max(0, rect.left);
        let right = Math.min(window.innerWidth, rect.right);
        let top = Math.max(0, rect.top);
        let bottom = Math.min(window.innerHeight, rect.bottom);
        let ancestor = element.parentElement;
        while (ancestor && ancestor !== document.body) {
          const parentStyle = getComputedStyle(ancestor);
          const parentRect = ancestor.getBoundingClientRect();
          if (/^(?:hidden|clip|auto|scroll)$/u.test(parentStyle.overflowX)) {
            left = Math.max(left, parentRect.left);
            right = Math.min(right, parentRect.right);
          }
          if (/^(?:hidden|clip|auto|scroll)$/u.test(parentStyle.overflowY)) {
            top = Math.max(top, parentRect.top);
            bottom = Math.min(bottom, parentRect.bottom);
          }
          ancestor = ancestor.parentElement;
        }
        return { left, right, top, bottom };
      };
      const isVisible = (element: HTMLElement) => {
        const style = getComputedStyle(element);
        const rect = element.getBoundingClientRect();
        const painted = paintedRect(element);
        return !isInsideClosedDetails(element)
          && element.getClientRects().length > 0
          && style.display !== "none"
          && style.visibility !== "hidden"
          && Number.parseFloat(style.opacity) > 0
          && painted.right > painted.left && painted.bottom > painted.top
          && rect.right > 0
          && rect.left < window.innerWidth
          && rect.bottom > 0
          && rect.top < window.innerHeight;
      };
      const visibleTouchTargets = Array.from(surface.querySelectorAll<HTMLElement>(
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
          const firstRect = paintedRect(first);
          elements.slice(firstIndex + 1).forEach((second) => {
            if (first.contains(second) || second.contains(first)) return;
            const secondRect = paintedRect(second);
            const overlapWidth = Math.min(firstRect.right, secondRect.right) - Math.max(firstRect.left, secondRect.left);
            const overlapHeight = Math.min(firstRect.bottom, secondRect.bottom) - Math.max(firstRect.top, secondRect.top);
            if (overlapWidth > 1 && overlapHeight > 1) {
              pairs.push(`${targetLabel(first)} <> ${targetLabel(second)}`);
            }
          });
        });
        return pairs;
      };
      const probes = [document.createElement("button"), document.createElement("button")];
      for (const probe of probes) {
        Object.assign(probe.style, { position: "fixed", left: "16px", top: "200px", width: "50px", height: "50px", padding: "0", margin: "0" });
        document.body.append(probe);
      }
      const overlapCanaryCount = findOverlapPairs(probes).length;
      probes.forEach((probe) => probe.remove());
      const positionedTargets = Array.from(document.querySelectorAll<HTMLElement>("body *"))
        .filter((element) => {
          const position = getComputedStyle(element).position;
          return (position === "fixed" || position === "sticky") && isVisible(element);
        });
      const interactionOverlaps = findOverlapPairs(visibleTouchTargets);
      const overlayOverlaps = positionedTargets.flatMap((overlay) => visibleTouchTargets
        .filter((control) => !overlay.contains(control) && !control.contains(overlay))
        .filter((control) => {
          const overlayRect = paintedRect(overlay);
          const controlRect = paintedRect(control);
          const overlapWidth = Math.min(overlayRect.right, controlRect.right) - Math.max(overlayRect.left, controlRect.left);
          const overlapHeight = Math.min(overlayRect.bottom, controlRect.bottom) - Math.max(overlayRect.top, controlRect.top);
          return overlapWidth > 1 && overlapHeight > 1;
        })
        .map((control) => `${targetLabel(overlay)} <> ${targetLabel(control)}`));
      const clippedControls = visibleTouchTargets.filter((element) => {
        const rect = element.getBoundingClientRect();
        let left = rect.left;
        let right = rect.right;
        let top = rect.top;
        let bottom = rect.bottom;
        let ancestor = element.parentElement;
        while (ancestor && ancestor !== document.body) {
          const style = getComputedStyle(ancestor);
          if (/^(?:hidden|clip)$/u.test(style.overflowX) || /^(?:hidden|clip)$/u.test(style.overflowY)) {
            const ancestorRect = ancestor.getBoundingClientRect();
            if (
              (/^(?:hidden|clip)$/u.test(style.overflowX) && (left < ancestorRect.left - 1 || right > ancestorRect.right + 1))
              || (/^(?:hidden|clip)$/u.test(style.overflowY) && (top < ancestorRect.top - 1 || bottom > ancestorRect.bottom + 1))
            ) return true;
          }
          const bounds = ancestor.getBoundingClientRect();
          if (/^(?:auto|scroll)$/u.test(style.overflowX)) { left = Math.max(left, bounds.left); right = Math.min(right, bounds.right); }
          if (/^(?:auto|scroll)$/u.test(style.overflowY)) { top = Math.max(top, bounds.top); bottom = Math.min(bottom, bounds.bottom); }
          ancestor = ancestor.parentElement;
        }
        return false;
      }).map(targetLabel);
      const sectionTextareas = Array.from(structured.querySelectorAll<HTMLElement>("textarea"))
        .filter(isVisible);
      const sectionOverlaps = sectionTextareas.slice(1).filter((element, index) => {
        const previous = sectionTextareas[index];
        return previous.getBoundingClientRect().bottom > element.getBoundingClientRect().top + 0.5;
      }).length;
      const verticalScrollOwners = Array.from(surface.querySelectorAll<HTMLElement>("*"))
        .filter((element) => {
          const style = getComputedStyle(element);
          return isVisible(element)
            && /^(?:auto|scroll)$/u.test(style.overflowY)
            && element.scrollHeight > element.clientHeight + 1;
        });
      // Independent columns may scroll. A scroll owner inside another vertical owner is a trap.
      const nestedScrollContainers = verticalScrollOwners
        .filter((element) => verticalScrollOwners.some((ancestor) => ancestor !== element && ancestor.contains(element)))
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
          scope: "document-editor-surface",
          scrollPolicy: "independent columns allowed; nested vertical owners rejected",
          documentedExcludedPairs: [],
          ignoredNonPairs: ["ancestor-descendant", "closed-details-content", "outside-current-viewport"]
        },
        viewportGeometry,
        visibleControlCount: visibleTouchTargets.length,
        layoutBoxes: [".workspace-canvas", ".workpack-shell", ".document-editor", ".editor-operations-disclosure", ".workspace-rail"].map((selector) => {
          const element = surface.querySelector<HTMLElement>(selector);
          if (!element) return null;
          const style = getComputedStyle(element);
          const rect = element.getBoundingClientRect();
          return { selector, x: rect.x, y: rect.y, width: rect.width, height: rect.height, minHeight: style.minHeight,
            maxHeight: style.maxHeight, gridRow: style.gridRow, rows: style.gridTemplateRows, scrollHeight: element.scrollHeight };
        }),
        overlapCanaryCount,
        clippingEvidence: visibleTouchTargets.filter((element) => clippedControls.includes(targetLabel(element))).map((element) => {
          const parents: Array<{ className: string; x: number; y: number; width: number; height: number; overflowX: string; overflowY: string }> = [];
          let ancestor = element.parentElement;
          while (ancestor && ancestor !== document.body) {
            const style = getComputedStyle(ancestor);
            if (/(?:hidden|clip)/u.test(`${style.overflowX} ${style.overflowY}`)) parents.push({ className: ancestor.className,
              x: ancestor.getBoundingClientRect().x, y: ancestor.getBoundingClientRect().y,
              width: ancestor.getBoundingClientRect().width, height: ancestor.getBoundingClientRect().height, overflowX: style.overflowX, overflowY: style.overflowY });
            ancestor = ancestor.parentElement;
          }
          const rect = element.getBoundingClientRect();
          return { label: targetLabel(element), x: rect.x, y: rect.y, width: rect.width, height: rect.height, parents };
        }),
        scrollOwners: verticalScrollOwners.map((element) => ({ label: targetLabel(element), className: element.className,
          maxHeight: getComputedStyle(element).maxHeight, height: element.clientHeight, scrollHeight: element.scrollHeight,
          parents: verticalScrollOwners.filter((ancestor) => ancestor !== element && ancestor.contains(element)).map(targetLabel) })),
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
    expect(editorMetrics.overlapCanaryCount).toBe(1);
    expect(editorMetrics.visibleControlCount).toBeGreaterThan(0);
    expect(editorMetrics.viewportGeometry.nestedScrollContainers).toEqual([]);
    expect(editorMetrics.bodyOffset).toBeLessThanOrEqual(width === 391 ? 230 : 300);
    expect(editorMetrics.viewportGeometry.tooSmallTouchTargets).toEqual([]);
    expect(editorMetrics.viewportGeometry.clippedControls).toEqual([]);
    expect(editorMetrics.viewportGeometry.interactionOverlaps).toEqual([]);
    expect(editorMetrics.viewportGeometry.overlayOverlaps).toEqual([]);
    expect(editorMetrics.sectionOverlaps).toBe(0);
    await page.getByRole("button", { name: "문서 검토로 돌아가기", exact: true }).click();
    await page.getByTestId("document-deep-review").waitFor({ state: "visible" });
  }, 90_000);
});
