import { EventEmitter } from "node:events";
import type { ClientRequest, IncomingMessage } from "node:http";
import type { RequestOptions } from "node:https";
import { PassThrough } from "node:stream";
import type { DetailedPeerCertificate } from "node:tls";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  createNodeApprovedUpstreamDial,
  UpstreamResponseTooLargeError,
  UpstreamUrlRejectedError,
  type ApprovedUpstreamRequestFactory,
  fetchApprovedUpstream,
  readBoundedResponseText,
} from "@/lib/server/upstream-http";

describe("upstream HTTP security boundary", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("requires HTTPS and an explicit origin allowlist", async () => {
    const resolveHost = vi.fn(async () => [{ address: "203.0.113.10", family: 4 as const }]);
    const dial = vi.fn(async () => new Response("ok"));

    await expect(fetchApprovedUpstream("http://relay.example.test/hook", {}, {
      allowedOrigins: ["https://relay.example.test"], resolveHost, dial,
    })).rejects.toBeInstanceOf(UpstreamUrlRejectedError);
    await expect(fetchApprovedUpstream("https://other.example.test/hook", {}, {
      allowedOrigins: ["https://relay.example.test"], resolveHost, dial,
    })).rejects.toBeInstanceOf(UpstreamUrlRejectedError);
    expect(resolveHost).not.toHaveBeenCalled();
    expect(dial).not.toHaveBeenCalled();
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
    await expect(fetchApprovedUpstream("https://relay.example.test/hook", {}, {
      allowedOrigins: ["https://relay.example.test"],
      resolveHost: async () => [{ address, family: address.includes(":") ? 6 : 4 }],
      dial: async () => new Response("must not run"),
    })).rejects.toBeInstanceOf(UpstreamUrlRejectedError);
  });

  it("accepts an allowlisted origin only when every resolved address is public", async () => {
    const dial = vi.fn(async () => new Response("approved"));
    const result = await fetchApprovedUpstream("https://relay.example.test/hook?job=1", {}, {
      allowedOrigins: ["https://relay.example.test"],
      resolveHost: async () => [
        { address: "8.8.8.8", family: 4 },
        { address: "2001:4860:4860::8888", family: 6 },
      ],
      dial,
    });

    expect(dial).toHaveBeenCalledWith(expect.objectContaining({
      url: expect.objectContaining({ origin: "https://relay.example.test", pathname: "/hook" }),
    }));
    await expect(result.text()).resolves.toBe("approved");
  });

  it("resolves once and passes the validated address to the TLS dial", async () => {
    const resolveHost = vi.fn(async () => [{ address: "8.8.8.8", family: 4 as const }]);
    const dial = vi.fn(async () => new Response("pinned response"));

    const response = await fetchApprovedUpstream(
      "https://relay.example.test/hook",
      { method: "POST", body: "{}", headers: { "content-type": "application/json" } },
      { allowedOrigins: ["https://relay.example.test"], resolveHost, dial },
    );

    expect(resolveHost).toHaveBeenCalledOnce();
    expect(dial).toHaveBeenCalledWith(expect.objectContaining({
      selectedAddress: "8.8.8.8",
      selectedFamily: 4,
      method: "POST",
    }));
    await expect(response.text()).resolves.toBe("pinned response");
  });

  it("does not dial when any resolved address is private", async () => {
    const dial = vi.fn(async () => new Response("must not run"));
    await expect(fetchApprovedUpstream(
      "https://relay.example.test/hook",
      {},
      {
        allowedOrigins: ["https://relay.example.test"],
        resolveHost: async () => [
          { address: "8.8.8.8", family: 4 },
          { address: "127.0.0.1", family: 4 },
        ],
        dial,
      },
    )).rejects.toBeInstanceOf(UpstreamUrlRejectedError);
    expect(dial).not.toHaveBeenCalled();
  });

  it("pins the Node HTTPS lookup while preserving the original TLS identity", async () => {
    let requestOptions: RequestOptions | undefined;
    const response = Object.assign(new PassThrough(), {
      statusCode: 200,
      headers: { "content-type": "application/json" },
      socket: { remoteAddress: "8.8.8.8" },
    });
    const end = vi.fn(() => response.end("{}"));
    const request = Object.assign(new EventEmitter(), { end }) as unknown as ClientRequest;
    const requestFactory = vi.fn<ApprovedUpstreamRequestFactory>((_url, options, onResponse) => {
      requestOptions = options;
      queueMicrotask(() => onResponse(response as unknown as IncomingMessage));
      return request;
    });
    const certificateVerifier = vi.fn((
      _hostname: string,
      _certificate: DetailedPeerCertificate,
    ) => undefined);
    const dial = createNodeApprovedUpstreamDial({ requestFactory, certificateVerifier });

    const result = await dial({
      url: new URL("https://relay.example.test/hook"),
      method: "POST",
      headers: new Headers({ "content-type": "application/json" }),
      body: "{}",
      selectedAddress: "8.8.8.8",
      selectedFamily: 4,
    });

    if (!requestOptions) throw new Error("request factory did not receive options");
    expect(requestOptions).toMatchObject({
      method: "POST",
      agent: false,
      rejectUnauthorized: true,
      servername: "relay.example.test",
      headers: expect.objectContaining({ host: "relay.example.test" }),
    });
    expect(end).toHaveBeenCalledWith("{}");

    const lookup = requestOptions.lookup as unknown as (
      hostname: string,
      options: object,
      callback: (error: NodeJS.ErrnoException | null, address: string, family: number) => void,
    ) => void;
    await new Promise<void>((resolve, reject) => {
      lookup("relay.example.test", {}, (error, address, family) => {
        if (error) {
          reject(error);
          return;
        }
        expect(address).toBe("8.8.8.8");
        expect(family).toBe(4);
        resolve();
      });
    });

    const verifyCertificate = requestOptions.checkServerIdentity;
    if (!verifyCertificate) throw new Error("certificate verifier was not configured");
    verifyCertificate("socket-callback-host.invalid", {} as DetailedPeerCertificate);
    expect(certificateVerifier).toHaveBeenCalledWith("relay.example.test", expect.any(Object));
    await expect(result.text()).resolves.toBe("{}");
  });

  it("rejects the Node HTTPS response when the socket misses the DNS pin", async () => {
    const response = Object.assign(new PassThrough(), {
      statusCode: 200,
      headers: {},
      socket: { remoteAddress: "8.8.4.4" },
    });
    const request = Object.assign(new EventEmitter(), {
      end: vi.fn(() => queueMicrotask(() => response.end("{}"))),
    }) as unknown as ClientRequest;
    const requestFactory = vi.fn<ApprovedUpstreamRequestFactory>((_url, _options, onResponse) => {
      queueMicrotask(() => onResponse(response as unknown as IncomingMessage));
      return request;
    });
    const dial = createNodeApprovedUpstreamDial({ requestFactory });

    await expect(dial({
      url: new URL("https://relay.example.test/hook"),
      method: "GET",
      headers: new Headers(),
      selectedAddress: "8.8.8.8",
      selectedFamily: 4,
    })).rejects.toBeInstanceOf(UpstreamUrlRejectedError);
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
