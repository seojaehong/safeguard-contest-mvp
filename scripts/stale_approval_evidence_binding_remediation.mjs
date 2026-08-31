// @ts-check

import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { buildDistributedAdmissionActivationPreflight } from "./distributed_admission_activation_preflight.mjs";
import { buildKoshaExactPromotionReviewGate } from "./kosha_exact_promotion_review_gate.mjs";
import { buildPreflight as buildRlsWikiPreflight } from "./rls_llm_wiki_approval_preflight.mjs";
import { buildShareRecipientAckApprovalPreflight } from "./share_recipient_ack_approval_preflight.mjs";

const DEFAULT_OUTPUT = "evaluation/current-source-security-stale-approval-evidence-binding-remediation-2026-08-31";

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function bindingReceipt(id, report) {
  const binding = report.approvalEvidenceBinding ?? {};
  const failedChecks = asArray(report.failedCheckIds);
  const failures = asArray(report.failures);
  const blocked = report.overall === "blocked_preflight_failed"
    || report.verdict === "REVIEW_CHECKLIST_INCOMPLETE_BLOCKED";
  const bindingFailureExposed = failedChecks.includes("approval_inputs_match_current_head_and_digest_binding")
    || failures.some((failure) => typeof failure === "string" && failure.startsWith("approval-evidence:"));
  const packetDigest = typeof binding.packetDigest === "string" ? binding.packetDigest : "";
  const artifactCount = asArray(binding.artifacts).length;
  const contractPassed = binding.schemaVersion === "safeclaw-approval-evidence-binding/v1"
    && /^[0-9a-f]{40}$/u.test(binding.sourceHead ?? "")
    && /^[0-9a-f]{64}$/u.test(packetDigest)
    && artifactCount > 0
    && (binding.verified === true || (blocked && bindingFailureExposed));
  return {
    id,
    overall: report.overall ?? null,
    verdict: report.verdict ?? null,
    bindingVerified: binding.verified === true,
    bindingFailureExposed,
    blocked,
    sourceHead: binding.sourceHead ?? null,
    productionCommit: binding.productionCommit ?? null,
    artifactCount,
    packetDigest,
    bindingFailures: asArray(binding.failures),
    contractPassed,
  };
}

export function buildStaleApprovalEvidenceBindingRemediation(root) {
  const rows = [
    bindingReceipt("rls_llm_wiki", buildRlsWikiPreflight({ root })),
    bindingReceipt("distributed_admission", buildDistributedAdmissionActivationPreflight({ root })),
    bindingReceipt("share_recipient_ack", buildShareRecipientAckApprovalPreflight({ root })),
    bindingReceipt("kosha_exact_promotion", buildKoshaExactPromotionReviewGate({
      rootDir: root,
      reviewPath: "evaluation/kosha-exact-promotion-review-gate-2026-07-22/review-template.json",
    })),
  ];
  const passedCount = rows.filter((row) => row.contractPassed).length;
  return {
    schemaVersion: "safeclaw-stale-approval-evidence-binding-remediation/v1",
    generatedAt: new Date().toISOString(),
    sourceHead: rows[0]?.sourceHead ?? null,
    verdict: passedCount === rows.length
      ? "PASS_CURRENT_SOURCE_STALE_APPROVAL_EVIDENCE_BINDING_FAIL_CLOSED"
      : "RED_CURRENT_SOURCE_STALE_APPROVAL_EVIDENCE_BINDING_INCOMPLETE",
    finding: {
      findingId: "csf_86ec127fb3d5b7d397649611",
      occurrenceId: "occ_23bd4bcc20f50a7e11e7bc19",
      ruleId: "approval-integrity.stale-evidence-binding",
      immutableOriginalFindingBaselinePreserved: true,
    },
    workflowCount: rows.length,
    passedCount,
    failedCount: rows.length - passedCount,
    rows,
    contract: {
      currentHeadRequired: true,
      productionCommitRequired: true,
      everyRequiredInputSha256Bound: true,
      currentHeadTrackedBlobMatchRequired: true,
      mixedSourceLiveEvidenceFailsClosed: true,
      deterministicPacketDigestRequired: true,
      mutationApprovalRemainsSeparate: true,
    },
    mutationBoundary: {
      dbMutationPerformed: false,
      providerDispatchCalled: false,
      shareSessionCreated: false,
      vectorOrEmbeddingMutationPerformed: false,
      wikiPublicationPerformed: false,
      koshaRegistryMutationPerformed: false,
      exactSavedShareVerdict: "MISSING_EVIDENCE",
    },
    remainingBoundary: {
      freshFullRepositorySecurityRescanRequiredForClosure: true,
      approvalGatedMutationsRemainClosed: true,
    },
  };
}

function renderMarkdown(report) {
  const rows = report.rows.map((row) => (
    `| ${row.id} | ${row.contractPassed ? "PASS" : "RED"} | ${row.bindingVerified} | ${row.blocked} | ${row.artifactCount} | \`${row.packetDigest}\` |`
  )).join("\n");
  return `# Current-source stale approval evidence binding remediation

- Verdict: \`${report.verdict}\`
- Source HEAD: \`${report.sourceHead}\`
- Finding: \`${report.finding.findingId}\` / \`${report.finding.ruleId}\`
- Workflow contracts: \`${report.passedCount}/${report.workflowCount}\`

| Workflow | Contract | Binding verified | Blocked | Inputs | Packet digest |
| --- | --- | --- | --- | --- | --- |
${rows}

## Boundary

- Historical or mixed evidence is retained as evidence and fails closed instead of being rewritten as current.
- No DB, provider, Share-session, vector, Wiki, or KOSHA registry mutation occurred.
- Exact saved Share remains \`${report.mutationBoundary.exactSavedShareVerdict}\`.
- A fresh full repository security rescan is still required before any security-complete claim.
`;
}

function parseArgs(argv) {
  const args = { root: process.cwd(), output: DEFAULT_OUTPUT };
  for (let index = 2; index < argv.length; index += 1) {
    const value = argv[index];
    const next = argv[index + 1];
    if (value === "--root" && next) {
      args.root = next;
      index += 1;
    } else if (value === "--output" && next) {
      args.output = next;
      index += 1;
    } else {
      throw new Error(`Unknown or incomplete argument: ${value}`);
    }
  }
  return args;
}

async function main() {
  const args = parseArgs(process.argv);
  const root = resolve(args.root);
  const output = resolve(root, args.output);
  const report = buildStaleApprovalEvidenceBindingRemediation(root);
  mkdirSync(output, { recursive: true });
  writeFileSync(resolve(output, "report.json"), `${JSON.stringify(report, null, 2)}\n`);
  writeFileSync(resolve(output, "report.md"), renderMarkdown(report));
  process.stdout.write(`${JSON.stringify({ output, verdict: report.verdict, passedCount: report.passedCount }, null, 2)}\n`);
  if (report.failedCount > 0) process.exitCode = 1;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.stack : String(error)}\n`);
    process.exitCode = 1;
  });
}
