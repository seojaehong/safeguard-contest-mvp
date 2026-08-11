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

export async function assertApprovedUpstreamUrl(
  rawUrl: string,
  options: {
    allowedOrigins: string[];
    resolveHost?: ResolveHost;
  },
): Promise<URL> {
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
  return parsed;
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
