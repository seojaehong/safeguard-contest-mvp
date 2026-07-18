import { afterAll, beforeAll, describe, expect, it } from "vitest";
import fs from "node:fs";
import type { Browser, Route } from "playwright";
import {
  startIsolatedNextBrowserHarness,
  type IsolatedNextBrowserHarness
} from "./helpers/isolated-next-browser-harness";

const SESSION_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const WORKER_ID = "11111111-1111-4111-8111-111111111111";
const hasProductionBuild = fs.existsSync(".next/BUILD_ID")
  && fs.existsSync(".next/prerender-manifest.json");

let browser: Browser | null = null;
let harness: IsolatedNextBrowserHarness | null = null;

const sessionPayload = {
  ok: true,
  configured: true,
  session: {
    id: SESSION_ID,
    workpackId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    shareScope: "invited",
    question: "부산 해운대 천장 누수 보수 · 고소작업 · 베트남 작업자 1명",
    status: "active",
    expiresAt: "2099-01-01T00:00:00.000Z",
    accessPolicy: {
      anonymousAllowed: false,
      manualLanguageSwitchAllowed: true,
      requireKnownWorkerSnapshot: true
    },
    documents: [
      {
        key: "riskAssessmentDraft",
        title: "위험성평가표",
        body: "추락 위험: 이동식 비계 고정과 안전대 착용을 확인합니다."
      },
      {
        key: "tbmBriefing",
        title: "TBM 브리핑",
        body: "강풍 시 작업을 중지하고 관리감독자에게 보고합니다."
      },
      {
        key: "tbmLogDraft",
        title: "TBM 기록",
        body: "작업자 전원이 위험요인과 작업중지 기준을 확인했습니다."
      }
    ],
    recipientMessage: {
      languageCode: "vi",
      title: "Tiếng Việt 안내",
      body: "Dừng công việc khi gió mạnh.\nKiểm tra dây an toàn trước khi làm việc."
    },
    recipients: [{
      workerId: WORKER_ID,
      displayName: "Server Nguyen",
      languageCode: "vi"
    }]
  },
  message: "공유 세션을 조회했습니다."
};

const chineseSessionPayload = {
  ...sessionPayload,
  session: {
    ...sessionPayload.session,
    recipientMessage: {
      languageCode: "zh",
      title: "SafeClaw safety notice",
      body: "Stop work during strong wind.\nCheck fall protection before work."
    },
    recipients: [{
      workerId: WORKER_ID,
      displayName: "Worker Zhang",
      languageCode: "zh"
    }]
  }
};

async function fulfillJson(route: Route, body: unknown): Promise<void> {
  await route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify(body)
  });
}

