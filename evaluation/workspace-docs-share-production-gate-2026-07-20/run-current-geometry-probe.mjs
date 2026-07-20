import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright";

const outDir = path.resolve("evaluation/workspace-docs-share-production-gate-2026-07-20");
fs.mkdirSync(outDir, { recursive: true });
const baseUrl = process.env.SAFECLAW_BASE_URL || "https://www.safeclaw.kr";
const build = await (await fetch(`${baseUrl}/api/build-info`)).json();
const browser = await chromium.launch({ headless: true });
const inputText = "서울 성수동 외벽 도장 작업, 작업자 5명, 신규 작업자 1명, 오후 강풍 예보. 이동식 비계와 자재 양중 동선 확인 필요.";
const variants = [
  { name: "desktop-day", width: 1440, height: 900, theme: "day" },
  { name: "mobile-day", width: 390, height: 844, theme: "day" }
];

async function settle(page) {
  await page.evaluate(async () => {
    await document.fonts.ready;
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  });
}

async function readMetrics(page) {
  await settle(page);
  return page.evaluate(() => {
    const rect = (selector) => {
      const element = document.querySelector(selector);
      if (!element) return null;
      const box = element.getBoundingClientRect();
      return { x: Math.round(box.x), y: Math.round(box.y), w: Math.round(box.width), h: Math.round(box.height), bottom: Math.round(box.bottom) };
    };
    const visible = (selector) => [...document.querySelectorAll(selector)].filter((element) => {
      const box = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      return box.width > 0 && box.height > 0 && style.display !== "none" && style.visibility !== "hidden";
    }).length;
    const outside = [...document.querySelectorAll("body *")].filter((element) => {
      const box = element.getBoundingClientRect();
      return box.width > 0 && box.height > 0 && (box.right > innerWidth + 1 || box.left < -1);
    }).length;
    return {
      body: {
        width: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth,
        height: document.documentElement.scrollHeight,
        clientHeight: document.documentElement.clientHeight,
        overflowX: document.documentElement.scrollWidth > document.documentElement.clientWidth
      },
      outside,
      visibleInputPages: visible(".workspace-input-page"),
      visibleDocumentPages: visible(".workspace-document-page"),
      visibleSharePages: visible(".workspace-share-page"),
      inputPage: rect(".workspace-input-page"),
      documentPage: rect(".workspace-document-page"),
      documentWorkbench: rect(".document-workbench"),
      documentPreview: rect(".document-preview-pane"),
      documentEditor: rect(".document-editor"),
      documentTextarea: rect(".document-textarea"),
      sharePage: rect(".workspace-share-page"),
      shareRoot: rect("[data-share-root]"),
      sharePreview: rect("[data-share-preview]"),
      primaryShareCtas: visible("[data-share-primary]"),
      stickyLike: [...document.querySelectorAll("body *")].filter((element) => {
        const style = getComputedStyle(element);
        const box = element.getBoundingClientRect();
        return box.width > 0 && box.height > 0 && (style.position === "sticky" || style.position === "fixed");
      }).slice(0, 20).map((element) => ({ selector: element.className || element.tagName, position: getComputedStyle(element).position, y: Math.round(element.getBoundingClientRect().y), h: Math.round(element.getBoundingClientRect().height) }))
    };
  });
}

const results = [];
for (const variant of variants) {
  const page = await browser.newPage({ viewport: { width: variant.width, height: variant.height }, deviceScaleFactor: 1 });
  try {
    await page.addInitScript(() => {
      window.localStorage.clear();
      window.localStorage.setItem("safeclaw.aiMode", "template");
    });
    await page.goto(`${baseUrl}/workspace?theme=${variant.theme}`, { waitUntil: "networkidle", timeout: 60_000 });
    await page.locator("textarea").first().fill(inputText);
    await page.getByRole("button", { name: /안전 문서 생성/u }).click();
    await page.locator(".workspace-document-page").waitFor({ state: "visible", timeout: 60_000 });
    await page.getByText(/12\/12 생성|안전 문서팩 3종 준비 완료/u).first().waitFor({ timeout: 60_000 });
    const documents = await readMetrics(page);
    await page.screenshot({ path: path.join(outDir, `${variant.name}-current-documents.png`), fullPage: true });
    await page.getByRole("button", { name: /^편집$/u }).first().click();
    await page.locator(".document-editor").waitFor({ state: "visible", timeout: 30_000 });
    const editor = await readMetrics(page);
    await page.screenshot({ path: path.join(outDir, `${variant.name}-current-editor.png`), fullPage: true });
    await page.getByLabel("작업공간 메뉴").getByRole("button").filter({ hasText: "공유" }).click();
    await page.locator(".workspace-share-page").waitFor({ state: "visible", timeout: 30_000 });
    const share = await readMetrics(page);
    await page.screenshot({ path: path.join(outDir, `${variant.name}-current-share.png`), fullPage: true });
    results.push({ name: variant.name, viewport: variant, ok: true, documents, editor, share });
  } catch (error) {
    results.push({ name: variant.name, viewport: variant, ok: false, error: error instanceof Error ? error.message : String(error) });
  } finally {
    await page.close();
  }
}
await browser.close();
fs.writeFileSync(path.join(outDir, "current-geometry.json"), `${JSON.stringify({ checkedAt: new Date().toISOString(), build, inputText, results }, null, 2)}\n`);
