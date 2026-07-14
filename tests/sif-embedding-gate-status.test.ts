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
    expect(status.canary).toMatchObject({
      performed: true,
      label: "소규모 검증 임베딩 완료 · 업로드 전",
      corpusCount: 3,
      embeddedCount: 3,
      uploadedCount: 0,
      mode: "embed-only",
      embeddingModel: "text-embedding-3-small",
      embeddingDimensions: 1536,
      dbMutationPerformed: false
    });
    expect(status.canary.answer).toContain("3건 소규모 검증 임베딩 벡터");
    expect(status.canary.vectorsPath).toBe("evaluation\\sif-embedding-canary-2026-07-09\\sif-embedding-vectors.jsonl");
    expect(status.canary.artifactIntegrity).toHaveLength(4);
    expect(status.canary.artifactIntegrity.every((artifact) => artifact.exists)).toBe(true);
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
      nextGateLabel: "SIF 전용 DB 마이그레이션 승인"
    });
    expect(status.learningLifecycle.answer).toContain("모델 파인튜닝도 전체 임베딩 생성도 아직 실행하지 않았습니다");
    expect(status.nextApprovalGate).toMatchObject({
      id: "apply-sif-only-migration",
      label: "SIF 전용 DB 마이그레이션 승인",
      status: "waiting",
      artifactPath: "evaluation/sif-embedding-gate/sif-embedding-only-migration.sql"
    });
    expect(status.nextApprovalGate.detail).toContain("업로드 전 마이그레이션 승인");
    expect(status.operatorGate).toMatchObject({
      status: "approval-request-open",
      gateId: "apply-sif-only-migration",
      title: "다음 승인 단계가 열려 있습니다.",
      migrationArtifact: {
        path: "evaluation/sif-embedding-gate/sif-embedding-only-migration.sql",
        exists: true
      },
      canaryEvidence: {
        performed: true,
        embeddedCount: 3,
        uploadedCount: 0,
        mode: "embed-only"
      }
    });
    expect(status.operatorGate.approvalQuestion).toContain("SIF 전용 마이그레이션 SQL");
    expect(status.operatorGate.migrationArtifact.sha256).toHaveLength(64);
    expect(status.operatorGate.evidenceSummary.join("\n")).toContain("전체 SIF 코퍼스 6,032건");
    expect(status.operatorGate.evidenceSummary.join("\n")).toContain("소규모 검증은 3건 임베딩만 생성");
    expect(status.operatorGate.evidenceSummary.join("\n")).toContain("마이그레이션 후 검증은 마이그레이션 필요");
    expect(status.operatorGate.allowedBeforeApproval).toContain("승인 패킷과 마이그레이션 SQL 변경 내용 검토");
    expect(status.operatorGate.forbiddenBeforeApproval).toEqual([
      "운영 DB 마이그레이션 적용",
      "전체 SIF 임베딩 생성",
      "safety_reference_embeddings 업로드",
      "SAFETY_REFERENCE_VECTOR_SEARCH=1 활성화"
    ]);
    expect(status.operatorGate.checklist.map((item) => item.status)).toEqual(["done", "done", "required", "done", "done"]);
    expect(status.operatorGate.checklist.find((item) => item.id === "post-migration-verifier")?.evidence).toContain("post-migration-verify.json");
    expect(status.operatorGate.heldCommands).toContain(status.commandHeldUntilApproval);
    expect(status.operatorGate.heldCommands).toContain("npm.cmd run knowledge:sif-embedding-post-migration-verify -- --output evaluation/sif-embedding-gate/post-migration-verify.json");
    expect(status.postMigrationVerification).toMatchObject({
      reportPath: "evaluation/sif-embedding-gate/post-migration-verify.json",
      ok: false,
      status: "migration-required",
      expectedCorpusCount: 6032,
      uploadedCount: 0,
      tableReady: false,
      rpcReady: false,
      vectorFeatureFlagEnabled: false,
      dbMutationPerformed: false
    });
    expect(status.postMigrationVerification.failedCheckIds).toEqual([
      "embedding_table_ready",
      "uploaded_row_count_matches_corpus",
      "match_rpc_ready",
      "embedding_samples_have_metadata"
    ]);
    expect(status.approvalPacket).toMatchObject({
      scope: "sif_embedding_next_approval_gate",
      decisionCount: 6
    });
    expect(status.approvalPacket.approvalFingerprint).toHaveLength(64);
    expect(status.approvalPacket.decisions[0]).toContain("SIF 전용 임베딩 마이그레이션");
    expect(status.approvalPacket.requiredArtifacts.map((artifact) => artifact.path)).toEqual([
      "evaluation\\sif-embedding-gate\\report.json",
      "evaluation\\sif-embedding-gate\\sif-embedding-batch-manifest.json",
      "evaluation\\sif-embedding-gate\\sif-embedding-corpus.jsonl",
      "evaluation/sif-embedding-gate/sif-embedding-only-migration.sql"
    ]);
    expect(status.approvalPacket.artifactIntegrity).toHaveLength(4);
    expect(status.approvalPacket.artifactIntegrity.every((artifact) => artifact.exists)).toBe(true);
    expect(status.approvalPacket.artifactIntegrity.find((artifact) => artifact.label === "SIF corpus JSONL")).toMatchObject({
      contentHash: status.corpus.corpusHash,
      recordCount: 6032
    });
    expect(status.approvalPacket.artifactIntegrity.find((artifact) => artifact.label === "SIF 전용 마이그레이션")?.sha256).toHaveLength(64);
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
    expect(readyRuntime.operatorGate).toMatchObject({
      status: "blocked",
      gateId: "disable-vector-flag"
    });
    expect(readyRuntime.operatorGate.forbiddenBeforeApproval).toContain("SAFETY_REFERENCE_VECTOR_SEARCH=1 활성화");
    expect(readyRuntime.learningLifecycle).toMatchObject({
      label: "코퍼스 준비 · 임베딩 전",
      vectorSearchUsable: false,
      nextGateId: "disable-vector-flag"
    });
    expect(readyRuntime.approvalPacket.safetyLocks.find((lock) => lock.label === "벡터 검색 잠금")?.locked).toBe(true);
    expect(readyRuntime.message).toContain("SAFETY_REFERENCE_VECTOR_SEARCH=1");
  });
});
