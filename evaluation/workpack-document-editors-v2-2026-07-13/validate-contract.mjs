import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { basename, join, resolve } from "node:path";

const SPEC_DIRECTORY = "evaluation/workpack-document-editors-v2-2026-07-13";
const SPEC_JSON_PATH = `${SPEC_DIRECTORY}/spec.json`;
const SPEC_MARKDOWN_PATH = `${SPEC_DIRECTORY}/spec.md`;
const VALIDATOR_PATH = `${SPEC_DIRECTORY}/validate-contract.mjs`;
const EVIDENCE_PATH = `${SPEC_DIRECTORY}/review-evidence.json`;
const FULL_SHA = /^[0-9a-f]{40}$/u;
const HEX_SHA256 = /^[0-9a-f]{64}$/u;
const TYPED_SHA256 = /^sha256:[0-9a-f]{64}$/u;
const DOCUMENT_KEYS = [
  "workpackSummaryDraft",
  "riskAssessmentDraft",
  "workPlanDraft",
  "workPermitDraft",
  "tbmBriefing",
  "tbmLogDraft",
  "safetyEducationRecordDraft",
  "emergencyResponseDraft",
  "photoEvidenceDraft",
  "foreignWorkerBriefing",
  "foreignWorkerTransmission",
  "kakaoMessage"
];
const DOCUMENT_WAVES = new Map([
  ["workpackSummaryDraft", "wave3"],
  ["riskAssessmentDraft", "wave1"],
  ["workPlanDraft", "wave2"],
  ["workPermitDraft", "wave2"],
  ["tbmBriefing", "wave1"],
  ["tbmLogDraft", "wave1"],
  ["safetyEducationRecordDraft", "wave2"],
  ["emergencyResponseDraft", "wave3"],
  ["photoEvidenceDraft", "wave3"],
  ["foreignWorkerBriefing", "wave4"],
  ["foreignWorkerTransmission", "wave4"],
  ["kakaoMessage", "wave4"]
]);
const EXPECTED_RAW_KINDS = [
  "safety_reference_item",
  "ontology_law",
  "ontology_sif",
  "ontology_kosha_guidance",
  "photo_candidate",
  "field_record"
];
const EXPECTED_EXPORT_SEAMS = [
  ["EXPORT-XLSX", "server_post", "downloadXlsx", "app/api/export/xlsx/route.ts", "POST"],
  ["EXPORT-PDF", "server_post", "printPdf", "app/api/export/pdf/route.ts", "POST"],
  ["EXPORT-HWP", "server_binary_post", "downloadHwp", "app/api/export/hwp/route.ts", "POST"],
  ["EXPORT-HWPX-CLIENT", "client_builder", "buildHwpxWithRhwp -> downloadHwpx", null, null]
];
const DELIBERATE_CASES = new Set([
  "normative-parity",
  "md-prose",
  "json-model",
  "json-document-primary-action",
  "json-unknown-domain",
  "source-shape",
  "target-ref",
  "spec-ref",
  "implementation-empty",
  "approval-boolean",
  "command-unbound-hash",
  "browser-pass-flag",
  "browser-cumulative-scale",
  "browser-inner-transform",
  "browser-cross-parent-overlap",
  "browser-fixed-offscreen",
  "browser-sticky-cover",
  "browser-horizontal-clip",
  "browser-vertical-clip",
  "browser-nested-scroll",
  "browser-textarea-scroll",
  "browser-inner-zoom",
  "browser-mobile-late",
  "browser-ratio-reflow",
  "browser-pixel-viewport-scale"
]);

function parseArguments(argv) {
  const mode = argv[0] ?? "";
  const result = {
    mode,
    root: process.cwd(),
    manifest: EVIDENCE_PATH,
    evidence: "",
    candidate: "",
    sourceBase: "",
    target: "",
    spec: "",
    base: "",
    head: "",
    approvalEvidence: "",
    approvalManifest: "",
    specFile: SPEC_JSON_PATH,
    deliberate: ""
  };
  for (let index = 1; index < argv.length; index += 1) {
    const argument = argv[index];
    const next = () => {
      index += 1;
      if (index >= argv.length) throw new Error(`Missing value for ${argument}`);
      return argv[index];
    };
    if (argument === "--root") result.root = next();
    else if (argument === "--manifest") result.manifest = next();
    else if (argument === "--evidence") result.evidence = next();
    else if (argument === "--candidate") result.candidate = next();
    else if (argument === "--source-base") result.sourceBase = next();
    else if (argument === "--target") result.target = next();
    else if (argument === "--spec") result.spec = next();
    else if (argument === "--base") result.base = next();
    else if (argument === "--head") result.head = next();
    else if (argument === "--approval-evidence") result.approvalEvidence = next();
    else if (argument === "--approval-manifest") result.approvalManifest = next();
    else if (argument === "--spec-file") result.specFile = next();
    else if (argument === "--deliberate") result.deliberate = next();
    else throw new Error(`Unknown argument: ${argument}`);
  }
  if (result.deliberate && !DELIBERATE_CASES.has(result.deliberate)) {
    throw new Error(`Unknown deliberate case: ${result.deliberate}`);
  }
  return result;
}

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, canonicalize(value[key])])
    );
  }
  return value;
}

function canonicalJson(value) {
  return JSON.stringify(canonicalize(value));
}

function sha256(bufferOrText) {
  return createHash("sha256").update(bufferOrText).digest("hex");
}

function escapeCell(value) {
  return canonicalJson(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("|", "&#124;")
    .replaceAll("\r", "\\r")
    .replaceAll("\n", "\\n");
}

function renderTable(lines, heading, headers, rows) {
  lines.push(`### ${heading}`, "");
  lines.push(`| ${headers.join(" | ")} |`);
  lines.push(`| ${headers.map(() => "---").join(" | ")} |`);
  for (const row of rows) lines.push(`| ${row.map(escapeCell).join(" | ")} |`);
  lines.push("");
}

function valueKind(value) {
  if (Array.isArray(value)) return "array";
  if (value === null) return "null";
  return typeof value;
}

function directChildCount(value) {
  if (Array.isArray(value)) return value.length;
  if (value !== null && typeof value === "object") return Object.keys(value).length;
  return 0;
}

function recursiveLeafCount(value) {
  if (Array.isArray(value)) return value.reduce((total, child) => total + recursiveLeafCount(child), 0);
  if (value !== null && typeof value === "object") {
    return Object.values(value).reduce((total, child) => total + recursiveLeafCount(child), 0);
  }
  return 1;
}

function maximumDepth(value) {
  const children = Array.isArray(value)
    ? value
    : value !== null && typeof value === "object"
      ? Object.values(value)
      : [];
  return children.length === 0 ? 0 : 1 + Math.max(...children.map(maximumDepth));
}

function structuralRow(path, value, includeValue = true) {
  const normalized = canonicalJson(value);
  return [
    path,
    valueKind(value),
    directChildCount(value),
    recursiveLeafCount(value),
    maximumDepth(value),
    `sha256:${sha256(normalized)}`,
    includeValue ? value : "<bound by complete top-level domain rows>"
  ];
}

function structuralRows(spec) {
  const rows = [structuralRow("$", spec, false)];
  for (const key of Object.keys(spec).sort()) {
    const value = spec[key];
    rows.push(structuralRow(key, value));
  }
  return rows;
}

function renderNormativeMarkdown(spec) {
  const lines = [
    "<!-- SAFECLAW-NORMATIVE:BEGIN -->",
    "",
    "### Complete Structural Contract",
    "",
    "Every top-level JSON domain is enumerated without an allowlist. Each domain row contains its complete canonical normalized value, including all nested fields; the root row independently binds the whole contract.",
    ""
  ];
  renderTable(
    lines,
    "Normalized Domains",
    ["Path", "Kind", "Direct children", "Recursive leaves", "Max depth", "Canonical SHA-256", "Canonical normalized value"],
    structuralRows(spec)
  );
  lines.push("<!-- SAFECLAW-NORMATIVE:END -->");
  return lines.join("\n");
}

function renderHumanMarkdown(spec) {
  const contract = spec.humanParityContract;
  const lines = [
    contract.humanStart,
    "",
    "### Human Normative Requirements",
    ""
  ];
  for (const [id, title, requirement] of contract.humanRequirements) {
    lines.push(`- **${id} ${title}:** ${requirement}`);
  }
  lines.push("", contract.humanEnd);
  return lines.join("\n");
}

function gitBuffer(root, args) {
  return execFileSync("git", args, {
    cwd: root,
    encoding: null,
    stdio: ["ignore", "pipe", "pipe"]
  });
}

function gitText(root, args) {
  return gitBuffer(root, args).toString("utf8").trim();
}

function resolveCommit(root, value, label, requireFull = true) {
  if (!value) throw new Error(`${label} is required and must be non-empty`);
  if (requireFull && !FULL_SHA.test(value)) throw new Error(`${label} must be an explicit 40-character commit SHA`);
  const resolved = gitText(root, ["rev-parse", `${value}^{commit}`]);
  if (!FULL_SHA.test(resolved)) throw new Error(`${label} did not resolve to a commit`);
  if (requireFull && resolved !== value) throw new Error(`${label} must already be the resolved commit SHA`);
  return resolved;
}

function readBlob(root, commit, path) {
  return gitBuffer(root, ["show", `${commit}:${path}`]);
}

function blobOid(root, commit, path) {
  return gitText(root, ["rev-parse", `${commit}:${path}`]);
}

function commitPaths(root, commit) {
  const output = gitText(root, ["diff-tree", "--no-commit-id", "--name-only", "-r", commit]);
  return output ? output.split(/\r?\n/u).sort() : [];
}

function commitParent(root, commit) {
  return gitText(root, ["rev-parse", `${commit}^`]);
}

function parseJsonBuffer(buffer, label) {
  try {
    return JSON.parse(buffer.toString("utf8"));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`${label} is not valid JSON: ${message}`);
  }
}

function extractMarkedBlock(markdown, start, end) {
  const startIndex = markdown.indexOf(start);
  const endIndex = markdown.indexOf(end);
  if (startIndex < 0 || endIndex <= startIndex) throw new Error("Markdown normative markers are missing or out of order");
  return markdown.slice(startIndex, endIndex + end.length);
}

