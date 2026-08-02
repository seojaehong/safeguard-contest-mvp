import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { describe, expect, it, vi } from "vitest";

import {
  MCP_DOCUMENT_TEXT_MAX_CHARS,
  MCP_GENERATION_QUESTION_MAX_CHARS,
  MCP_TASK_MAX_CHARS,
} from "@/lib/mcp-work-budget";

vi.mock("mcp-handler", () => ({
  createMcpHandler: vi.fn(() => vi.fn()),
  withMcpAuth: vi.fn((handler: unknown) => handler),
}));

vi.mock("@/lib/supabase-admin", () => ({
  createSupabaseAdminClient: vi.fn(() => null),
}));

import { registerTools } from "@/app/api/mcp/[transport]/implementation";

type SafeParseSchema = {
  safeParse(value: unknown): { success: boolean };
};

type ToolConfig = {
  inputSchema?: SafeParseSchema;
};

function captureToolConfigs(): Map<string, ToolConfig> {
  const tools = new Map<string, ToolConfig>();
  const server = {
    registerTool(name: string, config: ToolConfig): object {
      tools.set(name, config);
      return {};
    },
  };
  registerTools(server as unknown as McpServer);
  return tools;
}

function schemaFor(tools: Map<string, ToolConfig>, toolName: string): SafeParseSchema {
  const schema = tools.get(toolName)?.inputSchema;
  if (!schema) throw new Error(`Missing ${toolName} MCP schema`);
  return schema;
}

describe("MCP tool work budgets", () => {
  it.each([
    ["run_safeclaw_harness_agent", {}],
    ["generate_reviewed_safety_docpack", { task: "용접" }],
    ["generate_safety_docpack", {}],
  ] as const)("rejects oversized generation questions in %s", (toolName, extra) => {
    const schema = schemaFor(captureToolConfigs(), toolName);

    expect(schema.safeParse({
      ...extra,
      question: "가".repeat(MCP_GENERATION_QUESTION_MAX_CHARS),
    }).success).toBe(true);
    expect(schema.safeParse({
      ...extra,
      question: "가".repeat(MCP_GENERATION_QUESTION_MAX_CHARS + 1),
    }).success).toBe(false);
  });

  it("bounds reviewed task labels and QA document text", () => {
    const tools = captureToolConfigs();
    const reviewed = schemaFor(tools, "generate_reviewed_safety_docpack");
    const qa = schemaFor(tools, "qa_review_docpack");

    expect(reviewed.safeParse({
      question: "비계",
      task: "가".repeat(MCP_TASK_MAX_CHARS + 1),
    }).success).toBe(false);
    expect(qa.safeParse({
      task: "가".repeat(MCP_TASK_MAX_CHARS + 1),
      document_text: "본문",
    }).success).toBe(false);
    expect(qa.safeParse({
      task: "용접",
      document_text: "가".repeat(MCP_DOCUMENT_TEXT_MAX_CHARS),
    }).success).toBe(true);
    expect(qa.safeParse({
      task: "용접",
      document_text: "가".repeat(MCP_DOCUMENT_TEXT_MAX_CHARS + 1),
    }).success).toBe(false);
  });
});
