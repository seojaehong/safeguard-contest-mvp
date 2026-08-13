import { execFileSync } from "node:child_process";
import { cpSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

type SifCorpusQualityAdmission = {
  ok: boolean;
  failures: string[];
  checks: {
    corpusNonEmpty: boolean;
    emptyEmbeddingTextCount: number;
    missingControlsCount: number;
    missingPrimaryDocumentsCount: number;
    duplicateContentHashCount: number;
  };
};

type SifCorpusModule = {
  buildSifEmbeddingAdmissionErrors: (
    options: {
      embed: boolean;
      upload: boolean;
      approvedEmbedding: boolean;
      approvedUpload: boolean;
    },
    qualityAdmission: SifCorpusQualityAdmission,
  ) => string[];
  evaluateSifCorpusQualityAdmission: (
    validation: Record<string, number>,
    corpusCount: number,
  ) => SifCorpusQualityAdmission;
};

async function loadSifCorpusModule(): Promise<SifCorpusModule> {
  // @ts-expect-error -- executable MJS module exposes the audited runtime API.
  return await import("../scripts/prepare_sif_embedding_corpus.mjs") as SifCorpusModule;
}

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Expected object");
  }
  return value as Record<string, unknown>;
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) {
    throw new Error("Expected string array");
  }
  return value;
}

function normalizedArtifactPaths(value: unknown): string[] {
  if (!Array.isArray(value)) {
    throw new Error("Expected artifact array");
  }
  return value.map((item) => {
    const record = asRecord(item);
    expect(record.sha256).toEqual(expect.stringMatching(/^[0-9a-f]{64}$/u));
    expect(typeof record.bytes === "number" && record.bytes > 0).toBe(true);
    return String(record.path).replaceAll("\\", "/");
  });
}

