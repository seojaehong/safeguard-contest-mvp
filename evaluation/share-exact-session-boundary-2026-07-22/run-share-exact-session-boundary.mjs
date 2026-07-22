#!/usr/bin/env node
// @ts-check

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { execFileSync } from "node:child_process";

const OUT_DIR = path.join("evaluation", "share-exact-session-boundary-2026-07-22");
const DEFAULT_BASE_URL = "https://www.safeclaw.kr";
const SAFE_MISSING_SESSION_ID = "00000000-0000-4000-8000-000000000000";
const SAFE_MISSING_WORKER_ID = "00000000-0000-4000-8000-000000000001";

/**
 * @param {string[]} argv
 */
function parseArgs(argv) {
  const options = {
    baseUrl: process.env.SAFECLAW_BASE_URL || DEFAULT_BASE_URL,
    outputDir: OUT_DIR,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--base-url") {
      options.baseUrl = argv[index + 1] || options.baseUrl;
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
 * @param {unknown} value
 */
function json(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const checkedAt = new Date().toISOString();
  const sourceHead = gitHead();
  const buildInfo = await readBuildInfo(options.baseUrl);
  const missingSessionGet = await probeMissingSessionGet(options.baseUrl);
  const exactSessionUrl = process.env.SAFECLAW_EXACT_SHARE_SESSION_URL || "";
  const exactSessionPayloadPath = process.env.SAFECLAW_EXACT_SHARE_SESSION_PAYLOAD || "";

  const report = {
    schemaVersion: "safeclaw-share-exact-session-boundary/v1",
    checkedAt,
    baseUrl: options.baseUrl,
    sourceHead,
    liveBuildInfo: buildInfo.body,
    liveCommit: buildInfo.commitSha,
    verdict: exactSessionUrl || exactSessionPayloadPath
      ? "EXACT_SESSION_INPUT_PRESENT_REQUIRES_SEPARATE_GEOMETRY_PROBE"
      : "MISSING_EXACT_SAVED_SESSION_EVIDENCE_NO_MUTATION_BOUNDARY_CONFIRMED",
    exactSavedUserSessionReproduced: false,
    exactSavedSessionUrlProvided: Boolean(exactSessionUrl),
    exactSavedSessionPayloadProvided: Boolean(exactSessionPayloadPath),
    sessionKind: "missing-exact",
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
    safeReadProbe: missingSessionGet,
    boundary: {
      fixtureProofAcceptedAsExactSavedSession: false,
      generatedWorkspaceProofAcceptedAsExactSavedSession: false,
      exactSavedSessionRequiredForUserSpecificPass: true,
      sessionCreationRequiresAuthenticatedManagerWorkpackFlow: true,
      sessionCreationWouldRequireDbMutation: true,
      providerDispatchLiveClaimed: false,
      externalProviderCalled: false,
      dbMutationPerformed: false,
      dispatchMutationPerformed: false,
    },
    nextEvidenceNeeded: [
      "concrete production /share/[sessionId]?workerId=... URL from the user-observed session",
      "or an approved safe creation flow for a manager-owned workpack/share session",
      "then rerun desktop 1440x723/1440x900 and mobile 390x723 geometry with sessionKind=saved-exact",
    ],
    forbiddenClaims: [
      "Fixture or generated /workspace Share proof closes the exact saved /share/[sessionId] user complaint.",
      "A live provider dispatch was performed.",
      "A share session was created or mutated by this boundary audit.",
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

Exact saved user session reproduced: \`false\`

Provider live dispatch claimed: \`false\`

External provider called: \`false\`

DB mutation performed: \`false\`

## Boundary

- Recipient page exists: \`${report.routeFiles.recipientPage.exists}\`
- Recipient API exists: \`${report.routeFiles.recipientApi.exists}\`
- Manager share-session create API exists: \`${report.routeFiles.managerSessionCreateApi.exists}\`
- Safe missing-session GET status: \`${missingSessionGet.status ?? "error"}\`
- Safe missing-session GET mutation performed: \`false\`

## Interpretation

Exact saved/generated \`/share/[sessionId]\` remains missing because no concrete production session URL, saved session id, user-observed generated payload, or approved safe creation flow was provided. Fixture and generated \`/workspace?share\` proofs remain useful scoped layout evidence, but they are not accepted as exact saved-session proof for the user's desktop mobile-like Share complaint.

Creating a real share session is not approval-free: the manager route is an authenticated workpack flow and would create or read persisted share-session state. This audit therefore performs only a safe read of a deliberately missing UUID and records \`dbMutationPerformed=false\`.

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
    dbMutationPerformed: false,
    exactSavedUserSessionReproduced: false,
  }));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
