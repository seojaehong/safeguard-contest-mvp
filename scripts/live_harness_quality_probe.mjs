#!/usr/bin/env node
// @ts-check

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const SCHEMA_VERSION = "safeclaw-live-harness-quality-probe/v1";
const ASK_PATH = "/api/ask";
const DEFAULT_TIMEOUT_MS = 90_000;
const MAX_TIMEOUT_MS = 300_000;
const SCRIPT_PATH = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(SCRIPT_PATH), "..");
const EVALUATION_ROOT = path.join(REPO_ROOT, "evaluation");

export const CANONICAL_SCENARIO = Object.freeze({
  id: "seongsu-exterior-paint-scaffold-wind-forklift",
  question: "세이프건설 서울 성수동 근린생활시설 외벽 도장 작업. 이동식 비계를 사용하고 작업자 5명 중 신규 투입자 1명이 포함된다. 오후 강풍 예보가 있으며 자재 반입 지게차 동선과 작업자 통행 동선이 겹친다.",
  aiMode: "enhanced",
});

const CONTRACT_DEFINITIONS = [
  ["api_response", "API response"],
  ["enhanced_mode", "Enhanced mode"],
  ["generation_evidence_sealed", "Generation evidence sealed"],
  ["db_harness_first", "DB harness first"],
  ["evidence_sets_present", "Direct, SIF, and supporting evidence"],
  ["structured_risk_tbm_links", "Structured risk rows and TBM links"],
  ["scenario_controls_present", "Fall, scaffold, wind, and traffic controls"],
  ["irrelevant_controls_absent", "Irrelevant controls absent"],
  ["quality_state_ready", "Quality state ready"],
  ["ontology_state_ready", "Ontology state ready"],
  ["no_db_mutation", "No DB mutation"],
];

const SCENARIO_CONTROL_DOMAINS = [
  {
    id: "fall",
    signals: ["추락", "고소", "외벽", "작업발판"],
    controls: ["안전대", "안전난간", "추락방호", "생명줄", "부착설비", "작업발판"],
  },
  {
    id: "scaffold",
    signals: ["비계", "이동식 비계", "작업발판"],
    controls: ["아웃트리거", "바퀴 잠금", "수평", "고정", "전도", "난간"],
  },
  {
    id: "wind",
    signals: ["강풍", "풍속", "바람", "기상"],
    controls: ["작업중지", "중지", "철수", "풍속 확인", "고정"],
  },
  {
    id: "traffic",
    signals: ["지게차", "차량", "보행자", "동선", "충돌"],
    controls: ["동선 분리", "보행 동선", "신호수", "접근통제", "후진 경보", "차단", "분리"],
  },
  {
    id: "paint_fire",
    signals: ["도장", "도료", "유기용제", "화재", "폭발"],
    controls: ["환기", "점화원", "화기", "스파크", "소화기", "방폭", "MSDS"],
  },
];

const IRRELEVANT_CONTROL_RULES = [
  {
    kind: "machine_guard",
    supportTerms: ["프레스", "컨베이어", "가동부", "기계 정비", "설비 보전", "LOTO", "잠금표지"],
    patterns: ["가동부 방호덮개", "방호덮개", "비상정지장치", "기계 방호", "LOTO", "잠금표지", "전원 차단"],
  },
  {
    kind: "electrostatic_paint",
    supportTerms: ["정전도장", "정전 도장", "정전도장기", "고전압 도장", "분체도장"],
    patterns: ["정전도장", "정전 도장", "정전도장기", "정전기 제거", "고전압 도장"],
  },
];

/** @typedef {"pass" | "fail"} ContractState */

/**
 * @typedef {object} ProbeFlag
 * @property {string} kind
 * @property {string} value
 * @property {string} source
 */

/**
 * @typedef {object} ProbeContract
 * @property {string} id
 * @property {string} label
 * @property {ContractState} state
 * @property {string} summary
 * @property {string[]} evidence
 * @property {ProbeFlag[]=} flags
 */

/**
 * @param {unknown} value
 * @returns {value is Record<string, unknown>}
 */
function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** @param {unknown} value */
function asRecord(value) {
  return isRecord(value) ? value : {};
}

