import { describe, expect, it } from "vitest";

import { readWorkpackShareServerConfig } from "@/lib/workpack-share-server-config";

const SECRET_A = "availability-secret-abcdefghijklmnopqrstuvwxyz-01";
const SECRET_B = "binding-secret-abcdefghijklmnopqrstuvwxyz-02";
const SECRET_C = "localization-secret-abcdefghijklmnopqrstuvwxyz-03";

function validEnvironment(): NodeJS.ProcessEnv {
  return {
    NODE_ENV: "test",
    SAFECLAW_CHANNEL_CONFIG_REVISION: "7",
    SAFECLAW_CHANNEL_CONFIG_DIGEST_KEY_ID: "channel-key-2026-07",
    SAFECLAW_CHANNEL_AVAILABILITY_SECRET: SECRET_A,
    SAFECLAW_CHANNEL_CONFIG_BINDING_SECRET: SECRET_B,
    SAFECLAW_REVIEWED_LOCALIZATION_SECRET: SECRET_C
  };
}

describe("workpack Share server configuration", () => {
  it("strictly parses the monotonic revision, key ID, and three server secrets", () => {
    const result = readWorkpackShareServerConfig(validEnvironment());

    expect(result).toEqual({
      ok: true,
      config: {
        channelConfigurationRevision: 7,
        channelConfigurationDigestKeyId: "channel-key-2026-07",
        channelAvailabilitySecret: SECRET_A,
        channelConfigurationBindingSecret: SECRET_B,
        reviewedLocalizationSecret: SECRET_C
      }
    });
  });

  it.each([
    ["blank", ""],
    ["placeholder", "replace-with-a-long-production-secret-value"],
    ["short", "too-short"]
  ])("rejects a %s secret without echoing it", (_label, invalidSecret) => {
    const environment = validEnvironment();
    environment.SAFECLAW_CHANNEL_AVAILABILITY_SECRET = invalidSecret;

    const result = readWorkpackShareServerConfig(environment);

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("invalid configuration must fail closed");
    expect(result.invalidKeys).toContain("SAFECLAW_CHANNEL_AVAILABILITY_SECRET");
    expect(JSON.stringify(result)).not.toContain(invalidSecret || SECRET_A);
  });

  it.each(["", "0", "-1", "1.5", "seven"])("rejects a non-positive integer revision: %s", (revision) => {
    const environment = validEnvironment();
    environment.SAFECLAW_CHANNEL_CONFIG_REVISION = revision;

    const result = readWorkpackShareServerConfig(environment);

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("invalid revision must fail closed");
    expect(result.invalidKeys).toContain("SAFECLAW_CHANNEL_CONFIG_REVISION");
  });

  it("re-reads the supplied environment so rotations cannot reuse a cached secret", () => {
    const environment = validEnvironment();
    const first = readWorkpackShareServerConfig(environment);
    environment.SAFECLAW_CHANNEL_CONFIG_REVISION = "8";
    environment.SAFECLAW_CHANNEL_CONFIG_DIGEST_KEY_ID = "channel-key-2026-08";
    environment.SAFECLAW_CHANNEL_CONFIG_BINDING_SECRET = `${SECRET_B}-rotated`;
    const second = readWorkpackShareServerConfig(environment);

    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
    if (!first.ok || !second.ok) throw new Error("valid configurations must parse");
    expect(second.config.channelConfigurationRevision).toBe(8);
    expect(second.config.channelConfigurationDigestKeyId).toBe("channel-key-2026-08");
    expect(second.config.channelConfigurationBindingSecret).not.toBe(
      first.config.channelConfigurationBindingSecret
    );
  });
});
