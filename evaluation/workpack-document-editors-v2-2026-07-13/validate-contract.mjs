import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { basename, join, resolve } from "node:path";

const SPEC_DIRECTORY = "evaluation/workpack-document-editors-v2-2026-07-13";
const SPEC_JSON_PATH = `${SPEC_DIRECTORY}/spec.json`;
const SPEC_MARKDOWN_PATH = `${SPEC_DIRECTORY}/spec.md`;
const VALIDATOR_PATH = `${SPEC_DIRECTORY}/validate-contract.mjs`;
const EVIDENCE_PATH = `${SPEC_DIRECTORY}/review-evidence.json`;
const IMPLEMENTATION_BLOCK =
  "IMPLEMENTATION_BLOCKED_PENDING_USER_DB_APPROVAL: implementation evidence is not evaluated; this repository cannot authenticate a Codex/user approval event, and a separate post-approval verifier may be designed only after explicit user approval and fresh review.";
const FULL_SHA = /^[0-9a-f]{40}$/u;
const HEX_SHA256 = /^[0-9a-f]{64}$/u;
const TYPED_SHA256 = /^sha256:[0-9a-f]{64}$/u;
const LOCAL_DATE = /^(\d{4})-(\d{2})-(\d{2})$/u;
const RFC3339 = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d+))?(Z|[+-]\d{2}:\d{2})$/u;
const TOP_LEVEL_DOMAINS = [
  "schemaVersion",
  "meta",
  "contractIds",
  "tupleSchemas",
  "sourceSeams",
  "validation",
  "integrationLedger",
  "common",
  "model",
  "workflow",
  "persistence",
  "evidencePresentation",
  "ui",
  "components",
  "export",
  "documents",
  "implementation",
  "independentGate",
  "humanParityContract"
];
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
const EXPECTED_PHOTO_EVENT_FIELDS = {
  eventId: "stableId",
  improvementId: "stableId",
  pairId: "stableId",
  action: "HUMAN_CONFIRM_IMPROVEMENT|HUMAN_REJECT_IMPROVEMENT",
  transactionId: "stableId",
  rootOperationId: "stableId",
  analysis_id: "stableId",
  analysis_payload: "canonicalObject",
  analysisPayloadDigest: "sha256HexDigest",
  modelProvider: "exactString",
  modelName: "exactString",
  modelVersion: "exactString",
  candidateControlIds: "stableIdArrayNonEmpty",
  candidateControlTextDigests: "canonicalObject",
  acceptedControlIds: "stableIdArrayAllowEmpty",
  acceptedControlTextDigests: "canonicalObject",
  rejectionReason: "nullableExactString",
  beforeImageSha256: "sha256HexDigest",
  afterImageSha256: "nullableSha256HexDigest",
  reviewerId: "stableId",
  reviewerDisplayName: "exactString",
  confirmedAt: "nullableRfc3339",
  rejectedAt: "nullableRfc3339",
  occurredAt: "isoDateTime",
  candidateRevision: "strictInteger",
  resultingRevision: "strictInteger",
  priorMaterializationDigest: "digest",
  priorEvidenceDigest: "digest",
  resultingMaterializationDigest: "digest",
  resultingEvidenceDigest: "digest",
  resultingGenerationEvidenceSnapshotDigest: "digest",
  canonicalEventDigest: "sha256HexDigest"
};
const DELIBERATE_CASES = new Set([
  "normative-parity",
  "md-prose",
  "json-model",
  "json-document-primary-action",
  "json-unknown-domain",
  "domain-missing",
  "domain-empty",
  "document-fields-empty",
  "document-primary-action-empty",
  "photo-object-empty",
  "photo-analysis-missing",
  "photo-confirm-after-missing",
  "conflict-heads-empty",
  "conflict-local-ref-empty",
  "wave-unblocked",
  "candidate-ref",
  "source-base-ref",
  "target-ref",
  "evidence-parent",
  "implementation-empty",
  "implementation-forged",
  "implementation-complete-looking"
]);

function parseArguments(argv) {
  const result = {
    mode: argv[0] ?? "",
    root: process.cwd(),
    manifest: EVIDENCE_PATH,
    evidence: "",
    candidate: "",
    sourceBase: "",
    target: "",
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
  return [
    structuralRow("$", spec, false),
    ...Object.keys(spec)
      .sort()
      .map((key) => structuralRow(key, spec[key]))
  ];
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
  const lines = [contract.humanStart, "", "### Human Normative Requirements", ""];
  for (const [id, title, requirement] of contract.humanRequirements) {
    lines.push(`- **${id} ${title}:** ${requirement}`);
  }
  lines.push("", contract.humanEnd);
  return lines.join("\n");
}

function gitBuffer(root, args) {
  return execFileSync("git", args, { cwd: root, encoding: "buffer", maxBuffer: 64 * 1024 * 1024 });
}

function gitText(root, args) {
  return gitBuffer(root, args).toString("utf8").trim();
}

function resolveCommit(root, value, label) {
  if (!FULL_SHA.test(value)) throw new Error(`${label} must be an explicit full 40-character SHA`);
  const resolved = gitText(root, ["rev-parse", "--verify", `${value}^{commit}`]);
  if (resolved !== value) throw new Error(`${label} does not resolve byte-for-byte to the explicit SHA`);
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
  return output ? output.split(/\r?\n/u).filter(Boolean).sort() : [];
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
  if (startIndex < 0 || endIndex < 0 || endIndex < startIndex) throw new Error(`Missing or invalid Markdown markers ${start} / ${end}`);
  return markdown.slice(startIndex, endIndex + end.length).replaceAll("\r\n", "\n");
}

function replaceMarkedBlock(markdown, start, end, placeholder) {
  const startIndex = markdown.indexOf(start);
  const endIndex = markdown.indexOf(end);
  if (startIndex < 0 || endIndex < 0 || endIndex < startIndex) throw new Error(`Missing or invalid Markdown markers ${start} / ${end}`);
  return `${markdown.slice(0, startIndex)}${start}\n${placeholder}\n${end}${markdown.slice(endIndex + end.length)}`;
}

function normalizedMarkdownProse(markdown, contract) {
  let normalized = markdown.replaceAll("\r\n", "\n");
  normalized = replaceMarkedBlock(normalized, contract.markdownStart, contract.markdownEnd, "<SAFECLAW-NORMATIVE:GENERATED>");
  normalized = replaceMarkedBlock(normalized, contract.humanStart, contract.humanEnd, "<SAFECLAW-HUMAN:GENERATED>");
  return normalized;
}

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function requireObject(value, label) {
  if (!isRecord(value)) throw new Error(`${label} must be an object`);
  return value;
}

function requireArray(value, label, minimum = 0) {
  if (!Array.isArray(value) || value.length < minimum) throw new Error(`${label} must be an array with at least ${minimum} item(s)`);
  return value;
}

function requireString(value, label) {
  if (typeof value !== "string" || value.length === 0) throw new Error(`${label} must be a non-empty string`);
  return value;
}

function requireBoolean(value, label) {
  if (typeof value !== "boolean") throw new Error(`${label} must be boolean`);
  return value;
}

function requireInteger(value, label, minimum = Number.MIN_SAFE_INTEGER) {
  if (!Number.isSafeInteger(value) || value < minimum) throw new Error(`${label} must be an integer >= ${minimum}`);
  return value;
}

function requireFullSha(value, label) {
  requireString(value, label);
  if (!FULL_SHA.test(value)) throw new Error(`${label} must be a full lowercase Git SHA`);
  return value;
}

function requireTypedSha256(value, label) {
  requireString(value, label);
  if (!TYPED_SHA256.test(value)) throw new Error(`${label} must be sha256:<64 lowercase hex>`);
  return value;
}

function isLeapYear(year) {
  return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
}

function requireCalendarDateParts(year, month, day, label) {
  if (month < 1 || month > 12) throw new Error(`${label} has an invalid month`);
  const days = [31, isLeapYear(year) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  if (day < 1 || day > days[month - 1]) throw new Error(`${label} has an invalid calendar day`);
}

function requireLocalDate(value, label) {
  requireString(value, label);
  const match = LOCAL_DATE.exec(value);
  if (!match) throw new Error(`${label} must be strict YYYY-MM-DD`);
  requireCalendarDateParts(Number(match[1]), Number(match[2]), Number(match[3]), label);
  return value;
}

function requireRfc3339(value, label) {
  requireString(value, label);
  const match = RFC3339.exec(value);
  if (!match) throw new Error(`${label} must be strict RFC3339`);
  requireCalendarDateParts(Number(match[1]), Number(match[2]), Number(match[3]), label);
  if (Number(match[4]) > 23 || Number(match[5]) > 59 || Number(match[6]) > 59) {
    throw new Error(`${label} has an invalid RFC3339 time`);
  }
  if (match[8] !== "Z") {
    const [offsetHour, offsetMinute] = match[8].slice(1).split(":").map(Number);
    if (offsetHour > 23 || offsetMinute > 59) throw new Error(`${label} has an invalid RFC3339 offset`);
  }
  return value;
}

function requireExactKeys(value, expected, label) {
  const record = requireObject(value, label);
  const actual = Object.keys(record).sort();
  const wanted = [...expected].sort();
  if (canonicalJson(actual) !== canonicalJson(wanted)) {
    throw new Error(`${label} keys differ; expected ${wanted.join(", ")}, got ${actual.join(", ")}`);
  }
  return record;
}

function requireKeys(value, expected, label) {
  const record = requireObject(value, label);
  for (const key of expected) {
    if (!Object.hasOwn(record, key)) throw new Error(`${label} is missing ${key}`);
  }
  return record;
}

function requireStringArray(value, label, minimum = 1) {
  const items = requireArray(value, label, minimum);
  items.forEach((item, index) => requireString(item, `${label}[${index}]`));
  return items;
}

function requireTuple(value, length, label) {
  const tuple = requireArray(value, label, length);
  if (tuple.length !== length) throw new Error(`${label} must contain exactly ${length} items`);
  return tuple;
}

function validateJsonTree(value, path = "$") {
  if (value === null || typeof value === "boolean") return;
  if (typeof value === "string") {
    requireString(value, path);
    return;
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new Error(`${path} must be a finite JSON number`);
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) => validateJsonTree(item, `${path}[${index}]`));
    return;
  }
  if (isRecord(value)) {
    for (const [key, child] of Object.entries(value)) {
      requireString(key, `${path} key`);
      validateJsonTree(child, `${path}.${key}`);
    }
    return;
  }
  throw new Error(`${path} contains a non-JSON value`);
}

