import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

import postcss from "postcss";
import { describe, expect, it } from "vitest";

type Violation = {
  rule: string;
  file: string;
  line: number;
  value?: string;
};

const renderedPrefixes = [".v2-", ".demo-", ".scenario-strip"] as const;
const inventoryPrefixes = [...renderedPrefixes, ".mission-"] as const;

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
  "decorative-box-shadow",
  "decorative-text-shadow",
  "selector-role",
]);

const expectedRedCounts = {
  "decorative-box-shadow": 3,
  "decorative-gradient": 2,
  "font-size-tier": 7,
  "line-height-tier": 10,
  "radius-tier": 20,
  "tracking-tier": 6,
  "typography-tuple": 16,
} as const;

function normalizeSelector(selector: string): string {
  return selector.replace(/\s+/gu, " ").trim();
}

function selectorIsOwned(selector: string, prefixes: readonly string[]): boolean {
  const normalized = normalizeSelector(selector);
  if (normalized.includes("body:has(") || normalized.includes(".command-center-shell")) return false;
  return prefixes.some((prefix) => normalized.includes(prefix));
}

function declarationSelectorsByLine(source: string): Map<number, string> {
  const selectors = new Map<number, string>();
  postcss.parse(source).walkDecls((declaration) => {
    const parent = declaration.parent;
    if (parent?.type === "rule" && declaration.source?.start?.line) {
      selectors.set(declaration.source.start.line, parent.selector);
    }
  });
  return selectors;
}

function selectorEvidence(violation: Violation, declarationSelectors: ReadonlyMap<number, string>): string {
  if (violation.value?.includes(" => ")) return violation.value.split(" => ", 1)[0];
  if (violation.rule === "selector-role" && violation.value) {
    return violation.value.replace(/ ([a-z-]+): expected[\s\S]*$/u, "");
  }
  return declarationSelectors.get(violation.line) ?? "";
}

function violationCounts(violations: readonly Violation[]): Record<string, number> {
  return Object.fromEntries(
    Object.entries(violations.reduce<Record<string, number>>((counts, violation) => {
      counts[violation.rule] = (counts[violation.rule] ?? 0) + 1;
      return counts;
    }, {})).sort(([left], [right]) => left.localeCompare(right)),
  );
}

function runAudit(css: string, prefixes: readonly string[]): Violation[] {
  const declarationSelectors = declarationSelectorsByLine(css);
  const outputPath = path.join(os.tmpdir(), `safeclaw-demo-design-${process.pid}.json`);
  const result = spawnSync(process.execPath, [path.join(process.cwd(), "scripts", "frontend_consistency_audit.mjs")], {
    cwd: process.cwd(),
    encoding: "utf8",
    env: { ...process.env, OUTPUT_PATH: outputPath },
  });
  expect(result.status).toBe(1);

  const report = JSON.parse(fs.readFileSync(outputPath, "utf8")) as { violations: Violation[] };
  fs.rmSync(outputPath, { force: true });
  return report.violations.filter((violation) => {
    if (violation.file !== "app/globals.css" || !targetRules.has(violation.rule)) return false;
    return selectorIsOwned(selectorEvidence(violation, declarationSelectors), prefixes);
  });
}

describe("demo design contract", () => {
  const css = fs.readFileSync(path.join(process.cwd(), "app", "globals.css"), "utf8");
  const demoPage = fs.readFileSync(path.join(process.cwd(), "app", "demo", "page.tsx"), "utf8");
  const demoComponent = fs.readFileSync(path.join(process.cwd(), "components", "V2DemoExperience.tsx"), "utf8");

  it("binds the /demo route to the complete rendered selector ownership", () => {
    expect(demoPage).toContain("<V2DemoExperience");
    for (const renderedFamily of ["v2-shell", "demo-stage-panel", "scenario-strip"]) {
      expect(demoComponent, `V2DemoExperience must render .${renderedFamily}`).toContain(renderedFamily);
    }
    expect(demoComponent).not.toContain("mission-rail");
    expect(demoComponent).not.toContain("mission-step");
    expect(selectorIsOwned("body:has(.safeclaw-landing) .demo-stage-panel", renderedPrefixes)).toBe(false);
    expect(selectorIsOwned(".command-center-shell .demo-stage-panel", renderedPrefixes)).toBe(false);
    expect(selectorIsOwned(".safeclaw-module-shell .card", renderedPrefixes)).toBe(false);
  });

  it("source-binds inventory 64 to rendered 60 plus four dead mission findings", () => {
    const inventoryViolations = runAudit(css, inventoryPrefixes);
    const renderedViolations = runAudit(css, renderedPrefixes);
    expect(inventoryViolations).toHaveLength(64);
    expect(violationCounts(inventoryViolations)).toEqual(expectedRedCounts);
    expect(renderedViolations).toHaveLength(60);
    expect(violationCounts(renderedViolations)).toEqual({
      ...expectedRedCounts,
      "radius-tier": 18,
      "typography-tuple": 14,
    });
    expect(violationCounts(inventoryViolations.filter((violation) =>
      selectorEvidence(violation, declarationSelectorsByLine(css)).includes(".mission-"),
    ))).toEqual({ "radius-tier": 2, "typography-tuple": 2 });
  }, 20_000);

  it("requires complete tokenized typography, radius, gradient, and shadow contracts", () => {
    expect(violationCounts(runAudit(css, renderedPrefixes))).toEqual({});
  }, 20_000);
});
