import type { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { ClawChatEvent } from "@/lib/agent-loop";

const openClawCalls: string[] = [];

type OpenClawChatRunInput = {
  emit: (event: ClawChatEvent) => void;
};

vi.mock("@/lib/openclaw-chat", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/openclaw-chat")>();
  return {
    ...actual,
    assertOpenClawOpenAiOAuth: vi.fn(async () => {
      openClawCalls.push("oauth-status");
      return {
        ok: true,
        provider: "openai",
        authProvider: "openai/oauth",
        model: "openai/gpt-5.5",
        checkedAt: "2026-07-09T00:00:00.000Z",
        message: "mock oauth ok",
      };
    }),
    runOpenClawChat: vi.fn(async (input: OpenClawChatRunInput) => {
      openClawCalls.push("agent-run");
      input.emit({ kind: "text-delta", text: "OpenClaw route OK" });
    }),
  };
});

const originalClawChatProvider = process.env.CLAW_CHAT_PROVIDER;

afterEach(() => {
  openClawCalls.length = 0;
  if (originalClawChatProvider === undefined) {
    delete process.env.CLAW_CHAT_PROVIDER;
  } else {
    process.env.CLAW_CHAT_PROVIDER = originalClawChatProvider;
  }
});

describe("/api/agent/chat OpenClaw OAuth route", () => {
  it("does not fall back to the legacy Anthropic chat provider flag", async () => {
    process.env.CLAW_CHAT_PROVIDER = "anthropic";
    const { POST } = await import("@/app/api/agent/chat/route");
    const request = new Request("https://www.safeclaw.kr/api/agent/chat", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-forwarded-for": "203.0.113.71",
      },
      body: JSON.stringify({ message: "오늘 작업 위험을 봐줘" }),
    }) as NextRequest;

    const response = await POST(request);
    const body = await response.text();

    expect(response.status).toBe(200);
    expect(body).toContain("openclaw_oauth_agent");
    expect(body).toContain("OpenClaw OpenAI OAuth 상태 확인 중");
    expect(body).toContain("OpenClaw OpenAI OAuth 상태 확인 완료");
    expect(body).toContain("OpenClaw 에이전트 실행 중");
    expect(body).toContain("OpenClaw route OK");
    expect(body).toContain("\"kind\":\"final\"");
    expect(openClawCalls).toEqual(["oauth-status", "agent-run"]);
  });
});
