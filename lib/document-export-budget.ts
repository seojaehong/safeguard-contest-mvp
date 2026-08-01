import type { NextRequest } from "next/server";

export const DOCUMENT_EXPORT_BUDGETS = {
  requestBytes: 256 * 1024,
  documents: 12,
  rows: 128,
  totalRows: 512,
  fieldCharacters: 4_000,
  nestedEntries: 2_000,
  renderedCells: 5_000,
  outputBytes: 2 * 1024 * 1024
} as const;

export class DocumentExportLimitError extends Error {
  constructor(readonly reason: string) {
    super(`Document export request exceeds resource budget: ${reason}`);
    this.name = "DocumentExportLimitError";
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function assertFieldAndNestedBudget(value: unknown): void {
  const pending: unknown[] = [value];
  let nestedEntries = 0;

  while (pending.length) {
    const current = pending.pop();

    if (typeof current === "string") {
      if (Array.from(current).length > DOCUMENT_EXPORT_BUDGETS.fieldCharacters) {
        throw new DocumentExportLimitError("field_characters");
      }
      continue;
    }

    if (Array.isArray(current)) {
      nestedEntries += current.length;
      if (nestedEntries > DOCUMENT_EXPORT_BUDGETS.nestedEntries) {
        throw new DocumentExportLimitError("nested_entries");
      }
      current.forEach((item) => pending.push(item));
      continue;
    }

    if (isRecord(current)) {
      const values = Object.values(current);
      nestedEntries += values.length;
      if (nestedEntries > DOCUMENT_EXPORT_BUDGETS.nestedEntries) {
        throw new DocumentExportLimitError("nested_entries");
      }
      values.forEach((item) => pending.push(item));
    }
  }
}

async function readBoundedBody(request: NextRequest): Promise<string> {
  const declaredLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > DOCUMENT_EXPORT_BUDGETS.requestBytes) {
    throw new DocumentExportLimitError("request_bytes");
  }
  if (!request.body) return "";

  const reader = request.body.getReader();
  const chunks: Buffer[] = [];
  let totalBytes = 0;

  try {
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      totalBytes += chunk.value.byteLength;
      if (totalBytes > DOCUMENT_EXPORT_BUDGETS.requestBytes) {
        await reader.cancel();
        throw new DocumentExportLimitError("request_bytes");
      }
      chunks.push(Buffer.from(chunk.value));
    }
  } finally {
    reader.releaseLock();
  }

  return Buffer.concat(chunks, totalBytes).toString("utf8");
}

export async function readDocumentExportRequestJson(request: NextRequest): Promise<unknown> {
  const text = await readBoundedBody(request);
  if (!text.trim()) return {};
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return {};
  }
}

function countArrayRows(candidate: unknown, countedArrays: Set<unknown[]>): number {
  if (!Array.isArray(candidate) || countedArrays.has(candidate)) return 0;
  countedArrays.add(candidate);
  return candidate.length;
}

function countBodyRows(body: Record<string, unknown>): number {
  const countedArrays = new Set<unknown[]>();
  let rowCount = countArrayRows(body.rows, countedArrays)
    + countArrayRows(body.riskRows, countedArrays)
    + countArrayRows(body.structuredRiskRows, countedArrays)
    + countArrayRows(body.riskAssessmentRows, countedArrays)
    + countArrayRows(body.structuredRows, countedArrays)
    + countArrayRows(body.canonicalRows, countedArrays);

  const structured = isRecord(body.structured) ? body.structured : {};
  rowCount += countArrayRows(structured.riskAssessmentRows, countedArrays)
    + countArrayRows(structured.structuredRiskRows, countedArrays);

  const response = isRecord(body.response) ? body.response : {};
  const responseStructured = isRecord(response.structured) ? response.structured : {};
  rowCount += countArrayRows(responseStructured.riskAssessmentRows, countedArrays)
    + countArrayRows(responseStructured.structuredRiskRows, countedArrays);

  if (Array.isArray(body.documents)) {
    for (const document of body.documents) {
      if (!isRecord(document)) continue;
      rowCount += countArrayRows(document.rows, countedArrays)
        + countArrayRows(document.structuredRiskRows, countedArrays)
        + countArrayRows(document.riskAssessmentRows, countedArrays)
        + countArrayRows(document.structuredRows, countedArrays)
        + countArrayRows(document.canonicalRows, countedArrays);
    }
  }

  return rowCount;
}

export function assertDocumentExportInputBudget(body: Record<string, unknown>): void {
  assertFieldAndNestedBudget(body);

  if (Array.isArray(body.documents) && body.documents.length > DOCUMENT_EXPORT_BUDGETS.documents) {
    throw new DocumentExportLimitError("documents");
  }

  const directRows = Array.isArray(body.rows) ? body.rows.length : 0;
  const totalRows = countBodyRows(body);

  if (directRows > DOCUMENT_EXPORT_BUDGETS.rows || totalRows > DOCUMENT_EXPORT_BUDGETS.totalRows) {
    throw new DocumentExportLimitError("rows");
  }

  if (totalRows * 8 > DOCUMENT_EXPORT_BUDGETS.renderedCells) {
    throw new DocumentExportLimitError("rendered_cells");
  }
}

export function assertDocumentExportOutputBudget(buffer: Buffer): void {
  if (buffer.length > DOCUMENT_EXPORT_BUDGETS.outputBytes) {
    throw new DocumentExportLimitError("output_bytes");
  }
}