function replaceMarkedBlock(markdown, start, end, placeholder) {
  const block = extractMarkedBlock(markdown, start, end);
  return markdown.replace(block, `${start}\n${placeholder}\n${end}`);
}

function normalizedMarkdownProse(markdown, contract) {
  const withoutStructural = replaceMarkedBlock(
    markdown,
    contract.markdownStart,
    contract.markdownEnd,
    "<STRUCTURAL-CONTRACT>"
  );
  const withoutHuman = replaceMarkedBlock(
    withoutStructural,
    contract.humanStart,
    contract.humanEnd,
    "<HUMAN-REQUIREMENTS>"
  );
  return withoutHuman.replaceAll("\r\n", "\n");
}

function sortedCanonical(value) {
  return canonicalJson([...value].sort());
}

function validateCandidateArtifactManifest(root, manifest, candidate, spec) {
  const expectedPaths = [...spec.validation.candidateArtifacts].sort();
  const records = manifest.candidateArtifacts;
  if (!Array.isArray(records)) throw new Error("manifest candidateArtifacts is missing");
  const actualPaths = records.map((record) => record.path).sort();
  if (canonicalJson(actualPaths) !== canonicalJson(expectedPaths)) {
    throw new Error("manifest candidate artifact paths differ from candidate scope");
  }
  for (const record of records) {
    const buffer = readBlob(root, candidate, record.path);
    if (record.gitBlob !== blobOid(root, candidate, record.path)) throw new Error(`candidate blob OID mismatch: ${record.path}`);
    if (record.sha256 !== sha256(buffer)) throw new Error(`candidate SHA-256 mismatch: ${record.path}`);
    if (record.bytes !== buffer.byteLength) throw new Error(`candidate byte count mismatch: ${record.path}`);
  }
}

function loadAndValidateTargetBlobs(root, manifest, target, spec) {
  const expectedPaths = [...spec.validation.targetBlobPaths].sort();
  const records = manifest.targetBlobs;
  if (!Array.isArray(records)) throw new Error("manifest targetBlobs is missing");
  const actualPaths = records.map((record) => record.path).sort();
  if (canonicalJson(actualPaths) !== canonicalJson(expectedPaths)) {
    throw new Error("manifest target blob paths differ from candidate targetBlobPaths");
  }
  const blobs = new Map();
  for (const record of records) {
    const buffer = readBlob(root, target, record.path);
    if (record.gitBlob !== blobOid(root, target, record.path)) throw new Error(`target blob OID mismatch: ${record.path}`);
    if (record.sha256 !== sha256(buffer)) throw new Error(`target SHA-256 mismatch: ${record.path}`);
    if (record.bytes !== buffer.byteLength) throw new Error(`target byte count mismatch: ${record.path}`);
    blobs.set(record.path, buffer.toString("utf8"));
  }
  return blobs;
}

function validateBoundBlob(root, commit, record, label) {
  if (!record || typeof record.path !== "string" || record.path.length === 0) {
    throw new Error(`${label} blob record is missing a path`);
  }
  const buffer = readBlob(root, commit, record.path);
  if (record.gitBlob !== blobOid(root, commit, record.path)) throw new Error(`${label} git blob mismatch`);
  if (record.sha256 !== sha256(buffer)) throw new Error(`${label} SHA-256 mismatch`);
  if (record.bytes !== buffer.byteLength) throw new Error(`${label} byte count mismatch`);
  return buffer;
}

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function findForbiddenKey(value, forbidden, path = "$") {
  if (Array.isArray(value)) {
    for (let index = 0; index < value.length; index += 1) {
      const found = findForbiddenKey(value[index], forbidden, `${path}[${index}]`);
      if (found) return found;
    }
    return null;
  }
  if (!isRecord(value)) return null;
  for (const [key, child] of Object.entries(value)) {
    if (forbidden.has(key)) return `${path}.${key}`;
    const found = findForbiddenKey(child, forbidden, `${path}.${key}`);
    if (found) return found;
  }
  return null;
}

function requireString(value, label) {
  if (typeof value !== "string" || value.trim().length === 0) throw new Error(`${label} must be a non-empty string`);
  return value;
}

function requireIsoDateTime(value, label) {
  requireString(value, label);
  if (!Number.isFinite(Date.parse(value))) throw new Error(`${label} must be an ISO date-time`);
  return value;
}

function requireTypedSha256(value, label) {
  if (typeof value !== "string" || !TYPED_SHA256.test(value)) {
    throw new Error(`${label} must be sha256:<64 lowercase hex>`);
  }
  return value;
}

function validateTypedBoundBlob(root, commit, record, label) {
  if (!record || typeof record.path !== "string" || record.path.length === 0) {
    throw new Error(`${label} blob record is missing a path`);
  }
  requireTypedSha256(record.sha256, `${label}.sha256`);
  const buffer = readBlob(root, commit, record.path);
  if (record.gitBlob !== blobOid(root, commit, record.path)) throw new Error(`${label} git blob mismatch`);
  if (record.sha256 !== `sha256:${sha256(buffer)}`) throw new Error(`${label} SHA-256 mismatch`);
  if (record.bytes !== buffer.byteLength) throw new Error(`${label} byte count mismatch`);
  return buffer;
}

function validateApprovalManifestShape(manifest) {
  if (!isRecord(manifest)) throw new Error("external approval manifest must be an object");
  const forbidden = findForbiddenKey(manifest, new Set(["approvals", "approved", "pass"]));
  if (forbidden) throw new Error(`external approval manifest contains forbidden self-assertion ${forbidden}`);
  if (manifest.kind !== "safeclaw-external-approval-manifest/v1") {
    throw new Error("external approval manifest kind differs");
  }
  if (!FULL_SHA.test(requireString(manifest.specCommit, "approval specCommit"))) throw new Error("approval specCommit must be a full SHA");
  if (!FULL_SHA.test(requireString(manifest.targetSha, "approval targetSha"))) throw new Error("approval targetSha must be a full SHA");
  requireTypedSha256(manifest.migrationRpcProposalDigest, "approval migrationRpcProposalDigest");
  requireString(manifest.approvalRootOperationId, "approvalRootOperationId");
  if (!isRecord(manifest.migrationRpcProposal)) throw new Error("external approval manifest must bind the proposal blob");
  if (!Array.isArray(manifest.events) || manifest.events.length !== 2) {
    throw new Error("external approval manifest must contain exactly two external events");
  }
  const eventTypes = manifest.events.map((event) => event.type).sort();
  if (canonicalJson(eventTypes) !== canonicalJson(["INDEPENDENT_SPEC_PASS", "USER_DB_AUTHORITY_APPROVAL"])) {
    throw new Error("external approval event types differ");
  }
}

function validateExternalApproval(root, args, spec, specCommit, base, head, implementationEvidence) {
  const forbidden = findForbiddenKey(implementationEvidence, new Set(["approvals", "approved", "pass", "passed"]));
  if (forbidden) throw new Error(`implementation evidence contains forbidden self-assertion ${forbidden}`);
  const approvalCommit = resolveCommit(root, args.approvalEvidence, "external approval evidence");
  for (const [label, commit] of [["spec", specCommit], ["implementation evidence", args.evidence], ["base", base], ["head", head]]) {
    if (approvalCommit === commit) throw new Error(`external approval evidence must be separate from ${label}`);
  }
  const approvalPath = requireString(args.approvalManifest, "--approval-manifest");
  const approval = parseJsonBuffer(readBlob(root, approvalCommit, approvalPath), "external approval manifest");
  validateApprovalManifestShape(approval);
  if (approval.specCommit !== specCommit || approval.targetSha !== spec.meta.currentIntegrationTarget || base !== approval.targetSha) {
    throw new Error("external approval manifest is not bound to the immutable spec and exact implementation target/base");
  }
  if (
    implementationEvidence.approvalEvidenceCommit !== approvalCommit ||
    implementationEvidence.approvalManifestPath !== approvalPath ||
    implementationEvidence.migrationRpcProposalDigest !== approval.migrationRpcProposalDigest ||
    implementationEvidence.approvalRootOperationId !== approval.approvalRootOperationId
  ) {
    throw new Error("implementation evidence approval binding differs from external approval manifest");
  }
  const proposalBuffer = validateTypedBoundBlob(root, approvalCommit, approval.migrationRpcProposal, "migration/RPC proposal");
  if (`sha256:${sha256(proposalBuffer)}` !== approval.migrationRpcProposalDigest) {
    throw new Error("migration/RPC proposal digest differs from its actual blob");
  }
  for (const event of approval.events) {
    requireString(event.eventId, `${event.type}.eventId`);
    requireString(event.producer, `${event.type}.producer`);
    requireString(event.repository, `${event.type}.repository`);
    requireString(event.actorId, `${event.type}.actorId`);
    requireString(event.actorLogin, `${event.type}.actorLogin`);
    requireIsoDateTime(event.occurredAt, `${event.type}.occurredAt`);
    if (event.decision !== "APPROVED") throw new Error(`${event.type} decision is not the external APPROVED event`);
    if (
      event.repository !== "seojaehong/safeguard-contest-mvp" ||
      event.specCommit !== specCommit ||
      event.targetSha !== approval.targetSha ||
      event.migrationRpcProposalDigest !== approval.migrationRpcProposalDigest ||
      event.approvalRootOperationId !== approval.approvalRootOperationId
    ) {
      throw new Error(`${event.type} binding differs from approval manifest`);
    }
    const expectedProducer = event.type === "INDEPENDENT_SPEC_PASS" ? "github-review-event" : "codex-user-approval-event";
    if (event.producer !== expectedProducer) throw new Error(`${event.type} producer is not the required external event source`);
    const raw = parseJsonBuffer(
      validateTypedBoundBlob(root, approvalCommit, event.rawEvent, `${event.type} raw external event`),
      `${event.type} raw external event`
    );
    for (const field of ["type", "eventId", "producer", "repository", "actorId", "actorLogin", "occurredAt", "decision", "specCommit", "targetSha", "migrationRpcProposalDigest", "approvalRootOperationId"]) {
      if (raw[field] !== event[field]) throw new Error(`${event.type} raw event field differs: ${field}`);
    }
  }
  return { approvalCommit, approval };
}

