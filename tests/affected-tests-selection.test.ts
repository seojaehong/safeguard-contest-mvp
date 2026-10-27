import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
// @ts-expect-error -- 타입 선언 없는 저장소 스크립트(.mjs)
import { selectAffectedTests } from "../scripts/affected_tests.mjs";

const root = path.resolve(__dirname, "..");
const testSources = fs.readdirSync(path.join(root, "tests"))
  .filter((name) => /\.test\.(ts|tsx|mts|mjs)$/.test(name))
  .map((name) => [`tests/${name}`, fs.readFileSync(path.join(root, "tests", name), "utf8")] as const);

// PR #121(첫 화면 입력 폼)이 실제로 바꾼 파일. 그때 「바뀐 모듈 import grep」은
// 아래 두 시험을 못 골라 CI 에서 처음 실패를 봤다.
const pr121Files = [
  "app/globals.css",
  "components/HeroConsoleReplay.tsx",
  "components/JumpButton.tsx",
  "components/SafeClawLanding.tsx",
  "lib/workspace-autogenerate.ts",
];

describe("영향 시험 선택 (/correct 261027)", () => {
  it("#121 변경분에서 CSS 계약 시험과 `/` 브라우저 시험, 감사 명령을 고른다", () => {
    const { tests, commands } = selectAffectedTests(pr121Files, testSources);
    const names = tests.map(([test]: [string]) => test);
    expect(names).toContain("tests/frontend-design-contract.test.ts");
    expect(names).toContain("tests/documents-editor-layout.test.ts");
    expect(commands.join("\n")).toContain("audit:frontend-consistency");
  });

  it("경로 언급만으로는 두 시험이 안 잡힌다(=예전 방식의 구멍)", () => {
    const { tests } = selectAffectedTests(pr121Files, testSources);
    const byPath = tests
      .filter(([, reasons]: [string, Set<string>]) => [...reasons].some((reason) => reason.startsWith("경로 언급")))
      .map(([test]: [string]) => test);
    expect(byPath).not.toContain("tests/frontend-design-contract.test.ts");
    expect(byPath).not.toContain("tests/documents-editor-layout.test.ts");
  });
});
