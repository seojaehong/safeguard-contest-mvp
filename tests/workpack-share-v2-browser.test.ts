import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Browser, BrowserContext, Page, Request, Route } from "playwright";

import { CURRENT_WORKPACK_STORAGE_KEY } from "@/lib/current-workpack";
import { parseChannelResolutionRequest } from "@/lib/channel-resolution-contract";
import { SUPPORTED_LANGUAGE_CODES, type SupportedLanguageCode } from "@/lib/foreign-worker";
import type { AskResponse } from "@/lib/types";
import type { WorkerProfile } from "@/lib/workspace";

import {
  SHARE_ACCESS_TOKEN,
  SHARE_AUTH_SESSION,
  SHARE_AUTH_STORAGE_KEY,
  SHARE_AVAILABILITY_TOKEN,
  SHARE_CONTRACT_AMENDMENT_COMMIT,
  SHARE_ENVIRONMENTS,
  SHARE_FIXTURE_IDS,
  SHARE_SCALE_MODES,
  SHARE_SESSION_ID,
  SHARE_SUPABASE_ANON_KEY,
  SHARE_SUPABASE_URL,
  SHARE_WORKPACK_ID,
  buildBlockedShareWorkpack,
  buildReadyShareWorkpack,
  buildShareLocalizationAuthority,
  buildShareWorker,
  buildStoredShareWorkpack,
  buildWorkpackDetailFixture,
  dispatchLogId,
  serverWorkerId,
  shareCaseId,
  type ShareEnvironment,
  type ShareFixtureId,
  type ShareScaleMode
} from "./fixtures/workpack-share-v2";
import {
  startIsolatedNextBrowserHarness,
  type IsolatedNextBrowserHarness
} from "./helpers/isolated-next-browser-harness";

type JsonRecord = Record<string, unknown>;

type RequestRecord = {
  method: string;
  path: string;
  body: JsonRecord;
  authorization: string | undefined;
};

type ShareNetworkProbe = {
  requests: RequestRecord[];
  unexpectedRequests: string[];
  workerMutationCount: number;
  sessionRequestCount: number;
  dispatchRequestCount: number;
  providerDispatchCount: number;
  dispatchLogRequestCount: number;
  channelRequestCount: number;
};

type ChannelMode = "ready" | "unavailable" | "deferred" | "stale";
type SessionMode = "success" | "failure" | "deferred";
type DispatchMode = "accepted" | "partial" | "failed" | "stale";
type DispatchLogMode = "success" | "failure" | "saved-count-only";

const BROWSER_IDEMPOTENCY_KEY = "provider-dispatch-v1-44444444-4444-4444-8444-444444444444-deadbeef";
const SCOPE_RACE_WORKPACK_ID = "10000000-0000-4000-8000-000000000106";

type ShareScenario = {
  response: AskResponse;
  workers: WorkerProfile[];
  selectedWorkerIds: string[];
  authenticated: boolean;
  serverLanguageCodes: Record<string, string>;
  shareLocalization: unknown;
  channelMode: ChannelMode;
  sessionMode: SessionMode;
  dispatchMode: DispatchMode;
  deferDispatch: boolean;
  dispatchLogMode: DispatchLogMode;
  staleReasonCode: string;
  workspaceSaveWorkpackId: string | null;
};

type ShareNetworkController = {
  probe: ShareNetworkProbe;
  releaseChannelUnavailable: () => Promise<void>;
  releaseSessionFailure: () => Promise<void>;
  releaseSessionSuccess: () => Promise<void>;
  releaseDispatch: () => Promise<void>;
};

type OpenSharePage = {
  context: BrowserContext;
  page: Page;
  controller: ShareNetworkController;
};

type ExecutedShareFixture = OpenSharePage & {
  expectedState: string;
  finalize: () => Promise<void>;
};

type GeometryMetrics = {
  viewportWidth: number;
  viewportHeight: number;
  documentWidth: number;
  horizontalOverflow: number;
  panelOverflow: number;
  previewHeight: number;
  previewHeightLimit: number;
  touchTargetCount: number;
  touchTargetFailures: string[];
  overlapFailures: string[];
  interactiveGapFailures: string[];
  nestedScrollFailures: string[];
  clippedTextFailures: string[];
  domOrderValid: boolean;
};

type RootTextScaleMetrics = {
  baselineCapturedBeforeMutation: boolean;
  rootAttributeBefore: string | null;
  rootAttributeAfter: string | null;
  rootAttributeMutationCount: number;
  descendantStyleMutationCount: number;
  directLeafInlineMutationCount: number;
  visibleCountBefore: number;
  visibleCountAfter: number;
  interactableCount: number;
  textLeafCount: number;
  representativeCount: number;
  uniqueRepresentativeCount: number;
  bodyRegionCount: number;
  previewRegionCount: number;
  ownerMissingCount: number;
  regionMissingCount: number;
  fontRatioFailures: string[];
  lineHeightRatioFailures: string[];
  pathScaleFailures: string[];
  pseudoElementInspectionCount: number;
  generatedPseudoElementCount: number;
  pseudoFontRatioFailures: string[];
  pseudoLineHeightRatioFailures: string[];
  mobileMediaQueryBefore: boolean;
  mobileMediaQueryAfter: boolean;
  compactContainerBefore: boolean;
  compactContainerAfter: boolean;
  rootWidthBefore: number;
  rootWidthAfter: number;
  rootHeightBefore: number;
  rootHeightAfter: number;
  rootFontBefore: number;
  rootFontAfter: number;
  documentRootFontBefore: number;
  documentRootFontAfter: number;
  deviceScaleFactor: number;
  devicePixelRatio: number;
  visualViewportScale: number;
  cssViewportWidth: number;
  previewLinesBefore: number;
  previewLinesAfter: number;
  previewHeightBefore: number;
  previewHeightAfter: number;
  previewGrowthRequired: boolean;
};

type TextScaleDeliveryAudit = {
  rootAttributeMutationCount: number;
  descendantStyleMutationCount: number;
  directLeafInlineMutationCount: number;
};

type BrowserCaseMetric = {
  caseId: string;
  contractAmendmentCommit: string;
  productCommit: string;
  productTree: string;
  environmentId: ShareEnvironment["id"];
  fixtureId: ShareFixtureId;
  scaleModeId: ShareScaleMode;
  viewport: { width: number; height: number };
  expectedState: string;
  freshDomRuns: number;
  languageAuthorityChecks: number;
  reviewVariantChecks: number;
  staleVariantChecks: number;
  scopeRaceChecks: number;
  geometry: {
    maximumHorizontalOverflow: number;
    maximumPanelOverflow: number;
    touchTargetFailureCount: number;
    overlapFailureCount: number;
    nestedScrollFailureCount: number;
    clippedTextFailureCount: number;
  };
  rootScale: null | {
    rootAttributeMutationCount: number;
    descendantStyleMutationCount: number;
    directLeafInlineMutationCount: number;
    pseudoElementInspectionCount: number;
    pseudoFailureCount: number;
    mediaQueryStable: boolean;
    containerQueryStable: boolean;
  };
};

const browserMatrix = process.env.WORKPACK_SHARE_V2_BROWSER === "1" ? describe : describe.skip;
let harness: IsolatedNextBrowserHarness | null = null;
let browser: Browser | null = null;
let browserProductCommit: string | null = null;
let browserProductTree: string | null = null;
const browserCaseMetrics: BrowserCaseMetric[] = [];

function validateBrowserProductIdentity(candidate: string | undefined, head: string): string {
  if (!candidate || !/^[0-9a-f]{40}$/u.test(candidate)) {
    throw new Error("WORKPACK_SHARE_V2_PRODUCT_SHA must be an exact commit SHA");
  }
  if (candidate !== head) throw new Error("browser product SHA does not match HEAD");
  return candidate;
}

function readGitRevision(revision: string): string {
  return execFileSync("git", ["rev-parse", revision], {
    cwd: process.cwd(),
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"]
  }).trim();
}

function requireBrowserProductIdentity(): { commit: string; tree: string } {
  if (!browserProductCommit || !browserProductTree) {
    throw new Error("browser product identity was not initialized");
  }
  return { commit: browserProductCommit, tree: browserProductTree };
}

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requestBody(request: Request): JsonRecord {
  const raw = request.postData();
  if (!raw) return {};
  try {
    const parsed: unknown = JSON.parse(raw);
    return isRecord(parsed) ? parsed : {};
  } catch (error) {
    console.error("Share v2 browser request JSON parse failed", error);
    return {};
  }
}

async function fulfillJson(route: Route, body: unknown, status = 200): Promise<void> {
  await route.fulfill({
    body: JSON.stringify(body),
    contentType: "application/json",
    status
  });
}

function buildScenario(fixtureId: ShareFixtureId): ShareScenario {
  const response = fixtureId === "blocked" ? buildBlockedShareWorkpack() : buildReadyShareWorkpack();
  const workers = [buildShareWorker("vi")];
  const selectedWorkerIds = fixtureId === "empty" ? [] : workers.map((worker) => worker.id);
  return {
    response,
    workers,
    selectedWorkerIds,
    authenticated: fixtureId !== "logged_out",
    serverLanguageCodes: Object.fromEntries(workers.map((worker) => [worker.id, worker.languageCode])),
    shareLocalization: buildShareLocalizationAuthority(response),
    channelMode: fixtureId === "channel_unavailable" ? "deferred" : fixtureId === "stale" ? "stale" : "ready",
    sessionMode: fixtureId === "sending" ? "deferred" : fixtureId === "fail_session" ? "failure" : "success",
    dispatchMode: fixtureId === "result_partial"
      ? "partial"
      : fixtureId === "fail_dispatch"
        ? "failed"
        : "accepted",
    deferDispatch: false,
    dispatchLogMode: fixtureId === "fail_dispatch_unpersisted" ? "failure" : "success",
    staleReasonCode: "workpack_revision_or_digest_changed",
    workspaceSaveWorkpackId: null
  };
}

