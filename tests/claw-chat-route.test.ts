import type { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createAgentChatPost } from "@/lib/openclaw-broker-route";
import type { ClawChatEvent } from "@/lib/agent-loop";
import {
  BrokerError,
  ENGINE_ADAPTER_CONTRACT_VERSION,
  SAFECLAW_ENGINE_AUTHORITY,
  type BrokerRequestContext,
  type EngineAdapter,
} from "@/lib/engine-adapter";
import {
  createBrokerAuthorization,
  createBrokerContextResolver,
} from "@/lib/openclaw-broker-auth";
import { createRateLimiter } from "@/lib/rate-limit";

const validContext: BrokerRequestContext = {
  userId: "user-1",
  organizationId: "org-1",
  siteId: "site-1",
  site: {
    siteName: "성수 현장",
    region: "서울 성동구",
    briefingQuestion: null,
  },
};

function request(input: {
  token?: string;
  siteId?: string;
  message?: string;
  ip?: string;
  rawBody?: string;
} = {}): NextRequest {
  return new Request("https://www.safeclaw.kr/api/agent/chat", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-forwarded-for": input.ip ?? `203.0.113.${Math.floor(Math.random() * 200) + 1}`,
      ...(input.token ? { authorization: `Bearer ${input.token}` } : {}),
    },
    body: input.rawBody ?? JSON.stringify({
      message: input.message ?? "오늘 작업 위험을 봐줘",
      ...(input.siteId ? { siteId: input.siteId } : {}),
    }),
  }) as NextRequest;
}

function adapter(overrides: Partial<EngineAdapter> = {}): EngineAdapter {
  return {
    id: "test-engine",
    contractVersion: ENGINE_ADAPTER_CONTRACT_VERSION,
    runtime: "unavailable",
    authority: SAFECLAW_ENGINE_AUTHORITY,
    capabilities: [],
    checkAvailability: vi.fn(async () => undefined),
    run: vi.fn(async ({ emit }) => {
      emit({ kind: "text-delta", text: "adapter reached" });
    }),
    ...overrides,
  };
}

