import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Session, User } from "@supabase/supabase-js";
import type { Browser, Page, Route } from "playwright";

import {
  getPhotoVisionReadiness,
  type PhotoVisionReadiness,
} from "@/lib/photo-vision-analysis";
import {
  getSifEmbeddingGateStatus,
  type SifEmbeddingGateStatus,
} from "@/lib/sif-embedding-gate-status";

import {
  startIsolatedNextBrowserHarness,
  type IsolatedNextBrowserHarness,
} from "./helpers/isolated-next-browser-harness";

const DUMMY_SUPABASE_URL = "https://wave8-fixture.supabase.co";
const DUMMY_SUPABASE_ANON_KEY = "wave8-public-anon-key";
const AUTH_STORAGE_KEY = "sb-wave8-fixture-auth-token";
const AUTH_USER_ID = "10000000-0000-4000-8000-000000000008";
const ACCESS_TOKEN = [
  Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url"),
  Buffer.from(JSON.stringify({
    aud: "authenticated",
    exp: 4_102_444_800,
    role: "authenticated",
    sub: AUTH_USER_ID,
  })).toString("base64url"),
  "wave8-fixture-signature",
].join(".");

const productionMatrix = process.env.AI_CONNECT_PROD_MATRIX === "1" ? describe : describe.skip;
let harness: IsolatedNextBrowserHarness | null = null;
let browser: Browser | null = null;

const authUser: User = {
  id: AUTH_USER_ID,
  app_metadata: { provider: "email", providers: ["email"] },
  user_metadata: {},
  aud: "authenticated",
  confirmation_sent_at: undefined,
  recovery_sent_at: undefined,
  email_change_sent_at: undefined,
  new_email: undefined,
  new_phone: undefined,
  invited_at: undefined,
  action_link: undefined,
  email: "wave8@example.test",
  phone: undefined,
  created_at: "2026-07-12T00:00:00.000Z",
  confirmed_at: "2026-07-12T00:00:00.000Z",
  email_confirmed_at: "2026-07-12T00:00:00.000Z",
  phone_confirmed_at: undefined,
  last_sign_in_at: "2026-07-12T00:00:00.000Z",
  role: "authenticated",
  updated_at: "2026-07-12T00:00:00.000Z",
  identities: [],
  is_anonymous: false,
};

const authSession: Session = {
  access_token: ACCESS_TOKEN,
  refresh_token: "wave8-refresh-token",
  expires_in: 2_147_483_647,
  expires_at: 4_102_444_800,
  token_type: "bearer",
  user: authUser,
};

const baseSifFixture = getSifEmbeddingGateStatus({
  OPENAI_API_KEY: "",
  SUPABASE_SERVICE_ROLE_KEY: "",
  NEXT_PUBLIC_SUPABASE_URL: DUMMY_SUPABASE_URL,
});

const sifFixture: SifEmbeddingGateStatus = {
  ...baseSifFixture,
  ok: true,
  stage: "ready-for-approval",
  vectorGuard: {
    ...baseSifFixture.vectorGuard,
    status: "locked",
    label: "승인 전 잠금",
  },
  nextApprovalGate: {
    ...baseSifFixture.nextApprovalGate,
    status: "ready",
    artifactPath: "evaluation/wave8/approval-packet.json",
    command: "npm.cmd run knowledge:sif-embedding-preflight",
  },
  approvalPacket: {
    ...baseSifFixture.approvalPacket,
    safetyLocks: [
      { label: "DB 변경 잠금", locked: true, detail: "승인 전에는 DB를 변경하지 않습니다." },
      { label: "운영자 확인", locked: false, detail: "운영자 확인이 아직 필요합니다." },
    ],
  },
  approvalSteps: [
    { id: "fixture-done", label: "코퍼스 확인", status: "done", detail: "고정된 코퍼스를 확인했습니다." },
    { id: "fixture-ready", label: "승인 요청", status: "ready", detail: "승인 요청을 열 수 있습니다." },
    { id: "fixture-blocked", label: "업로드", status: "blocked", detail: "승인 전 업로드는 차단됩니다." },
  ],
};

const photoFixture: PhotoVisionReadiness = getPhotoVisionReadiness({
  OPENAI_API_KEY: "",
  OPENAI_VISION_MODEL: "gpt-4.1-mini",
});

type TokenSummary = {
  id: string;
  label: string;
  siteName: string;
  scopes: string[];
  disabled: boolean;
  lastUsedAt: string | null;
  createdAt: string;
};

