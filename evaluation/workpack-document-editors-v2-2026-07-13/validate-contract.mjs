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
  "source-shape",
  "target-ref",
  "spec-ref",
  "implementation-empty"
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

function expandDocumentFields(spec, document) {
  const bound = document.typeBindings.flatMap((binding) => {
    const registered = spec.common.typeRegistry[binding.type];
    if (!registered) throw new Error(`Unknown type binding ${binding.type} in ${document.id}`);
    return registered.fields.map((field) => {
      const expanded = [`${binding.prefix}.${field[0]}`, ...field.slice(1)];
      if (Object.hasOwn(binding.currentOverrides, field[0])) expanded[4] = binding.currentOverrides[field[0]];
      return expanded;
    });
  });
  return [...bound, ...document.fields];
}

function renderTable(lines, heading, headers, rows) {
  lines.push(`### ${heading}`, "");
  lines.push(`| ${headers.join(" | ")} |`);
  lines.push(`| ${headers.map(() => "---").join(" | ")} |`);
  for (const row of rows) lines.push(`| ${row.map(escapeCell).join(" | ")} |`);
  lines.push("");
}

function renderNormativeMarkdown(spec) {
  const lines = ["<!-- SAFECLAW-NORMATIVE:BEGIN -->", ""];
  renderTable(lines, "Contract And Review Gates", ["Key", "Normative value"], [
    ["schemaVersion", spec.schemaVersion],
    ["status", spec.meta.status],
    ["implementationProgramStatus", spec.meta.implementationProgramStatus],
    ["sourceBase", spec.meta.sourceBase],
    ["currentIntegrationTarget", spec.meta.currentIntegrationTarget],
    ["remediationParent", spec.meta.remediationParent],
    ["reviewScope", spec.meta.reviewScope],
    ["canonicalRule", spec.meta.canonicalRule],
    ["independentGate", spec.independentGate],
    ["validation", spec.validation]
  ]);
  renderTable(lines, "Registry And Source Contract", ["Key", "Normative value"], [
    ["contractIds", spec.contractIds],
    ["acceptance", spec.implementation.acceptance],
    ["tupleSchemas", spec.tupleSchemas],
    ["sourceSeams", spec.sourceSeams],
    ["common.projection", spec.common.projection],
    ["common.codecs", spec.common.codecs],
    ["common.typeRegistry", spec.common.typeRegistry],
    ["common.rawProvenance", spec.common.rawProvenance]
  ]);
  renderTable(
    lines,
    "Twelve Document Schemas",
    ["ID", "Key", "Title", "Type", "Component", "Family", "Expanded fields", "Field notes", "Interactions", "Gates", "Schema order"],
    spec.documents.map((document) => [
      document.id,
      document.key,
      document.title,
      document.type,
      document.component,
      document.family,
      expandDocumentFields(spec, document),
      document.fieldNotes,
      document.interactions,
      document.gates,
      document.schemaOrder
    ])
  );
  renderTable(lines, "Workflow And Authority", ["Key", "Normative value"], [
    ["workflow.reviewStates", spec.workflow.reviewStates],
    ["workflow.transitions", spec.workflow.transitions],
    ["workflow.forbiddenTransitions", spec.workflow.forbiddenTransitions],
    ["workflow.effects", spec.workflow.effects],
    ["workflow.revalidation", spec.workflow.revalidation],
    ["workflow.save", spec.workflow.save],
    ["workflow.share", spec.workflow.share],
    ["workflow.commands", spec.workflow.commands],
    ["workflow.disclaimer", spec.workflow.disclaimer],
    ["persistence.envelopeFields", spec.persistence.envelopeFields],
    ["persistence.digestDefinitions", spec.persistence.digestDefinitions],
    ["persistence.topLevelSeal", spec.persistence.topLevelSeal],
    ["persistence.serverRevisionAuthority", spec.persistence.serverRevisionAuthority],
    ["persistence.photo", spec.persistence.photo],
    ["evidencePresentation", spec.evidencePresentation]
  ]);
  renderTable(lines, "Components And Export Seams", ["Key", "Normative value"], [
    ["components", spec.components],
    ["export.semanticDeterminism", spec.export.semanticDeterminism],
    ["export.manifest", spec.export.manifest],
    ["export.roundTripDefinition", spec.export.roundTripDefinition],
    ["export.roundTripOwner", spec.export.roundTripOwner],
    ["export.pureCodecLimit", spec.export.pureCodecLimit],
    ["export.actualRoutes", spec.export.actualRoutes],
    ["export.excludedTargetSeam", spec.export.excludedTargetSeam],
    ["export.unknownFieldPolicy", spec.export.unknownFieldPolicy]
  ]);
  renderTable(
    lines,
    "Target Export Call Sites",
    ["ID", "Kind", "Client path", "Client symbol", "Server path", "Server symbol", "URL", "Target contract"],
    spec.export.actualSeamsAtTarget.map((seam) => [
      seam.id,
      seam.kind,
      seam.clientPath,
      seam.clientSymbol,
      seam.serverPath,
      seam.serverSymbol,
      seam.url,
      seam.targetContract
    ])
  );
  renderTable(
    lines,
    "Implementation Waves",
    ["Wave", "Status", "Owner", "Documents", "Entry gate", "Owned files", "Read-only dependencies", "Test files", "Commands", "TDD gates", "Browser assertions", "Exit gate", "Rollback"],
    spec.implementation.waves.map((wave) => [
      wave.id,
      wave.status,
      wave.owner,
      wave.documents,
      wave.entryGate,
      wave.ownedFiles,
      wave.readOnlyDependencies,
      wave.testFiles,
      wave.commands,
      wave.tddGates,
      wave.browserAssertions,
      wave.exitGate,
      wave.rollback
    ])
  );
  renderTable(lines, "Implementation And Browser Contract", ["Key", "Normative value"], [
    ["implementation.programStatus", spec.implementation.programStatus],
    ["implementation.startGate", spec.implementation.startGate],
    ["implementation.codecFixtureMatrix", spec.implementation.codecFixtureMatrix],
    ["implementation.fileOwnership", spec.implementation.fileOwnership],
    ["implementation.viewports", spec.implementation.viewports],
    ["implementation.browserMatrix", spec.implementation.browserMatrix],
    ["ui.core", {
      direction: spec.ui.direction,
      layout: spec.ui.layout,
      mobileScroll: spec.ui.mobileScroll,
      typography: spec.ui.typography,
      warning: spec.ui.warning,
      actions: spec.ui.actions,
      states: spec.ui.states,
      accessibility: spec.ui.accessibility,
      invariant: spec.ui.invariant
    }],
    ["ui.taskDistanceBudgets", spec.ui.taskDistanceBudgets],
    ["ui.textZoom200", spec.ui.textZoom200],
    ["ui.browserAssertions", spec.ui.browserAssertions]
  ]);
  renderTable(
    lines,
    "Timestamped Conflict Snapshot",
    ["ID", "Local ref/head", "Remote ref/head", "Review/worktree state", "Dirty paths", "Exact overlap hunks", "Decision"],
    spec.integrationLedger.heads.map((head) => [
      head.id,
      [head.localRef, head.localHead],
      [head.remoteRef ?? null, head.remoteHead ?? null],
      [head.reviewState ?? null, head.worktreeState],
      head.dirtyPaths ?? [],
      head.overlapHunks ?? head.productHunks ?? [],
      head.decision
    ])
  );
  renderTable(lines, "Snapshot Rules", ["Key", "Normative value"], [
    ["snapshotId", spec.integrationLedger.snapshotId],
    ["capturedAt", spec.integrationLedger.capturedAt],
    ["binding", spec.integrationLedger.binding],
    ["freshRecheck", spec.integrationLedger.freshRecheck],
    ["integrationOrder", spec.integrationLedger.integrationOrder],
    ["rules", spec.integrationLedger.rules],
    ["humanParityContract", spec.humanParityContract]
  ]);
  lines.push("<!-- SAFECLAW-NORMATIVE:END -->");
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

function validateNormativeParity(spec, markdown) {
  const expected = renderNormativeMarkdown(spec);
  const actual = extractMarkedBlock(
    markdown,
    spec.humanParityContract.markdownStart,
    spec.humanParityContract.markdownEnd
  );
  if (actual !== expected) throw new Error("candidate Markdown normative tables differ from canonical spec.json");
  for (const stale of [
    "SAFECLAW-CONTRACT-MIRROR",
    "HOLD_PENDING_INDEPENDENT_PASS",
    "CURRENT_EXECUTABLE_CANONICAL_PARITY"
  ]) {
    if (markdown.includes(stale)) throw new Error(`candidate Markdown retains stale contract marker: ${stale}`);
  }
}

function validateInternalContract(spec) {
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
    "beforeDigest",
    "afterDigest",
    "candidateRevision",
    "resultingRevision",
    "canonicalEventDigest",
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
    "applicationCount=1",
    "1.9..2.1",
    "overflow-y:hidden",
    "all 144"
  ]) {
    if (!zoomText.includes(token)) throw new Error(`200% browser contract omits ${token}`);
  }
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
  const markdown = markdownBuffer.toString("utf8");
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

  const paritySpec = args.deliberate === "normative-parity" ? structuredClone(spec) : spec;
  if (args.deliberate === "normative-parity") paritySpec.meta.status = "__deliberate_normative_mismatch__";
  validateNormativeParity(paritySpec, markdown);
  validateInternalContract(spec);

  const targetBlobs = loadAndValidateTargetBlobs(root, manifest, target, spec);
  if (args.deliberate === "source-shape") {
    const path = "components/WorkpackEditor.tsx";
    targetBlobs.set(path, targetBlobs.get(path).replace("async function downloadHwp()", "async function __deliberatelyBrokenHwp()"));
  }
  validateTargetSourceShapes(targetBlobs, spec);

  console.log("SPEC_JSON_PARSE=PASS");
  console.log("HUMAN_NORMATIVE_PARITY=PASS");
  console.log("CANDIDATE_COMMIT_SCOPE=PASS");
  console.log("EVIDENCE_ONLY_COMMIT_SCOPE=PASS");
  console.log("TARGET_BLOB_BINDING=PASS");
  console.log("TARGET_SOURCE_SHAPE=PASS");
  console.log("CONTRACT_INTERNAL_CONSISTENCY=PASS");
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
  if (manifest.approvals?.independentSpecPass?.approved !== true || manifest.approvals?.userDbApproval?.approved !== true) {
    throw new Error("implementation manifest lacks independent spec PASS and explicit user DB approval");
  }
  const spec = parseJsonBuffer(readBlob(root, specCommit, SPEC_JSON_PATH), "immutable implementation spec");
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
    validateBoundBlob(root, head, record, `implementation artifact ${record.path}`);
  }
  if (!Array.isArray(manifest.executedCommands) || manifest.executedCommands.length === 0) {
    throw new Error("implementation manifest has no executed commands");
  }
  const executedCommandIds = new Set();
  for (const command of manifest.executedCommands) {
    if (typeof command.id !== "string" || command.id.length === 0 || executedCommandIds.has(command.id)) {
      throw new Error("implementation command IDs must be non-empty and unique");
    }
    executedCommandIds.add(command.id);
    if (
      typeof command.command !== "string" ||
      command.command.length === 0 ||
      typeof command.executedAt !== "string" ||
      !Number.isFinite(Date.parse(command.executedAt)) ||
      command.exitCode !== 0 ||
      !FULL_SHA.test(command.outputSha256?.replace(/^sha256:/u, "") ?? "")
    ) {
      throw new Error(`implementation command lacks successful immutable evidence: ${command.id ?? "unknown"}`);
    }
  }
  console.log("IMPLEMENTATION_REFS=PASS");
  console.log("IMPLEMENTATION_ARTIFACT_SCOPE=PASS");
  console.log("IMPLEMENTATION_EXECUTED_COMMANDS=PASS");
  if (manifest.claimedGates?.includes("ZOOM-001")) {
    const baselineRecord = manifest.browserEvidence?.baselineManifest;
    const zoomRecord = manifest.browserEvidence?.zoomManifest;
    if (!executedCommandIds.has(baselineRecord?.commandId) || !executedCommandIds.has(zoomRecord?.commandId)) {
      throw new Error("implementation 200% manifests are not bound to successful executed commands");
    }
    const baselineDocument = parseJsonBuffer(
      validateBoundBlob(root, evidence, baselineRecord, "implementation 100% baseline manifest"),
      "implementation 100% baseline manifest"
    );
    const zoomDocument = parseJsonBuffer(
      validateBoundBlob(root, evidence, zoomRecord, "implementation 200% result manifest"),
      "implementation 200% result manifest"
    );
    const baseline = baselineDocument.cases;
    const results = zoomDocument.cases;
    if (!Array.isArray(baseline) || !Array.isArray(results) || baseline.length !== 144 || results.length !== 144) {
      throw new Error("implementation 200% evidence does not contain 144 immutable baseline/result cases");
    }
    const baselineIds = baseline.map((item) => item.fixtureId).sort();
    const resultIds = results.map((item) => item.fixtureId).sort();
    if (new Set(baselineIds).size !== 144 || canonicalJson(baselineIds) !== canonicalJson(resultIds)) {
      throw new Error("implementation 100% and 200% fixture IDs are not the same complete 144-case matrix");
    }
    if (baseline.some((item) => item.deviceScaleFactor !== 1 || item.pass !== true)) {
      throw new Error("implementation 100% baseline contains a failed or non-unit-scale case");
    }
    if (results.some((item) => item.applicationCount !== 1 || item.deviceScaleFactor !== 1 || item.pass !== true)) {
      throw new Error("implementation 200% evidence contains a failed or multiply-applied case");
    }
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
  if (args.mode === "spec-review") {
    validateSpecReview(args);
    return;
  }
  if (args.mode === "implementation") {
    validateImplementation(args);
    return;
  }
  throw new Error("Mode must be render-normative, spec-review, or implementation");
}

try {
  main();
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`CONTRACT_ERROR: ${message}`);
  process.exitCode = 1;
}
