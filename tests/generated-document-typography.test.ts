import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { frontendTypography, generatedSurfaceFiles } from "@/lib/frontend-design-contract";

const root = process.cwd();
const read = (relativePath: string) => fs.readFileSync(path.join(root, relativePath), "utf8");
const editor = read("components/WorkpackEditor.tsx");
const pdfRoute = read("app/api/export/pdf/route.ts");
const css = read("app/globals.css");

const documentFont = frontendTypography.fonts.document;
const printRoles = frontendTypography.print;

function exactCssBlock(source: string, selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
  const match = source.match(new RegExp(`${escaped}\\s*\\{([^}]*)\\}`, "u"));
  expect(match, `missing CSS owner ${selector}`).not.toBeNull();
  return match?.[1] ?? "";
}

function expectTuple(block: string, role: keyof typeof printRoles): void {
  const tuple = printRoles[role];
  expect(block).toContain(`font-size: ${tuple.size};`);
  expect(block).toContain(`font-weight: ${tuple.weight};`);
  expect(block).toContain(`line-height: ${tuple.lineHeight};`);
  expect(block).toContain(`letter-spacing: ${tuple.tracking};`);
}

describe("generated document typography", () => {
  it("keeps the generated surface inventory explicit", () => {
    expect(generatedSurfaceFiles).toEqual([
      "components/WorkpackEditor.tsx",
      "app/api/export/pdf/route.ts",
    ]);
  });

  it("uses the document font and exact print roles in the editor preview", () => {
    expect(editor).toContain('className="safety-form-preview document-print-typography"');
    expect(css).toContain(".document-print-typography");
    expect(css).toContain("font-family: var(--font-document);");
    expect(editor).toContain(`font-family: ${documentFont};`);
    expectTuple(exactCssBlock(editor, ".document-print-typography .safety-form-preview-head strong"), "title");
    expectTuple(exactCssBlock(editor, ".document-print-typography .safety-form-bridge h3,\n  .document-print-typography .safety-form-section-stack h3"), "section");
    expectTuple(exactCssBlock(editor, ".document-print-typography .safety-form-meta-grid span"), "body");
    expectTuple(exactCssBlock(editor, ".document-print-typography th,\n  .document-print-typography td"), "table");
    expectTuple(exactCssBlock(editor, ".document-print-typography .safety-form-preview-head small,\n  .document-print-typography .safety-form-preview-head span"), "note");
    expect(exactCssBlock(editor, ".document-print-typography th,\n  .document-print-typography td")).toContain("font-variant-numeric: tabular-nums;");
  });

  it("uses the same document font and exact roles in printable downloads", () => {
    expect(editor).toContain(`font-family: ${documentFont};`);
    expectTuple(exactCssBlock(editor, ".form-title h1"), "title");
    expectTuple(exactCssBlock(editor, ".section-label"), "section");
    expectTuple(exactCssBlock(editor, ".meta-item span"), "body");
    expectTuple(exactCssBlock(editor, "th, td"), "table");
    expectTuple(exactCssBlock(editor, ".form-note"), "note");
    expect(exactCssBlock(editor, "th, td")).toContain("font-variant-numeric: tabular-nums;");
    expect(editor).not.toContain("var(--font-hud)");
  });

  it("does not let XLS or Word compatibility HTML override the print scale with px sizes", () => {
    const fontSizes = Array.from(editor.matchAll(/font-size:\s*([^;]+);/gu), (match) => match[1].trim());
    expect(fontSizes.length).toBeGreaterThan(0);
    expect(new Set(fontSizes)).toEqual(new Set(["20pt", "14pt", "10pt", "8.5pt", "8pt"]));
  });

  it("uses the same document font and exact roles in PDF-ready HTML", () => {
    expect(pdfRoute).toContain(`font-family: ${documentFont};`);
    expectTuple(exactCssBlock(pdfRoute, "h1"), "title");
    expectTuple(exactCssBlock(pdfRoute, "h2"), "section");
    expectTuple(exactCssBlock(pdfRoute, ".meta div"), "body");
    expectTuple(exactCssBlock(pdfRoute, "th, td"), "table");
    expectTuple(exactCssBlock(pdfRoute, ".notice"), "note");
    expect(exactCssBlock(pdfRoute, "th, td")).toContain("font-variant-numeric: tabular-nums;");
    expect(pdfRoute).not.toContain("var(--font-hud)");
  });

  it("preserves page, signature, field ordering, and export response contracts", () => {
    expect(editor).toContain("@page { size: A4; margin: 14mm; }");
    expect(editor).toMatch(/<div class="meta-item"><b>사업장<\/b>[\s\S]*?<b>현장\/공정<\/b>[\s\S]*?<b>작업내용<\/b>/u);
    expect(editor).toContain('<div class="signature-grid">');
    expect(editor).toContain("작성자</b>성명/서명:");
    expect(editor).toContain("관리감독자</b>성명/서명:");

    expect(pdfRoute).toContain("@page { size: A4; margin: 14mm; }");
    expect(pdfRoute).toMatch(/<div><b>사업장<\/b>[\s\S]*?<div><b>현장<\/b>[\s\S]*?<div><b>작업내용<\/b>/u);
    expect(pdfRoute).toContain('<section class="signature">');
    expect(pdfRoute).toContain('"content-type": "application/pdf"');
    expect(pdfRoute).toContain('"content-type": "text/html; charset=utf-8"');
    expect(pdfRoute).toContain('"content-disposition": `attachment; filename="safeclaw-document.pdf"; filename*=UTF-8\'\'${encodeURIComponent(pdfFileName)}`');
    expect(pdfRoute).toContain('"content-disposition": `inline; filename="safeclaw-pdf-ready.html"; filename*=UTF-8\'\'${encodedFileName}`');
  });
});
