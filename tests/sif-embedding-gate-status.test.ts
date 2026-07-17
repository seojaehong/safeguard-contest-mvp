import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import postMigrationFixture from "@/evaluation/sif-embedding-gate/post-migration-verify.json";
import preflightFixture from "@/evaluation/sif-embedding-gate/approval-preflight-report.json";
import runtimeProbeFixture from "@/evaluation/sif-embedding-gate/runtime-db-probe.json";
import { getSifEmbeddingGateStatus } from "@/lib/sif-embedding-gate-status";

function canonicalizeMachineFixture(value: unknown, key = ""): unknown {
  if (key === "sha256" || key === "byteSize" || key === "approvalFingerprint") {
    return `<${typeof value}>`;
  }
  if (key === "generatedAt" || key === "checkedAt") {
    return "<timestamp>";
  }
  if (typeof value === "string") {
    const normalizedPath = /path$/iu.test(key) ? value.replace(/\\/g, "/") : value;
    return key === "evidenceSummary"
      ? normalizedPath.replace(/승인 지문 [0-9a-f]{64}/u, "승인 지문 <sha256>")
      : normalizedPath;
  }
  if (Array.isArray(value)) return value.map((item) => canonicalizeMachineFixture(item, key));
  if (typeof value !== "object" || value === null) return value;

  return Object.fromEntries(
    Object.entries(value)
      .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
      .map(([entryKey, entryValue]) => [entryKey, canonicalizeMachineFixture(entryValue, entryKey)])
  );
}

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
      label: "Canary 임베딩 완료 · 업로드 전",
      corpusCount: 3,
      embeddedCount: 3,
      uploadedCount: 0,
      mode: "embed-only",
      embeddingModel: "text-embedding-3-small",
      embeddingDimensions: 1536,
      dbMutationPerformed: false
    });
    expect(status.canary.answer).toContain("3건 canary 임베딩 벡터");
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
    expect(status.operatorGate).toMatchObject({
      status: "approval-request-open",
      gateId: "apply-sif-only-migration",
      title: "다음 승인 게이트가 열려 있습니다.",
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
    expect(status.operatorGate.approvalQuestion).toContain("SIF-only migration SQL");
    expect(status.operatorGate.migrationArtifact.sha256).toHaveLength(64);
    expect(status.operatorGate.evidenceSummary.join("\n")).toContain("전체 SIF 코퍼스 6,032건");
    expect(status.operatorGate.evidenceSummary.join("\n")).toContain("Canary는 3건 embed-only");
    expect(status.operatorGate.evidenceSummary.join("\n")).toContain("Post-migration verifier는 migration-required");
    expect(status.operatorGate.allowedBeforeApproval).toContain("승인 패킷과 migration SQL diff 검토");
    expect(status.operatorGate.forbiddenBeforeApproval).toEqual([
      "운영 DB migration 적용",
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
    expect(status.approvalPacket.decisions[0]).toContain("SIF-only embedding migration");
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
    expect(status.approvalPacket.artifactIntegrity.find((artifact) => artifact.label === "SIF-only migration")?.sha256).toHaveLength(64);
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
    expect(readyRuntime.approvalPacket.safetyLocks.find((lock) => lock.label === "Vector 검색 잠금")?.locked).toBe(true);
    expect(readyRuntime.message).toContain("SAFETY_REFERENCE_VECTOR_SEARCH=1");
  });

  it("matches the authoritative base machine fixture before presentation", () => {
    const status = getSifEmbeddingGateStatus({
      OPENAI_API_KEY: "",
      SUPABASE_URL: "https://example.supabase.co",
      SUPABASE_SERVICE_ROLE_KEY: "service-role-placeholder",
      SAFETY_REFERENCE_VECTOR_SEARCH: ""
    });

    expect(status.nextApprovalDecisions).toEqual(preflightFixture.nextApprovalDecisions);
    expect(status.approvalPacket.decisions).toEqual(preflightFixture.nextApprovalDecisions);
    expect(status.runtimeDbProbe.message).toBe(runtimeProbeFixture.message);
    expect(status.postMigrationVerification.nextAction).toBe(postMigrationFixture.nextAction);

    expect({
      valueTypes: {
        ok: typeof status.ok,
        stage: typeof status.stage,
        gateId: typeof status.nextApprovalGate.id,
        gateStatus: typeof status.nextApprovalGate.status,
        runtimeStatus: typeof status.runtimeDbProbe.status,
        verifierStatus: typeof status.postMigrationVerification.status,
        canaryMode: typeof status.canary.mode,
        uploadedCount: typeof status.postMigrationVerification.uploadedCount,
        failedCheckIdsIsArray: Array.isArray(status.postMigrationVerification.failedCheckIds)
      },
      enums: {
        stage: status.stage,
        gateId: status.nextApprovalGate.id,
        operatorGateId: status.operatorGate.gateId,
        gateStatus: status.nextApprovalGate.status,
        operatorStatus: status.operatorGate.status,
        runtimeStatus: status.runtimeDbProbe.status,
        verifierStatus: status.postMigrationVerification.status,
        canaryMode: status.canary.mode
      },
      paths: {
        report: status.artifacts.reportPath,
        manifest: status.artifacts.manifestPath,
        corpus: status.artifacts.corpusPath,
        migration: status.artifacts.migrationPath,
        script: status.artifacts.scriptPath,
        verifier: status.postMigrationVerification.reportPath
      }
    }).toEqual({
      valueTypes: {
        ok: "boolean",
        stage: "string",
        gateId: "string",
        gateStatus: "string",
        runtimeStatus: "string",
        verifierStatus: "string",
        canaryMode: "string",
        uploadedCount: "number",
        failedCheckIdsIsArray: true
      },
      enums: {
        stage: "ready-for-approval",
        gateId: "apply-sif-only-migration",
        operatorGateId: "apply-sif-only-migration",
        gateStatus: "waiting",
        operatorStatus: "approval-request-open",
        runtimeStatus: runtimeProbeFixture.status,
        verifierStatus: postMigrationFixture.status,
        canaryMode: "embed-only"
      },
      paths: {
        report: "evaluation\\sif-embedding-gate\\report.json",
        manifest: "evaluation\\sif-embedding-gate\\sif-embedding-batch-manifest.json",
        corpus: "evaluation\\sif-embedding-gate\\sif-embedding-corpus.jsonl",
        migration: "evaluation/sif-embedding-gate/sif-embedding-only-migration.sql",
        script: "scripts/prepare_sif_embedding_corpus.mjs",
        verifier: "evaluation/sif-embedding-gate/post-migration-verify.json"
      }
    });
  });

  it("normalizes filesystem-only machine fixture fields across operating systems", () => {
    const windowsFingerprint = "a".repeat(64);
    const linuxFingerprint = "b".repeat(64);
    const windowsFixture = {
      artifact: {
        path: "evaluation\\sif-embedding-gate\\report.json",
        byteSize: 123,
        sha256: "c".repeat(64)
      },
      approvalFingerprint: windowsFingerprint,
      evidenceSummary: [
        `승인 지문 ${windowsFingerprint}로 corpus hash, 모델/차원, migration SQL을 고정합니다.`
      ]
    };
    const linuxFixture = {
      artifact: {
        path: "evaluation/sif-embedding-gate/report.json",
        byteSize: 456,
        sha256: "d".repeat(64)
      },
      approvalFingerprint: linuxFingerprint,
      evidenceSummary: [
        `승인 지문 ${linuxFingerprint}로 corpus hash, 모델/차원, migration SQL을 고정합니다.`
      ]
    };

    expect(canonicalizeMachineFixture(windowsFixture)).toEqual(canonicalizeMachineFixture(linuxFixture));
  });

  it("matches the cross-platform base machine fixture hash outside Markdown", () => {
    const status = getSifEmbeddingGateStatus({
      OPENAI_API_KEY: "",
      SUPABASE_URL: "https://example.supabase.co",
      SUPABASE_SERVICE_ROLE_KEY: "service-role-placeholder",
      SAFETY_REFERENCE_VECTOR_SEARCH: ""
    });
    const jsonValue: unknown = JSON.parse(JSON.stringify(status));
    const canonicalFixture = JSON.stringify(canonicalizeMachineFixture(jsonValue));
    const fixtureHash = createHash("sha256").update(canonicalFixture).digest("hex");

    expect(fixtureHash).toBe("52eeb49392938b0a8430d66728d5e36fa21a01b56e875d30e036be50919468fd");
  });
});
