import type { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createSupabaseAdminClient: vi.fn(),
  ensureWorkspaceContext: vi.fn(),
  getWorkspaceUser: vi.fn(),
}));

vi.mock("@/lib/supabase-admin", () => ({
  createSupabaseAdminClient: mocks.createSupabaseAdminClient,
  ensureWorkspaceContext: mocks.ensureWorkspaceContext,
  getWorkspaceUser: mocks.getWorkspaceUser,
}));

import { POST } from "@/app/api/mcp-tokens/route";
import { MCP_TOKEN_REQUEST_BODY_MAX_BYTES } from "@/lib/mcp-work-budget";

describe("MCP token issuance request budget", () => {
  beforeEach(() => {
    mocks.createSupabaseAdminClient.mockReset();
    mocks.ensureWorkspaceContext.mockReset();
    mocks.getWorkspaceUser.mockReset();
    mocks.createSupabaseAdminClient.mockReturnValue({ marker: "client" });
    mocks.getWorkspaceUser.mockResolvedValue({ id: "user-1", email: "owner@example.com" });
  });

  it("rejects an oversized authenticated body before workspace or token storage work", async () => {
    const request = new Request("https://www.safeclaw.kr/api/mcp-tokens", {
      method: "POST",
      headers: {
        Authorization: "Bearer valid-token",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ label: "가".repeat(MCP_TOKEN_REQUEST_BODY_MAX_BYTES) }),
    });

    const response = await POST(request as NextRequest);

    expect(response.status).toBe(413);
    await expect(response.json()).resolves.toMatchObject({ code: "MCP_TOKEN_PAYLOAD_TOO_LARGE" });
    expect(mocks.ensureWorkspaceContext).not.toHaveBeenCalled();
  });

  it("preserves authentication precedence for oversized anonymous requests", async () => {
    mocks.getWorkspaceUser.mockResolvedValue(null);
    const request = new Request("https://www.safeclaw.kr/api/mcp-tokens", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ label: "가".repeat(MCP_TOKEN_REQUEST_BODY_MAX_BYTES) }),
    });

    const response = await POST(request as NextRequest);

    expect(response.status).toBe(401);
    expect(mocks.ensureWorkspaceContext).not.toHaveBeenCalled();
  });
});
