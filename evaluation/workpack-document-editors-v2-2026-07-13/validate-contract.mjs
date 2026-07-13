import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { basename, join, resolve } from "node:path";

const SPEC_DIRECTORY = "evaluation/workpack-document-editors-v2-2026-07-13";
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
const EXPECTED_EXPORT_ROUTES = [
  ["EXPORT-XLSX", "POST", "app/api/export/xlsx/route.ts"],
  ["EXPORT-PDF", "POST", "app/api/export/pdf/route.ts"],
  ["EXPORT-HWP", "POST", "app/api/export/hwp/route.ts"],
  ["EXPORT-HWPX", "GET", "app/api/export/hwpx-template/route.ts"]
];
const EXPECTED_RAW_KINDS = [
  "safety_reference_item",
  "ontology_law",
  "ontology_sif",
  "ontology_kosha_guidance",
  "photo_candidate",
  "field_record"
];
const EXPECTED_ALLOWED_PATHS = [
  `${SPEC_DIRECTORY}/spec.md`,
  `${SPEC_DIRECTORY}/spec.json`,
  `${SPEC_DIRECTORY}/validate-contract.mjs`
];

function parseArguments(argv) {
  const result = {
    root: process.cwd(),
    range: null,
    skipRange: false,
    selfTest: false,
    deliberateMismatch: false,
    printMirror: false
  };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--root") result.root = argv[++index];
    else if (argument === "--range") result.range = argv[++index];
    else if (argument === "--skip-range") result.skipRange = true;
    else if (argument === "--self-test") result.selfTest = true;
    else if (argument === "--deliberate-mismatch") result.deliberateMismatch = true;
    else if (argument === "--print-mirror") result.printMirror = true;
    else throw new Error(`Unknown argument: ${argument}`);
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

function digest(value) {
  return createHash("sha256").update(canonicalJson(value), "utf8").digest("hex");
}

function runGit(root, args) {
  return execFileSync("git", args, {
    cwd: root,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"]
  }).trim();
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

function buildProjection(spec) {
  return {
    schemaVersion: spec.schemaVersion,
    provenance: {
      sourceBase: spec.meta.sourceBase,
      currentIntegrationTarget: spec.meta.currentIntegrationTarget,
      remediationParent: spec.meta.remediationParent,
      reviewRange: spec.meta.reviewRange
    },
    status: spec.meta.status,
    contractIds: spec.contractIds,
    documents: spec.documents.map((document) => {
      const fields = expandDocumentFields(spec, document);
      return {
        id: document.id,
        key: document.key,
        title: document.title,
        type: document.type,
        component: document.component,
        fieldCount: fields.length,
        fieldsSha256: digest(fields)
      };
    }),
    codecs: Object.keys(spec.common.codecs).sort(),
    rawProvenance: spec.common.rawProvenance.union.map((member) => ({
      kind: member.kind,
      sourceType: member.sourceType,
      required: member.required
    })),
    waves: spec.implementation.waves.map((wave) => ({
      id: wave.id,
      owner: wave.owner,
      documents: wave.documents,
      writeSetSha256: digest([...wave.ownedFiles, ...wave.testFiles]),
      ownedFileCount: wave.ownedFiles.length,
      testFileCount: wave.testFiles.length
    })),
    componentFileMap: spec.components.fileMap,
    codecFixtures: {
      targets: spec.implementation.codecFixtureMatrix.targets,
      rows: spec.implementation.codecFixtureMatrix.rows
    },
    exportRoutes: spec.export.actualRoutes.map(({ id, method, path }) => ({ id, method, path })),
    viewports: spec.implementation.viewports.map(({ id, width, height, requiredThemes }) => ({
      id,
      width,
      height,
      requiredThemes
    })),
    browserAssertions: spec.ui.browserAssertions.map((assertion) => assertion[0]),
    tasks: spec.ui.taskDistanceBudgets.tasks.map((task) => task[0])
  };
}

function parseMarkdownMirror(markdown) {
  const start = "<!-- SAFECLAW-CONTRACT-MIRROR:BEGIN -->";
  const end = "<!-- SAFECLAW-CONTRACT-MIRROR:END -->";
  const startIndex = markdown.indexOf(start);
  const endIndex = markdown.indexOf(end);
  if (startIndex < 0 || endIndex <= startIndex) throw new Error("Markdown contract mirror markers are missing or out of order");
  const block = markdown.slice(startIndex + start.length, endIndex).trim();
  const json = block.replace(/^```json\s*/u, "").replace(/\s*```$/u, "");
  return JSON.parse(json);
}

function collectValidationErrors(spec, markdown, root, range, options = {}) {
  const errors = [];
  const fail = (condition, message) => {
    if (!condition) errors.push(message);
  };
  const expectedRange = `${spec.meta.sourceBase}...HEAD`;
  const mirror = parseMarkdownMirror(markdown);
  const projection = buildProjection(spec);
  const jsonText = readFileSync(join(root, SPEC_DIRECTORY, "spec.json"), "utf8");
  const validatorText = readFileSync(join(root, SPEC_DIRECTORY, "validate-contract.mjs"), "utf8");
  const markdownLines = markdown.split("\n").length - 1;
  const jsonLines = jsonText.split("\n").length - 1;

  fail(spec.meta.status === "HOLD_PENDING_INDEPENDENT_PASS", "status must remain HOLD_PENDING_INDEPENDENT_PASS");
  fail(spec.independentGate.holdState === spec.meta.status, "independent hold state differs from meta status");
  fail(spec.meta.reviewRange.expression === expectedRange, "reviewRange must be sourceBase...HEAD");
  fail(spec.meta.reviewRange.mode === "triple-dot-from-verified-merge-base", "reviewRange mode is not triple-dot");
  fail(spec.meta.reviewRange.forbidTwoDot === true, "two-dot ranges are not explicitly forbidden");
  fail(spec.meta.reviewRange.mergeBase === spec.meta.sourceBase, "reviewRange mergeBase differs from sourceBase");
  fail(canonicalJson(spec.meta.reviewRange.allowedPaths) === canonicalJson(EXPECTED_ALLOWED_PATHS), "reviewRange allowed paths differ from the three evaluation artifacts");
  fail(canonicalJson(spec.meta.allowedFiles) === canonicalJson(EXPECTED_ALLOWED_PATHS), "artifact allowlist differs from the three evaluation artifacts");
  fail(range === expectedRange, `validator range must be exactly ${expectedRange}`);
  fail(markdownLines >= spec.meta.lineBudgets.markdown[0] && markdownLines <= spec.meta.lineBudgets.markdown[1], `Markdown line count ${markdownLines} is outside its budget`);
  fail(jsonLines >= spec.meta.lineBudgets.json[0] && jsonLines <= spec.meta.lineBudgets.json[1], `JSON line count ${jsonLines} is outside its budget`);
  fail(!markdown.includes("\r") && !jsonText.includes("\r") && !validatorText.includes("\r"), "evaluation artifacts must preserve LF line endings");
  fail(mirror.canonicalJsonSha256 === digest(spec), "Markdown canonical JSON SHA-256 differs from normative spec.json");
  fail(canonicalJson(mirror.projection) === canonicalJson(projection), "Markdown projected machine mirror differs from normative spec.json");

  const acceptanceIds = spec.implementation.acceptance.map((entry) => entry[0]);
  fail(canonicalJson(acceptanceIds) === canonicalJson(spec.contractIds), "acceptance IDs differ from contractIds or order");
  for (const id of spec.contractIds) fail(markdown.includes(`\`${id}\``), `Markdown is missing contract marker ${id}`);

  fail(spec.documents.length === 12, "document registry does not contain 12 entries");
  fail(canonicalJson(spec.documents.map((document) => document.key)) === canonicalJson(DOCUMENT_KEYS), "document key order differs from the exact 12-key contract");
  fail(new Set(spec.documents.map((document) => document.id)).size === 12, "document IDs are not unique");
  fail(new Set(spec.documents.map((document) => document.component)).size === 12, "document component names are not unique");

  const codecs = new Set(Object.keys(spec.common.codecs));
  const allFields = [
    ...Object.values(spec.common.typeRegistry).flatMap((registered) => registered.fields),
    ...spec.documents.flatMap((document) => document.fields)
  ];
  for (const field of allFields) {
    fail(codecs.has(field[3]), `field ${field[0]} references unknown codec ${field[3]}`);
    if (String(field[1]).includes("|null")) fail(String(field[3]).startsWith("nullable"), `nullable field ${field[0]} uses non-nullable codec ${field[3]}`);
    if (field[2] === "zero or more" && String(field[3]).startsWith("stableIdArray")) {
      fail(field[3] === "stableIdArrayAllowEmpty", `zero-or-more ID array ${field[0]} is not allow-empty`);
    }
    if (String(field[2]).includes("at least one") && String(field[3]).startsWith("stableIdArray")) {
      fail(field[3] === "stableIdArrayNonEmpty", `required ID array ${field[0]} is not strict non-empty`);
    }
  }

  const rawKinds = spec.common.rawProvenance.union.map((member) => member.kind);
  fail(canonicalJson(rawKinds) === canonicalJson(EXPECTED_RAW_KINDS), "raw provenance discriminators differ");
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
  ]) fail(rawText.includes(field), `raw provenance contract omits ${field}`);
  const evidenceFields = spec.common.typeRegistry.EditorEvidenceRef.fields;
  fail(evidenceFields.some((field) => field[0] === "raw" && field[3] === "losslessDiscriminatedEvidence"), "EditorEvidenceRef lacks the raw lossless union");
  fail(evidenceFields.some((field) => field[0] === "display.resolution" && String(field[1]).includes("null")), "non-ontology nullable resolution is absent");
  fail(!rawText.includes('"reviewed"'), "raw provenance contract contains reviewed boolean");

  const writeOwners = new Map();
  for (const wave of spec.implementation.waves) {
    fail(typeof wave.owner === "string" && wave.owner.length > 0, `${wave.id} lacks an owner`);
    for (const file of [...wave.ownedFiles, ...wave.testFiles]) {
      if (writeOwners.has(file)) errors.push(`${file} is write-owned by both ${writeOwners.get(file)} and ${wave.id}`);
      else writeOwners.set(file, wave.id);
    }
  }
  const mappedSymbols = spec.components.fileMap.map(([symbol]) => symbol);
  const mappedFiles = spec.components.fileMap.map(([, file]) => file);
  fail(new Set(mappedSymbols).size === mappedSymbols.length, "component/type file map contains duplicate symbols");
  fail(new Set(mappedFiles).size === mappedFiles.length, "component/type file map contains duplicate paths");
  for (const primitive of spec.components.primitives) {
    fail(mappedSymbols.includes(primitive), `shared primitive ${primitive} lacks an exact file and wave owner`);
  }
  for (const [symbol, file, owner] of spec.components.fileMap) {
    fail(writeOwners.get(file) === owner, `${symbol} file ${file} is not owned by ${owner}`);
  }
  for (const document of spec.documents) {
    const expectedOwner = DOCUMENT_WAVES.get(document.key);
    const file = `components/workpack-editor/${document.component}.tsx`;
    fail(writeOwners.get(file) === expectedOwner, `${document.component} is not uniquely owned by ${expectedOwner}`);
    fail(basename(file, ".tsx") === document.component, `${document.component} file basename mismatch`);
  }
  for (const blocked of spec.implementation.fileOwnership.blockedOwners) {
    for (const file of blocked.paths) fail(!writeOwners.has(file), `blocked path ${file} is owned by executable ${writeOwners.get(file)}`);
  }
  fail(canonicalJson(spec.implementation.waves.find((wave) => wave.id === "wave1").documents) === canonicalJson(["riskAssessmentDraft", "tbmBriefing", "tbmLogDraft"]), "Wave 1 core document scope differs");

  const fixtureRows = spec.implementation.codecFixtureMatrix.rows;
  fail(fixtureRows.length === 12, "codec fixture matrix does not contain 12 rows");
  fail(canonicalJson(fixtureRows.map((row) => row[1])) === canonicalJson(DOCUMENT_KEYS), "codec fixture rows differ from document order");
  for (const row of fixtureRows) {
    for (const caseId of ["missing", "empty", "null", "optional", "unknown", "legacy", "export"]) {
      fail(row[2].split("|").includes(caseId), `${row[0]} omits codec case ${caseId}`);
    }
  }
  fail(canonicalJson(spec.implementation.codecFixtureMatrix.targets) === canonicalJson(["reload", "EXPORT-XLSX", "EXPORT-PDF", "EXPORT-HWP", "EXPORT-HWPX"]), "codec export targets differ");
  fail(canonicalJson(spec.export.actualRoutes.map(({ id, method, path }) => [id, method, path])) === canonicalJson(EXPECTED_EXPORT_ROUTES), "actual export route matrix differs");
  for (const route of spec.export.actualRoutes) fail(readFileSync(join(root, route.path), "utf8").includes(`export async function ${route.method}`), `${route.path} does not export ${route.method}`);

  const viewportIds = spec.implementation.viewports.map((viewport) => viewport.id);
  fail(viewportIds.includes("desktop1440") && viewportIds.includes("auditMobile391"), "required task-distance viewports are missing");
  fail(spec.ui.browserAssertions.length === 23, "browser assertion count must be 23");
  fail(spec.ui.taskDistanceBudgets.tasks.length === 6, "task-distance assertion count must be 6");
  fail(!canonicalJson(spec).includes("visually stronger") && !canonicalJson(spec).includes("semantic hierarchy match"), "subjective browser assertion language remains");

  const workpackEditor = readFileSync(join(root, "components/WorkpackEditor.tsx"), "utf8");
  const keyMatch = workpackEditor.match(/export type DocumentKey =([\s\S]*?);/u);
  fail(Boolean(keyMatch), "cannot extract production DocumentKey");
  if (keyMatch) {
    const productionKeys = [...keyMatch[1].matchAll(/"([^"]+)"/gu)].map((match) => match[1]);
    fail(canonicalJson(productionKeys) === canonicalJson(DOCUMENT_KEYS), "production DocumentKey differs from normative registry");
  }
  const metaMatch = workpackEditor.match(/const documentMeta: EditableDocument\[\] = \[([\s\S]*?)\n\];/u);
  fail(Boolean(metaMatch), "cannot extract production documentMeta");
  if (metaMatch) {
    const productionDocuments = [...metaMatch[1].matchAll(/key: "([^"]+)"[\s\S]*?title: "([^"]+)"/gu)].map((match) => [match[1], match[2]]);
    const normativeDocuments = spec.documents.map((document) => [document.key, document.title]);
    fail(canonicalJson(productionDocuments) === canonicalJson(normativeDocuments), "production documentMeta differs from normative registry");
  }
  const riskSource = readFileSync(join(root, "lib/risk-assessment-schema.ts"), "utf8");
  const riskMatch = riskSource.match(/export type RiskAssessmentRow = \{([\s\S]*?)\n\};/u);
  fail(Boolean(riskMatch), "cannot extract RiskAssessmentRow");
  if (riskMatch) {
    const productionRiskFields = [...riskMatch[1].matchAll(/^\s{2}([A-Za-z][A-Za-z0-9]*):/gmu)].map((match) => match[1]);
    const normativeRiskFields = spec.common.typeRegistry.RiskAssessmentEditorRow.fields.slice(1).map((field) => field[0]);
    fail(canonicalJson(productionRiskFields) === canonicalJson(normativeRiskFields), "RiskAssessmentRow field names differ");
  }

  const safetyReference = readFileSync(join(root, "lib/safety-reference-catalog.ts"), "utf8");
  const safetyMatch = safetyReference.match(/export type SafetyReferenceItem = \{([\s\S]*?)^\};/mu);
  fail(Boolean(safetyMatch), "cannot extract SafetyReferenceItem");
  const safetyRaw = spec.common.rawProvenance.union.find((member) => member.kind === "safety_reference_item");
  if (safetyMatch && safetyRaw) {
    const productionFields = [...safetyMatch[1].matchAll(/^\s{2}([A-Za-z_][A-Za-z0-9_]*)(\?)?:/gmu)].map((match) => [match[1], match[2] === "?"]);
    const productionRequired = productionFields.filter(([, optional]) => !optional).map(([name]) => name).sort();
    const productionOptional = productionFields.filter(([, optional]) => optional).map(([name]) => name).sort();
    fail(canonicalJson(productionRequired) === canonicalJson([...safetyRaw.required].sort()), "raw SafetyReferenceItem required fields differ from source");
    fail(canonicalJson(productionOptional) === canonicalJson([...safetyRaw.optional].sort()), "raw SafetyReferenceItem optional fields differ from source");
    const guideMatch = safetyMatch[1].match(/^\s{2}kosha_guide\?: \{([\s\S]*?)^\s{2}\};/mu);
    fail(Boolean(guideMatch), "cannot extract SafetyReferenceItem.kosha_guide");
    if (guideMatch) {
      const guideFields = [...guideMatch[1].matchAll(/^\s{4}([A-Za-z_][A-Za-z0-9_]*):/gmu)].map((match) => match[1]);
      fail(canonicalJson(guideFields) === canonicalJson(["referenceId", "stableDocumentKey", "version", "quality", "lifecycle", "bodyKind", "anchors", "evidenceRef", "directEligible"]), "raw KOSHA guide fields differ from source");
      fail(safetyRaw.koshaGuide.includes("anchors[].page") && safetyRaw.koshaGuide.includes("anchors[].excerpt"), "raw KOSHA anchors do not preserve page and excerpt");
    }
  }
  const ontology = readFileSync(join(root, "lib/ontology/evidence-chain-registry.ts"), "utf8");
  for (const token of ["LawEvidenceRecord", "SifEvidenceRecord", "KoshaGuidanceRecord", "supportStatement", "registryMapping", "provenanceBridge"]) {
    fail(ontology.includes(token), `ontology source no longer contains ${token}`);
  }
  const workpacksRoute = readFileSync(join(root, "app/api/workpacks/route.ts"), "utf8");
  fail(workpacksRoute.includes(".insert("), "workpacks POST is no longer observably insert-based; re-audit authority contract");
  for (const forbiddenClaim of ["expectedRevision", "idempotencyKey", "logicalWorkpackId", "parentWorkpackId"]) {
    fail(!workpacksRoute.includes(forbiddenClaim), `current workpacks route unexpectedly contains ${forbiddenClaim}; re-audit authority contract`);
  }
  const improvementsRoute = readFileSync(join(root, "app/api/workpacks/[id]/improvements/route.ts"), "utf8");
  fail(improvementsRoute.includes("export async function GET") && improvementsRoute.includes("export async function POST"), "improvements route GET/POST seam changed");
  fail(!improvementsRoute.includes("export async function PATCH") && !improvementsRoute.includes("export async function PUT"), "improvements review transition now exists; re-audit PHOTO-002");

  const revisionAuthority = spec.persistence.serverRevisionAuthority;
  for (const key of ["logicalWorkpackId", "parentWorkpackId", "expectedRevision", "idempotencyKey"]) {
    fail(canonicalJson(revisionAuthority).includes(key), `REVISION-001 omits ${key}`);
  }
  fail(revisionAuthority.status.startsWith("BLOCKED_"), "server revision authority is not blocked");
  fail(spec.persistence.photo.reviewAuthority.status.startsWith("BLOCKED_"), "photo review authority is not blocked");
  fail(spec.workflow.share.currentServerEnforcement === false, "spec incorrectly claims current share enforcement");

  if (!options.skipGitRange) {
    const mergeBase = runGit(root, ["merge-base", "HEAD", spec.meta.currentIntegrationTarget]);
    fail(mergeBase === spec.meta.sourceBase, `true merge-base is ${mergeBase}, expected ${spec.meta.sourceBase}`);
    runGit(root, ["merge-base", "--is-ancestor", spec.meta.remediationParent, "HEAD"]);
    const changed = runGit(root, ["diff", "--name-only", range, "--"])
      .split(/\r?\n/u)
      .filter(Boolean)
      .sort();
    const allowed = [...spec.meta.reviewRange.allowedPaths].sort();
    fail(canonicalJson(changed) === canonicalJson(allowed), `explicit range paths differ: ${changed.join(", ")}`);
  }

  return { errors, mirror, projection };
}

