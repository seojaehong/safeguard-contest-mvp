import { describe, expect, it, vi } from "vitest";

import {
  REMOTE_HERMES_SERVICE_AUTH_CONSUME_TIMEOUT_MS,
  REMOTE_HERMES_SERVICE_AUTH_MAX_FUTURE_SKEW_MS,
  REMOTE_HERMES_SERVICE_AUTH_MAX_TTL_MS,
  RemoteHermesServiceAuthError,
  createRemoteHermesServiceAssertion,
  verifyRemoteHermesServiceAssertion as verifyAssertion,
  type RemoteHermesServiceAuthClaims,
  type RemoteHermesServiceAuthKey,
  type RemoteHermesServiceAuthReplayConsumerInput,
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

async function expectAsyncCode(
  operation: () => Promise<unknown>,
  code: RemoteHermesServiceAuthError["code"],
): Promise<void> {
  await expect(operation()).rejects.toMatchObject({ code });
}

function verifyRemoteHermesServiceAssertion(
  input: Omit<Parameters<typeof verifyAssertion>[0], "consume">,
) {
  return verifyAssertion({ ...input, consume: async () => true });
}

describe("Remote Hermes service authentication", () => {
  it("rejects creation outside the bounded assertion lifetime", () => {
    expect(REMOTE_HERMES_SERVICE_AUTH_MAX_TTL_MS).toBe(5 * 60 * 1000);
    expect(REMOTE_HERMES_SERVICE_AUTH_MAX_FUTURE_SKEW_MS).toBe(30 * 1000);

    expectCode(() => createRemoteHermesServiceAssertion({
      claims: claims({
        issuedAt: new Date(NOW.getTime() + REMOTE_HERMES_SERVICE_AUTH_MAX_FUTURE_SKEW_MS + 1).toISOString(),
        expiresAt: new Date(NOW.getTime() + REMOTE_HERMES_SERVICE_AUTH_MAX_FUTURE_SKEW_MS + 2).toISOString(),
      }),
      activeKey: key("current-key"),
      now: NOW,
    }), "SERVICE_AUTH_ASSERTION_NOT_ACTIVE");

    expectCode(() => createRemoteHermesServiceAssertion({
      claims: claims({ expiresAt: NOW.toISOString() }),
      activeKey: key("current-key"),
      now: NOW,
    }), "SERVICE_AUTH_ASSERTION_EXPIRED");

    expectCode(() => createRemoteHermesServiceAssertion({
      claims: claims({
        issuedAt: NOW.toISOString(),
        expiresAt: new Date(NOW.getTime() + REMOTE_HERMES_SERVICE_AUTH_MAX_TTL_MS + 1).toISOString(),
      }),
      activeKey: key("current-key"),
      now: NOW,
    }), "SERVICE_AUTH_ASSERTION_INVALID");
  });

  it("enforces the bounded assertion lifetime during verification", async () => {
    const assertion = createRemoteHermesServiceAssertion({
      claims: claims(),
      activeKey: key("current-key"),
      now: NOW,
    });
    const overlong = {
      ...assertion,
      claims: {
        ...assertion.claims,
        expiresAt: new Date(
          Date.parse(assertion.claims.issuedAt) + REMOTE_HERMES_SERVICE_AUTH_MAX_TTL_MS + 1,
        ).toISOString(),
      },
    };

    await expectAsyncCode(() => verifyRemoteHermesServiceAssertion({
      assertion: overlong,
      expected: overlong.claims,
      keyring: keyring(),
      now: NOW,
    }), "SERVICE_AUTH_ASSERTION_INVALID");
  });

  it("consumes the full tenant attempt binding exactly once and retains it through expiry", async () => {
    const assertion = createRemoteHermesServiceAssertion({
      claims: claims(),
      activeKey: key("current-key"),
      now: NOW,
    });
    const consumed = new Set<string>();
    const retention = new Map<string, string>();
    const consume = async ({ bindingKey, retainUntil }: RemoteHermesServiceAuthReplayConsumerInput): Promise<boolean> => {
      if (consumed.has(bindingKey)) return false;
      consumed.add(bindingKey);
      retention.set(bindingKey, retainUntil);
      return true;
    };
    const input = { assertion, expected: claims(), keyring: keyring(), now: NOW, consume };

    expect((await verifyAssertion(input)).keyId).toBe("current-key");
    await expectAsyncCode(() => verifyAssertion(input), "SERVICE_AUTH_REPLAY_REJECTED");
    expect([...consumed]).toEqual([
      "{\"attemptEnvelopeDigest\":\"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa\",\"attemptId\":\"attempt-a\",\"organizationId\":\"org-a\",\"requestId\":\"request-a\",\"runId\":\"run-a\",\"siteId\":\"site-a\"}",
    ]);
    expect([...retention.values()]).toEqual([assertion.claims.expiresAt]);
  });

  it("rejects an async replay consumer that resolves false", async () => {
    const assertion = createRemoteHermesServiceAssertion({
      claims: claims(),
      activeKey: key("current-key"),
      now: NOW,
    });

    await expect(Promise.resolve(verifyAssertion({
      assertion,
      expected: claims(),
      keyring: keyring(),
      now: NOW,
      consume: async (_input: RemoteHermesServiceAuthReplayConsumerInput): Promise<boolean> => false,
    }))).rejects.toMatchObject({ code: "SERVICE_AUTH_REPLAY_REJECTED" });
  });

  it.each([
    ["returns false", async (): Promise<boolean> => false],
    ["throws", async (): Promise<boolean> => { throw new Error("store detail must not escape"); }],
  ] as const)("fails closed when replay consumption %s", async (_case, consume) => {
    const assertion = createRemoteHermesServiceAssertion({
      claims: claims(),
      activeKey: key("current-key"),
      now: NOW,
    });

    let caught: unknown;
    try {
      await verifyAssertion({ assertion, expected: claims(), keyring: keyring(), now: NOW, consume });
    } catch (error) {
      caught = error;
    }

    expect(caught).toMatchObject({ code: "SERVICE_AUTH_REPLAY_REJECTED" });
    expect(String(caught)).not.toContain("store detail");
  });

  it("aborts and rejects replay consumption that exceeds the bounded timeout", async () => {
    vi.useFakeTimers();
    try {
      const assertion = createRemoteHermesServiceAssertion({
        claims: claims(),
        activeKey: key("current-key"),
        now: NOW,
      });
      let signal: AbortSignal | undefined;
      const pending = verifyAssertion({
        assertion,
        expected: claims(),
        keyring: keyring(),
        now: NOW,
        consume: async (input): Promise<boolean> => {
          signal = input.signal;
          return new Promise<boolean>(() => undefined);
        },
      });
      const rejection = expect(pending).rejects.toMatchObject({ code: "SERVICE_AUTH_REPLAY_REJECTED" });

      await vi.advanceTimersByTimeAsync(REMOTE_HERMES_SERVICE_AUTH_CONSUME_TIMEOUT_MS);
      await rejection;
      expect(signal?.aborted).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });

  it("rejects when abort synchronously resolves the consumer true", async () => {
    vi.useFakeTimers();
    try {
      const assertion = createRemoteHermesServiceAssertion({
        claims: claims(),
        activeKey: key("current-key"),
        now: NOW,
      });
      const pending = verifyAssertion({
        assertion,
        expected: claims(),
        keyring: keyring(),
        now: NOW,
        consume: ({ signal }): Promise<boolean> => new Promise<boolean>((resolve) => {
          signal.addEventListener("abort", () => resolve(true), { once: true });
        }),
      });
      const rejection = expect(pending).rejects.toMatchObject({ code: "SERVICE_AUTH_REPLAY_REJECTED" });

      await vi.advanceTimersByTimeAsync(REMOTE_HERMES_SERVICE_AUTH_CONSUME_TIMEOUT_MS);
      await rejection;
    } finally {
      vi.useRealTimers();
    }
  });

  it("rejects the abort-resolution race with real timers and no unhandled rejection", async () => {
    const assertion = createRemoteHermesServiceAssertion({
      claims: claims(),
      activeKey: key("current-key"),
      now: NOW,
    });
    const unhandled: unknown[] = [];
    const onUnhandled = (reason: unknown): void => { unhandled.push(reason); };
    process.on("unhandledRejection", onUnhandled);
    try {
      await expect(verifyAssertion({
        assertion,
        expected: claims(),
        keyring: keyring(),
        now: NOW,
        consume: ({ signal }): Promise<boolean> => new Promise<boolean>((resolve) => {
          signal.addEventListener("abort", () => resolve(true), { once: true });
        }),
      })).rejects.toMatchObject({ code: "SERVICE_AUTH_REPLAY_REJECTED" });
      await new Promise<void>((resolve) => setImmediate(resolve));
      expect(unhandled).toEqual([]);
    } finally {
      process.off("unhandledRejection", onUnhandled);
    }
  });

  it("contains a late consumer rejection after timeout without exposing its error", async () => {
    vi.useFakeTimers();
    const unhandled: unknown[] = [];
    const onUnhandled = (reason: unknown): void => { unhandled.push(reason); };
    process.on("unhandledRejection", onUnhandled);
    try {
      const assertion = createRemoteHermesServiceAssertion({
        claims: claims(),
        activeKey: key("current-key"),
        now: NOW,
      });
      const pending = verifyAssertion({
        assertion,
        expected: claims(),
        keyring: keyring(),
        now: NOW,
        consume: async ({ signal }): Promise<boolean> => new Promise<boolean>((_resolve, reject) => {
          signal.addEventListener("abort", () => {
            setTimeout(() => reject(new Error("private redis failure detail")), 1);
          }, { once: true });
        }),
      });
      const caught = pending.catch((error: unknown) => error);

      await vi.advanceTimersByTimeAsync(REMOTE_HERMES_SERVICE_AUTH_CONSUME_TIMEOUT_MS + 1);
      await vi.runAllTimersAsync();
      const error = await caught;

      expect(error).toMatchObject({ code: "SERVICE_AUTH_REPLAY_REJECTED" });
      expect(String(error)).not.toContain("private redis failure detail");
      expect(unhandled).toEqual([]);
    } finally {
      process.off("unhandledRejection", onUnhandled);
      vi.useRealTimers();
    }
  });

  it.each(["signature", "binding"] as const)(
    "does not consume replay state before %s verification succeeds",
    async (failure) => {
      const assertion = createRemoteHermesServiceAssertion({
        claims: claims(),
        activeKey: key("current-key"),
        now: NOW,
      });
      const invalidAssertion = failure === "signature"
        ? {
            ...assertion,
            signature: `${assertion.signature.slice(0, -1)}${assertion.signature.endsWith("0") ? "1" : "0"}`,
          }
        : assertion;
      const expected = failure === "binding" ? claims({ siteId: "site-b" }) : claims();
      let consumeCalls = 0;

      await expect(verifyAssertion({
        assertion: invalidAssertion,
        expected,
        keyring: keyring(),
        now: NOW,
        consume: async (): Promise<boolean> => {
          consumeCalls += 1;
          return true;
        },
      })).rejects.toMatchObject({
        code: failure === "signature" ? "SERVICE_AUTH_SIGNATURE_INVALID" : "SERVICE_AUTH_BINDING_MISMATCH",
      });
      expect(consumeCalls).toBe(0);
    },
  );

  it("signs with the active key and verifies against the current verify-only key", async () => {
    const active = key("current-key");
    const assertion = createRemoteHermesServiceAssertion({ claims: claims(), activeKey: active, now: NOW });

    expect(await verifyRemoteHermesServiceAssertion({
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

  it("accepts the next verify-only key during a rotation overlap", async () => {
    const assertion = createRemoteHermesServiceAssertion({
      claims: claims(),
      activeKey: key("next-key"),
      now: NOW,
    });

    expect((await verifyRemoteHermesServiceAssertion({
      assertion,
      expected: claims(),
      keyring: keyring(),
      now: NOW,
    })).keySlot).toBe("next");
  });

  it("rejects duplicate current and next key identifiers", async () => {
    const assertion = createRemoteHermesServiceAssertion({
      claims: claims(),
      activeKey: key("current-key"),
      now: NOW,
    });

    await expectAsyncCode(() => verifyRemoteHermesServiceAssertion({
      assertion,
      expected: claims(),
      keyring: keyring({ next: key("current-key", { secret: "different-secret".padEnd(32, "s") }) }),
      now: NOW,
    }), "SERVICE_AUTH_KEYRING_INVALID");
  });

  it("rejects an unknown key identifier", async () => {
    const assertion = createRemoteHermesServiceAssertion({
      claims: claims(),
      activeKey: key("unknown-key"),
      now: NOW,
    });

    await expectAsyncCode(() => verifyRemoteHermesServiceAssertion({
      assertion,
      expected: claims(),
      keyring: keyring(),
      now: NOW,
    }), "SERVICE_AUTH_KEY_UNKNOWN");
  });

  it("rejects a retired key identifier before signature acceptance", async () => {
    const assertion = createRemoteHermesServiceAssertion({
      claims: claims(),
      activeKey: key("retired-key"),
      now: NOW,
    });

    await expectAsyncCode(() => verifyRemoteHermesServiceAssertion({
      assertion,
      expected: claims(),
      keyring: keyring(),
      now: NOW,
    }), "SERVICE_AUTH_KEY_RETIRED");
  });

  it("rejects duplicate identifiers across active and retired slots", async () => {
    const assertion = createRemoteHermesServiceAssertion({
      claims: claims(),
      activeKey: key("current-key"),
      now: NOW,
    });

    await expectAsyncCode(() => verifyRemoteHermesServiceAssertion({
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

  it("rejects a verify-only key before notBefore", async () => {
    const future = key("future-key", { notBefore: "2026-07-17T06:00:01.000Z" });
    const assertion = createRemoteHermesServiceAssertion({ claims: claims(), activeKey: key("future-key"), now: new Date("2026-07-17T06:00:02.000Z") });

    await expectAsyncCode(() => verifyRemoteHermesServiceAssertion({
      assertion,
      expected: claims(),
      keyring: keyring({ current: future, next: undefined }),
      now: NOW,
    }), "SERVICE_AUTH_KEY_NOT_ACTIVE");
  });

  it("rejects an expired verify-only key", async () => {
    const expired = key("expired-key", { notAfter: NOW.toISOString() });
    const assertion = createRemoteHermesServiceAssertion({ claims: claims(), activeKey: key("expired-key"), now: new Date("2026-07-17T05:59:59.000Z") });

    await expectAsyncCode(() => verifyRemoteHermesServiceAssertion({
      assertion,
      expected: claims(),
      keyring: keyring({ current: expired, next: undefined }),
      now: NOW,
    }), "SERVICE_AUTH_KEY_EXPIRED");
  });

  it("rejects assertions outside their issuedAt and expiresAt window", async () => {
    const notYetIssued = createRemoteHermesServiceAssertion({
      claims: claims({ issuedAt: "2026-07-17T06:00:30.001Z", expiresAt: "2026-07-17T06:01:00.000Z" }),
      activeKey: key("current-key"),
      now: new Date("2026-07-17T06:00:31.000Z"),
    });
    const expired = createRemoteHermesServiceAssertion({
      claims: claims({ issuedAt: "2026-07-17T05:58:00.000Z", expiresAt: NOW.toISOString() }),
      activeKey: key("current-key"),
      now: new Date("2026-07-17T05:59:00.000Z"),
    });

    await expectAsyncCode(() => verifyRemoteHermesServiceAssertion({ assertion: notYetIssued, expected: notYetIssued.claims, keyring: keyring(), now: NOW }), "SERVICE_AUTH_ASSERTION_NOT_ACTIVE");
    await expectAsyncCode(() => verifyRemoteHermesServiceAssertion({ assertion: expired, expected: expired.claims, keyring: keyring(), now: NOW }), "SERVICE_AUTH_ASSERTION_EXPIRED");
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
  ] as const)("rejects a mismatched %s binding", async (field) => {
    const assertion = createRemoteHermesServiceAssertion({
      claims: claims(),
      activeKey: key("current-key"),
      now: NOW,
    });
    const value = field === "attemptEnvelopeDigest" ? "b".repeat(64) : `other-${field}`;

    await expectAsyncCode(() => verifyRemoteHermesServiceAssertion({
      assertion,
      expected: claims({ [field]: value }),
      keyring: keyring(),
      now: NOW,
    }), "SERVICE_AUTH_BINDING_MISMATCH");
  });

  it("uses a timing-safe HMAC check and keeps secret and signature values out of errors", async () => {
    const secret = "private-signing-secret-value-1234";
    const assertion = createRemoteHermesServiceAssertion({
      claims: claims(),
      activeKey: key("current-key", { secret }),
      now: NOW,
    });
    const tampered = { ...assertion, signature: `${assertion.signature.slice(0, -1)}0` };

    let caught: unknown;
    try {
      await verifyRemoteHermesServiceAssertion({
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
