import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { chromium, type Browser, type BrowserContext, type Page } from "playwright";

import {
  buildStoredCurrentWorkpack,
  CURRENT_WORKPACK_STORAGE_KEY
} from "@/lib/current-workpack";
import { buildMockAskResponse, mockSearchResults } from "@/lib/mock-data";
import {
  OPERATION_IMPROVEMENTS_STORAGE_KEY,
  type OperationImprovement
} from "@/lib/operation-improvement-history";
import { toggleReportPhotoApproval } from "@/lib/reporting-downloads";
import { attachQualityContract } from "@/lib/quality-contract";

const improvement: OperationImprovement = {
  id: "improvement-1",
  createdAt: "2026-07-08T08:30:00.000Z",
  siteName: "서울 성수동",
  workSummary: "외벽 도장",
  hazardLabel: "추락 위험",
  improvementText: "난간을 보강",
  reflectedDocuments: ["위험성평가표"],
  beforePhotoName: "before.jpg",
  afterPhotoName: "after.jpg"
};

describe("reports download center behavior", () => {
  it("toggles approval for one exact improvement and photo pair", () => {
    const approved = toggleReportPhotoApproval([], [improvement], improvement.id);

    expect(approved).toEqual([{
      improvementId: improvement.id,
      beforePhotoName: "before.jpg",
      afterPhotoName: "after.jpg"
    }]);
    expect(toggleReportPhotoApproval(approved, [improvement], improvement.id)).toEqual([]);
  });

  it("fails closed when an improvement id is duplicated or loses its photo pair", () => {
    const approval = [{
      improvementId: improvement.id,
      beforePhotoName: "before.jpg",
      afterPhotoName: "after.jpg"
    }];
    const duplicate = { ...improvement, afterPhotoName: "other-after.jpg" };
    const missingAfter = { ...improvement, afterPhotoName: undefined };

    expect(toggleReportPhotoApproval(approval, [improvement, duplicate], improvement.id)).toEqual([]);
    expect(toggleReportPhotoApproval(approval, [missingAfter], improvement.id)).toEqual([]);
  });
});

const port = 35_000 + (process.pid % 10_000);
const baseUrl = `http://127.0.0.1:${port}`;
const testSupabaseUrl = "https://reports-test.supabase.co";
const testSupabaseAuthStorageKey = "sb-reports-test-auth-token";
const testAccessToken = "reports-test-access-token";
let server: ChildProcessWithoutNullStreams | null = null;
let browser: Browser | null = null;
const serverOutput: string[] = [];

function resolveNextBin(): string {
  const candidates = [
    path.join(process.cwd(), "node_modules", "next", "dist", "bin", "next"),
    path.resolve(process.cwd(), "..", "..", "node_modules", "next", "dist", "bin", "next")
  ];
  const nextBin = candidates.find((candidate) => fs.existsSync(candidate));
  if (!nextBin) {
    throw new Error(`Unable to locate next dev binary. Checked: ${candidates.join(", ")}`);
  }
  return nextBin;
}

async function waitForHttp(url: string, timeoutMs = 60_000): Promise<void> {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {
      // The dev server is still booting.
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`Timed out waiting for ${url}\n${serverOutput.slice(-20).join("")}`);
}

async function stopServer(): Promise<void> {
  if (!server || server.killed) return;
  await new Promise<void>((resolve) => {
    const timeout = setTimeout(resolve, 5_000);
    server?.once("exit", () => {
      clearTimeout(timeout);
      resolve();
    });
    server?.kill();
  });
}

async function installAuthSession(context: BrowserContext): Promise<void> {
  await context.addInitScript(({ expectedOrigin, authStorageKey, accessToken }) => {
    if (window.location.origin !== expectedOrigin) return;
    window.localStorage.setItem(authStorageKey, JSON.stringify({
      access_token: accessToken,
      refresh_token: "reports-test-refresh-token",
      expires_at: 4_102_444_800,
      token_type: "bearer"
    }));
  }, {
    expectedOrigin: baseUrl,
    authStorageKey: testSupabaseAuthStorageKey,
    accessToken: testAccessToken
  });
}

