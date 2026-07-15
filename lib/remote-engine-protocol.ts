import { createHash, createHmac, timingSafeEqual } from "node:crypto";

export const REMOTE_ENGINE_PROTOCOL_VERSION = "v1" as const;
export const REMOTE_ENGINE_MAX_TTL_MS = 5 * 60 * 1_000;
export const REMOTE_ENGINE_MAX_FUTURE_SKEW_MS = 60 * 1_000;
export const REMOTE_ENGINE_MAX_BODY_BYTES = 16_384;
export const REMOTE_ENGINE_MAX_RAW_HEADER_LINES = 32;
export const REMOTE_ENGINE_MAX_NORMALIZED_HEADER_ENTRIES = 32;
export const REMOTE_ENGINE_MAX_HEADER_BYTES = 8_192;

const MAX_ID_LENGTH = 128;
const MAX_AUDIENCE_LENGTH = 256;
const MAX_NONCE_LENGTH = 128;
const MAX_PATH_LENGTH = 2_048;
const MAX_PROMPT_LENGTH = 12_000;
const MAX_TOOL_INTENTS = 32;
const MAX_TOOL_INTENT_LENGTH = 128;
const MAX_JSON_DEPTH = 64;
const SHA256_HEX = /^[a-f0-9]{64}$/;
const TOKEN = /^[A-Za-z0-9][A-Za-z0-9._:/-]*$/;
const CANONICAL_METHOD = /^[A-Z]{1,16}$/;
const CANONICAL_PATH_SEGMENT = /^[A-Za-z0-9._~-]+$/;
const REQUEST_KEYS = [
  "requestId",
  "userId",
  "organizationId",
  "siteId",
  "issuedAt",
  "expiresAt",
  "prompt",
  "allowedToolIntents",
  "audience",
] as const;

const HEADER_NAMES = {
  version: "x-safeclaw-protocol-version",
  method: "x-safeclaw-method",
  path: "x-safeclaw-path",
  keyId: "x-safeclaw-key-id",
  timestamp: "x-safeclaw-timestamp",
  nonce: "x-safeclaw-nonce",
  audience: "x-safeclaw-audience",
  bodyHash: "x-safeclaw-body-sha256",
  signature: "x-safeclaw-signature",
} as const;
const PROTOCOL_HEADER_NAMES = new Set<string>(Object.values(HEADER_NAMES));

export type RemoteEngineRequestV1 = {
  requestId: string;
  userId: string;
  organizationId: string;
  siteId: string;
  issuedAt: string;
  expiresAt: string;
  prompt: string;
  allowedToolIntents: readonly string[];
  audience: string;
};

export type RemoteEngineSigningKey = {
  keyId: string;
  secret: string | Uint8Array;
};

export type RemoteEngineKeyring = {
  current: RemoteEngineSigningKey;
  next?: RemoteEngineSigningKey;
};

export type RemoteEngineProtocolErrorCode =
  | "PROTOCOL_HEADER_MISSING"
  | "PROTOCOL_HEADER_MALFORMED"
  | "PROTOCOL_HEADER_DUPLICATE"
  | "PROTOCOL_HEADERS_TOO_LARGE"
  | "PROTOCOL_VERSION_UNSUPPORTED"
  | "PROTOCOL_KEY_UNKNOWN"
  | "PROTOCOL_KEYRING_INVALID"
  | "PROTOCOL_POLICY_INVALID"
  | "PROTOCOL_BODY_MALFORMED"
  | "PROTOCOL_BODY_DUPLICATE_MEMBER"
  | "PROTOCOL_BODY_TOO_LARGE"
  | "PROTOCOL_BODY_TAMPERED"
  | "PROTOCOL_UNICODE_INVALID"
  | "PROTOCOL_METHOD_INVALID"
  | "PROTOCOL_PATH_INVALID"
  | "PROTOCOL_METHOD_MISMATCH"
  | "PROTOCOL_PATH_MISMATCH"
  | "PROTOCOL_AUDIENCE_MISMATCH"
  | "PROTOCOL_ISSUED_AT_FUTURE"
  | "PROTOCOL_EXPIRED"
  | "PROTOCOL_TTL_TOO_LONG"
  | "PROTOCOL_BODY_HASH_INVALID"
  | "PROTOCOL_SIGNATURE_INVALID";

export class RemoteEngineProtocolError extends Error {
  readonly code: RemoteEngineProtocolErrorCode;

