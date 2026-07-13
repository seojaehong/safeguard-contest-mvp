import fs from "node:fs";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Browser, Page, Route } from "playwright";
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
import {
  buildStoredCurrentWorkpack,
  CURRENT_WORKPACK_STORAGE_KEY
} from "@/lib/current-workpack";
import { buildSampleWorkpack } from "@/lib/sample-workpack";

const root = process.cwd();
const cssPath = path.join(root, "app", "globals.css");
const componentPath = path.join(root, "components", "ReportsDownloadCenter.tsx");
const shellPath = path.join(root, "components", "SafeClawModuleShell.tsx");
const reportingDownloadsPath = path.join(root, "lib", "reporting-downloads.ts");
const reportsWave1TestSupabaseUrl = "https://wave8-fixture.supabase.co";
const reportsWave1TestAuthStorageKey = "sb-wave8-fixture-auth-token";
const reportsWave1TestAccessToken = "reports-wave1-evidence-access-token";
const defaultProductionBuildManifestPath = path.join(
  root,
  REPORTS_WAVE1_EVIDENCE_RELATIVE_DIR,
  REPORTS_WAVE1_BUILD_MANIFEST_FILENAME,
);
const reportsTaskDistanceEvidenceRelativeDir = path.join(
  "evaluation",
  "reports-mobile-task-distance-2026-07-14",
  "target-ready-f98-label-remediation"
);

type EvidenceIdentity = {
  productCandidateSha: string;
  buildId: string;
  generatedAt: string;
  measurementCommandIdentity: string;
};

function asRecord(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label} must be a JSON object`);
  }
  return value as Record<string, unknown>;
}

function requiredEvidenceEnvironment(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing required Reports evidence environment: ${name}`);
  return value;
}

function resolveEvidenceIdentity(): EvidenceIdentity | null {
  if (process.env.SAFECLAW_REPORTS_TASK_DISTANCE_EVIDENCE !== "1") return null;
  const productCandidateSha = requiredEvidenceEnvironment("SAFECLAW_REPORTS_EVIDENCE_PRODUCT_SHA");
  const buildId = requiredEvidenceEnvironment("SAFECLAW_REPORTS_EVIDENCE_BUILD_ID");
  const generatedAt = requiredEvidenceEnvironment("SAFECLAW_REPORTS_EVIDENCE_GENERATED_AT");
  const measurementCommandIdentity = requiredEvidenceEnvironment("SAFECLAW_REPORTS_EVIDENCE_COMMAND_IDENTITY");
  if (!/^[0-9a-f]{40}$/u.test(productCandidateSha)) {
    throw new Error(`Invalid Reports evidence product SHA: ${productCandidateSha}`);
  }
  if (new Date(generatedAt).toISOString() !== generatedAt) {
    throw new Error(`Reports evidence generatedAt must be canonical ISO-8601: ${generatedAt}`);
  }
  if (!measurementCommandIdentity.includes("tests/reports-design-remediation.test.ts")) {
    throw new Error("Reports evidence command identity must name the focused test file");
  }
  const manifestPath = process.env.SAFECLAW_PRODUCTION_BUILD_MANIFEST ?? defaultProductionBuildManifestPath;
  const manifest = asRecord(JSON.parse(fs.readFileSync(manifestPath, "utf8")) as unknown, "Reports build manifest");
  if (manifest.productSourceSha !== productCandidateSha) {
    throw new Error(`Reports evidence candidate SHA does not match build manifest: ${productCandidateSha}`);
  }
  if (manifest.buildId !== buildId) {
    throw new Error(`Reports evidence build ID does not match build manifest: ${buildId}`);
  }
  return Object.freeze({ productCandidateSha, buildId, generatedAt, measurementCommandIdentity });
}

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

function blockBody(source: string, blockStart: string): string {
  const start = source.indexOf(blockStart);
  expect(start, `${blockStart} block`).toBeGreaterThanOrEqual(0);
  const openingBrace = source.indexOf("{", start);
  let depth = 0;
  for (let index = openingBrace; index < source.length; index += 1) {
    if (source[index] === "{") depth += 1;
    if (source[index] === "}") depth -= 1;
    if (depth === 0) return source.slice(openingBrace + 1, index);
  }
  throw new Error(`Unclosed CSS block: ${blockStart}`);
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
  it("keeps the final-launch stylesheet free of important declarations", () => {
    const css = fs.readFileSync(cssPath, "utf8");
    expect([...css.matchAll(/!important/gu)]).toHaveLength(0);
  });

  it("preserves shared final-launch Reports rules below the route override", () => {
    const css = fs.readFileSync(cssPath, "utf8");
    const mixedDocumentRules = cssRules(css).filter((rule) =>
      rule.selectors.some((selector) => selector.includes("module-variant-document"))
      && rule.selectors.some((selector) => /safeclaw-report-(?:controls|facts|notes|table|group)/u.test(selector))
    );
    expect(mixedDocumentRules.length).toBeGreaterThan(0);
    expect(mixedDocumentRules.every((rule) => !rule.body.includes("!important"))).toBe(true);
    expect(css.indexOf("/* Reports: canonical route layer")).toBeGreaterThan(
      css.lastIndexOf(".safeclaw-module-shell.module-variant-document .safeclaw-report-notes p"),
    );
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
    const reportingDownloads = fs.readFileSync(reportingDownloadsPath, "utf8");
    const shell = fs.readFileSync(shellPath, "utf8");
    const css = fs.readFileSync(cssPath, "utf8");
    const legacyPhotoTerm = ["Before", "After"].join("/");

    expect(shell).toContain("data-module-route={activeHref}");
    expect(component).toMatch(/className="safeclaw-report-period-control"[\s\S]*aria-pressed=\{period === option\.value\}/u);
    expect(component).toContain("개선 전/개선 후 사진 포함 승인");
    expect(component).not.toContain(legacyPhotoTerm);
    expect(reportingDownloads).toContain("개선 전/개선 후 사진");
    expect(reportingDownloads).not.toContain(legacyPhotoTerm);
    expect(css).toContain('.safeclaw-module-shell[data-module-route="/reports"] .safeclaw-report-controls button[aria-pressed="true"]');
  });

  it("overrides Reports controls without changing shared button selectors", () => {
    const css = fs.readFileSync(cssPath, "utf8");
    const reportsLayer = css.slice(css.indexOf("/* Reports: canonical route layer"));
    const mobileReportsCss = blockBody(reportsLayer, "@media (max-width: 900px)");
    expect(declarationsFor(
      css,
      '.safeclaw-module-shell[data-module-route="/reports"] .safeclaw-report-controls button'
    )).toMatchObject({
      "min-height": "44px",
      "border-radius": "var(--radius-control)"
    });
    expect(declarationsFor(
      css,
      '.safeclaw-module-shell[data-module-route="/reports"] .safeclaw-module-principal-command a'
    )).toMatchObject({
      "min-height": "44px",
      "border-radius": "var(--radius-control)"
    });
    expect(declarationsFor(
      css,
      '.safeclaw-module-shell[data-module-route="/reports"] .safeclaw-report-preview'
    )).toMatchObject({
      "border-radius": "var(--radius-control)"
    });
    expect(declarationsFor(
      css,
      '.safeclaw-module-shell[data-module-route="/reports"] button'
    )).toMatchObject({
      "min-inline-size": "44px",
      "min-width": "44px",
      "min-block-size": "44px",
      "min-height": "44px"
    });
    expect(declarationsFor(
      mobileReportsCss,
      '.safeclaw-module-shell[data-module-route="/reports"] .safeclaw-module-principal-command a'
    )).toMatchObject({
      "width": "auto",
      "max-width": "176px"
    });
    expect(declarationsFor(
      mobileReportsCss,
      '.safeclaw-module-shell[data-module-route="/reports"] .safeclaw-page-decision-action'
    )).toMatchObject({
      "grid-template-columns": "minmax(0, 1fr) auto",
      "gap": "var(--space-3)"
    });
    expect(reportsLayer).not.toContain(".safeclaw-report-custom-range");
    expect([...css.matchAll(/\.safeclaw-report-head(?:[\s,.:{>]|$)/gu)]).toHaveLength(0);
  });
});