const listedToken: TokenSummary = {
  id: "wave8-token-listed",
  label: "Wave 8 fixture token",
  siteName: "기본 현장",
  scopes: ["tools:read"],
  disabled: false,
  lastUsedAt: null,
  createdAt: "2026-07-12T00:00:00.000Z",
};

type NetworkProbe = {
  tokenRequests: number;
  authenticatedTokenRequests: number;
};

async function fulfillJson(route: Route, body: unknown, status = 200): Promise<void> {
  await route.fulfill({
    body: JSON.stringify(body),
    contentType: "application/json",
    status,
  });
}

async function installNetworkFixtures(page: Page): Promise<NetworkProbe> {
  const probe: NetworkProbe = { tokenRequests: 0, authenticatedTokenRequests: 0 };

  await page.route(`${DUMMY_SUPABASE_URL}/auth/v1/**`, async (route) => {
    if (route.request().url().includes("/token")) {
      await fulfillJson(route, authSession);
      return;
    }
    await fulfillJson(route, authUser);
  });
  await page.route("**/api/mcp-tokens*", async (route) => {
    probe.tokenRequests += 1;
    if (route.request().headers().authorization === `Bearer ${ACCESS_TOKEN}`) {
      probe.authenticatedTokenRequests += 1;
    }
    if (route.request().method() === "POST") {
      await fulfillJson(route, {
        ok: true,
        configured: true,
        plaintextToken: "safeclaw_wave8_one_time_token",
        token: { ...listedToken, id: "wave8-token-issued", label: "SafeClaw Harness Agent" },
        message: "연결 토큰을 발급했습니다.",
      });
      return;
    }
    await fulfillJson(route, {
      ok: true,
      configured: true,
      tokens: [listedToken],
      limit: 25,
      hasMore: false,
      nextCursor: null,
    });
  });
  await page.route("**/api/sif-embedding-gate/status", (route) => fulfillJson(route, sifFixture));
  await page.route("**/api/input-photos/hazard-analysis", (route) => fulfillJson(route, photoFixture));

  return probe;
}

type TypographyMetric = {
  firstFont: string;
  size: string;
  weight: string;
  lineHeight: number;
  tracking: number;
};

const roleChecks: readonly { selectors: readonly string[]; expected: TypographyMetric }[] = [
  {
    selectors: [".ai-connect-command > p"],
    expected: { firstFont: "Noto Sans KR", size: "15px", weight: "500", lineHeight: 24, tracking: 0 },
  },
  {
    selectors: [
      ".ai-connect-meta dt",
      ".ai-connect-secret label",
      ".ai-connect-command-box strong",
      ".ai-connect-section-head span",
      ".ai-connect-sif-metrics dt",
      ".ai-connect-vision-flow span",
      ".ai-connect-sif-next-gate span",
      ".ai-connect-sif-next-gate code",
      ".ai-connect-sif-next-gate pre",
      ".ai-connect-sif-operator-gate dt",
      ".ai-connect-sif-fingerprint code",
      ".ai-connect-sif-artifact-grid code",
      ".ai-connect-sif-command span",
      ".ai-connect-sif-command pre",
      ".ai-connect-secret textarea",
      ".ai-connect-command-box pre",
    ],
    expected: { firstFont: "Geist Mono", size: "11px", weight: "700", lineHeight: 16, tracking: 0.88 },
  },
  {
    selectors: [
      ".ai-connect-sif-state-grid strong",
      ".ai-connect-sif-command strong",
      ".ai-connect-vision-flow strong",
      ".ai-connect-sif-vector-guard strong",
      ".ai-connect-sif-next-gate strong",
      ".ai-connect-sif-operator-gate strong",
      ".ai-connect-sif-approval-packet strong",
      ".ai-connect-sif-approval-steps strong",
      ".ai-connect-sif-preflight strong",
      ".ai-connect-token-items article strong",
    ],
    expected: { firstFont: "Noto Sans KR", size: "20px", weight: "700", lineHeight: 27, tracking: -0.3 },
  },
  {
    selectors: [
      ".ai-connect-sif-state-grid p",
      ".ai-connect-vision-flow p",
      ".ai-connect-sif-vector-guard p",
      ".ai-connect-sif-next-gate p",
      ".ai-connect-sif-next-gate small",
      ".ai-connect-sif-operator-gate p",
      ".ai-connect-sif-operator-gate small",
      ".ai-connect-sif-operator-gate li",
      ".ai-connect-sif-operator-gate dd",
      ".ai-connect-sif-approval-packet ol",
      ".ai-connect-sif-fingerprint p",
      ".ai-connect-sif-artifact-grid p",
      ".ai-connect-sif-lock-grid p",
      ".ai-connect-sif-approval-steps p",
      ".ai-connect-sif-preflight p",
      ".ai-connect-sif-preflight summary",
    ],
    expected: { firstFont: "Noto Sans KR", size: "14px", weight: "500", lineHeight: 22.4, tracking: 0 },
  },
  {
    selectors: [".ai-connect-meta dd"],
    expected: { firstFont: "Geist Mono", size: "13px", weight: "500", lineHeight: 20, tracking: 0 },
  },
  {
    selectors: [".ai-connect-sif-metrics dd"],
    expected: { firstFont: "Noto Sans KR", size: "13px", weight: "500", lineHeight: 20, tracking: 0 },
  },
  {
    selectors: [
      ".ai-connect-tabs button span",
      ".ai-connect-section-head > strong",
      ".ai-connect-sif-verdict > span",
      ".ai-connect-sif-verdict > small",
      ".ai-connect-sif-vector-guard span",
      ".ai-connect-sif-operator-checklist li > span",
      ".ai-connect-sif-approval-packet span",
      ".ai-connect-sif-approval-steps li > span",
      ".ai-connect-sif-preflight li > span",
      ".ai-connect-token-items article > span",
    ],
    expected: { firstFont: "Noto Sans KR", size: "12px", weight: "600", lineHeight: 18, tracking: 0 },
  },
  {
    selectors: [
      ".ai-connect-tabs button",
      ".ai-connect-tabs button strong",
      ".ai-connect-actions button",
      ".ai-connect-command-box button",
      ".ai-connect-token-items button",
      ".ai-connect-sif-packet-actions a",
    ],
    expected: { firstFont: "Noto Sans KR", size: "14px", weight: "700", lineHeight: 20, tracking: 0 },
  },
];

