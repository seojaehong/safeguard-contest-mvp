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

function declarationsForExactSelector(source: string, selector: string): CssDeclarations {
  const matches = ruleBlocks(source).filter((rule) => rule.selectors.includes(selector));
  expect(matches.length, `missing CSS rule for ${selector}`).toBeGreaterThan(0);
  return Object.assign({}, ...matches.map((rule) => rule.declarations));
}

function withoutMediaBlocks(source: string): string {
  const blocks: Array<{ start: number; end: number }> = [];
  for (const match of source.matchAll(/@media[^\{]+\{/g)) {
    if (match.index === undefined) continue;
    const openingBrace = source.indexOf("{", match.index);
    let depth = 0;
    for (let index = openingBrace; index < source.length; index += 1) {
      if (source[index] === "{") depth += 1;
      if (source[index] === "}") depth -= 1;
      if (depth === 0) {
        blocks.push({ start: match.index, end: index + 1 });
        break;
      }
    }
  }
  let cursor = 0;
  let result = "";
  for (const block of blocks) {
    result += source.slice(cursor, block.start);
    cursor = block.end;
  }
  return result + source.slice(cursor);
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

function iconOnlyControls(source: string): Array<{ accessibleName: boolean; openingTag: string }> {
  return [...source.matchAll(/<(button|Link)\b([^>]*)>([\s\S]*?)<\/\1>/g)].flatMap((match) => {
    const openingTag = `<${match[1]}${match[2]}>`;
    const body = match[3].replace(/\{\/\*[\s\S]*?\*\/\}/g, "");
    const hasIcon = /<(?:img|svg)\b/.test(body);
    const visibleContent = body.replace(/<[^>]+>/g, "").replace(/\s+/g, "");
    if (!hasIcon || visibleContent.length > 0) return [];
    return [{
      openingTag,
      accessibleName: /aria-label="[^"]+"/.test(openingTag) || /<img\b[^>]*alt="[^"]+"/.test(body),
    }];
  });
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

  it.each(["components/SafeClawModuleShell.tsx", "components/SafeClawLanding.tsx"])(
    "requires accessible names for every icon-only control in %s",
    (relativePath) => {
      const controls = iconOnlyControls(read(relativePath));

      expect(controls.filter((control) => !control.accessibleName)).toEqual([]);
      expect(controls).toHaveLength(0);
    },
  );
});

describe("canonical shared surface styles", () => {
  const css = read("app/globals.css");

  it("keeps yellow actions and light-surface accent labels readable", () => {
    expect(declarationsForExactSelector(css, ".safeclaw-core-card span")).toMatchObject({
      color: "var(--sc-hazard-text)",
    });
    for (const selector of [
      ".safeclaw-pipeline-grid span",
      ".safeclaw-proof-matrix span",
      ".safeclaw-language-matrix span",
      ".safeclaw-module-map span",
    ]) {
      expect(declarationsForExactSelector(css, selector), selector).toMatchObject({
        color: "var(--sc-hazard-text)",
      });
    }
    expect(
      declarationsForExactSelector(
        css,
        ".safeclaw-module-shell.module-variant-document .safeclaw-current-workpack a",
      ),
    ).toMatchObject({ color: "var(--workspace-accent-text)" });
    expect(
      declarationsForExactSelector(
        css,
        ".safeclaw-module-shell.module-variant-document .safeclaw-doc-export a:first-of-type",
      ),
    ).toMatchObject({ color: "var(--workspace-ink)" });
    expect(
      declarationsForExactSelector(
        css,
        '.safeclaw-module-shell.module-variant-document[data-theme="night"] .safeclaw-doc-export a:first-of-type',
      ),
    ).toMatchObject({ color: "var(--workspace-canvas)" });
    expect(
      declarationsForExactSelector(
        css,
        ".safeclaw-module-shell.module-variant-document .safeclaw-module-primary",
      ),
    ).toMatchObject({ color: "var(--module-primary-color, var(--workspace-ink))" });
    expect(
      declarationsForExactSelector(
        css,
        ".command-center-shell .advanced-settings:not([open]) summary",
      ),
    ).toMatchObject({ color: "var(--workspace-muted)" });
  });

  it("shows every core document selector without a mobile horizontal rail", () => {
    expect(
      declarationsForExactSelector(
        css,
        ".command-center-shell .document-workbench .document-viewer-list",
      ),
    ).toMatchObject({
      "grid-auto-flow": "row",
      "grid-template-columns": "minmax(0, 1fr)",
      "overflow-x": "visible",
    });
  });

  it("defines the shared special state with canonical panel geometry", () => {
    const rule = declarationsForExactSelector(css, ".special-state");

    expect(rule).toMatchObject({ padding: "var(--space-6)", "border-radius": "var(--radius-panel)" });
    expect(css).not.toContain("!important");
  });

  it("defines a circular named loading spinner on the canonical icon size", () => {
    const reducedMotionStart = css.indexOf("@media (prefers-reduced-motion: reduce)");
    const rule = declarationsForExactSelector(css.slice(0, reducedMotionStart), ".loading-spinner");

    expect(rule).toMatchObject({
      width: "24px",
      height: "24px",
      "border-radius": "var(--radius-circle)",
      animation: "spin 0.8s linear infinite",
    });
    const reducedMotion = blockBody(css, "@media (prefers-reduced-motion: reduce)");
    expect(declarationsForExactSelector(reducedMotion, ".loading-spinner")).toMatchObject({ animation: "none" });
  });

  it("keeps shell titles, descriptions, actions, and cards on canonical tuples", () => {
    expect(declarationsForExactSelector(css, ".safeclaw-module-title")).toMatchObject({
      "font-size": "var(--text-page-title)",
      "line-height": "var(--leading-page-title)",
      "letter-spacing": "var(--tracking-page-title)",
    });
    expect(declarationsForExactSelector(css, ".safeclaw-module-description")).toMatchObject({
      "font-size": "var(--text-body-lg)",
      "line-height": "var(--leading-body-lg)",
      "letter-spacing": "var(--tracking-body)",
    });
    expect(declarationsForExactSelector(css, ".safeclaw-module-primary")).toMatchObject({
      "min-height": "var(--control-height)",
      "border-radius": "var(--radius-control)",
    });
    expect(declarationsForExactSelector(css, ".safeclaw-module-card")).toMatchObject({
      padding: "var(--space-6)",
      "border-radius": "var(--radius-panel)",
    });
  });

  it("keeps effective landing descriptions, actions, and cards canonical", () => {
    const desktopCss = withoutMediaBlocks(css);
    expect(declarationsForExactSelector(css, ".safeclaw-os-hero p")).toMatchObject({
      "font-size": "var(--text-body-lg)",
      "font-weight": "500",
      "line-height": "var(--leading-body-lg)",
      "letter-spacing": "var(--tracking-body)",
    });
    expect(declarationsForExactSelector(css, ".safeclaw-shared-action")).toMatchObject({
      "min-height": "var(--control-height)",
      "border-radius": "var(--radius-control)",
      "font-size": "var(--text-control)",
      "font-weight": "700",
      "line-height": "var(--leading-control)",
      "letter-spacing": "var(--tracking-body)",
    });
    for (const selector of [".safeclaw-login", ".safeclaw-contact"]) {
      expect(declarationsForExactSelector(css, selector), selector).toMatchObject({
        "min-height": "var(--control-height)",
        "border-radius": "var(--radius-control)",
        "font-size": "var(--text-control)",
        "font-weight": "700",
        "line-height": "var(--leading-control)",
        "letter-spacing": "var(--tracking-body)",
      });
    }
    expect(declarationsForExactSelector(css, ".safeclaw-os-cta a")).toMatchObject({
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
      expect(declarationsForExactSelector(desktopCss, selector), selector).toMatchObject({ padding: "var(--space-6)" });
    }
  });

  it("keeps document variant card spacing and descriptions canonical through scoped rules", () => {
    expect(declarationsForExactSelector(css, ".safeclaw-module-hero.document aside")).toMatchObject({
      padding: "var(--space-6)",
    });
    expect(declarationsForExactSelector(css, ".safeclaw-module-hero.document p")).toMatchObject({
      "font-size": "var(--text-body-lg)",
      "line-height": "var(--leading-body-lg)",
    });
    expect(
      declarationsForExactSelector(css, ".safeclaw-module-shell.module-variant-document .safeclaw-module-hero p"),
    ).toMatchObject({
      "font-size": "var(--text-body-lg)",
      "line-height": "var(--leading-body-lg)",
    });
    expect(
      declarationsForExactSelector(css, ".safeclaw-module-shell.module-variant-document .safeclaw-workdoc-header p"),
    ).toMatchObject({
      "font-size": "var(--text-body-lg)",
      "line-height": "var(--leading-body-lg)",
    });
    for (const selector of [
      ".safeclaw-module-shell.module-variant-document .safeclaw-workdoc-list p",
      ".safeclaw-module-shell.module-variant-document .safeclaw-report-notes p",
    ]) {
      expect(declarationsForExactSelector(css, selector), selector).toMatchObject({
        "font-size": "var(--text-body)",
        "line-height": "var(--leading-body)",
        "letter-spacing": "var(--tracking-body)",
      });
    }
  });
});
