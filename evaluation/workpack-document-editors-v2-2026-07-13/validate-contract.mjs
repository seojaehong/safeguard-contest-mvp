import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

const BASE_SHA = "f45bba17bcce0d8ebb2690f82d014dbe42ae8191";
const REJECTED_CANDIDATE_SHA = "99b1af5385e0b5eaa9ff479761ecea944f0958ab";
const REJECTED_EVIDENCE_SHA = "b3762867d380f20faee2a83a17354dc61557ce12";
const BRANCH = "feat/workpack-document-editors-v2-target-ready-v3";
const ARTIFACT_DIR = "evaluation/workpack-document-editors-v2-2026-07-13";
const SPEC_JSON_PATH = `${ARTIFACT_DIR}/spec.json`;
const SPEC_MARKDOWN_PATH = `${ARTIFACT_DIR}/spec.md`;
const VALIDATOR_PATH = `${ARTIFACT_DIR}/validate-contract.mjs`;
const EVIDENCE_PATH = `${ARTIFACT_DIR}/review-evidence.json`;
const IMPLEMENTATION_BLOCK = "IMPLEMENTATION_BLOCKED_PENDING_EXPLICIT_USER_DB_AUTHORITY_APPROVAL";
const EXPECTED_SHAPE_SHA256 = "sha256:bf551d36e5f393f269b1f99eb24d869c0d8e10f91ca8c4fc0313fc78a4042f1d";
const FULL_SHA = /^[0-9a-f]{40}$/u;
const GIT_BLOB_OID = /^[0-9a-f]{40}$/u;
const TYPED_SHA256 = /^sha256:[0-9a-f]{64}$/u;
const STRICT_RFC3339_UTC = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u;

const CANDIDATE_PATHS = [SPEC_JSON_PATH, SPEC_MARKDOWN_PATH, VALIDATOR_PATH].sort();
const EVIDENCE_PATHS = [EVIDENCE_PATH];
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
const OPEN_MAP_PATHS = new Set([
  "$.documents[].fieldNotes",
  "$.documents[].legacyOverrides"
]);

