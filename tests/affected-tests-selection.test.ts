import path from "node:path";
import { describe, expect, it } from "vitest";
// @ts-expect-error -- 타입 선언 없는 저장소 스크립트(.mjs)
import { loadTestSources, selectAffectedTests } from "../scripts/affected_tests.mjs";
// @ts-expect-error -- 타입 선언 없는 저장소 스크립트(.mjs)
import { canonicalFrontendIdentityFiles } from "../scripts/frontend_audit_source_identity.mjs";

type Entry = [string, Set<string>];
type Selection = { tests: Entry[]; leaveTests: Entry[]; commands: string[] };

const root = path.resolve(__dirname, "..");
const testSources: Array<[string, string]> = loadTestSources(root);
const identityFiles: string[] = canonicalFrontendIdentityFiles(root).map((file: string) =>
  path.relative(root, file).replaceAll("\\", "/"),
);
const names = (selection: Selection) => selection.tests.map(([test]) => test);

describe("영향 시험 선택 (/correct 261027)", () => {
  it("#121 변경분에서 CSS 계약 시험·브라우저 시험·감사 명령을 고른다", () => {
    const pr121Files = ["app/globals.css", "components/HeroConsoleReplay.tsx", "components/SafeClawLanding.tsx", "lib/workspace-autogenerate.ts"];
    const selection: Selection = selectAffectedTests(pr121Files, testSources, identityFiles);
    expect(names(selection)).toEqual(expect.arrayContaining([
      "tests/frontend-design-contract.test.ts",
      "tests/documents-editor-layout.test.ts",
      "tests/mixed-typography-role-contract.test.ts",
      "tests/frontend-route-coverage.test.ts",
    ]));
    expect(selection.commands.join("\n")).toContain("audit:frontend-consistency");
  });

  it("규칙 자체: CSS·화면 파일·helper·.mts 를 합성 입력으로 고정한다", () => {
    const sources: Array<[string, string]> = [
      ["tests/reads-css.test.ts", "fs.readFileSync(path.join(root, 'app', 'globals.css'))"],
      ["tests/runs-audit.test.ts", "spawnSync(node, ['scripts/frontend_consistency_audit.mjs'])"],
      ["tests/browser.test.ts", "import { start } from './helpers/isolated-next-browser-harness';"],
      ["tests/imports-ai.test.ts", "import { x } from '@/lib/ai-deliverables';"],
      ["tests/leave.crosscheck.mts", "import { y } from '../lib/annual-leave.ts';"],
    ];
    const component: Selection = selectAffectedTests(["components/Only.tsx"], sources, []);
    expect(names(component)).toEqual(["tests/browser.test.ts", "tests/runs-audit.test.ts"]);
    expect(component.commands.join("\n")).toContain("audit:frontend-consistency");

    expect(names(selectAffectedTests(["app/globals.css"], sources, []))).toContain("tests/reads-css.test.ts");
    expect(names(selectAffectedTests(["tests/helpers/isolated-next-browser-harness.ts"], sources, []))).toEqual(["tests/browser.test.ts"]);
    expect(names(selectAffectedTests(["lib/ai.ts"], sources, []))).toEqual([]);

    const leave: Selection = selectAffectedTests(["lib/annual-leave.ts"], sources, []);
    expect(leave.leaveTests.map(([test]) => test)).toEqual(["tests/leave.crosscheck.mts"]);
    expect(leave.commands.join("\n")).toContain("leave:test");
  });
});
