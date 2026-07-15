import fs from "node:fs";
import path from "node:path";
import { chromium, type Page } from "playwright";
import { describe, expect, it } from "vitest";

const baseUrl = process.env.ONTOLOGY_BASE_URL;
const artifactDirectory = path.resolve(__dirname, "..", "evaluation", "ontology-ui-remediation-2026-07-15");

type BrowserMetric = {
  variant: string;
  viewport: { width: number; height: number };
  horizontalOverflow: number;
  visibleNeighborhoodNodes: number;
  overlapPairs: number;
  minimumControlHeight: number;
  minimumNodeContrast: number | null;
  desktopGraphVisible: boolean;
  mobileRelationsVisible: boolean;
  expandedGraphVerified: boolean;
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

async function auditVariant(page: Page, theme: "day" | "night", width: 1440 | 390): Promise<BrowserMetric> {
  const height = width === 390 ? 844 : 1000;
  await page.setViewportSize({ width, height });
  await page.goto(`${baseUrl}/ontology?theme=${theme}`, { waitUntil: "networkidle" });
  await page.locator('[data-module-route="/ontology"][data-ready="true"]').waitFor();

  const desktopGraph = page.locator('[data-testid="ontology-neighborhood-graph"]').first();
  const mobileRelations = page.locator('[data-testid="ontology-mobile-relations"]');
  const desktopGraphVisible = await desktopGraph.isVisible();
  const mobileRelationsVisible = await mobileRelations.isVisible();
  let expandedGraphVerified = false;

  if (width === 390) {
    expect(desktopGraphVisible).toBe(false);
    expect(mobileRelationsVisible).toBe(true);
    await page.getByRole("button", { name: "그래프 전체 화면" }).click();
    await page.getByRole("dialog", { name: "온톨로지 그래프 전체 화면" }).waitFor();
    expandedGraphVerified = await page.getByRole("dialog", { name: "온톨로지 그래프 전체 화면" }).isVisible();
    await page.getByRole("button", { name: "닫기" }).click();
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
    const parseRgb = (value: string) => (value.match(/[\d.]+/g) || []).slice(0, 3).map(Number);
    const nodeContrasts = [...document.querySelectorAll<HTMLElement>('[data-testid="ontology-neighborhood-node"]')]
      .filter(visible)
      .map((element) => {
        const style = window.getComputedStyle(element);
        return { foreground: parseRgb(style.color), background: parseRgb(style.backgroundColor) };
      });
    return {
      horizontalOverflow: Math.max(document.documentElement.scrollWidth - document.documentElement.clientWidth, 0),
      visibleNeighborhoodNodes: nodes.length,
      overlapPairs,
      minimumControlHeight,
      nodeContrasts
    };
  });
  const minimumNodeContrast = geometry.nodeContrasts.length
    ? Math.min(...geometry.nodeContrasts.map(({ foreground, background }) => contrastRatio(foreground, background)))
    : null;

  expect(geometry.horizontalOverflow).toBe(0);
  expect(geometry.overlapPairs).toBe(0);
  expect(geometry.minimumControlHeight).toBeGreaterThanOrEqual(44);
  if (minimumNodeContrast !== null) expect(minimumNodeContrast).toBeGreaterThanOrEqual(4.5);

  const variant = `${width === 390 ? "mobile" : "desktop"}-${theme}`;
  await page.screenshot({ path: path.join(artifactDirectory, `${variant}.png`), fullPage: true });
  return {
    variant,
    viewport: { width, height },
    horizontalOverflow: geometry.horizontalOverflow,
    visibleNeighborhoodNodes: geometry.visibleNeighborhoodNodes,
    overlapPairs: geometry.overlapPairs,
    minimumControlHeight: Math.round(geometry.minimumControlHeight * 100) / 100,
    minimumNodeContrast: minimumNodeContrast === null ? null : Math.round(minimumNodeContrast * 100) / 100,
    desktopGraphVisible,
    mobileRelationsVisible,
    expandedGraphVerified
  };
}

describe.skipIf(!baseUrl)("ontology UI production browser contract", () => {
  it("passes desktop and mobile Day/Night geometry and contrast gates", async () => {
    fs.mkdirSync(artifactDirectory, { recursive: true });
    const browser = await chromium.launch({ headless: true });
    try {
      const page = await browser.newPage();
      const metrics: BrowserMetric[] = [];
      for (const theme of ["day", "night"] as const) {
        metrics.push(await auditVariant(page, theme, 1440));
        metrics.push(await auditVariant(page, theme, 390));
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
