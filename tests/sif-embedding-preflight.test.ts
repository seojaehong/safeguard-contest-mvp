import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

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

describe("SIF embedding approval preflight", () => {
  it("validates the fixed corpus/manifest without embedding or DB upload", () => {
    const outDir = mkdtempSync(join(tmpdir(), "safeclaw-sif-preflight-"));
    const outPath = join(outDir, "approval-preflight-report.json");

    const stdout = execFileSync(process.execPath, [
      "scripts/sif_embedding_approval_preflight.mjs",
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
    expect(saved.commandHeldUntilApproval).toBe("npm.cmd run knowledge:sif-embedding-corpus -- --embed --upload --approved-upload");
    expect(asStringArray(saved.failedCheckIds)).toEqual([]);

    const env = asRecord(saved.env);
    expect(env.executionEnvReady).toBe(false);
    expect(env.requireExecutionEnv).toBe(false);
  });
});
