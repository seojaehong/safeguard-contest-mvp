import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Browser } from "playwright";
import {
  startIsolatedNextBrowserHarness,
  type IsolatedNextBrowserHarness
} from "./helpers/isolated-next-browser-harness";

let baseUrl = "";
let browser: Browser | null = null;
let harness: IsolatedNextBrowserHarness | null = null;

const desktopRoutes = ["/home", "/documents", "/evidence", "/reports", "/settings/ai-connect"] as const;
const mobileRoutes = ["/home", "/documents", "/reports", "/settings/ai-connect"] as const;
const workspaceAccent = {
  day: "#f5c518",
  night: "#6c6ff7"
} as const;

type ModuleTheme = keyof typeof workspaceAccent;
type Viewport = { width: number; height: number };

type ModuleShellMetrics = {
  route: string;
  theme: ModuleTheme;
  hasShell: boolean;
  accent: string;
  shellBackground: string;
  shellColor: string;
  shellColumnCount: number;
  railBackground: string;
  railRadius: string;
  railHeight: number;
  navTop: number;
  navHeight: number;
  navRadius: string;
  heroTop: number;
  h1Top: number;
  h1Color: string;
  h1FontSize: number;
  contentTop: number;
  reportBodyTop: number | null;
  principalBackground: string;
  principalBorderColor: string;
  focusOutlineColor: string;
  activeNavBoxShadow: string;
  menuRowGap: number | null;
  menuColumnGap: number | null;
  controlHeights: number[];
  cockpitBackground: string | null;
  documentIndexButtonBackground: string | null;
  horizontalOverflow: boolean;
};

type WorkspaceMetrics = {
  theme: ModuleTheme;
  accent: string;
  railRadius: string;
  navRadius: string;
  mainStartTop: number;
  h1FontSize: number;
  horizontalOverflow: boolean;
};

type ModuleMetricOptions = {
  theme?: ModuleTheme;
  openMenu?: boolean;
  loadSampleReport?: boolean;
};

function auditMetrics(label: string, value: unknown): void {
  if (process.env.MODULE_SHELL_AUDIT === "1") {
    console.info(`${label} ${JSON.stringify(value)}`);
  }
}

async function readWorkspaceMetrics(theme: ModuleTheme, viewport: Viewport): Promise<WorkspaceMetrics> {
  if (!browser) throw new Error("Browser was not started");
  const page = await browser.newPage({ viewport });
  await page.goto(`${baseUrl}/workspace?theme=${theme}`, { waitUntil: "networkidle" });
  const metrics = await page.evaluate((currentTheme) => {
    const shell = document.querySelector(".command-center-shell");
    const rail = document.querySelector(".workspace-side-nav");
    const nav = document.querySelector(".command-topbar");
    const main = document.querySelector(".workspace-step-page.workspace-input-page");
    const h1 = document.querySelector(".workspace-step-page.workspace-input-page h1");
    if (!shell || !rail || !nav || !main || !h1) {
      throw new Error(`Missing workspace audit target for ${currentTheme}`);
    }
    return {
      theme: currentTheme,
      accent: getComputedStyle(shell).getPropertyValue("--workspace-accent").trim(),
      railRadius: getComputedStyle(rail).borderRadius,
      navRadius: getComputedStyle(nav).borderRadius,
      mainStartTop: Math.round(main.getBoundingClientRect().top),
      h1FontSize: Number.parseFloat(getComputedStyle(h1).fontSize),
      horizontalOverflow: document.documentElement.scrollWidth > window.innerWidth + 1
    };
  }, theme);
  await page.close();
  return metrics;
}

