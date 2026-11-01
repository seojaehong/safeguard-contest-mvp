// 한글 위험성평가 본표 머리 행 설정과 주석(261101 교차 검토 N2).
// - 머리 행 표시(isHeader)·머리 행 반복(repeatHeader) 호출 결과를 열 너비처럼 확인한다(실패를 조용히 넘기지 않는다).
// - 용지 주석은 실제 값(A3 가로)과 같아야 한다.
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const source = readFileSync(join(process.cwd(), "lib/document-export-hwp.ts"), "utf8");

describe("한글 본표 머리 행", () => {
  it("isHeader·repeatHeader 결과를 parseJsonResult 로 확인한다", () => {
    expect(source).toMatch(/parseJsonResult\(document\.setCellProperties\([^)]*isHeader/u);
    expect(source).toMatch(/parseJsonResult\(document\.setTableProperties\([^)]*repeatHeader/u);
  });

  it("칸 글 넣기 호출 뒤에 다른 문장이 같은 줄에 붙어 있지 않다", () => {
    expect(source).not.toMatch(/insertTextInCell\([^\n]*\);[ \t]+\S/u);
  });

  it("위험성평가 용지 주석은 A3 가로다", () => {
    expect(source).not.toMatch(/본표\(13칸\)는 엑셀처럼 A4 가로/u);
    expect(source).toMatch(/본표\(13칸\)는 엑셀처럼 A3 가로/u);
  });
});