function validateFieldTuple(field, label, codecs) {
  requireTuple(field, 5, label);
  requireString(field[0], `${label}[path]`);
  requireString(field[1], `${label}[type]`);
  requireString(field[2], `${label}[required]`);
  requireString(field[3], `${label}[codec]`);
  if (field[4] !== null) requireString(field[4], `${label}[currentStructuredPath]`);
  if (!codecs.has(field[3])) throw new Error(`${label} references unknown codec ${field[3]}`);
  if (field[1].includes("|null") && !field[3].startsWith("nullable")) {
    throw new Error(`${label} is nullable but does not use a nullable codec`);
  }
  if (field[2] === "zero or more" && field[3].startsWith("stableIdArray") && field[3] !== "stableIdArrayAllowEmpty") {
    throw new Error(`${label} zero-or-more stable IDs must use stableIdArrayAllowEmpty`);
  }
  if (field[2].includes("at least one") && field[3].startsWith("stableIdArray") && field[3] !== "stableIdArrayNonEmpty") {
    throw new Error(`${label} required stable IDs must use stableIdArrayNonEmpty`);
  }
  if (/(?:dateTime|confirmedAt|readAt|occurredAt)$/u.test(field[0]) && field[3] !== "isoDateTime") {
    throw new Error(`${label} timestamp must use strict RFC3339 isoDateTime codec`);
  }
}

function validateMeta(meta) {
  requireExactKeys(
    meta,
    ["artifact", "date", "remediationDate", "branch", "sourceBase", "currentIntegrationTarget", "remediationParent", "reviewScope", "status", "implementationProgramStatus", "implementationStarted", "allowedFiles", "lineBudgets", "canonicalRule"],
    "meta"
  );
  requireLocalDate(meta.date, "meta.date");
  requireLocalDate(meta.remediationDate, "meta.remediationDate");
  requireFullSha(meta.sourceBase, "meta.sourceBase");
  requireFullSha(meta.currentIntegrationTarget, "meta.currentIntegrationTarget");
  requireFullSha(meta.remediationParent, "meta.remediationParent");
  if (meta.status !== "HOLD_PENDING_FRESH_REVIEW") throw new Error("meta.status must remain HOLD_PENDING_FRESH_REVIEW");
  if (meta.implementationProgramStatus !== "BLOCKED_PENDING_USER_DB_APPROVAL" || meta.implementationStarted !== false) {
    throw new Error("meta implementation program must remain unstarted and approval-blocked");
  }
  requireStringArray(meta.allowedFiles, "meta.allowedFiles", 4);
  const scope = requireExactKeys(meta.reviewScope, ["mergeBase", "forbidTwoDot", "candidateCommit", "evidenceCommit", "historicalReview"], "meta.reviewScope");
  requireFullSha(scope.mergeBase, "meta.reviewScope.mergeBase");
  if (scope.mergeBase !== meta.sourceBase || scope.forbidTwoDot !== true) throw new Error("meta review scope merge-base/two-dot boundary differs");
  const candidate = requireExactKeys(scope.candidateCommit, ["parent", "allowedPaths"], "meta.reviewScope.candidateCommit");
  requireFullSha(candidate.parent, "meta.reviewScope.candidateCommit.parent");
  if (candidate.parent !== meta.remediationParent) throw new Error("candidate parent differs from remediationParent");
  const expectedCandidatePaths = [SPEC_MARKDOWN_PATH, SPEC_JSON_PATH, VALIDATOR_PATH].sort();
  if (canonicalJson([...requireStringArray(candidate.allowedPaths, "candidate allowedPaths", 3)].sort()) !== canonicalJson(expectedCandidatePaths)) {
    throw new Error("candidate allowed paths differ from the three evaluation artifacts");
  }
  const evidence = requireExactKeys(scope.evidenceCommit, ["parentMustEqualCandidate", "allowedPaths"], "meta.reviewScope.evidenceCommit");
  if (evidence.parentMustEqualCandidate !== true || canonicalJson(evidence.allowedPaths) !== canonicalJson([EVIDENCE_PATH])) {
    throw new Error("evidence commit scope must be the evidence manifest only");
  }
}

function validateTupleSchemas(tupleSchemas) {
  requireExactKeys(tupleSchemas, ["field", "source", "acceptance", "transition", "browserAssertion"], "tupleSchemas");
  const lengths = { field: 5, source: 4, acceptance: 2, transition: 4, browserAssertion: 3 };
  for (const [key, length] of Object.entries(lengths)) {
    const tuple = requireTuple(tupleSchemas[key], length, `tupleSchemas.${key}`);
    tuple.forEach((item, index) => requireString(item, `tupleSchemas.${key}[${index}]`));
  }
}

function validateSourceSeams(sourceSeams) {
  const seams = requireArray(sourceSeams, "sourceSeams", 1);
  const ids = new Set();
  seams.forEach((seam, index) => {
    requireTuple(seam, 4, `sourceSeams[${index}]`);
    seam.forEach((item, part) => requireString(item, `sourceSeams[${index}][${part}]`));
    if (ids.has(seam[0])) throw new Error(`duplicate source seam ${seam[0]}`);
    ids.add(seam[0]);
  });
}

