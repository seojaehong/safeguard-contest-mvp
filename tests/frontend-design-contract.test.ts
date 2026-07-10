import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

import { describe, expect, it } from "vitest";

import {
  frontendShape,
  frontendSpacing,
  frontendTypography,
  generatedSurfaceFiles,
  specialSurfaceFiles,
  userVisibleRoutes,
} from "@/lib/frontend-design-contract";

const root = process.cwd();

type CssDeclarations = Record<string, string>;

type CssRule = { selectors: string[]; declarations: CssDeclarations };

function normalizeSelector(selector: string): string {
  return selector
    .replace(/\s+/g, " ")
    .replace(/\(\s+/g, "(")
    .replace(/\s+\)/g, ")")
    .replace(/,\s*/g, ", ")
    .trim();
}

function splitSelectorList(selectorList: string): string[] {
  const selectors: string[] = [];
  let depth = 0;
  let start = 0;
  for (let index = 0; index < selectorList.length; index += 1) {
    if (selectorList[index] === "(") depth += 1;
    if (selectorList[index] === ")") depth -= 1;
    if (selectorList[index] === "," && depth === 0) {
      selectors.push(normalizeSelector(selectorList.slice(start, index)));
      start = index + 1;
    }
  }
  selectors.push(normalizeSelector(selectorList.slice(start)));
  return selectors.filter(Boolean);
}

