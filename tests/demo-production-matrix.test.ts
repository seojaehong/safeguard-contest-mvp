import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Browser } from "playwright";

import {
  startIsolatedNextBrowserHarness,
  type IsolatedNextBrowserHarness,
} from "./helpers/isolated-next-browser-harness";

const productionMatrix = process.env.DEMO_PROD_MATRIX === "1" ? describe : describe.skip;
let harness: IsolatedNextBrowserHarness | null = null;
let browser: Browser | null = null;

type RoleContract = {
  selector: string;
  sizeToken: string;
  weight: string;
  leadingToken: string;
  trackingToken: string;
};

type RoleMetric = {
  fontSize: string;
  weight: string;
  lineHeight: string;
  tracking: string;
  expectedFontSize: string;
  expectedLineHeight: string;
  expectedTracking: string;
};

type ViewportRect = { left: number; right: number; top: number; bottom: number; width: number; height: number };

function roleMetricMatches(metric: RoleMetric, weight: string): boolean {
  return metric.fontSize === metric.expectedFontSize
    && metric.weight === weight
    && metric.lineHeight === metric.expectedLineHeight
    && metric.tracking === metric.expectedTracking;
}

function rectFitsViewport(rect: ViewportRect, width: number, height: number): boolean {
  return rect.width > 0 && rect.height > 0
    && rect.left >= -0.5 && rect.right <= width + 0.5
    && rect.top >= -0.5 && rect.bottom <= height + 0.5;
}

function surfaceHasViewportIntersection(rect: ViewportRect, width: number, height: number): boolean {
  const horizontalFit = rect.width > 0 && rect.left >= -0.5 && rect.right <= width + 0.5;
  if (!horizontalFit || rect.height <= 0) return false;
  const visibleTop = Math.max(rect.top, 0);
  const visibleBottom = Math.min(rect.bottom, height);
  return visibleBottom - visibleTop >= Math.min(44, rect.height);
}

type Rgba = { red: number; green: number; blue: number; alpha: number };

function parseColor(value: string): Rgba {
  const parts = value.match(/[\d.]+/gu)?.map(Number) ?? [];
  if (parts.length < 3) throw new Error(`Unsupported computed color: ${value}`);
  return { red: parts[0], green: parts[1], blue: parts[2], alpha: parts[3] ?? 1 };
}

function composite(foreground: Rgba, background: Rgba): Rgba {
  const alpha = foreground.alpha + background.alpha * (1 - foreground.alpha);
  return {
    red: (foreground.red * foreground.alpha + background.red * background.alpha * (1 - foreground.alpha)) / alpha,
    green: (foreground.green * foreground.alpha + background.green * background.alpha * (1 - foreground.alpha)) / alpha,
    blue: (foreground.blue * foreground.alpha + background.blue * background.alpha * (1 - foreground.alpha)) / alpha,
    alpha,
  };
}

function contrastRatio(foreground: string, background: string): number {
  const white = { red: 255, green: 255, blue: 255, alpha: 1 };
  const foregroundColor = composite(parseColor(foreground), white);
  const backgroundColor = composite(parseColor(background), white);
  const luminance = (color: Rgba): number => {
    const channels = [color.red, color.green, color.blue].map((channel) => {
      const normalized = channel / 255;
      return normalized <= 0.03928 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
    });
    return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
  };
  const first = luminance(foregroundColor);
  const second = luminance(backgroundColor);
  return (Math.max(first, second) + 0.05) / (Math.min(first, second) + 0.05);
}

