import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import {
  asAuthContext,
  McpToolScopeError,
  requireMcpToolScope,
  type McpAuthContext,
  type McpToolName,
} from "@/lib/mcp-auth";
import { createLogger } from "@/lib/logger";
import { toToolError, type McpToolResult } from "@/lib/mcp-tools";

const log = createLogger("mcp-scoped-tool");

type ToolArgs<InputShape extends z.ZodRawShape> = z.output<z.ZodObject<InputShape>>;

type ScopedToolConfig<InputShape extends z.ZodRawShape> = {
  title?: string;
  description?: string;
  inputSchema: InputShape;
};

type ScopedToolHandler<InputShape extends z.ZodRawShape> = (
  args: ToolArgs<InputShape>,
  authContext: McpAuthContext,
  execution: { signal: AbortSignal },
) => McpToolResult | Promise<McpToolResult>;

const SCOPED_TOOL_REGISTRATION = Symbol("safeclaw-scoped-tool-registration");

export type ScopedToolRegistration = {
  readonly toolName: McpToolName;
  readonly invoke: (
    args: unknown,
    authContext: McpAuthContext,
    signal?: AbortSignal,
  ) => Promise<McpToolResult>;
  readonly [SCOPED_TOOL_REGISTRATION]: true;
};

function readAuthContext(extra: unknown): McpAuthContext | null {
  const authInfo = (extra as { authInfo?: { extra?: unknown } } | undefined)?.authInfo;
  return asAuthContext(authInfo?.extra);
}

function readAuthorizedToolContext(extra: unknown, toolName: McpToolName): McpAuthContext {
  return requireMcpToolScope(readAuthContext(extra), toolName);
}

function readExecutionSignal(extra: unknown): AbortSignal {
  const signal = (extra as { signal?: AbortSignal } | undefined)?.signal;
  return signal ?? new AbortController().signal;
}

function logToolContext(tool: McpToolName, context: McpAuthContext): void {
  log.debug("tool call", {
    tool,
    source: context.source,
    siteId: context.siteId,
    orgId: context.orgId,
    scopes: context.scopes,
    tokenId: context.tokenId,
  });
}

export function registerScopedTool<InputShape extends z.ZodRawShape>(
  server: McpServer,
  toolName: McpToolName,
  config: ScopedToolConfig<InputShape>,
  handler: ScopedToolHandler<InputShape>,
): ScopedToolRegistration {
  const inputSchema = z.object(config.inputSchema);
  const invoke = async (args: ToolArgs<InputShape>, extra: unknown): Promise<McpToolResult> => {
    try {
      const authContext = readAuthorizedToolContext(extra, toolName);
      const signal = readExecutionSignal(extra);
      signal.throwIfAborted();
      logToolContext(toolName, authContext);
      return await handler(args, authContext, { signal });
    } catch (error) {
      if (!(error instanceof McpToolScopeError)) {
        log.error("MCP tool execution failed", { tool: toolName, error });
      }
      return toToolError(error);
    }
  };
  server.registerTool(toolName, { ...config, inputSchema }, invoke);
  return Object.freeze({
    toolName,
    async invoke(args, authContext, signal = new AbortController().signal): Promise<McpToolResult> {
      try {
        const parsed = inputSchema.parse(args);
        return await invoke(parsed, { authInfo: { extra: authContext }, signal });
      } catch (error) {
        log.error("MCP tool input validation failed", { tool: toolName, error });
        return toToolError(error);
      }
    },
    [SCOPED_TOOL_REGISTRATION]: true as const,
  });
}