async function installNetworkFixtures(page: Page, scenario: ShareScenario): Promise<ShareNetworkController> {
  const probe: ShareNetworkProbe = {
    requests: [],
    unexpectedRequests: [],
    workerMutationCount: 0,
    sessionRequestCount: 0,
    dispatchRequestCount: 0,
    providerDispatchCount: 0,
    dispatchLogRequestCount: 0,
    channelRequestCount: 0
  };
  let deferredChannelRoute: Route | null = null;
  let deferredSessionRoute: Route | null = null;
  let deferredDispatchRoute: { route: Route; body: JsonRecord } | null = null;

  const fulfillSessionSuccess = async (route: Route): Promise<void> => {
    await fulfillJson(route, {
      ok: true,
      shareSessionId: SHARE_SESSION_ID,
      dispatchIdempotencyKey: BROWSER_IDEMPOTENCY_KEY,
      expiresAt: "2099-07-14T00:00:00.000Z",
      message: "공유 세션을 만들었습니다."
    });
  };

  const fulfillDispatchResult = async (route: Route, body: JsonRecord): Promise<void> => {
    const channels = Array.isArray(body.channels)
      ? body.channels.filter((channel): channel is string => typeof channel === "string")
      : [];
    const channelResults = channels.map((channel, index) => ({
      channel,
      provider: "n8n-relay",
      status: scenario.dispatchMode === "accepted"
        ? "sent"
        : scenario.dispatchMode === "partial"
          ? index === 0 ? "sent" : "failed"
          : "failed",
      message: scenario.dispatchMode === "accepted" ? "accepted" : "provider result requires review"
    }));
    if (scenario.dispatchLogMode === "failure") {
      await fulfillJson(route, {
        ok: false,
        configured: true,
        state: "uncertain",
        reasonCode: "dispatch_evidence_unpersisted",
        providerCalled: true,
        duplicateRisk: true,
        idempotencySupported: true,
        idempotencyKey: body.idempotencyKey,
        message: "Server dispatch evidence persistence failed."
      }, 500);
      return;
    }
    const sentCount = channelResults.filter((result) => result.status === "sent").length;
    const outcome = sentCount === channelResults.length ? "accepted" : sentCount > 0 ? "partial" : "failed";
    const logIds = channels.map((_channel, index) => dispatchLogId(index));
    const localization = isRecord(scenario.shareLocalization) ? scenario.shareLocalization : {};
    await fulfillJson(route, {
      ok: outcome === "accepted" || outcome === "partial",
      configured: true,
      state: "recorded",
      outcome,
      message: scenario.dispatchMode === "accepted" ? "전송 요청을 접수했습니다." : "전송 결과 확인 필요",
      workflowRunId: "share-v2-workflow-run",
      providerStatus: "live",
      providerCalled: true,
      duplicateRisk: false,
      idempotencySupported: true,
      idempotencyKey: body.idempotencyKey,
      channelResults,
      logIds,
      receipt: {
        version: "server-dispatch-receipt/v1",
        receiptId: "55555555-5555-4555-8555-555555555555",
        shareSessionId: SHARE_SESSION_ID,
        idempotencyKey: body.idempotencyKey,
        workpackId: SHARE_WORKPACK_ID,
        canonicalWorkpackRevision: localization.canonicalWorkpackRevision,
        outcome,
        workflowRunId: "share-v2-workflow-run",
        logIds,
        recordedAt: "2026-07-14T01:00:00.000Z"
      }
    });
  };

  await page.route(`${SHARE_SUPABASE_URL}/auth/v1/**`, async (route) => {
    if (route.request().url().includes("/token")) {
      await fulfillJson(route, SHARE_AUTH_SESSION);
      return;
    }
    await fulfillJson(route, SHARE_AUTH_SESSION.user);
  });

  await page.route("**/api/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const method = request.method();
    const body = requestBody(request);
    probe.requests.push({
      method,
      path: `${url.pathname}${url.search}`,
      body,
      authorization: request.headers().authorization
    });

    if (url.pathname === "/api/agent/context" && method === "GET") {
      await fulfillJson(route, { sites: [] });
      return;
    }
    if (url.pathname === "/api/workpacks" && method === "GET") {
      await fulfillJson(route, {
        ok: true,
        configured: true,
        workpacks: [{ id: SHARE_WORKPACK_ID, question: scenario.response.question }]
      });
      return;
    }
    if (url.pathname === "/api/workpacks" && method === "POST" && scenario.workspaceSaveWorkpackId) {
      await fulfillJson(route, {
        ok: true,
        configured: true,
        workpackId: scenario.workspaceSaveWorkpackId,
        message: "작업공간 문서팩을 저장했습니다."
      });
      return;
    }
    const workpackDetailMatch = url.pathname.match(/^\/api\/workpacks\/([0-9a-f-]+)$/u);
    if (workpackDetailMatch && method === "GET") {
      const requestedWorkpackId = workpackDetailMatch[1];
      if (
        requestedWorkpackId !== SHARE_WORKPACK_ID
        && requestedWorkpackId !== scenario.workspaceSaveWorkpackId
      ) {
        await fulfillJson(route, { ok: false, message: "Unknown workpack fixture" }, 404);
        return;
      }
      await fulfillJson(route, buildWorkpackDetailFixture({
        response: scenario.response,
        workpackId: requestedWorkpackId,
        ...(requestedWorkpackId === SHARE_WORKPACK_ID
          ? { shareLocalization: scenario.shareLocalization }
          : {})
      }));
      return;
    }
    if (url.pathname === "/api/workers" && method === "GET") {
      await fulfillJson(route, {
        ok: true,
        configured: true,
        workers: scenario.workers.map((worker, index) => ({
          id: serverWorkerId(index),
          external_key: worker.id,
          display_name: worker.displayName,
          language_code: scenario.serverLanguageCodes[worker.id]
        }))
      });
      return;
    }
    if (url.pathname === "/api/workers" && method !== "GET") {
      probe.workerMutationCount += 1;
      if (method === "POST" && scenario.workspaceSaveWorkpackId) {
        await fulfillJson(route, {
          ok: true,
          configured: true,
          workerMap: Object.fromEntries(scenario.workers.map((worker, index) => [
            worker.id,
            serverWorkerId(index)
          ])),
          message: "작업자 명단을 저장했습니다."
        });
        return;
      }
      await fulfillJson(route, { ok: false, message: "Worker mutation is forbidden in Share." }, 409);
      return;
    }
    if (url.pathname === "/api/education-records" && method === "POST" && scenario.workspaceSaveWorkpackId) {
      await fulfillJson(route, {
        ok: true,
        configured: true,
        savedCount: scenario.workers.length,
        message: "교육 기록을 저장했습니다."
      });
      return;
    }
    if (url.pathname === "/api/settings/channels/resolve" && method === "POST") {
      probe.channelRequestCount += 1;
      if (scenario.channelMode === "deferred") {
        deferredChannelRoute = route;
        return;
      }
      const requestDto = parseChannelResolutionRequest(body);
      if (!requestDto) {
        await fulfillJson(route, { ok: false, message: "Invalid channel resolver DTO" }, 400);
        return;
      }
      const requestedChannels = requestDto.requestedChannels;
      if (scenario.channelMode === "stale") {
        await fulfillJson(route, {
          ok: false,
          ready: false,
          state: "stale",
          reasonCode: scenario.staleReasonCode,
          message: "Share resolver binding changed before session creation."
        }, 409);
        return;
      }
      const unavailable = scenario.channelMode === "unavailable";
      await fulfillJson(route, {
        ok: true,
        version: "channel-availability/v1",
        ready: !unavailable,
        workpackId: requestDto.workpackId,
        canonicalWorkpackRevision: body.canonicalWorkpackRevision,
        requestedChannels,
        availabilityToken: SHARE_AVAILABILITY_TOKEN,
        expiresAt: "2099-07-14T00:00:00.000Z",
        channels: requestedChannels.map((channel) => ({
          channel,
          available: !unavailable,
          reasonCode: unavailable ? "channel_not_configured" : "ready"
        }))
      });
      return;
    }
    if (url.pathname === `/api/workpacks/${SHARE_WORKPACK_ID}/share-sessions` && method === "POST") {
      probe.sessionRequestCount += 1;
      if (scenario.sessionMode === "deferred") {
        deferredSessionRoute = route;
        return;
      }
      if (scenario.sessionMode === "failure") {
        await fulfillJson(route, { ok: false, message: "초대 세션 생성 실패" }, 503);
        return;
      }
      await fulfillSessionSuccess(route);
      return;
    }
    if (url.pathname === "/api/workflow/dispatch" && method === "POST") {
      probe.dispatchRequestCount += 1;
      if (scenario.dispatchMode === "stale") {
        await fulfillJson(route, {
          ok: false,
          reasonCode: scenario.staleReasonCode,
          message: "Share server binding changed before provider dispatch.",
          providerCalled: false
        }, 409);
        return;
      }
      probe.providerDispatchCount += 1;
      if (scenario.deferDispatch) {
        deferredDispatchRoute = { route, body };
        return;
      }
      await fulfillDispatchResult(route, body);
      return;
    }
    if (url.pathname === "/api/dispatch-logs" && method === "POST") {
      probe.dispatchLogRequestCount += 1;
      probe.unexpectedRequests.push(`${method} ${url.pathname}`);
      await fulfillJson(route, { ok: false, reasonCode: "server_dispatch_receipt_required" }, 409);
      return;
    }

    probe.unexpectedRequests.push(`${method} ${url.pathname}`);
    await fulfillJson(route, { ok: false, message: "Unexpected Share v2 browser request" }, 500);
  });

  return {
    probe,
    releaseChannelUnavailable: async () => {
      if (!deferredChannelRoute) throw new Error("No deferred channel route is waiting");
      const body = requestBody(deferredChannelRoute.request());
      const requestDto = parseChannelResolutionRequest(body);
      if (!requestDto) throw new Error("Deferred channel resolver DTO is invalid");
      const requestedChannels = requestDto.requestedChannels;
      const route = deferredChannelRoute;
      deferredChannelRoute = null;
      scenario.channelMode = "unavailable";
      await fulfillJson(route, {
        ok: true,
        version: "channel-availability/v1",
        ready: false,
        workpackId: SHARE_WORKPACK_ID,
        canonicalWorkpackRevision: body.canonicalWorkpackRevision,
        requestedChannels,
        availabilityToken: SHARE_AVAILABILITY_TOKEN,
        expiresAt: "2099-07-14T00:00:00.000Z",
        channels: requestedChannels.map((channel) => ({
          channel,
          available: false,
          reasonCode: "channel_not_configured"
        }))
      });
    },
    releaseSessionFailure: async () => {
      if (!deferredSessionRoute) return;
      const route = deferredSessionRoute;
      deferredSessionRoute = null;
      await fulfillJson(route, { ok: false, message: "Deferred session closed by test" }, 503);
    },
    releaseSessionSuccess: async () => {
      if (!deferredSessionRoute) throw new Error("No deferred session route is waiting");
      const route = deferredSessionRoute;
      deferredSessionRoute = null;
      await fulfillSessionSuccess(route);
    },
    releaseDispatch: async () => {
      if (!deferredDispatchRoute) throw new Error("No deferred dispatch route is waiting");
      const deferred = deferredDispatchRoute;
      deferredDispatchRoute = null;
      await fulfillDispatchResult(deferred.route, deferred.body);
    }
  };
}

async function openSharePage(
  environment: ShareEnvironment,
  scenario: ShareScenario,
  initialPath = `/workspace?step=share&theme=${environment.theme}`,
  waitForRoot = true
): Promise<OpenSharePage> {
  if (!browser || !harness) throw new Error("Share v2 browser harness was not started");
  const context = await browser.newContext({
    viewport: environment.viewport,
    deviceScaleFactor: 1
  });
  const page = await context.newPage();
  const browserDiagnostics: string[] = [];
  page.on("console", (message) => browserDiagnostics.push(`console:${message.type()}:${message.text()}`));
  page.on("pageerror", (error) => browserDiagnostics.push(`pageerror:${error.message}`));
  const stored = buildStoredShareWorkpack({
    response: scenario.response,
    workers: scenario.workers,
    selectedWorkerIds: scenario.selectedWorkerIds
  });
  await page.addInitScript(({ authKey, authSession, authenticated, storageKey, workpack }) => {
    window.localStorage.setItem(storageKey, workpack);
    if (authenticated) window.localStorage.setItem(authKey, JSON.stringify(authSession));
    else window.localStorage.removeItem(authKey);
  }, {
    authKey: SHARE_AUTH_STORAGE_KEY,
    authSession: SHARE_AUTH_SESSION,
    authenticated: scenario.authenticated,
    storageKey: CURRENT_WORKPACK_STORAGE_KEY,
    workpack: JSON.stringify(stored)
  });
  const controller = await installNetworkFixtures(page, scenario);
  await page.goto(`${harness.baseUrl}${initialPath}`, { waitUntil: "domcontentloaded" });
  if (!waitForRoot) return { context, page, controller };
  try {
    await page.locator("[data-share-root]").waitFor({ state: "visible", timeout: 30_000 });
  } catch (error) {
    const bodyText = (await page.locator("body").innerText().catch(() => "<body unavailable>"))
      .slice(0, 4_000);
    console.error("Share v2 page failed to render", {
      url: page.url(),
      bodyText,
      browserDiagnostics,
      serverOutput: harness.readServerOutput()
    });
    throw error;
  }
  return { context, page, controller };
}

