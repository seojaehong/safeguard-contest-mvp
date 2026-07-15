import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const root = process.cwd();
const css = fs.readFileSync(path.join(root, "app", "globals.css"), "utf8");

function declarationsFor(selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
  const matches = Array.from(css.matchAll(new RegExp(`${escaped}\\s*\\{([^}]*)\\}`, "gu")));
  return matches.at(-1)?.[1] ?? "";
}

function someDeclarationFor(selector: string, declaration: string): boolean {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
  return Array.from(css.matchAll(new RegExp(`${escaped}\\s*\\{([^}]*)\\}`, "gu")))
    .some((match) => match[1].includes(declaration));
}

describe("font family token contract", () => {
  it("routes every product font declaration through a semantic token", () => {
    const productRules = css.replace(/@font-face\s*\{[^}]*\}/gu, "");
    const literalFamilies = Array.from(productRules.matchAll(/font-family\s*:\s*([^;\r\n}]+)/gu))
      .map((match) => match[1].trim().replace(/\s*!important$/u, ""))
      .filter((value) => !value.startsWith("var(") && value !== "inherit");

    expect(literalFamilies).toEqual([]);
  });

  it("keeps telemetry, product UI, and document preview on their semantic font roles", () => {
    expect(declarationsFor(".ai-connect-meta dd")).toContain("font-family: var(--font-hud)");
    expect(someDeclarationFor(".command-center-shell", "font-family: var(--font-product)")).toBe(true);
    expect(
      someDeclarationFor(".safeclaw-module-shell.module-variant-document", "font-family: var(--font-product)"),
    ).toBe(true);
    expect(
      declarationsFor(".command-center-shell.workspace-theme-day .document-workbench .document-preview-pane pre"),
    ).toContain("font-family: var(--font-document)");
  });
});
