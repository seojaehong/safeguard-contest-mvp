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
) => McpToolResult | Promise<McpToolResult>;

function readAuthContext(extra: unknown): McpAuthContext | null {
  const authInfo = (extra as { authInfo?: { extra?: unknown } } | undefined)?.authInfo;
  return asAuthContext(authInfo?.extra);
}

function readAuthorizedToolContext(extra: unknown, toolName: McpToolName): McpAuthContext {
  return requireMcpToolScope(readAuthContext(extra), toolName);
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
): void {
  const inputSchema = z.object(config.inputSchema);
  server.registerTool(toolName, { ...config, inputSchema }, async (args, extra) => {
    try {
      const authContext = readAuthorizedToolContext(extra, toolName);
      logToolContext(toolName, authContext);
      return await handler(args, authContext);
    } catch (error) {
      if (!(error instanceof McpToolScopeError)) {
        log.error("MCP tool execution failed", { tool: toolName, error });
      }
      return toToolError(error);
    }
  });
}