function validateValidationDomain(validation) {
  requireExactKeys(
    validation,
    ["currentGate", "semanticParity", "modes", "candidateArtifacts", "evidenceManifest", "targetBlobPaths", "currentClaims", "notCurrentlyProved", "redCases", "validator", "implementationProgramGate", "futurePostApprovalVerifierRequirements"],
    "validation"
  );
  requireExactKeys(validation.modes, ["spec-review", "implementation"], "validation.modes");
  if (!validation.modes.implementation.includes("Always exits nonzero") || !validation.modes.implementation.includes("IMPLEMENTATION_BLOCKED_PENDING_USER_DB_APPROVAL")) {
    throw new Error("validation implementation mode does not declare unconditional blocking");
  }
  const expectedArtifacts = [SPEC_MARKDOWN_PATH, SPEC_JSON_PATH, VALIDATOR_PATH];
  if (canonicalJson(validation.candidateArtifacts) !== canonicalJson(expectedArtifacts)) throw new Error("validation candidate artifacts differ");
  if (validation.evidenceManifest !== EVIDENCE_PATH || validation.validator !== VALIDATOR_PATH) throw new Error("validation artifact paths differ");
  requireStringArray(validation.targetBlobPaths, "validation.targetBlobPaths", 1);
  requireStringArray(validation.currentClaims, "validation.currentClaims", 1);
  requireStringArray(validation.notCurrentlyProved, "validation.notCurrentlyProved", 1);
  if (canonicalJson([...validation.redCases].sort()) !== canonicalJson([...DELIBERATE_CASES].sort())) {
    throw new Error("validation.redCases differ from executable deliberate cases");
  }
  const future = requireExactKeys(
    validation.futurePostApprovalVerifierRequirements,
    ["status", "repositoryCanAuthenticateUserApprovalEvent", "repositoryAuthoredManifestAuthoritative", "activation", "approval", "providerAndCi", "domAndBrowser", "postApprovalVerifier"],
    "validation.futurePostApprovalVerifierRequirements"
  );
  if (future.status !== "FUTURE_NORMATIVE_ONLY_UNAUTHENTICATED_UNEXECUTED" || future.repositoryCanAuthenticateUserApprovalEvent !== false || future.repositoryAuthoredManifestAuthoritative !== false) {
    throw new Error("future verifier requirements improperly claim current authority");
  }
  for (const key of ["approval", "providerAndCi", "domAndBrowser"]) {
    requireKeys(future[key], ["futureRequirement", "currentExecutableAcceptance"], `future verifier ${key}`);
    if (future[key].currentExecutableAcceptance !== "none") throw new Error(`future verifier ${key} claims current acceptance`);
  }
  if (future.domAndBrowser.browserExecutions !== 0) throw new Error("future DOM/browser requirement must record zero executions");
}

function validateIntegrationLedger(ledger, meta) {
  requireExactKeys(ledger, ["snapshotId", "capturedAt", "captureMethod", "binding", "sourceBase", "currentIntegrationTarget", "heads", "freshRecheck", "amendmentPolicy", "integrationOrder"], "integrationLedger");
  requireRfc3339(ledger.capturedAt, "integrationLedger.capturedAt");
  requireStringArray(ledger.captureMethod, "integrationLedger.captureMethod", 1);
  requireStringArray(ledger.freshRecheck, "integrationLedger.freshRecheck", 1);
  requireStringArray(ledger.integrationOrder, "integrationLedger.integrationOrder", 1);
  if (ledger.sourceBase !== meta.sourceBase || ledger.currentIntegrationTarget !== meta.currentIntegrationTarget) {
    throw new Error("integration ledger source/target differs from meta");
  }
  const heads = requireArray(ledger.heads, "integrationLedger.heads", 1);
  const ids = new Set();
  for (const [index, head] of heads.entries()) {
    requireKeys(head, ["id", "localRef", "localHead", "worktreeState", "decision"], `integrationLedger.heads[${index}]`);
    requireString(head.id, `integrationLedger.heads[${index}].id`);
    requireString(head.localRef, `integrationLedger.heads[${index}].localRef`);
    requireFullSha(head.localHead, `integrationLedger.heads[${index}].localHead`);
    requireString(head.worktreeState, `integrationLedger.heads[${index}].worktreeState`);
    requireString(head.decision, `integrationLedger.heads[${index}].decision`);
    if (ids.has(head.id)) throw new Error(`duplicate watched head ${head.id}`);
    ids.add(head.id);
    if (head.remoteRef !== null && head.remoteRef !== undefined) requireString(head.remoteRef, `integrationLedger.heads[${index}].remoteRef`);
    if (head.remoteHead !== null && head.remoteHead !== undefined) requireFullSha(head.remoteHead, `integrationLedger.heads[${index}].remoteHead`);
    if (head.aheadBehind !== undefined) {
      requireTuple(head.aheadBehind, 2, `integrationLedger.heads[${index}].aheadBehind`);
      requireInteger(head.aheadBehind[0], `integrationLedger.heads[${index}].aheadBehind[0]`, 0);
      requireInteger(head.aheadBehind[1], `integrationLedger.heads[${index}].aheadBehind[1]`, 0);
    }
  }
  const integration = heads.find((head) => head.id === "integration");
  if (!integration || integration.localHead !== meta.currentIntegrationTarget) throw new Error("integration watched head does not bind current target");
  const policy = requireExactKeys(ledger.amendmentPolicy, ["noAmendment", "amendmentAndFreshReview", "localResolution"], "integrationLedger.amendmentPolicy");
  requireStringArray(policy.noAmendment, "integrationLedger.amendmentPolicy.noAmendment", 1);
  requireStringArray(policy.amendmentAndFreshReview, "integrationLedger.amendmentPolicy.amendmentAndFreshReview", 1);
}

function validateCommon(common) {
  requireExactKeys(common, ["projection", "codecs", "rawProvenance", "typeRegistry"], "common");
  if (Object.keys(requireObject(common.projection, "common.projection")).length === 0) throw new Error("common.projection cannot be empty");
  const codecObject = requireObject(common.codecs, "common.codecs");
  if (Object.keys(codecObject).length === 0) throw new Error("common.codecs cannot be empty");
  for (const [name, codec] of Object.entries(codecObject)) {
    requireExactKeys(codec, ["parse", "serialize", "onInvalid"], `common.codecs.${name}`);
    requireString(codec.parse, `common.codecs.${name}.parse`);
    requireString(codec.serialize, `common.codecs.${name}.serialize`);
    requireString(codec.onInvalid, `common.codecs.${name}.onInvalid`);
  }
  if (!codecObject.isoDateTime.parse.includes("StrictRFC3339") || !codecObject.isoDateTime.parse.includes("Date.parse")) {
    throw new Error("isoDateTime codec must require strict RFC3339 and reject Date.parse-only acceptance");
  }
  if (!codecObject.nullableRfc3339.parse.includes("StrictRFC3339")) throw new Error("nullableRfc3339 codec is missing strict RFC3339 validation");
  const raw = requireExactKeys(common.rawProvenance, ["codec", "unknownFieldRule", "union", "displayProjection", "roundTrip"], "common.rawProvenance");
  const members = requireArray(raw.union, "common.rawProvenance.union", EXPECTED_RAW_KINDS.length);
  const rawKinds = members.map((member, index) => {
    requireKeys(member, ["kind", "sourceType", "required", "identity"], `common.rawProvenance.union[${index}]`);
    requireStringArray(member.required, `common.rawProvenance.union[${index}].required`, 1);
    return requireString(member.kind, `common.rawProvenance.union[${index}].kind`);
  });
  if (canonicalJson(rawKinds) !== canonicalJson(EXPECTED_RAW_KINDS)) throw new Error("raw provenance discriminator order differs");
  const typeRegistry = requireObject(common.typeRegistry, "common.typeRegistry");
  if (Object.keys(typeRegistry).length === 0) throw new Error("common.typeRegistry cannot be empty");
  const codecs = new Set(Object.keys(codecObject));
  for (const [name, registered] of Object.entries(typeRegistry)) {
    requireKeys(registered, ["fields"], `common.typeRegistry.${name}`);
    requireArray(registered.fields, `common.typeRegistry.${name}.fields`, 1).forEach((field, index) =>
      validateFieldTuple(field, `common.typeRegistry.${name}.fields[${index}]`, codecs)
    );
  }
  return codecs;
}

