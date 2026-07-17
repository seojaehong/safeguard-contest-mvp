import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Browser, Page } from "playwright";
import {
  startIsolatedNextBrowserHarness,
  type IsolatedNextBrowserHarness
} from "./helpers/isolated-next-browser-harness";

let baseUrl = "";
let browser: Browser | null = null;
let harness: IsolatedNextBrowserHarness | null = null;

const sectionCases = [
  { label: "오늘", panel: "today", hash: "#knowledge-today" },
  { label: "기술 지원", panel: "technical", hash: "#technical-support-heading" },
  { label: "참고자료", panel: "references", hash: "#reference-library-heading" },
  { label: "위키", panel: "wiki", hash: "#wiki-index-heading" },
  { label: "검토 흐름", panel: "governance", hash: "#knowledge-governance-heading" },
  { label: "진단", panel: "diagnostics", hash: "#schema-heading" }
] as const;

async function expectActiveSection(page: Page, panel: string, label: string): Promise<void> {
  await expect.poll(() => page.getByRole("tab", { name: label }).getAttribute("aria-selected")).toBe("true");
  await expect.poll(() => page.locator(`[data-knowledge-panel="${panel}"]`).isVisible()).toBe(true);
  const visiblePanels = await page.locator('[role="tabpanel"]:visible').count();
  expect(visiblePanels).toBe(1);
}

