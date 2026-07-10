import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const root = process.cwd();

type CssDeclarations = Record<string, string>;

type CssRule = { selectors: string[]; declarations: CssDeclarations };

function read(relativePath: string): string {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

function ruleBlocks(source: string): CssRule[] {
  const uncommented = source.replace(/\/\*[\s\S]*?\*\//g, "");
  return [...uncommented.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map((match) => ({
    selectors: match[1].split(",").map((selector) => selector.replace(/\s+/g, " ").trim()),
    declarations: Object.fromEntries(
      [...match[2].matchAll(/([\w-]+)\s*:\s*([^;]+);/g)].map((declaration) => [
        declaration[1].trim(),
        declaration[2].trim(),
      ]),
    ),
  }));
}

function effectiveDeclarations(source: string, selector: string): CssDeclarations {
  const matches = ruleBlocks(source).filter((rule) => rule.selectors.includes(selector));
  expect(matches.length, `missing CSS rule for ${selector}`).toBeGreaterThan(0);
  return Object.assign({}, ...matches.map((rule) => rule.declarations));
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

function boundedLink(source: string, className: string): { openingTag: string; body: string } {
  const escapedClassName = className.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = source.match(
    new RegExp(`<Link\\b(?=[^>]*className="[^"]*\\b${escapedClassName}\\b[^"]*")[^>]*>([\\s\\S]*?)<\\/Link>`),
  );
  expect(match, `missing bounded Link for ${className}`).not.toBeNull();
  const fullLink = match?.[0] ?? "";
  return {
    openingTag: fullLink.slice(0, fullLink.indexOf(">") + 1),
    body: match?.[1] ?? "",
  };
}

describe("shared framework states", () => {
  const stateFiles = ["app/not-found.tsx", "app/error.tsx", "app/global-error.tsx", "app/workspace/loading.tsx"];

  it.each(stateFiles)("uses a semantic title and the shared special-state hook in %s", (relativePath) => {
    const source = read(relativePath);

    expect(source).toMatch(/<h[12][^>]*className="special-state-title"/);
    expect(source).toContain('className="card list special-state"');
  });

  it("uses a named loading spinner instead of inline numeric styles", () => {
    const source = read("app/workspace/loading.tsx");

    expect(source).toContain('className="loading-spinner"');
    expect(source).not.toMatch(/style=\{\{/);
  });
});

describe("shared shell hooks and accessibility", () => {
  it("exposes stable module shell hooks", () => {
    const source = read("components/SafeClawModuleShell.tsx");

    for (const hook of [
      "safeclaw-module-header",
      "safeclaw-module-navigation",
      "safeclaw-module-title",
      "safeclaw-module-description",
      "safeclaw-module-content",
    ]) {
      expect(source).toContain(hook);
    }
  });

  it("exposes every introduced landing hook", () => {
    const source = read("components/SafeClawLanding.tsx");

    for (const hook of [
      "safeclaw-shared-header",
      "safeclaw-shared-navigation",
      "safeclaw-shared-page-title",
      "safeclaw-shared-description",
      "safeclaw-shared-action",
      "safeclaw-shared-card",
    ]) {
      expect(source).toContain(hook);
    }
  });

  it.each([
    ["components/SafeClawModuleShell.tsx", "safeclaw-module-brand"],
    ["components/SafeClawLanding.tsx", "safeclaw-os-brand"],
  ])("keeps the bounded brand control accessibly named in %s", (relativePath, className) => {
    const link = boundedLink(read(relativePath), className);

    expect(link.openingTag).toMatch(/aria-label="[^"]+"/);
    expect(link.body).toMatch(/<img\b[^>]*alt=""[^>]*\/>/);
  });
});

describe("canonical shared surface styles", () => {
  const css = read("app/globals.css");

  it("defines the shared special state with canonical panel geometry", () => {
    const rule = effectiveDeclarations(css, ".special-state");

    expect(rule).toMatchObject({ padding: "var(--space-6)", "border-radius": "var(--radius-panel)" });
    expect(css).not.toContain("!important");
  });

  it("defines a circular named loading spinner on the canonical icon size", () => {
    const reducedMotionStart = css.indexOf("@media (prefers-reduced-motion: reduce)");
    const rule = effectiveDeclarations(css.slice(0, reducedMotionStart), ".loading-spinner");

    expect(rule).toMatchObject({
      width: "24px",
      height: "24px",
      "border-radius": "var(--radius-circle)",
      animation: "spin 0.8s linear infinite",
    });
    const reducedMotion = blockBody(css, "@media (prefers-reduced-motion: reduce)");
    expect(effectiveDeclarations(reducedMotion, ".loading-spinner")).toMatchObject({ animation: "none" });
  });

  it("keeps shell titles, descriptions, actions, and cards on canonical tuples", () => {
    expect(effectiveDeclarations(css, ".safeclaw-module-title")).toMatchObject({
      "font-size": "var(--text-page-title)",
      "line-height": "var(--leading-page-title)",
      "letter-spacing": "var(--tracking-page-title)",
    });
    expect(effectiveDeclarations(css, ".safeclaw-module-description")).toMatchObject({
      "font-size": "var(--text-body-lg)",
      "line-height": "var(--leading-body-lg)",
      "letter-spacing": "var(--tracking-body)",
    });
    expect(effectiveDeclarations(css, ".safeclaw-module-primary")).toMatchObject({
      "min-height": "var(--control-height)",
      "border-radius": "var(--radius-control)",
    });
    expect(effectiveDeclarations(css, ".safeclaw-module-card")).toMatchObject({
      padding: "var(--space-6)",
      "border-radius": "var(--radius-panel)",
    });
  });

  it("keeps effective landing descriptions, actions, and cards canonical", () => {
    expect(effectiveDeclarations(css, ".safeclaw-os-hero p")).toMatchObject({
      "font-size": "var(--text-body-lg)",
      "font-weight": "500",
      "line-height": "var(--leading-body-lg)",
      "letter-spacing": "var(--tracking-body)",
    });
    expect(effectiveDeclarations(css, ".safeclaw-shared-action")).toMatchObject({
      "min-height": "var(--control-height)",
      "border-radius": "var(--radius-control)",
      "font-size": "var(--text-control)",
      "font-weight": "700",
      "line-height": "var(--leading-control)",
      "letter-spacing": "var(--tracking-body)",
    });
    for (const selector of [".safeclaw-login", ".safeclaw-contact"]) {
      expect(effectiveDeclarations(css, selector), selector).toMatchObject({
        "min-height": "var(--control-height)",
        "border-radius": "var(--radius-control)",
      });
      expect(effectiveDeclarations(css, selector), selector).not.toHaveProperty("font-size");
    }
    expect(effectiveDeclarations(css, ".safeclaw-os-cta a")).toMatchObject({
      "min-height": "var(--control-height)",
      "border-radius": "var(--radius-control)",
      "font-size": "var(--text-control)",
      "font-weight": "700",
      "line-height": "var(--leading-control)",
      "letter-spacing": "var(--tracking-body)",
    });
    for (const selector of [
      ".safeclaw-pipeline-grid article",
      ".safeclaw-proof-matrix article",
      ".safeclaw-language-matrix article",
      ".safeclaw-module-map a",
    ]) {
      expect(effectiveDeclarations(css, selector), selector).toMatchObject({ padding: "var(--space-6)" });
    }
  });

  it("keeps document variant card spacing and descriptions canonical through scoped rules", () => {
    expect(effectiveDeclarations(css, ".safeclaw-module-hero.document aside")).toMatchObject({
      padding: "var(--space-6)",
    });
    expect(effectiveDeclarations(css, ".safeclaw-module-hero.document p")).toMatchObject({
      "font-size": "var(--text-body-lg)",
      "line-height": "var(--leading-body-lg)",
    });
    expect(
      effectiveDeclarations(css, ".safeclaw-module-shell.module-variant-document .safeclaw-module-hero p"),
    ).toMatchObject({
      "font-size": "var(--text-body-lg)",
      "line-height": "var(--leading-body-lg)",
    });
  });
});