/** @param {unknown} value */
function asArray(value) {
  return Array.isArray(value) ? value : [];
}

/** @param {unknown} value */
function readString(value) {
  return typeof value === "string" ? value.trim() : "";
}

/** @param {unknown} value */
function readStringArray(value) {
  return asArray(value).map(readString).filter(Boolean);
}

/** @param {unknown} value */
function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (!isRecord(value)) return value;
  return Object.keys(value)
    .sort()
    .reduce((result, key) => {
      const item = value[key];
      if (typeof item !== "undefined") result[key] = canonicalize(item);
      return result;
    }, /** @type {Record<string, unknown>} */ ({}));
}

/** @param {unknown} left @param {unknown} right */
function canonicalEqual(left, right) {
  return JSON.stringify(canonicalize(left)) === JSON.stringify(canonicalize(right));
}

/**
 * @param {string} rootDir
 * @returns {string}
 */
function resolveSourceSha(rootDir = REPO_ROOT) {
  try {
    return execFileSync("git", ["rev-parse", "--verify", "HEAD"], {
      cwd: rootDir,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return "";
  }
}

/**
 * @param {string} baseUrl
 * @param {number} timeoutMs
 * @returns {Promise<Record<string, unknown>>}
 */
async function fetchLiveBuildInfo(baseUrl, timeoutMs) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), Math.min(timeoutMs, 20_000));
  try {
    const response = await fetch(`${baseUrl}/api/build-info`, {
      method: "GET",
      headers: { accept: "application/json" },
      signal: controller.signal,
    });
    const text = await response.text();
    /** @type {unknown} */
    let parsed = null;
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = null;
    }
    return {
      ok: response.ok,
      status: response.status,
      ...(isRecord(parsed) ? parsed : { rawPreview: text.slice(0, 500) }),
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    };
  } finally {
    clearTimeout(timeout);
  }
}

/** @param {string} text @param {string[]} terms */
function includesAny(text, terms) {
  const normalized = text.toLocaleLowerCase("ko-KR");
  return terms.some((term) => normalized.includes(term.toLocaleLowerCase("ko-KR")));
}

/**
 * @param {string} id
 * @param {boolean} ok
 * @param {string} passSummary
 * @param {string} failSummary
 * @param {string[]} evidence
 * @param {ProbeFlag[]=} flags
 * @returns {ProbeContract}
 */
function buildContract(id, ok, passSummary, failSummary, evidence, flags) {
  const definition = CONTRACT_DEFINITIONS.find(([contractId]) => contractId === id);
  if (!definition) throw new Error(`Unknown probe contract: ${id}`);
  return {
    id,
    label: definition[1],
    state: ok ? "pass" : "fail",
    summary: ok ? passSummary : failSummary,
    evidence,
    ...(flags?.length ? { flags } : {}),
  };
}

/** @param {unknown} item */
function isEvidenceItem(item) {
  const record = asRecord(item);
  return Boolean(readString(record.id) && (readString(record.displayTitle) || readString(record.title)));
}

/** @param {unknown} row */
function isStructuredRiskRow(row) {
  const record = asRecord(row);
  return Boolean(
    readString(record.hazard)
    && readString(record.currentControls)
    && readString(record.additionalControls)
    && readStringArray(record.evidenceRefs).length,
  );
}

/** @param {unknown} link @param {unknown[]} rows */
function isStructuredTbmLink(link, rows) {
  const record = asRecord(link);
  const riskRowIndex = record.riskRowIndex;
  if (!Number.isInteger(riskRowIndex) || riskRowIndex < 0 || riskRowIndex >= rows.length) return false;
  const row = asRecord(rows[riskRowIndex]);
  const rowRefs = new Set(readStringArray(row.evidenceRefs));
  const linkRefs = readStringArray(record.evidenceRefs);
  return Boolean(
    readString(record.hazard)
    && readString(record.control)
    && linkRefs.length
    && linkRefs.some((reference) => rowRefs.has(reference)),
  );
}

/**
 * @param {Record<string, unknown>} response
 * @returns {Array<{ source: string; text: string }>}
 */
