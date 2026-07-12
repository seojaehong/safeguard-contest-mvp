import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

import postcss from "postcss";
import type { Rule } from "postcss";
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
      selectors.set(declaration.source.start.line, (parent as Rule).selector);
    }
  });
  return selectors;
}

function effectRuleSelectorsByAuditLine(source: string): Map<number, string> {
  const uncommented = source.replace(/\/\*[\s\S]*?\*\//gu, "");
  const ruleStarts: Array<{ line: number; selector: string }> = [];
  postcss.parse(uncommented).walkRules((rule) => {
    if (rule.source?.start?.line) ruleStarts.push({ line: rule.source.start.line, selector: rule.selector });
  });
  const selectors = new Map<number, string>();
  for (const violationLine of Array.from({ length: uncommented.split(/\r?\n/u).length }, (_, index) => index + 1)) {
    const nearest = ruleStarts
      .filter((rule) => rule.line >= violationLine && rule.line - violationLine <= 3)
      .sort((left, right) => left.line - right.line)[0];
    if (nearest) selectors.set(violationLine, nearest.selector);
  }
  return selectors;
}

function selectorEvidence(
  violation: Violation,
  rawDeclarationSelectors: ReadonlyMap<number, string>,
  effectSelectors: ReadonlyMap<number, string>,
): string {
  if (violation.value?.includes(" => ")) return violation.value.split(" => ", 1)[0];
  if (violation.rule === "selector-role" && violation.value) {
    return violation.value.replace(/ ([a-z-]+): expected[\s\S]*$/u, "");
  }
  if (violation.rule === "decorative-gradient" || violation.rule === "decorative-text-shadow") {
    return effectSelectors.get(violation.line) ?? "";
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
  const effectSelectors = effectRuleSelectorsByAuditLine(css);
  return violations.filter((violation) =>
    selectorIsOwned(selectorEvidence(violation, rawSelectors, effectSelectors), inventoryPrefixes),
  );
}

function renderedViolations(css: string, violations: readonly Violation[]): Violation[] {
  const rawSelectors = declarationSelectorsByLine(css);
  const effectSelectors = effectRuleSelectorsByAuditLine(css);
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

function declarationValue(source: string, selector: string, property: string): string | undefined {
  let value: string | undefined;
  postcss.parse(source).walkRules((rule) => {
    if (!splitSelectorList(rule.selector).includes(selector)) return;
    rule.walkDecls(property, (declaration) => { value = declaration.value; });
  });
  return value;
}

function expectTuple(
  source: string,
  selector: string,
  tuple: readonly [string, string, string, string, string?],
): void {
  const [size, weight, leading, tracking, family] = tuple;
  expect(declarationValue(source, selector, "font-size"), selector).toBe(size);
  expect(declarationValue(source, selector, "font-weight"), selector).toBe(weight);
  expect(declarationValue(source, selector, "line-height"), selector).toBe(leading);
  expect(declarationValue(source, selector, "letter-spacing"), selector).toBe(tracking);
  if (family) expect(declarationValue(source, selector, "font-family"), selector).toBe(family);
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
    expect(`${demoPage}\n${demoComponent}`).not.toMatch(/(?:colorScheme|workspace-theme|data-theme|theme=)/u);
    expect(selectorIsOwned("body:has(.safeclaw-landing) .demo-stage-panel", renderedPrefixes)).toBe(false);
    expect(selectorIsOwned(".command-center-shell .demo-stage-panel", renderedPrefixes)).toBe(false);
    expect(selectorIsOwned(".safeclaw-module-shell .card", renderedPrefixes)).toBe(false);
  });

  it("leaves only the 17 non-rendered or explicitly split shared inventory findings", () => {
    const violations = auditViolations(css);
    const inventory = inventoryViolations(css, violations);
    const rendered = renderedViolations(css, violations);
    expect(Object.values(expectedRedCounts).reduce((total, count) => total + count, 0)).toBe(64);
    expect(inventory).toHaveLength(17);
    expect(violationCounts(inventory)).toEqual({
      "decorative-gradient": 1,
      "font-size-tier": 3,
      "line-height-tier": 1,
      "radius-tier": 5,
      "tracking-tier": 2,
      "typography-tuple": 5,
    });
    expect(rendered).toEqual([]);
  }, 20_000);

  it("splits the shared progress selector without changing inline-progress", () => {
    expect(declarationValue(css, ".inline-progress", "border-radius")).toBe("999px");
    expect(declarationValue(css, ".demo-progress-track", "border-radius")).toBe("var(--radius-control)");
    expect(css).not.toMatch(/\.demo-progress-track\s*,\s*\.inline-progress\s*\{[^}]*border-radius/gu);
  });

  it("scopes every rendered shared role and surface to the demo contract", () => {
    const tuples = [
      [".demo-mode-shell .brand-lockup strong", ["var(--text-component-title)", "700", "var(--leading-component-title)", "var(--tracking-component-title)"]],
      [".demo-mode-shell .brand-lockup small", ["var(--text-caption)", "600", "var(--leading-caption)", "var(--tracking-body)"]],
      [".demo-mode-shell .eyebrow", ["var(--text-hud)", "700", "var(--leading-hud)", "var(--tracking-hud)", "var(--font-hud)"]],
      [".demo-mode-shell .api-pulse-grid strong", ["var(--text-component-title)", "700", "var(--leading-component-title)", "var(--tracking-component-title)"]],
      [".demo-mode-shell .api-pulse-grid span", ["var(--text-caption)", "600", "var(--leading-caption)", "var(--tracking-body)"]],
      [".demo-mode-shell .triad-card span", ["var(--text-caption)", "600", "var(--leading-caption)", "var(--tracking-body)"]],
      [".demo-mode-shell .triad-card strong", ["var(--text-section-title)", "800", "var(--leading-section-title)", "var(--tracking-section-title)"]],
      [".demo-mode-shell .triad-card p", ["var(--text-body)", "500", "var(--leading-body)", "var(--tracking-body)"]],
      [".demo-mode-shell .language-wall span", ["var(--text-caption)", "600", "var(--leading-caption)", "var(--tracking-body)"]],
      [".demo-mode-shell .language-wall p", ["var(--text-body)", "500", "var(--leading-body)", "var(--tracking-body)"]],
      [".demo-mode-shell .presenter-notes strong", ["var(--text-component-title)", "700", "var(--leading-component-title)", "var(--tracking-component-title)"]],
      [".demo-mode-shell .presenter-notes p", ["var(--text-body)", "500", "var(--leading-body)", "var(--tracking-body)"]],
    ] as const;
    for (const [selector, tuple] of tuples) expectTuple(css, selector, tuple);

    for (const selector of [
      ".demo-mode-shell .api-pulse-grid > div",
      ".demo-mode-shell .triad-card",
      ".demo-mode-shell .language-wall > div",
      ".demo-mode-shell.demo-mode-shell .demo-screen.card",
      ".demo-mode-shell .presenter-notes.card",
    ]) {
      expect(declarationValue(css, selector, "border-radius"), selector).toBe("var(--radius-panel)");
    }
  });

  it("gives live and offline mode explicit semantic visual states", () => {
    expect(demoComponent).toContain("className={mode}");
    expect(declarationValue(css, ".demo-screen-top b.live", "color")).toBe("var(--sc-ok)");
    expect(declarationValue(css, ".demo-screen-top b.live", "border")).toBe("1px solid var(--sc-ok)");
    expect(declarationValue(css, ".demo-screen-top b.offline", "color")).toBe("var(--sc-black)");
    expect(declarationValue(css, ".demo-screen-top b.offline", "border")).toBe("1px solid var(--sc-warning)");
  });

  it("requires complete tokenized typography, radius, gradient, and shadow contracts", () => {
    const violations = auditViolations(css);
    expect(violationCounts(renderedViolations(css, violations))).toEqual({});
  }, 20_000);
});
