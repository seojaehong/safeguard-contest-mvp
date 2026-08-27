import fs from "node:fs";
import path from "node:path";
import { chromium, type Page } from "playwright";
import { describe, expect, it } from "vitest";

const baseUrl = process.env.KNOWLEDGE_BASE_URL;
const artifactDirectory = path.resolve(
  __dirname,
  "..",
  "evaluation",
  "knowledge-viewport-workbench-2026-08-17"
);
const taskRailArtifactDirectory = path.resolve(
  __dirname,
  "..",
  "evaluation",
  "knowledge-mobile-task-rail-2026-08-27"
);

const sections = [
  { id: "today", label: "오늘" },
  { id: "technical", label: "기술 지원" },
  { id: "references", label: "참고자료" },
  { id: "wiki", label: "위키" },
  { id: "governance", label: "검토 흐름" },
  { id: "diagnostics", label: "진단" }
] as const;

type PanelMetric = {
  id: string;
  clientHeight: number;
  scrollHeight: number;
  overflowY: string;
  disclosureCount: number;
  openDisclosureCount: number;
};

type BrowserMetric = {
  variant: string;
  viewport: { width: number; height: number };
  bodyHeight: number;
  bodyRatio: number;
  horizontalOverflow: number;
  outsideElementCount: number;
  visiblePanelCount: number;
  reachableSectionCount: number;
  minimumControlHeight: number;
  panelTop: number;
  panelBottom: number;
  firstDisclosureTop: number;
  firstDisclosureBottom: number;
  localScrollPanelCount: number;
  maximumPanelScrollRatio: number;
  panels: PanelMetric[];
};

