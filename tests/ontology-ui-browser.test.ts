import fs from "node:fs";
import path from "node:path";
import { chromium, type Page } from "playwright";
import { describe, expect, it } from "vitest";
import { assembleGraph } from "@/lib/ontology/graph-store";
import { SEED_EDGES, SEED_NODES } from "@/lib/ontology/seed/core-triples";

const baseUrl = process.env.ONTOLOGY_BASE_URL;
const artifactDirectory = path.resolve(__dirname, "..", "evaluation", "ontology-viewport-workbench-2026-08-17");

type BrowserMetric = {
  variant: string;
  viewport: { width: number; height: number };
  bodyHeight: number;
  bodyRatio: number;
  horizontalOverflow: number;
  outsideElementCount: number;
  visibleNeighborhoodNodes: number;
  overlapPairs: number;
  minimumControlHeight: number;
  minimumNodeContrast: number | null;
  minimumNodeTextContrast: number | null;
  desktopGraphVisible: boolean;
  mobileRelationsVisible: boolean;
  expandedGraphVerified: boolean;
  expandedGraphNodeCount: number;
  dialogKeyboardContract: boolean;
  explorerPane: { width: number; clientHeight: number; scrollHeight: number; overflowY: string };
  directoryPane: { width: number; clientHeight: number; scrollHeight: number; overflowY: string };
  mobileDirectoryPane: { width: number; clientHeight: number; scrollHeight: number; overflowY: string } | null;
  mobileTaskSwitchVerified: boolean;
};

function luminanceChannel(value: number) {
  const normalized = value / 255;
  return normalized <= 0.03928 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
}

function contrastRatio(foreground: number[], background: number[]) {
  const foregroundLuminance = 0.2126 * luminanceChannel(foreground[0])
    + 0.7152 * luminanceChannel(foreground[1])
    + 0.0722 * luminanceChannel(foreground[2]);
  const backgroundLuminance = 0.2126 * luminanceChannel(background[0])
    + 0.7152 * luminanceChannel(background[1])
    + 0.0722 * luminanceChannel(background[2]);
  const lighter = Math.max(foregroundLuminance, backgroundLuminance);
  const darker = Math.min(foregroundLuminance, backgroundLuminance);
  return (lighter + 0.05) / (darker + 0.05);
}