function validateModel(model, codecs) {
  requireExactKeys(model, ["documentEnvelope", "generationSeal", "boundary", "strictTypeScript"], "model");
  const envelope = requireExactKeys(model.documentEnvelope, ["fields", "globalRoots"], "model.documentEnvelope");
  requireArray(envelope.fields, "model.documentEnvelope.fields", 1).forEach((field, index) => {
    requireTuple(field, 3, `model.documentEnvelope.fields[${index}]`);
    field.forEach((item, part) => requireString(item, `model.documentEnvelope.fields[${index}][${part}]`));
  });
  requireArray(envelope.globalRoots, "model.documentEnvelope.globalRoots", 1).forEach((root, index) => {
    requireTuple(root, 2, `model.documentEnvelope.globalRoots[${index}]`);
    root.forEach((item, part) => requireString(item, `model.documentEnvelope.globalRoots[${index}][${part}]`));
  });
  for (const key of ["generationSeal", "boundary", "strictTypeScript"]) {
    if (Object.keys(requireObject(model[key], `model.${key}`)).length === 0) throw new Error(`model.${key} cannot be empty`);
  }
}

function validateWorkflow(workflow) {
  requireExactKeys(workflow, ["reviewStates", "transitions", "forbiddenTransitions", "effects", "revalidation", "save", "share", "commands", "disclaimer"], "workflow");
  const states = requireStringArray(workflow.reviewStates, "workflow.reviewStates", 4);
  if (canonicalJson(states) !== canonicalJson(["generated", "edited", "review_pending", "human_confirmed"])) throw new Error("workflow review states differ");
  requireArray(workflow.transitions, "workflow.transitions", 1).forEach((transition, index) => {
    requireTuple(transition, 4, `workflow.transitions[${index}]`);
    transition.forEach((item, part) => requireString(item, `workflow.transitions[${index}][${part}]`));
  });
  requireStringArray(workflow.forbiddenTransitions, "workflow.forbiddenTransitions", 1);
  for (const key of ["effects", "revalidation", "save", "share", "commands"]) {
    if (Object.keys(requireObject(workflow[key], `workflow.${key}`)).length === 0) throw new Error(`workflow.${key} cannot be empty`);
  }
  requireString(workflow.disclaimer, "workflow.disclaimer");
}

function validatePhotoAuthority(photo, codecs) {
  requireExactKeys(photo, ["phaseAStates", "canonicalField", "mapping", "legacyTwoFieldMap", "transitions", "local", "post", "get", "storedAssetDeferred", "beforeAfter", "reviewAuthority"], "persistence.photo");
  requireStringArray(photo.phaseAStates, "persistence.photo.phaseAStates", 1);
  for (const key of ["mapping", "local", "post", "get", "storedAssetDeferred"]) {
    if (Object.keys(requireObject(photo[key], `persistence.photo.${key}`)).length === 0) throw new Error(`persistence.photo.${key} cannot be empty`);
  }
  requireArray(photo.legacyTwoFieldMap, "persistence.photo.legacyTwoFieldMap", 1);
  requireArray(photo.transitions, "persistence.photo.transitions", 1);
  const review = requireExactKeys(
    photo.reviewAuthority,
    ["id", "status", "currentReality", "states", "events", "digestType", "futureEvent", "canonicalAnalysisPayload", "canonicalEventDigest", "transition", "evidenceGate", "privacy", "atomicWrite", "revisionSealImpact", "persistenceGate", "plannedOwner", "plannedFiles"],
    "persistence.photo.reviewAuthority"
  );
  if (review.status !== "BLOCKED_PENDING_USER_DB_APPROVAL") throw new Error("photo review authority is not blocked");
  if (canonicalJson(review.states) !== canonicalJson(["candidate", "confirmed", "rejected"])) throw new Error("photo review states differ");
  if (canonicalJson(review.events) !== canonicalJson(["HUMAN_CONFIRM_IMPROVEMENT", "HUMAN_REJECT_IMPROVEMENT"])) throw new Error("photo review events differ");
  const event = requireExactKeys(review.futureEvent, ["status", "fields", "relationships"], "persistence.photo.reviewAuthority.futureEvent");
  if (event.status !== "FUTURE_NORMATIVE_ONLY_PENDING_APPROVED_TRANSACTION") throw new Error("photo event improperly claims current authority");
  requireExactKeys(event.fields, Object.keys(EXPECTED_PHOTO_EVENT_FIELDS), "photo future event fields");
  if (canonicalJson(event.fields) !== canonicalJson(EXPECTED_PHOTO_EVENT_FIELDS)) throw new Error("photo future event field codecs differ");
  for (const [name, codec] of Object.entries(event.fields)) {
    if (name !== "action" && !codecs.has(codec)) throw new Error(`photo event field ${name} references unknown codec ${codec}`);
  }
  const relationships = requireExactKeys(event.relationships, ["always", "confirm", "rejectCompletedPair", "rejectMissingAfter", "revision", "controlBinding", "analysisBinding", "eventBinding"], "photo future event relationships");
  const fieldNames = new Set(Object.keys(event.fields));
  const checkReferences = (items, label) => {
    for (const item of requireStringArray(items, label, 1)) {
      if (!fieldNames.has(item)) throw new Error(`${label} references unknown field ${item}`);
    }
  };
  const always = requireExactKeys(relationships.always, ["requires"], "photo relationship always");
  checkReferences(always.requires, "photo relationship always.requires");
  for (const name of ["confirm", "rejectCompletedPair", "rejectMissingAfter"]) {
    const relationship = requireObject(relationships[name], `photo relationship ${name}`);
    requireString(relationship.when, `photo relationship ${name}.when`);
    requireString(relationship.timestampEquality, `photo relationship ${name}.timestampEquality`);
    for (const key of ["requiresNonNull", "forbidsNonNull", "requiresNull"]) {
      if (relationship[key] !== undefined) checkReferences(relationship[key], `photo relationship ${name}.${key}`);
    }
  }
  const confirmRequired = relationships.confirm.requiresNonNull;
  if (!confirmRequired.includes("afterImageSha256") || !confirmRequired.includes("confirmedAt")) {
    throw new Error("photo confirmation must require non-null after image and confirmedAt");
  }
  if (!relationships.rejectCompletedPair.requiresNonNull.includes("afterImageSha256")) {
    throw new Error("completed-pair rejection must require non-null after image");
  }
  if (!relationships.rejectMissingAfter.requiresNull.includes("afterImageSha256")) {
    throw new Error("missing-after rejection must require null after image");
  }
  if (relationships.revision !== "resultingRevision=candidateRevision+1") throw new Error("photo revision relationship differs");
  requireStringArray(review.plannedFiles, "persistence.photo.reviewAuthority.plannedFiles", 1);
}

function validatePersistence(persistence, codecs) {
  requireExactKeys(persistence, ["primaryPath", "storage", "envelopeFields", "digestDefinitions", "topLevelSeal", "serverRevisionAuthority", "localDraftKey", "migrationPerformedByThisArtifact", "authorityMigrationApprovalRequired", "featureFlag", "photo"], "persistence");
  requireArray(persistence.envelopeFields, "persistence.envelopeFields", 1).forEach((field, index) =>
    validateFieldTuple(field, `persistence.envelopeFields[${index}]`, codecs)
  );
  for (const key of ["digestDefinitions", "topLevelSeal", "featureFlag"]) {
    if (Object.keys(requireObject(persistence[key], `persistence.${key}`)).length === 0) throw new Error(`persistence.${key} cannot be empty`);
  }
  if (persistence.migrationPerformedByThisArtifact !== false || persistence.authorityMigrationApprovalRequired !== true) {
    throw new Error("persistence migration approval boundary differs");
  }
  const authority = requireObject(persistence.serverRevisionAuthority, "persistence.serverRevisionAuthority");
  if (authority.status !== "BLOCKED_PENDING_USER_DB_APPROVAL") throw new Error("server revision authority is not blocked");
  requireKeys(authority, ["rootIdempotency", "transaction", "replay", "conflict", "plannedFiles"], "persistence.serverRevisionAuthority");
  requireKeys(authority.rootIdempotency, ["strategyA", "strategyB"], "persistence.serverRevisionAuthority.rootIdempotency");
  requireStringArray(authority.transaction, "server revision transaction", 1);
  requireStringArray(authority.plannedFiles, "server revision plannedFiles", 1);
  validatePhotoAuthority(persistence.photo, codecs);
}

