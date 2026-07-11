import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

import type { ClawChatEvent, ClawHistoryMessage } from "./agent-loop";
import {
  BrokerError,
  ENGINE_TOOL_EFFECTS,
  resolveEngineMode,
  type BrokerRequestContext,
  type EngineAdapter,
  type EnvLike,
} from "./engine-adapter";

export type OpenClawChatConfig = {
  bin: string;
  profile: string;
  agent: string;
  model: string;
  requiredAuthProvider: "openai/oauth";
  local: boolean;
  timeoutMs: number;
};

export type OpenClawOAuthStatus = {
  ok: boolean;
  provider: "openai";
  authProvider: "openai/oauth";
  model: string;
  checkedAt: string;
  message: string;
};

export const DEFAULT_OPENCLAW_CHAT_MODEL = "openai/gpt-5.5";
export const DEFAULT_OPENCLAW_CHAT_TIMEOUT_MS = 240_000;
const OAUTH_STATUS_TIMEOUT_MS = 30_000;
const OAUTH_STATUS_CACHE_MS = 60_000;

type JsonRecord = Record<string, unknown>;

let oauthStatusCache: {
  key: string;
  expiresAt: number;
  status: OpenClawOAuthStatus;
} | null = null;

function positiveInt(value: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function openAiModel(value: string | undefined): string {
  const trimmed = value?.trim();
  return trimmed?.toLowerCase().startsWith("openai/") ? trimmed : DEFAULT_OPENCLAW_CHAT_MODEL;
}

export function resolveOpenClawChatConfig(env: EnvLike): OpenClawChatConfig {
  return {
    bin: env.OPENCLAW_BIN?.trim() || "openclaw",
    profile: env.OPENCLAW_PROFILE?.trim() || "safeclaw",
    agent: env.OPENCLAW_AGENT?.trim() || "main",
    model: openAiModel(env.OPENCLAW_CHAT_MODEL || env.OPENCLAW_MODEL),
    requiredAuthProvider: "openai/oauth",
    local: env.OPENCLAW_LOCAL?.trim() === "1",
    timeoutMs: positiveInt(env.OPENCLAW_CHAT_TIMEOUT_MS, DEFAULT_OPENCLAW_CHAT_TIMEOUT_MS)
  };
}

export function resolveOpenClawSpawn(config: OpenClawChatConfig, prompt: string): {
  command: string;
  args: string[];
} {
  return resolveOpenClawCommand(config, buildOpenClawChatArgs(config, prompt));
}

function resolveOpenClawCommand(config: OpenClawChatConfig, args: string[]): {
  command: string;
  args: string[];
} {
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

export function resolveSpawnOptions(): {
  shell: false;
  windowsHide: true;
  stdio: ["ignore", "pipe", "pipe"];
} {
  return {
    shell: false,
    windowsHide: true,
    stdio: ["ignore", "pipe", "pipe"],
  };
}

export function hasLocalOpenClawCapability(config: OpenClawChatConfig): boolean {
  if (path.isAbsolute(config.bin)) return fs.existsSync(config.bin);
  if (process.platform !== "win32" || !process.env.APPDATA) return false;
  const defaultWindowsMjs = path.join(
    process.env.APPDATA,
    "npm",
    "node_modules",
    "openclaw",
    "openclaw.mjs",
  );
  return fs.existsSync(defaultWindowsMjs);
}

export function buildOpenClawStatusArgs(config: OpenClawChatConfig): string[] {
  return ["--profile", config.profile, "models", "status", "--json"];
}

export function buildOpenClawChatArgs(config: OpenClawChatConfig, prompt: string): string[] {
  return [
    "--profile",
    config.profile,
    "agent",
    "--agent",
    config.agent,
    ...(config.local ? ["--local"] : []),
    "--model",
    config.model,
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
    "이 라우트는 OpenClaw safeclaw profile의 OpenAI OAuth 런타임에서 실행됩니다.",
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

function asRecord(value: unknown): JsonRecord | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value as JsonRecord : null;
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function asString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function asNumber(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function extractJsonObject(text: string): JsonRecord | null {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    return asRecord(JSON.parse(text.slice(start, end + 1)));
  } catch {
    return null;
  }
}

function hasOpenAiOauthProfile(auth: JsonRecord | null): boolean {
  const oauth = asRecord(auth?.oauth);
  const providers = asArray(oauth?.providers);
  return providers.some((providerValue) => {
    const provider = asRecord(providerValue);
    if (asString(provider?.provider) !== "openai") return false;
    if (asString(provider?.status) !== "ok") return false;
    return asArray(provider?.effectiveProfiles).some((profileValue) => {
      const profile = asRecord(profileValue);
      return asString(profile?.provider) === "openai"
        && asString(profile?.type) === "oauth"
        && asString(profile?.status) === "ok";
    });
  });
}

function hasOnlyOpenAiOauthProfile(auth: JsonRecord | null): boolean {
  const providers = asArray(auth?.providers);
  const openAi = providers
    .map((providerValue) => asRecord(providerValue))
    .find((provider) => asString(provider?.provider) === "openai");
  const profiles = asRecord(openAi?.profiles);
  return asNumber(profiles?.oauth) > 0 && asNumber(profiles?.apiKey) === 0;
}

function hasUsableOpenAiRuntime(auth: JsonRecord | null): boolean {
  return asArray(auth?.runtimeAuthRoutes).some((routeValue) => {
    const route = asRecord(routeValue);
    return asString(route?.provider) === "openai" && asString(route?.status) === "usable";
  });
}

export function parseOpenClawOAuthStatusOutput(
  output: string,
  config: Pick<OpenClawChatConfig, "model" | "requiredAuthProvider">
): OpenClawOAuthStatus {
  const status = extractJsonObject(output);
  if (!status) {
    throw new Error("OpenClaw OAuth status check did not return JSON.");
  }

  const resolvedDefault = asString(status.resolvedDefault) || asString(status.defaultModel);
  const auth = asRecord(status.auth);
  const openAiModel = config.model.toLowerCase().startsWith("openai/");
  const oauthProfileOk = hasOpenAiOauthProfile(auth);
  const oauthOnlyProfileOk = hasOnlyOpenAiOauthProfile(auth);
  const runtimeOk = hasUsableOpenAiRuntime(auth);
  if (!openAiModel || !oauthProfileOk || !oauthOnlyProfileOk || !runtimeOk) {
    throw new Error(
      [
        "OpenClaw safeclaw profile is not ready for OpenAI OAuth chat.",
        `model=${config.model}`,
        `resolvedDefault=${resolvedDefault || "unknown"}`,
        `requiredAuthProvider=${config.requiredAuthProvider}`,
      ].join(" ")
    );
  }

  return {
    ok: true,
    provider: "openai",
    authProvider: "openai/oauth",
    model: config.model,
    checkedAt: new Date().toISOString(),
    message: "OpenClaw OpenAI OAuth profile is usable.",
  };
}

export async function assertOpenClawOpenAiOAuth(config: OpenClawChatConfig): Promise<OpenClawOAuthStatus> {
  const key = `${config.bin}|${config.profile}|${config.agent}|${config.model}|${config.requiredAuthProvider}`;
  const now = Date.now();
  if (oauthStatusCache && oauthStatusCache.key === key && oauthStatusCache.expiresAt > now) {
    return oauthStatusCache.status;
  }

  const status = await new Promise<OpenClawOAuthStatus>((resolve, reject) => {
    const command = resolveOpenClawCommand(config, buildOpenClawStatusArgs(config));
    const child = spawn(command.command, command.args, resolveSpawnOptions());
    let stdout = "";
    let stderr = "";
    let settled = false;
    const timeout = setTimeout(() => {
      if (settled) return;
      settled = true;
      child.kill();
      reject(new Error(`OpenClaw OAuth status check timed out after ${OAUTH_STATUS_TIMEOUT_MS}ms`));
    }, OAUTH_STATUS_TIMEOUT_MS);

    child.stdout.on("data", (chunk: Buffer) => {
      stdout += chunk.toString();
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
      if (code !== 0) {
        reject(new Error(`OpenClaw OAuth status check failed (code=${code ?? "null"}, signal=${signal ?? "none"})`));
        return;
      }
      try {
        resolve(parseOpenClawOAuthStatusOutput(`${stdout}\n${stderr}`, config));
      } catch (error) {
        reject(error);
      }
    });
  });

  oauthStatusCache = { key, expiresAt: now + OAUTH_STATUS_CACHE_MS, status };
  return status;
}

export async function runOpenClawChat(input: {
  config: OpenClawChatConfig;
  prompt: string;
  emit: (event: ClawChatEvent) => void;
  signal?: AbortSignal;
}): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const command = resolveOpenClawSpawn(input.config, input.prompt);
    const child = spawn(command.command, command.args, resolveSpawnOptions());
    let stderr = "";
    let settled = false;
    const timeout = setTimeout(() => {
      if (settled) return;
      settled = true;
      child.kill();
      reject(new Error(`OpenClaw chat timed out after ${input.config.timeoutMs}ms`));
    }, input.config.timeoutMs);
    const abort = (): void => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      child.kill();
      reject(input.signal?.reason ?? new BrokerError("ENGINE_EXECUTION_FAILED", 500));
    };
    input.signal?.addEventListener("abort", abort, { once: true });

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
      input.signal?.removeEventListener("abort", abort);
      reject(error);
    });
    child.on("close", (code, signal) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      input.signal?.removeEventListener("abort", abort);
      if (code === 0) {
        resolve();
        return;
      }
      const suffix = stderr.trim() ? `: ${stderr.trim().slice(0, 1200)}` : "";
      reject(new Error(`OpenClaw chat failed (code=${code ?? "null"}, signal=${signal ?? "none"})${suffix}`));
    });
  });
}

