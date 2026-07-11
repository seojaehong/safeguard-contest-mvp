import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

import AdmZip from "adm-zip";
import { createServer } from "vite";

const OFFICIAL_LIST_URL = "https://portal.kosha.or.kr/archive/resources/tech-support/search/all?page=1&rowsPerPage=10";
const OFFICIAL_API_URL = "https://portal.kosha.or.kr/api/portal24/bizV/p/VCPDG08009/selectList";
const DEFAULT_PRODUCTION_BASE = "https://safeguard-contest-mvp.vercel.app";
const DEFAULT_TECHNICAL_FOLDER = "C:\\Users\\iceam\\Downloads\\기술지원규정";
const DEFAULT_MANIFEST_PATH = "data/safety-knowledge/kosha-guide-audit-manifest.json";
const DEFAULT_OUTPUT_DIR = "evaluation/kosha-guide-audit-2026-07-11";
const REQUEST_TIMEOUT_MS = 20_000;
const REQUEST_RETRIES = 1;
const OFFICIAL_CATEGORIES = ["A", "B", "C", "D", "E"];

const RETRIEVAL_SCENARIOS = [
  {
    id: "exterior-paint",
    query: "외벽 도장 이동식 비계 강풍 도료 유기용제 화재 폭발",
    expectedCodes: ["B-E-17-2026", "D-C-13-2026"],
    requiredControlTerms: ["도료", "유기용제", "작업발판", "안전대"],
    forbiddenTerms: ["정전도장기", "피도장물 접지"]
  },
  {
    id: "confined-pump",
    query: "밀폐공간 배수펌프 점검 산소농도 환기 감시인 전원 차단 잠금표지",
    expectedCodes: ["E-G-18-2026"],
    requiredControlTerms: ["산소", "유해가스", "감시인", "구조장비"],
    forbiddenTerms: ["정전도장기"]
  },
  {
    id: "forklift-traffic",
    query: "지게차 상하차 보행자 동선 후진 충돌 신호수",
    expectedCodes: ["B-M-11-2025"],
    requiredControlTerms: ["보행자", "동선", "신호수", "후진"],
    forbiddenTerms: ["산소·유해가스"]
  },
  {
    id: "electrostatic-paint",
    query: "정전도장기 정전기 접지 도료 증기 화재 폭발",
    expectedCodes: ["B-E-20-2026"],
    requiredControlTerms: ["정전기", "접지", "방폭"],
    forbiddenTerms: ["지게차 연료"]
  }
];

function parseArguments(argv) {
  const options = {
    technicalFolder: DEFAULT_TECHNICAL_FOLDER,
    manifest: DEFAULT_MANIFEST_PATH,
    outputDir: DEFAULT_OUTPUT_DIR,
    productionBase: DEFAULT_PRODUCTION_BASE,
    envFile: null,
    offline: false,
    strict: false
  };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--offline" || argument === "--strict") {
      options[argument.slice(2)] = true;
      continue;
    }
    if (["--technical-folder", "--manifest", "--output-dir", "--production-base", "--env-file"].includes(argument)) {
      const value = argv[index + 1];
      if (!value) throw new Error(`${argument} requires a value`);
      const key = argument
        .slice(2)
        .replace(/-([a-z])/gu, (_, letter) => letter.toUpperCase());
      options[key] = value;
      index += 1;
      continue;
    }
    throw new Error(`Unknown argument: ${argument}`);
  }
  return options;
}

function codepointCompare(left, right) {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

function stableValue(value) {
  if (Array.isArray(value)) return value.map(stableValue);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([left], [right]) => codepointCompare(left, right))
        .map(([key, nested]) => [key, stableValue(nested)])
    );
  }
  return value;
}

function stableJson(value) {
  return JSON.stringify(stableValue(value));
}

function hashValue(value) {
  return createHash("sha256").update(stableJson(value), "utf8").digest("hex");
}

function countBy(values) {
  const counts = new Map();
  for (const value of values) counts.set(value, (counts.get(value) || 0) + 1);
  return Object.fromEntries([...counts.entries()].sort(([left], [right]) => codepointCompare(left, right)));
}

function timestampRange(rows, key) {
  const values = rows
    .map((row) => typeof row[key] === "string" ? row[key] : "")
    .filter(Boolean)
    .sort(codepointCompare);
  return [values[0] || null, values.at(-1) || null];
}

function readEnvFile(path) {
  if (!path || !existsSync(path)) return false;
  for (const line of readFileSync(path, "utf8").split(/\r?\n/gu)) {
    const match = line.trim().match(/^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/u);
    if (!match) continue;
    let value = match[2].trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!process.env[match[1]]) process.env[match[1]] = value;
  }
  return true;
}

async function fetchWithRetry(url, init, label) {
  let lastError;
  for (let attempt = 0; attempt <= REQUEST_RETRIES; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      const response = await fetch(url, { ...init, signal: controller.signal, cache: "no-store" });
      if (response.status < 500 || attempt === REQUEST_RETRIES) return response;
      lastError = new Error(`${label} returned HTTP ${response.status}`);
    } catch (error) {
      lastError = error;
      if (attempt === REQUEST_RETRIES) throw error;
    } finally {
      clearTimeout(timeout);
    }
  }
  throw lastError || new Error(`${label} failed`);
}

function readLocalArchiveEntries(technicalFolder, decodeKoshaArchiveEntryName) {
  const zipFiles = readdirSync(technicalFolder)
    .filter((fileName) => fileName.toLowerCase().endsWith(".zip"))
    .sort(codepointCompare);
  const entries = [];
  for (const zipFile of zipFiles) {
    const archive = new AdmZip(resolve(technicalFolder, zipFile));
    for (const entry of archive.getEntries()) {
      if (entry.isDirectory) continue;
      const internalPath = decodeKoshaArchiveEntryName(entry.rawEntryName);
      if (!internalPath.toLowerCase().endsWith(".pdf")) continue;
      entries.push({
        zipFile,
        internalPath,
        crc32: String(entry.header.crc >>> 0),
        compressedSize: entry.header.compressedSize,
        fileSize: entry.header.size,
        itemType: internalPath.includes("기술지원규정")
          ? "technical-support-regulation"
          : "technical-guideline"
      });
    }
  }
  return entries;
}

function readLocalParsedSnapshot(technicalFolder) {
  const result = spawnSync(
    "python",
    [
      "scripts/snapshot_kosha_guide_corpus.py",
      "--technical-folder",
      technicalFolder,
      "--max-pdf-pages",
      "3"
    ],
    {
      cwd: process.cwd(),
      encoding: "utf8",
      maxBuffer: 64 * 1024 * 1024,
      windowsHide: true
    }
  );
  if (result.status !== 0) {
    throw new Error(`local snapshot helper failed (${result.status}): ${result.stderr.trim()}`);
  }
  return {
    snapshot: JSON.parse(result.stdout),
    notices: result.stderr
      .split(/\r?\n/gu)
      .map((line) => line.trim())
      .filter(Boolean)
  };
}

function canonicalGuideRows(rows) {
  return rows
    .map((row) => ({
      id: row.id,
      source_id: row.source_id,
      item_type: row.item_type,
      category: row.category,
      subcategory: row.subcategory,
      title: row.title,
      summary: row.summary,
      body: row.body,
      keywords: row.keywords,
      risk_tags: row.risk_tags,
      primary_documents: row.primary_documents,
      controls: row.controls,
      payload: row.payload
    }))
    .sort((left, right) => codepointCompare(left.id, right.id));
}

