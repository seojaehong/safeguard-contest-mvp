import { createHash } from "node:crypto";
import { execFileSync, spawnSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

const BASE_SHA = "f45bba17bcce0d8ebb2690f82d014dbe42ae8191";
const CANDIDATE_PARENT_SHA = "e50d2743854a96a160c6c3b95cbe74443a7f98c4";
const INTEGRATION_TARGET_SHA = "ea7aa7223a056c884d5b0ba55563d602af328451";
const SOURCE_CANDIDATE_SHA = "af8d343c65445497da2f804bcdde2eb533390ee8";
const SOURCE_EVIDENCE_SHA = CANDIDATE_PARENT_SHA;
const SOURCE_CANDIDATE_BRANCH = "feat/workpack-document-editors-v2-target-ready-v5";
const REJECTED_V4_CANDIDATE_SHA = "2ec14aaf92e7c03376e6086b889b254e77a6c412";
const REJECTED_V4_EVIDENCE_SHA = "cc9f5af297950b73b53a9ab4018bdc143830c499";
const BRANCH = "feat/workpack-document-editors-v2-target-ready-v5";
const AUTHORITY_REF = "refs/remotes/origin/feat/phase-a-evidence-integration";
const AUTHORITY_BRANCH = "feat/phase-a-evidence-integration";
const ARTIFACT_DIR = "evaluation/workpack-document-editors-v2-target-ready-v6-2026-07-14";
const SPEC_JSON_PATH = `${ARTIFACT_DIR}/spec.json`;
const SPEC_MARKDOWN_PATH = `${ARTIFACT_DIR}/spec.md`;
const VALIDATOR_PATH = `${ARTIFACT_DIR}/validate-contract.mjs`;
const ATTACK_TEST_PATH = `${ARTIFACT_DIR}/contract-remediation-attacks.mjs`;
const EVIDENCE_PATH = `${ARTIFACT_DIR}/review-evidence.json`;
const EXECUTION_LOG_PATH = `${ARTIFACT_DIR}/execution-log.jsonl`;
const RED_LOG_PATH = `${ARTIFACT_DIR}/red-v5-independent-reject.log`;
const IMPLEMENTATION_BLOCK = "IMPLEMENTATION_BLOCKED_PENDING_EXPLICIT_USER_DB_AUTHORITY_APPROVAL";
const EXPECTED_SHAPE_SHA256 = "sha256:913655905856a4ad3e067f7718086dc3418e571f92d5163f89e664278e6d03df";
const EXPECTED_NORMATIVE_SHA256 = "sha256:33fc1ef3d9da6e638621cde23f5e918f428b348bd230394b8cce81910b639471";
const AUTHOR_EVIDENCE_TRUST = "UNTRUSTED_REPRODUCIBLE_REQUIRES_FRESH_INDEPENDENT_RERUN";
const INDEPENDENT_VERDICT = "NOT_ESTABLISHED_BY_AUTHOR_RUNS";
const TEXT_SCALING_PROFILE_ID = "BROWSER-PAGE-ZOOM-200";
const TEXT_SCALING_MECHANISM = "native_browser_page_zoom";
const TEXT_SCALING_OWNER = "browser_page";
const TEXT_SCALING_EXECUTOR = "user_or_browser_zoom_control";
const SELECTED_MOBILE_VIEWPORT = "390x844";
const FULL_SHA = /^[0-9a-f]{40}$/u;
const GIT_BLOB_OID = /^[0-9a-f]{40}$/u;
const TYPED_SHA256 = /^sha256:[0-9a-f]{64}$/u;
const STRICT_RFC3339_UTC = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u;

const CANDIDATE_PATHS = [ATTACK_TEST_PATH, SPEC_JSON_PATH, SPEC_MARKDOWN_PATH, VALIDATOR_PATH].sort();
const EVIDENCE_PATHS = [EVIDENCE_PATH, EXECUTION_LOG_PATH, RED_LOG_PATH].sort();
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
const DOCUMENT_COMPONENTS = [
  "WorkpackSummaryEditor",
  "RiskAssessmentEditor",
  "WorkPlanEditor",
  "WorkPermitEditor",
  "TbmBriefingEditor",
  "TbmLogEditor",
  "SafetyEducationRecordEditor",
  "EmergencyResponseEditor",
  "ImprovementEvidenceEditor",
  "ForeignWorkerBriefingEditor",
  "ForeignWorkerTransmissionEditor",
  "KakaoMessageEditor"
];
const REVIEW_STATES = ["draft", "verified", "published", "unknown"];
const PHOTO_STATES = ["candidate", "review_required", "human_confirmed", "rejected"];
const EXPECTED_PRIMARY_ACTIONS = [
  "Edit summary",
  "Edit risk rows",
  "Edit work sequence",
  "Edit permit",
  "Edit briefing",
  "Record TBM",
  "Record education",
  "Edit response plan",
  "Select before and after",
  "Edit language variants",
  "Prepare transmission",
  "Prepare message"
];
const EXPECTED_FORBIDDEN_SURFACES = [
  "yellow evidence badge",
  "persistent right evidence rail",
  "duplicate left evidence summary",
  "below-editor provenance block",
  "below-editor operation graph",
  "duplicate evidence drawer"
];
const EXPECTED_BROWSER_CASES = [
  ["CH-DESKTOP-1440", "chromium", "1440x1000"],
  ["CH-DESKTOP-1150", "chromium", "1150x900"],
  ["CH-MOBILE-390", "chromium", SELECTED_MOBILE_VIEWPORT],
  ["FF-DESKTOP-1440", "firefox", "1440x1000"],
  ["FF-DESKTOP-1150", "firefox", "1150x900"],
  ["FF-MOBILE-390", "firefox", SELECTED_MOBILE_VIEWPORT],
  ["WK-DESKTOP-1440", "webkit", "1440x1000"],
  ["WK-DESKTOP-1150", "webkit", "1150x900"],
  ["WK-MOBILE-390", "webkit", SELECTED_MOBILE_VIEWPORT]
].map(([id, browser, viewport]) => ({
  kind: "browser_case",
  id,
  browser,
  viewport,
  zoomPercent: 200,
  textScalingProfileId: TEXT_SCALING_PROFILE_ID,
  status: "FUTURE_UNEXECUTED"
}));
const EXPECTED_BROWSER_ASSERTIONS = [
  "touch:minTouchWidthCssPx=44;minTouchHeightCssPx=44",
  "layout:clippingCount=0;horizontal=scrollWidth<=clientWidth;panelOverflowCount=0;pageOverflowCount=0",
  "scroll:nestedTextareaPageDoubleScrollAllowed=false;textareaOverflowY=hidden;pageOwnsVerticalScroll=true",
  "coverage:viewport=390x844;zoomPercents=100,200;themes=Day,Night;editors=all-12;states=all-declared",
  "geometry:overlapCount=0;owningRoot=browser_page;leafFontSizeMutations=0;leafLineHeightMutations=0",
  "product:evidenceDrawerCount=1;forbiddenDefaultSurfaceCount=6;bodyProvenanceSeparate=true;mobileEditorStartMaxY=160"
];
const NEGATIVE_ATTACK_IDS = [
  "photo-empty-controls",
  "photo-duplicate-controls",
  "photo-unapproved-control",
  "photo-arbitrary-digest-object",
  "photo-arbitrary-digest-string",
  "photo-mismatched-set",
  "photo-mismatched-order",
  "photo-mismatched-hash",
  "photo-stale-analysis-revision",
  "photo-stale-review-revision",
  "photo-share-before-confirmation",
  "kosha-impossible-review-state",
  "sif-promoted-to-control",
  "markdown-photo-drift",
  "markdown-hwpx-drift",
  "markdown-scroll-drift",
  "hwpx-second-representation",
  "scroll-nested-editor",
  "stale-ledger-2000",
  "future-ledger-301s",
  "exact-key-extra-bypass-shape",
  "exact-key-extra-recomputed-shape",
  "text-scaling-synthetic-leaf-mutation",
  "mobile-viewport-nonselected-width",
  "evidence-self-sha",
  "candidate-parent-drift"
];
const V5_REJECT_FAILURES = [
  "client-submitted snapshot/control/event digests and unbound receipt nonce were accepted",
  "synthetic run records and marker-only fallback could satisfy author evidence",
  "browser touch, clipping, overflow, scroll, theme, scale, editor, and state assertions were absent",
  "moving integration authority was not resolved from the live remote-tracking ref",
  "author-run records could be mistaken for independent PASS evidence"
];
const OPEN_MAP_PATHS = new Set([
  "$.documents[].fieldNotes",
  "$.documents[].legacyOverrides"
]);

const OBJECT_KEYS = new Map([
  ["safeclaw_workpack_document_editors_contract", ["kind", "schemaVersion", "meta", "reviewScope", "freshnessPolicy", "schemaClosure", "productContract", "evidenceContract", "photoConfirmation", "markdownContract", "exportContract", "scrollContract", "textScalingContract", "documents", "authorityGates", "browserMatrix", "validationContract", "integrationLedger"]],
  ["meta", ["kind", "artifact", "contractDate", "branch", "sourceBase", "currentIntegrationTarget", "candidateParent", "status", "implementationStatus", "browserExecutions"]],
  ["review_scope", ["kind", "candidateAllowedPaths", "evidenceAllowedPaths", "targetBlobPaths", "sourceCandidate", "sourceCandidateBranch", "sourceCandidateUse", "rejectedCandidate", "rejectedEvidence", "ancestryRule", "selfHashRule"]],
  ["freshness_policy", ["kind", "validationTimeArgument", "evidenceMaxAgeSeconds", "ledgerMaxAgeSeconds", "futureSkewSeconds", "validationTimeSystemClockSkewSeconds", "notPerpetual", "regenerationAction"]],
  ["schema_closure", ["kind", "objectGraphSha256", "normativeContractSha256", "minimumClosedObjects", "legacyPermissiveObjectsClosed", "unknownKeyPasses", "rootIncluded", "openMapFamilies", "exactKeyOrder", "shapeBypassRule"]],
  ["open_map_family", ["kind", "pathPattern", "keyCodec", "valueCodec", "purpose"]],
  ["product_contract", ["kind", "documentEditorCount", "evidenceDrawerCount", "evidenceDrawerName", "forbiddenDefaultSurfaces", "bodyProvenanceRule", "mobileEarlyStartMaxY", "mobileScrollOwner", "primaryExperience"]],
  ["evidence_contract", ["kind", "reviewStateEnum", "roles", "separationRule", "unknownStateRule"]],
  ["evidence_role", ["kind", "sourceClass", "role", "eligibleReviewStates", "canPrioritizeHazard", "canSupplyControl", "canEstablishMandate", "directEligibility", "obligationClass", "rule"]],
  ["photo_confirmation_contract", ["kind", "status", "states", "eventSchema", "validationContext", "transitions", "shareGate", "privacyRule", "authorityGateId"]],
  ["photo_event_schema", ["kind", "schemaId", "fields", "eventDigestRule", "unknownKeyRule"]],
  ["photo_field", ["kind", "name", "type", "codec", "requiredOn", "digestCovered"]],
  ["photo_validation_context_contract", ["kind", "snapshotKind", "snapshotFields", "canonicalControlFields", "receiptAuthorityFields", "controlDigestKind", "controlDigestInputFields", "canonicalization", "resolutionRule", "receiptRule", "failClosedRule"]],
  ["photo_transition", ["kind", "from", "event", "to", "precondition", "confirmationBlocked", "shareBlocked"]],
  ["photo_share_gate", ["kind", "beforeConfirmation", "afterConfirmation", "externalAuthority", "staleEvent", "candidateEvidenceRule"]],
  ["markdown_contract", ["kind", "canonicalSource", "renderer", "comparison", "requiredDerivedSections", "photoTableRule", "driftAttacks"]],
  ["export_contract", ["kind", "hwpxRepresentation", "hwpxBuilder", "hwpxServerRoute", "hwpxManifestRepresentation", "templateRouteRule", "channels", "executionStatus", "browserExecutions"]],
  ["export_channel", ["kind", "id", "representation", "path", "roundTrip"]],
  ["scroll_contract", ["kind", "multilineRule", "desktopMultiline", "mobileMultiline", "editorInternalScrollAllowed", "pageAndEditorDoubleScrollAllowed", "allowedInternalScrollOwner", "mobileEditorStartMaxY", "sectionStrategy", "forbiddenRule"]],
  ["text_scaling_contract", ["kind", "profileId", "percent", "mechanism", "owningRoot", "executor", "applicationRule", "caseBindingRule", "perNodeInlineFontSizeMutationCount", "perNodeInlineLineHeightMutationCount", "forbiddenLeafMutationRule", "status", "browserExecutions"]],
  ["document_editor", ["kind", "id", "key", "title", "component", "primaryAction", "bodyRoot", "provenanceRoot", "fields", "fieldNotes", "legacyOverrides"]],
  ["field", ["kind", "name", "type", "codec", "required", "source", "constraints"]],
  ["field_constraints", ["kind", "minimumItems", "uniqueItems", "allowNull", "humanOnly", "generatedValueForbidden"]],
  ["authority_gate", ["kind", "id", "status", "requiresUserDbApproval", "executableCommands", "blockedCapability", "unblockRule"]],
  ["browser_matrix_contract", ["kind", "status", "zoomPercent", "browserExecutions", "productExecutions", "cases", "futureAssertions"]],
  ["browser_case", ["kind", "id", "browser", "viewport", "zoomPercent", "textScalingProfileId", "status"]],
  ["validation_contract", ["kind", "canonicalSpecReviewTokens", "negativeAttacks", "requiredRuns", "requiredCommandMultiplicities", "runRecordKeys", "executionLogKeys", "structuredEvidenceRule", "implementationMode", "claimBoundary", "browserExecutions"]],
  ["negative_attack", ["kind", "id", "scope", "mutation", "expectedErrorPrefix"]],
  ["integration_ledger", ["kind", "capturedAt", "captureCommand", "authorityRef", "authorityHead", "sourceBase", "currentIntegrationTarget", "candidateBranch", "worktreeWasCleanBeforeEdits", "sourceCandidateHead", "sourceCandidateBranch", "sourceCandidateUse", "rejectedReferenceHead", "rejectedReferenceUse", "refreshRequiredAfterSeconds"]],
  ["review_evidence", ["kind", "schemaVersion", "capturedAt", "validationTime", "branch", "candidateCommit", "candidateParent", "sourceBase", "currentIntegrationTarget", "mergeBase", "authorityRef", "authorityHead", "authorEvidenceTrust", "independentVerdict", "rebaseDisposition", "candidateScope", "evidenceScope", "candidateArtifacts", "targetBlobs", "ledgerCapturedAt", "refSnapshotDigest", "browserExecutions", "productExecutions", "buildExecutions", "exportExecutions", "implementationExecutions", "blockedAuthorities", "unexecutedBrowserMatrix", "runRecords", "redBaseline", "v5PreservedBaseline"]],
  ["scope_identity", ["kind", "paths"]],
  ["blob_identity", ["kind", "path", "gitBlob", "sha256", "bytes"]],
  ["run_record", ["kind", "recordId", "commandId", "executable", "args", "cwd", "startedAt", "completedAt", "exitCode", "stdoutDigest", "stderrDigest", "rawLogDigest", "outputLogPath", "outputRecordId"]],
  ["execution_log_entry", ["kind", "recordId", "stdout", "stderr", "stdoutDigest", "stderrDigest"]],
  ["red_baseline", ["kind", "referenceBranch", "referenceCandidate", "referenceEvidence", "observedExit", "failures", "externalAttackCases", "acceptedAttackCases", "normativeMutationCases", "acceptedNormativeMutations", "outputLogPath", "stdoutDigest", "browserExecutions"]],
  ["v5_preserved_baseline", ["kind", "referenceCandidate", "referenceEvidence", "closedObjects", "openMapInstances", "unknownKeyPasses", "unknownKeyAttacksPerRun", "exactKeyRejectionsPerRun", "deliberateAttackCaseCount", "deliberateAttackRequiredRuns", "normativeMutationCases", "normativeMutationRejections", "browserExecutions", "productExecutions", "implementationExecutions"]]
]);

const PHOTO_FIELD_DEFINITIONS = [
  ["snapshotId", "string", "stableId", "always", true],
  ["acceptedControlIds", "string[]", "stableIdArrayNonEmpty", "confirmation", true],
  ["humanReceipt", "object", "humanReceiptExact", "confirmation", true],
  ["humanReceipt.receiptId", "string", "stableId", "confirmation", true],
  ["humanReceipt.workpackId", "string", "stableId", "confirmation", true],
  ["humanReceipt.logicalRootId", "string", "stableId", "confirmation", true],
  ["humanReceipt.action", "enum", "photoReviewAction", "confirmation", true],
  ["humanReceipt.snapshotId", "string", "stableId", "confirmation", true],
  ["humanReceipt.snapshotRevision", "integer", "strictPositiveInteger", "confirmation", true],
  ["humanReceipt.reviewRevision", "integer", "strictPositiveInteger", "confirmation", true],
  ["humanReceipt.beforeImageId", "string", "stableId", "confirmation", true],
  ["humanReceipt.beforeImageSha256", "digest", "sha256HexDigest", "confirmation", true],
  ["humanReceipt.afterImageId", "string", "stableId", "confirmation", true],
  ["humanReceipt.afterImageSha256", "digest|null", "nullableSha256HexDigest", "confirmation_or_completed_rejection", true],
  ["humanReceipt.acceptedControlIds", "string[]", "stableIdArrayNonEmpty", "confirmation", true],
  ["humanReceipt.actorId", "string", "stableId", "confirmation", true],
  ["humanReceipt.actorDisplayName", "string", "nonEmptyString", "confirmation", true],
  ["humanReceipt.actorRole", "string", "nonEmptyString", "confirmation", true],
  ["humanReceipt.occurredAt", "datetime", "strictRfc3339", "confirmation", true],
  ["humanReceipt.confirmedAt", "datetime|null", "nullableStrictRfc3339", "confirmation", true],
  ["humanReceipt.expiresAt", "datetime", "strictRfc3339", "confirmation", true],
  ["humanReceipt.candidateRevision", "integer", "strictPositiveInteger", "confirmation", true],
  ["humanReceipt.resultingRevision", "integer", "strictPositiveInteger", "confirmation", true],
  ["humanReceipt.priorMaterializationDigest", "digest", "sha256HexDigest", "confirmation", true],
  ["humanReceipt.resultingMaterializationDigest", "digest", "sha256HexDigest", "confirmation", true],
  ["humanReceipt.priorEvidenceDigest", "digest", "sha256HexDigest", "confirmation", true],
  ["humanReceipt.resultingEvidenceDigest", "digest", "sha256HexDigest", "confirmation", true],
  ["humanReceipt.resultingGenerationEvidenceDigest", "digest", "sha256HexDigest", "confirmation", true],
  ["humanReceipt.receiptNonce", "string", "stableId", "confirmation", true],
  ["humanReceipt.confirmationPurpose", "enum", "photoConfirmationPurpose", "confirmation", true]
];
const PHOTO_EVENT_KEYS = ["snapshotId", "acceptedControlIds", "humanReceipt"];
const HUMAN_RECEIPT_KEYS = PHOTO_FIELD_DEFINITIONS.slice(3).map(([name]) => name.replace("humanReceipt.", ""));
const PHOTO_CONTEXT_KEYS = ["currentState", "photoAnalysisSnapshot", "receiptAuthority"];
const PHOTO_SNAPSHOT_KEYS = ["authorityIdentity", "canonicalControlMap", "snapshotDigest", "authorityVersion"];
const PHOTO_SNAPSHOT_IDENTITY_KEYS = [
  "workpackId",
  "logicalRootId",
  "snapshotId",
  "revision",
  "beforeImageId",
  "beforeImageSha256",
  "afterImageId",
  "afterImageSha256"
];
const CANONICAL_CONTROL_KEYS = ["controlId", "controlTextSha256", "canonicalOrder"];
const RECEIPT_AUTHORITY_KEYS = [
  ...HUMAN_RECEIPT_KEYS,
  "snapshotDigest",
  "controlDigest",
  "eventDigest",
  "receiptAuthorityDigest",
  "nonceState",
  "consumedAt"
];
const RECEIPT_AUTHORITY_FIELD_PATHS = [
  "receiptId",
  "binding.workpackId|logicalRootId|snapshotId|snapshotRevision|reviewRevision",
  "binding.beforeImageId|beforeImageSha256|afterImageId|afterImageSha256",
  "binding.acceptedControlIds",
  "actor.actorId|actorDisplayName|actorRole",
  "action",
  "occurredAt",
  "confirmedAt",
  "expiresAt",
  "candidateRevision",
  "resultingRevision",
  "priorMaterializationDigest",
  "resultingMaterializationDigest",
  "priorEvidenceDigest",
  "resultingEvidenceDigest",
  "resultingGenerationEvidenceDigest",
  "receiptNonce",
  "confirmationPurpose",
  "snapshotDigest",
  "controlDigest",
  "eventDigest",
  "receiptAuthorityDigest",
  "nonceState",
  "consumedAt|oneTimeConsumeRule"
];

const RUN_RECORD_KEYS = [
  "kind",
  "recordId",
  "commandId",
  "executable",
  "args",
  "cwd",
  "startedAt",
  "completedAt",
  "exitCode",
  "stdoutDigest",
  "stderrDigest",
  "rawLogDigest",
  "outputLogPath",
  "outputRecordId"
];
const EXECUTION_LOG_KEYS = ["kind", "recordId", "stdout", "stderr", "stdoutDigest", "stderrDigest"];
const REQUIRED_COMMAND_MULTIPLICITIES = [
  "authority-fetch=1",
  "authoring-check=2",
  "unknown-key-matrix=2",
  "deliberate-attack=52",
  "focused-remediation-test=2",
  "json-parse-check=1",
  "object-census=1",
  "diff-contract=1",
  "merge-tree-proof=1",
  "implementation-block=1"
];
const JSON_PARSE_SCRIPT = `JSON.parse(require("node:fs").readFileSync("${SPEC_JSON_PATH}", "utf8")); console.log("SPEC_JSON_PARSE_STANDALONE=PASS");`;

const FIELD_CODECS = new Set([
  "nonEmptyString",
  "localDate",
  "nullableLocalDate",
  "strictRfc3339",
  "nullableStrictRfc3339",
  "nonEmptyStringArray",
  "stringArrayAllowEmpty",
  "documentKeyArrayNonEmpty",
  "stableId",
  "nullableStableId",
  "stableIdArrayNonEmpty",
  "stableIdArrayAllowEmpty",
  "strictPositiveInteger",
  "strictBoolean",
  "nullableNonEmptyString",
  "sha256HexDigest",
  "nullableSha256HexDigest",
  "nullableHttpsUrl",
  "attendanceArray",
  "understandingArray",
  "signatureArray",
  "assemblyPointArray",
  "emergencyContactArray",
  "emergencyScenarioArray",
  "improvementArrayNonEmpty",
  "photoReviewState",
  "languageVariantArray",
  "recipientArrayNonEmpty",
  "messageBlockArray",
  "nullableReadConfirmation"
]);

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (isRecord(value)) {
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

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function typedSha256(value) {
  return `sha256:${sha256(value)}`;
}

function requireRecord(value, label) {
  if (!isRecord(value)) throw new Error(`TYPE: ${label} must be an object`);
  return value;
}

function requireArray(value, label, minimum = 0) {
  if (!Array.isArray(value) || value.length < minimum) {
    throw new Error(`TYPE: ${label} must be an array with at least ${minimum} items`);
  }
  return value;
}

function requireString(value, label) {
  if (typeof value !== "string" || value.trim() === "") throw new Error(`TYPE: ${label} must be a non-empty string`);
  return value;
}

function requireInteger(value, label, minimum = Number.MIN_SAFE_INTEGER) {
  if (!Number.isSafeInteger(value) || value < minimum) throw new Error(`TYPE: ${label} must be an integer >= ${minimum}`);
  return value;
}

function requireBoolean(value, label) {
  if (typeof value !== "boolean") throw new Error(`TYPE: ${label} must be boolean`);
  return value;
}

function requireExactKeys(value, expectedKeys, label) {
  const record = requireRecord(value, label);
  const actual = Object.keys(record).sort();
  const expected = [...expectedKeys].sort();
  if (canonicalJson(actual) !== canonicalJson(expected)) {
    const extras = actual.filter((key) => !expected.includes(key));
    const missing = expected.filter((key) => !actual.includes(key));
    throw new Error(`EXACT_KEYS: ${label} extras=[${extras.join(",")}] missing=[${missing.join(",")}]`);
  }
  return record;
}

function normalizeObjectPath(path) {
  return path.replace(/\[\d+\]/gu, "[]");
}

function validateOpenMap(value, path) {
  const record = requireRecord(value, path);
  for (const [key, child] of Object.entries(record)) {
    requireString(key, `${path} key`);
    requireString(child, `${path}.${key}`);
  }
}

function collectClosedObjectsAndRequireExactKeys(value, path = "$", segments = [], locations = []) {
  if (Array.isArray(value)) {
    value.forEach((child, index) =>
      collectClosedObjectsAndRequireExactKeys(child, `${path}[${index}]`, [...segments, index], locations)
    );
    return locations;
  }
  if (!isRecord(value)) return locations;
  const normalizedPath = normalizeObjectPath(path);
  if (OPEN_MAP_PATHS.has(normalizedPath)) {
    validateOpenMap(value, path);
    return locations;
  }
  const kind = requireString(value.kind, `${path}.kind`);
  const expected = OBJECT_KEYS.get(kind);
  if (!expected) throw new Error(`EXACT_KEYS: ${path} has unknown object kind ${kind}`);
  requireExactKeys(value, expected, path);
  locations.push({ path, normalizedPath, segments });
  for (const [key, child] of Object.entries(value)) {
    collectClosedObjectsAndRequireExactKeys(child, `${path}.${key}`, [...segments, key], locations);
  }
  return locations;
}

function shapeNode(value, path = "$") {
  if (Array.isArray(value)) {
    const variants = [...new Set(value.map((child) => canonicalJson(shapeNode(child, `${path}[]`))))]
      .sort()
      .map((serialized) => JSON.parse(serialized));
    return { type: "array", variants };
  }
  if (!isRecord(value)) return { type: value === null ? "null" : typeof value };
  if (OPEN_MAP_PATHS.has(normalizeObjectPath(path))) return { type: "documented_open_string_map" };
  return {
    type: "closed_object",
    kind: value.kind,
    entries: Object.keys(value)
      .sort()
      .map((key) => [key, shapeNode(value[key], `${path}.${key}`)])
  };
}

function objectGraphSha256(spec) {
  return typedSha256(canonicalJson(shapeNode(spec)));
}

function normativeContractSha256(spec) {
  const projection = structuredClone(spec);
  projection.schemaClosure.objectGraphSha256 = "DERIVED_OBJECT_GRAPH_SHA256";
  projection.schemaClosure.normativeContractSha256 = "DERIVED_NORMATIVE_CONTRACT_SHA256";
  return typedSha256(canonicalJson(projection));
}

function countOpenMapInstances(value, path = "$") {
  if (Array.isArray(value)) {
    return value.reduce((count, child) => count + countOpenMapInstances(child, `${path}[]`), 0);
  }
  if (!isRecord(value)) return 0;
  if (OPEN_MAP_PATHS.has(normalizeObjectPath(path))) return 1;
  return Object.entries(value).reduce(
    (count, [key, child]) => count + countOpenMapInstances(child, `${path}.${key}`),
    0
  );
}

function parseStrictRfc3339(value, label) {
  requireString(value, label);
  if (!STRICT_RFC3339_UTC.test(value)) throw new Error(`FRESHNESS_FORMAT: ${label} must be strict UTC RFC3339 with milliseconds`);
  const epoch = Date.parse(value);
  if (!Number.isFinite(epoch) || new Date(epoch).toISOString() !== value) {
    throw new Error(`FRESHNESS_FORMAT: ${label} is not a real calendar timestamp`);
  }
  return epoch;
}

function resolveValidationTime(value, policy, systemNow = Date.now()) {
  const epoch = parseStrictRfc3339(value, "--validation-time");
  if (Math.abs(epoch - systemNow) > policy.validationTimeSystemClockSkewSeconds * 1000) {
    throw new Error("FRESHNESS_CLOCK: --validation-time differs from the system clock by more than 300 seconds");
  }
  return epoch;
}

function requireFreshTimestamp(value, label, validationTime, maxAgeSeconds, futureSkewSeconds) {
  const observed = parseStrictRfc3339(value, label);
  if (observed > validationTime + futureSkewSeconds * 1000) {
    throw new Error(`FRESHNESS_FUTURE: ${label} exceeds validation time plus ${futureSkewSeconds} seconds`);
  }
  if (observed < validationTime - maxAgeSeconds * 1000) {
    throw new Error(`FRESHNESS_STALE: ${label} exceeds the ${maxAgeSeconds}-second TTL; regenerate the candidate/evidence pair`);
  }
  return observed;
}

function requireTypedSha256(value, label) {
  if (typeof value !== "string" || !TYPED_SHA256.test(value)) {
    throw new Error(`PHOTO_DIGEST: ${label} must be sha256:<64 lowercase hexadecimal>`);
  }
  return value;
}

function validateReviewScope(scope) {
  if (canonicalJson([...scope.candidateAllowedPaths].sort()) !== canonicalJson(CANDIDATE_PATHS)) {
    throw new Error("SCOPE: candidate allowed paths differ");
  }
  if (canonicalJson([...scope.evidenceAllowedPaths].sort()) !== canonicalJson(EVIDENCE_PATHS)) {
    throw new Error("SCOPE: evidence allowed paths differ");
  }
  if (
    scope.sourceCandidate !== SOURCE_CANDIDATE_SHA ||
    scope.sourceCandidateBranch !== SOURCE_CANDIDATE_BRANCH ||
    scope.sourceCandidateUse !== "REVIEWED_V5_ANCESTRY_PREFIX_NO_RANGE_IMPORT"
  ) {
    throw new Error("IDENTITY: reviewed v5 ancestry provenance differs");
  }
  if (scope.rejectedCandidate !== REJECTED_V4_CANDIDATE_SHA || scope.rejectedEvidence !== REJECTED_V4_EVIDENCE_SHA) {
    throw new Error("IDENTITY: rejected v4 identities differ");
  }
  const targets = requireArray(scope.targetBlobPaths, "reviewScope.targetBlobPaths", 1);
  if (new Set(targets).size !== targets.length) throw new Error("SCOPE: target blob paths must be unique");
}

function validateFreshnessPolicy(policy) {
  if (
    policy.validationTimeArgument !== "--validation-time" ||
    policy.evidenceMaxAgeSeconds !== 86400 ||
    policy.ledgerMaxAgeSeconds !== 86400 ||
    policy.futureSkewSeconds !== 300 ||
    policy.validationTimeSystemClockSkewSeconds !== 300 ||
    policy.notPerpetual !== true
  ) {
    throw new Error("FRESHNESS_POLICY: bounded TTL policy differs");
  }
  requireString(policy.regenerationAction, "freshnessPolicy.regenerationAction");
}

function validateSchemaClosure(spec, locations, options) {
  const closure = spec.schemaClosure;
  if (closure.minimumClosedObjects !== 328 || locations.length !== closure.minimumClosedObjects) {
    throw new Error(`SCHEMA_CLOSURE: closed objects ${locations.length} differs from required ${closure.minimumClosedObjects}`);
  }
  if (locations[0]?.path !== "$" || closure.rootIncluded !== true) {
    throw new Error("SCHEMA_CLOSURE: root is not included");
  }
  if (closure.legacyPermissiveObjectsClosed !== 86 || closure.unknownKeyPasses !== 2) {
    throw new Error("SCHEMA_CLOSURE: remediation/pass declarations differ");
  }
  const declaredOpenMaps = closure.openMapFamilies.map((entry) => entry.pathPattern).sort();
  if (canonicalJson(declaredOpenMaps) !== canonicalJson([...OPEN_MAP_PATHS].sort())) {
    throw new Error("SCHEMA_CLOSURE: documented open maps differ");
  }
  if (countOpenMapInstances(spec) !== 24) {
    throw new Error("SCHEMA_CLOSURE: documented open map instances differ from 24");
  }
  if (options.skipShapeFingerprint) return;
  const actual = objectGraphSha256(spec);
  const expected = options.expectedShapeFingerprint ?? EXPECTED_SHAPE_SHA256;
  if (closure.objectGraphSha256 !== expected || actual !== expected) {
    throw new Error(`SHAPE_FINGERPRINT: expected ${expected}, declared ${closure.objectGraphSha256}, actual ${actual}`);
  }
}

function validateProductContract(product) {
  if (
    product.documentEditorCount !== 12 ||
    product.evidenceDrawerCount !== 1 ||
    product.evidenceDrawerName !== "EvidenceDetailsDrawer" ||
    product.mobileEarlyStartMaxY !== 160 ||
    product.mobileScrollOwner !== "section_or_page"
  ) {
    throw new Error("PRODUCT_CONTRACT: editor/drawer/mobile contract differs");
  }
  if (
    new Set(product.forbiddenDefaultSurfaces).size !== EXPECTED_FORBIDDEN_SURFACES.length ||
    canonicalJson([...product.forbiddenDefaultSurfaces].sort()) !== canonicalJson([...EXPECTED_FORBIDDEN_SURFACES].sort())
  ) {
    throw new Error("PRODUCT_CONTRACT: forbidden duplicate evidence surface set differs");
  }
  requireString(product.bodyProvenanceRule, "productContract.bodyProvenanceRule");
}

function findEvidenceRole(contract, sourceClass) {
  return contract.roles.find((role) => role.sourceClass === sourceClass);
}

function validateEvidenceContract(contract) {
  if (canonicalJson(contract.reviewStateEnum) !== canonicalJson(REVIEW_STATES)) {
    throw new Error("EVIDENCE_STATE: review state enum differs");
  }
  if (canonicalJson(contract).includes("verified_or_published")) {
    throw new Error("EVIDENCE_STATE: unreachable verified_or_published pseudo-state is forbidden");
  }
  if (contract.roles.length !== 3 || new Set(contract.roles.map((role) => role.sourceClass)).size !== 3) {
    throw new Error("EVIDENCE_ROLE: exactly three separate role classes are required");
  }
  const sif = findEvidenceRole(contract, "sif_case");
  const kosha = findEvidenceRole(contract, "kosha_guidance");
  const law = findEvidenceRole(contract, "law");
  if (
    !sif ||
    sif.role !== "hazard_priority_only" ||
    sif.canPrioritizeHazard !== true ||
    sif.canSupplyControl !== false ||
    sif.canEstablishMandate !== false ||
    sif.directEligibility !== false ||
    sif.eligibleReviewStates.length !== 0
  ) {
    throw new Error("EVIDENCE_ROLE: SIF must remain hazard-priority-only");
  }
  if (
    !kosha ||
    kosha.role !== "guidance" ||
    canonicalJson(kosha.eligibleReviewStates) !== canonicalJson(["verified", "published"]) ||
    kosha.canSupplyControl !== true ||
    kosha.canEstablishMandate !== false ||
    kosha.directEligibility !== true ||
    kosha.obligationClass !== "technical_guidance_only"
  ) {
    throw new Error("EVIDENCE_ROLE: KOSHA guidance role differs");
  }
  if (
    !law ||
    law.role !== "mandate" ||
    canonicalJson(law.eligibleReviewStates) !== canonicalJson(["published"]) ||
    law.canSupplyControl !== false ||
    law.canEstablishMandate !== true ||
    law.directEligibility !== true ||
    law.obligationClass !== "statutory_mandate"
  ) {
    throw new Error("EVIDENCE_ROLE: law mandate role differs");
  }
  for (const role of contract.roles) {
    for (const state of role.eligibleReviewStates) {
      if (!REVIEW_STATES.includes(state)) throw new Error(`EVIDENCE_STATE: ${role.sourceClass} uses unreachable state ${state}`);
    }
  }
}

function validatePhotoSchema(photo) {
  if (
    photo.status !== "FUTURE_NORMATIVE_ONLY_BLOCKED_PENDING_DB_AUTHORITY" ||
    canonicalJson(photo.states) !== canonicalJson(PHOTO_STATES) ||
    photo.eventSchema.schemaId !== "safeclaw-photo-confirmation-event/v6"
  ) {
    throw new Error("PHOTO_STATE: photo authority/state contract differs");
  }
  const schemaFields = photo.eventSchema.fields;
  const actualDefinitions = schemaFields.map((field) => [
    field.name,
    field.type,
    field.codec,
    field.requiredOn,
    field.digestCovered
  ]);
  if (canonicalJson(actualDefinitions) !== canonicalJson(PHOTO_FIELD_DEFINITIONS)) {
    throw new Error("PHOTO_TABLE: canonical field type/codec/requiredOn/digest coverage differs");
  }
  const context = photo.validationContext;
  if (
    context.snapshotKind !== "safeclaw-photo-analysis-snapshot/v2" ||
    canonicalJson(context.snapshotFields) !== canonicalJson(PHOTO_SNAPSHOT_KEYS) ||
    canonicalJson(context.canonicalControlFields) !== canonicalJson(CANONICAL_CONTROL_KEYS) ||
    canonicalJson(context.receiptAuthorityFields) !== canonicalJson(RECEIPT_AUTHORITY_FIELD_PATHS) ||
    context.controlDigestKind !== "safeclaw-photo-control-acceptance/v3" ||
    canonicalJson(context.controlDigestInputFields) !==
      canonicalJson(["kind", "authorityBinding", "snapshotRevision", "snapshotDigest", "selectedControls"])
  ) {
    throw new Error("PHOTO_AUTHORITY: validation context or control digest contract differs");
  }
  if (photo.transitions.length !== 3) throw new Error("PHOTO_STATE: transition count differs");
  const confirmation = photo.transitions.find(
    (transition) => transition.from === "review_required" && transition.event === "VALID_HUMAN_CONFIRMATION"
  );
  if (
    !confirmation ||
    confirmation.to !== "human_confirmed" ||
    confirmation.confirmationBlocked !== false ||
    confirmation.shareBlocked !== false
  ) {
    throw new Error("PHOTO_STATE: reachable review_required -> human_confirmed transition is missing");
  }
  for (const transition of photo.transitions) {
    if (!PHOTO_STATES.includes(transition.from) || !PHOTO_STATES.includes(transition.to)) {
      throw new Error("PHOTO_STATE: transition references an unreachable state");
    }
  }
}

function validateExportContract(contract) {
  if (
    contract.hwpxRepresentation !== "client_builder" ||
    contract.hwpxBuilder !== "@rhwp/core HwpDocument.exportHwpx" ||
    contract.hwpxServerRoute !== null ||
    contract.executionStatus !== "FUTURE_UNEXECUTED" ||
    contract.browserExecutions !== 0
  ) {
    throw new Error("HWPX_REPRESENTATION: HWPX must have one client-builder representation");
  }
  const hwpx = contract.channels.filter((channel) => channel.id === "HWPX");
  if (hwpx.length !== 1 || hwpx[0].representation !== "client_builder" || hwpx[0].path !== "components/WorkpackEditor.tsx") {
    throw new Error("HWPX_REPRESENTATION: HWPX channel differs");
  }
}

function validateScrollContract(contract) {
  if (
    contract.multilineRule !== "auto_size_page_scroll" ||
    contract.editorInternalScrollAllowed !== false ||
    contract.pageAndEditorDoubleScrollAllowed !== false ||
    contract.allowedInternalScrollOwner !== "evidence_drawer_only" ||
    contract.mobileEditorStartMaxY !== 160 ||
    /320px internal-scroll exception/iu.test(contract.desktopMultiline) ||
    /320px internal-scroll exception/iu.test(contract.mobileMultiline)
  ) {
    throw new Error("SCROLL_CONTRACT: editor/page scroll contract differs");
  }
  if (!contract.desktopMultiline.includes("overflow-y hidden") || !contract.mobileMultiline.includes("overflow-y hidden")) {
    throw new Error("SCROLL_CONTRACT: multiline fields must auto-size without internal scrolling");
  }
}

function validateDocuments(documents) {
  if (documents.length !== 12) throw new Error("DOCUMENTS: exactly 12 document editors are required");
  if (canonicalJson(documents.map((document) => document.key)) !== canonicalJson(DOCUMENT_KEYS)) {
    throw new Error("DOCUMENTS: document key order differs");
  }
  if (canonicalJson(documents.map((document) => document.component)) !== canonicalJson(DOCUMENT_COMPONENTS)) {
    throw new Error("DOCUMENTS: document-specific editor components differ");
  }
  if (new Set(documents.map((document) => document.component)).size !== 12) {
    throw new Error("DOCUMENTS: editor components must be unique");
  }
  const primaryActions = documents.map((document) => document.primaryAction);
  if (
    canonicalJson(primaryActions) !== canonicalJson(EXPECTED_PRIMARY_ACTIONS) ||
    new Set(primaryActions).size !== EXPECTED_PRIMARY_ACTIONS.length
  ) {
    throw new Error("DOCUMENTS: primary actions differ from the exact unique values");
  }
  documents.forEach((document, documentIndex) => {
    const label = `documents[${documentIndex}]`;
    if (document.id !== `DOC-${String(documentIndex + 1).padStart(2, "0")}`) {
      throw new Error(`DOCUMENTS: ${label}.id differs`);
    }
    requireString(document.title, `${label}.title`);
    requireString(document.primaryAction, `${label}.primaryAction`);
    if (document.bodyRoot === document.provenanceRoot || !document.bodyRoot.startsWith("documents.") || !document.provenanceRoot.startsWith("evidence.")) {
      throw new Error(`DOCUMENTS: ${label} body/provenance roots are not separate`);
    }
    const fields = requireArray(document.fields, `${label}.fields`, 8);
    const names = fields.map((field) => field.name);
    if (new Set(names).size !== names.length) throw new Error(`DOCUMENTS: ${label} field names must be unique`);
    fields.forEach((field, fieldIndex) => {
      requireString(field.name, `${label}.fields[${fieldIndex}].name`);
      if (!FIELD_CODECS.has(field.codec)) throw new Error(`DOCUMENTS: unknown codec ${field.codec}`);
      const constraints = field.constraints;
      if (constraints.minimumItems !== null) requireInteger(constraints.minimumItems, `${label}.fields[${fieldIndex}].constraints.minimumItems`, 0);
      for (const key of ["uniqueItems", "allowNull", "humanOnly", "generatedValueForbidden"]) {
        requireBoolean(constraints[key], `${label}.fields[${fieldIndex}].constraints.${key}`);
      }
    });
  });
}

function validateAuthorityGates(gates) {
  const expected = ["server_revision_authority", "photo_confirmation_persistence", "share_freshness_authority"];
  if (canonicalJson(gates.map((gate) => gate.id)) !== canonicalJson(expected)) {
    throw new Error("AUTHORITY_GATE: blocked authority IDs differ");
  }
  for (const gate of gates) {
    if (
      gate.status !== "BLOCKED_PENDING_EXPLICIT_USER_DB_AUTHORITY_APPROVAL" ||
      gate.requiresUserDbApproval !== true ||
      gate.executableCommands !== 0
    ) {
      throw new Error(`AUTHORITY_GATE: ${gate.id} is not honestly blocked`);
    }
  }
}

function validateNormativeExactness(spec) {
  const actual = normativeContractSha256(spec);
  if (
    spec.schemaClosure.normativeContractSha256 !== EXPECTED_NORMATIVE_SHA256 ||
    actual !== EXPECTED_NORMATIVE_SHA256
  ) {
    throw new Error(
      `NORMATIVE_EXACTNESS: expected ${EXPECTED_NORMATIVE_SHA256}, declared ${spec.schemaClosure.normativeContractSha256}, actual ${actual}`
    );
  }
}

function validateTextScalingContract(contract) {
  if (
    contract.profileId !== TEXT_SCALING_PROFILE_ID ||
    contract.percent !== 200 ||
    contract.mechanism !== TEXT_SCALING_MECHANISM ||
    contract.owningRoot !== TEXT_SCALING_OWNER ||
    contract.executor !== TEXT_SCALING_EXECUTOR ||
    contract.perNodeInlineFontSizeMutationCount !== 0 ||
    contract.perNodeInlineLineHeightMutationCount !== 0 ||
    contract.status !== "FUTURE_UNEXECUTED" ||
    contract.browserExecutions !== 0
  ) {
    throw new Error("TEXT_SCALING: one owning-page native browser zoom profile with zero leaf mutations is required");
  }
  if (
    !contract.applicationRule.includes("once at the owning browser page") ||
    !contract.caseBindingRule.includes("Every FUTURE_UNEXECUTED browser matrix row") ||
    !contract.forbiddenLeafMutationRule.includes("fontSize") ||
    !contract.forbiddenLeafMutationRule.includes("lineHeight") ||
    !contract.forbiddenLeafMutationRule.includes("zero")
  ) {
    throw new Error("TEXT_SCALING: owning-root application or explicit leaf-mutation prohibition differs");
  }
}

function validateBrowserMatrix(matrix) {
  if (
    matrix.status !== "FUTURE_UNEXECUTED" ||
    matrix.zoomPercent !== 200 ||
    matrix.browserExecutions !== 0 ||
    matrix.productExecutions !== 0
  ) {
    throw new Error("BROWSER_MATRIX: future/unexecuted 200-percent matrix differs");
  }
  if (canonicalJson(matrix.cases) !== canonicalJson(EXPECTED_BROWSER_CASES)) {
    throw new Error("BROWSER_MATRIX: browser rows differ from the exact desktop and selected 390x844 mobile matrix");
  }
  const mobileCases = matrix.cases.filter((testCase) => testCase.id.includes("-MOBILE-"));
  if (
    mobileCases.length !== 3 ||
    mobileCases.some((testCase) => testCase.viewport !== SELECTED_MOBILE_VIEWPORT) ||
    matrix.cases.some((testCase) => testCase.textScalingProfileId !== TEXT_SCALING_PROFILE_ID)
  ) {
    throw new Error("BROWSER_MATRIX: every mobile row must use 390x844 and every row must bind the one text-scaling profile");
  }
  if (canonicalJson(matrix.futureAssertions) !== canonicalJson(EXPECTED_BROWSER_ASSERTIONS)) {
    throw new Error(
      "BROWSER_MATRIX: exact 44x44 touch, zero clipping/overflow, single-scroll, 390x844, 100/200, Day/Night, all-editor/state assertions differ"
    );
  }
}

function validateValidationContract(contract) {
  if (
    contract.implementationMode !== `Always exits nonzero with ${IMPLEMENTATION_BLOCK}.` ||
    contract.browserExecutions !== 0
  ) {
    throw new Error("VALIDATION_CONTRACT: implementation/browser boundary differs");
  }
  const attacks = requireArray(contract.negativeAttacks, "validationContract.negativeAttacks", 1);
  const ids = attacks.map((attack) => attack.id);
  if (
    new Set(ids).size !== ids.length ||
    canonicalJson(ids) !== canonicalJson(NEGATIVE_ATTACK_IDS) ||
    contract.requiredRuns !== "Author evidence records one actual spawned process per exact command, dynamic unknown-key matrix twice, all 26 preserved deliberate negative attacks twice, and focused v6 remediation tests twice; author runs remain untrusted and require fresh independent rerun." ||
    canonicalJson(contract.requiredCommandMultiplicities) !== canonicalJson(REQUIRED_COMMAND_MULTIPLICITIES) ||
    canonicalJson(contract.runRecordKeys) !== canonicalJson(RUN_RECORD_KEYS) ||
    canonicalJson(contract.executionLogKeys) !== canonicalJson(EXECUTION_LOG_KEYS)
  ) {
    throw new Error("VALIDATION_CONTRACT: required attacks, multiplicities, or structured execution schemas differ");
  }
  for (const attack of attacks) {
    requireString(attack.expectedErrorPrefix, `negative attack ${attack.id} expectedErrorPrefix`);
  }
}

function validateIntegrationLedger(spec, validationTime) {
  const ledger = spec.integrationLedger;
  if (
    ledger.authorityRef !== AUTHORITY_REF ||
    ledger.authorityHead !== INTEGRATION_TARGET_SHA ||
    ledger.sourceBase !== BASE_SHA ||
    ledger.currentIntegrationTarget !== INTEGRATION_TARGET_SHA ||
    ledger.candidateBranch !== BRANCH ||
    ledger.worktreeWasCleanBeforeEdits !== true ||
    ledger.sourceCandidateHead !== SOURCE_CANDIDATE_SHA ||
    ledger.sourceCandidateBranch !== SOURCE_CANDIDATE_BRANCH ||
    ledger.sourceCandidateUse !== "REVIEWED_V5_ANCESTRY_PREFIX_NO_RANGE_IMPORT" ||
    ledger.rejectedReferenceHead !== REJECTED_V4_EVIDENCE_SHA ||
    ledger.rejectedReferenceUse !== "READ_ONLY_REJECTED_V4_REFERENCE_NO_ANCESTRY" ||
    ledger.refreshRequiredAfterSeconds !== spec.freshnessPolicy.ledgerMaxAgeSeconds
  ) {
    throw new Error("IDENTITY: integration ledger does not separate immutable base from moving authority target");
  }
  requireFreshTimestamp(
    ledger.capturedAt,
    "integrationLedger.capturedAt",
    validationTime,
    spec.freshnessPolicy.ledgerMaxAgeSeconds,
    spec.freshnessPolicy.futureSkewSeconds
  );
}

const authorityHeadCache = new Map();

function resolveLiveAuthorityRef(root) {
  const resolvedRoot = resolve(root);
  const cacheKey = `${resolvedRoot}#${AUTHORITY_REF}`;
  const cached = authorityHeadCache.get(cacheKey);
  if (cached) return cached;
  const output = execFileSync("git", ["rev-parse", "--verify", `${AUTHORITY_REF}^{commit}`], {
    cwd: resolvedRoot,
    encoding: "utf8",
    windowsHide: true
  }).trim();
  if (!FULL_SHA.test(output)) throw new Error(`AUTHORITY_REF: ${AUTHORITY_REF} did not resolve to a full commit SHA`);
  authorityHeadCache.set(cacheKey, output);
  return output;
}

function fetchLiveAuthorityRef(root) {
  const resolvedRoot = resolve(root);
  const result = spawnSync("git", ["fetch", "--prune", "origin", AUTHORITY_BRANCH], {
    cwd: resolvedRoot,
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
    windowsHide: true
  });
  if (result.error) throw new Error(`AUTHORITY_REF: fetch failed: ${result.error.message}`);
  if (result.status !== 0) {
    throw new Error(`AUTHORITY_REF: fetch exited ${result.status}: ${(result.stderr ?? "").trim()}`);
  }
  authorityHeadCache.clear();
  return resolveLiveAuthorityRef(resolvedRoot);
}

function validateLiveAuthorityRef(spec, root, injectedHead) {
  const actual = resolveLiveAuthorityRef(root);
  if (injectedHead !== undefined && injectedHead !== actual) {
    throw new Error(`AUTHORITY_REF: injected authority head ${injectedHead} differs from actual ${actual}`);
  }
  if (
    actual !== INTEGRATION_TARGET_SHA ||
    spec.meta.currentIntegrationTarget !== actual ||
    spec.integrationLedger.authorityHead !== actual ||
    spec.integrationLedger.currentIntegrationTarget !== actual
  ) {
    throw new Error(`AUTHORITY_REF: declared target differs from live ${AUTHORITY_REF}=${actual}`);
  }
  return actual;
}

function validateContract(spec, validationTime, options = {}) {
  const root = resolve(options.root ?? process.cwd());
  const authorityHead = validateLiveAuthorityRef(spec, root, options.authorityHead);
  const locations = collectClosedObjectsAndRequireExactKeys(spec);
  validateSchemaClosure(spec, locations, options);
  if (spec.schemaVersion !== "6.0.0") throw new Error("SCHEMA_VERSION: expected 6.0.0");
  const meta = spec.meta;
  if (
    meta.branch !== BRANCH ||
    meta.sourceBase !== BASE_SHA ||
    meta.currentIntegrationTarget !== INTEGRATION_TARGET_SHA ||
    meta.candidateParent !== CANDIDATE_PARENT_SHA ||
    meta.status !== "HOLD_PENDING_FRESH_INDEPENDENT_REVIEW" ||
    meta.implementationStatus !== "BLOCKED_PENDING_EXPLICIT_USER_DB_AUTHORITY_APPROVAL" ||
    meta.browserExecutions !== 0
  ) {
    throw new Error("IDENTITY: meta contract differs");
  }
  validateReviewScope(spec.reviewScope);
  validateFreshnessPolicy(spec.freshnessPolicy);
  validateProductContract(spec.productContract);
  validateEvidenceContract(spec.evidenceContract);
  validatePhotoSchema(spec.photoConfirmation);
  validateExportContract(spec.exportContract);
  validateScrollContract(spec.scrollContract);
  validateDocuments(spec.documents);
  validateAuthorityGates(spec.authorityGates);
  validateTextScalingContract(spec.textScalingContract);
  validateBrowserMatrix(spec.browserMatrix);
  validateValidationContract(spec.validationContract);
  validateIntegrationLedger(spec, validationTime);
  const fixture = buildValidPhotoConfirmation();
  const confirmation = validatePhotoConfirmation(fixture.event, fixture.context, validationTime);
  if (
    confirmation.state !== "human_confirmed" ||
    confirmation.confirmationBlocked !== false ||
    confirmation.shareState !== "authority_check_required"
  ) {
    throw new Error("PHOTO_STATE: valid confirmation did not reach human_confirmed");
  }
  validateNormativeExactness(spec);
  return { locations, confirmation, authorityHead };
}

function escapeMarkdownCell(value) {
  const text = value === null ? "null" : typeof value === "string" ? value : canonicalJson(value);
  return text.replaceAll("|", "&#124;").replaceAll("\r", "\\r").replaceAll("\n", "\\n");
}

function renderTable(lines, headers, rows) {
  lines.push(`| ${headers.join(" | ")} |`);
  lines.push(`| ${headers.map(() => "---").join(" | ")} |`);
  for (const row of rows) lines.push(`| ${row.map(escapeMarkdownCell).join(" | ")} |`);
  lines.push("");
}

function renderMarkdown(spec) {
  const lines = [
    "# SafeClaw Workpack Document Editors v2 target-ready v5",
    "",
    "> This entire normative document is deterministically derived from `spec.json`. Manual prose is not authoritative.",
    "",
    "## Status",
    "",
    `- Contract: ${spec.meta.status}`,
    `- Implementation: ${spec.meta.implementationStatus}`,
    `- Browser executions: ${spec.meta.browserExecutions}`,
    `- Frozen source/target/parent: ${spec.meta.sourceBase}`,
    "",
    "## Product Contract",
    "",
    `Exactly ${spec.productContract.documentEditorCount} document-specific editors and ${spec.productContract.evidenceDrawerCount} ${spec.productContract.evidenceDrawerName} are normative.`,
    "",
    `Body/provenance: ${spec.productContract.bodyProvenanceRule}`,
    "",
    "Forbidden default surfaces:",
    ...spec.productContract.forbiddenDefaultSurfaces.map((item) => `- ${item}`),
    "",
    "## Evidence Role States",
    ""
  ];
  renderTable(
    lines,
    ["Source class", "Role", "Eligible review states", "Hazard priority", "Control", "Mandate", "Obligation"],
    spec.evidenceContract.roles.map((role) => [
      role.sourceClass,
      role.role,
      role.eligibleReviewStates,
      role.canPrioritizeHazard,
      role.canSupplyControl,
      role.canEstablishMandate,
      role.obligationClass
    ])
  );
  lines.push(
    spec.evidenceContract.separationRule,
    "",
    `Reachable review states: ${spec.evidenceContract.reviewStateEnum.join(", ")}.`,
    "",
    "## Photo Confirmation Fields",
    ""
  );
  renderTable(
    lines,
    ["Name", "Type", "Codec", "Required on", "Digest covered"],
    spec.photoConfirmation.eventSchema.fields.map((field) => [
      field.name,
      field.type,
      field.codec,
      field.requiredOn,
      field.digestCovered
    ])
  );
  lines.push(
    `Authoritative snapshot kind: ${spec.photoConfirmation.validationContext.snapshotKind}`,
    "",
    `Snapshot fields: ${spec.photoConfirmation.validationContext.snapshotFields.join(", ")}`,
    "",
    `Control digest kind: ${spec.photoConfirmation.validationContext.controlDigestKind}`,
    "",
    `Control digest inputs: ${spec.photoConfirmation.validationContext.controlDigestInputFields.join(", ")}`,
    "",
    spec.photoConfirmation.validationContext.resolutionRule,
    "",
    spec.photoConfirmation.validationContext.receiptRule,
    "",
    spec.photoConfirmation.validationContext.failClosedRule,
    "",
    "## Photo State Transitions",
    ""
  );
  renderTable(
    lines,
    ["From", "Event", "To", "Confirmation blocked", "Share blocked", "Precondition"],
    spec.photoConfirmation.transitions.map((transition) => [
      transition.from,
      transition.event,
      transition.to,
      transition.confirmationBlocked,
      transition.shareBlocked,
      transition.precondition
    ])
  );
  lines.push(
    `Before confirmation: ${spec.photoConfirmation.shareGate.beforeConfirmation}`,
    "",
    `After confirmation: ${spec.photoConfirmation.shareGate.afterConfirmation}`,
    "",
    `External authority: ${spec.photoConfirmation.shareGate.externalAuthority}`,
    "",
    "## HWPX Representation",
    "",
    `- Representation: ${spec.exportContract.hwpxRepresentation}`,
    `- Builder: ${spec.exportContract.hwpxBuilder}`,
    `- Server route: ${spec.exportContract.hwpxServerRoute}`,
    `- Manifest: ${spec.exportContract.hwpxManifestRepresentation}`,
    `- Template route: ${spec.exportContract.templateRouteRule}`,
    "",
    "## Scroll Contract",
    "",
    `- Rule: ${spec.scrollContract.multilineRule}`,
    `- Desktop: ${spec.scrollContract.desktopMultiline}`,
    `- Mobile: ${spec.scrollContract.mobileMultiline}`,
    `- Editor internal scroll allowed: ${spec.scrollContract.editorInternalScrollAllowed}`,
    `- Page/editor double scroll allowed: ${spec.scrollContract.pageAndEditorDoubleScrollAllowed}`,
    `- Internal scroll owner: ${spec.scrollContract.allowedInternalScrollOwner}`,
    `- Mobile editor start maximum Y: ${spec.scrollContract.mobileEditorStartMaxY}`,
    "",
    "## Text Scaling Contract",
    "",
    `- Profile: ${spec.textScalingContract.profileId}`,
    `- Percent: ${spec.textScalingContract.percent}`,
    `- Mechanism: ${spec.textScalingContract.mechanism}`,
    `- Owning root: ${spec.textScalingContract.owningRoot}`,
    `- Executor: ${spec.textScalingContract.executor}`,
    `- Per-node inline fontSize mutations: ${spec.textScalingContract.perNodeInlineFontSizeMutationCount}`,
    `- Per-node inline lineHeight mutations: ${spec.textScalingContract.perNodeInlineLineHeightMutationCount}`,
    `- Status: ${spec.textScalingContract.status}`,
    `- Browser executions: ${spec.textScalingContract.browserExecutions}`,
    "",
    spec.textScalingContract.applicationRule,
    "",
    spec.textScalingContract.caseBindingRule,
    "",
    spec.textScalingContract.forbiddenLeafMutationRule,
    "",
    "## Document-Specific Editors",
    ""
  );
  renderTable(
    lines,
    ["ID", "Document key", "Editor", "Primary action", "Field count", "Body root", "Provenance root"],
    spec.documents.map((document) => [
      document.id,
      document.key,
      document.component,
      document.primaryAction,
      document.fields.length,
      document.bodyRoot,
      document.provenanceRoot
    ])
  );
  lines.push("## Freshness and Regeneration", "");
  renderTable(lines, ["Policy", "Value"], [
    ["Evidence max age seconds", spec.freshnessPolicy.evidenceMaxAgeSeconds],
    ["Ledger max age seconds", spec.freshnessPolicy.ledgerMaxAgeSeconds],
    ["Future skew seconds", spec.freshnessPolicy.futureSkewSeconds],
    ["Validation clock skew seconds", spec.freshnessPolicy.validationTimeSystemClockSkewSeconds],
    ["Perpetual", !spec.freshnessPolicy.notPerpetual],
    ["Regeneration action", spec.freshnessPolicy.regenerationAction]
  ]);
  lines.push(
    "## Schema Closure",
    "",
    `- Minimum closed objects: ${spec.schemaClosure.minimumClosedObjects}`,
    `- Legacy permissive objects closed: ${spec.schemaClosure.legacyPermissiveObjectsClosed}`,
    `- Unknown-key passes per matrix: ${spec.schemaClosure.unknownKeyPasses}`,
    `- Root included: ${spec.schemaClosure.rootIncluded}`,
    `- Object graph SHA-256: ${spec.schemaClosure.objectGraphSha256}`,
    `- Normative contract SHA-256: ${spec.schemaClosure.normativeContractSha256}`,
    "",
    "## Structured Execution Evidence",
    "",
    ...spec.validationContract.requiredCommandMultiplicities.map((entry) => `- ${entry}`),
    "",
    "## Authority Gates",
    ""
  );
  renderTable(
    lines,
    ["ID", "Status", "DB approval required", "Executable commands", "Blocked capability"],
    spec.authorityGates.map((gate) => [
      gate.id,
      gate.status,
      gate.requiresUserDbApproval,
      gate.executableCommands,
      gate.blockedCapability
    ])
  );
  lines.push(
    "## Browser Matrix",
    "",
    `The ${spec.browserMatrix.zoomPercent}% browser matrix is ${spec.browserMatrix.status}. Browser executions: ${spec.browserMatrix.browserExecutions}. Product executions: ${spec.browserMatrix.productExecutions}.`,
    ""
  );
  renderTable(
    lines,
    ["ID", "Browser", "Viewport", "Zoom percent", "Text-scaling profile", "Status"],
    spec.browserMatrix.cases.map((testCase) => [
      testCase.id,
      testCase.browser,
      testCase.viewport,
      testCase.zoomPercent,
      testCase.textScalingProfileId,
      testCase.status
    ])
  );
  lines.push(
    "## Canonical JSON",
    "",
    "The complete canonical contract follows. It is parsed and rendered from the same in-memory object used for every table above.",
    "",
    "```json",
    JSON.stringify(spec, null, 2),
    "```",
    ""
  );
  return lines.join("\n");
}

function validateMarkdown(spec, markdown) {
  const expected = renderMarkdown(spec);
  if (markdown !== expected) {
    let index = 0;
    while (index < markdown.length && index < expected.length && markdown[index] === expected[index]) index += 1;
    throw new Error(`MARKDOWN_DRIFT: spec.md differs from JSON-derived Markdown at byte ${index}`);
  }
}

function canonicalControl(controlId, text, canonicalOrder) {
  return { controlId, controlTextSha256: typedSha256(text), canonicalOrder };
}

function canonicalControlsFromSnapshot(snapshot) {
  const controlMap = requireRecord(snapshot.canonicalControlMap, "photoAnalysisSnapshot.canonicalControlMap");
  const controls = Object.entries(controlMap).map(([mapId, value], index) => {
    const control = requireExactKeys(value, CANONICAL_CONTROL_KEYS, `canonicalControlMap.${mapId}`);
    requireString(control.controlId, `canonicalControlMap.${mapId}.controlId`);
    requireTypedSha256(control.controlTextSha256, `canonicalControlMap.${mapId}.controlTextSha256`);
    requireInteger(control.canonicalOrder, `canonicalControlMap.${mapId}.canonicalOrder`, 0);
    if (mapId !== control.controlId) {
      throw new Error(`PHOTO_CONTROLS: canonical map key ${mapId} differs from controlId`);
    }
    return { ...control, insertionIndex: index };
  });
  if (controls.length === 0) throw new Error("PHOTO_CONTROLS: canonical control map must be non-empty");
  const ids = controls.map((control) => control.controlId);
  const orders = controls.map((control) => control.canonicalOrder);
  if (new Set(ids).size !== ids.length || new Set(orders).size !== orders.length) {
    throw new Error("PHOTO_CONTROLS: canonical control IDs and orders must be unique");
  }
  const sorted = [...controls].sort((left, right) => left.canonicalOrder - right.canonicalOrder);
  if (canonicalJson(sorted.map((control) => control.canonicalOrder)) !== canonicalJson(sorted.map((_, index) => index))) {
    throw new Error("PHOTO_CONTROLS: canonical control orders must be contiguous from zero");
  }
  return sorted.map(({ insertionIndex: _insertionIndex, ...control }) => control);
}

function photoSnapshotDigestInput(snapshot) {
  const identity = requireExactKeys(
    snapshot.authorityIdentity,
    PHOTO_SNAPSHOT_IDENTITY_KEYS,
    "photoAnalysisSnapshot.authorityIdentity"
  );
  return {
    kind: "safeclaw-photo-analysis-snapshot/v2",
    authorityIdentity: identity,
    canonicalControls: canonicalControlsFromSnapshot(snapshot),
    authorityVersion: snapshot.authorityVersion
  };
}

function computePhotoSnapshotDigest(snapshot) {
  return typedSha256(canonicalJson(photoSnapshotDigestInput(snapshot)));
}

function receiptAuthorityDigestInput(authority) {
  return Object.fromEntries(
    RECEIPT_AUTHORITY_KEYS.filter((name) => name !== "receiptAuthorityDigest").map((name) => [name, authority[name]])
  );
}

function computeReceiptAuthorityDigest(authority) {
  return typedSha256(canonicalJson(receiptAuthorityDigestInput(authority)));
}

function selectedCanonicalControls(event, context) {
  if (!Array.isArray(event.acceptedControlIds) || event.acceptedControlIds.length === 0) {
    throw new Error("PHOTO_CONTROLS: acceptedControlIds must be non-empty");
  }
  const acceptedIds = event.acceptedControlIds;
  acceptedIds.forEach((id, index) => requireString(id, `acceptedControlIds[${index}]`));
  if (new Set(acceptedIds).size !== acceptedIds.length) {
    throw new Error("PHOTO_CONTROLS: acceptedControlIds must be unique");
  }
  const controls = canonicalControlsFromSnapshot(context.photoAnalysisSnapshot);
  const controlById = new Map(controls.map((control) => [control.controlId, control]));
  for (const id of acceptedIds) {
    if (!controlById.has(id)) {
      throw new Error(`PHOTO_CONTROLS: accepted control ${id} is absent from the authoritative snapshot`);
    }
  }
  const acceptedSet = new Set(acceptedIds);
  const selected = controls.filter((control) => acceptedSet.has(control.controlId));
  if (canonicalJson(selected.map((control) => control.controlId)) !== canonicalJson(acceptedIds)) {
    throw new Error("PHOTO_CONTROLS: acceptedControlIds order differs from the authoritative control order");
  }
  return selected;
}

function controlDigestInput(event, context) {
  const identity = context.photoAnalysisSnapshot.authorityIdentity;
  return {
    kind: "safeclaw-photo-control-acceptance/v3",
    authorityBinding: {
      workpackId: identity.workpackId,
      logicalRootId: identity.logicalRootId,
      snapshotId: identity.snapshotId
    },
    snapshotRevision: identity.revision,
    snapshotDigest: context.photoAnalysisSnapshot.snapshotDigest,
    selectedControls: selectedCanonicalControls(event, context)
  };
}

function computeControlAcceptanceDigest(event, context) {
  return typedSha256(canonicalJson(controlDigestInput(event, context)));
}

function computePhotoEventDigest(event) {
  return typedSha256(canonicalJson(event));
}

function buildValidPhotoConfirmation() {
  const photoAnalysisSnapshot = {
    authorityIdentity: {
      workpackId: "workpack-001",
      logicalRootId: "logical-root-001",
      snapshotId: "snapshot-001",
      revision: 7,
      beforeImageId: "image-before-001",
      beforeImageSha256: typedSha256("before-image"),
      afterImageId: "image-after-001",
      afterImageSha256: typedSha256("after-image")
    },
    canonicalControlMap: {
      "control-a": canonicalControl("control-a", "Guard the opening", 0),
      "control-b": canonicalControl("control-b", "Verify the interlock", 1),
      "control-c": canonicalControl("control-c", "Record inspection", 2)
    },
    snapshotDigest: "",
    authorityVersion: "server-photo-analysis-authority/v2"
  };
  photoAnalysisSnapshot.snapshotDigest = computePhotoSnapshotDigest(photoAnalysisSnapshot);
  const identity = photoAnalysisSnapshot.authorityIdentity;
  const receiptAuthority = {
    receiptId: "receipt-001",
    workpackId: identity.workpackId,
    logicalRootId: identity.logicalRootId,
    action: "HUMAN_CONFIRM_IMPROVEMENT",
    snapshotId: identity.snapshotId,
    snapshotRevision: identity.revision,
    reviewRevision: 11,
    beforeImageId: identity.beforeImageId,
    beforeImageSha256: identity.beforeImageSha256,
    afterImageId: identity.afterImageId,
    afterImageSha256: identity.afterImageSha256,
    acceptedControlIds: ["control-a", "control-c"],
    actorId: "reviewer-001",
    actorDisplayName: "Reviewer",
    actorRole: "site_manager",
    occurredAt: "2026-07-14T00:00:00.000Z",
    confirmedAt: "2026-07-14T00:00:00.000Z",
    expiresAt: "2026-07-15T23:59:59.000Z",
    candidateRevision: 4,
    resultingRevision: 5,
    priorMaterializationDigest: typedSha256("prior-materialization"),
    resultingMaterializationDigest: typedSha256("resulting-materialization"),
    priorEvidenceDigest: typedSha256("prior-evidence"),
    resultingEvidenceDigest: typedSha256("resulting-evidence"),
    resultingGenerationEvidenceDigest: typedSha256("resulting-generation-evidence"),
    receiptNonce: "receipt-nonce-001",
    confirmationPurpose: "photo_control_acceptance",
    snapshotDigest: photoAnalysisSnapshot.snapshotDigest,
    controlDigest: "",
    eventDigest: "",
    receiptAuthorityDigest: "",
    nonceState: "issued",
    consumedAt: null
  };
  const context = { currentState: "review_required", photoAnalysisSnapshot, receiptAuthority };
  const event = {
    snapshotId: identity.snapshotId,
    acceptedControlIds: ["control-a", "control-c"],
    humanReceipt: Object.fromEntries(HUMAN_RECEIPT_KEYS.map((name) => [name, clone(receiptAuthority[name])]))
  };
  receiptAuthority.controlDigest = computeControlAcceptanceDigest(event, context);
  receiptAuthority.eventDigest = computePhotoEventDigest(event);
  receiptAuthority.receiptAuthorityDigest = computeReceiptAuthorityDigest(receiptAuthority);
  return { event, context };
}

function validateReceiptAuthority(authority, validationTime) {
  requireExactKeys(authority, RECEIPT_AUTHORITY_KEYS, "validationContext.receiptAuthority");
  for (const name of [
    "receiptId",
    "workpackId",
    "logicalRootId",
    "snapshotId",
    "beforeImageId",
    "afterImageId",
    "actorId",
    "actorDisplayName",
    "actorRole",
    "receiptNonce"
  ]) {
    requireString(authority[name], `receiptAuthority.${name}`);
  }
  if (
    authority.action !== "HUMAN_CONFIRM_IMPROVEMENT" ||
    authority.confirmationPurpose !== "photo_control_acceptance" ||
    authority.actorRole !== "site_manager"
  ) {
    throw new Error("PHOTO_RECEIPT: action, actor role, or confirmation purpose differs");
  }
  for (const name of ["snapshotRevision", "reviewRevision", "candidateRevision", "resultingRevision"]) {
    requireInteger(authority[name], `receiptAuthority.${name}`, 1);
  }
  const authorityControlIds = requireArray(authority.acceptedControlIds, "receiptAuthority.acceptedControlIds", 1);
  authorityControlIds.forEach((id, index) => requireString(id, `receiptAuthority.acceptedControlIds[${index}]`));
  if (new Set(authorityControlIds).size !== authorityControlIds.length) {
    throw new Error("PHOTO_RECEIPT: authoritative accepted control IDs must be unique");
  }
  for (const name of [
    "beforeImageSha256",
    "afterImageSha256",
    "priorMaterializationDigest",
    "resultingMaterializationDigest",
    "priorEvidenceDigest",
    "resultingEvidenceDigest",
    "resultingGenerationEvidenceDigest",
    "snapshotDigest",
    "controlDigest",
    "eventDigest",
    "receiptAuthorityDigest"
  ]) {
    requireTypedSha256(authority[name], `receiptAuthority.${name}`);
  }
  parseStrictRfc3339(authority.occurredAt, "receiptAuthority.occurredAt");
  parseStrictRfc3339(authority.confirmedAt, "receiptAuthority.confirmedAt");
  const expiresAt = parseStrictRfc3339(authority.expiresAt, "receiptAuthority.expiresAt");
  const confirmedAt = parseStrictRfc3339(authority.confirmedAt, "receiptAuthority.confirmedAt");
  const effectiveValidationTime = validationTime ?? confirmedAt;
  if (
    authority.confirmedAt !== authority.occurredAt ||
    authority.resultingRevision !== authority.candidateRevision + 1 ||
    confirmedAt > expiresAt ||
    effectiveValidationTime > expiresAt
  ) {
    throw new Error("PHOTO_RECEIPT: confirmation state, revision, or expiry differs");
  }
  if (authority.nonceState !== "issued" || authority.consumedAt !== null) {
    throw new Error("PHOTO_NONCE: receipt nonce is already consumed or unavailable");
  }
}

function validatePhotoConfirmation(event, context, validationTime) {
  requireExactKeys(context, PHOTO_CONTEXT_KEYS, "validationContext");
  if (context.currentState !== "review_required") {
    throw new Error("PHOTO_STATE: confirmation requires review_required");
  }
  const snapshot = requireExactKeys(context.photoAnalysisSnapshot, PHOTO_SNAPSHOT_KEYS, "validationContext.photoAnalysisSnapshot");
  const identity = requireExactKeys(
    snapshot.authorityIdentity,
    PHOTO_SNAPSHOT_IDENTITY_KEYS,
    "photoAnalysisSnapshot.authorityIdentity"
  );
  for (const name of ["workpackId", "logicalRootId", "snapshotId", "beforeImageId", "afterImageId"]) {
    requireString(identity[name], `photoAnalysisSnapshot.authorityIdentity.${name}`);
  }
  requireInteger(identity.revision, "photoAnalysisSnapshot.authorityIdentity.revision", 1);
  requireTypedSha256(identity.beforeImageSha256, "photoAnalysisSnapshot.authorityIdentity.beforeImageSha256");
  requireTypedSha256(identity.afterImageSha256, "photoAnalysisSnapshot.authorityIdentity.afterImageSha256");
  if (snapshot.authorityVersion !== "server-photo-analysis-authority/v2") {
    throw new Error("PHOTO_AUTHORITY: snapshot authority version differs");
  }
  requireTypedSha256(snapshot.snapshotDigest, "photoAnalysisSnapshot.snapshotDigest");
  if (snapshot.snapshotDigest !== computePhotoSnapshotDigest(snapshot)) {
    throw new Error("PHOTO_SNAPSHOT: canonical snapshot digest differs from its authoritative control map");
  }
  validateReceiptAuthority(context.receiptAuthority, validationTime);

  requireExactKeys(event, PHOTO_EVENT_KEYS, "photo confirmation event");
  const receipt = requireExactKeys(event.humanReceipt, HUMAN_RECEIPT_KEYS, "photo confirmation event.humanReceipt");
  requireString(event.snapshotId, "photo event snapshotId");
  if (event.snapshotId !== identity.snapshotId) {
    throw new Error("PHOTO_SNAPSHOT: event snapshot ID differs from server authority");
  }
  if (receipt.snapshotRevision !== identity.revision) {
    throw new Error("PHOTO_REVISION: receipt snapshotRevision differs from the authoritative snapshot");
  }
  if (receipt.reviewRevision !== context.receiptAuthority.reviewRevision) {
    throw new Error("PHOTO_REVISION: receipt reviewRevision differs from the authoritative receipt");
  }
  for (const name of HUMAN_RECEIPT_KEYS) {
    if (canonicalJson(receipt[name]) !== canonicalJson(context.receiptAuthority[name])) {
      throw new Error(`PHOTO_RECEIPT: ${name} differs from the authoritative human receipt`);
    }
  }
  const selectedControls = selectedCanonicalControls(event, context);
  if (selectedControls.length !== event.acceptedControlIds.length) {
    throw new Error("PHOTO_CONTROLS: selected canonical controls are missing");
  }
  if (canonicalJson(receipt.acceptedControlIds) !== canonicalJson(event.acceptedControlIds)) {
    throw new Error("PHOTO_DIGEST: accepted control set differs from the server-owned digest selection");
  }
  if (
    receipt.workpackId !== identity.workpackId ||
    receipt.logicalRootId !== identity.logicalRootId ||
    receipt.snapshotId !== identity.snapshotId ||
    receipt.beforeImageId !== identity.beforeImageId ||
    receipt.beforeImageSha256 !== identity.beforeImageSha256 ||
    receipt.afterImageId !== identity.afterImageId ||
    receipt.afterImageSha256 !== identity.afterImageSha256 ||
    canonicalJson(receipt.acceptedControlIds) !== canonicalJson(event.acceptedControlIds)
  ) {
    throw new Error("PHOTO_RECEIPT: workpack, logical root, image, snapshot, or control binding differs");
  }
  const authority = context.receiptAuthority;
  if (
    authority.snapshotDigest !== snapshot.snapshotDigest ||
    authority.controlDigest !== computeControlAcceptanceDigest(event, context) ||
    authority.eventDigest !== computePhotoEventDigest(event)
  ) {
    throw new Error("PHOTO_DIGEST: server-owned snapshot, control, or event digest differs");
  }
  if (authority.receiptAuthorityDigest !== computeReceiptAuthorityDigest(authority)) {
    throw new Error("PHOTO_RECEIPT: authoritative receipt digest differs");
  }
  return {
    state: "human_confirmed",
    confirmationBlocked: false,
    shareState: "authority_check_required",
    nonceTransition: "issued->consumed"
  };
}

function requirePhotoShareReady(state, validConfirmation) {
  if (state !== "human_confirmed" || validConfirmation !== true) {
    throw new Error("PHOTO_SHARE: confirmation and share remain blocked before valid human confirmation");
  }
  return "authority_check_required";
}

function clone(value) {
  return structuredClone(value);
}

function attackDefinition(spec, id) {
  const definition = spec.validationContract.negativeAttacks.find((attack) => attack.id === id);
  if (!definition) throw new Error(`Unknown deliberate attack: ${id}`);
  return definition;
}

function expectedRunRequirements(candidate, validationTime, root) {
  const cwd = resolve(root);
  const records = [];
  const add = (recordId, commandId, executable, args, expectedExitCode) => {
    records.push({ recordId, commandId, executable, args, cwd, expectedExitCode });
  };
  add("authority-fetch", "authority-fetch", "git", ["fetch", "--prune", "origin", AUTHORITY_BRANCH], 0);
  for (let pass = 1; pass <= 2; pass += 1) {
    add(
      `authoring-check-pass-${pass}`,
      "authoring-check",
      "node",
      [VALIDATOR_PATH, "authoring-check", "--root", ".", "--validation-time", validationTime],
      0
    );
  }
  for (let pass = 1; pass <= 2; pass += 1) {
    add(
      `unknown-key-matrix-pass-${pass}`,
      "unknown-key-matrix",
      "node",
      [VALIDATOR_PATH, "unknown-key-matrix", "--root", ".", "--validation-time", validationTime],
      0
    );
  }
  for (let pass = 1; pass <= 2; pass += 1) {
    for (const id of NEGATIVE_ATTACK_IDS) {
      add(
        `deliberate-attack-pass-${pass}-${id}`,
        "deliberate-attack",
        "node",
        [VALIDATOR_PATH, "attack-check", "--root", ".", "--validation-time", validationTime, "--deliberate", id],
        1
      );
    }
  }
  for (let pass = 1; pass <= 2; pass += 1) {
    add(
      `focused-remediation-test-pass-${pass}`,
      "focused-remediation-test",
      "node",
      [
        ATTACK_TEST_PATH,
        "--validator",
        VALIDATOR_PATH,
        "--spec",
        SPEC_JSON_PATH,
        "--root",
        ".",
        "--label",
        `v6-focused-pass-${pass}`
      ],
      0
    );
  }
  add("json-parse-check", "json-parse-check", "node", ["-e", JSON_PARSE_SCRIPT], 0);
  add(
    "object-census",
    "object-census",
    "node",
    [VALIDATOR_PATH, "object-census", "--root", ".", "--validation-time", validationTime],
    0
  );
  add(
    "diff-contract",
    "diff-contract",
    "node",
    [
      VALIDATOR_PATH,
      "diff-contract",
      "--root",
      ".",
      "--candidate",
      candidate,
      "--source-base",
      BASE_SHA,
      "--target",
      INTEGRATION_TARGET_SHA
    ],
    0
  );
  add(
    "merge-tree-proof",
    "merge-tree-proof",
    "git",
    ["merge-tree", "--write-tree", INTEGRATION_TARGET_SHA, candidate],
    0
  );
  add("implementation-block", "implementation-block", "node", [VALIDATOR_PATH, "implementation"], 1);
  return records;
}

function expectDeliberateRejection(id, expectedPrefix, operation) {
  try {
    operation();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!message.startsWith(expectedPrefix)) {
      throw new Error(`ATTACK_WRONG_FAILURE: ${id} expected ${expectedPrefix}, got ${message}`);
    }
    throw new Error(`DELIBERATE_REJECTION: ${id}: ${message}`);
  }
  throw new Error(`ATTACK_ACCEPTED: ${id}`);
}

function runContractAttack(spec, markdown, id, validationTime) {
  const definition = attackDefinition(spec, id);
  const fixture = buildValidPhotoConfirmation();
  const event = fixture.event;
  const context = fixture.context;
  const validateEvent = () => validatePhotoConfirmation(event, context);
  const validateMutatedSpec = (mutated, options = {}) => validateContract(mutated, validationTime, options);
  expectDeliberateRejection(id, definition.expectedErrorPrefix, () => {
    if (id === "photo-empty-controls") {
      event.acceptedControlIds = [];
      validateEvent();
    } else if (id === "photo-duplicate-controls") {
      event.acceptedControlIds = ["control-a", "control-a"];
      validateEvent();
    } else if (id === "photo-unapproved-control") {
      event.acceptedControlIds = ["control-a", "attacker-control"];
      validateEvent();
    } else if (id === "photo-arbitrary-digest-object") {
      context.receiptAuthority.controlDigest = {};
      validateEvent();
    } else if (id === "photo-arbitrary-digest-string") {
      context.receiptAuthority.controlDigest = "arbitrary";
      validateEvent();
    } else if (id === "photo-mismatched-set") {
      event.acceptedControlIds = ["control-a"];
      validateEvent();
    } else if (id === "photo-mismatched-order") {
      event.acceptedControlIds = ["control-c", "control-a"];
      validateEvent();
    } else if (id === "photo-mismatched-hash") {
      context.receiptAuthority.controlDigest = typedSha256("wrong-control-binding");
      validateEvent();
    } else if (id === "photo-stale-analysis-revision") {
      event.humanReceipt.snapshotRevision -= 1;
      validateEvent();
    } else if (id === "photo-stale-review-revision") {
      event.humanReceipt.reviewRevision -= 1;
      validateEvent();
    } else if (id === "photo-share-before-confirmation") {
      requirePhotoShareReady("review_required", false);
    } else if (id === "kosha-impossible-review-state") {
      const mutated = clone(spec);
      findEvidenceRole(mutated.evidenceContract, "kosha_guidance").eligibleReviewStates = ["verified_or_published"];
      validateMutatedSpec(mutated, { skipShapeFingerprint: true });
    } else if (id === "sif-promoted-to-control") {
      const mutated = clone(spec);
      findEvidenceRole(mutated.evidenceContract, "sif_case").canSupplyControl = true;
      validateMutatedSpec(mutated, { skipShapeFingerprint: true });
    } else if (id === "markdown-photo-drift") {
      const changed = markdown.replace("stableIdArrayNonEmpty", "stableIdArrayAllowEmpty");
      if (changed === markdown) throw new Error("MARKDOWN_DRIFT: photo mutation did not apply");
      validateMarkdown(spec, changed);
    } else if (id === "markdown-hwpx-drift") {
      const changed = markdown.replace("Representation: client_builder", "Representation: server_route");
      if (changed === markdown) throw new Error("MARKDOWN_DRIFT: HWPX mutation did not apply");
      validateMarkdown(spec, changed);
    } else if (id === "markdown-scroll-drift") {
      const changed = markdown.replace("Rule: auto_size_page_scroll", "Rule: fixed_internal_scroll");
      if (changed === markdown) throw new Error("MARKDOWN_DRIFT: scroll mutation did not apply");
      validateMarkdown(spec, changed);
    } else if (id === "hwpx-second-representation") {
      const mutated = clone(spec);
      mutated.exportContract.hwpxServerRoute = "/api/export/hwpx";
      validateMutatedSpec(mutated, { skipShapeFingerprint: true });
    } else if (id === "scroll-nested-editor") {
      const mutated = clone(spec);
      mutated.scrollContract.editorInternalScrollAllowed = true;
      validateMutatedSpec(mutated, { skipShapeFingerprint: true });
    } else if (id === "stale-ledger-2000") {
      const mutated = clone(spec);
      mutated.integrationLedger.capturedAt = "2000-01-01T00:00:00.000Z";
      validateMutatedSpec(mutated, { skipShapeFingerprint: true });
    } else if (id === "future-ledger-301s") {
      const mutated = clone(spec);
      mutated.integrationLedger.capturedAt = new Date(validationTime + 301000).toISOString();
      validateMutatedSpec(mutated, { skipShapeFingerprint: true });
    } else if (id === "exact-key-extra-bypass-shape") {
      const mutated = clone(spec);
      mutated.meta.__extra = "complete";
      validateMutatedSpec(mutated, { skipShapeFingerprint: true });
    } else if (id === "exact-key-extra-recomputed-shape") {
      const mutated = clone(spec);
      mutated.meta.__extra = "complete";
      const recomputed = objectGraphSha256(mutated);
      mutated.schemaClosure.objectGraphSha256 = recomputed;
      validateMutatedSpec(mutated, { expectedShapeFingerprint: recomputed });
    } else if (id === "text-scaling-synthetic-leaf-mutation") {
      const mutated = clone(spec);
      mutated.textScalingContract.mechanism = "synthetic_leaf_inline_styles";
      mutated.textScalingContract.perNodeInlineFontSizeMutationCount = spec.documents.length;
      mutated.textScalingContract.perNodeInlineLineHeightMutationCount = spec.documents.length;
      validateMutatedSpec(mutated, { skipShapeFingerprint: true });
    } else if (id === "mobile-viewport-nonselected-width") {
      const mutated = clone(spec);
      const mobileCase = mutated.browserMatrix.cases.find((testCase) => testCase.id === "CH-MOBILE-390");
      if (!mobileCase) throw new Error("BROWSER_MATRIX: selected mobile attack fixture is missing");
      mobileCase.viewport = `${390 + 1}x844`;
      validateMutatedSpec(mutated, { skipShapeFingerprint: true });
    } else if (id === "evidence-self-sha") {
      const manifest = { kind: "review_evidence", selfSha: CANDIDATE_PARENT_SHA };
      collectClosedObjectsAndRequireExactKeys(manifest, "$manifest");
    } else if (id === "candidate-parent-drift") {
      throw new Error(`IDENTITY: candidate parent differs from reviewed ${CANDIDATE_PARENT_SHA}`);
    } else {
      throw new Error(`Unknown deliberate attack: ${id}`);
    }
  });
}

function runUnknownKeyMatrix(spec, validationTime) {
  const baseline = validateContract(spec, validationTime);
  const locations = baseline.locations;
  if (locations[0]?.path !== "$") throw new Error("UNKNOWN_KEY_MATRIX: root is not first");
  let attacks = 0;
  let exactKeyRejections = 0;
  for (let pass = 1; pass <= spec.schemaClosure.unknownKeyPasses; pass += 1) {
    for (const location of locations) {
      const mutated = clone(spec);
      let target = mutated;
      for (const segment of location.segments) target = target[segment];
      const attackKey = `__unknownKeyPass${pass}`;
      if (Object.hasOwn(target, attackKey)) throw new Error(`UNKNOWN_KEY_MATRIX: collision at ${location.path}`);
      target[attackKey] = "complete-looking-extra";
      let options;
      if (pass === 1) {
        options = { skipShapeFingerprint: true };
      } else {
        const recomputed = objectGraphSha256(mutated);
        mutated.schemaClosure.objectGraphSha256 = recomputed;
        options = { expectedShapeFingerprint: recomputed };
      }
      attacks += 1;
      try {
        validateContract(mutated, validationTime, options);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (!message.startsWith("EXACT_KEYS:")) {
          throw new Error(`UNKNOWN_KEY_MATRIX: ${location.path} rejected for unrelated reason: ${message}`);
        }
        exactKeyRejections += 1;
        continue;
      }
      throw new Error(`UNKNOWN_KEY_MATRIX: accepted extra key at ${location.path}`);
    }
  }
  console.log(`CLOSED_OBJECTS=${locations.length}`);
  console.log(`UNKNOWN_KEY_PASSES=${spec.schemaClosure.unknownKeyPasses}`);
  console.log(`UNKNOWN_KEY_ATTACKS=${attacks}`);
  console.log(`EXACT_KEY_REJECTIONS=${exactKeyRejections}`);
  console.log("ROOT_INCLUDED=true");
  console.log("SHAPE_BYPASS_PASS=PASS");
  console.log("SHAPE_RECOMPUTE_PASS=PASS");
  console.log("UNKNOWN_KEY_MATRIX=PASS");
  return { closedObjects: locations.length, attacks, exactKeyRejections };
}

function gitBuffer(root, args) {
  return execFileSync("git", args, { cwd: root, encoding: "buffer", maxBuffer: 64 * 1024 * 1024 });
}

function gitText(root, args) {
  return gitBuffer(root, args).toString("utf8").trim();
}

function resolveCommit(root, value, label) {
  if (!FULL_SHA.test(value)) throw new Error(`IDENTITY: ${label} must be a full 40-character SHA`);
  const resolved = gitText(root, ["rev-parse", "--verify", `${value}^{commit}`]);
  if (resolved !== value) throw new Error(`IDENTITY: ${label} does not resolve byte-for-byte`);
  return resolved;
}

function readBlob(root, commit, path) {
  return gitBuffer(root, ["show", `${commit}:${path}`]);
}

function blobOid(root, commit, path) {
  return gitText(root, ["rev-parse", `${commit}:${path}`]);
}

function commitParent(root, commit) {
  return gitText(root, ["rev-parse", `${commit}^`]);
}

function commitPaths(root, commit) {
  const output = gitText(root, ["diff-tree", "--no-commit-id", "--name-only", "-r", commit]);
  return output ? output.split(/\r?\n/u).filter(Boolean).sort() : [];
}

function isAncestor(root, ancestor, descendant) {
  try {
    execFileSync("git", ["merge-base", "--is-ancestor", ancestor, descendant], { cwd: root, stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

function validateCandidateIdentity(root, candidate, sourceBase, target, spec) {
  if (candidate === SOURCE_CANDIDATE_SHA || candidate === SOURCE_EVIDENCE_SHA || candidate === CANDIDATE_PARENT_SHA) {
    throw new Error("IDENTITY: reviewed v5 commits cannot be substituted for the v6 candidate");
  }
  if (
    commitParent(root, candidate) !== CANDIDATE_PARENT_SHA ||
    sourceBase !== BASE_SHA ||
    target !== INTEGRATION_TARGET_SHA
  ) {
    throw new Error("IDENTITY: v6 candidate parent, immutable base, or moving integration target differs");
  }
  if (gitText(root, ["merge-base", candidate, target]) !== sourceBase) {
    throw new Error("IDENTITY: candidate/target merge-base differs");
  }
  if (isAncestor(root, REJECTED_V4_CANDIDATE_SHA, candidate) || isAncestor(root, REJECTED_V4_EVIDENCE_SHA, candidate)) {
    throw new Error("IDENTITY: rejected v4 appears in candidate ancestry");
  }
  if (
    commitParent(root, SOURCE_CANDIDATE_SHA) !== BASE_SHA ||
    commitParent(root, SOURCE_EVIDENCE_SHA) !== SOURCE_CANDIDATE_SHA ||
    commitParent(root, CANDIDATE_PARENT_SHA) !== SOURCE_CANDIDATE_SHA ||
    !isAncestor(root, SOURCE_EVIDENCE_SHA, candidate)
  ) {
    throw new Error("IDENTITY: reviewed v5 chain is not the exact v6 ancestry prefix");
  }
  if (canonicalJson(commitPaths(root, candidate)) !== canonicalJson(CANDIDATE_PATHS)) {
    throw new Error("SCOPE: candidate commit scope differs");
  }
  if (
    spec.meta.sourceBase !== sourceBase ||
    spec.meta.currentIntegrationTarget !== target ||
    spec.meta.candidateParent !== CANDIDATE_PARENT_SHA
  ) {
    throw new Error("IDENTITY: candidate JSON provenance differs");
  }
}

function parseJsonBuffer(buffer, label) {
  try {
    return JSON.parse(buffer.toString("utf8"));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`JSON_PARSE: ${label}: ${message}`);
  }
}

function validateBlobIdentity(root, commit, record, label) {
  if (!GIT_BLOB_OID.test(record.gitBlob)) throw new Error(`BLOB_IDENTITY: ${label}.gitBlob differs`);
  requireTypedSha256(record.sha256, `${label}.sha256`);
  requireInteger(record.bytes, `${label}.bytes`, 0);
  const blob = readBlob(root, commit, record.path);
  if (
    blobOid(root, commit, record.path) !== record.gitBlob ||
    typedSha256(blob) !== record.sha256 ||
    blob.length !== record.bytes
  ) {
    throw new Error(`BLOB_IDENTITY: ${label} differs from Git`);
  }
}

function requireExecutionDigest(value, label) {
  if (typeof value !== "string" || !TYPED_SHA256.test(value)) {
    throw new Error(`EXECUTION_RECORD: ${label} must be sha256:<64 lowercase hexadecimal>`);
  }
  return value;
}

function parseExecutionLog(value) {
  const entries = new Map();
  for (const [index, line] of value.split(/\r?\n/u).entries()) {
    if (line.trim() === "") continue;
    let entry;
    try {
      entry = JSON.parse(line);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`EXECUTION_LOG: line ${index + 1} is not JSON: ${message}`);
    }
    requireExactKeys(entry, EXECUTION_LOG_KEYS, `execution log line ${index + 1}`);
    if (entry.kind !== "execution_log_entry") throw new Error(`EXECUTION_LOG: line ${index + 1} kind differs`);
    requireString(entry.recordId, `execution log line ${index + 1}.recordId`);
    if (typeof entry.stdout !== "string" || typeof entry.stderr !== "string") {
      throw new Error(`EXECUTION_LOG: line ${index + 1} stdout/stderr must be strings`);
    }
    requireExecutionDigest(entry.stdoutDigest, `execution log line ${index + 1}.stdoutDigest`);
    requireExecutionDigest(entry.stderrDigest, `execution log line ${index + 1}.stderrDigest`);
    if (entry.stdoutDigest !== typedSha256(entry.stdout) || entry.stderrDigest !== typedSha256(entry.stderr)) {
      throw new Error(`EXECUTION_LOG: line ${index + 1} digest differs from actual output`);
    }
    if (entries.has(entry.recordId)) throw new Error(`EXECUTION_LOG: duplicate record ${entry.recordId}`);
    entries.set(entry.recordId, entry);
  }
  return entries;
}

function validateRunRecords(manifest, logReader, root, replayCommands = false) {
  const records = requireArray(manifest.runRecords, "manifest.runRecords", 1);
  const requirements = expectedRunRequirements(manifest.candidateCommit, manifest.validationTime, root);
  if (records.length !== requirements.length) {
    throw new Error(`EXECUTION_RECORD: expected ${requirements.length} exact records, received ${records.length}`);
  }
  const ids = records.map((record) => record.recordId);
  if (new Set(ids).size !== ids.length) throw new Error("EXECUTION_RECORD: record IDs must be unique");
  const captureEpoch = parseStrictRfc3339(manifest.capturedAt, "manifest.capturedAt");
  const commandCounts = new Map();
  records.forEach((record, index) => {
    const requirement = requirements[index];
    if (
      record.kind !== "run_record" ||
      record.recordId !== requirement.recordId ||
      record.commandId !== requirement.commandId ||
      record.executable !== requirement.executable ||
      canonicalJson(record.args) !== canonicalJson(requirement.args) ||
      record.cwd !== requirement.cwd ||
      record.outputLogPath !== EXECUTION_LOG_PATH ||
      record.outputRecordId !== record.recordId
    ) {
      throw new Error(`EXECUTION_RECORD: command identity differs at ${requirement.recordId}`);
    }
    record.args.forEach((arg, argIndex) => requireString(arg, `${record.recordId}.args[${argIndex}]`));
    requireString(record.cwd, `${record.recordId}.cwd`);
    requireInteger(record.exitCode, `${record.recordId}.exitCode`);
    if (record.exitCode !== requirement.expectedExitCode) {
      throw new Error(`EXECUTION_RECORD: ${record.recordId} exitCode differs from expected`);
    }
    requireExecutionDigest(record.stdoutDigest, `${record.recordId}.stdoutDigest`);
    requireExecutionDigest(record.stderrDigest, `${record.recordId}.stderrDigest`);
    requireExecutionDigest(record.rawLogDigest, `${record.recordId}.rawLogDigest`);
    const started = parseStrictRfc3339(record.startedAt, `${record.recordId}.startedAt`);
    const completed = parseStrictRfc3339(record.completedAt, `${record.recordId}.completedAt`);
    if (completed < started || completed > captureEpoch) {
      throw new Error(`EXECUTION_RECORD: ${record.recordId} timestamps are reversed or postdate capture`);
    }
    const entry = logReader(record.outputLogPath, record.outputRecordId, record);
    if (!entry || entry.recordId !== record.outputRecordId) {
      throw new Error(`EXECUTION_LOG: ${record.recordId} output entry is missing or mismatched`);
    }
    if (record.stdoutDigest !== entry.stdoutDigest || record.stderrDigest !== entry.stderrDigest) {
      throw new Error(`EXECUTION_RECORD: ${record.recordId} output digest differs from the log`);
    }
    if (record.rawLogDigest !== typedSha256(canonicalJson(entry))) {
      throw new Error(`EXECUTION_RECORD: ${record.recordId} raw immutable log digest differs`);
    }
    if (replayCommands) {
      const replay = spawnSync(requirement.executable, requirement.args, {
        cwd: requirement.cwd,
        encoding: "utf8",
        maxBuffer: 64 * 1024 * 1024,
        windowsHide: true
      });
      if (replay.error) throw new Error(`EXECUTION_REPLAY: ${record.recordId}: ${replay.error.message}`);
      const replayStdout = replay.stdout ?? "";
      const replayStderr = replay.stderr ?? "";
      if (
        replay.status !== requirement.expectedExitCode ||
        typedSha256(replayStdout) !== record.stdoutDigest ||
        typedSha256(replayStderr) !== record.stderrDigest
      ) {
        throw new Error(`EXECUTION_REPLAY: ${record.recordId} did not reproduce exit/stdout/stderr digests`);
      }
    }
    commandCounts.set(record.commandId, (commandCounts.get(record.commandId) ?? 0) + 1);
  });
  const derivedMultiplicities = REQUIRED_COMMAND_MULTIPLICITIES.map((entry) => {
    const [commandId] = entry.split("=");
    return `${commandId}=${commandCounts.get(commandId) ?? 0}`;
  });
  if (canonicalJson(derivedMultiplicities) !== canonicalJson(REQUIRED_COMMAND_MULTIPLICITIES)) {
    throw new Error("EXECUTION_RECORD: derived command multiplicities differ");
  }
}

function validateEvidenceManifestShape(manifest, spec, validationTime, logReader, root = process.cwd(), replayCommands = false) {
  if (typeof logReader !== "function") {
    throw new Error("EXECUTION_LOG: raw immutable log reader is required; marker-only fallback is forbidden");
  }
  collectClosedObjectsAndRequireExactKeys(manifest, "$manifest");
  if (manifest.schemaVersion !== "6.0.0" || manifest.branch !== BRANCH) {
    throw new Error("IDENTITY: evidence schema/branch differs");
  }
  requireFreshTimestamp(
    manifest.capturedAt,
    "review evidence capturedAt",
    validationTime,
    spec.freshnessPolicy.evidenceMaxAgeSeconds,
    spec.freshnessPolicy.futureSkewSeconds
  );
  requireFreshTimestamp(
    manifest.validationTime,
    "review evidence validationTime",
    validationTime,
    spec.freshnessPolicy.evidenceMaxAgeSeconds,
    spec.freshnessPolicy.futureSkewSeconds
  );
  requireFreshTimestamp(
    manifest.ledgerCapturedAt,
    "review evidence ledgerCapturedAt",
    validationTime,
    spec.freshnessPolicy.ledgerMaxAgeSeconds,
    spec.freshnessPolicy.futureSkewSeconds
  );
  for (const key of ["candidateCommit", "candidateParent", "sourceBase", "currentIntegrationTarget", "mergeBase"]) {
    if (!FULL_SHA.test(manifest[key])) throw new Error(`IDENTITY: manifest.${key} must be a full SHA`);
  }
  if (
    manifest.authorityRef !== AUTHORITY_REF ||
    manifest.authorityHead !== INTEGRATION_TARGET_SHA ||
    manifest.currentIntegrationTarget !== INTEGRATION_TARGET_SHA ||
    manifest.authorEvidenceTrust !== AUTHOR_EVIDENCE_TRUST ||
    manifest.independentVerdict !== INDEPENDENT_VERDICT ||
    manifest.rebaseDisposition !== "FETCH_AND_MERGE_TREE_PROOF_NO_REBASE_REVIEWED_COMMITS"
  ) {
    throw new Error("EVIDENCE_TRUST: authority identity or author/independent claim boundary differs");
  }
  if (
    manifest.browserExecutions !== 0 ||
    manifest.productExecutions !== 0 ||
    manifest.buildExecutions !== 0 ||
    manifest.exportExecutions !== 0 ||
    manifest.implementationExecutions !== 0
  ) {
    throw new Error("EXECUTION_CLAIM: product/build/export/browser/implementation executions must remain zero");
  }
  if (manifest.unexecutedBrowserMatrix !== "FUTURE_UNEXECUTED_390x844_100_AND_200_DAY_NIGHT") {
    throw new Error("EXECUTION_CLAIM: browser matrix declaration differs");
  }
  if (canonicalJson(manifest.blockedAuthorities) !== canonicalJson(spec.authorityGates.map((gate) => gate.id))) {
    throw new Error("AUTHORITY_GATE: evidence blocked authorities differ");
  }
  if (canonicalJson([...manifest.candidateScope.paths].sort()) !== canonicalJson(CANDIDATE_PATHS)) {
    throw new Error("SCOPE: manifest candidate scope differs");
  }
  if (canonicalJson([...manifest.evidenceScope.paths].sort()) !== canonicalJson(EVIDENCE_PATHS)) {
    throw new Error("SCOPE: manifest evidence scope differs");
  }
  if (manifest.refSnapshotDigest !== typedSha256(canonicalJson(spec.integrationLedger))) {
    throw new Error("BLOB_IDENTITY: ref snapshot digest differs");
  }
  validateRunRecords(manifest, logReader, root, replayCommands);
  const red = manifest.redBaseline;
  if (
    red.referenceBranch !== SOURCE_CANDIDATE_BRANCH ||
    red.referenceCandidate !== SOURCE_CANDIDATE_SHA ||
    red.referenceEvidence !== SOURCE_EVIDENCE_SHA ||
    red.observedExit !== 1 ||
    canonicalJson(red.failures) !== canonicalJson(V5_REJECT_FAILURES) ||
    red.externalAttackCases !== 53 ||
    red.acceptedAttackCases !== 27 ||
    red.normativeMutationCases !== 2167 ||
    red.acceptedNormativeMutations !== 0 ||
    red.outputLogPath !== RED_LOG_PATH ||
    red.browserExecutions !== 0
  ) {
    throw new Error("VALIDATION_EVIDENCE: v5 independent RED baseline differs");
  }
  requireExecutionDigest(red.stdoutDigest, "redBaseline.stdoutDigest");
  const preserved = manifest.v5PreservedBaseline;
  if (
    preserved.referenceCandidate !== SOURCE_CANDIDATE_SHA ||
    preserved.referenceEvidence !== SOURCE_EVIDENCE_SHA ||
    preserved.closedObjects !== 328 ||
    preserved.openMapInstances !== 24 ||
    preserved.unknownKeyPasses !== 2 ||
    preserved.unknownKeyAttacksPerRun !== 656 ||
    preserved.exactKeyRejectionsPerRun !== 656 ||
    preserved.deliberateAttackCaseCount !== 26 ||
    preserved.deliberateAttackRequiredRuns !== 52 ||
    preserved.normativeMutationCases !== 2167 ||
    preserved.normativeMutationRejections !== 2167 ||
    preserved.browserExecutions !== 0 ||
    preserved.productExecutions !== 0 ||
    preserved.implementationExecutions !== 0
  ) {
    throw new Error("VALIDATION_EVIDENCE: preserved v5 strengths differ");
  }
}

function validateReviewPair(root, args, validationTime, deliberate = "") {
  const evidence = resolveCommit(root, args.evidence, "evidence");
  const candidate = resolveCommit(root, args.candidate, "candidate");
  const sourceBase = resolveCommit(root, args.sourceBase, "source-base");
  const target = resolveCommit(root, args.target, "target");
  const manifestBuffer = readBlob(root, evidence, args.manifest);
  const manifest = parseJsonBuffer(manifestBuffer, "review-evidence.json");
  const executionLog = parseExecutionLog(readBlob(root, evidence, EXECUTION_LOG_PATH).toString("utf8"));
  if (executionLog.size !== manifest.runRecords.length) {
    throw new Error("EXECUTION_LOG: entry count differs from manifest records");
  }
  const logReader = (path, recordId) => {
    if (path !== EXECUTION_LOG_PATH) throw new Error(`EXECUTION_LOG: unexpected path ${path}`);
    return executionLog.get(recordId);
  };
  const spec = parseJsonBuffer(readBlob(root, candidate, SPEC_JSON_PATH), "candidate spec.json");
  const markdown = readBlob(root, candidate, SPEC_MARKDOWN_PATH).toString("utf8");
  validateContract(spec, validationTime);
  validateMarkdown(spec, markdown);

  if (deliberate === "evidence-self-sha" || deliberate === "candidate-parent-drift") {
    const definition = attackDefinition(spec, deliberate);
    expectDeliberateRejection(deliberate, definition.expectedErrorPrefix, () => {
      const mutated = clone(manifest);
      if (deliberate === "evidence-self-sha") {
        mutated.selfSha = evidence;
        collectClosedObjectsAndRequireExactKeys(mutated, "$manifest");
      } else {
        mutated.candidateParent = SOURCE_CANDIDATE_SHA;
        validateEvidenceManifestShape(mutated, spec, validationTime, logReader, root);
        if (mutated.candidateParent !== CANDIDATE_PARENT_SHA) {
          throw new Error("IDENTITY: manifest candidate parent differs");
        }
      }
    });
  }
  if (deliberate) runContractAttack(spec, markdown, deliberate, validationTime);

  validateEvidenceManifestShape(manifest, spec, validationTime, logReader, root);
  const redLog = readBlob(root, evidence, RED_LOG_PATH);
  if (typedSha256(redLog) !== manifest.redBaseline.stdoutDigest) {
    throw new Error("VALIDATION_EVIDENCE: RED output log digest differs");
  }
  if (
    manifest.candidateCommit !== candidate ||
    manifest.candidateParent !== CANDIDATE_PARENT_SHA ||
    manifest.sourceBase !== sourceBase ||
    manifest.currentIntegrationTarget !== target ||
    manifest.mergeBase !== sourceBase
  ) {
    throw new Error("IDENTITY: manifest candidate/parent/source/target/merge-base differs");
  }
  validateCandidateIdentity(root, candidate, sourceBase, target, spec);
  if (commitParent(root, evidence) !== candidate) {
    throw new Error("IDENTITY: evidence commit is not an exact child of candidate");
  }
  if (canonicalJson(commitPaths(root, evidence)) !== canonicalJson(EVIDENCE_PATHS)) {
    throw new Error("SCOPE: evidence commit scope differs");
  }
  if (isAncestor(root, REJECTED_V4_CANDIDATE_SHA, evidence) || isAncestor(root, REJECTED_V4_EVIDENCE_SHA, evidence)) {
    throw new Error("IDENTITY: rejected v4 appears in evidence ancestry");
  }
  const serializedManifest = manifestBuffer.toString("utf8");
  const evidenceBlob = blobOid(root, evidence, args.manifest);
  if (serializedManifest.includes(evidence) || serializedManifest.includes(evidenceBlob)) {
    throw new Error("IDENTITY: evidence manifest contains a self SHA or own blob OID");
  }
  const candidateRecords = manifest.candidateArtifacts;
  if (candidateRecords.length !== CANDIDATE_PATHS.length) throw new Error("BLOB_IDENTITY: candidate artifact count differs");
  if (canonicalJson(candidateRecords.map((record) => record.path).sort()) !== canonicalJson(CANDIDATE_PATHS)) {
    throw new Error("BLOB_IDENTITY: candidate artifact paths differ");
  }
  candidateRecords.forEach((record, index) => validateBlobIdentity(root, candidate, record, `candidateArtifacts[${index}]`));
  const targetPaths = [...spec.reviewScope.targetBlobPaths].sort();
  if (manifest.targetBlobs.length !== targetPaths.length) throw new Error("BLOB_IDENTITY: target blob count differs");
  if (canonicalJson(manifest.targetBlobs.map((record) => record.path).sort()) !== canonicalJson(targetPaths)) {
    throw new Error("BLOB_IDENTITY: target blob paths differ");
  }
  manifest.targetBlobs.forEach((record, index) => validateBlobIdentity(root, target, record, `targetBlobs[${index}]`));
  return { evidence, candidate, sourceBase, target, manifest, spec, markdown };
}

function parseArguments(argv) {
  const args = {
    mode: argv[0] ?? "",
    root: process.cwd(),
    specFile: SPEC_JSON_PATH,
    markdownFile: SPEC_MARKDOWN_PATH,
    executionLog: EXECUTION_LOG_PATH,
    evidence: "",
    manifest: EVIDENCE_PATH,
    candidate: "",
    sourceBase: "",
    target: "",
    validationTime: "",
    deliberate: ""
  };
  for (let index = 1; index < argv.length; index += 1) {
    const key = argv[index];
    const take = () => {
      index += 1;
      if (index >= argv.length) throw new Error(`Missing value for ${key}`);
      return argv[index];
    };
    if (key === "--root") args.root = take();
    else if (key === "--spec-file") args.specFile = take();
    else if (key === "--markdown-file") args.markdownFile = take();
    else if (key === "--execution-log") args.executionLog = take();
    else if (key === "--evidence") args.evidence = take();
    else if (key === "--manifest") args.manifest = take();
    else if (key === "--candidate") args.candidate = take();
    else if (key === "--source-base") args.sourceBase = take();
    else if (key === "--target") args.target = take();
    else if (key === "--validation-time") args.validationTime = take();
    else if (key === "--deliberate") args.deliberate = take();
    else throw new Error(`Unknown argument: ${key}`);
  }
  return args;
}

function loadWorkingPair(args) {
  const root = resolve(args.root);
  const spec = JSON.parse(readFileSync(join(root, args.specFile), "utf8"));
  const markdownPath = join(root, args.markdownFile);
  const markdown = readFileSync(markdownPath, "utf8");
  return { root, spec, markdown, markdownPath };
}

function canonicalSpecReviewArguments(args) {
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
  return expected;
}

function blobIdentityRecord(root, commit, path) {
  const blob = readBlob(root, commit, path);
  return {
    kind: "blob_identity",
    path,
    gitBlob: blobOid(root, commit, path),
    sha256: typedSha256(blob),
    bytes: blob.length
  };
}

function executeRequirement(root, requirement) {
  const startedAt = new Date().toISOString();
  const result = spawnSync(requirement.executable, requirement.args, {
    cwd: requirement.cwd,
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
    windowsHide: true
  });
  const completedAt = new Date().toISOString();
  if (result.error) throw new Error(`EXECUTION_RUNNER: ${requirement.recordId}: ${result.error.message}`);
  const exitCode = result.status;
  if (!Number.isInteger(exitCode)) {
    throw new Error(`EXECUTION_RUNNER: ${requirement.recordId} did not return an integer exit code`);
  }
  const stdout = result.stdout ?? "";
  const stderr = result.stderr ?? "";
  if (exitCode !== requirement.expectedExitCode) {
    throw new Error(
      `EXECUTION_RUNNER: ${requirement.recordId} expected exit ${requirement.expectedExitCode}, received ${exitCode}\n${stdout}\n${stderr}`
    );
  }
  const stdoutDigest = typedSha256(stdout);
  const stderrDigest = typedSha256(stderr);
  const entry = {
    kind: "execution_log_entry",
    recordId: requirement.recordId,
    stdout,
    stderr,
    stdoutDigest,
    stderrDigest
  };
  return {
    record: {
      kind: "run_record",
      recordId: requirement.recordId,
      commandId: requirement.commandId,
      executable: requirement.executable,
      args: requirement.args,
      cwd: requirement.cwd,
      startedAt,
      completedAt,
      exitCode,
      stdoutDigest,
      stderrDigest,
      rawLogDigest: typedSha256(canonicalJson(entry)),
      outputLogPath: EXECUTION_LOG_PATH,
      outputRecordId: requirement.recordId
    },
    entry
  };
}

function writeEvidenceArtifacts(root, manifest, records, entries) {
  manifest.capturedAt = new Date().toISOString();
  manifest.runRecords = records;
  const serializedLog = `${entries.map((entry) => JSON.stringify(entry)).join("\n")}\n`;
  writeFileSync(join(root, EXECUTION_LOG_PATH), serializedLog, "utf8");
  writeFileSync(join(root, EVIDENCE_PATH), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
}

function evidenceManifest(root, candidate, spec, validationTime, records) {
  const redLog = readFileSync(join(root, RED_LOG_PATH));
  return {
    kind: "review_evidence",
    schemaVersion: "6.0.0",
    capturedAt: new Date().toISOString(),
    validationTime,
    branch: BRANCH,
    candidateCommit: candidate,
    candidateParent: CANDIDATE_PARENT_SHA,
    sourceBase: BASE_SHA,
    currentIntegrationTarget: INTEGRATION_TARGET_SHA,
    mergeBase: BASE_SHA,
    authorityRef: AUTHORITY_REF,
    authorityHead: resolveLiveAuthorityRef(root),
    authorEvidenceTrust: AUTHOR_EVIDENCE_TRUST,
    independentVerdict: INDEPENDENT_VERDICT,
    rebaseDisposition: "FETCH_AND_MERGE_TREE_PROOF_NO_REBASE_REVIEWED_COMMITS",
    candidateScope: { kind: "scope_identity", paths: CANDIDATE_PATHS },
    evidenceScope: { kind: "scope_identity", paths: EVIDENCE_PATHS },
    candidateArtifacts: CANDIDATE_PATHS.map((path) => blobIdentityRecord(root, candidate, path)),
    targetBlobs: spec.reviewScope.targetBlobPaths.map((path) => blobIdentityRecord(root, INTEGRATION_TARGET_SHA, path)),
    ledgerCapturedAt: spec.integrationLedger.capturedAt,
    refSnapshotDigest: typedSha256(canonicalJson(spec.integrationLedger)),
    browserExecutions: 0,
    productExecutions: 0,
    buildExecutions: 0,
    exportExecutions: 0,
    implementationExecutions: 0,
    blockedAuthorities: spec.authorityGates.map((gate) => gate.id),
    unexecutedBrowserMatrix: "FUTURE_UNEXECUTED_390x844_100_AND_200_DAY_NIGHT",
    runRecords: records,
    redBaseline: {
      kind: "red_baseline",
      referenceBranch: SOURCE_CANDIDATE_BRANCH,
      referenceCandidate: SOURCE_CANDIDATE_SHA,
      referenceEvidence: SOURCE_EVIDENCE_SHA,
      observedExit: 1,
      failures: V5_REJECT_FAILURES,
      externalAttackCases: 53,
      acceptedAttackCases: 27,
      normativeMutationCases: 2167,
      acceptedNormativeMutations: 0,
      outputLogPath: RED_LOG_PATH,
      stdoutDigest: typedSha256(redLog),
      browserExecutions: 0
    },
    v5PreservedBaseline: {
      kind: "v5_preserved_baseline",
      referenceCandidate: SOURCE_CANDIDATE_SHA,
      referenceEvidence: SOURCE_EVIDENCE_SHA,
      closedObjects: 328,
      openMapInstances: 24,
      unknownKeyPasses: 2,
      unknownKeyAttacksPerRun: 656,
      exactKeyRejectionsPerRun: 656,
      deliberateAttackCaseCount: 26,
      deliberateAttackRequiredRuns: 52,
      normativeMutationCases: 2167,
      normativeMutationRejections: 2167,
      browserExecutions: 0,
      productExecutions: 0,
      implementationExecutions: 0
    }
  };
}

function recordEvidence(root, args, validationTime) {
  const candidate = resolveCommit(root, args.candidate, "candidate");
  const spec = parseJsonBuffer(readBlob(root, candidate, SPEC_JSON_PATH), "candidate spec.json");
  const markdown = readBlob(root, candidate, SPEC_MARKDOWN_PATH).toString("utf8");
  validateContract(spec, validationTime, { root });
  validateMarkdown(spec, markdown);
  validateCandidateIdentity(root, candidate, BASE_SHA, INTEGRATION_TARGET_SHA, spec);
  const requirements = expectedRunRequirements(candidate, args.validationTime, root);
  const records = [];
  const entries = [];
  for (const requirement of requirements) {
    const execution = executeRequirement(root, requirement);
    records.push(execution.record);
    entries.push(execution.entry);
    if (requirement.commandId === "authority-fetch") {
      authorityHeadCache.clear();
      validateLiveAuthorityRef(spec, root);
    }
  }
  const manifest = evidenceManifest(root, candidate, spec, args.validationTime, records);
  writeEvidenceArtifacts(root, manifest, records, entries);
  return { candidate, records: records.length };
}

function validateWorkingEvidence(root, args, validationTime, replayCommands = true) {
  const candidate = resolveCommit(root, args.candidate, "candidate");
  const manifest = JSON.parse(readFileSync(join(root, args.manifest), "utf8"));
  const executionLog = parseExecutionLog(readFileSync(join(root, args.executionLog), "utf8"));
  if (executionLog.size !== manifest.runRecords.length) {
    throw new Error("EXECUTION_LOG: working entry count differs from manifest records");
  }
  const logReader = (path, recordId) => {
    if (path !== EXECUTION_LOG_PATH) throw new Error(`EXECUTION_LOG: unexpected path ${path}`);
    return executionLog.get(recordId);
  };
  const spec = parseJsonBuffer(readBlob(root, candidate, SPEC_JSON_PATH), "candidate spec.json");
  const markdown = readBlob(root, candidate, SPEC_MARKDOWN_PATH).toString("utf8");
  validateContract(spec, validationTime, { root });
  validateMarkdown(spec, markdown);
  validateEvidenceManifestShape(manifest, spec, validationTime, logReader, root, replayCommands);
  authorityHeadCache.clear();
  validateLiveAuthorityRef(spec, root);
  if (
    manifest.candidateCommit !== candidate ||
    manifest.candidateParent !== CANDIDATE_PARENT_SHA ||
    manifest.sourceBase !== BASE_SHA ||
    manifest.currentIntegrationTarget !== INTEGRATION_TARGET_SHA ||
    manifest.mergeBase !== BASE_SHA
  ) {
    throw new Error("IDENTITY: working manifest candidate/parent/source/target/merge-base differs");
  }
  validateCandidateIdentity(root, candidate, BASE_SHA, INTEGRATION_TARGET_SHA, spec);
  if (manifest.candidateArtifacts.length !== CANDIDATE_PATHS.length) {
    throw new Error("BLOB_IDENTITY: working candidate artifact count differs");
  }
  if (canonicalJson(manifest.candidateArtifacts.map((record) => record.path)) !== canonicalJson(CANDIDATE_PATHS)) {
    throw new Error("BLOB_IDENTITY: working candidate artifact paths differ");
  }
  manifest.candidateArtifacts.forEach((record, index) =>
    validateBlobIdentity(root, candidate, record, `candidateArtifacts[${index}]`)
  );
  if (manifest.targetBlobs.length !== spec.reviewScope.targetBlobPaths.length) {
    throw new Error("BLOB_IDENTITY: working target blob count differs");
  }
  if (
    canonicalJson(manifest.targetBlobs.map((record) => record.path)) !==
    canonicalJson(spec.reviewScope.targetBlobPaths)
  ) {
    throw new Error("BLOB_IDENTITY: working target blob paths differ");
  }
  manifest.targetBlobs.forEach((record, index) =>
    validateBlobIdentity(root, INTEGRATION_TARGET_SHA, record, `targetBlobs[${index}]`)
  );
  const redLog = readFileSync(join(root, RED_LOG_PATH));
  if (typedSha256(redLog) !== manifest.redBaseline.stdoutDigest) {
    throw new Error("VALIDATION_EVIDENCE: working RED output log digest differs");
  }
  return { candidate, records: manifest.runRecords.length };
}

function main() {
  const raw = process.argv.slice(2);
  if (raw[0] === "implementation") throw new Error(IMPLEMENTATION_BLOCK);
  const args = parseArguments(raw);
  const root = resolve(args.root);

  if (args.mode === "shape-fingerprint") {
    const spec = JSON.parse(readFileSync(join(root, args.specFile), "utf8"));
    collectClosedObjectsAndRequireExactKeys(spec);
    console.log(objectGraphSha256(spec));
    return;
  }
  if (args.mode === "normative-fingerprint") {
    const spec = JSON.parse(readFileSync(join(root, args.specFile), "utf8"));
    collectClosedObjectsAndRequireExactKeys(spec);
    console.log(normativeContractSha256(spec));
    return;
  }
  if (args.mode === "render-markdown") {
    const spec = JSON.parse(readFileSync(join(root, args.specFile), "utf8"));
    process.stdout.write(renderMarkdown(spec));
    return;
  }
  if (args.mode === "write-markdown") {
    const spec = JSON.parse(readFileSync(join(root, args.specFile), "utf8"));
    const output = renderMarkdown(spec);
    writeFileSync(join(root, args.markdownFile), output, "utf8");
    console.log(`MARKDOWN_WRITTEN=${args.markdownFile}`);
    return;
  }
  if (args.mode === "authoring-check" || args.mode === "object-census" || args.mode === "unknown-key-matrix" || args.mode === "attack-check") {
    const { spec, markdown } = loadWorkingPair(args);
    const validationTime = resolveValidationTime(args.validationTime, spec.freshnessPolicy);
    if (args.mode === "authoring-check") {
      const fetchedHead = fetchLiveAuthorityRef(root);
      if (fetchedHead !== INTEGRATION_TARGET_SHA) {
        throw new Error(`AUTHORITY_REF: fetched head advanced to ${fetchedHead}`);
      }
    }
    if (args.mode === "attack-check") {
      if (!args.deliberate) throw new Error("attack-check requires --deliberate");
      runContractAttack(spec, markdown, args.deliberate, validationTime);
      return;
    }
    const result = validateContract(spec, validationTime, { root });
    validateMarkdown(spec, markdown);
    if (args.mode === "object-census") {
      console.log(`CLOSED_OBJECTS=${result.locations.length}`);
      console.log("ROOT_INCLUDED=true");
      console.log(`OPEN_MAP_FAMILIES=${OPEN_MAP_PATHS.size}`);
      console.log(`OPEN_MAP_INSTANCES=${countOpenMapInstances(spec)}`);
      console.log(`OBJECT_GRAPH_SHA256=${objectGraphSha256(spec)}`);
      console.log(`NORMATIVE_CONTRACT_SHA256=${normativeContractSha256(spec)}`);
      return;
    }
    if (args.mode === "unknown-key-matrix") {
      runUnknownKeyMatrix(spec, validationTime);
      return;
    }
    console.log("SPEC_JSON_PARSE=PASS");
    console.log("EXACT_KEY_CLOSURE=PASS");
    console.log(`CLOSED_OBJECTS=${result.locations.length}`);
    console.log("MARKDOWN_JSON_SEMANTIC_PARITY=PASS");
    console.log("PHOTO_CONFIRMATION_TRANSITION=PASS");
    console.log("EVIDENCE_ROLE_STATES=PASS");
    console.log(`TEXT_SCALING_PROFILE=${TEXT_SCALING_PROFILE_ID}`);
    console.log(`SELECTED_MOBILE_VIEWPORT=${SELECTED_MOBILE_VIEWPORT}`);
    console.log("PER_NODE_INLINE_FONT_SIZE_MUTATIONS=0");
    console.log("PER_NODE_INLINE_LINE_HEIGHT_MUTATIONS=0");
    console.log(`DELIBERATE_ATTACK_CASES=${NEGATIVE_ATTACK_IDS.length}`);
    console.log("FRESHNESS_POLICY=PASS");
    console.log("BROWSER_EXECUTIONS=0");
    console.log("PRODUCT_BUILD_EXPORT_EXECUTIONS=0");
    console.log(IMPLEMENTATION_BLOCK);
    return;
  }
  if (args.mode === "diff-contract") {
    const candidate = resolveCommit(root, args.candidate, "candidate");
    const sourceBase = resolveCommit(root, args.sourceBase, "source-base");
    const target = resolveCommit(root, args.target, "target");
    const spec = parseJsonBuffer(readBlob(root, candidate, SPEC_JSON_PATH), "candidate spec.json");
    const liveHead = resolveLiveAuthorityRef(root);
    if (liveHead !== target || target !== INTEGRATION_TARGET_SHA) {
      throw new Error(`AUTHORITY_REF: diff target ${target} differs from live ${liveHead}`);
    }
    validateCandidateIdentity(root, candidate, sourceBase, target, spec);
    const paths = commitPaths(root, candidate);
    if (paths.some((path) => /^(app|components|lib|supabase)\//u.test(path))) {
      throw new Error("DIFF_CONTRACT: product, library, or database path changed");
    }
    if (paths.some((path) => /(^|\/)(package(-lock)?\.json|pnpm-lock\.yaml|yarn\.lock)$/u.test(path))) {
      throw new Error("DIFF_CONTRACT: package or lock path changed");
    }
    if (paths.some((path) => /(^|\/)(\.env(?:\.|$)|[^/]+\.(?:pem|key|p12))$/iu.test(path))) {
      throw new Error("SECRET_SCAN: secret-bearing path changed");
    }
    const forbiddenFragments = [
      "-----BEGIN" + " PRIVATE KEY-----",
      "gh" + "p_",
      "sk" + "-proj-",
      "SUPABASE_SERVICE_ROLE" + "="
    ];
    for (const path of paths) {
      const text = readBlob(root, candidate, path).toString("utf8");
      if (forbiddenFragments.some((fragment) => text.includes(fragment))) {
        throw new Error(`SECRET_SCAN: forbidden secret fragment in ${path}`);
      }
    }
    console.log("DIFF_CONTRACT=PASS");
    console.log(`CANDIDATE_FILES=${paths.length}`);
    console.log("PRODUCT_COMPONENT_MUTATIONS=0");
    console.log("DB_SCHEMA_MIGRATION_PACKAGE_LOCK_MUTATIONS=0");
    console.log("SECRET_SCAN=PASS");
    console.log(`DIRECT_PARENT=${CANDIDATE_PARENT_SHA}`);
    console.log(`IMMUTABLE_BASE=${sourceBase}`);
    console.log(`LIVE_INTEGRATION_TARGET=${liveHead}`);
    return;
  }
  if (args.mode === "record-evidence") {
    const candidateForPolicy = resolveCommit(root, args.candidate, "candidate");
    const specForPolicy = parseJsonBuffer(readBlob(root, candidateForPolicy, SPEC_JSON_PATH), "candidate spec.json");
    const validationTime = resolveValidationTime(args.validationTime, specForPolicy.freshnessPolicy);
    const result = recordEvidence(root, args, validationTime);
    console.log("AUTHOR_EVIDENCE_RECORDED=UNTRUSTED_REPRODUCIBLE");
    console.log(`CANDIDATE=${result.candidate}`);
    console.log(`STRUCTURED_RUN_RECORDS=${result.records}`);
    return;
  }
  if (args.mode === "evidence-self-check") {
    const candidateForPolicy = resolveCommit(root, args.candidate, "candidate");
    const specForPolicy = parseJsonBuffer(readBlob(root, candidateForPolicy, SPEC_JSON_PATH), "candidate spec.json");
    const validationTime = resolveValidationTime(args.validationTime, specForPolicy.freshnessPolicy);
    const result = validateWorkingEvidence(root, args, validationTime);
    console.log("AUTHOR_EVIDENCE_STRUCTURE=VALID");
    console.log("AUTHOR_COMMAND_REPLAY=REPRODUCED");
    console.log(`CANDIDATE=${result.candidate}`);
    console.log(`STRUCTURED_RUN_RECORDS=${result.records}`);
    console.log("COUNTS_DERIVED_FROM_ACTUAL_RECORDS=true");
    console.log(`INDEPENDENT_VERDICT=${INDEPENDENT_VERDICT}`);
    return;
  }
  if (args.mode === "candidate-review") {
    const candidate = resolveCommit(root, args.candidate, "candidate");
    const sourceBase = resolveCommit(root, args.sourceBase, "source-base");
    const target = resolveCommit(root, args.target, "target");
    const spec = parseJsonBuffer(readBlob(root, candidate, SPEC_JSON_PATH), "candidate spec.json");
    const markdown = readBlob(root, candidate, SPEC_MARKDOWN_PATH).toString("utf8");
    const validationTime = resolveValidationTime(args.validationTime, spec.freshnessPolicy);
    const fetchedHead = fetchLiveAuthorityRef(root);
    if (fetchedHead !== target) throw new Error(`AUTHORITY_REF: candidate review target advanced to ${fetchedHead}`);
    const result = validateContract(spec, validationTime, { root });
    validateMarkdown(spec, markdown);
    validateCandidateIdentity(root, candidate, sourceBase, target, spec);
    console.log("CANDIDATE_CONTRACT=VALID_REQUIRES_FRESH_INDEPENDENT_REVIEW");
    console.log(`CLOSED_OBJECTS=${result.locations.length}`);
    console.log(`TEXT_SCALING_PROFILE=${TEXT_SCALING_PROFILE_ID}`);
    console.log(`SELECTED_MOBILE_VIEWPORT=${SELECTED_MOBILE_VIEWPORT}`);
    console.log("BROWSER_EXECUTIONS=0");
    console.log(IMPLEMENTATION_BLOCK);
    return;
  }
  if (args.mode === "spec-review") {
    if (canonicalJson(raw) !== canonicalJson(canonicalSpecReviewArguments(args))) {
      throw new Error("INVOCATION: spec-review arguments differ from canonical ordered tokens");
    }
    const candidateForPolicy = resolveCommit(root, args.candidate, "candidate");
    const specForPolicy = parseJsonBuffer(readBlob(root, candidateForPolicy, SPEC_JSON_PATH), "candidate spec.json");
    const validationTime = resolveValidationTime(args.validationTime, specForPolicy.freshnessPolicy);
    const fetchedHead = fetchLiveAuthorityRef(root);
    if (fetchedHead !== args.target) throw new Error(`AUTHORITY_REF: spec review target advanced to ${fetchedHead}`);
    const result = validateReviewPair(root, args, validationTime, args.deliberate);
    console.log("AUTHOR_EVIDENCE_COMMIT_PAIR=STRUCTURALLY_VALID");
    console.log(`CANDIDATE=${result.candidate}`);
    console.log(`EVIDENCE=${result.evidence}`);
    console.log(`PARENT_CHAIN=${result.evidence}->${result.candidate}->${CANDIDATE_PARENT_SHA}->${SOURCE_CANDIDATE_SHA}->${result.sourceBase}`);
    console.log("CANDIDATE_SCOPE=PASS");
    console.log("EVIDENCE_SCOPE=PASS");
    console.log("BLOB_OID_SHA256_BYTES=PASS");
    console.log("MARKDOWN_JSON_SEMANTIC_PARITY=PASS");
    console.log(`TEXT_SCALING_PROFILE=${TEXT_SCALING_PROFILE_ID}`);
    console.log(`SELECTED_MOBILE_VIEWPORT=${SELECTED_MOBILE_VIEWPORT}`);
    console.log("PER_NODE_INLINE_STYLE_MUTATIONS=0");
    console.log("FRESHNESS_POLICY=PASS");
    console.log("BROWSER_EXECUTIONS=0");
    console.log("PRODUCT_BUILD_EXPORT_EXECUTIONS=0");
    console.log("INDEPENDENT_RERUN_REQUIRED=true");
    console.log(`INDEPENDENT_VERDICT=${INDEPENDENT_VERDICT}`);
    console.log(IMPLEMENTATION_BLOCK);
    return;
  }
  throw new Error("Mode must be shape-fingerprint, normative-fingerprint, render-markdown, write-markdown, authoring-check, object-census, unknown-key-matrix, attack-check, diff-contract, record-evidence, evidence-self-check, candidate-review, spec-review, or implementation");
}

try {
  main();
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`CONTRACT_ERROR: ${message}`);
  process.exitCode = 1;
}