  constructor(code: RemoteEngineProtocolErrorCode) {
    super(code);
    this.name = "RemoteEngineProtocolError";
    this.code = code;
  }
}

export type RemoteEngineSignedRequest = {
  body: string;
  headers: Record<string, string>;
  canonicalRequest: string;
};

export type VerifiedRemoteEngineRequest = {
  version: typeof REMOTE_ENGINE_PROTOCOL_VERSION;
  keyId: string;
  keySlot: "current" | "next";
  requestId: string;
  userId: string;
  organizationId: string;
  siteId: string;
  issuedAt: string;
  expiresAt: string;
  audience: string;
  nonce: string;
  bodyHash: string;
  request: RemoteEngineRequestV1;
};

export type RemoteEngineRawHeader = readonly [name: string, value: string];
export type RemoteEngineHeaderRecord = Readonly<
  Record<string, string | readonly string[] | undefined>
>;
export type RemoteEngineHeaderInput =
  | Headers
  | RemoteEngineHeaderRecord
  | readonly RemoteEngineRawHeader[];

function fail(code: RemoteEngineProtocolErrorCode): never {
  throw new RemoteEngineProtocolError(code);
}

function isWellFormedUnicode(value: string): boolean {
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    if (code >= 0xd800 && code <= 0xdbff) {
      if (index + 1 >= value.length) return false;
      const next = value.charCodeAt(index + 1);
      if (next < 0xdc00 || next > 0xdfff) return false;
      index += 1;
    } else if (code >= 0xdc00 && code <= 0xdfff) {
      return false;
    }
  }
  return true;
}

function assertWellFormedUnicode(value: string): void {
  if (!isWellFormedUnicode(value)) fail("PROTOCOL_UNICODE_INVALID");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function assertRequestUnicode(value: unknown): void {
  if (!isRecord(value)) return;
  for (const field of [
    "requestId",
    "userId",
    "organizationId",
    "siteId",
    "issuedAt",
    "expiresAt",
    "prompt",
    "audience",
  ]) {
    const fieldValue = value[field];
    if (typeof fieldValue === "string") assertWellFormedUnicode(fieldValue);
  }
  const intents = value.allowedToolIntents;
  if (Array.isArray(intents)) {
    for (const intent of intents) {
      if (typeof intent === "string") assertWellFormedUnicode(intent);
    }
  }
}

function isBoundedString(value: unknown, maxLength: number, pattern?: RegExp): value is string {
  return typeof value === "string"
    && value.length > 0
    && value.length <= maxLength
    && (!pattern || pattern.test(value));
}

function isCanonicalIsoTimestamp(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) && new Date(timestamp).toISOString() === value;
}

function validateRequest(value: unknown): RemoteEngineRequestV1 {
  if (!isRecord(value)) fail("PROTOCOL_BODY_MALFORMED");
  const keys = Object.keys(value).sort();
  const expectedKeys = [...REQUEST_KEYS].sort();
  if (keys.length !== expectedKeys.length || keys.some((key, index) => key !== expectedKeys[index])) {
    fail("PROTOCOL_BODY_MALFORMED");
  }
  if (!isBoundedString(value.requestId, MAX_ID_LENGTH, TOKEN)) fail("PROTOCOL_BODY_MALFORMED");
  if (!isBoundedString(value.userId, MAX_ID_LENGTH, TOKEN)) fail("PROTOCOL_BODY_MALFORMED");
  if (!isBoundedString(value.organizationId, MAX_ID_LENGTH, TOKEN)) fail("PROTOCOL_BODY_MALFORMED");
  if (!isBoundedString(value.siteId, MAX_ID_LENGTH, TOKEN)) fail("PROTOCOL_BODY_MALFORMED");
  if (!isCanonicalIsoTimestamp(value.issuedAt)) fail("PROTOCOL_BODY_MALFORMED");
  if (!isCanonicalIsoTimestamp(value.expiresAt)) fail("PROTOCOL_BODY_MALFORMED");
  if (!isBoundedString(value.prompt, MAX_PROMPT_LENGTH)) fail("PROTOCOL_BODY_MALFORMED");
  if (!Array.isArray(value.allowedToolIntents) || value.allowedToolIntents.length > MAX_TOOL_INTENTS) {
    fail("PROTOCOL_BODY_MALFORMED");
  }
  if (value.allowedToolIntents.some((intent) => !isBoundedString(intent, MAX_TOOL_INTENT_LENGTH, TOKEN))) {
    fail("PROTOCOL_BODY_MALFORMED");
  }
  if (new Set(value.allowedToolIntents).size !== value.allowedToolIntents.length) {
    fail("PROTOCOL_BODY_MALFORMED");
  }
  if (!isBoundedString(value.audience, MAX_AUDIENCE_LENGTH, TOKEN)) fail("PROTOCOL_BODY_MALFORMED");
  if (Date.parse(value.expiresAt) <= Date.parse(value.issuedAt)) fail("PROTOCOL_BODY_MALFORMED");

  return {
    requestId: value.requestId,
    userId: value.userId,
    organizationId: value.organizationId,
    siteId: value.siteId,
    issuedAt: value.issuedAt,
    expiresAt: value.expiresAt,
    prompt: value.prompt,
    allowedToolIntents: [...value.allowedToolIntents] as string[],
    audience: value.audience,
  };
}