function collectStructuredControlArtifacts(response) {
  const structured = asRecord(response.structured);
  const rows = asArray(structured.riskAssessmentRows);
  const links = asArray(structured.tbmRiskLinks);
  const artifacts = [];

  rows.forEach((row, index) => {
    const record = asRecord(row);
    artifacts.push({
      source: `structured.riskAssessmentRows[${index}]`,
      text: [record.hazard, record.currentControls, record.additionalControls, record.verification]
        .map(readString)
        .filter(Boolean)
        .join(" | "),
    });
  });
  links.forEach((link, index) => {
    const record = asRecord(link);
    artifacts.push({
      source: `structured.tbmRiskLinks[${index}]`,
      text: [record.hazard, record.control, record.confirmQuestion, record.verification]
        .map(readString)
        .filter(Boolean)
        .join(" | "),
    });
  });
  return artifacts.filter((artifact) => artifact.text);
}

/**
 * @param {Record<string, unknown>} packet
 * @returns {Array<{ source: string; text: string }>}
 */
function collectEvidenceArtifacts(packet) {
  const artifacts = [];
  for (const key of ["directEvidence", "sifCases", "supportingEvidence"]) {
    asArray(packet[key]).forEach((item, index) => {
      const record = asRecord(item);
      artifacts.push({
        source: `dbHarness.packet.${key}[${index}]`,
        text: [record.displayTitle, record.title, ...readStringArray(record.controls)]
          .map(readString)
          .filter(Boolean)
          .join(" | "),
      });
    });
  }
  return artifacts.filter((artifact) => artifact.text);
}

/**
 * @param {string} question
 * @param {Array<{ source: string; text: string }>} artifacts
 * @returns {ProbeFlag[]}
 */
function findIrrelevantControls(question, artifacts) {
  const flags = [];
  const seen = new Set();
  for (const rule of IRRELEVANT_CONTROL_RULES) {
    if (includesAny(question, rule.supportTerms)) continue;
    for (const artifact of artifacts) {
      const pattern = rule.patterns.find((candidate) => includesAny(artifact.text, [candidate]));
      if (!pattern) continue;
      const key = `${rule.kind}:${artifact.source}`;
      if (seen.has(key)) continue;
      seen.add(key);
      flags.push({ kind: rule.kind, value: pattern, source: artifact.source });
    }
  }
  return flags;
}

/**
 * Deterministically evaluates a parsed `/api/ask` response. It never reads the
 * network, filesystem, environment, clock, or database.
 *
 * @param {unknown} responseValue
 * @param {unknown} contextValue
 */
