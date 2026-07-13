import "server-only";

export type WorkpackShareServerConfig = {
  channelConfigurationRevision: number;
  channelConfigurationDigestKeyId: string;
  channelAvailabilitySecret: string;
  channelConfigurationBindingSecret: string;
  reviewedLocalizationSecret: string;
};

export type WorkpackShareServerConfigResult =
  | { ok: true; config: WorkpackShareServerConfig }
  | { ok: false; invalidKeys: string[] };

const PLACEHOLDER_PATTERN = /^(?:change[-_ ]?me|replace|placeholder|example|todo|your[-_ ])/i;

function isValidSecret(value: string | undefined): value is string {
  if (!value) return false;
  const trimmed = value.trim();
  return trimmed.length >= 32 && !PLACEHOLDER_PATTERN.test(trimmed);
}

function parsePositiveInteger(value: string | undefined): number | null {
  if (!value || !/^\d+$/.test(value.trim())) return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
}

export function readWorkpackShareServerConfig(
  environment: NodeJS.ProcessEnv
): WorkpackShareServerConfigResult {
  const invalidKeys: string[] = [];
  const revision = parsePositiveInteger(environment.SAFECLAW_CHANNEL_CONFIG_REVISION);
  const keyId = environment.SAFECLAW_CHANNEL_CONFIG_DIGEST_KEY_ID?.trim() || "";
  const availabilitySecret = environment.SAFECLAW_CHANNEL_AVAILABILITY_SECRET?.trim();
  const bindingSecret = environment.SAFECLAW_CHANNEL_CONFIG_BINDING_SECRET?.trim();
  const localizationSecret = environment.SAFECLAW_REVIEWED_LOCALIZATION_SECRET?.trim();

  if (revision === null) invalidKeys.push("SAFECLAW_CHANNEL_CONFIG_REVISION");
  if (!keyId || PLACEHOLDER_PATTERN.test(keyId)) {
    invalidKeys.push("SAFECLAW_CHANNEL_CONFIG_DIGEST_KEY_ID");
  }
  if (!isValidSecret(availabilitySecret)) {
    invalidKeys.push("SAFECLAW_CHANNEL_AVAILABILITY_SECRET");
  }
  if (!isValidSecret(bindingSecret)) {
    invalidKeys.push("SAFECLAW_CHANNEL_CONFIG_BINDING_SECRET");
  }
  if (!isValidSecret(localizationSecret)) {
    invalidKeys.push("SAFECLAW_REVIEWED_LOCALIZATION_SECRET");
  }

  if (invalidKeys.length || revision === null || !availabilitySecret || !bindingSecret || !localizationSecret) {
    return { ok: false, invalidKeys };
  }

  return {
    ok: true,
    config: {
      channelConfigurationRevision: revision,
      channelConfigurationDigestKeyId: keyId,
      channelAvailabilitySecret: availabilitySecret,
      channelConfigurationBindingSecret: bindingSecret,
      reviewedLocalizationSecret: localizationSecret
    }
  };
}
