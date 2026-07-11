import fs from "node:fs";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Browser, Page } from "playwright";
import {
  REPORTS_WAVE1_BUILD_MANIFEST_FILENAME,
  REPORTS_WAVE1_EVIDENCE_RELATIVE_DIR,
  cleanupReportsWave1OutputDirectory,
  resolveReportsWave1OutputDirectory,
  validateReportsWave1BuildManifest,
} from "@/scripts/reports_wave1_publish_support.mjs";

import {
  startIsolatedNextBrowserHarness,
  type IsolatedNextBrowserHarness
} from "./helpers/isolated-next-browser-harness";

const root = process.cwd();
const cssPath = path.join(root, "app", "globals.css");
const componentPath = path.join(root, "components", "ReportsDownloadCenter.tsx");
const shellPath = path.join(root, "components", "SafeClawModuleShell.tsx");
const defaultProductionBuildManifestPath = path.join(
  root,
  REPORTS_WAVE1_EVIDENCE_RELATIVE_DIR,
  REPORTS_WAVE1_BUILD_MANIFEST_FILENAME,
);

const targetLegacySelectors = [
  ".safeclaw-module-shell .safeclaw-report-facts strong",
  ".safeclaw-module-shell .safeclaw-report-facts span",
  ".safeclaw-module-shell .safeclaw-report-notes p",
  ".safeclaw-module-shell .safeclaw-report-table span",
  ".safeclaw-module-shell .safeclaw-report-group em",
  ".safeclaw-module-shell .safeclaw-report-table strong",
  ".safeclaw-module-shell .safeclaw-report-group strong",
  ".safeclaw-module-shell.module-variant-document .safeclaw-report-table strong",
  ".safeclaw-module-shell.module-variant-document .safeclaw-report-table span",
  ".safeclaw-module-shell.module-variant-document .safeclaw-report-controls button",
  ".safeclaw-module-shell.module-variant-document .safeclaw-report-controls button.active",
  ".safeclaw-module-shell.module-variant-document .safeclaw-report-controls button:hover",
  ".safeclaw-module-shell.module-variant-document .safeclaw-report-controls strong",
  ".safeclaw-module-shell.module-variant-document .safeclaw-report-controls span"
] as const;

type CssRule = {
  selectors: string[];
  body: string;
};

function normalizeSelector(selector: string): string {
  return selector.replace(/\s+/gu, " ").trim();
}

