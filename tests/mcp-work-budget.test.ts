import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  MCP_DOCUMENT_TEXT_MAX_CHARS,
  MCP_GENERATION_QUESTION_MAX_CHARS,
  MCP_REQUEST_BODY_MAX_BYTES,
  MCP_TASK_MAX_CHARS,
} from "@/lib/mcp-work-budget";
import {
  enforcePublicJsonRequestBodyBudget,
  PUBLIC_JSON_BODY_READ_TIMEOUT_MS,
} from "@/lib/public-work-budget";

const mocks = vi.hoisted(() => ({
  baseHandler: vi.fn(async (_request: Request) => Response.json({ ok: true })),
  resolveMcpAuth: vi.fn(),
}));

vi.mock("mcp-handler", () => ({
  createMcpHandler: vi.fn(() => mocks.baseHandler),
  withMcpAuth: vi.fn((handler: (request: Request) => Promise<Response>, verify: (
    request: Request,
    bearerToken?: string,
  ) => Promise<unknown>) => async (request: Request) => {
    const bearer = request.headers.get("authorization")?.replace(/^Bearer\s+/iu, "").trim();
    const auth = await verify(request, bearer);
    if (!auth) return Response.json({ error: "Unauthorized" }, { status: 401 });
    return handler(request);
  }),
}));

vi.mock("@/lib/mcp-auth", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/mcp-auth")>()),
  isMcpEnabled: vi.fn(() => true),
  resolveMcpAuth: mocks.resolveMcpAuth,
}));

vi.mock("@/lib/supabase-admin", () => ({
  createSupabaseAdminClient: vi.fn(() => null),
}));

import { handler, registerTools } from "@/app/api/mcp/[transport]/implementation";

type SafeParseSchema = {
  safeParse(value: unknown): { success: boolean };
};

type ToolConfig = {
  inputSchema?: SafeParseSchema;
  callback?: (args: Record<string, unknown>, extra: unknown) => Promise<{
    content: Array<{ type: "text"; text: string }>;
    isError?: boolean;
  }>;
};

