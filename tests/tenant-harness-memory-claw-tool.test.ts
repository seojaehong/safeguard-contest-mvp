import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createSupabaseAdminClient: vi.fn(),
  loadTenantHarnessMemoryForMcp: vi.fn(),
  searchSafetyReferences: vi.fn(),
}));

vi.mock("@/lib/supabase-admin", () => ({ createSupabaseAdminClient: mocks.createSupabaseAdminClient }));
vi.mock("@/lib/tenant-harness-memory", () => ({
  loadTenantHarnessMemoryForMcp: mocks.loadTenantHarnessMemoryForMcp,
  TENANT_REFLECTED_DOCUMENTS: [
    "위험성평가표", "TBM 브리핑", "TBM 기록", "작업계획서", "안전교육일지",
    "비상대응계획", "사진대지", "외국인근로자 안내",
  ],
}));
vi.mock("@/lib/safety-reference-catalog-server", () => ({ searchSafetyReferences: mocks.searchSafetyReferences }));

function searchResult(ok: boolean) {
  return {
    ok,
    configured: true,
    query: "외벽 도장",
    count: 0,
    items: [],
    retrievalMode: "rest-ilike",
    vectorSearch: { enabled: false, attempted: false, ok: false, reason: "disabled", count: 0, model: "", message: "disabled" },
    message: ok ? "reference retrieval completed" : "reference retrieval failed",
  };
}

function memoryResult(status: "completed" | "skipped" | "failed") {
  return {
    workpackMemory: [],
    improvements: [],
    siteScope: status === "skipped" ? "none" : "site",
    stages: [
      { name: "load_workpack_memory", status, attempted: status !== "skipped", count: status === "completed" ? 0 : undefined },
      { name: "load_improvement_memory", status, attempted: status !== "skipped", count: status === "completed" ? 0 : undefined },
    ],
  };
}

describe("run_safeclaw_harness_agent tenant memory contract", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    mocks.searchSafetyReferences.mockResolvedValue(searchResult(true));
    mocks.loadTenantHarnessMemoryForMcp.mockResolvedValue(memoryResult("completed"));
  });

  it("preserves the legacy four-stage pipeline while exposing truthful partial statuses", async () => {
    mocks.searchSafetyReferences
      .mockResolvedValueOnce(searchResult(false))
      .mockResolvedValueOnce(searchResult(true))
      .mockResolvedValueOnce(searchResult(true));
    mocks.loadTenantHarnessMemoryForMcp.mockResolvedValue(memoryResult("failed"));
    const { executeClawTool } = await import("@/lib/claw-tools");

    const result = await executeClawTool("run_safeclaw_harness_agent", { question: "외벽 도장" }, {
      orgId: "org-a", siteId: "site-1", scopes: ["tools:read"], source: "db", tokenId: "token-1",
    }) as {
      qualityPipeline: string[];
      qualityPipelineStatus: Array<{ name: string; status: string }>;
      packetClassification: { classification: string; externalRuntimePolicy: string; rawMemoryForwardingAllowed: boolean };
      packet: { mode: string };
    };

    expect(result.qualityPipeline).toEqual([
      "search_safety_reference_items",
      "load_workpack_memory",
      "load_improvement_memory",
      "build_db_harness_packet",
    ]);
    expect(result.qualityPipelineStatus).toEqual(expect.arrayContaining([
      expect.objectContaining({ name: "search_safety_reference_items", status: "failed" }),
      expect.objectContaining({ name: "load_workpack_memory", status: "failed" }),
      expect.objectContaining({ name: "build_db_harness_packet", status: "completed" }),
    ]));
    expect(result.packet.mode).toBe("db_harness_first");
    expect(result.packetClassification).toEqual(expect.objectContaining({
      classification: "tenant-confidential",
      externalRuntimePolicy: "tenant_authorized_runtime_only",
      rawMemoryForwardingAllowed: false,
    }));
  });

  it("rebuilds a structured tenant digest without forwarding free text or contact details", async () => {
    mocks.loadTenantHarnessMemoryForMcp.mockResolvedValue({
      workpackMemory: [{
        id: "wp-approved",
        generatedAt: "2026-07-15T03:00:00Z",
        provenanceImprovementIds: ["imp-approved"],
        reflectedDocuments: ["위험성평가표"],
        question: "홍길동 010-1234-5678 hong@example.com",
      }],
      improvements: [{
        id: "imp-approved",
        workpackId: "wp-approved",
        reviewStatus: "approved",
        sourceType: "manual",
        reviewedAt: "2026-07-15T03:00:00Z",
        reflectedDocuments: ["위험성평가표"],
        improvementText: "홍길동에게 010-1234-5678 또는 hong@example.com으로 연락",
      }],
      siteScope: "site",
      stages: memoryResult("completed").stages,
    });
    const { executeClawTool } = await import("@/lib/claw-tools");

    const result = await executeClawTool("run_safeclaw_harness_agent", { question: "외벽 도장" }, {
      orgId: "org-a", siteId: "site-1", scopes: ["tools:read"], source: "db", tokenId: "token-1",
    }) as Record<string, unknown>;
    const serialized = JSON.stringify(result);

    expect(serialized).not.toMatch(/홍길동|010-1234-5678|hong@example\.com/);
    expect(serialized).not.toMatch(/"question":"홍길동|improvementText/);
    expect(result).toMatchObject({
      tenantMemoryDigest: {
        workpacks: [{ id: "wp-approved", provenanceImprovementIds: ["imp-approved"] }],
        improvements: [{ id: "imp-approved", workpackId: "wp-approved", reviewStatus: "approved" }],
      },
      packet: { workpackMemory: [], improvementMemory: [] },
    });
  });

  it("passes the admin client factory to the safe adapter instead of invoking it eagerly", async () => {
    mocks.createSupabaseAdminClient.mockImplementation(() => {
      throw new Error("must be contained by adapter");
    });
    const { executeClawTool } = await import("@/lib/claw-tools");

    await expect(executeClawTool("run_safeclaw_harness_agent", { question: "외벽 도장" })).resolves.toBeDefined();
    expect(mocks.createSupabaseAdminClient).not.toHaveBeenCalled();
    expect(mocks.loadTenantHarnessMemoryForMcp).toHaveBeenCalledWith(undefined, mocks.createSupabaseAdminClient);
  });

  it("keeps skipped memory stages in status without changing the legacy pipeline", async () => {
    mocks.loadTenantHarnessMemoryForMcp.mockResolvedValue(memoryResult("skipped"));
    const { executeClawTool } = await import("@/lib/claw-tools");
    const result = await executeClawTool("run_safeclaw_harness_agent", { question: "외벽 도장" }) as {
      qualityPipeline: string[];
      qualityPipelineStatus: Array<{ name: string; status: string; attempted: boolean }>;
    };
    expect(result.qualityPipeline).toHaveLength(4);
    expect(result.qualityPipelineStatus).toEqual(expect.arrayContaining([
      expect.objectContaining({ name: "load_workpack_memory", status: "skipped", attempted: false }),
      expect.objectContaining({ name: "load_improvement_memory", status: "skipped", attempted: false }),
    ]));
  });
});
