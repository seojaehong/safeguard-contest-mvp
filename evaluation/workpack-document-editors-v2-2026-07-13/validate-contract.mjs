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
const FUTURE_SKEW_MILLISECONDS = 300_000;
const CURRENT_CLAIM_FACTS = [
  "CANDIDATE_JSON_PARSE_DECLARED",
  "STRUCTURAL_19_DOMAIN_SCHEMA_DECLARED",
  "MARKDOWN_PARITY_DECLARED",
  "IMMUTABLE_IDENTITY_DECLARED",
  "SIX_WAVES_BLOCKED_DECLARED"
];
const UNEXECUTED_FACTS = [
  "BROWSER_BEHAVIOR_UNEXECUTED",
  "EXPORT_ROUND_TRIP_UNEXECUTED",
  "IMPLEMENTATION_TESTS_UNEXECUTED",
  "SERVER_REVISION_AUTHORITY_BLOCKED",
  "PHOTO_CONFIRMATION_PERSISTENCE_BLOCKED",
  "SHARE_FRESHNESS_ENFORCEMENT_BLOCKED",
  "INDEPENDENT_REVIEW_OUTSIDE_ARTIFACT",
  "USER_DB_APPROVAL_OUTSIDE_REPOSITORY"
];
const CAPTURE_COMMANDS = [
  ["git", "fetch", "origin", "--prune"],
  ["git", "worktree", "list", "--porcelain"],
  ["git", "-C", "<worktree>", "status", "--short", "--branch"],
  ["git", "-C", "<worktree>", "rev-parse", "HEAD"],
  ["git", "-C", "<worktree>", "rev-parse", "@{u}"],
  ["git", "-C", "<worktree>", "rev-list", "--left-right", "--count", "@{u}...HEAD"],
  ["git", "diff", "--name-only", "<merge-base>...<head>", "--", "<planned ownership paths>"]
];
const FRESH_RECHECK_FACTS = [
  "FETCH_REMOTE_REFS",
  "RESOLVE_WATCHED_REFS_TO_FULL_SHA",
  "ENUMERATE_WORKTREES",
  "CAPTURE_WATCHED_WORKTREE_STATUS",
  "RECOMPUTE_DECLARED_PATH_INTERSECTIONS",
  "REBIND_TARGET_BLOBS",
  "RECORD_POST_APPROVAL_SNAPSHOT_ONLY_AFTER_SEPARATE_REVIEW"
];
const SPEC_REVIEW_COMMAND_TOKENS = [
  "node",
  VALIDATOR_PATH,
  "spec-review",
  "--evidence",
  "<FULL_EVIDENCE_SHA>",
  "--manifest",
  EVIDENCE_PATH,
  "--candidate",
  "<FULL_CANDIDATE_SHA>",
  "--source-base",
  "f45bba17bcce0d8ebb2690f82d014dbe42ae8191",
  "--target",
  "f45bba17bcce0d8ebb2690f82d014dbe42ae8191",
  "--validation-time",
  "<STRICT_RFC3339_CURRENT_TIME>"
];
const SPEC_REVIEW_COMMAND_START = "<!-- SAFECLAW-SPEC-REVIEW-COMMAND:BEGIN -->";
const SPEC_REVIEW_COMMAND_END = "<!-- SAFECLAW-SPEC-REVIEW-COMMAND:END -->";
const EXPECTED_FUTURE_VERIFIER_REQUIREMENTS = {
  status: "FUTURE_NORMATIVE_ONLY_UNAUTHENTICATED_UNEXECUTED",
  repositoryCanAuthenticateUserApprovalEvent: false,
  repositoryAuthoredManifestAuthoritative: false,
  activation: "Only after an explicit user DB migration/transactional-RPC approval outside this repository and a fresh independent spec PASS may a separate post-approval verifier be designed, implemented, reviewed, and bound to the then-current provider and CI trust surfaces.",
  approval: {
    futureRequirement: "Bind an externally authenticated approval event identity, actor, strict RFC3339 timestamp, target SHA, immutable spec SHA, and exact migration/RPC proposal digest. No repository-authored JSON, boolean, hash, commit message, Codex prose, or current validator output is authoritative approval.",
    currentExecutableAcceptance: "none"
  },
  providerAndCi: {
    futureRequirement: "Bind provider run/build identity, exact argv, source SHA, exit status, logs, and artifact bytes through a provider-verifiable trust root selected after approval. The present repository cannot establish that trust root.",
    currentExecutableAcceptance: "none"
  },
  domAndBrowser: {
    futureRequirement: "Generate implementation tests from the declared locator census, execute the 144-case 200 percent matrix, and independently recompute typography, reflow, fixed/sticky, cross-parent, clipping, transform/zoom, overflow, nested-scroll, textarea, control-size, gap, and mobile-start metrics from raw measurements.",
    browserExecutions: 0,
    currentExecutableAcceptance: "none"
  },
  postApprovalVerifier: "not implemented; this candidate intentionally contains no implementation PASS path"
};
const EXPECTED_TEXT_ZOOM_PLAN = {
  id: "ZOOM-001",
  status: "DECLARED_NOT_EXECUTED",
  browserExecutions: 0,
  validatorCoverage: "NORMATIVE_STRUCTURE_ONLY; spec-review executes no browser and reports no geometry, typography, reflow, or DOM PASS",
  matrix: {
    browsers: ["Chromium", "Firefox", "WebKit"],
    viewports: ["desktop1440", "mobile390"],
    themes: ["day", "night"],
    documentKeys: "all 12 in exact registry order",
    caseCountPerBrowser: 48,
    totalCaseCount: 144
  },
  harness: {
    baseline: "Future implementation harness: start a fresh context with deviceScaleFactor=1, devicePixelRatio=1, visualViewport.scale=1, data-safeclaw-text-policy=baseline, --safeclaw-type-scale=1, and text-size-adjust=100%, then capture the locator census before mutation.",
    applyExactlyOnce: "Set documentElement.dataset.safeclawTextPolicy=double (data-safeclaw-text-policy=double) and root --safeclaw-type-scale=2 in one evaluate transaction; increment a harness-owned applicationCount from 0 to 1. Typography tokens consume that root scale. Do not call the policy twice.",
    policy: "The test-only root policy scales font-size and line-height tokens only. Browser/native zoom, CSS zoom, transforms, deviceScaleFactor changes, screenshot scaling, nested font multipliers, and visualViewport changes are forbidden.",
    cumulativeGuard: "applicationCount must equal 1; baseline root scale=1 and scaled root scale=2; no ancestor or descendant may contribute transform/zoom/text-size multiplier. Computed text ratios outside 1.9..2.1 fail."
  },
  futureLocatorCensus: {
    status: "IMPLEMENTATION_REQUIREMENT_UNEXECUTED",
    kind: "future safeclaw-browser-typography-census",
    identity: ["fixtureId", "sourceSha", "buildId", "browser", "viewportId/width/height", "theme", "documentKey"],
    invariant: ["deviceScaleFactor=1", "devicePixelRatio=1", "visualViewportScale=1", "applicationCount=1", "baselineRootScale=1", "scaledRootScale=2", "baselinePolicy=baseline", "scaledPolicy=double", "structuredGapPx=8"],
    snapshots: "baseline and scaled each contain page metrics and every measured node: id, parentId, semantic role, text role, visible, DOMRect, client/scroll dimensions, lineCount, computed fontSize/lineHeight, overflowX/Y, position, transform, zoom, text-size-adjust, maxHeight, and clipping ancestor IDs.",
    fixtureSets: ["priorityRegionIds", "reflowProbeIds", "textareaIds", "drawerIds", "editorRootId", "mobileEditorHeadingId"],
    forbiddenFields: ["pass", "passed", "result", "outputSha256", "claimedMetrics"]
  },
  futureImplementationChecks: {
    textScale: "For every text-role node, scaled/baseline fontSize and lineHeight ratios are independently calculated and each must be 1.9..2.1.",
    reflow: "Every designated long-title/warning/table-label/action probe increases lineCount; a raw claimed reflow value is ignored.",
    fixedSticky: "Every visible fixed or sticky node rect is wholly within the viewport and does not cover another priority region.",
    overlap: "Compute cross-parent positive-area intersections for every pair of visible priority regions regardless of parent. Only the open drawer/backdrop allowlist may overlap.",
    clipping: "For each visible node, walk every declared ancestor. Reject horizontal or vertical rect escape when ancestor overflow is hidden, clip, auto, or scroll; reject document scrollWidth>clientWidth+1 and clipped controls/text.",
    transforms: "Every measured node and ancestor has transform=none and numeric zoom=1; inner transform/zoom scaling is forbidden.",
    scroll: "The page is the sole editor scroller. Reject non-drawer overflow auto/scroll with scrollHeight>clientHeight+1; require every textarea overflow-y:hidden and scrollHeight<=clientHeight+1.",
    mobileStart: "At mobile390 after Edit, editor root top<=200px and selected editor heading top<=160px.",
    controls: "Every visible interactive rect is at least 44x44 CSS px and the structured stack gap is 8px.",
    noTrust: "Do not read pass/result booleans. A sidecar containing any forbidden field fails before metrics are computed."
  },
  futureTestGeneration: "After explicit DB authority approval and a separate post-approval verifier design, implementation tests must be generated from the locator census for every declared browser/viewport/theme/document row. The tests, not this spec validator, must capture measurements and exercise negative geometry states.",
  evidenceGate: "Browser execution count is exactly 0 for this artifact. Neither spec-review nor implementation mode can emit typography/browser PASS; implementation mode is unconditionally blocked."
};
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
const RAW_PROVENANCE_MEMBER_KEYS = new Map([
  ["safety_reference_item", ["kind", "sourceType", "required", "optional", "identity", "koshaGuide"]],
  ["ontology_law", ["kind", "sourceType", "required", "identity"]],
  ["ontology_sif", ["kind", "sourceType", "required", "identity"]],
  ["ontology_kosha_guidance", ["kind", "sourceType", "required", "identity"]],
  ["photo_candidate", ["kind", "sourceType", "required", "identity"]],
  ["field_record", ["kind", "sourceType", "required", "identity"]]
]);
const TYPE_REGISTRY_MEMBER_KEYS = new Map([
  ["RiskAssessmentEditorRow", ["base", "fields", "notes"]],
  ["ActorProvenance", ["authority", "fields"]],
  ["HumanConfirmation", ["authority", "fields"]],
  ["WorkerAttendanceConfirmation", ["actor", "fields", "proves"]],
  ["ShareReadConfirmation", ["cannotProve", "fields", "proves"]],
  ["ShareBlockBase", ["fields", "rebuild", "serverBinding", "staleOn"]],
  ["EvidenceMaterializationTarget", ["fields"]],
  ["EditorEvidenceRef", ["digestRule", "fields", "losslessIdentityRule", "normalizationMap", "reviewRequiredRule", "reviewedBooleanForbidden", "validRoleCombinations"]]
]);
const INTEGRATION_HEAD_KEYS = new Map([
  ["integration", ["id", "localRef", "localHead", "remoteRef", "remoteHead", "aheadBehind", "worktreeState", "dirtyPaths", "relevantDirtyPaths", "committedPlannedOverlap", "overlapHunks", "targetSourceDeltaFrom77d", "decision"]],
  ["ontology", ["id", "localRef", "localHead", "remoteRef", "remoteHead", "aheadBehind", "worktreeState", "dirtyPaths", "relevantDirtyPaths", "committedPlannedOverlap", "reviewState", "decision"]],
  ["reports", ["id", "localRef", "localHead", "remoteRef", "remoteHead", "aheadBehind", "worktreeState", "dirtyPaths", "relevantDirtyPaths", "committedPlannedOverlap", "productCommit", "evidenceCommit", "productHunks", "reviewState", "decision"]],
  ["web", ["id", "localRef", "localHead", "remoteRef", "remoteHead", "aheadBehind", "worktreeState", "dirtyPaths", "relevantDirtyPaths", "committedPlannedOverlap", "reviewState", "decision"]],
  ["editor-first-ui", ["id", "localRef", "localHead", "remoteRef", "remoteHead", "aheadBehind", "worktreeState", "dirtyPaths", "relevantDirtyPaths", "committedPlannedOverlap", "decision"]],
  ["share-session-ui", ["id", "localRef", "localHead", "remoteRef", "remoteHead", "worktreeState", "dirtyPaths", "relevantDirtyPaths", "committedPlannedOverlap", "decision"]],
  ["workpack-share-v2", ["id", "localRef", "localHead", "remoteRef", "remoteHead", "aheadBehind", "worktreeState", "dirtyPaths", "relevantDirtyPaths", "committedPlannedOverlap", "decision"]]
]);
const PHOTO_RELATIONSHIP_KEYS = new Map([
  ["confirm", ["when", "requiresNonNull", "forbidsNonNull", "timestampEquality"]],
  ["rejectCompletedPair", ["when", "requiresNonNull", "forbidsNonNull", "timestampEquality"]],
  ["rejectMissingAfter", ["when", "requiresNonNull", "requiresNull", "forbidsNonNull", "timestampEquality"]]
]);
const DOCUMENTED_OPEN_MAP_PATHS = new Set([
  "$.documents[].fieldNotes",
  "$.documents[].typeBindings[].currentOverrides"
]);
const DOCUMENTED_OPEN_MAP_CONTRACT = [
  ["$.documents[].fieldNotes", "non-empty field-path key", "non-empty string"],
  ["$.documents[].typeBindings[].currentOverrides", "non-empty field-path key", "non-empty string"]
];
const CLOSED_OBJECT_GRAPH_SHA256 = "8baf4b3408d7e1d9f9dd3dfe28840471a3088a0097d0fa40d00934114633177e";
const CLOSED_OBJECT_PATH_COUNT = 178;
const UNKNOWN_KEY_ATTACK_OBJECT_COUNT = 255;
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
  "forged-spec-claims",
  "forged-evidence-claims",
  "synthetic-geometry-pass",
  "future-evidence-time",
  "wave-command-echo-pass",
  "candidate-ref",
  "source-base-ref",
  "target-ref",
  "evidence-parent",
  "implementation-empty",
  "implementation-forged",
  "implementation-complete-looking",
  "complete-looking-spec-claims",
  "complete-looking-evidence-claims",
  "unknown-key-matrix"
]);
const RED_CASES = new Set([...DELIBERATE_CASES].filter((name) => name !== "unknown-key-matrix"));

