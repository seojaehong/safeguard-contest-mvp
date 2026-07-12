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
];

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
          expect(metric, `${theme} ${viewport.label} ${role.selector}`).toEqual({
            fontSize: metric.expectedFontSize,
            weight: role.weight,
            lineHeight: metric.expectedLineHeight,
            tracking: metric.expectedTracking,
            expectedFontSize: metric.expectedFontSize,
            expectedLineHeight: metric.expectedLineHeight,
            expectedTracking: metric.expectedTracking,
          });
        }

        await page.locator(".demo-mode-badges button").nth(1).click();
        await page.locator(".presenter-notes").waitFor({ state: "visible" });

        const geometry = await page.evaluate(() => {
          const style = (selector: string) => getComputedStyle(document.querySelector(selector) as Element);
          const activeScenario = document.querySelector(".scenario-strip button.active") as HTMLElement | null;
          const controls = Array.from(document.querySelectorAll<HTMLElement>(".v2-nav a, .demo-mode-badges button, .scenario-strip button"));
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
            sharedMetrics: [
              ".eyebrow",
              ".api-pulse-grid strong",
              ".api-pulse-grid span",
              ".triad-card span",
              ".triad-card strong",
              ".triad-card p",
              ".language-wall span",
              ".language-wall p",
              ".presenter-notes strong",
              ".presenter-notes p",
              ".brand-lockup strong",
              ".brand-lockup small",
            ].map((selector) => {
              const element = document.querySelector(selector) as HTMLElement;
              const computed = getComputedStyle(element);
              const rect = element.getBoundingClientRect();
              return { selector, fontSize: computed.fontSize, lineHeight: computed.lineHeight, tracking: computed.letterSpacing, width: rect.width, height: rect.height };
            }),
            sharedRadii: [".api-pulse-grid div", ".triad-card", ".language-wall div", ".presenter-notes"].map((selector) => style(selector).borderRadius),
            surfaceSignature: [style(".v2-shell").color, style(".demo-screen").backgroundColor, style(".demo-stage-panel").backgroundColor].join("|"),
            documentOverflow: document.documentElement.scrollWidth - window.innerWidth,
            clippedControls: controls.filter((control) => {
              const rect = control.getBoundingClientRect();
              return rect.width <= 0 || rect.height <= 0 || rect.left < -0.5 || rect.right > window.innerWidth + 0.5;
            }).length,
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
        expect(geometry.sharedMetrics).toHaveLength(12);
        expect(geometry.sharedMetrics.every((metric) => Number.parseFloat(metric.fontSize) > 0 && metric.width > 0 && metric.height > 0)).toBe(true);
        expect(geometry.sharedRadii).toEqual(["4px", "4px", "4px", "4px"]);
        expect(geometry.documentOverflow).toBeLessThanOrEqual(0);
        expect(geometry.clippedControls).toBe(0);

        const signatureKey = `${viewport.width}x${viewport.height}`;
        if (theme === "light") surfaceSignatures.set(signatureKey, geometry.surfaceSignature);
        else expect(geometry.surfaceSignature, `${signatureKey} has no route-owned Night theme`).toBe(surfaceSignatures.get(signatureKey));

        const initialMode = await page.locator(".demo-screen-top b").textContent();
        await page.keyboard.press("o");
        await expect.poll(() => page.locator(".demo-screen-top b").textContent()).not.toBe(initialMode);
        const secondScenario = page.locator(".scenario-strip button").nth(1);
        await secondScenario.click();
        await expect.poll(() => secondScenario.getAttribute("class")).toContain("active");
        expect(await page.locator(".scenario-strip button.active").count()).toBe(1);

        await page.close();
      }
    }
  }, 90_000);
});