async function installLocalWorkpack(
  context: BrowserContext,
  marker: string,
  savedAt: string
): Promise<void> {
  const response = buildMockAskResponse(
    "브라우저 로컬 작업팩",
    mockSearchResults.slice(0, 2),
    "live",
    "local switch candidate"
  );
  const workpack = {
    ...buildStoredCurrentWorkpack({
      ...response,
      scenario: {
        ...response.scenario,
        siteName: "브라우저 최근 현장",
        workSummary: marker
      }
    }),
    savedAt
  };
  await context.addInitScript(({ expectedOrigin, workpackKey, workpackJson }) => {
    if (window.location.origin !== expectedOrigin) return;
    window.localStorage.setItem(workpackKey, workpackJson);
  }, {
    expectedOrigin: baseUrl,
    workpackKey: CURRENT_WORKPACK_STORAGE_KEY,
    workpackJson: JSON.stringify(workpack)
  });
}

async function expectBlockedServerState(page: Page, workpackId: string): Promise<void> {
  const errorState = page.getByLabel("서버 작업팩 오류 상태");
  await errorState.waitFor({ state: "visible", timeout: 5_000 });
  expect(await errorState.getByRole("heading", { name: "서버 저장 작업팩을 열지 못했습니다." }).count()).toBe(1);
  const provenance = errorState.getByLabel("요청한 서버 작업팩 출처");
  expect(await provenance.getByText("서버 저장 작업팩", { exact: true }).count()).toBe(1);
  expect(await provenance.getByText(workpackId, { exact: true }).count()).toBe(1);
  expect(await page.getByLabel("작업문서형 리포트").count()).toBe(0);
  expect(await page.getByText("브라우저 최근 작업팩", { exact: true }).count()).toBe(0);

  const exportButtons = errorState.getByLabel("리포트 다운로드").getByRole("button");
  expect(await exportButtons.count()).toBe(5);
  for (const button of await exportButtons.all()) {
    expect(await button.isDisabled()).toBe(true);
  }
}

