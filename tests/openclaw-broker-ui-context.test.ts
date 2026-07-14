import fs from "node:fs";
import path from "node:path";

import { describe, expect, it, vi } from "vitest";

import {
  CLAW_CONTEXT_LOAD_FAILED_EVENT,
  createClawChatRequestSession,
  reportClawContextLoadFailure,
} from "@/lib/claw-chat-session";
import { createAgentContextGet } from "@/lib/openclaw-broker-context";
import { BrokerError } from "@/lib/engine-adapter";
import { createRateLimiter } from "@/lib/rate-limit";

const root = process.cwd();

describe("OpenClaw owned-site context wiring", () => {
  it("exports the authenticated read-only context route and keeps missing authentication at 401", async () => {
    const routePath = path.join(root, "app", "api", "agent", "context", "route.ts");

    expect(fs.existsSync(routePath)).toBe(true);
    if (!fs.existsSync(routePath)) return;

    const route = await import("@/app/api/agent/context/route");
    const response = await route.GET(new Request("https://www.safeclaw.kr/api/agent/context") as never);
    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({ code: "AUTH_REQUIRED" });
  });

  it("returns only owned-site selector identifiers and names after authentication", async () => {
    const get = createAgentContextGet({
      authenticate: async () => ({ client: { marker: "client" }, user: { id: "user-1", email: "owner@example.com" } }),
      listOwnedSites: async () => [{ id: "site-1", name: "성수 현장", organizationId: "org-1" }],
    });

    const response = await get(new Request("https://www.safeclaw.kr/api/agent/context", {
      headers: { authorization: "Bearer valid-token" },
    }) as never);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      sites: [{ id: "site-1", name: "성수 현장", organizationId: "org-1" }],
    });
  });

  it("applies a coarse IP limiter before Supabase authentication", async () => {
    const authenticate = vi.fn(async () => {
      throw new BrokerError("AUTH_REQUIRED", 401);
    });
    const get = createAgentContextGet({
      authenticate,
      listOwnedSites: vi.fn(async () => []),
      preAuthLimiter: createRateLimiter({ limit: 1, windowMs: 60_000 }),
    });
    const request = () => new Request("https://www.safeclaw.kr/api/agent/context", {
      headers: { "x-forwarded-for": "198.51.100.41" },
    }) as never;

    const first = await get(request());
    const limited = await get(request());

    expect(first.status).toBe(401);
    expect(limited.status).toBe(429);
    expect(authenticate).toHaveBeenCalledTimes(1);
  });

  it("returns stable 503 codes for auth and site backend outages", async () => {
    const authOutage = createAgentContextGet({
      authenticate: async () => {
        throw new Error("auth backend unavailable");
      },
      listOwnedSites: vi.fn(async () => []),
    });
    const siteOutage = createAgentContextGet({
      authenticate: async () => ({ client: { marker: "client" }, user: { id: "user-1", email: null } }),
      listOwnedSites: async () => {
        throw new Error("site backend unavailable");
      },
    });

    const authResponse = await authOutage(new Request("https://www.safeclaw.kr/api/agent/context") as never);
    const siteResponse = await siteOutage(new Request("https://www.safeclaw.kr/api/agent/context") as never);

    expect(authResponse.status).toBe(503);
    await expect(authResponse.json()).resolves.toMatchObject({ code: "AUTH_BACKEND_UNAVAILABLE" });
    expect(siteResponse.status).toBe(503);
    await expect(siteResponse.json()).resolves.toMatchObject({ code: "SITE_BACKEND_UNAVAILABLE" });
  });

  it("makes the only workspace ClawChat callsite wait for authenticated owned-site context", () => {
    const source = fs.readFileSync(path.join(root, "components", "FieldOperationsWorkspace.tsx"), "utf8");

    expect(source).toContain('fetch("/api/agent/context"');
    expect(source).toContain("<ClawChat");
    expect(source).toContain("siteOptions={clawSiteOptions}");
    expect(source).toContain("selectedSiteId={selectedClawSiteId}");
    expect(source).toContain("contextStatus={clawContextStatus}");
  });

  it("removes guest turns and disables every chat control until auth and site context are ready", () => {
    const source = fs.readFileSync(path.join(root, "components", "ClawChat.tsx"), "utf8");

    expect(source).not.toContain("GUEST_MESSAGE_LIMIT");
    expect(source).toContain("const canSend = Boolean(authToken && selectedSiteId && contextStatus === \"ready\")");
    expect(source).toContain("disabled={busy || !canSend}");
    expect(source).toContain("로그인 후 소유 현장을 연결하면");
    expect(source).toContain("turns.length === 0 && canSend");
  });

  it("aborts active requests and resets turns when the auth token or site changes", async () => {
    const resetTurns = vi.fn();
    const setBusy = vi.fn();
    const session = createClawChatRequestSession({ resetTurns, setBusy });
    session.synchronizeContext("token-a", "site-a");
    resetTurns.mockClear();
    setBusy.mockClear();

    const authRequest = session.beginRequest();
    const authFetch = new Promise<void>((_resolve, reject) => {
      authRequest.signal.addEventListener("abort", () => reject(authRequest.signal.reason), { once: true });
    });
    session.synchronizeContext("token-b", "site-a");

    expect(authRequest.signal.aborted).toBe(true);
    await expect(authFetch).rejects.toBeDefined();
    expect(resetTurns).toHaveBeenCalledTimes(1);
    expect(setBusy).toHaveBeenLastCalledWith(false);

    resetTurns.mockClear();
    setBusy.mockClear();
    const siteRequest = session.beginRequest();
    const siteFetch = new Promise<void>((_resolve, reject) => {
      siteRequest.signal.addEventListener("abort", () => reject(siteRequest.signal.reason), { once: true });
    });
    session.synchronizeContext("token-b", "site-b");

    expect(siteRequest.signal.aborted).toBe(true);
    await expect(siteFetch).rejects.toBeDefined();
    expect(resetTurns).toHaveBeenCalledTimes(1);
    expect(setBusy).toHaveBeenLastCalledWith(false);
    session.dispose();
  });

  it("hides old-user sites immediately and rejects stale resolved context generations", async () => {
    const module = await import("@/lib/claw-chat-session") as typeof import("@/lib/claw-chat-session") & {
      createClawContextRequestSession?: () => {
        begin: (authToken: string) => { authToken: string; signal: AbortSignal };
        commit: (request: { authToken: string; signal: AbortSignal }, action: () => void) => boolean;
        dispose: () => void;
      };
      resolveClawContextViewState?: (
        authToken: string | undefined,
        state: {
          authToken: string | null;
          siteOptions: Array<{ id: string; name: string }>;
          selectedSiteId: string | null;
          status: "login-required" | "loading" | "ready" | "unavailable";
        },
      ) => {
        siteOptions: Array<{ id: string; name: string }>;
        selectedSiteId: string | null;
        status: "login-required" | "loading" | "ready" | "unavailable";
      };
    };
    expect(module.createClawContextRequestSession).toBeTypeOf("function");
    expect(module.resolveClawContextViewState).toBeTypeOf("function");
    if (!module.createClawContextRequestSession || !module.resolveClawContextViewState) return;

    const oldState = {
      authToken: "token-a",
      siteOptions: [{ id: "site-a", name: "이전 사용자 비밀 현장" }],
      selectedSiteId: "site-a",
      status: "ready" as const,
    };
    expect(module.resolveClawContextViewState("token-b", oldState)).toMatchObject({
      siteOptions: [],
      selectedSiteId: null,
      status: "loading",
    });

    const session = module.createClawContextRequestSession();
    const oldRequest = session.begin("token-a");
    const currentRequest = session.begin("token-b");
    let oldReadyRevived = false;
    let currentReadyApplied = false;

    expect(oldRequest.signal.aborted).toBe(true);
    expect(session.commit(oldRequest, () => { oldReadyRevived = true; })).toBe(false);
    expect(session.commit(currentRequest, () => { currentReadyApplied = true; })).toBe(true);
    expect(oldReadyRevived).toBe(false);
    expect(currentReadyApplied).toBe(true);
    session.dispose();
  });

  it("logs only a stable event code when owned-site context loading fails", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    reportClawContextLoadFailure();

    expect(warn.mock.calls).toEqual([[CLAW_CONTEXT_LOAD_FAILED_EVENT]]);
    warn.mockRestore();
  });
});
