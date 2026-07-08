import { describe, expect, it } from "vitest";

import {
  buildOpenClawChatArgs,
  buildOpenClawChatPrompt,
  resolveClawChatProvider,
  resolveOpenClawChatConfig,
  resolveOpenClawSpawn
} from "@/lib/openclaw-chat";

describe("OpenClaw chat routing", () => {
  it("defaults Claw chat to the OpenClaw OAuth provider", () => {
    expect(resolveClawChatProvider({})).toBe("openclaw");
    expect(resolveClawChatProvider({ CLAW_CHAT_PROVIDER: "openclaw" })).toBe("openclaw");
  });

  it("keeps Anthropic only as an explicit legacy override", () => {
    expect(resolveClawChatProvider({ CLAW_CHAT_PROVIDER: "anthropic" })).toBe("anthropic");
  });

  it("builds a safeclaw local agent command that uses the profile OAuth runtime", () => {
    const config = resolveOpenClawChatConfig({});
    expect(config).toMatchObject({
      bin: "openclaw",
      profile: "safeclaw",
      agent: "main",
      local: true
    });

    expect(buildOpenClawChatArgs(config, "성수동 외벽 도장 작업")).toEqual([
      "--profile",
      "safeclaw",
      "agent",
      "--agent",
      "main",
      "--local",
      "-m",
      "성수동 외벽 도장 작업"
    ]);
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
    expect(prompt).toContain("DB harness packet 밖의 근거를 만들지 마세요");
    expect(prompt).toContain("오늘 작업 위험을 봐줘");
  });
});
