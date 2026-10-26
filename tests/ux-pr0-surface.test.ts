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
    // 짧은 데스크톱(1440×723)·390px 한 화면 계약 때문에 확인 항목이 없을 때는 블록을 그리지 않는다.
    expect(workspace).toContain('(data.scenario.taskClassification?.status === "review_required" || requiresRevalidation) ? (');
  });

  it("keeps the deep-review details collapsed by default (one-screen contracts)", () => {
    const details = sliceBetween(workspace, '<details className="document-deep-review"', ">");
    expect(details).not.toMatch(/\sopen(?:\s|=|>)/u);
  });
});

describe("④ 익명 강등 사전 안내 (입력 단계)", () => {
  it("shares one message module between the server admission and the client input page", async () => {
    const messages = await import("@/lib/ask-mode-messages");
    expect(messages.ANONYMOUS_MESSAGE).toMatch(/^로그인하지 않/u);
    expect(messages.ANONYMOUS_MESSAGE).not.toMatch(/상담|진단|판정|지도|대리|자문|노무사|안전관리자/u);
    const admission = read("lib/ask-mode-admission.ts");
    expect(admission).toContain('from "@/lib/ask-mode-messages"');
    expect(admission).not.toContain("로그인하지 않은 체험에서는");
    expect(read("lib/ask-mode-messages.ts")).not.toMatch(/^import /mu);
  });

  it("shows the notice on the input page before generation, only for anonymous sessions", () => {
    const workspace = read("components/SafeGuardCommandCenter.tsx");
    expect(workspace).toContain('from "@/lib/ask-mode-messages"');
    // 1638×510 입력 화면 계약(composer.bottom ≤ viewport-8) 때문에 입력창 위가 아니라 생성 단추 아래 상태 줄에 둔다.
    // (첨부 안내 small 은 ≤720px·짧은 데스크톱에서 display:none 이라 쓸 수 없다.)
    const afterTray = sliceBetween(workspace, 'className="input-composer-tray"', 'className="field-brief-chip-row"');
    expect(afterTray).toContain('data-testid="anonymous-mode-notice"');
    expect(afterTray).toContain("{ANONYMOUS_MESSAGE}");
    expect(afterTray.indexOf('data-testid="anonymous-mode-notice"')).toBeGreaterThan(afterTray.indexOf("composer-submit-button"));
    expect(workspace).toContain("setAnonymousSession(");
  });
});

describe("⑤ 문구 교정 — 면책·자기 호칭·히어로 CTA", () => {
  it("replaces the ClawChat disclaimer and head without 「자문」 or 「안전관리자」", () => {
    const chat = read("components/ClawChat.tsx");
    expect(chat).toContain("만든 문서는 초안입니다. 최종 확인은 현장에서 사람이 합니다.");
    expect(chat).toContain("이 작업팩에 대해 묻기");
    expect(chat).not.toContain("전문가 자문");
    expect(chat).not.toContain("안전관리자");
  });

  it("stops the product calling itself 「안전관리자」 on the landing and the connect panel", () => {
    // UX PR-1(2026-10-27): HeroConsoleReplay 는 삭제됐다. 같은 금지를 새 첫 화면에 건다.
    expect(read("components/SafeClawLanding.tsx")).not.toContain("안전관리자");
    expect(read("components/AiConnectPanel.tsx")).not.toContain("안전관리자");
  });

  it("keeps one hero action (the composer submit) on the landing page and the two pinned sentences", () => {
    // UX PR-1(2026-10-27): 히어로 CTA 링크는 입력 폼의 「보내기」 하나로 바뀌었다(tests/ux-pr1-home-composer.test.ts).
    const landing = read("components/SafeClawLanding.tsx");
    const form = sliceBetween(landing, 'className="safeclaw-home-composer"', "</form>");
    expect(form.split('type="submit"').length - 1).toBe(1);
    expect(form).not.toContain("<Link");
    expect(landing).not.toContain('href="/documents"');
    expect(landing).toContain("현장관리자의 문서 준비를 돕습니다");
    expect(landing).toContain("안전 판단과 최종 확인은 사람이 맡습니다.");
  });
});

describe("⑥ 사장 코드 삭제", () => {
  it("removes SafeClawHomepage from SafeGuardCommandCenter", () => {
    expect(read("components/SafeGuardCommandCenter.tsx")).not.toContain("SafeClawHomepage");
  });
});

describe("helpers", () => {
  it("sliceBetween finds a bounded region", () => {
    expect(sliceBetween("a<b>c</b>d", "<b>", "</b>")).toBe("<b>c");
  });
});
