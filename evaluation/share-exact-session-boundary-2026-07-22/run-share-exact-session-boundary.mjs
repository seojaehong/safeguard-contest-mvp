#!/usr/bin/env node
// @ts-check

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { execFileSync } from "node:child_process";
import { chromium } from "playwright";

const OUT_DIR = path.join("evaluation", "share-exact-session-boundary-2026-07-22");
const DEFAULT_BASE_URL = "https://www.safeclaw.kr";
const SAFE_MISSING_SESSION_ID = "00000000-0000-4000-8000-000000000000";
const SAFE_INVALID_SESSION_ID = "not-a-valid-session";
const SAFE_MISSING_WORKER_ID = "00000000-0000-4000-8000-000000000001";
const EXACT_VIEWPORTS = [
  { label: "desktop-short-1440x723", width: 1440, height: 723 },
  { label: "desktop-1440x900", width: 1440, height: 900 },
  { label: "mobile-390x723", width: 390, height: 723 },
];

/**
 * @param {string[]} argv
 */
function parseArgs(argv) {
  const options = {
    baseUrl: process.env.SAFECLAW_BASE_URL || DEFAULT_BASE_URL,
    exactUrl: process.env.SAFECLAW_EXACT_SHARE_SESSION_URL || "",
    outputDir: OUT_DIR,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--base-url") {
      options.baseUrl = argv[index + 1] || options.baseUrl;
      index += 1;
    } else if (arg === "--exact-url") {
      options.exactUrl = argv[index + 1] || options.exactUrl;
      index += 1;
    } else if (arg === "--output") {
      options.outputDir = argv[index + 1] || options.outputDir;
      index += 1;
    }
  }
  return options;
}

function gitHead() {
  try {
    return execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
  } catch {
    return "unknown";
  }
}

/**
 * @param {string} filePath
 */
function fileExists(filePath) {
  return fs.existsSync(filePath);
}

function inspectManagerShareSessionCreateRoute() {
  const routePath = path.join("app", "api", "workpacks", "[id]", "share-sessions", "route.ts");
  const source = fileExists(routePath) ? fs.readFileSync(routePath, "utf8") : "";
  return {
    path: routePath,
    exists: source.length > 0,
    writesWorkpackShareSessions: source.includes(".from(\"workpack_share_sessions\")")
      && source.includes(".insert("),
    requiresApprovalForSafeExactSessionCreation: true,
  };
}

function searchConcreteProductionShareUrls() {
  const fixtureTokenPattern = /\/share\/(?:0{8}|1{8}|2{8}|3{8}|a{8}|b{8}|c{8}|d{8}|e{8}|f{8})-/iu;
  try {
    const output = execFileSync("git", [
      "grep",
      "-n",
      "-E",
      "https://www\\.safeclaw\\.kr/share/[0-9a-fA-F-]{36}\\?workerId=",
      "--",
      ".",
    ], { encoding: "utf8" }).trim();
    const matches = output
      ? output.split(/\r?\n/u).filter((line) => line.trim().length > 0)
      : [];
    const concreteMatches = matches.filter((line) => {
      const normalized = line.toLowerCase();
      return !normalized.startsWith("tests/")
        && !normalized.includes("fixture")
        && !fixtureTokenPattern.test(normalized);
    });
    return {
      performed: true,
      concreteProductionShareUrlFound: concreteMatches.length > 0,
      concreteMatchCount: concreteMatches.length,
      fixtureOrHistoricalMatchCount: matches.length - concreteMatches.length,
      matchCount: matches.length,
      pattern: "https://www.safeclaw.kr/share/<uuid>?workerId=...",
    };
  } catch {
    return {
      performed: true,
      concreteProductionShareUrlFound: false,
      matchCount: 0,
      pattern: "https://www.safeclaw.kr/share/<uuid>?workerId=...",
    };
  }
}

/**
 * @param {string} baseUrl
 */