function validateExecutionReceiptShape(receipt) {
  if (!isRecord(receipt)) throw new Error("execution receipt must be an object");
  const forbidden = findForbiddenKey(receipt, new Set(["command", "outputSha256", "pass", "passed", "approved"]));
  if (forbidden) throw new Error(`execution receipt contains forbidden unbound assertion ${forbidden}`);
  if (receipt.kind !== "safeclaw-command-execution-receipt/v1") throw new Error("execution receipt kind differs");
  requireString(receipt.sourceSha, "execution sourceSha");
  requireString(receipt.buildId, "execution buildId");
  requireString(receipt.commandId, "execution commandId");
  requireString(receipt.cwd, "execution cwd");
  requireIsoDateTime(receipt.startedAt, "execution startedAt");
  requireIsoDateTime(receipt.completedAt, "execution completedAt");
  if (!Array.isArray(receipt.commandArgv) || receipt.commandArgv.length === 0 || receipt.commandArgv.some((item) => typeof item !== "string" || item.length === 0)) {
    throw new Error("execution commandArgv must be a non-empty string array");
  }
  if (!Number.isInteger(receipt.exitCode)) throw new Error("execution exitCode must come from the loaded receipt");
  for (const field of ["producer", "runId", "jobId"]) requireString(receipt[field], `execution ${field}`);
  if (!receipt.stdout || !receipt.stderr || !Array.isArray(receipt.artifacts)) {
    throw new Error("execution receipt must bind stdout, stderr, and artifact blobs");
  }
}

function validateCommandArgv(spec, receipt, context) {
  const { base, head, declaredWaves } = context;
  const exact = {
    typecheck: ["npm.cmd", "run", "typecheck"],
    build: ["npm.cmd", "run", "build"],
    "diff-check": ["git", "diff", "--check", `${base}...${head}`, "--"],
    browser: ["npx.cmd", "playwright", "test", "tests/workpack-editor-browser-matrix.test.ts"]
  };
  if (Object.hasOwn(exact, receipt.commandId)) {
    if (canonicalJson(receipt.commandArgv) !== canonicalJson(exact[receipt.commandId])) {
      throw new Error(`execution argv differs for ${receipt.commandId}`);
    }
    return;
  }
  if (receipt.commandId !== "wave-tests") throw new Error(`unknown execution commandId ${receipt.commandId}`);
  const prefix = ["npx.cmd", "vitest", "run"];
  if (canonicalJson(receipt.commandArgv.slice(0, 3)) !== canonicalJson(prefix)) throw new Error("wave-tests argv prefix differs");
  const allowedTests = new Set(
    spec.implementation.waves
      .filter((wave) => declaredWaves.includes(wave.id))
      .flatMap((wave) => wave.testFiles)
  );
  const flags = new Set(["--maxWorkers=1", "--no-file-parallelism"]);
  const testArgs = receipt.commandArgv.slice(3).filter((item) => !flags.has(item));
  if (testArgs.length === 0 || testArgs.some((item) => !allowedTests.has(item))) {
    throw new Error("wave-tests argv contains no owned test or an undeclared test");
  }
}

function validateExecutionEvidence(root, evidenceCommit, manifest, spec, context) {
  if (!Array.isArray(manifest.executions) || manifest.executions.length === 0) {
    throw new Error("implementation manifest has no receipt-bound executions");
  }
  if (Object.hasOwn(manifest, "executedCommands")) throw new Error("free-form executedCommands is forbidden");
  const receiptById = new Map();
  for (const reference of manifest.executions) {
    const receipt = parseJsonBuffer(
      validateTypedBoundBlob(root, evidenceCommit, reference.receipt, `execution receipt ${reference.id ?? "unknown"}`),
      `execution receipt ${reference.id ?? "unknown"}`
    );
    validateExecutionReceiptShape(receipt);
    if (reference.id !== receipt.commandId || receiptById.has(receipt.commandId)) {
      throw new Error("execution receipt IDs are missing, duplicated, or mismatched");
    }
    if (receipt.sourceSha !== context.head || receipt.buildId !== manifest.buildId) {
      throw new Error(`${receipt.commandId} source SHA/build ID differs from implementation evidence`);
    }
    if (receipt.exitCode !== 0) throw new Error(`${receipt.commandId} loaded receipt exitCode is nonzero`);
    validateCommandArgv(spec, receipt, context);
    validateTypedBoundBlob(root, evidenceCommit, receipt.stdout, `${receipt.commandId} stdout`);
    validateTypedBoundBlob(root, evidenceCommit, receipt.stderr, `${receipt.commandId} stderr`);
    for (const artifact of receipt.artifacts) {
      validateTypedBoundBlob(root, evidenceCommit, artifact, `${receipt.commandId} artifact ${artifact.path}`);
    }
    receiptById.set(receipt.commandId, receipt);
  }
  for (const id of ["typecheck", "diff-check", "wave-tests"]) {
    if (!receiptById.has(id)) throw new Error(`required execution receipt is missing: ${id}`);
  }
  if (context.declaredWaves.includes("wave5") && !receiptById.has("build")) throw new Error("Wave 5 build receipt is missing");
  return receiptById;
}

function requireFiniteNumber(value, label) {
  if (typeof value !== "number" || !Number.isFinite(value)) throw new Error(`${label} must be a finite number`);
  return value;
}

function validateRect(rect, label) {
  if (!isRecord(rect)) throw new Error(`${label} must be a DOMRect record`);
  for (const field of ["x", "y", "width", "height"]) requireFiniteNumber(rect[field], `${label}.${field}`);
  if (rect.width < 0 || rect.height < 0) throw new Error(`${label} has a negative dimension`);
}

function rectangleIntersectionArea(left, right) {
  const width = Math.max(0, Math.min(left.x + left.width, right.x + right.width) - Math.max(left.x, right.x));
  const height = Math.max(0, Math.min(left.y + left.height, right.y + right.height) - Math.max(left.y, right.y));
  return width * height;
}

function validatePageMetrics(page, label) {
  if (!isRecord(page)) throw new Error(`${label} page metrics are missing`);
  for (const field of ["clientWidth", "scrollWidth", "clientHeight", "scrollHeight"]) {
    requireFiniteNumber(page[field], `${label}.page.${field}`);
  }
  if (page.scrollWidth > page.clientWidth + 1) throw new Error(`${label} document has horizontal overflow`);
}

function validateNode(node, label) {
  if (!isRecord(node)) throw new Error(`${label} node is not an object`);
  requireString(node.id, `${label}.id`);
  if (node.parentId !== null) requireString(node.parentId, `${label}.parentId`);
  if (typeof node.visible !== "boolean" || typeof node.interactive !== "boolean") {
    throw new Error(`${label} visibility/interactivity must be raw booleans`);
  }
  validateRect(node.rect, `${label}.rect`);
  for (const field of ["clientWidth", "scrollWidth", "clientHeight", "scrollHeight", "lineCount"]) {
    requireFiniteNumber(node[field], `${label}.${field}`);
  }
  if (!Number.isInteger(node.lineCount) || node.lineCount < 0) throw new Error(`${label}.lineCount must be a non-negative integer`);
  if (!isRecord(node.computed)) throw new Error(`${label}.computed is missing`);
  for (const field of ["fontSize", "lineHeight", "zoom"]) requireFiniteNumber(node.computed[field], `${label}.computed.${field}`);
  for (const field of ["overflowX", "overflowY", "position", "transform", "textSizeAdjust", "maxHeight"]) {
    requireString(node.computed[field], `${label}.computed.${field}`);
  }
  if (node.computed.transform !== "none") throw new Error(`${label} uses an inner transform`);
  if (node.computed.zoom !== 1) throw new Error(`${label} uses inner CSS zoom`);
  if (node.computed.textSizeAdjust !== "100%") throw new Error(`${label} changes text-size-adjust`);
}

function indexSnapshot(snapshot, label) {
  if (!isRecord(snapshot) || !Array.isArray(snapshot.nodes)) throw new Error(`${label} snapshot is missing nodes`);
  validatePageMetrics(snapshot.page, label);
  const nodes = new Map();
  for (const node of snapshot.nodes) {
    validateNode(node, `${label}.${node?.id ?? "unknown"}`);
    if (nodes.has(node.id)) throw new Error(`${label} contains duplicate node ${node.id}`);
    nodes.set(node.id, node);
  }
  for (const node of nodes.values()) {
    if (node.parentId !== null && !nodes.has(node.parentId)) throw new Error(`${label}.${node.id} has an unknown parent`);
    const visited = new Set([node.id]);
    let parentId = node.parentId;
    while (parentId !== null) {
      if (visited.has(parentId)) throw new Error(`${label}.${node.id} has a parent cycle`);
      visited.add(parentId);
      parentId = nodes.get(parentId).parentId;
    }
  }
  return nodes;
}

function requireNodeIds(sidecar, nodes, field, allowEmpty = false) {
  const ids = sidecar[field];
  if (!Array.isArray(ids) || (!allowEmpty && ids.length === 0) || ids.some((id) => typeof id !== "string" || !nodes.has(id))) {
    throw new Error(`browser sidecar ${field} is empty or references an unknown node`);
  }
  if (new Set(ids).size !== ids.length) throw new Error(`browser sidecar ${field} contains duplicate IDs`);
  return ids;
}

function validateSnapshotGeometry(sidecar, snapshotName, nodes, drawerIds) {
  const tolerance = 1;
  const clippingValues = new Set(["hidden", "clip", "auto", "scroll"]);
  for (const node of nodes.values()) {
    if (!node.visible) continue;
    if (node.interactive && (node.rect.width < 44 || node.rect.height < 44)) {
      throw new Error(`${snapshotName}.${node.id} interactive target is smaller than 44x44`);
    }
    if (["fixed", "sticky"].includes(node.computed.position)) {
      if (
        node.rect.x < -tolerance ||
        node.rect.y < -tolerance ||
        node.rect.x + node.rect.width > sidecar.viewportWidth + tolerance ||
        node.rect.y + node.rect.height > sidecar.viewportHeight + tolerance
      ) {
        throw new Error(`${snapshotName}.${node.id} fixed/sticky rect escapes the viewport`);
      }
    }
    if (
      !drawerIds.has(node.id) &&
      ["auto", "scroll"].includes(node.computed.overflowY) &&
      node.scrollHeight > node.clientHeight + tolerance
    ) {
      throw new Error(`${snapshotName}.${node.id} creates nested vertical scroll`);
    }
    let parentId = node.parentId;
    while (parentId !== null) {
      const parent = nodes.get(parentId);
      if (parent.visible) {
        if (
          clippingValues.has(parent.computed.overflowX) &&
          (node.rect.x < parent.rect.x - tolerance || node.rect.x + node.rect.width > parent.rect.x + parent.rect.width + tolerance)
        ) {
          throw new Error(`${snapshotName}.${node.id} is horizontally clipped by ${parent.id}`);
        }
        if (
          clippingValues.has(parent.computed.overflowY) &&
          (node.rect.y < parent.rect.y - tolerance || node.rect.y + node.rect.height > parent.rect.y + parent.rect.height + tolerance)
        ) {
          throw new Error(`${snapshotName}.${node.id} is vertically clipped by ${parent.id}`);
        }
      }
      parentId = parent.parentId;
    }
  }
}

