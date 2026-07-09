import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const DEFAULT_OUTPUT = "evaluation/sif-embedding-gate/post-migration-verify.json";
const DEFAULT_GATE_DIR = "evaluation/sif-embedding-gate";
const DEFAULT_MODEL = "text-embedding-3-small";
const DEFAULT_DIMENSIONS = 1536;
const DEFAULT_ENV_FILES = [".env.local"];

function parseArgs(argv) {
  const options = {
    output: DEFAULT_OUTPUT,
    gateDir: DEFAULT_GATE_DIR,
    model: DEFAULT_MODEL,
    dimensions: DEFAULT_DIMENSIONS,
    envFiles: [...DEFAULT_ENV_FILES],
    fixture: "",
    requireVectorFlag: false
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--output") options.output = argv[index += 1] || DEFAULT_OUTPUT;
    else if (arg === "--gate-dir") options.gateDir = argv[index += 1] || DEFAULT_GATE_DIR;
    else if (arg === "--model") options.model = argv[index += 1] || DEFAULT_MODEL;
    else if (arg === "--dimensions") options.dimensions = Number(argv[index += 1] || DEFAULT_DIMENSIONS);
    else if (arg === "--env-file") options.envFiles.push(argv[index += 1] || ".env.local");
    else if (arg === "--no-env-file") options.envFiles = [];
    else if (arg === "--fixture") options.fixture = argv[index += 1] || "";
    else if (arg === "--require-vector-flag") options.requireVectorFlag = true;
    else if (arg === "--help") {
      console.log([
        "Usage: node scripts/sif_embedding_post_migration_verify.mjs [options]",
        "",
        "Read-only checks after the approved SIF-only migration and embedding upload.",
        "",
        "Options:",
        "  --output FILE              Write report JSON",
        "  --gate-dir DIR             Read fixed corpus report from this directory",
        "  --model MODEL              Expected embedding model",
        "  --dimensions N             Expected embedding dimensions",
        "  --env-file FILE            Load env file before probing",
        "  --no-env-file              Do not load .env.local",
        "  --fixture FILE             Use fixture JSON instead of network calls",
        "  --require-vector-flag      Require SAFETY_REFERENCE_VECTOR_SEARCH=1 for ready status"
      ].join("\n"));
      process.exit(0);
    }
  }

  return options;
}