async function fetchProductionStatus(productionBase, summarizeKoshaVisibleStatus) {
  const url = new URL("/api/safety-reference/status", productionBase);
  url.searchParams.set("audit", new Date().toISOString());
  const response = await fetchWithRetry(url, {}, "production safety-reference status");
  const payload = await response.json();
  return {
    httpStatus: response.status,
    checkedAt: response.headers.get("date"),
    cache: response.headers.get("x-vercel-cache"),
    matchedPath: response.headers.get("x-matched-path"),
    visible: summarizeKoshaVisibleStatus(payload),
    samples: Array.isArray(payload.samples) ? payload.samples : [],
    message: typeof payload.message === "string" ? payload.message : ""
  };
}

async function probeSupabaseFullRowsFromEnv() {
  const url = (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "").replace(/\/$/u, "");
  const credentials = [
    { role: "service_role", value: process.env.SUPABASE_SERVICE_ROLE_KEY || "" },
    { role: "anon", value: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "" }
  ].filter((credential, index, values) =>
    credential.value && values.findIndex((candidate) => candidate.value === credential.value) === index
  );
  if (!url || !credentials.length) {
    return { available: false, reason: "env-unavailable", attempts: [], source: null, rows: [] };
  }

  const attempts = [];
  for (const credential of credentials) {
    const headers = {
      apikey: credential.value,
      Authorization: `Bearer ${credential.value}`
    };
    const sourceUrl = new URL("/rest/v1/safety_reference_sources", url);
    sourceUrl.searchParams.set("select", "*");
    sourceUrl.searchParams.set("id", "eq.kosha-technical-support-regulations-2025");
    const sourceResponse = await fetchWithRetry(sourceUrl, { headers }, `Supabase ${credential.role} source probe`);
    attempts.push({ role: credential.role, httpStatus: sourceResponse.status });
    if (!sourceResponse.ok) continue;
    const sources = await sourceResponse.json();
    if (!Array.isArray(sources) || !sources.length) {
      attempts.at(-1).reason = "source-empty";
      continue;
    }

    const fields = [
      "id",
      "source_id",
      "item_type",
      "category",
      "subcategory",
      "title",
      "summary",
      "body",
      "keywords",
      "risk_tags",
      "primary_documents",
      "controls",
      "payload",
      "created_at",
      "updated_at"
    ].join(",");
    const itemUrl = new URL("/rest/v1/safety_reference_items", url);
    itemUrl.searchParams.set("select", fields);
    itemUrl.searchParams.set("source_id", "eq.kosha-technical-support-regulations-2025");
    itemUrl.searchParams.set("order", "id.asc");
    const rows = [];
    for (const range of ["0-999", "1000-1999"]) {
      const response = await fetchWithRetry(itemUrl, {
        headers: { ...headers, Range: range, "Range-Unit": "items" }
      }, `Supabase ${credential.role} row probe ${range}`);
      if (!response.ok) {
        attempts.at(-1).reason = `row-http-${response.status}`;
        rows.length = 0;
        break;
      }
      const page = await response.json();
      if (!Array.isArray(page)) {
        attempts.at(-1).reason = "row-payload-invalid";
        rows.length = 0;
        break;
      }
      rows.push(...page);
      if (page.length < 1000) break;
    }
    if (rows.length) {
      return {
        available: true,
        reason: "ready",
        attempts,
        source: sources[0],
        rows,
        canonicalRowSha256: hashValue(canonicalGuideRows(rows))
      };
    }
  }
  return { available: false, reason: "credentials-rejected-or-source-empty", attempts, source: null, rows: [] };
}

async function fetchOfficialPage(category, current, page) {
  const body = {
    techGdlnCtgryCd: category,
    techGdlnSttsSeCdIng: current ? "1" : "0",
    techGdlnSttsSeCdDel: current ? "0" : "1",
    startDt: null,
    endDt: null,
    searchType: "all",
    searchVal: null,
    page,
    rowsPerPage: "100"
  };
  const response = await fetchWithRetry(OFFICIAL_API_URL, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body)
  }, `official KOSHA ${category}/${current ? "current" : "retired"}/${page}`);
  if (!response.ok) throw new Error(`official KOSHA returned HTTP ${response.status}`);
  const payload = await response.json();
  if (payload.result !== "success" || !payload.payload) {
    throw new Error(`official KOSHA payload invalid for ${category}/${page}`);
  }
  return payload.payload;
}

async function fetchOfficialState(current, toKoshaOfficialGuideRecord) {
  const rawRows = [];
  const categoryCounts = {};
  const emptyPages = [];
  let requestCount = 0;
  for (const category of OFFICIAL_CATEGORIES) {
    const first = await fetchOfficialPage(category, current, 1);
    requestCount += 1;
    const totalCount = Number(first.totalCount || 0);
    categoryCounts[category] = totalCount;
    const firstRows = Array.isArray(first.list) ? first.list : [];
    if (totalCount > 0 && !firstRows.length) emptyPages.push(`${category}:1`);
    rawRows.push(...firstRows);
    const pageCount = Math.ceil(totalCount / 100);
    for (let page = 2; page <= pageCount; page += 1) {
      const payload = await fetchOfficialPage(category, current, page);
      requestCount += 1;
      const rows = Array.isArray(payload.list) ? payload.list : [];
      if (!rows.length) emptyPages.push(`${category}:${page}`);
      rawRows.push(...rows);
    }
  }
  const records = rawRows
    .map(toKoshaOfficialGuideRecord)
    .filter(Boolean)
    .sort((left, right) => codepointCompare(left.code, right.code));
  return {
    records,
    categoryCounts,
    requestCount,
    emptyPages,
    malformedRowCount: rawRows.length - records.length,
    canonicalSha256: hashValue(records)
  };
}

async function probeOfficialUrls(records, buildKoshaOfficialDownloadUrl) {
  const codes = [...new Set(RETRIEVAL_SCENARIOS.flatMap((scenario) => scenario.expectedCodes))];
  const probes = [];
  for (const code of codes) {
    const record = records.find((candidate) => candidate.code === code);
    const url = record ? buildKoshaOfficialDownloadUrl(record) : null;
    if (!record || !url) {
      probes.push({ code, found: Boolean(record), url, ok: false, httpStatus: null, reason: "missing-provenance" });
      continue;
    }
    const started = performance.now();
    try {
      const response = await fetchWithRetry(url, { method: "HEAD" }, `official PDF ${code}`);
      const contentType = response.headers.get("content-type");
      const contentLength = Number(response.headers.get("content-length") || 0);
      probes.push({
        code,
        found: true,
        url,
        ok: response.ok && Boolean(contentType?.toLowerCase().includes("pdf")) && contentLength > 0,
        httpStatus: response.status,
        contentType,
        contentLength,
        elapsedMs: Math.round(performance.now() - started)
      });
    } catch (error) {
      probes.push({
        code,
        found: true,
        url,
        ok: false,
        httpStatus: null,
        reason: error instanceof Error ? error.message : String(error),
        elapsedMs: Math.round(performance.now() - started)
      });
    }
  }
  return probes;
}

