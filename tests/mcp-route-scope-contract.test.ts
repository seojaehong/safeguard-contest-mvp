import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import ts from "typescript";
import { describe, expect, it } from "vitest";
import { z } from "zod";

import { MCP_TOOL_NAMES, type McpAuthContext } from "@/lib/mcp-auth";
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

function calledMemberName(expression: ts.LeftHandSideExpression): string | null {
  if (ts.isPropertyAccessExpression(expression)) return expression.name.text;
  if (
    ts.isElementAccessExpression(expression) &&
    expression.argumentExpression &&
    (ts.isStringLiteral(expression.argumentExpression) ||
      ts.isNoSubstitutionTemplateLiteral(expression.argumentExpression))
  ) {
    return expression.argumentExpression.text;
  }
  return null;
}

function createCheckedSource(source: string): {
  checker: ts.TypeChecker;
  sourceFile: ts.SourceFile;
} {
  const fileName = "route.ts";
  const sourceFile = ts.createSourceFile(
    fileName,
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
  const options: ts.CompilerOptions = {
    module: ts.ModuleKind.ESNext,
    noLib: true,
    noResolve: true,
    target: ts.ScriptTarget.Latest,
  };
  const host: ts.CompilerHost = {
    fileExists: (candidate) => candidate === fileName,
    getCanonicalFileName: (candidate) => candidate,
    getCurrentDirectory: () => "",
    getDefaultLibFileName: () => "lib.d.ts",
    getDirectories: () => [],
    getNewLine: () => "\n",
    getSourceFile: (candidate) => candidate === fileName ? sourceFile : undefined,
    readFile: (candidate) => candidate === fileName ? source : undefined,
    useCaseSensitiveFileNames: () => true,
    writeFile: () => undefined,
  };
  const program = ts.createProgram([fileName], options, host);
  const checkedSourceFile = program.getSourceFile(fileName);
  if (!checkedSourceFile) throw new Error("route analysis source was not created");
  return { checker: program.getTypeChecker(), sourceFile: checkedSourceFile };
}

function analyzeRouteRegistrations(source: string): RouteRegistrationAnalysis {
  const { checker, sourceFile } = createCheckedSource(source);
  const analysis: RouteRegistrationAnalysis = {
    canonicalImportCount: 0,
    directRegisterToolCalls: 0,
    alternateScopedToolCalls: 0,
    registrationAliasReferences: 0,
    serverReferenceViolations: 0,
    nonLiteralScopedToolCalls: 0,
    scopedToolNames: [],
  };
  let canonicalImportIdentifier: ts.Identifier | undefined;
  let canonicalImportSymbol: ts.Symbol | undefined;
  let serverParameterIdentifier: ts.Identifier | undefined;
  let serverParameterSymbol: ts.Symbol | undefined;

  walk(sourceFile, (node) => {
    if (
      ts.isImportDeclaration(node) &&
      ts.isStringLiteral(node.moduleSpecifier) &&
      node.moduleSpecifier.text === "@/lib/mcp-scoped-tool" &&
      node.importClause?.namedBindings &&
      ts.isNamedImports(node.importClause.namedBindings)
    ) {
      for (const element of node.importClause.namedBindings.elements) {
        const importedName = element.propertyName?.text ?? element.name.text;
        if (importedName !== "registerScopedTool") continue;
        canonicalImportIdentifier = element.name;
        canonicalImportSymbol = checker.getSymbolAtLocation(element.name);
        if (!element.propertyName && element.name.text === "registerScopedTool") {
          analysis.canonicalImportCount += 1;
        }
      }
    }
    if (
      ts.isFunctionDeclaration(node) &&
      node.name?.text === "registerTools" &&
      node.parameters[0] &&
      ts.isIdentifier(node.parameters[0].name)
    ) {
      serverParameterIdentifier = node.parameters[0].name;
      serverParameterSymbol = checker.getSymbolAtLocation(node.parameters[0].name);
    }
  });

  walk(sourceFile, (node) => {
    if (!ts.isCallExpression(node)) return;
    const memberName = calledMemberName(node.expression);
    if (memberName === "registerTool") {
      analysis.directRegisterToolCalls += 1;
      return;
    }
    if (memberName === "registerScopedTool") {
      analysis.alternateScopedToolCalls += 1;
      return;
    }
    if (
      !ts.isIdentifier(node.expression) ||
      !canonicalImportSymbol ||
      checker.getSymbolAtLocation(node.expression) !== canonicalImportSymbol
    ) return;

    const toolName = node.arguments[1];
    if (!toolName || !ts.isStringLiteral(toolName)) {
      analysis.nonLiteralScopedToolCalls += 1;
      return;
    }
    analysis.scopedToolNames.push(toolName.text);
  });

  walk(sourceFile, (node) => {
    if (!ts.isIdentifier(node)) return;
    const symbol = checker.getSymbolAtLocation(node);
    if (canonicalImportSymbol && symbol === canonicalImportSymbol) {
      const isImportDeclarationName = node === canonicalImportIdentifier;
      const isDirectCanonicalCall = ts.isCallExpression(node.parent) && node.parent.expression === node;
      if (!isImportDeclarationName && !isDirectCanonicalCall) {
        analysis.registrationAliasReferences += 1;
      }
    }
    if (!serverParameterSymbol || symbol !== serverParameterSymbol) return;
    if (node === serverParameterIdentifier) return;
    const isCanonicalServerArgument =
      ts.isCallExpression(node.parent) &&
      node.parent.arguments[0] === node &&
      ts.isIdentifier(node.parent.expression) &&
      canonicalImportSymbol !== undefined &&
      checker.getSymbolAtLocation(node.parent.expression) === canonicalImportSymbol;
    if (!isCanonicalServerArgument) analysis.serverReferenceViolations += 1;
  });

  return analysis;
}

function captureScopedTool(
  handler: (
    args: { region: string },
    authContext: McpAuthContext,
  ) => McpToolResult | Promise<McpToolResult>,
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

describe("MCP route scope contract", () => {
  it("routes every literal registered tool through the central scoped wrapper", () => {
    const route = readFileSync(join(process.cwd(), "app/api/mcp/[transport]/route.ts"), "utf8");

    expect(route).toContain("resolveSafetyKnowledgeSnapshot");
    expect(route).toContain("publishedGraphSnapshot");
    const analysis = analyzeRouteRegistrations(route);

    expect(analysis.canonicalImportCount).toBe(1);
    expect(analysis.directRegisterToolCalls).toBe(0);
    expect(analysis.alternateScopedToolCalls).toBe(0);
    expect(analysis.registrationAliasReferences).toBe(0);
    expect(analysis.serverReferenceViolations).toBe(0);
    expect(analysis.nonLiteralScopedToolCalls).toBe(0);
    expect(analysis.scopedToolNames).toEqual([...MCP_TOOL_NAMES]);
  });

  it("does not accept comment, dynamic-name, or direct-registration bypasses", () => {
    const bypassRoute = `
      import { registerScopedTool } from "@/lib/mcp-scoped-tool";
      // registerScopedTool(server, "comment_only", {}, handler)
      function registerTools(server) {
        registerScopedTool(server, dynamicToolName, {}, handler);
        server.registerTool("direct_tool", {}, handler);
      }
    `;
    const routeAnalysis = analyzeRouteRegistrations(bypassRoute);
    expect(routeAnalysis.scopedToolNames).toEqual([]);
    expect(routeAnalysis.nonLiteralScopedToolCalls).toBe(1);
    expect(routeAnalysis.directRegisterToolCalls).toBe(1);
    expect(routeAnalysis.serverReferenceViolations).toBe(1);
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

  it("rejects a computed registration method on the MCP server", () => {
    const dynamicRegistration = `
      import { registerScopedTool } from "@/lib/mcp-scoped-tool";
      function registerTools(server) {
        const method = "registerTool";
        server[method]("get_weather_signals", {}, handler);
      }
    `;
    const analysis = analyzeRouteRegistrations(dynamicRegistration);

    expect(analysis.serverReferenceViolations).toBe(1);
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
    let receivedContext: McpAuthContext | undefined;
    const callback = captureScopedTool((_args, authContext) => {
      handlerCallCount += 1;
      receivedContext = authContext;
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
    expect(receivedContext).toEqual({
      siteId: "site-1",
      orgId: "org-1",
      scopes: ["tools:get_weather_signals"],
      source: "db",
      tokenId: "token-1",
    });
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