async function auditVariant(
  page: Page,
  theme: "day" | "night",
  viewport: { width: 1440 | 1024 | 390; height: 723 | 844 | 900 | 1000 }
): Promise<BrowserMetric> {
  const { width, height } = viewport;
  await page.setViewportSize({ width, height });
  await page.goto(`${baseUrl}/ontology?theme=${theme}`, { waitUntil: "networkidle" });
  await page.locator('[data-module-route="/ontology"][data-ready="true"]').waitFor();

  const desktopGraph = page.locator('[data-testid="ontology-neighborhood-graph"]').first();
  const mobileRelations = page.locator('[data-testid="ontology-mobile-relations"]');
  const desktopGraphVisible = await desktopGraph.isVisible();
  let mobileRelationsVisible = await mobileRelations.isVisible();
  let expandedGraphVerified = false;
  let expandedGraphNodeCount = 0;
  let dialogKeyboardContract = false;
  let mobileTaskSwitchVerified = false;
  let mobileDirectoryPane: BrowserMetric["mobileDirectoryPane"] = null;
  let expandedNodeContrasts: Array<{ foreground: number[]; background: number[] }> = [];
  let expandedNodeTextContrasts: Array<{ foreground: number[]; background: number[] }> = [];

  await page.getByRole("button", { name: "확장 관계" }).click();

  if (width === 390) {
    expect(desktopGraphVisible).toBe(false);
    await mobileRelations.scrollIntoViewIfNeeded();
    mobileRelationsVisible = await mobileRelations.isVisible();
    expect(mobileRelationsVisible).toBe(true);
    const trigger = page.getByRole("button", { name: "그래프 전체 화면" });
    await trigger.scrollIntoViewIfNeeded();
    await trigger.click();
    const dialog = page.getByRole("dialog", { name: "온톨로지 그래프 전체 화면" });
    await dialog.waitFor();
    expandedGraphVerified = await dialog.isVisible();
    const expandedContrasts = await dialog.locator('[data-testid="ontology-neighborhood-node"]').evaluateAll((nodes) => {
      const visible = (element: Element) => {
        const style = window.getComputedStyle(element);
        const rect = element.getBoundingClientRect();
        return style.display !== "none" && style.visibility !== "hidden" && rect.width > 0 && rect.height > 0;
      };
      const parseRgb = (value: string) => {
        const channels = (value.match(/[\d.]+/g) || []).slice(0, 3).map(Number);
        return value.startsWith("color(srgb")
          ? channels.map((channel) => channel * 255)
          : channels;
      };
      const visibleNodes = nodes.filter(visible);
      return {
        visibleNodeCount: visibleNodes.length,
        nodes: visibleNodes.map((node) => ({
          foreground: parseRgb(window.getComputedStyle(node).color),
          background: parseRgb(window.getComputedStyle(node).backgroundColor)
        })),
        text: visibleNodes.flatMap((node) => {
          const background = parseRgb(window.getComputedStyle(node).backgroundColor);
          return [...node.querySelectorAll<HTMLElement>('span, strong, small')]
            .filter(visible)
            .map((element) => ({ foreground: parseRgb(window.getComputedStyle(element).color), background }));
        })
      };
    });
    expandedGraphNodeCount = expandedContrasts.visibleNodeCount;
    expandedNodeContrasts = expandedContrasts.nodes;
    expandedNodeTextContrasts = expandedContrasts.text;
    expect(await page.evaluate(() => document.activeElement?.textContent?.trim())).toBe("닫기");
    await page.keyboard.press("Shift+Tab");
    const shiftTabStayedInside = await dialog.evaluate((element) => element.contains(document.activeElement));
    await page.keyboard.press("Tab");
    expect(await page.evaluate(() => document.activeElement?.textContent?.trim())).toBe("닫기");
    await page.keyboard.press("Escape");
    expect(await trigger.evaluate((element) => element === document.activeElement)).toBe(true);
    dialogKeyboardContract = shiftTabStayedInside;

    const explorerPanel = page.locator("#ontology-explorer-panel");
    const directoryPanel = page.locator("#ontology-directory-panel");
    await page.getByRole("button", { name: "전체 목록" }).click();
    expect(await explorerPanel.isVisible()).toBe(false);
    expect(await directoryPanel.isVisible()).toBe(true);
    mobileDirectoryPane = await directoryPanel.evaluate((element) => ({
      width: element.getBoundingClientRect().width,
      clientHeight: element.clientHeight,
      scrollHeight: element.scrollHeight,
      overflowY: window.getComputedStyle(element).overflowY
    }));
    await page.screenshot({ path: path.join(artifactDirectory, `mobile-${height}-${theme}-directory.png`), fullPage: true });
    await directoryPanel.getByRole("button").first().click();
    expect(await explorerPanel.isVisible()).toBe(true);
    expect(await directoryPanel.isVisible()).toBe(false);
    expect(await explorerPanel.evaluate((element) => element.scrollTop)).toBe(0);
    mobileTaskSwitchVerified = true;
  } else {
    expect(desktopGraphVisible).toBe(true);
    expect(mobileRelationsVisible).toBe(false);
  }

  const geometry = await page.evaluate(() => {
    const visible = (element: Element) => {
      const style = window.getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return style.display !== "none" && style.visibility !== "hidden" && rect.width > 0 && rect.height > 0;
    };
    const nodes = [...document.querySelectorAll<HTMLElement>('[data-testid="ontology-neighborhood-node"]')]
      .filter(visible)
      .map((element) => element.getBoundingClientRect());
    let overlapPairs = 0;
    for (let left = 0; left < nodes.length; left += 1) {
      for (let right = left + 1; right < nodes.length; right += 1) {
        const overlapX = Math.min(nodes[left].right, nodes[right].right) - Math.max(nodes[left].left, nodes[right].left);
        const overlapY = Math.min(nodes[left].bottom, nodes[right].bottom) - Math.max(nodes[left].top, nodes[right].top);
        if (overlapX > 0 && overlapY > 0) overlapPairs += 1;
      }
    }
    const controls = [...document.querySelectorAll<HTMLElement>(
      '[data-testid="ontology-explorer-root"] button, [data-testid="ontology-explorer-root"] input, [data-testid="ontology-explorer-root"] select, [data-testid="ontology-explorer-root"] summary, [data-testid="ontology-explorer-root"] a'
    )].filter(visible);
    const minimumControlHeight = controls.length
      ? Math.min(...controls.map((element) => element.getBoundingClientRect().height))
      : 0;
    const parseRgb = (value: string) => {
      const channels = (value.match(/[\d.]+/g) || []).slice(0, 3).map(Number);
      return value.startsWith("color(srgb")
        ? channels.map((channel) => channel * 255)
        : channels;
    };
    const nodeElements = [...document.querySelectorAll<HTMLElement>('[data-testid="ontology-neighborhood-node"]')]
      .filter(visible)
    const nodeContrasts = nodeElements.map((element) => {
        const style = window.getComputedStyle(element);
        return { foreground: parseRgb(style.color), background: parseRgb(style.backgroundColor) };
      });
    const nodeTextContrasts = nodeElements.flatMap((node) => {
      const nodeBackground = parseRgb(window.getComputedStyle(node).backgroundColor);
      return [...node.querySelectorAll<HTMLElement>('span, strong, small')]
        .filter(visible)
        .map((element) => ({
          foreground: parseRgb(window.getComputedStyle(element).color),
          background: nodeBackground
        }));
    });
    const outsideElements = [...document.querySelectorAll<HTMLElement>('[data-testid="ontology-explorer-root"] *')]
      .filter(visible)
      .filter((element) => {
        const rect = element.getBoundingClientRect();
        return rect.left < -0.5 || rect.right > window.innerWidth + 0.5;
      });
    const pane = (selector: string) => {
      const element = document.querySelector<HTMLElement>(selector);
      if (!element) return { width: 0, clientHeight: 0, scrollHeight: 0, overflowY: "missing" };
      return {
        width: element.getBoundingClientRect().width,
        clientHeight: element.clientHeight,
        scrollHeight: element.scrollHeight,
        overflowY: window.getComputedStyle(element).overflowY
      };
    };
    return {
      bodyHeight: document.documentElement.scrollHeight,
      horizontalOverflow: Math.max(document.documentElement.scrollWidth - document.documentElement.clientWidth, 0),
      outsideElementCount: outsideElements.length,
      visibleNeighborhoodNodes: nodes.length,
      overlapPairs,
      minimumControlHeight,
      nodeContrasts,
      nodeTextContrasts,
      explorerPane: pane("#ontology-explorer-panel"),
      directoryPane: pane("#ontology-directory-panel")
    };
  });
  const allNodeContrasts = [...geometry.nodeContrasts, ...expandedNodeContrasts];
  const allNodeTextContrasts = [...geometry.nodeTextContrasts, ...expandedNodeTextContrasts];
  const minimumNodeContrast = allNodeContrasts.length
    ? Math.min(...allNodeContrasts.map(({ foreground, background }) => contrastRatio(foreground, background)))
    : null;
  const minimumNodeTextContrast = allNodeTextContrasts.length
    ? Math.min(...allNodeTextContrasts.map(({ foreground, background }) => contrastRatio(foreground, background)))
    : null;

  expect(geometry.horizontalOverflow).toBe(0);
  const maximumBodyHeight = width === 1024 ? Math.round(height * 1.1) : height;
  expect(geometry.bodyHeight).toBeLessThanOrEqual(maximumBodyHeight);
  if (width === 390) expect(geometry.outsideElementCount).toBe(0);
  expect(geometry.overlapPairs).toBe(0);
  if (width !== 390) expect(geometry.visibleNeighborhoodNodes).toBe(15);
  if (width === 390) expect(expandedGraphNodeCount).toBe(15);
  expect(geometry.minimumControlHeight).toBeGreaterThanOrEqual(44);
  expect(geometry.explorerPane.overflowY).toBe("auto");
  if (width !== 390) expect(geometry.directoryPane.overflowY).toBe("auto");
  expect(minimumNodeContrast).not.toBeNull();
  expect(minimumNodeTextContrast).not.toBeNull();
  if (minimumNodeContrast !== null) expect(minimumNodeContrast).toBeGreaterThanOrEqual(4.5);
  if (minimumNodeTextContrast !== null) expect(minimumNodeTextContrast).toBeGreaterThanOrEqual(4.5);

  const variant = `${width === 390 ? "mobile" : width === 1024 ? "tablet" : "desktop"}-${height}-${theme}`;
  await page.screenshot({ path: path.join(artifactDirectory, `${variant}.png`), fullPage: true });
  return {
    variant,
    viewport: { width, height },
    bodyHeight: geometry.bodyHeight,
    bodyRatio: Math.round((geometry.bodyHeight / height) * 100) / 100,
    horizontalOverflow: geometry.horizontalOverflow,
    outsideElementCount: geometry.outsideElementCount,
    visibleNeighborhoodNodes: geometry.visibleNeighborhoodNodes,
    overlapPairs: geometry.overlapPairs,
    minimumControlHeight: Math.round(geometry.minimumControlHeight * 100) / 100,
    minimumNodeContrast: minimumNodeContrast === null ? null : Math.round(minimumNodeContrast * 100) / 100,
    minimumNodeTextContrast: minimumNodeTextContrast === null ? null : Math.round(minimumNodeTextContrast * 100) / 100,
    desktopGraphVisible,
    mobileRelationsVisible,
    expandedGraphVerified,
    expandedGraphNodeCount,
    dialogKeyboardContract,
    explorerPane: geometry.explorerPane,
    directoryPane: geometry.directoryPane,
    mobileDirectoryPane,
    mobileTaskSwitchVerified
  };
}

