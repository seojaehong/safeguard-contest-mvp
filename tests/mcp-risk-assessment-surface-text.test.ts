// generate_risk_assessment 의 설명 글(도구 description·docs·결과 타입 주석)이 실제 산출물과 맞는가(261101 교차 검토 C5).
// JSON headers/cells 는 한글 본표 13칸이고, 엑셀 서식은 21칸이다. 엑셀에만 있는 칸은 structuredRows 에 전부 있다.
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8");
const implementation = read("app/api/mcp/[transport]/implementation.ts");
const toolBlock = implementation.slice(implementation.indexOf("\"generate_risk_assessment\","), implementation.indexOf("inputSchema", implementation.indexOf("\"generate_risk_assessment\",")));
const docsRow = read("docs/mcp-server.md").split("\n").find((line) => line.startsWith("| `generate_risk_assessment`")) ?? "";
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