const OBJECT_KEYS = new Map([
  ["safeclaw_workpack_document_editors_contract", ["kind", "schemaVersion", "meta", "reviewScope", "freshnessPolicy", "schemaClosure", "productContract", "evidenceContract", "photoConfirmation", "markdownContract", "exportContract", "scrollContract", "documents", "authorityGates", "browserMatrix", "validationContract", "integrationLedger"]],
  ["meta", ["kind", "artifact", "contractDate", "branch", "sourceBase", "currentIntegrationTarget", "candidateParent", "status", "implementationStatus", "browserExecutions"]],
  ["review_scope", ["kind", "candidateAllowedPaths", "evidenceAllowedPaths", "targetBlobPaths", "rejectedCandidate", "rejectedEvidence", "ancestryRule", "selfHashRule"]],
  ["freshness_policy", ["kind", "validationTimeArgument", "evidenceMaxAgeSeconds", "ledgerMaxAgeSeconds", "futureSkewSeconds", "validationTimeSystemClockSkewSeconds", "notPerpetual", "regenerationAction"]],
  ["schema_closure", ["kind", "objectGraphSha256", "minimumClosedObjects", "legacyPermissiveObjectsClosed", "unknownKeyPasses", "rootIncluded", "openMapFamilies", "exactKeyOrder", "shapeBypassRule"]],
  ["open_map_family", ["kind", "pathPattern", "keyCodec", "valueCodec", "purpose"]],
  ["product_contract", ["kind", "documentEditorCount", "evidenceDrawerCount", "evidenceDrawerName", "forbiddenDefaultSurfaces", "bodyProvenanceRule", "mobileEarlyStartMaxY", "mobileScrollOwner", "primaryExperience"]],
  ["evidence_contract", ["kind", "reviewStateEnum", "roles", "separationRule", "unknownStateRule"]],
  ["evidence_role", ["kind", "sourceClass", "role", "eligibleReviewStates", "canPrioritizeHazard", "canSupplyControl", "canEstablishMandate", "directEligibility", "obligationClass", "rule"]],
  ["photo_confirmation_contract", ["kind", "status", "states", "eventSchema", "controlDigest", "transitions", "shareGate", "privacyRule", "authorityGateId"]],
  ["photo_event_schema", ["kind", "schemaId", "fields", "eventDigestRule", "unknownKeyRule"]],
  ["photo_field", ["kind", "name", "type", "codec", "requiredOn", "digestCovered"]],
  ["control_digest_contract", ["kind", "digestKind", "codec", "canonicalization", "inputFields", "acceptedControlProjection", "setRule", "orderRule", "revisionRule", "verificationRule"]],
  ["photo_transition", ["kind", "from", "event", "to", "precondition", "confirmationBlocked", "shareBlocked"]],
  ["photo_share_gate", ["kind", "beforeConfirmation", "afterConfirmation", "externalAuthority", "staleEvent", "candidateEvidenceRule"]],
  ["markdown_contract", ["kind", "canonicalSource", "renderer", "comparison", "requiredDerivedSections", "photoTableRule", "driftAttacks"]],
  ["export_contract", ["kind", "hwpxRepresentation", "hwpxBuilder", "hwpxServerRoute", "hwpxManifestRepresentation", "templateRouteRule", "channels", "executionStatus", "browserExecutions"]],
  ["export_channel", ["kind", "id", "representation", "path", "roundTrip"]],
  ["scroll_contract", ["kind", "multilineRule", "desktopMultiline", "mobileMultiline", "editorInternalScrollAllowed", "pageAndEditorDoubleScrollAllowed", "allowedInternalScrollOwner", "mobileEditorStartMaxY", "sectionStrategy", "forbiddenRule"]],
  ["document_editor", ["kind", "id", "key", "title", "component", "primaryAction", "bodyRoot", "provenanceRoot", "fields", "fieldNotes", "legacyOverrides"]],
  ["field", ["kind", "name", "type", "codec", "required", "source", "constraints"]],
  ["field_constraints", ["kind", "minimumItems", "uniqueItems", "allowNull", "humanOnly", "generatedValueForbidden"]],
  ["authority_gate", ["kind", "id", "status", "requiresUserDbApproval", "executableCommands", "blockedCapability", "unblockRule"]],
  ["browser_matrix_contract", ["kind", "status", "zoomPercent", "browserExecutions", "productExecutions", "cases", "futureAssertions"]],
  ["browser_case", ["kind", "id", "browser", "viewport", "zoomPercent", "status"]],
  ["validation_contract", ["kind", "canonicalSpecReviewTokens", "negativeAttacks", "requiredRuns", "implementationMode", "claimBoundary", "browserExecutions"]],
  ["negative_attack", ["kind", "id", "scope", "mutation", "expectedErrorPrefix"]],
  ["integration_ledger", ["kind", "capturedAt", "captureCommand", "authorityRef", "authorityHead", "sourceBase", "currentIntegrationTarget", "candidateBranch", "worktreeWasCleanBeforeEdits", "rejectedReferenceHead", "rejectedReferenceUse", "refreshRequiredAfterSeconds"]],
  ["review_evidence", ["kind", "schemaVersion", "capturedAt", "branch", "candidateCommit", "candidateParent", "sourceBase", "currentIntegrationTarget", "mergeBase", "candidateScope", "evidenceScope", "candidateArtifacts", "targetBlobs", "ledgerCapturedAt", "refSnapshotDigest", "browserExecutions", "productExecutions", "buildExecutions", "exportExecutions", "implementationExecutions", "blockedAuthorities", "unexecutedBrowserMatrix", "validationSummary", "redBaseline"]],
  ["scope_identity", ["kind", "paths"]],
  ["blob_identity", ["kind", "path", "gitBlob", "sha256", "bytes"]],
  ["validation_summary", ["kind", "authoringChecks", "unknownKeyMatrixRuns", "deliberateAttackRuns", "contractAttackCaseCount", "allExitExpectationsMet", "commandLog", "browserExecutions"]],
  ["red_baseline", ["kind", "referenceBranch", "observedExit", "failures", "legacyMatrixObjectCount", "staleYear2000Accepted", "browserExecutions"]]
]);

