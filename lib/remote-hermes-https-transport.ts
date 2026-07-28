import { lookup as dnsLookup } from "node:dns";
import { request as httpsRequest, type RequestOptions } from "node:https";
import { isIP } from "node:net";
import { checkServerIdentity, type DetailedPeerCertificate } from "node:tls";
import type { ClientRequest, IncomingHttpHeaders, IncomingMessage } from "node:http";

import {
  REMOTE_HERMES_MAX_ENVELOPE_BYTES,
  type RemoteHermesTrustedTransport,
} from "@/lib/remote-hermes-runtime";
import type { EnvLike } from "@/lib/engine-adapter";

export const REMOTE_HERMES_MAX_OUTBOUND_BODY_BYTES = REMOTE_HERMES_MAX_ENVELOPE_BYTES;

export type RemoteHermesResolvedAddress = {
  address: string;
  family: 4 | 6;
};

export type RemoteHermesResolver = (
  hostname: string,
  signal: AbortSignal,
) => Promise<readonly RemoteHermesResolvedAddress[]>;

export type RemoteHermesHttpsDialInput = {
  url: URL;
  body: string;
  signal: AbortSignal;
  selectedAddress: string;
  selectedFamily: 4 | 6;
  servername: string;
  certificateHostname: string;
  rejectUnauthorized: true;
  hostHeader: string;
};

export type RemoteHermesHttpsDialResult = {
  statusCode: number;
  headers: HeadersInit;
  body: ReadableStream<Uint8Array>;
  connectedAddress: string;
};

export type RemoteHermesHttpsDial = (
  input: RemoteHermesHttpsDialInput,
) => Promise<RemoteHermesHttpsDialResult>;

export type RemoteHermesNodeRequestFactory = (
  url: URL,
  options: RequestOptions,
  onResponse: (response: IncomingMessage) => void,
) => ClientRequest;

export type RemoteHermesCertificateVerifier = (
  hostname: string,
  certificate: DetailedPeerCertificate,
) => Error | undefined;

