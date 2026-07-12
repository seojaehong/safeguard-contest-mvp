import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import ts from "typescript";
import { describe, expect, it } from "vitest";
import { z } from "zod";

import { MCP_TOOL_NAMES } from "@/lib/mcp-auth";
import { registerScopedTool } from "@/lib/mcp-scoped-tool";
import type { McpToolResult } from "@/lib/mcp-tools";

type RouteRegistrationAnalysis = {
  canonicalImportCount: number;
  directRegisterToolCalls: number;
  alternateScopedToolCalls: number;
  registrationAliasReferences: number;
  serverReferenceViolations: number;
  nonLiteralScopedToolCalls: number;
  scopedToolNames: string[];
};

type CapturedToolCallback = (
  args: { region: string },
  extra: unknown,
) => Promise<McpToolResult>;

function walk(node: ts.Node, visit: (candidate: ts.Node) => void): void {
  visit(node);
  ts.forEachChild(node, (child) => walk(child, visit));
}

function callName(call: ts.CallExpression): string | null {
  if (ts.isIdentifier(call.expression)) return call.expression.text;
  if (ts.isPropertyAccessExpression(call.expression)) return call.expression.name.text;
  return null;
}

function hasCall(node: ts.Node, expectedName: string): boolean {
  let found = false;
  walk(node, (candidate) => {
    if (ts.isCallExpression(candidate) && callName(candidate) === expectedName) found = true;
  });
  return found;
}

