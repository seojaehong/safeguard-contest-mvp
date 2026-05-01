import { chromium } from "playwright";
import fs from "node:fs/promises";
import path from "node:path";

const baseUrl = process.env.BASE_URL || "http://127.0.0.1:3011";
const outputPath = process.env.OUTPUT_PATH || "evaluation/local-smoke/local-ui-regression-smoke.json";

const scenario = [
  "세이프건설 서울 성수동 근린생활시설 외벽 도장 작업.",
  "이동식 비계 사용, 작업자 5명, 신규 투입자 1명, 오후 강풍 예보.",
  "추락과 지게차 동선 위험을 반영해 오늘 위험성평가와 TBM, 안전보건교육 기록을 만들어줘."
].join(" ");

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 1440, height: 1100 },
  permissions: ["clipboard-read", "clipboard-write"]
});

await context.addInitScript(() => {
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: {
      async writeText(text) {
        window.__safeguardCopiedTsv = text;
      }
    }
  });
  window.__safeguardOpenedUrl = "";
  window.open = (url) => {
    window.__safeguardOpenedUrl = String(url || "");
    return { closed: false };
  };
  window.confirm = () => true;
});

const page = await context.newPage();
const result = {
  generatedAt: new Date().toISOString(),
  baseUrl,
  homeLoaded: false,
  generated: false,
  knowledgeLinkVisible: false,
  sheetsOpenedUrl: "",
  sheetsTsvHasRows: false,
  workspaceColumns: "",
  workspaceRailColumns: "",
  evidenceLinksValid: false,
  errors: []
};

try {
  await page.goto(baseUrl, { waitUntil: "domcontentloaded", timeout: 60_000 });
  result.homeLoaded = await page.getByText("문서팩 생성").first().isVisible({ timeout: 20_000 }).catch(() => false);

  const textarea = page.locator("textarea").first();
  await textarea.fill(scenario);
  await page.getByRole("button", { name: /선택한 현장으로 생성|문서팩 생성/ }).first().click();
  await page.getByText("LLM 위키·지식 DB 확인").waitFor({ timeout: 140_000 });
  result.generated = true;
  result.knowledgeLinkVisible = await page.getByText("LLM 위키·지식 DB 확인").isVisible();

  await page.getByRole("button", { name: /새 Google Sheets 열기/ }).click();
  result.sheetsOpenedUrl = await page.evaluate(() => String(window.__safeguardOpenedUrl || ""));
  const copiedTsv = await page.evaluate(() => String(window.__safeguardCopiedTsv || ""));
  result.sheetsTsvHasRows = copiedTsv.includes("문서") && copiedTsv.includes("섹션") && copiedTsv.split("\n").length > 5;

  const layout = await page.evaluate(() => {
    const workspace = document.querySelector(".field-workspace");
    const rail = document.querySelector(".workspace-rail");
    const evidenceLinks = Array.from(document.querySelectorAll(".impact-list a")).map((node) => node.getAttribute("href") || "");
    return {
      workspaceColumns: workspace ? getComputedStyle(workspace).gridTemplateColumns : "",
      workspaceRailColumns: rail ? getComputedStyle(rail).gridTemplateColumns : "",
      evidenceLinks
    };
  });
  result.workspaceColumns = layout.workspaceColumns;
  result.workspaceRailColumns = layout.workspaceRailColumns;
  result.evidenceLinksValid = layout.evidenceLinks.length > 0 && layout.evidenceLinks.every((href) => /^https?:\/\//.test(href));
} catch (error) {
  result.errors.push(error instanceof Error ? error.message : String(error));
} finally {
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, `${JSON.stringify(result, null, 2)}\n`, "utf8");
  await browser.close();
}

if (result.errors.length || !result.generated || !result.sheetsTsvHasRows || !result.evidenceLinksValid) {
  process.exitCode = 1;
}