export function evaluateHarnessResponse(responseValue, contextValue) {
  const response = asRecord(responseValue);
  const context = asRecord(contextValue);
  const request = asRecord(context.request);
  const requestBody = asRecord(request.body);
  const transport = asRecord(context.transport);
  const operations = asArray(context.operations).map(asRecord);
  const dbHarness = asRecord(response.dbHarness);
  const packet = asRecord(dbHarness.packet);
  const generationContract = asRecord(packet.generationContract);
  const generationEvidence = asRecord(response.generationEvidence);
  const snapshot = asRecord(generationEvidence.snapshot);
  const structured = asRecord(response.structured);
  const riskRows = asArray(structured.riskAssessmentRows);
  const tbmLinks = asArray(structured.tbmRiskLinks);
  const validation = asRecord(structured.riskAssessmentValidation);
  const quality = asRecord(response.qualityContract);
  const qualityOntology = asRecord(quality.ontology);
  const qualityEvidence = asRecord(quality.evidence);
  const qualityStructured = asRecord(quality.structured);
  const qualityHarness = asRecord(quality.dbHarness);
  const ontologyChecklist = asRecord(packet.ontologyChecklist);
  const harnessSummary = asRecord(dbHarness.summary);
  const ontologyQa = asRecord(response.ontologyQa);
  const ontologyQaResult = asRecord(ontologyQa.result);

  /** @type {ProbeContract[]} */
  const contracts = [];

  const transportOk = transport.ok === true
    && typeof transport.status === "number"
    && transport.status >= 200
    && transport.status < 300;
  contracts.push(buildContract(
    "api_response",
    transportOk,
    "The live API returned a successful response.",
    "The live API request failed or returned a non-success status.",
    [`HTTP status: ${String(transport.status ?? "unavailable")}`],
  ));

  const enhancedMode = context.requestedMode === "enhanced"
    && request.method === "POST"
    && request.path === ASK_PATH
    && requestBody.aiMode === "enhanced"
    && response.generationMode === "enhanced";
  contracts.push(buildContract(
    "enhanced_mode",
    enhancedMode,
    "The request and response both use enhanced mode.",
    "Enhanced mode was not preserved across the request and response.",
    [
      `requested: ${readString(context.requestedMode) || "missing"}`,
      `request body: ${readString(requestBody.aiMode) || "missing"}`,
      `response: ${readString(response.generationMode) || "missing"}`,
    ],
  ));

  const snapshotDigest = readString(snapshot.responseContentDigest);
  const sealed = generationEvidence.version === "safeclaw-generation-evidence/v1"
    && generationEvidence.algorithm === "HMAC-SHA256"
    && Boolean(readString(generationEvidence.signature))
    && snapshot.question === response.question
    && snapshot.question === CANONICAL_SCENARIO.question
    && /^sha256:[A-Za-z0-9_-]+$/.test(snapshotDigest)
    && canonicalEqual(snapshot.dbHarnessPacket, packet)
    && (response.generationEvidenceError === undefined || response.generationEvidenceError === null);
  contracts.push(buildContract(
    "generation_evidence_sealed",
    sealed,
    "The response carries a structurally sealed envelope for the returned harness packet.",
    "The generation evidence envelope is absent, malformed, or detached from the returned harness packet.",
    [
      `version: ${readString(generationEvidence.version) || "missing"}`,
      `algorithm: ${readString(generationEvidence.algorithm) || "missing"}`,
      `snapshot packet: ${canonicalEqual(snapshot.dbHarnessPacket, packet) ? "matches" : "mismatch"}`,
      "signature: structural presence only; server secret is not read by this probe",
    ],
  ));

  const dbHarnessFirst = packet.mode === "db_harness_first"
    && packet.question === CANONICAL_SCENARIO.question
    && generationContract.llmRole === "naturalize_only"
    && generationContract.llmOutputScope === "rewrite_fixed_evidence_only"
    && generationContract.evidenceAuthority === "db_harness"
    && generationContract.providerRetryScope === "naturalization_retry_only"
    && generationContract.fallbackChainAllowed === false
    && generationContract.genericProseSubstitutionAllowed === false
    && generationContract.missingEvidencePolicy === "surface_review_required";
  contracts.push(buildContract(
    "db_harness_first",
    dbHarnessFirst,
    "The DB harness is authoritative and the LLM is limited to naturalization.",
    "The generation contract is not sealed to DB-harness-first naturalization.",
    [
      `mode: ${readString(packet.mode) || "missing"}`,
      `evidence authority: ${readString(generationContract.evidenceAuthority) || "missing"}`,
      `LLM role: ${readString(generationContract.llmRole) || "missing"}`,
      `fallback chain: ${String(generationContract.fallbackChainAllowed ?? "missing")}`,
    ],
  ));

  const evidenceGroups = {
    direct: asArray(packet.directEvidence),
    sif: asArray(packet.sifCases),
    supporting: asArray(packet.supportingEvidence),
  };
  const evidencePresent = Object.values(evidenceGroups).every(
    (items) => items.length > 0 && items.some(isEvidenceItem),
  );
  contracts.push(buildContract(
    "evidence_sets_present",
    evidencePresent,
    "Direct, SIF, and supporting evidence are all present in the harness packet.",
    "One or more required evidence groups are missing or malformed.",
    Object.entries(evidenceGroups).map(([name, items]) => `${name}: ${items.length ? "present" : "missing"}`),
  ));

  const structuredLinksReady = riskRows.length > 0
    && riskRows.every(isStructuredRiskRow)
    && tbmLinks.length > 0
    && tbmLinks.every((link) => isStructuredTbmLink(link, riskRows))
    && validation.ok === true;
  contracts.push(buildContract(
    "structured_risk_tbm_links",
    structuredLinksReady,
    "Structured risk rows and evidence-linked TBM controls are valid.",
    "Structured risk rows or their TBM evidence links are absent or invalid.",
    [
      `risk rows: ${riskRows.length ? "present" : "missing"}`,
      `TBM links: ${tbmLinks.length ? "present" : "missing"}`,
      `row validation: ${validation.ok === true ? "ready" : "not ready"}`,
    ],
  ));

  const controlArtifacts = collectStructuredControlArtifacts(response);
  const domainMatches = SCENARIO_CONTROL_DOMAINS.map((domain) => ({
    id: domain.id,
    artifact: controlArtifacts.find(
      (item) => includesAny(item.text, domain.signals) && includesAny(item.text, domain.controls),
    ),
  }));
  const scenarioControlsReady = domainMatches.every((match) => Boolean(match.artifact));
  contracts.push(buildContract(
    "scenario_controls_present",
    scenarioControlsReady,
    "Fall, scaffold, wind, traffic, and paint-fire controls are grounded in structured output.",
    "One or more canonical scenario control domains are absent from structured output.",
    domainMatches.map((match) => `${match.id}: ${match.artifact?.source ?? "missing"}`),
  ));

  const irrelevantFlags = findIrrelevantControls(
    CANONICAL_SCENARIO.question,
    [...controlArtifacts, ...collectEvidenceArtifacts(packet)],
  );
  contracts.push(buildContract(
    "irrelevant_controls_absent",
    irrelevantFlags.length === 0,
    "No unsupported machine-guard or electrostatic-paint controls were found.",
    "Unsupported machine-guard or electrostatic-paint controls were found.",
    irrelevantFlags.length
      ? irrelevantFlags.map((flag) => `${flag.kind}: ${flag.value} at ${flag.source}`)
      : ["unsupported control flags: none"],
    irrelevantFlags,
  ));

  const qualityReady = quality.overall === "ready"
    && qualityEvidence.status === "ready"
    && qualityStructured.status === "ready"
    && qualityHarness.status === "ready";
  contracts.push(buildContract(
    "quality_state_ready",
    qualityReady,
    "The overall, evidence, structured, and harness quality states are ready.",
    "One or more required quality states are not ready.",
    [
      `overall: ${readString(quality.overall) || "missing"}`,
      `evidence: ${readString(qualityEvidence.status) || "missing"}`,
      `structured: ${readString(qualityStructured.status) || "missing"}`,
      `DB harness: ${readString(qualityHarness.status) || "missing"}`,
    ],
  ));

  const qaVerdictReady = ontologyQaResult.reviewable === true
    ? ontologyQaResult.verdict === "통과"
    : true;
  const ontologyReady = qualityOntology.status === "ready"
    && ontologyChecklist.status === "ready"
    && harnessSummary.ontologyStatus === "ready"
    && qaVerdictReady;
  contracts.push(buildContract(
    "ontology_state_ready",
    ontologyReady,
    "Quality, harness, and optional QA ontology states are ready.",
    "The quality, harness, or QA ontology state requires review.",
    [
      `quality ontology: ${readString(qualityOntology.status) || "missing"}`,
      `harness ontology: ${readString(ontologyChecklist.status) || "missing"}`,
      `summary ontology: ${readString(harnessSummary.ontologyStatus) || "missing"}`,
      `QA verdict: ${readString(ontologyQaResult.verdict) || "not supplied"}`,
    ],
  ));

  const probeOnlyAsk = operations.length === 1
    && operations.every((operation) => operation.mutatesDb === false)
    && operations[0]?.method === "POST"
    && operations[0]?.path === ASK_PATH
    && request.method === "POST"
    && request.path === ASK_PATH;
  contracts.push(buildContract(
    "no_db_mutation",
    probeOnlyAsk,
    "The probe issued only the non-persistence `/api/ask` generation request.",
    "The probe operation log contains a persistence or unexpected request.",
    operations.length
      ? operations.map((operation) => `${readString(operation.method)} ${readString(operation.path)} mutatesDb=${String(operation.mutatesDb)}`)
      : ["operation log: missing"],
  ));

  return {
    verdict: contracts.every((contract) => contract.state === "pass") ? "pass" : "fail",
    states: {
      quality: readString(quality.overall) || "missing",
      ontology: readString(qualityOntology.status) || "missing",
      harnessOntology: readString(ontologyChecklist.status) || "missing",
    },
    contracts,
    flags: contracts.flatMap((contract) => contract.flags ?? []),
  };
}

