import fs from "node:fs";
import { Worker, isMainThread, parentPort, workerData } from "node:worker_threads";
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
  elapsedMs: 15_000,
  xlsxWorkerHeapMb: 256
};

const XLSX_WORKER_MODE = "final-output-xlsx-worker";
const XLSX_WORKER_MIN_HEAP_MB = 32;
const XLSX_WORKER_MAX_HEAP_MB = 512;
const XLSX_WORKER_MAX_OUTPUT_BYTES = 16 * 1024 * 1024;

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
  const expectedBytes = assertFinalOutputFileBudget(filePath, limits);
  const bytes = fs.readFileSync(filePath);
  if (bytes.length !== expectedBytes || bytes.length > limits.inputBytes) {
    throw new Error(`final output input changed while reading: ${bytes.length}/${expectedBytes}`);
  }
  const archive = new AdmZip(bytes, { noSort: true });
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
  return { archive, entries, bytes };
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

async function extractXlsxTextInWorker(bytes, limits) {
  const startedAt = Date.now();
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(bytes);
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

function boundedXlsxWorkerHeapMb(limits) {
  const requested = Number(limits.xlsxWorkerHeapMb ?? FINAL_OUTPUT_PARSER_LIMITS.xlsxWorkerHeapMb);
  if (!Number.isSafeInteger(requested)) return FINAL_OUTPUT_PARSER_LIMITS.xlsxWorkerHeapMb;
  return Math.max(XLSX_WORKER_MIN_HEAP_MB, Math.min(XLSX_WORKER_MAX_HEAP_MB, requested));
}

function boundedXlsxWorkerOutputBytes(limits) {
  const projected = (Number(limits.extractedTextCharacters) * 4)
    + Number(limits.totalRows)
    + 64 * 1024;
  if (!Number.isSafeInteger(projected) || projected <= 0) return XLSX_WORKER_MAX_OUTPUT_BYTES;
  return Math.min(XLSX_WORKER_MAX_OUTPUT_BYTES, Math.max(64 * 1024, projected));
}

export async function extractBudgetedXlsxText(filePath, limits = FINAL_OUTPUT_PARSER_LIMITS) {
  const { bytes } = inspectArchive(filePath, limits);
  const workerHeapMb = boundedXlsxWorkerHeapMb(limits);
  const maxOutputBytes = boundedXlsxWorkerOutputBytes(limits);
  return await new Promise((resolve, reject) => {
    const worker = new Worker(new URL(import.meta.url), {
      workerData: { mode: XLSX_WORKER_MODE, bytes, limits },
      execArgv: [],
      resourceLimits: {
        maxOldGenerationSizeMb: workerHeapMb,
        maxYoungGenerationSizeMb: Math.min(32, workerHeapMb),
        stackSizeMb: 4
      }
    });
    let settled = false;
    const finish = (callback) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      callback();
    };
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      void worker.terminate().finally(() => {
        reject(new Error("final output workbook exceeded the elapsed-time budget"));
      });
    }, limits.elapsedMs);

    worker.once("message", (message) => {
      finish(() => {
        if (!message?.ok) {
          reject(new Error(`final output workbook worker failed: ${String(message?.error || "unknown error")}`));
          return;
        }
        const text = String(message.text ?? "");
        if (Buffer.byteLength(text, "utf8") > maxOutputBytes) {
          reject(new Error("final output workbook output exceeds byte budget"));
          return;
        }
        resolve(text);
      });
    });
    worker.once("error", (error) => {
      finish(() => reject(new Error(`final output workbook worker failed: ${error.message}`)));
    });
    worker.once("exit", (status) => {
      if (status !== 0) {
        finish(() => reject(new Error(`final output workbook worker failed: exit ${status}`)));
      }
    });
  });
}

if (!isMainThread && workerData?.mode === XLSX_WORKER_MODE) {
  try {
    const { bytes, limits } = workerData;
    if (!bytes || !limits) throw new Error("final output workbook worker arguments are incomplete");
    parentPort?.postMessage({ ok: true, text: await extractXlsxTextInWorker(Buffer.from(bytes), limits) });
  } catch (error) {
    parentPort?.postMessage({ ok: false, error: error instanceof Error ? error.message : String(error) });
  }
}