const roles: readonly RoleContract[] = [
  { selector: ".demo-stage-panel h1", sizeToken: "--text-page-title", weight: "800", leadingToken: "--leading-page-title", trackingToken: "--tracking-page-title" },
  { selector: ".demo-stage-panel p", sizeToken: "--text-body", weight: "500", leadingToken: "--leading-body", trackingToken: "--tracking-body" },
  { selector: ".v2-nav nav a", sizeToken: "--text-control", weight: "700", leadingToken: "--leading-control", trackingToken: "--tracking-body" },
  { selector: ".demo-input-card p", sizeToken: "--text-component-title", weight: "700", leadingToken: "--leading-component-title", trackingToken: "--tracking-component-title" },
  { selector: ".demo-result-brief span", sizeToken: "--text-caption", weight: "600", leadingToken: "--leading-caption", trackingToken: "--tracking-body" },
  { selector: ".demo-result-brief strong", sizeToken: "--text-component-title", weight: "700", leadingToken: "--leading-component-title", trackingToken: "--tracking-component-title" },
  { selector: ".demo-section-heading span", sizeToken: "--text-caption", weight: "600", leadingToken: "--leading-caption", trackingToken: "--tracking-body" },
  { selector: ".demo-section-heading strong", sizeToken: "--text-section-title", weight: "800", leadingToken: "--leading-section-title", trackingToken: "--tracking-section-title" },
  { selector: ".demo-document-list article span", sizeToken: "--text-caption", weight: "600", leadingToken: "--leading-caption", trackingToken: "--tracking-body" },
  { selector: ".demo-document-list article strong", sizeToken: "--text-component-title", weight: "700", leadingToken: "--leading-component-title", trackingToken: "--tracking-component-title" },
  { selector: ".demo-document-list article p", sizeToken: "--text-support", weight: "500", leadingToken: "--leading-body", trackingToken: "--tracking-body" },
  { selector: ".brand-lockup strong", sizeToken: "--text-component-title", weight: "700", leadingToken: "--leading-component-title", trackingToken: "--tracking-component-title" },
  { selector: ".brand-lockup small", sizeToken: "--text-caption", weight: "600", leadingToken: "--leading-caption", trackingToken: "--tracking-body" },
  { selector: ".eyebrow", sizeToken: "--text-hud", weight: "700", leadingToken: "--leading-hud", trackingToken: "--tracking-hud" },
  { selector: ".api-pulse-grid strong", sizeToken: "--text-component-title", weight: "700", leadingToken: "--leading-component-title", trackingToken: "--tracking-component-title" },
  { selector: ".api-pulse-grid span", sizeToken: "--text-caption", weight: "600", leadingToken: "--leading-caption", trackingToken: "--tracking-body" },
  { selector: ".triad-card span", sizeToken: "--text-caption", weight: "600", leadingToken: "--leading-caption", trackingToken: "--tracking-body" },
  { selector: ".triad-card strong", sizeToken: "--text-section-title", weight: "800", leadingToken: "--leading-section-title", trackingToken: "--tracking-section-title" },
  { selector: ".triad-card p", sizeToken: "--text-body", weight: "500", leadingToken: "--leading-body", trackingToken: "--tracking-body" },
  { selector: ".language-wall span", sizeToken: "--text-caption", weight: "600", leadingToken: "--leading-caption", trackingToken: "--tracking-body" },
  { selector: ".language-wall p", sizeToken: "--text-body", weight: "500", leadingToken: "--leading-body", trackingToken: "--tracking-body" },
  { selector: ".presenter-notes strong", sizeToken: "--text-component-title", weight: "700", leadingToken: "--leading-component-title", trackingToken: "--tracking-component-title" },
  { selector: ".presenter-notes p", sizeToken: "--text-body", weight: "500", leadingToken: "--leading-body", trackingToken: "--tracking-body" },
];

describe("demo matrix assertion helpers", () => {
  it("rejects tuple mutations and vertical viewport clipping", () => {
    const metric: RoleMetric = {
      fontSize: "15px", weight: "500", lineHeight: "24px", tracking: "0px",
      expectedFontSize: "15px", expectedLineHeight: "24px", expectedTracking: "0px",
    };
    expect(roleMetricMatches(metric, "500")).toBe(true);
    for (const mutation of [
      { ...metric, fontSize: "14px" },
      { ...metric, weight: "700" },
      { ...metric, lineHeight: "23px" },
      { ...metric, tracking: "0.1px" },
    ]) expect(roleMetricMatches(mutation, "500")).toBe(false);
    expect(rectFitsViewport({ left: 0, right: 44, top: 0, bottom: 44, width: 44, height: 44 }, 390, 844)).toBe(true);
    expect(rectFitsViewport({ left: 0, right: 44, top: -1, bottom: 43, width: 44, height: 44 }, 390, 844)).toBe(false);
    expect(rectFitsViewport({ left: 0, right: 44, top: 810, bottom: 854, width: 44, height: 44 }, 390, 844)).toBe(false);
    expect(surfaceHasViewportIntersection({ left: 0, right: 390, top: -100, bottom: 900, width: 390, height: 1000 }, 390, 844)).toBe(true);
    expect(surfaceHasViewportIntersection({ left: 0, right: 390, top: 900, bottom: 1900, width: 390, height: 1000 }, 390, 844)).toBe(false);
  });
});

