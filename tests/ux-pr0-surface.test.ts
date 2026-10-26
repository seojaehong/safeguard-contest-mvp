import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// UX 권고 PR-0 (evaluation/launch-depth-audit-2026-10-25/ux-direction-261026.md ⑥ PR-0 행).
// 화면 문구·배치를 소스 문자열로 고정한다. 렌더 계약은 workspace-layout-regression 이 본다.

const root = process.cwd();
const read = (relativePath: string) => readFileSync(join(root, relativePath), "utf8");

function sliceBetween(source: string, startMarker: string, endMarker: string): string {
  const start = source.indexOf(startMarker);
  expect(start, `missing ${startMarker}`).toBeGreaterThanOrEqual(0);
  const end = source.indexOf(endMarker, start);
  expect(end, `missing ${endMarker}`).toBeGreaterThan(start);
  return source.slice(start, end);
}

describe("③ 결과 머리 문구와 확인 항목 위치", () => {
  const workspace = read("components/SafeGuardCommandCenter.tsx");

  it("replaces 「안전 문서팩 3종 준비 완료」 with 「확인할 항목을 먼저 보세요」", () => {
    expect(workspace).not.toContain("안전 문서팩 3종 준비 완료");
    expect(workspace).toContain('"확인할 항목을 먼저 보세요"');
  });

  it("puts review_required and the revalidation button right under the head, before the busy indicator", () => {
    const head = workspace.indexOf('className="compact-head document-workbench-head"');
    const reviewRequired = workspace.indexOf('data-task-classification="review_required"');
    const revalidate = workspace.indexOf('"편집본 재검증"');
    const busy = workspace.indexOf('className="generation-focus"');
    expect(head).toBeGreaterThanOrEqual(0);
    expect(reviewRequired).toBeGreaterThan(head);
    expect(revalidate).toBeGreaterThan(head);
    expect(busy).toBeGreaterThan(reviewRequired);
    expect(busy).toBeGreaterThan(revalidate);
    expect(workspace.split('"편집본 재검증"').length, "revalidation button rendered once").toBe(2);
  });

  it("keeps the Playwright wait text in sync with the new head copy", () => {
    const layout = read("tests/workspace-layout-regression.test.ts");
    expect(layout).not.toContain("안전 문서팩 3종 준비 완료");
    expect(layout).toContain("확인할 항목을 먼저 보세요");
  });
});

describe("② 머리 아래 확인 블록 (본문 details 는 접힌 채 둔다)", () => {
  const workspace = read("components/SafeGuardCommandCenter.tsx");

  it("renders the check-first block between the head and the safety brief", () => {
    const head = workspace.indexOf('className="compact-head document-workbench-head"');
    const block = workspace.indexOf('data-testid="document-check-first"');
    const brief = workspace.indexOf('className="safety-brief-dashboard"');
    expect(block).toBeGreaterThan(head);
    expect(brief).toBeGreaterThan(block);
    const blockSource = sliceBetween(workspace, 'data-testid="document-check-first"', 'className="generation-focus"');
    expect(blockSource).toContain('data-task-classification="review_required"');
    expect(blockSource).toContain("편집본 재검증");
    expect(blockSource).toContain("본문 바로 열기");
  });

  it("keeps the deep-review details collapsed by default and opens it from the block", () => {
    const details = sliceBetween(workspace, '<details className="document-deep-review"', ">");
    expect(details).not.toMatch(/\sopen(?:\s|=|>)/u);
    expect(details).toContain("ref={deepReviewRef}");
    expect(workspace).toContain("function openDocumentDeepReview()");
  });
});

describe("helpers", () => {
  it("sliceBetween finds a bounded region", () => {
    expect(sliceBetween("a<b>c</b>d", "<b>", "</b>")).toBe("<b>c");
  });
});
