import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Browser } from "playwright";
import { buildDbHarnessPacket, buildHarnessPromptContext } from "@/lib/db-harness";
import {
  buildStoredCurrentWorkpack,
  CURRENT_WORKPACK_STORAGE_KEY,
  type CurrentWorkerSnapshot
} from "@/lib/current-workpack";
import { buildSampleWorkpack } from "@/lib/sample-workpack";
import {
  startIsolatedNextBrowserHarness,
  type IsolatedNextBrowserHarness
} from "./helpers/isolated-next-browser-harness";

let baseUrl = "";
let browser: Browser | null = null;
let harness: IsolatedNextBrowserHarness | null = null;
const workspaceInputProductionMatrix = process.env.WORKSPACE_INPUT_PROD_MATRIX === "1" ? it : it.skip;

describe("workspace layout regression", () => {
  beforeAll(async () => {
    harness = await startIsolatedNextBrowserHarness({
      slug: "workspace-layout",
      initialPath: "/workspace?theme=night",
      portSalt: 3247,
      mode: process.env.WORKSPACE_INPUT_PROD_MATRIX === "1" ? "prod" : "dev",
    });
    baseUrl = harness.baseUrl;
    browser = harness.browser;
  }, 90_000);

  afterAll(async () => {
    await harness?.stop();
  }, 30_000);

  it("keeps Day and Night workspace geometry identical while preserving distinct theme colors", async () => {
    if (!browser) throw new Error("Browser was not started");
    const viewports = [
      { width: 1440, height: 900, label: "desktop" },
      { width: 1024, height: 900, label: "tablet" },
      { width: 390, height: 844, label: "mobile" },
      { width: 1440, height: 500, label: "desktop-short" },
      { width: 1024, height: 600, label: "tablet-short" },
      { width: 1440, height: 320, label: "desktop-compact" },
    ] as const;
    const selectors = [
      ".command-topbar",
      ".workspace-theme-toggle",
      ".workspace-theme-toggle button:nth-child(1)",
      ".workspace-theme-toggle button:nth-child(2)",
      ".linear-workspace-layout",
      ".workspace-side-nav",
      ".workspace-side-group:first-child",
      ".workspace-side-group:first-child button:nth-of-type(1)",
      ".linear-workspace-layout .command-main",
      ".workspace-input-page",
      ".workspace-input-page .command-copy",
      ".workspace-input-page .command-copy .eyebrow",
      ".workspace-input-page .command-console",
      ".workspace-input-page .command-console-input",
      ".workspace-input-page .input-helper",
      ".workspace-input-page .input-composer-tray",
      ".workspace-input-page .composer-attach-button",
      ".workspace-input-page .composer-submit-button",
      ".workspace-input-page .field-brief-chip-row",
      ".workspace-input-page .field-brief-chip-row span:nth-child(1)",
      ".workspace-input-page .field-brief-chip-row span:nth-child(2)",
      ".workspace-input-page .field-brief-chip-row span:nth-child(3)",
      ".workspace-input-page .field-brief-chip-row span:nth-child(4)",
      ".workspace-input-page .field-brief-chip-row span:nth-child(5)",
      ".workspace-input-page .evidence-readiness-rail",
      ".workspace-input-page .evidence-readiness-card:nth-child(1)",
      ".workspace-input-page .evidence-readiness-card:nth-child(2)",
      ".workspace-input-page .evidence-readiness-card:nth-child(3)",
      ".workspace-input-page .evidence-readiness-card:nth-child(4)",
      ".workspace-input-page .evidence-readiness-card:nth-child(5)",
      ".workspace-input-page .advanced-settings",
      ".workspace-input-page .advanced-settings .ai-mode-toggle",
      ".workspace-input-page .advanced-settings .ai-mode-option",
      ".workspace-input-page .quick-scenario-chips",
      ".workspace-input-page .quick-scenario-chip-list",
      ".workspace-input-page .quick-chip",
    ] as const;

    async function readTheme(
      theme: "day" | "night",
      viewport: (typeof viewports)[number],
    ) {
      if (!browser) throw new Error("Browser was not started");
      const page = await browser.newPage({
        viewport: { width: viewport.width, height: viewport.height },
      });
      try {
        let resolveWeatherRequest: (() => void) | null = null;
        const weatherRequest = new Promise<void>((resolve) => {
          resolveWeatherRequest = resolve;
        });
        await page.route("**/api/weather?**", async (route) => {
          await route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify({
              ok: true,
              weather: {
                source: "kma",
                mode: "fallback",
                locationLabel: "서울 성수동",
                summary: "강풍",
                actions: [],
                detail: "Deterministic workspace geometry fixture",
              },
            }),
          });
          resolveWeatherRequest?.();
        });
        await page.goto(
          `${baseUrl}/workspace?scenario=seoul-construction-windy&theme=${theme}`,
          { waitUntil: "networkidle" },
        );
        await weatherRequest;
        await page.waitForFunction(() => {
          const weatherChip = document.querySelector(".field-brief-chip-row")?.textContent ?? "";
          const weatherStatus = document.querySelector(".evidence-readiness-card:last-child strong")?.textContent ?? "";
          return weatherChip.includes("강풍") && weatherStatus !== "확인 중";
        });
        await page.evaluate(async () => {
          await document.fonts.ready;
          document.querySelectorAll<HTMLDetailsElement>(
            ".workspace-input-page .advanced-settings, .workspace-input-page .quick-scenario-chips",
          ).forEach((details) => {
            details.open = true;
          });
          await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
        });

        return await page.evaluate((targets) => {
          const round = (value: number) => Math.round(value * 10) / 10;
          const geometry = targets.map((selector) => {
            const element = document.querySelector<HTMLElement>(selector);
            if (!element) throw new Error(`Missing theme geometry target: ${selector}`);
            const rect = element.getBoundingClientRect();
            const style = getComputedStyle(element);
            return {
              selector,
              x: round(rect.x),
              y: round(rect.y),
            width: round(rect.width),
            height: round(rect.height),
            display: style.display,
            minWidth: style.minWidth,
            text: element.textContent?.replace(/\s+/gu, " ").trim() ?? "",
            gridTemplateColumns: style.gridTemplateColumns,
            gap: style.gap,
            padding: [style.paddingTop, style.paddingRight, style.paddingBottom, style.paddingLeft],
            borderWidth: [style.borderTopWidth, style.borderRightWidth, style.borderBottomWidth, style.borderLeftWidth],
            borderRadius: style.borderRadius,
            fontSize: style.fontSize,
            fontWeight: style.fontWeight,
              lineHeight: style.lineHeight,
              letterSpacing: style.letterSpacing,
            };
          });
          const shell = document.querySelector<HTMLElement>(".command-center-shell");
          const primary = document.querySelector<HTMLElement>(".composer-submit-button");
          if (!shell || !primary) throw new Error("Missing workspace theme color targets");
          return {
            geometry,
            colors: {
              shell: getComputedStyle(shell).backgroundColor,
              primary: getComputedStyle(primary).backgroundColor,
            },
          };
        }, selectors);
      } finally {
        await page.close();
      }
    }

    for (const viewport of viewports) {
      const day = await readTheme("day", viewport);
      const night = await readTheme("night", viewport);
      expect(day.geometry, `${viewport.label} Day/Night geometry`).toEqual(night.geometry);
      const nightMetric = (selector: string) => {
        const metric = night.geometry.find((item) => item.selector === selector);
        if (!metric) throw new Error(`Missing Night baseline metric: ${selector}`);
        return metric;
      };
      expect(nightMetric(".command-topbar").borderRadius, `${viewport.label} Night topbar`).toBe("4px");
      expect(nightMetric(".workspace-theme-toggle").borderRadius, `${viewport.label} Night toggle`).toBe("4px");
      expect(
        nightMetric(".workspace-theme-toggle button:nth-child(1)").minWidth,
        `${viewport.label} Night toggle button`,
      ).toBe(viewport.label === "desktop-compact" ? "46px" : "44px");
      expect(nightMetric(".linear-workspace-layout").gap, `${viewport.label} Night workspace gap`).toBe(
        viewport.label === "mobile" ? "0px" : "0px 16px",
      );
      expect(nightMetric(".workspace-side-nav").borderRadius, `${viewport.label} Night side navigation`).toBe("0px");
      expect(nightMetric(".linear-workspace-layout .command-main").borderRadius, `${viewport.label} Night main`).toBe("0px");
      expect(nightMetric(".workspace-input-page .command-console-input").borderRadius, `${viewport.label} Night input`).toBe("4px");
      expect(
        nightMetric(".workspace-input-page .field-brief-chip-row span:nth-child(1)"),
        `${viewport.label} Night field chip`,
      ).toMatchObject({ borderRadius: "4px", padding: ["8px", "16px", "8px", "16px"] });
      expect(nightMetric(".workspace-input-page .composer-submit-button"), `${viewport.label} Night primary action`).toMatchObject({
        borderRadius: "8px",
        fontWeight: "700",
      });
      expect(nightMetric(".workspace-input-page .advanced-settings"), `${viewport.label} Night advanced settings`).toMatchObject({
        borderRadius: "4px",
      });
      expect(nightMetric(".workspace-input-page .quick-scenario-chips"), `${viewport.label} Night examples`).toMatchObject({
        borderRadius: "4px",
      });
      expect(day.colors.shell, `${viewport.label} shell theme color`).not.toBe(night.colors.shell);
      expect(day.colors.primary, `${viewport.label} primary theme color`).not.toBe(night.colors.primary);
    }
  }, 180_000);

  workspaceInputProductionMatrix("preserves the exact Day and Night textarea cascade at every responsive band", async () => {
    if (!browser) throw new Error("Browser was not started");
    expect(harness?.mode).toBe("prod");
    const scenarios = [
      { width: 1440, height: 900, minHeight: 152, paddingTop: 22, paddingRight: 24, fontSize: 17, lineHeight: 29.92, resize: "vertical" },
      { width: 1638, height: 510, minHeight: 124, paddingTop: 18, paddingRight: 18, fontSize: 15, lineHeight: 26.1, resize: "vertical" },
      { width: 1440, height: 500, minHeight: 124, paddingTop: 18, paddingRight: 18, fontSize: 15, lineHeight: 26.1, resize: "vertical" },
      { width: 1440, height: 410, minHeight: 124, paddingTop: 18, paddingRight: 18, fontSize: 14, lineHeight: 24.36, resize: "vertical" },
      { width: 1440, height: 360, minHeight: 116, paddingTop: 14, paddingRight: 15, fontSize: 14, lineHeight: 23.8, resize: "vertical" },
      { width: 1440, height: 320, minHeight: 108, paddingTop: 14, paddingRight: 12, fontSize: 14, lineHeight: 23.8, resize: "vertical" },
      { width: 390, height: 844, minHeight: 142, paddingTop: 16, paddingRight: 16, fontSize: 15, lineHeight: 25.2, resize: "both" },
    ];

    for (const theme of ["day", "night"] as const) {
      for (const scenario of scenarios) {
        const page = await browser.newPage({ viewport: { width: scenario.width, height: scenario.height } });
        await page.goto(`${baseUrl}/workspace?theme=${theme}`, { waitUntil: "networkidle" });
        const themedInput = page.locator(
          `.command-center-shell.workspace-theme-${theme} .workspace-input-page #field-command-input`,
        );
        await themedInput.waitFor({ state: "visible" });
        await page.evaluate(async () => {
          await document.fonts.ready;
          await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
        });
        await page.waitForFunction(
          ({ expectedTheme }) => {
            const input = document.querySelector(
              `.command-center-shell.workspace-theme-${expectedTheme} .workspace-input-page #field-command-input`,
            );
            if (!input) return false;
            const style = getComputedStyle(input);
            return style.display === "block"
              && Number.parseFloat(style.minHeight) >= 108
              && Number.parseFloat(style.paddingTop) >= 14;
          },
          { expectedTheme: theme },
          { timeout: 10_000 },
        );
        const metrics = await themedInput.evaluate((element) => {
          const style = getComputedStyle(element);
          return {
            shellTheme: element.closest(".command-center-shell")?.classList.contains("workspace-theme-day")
              ? "day"
              : element.closest(".command-center-shell")?.classList.contains("workspace-theme-night")
                ? "night"
                : "unknown",
            display: style.display,
            minHeight: Number.parseFloat(style.minHeight),
            paddingTop: Number.parseFloat(style.paddingTop),
            paddingRight: Number.parseFloat(style.paddingRight),
            paddingBottom: Number.parseFloat(style.paddingBottom),
            paddingLeft: Number.parseFloat(style.paddingLeft),
            overflowY: style.overflowY,
            fontSize: Number.parseFloat(style.fontSize),
            lineHeight: Number.parseFloat(style.lineHeight),
            resize: style.resize,
          };
        });

        expect(metrics, `${theme} ${scenario.width}x${scenario.height}`).toMatchObject({
          shellTheme: theme,
          display: "block",
          minHeight: scenario.minHeight,
          paddingTop: scenario.paddingTop,
          paddingRight: scenario.paddingRight,
          paddingBottom: scenario.paddingTop,
          paddingLeft: scenario.paddingRight,
          overflowY: "auto",
          fontSize: scenario.fontSize,
          resize: scenario.resize,
        });
        expect(metrics.lineHeight).toBeCloseTo(scenario.lineHeight, 1);
        await themedInput.fill("외벽 도장 작업의 추락 위험을 반영해 오늘 위험성평가와 TBM 기록을 만들어줘.");
        const geometry = await page.evaluate(() => {
          const readRect = (selector: string) => {
            const element = document.querySelector(selector);
            if (!(element instanceof HTMLElement)) throw new Error(`Missing geometry target: ${selector}`);
            const rect = element.getBoundingClientRect();
            const style = getComputedStyle(element);
            return {
              top: Math.round(rect.top),
              bottom: Math.round(rect.bottom),
              width: Math.round(rect.width),
              height: Math.round(rect.height),
              display: style.display,
              visibility: style.visibility,
            };
          };
          const submit = document.querySelector(".composer-submit-button");
          const attachment = document.querySelector(".composer-attach-button input[type='file']");
          return {
            viewportHeight: window.innerHeight,
            viewportWidth: window.innerWidth,
            scrollWidth: document.documentElement.scrollWidth,
            composer: readRect(".input-composer-tray"),
            submit: readRect(".composer-submit-button"),
            attachment: readRect(".composer-attach-button"),
            submitEnabled: submit instanceof HTMLButtonElement && !submit.disabled,
            attachmentEnabled: attachment instanceof HTMLInputElement && !attachment.disabled,
          };
        });
        expect(geometry.scrollWidth, `${theme} ${scenario.width}x${scenario.height} horizontal overflow`).toBeLessThanOrEqual(geometry.viewportWidth);
        for (const [control, rect] of Object.entries({ composer: geometry.composer, submit: geometry.submit, attachment: geometry.attachment })) {
          const requiredBottomInset = scenario.width <= 720 && control === "submit" ? 48 : scenario.width <= 720 ? 0 : 8;
          expect(rect.width, `${theme} ${scenario.width}x${scenario.height} ${control} width`).toBeGreaterThan(0);
          expect(rect.height, `${theme} ${scenario.width}x${scenario.height} ${control} height`).toBeGreaterThan(0);
          expect(rect.display, `${theme} ${scenario.width}x${scenario.height} ${control} display`).not.toBe("none");
          expect(rect.visibility, `${theme} ${scenario.width}x${scenario.height} ${control} visibility`).toBe("visible");
          expect(rect.top, `${theme} ${scenario.width}x${scenario.height} ${control} top`).toBeGreaterThanOrEqual(0);
          expect(rect.bottom, `${theme} ${scenario.width}x${scenario.height} ${control} bottom`).toBeLessThanOrEqual(geometry.viewportHeight - requiredBottomInset);
        }
        expect(geometry.submitEnabled).toBe(true);
        expect(geometry.attachmentEnabled).toBe(true);
        await page.close();
      }
    }
  }, 120_000);

  it("resumes the canonical browser workpack when the operator returns to the workspace", async () => {
    if (!browser) throw new Error("Browser was not started");
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    const workerSnapshot = {
      savedAt: "2026-07-11T16:40:00+09:00",
      source: "workspace",
      workers: [{
        id: "worker-restored-1",
        displayName: "복원 작업자",
        role: "도장 작업자",
        joinedAt: "2026-07-11",
        experienceLevel: "숙련",
        experienceSummary: "외벽 도장 숙련 작업자",
        nationality: "대한민국",
        languageCode: "ko",
        languageLabel: "한국어",
        isNewWorker: false,
        isForeignWorker: false,
        trainingStatus: "이수",
        trainingSummary: "당일 TBM 확인 완료"
      }],
      selectedWorkerIds: ["worker-restored-1"]
    } satisfies CurrentWorkerSnapshot;
    const stored = buildStoredCurrentWorkpack(buildSampleWorkpack(), { workerSnapshot });
    await page.addInitScript(
      ({ key, value }) => window.localStorage.setItem(key, value),
      {
        key: CURRENT_WORKPACK_STORAGE_KEY,
        value: JSON.stringify(stored)
      }
    );

    await page.goto(`${baseUrl}/workspace?theme=day`, { waitUntil: "networkidle" });

    await page.locator(".workspace-document-page").waitFor({ state: "visible" });
    expect(await page.locator(".workspace-top-title strong").textContent()).toBe("문서");
    expect(await page.locator(".workspace-current-brief strong").textContent()).toContain(stored.data.scenario.workSummary);
    await page.locator(".doc-card-actions button", { hasText: "편집" }).click();
    await page.locator(".field-workspace").waitFor({ state: "visible" });
    expect(await page.locator(".field-workspace").textContent()).toContain("복원 작업자");
    expect(await page.locator(".workspace-input-page").count()).toBe(0);
  }, 90_000);

  it("does not pin the large workspace topbar over menu and content while scrolling", async () => {
    if (!browser) throw new Error("Browser was not started");
    const page = await browser.newPage({ viewport: { width: 1440, height: 720 } });
    await page.goto(`${baseUrl}/workspace?theme=night`, { waitUntil: "networkidle" });
    const canScroll = await page.evaluate(() => {
      const scroller = document.scrollingElement;
      return Boolean(scroller && scroller.scrollHeight > window.innerHeight + 160);
    });
    if (canScroll) {
      await page.evaluate(() => window.scrollTo(0, 260));
      await page.waitForFunction(() => window.scrollY >= 120);
    }

    const metrics = await page.evaluate(() => {
      const topbar = document.querySelector(".command-topbar");
      const viewport = document.querySelector(".command-viewport");
      const sideNav = document.querySelector(".workspace-side-nav");
      const heading = document.querySelector(".command-copy h1");
      const topbarRect = topbar?.getBoundingClientRect();
      const viewportRect = viewport?.getBoundingClientRect();
      const sideNavRect = sideNav?.getBoundingClientRect();
      const headingRect = heading?.getBoundingClientRect();
      const topbarStyle = topbar ? getComputedStyle(topbar) : null;
      return {
        scrollY: Math.round(window.scrollY),
        topbarBottom: topbarRect ? Math.round(topbarRect.bottom) : null,
        topbarPosition: topbarStyle?.position || null,
        viewportTop: viewportRect ? Math.round(viewportRect.top) : null,
        sideNavTop: sideNavRect ? Math.round(sideNavRect.top) : null,
        headingTop: headingRect ? Math.round(headingRect.top) : null
      };
    });

    if (canScroll) expect(metrics.scrollY).toBeGreaterThanOrEqual(120);
    else expect(metrics.scrollY).toBeLessThanOrEqual(4);
    expect(metrics.topbarBottom).not.toBeNull();
    expect(metrics.viewportTop).not.toBeNull();
    expect(metrics.sideNavTop).not.toBeNull();
    expect(metrics.headingTop).not.toBeNull();
    expect(metrics.topbarPosition).toBe("relative");
    if (canScroll) expect(metrics.topbarBottom).toBeLessThanOrEqual(0);
    else expect(metrics.topbarBottom).toBeLessThanOrEqual(metrics.viewportTop! - 8);
  }, 90_000);

  it("lets the day topbar scroll away on wide short presentation screens", async () => {
    if (!browser) throw new Error("Browser was not started");
    const page = await browser.newPage({ viewport: { width: 2048, height: 638 } });
    await page.goto(`${baseUrl}/workspace?theme=day`, { waitUntil: "networkidle" });
    const canScroll = await page.evaluate(() => {
      const scroller = document.scrollingElement;
      return Boolean(scroller && scroller.scrollHeight > window.innerHeight + 160);
    });
    if (canScroll) {
      await page.evaluate(() => window.scrollTo(0, 260));
      await page.waitForFunction(() => window.scrollY >= 120);
    }

    const metrics = await page.evaluate(() => {
      const topbar = document.querySelector(".command-topbar");
      const viewport = document.querySelector(".command-viewport");
      const heading = document.querySelector(".workspace-input-page .command-copy h1");
      const textarea = document.querySelector(".workspace-input-page .command-console-input");
      const topbarRect = topbar?.getBoundingClientRect();
      const viewportRect = viewport?.getBoundingClientRect();
      const headingRect = heading?.getBoundingClientRect();
      const textareaRect = textarea?.getBoundingClientRect();
      const topbarStyle = topbar ? getComputedStyle(topbar) : null;
      return {
        scrollY: Math.round(window.scrollY),
        topbarBottom: topbarRect ? Math.round(topbarRect.bottom) : null,
        topbarPosition: topbarStyle?.position || null,
        viewportTop: viewportRect ? Math.round(viewportRect.top) : null,
        headingTop: headingRect ? Math.round(headingRect.top) : null,
        headingBottom: headingRect ? Math.round(headingRect.bottom) : null,
        textareaTop: textareaRect ? Math.round(textareaRect.top) : null
      };
    });

    if (canScroll) expect(metrics.scrollY).toBeGreaterThanOrEqual(120);
    else expect(metrics.scrollY).toBeLessThanOrEqual(4);
    expect(metrics.topbarBottom).not.toBeNull();
    expect(metrics.viewportTop).not.toBeNull();
    expect(metrics.headingTop).not.toBeNull();
    expect(metrics.headingBottom).not.toBeNull();
    expect(metrics.textareaTop).not.toBeNull();
    expect(metrics.topbarPosition).toBe("relative");
    if (canScroll) expect(metrics.topbarBottom).toBeLessThanOrEqual(0);
    else expect(metrics.topbarBottom).toBeLessThanOrEqual(metrics.viewportTop! - 8);
    expect(metrics.headingBottom).toBeLessThanOrEqual(metrics.textareaTop! - 16);
  }, 90_000);

  it("keeps the day sidebar bounded on wide short presentation screens", async () => {
    if (!browser) throw new Error("Browser was not started");
    const page = await browser.newPage({ viewport: { width: 2048, height: 638 } });
    await page.goto(`${baseUrl}/workspace?scenario=seoul-construction-windy&theme=day`, { waitUntil: "networkidle" });

    const metrics = await page.evaluate(() => {
      const sideNav = document.querySelector(".workspace-side-nav");
      const main = document.querySelector(".linear-workspace-layout .command-main");
      const recentList = document.querySelector(".workspace-recent-list");
      const hiddenSourceRows = Array.from(document.querySelectorAll(".workspace-source-status p"))
        .slice(2)
        .map((element) => getComputedStyle(element).display);
      if (!sideNav || !main || !recentList) {
        throw new Error("Workspace sidebar targets were not found");
      }
      const sideNavRect = sideNav.getBoundingClientRect();
      const mainRect = main.getBoundingClientRect();
      const sideNavStyle = getComputedStyle(sideNav);
      const recentListStyle = getComputedStyle(recentList);
      return {
        sideNavBottom: Math.round(sideNavRect.bottom),
        sideNavHeight: Math.round(sideNavRect.height),
        sideNavOverflowY: sideNavStyle.overflowY,
        mainLeft: Math.round(mainRect.left),
        sideNavRight: Math.round(sideNavRect.right),
        recentListDisplay: recentListStyle.display,
        hiddenSourceRows
      };
    });

    expect(metrics.sideNavHeight).toBeLessThanOrEqual(638 - 104);
    expect(metrics.sideNavBottom).toBeLessThanOrEqual(639);
    expect(metrics.sideNavOverflowY).toBe("auto");
    expect(metrics.sideNavRight).toBeLessThanOrEqual(metrics.mainLeft - 8);
    expect(metrics.recentListDisplay).toBe("none");
    expect(metrics.hiddenSourceRows).toEqual(["none"]);
  }, 90_000);

  it("keeps the workspace first impression typography solid and readable", async () => {
    if (!browser) throw new Error("Browser was not started");
    const page = await browser.newPage({ viewport: { width: 1440, height: 720 } });
    await page.goto(`${baseUrl}/workspace?theme=night`, { waitUntil: "networkidle" });

    const metrics = await page.evaluate(() => {
      const heading = document.querySelector(".workspace-input-page .command-copy h1");
      const description = document.querySelector(".workspace-input-page .command-copy p");
      const input = document.querySelector(".workspace-input-page .command-console-input");
      const sideNav = document.querySelector(".workspace-side-nav");
      const sideButton = document.querySelector(".workspace-side-group button");
      if (!heading || !description || !input || !sideNav || !sideButton) {
        throw new Error("Workspace typography targets were not found");
      }
      const headingStyle = getComputedStyle(heading);
      const descriptionStyle = getComputedStyle(description);
      const inputStyle = getComputedStyle(input);
      const sideNavStyle = getComputedStyle(sideNav);
      const sideButtonRect = sideButton.getBoundingClientRect();
      return {
        headingWeight: Number.parseFloat(headingStyle.fontWeight),
        headingLineHeight: Number.parseFloat(headingStyle.lineHeight),
        headingFontSize: Number.parseFloat(headingStyle.fontSize),
        headingLetterSpacing: headingStyle.letterSpacing,
        descriptionWeight: Number.parseFloat(descriptionStyle.fontWeight),
        inputLineHeight: Number.parseFloat(inputStyle.lineHeight),
        inputFontSize: Number.parseFloat(inputStyle.fontSize),
        sideGap: Number.parseFloat(sideNavStyle.gap),
        sideButtonHeight: Math.round(sideButtonRect.height)
      };
    });

    expect(metrics.headingWeight).toBeGreaterThanOrEqual(800);
    expect(metrics.headingLineHeight / metrics.headingFontSize).toBeGreaterThanOrEqual(1.1);
    expect(metrics.headingLetterSpacing).toBe("-3.24px");
    expect(metrics.descriptionWeight).toBeGreaterThanOrEqual(600);
    expect(metrics.inputLineHeight / metrics.inputFontSize).toBeGreaterThanOrEqual(1.75);
    expect(metrics.sideGap).toBeGreaterThanOrEqual(18);
    expect(metrics.sideButtonHeight).toBeGreaterThanOrEqual(48);
  }, 90_000);

  it("keeps an untouched workspace semantically empty and aligns the sidebar with the input card", async () => {
    if (!browser) throw new Error("Browser was not started");
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    await page.addInitScript((storageKey) => window.localStorage.removeItem(storageKey), CURRENT_WORKPACK_STORAGE_KEY);
    await page.goto(`${baseUrl}/workspace?theme=day`, { waitUntil: "networkidle" });
    expect(await page.locator("#field-command-input").inputValue()).toBe("");
    await page.waitForFunction(() => !document.querySelector(".workspace-current-brief"));

    const metrics = await page.evaluate(() => {
      const side = document.querySelector<HTMLElement>(".workspace-side-nav");
      const main = document.querySelector<HTMLElement>(".command-main-studio");
      if (!side || !main) throw new Error("Missing empty workspace columns");
      const sideRect = side.getBoundingClientRect();
      const mainRect = main.getBoundingClientRect();
      return {
        currentBriefs: document.querySelectorAll(".workspace-current-brief").length,
        sourceStatuses: document.querySelectorAll(".workspace-source-status").length,
        recentLists: document.querySelectorAll(".workspace-recent-list").length,
        topDelta: Math.abs(sideRect.top - mainRect.top),
        bottomDelta: Math.abs(sideRect.bottom - mainRect.bottom),
        overflowY: getComputedStyle(side).overflowY,
        hasScroll: side.scrollHeight > side.clientHeight + 1
      };
    });

    expect(metrics.currentBriefs).toBe(0);
    expect(metrics.sourceStatuses).toBe(0);
    expect(metrics.recentLists).toBe(0);
    expect(metrics.topDelta).toBeLessThanOrEqual(1);
    expect(metrics.bottomDelta).toBeLessThanOrEqual(1);
    expect(metrics.overflowY).toBe("visible");
    expect(metrics.hasScroll).toBe(false);
    await page.close();
  }, 90_000);

  it("keeps a filled workspace rail aligned without an independent desktop scrollbar", async () => {
    if (!browser) throw new Error("Browser was not started");
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    await page.addInitScript((storageKey) => window.localStorage.removeItem(storageKey), CURRENT_WORKPACK_STORAGE_KEY);
    await page.goto(`${baseUrl}/workspace?scenario=seoul-construction-windy&theme=day`, { waitUntil: "networkidle" });

    const metrics = await page.evaluate(() => {
      const side = document.querySelector<HTMLElement>(".workspace-side-nav");
      const main = document.querySelector<HTMLElement>(".command-main-studio");
      if (!side || !main) throw new Error("Missing filled workspace columns");
      const sideRect = side.getBoundingClientRect();
      const mainRect = main.getBoundingClientRect();
      return {
        bottomDelta: Math.abs(sideRect.bottom - mainRect.bottom),
        overflowY: getComputedStyle(side).overflowY,
        hasScroll: side.scrollHeight > side.clientHeight + 1
      };
    });

    expect(metrics.bottomDelta).toBeLessThanOrEqual(1);
    expect(metrics.overflowY).toBe("visible");
    expect(metrics.hasScroll).toBe(false);
    await page.close();
  }, 90_000);

  it("keeps the day workspace shell from overlapping the first-screen composer", async () => {
    if (!browser) throw new Error("Browser was not started");
    const page = await browser.newPage({ viewport: { width: 1600, height: 820 } });
    await page.goto(`${baseUrl}/workspace?theme=day`, { waitUntil: "networkidle" });

    const metrics = await page.evaluate(() => {
      function readRect(selector: string) {
        const element = document.querySelector(selector);
        if (!element) throw new Error(`Missing layout target: ${selector}`);
        const rect = element.getBoundingClientRect();
        const style = getComputedStyle(element);
        return {
          top: Math.round(rect.top),
          right: Math.round(rect.right),
          bottom: Math.round(rect.bottom),
          left: Math.round(rect.left),
          width: Math.round(rect.width),
          height: Math.round(rect.height),
          borderTopWidth: Number.parseFloat(style.borderTopWidth),
          backgroundColor: style.backgroundColor,
          scrollTop: element instanceof HTMLTextAreaElement ? element.scrollTop : 0,
          clientHeight: element instanceof HTMLTextAreaElement ? element.clientHeight : Math.round(rect.height),
          scrollHeight: element instanceof HTMLTextAreaElement ? element.scrollHeight : Math.round(rect.height)
        };
      }

      const topbar = readRect(".command-topbar");
      const viewport = readRect(".command-viewport");
      const sideNav = readRect(".workspace-side-nav");
      const main = readRect(".command-main");
      const heading = readRect(".workspace-input-page .command-copy h1");
      const textarea = readRect(".workspace-input-page .command-console-input");

      return {
        topbar,
        viewport,
        sideNav,
        main,
        heading,
        textarea
      };
    });

    expect(metrics.topbar.bottom).toBeLessThanOrEqual(metrics.viewport.top - 8);
    expect(metrics.sideNav.right).toBeLessThanOrEqual(metrics.main.left - 8);
    expect(metrics.heading.bottom).toBeLessThanOrEqual(metrics.textarea.top - 16);
    expect(metrics.textarea.borderTopWidth).toBeGreaterThanOrEqual(1);
    expect(metrics.textarea.backgroundColor).not.toBe("rgba(0, 0, 0, 0)");
    expect(metrics.textarea.scrollTop).toBe(0);
    expect(metrics.textarea.clientHeight).toBeGreaterThanOrEqual(140);
    expect(metrics.textarea.scrollHeight).toBeLessThanOrEqual(metrics.textarea.clientHeight + 96);
  }, 90_000);

  it("keeps filled day input text clear on wide short presentation screens", async () => {
    if (!browser) throw new Error("Browser was not started");
    const page = await browser.newPage({ viewport: { width: 2048, height: 638 } });
    await page.goto(`${baseUrl}/workspace?theme=day`, { waitUntil: "networkidle" });
    await page.fill(
      "#field-command-input",
      "세이프건설 서울 성수동 근린생활시설 외벽 도장 작업. 이동식 비계 사용, 작업자 5명, 신규 투입자 1명, 오후 강풍 예보, 추락과 지게차 동선 위험을 반영해 오늘 위험성평가와 TBM, 안전보건교육 기록을 만들어줘."
    );

    const metrics = await page.evaluate(() => {
      function readRect(selector: string) {
        const element = document.querySelector(selector);
        if (!element) throw new Error(`Missing layout target: ${selector}`);
        const rect = element.getBoundingClientRect();
        const style = getComputedStyle(element);
        return {
          top: Math.round(rect.top),
          bottom: Math.round(rect.bottom),
          left: Math.round(rect.left),
          right: Math.round(rect.right),
          width: Math.round(rect.width),
          height: Math.round(rect.height),
          position: style.position,
          overflowY: style.overflowY,
          paddingTop: Number.parseFloat(style.paddingTop),
          paddingBottom: Number.parseFloat(style.paddingBottom),
          lineHeight: Number.parseFloat(style.lineHeight),
          fontSize: Number.parseFloat(style.fontSize),
          scrollTop: element instanceof HTMLTextAreaElement ? element.scrollTop : 0,
          clientHeight: element instanceof HTMLTextAreaElement ? element.clientHeight : Math.round(rect.height),
          scrollHeight: element instanceof HTMLTextAreaElement ? element.scrollHeight : Math.round(rect.height)
        };
      }

      const topbar = readRect(".command-topbar");
      const viewport = readRect(".command-viewport");
      const sideNav = readRect(".workspace-side-nav");
      const main = readRect(".command-main");
      const heading = readRect(".workspace-input-page .command-copy h1");
      const textarea = readRect("#field-command-input");
      const helper = readRect("#field-command-tips");

      return {
        topbar,
        viewport,
        sideNav,
        main,
        heading,
        textarea,
        helper
      };
    });

    expect(metrics.topbar.position).toBe("relative");
    expect(metrics.topbar.height).toBeLessThanOrEqual(74);
    expect(metrics.topbar.left).toBeGreaterThanOrEqual(320);
    expect(metrics.topbar.right).toBeLessThanOrEqual(1728);
    expect(metrics.viewport.left).toBe(metrics.topbar.left);
    expect(metrics.viewport.right).toBe(metrics.topbar.right);
    expect(metrics.topbar.bottom).toBeLessThanOrEqual(metrics.viewport.top - 8);
    expect(metrics.sideNav.top).toBe(metrics.viewport.top);
    expect(metrics.sideNav.bottom).toBeLessThanOrEqual(639);
    expect(metrics.sideNav.overflowY).toBe("auto");
    expect(metrics.sideNav.right).toBeLessThanOrEqual(metrics.main.left - 8);
    expect(metrics.heading.bottom).toBeLessThanOrEqual(metrics.textarea.top - 96);
    expect(metrics.textarea.paddingTop).toBeGreaterThanOrEqual(20);
    expect(metrics.textarea.paddingBottom).toBeGreaterThanOrEqual(20);
    expect(metrics.textarea.lineHeight / metrics.textarea.fontSize).toBeGreaterThanOrEqual(1.72);
    expect(metrics.textarea.scrollTop).toBe(0);
    expect(metrics.textarea.clientHeight).toBeGreaterThanOrEqual(150);
    expect(metrics.textarea.scrollHeight).toBeLessThanOrEqual(metrics.textarea.clientHeight + 24);
    expect(metrics.helper.top).toBeGreaterThanOrEqual(metrics.textarea.bottom + 16);
  }, 90_000);

  it("keeps the default day route in stable flow without topbar/input overlap", async () => {
    if (!browser) throw new Error("Browser was not started");
    const page = await browser.newPage({ viewport: { width: 2048, height: 638 } });
    await page.goto(`${baseUrl}/workspace`, { waitUntil: "networkidle" });
    await page.fill(
      "#field-command-input",
      "세이프건설 서울 성수동 근린생활시설 외벽 도장 작업. 이동식 비계 사용, 작업자 5명, 신규 투입자 1명, 오후 강풍 예보, 추락과 지게차 동선 위험을 반영해 오늘 위험성평가와 TBM, 안전보건교육 기록을 만들어줘."
    );

    const metrics = await page.evaluate(() => {
      function readRect(selector: string) {
        const element = document.querySelector(selector);
        if (!element) throw new Error(`Missing layout target: ${selector}`);
        const rect = element.getBoundingClientRect();
        const style = getComputedStyle(element);
        return {
          top: Math.round(rect.top),
          bottom: Math.round(rect.bottom),
          left: Math.round(rect.left),
          right: Math.round(rect.right),
          width: Math.round(rect.width),
          height: Math.round(rect.height),
          position: style.position,
          overflowY: style.overflowY,
          paddingTop: Number.parseFloat(style.paddingTop),
          lineHeight: Number.parseFloat(style.lineHeight),
          fontSize: Number.parseFloat(style.fontSize),
          scrollTop: element instanceof HTMLTextAreaElement ? element.scrollTop : 0,
          clientHeight: element instanceof HTMLTextAreaElement ? element.clientHeight : Math.round(rect.height),
          scrollHeight: element instanceof HTMLTextAreaElement ? element.scrollHeight : Math.round(rect.height)
        };
      }

      return {
        viewportWidth: window.innerWidth,
        scrollWidth: document.documentElement.scrollWidth,
        topbar: readRect(".command-topbar"),
        viewport: readRect(".command-viewport"),
        sideNav: readRect(".workspace-side-nav"),
        main: readRect(".linear-workspace-layout .command-main"),
        heading: readRect(".workspace-input-page .command-copy h1"),
        textarea: readRect("#field-command-input"),
        composer: readRect(".input-composer-tray")
      };
    });

    expect(metrics.scrollWidth).toBeLessThanOrEqual(metrics.viewportWidth);
    expect(metrics.topbar.position).toBe("relative");
    expect(metrics.topbar.bottom).toBeLessThanOrEqual(metrics.viewport.top - 8);
    expect(metrics.topbar.left).toBe(metrics.viewport.left);
    expect(metrics.topbar.right).toBe(metrics.viewport.right);
    expect(metrics.sideNav.right).toBeLessThanOrEqual(metrics.main.left - 8);
    expect(metrics.heading.bottom).toBeLessThanOrEqual(metrics.textarea.top - 96);
    expect(metrics.textarea.paddingTop).toBeGreaterThanOrEqual(20);
    expect(metrics.textarea.lineHeight / metrics.textarea.fontSize).toBeGreaterThanOrEqual(1.72);
    expect(metrics.textarea.scrollTop).toBe(0);
    expect(metrics.textarea.scrollHeight).toBeLessThanOrEqual(metrics.textarea.clientHeight + 24);
    expect(metrics.textarea.bottom).toBeLessThanOrEqual(metrics.composer.top - 72);
  }, 90_000);

  it("keeps the day composer submit action visible on scaled presentation screens", async () => {
    if (!browser) throw new Error("Browser was not started");
    const scenarios = [
      { width: 1638, height: 510 },
      { width: 1365, height: 425 }
    ];

    for (const viewport of scenarios) {
      const page = await browser.newPage({ viewport });
      await page.goto(`${baseUrl}/workspace?theme=day`, { waitUntil: "networkidle" });
      await page.fill(
        "#field-command-input",
        "세이프건설 서울 성수동 근린생활시설 외벽 도장 작업. 이동식 비계 사용, 작업자 5명, 신규 투입자 1명, 오후 강풍 예보, 추락과 지게차 동선 위험을 반영해 오늘 위험성평가와 TBM, 안전보건교육 기록을 만들어줘."
      );

      const metrics = await page.evaluate(() => {
        function readRect(selector: string) {
          const element = document.querySelector(selector);
          if (!element) throw new Error(`Missing layout target: ${selector}`);
          const rect = element.getBoundingClientRect();
          const style = getComputedStyle(element);
          return {
            top: Math.round(rect.top),
            bottom: Math.round(rect.bottom),
            left: Math.round(rect.left),
            right: Math.round(rect.right),
            width: Math.round(rect.width),
            height: Math.round(rect.height),
            display: style.display,
            scrollTop: element instanceof HTMLTextAreaElement ? element.scrollTop : 0,
            clientHeight: element instanceof HTMLTextAreaElement ? element.clientHeight : Math.round(rect.height),
            scrollHeight: element instanceof HTMLTextAreaElement ? element.scrollHeight : Math.round(rect.height)
          };
        }

        return {
          viewportHeight: window.innerHeight,
          viewportWidth: window.innerWidth,
          scrollWidth: document.documentElement.scrollWidth,
          textarea: readRect("#field-command-input"),
          composer: readRect(".input-composer-tray"),
          submit: readRect(".composer-submit-button"),
          fieldChips: readRect(".field-brief-chip-row"),
          evidenceRail: readRect(".evidence-readiness-rail")
        };
      });

      expect(metrics.scrollWidth).toBeLessThanOrEqual(metrics.viewportWidth);
      expect(metrics.textarea.scrollTop).toBe(0);
      expect(metrics.textarea.scrollHeight).toBeLessThanOrEqual(metrics.textarea.clientHeight + 36);
      expect(metrics.composer.bottom).toBeLessThanOrEqual(metrics.viewportHeight - 8);
      expect(metrics.submit.bottom).toBeLessThanOrEqual(metrics.viewportHeight - 8);
      expect(metrics.submit.left).toBeGreaterThan(metrics.textarea.left);
      expect(metrics.fieldChips.display).toBe("none");
      expect(metrics.evidenceRail.display).toBe("none");
      await page.close();
    }
  }, 90_000);

  it("keeps filled day input stable on zoom-sized short presentation screens", async () => {
    if (!browser) throw new Error("Browser was not started");
    const page = await browser.newPage({ viewport: { width: 1440, height: 460 } });
    await page.goto(`${baseUrl}/workspace?theme=day`, { waitUntil: "networkidle" });
    await page.fill(
      "#field-command-input",
      "세이프건설 서울 성수동 근린생활시설 외벽 도장 작업. 이동식 비계 사용, 작업자 5명, 신규 투입자 1명, 오후 강풍 예보, 추락과 지게차 동선 위험을 반영해 오늘 위험성평가와 TBM, 안전보건교육 기록을 만들어줘."
    );

    const metrics = await page.evaluate(() => {
      function readRect(selector: string) {
        const element = document.querySelector(selector);
        if (!element) throw new Error(`Missing layout target: ${selector}`);
        const rect = element.getBoundingClientRect();
        const style = getComputedStyle(element);
        return {
          top: Math.round(rect.top),
          bottom: Math.round(rect.bottom),
          left: Math.round(rect.left),
          right: Math.round(rect.right),
          width: Math.round(rect.width),
          height: Math.round(rect.height),
          paddingTop: Number.parseFloat(style.paddingTop),
          paddingBottom: Number.parseFloat(style.paddingBottom),
          scrollTop: element instanceof HTMLTextAreaElement ? element.scrollTop : 0,
          clientHeight: element instanceof HTMLTextAreaElement ? element.clientHeight : Math.round(rect.height),
          scrollHeight: element instanceof HTMLTextAreaElement ? element.scrollHeight : Math.round(rect.height)
        };
      }

      const topbar = readRect(".command-topbar");
      const viewport = readRect(".command-viewport");
      const sideNav = readRect(".workspace-side-nav");
      const main = readRect(".linear-workspace-layout .command-main");
      const heading = readRect(".workspace-input-page .command-copy h1");
      const textarea = readRect("#field-command-input");
      const helper = readRect("#field-command-tips");

      return {
        scrollY: Math.round(window.scrollY),
        viewportHeight: window.innerHeight,
        inputPageCount: document.querySelectorAll(".workspace-input-page").length,
        mainHasLegacyPageClass: Boolean(document.querySelector(".linear-workspace-layout .command-main.workspace-input-page")),
        topbar,
        viewport,
        sideNav,
        main,
        heading,
        textarea,
        helper
      };
    });

    expect(metrics.inputPageCount).toBe(1);
    expect(metrics.mainHasLegacyPageClass).toBe(false);
    expect(metrics.scrollY).toBeLessThanOrEqual(4);
    expect(metrics.topbar.bottom).toBeLessThanOrEqual(metrics.viewport.top - 8);
    expect(metrics.sideNav.right).toBeLessThanOrEqual(metrics.main.left - 8);
    expect(metrics.heading.bottom).toBeLessThanOrEqual(metrics.textarea.top - 20);
    expect(metrics.textarea.top).toBeGreaterThan(metrics.heading.bottom);
    expect(metrics.textarea.bottom).toBeLessThanOrEqual(metrics.viewportHeight - 8);
    expect(metrics.textarea.scrollTop).toBe(0);
    expect(metrics.textarea.scrollHeight).toBeLessThanOrEqual(metrics.textarea.clientHeight + 28);
    expect(metrics.helper.top).toBeGreaterThanOrEqual(metrics.textarea.bottom + 10);
  }, 90_000);

  it("keeps zoom-like compact day screens free of composer overlap", async () => {
    if (!browser) throw new Error("Browser was not started");
    const page = await browser.newPage({ viewport: { width: 1024, height: 430 } });
    await page.goto(`${baseUrl}/workspace?theme=day`, { waitUntil: "networkidle" });
    await page.fill(
      "#field-command-input",
      "세이프건설 서울 성수동 근린생활시설 외벽 도장 작업. 이동식 비계 사용, 작업자 5명, 신규 투입자 1명, 오후 강풍 예보, 추락과 지게차 동선 위험을 반영해 오늘 위험성평가와 TBM, 안전보건교육 기록을 만들어줘."
    );

    const metrics = await page.evaluate(() => {
      function readRect(selector: string) {
        const element = document.querySelector(selector);
        if (!element) throw new Error(`Missing layout target: ${selector}`);
        const rect = element.getBoundingClientRect();
        const style = getComputedStyle(element);
        return {
          top: Math.round(rect.top),
          bottom: Math.round(rect.bottom),
          left: Math.round(rect.left),
          right: Math.round(rect.right),
          width: Math.round(rect.width),
          height: Math.round(rect.height),
          display: style.display,
          overflowY: style.overflowY,
          lineHeight: Number.parseFloat(style.lineHeight),
          fontSize: Number.parseFloat(style.fontSize),
          scrollTop: element instanceof HTMLTextAreaElement ? element.scrollTop : 0,
          clientHeight: element instanceof HTMLTextAreaElement ? element.clientHeight : Math.round(rect.height),
          scrollHeight: element instanceof HTMLTextAreaElement ? element.scrollHeight : Math.round(rect.height)
        };
      }

      const topbar = readRect(".command-topbar");
      const viewport = readRect(".command-viewport");
      const sideNav = readRect(".workspace-side-nav");
      const main = readRect(".linear-workspace-layout .command-main");
      const heading = readRect(".workspace-input-page .command-copy h1");
      const textarea = readRect("#field-command-input");
      const helper = readRect("#field-command-tips");
      const composer = readRect(".input-composer-tray");
      const currentBrief = readRect(".workspace-current-brief");

      return {
        viewportWidth: window.innerWidth,
        viewportHeight: window.innerHeight,
        scrollWidth: document.documentElement.scrollWidth,
        topbar,
        viewport,
        sideNav,
        main,
        heading,
        textarea,
        helper,
        composer,
        currentBrief
      };
    });

    expect(metrics.scrollWidth).toBeLessThanOrEqual(metrics.viewportWidth);
    expect(metrics.topbar.bottom).toBeLessThanOrEqual(metrics.viewport.top - 8);
    expect(metrics.sideNav.right).toBeLessThanOrEqual(metrics.main.left - 8);
    expect(metrics.sideNav.bottom).toBeLessThanOrEqual(metrics.viewportHeight);
    expect(metrics.sideNav.overflowY).toBe("auto");
    expect(metrics.heading.bottom).toBeLessThanOrEqual(metrics.textarea.top - 16);
    expect(metrics.textarea.height).toBeGreaterThanOrEqual(118);
    expect(metrics.textarea.lineHeight / metrics.textarea.fontSize).toBeGreaterThanOrEqual(1.6);
    expect(metrics.textarea.bottom).toBeLessThanOrEqual(metrics.composer.top - 14);
    expect(metrics.textarea.scrollTop).toBe(0);
    expect(metrics.textarea.scrollHeight).toBeLessThanOrEqual(metrics.textarea.clientHeight + 36);
    expect(metrics.helper.display).toBe("none");
    expect(metrics.currentBrief.display).toBe("none");
    expect(metrics.composer.bottom).toBeLessThanOrEqual(metrics.viewportHeight - 8);
  }, 90_000);

  it("keeps high-zoom short day screens from clipping the composer", async () => {
    if (!browser) throw new Error("Browser was not started");
    const page = await browser.newPage({ viewport: { width: 1170, height: 365 } });
    await page.goto(`${baseUrl}/workspace?theme=day`, { waitUntil: "networkidle" });
    await page.fill(
      "#field-command-input",
      "세이프건설 서울 성수동 근린생활시설 외벽 도장 작업. 이동식 비계 사용, 작업자 5명, 신규 투입자 1명, 오후 강풍 예보, 추락과 지게차 동선 위험을 반영해 오늘 위험성평가와 TBM, 안전보건교육 기록을 만들어줘."
    );

    const metrics = await page.evaluate(() => {
      function readRect(selector: string) {
        const element = document.querySelector(selector);
        if (!element) throw new Error(`Missing layout target: ${selector}`);
        const rect = element.getBoundingClientRect();
        const style = getComputedStyle(element);
        return {
          top: Math.round(rect.top),
          bottom: Math.round(rect.bottom),
          left: Math.round(rect.left),
          right: Math.round(rect.right),
          width: Math.round(rect.width),
          height: Math.round(rect.height),
          display: style.display,
          paddingTop: Number.parseFloat(style.paddingTop),
          paddingBottom: Number.parseFloat(style.paddingBottom),
          lineHeight: Number.parseFloat(style.lineHeight),
          fontSize: Number.parseFloat(style.fontSize),
          scrollTop: element instanceof HTMLTextAreaElement ? element.scrollTop : 0,
          clientHeight: element instanceof HTMLTextAreaElement ? element.clientHeight : Math.round(rect.height),
          scrollHeight: element instanceof HTMLTextAreaElement ? element.scrollHeight : Math.round(rect.height)
        };
      }

      const topbar = readRect(".command-topbar");
      const viewport = readRect(".command-viewport");
      const sideNav = readRect(".workspace-side-nav");
      const main = readRect(".linear-workspace-layout .command-main");
      const copy = readRect(".workspace-input-page .command-copy");
      const heading = readRect(".workspace-input-page .command-copy h1");
      const textarea = readRect("#field-command-input");
      const helper = readRect("#field-command-tips");
      const composer = readRect(".input-composer-tray");
      const currentBrief = readRect(".workspace-current-brief");
      const sourceStatus = readRect(".workspace-source-status");
      const recentList = readRect(".workspace-recent-list");

      return {
        viewportWidth: window.innerWidth,
        viewportHeight: window.innerHeight,
        scrollWidth: document.documentElement.scrollWidth,
        topbar,
        viewport,
        sideNav,
        main,
        copy,
        heading,
        textarea,
        helper,
        composer,
        currentBrief,
        sourceStatus,
        recentList
      };
    });

    expect(metrics.scrollWidth).toBeLessThanOrEqual(metrics.viewportWidth);
    expect(metrics.topbar.bottom).toBeLessThanOrEqual(metrics.viewport.top - 8);
    expect(metrics.sideNav.right).toBeLessThanOrEqual(metrics.main.left - 8);
    expect(metrics.copy.display).toBe("none");
    expect(metrics.heading.bottom).toBeLessThanOrEqual(metrics.textarea.top - 14);
    expect(metrics.textarea.top).toBeGreaterThan(metrics.heading.bottom);
    expect(metrics.textarea.height).toBeGreaterThanOrEqual(108);
    expect(metrics.textarea.bottom).toBeLessThanOrEqual(metrics.composer.top - 10);
    expect(metrics.textarea.paddingTop).toBeGreaterThanOrEqual(12);
    expect(metrics.textarea.paddingBottom).toBeGreaterThanOrEqual(12);
    expect(metrics.textarea.lineHeight / metrics.textarea.fontSize).toBeGreaterThanOrEqual(1.68);
    expect(metrics.textarea.scrollTop).toBe(0);
    expect(metrics.textarea.scrollHeight).toBeLessThanOrEqual(metrics.textarea.clientHeight + 44);
    expect(metrics.helper.display).toBe("none");
    expect(metrics.currentBrief.display).toBe("none");
    expect(metrics.sourceStatus.display).toBe("none");
    expect(metrics.recentList.display).toBe("none");
    expect(metrics.composer.bottom).toBeLessThanOrEqual(metrics.viewportHeight - 6);
  }, 90_000);

  it("keeps ultra-short zoomed day screens from clipping the input action", async () => {
    if (!browser) throw new Error("Browser was not started");
    const page = await browser.newPage({ viewport: { width: 1024, height: 319 }, deviceScaleFactor: 2 });
    await page.goto(`${baseUrl}/workspace?theme=day`, { waitUntil: "networkidle" });
    await page.fill(
      "#field-command-input",
      "세이프건설 서울 성수동 근린생활시설 외벽 도장 작업. 이동식 비계 사용, 작업자 5명, 신규 투입자 1명, 오후 강풍 예보, 추락과 지게차 동선 위험을 반영해 오늘 위험성평가와 TBM, 안전보건교육 기록을 만들어줘."
    );

    const metrics = await page.evaluate(() => {
      function readRect(selector: string) {
        const element = document.querySelector(selector);
        if (!element) throw new Error(`Missing layout target: ${selector}`);
        const rect = element.getBoundingClientRect();
        const style = getComputedStyle(element);
        return {
          top: Math.round(rect.top),
          bottom: Math.round(rect.bottom),
          left: Math.round(rect.left),
          right: Math.round(rect.right),
          width: Math.round(rect.width),
          height: Math.round(rect.height),
          display: style.display,
          overflowY: style.overflowY,
          paddingTop: Number.parseFloat(style.paddingTop),
          paddingBottom: Number.parseFloat(style.paddingBottom),
          lineHeight: Number.parseFloat(style.lineHeight),
          fontSize: Number.parseFloat(style.fontSize),
          scrollTop: element instanceof HTMLTextAreaElement ? element.scrollTop : 0,
          clientHeight: element instanceof HTMLTextAreaElement ? element.clientHeight : Math.round(rect.height),
          scrollHeight: element instanceof HTMLTextAreaElement ? element.scrollHeight : Math.round(rect.height)
        };
      }

      const topbar = readRect(".command-topbar");
      const viewport = readRect(".command-viewport");
      const sideNav = readRect(".workspace-side-nav");
      const main = readRect(".linear-workspace-layout .command-main");
      const copy = readRect(".workspace-input-page .command-copy");
      const textarea = readRect("#field-command-input");
      const helper = readRect("#field-command-tips");
      const composer = readRect(".input-composer-tray");

      return {
        viewportWidth: window.innerWidth,
        viewportHeight: window.innerHeight,
        scrollWidth: document.documentElement.scrollWidth,
        topbar,
        viewport,
        sideNav,
        main,
        copy,
        textarea,
        helper,
        composer
      };
    });

    expect(metrics.scrollWidth).toBeLessThanOrEqual(metrics.viewportWidth);
    expect(metrics.topbar.bottom).toBeLessThanOrEqual(metrics.viewport.top - 6);
    expect(metrics.sideNav.right).toBeLessThanOrEqual(metrics.main.left - 6);
    expect(metrics.sideNav.bottom).toBeLessThanOrEqual(metrics.viewportHeight);
    expect(metrics.sideNav.overflowY).toBe("auto");
    expect(metrics.copy.display).toBe("none");
    expect(metrics.textarea.top).toBeGreaterThanOrEqual(metrics.viewport.top + 8);
    expect(metrics.textarea.height).toBeGreaterThanOrEqual(104);
    expect(metrics.textarea.paddingTop).toBeGreaterThanOrEqual(14);
    expect(metrics.textarea.paddingBottom).toBeGreaterThanOrEqual(14);
    expect(metrics.textarea.lineHeight / metrics.textarea.fontSize).toBeGreaterThanOrEqual(1.68);
    expect(metrics.textarea.scrollTop).toBe(0);
    expect(metrics.textarea.scrollHeight).toBeLessThanOrEqual(metrics.textarea.clientHeight + 42);
    expect(metrics.helper.display).toBe("none");
    expect(metrics.textarea.bottom).toBeLessThanOrEqual(metrics.composer.top - 8);
    expect(metrics.composer.bottom).toBeLessThanOrEqual(metrics.viewportHeight - 6);
  }, 90_000);

  it("keeps the mobile day composer action inside the first viewport", async () => {
    if (!browser) throw new Error("Browser was not started");
    const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3 });
    const mobileQuestion = "세이프건설 서울 성수동 근린생활시설 외벽 도장 작업. 이동식 비계 사용, 작업자 5명, 신규 투입자 1명, 오후 강풍 예보, 추락과 지게차 동선 위험을 반영해 오늘 위험성평가와 TBM, 안전보건교육 기록을 만들어줘.";
    await page.goto(`${baseUrl}/workspace?theme=day`, { waitUntil: "networkidle" });
    await page.waitForFunction(async () => {
      const textarea = document.querySelector("#field-command-input");
      if (!(textarea instanceof HTMLTextAreaElement) || textarea.value !== "") return false;
      await new Promise<void>((resolve) => {
        window.requestAnimationFrame(() => window.requestAnimationFrame(() => resolve()));
      });
      return textarea.isConnected && textarea.value === "";
    });
    await page.fill("#field-command-input", mobileQuestion);
    await page.waitForFunction(
      async (expectedValue) => {
        const textarea = document.querySelector("#field-command-input");
        if (!(textarea instanceof HTMLTextAreaElement)) return false;
        await new Promise<void>((resolve) => {
          window.requestAnimationFrame(() => window.requestAnimationFrame(() => resolve()));
        });
        return textarea.value === expectedValue;
      },
      mobileQuestion
    );
    expect(await page.inputValue("#field-command-input")).toBe(mobileQuestion);

    const metrics = await page.evaluate(() => {
      function readRect(selector: string) {
        const element = document.querySelector(selector);
        if (!element) throw new Error(`Missing layout target: ${selector}`);
        const rect = element.getBoundingClientRect();
        const style = getComputedStyle(element);
        return {
          top: Math.round(rect.top),
          bottom: Math.round(rect.bottom),
          left: Math.round(rect.left),
          right: Math.round(rect.right),
          width: Math.round(rect.width),
          height: Math.round(rect.height),
          display: style.display,
          lineHeight: Number.parseFloat(style.lineHeight),
          fontSize: Number.parseFloat(style.fontSize),
          scrollTop: element instanceof HTMLTextAreaElement ? element.scrollTop : 0,
          clientHeight: element instanceof HTMLTextAreaElement ? element.clientHeight : Math.round(rect.height),
          scrollHeight: element instanceof HTMLTextAreaElement ? element.scrollHeight : Math.round(rect.height)
        };
      }

      return {
        viewportWidth: window.innerWidth,
        viewportHeight: window.innerHeight,
        scrollWidth: document.documentElement.scrollWidth,
        sideNav: readRect(".workspace-side-nav"),
        main: readRect(".linear-workspace-layout .command-main"),
        heading: readRect(".workspace-input-page .command-copy h1"),
        description: readRect(".workspace-input-page .command-copy p"),
        textarea: readRect("#field-command-input"),
        helper: readRect("#field-command-tips"),
        composer: readRect(".input-composer-tray"),
        submit: readRect(".composer-submit-button")
      };
    });

    expect(metrics.scrollWidth).toBeLessThanOrEqual(metrics.viewportWidth);
    expect(metrics.sideNav.bottom).toBeLessThanOrEqual(metrics.main.top - 8);
    expect(metrics.description.display).toBe("none");
    expect(metrics.heading.fontSize).toBeLessThanOrEqual(34);
    expect(metrics.textarea.top).toBeGreaterThanOrEqual(metrics.heading.bottom + 28);
    expect(metrics.textarea.lineHeight / metrics.textarea.fontSize).toBeGreaterThanOrEqual(1.65);
    expect(metrics.textarea.scrollTop).toBe(0);
    expect(metrics.textarea.scrollHeight).toBeLessThanOrEqual(metrics.textarea.clientHeight + 36);
    expect(metrics.helper.bottom).toBeLessThanOrEqual(metrics.composer.top - 12);
    expect(metrics.submit.bottom).toBeLessThanOrEqual(metrics.viewportHeight - 48);
  }, 90_000);

  it("shows honest indeterminate feedback while template generation has no stream", async () => {
    if (!browser) throw new Error("Browser was not started");
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
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
      await new Promise((resolve) => setTimeout(resolve, 1_200));
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(sample)
      });
    });

    await page.goto(`${baseUrl}/workspace?scenario=seoul-construction-windy&theme=day`, { waitUntil: "networkidle" });
    await page.getByRole("button", { name: /안전 문서 생성/ }).click();
    const progress = page.locator(".document-progress-summary");
    await progress.waitFor({ state: "visible" });
    expect(await progress.textContent()).toContain("생성 중");
    expect(await progress.textContent()).not.toContain("3/12");
    await expect.poll(async () => page.locator(".document-review-meter").getAttribute("class")).toContain("indeterminate");
    await page.locator(".document-preview-pane").waitFor({ state: "visible" });
  }, 90_000);

  it("keeps the generated document edit flow inside the workspace design system", async () => {
    if (!browser) throw new Error("Browser was not started");
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    const sample = buildSampleWorkpack();
    const packet = buildDbHarnessPacket({
      question: sample.question,
      references: [
        {
          id: "ref-risk-guardrail",
          source_id: "kosha-demo",
          item_type: "technical-guideline",
          category: "추락",
          subcategory: "비계",
          title: "이동식 비계 추락 예방 지침",
          summary: "외벽 도장 작업 전 난간, 작업발판, 아웃트리거 상태를 확인합니다.",
          keywords: ["외벽도장", "비계", "추락"],
          risk_tags: ["fall"],
          primary_documents: ["위험성평가표", "TBM 브리핑", "TBM 기록"],
          controls: ["난간·작업발판·아웃트리거 확인", "강풍 시 상부 작업 중지"],
          evidence_role: "direct",
          retrieval_source: "ranked"
        },
        {
          id: "sif-fall-01",
          source_id: "sif-demo",
          item_type: "sif-case",
          category: "SIF",
          subcategory: "추락",
          title: "외벽 도장 중 이동식 비계 추락 사례",
          summary: "작업발판 가장자리 방호 미흡 상태에서 추락한 유사 사례입니다.",
          keywords: ["외벽도장", "추락", "비계"],
          risk_tags: ["fall"],
          primary_documents: ["위험성평가표", "TBM 브리핑", "TBM 기록"],
          controls: ["작업 전 방호조치 사진 확인", "TBM에서 작업중지 기준 복창"],
          evidence_role: "supporting",
          retrieval_source: "ranked"
        }
      ],
      improvements: [{
        id: "imp-guardrail-photo",
        taskLabel: "성수동 외벽 도장",
        hazardLabel: "작업발판 외측 추락 위험",
        improvementText: "Before/After 사진으로 난간 보강 완료를 확인",
        reflectedDocuments: ["위험성평가표", "TBM 브리핑", "TBM 기록"],
        sourceType: "photo_analysis",
        visionStatus: "analyzed",
        photoPairAttached: true
      }],
      workpackMemory: [{
        id: "wp-prev-guardrail",
        question: "지난 외벽 도장 작업에서 난간 보강 후 TBM 질문을 추가",
        generatedAt: "2026-07-02",
        reflectedDocuments: ["위험성평가표", "TBM 브리핑"],
        statusLabel: "개선 반영"
      }]
    });
    sample.dbHarness = {
      packet,
      promptContext: buildHarnessPromptContext(packet),
      summary: {
        mode: packet.mode,
        llmRole: packet.generationContract.llmRole,
        llmOutputScope: packet.generationContract.llmOutputScope,
        evidenceAuthority: packet.generationContract.evidenceAuthority,
        providerRetryScope: packet.generationContract.providerRetryScope,
        fallbackChainAllowed: packet.generationContract.fallbackChainAllowed,
        genericProseSubstitutionAllowed: packet.generationContract.genericProseSubstitutionAllowed,
        missingEvidencePolicy: packet.generationContract.missingEvidencePolicy,
        directEvidence: packet.directEvidence.length,
        sifCases: packet.sifCases.length,
        supportingEvidence: packet.supportingEvidence.length,
        improvementMemory: packet.improvementMemory.length,
        workpackMemory: packet.workpackMemory.length,
        missingEvidence: packet.generationContract.missingEvidence,
        documentCoverage: packet.generationContract.documentCoverage,
        retrievalContract: packet.retrievalContract,
        ontologyStatus: packet.ontologyChecklist.status
      }
    };
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

    await page.goto(`${baseUrl}/workspace?scenario=seoul-construction-windy&theme=day`, { waitUntil: "networkidle" });
    await page.getByRole("button", { name: /안전 문서 생성/ }).click();
    await page.locator(".document-preview-pane").waitFor({ state: "visible" });
    await page.locator(".doc-card-actions button", { hasText: "편집" }).waitFor({ state: "visible" });
    const progressSummary = await page.locator(".document-progress-summary").textContent();
    expect(progressSummary).toContain("12/12 생성");
    expect(progressSummary).toContain("검수 필요");
    await page.waitForFunction(() => document.querySelector(".document-harness-loop")?.textContent?.includes("근거 고정"));
    const harnessLoop = page.locator(".document-harness-loop");
    await harnessLoop.waitFor({ state: "visible" });
    const harnessLoopText = await harnessLoop.textContent();
    expect(harnessLoopText).toContain("작성 근거 보기");
    expect(harnessLoopText).toContain("근거 고정");
    expect(harnessLoopText).toContain("안전조치 확인");
    expect(harnessLoopText).toContain("이전 개선사항");
    expect(await page.locator(".field-workspace").count()).toBe(0);
    await page.locator(".doc-card-actions button", { hasText: "편집" }).click();
    await page.locator(".document-editor.editor-focus-cue").waitFor({ state: "visible" });
    await page.getByRole("button", { name: "문서 검토로 돌아가기" }).waitFor({ state: "visible" });

    expect(await page.locator(".document-workbench").count()).toBe(0);
    expect(await page.locator(".field-workspace").count()).toBe(1);

    const metrics = await page.evaluate(() => {
      function readRect(selector: string) {
        const element = document.querySelector(selector);
        if (!element) throw new Error(`Missing layout target: ${selector}`);
        const rect = element.getBoundingClientRect();
        const style = getComputedStyle(element);
        return {
          top: Math.round(rect.top),
          bottom: Math.round(rect.bottom),
          left: Math.round(rect.left),
          right: Math.round(rect.right),
          width: Math.round(rect.width),
          height: Math.round(rect.height),
          display: style.display,
          backgroundColor: style.backgroundColor,
          color: style.color,
          borderRadius: Number.parseFloat(style.borderRadius),
          borderTopWidth: Number.parseFloat(style.borderTopWidth),
          overflowX: style.overflowX,
          overflowY: style.overflowY,
          lineHeight: Number.parseFloat(style.lineHeight),
          fontSize: Number.parseFloat(style.fontSize)
        };
      }

      const fieldWorkspace = readRect(".field-workspace");
      const rail = readRect(".workspace-rail");
      const canvas = readRect(".workspace-canvas");
      const side = readRect(".workspace-side");
      const shell = readRect(".workpack-shell");
      const navigator = readRect(".workpack-sidebar");
      const editor = readRect(".document-editor");
      const textarea = readRect(".document-textarea");
      const activeTab = readRect(".doc-tab.active");
      const focusMessage = readRect(".editor-focus-message");
      const desktopTabs = document.querySelector(".doc-tab-list");
      const mobilePicker = document.querySelector('select[aria-label="편집 문서 선택"]')?.parentElement;
      if (!desktopTabs || !mobilePicker) throw new Error("Missing responsive document navigation");

      return {
        viewportWidth: window.innerWidth,
        scrollWidth: document.documentElement.scrollWidth,
        activeElementClass: document.activeElement?.className || "",
        fieldWorkspace,
        rail,
        canvas,
        side,
        shell,
        navigator,
        editor,
        textarea,
        activeTab,
        focusMessage,
        desktopTabsDisplay: getComputedStyle(desktopTabs).display,
        mobilePickerDisplay: getComputedStyle(mobilePicker).display
      };
    });

    expect(metrics.scrollWidth).toBeLessThanOrEqual(metrics.viewportWidth + 1);
    expect(metrics.fieldWorkspace.display).toBe("grid");
    expect(metrics.rail.left).toBeGreaterThanOrEqual(metrics.fieldWorkspace.left);
    expect(metrics.rail.right).toBeLessThanOrEqual(metrics.fieldWorkspace.right);
    expect(metrics.rail.bottom).toBeLessThanOrEqual(Math.min(metrics.canvas.top, metrics.side.top) - 12);
    expect(metrics.canvas.right).toBeLessThanOrEqual(metrics.side.left - 12);
    expect(metrics.shell.display).toBe("grid");
    expect(metrics.navigator.bottom).toBeLessThanOrEqual(metrics.editor.top - 12);
    expect(metrics.desktopTabsDisplay).toBe("none");
    expect(metrics.mobilePickerDisplay).not.toBe("none");
    expect(metrics.shell.backgroundColor).toBe("rgba(0, 0, 0, 0)");
    expect(metrics.editor.backgroundColor).toBe("rgb(255, 255, 255)");
    expect(metrics.editor.color).not.toBe("rgb(246, 245, 239)");
    expect(metrics.editor.borderRadius).toBeGreaterThanOrEqual(9);
    expect(metrics.editor.overflowX).toBe("visible");
    expect(metrics.editor.overflowY).toBe("visible");
    expect(metrics.textarea.backgroundColor).toBe("rgb(255, 255, 255)");
    expect(metrics.textarea.borderTopWidth).toBeGreaterThanOrEqual(1);
    expect(metrics.textarea.lineHeight / metrics.textarea.fontSize).toBeGreaterThanOrEqual(1.68);
    expect(metrics.textarea.width).toBeGreaterThanOrEqual(Math.floor(metrics.shell.width * 0.78));
    expect(metrics.activeTab.backgroundColor).not.toBe("rgb(108, 111, 247)");
    expect(metrics.activeTab.color).not.toBe("rgb(255, 255, 255)");
    expect(metrics.focusMessage.backgroundColor).not.toBe("rgba(14, 14, 18, 0.78)");
    expect(String(metrics.activeElementClass)).toContain("document-textarea");

    await page.getByRole("button", { name: "문서 검토로 돌아가기" }).click();
    await page.locator(".document-preview-pane").waitFor({ state: "visible" });
    expect(await page.locator(".field-workspace").count()).toBe(0);
    expect(await page.locator(".document-workbench").count()).toBe(1);
  }, 90_000);

  it("preserves the edited active document across review and editor remount", async () => {
    if (!browser) throw new Error("Browser was not started");
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    const sample = buildSampleWorkpack();
    const sentinel = "편집안전대책: SAFECLAW_DOCUMENT_EDIT_PRESERVED";
    const proseSentinel = "사용자가 직접 편집한 외벽 도장 작업 안전조치 문장은 내보내기에 반드시 보존됩니다.";
    const regeneratedSentinel = "[SAFECLAW_REGENERATED_TBM]";
    sample.deliverables.tbmBriefingStructured = {
      meta: {
        dateTime: "2026-07-10 08:00",
        location: sample.scenario.siteName,
        target: "전 작업자",
        attendees: "서명 확인"
      },
      todayWork: {
        name: sample.scenario.workSummary,
        location: sample.scenario.siteName,
        time: "08:00 - 17:00",
        equipment: ["이동식 비계"]
      },
      hazards: [{ category: "Machine", description: "생성 시점 구조화 위험요인" }],
      measures: [{ hazardRef: 1, action: "생성 시점 구조화 안전대책", owner: "관리감독자" }],
      stopCriteria: ["강풍 시 작업중지"],
      confirmTopics: ["작업중지 기준 확인"],
      photoEvidenceLocation: "현장 안전 폴더"
    };
    sample.ontologyQa = {
      reviewTask: "외벽 도장",
      result: {
        reviewable: true,
        task: "외벽 도장",
        covered: { hazards: ["추락"], controls: ["작업발판 점검"], articles: [] },
        missing: { hazards: [], controls: [], articles: [] },
        coverageRate: 1,
        verdict: "통과",
        advisory: "검수 통과"
      },
      sourceDocumentKeys: ["riskAssessmentDraft", "tbmBriefing"],
      detail: "안전조치 검수 통과"
    };
    const regeneratedSample = structuredClone(sample);
    regeneratedSample.deliverables.tbmBriefing = `${regeneratedSentinel}\n${sample.deliverables.tbmBriefing}`;
    let generationCount = 0;
    let xlsxPayload: Record<string, unknown> | null = null;
    let hwpPayload: Record<string, unknown> | null = null;
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
      const responseBody = generationCount === 0 ? sample : regeneratedSample;
      generationCount += 1;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(responseBody)
      });
    });
    await page.route("**/api/export/xlsx", async (route) => {
      xlsxPayload = route.request().postDataJSON() as Record<string, unknown>;
      await route.fulfill({
        status: 200,
        contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        body: "xlsx"
      });
    });
    await page.route("**/api/export/hwp", async (route) => {
      hwpPayload = route.request().postDataJSON() as Record<string, unknown>;
      await route.fulfill({
        status: 200,
        contentType: "application/x-hwp",
        body: "hwp"
      });
    });

    await page.goto(`${baseUrl}/workspace?scenario=seoul-construction-windy&theme=day`, { waitUntil: "networkidle" });
    await page.getByRole("button", { name: /안전 문서 생성/ }).click();
    await page.locator(".document-preview-pane").waitFor({ state: "visible" });
    await page.locator(".document-viewer-list button", { hasText: "TBM 브리핑" }).click();
    await page.waitForFunction(() => document.querySelector(".document-preview-head strong")?.textContent === "TBM 브리핑");
    await page.locator(".doc-card-actions button", { hasText: "편집" }).click();

    const editor = page.getByRole("textbox", { name: "TBM/작업 전 안전점검회의 편집" });
    await editor.waitFor({ state: "visible" });
    const editedValue = `${proseSentinel}\n${sentinel}\n${await editor.inputValue()}`;
    await editor.fill(editedValue);
    await page.waitForFunction(
      async (expectedValue) => {
        const textarea = document.querySelector(".document-textarea");
        if (!(textarea instanceof HTMLTextAreaElement) || textarea.value !== expectedValue) return false;
        await new Promise<void>((resolve) => {
          window.requestAnimationFrame(() => window.requestAnimationFrame(() => resolve()));
        });
        return textarea.isConnected && textarea.value === expectedValue;
      },
      editedValue
    );
    expect(await editor.inputValue()).toBe(editedValue);
    const persistedDrafts = await page.evaluate(() => ({
      editor: Object.keys(window.localStorage)
        .filter((key) => key.startsWith("safeclaw-workpack:"))
        .map((key) => window.localStorage.getItem(key) || "")
        .join("\n"),
      current: window.localStorage.getItem("safeclaw.currentWorkpack.v1") || ""
    }));
    expect(persistedDrafts.editor).toContain(sentinel);
    expect(persistedDrafts.current).toContain(sentinel);

    const exportPanel = page.locator('[data-testid="editor-export-panel"]');
    expect(await exportPanel.evaluate((element) => (element as HTMLDetailsElement).open)).toBe(false);
    await page.locator('[data-testid="editor-export-panel"] > summary').click();
    expect(await exportPanel.evaluate((element) => (element as HTMLDetailsElement).open)).toBe(true);

    await page.getByRole("button", { name: "Excel 표 양식(.xlsx)" }).click();
    await expect.poll(() => xlsxPayload?.mode).toBe("tbmBriefingStructured");
    expect((xlsxPayload as Record<string, unknown> | null)?.edited).toBe(true);
    expect((xlsxPayload as Record<string, unknown> | null)?.structured).toBeTruthy();
    expect((xlsxPayload as { rows?: Array<{ content?: unknown }> } | null)?.rows)
      .toEqual(expect.arrayContaining([expect.objectContaining({ content: proseSentinel })]));
    expect((xlsxPayload as { rows?: Array<{ item?: unknown; content?: unknown }> } | null)?.rows)
      .toEqual(expect.arrayContaining([
        expect.objectContaining({ item: "편집안전대책", content: "SAFECLAW_DOCUMENT_EDIT_PRESERVED" })
      ]));

    await page.getByRole("button", { name: "한글 표 양식(.hwp)" }).click();
    await expect.poll(() => hwpPayload).not.toBeNull();
    expect((hwpPayload as Record<string, unknown> | null)?.edited).toBe(true);
    expect((hwpPayload as { rows?: Array<{ content?: unknown }> } | null)?.rows)
      .toEqual(expect.arrayContaining([expect.objectContaining({ content: proseSentinel })]));
    expect((hwpPayload as { rows?: Array<{ item?: unknown; content?: unknown }> } | null)?.rows)
      .toEqual(expect.arrayContaining([
        expect.objectContaining({ item: "편집안전대책", content: "SAFECLAW_DOCUMENT_EDIT_PRESERVED" })
      ]));
    expect(hwpPayload).not.toHaveProperty("riskAssessmentRows");

    const invalidatedReview = await page.evaluate(() => {
      const raw = window.localStorage.getItem("safeclaw.currentWorkpack.v1");
      if (!raw) return null;
      const stored = JSON.parse(raw) as { data?: Record<string, unknown> };
      return stored.data || null;
    });
    expect(invalidatedReview).not.toHaveProperty("ontologyQa");
    expect(invalidatedReview).not.toHaveProperty("dbHarness");

    await page.getByRole("button", { name: "문서 검토로 돌아가기" }).click();
    await page.locator(".document-preview-pane").waitFor({ state: "visible" });
    expect(await page.locator(".document-preview-pane pre").textContent()).toContain(sentinel);
    expect(await page.locator(".document-preview-head strong").textContent()).toBe("TBM 브리핑");

    await page.locator(".doc-card-actions button", { hasText: "편집" }).click();
    const reopenedEditor = page.getByRole("textbox", { name: "TBM/작업 전 안전점검회의 편집" });
    await reopenedEditor.waitFor({ state: "visible" });
    expect(await reopenedEditor.inputValue()).toBe(editedValue);

    await page.getByRole("button", { name: /^입력/ }).click();
    await page.getByRole("button", { name: /안전 문서 생성/ }).click();
    await page.locator(".document-preview-pane").waitFor({ state: "visible" });
    await page.locator(".document-viewer-list button", { hasText: "TBM 브리핑" }).click();
    await page.locator(".doc-card-actions button", { hasText: "편집" }).click();
    const regeneratedEditor = page.getByRole("textbox", { name: "TBM/작업 전 안전점검회의 편집" });
    await regeneratedEditor.waitFor({ state: "visible" });
    expect(await regeneratedEditor.inputValue()).toContain(regeneratedSentinel);
    expect(await regeneratedEditor.inputValue()).not.toContain(sentinel);
    const draftKeys = await page.evaluate(() => Object.keys(window.localStorage).filter((key) => key.startsWith("safeclaw-workpack:")));
    expect(draftKeys).toHaveLength(2);
  }, 90_000);

  it("keeps the Night document editor readable, scroll-safe, and focused", async () => {
    if (!browser) throw new Error("Browser was not started");
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
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

    await page.goto(`${baseUrl}/workspace?scenario=seoul-construction-windy&theme=night`, { waitUntil: "networkidle" });
    await page.getByRole("button", { name: /안전 문서 생성/ }).click();
    await page.locator(".document-preview-pane").waitFor({ state: "visible" });
    expect.soft(await page.locator(".field-workspace").count()).toBe(0);

    await page.getByRole("button", { name: "다운로드 설정" }).click();
    await page.locator(".document-editor.editor-focus-cue").waitFor({ state: "visible" });
    expect.soft(await page.locator(".document-workbench").count()).toBe(0);
    expect(await page.locator(".field-workspace").count()).toBe(1);

    const metrics = await page.evaluate(() => {
      function readColor(selector: string, property: "color" | "backgroundColor") {
        const element = document.querySelector(selector);
        if (!element) throw new Error(`Missing color target: ${selector}`);
        return getComputedStyle(element)[property];
      }

      function contrastRatio(foreground: string, background: string) {
        const channels = (value: string) => {
          const matches = value.match(/[\d.]+/g);
          if (!matches || matches.length < 3) throw new Error(`Unsupported color: ${value}`);
          return matches.slice(0, 3).map((channel) => {
            const normalized = Number(channel) / 255;
            return normalized <= 0.04045
              ? normalized / 12.92
              : ((normalized + 0.055) / 1.055) ** 2.4;
          });
        };
        const luminance = (value: string) => {
          const [red, green, blue] = channels(value);
          return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
        };
        const foregroundLuminance = luminance(foreground);
        const backgroundLuminance = luminance(background);
        const lighter = Math.max(foregroundLuminance, backgroundLuminance);
        const darker = Math.min(foregroundLuminance, backgroundLuminance);
        return (lighter + 0.05) / (darker + 0.05);
      }

      const editor = document.querySelector(".document-editor");
      if (!editor) throw new Error("Missing Night editor");
      const editorStyle = getComputedStyle(editor);
      const foreground = readColor(".document-editor", "color");
      const background = readColor(".document-editor", "backgroundColor");

      return {
        activeElementClass: document.activeElement?.className || "",
        backgroundImage: editorStyle.backgroundImage,
        contrast: contrastRatio(foreground, background),
        overflowX: editorStyle.overflowX,
        overflowY: editorStyle.overflowY
      };
    });

    expect.soft(metrics.backgroundImage).toBe("none");
    expect.soft(metrics.contrast).toBeGreaterThanOrEqual(4.5);
    expect.soft(metrics.overflowX).toBe("visible");
    expect.soft(metrics.overflowY).toBe("visible");
    expect(String(metrics.activeElementClass)).toContain("document-textarea");
  }, 90_000);
});