/** @param {string} value */
function markdownCell(value) {
  return value.replace(/\r?\n/g, " ").replace(/\|/g, "\\|");
}

/** @param {string[]} values @param {number} limit */
function conciseEvidence(values, limit) {
  if (values.length <= limit) return values.join("; ");
  return [...values.slice(0, limit), "additional evidence in JSON"].join("; ");
}

/**
 * Pure Markdown renderer for a completed probe report.
 *
 * @param {unknown} reportValue
 */
export function renderMarkdownEvidence(reportValue) {
  const report = asRecord(reportValue);
  const request = asRecord(report.request);
  const requestBody = asRecord(request.body);
  const transport = asRecord(report.transport);
  const evaluation = asRecord(report.evaluation);
  const states = asRecord(evaluation.states);
  const contracts = asArray(evaluation.contracts).map(asRecord);
  const flags = asArray(evaluation.flags).map(asRecord);
  const verdict = evaluation.verdict === "pass" ? "PASS" : "FAIL";
  const lines = [
    "# SafeClaw Live Harness Quality Probe",
    "",
    `- Overall: ${verdict}`,
    `- Generated: ${readString(report.generatedAt) || "unavailable"}`,
    `- Source HEAD at generation: ${readString(report.sourceSha) || "unavailable"}`,
    `- Live commit at generation: ${readString(asRecord(report.liveBuildInfo).commitSha) || "unavailable"}`,
    "- Note: this artifact is generated before it is committed. A later evidence-only commit can contain this report without changing the measured runtime surface.",
    `- Base URL: ${readString(report.baseUrl) || "unavailable"}`,
    `- Request: ${readString(request.method) || "unknown"} ${readString(request.path) || "unknown"} (${readString(requestBody.aiMode) || "unknown"})`,
    `- HTTP: ${String(transport.status ?? "unavailable")}`,
    `- Quality state: ${readString(states.quality) || "missing"}`,
    `- Ontology state: ${readString(states.ontology) || "missing"}`,
    "",
    "## Contract Evidence",
    "",
    "| Contract | State | Evidence |",
    "| --- | --- | --- |",
    ...contracts.map((contract) => {
      const evidenceItems = readStringArray(contract.evidence);
      const evidence = conciseEvidence(evidenceItems, 4) || readString(contract.summary);
      return `| ${markdownCell(readString(contract.id))} | ${contract.state === "pass" ? "PASS" : "FAIL"} | ${markdownCell(evidence)} |`;
    }),
  ];

  if (flags.length) {
    lines.push(
      "",
      "## Flags",
      "",
      ...flags.slice(0, 6).map((flag) => `- ${readString(flag.kind)}: ${readString(flag.value)} (${readString(flag.source)})`),
      ...(flags.length > 6 ? ["- additional evidence in JSON"] : []),
    );
  }

  return `${lines.join("\n")}\n`;
}

