import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { randomUUID } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import type { ClawChatEvent, ClawHistoryMessage } from "./agent-loop";
import {
  BrokerError,
  ENGINE_ADAPTER_CONTRACT_VERSION,
  SAFECLAW_ENGINE_AUTHORITY,
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
export const OPENCLAW_MAX_OUTPUT_BYTES = 256 * 1_024;
export const OPENCLAW_TERMINATION_GRACE_MS = 1_000;
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

export function resolveOpenClawSpawn(config: OpenClawChatConfig, messageFilePath: string): {
  command: string;
  args: string[];
} {
  return resolveOpenClawCommand(config, buildOpenClawChatArgs(config, messageFilePath));
}

export function resolveOpenClawCommand(config: OpenClawChatConfig, args: string[]): {
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

const OPENCLAW_CHILD_ENV_ALLOWLIST = new Set([
  "APPDATA",
  "COMSPEC",
  "FORCE_COLOR",
  "HOME",
  "HOMEDRIVE",
  "HOMEPATH",
  "LANG",
  "LC_ALL",
  "LC_CTYPE",
  "LOCALAPPDATA",
  "NO_COLOR",
  "NODE_ENV",
  "PATH",
  "PATHEXT",
  "PROGRAMDATA",
  "PROGRAMFILES",
  "PROGRAMFILES(X86)",
  "PROGRAMW6432",
  "SYSTEMROOT",
  "TEMP",
  "TERM",
  "TMP",
  "TZ",
  "USERPROFILE",
  "WINDIR",
]);

function resolveOpenClawChildEnv(source: EnvLike): NodeJS.ProcessEnv {
  const nodeEnv = source.NODE_ENV === "development" || source.NODE_ENV === "test"
    ? source.NODE_ENV
    : "production";
  const childEnv: NodeJS.ProcessEnv = {
    NODE_ENV: nodeEnv,
  };
  for (const [key, value] of Object.entries(source)) {
    if (
      key.toUpperCase() !== "NODE_ENV"
      && value !== undefined
      && OPENCLAW_CHILD_ENV_ALLOWLIST.has(key.toUpperCase())
    ) {
      childEnv[key] = value;
    }
  }
  return childEnv;
}

export function resolveSpawnOptions(env: EnvLike = process.env): {
  shell: false;
  windowsHide: true;
  stdio: ["ignore", "pipe", "pipe"];
  env: NodeJS.ProcessEnv;
} {
  return {
    shell: false,
    windowsHide: true,
    stdio: ["ignore", "pipe", "pipe"],
    env: resolveOpenClawChildEnv(env),
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
  return [
    "--profile",
    config.profile,
    "models",
    "status",
    "--agent",
    config.agent,
    "--json",
  ];
}

export function buildOpenClawChatArgs(
  config: OpenClawChatConfig,
  messageFilePath: string,
  sessionKey?: string,
): string[] {
  return [
    "--profile",
    config.profile,
    "agent",
    "--agent",
    config.agent,
    ...(config.local ? ["--local"] : []),
    "--model",
    config.model,
    ...(sessionKey ? ["--session-key", `agent:${config.agent}:${sessionKey}`] : []),
    "--message-file",
    messageFilePath,
  ];
}

function createOpenClawMessageFile(prompt: string): { directoryPath: string; filePath: string } {
  const directoryPath = fs.mkdtempSync(path.join(os.tmpdir(), "safeclaw-openclaw-"));
  try {
    fs.chmodSync(directoryPath, 0o700);
    const filePath = path.join(directoryPath, "message.txt");
    fs.writeFileSync(filePath, prompt, { encoding: "utf8", flag: "wx", mode: 0o600 });
    return { directoryPath, filePath };
  } catch (error) {
    fs.rmSync(directoryPath, { force: true, recursive: true });
    throw error;
  }
}

function removeOpenClawMessageFile(directoryPath: string): Error | null {
  try {
    fs.rmSync(directoryPath, { force: true, recursive: true });
    return null;
  } catch (error) {
    return error instanceof Error ? error : new Error(String(error));
  }
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
    const effectiveProfiles = asArray(provider?.effectiveProfiles);
    return effectiveProfiles.length > 0 && effectiveProfiles.every((profileValue) => {
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
  const oauthCount = asNumber(profiles?.oauth);
  return oauthCount > 0
    && asNumber(profiles?.count) === oauthCount
    && asNumber(profiles?.token) === 0
    && asNumber(profiles?.apiKey) === 0;
}

function hasUsableOpenAiRuntime(auth: JsonRecord | null): boolean {
  return asArray(auth?.runtimeAuthRoutes).some((routeValue) => {
    const route = asRecord(routeValue);
    const effective = asRecord(route?.effective);
    return asString(route?.provider) === "openai"
      && asString(route?.status) === "usable"
      && asString(effective?.kind) === "profiles";
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

export type OpenClawSpawnProcess = (
  command: string,
  args: string[],
  options: ReturnType<typeof resolveSpawnOptions>,
) => ChildProcessWithoutNullStreams;

export type AssertOpenClawOpenAiOAuth = (
  config: OpenClawChatConfig,
  signal?: AbortSignal,
) => Promise<OpenClawOAuthStatus>;

export function createOpenClawOAuthStatusChecker(dependencies: {
  spawnProcess?: OpenClawSpawnProcess;
  maxOutputBytes?: number;
  terminationGraceMs?: number;
} = {}): AssertOpenClawOpenAiOAuth {
  const spawnProcess = dependencies.spawnProcess ?? spawn;
  const maxOutputBytes = dependencies.maxOutputBytes ?? OPENCLAW_MAX_OUTPUT_BYTES;
  const terminationGraceMs = dependencies.terminationGraceMs ?? OPENCLAW_TERMINATION_GRACE_MS;

  return async function checkOpenClawOAuthStatus(
    config: OpenClawChatConfig,
    signal?: AbortSignal,
  ): Promise<OpenClawOAuthStatus> {
    return await new Promise<OpenClawOAuthStatus>((resolve, reject) => {
      if (signal?.aborted) {
        reject(signal.reason ?? new BrokerError("ENGINE_EXECUTION_FAILED", 500));
        return;
      }

      const command = resolveOpenClawCommand(config, buildOpenClawStatusArgs(config));
      const child = spawnProcess(command.command, command.args, resolveSpawnOptions());
      let stdout = "";
      let stdoutBytes = 0;
      let closeObserved = false;
      let terminationError: unknown = null;
      let terminationTimer: ReturnType<typeof setTimeout> | null = null;
      const terminate = (error: unknown): void => {
        if (terminationError || closeObserved) return;
        terminationError = error;
        child.kill();
        terminationTimer = setTimeout(() => {
          if (closeObserved) return;
          closeObserved = true;
          child.kill("SIGKILL");
          clearTimeout(timeout);
          signal?.removeEventListener("abort", abort);
          reject(error);
        }, terminationGraceMs);
      };
      const abort = (): void => terminate(
        signal?.reason ?? new BrokerError("ENGINE_EXECUTION_FAILED", 500),
      );
      signal?.addEventListener("abort", abort, { once: true });
      const timeout = setTimeout(() => {
        terminate(new Error(`OpenClaw OAuth status check timed out after ${OAUTH_STATUS_TIMEOUT_MS}ms`));
      }, OAUTH_STATUS_TIMEOUT_MS);

      child.stdout.on("data", (chunk: Buffer) => {
        stdoutBytes += chunk.byteLength;
        if (stdoutBytes > maxOutputBytes) {
          terminate(new Error(`OpenClaw OAuth status output exceeded ${maxOutputBytes} bytes`));
          return;
        }
        stdout += chunk.toString();
      });
      child.stderr.on("data", () => undefined);
      child.on("error", (error) => terminate(error));
      child.on("close", (code, closeSignal) => {
        if (closeObserved) return;
        closeObserved = true;
        clearTimeout(timeout);
        if (terminationTimer) clearTimeout(terminationTimer);
        signal?.removeEventListener("abort", abort);
        if (terminationError) {
          reject(terminationError);
          return;
        }
        if (code !== 0) {
          reject(new Error(
            `OpenClaw OAuth status check failed (code=${code ?? "null"}, signal=${closeSignal ?? "none"})`,
          ));
          return;
        }
        try {
          resolve(parseOpenClawOAuthStatusOutput(stdout, config));
        } catch (error) {
          reject(error);
        }
      });
    });
  };
}

const checkOpenClawOAuthStatus = createOpenClawOAuthStatusChecker();

export async function assertOpenClawOpenAiOAuth(
  config: OpenClawChatConfig,
  signal?: AbortSignal,
): Promise<OpenClawOAuthStatus> {
  if (signal?.aborted) {
    throw signal.reason ?? new BrokerError("ENGINE_EXECUTION_FAILED", 500);
  }
  const key = `${config.bin}|${config.profile}|${config.agent}|${config.model}|${config.requiredAuthProvider}`;
  const now = Date.now();
  if (oauthStatusCache && oauthStatusCache.key === key && oauthStatusCache.expiresAt > now) {
    return oauthStatusCache.status;
  }

  const status = await checkOpenClawOAuthStatus(config, signal);

  oauthStatusCache = { key, expiresAt: now + OAUTH_STATUS_CACHE_MS, status };
  return status;
}

export function createOpenClawBrokerSessionKey(): string {
  return `broker-${randomUUID()}`;
}

export function createOpenClawChatRunner(dependencies: {
  spawnProcess?: OpenClawSpawnProcess;
  maxOutputBytes?: number;
  terminationGraceMs?: number;
} = {}) {
  const spawnProcess = dependencies.spawnProcess ?? spawn;
  const maxOutputBytes = dependencies.maxOutputBytes ?? OPENCLAW_MAX_OUTPUT_BYTES;
  const terminationGraceMs = dependencies.terminationGraceMs ?? OPENCLAW_TERMINATION_GRACE_MS;

  return async function runOpenClawChat(input: {
  config: OpenClawChatConfig;
  prompt: string;
  emit: (event: ClawChatEvent) => void;
  signal?: AbortSignal;
}): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    if (input.signal?.aborted) {
      reject(input.signal.reason ?? new BrokerError("ENGINE_EXECUTION_FAILED", 500));
      return;
    }
    const messageFile = createOpenClawMessageFile(input.prompt);
    let messageFileRemoved = false;
    const removeMessageFile = (): Error | null => {
      if (messageFileRemoved) return null;
      messageFileRemoved = true;
      return removeOpenClawMessageFile(messageFile.directoryPath);
    };
    const rejectAfterCleanup = (error: unknown): void => {
      const cleanupError = removeMessageFile();
      if (cleanupError) {
        reject(new AggregateError([error, cleanupError], "OpenClaw chat failed and message cleanup failed"));
        return;
      }
      reject(error);
    };
    const resolveAfterCleanup = (): void => {
      const cleanupError = removeMessageFile();
      if (cleanupError) {
        reject(cleanupError);
        return;
      }
      resolve();
    };
    const sessionKey = createOpenClawBrokerSessionKey();
    const command = resolveOpenClawCommand(
      input.config,
      buildOpenClawChatArgs(input.config, messageFile.filePath, sessionKey),
    );
    let child: ChildProcessWithoutNullStreams;
    try {
      child = spawnProcess(command.command, command.args, resolveSpawnOptions());
    } catch (error) {
      rejectAfterCleanup(error);
      return;
    }
    let closeObserved = false;
    let terminationError: unknown = null;
    let outputBytes = 0;
    let terminationTimer: ReturnType<typeof setTimeout> | null = null;
    const timeout = setTimeout(() => {
      terminate(new BrokerError("ENGINE_TIMEOUT", 503));
    }, input.config.timeoutMs);
    const terminate = (error: unknown): void => {
      if (terminationError || closeObserved) return;
      terminationError = error;
      child.kill();
      terminationTimer = setTimeout(() => {
        if (closeObserved) return;
        closeObserved = true;
        child.kill("SIGKILL");
        clearTimeout(timeout);
        input.signal?.removeEventListener("abort", abort);
        rejectAfterCleanup(error);
      }, terminationGraceMs);
    };
    const abort = (): void => terminate(input.signal?.reason ?? new BrokerError("ENGINE_EXECUTION_FAILED", 500));
    input.signal?.addEventListener("abort", abort, { once: true });

    child.stdout.on("data", (chunk: Buffer) => {
      outputBytes += chunk.byteLength;
      if (outputBytes > maxOutputBytes) {
        terminate(new BrokerError(
          "ENGINE_EXECUTION_FAILED",
          503,
          new Error(`OpenClaw output exceeded ${maxOutputBytes} bytes`),
        ));
        return;
      }
      const text = chunk.toString();
      if (text) input.emit({ kind: "text-delta", text });
    });
    child.stderr.on("data", () => undefined);
    child.on("error", (error) => {
      terminate(error);
    });
    child.on("close", (code, signal) => {
      if (closeObserved) return;
      closeObserved = true;
      clearTimeout(timeout);
      if (terminationTimer) clearTimeout(terminationTimer);
      input.signal?.removeEventListener("abort", abort);
      if (terminationError) {
        rejectAfterCleanup(terminationError);
        return;
      }
      if (code === 0) {
        resolveAfterCleanup();
        return;
      }
      rejectAfterCleanup(new Error(`OpenClaw chat failed (code=${code ?? "null"}, signal=${signal ?? "none"})`));
    });
  });
  };
}

export const runOpenClawChat = createOpenClawChatRunner();

export type LocalOpenClawAdapterDependencies = {
  env: EnvLike;
  runtimeCapability?: (config: OpenClawChatConfig) => boolean | Promise<boolean>;
  verifySiteBinding: (
    context: BrokerRequestContext,
    config: OpenClawChatConfig,
  ) => boolean | Promise<boolean>;
  verifyExecutionAttestation?: (
    context: BrokerRequestContext,
    config: OpenClawChatConfig,
  ) => boolean | Promise<boolean>;
  assertOAuth?: AssertOpenClawOpenAiOAuth;
  runChat?: typeof runOpenClawChat;
};

export function createLocalOpenClawAdapter(
  dependencies: LocalOpenClawAdapterDependencies,
): EngineAdapter {
  const config = resolveOpenClawChatConfig(dependencies.env);
  const assertOAuth = dependencies.assertOAuth ?? assertOpenClawOpenAiOAuth;
  const runChat = dependencies.runChat ?? runOpenClawChat;
  const runtimeCapability = dependencies.runtimeCapability ?? hasLocalOpenClawCapability;

  async function assertRunnableContext(
    context: BrokerRequestContext,
    signal?: AbortSignal,
  ): Promise<void> {
    if (resolveEngineMode(dependencies.env) !== "local-openclaw" || !config.local) {
      throw new BrokerError("ENGINE_UNAVAILABLE", 503);
    }
    if (!await runtimeCapability(config)) {
      throw new BrokerError("ENGINE_RUNTIME_UNAVAILABLE", 503);
    }
    if (!await dependencies.verifySiteBinding(context, config)) {
      throw new BrokerError("ENGINE_SITE_BINDING_UNPROVEN", 503);
    }
    if (!await (dependencies.verifyExecutionAttestation?.(context, config) ?? false)) {
      throw new BrokerError("ENGINE_EXECUTION_ATTESTATION_UNPROVEN", 503);
    }
    await assertOAuth(config, signal);
  }

  return {
    id: "local-openclaw",
    contractVersion: ENGINE_ADAPTER_CONTRACT_VERSION,
    runtime: "openclaw",
    authority: SAFECLAW_ENGINE_AUTHORITY,
    capabilities: [],
    async checkAvailability(context, signal): Promise<void> {
      await assertRunnableContext(context, signal);
    },
    async run(input): Promise<void> {
      await assertRunnableContext(input.context, input.signal);
      await runChat({
        config,
        prompt: input.prompt,
        emit: input.emit,
        signal: input.signal,
      });
    },
  };
}
