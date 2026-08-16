import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { getKoreanLawMcpDetail } from "@/lib/korean-law-mcp";

describe("korean-law detail response budget", () => {
  beforeEach(() => {
    vi.stubEnv("KOREAN_LAW_MCP_ENABLED", "true");
    vi.stubEnv("KOREAN_LAW_MCP_LAW_OC", "test-law-key");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("fails closed when a law detail response exceeds the byte budget", async () => {
    const cancel = vi.fn();
    const body = new ReadableStream<Uint8Array>({ cancel });
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => new Response(body, {
      headers: { "content-length": String(4 * 1024 * 1024 + 1) },
    }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(getKoreanLawMcpDetail("klm-law-12345")).resolves.toBeNull();
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain("target=eflaw");
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain("MST=12345");
    expect(cancel).toHaveBeenCalledTimes(1);
  });
});
