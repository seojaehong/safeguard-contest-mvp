import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
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

    await expect(extractBudgetedXlsxText(filePath, {
      inputBytes: 1024 * 1024,
      archiveEntries: 64,
      archiveEntryUncompressedBytes: 1024 * 1024,
      archiveTotalUncompressedBytes: 4 * 1024 * 1024,
      archiveCompressionRatio: 100,
      sheetCount: 4,
      totalRows: 10,
      cellsPerRow: 2,
      totalCells: 20,
      extractedTextCharacters: 10_000,
      elapsedMs: 1000
    })).rejects.toThrow("workbook cells exceed budget");
  });
});
