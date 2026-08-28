import fs from "node:fs";
import path from "node:path";

import { chromium } from "playwright";

const args = new Map();
for (let index = 2; index < process.argv.length; index += 2) {
  const key = process.argv[index];
  const value = process.argv[index + 1];
  if (!key?.startsWith("--") || !value) {
    throw new Error(`Invalid argument pair at ${key ?? "end of arguments"}`);
  }
  args.set(key.slice(2), value);
}

const baseUrl = args.get("base-url") ?? "https://www.safeclaw.kr";
const storageStatePath = args.get("storage-state");
const outputDirectory = path.resolve(
  args.get("output-dir") ?? "evaluation/live-documents-share-route-perception-2026-08-28"
);
const cacheBust = args.get("cache-bust") ?? Date.now().toString(36);
const viewports = [
  { name: "desktop", width: 1440, height: 723 },
  { name: "mobile", width: 390, height: 723 },
];

if (!storageStatePath || !fs.existsSync(storageStatePath)) {
  throw new Error("A readable --storage-state file is required for no-mutation workspace Share measurement");
}

fs.mkdirSync(outputDirectory, { recursive: true });

const browser = await chromium.launch({ headless: true });
const result = {
  generatedAt: new Date().toISOString(),
  baseUrl,
  cacheBust,
  documents: [],
  workspaceShare: [],
};

try {
  for (const viewport of viewports) {
    const context = await browser.newContext({ viewport });
    const page = await context.newPage();
    await page.goto(`${baseUrl}/documents?theme=day&codexCacheBust=${cacheBust}`, {
      waitUntil: "networkidle",
      timeout: 30_000,
    });
    await page.locator(".safeclaw-module-rail").waitFor({ timeout: 15_000 });
    const metrics = await page.evaluate(({ viewport: expectedViewport }) => {
      const rect = (element) => {
        const bounds = element.getBoundingClientRect();
        return {
          left: Number(bounds.left.toFixed(2)),
          top: Number(bounds.top.toFixed(2)),
          right: Number(bounds.right.toFixed(2)),
          bottom: Number(bounds.bottom.toFixed(2)),
          width: Number(bounds.width.toFixed(2)),
          height: Number(bounds.height.toFixed(2)),
        };
      };
      const rail = document.querySelector(".safeclaw-module-rail");
      const workbench = document.querySelector(".workpack-shell");
      if (!(rail instanceof HTMLElement) || !(workbench instanceof HTMLElement)) {
        throw new Error("Documents geometry targets are unavailable");
      }
      const railStyle = getComputedStyle(rail);
      return {
        viewport: expectedViewport,
        documentHeight: document.documentElement.scrollHeight,
        bodyHeight: document.body.scrollHeight,
        bodyViewportRatio: Number((document.documentElement.scrollHeight / innerHeight).toFixed(2)),
        moduleRail: {
          clientHeight: rail.clientHeight,
          scrollHeight: rail.scrollHeight,
          overflowDelta: rail.scrollHeight - rail.clientHeight,
          overflowY: railStyle.overflowY,
          paddingTop: railStyle.paddingTop,
          paddingBottom: railStyle.paddingBottom,
        },
        workbench: {
          ...rect(workbench),
          clientHeight: workbench.clientHeight,
          scrollHeight: workbench.scrollHeight,
          overflowY: getComputedStyle(workbench).overflowY,
        },
        visibleDocumentKeys: Array.from(document.querySelectorAll("[data-document-key]"))
          .filter((node) => node instanceof HTMLElement && node.checkVisibility())
          .map((node) => node.getAttribute("data-document-key")),
        uniqueDocumentKeyCount: new Set(
          Array.from(document.querySelectorAll("[data-document-key]"))
            .map((node) => node.getAttribute("data-document-key"))
            .filter(Boolean)
        ).size,
        supportingDocumentsOpenDefault: Array.from(document.querySelectorAll("details"))
          .some((item) => item.textContent?.includes("지원 문서 9종") && item.open),
        horizontalOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
      };
    }, { viewport });
    const screenshot = `documents-${viewport.name}-after-live-${viewport.width}x${viewport.height}.png`;
    await page.screenshot({ path: path.join(outputDirectory, screenshot) });
    result.documents.push({ ...metrics, screenshot });
    await context.close();
  }

  for (const viewport of viewports) {
    const context = await browser.newContext({ viewport, storageState: storageStatePath });
    const page = await context.newPage();
    await page.goto(`${baseUrl}/workspace?theme=day&codexCacheBust=${cacheBust}`, {
      waitUntil: "networkidle",
      timeout: 30_000,
    });
    await page.locator(".workspace-document-page").waitFor({ timeout: 15_000 });
    await page.getByLabel("작업공간 메뉴").getByRole("button").filter({ hasText: "공유" }).click();
    await page.locator("[data-share-root]").waitFor({ timeout: 15_000 });
    const metrics = await page.evaluate(({ viewport: expectedViewport }) => {
      const rect = (element) => {
        const bounds = element.getBoundingClientRect();
        return {
          left: Number(bounds.left.toFixed(2)),
          top: Number(bounds.top.toFixed(2)),
          right: Number(bounds.right.toFixed(2)),
          bottom: Number(bounds.bottom.toFixed(2)),
          width: Number(bounds.width.toFixed(2)),
          height: Number(bounds.height.toFixed(2)),
        };
      };
      const root = document.querySelector("[data-share-root]");
      const preview = document.querySelector("[data-share-preview]");
      const desktopRail = document.querySelector("[data-share-desktop-status-rail]");
      if (!(root instanceof HTMLElement) || !(preview instanceof HTMLElement)) {
        throw new Error("Workspace Share geometry targets are unavailable");
      }
      const primary = Array.from(document.querySelectorAll("[data-share-primary]"))
        .find((element) => element instanceof HTMLElement && getComputedStyle(element).display !== "none");
      return {
        viewport: expectedViewport,
        documentHeight: document.documentElement.scrollHeight,
        bodyHeight: document.body.scrollHeight,
        root: {
          ...rect(root),
          clientHeight: root.clientHeight,
          scrollHeight: root.scrollHeight,
          overflowY: getComputedStyle(root).overflowY,
        },
        gridTemplateColumns: getComputedStyle(root).gridTemplateColumns
          .split(" ")
          .map((value) => Number.parseFloat(value))
          .filter(Number.isFinite),
        messagePreview: rect(preview),
        desktopStatusRail: desktopRail instanceof HTMLElement
          ? { ...rect(desktopRail), display: getComputedStyle(desktopRail).display }
          : null,
        primaryActionBottom: primary instanceof HTMLElement
          ? Number(primary.getBoundingClientRect().bottom.toFixed(2))
          : null,
        channelCardWidths: Array.from(document.querySelectorAll(".channel-grid .channel-card"))
          .map((element) => Number(element.getBoundingClientRect().width.toFixed(2))),
        horizontalOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
      };
    }, { viewport });
    const screenshot = `workspace-share-${viewport.name}-after-live-${viewport.width}x${viewport.height}.png`;
    await page.screenshot({ path: path.join(outputDirectory, screenshot) });
    result.workspaceShare.push({ ...metrics, screenshot });
    await context.close();
  }

  fs.writeFileSync(
    path.join(outputDirectory, "runtime-measurement.json"),
    `${JSON.stringify(result, null, 2)}\n`,
    "utf8"
  );
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
} finally {
  await browser.close();
}
