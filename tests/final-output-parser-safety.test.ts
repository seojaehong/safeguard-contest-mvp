import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import AdmZip from "adm-zip";
import ExcelJS from "exceljs";
import { afterEach, describe, expect, it } from "vitest";
// @ts-expect-error The operator MJS helper intentionally has no declaration file.
import { extractBudgetedHwpxText, extractBudgetedXlsxText } from "../scripts/final_output_parser_safety.mjs";

const temporaryDirectories: string[] = [];

function temporaryDirectory(): string {
  const directory = mkdtempSync(join(tmpdir(), "safeclaw-final-output-parser-"));
  temporaryDirectories.push(directory);
  return directory;
}

function writeHwpx(filePath: string, xml: string): void {
  const zip = new AdmZip(undefined, { noSort: true });
  zip.addFile("mimetype", Buffer.from("application/hwp+zip"));
  const mimetype = zip.getEntry("mimetype");
  if (!mimetype) throw new Error("Fixture mimetype missing");
  mimetype.header.method = 0;
  zip.addFile("Contents/section0.xml", Buffer.from(xml));
  writeFileSync(filePath, zip.toBuffer());
}

function writeMergedXlsx(filePath: string, mergeRef: string): void {
  const zip = new AdmZip(undefined, { noSort: true });
  zip.addFile("[Content_Types].xml", Buffer.from(`<?xml version="1.0" encoding="UTF-8"?>
    <Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
      <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
      <Default Extension="xml" ContentType="application/xml"/>
      <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
      <Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
    </Types>`));
  zip.addFile("_rels/.rels", Buffer.from(`<?xml version="1.0" encoding="UTF-8"?>
    <Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
      <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
    </Relationships>`));
  zip.addFile("xl/workbook.xml", Buffer.from(`<?xml version="1.0" encoding="UTF-8"?>
    <workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
      <sheets><sheet name="risk" sheetId="1" r:id="rId1"/></sheets>
    </workbook>`));
  zip.addFile("xl/_rels/workbook.xml.rels", Buffer.from(`<?xml version="1.0" encoding="UTF-8"?>
    <Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
      <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
    </Relationships>`));
  zip.addFile("xl/worksheets/sheet1.xml", Buffer.from(`<?xml version="1.0" encoding="UTF-8"?>
    <worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
      <sheetData><row r="1"><c r="A1" t="inlineStr"><is><t>위험</t></is></c></row></sheetData>
      <mergeCells count="1"><mergeCell ref="${mergeRef}"/></mergeCells>
    </worksheet>`));
  writeFileSync(filePath, zip.toBuffer());
}

function parserLimits(overrides: Record<string, number> = {}): Record<string, number> {
  return {
    inputBytes: 1024 * 1024,
    archiveEntries: 64,
    archiveEntryUncompressedBytes: 1024 * 1024,
    archiveTotalUncompressedBytes: 4 * 1024 * 1024,
    archiveCompressionRatio: 100,
    sheetCount: 4,
    totalRows: 10,
    cellsPerRow: 10,
    totalCells: 20,
    extractedTextCharacters: 10_000,
    elapsedMs: 5_000,
    xlsxWorkerHeapMb: 64,
    ...overrides
  };
}

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

