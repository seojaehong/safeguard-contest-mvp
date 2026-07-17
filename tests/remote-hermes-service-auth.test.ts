import { describe, expect, it } from "vitest";

import {
  RemoteHermesServiceAuthError,
  createRemoteHermesServiceAssertion,
  verifyRemoteHermesServiceAssertion,
  type RemoteHermesServiceAuthClaims,
  type RemoteHermesServiceAuthKey,
  type RemoteHermesServiceAuthVerificationKeyring,
} from "@/lib/remote-hermes-service-auth";

const NOW = new Date("2026-07-17T06:00:00.000Z");

function key(
  keyId: string,
  overrides: Partial<RemoteHermesServiceAuthKey> = {},
): RemoteHermesServiceAuthKey {
  return {
    keyId,
    secret: `${keyId}-`.padEnd(32, "s"),
    notBefore: "2026-07-17T05:00:00.000Z",
    notAfter: "2026-07-17T07:00:00.000Z",
    ...overrides,
  };
}

function claims(
  overrides: Partial<RemoteHermesServiceAuthClaims> = {},
): RemoteHermesServiceAuthClaims {
  return {
    version: "remote-hermes-service-auth/v1",
    issuer: "safeclaw-control-plane",
    audience: "hermes-gateway",
    organizationId: "org-a",
    siteId: "site-a",
    runId: "run-a",
    requestId: "request-a",
    attemptId: "attempt-a",
    attemptEnvelopeDigest: "a".repeat(64),
    issuedAt: "2026-07-17T05:59:00.000Z",
    expiresAt: "2026-07-17T06:01:00.000Z",
    ...overrides,
  };
}

function keyring(
  overrides: Partial<RemoteHermesServiceAuthVerificationKeyring> = {},
): RemoteHermesServiceAuthVerificationKeyring {
  return {
    current: key("current-key"),
    next: key("next-key"),
    retiredKeyIds: ["retired-key"],
    ...overrides,
  };
}

function expectCode(operation: () => unknown, code: RemoteHermesServiceAuthError["code"]): void {
  expect(operation).toThrowError(expect.objectContaining({ code }));
}

