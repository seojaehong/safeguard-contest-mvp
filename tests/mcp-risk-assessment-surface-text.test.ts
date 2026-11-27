// generate_risk_assessment 의 설명 글(도구 description·docs·결과 타입 주석)이 실제 산출물과 맞는가(261101 교차 검토 C5).
// JSON headers/cells 는 한글 본표 13칸이고, 엑셀 서식은 21칸이다. 엑셀에만 있는 칸은 structuredRows 에 전부 있다.
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8");
const implementation = read("app/api/mcp/[transport]/implementation.ts");
const toolBlock = implementation.slice(implementation.indexOf("\"generate_risk_assessment\","), implementation.indexOf("inputSchema", implementation.indexOf("\"generate_risk_assessment\",")));
// 🔴 docs 에는 이 이름으로 시작하는 표가 둘이다 — 공개 티어 모드 비교 표(PR #132, 261112)와 도구 명세 표.
// 접두사만 보면 먼저 오는 모드 비교 표가 집혀 261112 부터 CI 가 빨갰다. 명세 표는 둘째 칸이 `question` 이라
// 그걸로 고른다. 단언하는 말(13칸·21칸)로 고르면 시험이 자기를 증명하게 되므로 쓰지 않는다.
const docsRow = read("docs/mcp-server.md").split("\n").find((line) => line.startsWith("| `generate_risk_assessment` |") && line.includes("`question`")) ?? "";
const libSource = read("lib/mcp-risk-assessment.ts");

describe("본표 칸 수 설명", () => {
  it("도구 설명·docs 는 JSON 본표 13칸(한글 본표)과 엑셀 21칸(structuredRows 에 전부)을 구분해 적는다", () => {
    for (const text of [toolBlock, docsRow]) {
      expect(text).toMatch(/13칸/u);
      expect(text).toMatch(/21칸/u);
      expect(text).toMatch(/structuredRows/u);
    }
  });

  it("결과 타입 주석이 headers/cells 를 한글 본표 13칸으로 적는다", () => {
    const typeBlock = libSource.slice(libSource.indexOf("riskAssessment: {"), libSource.indexOf("reviewItems: {"));
    expect(typeBlock).toMatch(/13칸/u);
    expect(typeBlock).toMatch(/21칸/u);
  });
});