async function waitForShareState(page: Page, state: string, timeoutMs = 30_000): Promise<void> {
  await page.locator(`[data-share-root][data-share-state='${state}']`).waitFor({
    state: "visible",
    timeout: timeoutMs
  });
}

async function waitForProbe(
  predicate: () => boolean,
  label: string,
  timeoutMs = 15_000
): Promise<void> {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    if (predicate()) return;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error(`Timed out waiting for Share v2 probe: ${label}`);
}

async function primaryLabel(page: Page): Promise<string> {
  const primary = page.locator("[data-share-primary]");
  expect(await primary.count()).toBe(1);
  expect(await primary.isVisible()).toBe(true);
  return (await primary.textContent())?.trim() || "";
}

async function primaryHref(page: Page): Promise<string | null> {
  return await page.locator("[data-share-primary]").getAttribute("href");
}

function findRequest(probe: ShareNetworkProbe, path: string, method = "POST"): RequestRecord | undefined {
  return probe.requests.find((request) => request.method === method && request.path === path);
}

function expectSessionBinding(scenario: ShareScenario, probe: ShareNetworkProbe): void {
  const request = findRequest(probe, `/api/workpacks/${SHARE_WORKPACK_ID}/share-sessions`);
  const channelRequests = probe.requests.filter((candidate) => (
    candidate.method === "POST" && candidate.path === "/api/settings/channels/resolve"
  ));
  const requestedChannels = channelRequests.at(-1)?.body.requestedChannels;
  const authority = scenario.shareLocalization;
  const canonicalWorkpackRevision = isRecord(authority)
    ? authority.canonicalWorkpackRevision
    : undefined;
  expect(request?.authorization).toBe(`Bearer ${SHARE_ACCESS_TOKEN}`);
  expect(request?.body).toEqual({
    recipients: [serverWorkerId(0)],
    channels: requestedChannels,
    canonicalWorkpackRevision,
    availabilityToken: SHARE_AVAILABILITY_TOKEN
  });
}

function expectDispatchBinding(probe: ShareNetworkProbe): void {
  const request = findRequest(probe, "/api/workflow/dispatch");
  const sessionRequest = findRequest(probe, `/api/workpacks/${SHARE_WORKPACK_ID}/share-sessions`);
  expect(request?.authorization).toBe(`Bearer ${SHARE_ACCESS_TOKEN}`);
  expect(request?.body).toMatchObject({
    workpackId: SHARE_WORKPACK_ID,
    shareSessionId: SHARE_SESSION_ID,
    channels: sessionRequest?.body.channels,
    operatorNote: ""
  });
  expect(request?.body.idempotencyKey).toBe(BROWSER_IDEMPOTENCY_KEY);
  expect(JSON.stringify(request?.body)).not.toMatch(/publicUrl|workerForm|translationFallback/iu);
}

function expectRequestOrder(probe: ShareNetworkProbe): void {
  const paths = probe.requests.filter((request) => request.method === "POST").map((request) => request.path);
  const channelIndex = paths.indexOf("/api/settings/channels/resolve");
  const sessionIndex = paths.indexOf(`/api/workpacks/${SHARE_WORKPACK_ID}/share-sessions`);
  const dispatchIndex = paths.indexOf("/api/workflow/dispatch");
  expect(channelIndex).toBeGreaterThanOrEqual(0);
  expect(sessionIndex).toBeGreaterThan(channelIndex);
  expect(dispatchIndex).toBeGreaterThan(sessionIndex);
  expect(paths).not.toContain("/api/dispatch-logs");
}

async function expectCommonProductSurface(page: Page): Promise<void> {
  expect(await page.locator("[data-share-primary]").count()).toBe(1);
  expect(await page.locator("[data-share-title]").count()).toBe(1);
  expect(await page.locator("[data-share-preview]").count()).toBeLessThanOrEqual(1);
  expect(await page.locator("select").count()).toBe(1);
  expect(await page.locator("select option").count()).toBe(12);
  const text = await page.locator("[data-share-root]").innerText();
  expect(text).not.toMatch(/Before\/After|개선 기록|열람 확인|공유 설정 보기|열람 권한/iu);
  expect(text).not.toMatch(/[⚠🧱🌬🚧]/u);
  expect(await page.getByText("로그인하고 전송", { exact: true }).count()).toBeLessThanOrEqual(1);
}

async function readGeometryMetrics(page: Page): Promise<GeometryMetrics> {
  return await page.locator("[data-share-root]").evaluate((root) => {
    const isVisible = (element: Element): element is HTMLElement => {
      if (!(element instanceof HTMLElement)) return false;
      const style = getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return style.display !== "none"
        && style.visibility !== "hidden"
        && !(style.clip !== "auto" && rect.width <= 1 && rect.height <= 1)
        && Number.parseFloat(style.opacity || "1") > 0
        && rect.width > 0
        && rect.height > 0;
    };
    const label = (element: HTMLElement): string => (
      element.getAttribute("aria-label")
      || element.textContent?.trim().slice(0, 80)
      || element.tagName.toLowerCase()
    );
    const rectForTarget = (element: HTMLElement): DOMRect => {
      if (element instanceof HTMLInputElement && element.type === "checkbox") {
        const hitLabel = element.closest("label");
        if (hitLabel instanceof HTMLElement) return hitLabel.getBoundingClientRect();
      }
      return element.getBoundingClientRect();
    };
    const interactables = Array.from(
      root.querySelectorAll<HTMLElement>("a[href], button, input, select, textarea")
    ).filter(isVisible);
    const targets = interactables.map((element) => ({
      element,
      label: label(element),
      rect: rectForTarget(element)
    }));
    const touchTargetFailures = targets.flatMap((target) => (
      target.rect.width + 0.5 < 44 || target.rect.height + 0.5 < 44
        ? [`${target.label}:${target.rect.width.toFixed(1)}x${target.rect.height.toFixed(1)}`]
        : []
    ));
    const overlapFailures: string[] = [];
    const interactiveGapFailures: string[] = [];
    for (let leftIndex = 0; leftIndex < targets.length; leftIndex += 1) {
      for (let rightIndex = leftIndex + 1; rightIndex < targets.length; rightIndex += 1) {
        const left = targets[leftIndex];
        const right = targets[rightIndex];
        if (
          left.element.contains(right.element)
          || right.element.contains(left.element)
          || left.element.closest("label") === right.element.closest("label")
        ) continue;
        const overlapWidth = Math.min(left.rect.right, right.rect.right) - Math.max(left.rect.left, right.rect.left);
        const overlapHeight = Math.min(left.rect.bottom, right.rect.bottom) - Math.max(left.rect.top, right.rect.top);
        if (overlapWidth > 1 && overlapHeight > 1) {
          overlapFailures.push(`${left.label} <> ${right.label}`);
          continue;
        }
        const horizontalGap = Math.max(0, left.rect.left - right.rect.right, right.rect.left - left.rect.right);
        const verticalGap = Math.max(0, left.rect.top - right.rect.bottom, right.rect.top - left.rect.bottom);
        const axisGap = horizontalGap === 0 ? verticalGap : verticalGap === 0 ? horizontalGap : Number.POSITIVE_INFINITY;
        if (axisGap > 0 && axisGap < 8) {
          interactiveGapFailures.push(`${left.label} <> ${right.label}:${axisGap.toFixed(1)}`);
        }
      }
    }
    const visibleElements = [root, ...Array.from(root.querySelectorAll("*"))].filter(isVisible);
    const nestedScrollFailures = visibleElements.flatMap((element) => {
      const style = getComputedStyle(element);
      const scrolls = (
        (style.overflowY === "auto" || style.overflowY === "scroll")
        && element.scrollHeight > element.clientHeight + 1
      ) || (
        (style.overflowX === "auto" || style.overflowX === "scroll")
        && element.scrollWidth > element.clientWidth + 1
      );
      if (!scrolls) return [];
      return [label(element)];
    });
    const clippedTextFailures = visibleElements.flatMap((element) => {
      const hasDirectText = Array.from(element.childNodes).some((node) => (
        node.nodeType === Node.TEXT_NODE && Boolean(node.textContent?.trim())
      ));
      if (!hasDirectText) return [];
      const style = getComputedStyle(element);
      const clipsX = style.overflowX === "hidden" || style.overflowX === "clip";
      const clipsY = style.overflowY === "hidden" || style.overflowY === "clip";
      if (
        (clipsX && element.scrollWidth > element.clientWidth + 1)
        || (clipsY && element.scrollHeight > element.clientHeight + 1)
      ) return [label(element)];
      return [];
    });
    const panelRect = root.getBoundingClientRect();
    const preview = root.querySelector<HTMLElement>("[data-share-preview]");
    const previewHeight = preview?.getBoundingClientRect().height || 0;
    const sectionOwners = ["targets", "channels", "language-preview", "memo", "primary-action"]
      .map((owner) => root.querySelector(`[data-share-owner='${owner}']`))
      .filter((element): element is Element => element !== null);
    const domOrderValid = sectionOwners.every((element, index) => (
      index === 0
      || Boolean(sectionOwners[index - 1].compareDocumentPosition(element) & Node.DOCUMENT_POSITION_FOLLOWING)
    ));
    return {
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight,
      documentWidth: document.documentElement.scrollWidth,
      horizontalOverflow: Math.max(0, document.documentElement.scrollWidth - window.innerWidth),
      panelOverflow: Math.max(0, -panelRect.left, panelRect.right - window.innerWidth),
      previewHeight,
      previewHeightLimit: Math.min(window.innerHeight * 0.34, 320),
      touchTargetCount: targets.length,
      touchTargetFailures,
      overlapFailures,
      interactiveGapFailures,
      nestedScrollFailures,
      clippedTextFailures,
      domOrderValid
    };
  });
}

function expectCleanGeometry(metrics: GeometryMetrics): void {
  expect(metrics.touchTargetCount).toBeGreaterThan(0);
  expect(metrics.horizontalOverflow).toBe(0);
  expect(metrics.panelOverflow).toBe(0);
  expect(metrics.touchTargetFailures).toEqual([]);
  expect(metrics.overlapFailures).toEqual([]);
  expect(metrics.interactiveGapFailures).toEqual([]);
  expect(metrics.nestedScrollFailures).toEqual([]);
  expect(metrics.clippedTextFailures).toEqual([]);
  expect(metrics.domOrderValid).toBe(true);
}

