import { spawnSync } from "node:child_process";
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

describe("SIF embedding runtime DB probe", () => {
  it("is read-only and writes an unconfigured report when Supabase env is absent", () => {
    const outDir = mkdtempSync(join(tmpdir(), "safeclaw-sif-runtime-probe-"));
    const outPath = join(outDir, "runtime-db-probe.json");

    const result = spawnSync(process.execPath, [
      "scripts/sif_embedding_runtime_probe.mjs",
      "--no-env-file",
      "--output",
      outPath
    ], {
      cwd: process.cwd(),
      encoding: "utf8",
      env: {
        ...process.env,
        SUPABASE_URL: "",
        NEXT_PUBLIC_SUPABASE_URL: "",
        SUPABASE_SERVICE_ROLE_KEY: "",
        SAFETY_REFERENCE_VECTOR_SEARCH: ""
      }
    });

    expect(result.status).toBe(1);
    const report = asRecord(JSON.parse(readFileSync(outPath, "utf8")));
    expect(report.scope).toBe("sif_embedding_runtime_db_probe");
    expect(report.dbMutationPerformed).toBe(false);
    expect(report.configured).toBe(false);
    expect(report.status).toBe("unconfigured");
    expect(report.safetyReferenceItems).toBe(null);
    expect(report.safetyReferenceEmbeddings).toBe(null);
    expect(report.matchRpc).toBe(null);
  });
});