type Theme = "day" | "night";
type Viewport = { width: number; height: number; label: "desktop" | "mobile" };

let baseUrl = "";
let browser: Browser | null = null;
let harness: IsolatedNextBrowserHarness | null = null;
let outputDirectory = "";
let outputResolution: ReturnType<typeof resolveReportsWave1OutputDirectory> | null = null;
let evidenceIdentity: EvidenceIdentity | null = null;

function writeEvidenceJson(fileName: string, payload: Record<string, unknown>): void {
  const document = evidenceIdentity ? { ...evidenceIdentity, ...payload } : payload;
  fs.writeFileSync(path.join(outputDirectory, fileName), `${JSON.stringify(document, null, 2)}\n`);
}

async function prepareSample(page: Page, theme: Theme): Promise<void> {
  await page.goto(`${baseUrl}/reports?theme=${theme}`, { waitUntil: "networkidle" });
  await page.locator(".safeclaw-module-shell[data-ready='true']").waitFor({ state: "attached" });
  await page.getByRole("button", { name: "샘플 미리보기" }).click();
  await page.locator(".safeclaw-workdoc-shell").waitFor({ state: "visible" });
  await page.locator(".safeclaw-report-period-control").first().waitFor({ state: "visible" });
}

async function prepareDownloadReadyFixture(page: Page, theme: Theme): Promise<void> {
  await page.addInitScript(({ expectedOrigin, storageKey, workpack }) => {
    if (window.location.origin !== expectedOrigin) return;
    window.localStorage.setItem(storageKey, workpack);
  }, {
    expectedOrigin: baseUrl,
    storageKey: CURRENT_WORKPACK_STORAGE_KEY,
    workpack: JSON.stringify(buildStoredCurrentWorkpack(buildSampleWorkpack()))
  });
  await page.goto(`${baseUrl}/reports?theme=${theme}`, { waitUntil: "networkidle" });
  await page.locator(".safeclaw-module-shell[data-ready='true']").waitFor({ state: "attached" });
  await page.locator(".safeclaw-workdoc-shell").waitFor({ state: "visible" });
  await page.locator("[aria-label='리포트 다운로드'] button:not(:disabled)").first().waitFor({ state: "visible" });
}

async function installServerAuth(page: Page): Promise<void> {
  await page.addInitScript(({
    expectedOrigin,
    authStorageKey,
    accessToken,
    supabaseUrl,
    supabaseAnonKey
  }) => {
    if (window.location.origin !== expectedOrigin) return;
    const browserGlobal = window as Window & {
      process?: { env: Record<string, string> };
    };
    browserGlobal.process = {
      env: {
        NEXT_PUBLIC_SUPABASE_URL: supabaseUrl,
        NEXT_PUBLIC_SUPABASE_ANON_KEY: supabaseAnonKey
      }
    };
    window.localStorage.setItem(authStorageKey, JSON.stringify({
      access_token: accessToken,
      refresh_token: "reports-wave1-evidence-refresh-token",
      expires_at: 4_102_444_800,
      token_type: "bearer"
    }));
  }, {
    expectedOrigin: baseUrl,
    authStorageKey: reportsWave1TestAuthStorageKey,
    accessToken: reportsWave1TestAccessToken,
    supabaseUrl: reportsWave1TestSupabaseUrl,
    supabaseAnonKey: "wave8-public-anon-key"
  });
}

type InteractiveTargetMetric = {
  descriptor: string;
  selector: string;
  disabled: boolean;
  height: number;
  width: number;
};

type InteractiveTargetInventory = {
  state: string;
  targets: InteractiveTargetMetric[];
  undersized: InteractiveTargetMetric[];
  horizontalOverflow: number;
  overlapFailures: string[];
  nestedScrollFailures: string[];
};

type InteractiveTargetMatrixRow = InteractiveTargetInventory & {
  rowId: string;
  theme: Theme;
  viewport: Viewport;
};

const interactiveTargetMatrixRows: InteractiveTargetMatrixRow[] = [];

function recordInteractiveTargetRow(
  rowId: string,
  theme: Theme,
  viewport: Viewport,
  inventory: InteractiveTargetInventory,
): void {
  expect(interactiveTargetMatrixRows.some((row) => row.rowId === rowId), `duplicate matrix row ${rowId}`).toBe(false);
  expect(inventory.targets.length, `${rowId} interactive inventory`).toBeGreaterThan(0);
  expect(inventory.undersized, `${rowId} undersized targets\n${JSON.stringify(inventory.undersized, null, 2)}`).toEqual([]);
  expect(inventory.horizontalOverflow, `${rowId} horizontal overflow`).toBe(0);
  expect(inventory.overlapFailures, `${rowId} interactive overlaps`).toEqual([]);
  expect(inventory.nestedScrollFailures, `${rowId} nested scroll`).toEqual([]);
  interactiveTargetMatrixRows.push({ rowId, theme, viewport, ...inventory });
}

async function openNamedReportsDisclosure(page: Page, name: string): Promise<void> {
  const summary = page.locator("summary").filter({ hasText: name });
  await summary.waitFor({ state: "visible" });
  expect((await summary.textContent())?.trim()).toBe(name);
  const details = summary.locator("..");
  if (!(await details.evaluate((element) => (element as HTMLDetailsElement).open))) {
    await summary.click();
  }
  expect(await details.evaluate((element) => (element as HTMLDetailsElement).open)).toBe(true);
}

async function closeNamedReportsDisclosure(page: Page, name: string): Promise<void> {
  const summary = page.locator("summary").filter({ hasText: name });
  await summary.waitFor({ state: "visible" });
  const details = summary.locator("..");
  if (await details.evaluate((element) => (element as HTMLDetailsElement).open)) {
    await summary.click();
  }
  expect(await details.evaluate((element) => (element as HTMLDetailsElement).open)).toBe(false);
}

