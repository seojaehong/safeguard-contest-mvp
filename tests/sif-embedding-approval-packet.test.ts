import { describe, expect, it } from "vitest";
import { buildSifEmbeddingApprovalPacket } from "@/lib/sif-embedding-approval-packet";
import { getSifEmbeddingGateStatus } from "@/lib/sif-embedding-gate-status";

describe("SIF embedding approval packet", () => {
  it("exports the next approval gate as Markdown without performing embedding or upload", () => {
    const status = getSifEmbeddingGateStatus({
      OPENAI_API_KEY: "sk-test",
      NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
      SUPABASE_SERVICE_ROLE_KEY: "service-role-placeholder",
      SAFETY_REFERENCE_VECTOR_SEARCH: ""
    });

    const packet = buildSifEmbeddingApprovalPacket(status);

    expect(packet.scope).toBe("sif_embedding_approval_packet");
    expect(packet.gateId).toBe("apply-sif-only-migration");
    expect(packet.dbMutationPerformed).toBe(false);
    expect(packet.embeddingGenerated).toBe(false);
    expect(packet.uploaded).toBe(false);
    expect(packet.canary).toMatchObject({
      performed: true,
      corpusCount: 3,
      embeddedCount: 3,
      uploadedCount: 0,
      dbMutationPerformed: false
    });
    expect(packet.operatorGate).toMatchObject({
      status: "approval-request-open",
      gateId: "apply-sif-only-migration",
      migrationArtifact: {
        path: "evaluation/sif-embedding-gate/sif-embedding-only-migration.sql",
        exists: true
      }
    });
    expect(packet.operatorGate.forbiddenBeforeApproval).toContain("전체 SIF 임베딩 생성");
    expect(packet.postMigrationVerification).toMatchObject({
      status: "migration-required",
      uploadedCount: 0,
      expectedCorpusCount: 6032,
      tableReady: false,
      rpcReady: false
    });
    expect(packet.fileName).toBe("safeclaw-sif-embedding-approval-apply-sif-only-migration.md");
    expect(packet.approvalFingerprint).toHaveLength(64);
    expect(packet.artifactIntegrity).toHaveLength(4);
    expect(packet.artifactIntegrity.find((artifact) => artifact.label === "SIF-only migration")?.sha256).toHaveLength(64);
    expect(packet.requiredArtifacts.map((artifact) => artifact.path)).toContain(
      "evaluation/sif-embedding-gate/sif-embedding-only-migration.sql"
    );
    expect(packet.markdown).toContain("# SIF Embedding Approval Packet");
    expect(packet.markdown).toContain("Embedding corpus: 6,032");
    expect(packet.markdown).toContain("Model fine-tuning performed: no");
    expect(packet.markdown).toContain("DB mutation performed: no");
    expect(packet.markdown).toContain("## Operator Gate Runbook");
    expect(packet.markdown).toContain("Approval question: SIF 전용 마이그레이션 SQL");
    expect(packet.markdown).toContain("Forbidden before approval:");
    expect(packet.markdown).toContain("전체 SIF 임베딩 생성");
    expect(packet.markdown).toContain("Non-approval fallback:");
    expect(packet.markdown).toContain("## Post-Migration Verification");
    expect(packet.markdown).toContain("Status: 마이그레이션 필요");
    expect(packet.markdown).toContain("Uploaded rows: 0 / 6,032");
    expect(packet.markdown).toContain("## Canary Embedding Evidence");
    expect(packet.markdown).toContain("소규모 검증 임베딩 완료 · 업로드 전");
    expect(packet.markdown).toContain("Embedded count: 3");
    expect(packet.markdown).toContain("Uploaded count: 0");
    expect(packet.markdown).toContain("Approval fingerprint:");
    expect(packet.markdown).toContain("## Artifact Integrity");
    expect(packet.markdown).toContain("SIF 전용 마이그레이션: present");
    expect(packet.markdown).toContain("## Preflight Checks");
    expect(packet.markdown).toContain("Do not run before the required approval gate passes.");
    expect(packet.markdown).toContain("npm.cmd run knowledge:sif-embedding-corpus -- --embed --approved-embedding --upload --approved-upload");
  });

  it("documents the vision/OCR harness path for photo hazard and before/after improvement memory", () => {
    const status = getSifEmbeddingGateStatus({
      OPENAI_API_KEY: "",
      SUPABASE_URL: "https://example.supabase.co",
      SUPABASE_SERVICE_ROLE_KEY: "service-role-placeholder",
      SAFETY_REFERENCE_VECTOR_SEARCH: ""
    });

    const packet = buildSifEmbeddingApprovalPacket(status);

    expect(packet.relatedHarness).toEqual({
      visionEndpoint: "/api/input-photos/hazard-analysis",
      improvementEndpointPattern: "/api/workpacks/[id]/improvements",
      maxInputPhotos: 10,
      acceptedOnly: true,
      beforeAfterSupported: true,
      ocrSupported: true
    });
    expect(packet.markdown).toContain("Initial field photos");
    expect(packet.markdown).toContain("/api/input-photos/hazard-analysis");
    expect(packet.markdown).toContain("up to 10 files");
    expect(packet.markdown).toContain("Only user-accepted candidates enter the DB harness improvement memory.");
    expect(packet.markdown).toContain("## Vision/OCR Harness Path");
    expect(packet.markdown).toContain("Before/After improvements:");
    expect(packet.markdown).toContain("사진 분석/OCR 데이터를 저장합니다.");
  });
});