async function readBuildInfo(baseUrl) {
  try {
    const url = new URL("/api/build-info", baseUrl);
    url.searchParams.set("codexCacheBust", `share-exact-boundary-${Date.now()}`);
    const response = await fetch(url, { cache: "no-store" });
    const body = await response.json().catch(() => ({}));
    return {
      ok: response.ok,
      status: response.status,
      body,
      commitSha: typeof body?.commitSha === "string" ? body.commitSha : "",
    };
  } catch (error) {
    return {
      ok: false,
      status: null,
      body: {},
      commitSha: "",
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * @param {string} baseUrl
 */
async function probeMissingSessionGet(baseUrl) {
  try {
    const url = new URL(`/api/share-sessions/${encodeURIComponent(SAFE_MISSING_SESSION_ID)}`, baseUrl);
    url.searchParams.set("workerId", SAFE_MISSING_WORKER_ID);
    const response = await fetch(url, { cache: "no-store" });
    const body = await response.json().catch(() => ({}));
    return {
      attempted: true,
      method: "GET",
      urlPath: `${url.pathname}?workerId=${SAFE_MISSING_WORKER_ID}`,
      status: response.status,
      ok: response.ok,
      bodyOk: body?.ok === true,
      message: typeof body?.message === "string" ? body.message : "",
      mutationPerformed: false,
    };
  } catch (error) {
    return {
      attempted: true,
      method: "GET",
      urlPath: `/api/share-sessions/${SAFE_MISSING_SESSION_ID}?workerId=${SAFE_MISSING_WORKER_ID}`,
      status: null,
      ok: false,
      bodyOk: false,
      message: error instanceof Error ? error.message : String(error),
      mutationPerformed: false,
    };
  }
}

/**
 * @param {string} baseUrl
 */
async function probeInvalidSessionGet(baseUrl) {
  try {
    const url = new URL(`/api/share-sessions/${encodeURIComponent(SAFE_INVALID_SESSION_ID)}`, baseUrl);
    url.searchParams.set("workerId", SAFE_MISSING_WORKER_ID);
    const response = await fetch(url, { cache: "no-store" });
    const body = await response.json().catch(() => ({}));
    return {
      attempted: true,
      method: "GET",
      urlPath: `${url.pathname}?workerId=${SAFE_MISSING_WORKER_ID}`,
      status: response.status,
      ok: response.ok,
      bodyOk: body?.ok === true,
      message: typeof body?.message === "string" ? body.message : "",
      mutationPerformed: false,
    };
  } catch (error) {
    return {
      attempted: true,
      method: "GET",
      urlPath: `/api/share-sessions/${SAFE_INVALID_SESSION_ID}?workerId=${SAFE_MISSING_WORKER_ID}`,
      status: null,
      ok: false,
      bodyOk: false,
      message: error instanceof Error ? error.message : String(error),
      mutationPerformed: false,
    };
  }
}

/**
 * @param {string} exactUrl
 * @param {string} baseUrl
 */
function normalizeExactShareUrl(exactUrl, baseUrl) {
  if (!exactUrl.trim()) return null;
  const parsed = new URL(exactUrl, baseUrl);
  if (!/^\/share\/[^/]+$/u.test(parsed.pathname)) {
    throw new Error(`Exact share URL must point to /share/[sessionId], got ${parsed.pathname}`);
  }
  return parsed.toString();
}

/**
 * @param {import("playwright").Page} page
 */
async function settle(page) {
  await page.evaluate(async () => {
    await document.fonts.ready;
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  });
}

/**
 * @param {string} exactUrl
 */
async function measureExactSavedSessionGeometry(exactUrl) {
  const browser = await chromium.launch({ headless: true });
  const rows = [];
  try {
    for (const viewport of EXACT_VIEWPORTS) {
      const page = await browser.newPage({
        deviceScaleFactor: 1,
        viewport: { width: viewport.width, height: viewport.height },
      });
      const apiRequests = [];
      const mutationRequests = [];
      page.on("request", (request) => {
        const method = request.method();
        const url = request.url();
        if (url.includes("/api/share-sessions/")) {
          apiRequests.push({ method, url });
          if (!["GET", "HEAD", "OPTIONS"].includes(method)) mutationRequests.push({ method, url });
        }
      });
      try {
        const response = await page.goto(exactUrl, { waitUntil: "networkidle", timeout: 60_000 });
        await settle(page);
        const metrics = await page.evaluate(() => {
          const rect = (selector) => {
            const element = document.querySelector(selector);
            if (!element) return null;
            const box = element.getBoundingClientRect();
            const style = getComputedStyle(element);
            return {
              bottom: Math.round(box.bottom),
              display: style.display,
              height: Math.round(box.height),
              left: Math.round(box.left),
              right: Math.round(box.right),
              top: Math.round(box.top),
              width: Math.round(box.width),
            };
          };
          const root = rect(".safeclaw-share-recipient-page");
          const cards = [...document.querySelectorAll(".safeclaw-share-recipient-card")]
            .map((element) => {
              const box = element.getBoundingClientRect();
              return {
                bottom: Math.round(box.bottom),
                left: Math.round(box.left),
                right: Math.round(box.right),
                top: Math.round(box.top),
                width: Math.round(box.width),
              };
            })
            .filter((box) => box.width > 0 && box.bottom > 0 && box.top < window.innerHeight);
          const distinctLefts = [...new Set(cards.map((box) => box.left))];
          const confirmButton = [...document.querySelectorAll("button")]
            .find((item) => /확인|Tôi đã xem|I have reviewed|已查看/u.test(item.textContent || ""));
          const confirmRect = confirmButton ? (() => {
            const box = confirmButton.getBoundingClientRect();
            return {
              bottom: Math.round(box.bottom),
              top: Math.round(box.top),
            };
          })() : null;
          const outsideElements = [...document.querySelectorAll("body *")].filter((element) => {
            const box = element.getBoundingClientRect();
            return box.width > 0 && box.height > 0 && (box.left < -1 || box.right > window.innerWidth + 1);
          }).length;
          return {
            bodyHeight: document.documentElement.scrollHeight,
            bodyHeightRatio: Number((document.documentElement.scrollHeight / window.innerHeight).toFixed(2)),
            confirmButtonBottom: confirmRect?.bottom ?? null,
            desktopColumnCount: window.innerWidth >= 900 ? distinctLefts.length : 1,
            horizontalOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
            outsideElements,
            rootBottom: root?.bottom ?? null,
            rootWidth: root?.width ?? null,
            rootWidthRatio: root ? Number((root.width / window.innerWidth).toFixed(2)) : null,
            viewport: `${window.innerWidth}x${window.innerHeight}`,
          };
        });
        const desktopPass = viewport.width < 900
          || (
            metrics.rootWidthRatio !== null
            && metrics.rootWidthRatio >= 0.72
            && metrics.desktopColumnCount >= 2
            && metrics.horizontalOverflow === false
            && metrics.outsideElements === 0
          );
        const firstActionPass = metrics.confirmButtonBottom !== null
          && metrics.confirmButtonBottom <= viewport.height;
        const noMutationPass = mutationRequests.length === 0;
        rows.push({
          apiRequests,
          error: null,
          httpStatus: response?.status() ?? null,
          metrics,
          mutationRequests,
          verdict: desktopPass && firstActionPass && noMutationPass ? "PASS_EXACT_SAVED_SESSION_GEOMETRY_NO_MUTATION" : "RED_EXACT_SAVED_SESSION_GEOMETRY",
          viewport: viewport.label,
        });
      } catch (error) {
        rows.push({
          apiRequests,
          error: error instanceof Error ? error.message : String(error),
          httpStatus: null,
          metrics: null,
          mutationRequests,
          verdict: "ERROR_EXACT_SAVED_SESSION_GEOMETRY",
          viewport: viewport.label,
        });
      } finally {
        await page.close();
      }
    }
  } finally {
    await browser.close();
  }
  return rows;
}

/**
 * @param {unknown} value
 */
function json(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

/**
 * @param {number | null} status
 */
function classifySafeMissingSessionRead(status) {
  if (status === 404 || status === 410) return "PASS_FAIL_CLOSED";
  if (typeof status === "number" && status >= 500) return "RED_SERVER_ERROR_SHAPED_MISSING_SESSION";
  if (typeof status === "number" && status >= 400) return "PARTIAL_CLIENT_ERROR_FAIL_CLOSED";
  return "RED_UNEXPECTED_SAFE_READ_STATUS";
}

/**
 * @param {number | null} status
 */
function classifySafeInvalidSessionRead(status) {
  if (status === 400) return "PASS_INVALID_ID_FAIL_CLOSED";
  if (typeof status === "number" && status >= 500) return "RED_INVALID_ID_SERVER_ERROR";
  if (typeof status === "number" && status >= 400) return "PARTIAL_INVALID_ID_CLIENT_ERROR";
  return "RED_UNEXPECTED_INVALID_ID_STATUS";
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const checkedAt = new Date().toISOString();
  const sourceHead = gitHead();
  const buildInfo = await readBuildInfo(options.baseUrl);
  const missingSessionGet = await probeMissingSessionGet(options.baseUrl);
  const invalidSessionGet = await probeInvalidSessionGet(options.baseUrl);
  const managerShareSessionCreateRoute = inspectManagerShareSessionCreateRoute();
  const concreteProductionShareUrlSearch = searchConcreteProductionShareUrls();
  const safeMissingSessionReadVerdict = classifySafeMissingSessionRead(missingSessionGet.status);
  const safeInvalidSessionReadVerdict = classifySafeInvalidSessionRead(invalidSessionGet.status);
  const exactSessionUrl = normalizeExactShareUrl(options.exactUrl, options.baseUrl);
  const exactSessionPayloadPath = process.env.SAFECLAW_EXACT_SHARE_SESSION_PAYLOAD || "";
  const exactSessionGeometry = exactSessionUrl
    ? await measureExactSavedSessionGeometry(exactSessionUrl)
    : [];
  const exactSessionMutationRequests = exactSessionGeometry.flatMap((row) => row.mutationRequests || []);
  const exactGeometryPass = exactSessionGeometry.length > 0
    && exactSessionGeometry.every((row) => row.verdict === "PASS_EXACT_SAVED_SESSION_GEOMETRY_NO_MUTATION")
    && exactSessionMutationRequests.length === 0;
  const exactGeometryErrors = exactSessionGeometry.filter((row) => row.verdict.startsWith("ERROR"));

  const report = {
    schemaVersion: "safeclaw-share-exact-session-boundary/v1",
    checkedAt,
    baseUrl: options.baseUrl,
    sourceHead,
    liveBuildInfo: buildInfo.body,
    liveCommit: buildInfo.commitSha,
    verdict: exactSessionUrl
      ? exactGeometryPass
        ? "PASS_EXACT_SAVED_SESSION_GEOMETRY_NO_MUTATION"
        : exactGeometryErrors.length > 0
          ? "ERROR_EXACT_SAVED_SESSION_GEOMETRY_NO_MUTATION"
          : "RED_EXACT_SAVED_SESSION_GEOMETRY_NO_MUTATION"
      : "MISSING_EXACT_SAVED_SESSION_EVIDENCE_NO_MUTATION_BOUNDARY_CONFIRMED",
    exactSavedUserSessionReproduced: exactGeometryPass,
    exactSavedSessionUrlProvided: Boolean(exactSessionUrl),
    exactSavedSessionPayloadProvided: Boolean(exactSessionPayloadPath),
    sessionKind: exactSessionUrl ? "saved-exact" : "missing-exact",
    userDesktopMobileLikeShareComplaintClosed: exactGeometryPass,
    scopedWorkspaceOrFixtureProofAcceptedForUserComplaintClosure: false,
    exactSessionAcceptance: {
      requiredViewports: EXACT_VIEWPORTS.map((viewport) => viewport.label),
      desktopRootWidthRatioMin: 0.72,
      desktopColumnCountMin: 2,
      firstActionMustBeInViewport: true,
      horizontalOverflowAllowed: false,
      mutationRequestCountMustBeZero: true,
      mobileSingleColumnAllowedOnlyBelowWidth: 900,
    },
    exactSessionGeometry,
    routeFiles: {
      recipientPage: {
        path: "app/share/[sessionId]/page.tsx",
        exists: fileExists(path.join("app", "share", "[sessionId]", "page.tsx")),
      },
      recipientApi: {
        path: "app/api/share-sessions/[sessionId]/route.ts",
        exists: fileExists(path.join("app", "api", "share-sessions", "[sessionId]", "route.ts")),
      },
      managerSessionCreateApi: {
        path: "app/api/workpacks/[id]/share-sessions/route.ts",
        exists: fileExists(path.join("app", "api", "workpacks", "[id]", "share-sessions", "route.ts")),
      },
    },
    concreteProductionShareUrlSearch,
    managerShareSessionCreateRoute,
    safeReadProbe: missingSessionGet,
    invalidReadProbe: invalidSessionGet,
    safeMissingSessionReadVerdict,
    safeInvalidSessionReadVerdict,
    boundary: {
      fixtureProofAcceptedAsExactSavedSession: false,
      generatedWorkspaceProofAcceptedAsExactSavedSession: false,
      scopedWorkspaceOrFixtureProofAcceptedForUserComplaintClosure: false,
      exactSavedSessionRequiredForUserSpecificPass: true,
      sessionCreationRequiresAuthenticatedManagerWorkpackFlow: true,
      sessionCreationWouldRequireDbMutation: true,
      sessionCreationRouteWritesWorkpackShareSessions: managerShareSessionCreateRoute.writesWorkpackShareSessions,
      concreteProductionShareUrlFoundInSourceSearch: concreteProductionShareUrlSearch.concreteProductionShareUrlFound,
      providerDispatchLiveClaimed: false,
      externalProviderCalled: false,
      dbMutationPerformed: exactSessionMutationRequests.length > 0,
      dispatchMutationPerformed: false,
      exactSessionMutationRequestCount: exactSessionMutationRequests.length,
    },
    nextEvidenceNeeded: [
      "concrete production /share/[sessionId]?workerId=... URL from the user-observed session",
      "or an approved safe creation flow for a manager-owned workpack/share session",
      "then rerun desktop 1440x723/1440x900 and mobile 390x723 geometry with sessionKind=saved-exact",
      "keep the deliberately missing share-session GET fail-closed; a 5xx safe-read shape is a launch-quality debt separate from exact saved-session geometry",
      "keep invalid share-session ids fail-closed at 400 so URL validation debt is separated from storage-backed missing-session debt",
    ],
    forbiddenClaims: [
      "Fixture or generated /workspace Share proof closes the exact saved /share/[sessionId] user complaint.",
      "A live provider dispatch was performed.",
      "A share session was created or mutated by this boundary audit.",
      "Exact saved Share is proven despite non-GET /api/share-sessions requests occurring during the probe.",
    ],
  };

  fs.mkdirSync(options.outputDir, { recursive: true });
  fs.writeFileSync(path.join(options.outputDir, "report.json"), json(report), "utf8");
  fs.writeFileSync(path.join(options.outputDir, "report.md"), `# Share Exact Session Boundary Gate

Checked at: ${checkedAt}

Base URL: \`${options.baseUrl}\`

Source HEAD: \`${sourceHead}\`

Live \`/api/build-info\`: \`${buildInfo.commitSha || "unknown"}\`

Verdict: \`${report.verdict}\`

Exact saved user session reproduced: \`${report.exactSavedUserSessionReproduced}\`

User desktop mobile-like Share complaint closed: \`${report.userDesktopMobileLikeShareComplaintClosed}\`

Provider live dispatch claimed: \`false\`

External provider called: \`false\`

DB mutation performed: \`${report.boundary.dbMutationPerformed}\`

## Boundary

- Recipient page exists: \`${report.routeFiles.recipientPage.exists}\`
- Recipient API exists: \`${report.routeFiles.recipientApi.exists}\`
- Manager share-session create API exists: \`${report.routeFiles.managerSessionCreateApi.exists}\`
- Concrete production saved-share URL found in source search: \`${report.concreteProductionShareUrlSearch.concreteProductionShareUrlFound}\`
- Concrete production saved-share URL concrete matches: \`${report.concreteProductionShareUrlSearch.concreteMatchCount ?? 0}\`
- Fixture/historical saved-share URL source-search matches: \`${report.concreteProductionShareUrlSearch.fixtureOrHistoricalMatchCount ?? 0}\`
- Manager create route writes workpack_share_sessions: \`${report.managerShareSessionCreateRoute.writesWorkpackShareSessions}\`
- Safe missing-session GET status: \`${missingSessionGet.status ?? "error"}\`
- Safe missing-session read verdict: \`${report.safeMissingSessionReadVerdict}\`
- Safe missing-session GET mutation performed: \`false\`
- Safe invalid-session GET status: \`${invalidSessionGet.status ?? "error"}\`
- Safe invalid-session read verdict: \`${report.safeInvalidSessionReadVerdict}\`
- Safe invalid-session GET mutation performed: \`false\`
- Exact saved URL provided: \`${Boolean(exactSessionUrl)}\`
- Exact saved geometry rows: \`${exactSessionGeometry.length}\`
- Exact saved mutation request count: \`${exactSessionMutationRequests.length}\`
- Exact saved session kind: \`${report.sessionKind}\`
- Scoped Workspace/fixture proof accepted for user complaint closure: \`${report.scopedWorkspaceOrFixtureProofAcceptedForUserComplaintClosure}\`

## Exact Session Acceptance

- Required viewports: ${report.exactSessionAcceptance.requiredViewports.map((item) => `\`${item}\``).join(", ")}
- Desktop root width ratio min: \`${report.exactSessionAcceptance.desktopRootWidthRatioMin}\`
- Desktop column count min: \`${report.exactSessionAcceptance.desktopColumnCountMin}\`
- First action must be in viewport: \`${report.exactSessionAcceptance.firstActionMustBeInViewport}\`
- Horizontal overflow allowed: \`${report.exactSessionAcceptance.horizontalOverflowAllowed}\`
- Mutation request count must be zero: \`${report.exactSessionAcceptance.mutationRequestCountMustBeZero}\`
- Mobile single-column allowed only below width: \`${report.exactSessionAcceptance.mobileSingleColumnAllowedOnlyBelowWidth}\`

## Interpretation

${exactSessionUrl
    ? "A concrete exact saved/generated `/share/[sessionId]` URL was provided, so this audit measured the recipient route geometry without clicking confirmation or sending provider messages. Any non-GET `/api/share-sessions` request keeps the result non-claimable."
    : "Exact saved/generated `/share/[sessionId]` remains missing because no concrete production session URL, saved session id, user-observed generated payload, or approved safe creation flow was provided. Fixture and generated `/workspace?share` proofs remain useful scoped layout evidence, but they are not accepted as exact saved-session proof for the user's desktop mobile-like Share complaint."}

Creating a real share session is not approval-free: the manager route is an authenticated workpack flow and the current source inspection confirms it writes \`workpack_share_sessions\`. This audit therefore performs only a safe read of a deliberately missing UUID and records \`dbMutationPerformed=false\`.

## Next Evidence Needed

${report.nextEvidenceNeeded.map((item) => `- ${item}`).join("\n")}

## Forbidden Claims

${report.forbiddenClaims.map((item) => `- ${item}`).join("\n")}
`, "utf8");

  console.log(json({
    output: options.outputDir,
    verdict: report.verdict,
    sourceHead,
    liveCommit: buildInfo.commitSha,
    safeReadStatus: missingSessionGet.status,
    invalidReadStatus: invalidSessionGet.status,
    dbMutationPerformed: report.boundary.dbMutationPerformed,
    exactSavedUserSessionReproduced: report.exactSavedUserSessionReproduced,
    userDesktopMobileLikeShareComplaintClosed: report.userDesktopMobileLikeShareComplaintClosed,
  }));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
