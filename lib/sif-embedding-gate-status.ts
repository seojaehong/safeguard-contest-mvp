import { createHash } from "node:crypto";
import { existsSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

import reportJson from "@/evaluation/sif-embedding-gate/report.json";
import preflightJson from "@/evaluation/sif-embedding-gate/approval-preflight-report.json";
import runtimeProbeJson from "@/evaluation/sif-embedding-gate/runtime-db-probe.json";
import manifestJson from "@/evaluation/sif-embedding-gate/sif-embedding-batch-manifest.json";
import canaryReportJson from "@/evaluation/sif-embedding-canary-2026-07-09/report.json";

export type SifEmbeddingArtifactIntegrity = {
  label: string;
  path: string;
  exists: boolean;
  byteSize: number;
  sha256?: string;
  contentHash?: string;
  recordCount?: number;
  role: string;
};

type SifNextApprovalGateId =
  | "apply-sif-only-migration"
  | "prepare-runtime-env"
  | "approve-embedding-generation"
  | "approve-upload"
  | "enable-vector-search"
  | "disable-vector-flag"
  | "complete";

export type SifEmbeddingOperatorGate = {
  status: "approval-request-open" | "blocked" | "ready-to-execute" | "complete";
  gateId: SifNextApprovalGateId;
  title: string;
  approvalQuestion: string;
  evidenceSummary: string[];
  migrationArtifact: {
    path: string;
    exists: boolean;
    sha256: string | null;
  };
  canaryEvidence: {
    performed: boolean;
    embeddedCount: number;
    uploadedCount: number;
    mode: string;
    vectorsPath: string | null;
  };
  allowedBeforeApproval: string[];
  forbiddenBeforeApproval: string[];
  checklist: {
    id: string;
    label: string;
    status: "done" | "required" | "blocked";
    evidence: string;
  }[];
  postApprovalSequence: string[];
  heldCommands: string[];
  nonApprovalFallback: string;
};

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
  canary: {
    performed: boolean;
    label: string;
    answer: string;
    reportPath: string;
    vectorsPath: string | null;
    corpusCount: number;
    embeddedCount: number;
    uploadedCount: number;
    mode: string;
    embeddingModel: string;
    embeddingDimensions: number;
    corpusHash: string;
    dbMutationPerformed: boolean;
    artifactIntegrity: SifEmbeddingArtifactIntegrity[];
  };
  learningLifecycle: {
    productTerm: "retrieval_embedding_index";
    label: string;
    answer: string;
    modelFineTuningPerformed: false;
    corpusPrepared: boolean;
    fullEmbeddingGenerated: boolean;
    dbUploadVerified: boolean;
    vectorSearchUsable: boolean;
    nextGateId: SifEmbeddingGateStatus["nextApprovalGate"]["id"];
    nextGateLabel: string;
  };
  readinessVerdict: {
    state:
      | "corpus-ready-migration-required"
      | "runtime-env-required"
      | "embedding-awaits-approval"
      | "upload-awaits-approval"
      | "vector-activation-ready"
      | "vector-active"
      | "blocked";
    label: string;
    answer: string;
    nextAction: string;
    embeddingAlreadyRun: boolean;
    dbUploadAlreadyRun: boolean;
  };
  vectorGuard: {
    status: "locked" | "blocked" | "ready" | "active";
    label: string;
    message: string;
    flagEnabled: boolean;
    uploadVerified: boolean;
    uploadedCount: number;
    requiredUploadCount: number;
  };
  preflightChecks: {
    id: string;
    label: string;
    passed: boolean;
    evidenceSummary: string;
  }[];
  approvalSteps: {
    id: string;
    label: string;
    status: "waiting" | "blocked" | "ready" | "done";
    detail: string;
  }[];
  runtimeDbProbe: {
    status: string;
    message: string;
    tableReady: boolean;
    rpcReady: boolean;
    checkedAt: string;
  };
  nextApprovalGate: {
    id: SifNextApprovalGateId;
    label: string;
    status: "waiting" | "blocked" | "ready" | "done";
    detail: string;
    action: string;
    artifactPath?: string;
    command?: string;
  };
  operatorGate: SifEmbeddingOperatorGate;
  approvalPacket: {
    scope: "sif_embedding_next_approval_gate";
    decisionCount: number;
    approvalFingerprint: string;
    decisions: string[];
    requiredArtifacts: {
      label: string;
      path: string;
      role: string;
    }[];
    safetyLocks: {
      label: string;
      locked: boolean;
      detail: string;
    }[];
    artifactIntegrity: SifEmbeddingArtifactIntegrity[];
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

function readRecordArray(record: Record<string, unknown>, key: string) {
  const value = record[key];
  return Array.isArray(value) ? value.map(asRecord) : [];
}

function hasEnv(env: Record<string, string | undefined>, key: string) {
  return Boolean(env[key]?.trim());
}

function checkLabelFor(id: string) {
  const labels: Record<string, string> = {
    sif_source_count: "SIF 원본과 코퍼스 수량 확인",
    manifest_matches_report: "배치 manifest와 보고서 일치",
    corpus_jsonl_matches_report: "JSONL 코퍼스 라인 수 확인",
    corpus_quality_gate: "빈 텍스트/관리대책/중복 품질 게이트",
    no_embedding_generated_yet: "승인 전 임베딩 미생성",
    embedding_requires_explicit_cost_approval_flag: "임베딩 비용 승인 플래그 필요",
    upload_requires_explicit_approval_flag: "업로드 승인 플래그 필요",
    migration_contains_embedding_table_rpc_index: "migration에 table/RPC/index 포함",
    migration_keeps_embeddings_server_side: "임베딩은 서버 측에서만 조회",
    migration_scope_is_sif_embedding_only: "SIF-only migration 범위 확인",
    vector_feature_flag_stays_off_until_upload_verified: "업로드 검증 전 vector flag 잠금"
  };
  return labels[id] || id;
}

function summarizeEvidence(evidence: Record<string, unknown>) {
  const pairs = Object.entries(evidence)
    .filter(([, value]) => typeof value === "string" || typeof value === "number" || typeof value === "boolean" || value === null)
    .slice(0, 3)
    .map(([key, value]) => `${key}: ${String(value)}`);
  return pairs.length ? pairs.join(" · ") : "근거 파일에서 확인됨";
}

function sha256(value: string) {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function resolveProjectPath(relativePath: string) {
  return join(process.cwd(), relativePath.replace(/\\/g, "/"));
}

const CANARY_REPORT_PATH = "evaluation/sif-embedding-canary-2026-07-09/report.json";
const CANARY_MANIFEST_PATH = "evaluation/sif-embedding-canary-2026-07-09/sif-embedding-batch-manifest.json";
const CANARY_CORPUS_PATH = "evaluation/sif-embedding-canary-2026-07-09/sif-embedding-corpus.jsonl";
const CANARY_VECTORS_PATH = "evaluation/sif-embedding-canary-2026-07-09/sif-embedding-vectors.jsonl";

function readFileIntegrity(input: {
  label: string;
  path: string;
  role: string;
  sha256Enabled?: boolean;
  contentHash?: string;
  recordCount?: number;
}): SifEmbeddingArtifactIntegrity {
  const absolutePath = resolveProjectPath(input.path);
  if (!existsSync(absolutePath)) {
    return {
      label: input.label,
      path: input.path,
      exists: false,
      byteSize: 0,
      contentHash: input.contentHash,
      recordCount: input.recordCount,
      role: input.role
    };
  }

  const stat = statSync(absolutePath);
  const content = input.sha256Enabled ? readFileSync(absolutePath, "utf8") : undefined;
  return {
    label: input.label,
    path: input.path,
    exists: true,
    byteSize: stat.size,
    sha256: content ? sha256(content) : undefined,
    contentHash: input.contentHash,
    recordCount: input.recordCount,
    role: input.role
  };
}

function buildApprovalFingerprint(input: {
  corpusHash: string;
  corpusCount: number;
  embeddingModel: string;
  embeddingDimensions: number;
  migrationSha256?: string;
}) {
  return sha256(JSON.stringify({
    corpusHash: input.corpusHash,
    corpusCount: input.corpusCount,
    embeddingModel: input.embeddingModel,
    embeddingDimensions: input.embeddingDimensions,
    migrationSha256: input.migrationSha256 || "migration-hash-unavailable"
  }));
}

function buildVectorGuard(
  vectorFeatureFlagEnabled: boolean,
  uploadedCount: number,
  corpusCount: number
): SifEmbeddingGateStatus["vectorGuard"] {
  const uploadVerified = corpusCount > 0 && uploadedCount === corpusCount;
  if (vectorFeatureFlagEnabled && !uploadVerified) {
    return {
      status: "blocked",
      label: "Vector 검색 차단",
      message: "업로드 수량 검증 전 SAFETY_REFERENCE_VECTOR_SEARCH=1이 감지됐습니다. flag를 끄고 row count/RPC smoke test 후 다시 켜야 합니다.",
      flagEnabled: true,
      uploadVerified,
      uploadedCount,
      requiredUploadCount: corpusCount
    };
  }
  if (vectorFeatureFlagEnabled && uploadVerified) {
    return {
      status: "active",
      label: "Vector 검색 활성",
      message: "업로드 수량이 코퍼스와 일치해 runtime vector 검색을 사용할 수 있는 상태입니다.",
      flagEnabled: true,
      uploadVerified,
      uploadedCount,
      requiredUploadCount: corpusCount
    };
  }
  if (uploadVerified) {
    return {
      status: "ready",
      label: "Vector 검색 활성 대기",
      message: "업로드 검증이 끝났습니다. RPC smoke test 후 feature flag를 켤 수 있습니다.",
      flagEnabled: false,
      uploadVerified,
      uploadedCount,
      requiredUploadCount: corpusCount
    };
  }
  return {
    status: "locked",
    label: "Vector 검색 잠금",
    message: "임베딩 생성과 DB 업로드가 승인 전 보류되어 있으므로 vector 검색은 꺼진 상태를 유지합니다.",
    flagEnabled: false,
    uploadVerified,
    uploadedCount,
    requiredUploadCount: corpusCount
  };
}

function buildApprovalSteps(
  runtimeReady: boolean,
  vectorGuard: SifEmbeddingGateStatus["vectorGuard"],
  migrationPath: string,
  tableReady: boolean,
  rpcReady: boolean
): SifEmbeddingGateStatus["approvalSteps"] {
  const migrationStatus = tableReady && rpcReady ? "done" : "waiting";
  const uploadStatus = vectorGuard.uploadVerified ? "done" : "blocked";
  const vectorStatus = vectorGuard.status === "active"
    ? "done"
    : vectorGuard.status === "ready"
      ? "ready"
      : vectorGuard.status === "blocked"
        ? "blocked"
        : "waiting";
  return [
    {
      id: "migration",
      label: "1. SIF-only DB migration 승인",
      status: migrationStatus,
      detail: migrationStatus === "done"
        ? "운영 DB에서 safety_reference_embeddings table과 match RPC를 확인했습니다."
        : `${migrationPath} 적용 승인이 먼저 필요합니다. 임베딩 생성/업로드보다 앞선 단계입니다.`
    },
    {
      id: "embedding",
      label: "2. 임베딩 생성 승인",
      status: tableReady && rpcReady && runtimeReady ? "waiting" : "blocked",
      detail: tableReady && rpcReady
        ? "비용이 발생하는 단계라 --approved-embedding flag 없이는 실행하지 않습니다."
        : "DB migration 적용과 runtime key 확인 후 진행합니다."
    },
    {
      id: "upload",
      label: "3. 업로드와 row count 검증",
      status: uploadStatus,
      detail: vectorGuard.uploadVerified ? "업로드 수량이 코퍼스와 일치합니다." : "업로드 후 코퍼스 수량과 DB row count가 같아야 합니다."
    },
    {
      id: "vector",
      label: "4. Vector 검색 flag",
      status: vectorStatus,
      detail: vectorGuard.message
    }
  ];
}

function buildRuntimeDbProbeStatus(): SifEmbeddingGateStatus["runtimeDbProbe"] {
  const probe = asRecord(runtimeProbeJson);
  const table = asRecord(probe.safetyReferenceEmbeddings);
  const rpc = asRecord(probe.matchRpc);
  return {
    status: readString(probe, "status", "unknown"),
    message: readString(probe, "message", "SIF runtime DB probe 결과를 확인해야 합니다."),
    tableReady: readBoolean(table, "ok"),
    rpcReady: readBoolean(rpc, "ok"),
    checkedAt: readString(probe, "generatedAt")
  };
}

function buildCanaryStatus(): SifEmbeddingGateStatus["canary"] {
  const report = asRecord(canaryReportJson);
  const corpusCount = readNumber(report, "corpusCount");
  const embeddedCount = readNumber(report, "embeddedCount");
  const uploadedCount = readNumber(report, "uploadedCount");
  const vectorsPath = readString(report, "vectorsPath", CANARY_VECTORS_PATH);
  const performed = embeddedCount > 0 && Boolean(vectorsPath);
  const corpusHash = readString(report, "corpusHash");
  const embeddingModel = readString(report, "embeddingModel", "text-embedding-3-small");
  const embeddingDimensions = readNumber(report, "embeddingDimensions", 1536);
  return {
    performed,
    label: performed ? "Canary 임베딩 완료 · 업로드 전" : "Canary 임베딩 미실행",
    answer: performed
      ? `${embeddedCount.toLocaleString("ko-KR")}건 canary 임베딩 벡터를 생성해 모델·차원·텍스트 품질을 확인했고, DB 업로드는 수행하지 않았습니다.`
      : "승인 전 canary 임베딩 검증 산출물이 없습니다.",
    reportPath: CANARY_REPORT_PATH,
    vectorsPath: performed ? vectorsPath : null,
    corpusCount,
    embeddedCount,
    uploadedCount,
    mode: readString(report, "mode", "not-run"),
    embeddingModel,
    embeddingDimensions,
    corpusHash,
    dbMutationPerformed: uploadedCount > 0,
    artifactIntegrity: [
      readFileIntegrity({
        label: "Canary report",
        path: CANARY_REPORT_PATH,
        role: "소량 임베딩 실행 결과와 DB 업로드 보류 상태를 확인합니다.",
        sha256Enabled: true
      }),
      readFileIntegrity({
        label: "Canary manifest",
        path: CANARY_MANIFEST_PATH,
        role: "canary 배치 수량과 corpus hash를 확인합니다.",
        sha256Enabled: true,
        contentHash: corpusHash,
        recordCount: corpusCount
      }),
      readFileIntegrity({
        label: "Canary corpus",
        path: CANARY_CORPUS_PATH,
        role: "canary 임베딩 입력 텍스트를 검토합니다.",
        contentHash: corpusHash,
        recordCount: corpusCount
      }),
      readFileIntegrity({
        label: "Canary vectors",
        path: vectorsPath || CANARY_VECTORS_PATH,
        role: "승인 전 소량 벡터 생성이 정상 동작했는지 확인합니다.",
        sha256Enabled: true,
        recordCount: embeddedCount
      })
    ]
  };
}

function buildNextApprovalGate(input: {
  runtimeReady: boolean;
  vectorGuard: SifEmbeddingGateStatus["vectorGuard"];
  runtimeDbProbe: SifEmbeddingGateStatus["runtimeDbProbe"];
  migrationPath: string;
  embeddedCount: number;
  uploadedCount: number;
  corpusCount: number;
  commandHeldUntilApproval: string;
}): SifEmbeddingGateStatus["nextApprovalGate"] {
  if (input.vectorGuard.status === "blocked") {
    return {
      id: "disable-vector-flag",
      label: "Vector feature flag 끄기",
      status: "blocked",
      detail: "업로드 검증 전 SAFETY_REFERENCE_VECTOR_SEARCH=1이 켜져 있어 runtime vector 검색을 차단했습니다.",
      action: "SAFETY_REFERENCE_VECTOR_SEARCH를 끄고 runtime probe를 다시 확인합니다."
    };
  }

  if (!input.runtimeDbProbe.tableReady || !input.runtimeDbProbe.rpcReady) {
    return {
      id: "apply-sif-only-migration",
      label: "SIF-only DB migration 승인",
      status: "waiting",
      detail: "운영 DB에 safety_reference_embeddings table 또는 match_safety_reference_embeddings RPC가 없어 업로드 전 migration 승인이 먼저 필요합니다.",
      action: "SIF-only migration SQL을 승인 후 적용합니다.",
      artifactPath: input.migrationPath
    };
  }

  if (!input.runtimeReady) {
    return {
      id: "prepare-runtime-env",
      label: "임베딩 실행 환경 확인",
      status: "blocked",
      detail: "DB runtime 표면은 준비됐지만 OpenAI key 또는 Supabase service role 확인이 필요합니다.",
      action: "OPENAI_API_KEY, Supabase URL, service role을 확인한 뒤 임베딩 생성 승인을 진행합니다."
    };
  }

  if (input.embeddedCount === 0) {
    return {
      id: "approve-embedding-generation",
      label: "임베딩 생성 비용 승인",
      status: "waiting",
      detail: "코퍼스와 DB runtime 표면이 준비됐습니다. 비용 발생 단계이므로 명시 승인 후에만 실행합니다.",
      action: "임베딩 생성과 업로드 명령을 승인합니다.",
      command: input.commandHeldUntilApproval
    };
  }

  if (input.uploadedCount < input.corpusCount) {
    return {
      id: "approve-upload",
      label: "임베딩 업로드 승인",
      status: "waiting",
      detail: "임베딩 벡터가 생성됐지만 DB row count 검증이 끝나지 않았습니다.",
      action: "업로드 승인 플래그로 DB upsert 후 row count를 검증합니다.",
      command: input.commandHeldUntilApproval
    };
  }

  if (input.vectorGuard.status === "ready") {
    return {
      id: "enable-vector-search",
      label: "Vector 검색 활성 승인",
      status: "ready",
      detail: "업로드 수량 검증이 끝났습니다. RPC smoke test 후 feature flag를 켤 수 있습니다.",
      action: "SAFETY_REFERENCE_VECTOR_SEARCH=1 활성화 전 smoke test를 실행합니다."
    };
  }

  return {
    id: "complete",
    label: "SIF vector gate 완료",
    status: "done",
    detail: "SIF vector retrieval 승인 게이트가 완료된 상태입니다.",
    action: "운영 모니터링과 품질 검수를 유지합니다."
  };
}

function buildReadinessVerdict(input: {
  runtimeReady: boolean;
  vectorGuard: SifEmbeddingGateStatus["vectorGuard"];
  runtimeDbProbe: SifEmbeddingGateStatus["runtimeDbProbe"];
  embeddedCount: number;
  uploadedCount: number;
  corpusCount: number;
  nextApprovalGate: SifEmbeddingGateStatus["nextApprovalGate"];
}): SifEmbeddingGateStatus["readinessVerdict"] {
  const embeddingAlreadyRun = input.embeddedCount > 0;
  const dbUploadAlreadyRun = input.uploadedCount > 0;

  if (input.vectorGuard.status === "blocked") {
    return {
      state: "blocked",
      label: "Vector flag 차단",
      answer: "업로드 검증 전 vector 검색 flag가 켜져 있어 승인 게이트가 차단된 상태입니다.",
      nextAction: input.nextApprovalGate.action,
      embeddingAlreadyRun,
      dbUploadAlreadyRun
    };
  }

  if (input.vectorGuard.status === "active") {
    return {
      state: "vector-active",
      label: "SIF vector 검색 활성",
      answer: "SIF 임베딩 생성, DB 업로드, vector 검색 활성화가 모두 끝난 상태입니다.",
      nextAction: input.nextApprovalGate.action,
      embeddingAlreadyRun,
      dbUploadAlreadyRun
    };
  }

  if (input.vectorGuard.status === "ready") {
    return {
      state: "vector-activation-ready",
      label: "Vector 활성 승인 대기",
      answer: "SIF 임베딩과 DB 업로드는 검증됐고, vector 검색 flag 활성 승인만 남았습니다.",
      nextAction: input.nextApprovalGate.action,
      embeddingAlreadyRun,
      dbUploadAlreadyRun
    };
  }

  if (!input.runtimeDbProbe.tableReady || !input.runtimeDbProbe.rpcReady) {
    return {
      state: "corpus-ready-migration-required",
      label: "코퍼스 준비 · 임베딩 미실행",
      answer: `SIF 코퍼스 ${input.corpusCount.toLocaleString("ko-KR")}건은 준비됐지만, 임베딩 생성과 DB 업로드는 아직 실행되지 않았습니다.`,
      nextAction: input.nextApprovalGate.action,
      embeddingAlreadyRun,
      dbUploadAlreadyRun
    };
  }

  if (!input.runtimeReady) {
    return {
      state: "runtime-env-required",
      label: "실행 환경 확인 필요",
      answer: "DB 표면은 준비됐지만 OpenAI key 또는 Supabase service role 확인 전이라 임베딩 실행을 보류합니다.",
      nextAction: input.nextApprovalGate.action,
      embeddingAlreadyRun,
      dbUploadAlreadyRun
    };
  }

  if (!embeddingAlreadyRun) {
    return {
      state: "embedding-awaits-approval",
      label: "임베딩 생성 승인 대기",
      answer: "DB 표면과 실행 환경은 준비됐고, 비용 발생 단계인 SIF 임베딩 생성 승인만 남았습니다.",
      nextAction: input.nextApprovalGate.action,
      embeddingAlreadyRun,
      dbUploadAlreadyRun
    };
  }

  return {
    state: "upload-awaits-approval",
    label: "DB 업로드 승인 대기",
    answer: "SIF 임베딩 벡터는 생성됐지만 DB 업로드와 row count 검증이 아직 끝나지 않았습니다.",
    nextAction: input.nextApprovalGate.action,
    embeddingAlreadyRun,
    dbUploadAlreadyRun
  };
}

function buildLearningLifecycle(input: {
  corpusReady: boolean;
  embeddedCount: number;
  uploadedCount: number;
  corpusCount: number;
  vectorGuard: SifEmbeddingGateStatus["vectorGuard"];
  nextApprovalGate: SifEmbeddingGateStatus["nextApprovalGate"];
}): SifEmbeddingGateStatus["learningLifecycle"] {
  const fullEmbeddingGenerated = input.corpusCount > 0 && input.embeddedCount === input.corpusCount;
  const dbUploadVerified = input.vectorGuard.uploadVerified;
  const vectorSearchUsable = input.vectorGuard.status === "active";
  const label = vectorSearchUsable
    ? "검색 인덱스 활성"
    : dbUploadVerified
      ? "업로드 검증 완료"
      : fullEmbeddingGenerated
        ? "임베딩 생성 완료 · 업로드 전"
        : input.corpusReady
          ? "코퍼스 준비 · 임베딩 전"
          : "코퍼스 점검 필요";
  const answer = vectorSearchUsable
    ? "SIF 코퍼스 임베딩, DB 업로드, vector 검색 활성화가 끝났습니다."
    : dbUploadVerified
      ? "SIF 임베딩 DB row count는 검증됐고, vector 검색 flag 활성 승인만 남았습니다."
      : fullEmbeddingGenerated
        ? "SIF 임베딩 벡터는 생성됐지만 운영 DB 업로드와 row count 검증은 아직입니다."
        : input.corpusReady
          ? "SIF 자료는 재생성 가능한 코퍼스로 준비됐지만, 모델 파인튜닝도 전체 임베딩 생성도 아직 실행하지 않았습니다."
          : "SIF 코퍼스 품질 게이트를 먼저 다시 통과해야 합니다.";

  return {
    productTerm: "retrieval_embedding_index",
    label,
    answer,
    modelFineTuningPerformed: false,
    corpusPrepared: input.corpusReady,
    fullEmbeddingGenerated,
    dbUploadVerified,
    vectorSearchUsable,
    nextGateId: input.nextApprovalGate.id,
    nextGateLabel: input.nextApprovalGate.label
  };
}

function buildOperatorGate(input: {
  nextApprovalGate: SifEmbeddingGateStatus["nextApprovalGate"];
  approvalPacket: SifEmbeddingGateStatus["approvalPacket"];
  runtimeDbProbe: SifEmbeddingGateStatus["runtimeDbProbe"];
  canary: SifEmbeddingGateStatus["canary"];
  corpusCount: number;
  embeddedCount: number;
  uploadedCount: number;
  commandHeldUntilApproval: string;
}): SifEmbeddingOperatorGate {
  const migrationArtifact = input.approvalPacket.artifactIntegrity.find((artifact) => artifact.label === "SIF-only migration");
  const status: SifEmbeddingOperatorGate["status"] =
    input.nextApprovalGate.status === "blocked"
      ? "blocked"
      : input.nextApprovalGate.status === "done"
        ? "complete"
        : input.nextApprovalGate.status === "ready"
          ? "ready-to-execute"
          : "approval-request-open";
  const migrationReady = input.runtimeDbProbe.tableReady && input.runtimeDbProbe.rpcReady;

  return {
    status,
    gateId: input.nextApprovalGate.id,
    title: status === "approval-request-open"
      ? "다음 승인 게이트가 열려 있습니다."
      : input.nextApprovalGate.label,
    approvalQuestion: input.nextApprovalGate.id === "apply-sif-only-migration"
      ? "SIF-only migration SQL을 운영 DB에 적용해도 되는지 승인해야 합니다."
      : input.nextApprovalGate.action,
    evidenceSummary: [
      `전체 SIF 코퍼스 ${input.corpusCount.toLocaleString("ko-KR")}건은 고정됐고 전체 임베딩 생성은 ${input.embeddedCount.toLocaleString("ko-KR")}건입니다.`,
      `Canary는 ${input.canary.embeddedCount.toLocaleString("ko-KR")}건 embed-only로 확인했고 DB 업로드는 ${input.canary.uploadedCount.toLocaleString("ko-KR")}건입니다.`,
      `Runtime DB probe는 ${input.runtimeDbProbe.status}이며 table ${input.runtimeDbProbe.tableReady ? "ready" : "missing"}, RPC ${input.runtimeDbProbe.rpcReady ? "ready" : "missing"}입니다.`,
      `승인 지문 ${input.approvalPacket.approvalFingerprint}로 corpus hash, 모델/차원, migration SQL을 고정합니다.`
    ],
    migrationArtifact: {
      path: migrationArtifact?.path || input.nextApprovalGate.artifactPath || "",
      exists: Boolean(migrationArtifact?.exists),
      sha256: migrationArtifact?.sha256 || null
    },
    canaryEvidence: {
      performed: input.canary.performed,
      embeddedCount: input.canary.embeddedCount,
      uploadedCount: input.canary.uploadedCount,
      mode: input.canary.mode,
      vectorsPath: input.canary.vectorsPath
    },
    allowedBeforeApproval: [
      "승인 패킷과 migration SQL diff 검토",
      "runtime DB probe 재실행",
      "코퍼스/manifest/hash 재검증"
    ],
    forbiddenBeforeApproval: [
      "운영 DB migration 적용",
      "전체 SIF 임베딩 생성",
      "safety_reference_embeddings 업로드",
      "SAFETY_REFERENCE_VECTOR_SEARCH=1 활성화"
    ],
    checklist: [
      {
        id: "preflight",
        label: "Preflight 통과",
        status: input.approvalPacket.safetyLocks.every((lock) => lock.locked) ? "done" : "required",
        evidence: "승인 전 DB 변경, 전체 임베딩 생성, 업로드가 모두 보류 상태입니다."
      },
      {
        id: "canary",
        label: "Canary embed-only 확인",
        status: input.canary.performed && !input.canary.dbMutationPerformed ? "done" : "required",
        evidence: input.canary.answer
      },
      {
        id: "migration-runtime",
        label: "운영 DB migration 필요성 확인",
        status: migrationReady ? "done" : "required",
        evidence: input.runtimeDbProbe.message
      },
      {
        id: "full-embedding",
        label: "전체 임베딩/업로드 승인 전 보류",
        status: input.embeddedCount === 0 && input.uploadedCount === 0 ? "done" : "blocked",
        evidence: `전체 임베딩 ${input.embeddedCount.toLocaleString("ko-KR")}건, 업로드 ${input.uploadedCount.toLocaleString("ko-KR")}건`
      }
    ],
    postApprovalSequence: [
      "승인된 SIF-only migration을 운영 DB에 적용합니다.",
      "runtime probe로 table/RPC readiness를 다시 확인합니다.",
      "--embed --approved-embedding으로 전체 임베딩 생성을 승인 실행합니다.",
      "--upload --approved-upload으로 DB upsert 후 row count를 검증합니다.",
      "RPC smoke test 통과 후에만 SAFETY_REFERENCE_VECTOR_SEARCH=1을 켭니다."
    ],
    heldCommands: [
      input.commandHeldUntilApproval,
      "npm.cmd run knowledge:sif-embedding-runtime-probe -- --output evaluation/sif-embedding-gate/runtime-db-probe.json"
    ],
    nonApprovalFallback: "승인이 없으면 기존 safety_reference_items 기반 REST/ranked 검색 경로를 유지하고 vector retrieval은 계속 꺼둡니다."
  };
}

function buildApprovalPacket(input: {
  decisions: string[];
  artifacts: SifEmbeddingGateStatus["artifacts"];
  approvalHeld: boolean;
  dbMutationPerformed: boolean;
  embeddingGenerated: boolean;
  uploaded: boolean;
  vectorGuard: SifEmbeddingGateStatus["vectorGuard"];
  corpusHash: string;
  corpusCount: number;
  embeddingModel: string;
  embeddingDimensions: number;
}): SifEmbeddingGateStatus["approvalPacket"] {
  const manifest = asRecord(manifestJson);
  const requiredArtifacts = [
    {
      label: "Preflight report",
      path: input.artifacts.reportPath,
      role: "코퍼스 수량, 품질 게이트, 승인 보류 상태를 확인합니다."
    },
    {
      label: "Batch manifest",
      path: input.artifacts.manifestPath,
      role: "임베딩 배치 수량과 corpus hash를 고정합니다."
    },
    {
      label: "SIF corpus JSONL",
      path: input.artifacts.corpusPath,
      role: "임베딩 입력 원문과 SIF 레코드 매핑을 검토합니다."
    },
    {
      label: "SIF-only migration",
      path: input.artifacts.migrationPath,
      role: "운영 DB에 필요한 table, RPC, index 범위만 승인합니다."
    }
  ];
  const artifactIntegrity = [
    readFileIntegrity({
      ...requiredArtifacts[0],
      sha256Enabled: true
    }),
    readFileIntegrity({
      ...requiredArtifacts[1],
      sha256Enabled: true,
      contentHash: readString(manifest, "corpusHash", input.corpusHash),
      recordCount: readNumber(manifest, "recordCount", input.corpusCount)
    }),
    readFileIntegrity({
      ...requiredArtifacts[2],
      sha256Enabled: false,
      contentHash: input.corpusHash,
      recordCount: input.corpusCount
    }),
    readFileIntegrity({
      ...requiredArtifacts[3],
      sha256Enabled: true
    })
  ];
  const migrationSha256 = artifactIntegrity.find((artifact) => artifact.label === "SIF-only migration")?.sha256;

  return {
    scope: "sif_embedding_next_approval_gate",
    decisionCount: input.decisions.length,
    approvalFingerprint: buildApprovalFingerprint({
      corpusHash: input.corpusHash,
      corpusCount: input.corpusCount,
      embeddingModel: input.embeddingModel,
      embeddingDimensions: input.embeddingDimensions,
      migrationSha256
    }),
    decisions: input.decisions,
    requiredArtifacts,
    safetyLocks: [
      {
        label: "승인 전 실행 보류",
        locked: input.approvalHeld,
        detail: input.approvalHeld ? "명시 승인 전 command 실행을 보류합니다." : "승인 보류 플래그가 꺼져 있습니다."
      },
      {
        label: "DB 변경 없음",
        locked: !input.dbMutationPerformed,
        detail: input.dbMutationPerformed ? "DB 변경이 감지됐습니다." : "현재 패키지는 DB mutation 없이 준비됐습니다."
      },
      {
        label: "임베딩 미생성",
        locked: !input.embeddingGenerated,
        detail: input.embeddingGenerated ? "이미 생성된 vector 산출물이 있습니다." : "비용 발생 단계는 아직 실행되지 않았습니다."
      },
      {
        label: "업로드 미수행",
        locked: !input.uploaded,
        detail: input.uploaded ? "DB 업로드 이력이 있습니다." : "DB upsert는 승인 전 보류 상태입니다."
      },
      {
        label: "Vector 검색 잠금",
        locked: input.vectorGuard.status !== "active",
        detail: input.vectorGuard.message
      }
    ],
    artifactIntegrity
  };
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
  const vectorGuard = buildVectorGuard(vectorFeatureFlagEnabled, uploadedCount, readNumber(report, "corpusCount"));
  const runtimeExecutionReadyAfterApproval = openaiApiKeyPresent && supabaseUrlPresent && supabaseServiceRolePresent;
  const runtimeDbProbe = buildRuntimeDbProbeStatus();
  const canary = buildCanaryStatus();
  const artifacts = {
    reportPath: readString(preflight, "reportPath", "evaluation/sif-embedding-gate/report.json"),
    manifestPath: readString(preflight, "manifestPath", "evaluation/sif-embedding-gate/sif-embedding-batch-manifest.json"),
    corpusPath: readString(preflight, "corpusPath", "evaluation/sif-embedding-gate/sif-embedding-corpus.jsonl"),
    migrationPath: readString(preflight, "migrationPath", "supabase/migrations/010_commercial_operations.sql"),
    scriptPath: readString(preflight, "scriptPath", "scripts/prepare_sif_embedding_corpus.mjs")
  };
  const commandHeldUntilApproval = readString(
    preflight,
    "commandHeldUntilApproval",
    "npm.cmd run knowledge:sif-embedding-corpus -- --embed --approved-embedding --upload --approved-upload"
  );
  const nextApprovalDecisions = readStringArray(preflight, "nextApprovalDecisions");
  const preflightChecks = readRecordArray(preflight, "checks").map((check) => {
    const id = readString(check, "id", "unknown_check");
    return {
      id,
      label: checkLabelFor(id),
      passed: readBoolean(check, "passed"),
      evidenceSummary: summarizeEvidence(asRecord(check.evidence))
    };
  });
  const overallOk = ok && vectorGuard.status !== "blocked";
  const nextApprovalGate = buildNextApprovalGate({
    runtimeReady: runtimeExecutionReadyAfterApproval,
    vectorGuard,
    runtimeDbProbe,
    migrationPath: readString(preflight, "migrationPath", "evaluation/sif-embedding-gate/sif-embedding-only-migration.sql"),
    embeddedCount,
    uploadedCount,
    corpusCount: readNumber(report, "corpusCount"),
    commandHeldUntilApproval
  });
  const learningLifecycle = buildLearningLifecycle({
    corpusReady,
    embeddedCount,
    uploadedCount,
    corpusCount: readNumber(report, "corpusCount"),
    vectorGuard,
    nextApprovalGate
  });
  const approvalPacket = buildApprovalPacket({
    decisions: nextApprovalDecisions,
    artifacts,
    approvalHeld,
    dbMutationPerformed,
    embeddingGenerated,
    uploaded,
    vectorGuard,
    corpusHash: readString(report, "corpusHash"),
    corpusCount: readNumber(report, "corpusCount"),
    embeddingModel: readString(report, "embeddingModel", "text-embedding-3-small"),
    embeddingDimensions: readNumber(report, "embeddingDimensions", 1536)
  });
  const operatorGate = buildOperatorGate({
    nextApprovalGate,
    approvalPacket,
    runtimeDbProbe,
    canary,
    corpusCount: readNumber(report, "corpusCount"),
    embeddedCount,
    uploadedCount,
    commandHeldUntilApproval
  });

  return {
    ok: overallOk,
    stage: overallOk ? "ready-for-approval" : "degraded",
    message: overallOk
      ? "SIF 코퍼스와 배치 manifest는 준비됐고, 임베딩 생성과 DB 업로드는 승인 전 보류 상태입니다."
      : vectorGuard.status === "blocked"
        ? vectorGuard.message
        : "SIF 임베딩 승인 게이트 점검이 필요합니다.",
    generatedAt: readString(preflight, "generatedAt", readString(report, "completedAt")),
    approvalHeld,
    dbMutationPerformed,
    embeddingGenerated,
    uploaded,
    commandHeldUntilApproval,
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
      executionReadyAfterApproval: runtimeExecutionReadyAfterApproval
    },
    canary,
    learningLifecycle,
    readinessVerdict: buildReadinessVerdict({
      runtimeReady: runtimeExecutionReadyAfterApproval,
      vectorGuard,
      runtimeDbProbe,
      embeddedCount,
      uploadedCount,
      corpusCount: readNumber(report, "corpusCount"),
      nextApprovalGate
    }),
    vectorGuard,
    preflightChecks,
    approvalSteps: buildApprovalSteps(
      runtimeExecutionReadyAfterApproval,
      vectorGuard,
      readString(preflight, "migrationPath", "evaluation/sif-embedding-gate/sif-embedding-only-migration.sql"),
      runtimeDbProbe.tableReady,
      runtimeDbProbe.rpcReady
    ),
    runtimeDbProbe,
    nextApprovalGate,
    operatorGate,
    failedCheckIds,
    approvalPacket,
    nextApprovalDecisions,
    artifacts
  };
}