/** @param {string[]} argv */
function parseArgs(argv) {
  /** @type {{ baseUrl?: string; inputJson?: string; output?: string; timeoutMs: number; help: boolean }} */
  const parsed = { timeoutMs: DEFAULT_TIMEOUT_MS, help: false };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") {
      parsed.help = true;
      continue;
    }
    if (!["--base-url", "--input-json", "--output", "--timeout-ms"].includes(arg)) {
      throw new Error(`Unknown argument: ${arg}`);
    }
    const value = argv[index + 1];
    if (!value || value.startsWith("--")) throw new Error(`Missing value for ${arg}`);
    index += 1;
    if (arg === "--base-url") parsed.baseUrl = normalizeBaseUrl(value);
    if (arg === "--input-json") parsed.inputJson = resolveInputJsonPath(value);
    if (arg === "--output") parsed.output = resolveOutputDirectory(value);
    if (arg === "--timeout-ms") parsed.timeoutMs = normalizeTimeout(value);
  }
  if (parsed.help) return parsed;
  if (Boolean(parsed.baseUrl) === Boolean(parsed.inputJson)) {
    throw new Error("Exactly one of --base-url or --input-json is required");
  }
  if (!parsed.output) throw new Error("--output is required");
  return parsed;
}

/** @param {string} value */
function normalizeBaseUrl(value) {
  const url = new URL(value);
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("--base-url must use http or https");
  }
  if (url.username || url.password) throw new Error("--base-url must not contain credentials");
  if (url.search || url.hash) throw new Error("--base-url must not contain a query or fragment");
  return url.toString().replace(/\/+$/g, "");
}

