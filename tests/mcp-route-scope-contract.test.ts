import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";

import { MCP_TOOL_NAMES } from "@/lib/mcp-auth";

type RouteRegistrationAnalysis = {
  directRegisterToolCalls: number;
  nonLiteralScopedToolCalls: number;
  scopedToolNames: string[];
};

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
    directRegisterToolCalls: 0,
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

    expect(analysis.directRegisterToolCalls).toBe(0);
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
});
