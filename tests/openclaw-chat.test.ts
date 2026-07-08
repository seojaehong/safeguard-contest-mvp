import { describe, expect, it } from "vitest";

import {
  buildOpenClawChatArgs,
  buildOpenClawChatPrompt,
  buildOpenClawStatusArgs,
  parseOpenClawOAuthStatusOutput,
  resolveOpenClawChatConfig,
  resolveOpenClawSpawn
} from "@/lib/openclaw-chat";

describe("OpenClaw chat routing", () => {
  it("builds a safeclaw local agent command that uses the profile OAuth runtime", () => {
    const config = resolveOpenClawChatConfig({});
    expect(config).toMatchObject({
      bin: "openclaw",
      profile: "safeclaw",
      agent: "main",
      model: "openai/gpt-5.5",
      requiredAuthProvider: "openai/oauth",
      local: true
    });

    expect(buildOpenClawChatArgs(config, "성수동 외벽 도장 작업")).toEqual([
      "--profile",
      "safeclaw",
      "agent",
      "--agent",
      "main",
      "--local",
      "--model",
      "openai/gpt-5.5",
      "-m",
      "성수동 외벽 도장 작업"
    ]);
    expect(buildOpenClawStatusArgs(config)).toEqual(["--profile", "safeclaw", "models", "status", "--json"]);
  });

  it("ignores legacy chat provider flags and keeps the OpenClaw OAuth runtime", () => {
    const config = resolveOpenClawChatConfig({
      CLAW_CHAT_PROVIDER: "anthropic",
      ANTHROPIC_API_KEY: "anthropic-placeholder",
      ANTHROPIC_MODEL: "claude-sonnet-5",
      OPENCLAW_PROFILE: "safeclaw",
      OPENCLAW_AGENT: "main"
    });

    expect(config.requiredAuthProvider).toBe("openai/oauth");
    expect(config.model).toBe("openai/gpt-5.5");
    expect(buildOpenClawChatArgs(config, "테스트")).toEqual([
      "--profile",
      "safeclaw",
      "agent",
      "--agent",
      "main",
      "--local",
      "--model",
      "openai/gpt-5.5",
      "-m",
      "테스트"
    ]);
  });

  it("rejects non-OpenAI model overrides for the Claw chat route", () => {
    expect(resolveOpenClawChatConfig({ OPENCLAW_MODEL: "anthropic/claude-opus-4.8" }).model).toBe(
      "openai/gpt-5.5"
    );
    expect(resolveOpenClawChatConfig({ OPENCLAW_CHAT_MODEL: "openai/gpt-5.5-thinking" }).model).toBe(
      "openai/gpt-5.5-thinking"
    );
  });

  it("resolves the Windows npm shim to node plus openclaw.mjs when available", () => {
    const config = resolveOpenClawChatConfig({});
    const command = resolveOpenClawSpawn(config, "ping");

    if (process.platform === "win32" && process.env.APPDATA) {
      expect(command.command === process.execPath || command.command === "openclaw").toBe(true);
    } else {
      expect(command.command).toBe("openclaw");
    }
    expect(command.args).toContain("--profile");
    expect(command.args).toContain("safeclaw");
    expect(command.args).toContain("ping");
  });

  it("injects the DB harness priority into the OpenClaw prompt", () => {
    const prompt = buildOpenClawChatPrompt({
      systemPrompt: "당신은 클로입니다.",
      history: [{ role: "assistant", content: "이전 답변" }],
      message: "오늘 작업 위험을 봐줘"
    });

    expect(prompt).toContain("run_safeclaw_harness_agent");
    expect(prompt).toContain("OpenAI OAuth");
    expect(prompt).toContain("DB harness packet 밖의 근거를 만들지 마세요");
    expect(prompt).toContain("오늘 작업 위험을 봐줘");
  });

  it("accepts OpenClaw status output only when OpenAI OAuth is usable", () => {
    const config = resolveOpenClawChatConfig({});
    const status = parseOpenClawOAuthStatusOutput(
      [
        "Your OpenClaw config was written by another version.",
        JSON.stringify({
          defaultModel: "openai/gpt-5.5",
          resolvedDefault: "openai/gpt-5.5",
          auth: {
            providers: [
              {
                provider: "openai",
                profiles: { count: 1, oauth: 1, token: 0, apiKey: 0 },
              },
            ],
            runtimeAuthRoutes: [
              { provider: "openai", runtime: "codex", authProvider: "openai", status: "usable" },
            ],
            oauth: {
              providers: [
                {
                  provider: "openai",
                  status: "ok",
                  effectiveProfiles: [
                    { provider: "openai", type: "oauth", status: "ok", source: "store" },
                  ],
                },
              ],
            },
          },
        }),
      ].join("\n"),
      config
    );

    expect(status).toMatchObject({
      ok: true,
      provider: "openai",
      authProvider: "openai/oauth",
      model: "openai/gpt-5.5",
    });
  });

  it("rejects OpenAI API-key-only status for the Claw chat route", () => {
    const config = resolveOpenClawChatConfig({});
    expect(() => parseOpenClawOAuthStatusOutput(
      JSON.stringify({
        defaultModel: "openai/gpt-5.5",
        resolvedDefault: "openai/gpt-5.5",
        auth: {
          providers: [
            {
              provider: "openai",
              profiles: { count: 1, oauth: 0, token: 0, apiKey: 1 },
            },
          ],
          runtimeAuthRoutes: [
            { provider: "openai", runtime: "codex", authProvider: "openai", status: "usable" },
          ],
          oauth: {
            providers: [
              {
                provider: "openai",
                status: "static",
                effectiveProfiles: [
                  { provider: "openai", type: "api_key", status: "static", source: "env" },
                ],
              },
            ],
          },
        },
      }),
      config
    )).toThrow("OpenClaw safeclaw profile is not ready for OpenAI OAuth chat");
  });
});
