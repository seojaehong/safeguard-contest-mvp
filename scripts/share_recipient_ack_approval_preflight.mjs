import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { execFileSync } from "node:child_process";
import { buildApprovalEvidenceBinding, isCommitSha } from "./approval_evidence_binding.mjs";

const DEFAULT_OUTPUT_DIR = "evaluation/share-recipient-ack-approval-preflight-current-2026-07-19";

const REQUIRED_FILES = Object.freeze({
  currentShareGate: "evaluation/share-recipient-live-current-2026-07-19/report.json",
  routeLoopGate: "evaluation/share-recipient-route-loop-gate-2026-07-19/report.json",
  currentState: "evaluation/north-star-current-state-2026-07-19/report.json",
  publicRecipientRoute: "app/api/share-sessions/[sessionId]/route.ts",
  managerShareRoute: "app/api/workpacks/[id]/share-sessions/route.ts",
  authorityRouteTest: "tests/workpack-share-authority-routes.test.ts",
  recipientBrowserTest: "tests/share-recipient-portal-browser.test.ts"
});

function parseArgs(argv) {
  const args = { root: process.cwd(), output: DEFAULT_OUTPUT_DIR };
  for (let index = 2; index < argv.length; index += 1) {
    const item = argv[index];
    const next = argv[index + 1];
    if (item === "--root" && next) {
      args.root = next;
      index += 1;
    } else if (item === "--output" && next) {
      args.output = next;
      index += 1;
    } else {
      throw new Error(`Unknown or incomplete argument: ${item}`);
    }
  }
  return args;
}

function readText(root, relativePath) {
  const filePath = resolve(root, relativePath);
  if (!existsSync(filePath)) throw new Error(`Missing required file: ${relativePath}`);
  return readFileSync(filePath, "utf8");
}

function readJson(root, relativePath) {
  return JSON.parse(readText(root, relativePath));
}

function currentHead(root) {
  try {
    return execFileSync("git", ["rev-parse", "HEAD"], {
      cwd: root,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"]
    }).trim();
  } catch {
    return null;
  }
}

function check(id, passed, message) {
  return {
    id,
    passed,
    message: passed ? "ok" : message
  };
}

function includesAll(text, needles) {
  return needles.every((needle) => text.includes(needle));
}