describe("SIF embedding approval preflight", () => {
  it("validates the fixed corpus/manifest without embedding or DB upload", () => {
    const outDir = mkdtempSync(join(tmpdir(), "safeclaw-sif-preflight-"));
    const outPath = join(outDir, "approval-preflight-report.json");

    const stdout = execFileSync(process.execPath, [
      "scripts/sif_embedding_approval_preflight.mjs",
      "--no-env-file",
      "--output",
      outPath
    ], {
      cwd: process.cwd(),
      encoding: "utf8",
      env: {
        ...process.env,
        OPENAI_API_KEY: "",
        SUPABASE_SERVICE_ROLE_KEY: "",
        SUPABASE_URL: "",
        NEXT_PUBLIC_SUPABASE_URL: "",
        SAFETY_REFERENCE_VECTOR_SEARCH: ""
      }
    });

    const result = asRecord(JSON.parse(stdout));
    const saved = asRecord(JSON.parse(readFileSync(outPath, "utf8")));
    expect(result.ok).toBe(true);
    expect(saved.dbMutationPerformed).toBe(false);
    expect(saved.embeddingGenerated).toBe(false);
    expect(saved.uploaded).toBe(false);
    expect(saved.corpusCount).toBe(6032);
    expect(saved.batchCount).toBe(61);
    expect(saved.sourceSha).toMatch(/^[0-9a-f]{40}$/u);
    expect(saved.migrationPath).toBe("evaluation/sif-embedding-gate/sif-embedding-only-migration.sql");
    expect(saved.commandHeldUntilApproval).toBe("npm.cmd run knowledge:sif-embedding-corpus -- --embed --approved-embedding --upload --approved-upload");
    expect(asStringArray(saved.failedCheckIds)).toEqual([]);
    expect(asRecord(saved.corpusInspection)).toMatchObject({
      lineCount: 6032,
      parsedRecordCount: 6032,
      parseErrorCount: 0,
      invalidRecordCount: 0,
      duplicateReferenceItemIdCount: 0,
      duplicateContentHashCount: 0,
      manifestBatchFailureCount: 0
    });
    expect(normalizedArtifactPaths(saved.artifactIntegrity)).toEqual(expect.arrayContaining([
      "evaluation/sif-embedding-gate/report.json",
      "evaluation/sif-embedding-gate/sif-embedding-corpus.jsonl",
      "evaluation/sif-embedding-gate/sif-embedding-only-migration.sql"
    ]));
    const checks = (saved.checks as Array<Record<string, unknown>>);
    expect(checks.some((check) => check.id === "embedding_requires_explicit_cost_approval_flag" && check.passed === true)).toBe(true);
    expect(checks.some((check) => check.id === "preflight_source_sha_recorded" && check.passed === true)).toBe(true);
    expect(checks.some((check) => check.id === "artifact_integrity_recorded" && check.passed === true)).toBe(true);
    const migrationCheck = checks.find((check) => check.id === "migration_scope_is_sif_embedding_only");
    expect(migrationCheck?.passed).toBe(true);
    expect(asRecord(migrationCheck?.evidence).sifOnly).toBe(true);

    const env = asRecord(saved.env);
    expect(env.executionEnvReady).toBe(false);
    expect(env.requireExecutionEnv).toBe(false);
  });

  it("loads an explicit env file for execution-readiness checks without changing the approval hold", () => {
    const outDir = mkdtempSync(join(tmpdir(), "safeclaw-sif-preflight-env-"));
    const outPath = join(outDir, "approval-preflight-report.json");
    const envPath = join(outDir, ".env.local");
    writeFileSync(envPath, [
      "OPENAI_API_KEY=sk-test-key-for-preflight",
      "SUPABASE_URL=https://example.supabase.co",
      "SUPABASE_SERVICE_ROLE_KEY=service-role-placeholder"
    ].join("\n"), "utf8");

    const stdout = execFileSync(process.execPath, [
      "scripts/sif_embedding_approval_preflight.mjs",
      "--no-env-file",
      "--env-file",
      envPath,
      "--require-execution-env",
      "--output",
      outPath
    ], {
      cwd: process.cwd(),
      encoding: "utf8",
      env: {
        ...process.env,
        OPENAI_API_KEY: "",
        SUPABASE_SERVICE_ROLE_KEY: "",
        SUPABASE_URL: "",
        NEXT_PUBLIC_SUPABASE_URL: "",
        SAFETY_REFERENCE_VECTOR_SEARCH: ""
      }
    });

    const result = asRecord(JSON.parse(stdout));
    const env = asRecord(result.env);
    expect(result.ok).toBe(true);
    expect(result.approvalHeld).toBe(true);
    expect(result.dbMutationPerformed).toBe(false);
    expect(result.embeddingGenerated).toBe(false);
    expect(result.uploaded).toBe(false);
    expect(env.openaiApiKeyPresent).toBe(true);
    expect(env.supabaseUrlPresent).toBe(true);
    expect(env.supabaseServiceRolePresent).toBe(true);
    expect(env.vectorFeatureFlagEnabled).toBe(false);
    expect(env.executionEnvReady).toBe(true);
    expect(env.requireExecutionEnv).toBe(true);
  });

  it("blocks vector retrieval enablement before upload count is verified", () => {
    const outDir = mkdtempSync(join(tmpdir(), "safeclaw-sif-preflight-vector-"));
    const outPath = join(outDir, "approval-preflight-report.json");
    const envPath = join(outDir, ".env.local");
    writeFileSync(envPath, [
      "OPENAI_API_KEY=sk-test-key-for-preflight",
      "SUPABASE_URL=https://example.supabase.co",
      "SUPABASE_SERVICE_ROLE_KEY=service-role-placeholder",
      "SAFETY_REFERENCE_VECTOR_SEARCH=1"
    ].join("\n"), "utf8");

    let stdout = "";
    try {
      execFileSync(process.execPath, [
        "scripts/sif_embedding_approval_preflight.mjs",
        "--no-env-file",
        "--env-file",
        envPath,
        "--require-execution-env",
        "--output",
        outPath
      ], {
        cwd: process.cwd(),
        encoding: "utf8",
        env: {
          ...process.env,
          OPENAI_API_KEY: "",
          SUPABASE_SERVICE_ROLE_KEY: "",
          SUPABASE_URL: "",
          NEXT_PUBLIC_SUPABASE_URL: "",
          SAFETY_REFERENCE_VECTOR_SEARCH: ""
        }
      });
    } catch (error) {
      if (typeof error === "object" && error !== null && "stdout" in error) {
        stdout = String((error as { stdout: unknown }).stdout);
      } else {
        throw error;
      }
    }

    const result = asRecord(JSON.parse(stdout));
    const failedCheckIds = asStringArray(result.failedCheckIds);
    expect(result.ok).toBe(false);
    expect(failedCheckIds).toContain("vector_feature_flag_stays_off_until_upload_verified");
    expect(result.dbMutationPerformed).toBe(false);
    expect(result.uploaded).toBe(false);
  });

  it("keeps the embedding cost approval guard in the corpus script", () => {
    const source = readFileSync("scripts/prepare_sif_embedding_corpus.mjs", "utf8");

    expect(source).toContain("--approved-embedding");
    expect(source).toContain("--embed requires explicit --approved-embedding after embedding cost approval");
    expect(source).toContain("embeddingApprovedFlag");
    expect(source).toContain("corpus quality admission failed");
  });

  it("fails closed on every mandatory SIF corpus quality defect", async () => {
    const {
      buildSifEmbeddingAdmissionErrors,
      evaluateSifCorpusQualityAdmission
    } = await loadSifCorpusModule();
    const cleanValidation = {
      emptyEmbeddingTextCount: 0,
      missingControlsCount: 0,
      missingPrimaryDocumentsCount: 0,
      duplicateContentHashCount: 0
    };

    expect(evaluateSifCorpusQualityAdmission(cleanValidation, 8)).toMatchObject({
      ok: true,
      failures: []
    });
    expect(evaluateSifCorpusQualityAdmission(cleanValidation, 0).failures).toContain("empty_corpus");
    expect(evaluateSifCorpusQualityAdmission({
      ...cleanValidation,
      emptyEmbeddingTextCount: 1
    }, 8).failures).toContain("empty_embedding_text");
    expect(evaluateSifCorpusQualityAdmission({
      ...cleanValidation,
      missingControlsCount: 1
    }, 8).failures).toContain("missing_controls");
    expect(evaluateSifCorpusQualityAdmission({
      ...cleanValidation,
      missingPrimaryDocumentsCount: 1
    }, 8).failures).toContain("missing_primary_documents");
    expect(evaluateSifCorpusQualityAdmission({
      ...cleanValidation,
      duplicateContentHashCount: 1
    }, 8).failures).toContain("duplicate_content_hashes");
    expect(evaluateSifCorpusQualityAdmission({}, 8)).toMatchObject({
      ok: false,
      failures: [
        "empty_embedding_text",
        "missing_controls",
        "missing_primary_documents",
        "duplicate_content_hashes"
      ]
    });

    const failedQuality = evaluateSifCorpusQualityAdmission({
      ...cleanValidation,
      missingControlsCount: 1
    }, 8);
    expect(buildSifEmbeddingAdmissionErrors({
      embed: true,
      upload: true,
      approvedEmbedding: true,
      approvedUpload: true
    }, failedQuality)).toEqual([
      "corpus quality admission failed: missing_controls"
    ]);
  });

  it("fails closed when a corpus record no longer matches its content hash", () => {
    const outDir = mkdtempSync(join(tmpdir(), "safeclaw-sif-preflight-tampered-"));
    const gateDir = join(outDir, "gate");
    const outPath = join(outDir, "approval-preflight-report.json");
    mkdirSync(gateDir, { recursive: true });
    cpSync("evaluation/sif-embedding-gate/report.json", join(gateDir, "report.json"), { recursive: true });
    cpSync(
      "evaluation/sif-embedding-gate/sif-embedding-batch-manifest.json",
      join(gateDir, "sif-embedding-batch-manifest.json"),
      { recursive: true }
    );
    cpSync(
      "evaluation/sif-embedding-gate/sif-embedding-corpus.jsonl",
      join(gateDir, "sif-embedding-corpus.jsonl"),
      { recursive: true }
    );
    const corpusPath = join(gateDir, "sif-embedding-corpus.jsonl");
    const lines = readFileSync(corpusPath, "utf8").trim().split(/\r?\n/u);
    const first = asRecord(JSON.parse(lines[0]));
    first.embeddingText = `${String(first.embeddingText)}\n변조된 입력`;
    lines[0] = JSON.stringify(first);
    writeFileSync(corpusPath, `${lines.join("\n")}\n`, "utf8");

    let stdout = "";
    try {
      execFileSync(process.execPath, [
        "scripts/sif_embedding_approval_preflight.mjs",
        "--gate-dir",
        gateDir,
        "--no-env-file",
        "--output",
        outPath
      ], {
        cwd: process.cwd(),
        encoding: "utf8",
        env: {
          ...process.env,
          OPENAI_API_KEY: "",
          SUPABASE_SERVICE_ROLE_KEY: "",
          SUPABASE_URL: "",
          NEXT_PUBLIC_SUPABASE_URL: "",
          SAFETY_REFERENCE_VECTOR_SEARCH: ""
        }
      });
    } catch (error) {
      if (typeof error === "object" && error !== null && "stdout" in error) {
        stdout = String((error as { stdout: unknown }).stdout);
      } else {
        throw error;
      }
    }

    const result = asRecord(JSON.parse(stdout));
    expect(result.ok).toBe(false);
    expect(asStringArray(result.failedCheckIds)).toEqual(expect.arrayContaining([
      "corpus_record_integrity",
      "corpus_hash_matches_report_and_manifest"
    ]));
    expect(asRecord(result.corpusInspection)).toMatchObject({
      lineCount: 6032,
      parsedRecordCount: 6032,
      invalidRecordCount: 1
    });
    expect(result.dbMutationPerformed).toBe(false);
    expect(result.embeddingGenerated).toBe(false);
    expect(result.uploaded).toBe(false);
  });
});
