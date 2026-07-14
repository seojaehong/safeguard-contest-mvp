import { describe, expect, it } from "vitest";

import {
  buildShareDispatchBinding,
  resolveServerChannelAvailability,
  validateShareDispatchBinding,
  verifyChannelAvailabilityToken,
  type ChannelAvailabilityInput,
  type ChannelRuntimeConfiguration
} from "@/lib/channel-availability";
import type { WorkpackShareServerConfig } from "@/lib/workpack-share-server-config";

const WORKPACK_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const WORKER_ID = "11111111-1111-4111-8111-111111111111";

function serverConfig(): WorkpackShareServerConfig {
  return {
    channelConfigurationRevision: 7,
    channelConfigurationDigestKeyId: "channel-key-2026-07",
    channelAvailabilitySecret: "availability-secret-abcdefghijklmnopqrstuvwxyz-01",
    channelConfigurationBindingSecret: "binding-secret-abcdefghijklmnopqrstuvwxyz-02",
    reviewedLocalizationSecret: "localization-secret-abcdefghijklmnopqrstuvwxyz-03"
  };
}

function runtime(overrides: Partial<ChannelRuntimeConfiguration> = {}): ChannelRuntimeConfiguration {
  return {
    dispatchMode: "live",
    relayProvider: "n8n",
    relayEndpoint: "https://relay.example/hook",
    relayConfigured: true,
    providerCredential: "relay-credential",
    persistentIdempotencyPolicyVersion: "share-session-access-policy-cas/v1",
    persistentIdempotencySupported: true,
    kakao: {
      enabled: true,
      provider: "solapi-alimtalk",
      senderId: "fixture-sender",
      templateId: "fixture-template",
      templateVersion: "1",
      approved: true,
      credential: null
    },
    ...overrides
  };
}

function input(
  overrides: Partial<ChannelAvailabilityInput> = {},
  runtimeOverrides: Partial<ChannelRuntimeConfiguration> = {}
): ChannelAvailabilityInput {
  return {
    config: serverConfig(),
    runtime: runtime(runtimeOverrides),
    userId: "user-1",
    organizationId: "org-1",
    siteId: "site-1",
    workpackId: WORKPACK_ID,
    canonicalWorkpackRevision: "a".repeat(64),
    recipients: [{
      workerId: WORKER_ID,
      displayName: "Nguyen",
      languageCode: "vi",
      role: "viewer",
      workerSnapshot: {
        workerId: WORKER_ID,
        displayName: "Nguyen",
        languageCode: "vi",
        phone: "010-1111-2222",
        email: "nguyen@example.com"
      }
    }],
    requestedChannels: ["email", "sms", "kakao"],
    now: new Date("2026-07-14T00:00:00.000Z"),
    ...overrides
  };
}

