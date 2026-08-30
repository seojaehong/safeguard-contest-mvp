import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { McpAuthContext } from "@/lib/mcp-auth";
import {
  MCP_PROVIDER_ADMISSION_POLICY,
  MCP_READ_PROVIDER_ADMISSION_POLICY,
  withMcpProviderAdmission,
  withMcpReadProviderAdmission,
} from "@/lib/mcp-provider-admission";

const CONTEXT: McpAuthContext = {
  admissionIdentity: "a".repeat(64),
  orgId: "org-1",
  scopes: ["tools:write"],
  siteId: "site-1",
  source: "db",
  tokenId: "token-1",
};

describe("MCP provider admission", () => {
  beforeEach(() => {
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "");
    vi.stubEnv("VERCEL_ENV", "");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("fails closed before provider work when distributed production admission is absent", async () => {
    vi.stubEnv("VERCEL_ENV", "production");
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const work = vi.fn(async () => "unexpected");

    await expect(withMcpProviderAdmission(CONTEXT, "full", work)).rejects.toMatchObject({
      code: "MCP_PROVIDER_ADMISSION_UNAVAILABLE",
    });
    expect(work).not.toHaveBeenCalled();
    expect(error).toHaveBeenCalled();
  });

  it("fails closed before provider work when distributed production admission is partial", async () => {
    vi.stubEnv("VERCEL_ENV", "production");
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "https://example.upstash.io");
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const work = vi.fn(async () => "unexpected");

    await expect(withMcpProviderAdmission(CONTEXT, "enhanced", work)).rejects.toMatchObject({
      code: "MCP_PROVIDER_ADMISSION_UNAVAILABLE",
    });
    expect(work).not.toHaveBeenCalled();
    expect(error).toHaveBeenCalled();
  });

  it("uses token and tenant bound distributed admission and releases the weighted lease", async () => {
    vi.stubEnv("VERCEL_ENV", "production");
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "https://example.upstash.io");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "distributed-test-token");
    const commands: unknown[][] = [];
    vi.stubGlobal("fetch", vi.fn(async (_input: string | URL | Request, init?: RequestInit) => {
      const command = JSON.parse(String(init?.body)) as unknown[];
      commands.push(command);
      const script = String(command[1]);
      if (script.includes("INCR")) return Response.json({ result: [1, 59_000] });
      if (script.includes("ZADD")) return Response.json({ result: [1, 2] });
      return Response.json({ result: 2 });
    }));
    const work = vi.fn(async () => "generated");

    await expect(withMcpProviderAdmission(CONTEXT, "enhanced", work)).resolves.toBe("generated");

    expect(work).toHaveBeenCalledTimes(1);
    expect(commands).toHaveLength(3);
    expect(String(commands[0]?.[3])).toMatch(/^safeclaw:public-rate:mcp-provider-generation:[a-f0-9]{32}$/u);
    expect(JSON.stringify(commands[0])).not.toContain(CONTEXT.admissionIdentity);
    expect(commands[1]?.[3]).toBe(
      `safeclaw:public-concurrency:${MCP_PROVIDER_ADMISSION_POLICY.sharedLeaseNamespace}`,
    );
    expect(commands[1]?.[9]).toBe(String(MCP_PROVIDER_ADMISSION_POLICY.weights.enhanced));
  });

  it("admits read-provider fanout with a token and tenant bound distributed lease", async () => {
    vi.stubEnv("VERCEL_ENV", "production");
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "https://example.upstash.io");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "distributed-test-token");
    const commands: unknown[][] = [];
    vi.stubGlobal("fetch", vi.fn(async (_input: string | URL | Request, init?: RequestInit) => {
      const command = JSON.parse(String(init?.body)) as unknown[];
      commands.push(command);
      const script = String(command[1]);
      if (script.includes("INCR")) return Response.json({ result: [1, 59_000] });
      if (script.includes("ZADD")) return Response.json({ result: [1, 8] });
      return Response.json({ result: 8 });
    }));
    const work = vi.fn(async () => "weather");

    await expect(
      withMcpReadProviderAdmission(CONTEXT, "get_weather_signals", work),
    ).resolves.toBe("weather");

    expect(work).toHaveBeenCalledTimes(1);
    expect(commands).toHaveLength(3);
    expect(String(commands[0]?.[3])).toMatch(/^safeclaw:public-rate:mcp-provider-read:[a-f0-9]{32}$/u);
    expect(JSON.stringify(commands[0])).not.toContain(CONTEXT.admissionIdentity);
    expect(commands[1]?.[3]).toBe(
      `safeclaw:public-concurrency:${MCP_PROVIDER_ADMISSION_POLICY.sharedLeaseNamespace}`,
    );
    expect(commands[1]?.[9]).toBe(
      String(MCP_READ_PROVIDER_ADMISSION_POLICY.weights.get_weather_signals),
    );
  });

  it("keeps the shared Redis key TTL monotonic across generation and shorter read leases", async () => {
    vi.stubEnv("VERCEL_ENV", "production");
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "https://example.upstash.io");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "distributed-test-token");
    const commands: unknown[][] = [];
    vi.stubGlobal("fetch", vi.fn(async (_input: string | URL | Request, init?: RequestInit) => {
      const command = JSON.parse(String(init?.body)) as unknown[];
      commands.push(command);
      const script = String(command[1]);
      if (script.includes("INCR")) return Response.json({ result: [1, 59_000] });
      if (script.includes("ZADD")) return Response.json({ result: [1, 1] });
      return Response.json({ result: 1 });
    }));

    await withMcpProviderAdmission(CONTEXT, "full", async () => "generated");
    await withMcpReadProviderAdmission(CONTEXT, "get_weather_signals", async () => "weather");

    const acquires = commands.filter((command) => String(command[1]).includes("ZADD"));
    expect(acquires).toHaveLength(2);
    const [generationAcquire, readAcquire] = acquires;
    expect(generationAcquire?.[3]).toBe(readAcquire?.[3]);
    expect(Number(generationAcquire?.[6]) - Number(generationAcquire?.[4])).toBe(
      MCP_PROVIDER_ADMISSION_POLICY.leaseMs,
    );
    expect(Number(readAcquire?.[6]) - Number(readAcquire?.[4])).toBe(
      MCP_READ_PROVIDER_ADMISSION_POLICY.leaseMs,
    );
    expect(Number(generationAcquire?.[8])).toBe(MCP_PROVIDER_ADMISSION_POLICY.leaseMs);
    expect(Number(readAcquire?.[8])).toBe(MCP_PROVIDER_ADMISSION_POLICY.leaseMs);
    expect(String(readAcquire?.[1])).toContain("if ttl < requested_ttl");
  });

  it("keeps deterministic template generation outside provider admission", async () => {
    vi.stubEnv("VERCEL_ENV", "production");
    const fetchImpl = vi.fn();
    vi.stubGlobal("fetch", fetchImpl);
    const work = vi.fn(async () => "template");

    await expect(withMcpProviderAdmission(CONTEXT, "template", work)).resolves.toBe("template");
    expect(work).toHaveBeenCalledTimes(1);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("preserves weighted instance admission outside production", async () => {
    const work = vi.fn(async () => "local-generation");

    await expect(withMcpProviderAdmission(CONTEXT, "full", work)).resolves.toBe("local-generation");
    expect(work).toHaveBeenCalledTimes(1);
  });

  it("shares the instance work-unit ceiling across generation and read fanout", async () => {
    let releaseWeather: (() => void) | undefined;
    let releaseAccidents: (() => void) | undefined;
    const weatherWork = vi.fn(() => new Promise<string>((resolve) => {
      releaseWeather = () => resolve("weather");
    }));
    const accidentWork = vi.fn(() => new Promise<string>((resolve) => {
      releaseAccidents = () => resolve("accidents");
    }));

    const pendingWeather = withMcpReadProviderAdmission(
      CONTEXT,
      "get_weather_signals",
      weatherWork,
    );
    await vi.waitFor(() => expect(weatherWork).toHaveBeenCalledTimes(1));

    const pendingAccidents = withMcpReadProviderAdmission(
      CONTEXT,
      "search_accident_cases",
      accidentWork,
    );
    await vi.waitFor(() => expect(accidentWork).toHaveBeenCalledTimes(1));

    const harnessWork = vi.fn(async () => "harness");
    await expect(
      withMcpReadProviderAdmission(CONTEXT, "run_safeclaw_harness_agent", harnessWork),
    ).rejects.toMatchObject({ code: "MCP_PROVIDER_CONCURRENCY_LIMIT" });
    expect(harnessWork).not.toHaveBeenCalled();

    if (!releaseWeather) throw new Error("Weather admission was not acquired");
    if (!releaseAccidents) throw new Error("Accident admission was not acquired");
    releaseWeather();
    releaseAccidents();
    await expect(pendingWeather).resolves.toBe("weather");
    await expect(pendingAccidents).resolves.toBe("accidents");
  });
});
