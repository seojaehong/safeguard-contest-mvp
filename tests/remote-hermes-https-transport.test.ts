import { EventEmitter } from "node:events";
import type { ClientRequest, IncomingMessage } from "node:http";
import { PassThrough } from "node:stream";
import type { DetailedPeerCertificate } from "node:tls";

import { describe, expect, it, vi } from "vitest";

import {
  createConfiguredRemoteHermesHttpsTransport,
  createNodeRemoteHermesHttpsDial,
  createRemoteHermesHttpsTransport,
  REMOTE_HERMES_MAX_OUTBOUND_BODY_BYTES,
  type RemoteHermesHttpsDial,
  type RemoteHermesHttpsDialInput,
  type RemoteHermesHttpsDialResult,
  type RemoteHermesResolvedAddress,
  type RemoteHermesResolver,
  type RemoteHermesNodeRequestFactory,
} from "@/lib/remote-hermes-https-transport";
import { createRemoteHermesPolicyAttestation } from "@/lib/remote-hermes-contract";
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

function dispatchInputWithBody(body: string, signal: AbortSignal = new AbortController().signal) {
  return { ...dispatchInput(signal), body };
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
  it("constructs the production transport only from a matching attested identity", () => {
    const policyAttestation = createRemoteHermesPolicyAttestation({
      serviceId: "hermes-service",
      endpointOrigin: origin,
      issuedAt: new Date(Date.now() - 1_000).toISOString(),
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
      keyId: "hermes-response-key",
      signingSecret: "v".repeat(32),
    });

    expect(createConfiguredRemoteHermesHttpsTransport({
      SAFECLAW_REMOTE_HERMES_SERVICE_ID: "hermes-service",
      SAFECLAW_REMOTE_HERMES_POLICY_ATTESTATION: JSON.stringify(policyAttestation),
    })).toMatchObject({ dispatch: expect.any(Function) });
    expect(createConfiguredRemoteHermesHttpsTransport({
      SAFECLAW_REMOTE_HERMES_SERVICE_ID: "other-service",
      SAFECLAW_REMOTE_HERMES_POLICY_ATTESTATION: JSON.stringify(policyAttestation),
    })).toBeUndefined();
    expect(createConfiguredRemoteHermesHttpsTransport({
      SAFECLAW_REMOTE_HERMES_SERVICE_ID: "hermes-service",
      SAFECLAW_REMOTE_HERMES_POLICY_ATTESTATION: "{",
    })).toBeUndefined();
  });

  it("accepts an outbound body at the exact UTF-8 byte cap", async () => {
    const resolver = vi.fn(async () => [{ address: "93.184.216.34", family: 4 as const }]);
    const dial = vi.fn(async (input: RemoteHermesHttpsDialInput) => dialResult(input));
    const transport = createRemoteHermesHttpsTransport({
      serviceId: "hermes-service",
      policyAttestationDigest: "a".repeat(64),
      resolver,
      dial,
    });
    const exactBody = `${"가".repeat(Math.floor(REMOTE_HERMES_MAX_OUTBOUND_BODY_BYTES / 3))}${"a".repeat(
      REMOTE_HERMES_MAX_OUTBOUND_BODY_BYTES % 3,
    )}`;
    expect(Buffer.byteLength(exactBody, "utf8")).toBe(REMOTE_HERMES_MAX_OUTBOUND_BODY_BYTES);

    await transport.dispatch(dispatchInputWithBody(exactBody));

    expect(resolver).toHaveBeenCalledOnce();
    expect(dial).toHaveBeenCalledOnce();
  });

  it("rejects an outbound body over the UTF-8 byte cap before DNS or dialing", async () => {
    const resolver = vi.fn<RemoteHermesResolver>();
    const dial = vi.fn<RemoteHermesHttpsDial>();
    const transport = createRemoteHermesHttpsTransport({
      serviceId: "hermes-service",
      policyAttestationDigest: "a".repeat(64),
      resolver,
      dial,
    });
    const overBody = `${"a".repeat(REMOTE_HERMES_MAX_OUTBOUND_BODY_BYTES)}가`;

    await expect(transport.dispatch(dispatchInputWithBody(overBody))).rejects.toThrow("outbound body exceeds");
    expect(resolver).not.toHaveBeenCalled();
    expect(dial).not.toHaveBeenCalled();
  });

  it("uses the Node HTTPS request path with the pin and original TLS hostname", async () => {
    let requestOptions: Parameters<RemoteHermesNodeRequestFactory>[1] | undefined;
    const response = Object.assign(new PassThrough(), {
      statusCode: 200,
      headers: { "content-type": "application/json" },
      socket: { remoteAddress: "93.184.216.34" },
    });
    const end = vi.fn(() => response.end("{}"));
    const request = Object.assign(new EventEmitter(), { end }) as unknown as ClientRequest;
    const requestFactory = vi.fn<RemoteHermesNodeRequestFactory>((_url, options, onResponse) => {
      requestOptions = options;
      queueMicrotask(() => onResponse(response as unknown as IncomingMessage));
      return request;
    });
    const certificateVerifier = vi.fn((
      _hostname: string,
      _certificate: DetailedPeerCertificate,
    ) => undefined);
    const nodeDial = createNodeRemoteHermesHttpsDial({ requestFactory, certificateVerifier });
    const input: RemoteHermesHttpsDialInput = {
      url: new URL(endpoint),
      body: "{}",
      signal: new AbortController().signal,
      selectedAddress: "93.184.216.34",
      selectedFamily: 4,
      servername: "hermes.example.test",
      certificateHostname: "hermes.example.test",
      rejectUnauthorized: true,
      hostHeader: "hermes.example.test",
    };

    const result = await nodeDial(input);
    if (!requestOptions) throw new Error("request factory did not receive options");
    expect(requestFactory).toHaveBeenCalledWith(new URL(endpoint), expect.any(Object), expect.any(Function));
    expect(requestOptions).toMatchObject({
      method: "POST",
      agent: false,
      rejectUnauthorized: true,
      servername: "hermes.example.test",
      headers: expect.objectContaining({ host: "hermes.example.test" }),
    });
    expect(end).toHaveBeenCalledWith("{}");
    expect(result.connectedAddress).toBe("93.184.216.34");

    const lookup = requestOptions.lookup as unknown as (
      hostname: string,
      options: object,
      callback: (error: NodeJS.ErrnoException | null, address: string, family: number) => void,
    ) => void;
    await new Promise<void>((resolve, reject) => {
      lookup("hermes.example.test", {}, (error, address, family) => {
        if (error) {
          reject(error);
          return;
        }
        expect(address).toBe("93.184.216.34");
        expect(family).toBe(4);
        resolve();
      });
    });

    const verifyCertificate = requestOptions.checkServerIdentity;
    if (!verifyCertificate) throw new Error("certificate verifier was not configured");
    verifyCertificate("socket-callback-host.invalid", {} as DetailedPeerCertificate);
    expect(certificateVerifier).toHaveBeenCalledWith("hermes.example.test", expect.any(Object));
    await result.body.cancel();
  });

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

  it("isolates the missing durable ledger as the only runtime availability blocker", async () => {
    const { createRemoteHermesRuntime } = await import("@/lib/remote-hermes-runtime");
    const transport = createTransport({});
    const now = Date.now();
    const env = {
      SAFECLAW_REMOTE_HERMES_ENDPOINT: endpoint,
      SAFECLAW_REMOTE_HERMES_HOST_ALLOWLIST: "hermes.example.test",
      SAFECLAW_REMOTE_HERMES_TENANT_ALLOWLIST: "org-1:site-1",
      SAFECLAW_REMOTE_HERMES_ISSUER: "safeclaw-control-plane",
      SAFECLAW_REMOTE_HERMES_AUDIENCE: "hermes-gateway",
      SAFECLAW_REMOTE_HERMES_REQUEST_KEY_ID: "safeclaw-request-key",
      SAFECLAW_REMOTE_HERMES_REQUEST_SIGNING_SECRET: "s".repeat(32),
      SAFECLAW_REMOTE_HERMES_SERVICE_ID: "hermes-service",
      SAFECLAW_REMOTE_HERMES_RESPONSE_KEY_ID: "hermes-response-key",
      SAFECLAW_REMOTE_HERMES_RESPONSE_VERIFICATION_SECRET: "v".repeat(32),
      SAFECLAW_REMOTE_HERMES_POLICY_ATTESTATION: JSON.stringify(createRemoteHermesPolicyAttestation({
        serviceId: "hermes-service",
        endpointOrigin: origin,
        issuedAt: new Date(now - 1_000).toISOString(),
        expiresAt: new Date(now + 60_000).toISOString(),
        keyId: "hermes-response-key",
        signingSecret: "v".repeat(32),
      })),
    };

    expect(createRemoteHermesRuntime({
      env,
      trustedTransport: transport,
      attemptLedger: {
        reserve: vi.fn(async () => {
          throw new Error("ledger fixture must not execute during runtime creation");
        }),
        recordTerminal: vi.fn(async () => {
          throw new Error("terminal ledger fixture must not execute during runtime creation");
        }),
      },
    })).toBeDefined();
    expect(createRemoteHermesRuntime({ env, trustedTransport: transport })).toBeUndefined();
  });
});