function validateBrowserTypographySidecar(sidecar, context = {}) {
  if (!isRecord(sidecar)) throw new Error("browser sidecar must be an object");
  const forbidden = findForbiddenKey(sidecar, new Set(["pass", "passed", "result", "outputSha256", "claimedMetrics"]));
  if (forbidden) throw new Error(`browser sidecar contains forbidden self-assertion ${forbidden}`);
  if (sidecar.kind !== "safeclaw-browser-typography-sidecar/v1") throw new Error("browser sidecar kind differs");
  if (!FULL_SHA.test(sidecar.sourceSha)) throw new Error("browser sidecar sourceSha must be a full SHA");
  requireString(sidecar.buildId, "browser sidecar buildId");
  requireString(sidecar.fixtureId, "browser sidecar fixtureId");
  if (!new Set(["Chromium", "Firefox", "WebKit"]).has(sidecar.browser)) throw new Error("browser sidecar browser differs");
  if (!new Set(["desktop1440", "mobile390"]).has(sidecar.viewportId)) throw new Error("browser sidecar viewport differs");
  if (!new Set(["day", "night"]).has(sidecar.theme)) throw new Error("browser sidecar theme differs");
  if (!DOCUMENT_KEYS.includes(sidecar.documentKey)) throw new Error("browser sidecar documentKey differs");
  const expectedViewport = sidecar.viewportId === "desktop1440" ? [1440, 1000] : [390, 844];
  if (sidecar.viewportWidth !== expectedViewport[0] || sidecar.viewportHeight !== expectedViewport[1]) {
    throw new Error("browser sidecar viewport dimensions differ");
  }
  for (const field of ["deviceScaleFactor", "devicePixelRatio", "visualViewportScale"]) {
    if (sidecar[field] !== 1) throw new Error(`browser sidecar ${field} must remain 1`);
  }
  if (sidecar.applicationCount !== 1 || sidecar.baselineRootScale !== 1 || sidecar.scaledRootScale !== 2) {
    throw new Error("browser sidecar shows cumulative or incorrect root typography scaling");
  }
  if (sidecar.baselinePolicy !== "baseline" || sidecar.scaledPolicy !== "double") {
    throw new Error("browser sidecar root typography policy differs");
  }
  if (sidecar.structuredGapPx !== 8) throw new Error("browser sidecar structured editor gap is not 8px");
  if (context.sourceSha && sidecar.sourceSha !== context.sourceSha) throw new Error("browser sidecar sourceSha differs from implementation head");
  if (context.buildId && sidecar.buildId !== context.buildId) throw new Error("browser sidecar buildId differs from implementation evidence");

  const baselineNodes = indexSnapshot(sidecar.baseline, "baseline");
  const scaledNodes = indexSnapshot(sidecar.scaled, "scaled");
  if (canonicalJson([...baselineNodes.keys()].sort()) !== canonicalJson([...scaledNodes.keys()].sort())) {
    throw new Error("browser baseline/scaled node IDs differ");
  }
  const priorityIds = requireNodeIds(sidecar, scaledNodes, "priorityRegionIds");
  const reflowIds = requireNodeIds(sidecar, scaledNodes, "reflowProbeIds");
  const textareaIds = requireNodeIds(sidecar, scaledNodes, "textareaIds");
  const drawerIds = new Set(requireNodeIds(sidecar, scaledNodes, "drawerIds", true));
  requireString(sidecar.editorRootId, "browser sidecar editorRootId");
  requireString(sidecar.mobileEditorHeadingId, "browser sidecar mobileEditorHeadingId");
  if (!scaledNodes.has(sidecar.editorRootId) || !scaledNodes.has(sidecar.mobileEditorHeadingId)) {
    throw new Error("browser sidecar editor start IDs are unknown");
  }

  validateSnapshotGeometry(sidecar, "baseline", baselineNodes, drawerIds);
  validateSnapshotGeometry(sidecar, "scaled", scaledNodes, drawerIds);
  for (const id of baselineNodes.keys()) {
    const baseline = baselineNodes.get(id);
    const scaled = scaledNodes.get(id);
    if (baseline.visible && scaled.visible && typeof baseline.textRole === "string" && baseline.textRole.length > 0) {
      const fontRatio = scaled.computed.fontSize / baseline.computed.fontSize;
      const lineRatio = scaled.computed.lineHeight / baseline.computed.lineHeight;
      if (fontRatio < 1.9 || fontRatio > 2.1 || lineRatio < 1.9 || lineRatio > 2.1) {
        throw new Error(`scaled text ratio differs for ${id}`);
      }
    }
  }
  for (const id of reflowIds) {
    if (scaledNodes.get(id).lineCount <= baselineNodes.get(id).lineCount) {
      throw new Error(`designated long-text probe did not reflow: ${id}`);
    }
  }
  for (let leftIndex = 0; leftIndex < priorityIds.length; leftIndex += 1) {
    const left = scaledNodes.get(priorityIds[leftIndex]);
    if (!left.visible) continue;
    for (let rightIndex = leftIndex + 1; rightIndex < priorityIds.length; rightIndex += 1) {
      const right = scaledNodes.get(priorityIds[rightIndex]);
      if (right.visible && rectangleIntersectionArea(left.rect, right.rect) > 0) {
        throw new Error(`scaled priority regions overlap across parents: ${left.id}/${right.id}`);
      }
    }
  }
  for (const fixedOrSticky of [...scaledNodes.values()].filter((node) => node.visible && ["fixed", "sticky"].includes(node.computed.position))) {
    for (const priorityId of priorityIds) {
      const priority = scaledNodes.get(priorityId);
      if (priority.id !== fixedOrSticky.id && priority.visible && rectangleIntersectionArea(fixedOrSticky.rect, priority.rect) > 0) {
        throw new Error(`fixed/sticky node covers priority region: ${fixedOrSticky.id}/${priority.id}`);
      }
    }
  }
  for (const id of textareaIds) {
    const textarea = scaledNodes.get(id);
    if (textarea.computed.overflowY !== "hidden" || textarea.computed.maxHeight !== "none" || textarea.scrollHeight > textarea.clientHeight + 1) {
      throw new Error(`textarea ${id} has hidden inner scroll or max-height`);
    }
  }
  if (sidecar.viewportId === "mobile390") {
    if (scaledNodes.get(sidecar.editorRootId).rect.y > 200 || scaledNodes.get(sidecar.mobileEditorHeadingId).rect.y > 160) {
      throw new Error("mobile editor starts below the task-distance budget");
    }
  }
  return {
    fixtureId: sidecar.fixtureId,
    matrixKey: [sidecar.browser, sidecar.viewportId, sidecar.theme, sidecar.documentKey].join("|")
  };
}

function makeBrowserNegativeFixture(kind) {
  const computed = (fontSize, lineHeight) => ({
    fontSize,
    lineHeight,
    overflowX: "visible",
    overflowY: "visible",
    position: "static",
    transform: "none",
    zoom: 1,
    textSizeAdjust: "100%",
    maxHeight: "none"
  });
  const node = (id, parentId, rect, overrides = {}) => ({
    id,
    parentId,
    semanticRole: "region",
    textRole: "",
    visible: true,
    interactive: false,
    rect,
    clientWidth: rect.width,
    scrollWidth: rect.width,
    clientHeight: rect.height,
    scrollHeight: rect.height,
    lineCount: 0,
    computed: computed(0, 0),
    ...overrides
  });
  const baselineNodes = [
    node("surface", null, { x: 0, y: 0, width: 390, height: 1200 }),
    node("section", "surface", { x: 0, y: 100, width: 390, height: 600 }),
    node("title", "surface", { x: 0, y: 0, width: 180, height: 24 }, { textRole: "title", lineCount: 1, computed: computed(16, 24) }),
    node("editor", "section", { x: 0, y: 110, width: 390, height: 500 }),
    node("heading", "editor", { x: 0, y: 120, width: 180, height: 24 }, { textRole: "label", lineCount: 1, computed: computed(14, 20) }),
    node("textarea", "editor", { x: 0, y: 160, width: 300, height: 200 }, {
      textRole: "body",
      lineCount: 4,
      computed: { ...computed(15, 23), overflowY: "hidden" }
    })
  ];
  const scaledNodes = structuredClone(baselineNodes);
  Object.assign(scaledNodes.find((item) => item.id === "title"), {
    rect: { x: 0, y: 0, width: 180, height: 96 },
    clientHeight: 96,
    scrollHeight: 96,
    lineCount: 2,
    computed: computed(32, 48)
  });
  Object.assign(scaledNodes.find((item) => item.id === "heading"), {
    rect: { x: 0, y: 120, width: 180, height: 40 },
    clientHeight: 40,
    scrollHeight: 40,
    computed: computed(28, 40)
  });
  Object.assign(scaledNodes.find((item) => item.id === "textarea"), {
    computed: { ...computed(30, 46), overflowY: "hidden" }
  });
  const sidecar = {
    kind: "safeclaw-browser-typography-sidecar/v1",
    fixtureId: "negative-fixture",
    sourceSha: "1".repeat(40),
    buildId: "negative-build",
    browser: "Chromium",
    viewportId: "mobile390",
    viewportWidth: 390,
    viewportHeight: 844,
    theme: "day",
    documentKey: "riskAssessmentDraft",
    deviceScaleFactor: 1,
    devicePixelRatio: 1,
    visualViewportScale: 1,
    applicationCount: 1,
    baselineRootScale: 1,
    scaledRootScale: 2,
    baselinePolicy: "baseline",
    scaledPolicy: "double",
    structuredGapPx: 8,
    priorityRegionIds: ["title", "editor"],
    reflowProbeIds: ["title"],
    textareaIds: ["textarea"],
    drawerIds: [],
    editorRootId: "editor",
    mobileEditorHeadingId: "heading",
    baseline: { page: { clientWidth: 390, scrollWidth: 390, clientHeight: 844, scrollHeight: 1200 }, nodes: baselineNodes },
    scaled: { page: { clientWidth: 390, scrollWidth: 390, clientHeight: 844, scrollHeight: 1200 }, nodes: scaledNodes }
  };
  const scaled = (id) => sidecar.scaled.nodes.find((item) => item.id === id);
  if (kind === "pass_flag_present") sidecar.pass = true;
  else if (kind === "cumulative_root_application") { sidecar.applicationCount = 2; sidecar.scaledRootScale = 4; }
  else if (kind === "inner_transform") scaled("heading").computed.transform = "matrix(2, 0, 0, 2, 0, 0)";
  else if (kind === "inner_zoom") scaled("heading").computed.zoom = 2;
  else if (kind === "cross_parent_overlap") scaled("editor").rect.y = 50;
  else if (kind === "fixed_offscreen") { scaled("title").computed.position = "fixed"; scaled("title").rect.x = -20; }
  else if (kind === "sticky_cover") { scaled("title").computed.position = "sticky"; scaled("editor").rect.y = 50; }
  else if (kind === "horizontal_clip") { scaled("section").computed.overflowX = "hidden"; scaled("section").rect.width = 200; }
  else if (kind === "vertical_clip") { scaled("section").computed.overflowY = "hidden"; scaled("section").rect.height = 300; }
  else if (kind === "nested_scroll") { scaled("editor").computed.overflowY = "auto"; scaled("editor").scrollHeight = 700; }
  else if (kind === "textarea_hidden_scroll") scaled("textarea").scrollHeight = 300;
  else if (kind === "mobile_editor_late") { scaled("editor").rect.y = 240; scaled("heading").rect.y = 220; }
  else if (kind === "ratio_or_reflow") { scaled("title").computed.fontSize = 18; scaled("title").lineCount = 1; }
  else if (kind === "pixel_or_viewport_scale") { sidecar.devicePixelRatio = 2; sidecar.visualViewportScale = 2; }
  else throw new Error(`unknown browser negative fixture ${kind}`);
  return sidecar;
}

