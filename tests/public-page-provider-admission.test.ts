import { readFile } from "node:fs/promises";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  runAsk: vi.fn(),
  runSearch: vi.fn(),
}));

vi.mock("@/lib/search", () => ({
  runAsk: mocks.runAsk,
  runSearch: mocks.runSearch,
}));

function request(pathname: string, ip: string): Request {
  return new Request(`https://www.safeclaw.kr${pathname}`, {
    headers: { "x-forwarded-for": ip },
  });
}

describe("public page provider admission", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("VERCEL_ENV", "production");
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("fails closed before provider-backed Ask work when distributed admission is unavailable", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const { runPublicAskOperation } = await import("@/lib/public-ask-operation");
    const result = await runPublicAskOperation({
      request: request("/ask?q=test", "198.51.100.201"),
      question: "외벽 도장 작업",
      aiMode: "enhanced",
    });

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected Ask admission to fail closed");
    expect(result.response.status).toBe(503);
    expect(await result.response.json()).toMatchObject({
      code: "DISTRIBUTED_RATE_LIMIT_UNAVAILABLE",
    });
    expect(mocks.runAsk).not.toHaveBeenCalled();
    error.mockRestore();
  });

  it("fails closed before legal search when distributed provider admission is unavailable", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const { runPublicLegalSearchOperation } = await import("@/lib/public-search-operation");
    const result = await runPublicLegalSearchOperation({
      request: request("/search?q=test", "198.51.100.202"),
      query: "산업안전",
    });

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected Search admission to fail closed");
    expect(result.response.status).toBe(503);
    expect(await result.response.json()).toMatchObject({
      code: "DISTRIBUTED_RATE_LIMIT_UNAVAILABLE",
    });
    expect(mocks.runSearch).not.toHaveBeenCalled();
    error.mockRestore();
  });

  it("keeps both public pages on the shared admitted operations", async () => {
    const root = process.cwd();
    const [askPage, searchPage] = await Promise.all([
      readFile(path.join(root, "app/ask/page.tsx"), "utf8"),
      readFile(path.join(root, "app/search/page.tsx"), "utf8"),
    ]);

    expect(askPage).toContain("runPublicAskOperation");
    expect(askPage).not.toContain('from "@/lib/search"');
    expect(searchPage).toContain("runPublicLegalSearchOperation");
    expect(searchPage).not.toContain('from "@/lib/search"');
  });
});
