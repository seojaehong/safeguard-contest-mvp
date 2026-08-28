import type { RequestOptions } from "node:https";
import type { ClientRequest, IncomingHttpHeaders, IncomingMessage } from "node:http";
import type { DetailedPeerCertificate } from "node:tls";

type ResolvedAddress = {
  address: string;
  family: number;
};

type ResolveHost = (hostname: string) => Promise<ResolvedAddress[]>;

type DnsPromisesModule = {
  lookup(
    hostname: string,
    options: { all: true; verbatim: true },
  ): Promise<ResolvedAddress[]>;
};

type ProcessWithBuiltinModule = NodeJS.Process & {
  getBuiltinModule?: (specifier: string) => unknown;
};

type HttpsModule = {
  request: ApprovedUpstreamRequestFactory;
};

type TlsModule = {
  checkServerIdentity: ApprovedUpstreamCertificateVerifier;
};

export type ApprovedUpstreamDialInput = {
  url: URL;
  method: string;
  headers: Headers;
  body?: string;
  signal?: AbortSignal;
  selectedAddress: string;
  selectedFamily: 4 | 6;
};

export type ApprovedUpstreamDial = (input: ApprovedUpstreamDialInput) => Promise<Response>;

export type ApprovedUpstreamRequestFactory = (
  url: URL,
  options: RequestOptions,
  onResponse: (response: IncomingMessage) => void,
) => ClientRequest;

export type ApprovedUpstreamCertificateVerifier = (
  hostname: string,
  certificate: DetailedPeerCertificate,
) => Error | undefined;

export class UpstreamUrlRejectedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UpstreamUrlRejectedError";
  }
}

export class UpstreamResponseTooLargeError extends Error {
  readonly limit: number;

  constructor(label: string, limit: number) {
    super(`${label} exceeded the ${limit}-byte response limit`);
    this.name = "UpstreamResponseTooLargeError";
    this.limit = limit;
  }
}

function isPrivateIpv4(address: string): boolean {
  const parts = address.split(".").map(Number);
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) {
    return true;
  }
  const [a, b] = parts;
  return a === 0
    || a === 10
    || a === 127
    || (a === 100 && b >= 64 && b <= 127)
    || (a === 169 && b === 254)
    || (a === 172 && b >= 16 && b <= 31)
    || (a === 192 && (b === 0 || b === 2 || b === 168))
    || (a === 198 && (b === 18 || b === 19))
    || (a === 198 && b === 51)
    || (a === 203 && b === 0)
    || a >= 224;
}

function isPrivateIpv6(address: string): boolean {
  const normalized = address.toLowerCase().split("%")[0];
  if (normalized === "::" || normalized === "::1") return true;
  if (normalized.startsWith("fc") || normalized.startsWith("fd")) return true;
  if (/^fe[89ab]/u.test(normalized)) return true;
  if (normalized.startsWith("ff")) return true;
  if (normalized.startsWith("2001:db8:")) return true;
  const mappedIpv4 = normalized.match(/::ffff:(\d+\.\d+\.\d+\.\d+)$/u)?.[1];
  return mappedIpv4 ? isPrivateIpv4(mappedIpv4) : false;
}

function ipFamily(address: string): 0 | 4 | 6 {
  const normalized = address.replace(/^\[|\]$/gu, "").split("%")[0];
  const ipv4Parts = normalized.split(".");
  if (
    ipv4Parts.length === 4
    && ipv4Parts.every((part) => /^\d{1,3}$/u.test(part) && Number(part) <= 255)
  ) {
    return 4;
  }
  return normalized.includes(":") && /^[0-9a-f:.]+$/iu.test(normalized) ? 6 : 0;
}

function isPrivateOrLocalAddress(address: string): boolean {
  const family = ipFamily(address);
  if (family === 4) return isPrivateIpv4(address);
  if (family === 6) return isPrivateIpv6(address);
  return true;
}

async function defaultResolveHost(hostname: string): Promise<ResolvedAddress[]> {
  if (typeof window !== "undefined") {
    throw new UpstreamUrlRejectedError("server DNS validation is unavailable in the browser");
  }
  const getBuiltinModule = (process as ProcessWithBuiltinModule).getBuiltinModule;
  const dns = getBuiltinModule?.("node:dns/promises") as DnsPromisesModule | undefined;
  if (!dns?.lookup) {
    throw new UpstreamUrlRejectedError("server DNS resolver is unavailable");
  }
  return await dns.lookup(hostname, { all: true, verbatim: true });
}