function analyzeRouteRegistrations(source: string): RouteRegistrationAnalysis {
  const sourceFile = ts.createSourceFile("route.ts", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const analysis: RouteRegistrationAnalysis = {
    canonicalImportCount: 0,
    directRegisterToolCalls: 0,
    alternateScopedToolCalls: 0,
    registrationAliasReferences: 0,
    serverReferenceViolations: 0,
    nonLiteralScopedToolCalls: 0,
    scopedToolNames: [],
  };

  walk(sourceFile, (node) => {
    if (!ts.isCallExpression(node)) return;
    if (
      ts.isPropertyAccessExpression(node.expression) &&
      node.expression.name.text === "registerTool"
    ) {
      analysis.directRegisterToolCalls += 1;
      return;
    }
    if (callName(node) !== "registerScopedTool") return;
    const toolName = node.arguments[1];
    if (!toolName || !ts.isStringLiteral(toolName)) {
      analysis.nonLiteralScopedToolCalls += 1;
      return;
    }
    analysis.scopedToolNames.push(toolName.text);
  });

  return analysis;
}

function captureScopedTool(
  handler: (args: { region: string }) => McpToolResult | Promise<McpToolResult>,
): CapturedToolCallback {
  let captured: CapturedToolCallback | undefined;
  const server = {
    registerTool(
      _name: string,
      _config: unknown,
      callback: CapturedToolCallback,
    ): object {
      captured = callback;
      return {};
    },
  };

  registerScopedTool(
    server as unknown as McpServer,
    "get_weather_signals",
    { inputSchema: { region: z.string() } },
    handler,
  );
  if (!captured) throw new Error("registerScopedTool did not register a callback");
  return captured;
}

function parseToolError(result: McpToolResult): Record<string, unknown> {
  const text = result.content[0]?.text;
  if (!text) throw new Error("tool result did not contain text");
  return JSON.parse(text) as Record<string, unknown>;
}

function wrapperGuardsBeforeWorkAndLogs(source: string): boolean {
  const sourceFile = ts.createSourceFile("mcp-scoped-tool.ts", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  let wrapper: ts.FunctionDeclaration | undefined;
  walk(sourceFile, (node) => {
    if (ts.isFunctionDeclaration(node) && node.name?.text === "registerScopedTool") wrapper = node;
  });
  if (!wrapper?.body) return false;

  let registration: ts.CallExpression | undefined;
  walk(wrapper.body, (node) => {
    if (
      ts.isCallExpression(node) &&
      ts.isPropertyAccessExpression(node.expression) &&
      node.expression.name.text === "registerTool"
    ) {
      registration = node;
    }
  });
  if (!registration) return false;

  const callback = registration.arguments[2];
  if (!callback || (!ts.isArrowFunction(callback) && !ts.isFunctionExpression(callback))) return false;
  if (!ts.isBlock(callback.body)) return false;

  const firstStatement = callback.body.statements[0];
  if (!firstStatement || !ts.isTryStatement(firstStatement)) return false;
  const firstGuardedStatement = firstStatement.tryBlock.statements[0];
  if (!firstGuardedStatement || !hasCall(firstGuardedStatement, "readAuthorizedToolContext")) return false;

  const handlerStatementIndex = firstStatement.tryBlock.statements.findIndex((statement) =>
    hasCall(statement, "handler"),
  );
  if (handlerStatementIndex <= 0) return false;

  const catchClause = firstStatement.catchClause;
  return Boolean(
    catchClause &&
    hasCall(catchClause.block, "error") &&
    hasCall(catchClause.block, "toToolError"),
  );
}

describe("MCP route scope contract", () => {
  it("routes every literal registered tool through the central scoped wrapper", () => {
    const route = readFileSync(join(process.cwd(), "app/api/mcp/[transport]/route.ts"), "utf8");
    const analysis = analyzeRouteRegistrations(route);

    expect(analysis.canonicalImportCount).toBe(1);
    expect(analysis.directRegisterToolCalls).toBe(0);
    expect(analysis.alternateScopedToolCalls).toBe(0);
    expect(analysis.registrationAliasReferences).toBe(0);
    expect(analysis.serverReferenceViolations).toBe(0);
    expect(analysis.nonLiteralScopedToolCalls).toBe(0);
    expect(analysis.scopedToolNames).toEqual([...MCP_TOOL_NAMES]);
  });

  it("makes authorization the wrapper callback's first executable work and logs internal errors", () => {
    const wrapperPath = join(process.cwd(), "lib/mcp-scoped-tool.ts");
    const wrapperSource = existsSync(wrapperPath) ? readFileSync(wrapperPath, "utf8") : "";

    expect(wrapperGuardsBeforeWorkAndLogs(wrapperSource)).toBe(true);
  });

  it("does not accept comment, dynamic-name, direct-registration, or after-work bypasses", () => {
    const bypassRoute = `
      // registerScopedTool(server, "comment_only", {}, handler)
      registerScopedTool(server, dynamicToolName, {}, handler);
      server.registerTool("direct_tool", {}, handler);
    `;
    const routeAnalysis = analyzeRouteRegistrations(bypassRoute);
    expect(routeAnalysis.scopedToolNames).toEqual([]);
    expect(routeAnalysis.nonLiteralScopedToolCalls).toBe(1);
    expect(routeAnalysis.directRegisterToolCalls).toBe(1);

    const afterWorkWrapper = `
      function registerScopedTool(server, toolName, config, handler) {
        server.registerTool(toolName, config, async (args, extra) => {
          try {
            await handler(args);
            const context = readAuthorizedToolContext(extra, toolName);
            return context;
          } catch (error) {
            log.error("failed", error);
            return toToolError(error);
          }
        });
      }
    `;
    expect(wrapperGuardsBeforeWorkAndLogs(afterWorkWrapper)).toBe(false);
  });

  it("rejects an aliased registration invoked before the authorization guard", () => {
    const aliasBeforeGuard = `
      import { registerScopedTool } from "@/lib/mcp-scoped-tool";
      function registerTools(server) {
        const invoke = registerScopedTool;
        invoke(server, "get_weather_signals", {}, handler);
        readAuthorizedToolContext(extra, "get_weather_signals");
      }
    `;
    const analysis = analyzeRouteRegistrations(aliasBeforeGuard);

    expect(analysis.registrationAliasReferences).toBe(1);
    expect(analysis.scopedToolNames).toEqual([]);
  });

  it("rejects registration through an alternate object's registerScopedTool", () => {
    const alternateObject = `
      import { registerScopedTool } from "@/lib/mcp-scoped-tool";
      function registerTools(server) {
        registrar.registerScopedTool(server, "get_weather_signals", {}, handler);
      }
    `;
    const analysis = analyzeRouteRegistrations(alternateObject);

    expect(analysis.alternateScopedToolCalls).toBe(1);
    expect(analysis.scopedToolNames).toEqual([]);
  });
});

describe("registerScopedTool behavior", () => {
  it.each([
    ["missing", undefined],
    [
      "denied",
      {
        authInfo: {
          extra: {
            siteId: "site-1",
            orgId: "org-1",
            scopes: ["tools:generate_safety_docpack"],
            source: "db",
            tokenId: "token-1",
          },
        },
      },
    ],
  ])("does not call the handler when authorization is %s", async (_label, extra) => {
    let handlerCallCount = 0;
    const callback = captureScopedTool(() => {
      handlerCallCount += 1;
      return { content: [{ type: "text", text: "unexpected" }] };
    });

    const result = await callback({ region: "서울" }, extra);

    expect(handlerCallCount).toBe(0);
    expect(result.isError).toBe(true);
    expect(parseToolError(result)).toEqual({
      code: "MCP_TOOL_FORBIDDEN",
      error: "도구 권한이 없습니다.",
    });
  });

  it("calls the handler exactly once with an authorized context", async () => {
    let handlerCallCount = 0;
    const callback = captureScopedTool((_args) => {
      handlerCallCount += 1;
      return { content: [{ type: "text", text: "authorized" }] };
    });

    const result = await callback(
      { region: "서울" },
      {
        authInfo: {
          extra: {
            siteId: "site-1",
            orgId: "org-1",
            scopes: ["tools:get_weather_signals"],
            source: "db",
            tokenId: "token-1",
          },
        },
      },
    );

    expect(handlerCallCount).toBe(1);
    expect(result).toEqual({ content: [{ type: "text", text: "authorized" }] });
  });
});

describe("MCP remediation evidence", () => {
  it("binds the committed raw build log to the report build ID", () => {
    const evidenceDir = join(
      process.cwd(),
      "evaluation/mcp-tool-scope-enforcement-2026-07-12",
    );
    const buildLog = readFileSync(join(evidenceDir, "build.log"), "utf8");
    const report = JSON.parse(
      readFileSync(join(evidenceDir, "report.json"), "utf8"),
    ) as { build?: { buildId?: unknown; staticPages?: unknown } };
    const loggedBuildId = /^BUILD_ID=(\S+)$/m.exec(buildLog)?.[1];

    expect(loggedBuildId).toBeTypeOf("string");
    expect(report.build?.buildId).toBe(loggedBuildId);
    expect(report.build?.staticPages).toBe("27/27");
  });
});