describe("Remote Hermes service authentication", () => {
  it("signs with the active key and verifies against the current verify-only key", () => {
    const active = key("current-key");
    const assertion = createRemoteHermesServiceAssertion({ claims: claims(), activeKey: active, now: NOW });

    expect(verifyRemoteHermesServiceAssertion({
      assertion,
      expected: claims(),
      keyring: keyring(),
      now: NOW,
    })).toEqual({
      claims: claims(),
      keyId: "current-key",
      keySlot: "current",
    });
  });

  it("accepts the next verify-only key during a rotation overlap", () => {
    const assertion = createRemoteHermesServiceAssertion({
      claims: claims(),
      activeKey: key("next-key"),
      now: NOW,
    });

    expect(verifyRemoteHermesServiceAssertion({
      assertion,
      expected: claims(),
      keyring: keyring(),
      now: NOW,
    }).keySlot).toBe("next");
  });

  it("rejects duplicate current and next key identifiers", () => {
    const assertion = createRemoteHermesServiceAssertion({
      claims: claims(),
      activeKey: key("current-key"),
      now: NOW,
    });

    expectCode(() => verifyRemoteHermesServiceAssertion({
      assertion,
      expected: claims(),
      keyring: keyring({ next: key("current-key", { secret: "different-secret".padEnd(32, "s") }) }),
      now: NOW,
    }), "SERVICE_AUTH_KEYRING_INVALID");
  });

  it("rejects an unknown key identifier", () => {
    const assertion = createRemoteHermesServiceAssertion({
      claims: claims(),
      activeKey: key("unknown-key"),
      now: NOW,
    });

    expectCode(() => verifyRemoteHermesServiceAssertion({
      assertion,
      expected: claims(),
      keyring: keyring(),
      now: NOW,
    }), "SERVICE_AUTH_KEY_UNKNOWN");
  });

  it("rejects a retired key identifier before signature acceptance", () => {
    const assertion = createRemoteHermesServiceAssertion({
      claims: claims(),
      activeKey: key("retired-key"),
      now: NOW,
    });

    expectCode(() => verifyRemoteHermesServiceAssertion({
      assertion,
      expected: claims(),
      keyring: keyring(),
      now: NOW,
    }), "SERVICE_AUTH_KEY_RETIRED");
  });

  it("rejects duplicate identifiers across active and retired slots", () => {
    const assertion = createRemoteHermesServiceAssertion({
      claims: claims(),
      activeKey: key("current-key"),
      now: NOW,
    });

    expectCode(() => verifyRemoteHermesServiceAssertion({
      assertion,
      expected: claims(),
      keyring: keyring({ retiredKeyIds: ["current-key"] }),
      now: NOW,
    }), "SERVICE_AUTH_KEYRING_INVALID");
  });

  it("rejects a signing key before notBefore", () => {
    expectCode(() => createRemoteHermesServiceAssertion({
      claims: claims(),
      activeKey: key("future-key", { notBefore: "2026-07-17T06:00:01.000Z" }),
      now: NOW,
    }), "SERVICE_AUTH_KEY_NOT_ACTIVE");
  });

  it("rejects a signing key at or after notAfter", () => {
    expectCode(() => createRemoteHermesServiceAssertion({
      claims: claims(),
      activeKey: key("expired-key", { notAfter: NOW.toISOString() }),
      now: NOW,
    }), "SERVICE_AUTH_KEY_EXPIRED");
  });

  it("rejects a verify-only key before notBefore", () => {
    const future = key("future-key", { notBefore: "2026-07-17T06:00:01.000Z" });
    const assertion = createRemoteHermesServiceAssertion({ claims: claims(), activeKey: key("future-key"), now: new Date("2026-07-17T06:00:02.000Z") });

    expectCode(() => verifyRemoteHermesServiceAssertion({
      assertion,
      expected: claims(),
      keyring: keyring({ current: future, next: undefined }),
      now: NOW,
    }), "SERVICE_AUTH_KEY_NOT_ACTIVE");
  });

  it("rejects an expired verify-only key", () => {
    const expired = key("expired-key", { notAfter: NOW.toISOString() });
    const assertion = createRemoteHermesServiceAssertion({ claims: claims(), activeKey: key("expired-key"), now: new Date("2026-07-17T05:59:59.000Z") });

    expectCode(() => verifyRemoteHermesServiceAssertion({
      assertion,
      expected: claims(),
      keyring: keyring({ current: expired, next: undefined }),
      now: NOW,
    }), "SERVICE_AUTH_KEY_EXPIRED");
  });

  it("rejects assertions outside their issuedAt and expiresAt window", () => {
    const notYetIssued = createRemoteHermesServiceAssertion({
      claims: claims({ issuedAt: "2026-07-17T06:00:01.000Z", expiresAt: "2026-07-17T06:01:00.000Z" }),
      activeKey: key("current-key"),
      now: new Date("2026-07-17T06:00:02.000Z"),
    });
    const expired = createRemoteHermesServiceAssertion({
      claims: claims({ issuedAt: "2026-07-17T05:58:00.000Z", expiresAt: NOW.toISOString() }),
      activeKey: key("current-key"),
      now: new Date("2026-07-17T05:59:00.000Z"),
    });

    expectCode(() => verifyRemoteHermesServiceAssertion({ assertion: notYetIssued, expected: notYetIssued.claims, keyring: keyring(), now: NOW }), "SERVICE_AUTH_ASSERTION_NOT_ACTIVE");
    expectCode(() => verifyRemoteHermesServiceAssertion({ assertion: expired, expected: expired.claims, keyring: keyring(), now: NOW }), "SERVICE_AUTH_ASSERTION_EXPIRED");
  });

  it.each([
    "issuer",
    "audience",
    "organizationId",
    "siteId",
    "runId",
    "requestId",
    "attemptId",
    "attemptEnvelopeDigest",
  ] as const)("rejects a mismatched %s binding", (field) => {
    const assertion = createRemoteHermesServiceAssertion({
      claims: claims(),
      activeKey: key("current-key"),
      now: NOW,
    });
    const value = field === "attemptEnvelopeDigest" ? "b".repeat(64) : `other-${field}`;

    expectCode(() => verifyRemoteHermesServiceAssertion({
      assertion,
      expected: claims({ [field]: value }),
      keyring: keyring(),
      now: NOW,
    }), "SERVICE_AUTH_BINDING_MISMATCH");
  });

  it("uses a timing-safe HMAC check and keeps secret and signature values out of errors", () => {
    const secret = "private-signing-secret-value-1234";
    const assertion = createRemoteHermesServiceAssertion({
      claims: claims(),
      activeKey: key("current-key", { secret }),
      now: NOW,
    });
    const tampered = { ...assertion, signature: `${assertion.signature.slice(0, -1)}0` };

    let caught: unknown;
    try {
      verifyRemoteHermesServiceAssertion({
        assertion: tampered,
        expected: claims(),
        keyring: keyring({ current: key("current-key", { secret }) }),
        now: NOW,
      });
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(RemoteHermesServiceAuthError);
    expect(caught).toMatchObject({ code: "SERVICE_AUTH_SIGNATURE_INVALID" });
    expect(JSON.stringify(caught)).not.toContain(secret);
    expect(JSON.stringify(caught)).not.toContain(assertion.signature);
    expect(String(caught)).not.toContain(secret);
    expect(String(caught)).not.toContain(assertion.signature);
  });
});
