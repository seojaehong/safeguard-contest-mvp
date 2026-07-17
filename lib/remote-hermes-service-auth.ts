import { createHmac, timingSafeEqual } from "node:crypto";

export const REMOTE_HERMES_SERVICE_AUTH_VERSION = "remote-hermes-service-auth/v1" as const;

const HMAC_DOMAIN = "safeclaw-remote-hermes-service-auth/v1";
const OPAQUE_ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/u;
const SHA256_HEX = /^[a-f0-9]{64}$/u;
const CLAIM_KEYS = [
  "version",
  "issuer",
  "audience",
  "organizationId",
  "siteId",
  "runId",
  "requestId",
  "attemptId",
  "attemptEnvelopeDigest",
  "issuedAt",
  "expiresAt",
] as const;

export type RemoteHermesServiceAuthErrorCode =
  | "SERVICE_AUTH_KEYRING_INVALID"
  | "SERVICE_AUTH_KEY_UNKNOWN"
  | "SERVICE_AUTH_KEY_RETIRED"
  | "SERVICE_AUTH_KEY_NOT_ACTIVE"
  | "SERVICE_AUTH_KEY_EXPIRED"
  | "SERVICE_AUTH_ASSERTION_NOT_ACTIVE"
  | "SERVICE_AUTH_ASSERTION_EXPIRED"
  | "SERVICE_AUTH_ASSERTION_INVALID"
  | "SERVICE_AUTH_BINDING_MISMATCH"
  | "SERVICE_AUTH_KEY_INVALID"
  | "SERVICE_AUTH_SIGNATURE_INVALID";

export class RemoteHermesServiceAuthError extends Error {
  readonly code: RemoteHermesServiceAuthErrorCode;

  constructor(code: RemoteHermesServiceAuthErrorCode) {
    super(code);
    this.name = "RemoteHermesServiceAuthError";
    this.code = code;
  }
}

export type RemoteHermesServiceAuthClaims = Readonly<{
  version: typeof REMOTE_HERMES_SERVICE_AUTH_VERSION;
  issuer: string;
  audience: string;
  organizationId: string;
  siteId: string;
  runId: string;
  requestId: string;
  attemptId: string;
  attemptEnvelopeDigest: string;
  issuedAt: string;
  expiresAt: string;
}>;

export type RemoteHermesServiceAuthKey = Readonly<{
  keyId: string;
  secret: string | Uint8Array;
  notBefore: string;
  notAfter: string;
}>;

export type RemoteHermesServiceAuthVerificationKeyring = Readonly<{
  current: RemoteHermesServiceAuthKey;
  next?: RemoteHermesServiceAuthKey;
  retiredKeyIds?: readonly string[];
}>;

export type RemoteHermesServiceAssertion = Readonly<{
  claims: RemoteHermesServiceAuthClaims;
  keyId: string;
  signature: string;
}>;

export type VerifiedRemoteHermesServiceAssertion = Readonly<{
  claims: RemoteHermesServiceAuthClaims;
  keyId: string;
  keySlot: "current" | "next";
}>;

function fail(code: RemoteHermesServiceAuthErrorCode): never {
  throw new RemoteHermesServiceAuthError(code);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasExactKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
  const actual = Object.keys(value);
  return actual.length === keys.length && actual.every((key) => keys.includes(key));
}

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (isRecord(value)) {
    return `{${Object.keys(value).sort().map((key) => (
      `${JSON.stringify(key)}:${canonicalJson(value[key])}`
    )).join(",")}}`;
  }
  return JSON.stringify(value);
}

function parseCanonicalInstant(value: unknown): number | undefined {
  if (typeof value !== "string") return undefined;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) && new Date(timestamp).toISOString() === value
    ? timestamp
    : undefined;
}

function secretBytes(secret: string | Uint8Array): Uint8Array {
  return typeof secret === "string" ? Buffer.from(secret, "utf8") : secret;
}

function validateKey(key: RemoteHermesServiceAuthKey): { notBeforeMs: number; notAfterMs: number } {
  const notBeforeMs = parseCanonicalInstant(key.notBefore);
  const notAfterMs = parseCanonicalInstant(key.notAfter);
  const bytes = secretBytes(key.secret);
  if (!OPAQUE_ID.test(key.keyId)
    || bytes.byteLength < 32
    || notBeforeMs === undefined
    || notAfterMs === undefined
    || notAfterMs <= notBeforeMs) {
    return fail("SERVICE_AUTH_KEY_INVALID");
  }
  return { notBeforeMs, notAfterMs };
}

function requireActiveKey(key: RemoteHermesServiceAuthKey, now: Date): void {
  const { notBeforeMs, notAfterMs } = validateKey(key);
  const nowMs = now.getTime();
  if (!Number.isFinite(nowMs)) fail("SERVICE_AUTH_KEY_INVALID");
  if (nowMs < notBeforeMs) fail("SERVICE_AUTH_KEY_NOT_ACTIVE");
  if (nowMs >= notAfterMs) fail("SERVICE_AUTH_KEY_EXPIRED");
}

