import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

import type { ClawChatEvent, ClawHistoryMessage } from "./agent-loop";

export type OpenClawChatConfig = {
  bin: string;
  profile: string;
  agent: string;
  local: boolean;
  timeoutMs: number;
};

export const DEFAULT_OPENCLAW_CHAT_TIMEOUT_MS = 240_000;

type EnvLike = Record<string, string | undefined>;

function positiveInt(value: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export function resolveOpenClawChatConfig(env: EnvLike): OpenClawChatConfig {
  return {
    bin: env.OPENCLAW_BIN?.trim() || "openclaw",
    profile: env.OPENCLAW_PROFILE?.trim() || "safeclaw",
    agent: env.OPENCLAW_AGENT?.trim() || "main",
    local: env.OPENCLAW_LOCAL?.trim() !== "0",
    timeoutMs: positiveInt(env.OPENCLAW_CHAT_TIMEOUT_MS, DEFAULT_OPENCLAW_CHAT_TIMEOUT_MS)
  };
}

export function resolveOpenClawSpawn(config: OpenClawChatConfig, prompt: string): {
  command: string;
  args: string[];
} {
  const args = buildOpenClawChatArgs(config, prompt);
  const defaultWindowsMjs = process.env.APPDATA
    ? path.join(process.env.APPDATA, "npm", "node_modules", "openclaw", "openclaw.mjs")
    : null;
  if (
    process.platform === "win32"
    && (config.bin === "openclaw" || config.bin === "openclaw.cmd")
    && defaultWindowsMjs
    && fs.existsSync(defaultWindowsMjs)
  ) {
    return { command: process.execPath, args: [defaultWindowsMjs, ...args] };
  }
  return { command: config.bin, args };
}

export function buildOpenClawChatArgs(config: OpenClawChatConfig, prompt: string): string[] {
  return [
    "--profile",
    config.profile,
    "agent",
    "--agent",
    config.agent,
    ...(config.local ? ["--local"] : []),
    "-m",
    prompt
  ];
}

export function buildOpenClawChatPrompt(input: {
  systemPrompt: string;
  history: ClawHistoryMessage[];
  message: string;
}): string {
  const historyLines = input.history.slice(-6).map((entry) => (
    `${entry.role === "user" ? "사용자" : "클로"}: ${entry.content}`
  ));
  return [
    "[SafeClaw 내장 Claw chat request]",
    "아래 시스템 원칙을 따르되, SafeClaw MCP 도구가 필요하면 먼저 호출하세요.",
    "특히 오늘 작업 검토는 run_safeclaw_harness_agent를 우선 호출하고, DB harness packet 밖의 근거를 만들지 마세요.",
    "",
    "[시스템 원칙]",
    input.systemPrompt,
    "",
    historyLines.length ? "[최근 대화]" : "",
    ...historyLines,
    "",
    "[사용자 요청]",
    input.message
  ].filter((line) => line !== "").join("\n");
}

export async function runOpenClawChat(input: {
  config: OpenClawChatConfig;
  prompt: string;
  emit: (event: ClawChatEvent) => void;
}): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const command = resolveOpenClawSpawn(input.config, input.prompt);
    const child = spawn(command.command, command.args, {
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"]
    });
    let stderr = "";
    let settled = false;
    const timeout = setTimeout(() => {
      if (settled) return;
      settled = true;
      child.kill();
      reject(new Error(`OpenClaw chat timed out after ${input.config.timeoutMs}ms`));
    }, input.config.timeoutMs);

    child.stdout.on("data", (chunk: Buffer) => {
      const text = chunk.toString();
      if (text) input.emit({ kind: "text-delta", text });
    });
    child.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString();
    });
    child.on("error", (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      reject(error);
    });
    child.on("close", (code, signal) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      if (code === 0) {
        resolve();
        return;
      }
      const suffix = stderr.trim() ? `: ${stderr.trim().slice(0, 1200)}` : "";
      reject(new Error(`OpenClaw chat failed (code=${code ?? "null"}, signal=${signal ?? "none"})${suffix}`));
    });
  });
}