describe("knowledge mobile information architecture", () => {
  beforeAll(async () => {
    harness = await startIsolatedNextBrowserHarness({
      slug: "knowledge-mobile-ia",
      initialPath: "/knowledge?theme=day",
      portSalt: 83,
      timeoutMs: 120_000
    });
    baseUrl = harness.baseUrl;
    browser = harness.browser;
  }, 140_000);

  afterAll(async () => {
    await harness?.stop();
  }, 30_000);

  it("enhances to one short panel with six reachable 44px tabs and no hydration errors", async () => {
    if (!browser) throw new Error("Browser was not started");

    for (const theme of ["day", "night"] as const) {
      const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
      const browserErrors: string[] = [];
      page.on("console", (message) => {
        if (message.type() === "error") browserErrors.push(message.text());
      });
      page.on("pageerror", (error) => browserErrors.push(error.message));

      try {
        await page.goto(`${baseUrl}/knowledge?theme=${theme}`, { waitUntil: "networkidle" });
        await page.locator('[data-knowledge-surface] [data-enhanced="true"]').waitFor();
        await expectActiveSection(page, "today", "오늘");

        const initial = await page.evaluate(() => {
          const root = document.querySelector<HTMLElement>('[data-knowledge-surface] [data-enhanced="true"]');
          const tabList = document.querySelector<HTMLElement>('[role="tablist"]');
          const activePanel = document.querySelector<HTMLElement>('[data-knowledge-panel="today"]');
          const tabs = [...document.querySelectorAll<HTMLElement>('[role="tab"]')];
          if (!root || !tabList || !activePanel) throw new Error("Missing enhanced knowledge layout");

          return {
            documentHeight: document.documentElement.scrollHeight,
            documentOverflow: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) - window.innerWidth,
            activePanelTop: activePanel.getBoundingClientRect().top,
            tabListTop: tabList.getBoundingClientRect().top,
            controlSizes: tabs.map((tab) => {
              const rect = tab.getBoundingClientRect();
              return { label: tab.textContent?.trim() || "tab", width: rect.width, height: rect.height };
            })
          };
        });

        if (process.env.KNOWLEDGE_MOBILE_AUDIT === "1") {
          console.info(`KNOWLEDGE_MOBILE_AUDIT ${JSON.stringify({ viewport: "390x844", theme, ...initial })}`);
        }

        expect(initial.documentHeight, theme).toBeLessThan(3_000);
        expect(initial.documentOverflow, theme).toBe(0);
        expect(initial.activePanelTop, theme).toBeGreaterThanOrEqual(0);
        expect(initial.activePanelTop, theme).toBeLessThan(844);
        expect(initial.controlSizes).toHaveLength(6);
        for (const control of initial.controlSizes) {
          expect(control.width, `${theme} ${control.label}`).toBeGreaterThanOrEqual(44);
          expect(control.height, `${theme} ${control.label}`).toBeGreaterThanOrEqual(44);
        }

        const todayTab = page.getByRole("tab", { name: "오늘" });
        await todayTab.focus();
        await page.keyboard.press("ArrowRight");
        await expectActiveSection(page, "technical", "기술 지원");
        expect(new URL(page.url()).hash).toBe("#technical-support-heading");

        await page.keyboard.press("End");
        await expectActiveSection(page, "diagnostics", "진단");
        expect(new URL(page.url()).hash).toBe("#schema-heading");

        await page.keyboard.press("Home");
        await expectActiveSection(page, "today", "오늘");
        expect(new URL(page.url()).hash).toBe("#knowledge-today");

        await page.keyboard.press("ArrowLeft");
        await expectActiveSection(page, "diagnostics", "진단");

        for (const section of sectionCases) {
          await page.getByRole("tab", { name: section.label }).click();
          await expectActiveSection(page, section.panel, section.label);
          expect(new URL(page.url()).hash, section.label).toBe(section.hash);
        }

        const switchedLayout = await page.evaluate(() => {
          const tabList = document.querySelector<HTMLElement>('[role="tablist"]');
          const panel = document.querySelector<HTMLElement>('[data-knowledge-panel="diagnostics"]');
          if (!tabList || !panel) throw new Error("Missing switched knowledge layout");
          return {
            tabListTop: tabList.getBoundingClientRect().top,
            panelTop: panel.getBoundingClientRect().top
          };
        });
        expect(switchedLayout.tabListTop, theme).toBeCloseTo(initial.tabListTop, 1);
        expect(switchedLayout.panelTop, theme).toBeGreaterThanOrEqual(0);
        expect(switchedLayout.panelTop, theme).toBeLessThan(844);
        expect(browserErrors, theme).toEqual([]);
      } finally {
        await page.close();
      }
    }
  }, 80_000);

  it("uses hash deep links and browser history as the active-section source of truth", async () => {
    if (!browser) throw new Error("Browser was not started");
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    try {
      await page.goto(`${baseUrl}/knowledge?theme=day#wiki-index-heading`, { waitUntil: "networkidle" });
      await page.locator('[data-knowledge-surface] [data-enhanced="true"]').waitFor();
      await expectActiveSection(page, "wiki", "위키");

      await page.getByRole("tab", { name: "검토 흐름" }).click();
      await expectActiveSection(page, "governance", "검토 흐름");
      await page.getByRole("tab", { name: "진단" }).click();
      await expectActiveSection(page, "diagnostics", "진단");

      await page.goBack();
      await expectActiveSection(page, "governance", "검토 흐름");
      await page.goBack();
      await expectActiveSection(page, "wiki", "위키");
      await page.goForward();
      await expectActiveSection(page, "governance", "검토 흐름");

      await page.evaluate(() => { window.location.hash = "unknown-section"; });
      await expectActiveSection(page, "today", "오늘");
    } finally {
      await page.close();
    }
  }, 45_000);

  it("shows all six sections and hides the inactive navigation when JavaScript is disabled", async () => {
    if (!browser) throw new Error("Browser was not started");
    const context = await browser.newContext({
      javaScriptEnabled: false,
      viewport: { width: 390, height: 844 }
    });
    const page = await context.newPage();
    try {
      await page.goto(`${baseUrl}/knowledge?theme=day#schema-heading`, { waitUntil: "domcontentloaded" });
      const panels = page.locator('[role="tabpanel"]');
      expect(await panels.count()).toBe(6);
      for (let index = 0; index < await panels.count(); index += 1) {
        expect(await panels.nth(index).isVisible(), `no-JS panel ${index}`).toBe(true);
      }
      expect(await page.getByRole("tablist", { name: "지식 DB 작업 보기" }).isVisible()).toBe(false);
      expect(await page.locator("#schema-heading").isVisible()).toBe(true);
    } finally {
      await context.close();
    }
  }, 35_000);

  it("preserves every knowledge section in desktop source order without hiding", async () => {
    if (!browser) throw new Error("Browser was not started");
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    try {
      await page.goto(`${baseUrl}/knowledge?theme=day#schema-heading`, { waitUntil: "networkidle" });
      const panels = page.locator('[role="tabpanel"]');
      expect(await panels.count()).toBe(6);
      expect(await panels.evaluateAll((elements) => elements.map((element) => (
        (element as HTMLElement).dataset.knowledgePanel
      )))).toEqual(["today", "governance", "technical", "references", "wiki", "diagnostics"]);
      for (let index = 0; index < await panels.count(); index += 1) {
        expect(await panels.nth(index).isVisible(), `desktop panel ${index}`).toBe(true);
      }
      expect(await page.getByRole("tablist", { name: "지식 DB 작업 보기" }).isVisible()).toBe(false);
    } finally {
      await page.close();
    }
  }, 35_000);
});