async function fetchProductionRetrieval(productionBase, scenario, branch) {
  const url = new URL("/api/safety-reference/search", productionBase);
  url.searchParams.set("q", scenario.query);
  url.searchParams.set("limit", "12");
  if (branch === "technical-regulation") url.searchParams.set("itemType", "technical-support-regulation");
  if (branch === "source-rest") url.searchParams.set("sourceId", "kosha-technical-support-regulations-2025");
  const started = performance.now();
  const response = await fetchWithRetry(url, {}, `production retrieval ${scenario.id}/${branch}`);
  const payload = await response.json();
  return {
    scenarioId: scenario.id,
    requestedBranch: branch,
    httpStatus: response.status,
    ok: payload.ok === true,
    retrievalMode: typeof payload.retrievalMode === "string" ? payload.retrievalMode : "unknown",
    vectorSearch: payload.vectorSearch || null,
    count: typeof payload.count === "number" ? payload.count : 0,
    elapsedMs: Math.round(performance.now() - started),
    items: Array.isArray(payload.items) ? payload.items : [],
    message: typeof payload.message === "string" ? payload.message : ""
  };
}

async function auditProductionRetrieval(productionBase, auditKoshaRetrievalScenario) {
  const liveResults = [];
  const downstream = [];
  for (const scenario of RETRIEVAL_SCENARIOS) {
    const scenarioResults = [];
    for (const branch of ["catalog", "technical-regulation", "source-rest"]) {
      const result = await fetchProductionRetrieval(productionBase, scenario, branch);
      liveResults.push(result);
      scenarioResults.push(result);
    }
    const byId = new Map();
    for (const result of scenarioResults) {
      for (const item of result.items) {
        if (item && typeof item.id === "string") byId.set(item.id, item);
      }
    }
    const candidates = [...byId.values()];
    for (const branch of ["rest", "ranked", "hybrid"]) {
      downstream.push(auditKoshaRetrievalScenario(scenario, candidates, branch));
    }
  }
  return { liveResults, downstream };
}

function buildManifestCandidate(generatedAt, localArchive, supabaseVisible, officialSnapshot) {
  return {
    version: 1,
    measuredAt: generatedAt,
    localArchive: {
      archiveCount: localArchive.archiveCount,
      pdfEntryCount: localArchive.pdfEntryCount,
      entryManifestSha256: localArchive.entryManifestSha256,
      itemTypes: localArchive.itemTypes
    },
    supabaseVisible: {
      sourceId: supabaseVisible.sourceId,
      rowCount: supabaseVisible.rowCount,
      itemTypes: supabaseVisible.itemTypes,
      canonicalRowSha256: supabaseVisible.canonicalRowSha256 || null
    },
    officialSnapshot
  };
}

const CONTAMINATION_CONTROL_PATTERNS = {
  "machinery-control-cross-task": /가동부|방호덮개|비상정지/u,
  "forklift-control-cross-task": /지게차|보행자 동선과 장비 동선|후진 경보/u,
  "fire-chemical-control-cross-task": /MSDS|점화원|방폭|유기용제|도료/u
};

function selectContaminationExamples(rows) {
  const selected = [];
  const selectedIds = new Set();
  for (const flag of Object.keys(CONTAMINATION_CONTROL_PATTERNS)) {
    const row = rows.find((candidate) => candidate.flags.includes(flag) && !selectedIds.has(candidate.id));
    if (!row) continue;
    const pattern = CONTAMINATION_CONTROL_PATTERNS[flag];
    selected.push({
      id: row.id,
      title: row.title,
      flags: row.flags,
      matchedControls: row.controls.filter((control) => pattern.test(control))
    });
    selectedIds.add(row.id);
  }
  return selected;
}

function markdownCell(value) {
  return String(value).replaceAll("|", "/").replace(/\r?\n/gu, " ");
}

function formatMarkdown(report) {
  const comparison = report.inventory.officialComparison;
  const quality = report.corpusQuality;
  const checks = report.checks;
  const versionRows = comparison.versionMismatches.length
    ? comparison.versionMismatches.map((item) => `| \`${item.stableKey}\` | \`${item.officialCode}\` | \`${item.localCode}\` |`).join("\n")
    : "| - | - | - |";
  const checkRows = checks.map((check) =>
    `| \`${check.id}\` | ${check.status} | ${check.count.toLocaleString("ko-KR")} | ${check.detail.replaceAll("|", "/")} |`
  ).join("\n");
  const retrievalRows = report.retrieval.downstream.map((item) =>
    `| ${item.scenarioId} | ${item.branch} | ${item.selectedTitles.length} | ${item.failures.length} |`
  ).join("\n");
  const blockerRows = report.launchReadiness.blockers.map((item) =>
    `| ${item.rank} | ${item.severity} | \`${item.id}\` | ${item.count.toLocaleString("ko-KR")} | ${markdownCell(item.evidence)} | ${markdownCell(item.releaseCondition)} |`
  ).join("\n");
  const contaminationRows = report.launchReadiness.contaminationExamples.map((item) =>
    `| \`${item.id}\` | ${markdownCell(item.title)} | ${item.flags.map((flag) => `\`${flag}\``).join(", ")} | ${item.matchedControls.map(markdownCell).join(" / ")} |`
  ).join("\n") || "| - | - | - | - |";
  const duplicateDetails = [
    ...quality.duplicateSummaryDetails.slice(0, 3),
    ...quality.duplicateSummaryDetails.filter((item) => !item.templateFallback)
  ].filter((item, index, values) => values.findIndex((candidate) => candidate.summary === item.summary) === index);
  const duplicateDetailRows = duplicateDetails.map((item) =>
    `| ${item.rowCount.toLocaleString("ko-KR")} | ${item.templateFallback ? "fallback template" : "non-template"} | ${item.nonEmptyBodyRows.toLocaleString("ko-KR")} | ${markdownCell(item.summary)} |`
  ).join("\n") || "| 0 | - | 0 | - |";
  const dryRunCounts = report.refreshPlan.dryRun.counts;
  const fullRowStatement = report.inventory.directSupabaseProbe.available
    ? `Current live full-row ${report.inventory.directSupabaseProbe.rowCount.toLocaleString("ko-KR")}건과 canonical hash \`${report.inventory.directSupabaseProbe.canonicalRowSha256}\`를 직접 검증했다. 로컬 parsed hash와 live hash의 parity도 별도 check로 확인했다.`
    : `Current live full-row canonical hash와 created/updated range는 검증하지 못했다. 사유: ${report.inventory.directSupabaseProbe.reason}.`;
  const currentLiveRange = report.inventory.directSupabaseProbe.available
    ? `created ${report.inventory.directSupabaseProbe.createdAtRange.join(" ~ ")} / updated ${report.inventory.directSupabaseProbe.updatedAtRange.join(" ~ ")}`
    : "검증 불가";

  return `# KOSHA GUIDE corpus / harness audit

- generatedAt: ${report.generatedAt}
- readOnly: ${report.readOnly}
- dbMutationPerformed: ${report.dbMutationPerformed}
- uploadPerformed: ${report.uploadPerformed}
- elapsedSeconds: ${report.elapsed_seconds}

## 결론

**NOT launch-ready for authoritative KOSHA-guide grounding.** 로컬 ZIP과 current live Supabase의 ${report.inventory.supabaseVisible.rowCount.toLocaleString("ko-KR")}행 count/hash parity는 같은 corpus snapshot을 읽었다는 사실만 증명한다. authoritative 본문, item-level provenance, control causality, 공식 version/current-state 적합성은 증명하지 않는다.

로컬 ZIP 10개에는 PDF ${report.inventory.localArchive.pdfEntryCount.toLocaleString("ko-KR")}건이 있으며 production status도 KOSHA GUIDE ${report.inventory.supabaseVisible.rowCount.toLocaleString("ko-KR")}건을 노출한다. 공식 KOSHA 현행 목록은 ${report.inventory.official.current.count.toLocaleString("ko-KR")}건이다. 로컬은 현행 stable key를 모두 포함하지만 version 불일치 ${comparison.versionMismatches.length}건과 공식 폐지 ${comparison.staleLocalRows.length}건을 포함한다.

Production status는 fresh ${report.inventory.productionStatus.cache || "unknown"} 응답이다. ${fullRowStatement}

## Severity-ranked blockers

| rank | severity | blocker | rows | evidence | release condition |
|---:|---|---|---:|---|---|
${blockerRows}

## 정확한 건수

| 항목 | count |
|---|---:|
| 로컬 ZIP | ${report.inventory.localArchive.archiveCount} |
| 로컬 PDF | ${report.inventory.localArchive.pdfEntryCount} |
| 로컬 기술지원규정 | ${report.inventory.localArchive.itemTypes["technical-support-regulation"]} |
| 로컬 기술지침 | ${report.inventory.localArchive.itemTypes["technical-guideline"]} |
| production visible | ${report.inventory.supabaseVisible.rowCount} |
| 공식 현행 | ${report.inventory.official.current.count} |
| 공식 폐지 | ${report.inventory.official.retired.count} |
| version 불일치 | ${comparison.versionMismatches.length} |
| 폐지 local row | ${comparison.staleLocalRows.length} |
| 빈 body | ${quality.emptyBodyCount} |
| normalized exact-summary reuse group / rows | ${quality.duplicateSummaryGroups} / ${quality.duplicateSummaryRows} |
| fallback summary group / rows | ${quality.templatedFallbackSummaryGroups} / ${quality.templatedFallbackSummaryRows} |
| non-template duplicate summary group / rows | ${quality.nonTemplateDuplicateSummaryGroups} / ${quality.nonTemplateDuplicateSummaryRows} |
| non-empty exact-body duplicate candidates group / rows | ${quality.exactBodyDuplicateCandidateGroups} / ${quality.exactBodyDuplicateCandidateRows} |
| ZIP CRC32+size duplicate candidates group / rows | ${report.inventory.localArchive.duplicateContentCandidateGroups} / ${report.inventory.localArchive.duplicateContentCandidateRows} |
| raw-control initial heuristic rows | ${quality.rawInitialControlContaminationCount} |
| raw-control alias-cleared false-positive rows | ${quality.rawControlFalsePositiveCount} |
| raw-control alias-removed flags | ${quality.rawControlAliasRemovedFlagCount} |
| raw-control calibrated candidates | ${quality.rawControlContaminationCount} |
| operational initial heuristic rows | ${quality.operationalInitialControlContaminationCount} |
| operational alias-cleared false-positive rows | ${quality.operationalControlFalsePositiveCount} |
| operational alias-removed flags | ${quality.operationalControlAliasRemovedFlagCount} |
| operational calibrated candidates | ${quality.operationalControlContaminationCount} |

## Snapshot manifest gate (not readiness)

이 gate는 측정된 shape/count/hash snapshot의 재현성만 확인한다. launch readiness는 위 blocker table과 전체 checks에서 별도로 판정한다.

- local entry hash: \`${report.inventory.localArchive.entryManifestSha256}\`
- local parsed row hash: \`${report.inventory.localParsedCanonicalSha256}\`
- current live row hash: \`${report.inventory.directSupabaseProbe.canonicalRowSha256 || "unavailable"}\`
- official current hash: \`${report.inventory.official.current.canonicalSha256}\`
- official retired hash: \`${report.inventory.official.retired.canonicalSha256}\`
- snapshot manifest failures: ${report.manifestGate.failures.length ? report.manifestGate.failures.map((item) => `\`${item}\``).join(", ") : "없음 (shape/count/hash only; readiness blockers remain)"}

