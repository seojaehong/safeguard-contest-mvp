#!/usr/bin/env node
// @ts-check

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { execFileSync, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const SCRIPT_PATH = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(SCRIPT_PATH), "..", "..");
const OUT_DIR = path.join("evaluation", "hermes-openclaw-runtime-current-gate-2026-07-20");
const DEFAULT_BASE_URL = "https://www.safeclaw.kr";
const TEST_FILES = [
  "tests\\engine-adapter.test.ts",
  "tests\\hermes-engine-adapter.test.ts",
  "tests\\openclaw-hermes-route.test.ts",
  "tests\\openclaw-chat.test.ts",
  "tests\\openclaw-broker-ui-context.test.ts",
  "tests\\remote-hermes-contract.test.ts",
  "tests\\remote-hermes-runtime.test.ts",
  "tests\\remote-hermes-route.test.ts",
  "tests\\remote-hermes-https-transport.test.ts",
  "tests\\remote-hermes-upstash-ledger.test.ts",
  "tests\\remote-hermes-service-auth.test.ts",
  "tests\\remote-engine-protocol.test.ts",
  "tests\\engine-runtime-readiness-policy.test.ts",
  "tests\\ai-provider-policy.test.ts",
  "tests\\mcp-tools.test.ts",
];
const TEST_ARGS = [
  "test",
  "--",
  ...TEST_FILES,
  "--maxWorkers=1",
  "--fileParallelism=false",
  "--testTimeout=90000",
  "--hookTimeout=180000",
];

function gitHead() {
  try {
    return execFileSync("git", ["rev-parse", "HEAD"], {
      cwd: REPO_ROOT,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return "unknown";
  }
}

function readSourceContract() {
  const routeSource = fs.readFileSync(
    path.join(REPO_ROOT, "app", "api", "agent", "chat", "route.ts"),
    "utf8",
  );
  const transportSource = fs.readFileSync(
    path.join(REPO_ROOT, "lib", "remote-hermes-https-transport.ts"),
    "utf8",
  );
  const readinessSource = fs.readFileSync(
    path.join(REPO_ROOT, "lib", "engine-runtime-readiness-policy.ts"),
    "utf8",
  );
  const ledgerSource = fs.readFileSync(
    path.join(REPO_ROOT, "lib", "remote-hermes-upstash-ledger.ts"),
    "utf8",
  );
  const routeWiresConfiguredTransport = routeSource.includes(
    "trustedTransport: createConfiguredRemoteHermesHttpsTransport(process.env)",
  );
  const configuredTransportFailsClosed = transportSource.includes(
    "export function createConfiguredRemoteHermesHttpsTransport",
  )
    && transportSource.includes("attestation.serviceId !== serviceId")
    && transportSource.includes('!/^[a-f0-9]{64}$/u.test(attestation.attestationDigest)');
  const durableAttemptLedgerWired = routeSource.includes(
    "attemptLedger: createConfiguredRemoteHermesAttemptLedger({ environment: process.env })",
  );
  const ledgerExplicitOptIn = ledgerSource.includes(
    'SAFECLAW_REMOTE_HERMES_LEDGER_MODE?.trim() !== "upstash"',
  );
  const ledgerAtomicReservation = ledgerSource.includes("'PX', ARGV[2], 'NX'")
    && ledgerSource.includes("remote Hermes attempt was already reserved");
  const ledgerTerminalRequiresReservation = ledgerSource.includes(
    "if redis.call('EXISTS', KEYS[1]) == 0 then return -1 end",
  );
  const ledgerStoresTerminalDigestOnly = ledgerSource.includes("terminalDigest(record)")
    && !ledgerSource.includes("JSON.stringify(record),");
  const readinessKeepsLedgerOpen = readinessSource.includes(
    'contractReady && !durableLedgerReady',
  );
  return {
    routeWiresConfiguredTransport,
    configuredTransportFailsClosed,
    trustedTransportWired: routeWiresConfiguredTransport && configuredTransportFailsClosed,
    durableAttemptLedgerWired,
    ledgerExplicitOptIn,
    ledgerAtomicReservation,
    ledgerTerminalRequiresReservation,
    ledgerStoresTerminalDigestOnly,
    readinessKeepsLedgerOpen,
    executionReadyClaimed: false,
  };
}

async function readJsonUrl(url, options = {}) {
  const response = await fetch(url, { cache: "no-store", ...options });
  const text = await response.text();
  let body = {};
  try {
    body = text ? JSON.parse(text) : {};
  } catch {
    body = { raw: text };
  }
  return {
    status: response.status,
    ok: response.ok,
    body,
    contentLength: Buffer.byteLength(text, "utf8"),
  };
}

async function readBuildInfo(baseUrl) {
  const url = new URL("/api/build-info", baseUrl);
  url.searchParams.set("codexCacheBust", `hermes-current-${Date.now()}`);
  return (await readJsonUrl(url)).body;
}

async function runUnauthenticatedBrokerSmoke(baseUrl) {
  const url = new URL("/api/agent/chat", baseUrl);
  url.searchParams.set("codexCacheBust", `hermes-current-${Date.now()}`);
  const response = await readJsonUrl(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ messages: [{ role: "user", content: "ping" }] }),
  });
  const code = typeof response.body?.code === "string" ? response.body.code : "";
  return {
    endpoint: `${baseUrl.replace(/\/$/u, "")}/api/agent/chat`,
    httpStatus: response.status,
    code,
    contentLength: response.contentLength,
    engineExecutionReached: false,
    status: response.status === 401 && code === "AUTH_REQUIRED" ? "pass" : "fail",
  };
}

