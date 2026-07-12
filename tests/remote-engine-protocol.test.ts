import { createHash, createHmac } from "node:crypto";

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
const maxBodyBytes = 16_384;
const maxHeaderCount = 32;
const maxHeaderBytes = 8_192;

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

function rawSigned(
  body: string,
  overrides: {
    method?: string;
    path?: string;
    key?: typeof currentKey;
    nonce?: string;
    audience?: string;
    timestamp?: string;
  } = {},
) {
  const method = overrides.method ?? "POST";
  const path = overrides.path ?? "/v1/engine/run";
  const key = overrides.key ?? currentKey;
  const nonce = overrides.nonce ?? "nonce-001";
  const audience = overrides.audience ?? "openclaw-sidecar";
  const timestamp = overrides.timestamp ?? issuedAt;
  const bodyHash = createHash("sha256").update(body, "utf8").digest("hex");
  const canonicalRequest = [
    "v1", method, path, key.keyId, timestamp, nonce, audience, bodyHash,
  ].join("\n");
  return {
    body,
    canonicalRequest,
    headers: {
      "x-safeclaw-protocol-version": "v1",
      "x-safeclaw-method": method,
      "x-safeclaw-path": path,
      "x-safeclaw-key-id": key.keyId,
      "x-safeclaw-timestamp": timestamp,
      "x-safeclaw-nonce": nonce,
      "x-safeclaw-audience": audience,
      "x-safeclaw-body-sha256": bodyHash,
      "x-safeclaw-signature": createHmac("sha256", key.secret)
        .update(canonicalRequest, "utf8")
        .digest("hex"),
    },
  };
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
  let thrown: unknown;
  try {
    run();
  } catch (error) {
    thrown = error;
  }
  expect(thrown).toBeInstanceOf(RemoteEngineProtocolError);
  expect(thrown).toMatchObject({ code });
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

  it("matches an independent fixed HMAC-SHA256 known-answer vector", () => {
    const result = signRemoteEngineRequest({
      method: "POST",
      path: "/v1/engine/run",
      body: request({
        requestId: "kat-request",
        userId: "kat-user",
        organizationId: "kat-org",
        siteId: "kat-site",
        prompt: "Known answer",
        allowedToolIntents: ["read:context"],
      }),
      key: { keyId: "kat-key", secret: "0123456789abcdef0123456789abcdef" },
      nonce: "kat-nonce",
    });

    expect(result.headers["x-safeclaw-body-sha256"]).toBe(
      "8bec4442443786d93432f8f891fe2d68b9c3c9df070557eaec37da125f4814ec",
    );
    expect(result.headers["x-safeclaw-signature"]).toBe(
      "c813d308c038bc92b64fc5541d33ec7a85131e763546fddb334d40ee351bd45e",
    );
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

  it.each([
    ["maxFutureSkewMs", Number.NaN],
    ["maxFutureSkewMs", Number.POSITIVE_INFINITY],
    ["maxFutureSkewMs", 0],
    ["maxFutureSkewMs", -1],
    ["maxFutureSkewMs", 60_001],
    ["maxTtlMs", Number.NaN],
    ["maxTtlMs", Number.POSITIVE_INFINITY],
    ["maxTtlMs", 0],
    ["maxTtlMs", -1],
    ["maxTtlMs", 300_001],
  ] as const)("rejects invalid verifier policy %s=%s", (field, value) => {
    expectCode(() => verify(signed(), { [field]: value }), "PROTOCOL_POLICY_INVALID");
  });

  it.each(["maxFutureSkewMs", "maxTtlMs"] as const)(
    "rejects runtime null instead of applying the %s default",
    (field) => {
      const overrides = { [field]: null } as unknown as Partial<
        Parameters<typeof verifyRemoteEngineRequest>[0]
      >;
      expectCode(() => verify(signed(), overrides), "PROTOCOL_POLICY_INVALID");
    },
  );

  it("applies verifier policy defaults only to undefined", () => {
    expect(verify(signed(), {
      maxFutureSkewMs: undefined,
      maxTtlMs: undefined,
    }).requestId).toBe("req-001");
  });

  it("bounds unsigned and correctly signed raw body bytes before protocol work", () => {
    const oversized = `{\"padding\":\"${"x".repeat(maxBodyBytes)}\"}`;
    expect(Buffer.byteLength(oversized, "utf8")).toBeGreaterThan(maxBodyBytes);

    expectCode(
      () => verifyRemoteEngineRequest({
        method: "POST",
        path: "/v1/engine/run",
        body: oversized,
        headers: {},
        expectedAudience: "openclaw-sidecar",
        keyring,
        now,
      }),
      "PROTOCOL_BODY_TOO_LARGE",
    );
    expectCode(() => verify(rawSigned(oversized)), "PROTOCOL_BODY_TOO_LARGE");
  });

  it("bounds serialized UTF-8 body bytes before signing", () => {
    expectCode(
      () => signed(request({ prompt: "한".repeat(6_000) })),
      "PROTOCOL_BODY_TOO_LARGE",
    );
  });

  it("rejects lone surrogates before distinct bodies can share UTF-8 hash and HMAC bytes", () => {
    const canonicalBody = serializeRemoteEngineRequest(request());
    const bodyD800 = canonicalBody.replace("Inspect the confined-space permit.", "\uD800");
    const bodyD801 = canonicalBody.replace("Inspect the confined-space permit.", "\uD801");
    const hash = (body: string): string => createHash("sha256").update(body, "utf8").digest("hex");

    expect(bodyD800).not.toBe(bodyD801);
    expect(hash(bodyD800)).toBe(hash(bodyD801));
    const reusedSignature = rawSigned(bodyD800);
    expectCode(() => verify(reusedSignature), "PROTOCOL_UNICODE_INVALID");
    expectCode(
      () => verify(reusedSignature, { body: bodyD801 }),
      "PROTOCOL_UNICODE_INVALID",
    );
    expectCode(
      () => signed(request({ prompt: "\uD800" })),
      "PROTOCOL_UNICODE_INVALID",
    );

    const paired = signed(request({ prompt: "\uD83D\uDE00" }));
    expect(verify(paired).request.prompt).toBe("😀");
  });

  it("bounds raw header count and aggregate bytes", () => {
    const input = signed();
    const tooMany = { ...input.headers };
    for (let index = 0; index <= maxHeaderCount - Object.keys(input.headers).length; index += 1) {
      tooMany[`x-padding-${index}`] = "x";
    }
    expect(Object.keys(tooMany).length).toBeGreaterThan(maxHeaderCount);
    expectCode(() => verify(input, { headers: tooMany }), "PROTOCOL_HEADERS_TOO_LARGE");

    const tooLarge = { ...input.headers, "x-padding": "x".repeat(maxHeaderBytes) };
    expectCode(() => verify(input, { headers: tooLarge }), "PROTOCOL_HEADERS_TOO_LARGE");
  });

  it("accepts raw header tuples within the pre-fold line limit and rejects excess or duplicates", () => {
    const input = signed();
    const withinLimit: Parameters<typeof verifyRemoteEngineRequest>[0]["headers"] = [
      ...Object.entries(input.headers),
      ...Array.from({ length: 8 }, (_, index): [string, string] => [`x-raw-${index}`, "x"]),
    ];
    expect(verify(input, { headers: withinLimit }).requestId).toBe("req-001");

    const tooMany: Parameters<typeof verifyRemoteEngineRequest>[0]["headers"] = [
      ...Object.entries(input.headers),
      ...Array.from({ length: 24 }, (_, index): [string, string] => [`x-raw-${index}`, "x"]),
    ];
    expectCode(() => verify(input, { headers: tooMany }), "PROTOCOL_HEADERS_TOO_LARGE");

    const duplicate: Parameters<typeof verifyRemoteEngineRequest>[0]["headers"] = [
      ...Object.entries(input.headers),
      ["X-SafeClaw-Key-Id", currentKey.keyId],
    ];
    expectCode(() => verify(input, { headers: duplicate }), "PROTOCOL_HEADER_DUPLICATE");
  });

  it("treats WHATWG Headers count as folded normalized entries, not raw lines", () => {
    const input = signed();
    const folded = new Headers(Object.entries(input.headers));
    for (let index = 0; index < 40; index += 1) folded.append("x-folded", "x");

    expect(Array.from(folded.keys())).toHaveLength(10);
    expect(folded.get("x-folded")?.split(",")).toHaveLength(40);
    expect(verify(input, { headers: folded }).requestId).toBe("req-001");

    const tooManyNormalized = new Headers(Object.entries(input.headers));
    for (let index = 0; index < 24; index += 1) {
      tooManyNormalized.set(`x-normalized-${index}`, "x");
    }
    expectCode(
      () => verify(input, { headers: tooManyNormalized }),
      "PROTOCOL_HEADERS_TOO_LARGE",
    );
  });

  it("collects Record headers once instead of rescanning for every protocol field", () => {
    const input = signed();
    let scans = 0;
    const headers = new Proxy(input.headers, {
      ownKeys(target) {
        scans += 1;
        return Reflect.ownKeys(target);
      },
    });

    expect(verify(input, { headers }).requestId).toBe("req-001");
    expect(scans).toBe(1);
  });

  it.each(["post", "POST ", "ＰＯＳＴ", "POſT"])("rejects non-canonical method %s in signer and verifier", (method) => {
    expectCode(() => signed(request(), { method }), "PROTOCOL_METHOD_INVALID");
    expectCode(() => verify(signed(), { method }), "PROTOCOL_METHOD_INVALID");
  });

  it.each([
    "//v1/engine/run",
    "/v1//engine/run",
    "/v1/./engine/run",
    "/v1/../engine/run",
    "/v1/engine/run?mode=1",
    "/v1/engine/run#fragment",
    "/v1\\engine\\run",
    "/v1/engine/\0run",
    "/v1/engine/%72un",
    "/v1/engine/ru\u0301n",
    "/v1/engine/rún",
  ])("rejects non-canonical path %j in signer and verifier", (path) => {
    expectCode(() => signed(request(), { path }), "PROTOCOL_PATH_INVALID");
    expectCode(() => verify(signed(), { path }), "PROTOCOL_PATH_INVALID");
  });

  it("accepts only the strict shared canonical method and path form", () => {
    const input = signed(request(), { method: "POST", path: "/v1.0/engine-run_1~draft" });
    expect(verify(input, { path: "/v1.0/engine-run_1~draft" }).requestId).toBe("req-001");
  });

  it("rejects case-insensitive duplicate protocol headers from Record and Headers", () => {
    const input = signed();
    const recordHeaders = {
      ...input.headers,
      "X-SafeClaw-Key-Id": currentKey.keyId,
    };
    expectCode(() => verify(input, { headers: recordHeaders }), "PROTOCOL_HEADER_DUPLICATE");

    const webHeaders = new Headers(Object.entries(input.headers));
    webHeaders.append("X-SafeClaw-Key-Id", currentKey.keyId);
    expectCode(() => verify(input, { headers: webHeaders }), "PROTOCOL_HEADER_DUPLICATE");
  });

  it("rejects duplicate JSON members before last-wins interpretation", () => {
    const duplicateBody = serializeRemoteEngineRequest(request()).replace(
      '{"requestId":"req-001"',
      '{"requestId":"req-001","requestId":"req-evil"',
    );
    expectCode(() => verify(rawSigned(duplicateBody)), "PROTOCOL_BODY_DUPLICATE_MEMBER");
  });

  it("rejects a colliding current/next key-id configuration", () => {
    expectCode(
      () => verify(signed(), {
        keyring: {
          current: currentKey,
          next: { keyId: currentKey.keyId, secret: "different-next-secret".repeat(2) },
        },
      }),
      "PROTOCOL_KEYRING_INVALID",
    );
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
    expectCode(() => verify(rawSigned(credentialBody)), "PROTOCOL_BODY_MALFORMED");
  });

  it("does not implement replay state and returns the nonce for a durable atomic store", () => {
    const input = signed();
    expect(verify(input).nonce).toBe("nonce-001");
    expect(verify(input).nonce).toBe("nonce-001");
  });
});