async function readModuleMetrics(
  route: string,
  viewport: Viewport,
  options: ModuleMetricOptions = {}
): Promise<ModuleShellMetrics> {
  if (!browser) throw new Error("Browser was not started");
  const theme = options.theme ?? "day";
  const page = await browser.newPage({ viewport });
  await page.goto(`${baseUrl}${route}?theme=${theme}`, { waitUntil: "networkidle" });
  await page.locator(".safeclaw-module-shell[data-ready='true']").waitFor({ state: "attached" });
  if (options.loadSampleReport) {
    await page.getByRole("button", { name: "샘플 미리보기" }).click();
    await page.locator(".safeclaw-workdoc-shell").waitFor({ state: "visible" });
  }
  if (options.openMenu) {
    await page.getByRole("button", { name: "메뉴" }).click();
    await page.locator("#safeclaw-module-navigation.open").waitFor({ state: "visible" });
  }
  await page.locator(".safeclaw-module-principal-command a").focus();
  const metrics = await page.evaluate(({ currentRoute, currentTheme }) => {
    const shell = document.querySelector(".safeclaw-module-shell");
    const rail = document.querySelector(".safeclaw-module-rail");
    const nav = document.querySelector(".safeclaw-module-nav");
    const hero = document.querySelector(".safeclaw-page-decision-header");
    const h1 = document.querySelector(".safeclaw-page-decision-header h1");
    const content = document.querySelector(".safeclaw-module-content > *");
    const principal = document.querySelector(".safeclaw-module-principal-command a");
    const activeNav = document.querySelector(".safeclaw-module-rail a.active");
    if (!shell || !rail || !nav || !hero || !h1 || !content || !principal || !activeNav) {
      return {
        route: currentRoute,
        theme: currentTheme,
        hasShell: false,
        accent: "",
        shellBackground: "",
        shellColor: "",
        shellColumnCount: 0,
        railBackground: "",
        railRadius: "",
        railHeight: 0,
        navTop: 0,
        navHeight: 0,
        navRadius: "",
        heroTop: 0,
        h1Top: 0,
        h1Color: "",
        h1FontSize: 0,
        contentTop: 0,
        reportBodyTop: null,
        principalBackground: "",
        principalBorderColor: "",
        focusOutlineColor: "",
        activeNavBoxShadow: "",
        menuRowGap: null,
        menuColumnGap: null,
        controlHeights: [],
        cockpitBackground: null,
        documentIndexButtonBackground: null,
        horizontalOverflow: document.documentElement.scrollWidth > window.innerWidth + 1
      };
    }
    const cockpit = document.querySelector(".safeclaw-document-cockpit");
    const documentIndexButton = document.querySelector(".safeclaw-doc-index-list button");
    const reportBody = document.querySelector(".safeclaw-workdoc-shell");
    const primaryNav = document.querySelector(".safeclaw-module-primary-nav");
    const shellStyle = getComputedStyle(shell);
    const railStyle = getComputedStyle(rail);
    const navStyle = getComputedStyle(nav);
    const h1Style = getComputedStyle(h1);
    const principalStyle = getComputedStyle(principal);
    const primaryNavStyle = primaryNav ? getComputedStyle(primaryNav) : null;
    const railRect = rail.getBoundingClientRect();
    const navRect = nav.getBoundingClientRect();
    const heroRect = hero.getBoundingClientRect();
    const h1Rect = h1.getBoundingClientRect();
    const controlHeights = Array.from(document.querySelectorAll(
      ".safeclaw-module-menu-button, .safeclaw-module-theme-toggle button, .safeclaw-module-principal-command a, .safeclaw-module-rail nav.open a"
    ))
      .map((element) => Math.round(element.getBoundingClientRect().height))
      .filter((height) => height > 0);
    return {
      route: currentRoute,
      theme: currentTheme,
      hasShell: true,
      accent: shellStyle.getPropertyValue("--workspace-accent").trim(),
      shellBackground: shellStyle.backgroundColor,
      shellColor: shellStyle.color,
      shellColumnCount: shellStyle.gridTemplateColumns.split(" ").filter(Boolean).length,
      railBackground: railStyle.backgroundColor,
      railRadius: railStyle.borderRadius,
      railHeight: Math.round(railRect.height),
      navTop: Math.round(navRect.top),
      navHeight: Math.round(navRect.height),
      navRadius: navStyle.borderRadius,
      heroTop: Math.round(heroRect.top),
      h1Top: Math.round(h1Rect.top),
      h1Color: h1Style.color,
      h1FontSize: Number.parseFloat(h1Style.fontSize),
      contentTop: Math.round(content.getBoundingClientRect().top),
      reportBodyTop: reportBody ? Math.round(reportBody.getBoundingClientRect().top) : null,
      principalBackground: principalStyle.backgroundColor,
      principalBorderColor: principalStyle.borderColor,
      focusOutlineColor: principalStyle.outlineColor,
      activeNavBoxShadow: getComputedStyle(activeNav).boxShadow,
      menuRowGap: primaryNavStyle ? Number.parseFloat(primaryNavStyle.rowGap) : null,
      menuColumnGap: primaryNavStyle ? Number.parseFloat(primaryNavStyle.columnGap) : null,
      controlHeights,
      cockpitBackground: cockpit ? getComputedStyle(cockpit).backgroundColor : null,
      documentIndexButtonBackground: documentIndexButton ? getComputedStyle(documentIndexButton).backgroundColor : null,
      horizontalOverflow: document.documentElement.scrollWidth > window.innerWidth + 1
    };
  }, { currentRoute: route, currentTheme: theme });
  await page.close();
  return metrics;
}

