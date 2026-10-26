import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { shouldAutoGenerate, WORKSPACE_SAMPLE_AUTOGENERATE_HREF } from "@/lib/workspace-autogenerate";

const root = process.cwd();
const read = (relativePath: string) => readFileSync(join(root, relativePath), "utf8");

// UX 권고 PR-0 ①: 랜딩 샘플 링크는 무클릭 생성. 시험·감사 경로(?scenario= 만)는 생성 전 상태를 유지한다.
describe("workspace auto-generate entry contract", () => {
  it("auto-generates for ?q= (landing redirect) as before", () => {
    expect(shouldAutoGenerate({ q: "서울 성수동 외벽 도장" })).toBe(true);
  });

  it("keeps ?scenario= alone as prefill only (11 Playwright entries and the audit probe expect the input page)", () => {
    expect(shouldAutoGenerate({ scenario: "seoul-construction-windy" })).toBe(false);
    expect(shouldAutoGenerate({ scenario: "seoul-construction-windy", theme: "day" })).toBe(false);
    expect(shouldAutoGenerate({})).toBe(false);
  });

  it("auto-generates for the landing sample link (?scenario=&autogen=1)", () => {
    expect(shouldAutoGenerate({ scenario: "seoul-construction-windy", autogen: "1" })).toBe(true);
    expect(shouldAutoGenerate({ scenario: "seoul-construction-windy", autogen: "0" })).toBe(false);
    expect(shouldAutoGenerate({ autogen: "1" })).toBe(false);
  });

  it("wires the landing example chips and the workspace page to the same contract", () => {
    expect(WORKSPACE_SAMPLE_AUTOGENERATE_HREF).toBe("/workspace?scenario=seoul-construction-windy&autogen=1");
    // UX PR-1(2026-10-27): 랜딩은 샘플 링크 1개 대신 예시 칩 3개(LANDING_EXAMPLE_CHIPS)를 같은 경로로 쓴다.
    expect(read("components/SafeClawLanding.tsx")).toContain("LANDING_EXAMPLE_CHIPS");
    expect(read("components/SafeClawLanding.tsx")).not.toContain('href="/workspace?scenario=seoul-construction-windy"');
    const page = read("app/workspace/page.tsx");
    expect(page).toContain("shouldAutoGenerate(params)");
    expect(page).not.toContain("autoGenerate={Boolean(params.q)}");
  });
});
