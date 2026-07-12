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
const expectedStaticClassManifest = [
  "api-pulse-grid",
  "brand-lockup",
  "brand-mark",
  "card",
  "demo-document-list",
  "demo-evidence-map",
  "demo-generated-pack",
  "demo-hero-grid",
  "demo-input-card",
  "demo-mode-badges",
  "demo-mode-shell",
  "demo-progress-track",
  "demo-result-brief",
  "demo-screen",
  "demo-screen-top",
  "demo-section-heading",
  "demo-stage-list",
  "demo-stage-panel",
  "eyebrow",
  "foreign",
  "language-wall",
  "presenter-notes",
  "primary-triad-grid",
  "risk",
  "scenario-strip",
  "tbm",
  "triad-card",
  "v2-shell",
  "v2-nav",
] as const;

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

function splitSelectorList(selectorList: string): string[] {
  const selectors: string[] = [];
  let depth = 0;
  let start = 0;
  for (let index = 0; index < selectorList.length; index += 1) {
    if (selectorList[index] === "(") depth += 1;
    if (selectorList[index] === ")") depth -= 1;
    if (selectorList[index] === "," && depth === 0) {
      selectors.push(selectorList.slice(start, index));
      start = index + 1;
    }
  }
  selectors.push(selectorList.slice(start));
  return selectors.map(normalizeSelector).filter(Boolean);
}

function selectorIsRenderedOwned(selectorList: string): boolean {
  return splitSelectorList(selectorList).some((selector) =>
    selectorIsOwned(selector, renderedPrefixes)
    && expectedStaticClassManifest.some((root) => selector.includes(`.${root}`)),
  );
}

function declarationSelectorsByLine(source: string, stripComments = false): Map<number, string> {
  const parsedSource = stripComments ? source.replace(/\/\*[\s\S]*?\*\//gu, "") : source;
  const selectors = new Map<number, string>();
  postcss.parse(parsedSource).walkDecls((declaration) => {
    const parent = declaration.parent;
    if (parent?.type === "rule" && declaration.source?.start?.line) {
      selectors.set(declaration.source.start.line, parent.selector);
    }
  });
  return selectors;
}

function effectSelectorsByValue(source: string): Map<string, string> {
  const selectors = new Map<string, string>();
  postcss.parse(source).walkDecls((declaration) => {
    const parent = declaration.parent;
    if (parent?.type === "rule" && ["background", "background-image", "text-shadow"].includes(declaration.prop)) {
      selectors.set(normalizeSelector(declaration.value), parent.selector);
    }
  });
  return selectors;
}

function selectorEvidence(
  violation: Violation,
  rawDeclarationSelectors: ReadonlyMap<number, string>,
  effectSelectors: ReadonlyMap<string, string>,
): string {
  if (violation.value?.includes(" => ")) return violation.value.split(" => ", 1)[0];
  if (violation.rule === "selector-role" && violation.value) {
    return violation.value.replace(/ ([a-z-]+): expected[\s\S]*$/u, "");
  }
  if (violation.rule === "decorative-gradient" || violation.rule === "decorative-text-shadow") {
    return effectSelectors.get(normalizeSelector(violation.value ?? "")) ?? "";
  }
  return rawDeclarationSelectors.get(violation.line) ?? "";
}

function violationCounts(violations: readonly Violation[]): Record<string, number> {
  return Object.fromEntries(
    Object.entries(violations.reduce<Record<string, number>>((counts, violation) => {
      counts[violation.rule] = (counts[violation.rule] ?? 0) + 1;
      return counts;
    }, {})).sort(([left], [right]) => left.localeCompare(right)),
  );
}

function auditViolations(css: string): Violation[] {
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
  return report.violations.filter((violation) =>
    violation.file === "app/globals.css" && targetRules.has(violation.rule),
  );
}

function inventoryViolations(css: string, violations: readonly Violation[]): Violation[] {
  const rawSelectors = declarationSelectorsByLine(css);
  const effectSelectors = effectSelectorsByValue(css);
  return violations.filter((violation) =>
    selectorIsOwned(selectorEvidence(violation, rawSelectors, effectSelectors), inventoryPrefixes),
  );
}

function renderedViolations(css: string, violations: readonly Violation[]): Violation[] {
  const rawSelectors = declarationSelectorsByLine(css);
  const effectSelectors = effectSelectorsByValue(css);
  return violations.filter((violation) =>
    selectorIsRenderedOwned(selectorEvidence(violation, rawSelectors, effectSelectors)),
  );
}

function staticClassManifest(source: string): string[] {
  const classValues = [
    ...Array.from(source.matchAll(/className="([^"]+)"/gu), (match) => match[1]),
    ...Array.from(source.matchAll(/className=\{`([^`]+)`\}/gu), (match) => match[1].split("${", 1)[0]),
  ];
  return [...new Set(classValues.flatMap((value) => value.trim().split(/\s+/u)).filter(Boolean))].sort();
}

describe("demo design contract", () => {
  const css = fs.readFileSync(path.join(process.cwd(), "app", "globals.css"), "utf8");
  const demoPage = fs.readFileSync(path.join(process.cwd(), "app", "demo", "page.tsx"), "utf8");
  const demoComponent = fs.readFileSync(path.join(process.cwd(), "components", "V2DemoExperience.tsx"), "utf8");

  it("binds the /demo route to the complete rendered selector ownership", () => {
    expect(demoPage).toContain("<V2DemoExperience");
    expect(staticClassManifest(demoComponent)).toEqual([...expectedStaticClassManifest].sort());
    expect(demoComponent).not.toContain("mission-rail");
    expect(demoComponent).not.toContain("mission-step");
    expect(selectorIsOwned("body:has(.safeclaw-landing) .demo-stage-panel", renderedPrefixes)).toBe(false);
    expect(selectorIsOwned(".command-center-shell .demo-stage-panel", renderedPrefixes)).toBe(false);
    expect(selectorIsOwned(".safeclaw-module-shell .card", renderedPrefixes)).toBe(false);
  });

  it("source-binds inventory 64 to rendered 47 plus 17 non-rendered or shared findings", () => {
    const violations = auditViolations(css);
    const inventory = inventoryViolations(css, violations);
    const rendered = renderedViolations(css, violations);
    expect(inventory).toHaveLength(64);
    expect(violationCounts(inventory)).toEqual(expectedRedCounts);
    expect(rendered).toHaveLength(47);
    expect(violationCounts(rendered)).toEqual({
      "decorative-box-shadow": 3,
      "decorative-gradient": 1,
      "font-size-tier": 4,
      "line-height-tier": 9,
      "radius-tier": 15,
      "tracking-tier": 4,
      "typography-tuple": 11,
    });
    expect(inventory).toHaveLength(rendered.length + 17);
  }, 20_000);

  it("requires complete tokenized typography, radius, gradient, and shadow contracts", () => {
    const violations = auditViolations(css);
    expect(violationCounts(renderedViolations(css, violations))).toEqual({});
  }, 20_000);
});
