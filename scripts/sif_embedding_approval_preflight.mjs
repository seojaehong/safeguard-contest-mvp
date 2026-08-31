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

function sha256File(filePath) {
  return crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex");
}

function sha256Text(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function isNonEmptyStringArray(value) {
  return Array.isArray(value) && value.length > 0 && value.every(isNonEmptyString);
}

function isStringArray(value) {
  return Array.isArray(value) && value.every(isNonEmptyString);
}

function inspectCorpus(filePath) {
  const content = fs.readFileSync(filePath, "utf8").trim();
  const lines = content ? content.split(/\r?\n/) : [];
  const records = [];
  const parseErrors = [];
  const invalidRecords = [];

  for (const [index, line] of lines.entries()) {
    let record;
    try {
      record = JSON.parse(line);
    } catch (error) {
      parseErrors.push({
        line: index + 1,
        message: error instanceof Error ? error.message : String(error)
      });
      continue;
    }

    const failedFields = [];
    if (!record || typeof record !== "object" || Array.isArray(record)) {
      failedFields.push("record");
    } else {
      if (!isNonEmptyString(record.referenceItemId)) failedFields.push("referenceItemId");
      if (record.itemType !== "sif-case") failedFields.push("itemType");
      if (!isNonEmptyString(record.title)) failedFields.push("title");
      if (!isNonEmptyString(record.category)) failedFields.push("category");
      if (!isStringArray(record.riskTags)) failedFields.push("riskTags");
      if (!isNonEmptyStringArray(record.controls)) failedFields.push("controls");
      if (!isNonEmptyStringArray(record.primaryDocuments)) failedFields.push("primaryDocuments");
      if (!isNonEmptyString(record.embeddingText)) failedFields.push("embeddingText");
      if (!/^[0-9a-f]{64}$/u.test(record.contentHash || "")) failedFields.push("contentHash");
      if (isNonEmptyString(record.embeddingText) && record.contentHash !== sha256Text(record.embeddingText)) {
        failedFields.push("contentHashMatchesEmbeddingText");
      }
    }

    if (failedFields.length > 0) {
      invalidRecords.push({
        line: index + 1,
        referenceItemId: isNonEmptyString(record?.referenceItemId) ? record.referenceItemId : null,
        failedFields
      });
    }
    records.push(record);
  }

  const referenceItemIds = records
    .map((record) => record?.referenceItemId)
    .filter(isNonEmptyString);
  const contentHashes = records
    .map((record) => record?.contentHash)
    .filter((value) => /^[0-9a-f]{64}$/u.test(value || ""));
  const duplicateValues = (values) => {
    const seen = new Set();
    const duplicates = new Set();
    for (const value of values) {
      if (seen.has(value)) duplicates.add(value);
      seen.add(value);
    }
    return [...duplicates];
  };
  const computedCorpusHash = records.length > 0
    && parseErrors.length === 0
    && invalidRecords.length === 0
    ? sha256Text(records.map((record) => `${record.referenceItemId}:${record.contentHash}`).join("\n"))
    : null;

  return {
    lineCount: lines.length,
    records,
    referenceItemIds,
    contentHashes,
    parseErrors,
    invalidRecords,
    duplicateReferenceItemIds: duplicateValues(referenceItemIds),
    duplicateContentHashes: duplicateValues(contentHashes),
    computedCorpusHash
  };
}

function inspectManifestBatches(manifest, corpusInspection) {
  const batches = Array.isArray(manifest.batches) ? manifest.batches : [];
  const records = corpusInspection.records;
  const failures = [];
  const flattenedReferenceItemIds = [];

  for (const [index, batch] of batches.entries()) {
    const startIndex = batch?.startIndex;
    const endIndexExclusive = batch?.endIndexExclusive;
    const expectedRecords = Number.isInteger(startIndex) && Number.isInteger(endIndexExclusive)
      ? records.slice(startIndex, endIndexExclusive)
      : [];
    const expectedIds = expectedRecords.map((record) => record?.referenceItemId);
    const actualIds = Array.isArray(batch?.referenceItemIds) ? batch.referenceItemIds : [];
    flattenedReferenceItemIds.push(...actualIds);
    const expectedBatchHash = expectedRecords.length > 0
      ? sha256Text(expectedRecords.map((record) => record?.contentHash).join("\n"))
      : null;
    const passed = batch?.batchId === `sif-embed-${String(index + 1).padStart(4, "0")}`
      && startIndex === index * manifest.batchSize
      && endIndexExclusive === Math.min(startIndex + manifest.batchSize, records.length)
      && batch?.recordCount === expectedRecords.length
      && JSON.stringify(actualIds) === JSON.stringify(expectedIds)
      && batch?.contentHash === expectedBatchHash;
    if (!passed) {
      failures.push({
        batchIndex: index,
        batchId: batch?.batchId || null,
        startIndex: startIndex ?? null,
        endIndexExclusive: endIndexExclusive ?? null
      });
    }
  }

  return {
    batchCount: batches.length,
    failures,
    flattenedReferenceItemIds,
    matchesCorpus: failures.length === 0
      && batches.length === manifest.batchCount
      && JSON.stringify(flattenedReferenceItemIds) === JSON.stringify(corpusInspection.referenceItemIds)
  };
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

function inspectMigrationScope(migrationSql) {
  const normalized = migrationSql.toLowerCase();
  const withoutFunctionBodies = normalized.replace(/\$([a-z0-9_]*)\$[\s\S]*?\$\1\$/giu, " $$body$$ ");
  const violations = [];
  const inspectedObjects = [];
  const recordTargets = (pattern, kind, allowed) => {
    for (const match of withoutFunctionBodies.matchAll(pattern)) {
      const target = match[1]?.replaceAll('"', "") || "unknown";
      inspectedObjects.push({ kind, target });
      if (!allowed(target, match)) violations.push(`${kind}:${target}`);
    }
  };

  recordTargets(
    /\b(?:create\s+table(?:\s+if\s+not\s+exists)?|alter\s+table|drop\s+table(?:\s+if\s+exists)?|truncate\s+table)\s+([a-z0-9_."]+)/giu,
    "table",
    (target) => target === "safety_reference_embeddings"
  );
  recordTargets(
    /\bcreate\s+(?:unique\s+)?index(?:\s+if\s+not\s+exists)?\s+([a-z0-9_."]+)\s+on\s+([a-z0-9_."]+)/giu,
    "index",
    (target, match) => target.startsWith("idx_safety_reference_embeddings_")
      && match[2]?.replaceAll('"', "") === "safety_reference_embeddings"
  );
  recordTargets(
    /\b(?:create\s+or\s+replace\s+function|create\s+function|alter\s+function|drop\s+function(?:\s+if\s+exists)?)\s+([a-z0-9_."]+)/giu,
    "function",
    (target) => target === "match_safety_reference_embeddings"
  );
  recordTargets(
    /\bcreate\s+extension(?:\s+if\s+not\s+exists)?\s+([a-z0-9_."]+)/giu,
    "extension",
    (target) => target === "vector"
  );
  recordTargets(
    /\b(?:create|drop)\s+policy(?:\s+if\s+exists)?\s+(?:"[^"]+"|[a-z0-9_]+)\s+on\s+([a-z0-9_."]+)/giu,
    "policy-table",
    (target) => target === "safety_reference_embeddings"
  );

  const forbiddenTopLevelOperations = [
    /\binsert\s+into\b/iu,
    /\bupdate\s+[a-z0-9_."]+\s+set\b/iu,
    /\bdelete\s+from\b/iu,
    /\bgrant\s+\S+\s+on\b/iu,
    /\brevoke\s+\S+\s+on\b/iu,
    /\bcreate\s+(?:or\s+replace\s+)?(?:trigger|schema|role|view|materialized\s+view)\b/iu,
    /\balter\s+(?:schema|role|view|materialized\s+view)\b/iu
  ];
  for (const pattern of forbiddenTopLevelOperations) {
    if (pattern.test(withoutFunctionBodies)) violations.push(`operation:${pattern.source}`);
  }

  const allowedStatementStarts = [
    /^create\s+extension(?:\s+if\s+not\s+exists)?\s+vector\b/iu,
    /^create\s+table(?:\s+if\s+not\s+exists)?\s+safety_reference_embeddings\b/iu,
    /^create\s+(?:unique\s+)?index(?:\s+if\s+not\s+exists)?\s+idx_safety_reference_embeddings_[a-z0-9_]+\s+on\s+safety_reference_embeddings\b/iu,
    /^create\s+or\s+replace\s+function\s+match_safety_reference_embeddings\b/iu,
    /^comment\s+on\s+function\s+match_safety_reference_embeddings\b/iu,
    /^alter\s+table\s+safety_reference_embeddings\b/iu,
    /^drop\s+policy(?:\s+if\s+exists)?\s+(?:"[^"]+"|[a-z0-9_]+)\s+on\s+safety_reference_embeddings\b/iu,
    /^create\s+policy\s+(?:"[^"]+"|[a-z0-9_]+)\s+on\s+safety_reference_embeddings\b/iu
  ];
  const topLevelStatements = withoutFunctionBodies
    .replace(/--.*$/gmu, "")
    .split(";")
    .map((statement) => statement.trim())
    .filter(Boolean);
  for (const statement of topLevelStatements) {
    if (!allowedStatementStarts.some((pattern) => pattern.test(statement))) {
      violations.push(`statement:${statement.replace(/\s+/gu, " ").slice(0, 120)}`);
    }
  }

  return {
    sifOnly: violations.length === 0,
    inspectedObjects,
    inspectedStatementCount: topLevelStatements.length,
    violations: [...new Set(violations)]
  };
}

function findChecks(report, manifest, corpusInspection, manifestInspection, vectorsPath, migrationSql, scriptSource, migrationPath, scriptPath) {
  const migrationScope = inspectMigrationScope(migrationSql);
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
      passed: corpusInspection.lineCount === report.corpusCount,
      evidence: { corpusLineCount: corpusInspection.lineCount, reportCorpusCount: report.corpusCount }
    },
    {
      id: "corpus_record_integrity",
      passed: corpusInspection.parseErrors.length === 0 && corpusInspection.invalidRecords.length === 0,
      evidence: {
        parsedRecordCount: corpusInspection.records.length,
        parseErrorCount: corpusInspection.parseErrors.length,
        invalidRecordCount: corpusInspection.invalidRecords.length,
        parseErrorSamples: corpusInspection.parseErrors.slice(0, 5),
        invalidRecordSamples: corpusInspection.invalidRecords.slice(0, 5)
      }
    },
    {
      id: "corpus_record_identity_unique",
      passed: corpusInspection.duplicateReferenceItemIds.length === 0
        && corpusInspection.duplicateContentHashes.length === 0,
      evidence: {
        duplicateReferenceItemIdCount: corpusInspection.duplicateReferenceItemIds.length,
        duplicateContentHashCount: corpusInspection.duplicateContentHashes.length,
        duplicateReferenceItemIdSamples: corpusInspection.duplicateReferenceItemIds.slice(0, 5),
        duplicateContentHashSamples: corpusInspection.duplicateContentHashes.slice(0, 5)
      }
    },
    {
      id: "corpus_hash_matches_report_and_manifest",
      passed: Boolean(corpusInspection.computedCorpusHash)
        && corpusInspection.computedCorpusHash === report.corpusHash
        && corpusInspection.computedCorpusHash === manifest.corpusHash,
      evidence: {
        computedCorpusHash: corpusInspection.computedCorpusHash,
        reportCorpusHash: report.corpusHash,
        manifestCorpusHash: manifest.corpusHash
      }
    },
    {
      id: "manifest_batches_match_corpus",
      passed: manifestInspection.matchesCorpus,
      evidence: {
        inspectedBatchCount: manifestInspection.batchCount,
        expectedBatchCount: manifest.batchCount,
        failedBatchCount: manifestInspection.failures.length,
        failedBatchSamples: manifestInspection.failures.slice(0, 5)
      }
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
      passed: migrationScope.sifOnly,
      evidence: {
        migrationPath,
        fileNameSuggestsSifOnly: migrationPath.includes("sif-embedding-only"),
        sifOnly: migrationScope.sifOnly,
        inspectedObjects: migrationScope.inspectedObjects,
        inspectedStatementCount: migrationScope.inspectedStatementCount,
        violations: migrationScope.violations
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
  const requiredFiles = [...new Set([
    reportPath,
    manifestPath,
    corpusPath,
    DEFAULT_MIGRATION,
    options.migrationPath,
    options.scriptPath
  ])];
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
  const corpusInspection = inspectCorpus(corpusPath);
  const manifestInspection = inspectManifestBatches(manifest, corpusInspection);
  const vectorsPath = report.vectorsPath && fileExists(report.vectorsPath) ? report.vectorsPath : null;
  const migrationSql = fs.readFileSync(options.migrationPath, "utf8");
  const scriptSource = fs.readFileSync(options.scriptPath, "utf8");
  const sourceSha = resolveSourceSha();
  const canonicalMigrationIntegrity = fileIntegrity(DEFAULT_MIGRATION);
  const selectedMigrationIntegrity = fileIntegrity(options.migrationPath);
  const artifactIntegrity = [
    fileIntegrity(reportPath),
    fileIntegrity(manifestPath),
    fileIntegrity(corpusPath),
    selectedMigrationIntegrity,
    fileIntegrity(options.scriptPath)
  ];
  const env = summarizeEnv(options.requireExecutionEnv);
  const checks = [
    ...findChecks(report, manifest, corpusInspection, manifestInspection, vectorsPath, migrationSql, scriptSource, options.migrationPath, options.scriptPath),
    {
      id: "migration_digest_matches_canonical_approval_artifact",
      passed: selectedMigrationIntegrity.sha256 === canonicalMigrationIntegrity.sha256,
      evidence: {
        canonicalMigrationPath: DEFAULT_MIGRATION,
        canonicalMigrationSha256: canonicalMigrationIntegrity.sha256,
        selectedMigrationPath: options.migrationPath,
        selectedMigrationSha256: selectedMigrationIntegrity.sha256
      }
    },
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
    migrationDigestBinding: {
      canonicalMigrationPath: DEFAULT_MIGRATION,
      canonicalMigrationSha256: canonicalMigrationIntegrity.sha256,
      selectedMigrationSha256: selectedMigrationIntegrity.sha256,
      matches: selectedMigrationIntegrity.sha256 === canonicalMigrationIntegrity.sha256
    },
    scriptPath: options.scriptPath,
    corpusHash: report.corpusHash,
    corpusCount: report.corpusCount,
    batchCount: report.batchCount,
    batchSize: report.batchSize,
    embeddingModel: report.embeddingModel,
    embeddingDimensions: report.embeddingDimensions,
    corpusInspection: {
      lineCount: corpusInspection.lineCount,
      parsedRecordCount: corpusInspection.records.length,
      parseErrorCount: corpusInspection.parseErrors.length,
      invalidRecordCount: corpusInspection.invalidRecords.length,
      duplicateReferenceItemIdCount: corpusInspection.duplicateReferenceItemIds.length,
      duplicateContentHashCount: corpusInspection.duplicateContentHashes.length,
      computedCorpusHash: corpusInspection.computedCorpusHash,
      manifestBatchFailureCount: manifestInspection.failures.length
    },
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
