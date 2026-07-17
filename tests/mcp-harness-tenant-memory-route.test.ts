import fs from "node:fs";
import path from "node:path";

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { McpAuthContext } from "@/lib/mcp-auth";
import type { McpToolResult } from "@/lib/mcp-tools";

const mocks = vi.hoisted(() => ({
  createSupabaseAdminClient: vi.fn(() => ({ marker: "configured-client" })),
  loadTenantHarnessMemoryForMcp: vi.fn(),
  searchSafetyReferences: vi.fn(),
}));

vi.mock("mcp-handler", () => ({
  createMcpHandler: vi.fn(() => vi.fn()),
  withMcpAuth: vi.fn((handler: unknown) => handler),
}));

vi.mock("@/lib/supabase-admin", () => ({
  createSupabaseAdminClient: mocks.createSupabaseAdminClient,
}));

vi.mock("@/lib/tenant-harness-memory", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/tenant-harness-memory")>();
  return {
    ...original,
    loadTenantHarnessMemoryForMcp: mocks.loadTenantHarnessMemoryForMcp,
  };
});

vi.mock("@/lib/safety-reference-catalog-server", () => ({
  searchSafetyReferences: mocks.searchSafetyReferences,
}));

import { registerTools } from "@/app/api/mcp/[transport]/implementation";

type RegisteredTool = {
  invoke: (args: unknown, extra: unknown) => Promise<McpToolResult>;
};

const AUTH_CONTEXT: McpAuthContext = {
  siteId: "site-route",
  orgId: "org-route",
  scopes: ["tools:read"],
  source: "db",
  tokenId: "token-route",
};

function captureHarnessTool(): RegisteredTool {
  const tools = new Map<string, RegisteredTool>();
  const server = {
    registerTool(name: string, _config: unknown, invoke: RegisteredTool["invoke"]): object {
      tools.set(name, { invoke });
      return {};
    },
  };
  registerTools(server as unknown as McpServer);
  const tool = tools.get("run_safeclaw_harness_agent");
  if (!tool) throw new Error("Harness tool was not registered by the Next MCP route.");
  return tool;
}

function parsePayload(result: McpToolResult): Record<string, unknown> {
  const parsed: unknown = JSON.parse(result.content[0]?.text ?? "null");
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new Error("Expected an MCP JSON object payload.");
  }
  return parsed as Record<string, unknown>;
}

describe("public MCP tenant memory boundary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.searchSafetyReferences.mockResolvedValue({
      ok: true,
      configured: true,
      query: "외벽 도장",
      items: [],
      count: 0,
      retrievalMode: "rest-ilike",
      vectorSearch: { enabled: false, attempted: false, ok: false },
      message: "조회 완료",
    });
    mocks.loadTenantHarnessMemoryForMcp.mockResolvedValue({
      workpackMemory: [{
        id: "workpack-1",
        generatedAt: "2026-07-16T00:00:00.000Z",
        provenanceImprovementIds: ["improvement-1"],
        reflectedDocuments: ["위험성평가표"],
      }],
      improvements: [{
        id: "improvement-1",
        workpackId: "workpack-1",
        reviewStatus: "approved",
        reflectedDocuments: ["위험성평가표"],
        sourceType: "photo_analysis",
        reviewedAt: "2026-07-16T00:00:00.000Z",
      }],
      siteScope: "site",
      stages: [
        { name: "load_workpack_memory", status: "completed", attempted: true, siteScope: "site", count: 1 },
        { name: "load_improvement_memory", status: "completed", attempted: true, siteScope: "site", count: 1 },
      ],
    });
  });

  it("loads only the structured tenant digest through the bounded adapter", async () => {
    const result = await captureHarnessTool().invoke(
      { question: "외벽 도장" },
      { authInfo: { extra: AUTH_CONTEXT } },
    );
    const payload = parsePayload(result);
    const serialized = JSON.stringify(payload);

    expect(mocks.loadTenantHarnessMemoryForMcp).toHaveBeenCalledWith(
      AUTH_CONTEXT,
      mocks.createSupabaseAdminClient,
    );
    expect(payload).toMatchObject({
      tenantMemoryDigest: {
        provenancePolicy: "approved_or_reflected_only",
        workpacks: [{ id: "workpack-1", provenanceImprovementIds: ["improvement-1"] }],
        improvements: [{ id: "improvement-1", reviewStatus: "approved" }],
      },
      packetClassification: { rawMemoryForwardingAllowed: false },
    });
    expect(serialized).not.toMatch(/analysis_payload|ocrText|visionSummary|improvementText|taskLabel|hazardLabel/);
  });

  it("contains no legacy raw-memory query in the public route source", () => {
    const source = fs.readFileSync(
      path.join(process.cwd(), "app", "api", "mcp", "[transport]", "implementation.ts"),
      "utf8",
    );

    expect(source).toContain("loadTenantHarnessMemoryForMcp");
    expect(source).not.toMatch(/analysis_payload|improvement_text|task_label|hazard_label/);
    expect(source).not.toContain("loadHarnessWorkpackMemory");
    expect(source).not.toContain("loadHarnessImprovementMemory");
  });
});