export function buildShareRecipientAckApprovalPreflight({ root }) {
  const missingFiles = Object.entries(REQUIRED_FILES)
    .filter(([, relativePath]) => !existsSync(resolve(root, relativePath)))
    .map(([id, relativePath]) => ({ id, relativePath }));
  if (missingFiles.length > 0) {
    return {
      schemaVersion: "safeclaw-share-recipient-ack-approval-preflight/v1",
      generatedAt: new Date().toISOString(),
      sourceSha: currentHead(root),
      overall: "blocked_missing_files",
      approvalRequired: true,
      liveDataMutationApproved: false,
      dbMutationPerformed: false,
      providerMessageSent: false,
      missingFiles,
      checks: missingFiles.map((file) => check(`file:${file.id}`, false, `Missing ${file.relativePath}`)),
      failedCheckIds: missingFiles.map((file) => `file:${file.id}`)
    };
  }

  const currentShareGate = readJson(root, REQUIRED_FILES.currentShareGate);
  const routeLoopGate = readJson(root, REQUIRED_FILES.routeLoopGate);
  const currentState = readJson(root, REQUIRED_FILES.currentState);
  const publicRoute = readText(root, REQUIRED_FILES.publicRecipientRoute);
  const managerRoute = readText(root, REQUIRED_FILES.managerShareRoute);
  const authorityTest = readText(root, REQUIRED_FILES.authorityRouteTest);
  const browserTest = readText(root, REQUIRED_FILES.recipientBrowserTest);
  const shareProductionCommit = currentShareGate.liveBuildInfo?.commitSha;
  const routeLoopSourceHead = routeLoopGate.baseSourceHead;
  const currentStateProductionCommit = currentState.productionBuildInfo?.commitSha;
  const approvalEvidenceBinding = buildApprovalEvidenceBinding({
    root,
    inputPaths: Object.values(REQUIRED_FILES),
    productionCommit: shareProductionCommit,
    evidenceCommits: [shareProductionCommit, routeLoopSourceHead, currentStateProductionCommit],
  });

  const checks = [
    check(
      "current_share_surface_proven",
      currentShareGate.verdict === "pass_current_production_mapped_share_recipient_surface"
        && currentShareGate.dbSchemaChanged === false
        && currentShareGate.supabaseDataChanged === false
        && currentShareGate.providerMessageSent === false,
      "Current share-recipient surface evidence must pass and remain non-mutating."
    ),
    check(
      "route_loop_non_mutating_contract_proven",
      routeLoopGate.verdict === "pass_non_mutating_route_level_invited_recipient_loop"
        && routeLoopGate.contract?.managerStatusReadsBackConfirmation === true
        && routeLoopGate.contract?.productionMutationPerformed === false
        && routeLoopGate.contract?.providerMessageSent === false,
      "Route-level invited loop must prove manager create, worker confirm, and manager readback without production mutation."
    ),
    check(
      "current_state_keeps_real_ack_approval_required",
      currentState.approvalGatedOrIncompleteGates?.realProductionInvitedAck?.state === "requires_explicit_live_data_approval",
      "North Star current-state must keep real production ACK behind explicit live-data approval."
    ),
    check(
      "public_route_persists_confirmation_to_read_confirmations",
      includesAll(publicRoute, [
        "createSupabaseAdminClient",
        "loadActivePublicShareSession",
        "workpack_read_confirmations",
        "confirmation_method: \"button\"",
        ".insert(insert)"
      ]),
      "Public recipient route must still save button confirmations through the server-authoritative route."
    ),
    check(
      "public_route_rejects_missing_or_unknown_worker",
      includesAll(publicRoute, [
        "초대된 작업자 식별자가 확인되지 않아 열람 확인을 저장할 수 없습니다.",
        "초대된 작업자 링크로 다시 접속해 주세요.",
        "{ status: 403 }"
      ]),
      "Public recipient route must fail closed when the invited worker cannot be resolved."
    ),
    check(
      "manager_route_creates_authoritative_session_snapshot",
      includesAll(managerRoute, [
        "loadServerShareRecipients",
        "recipients_snapshot",
        "access_policy",
        "workpack_share_sessions"
      ]),
      "Manager share route must create the server-authoritative share session snapshot."
    ),
    check(
      "authority_test_covers_real_loop_shape",
      includesAll(authorityTest, [
        "proves the manager-created invited session can be opened by the worker and reflected in manager confirmations",
        "workerConfirmResponse.status",
        "managerStatus.confirmations",
        "confirmation-route-loop"
      ]),
      "Authority route tests must cover manager create, worker confirm, and manager readback."
    ),
    check(
      "browser_test_covers_mobile_foreign_worker_confirmation",
      includesAll(browserTest, [
        "renders an invited worker confirmation page without mobile overflow",
        "Lịch sử xác nhận đã được lưu cho quản lý.",
        "confirmationBody",
        "languageCode: \"vi\""
      ]),
      "Browser test must cover the mobile foreign-worker confirmation surface."
    ),
    check(
      "share_evidence_uses_one_production_commit",
      isCommitSha(shareProductionCommit)
        && shareProductionCommit === routeLoopSourceHead
        && shareProductionCommit === currentStateProductionCommit,
      "Share surface, route-loop, and current-state evidence must describe one production commit."
    ),
    check(
      "approval_inputs_match_current_head_and_digest_binding",
      approvalEvidenceBinding.verified,
      `Every approval input must be tracked at current HEAD and bound by SHA-256 (${approvalEvidenceBinding.failures.join(", ") || "binding failed"}).`
    ),
    check(
      "exact_saved_share_remains_missing_evidence",
      currentState.exactSavedShareVerdict === "MISSING_EVIDENCE"
        || currentState.approvalGatedOrIncompleteGates?.exactSavedShare?.state === "MISSING_EVIDENCE",
      "Exact saved Share must remain MISSING_EVIDENCE in the approval packet."
    )
  ];

  const failedChecks = checks.filter((item) => !item.passed);
  return {
    schemaVersion: "safeclaw-share-recipient-ack-approval-preflight/v1",
    generatedAt: new Date().toISOString(),
    sourceSha: currentHead(root),
    productionCommit: isCommitSha(shareProductionCommit) ? shareProductionCommit : null,
    exactSavedShareVerdict: "MISSING_EVIDENCE",
    approvalEvidenceBinding,
    overall: failedChecks.length === 0 ? "approval_ready_open" : "blocked_preflight_failed",
    approvalRequired: true,
    liveDataMutationApproved: false,
    dbMutationPerformed: false,
    providerMessageSent: false,
    productionShareSessionCreated: false,
    productionReadConfirmationInserted: false,
    requiredApproval: {
      id: "run-real-production-invited-recipient-ack-gate",
      label: "Real production invited recipient ACK readback approval",
      reason: "Creating a production share session and read confirmation writes production rows."
    },
    safeBeforeApproval: [
      "Review route-level invited loop evidence.",
      "Review focused share/recipient browser tests.",
      "Verify live recipient shell and invalid-session fail-closed behavior.",
      "Prepare a disposable workpack/worker pair for an approved live-data canary."
    ],
    forbiddenBeforeApproval: [
      "Create production workpack_share_sessions rows.",
      "Insert production workpack_read_confirmations rows.",
      "Send SMS/Kakao/email provider messages.",
      "Claim every real invited production recipient ACK has been verified."
    ],
    checks,
    failedCheckIds: failedChecks.map((item) => item.id),
    inputs: REQUIRED_FILES
  };
}