export function serializeRemoteEngineRequest(request: RemoteEngineRequestV1): string {
  assertRequestUnicode(request);
  const valid = validateRequest(request);
  const serialized = JSON.stringify({
    requestId: valid.requestId,
    userId: valid.userId,
    organizationId: valid.organizationId,
    siteId: valid.siteId,
    issuedAt: valid.issuedAt,
    expiresAt: valid.expiresAt,
    prompt: valid.prompt,
    allowedToolIntents: valid.allowedToolIntents,
    audience: valid.audience,
  });
  assertBodySize(serialized);
  return serialized;
}

function assertBodySize(body: string): void {
  assertWellFormedUnicode(body);
  if (Buffer.byteLength(body, "utf8") > REMOTE_ENGINE_MAX_BODY_BYTES) {
    fail("PROTOCOL_BODY_TOO_LARGE");
  }
}

function validateMethod(method: string): string {
  if (typeof method !== "string" || !CANONICAL_METHOD.test(method)) {
    fail("PROTOCOL_METHOD_INVALID");
  }
  return method;
}

function validatePath(path: string): string {
  if (typeof path !== "string"
    || path.length === 0
    || path.length > MAX_PATH_LENGTH
    || path.normalize("NFC") !== path
    || !path.startsWith("/")) {
    fail("PROTOCOL_PATH_INVALID");
  }
  if (path === "/") return path;
  const segments = path.slice(1).split("/");
  if (segments.some((segment) => segment.length === 0
    || segment === "."
    || segment === ".."
    || !CANONICAL_PATH_SEGMENT.test(segment))) {
    fail("PROTOCOL_PATH_INVALID");
  }
  return path;
}

function validateKey(key: RemoteEngineSigningKey): void {
  if (!isBoundedString(key.keyId, MAX_ID_LENGTH, TOKEN)) fail("PROTOCOL_HEADER_MALFORMED");
  if (typeof key.secret === "string") assertWellFormedUnicode(key.secret);
  const secretLength = typeof key.secret === "string"
    ? Buffer.byteLength(key.secret, "utf8")
    : key.secret.byteLength;
  if (secretLength < 32) fail("PROTOCOL_HEADER_MALFORMED");
}

function bodySha256(body: string): string {
  return createHash("sha256").update(body, "utf8").digest("hex");
}

function canonicalRequest(input: {
  version: string;
  method: string;
  path: string;
  keyId: string;
  timestamp: string;
  nonce: string;
  audience: string;
  bodyHash: string;
}): string {
  return [
    input.version,
    input.method,
    input.path,
    input.keyId,
    input.timestamp,
    input.nonce,
    input.audience,
    input.bodyHash,
  ].join("\n");
}

function signature(secret: string | Uint8Array, canonical: string): string {
  return createHmac("sha256", secret).update(canonical, "utf8").digest("hex");
}

export function signRemoteEngineRequest(input: {
  method: string;
  path: string;
  body: RemoteEngineRequestV1;
  key: RemoteEngineSigningKey;
  nonce: string;
}): RemoteEngineSignedRequest {
  const method = validateMethod(input.method);
  const path = validatePath(input.path);
  validateKey(input.key);
  if (!isBoundedString(input.nonce, MAX_NONCE_LENGTH, TOKEN)) fail("PROTOCOL_HEADER_MALFORMED");
  const body = serializeRemoteEngineRequest(input.body);
  const bodyHash = bodySha256(body);
  const canonical = canonicalRequest({
    version: REMOTE_ENGINE_PROTOCOL_VERSION,
    method,
    path,
    keyId: input.key.keyId,
    timestamp: input.body.issuedAt,
    nonce: input.nonce,
    audience: input.body.audience,
    bodyHash,
  });
  return {
    body,
    canonicalRequest: canonical,
    headers: {
      [HEADER_NAMES.version]: REMOTE_ENGINE_PROTOCOL_VERSION,
      [HEADER_NAMES.method]: method,
      [HEADER_NAMES.path]: path,
      [HEADER_NAMES.keyId]: input.key.keyId,
      [HEADER_NAMES.timestamp]: input.body.issuedAt,
      [HEADER_NAMES.nonce]: input.nonce,
      [HEADER_NAMES.audience]: input.body.audience,
      [HEADER_NAMES.bodyHash]: bodyHash,
      [HEADER_NAMES.signature]: signature(input.key.secret, canonical),
    },
  };
}

