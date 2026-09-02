// SafeClaw CLI (cli/) pure-logic tests. The CLI is an independent package
// (cli/package.json) — these tests import its lib.mjs directly and, for one
// smoke test, spawn the real executable as a child process.
import { describe, expect, it } from "vitest";
import { spawnSync } from "node:child_process";
import path from "node:path";

import {
  CliError,
  buildToolCallRequest,
  callTool,
  formatDocpack,
  formatEvidence,
  formatValidate,
  formatWeather,
  parseArgs,
  parseSseMessages,
  resolveConfig,
  validateDocpackArgs,
  validateExitCode,
  validateWeatherArgs,
} from "../cli/lib.mjs";

const CLI_ENTRY = path.resolve(__dirname, "..", "cli", "safeclaw.mjs");

describe("cli/lib.mjs — parseArgs", () => {
  it("returns help for no args and for --help/-h", () => {
    expect(parseArgs([])).toEqual({ help: true, command: null });
    expect(parseArgs(["--help"])).toEqual({ help: true, command: null });
    expect(parseArgs(["weather", "-h"])).toEqual({ help: true, command: "weather" });
  });

  it("rejects unknown commands with a usage error (exit 2)", () => {
    expect(() => parseArgs(["frobnicate"])).toThrow(CliError);
    try {
      parseArgs(["frobnicate"]);
      throw new Error("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(CliError);
      expect((err as CliError).exitCode).toBe(2);
    }
  });

  it("parses positional args and --mode/--json options for docpack", () => {
    const parsed = parseArgs(["docpack", "3층 비계 해체", "--mode", "enhanced", "--json"]);
    expect(parsed).toMatchObject({
      help: false,
      command: "docpack",
      positional: ["3층 비계 해체"],
      options: { mode: "enhanced", json: true },
    });
  });

  it("supports --mode=value form", () => {
    const parsed = parseArgs(["docpack", "질문", "--mode=template"]);
    expect(parsed.options).toMatchObject({ mode: "template" });
  });

  it("rejects unknown options", () => {
    expect(() => parseArgs(["weather", "서울", "--bogus"])).toThrow(CliError);
  });
});

describe("cli/lib.mjs — per-command validation", () => {
  it("validateDocpackArgs requires a question and a valid --mode", () => {
    expect(() => validateDocpackArgs({ positional: [], options: {} })).toThrow(CliError);
    expect(() =>
      validateDocpackArgs({ positional: ["질문"], options: { mode: "bogus" } })
    ).toThrow(CliError);
    expect(validateDocpackArgs({ positional: ["질문"], options: {} })).toEqual({
      question: "질문",
      mode: "full",
      json: false,
    });
  });

  it("validateWeatherArgs requires a region", () => {
    expect(() => validateWeatherArgs({ positional: [], options: {} })).toThrow(CliError);
    expect(validateWeatherArgs({ positional: ["서울"], options: {} })).toEqual({ region: "서울" });
  });
});

describe("cli/lib.mjs — resolveConfig", () => {
  it("throws CliError when SAFECLAW_TOKEN is missing", () => {
    expect(() => resolveConfig({})).toThrow(CliError);
    try {
      resolveConfig({});
    } catch (err) {
      expect((err as CliError).code).toBe("NO_TOKEN");
    }
  });

  it("defaults SAFECLAW_BASE and strips trailing slashes", () => {
    expect(resolveConfig({ SAFECLAW_TOKEN: "sc2_x" })).toEqual({
      token: "sc2_x",
      base: "https://www.safeclaw.kr",
    });
    expect(
      resolveConfig({
        SAFECLAW_TOKEN: "sc2_x",
        SAFECLAW_BASE: "http://localhost:3000/",
        SAFECLAW_ALLOW_INSECURE_HTTP: "true",
      })
    ).toEqual({ token: "sc2_x", base: "http://localhost:3000" });
  });

  it("rejects cleartext remote bases and requires an explicit loopback opt-in", () => {
    expect(() => resolveConfig({
      SAFECLAW_TOKEN: "sc2_x",
      SAFECLAW_BASE: "http://safeclaw.example.test",
      SAFECLAW_ALLOW_INSECURE_HTTP: "true",
    })).toThrowError(expect.objectContaining({ code: "INSECURE_BASE" }));
    expect(() => resolveConfig({
      SAFECLAW_TOKEN: "sc2_x",
      SAFECLAW_BASE: "http://127.0.0.1:3000",
    })).toThrowError(expect.objectContaining({ code: "INSECURE_BASE" }));
  });

  it("rejects credentials, query strings, and fragments in the base URL", () => {
    for (const base of [
      "https://user:pass@safeclaw.example.test",
      "https://safeclaw.example.test?target=other",
      "https://safeclaw.example.test#fragment",
    ]) {
      expect(() => resolveConfig({ SAFECLAW_TOKEN: "sc2_x", SAFECLAW_BASE: base }))
        .toThrowError(expect.objectContaining({ code: "INVALID_BASE" }));
    }
  });
});

describe("cli/lib.mjs — SSE / JSON-RPC transport parsing", () => {
  it("parses a Streamable-HTTP SSE tools/call response", () => {
    const body =
      'event: message\ndata: {"result":{"content":[{"type":"text","text":"{\\"ok\\":true}"}]},"jsonrpc":"2.0","id":1}\n\n';
    const messages = parseSseMessages(body);
    expect(messages).toHaveLength(1);
    expect(messages[0].id).toBe(1);
    expect((messages[0] as any).result.content[0].text).toBe('{"ok":true}');
  });

  it("falls back to raw JSON parsing when the body isn't SSE-framed", () => {
    const messages = parseSseMessages('{"jsonrpc":"2.0","id":5,"result":{"content":[]}}');
    expect(messages).toHaveLength(1);
    expect(messages[0].id).toBe(5);
  });

  it("buildToolCallRequest builds a well-formed JSON-RPC tools/call envelope", () => {
    const req = buildToolCallRequest(7, "get_weather_signals", { region: "서울" });
    expect(req).toEqual({
      jsonrpc: "2.0",
      id: 7,
      method: "tools/call",
      params: { name: "get_weather_signals", arguments: { region: "서울" } },
    });
  });
});

describe("cli/lib.mjs — callTool (injected fetch)", () => {
  it("returns parsed data on a 200 SSE response", async () => {
    let requestInit: RequestInit | undefined;
    const fetchImpl = async (_input: Parameters<typeof fetch>[0], init?: RequestInit) => {
      requestInit = init;
      return ({
      ok: true,
      status: 200,
      text: async () =>
        'event: message\ndata: {"jsonrpc":"2.0","id":1,"result":{"content":[{"type":"text","text":"{\\"region\\":\\"서울\\"}"}]}}\n\n',
      });
    };
    const { data, isError } = await callTool({
      base: "https://example.test",
      token: "t",
      tool: "get_weather_signals",
      args: { region: "서울" },
      timeoutMs: 1000,
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    expect(isError).toBe(false);
    expect(data).toEqual({ region: "서울" });
    expect(requestInit?.redirect).toBe("error");
  });

  it("maps HTTP 401 to a CliError with code AUTH", async () => {
    const fetchImpl = async () => ({
      ok: false,
      status: 401,
      text: async () => '{"error":"invalid_token","error_description":"No authorization provided"}',
    });
    await expect(
      callTool({
        base: "https://example.test",
        token: "bad",
        tool: "x",
        args: {},
        timeoutMs: 1000,
        fetchImpl: fetchImpl as unknown as typeof fetch,
      })
    ).rejects.toMatchObject({ code: "AUTH" });
  });

  it("maps HTTP 429 to a CliError with code RATE_LIMIT", async () => {
    const fetchImpl = async () => ({
      ok: false,
      status: 429,
      text: async () => '{"error":"too many requests"}',
    });
    await expect(
      callTool({
        base: "https://example.test",
        token: "t",
        tool: "x",
        args: {},
        timeoutMs: 1000,
        fetchImpl: fetchImpl as unknown as typeof fetch,
      })
    ).rejects.toMatchObject({ code: "RATE_LIMIT" });
  });
});

describe("cli/lib.mjs — output formatting & exit codes", () => {
  it("formatValidate lists removed citations and validateExitCode returns 1 when any were removed", () => {
    const data = { gatedText: "산업안전보건법령에 따라...", removedCitations: ["제999조"] };
    const text = formatValidate(data);
    expect(text).toContain("제999조");
    expect(validateExitCode(data)).toBe(1);
  });

  it("validateExitCode returns 0 when nothing was removed", () => {
    expect(validateExitCode({ gatedText: "ok", removedCitations: [] })).toBe(0);
  });

  it("formatWeather flags fallback regions", () => {
    const text = formatWeather({
      region: "서울",
      requestedRegion: "울릉도",
      resolvedRegion: "서울",
      fallbackRegion: true,
      summary: "맑음",
      actions: [],
      signals: [],
    });
    expect(text).toContain("울릉도");
    expect(text).toContain("지원 지역이 아니어서");
  });

  it("formatDocpack summarizes scenario, document previews, and evidence labels", () => {
    const text = formatDocpack({
      summary: "위험성평가 초안이 생성되었습니다.",
      scenario: {
        siteName: "성수 데모 현장",
        companyType: "건설업",
        workSummary: "3층 외벽 비계 해체 작업",
        workerCount: 4,
        weatherNote: "강풍주의보 발효 중",
      },
      mode: "full",
      documents: {
        riskAssessmentDraft: { preview: "1. 개요...", totalLength: 1200, truncated: true },
        kakaoMessage: "짧은 메시지",
      },
      evidenceLabels: { riskAssessmentDraft: { article: "시행령 제4조 제3호" } },
      fullDocumentsNote: "각 문서는 앞 500자 프리뷰입니다.",
    });
    expect(text).toContain("성수 데모 현장");
    expect(text).toContain("riskAssessmentDraft");
    expect(text).toContain("1200자");
    expect(text).toContain("시행령 제4조 제3호");
    expect(text).toContain("kakaoMessage");
  });

  it("formatEvidence renders the full mapping table when docType is omitted", () => {
    const text = formatEvidence({
      mapped: true,
      allMappings: { riskAssessment: { article: "시행령 제4조 제3호" } },
      note: "전체 매핑",
    });
    expect(text).toContain("riskAssessment");
    expect(text).toContain("시행령 제4조 제3호");
  });
});

describe("cli/safeclaw.mjs — process smoke test", () => {
  it("--help exits 0 and prints usage without requiring SAFECLAW_TOKEN", () => {
    const result = spawnSync(process.execPath, [CLI_ENTRY, "--help"], {
      encoding: "utf8",
      env: { ...process.env, SAFECLAW_TOKEN: "" },
    });
    expect(result.status).toBe(0);
    expect(result.stdout).toContain("safeclaw — SafeClaw MCP");
    expect(result.stdout).toContain("docpack");
  });

  it("exits 1 with a clear message when SAFECLAW_TOKEN is missing", () => {
    const env = { ...process.env };
    delete env.SAFECLAW_TOKEN;
    const result = spawnSync(process.execPath, [CLI_ENTRY, "weather", "서울"], {
      encoding: "utf8",
      env,
    });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("SAFECLAW_TOKEN");
  });

  it("exits 2 on usage errors (unknown command)", () => {
    const result = spawnSync(process.execPath, [CLI_ENTRY, "bogus-command"], { encoding: "utf8" });
    expect(result.status).toBe(2);
  });
});