## Metadata / provenance

- source ID: \`${report.inventory.supabaseVisible.sourceId}\`
- item types: \`technical-support-regulation\`, \`technical-guideline\`
- local source publishedAt: ${report.inventory.localSource.published_at || "없음"}
- local source originUrl: ${report.inventory.localSource.origin_url || "없음"}
- previous Supabase source createdAt: ${report.inventory.previousSupabaseSnapshot.sourceCreatedAt || "검증 불가"}
- previous Supabase source updatedAt: ${report.inventory.previousSupabaseSnapshot.sourceUpdatedAt || "검증 불가"}
- official published range: ${report.inventory.official.current.publishedRange.join(" ~ ")}
- current live full-row created/updated range: ${currentLiveRange}
- DB item URL column: schema-absent; payload official URL provenance missing: ${quality.missingSourceUrlCount}
- DB item official file ID/published/status missing: ${quality.missingOfficialFileIdCount} / ${quality.missingOfficialPublishedAtCount} / ${quality.missingOfficialStatusCount}
- representative official PDF URL probes: ${report.officialUrlProbes.filter((item) => item.ok).length}/${report.officialUrlProbes.length}

## Duplicate-summary interpretation

${quality.duplicateSummaryRows.toLocaleString("ko-KR")}건은 normalized summary 문자열 재사용 수치이며 identical PDF 또는 identical full-content 수치가 아니다. 이 중 ${quality.templatedFallbackSummaryRows.toLocaleString("ko-KR")}건은 body가 비어 있는 category fallback template ${quality.templatedFallbackSummaryGroups}개이고, 나머지 ${quality.nonTemplateDuplicateSummaryRows}건은 non-template summary 재사용이다. non-empty extracted body의 exact-duplicate 후보는 ${quality.exactBodyDuplicateCandidateRows}건이며, ZIP binary 수준 CRC32+size duplicate 후보는 ${report.inventory.localArchive.duplicateContentCandidateRows}건이다.

| rows | classification | non-empty body rows | normalized summary |
|---:|---|---:|---|
${duplicateDetailRows}

## Representative calibrated contamination candidates

아래는 alias calibration 후에도 deterministic rule이 cross-task로 표시한 operational control 사례다. initial heuristic ${quality.operationalInitialControlContaminationCount}행 중 ${quality.operationalControlFalsePositiveCount}행은 legitimate alias로 완전히 해소되었고 ${quality.operationalControlAliasRemovedFlagCount}개 flag가 제거되었다. 남은 ${quality.operationalControlContaminationCount}행도 launch 전 source text 기반 재검토가 필요하며, 이 표 자체를 문서 내용의 최종 의미 판정으로 사용하지 않는다.

| row | title | flags | matched operational controls |
|---|---|---|---|
${contaminationRows}

## Version mismatch

| stable key | official | local |
|---|---|---|
${versionRows}

폐지 local row: ${comparison.staleLocalRows.map((item) => `\`${item.localCode} ${item.internalPath}\``).join(", ") || "없음"}

## Retrieval / reflection

Production search가 관측한 mode: ${[...new Set(report.retrieval.liveResults.map((item) => item.retrievalMode))].join(", ")}. Vector 상태는 ${[...new Set(report.retrieval.liveResults.map((item) => item.vectorSearch?.reason || "unknown"))].join(", ")}다. 실제 production ranked/hybrid branch는 관측되지 않았고, 현재 production에서 받은 KOSHA 행을 동일한 DB harness에 넣어 rest/ranked/hybrid downstream reflection 계약을 결정적으로 재실행했다.

| scenario | branch | selected evidence | failures |
|---|---|---:|---:|
${retrievalRows}

각 downstream record에는 selected title, prompt context, deterministic answer, document reflection label이 JSON 보고서에 보존된다. KOSHA code/title과 task-specific control이 함께 있어야 통과하며 generic prose만 있는 경우 실패한다.