describe("module shell design regression", () => {
  beforeAll(async () => {
    harness = await startIsolatedNextBrowserHarness({
      slug: "module-shell-design",
      initialPath: "/documents",
      portSalt: 3233
    });
    baseUrl = harness.baseUrl;
    browser = harness.browser;
  }, 90_000);

  afterAll(async () => {
    await harness?.stop();
  }, 30_000);

  it("uses the workspace daylight shell on core module desktop pages", async () => {
    const results = await Promise.all(
      desktopRoutes.map((route) => readModuleMetrics(route, { width: 1440, height: 900 }))
    );
    auditMetrics("module-desktop-day", results);

    for (const metrics of results) {
      expect(metrics.hasShell, metrics.route).toBe(true);
      expect(metrics.shellBackground, metrics.route).toBe("rgb(250, 250, 251)");
      expect(metrics.shellColor, metrics.route).toBe("rgb(23, 25, 29)");
      expect(metrics.h1Color, metrics.route).toBe("rgb(23, 25, 29)");
      expect(metrics.railBackground, metrics.route).not.toBe("rgb(1, 1, 2)");
      if (metrics.route === "/documents") {
        expect(metrics.cockpitBackground, metrics.route).toBe("rgb(255, 255, 255)");
        expect(metrics.documentIndexButtonBackground, metrics.route).toBe("rgb(244, 245, 247)");
      }
      expect(metrics.heroTop, metrics.route).toBeLessThanOrEqual(70);
      expect(metrics.h1FontSize, metrics.route).toBeGreaterThanOrEqual(24);
      expect(metrics.h1FontSize, metrics.route).toBeLessThanOrEqual(32);
      expect(metrics.horizontalOverflow, metrics.route).toBe(false);
    }
  }, 120_000);

  it("uses the workspace Day and Night accents for module focus, active navigation, and primary commands", async () => {
    const viewport = { width: 1440, height: 900 };
    const [workspaceDay, workspaceNight, moduleDay, moduleNight] = await Promise.all([
      readWorkspaceMetrics("day", viewport),
      readWorkspaceMetrics("night", viewport),
      readModuleMetrics("/documents", viewport, { theme: "day" }),
      readModuleMetrics("/documents", viewport, { theme: "night" })
    ]);
    auditMetrics("workspace-desktop", [workspaceDay, workspaceNight]);
    auditMetrics("module-desktop-theme", [moduleDay, moduleNight]);

    for (const [workspace, module] of [[workspaceDay, moduleDay], [workspaceNight, moduleNight]] as const) {
      const expectedAccent = workspaceAccent[workspace.theme];
      const expectedRgb = workspace.theme === "day" ? "rgb(245, 197, 24)" : "rgb(108, 111, 247)";
      expect(workspace.accent, `workspace ${workspace.theme}`).toBe(expectedAccent);
      expect(module.accent, `module ${module.theme}`).toBe(expectedAccent);
      expect(module.principalBackground, `command ${module.theme}`).toBe(expectedRgb);
      expect(module.principalBorderColor, `command border ${module.theme}`).toBe(expectedRgb);
      expect(module.focusOutlineColor, `focus ${module.theme}`).toBe(expectedRgb);
      expect(module.activeNavBoxShadow, `active nav ${module.theme}`).toContain(expectedRgb);
      expect(module.h1FontSize, `title ${module.theme}`).toBeGreaterThanOrEqual(24);
      expect(module.h1FontSize, `title ${module.theme}`).toBeLessThanOrEqual(32);
      expect(module.horizontalOverflow, module.theme).toBe(false);
    }
  }, 120_000);

  it("keeps mobile module navigation compact enough for the page title to appear early", async () => {
    const viewport = { width: 390, height: 844 };
    const [workspace, results, openMenu, sampleReport] = await Promise.all([
      readWorkspaceMetrics("day", viewport),
      Promise.all(mobileRoutes.map((route) => readModuleMetrics(route, viewport))),
      readModuleMetrics("/documents", viewport, { openMenu: true }),
      readModuleMetrics("/reports", viewport, { loadSampleReport: true })
    ]);
    auditMetrics("workspace-mobile-day", workspace);
    auditMetrics("module-mobile-day", results);
    auditMetrics("module-mobile-menu", openMenu);
    auditMetrics("module-mobile-sample-report", sampleReport);

    for (const metrics of results) {
      expect(metrics.hasShell, metrics.route).toBe(true);
      expect(metrics.railHeight, metrics.route).toBeLessThanOrEqual(150);
      expect(metrics.navTop, metrics.route).toBeLessThanOrEqual(150);
      expect(metrics.navHeight, metrics.route).toBeLessThanOrEqual(90);
      expect(metrics.heroTop, metrics.route).toBeLessThanOrEqual(260);
      expect(metrics.h1Top, metrics.route).toBeLessThanOrEqual(330);
      expect(metrics.h1Color, metrics.route).toBe("rgb(23, 25, 29)");
      expect(metrics.h1FontSize, metrics.route).toBeGreaterThanOrEqual(22);
      expect(metrics.h1FontSize, metrics.route).toBeLessThanOrEqual(28);
      expect(metrics.contentTop, metrics.route).toBeLessThanOrEqual(workspace.mainStartTop + 80);
      if (metrics.route === "/documents") {
        expect(metrics.cockpitBackground, metrics.route).toBe("rgb(255, 255, 255)");
        expect(metrics.documentIndexButtonBackground, metrics.route).toBe("rgb(244, 245, 247)");
      }
      expect(metrics.horizontalOverflow, metrics.route).toBe(false);
    }

    expect(workspace.horizontalOverflow).toBe(false);
    expect(openMenu.railRadius).toBe(workspace.railRadius);
    expect(openMenu.navRadius).toBe(workspace.navRadius);
    expect(openMenu.menuRowGap).toBeGreaterThanOrEqual(8);
    expect(openMenu.menuColumnGap).toBeGreaterThanOrEqual(8);
    expect(openMenu.controlHeights.length).toBeGreaterThan(0);
    for (const height of openMenu.controlHeights) {
      expect(height).toBeGreaterThanOrEqual(44);
    }
    expect(openMenu.horizontalOverflow).toBe(false);
    expect(sampleReport.reportBodyTop).not.toBeNull();
    expect(sampleReport.reportBodyTop!).toBeLessThanOrEqual(workspace.mainStartTop + 280);
    expect(sampleReport.horizontalOverflow).toBe(false);
  }, 120_000);

  it("keeps the module rail in the desktop shell above the unified 900px breakpoint", async () => {
    const metrics = await readModuleMetrics("/home", { width: 940, height: 820 });

    expect(metrics.hasShell).toBe(true);
    expect(metrics.shellColumnCount).toBe(2);
    expect(metrics.railHeight).toBeGreaterThanOrEqual(820);
    expect(metrics.navTop).toBe(0);
    expect(metrics.horizontalOverflow).toBe(false);
  }, 90_000);
});
