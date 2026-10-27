import path from "node:path";
import { describe, expect, it } from "vitest";
// @ts-expect-error -- 타입 선언 없는 저장소 스크립트(.mjs)
import { FIX_HINT, findCrlfShebangs } from "../scripts/check_shebang_lf.mjs";

describe("셔뱅 파일은 작업본에서도 LF (/correct 261027)", () => {
  it("CRLF 로 꺼내 둔 셔뱅 파일이 없다", () => {
    const { shebangs, offenders } = findCrlfShebangs(path.resolve(__dirname, ".."));
    expect(shebangs).toBeGreaterThan(10);
    expect(offenders, FIX_HINT).toEqual([]);
  });
});
