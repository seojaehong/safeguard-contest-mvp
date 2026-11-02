// generate_risk_assessment 기본 생성 깊이는 한 곳에서 정한다(261101 교차 검토 N1).
// 입장 제어(withMcpProviderAdmission)와 핸들러가 서로 다른 기본값을 쓰면 비용 판정과 실제 생성이 어긋난다.
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { GENERATE_RISK_ASSESSMENT_DEFAULT_MODE } from "@/lib/mcp-risk-assessment";

const source = readFileSync(join(process.cwd(), "app/api/mcp/[transport]/implementation.ts"), "utf8");

describe("generate_risk_assessment 기본 모드", () => {
  it("웹 기본값과 같은 enhanced 다", () => {
    expect(GENERATE_RISK_ASSESSMENT_DEFAULT_MODE).toBe("enhanced");
  });

  it("입장 제어와 핸들러가 같은 상수를 쓰고 문자열을 따로 적지 않는다", () => {
    const block = source.slice(source.indexOf("createGenerateRiskAssessmentHandler({"), source.indexOf("function uniqueReferences"));
    expect(block).toContain("defaultMode: GENERATE_RISK_ASSESSMENT_DEFAULT_MODE");
    expect(source).toContain("mode ?? GENERATE_RISK_ASSESSMENT_DEFAULT_MODE");
    expect(source).not.toMatch(/mode \?\? "enhanced"/u);
  });
});