function isRawHeaderList(
  headers: RemoteEngineHeaderInput,
): headers is readonly RemoteEngineRawHeader[] {
  return Array.isArray(headers);
}

function collectHeaders(headers: RemoteEngineHeaderInput): ReadonlyMap<string, string> {
  const collected = new Map<string, string>();
  let headerEntries = 0;
  let headerBytes = 0;
  let duplicateProtocolHeader = false;

  const collect = (
    name: string,
    value: string,
    coalesced: boolean,
    maxEntries: number,
  ): void => {
    headerEntries += 1;
    headerBytes += Buffer.byteLength(name, "utf8") + Buffer.byteLength(value, "utf8");
    if (headerEntries > maxEntries || headerBytes > REMOTE_ENGINE_MAX_HEADER_BYTES) {
      fail("PROTOCOL_HEADERS_TOO_LARGE");
    }
    const normalizedName = name.toLowerCase();
    if (!PROTOCOL_HEADER_NAMES.has(normalizedName)) return;
    if (collected.has(normalizedName) || (coalesced && value.includes(","))) {
      duplicateProtocolHeader = true;
      return;
    }
    collected.set(normalizedName, value);
  };

  if (typeof Headers !== "undefined" && headers instanceof Headers) {
    for (const [name, value] of headers.entries()) {
      collect(name, value, true, REMOTE_ENGINE_MAX_NORMALIZED_HEADER_ENTRIES);
    }
  } else if (isRawHeaderList(headers)) {
    if (headers.length > REMOTE_ENGINE_MAX_RAW_HEADER_LINES) {
      fail("PROTOCOL_HEADERS_TOO_LARGE");
    }
    for (const header of headers) {
      if (!Array.isArray(header)
        || header.length !== 2
        || typeof header[0] !== "string"
        || typeof header[1] !== "string") {
        fail("PROTOCOL_HEADER_MALFORMED");
      }
      collect(header[0], header[1], false, REMOTE_ENGINE_MAX_RAW_HEADER_LINES);
    }
  } else {
    const entries = Object.entries(headers);
    for (const [name, rawValue] of entries) {
      if (typeof rawValue === "undefined") continue;
      if (Array.isArray(rawValue)) {
        if (rawValue.length === 0) {
          collect(name, "", false, REMOTE_ENGINE_MAX_NORMALIZED_HEADER_ENTRIES);
        }
        for (const value of rawValue) {
          if (typeof value !== "string") fail("PROTOCOL_HEADER_MALFORMED");
          collect(name, value, false, REMOTE_ENGINE_MAX_NORMALIZED_HEADER_ENTRIES);
        }
      } else if (typeof rawValue === "string") {
        collect(name, rawValue, false, REMOTE_ENGINE_MAX_NORMALIZED_HEADER_ENTRIES);
      } else {
        fail("PROTOCOL_HEADER_MALFORMED");
      }
    }
  }
  if (duplicateProtocolHeader) fail("PROTOCOL_HEADER_DUPLICATE");
  return collected;
}

function readHeader(headers: ReadonlyMap<string, string>, name: string): string {
  const raw = headers.get(name);
  if (typeof raw === "undefined") fail("PROTOCOL_HEADER_MISSING");
  if (raw.length === 0) fail("PROTOCOL_HEADER_MALFORMED");
  return raw;
}

