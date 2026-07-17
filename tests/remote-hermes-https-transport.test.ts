import { describe, expect, it, vi } from "vitest";

import {
  createRemoteHermesHttpsTransport,
  type RemoteHermesHttpsDial,
  type RemoteHermesHttpsDialInput,
  type RemoteHermesHttpsDialResult,
  type RemoteHermesResolvedAddress,
  type RemoteHermesResolver,
} from "@/lib/remote-hermes-https-transport";
import type {
  RemoteHermesAttemptEnvelope,
  RemoteHermesAttemptReceipt,
} from "@/lib/remote-hermes-contract";

const endpoint = "https://hermes.example.test/v1/naturalize";
const origin = "https://hermes.example.test";

function dispatchInput(signal: AbortSignal = new AbortController().signal) {
  return {
    endpoint,
    expectedOrigin: origin,
    attempt: {} as RemoteHermesAttemptEnvelope,
    attemptReceipt: {} as RemoteHermesAttemptReceipt,
    body: JSON.stringify({ request: "safe" }),
    signal,
  };
}

function dialResult(
  input: RemoteHermesHttpsDialInput,
  overrides: Partial<Awaited<ReturnType<RemoteHermesHttpsDial>>> = {},
): Awaited<ReturnType<RemoteHermesHttpsDial>> {
  return {
    statusCode: 200,
    headers: { "content-type": "application/json" },
    body: new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new TextEncoder().encode("{}"));
        controller.close();
      },
    }),
    connectedAddress: input.selectedAddress,
    ...overrides,
  };
}

function createTransport(input: {
  addresses?: readonly RemoteHermesResolvedAddress[];
  dial?: RemoteHermesHttpsDial;
}) {
  const defaultAddresses: readonly RemoteHermesResolvedAddress[] = [
    { address: "93.184.216.34", family: 4 },
  ];
  return createRemoteHermesHttpsTransport({
    serviceId: "hermes-service",
    policyAttestationDigest: "a".repeat(64),
    resolver: vi.fn(async () => input.addresses ?? defaultAddresses),
    dial: input.dial ?? (async (dialInput) => dialResult(dialInput)),
  });
}

