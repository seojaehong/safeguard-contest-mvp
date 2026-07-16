import { mkdirSync } from "node:fs";
import { join } from "node:path";

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Browser } from "playwright";

import {
  buildStoredCurrentWorkpack,
  CURRENT_WORKPACK_STORAGE_KEY,
  type CurrentWorkerSnapshot
} from "@/lib/current-workpack";
import { buildSampleWorkpack } from "@/lib/sample-workpack";
import {
  startIsolatedNextBrowserHarness,
  type IsolatedNextBrowserHarness
} from "./helpers/isolated-next-browser-harness";

const screenshotDirectory = join(
  process.cwd(),
  "evaluation",
  "share-mobile-p1",
  "screenshots"
);

const vietnameseParagraphs = [
  "Trước khi bắt đầu công việc, hãy kiểm tra toàn bộ khu vực nguy hiểm, lối đi bộ, tuyến xe nâng và thiết bị bảo hộ cá nhân.",
  "Khóa bánh xe của giàn giáo, kiểm tra lan can và tuyệt đối không di chuyển giàn giáo khi vẫn còn người làm việc ở phía trên.",
  "Nếu gió mạnh hơn, giàn giáo rung hoặc có nguy cơ rơi ngã, hãy dừng công việc ngay và di chuyển đến vị trí an toàn.",
  "Không đi vào khu vực xe nâng và luôn giữ lối đi bộ tách biệt với tuyến vận chuyển vật liệu trong suốt ca làm việc.",
  "Mang dây an toàn, mũ, giày và các thiết bị bảo hộ được yêu cầu trước khi bước lên sàn công tác.",
  "Báo ngay cho quản lý khi phát hiện lan can, bánh xe, sàn thao tác hoặc điểm neo dây an toàn không bảo đảm.",
  "Chỉ tiếp tục công việc sau khi người quản lý xác nhận rằng biện pháp khắc phục đã hoàn thành và khu vực đã an toàn.",
  "Nếu chưa hiểu bất kỳ nội dung nào, hãy dừng lại và yêu cầu quản lý hoặc phiên dịch giải thích lại bằng tiếng Việt."
] as const;

let browser: Browser | null = null;
let harness: IsolatedNextBrowserHarness | null = null;

