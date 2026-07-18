import { afterAll, beforeAll, describe, expect, it } from "vitest";
import fs from "node:fs";
import type { Browser, Route } from "playwright";
import {
  startIsolatedNextBrowserHarness,
  type IsolatedNextBrowserHarness
} from "./helpers/isolated-next-browser-harness";

const SESSION_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const WORKER_ID = "11111111-1111-4111-8111-111111111111";
const hasProductionBuild = fs.existsSync(".next/BUILD_ID");

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
    await expect.poll(() => page.locator("body").innerText()).toContain("문서팩 검토");
    await expect.poll(() => page.locator("body").innerText()).toContain("초대된 작업자에게만 열린 확인 화면입니다.");
    await expect.poll(() => page.getByText("Server Nguyen", { exact: false }).count()).toBeGreaterThan(0);
    await expect.poll(() => page.locator("body").innerText()).toContain("Tiếng Việt 안내");
    await expect.poll(() => page.getByText("위험성평가표", { exact: true }).count()).toBe(1);
    await expect.poll(() => page.getByText("TBM 브리핑", { exact: true }).count()).toBe(1);
    await expect.poll(() => page.locator("body").innerText()).toContain("Dừng công việc khi gió mạnh.");
    await expect.poll(() => page.locator(".safeclaw-select").inputValue()).toBe("vi");
    await expect.poll(() => page.getByText("작업자 ID", { exact: true }).count()).toBe(0);
    await expect.poll(() => page.getByText("세션 방식", { exact: false }).count()).toBe(0);

    const metrics = await page.evaluate(() => {
      const controls = [...document.querySelectorAll<HTMLElement>(".safeclaw-input, .safeclaw-select, .safeclaw-button")];
      const cards = [...document.querySelectorAll<HTMLElement>(".safeclaw-share-recipient-card")];
      return {
        documentWidth: document.documentElement.clientWidth,
        scrollWidth: document.documentElement.scrollWidth,
        bodyScrollWidth: document.body.scrollWidth,
        minimumControlHeight: Math.min(...controls.map((item) => item.getBoundingClientRect().height)),
        outsideCards: cards.filter((item) => {
          const rect = item.getBoundingClientRect();
          return rect.left < -0.5 || rect.right > window.innerWidth + 0.5;
        }).length
      };
    });
    expect(metrics.scrollWidth).toBeLessThanOrEqual(metrics.documentWidth);
    expect(metrics.bodyScrollWidth).toBeLessThanOrEqual(metrics.documentWidth);
    expect(metrics.minimumControlHeight).toBeGreaterThanOrEqual(44);
    expect(metrics.outsideCards).toBe(0);

    await page.getByRole("button", { name: "열람 확인" }).click();
    await expect.poll(() => page.getByText("작업자 열람 확인을 저장했습니다.", { exact: true }).count()).toBe(1);
    await expect.poll(() => page.getByText("관리자 화면에 확인 이력이 저장되었습니다.", { exact: true }).count()).toBe(1);
    await expect.poll(() => page.getByText("확인 ID:", { exact: false }).count()).toBe(0);
    expect(confirmationBody).toEqual({
      workerId: WORKER_ID,
      displayName: "Server Nguyen",
      languageCode: "vi"
    });
    await page.close();
  }, 90_000);
});
