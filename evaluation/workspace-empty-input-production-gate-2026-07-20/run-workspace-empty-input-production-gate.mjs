import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright";

const outDir = path.dirname(new URL(import.meta.url).pathname).replace(/^\/([A-Za-z]:)/u, "$1");
fs.mkdirSync(outDir, { recursive: true });

const build = await (await fetch("https://www.safeclaw.kr/api/build-info")).json();
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });

await page.addInitScript(() => {
  window.localStorage.clear();
});
await page.goto("https://www.safeclaw.kr/workspace?theme=day", { waitUntil: "networkidle", timeout: 60_000 });
await page.evaluate(async () => {
  await document.fonts.ready;
  await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
});
await page.getByRole("button", { name: "안전 문서 생성" }).click();
await page.locator("#field-command-error[role='alert']").waitFor({ state: "visible", timeout: 10_000 });
await page.evaluate(async () => {
  await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
});

const metrics = await page.evaluate(() => {
  const input = document.querySelector("#field-command-input");
  const error = document.querySelector("#field-command-error");
  const inputBox = input?.getBoundingClientRect();
  const errorBox = error?.getBoundingClientRect();
  return {
    body: {
      width: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
      height: document.documentElement.scrollHeight,
      clientHeight: document.documentElement.clientHeight,
      overflowX: document.documentElement.scrollWidth > document.documentElement.clientWidth
    },
    inputValue: input instanceof HTMLTextAreaElement ? input.value : null,
    activeElementId: document.activeElement?.id || null,
    inputAriaInvalid: input?.getAttribute("aria-invalid") || null,
    inputAriaDescribedBy: input?.getAttribute("aria-describedby") || null,
    fieldErrorText: error?.textContent?.trim() || null,
    fieldErrorVisible: Boolean(errorBox && errorBox.width > 0 && errorBox.height > 0),
    roleAlertCount: document.querySelectorAll("[role='alert']").length,
    documentPageCount: document.querySelectorAll(".workspace-document-page").length,
    inputRect: inputBox ? {
      x: Math.round(inputBox.x),
      y: Math.round(inputBox.y),
      w: Math.round(inputBox.width),
      h: Math.round(inputBox.height)
    } : null,
    errorRect: errorBox ? {
      x: Math.round(errorBox.x),
      y: Math.round(errorBox.y),
      w: Math.round(errorBox.width),
      h: Math.round(errorBox.height)
    } : null
  };
});

const screenshot = path.join(outDir, "workspace-empty-input-mobile-day.png");
await page.screenshot({ path: screenshot, fullPage: true });
await browser.close();

fs.writeFileSync(
  path.join(outDir, "metrics.json"),
  `${JSON.stringify({ checkedAt: new Date().toISOString(), build, screenshot, metrics }, null, 2)}\n`
);