const PHOTO_EVENT_CODECS = new Map([
  ["eventId", "stableId"],
  ["improvementId", "stableId"],
  ["pairId", "stableId"],
  ["action", "photoReviewAction"],
  ["analysisId", "stableId"],
  ["analysisRevision", "strictPositiveInteger"],
  ["analysisSnapshotDigest", "sha256HexDigest"],
  ["modelProvider", "nonEmptyString"],
  ["modelName", "nonEmptyString"],
  ["modelVersion", "nonEmptyString"],
  ["reviewRevision", "strictPositiveInteger"],
  ["approvedControls", "approvedControlArrayNonEmpty"],
  ["acceptedControlIds", "stableIdArrayNonEmpty"],
  ["controlAcceptanceDigest", "sha256HexDigest"],
  ["beforeImageSha256", "sha256HexDigest"],
  ["afterImageSha256", "nullableSha256HexDigest"],
  ["reviewerId", "stableId"],
  ["reviewerDisplayName", "nonEmptyString"],
  ["occurredAt", "strictRfc3339"],
  ["confirmedAt", "nullableStrictRfc3339"],
  ["rejectedAt", "nullableStrictRfc3339"],
  ["rejectionReason", "nullableNonEmptyString"],
  ["candidateRevision", "strictPositiveInteger"],
  ["resultingRevision", "strictPositiveInteger"],
  ["priorMaterializationDigest", "sha256HexDigest"],
  ["resultingMaterializationDigest", "sha256HexDigest"],
  ["priorEvidenceDigest", "sha256HexDigest"],
  ["resultingEvidenceDigest", "sha256HexDigest"],
  ["resultingGenerationEvidenceDigest", "sha256HexDigest"],
  ["eventDigest", "sha256HexDigest"]
]);

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
  if (scope.rejectedCandidate !== REJECTED_CANDIDATE_SHA || scope.rejectedEvidence !== REJECTED_EVIDENCE_SHA) {
    throw new Error("IDENTITY: rejected v2 identities differ");
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
  if (closure.minimumClosedObjects < 256 || locations.length < closure.minimumClosedObjects) {
    throw new Error(`SCHEMA_CLOSURE: closed objects ${locations.length} is below minimum ${closure.minimumClosedObjects}`);
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
  if (product.forbiddenDefaultSurfaces.length !== 6 || new Set(product.forbiddenDefaultSurfaces).size !== 6) {
    throw new Error("PRODUCT_CONTRACT: forbidden duplicate evidence surfaces differ");
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
    kosha.obligationClass !== "technical_guidance_only"
  ) {
    throw new Error("EVIDENCE_ROLE: KOSHA guidance role differs");
  }
  if (
    !law ||
    law.role !== "mandate" ||
    canonicalJson(law.eligibleReviewStates) !== canonicalJson(["published"]) ||
    law.canEstablishMandate !== true ||
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
    canonicalJson(photo.states) !== canonicalJson(PHOTO_STATES)
  ) {
    throw new Error("PHOTO_STATE: photo authority/state contract differs");
  }
  const schemaFields = photo.eventSchema.fields;
  if (schemaFields.length !== PHOTO_EVENT_CODECS.size) {
    throw new Error("PHOTO_TABLE: canonical photo field table length differs");
  }
  const names = schemaFields.map((field) => field.name);
  if (new Set(names).size !== names.length || canonicalJson(names) !== canonicalJson([...PHOTO_EVENT_CODECS.keys()])) {
    throw new Error("PHOTO_TABLE: canonical photo fields are missing, duplicated, or reordered");
  }
  for (const field of schemaFields) {
    if (field.codec !== PHOTO_EVENT_CODECS.get(field.name)) {
      throw new Error(`PHOTO_TABLE: codec differs for ${field.name}`);
    }
    if (field.digestCovered !== (field.name !== "eventDigest")) {
      throw new Error(`PHOTO_TABLE: digest coverage differs for ${field.name}`);
    }
  }
  const digest = photo.controlDigest;
  if (
    digest.digestKind !== "safeclaw-photo-control-acceptance/v1" ||
    digest.codec !== "sha256:<64 lowercase hexadecimal>" ||
    canonicalJson(digest.inputFields) !== canonicalJson(["kind", "analysisId", "analysisRevision", "reviewRevision", "acceptedControls"])
  ) {
    throw new Error("PHOTO_DIGEST: control digest contract differs");
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

function validateBrowserMatrix(matrix) {
  if (
    matrix.status !== "FUTURE_UNEXECUTED" ||
    matrix.zoomPercent !== 200 ||
    matrix.browserExecutions !== 0 ||
    matrix.productExecutions !== 0 ||
    matrix.cases.length !== 12
  ) {
    throw new Error("BROWSER_MATRIX: future/unexecuted 200-percent matrix differs");
  }
  for (const testCase of matrix.cases) {
    if (testCase.zoomPercent !== 200 || testCase.status !== "FUTURE_UNEXECUTED") {
      throw new Error(`BROWSER_MATRIX: ${testCase.id} improperly claims execution`);
    }
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
  if (new Set(ids).size !== ids.length) throw new Error("VALIDATION_CONTRACT: negative attack IDs must be unique");
  for (const attack of attacks) {
    requireString(attack.expectedErrorPrefix, `negative attack ${attack.id} expectedErrorPrefix`);
  }
}

function validateIntegrationLedger(spec, validationTime) {
  const ledger = spec.integrationLedger;
  if (
    ledger.authorityHead !== BASE_SHA ||
    ledger.sourceBase !== BASE_SHA ||
    ledger.currentIntegrationTarget !== BASE_SHA ||
    ledger.candidateBranch !== BRANCH ||
    ledger.worktreeWasCleanBeforeEdits !== true ||
    ledger.rejectedReferenceHead !== REJECTED_EVIDENCE_SHA ||
    ledger.rejectedReferenceUse !== "READ_ONLY_CONCEPT_REFERENCE_NO_ANCESTRY" ||
    ledger.refreshRequiredAfterSeconds !== spec.freshnessPolicy.ledgerMaxAgeSeconds
  ) {
    throw new Error("IDENTITY: integration ledger differs from frozen target");
  }
  requireFreshTimestamp(
    ledger.capturedAt,
    "integrationLedger.capturedAt",
    validationTime,
    spec.freshnessPolicy.ledgerMaxAgeSeconds,
    spec.freshnessPolicy.futureSkewSeconds
  );
}

function validateContract(spec, validationTime, options = {}) {
  const locations = collectClosedObjectsAndRequireExactKeys(spec);
  validateSchemaClosure(spec, locations, options);
  if (spec.schemaVersion !== "3.0.0") throw new Error("SCHEMA_VERSION: expected 3.0.0");
  const meta = spec.meta;
  if (
    meta.branch !== BRANCH ||
    meta.sourceBase !== BASE_SHA ||
    meta.currentIntegrationTarget !== BASE_SHA ||
    meta.candidateParent !== BASE_SHA ||
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
  validateBrowserMatrix(spec.browserMatrix);
  validateValidationContract(spec.validationContract);
  validateIntegrationLedger(spec, validationTime);
  const fixture = buildValidPhotoConfirmation();
  const confirmation = validatePhotoConfirmation(fixture.event, fixture.context);
  if (
    confirmation.state !== "human_confirmed" ||
    confirmation.confirmationBlocked !== false ||
    confirmation.shareState !== "authority_check_required"
  ) {
    throw new Error("PHOTO_STATE: valid confirmation did not reach human_confirmed");
  }
  return { locations, confirmation };
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
    "# SafeClaw Workpack Document Editors v2 target-ready v3",
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
    `Control digest kind: ${spec.photoConfirmation.controlDigest.digestKind}`,
    "",
    `Control digest codec: ${spec.photoConfirmation.controlDigest.codec}`,
    "",
    `Control digest inputs: ${spec.photoConfirmation.controlDigest.inputFields.join(", ")}`,
    "",
    spec.photoConfirmation.controlDigest.verificationRule,
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
    "",
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

function approvedControl(controlId, text) {
  return {
    controlId,
    controlTextSha256: typedSha256(text),
    approvalState: "approved"
  };
}

function controlDigestInput(event) {
  const controlById = new Map(event.approvedControls.map((control) => [control.controlId, control]));
  return {
    kind: "safeclaw-photo-control-acceptance/v1",
    analysisId: event.analysisId,
    analysisRevision: event.analysisRevision,
    reviewRevision: event.reviewRevision,
    acceptedControls: event.acceptedControlIds.map((controlId) => {
      const control = controlById.get(controlId);
      return { controlId, controlTextSha256: control?.controlTextSha256 };
    })
  };
}

function computeControlAcceptanceDigest(event) {
  return typedSha256(canonicalJson(controlDigestInput(event)));
}

function computePhotoEventDigest(event) {
  const covered = Object.fromEntries(
    [...PHOTO_EVENT_CODECS.keys()]
      .filter((name) => name !== "eventDigest")
      .map((name) => [name, event[name]])
  );
  return typedSha256(canonicalJson(covered));
}

function buildValidPhotoConfirmation() {
  const event = {
    eventId: "event-001",
    improvementId: "improvement-001",
    pairId: "pair-001",
    action: "HUMAN_CONFIRM_IMPROVEMENT",
    analysisId: "analysis-001",
    analysisRevision: 7,
    analysisSnapshotDigest: typedSha256("analysis-snapshot"),
    modelProvider: "provider",
    modelName: "model",
    modelVersion: "version",
    reviewRevision: 11,
    approvedControls: [
      approvedControl("control-a", "Guard the opening"),
      approvedControl("control-b", "Verify the interlock"),
      approvedControl("control-c", "Record inspection")
    ],
    acceptedControlIds: ["control-a", "control-c"],
    controlAcceptanceDigest: "",
    beforeImageSha256: typedSha256("before-image"),
    afterImageSha256: typedSha256("after-image"),
    reviewerId: "reviewer-001",
    reviewerDisplayName: "Reviewer",
    occurredAt: "2026-07-13T23:00:00.000Z",
    confirmedAt: "2026-07-13T23:00:00.000Z",
    rejectedAt: null,
    rejectionReason: null,
    candidateRevision: 4,
    resultingRevision: 5,
    priorMaterializationDigest: typedSha256("prior-materialization"),
    resultingMaterializationDigest: typedSha256("resulting-materialization"),
    priorEvidenceDigest: typedSha256("prior-evidence"),
    resultingEvidenceDigest: typedSha256("resulting-evidence"),
    resultingGenerationEvidenceDigest: typedSha256("resulting-generation-evidence"),
    eventDigest: ""
  };
  event.controlAcceptanceDigest = computeControlAcceptanceDigest(event);
  event.eventDigest = computePhotoEventDigest(event);
  return {
    event,
    context: {
      currentState: "review_required",
      currentAnalysisRevision: 7,
      currentReviewRevision: 11
    }
  };
}

function validatePhotoConfirmation(event, context) {
  requireExactKeys(event, [...PHOTO_EVENT_CODECS.keys()], "photo confirmation event");
  if (context.currentState !== "review_required") {
    throw new Error("PHOTO_STATE: confirmation requires review_required");
  }
  for (const name of ["eventId", "improvementId", "pairId", "analysisId", "modelProvider", "modelName", "modelVersion", "reviewerId", "reviewerDisplayName"]) {
    requireString(event[name], `photo event ${name}`);
  }
  if (event.action !== "HUMAN_CONFIRM_IMPROVEMENT") throw new Error("PHOTO_STATE: action is not human confirmation");
  for (const name of ["analysisRevision", "reviewRevision", "candidateRevision", "resultingRevision"]) {
    requireInteger(event[name], `photo event ${name}`, 1);
  }
  if (event.analysisRevision !== context.currentAnalysisRevision) {
    throw new Error("PHOTO_REVISION: analysisRevision is stale");
  }
  if (event.reviewRevision !== context.currentReviewRevision) {
    throw new Error("PHOTO_REVISION: reviewRevision is stale");
  }
  const approvedControls = requireArray(event.approvedControls, "photo event approvedControls", 1);
  const approvedIds = [];
  for (let index = 0; index < approvedControls.length; index += 1) {
    const control = requireExactKeys(
      approvedControls[index],
      ["controlId", "controlTextSha256", "approvalState"],
      `photo event approvedControls[${index}]`
    );
    requireString(control.controlId, `approvedControls[${index}].controlId`);
    requireTypedSha256(control.controlTextSha256, `approvedControls[${index}].controlTextSha256`);
    if (control.approvalState !== "approved") {
      throw new Error(`PHOTO_CONTROLS: ${control.controlId} is not approved`);
    }
    approvedIds.push(control.controlId);
  }
  if (new Set(approvedIds).size !== approvedIds.length) {
    throw new Error("PHOTO_CONTROLS: approved control IDs must be unique");
  }
  if (!Array.isArray(event.acceptedControlIds) || event.acceptedControlIds.length === 0) {
    throw new Error("PHOTO_CONTROLS: acceptedControlIds must be non-empty");
  }
  const acceptedIds = event.acceptedControlIds;
  acceptedIds.forEach((id, index) => requireString(id, `acceptedControlIds[${index}]`));
  if (new Set(acceptedIds).size !== acceptedIds.length) {
    throw new Error("PHOTO_CONTROLS: acceptedControlIds must be unique");
  }
  for (const id of acceptedIds) {
    if (!approvedIds.includes(id)) throw new Error(`PHOTO_CONTROLS: accepted control ${id} does not resolve to an approved control`);
  }
  const acceptedSet = new Set(acceptedIds);
  const expectedOrder = approvedIds.filter((id) => acceptedSet.has(id));
  if (canonicalJson(expectedOrder) !== canonicalJson(acceptedIds)) {
    throw new Error("PHOTO_CONTROLS: acceptedControlIds order differs from approvedControls");
  }
  requireTypedSha256(event.controlAcceptanceDigest, "controlAcceptanceDigest");
  const expectedControlDigest = computeControlAcceptanceDigest(event);
  if (event.controlAcceptanceDigest !== expectedControlDigest) {
    throw new Error("PHOTO_DIGEST: controlAcceptanceDigest does not bind the exact controls and revisions");
  }
  for (const name of [
    "analysisSnapshotDigest",
    "beforeImageSha256",
    "afterImageSha256",
    "priorMaterializationDigest",
    "resultingMaterializationDigest",
    "priorEvidenceDigest",
    "resultingEvidenceDigest",
    "resultingGenerationEvidenceDigest",
    "eventDigest"
  ]) {
    requireTypedSha256(event[name], name);
  }
  if (event.confirmedAt !== event.occurredAt || event.rejectedAt !== null || event.rejectionReason !== null) {
    throw new Error("PHOTO_STATE: confirmation timestamps/rejection fields differ");
  }
  parseStrictRfc3339(event.occurredAt, "photo event occurredAt");
  if (event.resultingRevision !== event.candidateRevision + 1) {
    throw new Error("PHOTO_REVISION: resultingRevision must equal candidateRevision+1");
  }
  if (event.eventDigest !== computePhotoEventDigest(event)) {
    throw new Error("PHOTO_DIGEST: eventDigest differs");
  }
  return {
    state: "human_confirmed",
    confirmationBlocked: false,
    shareState: "authority_check_required"
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

function buildSyntheticEvidenceManifest(spec, validationTime) {
  const capturedAt = new Date(validationTime).toISOString();
  return {
    kind: "review_evidence",
    schemaVersion: "3.0.0",
    capturedAt,
    branch: BRANCH,
    candidateCommit: BASE_SHA,
    candidateParent: BASE_SHA,
    sourceBase: BASE_SHA,
    currentIntegrationTarget: BASE_SHA,
    mergeBase: BASE_SHA,
    candidateScope: { kind: "scope_identity", paths: CANDIDATE_PATHS },
    evidenceScope: { kind: "scope_identity", paths: EVIDENCE_PATHS },
    candidateArtifacts: [],
    targetBlobs: [],
    ledgerCapturedAt: spec.integrationLedger.capturedAt,
    refSnapshotDigest: typedSha256(canonicalJson(spec.integrationLedger)),
    browserExecutions: 0,
    productExecutions: 0,
    buildExecutions: 0,
    exportExecutions: 0,
    implementationExecutions: 0,
    blockedAuthorities: spec.authorityGates.map((gate) => gate.id),
    unexecutedBrowserMatrix: "FUTURE_UNEXECUTED_200_PERCENT",
    validationSummary: {
      kind: "validation_summary",
      authoringChecks: 2,
      unknownKeyMatrixRuns: 2,
      deliberateAttackRuns: spec.validationContract.negativeAttacks.length * 2,
      contractAttackCaseCount: spec.validationContract.negativeAttacks.length,
      allExitExpectationsMet: true,
      commandLog: ["synthetic fixture for negative validation only"],
      browserExecutions: 0
    },
    redBaseline: {
      kind: "red_baseline",
      referenceBranch: "feat/workpack-document-editors-v2-target-ready-v2",
      observedExit: 1,
      failures: ["RED_EXPECTED"],
      legacyMatrixObjectCount: 255,
      staleYear2000Accepted: true,
      browserExecutions: 0
    }
  };
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
      event.approvedControls[2].approvalState = "candidate";
      event.acceptedControlIds = ["control-a", "control-c"];
      validateEvent();
    } else if (id === "photo-arbitrary-digest-object") {
      event.controlAcceptanceDigest = {};
      validateEvent();
    } else if (id === "photo-arbitrary-digest-string") {
      event.controlAcceptanceDigest = "arbitrary";
      validateEvent();
    } else if (id === "photo-mismatched-set") {
      event.acceptedControlIds = ["control-a"];
      validateEvent();
    } else if (id === "photo-mismatched-order") {
      event.acceptedControlIds = ["control-c", "control-a"];
      event.controlAcceptanceDigest = computeControlAcceptanceDigest(event);
      event.eventDigest = computePhotoEventDigest(event);
      validateEvent();
    } else if (id === "photo-mismatched-hash") {
      event.controlAcceptanceDigest = typedSha256("wrong-control-binding");
      validateEvent();
    } else if (id === "photo-stale-analysis-revision") {
      event.analysisRevision -= 1;
      validateEvent();
    } else if (id === "photo-stale-review-revision") {
      event.reviewRevision -= 1;
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
    } else if (id === "evidence-self-sha") {
      const manifest = buildSyntheticEvidenceManifest(spec, validationTime);
      manifest.selfSha = BASE_SHA;
      collectClosedObjectsAndRequireExactKeys(manifest, "$manifest");
    } else if (id === "candidate-parent-drift") {
      const manifest = buildSyntheticEvidenceManifest(spec, validationTime);
      manifest.candidateParent = REJECTED_CANDIDATE_SHA;
      validateEvidenceManifestShape(manifest, spec, validationTime);
      if (manifest.candidateParent !== BASE_SHA) {
        throw new Error("IDENTITY: manifest candidate parent differs from frozen f45");
      }
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
  if (candidate === REJECTED_CANDIDATE_SHA || candidate === REJECTED_EVIDENCE_SHA) {
    throw new Error("IDENTITY: rejected v2 commit cannot be the candidate");
  }
  if (commitParent(root, candidate) !== sourceBase || sourceBase !== BASE_SHA || target !== BASE_SHA) {
    throw new Error("IDENTITY: candidate is not a direct child of frozen f45");
  }
  if (gitText(root, ["merge-base", candidate, target]) !== sourceBase) {
    throw new Error("IDENTITY: candidate/target merge-base differs");
  }
  if (isAncestor(root, REJECTED_CANDIDATE_SHA, candidate) || isAncestor(root, REJECTED_EVIDENCE_SHA, candidate)) {
    throw new Error("IDENTITY: rejected v2 appears in candidate ancestry");
  }
  if (canonicalJson(commitPaths(root, candidate)) !== canonicalJson(CANDIDATE_PATHS)) {
    throw new Error("SCOPE: candidate commit scope differs");
  }
  if (
    spec.meta.sourceBase !== sourceBase ||
    spec.meta.currentIntegrationTarget !== target ||
    spec.meta.candidateParent !== sourceBase
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

function validateEvidenceManifestShape(manifest, spec, validationTime) {
  collectClosedObjectsAndRequireExactKeys(manifest, "$manifest");
  if (manifest.schemaVersion !== "3.0.0" || manifest.branch !== BRANCH) {
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
    manifest.browserExecutions !== 0 ||
    manifest.productExecutions !== 0 ||
    manifest.buildExecutions !== 0 ||
    manifest.exportExecutions !== 0 ||
    manifest.implementationExecutions !== 0
  ) {
    throw new Error("EXECUTION_CLAIM: product/build/export/browser/implementation executions must remain zero");
  }
  if (manifest.unexecutedBrowserMatrix !== "FUTURE_UNEXECUTED_200_PERCENT") {
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
  if (
    manifest.validationSummary.authoringChecks < 2 ||
    manifest.validationSummary.unknownKeyMatrixRuns < 2 ||
    manifest.validationSummary.deliberateAttackRuns < spec.validationContract.negativeAttacks.length * 2 ||
    manifest.validationSummary.contractAttackCaseCount !== spec.validationContract.negativeAttacks.length ||
    manifest.validationSummary.allExitExpectationsMet !== true ||
    manifest.validationSummary.browserExecutions !== 0
  ) {
    throw new Error("VALIDATION_EVIDENCE: candidate validation summary is incomplete");
  }
  if (
    manifest.redBaseline.referenceBranch !== "feat/workpack-document-editors-v2-target-ready-v2" ||
    manifest.redBaseline.observedExit !== 1 ||
    manifest.redBaseline.legacyMatrixObjectCount !== 255 ||
    manifest.redBaseline.staleYear2000Accepted !== true ||
    manifest.redBaseline.browserExecutions !== 0
  ) {
    throw new Error("VALIDATION_EVIDENCE: RED baseline differs");
  }
}

function validateReviewPair(root, args, validationTime, deliberate = "") {
  const evidence = resolveCommit(root, args.evidence, "evidence");
  const candidate = resolveCommit(root, args.candidate, "candidate");
  const sourceBase = resolveCommit(root, args.sourceBase, "source-base");
  const target = resolveCommit(root, args.target, "target");
  const manifestBuffer = readBlob(root, evidence, args.manifest);
  const manifest = parseJsonBuffer(manifestBuffer, "review-evidence.json");
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
        mutated.candidateParent = REJECTED_CANDIDATE_SHA;
        validateEvidenceManifestShape(mutated, spec, validationTime);
        if (mutated.candidateParent !== sourceBase) throw new Error("IDENTITY: manifest candidate parent differs");
      }
    });
  }
  if (deliberate) runContractAttack(spec, markdown, deliberate, validationTime);

  validateEvidenceManifestShape(manifest, spec, validationTime);
  if (
    manifest.candidateCommit !== candidate ||
    manifest.candidateParent !== sourceBase ||
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
  if (isAncestor(root, REJECTED_CANDIDATE_SHA, evidence) || isAncestor(root, REJECTED_EVIDENCE_SHA, evidence)) {
    throw new Error("IDENTITY: rejected v2 appears in evidence ancestry");
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
    if (args.mode === "attack-check") {
      if (!args.deliberate) throw new Error("attack-check requires --deliberate");
      runContractAttack(spec, markdown, args.deliberate, validationTime);
      return;
    }
    const result = validateContract(spec, validationTime);
    validateMarkdown(spec, markdown);
    if (args.mode === "object-census") {
      console.log(`CLOSED_OBJECTS=${result.locations.length}`);
      console.log("ROOT_INCLUDED=true");
      console.log(`OPEN_MAP_FAMILIES=${OPEN_MAP_PATHS.size}`);
      console.log(`OBJECT_GRAPH_SHA256=${objectGraphSha256(spec)}`);
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
    console.log("FRESHNESS_POLICY=PASS");
    console.log("BROWSER_EXECUTIONS=0");
    console.log("PRODUCT_BUILD_EXPORT_EXECUTIONS=0");
    console.log(IMPLEMENTATION_BLOCK);
    return;
  }
  if (args.mode === "candidate-review") {
    const candidate = resolveCommit(root, args.candidate, "candidate");
    const sourceBase = resolveCommit(root, args.sourceBase, "source-base");
    const target = resolveCommit(root, args.target, "target");
    const spec = parseJsonBuffer(readBlob(root, candidate, SPEC_JSON_PATH), "candidate spec.json");
    const markdown = readBlob(root, candidate, SPEC_MARKDOWN_PATH).toString("utf8");
    const validationTime = resolveValidationTime(args.validationTime, spec.freshnessPolicy);
    const result = validateContract(spec, validationTime);
    validateMarkdown(spec, markdown);
    validateCandidateIdentity(root, candidate, sourceBase, target, spec);
    console.log("CANDIDATE_REVIEW=PASS");
    console.log(`CLOSED_OBJECTS=${result.locations.length}`);
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
    const result = validateReviewPair(root, args, validationTime, args.deliberate);
    console.log("CANONICAL_SPEC_REVIEW=PASS");
    console.log(`CANDIDATE=${result.candidate}`);
    console.log(`EVIDENCE=${result.evidence}`);
    console.log(`PARENT_CHAIN=${result.evidence}->${result.candidate}->${result.sourceBase}`);
    console.log("CANDIDATE_SCOPE=PASS");
    console.log("EVIDENCE_SCOPE=PASS");
    console.log("BLOB_OID_SHA256_BYTES=PASS");
    console.log("MARKDOWN_JSON_SEMANTIC_PARITY=PASS");
    console.log("FRESHNESS_POLICY=PASS");
    console.log("BROWSER_EXECUTIONS=0");
    console.log("PRODUCT_BUILD_EXPORT_EXECUTIONS=0");
    console.log(IMPLEMENTATION_BLOCK);
    return;
  }
  throw new Error("Mode must be shape-fingerprint, render-markdown, write-markdown, authoring-check, object-census, unknown-key-matrix, attack-check, candidate-review, spec-review, or implementation");
}

try {
  main();
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`CONTRACT_ERROR: ${message}`);
  process.exitCode = 1;
}