## Refresh plan

현재 identity dry-run은 DB를 쓰지 않고 다음 diff를 산출했다.

| insert | update | retire | unchanged |
|---:|---:|---:|---:|
| ${dryRunCounts.insert} | ${dryRunCounts.update} | ${dryRunCounts.retire} | ${dryRunCounts.unchanged} |

1. **Approval gate 1:** 이 보고서와 per-item dry-run을 승인하기 전에는 DB update/retire/upload를 수행하지 않는다. schema 변경도 하지 않는다.
2. category + current/retired + page shard로 공식 목록을 증분 조회하고, publishedAt checkpoint와 stable key/version key를 함께 reconciliation한다.
3. empty page, 빈 file ID/seq, zero-byte 또는 empty-response 다운로드는 저장 후보에서 제외하고 shard failure로 기록한다.
4. identity diff ${dryRunCounts.insert}/${dryRunCounts.update}/${dryRunCounts.retire}/${dryRunCounts.unchanged}를 검토하고, update ${comparison.versionMismatches.length}건과 retire ${comparison.refreshDryRun.counts.retire}건의 공식 URL/hash를 개별 확인한다.
5. body가 빈 ${quality.emptyBodyCount}건을 shard별 HEAD/download/hash/text/OCR dry-run 대상으로 만들고, item-level URL/file ID/published/status ${quality.missingSourceUrlCount}건을 기존 필드에 backfill할 후보 JSON으로만 산출한다.
6. fallback/non-template summary ${quality.duplicateSummaryRows}건을 source-grounded abstract 후보로 교체하고 calibrated operational candidate ${quality.operationalControlContaminationCount}건의 controls를 본문 근거로 재도출한다.
7. representative high-risk retrieval을 rest/ranked/hybrid로 다시 실행해 KOSHA title, source URL, source-grounded control, document reflection이 모두 있는지 확인한다.
8. **Approval gate 2:** zero mutation dry-run artifact와 focused tests 승인 후에만 별도 작업에서 incremental mutation을 허용한다. 본 audit 실행은 계속 read-only다.

## Checks

| check | status | count | detail |
|---|---|---:|---|
${checkRows}

## 접근 경계

${report.boundaries.map((item) => `- ${item}`).join("\n")}

## 증거 URL

- 공식 목록: ${OFFICIAL_LIST_URL}
- 공식 목록 API: ${OFFICIAL_API_URL}
- production status: ${report.inventory.productionStatus.url}

## Commands

\`npm.cmd run audit:kosha-guides\`

\`npm.cmd test -- tests/kosha-guide-corpus-audit.test.ts\`

\`python -m unittest scripts.tests.test_snapshot_kosha_guide_corpus scripts.tests.test_ingest_safety_reference_catalog\`
`;
}

const options = parseArguments(process.argv.slice(2));
const started = performance.now();
const generatedAt = new Date().toISOString();
const outputDir = resolve(process.cwd(), options.outputDir);
mkdirSync(outputDir, { recursive: true });
const reportPath = resolve(outputDir, "report.json");
const markdownPath = resolve(outputDir, "report.md");
const logPath = resolve(outputDir, "audit.log");
const manifestCandidatePath = resolve(outputDir, "manifest-candidate.json");
const logLines = [`${generatedAt} KOSHA GUIDE audit started`, "readOnly=true dbMutationPerformed=false uploadPerformed=false"];

