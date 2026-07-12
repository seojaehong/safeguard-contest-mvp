import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";

import { describe, expect, it } from "vitest";

const root = process.cwd();
const scanner = path.join(root, "scripts", "frontend_audit_bundle_contract.mjs");
const marker = "SafeClaw deterministic frontend audit global boundary probe";

function currentCanonicalIdentity(): string {
  const moduleUrl = pathToFileURL(path.join(root, "scripts", "frontend_audit_source_identity.mjs")).href;
  const source = `import * as identity from ${JSON.stringify(moduleUrl)}; console.log(JSON.stringify(identity.canonicalFrontendSourceIdentity(${JSON.stringify(root)}).sourceIdentity));`;
  const result = spawnSync(process.execPath, ["--input-type=module", "--eval", source], {
    cwd: root,
    encoding: "utf8",
  });
  if (result.status !== 0) throw new Error(result.stderr || "Canonical frontend identity probe failed.");
  return JSON.parse(result.stdout) as string;
}

function runScanner(mode: "normal" | "audit", source: string) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "safeclaw-audit-bundle-"));
  const chunkDirectory = path.join(directory, ".next", "static", "chunks", "app");
  const outputPath = path.join(directory, "report.json");
  fs.mkdirSync(chunkDirectory, { recursive: true });
  fs.writeFileSync(path.join(chunkDirectory, "layout.js"), source, "utf8");
  fs.writeFileSync(path.join(directory, ".next", "BUILD_ID"), "fixture-build-id\n", "utf8");
  const result = spawnSync(process.execPath, [scanner, "--mode", mode], {
    cwd: root,
    encoding: "utf8",
    env: {
      ...process.env,
      FRONTEND_AUDIT_BUILD_DIR: path.join(directory, ".next"),
      OUTPUT_PATH: outputPath,
    },
  });
  const report = JSON.parse(fs.readFileSync(outputPath, "utf8")) as Record<string, unknown>;
  fs.rmSync(directory, { recursive: true, force: true });
  return { status: result.status, report };
}

describe("frontend audit bundle contract", () => {
  it("rejects audit code in normal chunks and requires it in audit chunks", () => {
    expect(runScanner("normal", "console.log('normal');").status).toBe(0);
    expect(runScanner("normal", marker).status).not.toBe(0);
    expect(runScanner("audit", "console.log('normal');").status).not.toBe(0);
    const audit = runScanner("audit", marker);
    expect(audit.status).toBe(0);
    expect(audit.report).toMatchObject({
      buildId: "fixture-build-id",
      sourceSha: expect.stringMatching(/^[0-9a-f]{40}$/),
      sourceIdentity: currentCanonicalIdentity(),
      buildIdentity: expect.stringMatching(/^[0-9a-f]{64}$/),
    });
  }, 15_000);
});