productionMatrix("demo production design matrix", () => {
  beforeAll(async () => {
    harness = await startIsolatedNextBrowserHarness({
      slug: "demo-design-wave9",
      initialPath: "/demo?step=3&speed=slow",
      portSalt: 4599,
      mode: "prod",
    });
    browser = harness.browser;
  }, 90_000);

  afterAll(async () => {
    await harness?.stop();
  }, 30_000);

  it("preserves complete tuples, geometry, states, and overflow while documenting the absent route theme contract", async () => {
    if (!browser || !harness) throw new Error("Production browser harness was not started");
    expect(harness.mode).toBe("prod");

    const viewports = [
      { width: 1440, height: 900, label: "desktop" },
      { width: 390, height: 844, label: "mobile" },
      { width: 1440, height: 500, label: "short" },
    ] as const;

    const surfaceSignatures = new Map<string, string>();
    for (const theme of ["light", "dark"] as const) {
      for (const viewport of viewports) {
        const page = await browser.newPage({ viewport });
        await page.emulateMedia({ colorScheme: theme });
        await page.goto(`${harness.baseUrl}/demo?step=3&speed=slow`, { waitUntil: "networkidle" });
        await page.locator(".demo-screen").waitFor({ state: "visible" });
        await page.evaluate(async () => {
          await document.fonts.ready;
          await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
        });

        expect(await page.evaluate((scheme) => matchMedia(`(prefers-color-scheme: ${scheme})`).matches, theme)).toBe(true);

        await page.locator(".demo-mode-badges button").nth(1).click();
        await page.locator(".presenter-notes").waitFor({ state: "visible" });

        for (const role of roles) {
          const metric = await page.locator(role.selector).first().evaluate((element, contract) => {
            const style = getComputedStyle(element);
            const probe = document.createElement("span");
            probe.style.cssText = `position:absolute;visibility:hidden;font-size:var(${contract.sizeToken});line-height:var(${contract.leadingToken});letter-spacing:var(${contract.trackingToken})`;
            document.body.append(probe);
            const expected = getComputedStyle(probe);
            const result = {
              fontSize: style.fontSize,
              weight: style.fontWeight,
              lineHeight: style.lineHeight,
              tracking: style.letterSpacing,
              expectedFontSize: expected.fontSize,
              expectedLineHeight: expected.lineHeight,
              expectedTracking: expected.letterSpacing,
            };
            probe.remove();
            return result;
          }, role);
          expect(roleMetricMatches(metric, role.weight), `${theme} ${viewport.label} ${role.selector} exact tuple`).toBe(true);
        }

        const geometry = await page.evaluate(() => {
          const style = (selector: string) => getComputedStyle(document.querySelector(selector) as Element);
          const activeScenario = document.querySelector(".scenario-strip button.active") as HTMLElement | null;
          return {
            radii: [
              ".v2-nav",
              ".v2-nav nav a",
              ".demo-stage-panel",
              ".demo-screen",
              ".demo-stage-list li",
              ".demo-mode-badges button",
              ".demo-input-card",
              ".demo-result-brief div",
              ".demo-generated-pack",
              ".demo-document-list article",
              ".demo-evidence-map li",
            ].map((selector) => style(selector).borderRadius),
            progressRadius: style(".demo-progress-track").borderRadius,
            navShadow: style(".v2-nav").boxShadow,
            panelShadow: style(".demo-stage-panel").boxShadow,
            progressImage: style(".demo-progress-track span").backgroundImage,
            primaryImage: style(".demo-document-list article.primary").backgroundImage,
            activeShadow: activeScenario ? getComputedStyle(activeScenario).boxShadow : "missing",
            activeScenarios: document.querySelectorAll(".scenario-strip button.active").length,
            doneStages: document.querySelectorAll(".demo-stage-list li.done").length,
            compactControls: Array.from(document.querySelectorAll<HTMLElement>(".v2-nav a, .demo-mode-badges button")).map((control) => control.getBoundingClientRect().height),
            scenarioControls: Array.from(document.querySelectorAll<HTMLElement>(".scenario-strip button")).map((control) => control.getBoundingClientRect().height),
            sharedRadii: [".api-pulse-grid div", ".triad-card", ".language-wall div", ".presenter-notes"].map((selector) => style(selector).borderRadius),
            surfaceSignature: [style(".v2-shell").color, style(".demo-screen").backgroundColor, style(".demo-stage-panel").backgroundColor].join("|"),
            documentOverflow: document.documentElement.scrollWidth - window.innerWidth,
          };
        });

        expect(geometry.radii.every((radius) => radius === "4px"), `${theme} ${viewport.label} radii`).toBe(true);
        expect(geometry.progressRadius).toBe("4px");
        expect(geometry.navShadow).toBe("none");
        expect(geometry.panelShadow).toBe("none");
        expect(geometry.progressImage).toBe("none");
        expect(geometry.primaryImage).toBe("none");
        expect(geometry.activeShadow).not.toBe("none");
        expect(geometry.activeScenarios).toBe(1);
        expect(geometry.doneStages).toBeGreaterThan(0);
        expect(geometry.compactControls.every((height) => height >= 36)).toBe(true);
        expect(geometry.scenarioControls.every((height) => height >= 44)).toBe(true);
        expect(geometry.sharedRadii).toEqual(["4px", "4px", "4px", "4px"]);
        expect(geometry.documentOverflow).toBeLessThanOrEqual(0);

        const controls = page.locator(".v2-nav a, .demo-mode-badges button, .scenario-strip button");
        for (let index = 0; index < await controls.count(); index += 1) {
          const control = controls.nth(index);
          await control.scrollIntoViewIfNeeded();
          const rect = await control.evaluate((element) => {
            const bounds = element.getBoundingClientRect();
            return { left: bounds.left, right: bounds.right, top: bounds.top, bottom: bounds.bottom, width: bounds.width, height: bounds.height };
          });
          expect(rectFitsViewport(rect, viewport.width, viewport.height), `${theme} ${viewport.label} control ${index} four-edge viewport fit`).toBe(true);
        }

        const criticalSurfaces = page.locator(".v2-nav, .demo-stage-panel, .demo-screen, .demo-input-card, .demo-generated-pack, .demo-evidence-map, .presenter-notes");
        for (let index = 0; index < await criticalSurfaces.count(); index += 1) {
          const surface = criticalSurfaces.nth(index);
          await surface.scrollIntoViewIfNeeded();
          const rect = await surface.evaluate((element) => {
            const bounds = element.getBoundingClientRect();
            return { left: bounds.left, right: bounds.right, top: bounds.top, bottom: bounds.bottom, width: bounds.width, height: bounds.height };
          });
          expect(
            surfaceHasViewportIntersection(rect, viewport.width, viewport.height),
            `${theme} ${viewport.label} critical surface ${index} has four-edge-derived viewport intersection`,
          ).toBe(true);
        }

        const signatureKey = `${viewport.width}x${viewport.height}`;
        if (theme === "light") surfaceSignatures.set(signatureKey, geometry.surfaceSignature);
        else expect(geometry.surfaceSignature, `${signatureKey} has no route-owned Night theme`).toBe(surfaceSignatures.get(signatureKey));

        const stateStyle = async (selector: string) => page.locator(selector).first().evaluate((element) => {
          const computed = getComputedStyle(element);
          return { color: computed.color, background: computed.backgroundColor, border: computed.borderColor, shadow: computed.boxShadow };
        });
        const activeScenarioStyle = await stateStyle(".scenario-strip button.active");
        const pendingScenarioStyle = await stateStyle(".scenario-strip button:not(.active)");
        const activeStageStyle = await stateStyle(".demo-stage-list li.active");
        const doneStageStyle = await stateStyle(".demo-stage-list li.done");
        const pendingStageStyle = await stateStyle(".demo-stage-list li:not(.active):not(.done)");
        const liveIndicatorStyle = await stateStyle(".api-pulse-grid .live i");
        const liveIndicatorParent = await stateStyle(".api-pulse-grid .live");
        const liveModeStyle = await stateStyle(".demo-screen-top b.live");

        expect(contrastRatio(activeScenarioStyle.color, activeScenarioStyle.background)).toBeGreaterThanOrEqual(4.5);
        expect(contrastRatio(pendingScenarioStyle.color, pendingScenarioStyle.background)).toBeGreaterThanOrEqual(4.5);
        expect(contrastRatio(activeStageStyle.color, activeStageStyle.background)).toBeGreaterThanOrEqual(4.5);
        expect(contrastRatio(doneStageStyle.color, doneStageStyle.background)).toBeGreaterThanOrEqual(4.5);
        expect(contrastRatio(pendingStageStyle.color, pendingStageStyle.background)).toBeGreaterThanOrEqual(4.5);
        expect(contrastRatio(liveModeStyle.color, liveModeStyle.background)).toBeGreaterThanOrEqual(4.5);
        expect(contrastRatio(liveIndicatorStyle.background, liveIndicatorParent.background)).toBeGreaterThanOrEqual(3);
        expect(new Set([JSON.stringify(activeStageStyle), JSON.stringify(doneStageStyle), JSON.stringify(pendingStageStyle)]).size).toBe(3);
        expect(activeScenarioStyle.border).not.toBe(pendingScenarioStyle.border);
        expect(activeScenarioStyle.shadow).not.toBe(pendingScenarioStyle.shadow);

        await page.keyboard.press("o");
        await page.locator(".demo-screen-top b.offline").waitFor({ state: "visible" });
        const offlineModeStyle = await stateStyle(".demo-screen-top b.offline");
        expect(contrastRatio(offlineModeStyle.color, offlineModeStyle.background)).toBeGreaterThanOrEqual(4.5);
        expect(offlineModeStyle).not.toEqual(liveModeStyle);
        const secondScenario = page.locator(".scenario-strip button").nth(1);
        await secondScenario.click();
        await expect.poll(() => secondScenario.getAttribute("class")).toContain("active");
        expect(await page.locator(".scenario-strip button.active").count()).toBe(1);

        await page.close();
      }
    }
  }, 90_000);
});
