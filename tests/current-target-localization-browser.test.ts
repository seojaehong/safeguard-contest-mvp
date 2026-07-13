import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Browser, ConsoleMessage, Page } from "playwright";
import {
  buildStoredCurrentWorkpack,
  CURRENT_WORKPACK_STORAGE_KEY,
  type CurrentWorkerSnapshot
} from "@/lib/current-workpack";
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
    forbiddenPattern: /\b(?:Task|Hazard|Control|Article|Document|Accident|Duty|Nodes|Edges|Gate|Fallback|photo_analysis|analyzed|vision_ocr|photo_pair_unanalyzed|manual_text|future_machine_token)\b|Graph unavailable|비포\/애프터/u
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
    forbiddenPattern: /\b(?:Ack\s+Node|Operation Ontology|photo_analysis|analyzed|vision_ocr|photo_pair_unanalyzed|manual_text)\b|비포\/애프터/u
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

  it.each([1, 2])("restores the canonical worker snapshot without a pre-restore write (run %i)", async () => {
    if (!browser || !harness) throw new Error("Browser harness was not started");
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    const restoredWorker = {
      id: "worker-canonical-restored",
      displayName: "복원 기준 작업자",
      role: "도장 작업자",
      joinedAt: "2026-07-11",
      experienceLevel: "숙련" as const,
      experienceSummary: "외벽 도장 숙련 작업자",
      nationality: "대한민국",
      languageCode: "ko",
      languageLabel: "한국어",
      isNewWorker: false,
      isForeignWorker: false,
      trainingStatus: "이수" as const,
      trainingSummary: "당일 TBM 확인 완료"
    };
    const workerSnapshot: CurrentWorkerSnapshot = {
      savedAt: "2026-07-11T16:40:00+09:00",
      source: "workspace",
      workers: [restoredWorker],
      selectedWorkerIds: [restoredWorker.id]
    };
    const stored = buildStoredCurrentWorkpack(buildOperationMemoryWorkpack(), { workerSnapshot });
    await page.addInitScript(({ key, value }) => {
      window.localStorage.setItem(key, value);
      const originalGetItem = Storage.prototype.getItem;
      const originalSetItem = Storage.prototype.setItem;
      const events: Array<{ kind: "read" } | { kind: "write"; workerIds: string[] }> = [];
      (window as unknown as { __currentWorkpackStorageEvents: typeof events }).__currentWorkpackStorageEvents = events;
      Storage.prototype.getItem = function trackedGetItem(storageKey: string): string | null {
        if (storageKey === key) events.push({ kind: "read" });
        return originalGetItem.call(this, storageKey);
      };
      Storage.prototype.setItem = function trackedSetItem(storageKey: string, storageValue: string): void {
        if (storageKey === key) {
          const parsed = JSON.parse(storageValue) as { workerSnapshot?: { workers?: Array<{ id?: string }> } };
          events.push({
            kind: "write",
            workerIds: parsed.workerSnapshot?.workers?.flatMap((worker) => worker.id ? [worker.id] : []) || []
          });
        }
        originalSetItem.call(this, storageKey, storageValue);
      };
    }, { key: CURRENT_WORKPACK_STORAGE_KEY, value: JSON.stringify(stored) });

    await page.goto(`${harness.baseUrl}/workspace?theme=day`, { waitUntil: "networkidle" });
    await page.locator(".doc-card-actions button", { hasText: "편집" }).click();
    const restoredWorkerName = page.locator(".worker-card-head strong", { hasText: "복원 기준 작업자" });
    await restoredWorkerName.waitFor({ state: "attached" });
    expect(await restoredWorkerName.textContent()).toBe("복원 기준 작업자");
    await page.waitForFunction(() => (
      (window as unknown as {
        __currentWorkpackStorageEvents: Array<{ kind: "read" } | { kind: "write"; workerIds: string[] }>;
      }).__currentWorkpackStorageEvents.some((event) => event.kind === "write")
    ));
    const events = await page.evaluate(() => (
      (window as unknown as {
        __currentWorkpackStorageEvents: Array<{ kind: "read" } | { kind: "write"; workerIds: string[] }>;
      }).__currentWorkpackStorageEvents
    ));
    const firstRead = events.findIndex((event) => event.kind === "read");
    const writes = events.filter((event): event is { kind: "write"; workerIds: string[] } => event.kind === "write");

    expect(firstRead).toBeGreaterThanOrEqual(0);
    expect(events.slice(0, firstRead).some((event) => event.kind === "write")).toBe(false);
    expect(writes.length).toBeGreaterThan(0);
    expect(
      writes.every((event) => event.workerIds.length === 1 && event.workerIds[0] === restoredWorker.id),
      JSON.stringify(events)
    ).toBe(true);
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
    if (contract.name === "ontology") {
      await page.locator(".operation-memory-list-item").filter({ hasText: "개선" }).first()
        .evaluate((element) => (element as HTMLElement).click());
    }
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
      const operationBoard = scope.querySelector<HTMLElement>(".operation-memory-board");
      const relationLines = [...scope.querySelectorAll<SVGLineElement>(".operation-memory-edge")];
      const operationNodes = [...scope.querySelectorAll<HTMLElement>(".operation-memory-point")]
        .filter((node) => node.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true }));
      const visibleOperationNodeIds = new Set(operationNodes.flatMap((node) => {
        const nodeId = node.dataset.nodeId;
        return nodeId ? [nodeId] : [];
      }));
      const connectedOperationNodeIds = new Set(relationLines.flatMap((line) => (
        [line.dataset.sourceId, line.dataset.targetId].filter((nodeId): nodeId is string => Boolean(nodeId))
      )));
      const boardRect = operationBoard?.getBoundingClientRect();
      const visibleNodeArea = operationNodes.reduce((sum, node) => {
        const rect = node.getBoundingClientRect();
        return sum + rect.width * rect.height;
      }, 0);
      const clippedOperationNodeCount = boardRect
        ? operationNodes.filter((node) => {
            const rect = node.getBoundingClientRect();
            return rect.left < boardRect.left - 1
              || rect.right > boardRect.right + 1
              || rect.top < boardRect.top - 1
              || rect.bottom > boardRect.bottom + 1;
          }).length
        : operationNodes.length;
      return {
        horizontalOverflow: Math.max(0, document.documentElement.scrollWidth - window.innerWidth),
        overlapCount: overlapPairs.length,
        overlapPairs: overlapPairs.slice(0, 20),
        unnamedInteractiveCount,
        issueOverlayDetected: issuePattern.test(overlayCorpus),
        bodyText: document.body.innerText,
        relationLineCount: relationLines.length,
        inaccessibleRelationCount: relationLines.filter((line) => !line.getAttribute("aria-label")).length,
        zeroLengthRelationCount: relationLines.filter((line) => line.getTotalLength() <= 0).length,
        missingConnectedNodeCount: [...connectedOperationNodeIds]
          .filter((nodeId) => !visibleOperationNodeIds.has(nodeId)).length,
        visibleOperationNodeCount: operationNodes.length,
        clippedOperationNodeCount,
        operationNodeOccupancy: boardRect && boardRect.width > 0 && boardRect.height > 0
          ? visibleNodeArea / (boardRect.width * boardRect.height)
          : 0
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
    if (contract.name === "ontology" || contract.name === "workspace") {
      expect(metrics.relationLineCount).toBeGreaterThan(0);
      expect(metrics.inaccessibleRelationCount).toBe(0);
      expect(metrics.zeroLengthRelationCount).toBe(0);
      expect(metrics.missingConnectedNodeCount).toBe(0);
      expect(metrics.visibleOperationNodeCount).toBeGreaterThan(2);
      expect(metrics.clippedOperationNodeCount).toBe(0);
      expect(metrics.operationNodeOccupancy).toBeGreaterThan(0.04);
    }

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
      issueOverlayDetected: metrics.issueOverlayDetected,
      relationLineCount: metrics.relationLineCount,
      inaccessibleRelationCount: metrics.inaccessibleRelationCount,
      zeroLengthRelationCount: metrics.zeroLengthRelationCount,
      missingConnectedNodeCount: metrics.missingConnectedNodeCount,
      visibleOperationNodeCount: metrics.visibleOperationNodeCount,
      clippedOperationNodeCount: metrics.clippedOperationNodeCount,
      operationNodeOccupancy: metrics.operationNodeOccupancy
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