function fileExists(filePath) {
  return fs.existsSync(filePath) && fs.statSync(filePath).isFile();
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function readEnvFile(filePath) {
  if (!filePath || !fileExists(filePath)) return false;
  for (const line of fs.readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;
    const [key, ...rest] = trimmed.split("=");
    const name = key.trim();
    if (!name || process.env[name]) continue;
    process.env[name] = rest.join("=").trim().replace(/^['"]|['"]$/g, "");
  }
  return true;
}

function resolveConfig() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) {
    return {
      ok: false,
      reason: "missing_supabase_env",
      url: null,
      serviceRoleKey: null
    };
  }
  return {
    ok: true,
    reason: "configured",
    url: url.replace(/\/$/, ""),
    serviceRoleKey
  };
}

function parseContentRange(value) {
  if (!value) return null;
  const match = value.match(/\/(\d+|\*)$/);
  if (!match || match[1] === "*") return null;
  return Number(match[1]);
}

async function restCount(config, table, query) {
  const params = new URLSearchParams(query);
  params.set("select", "id");
  params.set("limit", "1");
  const response = await fetch(`${config.url}/rest/v1/${table}?${params.toString()}`, {
    headers: {
      apikey: config.serviceRoleKey,
      Authorization: `Bearer ${config.serviceRoleKey}`,
      Prefer: "count=exact"
    }
  });
  const body = response.ok ? "" : await response.text().catch(() => "");
  return {
    ok: response.ok,
    status: response.status,
    count: response.ok ? parseContentRange(response.headers.get("content-range")) : null,
    error: body || null
  };
}

async function restSample(config, model) {
  const params = new URLSearchParams();
  params.set("select", "reference_item_id,embedding_model,metadata,created_at");
  params.set("embedding_model", `eq.${model}`);
  params.set("limit", "3");
  const response = await fetch(`${config.url}/rest/v1/safety_reference_embeddings?${params.toString()}`, {
    headers: {
      apikey: config.serviceRoleKey,
      Authorization: `Bearer ${config.serviceRoleKey}`
    }
  });
  const text = await response.text().catch(() => "");
  return {
    ok: response.ok,
    status: response.status,
    rows: response.ok ? JSON.parse(text) : [],
    error: response.ok ? null : text
  };
}

function deterministicProbeVector(dimensions) {
  return Array.from({ length: dimensions }, (_, index) => index === 0 ? 1 : 0);
}

async function probeRpc(config, dimensions, model) {
  const response = await fetch(`${config.url}/rest/v1/rpc/match_safety_reference_embeddings`, {
    method: "POST",
    headers: {
      apikey: config.serviceRoleKey,
      Authorization: `Bearer ${config.serviceRoleKey}`,
      "content-type": "application/json"
    },
    body: JSON.stringify({
      query_embedding: deterministicProbeVector(dimensions),
      match_count: 3,
      item_type_filter: "sif-case"
    })
  });
  const text = await response.text().catch(() => "");
  let rows = [];
  if (response.ok) {
    try {
      const parsed = JSON.parse(text);
      rows = Array.isArray(parsed) ? parsed : [];
    } catch {
      rows = [];
    }
  }
  return {
    ok: response.ok,
    status: response.status,
    rowCount: rows.length,
    sampleTitles: rows.slice(0, 3).map((row) => typeof row?.title === "string" ? row.title : "").filter(Boolean),
    model,
    error: response.ok ? null : text
  };
}

async function collectRuntimeChecks(config, options) {
  return {
    safetyReferenceItems: await restCount(config, "safety_reference_items", { item_type: "eq.sif-case" }),
    safetyReferenceEmbeddings: await restCount(config, "safety_reference_embeddings", {
      embedding_model: `eq.${options.model}`
    }),
    embeddingSamples: await restSample(config, options.model),
    matchRpc: await probeRpc(config, options.dimensions, options.model)
  };
}

function collectFixtureChecks(fixturePath) {
  const fixture = readJson(fixturePath);
  return {
    safetyReferenceItems: fixture.safetyReferenceItems || null,
    safetyReferenceEmbeddings: fixture.safetyReferenceEmbeddings || null,
    embeddingSamples: fixture.embeddingSamples || null,
    matchRpc: fixture.matchRpc || null
  };
}

function buildStatus(input) {
  if (!input.configured) return "unconfigured";
  if (!input.tableOk || !input.rpcOk) return "migration-required";
  if (input.uploadedCount === 0) return "upload-required";
  if (input.uploadedCount !== input.expectedCount) return "upload-count-mismatch";
  if (input.requireVectorFlag && !input.vectorFlagEnabled) return "vector-flag-required";
  return "ready";
}

function buildChecks(input) {
  return [
    {
      id: "sif_source_count_still_matches",
      passed: input.sifCount === 6033,
      evidence: { expected: 6033, actual: input.sifCount }
    },
    {
      id: "embedding_table_ready",
      passed: input.tableOk,
      evidence: { status: input.tableStatus, count: input.uploadedCount }
    },
    {
      id: "uploaded_row_count_matches_corpus",
      passed: input.uploadedCount === input.expectedCount,
      evidence: { expected: input.expectedCount, actual: input.uploadedCount }
    },
    {
      id: "match_rpc_ready",
      passed: input.rpcOk,
      evidence: { status: input.rpcStatus, rowCount: input.rpcRowCount }
    },
    {
      id: "embedding_samples_have_metadata",
      passed: input.samplesOk,
      evidence: { sampleCount: input.sampleCount }
    },
    {
      id: "vector_feature_flag_allowed",
      passed: !input.vectorFlagEnabled || (input.uploadedCount === input.expectedCount && input.rpcOk),
      evidence: {
        vectorFeatureFlagEnabled: input.vectorFlagEnabled,
        uploadedCount: input.uploadedCount,
        rpcOk: input.rpcOk
      }
    }
  ];
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const envFilesLoaded = Array.from(new Set(options.envFiles)).filter(readEnvFile);
  const reportPath = path.join(options.gateDir, "report.json");
  const fixedReport = fileExists(reportPath) ? readJson(reportPath) : {};
  const expectedCount = Number(fixedReport.corpusCount || 6032);
  const config = options.fixture ? { ok: true, reason: "fixture", url: null, serviceRoleKey: null } : resolveConfig();
  const runtime = config.ok
    ? options.fixture
      ? collectFixtureChecks(options.fixture)
      : await collectRuntimeChecks(config, options)
    : {
        safetyReferenceItems: null,
        safetyReferenceEmbeddings: null,
        embeddingSamples: null,
        matchRpc: null
      };
  const uploadedCount = Number(runtime.safetyReferenceEmbeddings?.count || 0);
  const sifCount = Number(runtime.safetyReferenceItems?.count || 0);
  const sampleRows = Array.isArray(runtime.embeddingSamples?.rows) ? runtime.embeddingSamples.rows : [];
  const samplesOk = sampleRows.length > 0
    && sampleRows.every((row) => row && typeof row.reference_item_id === "string" && row.embedding_model === options.model);
  const vectorFlagEnabled = process.env.SAFETY_REFERENCE_VECTOR_SEARCH === "1";
  const facts = {
    configured: config.ok,
    tableOk: Boolean(runtime.safetyReferenceEmbeddings?.ok),
    tableStatus: runtime.safetyReferenceEmbeddings?.status || null,
    rpcOk: Boolean(runtime.matchRpc?.ok),
    rpcStatus: runtime.matchRpc?.status || null,
    rpcRowCount: Number(runtime.matchRpc?.rowCount || 0),
    uploadedCount,
    expectedCount,
    sifCount,
    samplesOk,
    sampleCount: sampleRows.length,
    vectorFlagEnabled,
    requireVectorFlag: options.requireVectorFlag
  };
  const checks = buildChecks(facts);
  const failedCheckIds = checks.filter((check) => !check.passed).map((check) => check.id);
  const status = buildStatus(facts);
  const result = {
    generatedAt: new Date().toISOString(),
    scope: "sif_embedding_post_migration_verify",
    dbMutationPerformed: false,
    configured: config.ok,
    configReason: config.reason,
    envFilesLoaded,
    model: options.model,
    dimensions: options.dimensions,
    expectedCorpusCount: expectedCount,
    fixedCorpusHash: fixedReport.corpusHash || null,
    status,
    ok: status === "ready",
    checks,
    failedCheckIds,
    safetyReferenceItems: runtime.safetyReferenceItems,
    safetyReferenceEmbeddings: runtime.safetyReferenceEmbeddings,
    embeddingSamples: runtime.embeddingSamples,
    matchRpc: runtime.matchRpc,
    featureFlag: {
      vectorSearchEnabled: vectorFlagEnabled,
      requireVectorFlag: options.requireVectorFlag
    },
    nextAction: status === "ready"
      ? "Vector retrieval is ready for runtime use after operator approval."
      : status === "vector-flag-required"
        ? "Set SAFETY_REFERENCE_VECTOR_SEARCH=1 only after row count and RPC smoke stay green."
        : status === "upload-count-mismatch"
          ? "Do not enable vector search. Reconcile safety_reference_embeddings row count with the fixed SIF corpus."
          : status === "upload-required"
            ? "Run the approved embedding upload command and verify row count again."
            : status === "migration-required"
              ? "Apply the approved SIF-only migration before upload verification."
              : "Configure Supabase service role env and run the verifier again."
  };

  fs.mkdirSync(path.dirname(options.output), { recursive: true });
  fs.writeFileSync(options.output, `${JSON.stringify(result, null, 2)}\n`, "utf8");
  console.log(JSON.stringify(result, null, 2));
  if (!result.ok) process.exit(1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
