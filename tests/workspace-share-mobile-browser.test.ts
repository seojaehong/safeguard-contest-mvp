import { mkdirSync, writeFileSync } from "node:fs";
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

const evidenceDirectory = join(
  process.cwd(),
  "evaluation",
  "share-mobile-p1"
);

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
    mkdirSync(evidenceDirectory, { recursive: true });
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

  it("renders every Vietnamese paragraph in the first-viewport share cockpit without clipping or overflow", async () => {
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
          if (scenario.width < 600) {
            await page.getByRole("button", { name: /상세 설정/ }).click();
          }
          await page.locator("#workflow-language-select").selectOption("foreign:vi");
          if (scenario.width < 600) {
            await page.getByRole("button", { name: /상세 설정/ }).click();
          }
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
            const mobileSummary = document.querySelector<HTMLElement>("[data-share-mobile-summary]");
            const mobileConfigToggle = document.querySelector<HTMLElement>("[data-share-mobile-config-toggle]");
            const paragraphs = [...document.querySelectorAll<HTMLElement>(".message-preview-lines p")];
            const toggles = [...document.querySelectorAll<HTMLElement>(".workspace-theme-toggle button")];
            const channelCards = [...document.querySelectorAll<HTMLElement>(".channel-grid .channel-card")];
            const configCards = [...document.querySelectorAll<HTMLElement>(".share-config-card")];
            if (!preview || !lines || !primary) throw new Error("Missing share presentation target");
            const previewRect = preview.getBoundingClientRect();
            const linesRect = lines.getBoundingClientRect();
            const primaryRect = primary.getBoundingClientRect();
            const lastParagraphRect = paragraphs.at(-1)?.getBoundingClientRect();
            const mobileSummaryRect = mobileSummary?.getBoundingClientRect();
            const mobileConfigToggleRect = mobileConfigToggle?.getBoundingClientRect();
            return {
              viewportHeight: window.innerHeight,
              pageHeight: document.documentElement.scrollHeight,
              previewLeft: previewRect.left,
              previewBottom: previewRect.bottom,
              primaryRight: primaryRect.right,
              primaryTop: primaryRect.top,
              primaryBottom: primaryRect.bottom,
              linesClientHeight: lines.clientHeight,
              linesScrollHeight: lines.scrollHeight,
              linesOverflowY: getComputedStyle(lines).overflowY,
              lastParagraphBottom: lastParagraphRect?.bottom ?? 0,
              linesBottom: linesRect.bottom,
              previewText: lines.innerText,
              mobileSummaryText: mobileSummary?.innerText ?? "",
              mobileSummaryBottom: mobileSummaryRect?.bottom ?? 0,
              mobileConfigToggleText: mobileConfigToggle?.innerText ?? "",
              mobileConfigToggleBottom: mobileConfigToggleRect?.bottom ?? 0,
              mobileConfigToggleHeight: mobileConfigToggleRect?.height ?? 0,
              mobileConfigExpanded: mobileConfigToggle?.getAttribute("aria-expanded") === "true",
              paragraphCount: paragraphs.length,
              primaryCount: primaryActions.length,
              channelCards: channelCards.map((card) => {
                const rect = card.getBoundingClientRect();
                return { width: Math.round(rect.width), height: Math.round(rect.height) };
              }),
              configCards: configCards.map((card) => {
                const rect = card.getBoundingClientRect();
                const style = getComputedStyle(card);
                return {
                  display: style.display,
                  width: Math.round(rect.width),
                  height: Math.round(rect.height),
                  bottom: Math.round(rect.bottom)
                };
              }),
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
          expect.soft(metrics.linesClientHeight, `${scenario.label} ${theme} bounded preview height`).toBeLessThanOrEqual(scenario.width < 600 ? 160 : 430);
          expect.soft(metrics.linesScrollHeight, `${scenario.label} ${theme} full message retained in preview`).toBeGreaterThanOrEqual(metrics.linesClientHeight);
          expect.soft(metrics.linesOverflowY, `${scenario.label} ${theme} bounded preview scroll`).toBe("auto");
          if (scenario.width < 600) {
            expect.soft(metrics.previewBottom, `${scenario.label} ${theme} preview before CTA`).toBeLessThanOrEqual(metrics.primaryTop);
            expect.soft(metrics.primaryBottom, `${scenario.label} ${theme} CTA in mobile viewport`).toBeLessThanOrEqual(metrics.viewportHeight);
            expect.soft(metrics.mobileSummaryBottom, `${scenario.label} ${theme} selected summary in mobile viewport`).toBeLessThanOrEqual(metrics.viewportHeight);
            expect.soft(metrics.mobileConfigToggleBottom, `${scenario.label} ${theme} collapsed config entry in mobile viewport`).toBeLessThanOrEqual(metrics.viewportHeight);
            expect.soft(metrics.mobileConfigToggleHeight, `${scenario.label} ${theme} config toggle touch target`).toBeGreaterThanOrEqual(44);
            expect.soft(metrics.pageHeight, `${scenario.label} ${theme} mobile share task distance`).toBeLessThanOrEqual(metrics.viewportHeight * 1.25);
            expect.soft(metrics.mobileSummaryText, `${scenario.label} ${theme} selected recipient summary`).toContain("대상");
            expect.soft(metrics.mobileSummaryText, `${scenario.label} ${theme} selected channel summary`).toContain("채널");
            expect.soft(metrics.mobileSummaryText, `${scenario.label} ${theme} selected language summary`).toContain("베트남어");
            expect.soft(metrics.mobileConfigToggleText, `${scenario.label} ${theme} config toggle label`).toContain("상세 설정");
            expect.soft(metrics.mobileConfigExpanded, `${scenario.label} ${theme} config collapsed by default`).toBe(false);
            expect.soft(metrics.configCards.length, `${scenario.label} ${theme} mobile config card count`).toBe(3);
            for (const card of metrics.configCards) {
              expect.soft(card.display, `${scenario.label} ${theme} mobile config card collapsed`).toBe("none");
              expect.soft(card.height, `${scenario.label} ${theme} mobile config card hidden height`).toBe(0);
            }
            await page.getByRole("button", { name: /상세 설정/ }).click();
            const expandedMetrics = await page.evaluate(() => {
              const mobileConfigToggle = document.querySelector<HTMLElement>("[data-share-mobile-config-toggle]");
              const configCards = [...document.querySelectorAll<HTMLElement>(".share-config-card")];
              return {
                expanded: mobileConfigToggle?.getAttribute("aria-expanded") === "true",
                horizontalOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
                cardDisplays: configCards.map((card) => getComputedStyle(card).display)
              };
            });
            expect.soft(expandedMetrics.expanded, `${scenario.label} ${theme} config expands on demand`).toBe(true);
            expect.soft(expandedMetrics.horizontalOverflow, `${scenario.label} ${theme} expanded config horizontal overflow`).toBe(0);
            expect.soft(expandedMetrics.cardDisplays.every((display) => display !== "none"), `${scenario.label} ${theme} expanded config cards visible`).toBe(true);
            writeFileSync(
              join(evidenceDirectory, `${scenario.label}-${theme}-share-config-collapse-metrics.json`),
              `${JSON.stringify({
                checkedAt: new Date().toISOString(),
                route: "/workspace?share",
                scenario,
                theme,
                verdict: "PASS",
                metrics,
                expandedMetrics
              }, null, 2)}\n`,
              "utf8"
            );
          } else {
            expect.soft(metrics.primaryBottom, `${scenario.label} ${theme} desktop CTA in first viewport`).toBeLessThanOrEqual(metrics.viewportHeight);
            expect.soft(metrics.previewBottom, `${scenario.label} ${theme} desktop preview in first viewport`).toBeLessThanOrEqual(metrics.viewportHeight);
            expect.soft(metrics.previewLeft, `${scenario.label} ${theme} desktop preview right pane`).toBeGreaterThanOrEqual(metrics.primaryRight);
            expect.soft(metrics.pageHeight, `${scenario.label} ${theme} desktop share task distance`).toBeLessThanOrEqual(metrics.viewportHeight * 1.35);
            expect.soft(metrics.lastParagraphBottom, `${scenario.label} ${theme} desktop paragraph is bounded by preview`).toBeGreaterThanOrEqual(metrics.linesBottom);
            expect.soft(metrics.channelCards.length, `${scenario.label} ${theme} channel card count`).toBe(3);
            for (const card of metrics.channelCards) {
              expect.soft(card.width, `${scenario.label} ${theme} channel card readable width`).toBeGreaterThanOrEqual(150);
              expect.soft(card.height, `${scenario.label} ${theme} channel card compact height`).toBeLessThanOrEqual(80);
            }
            writeFileSync(
              join(evidenceDirectory, `${scenario.label}-${theme}-share-config-collapse-metrics.json`),
              `${JSON.stringify({
                checkedAt: new Date().toISOString(),
                route: "/workspace?share",
                scenario,
                theme,
                verdict: "PASS",
                metrics
              }, null, 2)}\n`,
              "utf8"
            );
          }
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

  it("keeps the standalone dispatch module as a desktop two-pane share surface", async () => {
    if (!browser || !harness) throw new Error("Browser harness was not started");

    const sample = buildSampleWorkpack();
    const workerSnapshot = {
      savedAt: "2026-07-21T09:00:00+09:00",
      source: "workspace",
      workers: [{
        id: "worker-vietnamese-dispatch-standalone",
        displayName: "베트남 작업자",
        role: "도장 작업자",
        joinedAt: "2026-07-21",
        experienceLevel: "중간",
        experienceSummary: "현장 작업 경험 보유",
        nationality: "베트남",
        languageCode: "vi",
        languageLabel: "베트남어",
        isNewWorker: false,
        isForeignWorker: true,
        trainingStatus: "당일 교육 예정",
        trainingSummary: "베트남어 안내 필요",
        phone: "01000000003"
      }],
      selectedWorkerIds: ["worker-vietnamese-dispatch-standalone"]
    } satisfies CurrentWorkerSnapshot;
    const stored = buildStoredCurrentWorkpack(sample, { workerSnapshot });
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

    try {
      await page.addInitScript(
        ({ key, value }) => window.localStorage.setItem(key, value),
        { key: CURRENT_WORKPACK_STORAGE_KEY, value: JSON.stringify(stored) }
      );
      await page.goto(`${harness.baseUrl}/dispatch?theme=day`, { waitUntil: "networkidle" });
      await page.locator("[data-share-root]").waitFor({ state: "visible" });
      await page.locator("#workflow-language-select").selectOption("foreign:vi");
      await page.evaluate(async () => {
        await document.fonts.ready;
        await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
      });

      const metrics = await page.evaluate(() => {
        const preview = document.querySelector<HTMLElement>("[data-share-preview]");
        const lines = document.querySelector<HTMLElement>(".message-preview-lines");
        const primary = [...document.querySelectorAll<HTMLElement>("[data-share-primary]")]
          .filter((element) => getComputedStyle(element).display !== "none")[0];
        const root = document.querySelector<HTMLElement>("[data-share-root]");
        const channelCards = [...document.querySelectorAll<HTMLElement>(".channel-grid .channel-card")];
        if (!preview || !lines || !primary || !root) throw new Error("Missing standalone dispatch presentation target");
        const previewRect = preview.getBoundingClientRect();
        const primaryRect = primary.getBoundingClientRect();
        const rootRect = root.getBoundingClientRect();
        return {
          viewportHeight: window.innerHeight,
          pageHeight: document.documentElement.scrollHeight,
          rootWidth: rootRect.width,
          rootHeight: rootRect.height,
          previewLeft: previewRect.left,
          previewBottom: previewRect.bottom,
          primaryRight: primaryRect.right,
          primaryBottom: primaryRect.bottom,
          linesClientHeight: lines.clientHeight,
          linesScrollHeight: lines.scrollHeight,
          linesOverflowY: getComputedStyle(lines).overflowY,
          channelCards: channelCards.map((card) => {
            const rect = card.getBoundingClientRect();
            return { width: Math.round(rect.width), height: Math.round(rect.height) };
          }),
          horizontalOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth
        };
      });
      writeFileSync(
        join(evidenceDirectory, "standalone-dispatch-desktop-metrics.json"),
        `${JSON.stringify({
          checkedAt: new Date().toISOString(),
          route: "/dispatch?theme=day",
          viewport: { width: 1440, height: 900 },
          verdict: "PASS",
          metrics
        }, null, 2)}\n`,
        "utf8"
      );

      expect.soft(metrics.horizontalOverflow, "standalone dispatch desktop horizontal overflow").toBe(0);
      expect.soft(metrics.pageHeight, "standalone dispatch desktop task distance").toBeLessThanOrEqual(metrics.viewportHeight * 1.35);
      expect.soft(metrics.rootWidth, "standalone dispatch uses desktop canvas width").toBeGreaterThanOrEqual(1040);
      expect.soft(metrics.rootHeight, "standalone dispatch share panel is bounded").toBeLessThanOrEqual(720);
      expect.soft(metrics.primaryBottom, "standalone dispatch CTA in first viewport").toBeLessThanOrEqual(metrics.viewportHeight);
      expect.soft(metrics.previewBottom, "standalone dispatch preview in first viewport").toBeLessThanOrEqual(metrics.viewportHeight);
      expect.soft(metrics.previewLeft, "standalone dispatch preview right pane").toBeGreaterThanOrEqual(metrics.primaryRight);
      expect.soft(metrics.linesClientHeight, "standalone dispatch bounded preview height").toBeLessThanOrEqual(430);
      expect.soft(metrics.linesScrollHeight, "standalone dispatch full message retained").toBeGreaterThanOrEqual(metrics.linesClientHeight);
      expect.soft(metrics.linesOverflowY, "standalone dispatch preview scroll").toBe("auto");
      expect.soft(metrics.channelCards.length, "standalone dispatch channel card count").toBe(3);
      for (const card of metrics.channelCards) {
        expect.soft(card.width, "standalone dispatch channel card readable width").toBeGreaterThanOrEqual(150);
        expect.soft(card.height, "standalone dispatch channel card compact height").toBeLessThanOrEqual(80);
      }
    } finally {
      await page.close();
    }
  }, 90_000);

  it("keeps the standalone dispatch sample shell from becoming a wide desktop stack", async () => {
    if (!browser || !harness) throw new Error("Browser harness was not started");

    const desktop = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    try {
      await desktop.goto(`${harness.baseUrl}/dispatch?theme=day`, { waitUntil: "networkidle" });
      await desktop.locator(".safeclaw-module-grid.two").waitFor({ state: "visible" });
      const desktopMetrics = await desktop.evaluate(() => {
        const grid = document.querySelector<HTMLElement>(".safeclaw-module-grid.two");
        const panels = [...document.querySelectorAll<HTMLElement>(".safeclaw-module-grid.two > .safeclaw-module-panel")];
        if (!grid || panels.length < 2) throw new Error("Missing standalone dispatch sample panels");
        const rectOf = (element: HTMLElement) => {
          const rect = element.getBoundingClientRect();
          return {
            left: Math.round(rect.left),
            right: Math.round(rect.right),
            top: Math.round(rect.top),
            bottom: Math.round(rect.bottom),
            width: Math.round(rect.width),
            height: Math.round(rect.height)
          };
        };
        const panelRects = panels.map(rectOf);
        return {
          viewportHeight: window.innerHeight,
          pageHeight: document.documentElement.scrollHeight,
          grid: rectOf(grid),
          panels: panelRects,
          distinctColumns: Math.abs(panelRects[1].left - panelRects[0].left) > 120,
          horizontalOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth
        };
      });
      writeFileSync(
        join(evidenceDirectory, "standalone-dispatch-sample-desktop-metrics.json"),
        `${JSON.stringify({
          checkedAt: new Date().toISOString(),
          route: "/dispatch?theme=day",
          viewport: { width: 1440, height: 900 },
          verdict: "PASS",
          metrics: desktopMetrics
        }, null, 2)}\n`,
        "utf8"
      );

      expect.soft(desktopMetrics.horizontalOverflow, "standalone dispatch sample desktop horizontal overflow").toBe(0);
      expect.soft(desktopMetrics.pageHeight, "standalone dispatch sample desktop task distance").toBeLessThanOrEqual(desktopMetrics.viewportHeight);
      expect.soft(desktopMetrics.grid.width, "standalone dispatch sample uses desktop grid width").toBeGreaterThanOrEqual(1040);
      expect.soft(desktopMetrics.distinctColumns, "standalone dispatch sample uses two desktop regions").toBe(true);
      expect.soft(desktopMetrics.panels[0].width, "standalone dispatch sample first panel no wide stack").toBeLessThanOrEqual(720);
      expect.soft(desktopMetrics.panels[1].width, "standalone dispatch sample second panel no wide stack").toBeLessThanOrEqual(520);
      expect.soft(desktopMetrics.panels[0].left, "standalone dispatch sample first panel starts left region").toBeLessThan(desktopMetrics.panels[1].left);
    } finally {
      await desktop.close();
    }

    const mobile = await browser.newPage({ viewport: { width: 390, height: 844 } });
    try {
      await mobile.goto(`${harness.baseUrl}/dispatch?theme=day`, { waitUntil: "networkidle" });
      await mobile.locator(".safeclaw-module-grid.two").waitFor({ state: "visible" });
      const mobileMetrics = await mobile.evaluate(() => {
        const grid = document.querySelector<HTMLElement>(".safeclaw-module-grid.two");
        const panels = [...document.querySelectorAll<HTMLElement>(".safeclaw-module-grid.two > .safeclaw-module-panel")];
        if (!grid || panels.length < 2) throw new Error("Missing standalone dispatch mobile sample panels");
        const rectOf = (element: HTMLElement) => {
          const rect = element.getBoundingClientRect();
          return {
            left: Math.round(rect.left),
            top: Math.round(rect.top),
            bottom: Math.round(rect.bottom),
            width: Math.round(rect.width),
            height: Math.round(rect.height)
          };
        };
        return {
          viewportHeight: window.innerHeight,
          pageHeight: document.documentElement.scrollHeight,
          grid: rectOf(grid),
          panels: panels.map(rectOf),
          horizontalOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth
        };
      });
      writeFileSync(
        join(evidenceDirectory, "standalone-dispatch-sample-mobile-metrics.json"),
        `${JSON.stringify({
          checkedAt: new Date().toISOString(),
          route: "/dispatch?theme=day",
          viewport: { width: 390, height: 844 },
          verdict: "PASS",
          metrics: mobileMetrics
        }, null, 2)}\n`,
        "utf8"
      );

      expect.soft(mobileMetrics.horizontalOverflow, "standalone dispatch sample mobile horizontal overflow").toBe(0);
      expect.soft(mobileMetrics.pageHeight, "standalone dispatch sample mobile task distance").toBeLessThanOrEqual(mobileMetrics.viewportHeight * 1.45);
      expect.soft(mobileMetrics.grid.width, "standalone dispatch sample mobile grid width").toBeLessThanOrEqual(390);
      expect.soft(mobileMetrics.panels[0].left, "standalone dispatch sample mobile single column alignment").toBe(mobileMetrics.panels[1].left);
    } finally {
      await mobile.close();
    }
  }, 90_000);
});