describe("workspace mobile share presentation", () => {
  beforeAll(async () => {
    mkdirSync(screenshotDirectory, { recursive: true });
    harness = await startIsolatedNextBrowserHarness({
      slug: "workspace-share-mobile-p1",
      initialPath: "/workspace?theme=day",
      portSalt: 17416,
      mode: "dev"
    });
    browser = harness.browser;
  }, 90_000);

  afterAll(async () => {
    await harness?.stop();
  }, 60_000);

  it("renders every Vietnamese paragraph before the single CTA without clipping or overflow", async () => {
    if (!browser || !harness) throw new Error("Browser harness was not started");

    const sample = buildSampleWorkpack();
    const data = {
      ...sample,
      question: `${sample.question} 베트남 외국인 작업자에게 전체 안전 문단을 전달해줘.`,
      deliverables: {
        ...sample.deliverables,
        foreignWorkerLanguages: sample.deliverables.foreignWorkerLanguages.map((language) =>
          language.code === "vi"
            ? { ...language, lines: [...vietnameseParagraphs] }
            : language
        )
      }
    };
    const workerSnapshot = {
      savedAt: "2026-07-16T09:00:00+09:00",
      source: "workspace",
      workers: [{
        id: "worker-vietnamese-share-p1",
        displayName: "베트남 작업자",
        role: "외벽 도장 작업자",
        joinedAt: "2026-07-16",
        experienceLevel: "중간",
        experienceSummary: "이동식 비계 작업 경험 보유",
        nationality: "베트남",
        languageCode: "vi",
        languageLabel: "베트남어",
        isNewWorker: false,
        isForeignWorker: true,
        trainingStatus: "당일 교육 예정",
        trainingSummary: "베트남어 안내 후 이해 여부 확인 필요",
        phone: "01000000003"
      }],
      selectedWorkerIds: ["worker-vietnamese-share-p1"]
    } satisfies CurrentWorkerSnapshot;
    const stored = buildStoredCurrentWorkpack(data, { workerSnapshot });
    const scenarios = [
      { label: "desktop", width: 1440, height: 900 },
      { label: "mobile-390", width: 390, height: 844 }
    ] as const;

    for (const theme of ["day", "night"] as const) {
      for (const scenario of scenarios) {
        const page = await browser.newPage({
          viewport: { width: scenario.width, height: scenario.height }
        });
        try {
          await page.addInitScript(
            ({ key, value }) => window.localStorage.setItem(key, value),
            { key: CURRENT_WORKPACK_STORAGE_KEY, value: JSON.stringify(stored) }
          );
          await page.goto(`${harness.baseUrl}/workspace?theme=${theme}`, { waitUntil: "networkidle" });
          await page.locator(".workspace-document-page").waitFor({ state: "visible" });
          await page.getByLabel("작업공간 메뉴").getByRole("button").filter({ hasText: "공유" }).click();
          await page.locator("[data-share-root]").waitFor({ state: "visible" });
          await page.locator("#workflow-language-select").selectOption("foreign:vi");
          await page.evaluate(async () => {
            await document.fonts.ready;
            await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
          });

          const metrics = await page.evaluate(() => {
            const preview = document.querySelector<HTMLElement>("[data-share-preview]");
            const lines = document.querySelector<HTMLElement>(".message-preview-lines");
            const primaryActions = [...document.querySelectorAll<HTMLElement>("[data-share-primary]")]
              .filter((element) => getComputedStyle(element).display !== "none");
            const primary = primaryActions[0];
            const paragraphs = [...document.querySelectorAll<HTMLElement>(".message-preview-lines p")];
            const toggles = [...document.querySelectorAll<HTMLElement>(".workspace-theme-toggle button")];
            if (!preview || !lines || !primary) throw new Error("Missing share presentation target");
            const previewRect = preview.getBoundingClientRect();
            const linesRect = lines.getBoundingClientRect();
            const primaryRect = primary.getBoundingClientRect();
            const lastParagraphRect = paragraphs.at(-1)?.getBoundingClientRect();
            return {
              previewBottom: previewRect.bottom,
              primaryTop: primaryRect.top,
              linesClientHeight: lines.clientHeight,
              linesScrollHeight: lines.scrollHeight,
              linesOverflowY: getComputedStyle(lines).overflowY,
              lastParagraphBottom: lastParagraphRect?.bottom ?? 0,
              linesBottom: linesRect.bottom,
              previewText: lines.innerText,
              paragraphCount: paragraphs.length,
              primaryCount: primaryActions.length,
              horizontalOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
              toggleSizes: toggles.map((toggle) => {
                const rect = toggle.getBoundingClientRect();
                return { width: rect.width, height: rect.height };
              })
            };
          });

          await page.screenshot({
            path: join(screenshotDirectory, `${scenario.label}-${theme}-vietnamese.png`),
            fullPage: true
          });

          expect.soft(metrics.primaryCount, `${scenario.label} ${theme} primary CTA count`).toBe(1);
          expect.soft(metrics.horizontalOverflow, `${scenario.label} ${theme} horizontal overflow`).toBe(0);
          expect.soft(metrics.previewBottom, `${scenario.label} ${theme} preview before CTA`).toBeLessThanOrEqual(metrics.primaryTop);
          expect.soft(metrics.linesScrollHeight, `${scenario.label} ${theme} no hidden inner content`).toBeLessThanOrEqual(metrics.linesClientHeight + 1);
          expect.soft(metrics.linesOverflowY, `${scenario.label} ${theme} no inner scrollbar`).toBe("visible");
          expect.soft(metrics.lastParagraphBottom, `${scenario.label} ${theme} last paragraph visible`).toBeLessThanOrEqual(metrics.linesBottom + 1);
          expect.soft(metrics.paragraphCount, `${scenario.label} ${theme} full Vietnamese paragraph count`).toBe(vietnameseParagraphs.length + 2);
          for (const paragraph of vietnameseParagraphs) {
            expect.soft(metrics.previewText, `${scenario.label} ${theme} Vietnamese paragraph`).toContain(paragraph);
          }
          for (const size of metrics.toggleSizes) {
            expect.soft(size.width, `${scenario.label} ${theme} theme toggle width`).toBeGreaterThanOrEqual(44);
            expect.soft(size.height, `${scenario.label} ${theme} theme toggle height`).toBeGreaterThanOrEqual(44);
          }
        } finally {
          await page.close();
        }
      }
    }
  }, 120_000);
});
