import type { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { ClawChatEvent } from "@/lib/agent-loop";

type OpenClawChatRunInput = {
  emit: (event: ClawChatEvent) => void;
};

vi.mock("@/lib/openclaw-chat", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/openclaw-chat")>();
  return {
    ...actual,
    runOpenClawChat: vi.fn(async (input: OpenClawChatRunInput) => {
      input.emit({ kind: "text-delta", text: "OpenClaw route OK" });
    }),
  };
});

const originalClawChatProvider = process.env.CLAW_CHAT_PROVIDER;

afterEach(() => {
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
    expect(body).toContain("OpenClaw OpenAI OAuth 연결 중");
    expect(body).toContain("OpenClaw route OK");
    expect(body).toContain("\"kind\":\"final\"");
  });
});
