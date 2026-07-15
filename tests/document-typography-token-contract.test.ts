import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

type Declarations = Record<string, string>;

function effectiveDeclarations(source: string, selector: string): Declarations {
  const uncommented = source.replace(/\/\*[\s\S]*?\*\//gu, "");
  const declarations: Declarations = {};
  for (const match of uncommented.matchAll(/([^{}]+)\{([^{}]*)\}/gu)) {
    const selectors = match[1].split(",").map((value) => value.replace(/\s+/gu, " ").trim());
    if (!selectors.includes(selector)) continue;
    for (const declaration of match[2].matchAll(/([\w-]+)\s*:\s*([^;]+);/gu)) {
      declarations[declaration[1].trim()] = declaration[2].trim();
    }
  }
  return declarations;
}

describe("document typography token contract", () => {
  const css = fs.readFileSync(path.join(process.cwd(), "app", "globals.css"), "utf8");

  it.each([
    [
      ".safeclaw-module-shell.module-variant-document .safeclaw-workdoc-header h2",
      "var(--text-page-title)",
      "800",
      "var(--leading-page-title)",
      "var(--tracking-page-title)",
    ],
    [
      ".safeclaw-module-shell.module-variant-document .safeclaw-workdoc-section-head h3",
      "var(--text-section-title)",
      "800",
      "var(--leading-section-title)",
      "var(--tracking-section-title)",
    ],
  ])("keeps %s on its semantic heading role", (selector, size, weight, lineHeight, tracking) => {
    expect(effectiveDeclarations(css, selector)).toMatchObject({
      "font-size": size,
      "font-weight": weight,
      "line-height": lineHeight,
      "letter-spacing": tracking,
    });
  });
});