export type RemoteHermesHttpsTransportOptions = {
  serviceId: string;
  policyAttestationDigest: string;
  resolver?: RemoteHermesResolver;
  dial?: RemoteHermesHttpsDial;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function createConfiguredRemoteHermesHttpsTransport(
  env: EnvLike,
): RemoteHermesTrustedTransport | undefined {
  const serviceId = env.SAFECLAW_REMOTE_HERMES_SERVICE_ID?.trim();
  const rawAttestation = env.SAFECLAW_REMOTE_HERMES_POLICY_ATTESTATION?.trim();
  if (!serviceId || !rawAttestation) return undefined;

  try {
    const attestation = JSON.parse(rawAttestation) as unknown;
    if (!isRecord(attestation)
      || attestation.serviceId !== serviceId
      || typeof attestation.attestationDigest !== "string"
      || !/^[a-f0-9]{64}$/u.test(attestation.attestationDigest)) {
      return undefined;
    }
    return createRemoteHermesHttpsTransport({
      serviceId,
      policyAttestationDigest: attestation.attestationDigest,
    });
  } catch {
    return undefined;
  }
}

function abortReason(signal: AbortSignal): Error {
  return signal.reason instanceof Error ? signal.reason : new Error("remote Hermes request aborted");
}

function reportCleanupFailure(error: unknown): void {
  console.warn("remote Hermes HTTPS body cleanup failed", error);
}

async function abortable<T>(
  operation: Promise<T>,
  signal: AbortSignal,
  disposeLateResult?: (value: T) => Promise<void>,
): Promise<T> {
  if (signal.aborted) throw abortReason(signal);
  return await new Promise<T>((resolve, reject) => {
    let aborted = false;
    const onAbort = (): void => {
      aborted = true;
      reject(abortReason(signal));
    };
    signal.addEventListener("abort", onAbort, { once: true });
    operation.then(
      (value) => {
        if (aborted) {
          if (disposeLateResult) void disposeLateResult(value).catch(reportCleanupFailure);
          return;
        }
        resolve(value);
      },
      reject,
    ).finally(() => signal.removeEventListener("abort", onAbort));
  });
}

function ipv4Number(address: string): number | undefined {
  if (isIP(address) !== 4) return undefined;
  const octets = address.split(".").map(Number);
  return octets.reduce((value, octet) => ((value << 8) | octet) >>> 0, 0);
}

function ipv4InCidr(address: number, base: string, prefix: number): boolean {
  const baseNumber = ipv4Number(base);
  if (baseNumber === undefined) return false;
  const mask = prefix === 0 ? 0 : (0xffffffff << (32 - prefix)) >>> 0;
  return (address & mask) === (baseNumber & mask);
}

function expandIpv6(address: string): readonly number[] | undefined {
  if (isIP(address) !== 6) return undefined;
  let normalized = address.toLowerCase();
  const ipv4Tail = normalized.match(/(?:^|:)(\d+\.\d+\.\d+\.\d+)$/u)?.[1];
  if (ipv4Tail) {
    const ipv4 = ipv4Number(ipv4Tail);
    if (ipv4 === undefined) return undefined;
    normalized = normalized.slice(0, -ipv4Tail.length)
      + `${(ipv4 >>> 16).toString(16)}:${(ipv4 & 0xffff).toString(16)}`;
  }
  const halves = normalized.split("::");
  if (halves.length > 2) return undefined;
  const left = halves[0] ? halves[0].split(":") : [];
  const right = halves[1] ? halves[1].split(":") : [];
  const missing = 8 - left.length - right.length;
  if ((halves.length === 1 && missing !== 0) || (halves.length === 2 && missing < 1)) return undefined;
  const groups = [...left, ...Array.from({ length: missing }, () => "0"), ...right];
  if (groups.length !== 8 || groups.some((group) => !/^[0-9a-f]{1,4}$/u.test(group))) return undefined;
  return groups.map((group) => Number.parseInt(group, 16));
}

function ipv6InCidr(groups: readonly number[], base: string, prefix: number): boolean {
  const baseGroups = expandIpv6(base);
  if (!baseGroups) return false;
  const wholeGroups = Math.floor(prefix / 16);
  const remainingBits = prefix % 16;
  for (let index = 0; index < wholeGroups; index += 1) {
    if (groups[index] !== baseGroups[index]) return false;
  }
  if (remainingBits === 0) return true;
  const mask = (0xffff << (16 - remainingBits)) & 0xffff;
  return ((groups[wholeGroups] ?? 0) & mask) === ((baseGroups[wholeGroups] ?? 0) & mask);
}

const NON_PUBLIC_IPV4_CIDRS: readonly [string, number][] = [
  ["0.0.0.0", 8],
  ["10.0.0.0", 8],
  ["100.64.0.0", 10],
  ["127.0.0.0", 8],
  ["169.254.0.0", 16],
  ["172.16.0.0", 12],
  ["192.0.0.0", 24],
  ["192.0.2.0", 24],
  ["192.31.196.0", 24],
  ["192.52.193.0", 24],
  ["192.88.99.0", 24],
  ["192.168.0.0", 16],
  ["192.175.48.0", 24],
  ["198.18.0.0", 15],
  ["198.51.100.0", 24],
  ["203.0.113.0", 24],
  ["224.0.0.0", 4],
  ["240.0.0.0", 4],
];

const NON_PUBLIC_IPV6_CIDRS: readonly [string, number][] = [
  ["2001::", 23],
  ["2001:db8::", 32],
  ["2002::", 16],
  ["3fff::", 20],
];

export function isPublicRemoteHermesAddress(address: string): boolean {
  const ipv4 = ipv4Number(address);
  if (ipv4 !== undefined) {
    return !NON_PUBLIC_IPV4_CIDRS.some(([base, prefix]) => ipv4InCidr(ipv4, base, prefix));
  }
  const ipv6 = expandIpv6(address);
  if (!ipv6) return false;
  if (!ipv6InCidr(ipv6, "2000::", 3)) return false;
  return !NON_PUBLIC_IPV6_CIDRS.some(([base, prefix]) => ipv6InCidr(ipv6, base, prefix));
}

function canonicalAddress(address: string): string | undefined {
  if (isIP(address) === 4) return address.split(".").map(Number).join(".");
  if (isIP(address) !== 6) return undefined;
  try {
    const hostname = new URL(`https://[${address}]/`).hostname;
    return hostname.slice(1, -1).toLowerCase();
  } catch {
    return undefined;
  }
}

function addressesMatch(selected: string, connected: string): boolean {
  const selectedCanonical = canonicalAddress(selected);
  return selectedCanonical !== undefined && selectedCanonical === canonicalAddress(connected);
}

const defaultResolver: RemoteHermesResolver = async (hostname, signal) => {
  const operation = new Promise<readonly RemoteHermesResolvedAddress[]>((resolve, reject) => {
    dnsLookup(hostname, { all: true, verbatim: true }, (error, addresses) => {
      if (error) {
        reject(error);
        return;
      }
      resolve(addresses.map(({ address, family }) => ({
        address,
        family: family === 6 ? 6 : 4,
      })));
    });
  });
  return await abortable(operation, signal);
};

function responseHeaders(headers: IncomingHttpHeaders): Headers {
  const result = new Headers();
  for (const [name, value] of Object.entries(headers)) {
    if (Array.isArray(value)) {
      for (const entry of value) result.append(name, entry);
    } else if (value !== undefined) {
      result.set(name, value);
    }
  }
  return result;
}

function responseBody(response: IncomingMessage, signal: AbortSignal): ReadableStream<Uint8Array> {
  const iterator = response[Symbol.asyncIterator]();
  const onAbort = (): void => {
    response.destroy(abortReason(signal));
  };
  signal.addEventListener("abort", onAbort, { once: true });
  const removeAbortListener = (): void => signal.removeEventListener("abort", onAbort);
  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      try {
        const chunk = await iterator.next();
        if (chunk.done) {
          removeAbortListener();
          controller.close();
          return;
        }
        if (Buffer.isBuffer(chunk.value)) {
          controller.enqueue(new Uint8Array(chunk.value));
          return;
        }
        if (typeof chunk.value === "string") {
          controller.enqueue(new TextEncoder().encode(chunk.value));
          return;
        }
        throw new Error("remote Hermes HTTPS response emitted an unsupported chunk");
      } catch (error) {
        removeAbortListener();
        controller.error(error);
      }
    },
    async cancel(reason) {
      removeAbortListener();
      response.destroy(reason instanceof Error ? reason : undefined);
      await iterator.return?.();
    },
  });
}

