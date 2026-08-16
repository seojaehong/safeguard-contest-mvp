import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  buildPacket: vi.fn(),
  createClient: vi.fn(),
  getStatus: vi.fn(),
  getUser: vi.fn(),
  isPlatformOperator: vi.fn(),
}));

vi.mock("@/lib/supabase-admin", () => ({
  createSupabaseAdminClient: mocks.createClient,
  getWorkspaceUser: mocks.getUser,
  isPlatformOperator: mocks.isPlatformOperator,
}));
vi.mock("@/lib/sif-embedding-gate-status", () => ({
  getSifEmbeddingGateStatus: mocks.getStatus,
}));
vi.mock("@/lib/sif-embedding-approval-packet", () => ({
  buildSifEmbeddingApprovalPacket: mocks.buildPacket,
}));

function request(path: string, authenticated = false) {
  return new NextRequest(`https://www.safeclaw.kr${path}`, {
    headers: authenticated ? { authorization: "Bearer operator-token" } : {},
  });
}

beforeEach(() => {
  vi.resetModules();
  mocks.createClient.mockReset().mockReturnValue({ auth: {} });
  mocks.getUser.mockReset().mockResolvedValue(null);
  mocks.isPlatformOperator.mockReset().mockReturnValue(false);
  mocks.getStatus.mockReset().mockReturnValue({ ok: true, stage: "ready-for-approval" });
  mocks.buildPacket.mockReset().mockReturnValue({
    fileName: "sif-approval.md",
    markdown: "# approval",
  });
});

describe("SIF operator diagnostics routes", () => {
  it("rejects anonymous status requests before computing internal diagnostics", async () => {
    const { GET } = await import("@/app/api/sif-embedding-gate/status/route");

    const response = await GET(request("/api/sif-embedding-gate/status"));

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ ok: false, message: "관리자 로그인이 필요합니다." });
    expect(mocks.getStatus).not.toHaveBeenCalled();
  });

  it("rejects an authenticated tenant user before computing global status", async () => {
    mocks.getUser.mockResolvedValue({ id: "user-1", email: "owner@example.com" });
    const { GET } = await import("@/app/api/sif-embedding-gate/status/route");

    const response = await GET(request("/api/sif-embedding-gate/status", true));

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({ ok: false, message: "플랫폼 운영자 권한이 필요합니다." });
    expect(mocks.getStatus).not.toHaveBeenCalled();
  });

  it("returns full status only to a platform operator", async () => {
    const user = { id: "operator-1", email: "operator@example.com" };
    mocks.getUser.mockResolvedValue(user);
    mocks.isPlatformOperator.mockReturnValue(true);
    const { GET } = await import("@/app/api/sif-embedding-gate/status/route");

    const response = await GET(request("/api/sif-embedding-gate/status", true));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true, stage: "ready-for-approval" });
    expect(mocks.isPlatformOperator).toHaveBeenCalledWith(user);
    expect(mocks.getStatus).toHaveBeenCalledTimes(1);
  });

  it("rejects anonymous approval-packet requests before reading the gate artifacts", async () => {
    const { GET } = await import("@/app/api/sif-embedding-gate/approval-packet/route");

    const response = await GET(request("/api/sif-embedding-gate/approval-packet?format=json"));

    expect(response.status).toBe(401);
    expect(mocks.getStatus).not.toHaveBeenCalled();
    expect(mocks.buildPacket).not.toHaveBeenCalled();
  });

  it("rejects an authenticated tenant user before reading approval artifacts", async () => {
    mocks.getUser.mockResolvedValue({ id: "user-1", email: "owner@example.com" });
    const { GET } = await import("@/app/api/sif-embedding-gate/approval-packet/route");

    const response = await GET(request("/api/sif-embedding-gate/approval-packet", true));

    expect(response.status).toBe(403);
    expect(mocks.getStatus).not.toHaveBeenCalled();
    expect(mocks.buildPacket).not.toHaveBeenCalled();
  });

  it("serves a platform operator approval packet without changing approval state", async () => {
    mocks.getUser.mockResolvedValue({ id: "operator-1", email: "operator@example.com" });
    mocks.isPlatformOperator.mockReturnValue(true);
    const { GET } = await import("@/app/api/sif-embedding-gate/approval-packet/route");

    const response = await GET(request("/api/sif-embedding-gate/approval-packet", true));

    expect(response.status).toBe(200);
    expect(await response.text()).toBe("# approval");
    expect(mocks.buildPacket).toHaveBeenCalledWith({ ok: true, stage: "ready-for-approval" });
  });
});