describe("remote Hermes pinned HTTPS transport", () => {
  it("resolves once, pins a public address, and reports the actual socket address", async () => {
    const resolver = vi.fn(async () => [{ address: "93.184.216.34", family: 4 as const }]);
    const dial = vi.fn(async (input: RemoteHermesHttpsDialInput) => dialResult(input));
    const transport = createRemoteHermesHttpsTransport({
      serviceId: "hermes-service",
      policyAttestationDigest: "a".repeat(64),
      resolver,
      dial,
    });

    const result = await transport.dispatch(dispatchInput());

    expect(resolver).toHaveBeenCalledOnce();
    expect(resolver).toHaveBeenCalledWith("hermes.example.test", expect.any(AbortSignal));
    expect(dial).toHaveBeenCalledWith(expect.objectContaining({
      selectedAddress: "93.184.216.34",
      selectedFamily: 4,
      servername: "hermes.example.test",
      certificateHostname: "hermes.example.test",
      rejectUnauthorized: true,
      hostHeader: "hermes.example.test",
      signal: expect.any(AbortSignal),
    }));
    expect(result.connection).toEqual({
      version: "remote-hermes-connected-origin/v1",
      endpointOrigin: origin,
      connectedOrigin: origin,
      connectedAddress: "93.184.216.34",
      redirects: 0,
      serviceId: "hermes-service",
      policyAttestationDigest: "a".repeat(64),
    });
  });

  it.each([
    "10.0.0.1",
    "100.64.0.1",
    "127.0.0.1",
    "169.254.169.254",
    "192.0.2.1",
    "198.51.100.1",
    "203.0.113.1",
    "224.0.0.1",
    "::1",
    "fc00::1",
    "fe80::1",
    "2001:db8::1",
    "::ffff:10.0.0.1",
  ])("rejects non-public DNS result %s before dialing", async (address) => {
    const dial = vi.fn<RemoteHermesHttpsDial>();
    const transport = createTransport({
      addresses: [{ address, family: address.includes(":") ? 6 : 4 }],
      dial,
    });

    await expect(transport.dispatch(dispatchInput())).rejects.toThrow("non-public");
    expect(dial).not.toHaveBeenCalled();
  });

  it("fails closed when DNS mixes public and private results", async () => {
    const dial = vi.fn<RemoteHermesHttpsDial>();
    const transport = createTransport({
      addresses: [
        { address: "93.184.216.34", family: 4 },
        { address: "10.0.0.1", family: 4 },
      ],
      dial,
    });

    await expect(transport.dispatch(dispatchInput())).rejects.toThrow("non-public");
    expect(dial).not.toHaveBeenCalled();
  });

  it("rejects rebinding when the actual socket address differs from the selected pin", async () => {
    const cancel = vi.fn();
    const body = new ReadableStream<Uint8Array>({ cancel });
    const transport = createTransport({
      dial: async (input) => dialResult(input, { connectedAddress: "93.184.216.35", body }),
    });

    await expect(transport.dispatch(dispatchInput())).rejects.toThrow("pinned address mismatch");
    expect(cancel).toHaveBeenCalledOnce();
  });

  it("rejects redirects and cancels the response body", async () => {
    const cancel = vi.fn();
    const body = new ReadableStream<Uint8Array>({ cancel });
    const transport = createTransport({
      dial: async (input) => dialResult(input, {
        statusCode: 307,
        headers: { location: "https://attacker.example.test/steal" },
        body,
      }),
    });

    await expect(transport.dispatch(dispatchInput())).rejects.toThrow("redirect");
    expect(cancel).toHaveBeenCalledOnce();
  });

  it("propagates abort to resolution and never dials", async () => {
    const controller = new AbortController();
    const dial = vi.fn<RemoteHermesHttpsDial>();
    const resolver = vi.fn(async (_hostname: string, signal: AbortSignal) => (
      await new Promise<readonly { address: string; family: 4 | 6 }[]>((resolve, reject) => {
        signal.addEventListener("abort", () => reject(signal.reason), { once: true });
        void resolve;
      })
    ));
    const transport = createRemoteHermesHttpsTransport({
      serviceId: "hermes-service",
      policyAttestationDigest: "a".repeat(64),
      resolver,
      dial,
    });

    const pending = transport.dispatch(dispatchInput(controller.signal));
    controller.abort(new Error("caller cancelled"));

    await expect(pending).rejects.toThrow("caller cancelled");
    expect(dial).not.toHaveBeenCalled();
  });

  it("does not start DNS resolution when the signal is already aborted", async () => {
    const controller = new AbortController();
    controller.abort(new Error("expired deadline"));
    const resolver = vi.fn<RemoteHermesResolver>();
    const dial = vi.fn<RemoteHermesHttpsDial>();
    const transport = createRemoteHermesHttpsTransport({
      serviceId: "hermes-service",
      policyAttestationDigest: "a".repeat(64),
      resolver,
      dial,
    });

    await expect(transport.dispatch(dispatchInput(controller.signal))).rejects.toThrow("expired deadline");
    expect(resolver).not.toHaveBeenCalled();
    expect(dial).not.toHaveBeenCalled();
  });

  it("cancels a response body when the dial completes after abort", async () => {
    const controller = new AbortController();
    const cancel = vi.fn();
    let completeDial: ((result: RemoteHermesHttpsDialResult) => void) | undefined;
    let capturedInput: RemoteHermesHttpsDialInput | undefined;
    const dial = vi.fn(async (input: RemoteHermesHttpsDialInput) => {
      capturedInput = input;
      return await new Promise<RemoteHermesHttpsDialResult>((resolve) => {
        completeDial = resolve;
      });
    });
    const transport = createTransport({ dial });
    const pending = transport.dispatch(dispatchInput(controller.signal));
    await vi.waitFor(() => expect(dial).toHaveBeenCalledOnce());

    controller.abort(new Error("deadline"));
    await expect(pending).rejects.toThrow("deadline");
    if (!capturedInput || !completeDial) throw new Error("dial fixture was not initialized");
    completeDial(dialResult(capturedInput, {
      body: new ReadableStream<Uint8Array>({ cancel }),
    }));
    await vi.waitFor(() => expect(cancel).toHaveBeenCalledOnce());
  });

  it("preserves the original hostname for certificate SNI and Host", async () => {
    const dial = vi.fn(async (input: RemoteHermesHttpsDialInput) => dialResult(input));
    const transport = createTransport({ dial });

    await transport.dispatch(dispatchInput());

    expect(dial).toHaveBeenCalledWith(expect.objectContaining({
      url: new URL(endpoint),
      selectedAddress: "93.184.216.34",
      servername: "hermes.example.test",
      certificateHostname: "hermes.example.test",
      rejectUnauthorized: true,
      hostHeader: "hermes.example.test",
    }));
  });

  it("keeps the runtime unavailable when only the transport exists and no ledger is supplied", async () => {
    const { createRemoteHermesRuntime } = await import("@/lib/remote-hermes-runtime");
    const transport = createTransport({});

    expect(createRemoteHermesRuntime({ env: {}, trustedTransport: transport })).toBeUndefined();
  });
});