function auditTextScaleDelivery(input: TextScaleDeliveryAudit): { ok: boolean; reasons: string[] } {
  const reasons = [
    ...(input.rootAttributeMutationCount === 1 ? [] : ["root mechanism must be applied exactly once"]),
    ...(input.descendantStyleMutationCount === 0 ? [] : ["descendant style mutation is synthetic"]),
    ...(input.directLeafInlineMutationCount === 0 ? [] : ["leaf font mutation is synthetic"])
  ];
  return { ok: reasons.length === 0, reasons };
}

async function applyRootTextScale(page: Page): Promise<RootTextScaleMetrics> {
  return await page.locator("[data-share-root]").evaluate(async (root) => {
    const isVisible = (element: Element): element is HTMLElement => {
      if (!(element instanceof HTMLElement)) return false;
      const style = getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return style.display !== "none"
        && style.visibility !== "hidden"
        && !(style.clip !== "auto" && rect.width <= 1 && rect.height <= 1)
        && Number.parseFloat(style.opacity || "1") > 0
        && rect.width > 0
        && rect.height > 0;
    };
    const label = (element: HTMLElement): string => (
      element.getAttribute("aria-label")
      || element.textContent?.trim().slice(0, 60)
      || element.tagName.toLowerCase()
    );
    const visibleBefore = [root, ...Array.from(root.querySelectorAll("*"))].filter(isVisible);
    const interactables = visibleBefore.filter((element) => (
      element.matches("a[href], button, select, textarea")
      || (element instanceof HTMLInputElement && element.type !== "checkbox")
    ));
    const textLeaves = visibleBefore.filter((element) => Array.from(element.childNodes).some((node) => (
      node.nodeType === Node.TEXT_NODE && Boolean(node.textContent?.trim())
    )));
    const representatives = Array.from(new Set([...interactables, ...textLeaves]));
    const descendants = Array.from(root.querySelectorAll<HTMLElement>("*"));
    const inlineBefore = new Map(descendants.map((element) => [element, {
      fontSize: element.style.getPropertyValue("font-size"),
      lineHeight: element.style.getPropertyValue("line-height")
    }]));
    const rootAttributeBefore = root.getAttribute("data-share-text-scale");
    const rootFontBefore = Number.parseFloat(getComputedStyle(root).fontSize);
    const documentRootFontBefore = Number.parseFloat(getComputedStyle(document.documentElement).fontSize);
    const baselines = representatives.map((element) => {
      const style = getComputedStyle(element);
      return {
        element,
        fontSize: Number.parseFloat(style.fontSize),
        lineHeight: Number.parseFloat(style.lineHeight)
      };
    });
    const previewCandidates = Array.from(root.querySelectorAll<HTMLElement>("[data-share-preview] p"))
      .filter(isVisible)
      .sort((left, right) => (right.textContent?.length || 0) - (left.textContent?.length || 0));
    const previewText = previewCandidates[0] || null;
    const previewBaselineStyle = previewText ? getComputedStyle(previewText) : null;
    const previewBaselineLineHeight = previewBaselineStyle
      ? Number.parseFloat(previewBaselineStyle.lineHeight)
      : 0;
    const previewHeightBefore = previewText?.getBoundingClientRect().height || 0;
    const previewLinesBefore = previewBaselineLineHeight > 0
      ? Math.max(1, Math.round(previewHeightBefore / previewBaselineLineHeight))
      : 0;
    const previewGrowthRequired = (previewText?.textContent?.trim().length || 0) >= 80;
    const pseudoBaselines = visibleBefore.flatMap((element) => (["::before", "::after"] as const).map((pseudo) => {
      const style = getComputedStyle(element, pseudo);
      return {
        element,
        pseudo,
        content: style.content,
        fontSize: Number.parseFloat(style.fontSize),
        lineHeight: Number.parseFloat(style.lineHeight)
      };
    }));
    const rootRectBefore = root.getBoundingClientRect();
    const mobileMediaQueryBefore = matchMedia("(max-width: 767px)").matches;
    const compactContainerBefore = rootRectBefore.width <= 560;
    const mutations: MutationRecord[] = [];
    const observer = new MutationObserver((records) => mutations.push(...records));
    observer.observe(root, {
      attributes: true,
      attributeFilter: ["data-share-text-scale", "style"],
      subtree: true
    });
    root.setAttribute("data-share-text-scale", "200");
    await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
    mutations.push(...observer.takeRecords());
    observer.disconnect();
    const visibleAfter = [root, ...Array.from(root.querySelectorAll("*"))].filter(isVisible);
    const fontRatioFailures: string[] = [];
    const lineHeightRatioFailures: string[] = [];
    for (const baseline of baselines) {
      const style = getComputedStyle(baseline.element);
      const fontRatio = Number.parseFloat(style.fontSize) / baseline.fontSize;
      if (fontRatio < 1.9 || fontRatio > 2.1) {
        fontRatioFailures.push(`${label(baseline.element)}:${fontRatio.toFixed(2)}`);
      }
      if (Number.isFinite(baseline.lineHeight) && baseline.lineHeight > 0) {
        const lineRatio = Number.parseFloat(style.lineHeight) / baseline.lineHeight;
        if (lineRatio < 1.9 || lineRatio > 2.1) {
          lineHeightRatioFailures.push(`${label(baseline.element)}:${lineRatio.toFixed(2)}`);
        }
      }
    }
    const pseudoFontRatioFailures: string[] = [];
    const pseudoLineHeightRatioFailures: string[] = [];
    for (const baseline of pseudoBaselines) {
      const style = getComputedStyle(baseline.element, baseline.pseudo);
      const fontRatio = Number.parseFloat(style.fontSize) / baseline.fontSize;
      if (!Number.isFinite(fontRatio) || fontRatio < 1.9 || fontRatio > 2.1) {
        pseudoFontRatioFailures.push(`${label(baseline.element)}${baseline.pseudo}:${fontRatio.toFixed(2)}`);
      }
      if (Number.isFinite(baseline.lineHeight) && baseline.lineHeight > 0) {
        const lineRatio = Number.parseFloat(style.lineHeight) / baseline.lineHeight;
        if (!Number.isFinite(lineRatio) || lineRatio < 1.9 || lineRatio > 2.1) {
          pseudoLineHeightRatioFailures.push(`${label(baseline.element)}${baseline.pseudo}:${lineRatio.toFixed(2)}`);
        }
      }
    }
    const directLeafInlineMutationCount = descendants.filter((element) => {
      const before = inlineBefore.get(element);
      return before?.fontSize !== element.style.getPropertyValue("font-size")
        || before?.lineHeight !== element.style.getPropertyValue("line-height");
    }).length;
    const descendantStyleMutationCount = mutations.filter((mutation) => (
      mutation.type === "attributes"
      && mutation.attributeName === "style"
      && mutation.target !== root
    )).length;
    const rootAttributeMutationCount = mutations.filter((mutation) => (
      mutation.type === "attributes"
      && mutation.attributeName === "data-share-text-scale"
      && mutation.target === root
    )).length;
    const pathScaleFailures: string[] = [];
    const inspectedAncestors = new Set<HTMLElement>();
    for (const representative of representatives) {
      let current: HTMLElement | null = representative;
      while (current) {
        if (!inspectedAncestors.has(current)) {
          inspectedAncestors.add(current);
          const style = getComputedStyle(current);
          const zoom = style.getPropertyValue("zoom").trim();
          if (style.transform !== "none" || (zoom && zoom !== "1" && zoom !== "normal")) {
            pathScaleFailures.push(`${label(current)}:${style.transform}:${zoom || "1"}`);
          }
        }
        current = current.parentElement;
      }
    }
    const previewAfterStyle = previewText ? getComputedStyle(previewText) : null;
    const previewAfterLineHeight = previewAfterStyle ? Number.parseFloat(previewAfterStyle.lineHeight) : 0;
    const previewHeightAfter = previewText?.getBoundingClientRect().height || 0;
    const previewLinesAfter = previewAfterLineHeight > 0
      ? Math.max(1, Math.round(previewHeightAfter / previewAfterLineHeight))
      : 0;
    const ownerMissingCount = visibleBefore.filter((element) => !element.closest("[data-share-owner]")).length;
    const regionMissingCount = visibleBefore.filter((element) => (
      !element.closest("[data-share-root]")
      || (!element.closest("[data-share-region='body']") && !element.closest("[data-share-region='preview']") && !element.closest("[data-share-owner]"))
    )).length;
    const rootRectAfter = root.getBoundingClientRect();
    return {
      baselineCapturedBeforeMutation: baselines.length > 0,
      rootAttributeBefore,
      rootAttributeAfter: root.getAttribute("data-share-text-scale"),
      rootAttributeMutationCount,
      descendantStyleMutationCount,
      directLeafInlineMutationCount,
      visibleCountBefore: visibleBefore.length,
      visibleCountAfter: visibleAfter.length,
      interactableCount: interactables.length,
      textLeafCount: textLeaves.length,
      representativeCount: representatives.length,
      uniqueRepresentativeCount: new Set(representatives).size,
      bodyRegionCount: root.querySelectorAll("[data-share-region='body']").length,
      previewRegionCount: root.querySelectorAll("[data-share-region='preview']").length,
      ownerMissingCount,
      regionMissingCount,
      fontRatioFailures,
      lineHeightRatioFailures,
      pathScaleFailures,
      pseudoElementInspectionCount: pseudoBaselines.length,
      generatedPseudoElementCount: pseudoBaselines.filter((baseline) => (
        baseline.content !== "none"
        && baseline.content !== "normal"
        && baseline.content !== ""
        && baseline.content !== "\"\""
      )).length,
      pseudoFontRatioFailures,
      pseudoLineHeightRatioFailures,
      mobileMediaQueryBefore,
      mobileMediaQueryAfter: matchMedia("(max-width: 767px)").matches,
      compactContainerBefore,
      compactContainerAfter: rootRectAfter.width <= 560,
      rootWidthBefore: rootRectBefore.width,
      rootWidthAfter: rootRectAfter.width,
      rootHeightBefore: rootRectBefore.height,
      rootHeightAfter: rootRectAfter.height,
      rootFontBefore,
      rootFontAfter: Number.parseFloat(getComputedStyle(root).fontSize),
      documentRootFontBefore,
      documentRootFontAfter: Number.parseFloat(getComputedStyle(document.documentElement).fontSize),
      deviceScaleFactor: window.devicePixelRatio,
      devicePixelRatio: window.devicePixelRatio,
      visualViewportScale: window.visualViewport?.scale || 1,
      cssViewportWidth: window.innerWidth,
      previewLinesBefore,
      previewLinesAfter,
      previewHeightBefore,
      previewHeightAfter,
      previewGrowthRequired
    };
  });
}