function validateEvidencePresentation(presentation) {
  requireExactKeys(presentation, ["defaultPriority", "defaultForbidden", "trigger", "countSource", "drawer", "externalLinks"], "evidencePresentation");
  requireStringArray(presentation.defaultPriority, "evidencePresentation.defaultPriority", 5);
  requireStringArray(presentation.defaultForbidden, "evidencePresentation.defaultForbidden", 1);
  for (const key of ["trigger", "countSource", "drawer", "externalLinks"]) {
    if (Object.keys(requireObject(presentation[key], `evidencePresentation.${key}`)).length === 0) throw new Error(`evidencePresentation.${key} cannot be empty`);
  }
}

function validateUi(ui) {
  requireExactKeys(ui, ["direction", "measuredFailingBaseline", "layout", "mobileScroll", "typography", "warning", "actions", "states", "accessibility", "invariant", "browserFixtures", "textZoom200", "browserAssertions"], "ui");
  for (const key of ["measuredFailingBaseline", "layout", "mobileScroll", "typography", "warning", "actions", "states", "accessibility", "invariant", "browserFixtures"]) {
    if (Object.keys(requireObject(ui[key], `ui.${key}`)).length === 0) throw new Error(`ui.${key} cannot be empty`);
  }
  const zoom = requireExactKeys(ui.textZoom200, ["id", "status", "browserExecutions", "validatorCoverage", "matrix", "harness", "futureLocatorCensus", "futureImplementationChecks", "futureTestGeneration", "evidenceGate"], "ui.textZoom200");
  if (zoom.status !== "DECLARED_NOT_EXECUTED" || zoom.browserExecutions !== 0) throw new Error("200 percent browser contract must be unexecuted");
  if (Object.hasOwn(zoom, "negativeFixtures")) throw new Error("synthetic zoom negative fixtures must not be an acceptance claim");
  requireExactKeys(zoom.matrix, ["browsers", "viewports", "themes", "documentKeys", "caseCountPerBrowser", "totalCaseCount"], "ui.textZoom200.matrix");
  if (zoom.matrix.totalCaseCount !== 144 || zoom.matrix.caseCountPerBrowser !== 48) throw new Error("200 percent matrix cardinality differs");
  requireStringArray(zoom.matrix.browsers, "ui.textZoom200.matrix.browsers", 3);
  requireStringArray(zoom.matrix.viewports, "ui.textZoom200.matrix.viewports", 2);
  requireStringArray(zoom.matrix.themes, "ui.textZoom200.matrix.themes", 2);
  for (const key of ["harness", "futureLocatorCensus", "futureImplementationChecks"]) {
    if (Object.keys(requireObject(zoom[key], `ui.textZoom200.${key}`)).length === 0) throw new Error(`ui.textZoom200.${key} cannot be empty`);
  }
  requireArray(ui.browserAssertions, "ui.browserAssertions", 25).forEach((assertion, index) => {
    requireTuple(assertion, 3, `ui.browserAssertions[${index}]`);
    assertion.forEach((item, part) => requireString(item, `ui.browserAssertions[${index}][${part}]`));
  });
  if (ui.browserAssertions.length !== 25) throw new Error("ui.browserAssertions must contain exactly 25 entries");
}

function validateComponents(components) {
  requireExactKeys(components, ["orchestrators", "primitives", "fileMap", "documentComponentPath", "testOwnershipRule", "exportNameRule", "resolvedNames", "forbiddenAliases", "documentSpecificRule", "duplicationRule"], "components");
  requireStringArray(components.orchestrators, "components.orchestrators", 1);
  requireStringArray(components.primitives, "components.primitives", 1);
  const symbols = new Set();
  const paths = new Set();
  requireArray(components.fileMap, "components.fileMap", 1).forEach((entry, index) => {
    requireTuple(entry, 3, `components.fileMap[${index}]`);
    entry.forEach((item, part) => requireString(item, `components.fileMap[${index}][${part}]`));
    if (symbols.has(entry[0]) || paths.has(entry[1])) throw new Error("components.fileMap contains a duplicate symbol or path");
    symbols.add(entry[0]);
    paths.add(entry[1]);
  });
  if (Object.keys(requireObject(components.resolvedNames, "components.resolvedNames")).length === 0) throw new Error("components.resolvedNames cannot be empty");
  requireStringArray(components.forbiddenAliases, "components.forbiddenAliases", 1);
}

function validateExport(exportContract) {
  requireExactKeys(exportContract, ["semanticDeterminism", "binaryByteEqualityRequired", "manifest", "roundTripDefinition", "roundTripOwner", "pureCodecLimit", "actualSeamsAtTarget", "actualRoutes", "excludedTargetSeam", "unknownFieldPolicy", "currentRouteCompatibility"], "export");
  if (exportContract.binaryByteEqualityRequired !== false) throw new Error("export binary byte equality requirement differs");
  for (const key of ["manifest", "roundTripOwner", "excludedTargetSeam", "currentRouteCompatibility"]) {
    if (Object.keys(requireObject(exportContract[key], `export.${key}`)).length === 0) throw new Error(`export.${key} cannot be empty`);
  }
  const seams = requireArray(exportContract.actualSeamsAtTarget, "export.actualSeamsAtTarget", 4);
  const shape = seams.map((seam, index) => {
    requireKeys(seam, ["id", "kind", "clientSymbol", "serverPath", "serverSymbol"], `export.actualSeamsAtTarget[${index}]`);
    return [seam.id, seam.kind, seam.clientSymbol, seam.serverPath, seam.serverSymbol];
  });
  if (canonicalJson(shape) !== canonicalJson(EXPECTED_EXPORT_SEAMS)) throw new Error("export seams differ from target contract");
  const routes = requireArray(exportContract.actualRoutes, "export.actualRoutes", 3);
  if (routes.length !== 3) throw new Error("export.actualRoutes must contain XLSX, PDF, and binary HWP only");
  routes.forEach((route, index) => {
    requireExactKeys(route, ["id", "method", "path", "url", "roundTrip"], `export.actualRoutes[${index}]`);
    if (route.method !== "POST") throw new Error(`export route ${route.id} must be POST`);
  });
  if (exportContract.roundTripOwner.wave !== "wave5") throw new Error("export round-trip owner must be wave5");
}

