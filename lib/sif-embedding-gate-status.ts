import reportJson from "@/evaluation/sif-embedding-gate/report.json";
import preflightJson from "@/evaluation/sif-embedding-gate/approval-preflight-report.json";

export type SifEmbeddingGateStatus = {
  ok: boolean;
  stage: "ready-for-approval" | "degraded";
  message: string;
  generatedAt: string;
  approvalHeld: boolean;
  dbMutationPerformed: boolean;
  embeddingGenerated: boolean;
  uploaded: boolean;
  commandHeldUntilApproval: string;
  corpus: {
    itemCount: number;
    skippedCount: number;
    corpusCount: number;
    batchSize: number;
    batchCount: number;
    corpusHash: string;
    embeddingModel: string;
    embeddingDimensions: number;
    embeddedCount: number;
    uploadedCount: number;
  };
  validation: {
    emptyEmbeddingTextCount: number;
    missingControlsCount: number;
    missingPrimaryDocumentsCount: number;
    duplicateContentHashCount: number;
  };
  approvalRequirements: {
    requiresDbMigrationApproval: boolean;
    requiresEmbeddingCostApproval: boolean;
    requiresApprovedUploadFlag: boolean;
  };
  runtime: {
    openaiApiKeyPresent: boolean;
    supabaseUrlPresent: boolean;
    supabaseServiceRolePresent: boolean;
    vectorFeatureFlagEnabled: boolean;
    executionReadyAfterApproval: boolean;
  };
  failedCheckIds: string[];
  nextApprovalDecisions: string[];
  artifacts: {
    reportPath: string;
    manifestPath: string;
    corpusPath: string;
    migrationPath: string;
    scriptPath: string;
  };
};

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function readString(record: Record<string, unknown>, key: string, fallback = "") {
  const value = record[key];
  return typeof value === "string" ? value : fallback;
}

function readNumber(record: Record<string, unknown>, key: string, fallback = 0) {
  const value = record[key];
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function readBoolean(record: Record<string, unknown>, key: string, fallback = false) {
  const value = record[key];
  return typeof value === "boolean" ? value : fallback;
}

function readStringArray(record: Record<string, unknown>, key: string) {
  const value = record[key];
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function hasEnv(env: Record<string, string | undefined>, key: string) {
  return Boolean(env[key]?.trim());
}

export function getSifEmbeddingGateStatus(
  env: Record<string, string | undefined> = process.env
): SifEmbeddingGateStatus {
  const report = asRecord(reportJson);
  const preflight = asRecord(preflightJson);
  const validation = asRecord(report.validation);
  const approvalGate = asRecord(report.approvalGate);
  const failedCheckIds = readStringArray(preflight, "failedCheckIds");
  const embeddedCount = readNumber(report, "embeddedCount");
  const uploadedCount = readNumber(report, "uploadedCount");
  const corpusReady = readBoolean(approvalGate, "corpusReady")
    && readNumber(validation, "emptyEmbeddingTextCount") === 0
    && readNumber(validation, "missingControlsCount") === 0
    && readNumber(validation, "missingPrimaryDocumentsCount") === 0
    && readNumber(validation, "duplicateContentHashCount") === 0;
  const approvalPreflightOk = readBoolean(preflight, "ok");
  const approvalHeld = readBoolean(preflight, "approvalHeld", true);
  const dbMutationPerformed = readBoolean(preflight, "dbMutationPerformed");
  const embeddingGenerated = readBoolean(preflight, "embeddingGenerated") || embeddedCount > 0;
  const uploaded = readBoolean(preflight, "uploaded") || uploadedCount > 0;
  const ok = approvalPreflightOk && corpusReady && approvalHeld && !dbMutationPerformed && !embeddingGenerated && !uploaded;
  const openaiApiKeyPresent = hasEnv(env, "OPENAI_API_KEY");
  const supabaseUrlPresent = hasEnv(env, "SUPABASE_URL") || hasEnv(env, "NEXT_PUBLIC_SUPABASE_URL");
  const supabaseServiceRolePresent = hasEnv(env, "SUPABASE_SERVICE_ROLE_KEY");
  const vectorFeatureFlagEnabled = env.SAFETY_REFERENCE_VECTOR_SEARCH === "1";

  return {
    ok,
    stage: ok ? "ready-for-approval" : "degraded",
    message: ok
      ? "SIF 코퍼스와 배치 manifest는 준비됐고, 임베딩 생성과 DB 업로드는 승인 전 보류 상태입니다."
      : "SIF 임베딩 승인 게이트 점검이 필요합니다.",
    generatedAt: readString(preflight, "generatedAt", readString(report, "completedAt")),
    approvalHeld,
    dbMutationPerformed,
    embeddingGenerated,
    uploaded,
    commandHeldUntilApproval: readString(
      preflight,
      "commandHeldUntilApproval",
      "npm.cmd run knowledge:sif-embedding-corpus -- --embed --approved-embedding --upload --approved-upload"
    ),
    corpus: {
      itemCount: readNumber(report, "itemCount"),
      skippedCount: readNumber(report, "skippedCount"),
      corpusCount: readNumber(report, "corpusCount"),
      batchSize: readNumber(report, "batchSize"),
      batchCount: readNumber(report, "batchCount"),
      corpusHash: readString(report, "corpusHash"),
      embeddingModel: readString(report, "embeddingModel", "text-embedding-3-small"),
      embeddingDimensions: readNumber(report, "embeddingDimensions", 1536),
      embeddedCount,
      uploadedCount
    },
    validation: {
      emptyEmbeddingTextCount: readNumber(validation, "emptyEmbeddingTextCount"),
      missingControlsCount: readNumber(validation, "missingControlsCount"),
      missingPrimaryDocumentsCount: readNumber(validation, "missingPrimaryDocumentsCount"),
      duplicateContentHashCount: readNumber(validation, "duplicateContentHashCount")
    },
    approvalRequirements: {
      requiresDbMigrationApproval: readBoolean(approvalGate, "uploadRequiresMigrationApproval", true),
      requiresEmbeddingCostApproval: readBoolean(approvalGate, "embeddingRequiresCostApproval", true),
      requiresApprovedUploadFlag: readBoolean(approvalGate, "uploadRequiresApprovedUploadFlag", true)
    },
    runtime: {
      openaiApiKeyPresent,
      supabaseUrlPresent,
      supabaseServiceRolePresent,
      vectorFeatureFlagEnabled,
      executionReadyAfterApproval: openaiApiKeyPresent && supabaseUrlPresent && supabaseServiceRolePresent
    },
    failedCheckIds,
    nextApprovalDecisions: readStringArray(preflight, "nextApprovalDecisions"),
    artifacts: {
      reportPath: readString(preflight, "reportPath", "evaluation/sif-embedding-gate/report.json"),
      manifestPath: readString(preflight, "manifestPath", "evaluation/sif-embedding-gate/sif-embedding-batch-manifest.json"),
      corpusPath: readString(preflight, "corpusPath", "evaluation/sif-embedding-gate/sif-embedding-corpus.jsonl"),
      migrationPath: readString(preflight, "migrationPath", "supabase/migrations/010_commercial_operations.sql"),
      scriptPath: readString(preflight, "scriptPath", "scripts/prepare_sif_embedding_corpus.mjs")
    }
  };
}