function parseArguments(argv) {
  const result = {
    mode: argv[0] ?? "",
    root: process.cwd(),
    manifest: EVIDENCE_PATH,
    evidence: "",
    candidate: "",
    sourceBase: "",
    target: "",
    validationTime: "",
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
    else if (argument === "--validation-time") result.validationTime = next();
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
    "Every top-level JSON domain is enumerated without an allowlist. Each domain row contains its complete canonical normalized value, including all nested fields; the root row independently binds the whole contract. Every nested object and union member is recursively closed except the two documented string maps.",
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

function renderSpecReviewCommandMarkdown() {
  return [
    SPEC_REVIEW_COMMAND_START,
    "```text",
    SPEC_REVIEW_COMMAND_TOKENS.join(" "),
    "```",
    SPEC_REVIEW_COMMAND_END
  ].join("\n");
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

function rfc3339EpochMilliseconds(value, label) {
  requireRfc3339(value, label);
  const match = RFC3339.exec(value);
  if (!match) throw new Error(`${label} must be strict RFC3339`);
  const fraction = (match[7] ?? "").padEnd(3, "0").slice(0, 3);
  let epoch = Date.UTC(
    Number(match[1]),
    Number(match[2]) - 1,
    Number(match[3]),
    Number(match[4]),
    Number(match[5]),
    Number(match[6]),
    Number(fraction || "0")
  );
  if (match[8] !== "Z") {
    const direction = match[8][0] === "+" ? 1 : -1;
    const [offsetHour, offsetMinute] = match[8].slice(1).split(":").map(Number);
    epoch -= direction * (offsetHour * 60 + offsetMinute) * 60_000;
  }
  return epoch;
}

function resolveValidationTime(value, systemNowMilliseconds = Date.now()) {
  requireString(value, "--validation-time");
  const injected = rfc3339EpochMilliseconds(value, "--validation-time");
  if (Math.abs(injected - systemNowMilliseconds) > FUTURE_SKEW_MILLISECONDS) {
    throw new Error("--validation-time must be within 300 seconds of the process system clock");
  }
  return injected;
}

function requireNotFuture(value, label, validationTimeMilliseconds) {
  const observed = rfc3339EpochMilliseconds(value, label);
  if (observed > validationTimeMilliseconds + FUTURE_SKEW_MILLISECONDS) {
    throw new Error(`${label} exceeds validation time by more than 300 seconds`);
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

function validateCurrentClaims(value, label) {
  const claims = requireExactKeys(value, ["kind", "scope", "executionCount", "browserExecutionCount", "implementationExecutionCount", "facts"], label);
  if (claims.kind !== "safeclaw-spec-review-declarations/v1" || claims.scope !== "SPEC_STRUCTURE_IDENTITY_PARITY_ONLY") {
    throw new Error(`${label} kind/scope differs from the closed declaration schema`);
  }
  for (const key of ["executionCount", "browserExecutionCount", "implementationExecutionCount"]) {
    if (claims[key] !== 0) throw new Error(`${label}.${key} must be exactly 0`);
  }
  if (canonicalJson(claims.facts) !== canonicalJson(CURRENT_CLAIM_FACTS)) throw new Error(`${label}.facts differ from the exact allowlist`);
}

function validateUnexecutedClaims(value, label) {
  const claims = requireExactKeys(value, ["kind", "executionCount", "facts"], label);
  if (claims.kind !== "safeclaw-unexecuted-scope/v1" || claims.executionCount !== 0) {
    throw new Error(`${label} must be the closed zero-execution schema`);
  }
  if (canonicalJson(claims.facts) !== canonicalJson(UNEXECUTED_FACTS)) throw new Error(`${label}.facts differ from the exact allowlist`);
}

function rejectResultBearingKeys(value, label) {
  const forbidden = /^(?:pass|passed|result|results|measurement|measurements|syntheticGeometryPass|actor|receipt|ci|dom|browser|database|approved|verified|ready|complete)$/iu;
  if (Array.isArray(value)) {
    value.forEach((item, index) => rejectResultBearingKeys(item, `${label}[${index}]`));
    return;
  }
  if (!isRecord(value)) return;
  for (const [key, child] of Object.entries(value)) {
    if (forbidden.test(key)) throw new Error(`${label} contains forbidden result-bearing key ${key}`);
    rejectResultBearingKeys(child, `${label}.${key}`);
  }
}

function validateTokenArray(value, expected, label) {
  const tokens = requireArray(value, label);
  tokens.forEach((token, index) => requireString(token, `${label}[${index}]`));
  if (canonicalJson(tokens) !== canonicalJson(expected)) throw new Error(`${label} differs from the canonical token allowlist`);
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

function closedSchemaShape(value, path, objectPaths, observedOpenMaps) {
  if (Array.isArray(value)) {
    const variants = [...new Set(value.map((item) => canonicalJson(closedSchemaShape(item, `${path}[]`, objectPaths, observedOpenMaps))))]
      .sort()
      .map((variant) => JSON.parse(variant));
    return { kind: "array", variants };
  }
  if (!isRecord(value)) return { kind: value === null ? "null" : typeof value };
  objectPaths.add(path);
  if (DOCUMENTED_OPEN_MAP_PATHS.has(path)) {
    observedOpenMaps.add(path);
    for (const [key, child] of Object.entries(value)) {
      requireString(key, `${path} map key`);
      requireString(child, `${path}.${key}`);
    }
    return { kind: "documented-string-map" };
  }
  return {
    kind: "object",
    entries: Object.keys(value)
      .sort()
      .map((key) => [key, closedSchemaShape(value[key], `${path}.${key}`, objectPaths, observedOpenMaps)])
  };
}

function closedObjectGraphEvidence(spec) {
  const objectPaths = new Set();
  const observedOpenMaps = new Set();
  const shape = closedSchemaShape(spec, "$", objectPaths, observedOpenMaps);
  return {
    sha256: sha256(canonicalJson(shape)),
    normalizedObjectPathCount: objectPaths.size,
    observedOpenMaps: [...observedOpenMaps].sort()
  };
}

function assertClosedObjectGraph(spec) {
  const evidence = closedObjectGraphEvidence(spec);
  if (evidence.sha256 !== CLOSED_OBJECT_GRAPH_SHA256) {
    throw new Error(`closed object graph differs; expected ${CLOSED_OBJECT_GRAPH_SHA256}, got ${evidence.sha256}`);
  }
  if (evidence.normalizedObjectPathCount !== CLOSED_OBJECT_PATH_COUNT) {
    throw new Error(`closed object path count differs; expected ${CLOSED_OBJECT_PATH_COUNT}, got ${evidence.normalizedObjectPathCount}`);
  }
  if (canonicalJson(evidence.observedOpenMaps) !== canonicalJson([...DOCUMENTED_OPEN_MAP_PATHS].sort())) {
    throw new Error("documented open map paths differ from the observed object graph");
  }
}

function collectClosedObjectLocations(value, path = "$", segments = [], locations = []) {
  if (Array.isArray(value)) {
    value.forEach((item, index) => collectClosedObjectLocations(item, `${path}[]`, [...segments, index], locations));
    return locations;
  }
  if (!isRecord(value)) return locations;
  if (path !== "$" && !DOCUMENTED_OPEN_MAP_PATHS.has(path)) locations.push({ path, segments });
  if (DOCUMENTED_OPEN_MAP_PATHS.has(path)) return locations;
  Object.entries(value).forEach(([key, child]) => collectClosedObjectLocations(child, `${path}.${key}`, [...segments, key], locations));
  return locations;
}

function deliberateUnknownKey(path) {
  if (path === "$.common.rawProvenance.union[]") return "reviewed";
  if (path.startsWith("$.persistence.photo.reviewAuthority.futureEvent.relationships.")) return "approved";
  if (path === "$.persistence.photo.reviewAuthority.futureEvent.fields") return "finalizedField";
  if (path.startsWith("$.ui.actions")) return "autoApprove";
  if (path === "$.ui.states") return "complete";
  if (path === "$.export.actualRoutes[]") return "adminRoute";
  if (path.includes(".commands")) return "green";
  if (path.startsWith("$.ui.browser") || path.startsWith("$.ui.textZoom200")) return "passed";
  if (path === "$.validation.currentClaims" || path === "$.validation.notCurrentlyProved") return "verified";
  return "__deliberateUnknownKey";
}

function unknownKeyAttackSpotlights(locations) {
  const count = (predicate) => locations.filter(({ path }) => predicate(path)).length;
  return {
    rawProvenanceVariants: count((path) => path === "$.common.rawProvenance.union[]"),
    photoRelationships: count((path) => path.startsWith("$.persistence.photo.reviewAuthority.futureEvent.relationships.")),
    fields: count((path) => path === "$.persistence.photo.reviewAuthority.futureEvent.fields"),
    actions: count((path) => path.startsWith("$.ui.actions")),
    states: count((path) => path === "$.ui.states"),
    routes: count((path) => path === "$.export.actualRoutes[]"),
    commands: count((path) => path.includes(".commands")),
    browser: count((path) => path.startsWith("$.ui.browser") || path.startsWith("$.ui.textZoom200")),
    completeLookingClaims: count((path) => path === "$.validation.currentClaims" || path === "$.validation.notCurrentlyProved")
  };
}

function runUnknownKeyAttackMatrix(spec) {
  validateContractSchema(spec);
  const locations = collectClosedObjectLocations(spec);
  if (locations.length !== UNKNOWN_KEY_ATTACK_OBJECT_COUNT) {
    throw new Error(`unknown-key attack object count differs; expected ${UNKNOWN_KEY_ATTACK_OBJECT_COUNT}, got ${locations.length}`);
  }
  const accepted = [];
  const rejectedForAnotherReason = [];
  for (const { path, segments } of locations) {
    const mutated = structuredClone(spec);
    let target = mutated;
    for (const segment of segments) target = target[segment];
    const key = deliberateUnknownKey(path);
    if (Object.hasOwn(target, key)) throw new Error(`unknown-key attack collides with ${path}.${key}`);
    target[key] = "COMPLETE_LOOKING_UNKNOWN_KEY";
    try {
      validateContractSchema(mutated);
      accepted.push(path);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (!message.includes("closed object graph differs")) rejectedForAnotherReason.push(`${path}: ${message}`);
    }
  }
  if (accepted.length > 0 || rejectedForAnotherReason.length > 0) {
    throw new Error(
      `unknown-key matrix RED: accepted=${accepted.length}, non-closure-rejections=${rejectedForAnotherReason.length}; ` +
        `accepted sample=${accepted.slice(0, 5).join(", ") || "none"}; non-closure sample=${rejectedForAnotherReason.slice(0, 3).join(" | ") || "none"}`
    );
  }
  console.log(`UNKNOWN_KEY_ATTACK_OBJECTS=${locations.length}`);
  console.log(`UNKNOWN_KEY_ATTACK_REJECTED=${locations.length}`);
  console.log(`UNKNOWN_KEY_ATTACK_OPEN_MAPS=${DOCUMENTED_OPEN_MAP_PATHS.size}`);
  console.log(`UNKNOWN_KEY_ATTACK_SPOTLIGHTS=${canonicalJson(unknownKeyAttackSpotlights(locations))}`);
  console.log("UNKNOWN_KEY_ATTACK_MATRIX=PASS");
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
    ["currentGate", "semanticParity", "modes", "candidateArtifacts", "evidenceManifest", "targetBlobPaths", "currentClaims", "notCurrentlyProved", "redCases", "schemaClosure", "validator", "implementationProgramGate", "timestampPolicy", "commandContracts", "futurePostApprovalVerifierRequirements"],
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
  validateCurrentClaims(validation.currentClaims, "validation.currentClaims");
  validateUnexecutedClaims(validation.notCurrentlyProved, "validation.notCurrentlyProved");
  if (canonicalJson([...validation.redCases].sort()) !== canonicalJson([...RED_CASES].sort())) {
    throw new Error("validation.redCases differ from executable deliberate cases");
  }
  const closure = requireExactKeys(
    validation.schemaClosure,
    ["status", "objectGraphSha256", "normalizedObjectPathCount", "closedObjectInstanceCount", "documentedOpenMaps", "unknownKeyAttackTokens", "unknownKeyAttackRunsRequired"],
    "validation.schemaClosure"
  );
  if (
    closure.status !== "CLOSED_EXCEPT_DOCUMENTED_STRING_MAPS" ||
    closure.objectGraphSha256 !== `sha256:${CLOSED_OBJECT_GRAPH_SHA256}` ||
    closure.normalizedObjectPathCount !== CLOSED_OBJECT_PATH_COUNT ||
    closure.closedObjectInstanceCount !== UNKNOWN_KEY_ATTACK_OBJECT_COUNT ||
    canonicalJson(closure.documentedOpenMaps) !== canonicalJson(DOCUMENTED_OPEN_MAP_CONTRACT) ||
    canonicalJson(closure.unknownKeyAttackTokens) !== canonicalJson(["node", VALIDATOR_PATH, "attack-check", "--deliberate", "unknown-key-matrix"]) ||
    closure.unknownKeyAttackRunsRequired !== 2
  ) {
    throw new Error("validation.schemaClosure differs from the independently fixed recursive closure contract");
  }
  const timestampPolicy = requireExactKeys(validation.timestampPolicy, ["kind", "futureSkewSeconds", "injectedTimeMaxClockDeltaSeconds", "validationTimeSource", "rules"], "validation.timestampPolicy");
  if (
    timestampPolicy.kind !== "strict-rfc3339-bounded/v1" ||
    timestampPolicy.futureSkewSeconds !== 300 ||
    timestampPolicy.injectedTimeMaxClockDeltaSeconds !== 300 ||
    timestampPolicy.validationTimeSource !== "EXPLICIT_STRICT_RFC3339_WITH_SYSTEM_CLOCK_GUARD" ||
    canonicalJson(timestampPolicy.rules) !== canonicalJson(["CALENDAR_AND_OFFSET_VALIDATION", "NO_DATE_PARSE", "EVIDENCE_NOT_AFTER_VALIDATION_TIME_PLUS_SKEW", "INJECTED_TIME_WITHIN_SYSTEM_CLOCK_SKEW"])
  ) {
    throw new Error("validation.timestampPolicy differs from the strict bounded policy");
  }
  const commandContracts = requireExactKeys(validation.commandContracts, ["specReview", "authoringCheck", "implementation"], "validation.commandContracts");
  const specReviewCommand = requireExactKeys(commandContracts.specReview, ["status", "tokens", "optionalDeliberateSuffix"], "validation.commandContracts.specReview");
  if (specReviewCommand.status !== "SPEC_REVIEW_ONLY") throw new Error("spec-review command status differs");
  validateTokenArray(specReviewCommand.tokens, SPEC_REVIEW_COMMAND_TOKENS, "validation.commandContracts.specReview.tokens");
  validateTokenArray(specReviewCommand.optionalDeliberateSuffix, ["--deliberate", "<ALLOWLISTED_CASE>"], "validation.commandContracts.specReview.optionalDeliberateSuffix");
  const authoringCommand = requireExactKeys(commandContracts.authoringCheck, ["status", "tokens"], "validation.commandContracts.authoringCheck");
  if (authoringCommand.status !== "LOCAL_STRUCTURE_PARITY_ONLY") throw new Error("authoring command status differs");
  validateTokenArray(authoringCommand.tokens, ["node", VALIDATOR_PATH, "authoring-check"], "validation.commandContracts.authoringCheck.tokens");
  const implementationCommand = requireExactKeys(commandContracts.implementation, ["status", "executionCount", "tokens"], "validation.commandContracts.implementation");
  if (implementationCommand.status !== "BLOCKED_NO_SUCCESS_COMMAND" || implementationCommand.executionCount !== 0 || implementationCommand.tokens.length !== 0) {
    throw new Error("implementation command contract must remain empty and blocked");
  }
  const future = validation.futurePostApprovalVerifierRequirements;
  if (canonicalJson(future) !== canonicalJson(EXPECTED_FUTURE_VERIFIER_REQUIREMENTS)) {
    throw new Error("future verifier requirements differ from the exact normative-only unexecuted schema");
  }
  rejectResultBearingKeys(future.domAndBrowser, "validation.futurePostApprovalVerifierRequirements.domAndBrowser");
}

function validateIntegrationLedger(ledger, meta, validationTimeMilliseconds) {
  requireExactKeys(ledger, ["snapshotId", "capturedAt", "captureMethod", "binding", "sourceBase", "currentIntegrationTarget", "heads", "freshRecheck", "amendmentPolicy", "integrationOrder"], "integrationLedger");
  requireNotFuture(ledger.capturedAt, "integrationLedger.capturedAt", validationTimeMilliseconds);
  if (canonicalJson(ledger.captureMethod) !== canonicalJson(CAPTURE_COMMANDS)) throw new Error("integrationLedger.captureMethod differs from the canonical token allowlist");
  ledger.captureMethod.forEach((tokens, index) => requireStringArray(tokens, `integrationLedger.captureMethod[${index}]`, 1));
  if (canonicalJson(ledger.freshRecheck) !== canonicalJson(FRESH_RECHECK_FACTS)) throw new Error("integrationLedger.freshRecheck differs from the closed fact allowlist");
  requireStringArray(ledger.integrationOrder, "integrationLedger.integrationOrder", 1);
  if (ledger.sourceBase !== meta.sourceBase || ledger.currentIntegrationTarget !== meta.currentIntegrationTarget) {
    throw new Error("integration ledger source/target differs from meta");
  }
  const heads = requireArray(ledger.heads, "integrationLedger.heads", 1);
  const ids = new Set();
  for (const [index, head] of heads.entries()) {
    const id = requireString(requireObject(head, `integrationLedger.heads[${index}]`).id, `integrationLedger.heads[${index}].id`);
    const expectedKeys = INTEGRATION_HEAD_KEYS.get(id);
    if (!expectedKeys) throw new Error(`integrationLedger.heads[${index}] has unknown id ${id}`);
    requireExactKeys(head, expectedKeys, `integrationLedger.heads[${index}]`);
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
    const kind = requireString(requireObject(member, `common.rawProvenance.union[${index}]`).kind, `common.rawProvenance.union[${index}].kind`);
    const expectedKeys = RAW_PROVENANCE_MEMBER_KEYS.get(kind);
    if (!expectedKeys) throw new Error(`common.rawProvenance.union[${index}] has unknown kind ${kind}`);
    requireExactKeys(member, expectedKeys, `common.rawProvenance.union[${index}]`);
    requireStringArray(member.required, `common.rawProvenance.union[${index}].required`, 1);
    return kind;
  });
  if (canonicalJson(rawKinds) !== canonicalJson(EXPECTED_RAW_KINDS)) throw new Error("raw provenance discriminator order differs");
  const typeRegistry = requireObject(common.typeRegistry, "common.typeRegistry");
  if (Object.keys(typeRegistry).length === 0) throw new Error("common.typeRegistry cannot be empty");
  const codecs = new Set(Object.keys(codecObject));
  for (const [name, registered] of Object.entries(typeRegistry)) {
    const expectedKeys = TYPE_REGISTRY_MEMBER_KEYS.get(name);
    if (!expectedKeys) throw new Error(`common.typeRegistry has unknown member ${name}`);
    requireExactKeys(registered, expectedKeys, `common.typeRegistry.${name}`);
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
  requireExactKeys(workflow.commands, ["autosave", "cancel", "conflict", "offline", "save", "shortcuts", "undo"], "workflow.commands");
  requireExactKeys(workflow.commands.undo, ["historyLimit", "preserves", "resetOn", "scope", "textCoalescingMs"], "workflow.commands.undo");
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
    const relationship = requireExactKeys(relationships[name], PHOTO_RELATIONSHIP_KEYS.get(name), `photo relationship ${name}`);
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
  requireExactKeys(authority, ["approvalGate", "conflict", "currentLimitation", "futureRequest", "id", "plannedFiles", "plannedOwner", "replay", "rootIdempotency", "shareEffect", "status", "testsAfterApproval", "transaction", "wave0"], "persistence.serverRevisionAuthority");
  requireExactKeys(authority.rootIdempotency, ["selectionRule", "strategyA", "strategyB"], "persistence.serverRevisionAuthority.rootIdempotency");
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
  requireExactKeys(ui.browserFixtures, ["coreGenerated", "mixedLegacyRisk", "sourceWarning", "lifecycle", "themes"], "ui.browserFixtures");
  requireExactKeys(ui.actions, ["download", "generatedSecondary", "oneDominantAction", "secondary", "shareReadiness", "statePrimary"], "ui.actions");
  requireExactKeys(ui.actions.download, ["ariaLabel", "rule", "visibleLabel"], "ui.actions.download");
  requireExactKeys(ui.actions.statePrimary, ["edited", "generated", "human_confirmed", "review_pending_authority_blocked", "review_pending_authority_ready", "share_block_stale", "stored_fresh"], "ui.actions.statePrimary");
  requireExactKeys(ui.states, ["conflict", "empty", "error", "loading", "offline", "readOnly"], "ui.states");
  const zoom = ui.textZoom200;
  if (canonicalJson(zoom) !== canonicalJson(EXPECTED_TEXT_ZOOM_PLAN)) {
    throw new Error("ui.textZoom200 differs from the exact normative-only unexecuted browser plan");
  }
  rejectResultBearingKeys(zoom, "ui.textZoom200");
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
    requireExactKeys(seam, ["clientPath", "clientSymbol", "id", "kind", "serverPath", "serverSymbol", "targetContract", "url"], `export.actualSeamsAtTarget[${index}]`);
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
    const commands = requireExactKeys(wave.commands, ["status", "executionCount", "tokens"], `implementation.waves[${index}].commands`);
    if (commands.status !== "BLOCKED_NO_EXECUTABLE_COMMANDS" || commands.executionCount !== 0 || !Array.isArray(commands.tokens) || commands.tokens.length !== 0) {
      throw new Error(`implementation.waves[${index}].commands must be an exact empty blocked command contract`);
    }
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
    requireExactKeys(blocked, ["owner", "paths", "status"], `implementation.fileOwnership.blockedOwners[${index}]`);
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

function validateContractSchema(spec, validationTimeMilliseconds = Date.now()) {
  validateJsonTree(spec);
  assertClosedObjectGraph(spec);
  requireExactKeys(spec, TOP_LEVEL_DOMAINS, "spec root");
  if (spec.schemaVersion !== "2.8.0") throw new Error("schemaVersion must be 2.8.0");
  validateMeta(spec.meta);
  const contractIds = requireStringArray(spec.contractIds, "contractIds", 1);
  if (new Set(contractIds).size !== contractIds.length) throw new Error("contractIds must be unique");
  validateTupleSchemas(spec.tupleSchemas);
  validateSourceSeams(spec.sourceSeams);
  validateValidationDomain(spec.validation);
  validateIntegrationLedger(spec.integrationLedger, spec.meta, validationTimeMilliseconds);
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
  if (spec.meta.sourceBase !== "f45bba17bcce0d8ebb2690f82d014dbe42ae8191") throw new Error("sourceBase differs from reviewed source");
  if (spec.meta.currentIntegrationTarget !== "f45bba17bcce0d8ebb2690f82d014dbe42ae8191") throw new Error("currentIntegrationTarget differs from reviewed target");
  if (spec.meta.remediationParent !== "f45bba17bcce0d8ebb2690f82d014dbe42ae8191") throw new Error("remediationParent differs from the authoritative target");
  if (spec.meta.branch !== "feat/workpack-document-editors-v2-target-ready-v2") throw new Error("meta.branch differs from the target-ready branch");
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
  const expectedCommand = renderSpecReviewCommandMarkdown();
  const actualCommand = extractMarkedBlock(markdown, SPEC_REVIEW_COMMAND_START, SPEC_REVIEW_COMMAND_END);
  if (actualCommand !== expectedCommand) throw new Error("candidate Markdown spec-review command differs from the canonical token allowlist");
  if (canonicalJson(spec.validation.commandContracts.specReview.tokens) !== canonicalJson(SPEC_REVIEW_COMMAND_TOKENS)) {
    throw new Error("candidate JSON spec-review command differs from the validator token allowlist");
  }
  for (const marker of [contract.markdownStart, contract.markdownEnd, contract.humanStart, contract.humanEnd, SPEC_REVIEW_COMMAND_START, SPEC_REVIEW_COMMAND_END]) {
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

function validateEvidenceManifestShape(manifest, validationTimeMilliseconds) {
  requireExactKeys(manifest, ["schemaVersion", "kind", "capturedAt", "branch", "candidateCommit", "candidateParent", "sourceBase", "currentIntegrationTarget", "mergeBase", "candidateArtifacts", "targetBlobs", "refSnapshot", "behaviorExecution", "implementationExecution", "reviewClaims", "notClaims"], "review evidence manifest");
  if (manifest.schemaVersion !== "3.0.0" || manifest.kind !== "safeclaw-spec-review-evidence/v1") throw new Error("review evidence manifest schema/kind differs");
  requireNotFuture(manifest.capturedAt, "review evidence capturedAt", validationTimeMilliseconds);
  for (const key of ["candidateCommit", "candidateParent", "sourceBase", "currentIntegrationTarget", "mergeBase"]) requireFullSha(manifest[key], `manifest.${key}`);
  validateCurrentClaims(manifest.reviewClaims, "manifest.reviewClaims");
  validateUnexecutedClaims(manifest.notClaims, "manifest.notClaims");
  const behavior = requireExactKeys(manifest.behaviorExecution, ["executed", "reason"], "manifest.behaviorExecution");
  const implementation = requireExactKeys(manifest.implementationExecution, ["executed", "reason"], "manifest.implementationExecution");
  if (behavior.executed !== false || behavior.reason !== "SPEC_REVIEW_DOES_NOT_EXECUTE_PRODUCT_OR_BROWSER_BEHAVIOR") {
    throw new Error("behavior execution declaration differs from the closed unexecuted fact");
  }
  if (implementation.executed !== false || implementation.reason !== "IMPLEMENTATION_MODE_IS_UNCONDITIONALLY_BLOCKED") {
    throw new Error("implementation execution declaration differs from the closed blocking fact");
  }
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
  else if (deliberate === "forged-spec-claims") mutated.validation.currentClaims = ["actor browser DOM CI database verified PASS"];
  else if (deliberate === "complete-looking-spec-claims") {
    mutated.validation.currentClaims.status = "PASS";
    mutated.validation.currentClaims.verified = true;
    mutated.validation.currentClaims.complete = true;
  }
  else if (deliberate === "synthetic-geometry-pass") mutated.ui.textZoom200.futureImplementationChecks.syntheticGeometryPass = true;
  else if (deliberate === "wave-command-echo-pass") mutated.implementation.waves[0].commands.green = "echo PASS";
  return mutated;
}

function runAttackCheck(args) {
  const root = resolve(args.root);
  if (!args.deliberate) throw new Error("attack-check requires --deliberate");
  if (args.deliberate === "unknown-key-matrix") {
    const spec = JSON.parse(readFileSync(join(root, args.specFile), "utf8"));
    runUnknownKeyAttackMatrix(spec);
    return;
  }
  if (["forged-evidence-claims", "complete-looking-evidence-claims", "future-evidence-time"].includes(args.deliberate)) {
    const evidence = resolveCommit(root, args.evidence, "attack evidence template");
    const manifest = parseJsonBuffer(readBlob(root, evidence, args.manifest), "attack evidence template");
    manifest.schemaVersion = "3.0.0";
    manifest.reviewClaims = { kind: "safeclaw-spec-review-declarations/v1", scope: "SPEC_STRUCTURE_IDENTITY_PARITY_ONLY", executionCount: 0, browserExecutionCount: 0, implementationExecutionCount: 0, facts: CURRENT_CLAIM_FACTS };
    manifest.notClaims = { kind: "safeclaw-unexecuted-scope/v1", executionCount: 0, facts: UNEXECUTED_FACTS };
    manifest.behaviorExecution = { executed: false, reason: "SPEC_REVIEW_DOES_NOT_EXECUTE_PRODUCT_OR_BROWSER_BEHAVIOR" };
    manifest.implementationExecution = { executed: false, reason: "IMPLEMENTATION_MODE_IS_UNCONDITIONALLY_BLOCKED" };
    if (args.deliberate === "forged-evidence-claims") manifest.reviewClaims = ["actor browser DOM CI database approved verified PASS"];
    else if (args.deliberate === "complete-looking-evidence-claims") Object.assign(manifest.reviewClaims, { status: "PASS", verified: true, complete: true });
    else manifest.capturedAt = "2099-01-01T00:00:00Z";
    validateEvidenceManifestShape(manifest, Date.now());
  } else {
    const spec = JSON.parse(readFileSync(join(root, args.specFile), "utf8"));
    validateContractSchema(mutateSchemaForDeliberate(spec, args.deliberate));
  }
  console.log(`DELIBERATE_ATTACK_ACCEPTED=${args.deliberate}`);
}

function validateSpecReviewInvocation(rawArguments, args) {
  const expected = [
    "spec-review",
    "--evidence",
    args.evidence,
    "--manifest",
    EVIDENCE_PATH,
    "--candidate",
    args.candidate,
    "--source-base",
    args.sourceBase,
    "--target",
    args.target,
    "--validation-time",
    args.validationTime
  ];
  if (args.deliberate) expected.push("--deliberate", args.deliberate);
  if (canonicalJson(rawArguments) !== canonicalJson(expected)) {
    throw new Error("spec-review invocation differs from the canonical ordered token contract");
  }
}

function validateSpecReview(args) {
  const root = resolve(args.root);
  const validationTimeMilliseconds = resolveValidationTime(args.validationTime);
  const evidence = resolveCommit(root, args.evidence, "evidence");
  const manifest = parseJsonBuffer(readBlob(root, evidence, args.manifest), "review evidence manifest");
  if (args.deliberate === "forged-evidence-claims") manifest.reviewClaims = ["actor browser DOM CI database approved verified PASS"];
  if (args.deliberate === "complete-looking-evidence-claims") Object.assign(manifest.reviewClaims, { status: "PASS", verified: true, complete: true });
  if (args.deliberate === "future-evidence-time") manifest.capturedAt = "2099-01-01T00:00:00Z";
  validateEvidenceManifestShape(manifest, validationTimeMilliseconds);

  const candidateInput = args.deliberate === "candidate-ref" ? manifest.candidateParent : args.candidate;
  const sourceBaseInput = args.deliberate === "source-base-ref" ? manifest.candidateCommit : args.sourceBase;
  const targetInput = args.deliberate === "target-ref" ? manifest.candidateCommit : args.target;
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

  if (args.deliberate === "unknown-key-matrix") runUnknownKeyAttackMatrix(spec);

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
    "wave-unblocked",
    "forged-spec-claims",
    "complete-looking-spec-claims",
    "synthetic-geometry-pass",
    "wave-command-echo-pass"
  ]);
  const schemaSpec = structuralCases.has(args.deliberate) ? mutateSchemaForDeliberate(spec, args.deliberate) : spec;
  validateContractSchema(schemaSpec, validationTimeMilliseconds);

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
  if (args.mode === "render-spec-review-command") {
    process.stdout.write(renderSpecReviewCommandMarkdown());
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
  if (args.mode === "attack-check") {
    runAttackCheck(args);
    return;
  }
  if (args.mode === "spec-review") {
    validateSpecReviewInvocation(rawArguments, args);
    validateSpecReview(args);
    return;
  }
  throw new Error("Mode must be render-normative, render-human, render-spec-review-command, render-prose-digest, authoring-check, attack-check, spec-review, or implementation");
}

try {
  main();
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`CONTRACT_ERROR: ${message}`);
  process.exitCode = 1;
}
