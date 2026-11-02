// 본문 예산(enforceMcpRequestBodyBudget)이 요청을 new Request(...) 로 다시 만들 때 withMcpAuth 가 붙인
// req.auth 가 사라지면 모든 도구 호출이 MCP_TOOL_FORBIDDEN 이 된다(261101 로컬 실측 — 기존 도구까지 전부 거부).
// 진짜 mcp-handler 의 withMcpAuth 처럼 req.auth 를 붙이는 대역으로, 실제 mcp 처리기까지 auth 가 닿는지 본다.
import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  seenAuth: [] as unknown[],
  resolveMcpAuth: vi.fn(),
}));

vi.mock("mcp-handler", () => ({
  createMcpHandler: vi.fn(() => async (request: Request) => {
    mocks.seenAuth.push((request as Request & { auth?: unknown }).auth);
    return Response.json({ ok: true });
  }),
  // node_modules/mcp-handler 의 withMcpAuth 와 같이 검증 결과를 req.auth 에 싣고 넘긴다.
  withMcpAuth: vi.fn((handler: (request: Request) => Promise<Response>, verify: (
    request: Request,
    bearerToken?: string,
  ) => Promise<unknown>) => async (request: Request) => {
    const bearer = request.headers.get("authorization")?.replace(/^Bearer\s+/iu, "").trim();
    const auth = await verify(request, bearer);
    if (!auth) return Response.json({ error: "Unauthorized" }, { status: 401 });
    Object.assign(request, { auth });
    return handler(request);
  }),
}));

vi.mock("@/lib/mcp-auth", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/mcp-auth")>()),
  isMcpEnabled: vi.fn(() => true),
  resolveMcpAuth: mocks.resolveMcpAuth,
}));

vi.mock("@/lib/supabase-admin", () => ({
  createSupabaseAdminClient: vi.fn(() => null),
}));

import { handler } from "@/app/api/mcp/[transport]/implementation";

describe("MCP 인증 정보 전달", () => {
  it("본문 예산을 지난 뒤에도 mcp 처리기가 req.auth(토큰 범위)를 받는다", async () => {
    mocks.resolveMcpAuth.mockResolvedValue({ siteId: null, orgId: null, scopes: ["tools:*"], source: "env", tokenId: null });
    const response = await handler(new Request("http://127.0.0.1/api/mcp/mcp", {
      method: "POST",
      headers: {
        Authorization: "Bearer local-test-token",
        "Content-Type": "application/json",
        "X-Forwarded-For": "198.51.100.7",
      },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list", params: {} }),
    }));
    expect(response.status).toBe(200);
    expect(mocks.seenAuth).toHaveLength(1);
    expect(mocks.seenAuth[0]).toMatchObject({
      clientId: "safeclaw-mcp",
      scopes: ["tools:*"],
      extra: expect.objectContaining({ source: "env", scopes: ["tools:*"] }),
    });
  });
});
