import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import crypto from "node:crypto";
import { execFileSync } from "node:child_process";

const DEFAULT_OUTPUT = "evaluation/sif-embedding-gate/approval-preflight-report.json";
const DEFAULT_GATE_DIR = "evaluation/sif-embedding-gate";
const DEFAULT_MIGRATION = "evaluation/sif-embedding-gate/sif-embedding-only-migration.sql";
const DEFAULT_SCRIPT = "scripts/prepare_sif_embedding_corpus.mjs";
const DEFAULT_ENV_FILES = [".env.local"];

function parseArgs(argv) {
  const options = {
    gateDir: DEFAULT_GATE_DIR,
    migrationPath: DEFAULT_MIGRATION,
    scriptPath: DEFAULT_SCRIPT,
    output: DEFAULT_OUTPUT,
    requireExecutionEnv: false,
    envFiles: [...DEFAULT_ENV_FILES]
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--gate-dir") options.gateDir = argv[index += 1] || DEFAULT_GATE_DIR;
    else if (arg === "--migration") options.migrationPath = argv[index += 1] || DEFAULT_MIGRATION;
    else if (arg === "--script") options.scriptPath = argv[index += 1] || DEFAULT_SCRIPT;
    else if (arg === "--output") options.output = argv[index += 1] || DEFAULT_OUTPUT;
    else if (arg === "--env-file") options.envFiles.push(argv[index += 1] || ".env.local");
    else if (arg === "--no-env-file") options.envFiles = [];
    else if (arg === "--require-execution-env") options.requireExecutionEnv = true;
    else if (arg === "--help") {
      console.log("Usage: node scripts/sif_embedding_approval_preflight.mjs [--gate-dir DIR] [--migration FILE] [--script FILE] [--output FILE] [--env-file FILE] [--no-env-file] [--require-execution-env]");
      process.exit(0);
    }
  }

  return options;
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

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function fileExists(filePath) {
  return fs.existsSync(filePath) && fs.statSync(filePath).isFile();
}

function countJsonlLines(filePath) {
  if (!fileExists(filePath)) return 0;
  const content = fs.readFileSync(filePath, "utf8").trim();
  if (!content) return 0;
  return content.split(/\r?\n/).length;
}

function sha256File(filePath) {
  return crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex");
}

function fileIntegrity(filePath) {
  const stat = fs.statSync(filePath);
  return {
    path: filePath,
    bytes: stat.size,
    sha256: sha256File(filePath)
  };
}

function resolveSourceSha() {
  try {
    return execFileSync("git", ["rev-parse", "HEAD"], {
      cwd: process.cwd(),
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"]
    }).trim();
  } catch {
    return "unknown";
  }
}

function boolEnv(name) {
  return Boolean(process.env[name]?.trim());
}

function findChecks(report, manifest, corpusLineCount, vectorsPath, migrationSql, scriptSource, migrationPath, scriptPath) {
  const lowerMigrationSql = migrationSql.toLowerCase();
  return [
    {
      id: "sif_source_count",
      passed: report.itemCount === 6033 && report.skippedCount === 1 && report.corpusCount === 6032,
      evidence: { itemCount: report.itemCount, skippedCount: report.skippedCount, corpusCount: report.corpusCount }
    },
    {
      id: "manifest_matches_report",
      passed: manifest.recordCount === report.corpusCount
        && manifest.batchSize === report.batchSize
        && manifest.batchCount === report.batchCount
        && manifest.corpusHash === report.corpusHash,
      evidence: {
        manifestRecordCount: manifest.recordCount,
        reportCorpusCount: report.corpusCount,
        manifestBatchCount: manifest.batchCount,
        reportBatchCount: report.batchCount,
        manifestCorpusHash: manifest.corpusHash,
        reportCorpusHash: report.corpusHash
      }
    },
    {
      id: "corpus_jsonl_matches_report",
      passed: corpusLineCount === report.corpusCount,
      evidence: { corpusLineCount, reportCorpusCount: report.corpusCount }
    },
    {
      id: "corpus_quality_gate",
      passed: report.validation?.emptyEmbeddingTextCount === 0
        && report.validation?.missingControlsCount === 0
        && report.validation?.missingPrimaryDocumentsCount === 0
        && report.validation?.duplicateContentHashCount === 0,
      evidence: {
        emptyEmbeddingTextCount: report.validation?.emptyEmbeddingTextCount,
        missingControlsCount: report.validation?.missingControlsCount,
        missingPrimaryDocumentsCount: report.validation?.missingPrimaryDocumentsCount,
        duplicateContentHashCount: report.validation?.duplicateContentHashCount
      }
    },
    {
      id: "no_embedding_generated_yet",
      passed: report.embeddedCount === 0 && report.uploadedCount === 0 && !vectorsPath,
      evidence: { embeddedCount: report.embeddedCount, uploadedCount: report.uploadedCount, vectorsPath }
    },
    {
      id: "embedding_requires_explicit_cost_approval_flag",
      passed: scriptSource.includes("--embed requires explicit --approved-embedding after embedding cost approval")
        && scriptSource.includes("options.approvedEmbedding"),
      evidence: { scriptPath }
    },
    {
      id: "upload_requires_explicit_approval_flag",
      passed: scriptSource.includes("--upload requires explicit --approved-upload after DB migration approval")
        && scriptSource.includes("options.upload && !options.approvedUpload"),
      evidence: { scriptPath }
    },
    {
      id: "migration_contains_embedding_table_rpc_index",
      passed: migrationSql.includes("create table if not exists safety_reference_embeddings")
        && migrationSql.includes("embedding vector(1536)")
        && migrationSql.includes("idx_safety_reference_embeddings_vector_cosine")
        && migrationSql.includes("using hnsw (embedding vector_cosine_ops)")
        && migrationSql.includes("create or replace function match_safety_reference_embeddings"),
      evidence: { migrationPath }
    },
    {
      id: "migration_keeps_embeddings_server_side",
      passed: migrationSql.includes("alter table safety_reference_embeddings enable row level security")
        && migrationSql.includes("on safety_reference_embeddings for select")
        && migrationSql.includes("using (false)"),
      evidence: { table: "safety_reference_embeddings", publicSelect: false }
    },
    {
      id: "migration_scope_is_sif_embedding_only",
      passed: migrationPath.includes("sif-embedding-only")
        ? !lowerMigrationSql.includes("workpack_share_sessions")
          && !lowerMigrationSql.includes("workpack_read_confirmations")
          && !lowerMigrationSql.includes("workpack_improvements")
          && !lowerMigrationSql.includes("report_snapshots")
          && !lowerMigrationSql.includes("export_jobs")
        : true,
      evidence: {
        migrationPath,
        sifOnly: migrationPath.includes("sif-embedding-only")
      }
    }
  ];
}

function summarizeEnv(requireExecutionEnv) {
  const env = {
    openaiApiKeyPresent: boolEnv("OPENAI_API_KEY"),
    supabaseUrlPresent: boolEnv("SUPABASE_URL") || boolEnv("NEXT_PUBLIC_SUPABASE_URL"),
    supabaseServiceRolePresent: boolEnv("SUPABASE_SERVICE_ROLE_KEY"),
    vectorFeatureFlagEnabled: process.env.SAFETY_REFERENCE_VECTOR_SEARCH === "1"
  };
  const executionEnvReady = env.openaiApiKeyPresent && env.supabaseUrlPresent && env.supabaseServiceRolePresent;
  return {
    ...env,
    executionEnvReady,
    requireExecutionEnv,
    envFailure: requireExecutionEnv && !executionEnvReady
  };
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  const envFilesLoaded = Array.from(new Set(options.envFiles)).filter(readEnvFile);
  const reportPath = path.join(options.gateDir, "report.json");
  const manifestPath = path.join(options.gateDir, "sif-embedding-batch-manifest.json");
  const corpusPath = path.join(options.gateDir, "sif-embedding-corpus.jsonl");
  const requiredFiles = [reportPath, manifestPath, corpusPath, options.migrationPath, options.scriptPath];
  const missingFiles = requiredFiles.filter((filePath) => !fileExists(filePath));

  if (missingFiles.length) {
    const failed = {
      generatedAt: new Date().toISOString(),
      ok: false,
      reason: "missing_required_files",
      missingFiles
    };
    fs.mkdirSync(path.dirname(options.output), { recursive: true });
    fs.writeFileSync(options.output, `${JSON.stringify(failed, null, 2)}\n`, "utf8");
    console.log(JSON.stringify(failed, null, 2));
    process.exit(1);
  }

  const report = readJson(reportPath);
  const manifest = readJson(manifestPath);
  const corpusLineCount = countJsonlLines(corpusPath);
  const vectorsPath = report.vectorsPath && fileExists(report.vectorsPath) ? report.vectorsPath : null;
  const migrationSql = fs.readFileSync(options.migrationPath, "utf8");
  const scriptSource = fs.readFileSync(options.scriptPath, "utf8");
  const sourceSha = resolveSourceSha();
  const artifactIntegrity = [
    fileIntegrity(reportPath),
    fileIntegrity(manifestPath),
    fileIntegrity(corpusPath),
    fileIntegrity(options.migrationPath),
    fileIntegrity(options.scriptPath)
  ];
  const env = summarizeEnv(options.requireExecutionEnv);
  const checks = [
    ...findChecks(report, manifest, corpusLineCount, vectorsPath, migrationSql, scriptSource, options.migrationPath, options.scriptPath),
    {
      id: "preflight_source_sha_recorded",
      passed: /^[0-9a-f]{40}$/u.test(sourceSha),
      evidence: { sourceSha }
    },
    {
      id: "artifact_integrity_recorded",
      passed: artifactIntegrity.every((artifact) => artifact.bytes > 0 && /^[0-9a-f]{64}$/u.test(artifact.sha256)),
      evidence: {
        artifactCount: artifactIntegrity.length,
        paths: artifactIntegrity.map((artifact) => artifact.path)
      }
    },
    {
      id: "vector_feature_flag_stays_off_until_upload_verified",
      passed: !env.vectorFeatureFlagEnabled || report.uploadedCount === report.corpusCount,
      evidence: {
        vectorFeatureFlagEnabled: env.vectorFeatureFlagEnabled,
        uploadedCount: report.uploadedCount,
        corpusCount: report.corpusCount
      }
    }
  ];
  const failedChecks = checks.filter((check) => !check.passed);
  const approvalHeld = true;
  const executionReadyAfterApproval = env.executionEnvReady;
  const ok = failedChecks.length === 0 && !env.envFailure;

  const result = {
    generatedAt: new Date().toISOString(),
    scope: "sif_embedding_next_approval_gate_preflight",
    sourceSha,
    ok,
    approvalHeld,
    dbMutationPerformed: false,
    embeddingGenerated: false,
    uploaded: false,
    commandHeldUntilApproval: "npm.cmd run knowledge:sif-embedding-corpus -- --embed --approved-embedding --upload --approved-upload",
    reportPath,
    manifestPath,
    corpusPath,
    migrationPath: options.migrationPath,
    scriptPath: options.scriptPath,
    corpusHash: report.corpusHash,
    corpusCount: report.corpusCount,
    batchCount: report.batchCount,
    batchSize: report.batchSize,
    embeddingModel: report.embeddingModel,
    embeddingDimensions: report.embeddingDimensions,
    artifactIntegrity,
    checks,
    failedCheckIds: failedChecks.map((check) => check.id),
    env,
    envFilesLoaded,
    executionReadyAfterApproval,
    nextApprovalDecisions: [
      "Approve and apply the SIF-only embedding migration, or explicitly choose the broader 010_commercial_operations.sql gate.",
      "Confirm OPENAI_API_KEY and Supabase service role are available in the execution environment.",
      "Run embedding generation only with --embed --approved-embedding.",
      "Run embedding upload only with --embed --approved-embedding --upload --approved-upload.",
      "Verify uploaded row count equals 6032 before enabling SAFETY_REFERENCE_VECTOR_SEARCH=1.",
      "Enable runtime vector retrieval after RPC smoke test passes."
    ]
  };

  fs.mkdirSync(path.dirname(options.output), { recursive: true });
  fs.writeFileSync(options.output, `${JSON.stringify(result, null, 2)}\n`, "utf8");
  console.log(JSON.stringify(result, null, 2));
  if (!ok) process.exit(1);
}

main();
