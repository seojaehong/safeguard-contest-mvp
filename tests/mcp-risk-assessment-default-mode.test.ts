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
    // 261112 — 공개 티어가 생겨 변수 이름이 effectiveMode 로 바뀌었다. 계약의 뜻은
    // 「기본값 문자열을 따로 적지 않는다」이므로 상수를 쓰는지만 본다.
    expect(source).toMatch(/\b(?:effective)?[Mm]ode \?\? GENERATE_RISK_ASSESSMENT_DEFAULT_MODE/u);
    expect(source).not.toMatch(/mode \?\? "enhanced"/iu);
  });

  // 261112 — 토큰 없는 호출에 enhanced·full 이 열리면 우리 모델 비용이 새어 나간다.
  // 이 검사는 「공개면 template」을 코드에서 강제하고 있는지 고정한다.
  it("공개(토큰 없음) 호출은 template 로 고정한다", () => {
    expect(source).toContain('authContext.source === "public"');
    expect(source).toMatch(/source === "public"[\s\S]{0,120}"template"/u);
    // 입장 제어와 핸들러에 **같은** 모드가 가야 한다. 둘이 어긋나면 비용 판정이 틀린다.
    expect(source).toContain("effectiveMode ?? GENERATE_RISK_ASSESSMENT_DEFAULT_MODE");
    expect(source).toContain("mode: effectiveMode");
  });
});