function resolver(input: {
  authenticated?: boolean;
  ownedSiteId?: string | null;
} = {}) {
  return createBrokerContextResolver({
    createClient: () => ({ marker: "client" }),
    authenticate: async (_client, headers) => {
      const token = headers.get("authorization")?.replace(/^Bearer\s+/, "");
      return input.authenticated === false || token !== "valid-token"
        ? null
        : { id: validContext.userId, email: "owner@example.com" };
    },
    findOwnedSite: async (_client, user, siteId) => {
      if (user.id !== validContext.userId) return null;
      if (input.ownedSiteId === null || siteId !== (input.ownedSiteId ?? validContext.siteId)) return null;
      return validContext;
    },
  });
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("/api/agent/chat broker boundary", () => {
  it("returns 401 for an unauthenticated request before reaching the adapter", async () => {
    const engine = adapter();
    const post = createAgentChatPost({ resolveContext: resolver(), engine });

    const response = await post(request({ siteId: validContext.siteId }));

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({ code: "AUTH_REQUIRED" });
    expect(engine.checkAvailability).not.toHaveBeenCalled();
    expect(engine.run).not.toHaveBeenCalled();
  });

  it("keeps unauthenticated requests at 401 even after the IP rate limit is exhausted", async () => {
    const engine = adapter();
    const post = createAgentChatPost({ resolveContext: resolver(), engine });
    const ip = "198.51.100.77";

    for (let attempt = 0; attempt < 6; attempt += 1) {
      const response = await post(request({ siteId: validContext.siteId, ip }));
      expect(response.status).toBe(401);
      await expect(response.json()).resolves.toMatchObject({ code: "AUTH_REQUIRED" });
    }

    expect(engine.checkAvailability).not.toHaveBeenCalled();
    expect(engine.run).not.toHaveBeenCalled();
  });

  it("applies a coarse pre-auth IP limit before JSON parsing while preserving initial 401 responses", async () => {
    const engine = adapter();
    const post = createAgentChatPost({ resolveContext: resolver(), engine });
    const ip = "198.51.100.78";

    for (let attempt = 0; attempt < 20; attempt += 1) {
      const response = await post(request({ ip, rawBody: "not-json" }));
      expect(response.status).toBe(401);
    }

    const limited = await post(request({ ip, rawBody: "not-json" }));
    expect(limited.status).toBe(429);
    expect(engine.checkAvailability).not.toHaveBeenCalled();
  });

  it("uses an authenticated identity limiter even when requests rotate IP addresses", async () => {
    const engine = adapter();
    const post = createAgentChatPost({ resolveContext: resolver(), engine });

    for (let attempt = 0; attempt < 5; attempt += 1) {
      const response = await post(request({
        token: "valid-token",
        siteId: validContext.siteId,
        ip: `198.51.100.${100 + attempt}`,
      }));
      expect(response.status).toBe(200);
      await response.text();
    }

    const limited = await post(request({
      token: "valid-token",
      siteId: validContext.siteId,
      ip: "198.51.100.199",
    }));
    expect(limited.status).toBe(429);
  });

  it("runs the authenticated limiter immediately after auth and before body or site work", async () => {
    const events: string[] = [];
    const engine = adapter();
    const resolveContext = createBrokerContextResolver({
      createClient: () => ({ marker: "client" }),
      authenticate: async () => {
        events.push("authenticate");
        return { id: validContext.userId, email: "owner@example.com" };
      },
      findOwnedSite: async () => {
        events.push("owned-site");
        return validContext;
      },
    });
    const authenticatedLimiter = {
      check: vi.fn(() => {
        events.push("fine-limit");
        return { allowed: false, retryAfterSeconds: 60 };
      }),
      size: () => 1,
    };
    const incoming = request({ token: "valid-token", siteId: validContext.siteId });
    const parseBody = vi.spyOn(incoming, "json").mockImplementation(async () => {
      events.push("body");
      return { message: "오늘 작업 위험을 봐줘", siteId: validContext.siteId };
    });
    const post = createAgentChatPost({ resolveContext, engine, authenticatedLimiter });

    const response = await post(incoming);

    expect(response.status).toBe(429);
    expect(events).toEqual(["authenticate", "fine-limit"]);
    expect(parseBody).not.toHaveBeenCalled();
    expect(engine.checkAvailability).not.toHaveBeenCalled();
  });

  it("charges malformed and unowned authenticated requests against the user quota", async () => {
    const engine = adapter();
    const findOwnedSite = vi.fn(async (_client: { marker: string }, user: { id: string }, siteId: string) => {
      if (user.id !== validContext.userId || siteId !== validContext.siteId) return null;
      return validContext;
    });
    const resolveContext = createBrokerContextResolver({
      createClient: () => ({ marker: "client" }),
      authenticate: async () => ({ id: validContext.userId, email: "owner@example.com" }),
      findOwnedSite,
    });
    const post = createAgentChatPost({
      resolveContext,
      engine,
      authenticatedLimiter: createRateLimiter({ limit: 2, windowMs: 60_000 }),
    });

    const malformed = await post(request({
      token: "valid-token",
      ip: "198.51.100.210",
      rawBody: "not-json",
    }));
    const unowned = await post(request({
      token: "valid-token",
      ip: "198.51.100.211",
      siteId: "site-other",
    }));
    const limited = await post(request({
      token: "valid-token",
      ip: "198.51.100.212",
      siteId: validContext.siteId,
    }));

    expect(malformed.status).toBe(400);
    expect(unowned.status).toBe(403);
    expect(limited.status).toBe(429);
    expect(findOwnedSite).toHaveBeenCalledTimes(1);
    expect(engine.checkAvailability).not.toHaveBeenCalled();
  });

  it("authenticates malformed anonymous payloads before returning a body error", async () => {
    const engine = adapter();
    const post = createAgentChatPost({ resolveContext: resolver(), engine });

    const response = await post(request({ rawBody: "not-json" }));

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({ code: "AUTH_REQUIRED" });
    expect(engine.run).not.toHaveBeenCalled();
  });

  it("returns 401 for an invalid or expired bearer token", async () => {
    const engine = adapter();
    const post = createAgentChatPost({ resolveContext: resolver(), engine });

    const response = await post(request({ token: "expired-token", siteId: validContext.siteId }));

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({ code: "AUTH_INVALID" });
    expect(engine.run).not.toHaveBeenCalled();
  });

  it("classifies authentication backend failures as a stable 503", async () => {
    const authorization = createBrokerAuthorization({
      createClient: () => ({ marker: "client" }),
      authenticate: async () => {
        throw new Error("auth network unavailable");
      },
      findOwnedSite: async () => validContext,
    });

    await expect(authorization.authenticate(request({ token: "valid-token" }))).rejects.toMatchObject({
      code: "AUTH_BACKEND_UNAVAILABLE",
      status: 503,
    });
  });

  it("distinguishes invalid Supabase auth from an auth backend outage", async () => {
    const module = await import("@/lib/openclaw-broker-auth") as typeof import("@/lib/openclaw-broker-auth") & {
      authenticateBrokerWorkspaceUser?: (
        client: { auth: { getUser: (token: string) => Promise<unknown> } },
        headers: Headers,
      ) => Promise<unknown>;
    };
    expect(module.authenticateBrokerWorkspaceUser).toBeTypeOf("function");
    if (!module.authenticateBrokerWorkspaceUser) return;

    const headers = new Headers({ authorization: "Bearer supplied-token" });
    const invalidClient = {
      auth: {
        getUser: vi.fn(async () => ({ data: { user: null }, error: { status: 401, code: "bad_jwt" } })),
      },
    };
    const outageClient = {
      auth: {
        getUser: vi.fn(async () => ({ data: { user: null }, error: { status: 503, code: "service_unavailable" } })),
      },
    };

    await expect(module.authenticateBrokerWorkspaceUser(invalidClient, headers)).resolves.toBeNull();
    await expect(module.authenticateBrokerWorkspaceUser(outageClient, headers)).rejects.toBeDefined();
  });

  it("returns 400 when an authenticated request has no site context", async () => {
    const engine = adapter();
    const post = createAgentChatPost({ resolveContext: resolver(), engine });

    const response = await post(request({ token: "valid-token" }));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({ code: "SITE_CONTEXT_REQUIRED" });
    expect(engine.run).not.toHaveBeenCalled();
  });

  it("returns 403 when the authenticated user does not own the requested site", async () => {
    const engine = adapter();
    const post = createAgentChatPost({ resolveContext: resolver({ ownedSiteId: null }), engine });

    const response = await post(request({ token: "valid-token", siteId: "site-other" }));

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({ code: "SITE_FORBIDDEN" });
    expect(engine.run).not.toHaveBeenCalled();
  });

  it("classifies owned-site backend failures as a stable 503 instead of forbidden", async () => {
    const engine = adapter();
    const resolveContext = createBrokerContextResolver({
      createClient: () => ({ marker: "client" }),
      authenticate: async () => ({ id: validContext.userId, email: "owner@example.com" }),
      findOwnedSite: async () => {
        throw new Error("site database unavailable");
      },
    });
    const post = createAgentChatPost({ resolveContext, engine });

    const response = await post(request({ token: "valid-token", siteId: validContext.siteId }));

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({ code: "SITE_BACKEND_UNAVAILABLE" });
    expect(engine.checkAvailability).not.toHaveBeenCalled();
    expect(engine.run).not.toHaveBeenCalled();
  });

  it("lets a valid site member reach the adapter with user, organization, and site context", async () => {
    const engine = adapter();
    const post = createAgentChatPost({ resolveContext: resolver(), engine });

    const response = await post(request({ token: "valid-token", siteId: validContext.siteId }));
    const body = await response.text();

    expect(response.status).toBe(200);
    expect(engine.checkAvailability).toHaveBeenCalledWith(validContext, expect.any(AbortSignal));
    expect(engine.run).toHaveBeenCalledWith(expect.objectContaining({ context: validContext }));
    expect(body).toContain("adapter reached");
    expect(body).toContain("\"kind\":\"final\"");
  });

  it("returns a stable 503 before streaming when the deployed engine is unavailable", async () => {
    const engine = adapter({
      checkAvailability: vi.fn(async () => {
        throw new BrokerError("ENGINE_UNAVAILABLE", 503);
      }),
    });
    const post = createAgentChatPost({ resolveContext: resolver(), engine });

    const response = await post(request({ token: "valid-token", siteId: validContext.siteId }));

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({
      code: "ENGINE_UNAVAILABLE",
      error: "에이전트 엔진을 사용할 수 없습니다.",
    });
    expect(engine.run).not.toHaveBeenCalled();
  });

  it("redacts adapter stderr, paths, plugin, profile, and account details from SSE errors", async () => {
    const secretDetail = "C:\\Users\\operator\\.openclaw-safeclaw plugin=codex profile=safeclaw account=owner@example.com stderr boom";
    const engine = adapter({
      run: vi.fn(async () => {
        throw new Error(secretDetail);
      }),
    });
    const logError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const post = createAgentChatPost({ resolveContext: resolver(), engine });

    const response = await post(request({ token: "valid-token", siteId: validContext.siteId }));
    const body = await response.text();

    expect(response.status).toBe(200);
    expect(body).toContain("ENGINE_EXECUTION_FAILED");
    expect(body).toContain("에이전트 실행에 실패했습니다.");
    expect(body).not.toContain("operator");
    expect(body).not.toContain("codex");
    expect(body).not.toContain("safeclaw");
    expect(body).not.toContain("owner@example.com");
    expect(body).not.toContain("stderr boom");
    expect(logError).toHaveBeenCalledWith(expect.stringContaining("openclaw broker execution failed"));
    expect(logError).not.toHaveBeenCalledWith(expect.stringContaining("operator"));
    expect(logError).not.toHaveBeenCalledWith(expect.stringContaining("safeclaw"));
    expect(logError).not.toHaveBeenCalledWith(expect.stringContaining("owner@example.com"));
    expect(logError).not.toHaveBeenCalledWith(expect.stringContaining("stderr boom"));
  });
});