describe("reports download center remount behavior", () => {
  beforeAll(async () => {
    server = spawn(process.execPath, [resolveNextBin(), "dev", "--port", String(port)], {
      cwd: process.cwd(),
      env: {
        ...process.env,
        NEXT_TELEMETRY_DISABLED: "1",
        NEXT_PUBLIC_SUPABASE_URL: testSupabaseUrl,
        NEXT_PUBLIC_SUPABASE_ANON_KEY: "reports-test-anon-key"
      }
    });
    server.stdout.on("data", (chunk: Buffer) => serverOutput.push(chunk.toString()));
    server.stderr.on("data", (chunk: Buffer) => serverOutput.push(chunk.toString()));
    await waitForHttp(`${baseUrl}/reports`);
    browser = await chromium.launch({ headless: true });
  }, 90_000);

  afterAll(async () => {
    await browser?.close();
    await stopServer();
  });

  it("renders a normal missing workpack as an available feature with a calm next action", async () => {
    if (!browser) throw new Error("Browser was not started");
    const context = await browser.newContext();
    const page = await context.newPage();

    try {
      await page.goto(`${baseUrl}/reports`, { waitUntil: "networkidle" });
      await page.getByLabel("리포트 빈 상태").waitFor({ state: "visible" });

      expect(await page.getByText("바로 사용", { exact: true }).count()).toBeGreaterThan(0);
      expect(await page.getByLabel("리포트 빈 상태").count()).toBe(1);
      expect(await page.getByRole("heading", { name: "최근 작업팩이 없습니다." }).count()).toBe(1);
      expect(await page.getByRole("link", { name: "작업공간에서 만들기" }).count()).toBe(1);
      expect(await page.getByLabel("다운로드 준비 상태").getByText("현재 작업팩 필요", { exact: true }).count()).toBe(1);
      expect(await page.getByText("리포트 오류", { exact: true }).count()).toBe(0);
      expect(await page.getByRole("heading", { name: "현재 작업을 불러오지 못했습니다." }).count()).toBe(0);
    } finally {
      await context.close();
    }
  }, 90_000);

  it("resets exact-pair photo approval after a real page reload", async () => {
    if (!browser) throw new Error("Browser was not started");
    const now = new Date().toISOString();
    const generatedAt = "2026-07-10T07:45:00.000Z";
    const workpack = {
      ...buildStoredCurrentWorkpack(attachQualityContract(buildMockAskResponse(
      "성수동 외벽 도장 작업",
      mockSearchResults.slice(0, 2),
      "live",
      "report remount test"
      ), generatedAt)),
      savedAt: "2026-07-10T08:00:00.000Z"
    };
    const storedImprovement: OperationImprovement = {
      ...improvement,
      createdAt: now,
      status: "candidate"
    };
    const context = await browser.newContext();
    await context.addInitScript(({ expectedOrigin, workpackJson, improvementsJson, workpackKey, improvementsKey }) => {
      if (window.location.origin !== expectedOrigin) return;
      window.localStorage.setItem(workpackKey, workpackJson);
      window.localStorage.setItem(improvementsKey, improvementsJson);
    }, {
      expectedOrigin: baseUrl,
      workpackJson: JSON.stringify(workpack),
      improvementsJson: JSON.stringify([storedImprovement]),
      workpackKey: CURRENT_WORKPACK_STORAGE_KEY,
      improvementsKey: OPERATION_IMPROVEMENTS_STORAGE_KEY
    });
    const page = await context.newPage();

    try {
      await page.goto(`${baseUrl}/reports`, { waitUntil: "networkidle" });
      const headerProvenance = page.getByLabel("리포트 헤더 데이터 출처");
      const stickyProvenance = page.getByLabel("고정 리포트 데이터 출처");
      expect(await headerProvenance.getByText("브라우저 최근 작업팩", { exact: true }).count()).toBe(1);
      expect(await stickyProvenance.getByText("브라우저 최근 작업팩", { exact: true }).count()).toBe(1);
      expect(await stickyProvenance.locator('time[datetime="2026-07-10T08:00:00.000Z"]').count()).toBe(1);
      expect(await stickyProvenance.locator(`time[datetime="${generatedAt}"]`).count()).toBe(1);

      await page.evaluate(() => window.scrollTo(0, 900));
      const stickyBox = await stickyProvenance.boundingBox();
      if (!stickyBox) throw new Error("Sticky report provenance was not rendered");
      expect(stickyBox.y).toBeGreaterThanOrEqual(0);
      expect(stickyBox.y).toBeLessThan(720);

      const approval = page.getByLabel("Before/After 사진 포함 승인");
      await approval.waitFor({ state: "visible" });
      expect(await approval.isChecked()).toBe(false);

      await approval.check();
      expect(await approval.isChecked()).toBe(true);

      await page.reload({ waitUntil: "networkidle" });
      const remountedApproval = page.getByLabel("Before/After 사진 포함 승인");
      await remountedApproval.waitFor({ state: "visible" });
      expect(await remountedApproval.isChecked()).toBe(false);
    } finally {
      await context.close();
    }
  }, 90_000);

  it("loads a requested server-saved workpack through the existing bearer session contract", async () => {
    if (!browser) throw new Error("Browser was not started");
    const serverSavedAt = "2026-07-10T09:15:00.000Z";
    const workpackGeneratedAt = "2026-07-10T09:00:00.000Z";
    const reopenData = attachQualityContract(buildMockAskResponse(
      "서버 저장 문서팩 리포트",
      mockSearchResults.slice(0, 2),
      "live",
      "server report provenance test"
    ), workpackGeneratedAt);
    const context = await browser.newContext();
    await context.addInitScript(({ expectedOrigin, authStorageKey, accessToken }) => {
      if (window.location.origin !== expectedOrigin) return;
      window.localStorage.setItem(authStorageKey, JSON.stringify({
        access_token: accessToken,
        refresh_token: "reports-test-refresh-token",
        expires_at: 4_102_444_800,
        token_type: "bearer"
      }));
    }, {
      expectedOrigin: baseUrl,
      authStorageKey: testSupabaseAuthStorageKey,
      accessToken: testAccessToken
    });
    const page = await context.newPage();
    let authorizationHeader = "";
    await page.route("**/api/workpacks/server-report-1", async (route) => {
      authorizationHeader = route.request().headers().authorization || "";
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          ok: true,
          configured: true,
          canReopen: true,
          workpack: {
            id: "server-report-1",
            createdAt: "2026-07-10T09:05:00.000Z",
            updatedAt: serverSavedAt,
            reopenData
          },
          blockers: [],
          message: "저장된 문서팩 상세를 불러왔습니다."
        })
      });
    });

    try {
      await page.goto(`${baseUrl}/reports?workpackId=server-report-1`, { waitUntil: "networkidle" });

      const headerProvenance = page.getByLabel("리포트 헤더 데이터 출처");
      const stickyProvenance = page.getByLabel("고정 리포트 데이터 출처");
      expect(authorizationHeader).toBe(`Bearer ${testAccessToken}`);
      expect(await headerProvenance.getByText("서버 저장 작업팩", { exact: true }).count()).toBe(1);
      expect(await stickyProvenance.getByText("서버 저장 작업팩", { exact: true }).count()).toBe(1);
      expect(await stickyProvenance.locator(`time[datetime="${serverSavedAt}"]`).count()).toBe(1);
      expect(await stickyProvenance.locator(`time[datetime="${workpackGeneratedAt}"]`).count()).toBe(1);
    } finally {
      await context.close();
    }
  }, 90_000);

  it("keeps a no-session server request blocked until the user explicitly switches to a valid local workpack", async () => {
    if (!browser) throw new Error("Browser was not started");
    const referenceNow = new Date("2026-07-09T12:00:00+09:00");
    const localMarker = "LOCAL_SWITCH_SENTINEL";
    const context = await browser.newContext();
    await installLocalWorkpack(context, localMarker, referenceNow.toISOString());
    const page = await context.newPage();
    await page.clock.setFixedTime(referenceNow);

    try {
      await page.goto(`${baseUrl}/reports?workpackId=server-no-session`, { waitUntil: "networkidle" });

      await expectBlockedServerState(page, "server-no-session");
      expect(await page.getByText(localMarker, { exact: true }).count()).toBe(0);
      const switchButton = page.getByRole("button", { name: "브라우저 최근 작업팩으로 전환" });
      expect(await switchButton.count()).toBe(1);

      await switchButton.click();
      const browserProvenance = page.getByLabel("고정 리포트 데이터 출처");
      await browserProvenance.waitFor({ state: "visible" });
      expect(await browserProvenance.getByText("브라우저 최근 작업팩", { exact: true }).count()).toBe(1);
      expect(await page.getByText(localMarker, { exact: true }).count()).toBeGreaterThan(0);
      expect(await page.getByLabel("서버 작업팩 오류 상태").count()).toBe(0);
      await page.locator('[aria-label="다운로드 준비 상태"][data-download-readiness="ready"]').waitFor({
        state: "visible"
      });
      const exportButtons = page.getByLabel("리포트 다운로드").getByRole("button");
      for (const button of await exportButtons.all()) {
        expect(await button.isEnabled()).toBe(true);
      }
    } finally {
      await context.close();
    }
  }, 90_000);

  it.each([
    { status: 401, id: "server-unauthorized", message: "관리자 로그인이 필요합니다." },
    { status: 404, id: "server-not-found", message: "저장된 문서팩 상세를 찾지 못했습니다." }
  ])("keeps a $status server response blocked when no valid local workpack exists", async ({ status, id, message }) => {
    if (!browser) throw new Error("Browser was not started");
    const context = await browser.newContext();
    await installAuthSession(context);
    const page = await context.newPage();
    await page.route(`**/api/workpacks/${id}`, async (route) => {
      await route.fulfill({
        status,
        contentType: "application/json",
        body: JSON.stringify({ ok: false, configured: true, workpack: null, message })
      });
    });

    try {
      await page.goto(`${baseUrl}/reports?workpackId=${id}`, { waitUntil: "networkidle" });

      await expectBlockedServerState(page, id);
      expect(await page.getByText(message, { exact: true }).count()).toBe(1);
      expect(await page.getByRole("button", { name: "브라우저 최근 작업팩으로 전환" }).count()).toBe(0);
    } finally {
      await context.close();
    }
  }, 90_000);

  it("fails closed on a malformed legacy server response without exposing local data", async () => {
    if (!browser) throw new Error("Browser was not started");
    const malformed = buildMockAskResponse(
      "형식이 오래된 서버 작업팩",
      mockSearchResults.slice(0, 2),
      "live",
      "malformed server report test"
    );
    const context = await browser.newContext();
    await installAuthSession(context);
    const page = await context.newPage();
    const pageErrors: string[] = [];
    page.on("pageerror", (error) => pageErrors.push(error.message));
    await page.route("**/api/workpacks/server-malformed", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          ok: true,
          configured: true,
          canReopen: true,
          workpack: {
            id: "server-malformed",
            createdAt: "2026-07-10T09:05:00.000Z",
            updatedAt: "2026-07-10T09:15:00.000Z",
            reopenData: { ...malformed, citations: [null] }
          }
        })
      });
    });

    try {
      await page.goto(`${baseUrl}/reports?workpackId=server-malformed`, { waitUntil: "networkidle" });

      await expectBlockedServerState(page, "server-malformed");
      expect(await page.getByRole("button", { name: "브라우저 최근 작업팩으로 전환" }).count()).toBe(0);
      expect(pageErrors).toEqual([]);
    } finally {
      await context.close();
    }
  }, 90_000);

  it("keeps preserved authoritative history inspectable beside sample preview without merging it into sample evidence", async () => {
    if (!browser) throw new Error("Browser was not started");
    const context = await browser.newContext();
    const currentPeriodTimestamp = new Date().toISOString();
    const preservedImprovement: OperationImprovement = {
      ...improvement,
      id: "preserved-authoritative-history",
      createdAt: currentPeriodTimestamp,
      hazardLabel: "권한분리 고유 위험",
      improvementText: "샘플과 합치면 안 되는 실제 개선 이력",
      reflectedDocuments: ["위험성평가표", "TBM 기록"],
      status: "completed"
    };
    await context.addInitScript(({ expectedOrigin, workpackJson, improvementsJson, workpackKey, improvementsKey }) => {
      if (window.location.origin !== expectedOrigin) return;
      window.localStorage.setItem(workpackKey, workpackJson);
      window.localStorage.setItem(improvementsKey, improvementsJson);
    }, {
      expectedOrigin: baseUrl,
      workpackJson: JSON.stringify({
        ...buildStoredCurrentWorkpack(buildMockAskResponse(
          "성수동 외벽 도장 작업",
          mockSearchResults.slice(0, 2),
          "live",
          "invalid current workpack test"
        )),
        savedAt: "2026-07-08T08:00:00"
      }),
      improvementsJson: JSON.stringify([preservedImprovement]),
      workpackKey: CURRENT_WORKPACK_STORAGE_KEY,
      improvementsKey: OPERATION_IMPROVEMENTS_STORAGE_KEY
    });
    const page = await context.newPage();

    try {
      await page.goto(`${baseUrl}/reports`, { waitUntil: "networkidle" });
      const errorHeading = page.getByRole("heading", { name: "현재 작업을 불러오지 못했습니다." });
      await errorHeading.waitFor({ state: "visible" });
      expect(await errorHeading.isVisible()).toBe(true);
      expect(await page.getByText("현재 작업팩 저장시각이 유효한 RFC3339 offset 시각이 아니어서 증빙 리포트를 복원할 수 없습니다.").isVisible()).toBe(true);
      expect(await page.getByText("보존된 개선 이력 1건은 유지됩니다.").isVisible()).toBe(true);

      const previewButton = page.getByRole("button", { name: "샘플 미리보기" });
      await previewButton.waitFor({ state: "visible" });
      expect(await previewButton.isVisible()).toBe(true);
      await previewButton.click();

      expect(await page.getByText("샘플 리포트", { exact: true }).isVisible()).toBe(true);
      expect(await page.getByLabel("고정 리포트 데이터 출처").getByText("샘플 데이터", { exact: true }).count()).toBe(1);
      expect(await page.getByLabel("다운로드 준비 상태").getByText("다운로드 잠김", { exact: true }).count()).toBe(1);
      const exportButtons = page.getByLabel("리포트 다운로드").getByRole("button");
      expect(await exportButtons.count()).toBe(5);
      for (const button of await exportButtons.all()) {
        expect(await button.isDisabled()).toBe(true);
      }

      const preservedHistory = page.getByLabel("보존된 실제 개선 이력");
      await preservedHistory.waitFor({ state: "visible" });
      expect(await preservedHistory.getByText("샘플과 합치면 안 되는 실제 개선 이력").isVisible()).toBe(true);
      expect(await preservedHistory.getByText("샘플 리포트 본문과 증빙 다운로드에는 합치지 않습니다.").isVisible()).toBe(true);

      const sampleReport = page.getByLabel("작업문서형 리포트");
      await sampleReport.waitFor({ state: "visible" });
      expect(await sampleReport.getByText("샘플과 합치면 안 되는 실제 개선 이력").count()).toBe(0);
    } finally {
      await context.close();
    }
  }, 90_000);
});
