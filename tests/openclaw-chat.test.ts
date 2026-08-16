import { EventEmitter } from "node:events";
import fs from "node:fs";
import path from "node:path";
import { PassThrough } from "node:stream";
import type { ChildProcessWithoutNullStreams } from "node:child_process";

import { describe, expect, it, vi } from "vitest";

import {
  buildOpenClawChatArgs,
  buildOpenClawChatPrompt,
  buildOpenClawStatusArgs,
  parseOpenClawOAuthStatusOutput,
  resolveOpenClawChatConfig,
  resolveOpenClawSpawn,
  resolveSpawnOptions,
  createLocalOpenClawAdapter,
} from "@/lib/openclaw-chat";
import type { BrokerRequestContext } from "@/lib/engine-adapter";

describe("OpenClaw chat routing", () => {
  it("waits for deterministic child close after abort before resolving the run", async () => {
    const module = await import("@/lib/openclaw-chat") as typeof import("@/lib/openclaw-chat") & {
      createOpenClawChatRunner?: (dependencies: {
        spawnProcess: () => EventEmitter & {
          stdout: PassThrough;
          stderr: PassThrough;
          kill: ReturnType<typeof vi.fn>;
        };
      }) => (input: {
        config: ReturnType<typeof resolveOpenClawChatConfig>;
        prompt: string;
        emit: () => void;
        signal: AbortSignal;
      }) => Promise<void>;
    };
    expect(module.createOpenClawChatRunner).toBeTypeOf("function");
    if (!module.createOpenClawChatRunner) return;

    const child = Object.assign(new EventEmitter(), {
      stdout: new PassThrough(),
      stderr: new PassThrough(),
      kill: vi.fn(() => true),
    });
    const runChat = module.createOpenClawChatRunner({ spawnProcess: () => child });
    const controller = new AbortController();
    const run = runChat({
      config: resolveOpenClawChatConfig({ OPENCLAW_LOCAL: "1", OPENCLAW_CHAT_TIMEOUT_MS: "60000" }),
      prompt: "test",
      emit: () => undefined,
      signal: controller.signal,
    });
    let settled = false;
    void run.catch(() => { settled = true; });

    controller.abort(new Error("request cancelled"));
    await Promise.resolve();
    expect(child.kill).toHaveBeenCalledTimes(1);
    expect(settled).toBe(false);

    child.emit("close", null, "SIGTERM");
    await expect(run).rejects.toBeInstanceOf(Error);
  });

  it("rejects after the termination grace when a killed child never closes", async () => {
    const module = await import("@/lib/openclaw-chat");
    const child = Object.assign(new EventEmitter(), {
      stdout: new PassThrough(),
      stderr: new PassThrough(),
      kill: vi.fn(() => true),
    });
    const runChat = module.createOpenClawChatRunner({
      spawnProcess: () => child as unknown as ChildProcessWithoutNullStreams,
      terminationGraceMs: 10,
    });
    const controller = new AbortController();
    const reason = new Error("request cancelled");
    const run = runChat({
      config: resolveOpenClawChatConfig({ OPENCLAW_LOCAL: "1", OPENCLAW_CHAT_TIMEOUT_MS: "60000" }),
      prompt: "test",
      emit: () => undefined,
      signal: controller.signal,
    });

    controller.abort(reason);

    await expect(run).rejects.toBe(reason);
    expect(child.kill).toHaveBeenCalledWith();
    expect(child.kill).toHaveBeenCalledWith("SIGKILL");
  });

  it("terminates OpenClaw before emitting output beyond the cumulative byte budget", async () => {
    const module = await import("@/lib/openclaw-chat");
    const child = Object.assign(new EventEmitter(), {
      stdout: new PassThrough(),
      stderr: new PassThrough(),
      kill: vi.fn(() => true),
    });
    const emit = vi.fn();
    const runChat = module.createOpenClawChatRunner({
      spawnProcess: () => child as unknown as ChildProcessWithoutNullStreams,
      maxOutputBytes: 16,
      terminationGraceMs: 10,
    });
    const run = runChat({
      config: resolveOpenClawChatConfig({ OPENCLAW_LOCAL: "1", OPENCLAW_CHAT_TIMEOUT_MS: "60000" }),
      prompt: "test",
      emit,
    });

    child.stdout.write("a".repeat(17));

    await expect(run).rejects.toMatchObject({ code: "ENGINE_EXECUTION_FAILED", status: 503 });
    expect(emit).not.toHaveBeenCalled();
    expect(child.kill).toHaveBeenCalled();
  });

  it("does not spawn an already-aborted request", async () => {
    const module = await import("@/lib/openclaw-chat") as typeof import("@/lib/openclaw-chat") & {
      createOpenClawChatRunner?: (dependencies: { spawnProcess: ReturnType<typeof vi.fn> }) => typeof import("@/lib/openclaw-chat").runOpenClawChat;
    };
    expect(module.createOpenClawChatRunner).toBeTypeOf("function");
    if (!module.createOpenClawChatRunner) return;

    const spawnProcess = vi.fn();
    const runChat = module.createOpenClawChatRunner({ spawnProcess });
    const controller = new AbortController();
    controller.abort(new Error("cancelled before spawn"));

    await expect(runChat({
      config: resolveOpenClawChatConfig({ OPENCLAW_LOCAL: "1" }),
      prompt: "test",
      emit: () => undefined,
      signal: controller.signal,
    })).rejects.toBeInstanceOf(Error);
    expect(spawnProcess).not.toHaveBeenCalled();
  });

  it("builds a safeclaw local agent command that uses the profile OAuth runtime", () => {
    const config = resolveOpenClawChatConfig({ OPENCLAW_LOCAL: "1" });
    expect(config).toMatchObject({
      bin: "openclaw",
      profile: "safeclaw",
      agent: "main",
      model: "openai/gpt-5.5",
      requiredAuthProvider: "openai/oauth",
      local: true
    });

    expect(buildOpenClawChatArgs(config, "C:\\Users\\user\\AppData\\Local\\Temp\\message.txt", "broker-opaque-request-key")).toEqual([
      "--profile",
      "safeclaw",
      "agent",
      "--agent",
      "main",
      "--local",
      "--model",
      "openai/gpt-5.5",
      "--session-key",
      "agent:main:broker-opaque-request-key",
      "--message-file",
      "C:\\Users\\user\\AppData\\Local\\Temp\\message.txt",
    ]);
    expect(buildOpenClawStatusArgs(config)).toEqual([
      "--profile",
      "safeclaw",
      "models",
      "status",
      "--agent",
      "main",
      "--json",
    ]);
  });

  it("queries OAuth status for the exact configured agent and preserves child abort semantics", async () => {
    const module = await import("@/lib/openclaw-chat") as typeof import("@/lib/openclaw-chat") & {
      createOpenClawOAuthStatusChecker?: (dependencies: {
        spawnProcess: ReturnType<typeof vi.fn>;
      }) => (
        config: ReturnType<typeof resolveOpenClawChatConfig>,
        signal?: AbortSignal,
      ) => Promise<unknown>;
    };
    expect(module.createOpenClawOAuthStatusChecker).toBeTypeOf("function");
    if (!module.createOpenClawOAuthStatusChecker) return;

    const child = Object.assign(new EventEmitter(), {
      stdout: new PassThrough(),
      stderr: new PassThrough(),
      kill: vi.fn(() => true),
    });
    const spawnProcess = vi.fn(() => child);
    const checkOAuth = module.createOpenClawOAuthStatusChecker({ spawnProcess });
    const controller = new AbortController();
    const reason = new Error("preflight cancelled");
    const config = resolveOpenClawChatConfig({ OPENCLAW_AGENT: "field-operations" });
    const check = checkOAuth(config, controller.signal);
    let settled = false;
    void check.catch(() => { settled = true; });

    expect(spawnProcess).toHaveBeenCalledWith(
      expect.any(String),
      expect.arrayContaining(["--agent", "field-operations"]),
      expect.objectContaining({ shell: false }),
    );
    controller.abort(reason);
    await Promise.resolve();
    expect(child.kill).toHaveBeenCalledTimes(1);
    expect(settled).toBe(false);

    child.emit("close", null, "SIGTERM");
    await expect(check).rejects.toBe(reason);
  });

  it("ignores legacy chat provider flags and keeps the OpenClaw OAuth runtime", () => {
    const config = resolveOpenClawChatConfig({
      CLAW_CHAT_PROVIDER: "anthropic",
      ANTHROPIC_API_KEY: "anthropic-placeholder",
      ANTHROPIC_MODEL: "claude-sonnet-5",
      OPENCLAW_PROFILE: "safeclaw",
      OPENCLAW_AGENT: "main",
      OPENCLAW_LOCAL: "1"
    });

    expect(config.requiredAuthProvider).toBe("openai/oauth");
    expect(config.model).toBe("openai/gpt-5.5");
    expect(buildOpenClawChatArgs(config, "C:\\Temp\\message.txt")).toEqual([
      "--profile",
      "safeclaw",
      "agent",
      "--agent",
      "main",
      "--local",
      "--model",
      "openai/gpt-5.5",
      "--message-file",
      "C:\\Temp\\message.txt",
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
    const command = resolveOpenClawSpawn(config, "C:\\Temp\\message.txt");

    if (process.platform === "win32" && process.env.APPDATA) {
      expect(command.command === process.execPath || command.command === "openclaw").toBe(true);
    } else {
      expect(command.command).toBe("openclaw");
    }
    expect(command.args).toContain("--profile");
    expect(command.args).toContain("safeclaw");
    expect(command.args).toContain("C:\\Temp\\message.txt");
  });

  it("does not enable the local CLI flag without explicit server-only configuration", () => {
    expect(resolveOpenClawChatConfig({}).local).toBe(false);
    expect(resolveOpenClawChatConfig({ OPENCLAW_LOCAL: "1" }).local).toBe(true);
  });

  it("always spawns OpenClaw without a shell", () => {
    const options = resolveSpawnOptions({
      PATH: "C:\\Windows\\System32",
      APPDATA: "C:\\Users\\user\\AppData\\Roaming",
      SUPABASE_SERVICE_ROLE_KEY: "supabase-secret",
      OPENAI_API_KEY: "provider-secret",
      UPSTASH_REDIS_REST_TOKEN: "upstash-secret",
      REMOTE_HERMES_SIGNING_SECRET: "hermes-secret",
    });
    expect(options).toMatchObject({
      shell: false,
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"],
      env: {
        PATH: "C:\\Windows\\System32",
        APPDATA: "C:\\Users\\user\\AppData\\Roaming",
      },
    });
    expect(options.env).not.toHaveProperty("SUPABASE_SERVICE_ROLE_KEY");
    expect(options.env).not.toHaveProperty("OPENAI_API_KEY");
    expect(options.env).not.toHaveProperty("UPSTASH_REDIS_REST_TOKEN");
    expect(options.env).not.toHaveProperty("REMOTE_HERMES_SIGNING_SECRET");
  });

  it("passes prompts through a private message file and removes it after child close", async () => {
    const module = await import("@/lib/openclaw-chat");
    const child = Object.assign(new EventEmitter(), {
      stdout: new PassThrough(),
      stderr: new PassThrough(),
      kill: vi.fn(() => true),
    });
    const prompt = "confidential prompt fragment";
    let messageFilePath = "";
    const spawnProcess = vi.fn((_command: string, args: string[]) => {
      const messageFileIndex = args.indexOf("--message-file");
      expect(messageFileIndex).toBeGreaterThan(-1);
      messageFilePath = args[messageFileIndex + 1] ?? "";
      expect(args.join(" ")).not.toContain(prompt);
      expect(fs.readFileSync(messageFilePath, "utf8")).toBe(prompt);
      if (process.platform !== "win32") {
        expect(fs.statSync(messageFilePath).mode & 0o777).toBe(0o600);
        expect(fs.statSync(path.dirname(messageFilePath)).mode & 0o777).toBe(0o700);
      }
      return child as unknown as ChildProcessWithoutNullStreams;
    });
    const runChat = module.createOpenClawChatRunner({ spawnProcess });
    const run = runChat({
      config: resolveOpenClawChatConfig({ OPENCLAW_LOCAL: "1" }),
      prompt,
      emit: () => undefined,
    });

    child.emit("close", 0, null);
    await expect(run).resolves.toBeUndefined();
    expect(fs.existsSync(messageFilePath)).toBe(false);
    expect(fs.existsSync(path.dirname(messageFilePath))).toBe(false);
  });

  it("removes the prompt file after abort when the child exits", async () => {
    const module = await import("@/lib/openclaw-chat");
    const child = Object.assign(new EventEmitter(), {
      stdout: new PassThrough(),
      stderr: new PassThrough(),
      kill: vi.fn(() => true),
    });
    let messageFilePath = "";
    const runChat = module.createOpenClawChatRunner({
      spawnProcess: (_command, args) => {
        messageFilePath = args[args.indexOf("--message-file") + 1] ?? "";
        return child as unknown as ChildProcessWithoutNullStreams;
      },
    });
    const controller = new AbortController();
    const reason = new Error("cancelled");
    const run = runChat({
      config: resolveOpenClawChatConfig({ OPENCLAW_LOCAL: "1" }),
      prompt: "abort-only secret",
      emit: () => undefined,
      signal: controller.signal,
    });

    controller.abort(reason);
    child.emit("close", null, "SIGTERM");
    await expect(run).rejects.toBe(reason);
    expect(fs.existsSync(messageFilePath)).toBe(false);
    expect(fs.existsSync(path.dirname(messageFilePath))).toBe(false);
  });

  it("removes the prompt file when spawning OpenClaw fails", async () => {
    const module = await import("@/lib/openclaw-chat");
    let messageFilePath = "";
    const spawnError = new Error("spawn failed");
    const runChat = module.createOpenClawChatRunner({
      spawnProcess: (_command, args) => {
        messageFilePath = args[args.indexOf("--message-file") + 1] ?? "";
        expect(fs.existsSync(messageFilePath)).toBe(true);
        throw spawnError;
      },
    });

    await expect(runChat({
      config: resolveOpenClawChatConfig({ OPENCLAW_LOCAL: "1" }),
      prompt: "spawn-error secret",
      emit: () => undefined,
    })).rejects.toBe(spawnError);
    expect(fs.existsSync(messageFilePath)).toBe(false);
    expect(fs.existsSync(path.dirname(messageFilePath))).toBe(false);
  });

  it("removes the prompt file after a child process error closes", async () => {
    const module = await import("@/lib/openclaw-chat");
    const child = Object.assign(new EventEmitter(), {
      stdout: new PassThrough(),
      stderr: new PassThrough(),
      kill: vi.fn(() => true),
    });
    let messageFilePath = "";
    const runChat = module.createOpenClawChatRunner({
      spawnProcess: (_command, args) => {
        messageFilePath = args[args.indexOf("--message-file") + 1] ?? "";
        return child as unknown as ChildProcessWithoutNullStreams;
      },
    });
    const childError = new Error("child process error");
    const run = runChat({
      config: resolveOpenClawChatConfig({ OPENCLAW_LOCAL: "1" }),
      prompt: "child-error secret",
      emit: () => undefined,
    });

    child.emit("error", childError);
    child.emit("close", null, null);
    await expect(run).rejects.toBe(childError);
    expect(fs.existsSync(messageFilePath)).toBe(false);
    expect(fs.existsSync(path.dirname(messageFilePath))).toBe(false);
  });

  it("fails before OAuth or spawn when site-bound MCP identity cannot be proven", async () => {
    const context: BrokerRequestContext = {
      userId: "user-1",
      organizationId: "org-1",
      siteId: "site-1",
      site: { siteName: "성수 현장", region: null, briefingQuestion: null },
    };
    const assertOAuth = vi.fn(async () => ({
      ok: true as const,
      provider: "openai" as const,
      authProvider: "openai/oauth" as const,
      model: "openai/gpt-5.5",
      checkedAt: "2026-07-12T00:00:00.000Z",
      message: "ok",
    }));
    const engine = createLocalOpenClawAdapter({
      env: { SAFECLAW_ENGINE_MODE: "local-openclaw", OPENCLAW_LOCAL: "1" },
      runtimeCapability: async () => true,
      verifySiteBinding: async () => false,
      assertOAuth,
      runChat: vi.fn(async () => undefined),
    });

    await expect(engine.checkAvailability(context)).rejects.toMatchObject({
      code: "ENGINE_SITE_BINDING_UNPROVEN",
      status: 503,
    });
    expect(assertOAuth).not.toHaveBeenCalled();
  });

  it("fails closed before OAuth when the sidecar has not attested executable tools", async () => {
    const context: BrokerRequestContext = {
      userId: "user-1",
      organizationId: "org-1",
      siteId: "site-1",
      site: { siteName: "성수 현장", region: null, briefingQuestion: null },
    };
    const assertOAuth = vi.fn(async () => ({
      ok: true as const,
      provider: "openai" as const,
      authProvider: "openai/oauth" as const,
      model: "openai/gpt-5.5",
      checkedAt: "2026-07-12T00:00:00.000Z",
      message: "ok",
    }));
    const engine = createLocalOpenClawAdapter({
      env: { SAFECLAW_ENGINE_MODE: "local-openclaw", OPENCLAW_LOCAL: "1" },
      runtimeCapability: async () => true,
      verifySiteBinding: async () => true,
      assertOAuth,
      runChat: vi.fn(async () => undefined),
    });

    await expect(engine.checkAvailability(context)).rejects.toMatchObject({
      code: "ENGINE_EXECUTION_ATTESTATION_UNPROVEN",
      status: 503,
    });
    expect(engine.capabilities).toEqual([]);
    expect(assertOAuth).not.toHaveBeenCalled();
  });

  it("propagates the availability abort signal into the OAuth preflight", async () => {
    const context: BrokerRequestContext = {
      userId: "user-1",
      organizationId: "org-1",
      siteId: "site-1",
      site: { siteName: "성수 현장", region: null, briefingQuestion: null },
    };
    let observedSignal: AbortSignal | undefined;
    const assertOAuth = vi.fn(async (_config, signal?: AbortSignal) => {
      if (!signal) throw new Error("missing OAuth abort signal");
      observedSignal = signal;
      await new Promise<void>((_resolve, reject) => {
        signal.addEventListener("abort", () => reject(signal.reason), { once: true });
      });
      throw new Error("unreachable");
    });
    const engine = createLocalOpenClawAdapter({
      env: { SAFECLAW_ENGINE_MODE: "local-openclaw", OPENCLAW_LOCAL: "1" },
      runtimeCapability: async () => true,
      verifySiteBinding: async () => true,
      verifyExecutionAttestation: async () => true,
      assertOAuth,
      runChat: vi.fn(async () => undefined),
    });
    const controller = new AbortController();
    const reason = new Error("request cancelled");

    const preflight = engine.checkAvailability(context, controller.signal);
    void preflight.catch(() => undefined);
    await vi.waitFor(() => expect(observedSignal).toBeDefined());
    controller.abort(reason);

    await expect(preflight).rejects.toBe(reason);
    expect(observedSignal?.aborted).toBe(true);
  });

  it("does not let a later preflight overwrite another site's runnable context", async () => {
    const contextA: BrokerRequestContext = {
      userId: "user-1",
      organizationId: "org-1",
      siteId: "site-1",
      site: { siteName: "성수 현장", region: null, briefingQuestion: null },
    };
    const contextB: BrokerRequestContext = {
      userId: "user-2",
      organizationId: "org-2",
      siteId: "site-2",
      site: { siteName: "판교 현장", region: null, briefingQuestion: null },
    };
    const assertOAuth = vi.fn(async () => ({
      ok: true as const,
      provider: "openai" as const,
      authProvider: "openai/oauth" as const,
      model: "openai/gpt-5.5",
      checkedAt: "2026-07-12T00:00:00.000Z",
      message: "ok",
    }));
    const runChat = vi.fn(async () => undefined);
    const engine = createLocalOpenClawAdapter({
      env: { SAFECLAW_ENGINE_MODE: "local-openclaw", OPENCLAW_LOCAL: "1" },
      runtimeCapability: async () => true,
      verifySiteBinding: async () => true,
      verifyExecutionAttestation: async () => true,
      assertOAuth,
      runChat,
    });

    await expect(engine.checkAvailability(contextA)).resolves.toBeUndefined();
    await expect(engine.checkAvailability(contextB)).resolves.toBeUndefined();
    await expect(engine.run({
      context: contextA,
      prompt: "첫 번째 현장",
      emit: () => undefined,
      signal: new AbortController().signal,
    })).resolves.toBeUndefined();

    expect(assertOAuth).toHaveBeenCalledTimes(3);
    expect(runChat).toHaveBeenCalledWith(expect.objectContaining({
      prompt: "첫 번째 현장",
    }));
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
              {
                provider: "openai",
                runtime: "codex",
                authProvider: "openai",
                status: "usable",
                effective: { kind: "profiles", detail: "agent auth store" },
              },
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

  it("rejects mixed OpenAI OAuth and token credentials", () => {
    const config = resolveOpenClawChatConfig({});
    expect(() => parseOpenClawOAuthStatusOutput(JSON.stringify({
      defaultModel: "openai/gpt-5.5",
      resolvedDefault: "openai/gpt-5.5",
      auth: {
        providers: [{
          provider: "openai",
          profiles: { count: 2, oauth: 1, token: 1, apiKey: 0 },
        }],
        runtimeAuthRoutes: [{
          provider: "openai",
          runtime: "codex",
          authProvider: "openai",
          status: "usable",
          effective: { kind: "profiles", detail: "agent auth store" },
        }],
        oauth: {
          providers: [{
            provider: "openai",
            status: "ok",
            effectiveProfiles: [
              { provider: "openai", type: "oauth", status: "ok", source: "store" },
              { provider: "openai", type: "token", status: "static", source: "store" },
            ],
          }],
        },
      },
    }), config)).toThrow("OpenClaw safeclaw profile is not ready for OpenAI OAuth chat");
  });

  it("rejects a usable runtime route whose effective credential path is not OAuth profiles", () => {
    const config = resolveOpenClawChatConfig({});
    expect(() => parseOpenClawOAuthStatusOutput(JSON.stringify({
      defaultModel: "openai/gpt-5.5",
      resolvedDefault: "openai/gpt-5.5",
      auth: {
        providers: [{
          provider: "openai",
          profiles: { count: 1, oauth: 1, token: 0, apiKey: 0 },
        }],
        runtimeAuthRoutes: [{
          provider: "openai",
          runtime: "codex",
          authProvider: "openai",
          status: "usable",
          effective: { kind: "env", detail: "OPENAI_API_KEY" },
        }],
        oauth: {
          providers: [{
            provider: "openai",
            status: "ok",
            effectiveProfiles: [
              { provider: "openai", type: "oauth", status: "ok", source: "store" },
            ],
          }],
        },
      },
    }), config)).toThrow("OpenClaw safeclaw profile is not ready for OpenAI OAuth chat");
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