describe("final output parser admission", () => {
  it("extracts bounded HWPX text after archive preflight", () => {
    const filePath = join(temporaryDirectory(), "document.hwpx");
    writeHwpx(filePath, "<hp:t>위험성평가 감소대책</hp:t>");

    expect(extractBudgetedHwpxText(filePath)).toContain("위험성평가 감소대책");
  });

  it("rejects compressed HWPX expansion before XML parsing", () => {
    const filePath = join(temporaryDirectory(), "expanded.hwpx");
    writeHwpx(filePath, `<hp:t>${"x".repeat(4096)}</hp:t>`);

    expect(() => extractBudgetedHwpxText(filePath, {
      inputBytes: 1024 * 1024,
      archiveEntries: 8,
      archiveEntryUncompressedBytes: 1024,
      archiveTotalUncompressedBytes: 2048,
      archiveCompressionRatio: 100,
      sheetCount: 4,
      totalRows: 10,
      cellsPerRow: 10,
      totalCells: 20,
      extractedTextCharacters: 10_000,
      elapsedMs: 1000
    })).toThrow("entry bytes exceed budget");
  });

  it("rejects XLSX cell expansion after ZIP preflight", async () => {
    const filePath = join(temporaryDirectory(), "document.xlsx");
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("risk");
    sheet.addRow(["위험", "조치", "담당"]);
    await workbook.xlsx.writeFile(filePath);

    await expect(extractBudgetedXlsxText(filePath, parserLimits({
      cellsPerRow: 2
    }))).rejects.toThrow("workbook cells exceed budget");
  });

  it("extracts legitimate Korean workbook text through the isolated worker", async () => {
    const filePath = join(temporaryDirectory(), "legitimate.xlsx");
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("risk");
    sheet.mergeCells("A1:C1");
    sheet.getCell("A1").value = "위험성평가";
    sheet.addRow([
      "감소대책",
      { formula: "1+1", result: 2 },
      { richText: [{ text: "담당자" }] }
    ]);
    workbook.addWorksheet("tbm").addRow(["TBM", "확인"]);
    await workbook.xlsx.writeFile(filePath);

    await expect(extractBudgetedXlsxText(filePath, parserLimits())).resolves.toBe([
      "위험성평가",
      "위험성평가",
      "위험성평가",
      "감소대책",
      "[object Object]",
      "[object Object]",
      "TBM",
      "확인"
    ].join("\n"));
  });

  it("enforces an external deadline before workbook materialization can block the parent", async () => {
    const filePath = join(temporaryDirectory(), "deadline.xlsx");
    const workbook = new ExcelJS.Workbook();
    workbook.addWorksheet("risk").addRow(["위험"]);
    await workbook.xlsx.writeFile(filePath);

    await expect(extractBudgetedXlsxText(filePath, parserLimits({ elapsedMs: 1 })))
      .rejects.toThrow("elapsed-time budget");
  });

  it("contains compact merge expansion inside the bounded workbook worker", async () => {
    const filePath = join(temporaryDirectory(), "merge-expansion.xlsx");
    writeMergedXlsx(filePath, "A1:XFD1048576");

    await expect(extractBudgetedXlsxText(filePath, parserLimits({ elapsedMs: 2_000 })))
      .rejects.toThrow(/elapsed-time budget|workbook worker failed/u);
  });

  it("parses the admitted immutable snapshot when the source path is replaced", async () => {
    const filePath = join(temporaryDirectory(), "replace-after-admission.xlsx");
    const workbook = new ExcelJS.Workbook();
    workbook.addWorksheet("risk").addRow(["승인된 위험성평가"]);
    await workbook.xlsx.writeFile(filePath);

    const extraction = extractBudgetedXlsxText(filePath, parserLimits());
    writeMergedXlsx(filePath, "A1:XFD1048576");

    await expect(extraction).resolves.toContain("승인된 위험성평가");
  });

  it("keeps full ExcelJS materialization out of the parent parser path", () => {
    const source = readFileSync(join(process.cwd(), "scripts/final_output_parser_safety.mjs"), "utf8");
    const exportedPath = source.slice(source.indexOf("export async function extractBudgetedXlsxText"));

    expect(exportedPath).toContain("new Worker(new URL(import.meta.url)");
    expect(exportedPath).toContain("execArgv: []");
    expect(exportedPath).toContain("resourceLimits:");
    expect(exportedPath).toContain("worker.terminate()");
    expect(exportedPath).toContain("workerData: { mode: XLSX_WORKER_MODE, bytes, limits }");
    expect(exportedPath).not.toContain("workbook.xlsx.readFile(filePath)");
  });
});