function validateBrowserNegativeFixtures(spec) {
  const declaredKinds = spec.ui.textZoom200.negativeFixtures.map((fixture) => fixture[1]);
  const expectedKinds = [
    "pass_flag_present",
    "cumulative_root_application",
    "inner_transform",
    "inner_zoom",
    "cross_parent_overlap",
    "fixed_offscreen",
    "sticky_cover",
    "horizontal_clip",
    "vertical_clip",
    "nested_scroll",
    "textarea_hidden_scroll",
    "mobile_editor_late",
    "ratio_or_reflow",
    "pixel_or_viewport_scale"
  ];
  if (canonicalJson(declaredKinds) !== canonicalJson(expectedKinds)) throw new Error("browser negative fixture registry differs");
  const valid = makeBrowserNegativeFixture("pass_flag_present");
  delete valid.pass;
  validateBrowserTypographySidecar(valid);
  for (const kind of expectedKinds) {
    let failed = false;
    try {
      validateBrowserTypographySidecar(makeBrowserNegativeFixture(kind));
    } catch {
      failed = true;
    }
    if (!failed) throw new Error(`browser negative fixture did not fail: ${kind}`);
  }
}

function validateBrowserEvidence(root, evidenceCommit, manifest, receiptById, context) {
  const receipt = receiptById.get("browser");
  if (!receipt) throw new Error("ZOOM-001 requires a successful browser execution receipt");
  const records = manifest.browserEvidence?.sidecars;
  if (!Array.isArray(records) || records.length !== 144) throw new Error("implementation browser evidence must contain 144 raw sidecar blobs");
  const receiptArtifacts = new Map(receipt.artifacts.map((record) => [record.path, record]));
  const matrixKeys = [];
  const fixtureIds = new Set();
  for (const record of records) {
    if (record.commandId !== "browser") throw new Error("browser sidecar is not bound to the browser receipt");
    const artifact = receiptArtifacts.get(record.path);
    if (!artifact || canonicalJson(artifact) !== canonicalJson({ path: record.path, gitBlob: record.gitBlob, sha256: record.sha256, bytes: record.bytes })) {
      throw new Error(`browser sidecar is not an exact browser receipt artifact: ${record.path}`);
    }
    const sidecar = parseJsonBuffer(
      validateTypedBoundBlob(root, evidenceCommit, record, `browser sidecar ${record.path}`),
      `browser sidecar ${record.path}`
    );
    const recomputed = validateBrowserTypographySidecar(sidecar, context);
    if (fixtureIds.has(recomputed.fixtureId)) throw new Error(`duplicate browser fixtureId ${recomputed.fixtureId}`);
    fixtureIds.add(recomputed.fixtureId);
    matrixKeys.push(recomputed.matrixKey);
  }
  const expectedMatrix = [];
  for (const browser of ["Chromium", "Firefox", "WebKit"]) {
    for (const viewport of ["desktop1440", "mobile390"]) {
      for (const theme of ["day", "night"]) {
        for (const documentKey of DOCUMENT_KEYS) expectedMatrix.push([browser, viewport, theme, documentKey].join("|"));
      }
    }
  }
  if (canonicalJson(matrixKeys.sort()) !== canonicalJson(expectedMatrix.sort())) {
    throw new Error("browser sidecars do not cover the exact 144-case matrix");
  }
}

function validateNormativeParity(spec, markdown) {
  const expectedStructural = renderNormativeMarkdown(spec);
  const actualStructural = extractMarkedBlock(
    markdown,
    spec.humanParityContract.markdownStart,
    spec.humanParityContract.markdownEnd
  );
  if (actualStructural !== expectedStructural) {
    throw new Error("candidate Markdown structural contract differs from canonical spec.json");
  }
  const expectedHuman = renderHumanMarkdown(spec);
  const actualHuman = extractMarkedBlock(
    markdown,
    spec.humanParityContract.humanStart,
    spec.humanParityContract.humanEnd
  );
  if (actualHuman !== expectedHuman) {
    throw new Error("candidate Markdown human prose requirements differ from canonical spec.json");
  }
  requireTypedSha256(spec.humanParityContract.proseSha256, "humanParityContract.proseSha256");
  const proseDigest = `sha256:${sha256(normalizedMarkdownProse(markdown, spec.humanParityContract))}`;
  if (proseDigest !== spec.humanParityContract.proseSha256) {
    throw new Error("candidate Markdown prose outside generated blocks differs from canonical spec.json binding");
  }
  for (const marker of [
    spec.humanParityContract.markdownStart,
    spec.humanParityContract.markdownEnd,
    spec.humanParityContract.humanStart,
    spec.humanParityContract.humanEnd
  ]) {
    if (markdown.split(marker).length !== 2) throw new Error(`candidate Markdown marker is not unique: ${marker}`);
  }
  for (const stale of [
    "SAFECLAW-CONTRACT-MIRROR",
    "HOLD_PENDING_INDEPENDENT_PASS",
    "CURRENT_EXECUTABLE_CANONICAL_PARITY"
  ]) {
    if (markdown.includes(stale)) throw new Error(`candidate Markdown retains stale contract marker: ${stale}`);
  }
}