function validateDocuments(documents, codecs, typeRegistry) {
  const registry = requireArray(documents, "documents", 12);
  if (registry.length !== 12 || canonicalJson(registry.map((document) => document.key)) !== canonicalJson(DOCUMENT_KEYS)) {
    throw new Error("documents must contain the exact 12 keys in production order");
  }
  const ids = new Set();
  const components = new Set();
  for (const [index, document] of registry.entries()) {
    requireExactKeys(document, ["id", "key", "title", "type", "component", "family", "primaryAction", "primaryActionRule", "typeBindings", "fields", "fieldNotes", "interactions", "gates", "schemaOrder"], `documents[${index}]`);
    for (const key of ["id", "key", "title", "type", "component", "family", "primaryAction", "primaryActionRule"]) requireString(document[key], `documents[${index}].${key}`);
    if (ids.has(document.id) || components.has(document.component)) throw new Error(`documents[${index}] duplicates an ID or component`);
    ids.add(document.id);
    components.add(document.component);
    const fields = requireArray(document.fields, `documents[${index}].fields`, 1);
    fields.forEach((field, fieldIndex) => validateFieldTuple(field, `documents[${index}].fields[${fieldIndex}]`, codecs));
    requireObject(document.fieldNotes, `documents[${index}].fieldNotes`);
    requireStringArray(document.interactions, `documents[${index}].interactions`, 1);
    requireStringArray(document.gates, `documents[${index}].gates`, 1);
    const markers = [];
    requireArray(document.typeBindings, `documents[${index}].typeBindings`).forEach((binding, bindingIndex) => {
      requireExactKeys(binding, ["prefix", "type", "currentOverrides"], `documents[${index}].typeBindings[${bindingIndex}]`);
      requireString(binding.prefix, `documents[${index}].typeBindings[${bindingIndex}].prefix`);
      requireString(binding.type, `documents[${index}].typeBindings[${bindingIndex}].type`);
      requireObject(binding.currentOverrides, `documents[${index}].typeBindings[${bindingIndex}].currentOverrides`);
      if (!Object.hasOwn(typeRegistry, binding.type)) throw new Error(`${document.key} references unknown type binding ${binding.type}`);
      markers.push(`@${binding.type}:${binding.prefix}`);
    });
    const expectedOrderMembers = [...markers, ...fields.map((field) => field[0])].sort();
    const actualOrderMembers = [...requireStringArray(document.schemaOrder, `documents[${index}].schemaOrder`, 1)].sort();
    if (canonicalJson(actualOrderMembers) !== canonicalJson(expectedOrderMembers)) throw new Error(`${document.key} schemaOrder differs from fields and bindings`);
  }
}

function validateImplementation(implementation, contractIds, documents, components, exportContract) {
  requireExactKeys(implementation, ["programStatus", "startGate", "codecFixtureMatrix", "waves", "fileOwnership", "browserMatrixId", "viewports", "browserMatrix", "acceptance"], "implementation");
  if (implementation.programStatus !== "BLOCKED_PENDING_USER_DB_APPROVAL") throw new Error("implementation program is not approval-blocked");
  const matrix = requireExactKeys(implementation.codecFixtureMatrix, ["id", "caseSet", "ownership", "targets", "rows"], "implementation.codecFixtureMatrix");
  if (Object.keys(requireObject(matrix.caseSet, "implementation.codecFixtureMatrix.caseSet")).length === 0) throw new Error("codec fixture caseSet cannot be empty");
  if (Object.keys(requireObject(matrix.ownership, "implementation.codecFixtureMatrix.ownership")).length === 0) throw new Error("codec fixture ownership cannot be empty");
  requireStringArray(matrix.targets, "implementation.codecFixtureMatrix.targets", 1);
  if (requireArray(matrix.rows, "implementation.codecFixtureMatrix.rows", 12).length !== 12) throw new Error("codec fixture matrix must have 12 rows");
  matrix.rows.forEach((row, index) => {
    requireTuple(row, 4, `implementation.codecFixtureMatrix.rows[${index}]`);
    row.forEach((item, part) => requireString(item, `implementation.codecFixtureMatrix.rows[${index}][${part}]`));
  });
  if (canonicalJson(matrix.rows.map((row) => row[1])) !== canonicalJson(DOCUMENT_KEYS)) throw new Error("codec fixture matrix document order differs");
  const waves = requireArray(implementation.waves, "implementation.waves", 6);
  if (waves.length !== 6) throw new Error("implementation must declare exactly six waves");
  const writeOwners = new Map();
  for (const [index, wave] of waves.entries()) {
    requireExactKeys(wave, ["id", "status", "owner", "name", "documents", "objective", "entryGate", "ownedFiles", "readOnlyDependencies", "testFiles", "commands", "tddGates", "browserAssertions", "exitGate", "rollback", "featureFlagRef", "browserMatrixRef", "databaseMigration", "apiChange", "productionFixBoundary"], `implementation.waves[${index}]`);
    if (wave.id !== `wave${index}` || wave.status !== "BLOCKED_PENDING_USER_DB_APPROVAL") throw new Error(`implementation wave${index} is not correctly blocked`);
    for (const key of ["owner", "name", "objective", "entryGate", "exitGate", "rollback"]) requireString(wave[key], `implementation.waves[${index}].${key}`);
    if (wave.productionFixBoundary !== null) requireString(wave.productionFixBoundary, `implementation.waves[${index}].productionFixBoundary`);
    requireArray(wave.documents, `implementation.waves[${index}].documents`);
    requireArray(wave.readOnlyDependencies, `implementation.waves[${index}].readOnlyDependencies`);
    requireArray(wave.browserAssertions, `implementation.waves[${index}].browserAssertions`);
    requireStringArray(wave.tddGates, `implementation.waves[${index}].tddGates`, 1);
    const commands = requireObject(wave.commands, `implementation.waves[${index}].commands`);
    if (Object.keys(commands).length === 0) throw new Error(`implementation.waves[${index}].commands cannot be empty`);
    Object.entries(commands).forEach(([key, value]) => requireString(value, `implementation.waves[${index}].commands.${key}`));
    for (const kind of ["ownedFiles", "testFiles"]) {
      const files = requireArray(wave[kind], `implementation.waves[${index}].${kind}`);
      files.forEach((file, fileIndex) => {
        requireString(file, `implementation.waves[${index}].${kind}[${fileIndex}]`);
        if (writeOwners.has(file)) throw new Error(`${file} is write-owned by both ${writeOwners.get(file)} and ${wave.id}`);
        writeOwners.set(file, wave.id);
      });
    }
  }
  const wave1 = waves[1];
  if (canonicalJson(wave1.documents) !== canonicalJson(["riskAssessmentDraft", "tbmBriefing", "tbmLogDraft"])) throw new Error("Wave 1 document scope differs");
  for (const [symbol, file, owner] of components.fileMap) {
    if (writeOwners.get(file) !== owner) throw new Error(`${symbol} file ${file} is not uniquely owned by ${owner}`);
  }
  for (const document of documents) {
    const file = `components/workpack-editor/${document.component}.tsx`;
    const owner = DOCUMENT_WAVES.get(document.key);
    if (writeOwners.get(file) !== owner || basename(file, ".tsx") !== document.component) throw new Error(`${document.component} ownership or filename differs`);
  }
  const ownership = requireExactKeys(implementation.fileOwnership, ["rule", "validator", "blockedOwners", "highRiskDeferrals"], "implementation.fileOwnership");
  requireArray(ownership.blockedOwners, "implementation.fileOwnership.blockedOwners", 1).forEach((blocked, index) => {
    requireKeys(blocked, ["owner", "status", "paths"], `implementation.fileOwnership.blockedOwners[${index}]`);
    requireStringArray(blocked.paths, `implementation.fileOwnership.blockedOwners[${index}].paths`, 1).forEach((file) => {
      if (writeOwners.has(file)) throw new Error(`blocked authority path ${file} has executable wave owner ${writeOwners.get(file)}`);
    });
  });
  const wave5 = waves[5];
  for (const path of ["components/WorkpackEditor.tsx", "app/api/export/xlsx/route.ts", "app/api/export/pdf/route.ts", "app/api/export/hwp/route.ts"]) {
    if (!wave5.ownedFiles.includes(path)) throw new Error(`wave5 does not own export call-site path ${path}`);
  }
  if (wave5.ownedFiles.includes("app/api/export/hwpx-template/route.ts") || exportContract.roundTripOwner.wave !== "wave5") throw new Error("HWPX template/round-trip wave ownership differs");
  const viewports = requireArray(implementation.viewports, "implementation.viewports", 1);
  viewports.forEach((viewport, index) => {
    requireExactKeys(viewport, ["id", "width", "height", "requiredThemes", "containment"], `implementation.viewports[${index}]`);
    requireInteger(viewport.width, `implementation.viewports[${index}].width`, 1);
    requireInteger(viewport.height, `implementation.viewports[${index}].height`, 1);
    if (canonicalJson(viewport.requiredThemes) !== canonicalJson(["day", "night"])) throw new Error(`viewport ${viewport.id} theme matrix differs`);
  });
  requireArray(implementation.browserMatrix, "implementation.browserMatrix", 1).forEach((entry, index) => {
    requireExactKeys(entry, ["browser", "viewportId", "themes"], `implementation.browserMatrix[${index}]`);
    requireString(entry.browser, `implementation.browserMatrix[${index}].browser`);
    requireString(entry.viewportId, `implementation.browserMatrix[${index}].viewportId`);
    if (canonicalJson(entry.themes) !== canonicalJson(["day", "night"])) throw new Error(`browser matrix row ${index} themes differ`);
  });
  const acceptance = requireArray(implementation.acceptance, "implementation.acceptance", contractIds.length);
  acceptance.forEach((entry, index) => {
    requireTuple(entry, 2, `implementation.acceptance[${index}]`);
    entry.forEach((item, part) => requireString(item, `implementation.acceptance[${index}][${part}]`));
  });
  if (canonicalJson(acceptance.map((entry) => entry[0])) !== canonicalJson(contractIds)) throw new Error("implementation acceptance IDs differ from contractIds");
}

