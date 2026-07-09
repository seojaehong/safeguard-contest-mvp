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
    expect(status.approvalSteps.map((step) => step.id)).toEqual(["migration", "embedding", "upload", "vector"]);
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
    expect(readyRuntime.message).toContain("SAFETY_REFERENCE_VECTOR_SEARCH=1");
  });
});
