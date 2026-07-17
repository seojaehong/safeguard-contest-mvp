import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Browser, Page, Route } from "playwright";

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

const previewCapability = {
  ok: true,
  providerDispatch: {
    capability: false,
    mode: "preview_only",
    reason: "persistent_idempotency_unavailable",
    channels: {
      email: { capability: false, reason: "persistent_idempotency_unavailable" },
      sms: { capability: false, reason: "persistent_idempotency_unavailable" },
      kakao: { capability: false, reason: "persistent_idempotency_unavailable" }
    }
  }
} as const;

const partialLiveCapability = {
  ok: true,
  providerDispatch: {
    capability: true,
    mode: "live",
    reason: null,
    channels: {
      email: { capability: true, reason: null },
      sms: { capability: false, reason: "provider_configuration_unavailable" },
      kakao: { capability: false, reason: "provider_configuration_unavailable" }
    }
  }
} as const;

let browser: Browser | null = null;
let harness: IsolatedNextBrowserHarness | null = null;

function buildStoredVietnameseWorkpack(): string {
  const data = buildSampleWorkpack();
  const workerSnapshot = {
    savedAt: "2026-07-17T09:00:00+09:00",
    source: "workspace",
    workers: [{
      id: "worker-vietnamese-capability",
      displayName: "베트남 작업자",
      role: "도장 작업자",
      joinedAt: "2026-07-17",
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
    selectedWorkerIds: ["worker-vietnamese-capability"]
  } satisfies CurrentWorkerSnapshot;
  return JSON.stringify(buildStoredCurrentWorkpack(data, { workerSnapshot }));
}

async function openSharePanel(page: Page): Promise<void> {
  await page.addInitScript(
    ({ key, value }) => window.localStorage.setItem(key, value),
    { key: CURRENT_WORKPACK_STORAGE_KEY, value: buildStoredVietnameseWorkpack() }
  );
  await page.goto(`${harness?.baseUrl}/workspace?theme=day`, { waitUntil: "networkidle" });
  await page.getByLabel("작업공간 메뉴").getByRole("button").filter({ hasText: "공유" }).click();
  await page.locator("[data-share-root]").waitFor({ state: "visible" });
}

function countContainmentPosts(page: Page): { read: () => number } {
  let count = 0;
  page.on("request", (request) => {
    if (request.method() !== "POST") return;
    const pathname = new URL(request.url()).pathname;
    if (pathname === "/api/workflow/dispatch" || /\/api\/workpacks\/[^/]+\/share-sessions$/u.test(pathname)) {
      count += 1;
    }
  });
  return { read: () => count };
}

async function expectContainedPreviewDom(page: Page): Promise<void> {
  const channelButtons = page.getByLabel("전파 채널 선택").getByRole("button");
  await expect.poll(() => channelButtons.count()).toBe(3);
  for (let index = 0; index < 3; index += 1) {
    const button = channelButtons.nth(index);
    expect(await button.isDisabled()).toBe(true);
    expect(await button.getAttribute("aria-pressed")).toBe("false");
    const label = await button.getAttribute("aria-label");
    expect(label).toContain("이유:");
    expect(label).not.toContain("다음 행동:");
  }
  const primary = page.locator("[data-share-primary]");
  expect(await primary.isDisabled()).toBe(true);
  expect((await primary.innerText()).trim()).toBe("미리보기 전용");
  await page.locator("#workflow-language-select").selectOption("foreign:vi");
  await expect.poll(() => page.locator("[data-share-preview]").innerText()).toContain("Tiếng Việt");
}

describe("workflow share capability browser containment", () => {
  beforeAll(async () => {
    harness = await startIsolatedNextBrowserHarness({
      slug: "workflow-share-capability",
      initialPath: "/workspace?theme=day",
      portSalt: 17821,
      mode: "dev"
    });
    browser = harness.browser;
  }, 90_000);

  afterAll(async () => {
    await harness?.stop();
  }, 60_000);

  it("shows checking before preview-only and never posts while contained", async () => {
    if (!browser || !harness) throw new Error("Browser harness was not started");
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    const posts = countContainmentPosts(page);
    let releaseCapability: () => void = () => undefined;
    const capabilityReady = new Promise<void>((resolve) => {
      releaseCapability = resolve;
    });
    await page.route("**/api/workflow/dispatch", async (route: Route) => {
      if (route.request().method() !== "GET" || new URL(route.request().url()).search) {
        await route.continue();
        return;
      }
      await capabilityReady;
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(previewCapability) });
    });

    try {
      await openSharePanel(page);
      await expect.poll(() => page.getByText("발송 상태 확인 중", { exact: true }).count()).toBeGreaterThan(0);
      expect(await page.locator("[data-share-primary]").isDisabled()).toBe(true);
      releaseCapability();
      await expect.poll(() => page.getByText("미리보기 전용", { exact: true }).count()).toBeGreaterThan(0);
      await expectContainedPreviewDom(page);
      await page.locator("[data-share-primary]").evaluate((button: HTMLButtonElement) => button.click());
      expect(posts.read()).toBe(0);
    } finally {
      releaseCapability();
      await page.close();
    }
  }, 90_000);

  it("keeps setup and retry actions visible for blocked channels in partial-live mode", async () => {
    if (!browser || !harness) throw new Error("Browser harness was not started");
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    const posts = countContainmentPosts(page);
    await page.route("**/api/workflow/dispatch", async (route: Route) => {
      if (route.request().method() !== "GET" || new URL(route.request().url()).search) {
        await route.continue();
        return;
      }
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(partialLiveCapability) });
    });

    try {
      await openSharePanel(page);
      await expect.poll(() => page.getByText("문서팩 보내기", { exact: true }).count()).toBeGreaterThan(0);
      expect(await page.getByRole("link", { name: "발송 채널 준비 안내" }).getAttribute("href")).toBe("/settings");
      expect(await page.getByRole("button", { name: "다시 확인" }).isVisible()).toBe(true);
      const channels = page.getByLabel("전파 채널 선택").getByRole("button");
      expect(await channels.nth(0).isEnabled()).toBe(true);
      expect(await channels.nth(0).getAttribute("aria-pressed")).toBe("true");
      for (const index of [1, 2]) {
        expect(await channels.nth(index).isDisabled()).toBe(true);
        expect(await channels.nth(index).getAttribute("aria-pressed")).toBe("false");
        expect(await channels.nth(index).getAttribute("aria-label")).toContain("발송 채널 설정이 필요합니다.");
      }
      expect(posts.read()).toBe(0);
    } finally {
      await page.close();
    }
  }, 90_000);

  it("shows lookup failure for malformed and 405 responses, then retries into preview-only", async () => {
    if (!browser || !harness) throw new Error("Browser harness was not started");
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    const posts = countContainmentPosts(page);
    let attempts = 0;
    let responseMode: "malformed" | "method_not_allowed" | "preview" = "malformed";
    await page.route("**/api/workflow/dispatch", async (route: Route) => {
      if (route.request().method() !== "GET" || new URL(route.request().url()).search) {
        await route.continue();
        return;
      }
      attempts += 1;
      if (responseMode === "malformed") {
        await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, providerDispatch: { mode: "preview_only" } }) });
        return;
      }
      if (responseMode === "method_not_allowed") {
        await route.fulfill({ status: 405, contentType: "application/json", body: JSON.stringify({ ok: false }) });
        return;
      }
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(previewCapability) });
    });

    try {
      await openSharePanel(page);
      await expect.poll(() => page.getByText("상태 확인 실패", { exact: true }).count()).toBeGreaterThan(0);
      expect(await page.getByRole("link", { name: "발송 채널 준비 안내" }).getAttribute("href")).toBe("/settings");
      const languageSelect = page.locator("#workflow-language-select");
      const preview = page.locator("[data-share-preview]");
      await languageSelect.selectOption("foreign:vi");
      await expect.poll(() => preview.innerText()).toContain("Tiếng Việt");
      const foreignPreviewBeforeRetry = await preview.innerText();
      responseMode = "method_not_allowed";
      const attemptsBefore405 = attempts;
      await page.getByRole("button", { name: "다시 확인" }).click();
      await expect.poll(() => attempts).toBeGreaterThan(attemptsBefore405);
      await expect.poll(() => page.getByText("상태 확인 실패", { exact: true }).count()).toBeGreaterThan(0);
      expect(await languageSelect.inputValue()).toBe("foreign:vi");
      expect(await preview.innerText()).toBe(foreignPreviewBeforeRetry);
      responseMode = "preview";
      const attemptsBeforePreview = attempts;
      await page.getByRole("button", { name: "다시 확인" }).click();
      await expect.poll(() => attempts).toBeGreaterThan(attemptsBeforePreview);
      await expect.poll(() => page.getByText("미리보기 전용", { exact: true }).count()).toBeGreaterThan(0);
      expect(await languageSelect.inputValue()).toBe("foreign:vi");
      expect(await preview.innerText()).toBe(foreignPreviewBeforeRetry);
      await expectContainedPreviewDom(page);
      expect(posts.read()).toBe(0);
    } finally {
      await page.close();
    }
  }, 90_000);
});