function validateIndependentGate(gate) {
  requireExactKeys(gate, ["required", "rule", "holdState", "implementationState"], "independentGate");
  if (gate.required !== true || gate.holdState !== "HOLD_PENDING_FRESH_REVIEW" || gate.implementationState !== "BLOCKED_PENDING_USER_DB_APPROVAL") {
    throw new Error("independent gate does not preserve hold and approval block");
  }
}

function validateHumanParityContract(contract) {
  requireExactKeys(contract, ["markdownStart", "markdownEnd", "humanStart", "humanEnd", "renderer", "topLevelEnumeration", "comparison", "proseNormalization", "proseSha256", "humanRequirements", "deliberateMismatch"], "humanParityContract");
  for (const key of ["markdownStart", "markdownEnd", "humanStart", "humanEnd", "renderer", "topLevelEnumeration", "comparison", "proseNormalization"]) requireString(contract[key], `humanParityContract.${key}`);
  requireTypedSha256(contract.proseSha256, "humanParityContract.proseSha256");
  const requirements = requireArray(contract.humanRequirements, "humanParityContract.humanRequirements", 10);
  if (requirements.length !== 10) throw new Error("human parity requirements must contain exactly 10 entries");
  requirements.forEach((entry, index) => {
    requireTuple(entry, 3, `humanParityContract.humanRequirements[${index}]`);
    entry.forEach((item, part) => requireString(item, `humanParityContract.humanRequirements[${index}][${part}]`));
  });
  requireStringArray(contract.deliberateMismatch, "humanParityContract.deliberateMismatch", 1);
}

function validateContractSchema(spec) {
  validateJsonTree(spec);
  requireExactKeys(spec, TOP_LEVEL_DOMAINS, "spec root");
  if (spec.schemaVersion !== "2.7.0") throw new Error("schemaVersion must be 2.7.0");
  validateMeta(spec.meta);
  const contractIds = requireStringArray(spec.contractIds, "contractIds", 1);
  if (new Set(contractIds).size !== contractIds.length) throw new Error("contractIds must be unique");
  validateTupleSchemas(spec.tupleSchemas);
  validateSourceSeams(spec.sourceSeams);
  validateValidationDomain(spec.validation);
  validateIntegrationLedger(spec.integrationLedger, spec.meta);
  const codecs = validateCommon(spec.common);
  validateModel(spec.model, codecs);
  validateWorkflow(spec.workflow);
  validatePersistence(spec.persistence, codecs);
  validateEvidencePresentation(spec.evidencePresentation);
  validateUi(spec.ui);
  validateComponents(spec.components);
  validateExport(spec.export);
  validateDocuments(spec.documents, codecs, spec.common.typeRegistry);
  validateImplementation(spec.implementation, contractIds, spec.documents, spec.components, spec.export);
  validateIndependentGate(spec.independentGate);
  validateHumanParityContract(spec.humanParityContract);
  if (spec.meta.sourceBase !== "d3ad86530bc786d8024206cc5b7c7db60c055278") throw new Error("sourceBase differs from reviewed source");
  if (spec.meta.currentIntegrationTarget !== "f98ae7d16746dfe9fedbeea892e5af7ebb56f9a5") throw new Error("currentIntegrationTarget differs from reviewed target");
  if (spec.meta.remediationParent !== "75b522e8ee49f86482300a5bb3e3ae4ff0dc09ac") throw new Error("remediationParent differs from previous evidence child");
}

function validateNormativeParity(spec, markdown) {
  const contract = spec.humanParityContract;
  const expectedStructural = renderNormativeMarkdown(spec);
  const actualStructural = extractMarkedBlock(markdown, contract.markdownStart, contract.markdownEnd);
  if (actualStructural !== expectedStructural) throw new Error("candidate Markdown structural contract differs from canonical spec.json");
  const expectedHuman = renderHumanMarkdown(spec);
  const actualHuman = extractMarkedBlock(markdown, contract.humanStart, contract.humanEnd);
  if (actualHuman !== expectedHuman) throw new Error("candidate Markdown human requirements differ from canonical spec.json");
  const proseDigest = `sha256:${sha256(normalizedMarkdownProse(markdown, contract))}`;
  if (proseDigest !== contract.proseSha256) throw new Error("candidate Markdown prose outside generated blocks differs from canonical spec.json binding");
  for (const marker of [contract.markdownStart, contract.markdownEnd, contract.humanStart, contract.humanEnd]) {
    if (markdown.split(marker).length !== 2) throw new Error(`candidate Markdown marker is not unique: ${marker}`);
  }
}

function validateBoundBlob(root, commit, record, label) {
  requireExactKeys(record, ["path", "gitBlob", "sha256", "bytes"], label);
  requireString(record.path, `${label}.path`);
  requireString(record.gitBlob, `${label}.gitBlob`);
  if (!FULL_SHA.test(record.gitBlob)) throw new Error(`${label}.gitBlob must be a Git object SHA`);
  requireString(record.sha256, `${label}.sha256`);
  if (!HEX_SHA256.test(record.sha256)) throw new Error(`${label}.sha256 must be lowercase hex`);
  requireInteger(record.bytes, `${label}.bytes`, 0);
  const blob = readBlob(root, commit, record.path);
  if (blobOid(root, commit, record.path) !== record.gitBlob || sha256(blob) !== record.sha256 || blob.length !== record.bytes) {
    throw new Error(`${label} blob identity differs`);
  }
}

function validateCandidateArtifacts(root, manifest, candidate, spec) {
  const records = requireArray(manifest.candidateArtifacts, "manifest.candidateArtifacts", 3);
  const expectedPaths = [...spec.validation.candidateArtifacts].sort();
  const actualPaths = records.map((record) => record.path).sort();
  if (canonicalJson(actualPaths) !== canonicalJson(expectedPaths)) throw new Error("manifest candidate artifact paths differ");
  records.forEach((record, index) => validateBoundBlob(root, candidate, record, `manifest.candidateArtifacts[${index}]`));
}

function validateTargetBlobs(root, manifest, target, spec) {
  const records = requireArray(manifest.targetBlobs, "manifest.targetBlobs", spec.validation.targetBlobPaths.length);
  const expectedPaths = [...spec.validation.targetBlobPaths].sort();
  const actualPaths = records.map((record) => record.path).sort();
  if (canonicalJson(actualPaths) !== canonicalJson(expectedPaths)) throw new Error("manifest target blob paths differ");
  records.forEach((record, index) => validateBoundBlob(root, target, record, `manifest.targetBlobs[${index}]`));
}