function canonicalAddress(address: string): string | undefined {
  const family = ipFamily(address);
  if (family === 4) return address.split(".").map(Number).join(".");
  if (family !== 6) return undefined;
  try {
    const hostname = new URL(`https://[${address.split("%")[0]}]/`).hostname;
    return hostname.slice(1, -1).toLowerCase();
  } catch {
    return undefined;
  }
}

function addressesMatch(expected: string, actual: string): boolean {
  const expectedCanonical = canonicalAddress(expected);
  return expectedCanonical !== undefined && expectedCanonical === canonicalAddress(actual);
}

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

function responseBody(response: IncomingMessage, signal?: AbortSignal): ReadableStream<Uint8Array> {
  const iterator = response[Symbol.asyncIterator]();
  const onAbort = (): void => {
    response.destroy(
      signal?.reason instanceof Error ? signal.reason : new Error("approved upstream request aborted"),
    );
  };
  signal?.addEventListener("abort", onAbort, { once: true });
  const cleanup = (): void => signal?.removeEventListener("abort", onAbort);
  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      try {
        const chunk = await iterator.next();
        if (chunk.done) {
          cleanup();
          controller.close();
          return;
        }
        if (chunk.value instanceof Uint8Array) {
          controller.enqueue(new Uint8Array(chunk.value));
          return;
        }
        if (typeof chunk.value === "string") {
          controller.enqueue(new TextEncoder().encode(chunk.value));
          return;
        }
        throw new Error("approved upstream response emitted an unsupported chunk");
      } catch (error) {
        cleanup();
        controller.error(error);
      }
    },
    async cancel(reason) {
      cleanup();
      response.destroy(reason instanceof Error ? reason : undefined);
      await iterator.return?.();
    },
  });
}

const defaultRequestFactory: ApprovedUpstreamRequestFactory = (url, options, onResponse) => {
  const getBuiltinModule = (process as ProcessWithBuiltinModule).getBuiltinModule;
  const https = getBuiltinModule?.("node:https") as HttpsModule | undefined;
  if (!https?.request) {
    throw new UpstreamUrlRejectedError("server HTTPS transport is unavailable");
  }
  return https.request(url, options, onResponse);
};

const defaultCertificateVerifier: ApprovedUpstreamCertificateVerifier = (hostname, certificate) => {
  const getBuiltinModule = (process as ProcessWithBuiltinModule).getBuiltinModule;
  const tls = getBuiltinModule?.("node:tls") as TlsModule | undefined;
  if (!tls?.checkServerIdentity) {
    return new UpstreamUrlRejectedError("server TLS identity verifier is unavailable");
  }
  return tls.checkServerIdentity(hostname, certificate);
};

export function createNodeApprovedUpstreamDial(options: {
  requestFactory?: ApprovedUpstreamRequestFactory;
  certificateVerifier?: ApprovedUpstreamCertificateVerifier;
} = {}): ApprovedUpstreamDial {
  const requestFactory = options.requestFactory ?? defaultRequestFactory;
  const certificateVerifier = options.certificateVerifier ?? defaultCertificateVerifier;
  return async (input) => await new Promise<Response>((resolve, reject) => {
    input.signal?.throwIfAborted();
    const hostname = input.url.hostname.replace(/^\[|\]$/gu, "");
    const headers = Object.fromEntries(input.headers.entries());
    headers.host = input.url.host;
    if (input.body !== undefined && !input.headers.has("content-length")) {
      headers["content-length"] = String(new TextEncoder().encode(input.body).byteLength);
    }
    const request = requestFactory(input.url, {
      method: input.method,
      agent: false,
      rejectUnauthorized: true,
      servername: hostname,
      checkServerIdentity: (_socketHostname, certificate) => certificateVerifier(hostname, certificate),
      signal: input.signal,
      headers,
      lookup: (_lookupHostname, _lookupOptions, callback) => {
        callback(null, input.selectedAddress, input.selectedFamily);
      },
    }, (response) => {
      const connectedAddress = response.socket.remoteAddress;
      if (!connectedAddress || !addressesMatch(input.selectedAddress, connectedAddress)) {
        response.destroy();
        reject(new UpstreamUrlRejectedError("approved upstream socket address did not match the DNS pin"));
        return;
      }
      const status = response.statusCode ?? 502;
      const body = input.method === "HEAD" || status === 204 || status === 304
        ? null
        : responseBody(response, input.signal);
      resolve(new Response(body, { status, headers: responseHeaders(response.headers) }));
    });
    request.once("error", reject);
    request.end(input.body);
  });
}