/** @param {string} value */
function resolveOutputDirectory(value) {
  const normalized = value.replace(/\\/g, "/");
  const output = path.isAbsolute(value)
    ? path.resolve(value)
    : normalized === "evaluation" || normalized.startsWith("evaluation/")
      ? path.resolve(REPO_ROOT, value)
      : path.resolve(EVALUATION_ROOT, value);
  const relative = path.relative(EVALUATION_ROOT, output);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error("--output must resolve under the repository evaluation directory");
  }
  return output;
}

/** @param {string} value */
function resolveInputJsonPath(value) {
  const inputPath = path.resolve(value);
  if (!fs.existsSync(inputPath)) {
    throw new Error(`--input-json file not found: ${inputPath}`);
  }
  const stat = fs.statSync(inputPath);
  if (!stat.isFile()) {
    throw new Error(`--input-json must resolve to a file: ${inputPath}`);
  }
  return inputPath;
}

/** @param {string} value */
function normalizeTimeout(value) {
  const timeoutMs = Number.parseInt(value, 10);
  if (!Number.isInteger(timeoutMs) || timeoutMs < 1_000 || timeoutMs > MAX_TIMEOUT_MS) {
    throw new Error(`--timeout-ms must be between 1000 and ${MAX_TIMEOUT_MS}`);
  }
  return timeoutMs;
}

function usage() {
  return [
    "Usage:",
    "  node scripts/live_harness_quality_probe.mjs (--base-url <url> | --input-json <path>) --output <evaluation-dir> [--timeout-ms <ms>]",
    "",
    "Example:",
    "  node scripts/live_harness_quality_probe.mjs --base-url https://www.safeclaw.kr --output live-harness-quality-probe",
    "  node scripts/live_harness_quality_probe.mjs --input-json evaluation/live-harness-quality-probe/full.json --output live-harness-quality-probe-recheck",
  ].join("\n");
}

/** @param {{ baseUrl: string; timeoutMs: number }} options */
async function runLiveProbe(options) {
  const request = {
    method: "POST",
    path: ASK_PATH,
    body: {
      question: CANONICAL_SCENARIO.question,
      aiMode: CANONICAL_SCENARIO.aiMode,
    },
  };
  const operations = [{ method: "POST", path: ASK_PATH, mutatesDb: false }];
  const startedAt = new Date().toISOString();
  const startedAtMs = Date.now();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs);
  /** @type {unknown} */
  let responsePayload = null;
  /** @type {Record<string, unknown> | null} */
  let errorDetail = null;
  /** @type {Record<string, unknown>} */
  let transport = {
    ok: false,
    status: null,
    timeoutMs: options.timeoutMs,
    elapsedMs: 0,
    contentType: "",
  };

  try {
    const response = await fetch(`${options.baseUrl}${ASK_PATH}`, {
      method: request.method,
      headers: { "content-type": "application/json" },
      body: JSON.stringify(request.body),
      signal: controller.signal,
    });
    const responseText = await response.text();
    let parseError = "";
    try {
      responsePayload = JSON.parse(responseText);
    } catch (error) {
      parseError = error instanceof Error ? error.message : String(error);
      responsePayload = null;
    }
    transport = {
      ok: response.ok,
      status: response.status,
      timeoutMs: options.timeoutMs,
      elapsedMs: Date.now() - startedAtMs,
      contentType: response.headers.get("content-type") || "",
      ...(parseError ? { parseError, rawResponsePreview: responseText.slice(0, 1_000) } : {}),
    };
  } catch (error) {
    const timedOut = controller.signal.aborted;
    errorDetail = {
      name: error instanceof Error ? error.name : "Error",
      message: timedOut
        ? `Request exceeded the bounded timeout of ${options.timeoutMs}ms`
        : error instanceof Error
          ? error.message
          : String(error),
    };
    transport = {
      ok: false,
      status: null,
      timeoutMs: options.timeoutMs,
      elapsedMs: Date.now() - startedAtMs,
      contentType: "",
      timedOut,
    };
  } finally {
    clearTimeout(timeout);
  }

  const context = {
    requestedMode: CANONICAL_SCENARIO.aiMode,
    request,
    transport,
    operations,
  };
  const evaluation = evaluateHarnessResponse(responsePayload, context);
  const liveBuildInfo = await fetchLiveBuildInfo(options.baseUrl, options.timeoutMs);
  return {
    schemaVersion: SCHEMA_VERSION,
    generatedAt: new Date().toISOString(),
    startedAt,
    sourceSha: resolveSourceSha(),
    liveBuildInfo,
    baseUrl: options.baseUrl,
    scenario: CANONICAL_SCENARIO,
    request,
    transport,
    operations,
    evaluation,
    response: responsePayload,
    ...(errorDetail ? { error: errorDetail } : {}),
  };
}