function ruleBlocks(source: string): CssRule[] {
  const uncommented = source.replace(/\/\*[\s\S]*?\*\//g, "");
  return [...uncommented.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map((match) => {
    const declarations = Object.fromEntries(
      [...match[2].matchAll(/([\w-]+)\s*:\s*([^;]+);/g)].map((declaration) => [
        declaration[1].trim(),
        declaration[2].trim(),
      ]),
    );
    return {
      selectors: splitSelectorList(match[1]),
      declarations,
    };
  });
}

const typographyRoles = {
  display: { size: "var(--text-display)", weight: "800", lineHeight: "var(--leading-display)", tracking: "var(--tracking-display)" },
  pageTitle: { size: "var(--text-page-title)", weight: "800", lineHeight: "var(--leading-page-title)", tracking: "var(--tracking-page-title)" },
  sectionTitle: { size: "var(--text-section-title)", weight: "800", lineHeight: "var(--leading-section-title)", tracking: "var(--tracking-section-title)" },
  componentTitle: { size: "var(--text-component-title)", weight: "700", lineHeight: "var(--leading-component-title)", tracking: "var(--tracking-component-title)" },
  bodyLarge: { size: "var(--text-body-lg)", weight: "500", lineHeight: "var(--leading-body-lg)", tracking: "var(--tracking-body)" },
  body: { size: "var(--text-body)", weight: "500", lineHeight: "var(--leading-body)", tracking: "var(--tracking-body)" },
  longform: { size: "var(--text-body)", weight: "500", lineHeight: "var(--leading-longform)", tracking: "var(--tracking-body)" },
  support: { size: "var(--text-support)", weight: "500", lineHeight: "var(--leading-body)", tracking: "var(--tracking-body)" },
  control: { size: "var(--text-control)", weight: "700", lineHeight: "var(--leading-control)", tracking: "var(--tracking-body)" },
  table: { size: "var(--text-table)", weight: "500", lineHeight: "var(--leading-table)", tracking: "var(--tracking-body)" },
  caption: { size: "var(--text-caption)", weight: "600", lineHeight: "var(--leading-caption)", tracking: "var(--tracking-body)" },
  tableHeader: { size: "var(--text-caption)", weight: "700", lineHeight: "var(--leading-caption)", tracking: "var(--tracking-body)" },
  hud: { size: "var(--text-hud)", weight: "700", lineHeight: "var(--leading-hud)", tracking: "var(--tracking-hud)", fontFamily: "var(--font-hud)" },
} as const;

type TypographyRole = keyof typeof typographyRoles;

function selectorText(rule: CssRule): string {
  return rule.selectors.join(", ");
}

function isInteractiveSelector(selector: string): boolean {
  return /(^|[\s.:#>+~])(a|button|input|select|textarea)(?=$|[\s.:#>+~[])|\b(action|button|control|tab|chip|nav|link|toggle|filter)\b/i.test(selector);
}

function isTableHeaderSelector(selector: string): boolean {
  return /(^|[\s>+~])th(?=$|[\s.:#>+~[])|table[^,{]*(head|header)|report-table[^,{]*strong/i.test(selector);
}

const semanticRoleOverrides: Readonly<Record<string, TypographyRole>> = {
  ".law-section-lines p": "longform",
  ".legal-reading-body": "longform",
  ".command-center-shell .command-primary": "control",
  ".safeclaw-os-cta button": "control",
  ".safeclaw-os-cta a": "control",
  ".safeclaw-module-primary": "control",
  ".safeclaw-module-actions a": "control",
  ".safeclaw-module-shell.module-variant-document .safeclaw-module-primary": "control",
  ".safeclaw-module-shell.module-variant-document .safeclaw-module-actions a": "control",
  ".command-center-shell .brand-lockup small": "caption",
  ".command-center-shell .topbar-status span": "hud",
  ".command-center-shell .step-copy small": "hud",
};

function isHudSelector(rule: CssRule, selector: string): boolean {
  return rule.declarations["font-family"] === "var(--font-hud)"
    || rule.declarations["letter-spacing"] === "var(--tracking-hud)"
    || /\b(hud|status|eyebrow|kicker|badge|meta|metric|code|console|source|live|signal)\b/i.test(selector);
}

function expectedTypographyRole(rule: CssRule, selector: string): TypographyRole | undefined {
  const override = semanticRoleOverrides[selector];
  if (override) return override;
  const size = rule.declarations["font-size"];
  if (isTableHeaderSelector(selector) && !isInteractiveSelector(selector)) return "tableHeader";
  if (["var(--text-display)", "var(--t-display)", "clamp(44px, 6vw, 72px)"].includes(size)) return "display";
  if (["var(--text-page-title)", "var(--t-hero)", "clamp(32px, 4vw, 40px)"].includes(size)) return "pageTitle";
  if (["var(--text-section-title)", "var(--t-title)", "clamp(24px, 3vw, 28px)"].includes(size)) return "sectionTitle";
  if (["var(--text-component-title)", "var(--t-h)", "20px"].includes(size)) return "componentTitle";
  if (["var(--text-body-lg)", "var(--t-body-lg)", "17px"].includes(size)) return "bodyLarge";
  if (["var(--text-body)", "var(--t-body)", "15px"].includes(size)) return "body";
  if (["var(--text-control)", "var(--text-support)", "14px"].includes(size)) {
    return isInteractiveSelector(selector) ? "control" : "support";
  }
  if (["var(--text-table)", "13px"].includes(size)) return "table";
  if (["var(--text-caption)", "var(--t-caption)", "12px"].includes(size)) return "caption";
  if (["var(--text-hud)", "var(--t-micro)"].includes(size) || size === "11px" && isHudSelector(rule, selector)) return "hud";
  if (size === "11px") return "caption";
  return undefined;
}

function effectiveDeclarations(source: string, selector: string): CssDeclarations {
  return Object.assign(
    {},
    ...ruleBlocks(source)
      .filter((rule) => rule.selectors.includes(selector))
      .map((rule) => rule.declarations),
  );
}

function blockBody(source: string, blockStart: string): string {
  const start = source.indexOf(blockStart);
  expect(start, `${blockStart} block`).toBeGreaterThanOrEqual(0);
  const openingBrace = source.indexOf("{", start);
  let depth = 0;
  for (let index = openingBrace; index < source.length; index += 1) {
    if (source[index] === "{") depth += 1;
    if (source[index] === "}") depth -= 1;
    if (depth === 0) return source.slice(openingBrace + 1, index);
  }
  throw new Error(`Unclosed CSS block: ${blockStart}`);
}

function runAudit(css: string): { status: number | null; report: { violations: Array<{ rule: string; value?: string }> } } {
  const tempDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "frontend-consistency-audit-"));
  const cssPath = path.join(tempDirectory, "fixture.css");
  const outputPath = path.join(tempDirectory, "report.json");
  fs.writeFileSync(cssPath, css, "utf8");
  const result = spawnSync(process.execPath, [path.join(root, "scripts", "frontend_consistency_audit.mjs")], {
    cwd: root,
    encoding: "utf8",
    env: { ...process.env, CSS_PATH: cssPath, OUTPUT_PATH: outputPath },
  });
  const report = JSON.parse(fs.readFileSync(outputPath, "utf8")) as {
    violations: Array<{ rule: string; value?: string }>;
  };
  fs.rmSync(tempDirectory, { recursive: true, force: true });
  return { status: result.status, report };
}

describe("frontend design contract", () => {
  it("defines the four deliberate typography roles", () => {
    expect(Object.keys(frontendTypography.fonts)).toEqual([
      "product",
      "hud",
      "multilingual",
      "document",
    ]);
    expect(frontendTypography.screen.body).toEqual({
      size: "15px",
      weight: 500,
      lineHeight: "1.60",
      tracking: "0",
    });
    expect(frontendTypography.screen.hud).toEqual({
      size: "11px",
      weight: 700,
      lineHeight: "16px",
      tracking: "0.08em",
    });
  });

  it("uses the fixed 4px spacing rhythm and contextual radius rules", () => {
    expect(Object.values(frontendSpacing).every((value) => Number.parseInt(value, 10) % 4 === 0)).toBe(true);
    expect(frontendShape).toMatchObject({
      structuralRadius: "0",
      microRadius: "2px",
      controlRadius: "4px",
      panelRadius: "4px",
      circleRadius: "50%",
      controlHeight: "44px",
      compactControlHeight: "36px",
      iconHitArea: "44px",
    });
    expect(Object.values(frontendShape)).not.toContain("999px");
  });

  it("preserves true-circle geometry on every named circular role", () => {
    const css = fs.readFileSync(path.join(root, "app", "globals.css"), "utf8");
    for (const selector of [
      ".safeclaw-prototype-topbar i",
      ".recent-list button i",
      ".status-orb",
      ".button-spinner",
    ]) {
      expect(effectiveDeclarations(css, selector), selector).toMatchObject({
        "border-radius": "var(--radius-circle)",
      });
    }
  });

  it("inventories every browser and generated-document surface", () => {
    expect(userVisibleRoutes).toHaveLength(32);
    expect(new Set(userVisibleRoutes).size).toBe(userVisibleRoutes.length);
    for (const relativePath of [...specialSurfaceFiles, ...generatedSurfaceFiles]) {
      expect(fs.existsSync(path.join(root, relativePath)), relativePath).toBe(true);
    }
  });

  it("declares every semantic CSS token", () => {
    const css = fs.readFileSync(path.join(root, "app", "globals.css"), "utf8");
    for (const token of frontendTypography.cssTokens) {
      expect(css, token).toContain(`${token}:`);
    }
    for (const token of Object.keys(frontendSpacing)) {
      expect(css, token).toContain(`--space-${token}:`);
    }
    expect(css).not.toContain("--tracking-table-header");
    expect(css).not.toContain("0.04em");
  });

  it("applies the canonical product type and interaction foundation", () => {
    const css = fs.readFileSync(path.join(root, "app", "globals.css"), "utf8");
    expect(effectiveDeclarations(css, "body")).toMatchObject({
      "font-family": "var(--font-product)",
      "font-size": "var(--text-body)",
      "line-height": "var(--leading-body)",
      "letter-spacing": "var(--tracking-body)",
    });
    expect(effectiveDeclarations(css, "button")).toMatchObject({ font: "inherit" });
    expect(effectiveDeclarations(css, "input")).toMatchObject({ font: "inherit" });
    expect(effectiveDeclarations(css, "select")).toMatchObject({ font: "inherit" });
    expect(effectiveDeclarations(css, "textarea")).toMatchObject({ font: "inherit" });
    expect(effectiveDeclarations(css, "h1")).toMatchObject({
      "font-family": "var(--font-product)",
      "line-height": "var(--leading-page-title)",
      "letter-spacing": "var(--tracking-page-title)",
    });
    expect(effectiveDeclarations(css, "h2")).toMatchObject({
      "font-family": "var(--font-product)",
      "line-height": "var(--leading-section-title)",
      "letter-spacing": "var(--tracking-section-title)",
    });
    expect(effectiveDeclarations(css, "h3")).toMatchObject({
      "font-family": "var(--font-product)",
      "line-height": "var(--leading-component-title)",
      "letter-spacing": "var(--tracking-component-title)",
    });
    expect(css).toContain("font-synthesis: none;");
    expect(css).toContain("text-rendering: optimizeLegibility;");
    expect(css).toContain(":focus-visible");
  });

  it("keeps canonical controls and active states effective without important declarations", () => {
    const css = fs.readFileSync(path.join(root, "app", "globals.css"), "utf8");
    expect(css).not.toContain("!important");
    expect(effectiveDeclarations(css, ".button")).toMatchObject({
      border: "1px solid var(--sc-black)",
      background: "var(--sc-hazard-yellow)",
      "box-shadow": "none",
      transform: "none",
    });
    expect(effectiveDeclarations(css, ".button:hover")).toMatchObject({
      "box-shadow": "none",
      transform: "none",
    });
    expect(effectiveDeclarations(css, ".command-topbar")).toMatchObject({ "box-shadow": "none" });
    expect(effectiveDeclarations(css, ".scenario-chip.active")).toMatchObject({
      "border-color": "var(--sc-black)",
      background: "var(--sc-steel-060)",
      "box-shadow": "inset 4px 0 0 var(--sc-hazard-yellow)",
    });
    expect(effectiveDeclarations(css, ".document-editor.editor-focus-cue")).toMatchObject({
      "border-color": "var(--sc-black)",
      "box-shadow": "inset 4px 0 0 var(--sc-hazard-yellow)",
      transform: "none",
    });
  });

  it("maps scoped module and document selectors to complete semantic type roles", () => {
    const css = fs.readFileSync(path.join(root, "app", "globals.css"), "utf8");
    const roles: Record<string, CssDeclarations> = {
      ".safeclaw-module-hero.document h1": {
        "font-size": "var(--text-page-title)",
        "line-height": "var(--leading-page-title)",
        "letter-spacing": "var(--tracking-page-title)",
      },
      ".safeclaw-workdoc-header h2": {
        "font-size": "var(--text-page-title)",
        "line-height": "var(--leading-page-title)",
        "letter-spacing": "var(--tracking-page-title)",
      },
      ".safeclaw-workdoc-section-head h3": {
        "font-size": "var(--text-section-title)",
        "line-height": "var(--leading-section-title)",
        "letter-spacing": "var(--tracking-section-title)",
      },
      ".safeclaw-module-shell.module-variant-document .safeclaw-module-hero h1": {
        "font-size": "var(--text-page-title)",
        "line-height": "var(--leading-page-title)",
        "letter-spacing": "var(--tracking-page-title)",
      },
      ".safeclaw-module-shell.module-variant-document .safeclaw-workdoc-header h2": {
        "font-size": "var(--text-page-title)",
        "line-height": "var(--leading-page-title)",
        "letter-spacing": "var(--tracking-page-title)",
      },
      ".safeclaw-module-shell.module-variant-document .safeclaw-workdoc-section-head h3": {
        "font-size": "var(--text-section-title)",
        "line-height": "var(--leading-section-title)",
        "letter-spacing": "var(--tracking-section-title)",
      },
      ".safeclaw-module-shell.module-variant-document .safeclaw-workdoc-header p": {
        "font-size": "var(--text-body-lg)",
        "line-height": "var(--leading-body-lg)",
        "letter-spacing": "var(--tracking-body)",
      },
      ".safeclaw-module-shell.module-variant-document .safeclaw-workdoc-list p": {
        "font-size": "var(--text-body)",
        "line-height": "var(--leading-body)",
        "letter-spacing": "var(--tracking-body)",
      },
      ".safeclaw-module-shell.module-variant-document .safeclaw-report-notes p": {
        "font-size": "var(--text-body)",
        "line-height": "var(--leading-body)",
        "letter-spacing": "var(--tracking-body)",
      },
      ".safeclaw-module-shell h2": {
        "font-size": "var(--text-section-title)",
        "line-height": "var(--leading-section-title)",
        "letter-spacing": "var(--tracking-section-title)",
      },
      ".safeclaw-module-shell h3": {
        "font-size": "var(--text-component-title)",
        "line-height": "var(--leading-component-title)",
        "letter-spacing": "var(--tracking-component-title)",
      },
      ".safeclaw-module-shell strong": {
        "font-size": "var(--text-body)",
        "line-height": "var(--leading-body)",
        "letter-spacing": "var(--tracking-body)",
      },
      ".safeclaw-module-shell .safeclaw-report-facts span": {
        "font-size": "var(--text-body)",
        "line-height": "var(--leading-body)",
        "letter-spacing": "var(--tracking-body)",
      },
      ".safeclaw-module-shell .safeclaw-report-notes p": {
        "font-size": "var(--text-body)",
        "line-height": "var(--leading-body)",
        "letter-spacing": "var(--tracking-body)",
      },
      ".safeclaw-module-shell .safeclaw-report-table span": {
        "font-size": "var(--text-table)",
        "line-height": "var(--leading-table)",
        "letter-spacing": "var(--tracking-body)",
      },
      ".safeclaw-module-shell .safeclaw-report-group em": {
        "font-size": "var(--text-body)",
        "line-height": "var(--leading-body)",
        "letter-spacing": "var(--tracking-body)",
      },
    };
    for (const [selector, expected] of Object.entries(roles)) {
      expect(effectiveDeclarations(css, selector), selector).toMatchObject(expected);
    }
  });

  it("assigns control, native table, and mixed HUD selectors to their actual roles", () => {
    const css = fs.readFileSync(path.join(root, "app", "globals.css"), "utf8");
    expect(effectiveDeclarations(css, ".command-center-shell .command-primary")).toMatchObject({
      "font-size": "var(--text-control)",
      "font-weight": "700",
      "line-height": "var(--leading-control)",
      "letter-spacing": "var(--tracking-body)",
    });
    expect(effectiveDeclarations(css, ".safety-form-preview th")).toMatchObject({
      "font-size": "var(--text-caption)",
      "font-weight": "700",
      "line-height": "var(--leading-caption)",
      "letter-spacing": "var(--tracking-body)",
    });
    expect(effectiveDeclarations(css, ".safety-form-preview td")).toMatchObject({
      "font-size": "var(--text-caption)",
      "font-weight": "600",
      "line-height": "var(--leading-caption)",
      "letter-spacing": "var(--tracking-body)",
    });
    expect(effectiveDeclarations(css, ".command-center-shell .brand-lockup small")).toMatchObject({
      "font-family": "var(--font-product)",
      "font-size": "var(--text-caption)",
      "font-weight": "600",
      "line-height": "var(--leading-caption)",
      "letter-spacing": "var(--tracking-body)",
    });
    for (const selector of [
      ".command-center-shell .topbar-status span",
      ".command-center-shell .step-copy small",
    ]) {
      expect(effectiveDeclarations(css, selector), selector).toMatchObject({
        "font-family": "var(--font-hud)",
        "font-size": "var(--text-hud)",
        "font-weight": "700",
        "line-height": "var(--leading-hud)",
        "letter-spacing": "var(--tracking-hud)",
      });
    }
  });

  it("keeps base and document module actions on the control tuple", () => {
    const css = fs.readFileSync(path.join(root, "app", "globals.css"), "utf8");
    for (const selector of [
      ".safeclaw-module-primary",
      ".safeclaw-module-actions a",
      ".safeclaw-module-shell.module-variant-document .safeclaw-module-primary",
      ".safeclaw-module-shell.module-variant-document .safeclaw-module-actions a",
    ]) {
      expect(effectiveDeclarations(css, selector), selector).toMatchObject({
        "font-size": "var(--text-control)",
        "font-weight": "700",
        "line-height": "var(--leading-control)",
        "letter-spacing": "var(--tracking-body)",
      });
    }
  });

  it("assigns a complete canonical typography tuple to every font-size rule", () => {
    const css = fs.readFileSync(path.join(root, "app", "globals.css"), "utf8");
    expect(css).not.toMatch(/font-size:\s*(?:11px|12px|13px|14px|15px|17px|20px|var\(--t-|clamp\()/);
    const sizedRules = ruleBlocks(css).filter((rule) => rule.declarations["font-size"]);
    expect(sizedRules.length).toBeGreaterThan(0);
    for (const rule of sizedRules) {
      const roleNames = rule.selectors.map((selector) => expectedTypographyRole(rule, selector));
      expect(roleNames, `${selectorText(rule)} => ${rule.declarations["font-size"]}`).not.toContain(undefined);
      expect(new Set(roleNames).size, `${selectorText(rule)} => mixed roles ${roleNames.join(", ")}`).toBe(1);
      const roleName = roleNames[0] as TypographyRole;
      const role = typographyRoles[roleName as TypographyRole];
      expect(rule.declarations, `${selectorText(rule)} => ${roleName}`).toMatchObject({
        "font-size": role.size,
        "font-weight": role.weight,
        "line-height": role.lineHeight,
        "letter-spacing": role.tracking,
        ...(roleName === "hud" ? { "font-family": typographyRoles.hud.fontFamily } : {}),
      });
    }
  });

  it("disables every infinite animation and smooth scrolling for reduced motion", () => {
    const css = fs.readFileSync(path.join(root, "app", "globals.css"), "utf8");
    const reducedMotion = blockBody(css, "@media (prefers-reduced-motion: reduce)");
    expect(effectiveDeclarations(reducedMotion, "html")).toMatchObject({ "scroll-behavior": "auto" });
    for (const selector of [
      ".api-pulse-grid .live i",
      ".api-proof-card i",
      ".status-orb.generating",
      ".button-spinner",
      ".loading-spinner",
      ".inline-progress.animated span",
      ".agent-console-live",
      ".sc-blink",
    ]) {
      expect(effectiveDeclarations(reducedMotion, selector), selector).toMatchObject({ animation: "none" });
    }
  });

  it("rejects decorative effects and semantic role mismatches in selector-aware audit fixtures", () => {
    const audit = runAudit(`
      body { font-size: var(--text-display); line-height: var(--leading-display); letter-spacing: var(--tracking-display); }
      .button { box-shadow: 0 14px 24px rgba(0, 0, 0, 0.12); }
      .brand-mark { background: linear-gradient(90deg, #000, #fff); text-shadow: 0 1px #000; }
    `);
    expect(audit.status).not.toBe(0);
    expect(audit.report.violations.map((violation) => violation.rule)).toEqual(
      expect.arrayContaining(["selector-role", "decorative-box-shadow", "decorative-gradient", "decorative-text-shadow"]),
    );
  });

  it("rejects malformed values on exact functional-effect selectors", () => {
    const audit = runAudit(`
      .quick-chip.active { box-shadow: inset 99px 99px 99px hotpink; }
      .hazard-stripe { background-image: radial-gradient(red, blue); }
    `);
    expect(audit.status).not.toBe(0);
    expect(audit.report.violations.map((violation) => violation.rule)).toEqual(
      expect.arrayContaining(["decorative-box-shadow", "decorative-gradient"]),
    );
  });

  it("rejects incomplete or mismatched typography tuples in audit fixtures", () => {
    const audit = runAudit(`
      .bad-title {
        font-size: var(--text-page-title);
        font-weight: 500;
        line-height: var(--leading-display);
        letter-spacing: var(--tracking-body);
      }
      .bad-control { font-size: 14px; font-weight: 500; }
      .bad-micro { font-size: 11px; font-weight: 700; line-height: 16px; letter-spacing: 0.08em; }
      .toolbar-button { font-size: var(--text-support); font-weight: 500; line-height: var(--leading-body); letter-spacing: var(--tracking-body); }
      .report-table strong { font-size: var(--text-hud); font-family: var(--font-hud); font-weight: 700; line-height: var(--leading-hud); letter-spacing: var(--tracking-hud); }
    `);
    expect(audit.report.violations.map((violation) => violation.rule)).toContain("typography-tuple");
  });

  it("classifies interactive 14px and table-header rules by semantics before their current token", () => {
    const audit = runAudit(`
      .toolbar-button { font-size: var(--text-support); font-weight: 500; line-height: var(--leading-body); letter-spacing: var(--tracking-body); }
      .report-table strong { font-size: var(--text-hud); font-family: var(--font-hud); font-weight: 700; line-height: var(--leading-hud); letter-spacing: var(--tracking-hud); }
    `);
    const tupleValues = audit.report.violations
      .filter((violation) => violation.rule === "typography-tuple")
      .map((violation) => violation.value || "");
    expect(tupleValues.some((value) => value.includes(".toolbar-button"))).toBe(true);
    expect(tupleValues.some((value) => value.includes(".report-table strong"))).toBe(true);
  });

  it("rejects ambiguous class controls and mixed selector-list roles", () => {
    const audit = runAudit(`
      .command-center-shell .command-primary { font-size: var(--text-support); font-weight: 500; line-height: var(--leading-body); letter-spacing: var(--tracking-body); }
      .safety-form-preview th, .safety-form-preview td { font-size: var(--text-caption); font-weight: 600; line-height: var(--leading-caption); letter-spacing: var(--tracking-body); }
      .command-center-shell .brand-lockup small, .command-center-shell .topbar-status span { font-family: var(--font-hud); font-size: var(--text-hud); font-weight: 700; line-height: var(--leading-hud); letter-spacing: var(--tracking-hud); }
    `);
    const tupleViolations = audit.report.violations.filter((violation) =>
      violation.rule === "typography-tuple" || violation.rule === "mixed-typography-role");
    expect(tupleViolations.some((violation) => violation.value?.includes("command-primary"))).toBe(true);
    expect(tupleViolations.some((violation) => violation.value?.includes("safety-form-preview th"))).toBe(true);
    expect(tupleViolations.some((violation) => violation.value?.includes("brand-lockup small"))).toBe(true);
  });

  it("rejects table-sized base module actions before token-size classification", () => {
    const audit = runAudit(`
      .safeclaw-module-primary, .safeclaw-module-actions a {
        font-size: var(--text-table);
        font-weight: 500;
        line-height: var(--leading-table);
        letter-spacing: var(--tracking-body);
      }
      .safeclaw-module-shell.module-variant-document .safeclaw-module-primary,
      .safeclaw-module-shell.module-variant-document .safeclaw-module-actions a {
        font-size: var(--text-control);
        font-weight: 700;
        line-height: var(--leading-control);
        letter-spacing: var(--tracking-body);
      }
    `);
    const tupleValues = audit.report.violations
      .filter((violation) => violation.rule === "typography-tuple")
      .map((violation) => violation.value || "");
    expect(tupleValues.some((value) => value.includes(".safeclaw-module-primary"))).toBe(true);
    expect(tupleValues.some((value) => value.includes(".safeclaw-module-actions a"))).toBe(true);
    expect(tupleValues.every((value) => !value.includes("module-variant-document"))).toBe(true);
  });
});