export type LocalOpenClawAdapterDependencies = {
  env: EnvLike;
  runtimeCapability?: (config: OpenClawChatConfig) => boolean | Promise<boolean>;
  verifySiteBinding: (
    context: BrokerRequestContext,
    config: OpenClawChatConfig,
  ) => boolean | Promise<boolean>;
  assertOAuth?: typeof assertOpenClawOpenAiOAuth;
  runChat?: typeof runOpenClawChat;
};

export function createLocalOpenClawAdapter(
  dependencies: LocalOpenClawAdapterDependencies,
): EngineAdapter {
  const config = resolveOpenClawChatConfig(dependencies.env);
  const assertOAuth = dependencies.assertOAuth ?? assertOpenClawOpenAiOAuth;
  const runChat = dependencies.runChat ?? runOpenClawChat;
  const runtimeCapability = dependencies.runtimeCapability ?? hasLocalOpenClawCapability;

  async function assertRunnableContext(context: BrokerRequestContext): Promise<void> {
    if (resolveEngineMode(dependencies.env) !== "local-openclaw" || !config.local) {
      throw new BrokerError("ENGINE_UNAVAILABLE", 503);
    }
    if (!await runtimeCapability(config)) {
      throw new BrokerError("ENGINE_RUNTIME_UNAVAILABLE", 503);
    }
    if (!await dependencies.verifySiteBinding(context, config)) {
      throw new BrokerError("ENGINE_SITE_BINDING_UNPROVEN", 503);
    }
    await assertOAuth(config);
  }

  return {
    id: "local-openclaw",
    capabilities: ENGINE_TOOL_EFFECTS,
    async checkAvailability(context): Promise<void> {
      await assertRunnableContext(context);
    },
    async run(input): Promise<void> {
      await assertRunnableContext(input.context);
      await runChat({
        config,
        prompt: input.prompt,
        emit: input.emit,
        signal: input.signal,
      });
    },
  };
}
