import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import { executeClawTool } from "@/lib/claw-tools";
import type { BrokerRequestContext } from "@/lib/engine-adapter";
import {
  isReadOnlyMcpTool,
  McpToolScopeError,
  type McpAuthContext,
  type McpToolName,
} from "@/lib/mcp-auth";
import {
  registerScopedTool,
  type ScopedToolRegistration,
} from "@/lib/mcp-scoped-tool";
import { toToolResult } from "@/lib/mcp-tools";

export type SafeClawReadExecution = {
  context: BrokerRequestContext;
  toolName: string;
  input: unknown;
  signal: AbortSignal;
};

const SAFECLAW_SCOPED_MCP_READ_EXECUTOR = Symbol("safeclaw-scoped-mcp-read-executor");

export type SafeClawScopedMcpReadExecutor = {
  readonly boundary: "safeclaw-mcp-interceptor";
  readonly execute: (execution: SafeClawReadExecution) => Promise<unknown>;
  readonly [SAFECLAW_SCOPED_MCP_READ_EXECUTOR]: true;
};

const registrationServer = {
  registerTool(): object {
    return {};
  },
} as unknown as McpServer;

function registerReadTool<InputShape extends z.ZodRawShape>(
  toolName: McpToolName,
  inputSchema: InputShape,
): ScopedToolRegistration {
  return registerScopedTool(
    registrationServer,
    toolName,
    { inputSchema },
    async (args, authContext) => toToolResult(
      await executeClawTool(toolName, args, authContext),
    ),
  );
}

function createReadRegistrations(): ReadonlyMap<McpToolName, ScopedToolRegistration> {
  return new Map<McpToolName, ScopedToolRegistration>([
    ["run_safeclaw_harness_agent", registerReadTool(
      "run_safeclaw_harness_agent",
      { question: z.string() },
    )],
    ["get_weather_signals", registerReadTool("get_weather_signals", { region: z.string() })],
    ["validate_safety_citations", registerReadTool("validate_safety_citations", { text: z.string() })],
    ["sanitize_emergency_contacts", registerReadTool("sanitize_emergency_contacts", { text: z.string() })],
    ["search_accident_cases", registerReadTool("search_accident_cases", { keyword: z.string() })],
    ["get_evidence_mapping", registerReadTool("get_evidence_mapping", { docType: z.string().optional() })],
    ["query_safety_knowledge", registerReadTool("query_safety_knowledge", { query: z.string() })],
    ["qa_review_docpack", registerReadTool("qa_review_docpack", {
      task: z.string(),
      document_text: z.string(),
    })],
  ]);
}

function readAuthContext(context: BrokerRequestContext): McpAuthContext {
  return {
    siteId: context.siteId,
    orgId: context.organizationId,
    scopes: ["tools:read"],
    source: "db",
    tokenId: null,
  };
}

function parseToolResult(result: Awaited<ReturnType<ScopedToolRegistration["invoke"]>>): unknown {
  const text = result.content[0]?.text;
  if (!text) throw new Error("SafeClaw MCP read tool returned no content.");
  const payload: unknown = JSON.parse(text);
  if (result.isError) {
    const code = typeof payload === "object" && payload !== null && "code" in payload
      ? (payload as { code?: unknown }).code
      : undefined;
    if (code === "MCP_TOOL_FORBIDDEN") throw new McpToolScopeError();
    throw new Error("SafeClaw MCP read tool execution failed.");
  }
  return payload;
}

export function createSafeClawScopedMcpReadExecutor(): SafeClawScopedMcpReadExecutor {
  const registrations = createReadRegistrations();
  return Object.freeze({
    boundary: "safeclaw-mcp-interceptor" as const,
    async execute(execution: SafeClawReadExecution): Promise<unknown> {
      if (execution.signal.aborted) throw execution.signal.reason;
      if (!isReadOnlyMcpTool(execution.toolName)) throw new McpToolScopeError();
      const registration = registrations.get(execution.toolName);
      if (!registration) throw new McpToolScopeError();
      return parseToolResult(await registration.invoke(
        execution.input,
        readAuthContext(execution.context),
      ));
    },
    [SAFECLAW_SCOPED_MCP_READ_EXECUTOR]: true as const,
  });
}

export function isSafeClawScopedMcpReadExecutor(
  value: unknown,
): value is SafeClawScopedMcpReadExecutor {
  return typeof value === "object"
    && value !== null
    && (value as {
      [SAFECLAW_SCOPED_MCP_READ_EXECUTOR]?: unknown;
    })[SAFECLAW_SCOPED_MCP_READ_EXECUTOR] === true;
}