function captureToolConfigs(): Map<string, ToolConfig> {
  const tools = new Map<string, ToolConfig>();
  const server = {
    registerTool(
      name: string,
      config: ToolConfig,
      callback: NonNullable<ToolConfig["callback"]>,
    ): object {
      tools.set(name, { ...config, callback });
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
  beforeEach(() => {
    mocks.baseHandler.mockClear();
    mocks.resolveMcpAuth.mockReset();
    mocks.resolveMcpAuth.mockResolvedValue({
      orgId: "org-1",
      scopes: ["safeclaw:read"],
      siteId: "site-1",
      source: "db",
      tokenId: "token-1",
    });
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("applies coarse admission before resolving invalid bearer tokens", async () => {
    mocks.resolveMcpAuth.mockResolvedValue(null);
    const requestForAttempt = () => new Request("https://www.safeclaw.kr/api/mcp/mcp", {
      method: "POST",
      headers: {
        Authorization: "Bearer invalid-token",
        "Content-Type": "application/json",
        "X-Forwarded-For": "198.51.100.240",
      },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list" }),
    });

    for (let attempt = 0; attempt < 20; attempt += 1) {
      const response = await handler(requestForAttempt());
      expect(response.status).toBe(401);
    }

    const limited = await handler(requestForAttempt());

    expect(limited.status).toBe(429);
    expect(mocks.resolveMcpAuth).toHaveBeenCalledTimes(20);
    expect(mocks.baseHandler).not.toHaveBeenCalled();
  });

  it("applies coarse admission to authenticated transport methods other than POST", async () => {
    mocks.resolveMcpAuth.mockResolvedValue(null);
    const requestForAttempt = () => new Request("https://www.safeclaw.kr/api/mcp/mcp", {
      method: "GET",
      headers: {
        Authorization: "Bearer invalid-get-token",
        "X-Forwarded-For": "198.51.100.241",
      },
    });

    for (let attempt = 0; attempt < 20; attempt += 1) {
      const response = await handler(requestForAttempt());
      expect(response.status).toBe(401);
    }

    const limited = await handler(requestForAttempt());

    expect(limited.status).toBe(429);
    expect(mocks.resolveMcpAuth).toHaveBeenCalledTimes(20);
    expect(mocks.baseHandler).not.toHaveBeenCalled();
  });

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

  it.each([
    ["generate_safety_docpack", { question: "용접", mode: "full" }],
    ["generate_reviewed_safety_docpack", { question: "용접", task: "용접", mode: "enhanced" }],
  ] as const)("fails %s closed before provider work without durable production admission", async (toolName, args) => {
    vi.stubEnv("VERCEL_ENV", "production");
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "");
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const callback = captureToolConfigs().get(toolName)?.callback;
    if (!callback) throw new Error(`Missing ${toolName} callback`);

    const result = await callback(args, {
      authInfo: {
        extra: {
          admissionIdentity: "b".repeat(64),
          orgId: "org-1",
          scopes: ["tools:write"],
          siteId: "site-1",
          source: "db",
          tokenId: "token-1",
        },
      },
    });

    expect(result.isError).toBe(true);
    expect(JSON.parse(result.content[0]?.text ?? "{}")).toMatchObject({
      code: "MCP_PROVIDER_ADMISSION_UNAVAILABLE",
    });
    expect(error).toHaveBeenCalled();
    error.mockRestore();
  });

  it("rejects an oversized chunked JSON-RPC body before the MCP handler", async () => {
    const response = await handler(new Request("https://www.safeclaw.kr/api/mcp/mcp", {
      method: "POST",
      headers: {
        Authorization: "Bearer oversized-body-token",
        "Content-Length": "1",
        "Content-Type": "application/json",
      },
      body: "가".repeat(Math.floor(MCP_REQUEST_BODY_MAX_BYTES / 3) + 1),
    }));

    expect(response.status).toBe(413);
    expect(await response.json()).toMatchObject({ code: "MCP_PAYLOAD_TOO_LARGE" });
    expect(mocks.baseHandler).not.toHaveBeenCalled();
  });

  it("enforces an absolute deadline while reading a public JSON body", async () => {
    vi.useFakeTimers();
    try {
      const cancel = vi.fn();
      const body = new ReadableStream<Uint8Array>({ cancel });
      const request = new Request("https://www.safeclaw.kr/api/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
        duplex: "half",
      } as RequestInit & { duplex: "half" });

      const pending = enforcePublicJsonRequestBodyBudget(request, 1_024, "Request body is too large.");
      await vi.advanceTimersByTimeAsync(PUBLIC_JSON_BODY_READ_TIMEOUT_MS);
      const result = await pending;

      expect(result.ok).toBe(false);
      if (result.ok) throw new Error("Expected the public body read to time out");
      expect(result.response.status).toBe(408);
      await expect(result.response.json()).resolves.toMatchObject({
        code: "PUBLIC_JSON_BODY_READ_TIMEOUT",
        limit: PUBLIC_JSON_BODY_READ_TIMEOUT_MS,
      });
      expect(cancel).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it("preserves the largest legitimate QA document payload", async () => {
    const response = await handler(new Request("https://www.safeclaw.kr/api/mcp/mcp", {
      method: "POST",
      headers: {
        Authorization: "Bearer max-qa-payload-token",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "tools/call",
        params: {
          name: "qa_review_docpack",
          arguments: {
            task: "용접",
            document_text: "가".repeat(MCP_DOCUMENT_TEXT_MAX_CHARS),
          },
        },
      }),
    }));

    expect(response.status).toBe(200);
    expect(mocks.baseHandler).toHaveBeenCalledTimes(1);
  });

  it("preserves a bounded authenticated POST and reports the limiter mode", async () => {
    const response = await handler(new Request("https://www.safeclaw.kr/api/mcp/mcp", {
      method: "POST",
      headers: {
        Authorization: "Bearer bounded-body-token",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list" }),
    }));

    expect(response.status).toBe(200);
    expect(response.headers.get("X-SafeClaw-Rate-Limit")).toBe("instance");
    expect(mocks.baseHandler).toHaveBeenCalledTimes(1);
    const forwarded = mocks.baseHandler.mock.calls[0]?.[0] as Request | undefined;
    expect(await forwarded?.json()).toMatchObject({ method: "tools/list" });
  });

  it("fails closed before MCP work when distributed configuration is partial", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "https://example.upstash.io");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "");

    const response = await handler(new Request("https://www.safeclaw.kr/api/mcp/mcp", {
      method: "POST",
      headers: {
        Authorization: "Bearer partial-config-token",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list" }),
    }));

    expect(response.status).toBe(503);
    expect(response.headers.get("X-SafeClaw-Rate-Limit")).toBe("distributed");
    expect(mocks.baseHandler).not.toHaveBeenCalled();
    expect(error).toHaveBeenCalled();
    error.mockRestore();
  });

  it("uses a hashed token-bound distributed key without exposing the bearer", async () => {
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "https://example.upstash.io");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "distributed-test-token");
    const bearer = "mcp-sensitive-bearer";
    const limiterKeys: string[] = [];
    const fetchImpl = vi.fn(async (_input: string | URL | Request, init?: RequestInit) => {
      const command = JSON.parse(String(init?.body)) as unknown[];
      limiterKeys.push(String(command[3]));
      return Response.json({ result: [1, 59_000] });
    });
    vi.stubGlobal("fetch", fetchImpl);

    const response = await handler(new Request("https://www.safeclaw.kr/api/mcp/mcp", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${bearer}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list" }),
    }));

    expect(response.status).toBe(200);
    expect(response.headers.get("X-SafeClaw-Rate-Limit")).toBe("distributed");
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(limiterKeys).toHaveLength(2);
    expect(limiterKeys[0]).toMatch(/^safeclaw:public-rate:mcp-pre-auth:/u);
    expect(limiterKeys[1]).toMatch(/^safeclaw:public-rate:mcp-authenticated:[a-f0-9]{32}$/u);
    expect(limiterKeys.join("\n")).not.toContain(bearer);
    expect(mocks.baseHandler).toHaveBeenCalledTimes(1);
  });
});
