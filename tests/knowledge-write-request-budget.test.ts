import { NextRequest } from "next/server";
import { describe, expect, it, vi } from "vitest";

import { KNOWLEDGE_WRITE_REQUEST_MAX_BYTES } from "@/lib/public-work-budget";

const mocks = vi.hoisted(() => ({
  createSupabaseAdminClient: vi.fn(),
  getWorkspaceUser: vi.fn(),
}));

vi.mock("@/lib/supabase-admin", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/supabase-admin")>();
  return {
    ...actual,
    createSupabaseAdminClient: mocks.createSupabaseAdminClient,
    getWorkspaceUser: mocks.getWorkspaceUser,
  };
});

function oversizedRequest(path: string): NextRequest {
  return new NextRequest(`http://localhost${path}`, {
    method: "POST",
    headers: {
      authorization: "Bearer fixture",
      "content-length": "1",
      "content-type": "application/json",
    },
    body: "x".repeat(KNOWLEDGE_WRITE_REQUEST_MAX_BYTES + 1),
  });
}

describe("knowledge write request body budget", () => {
  it.each([
    ["/api/knowledge/ingest", () => import("@/app/api/knowledge/ingest/route")],
    ["/api/knowledge/review", () => import("@/app/api/knowledge/review/route")],
    ["/api/knowledge/review/prepare", () => import("@/app/api/knowledge/review/prepare/route")],
  ] as const)("rejects oversized authenticated %s bodies before storage mutation", async (path, loadRoute) => {
    mocks.createSupabaseAdminClient.mockClear();
    mocks.getWorkspaceUser.mockClear();
    mocks.createSupabaseAdminClient.mockReturnValue({});
    mocks.getWorkspaceUser.mockResolvedValue({ id: "reviewer-1", email: null });
    const { POST } = await loadRoute();

    const response = await POST(oversizedRequest(path));
    const payload = await response.json() as { code: string; limit: number };

    expect(response.status).toBe(413);
    expect(payload).toMatchObject({
      code: "AUTHENTICATED_JSON_BODY_TOO_LARGE",
      limit: KNOWLEDGE_WRITE_REQUEST_MAX_BYTES,
    });
    expect(mocks.createSupabaseAdminClient).toHaveBeenCalledOnce();
    expect(mocks.getWorkspaceUser).toHaveBeenCalledOnce();
  });
});