function printPasses(skipRange) {
  console.log("JSON_PARSE=PASS");
  console.log("MARKDOWN_CANONICAL_PARITY=PASS");
  console.log("DOCUMENT_SOURCE_SHAPE=PASS");
  console.log("RAW_PROVENANCE_UNION=PASS");
  console.log("CODEC_FIXTURE_MATRIX=PASS");
  console.log("WAVE_WRITE_OWNERSHIP=PASS");
  console.log("EXPORT_CALLSITE_SEAMS=PASS");
  console.log("BROWSER_TASK_GATES=PASS");
  console.log("SERVER_AUTHORITY_BLOCK=PASS");
  if (!skipRange) console.log("EXACT_TRIPLE_DOT_RANGE=PASS");
}

function main() {
  const args = parseArguments(process.argv.slice(2));
  const root = resolve(args.root);
  const jsonPath = join(root, SPEC_DIRECTORY, "spec.json");
  const markdownPath = join(root, SPEC_DIRECTORY, "spec.md");
  const jsonText = readFileSync(jsonPath, "utf8");
  const markdown = readFileSync(markdownPath, "utf8");
  const spec = JSON.parse(jsonText);
  const range = args.range ?? spec.meta.reviewRange.expression;

  if (args.printMirror) {
    console.log(JSON.stringify({ canonicalJsonSha256: digest(spec), projection: buildProjection(spec) }));
    return;
  }

  if (args.deliberateMismatch) spec.documents[0].key = "__deliberate_mismatch__";
  const result = collectValidationErrors(spec, markdown, root, range, { skipGitRange: args.skipRange });
  if (result.errors.length > 0) {
    for (const error of result.errors) console.error(`CONTRACT_ERROR: ${error}`);
    process.exitCode = 1;
    return;
  }

  if (args.selfTest) {
    const mutated = structuredClone(spec);
    mutated.documents[0].key = "__deliberate_mismatch__";
    const red = collectValidationErrors(mutated, markdown, root, range, { skipGitRange: true });
    if (red.errors.length === 0) throw new Error("Deliberate mismatch was not rejected");
    console.log("DELIBERATE_MISMATCH_RED=PASS");
  }

  printPasses(args.skipRange);
  console.log("CONTRACT_VALIDATION=PASS");
}

try {
  main();
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`CONTRACT_ERROR: ${message}`);
  process.exitCode = 1;
}