function expectRootTextScaleContract(metrics: RootTextScaleMetrics, viewportWidth: number): void {
  expect(metrics.baselineCapturedBeforeMutation).toBe(true);
  expect(metrics.rootAttributeBefore).toBe("100");
  expect(metrics.rootAttributeAfter).toBe("200");
  expect(auditTextScaleDelivery(metrics)).toEqual({ ok: true, reasons: [] });
  expect(metrics.visibleCountBefore).toBeGreaterThan(0);
  expect(metrics.visibleCountAfter).toBe(metrics.visibleCountBefore);
  expect(metrics.interactableCount).toBeGreaterThan(0);
  expect(metrics.textLeafCount).toBeGreaterThan(0);
  expect(metrics.representativeCount).toBe(metrics.uniqueRepresentativeCount);
  expect(metrics.bodyRegionCount).toBe(1);
  expect(metrics.previewRegionCount).toBeLessThanOrEqual(1);
  expect(metrics.ownerMissingCount).toBe(0);
  expect(metrics.regionMissingCount).toBe(0);
  expect(metrics.fontRatioFailures).toEqual([]);
  expect(metrics.lineHeightRatioFailures).toEqual([]);
  expect(metrics.pathScaleFailures).toEqual([]);
  expect(metrics.pseudoElementInspectionCount).toBeGreaterThan(0);
  expect(metrics.generatedPseudoElementCount).toBeGreaterThanOrEqual(0);
  expect(metrics.pseudoFontRatioFailures).toEqual([]);
  expect(metrics.pseudoLineHeightRatioFailures).toEqual([]);
  expect(metrics.mobileMediaQueryAfter).toBe(metrics.mobileMediaQueryBefore);
  expect(metrics.mobileMediaQueryAfter).toBe(viewportWidth <= 767);
  expect(metrics.compactContainerAfter).toBe(metrics.compactContainerBefore);
  expect(metrics.rootWidthAfter).toBeCloseTo(metrics.rootWidthBefore, 1);
  expect(metrics.rootHeightAfter).toBeGreaterThan(metrics.rootHeightBefore);
  expect(metrics.rootFontAfter / metrics.rootFontBefore).toBeCloseTo(2, 1);
  expect(metrics.documentRootFontAfter).toBeCloseTo(metrics.documentRootFontBefore, 3);
  expect(metrics.deviceScaleFactor).toBe(1);
  expect(metrics.devicePixelRatio).toBe(1);
  expect(metrics.visualViewportScale).toBe(1);
  expect(metrics.cssViewportWidth).toBe(viewportWidth);
  if (metrics.previewGrowthRequired) {
    expect(metrics.previewLinesAfter).toBeGreaterThan(metrics.previewLinesBefore);
    expect(metrics.previewHeightAfter).toBeGreaterThan(metrics.previewHeightBefore);
  }
}

const languageScriptPatterns: Record<SupportedLanguageCode, RegExp> = {
  ko: /[가-힣]/u,
  vi: /[A-Za-z]/u,
  zh: /\p{Script=Han}/u,
  th: /\p{Script=Thai}/u,
  uz: /[A-Za-z]/u,
  mn: /\p{Script=Cyrillic}/u,
  ne: /\p{Script=Devanagari}/u,
  km: /\p{Script=Khmer}/u,
  id: /[A-Za-z]/u,
  my: /\p{Script=Myanmar}/u,
  tl: /[A-Za-z]/u,
  en: /[A-Za-z]/u
};

async function expectLocalizedPreview(page: Page, locale: SupportedLanguageCode): Promise<void> {
  const preview = page.locator("[data-share-preview]");
  expect(await preview.count()).toBe(1);
  expect(await preview.getAttribute("lang")).toBe(locale);
  expect(await preview.locator("strong").first().count()).toBe(1);
  expect(await preview.locator("dt").count()).toBe(3);
  expect(await preview.locator("dd").count()).toBe(3);
  expect(await preview.locator("p").count()).toBeGreaterThan(0);
  expect(await preview.locator("li").count()).toBeGreaterThan(0);
  const text = (await preview.innerText()).trim();
  expect(text.length).toBeGreaterThan(0);
  expect(text).toMatch(languageScriptPatterns[locale]);
  if (locale !== "ko") expect(text).not.toMatch(/[가-힣]/u);
  const semanticLeaves = await preview.locator("strong, dt, dd, p, li").allTextContents();
  expect(semanticLeaves.filter((leaf) => (
    /^\s*[\p{Extended_Pictographic}\uFE0F\s]+\s*$/u.test(leaf)
  ))).toEqual([]);
}

async function verifyAllLanguageAuthority(environment: ShareEnvironment): Promise<number> {
  const manualScenario = buildScenario("ready");
  const manual = await openSharePage(environment, manualScenario);
  try {
    await waitForShareState(manual.page, "ready");
    const select = manual.page.locator("select");
    const authorityRequestCount = manual.controller.probe.requests.length;
    const channelRequestCount = manual.controller.probe.channelRequestCount;
    for (const locale of SUPPORTED_LANGUAGE_CODES) {
      await select.selectOption(locale);
      expect(await select.inputValue()).toBe(locale);
      await expectLocalizedPreview(manual.page, locale);
      expect(manual.controller.probe.sessionRequestCount).toBe(0);
      expect(manual.controller.probe.dispatchRequestCount).toBe(0);
    }
    expect(manual.controller.probe.requests.length).toBe(authorityRequestCount);
    expect(manual.controller.probe.channelRequestCount).toBe(channelRequestCount);
    const serverWorkerRequest = manual.controller.probe.requests.find((request) => (
      request.method === "GET" && request.path.startsWith("/api/workers?")
    ));
    expect(serverWorkerRequest?.authorization).toBe(`Bearer ${SHARE_ACCESS_TOKEN}`);
  } finally {
    await closeSharePage(manual);
  }

  for (const locale of SUPPORTED_LANGUAGE_CODES) {
    const automaticScenario = buildScenario("ready");
    const worker = buildShareWorker(locale);
    automaticScenario.workers = [worker];
    automaticScenario.selectedWorkerIds = [worker.id];
    automaticScenario.serverLanguageCodes = { [worker.id]: locale };
    const automatic = await openSharePage(environment, automaticScenario);
    try {
      await waitForShareState(automatic.page, "ready");
      expect(await automatic.page.locator("select").inputValue()).toBe(locale);
      await expectLocalizedPreview(automatic.page, locale);
      expect(automatic.controller.probe.sessionRequestCount).toBe(0);
      expect(automatic.controller.probe.dispatchRequestCount).toBe(0);
    } finally {
      await closeSharePage(automatic);
    }
  }
  return SUPPORTED_LANGUAGE_CODES.length * 2;
}

function configureRawWorkerLocale(
  scenario: ShareScenario,
  selectedLocale: string,
  serverLocale = selectedLocale
): void {
  const worker = {
    ...buildShareWorker("vi"),
    languageCode: selectedLocale,
    languageLabel: selectedLocale || "미입력"
  };
  scenario.workers = [worker];
  scenario.selectedWorkerIds = [worker.id];
  scenario.serverLanguageCodes = { [worker.id]: serverLocale };
}

function mutateVietnameseEnvelope(
  scenario: ShareScenario,
  mutation: (envelope: JsonRecord, localization: JsonRecord) => void
): void {
  const localization = structuredClone(scenario.shareLocalization);
  if (!isRecord(localization) || !isRecord(localization.reviewedEnvelopes)) {
    throw new Error("Share v2 Vietnamese review fixture has no reviewed envelope map");
  }
  const envelope = localization.reviewedEnvelopes.vi;
  if (!isRecord(envelope)) throw new Error("Share v2 Vietnamese review fixture envelope is missing");
  mutation(envelope, localization);
  scenario.shareLocalization = localization;
}

async function verifyReviewRequiredVariants(environment: ShareEnvironment): Promise<number> {
  const variants: Array<{
    id: string;
    expectedLabel: string;
    owner: "worker" | "translation";
    configure: (scenario: ShareScenario) => void;
  }> = [
    {
      id: "locale_missing",
      expectedLabel: "작업자 언어 확인",
      owner: "worker",
      configure: (scenario) => configureRawWorkerLocale(scenario, "")
    },
    {
      id: "locale_unsupported",
      expectedLabel: "작업자 언어 확인",
      owner: "worker",
      configure: (scenario) => configureRawWorkerLocale(scenario, "xx")
    },
    {
      id: "locale_malformed",
      expectedLabel: "작업자 언어 확인",
      owner: "worker",
      configure: (scenario) => configureRawWorkerLocale(scenario, "vi-VN")
    },
    {
      id: "locale_conflicting",
      expectedLabel: "작업자 언어 확인",
      owner: "worker",
      configure: (scenario) => configureRawWorkerLocale(scenario, "vi", "en")
    },
    {
      id: "translation_missing",
      expectedLabel: "번역본 보완",
      owner: "translation",
      configure: (scenario) => mutateVietnameseEnvelope(scenario, (_envelope, localization) => {
        if (!isRecord(localization.reviewedEnvelopes)) {
          throw new Error("Share v2 localization fixture is not mutable");
        }
        delete localization.reviewedEnvelopes.vi;
      })
    },
    {
      id: "translation_partial",
      expectedLabel: "번역본 보완",
      owner: "translation",
      configure: (scenario) => mutateVietnameseEnvelope(scenario, (envelope) => {
        if (!isRecord(envelope.artifact)) throw new Error("Share v2 artifact fixture is missing");
        if (!isRecord(envelope.artifact.localized)) {
          throw new Error("Share v2 localized artifact fixture is missing");
        }
        envelope.artifact.localized.bodyLines = [];
      })
    },
    {
      id: "translation_stale",
      expectedLabel: "번역본 보완",
      owner: "translation",
      configure: (scenario) => {
        scenario.shareLocalization = {
          ok: false,
          reasonCode: "translation_incomplete",
          validatedSupportedCode: "vi"
        };
      }
    },
    {
      id: "translation_conflicting",
      expectedLabel: "번역본 보완",
      owner: "translation",
      configure: (scenario) => mutateVietnameseEnvelope(scenario, (envelope) => {
        envelope.targetLocale = "en";
      })
    },
    {
      id: "translation_unreviewed",
      expectedLabel: "번역본 검토",
      owner: "translation",
      configure: (scenario) => mutateVietnameseEnvelope(scenario, (envelope) => {
        if (!isRecord(envelope.review)) throw new Error("Share v2 review fixture is missing");
        envelope.review.state = "pending";
      })
    },
    {
      id: "translation_rejected",
      expectedLabel: "번역본 수정",
      owner: "translation",
      configure: (scenario) => mutateVietnameseEnvelope(scenario, (envelope) => {
        if (!isRecord(envelope.review)) throw new Error("Share v2 review fixture is missing");
        envelope.review.state = "rejected";
      })
    }
  ];

  for (const variant of variants) {
    const scenario = buildScenario("review_required");
    variant.configure(scenario);
    const opened = await openSharePage(environment, scenario);
    try {
      try {
        await waitForShareState(opened.page, "review_required", 8_000);
      } catch (error) {
        const actualState = await opened.page.locator("[data-share-root]").getAttribute("data-share-state");
        const actualPrimary = await opened.page.locator("[data-share-primary]").textContent();
        throw new Error(
          `Review variant ${variant.id} did not fail closed: state=${actualState || "missing"}, primary=${actualPrimary?.trim() || "missing"}, channel=${opened.controller.probe.channelRequestCount}, session=${opened.controller.probe.sessionRequestCount}, dispatch=${opened.controller.probe.dispatchRequestCount}`,
          { cause: error }
        );
      }
      expect(await primaryLabel(opened.page), variant.id).toBe(variant.expectedLabel);
      const href = await primaryHref(opened.page);
      expect(href, variant.id).not.toBeNull();
      const ownerUrl = new URL(href!, "https://share-v2.test");
      if (variant.owner === "worker") {
        expect(ownerUrl.pathname, variant.id).toBe("/workers");
        expect(ownerUrl.searchParams.get("focus"), variant.id).toBe("language");
        expect(ownerUrl.searchParams.has("language"), variant.id).toBe(false);
        expect(ownerUrl.searchParams.get("next"), variant.id).toBe(`/workspace?step=share&theme=${environment.theme}`);
      } else {
        expect(ownerUrl.pathname, variant.id).toBe("/workspace");
        expect(ownerUrl.searchParams.get("step"), variant.id).toBe("document");
        expect(ownerUrl.searchParams.get("document"), variant.id).toBe("foreignWorkerTransmission");
        expect(ownerUrl.searchParams.get("language"), variant.id).toBe("vi");
        expect(ownerUrl.searchParams.get("returnStep"), variant.id).toBe("share");
        expect(ownerUrl.searchParams.get("theme"), variant.id).toBe(environment.theme);
      }
      expect(await opened.page.locator("[data-share-preview] strong, [data-share-preview] dd, [data-share-preview] li").count(), variant.id).toBe(0);
      expect(opened.controller.probe.channelRequestCount, variant.id).toBe(0);
      expect(opened.controller.probe.sessionRequestCount, variant.id).toBe(0);
      expect(opened.controller.probe.dispatchRequestCount, variant.id).toBe(0);
      if (variant.id === "locale_missing") {
        await opened.page.locator("[data-share-primary]").click();
        await opened.page.waitForURL((url) => url.pathname === "/workers");
        expect(new URL(opened.page.url()).searchParams.get("focus")).toBe("language");
        expect(await opened.page.getByRole("link", { name: "전송으로 돌아가기" }).count()).toBe(1);
      }
      if (variant.id === "translation_missing") {
        await opened.page.locator("[data-share-primary]").click();
        await opened.page.waitForURL((url) => (
          url.pathname === "/workspace"
          && url.searchParams.get("step") === "document"
          && url.searchParams.get("language") === "vi"
          && url.searchParams.get("returnStep") === "share"
        ));
        const returnButton = opened.page.getByRole("button", { name: "전송 화면으로 돌아가기" });
        await returnButton.waitFor({ state: "visible", timeout: 30_000 });
        expect(await returnButton.count()).toBe(1);
        await returnButton.click();
        await opened.page.waitForURL((url) => (
          url.pathname === "/workspace"
          && url.searchParams.get("step") === "share"
          && url.searchParams.get("theme") === environment.theme
        ));
        await waitForShareState(opened.page, "review_required");
      }
      expect(opened.controller.probe.unexpectedRequests, variant.id).toEqual([]);
    } finally {
      await closeSharePage(opened);
    }
  }
  return variants.length;
}