describe.skipIf(!hasProductionBuild)("share recipient portal browser contract", () => {
  beforeAll(async () => {
    harness = await startIsolatedNextBrowserHarness({
      slug: "share-recipient-portal",
      initialPath: "/",
      portSalt: 19231,
      mode: "prod",
      timeoutMs: 150_000
    });
    browser = harness.browser;
  }, 180_000);

  afterAll(async () => {
    await harness?.stop();
  }, 60_000);

  it("localizes the portal chrome from the query language before a session is loaded", async () => {
    if (!browser || !harness) throw new Error("Browser harness was not started");
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    const errors: string[] = [];
    page.on("pageerror", (error) => {
      errors.push(error.message);
    });
    try {
      const response = await page.goto(`${harness.baseUrl}/share/not-a-session?lang=vi`, { waitUntil: "networkidle" });
      if (!response || response.status() >= 400) {
        throw new Error(`share page returned ${response?.status() ?? "no response"}`);
      }
      const bodyText = await page.locator("body").innerText();
      expect(bodyText).toContain("Kiểm tra gói tài liệu");
      expect(bodyText).toContain("Màn hình xác nhận chỉ dành cho công nhân được mời.");
      expect(bodyText).toContain("Đang tải thông tin phiên...");
      expect(bodyText).toContain("Phạm vi công việc");
      expect(bodyText).toContain("Chưa tải được chi tiết công việc được chia sẻ.");
      expect(bodyText).not.toContain("문서팩 검토");
      expect(bodyText).not.toContain("세션 정보를 조회하는 중입니다");
      expect(bodyText).not.toContain("업무 범위");
      expect(bodyText).not.toContain("공유 중인 작업 상세");
      expect(errors).toEqual([]);
    } finally {
      await page.close();
    }
  }, 45_000);

  it("uses non-Korean chrome for unsupported foreign query languages", async () => {
    if (!browser || !harness) throw new Error("Browser harness was not started");
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    try {
      const response = await page.goto(`${harness.baseUrl}/share/not-a-session?lang=zh`, { waitUntil: "networkidle" });
      if (!response || response.status() >= 400) {
        throw new Error(`share page returned ${response?.status() ?? "no response"}`);
      }
      const bodyText = await page.locator("body").innerText();
      expect(bodyText).toContain("Review document pack");
      expect(bodyText).toContain("This confirmation screen is only for invited workers.");
      expect(bodyText).toContain("Loading share session...");
      expect(bodyText).toContain("Work scope");
      expect(bodyText).not.toContain("문서팩 검토");
      expect(bodyText).not.toContain("세션 정보를 조회하는 중입니다");
      expect(bodyText).not.toContain("업무 범위");
    } finally {
      await page.close();
    }
  }, 45_000);

  it("renders an invited worker confirmation page without mobile overflow", async () => {
    if (!browser || !harness) throw new Error("Browser harness was not started");
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    let confirmationBody: Record<string, unknown> | null = null;
    await page.route("**/api/share-sessions/**", async (route) => {
      if (route.request().method() === "POST") {
        confirmationBody = JSON.parse(route.request().postData() || "{}") as Record<string, unknown>;
        await fulfillJson(route, {
          ok: true,
          configured: true,
          confirmationId: "confirmation-1",
          message: "작업자 열람 확인을 저장했습니다."
        });
        return;
      }
      await fulfillJson(route, sessionPayload);
    });

    const response = await page.goto(`${harness.baseUrl}/share/${SESSION_ID}?workerId=${WORKER_ID}`, { waitUntil: "networkidle" });
    if (!response || response.status() >= 400) {
      throw new Error(`share page returned ${response?.status() ?? "no response"}\n${await page.locator("body").innerText().catch(() => "")}\n${harness.readServerOutput()}`);
    }
    await expect.poll(() => page.locator("body").innerText()).toContain("Kiểm tra gói tài liệu");
    await expect.poll(() => page.locator("body").innerText()).toContain("Màn hình xác nhận chỉ dành cho công nhân được mời.");
    await expect.poll(() => page.getByText("Server Nguyen", { exact: false }).count()).toBeGreaterThan(0);
    await expect.poll(() => page.locator("body").innerText()).toContain("Thông báo an toàn");
    await expect.poll(() => page.locator("body").innerText()).not.toContain("Tiếng Việt 안내");
    await expect.poll(() => page.getByText("Đánh giá rủi ro", { exact: true }).count()).toBe(1);
    await expect.poll(() => page.getByText("Họp an toàn TBM", { exact: true }).count()).toBe(1);
    await expect.poll(() => page.getByText("Biên bản TBM", { exact: true }).count()).toBe(1);
    await expect.poll(() => page.getByText("위험성평가표", { exact: true }).count()).toBe(0);
    await expect.poll(() => page.getByText("TBM 브리핑", { exact: true }).count()).toBe(0);
    await expect.poll(() => page.locator("body").innerText()).toContain("Dừng công việc khi gió mạnh.");
    await expect.poll(() => page.locator(".safeclaw-select").inputValue()).toBe("vi");
    await expect.poll(() => page.getByText("작업자 ID", { exact: true }).count()).toBe(0);
    await expect.poll(() => page.getByText("세션 방식", { exact: false }).count()).toBe(0);

    const metrics = await page.evaluate(() => {
      const controls = [...document.querySelectorAll<HTMLElement>(".safeclaw-input, .safeclaw-select, .safeclaw-button")];
      const cards = [...document.querySelectorAll<HTMLElement>(".safeclaw-share-recipient-card")];
      const confirmButton = [...document.querySelectorAll<HTMLElement>("button")]
        .find((item) => item.innerText.trim() === "Tôi đã xem");
      const documentsCard = [...document.querySelectorAll<HTMLElement>(".safeclaw-share-recipient-card")]
        .find((item) => item.innerText.includes("3 tài liệu chính"));
      const closedDocuments = [...document.querySelectorAll<HTMLDetailsElement>(".safeclaw-share-recipient-document")]
        .filter((item) => !item.open);
      const documentSummaries = [...document.querySelectorAll<HTMLElement>(".safeclaw-share-recipient-document summary")];
      const decisionAction = document.querySelector<HTMLElement>(".safeclaw-page-decision-action");
      const reviewHeading = [...document.querySelectorAll<HTMLElement>(".safeclaw-share-recipient-page h2")]
        .find((item) => item.innerText.trim() === "Kiểm tra gói tài liệu");
      return {
        documentWidth: document.documentElement.clientWidth,
        scrollWidth: document.documentElement.scrollWidth,
        bodyScrollWidth: document.body.scrollWidth,
        minimumControlHeight: Math.min(...controls.map((item) => item.getBoundingClientRect().height)),
        minimumDocumentSummaryHeight: Math.min(...documentSummaries.map((item) => item.getBoundingClientRect().height)),
        confirmationTop: Math.round(confirmButton?.getBoundingClientRect().top ?? 0),
        documentsTop: Math.round(documentsCard?.getBoundingClientRect().top ?? 0),
        collapsedDocumentCount: closedDocuments.length,
        decisionActionWidth: Math.round(decisionAction?.getBoundingClientRect().width ?? 0),
        reviewHeadingLeft: Math.round(reviewHeading?.getBoundingClientRect().left ?? 0),
        outsideCards: cards.filter((item) => {
          const rect = item.getBoundingClientRect();
          return rect.left < -0.5 || rect.right > window.innerWidth + 0.5;
        }).length
      };
    });
    expect(metrics.scrollWidth).toBeLessThanOrEqual(metrics.documentWidth);
    expect(metrics.bodyScrollWidth).toBeLessThanOrEqual(metrics.documentWidth);
    expect(metrics.minimumControlHeight).toBeGreaterThanOrEqual(44);
    expect(metrics.minimumDocumentSummaryHeight).toBeGreaterThanOrEqual(44);
    expect(metrics.confirmationTop).toBeLessThan(metrics.documentsTop);
    expect(metrics.collapsedDocumentCount).toBe(3);
    expect(metrics.decisionActionWidth).toBeGreaterThanOrEqual(300);
    expect(metrics.reviewHeadingLeft).toBeGreaterThanOrEqual(16);
    expect(metrics.outsideCards).toBe(0);

    await page.getByRole("button", { name: "Tôi đã xem" }).click();
    await expect.poll(() => page.getByText("Đã lưu xác nhận xem tài liệu.", { exact: true }).count()).toBe(1);
    await expect.poll(() => page.getByText("Lịch sử xác nhận đã được lưu cho quản lý.", { exact: true }).count()).toBe(1);
    await expect.poll(() => page.getByText("확인 ID:", { exact: false }).count()).toBe(0);
    await expect.poll(() => page.getByText("열람 확인", { exact: true }).count()).toBe(0);
    expect(confirmationBody).toEqual({
      workerId: WORKER_ID,
      displayName: "Server Nguyen",
      languageCode: "vi"
    });
    await page.close();
  }, 90_000);

  it("keeps unsupported foreign recipients on an English portal chrome fallback", async () => {
    if (!browser || !harness) throw new Error("Browser harness was not started");
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    await page.route("**/api/share-sessions/**", async (route) => {
      if (route.request().method() === "POST") {
        await fulfillJson(route, {
          ok: true,
          configured: true,
          confirmationId: "confirmation-zh",
          message: "Read confirmation saved."
        });
        return;
      }
      await fulfillJson(route, chineseSessionPayload);
    });

    const response = await page.goto(`${harness.baseUrl}/share/${SESSION_ID}?workerId=${WORKER_ID}`, { waitUntil: "networkidle" });
    if (!response || response.status() >= 400) {
      throw new Error(`share page returned ${response?.status() ?? "no response"}\n${await page.locator("body").innerText().catch(() => "")}\n${harness.readServerOutput()}`);
    }
    await expect.poll(() => page.locator("body").innerText()).toContain("Review document pack");
    await expect.poll(() => page.locator("body").innerText()).toContain("This confirmation screen is only for invited workers.");
    await expect.poll(() => page.getByText("Safety notice", { exact: true }).count()).toBe(1);
    await expect.poll(() => page.getByText("Risk assessment", { exact: true }).count()).toBe(1);
    await expect.poll(() => page.getByText("TBM briefing", { exact: true }).count()).toBe(1);
    await expect.poll(() => page.getByText("TBM log", { exact: true }).count()).toBe(1);
    await expect.poll(() => page.getByText("中文", { exact: true }).count()).toBeGreaterThan(0);
    await expect.poll(() => page.locator("body").innerText()).not.toContain("문서팩 검토");
    await expect.poll(() => page.locator("body").innerText()).not.toContain("작업자 안전공지");
    await expect.poll(() => page.locator("body").innerText()).not.toContain("위험성평가표");
    await expect.poll(() => page.locator("body").innerText()).not.toContain("중국어");
    await expect.poll(() => page.locator(".safeclaw-select").inputValue()).toBe("zh");

    const metrics = await page.evaluate(() => ({
      documentWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
      bodyScrollWidth: document.body.scrollWidth
    }));
    expect(metrics.scrollWidth).toBeLessThanOrEqual(metrics.documentWidth);
    expect(metrics.bodyScrollWidth).toBeLessThanOrEqual(metrics.documentWidth);
    await page.close();
  }, 90_000);
});
