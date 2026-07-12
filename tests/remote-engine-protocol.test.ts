import { createHash } from "node:crypto";

import { describe, expect, it } from "vitest";

import {
  RemoteEngineProtocolError,
  serializeRemoteEngineRequest,
  signRemoteEngineRequest,
  verifyRemoteEngineRequest,
  type RemoteEngineKeyring,
  type RemoteEngineRequestV1,
} from "@/lib/remote-engine-protocol";

const currentKey = { keyId: "safeclaw-current", secret: "c".repeat(32) };
const nextKey = { keyId: "safeclaw-next", secret: "n".repeat(32) };
const keyring: RemoteEngineKeyring = { current: currentKey, next: nextKey };
const issuedAt = "2026-07-12T03:00:00.000Z";
const expiresAt = "2026-07-12T03:05:00.000Z";
const now = new Date("2026-07-12T03:01:00.000Z");

function request(overrides: Partial<RemoteEngineRequestV1> = {}): RemoteEngineRequestV1 {
  return {
    requestId: "req-001",
    userId: "user-001",
    organizationId: "org-001",
    siteId: "site-001",
    issuedAt,
    expiresAt,
    prompt: "Inspect the confined-space permit.",
    allowedToolIntents: ["read:safety-context", "draft:workpack"],
    audience: "openclaw-sidecar",
    ...overrides,
  };
}

function signed(
  body: RemoteEngineRequestV1 = request(),
  overrides: Partial<Parameters<typeof signRemoteEngineRequest>[0]> = {},
) {
  return signRemoteEngineRequest({
    method: "POST",
    path: "/v1/engine/run",
    body,
    key: currentKey,
    nonce: "nonce-001",
    ...overrides,
  });
}

function verify(
  input: ReturnType<typeof signed> = signed(),
  overrides: Partial<Parameters<typeof verifyRemoteEngineRequest>[0]> = {},
) {
  return verifyRemoteEngineRequest({
    method: "POST",
    path: "/v1/engine/run",
    body: input.body,
    headers: input.headers,
    expectedAudience: "openclaw-sidecar",
    keyring,
    now,
    ...overrides,
  });
}

function expectCode(run: () => unknown, code: RemoteEngineProtocolError["code"]): void {
  expect(run).toThrowError(RemoteEngineProtocolError);
  try {
    run();
  } catch (error) {
    expect(error).toMatchObject({ code });
  }
}