/** @param {{ inputJsonPath: string }} options */
async function runInputJsonProbe(options) {
  const request = {
    method: "POST",
    path: ASK_PATH,
    body: {
      question: CANONICAL_SCENARIO.question,
      aiMode: CANONICAL_SCENARIO.aiMode,
    },
  };
  const operations = [{ method: "POST", path: ASK_PATH, mutatesDb: false }];
  const startedAt = new Date().toISOString();
  const responseText = fs.readFileSync(options.inputJsonPath, "utf8");
  /** @type {unknown} */
  let responsePayload;
  try {
    responsePayload = JSON.parse(responseText);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`--input-json must contain valid JSON: ${message}`);
  }

  const transport = {
    ok: true,
    status: 200,
    timeoutMs: 0,
    elapsedMs: 0,
    contentType: "application/json",
    source: "input-json",
  };
  const context = {
    requestedMode: CANONICAL_SCENARIO.aiMode,
    request,
    transport,
    operations,
  };
  const evaluation = evaluateHarnessResponse(responsePayload, context);
  return {
    schemaVersion: SCHEMA_VERSION,
    generatedAt: new Date().toISOString(),
    startedAt,
    sourceSha: resolveSourceSha(),
    baseUrl: "unavailable (input-json)",
    inputJson: {
      path: options.inputJsonPath,
    },
    scenario: CANONICAL_SCENARIO,
    request,
    transport,
    operations,
    evaluation,
    response: responsePayload,
  };
}

/** @param {string} outputDirectory @param {unknown} report */
function writeEvidence(outputDirectory, report) {
  fs.mkdirSync(outputDirectory, { recursive: true });
  const jsonPath = path.join(outputDirectory, "report.json");
  const markdownPath = path.join(outputDirectory, "report.md");
  fs.writeFileSync(jsonPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  fs.writeFileSync(markdownPath, renderMarkdownEvidence(report), "utf8");
  return { jsonPath, markdownPath };
}

async function main() {
  let options;
  try {
    options = parseArgs(process.argv.slice(2));
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    console.error(usage());
    process.exitCode = 2;
    return;
  }
  if (options.help) {
    console.log(usage());
    return;
  }

  const report = options.inputJson
    ? await runInputJsonProbe({
        inputJsonPath: options.inputJson,
      })
    : await runLiveProbe({
        baseUrl: /** @type {string} */ (options.baseUrl),
        timeoutMs: options.timeoutMs,
      });
  const outputPaths = writeEvidence(/** @type {string} */ (options.output), report);
  console.log(JSON.stringify({
    verdict: report.evaluation.verdict,
    httpStatus: report.transport.status,
    failedContracts: report.evaluation.contracts
      .filter((contract) => contract.state === "fail")
      .map((contract) => contract.id),
    json: path.relative(REPO_ROOT, outputPaths.jsonPath),
    markdown: path.relative(REPO_ROOT, outputPaths.markdownPath),
  }, null, 2));
  process.exitCode = report.evaluation.verdict === "pass" ? 0 : 1;
}

const isMain = Boolean(process.argv[1]) && path.resolve(process.argv[1]) === SCRIPT_PATH;
if (isMain) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.stack || error.message : String(error));
    process.exitCode = 1;
  });
}
