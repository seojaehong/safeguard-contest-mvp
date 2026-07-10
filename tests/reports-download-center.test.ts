import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const componentSource = fs.readFileSync(
  path.join(process.cwd(), "components", "ReportsDownloadCenter.tsx"),
  "utf8"
);

describe("reports download center wiring", () => {
  it("connects custom dates, six facets, photo approval, and guarded download states", () => {
    expect(componentSource).toContain('{ value: "custom", label: "사용자"');
    expect(componentSource).toContain('type="date"');
    for (const label of ["공정 필터", "작업 필터", "위험등급 필터", "개선상태 필터", "현장 필터", "팀 필터"]) {
      expect(componentSource).toContain(`aria-label="${label}"`);
    }
    expect(componentSource).toContain("Before/After 사진 포함 승인");
    expect(componentSource).toContain("resolveReportViewState");
    expect(componentSource).toContain("viewState.canDownload");
    expect(componentSource).toContain("다운로드 준비 중");
    expect(componentSource).toContain("다운로드 오류");
  });
});
