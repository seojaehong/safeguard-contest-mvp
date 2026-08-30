import AdmZip from "adm-zip";
import { describe, expect, it } from "vitest";
// @ts-expect-error The operator MJS script intentionally has no declaration file.
import { anonymizeHwpxArchive, assertSafeHwpxArchiveEntry, HWPX_ANONYMIZATION_BUDGETS } from "../scripts/anonymize_hwpx_templates.mjs";

function archive(entries: Array<[string, string]>): Buffer {
  const zip = new AdmZip(undefined, { noSort: true });
  zip.addFile("mimetype", Buffer.from("application/hwp+zip", "utf8"));
  const mimetype = zip.getEntry("mimetype");
  if (!mimetype) throw new Error("Fixture mimetype entry missing");
  mimetype.header.method = 0;
  for (const [name, content] of entries) {
    zip.addFile(name, Buffer.from(content, "utf8"));
  }
  return zip.toBuffer();
}

describe("HWPX anonymization archive admission", () => {
  it("transforms text in-process and preserves the mimetype-first contract", () => {
    const input = archive([
      ["Contents/section0.xml", "<hp:t>일반 작업계획</hp:t>"],
      ["Contents/header.xml", "<hp:t>고객사 문서</hp:t>"]
    ]);
    const result = anonymizeHwpxArchive(input, [["고객사", "__COMPANY__"]]);
    const output = new AdmZip(result.output, { noSort: true });
    const outputEntries = output.getEntries();

    expect(outputEntries[0].entryName).toBe("mimetype");
    expect(outputEntries[0].header.method).toBe(0);
    expect(output.readAsText("Contents/section0.xml")).toContain("[__COMPANY__ 현장]");
    expect(output.readAsText("Contents/header.xml")).not.toContain("고객사");
    expect(result.receipt).toMatchObject({
      entryCount: 3,
      touchedFiles: 2,
      totalReplacements: 1,
      injectedPlaceholder: true
    });
  });

  it("rejects traversal and symlink member identities before extraction", () => {
    expect(() => assertSafeHwpxArchiveEntry("../outside.xml")).toThrow("Unsafe HWPX archive entry path");
    expect(() => assertSafeHwpxArchiveEntry("Contents/link.xml", 0xa000 << 16)).toThrow("symlink entry is not allowed");
  });

  it("rejects archives above the member budget before transformation", () => {
    const entries: Array<[string, string]> = Array.from(
      { length: HWPX_ANONYMIZATION_BUDGETS.archiveEntries },
      (_, index) => [`Contents/item-${index}.xml`, "<hp:t>bounded</hp:t>"]
    );
    expect(() => anonymizeHwpxArchive(archive(entries))).toThrow("entry-count budget");
  });

  it("rejects compressed expansion above the per-entry budget before text decoding", () => {
    const oversizedText = "x".repeat(HWPX_ANONYMIZATION_BUDGETS.archiveEntryUncompressedBytes + 1);
    const input = archive([["Contents/section0.xml", oversizedText]]);

    expect(input.length).toBeLessThan(HWPX_ANONYMIZATION_BUDGETS.inputBytes);
    expect(() => anonymizeHwpxArchive(input)).toThrow("entry exceeds the uncompressed byte budget");
  });
});
