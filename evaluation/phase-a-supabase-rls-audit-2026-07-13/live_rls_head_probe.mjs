import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_OUTPUT = path.join(SCRIPT_DIR, "live-probe-result.json");
const REQUEST_TIMEOUT_MS = 20_000;
const TABLES = [
  "query_logs",
  "documents",
  "organizations",
  "sites",
  "workers",
  "workpacks",
  "education_records",
  "dispatch_logs",
  "daily_entries",
  "knowledge_events",
  "knowledge_regeneration_runs",
  "safety_reference_sources",
  "safety_reference_items",
  "safety_reference_ingestion_runs",
  "mcp_tokens",
  "safety_ontology_nodes",
  "safety_ontology_edges",
  "workpack_share_sessions",
  "workpack_read_confirmations",
  "workpack_improvements",
  "workpack_improvement_photos",
  "safety_reference_embeddings"
];

function parseArgs(argv) {
  const options = {
    output: DEFAULT_OUTPUT,
    envFile: null,
    useDefaultEnvFiles: true
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--output") options.output = argv[index += 1] || DEFAULT_OUTPUT;
    else if (arg === "--env-file") options.envFile = argv[index += 1] || null;
    else if (arg === "--no-env-file") options.useDefaultEnvFiles = false;
    else if (arg === "--help") {
      console.log("Usage: node live_rls_head_probe.mjs [--output FILE] [--env-file FILE] [--no-env-file]");
      process.exit(0);
    } else {
      throw new Error("unsupported_argument");
    }
  }

  return options;
}

function loadEnvFile(filePath, target) {
  if (!filePath || !fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) return false;
  for (const rawLine of fs.readFileSync(filePath, "utf8").split(/\r?\n/u)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const separator = line.indexOf("=");
    if (separator < 1) continue;
    const name = line.slice(0, separator).trim();
    const value = line.slice(separator + 1).trim().replace(/^['"]|['"]$/g, "");
    if (name && !target[name]) target[name] = value;
  }
  return true;
}

function loadEnvironment(options) {
  const env = { ...process.env };
  const candidates = [];
  if (options.envFile) candidates.push(path.resolve(options.envFile));
  if (options.useDefaultEnvFiles) {
    candidates.push(path.resolve(process.cwd(), ".env.local"));
    candidates.push(path.resolve(SCRIPT_DIR, "..", "..", "..", "..", ".env.local"));
  }
  const loaded = Array.from(new Set(candidates)).some((candidate) => loadEnvFile(candidate, env));
  return { env, loaded };
}

function parseCount(contentRange) {
  const match = String(contentRange || "").match(/\/(\d+|\*)$/u);
  return match && match[1] !== "*" ? Number(match[1]) : null;
}

async function probeTable(baseUrl, key, table) {
  try {
    const response = await fetch(`${baseUrl}/rest/v1/${table}?select=*`, {
      method: "HEAD",
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        Prefer: "count=exact",
        Range: "0-0",
        "Range-Unit": "items"
      }
    });
    return {
      attempted: true,
      method: "HEAD",
      status: response.status,
      count: response.ok ? parseCount(response.headers.get("content-range")) : null,
      networkError: false
    };
  } catch {
    return {
      attempted: true,
      method: "HEAD",
      status: null,
      count: null,
      networkError: true
    };
  }
}

function summarizeStatuses(results) {
  const counts = {};
  for (const result of results) {
    const key = result.networkError ? "network_error" : String(result.status);
    counts[key] = (counts[key] || 0) + 1;
  }
  return counts;
}

function writeResult(output, result) {
  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.writeFileSync(output, `${JSON.stringify(result, null, 2)}\n`, "utf8");
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const { env, loaded } = loadEnvironment(options);
  const supabaseUrl = env.SUPABASE_URL || "";
  const publicUrl = env.NEXT_PUBLIC_SUPABASE_URL || "";
  const baseUrl = (supabaseUrl || publicUrl).replace(/\/$/u, "");
  const credentials = [
    { label: "service_role", value: env.SUPABASE_SERVICE_ROLE_KEY || "" },
    { label: "anon", value: env.NEXT_PUBLIC_SUPABASE_ANON_KEY || env.SUPABASE_ANON_KEY || "" }
  ];
  const configured = Boolean(baseUrl) && credentials.every((credential) => Boolean(credential.value));
  const baseResult = {
    schemaVersion: "phase-a-supabase-rls-live-probe/v1",
    generatedAt: new Date().toISOString(),
    probe: "supabase-rest-table-head-count-exact",
    mode: "read-only",
    mutationPerformed: false,
    failClosed: true,
    tableCount: TABLES.length,
    credentialCount: credentials.length,
    expectedRequestCount: TABLES.length * credentials.length,
    requestTimeoutMs: REQUEST_TIMEOUT_MS,
    requestMethodsAllowed: ["HEAD", "GET"],
    requestMethodsUsed: configured ? ["HEAD"] : [],
    secretSafety: {
      urlStored: false,
      hostStored: false,
      keyStored: false,
      responseBodyStored: false,
      exceptionTextStored: false
    },
    configuration: {
      envFileLoaded: loaded,
      supabaseUrlPresent: Boolean(supabaseUrl),
      nextPublicSupabaseUrlPresent: Boolean(publicUrl),
      urlValuesEqual: Boolean(supabaseUrl && publicUrl) ? supabaseUrl === publicUrl : null,
      serviceRoleKeyPresent: Boolean(credentials[0].value),
      anonKeyPresent: Boolean(credentials[1].value)
    }
  };

  if (!configured) {
    const result = {
      ...baseResult,
      status: "blocked",
      reason: "required_configuration_unavailable",
      attemptedRequestCount: 0,
      statusCounts: {},
      liveAssertionsVerified: 0,
      results: []
    };
    writeResult(options.output, result);
    console.log(JSON.stringify({ status: result.status, reason: result.reason, attemptedRequestCount: 0 }));
    process.exit(2);
  }

  const results = [];
  for (const table of TABLES) {
    const credentialResults = {};
    for (const credential of credentials) {
      credentialResults[credential.label] = await probeTable(baseUrl, credential.value, table);
    }
    results.push({ table, credentials: credentialResults });
  }

  const flatResults = results.flatMap((entry) => Object.values(entry.credentials));
  const allSuccessful = flatResults.length === baseResult.expectedRequestCount
    && flatResults.every((result) => !result.networkError && result.status >= 200 && result.status < 300);
  const result = {
    ...baseResult,
    status: allSuccessful ? "completed-read-only" : "blocked",
    reason: allSuccessful ? "all_head_requests_succeeded" : "one_or_more_requests_failed",
    attemptedRequestCount: flatResults.length,
    statusCounts: summarizeStatuses(flatResults),
    liveAssertionsVerified: 0,
    results
  };
  writeResult(options.output, result);
  console.log(JSON.stringify({
    status: result.status,
    reason: result.reason,
    attemptedRequestCount: result.attemptedRequestCount,
    statusCounts: result.statusCounts
  }));
  process.exit(allSuccessful ? 0 : 1);
}

main().catch(() => {
  console.error("probe execution failed");
  process.exit(2);
});
