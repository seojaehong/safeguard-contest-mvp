import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright";

const outDir = path.dirname(new URL(import.meta.url).pathname).replace(/^\/([A-Za-z]:)/u, "$1");
fs.mkdirSync(outDir, { recursive: true });

const build = await (await fetch("https://www.safeclaw.kr/api/build-info")).json();
const browser = await chromium.launch({ headless: true });

const variants = [
  { name: "desktop-day", width: 1440, height: 900, theme: "day" },
  { name: "mobile-day", width: 390, height: 844, theme: "day" }
];

const inputText = "서울 성수동 외벽 도장 작업, 작업자 5명, 신규 작업자 1명, 오후 강풍 예보. 이동식 비계와 자재 양중 동선 확인 필요.";
const results = [];

async function settle(page) {
  await page.evaluate(async () => {
    await document.fonts.ready;
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  });
}

async function measure(page, variant, stage) {
  await settle(page);
  const metrics = await page.evaluate(() => {
    const rect = (selector) => {
      const element = document.querySelector(selector);
      if (!element) return null;
      const box = element.getBoundingClientRect();
      return {
        x: Math.round(box.x),
        y: Math.round(box.y),
        w: Math.round(box.width),
        h: Math.round(box.height),
        bottom: Math.round(box.bottom)
      };
    };
    const visible = (selector) => [...document.querySelectorAll(selector)]
      .filter((element) => {
        const box = element.getBoundingClientRect();
        const style = getComputedStyle(element);
        return box.width > 0 && box.height > 0 && style.display !== "none" && style.visibility !== "hidden";
      }).length;
    const outside = [...document.querySelectorAll("body *")]
      .filter((element) => {
        const box = element.getBoundingClientRect();
        return box.width > 0 && box.height > 0 && (box.right > innerWidth + 1 || box.left < -1);
      }).length;
    return {
      url: location.href,
      title: document.title,
      body: {
        width: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth,
        height: document.documentElement.scrollHeight,
        clientHeight: document.documentElement.clientHeight,
        overflowX: document.documentElement.scrollWidth > document.documentElement.clientWidth
      },
      outside,
      inputPage: rect(".workspace-input-page"),
      documentPage: rect(".workspace-document-page"),
      sharePage: rect(".workspace-share-page"),
      documentWorkbench: rect(".document-workbench"),
      documentPreview: rect(".document-preview-pane"),
      shareRoot: rect("[data-share-root]"),
      shareWorkbench: rect(".share-workbench"),
      sharePreview: rect("[data-share-preview]"),
      visibleDocumentPages: visible(".workspace-document-page"),
      visibleSharePages: visible(".workspace-share-page"),
      primaryShareCtas: visible("[data-share-primary]"),
      textSample: document.body.innerText.slice(0, 1600)
    };
  });
  const screenshot = path.join(outDir, `${variant.name}-${stage}.png`);
  await page.screenshot({ path: screenshot, fullPage: true });
  return { stage, screenshot, metrics };
}

for (const variant of variants) {
  const page = await browser.newPage({
    viewport: { width: variant.width, height: variant.height },
    deviceScaleFactor: 1
  });
  try {
    await page.addInitScript(() => {
      window.localStorage.clear();
      window.localStorage.setItem("safeclaw.aiMode", "template");
    });
    await page.goto(`https://www.safeclaw.kr/workspace?theme=${variant.theme}`, {
      waitUntil: "networkidle",
      timeout: 60_000
    });
    const textarea = page.locator("textarea").first();
    await textarea.fill(inputText);
    await page.getByRole("button", { name: /안전 문서 생성/u }).click();
    await page.locator(".workspace-document-page").waitFor({ state: "visible", timeout: 60_000 });
    await page.getByText(/12\/12 생성|안전 문서팩 3종 준비 완료/u).first().waitFor({ timeout: 60_000 });
    const documentStage = await measure(page, variant, "documents");

    const shareButton = page.getByLabel("작업공간 메뉴").getByRole("button").filter({ hasText: "공유" });
    await shareButton.click();
    await page.locator(".workspace-share-page").waitFor({ state: "visible", timeout: 30_000 });
    const shareStage = await measure(page, variant, "share");

    results.push({ name: variant.name, viewport: variant, ok: true, stages: [documentStage, shareStage] });
  } catch (error) {
    results.push({
      name: variant.name,
      viewport: variant,
      ok: false,
      error: error instanceof Error ? error.message : String(error)
    });
  } finally {
    await page.close();
  }
}

await browser.close();
fs.writeFileSync(
  path.join(outDir, "metrics.json"),
  `${JSON.stringify({ checkedAt: new Date().toISOString(), build, inputText, results }, null, 2)}\n`
);
