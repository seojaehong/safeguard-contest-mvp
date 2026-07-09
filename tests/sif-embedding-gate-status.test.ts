import { describe, expect, it } from "vitest";
import { getSifEmbeddingGateStatus } from "@/lib/sif-embedding-gate-status";

describe("SIF embedding gate status", () => {
  it("reports the prepared corpus as approval-held without embedding or upload", () => {
    const status = getSifEmbeddingGateStatus({
      OPENAI_API_KEY: "",
      SUPABASE_URL: "https://example.supabase.co",
      SUPABASE_SERVICE_ROLE_KEY: "service-role-placeholder",
      SAFETY_REFERENCE_VECTOR_SEARCH: ""
    });

    expect(status.ok).toBe(true);
    expect(status.stage).toBe("ready-for-approval");
    expect(status.approvalHeld).toBe(true);
    expect(status.dbMutationPerformed).toBe(false);
    expect(status.embeddingGenerated).toBe(false);
    expect(status.uploaded).toBe(false);
    expect(status.corpus).toMatchObject({
      itemCount: 6033,
      skippedCount: 1,
      corpusCount: 6032,
      batchCount: 61,
      embeddingModel: "text-embedding-3-small",
      embeddingDimensions: 1536,
      embeddedCount: 0,
      uploadedCount: 0
    });
    expect(status.validation).toEqual({
      emptyEmbeddingTextCount: 0,
      missingControlsCount: 0,
      missingPrimaryDocumentsCount: 0,
      duplicateContentHashCount: 0
    });
    expect(status.vectorGuard).toMatchObject({
      status: "locked",
      flagEnabled: false,
      uploadVerified: false,
      uploadedCount: 0,
      requiredUploadCount: 6032
    });
    expect(status.runtimeDbProbe).toMatchObject({
      status: "migration-required",
      tableReady: false,
      rpcReady: false
    });
    expect(status.readinessVerdict).toMatchObject({
      state: "corpus-ready-migration-required",
      label: "코퍼스 준비 · 임베딩 미실행",
      embeddingAlreadyRun: false,
      dbUploadAlreadyRun: false
    });
    expect(status.readinessVerdict.answer).toContain("6,032건은 준비");
    expect(status.readinessVerdict.answer).toContain("임베딩 생성과 DB 업로드는 아직 실행되지 않았습니다");
    expect(status.learningLifecycle).toMatchObject({
      productTerm: "retrieval_embedding_index",
      label: "코퍼스 준비 · 임베딩 전",
      modelFineTuningPerformed: false,
      corpusPrepared: true,
      fullEmbeddingGenerated: false,
      dbUploadVerified: false,
      vectorSearchUsable: false,
      nextGateId: "apply-sif-only-migration",
      nextGateLabel: "SIF-only DB migration 승인"
    });
    expect(status.learningLifecycle.answer).toContain("모델 파인튜닝도 전체 임베딩 생성도 아직 실행하지 않았습니다");
    expect(status.nextApprovalGate).toMatchObject({
      id: "apply-sif-only-migration",
      label: "SIF-only DB migration 승인",
      status: "waiting",
      artifactPath: "evaluation/sif-embedding-gate/sif-embedding-only-migration.sql"
    });
    expect(status.nextApprovalGate.detail).toContain("업로드 전 migration 승인");
    expect(status.approvalPacket).toMatchObject({
      scope: "sif_embedding_next_approval_gate",
      decisionCount: 6
    });
    expect(status.approvalPacket.decisions[0]).toContain("SIF-only embedding migration");
    expect(status.approvalPacket.requiredArtifacts.map((artifact) => artifact.path)).toEqual([
      "evaluation\\sif-embedding-gate\\report.json",
      "evaluation\\sif-embedding-gate\\sif-embedding-batch-manifest.json",
      "evaluation\\sif-embedding-gate\\sif-embedding-corpus.jsonl",
      "evaluation/sif-embedding-gate/sif-embedding-only-migration.sql"
    ]);
    expect(status.approvalPacket.safetyLocks.every((lock) => lock.locked)).toBe(true);
    expect(status.approvalSteps.map((step) => step.id)).toEqual(["migration", "embedding", "upload", "vector"]);
    expect(status.approvalSteps[0]).toMatchObject({
      id: "migration",
      status: "waiting"
    });
    expect(status.approvalSteps[0].detail).toContain("sif-embedding-only-migration.sql");
    expect(status.preflightChecks.some((check) => check.id === "vector_feature_flag_stays_off_until_upload_verified" && check.passed)).toBe(true);
    expect(status.failedCheckIds).toEqual([]);
    expect(status.commandHeldUntilApproval).toBe("npm.cmd run knowledge:sif-embedding-corpus -- --embed --approved-embedding --upload --approved-upload");
  });

  it("keeps runtime execution readiness separate from approval gate readiness", () => {
    const missingOpenAi = getSifEmbeddingGateStatus({
      OPENAI_API_KEY: "",
      NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
      SUPABASE_SERVICE_ROLE_KEY: "service-role-placeholder",
      SAFETY_REFERENCE_VECTOR_SEARCH: ""
    });
    const readyRuntime = getSifEmbeddingGateStatus({
      OPENAI_API_KEY: "sk-test",
      NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
      SUPABASE_SERVICE_ROLE_KEY: "service-role-placeholder",
      SAFETY_REFERENCE_VECTOR_SEARCH: "1"
    });

    expect(missingOpenAi.ok).toBe(true);
    expect(missingOpenAi.runtime.executionReadyAfterApproval).toBe(false);
    expect(readyRuntime.ok).toBe(false);
    expect(readyRuntime.runtime.executionReadyAfterApproval).toBe(true);
    expect(readyRuntime.runtime.vectorFeatureFlagEnabled).toBe(true);
    expect(readyRuntime.vectorGuard).toMatchObject({
      status: "blocked",
      flagEnabled: true,
      uploadVerified: false
    });
    expect(readyRuntime.readinessVerdict).toMatchObject({
      state: "blocked",
      embeddingAlreadyRun: false,
      dbUploadAlreadyRun: false
    });
    expect(readyRuntime.nextApprovalGate).toMatchObject({
      id: "disable-vector-flag",
      status: "blocked"
    });
    expect(readyRuntime.learningLifecycle).toMatchObject({
      label: "코퍼스 준비 · 임베딩 전",
      vectorSearchUsable: false,
      nextGateId: "disable-vector-flag"
    });
    expect(readyRuntime.approvalPacket.safetyLocks.find((lock) => lock.label === "Vector 검색 잠금")?.locked).toBe(true);
    expect(readyRuntime.message).toContain("SAFETY_REFERENCE_VECTOR_SEARCH=1");
  });
});
