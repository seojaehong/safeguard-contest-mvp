// 261122 원격 MCP 전수 점검에서 반박 검증까지 통과한 계약 결함 넷을 고정한다.
//   ① 공개(토큰 없음) 호출에서 generate_risk_assessment 가 enhanced·full 을 말없이 template 로 내렸다
//      (스키마는 「기본 enhanced」라 적었다). 내렸으면 결과에 요청 모드·적용 모드·이유를 적는다.
//   ② 빈·공백 question 이 status ok + 내장 예시(성수동 외벽 도장)를 결과처럼 돌려줬다 → 입력 오류로 거절한다.
//   ③ 1,201~4,000자 question 이 MCP_TOOL_INTERNAL_ERROR 였다. runAsk 의 처리 한도(PUBLIC_ASK_QUESTION_MAX_CHARS)와
//      스키마 상한(4,000)이 어긋났다 → runAsk 를 쓰는 도구의 스키마 상한을 처리 한도에 맞추고 안내한다.
//   ④ 토큰이 있어야 하는 도구 6개가 tools/list 에 그대로 보이는데 설명 어디에도 「인증 필요」가 없었다.
//
// captured-config 검사는 tools/list 에 실제로 나가는 JSON 과 호출자에게 닿는 오류 문구를 보지 못한다.
// 그래서 실제 McpServer 에 registerTools 를 걸고 SDK in-memory 클라이언트로 **공개 컨텍스트** 호출을 한다.
import { createHash } from "node:crypto";

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { AuthInfo } from "@modelcontextprotocol/sdk/server/auth/types.js";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { registerTools } from "@/app/api/mcp/[transport]/implementation";
import { findForbiddenUserTerms } from "@/lib/grounded-generation-contract";
import {
  buildPublicContext,
  MCP_TOOL_NAMES,
  PUBLIC_MCP_TOOL_SCOPES,
} from "@/lib/mcp-auth";
import { PUBLIC_ASK_QUESTION_MAX_CHARS } from "@/lib/public-work-budget";

const PUBLIC_AUTH: AuthInfo = {
  token: "",
  clientId: "safeclaw-mcp:public",
  scopes: [...PUBLIC_MCP_TOOL_SCOPES],
  extra: buildPublicContext(createHash("sha256").update("public:test").digest("hex")) as unknown as Record<string, unknown>,
};

const QUESTION = "가상 사업장 한빛물류 창고 지게차 팔레트 하역 작업 3명, 보행자 통로 인접, 주간";

let client: Client;

beforeEach(async () => {
  const server = new McpServer({ name: "safeclaw-test", version: "0.0.0" });
  registerTools(server);
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  // 실제 라우트(withMcpAuth)가 하는 일 — 요청마다 공개 AuthInfo 를 실어 보낸다.
  const send = clientTransport.send.bind(clientTransport);
  clientTransport.send = (message, options) => send(message, { ...options, authInfo: PUBLIC_AUTH });
  await server.connect(serverTransport);
  client = new Client({ name: "contract-test", version: "0.0.0" });
  await client.connect(clientTransport);
});

afterEach(async () => {
  await client.close();
});

type ToolText = { content: Array<{ type: string; text: string }>; isError?: boolean };

async function call(name: string, args: Record<string, unknown>): Promise<ToolText> {
  return await client.callTool({ name, arguments: args }) as ToolText;
}

function textOf(result: ToolText): string {
  return result.content.map((item) => item.text).join("\n");
}

describe("① 공개 호출의 generate_risk_assessment 모드", () => {
  it("스키마 mode 설명이 공개 호출은 template 로 고정된다고 적는다", async () => {
    const { tools } = await client.listTools();
    const tool = tools.find((item) => item.name === "generate_risk_assessment");
    const modeDescription = (tool?.inputSchema.properties?.mode as { description?: string } | undefined)?.description ?? "";
    expect(modeDescription).toMatch(/토큰 없는 공개 호출은[^.]*template/u);
    expect(tool?.description ?? "").toMatch(/modeDowngrade/u);
  });

  it.each([
    ["enhanced", { mode: "enhanced" }],
    ["full", { mode: "full" }],
    ["생략(기본값)", {}],
  ] as const)("요청 %s 를 template 로 내리면 결과에 요청·적용 모드와 이유를 적는다", async (_label, extra) => {
    const result = await call("generate_risk_assessment", { question: QUESTION, ...extra });
    expect(result.isError).toBeFalsy();
    const payload = JSON.parse(textOf(result)) as {
      mode: string;
      modeDowngrade?: { requestedMode: string; appliedMode: string; reason: string };
      sif: { count: number; reason?: string };
    };
    expect(payload.mode).toBe("template");
    expect(payload.modeDowngrade).toEqual({
      requestedMode: "mode" in extra ? extra.mode : "enhanced",
      appliedMode: "template",
      reason: expect.stringMatching(/토큰 없는 공개 호출/u),
    });
    // 공개 호출자는 enhanced·full 로 다시 부를 수 없다. SIF 0건 이유가 그것을 시키면 안 된다.
    if (payload.sif.count === 0) {
      expect(payload.sif.reason).toMatch(/토큰/u);
    }
  });

  it("새로 붙인 안내 문구(modeDowngrade.reason·공개 SIF 이유)에 사용자 금지 문구가 없다", async () => {
    const result = await call("generate_risk_assessment", { question: QUESTION, mode: "full" });
    const payload = JSON.parse(textOf(result)) as { modeDowngrade?: { reason: string }; sif: { reason?: string } };
    const texts = [payload.modeDowngrade?.reason ?? "", payload.sif.reason ?? ""];
    expect(texts[0]).not.toBe("");
    for (const text of texts) expect(findForbiddenUserTerms(text), text).toEqual([]);
  });

  it("template 를 직접 요청하면 내린 것이 아니므로 modeDowngrade 가 없다", async () => {
    const result = await call("generate_risk_assessment", { question: QUESTION, mode: "template" });
    const payload = JSON.parse(textOf(result)) as { modeDowngrade?: unknown };
    expect(payload.modeDowngrade).toBeUndefined();
  });
});