function cssRules(source: string): CssRule[] {
  const uncommented = source.replace(/\/\*[\s\S]*?\*\//gu, "");
  return [...uncommented.matchAll(/([^{}]+)\{([^{}]*)\}/gu)].map((match) => ({
    selectors: match[1].split(",").map(normalizeSelector),
    body: match[2]
  }));
}

function declarationsFor(source: string, selector: string): Record<string, string> {
  const result: Record<string, string> = {};
  for (const rule of cssRules(source)) {
    if (!rule.selectors.includes(selector)) continue;
    for (const match of rule.body.matchAll(/([\w-]+)\s*:\s*([^;]+);/gu)) {
      result[match[1]] = match[2].trim();
    }
  }
  return result;
}

function parseRgbTriplet(value: string): [number, number, number] {
  const match = value.match(/\d+(?:\.\d+)?/gu);
  if (!match || match.length < 3) throw new Error(`Unsupported color: ${value}`);
  return [Number(match[0]), Number(match[1]), Number(match[2])];
}

function relativeLuminanceChannel(channel: number): number {
  const normalized = channel / 255;
  return normalized <= 0.03928 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
}

function contrastRatio(foreground: string, background: string): number {
  const [fr, fg, fb] = parseRgbTriplet(foreground);
  const [br, bg, bb] = parseRgbTriplet(background);
  const foregroundLuminance = 0.2126 * relativeLuminanceChannel(fr)
    + 0.7152 * relativeLuminanceChannel(fg)
    + 0.0722 * relativeLuminanceChannel(fb);
  const backgroundLuminance = 0.2126 * relativeLuminanceChannel(br)
    + 0.7152 * relativeLuminanceChannel(bg)
    + 0.0722 * relativeLuminanceChannel(bb);
  const lighter = Math.max(foregroundLuminance, backgroundLuminance);
  const darker = Math.min(foregroundLuminance, backgroundLuminance);
  return (lighter + 0.05) / (darker + 0.05);
}

describe("Reports Wave 1 static design contract", () => {
  it("removes exactly 27 physical important declarations from the Reports family", () => {
    const css = fs.readFileSync(cssPath, "utf8");
    expect([...css.matchAll(/!important/gu)]).toHaveLength(725);

    const rules = cssRules(css);
    for (const selector of targetLegacySelectors) {
      const matchingRules = rules.filter((rule) => rule.selectors.includes(selector));
      expect(matchingRules, selector).toHaveLength(0);
    }
  });

  it("isolates Reports selectors from the preserved Documents blocks", () => {
    const css = fs.readFileSync(cssPath, "utf8");
    const mixedDocumentRules = cssRules(css).filter((rule) =>
      rule.selectors.some((selector) => selector.includes("module-variant-document"))
      && rule.selectors.some((selector) => /safeclaw-report-(?:controls|facts|notes|table|group)/u.test(selector))
    );
    expect(mixedDocumentRules).toEqual([]);

    expect(declarationsFor(
      css,
      ".safeclaw-module-shell.module-variant-document .safeclaw-workdoc-header p"
    )).toMatchObject({
      color: "var(--workspace-muted) !important",
      "font-size": "15px !important",
      "font-weight": "420 !important",
      "line-height": "1.68 !important",
      "letter-spacing": "0 !important"
    });
    expect(declarationsFor(
      css,
      ".safeclaw-module-shell.module-variant-document .safeclaw-workdoc"
    )).toMatchObject({
      "border-color": "var(--workspace-rule) !important",
      "border-radius": "10px !important",
      background: "var(--workspace-surface-1) !important",
      "box-shadow": "none !important"
    });
  });

  it("uses the canonical Reports typography and interaction tuples", () => {
    const css = fs.readFileSync(cssPath, "utf8");
    const scope = '.safeclaw-module-shell[data-module-route="/reports"]';
    const roles = {
      [`${scope} .safeclaw-report-facts strong`]: ["var(--text-caption)", "600", "var(--leading-caption)"],
      [`${scope} .safeclaw-report-facts span`]: ["var(--text-body)", "500", "var(--leading-body)"],
      [`${scope} .safeclaw-report-notes p`]: ["var(--text-body)", "500", "var(--leading-body)"],
      [`${scope} .safeclaw-report-table strong`]: ["var(--text-caption)", "700", "var(--leading-caption)"],
      [`${scope} .safeclaw-report-table span`]: ["var(--text-table)", "500", "var(--leading-table)"],
      [`${scope} .safeclaw-report-group > span`]: ["var(--text-caption)", "600", "var(--leading-caption)"],
      [`${scope} .safeclaw-report-group strong`]: ["var(--text-body)", "500", "var(--leading-body)"],
      [`${scope} .safeclaw-report-group em`]: ["var(--text-support)", "500", "var(--leading-body)"],
      [`${scope} .safeclaw-report-controls strong`]: ["var(--text-control)", "700", "var(--leading-control)"],
      [`${scope} .safeclaw-report-controls span`]: ["var(--text-caption)", "600", "var(--leading-caption)"],
      [`${scope} .safeclaw-download-note`]: ["var(--text-caption)", "600", "var(--leading-caption)"]
    } as const;

    for (const [selector, [size, weight, lineHeight]] of Object.entries(roles)) {
      expect(declarationsFor(css, selector), selector).toMatchObject({
        "font-size": size,
        "font-weight": weight,
        "line-height": lineHeight,
        "letter-spacing": "var(--tracking-body)"
      });
    }

    for (const selector of [
      `${scope} .safeclaw-report-controls button:hover:not([aria-pressed="true"]):not(:disabled)`,
      `${scope} .safeclaw-report-controls button:focus-visible`,
      `${scope} .safeclaw-report-controls button[aria-pressed="true"]`,
      `${scope} .safeclaw-report-controls button:disabled`
    ]) {
      expect(declarationsFor(css, selector), selector).not.toEqual({});
    }
  });

  it("exposes route and pressed-state semantics without broad primary-button capture", () => {
    const component = fs.readFileSync(componentPath, "utf8");
    const shell = fs.readFileSync(shellPath, "utf8");
    const css = fs.readFileSync(cssPath, "utf8");

    expect(shell).toContain("data-module-route={activeHref}");
    expect(component).toMatch(/className="safeclaw-report-period-control"[\s\S]*aria-pressed=\{period === option\.value\}/u);
    expect(css).toMatch(/button:not\(:where\([^)]*\.safeclaw-report-period-control/u);
  });

  it("splits the shared button radius selector so Reports controls compute to 8px", () => {
    const css = fs.readFileSync(cssPath, "utf8");
    expect(css).toContain(".safeclaw-module-shell button:not(.safeclaw-report-period-control)");
    expect(css).not.toContain(".safeclaw-module-shell button,\r\n.safeclaw-module-shell .button");
    expect(declarationsFor(
      css,
      '.safeclaw-module-shell[data-module-route="/reports"] .safeclaw-report-controls button'
    )).toMatchObject({
      "min-height": "44px",
      "border-radius": "8px"
    });
    expect(declarationsFor(
      css,
      '.safeclaw-module-shell .safeclaw-module-principal-command a'
    )).toMatchObject({
      "border-radius": "var(--safeclaw-principal-command-radius, 6px)",
      "font-size": "12px"
    });
    expect(declarationsFor(
      css,
      '.safeclaw-module-shell[data-module-route="/reports"]'
    )).toMatchObject({
      "--safeclaw-principal-command-min-height": "44px",
      "--safeclaw-principal-command-radius": "8px"
    });
  });
});

type Theme = "day" | "night";
type Viewport = { width: number; height: number; label: "desktop" | "mobile" };

let baseUrl = "";
let browser: Browser | null = null;
let harness: IsolatedNextBrowserHarness | null = null;
let outputDirectory = "";
let outputResolution: ReturnType<typeof resolveReportsWave1OutputDirectory> | null = null;

async function prepareSample(page: Page, theme: Theme): Promise<void> {
  await page.goto(`${baseUrl}/reports?theme=${theme}`, { waitUntil: "networkidle" });
  await page.locator(".safeclaw-module-shell[data-ready='true']").waitFor({ state: "attached" });
  await page.getByRole("button", { name: "샘플 미리보기" }).click();
  await page.locator(".safeclaw-workdoc-shell").waitFor({ state: "visible" });
  await page.locator(".safeclaw-report-period-control").first().waitFor({ state: "visible" });
}

async function startReportsHarness(): Promise<IsolatedNextBrowserHarness> {
  const candidateSalts = [7121, 8121, 9121, 10121];
  const mode = process.env.SAFECLAW_HARNESS_MODE === "prod" ? "prod" : "dev";
  if (mode === "prod") {
    validateReportsWave1BuildManifest({
      root,
      manifestPath: process.env.SAFECLAW_PRODUCTION_BUILD_MANIFEST ?? defaultProductionBuildManifestPath,
      expectedBuildDirectory: path.join(root, ".next"),
    });
  }
  let lastError: unknown;
  for (const portSalt of candidateSalts) {
    try {
      return await startIsolatedNextBrowserHarness({
        slug: "reports-design-wave-1",
        initialPath: "/reports",
        portSalt,
        mode
      });
    } catch (error) {
      lastError = error;
      const message = error instanceof Error ? error.message : String(error);
      if (!message.includes("listen EACCES") && !message.includes("EADDRINUSE")) {
        throw error;
      }
    }
  }
  throw lastError instanceof Error ? lastError : new Error("Unable to start isolated Reports browser harness");
}

describe("Reports Wave 1 browser design contract", () => {
  beforeAll(async () => {
    outputResolution = resolveReportsWave1OutputDirectory({ root, env: process.env });
    outputDirectory = outputResolution.directory;
    try {
      harness = await startReportsHarness();
      baseUrl = harness.baseUrl;
      browser = harness.browser;
    } catch (error) {
      cleanupReportsWave1OutputDirectory(outputResolution);
      outputResolution = null;
      throw error;
    }
  }, 90_000);

  afterAll(async () => {
    const currentOutput = outputResolution;
    try {
      await harness?.stop();
    } finally {
      try {
        if (currentOutput) cleanupReportsWave1OutputDirectory(currentOutput);
      } finally {
        harness = null;
        browser = null;
        outputResolution = null;
      }
    }
  }, 30_000);

  it.each([
    { theme: "day" as const, width: 1440, height: 900, label: "desktop" as const },
    { theme: "night" as const, width: 1440, height: 900, label: "desktop" as const },
    { theme: "day" as const, width: 390, height: 844, label: "mobile" as const },
    { theme: "night" as const, width: 390, height: 844, label: "mobile" as const }
  ])("keeps sample Reports stable in $theme $label", async ({ theme, width, height, label }: Viewport & { theme: Theme }) => {
    if (!browser) throw new Error("Browser was not started");
    const page = await browser.newPage({ viewport: { width, height } });
    await prepareSample(page, theme);

    const controls = page.locator(".safeclaw-report-period-control");
    const selected = controls.filter({ hasText: "주간" }).first();
    const hoverTarget = controls.filter({ hasText: "월간" }).first();
    expect(await selected.getAttribute("aria-pressed")).toBe("true");
    expect(await hoverTarget.getAttribute("aria-pressed")).toBe("false");

    const selectedBeforeHover = await selected.evaluate((element) => getComputedStyle(element).backgroundColor);
    await hoverTarget.hover();
    const hoverBackground = await hoverTarget.evaluate((element) => getComputedStyle(element).backgroundColor);
    expect(hoverBackground).not.toBe(selectedBeforeHover);
    await page.mouse.move(0, 0);
    await selected.focus();
    await page.keyboard.press("Shift+Tab");
    await page.keyboard.press("Tab");
    const focusOutline = await selected.evaluate((element) => getComputedStyle(element).outlineColor);
    await selected.blur();
    expect(await selected.getAttribute("aria-pressed")).toBe("true");
    expect(await selected.evaluate((element) => getComputedStyle(element).backgroundColor)).toBe(selectedBeforeHover);

    const metrics = await page.evaluate(() => {
      const tuple = (selector: string) => {
        const element = document.querySelector(selector);
        if (!element) throw new Error(`Missing typography target: ${selector}`);
        const style = getComputedStyle(element);
        return [style.fontSize, style.fontWeight, style.lineHeight, style.letterSpacing];
      };
      const controlHeights = Array.from(document.querySelectorAll(".safeclaw-report-controls button"))
        .map((element) => Math.round(element.getBoundingClientRect().height));
      const controlRadii = Array.from(document.querySelectorAll(".safeclaw-report-controls button"))
        .map((element) => getComputedStyle(element).borderRadius);
      const selectedControl = document.querySelector('.safeclaw-report-controls button[aria-pressed="true"]');
      const hero = document.querySelector(".safeclaw-page-decision-header");
      const heroMeta = document.querySelector(".safeclaw-page-decision-action > div:first-child");
      const heroCta = document.querySelector(".safeclaw-module-principal-command a");
      if (!selectedControl) throw new Error("Selected report period was not rendered");
      if (!hero || !heroMeta || !heroCta) throw new Error("Reports hero geometry targets were not rendered");
      const heroMetaRect = heroMeta.getBoundingClientRect();
      const heroCtaRect = heroCta.getBoundingClientRect();
      const heroCtaStyle = getComputedStyle(heroCta);
      return {
        horizontalOverflow: Math.max(0, document.documentElement.scrollWidth - window.innerWidth),
        controlHeights,
        controlRadii,
        accentText: getComputedStyle(selectedControl).color,
        heroColumnCount: getComputedStyle(hero).gridTemplateColumns.split(" ").filter(Boolean).length,
        heroCtaHeight: Math.round(heroCtaRect.height),
        heroCtaRadius: heroCtaStyle.borderRadius,
        heroCtaBackground: heroCtaStyle.backgroundColor,
        heroCtaColor: heroCtaStyle.color,
        heroCtaClipped: heroCta.scrollWidth > heroCta.clientWidth + 1,
        heroMetaCtaOverlap: !(
          heroMetaRect.bottom <= heroCtaRect.top
          || heroCtaRect.bottom <= heroMetaRect.top
          || heroMetaRect.right <= heroCtaRect.left
          || heroCtaRect.right <= heroMetaRect.left
        ),
        tuples: {
          factLabel: tuple(".safeclaw-report-facts strong"),
          factValue: tuple(".safeclaw-report-facts span"),
          note: tuple(".safeclaw-report-notes p"),
          tableHeader: tuple(".safeclaw-report-table strong"),
          tableBody: tuple(".safeclaw-report-table span"),
          groupLabel: tuple(".safeclaw-report-group > span"),
          groupBody: tuple(".safeclaw-report-group strong"),
          groupMeta: tuple(".safeclaw-report-group em"),
          control: tuple(".safeclaw-report-controls strong")
        },
        overlapCount: Array.from(document.querySelectorAll(".safeclaw-workdoc-shell *"))
          .filter((element) => {
            const style = getComputedStyle(element);
            const rect = element.getBoundingClientRect();
            return style.overflowX === "visible" && rect.width > window.innerWidth + 1;
          }).length
      };
    });

    expect(metrics.horizontalOverflow).toBe(0);
    expect(metrics.controlHeights.every((controlHeight) => controlHeight >= 44)).toBe(true);
    expect(metrics.controlRadii.every((radius) => radius === "8px")).toBe(true);
    expect(metrics.overlapCount).toBe(0);
    expect(metrics.heroCtaHeight).toBeGreaterThanOrEqual(44);
    expect(metrics.heroCtaRadius).toBe("8px");
    expect(contrastRatio(metrics.heroCtaColor, metrics.heroCtaBackground)).toBeGreaterThanOrEqual(4.5);
    if (label === "mobile") {
      expect(metrics.heroColumnCount).toBe(1);
      expect(metrics.heroCtaClipped).toBe(false);
      expect(metrics.heroMetaCtaOverlap).toBe(false);
    } else {
      expect(metrics.heroColumnCount).toBe(2);
      expect(metrics.heroCtaClipped).toBe(false);
      expect(metrics.heroMetaCtaOverlap).toBe(false);
    }
    expect(focusOutline).toBe(theme === "day" ? "rgb(245, 197, 24)" : "rgb(108, 111, 247)");
    expect(metrics.accentText).toBe(theme === "day" ? "rgb(114, 91, 0)" : "rgb(139, 141, 252)");
    expect(metrics.tuples).toEqual({
      factLabel: ["12px", "600", "18px", "normal"],
      factValue: ["15px", "500", "24px", "normal"],
      note: ["15px", "500", "24px", "normal"],
      tableHeader: ["12px", "700", "18px", "normal"],
      tableBody: ["13px", "500", "20px", "normal"],
      groupLabel: ["12px", "600", "18px", "normal"],
      groupBody: ["15px", "500", "24px", "normal"],
      groupMeta: ["14px", "500", "22.4px", "normal"],
      control: ["14px", "700", "20px", "normal"]
    });

    fs.writeFileSync(
      path.join(outputDirectory, `reports-sample-${theme}-${label}-metrics.json`),
      `${JSON.stringify({
        harnessMode: harness?.mode ?? "dev",
        theme,
        viewport: { width, height },
        selectedBackground: selectedBeforeHover,
        hoverBackground,
        focusOutline,
        ...metrics
      }, null, 2)}\n`
    );
    await page.screenshot({
      path: path.join(outputDirectory, `reports-sample-${theme}-${label}.png`),
      fullPage: true
    });
    await page.close();
  }, 120_000);

  it("captures deterministic empty and fail-closed server-error states", async () => {
    if (!browser) throw new Error("Browser was not started");
    const empty = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    await empty.goto(`${baseUrl}/reports?theme=day`, { waitUntil: "networkidle" });
    await empty.getByLabel("리포트 빈 상태").waitFor({ state: "visible" });
    expect(await empty.getByLabel("다운로드 준비 상태").textContent()).toContain("현재 작업팩 필요");
    const emptyMetrics = await empty.evaluate(() => ({
      horizontalOverflow: Math.max(0, document.documentElement.scrollWidth - window.innerWidth),
      state: document.querySelector("[aria-label='리포트 빈 상태']") ? "empty" : "missing"
    }));
    await empty.screenshot({ path: path.join(outputDirectory, "reports-empty-day-desktop.png"), fullPage: true });
    await empty.close();

    const serverErrorResults: Array<Record<string, unknown>> = [];
    for (const scenario of [
      { theme: "day" as const, width: 1440, height: 900, label: "desktop" as const },
      { theme: "night" as const, width: 1440, height: 900, label: "desktop" as const },
      { theme: "day" as const, width: 390, height: 844, label: "mobile" as const },
      { theme: "night" as const, width: 390, height: 844, label: "mobile" as const }
    ]) {
      const serverError = await browser.newPage({ viewport: { width: scenario.width, height: scenario.height } });
      await serverError.route("**/api/workpacks/wave-1-error", async (route) => {
        await route.fulfill({
          status: 500,
          contentType: "application/json",
          body: JSON.stringify({ ok: false, message: "Wave 1 deterministic server error" })
        });
      });
      await serverError.goto(`${baseUrl}/reports?theme=${scenario.theme}&workpackId=wave-1-error`, {
        waitUntil: "networkidle"
      });
      const errorState = serverError.getByLabel("서버 작업팩 오류 상태");
      await errorState.waitFor({ state: "visible" });
      const downloads = errorState.getByLabel("리포트 다운로드").getByRole("button");
      expect(await downloads.count()).toBe(5);
      for (const button of await downloads.all()) expect(await button.isDisabled()).toBe(true);
      const readiness = errorState.getByLabel("다운로드 준비 상태");
      expect(await readiness.textContent()).toContain("다운로드 잠김");
      const metrics = await serverError.evaluate(() => {
        const hero = document.querySelector(".safeclaw-page-decision-header");
        const heroMeta = document.querySelector(".safeclaw-page-decision-action > div:first-child");
        const heroCta = document.querySelector(".safeclaw-module-principal-command a");
        const readiness = document.querySelector("[aria-label='다운로드 준비 상태']");
        const downloads = Array.from(document.querySelectorAll("[aria-label='리포트 다운로드'] button"));
        if (!hero || !heroMeta || !heroCta || !readiness || downloads.length === 0) {
          throw new Error("Reports error-state geometry targets were not rendered");
        }
        const heroMetaRect = heroMeta.getBoundingClientRect();
        const heroCtaRect = heroCta.getBoundingClientRect();
        const readinessRect = readiness.getBoundingClientRect();
        const downloadRects = downloads.map((button) => button.getBoundingClientRect());
        const heroCtaStyle = getComputedStyle(heroCta);
        return {
          horizontalOverflow: Math.max(0, document.documentElement.scrollWidth - window.innerWidth),
          heroColumnCount: getComputedStyle(hero).gridTemplateColumns.split(" ").filter(Boolean).length,
          heroCtaHeight: Math.round(heroCtaRect.height),
          heroCtaRadius: heroCtaStyle.borderRadius,
          heroCtaColor: heroCtaStyle.color,
          heroCtaBackground: heroCtaStyle.backgroundColor,
          heroCtaClipped: heroCta.scrollWidth > heroCta.clientWidth + 1,
          heroMetaCtaOverlap: !(
            heroMetaRect.bottom <= heroCtaRect.top
            || heroCtaRect.bottom <= heroMetaRect.top
            || heroMetaRect.right <= heroCtaRect.left
            || heroCtaRect.right <= heroMetaRect.left
          ),
          readinessOccluded: downloadRects.some((rect) => !(
            readinessRect.bottom <= rect.top
            || rect.bottom <= readinessRect.top
            || readinessRect.right <= rect.left
            || rect.right <= readinessRect.left
          )),
          overlayVisible: document.body.innerText.includes("N 1 Issue")
            || document.body.innerText.includes("1 Issue")
            || document.body.innerText.includes("Next.js")
        };
      });
      expect(metrics.horizontalOverflow).toBe(0);
      expect(metrics.heroCtaHeight).toBeGreaterThanOrEqual(44);
      expect(metrics.heroCtaRadius).toBe("8px");
      expect(metrics.heroCtaClipped).toBe(false);
      expect(metrics.heroMetaCtaOverlap).toBe(false);
      expect(metrics.readinessOccluded).toBe(false);
      expect(metrics.overlayVisible).toBe(false);
      expect(contrastRatio(String(metrics.heroCtaColor), String(metrics.heroCtaBackground))).toBeGreaterThanOrEqual(4.5);
      if (scenario.label === "mobile") {
        expect(metrics.heroColumnCount).toBe(1);
      } else {
        expect(metrics.heroColumnCount).toBe(2);
      }
      serverErrorResults.push({
        harnessMode: harness?.mode ?? "dev",
        ...scenario,
        disabledDownloadCount: await downloads.count(),
        state: "server-error",
        ...metrics
      });
      await serverError.screenshot({
        path: path.join(outputDirectory, `reports-server-error-${scenario.theme}-${scenario.label}.png`),
        fullPage: true
      });
      await serverError.close();
    }
    fs.writeFileSync(
      path.join(outputDirectory, "reports-state-metrics.json"),
      `${JSON.stringify({
        harnessMode: harness?.mode ?? "dev",
        empty: emptyMetrics,
        serverError: serverErrorResults
      }, null, 2)}\n`
    );
  }, 120_000);
});
