import {
  PDFDict,
  PDFDocument,
  PDFName,
  PDFRawStream,
  PDFRef,
  decodePDFRawStream
} from "pdf-lib";

export const SFNT_CHECKSUM_MAGIC = 0xb1b0afba;

export type SfntTableChecksum = {
  tag: string;
  stored: number;
  calculated: number;
};

export type SfntChecksumValidation = {
  tableChecksums: SfntTableChecksum[];
  actualCheckSumAdjustment: number;
  expectedCheckSumAdjustment: number;
  wholeFontChecksum: number;
};

function alignToFour(value: number): number {
  return (value + 3) & ~3;
}

function assertRange(font: Buffer, offset: number, length: number, label: string): void {
  if (
    !Number.isSafeInteger(offset)
    || !Number.isSafeInteger(length)
    || offset < 0
    || length < 0
    || offset + length > font.length
  ) {
    throw new Error(`Invalid sfnt ${label} range`);
  }
}

export function calculateSfntChecksum(value: Uint8Array): number {
  const bytes = Buffer.from(value);
  let checksum = 0;
  const paddedLength = alignToFour(bytes.length);
  for (let offset = 0; offset < paddedLength; offset += 4) {
    let word = 0;
    for (let index = 0; index < 4; index += 1) {
      word = ((word << 8) | (bytes[offset + index] ?? 0)) >>> 0;
    }
    checksum = (checksum + word) >>> 0;
  }
  return checksum;
}

export function validateSfntChecksums(value: Uint8Array): SfntChecksumValidation {
  const font = Buffer.from(value);
  assertRange(font, 0, 12, "header");
  const tableCount = font.readUInt16BE(4);
  assertRange(font, 0, 12 + tableCount * 16, "table directory");

  const tableChecksums: SfntTableChecksum[] = [];
  let headOffset = -1;
  for (let index = 0; index < tableCount; index += 1) {
    const recordOffset = 12 + index * 16;
    const tag = font.toString("ascii", recordOffset, recordOffset + 4);
    const stored = font.readUInt32BE(recordOffset + 4);
    const tableOffset = font.readUInt32BE(recordOffset + 8);
    const tableLength = font.readUInt32BE(recordOffset + 12);
    assertRange(font, tableOffset, tableLength, `table ${tag}`);
    const table = Buffer.from(font.subarray(tableOffset, tableOffset + tableLength));
    if (tag === "head") {
      assertRange(table, 0, 12, "head table");
      headOffset = tableOffset;
      table.writeUInt32BE(0, 8);
    }
    tableChecksums.push({ tag, stored, calculated: calculateSfntChecksum(table) });
  }
  if (headOffset < 0) throw new Error("sfnt head table is missing");

  const actualCheckSumAdjustment = font.readUInt32BE(headOffset + 8);
  const zeroedFont = Buffer.from(font);
  zeroedFont.writeUInt32BE(0, headOffset + 8);
  const expectedCheckSumAdjustment = (SFNT_CHECKSUM_MAGIC - calculateSfntChecksum(zeroedFont)) >>> 0;

  return {
    tableChecksums,
    actualCheckSumAdjustment,
    expectedCheckSumAdjustment,
    wholeFontChecksum: calculateSfntChecksum(font)
  };
}

export async function extractFinalFontFile2Streams(pdfBytes: Uint8Array): Promise<Uint8Array[]> {
  const document = await PDFDocument.load(pdfBytes);
  const fontFileKey = PDFName.of("FontFile2");
  const seen = new Set<string>();
  const fonts: Uint8Array[] = [];

  for (const [, object] of document.context.enumerateIndirectObjects()) {
    if (!(object instanceof PDFDict)) continue;
    const fontFileReference = object.get(fontFileKey);
    if (!(fontFileReference instanceof PDFRef)) continue;
    const referenceKey = fontFileReference.toString();
    if (seen.has(referenceKey)) continue;
    const stream = document.context.lookup(fontFileReference);
    if (!(stream instanceof PDFRawStream)) {
      throw new Error(`FontFile2 ${referenceKey} is not a raw PDF stream`);
    }
    seen.add(referenceKey);
    fonts.push(decodePDFRawStream(stream).decode());
  }

  return fonts;
}