describe("② 빈·공백 question 은 입력 오류다", () => {
  it.each(["", "   ", "\n\t "])("generate_risk_assessment(%j) 는 예시 시나리오를 돌려주지 않고 거절한다", async (question) => {
    const result = await call("generate_risk_assessment", { question });
    expect(result.isError).toBe(true);
    const text = textOf(result);
    expect(text).toMatch(/작업 설명\(question\)이 비어 있습니다/u);
    expect(text).not.toMatch(/성수동/u);
  });

  it("tools/list 의 question 에 minLength 1 이 실린다", async () => {
    const { tools } = await client.listTools();
    for (const name of ["generate_risk_assessment", "generate_safety_docpack", "generate_reviewed_safety_docpack", "run_safeclaw_harness_agent"]) {
      const question = tools.find((item) => item.name === name)?.inputSchema.properties?.question as { minLength?: number } | undefined;
      expect(question?.minLength, name).toBe(1);
    }
  });
});

describe("③ question 길이 상한은 실제 처리 한도와 같다", () => {
  it("runAsk 를 쓰는 도구의 tools/list maxLength 는 PUBLIC_ASK_QUESTION_MAX_CHARS 다", async () => {
    const { tools } = await client.listTools();
    for (const name of ["generate_risk_assessment", "generate_safety_docpack", "generate_reviewed_safety_docpack"]) {
      const question = tools.find((item) => item.name === name)?.inputSchema.properties?.question as { maxLength?: number; description?: string } | undefined;
      expect(question?.maxLength, name).toBe(PUBLIC_ASK_QUESTION_MAX_CHARS);
      expect(question?.description, name).toMatch(/최대 1,200자/u);
    }
  });

  it("상한 글자 수는 처리하고, 하나 넘으면 내부 오류가 아니라 줄이라는 안내로 거절한다", async () => {
    const atLimit = `${QUESTION} `.repeat(40).slice(0, PUBLIC_ASK_QUESTION_MAX_CHARS);
    const ok = await call("generate_risk_assessment", { question: atLimit, mode: "template" });
    expect(ok.isError).toBeFalsy();
    expect(textOf(ok)).not.toMatch(/MCP_TOOL_INTERNAL_ERROR/u);

    const over = await call("generate_risk_assessment", { question: `${atLimit}가`, mode: "template" });
    expect(over.isError).toBe(true);
    const text = textOf(over);
    expect(text).not.toMatch(/MCP_TOOL_INTERNAL_ERROR/u);
    expect(text).toMatch(/1,200자까지/u);
  });
});

describe("④ 토큰이 있어야 하는 도구는 설명 첫 줄에 「인증 필요」를 적는다", () => {
  it("공개 스코프에 없는 도구 전부(tools/list 기준)", async () => {
    const { tools } = await client.listTools();
    const publicTools = new Set(PUBLIC_MCP_TOOL_SCOPES.map((scope) => scope.replace(/^tools:/u, "")));
    const listed = new Map(tools.map((tool) => [tool.name, tool.description ?? ""]));
    const tokenOnly = MCP_TOOL_NAMES.filter((name) => !publicTools.has(name));
    expect(tokenOnly.length).toBeGreaterThan(0);
    for (const name of tokenOnly) {
      const firstLine = (listed.get(name) ?? "").split("\n")[0] ?? "";
      expect(firstLine, name).toMatch(/^인증 필요/u);
    }
    for (const name of publicTools) {
      expect(listed.get(name) ?? "", name).not.toMatch(/^인증 필요/u);
    }
  });
});
