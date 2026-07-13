import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Browser, Page } from "playwright";
import {
  startIsolatedNextBrowserHarness,
  type IsolatedNextBrowserHarness
} from "./helpers/isolated-next-browser-harness";

type Theme = "day" | "night";
type RouteContract = {
  name: "reports" | "ontology" | "knowledge";
  pathname: "/reports" | "/ontology" | "/knowledge";
  readySelector: string;
  overlapSelector: string;
  forbiddenPattern: RegExp;
};

const root = process.cwd();
const sourceSha = execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).trim();
const issueOverlayPattern = /(?<![\p{L}\p{N}_])(?:(?:\d+|N)\s+Issues?|Issues?\s*(?:\(\s*(?:\d+|N)\s*\)|:\s*(?:\d+|N)|\s+(?:\d+|N)))(?![\p{L}\p{N}_])/iu;
const routes: RouteContract[] = [
  {
    name: "reports",
    pathname: "/reports",
    readySelector: ".safeclaw-workdoc-shell",
    overlapSelector: ".safeclaw-workdoc > section",
    forbiddenPattern: /\b(?:As-Is|To-Be|Before\/After)\b/u
  },
  {
    name: "ontology",
    pathname: "/ontology",
    readySelector: ".ontology-graph-shell",
    overlapSelector: ".ontology-summary-grid > article",
    forbiddenPattern: /\b(?:Task|Hazard|Control|Article|Document|Accident|Nodes|Edges|Gate|Fallback)\b|Graph unavailable/u
  },
  {
    name: "knowledge",
    pathname: "/knowledge",
    readySelector: "[data-knowledge-surface]",
    overlapSelector: "[data-knowledge-surface] > section",
    forbiddenPattern: /Built-in Wiki|Runtime Knowledge|Knowledge Catalog|KOSHA Technical Support|KOSHA Reference Library|\b(?:Index|Hazards|Forms|Schema)\b/u
  }
];
const viewports = [
  { label: "desktop" as const, width: 1440, height: 900 },
  { label: "mobile" as const, width: 390, height: 844 }
];

let harness: IsolatedNextBrowserHarness | null = null;
let browser: Browser | null = null;
let outputDirectory = "";
let temporaryOutputDirectory = false;

function buildId(): string | null {
  const buildIdPath = path.join(root, ".next", "BUILD_ID");
  return fs.existsSync(buildIdPath) ? fs.readFileSync(buildIdPath, "utf8").trim() : null;
}

async function prepareRoute(page: Page, contract: RouteContract, theme: Theme): Promise<void> {
  await page.goto(`${harness?.baseUrl}${contract.pathname}?theme=${theme}`, { waitUntil: "networkidle" });
  await page.locator(".safeclaw-module-shell[data-ready='true']").waitFor({ state: "attached" });
  if (contract.name === "reports") {
    await page.getByRole("button", { name: "샘플 미리보기" }).click();
  }
  await page.locator(contract.readySelector).waitFor({ state: "visible" });
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

  it.each(routes.flatMap((contract) => (
    (["day", "night"] as const).flatMap((theme) => (
      viewports.map((viewport) => ({ contract, theme, ...viewport }))
    ))
  )))("keeps $contract.name Korean and contained in $theme $label", async ({ contract, theme, width, height, label }) => {
    if (!browser || !harness) throw new Error("Browser harness was not started");
    const page = await browser.newPage({ viewport: { width, height } });
    await prepareRoute(page, contract, theme);
    const metrics = await page.evaluate(({ overlapSelector, issueSource, issueFlags }) => {
      const overlapTargets = [...document.querySelectorAll<HTMLElement>(overlapSelector)]
        .filter((element) => {
          const rect = element.getBoundingClientRect();
          return rect.width > 0 && rect.height > 0;
        });
      const overlapPairs: string[] = [];
      for (let left = 0; left < overlapTargets.length; left += 1) {
        const leftRect = overlapTargets[left].getBoundingClientRect();
        for (let right = left + 1; right < overlapTargets.length; right += 1) {
          const rightRect = overlapTargets[right].getBoundingClientRect();
          const overlapWidth = Math.min(leftRect.right, rightRect.right) - Math.max(leftRect.left, rightRect.left);
          const overlapHeight = Math.min(leftRect.bottom, rightRect.bottom) - Math.max(leftRect.top, rightRect.top);
          if (overlapWidth > 1 && overlapHeight > 1) overlapPairs.push(`${left}:${right}`);
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
        unnamedInteractiveCount,
        issueOverlayDetected: issuePattern.test(overlayCorpus),
        bodyText: document.body.innerText
      };
    }, {
      overlapSelector: contract.overlapSelector,
      issueSource: issueOverlayPattern.source,
      issueFlags: issueOverlayPattern.flags
    });

    expect(metrics.horizontalOverflow).toBe(0);
    expect(metrics.overlapCount).toBe(0);
    expect(metrics.unnamedInteractiveCount).toBe(0);
    expect(metrics.issueOverlayDetected).toBe(false);
    expect(metrics.bodyText).not.toMatch(contract.forbiddenPattern);

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
