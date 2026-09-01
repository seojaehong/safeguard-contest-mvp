import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import AdmZip from "adm-zip";
import { afterEach, describe, expect, it } from "vitest";
// @ts-expect-error The operator MJS script intentionally has no declaration file.
import { HWPX_INVENTORY_BUDGETS, listZipEntries } from "../scripts/hwpx_template_inventory.mjs";

const tempRoots: string[] = [];

function tempFile(name: string): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "safeclaw-hwpx-inventory-"));
  tempRoots.push(root);
  return path.join(root, name);
}

function archive(entries: Array<[string, string]>, comment = ""): Buffer {
  const zip = new AdmZip(undefined, { noSort: true });
  for (const [name, content] of entries) zip.addFile(name, Buffer.from(content, "utf8"));
  if (comment) zip.addZipComment(comment);
  return zip.toBuffer();
}

function eocdOffset(buffer: Buffer): number {
  for (let offset = buffer.length - 22; offset >= 0; offset -= 1) {
    if (buffer.readUInt32LE(offset) === 0x06054b50) return offset;
  }
  throw new Error("Fixture EOCD missing");
}

afterEach(() => {
  for (const root of tempRoots.splice(0)) fs.rmSync(root, { recursive: true, force: true });
});

describe("bounded HWPX template inventory", () => {
  it("reads only valid central-directory metadata and accepts EOCD comments", () => {
    const filePath = tempFile("normal.hwpx");
    fs.writeFileSync(filePath, archive([
      ["mimetype", "application/hwp+zip"],
      ["Contents/section0.xml", "<hp:t>작업계획</hp:t>"],
    ], "inventory fixture"));

    const result = listZipEntries(filePath);
    expect(result.ok).toBe(true);
    expect(result.entries.map((entry: { name: string }) => entry.name))
      .toEqual(["mimetype", "Contents/section0.xml"]);
    expect(result.bytes).toBe(fs.statSync(filePath).size);
    expect(result.modifiedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/u);
  });

  it("rejects an oversized sparse candidate before whole-file materialization", () => {
    const filePath = tempFile("oversized.hwpx");
    fs.writeFileSync(filePath, Buffer.alloc(0));
    fs.truncateSync(filePath, HWPX_INVENTORY_BUDGETS.inputBytes + 1);

    expect(listZipEntries(filePath)).toMatchObject({
      ok: false,
      entries: [],
      error: expect.stringContaining("exceeds the byte budget"),
      bytes: HWPX_INVENTORY_BUDGETS.inputBytes + 1,
    });
  });

  it("keeps large valid operator templates when their metadata stays bounded", () => {
    const filePath = tempFile("large-valid.hwpx");
    const zip = new AdmZip(undefined, { noSort: true });
    zip.addFile("mimetype", Buffer.from("application/hwp+zip", "utf8"));
    zip.addFile("BinData/payload.bin", Buffer.alloc(9 * 1024 * 1024, 0x41));
    const payload = zip.getEntry("BinData/payload.bin");
    if (!payload) throw new Error("Fixture payload entry missing");
    payload.header.method = 0;
    const bytes = zip.toBuffer();
    expect(bytes.length).toBeGreaterThan(8 * 1024 * 1024);
    fs.writeFileSync(filePath, bytes);

    expect(listZipEntries(filePath)).toMatchObject({
      ok: true,
      error: "",
      bytes: bytes.length,
    });
  });

  it("rejects ZIP64 and multi-disk metadata", () => {
    const zip64Path = tempFile("zip64.hwpx");
    const zip64 = archive([["mimetype", "application/hwp+zip"]]);
    zip64.writeUInt32LE(0xffffffff, eocdOffset(zip64) + 12);
    fs.writeFileSync(zip64Path, zip64);
    expect(listZipEntries(zip64Path).error).toContain("zip64 central directories");

    const multiDiskPath = tempFile("multi-disk.hwpx");
    const multiDisk = archive([["mimetype", "application/hwp+zip"]]);
    multiDisk.writeUInt16LE(1, eocdOffset(multiDisk) + 4);
    fs.writeFileSync(multiDiskPath, multiDisk);
    expect(listZipEntries(multiDiskPath).error).toContain("multi-disk");
  });

  it("rejects truncated or inconsistent central directories without partial entries", () => {
    const countPath = tempFile("count-mismatch.hwpx");
    const countMismatch = archive([["mimetype", "application/hwp+zip"]]);
    const countEocd = eocdOffset(countMismatch);
    countMismatch.writeUInt16LE(2, countEocd + 8);
    countMismatch.writeUInt16LE(2, countEocd + 10);
    fs.writeFileSync(countPath, countMismatch);
    expect(listZipEntries(countPath)).toMatchObject({
      ok: false,
      entries: [],
      error: expect.stringContaining("count mismatch"),
    });

    const truncatedPath = tempFile("truncated.hwpx");
    const truncated = archive([["mimetype", "application/hwp+zip"]]);
    const truncatedEocd = eocdOffset(truncated);
    truncated.writeUInt32LE(truncated.readUInt32LE(truncatedEocd + 12) + 1, truncatedEocd + 12);
    fs.writeFileSync(truncatedPath, truncated);
    expect(listZipEntries(truncatedPath)).toMatchObject({
      ok: false,
      entries: [],
      error: expect.stringContaining("bounds are invalid"),
    });
  });

  it("rejects central-directory and entry-count budgets from EOCD metadata", () => {
    const directoryPath = tempFile("directory-budget.hwpx");
    const directoryBudget = archive([["mimetype", "application/hwp+zip"]]);
    directoryBudget.writeUInt32LE(
      HWPX_INVENTORY_BUDGETS.centralDirectoryBytes + 1,
      eocdOffset(directoryBudget) + 12,
    );
    fs.writeFileSync(directoryPath, directoryBudget);
    expect(listZipEntries(directoryPath).error).toContain("central directory exceeds the byte budget");

    const countPath = tempFile("entry-budget.hwpx");
    const entryBudget = archive([["mimetype", "application/hwp+zip"]]);
    const entryEocd = eocdOffset(entryBudget);
    entryBudget.writeUInt16LE(HWPX_INVENTORY_BUDGETS.archiveEntries + 1, entryEocd + 8);
    entryBudget.writeUInt16LE(HWPX_INVENTORY_BUDGETS.archiveEntries + 1, entryEocd + 10);
    fs.writeFileSync(countPath, entryBudget);
    expect(listZipEntries(countPath).error).toContain("entry count exceeds the budget");
  });
});
