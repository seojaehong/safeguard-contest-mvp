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
  ] as const)("rejects oversized %s bodies before storage or authentication", async (path, loadRoute) => {
    mocks.createSupabaseAdminClient.mockClear();
    mocks.getWorkspaceUser.mockClear();
    const { POST } = await loadRoute();

    const response = await POST(oversizedRequest(path));
    const payload = await response.json() as { code: string; limit: number };

    expect(response.status).toBe(413);
    expect(payload).toMatchObject({
      code: "PUBLIC_WORK_BUDGET_EXCEEDED",
      limit: KNOWLEDGE_WRITE_REQUEST_MAX_BYTES,
    });
    expect(mocks.createSupabaseAdminClient).not.toHaveBeenCalled();
    expect(mocks.getWorkspaceUser).not.toHaveBeenCalled();
  });
});
