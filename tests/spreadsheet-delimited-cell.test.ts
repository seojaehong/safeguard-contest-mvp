import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  encodeSpreadsheetDelimitedCell,
  neutralizeSpreadsheetFormula
} from "@/lib/spreadsheet-delimited-cell";

describe("spreadsheet delimited cell safety", () => {
  it.each([
    ["=2+3", "'=2+3"],
    [" +SUM(A1)", "' +SUM(A1)"],
    ["\t@SUM(A1)", "'\t@SUM(A1)"],
    ["  \r-1+1", "'  \r-1+1"]
  ])("neutralizes formula-capable input %j", (input, expected) => {
    expect(neutralizeSpreadsheetFormula(input)).toBe(expected);
  });

  it("preserves ordinary Korean text and CSV quoting semantics", () => {
    expect(encodeSpreadsheetDelimitedCell("현장, 안전 \"확인\"", ","))
      .toBe('"현장, 안전 ""확인"""');
    expect(encodeSpreadsheetDelimitedCell("  일반 현장", ","))
      .toBe("  일반 현장");
  });

  it("neutralizes before preserving existing TSV cleanup semantics", () => {
    expect(encodeSpreadsheetDelimitedCell("\t=2+3\r\n다음 줄", "\t"))
      .toBe("' =2+3 다음 줄");
  });

  it("routes every WorkpackEditor CSV and TSV sink through the shared encoder", () => {
    const source = fs.readFileSync(
      path.join(process.cwd(), "components", "WorkpackEditor.tsx"),
      "utf8"
    );

    expect(source).toContain("encodeSpreadsheetDelimitedCell(value, delimiter)");
    expect(source.match(/buildDelimited\(rows, ","\)/gu)).toHaveLength(2);
    expect(source.match(/buildDelimited\(rows, "\\t"\)/gu)).toHaveLength(2);
    expect(source).not.toContain("function escapeCell");
  });
});