function validateInternalContract(spec) {
  if (spec.schemaVersion !== "2.6.0") throw new Error("spec schemaVersion differs");
  if (spec.meta.currentIntegrationTarget !== "f98ae7d16746dfe9fedbeea892e5af7ebb56f9a5") {
    throw new Error("spec integration target differs from the reviewed snapshot");
  }
  if (spec.integrationLedger.currentIntegrationTarget !== spec.meta.currentIntegrationTarget) {
    throw new Error("conflict snapshot target differs from spec target");
  }
  if (spec.meta.status !== "HOLD_PENDING_FRESH_REVIEW") throw new Error("spec status is not HOLD_PENDING_FRESH_REVIEW");
  if (spec.meta.implementationProgramStatus !== "BLOCKED_PENDING_USER_DB_APPROVAL") {
    throw new Error("meta implementation program is not approval-blocked");
  }
  if (spec.implementation.programStatus !== "BLOCKED_PENDING_USER_DB_APPROVAL") {
    throw new Error("implementation program is not approval-blocked");
  }
  if (!spec.independentGate.required || spec.independentGate.implementationState !== "BLOCKED_PENDING_USER_DB_APPROVAL") {
    throw new Error("independent/user approval AND gate is incomplete");
  }
  for (const wave of spec.implementation.waves) {
    if (wave.status !== "BLOCKED_PENDING_USER_DB_APPROVAL") throw new Error(`${wave.id} is not approval-blocked`);
  }
  if (spec.documents.length !== 12) throw new Error("document registry does not contain 12 entries");
  if (canonicalJson(spec.documents.map((document) => document.key)) !== canonicalJson(DOCUMENT_KEYS)) {
    throw new Error("document key order differs from the exact 12-key contract");
  }
  if (new Set(spec.documents.map((document) => document.id)).size !== 12) throw new Error("document IDs are not unique");
  if (new Set(spec.documents.map((document) => document.component)).size !== 12) {
    throw new Error("document component names are not unique");
  }
  for (const document of spec.documents) {
    if (typeof document.primaryAction !== "string" || document.primaryAction.length === 0) {
      throw new Error(`${document.key} is missing primaryAction`);
    }
  }
  const acceptanceIds = spec.implementation.acceptance.map((entry) => entry[0]);
  if (canonicalJson(acceptanceIds) !== canonicalJson(spec.contractIds)) {
    throw new Error("acceptance IDs differ from contractIds or order");
  }

  const codecs = new Set(Object.keys(spec.common.codecs));
  const allFields = [
    ...Object.values(spec.common.typeRegistry).flatMap((registered) => registered.fields),
    ...spec.documents.flatMap((document) => document.fields)
  ];
  for (const field of allFields) {
    if (!codecs.has(field[3])) throw new Error(`field ${field[0]} references unknown codec ${field[3]}`);
    if (String(field[1]).includes("|null") && !String(field[3]).startsWith("nullable")) {
      throw new Error(`nullable field ${field[0]} uses non-nullable codec ${field[3]}`);
    }
    if (field[2] === "zero or more" && String(field[3]).startsWith("stableIdArray") && field[3] !== "stableIdArrayAllowEmpty") {
      throw new Error(`zero-or-more ID array ${field[0]} is not allow-empty`);
    }
    if (String(field[2]).includes("at least one") && String(field[3]).startsWith("stableIdArray") && field[3] !== "stableIdArrayNonEmpty") {
      throw new Error(`required ID array ${field[0]} is not strict non-empty`);
    }
  }
  for (const codec of ["sha256HexDigest", "nullableSha256HexDigest"]) {
    if (!codecs.has(codec)) throw new Error(`photo event digest codec is missing: ${codec}`);
  }

  const rawKinds = spec.common.rawProvenance.union.map((member) => member.kind);
  if (canonicalJson(rawKinds) !== canonicalJson(EXPECTED_RAW_KINDS)) throw new Error("raw provenance discriminators differ");
  const rawText = canonicalJson(spec.common.rawProvenance);
  for (const field of [
    "anchors[].page",
    "anchors[].excerpt",
    "referenceId",
    "stableDocumentKey",
    "version",
    "evidenceRef",
    "chunk.supportStatement",
    "registryMapping",
    "provenanceBridge"
  ]) {
    if (!rawText.includes(field)) throw new Error(`raw provenance contract omits ${field}`);
  }
  if (rawText.includes('"reviewed"')) throw new Error("raw provenance contract contains reviewed boolean");

  const writeOwners = new Map();
  for (const wave of spec.implementation.waves) {
    for (const file of [...wave.ownedFiles, ...wave.testFiles]) {
      if (writeOwners.has(file)) throw new Error(`${file} is write-owned by both ${writeOwners.get(file)} and ${wave.id}`);
      writeOwners.set(file, wave.id);
    }
  }
  const mappedSymbols = spec.components.fileMap.map(([symbol]) => symbol);
  const mappedFiles = spec.components.fileMap.map(([, file]) => file);
  if (new Set(mappedSymbols).size !== mappedSymbols.length) throw new Error("component/type file map contains duplicate symbols");
  if (new Set(mappedFiles).size !== mappedFiles.length) throw new Error("component/type file map contains duplicate paths");
  for (const [symbol, file, owner] of spec.components.fileMap) {
    if (writeOwners.get(file) !== owner) throw new Error(`${symbol} file ${file} is not owned by ${owner}`);
  }
  for (const document of spec.documents) {
    const file = `components/workpack-editor/${document.component}.tsx`;
    const owner = DOCUMENT_WAVES.get(document.key);
    if (writeOwners.get(file) !== owner) throw new Error(`${document.component} is not uniquely owned by ${owner}`);
    if (basename(file, ".tsx") !== document.component) throw new Error(`${document.component} file basename mismatch`);
  }
  for (const blocked of spec.implementation.fileOwnership.blockedOwners) {
    for (const file of blocked.paths) {
      if (writeOwners.has(file)) throw new Error(`blocked path ${file} is owned by executable ${writeOwners.get(file)}`);
    }
  }

  const fixtureRows = spec.implementation.codecFixtureMatrix.rows;
  if (fixtureRows.length !== 12) throw new Error("codec fixture matrix does not contain 12 rows");
  if (canonicalJson(fixtureRows.map((row) => row[1])) !== canonicalJson(DOCUMENT_KEYS)) {
    throw new Error("codec fixture rows differ from document order");
  }
  const pureCases = spec.implementation.codecFixtureMatrix.ownership.wave0PureCases;
  if (pureCases.includes("export")) throw new Error("Wave 0 pure cases incorrectly include export");
  if (spec.export.roundTripOwner.wave !== "wave5") throw new Error("actual export round-trip exits are not owned by wave5");
  const wave5 = spec.implementation.waves.find((wave) => wave.id === "wave5");
  for (const path of [
    "components/WorkpackEditor.tsx",
    "app/api/export/xlsx/route.ts",
    "app/api/export/pdf/route.ts",
    "app/api/export/hwp/route.ts"
  ]) {
    if (!wave5.ownedFiles.includes(path)) throw new Error(`wave5 does not own export call-site path ${path}`);
  }
  if (wave5.ownedFiles.includes("app/api/export/hwpx-template/route.ts")) {
    throw new Error("wave5 incorrectly owns the unrelated HWPX template route");
  }
  const seamShape = spec.export.actualSeamsAtTarget.map((seam) => [
    seam.id,
    seam.kind,
    seam.clientSymbol,
    seam.serverPath,
    seam.serverSymbol
  ]);
  if (canonicalJson(seamShape) !== canonicalJson(EXPECTED_EXPORT_SEAMS)) throw new Error("target export seam registry differs");

  const authority = spec.persistence.serverRevisionAuthority;
  if (authority.status !== "BLOCKED_PENDING_USER_DB_APPROVAL") throw new Error("server authority is not user-approval blocked");
  if (!authority.rootIdempotency?.strategyA || !authority.rootIdempotency?.strategyB) {
    throw new Error("both root idempotency strategies are not defined");
  }
  const authorityText = canonicalJson(authority);
  for (const token of [
    "logicalWorkpackId",
    "rootOperationKey",
    "UNIQUE(organization_id, logical_workpack_id, revision)",
    "idempotency_mismatch",
    "logical_root_conflict",
    "root_operation_mismatch"
  ]) {
    if (!authorityText.includes(token)) throw new Error(`root authority omits ${token}`);
  }
  const photo = spec.persistence.photo.reviewAuthority;
  if (photo.status !== "BLOCKED_PENDING_USER_DB_APPROVAL") throw new Error("photo authority is not user-approval blocked");
  const photoText = canonicalJson(photo);
  for (const token of [
    "Sha256Digest",
    "analysis_id",
    "analysis_payload",
    "analysisPayloadDigest",
    "modelProvider",
    "candidateControlTextDigests",
    "beforeImageSha256",
    "afterImageSha256",
    "reviewerId",
    "confirmedAt",
    "transactionId",
    "rootOperationId",
    "candidateRevision",
    "resultingRevision",
    "canonicalEventDigest",
    "site-memory/session only",
    "atomic"
  ]) {
    if (!photoText.includes(token)) throw new Error(`photo event authority omits ${token}`);
  }

  const zoom = spec.ui.textZoom200;
  if (zoom.status !== "DECLARED_NOT_EXECUTED") throw new Error("200% contract incorrectly claims execution");
  if (zoom.matrix.totalCaseCount !== 144 || zoom.matrix.caseCountPerBrowser !== 48) {
    throw new Error("200% browser matrix count differs from 12 docs x 2 themes x 2 viewports x 3 browsers");
  }
  const zoomText = canonicalJson(zoom);
  for (const token of [
    "deviceScaleFactor=1",
    "devicePixelRatio=1",
    "visualViewport.scale=1",
    "applicationCount=1",
    "--safeclaw-type-scale=2",
    "data-safeclaw-text-policy=double",
    "1.9..2.1",
    "overflow-y:hidden",
    "all 144",
    "cross-parent",
    "inner transform/zoom"
  ]) {
    if (!zoomText.includes(token)) throw new Error(`200% browser contract omits ${token}`);
  }
  if (canonicalJson([...spec.validation.redCases].sort()) !== canonicalJson([...DELIBERATE_CASES].sort())) {
    throw new Error("declared deliberate RED cases differ from executable validator cases");
  }
  if (spec.humanParityContract.humanRequirements.length !== 10) throw new Error("human prose requirement count differs");
  if (spec.humanParityContract.deliberateMismatch.length !== 5) throw new Error("parity deliberate mismatch set differs");
  const trustText = canonicalJson(spec.validation.implementationEvidence);
  for (const token of [
    "safeclaw-external-approval-manifest/v1",
    "rawEvent blob",
    "migration/RPC proposal",
    "safeclaw-command-execution-receipt/v1",
    "commandArgv string[]",
    "stdout blob",
    "sidecar blob records"
  ]) {
    if (!trustText.includes(token)) throw new Error(`implementation evidence trust contract omits ${token}`);
  }
  validateBrowserNegativeFixtures(spec);
  if (spec.ui.browserAssertions.length !== 25) throw new Error("browser assertion count must be 25");
}

function validateSafetyReferenceSource(source, spec) {
  const safetyMatch = source.match(/export type SafetyReferenceItem = \{([\s\S]*?)^\};/mu);
  if (!safetyMatch) throw new Error("cannot extract target SafetyReferenceItem");
  const raw = spec.common.rawProvenance.union.find((member) => member.kind === "safety_reference_item");
  const productionFields = [...safetyMatch[1].matchAll(/^\s{2}([A-Za-z_][A-Za-z0-9_]*)(\?)?:/gmu)]
    .map((match) => [match[1], match[2] === "?"]);
  const required = productionFields.filter(([, optional]) => !optional).map(([name]) => name).sort();
  const optional = productionFields.filter(([, isOptional]) => isOptional).map(([name]) => name).sort();
  if (canonicalJson(required) !== sortedCanonical(raw.required)) throw new Error("raw SafetyReferenceItem required fields differ from target");
  if (canonicalJson(optional) !== sortedCanonical(raw.optional)) throw new Error("raw SafetyReferenceItem optional fields differ from target");
  const guideMatch = safetyMatch[1].match(/^\s{2}kosha_guide\?: \{([\s\S]*?)^\s{2}\};/mu);
  if (!guideMatch) throw new Error("cannot extract target SafetyReferenceItem.kosha_guide");
  const guideFields = [...guideMatch[1].matchAll(/^\s{4}([A-Za-z_][A-Za-z0-9_]*):/gmu)].map((match) => match[1]);
  const expected = ["referenceId", "stableDocumentKey", "version", "quality", "lifecycle", "bodyKind", "anchors", "evidenceRef", "directEligible"];
  if (canonicalJson(guideFields) !== canonicalJson(expected)) throw new Error("raw KOSHA guide fields differ from target");
}

