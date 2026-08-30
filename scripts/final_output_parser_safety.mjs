import fs from "node:fs";
import AdmZip from "adm-zip";
import ExcelJS from "exceljs";

export const FINAL_OUTPUT_PARSER_LIMITS = {
  inputBytes: 16 * 1024 * 1024,
  archiveEntries: 128,
  archiveEntryUncompressedBytes: 8 * 1024 * 1024,
  archiveTotalUncompressedBytes: 32 * 1024 * 1024,
  archiveCompressionRatio: 100,
  sheetCount: 32,
  totalRows: 100_000,
  cellsPerRow: 256,
  totalCells: 500_000,
  extractedTextCharacters: 2_000_000,
  elapsedMs: 15_000
};

function checkElapsed(startedAt, limits) {
  if (Date.now() - startedAt > limits.elapsedMs) {
    throw new Error("final output parser exceeded the elapsed-time budget");
  }
}

export function assertFinalOutputFileBudget(filePath, limits = FINAL_OUTPUT_PARSER_LIMITS) {
  const bytes = fs.statSync(filePath).size;
  if (!Number.isSafeInteger(bytes) || bytes < 0 || bytes > limits.inputBytes) {
    throw new Error(`final output input bytes exceed budget: ${bytes}/${limits.inputBytes}`);
  }
  return bytes;
}

function assertSafeEntry(entry) {
  const normalized = entry.entryName.replace(/\\/gu, "/");
  if (!normalized
    || normalized.includes("\0")
    || normalized.startsWith("/")
    || /^[A-Za-z]:/u.test(normalized)
    || normalized.split("/").includes("..")) {
    throw new Error(`unsafe final output archive entry: ${entry.entryName}`);
  }
  const unixMode = (Number(entry.attr) >>> 16) & 0xffff;
  if ((unixMode & 0xf000) === 0xa000) {
    throw new Error(`final output archive symlink entry is not allowed: ${entry.entryName}`);
  }
}

function inspectArchive(filePath, limits) {
  assertFinalOutputFileBudget(filePath, limits);
  const archive = new AdmZip(filePath, { noSort: true });
  const entries = archive.getEntries();
  if (entries.length > limits.archiveEntries) {
    throw new Error(`final output archive entries exceed budget: ${entries.length}/${limits.archiveEntries}`);
  }

  let totalUncompressedBytes = 0;
  for (const entry of entries) {
    assertSafeEntry(entry);
    const expanded = entry.header.size;
    const compressed = entry.header.compressedSize;
    if (!Number.isSafeInteger(expanded) || expanded < 0 || expanded > limits.archiveEntryUncompressedBytes) {
      throw new Error(`final output archive entry bytes exceed budget: ${entry.entryName}`);
    }
    const ratio = expanded === 0 ? 1 : compressed > 0 ? expanded / compressed : Number.POSITIVE_INFINITY;
    if (ratio > limits.archiveCompressionRatio) {
      throw new Error(`final output archive compression ratio exceeds budget: ${entry.entryName}`);
    }
    totalUncompressedBytes += expanded;
    if (!Number.isSafeInteger(totalUncompressedBytes)
      || totalUncompressedBytes > limits.archiveTotalUncompressedBytes) {
      throw new Error("final output archive expanded bytes exceed total budget");
    }
  }
  return { archive, entries };
}

function appendText(parts, value, state, limits) {
  const text = String(value ?? "");
  state.characters += Array.from(text).length;
  if (state.characters > limits.extractedTextCharacters) {
    throw new Error("final output extracted text exceeds character budget");
  }
  parts.push(text);
}

export function extractBudgetedHwpxText(filePath, limits = FINAL_OUTPUT_PARSER_LIMITS) {
  const startedAt = Date.now();
  const { entries } = inspectArchive(filePath, limits);
  const parts = [];
  const state = { characters: 0 };
  for (const entry of entries) {
    checkElapsed(startedAt, limits);
    if (entry.isDirectory || !entry.entryName.toLowerCase().endsWith(".xml")) continue;
    const text = entry.getData().toString("utf8").replace(/<[^>]+>/gu, " ");
    appendText(parts, text, state, limits);
  }
  checkElapsed(startedAt, limits);
  return parts.join("\n").replace(/\s+/gu, " ");
}

export async function extractBudgetedXlsxText(filePath, limits = FINAL_OUTPUT_PARSER_LIMITS) {
  const startedAt = Date.now();
  inspectArchive(filePath, limits);
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);
  if (workbook.worksheets.length > limits.sheetCount) {
    throw new Error(`final output workbook sheets exceed budget: ${workbook.worksheets.length}/${limits.sheetCount}`);
  }

  const parts = [];
  const state = { characters: 0, rows: 0, cells: 0 };
  workbook.eachSheet((sheet) => {
    sheet.eachRow((row) => {
      checkElapsed(startedAt, limits);
      let rowCells = 0;
      row.eachCell({ includeEmpty: false }, (cell) => {
        rowCells += 1;
        state.cells += 1;
        if (rowCells > limits.cellsPerRow || state.cells > limits.totalCells) {
          throw new Error("final output workbook cells exceed budget");
        }
        appendText(parts, cell.value, state, limits);
      });
      state.rows += 1;
      if (state.rows > limits.totalRows) {
        throw new Error("final output workbook rows exceed budget");
      }
    });
  });
  checkElapsed(startedAt, limits);
  return parts.join("\n");
}
