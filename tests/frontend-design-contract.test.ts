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

function ruleBlocks(source: string): Array<{ selectors: string[]; declarations: CssDeclarations }> {
  return [...source.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map((match) => {
    const declarations = Object.fromEntries(
      [...match[2].matchAll(/([\w-]+)\s*:\s*([^;]+);/g)].map((declaration) => [
        declaration[1].trim(),
        declaration[2].trim(),
      ]),
    );
    return {
      selectors: match[1].split(",").map((selector) => selector.trim()),
      declarations,
    };
  });
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

function runAudit(css: string): { status: number | null; report: { violations: Array<{ rule: string }> } } {
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
    violations: Array<{ rule: string }>;
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

  it("disables every infinite animation and smooth scrolling for reduced motion", () => {
    const css = fs.readFileSync(path.join(root, "app", "globals.css"), "utf8");
    const reducedMotion = blockBody(css, "@media (prefers-reduced-motion: reduce)");
    expect(effectiveDeclarations(reducedMotion, "html")).toMatchObject({ "scroll-behavior": "auto" });
    for (const selector of [
      ".api-pulse-grid .live i",
      ".api-proof-card i",
      ".status-orb.generating",
      ".button-spinner",
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
});