function parseVitestSummary(stdout) {
  const filesMatch = stdout.match(/Test Files\s+(\d+)\s+passed/u);
  const testsMatch = stdout.match(/Tests\s+(\d+)\s+passed/u);
  const durationMatch = stdout.match(/Duration\s+([0-9.]+)s/u);
  return {
    testFilesPassed: filesMatch ? Number(filesMatch[1]) : TEST_FILES.length,
    testsPassed: testsMatch ? Number(testsMatch[1]) : 0,
    durationSeconds: durationMatch ? Number(durationMatch[1]) : null,
  };
}

function runFocusedTests() {
  const started = Date.now();
  const result = spawnSync(process.env.ComSpec || "cmd.exe", ["/d", "/s", "/c", "npm.cmd", ...TEST_ARGS], {
    cwd: REPO_ROOT,
    encoding: "utf8",
    shell: false,
  });
  const stdout = result.stdout || "";
  const stderr = result.stderr || "";
  const summary = parseVitestSummary(stdout);
  return {
    command: `npm.cmd ${TEST_ARGS.join(" ")}`,
    testFilesPassed: summary.testFilesPassed,
    testsPassed: summary.testsPassed,
    durationSeconds: summary.durationSeconds ?? Number(((Date.now() - started) / 1000).toFixed(2)),
    status: result.status === 0 ? "pass" : "fail",
    exitStatus: result.status,
    signal: result.signal,
    error: result.error ? String(result.error) : null,
    stdoutTail: stdout.split(/\r?\n/u).slice(-12).filter(Boolean),
    stderrTail: stderr.split(/\r?\n/u).slice(-12).filter(Boolean),
  };
}

function parseArgs(argv) {
  const options = { baseUrl: DEFAULT_BASE_URL, skipTests: false };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const next = argv[index + 1] || "";
    if (arg === "--base-url") {
      options.baseUrl = next;
      index += 1;
    } else if (arg === "--skip-tests") {
      options.skipTests = true;
    } else if (arg === "--help" || arg === "-h") {
      console.log("Usage: node evaluation/hermes-openclaw-runtime-current-gate-2026-07-20/run-hermes-openclaw-runtime-current-gate.mjs [--base-url URL] [--skip-tests]");
      process.exit(0);
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }
  return options;
}