function validateEvidenceManifestShape(manifest) {
  requireExactKeys(manifest, ["schemaVersion", "kind", "capturedAt", "branch", "candidateCommit", "candidateParent", "sourceBase", "currentIntegrationTarget", "mergeBase", "candidateArtifacts", "targetBlobs", "refSnapshot", "behaviorExecution", "implementationExecution", "reviewClaims", "notClaims"], "review evidence manifest");
  if (manifest.kind !== "safeclaw-spec-review-evidence/v1") throw new Error("review evidence manifest kind differs");
  requireRfc3339(manifest.capturedAt, "review evidence capturedAt");
  for (const key of ["candidateCommit", "candidateParent", "sourceBase", "currentIntegrationTarget", "mergeBase"]) requireFullSha(manifest[key], `manifest.${key}`);
  requireStringArray(manifest.reviewClaims, "manifest.reviewClaims", 1);
  requireStringArray(manifest.notClaims, "manifest.notClaims", 1);
  const behavior = requireExactKeys(manifest.behaviorExecution, ["executed", "reason"], "manifest.behaviorExecution");
  const implementation = requireExactKeys(manifest.implementationExecution, ["executed", "reason"], "manifest.implementationExecution");
  if (behavior.executed !== false || implementation.executed !== false) throw new Error("spec evidence must record zero behavior and implementation execution");
}

function mutateSchemaForDeliberate(spec, deliberate) {
  const mutated = structuredClone(spec);
  if (deliberate === "domain-missing") delete mutated.export;
  else if (deliberate === "domain-empty") mutated.workflow = {};
  else if (deliberate === "document-fields-empty") mutated.documents[0].fields = [];
  else if (deliberate === "document-primary-action-empty") mutated.documents[0].primaryAction = "";
  else if (deliberate === "photo-object-empty") mutated.persistence.photo.reviewAuthority = {};
  else if (deliberate === "photo-analysis-missing") delete mutated.persistence.photo.reviewAuthority.futureEvent.fields.analysis_id;
  else if (deliberate === "photo-confirm-after-missing") {
    mutated.persistence.photo.reviewAuthority.futureEvent.relationships.confirm.requiresNonNull =
      mutated.persistence.photo.reviewAuthority.futureEvent.relationships.confirm.requiresNonNull.filter((field) => field !== "afterImageSha256");
  } else if (deliberate === "conflict-heads-empty") mutated.integrationLedger.heads = [];
  else if (deliberate === "conflict-local-ref-empty") mutated.integrationLedger.heads[0].localRef = "";
  else if (deliberate === "wave-unblocked") mutated.implementation.waves[0].status = "READY";
  return mutated;
}

function validateSpecReview(args) {
  const root = resolve(args.root);
  const evidence = resolveCommit(root, args.evidence, "evidence");
  const manifest = parseJsonBuffer(readBlob(root, evidence, args.manifest), "review evidence manifest");
  validateEvidenceManifestShape(manifest);

  const candidateInput = args.deliberate === "candidate-ref" ? manifest.candidateParent : args.candidate;
  const sourceBaseInput = args.deliberate === "source-base-ref" ? manifest.currentIntegrationTarget : args.sourceBase;
  const targetInput = args.deliberate === "target-ref" ? manifest.sourceBase : args.target;
  const candidate = resolveCommit(root, candidateInput, "candidate");
  const sourceBase = resolveCommit(root, sourceBaseInput, "source-base");
  const target = resolveCommit(root, targetInput, "target");
  if (manifest.candidateCommit !== candidate || manifest.sourceBase !== sourceBase || manifest.currentIntegrationTarget !== target) {
    throw new Error("manifest candidate/source/target identity differs from explicit refs");
  }
  const actualEvidenceParent = commitParent(root, evidence);
  const checkedEvidenceParent = args.deliberate === "evidence-parent" ? manifest.candidateParent : actualEvidenceParent;
  if (checkedEvidenceParent !== candidate) throw new Error("evidence commit parent is not the candidate commit");
  if (commitParent(root, candidate) !== manifest.candidateParent) throw new Error("candidate parent differs from manifest");

  const spec = parseJsonBuffer(readBlob(root, candidate, SPEC_JSON_PATH), "candidate spec.json");
  let markdown = readBlob(root, candidate, SPEC_MARKDOWN_PATH).toString("utf8");
  if (manifest.branch !== spec.meta.branch || manifest.mergeBase !== sourceBase) throw new Error("manifest branch/merge-base differs from candidate");
  if (canonicalJson(manifest.refSnapshot) !== canonicalJson(spec.integrationLedger)) throw new Error("manifest ref snapshot differs from candidate ledger");
  if (spec.meta.remediationParent !== manifest.candidateParent || spec.meta.sourceBase !== sourceBase || spec.meta.currentIntegrationTarget !== target) {
    throw new Error("candidate provenance differs from manifest and explicit refs");
  }
  const trueMergeBase = gitText(root, ["merge-base", candidate, target]);
  if (trueMergeBase !== sourceBase || spec.meta.reviewScope.mergeBase !== sourceBase) throw new Error("candidate/target merge-base differs from sourceBase");
  if (canonicalJson(commitPaths(root, candidate)) !== canonicalJson([...spec.meta.reviewScope.candidateCommit.allowedPaths].sort())) throw new Error("candidate commit scope differs");
  if (canonicalJson(commitPaths(root, evidence)) !== canonicalJson([...spec.meta.reviewScope.evidenceCommit.allowedPaths].sort())) throw new Error("evidence commit scope differs");
  validateCandidateArtifacts(root, manifest, candidate, spec);
  validateTargetBlobs(root, manifest, target, spec);

  const structuralCases = new Set([
    "domain-missing",
    "domain-empty",
    "document-fields-empty",
    "document-primary-action-empty",
    "photo-object-empty",
    "photo-analysis-missing",
    "photo-confirm-after-missing",
    "conflict-heads-empty",
    "conflict-local-ref-empty",
    "wave-unblocked"
  ]);
  const schemaSpec = structuralCases.has(args.deliberate) ? mutateSchemaForDeliberate(spec, args.deliberate) : spec;
  validateContractSchema(schemaSpec);

  const paritySpec = structuredClone(spec);
  if (args.deliberate === "normative-parity") paritySpec.meta.status = "__deliberate_normative_mismatch__";
  else if (args.deliberate === "json-model") paritySpec.model.documentEnvelope.fields[0][2] = "__deliberate_model_mismatch__";
  else if (args.deliberate === "json-document-primary-action") paritySpec.documents[0].primaryAction = "__deliberate_action_mismatch__";
  else if (args.deliberate === "json-unknown-domain") paritySpec.__deliberateUnknownDomain = { normative: true };
  if (args.deliberate === "md-prose") {
    const original = markdown;
    markdown = markdown.replace("# SafeClaw", "# Deliberately changed SafeClaw");
    if (markdown === original) throw new Error("md-prose deliberate mutation did not apply");
  }
  validateNormativeParity(paritySpec, markdown);

  console.log("SPEC_JSON_PARSE=PASS");
  console.log("STRUCTURAL_19_DOMAIN_SCHEMA=PASS");
  console.log("FULL_MARKDOWN_JSON_PARITY=PASS");
  console.log("IMMUTABLE_CANDIDATE_EVIDENCE_TARGET_IDENTITY=PASS");
  console.log("SPEC_REVIEW_VALIDATION=PASS");
  console.log("BROWSER_EXECUTIONS=0");
  console.log("IMPLEMENTATION_PROGRAM=BLOCKED_PENDING_USER_DB_APPROVAL");
}

function main() {
  const rawArguments = process.argv.slice(2);
  if (rawArguments[0] === "implementation") throw new Error(IMPLEMENTATION_BLOCK);
  const args = parseArguments(rawArguments);
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
    validateContractSchema(spec);
    validateNormativeParity(spec, markdown);
    console.log("AUTHORING_STRUCTURAL_AND_PARITY=PASS");
    console.log("AUTHORING_CHECK_IS_NOT_REVIEW_EVIDENCE");
    console.log("BROWSER_EXECUTIONS=0");
    return;
  }
  if (args.mode === "spec-review") {
    validateSpecReview(args);
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
