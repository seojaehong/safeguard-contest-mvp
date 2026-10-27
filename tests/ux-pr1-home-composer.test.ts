import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { fieldExamples } from "@/lib/field-examples";
import { LANDING_EXAMPLE_CHIPS, shouldAutoGenerate } from "@/lib/workspace-autogenerate";

// UX 권고 PR-1 (evaluation/launch-depth-audit-2026-10-25/ux-direction-261026.md ⑤·⑥ PR-1 행, ⑦ 결정 ①).
// 첫 화면(/)을 소스 문자열로 고정한다. 렌더(390px 가로 넘침·textarea 노출)는 Playwright 실측이 본다.

const root = process.cwd();
const read = (relativePath: string) => readFileSync(join(root, relativePath), "utf8");
const FORBIDDEN_USER_FACING = /상담|진단|판정|지도|대리|자문|노무사/u;

describe("① 입력 폼 (Server Component · 클라이언트 JS 0)", () => {
  const landing = read("components/SafeClawLanding.tsx");

  it("renders a GET form to /workspace with a 600-char textarea named q", () => {
    expect(landing).toContain("<textarea");
    expect(landing).toContain('name="q"');
    expect(landing).toContain("maxLength={600}");
    expect(landing).toContain("rows={3}");
    expect(landing).toContain('action="/workspace"');
    expect(landing).toContain('method="get"');
    expect(landing).toContain('type="submit"');
    expect(landing).toContain("보내기");
    expect(landing).toContain("예: 서울 ○○현장, 비계 해체 6명, 강풍 예보, 외국인 2명");
  });

  it("stays a Server Component (no client directive, no handlers, no inline styles)", () => {
    expect(landing).not.toMatch(/^["']use client["']/mu);
    expect(landing).not.toMatch(/on[A-Z][a-zA-Z]*=\{/u);
    expect(landing).not.toMatch(/style=\{\{/u);
  });

  it("does not ship the photo tray — only a one-line notice", () => {
    expect(landing).not.toContain('type="file"');
    expect(landing).not.toContain("사진 0/10");
    expect(landing).toContain("사진은 문서를 만든 뒤 작업공간에서 첨부할 수 있습니다.");
  });

  it("shows the same anonymous downgrade sentence as the server admission", () => {
    expect(landing).toContain('from "@/lib/ask-mode-messages"');
    expect(landing).toContain("{ANONYMOUS_MESSAGE}");
  });
});

describe("② 예시 칩 3 — 기존 field-examples 만, PR-0 옵트인 경로", () => {
  it("defines exactly three chips whose ids exist in fieldExamples", () => {
    expect(LANDING_EXAMPLE_CHIPS).toHaveLength(3);
    const ids = new Set(fieldExamples.map((example) => example.id));
    for (const chip of LANDING_EXAMPLE_CHIPS) {
      expect(ids.has(chip.id), `unknown example id ${chip.id}`).toBe(true);
      expect(chip.href).toBe(`/workspace?scenario=${chip.id}&autogen=1`);
      expect(chip.label).not.toMatch(FORBIDDEN_USER_FACING);
    }
    expect(LANDING_EXAMPLE_CHIPS.map((chip) => chip.id)).toEqual([
      "seoul-construction-windy",
      "daegu-warehouse-heat",
      "ansan-manufacturing-foreign-hotwork",
    ]);
    expect(LANDING_EXAMPLE_CHIPS.map((chip) => chip.label)).toEqual(["외벽 도장·비계·강풍", "창고 적재·폭염", "용접 화기·외국인"]);
  });

  it("every chip href auto-generates and the landing renders the constant (autogen=1 ×3 at runtime)", () => {
    const hrefs = LANDING_EXAMPLE_CHIPS.map((chip) => chip.href);
    expect(hrefs.join("\n").match(/autogen=1/gu)?.length ?? 0).toBe(3);
    for (const chip of LANDING_EXAMPLE_CHIPS) {
      const params = Object.fromEntries(new URL(chip.href, "http://localhost").searchParams);
      expect(shouldAutoGenerate(params)).toBe(true);
    }
    const landing = read("components/SafeClawLanding.tsx");
    expect(landing).toContain("LANDING_EXAMPLE_CHIPS");
    expect(landing).not.toContain("autogen=1");
    expect(landing).not.toContain("WORKSPACE_SAMPLE_AUTOGENERATE_HREF");
  });
});

describe("③ 지운 것 — 콘솔 리플레이·점프 버튼·상태 띠·§01~§06", () => {
  const landing = read("components/SafeClawLanding.tsx");

  it("no longer imports HeroConsoleReplay or JumpButton", () => {
    expect(landing).not.toContain("HeroConsoleReplay");
    expect(landing).not.toContain("JumpButton");
  });

  it("removed the status band and the six numbered sections", () => {
    expect(landing).not.toContain("safeclaw-os-status");
    expect(landing).not.toContain("REGION");
    expect(landing).not.toContain("PUBLIC API");
    expect(landing).not.toContain("§ 0");
    expect(landing.match(/<section\b/gu)?.length ?? 0).toBe(2);
    expect(landing.match(/<h2\b/gu)?.length ?? 0).toBe(1);
    expect(landing).toContain("어떻게 만들어지나");
    for (const step of ["입력", "근거 대조", "작업팩", "인쇄"]) expect(landing).toContain(step);
  });

  it("deletes the two components whose only consumer was the landing", () => {
    expect(existsSync(join(root, "components/HeroConsoleReplay.tsx"))).toBe(false);
    expect(existsSync(join(root, "components/JumpButton.tsx"))).toBe(false);
  });
});

describe("④ 문구 — 금지어 0·자기 호칭 0·「문서팩 보기」 0", () => {
  const landing = read("components/SafeClawLanding.tsx");

  it("keeps the h1, the tag line, the two pinned sentences and the footer trio", () => {
    expect(landing).toContain("오늘 작업을 한 줄로 적으면");
    expect(landing).toContain("안전 서식을 만들고 근거와 맞춥니다.");
    expect(landing).toContain("산업안전 · 현장 문서");
    expect(landing).toContain("현장관리자의 문서 준비를 돕습니다");
    expect(landing).toContain("안전 판단과 최종 확인은 사람이 맡습니다.");
    expect(landing).toContain('href="/evidence"');
    expect(landing).toContain('href="/privacy"');
    expect(landing).toContain('href="/login"');
    expect(landing).toContain("근거 원문");
    expect(landing).toContain("개인정보");
  });

  it("has no forbidden user-facing words", () => {
    expect(landing).not.toContain("문서팩 보기");
    expect(landing).not.toContain("안전관리자");
    const jsxText = landing.replace(/^import .*$/gmu, "").replace(/\/\/.*$/gmu, "").replace(/\/\*[\s\S]*?\*\//gu, "");
    expect(jsxText).not.toMatch(FORBIDDEN_USER_FACING);
  });
});

describe("⑤ 공용 훅 6종 (frontend-shared-surfaces 와 같은 계약)", () => {
  it("keeps every shared hook on the new landing", () => {
    const landing = read("components/SafeClawLanding.tsx");
    for (const hook of [
      "safeclaw-shared-header",
      "safeclaw-shared-navigation",
      "safeclaw-shared-page-title",
      "safeclaw-shared-description",
      "safeclaw-shared-action",
      "safeclaw-shared-card",
    ]) {
      expect(landing).toContain(hook);
    }
    expect(landing).toContain('className="safeclaw-landing"');
    expect(landing).toContain("export function SafeClawLanding");
  });
});
