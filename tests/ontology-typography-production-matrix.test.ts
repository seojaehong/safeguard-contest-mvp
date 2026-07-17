import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Browser, Page } from "playwright";
import { buildStoredCurrentWorkpack, CURRENT_WORKPACK_STORAGE_KEY } from "@/lib/current-workpack";
import { buildDbHarnessPacket, buildHarnessPromptContext } from "@/lib/db-harness";
import { buildSampleWorkpack } from "@/lib/sample-workpack";

import {
  startIsolatedNextBrowserHarness,
  type IsolatedNextBrowserHarness,
} from "./helpers/isolated-next-browser-harness";

const productionMatrix = process.env.ONTOLOGY_TYPOGRAPHY_PROD_MATRIX === "1" ? describe : describe.skip;
let harness: IsolatedNextBrowserHarness | null = null;
let browser: Browser | null = null;

type TypographyMetric = {
  firstFont: string;
  size: string;
  weight: string;
  lineHeight: number;
  tracking: number;
};

async function readMetric(page: Page, selector: string): Promise<TypographyMetric> {
  return page.locator(selector).first().evaluate((element) => {
    const style = getComputedStyle(element);
    return {
      firstFont: style.fontFamily.split(",")[0].trim().replace(/^['"]|['"]$/gu, ""),
      size: style.fontSize,
      weight: style.fontWeight,
      lineHeight: Number.parseFloat(style.lineHeight),
      tracking: Number.parseFloat(style.letterSpacing) || 0,
    };
  });
}

async function expectRole(
  page: Page,
  selectors: readonly string[],
  expected: TypographyMetric,
): Promise<void> {
  for (const selector of selectors) {
    const metric = await readMetric(page, selector);
    expect(metric, selector).toMatchObject(expected);
    expect(metric.tracking, selector).toBeCloseTo(expected.tracking, 2);
  }
}

type OperationMemoryRoute = "ontology" | "workspace";
type OperationMemoryRole = "support" | "supportCompact" | "action" | "hud" | "hudTracked" | "bodyTitle" | "caption";
type OperationMemoryFamily = {
  selector: string;
  role: OperationMemoryRole;
  routes: readonly OperationMemoryRoute[];
};

const bothRoutes = ["ontology", "workspace"] as const;
const operationMemoryFamilies: readonly OperationMemoryFamily[] = [
  { selector: ".operation-memory-copy p", role: "support", routes: bothRoutes },
  { selector: ".operation-memory-detail p", role: "support", routes: bothRoutes },
  { selector: ".operation-memory-list-item strong", role: "supportCompact", routes: bothRoutes },
  { selector: ".operation-memory-actions button", role: "action", routes: ["ontology"] },
  { selector: ".operation-memory-stats span", role: "hud", routes: bothRoutes },
  { selector: ".operation-memory-point > span", role: "hud", routes: bothRoutes },
  { selector: ".operation-memory-list-item span", role: "hud", routes: bothRoutes },
  { selector: ".operation-memory-detail > span", role: "hud", routes: bothRoutes },
  { selector: ".operation-memory-detail dt", role: "hudTracked", routes: bothRoutes },
  { selector: ".operation-memory-detail li b", role: "hudTracked", routes: bothRoutes },
  { selector: ".operation-memory-detail > strong", role: "bodyTitle", routes: bothRoutes },
  { selector: ".operation-memory-point strong", role: "caption", routes: bothRoutes },
  { selector: ".operation-memory-point small", role: "caption", routes: bothRoutes },
  { selector: ".operation-memory-list-item small", role: "caption", routes: bothRoutes },
  { selector: ".operation-memory-detail dd", role: "caption", routes: bothRoutes },
  { selector: ".operation-memory-detail li span", role: "caption", routes: bothRoutes },
];

const roleMetrics: Record<OperationMemoryRole, TypographyMetric> = {
  support: { firstFont: "Noto Sans KR", size: "15px", weight: "500", lineHeight: 24, tracking: 0 },
  supportCompact: { firstFont: "Noto Sans KR", size: "14px", weight: "500", lineHeight: 22.4, tracking: 0 },
  action: { firstFont: "Noto Sans KR", size: "14px", weight: "700", lineHeight: 20, tracking: 0 },
  hud: { firstFont: "Geist Mono", size: "11px", weight: "700", lineHeight: 16, tracking: 0 },
  hudTracked: { firstFont: "Geist Mono", size: "11px", weight: "700", lineHeight: 16, tracking: 0.88 },
  bodyTitle: { firstFont: "Noto Sans KR", size: "17px", weight: "500", lineHeight: 28.05, tracking: 0 },
  caption: { firstFont: "Noto Sans KR", size: "12px", weight: "600", lineHeight: 18, tracking: 0 },
};

async function expectOperationMemoryFamilies(page: Page, route: OperationMemoryRoute): Promise<void> {
  const root = route === "ontology" ? ".operation-memory-preview" : ".workspace-operation-memory";
  const listItems = page.locator(`${root} .operation-memory-list-item`);
  for (let index = 0; index < await listItems.count(); index += 1) {
    await listItems.nth(index).click();
    if (await page.locator(`${root} .operation-memory-detail li b`).count()) break;
  }
  await page.locator(`${root} .operation-memory-detail li b`).first().waitFor({ state: "attached" });
  for (const family of operationMemoryFamilies.filter((entry) => entry.routes.includes(route))) {
    const workspaceRelaxedCaption = new Set([
      ".operation-memory-detail p",
      ".operation-memory-point small",
      ".operation-memory-list-item small",
    ]);
    const expected = route === "workspace" && workspaceRelaxedCaption.has(family.selector)
        ? { firstFont: "Noto Sans KR", size: "12px", weight: "600", lineHeight: 19.8, tracking: 0 }
      : route === "workspace" && family.role === "support"
        ? { firstFont: "Noto Sans KR", size: "14px", weight: "500", lineHeight: 22.4, tracking: 0 }
        : roleMetrics[family.role];
    await expectRole(page, [`${root} ${family.selector}`], expected);
  }
}

function buildOperationMemoryWorkpack() {
  const sample = buildSampleWorkpack();
  const packet = buildDbHarnessPacket({
    question: sample.question,
    references: [{
      id: "wave6-operation-memory-reference",
      source_id: "wave6-browser-fixture",
      item_type: "technical-guideline",
      category: "추락",
      subcategory: "비계",
      title: "이동식 비계 추락 예방 지침",
      summary: "작업 전 난간과 작업발판 상태를 확인합니다.",
      keywords: ["비계", "추락"],
      risk_tags: ["fall"],
      primary_documents: ["위험성평가표", "TBM 브리핑"],
      controls: ["난간과 작업발판 상태 확인"],
      evidence_role: "direct",
      retrieval_source: "ranked",
    }],
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
      ontologyStatus: packet.ontologyChecklist.status,
    },
  };
  return sample;
}

productionMatrix("ontology typography production matrix", () => {
  beforeAll(async () => {
    harness = await startIsolatedNextBrowserHarness({
      slug: "ontology-typography-matrix",
      initialPath: "/ontology?theme=day",
      portSalt: 9511,
      mode: "prod",
    });
    browser = harness.browser;
  }, 90_000);

  afterAll(async () => {
    await harness?.stop();
  }, 30_000);

  it("keeps ontology roles, popovers, and operation-memory regression geometry stable", async () => {
    if (!browser || !harness) throw new Error("Production browser harness was not started");
    expect(harness.mode).toBe("prod");

    for (const viewport of [
      { width: 1440, height: 900 },
      { width: 390, height: 844 },
      { width: 1440, height: 320 },
    ] as const) {
      for (const theme of ["day", "night"] as const) {
        const page = await browser.newPage({ viewport });
        await page.goto(`${harness.baseUrl}/ontology?theme=${theme}`, { waitUntil: "networkidle" });
        await page.locator(".safeclaw-module-shell[data-ready='true']").waitFor();
        const compactOntology = viewport.width <= 720;

        await expectRole(page, ['[aria-label="온톨로지 상태 요약"] article span'], { firstFont: "Noto Sans KR", size: "12px", weight: "600", lineHeight: 18, tracking: 0 });
        await expectRole(page, ['[aria-label="온톨로지 상태 요약"] article strong'], compactOntology
          ? { firstFont: "Noto Sans KR", size: "22px", weight: "600", lineHeight: 30, tracking: 0 }
          : { firstFont: "Noto Sans KR", size: "28px", weight: "600", lineHeight: 36, tracking: 0 });
        await expectRole(page, ['[aria-label="온톨로지 상태 요약"] article small'], compactOntology
          ? { firstFont: "Noto Sans KR", size: "11px", weight: "500", lineHeight: 16, tracking: 0 }
          : { firstFont: "Noto Sans KR", size: "13px", weight: "500", lineHeight: 20, tracking: 0 });
        await expectRole(page, ['[aria-label="작업팩 개선 루프"] span'], { firstFont: "Noto Sans KR", size: "12px", weight: "700", lineHeight: 18, tracking: 0 });
        await expectRole(page, ['[aria-label="작업팩 개선 루프"] strong'], { firstFont: "Noto Sans KR", size: "15px", weight: "500", lineHeight: 24, tracking: 0 });
        await expectRole(page, ['#ontology-explorer-title'], { firstFont: "Noto Sans KR", size: "24px", weight: "600", lineHeight: 32, tracking: 0 });
        await expectRole(page, ['[aria-labelledby="ontology-explorer-title"] header p'], { firstFont: "Noto Sans KR", size: "14px", weight: "500", lineHeight: 22, tracking: 0 });
        await expectRole(page, ['[data-testid="ontology-neighborhood-node"] span'], { firstFont: "Noto Sans KR", size: "12px", weight: "600", lineHeight: 18, tracking: 0 });
        await expectRole(page, ['[data-testid="ontology-neighborhood-node"] strong'], { firstFont: "Noto Sans KR", size: "13px", weight: "500", lineHeight: 19, tracking: 0 });
        await expectRole(page, ['[data-testid="ontology-neighborhood-node"] small'], { firstFont: "Noto Sans KR", size: "13px", weight: "700", lineHeight: 20, tracking: 0 });
        await expectRole(page, ['[aria-labelledby="ontology-directory-title"] button span'], { firstFont: "Noto Sans KR", size: "12px", weight: "600", lineHeight: 18, tracking: 0 });
        await expectRole(page, ['[aria-labelledby="ontology-directory-title"] button strong'], { firstFont: "Noto Sans KR", size: "14px", weight: "500", lineHeight: 22, tracking: 0 });
        expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);
        await page.close();
      }
    }

    for (const viewport of [
      { width: 1440, height: 900 },
      { width: 390, height: 844 },
      { width: 1440, height: 320 },
    ] as const) {
      for (const theme of ["day", "night"] as const) {
        const page = await browser.newPage({ viewport });
        const stored = buildStoredCurrentWorkpack(buildOperationMemoryWorkpack());
        await page.addInitScript(
          ({ key, value }) => window.localStorage.setItem(key, value),
          { key: CURRENT_WORKPACK_STORAGE_KEY, value: JSON.stringify(stored) },
        );
        await page.goto(`${harness.baseUrl}/workspace?theme=${theme}`, { waitUntil: "networkidle" });
        await page.locator(".workspace-document-page").waitFor({ state: "visible" });
        await page.locator(".doc-card-actions button", { hasText: "편집" }).click();
        await page.locator(".workspace-operation-memory").waitFor({ state: "visible" });
        await expectOperationMemoryFamilies(page, "workspace");
        expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);
        await page.close();
      }
    }
  }, 180_000);
});