function validateTargetSourceShapes(blobs, spec) {
  const workpackEditor = blobs.get("components/WorkpackEditor.tsx");
  const keyMatch = workpackEditor.match(/export type DocumentKey =([\s\S]*?);/u);
  if (!keyMatch) throw new Error("cannot extract target DocumentKey");
  const productionKeys = [...keyMatch[1].matchAll(/"([^"]+)"/gu)].map((match) => match[1]);
  if (canonicalJson(productionKeys) !== canonicalJson(DOCUMENT_KEYS)) throw new Error("target DocumentKey differs from normative registry");
  const metaMatch = workpackEditor.match(/const documentMeta: EditableDocument\[\] = \[([\s\S]*?)\n\];/u);
  if (!metaMatch) throw new Error("cannot extract target documentMeta");
  const productionDocuments = [...metaMatch[1].matchAll(/key: "([^"]+)"[\s\S]*?title: "([^"]+)"/gu)]
    .map((match) => [match[1], match[2]]);
  const normativeDocuments = spec.documents.map((document) => [document.key, document.title]);
  if (canonicalJson(productionDocuments) !== canonicalJson(normativeDocuments)) {
    throw new Error("target documentMeta differs from normative registry");
  }

  const riskSource = blobs.get("lib/risk-assessment-schema.ts");
  const riskMatch = riskSource.match(/export type RiskAssessmentRow = \{([\s\S]*?)\n\};/u);
  if (!riskMatch) throw new Error("cannot extract target RiskAssessmentRow");
  const productionRiskFields = [...riskMatch[1].matchAll(/^\s{2}([A-Za-z][A-Za-z0-9]*):/gmu)].map((match) => match[1]);
  const normativeRiskFields = spec.common.typeRegistry.RiskAssessmentEditorRow.fields.slice(1).map((field) => field[0]);
  if (canonicalJson(productionRiskFields) !== canonicalJson(normativeRiskFields)) {
    throw new Error("target RiskAssessmentRow field names differ");
  }

  validateSafetyReferenceSource(blobs.get("lib/safety-reference-catalog.ts"), spec);
  const ontology = blobs.get("lib/ontology/evidence-chain-registry.ts");
  for (const token of [
    "LawEvidenceRecord",
    "SifEvidenceRecord",
    "KoshaGuidanceRecord",
    "supportStatement",
    "registryMapping",
    "provenanceBridge"
  ]) {
    if (!ontology.includes(token)) throw new Error(`target ontology source omits ${token}`);
  }
  const generation = blobs.get("lib/generation-evidence.ts");
  if (!generation.includes("delete content.generationEvidence;") || !generation.includes("delete content.generationEvidenceError;")) {
    throw new Error("target generation-evidence digest boundary changed");
  }
  const workpacksRoute = blobs.get("app/api/workpacks/route.ts");
  if (!workpacksRoute.includes(".insert(")) throw new Error("target workpacks route is no longer insert-based");
  for (const token of ["expectedRevision", "rootOperationKey", "idempotencyKey", "logicalWorkpackId", "parentWorkpackId"]) {
    if (workpacksRoute.includes(token)) throw new Error(`target workpacks route unexpectedly contains ${token}; authority contract must be re-reviewed`);
  }
  const migration = blobs.get("supabase/migrations/002_workspace_productization.sql");
  for (const token of ["logical_workpack_id", "parent_workpack_id", "root_operation_key", "idempotency_key"]) {
    if (migration.includes(token)) throw new Error(`target migration unexpectedly contains ${token}; approval contract must be re-reviewed`);
  }
  const improvements = blobs.get("app/api/workpacks/[id]/improvements/route.ts");
  if (!improvements.includes("export async function GET") || !improvements.includes("export async function POST")) {
    throw new Error("target improvements GET/POST seam changed");
  }
  if (improvements.includes("export async function PATCH") || improvements.includes("export async function PUT")) {
    throw new Error("target improvements route now has a review transition; PHOTO-002 must be re-reviewed");
  }
  for (const path of [
    "app/api/workpacks/[id]/share-sessions/route.ts",
    "app/api/workflow/dispatch/route.ts"
  ]) {
    const source = blobs.get(path);
    if (source.includes("sourceRevision") || source.includes("evidenceDigest")) {
      throw new Error(`target share freshness seam changed in ${path}`);
    }
  }

  for (const token of [
    "async function downloadXlsx()",
    'fetch("/api/export/xlsx"',
    "async function downloadHwp()",
    'fetch("/api/export/hwp"',
    "async function buildHwpxWithRhwp(body: string)",
    "document.exportHwpx()",
    "async function downloadHwpx()",
    "async function printPdf()",
    'fetch("/api/export/pdf?format=html"'
  ]) {
    if (!workpackEditor.includes(token)) throw new Error(`target WorkpackEditor export seam omits ${token}`);
  }
  if (workpackEditor.includes('fetch("/api/export/hwpx-template')) {
    throw new Error("target WorkpackEditor unexpectedly calls the HWPX template route");
  }
  const hwp = blobs.get("app/api/export/hwp/route.ts");
  if (!hwp.includes("export async function POST") || !hwp.includes("buildHwpBuffer") || !hwp.includes('"content-type": "application/x-hwp"')) {
    throw new Error("target HWP route is not the declared binary POST seam");
  }
  const pdf = blobs.get("app/api/export/pdf/route.ts");
  if (!pdf.includes("export async function POST") || !pdf.includes('"content-type": "text/html; charset=utf-8"')) {
    throw new Error("target PDF HTML POST seam differs");
  }
  const xlsx = blobs.get("app/api/export/xlsx/route.ts");
  if (!xlsx.includes("export async function POST") || !xlsx.includes("workPlanStructured") || !xlsx.includes("educationRecordStructured")) {
    throw new Error("target XLSX structured POST seam differs");
  }
  const hwpxTemplate = blobs.get("app/api/export/hwpx-template/route.ts");
  if (!hwpxTemplate.includes("export async function GET")) throw new Error("target HWPX template route shape differs");
}

function validateSpecReview(args) {
  const root = resolve(args.root);
  const evidence = resolveCommit(root, args.evidence, "evidence");
  const manifestBuffer = readBlob(root, evidence, args.manifest);
  const manifest = parseJsonBuffer(manifestBuffer, "review evidence manifest");
  if (manifest.kind !== "safeclaw-spec-review-evidence/v1") throw new Error("manifest kind is not spec-review evidence");
  if (manifest.behaviorExecution?.executed !== false || manifest.implementationExecution?.executed !== false) {
    throw new Error("spec-review evidence must explicitly record no behavior/implementation execution");
  }

  let candidateInput = args.candidate;
  let targetInput = args.target;
  if (args.deliberate === "spec-ref") candidateInput = manifest.candidateParent;
  if (args.deliberate === "target-ref") targetInput = manifest.sourceBase;
  const candidate = resolveCommit(root, candidateInput, "candidate");
  const sourceBase = resolveCommit(root, args.sourceBase, "source-base");
  const target = resolveCommit(root, targetInput, "target");

  if (manifest.candidateCommit !== candidate) throw new Error("manifest candidate SHA differs from explicit candidate ref");
  if (manifest.sourceBase !== sourceBase) throw new Error("manifest sourceBase differs from explicit source-base ref");
  if (manifest.currentIntegrationTarget !== target) throw new Error("manifest target SHA differs from explicit target ref");
  if (commitParent(root, evidence) !== candidate) throw new Error("evidence commit parent is not the candidate commit");
  if (commitParent(root, candidate) !== manifest.candidateParent) throw new Error("candidate parent differs from manifest");

  const specBuffer = readBlob(root, candidate, SPEC_JSON_PATH);
  const markdownBuffer = readBlob(root, candidate, SPEC_MARKDOWN_PATH);
  const spec = parseJsonBuffer(specBuffer, "candidate spec.json");
  let markdown = markdownBuffer.toString("utf8");
  requireIsoDateTime(manifest.capturedAt, "review evidence capturedAt");
  if (manifest.branch !== spec.meta.branch || manifest.mergeBase !== sourceBase) {
    throw new Error("review evidence branch/merge-base differs from candidate contract");
  }
  if (canonicalJson(manifest.refSnapshot) !== canonicalJson(spec.integrationLedger)) {
    throw new Error("review evidence ref snapshot differs from the candidate conflict ledger");
  }
  const candidatePaths = commitPaths(root, candidate);
  const evidencePaths = commitPaths(root, evidence);
  if (canonicalJson(candidatePaths) !== canonicalJson([...spec.meta.reviewScope.candidateCommit.allowedPaths].sort())) {
    throw new Error(`candidate commit scope differs: ${candidatePaths.join(", ")}`);
  }
  if (canonicalJson(evidencePaths) !== canonicalJson([...spec.meta.reviewScope.evidenceCommit.allowedPaths].sort())) {
    throw new Error(`evidence commit scope differs: ${evidencePaths.join(", ")}`);
  }
  if (spec.meta.remediationParent !== manifest.candidateParent) throw new Error("candidate remediationParent differs from manifest");
  if (spec.meta.sourceBase !== sourceBase || spec.meta.currentIntegrationTarget !== target) {
    throw new Error("candidate sourceBase/currentIntegrationTarget differs from explicit refs");
  }
  const mergeBase = gitText(root, ["merge-base", candidate, target]);
  if (mergeBase !== sourceBase || spec.meta.reviewScope.mergeBase !== sourceBase) {
    throw new Error(`true candidate/target merge-base is ${mergeBase}, expected ${sourceBase}`);
  }
  validateCandidateArtifactManifest(root, manifest, candidate, spec);

  const parityCases = new Set(["normative-parity", "json-model", "json-document-primary-action", "json-unknown-domain"]);
  const paritySpec = parityCases.has(args.deliberate) ? structuredClone(spec) : spec;
  if (args.deliberate === "normative-parity") paritySpec.meta.status = "__deliberate_normative_mismatch__";
  if (args.deliberate === "json-model") paritySpec.model.documentEnvelope.fields[0][2] = "__deliberate_model_mismatch__";
  if (args.deliberate === "json-document-primary-action") paritySpec.documents[0].primaryAction = "__deliberate_action_mismatch__";
  if (args.deliberate === "json-unknown-domain") paritySpec.__deliberateUnknownDomain = { normative: true };
  if (args.deliberate === "md-prose") {
    const original = markdown;
    markdown = markdown.replace("# SafeClaw", "# Deliberately changed SafeClaw");
    if (markdown === original) throw new Error("md-prose deliberate fixture could not mutate prose outside generated blocks");
  }
  validateNormativeParity(paritySpec, markdown);
  validateInternalContract(spec);

  if (args.deliberate === "approval-boolean") {
    validateApprovalManifestShape({
      kind: "safeclaw-external-approval-manifest/v1",
      specCommit: candidate,
      targetSha: target,
      migrationRpcProposalDigest: `sha256:${"a".repeat(64)}`,
      migrationRpcProposal: { path: "proposal.sql" },
      approvalRootOperationId: "deliberate-root",
      approved: true,
      events: [{ type: "INDEPENDENT_SPEC_PASS" }, { type: "USER_DB_AUTHORITY_APPROVAL" }]
    });
  }
  if (args.deliberate === "command-unbound-hash") {
    validateExecutionReceiptShape({
      kind: "safeclaw-command-execution-receipt/v1",
      sourceSha: target,
      buildId: "deliberate-build",
      commandId: "typecheck",
      command: "npm.cmd run typecheck",
      outputSha256: "a".repeat(64),
      cwd: ".",
      startedAt: "2026-07-14T00:00:00.000Z",
      completedAt: "2026-07-14T00:00:01.000Z",
      commandArgv: ["npm.cmd", "run", "typecheck"],
      exitCode: 0,
      producer: "deliberate",
      runId: "deliberate",
      jobId: "deliberate",
      stdout: {},
      stderr: {},
      artifacts: []
    });
  }
  const browserDeliberateKinds = new Map([
    ["browser-pass-flag", "pass_flag_present"],
    ["browser-cumulative-scale", "cumulative_root_application"],
    ["browser-inner-transform", "inner_transform"],
    ["browser-inner-zoom", "inner_zoom"],
    ["browser-cross-parent-overlap", "cross_parent_overlap"],
    ["browser-fixed-offscreen", "fixed_offscreen"],
    ["browser-sticky-cover", "sticky_cover"],
    ["browser-horizontal-clip", "horizontal_clip"],
    ["browser-vertical-clip", "vertical_clip"],
    ["browser-nested-scroll", "nested_scroll"],
    ["browser-textarea-scroll", "textarea_hidden_scroll"],
    ["browser-mobile-late", "mobile_editor_late"],
    ["browser-ratio-reflow", "ratio_or_reflow"],
    ["browser-pixel-viewport-scale", "pixel_or_viewport_scale"]
  ]);
  if (browserDeliberateKinds.has(args.deliberate)) {
    validateBrowserTypographySidecar(makeBrowserNegativeFixture(browserDeliberateKinds.get(args.deliberate)));
  }
  if (args.deliberate === "implementation-empty") throw new Error("implementation-empty must fail before implementation evidence is read");

  const targetBlobs = loadAndValidateTargetBlobs(root, manifest, target, spec);
  if (args.deliberate === "source-shape") {
    const path = "components/WorkpackEditor.tsx";
    targetBlobs.set(path, targetBlobs.get(path).replace("async function downloadHwp()", "async function __deliberatelyBrokenHwp()"));
  }
  validateTargetSourceShapes(targetBlobs, spec);

  console.log("SPEC_JSON_PARSE=PASS");
  console.log("FULL_MARKDOWN_JSON_PARITY=PASS");
  console.log("CANDIDATE_COMMIT_SCOPE=PASS");
  console.log("EVIDENCE_ONLY_COMMIT_SCOPE=PASS");
  console.log("TARGET_BLOB_BINDING=PASS");
  console.log("TARGET_SOURCE_SHAPE=PASS");
  console.log("CONTRACT_INTERNAL_CONSISTENCY=PASS");
  console.log("BROWSER_NEGATIVE_FIXTURES=PASS");
  console.log("SPEC_REVIEW_VALIDATION=PASS");
  console.log("IMPLEMENTATION_PROGRAM=BLOCKED_PENDING_USER_DB_APPROVAL");
}