async function verifyStaleBindingVariants(environment: ShareEnvironment): Promise<number> {
  const variants = [
    { reasonCode: "session_identity_mismatch", owner: "document" },
    { reasonCode: "workpack_revision_or_digest_changed", owner: "document" },
    { reasonCode: "recipient_snapshot_changed", owner: "worker" },
    { reasonCode: "channel_configuration_changed", owner: "settings" }
  ] as const;

  for (const variant of variants) {
    const scenario = buildScenario("stale");
    scenario.staleReasonCode = variant.reasonCode;
    const opened = await openSharePage(environment, scenario);
    try {
      const expectedState = variant.owner === "settings" ? "blocked" : "stale";
      await waitForShareState(opened.page, expectedState);
      expect(opened.controller.probe.sessionRequestCount, variant.reasonCode).toBe(0);
      expect(opened.controller.probe.dispatchRequestCount, variant.reasonCode).toBe(0);
      expect(opened.controller.probe.providerDispatchCount, variant.reasonCode).toBe(0);
      expect(opened.controller.probe.dispatchLogRequestCount, variant.reasonCode).toBe(0);
      expect(await opened.page.locator("[data-share-preview]").count(), variant.reasonCode).toBe(0);
      const href = await primaryHref(opened.page);
      if (variant.owner === "worker") {
        const ownerUrl = new URL(href!, "https://share-v2.test");
        expect(ownerUrl.pathname, variant.reasonCode).toBe("/workers");
        expect(ownerUrl.searchParams.get("focus"), variant.reasonCode).toBe("language");
      } else if (variant.owner === "settings") {
        expect(href, variant.reasonCode).toBeNull();
        expect(await opened.page.locator("[data-share-primary]").isDisabled(), variant.reasonCode).toBe(true);
      } else {
        const ownerUrl = new URL(href!, "https://share-v2.test");
        expect(ownerUrl.pathname, variant.reasonCode).toBe("/workspace");
        expect(ownerUrl.searchParams.get("step"), variant.reasonCode).toBe("document");
      }
      expect(opened.controller.probe.unexpectedRequests, variant.reasonCode).toEqual([]);
    } finally {
      await closeSharePage(opened);
    }
  }
  return variants.length;
}