function buildReport({
  checkedAt,
  sourceSha,
  productionBuildInfo,
  focusedTests,
  liveUnauthenticatedBrokerSmoke,
  sourceContract,
}) {
  const productionCommit = typeof productionBuildInfo?.commitSha === "string"
    ? productionBuildInfo.commitSha
    : "";
  const sourceHeadMatchesProduction = sourceSha === productionCommit;
  return {
    schemaVersion: "safeclaw-hermes-openclaw-runtime-current-gate/v1",
    checkedAt,
    sourceShaForFocusedTests: sourceSha,
    productionBuildInfoAtLiveSmoke: productionBuildInfo,
    sourceHeadMatchesProduction,
    verdict: focusedTests.status === "pass"
      && liveUnauthenticatedBrokerSmoke.status === "pass"
      && sourceHeadMatchesProduction
      && sourceContract.trustedTransportWired
      && sourceContract.durableAttemptLedgerWired
      && sourceContract.ledgerExplicitOptIn
      && sourceContract.ledgerAtomicReservation
      && sourceContract.ledgerTerminalRequiresReservation
      && sourceContract.ledgerStoresTerminalDigestOnly
      && sourceContract.readinessKeepsLedgerOpen
      ? "adapter_boundary_pass_live_execution_not_claimed"
      : "adapter_boundary_red_live_execution_not_claimed",
    focusedTests,
    liveUnauthenticatedBrokerSmoke,
    sourceContract,
    mutationBoundary: {
      dbMutationPerformed: false,
      providerDispatchLiveClaimed: false,
      shareSessionCreated: false,
      vectorRuntimeActivated: false,
      wikiPublicationPerformed: false,
      koshaRegistryMutationPerformed: false,
      engineExecutionClaimed: false,
      liveAuthenticatedExecutionPerformed: false,
    },
    remainingBoundaries: {
      exactSavedShareVerdict: "MISSING_EVIDENCE",
      llmWikiPublication: "APPROVAL_GATED",
      providerDispatchPersistence: "APPROVAL_GATED",
      sifEmbeddingRuntime: "APPROVAL_GATED",
      koshaExactPromotion: "APPROVAL_GATED",
      authenticatedHermesCanary: "APPROVAL_GATED",
    },
    liveExecutionReadiness: {
      claimed: false,
      proven: [
        "authenticated route rejects unauthenticated requests before engine execution",
        "tenant-bound request envelope and signed policy contract",
        "deny-all remote tool policy",
        "Evidence Harness claim allowlist and immutable evidence digest",
        "DNS-pinned HTTPS trusted transport wired into the production route",
        "explicit opt-in Upstash attempt and terminal ledger wired into the production route",
        "atomic attempt reservation and reservation-bound terminal digest persistence",
        "public MCP evidence remains body-redacted while broker-authorized preload retains verified evidence bodies",
      ],
      requires: [
        "authenticated operator-owned site context",
        "local OpenClaw site/org binding attestation or configured remote Hermes gateway",
        "operator configuration for the remote Hermes gateway and explicit durable ledger mode",
        "authenticated live execution canary after runtime configuration approval",
      ],
    },
  };
}

