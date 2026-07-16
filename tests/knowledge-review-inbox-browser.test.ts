import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Browser } from "playwright";
import {
  startIsolatedNextBrowserHarness,
  type IsolatedNextBrowserHarness
} from "./helpers/isolated-next-browser-harness";

let baseUrl = "";
let browser: Browser | null = null;
let harness: IsolatedNextBrowserHarness | null = null;

const queueItem = {
  runId: "11111111-1111-4111-8111-111111111111",
  status: "review_required",
  statusLabel: "검토 대기",
  sourceEventCount: 1,
  candidateLabel: "위험성평가표 현장 지식 검토",
  candidateText: "작업발판 단부의 안전난간 상태를 확인하고 현장 책임자가 적용 여부를 검토합니다.",
  matchedHazardCount: 1,
  providerLabel: "fixture-provider"
};

describe("knowledge review inbox browser", () => {
  beforeAll(async () => {
    harness = await startIsolatedNextBrowserHarness({
      slug: "knowledge-review-inbox",
      initialPath: "/knowledge?theme=day",
      portSalt: 91,
      timeoutMs: 120_000,
      environment: {
        NEXT_PUBLIC_SUPABASE_URL: "https://fixture.supabase.co",
        NEXT_PUBLIC_SUPABASE_ANON_KEY: "fixture-anon-key"
      }
    });
    baseUrl = harness.baseUrl;
    browser = harness.browser;
  }, 140_000);

  afterAll(async () => {
    await harness?.stop();
  }, 30_000);

  it("shows one mobile-safe decision group and submits the existing approval action", async () => {
    if (!browser) throw new Error("Browser was not started");
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    await page.addInitScript(() => {
      localStorage.setItem("sb-fixture-auth-token", JSON.stringify({
        access_token: "fixture-access-token",
        refresh_token: "fixture-refresh-token",
        expires_in: 3600,
        expires_at: Math.floor(Date.now() / 1000) + 3600,
        token_type: "bearer",
        user: {
          id: "reviewer-1",
          aud: "authenticated",
          role: "authenticated",
          email: "reviewer@example.com",
          app_metadata: {},
          user_metadata: {},
          created_at: "2026-07-16T00:00:00.000Z"
        }
      }));
    });
    let queue: typeof queueItem[] = [queueItem];
    const submittedBodies: unknown[] = [];
    const networkBodies: string[] = [];

    await page.route("**/api/knowledge/review", async (route) => {
      if (route.request().method() === "GET") {
        const body = JSON.stringify({
          ok: true,
          configured: true,
          queue,
          dropped: { runCount: 0, eventCount: 0, reasons: [] }
        });
        networkBodies.push(body);
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body
        });
        return;
      }
      submittedBodies.push(route.request().postDataJSON() as unknown);
      queue = [];
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          ok: true,
          action: "approve_candidate",
          publicationState: "unpublished",
          ontologyPublished: false
        })
      });
    });

    await page.goto(`${baseUrl}/knowledge?theme=day`, { waitUntil: "networkidle" });
    await page.getByRole("tab", { name: "검토 흐름" }).click();
    const inbox = page.locator('[data-knowledge-review-inbox="true"]');
    await inbox.waitFor();
    await expect.poll(() => inbox.getByText("위험성평가표 현장 지식 검토").isVisible()).toBe(true);
    expect(await inbox.textContent()).not.toContain("홍길동");
    expect(networkBodies).not.toHaveLength(0);
    for (const forbidden of [
      "sourceId",
      "rawEventIds",
      "tenantContext",
      "generatedOutput",
      "provenance",
      "홍길동"
    ]) {
      expect(networkBodies[0], `network response exposes ${forbidden}`).not.toContain(forbidden);
    }

    const metrics = await inbox.evaluate((root) => {
      const groups = [...root.querySelectorAll<HTMLElement>('[role="group"][aria-label="검토 결정"]')];
      const controls = [...root.querySelectorAll<HTMLElement>('[role="group"] button')].map((button) => {
        const rectangle = button.getBoundingClientRect();
        return {
          label: button.textContent?.trim() || "button",
          left: rectangle.left,
          right: rectangle.right,
          top: rectangle.top,
          bottom: rectangle.bottom,
          width: rectangle.width,
          height: rectangle.height
        };
      });
      const overlaps: string[] = [];
      for (let firstIndex = 0; firstIndex < controls.length; firstIndex += 1) {
        for (let secondIndex = firstIndex + 1; secondIndex < controls.length; secondIndex += 1) {
          const first = controls[firstIndex];
          const second = controls[secondIndex];
          const horizontal = Math.min(first.right, second.right) - Math.max(first.left, second.left);
          const vertical = Math.min(first.bottom, second.bottom) - Math.max(first.top, second.top);
          if (horizontal > 0.5 && vertical > 0.5) overlaps.push(`${first.label}/${second.label}`);
        }
      }
      return {
        groupCount: groups.length,
        controls,
        overlaps,
        rootContained: root.scrollWidth <= root.clientWidth + 1,
        documentOverflow: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) - window.innerWidth
      };
    });

    expect(metrics.groupCount).toBe(1);
    expect(metrics.controls).toHaveLength(3);
    expect(metrics.overlaps).toEqual([]);
    expect(metrics.rootContained).toBe(true);
    expect(metrics.documentOverflow).toBeLessThanOrEqual(1);
    for (const control of metrics.controls) {
      expect(control.width, control.label).toBeGreaterThanOrEqual(44);
      expect(control.height, control.label).toBeGreaterThanOrEqual(44);
    }

    await page.getByRole("button", { name: "후보 승인" }).click();
    await expect.poll(() => submittedBodies.length).toBe(1);
    expect(submittedBodies[0]).toEqual({
      runId: "11111111-1111-4111-8111-111111111111",
      action: "approve_candidate"
    });
    await expect.poll(() => inbox.getByText("검토 대기 후보가 없습니다.").isVisible()).toBe(true);
    await page.close();
  }, 90_000);
});