async function auditVariant(
  page: Page,
  theme: "day" | "night",
  viewport: { width: 1440 | 1024 | 390; height: 723 | 844 | 900 | 1000 }
): Promise<BrowserMetric> {
  const { width, height } = viewport;
  const variant = `${width === 390 ? "mobile" : width === 1024 ? "tablet" : "desktop"}-${height}-${theme}`;
  await page.setViewportSize(viewport);
  await page.goto(`${baseUrl}/knowledge?theme=${theme}`, { waitUntil: "networkidle" });
  await page.locator('[data-knowledge-surface] [data-enhanced="true"]').waitFor();

  const panels: PanelMetric[] = [];
  for (const section of sections) {
    const tab = page.getByRole("tab", { name: section.label });
    await tab.click();
    await expect.poll(() => tab.getAttribute("aria-selected")).toBe("true");
    const panel = page.locator(`[data-knowledge-panel="${section.id}"]`);
    await expect.poll(() => panel.isVisible()).toBe(true);
    expect(await page.locator('[role="tabpanel"]:visible').count()).toBe(1);
    panels.push(await panel.evaluate((element) => ({
      id: element.dataset.knowledgePanel || "missing",
      clientHeight: element.clientHeight,
      scrollHeight: element.scrollHeight,
      overflowY: window.getComputedStyle(element).overflowY,
      disclosureCount: element.querySelectorAll("[data-knowledge-progressive-disclosure]").length,
      openDisclosureCount: element.querySelectorAll("[data-knowledge-progressive-disclosure][open]").length
    })));
  }

  for (const sectionId of ["wiki", "governance"] as const) {
    const section = sections.find((item) => item.id === sectionId);
    if (!section) throw new Error(`Missing ${sectionId} section definition`);
    const tab = page.getByRole("tab", { name: section.label });
    await tab.click();
    const panel = page.locator(`[data-knowledge-panel="${sectionId}"]`);
    const disclosures = panel.locator("[data-knowledge-progressive-disclosure]");
    expect(await disclosures.count()).toBe(2);
    await disclosures.nth(0).locator("summary").click();
    await expect.poll(() => disclosures.nth(0).getAttribute("open")).not.toBeNull();
    await expect.poll(() => disclosures.nth(1).getAttribute("open")).toBeNull();
    await disclosures.nth(1).locator("summary").click();
    await expect.poll(() => disclosures.nth(0).getAttribute("open")).toBeNull();
    await expect.poll(() => disclosures.nth(1).getAttribute("open")).not.toBeNull();
    await disclosures.nth(1).locator("summary").click();
    await expect.poll(() => disclosures.nth(1).getAttribute("open")).toBeNull();
    await panel.evaluate((element) => { element.scrollTop = 0; });
    if (sectionId === "governance" && width === 390) {
      const state = panel.locator("[data-knowledge-review-state]");
      await state.waitFor();
      const stateGeometry = await state.evaluate((element) => {
        const panelElement = element.closest<HTMLElement>('[data-knowledge-panel="governance"]');
        if (!panelElement) throw new Error("Missing governance panel");
        const panelRect = panelElement.getBoundingClientRect();
        const stateRect = element.getBoundingClientRect();
        return { panelTop: panelRect.top, panelBottom: panelRect.bottom, stateTop: stateRect.top, stateBottom: stateRect.bottom };
      });
      expect(stateGeometry.stateTop).toBeGreaterThanOrEqual(stateGeometry.panelTop);
      expect(stateGeometry.stateBottom).toBeLessThanOrEqual(stateGeometry.panelBottom);
    }
    if (height === 723) {
      await page.screenshot({ path: path.join(artifactDirectory, `${variant}-${sectionId}.png`), fullPage: true });
    }
  }

  const technicalTab = page.getByRole("tab", { name: "기술 지원" });
  await technicalTab.click();
  await expect.poll(() => technicalTab.getAttribute("aria-selected")).toBe("true");

  const geometry = await page.evaluate(() => {
    const visible = (element: Element) => {
      const style = window.getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return style.display !== "none" && style.visibility !== "hidden" && rect.width > 0 && rect.height > 0;
    };
    const root = document.querySelector<HTMLElement>('[data-knowledge-surface]');
    const activePanel = document.querySelector<HTMLElement>('[data-knowledge-panel="technical"]');
    if (!root || !activePanel) throw new Error("Missing knowledge workbench geometry targets");
    const controls = [...root.querySelectorAll<HTMLElement>('button, input, select, summary, a')].filter(visible);
    const outsideElements = [...root.querySelectorAll<HTMLElement>("*")]
      .filter(visible)
      .filter((element) => {
        const rect = element.getBoundingClientRect();
        return rect.left < -0.5 || rect.right > window.innerWidth + 0.5;
      });
    const panelRect = activePanel.getBoundingClientRect();
    const firstDisclosure = activePanel.querySelector<HTMLElement>("[data-knowledge-row] details > summary");
    if (!firstDisclosure) throw new Error("Missing first KOSHA disclosure");
    const firstDisclosureRect = firstDisclosure.getBoundingClientRect();
    return {
      bodyHeight: document.documentElement.scrollHeight,
      horizontalOverflow: Math.max(document.documentElement.scrollWidth - document.documentElement.clientWidth, 0),
      outsideElementCount: outsideElements.length,
      visiblePanelCount: [...root.querySelectorAll<HTMLElement>('[role="tabpanel"]')].filter(visible).length,
      minimumControlHeight: controls.length
        ? Math.min(...controls.map((element) => element.getBoundingClientRect().height))
        : 0,
      panelTop: panelRect.top,
      panelBottom: panelRect.bottom,
      firstDisclosureTop: firstDisclosureRect.top,
      firstDisclosureBottom: firstDisclosureRect.bottom
    };
  });

  const maximumBodyHeight = width === 1024
    ? Math.round(height * 1.1)
    : width === 390
      ? Math.ceil(height * 1.02)
      : height + 8;
  expect(geometry.bodyHeight).toBeLessThanOrEqual(maximumBodyHeight);
  expect(geometry.horizontalOverflow).toBe(0);
  if (width === 390) expect(geometry.outsideElementCount).toBe(0);
  expect(geometry.visiblePanelCount).toBe(1);
  expect(geometry.minimumControlHeight).toBeGreaterThanOrEqual(44);
  expect(geometry.panelTop).toBeGreaterThanOrEqual(0);
  expect(geometry.panelBottom).toBeLessThanOrEqual(height + 1);
  expect(geometry.firstDisclosureTop).toBeGreaterThanOrEqual(geometry.panelTop);
  expect(geometry.firstDisclosureBottom).toBeLessThanOrEqual(geometry.panelBottom);
  expect(panels).toHaveLength(6);
  expect(panels.every((panel) => panel.overflowY === "auto")).toBe(true);
  expect(panels.some((panel) => panel.scrollHeight > panel.clientHeight)).toBe(true);
  expect(panels.every((panel) => panel.openDisclosureCount === 0)).toBe(true);
  expect(panels.find((panel) => panel.id === "technical")?.disclosureCount).toBe(6);
  expect(panels.find((panel) => panel.id === "references")?.disclosureCount).toBe(7);
  expect(panels.find((panel) => panel.id === "wiki")?.disclosureCount).toBe(2);
  expect(panels.find((panel) => panel.id === "governance")?.disclosureCount).toBe(2);
  const technicalPanel = panels.find((panel) => panel.id === "technical");
  const referencesPanel = panels.find((panel) => panel.id === "references");
  const wikiPanel = panels.find((panel) => panel.id === "wiki");
  const governancePanel = panels.find((panel) => panel.id === "governance");
  if (!technicalPanel || !referencesPanel || !wikiPanel || !governancePanel) throw new Error("Missing Knowledge panels");
  if (width === 390) {
    expect(technicalPanel.scrollHeight / technicalPanel.clientHeight).toBeLessThanOrEqual(6.1);
    expect(referencesPanel.scrollHeight / referencesPanel.clientHeight).toBeLessThanOrEqual(4.1);
    expect(wikiPanel.scrollHeight / wikiPanel.clientHeight).toBeLessThanOrEqual(4.1);
    expect(governancePanel.scrollHeight / governancePanel.clientHeight).toBeLessThanOrEqual(5.5);
  }

  await page.screenshot({ path: path.join(artifactDirectory, `${variant}.png`), fullPage: true });
  return {
    variant,
    viewport,
    bodyHeight: geometry.bodyHeight,
    bodyRatio: Math.round((geometry.bodyHeight / height) * 100) / 100,
    horizontalOverflow: geometry.horizontalOverflow,
    outsideElementCount: geometry.outsideElementCount,
    visiblePanelCount: geometry.visiblePanelCount,
    reachableSectionCount: panels.length,
    minimumControlHeight: Math.round(geometry.minimumControlHeight * 100) / 100,
    panelTop: Math.round(geometry.panelTop * 100) / 100,
    panelBottom: Math.round(geometry.panelBottom * 100) / 100,
    firstDisclosureTop: Math.round(geometry.firstDisclosureTop * 100) / 100,
    firstDisclosureBottom: Math.round(geometry.firstDisclosureBottom * 100) / 100,
    localScrollPanelCount: panels.filter((panel) => panel.scrollHeight > panel.clientHeight).length,
    maximumPanelScrollRatio: Math.max(...panels.map((panel) => (
      Math.round((panel.scrollHeight / Math.max(panel.clientHeight, 1)) * 100) / 100
    ))),
    panels
  };
}