export function renderShareRecipientAckApprovalPreflightMarkdown(report) {
  const failed = report.failedCheckIds ?? [];
  return `# Share Recipient ACK Approval Preflight

Generated: \`${report.generatedAt}\`
Source SHA: \`${report.sourceSha ?? "unknown"}\`
Overall: \`${report.overall}\`
Approval required: \`${report.approvalRequired}\`
DB mutation performed: \`${report.dbMutationPerformed}\`
Provider message sent: \`${report.providerMessageSent}\`

## Verdict

${report.overall === "approval_ready_open"
  ? "The route, focused browser tests, and current-state artifacts are ready for operator review. A real production invited-recipient ACK canary still requires explicit live-data approval."
  : "The approval preflight is not ready because at least one required source/evidence check failed."}

## Required Approval

- ${report.requiredApproval?.id ?? "unknown"}: ${report.requiredApproval?.reason ?? "Approval is required before live data mutation."}

## Failed Checks

${failed.length ? failed.map((id) => `- ${id}`).join("\n") : "- None"}

## Checks

| Check | Result | Message |
| --- | --- | --- |
${report.checks.map((item) => `| \`${item.id}\` | ${item.passed ? "PASS" : "FAIL"} | ${item.message.replaceAll("|", "\\|")} |`).join("\n")}

## Safe Before Approval

${report.safeBeforeApproval.map((item) => `- ${item}`).join("\n")}

## Forbidden Before Approval

${report.forbiddenBeforeApproval.map((item) => `- ${item}`).join("\n")}
`;
}

function writeReports(outputDir, report) {
  mkdirSync(outputDir, { recursive: true });
  writeFileSync(resolve(outputDir, "report.json"), `${JSON.stringify(report, null, 2)}\n`);
  writeFileSync(resolve(outputDir, "report.md"), renderShareRecipientAckApprovalPreflightMarkdown(report));
}

async function main() {
  const args = parseArgs(process.argv);
  const root = resolve(args.root);
  const output = resolve(root, args.output);
  const report = buildShareRecipientAckApprovalPreflight({ root });
  writeReports(output, report);
  process.stdout.write(`${JSON.stringify({ output, overall: report.overall, failedCheckIds: report.failedCheckIds }, null, 2)}\n`);
  if (report.overall !== "approval_ready_open") process.exitCode = 1;
}

if (process.argv[1]?.endsWith("share_recipient_ack_approval_preflight.mjs")) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
}
