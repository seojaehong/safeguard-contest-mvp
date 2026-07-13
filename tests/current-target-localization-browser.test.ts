import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Browser, ConsoleMessage, Page } from "playwright";
import { buildStoredCurrentWorkpack, CURRENT_WORKPACK_STORAGE_KEY } from "@/lib/current-workpack";
import { buildDbHarnessPacket, buildHarnessPromptContext } from "@/lib/db-harness";
import { buildSampleWorkpack } from "@/lib/sample-workpack";
import {
  startIsolatedNextBrowserHarness,
  type IsolatedNextBrowserHarness
} from "./helpers/isolated-next-browser-harness";

type Theme = "day" | "night";
type RouteContract = {
  name: "reports" | "ontology" | "knowledge" | "workspace";
  pathname: "/reports" | "/ontology" | "/knowledge" | "/workspace";
  readyRole: "article" | "region";
  readyName: string;
  geometryScope: string;
  forbiddenPattern: RegExp;
};

const root = process.cwd();
const sourceSha = execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).trim();
const issueOverlayPattern = /(?<![\p{L}\p{N}_])(?:(?:\d+|N)\s+Issues?|Issues?\s*(?:\(\s*(?:\d+|N)\s*\)|:\s*(?:\d+|N)|\s+(?:\d+|N)))(?![\p{L}\p{N}_])/iu;
const meaningfulSelector = [
  "main h1", "main h2", "main h3", "main h4", "main p", "main span", "main strong", "main small",
  "main label", "main a", "main button", "main input", "main select", "main textarea", "main summary",
  "main dt", "main dd", "main li", "main [role='button']", "main [role='checkbox']", "main [role='radio']",
  "main [role='tab']", "main [role='note']"
].join(",");
const routes: RouteContract[] = [
  {
    name: "reports",
    pathname: "/reports",
    readyRole: "article",
    readyName: "작업문서형 리포트",
    geometryScope: "main",
    forbiddenPattern: /\b(?:As-Is|To-Be|Before\/After)\b/u
  },
  {
    name: "ontology",
    pathname: "/ontology",
    readyRole: "region",
    readyName: "옵시디언형 온톨로지 그래프",
    geometryScope: "main",
    forbiddenPattern: /\b(?:Task|Hazard|Control|Article|Document|Accident|Duty|Nodes|Edges|Gate|Fallback)\b|Graph unavailable/u
  },
  {
    name: "knowledge",
    pathname: "/knowledge",
    readyRole: "region",
    readyName: "지식 DB 상태",
    geometryScope: "main",
    forbiddenPattern: /Built-in Wiki|Runtime Knowledge|Knowledge Catalog|KOSHA Technical Support|KOSHA Reference Library|\b(?:Index|Hazards|Forms|Schema)\b/u
  },
  {
    name: "workspace",
    pathname: "/workspace",
    readyRole: "region",
    readyName: "작업 이력 그래프",
    geometryScope: ".workspace-operation-memory",
    forbiddenPattern: /\b(?:Ack\s+Node|Operation Ontology)\b/u
  }
];
const viewports = [
  { label: "desktop" as const, width: 1440, height: 1000 },
  { label: "mobile" as const, width: 391, height: 844 }
];

let harness: IsolatedNextBrowserHarness | null = null;
let browser: Browser | null = null;
let outputDirectory = "";
let temporaryOutputDirectory = false;

function buildId(): string | null {
  const buildIdPath = path.join(root, ".next", "BUILD_ID");
  return fs.existsSync(buildIdPath) ? fs.readFileSync(buildIdPath, "utf8").trim() : null;
}