describe.skipIf(!baseUrl)("ontology UI production browser contract", () => {
  it("promotes only a validated live graph and preserves fallback for malformed payloads", async () => {
    const browser = await chromium.launch({ headless: true });
    try {
      const published = (value: unknown) => (
        typeof value === "object"
        && value !== null
        && !Array.isArray(value)
        && (value as Record<string, unknown>).review_state === "published"
      );
      const graph = assembleGraph(SEED_NODES.filter(published), SEED_EDGES.filter(published));
      const livePage = await browser.newPage({ viewport: { width: 1440, height: 723 } });
      await livePage.route("**/api/ontology/graph", async (route) => route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({ ok: true, configured: true, scope: "published", graph, message: "live fixture" }),
      }));
      await livePage.goto(`${baseUrl}/ontology?theme=day`, { waitUntil: "networkidle" });
      await expect(livePage.locator(".safeclaw-module-status.live").textContent()).resolves.toContain("바로 사용");
      await expect(livePage.locator('[data-testid="ontology-explorer-root"]').isVisible()).resolves.toBe(true);

      const fallbackPage = await browser.newPage({ viewport: { width: 1440, height: 723 } });
      await fallbackPage.route("**/api/ontology/graph", async (route) => route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({ ok: true, configured: true, scope: "published", graph: { nodes: "invalid" } }),
      }));
      await fallbackPage.goto(`${baseUrl}/ontology?theme=day`, { waitUntil: "networkidle" });
      await expect(fallbackPage.locator(".safeclaw-module-status.partial").textContent()).resolves.toContain("연결 확인");
      await expect(fallbackPage.locator('[data-testid="ontology-explorer-root"]').isVisible()).resolves.toBe(true);
    } finally {
      await browser.close();
    }
  }, 30_000);

  it("passes desktop and mobile Day/Night geometry and contrast gates", async () => {
    fs.mkdirSync(artifactDirectory, { recursive: true });
    const browser = await chromium.launch({ headless: true });
    try {
      const page = await browser.newPage();
      const metrics: BrowserMetric[] = [];
      for (const theme of ["day", "night"] as const) {
        metrics.push(await auditVariant(page, theme, { width: 1440, height: 723 }));
        metrics.push(await auditVariant(page, theme, { width: 1440, height: 900 }));
        metrics.push(await auditVariant(page, theme, { width: 1024, height: 1000 }));
        metrics.push(await auditVariant(page, theme, { width: 390, height: 723 }));
        metrics.push(await auditVariant(page, theme, { width: 390, height: 844 }));
      }
      fs.writeFileSync(
        path.join(artifactDirectory, "browser-metrics.json"),
        `${JSON.stringify({ source: baseUrl, generatedAt: new Date().toISOString(), metrics }, null, 2)}\n`,
        "utf8"
      );
    } finally {
      await browser.close();
    }
  }, 120_000);
});