let moduleServer;
try {
  moduleServer = await createServer({
    root: process.cwd(),
    appType: "custom",
    logLevel: "silent",
    resolve: { alias: { "@": process.cwd() } },
    server: { middlewareMode: true }
  });
  const audit = await moduleServer.ssrLoadModule("/lib/kosha-guide-corpus-audit.ts");

  const technicalFolder = resolve(options.technicalFolder);
  const archiveEntries = readLocalArchiveEntries(technicalFolder, audit.decodeKoshaArchiveEntryName);
  const localArchive = audit.buildKoshaArchiveInventory(archiveEntries);
  const localParsed = readLocalParsedSnapshot(technicalFolder);
  const localRows = Array.isArray(localParsed.snapshot.items) ? localParsed.snapshot.items : [];
  const localParsedCanonicalSha256 = hashValue(canonicalGuideRows(localRows));
  logLines.push(`local archives=${localArchive.archiveCount} rows=${localArchive.pdfEntryCount} parsed=${localRows.length}`);

  const defaultEnvCandidates = [
    resolve(process.cwd(), ".env.local"),
    resolve(process.cwd(), "..", "..", ".env.local")
  ];
  const envFile = options.envFile
    ? resolve(options.envFile)
    : defaultEnvCandidates.find((candidate) => existsSync(candidate)) || null;
  const envLoaded = readEnvFile(envFile);

  let productionStatus = null;
  let supabaseProbe = { available: false, reason: "offline", attempts: [], source: null, rows: [] };
  let officialCurrent = null;
  let officialRetired = null;
  let officialUrlProbes = [];
  let retrieval = { liveResults: [], downstream: [] };

  if (!options.offline) {
    productionStatus = await fetchProductionStatus(options.productionBase, audit.summarizeKoshaVisibleStatus);
    supabaseProbe = await probeSupabaseFullRowsFromEnv();
    officialCurrent = await fetchOfficialState(true, audit.toKoshaOfficialGuideRecord);
    officialRetired = await fetchOfficialState(false, audit.toKoshaOfficialGuideRecord);
    officialUrlProbes = await probeOfficialUrls(officialCurrent.records, audit.buildKoshaOfficialDownloadUrl);
    retrieval = await auditProductionRetrieval(options.productionBase, audit.auditKoshaRetrievalScenario);
    logLines.push(`production status=${productionStatus.httpStatus} visibleRows=${productionStatus.visible?.rowCount || 0}`);
    logLines.push(`official current=${officialCurrent.records.length} retired=${officialRetired.records.length}`);
  }

  const previousReportPath = resolve(process.cwd(), "evaluation/2026-07-10-kosha-guide-supabase-audit-report.json");
  const previousReport = existsSync(previousReportPath)
    ? JSON.parse(readFileSync(previousReportPath, "utf8"))
    : null;
  const previousGuideSource = previousReport?.database?.guide_source || {};
  const previousSnapshot = {
    checkedAt: previousReport?.checked_at || null,
    rowCount: previousGuideSource.item_count || null,
    sourceCreatedAt: previousGuideSource.created_at || null,
    sourceUpdatedAt: previousGuideSource.updated_at || null,
    sourceOriginUrl: previousGuideSource.origin_url || null,
    bodyMissing: previousGuideSource.missing?.body ?? null,
    previousOfficialRetiredCount: previousReport?.official_kosha?.deleted_count ?? null,
    scope: "previous-read-only-full-row-snapshot"
  };

  const directVisible = supabaseProbe.available
    ? {
        sourceId: supabaseProbe.source?.id || audit.KOSHA_GUIDE_SOURCE_ID,
        rowCount: supabaseProbe.rows.length,
        itemTypes: {
          "technical-guideline": supabaseProbe.rows.filter((row) => row.item_type === "technical-guideline").length,
          "technical-support-regulation": supabaseProbe.rows.filter((row) => row.item_type === "technical-support-regulation").length
        },
        canonicalRowSha256: supabaseProbe.canonicalRowSha256
      }
    : null;
  const productionVisible = productionStatus?.visible || directVisible;
  if (!productionVisible) throw new Error("No Supabase-visible KOSHA count is available");
  const visibleReconciliation = audit.reconcileKoshaVisibleSnapshots(productionVisible, directVisible);
  const visible = visibleReconciliation.snapshot;
  if (!officialCurrent || !officialRetired) throw new Error("Official KOSHA snapshot is unavailable");

  const corpusRows = supabaseProbe.available ? supabaseProbe.rows : localRows;
  const corpusRowAuditRun1 = audit.auditKoshaGuideRows(corpusRows);
  const corpusRowAuditRun2 = audit.auditKoshaGuideRows(corpusRows);
  const operationalAuditHashRun1 = hashValue(corpusRowAuditRun1);
  const operationalAuditHashRun2 = hashValue(corpusRowAuditRun2);
  const operationalAuditDeterministic = operationalAuditHashRun1 === operationalAuditHashRun2;
  const liveCreatedAtRange = timestampRange(supabaseProbe.rows, "created_at");
  const liveUpdatedAtRange = timestampRange(supabaseProbe.rows, "updated_at");

  const officialSnapshot = {
    currentCount: officialCurrent.records.length,
    currentCanonicalSha256: officialCurrent.canonicalSha256,
    retiredCount: officialRetired.records.length,
    retiredCanonicalSha256: officialRetired.canonicalSha256
  };
  const manifestCandidate = buildManifestCandidate(generatedAt, localArchive, visible, officialSnapshot);
  writeFileSync(manifestCandidatePath, `${JSON.stringify(manifestCandidate, null, 2)}\n`, "utf8");

  const manifestPath = resolve(process.cwd(), options.manifest);
  const manifest = existsSync(manifestPath) ? JSON.parse(readFileSync(manifestPath, "utf8")) : null;
  const manifestFailures = manifest
    ? audit.listKoshaManifestGateFailures({
        localArchive,
        supabaseVisible: visible,
        officialSnapshot
      }, manifest)
    : ["manifest-unavailable"];

  const comparison = audit.compareKoshaInventoryToOfficial(
    archiveEntries,
    officialCurrent.records,
    officialRetired.records
  );
  const currentDates = officialCurrent.records.map((record) => record.publishedAt).filter(Boolean).sort(codepointCompare);
  const officialInventory = {
    listUrl: OFFICIAL_LIST_URL,
    apiUrl: OFFICIAL_API_URL,
    current: {
      count: officialCurrent.records.length,
      categoryCounts: officialCurrent.categoryCounts,
      fieldCounts: countBy(officialCurrent.records.map((record) => record.field)),
      statusCounts: countBy(officialCurrent.records.map((record) => record.status)),
      publishedRange: [currentDates[0] || null, currentDates.at(-1) || null],
      missingProvenanceCount: officialCurrent.records.filter((record) =>
        !record.fileId || record.fileSeq === null || !record.publishedAt
      ).length,
      duplicateStableKeyGroups: Object.values(countBy(officialCurrent.records.map((record) => record.stableKey)))
        .filter((count) => count > 1).length,
      malformedRowCount: officialCurrent.malformedRowCount,
      emptyPages: officialCurrent.emptyPages,
      requestCount: officialCurrent.requestCount,
      canonicalSha256: officialCurrent.canonicalSha256
    },
    retired: {
      count: officialRetired.records.length,
      categoryCounts: officialRetired.categoryCounts,
      malformedRowCount: officialRetired.malformedRowCount,
      emptyPages: officialRetired.emptyPages,
      requestCount: officialRetired.requestCount,
      canonicalSha256: officialRetired.canonicalSha256
    }
  };

  const downstreamFailures = retrieval.downstream.flatMap((item) =>
    item.failures.map((failure) => `${item.scenarioId}/${item.branch}:${failure}`)
  );
  const liveModes = [...new Set(retrieval.liveResults.map((item) => item.retrievalMode))];
  const liveVectorReasons = [...new Set(retrieval.liveResults.map((item) => item.vectorSearch?.reason || "unknown"))];
  const brokenUrlCount = officialUrlProbes.filter((probe) => !probe.ok).length;
  const checks = [
    {
      id: "manifest-gate",
      status: manifestFailures.length ? "fail" : "pass",
      count: manifestFailures.length,
      detail: manifestFailures.join(", ") || "snapshot shape/count/hash manifest matched; readiness evaluated separately"
    },
    {
      id: "local-empty-pdf",
      status: localArchive.emptyPdfEntryCount ? "fail" : "pass",
      count: localArchive.emptyPdfEntryCount,
      detail: "zero-byte PDF archive entries"
    },
    {
      id: "local-duplicate-content",
      status: localArchive.duplicateContentCandidateRows ? "fail" : "pass",
      count: localArchive.duplicateContentCandidateRows,
      detail: "same CRC32 and byte length candidates"
    },
    {
      id: "operational-audit-deterministic",
      status: operationalAuditDeterministic ? "pass" : "fail",
      count: operationalAuditDeterministic ? 0 : 1,
      detail: `${operationalAuditHashRun1} / ${operationalAuditHashRun2}`
    },
    {
      id: "source-mutation",
      status: corpusRowAuditRun1.sourceMutationCount ? "fail" : "pass",
      count: corpusRowAuditRun1.sourceMutationCount,
      detail: "derive operational metadata must not mutate source rows"
    },
    {
      id: "empty-body",
      status: corpusRowAuditRun1.emptyBodyCount ? "fail" : "pass",
      count: corpusRowAuditRun1.emptyBodyCount,
      detail: "local ingest-equivalent rows with empty body"
    },
    {
      id: "duplicate-summary",
      status: corpusRowAuditRun1.duplicateSummaryRows ? "fail" : "pass",
      count: corpusRowAuditRun1.duplicateSummaryRows,
      detail: `${corpusRowAuditRun1.duplicateSummaryGroups} normalized-summary groups; ${corpusRowAuditRun1.templatedFallbackSummaryRows} fallback rows; not an identical full-content count`
    },
    {
      id: "missing-source-url",
      status: corpusRowAuditRun1.missingSourceUrlCount ? "fail" : "pass",
      count: corpusRowAuditRun1.missingSourceUrlCount,
      detail: "item URL column is schema-absent; rows lack official URL provenance in payload aliases"
    },
    {
      id: "missing-official-file-id",
      status: corpusRowAuditRun1.missingOfficialFileIdCount ? "fail" : "pass",
      count: corpusRowAuditRun1.missingOfficialFileIdCount,
      detail: "rows without official file provenance"
    },
    {
      id: "missing-official-published-at",
      status: corpusRowAuditRun1.missingOfficialPublishedAtCount ? "fail" : "pass",
      count: corpusRowAuditRun1.missingOfficialPublishedAtCount,
      detail: "rows without official publication date"
    },
    {
      id: "missing-official-status",
      status: corpusRowAuditRun1.missingOfficialStatusCount ? "fail" : "pass",
      count: corpusRowAuditRun1.missingOfficialStatusCount,
      detail: "rows without current or retired state"
    },
    {
      id: "raw-tag-control-alias",
      status: corpusRowAuditRun1.rawTagStandaloneControlLeakCount ? "fail" : "pass",
      count: corpusRowAuditRun1.rawTagStandaloneControlLeakCount,
      detail: "raw risk tag emitted as a standalone control"
    },
    {
      id: "raw-control-initial-heuristic",
      status: "boundary",
      count: corpusRowAuditRun1.rawInitialControlContaminationCount,
      detail: "pre-calibration candidate rows; not a launch blocker count"
    },
    {
      id: "raw-control-alias-false-positive",
      status: "pass",
      count: corpusRowAuditRun1.rawControlFalsePositiveCount,
      detail: `${corpusRowAuditRun1.rawControlAliasRemovedFlagCount} initial flags removed by legitimate aliases`
    },
    {
      id: "raw-control-contamination",
      status: corpusRowAuditRun1.rawControlContaminationCount ? "fail" : "pass",
      count: corpusRowAuditRun1.rawControlContaminationCount,
      detail: "calibrated raw-control cross-domain candidates"
    },
    {
      id: "operational-control-initial-heuristic",
      status: "boundary",
      count: corpusRowAuditRun1.operationalInitialControlContaminationCount,
      detail: "pre-calibration candidate rows; not a launch blocker count"
    },
    {
      id: "operational-control-alias-false-positive",
      status: "pass",
      count: corpusRowAuditRun1.operationalControlFalsePositiveCount,
      detail: `${corpusRowAuditRun1.operationalControlAliasRemovedFlagCount} initial flags removed by legitimate aliases`
    },
    {
      id: "operational-control-contamination",
      status: corpusRowAuditRun1.operationalControlContaminationCount ? "fail" : "pass",
      count: corpusRowAuditRun1.operationalControlContaminationCount,
      detail: "calibrated cross-domain candidates remain after operational derivation"
    },
    {
      id: "official-current-stable-key-parity",
      status: comparison.officialMissingLocal.length ? "fail" : "pass",
      count: comparison.officialMissingLocal.length,
      detail: `${comparison.stableKeyMatches}/${officialCurrent.records.length} current stable keys found locally`
    },
    {
      id: "official-version-mismatch",
      status: comparison.versionMismatches.length ? "fail" : "pass",
      count: comparison.versionMismatches.length,
      detail: "stable key matched but canonical version code differed"
    },
    {
      id: "retired-local-row",
      status: comparison.staleLocalRows.length ? "fail" : "pass",
      count: comparison.staleLocalRows.length,
      detail: "local rows absent from current and present in retired list"
    },
    {
      id: "official-url-representative",
      status: brokenUrlCount ? "fail" : "pass",
      count: brokenUrlCount,
      detail: `${officialUrlProbes.length - brokenUrlCount}/${officialUrlProbes.length} representative PDF HEAD probes passed`
    },
    {
      id: "retrieval-document-reflection",
      status: downstreamFailures.length ? "fail" : "pass",
      count: downstreamFailures.length,
      detail: downstreamFailures.join(", ") || "KOSHA title, controls, and document labels surfaced"
    },
    {
      id: "supabase-visible-parity",
      status: visibleReconciliation.parityFailures.length ? "fail" : "pass",
      count: visibleReconciliation.parityFailures.length,
      detail: visibleReconciliation.parityFailures.join(", ") || "production status and direct full-row snapshot matched"
    },
    {
      id: "local-live-canonical-parity",
      status: !supabaseProbe.available
        ? "boundary"
        : localParsedCanonicalSha256 === supabaseProbe.canonicalRowSha256
          ? "pass"
          : "fail",
      count: !supabaseProbe.available || localParsedCanonicalSha256 === supabaseProbe.canonicalRowSha256 ? 0 : 1,
      detail: `${localParsedCanonicalSha256} / ${supabaseProbe.canonicalRowSha256 || "unavailable"}`
    },
    {
      id: "current-live-full-row-hash",
      status: supabaseProbe.available ? "pass" : "boundary",
      count: supabaseProbe.available ? 0 : 1,
      detail: supabaseProbe.available ? supabaseProbe.canonicalRowSha256 : supabaseProbe.reason
    },
    {
      id: "production-ranked-branch",
      status: liveModes.includes("ranked-rpc") ? "pass" : "boundary",
      count: liveModes.includes("ranked-rpc") ? 0 : 1,
      detail: `observed modes: ${liveModes.join(", ") || "none"}`
    },
    {
      id: "production-hybrid-branch",
      status: liveModes.includes("hybrid-vector-rpc") ? "pass" : "boundary",
      count: liveModes.includes("hybrid-vector-rpc") ? 0 : 1,
      detail: `observed vector states: ${liveVectorReasons.join(", ") || "none"}`
    }
  ];
  const verification = audit.summarizeKoshaAuditChecks(checks);
  const boundaries = [
    supabaseProbe.available
      ? "Current live full-row Supabase snapshot was available."
      : `Current live full-row Supabase snapshot was unavailable: ${supabaseProbe.reason}; attempts=${supabaseProbe.attempts.map((item) => `${item.role}:${item.httpStatus}${item.reason ? `/${item.reason}` : ""}`).join(", ") || "none"}.`,
    `Production status remained visible through ${options.productionBase}/api/safety-reference/status.`,
    `Production retrieval modes observed: ${liveModes.join(", ") || "none"}; vector states: ${liveVectorReasons.join(", ") || "none"}.`,
    `The official list probe read ${officialCurrent.records.length} current and ${officialRetired.records.length} retired rows; only ${officialUrlProbes.length} representative PDF URLs received HEAD probes.`,
    "No DB schema change, upload, embedding generation, or data mutation was performed."
  ];

  const productionBranchBoundaryCount = Number(!liveModes.includes("ranked-rpc")) +
    Number(!liveModes.includes("hybrid-vector-rpc"));
  const versionStateBlockerCount = comparison.versionMismatches.length + comparison.refreshDryRun.counts.retire;
  const launchBlockers = [
    {
      rank: 1,
      severity: "BLOCKER",
      id: "authoritative-body-empty",
      count: corpusRowAuditRun1.emptyBodyCount,
      evidence: `${corpusRowAuditRun1.emptyBodyCount} rows have no parsed body; count/hash parity cannot ground answers in missing text`,
      releaseCondition: "source PDF text or reviewed OCR body is non-empty and hash/provenance linked"
    },
    {
      rank: 2,
      severity: "BLOCKER",
      id: "item-provenance-missing",
      count: corpusRowAuditRun1.missingSourceUrlCount,
      evidence: `item URL column schema-absent; payload URL/file ID/published/status missing ${corpusRowAuditRun1.missingSourceUrlCount}/${corpusRowAuditRun1.missingOfficialFileIdCount}/${corpusRowAuditRun1.missingOfficialPublishedAtCount}/${corpusRowAuditRun1.missingOfficialStatusCount}`,
      releaseCondition: "every launch row resolves to official item URL, file ID, publication date, and current/retired state"
    },
    {
      rank: 3,
      severity: "HIGH",
      id: "operational-control-calibrated-candidate",
      count: corpusRowAuditRun1.operationalControlContaminationCount,
      evidence: `${corpusRowAuditRun1.operationalInitialControlContaminationCount} initial rows; ${corpusRowAuditRun1.operationalControlFalsePositiveCount} fully cleared false positives; ${corpusRowAuditRun1.operationalControlAliasRemovedFlagCount} flags removed; ${corpusRowAuditRun1.operationalControlContaminationCount} calibrated candidate rows remain`,
      releaseCondition: "remaining controls are re-derived from source body and cross-domain fixtures pass"
    },
    {
      rank: 4,
      severity: "HIGH",
      id: "official-version-or-state-drift",
      count: versionStateBlockerCount,
      evidence: `${comparison.versionMismatches.length} current version mismatches and ${comparison.refreshDryRun.counts.retire} officially retired local row`,
      releaseCondition: "official current version replaces stale version and retired rows are excluded after approval"
    },
    {
      rank: 5,
      severity: "HIGH",
      id: "summary-not-source-grounded",
      count: corpusRowAuditRun1.duplicateSummaryRows,
      evidence: `${corpusRowAuditRun1.templatedFallbackSummaryRows} fallback-template rows plus ${corpusRowAuditRun1.nonTemplateDuplicateSummaryRows} non-template reused summaries; not identical full-content count`,
      releaseCondition: "source-grounded summaries replace fallback and bullet-only values"
    },
    {
      rank: 6,
      severity: "MEDIUM",
      id: "production-retrieval-branch-unobserved",
      count: productionBranchBoundaryCount,
      evidence: `observed modes ${liveModes.join(", ") || "none"}; vector states ${liveVectorReasons.join(", ") || "none"}`,
      releaseCondition: "ranked and hybrid production branches are observed with KOSHA evidence reflection"
    }
  ].filter((item) => item.count > 0);
  const launchReadyForAuthoritativeGrounding = launchBlockers.length === 0;
  const contaminationExamples = selectContaminationExamples(
    corpusRowAuditRun1.operationalControlContaminationRows
  );
  const deterministicResultSha256 = hashValue({
    localArchive,
    localParsedCanonicalSha256,
    visible,
    officialSnapshot,
    corpusQuality: corpusRowAuditRun1,
    comparison,
    checks,
    retrieval: retrieval.downstream.map((item) => ({
      scenarioId: item.scenarioId,
      branch: item.branch,
      selectedIds: item.selectedIds,
      documentReflections: item.documentReflections,
      failures: item.failures
    }))
  });

  const elapsedSeconds = Number(((performance.now() - started) / 1000).toFixed(3));
  const report = {
    schemaVersion: "safeclaw-kosha-guide-audit/v2",
    generatedAt,
    readOnly: true,
    dbMutationPerformed: false,
    uploadPerformed: false,
    item_count: localRows.length,
    success_count: localRows.length,
    failure_count: 0,
    collection_count_semantics: "success_count and failure_count describe deterministic local ZIP parsing; verification failures and access boundaries are separate",
    elapsed_seconds: elapsedSeconds,
    launchReadiness: {
      launchReadyForAuthoritativeGrounding,
      conclusion: launchReadyForAuthoritativeGrounding
        ? "READY for authoritative KOSHA-guide grounding"
        : "NOT launch-ready for authoritative KOSHA-guide grounding",
      parityScope: "count/hash parity proves snapshot identity only, not content authority or provenance completeness",
      blockers: launchBlockers,
      contaminationExamples
    },
    determinism: {
      stableFieldsSha256: deterministicResultSha256,
      excludesVolatileFields: ["generatedAt", "elapsed_seconds", "network response dates and latencies"],
      operationalAuditRepeatMatched: operationalAuditDeterministic
    },
    verification,
    manifestGate: {
      scope: "snapshot-shape-count-hash-only",
      isLaunchReadinessGate: false,
      manifestPath,
      manifestAvailable: Boolean(manifest),
      failures: manifestFailures,
      candidatePath: manifestCandidatePath
    },
    inventory: {
      localArchive,
      localParsedCanonicalSha256,
      localSource: localParsed.snapshot.source,
      provenanceSchema: {
        itemUrlColumn: "schema-absent",
        evaluatedPayloadUrlAliases: [
          "officialDownloadUrl",
          "official_download_url",
          "officialUrl",
          "official_url",
          "sourceUrl",
          "source_url",
          "downloadUrl",
          "download_url"
        ],
        schemaMutationPerformed: false
      },
      supabaseVisible: visible,
      productionStatus: {
        url: `${options.productionBase}/api/safety-reference/status`,
        httpStatus: productionStatus?.httpStatus || null,
        checkedAt: productionStatus?.checkedAt || null,
        cache: productionStatus?.cache || null,
        matchedPath: productionStatus?.matchedPath || null,
        message: productionStatus?.message || null
      },
      directSupabaseProbe: {
        available: supabaseProbe.available,
        reason: supabaseProbe.reason,
        attempts: supabaseProbe.attempts,
        rowCount: supabaseProbe.rows.length,
        canonicalRowSha256: supabaseProbe.canonicalRowSha256 || null,
        createdAtRange: liveCreatedAtRange,
        updatedAtRange: liveUpdatedAtRange,
        source: supabaseProbe.source
      },
      previousSupabaseSnapshot: previousSnapshot,
      official: officialInventory,
      officialComparison: comparison
    },
    corpusQuality: {
      scope: supabaseProbe.available ? "current-live-full-row" : "current-local-ingest-equivalent",
      ...corpusRowAuditRun1,
      operationalAuditHashRun1,
      operationalAuditHashRun2,
      deterministic: operationalAuditDeterministic,
      parserNoticeCount: localParsed.notices.length,
      parserNotices: localParsed.notices
    },
    officialUrlProbes,
    retrieval: {
      productionBase: options.productionBase,
      liveResults: retrieval.liveResults.map((item) => ({
        ...item,
        items: item.items.map((candidate) => ({
          id: candidate.id,
          sourceId: candidate.source_id,
          itemType: candidate.item_type,
          title: candidate.title,
          sourceUrl: candidate.source_url || null,
          retrievalSource: candidate.retrieval_source || null,
          controls: candidate.controls,
          documents: candidate.primary_documents
        }))
      })),
      downstream: retrieval.downstream,
      failures: downstreamFailures
    },
    refreshPlan: {
      ...audit.KOSHA_GUIDE_REFRESH_PLAN,
      dryRun: comparison.refreshDryRun,
      repairCandidates: {
        hydrateBody: corpusRowAuditRun1.emptyBodyCount,
        provenanceBackfill: corpusRowAuditRun1.missingSourceUrlCount,
        summaryRegeneration: corpusRowAuditRun1.duplicateSummaryRows,
        calibratedControlReview: corpusRowAuditRun1.operationalControlContaminationCount
      },
      approvalGate: {
        currentState: "blocked-before-mutation",
        mutationAllowedByThisRun: false,
        requiredBeforeMutation: "reviewed per-item dry-run and explicit approval in a separate task"
      }
    },
    checks,
    boundaries,
    artifacts: {
      reportPath,
      markdownPath,
      logPath,
      manifestCandidatePath
    },
    environment: {
      envFileConfigured: Boolean(envFile),
      envFileLoaded: envLoaded,
      offline: options.offline,
      strict: options.strict
    }
  };

  writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  writeFileSync(markdownPath, `${formatMarkdown(report).trim()}\n`, "utf8");
  logLines.push(`checks=${verification.checkCount} failed=${verification.failedCheckCount} boundaries=${verification.boundaryCheckCount}`);
  logLines.push(`report=${reportPath}`);
  logLines.push(`elapsedSeconds=${elapsedSeconds}`);
  writeFileSync(logPath, `${logLines.join("\n")}\n`, "utf8");

  console.log(JSON.stringify({
    item_count: report.item_count,
    success_count: report.success_count,
    failure_count: report.failure_count,
    elapsed_seconds: report.elapsed_seconds,
    verification,
    manifestFailures,
    reportPath,
    markdownPath,
    logPath,
    manifestCandidatePath
  }, null, 2));

  if (options.strict && (verification.failedCheckCount > 0 || manifestFailures.length > 0)) {
    process.exitCode = 1;
  }
} catch (error) {
  const message = error instanceof Error ? error.stack || error.message : String(error);
  logLines.push(`fatal=${message}`);
  writeFileSync(logPath, `${logLines.join("\n")}\n`, "utf8");
  console.error(message);
  process.exitCode = 1;
} finally {
  if (moduleServer) await moduleServer.close();
}