const defaultRequestFactory: RemoteHermesNodeRequestFactory = (url, options, onResponse) => (
  httpsRequest(url, options, onResponse)
);

export function createNodeRemoteHermesHttpsDial(options: {
  requestFactory?: RemoteHermesNodeRequestFactory;
  certificateVerifier?: RemoteHermesCertificateVerifier;
} = {}): RemoteHermesHttpsDial {
  const requestFactory = options.requestFactory ?? defaultRequestFactory;
  const certificateVerifier = options.certificateVerifier ?? checkServerIdentity;
  return async (input) => {
    const operation = new Promise<RemoteHermesHttpsDialResult>((resolve, reject) => {
      const request = requestFactory(input.url, {
        method: "POST",
        agent: false,
        rejectUnauthorized: input.rejectUnauthorized,
        servername: input.servername,
        checkServerIdentity: (_hostname, certificate) => (
          certificateVerifier(input.certificateHostname, certificate)
        ),
        signal: input.signal,
        headers: {
          accept: "application/json",
          "content-type": "application/json",
          "content-length": Buffer.byteLength(input.body, "utf8"),
          host: input.hostHeader,
        },
        lookup: (_hostname, _options, callback) => {
          callback(null, input.selectedAddress, input.selectedFamily);
        },
      }, (response) => {
        const connectedAddress = response.socket.remoteAddress;
        if (!connectedAddress) {
          response.destroy();
          reject(new Error("remote Hermes HTTPS socket has no remote address"));
          return;
        }
        resolve({
          statusCode: response.statusCode ?? 0,
          headers: responseHeaders(response.headers),
          body: responseBody(response, input.signal),
          connectedAddress,
        });
      });
      request.once("error", reject);
      request.end(input.body);
    });
    return await abortable(operation, input.signal);
  };
}