async function measureInteractiveTargets(page: Page, state: string): Promise<InteractiveTargetInventory> {
  return page.evaluate((stateLabel) => {
    document.documentElement.style.scrollBehavior = "auto";
    document.body.style.scrollBehavior = "auto";
    window.scrollTo(0, 0);
    const root = document.querySelector<HTMLElement>(".safeclaw-module-shell[data-module-route='/reports']");
    if (!root) throw new Error("Reports shell was not rendered");
    const visible = (element: HTMLElement): boolean => {
      const closedDetails = element.closest<HTMLDetailsElement>("details:not([open])");
      if (closedDetails) {
        const visibleSummary = closedDetails.querySelector<HTMLElement>(":scope > summary");
        if (!visibleSummary?.contains(element)) return false;
      }
      const rect = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      return rect.width > 0
        && rect.height > 0
        && rect.right > 0
        && rect.bottom > 0
        && style.display !== "none"
        && style.visibility !== "hidden";
    };
    const interactive = Array.from(root.querySelectorAll<HTMLElement>(
      "button, a[href], select, input, summary, [tabindex]:not([tabindex='-1'])"
    )).filter(visible);
    const selectorFor = (element: HTMLElement, index: number): string => {
      if (element.id) return `#${CSS.escape(element.id)}`;
      const ariaLabel = element.getAttribute("aria-label");
      if (ariaLabel) return `${element.tagName.toLowerCase()}[aria-label=${JSON.stringify(ariaLabel)}]`;
      const classes = Array.from(element.classList).map((name) => `.${CSS.escape(name)}`).join("");
      return classes ? `${element.tagName.toLowerCase()}${classes}` : `${element.tagName.toLowerCase()}:interactive(${index})`;
    };
    const targets = interactive.map((element, index) => {
      const target = element instanceof HTMLInputElement && element.type === "checkbox"
        ? element.closest<HTMLElement>("label") ?? element
        : element;
      const rect = target.getBoundingClientRect();
      const name = element.getAttribute("aria-label")
        ?? element.textContent?.replace(/\s+/gu, " ").trim()
        ?? element.getAttribute("name")
        ?? "";
      return {
        descriptor: `${index}:${element.tagName.toLowerCase()}[${name.slice(0, 48)}]`,
        selector: selectorFor(element, index),
        disabled: (element instanceof HTMLButtonElement
          || element instanceof HTMLInputElement
          || element instanceof HTMLSelectElement) && element.disabled,
        height: Math.round(rect.height * 100) / 100,
        width: Math.round(rect.width * 100) / 100
      };
    });
    const targetRectangles = interactive.map((element, index) => {
      const target = element instanceof HTMLInputElement && element.type === "checkbox"
        ? element.closest<HTMLElement>("label") ?? element
        : element;
      return { element: target, rect: target.getBoundingClientRect(), selector: selectorFor(element, index) };
    });
    const overlapFailures: string[] = [];
    for (let leftIndex = 0; leftIndex < targetRectangles.length; leftIndex += 1) {
      const left = targetRectangles[leftIndex];
      for (let rightIndex = leftIndex + 1; rightIndex < targetRectangles.length; rightIndex += 1) {
        const right = targetRectangles[rightIndex];
        if (left.element === right.element
          || left.element.contains(right.element)
          || right.element.contains(left.element)) continue;
        const overlapWidth = Math.min(left.rect.right, right.rect.right) - Math.max(left.rect.left, right.rect.left);
        const overlapHeight = Math.min(left.rect.bottom, right.rect.bottom) - Math.max(left.rect.top, right.rect.top);
        if (overlapWidth > 1 && overlapHeight > 1) {
          overlapFailures.push(`${left.selector}<->${right.selector}`);
        }
      }
    }
    const nestedScrollFailures = Array.from(root.querySelectorAll<HTMLElement>("*"))
      .filter((element) => {
        if (!visible(element)) return false;
        const style = getComputedStyle(element);
        return (["auto", "scroll"].includes(style.overflowX) && element.scrollWidth > element.clientWidth + 1)
          || (["auto", "scroll"].includes(style.overflowY) && element.scrollHeight > element.clientHeight + 1);
      })
      .map((element) => selectorFor(element, -1));
    return {
      state: stateLabel,
      targets,
      undersized: targets.filter((target) => target.width < 44 || target.height < 44),
      horizontalOverflow: Math.max(0, document.documentElement.scrollWidth - window.innerWidth),
      overlapFailures,
      nestedScrollFailures
    };
  }, state);
}