async function executeFixtureBehavior(
  environment: ShareEnvironment,
  fixtureId: ShareFixtureId
): Promise<ExecutedShareFixture> {
  const scenario = buildScenario(fixtureId);
  if (fixtureId === "review_required") {
    const invalidWorker = buildShareWorker("xx");
    scenario.workers = [invalidWorker];
    scenario.selectedWorkerIds = [invalidWorker.id];
    scenario.serverLanguageCodes = { [invalidWorker.id]: "xx" };
  }

  const opened = fixtureId === "workpack_revalidation"
    ? await openSharePage(
        environment,
        scenario,
        `/workspace?step=document&document=riskAssessmentDraft&returnStep=share&theme=${environment.theme}`,
        false
      )
    : await openSharePage(environment, scenario);
  const { page, controller } = opened;
  let finalize = async (): Promise<void> => undefined;

  if (fixtureId === "workpack_revalidation") {
    const editor = page.locator(".document-textarea");
    await editor.waitFor({ state: "visible", timeout: 30_000 });
    await editor.fill(`${await editor.inputValue()}\nShare v2 revalidation edit`);
    await page.waitForFunction((storageKey) => {
      const raw = window.localStorage.getItem(storageKey);
      if (!raw) return false;
      try {
        const parsed: unknown = JSON.parse(raw);
        if (typeof parsed !== "object" || parsed === null || !("data" in parsed)) return false;
        const data = parsed.data;
        return typeof data === "object"
          && data !== null
          && !("qualityContract" in data)
          && !("ontologyQa" in data)
          && !("dbHarness" in data);
      } catch {
        return false;
      }
    }, CURRENT_WORKPACK_STORAGE_KEY);
    await page.getByRole("button", { name: "전송 화면으로 돌아가기" }).click();
    await waitForShareState(page, "workpack_revalidation");
    expect(await primaryLabel(page)).toBe("문서 다시 검수");
    const href = await primaryHref(page);
    const ownerUrl = new URL(href!, "https://share-v2.test");
    expect(ownerUrl.pathname).toBe("/workspace");
    expect(ownerUrl.searchParams.get("step")).toBe("document");
    expect(ownerUrl.searchParams.get("returnStep")).toBe("share");
    expect(ownerUrl.searchParams.get("theme")).toBe(environment.theme);
    expect(await page.getByText("문서 보완", { exact: true }).count()).toBe(0);
    expect(controller.probe.sessionRequestCount).toBe(0);
    expect(controller.probe.dispatchRequestCount).toBe(0);
    return { ...opened, expectedState: "workpack_revalidation", finalize };
  }

  if (fixtureId === "empty") {
    await waitForShareState(page, "no_recipients");
    expect(await primaryLabel(page)).toBe("오늘 참여자 선택");
    expect(await primaryHref(page)).toBe(
      `/workers?next=${encodeURIComponent(`/workspace?step=share&theme=${environment.theme}`)}`
    );
    expect(controller.probe.workerMutationCount).toBe(0);
    expect(controller.probe.sessionRequestCount).toBe(0);
    return { ...opened, expectedState: "no_recipients", finalize };
  }

  if (fixtureId === "logged_out") {
    await waitForShareState(page, "logged_out");
    expect(await primaryLabel(page)).toBe("로그인하고 전송");
    const href = await primaryHref(page);
    expect(href).toBe(`/login?next=${encodeURIComponent(`/workspace?step=share&theme=${environment.theme}`)}`);
    expect(controller.probe.sessionRequestCount).toBe(0);
    expect(controller.probe.dispatchRequestCount).toBe(0);
    return { ...opened, expectedState: "logged_out", finalize };
  }

  if (fixtureId === "blocked") {
    await waitForShareState(page, "blocked");
    expect(await primaryLabel(page)).toBe("문서 보완");
    expect(await primaryHref(page)).toContain("returnStep=share");
    expect(controller.probe.sessionRequestCount).toBe(0);
    expect(controller.probe.dispatchRequestCount).toBe(0);
    return { ...opened, expectedState: "blocked", finalize };
  }

  if (fixtureId === "review_required") {
    await waitForShareState(page, "review_required");
    expect(await primaryLabel(page)).toBe("작업자 언어 확인");
    const href = await primaryHref(page);
    expect(href).toBe(`/workers?focus=language&next=${encodeURIComponent(`/workspace?step=share&theme=${environment.theme}`)}`);
    expect(new URL(href!, "https://share-v2.test").searchParams.has("language")).toBe(false);
    expect(href).not.toContain("xx");
    expect(controller.probe.sessionRequestCount).toBe(0);
    expect(controller.probe.dispatchRequestCount).toBe(0);
    return { ...opened, expectedState: "review_required", finalize };
  }

  if (fixtureId === "channel_unavailable") {
    await waitForProbe(() => controller.probe.channelRequestCount === 1, "deferred channel request");
    expect(controller.probe.sessionRequestCount).toBe(0);
    await controller.releaseChannelUnavailable();
    await waitForShareState(page, "blocked");
    expect(await primaryLabel(page)).toBe("채널 연결 대기");
    expect(await primaryHref(page)).toBeNull();
    expect(await page.locator("[data-share-primary]").isDisabled()).toBe(true);
    expect(controller.probe.sessionRequestCount).toBe(0);
    return { ...opened, expectedState: "blocked", finalize };
  }

  if (fixtureId === "stale") {
    await waitForShareState(page, "stale");
    expect(await primaryLabel(page)).toBe("변경사항 다시 확인");
    expect(await primaryHref(page)).toContain("returnStep=share");
    expect(controller.probe.sessionRequestCount).toBe(0);
    expect(controller.probe.dispatchRequestCount).toBe(0);
    expect(controller.probe.providerDispatchCount).toBe(0);
    expect(controller.probe.dispatchLogRequestCount).toBe(0);
    expect(await page.locator("[data-share-preview]").count()).toBe(0);
    return { ...opened, expectedState: "stale", finalize };
  }

  await waitForShareState(page, "ready");
  expect(controller.probe.sessionRequestCount).toBe(0);
  expect(controller.probe.dispatchRequestCount).toBe(0);
  expect(await page.locator("a[href*='/share/'], a[href*='invitation']").count()).toBe(0);

  if (fixtureId === "selected") {
    const channelInputs = page.locator("[data-share-owner='channels'] input[type='checkbox']");
    await channelInputs.nth(0).click();
    await channelInputs.nth(1).click();
    await waitForShareState(page, "selected");
    expect(await primaryLabel(page)).toBe("전송 채널 선택");
    await page.locator("[data-share-primary]").click();
    expect(await channelInputs.nth(0).evaluate((element) => element === document.activeElement)).toBe(true);
    expect(controller.probe.sessionRequestCount).toBe(0);
    return { ...opened, expectedState: "selected", finalize };
  }

  if (fixtureId === "offline") {
    await opened.context.setOffline(true);
    await waitForShareState(page, "offline");
    expect(await primaryLabel(page)).toBe("연결 다시 확인");
    await page.locator("[data-share-primary]").click();
    expect(controller.probe.sessionRequestCount).toBe(0);
    expect(controller.probe.dispatchRequestCount).toBe(0);
    const authorityRequestCount = controller.probe.requests.filter((request) => (
      request.method === "GET" && request.path === "/api/workpacks?limit=50"
    )).length;
    finalize = async () => {
      await opened.context.setOffline(false);
      await waitForProbe(
        () => controller.probe.requests.filter((request) => (
          request.method === "GET" && request.path === "/api/workpacks?limit=50"
        )).length > authorityRequestCount,
        "authority reload after reconnect"
      );
    };
    return { ...opened, expectedState: "offline", finalize };
  }

  expect(await primaryLabel(page)).toBe("1명에게 전송");
  if (fixtureId === "ready") {
    return { ...opened, expectedState: "ready", finalize };
  }

  if (fixtureId === "result_partial") {
    const channelInputs = page.locator("[data-share-owner='channels'] input[type='checkbox']");
    const previousChannelRequestCount = controller.probe.channelRequestCount;
    await channelInputs.nth(2).click();
    await waitForProbe(
      () => controller.probe.channelRequestCount > previousChannelRequestCount,
      "Kakao channel authority refresh"
    );
    await waitForShareState(page, "ready");
  }

  await page.locator("[data-share-primary]").click();
  await waitForProbe(() => controller.probe.sessionRequestCount === 1, "share session request");
  expectSessionBinding(scenario, controller.probe);

  if (fixtureId === "sending") {
    await waitForShareState(page, "sending");
    expect(controller.probe.dispatchRequestCount).toBe(0);
    expect(await page.locator("[data-share-primary]").isDisabled()).toBe(true);
    finalize = async () => controller.releaseSessionFailure();
    return { ...opened, expectedState: "sending", finalize };
  }

  if (fixtureId === "fail_session") {
    await waitForShareState(page, "fail");
    expect(await primaryLabel(page)).toBe("초대 세션 다시 시도");
    expect(controller.probe.dispatchRequestCount).toBe(0);
    expect(await page.locator("a[href='/dispatch']").count()).toBe(0);
    expect((await page.locator("[data-share-root]").innerText())).not.toContain("초대장을 보냈습니다");
    const channelRequestsBeforeRetry = controller.probe.channelRequestCount;
    finalize = async () => {
      scenario.sessionMode = "success";
      await page.locator("[data-share-primary]").click();
      await waitForProbe(
        () => controller.probe.channelRequestCount > channelRequestsBeforeRetry,
        "session retry readiness refresh"
      );
      await waitForShareState(page, "ready");
      expect(controller.probe.sessionRequestCount).toBe(1);
      expect(controller.probe.dispatchRequestCount).toBe(0);
      expect(controller.probe.providerDispatchCount).toBe(0);
      expect(controller.probe.dispatchLogRequestCount).toBe(0);
    };
    return { ...opened, expectedState: "fail", finalize };
  }

  await waitForProbe(() => controller.probe.dispatchRequestCount === 1, "dispatch request");
  expectDispatchBinding(controller.probe);

  if (fixtureId === "fail_dispatch_unpersisted") {
    await waitForShareState(page, "fail");
    expect(await primaryLabel(page)).toBe("연결 다시 확인");
    expect((await page.locator("[data-share-root]").innerText())).toContain("중복 전송 방지 확인 필요");
    expect(controller.probe.dispatchLogRequestCount).toBe(0);
    expect(await page.locator("a[href='/dispatch']").count()).toBe(0);
    const dispatchCount = controller.probe.dispatchRequestCount;
    await page.waitForTimeout(250);
    expect(controller.probe.dispatchRequestCount).toBe(dispatchCount);
    expectRequestOrder(controller.probe);
    return { ...opened, expectedState: "fail", finalize };
  }

  expect(controller.probe.dispatchLogRequestCount).toBe(0);
  expectRequestOrder(controller.probe);
  const persistedOutcomeState = fixtureId === "result_accepted"
    ? "success"
    : fixtureId === "result_partial" ? "partial" : "fail";
  await waitForShareState(page, persistedOutcomeState);
  await page.locator("a[href='/dispatch']").waitFor({ state: "visible", timeout: 30_000 });
  expect(await page.locator("a[href='/dispatch']").count()).toBe(1);
  expect(await primaryLabel(page)).toBe("전파 이력 확인");

  if (fixtureId === "result_accepted") {
    await waitForShareState(page, "success");
    expect((await page.locator("[data-share-root]").innerText())).toContain("전송 요청 접수");
    expect((await page.locator("[data-share-root]").innerText())).not.toMatch(/수신 완료|열람 완료/u);
    expect(await page.locator("[data-share-channel-outcome][data-outcome='accepted']").count()).toBe(2);
    expect(await page.locator("[data-share-result][data-share-log-ids]").getAttribute("data-share-log-ids"))
      .toBe(`${dispatchLogId(0)},${dispatchLogId(1)}`);
    return { ...opened, expectedState: "success", finalize };
  }
  if (fixtureId === "result_partial") {
    await waitForShareState(page, "partial");
    expect((await page.locator("[data-share-root]").innerText())).toContain("일부 채널 확인 필요");
    expect(await page.locator("[data-share-channel-outcome][data-outcome='accepted']").count()).toBe(1);
    expect(await page.locator("[data-share-channel-outcome][data-outcome='failed']").count()).toBe(2);
    expect(await page.locator("[data-share-channel-outcome][data-outcome='unknown']").count()).toBe(0);
    return { ...opened, expectedState: "partial", finalize };
  }
  if (fixtureId === "fail_dispatch") {
    await waitForShareState(page, "fail");
    expect((await page.locator("[data-share-root]").innerText())).toContain("전송 결과 확인 필요");
    expect(await page.locator("[data-share-channel-outcome][data-outcome='failed']").count()).toBe(2);
    return { ...opened, expectedState: "fail", finalize };
  }

  throw new Error(`Unhandled Share v2 fixture: ${fixtureId}`);
}

async function closeSharePage(opened: OpenSharePage): Promise<void> {
  await opened.controller.releaseSessionFailure();
  await opened.context.close();
}

async function openEditableSharePage(
  environment: ShareEnvironment,
  scenario: ShareScenario
): Promise<OpenSharePage> {
  const opened = await openSharePage(
    environment,
    scenario,
    `/workspace?step=document&document=riskAssessmentDraft&theme=${environment.theme}`,
    false
  );
  await opened.page.locator(".document-textarea").first().waitFor({ state: "visible", timeout: 30_000 });
  const operations = opened.page.locator("details.editor-operations-disclosure");
  await operations.locator("summary").click();
  await opened.page.locator("[data-share-root]").waitFor({ state: "visible", timeout: 30_000 });
  await waitForShareState(opened.page, "ready");
  return opened;
}

async function expectNoStaleOutcome(page: Page, expectedState: string): Promise<void> {
  await page.waitForTimeout(250);
  expect(await page.locator("[data-share-root]").getAttribute("data-share-state")).toBe(expectedState);
  expect(await page.locator("[data-share-result]").count()).toBe(0);
  const text = await page.locator("[data-share-root]").innerText();
  expect(text).not.toContain("전송 요청 접수");
  expect(text).not.toContain("일부 채널 확인 필요");
  expect(text).not.toContain("전송 결과 확인 필요");
}

async function verifyInFlightScopeIsolation(environment: ShareEnvironment): Promise<number> {
  const changeTargetLanguage = async (page: Page, workerName: string): Promise<void> => {
    const workerEditor = page.locator(`[aria-label='${workerName} 기본정보 편집']`);
    await workerEditor.locator("select").nth(2).selectOption("th");
  };

  const sessionScenario = buildScenario("sending");
  const sessionPage = await openEditableSharePage(environment, sessionScenario);
  try {
    await sessionPage.page.locator("[data-share-primary]").click();
    await waitForProbe(() => sessionPage.controller.probe.sessionRequestCount === 1, "scope-race session request");
    await changeTargetLanguage(sessionPage.page, sessionScenario.workers[0].displayName);
    await sessionPage.controller.releaseSessionSuccess();
    await expectNoStaleOutcome(sessionPage.page, "review_required");
    expect(sessionPage.controller.probe.dispatchRequestCount).toBe(0);
  } finally {
    await closeSharePage(sessionPage);
  }

  const targetScenario = buildScenario("result_accepted");
  targetScenario.deferDispatch = true;
  const targetPage = await openEditableSharePage(environment, targetScenario);
  try {
    await targetPage.page.locator("[data-share-primary]").click();
    await waitForProbe(() => targetPage.controller.probe.dispatchRequestCount === 1, "target-race dispatch request");
    await changeTargetLanguage(targetPage.page, targetScenario.workers[0].displayName);
    await targetPage.controller.releaseDispatch();
    await expectNoStaleOutcome(targetPage.page, "review_required");
  } finally {
    await closeSharePage(targetPage);
  }

  const workpackScenario = buildScenario("result_partial");
  workpackScenario.deferDispatch = true;
  workpackScenario.workspaceSaveWorkpackId = SCOPE_RACE_WORKPACK_ID;
  const workpackPage = await openEditableSharePage(environment, workpackScenario);
  try {
    await workpackPage.page.locator("[data-share-primary]").click();
    await waitForProbe(() => workpackPage.controller.probe.dispatchRequestCount === 1, "workpack-race dispatch request");
    const channelRequestsBeforeSave = workpackPage.controller.probe.channelRequestCount;
    await workpackPage.page.getByRole("button", { name: "작업공간 저장", exact: true }).click();
    await waitForProbe(
      () => workpackPage.controller.probe.channelRequestCount > channelRequestsBeforeSave,
      "workpack-race authority refresh",
      10_000
    );
    await waitForShareState(workpackPage.page, "ready", 10_000);
    await workpackPage.controller.releaseDispatch();
    await expectNoStaleOutcome(workpackPage.page, "ready");
  } finally {
    await closeSharePage(workpackPage);
  }

  const channelScenario = buildScenario("fail_dispatch");
  channelScenario.deferDispatch = true;
  const channelPage = await openEditableSharePage(environment, channelScenario);
  try {
    await channelPage.page.locator("[data-share-primary]").click();
    await waitForProbe(() => channelPage.controller.probe.dispatchRequestCount === 1, "channel-race dispatch request");
    const channelInputs = channelPage.page.locator("[data-share-owner='channels'] input[type='checkbox']");
    expect(await channelInputs.nth(2).isDisabled()).toBe(false);
    const channelRequestsBeforeChange = channelPage.controller.probe.channelRequestCount;
    await channelInputs.nth(2).check();
    await waitForProbe(
      () => channelPage.controller.probe.channelRequestCount > channelRequestsBeforeChange,
      "channel-race authority refresh"
    );
    await waitForShareState(channelPage.page, "ready", 10_000);
    await channelPage.controller.releaseDispatch();
    await expectNoStaleOutcome(channelPage.page, "ready");
  } finally {
    await closeSharePage(channelPage);
  }

  return 4;
}

