import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

import { describe, expect, it } from "vitest";

const root = process.cwd();
const scanner = path.join(root, "scripts", "frontend_audit_bundle_contract.mjs");
const marker = "SafeClaw deterministic frontend audit global boundary probe";

function runScanner(mode: "normal" | "audit", source: string): number | null {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "safeclaw-audit-bundle-"));
  const chunkDirectory = path.join(directory, ".next", "static", "chunks", "app");
  const outputPath = path.join(directory, "report.json");
  fs.mkdirSync(chunkDirectory, { recursive: true });
  fs.writeFileSync(path.join(chunkDirectory, "layout.js"), source, "utf8");
  const result = spawnSync(process.execPath, [scanner, "--mode", mode], {
    cwd: directory,
    encoding: "utf8",
    env: {
      ...process.env,
      FRONTEND_AUDIT_BUILD_DIR: path.join(directory, ".next"),
      OUTPUT_PATH: outputPath,
    },
  });
  fs.rmSync(directory, { recursive: true, force: true });
  return result.status;
}

describe("frontend audit bundle contract", () => {
  it("rejects audit code in normal chunks and requires it in audit chunks", () => {
    expect(runScanner("normal", "console.log('normal');")).toBe(0);
    expect(runScanner("normal", marker)).not.toBe(0);
    expect(runScanner("audit", "console.log('normal');")).not.toBe(0);
    expect(runScanner("audit", marker)).toBe(0);
  });
});