const defaultApprovedUpstreamDial = createNodeApprovedUpstreamDial();

function normalizeAllowedOrigins(origins: string[]): Set<string> {
  const normalized = new Set<string>();
  for (const rawOrigin of origins) {
    const value = rawOrigin.trim();
    if (!value) continue;
    try {
      const parsed = new URL(value);
      if (parsed.protocol !== "https:" || parsed.username || parsed.password || parsed.pathname !== "/" || parsed.search || parsed.hash) {
        continue;
      }
      normalized.add(parsed.origin);
    } catch {
      continue;
    }
  }
  return normalized;
}

export function configuredUpstreamAllowedOrigins(): string[] {
  return (process.env.SAFECLAW_UPSTREAM_ALLOWED_ORIGINS || "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
}

async function resolveApprovedUpstreamTarget(
  rawUrl: string,
  options: {
    allowedOrigins: string[];
    resolveHost?: ResolveHost;
  },
): Promise<{ url: URL; addresses: ResolvedAddress[] }> {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new UpstreamUrlRejectedError("upstream URL is invalid");
  }
  if (parsed.protocol !== "https:" || parsed.username || parsed.password || (parsed.port && parsed.port !== "443")) {
    throw new UpstreamUrlRejectedError("upstream URL must use credential-free HTTPS on the default port");
  }
  const allowedOrigins = normalizeAllowedOrigins(options.allowedOrigins);
  if (!allowedOrigins.has(parsed.origin)) {
    throw new UpstreamUrlRejectedError(`upstream origin is not allowlisted: ${parsed.origin}`);
  }

  const hostname = parsed.hostname.replace(/^\[|\]$/gu, "");
  const literalFamily = ipFamily(hostname);
  const addresses = literalFamily
    ? [{ address: hostname, family: literalFamily }]
    : await (options.resolveHost || defaultResolveHost)(hostname);
  if (addresses.length === 0 || addresses.some((entry) => isPrivateOrLocalAddress(entry.address))) {
    throw new UpstreamUrlRejectedError(`upstream origin did not resolve exclusively to public addresses: ${parsed.origin}`);
  }
  return { url: parsed, addresses };
}

export async function fetchApprovedUpstream(
  rawUrl: string,
  init: {
    method?: string;
    headers?: HeadersInit;
    body?: string;
    signal?: AbortSignal;
  },
  options: {
    allowedOrigins: string[];
    resolveHost?: ResolveHost;
    dial?: ApprovedUpstreamDial;
  },
): Promise<Response> {
  const target = await resolveApprovedUpstreamTarget(rawUrl, {
    allowedOrigins: options.allowedOrigins,
    resolveHost: options.resolveHost,
  });
  const selected = target.addresses[0];
  if (!selected || (selected.family !== 4 && selected.family !== 6)) {
    throw new UpstreamUrlRejectedError("upstream DNS resolution did not return a supported address family");
  }
  if (process.env.NODE_ENV === "test" && !options.dial) {
    return await fetch(target.url, {
      method: init.method,
      headers: init.headers,
      body: init.body,
      signal: init.signal,
      redirect: "manual",
    });
  }
  return await (options.dial ?? defaultApprovedUpstreamDial)({
    url: target.url,
    method: init.method ?? "GET",
    headers: new Headers(init.headers),
    body: init.body,
    signal: init.signal,
    selectedAddress: selected.address,
    selectedFamily: selected.family,
  });
}

export async function readBoundedResponseText(
  response: Response,
  options: { label: string; maxBytes: number },
): Promise<string> {
  const declaredLength = Number(response.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > options.maxBytes) {
    await response.body?.cancel().catch(() => undefined);
    throw new UpstreamResponseTooLargeError(options.label, options.maxBytes);
  }
  if (!response.body) return "";

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      totalBytes += value.byteLength;
      if (totalBytes > options.maxBytes) {
        await reader.cancel();
        throw new UpstreamResponseTooLargeError(options.label, options.maxBytes);
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const bytes = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder("utf-8", { fatal: false }).decode(bytes);
}