function validateImplementation(args) {
  const root = resolve(args.root);
  if (args.deliberate === "implementation-empty") {
    args.base = "";
    args.head = "";
  }
  const specCommit = resolveCommit(root, args.spec, "immutable spec");
  const base = resolveCommit(root, args.base, "implementation base");
  const head = resolveCommit(root, args.head, "implementation head");
  if (base === head) throw new Error("implementation base and head must be different");
  execFileSync("git", ["merge-base", "--is-ancestor", base, head], { cwd: root, stdio: "ignore" });
  const evidence = resolveCommit(root, args.evidence, "implementation evidence");
  const manifest = parseJsonBuffer(readBlob(root, evidence, args.manifest), "implementation evidence manifest");
  if (manifest.kind !== "safeclaw-implementation-evidence/v1") throw new Error("manifest kind is not implementation evidence");
  if (manifest.specCommit !== specCommit || manifest.implementationBase !== base || manifest.implementationHead !== head) {
    throw new Error("implementation manifest refs differ from explicit refs");
  }
  const spec = parseJsonBuffer(readBlob(root, specCommit, SPEC_JSON_PATH), "immutable implementation spec");
  validateInternalContract(spec);
  requireString(manifest.buildId, "implementation buildId");
  validateExternalApproval(root, args, spec, specCommit, base, head, manifest);
  const changedOutput = gitText(root, ["diff", "--name-status", `${base}...${head}`, "--"]);
  const changedRecords = changedOutput
    ? changedOutput.split(/\r?\n/u).filter(Boolean).map((line) => {
        const [status, ...paths] = line.split("\t");
        if (!/^[AMD]$/u.test(status) || paths.length !== 1) {
          throw new Error(`implementation range contains unsupported change record: ${line}`);
        }
        return { status, path: paths[0] };
      })
    : [];
  if (changedRecords.length === 0) throw new Error("implementation range is empty");
  const declaredWaves = manifest.waves;
  if (!Array.isArray(declaredWaves) || declaredWaves.length === 0) throw new Error("implementation manifest declares no waves");
  const owned = new Set();
  for (const waveId of declaredWaves) {
    const wave = spec.implementation.waves.find((entry) => entry.id === waveId);
    if (!wave) throw new Error(`implementation manifest names unknown wave ${waveId}`);
    for (const path of [...wave.ownedFiles, ...wave.testFiles]) owned.add(path);
  }
  for (const { path } of changedRecords) {
    if (!owned.has(path)) throw new Error(`implementation path is outside declared wave ownership: ${path}`);
  }
  const implementationArtifacts = manifest.implementationArtifacts;
  if (!Array.isArray(implementationArtifacts)) throw new Error("implementation manifest has no artifact records");
  const expectedArtifactShape = changedRecords.map(({ status, path }) => [path, status]).sort(([left], [right]) => left.localeCompare(right));
  const manifestArtifactShape = implementationArtifacts
    .map((record) => [record.path, record.status])
    .sort(([left], [right]) => left.localeCompare(right));
  if (canonicalJson(expectedArtifactShape) !== canonicalJson(manifestArtifactShape)) {
    throw new Error("implementation artifact records differ from the explicit base...head range");
  }
  for (const record of implementationArtifacts) {
    if (record.status === "D") {
      if (record.gitBlob !== null || record.sha256 !== null || record.bytes !== 0) {
        throw new Error(`deleted implementation artifact is not represented exactly: ${record.path}`);
      }
      continue;
    }
    validateTypedBoundBlob(root, head, record, `implementation artifact ${record.path}`);
  }
  const receiptById = validateExecutionEvidence(root, evidence, manifest, spec, {
    base,
    head,
    declaredWaves
  });
  console.log("IMPLEMENTATION_REFS=PASS");
  console.log("IMPLEMENTATION_ARTIFACT_SCOPE=PASS");
  console.log("IMPLEMENTATION_EXTERNAL_APPROVAL=PASS");
  console.log("IMPLEMENTATION_EXECUTION_RECEIPTS=PASS");
  if (manifest.claimedGates?.includes("ZOOM-001")) {
    validateBrowserEvidence(root, evidence, manifest, receiptById, { sourceSha: head, buildId: manifest.buildId });
    console.log("IMPLEMENTATION_200_PERCENT_BROWSER_EVIDENCE=PASS");
  }
  console.log("IMPLEMENTATION_VALIDATION=PASS");
}

function main() {
  const args = parseArguments(process.argv.slice(2));
  if (args.mode === "render-normative") {
    const spec = JSON.parse(readFileSync(join(resolve(args.root), args.specFile), "utf8"));
    process.stdout.write(renderNormativeMarkdown(spec));
    return;
  }
  if (args.mode === "render-human") {
    const spec = JSON.parse(readFileSync(join(resolve(args.root), args.specFile), "utf8"));
    process.stdout.write(renderHumanMarkdown(spec));
    return;
  }
  if (args.mode === "render-prose-digest") {
    const root = resolve(args.root);
    const spec = JSON.parse(readFileSync(join(root, args.specFile), "utf8"));
    const markdown = readFileSync(join(root, SPEC_MARKDOWN_PATH), "utf8");
    process.stdout.write(`sha256:${sha256(normalizedMarkdownProse(markdown, spec.humanParityContract))}`);
    return;
  }
  if (args.mode === "authoring-check") {
    const root = resolve(args.root);
    const spec = JSON.parse(readFileSync(join(root, args.specFile), "utf8"));
    const markdown = readFileSync(join(root, SPEC_MARKDOWN_PATH), "utf8");
    validateNormativeParity(spec, markdown);
    validateInternalContract(spec);
    console.log("AUTHORING_PARITY_AND_INTERNAL_CONTRACT=PASS");
    console.log("AUTHORING_CHECK_IS_NOT_REVIEW_EVIDENCE");
    return;
  }
  if (args.mode === "spec-review") {
    validateSpecReview(args);
    return;
  }
  if (args.mode === "implementation") {
    validateImplementation(args);
    return;
  }
  throw new Error("Mode must be render-normative, render-human, render-prose-digest, authoring-check, spec-review, or implementation");
}

try {
  main();
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`CONTRACT_ERROR: ${message}`);
  process.exitCode = 1;
}