const defaultDial = createNodeRemoteHermesHttpsDial();

export function createRemoteHermesHttpsTransport(
  options: RemoteHermesHttpsTransportOptions,
): RemoteHermesTrustedTransport {
  if (!options.serviceId.trim() || !/^[a-f0-9]{64}$/u.test(options.policyAttestationDigest)) {
    throw new Error("invalid remote Hermes HTTPS transport identity");
  }
  const resolver = options.resolver ?? defaultResolver;
  const dial = options.dial ?? defaultDial;
  return {
    async dispatch(input) {
      if (input.signal.aborted) throw abortReason(input.signal);
      if (Buffer.byteLength(input.body, "utf8") > REMOTE_HERMES_MAX_OUTBOUND_BODY_BYTES) {
        throw new Error("remote Hermes HTTPS outbound body exceeds the bounded envelope size");
      }
      const url = new URL(input.endpoint);
      if (url.protocol !== "https:"
        || url.origin !== input.expectedOrigin
        || url.username
        || url.password
        || url.hash
        || isIP(url.hostname) !== 0) {
        throw new Error("remote Hermes HTTPS endpoint violates the trusted origin policy");
      }
      const addresses = await abortable(resolver(url.hostname, input.signal), input.signal);
      if (addresses.length === 0) throw new Error("remote Hermes DNS resolution returned no addresses");
      for (const resolved of addresses) {
        if (isIP(resolved.address) !== resolved.family || !isPublicRemoteHermesAddress(resolved.address)) {
          throw new Error("remote Hermes DNS resolution returned a non-public address");
        }
      }
      const selected = addresses[0];
      if (!selected) throw new Error("remote Hermes DNS resolution returned no addresses");
      if (input.signal.aborted) throw abortReason(input.signal);
      const dialed = await abortable(dial({
        url,
        body: input.body,
        signal: input.signal,
        selectedAddress: selected.address,
        selectedFamily: selected.family,
        servername: url.hostname,
        certificateHostname: url.hostname,
        rejectUnauthorized: true,
        hostHeader: url.host,
      }), input.signal, async (lateResult) => {
        await lateResult.body.cancel();
      });
      if (!addressesMatch(selected.address, dialed.connectedAddress)) {
        await dialed.body.cancel().catch(reportCleanupFailure);
        throw new Error("remote Hermes HTTPS pinned address mismatch");
      }
      if (dialed.statusCode >= 300 && dialed.statusCode < 400) {
        await dialed.body.cancel().catch(reportCleanupFailure);
        throw new Error("remote Hermes HTTPS redirect prohibited");
      }
      if (dialed.statusCode < 200 || dialed.statusCode > 599) {
        await dialed.body.cancel().catch(reportCleanupFailure);
        throw new Error("remote Hermes HTTPS response has an invalid status");
      }
      return {
        response: new Response(dialed.body, {
          status: dialed.statusCode,
          headers: dialed.headers,
        }),
        connection: {
          version: "remote-hermes-connected-origin/v1",
          endpointOrigin: input.expectedOrigin,
          connectedOrigin: url.origin,
          connectedAddress: dialed.connectedAddress,
          redirects: 0,
          serviceId: options.serviceId,
          policyAttestationDigest: options.policyAttestationDigest,
        },
      };
    },
  };
}
