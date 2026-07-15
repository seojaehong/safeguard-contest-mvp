import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const DEFAULT_OUTPUT = "evaluation/sif-embedding-gate/runtime-db-probe.json";
const DEFAULT_MODEL = "text-embedding-3-small";
const DEFAULT_DIMENSIONS = 1536;

function parseArgs(argv) {
  const options = {
    output: DEFAULT_OUTPUT,
    model: DEFAULT_MODEL,
    dimensions: DEFAULT_DIMENSIONS,
    envFiles: [".env.local"]
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--output") options.output = argv[index += 1] || DEFAULT_OUTPUT;
    else if (arg === "--model") options.model = argv[index += 1] || DEFAULT_MODEL;
    else if (arg === "--dimensions") options.dimensions = Number(argv[index += 1] || DEFAULT_DIMENSIONS);
    else if (arg === "--env-file") options.envFiles.push(argv[index += 1] || ".env.local");
    else if (arg === "--no-env-file") options.envFiles = [];
    else if (arg === "--help") {
      console.log("Usage: node scripts/sif_embedding_runtime_probe.mjs [--output FILE] [--model MODEL] [--dimensions N] [--env-file FILE] [--no-env-file]");
      process.exit(0);
    }
  }

  return options;
}

function fileExists(filePath) {
  return fs.existsSync(filePath) && fs.statSync(filePath).isFile();
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

async function probeRpc(config, dimensions, model) {
  const queryEmbedding = Array.from({ length: dimensions }, () => 0);
  const response = await fetch(`${config.url}/rest/v1/rpc/match_safety_reference_embeddings`, {
    method: "POST",
    headers: {
      apikey: config.serviceRoleKey,
      Authorization: `Bearer ${config.serviceRoleKey}`,
      "content-type": "application/json"
    },
    body: JSON.stringify({
      query_embedding: queryEmbedding,
      match_count: 1,
      item_type_filter: "sif-case"
    })
  });
  const text = await response.text().catch(() => "");
  let rowCount = null;
  if (response.ok) {
    try {
      const parsed = JSON.parse(text);
      rowCount = Array.isArray(parsed) ? parsed.length : null;
    } catch {
      rowCount = null;
    }
  }
  return {
    ok: response.ok,
    status: response.status,
    rowCount,
    model,
    error: response.ok ? null : text
  };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const envFilesLoaded = Array.from(new Set(options.envFiles)).filter(readEnvFile);
  const config = resolveConfig();
  const result = {
    generatedAt: new Date().toISOString(),
    scope: "sif_embedding_runtime_db_probe",
    dbMutationPerformed: false,
    model: options.model,
    dimensions: options.dimensions,
    envFilesLoaded,
    configured: config.ok,
    safetyReferenceItems: null,
    safetyReferenceEmbeddings: null,
    matchRpc: null,
    featureFlag: {
      vectorSearchEnabled: process.env.SAFETY_REFERENCE_VECTOR_SEARCH === "1"
    },
    status: "unconfigured",
    message: ""
  };

  if (!config.ok) {
    result.message = "Supabase service role env가 없어 DB runtime probe를 실행하지 않았습니다.";
  } else {
    result.safetyReferenceItems = await restCount(config, "safety_reference_items", { item_type: "eq.sif-case" });
    result.safetyReferenceEmbeddings = await restCount(config, "safety_reference_embeddings", {
      embedding_model: `eq.${options.model}`
    });
    result.matchRpc = await probeRpc(config, options.dimensions, options.model);
    const embeddingsReady = result.safetyReferenceEmbeddings.ok && Number(result.safetyReferenceEmbeddings.count || 0) > 0;
    const rpcReady = result.matchRpc.ok;
    result.status = embeddingsReady && rpcReady ? "ready" : rpcReady ? "schema-ready-empty" : "migration-required";
    result.message = embeddingsReady && rpcReady
      ? "SIF embedding table and RPC are ready with uploaded rows."
      : rpcReady
        ? "SIF embedding table/RPC exist, but uploaded embedding rows are not ready."
        : "SIF embedding table/RPC is not ready on the target DB. Apply approved migration before upload.";
  }

  fs.mkdirSync(path.dirname(options.output), { recursive: true });
  fs.writeFileSync(options.output, `${JSON.stringify(result, null, 2)}\n`, "utf8");
  console.log(JSON.stringify(result, null, 2));
  if (result.status === "unconfigured") process.exit(1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