function buildOperationMemoryWorkpack() {
  const sample = buildSampleWorkpack();
  const packet = buildDbHarnessPacket({
    question: sample.question,
    references: [{
      id: "current-target-operation-memory-reference",
      source_id: "current-target-browser-fixture",
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
      retrieval_source: "ranked"
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
  return sample;
}

function collectRecoverableHydrationErrors(page: Page): string[] {
  const errors: string[] = [];
  const record = (message: string): void => {
    if (/recoverable hydration|hydration failed|server rendered html|hydration mismatch/iu.test(message)) {
      errors.push(message);
    }
  };
  page.on("console", (message: ConsoleMessage) => {
    if (message.type() === "error" || message.type() === "warning") record(message.text());
  });
  page.on("pageerror", (error: Error) => record(error.message));
  return errors;
}

async function prepareRoute(page: Page, contract: RouteContract, theme: Theme): Promise<void> {
  if (!harness) throw new Error("Browser harness was not started");
  if (contract.name === "workspace") {
    const stored = buildStoredCurrentWorkpack(buildOperationMemoryWorkpack());
    await page.addInitScript(
      ({ key, value }) => window.localStorage.setItem(key, value),
      { key: CURRENT_WORKPACK_STORAGE_KEY, value: JSON.stringify(stored) }
    );
  }
  await page.goto(`${harness.baseUrl}${contract.pathname}?theme=${theme}`, { waitUntil: "networkidle" });
  if (contract.name === "reports") {
    await page.getByRole("button", { name: "샘플 미리보기" }).click();
  }
  if (contract.name === "workspace") {
    await page.locator(".doc-card-actions button", { hasText: "편집" }).click();
  }
  await page.getByRole(contract.readyRole, { name: contract.readyName }).waitFor({ state: "visible" });
}

describe("current target localization browser matrix", () => {
  beforeAll(async () => {
    outputDirectory = process.env.SAFECLAW_LOCALIZATION_EVIDENCE_DIR
      ? path.resolve(root, process.env.SAFECLAW_LOCALIZATION_EVIDENCE_DIR)
      : fs.mkdtempSync(path.join(os.tmpdir(), "safeclaw-localization-browser-"));
    temporaryOutputDirectory = !process.env.SAFECLAW_LOCALIZATION_EVIDENCE_DIR;
    fs.mkdirSync(outputDirectory, { recursive: true });
    harness = await startIsolatedNextBrowserHarness({
      slug: "current-target-localization",
      initialPath: "/reports",
      portSalt: 13_071,
      mode: process.env.SAFECLAW_HARNESS_MODE === "prod" ? "prod" : "dev"
    });
    browser = harness.browser;
    if (process.env.SAFECLAW_LOCALIZATION_EVIDENCE_DIR) {
      const expectedBuildId = process.env.SAFECLAW_EXPECTED_BUILD_ID?.trim();
      const expectedSourceSha = process.env.SAFECLAW_EXPECTED_SOURCE_SHA?.trim();
      const currentBuildId = buildId();
      expect(harness.mode).toBe("prod");
      expect(expectedBuildId).toBeTruthy();
      expect(expectedSourceSha).toBe(sourceSha);
      expect(currentBuildId).toBeTruthy();
      expect(currentBuildId).toBe(expectedBuildId);
    }
  }, 120_000);

  afterAll(async () => {
    await harness?.stop();
    if (temporaryOutputDirectory && outputDirectory) {
      fs.rmSync(outputDirectory, { recursive: true, force: true });
    }
  }, 30_000);

  it("detects singular, plural, numeric, and symbolic issue overlays", () => {
    for (const value of ["1 Issue", "2 Issues", "N Issues", "Issue (1)", "Issues (2)", "Issue: 1", "Issues: N"]) {
      expect(issueOverlayPattern.test(value), value).toBe(true);
    }
    expect(issueOverlayPattern.test("문제가 없습니다.")).toBe(false);
  });

  it.each(viewports)("keeps operation memory controls separated on $label", async ({ width, height }) => {
    if (!browser) throw new Error("Browser harness was not started");
    const page = await browser.newPage({ viewport: { width, height } });
    await prepareRoute(page, routes[1], "day");
    const operationRegion = page.getByRole("region", { name: "오늘 작업 메모리 맵" });
    const controls = await operationRegion.getByRole("button").all();
    const boxes = await Promise.all(controls.map(async (control) => ({
      name: await control.getAttribute("aria-label") || await control.innerText(),
      box: await control.boundingBox()
    })));
    const overlaps: string[] = [];
    for (let left = 0; left < boxes.length; left += 1) {
      const leftBox = boxes[left].box;
      if (!leftBox) continue;
      for (let right = left + 1; right < boxes.length; right += 1) {
        const rightBox = boxes[right].box;
        if (!rightBox) continue;
        const overlapWidth = Math.min(leftBox.x + leftBox.width, rightBox.x + rightBox.width)
          - Math.max(leftBox.x, rightBox.x);
        const overlapHeight = Math.min(leftBox.y + leftBox.height, rightBox.y + rightBox.height)
          - Math.max(leftBox.y, rightBox.y);
        if (overlapWidth > 2 && overlapHeight > 2) overlaps.push(`${boxes[left].name} <> ${boxes[right].name}`);
      }
    }
    expect(overlaps, overlaps.slice(0, 10).join("\n")).toEqual([]);
    await page.close();
  }, 120_000);

  it("hydrates the workspace operation-memory surface without recoverable errors", async () => {
    if (!browser) throw new Error("Browser harness was not started");
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    const recoverableErrors = collectRecoverableHydrationErrors(page);
    await prepareRoute(page, routes[3], "day");
    await page.waitForTimeout(250);
    expect(recoverableErrors).toEqual([]);
    await page.close();
  }, 120_000);

  it.each(routes.flatMap((contract) => (
    (["day", "night"] as const).flatMap((theme) => (
      viewports.map((viewport) => ({ contract, theme, ...viewport }))
    ))
  )))("keeps $contract.name Korean and contained in $theme $label", async ({ contract, theme, width, height, label }) => {
    if (!browser || !harness) throw new Error("Browser harness was not started");
    const page = await browser.newPage({ viewport: { width, height } });
    const recoverableErrors = collectRecoverableHydrationErrors(page);
    await prepareRoute(page, contract, theme);
    const metrics = await page.evaluate(({ meaningfulSelector, issueSource, issueFlags, scopeSelector }) => {
      const clippingValues = new Set(["auto", "clip", "hidden", "scroll"]);
      const visibleRect = (element: HTMLElement) => {
        const rect = element.getBoundingClientRect();
        let left = Math.max(0, rect.left);
        let right = Math.min(window.innerWidth, rect.right);
        let top = Math.max(0, rect.top);
        let bottom = Math.min(document.documentElement.scrollHeight, rect.bottom);
        let parent = element.parentElement;
        while (parent && parent !== document.body) {
          const style = getComputedStyle(parent);
          const parentRect = parent.getBoundingClientRect();
          if (clippingValues.has(style.overflowX)) {
            left = Math.max(left, parentRect.left);
            right = Math.min(right, parentRect.right);
          }
          if (clippingValues.has(style.overflowY)) {
            top = Math.max(top, parentRect.top);
            bottom = Math.min(bottom, parentRect.bottom);
          }
          parent = parent.parentElement;
        }
        if (right - left <= 0 || bottom - top <= 0) return null;
        return { left, right, top, bottom };
      };
      const scope = document.querySelector<HTMLElement>(scopeSelector);
      if (!scope) throw new Error(`Missing geometry scope: ${scopeSelector}`);
      const overlapTargets = [...scope.querySelectorAll<HTMLElement>(meaningfulSelector)]
        .filter((element) => {
          const style = getComputedStyle(element);
          const rect = element.getBoundingClientRect();
          return element.getAttribute("aria-hidden") !== "true"
            && element.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true })
            && style.display !== "none"
            && style.visibility !== "hidden"
            && Number(style.opacity) > 0
            && rect.width > 0
            && rect.height > 0;
        });
      const overlapPairs: string[] = [];
      const describeElement = (element: HTMLElement) => {
        const name = element.getAttribute("aria-label") || element.textContent || "";
        return `${element.tagName.toLowerCase()}[${name.trim().replace(/\s+/gu, " ").slice(0, 48)}]`;
      };
      for (let left = 0; left < overlapTargets.length; left += 1) {
        const leftElement = overlapTargets[left];
        const leftRect = visibleRect(leftElement);
        if (!leftRect) continue;
        for (let right = left + 1; right < overlapTargets.length; right += 1) {
          const rightElement = overlapTargets[right];
          if (leftElement.contains(rightElement) || rightElement.contains(leftElement)) continue;
          const rightRect = visibleRect(rightElement);
          if (!rightRect) continue;
          const overlapWidth = Math.min(leftRect.right, rightRect.right) - Math.max(leftRect.left, rightRect.left);
          const overlapHeight = Math.min(leftRect.bottom, rightRect.bottom) - Math.max(leftRect.top, rightRect.top);
          if (overlapWidth > 2 && overlapHeight > 2) {
            overlapPairs.push(`${describeElement(leftElement)} <> ${describeElement(rightElement)}`);
          }
        }
      }
      const unnamedInteractiveCount = [...document.querySelectorAll<HTMLElement>(
        "a,button,input,select,textarea,summary,[tabindex]"
      )].filter((element) => {
        if (element.getAttribute("aria-hidden") === "true") return false;
        const style = getComputedStyle(element);
        if (style.display === "none" || style.visibility === "hidden") return false;
        const labelText = element.closest("label")?.textContent || "";
        const name = element.getAttribute("aria-label")
          || element.getAttribute("title")
          || element.textContent
          || labelText;
        return !name.trim();
      }).length;
      const issuePattern = new RegExp(issueSource, issueFlags);
      const shadowText: string[] = [];
      document.querySelectorAll<HTMLElement>("*").forEach((element) => {
        if (element.shadowRoot?.textContent) shadowText.push(element.shadowRoot.textContent);
      });
      const overlayCorpus = [document.body.innerText, ...shadowText].join("\n");
      return {
        horizontalOverflow: Math.max(0, document.documentElement.scrollWidth - window.innerWidth),
        overlapCount: overlapPairs.length,
        overlapPairs: overlapPairs.slice(0, 20),
        unnamedInteractiveCount,
        issueOverlayDetected: issuePattern.test(overlayCorpus),
        bodyText: document.body.innerText
      };
    }, {
      meaningfulSelector,
      issueSource: issueOverlayPattern.source,
      issueFlags: issueOverlayPattern.flags,
      scopeSelector: contract.geometryScope
    });

    expect(metrics.horizontalOverflow).toBe(0);
    expect(metrics.overlapPairs, metrics.overlapPairs.join("\n")).toEqual([]);
    expect(metrics.unnamedInteractiveCount).toBe(0);
    expect(metrics.issueOverlayDetected).toBe(false);
    expect(metrics.bodyText).not.toMatch(contract.forbiddenPattern);
    expect(recoverableErrors).toEqual([]);

    const evidence = {
      sourceSha,
      buildId: buildId(),
      harnessMode: harness.mode,
      route: contract.pathname,
      theme,
      viewport: { label, width, height },
      horizontalOverflow: metrics.horizontalOverflow,
      overlapCount: metrics.overlapCount,
      unnamedInteractiveCount: metrics.unnamedInteractiveCount,
      issueOverlayDetected: metrics.issueOverlayDetected
    };
    fs.writeFileSync(
      path.join(outputDirectory, `${contract.name}-${theme}-${label}.json`),
      `${JSON.stringify(evidence, null, 2)}\n`,
      "utf8"
    );
    await page.screenshot({
      path: path.join(outputDirectory, `${contract.name}-${theme}-${label}.png`),
      fullPage: true
    });
    await page.close();
  }, 120_000);
});
