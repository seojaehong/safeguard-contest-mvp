import fs from "node:fs";
import path from "node:path";

import { describe, expect, it, vi } from "vitest";

import {
  CLAW_CONTEXT_LOAD_FAILED_EVENT,
  createClawChatRequestSession,
  reportClawContextLoadFailure,
} from "@/lib/claw-chat-session";
import { createAgentContextGet } from "@/lib/openclaw-broker-context";

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
      listOwnedSites: async () => [{ id: "site-1", name: "성수 현장" }],
    });

    const response = await get(new Request("https://www.safeclaw.kr/api/agent/context", {
      headers: { authorization: "Bearer valid-token" },
    }) as never);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      sites: [{ id: "site-1", name: "성수 현장" }],
    });
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

  it("logs only a stable event code when owned-site context loading fails", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    reportClawContextLoadFailure();

    expect(warn.mock.calls).toEqual([[CLAW_CONTEXT_LOAD_FAILED_EVENT]]);
    warn.mockRestore();
  });
});
