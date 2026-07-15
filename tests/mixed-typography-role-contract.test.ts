import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";

type Violation = { rule: string; value?: string };

describe("mixed typography role contract", () => {
  it("keeps every CSS rule on one semantic typography role", () => {
    const outputPath = path.join(os.tmpdir(), `safeclaw-mixed-typography-${process.pid}.json`);
    const result = spawnSync(process.execPath, [path.join(process.cwd(), "scripts", "frontend_consistency_audit.mjs")], {
      cwd: process.cwd(),
      encoding: "utf8",
      env: { ...process.env, OUTPUT_PATH: outputPath },
    });
    expect(result.status).toBe(0);
    const report = JSON.parse(fs.readFileSync(outputPath, "utf8")) as { violations: Violation[] };
    fs.rmSync(outputPath, { force: true });

    expect(report.violations.filter((violation) => violation.rule === "mixed-typography-role")).toEqual([]);
  }, 20_000);
});