describe.skipIf(!baseUrl)("knowledge viewport workbench production browser contract", () => {
  it("keeps the 390px task selector on one horizontal rail and reveals hash-selected tabs", async () => {
    fs.mkdirSync(taskRailArtifactDirectory, { recursive: true });
    const browser = await chromium.launch({ headless: true });
    try {
      const results = [];
      for (const theme of ["day", "night"] as const) {
        for (const target of [
          { id: "wiki", label: "위키", hash: "#wiki-index-heading" },
          { id: "governance", label: "검토 흐름", hash: "#knowledge-review-inbox-heading" },
        ] as const) {
          const page = await browser.newPage({ viewport: { width: 390, height: 723 } });
          try {
            await page.goto(`${baseUrl}/knowledge?theme=${theme}${target.hash}`, { waitUntil: "networkidle" });
            const root = page.locator('[data-knowledge-surface] [data-enhanced="true"]');
            await root.waitFor();
            const selectedTab = page.getByRole("tab", { name: target.label });
            await expect.poll(() => selectedTab.getAttribute("aria-selected")).toBe("true");
            const metrics = await page.evaluate(({ targetId, requestedTheme }) => {
              const tabList = document.querySelector<HTMLElement>('[role="tablist"][aria-label="지식 DB 작업 보기"]');
              const selected = document.querySelector<HTMLElement>('[role="tab"][aria-selected="true"]');
              const panel = document.querySelector<HTMLElement>(`[data-knowledge-panel="${targetId}"]`);
              if (!tabList || !selected || !panel) throw new Error("Missing Knowledge task rail geometry");
              const railRect = tabList.getBoundingClientRect();
              const selectedRect = selected.getBoundingClientRect();
              const panelRect = panel.getBoundingClientRect();
              const tabs = [...tabList.querySelectorAll<HTMLElement>('[role="tab"]')];
              return {
                theme: requestedTheme,
                targetId,
                viewport: { width: window.innerWidth, height: window.innerHeight },
                documentHeight: document.documentElement.scrollHeight,
                horizontalOverflow: Math.max(document.documentElement.scrollWidth - document.documentElement.clientWidth, 0),
                railHeight: railRect.height,
                railClientWidth: tabList.clientWidth,
                railScrollWidth: tabList.scrollWidth,
                selectorCount: tabs.length,
                selectorRows: new Set(tabs.map((tab) => Math.round(tab.getBoundingClientRect().top))).size,
                selectorHeights: tabs.map((tab) => tab.getBoundingClientRect().height),
                selectedFullyVisible: selectedRect.left >= railRect.left - 0.5 && selectedRect.right <= railRect.right + 0.5,
                panelTop: panelRect.top,
                panelBottom: panelRect.bottom,
                panelClientHeight: panel.clientHeight,
                panelScrollHeight: panel.scrollHeight,
                panelOverflowY: window.getComputedStyle(panel).overflowY,
              };
            }, { targetId: target.id, requestedTheme: theme });
            expect(metrics.documentHeight).toBeLessThanOrEqual(733);
            expect(metrics.horizontalOverflow).toBe(0);
            expect(metrics.railHeight).toBeLessThanOrEqual(48);
            expect(metrics.railScrollWidth).toBeGreaterThan(metrics.railClientWidth);
            expect(metrics.selectorCount).toBe(6);
            expect(metrics.selectorRows).toBe(1);
            expect(metrics.selectorHeights.every((height) => height >= 44)).toBe(true);
            expect(metrics.selectedFullyVisible).toBe(true);
            expect(metrics.panelTop).toBeLessThanOrEqual(400);
            expect(metrics.panelBottom).toBeLessThanOrEqual(724);
            expect(metrics.panelOverflowY).toBe("auto");
            results.push(metrics);
            await page.screenshot({
              path: path.join(taskRailArtifactDirectory, `${theme}-${target.id}-390x723.png`),
              fullPage: true,
            });
          } finally {
            await page.close();
          }
        }
      }
      fs.writeFileSync(
        path.join(taskRailArtifactDirectory, "browser-metrics.json"),
        `${JSON.stringify({ source: baseUrl, generatedAt: new Date().toISOString(), results }, null, 2)}\n`,
        "utf8"
      );
    } finally {
      await browser.close();
    }
  }, 90_000);

  it("passes selected-only Day/Night desktop, tablet, and mobile geometry", async () => {
    fs.mkdirSync(artifactDirectory, { recursive: true });
    const browser = await chromium.launch({ headless: true });
    try {
      const metrics: BrowserMetric[] = [];
      for (const theme of ["day", "night"] as const) {
        for (const viewport of [
          { width: 1440, height: 723 },
          { width: 1440, height: 900 },
          { width: 1024, height: 1000 },
          { width: 390, height: 723 },
          { width: 390, height: 844 }
        ] as const) {
          const page = await browser.newPage({ viewport });
          try {
            metrics.push(await auditVariant(page, theme, viewport));
          } finally {
            await page.close();
          }
        }
      }
      fs.writeFileSync(
        path.join(artifactDirectory, "browser-metrics.json"),
        `${JSON.stringify({ source: baseUrl, generatedAt: new Date().toISOString(), metrics }, null, 2)}\n`,
        "utf8"
      );
    } finally {
      await browser.close();
    }
  }, 180_000);
});
