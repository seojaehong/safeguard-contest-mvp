import { createHash, createHmac, timingSafeEqual } from "node:crypto";

export const REMOTE_ENGINE_PROTOCOL_VERSION = "v1" as const;
export const REMOTE_ENGINE_MAX_TTL_MS = 5 * 60 * 1_000;
export const REMOTE_ENGINE_MAX_FUTURE_SKEW_MS = 60 * 1_000;

const MAX_ID_LENGTH = 128;
const MAX_AUDIENCE_LENGTH = 256;
const MAX_NONCE_LENGTH = 128;
const MAX_PATH_LENGTH = 2_048;
const MAX_PROMPT_LENGTH = 12_000;
const MAX_TOOL_INTENTS = 32;
const MAX_TOOL_INTENT_LENGTH = 128;
const SHA256_HEX = /^[a-f0-9]{64}$/;
const TOKEN = /^[A-Za-z0-9][A-Za-z0-9._:/-]*$/;
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
  | "PROTOCOL_VERSION_UNSUPPORTED"
  | "PROTOCOL_KEY_UNKNOWN"
  | "PROTOCOL_BODY_MALFORMED"
  | "PROTOCOL_BODY_TAMPERED"
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

type HeaderInput = Headers | Readonly<Record<string, string | readonly string[] | undefined>>;

function fail(code: RemoteEngineProtocolErrorCode): never {
  throw new RemoteEngineProtocolError(code);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
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
  const valid = validateRequest(request);
  return JSON.stringify({
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
}

function normalizeMethod(method: string): string {
  const normalized = method.toUpperCase();
  if (!/^[A-Z]{1,16}$/.test(normalized)) fail("PROTOCOL_HEADER_MALFORMED");
  return normalized;
}

function validatePath(path: string): string {
  if (!isBoundedString(path, MAX_PATH_LENGTH) || !path.startsWith("/") || /[\r\n]/.test(path)) {
    fail("PROTOCOL_HEADER_MALFORMED");
  }
  return path;
}

function validateKey(key: RemoteEngineSigningKey): void {
  if (!isBoundedString(key.keyId, MAX_ID_LENGTH, TOKEN)) fail("PROTOCOL_HEADER_MALFORMED");
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
  const method = normalizeMethod(input.method);
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

function readHeader(headers: HeaderInput, name: string): string {
  const raw = headers instanceof Headers
    ? headers.get(name) ?? undefined
    : Object.entries(headers).find(([key]) => key.toLowerCase() === name)?.[1];
  if (typeof raw === "undefined") fail("PROTOCOL_HEADER_MISSING");
  if (Array.isArray(raw) || typeof raw !== "string" || raw.length === 0) {
    fail("PROTOCOL_HEADER_MALFORMED");
  }
  return raw;
}

function parseBody(body: string): RemoteEngineRequestV1 {
  try {
    return validateRequest(JSON.parse(body) as unknown);
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
  if (keyring.current.keyId === keyId) return { key: keyring.current, keySlot: "current" };
  if (keyring.next?.keyId === keyId) return { key: keyring.next, keySlot: "next" };
  return fail("PROTOCOL_KEY_UNKNOWN");
}

export function verifyRemoteEngineRequest(input: {
  method: string;
  path: string;
  body: string;
  headers: HeaderInput;
  expectedAudience: string;
  keyring: RemoteEngineKeyring;
  now?: Date;
  maxTtlMs?: number;
  maxFutureSkewMs?: number;
}): VerifiedRemoteEngineRequest {
  const version = readHeader(input.headers, HEADER_NAMES.version);
  const signedMethod = readHeader(input.headers, HEADER_NAMES.method);
  const signedPath = readHeader(input.headers, HEADER_NAMES.path);
  const keyId = readHeader(input.headers, HEADER_NAMES.keyId);
  const timestamp = readHeader(input.headers, HEADER_NAMES.timestamp);
  const nonce = readHeader(input.headers, HEADER_NAMES.nonce);
  const audience = readHeader(input.headers, HEADER_NAMES.audience);
  const claimedBodyHash = readHeader(input.headers, HEADER_NAMES.bodyHash);
  const claimedSignature = readHeader(input.headers, HEADER_NAMES.signature);

  if (version !== REMOTE_ENGINE_PROTOCOL_VERSION) fail("PROTOCOL_VERSION_UNSUPPORTED");
  if (!isBoundedString(keyId, MAX_ID_LENGTH, TOKEN)) fail("PROTOCOL_HEADER_MALFORMED");
  if (!isCanonicalIsoTimestamp(timestamp)) fail("PROTOCOL_HEADER_MALFORMED");
  if (!isBoundedString(nonce, MAX_NONCE_LENGTH, TOKEN)) fail("PROTOCOL_HEADER_MALFORMED");
  if (!isBoundedString(audience, MAX_AUDIENCE_LENGTH, TOKEN)) fail("PROTOCOL_HEADER_MALFORMED");
  if (!SHA256_HEX.test(claimedBodyHash)) fail("PROTOCOL_BODY_HASH_INVALID");
  if (!SHA256_HEX.test(claimedSignature)) fail("PROTOCOL_SIGNATURE_INVALID");

  const method = normalizeMethod(input.method);
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

  const nowMs = (input.now ?? new Date()).getTime();
  const issuedAtMs = Date.parse(request.issuedAt);
  const expiresAtMs = Date.parse(request.expiresAt);
  const maxFutureSkewMs = input.maxFutureSkewMs ?? REMOTE_ENGINE_MAX_FUTURE_SKEW_MS;
  const maxTtlMs = input.maxTtlMs ?? REMOTE_ENGINE_MAX_TTL_MS;
  if (!Number.isFinite(nowMs) || maxFutureSkewMs < 0 || maxTtlMs <= 0) {
    fail("PROTOCOL_HEADER_MALFORMED");
  }
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
