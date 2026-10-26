// 재홍님 결정(261026): 제품이 스스로를 「안전관리자」(산안법상 선임 직책)라 부르지 않는다.
// 엔진 프롬프트·MCP 도구 설명(서버 쪽 문자열)에서 제품 자기 호칭을 막는다. 사용자 역할·법정 직책
// (「사업장 안전관리자가 확인」·서식의 안전관리자 칸)은 검사 대상이 아니다.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();

function read(relativePath: string): string {
  return readFileSync(join(root, relativePath), "utf8");
}

const engineFiles = [
  "lib/agent-loop.ts",
  "lib/ai-deliverables.ts",
  "app/api/mcp/[transport]/implementation.ts",
] as const;

function countMatches(source: string, pattern: RegExp): number {
  return [...source.matchAll(new RegExp(pattern.source, `${pattern.flags.replace("g", "")}g`))].length;
}

describe("엔진 프롬프트·도구 설명의 제품 자기 호칭 제거", () => {
  for (const file of engineFiles) {
    it(`${file} — 「당신은 … 안전관리자」 페르소나 선언이 없다`, () => {
      expect(countMatches(read(file), /당신은[^\n]{0,40}안전관리자/u)).toBe(0);
    });

    it(`${file} — 「상주/AI 안전관리자」 호칭이 없다`, () => {
      expect(countMatches(read(file), /(상주|AI) 안전관리자/u)).toBe(0);
    });

    it(`${file} — 「안전관리자 에이전트」 호칭이 없다`, () => {
      expect(countMatches(read(file), /안전관리자 에이전트/u)).toBe(0);
    });
  }

  it("클로 채팅 기본 프롬프트는 「안전 문서 작성을 돕는」 보조로 자신을 소개한다", () => {
    expect(read("lib/agent-loop.ts")).toContain("안전 문서 작성을 돕는");
  });

  it("문서팩 페르소나는 자격·직책 사칭 없이 「안전 문서 초안을 쓰는 보조」로 선언한다", () => {
    expect(read("lib/ai-deliverables.ts")).toContain("현장 안전 문서 초안을 쓰는 보조");
  });
});