function assertNoDuplicateJsonMembers(body: string): void {
  let index = 0;

  const malformed = (): never => fail("PROTOCOL_BODY_MALFORMED");
  const skipWhitespace = (): void => {
    while (index < body.length && /[\t\n\r ]/.test(body[index])) index += 1;
  };
  const parseString = (): string => {
    if (body[index] !== '"') return malformed();
    const start = index;
    index += 1;
    while (index < body.length) {
      const code = body.charCodeAt(index);
      if (code === 0x22) {
        index += 1;
        try {
          const parsed = JSON.parse(body.slice(start, index)) as unknown;
          return typeof parsed === "string" ? parsed : malformed();
        } catch {
          return malformed();
        }
      }
      if (code === 0x5c) {
        index += 1;
        const escape = body[index];
        if (typeof escape === "undefined") return malformed();
        if (escape === "u") {
          if (!/^[a-fA-F0-9]{4}$/.test(body.slice(index + 1, index + 5))) return malformed();
          index += 5;
        } else if ('"\\/bfnrt'.includes(escape)) {
          index += 1;
        } else {
          return malformed();
        }
      } else {
        if (code <= 0x1f) return malformed();
        index += 1;
      }
    }
    return malformed();
  };
  const parseValue = (depth: number): void => {
    if (depth > MAX_JSON_DEPTH) return malformed();
    skipWhitespace();
    const token = body[index];
    if (token === "{") {
      index += 1;
      skipWhitespace();
      const keys = new Set<string>();
      if (body[index] === "}") {
        index += 1;
        return;
      }
      while (index < body.length) {
        const key = parseString();
        if (keys.has(key)) fail("PROTOCOL_BODY_DUPLICATE_MEMBER");
        keys.add(key);
        skipWhitespace();
        if (body[index] !== ":") return malformed();
        index += 1;
        parseValue(depth + 1);
        skipWhitespace();
        if (body[index] === "}") {
          index += 1;
          return;
        }
        if (body[index] !== ",") return malformed();
        index += 1;
        skipWhitespace();
      }
      return malformed();
    }
    if (token === "[") {
      index += 1;
      skipWhitespace();
      if (body[index] === "]") {
        index += 1;
        return;
      }
      while (index < body.length) {
        parseValue(depth + 1);
        skipWhitespace();
        if (body[index] === "]") {
          index += 1;
          return;
        }
        if (body[index] !== ",") return malformed();
        index += 1;
      }
      return malformed();
    }
    if (token === '"') {
      parseString();
      return;
    }
    for (const literal of ["true", "false", "null"]) {
      if (body.startsWith(literal, index)) {
        index += literal.length;
        return;
      }
    }
    const number = /^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/.exec(body.slice(index));
    if (!number) return malformed();
    index += number[0].length;
  };

  parseValue(0);
  skipWhitespace();
  if (index !== body.length) malformed();
}

function parseBody(body: string): RemoteEngineRequestV1 {
  assertNoDuplicateJsonMembers(body);
  try {
    const parsed = JSON.parse(body) as unknown;
    assertRequestUnicode(parsed);
    return validateRequest(parsed);
  } catch (error) {
    if (error instanceof RemoteEngineProtocolError) throw error;
    return fail("PROTOCOL_BODY_MALFORMED");
  }
}

function selectKey(keyring: RemoteEngineKeyring, keyId: string): {
  key: RemoteEngineSigningKey;
  keySlot: "current" | "next";
} {
  validateKey(keyring.current);
  if (keyring.next) validateKey(keyring.next);
  if (keyring.next?.keyId === keyring.current.keyId) fail("PROTOCOL_KEYRING_INVALID");
  if (keyring.current.keyId === keyId) return { key: keyring.current, keySlot: "current" };
  if (keyring.next?.keyId === keyId) return { key: keyring.next, keySlot: "next" };
  return fail("PROTOCOL_KEY_UNKNOWN");
}

function validatePolicyValue(value: number, hardMaximum: number): number {
  if (!Number.isSafeInteger(value) || value <= 0 || value > hardMaximum) {
    fail("PROTOCOL_POLICY_INVALID");
  }
  return value;
}

function resolvePolicyValue(value: unknown, hardMaximum: number): number {
  if (typeof value === "undefined") return hardMaximum;
  if (typeof value !== "number") fail("PROTOCOL_POLICY_INVALID");
  return validatePolicyValue(value, hardMaximum);
}

