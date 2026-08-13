import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Expected object");
  }
  return value as Record<string, unknown>;
}

function runVerifier(args: string[], env: Record<string, string | undefined> = {}) {
  return execFileSync(process.execPath, [
    "scripts/sif_embedding_post_migration_verify.mjs",
    ...args
  ], {
    cwd: process.cwd(),
    encoding: "utf8",
    env: {
      ...process.env,
      SUPABASE_URL: "",
      NEXT_PUBLIC_SUPABASE_URL: "",
      SUPABASE_SERVICE_ROLE_KEY: "",
      SAFETY_REFERENCE_VECTOR_SEARCH: "",
      ...env
    }
  });
}

function runVerifierAllowFailure(args: string[], env: Record<string, string | undefined> = {}) {
  try {
    return runVerifier(args, env);
  } catch (error) {
    if (typeof error === "object" && error !== null && "stdout" in error) {
      return String((error as { stdout: unknown }).stdout);
    }
    throw error;
  }
}

function writeReadyFixture(filePath: string, embeddingCount = 6032) {
  writeFileSync(filePath, JSON.stringify({
    safetyReferenceItems: {
      ok: true,
      status: 206,
      count: 6033,
      error: null
    },
    safetyReferenceEmbeddings: {
      ok: true,
      status: 206,
      count: embeddingCount,
      error: null
    },
    embeddingSamples: {
      ok: true,
      status: 200,
      rows: [{
        reference_item_id: "sif-1",
        embedding_model: "text-embedding-3-small",
        metadata: { contentHash: "hash-1", itemType: "sif-case" },
        created_at: "2026-07-09T00:00:00.000Z"
      }],
      error: null
    },
    matchRpc: {
      ok: true,
      status: 200,
      rowCount: 3,
      sampleTitles: ["외벽 도장 중 추락 사례"],
      model: "text-embedding-3-small",
      error: null
    }
  }, null, 2), "utf8");
}

describe("SIF embedding post-migration verifier", () => {
  it("is read-only and reports unconfigured without Supabase env", () => {
    const outDir = mkdtempSync(join(tmpdir(), "safeclaw-sif-post-verify-unconfigured-"));
    const outPath = join(outDir, "post-migration-verify.json");

    const stdout = runVerifierAllowFailure(["--no-env-file", "--output", outPath]);
    const result = asRecord(JSON.parse(stdout));
    const saved = asRecord(JSON.parse(readFileSync(outPath, "utf8")));

    expect(result.ok).toBe(false);
    expect(saved.scope).toBe("sif_embedding_post_migration_verify");
    expect(saved.dbMutationPerformed).toBe(false);
    expect(saved.configured).toBe(false);
    expect(saved.status).toBe("unconfigured");
    expect(saved.safetyReferenceEmbeddings).toBe(null);
    expect(saved.matchRpc).toBe(null);
  });

  it("passes with a fixture when uploaded rows, metadata samples, and RPC smoke are ready", () => {
    const outDir = mkdtempSync(join(tmpdir(), "safeclaw-sif-post-verify-ready-"));
    const fixturePath = join(outDir, "fixture.json");
    const outPath = join(outDir, "post-migration-verify.json");
    writeReadyFixture(fixturePath);

    const stdout = runVerifier(["--no-env-file", "--fixture", fixturePath, "--output", outPath]);
    const result = asRecord(JSON.parse(stdout));

    expect(result.ok).toBe(true);
    expect(result.status).toBe("ready");
    expect(result.dbMutationPerformed).toBe(false);
    expect(result.expectedCorpusCount).toBe(6032);
    expect(asRecord(result.safetyReferenceEmbeddings).count).toBe(6032);
    expect(asRecord(result.matchRpc).rowCount).toBe(3);
    expect((result.failedCheckIds as unknown[])).toEqual([]);
    const checks = result.checks as Array<Record<string, unknown>>;
    expect(checks.every((check) => check.passed === true)).toBe(true);
    expect(asRecord(result.verificationReceipt)).toMatchObject({
      algorithm: "sha256",
      machineVerified: true,
    });
    expect(asRecord(result.verificationReceipt).fingerprint).toMatch(/^[a-f0-9]{64}$/u);
    const runtimeReceipt = asRecord(JSON.parse(readFileSync(join(outDir, "runtime-vector-verification.json"), "utf8")));
    expect(runtimeReceipt).toMatchObject({
      schema: "safeclaw-sif-vector-runtime-verification/v1",
      model: "text-embedding-3-small",
      dimensions: 1536,
    });
    expect(asRecord(runtimeReceipt.verificationReceipt)).toEqual(result.verificationReceipt);
    expect(JSON.stringify(runtimeReceipt)).not.toContain("error");
  });

  it("blocks vector activation when uploaded row count differs from the fixed corpus", () => {
    const outDir = mkdtempSync(join(tmpdir(), "safeclaw-sif-post-verify-mismatch-"));
    const fixturePath = join(outDir, "fixture.json");
    const outPath = join(outDir, "post-migration-verify.json");
    writeReadyFixture(fixturePath, 6031);

    const stdout = runVerifierAllowFailure(["--no-env-file", "--fixture", fixturePath, "--output", outPath], {
      SAFETY_REFERENCE_VECTOR_SEARCH: "1"
    });
    const result = asRecord(JSON.parse(stdout));

    expect(result.ok).toBe(false);
    expect(result.status).toBe("upload-count-mismatch");
    expect(result.failedCheckIds as unknown[]).toContain("uploaded_row_count_matches_corpus");
    expect(result.failedCheckIds as unknown[]).toContain("vector_feature_flag_allowed");
    expect(result.nextAction).toContain("Do not enable vector search");
    expect(asRecord(result.verificationReceipt).machineVerified).toBe(false);
  });
});
