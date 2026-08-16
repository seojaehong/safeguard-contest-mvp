import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getAccessToken: vi.fn(async () => "test-access-token"),
}));

vi.mock("google-auth-library", () => ({
  GoogleAuth: class MockGoogleAuth {
    getAccessToken = mocks.getAccessToken;
  },
}));

describe("cancellable Vertex transport", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    vi.stubEnv("GOOGLE_APPLICATION_CREDENTIALS_JSON", JSON.stringify({ client_email: "test@example.com" }));
    vi.stubEnv("GCP_PROJECT_ID", "test-project");
    vi.stubEnv("GCP_REGION", "asia-northeast3");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("returns generated text through the authenticated REST endpoint", async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      expect(init?.signal).toBeInstanceOf(AbortSignal);
      return Response.json({
        candidates: [{ content: { parts: [{ text: "안전 답변" }] }, finishReason: "STOP" }],
      });
    });
    vi.stubGlobal("fetch", fetchMock);
    const { generateWithVertex } = await import("@/lib/vertex/client");

    await expect(generateWithVertex("gemini-test", "prompt")).resolves.toBe("안전 답변");
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain(
      "/projects/test-project/locations/asia-northeast3/publishers/google/models/gemini-test:generateContent",
    );
  });

  it("aborts the underlying Vertex fetch when the caller disconnects", async () => {
    let requestSignal: AbortSignal | undefined;
    vi.stubGlobal("fetch", vi.fn((_input: RequestInfo | URL, init?: RequestInit) =>
      new Promise<Response>((_, reject) => {
        requestSignal = init?.signal ?? undefined;
        requestSignal?.addEventListener("abort", () => reject(requestSignal?.reason), { once: true });
      })
    ));
    const controller = new AbortController();
    const { generateWithVertex } = await import("@/lib/vertex/client");
    const pending = generateWithVertex("gemini-test", "prompt", { signal: controller.signal });
    await vi.waitFor(() => expect(requestSignal).toBeInstanceOf(AbortSignal));
    const reason = new Error("caller disconnected");
    controller.abort(reason);

    await expect(pending).rejects.toBe(reason);
    expect(requestSignal?.aborted).toBe(true);
  });

  it("rejects oversized Vertex responses before JSON parsing", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("{}", {
      headers: { "content-length": String(2 * 1024 * 1024 + 1) },
    })));
    const { generateWithVertex } = await import("@/lib/vertex/client");

    await expect(generateWithVertex("gemini-test", "prompt")).rejects.toThrow(
      "Vertex AI generation response exceeded the 2097152-byte response limit",
    );
  });
});
