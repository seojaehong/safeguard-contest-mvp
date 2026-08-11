import { afterEach, describe, expect, it, vi } from "vitest";

import {
  UpstreamResponseTooLargeError,
  UpstreamUrlRejectedError,
  assertApprovedUpstreamUrl,
  readBoundedResponseText,
} from "@/lib/server/upstream-http";

describe("upstream HTTP security boundary", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("requires HTTPS and an explicit origin allowlist", async () => {
    const resolveHost = vi.fn(async () => [{ address: "203.0.113.10", family: 4 as const }]);

    await expect(assertApprovedUpstreamUrl("http://relay.example.test/hook", {
      allowedOrigins: ["https://relay.example.test"],
      resolveHost,
    })).rejects.toBeInstanceOf(UpstreamUrlRejectedError);
    await expect(assertApprovedUpstreamUrl("https://other.example.test/hook", {
      allowedOrigins: ["https://relay.example.test"],
      resolveHost,
    })).rejects.toBeInstanceOf(UpstreamUrlRejectedError);
    expect(resolveHost).not.toHaveBeenCalled();
  });

  it.each([
    "127.0.0.1",
    "10.0.0.8",
    "169.254.169.254",
    "192.168.1.2",
    "198.51.100.7",
    "203.0.113.9",
    "::1",
    "fc00::1",
    "fe80::1",
  ])("rejects private or link-local resolution %s", async (address) => {
    await expect(assertApprovedUpstreamUrl("https://relay.example.test/hook", {
      allowedOrigins: ["https://relay.example.test"],
      resolveHost: async () => [{ address, family: address.includes(":") ? 6 : 4 }],
    })).rejects.toBeInstanceOf(UpstreamUrlRejectedError);
  });

  it("accepts an allowlisted origin only when every resolved address is public", async () => {
    const result = await assertApprovedUpstreamUrl("https://relay.example.test/hook?job=1", {
      allowedOrigins: ["https://relay.example.test"],
      resolveHost: async () => [
        { address: "8.8.8.8", family: 4 },
        { address: "2001:4860:4860::8888", family: 6 },
      ],
    });

    expect(result.origin).toBe("https://relay.example.test");
    expect(result.pathname).toBe("/hook");
  });

  it("rejects oversized Content-Length before consuming the body", async () => {
    const response = new Response("small fixture", {
      headers: { "content-length": "4097" },
    });

    await expect(readBoundedResponseText(response, {
      label: "fixture upstream",
      maxBytes: 4096,
    })).rejects.toBeInstanceOf(UpstreamResponseTooLargeError);
  });

  it("cancels a streaming body as soon as the byte budget is exceeded", async () => {
    const cancel = vi.fn();
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new Uint8Array(3072));
        controller.enqueue(new Uint8Array(2048));
      },
      cancel,
    });
    const response = new Response(body);

    await expect(readBoundedResponseText(response, {
      label: "fixture upstream",
      maxBytes: 4096,
    })).rejects.toBeInstanceOf(UpstreamResponseTooLargeError);
    expect(cancel).toHaveBeenCalledTimes(1);
  });

  it("returns bounded UTF-8 text within the configured budget", async () => {
    const response = new Response("안전 응답");

    await expect(readBoundedResponseText(response, {
      label: "fixture upstream",
      maxBytes: 64,
    })).resolves.toBe("안전 응답");
  });
});