async function readTypography(page: Page, selector: string): Promise<TypographyMetric> {
  return page.locator(selector).first().evaluate((element) => {
    const style = getComputedStyle(element);
    return {
      firstFont: style.fontFamily.split(",")[0].trim().replace(/^['"]|['"]$/gu, ""),
      size: style.fontSize,
      weight: style.fontWeight,
      lineHeight: Number.parseFloat(style.lineHeight),
      tracking: Number.parseFloat(style.letterSpacing) || 0,
    };
  });
}

async function expectRole(
  page: Page,
  selector: string,
  expected: TypographyMetric,
): Promise<void> {
  const metric = await readTypography(page, selector);
  expect(metric, selector).toMatchObject(expected);
  expect(metric.tracking, selector).toBeCloseTo(expected.tracking, 2);
}

function parseRgb(value: string): [number, number, number] {
  const channels = value.match(/[\d.]+/gu)?.slice(0, 3).map(Number);
  if (!channels || channels.length !== 3) throw new Error(`Unsupported computed color: ${value}`);
  return [channels[0], channels[1], channels[2]];
}

function relativeLuminance(color: string): number {
  const channels = parseRgb(color).map((channel) => {
    const value = channel / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

function contrastRatio(foreground: string, background: string): number {
  const lighter = Math.max(relativeLuminance(foreground), relativeLuminance(background));
  const darker = Math.min(relativeLuminance(foreground), relativeLuminance(background));
  return (lighter + 0.05) / (darker + 0.05);
}

async function readPaint(page: Page, selector: string): Promise<string> {
  return page.locator(selector).first().evaluate((element) => {
    const style = getComputedStyle(element);
    return [style.color, style.backgroundColor, style.borderColor].join("|");
  });
}

async function readSurfacePaint(page: Page, selector: string): Promise<string> {
  return page.locator(selector).first().evaluate((element) => {
    const style = getComputedStyle(element);
    return [style.backgroundColor, style.borderColor].join("|");
  });
}

async function readTokenColor(page: Page, selector: string, token: string): Promise<string> {
  return page.locator(selector).first().evaluate((element, cssToken) => {
    const probe = document.createElement("span");
    probe.style.color = `var(${cssToken})`;
    element.appendChild(probe);
    const color = getComputedStyle(probe).color;
    probe.remove();
    return color;
  }, token);
}

async function readElementColor(page: Page, selector: string, property: "backgroundColor" | "borderTopColor"): Promise<string> {
  return page.locator(selector).first().evaluate((element, cssProperty) => getComputedStyle(element)[cssProperty], property);
}

async function expectVisibleControls(page: Page, selector: string): Promise<void> {
  const metrics = await page.locator(selector).evaluateAll((elements) => elements.map((element) => {
    const rect = element.getBoundingClientRect();
    const style = getComputedStyle(element);
    return {
      height: rect.height,
      width: rect.width,
      display: style.display,
      visibility: style.visibility,
      opacity: Number.parseFloat(style.opacity),
      radius: style.borderRadius,
    };
  }));
  expect(metrics.length).toBeGreaterThan(0);
  for (const metric of metrics) {
    expect(metric.width).toBeGreaterThan(0);
    expect(metric.height).toBeGreaterThan(0);
    expect(metric.display).not.toBe("none");
    expect(metric.visibility).toBe("visible");
    expect(metric.opacity).toBeGreaterThan(0);
    expect(metric.radius).toBe("8px");
  }
}

productionMatrix("AI connect production matrix", () => {
  beforeAll(async () => {
    expect(process.env.NEXT_PUBLIC_SUPABASE_URL).toBe(DUMMY_SUPABASE_URL);
    expect(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY).toBe(DUMMY_SUPABASE_ANON_KEY);
    harness = await startIsolatedNextBrowserHarness({
      slug: "ai-connect-production-matrix",
      initialPath: "/settings/ai-connect?theme=day",
      portSalt: 9583,
      mode: "prod",
    });
    browser = harness.browser;
  }, 90_000);

  afterAll(async () => {
    await harness?.stop();
  }, 30_000);

  it("renders authenticated Day and Night role, state, contrast, and geometry contracts", async () => {
    if (!browser || !harness) throw new Error("Production browser harness was not started");
    expect(harness.mode).toBe("prod");

    for (const viewport of [
      { width: 1440, height: 900 },
      { width: 390, height: 844 },
      { width: 1440, height: 320 },
    ] as const) {
      for (const theme of ["day", "night"] as const) {
        const page = await browser.newPage({ viewport });
        await page.addInitScript(
          ({ key, value }) => window.localStorage.setItem(key, JSON.stringify(value)),
          { key: AUTH_STORAGE_KEY, value: authSession },
        );
        const probe = await installNetworkFixtures(page);
        await page.goto(`${harness.baseUrl}/settings/ai-connect?theme=${theme}`, { waitUntil: "networkidle" });
        await page.locator(`.safeclaw-module-shell[data-ready='true'][data-theme='${theme}']`).waitFor();
        await page.getByText(listedToken.label, { exact: true }).waitFor();
        expect(probe.authenticatedTokenRequests).toBeGreaterThan(0);

        await page.getByRole("button", { name: "연결 토큰 발급" }).click();
        await page.locator(".ai-connect-secret textarea").waitFor({ state: "visible" });
        await page.locator(".ai-connect-sif-preflight summary").click();

        for (const roleCheck of roleChecks) {
          for (const selector of roleCheck.selectors) {
            await expectRole(page, selector, roleCheck.expected);
          }
        }

        expect(await readPaint(page, ".ai-connect-section-head > strong.ready"))
          .not.toBe(await readPaint(page, ".ai-connect-section-head > strong.hold"));
        expect(await readPaint(page, ".ai-connect-sif-lock-grid article.locked span"))
          .not.toBe(await readPaint(page, ".ai-connect-sif-lock-grid article.open span"));
        expect(await readPaint(page, ".ai-connect-sif-approval-steps li.ready > span"))
          .not.toBe(await readPaint(page, ".ai-connect-sif-approval-steps li.blocked > span"));
        expect(await readPaint(page, ".ai-connect-tabs button.active"))
          .not.toBe(await readPaint(page, ".ai-connect-tabs button:not(.active)"));
        const activeTab = page.locator(".ai-connect-tabs button.active").first();
        const inactiveTab = page.locator(".ai-connect-tabs button:not(.active)").first();
        await inactiveTab.hover();
        const inactiveHoverPaint = await readSurfacePaint(page, ".ai-connect-tabs button:not(.active)");
        expect(await readElementColor(page, ".ai-connect-tabs button:not(.active)", "borderTopColor"))
          .toBe(await readTokenColor(page, ".ai-connect-workspace", "--workspace-rule-strong"));
        expect(await readElementColor(page, ".ai-connect-tabs button:not(.active)", "backgroundColor"))
          .toBe(await readTokenColor(page, ".ai-connect-workspace", "--workspace-surface-2"));
        await activeTab.hover();
        const activeHoverPaint = await readSurfacePaint(page, ".ai-connect-tabs button.active");
        expect(await readElementColor(page, ".ai-connect-tabs button.active", "borderTopColor"))
          .toBe(await readTokenColor(page, ".ai-connect-workspace", "--workspace-accent"));
        expect(await readElementColor(page, ".ai-connect-tabs button.active", "backgroundColor"))
          .toBe(await readTokenColor(page, ".ai-connect-workspace", "--workspace-surface-3"));
        expect(activeHoverPaint).not.toBe(inactiveHoverPaint);
        const vectorGuard = page.locator(".ai-connect-sif-vector-guard");
        expect(await vectorGuard.getAttribute("class")).toContain("locked");
        await vectorGuard.evaluate((element) => element.classList.replace("locked", "active"));
        expect(await readElementColor(page, ".ai-connect-sif-vector-guard.active", "borderTopColor"))
          .toBe(await readTokenColor(page, ".ai-connect-workspace", "--workspace-success"));

        for (const { foregroundSelector, surfaceSelector } of [
          { foregroundSelector: ".ai-connect-secret textarea", surfaceSelector: ".ai-connect-secret textarea" },
          { foregroundSelector: ".ai-connect-command-box pre", surfaceSelector: ".ai-connect-command-box pre" },
          { foregroundSelector: ".ai-connect-sif-next-gate code", surfaceSelector: ".ai-connect-sif-next-gate code" },
          { foregroundSelector: ".ai-connect-sif-command pre", surfaceSelector: ".ai-connect-sif-command pre" },
          { foregroundSelector: ".ai-connect-sif-packet-actions a", surfaceSelector: ".ai-connect-sif-packet-actions a" },
          { foregroundSelector: ".ai-connect-sif-verdict > span", surfaceSelector: ".ai-connect-sif-verdict" },
        ] as const) {
          const foreground = await page.locator(foregroundSelector).first().evaluate((element) => getComputedStyle(element).color);
          const background = await page.locator(surfaceSelector).first().evaluate((element) => {
            const style = getComputedStyle(element);
            return style.backgroundColor;
          });
          expect(
            contrastRatio(foreground, background),
            `${foregroundSelector} on ${surfaceSelector} ${theme}`,
          ).toBeGreaterThanOrEqual(4.5);
        }

        const columns = await page.evaluate(() => ({
          metrics: getComputedStyle(document.querySelector(".ai-connect-sif-metrics") as Element).gridTemplateColumns.split(" ").length,
          tabs: getComputedStyle(document.querySelector(".ai-connect-tabs") as Element).gridTemplateColumns.split(" ").length,
        }));
        expect(columns.tabs).toBe(viewport.width <= 560 ? 1 : 4);
        expect(columns.metrics).toBe(viewport.width <= 900 ? 1 : 4);
        await expectVisibleControls(page, ".ai-connect-workspace button, .ai-connect-workspace a");
        expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);
        await page.close();
      }
    }
  }, 180_000);

  it("settles configured unauthenticated Day and Night lanes on the empty state", async () => {
    if (!browser || !harness) throw new Error("Production browser harness was not started");

    for (const viewport of [
      { width: 1440, height: 900 },
      { width: 390, height: 844 },
    ] as const) {
      for (const theme of ["day", "night"] as const) {
        const context = await browser.newContext({ viewport });
        const storageBeforeNavigation = await context.storageState();
        expect(
          storageBeforeNavigation.origins.flatMap((origin) => origin.localStorage).some((entry) => entry.name === AUTH_STORAGE_KEY),
        ).toBe(false);
        const page = await context.newPage();
        const probe = await installNetworkFixtures(page);
        await page.goto(`${harness.baseUrl}/settings/ai-connect?theme=${theme}`, { waitUntil: "networkidle" });
        await page.locator(`.safeclaw-module-shell[data-ready='true'][data-theme='${theme}'] .ai-connect-empty`).waitFor({ state: "visible" });

        expect(await page.locator(".ai-connect-workspace").count()).toBe(0);
        expect(probe.tokenRequests).toBe(0);
        const emptyGeometry = await page.locator(".ai-connect-empty").evaluate((element) => {
          const rect = element.getBoundingClientRect();
          return { height: rect.height, width: rect.width };
        });
        expect(emptyGeometry.width).toBeGreaterThan(0);
        expect(emptyGeometry.height).toBeGreaterThan(0);
        const login = page.getByRole("link", { name: "관리자 로그인" });
        await login.waitFor({ state: "visible" });
        expect(await login.getAttribute("href")).toBe("/login?next=/settings/ai-connect");
        await expectRole(page, ".ai-connect-empty .button", {
          firstFont: "Noto Sans KR", size: "14px", weight: "700", lineHeight: 20, tracking: 0,
        });
        await expectVisibleControls(page, ".ai-connect-empty a");
        expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);
        await context.close();
      }
    }
  }, 90_000);
});