describe("remote engine signed protocol v1", () => {
  it("serializes the typed request in a stable explicit field order", () => {
    const value = request();
    expect(serializeRemoteEngineRequest(value)).toBe(
      '{"requestId":"req-001","userId":"user-001","organizationId":"org-001","siteId":"site-001","issuedAt":"2026-07-12T03:00:00.000Z","expiresAt":"2026-07-12T03:05:00.000Z","prompt":"Inspect the confined-space permit.","allowedToolIntents":["read:safety-context","draft:workpack"],"audience":"openclaw-sidecar"}',
    );
    expect(serializeRemoteEngineRequest({ ...value })).toBe(serializeRemoteEngineRequest(value));
  });

  it("signs the deterministic canonical request including the SHA-256 body hash", () => {
    const result = signed();
    const bodyHash = createHash("sha256").update(result.body, "utf8").digest("hex");

    expect(result.headers).toMatchObject({
      "x-safeclaw-protocol-version": "v1",
      "x-safeclaw-method": "POST",
      "x-safeclaw-path": "/v1/engine/run",
      "x-safeclaw-key-id": currentKey.keyId,
      "x-safeclaw-timestamp": issuedAt,
      "x-safeclaw-nonce": "nonce-001",
      "x-safeclaw-audience": "openclaw-sidecar",
      "x-safeclaw-body-sha256": bodyHash,
    });
    expect(result.canonicalRequest).toBe([
      "v1", "POST", "/v1/engine/run", currentKey.keyId, issuedAt,
      "nonce-001", "openclaw-sidecar", bodyHash,
    ].join("\n"));
    expect(result.headers["x-safeclaw-signature"]).toMatch(/^[a-f0-9]{64}$/);
  });

  it.each([
    ["current", currentKey],
    ["next", nextKey],
  ] as const)("verifies a valid %s rotation key and returns bound metadata", (keySlot, key) => {
    const input = signed(request(), { key });
    expect(verify(input)).toEqual({
      version: "v1",
      keyId: key.keyId,
      keySlot,
      requestId: "req-001",
      userId: "user-001",
      organizationId: "org-001",
      siteId: "site-001",
      issuedAt,
      expiresAt,
      audience: "openclaw-sidecar",
      nonce: "nonce-001",
      bodyHash: input.headers["x-safeclaw-body-sha256"],
      request: request(),
    });
  });

  it.each([
    ["x-safeclaw-key-id", "PROTOCOL_HEADER_MISSING"],
    ["x-safeclaw-nonce", "PROTOCOL_HEADER_MISSING"],
    ["x-safeclaw-signature", "PROTOCOL_HEADER_MISSING"],
  ] as const)("fails closed when %s is missing", (header, code) => {
    const input = signed();
    const headers = { ...input.headers };
    delete headers[header];
    expectCode(() => verify(input, { headers }), code);
  });

  it.each([
    ["x-safeclaw-nonce", "contains spaces", "PROTOCOL_HEADER_MALFORMED"],
    ["x-safeclaw-body-sha256", "xyz", "PROTOCOL_BODY_HASH_INVALID"],
    ["x-safeclaw-signature", "xyz", "PROTOCOL_SIGNATURE_INVALID"],
  ] as const)("rejects malformed %s", (header, value, code) => {
    const input = signed();
    expectCode(() => verify(input, { headers: { ...input.headers, [header]: value } }), code);
  });

  it("rejects unknown key ids before accepting a signature", () => {
    const input = signed(request(), { key: { keyId: "retired", secret: "r".repeat(32) } });
    expectCode(() => verify(input), "PROTOCOL_KEY_UNKNOWN");
  });

  it("rejects body tampering and bad signatures with distinct stable codes", () => {
    const input = signed();
    expectCode(
      () => verify(input, { body: input.body.replace("permit", "credential") }),
      "PROTOCOL_BODY_TAMPERED",
    );
    expectCode(
      () => verify(input, {
        headers: { ...input.headers, "x-safeclaw-signature": "0".repeat(64) },
      }),
      "PROTOCOL_SIGNATURE_INVALID",
    );
  });

  it.each([
    ["method", "GET", "PROTOCOL_METHOD_MISMATCH"],
    ["path", "/v1/engine/status", "PROTOCOL_PATH_MISMATCH"],
    ["expectedAudience", "another-sidecar", "PROTOCOL_AUDIENCE_MISMATCH"],
  ] as const)("rejects %s mismatch", (field, value, code) => {
    expectCode(() => verify(signed(), { [field]: value }), code);
  });

  it.each([
    [
      request({ issuedAt: "2026-07-12T03:02:00.001Z", expiresAt: "2026-07-12T03:04:00.000Z" }),
      "PROTOCOL_ISSUED_AT_FUTURE",
    ],
    [request({ expiresAt: "2026-07-12T03:00:59.999Z" }), "PROTOCOL_EXPIRED"],
    [request({ expiresAt: "2026-07-12T03:05:00.001Z" }), "PROTOCOL_TTL_TOO_LONG"],
  ] as const)("enforces request time bounds", (body, code) => {
    expectCode(() => verify(signed(body)), code);
  });

  it("rejects malformed, oversized, credential-bearing, and duplicate intents", () => {
    expectCode(
      () => signed(request({ prompt: "x".repeat(12_001) })),
      "PROTOCOL_BODY_MALFORMED",
    );
    expectCode(
      () => signed(request({ allowedToolIntents: Array.from({ length: 33 }, (_, i) => `read:${i}`) })),
      "PROTOCOL_BODY_MALFORMED",
    );
    expectCode(
      () => signed(request({ allowedToolIntents: ["read:context", "read:context"] })),
      "PROTOCOL_BODY_MALFORMED",
    );
    const credentialBody = JSON.stringify({ ...request(), bearerToken: "secret" });
    const input = signed();
    expectCode(() => verify(input, { body: credentialBody }), "PROTOCOL_BODY_TAMPERED");
  });

  it("does not implement replay state and returns the nonce for a durable atomic store", () => {
    const input = signed();
    expect(verify(input).nonce).toBe("nonce-001");
    expect(verify(input).nonce).toBe("nonce-001");
  });
});