describe("server channel availability", () => {
  it("binds all three channels, recipients, revision, and normalized server identity into a short-lived token", () => {
    const resolution = resolveServerChannelAvailability(input());

    expect(resolution.ok).toBe(true);
    if (!resolution.ok) throw new Error("configured live channels must resolve");
    expect(resolution.channels.map((channel) => channel.channel)).toEqual(["email", "sms", "kakao"]);
    expect(resolution.channels.every((channel) => channel.available)).toBe(true);
    expect(resolution.configurationVersion).toBe("channel-configuration/v2");
    expect(resolution.configurationRevision).toBe(7);
    expect(resolution.configurationDigestKeyId).toBe("channel-key-2026-07");
    expect(resolution.configurationDigest).toMatch(/^[0-9a-f]{64}$/);
    expect(resolution.availabilityToken).toMatch(/^[A-Za-z0-9_-]+\.[0-9a-f]{64}$/);
    expect(Date.parse(resolution.expiresAt) - Date.parse(resolution.resolvedAt)).toBe(120_000);
    expect(JSON.stringify(resolution)).not.toContain("fixture-sender");
    expect(JSON.stringify(resolution)).not.toContain("fixture-template");
    expect(verifyChannelAvailabilityToken(input(), resolution.availabilityToken)).toEqual({
      ok: true,
      resolution
    });
  });

  it("marks fixture mode unavailable instead of presenting validation as delivery readiness", () => {
    const resolution = resolveServerChannelAvailability(input({}, {
      dispatchMode: "fixture",
      relayProvider: "safe-fixture",
      relayEndpoint: null,
      providerCredential: null
    }));

    expect(resolution.ok).toBe(true);
    if (!resolution.ok) throw new Error("fixture mode should resolve to a blocked result");
    expect(resolution.ready).toBe(false);
    expect(resolution.channels.every((channel) => channel.reasonCode === "provider_unconfigured")).toBe(true);
  });

  it("invalidates a prior token after binding key ID, revision, and secret rotation", () => {
    const originalInput = input();
    const original = resolveServerChannelAvailability(originalInput);
    if (!original.ok) throw new Error("fixture channels must resolve");
    const rotatedConfig = {
      ...serverConfig(),
      channelConfigurationRevision: 8,
      channelConfigurationDigestKeyId: "channel-key-2026-08",
      channelConfigurationBindingSecret: "rotated-binding-secret-abcdefghijklmnopqrstuvwxyz"
    };

    const verified = verifyChannelAvailabilityToken(
      input({ config: rotatedConfig }),
      original.availabilityToken
    );

    expect(verified).toMatchObject({ ok: false, reasonCode: "channel_configuration_changed" });
  });

  it("fails closed when a selected channel has missing contact information", () => {
    const missingEmail = input({
      requestedChannels: ["email"],
      recipients: [{
        workerId: WORKER_ID,
        displayName: "Nguyen",
        languageCode: "vi",
        role: "viewer",
        workerSnapshot: {
          workerId: WORKER_ID,
          displayName: "Nguyen",
          languageCode: "vi",
          phone: "010-1111-2222",
          email: null
        }
      }]
    });

    const resolution = resolveServerChannelAvailability(missingEmail);

    expect(resolution.ok).toBe(true);
    if (!resolution.ok) throw new Error("a resolved unavailable channel still returns a signed resolution");
    expect(resolution.channels).toEqual([expect.objectContaining({
      channel: "email",
      available: false,
      reasonCode: "recipient_contact_missing"
    })]);
    expect(resolution.ready).toBe(false);
  });

  it("marks live dispatch unavailable when persistent idempotency is unsupported", () => {
    const resolution = resolveServerChannelAvailability(input({}, {
      dispatchMode: "live",
      relayProvider: "n8n",
      relayEndpoint: "https://relay.example/hook?tenant=safeclaw",
      providerCredential: "credential-value",
      persistentIdempotencySupported: false
    }));

    expect(resolution.ok).toBe(true);
    if (!resolution.ok) throw new Error("configuration should resolve to an unavailable channel result");
    expect(resolution.ready).toBe(false);
    expect(resolution.channels.every((channel) => channel.reasonCode === "idempotency_unsupported")).toBe(true);
  });

  it("keeps Kakao-only readiness blocked when its actual relay adapter is unavailable", () => {
    const resolution = resolveServerChannelAvailability(input({
      requestedChannels: ["kakao"]
    }, {
      relayEndpoint: null,
      relayConfigured: false,
      providerCredential: null
    }));

    expect(resolution.ok).toBe(true);
    if (!resolution.ok) throw new Error("Kakao adapter readiness must resolve to an explicit blocked result");
    expect(resolution.ready).toBe(false);
    expect(resolution.channels).toEqual([expect.objectContaining({
      channel: "kakao",
      configured: false,
      available: false,
      reasonCode: "relay_unconfigured"
    })]);
  });

  it("does not mark a mixed selection ready when Kakao lacks the shared dispatch adapter", () => {
    const resolution = resolveServerChannelAvailability(input({
      requestedChannels: ["email", "kakao"]
    }, {
      relayEndpoint: null,
      relayConfigured: false,
      providerCredential: null
    }));

    expect(resolution.ok).toBe(true);
    if (!resolution.ok) throw new Error("mixed adapter readiness must resolve to an explicit blocked result");
    expect(resolution.ready).toBe(false);
    expect(resolution.channels).toEqual([
      expect.objectContaining({ channel: "email", available: false, reasonCode: "relay_unconfigured" }),
      expect.objectContaining({ channel: "kakao", available: false, reasonCode: "relay_unconfigured" })
    ]);
  });

  it("binds a server-created session to exact workpack, recipient, channel, and locale identities", () => {
    const resolution = resolveServerChannelAvailability(input());
    if (!resolution.ok) throw new Error("fixture channels must resolve");
    const binding = buildShareDispatchBinding({
      sessionIdentity: {
        shareSessionId: "33333333-3333-4333-8333-333333333333",
        organizationId: "org-1",
        siteId: "site-1",
        workpackId: WORKPACK_ID,
        createdBy: "user-1"
      },
      localization: {
        canonicalWorkpackRevision: "a".repeat(64),
        normalizedWorkpackDigest: "b".repeat(64),
        localePayloadDigest: "c".repeat(64)
      },
      channelResolution: resolution,
      createdAt: "2026-07-14T00:00:00.000Z"
    });

    expect(binding.bindingDigest).toMatch(/^[0-9a-f]{64}$/);
    expect(validateShareDispatchBinding({
      binding,
      sessionIdentity: binding.sessionIdentity,
      localization: {
        canonicalWorkpackRevision: "a".repeat(64),
        normalizedWorkpackDigest: "b".repeat(64),
        localePayloadDigest: "c".repeat(64)
      },
      recipientSnapshotDigest: resolution.recipientDigest,
      channelResolution: resolution
    })).toEqual({ ok: true, binding });
  });

  it("rejects a created session before provider dispatch after channel configuration rotation", () => {
    const original = resolveServerChannelAvailability(input());
    const rotated = resolveServerChannelAvailability(input({
      config: {
        ...serverConfig(),
        channelConfigurationRevision: 8,
        channelConfigurationDigestKeyId: "channel-key-2026-08",
        channelConfigurationBindingSecret: "rotated-binding-secret-abcdefghijklmnopqrstuvwxyz"
      }
    }));
    if (!original.ok || !rotated.ok) throw new Error("channel resolutions must be available for comparison");
    const sessionIdentity = {
      shareSessionId: "33333333-3333-4333-8333-333333333333",
      organizationId: "org-1",
      siteId: "site-1",
      workpackId: WORKPACK_ID,
      createdBy: "user-1"
    };
    const localization = {
      canonicalWorkpackRevision: "a".repeat(64),
      normalizedWorkpackDigest: "b".repeat(64),
      localePayloadDigest: "c".repeat(64)
    };
    const binding = buildShareDispatchBinding({
      sessionIdentity,
      localization,
      channelResolution: original,
      createdAt: "2026-07-14T00:00:00.000Z"
    });

    expect(validateShareDispatchBinding({
      binding,
      sessionIdentity,
      localization,
      recipientSnapshotDigest: rotated.recipientDigest,
      channelResolution: rotated
    })).toEqual({ ok: false, reasonCode: "channel_configuration_changed" });
  });
});