export function verifyRemoteEngineRequest(input: {
  method: string;
  path: string;
  body: string;
  headers: RemoteEngineHeaderInput;
  expectedAudience: string;
  keyring: RemoteEngineKeyring;
  now?: Date;
  maxTtlMs?: number;
  maxFutureSkewMs?: number;
}): VerifiedRemoteEngineRequest {
  assertBodySize(input.body);
  const headers = collectHeaders(input.headers);
  const nowMs = (input.now ?? new Date()).getTime();
  if (!Number.isFinite(nowMs)) fail("PROTOCOL_POLICY_INVALID");
  const maxFutureSkewMs = resolvePolicyValue(
    input.maxFutureSkewMs,
    REMOTE_ENGINE_MAX_FUTURE_SKEW_MS,
  );
  const maxTtlMs = resolvePolicyValue(
    input.maxTtlMs,
    REMOTE_ENGINE_MAX_TTL_MS,
  );

  const version = readHeader(headers, HEADER_NAMES.version);
  const signedMethod = validateMethod(readHeader(headers, HEADER_NAMES.method));
  const signedPath = validatePath(readHeader(headers, HEADER_NAMES.path));
  const keyId = readHeader(headers, HEADER_NAMES.keyId);
  const timestamp = readHeader(headers, HEADER_NAMES.timestamp);
  const nonce = readHeader(headers, HEADER_NAMES.nonce);
  const audience = readHeader(headers, HEADER_NAMES.audience);
  const claimedBodyHash = readHeader(headers, HEADER_NAMES.bodyHash);
  const claimedSignature = readHeader(headers, HEADER_NAMES.signature);

  if (version !== REMOTE_ENGINE_PROTOCOL_VERSION) fail("PROTOCOL_VERSION_UNSUPPORTED");
  if (!isBoundedString(keyId, MAX_ID_LENGTH, TOKEN)) fail("PROTOCOL_HEADER_MALFORMED");
  if (!isCanonicalIsoTimestamp(timestamp)) fail("PROTOCOL_HEADER_MALFORMED");
  if (!isBoundedString(nonce, MAX_NONCE_LENGTH, TOKEN)) fail("PROTOCOL_HEADER_MALFORMED");
  if (!isBoundedString(audience, MAX_AUDIENCE_LENGTH, TOKEN)) fail("PROTOCOL_HEADER_MALFORMED");
  if (!SHA256_HEX.test(claimedBodyHash)) fail("PROTOCOL_BODY_HASH_INVALID");
  if (!SHA256_HEX.test(claimedSignature)) fail("PROTOCOL_SIGNATURE_INVALID");

  const method = validateMethod(input.method);
  const path = validatePath(input.path);
  if (signedMethod !== method) fail("PROTOCOL_METHOD_MISMATCH");
  if (signedPath !== path) fail("PROTOCOL_PATH_MISMATCH");
  if (audience !== input.expectedAudience) fail("PROTOCOL_AUDIENCE_MISMATCH");
  if (bodySha256(input.body) !== claimedBodyHash) fail("PROTOCOL_BODY_TAMPERED");

  const selected = selectKey(input.keyring, keyId);
  const canonical = canonicalRequest({
    version,
    method: signedMethod,
    path: signedPath,
    keyId,
    timestamp,
    nonce,
    audience,
    bodyHash: claimedBodyHash,
  });
  const expectedSignature = Buffer.from(signature(selected.key.secret, canonical), "hex");
  const actualSignature = Buffer.from(claimedSignature, "hex");
  if (!timingSafeEqual(actualSignature, expectedSignature)) fail("PROTOCOL_SIGNATURE_INVALID");

  const request = parseBody(input.body);
  if (request.audience !== audience) fail("PROTOCOL_AUDIENCE_MISMATCH");
  if (request.issuedAt !== timestamp) fail("PROTOCOL_HEADER_MALFORMED");

  const issuedAtMs = Date.parse(request.issuedAt);
  const expiresAtMs = Date.parse(request.expiresAt);
  if (issuedAtMs > nowMs + maxFutureSkewMs) fail("PROTOCOL_ISSUED_AT_FUTURE");
  if (expiresAtMs <= nowMs) fail("PROTOCOL_EXPIRED");
  if (expiresAtMs - issuedAtMs > maxTtlMs) fail("PROTOCOL_TTL_TOO_LONG");

  // Phase 1 deliberately has no replay cache. Consumers must atomically claim this nonce
  // in a durable shared store before dispatching any remote work.
  return {
    version: REMOTE_ENGINE_PROTOCOL_VERSION,
    keyId,
    keySlot: selected.keySlot,
    requestId: request.requestId,
    userId: request.userId,
    organizationId: request.organizationId,
    siteId: request.siteId,
    issuedAt: request.issuedAt,
    expiresAt: request.expiresAt,
    audience: request.audience,
    nonce,
    bodyHash: claimedBodyHash,
    request,
  };
}
