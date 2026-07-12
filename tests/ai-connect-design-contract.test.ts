import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

import { describe, expect, it } from "vitest";

type Violation = {
  rule: string;
  file: string;
  line: number;
  value?: string;
};

const targetRules = new Set([
  "font-family-token",
  "font-size-tier",
  "line-height-tier",
  "tracking-tier",
  "mixed-typography-role",
  "typography-tuple",
  "radius-tier",
  "important-declaration",
  "decorative-gradient",
]);

const declarationLineRules = new Set([
  "font-family-token",
  "font-size-tier",
  "line-height-tier",
  "tracking-tier",
  "important-declaration",
]);

function lineNumber(source: string, offset: number): number {
  return source.slice(0, offset).split(/\r?\n/u).length;
}

function targetRuleLines(source: string): Set<number> {
  const lines = new Set<number>();
  for (const match of source.matchAll(/([^{}]+)\{([^{}]*)\}/gu)) {
    const selectors = match[1]
      .split(",")
      .map((selector) => selector.replace(/\s+/gu, " ").trim());
    if (!selectors.some((selector) => selector.includes(".ai-connect-"))) continue;

    const start = lineNumber(source, match.index);
    const end = lineNumber(source, match.index + match[0].length);
    for (let line = start; line <= end; line += 1) lines.add(line);
  }
  return lines;
}

function violationCounts(violations: readonly Violation[]): Record<string, number> {
  return violations.reduce<Record<string, number>>((counts, violation) => {
    counts[violation.rule] = (counts[violation.rule] ?? 0) + 1;
    return counts;
  }, {});
}

describe("AI connect design contract", () => {
  it("keeps the complete AI connect selector family free of audit findings", () => {
    const css = fs.readFileSync(path.join(process.cwd(), "app", "globals.css"), "utf8");
    const rawTargetLines = targetRuleLines(css);
    const uncommentedTargetLines = targetRuleLines(css.replace(/\/\*[\s\S]*?\*\//gu, ""));
    expect(rawTargetLines.size).toBeGreaterThan(0);
    expect(uncommentedTargetLines.size).toBeGreaterThan(0);

    const outputPath = path.join(os.tmpdir(), `safeclaw-ai-connect-design-${process.pid}.json`);
    const result = spawnSync(process.execPath, [path.join(process.cwd(), "scripts", "frontend_consistency_audit.mjs")], {
      cwd: process.cwd(),
      encoding: "utf8",
      env: { ...process.env, OUTPUT_PATH: outputPath },
    });
    expect(result.status).toBe(1);

    const report = JSON.parse(fs.readFileSync(outputPath, "utf8")) as { violations: Violation[] };
    fs.rmSync(outputPath, { force: true });
    const ownedViolations = report.violations.filter((violation) => {
      if (violation.file !== "app/globals.css" || !targetRules.has(violation.rule)) return false;
      if (violation.value?.includes(".ai-connect-")) return true;
      const targetLines = declarationLineRules.has(violation.rule)
        ? rawTargetLines
        : uncommentedTargetLines;
      return targetLines.has(violation.line);
    });

    expect(violationCounts(ownedViolations)).toEqual({});
  }, 20_000);
});