async function applyDeterministicTextReflow(page: Page): Promise<{
  mechanism: string;
  baselineImmutable: boolean;
  textElementCount: number;
  interactiveElementCount: number;
  representative: {
    selector: string;
    beforeFontSize: number;
    afterFontSize: number;
    growthRatio: number;
    beforeLineHeight: number;
    afterLineHeight: number;
    lineHeightGrowthRatio: number;
    beforeHeight: number;
    afterHeight: number;
  };
  brand: {
    selector: string;
    beforeFontSize: number;
    afterFontSize: number;
    growthRatio: number;
    clientWidth: number;
    scrollWidth: number;
    clientHeight: number;
    scrollHeight: number;
    clipped: boolean;
  };
  documentHeight: { before: number; after: number };
  workbenchHeight: { before: number; after: number };
  wrappingOrHeightChanged: boolean;
  horizontalOverflow: number;
  toolsFirstInDom: boolean;
  previewFollowsTools: boolean;
  scaleFailures: string[];
  dimensionOverflowObservations: string[];
  dimensionClippingFailures: string[];
  ancestorClippingFailures: string[];
  overlapFailures: string[];
  nestedScrollFailures: string[];
  fixedStickyOcclusionFailures: string[];
  fixedStickyViewportFailures: string[];
  inspected: {
    ancestorPairs: number;
    rectanglePairs: number;
    crossParentRectanglePairs: number;
    scrollPositions: number;
  };
}> {
  return page.evaluate(() => {
    document.documentElement.style.scrollBehavior = "auto";
    document.body.style.scrollBehavior = "auto";
    window.scrollTo(0, 0);
    const root = document.querySelector<HTMLElement>(".safeclaw-module-shell[data-module-route='/reports']");
    const workbench = root?.querySelector<HTMLElement>(".safeclaw-workdoc-shell");
    const representativeSelector = ".safeclaw-report-period-control strong";
    const representative = root?.querySelector<HTMLElement>(representativeSelector);
    const brandSelector = ".safeclaw-module-brand strong";
    const brand = root?.querySelector<HTMLElement>(brandSelector);
    if (!root || !workbench || !representative || !brand) {
      throw new Error("Reports text reflow targets were not rendered");
    }

    const visible = (element: HTMLElement): boolean => {
      const closedDetails = element.closest<HTMLDetailsElement>("details:not([open])");
      if (closedDetails) {
        const visibleSummary = closedDetails.querySelector<HTMLElement>(":scope > summary");
        if (!visibleSummary?.contains(element)) return false;
      }
      const rect = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      return rect.width > 0
        && rect.height > 0
        && rect.right > 0
        && rect.bottom > 0
        && style.display !== "none"
        && style.visibility !== "hidden";
    };

    const interactiveSelector = [
      "button",
      "a[href]",
      "select",
      "input:not([type='hidden'])",
      "summary",
      "[tabindex]:not([tabindex='-1'])"
    ].join(",");
    const interactiveElements = Array.from(root.querySelectorAll<HTMLElement>(interactiveSelector)).filter(visible);
    const textElementSet = new Set<HTMLElement>([...interactiveElements, representative, brand]);
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      if (!node.textContent?.trim()) continue;
      const parent = node.parentElement;
      if (parent && visible(parent)) textElementSet.add(parent);
    }
    const textElements = Array.from(textElementSet).filter((element) => {
      return Number.parseFloat(getComputedStyle(element).fontSize) > 0;
    });
    const descriptor = (element: HTMLElement): string => {
      const name = element.getAttribute("aria-label")
        ?? element.textContent?.replace(/\s+/gu, " ").trim()
        ?? "";
      const classes = Array.from(element.classList).slice(0, 2).join(".");
      return `${element.tagName.toLowerCase()}${classes ? `.${classes}` : ""}[${name.slice(0, 40)}]`;
    };
    const parsedLineHeight = (style: CSSStyleDeclaration, fontSize: number): number => {
      const value = Number.parseFloat(style.lineHeight);
      return Number.isFinite(value) ? value : fontSize * 1.2;
    };
    const textSnapshots = Object.freeze(textElements.map((element) => {
      const style = getComputedStyle(element);
      const fontSize = Number.parseFloat(style.fontSize);
      return Object.freeze({
        element,
        fontSize,
        lineHeight: parsedLineHeight(style, fontSize)
      });
    }));
    const representativeBaseline = textSnapshots.find((snapshot) => snapshot.element === representative);
    const brandBaseline = textSnapshots.find((snapshot) => snapshot.element === brand);
    if (!representativeBaseline || !brandBaseline) throw new Error("Reports typography baselines were not captured");

    const beforeFontSize = representativeBaseline.fontSize;
    const beforeLineHeight = representativeBaseline.lineHeight;
    const beforeHeight = representative.getBoundingClientRect().height;
    const beforeDocumentHeight = document.documentElement.scrollHeight;
    const beforeWorkbenchHeight = workbench.getBoundingClientRect().height;

    for (const snapshot of textSnapshots) {
      snapshot.element.style.fontSize = `${snapshot.fontSize * 2}px`;
      snapshot.element.style.lineHeight = `${snapshot.lineHeight * 2}px`;
    }

    const afterFontSize = Number.parseFloat(getComputedStyle(representative).fontSize);
    const afterLineHeight = Number.parseFloat(getComputedStyle(representative).lineHeight);
    const afterHeight = representative.getBoundingClientRect().height;
    const afterDocumentHeight = document.documentElement.scrollHeight;
    const afterWorkbenchHeight = workbench.getBoundingClientRect().height;
    const scaleFailures = textSnapshots.flatMap((snapshot) => {
      const style = getComputedStyle(snapshot.element);
      const actualFontSize = Number.parseFloat(style.fontSize);
      const actualLineHeight = Number.parseFloat(style.lineHeight);
      const fontRatio = actualFontSize / snapshot.fontSize;
      const lineRatio = actualLineHeight / snapshot.lineHeight;
      return Math.abs(fontRatio - 2) > 0.02 || Math.abs(lineRatio - 2) > 0.02
        ? [`${descriptor(snapshot.element)} font=${fontRatio.toFixed(3)} line=${lineRatio.toFixed(3)}`]
        : [];
    });

    const targetElements = Array.from(new Set(interactiveElements.map((element) => {
      return element instanceof HTMLInputElement && element.type === "checkbox"
        ? element.closest<HTMLElement>("label") ?? element
        : element;
    })));
    const dimensionElements = Array.from(new Set([...textElements, ...targetElements])).filter(visible);
    const dimensionOverflowObservations = dimensionElements.flatMap((element) => {
      if (element.clientWidth <= 0 || element.clientHeight <= 0) return [];
      const horizontal = element.scrollWidth > element.clientWidth + 1;
      const vertical = element.scrollHeight > element.clientHeight + 1;
      if (!horizontal && !vertical) return [];
      const style = getComputedStyle(element);
      return [
        `${descriptor(element)} client=${element.clientWidth}x${element.clientHeight} scroll=${element.scrollWidth}x${element.scrollHeight}`
          + ` font=${style.fontSize}/${style.lineHeight} overflow=${style.overflowX}/${style.overflowY}`
      ];
    });
    const dimensionClippingFailures = dimensionElements.flatMap((element) => {
      if (element.clientWidth <= 0 || element.clientHeight <= 0) return [];
      const style = getComputedStyle(element);
      const horizontal = element.scrollWidth > element.clientWidth + 1
        && ["hidden", "clip"].includes(style.overflowX);
      const vertical = element.scrollHeight > element.clientHeight + 1
        && ["hidden", "clip"].includes(style.overflowY);
      if (!horizontal && !vertical) return [];
      return [
        `${descriptor(element)} client=${element.clientWidth}x${element.clientHeight} scroll=${element.scrollWidth}x${element.scrollHeight}`
          + ` font=${style.fontSize}/${style.lineHeight} overflow=${style.overflowX}/${style.overflowY}`
      ];
    });

    let ancestorPairs = 0;
    const ancestorClippingFailures: string[] = [];
    for (const element of dimensionElements) {
      const elementRect = element.getBoundingClientRect();
      for (let ancestor = element.parentElement; ancestor && root.contains(ancestor); ancestor = ancestor.parentElement) {
        ancestorPairs += 1;
        const style = getComputedStyle(ancestor);
        const ancestorRect = ancestor.getBoundingClientRect();
        const clipsX = ["hidden", "clip"].includes(style.overflowX);
        const clipsY = ["hidden", "clip"].includes(style.overflowY);
        const outsideX = elementRect.left < ancestorRect.left - 1 || elementRect.right > ancestorRect.right + 1;
        const outsideY = elementRect.top < ancestorRect.top - 1 || elementRect.bottom > ancestorRect.bottom + 1;
        if ((clipsX && outsideX) || (clipsY && outsideY)) {
          ancestorClippingFailures.push(`${descriptor(element)} clipped-by ${descriptor(ancestor)}`);
        }
      }
    }

    type AtomicRectangle = { element: HTMLElement; rect: DOMRect; descriptor: string };
    const atomicRectangles = (): AtomicRectangle[] => {
      const rectangles: AtomicRectangle[] = targetElements.filter(visible).map((element) => ({
        element,
        rect: element.getBoundingClientRect(),
        descriptor: descriptor(element)
      }));
      const textWalker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      for (let node = textWalker.nextNode(); node; node = textWalker.nextNode()) {
        if (!node.textContent?.trim()) continue;
        const parent = node.parentElement;
        if (!parent || !visible(parent) || parent.closest(interactiveSelector)) continue;
        const range = document.createRange();
        range.selectNodeContents(node);
        for (const rect of Array.from(range.getClientRects())) {
          if (rect.width <= 0 || rect.height <= 0) continue;
          rectangles.push({ element: parent, rect, descriptor: descriptor(parent) });
        }
      }
      return rectangles;
    };
    const overlaps = (left: DOMRect, right: DOMRect): boolean => {
      const width = Math.min(left.right, right.right) - Math.max(left.left, right.left);
      const height = Math.min(left.bottom, right.bottom) - Math.max(left.top, right.top);
      return width > 1 && height > 1;
    };
    const rectangles = atomicRectangles();
    const overlapFailures: string[] = [];
    let rectanglePairs = 0;
    let crossParentRectanglePairs = 0;
    for (let leftIndex = 0; leftIndex < rectangles.length; leftIndex += 1) {
      const left = rectangles[leftIndex];
      for (let rightIndex = leftIndex + 1; rightIndex < rectangles.length; rightIndex += 1) {
        const right = rectangles[rightIndex];
        if (left.element === right.element
          || left.element.contains(right.element)
          || right.element.contains(left.element)) continue;
        rectanglePairs += 1;
        if (left.element.parentElement !== right.element.parentElement) crossParentRectanglePairs += 1;
        if (overlaps(left.rect, right.rect)) {
          overlapFailures.push(`${left.descriptor}<->${right.descriptor}`);
        }
      }
    }

    const nestedScrollFailures = Array.from(root.querySelectorAll<HTMLElement>("*"))
      .filter((element) => {
        if (!visible(element)) return false;
        const style = getComputedStyle(element);
        const scrollsVertically = ["auto", "scroll"].includes(style.overflowY)
          && element.scrollHeight > element.clientHeight + 1;
        const scrollsHorizontally = ["auto", "scroll"].includes(style.overflowX)
          && element.scrollWidth > element.clientWidth + 1;
        return scrollsVertically || scrollsHorizontally;
      })
      .map((element) => `${element.tagName.toLowerCase()}.${Array.from(element.classList).join(".")}`);

    const maxScrollY = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
    const scrollPositions = Array.from(new Set([
      0,
      Math.min(600, maxScrollY),
      Math.round(maxScrollY / 2),
      maxScrollY
    ]));
    const fixedStickyOcclusionFailures: string[] = [];
    const fixedStickyViewportFailures: string[] = [];
    for (const scrollY of scrollPositions) {
      window.scrollTo(0, scrollY);
      const chromeElements = Array.from(root.querySelectorAll<HTMLElement>("*"))
        .filter((element) => {
          if (!visible(element)) return false;
          const position = getComputedStyle(element).position;
          return position === "fixed" || position === "sticky";
        });
      const viewportRectangles = atomicRectangles().filter(({ rect }) => {
        return rect.bottom > 0 && rect.top < window.innerHeight && rect.right > 0 && rect.left < window.innerWidth;
      });
      for (const chrome of chromeElements) {
        const chromeRect = chrome.getBoundingClientRect();
        if (chromeRect.left < -1 || chromeRect.right > window.innerWidth + 1
          || chromeRect.top < -1 || chromeRect.bottom > window.innerHeight + 1) {
          fixedStickyViewportFailures.push(`${scrollY}:${descriptor(chrome)}`);
        }
        for (const candidate of viewportRectangles) {
          if (chrome === candidate.element
            || chrome.contains(candidate.element)
            || candidate.element.contains(chrome)) continue;
          if (overlaps(chromeRect, candidate.rect)) {
            fixedStickyOcclusionFailures.push(`${scrollY}:${descriptor(chrome)}<->${candidate.descriptor}`);
          }
        }
      }
    }
    window.scrollTo(0, 0);

    const tools = workbench.querySelector<HTMLElement>(".safeclaw-workdoc-rail");
    const preview = workbench.querySelector<HTMLElement>(".safeclaw-report-preview");
    const brandStyle = getComputedStyle(brand);
    const brandAfterFontSize = Number.parseFloat(brandStyle.fontSize);

    return {
      mechanism: "freeze-full-shell-visible-computed-font-size-and-line-height-then-double-inline",
      baselineImmutable: Object.isFrozen(textSnapshots)
        && textSnapshots.every((snapshot) => Object.isFrozen(snapshot)),
      textElementCount: textElements.length,
      interactiveElementCount: interactiveElements.length,
      representative: {
        selector: representativeSelector,
        beforeFontSize,
        afterFontSize,
        growthRatio: afterFontSize / beforeFontSize,
        beforeLineHeight,
        afterLineHeight,
        lineHeightGrowthRatio: afterLineHeight / beforeLineHeight,
        beforeHeight: Math.round(beforeHeight * 100) / 100,
        afterHeight: Math.round(afterHeight * 100) / 100
      },
      brand: {
        selector: brandSelector,
        beforeFontSize: brandBaseline.fontSize,
        afterFontSize: brandAfterFontSize,
        growthRatio: brandAfterFontSize / brandBaseline.fontSize,
        clientWidth: brand.clientWidth,
        scrollWidth: brand.scrollWidth,
        clientHeight: brand.clientHeight,
        scrollHeight: brand.scrollHeight,
        clipped: brand.scrollWidth > brand.clientWidth + 1 || brand.scrollHeight > brand.clientHeight + 1
      },
      documentHeight: {
        before: Math.round(beforeDocumentHeight * 100) / 100,
        after: Math.round(afterDocumentHeight * 100) / 100
      },
      workbenchHeight: {
        before: Math.round(beforeWorkbenchHeight * 100) / 100,
        after: Math.round(afterWorkbenchHeight * 100) / 100
      },
      wrappingOrHeightChanged: Math.abs(afterHeight - beforeHeight) >= 1
        || Math.abs(afterDocumentHeight - beforeDocumentHeight) >= 1,
      horizontalOverflow: Math.max(0, document.documentElement.scrollWidth - window.innerWidth),
      toolsFirstInDom: workbench.firstElementChild === tools,
      previewFollowsTools: Boolean(
        tools && preview && tools.compareDocumentPosition(preview) & Node.DOCUMENT_POSITION_FOLLOWING
      ),
      scaleFailures,
      dimensionOverflowObservations,
      dimensionClippingFailures,
      ancestorClippingFailures,
      overlapFailures,
      nestedScrollFailures,
      fixedStickyOcclusionFailures,
      fixedStickyViewportFailures,
      inspected: {
        ancestorPairs,
        rectanglePairs,
        crossParentRectanglePairs,
        scrollPositions: scrollPositions.length
      }
    };
  });
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
        mode,
        environment: {
          NEXT_PUBLIC_SUPABASE_URL: reportsWave1TestSupabaseUrl,
          NEXT_PUBLIC_SUPABASE_ANON_KEY: "wave8-public-anon-key"
        }
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
    interactiveTargetMatrixRows.length = 0;
    evidenceIdentity = resolveEvidenceIdentity();
    outputResolution = process.env.SAFECLAW_REPORTS_TASK_DISTANCE_EVIDENCE === "1"
      ? {
        directory: path.join(root, reportsTaskDistanceEvidenceRelativeDir),
        publish: true,
        cleanup: false
      }
      : resolveReportsWave1OutputDirectory({ root, env: process.env });
    outputDirectory = outputResolution.directory;
    fs.mkdirSync(outputDirectory, { recursive: true });
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
        evidenceIdentity = null;
      }
    }
  }, 30_000);

  it("keeps the mobile report workbench ahead of its long document by default", async () => {
    if (!browser) throw new Error("Browser was not started");
    const evidence: Array<Record<string, unknown>> = [];
    const reflowViolations: string[] = [];
    for (const scenario of [
      { theme: "day" as const, label: "mobile", width: 391, height: 844 },
      { theme: "night" as const, label: "mobile", width: 391, height: 844 },
      { theme: "day" as const, label: "desktop", width: 1440, height: 1000 },
      { theme: "night" as const, label: "desktop", width: 1440, height: 1000 }
    ] as const) {
      const page = await browser.newPage({
        viewport: { width: scenario.width, height: scenario.height },
        deviceScaleFactor: 1
      });
      try {
        await prepareDownloadReadyFixture(page, scenario.theme);
        const defaultMetrics = await page.evaluate(() => {
          const root = document.querySelector(".safeclaw-workdoc-shell");
          const tools = root?.querySelector(".safeclaw-workdoc-rail");
          const preview = root?.querySelector<HTMLDetailsElement>(".safeclaw-report-preview");
          const secondary = root?.querySelector<HTMLDetailsElement>(".safeclaw-report-secondary-tools");
          const download = root?.querySelector<HTMLButtonElement>(
            "[aria-label='리포트 다운로드'] button:not(:disabled)"
          );
          const violations: string[] = [];
          if (!root) return { violations: ["Reports workbench was not rendered"], rootHeight: 0, downloadDistance: 0 };
          if (!tools) violations.push("Reports operational tools were not rendered");
          if (!download) violations.push("Reports fixture did not expose an enabled download action");
          const rootRect = root.getBoundingClientRect();
          const downloadRect = download?.getBoundingClientRect();
          if (root.firstElementChild !== tools) violations.push("tools are not first in Reports DOM order");
          if (!preview || !secondary) violations.push("Reports disclosures were not rendered");
          if (preview?.open || secondary?.open) violations.push("Reports disclosures are expanded by default");
          const downloadDistance = downloadRect ? Math.round(downloadRect.top - rootRect.top) : 0;
          const toolsFirstInDom = root.firstElementChild === tools;
          const previewFollowsTools = Boolean(
            tools && preview && tools.compareDocumentPosition(preview) & Node.DOCUMENT_POSITION_FOLLOWING
          );
          return {
            violations,
            rootHeight: Math.round(rootRect.height),
            downloadDistance,
            devicePixelRatio: window.devicePixelRatio,
            toolsFirstInDom,
            previewFollowsTools,
            horizontalOverflow: Math.max(0, document.documentElement.scrollWidth - window.innerWidth)
          };
        });
        expect(defaultMetrics.violations, JSON.stringify({ scenario, defaultMetrics })).toEqual([]);
        expect(defaultMetrics.devicePixelRatio).toBe(1);
        expect(defaultMetrics.toolsFirstInDom).toBe(true);
        expect(defaultMetrics.previewFollowsTools).toBe(true);
        expect(defaultMetrics.horizontalOverflow).toBe(0);
        if (scenario.label === "mobile") {
          expect(defaultMetrics.downloadDistance).toBeLessThanOrEqual(1_200);
          expect(defaultMetrics.rootHeight).toBeLessThanOrEqual(2_600);
        }

        const coreSummary = page.getByLabel("리포트 핵심 요약");
        await coreSummary.waitFor({ state: "visible" });
        expect(await coreSummary.locator("p").count()).toBe(5);
        for (const label of ["평가 행", "고위험", "개선사항", "사진 후보", "승인 사진"]) {
          expect(await coreSummary.getByText(label, { exact: true }).count()).toBe(1);
        }
        expect(await page.getByLabel("리포트 핵심 요약").count()).toBe(1);
        expect(await page.locator(".safeclaw-report-secondary-tools [aria-label='리포트 핵심 요약']").count()).toBe(0);

        const defaultTargets = await measureInteractiveTargets(page, "default");
        expect(defaultTargets.undersized, JSON.stringify({ scenario, ...defaultTargets }, null, 2)).toEqual([]);
        recordInteractiveTargetRow(
          `${scenario.theme}-${scenario.label}-report-default`,
          scenario.theme,
          { width: scenario.width, height: scenario.height, label: scenario.label },
          defaultTargets,
        );
        expect(defaultTargets.targets.some((target) => target.disabled)).toBe(true);
        expect(defaultTargets.targets.some((target) => !target.disabled)).toBe(true);
        for (const name of ["SafeClaw 홈", "Day", "Night"]) {
          expect(defaultTargets.targets.some((target) => target.descriptor.includes(`[${name}]`))).toBe(true);
        }
        expect(defaultTargets.targets.some((target) => target.descriptor.includes("[문서팩 편집]"))).toBe(false);
        expect(defaultTargets.targets.some((target) => target.descriptor.includes("[개선사항 추가]"))).toBe(false);
        expect(defaultTargets.targets.some((target) => target.descriptor.includes("[개선사항 저장하기]"))).toBe(false);

        await openNamedReportsDisclosure(page, "추가 리포트 정보");
        const secondaryOpenTargets = await measureInteractiveTargets(page, "secondary-open");
        expect(
          secondaryOpenTargets.undersized,
          JSON.stringify({ scenario, ...secondaryOpenTargets }, null, 2)
        ).toEqual([]);
        recordInteractiveTargetRow(
          `${scenario.theme}-${scenario.label}-additional-info-open`,
          scenario.theme,
          { width: scenario.width, height: scenario.height, label: scenario.label },
          secondaryOpenTargets,
        );
        expect(
          secondaryOpenTargets.targets.length,
          JSON.stringify({ scenario, defaultTargets, secondaryOpenTargets }, null, 2)
        ).toBeGreaterThan(defaultTargets.targets.length);
        expect(secondaryOpenTargets.targets.some((target) => !target.disabled)).toBe(true);
        expect(secondaryOpenTargets.targets.some((target) => target.descriptor.includes("[문서팩 편집]"))).toBe(true);
        expect(secondaryOpenTargets.targets.some((target) => target.descriptor.includes("[개선사항 추가]"))).toBe(true);
        expect(secondaryOpenTargets.targets.some((target) => target.descriptor.includes("[개선사항 저장하기]"))).toBe(false);

        let previewOnlyTargets: InteractiveTargetInventory | null = null;
        if (scenario.label === "mobile") {
          await closeNamedReportsDisclosure(page, "추가 리포트 정보");
          await openNamedReportsDisclosure(page, "리포트 본문 미리보기");
          previewOnlyTargets = await measureInteractiveTargets(page, "preview-only");
          recordInteractiveTargetRow(
            `${scenario.theme}-${scenario.label}-preview-only`,
            scenario.theme,
            { width: scenario.width, height: scenario.height, label: scenario.label },
            previewOnlyTargets,
          );
          await openNamedReportsDisclosure(page, "추가 리포트 정보");
        } else {
          await openNamedReportsDisclosure(page, "리포트 본문 미리보기");
        }
        const bothOpenTargets = await measureInteractiveTargets(page, "both-open");
        expect(bothOpenTargets.undersized, JSON.stringify({ scenario, ...bothOpenTargets }, null, 2)).toEqual([]);
        recordInteractiveTargetRow(
          `${scenario.theme}-${scenario.label}-both-disclosures-open`,
          scenario.theme,
          { width: scenario.width, height: scenario.height, label: scenario.label },
          bothOpenTargets,
        );
        expect(
          bothOpenTargets.targets.length,
          JSON.stringify({ scenario, secondaryOpenTargets, bothOpenTargets }, null, 2)
        ).toBeGreaterThan(secondaryOpenTargets.targets.length);
        expect(bothOpenTargets.targets.some((target) => !target.disabled)).toBe(true);
        expect(bothOpenTargets.targets.some((target) => target.descriptor.includes("[문서팩 편집]"))).toBe(true);
        expect(bothOpenTargets.targets.some((target) => target.descriptor.includes("[개선사항 추가]"))).toBe(true);
        expect(bothOpenTargets.targets.some((target) => target.descriptor.includes("[개선사항 저장하기]"))).toBe(true);
        const reportDocument = page.getByLabel("작업문서형 리포트");
        await reportDocument.waitFor({ state: "visible" });
        expect(await reportDocument.locator("[role='row']").count()).toBeGreaterThan(1);
        expect(await page.getByLabel("리포트 다운로드").getByRole("button").count()).toBe(5);

        const previewSummary = page.locator(".safeclaw-report-preview > summary");
        await previewSummary.focus();
        expect(await previewSummary.evaluate((element) => document.activeElement === element)).toBe(true);

        if (process.env.SAFECLAW_REPORTS_TASK_DISTANCE_EVIDENCE === "1") {
          await page.screenshot({
            path: path.join(
              outputDirectory,
              `reports-download-ready-${scenario.theme}-${scenario.label}-disclosures-open.png`
            ),
            fullPage: true
          });
        }

        const zoomMetrics = await applyDeterministicTextReflow(page);
        const scenarioId = `${scenario.theme}-${scenario.label}-${scenario.width}x${scenario.height}`;
        const requireReflow = (condition: boolean, message: string): void => {
          if (!condition) reflowViolations.push(`${scenarioId}: ${message}`);
        };
        requireReflow(zoomMetrics.baselineImmutable, "typography baseline was mutable");
        requireReflow(zoomMetrics.textElementCount > 0, "no visible text elements were inspected");
        requireReflow(
          zoomMetrics.interactiveElementCount === bothOpenTargets.targets.length,
          `inspected ${zoomMetrics.interactiveElementCount} interactive elements; expected ${bothOpenTargets.targets.length}`
        );
        requireReflow(zoomMetrics.representative.growthRatio >= 1.9, "representative font did not grow >=1.9x");
        requireReflow(
          zoomMetrics.representative.lineHeightGrowthRatio >= 1.9,
          "representative line-height did not grow >=1.9x"
        );
        requireReflow(zoomMetrics.brand.growthRatio >= 1.9, "brand font did not grow >=1.9x");
        requireReflow(zoomMetrics.brand.clientWidth > 0, "brand has no rendered width");
        requireReflow(
          zoomMetrics.brand.clientWidth >= zoomMetrics.brand.scrollWidth,
          `brand clips horizontally client=${zoomMetrics.brand.clientWidth} scroll=${zoomMetrics.brand.scrollWidth}`
        );
        requireReflow(
          zoomMetrics.brand.clientHeight >= zoomMetrics.brand.scrollHeight,
          `brand clips vertically client=${zoomMetrics.brand.clientHeight} scroll=${zoomMetrics.brand.scrollHeight}`
        );
        requireReflow(!zoomMetrics.brand.clipped, "brand clipping flag is true");
        requireReflow(zoomMetrics.wrappingOrHeightChanged, "200% text did not change wrapping or height");
        requireReflow(zoomMetrics.horizontalOverflow === 0, `viewport horizontal overflow=${zoomMetrics.horizontalOverflow}`);
        requireReflow(zoomMetrics.toolsFirstInDom, "workbench tools are not first in DOM order");
        requireReflow(zoomMetrics.previewFollowsTools, "report preview does not follow tools in DOM order");
        for (const [category, failures] of [
          ["scale", zoomMetrics.scaleFailures],
          ["dimension-clipping", zoomMetrics.dimensionClippingFailures],
          ["ancestor-clipping", zoomMetrics.ancestorClippingFailures],
          ["overlap", zoomMetrics.overlapFailures],
          ["nested-scroll", zoomMetrics.nestedScrollFailures],
          ["fixed-sticky-occlusion", zoomMetrics.fixedStickyOcclusionFailures],
          ["fixed-sticky-viewport", zoomMetrics.fixedStickyViewportFailures]
        ] as const) {
          for (const failure of failures) reflowViolations.push(`${scenarioId}: ${category}: ${failure}`);
        }
        requireReflow(zoomMetrics.inspected.ancestorPairs > 0, "no ancestor pairs were inspected");
        requireReflow(zoomMetrics.inspected.rectanglePairs > 0, "no rectangle pairs were inspected");
        requireReflow(
          zoomMetrics.inspected.crossParentRectanglePairs > 0,
          "no cross-parent rectangle pairs were inspected"
        );
        requireReflow(zoomMetrics.inspected.scrollPositions >= 2, "fewer than two scroll positions were inspected");

        if (process.env.SAFECLAW_REPORTS_TASK_DISTANCE_EVIDENCE === "1") {
          await page.screenshot({
            path: path.join(
              outputDirectory,
              `reports-download-ready-${scenario.theme}-${scenario.label}-text-reflow-200.png`
            ),
            fullPage: true
          });
        }

        evidence.push({
          scenario,
          default: defaultMetrics,
          interactiveTargets: {
            default: defaultTargets,
            secondaryOpen: secondaryOpenTargets,
            previewOnly: previewOnlyTargets,
            bothOpen: bothOpenTargets
          },
          textZoom200: zoomMetrics
        });
      } finally {
        await page.close();
      }
    }
    if (process.env.SAFECLAW_REPORTS_TASK_DISTANCE_EVIDENCE === "1") {
      writeEvidenceJson("reports-download-ready-task-distance-metrics.json", { scenarios: evidence });
    }
    expect(reflowViolations, JSON.stringify(reflowViolations, null, 2)).toEqual([]);
  }, 240_000);

  it.each([
    { theme: "day" as const, width: 1440, height: 1000, label: "desktop" as const },
    { theme: "night" as const, width: 1440, height: 1000, label: "desktop" as const },
    { theme: "day" as const, width: 391, height: 844, label: "mobile" as const },
    { theme: "night" as const, width: 391, height: 844, label: "mobile" as const }
  ])("keeps sample Reports stable in $theme $label", async ({ theme, width, height, label }: Viewport & { theme: Theme }) => {
    if (!browser) throw new Error("Browser was not started");
    const page = await browser.newPage({ viewport: { width, height } });
    await prepareSample(page, theme);
    const sampleTargets = await measureInteractiveTargets(page, "sample-report-default");
    expect(sampleTargets.undersized, JSON.stringify({ theme, label, ...sampleTargets }, null, 2)).toEqual([]);
    expect(sampleTargets.horizontalOverflow).toBe(0);
    expect(sampleTargets.overlapFailures).toEqual([]);
    expect(sampleTargets.nestedScrollFailures).toEqual([]);

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
      const content = document.querySelector(".safeclaw-module-content > *");
      if (!selectedControl) throw new Error("Selected report period was not rendered");
      if (!hero || !heroMeta || !heroCta || !content) throw new Error("Reports hero geometry targets were not rendered");
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
        contentTop: Math.round(content.getBoundingClientRect().top),
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
      expect(metrics.contentTop).toBeLessThanOrEqual(387);
    } else {
      expect(metrics.heroColumnCount).toBe(2);
      expect(metrics.heroCtaClipped).toBe(false);
      expect(metrics.heroMetaCtaOverlap).toBe(false);
    }
    expect(focusOutline).toBe(theme === "day" ? "rgb(245, 197, 24)" : "rgb(108, 111, 247)");
    expect(metrics.accentText).toBe(theme === "day" ? "rgb(102, 81, 0)" : "rgb(181, 183, 255)");
    expect(metrics.tuples).toEqual({
      factLabel: ["12px", "600", "18px", "normal"],
      factValue: ["15px", "500", "24px", "normal"],
      note: ["15px", "500", "24px", "normal"],
      tableHeader: ["12px", "700", "18px", "normal"],
      tableBody: ["13px", "500", "20px", "normal"],
      groupLabel: ["12px", "600", "18px", "normal"],
      groupBody: ["15px", "500", "24px", "normal"],
      groupMeta: ["14px", "500", "22.4px", "normal"],
      control: ["14px", "500", "22.4px", "normal"]
    });

    writeEvidenceJson(
      `reports-sample-${theme}-${label}-metrics.json`,
      {
        harnessMode: harness?.mode ?? "dev",
        theme,
        viewport: { width, height },
        interactiveTargets: sampleTargets,
        selectedBackground: selectedBeforeHover,
        hoverBackground,
        focusOutline,
        ...metrics
      }
    );
    await page.screenshot({
      path: path.join(outputDirectory, `reports-sample-${theme}-${label}.png`),
      fullPage: true
    });
    await page.close();
  }, 120_000);

  it("captures deterministic empty and fail-closed server-error states", async () => {
    if (!browser) throw new Error("Browser was not started");
    const reportRowsWereCollected = interactiveTargetMatrixRows.length === 14;
    const stateScenarios = [
      { theme: "day" as const, width: 1440, height: 1000, label: "desktop" as const },
      { theme: "night" as const, width: 1440, height: 1000, label: "desktop" as const },
      { theme: "day" as const, width: 391, height: 844, label: "mobile" as const },
      { theme: "night" as const, width: 391, height: 844, label: "mobile" as const }
    ];
    const loadingResults: Array<Record<string, unknown>> = [];
    for (const scenario of stateScenarios) {
      const loadingPage = await browser.newPage({
        viewport: { width: scenario.width, height: scenario.height },
        deviceScaleFactor: 1
      });
      await installServerAuth(loadingPage);
      let routeHitCount = 0;
      let captureInterceptedRoute: (route: Route) => void = () => {
        throw new Error("Reports loading route resolver was not initialized");
      };
      const interceptedRoutePromise = new Promise<Route>((resolve) => {
        captureInterceptedRoute = resolve;
      });
      await loadingPage.route("**/api/workpacks/wave-1-loading", async (route) => {
        routeHitCount += 1;
        captureInterceptedRoute(route);
      });
      const serverRequest = loadingPage.waitForRequest("**/api/workpacks/wave-1-loading");
      await loadingPage.goto(`${baseUrl}/reports?theme=${scenario.theme}&workpackId=wave-1-loading`, {
        waitUntil: "domcontentloaded"
      });
      await serverRequest;
      await loadingPage.getByLabel("리포트 데이터 확인 상태").waitFor({ state: "visible" });
      expect(routeHitCount).toBeGreaterThan(0);
      const targets = await measureInteractiveTargets(loadingPage, "loading");
      recordInteractiveTargetRow(
        `${scenario.theme}-${scenario.label}-loading`,
        scenario.theme,
        scenario,
        targets,
      );
      loadingResults.push({ ...scenario, routeHitCount, interactiveTargets: targets });
      await loadingPage.screenshot({
        path: path.join(outputDirectory, `reports-loading-${scenario.theme}-${scenario.label}.png`),
        fullPage: true
      });
      const interceptedRoute = await interceptedRoutePromise;
      await interceptedRoute.abort("aborted");
      await loadingPage.close();
    }

    const emptyResults: Array<Record<string, unknown>> = [];
    for (const scenario of stateScenarios) {
      const empty = await browser.newPage({
        viewport: { width: scenario.width, height: scenario.height },
        deviceScaleFactor: 1
      });
      await empty.goto(`${baseUrl}/reports?theme=${scenario.theme}`, { waitUntil: "networkidle" });
      await empty.getByLabel("리포트 빈 상태").waitFor({ state: "visible" });
      expect(await empty.getByLabel("다운로드 준비 상태").textContent()).toContain("현재 작업팩 필요");
      const targets = await measureInteractiveTargets(empty, "empty");
      recordInteractiveTargetRow(
        `${scenario.theme}-${scenario.label}-empty`,
        scenario.theme,
        scenario,
        targets,
      );
      emptyResults.push({ ...scenario, interactiveTargets: targets });
      await empty.screenshot({
        path: path.join(outputDirectory, `reports-empty-${scenario.theme}-${scenario.label}.png`),
        fullPage: true
      });
      await empty.close();
    }

    const serverErrorResults: Array<Record<string, unknown>> = [];
    const expectedServerErrorMessage = "서버 작업팩 조회 중 검증용 오류가 발생했습니다.";
    for (const scenario of stateScenarios) {
      const serverError = await browser.newPage({
        viewport: { width: scenario.width, height: scenario.height },
        deviceScaleFactor: 1
      });
      await installServerAuth(serverError);
      let routeHitCount = 0;
      let authorizationHeader = "";
      await serverError.route("**/api/workpacks/wave-1-error", async (route) => {
        routeHitCount += 1;
        authorizationHeader = route.request().headers().authorization || "";
        await route.fulfill({
          status: 500,
          contentType: "application/json",
          body: JSON.stringify({ ok: false, message: expectedServerErrorMessage })
        });
      });
      await serverError.goto(`${baseUrl}/reports?theme=${scenario.theme}&workpackId=wave-1-error`, {
        waitUntil: "networkidle"
      });
      const errorState = serverError.getByLabel("서버 작업팩 오류 상태");
      await errorState.waitFor({ state: "visible" });
      expect(routeHitCount).toBeGreaterThan(0);
      expect(authorizationHeader).toBe(`Bearer ${reportsWave1TestAccessToken}`);
      expect(await errorState.getByRole("heading", { name: "서버 저장 작업팩을 열지 못했습니다." }).count()).toBe(1);
      expect(await errorState.getByText(expectedServerErrorMessage, { exact: true }).count()).toBe(1);
      const downloads = errorState.getByLabel("리포트 다운로드").getByRole("button");
      expect(await downloads.count()).toBe(5);
      for (const button of await downloads.all()) expect(await button.isDisabled()).toBe(true);
      const readiness = errorState.getByLabel("다운로드 준비 상태");
      expect(await readiness.textContent()).toContain("다운로드 잠김");
      const targets = await measureInteractiveTargets(serverError, "server-error");
      recordInteractiveTargetRow(
        `${scenario.theme}-${scenario.label}-server-error`,
        scenario.theme,
        scenario,
        targets,
      );
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
        routeHitCount,
        disabledDownloadCount: await downloads.count(),
        state: "server-error",
        interactiveTargets: targets,
        ...metrics
      });
      await serverError.screenshot({
        path: path.join(outputDirectory, `reports-server-error-${scenario.theme}-${scenario.label}.png`),
        fullPage: true
      });
      await serverError.close();
    }
    const stateCounts = interactiveTargetMatrixRows.reduce<Record<string, number>>((counts, row) => {
      counts[row.state] = (counts[row.state] ?? 0) + 1;
      return counts;
    }, {});
    if (reportRowsWereCollected || evidenceIdentity) {
      expect(interactiveTargetMatrixRows).toHaveLength(26);
      expect(stateCounts).toEqual({
        default: 4,
        "secondary-open": 4,
        "preview-only": 2,
        "both-open": 4,
        loading: 4,
        empty: 4,
        "server-error": 4
      });
    } else {
      expect(interactiveTargetMatrixRows).toHaveLength(12);
      expect(stateCounts).toEqual({ loading: 4, empty: 4, "server-error": 4 });
    }
    writeEvidenceJson("reports-state-metrics.json", {
      harnessMode: harness?.mode ?? "dev",
      loading: loadingResults,
      empty: emptyResults,
      serverError: serverErrorResults
    });
    writeEvidenceJson("reports-interactive-target-matrix.json", {
      rowCount: interactiveTargetMatrixRows.length,
      stateCounts,
      rows: interactiveTargetMatrixRows
    });
  }, 240_000);
});
