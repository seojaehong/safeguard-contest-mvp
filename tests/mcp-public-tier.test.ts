// 261112 — 토큰 없이 열어 주는 공개 티어. 재홍님 지시 「문제없이 공개 가능하게」.
//
// 이 검사가 고정하는 것은 둘이다.
//   ① 테넌트 데이터에 닿는 도구는 공개 스코프에 **없다**
//   ② 공급자(모델) fanout 가중치가 있는 도구도 공개 스코프에 **없다**
// 둘 중 하나라도 새면 남의 현장이 보이거나 우리 모델 비용이 나간다.
import { describe, expect, it } from "vitest";

import {
  buildPublicContext,
  isMcpToolAllowed,
  MCP_TOOL_NAMES,
  PUBLIC_MCP_TOOL_SCOPES,
  type McpToolName,
} from "@/lib/mcp-auth";
import { MCP_READ_PROVIDER_ADMISSION_POLICY } from "@/lib/mcp-provider-admission";

/** 결과를 현장·조직에 귀속해 읽거나 저장하는 도구. 공개로 열면 안 된다. */
const TENANT_TOOLS: McpToolName[] = [
  "generate_safety_docpack",
  "generate_reviewed_safety_docpack",
  "qa_review_docpack",
  "run_safeclaw_harness_agent",
];

const context = buildPublicContext("test-identity");

describe("MCP 공개 티어", () => {
  it("공개 컨텍스트에는 현장·조직·토큰이 없다", () => {
    expect(context.source).toBe("public");
    expect(context.siteId).toBeNull();
    expect(context.orgId).toBeNull();
    expect(context.tokenId).toBeNull();
  });

  it("와일드카드·광역 스코프를 주지 않는다", () => {
    expect(context.scopes).not.toContain("tools:*");
    expect(context.scopes).not.toContain("tools:read");
    expect(context.scopes).not.toContain("tools:write");
    for (const scope of context.scopes) expect(scope).toMatch(/^tools:[a-z_]+$/u);
  });

  it("테넌트 데이터에 닿는 도구는 막힌다", () => {
    for (const tool of TENANT_TOOLS) {
      expect(isMcpToolAllowed(context, tool), tool).toBe(false);
    }
  });

  it("공급자 fanout 가중치가 있는 도구는 막힌다", () => {
    for (const tool of Object.keys(MCP_READ_PROVIDER_ADMISSION_POLICY.weights)) {
      expect(isMcpToolAllowed(context, tool as McpToolName), tool).toBe(false);
    }
  });

  it("공개 스코프에 적힌 도구는 실재하는 도구 이름이다", () => {
    for (const scope of PUBLIC_MCP_TOOL_SCOPES) {
      const name = scope.replace(/^tools:/u, "");
      expect(MCP_TOOL_NAMES as readonly string[], scope).toContain(name);
    }
  });

  it("허용 목록에 없는 도구는 전부 막힌다", () => {
    const allowed = new Set(PUBLIC_MCP_TOOL_SCOPES.map((s) => s.replace(/^tools:/u, "")));
    for (const tool of MCP_TOOL_NAMES) {
      expect(isMcpToolAllowed(context, tool), tool).toBe(allowed.has(tool));
    }
  });
});
