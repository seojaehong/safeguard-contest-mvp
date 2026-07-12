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

type CssRule = {
  declarations: string;
  selectors: string[];
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

function cssRules(source: string): CssRule[] {
  const uncommentedSource = source.replace(/\/\*[\s\S]*?\*\//gu, "");
  return Array.from(uncommentedSource.matchAll(/([^{}]+)\{([^{}]*)\}/gu), (match) => ({
    declarations: match[2].replace(/\s+/gu, " ").trim(),
    selectors: match[1]
      .split(",")
      .map((selector) => selector.replace(/\s+/gu, " ").trim()),
  }));
}

function declarationsFor(source: string, selector: string): string[] {
  const normalizedSelector = selector.replace(/\s+/gu, " ").trim();
  return cssRules(source)
    .filter((rule) => rule.selectors.includes(normalizedSelector))
    .map((rule) => rule.declarations);
}

function expectDeclaration(source: string, selector: string, declaration: string): void {
  expect(
    declarationsFor(source, selector).some((declarations) => declarations.includes(declaration)),
    `${selector} must include ${declaration}`,
  ).toBe(true);
}

describe("AI connect design contract", () => {
  const css = fs.readFileSync(path.join(process.cwd(), "app", "globals.css"), "utf8");

  it("maps AI code surfaces through existing global color tokens", () => {
    expectDeclaration(css, ".ai-connect-workspace", "--ai-connect-code-background: var(--steel-0)");
    expectDeclaration(css, ".ai-connect-workspace", "--ai-connect-code-ink: var(--paper-0)");
    expect(declarationsFor(css, ".ai-connect-workspace").join(" ")).not.toMatch(
      /--ai-connect-code-(?:background|ink):\s*#/u,
    );
  });

  it("uses document-theme text tokens on the rendered Day surfaces", () => {
    expectDeclaration(
      css,
      ".safeclaw-module-shell.module-variant-document .ai-connect-sif-packet-actions a",
      "color: var(--workspace-ink)",
    );
    expectDeclaration(
      css,
      ".safeclaw-module-shell.module-variant-document .ai-connect-sif-verdict > span",
      "color: var(--workspace-ink)",
    );
  });

  it("keeps the final document vector active state semantic", () => {
    expectDeclaration(
      css,
      ".safeclaw-module-shell.module-variant-document .ai-connect-sif-vector-guard.active",
      "border-color: var(--workspace-success)",
    );
  });

  it("assigns the rendered token label a complete component-title tuple", () => {
    const selector = ".ai-connect-token-items article strong";
    for (const declaration of [
      "font-size: var(--text-component-title)",
      "font-weight: 700",
      "line-height: var(--leading-component-title)",
      "letter-spacing: var(--tracking-component-title)",
    ] as const) {
      expectDeclaration(css, selector, declaration);
    }
  });

  it("keeps the complete AI connect selector family free of audit findings", () => {
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