function readClaims(value: unknown): RemoteHermesServiceAuthClaims {
  if (!isRecord(value)
    || !hasExactKeys(value, CLAIM_KEYS)
    || value.version !== REMOTE_HERMES_SERVICE_AUTH_VERSION
    || CLAIM_KEYS.slice(1, 8).some((field) => (
      typeof value[field] !== "string" || !OPAQUE_ID.test(value[field])
    ))
    || typeof value.attemptEnvelopeDigest !== "string"
    || !SHA256_HEX.test(value.attemptEnvelopeDigest)
    || parseCanonicalInstant(value.issuedAt) === undefined
    || parseCanonicalInstant(value.expiresAt) === undefined
    || Date.parse(value.expiresAt as string) <= Date.parse(value.issuedAt as string)) {
    return fail("SERVICE_AUTH_ASSERTION_INVALID");
  }
  return value as RemoteHermesServiceAuthClaims;
}

function assertionPayload(claims: RemoteHermesServiceAuthClaims, keyId: string): string {
  return `${HMAC_DOMAIN}:${canonicalJson({ claims, keyId })}`;
}

function sign(claims: RemoteHermesServiceAuthClaims, key: RemoteHermesServiceAuthKey): string {
  return createHmac("sha256", secretBytes(key.secret))
    .update(assertionPayload(claims, key.keyId), "utf8")
    .digest("hex");
}

function signaturesEqual(actual: string, expected: string): boolean {
  if (!SHA256_HEX.test(actual) || !SHA256_HEX.test(expected)) return false;
  return timingSafeEqual(Buffer.from(actual, "hex"), Buffer.from(expected, "hex"));
}

function selectVerificationKey(
  keyring: RemoteHermesServiceAuthVerificationKeyring,
  keyId: string,
): { key: RemoteHermesServiceAuthKey; keySlot: "current" | "next" } {
  validateKey(keyring.current);
  if (keyring.next) validateKey(keyring.next);
  const retired = keyring.retiredKeyIds ?? [];
  if (retired.some((candidate) => !OPAQUE_ID.test(candidate))
    || new Set(retired).size !== retired.length
    || keyring.next?.keyId === keyring.current.keyId
    || retired.includes(keyring.current.keyId)
    || (keyring.next !== undefined && retired.includes(keyring.next.keyId))) {
    return fail("SERVICE_AUTH_KEYRING_INVALID");
  }
  if (retired.includes(keyId)) fail("SERVICE_AUTH_KEY_RETIRED");
  if (keyring.current.keyId === keyId) return { key: keyring.current, keySlot: "current" };
  if (keyring.next?.keyId === keyId) return { key: keyring.next, keySlot: "next" };
  return fail("SERVICE_AUTH_KEY_UNKNOWN");
}

export function createRemoteHermesServiceAssertion(input: {
  claims: RemoteHermesServiceAuthClaims;
  activeKey: RemoteHermesServiceAuthKey;
  now?: Date;
}): RemoteHermesServiceAssertion {
  const claims = Object.freeze({ ...readClaims(input.claims) });
  const now = input.now ?? new Date();
  requireActiveKey(input.activeKey, now);
  return Object.freeze({
    claims,
    keyId: input.activeKey.keyId,
    signature: sign(claims, input.activeKey),
  });
}

export function verifyRemoteHermesServiceAssertion(input: {
  assertion: unknown;
  expected: RemoteHermesServiceAuthClaims;
  keyring: RemoteHermesServiceAuthVerificationKeyring;
  now?: Date;
}): VerifiedRemoteHermesServiceAssertion {
  if (!isRecord(input.assertion)
    || !hasExactKeys(input.assertion, ["claims", "keyId", "signature"])
    || typeof input.assertion.keyId !== "string"
    || !OPAQUE_ID.test(input.assertion.keyId)
    || typeof input.assertion.signature !== "string") {
    return fail("SERVICE_AUTH_ASSERTION_INVALID");
  }
  const claims = readClaims(input.assertion.claims);
  const expected = readClaims(input.expected);
  const selected = selectVerificationKey(input.keyring, input.assertion.keyId);
  const now = input.now ?? new Date();
  requireActiveKey(selected.key, now);
  const nowMs = now.getTime();
  if (nowMs < Date.parse(claims.issuedAt)) fail("SERVICE_AUTH_ASSERTION_NOT_ACTIVE");
  if (nowMs >= Date.parse(claims.expiresAt)) fail("SERVICE_AUTH_ASSERTION_EXPIRED");
  if (!signaturesEqual(input.assertion.signature, sign(claims, selected.key))) {
    fail("SERVICE_AUTH_SIGNATURE_INVALID");
  }
  if (canonicalJson(claims) !== canonicalJson(expected)) {
    fail("SERVICE_AUTH_BINDING_MISMATCH");
  }
  return Object.freeze({ claims: Object.freeze({ ...claims }), keyId: selected.key.keyId, keySlot: selected.keySlot });
}
