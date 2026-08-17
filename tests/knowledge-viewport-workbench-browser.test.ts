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
      disclosureCount: element.querySelectorAll("[data-knowledge-row] details").length,
      openDisclosureCount: element.querySelectorAll("[data-knowledge-row] details[open]").length
    })));
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
  expect(panels.find((panel) => panel.id === "references")?.disclosureCount).toBe(7);
  const technicalPanel = panels.find((panel) => panel.id === "technical");
  const referencesPanel = panels.find((panel) => panel.id === "references");
  if (!technicalPanel || !referencesPanel) throw new Error("Missing KOSHA reference panels");
  if (width === 390) {
    expect(technicalPanel.scrollHeight / technicalPanel.clientHeight).toBeLessThanOrEqual(6.1);
    expect(referencesPanel.scrollHeight / referencesPanel.clientHeight).toBeLessThanOrEqual(4.1);
  }

  const variant = `${width === 390 ? "mobile" : width === 1024 ? "tablet" : "desktop"}-${height}-${theme}`;
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