function maximum(values: number[]): number {
  return values.length ? Math.max(...values) : 0;
}

function writeBrowserMetrics(): void {
  const productIdentity = requireBrowserProductIdentity();
  const expectedCaseIds = SHARE_ENVIRONMENTS.flatMap((environment) => (
    SHARE_FIXTURE_IDS.flatMap((fixtureId) => (
      SHARE_SCALE_MODES.map((scaleMode) => shareCaseId(environment, fixtureId, scaleMode))
    ))
  ));
  const executedCaseIds = browserCaseMetrics.map((row) => row.caseId);
  const outputDirectory = path.join(
    process.cwd(),
    "evaluation",
    "workpack-share-v2-product-2026-07-14",
    "remediation",
    "logs"
  );
  fs.mkdirSync(outputDirectory, { recursive: true });
  fs.writeFileSync(path.join(outputDirectory, "browser-metrics.json"), `${JSON.stringify({
    schemaVersion: "safeclaw-workpack-share-v2-browser-metrics/v1",
    amendmentId: "workpack-share-v2-product-2026-07-14",
    contractAmendmentCommit: SHARE_CONTRACT_AMENDMENT_COMMIT,
    sourceIdentity: {
      productCommit: productIdentity.commit,
      productTree: productIdentity.tree,
      browserTestBlob: readGitRevision(`${productIdentity.commit}:tests/workpack-share-v2-browser.test.ts`)
    },
    generatedAt: new Date().toISOString(),
    status: browserCaseMetrics.length === expectedCaseIds.length ? "complete" : "partial",
    census: {
      formula: "4 environments * 16 fixtures * 2 scale modes",
      expectedCaseCount: expectedCaseIds.length,
      executedCaseCount: browserCaseMetrics.length,
      unexecutedCaseCount: expectedCaseIds.length - browserCaseMetrics.length,
      uniqueExecutedCaseCount: new Set(executedCaseIds).size,
      normal100Count: browserCaseMetrics.filter((row) => row.scaleModeId === "normal_100").length,
      owningRootText200Count: browserCaseMetrics.filter((row) => row.scaleModeId === "owning_root_text_200").length
    },
    authority: {
      desktopViewport: { width: 1440, height: 1000 },
      mobileViewport: { width: 390, height: 844 },
      rootSelector: "[data-share-root]",
      rootAttribute: "data-share-text-scale",
      requiredRootMutationCount: 1,
      requiredDescendantStyleMutationCount: 0,
      requiredDirectLeafInlineMutationCount: 0
    },
    rows: browserCaseMetrics
  }, null, 2)}\n`, "utf8");
}

async function executeBrowserCase(
  environment: ShareEnvironment,
  fixtureId: ShareFixtureId,
  scaleMode: ShareScaleMode
): Promise<void> {
  const freshDomRuns = scaleMode === "owning_root_text_200" ? 2 : 1;
  const geometries: GeometryMetrics[] = [];
  const rootScaleRuns: RootTextScaleMetrics[] = [];
  let expectedState: string | null = null;

  for (let run = 0; run < freshDomRuns; run += 1) {
    const opened = await executeFixtureBehavior(environment, fixtureId);
    try {
      expectedState = expectedState || opened.expectedState;
      expect(opened.expectedState).toBe(expectedState);
      await waitForShareState(opened.page, opened.expectedState);
      await expectCommonProductSurface(opened.page);
      expect(opened.controller.probe.workerMutationCount).toBe(0);
      expect(opened.controller.probe.unexpectedRequests).toEqual([]);

      if (scaleMode === "owning_root_text_200") {
        const rootScale = await applyRootTextScale(opened.page);
        expectRootTextScaleContract(rootScale, environment.viewport.width);
        rootScaleRuns.push(rootScale);
      }

      const geometry = await readGeometryMetrics(opened.page);
      expectCleanGeometry(geometry);
      geometries.push(geometry);
      await opened.finalize();
    } finally {
      await closeSharePage(opened);
    }
  }

  if (!expectedState) throw new Error("Share v2 browser case did not execute a production state");
  if (rootScaleRuns.length === 2) {
    expect(rootScaleRuns[1].visibleCountBefore).toBe(rootScaleRuns[0].visibleCountBefore);
    expect(rootScaleRuns[1].interactableCount).toBe(rootScaleRuns[0].interactableCount);
    expect(rootScaleRuns[1].textLeafCount).toBe(rootScaleRuns[0].textLeafCount);
    expect(rootScaleRuns[1].pseudoElementInspectionCount).toBe(rootScaleRuns[0].pseudoElementInspectionCount);
  }

  const languageAuthorityChecks = fixtureId === "ready"
    ? await verifyAllLanguageAuthority(environment)
    : 0;
  const reviewVariantChecks = fixtureId === "review_required"
    ? await verifyReviewRequiredVariants(environment)
    : 0;
  const staleVariantChecks = fixtureId === "stale"
    ? await verifyStaleBindingVariants(environment)
    : 0;
  const scopeRaceChecks = environment.id === "day-desktop"
    && fixtureId === "sending"
    && scaleMode === "normal_100"
    ? await verifyInFlightScopeIsolation(environment)
    : 0;

  browserCaseMetrics.push({
    caseId: shareCaseId(environment, fixtureId, scaleMode),
    contractAmendmentCommit: SHARE_CONTRACT_AMENDMENT_COMMIT,
    productCommit: requireBrowserProductIdentity().commit,
    productTree: requireBrowserProductIdentity().tree,
    environmentId: environment.id,
    fixtureId,
    scaleModeId: scaleMode,
    viewport: environment.viewport,
    expectedState,
    freshDomRuns,
    languageAuthorityChecks,
    reviewVariantChecks,
    staleVariantChecks,
    scopeRaceChecks,
    geometry: {
      maximumHorizontalOverflow: maximum(geometries.map((metrics) => metrics.horizontalOverflow)),
      maximumPanelOverflow: maximum(geometries.map((metrics) => metrics.panelOverflow)),
      touchTargetFailureCount: geometries.reduce((total, metrics) => total + metrics.touchTargetFailures.length, 0),
      overlapFailureCount: geometries.reduce((total, metrics) => total + metrics.overlapFailures.length, 0),
      nestedScrollFailureCount: geometries.reduce((total, metrics) => total + metrics.nestedScrollFailures.length, 0),
      clippedTextFailureCount: geometries.reduce((total, metrics) => total + metrics.clippedTextFailures.length, 0)
    },
    rootScale: rootScaleRuns.length === 0 ? null : {
      rootAttributeMutationCount: maximum(rootScaleRuns.map((metrics) => metrics.rootAttributeMutationCount)),
      descendantStyleMutationCount: maximum(rootScaleRuns.map((metrics) => metrics.descendantStyleMutationCount)),
      directLeafInlineMutationCount: maximum(rootScaleRuns.map((metrics) => metrics.directLeafInlineMutationCount)),
      pseudoElementInspectionCount: maximum(rootScaleRuns.map((metrics) => metrics.pseudoElementInspectionCount)),
      pseudoFailureCount: rootScaleRuns.reduce((total, metrics) => (
        total + metrics.pseudoFontRatioFailures.length + metrics.pseudoLineHeightRatioFailures.length
      ), 0),
      mediaQueryStable: rootScaleRuns.every((metrics) => metrics.mobileMediaQueryBefore === metrics.mobileMediaQueryAfter),
      containerQueryStable: rootScaleRuns.every((metrics) => metrics.compactContainerBefore === metrics.compactContainerAfter)
    }
  });
}

describe("Workpack Share v2 browser matrix census", () => {
  it("materializes every authoritative browser case", () => {
    const caseIds = SHARE_ENVIRONMENTS.flatMap((environment) => (
      SHARE_FIXTURE_IDS.flatMap((fixtureId) => (
        SHARE_SCALE_MODES.map((scaleMode) => shareCaseId(environment, fixtureId, scaleMode))
      ))
    ));

    expect(caseIds).toHaveLength(128);
    expect(new Set(caseIds).size).toBe(128);
    expect(SHARE_ENVIRONMENTS.filter((environment) => environment.id.endsWith("mobile")))
      .toEqual([
        { id: "day-mobile", theme: "day", viewport: { width: 390, height: 844 } },
        { id: "night-mobile", theme: "night", viewport: { width: 390, height: 844 } }
      ]);
    expect(SHARE_SCALE_MODES).toEqual(["normal_100", "owning_root_text_200"]);
    expect(SHARE_CONTRACT_AMENDMENT_COMMIT).toMatch(/^[0-9a-f]{40}$/u);
  });

  it("rejects synthetic descendant font mutation as a text scaling delivery", () => {
    expect(auditTextScaleDelivery({
      rootAttributeMutationCount: 0,
      descendantStyleMutationCount: 48,
      directLeafInlineMutationCount: 48
    })).toEqual({
      ok: false,
      reasons: [
        "root mechanism must be applied exactly once",
        "descendant style mutation is synthetic",
        "leaf font mutation is synthetic"
      ]
    });
    const productCommit = "1234567890abcdef1234567890abcdef12345678";
    expect(validateBrowserProductIdentity(productCommit, productCommit)).toBe(productCommit);
    expect(() => validateBrowserProductIdentity(undefined, productCommit))
      .toThrow("WORKPACK_SHARE_V2_PRODUCT_SHA must be an exact commit SHA");
    expect(() => validateBrowserProductIdentity("0".repeat(40), productCommit))
      .toThrow("browser product SHA does not match HEAD");
  });
});

browserMatrix("Workpack Share v2 real browser matrix", () => {
  beforeAll(async () => {
    browserProductCommit = validateBrowserProductIdentity(
      process.env.WORKPACK_SHARE_V2_PRODUCT_SHA,
      readGitRevision("HEAD")
    );
    browserProductTree = readGitRevision(`${browserProductCommit}^{tree}`);
    process.stdout.write(`[share-browser-product-sha] ${browserProductCommit}\n`);
    process.stdout.write(`[share-browser-product-tree] ${browserProductTree}\n`);
    harness = await startIsolatedNextBrowserHarness({
      slug: "workpack-share-v2-product",
      initialPath: "/workspace?step=share&theme=day",
      portSalt: 14_207,
      mode: "dev",
      timeoutMs: 120_000,
      environment: {
        NEXT_PUBLIC_SUPABASE_URL: SHARE_SUPABASE_URL,
        NEXT_PUBLIC_SUPABASE_ANON_KEY: SHARE_SUPABASE_ANON_KEY
      }
    });
    browser = harness.browser;
  }, 120_000);

  afterAll(async () => {
    try {
      writeBrowserMetrics();
    } finally {
      await harness?.stop();
    }
  }, 60_000);

  for (const environment of SHARE_ENVIRONMENTS) {
    for (const fixtureId of SHARE_FIXTURE_IDS) {
      for (const scaleMode of SHARE_SCALE_MODES) {
        const caseId = shareCaseId(environment, fixtureId, scaleMode);
        it(caseId, async () => {
          await executeBrowserCase(environment, fixtureId, scaleMode);
        }, 240_000);
      }
    }
  }
});
