import { spawn, spawnSync, type ChildProcessWithoutNullStreams } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { chromium, type Browser } from "playwright";

const pagePath = path.join(process.cwd(), "app", "knowledge", "page.tsx");
const cssPath = path.join(process.cwd(), "app", "knowledge", "KnowledgePage.module.css");
const pageSource = fs.readFileSync(pagePath, "utf8");
const port = 34_000 + (process.pid % 10_000);
const baseUrl = `http://127.0.0.1:${port}`;
const distDir = path.join(".next-knowledge-layout", String(process.pid));
const serverOutput: string[] = [];
let server: ChildProcessWithoutNullStreams | null = null;
let browser: Browser | null = null;

function sourceBetween(startMarker: string, endMarker: string): string {
  const start = pageSource.indexOf(startMarker);
  const end = pageSource.indexOf(endMarker, start + startMarker.length);
  if (start < 0 || end < 0) {
    throw new Error(`Missing source boundary: ${startMarker} -> ${endMarker}`);
  }
  return pageSource.slice(start, end);
}

function resolveNextModule(): string {
  const candidates = [
    path.join(process.cwd(), "node_modules", "next"),
    path.resolve(process.cwd(), "..", "..", "node_modules", "next")
  ];
  const nextModule = candidates.find((candidate) => fs.existsSync(path.join(candidate, "package.json")));
  if (!nextModule) throw new Error(`Unable to locate Next.js. Checked: ${candidates.join(", ")}`);
  return nextModule;
}

