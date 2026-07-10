import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { frontendTypography, generatedSurfaceFiles } from "@/lib/frontend-design-contract";
import { NextRequest } from "next/server";
import { POST } from "@/app/api/export/pdf/route";

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

function functionSlice(source: string, name: string, nextName: string): string {
  const start = source.indexOf(`function ${name}`);
  const end = source.indexOf(`function ${nextName}`, start + 1);
  expect(start, `missing function ${name}`).toBeGreaterThanOrEqual(0);
  expect(end, `missing boundary ${nextName}`).toBeGreaterThan(start);
  return source.slice(start, end);
}

const payload = {
  title: "위험성평가표",
  scenario: {
    companyName: "가온테크",
    siteName: "1차 작업장",
    workSummary: "천장 배관 점검",
    workerCount: 2,
    weatherNote: "실내 습기",
  },
  rows: [{ document: "위험성평가표", section: "점검", item: "누수", content: "전원 차단" }],
  riskLevel: "상",
  topRisk: "감전",
};

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
    for (const [selector, role] of [
      [".document-print-typography .approval-preview b", "tableHeader"],
      [".document-print-typography .approval-preview em", "note"],
      [".document-print-typography .safety-form-meta-grid b", "tableHeader"],
      [".document-print-typography .safety-form-check-row span", "table"],
      [".document-print-typography .safety-form-signatures span", "table"],
    ] as const) {
      const block = exactCssBlock(editor, selector);
      expectTuple(block, role);
      expect(block).toContain("font-family: inherit;");
    }
    expect(documentPreviewCssSource()).not.toContain("var(--font-hud)");
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

  it("owns every HTML template typography contract independently", () => {
    const form = functionSlice(editor, "formCss", "buildGenericSections");
    const excel = functionSlice(editor, "buildExcelHtml", "buildLaunchWorkbookHtml");
    const excelFallback = excel.slice(excel.indexOf("const grouped"));
    const workbook = functionSlice(editor, "buildLaunchWorkbookHtml", "buildWordHtml");
    const word = functionSlice(editor, "buildWordHtml", "buildHwpTemplateText");
    for (const [name, template] of Object.entries({ form, excel, workbook })) {
      expect(template, `${name} font`).toContain(documentFont);
      expect(template, `${name} HUD leak`).not.toContain("var(--font-hud)");
    }
    expectTuple(exactCssBlock(form, ".form-title h1"), "title");
    expectTuple(exactCssBlock(form, ".section-label"), "section");
    expectTuple(exactCssBlock(form, "body"), "body");
    expectTuple(exactCssBlock(form, "th, td"), "table");
    expectTuple(exactCssBlock(form, ".form-note"), "note");
    expectTuple(exactCssBlock(excelFallback, ".cover h1"), "title");
    expectTuple(exactCssBlock(excelFallback, "body"), "body");
    expectTuple(exactCssBlock(excelFallback, "th, td"), "table");
    expectTuple(exactCssBlock(excelFallback, ".note"), "note");
    expectTuple(exactCssBlock(workbook, ".cover h1"), "title");
    expectTuple(exactCssBlock(workbook, "h2"), "section");
    expectTuple(exactCssBlock(workbook, "body"), "body");
    expectTuple(exactCssBlock(workbook, "th, td"), "table");
    expect(word).toContain('${formCss("20px")}');
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

  it("maps the default binary PDF branch to exact roles and Malgun Gothic resources", () => {
    const content = functionSlice(pdfRoute, "buildPdfContentLines", "buildBinaryPdf");
    const binary = functionSlice(pdfRoute, "buildBinaryPdf", "POST");
    expect(content).toContain('role: "title"');
    expect(content).toContain('role: "section"');
    expect(content).toContain('role: "body"');
    expect(content).toContain('role: "table"');
    expect(content).toContain('role: "note"');
    expect(binary).toContain('title: { font: "F2", size: 20, leading: 24, tracking: -0.4 }');
    expect(binary).toContain('section: { font: "F2", size: 14, leading: 18, tracking: -0.14 }');
    expect(binary).toContain('body: { font: "F1", size: 10, leading: 15, tracking: 0 }');
    expect(binary).toContain('table: { font: "F1", size: 8.5, leading: 12, tracking: 0 }');
    expect(binary).toContain('note: { font: "F1", size: 8, leading: 11, tracking: 0 }');
    expect(binary).toContain("/BaseFont /MalgunGothic");
    expect(binary).toContain("/BaseFont /MalgunGothic-Bold");
    expect(binary).not.toContain("HYSMyeongJo");
  });

  it("preserves binary and HTML response behavior with representative values", async () => {
    const binaryResponse = await POST(new NextRequest("http://localhost/api/export/pdf", {
      method: "POST",
      body: JSON.stringify(payload),
      headers: { "content-type": "application/json" },
    }));
    expect(binaryResponse.status).toBe(200);
    expect(binaryResponse.headers.get("content-type")).toBe("application/pdf");
    expect(binaryResponse.headers.get("content-disposition")).toContain('attachment; filename="safeclaw-document.pdf"');
    expect(binaryResponse.headers.get("cache-control")).toBe("no-store");
    const binary = Buffer.from(await binaryResponse.arrayBuffer());
    expect(binary.subarray(0, 5).toString("utf8")).toBe("%PDF-");
    expect(binary.toString("binary")).toContain("/MalgunGothic");

    const htmlResponse = await POST(new NextRequest("http://localhost/api/export/pdf?format=html", {
      method: "POST",
      body: JSON.stringify(payload),
      headers: { "content-type": "application/json" },
    }));
    expect(htmlResponse.status).toBe(200);
    expect(htmlResponse.headers.get("content-type")).toBe("text/html; charset=utf-8");
    expect(htmlResponse.headers.get("content-disposition")).toContain('inline; filename="safeclaw-pdf-ready.html"');
    expect(htmlResponse.headers.get("cache-control")).toBe("no-store");
    const html = await htmlResponse.text();
    for (const value of ["가온테크", "1차 작업장", "천장 배관 점검", "실내 습기", "감전", "전원 차단"]) {
      expect(html).toContain(value);
    }
    expect(html).toMatch(/<section class="meta">[\s\S]*?<b>사업장<\/b>[\s\S]*?<b>현장<\/b>[\s\S]*?<b>작업내용<\/b>[\s\S]*?<b>인원\/기상<\/b>/u);
    expect(html).toContain('<section class="signature">');
  });

  it("preserves page, signature, field ordering, and export response contracts", () => {
    expect(editor).not.toContain("@page { size: A4; margin: 14mm; }");
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

function documentPreviewCssSource(): string {
  const start = editor.indexOf("const documentPreviewCss = `");
  const end = editor.indexOf("function buildGenericSections", start);
  expect(start).toBeGreaterThanOrEqual(0);
  expect(end).toBeGreaterThan(start);
  return editor.slice(start, end);
}
