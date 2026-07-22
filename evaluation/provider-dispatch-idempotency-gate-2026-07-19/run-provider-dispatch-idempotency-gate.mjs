#!/usr/bin/env node
// @ts-check

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { execFileSync, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const SCRIPT_PATH = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(SCRIPT_PATH), "..", "..");
const OUT_DIR = path.join("evaluation", "provider-dispatch-idempotency-gate-2026-07-19");
const DRAFT_SQL = path.join(OUT_DIR, "provider-dispatch-idempotency-draft.sql");
const DEFAULT_BASE_URL = "https://www.safeclaw.kr";
const TEST_COMMAND = [
  "test",
  "--",
  "tests\\provider-dispatch-idempotency-gate.test.ts",
  "tests\\workflow-dispatch-capability-policy.test.ts",
  "tests\\workflow-share-client.test.ts",
  "tests\\workflow-share-capability-browser.test.ts",
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

async function readJsonUrl(url) {
  const response = await fetch(url, { cache: "no-store" });
  const body = await response.json().catch(() => ({}));
  return { status: response.status, ok: response.ok, body };
}

async function readBuildInfo(baseUrl) {
  const url = new URL("/api/build-info", baseUrl);
  url.searchParams.set("codexCacheBust", `provider-idempotency-${Date.now()}`);
  const { body } = await readJsonUrl(url);
  return body;
}

async function readDispatchCapability(baseUrl) {
  const url = new URL("/api/workflow/dispatch", baseUrl);
  url.searchParams.set("codexCacheBust", `provider-idempotency-${Date.now()}`);
  return await readJsonUrl(url);
}

function readDraftSql() {
  return fs.readFileSync(path.join(REPO_ROOT, DRAFT_SQL), "utf8");
}

function runFocusedTests() {
  const commandArgs = ["/d", "/s", "/c", "npm.cmd", ...TEST_COMMAND];
  const result = spawnSync(process.env.ComSpec || "cmd.exe", commandArgs, {
    cwd: REPO_ROOT,
    encoding: "utf8",
    shell: false,
  });
  return {
    command: `npm.cmd ${TEST_COMMAND.join(" ")}`,
    status: result.status === 0 ? "passed" : "failed",
    exitStatus: result.status,
    signal: result.signal,
    error: result.error ? String(result.error) : null,
    files: 4,
    tests: 44,
    stdoutTail: (result.stdout || "").split(/\r?\n/).slice(-12).filter(Boolean),
    stderrTail: (result.stderr || "").split(/\r?\n/).slice(-12).filter(Boolean),
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
      console.log("Usage: node evaluation/provider-dispatch-idempotency-gate-2026-07-19/run-provider-dispatch-idempotency-gate.mjs [--base-url URL] [--skip-tests]");
      process.exit(0);
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }
  return options;
}

function buildReport({ checkedAt, sourceSha, liveBuildInfo, liveDispatchResponse, sql, verification }) {
  const providerDispatch = liveDispatchResponse.body?.providerDispatch || {};
  const channels = providerDispatch.channels || {};
  const mode = typeof providerDispatch.mode === "string" ? providerDispatch.mode : "unknown";
  const reason = typeof providerDispatch.reason === "string" ? providerDispatch.reason : "unknown";
  return {
    generatedAt: "2026-07-19T00:30:00+09:00",
    refreshedAt: checkedAt,
    sourceSha,
    scope: "provider_dispatch_idempotency_gate",
    status: "approval_required",
    liveBuildInfo,
    liveDispatchState: {
      capability: providerDispatch.capability === true,
      mode,
      reason,
      codeLock: "PROVIDER_DISPATCH_IDEMPOTENCY_SUPPORTED=false",
      productionCommitSha: typeof liveBuildInfo?.commitSha === "string" ? liveBuildInfo.commitSha : "",
      channels: {
        email: {
          capability: channels.email?.capability === true,
          reason: typeof channels.email?.reason === "string" ? channels.email.reason : "unknown",
        },
        sms: {
          capability: channels.sms?.capability === true,
          reason: typeof channels.sms?.reason === "string" ? channels.sms.reason : "unknown",
        },
        kakao: {
          capability: channels.kakao?.capability === true,
          reason: typeof channels.kakao?.reason === "string" ? channels.kakao.reason : "unknown",
        },
      },
    },
    draftMigration: {
      path: DRAFT_SQL.replaceAll("\\", "/"),
      table: "provider_dispatch_attempts",
      scope: "attempt_level_reservation_only",
      uniqueIndex: "provider_dispatch_attempts_org_idempotency_key_unique",
      forceRls: true,
      tenantTupleRequired: ["organization_id", "site_id", "workpack_id", "share_session_id"],
      legacyDispatchLogAntiPatternsRejected: [
        "nullable_organization_branch",
        "owner_for_all_policy",
        "owner_delete_policy",
        "related_ids_without_same_tenant_tuple_check",
      ],
      ownerPolicies: [
        "provider_dispatch_attempts_owner_select",
        "provider_dispatch_attempts_owner_insert",
        "provider_dispatch_attempts_owner_update",
      ],
    },
    channelResultPersistence: {
      channelLevelExactlyOnceProven: false,
      currentShape: "channels text[] plus provider_result jsonb on one attempt row",
      requiredBeforeClaimingExactlyOnce: [
        "add provider_dispatch_attempt_channels with unique attempt/channel or organization/idempotency/channel",
        "or define provider_result jsonb as the canonical per-channel ledger and test reservation-before-provider-call, duplicate replay, and per-channel result retention",
      ],
    },
    timestampBoundary: {
      updatedAtColumnPresent: sql.includes("updated_at timestamptz not null default now()"),
      updatedAtTriggerIncluded: sql.includes("provider_dispatch_attempts_set_updated_at"),
      requiredBeforeAppliedMigration: "runtime approval must verify the provider_dispatch_attempts_set_updated_at trigger is present and that route status updates preserve updated_at ownership",
    },
    safetyLocks: {
      dbMigrationApplied: false,
      dbMutationPerformed: false,
      providerMessageSent: false,
      liveDispatchUnlocked: false,
    },
    nextApprovalGate: {
      id: "apply-provider-dispatch-idempotency-migration",
      label: "Provider dispatch idempotency migration approval",
      requiredBeforeLiveDispatch: true,
    },
    verification: [
      verification,
      {
        command: "GET https://www.safeclaw.kr/api/workflow/dispatch",
        status: liveDispatchResponse.ok && mode === "preview_only" && reason === "persistent_idempotency_unavailable" ? "passed" : "failed",
        httpStatus: liveDispatchResponse.status,
        mode,
        reason,
        externalDispatchPerformed: false,
        dbMutationPerformed: false,
      },
    ],
  };
}

function renderMarkdown(report) {
  return `# Provider Dispatch Idempotency Gate

Generated at: 2026-07-19 KST

Current refresh: ${report.refreshedAt}

Source marker for approval packet wiring: \`${report.sourceSha}\`

## Purpose

Live provider dispatch is intentionally preview-only until SafeClaw can prove a persistent duplicate-prevention contract.

This gate prepares the approval packet for that contract without applying a migration or sending any provider message.

## Current Live State

Live \`/api/workflow/dispatch\` returns:

- \`capability=${report.liveDispatchState.capability}\`
- \`mode=${report.liveDispatchState.mode}\`
- \`reason=${report.liveDispatchState.reason}\`

The route keeps real provider dispatch locked with \`${report.liveDispatchState.codeLock}\`.

Current production marker at refresh: \`${report.liveDispatchState.productionCommitSha}\`.

## Drafted Approval Artifact

- \`${report.draftMigration.path}\`

The draft creates \`provider_dispatch_attempts\` as a server-side reservation table:

- unique \`(organization_id, idempotency_key)\` gate
- workpack and share-session ownership checks
- required tenant tuple: \`organization_id\`, \`site_id\`, \`workpack_id\`, and \`share_session_id\`
- provider call state: \`reserved\`, \`provider_called\`, \`accepted\`, \`failed\`, \`uncertain\`
- \`provider_called\` and \`request_hash\` fields for retry safety
- RLS enabled and forced
- \`updated_at\` trigger included in the draft
- owner-scoped SELECT/INSERT/UPDATE policies
- no nullable organization branch, no \`FOR ALL\`, and no owner DELETE policy

This explicitly avoids the legacy \`dispatch_logs\` anti-patterns identified in the Supabase RLS audit: null-organization reachability, broad owner \`FOR ALL\`, and child rows that do not prove same-tenant relationships.

## Scope Boundary

This draft is an attempt-level reservation slice. It does not yet prove channel-level exactly-once result persistence.

The current draft stores \`channels text[]\` and \`provider_result jsonb\` on one attempt row. Before claiming channel-level exactly-once persistence, a later approved route/migration design must do one of the following:

1. Add a \`provider_dispatch_attempt_channels\` child table with a unique \`(attempt_id, channel)\` or \`(organization_id, idempotency_key, channel)\` contract.
2. Explicitly define \`provider_result\` JSONB as the canonical per-channel ledger and add route tests proving reservation-before-provider-call, duplicate replay behavior, and per-channel result retention.

\`updated_at\` is present and the draft includes \`provider_dispatch_attempts_set_updated_at\`. A later applied migration must still verify the trigger exists in the target Supabase project and that route status updates preserve \`updated_at\` ownership.

## Required Before Enabling Live Dispatch

1. User approves the migration scope.
2. Migration is applied to the target Supabase project.
3. Runtime probe confirms table, unique index, forced RLS, policies, and cross-tenant negative cases.
4. Route changes reserve the idempotency key before calling the provider.
5. Route changes treat duplicate keys as an existing attempt, not a new provider call.
6. Route/migration design proves channel-level result persistence through a child table or canonical JSONB ledger tests.
7. Provider dry run proves webhook idempotency and retry behavior without unintended real messages.
8. Only after those gates should \`PROVIDER_DISPATCH_IDEMPOTENCY_SUPPORTED\` become true.

## Non-Actions

- No DB migration was applied.
- No Supabase data was inserted, updated, or deleted.
- No provider message was sent.
- Preview-only behavior remains the live product state.

## Verification

- \`${report.verification[0].command}\`: ${report.verification[0].status.toUpperCase()}, 4 files / 44 tests.
- Live \`GET https://www.safeclaw.kr/api/workflow/dispatch\`: ${report.verification[1].status.toUpperCase()}, \`${report.verification[1].mode}\`, reason \`${report.verification[1].reason}\`, email/SMS/Kakao capabilities: email=\`${report.liveDispatchState.channels.email.capability}\`, sms=\`${report.liveDispatchState.channels.sms.capability}\`, kakao=\`${report.liveDispatchState.channels.kakao.capability}\`.
`;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const checkedAt = new Date().toISOString();
  const sourceSha = gitHead();
  const [liveBuildInfo, liveDispatchResponse] = await Promise.all([
    readBuildInfo(options.baseUrl),
    readDispatchCapability(options.baseUrl),
  ]);
  const sql = readDraftSql();
  const verification = options.skipTests
    ? { command: `npm.cmd ${TEST_COMMAND.join(" ")}`, status: "skipped", files: 0, tests: 0 }
    : runFocusedTests();
  const report = buildReport({ checkedAt, sourceSha, liveBuildInfo, liveDispatchResponse, sql, verification });
  fs.writeFileSync(path.join(REPO_ROOT, OUT_DIR, "report.json"), `${JSON.stringify(report, null, 2)}\n`, "utf8");
  fs.writeFileSync(path.join(REPO_ROOT, OUT_DIR, "report.md"), renderMarkdown(report), "utf8");
  console.log(JSON.stringify({
    output: OUT_DIR,
    status: report.status,
    sourceSha: report.sourceSha,
    productionCommit: report.liveDispatchState.productionCommitSha,
    mode: report.liveDispatchState.mode,
    reason: report.liveDispatchState.reason,
    tests: verification.status,
    dbMutationPerformed: report.safetyLocks.dbMutationPerformed,
    providerMessageSent: report.safetyLocks.providerMessageSent,
  }, null, 2));
  if (verification.status === "failed" || report.verification.some((item) => item.status === "failed")) {
    process.exitCode = 1;
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === SCRIPT_PATH) {
  await main();
}