async function waitForHttp(url: string, timeoutMs = 60_000): Promise<void> {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {
      // The isolated Next server is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`Timed out waiting for ${url}\n${serverOutput.slice(-30).join("")}`);
}

async function stopServer(): Promise<void> {
  const processId = server?.pid;
  if (!processId) return;
  if (process.platform === "win32") {
    spawnSync("taskkill.exe", ["/PID", String(processId), "/T", "/F"], {
      encoding: "utf8",
      windowsHide: true
    });
    return;
  }
  server?.kill("SIGTERM");
}

describe("knowledge page decision layout", () => {
  beforeAll(async () => {
    const serverScript = `
      const http = require("node:http");
      const imported = require(${JSON.stringify(resolveNextModule())});
      const createNextServer = imported.default || imported;
      const app = createNextServer({
        dev: true,
        dir: process.cwd(),
        hostname: "127.0.0.1",
        port: ${port},
        conf: { distDir: ${JSON.stringify(distDir)} }
      });
      let httpServer;
      async function shutdown() {
        if (httpServer) await new Promise((resolve) => httpServer.close(resolve));
        await app.close();
        process.exit(0);
      }
      process.on("SIGTERM", () => void shutdown());
      process.on("SIGINT", () => void shutdown());
      app.prepare()
        .then(() => {
          const handler = app.getRequestHandler();
          httpServer = http.createServer((request, response) => {
            handler(request, response).catch((error) => {
              console.error(error);
              response.statusCode = 500;
              response.end("Internal test server error");
            });
          });
          httpServer.listen(${port}, "127.0.0.1");
        })
        .catch((error) => {
          console.error(error);
          process.exit(1);
        });
    `;
    server = spawn(process.execPath, ["-e", serverScript], {
      cwd: process.cwd(),
      env: { ...process.env, NEXT_TELEMETRY_DISABLED: "1" },
      windowsHide: true
    });
    server.stdout.on("data", (chunk: Buffer) => serverOutput.push(chunk.toString()));
    server.stderr.on("data", (chunk: Buffer) => serverOutput.push(chunk.toString()));
    await waitForHttp(`${baseUrl}/knowledge?theme=day`);
    browser = await chromium.launch({ headless: true });
  }, 90_000);

  afterAll(async () => {
    await browser?.close();
    await stopServer();
    const absoluteDistDir = path.resolve(process.cwd(), distDir);
    const workspaceRoot = `${path.resolve(process.cwd())}${path.sep}`;
    if (!absoluteDistDir.startsWith(workspaceRoot)) {
      throw new Error(`Refusing to remove unexpected test dist directory: ${absoluteDistDir}`);
    }
    fs.rmSync(absoluteDistDir, { recursive: true, force: true });
  }, 30_000);

  it("uses semantic KOSHA row lists with optional detail disclosures", () => {
    const technicalList = sourceBetween(
      'data-knowledge-list="technical-support"',
      'data-knowledge-list-end="technical-support"'
    );
    const referenceList = sourceBetween(
      'data-knowledge-list="reference-library"',
      'data-knowledge-list-end="reference-library"'
    );
    const referenceData = sourceBetween(
      "const koshaReferenceEntries",
      "export const dynamic"
    );

    expect(technicalList).toContain("<ul");
    expect(technicalList).toContain("<li");
    expect(technicalList).toContain("stats.samples.map");
    expect(technicalList).toContain("item.source_kind_label");
    expect(technicalList).toContain("item.document_reflection_label");
    expect(technicalList).toContain("item.source_url ?");
    expect(technicalList).toContain("<details");

    expect(referenceList).toContain("<ul");
    expect(referenceList).toContain("<li");
    expect(referenceList).toContain("koshaReferenceEntries.map");
    expect(referenceList).toContain("<details");
    expect(referenceData.match(/href:\s*"\/kosha-references\//g)).toHaveLength(7);
    expect(referenceData).toContain("risk-assessment-implementation-manual-2022.pdf");
    expect(referenceData).toContain("tbm-pre-work-safety-meeting-guide-2023.pdf");
  });

  it("bounds visible summaries while preserving counts and provenance", () => {
    const referenceData = sourceBetween(
      "const koshaReferenceEntries",
      "export const dynamic"
    );
    const summaries = [...referenceData.matchAll(/summary:\s*"([^"]+)"/g)]
      .map((match) => match[1]);

    expect(pageSource).toContain("const KNOWLEDGE_SUMMARY_MAX_LENGTH = 150;");
    expect(pageSource).toContain("normalizeKnowledgeSnippet(item.short_summary || item.summary, KNOWLEDGE_SUMMARY_MAX_LENGTH)");
    expect(summaries).toHaveLength(7);
    expect(Math.max(...summaries.map((summary) => Array.from(summary).length))).toBeLessThanOrEqual(150);
    expect(pageSource).toContain("stats.technicalTotal");
    expect(pageSource).toContain("stats.technicalSupportRegulations");
    expect(pageSource).toContain("stats.technicalGuidelines");
    expect(pageSource).toContain("stats.ingestionRuns");
    expect(pageSource).toContain("stats.message");
    expect(pageSource).toContain("data-knowledge-provenance");
  });

  it("keeps the scoped styles quiet, bounded, and single-column on mobile", () => {
    expect(fs.existsSync(cssPath)).toBe(true);

    const css = fs.readFileSync(cssPath, "utf8");
    const radiusValues = [...css.matchAll(/border-radius:\s*([^;]+);/g)]
      .map((match) => match[1].trim());

    expect(radiusValues.length).toBeGreaterThan(0);
    expect(radiusValues.every((value) => ["0", "2px", "4px", "8px", "var(--radius-control)", "var(--radius-soft)"].includes(value))).toBe(true);
    expect(css).toContain("@media (max-width: 720px)");
    expect(css).toContain("grid-template-columns: minmax(0, 1fr)");
    expect(css).toContain("overflow-wrap: anywhere");
    expect(css).not.toMatch(/gradient\s*\(/i);
  });

  it("keeps KOSHA rows contained across desktop and mobile", async () => {
    if (!browser) throw new Error("Browser was not started");

    for (const viewport of [
      { name: "desktop", width: 1440, height: 900, columns: 3 },
      { name: "mobile", width: 390, height: 844, columns: 1 }
    ] as const) {
      const page = await browser.newPage({ viewport });
      await page.goto(`${baseUrl}/knowledge?theme=day`, { waitUntil: "domcontentloaded" });
      await page.locator('[data-knowledge-list="reference-library"]').waitFor();
      await page.locator('[data-knowledge-list="reference-library"] details').first().click();

      const metrics = await page.evaluate(() => {
        const list = document.querySelector('[data-knowledge-list="reference-library"]');
        const rows = [...document.querySelectorAll<HTMLElement>("[data-knowledge-row]")];
        const summaries = [...document.querySelectorAll<HTMLElement>("[data-knowledge-summary]")];
        if (!list || rows.length === 0 || summaries.length === 0) {
          throw new Error("Missing knowledge layout targets");
        }
        const firstRowStyle = getComputedStyle(rows[0]);
        const radii = [...document.querySelectorAll<HTMLElement>("[data-knowledge-surface] *")]
          .map((element) => Number.parseFloat(getComputedStyle(element).borderTopLeftRadius) || 0);

        return {
          viewportWidth: window.innerWidth,
          scrollWidth: document.documentElement.scrollWidth,
          columns: firstRowStyle.gridTemplateColumns.split(" ").filter(Boolean).length,
          maxRadius: Math.max(...radii, 0),
          rowsContained: rows.every((row) => row.scrollWidth <= row.clientWidth + 1),
          summariesContained: summaries.every((summary) => summary.scrollWidth <= summary.clientWidth + 1),
          listContained: (list as HTMLElement).scrollWidth <= (list as HTMLElement).clientWidth + 1
        };
      });

      expect(metrics.scrollWidth, viewport.name).toBeLessThanOrEqual(metrics.viewportWidth + 1);
      expect(metrics.columns, viewport.name).toBe(viewport.columns);
      expect(metrics.maxRadius, viewport.name).toBeLessThanOrEqual(8);
      expect(metrics.rowsContained, viewport.name).toBe(true);
      expect(metrics.summariesContained, viewport.name).toBe(true);
      expect(metrics.listContained, viewport.name).toBe(true);
      await page.close();
    }
  }, 90_000);

  it("renders governed promotion and authority lanes without mutation controls", async () => {
    if (!browser) throw new Error("Browser was not started");

    for (const viewport of [
      { name: "desktop", width: 1440, height: 900 },
      { name: "mobile", width: 390, height: 844 }
    ] as const) {
      const page = await browser.newPage({ viewport });
      await page.goto(`${baseUrl}/knowledge?theme=day`, { waitUntil: "domcontentloaded" });
      const flow = page.locator('[data-knowledge-governance-flow="true"]');
      await flow.waitFor();

      const metrics = await flow.evaluate((section) => {
        const stages = [...section.querySelectorAll<HTMLElement>("[data-knowledge-stage]")];
        const authorityRows = [...section.querySelectorAll<HTMLElement>("[data-knowledge-authority]")];

        return {
          stageIds: stages.map((stage) => stage.dataset.knowledgeStage),
          authorityIds: authorityRows.map((row) => row.dataset.knowledgeAuthority),
          sectionContained: section.scrollWidth <= section.clientWidth + 1,
          stagesContained: stages.every((stage) => stage.scrollWidth <= stage.clientWidth + 1),
          authorityRowsContained: authorityRows.every((row) => row.scrollWidth <= row.clientWidth + 1),
          visibleText: section.textContent || "",
          mutationControls: section.querySelectorAll("button, [data-publish-action]").length
        };
      });

      expect(metrics.stageIds, viewport.name).toEqual([
        "knowledge_event",
        "candidate",
        "human_review",
        "published_ontology"
      ]);
      expect(metrics.authorityIds, viewport.name).toEqual([
        "sif",
        "kosha",
        "law",
        "organization_history",
        "site_history",
        "hermes_llm"
      ]);
      expect(metrics.sectionContained, viewport.name).toBe(true);
      expect(metrics.stagesContained, viewport.name).toBe(true);
      expect(metrics.authorityRowsContained, viewport.name).toBe(true);
      for (const internalLabel of [
        "Hermes / LLM",
        "human_review",
        "Published ontology",
        "published_ontology",
        "SafeClaw system of record"
      ]) {
        expect(metrics.visibleText, `${viewport.name} exposes ${internalLabel}`).not.toContain(internalLabel);
      }
      expect(metrics.mutationControls, viewport.name).toBe(0);
      await page.close();
    }
  }, 90_000);

  it("keeps mobile evidence disclosures interactive, separated, and at least 44px tall", async () => {
    if (!browser) throw new Error("Browser was not started");

    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    await page.goto(`${baseUrl}/knowledge?theme=night`, { waitUntil: "domcontentloaded" });
    await page.locator('[data-knowledge-list="technical-support"]').waitFor();

    const details = page.locator("[data-knowledge-row] details");
    for (let index = 0; index < await details.count(); index += 1) {
      const detail = details.nth(index);
      const summary = detail.locator("summary");
      expect(await detail.evaluate((element) => {
        if (!(element instanceof HTMLDetailsElement)) {
          throw new Error("Expected a knowledge evidence details element");
        }
        return element.open;
      })).toBe(false);
      await summary.click();
      expect(await detail.evaluate((element) => {
        if (!(element instanceof HTMLDetailsElement)) {
          throw new Error("Expected a knowledge evidence details element");
        }
        return element.open;
      })).toBe(true);
    }

    const metrics = await page.evaluate(() => {
      const interactiveElements = [
        ...document.querySelectorAll<HTMLElement>("[data-knowledge-row] details > summary"),
        ...document.querySelectorAll<HTMLElement>("[data-knowledge-row] details a")
      ];
      const targets = interactiveElements
        .filter((element) => {
          const style = getComputedStyle(element);
          return style.display !== "none" && style.visibility !== "hidden";
        })
        .map((element) => {
          const rectangle = element.getBoundingClientRect();
          return {
          label: element.textContent?.trim() || element.tagName,
            href: element instanceof HTMLAnchorElement ? element.getAttribute("href") : null,
            detailIndex: [...document.querySelectorAll("[data-knowledge-row] details")]
              .indexOf(element.closest("details") as HTMLDetailsElement),
            left: rectangle.left,
            right: rectangle.right,
            top: rectangle.top,
            bottom: rectangle.bottom,
            width: rectangle.width,
            height: rectangle.height
          };
        });

      const overlapPairs: string[] = [];
      for (let firstIndex = 0; firstIndex < targets.length; firstIndex += 1) {
        for (let secondIndex = firstIndex + 1; secondIndex < targets.length; secondIndex += 1) {
          const first = targets[firstIndex];
          const second = targets[secondIndex];
          if (first.detailIndex !== second.detailIndex) continue;
          const horizontalOverlap = Math.min(first.right, second.right) - Math.max(first.left, second.left);
          const verticalOverlap = Math.min(first.bottom, second.bottom) - Math.max(first.top, second.top);
          if (horizontalOverlap > 0.5 && verticalOverlap > 0.5) {
            overlapPairs.push(`${first.label} / ${second.label}`);
          }
        }
      }

      return { targets, overlapPairs };
    });

    expect(metrics.targets.length).toBeGreaterThan(0);
    expect(metrics.overlapPairs).toEqual([]);
    for (const target of metrics.targets) {
      expect(target.height, target.label).toBeGreaterThanOrEqual(44);
      expect(target.width, target.label).toBeGreaterThanOrEqual(44);
      if (target.label === "이 근거로 조회") {
        expect(target.href, target.label).toMatch(/^\/knowledge\?reference=[^&]+$/u);
        const targetUrl = new URL(target.href || "", baseUrl);
        expect(targetUrl.origin).toBe(baseUrl);
        expect(targetUrl.pathname).toBe("/knowledge");
        expect(targetUrl.searchParams.get("reference")?.trim().length).toBeGreaterThan(0);
      }
    }
    await page.close();
  }, 90_000);
});