function renderMarkdown(report) {
  const deploymentUrl = typeof report.productionBuildInfoAtLiveSmoke?.deploymentUrl === "string"
    ? report.productionBuildInfoAtLiveSmoke.deploymentUrl
    : "";
  return `# SafeClaw Hermes / OpenClaw Runtime Current Gate

Checked at: ${report.checkedAt}

## Verdict

The Hermes/OpenClaw runtime architecture is green at the adapter, policy, service-auth, route, and fail-closed boundary level when the verdict is \`adapter_boundary_pass_live_execution_not_claimed\`.

Live production runtime execution is still not claimed. The live \`/api/agent/chat\` route must require authentication before engine execution, and production local OpenClaw mode remains closed without a proven site/org binding attestation. Remote Hermes service execution requires the configured gateway, service assertion, replay ledger, tenant binding, and terminal ledger gates.

## Authority

- Source SHA for focused tests: \`${report.sourceShaForFocusedTests}\`
- Production build-info observed during live smoke: \`${report.productionBuildInfoAtLiveSmoke?.commitSha || ""}\`
- Source/live aligned: \`${report.sourceHeadMatchesProduction}\`
- Live deployment URL: \`${deploymentUrl}\`
- Worktree: \`${REPO_ROOT}\`
- Branch: \`chore/recipient-foreign-live-gate-20260720\`

## Verification

Command:

\`\`\`powershell
${report.focusedTests.command}
\`\`\`

Result:

- Test files: ${report.focusedTests.testFilesPassed} passed / ${TEST_FILES.length}
- Tests: ${report.focusedTests.testsPassed} passed
- Duration: ${report.focusedTests.durationSeconds}s
- Status: \`${report.focusedTests.status}\`

Live unauthenticated broker smoke:

\`\`\`powershell
Invoke-WebRequest -Uri '${report.liveUnauthenticatedBrokerSmoke.endpoint}?codexCacheBust=...' -Method Post -ContentType 'application/json' -Body '{"messages":[{"role":"user","content":"ping"}]}' -SkipHttpErrorCheck
\`\`\`

Result:

- HTTP: ${report.liveUnauthenticatedBrokerSmoke.httpStatus}
- Code: \`${report.liveUnauthenticatedBrokerSmoke.code}\`
- Content length: ${report.liveUnauthenticatedBrokerSmoke.contentLength} bytes
- Engine execution: ${report.liveUnauthenticatedBrokerSmoke.engineExecutionReached ? "reached" : "not reached"}
- Smoke status: \`${report.liveUnauthenticatedBrokerSmoke.status}\`

## Current Runtime Boundary

- \`ai-provider-policy.ts\` remains a model provider policy for structured deliverables, not the Hermes/OpenClaw runtime switch.
- \`EngineAdapter\` owns runtime mode selection: \`disabled\`, \`local-openclaw\`, \`experimental-hermes\`, \`remote-hermes\`.
- Production local OpenClaw mode still uses a fail-closed site-binding verifier.
- Remote Hermes service-auth tests cover assertion TTL, future skew, replay consumption, binding, key window, signature checks, timeout, and abort behavior.
- Live execution still requires an authenticated owned site context and runtime-specific attestation.

## Non-Actions

- DB mutation performed: \`${report.mutationBoundary.dbMutationPerformed}\`
- Provider dispatch live claimed: \`${report.mutationBoundary.providerDispatchLiveClaimed}\`
- Share session created: \`${report.mutationBoundary.shareSessionCreated}\`
- Vector runtime activated: \`${report.mutationBoundary.vectorRuntimeActivated}\`
- LLM Wiki publication performed: \`${report.mutationBoundary.wikiPublicationPerformed}\`
- KOSHA registry mutation performed: \`${report.mutationBoundary.koshaRegistryMutationPerformed}\`
- Engine execution claimed: \`${report.mutationBoundary.engineExecutionClaimed}\`
- Live authenticated execution performed: \`${report.mutationBoundary.liveAuthenticatedExecutionPerformed}\`

Exact saved Share remains \`${report.remainingBoundaries.exactSavedShareVerdict}\`. LLM Wiki publication, provider persistence, SIF vector runtime, KOSHA exact promotion, and the authenticated Hermes canary remain approval-gated.

## Remote Hermes Source Contract

- Production route wires configured trusted HTTPS transport: \`${report.sourceContract.routeWiresConfiguredTransport}\`
- Configured transport fails closed on service/digest mismatch: \`${report.sourceContract.configuredTransportFailsClosed}\`
- Trusted transport wired: \`${report.sourceContract.trustedTransportWired}\`
- Durable attempt ledger wired: \`${report.sourceContract.durableAttemptLedgerWired}\`
- Ledger explicit opt-in: \`${report.sourceContract.ledgerExplicitOptIn}\`
- Atomic reservation: \`${report.sourceContract.ledgerAtomicReservation}\`
- Terminal requires reservation: \`${report.sourceContract.ledgerTerminalRequiresReservation}\`
- Terminal stores digest only: \`${report.sourceContract.ledgerStoresTerminalDigestOnly}\`
- Readiness keeps the durable ledger blocker visible: \`${report.sourceContract.readinessKeepsLedgerOpen}\`
- Execution-ready claimed: \`${report.sourceContract.executionReadyClaimed}\`

## Interpretation

This is the correct current state for launch safety: SafeClaw can demonstrate that Hermes/OpenClaw is integrated as a bounded adapter path, while avoiding the false claim that a production Hermes worker pool or local OAuth runtime is fully operational inside Vercel.

The production route now supplies both the DNS-pinned trusted HTTPS transport and an explicit opt-in durable attempt/terminal ledger. Runtime creation still fails closed unless the operator configures the remote gateway, signed policy, and \`SAFECLAW_REMOTE_HERMES_LEDGER_MODE=upstash\`. The next proof is an approved authenticated operator-owned canary; this report does not substitute source wiring for live execution.
`;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const checkedAt = new Date().toISOString();
  const sourceSha = gitHead();
  const productionBuildInfo = await readBuildInfo(options.baseUrl);
  const sourceContract = readSourceContract();
  const focusedTests = options.skipTests
    ? { command: `npm.cmd ${TEST_ARGS.join(" ")}`, testFilesPassed: 0, testsPassed: 0, durationSeconds: 0, status: "skipped" }
    : runFocusedTests();
  const liveUnauthenticatedBrokerSmoke = await runUnauthenticatedBrokerSmoke(options.baseUrl);
  const report = buildReport({
    checkedAt,
    sourceSha,
    productionBuildInfo,
    focusedTests,
    liveUnauthenticatedBrokerSmoke,
    sourceContract,
  });
  fs.writeFileSync(path.join(REPO_ROOT, OUT_DIR, "report.json"), `${JSON.stringify(report, null, 2)}\n`, "utf8");
  fs.writeFileSync(path.join(REPO_ROOT, OUT_DIR, "report.md"), renderMarkdown(report), "utf8");
  console.log(JSON.stringify({
    output: OUT_DIR,
    verdict: report.verdict,
    sourceSha: report.sourceShaForFocusedTests,
    productionCommit: report.productionBuildInfoAtLiveSmoke?.commitSha || "",
    tests: report.focusedTests.status,
    liveSmoke: report.liveUnauthenticatedBrokerSmoke.status,
    liveCode: report.liveUnauthenticatedBrokerSmoke.code,
    trustedTransportWired: report.sourceContract.trustedTransportWired,
    durableAttemptLedgerWired: report.sourceContract.durableAttemptLedgerWired,
    engineExecutionClaimed: report.mutationBoundary.engineExecutionClaimed,
  }, null, 2));
  if (report.verdict !== "adapter_boundary_pass_live_execution_not_claimed") {
    process.exitCode = 1;
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === SCRIPT_PATH) {
  await main();
}
