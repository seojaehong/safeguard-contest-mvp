import { createHmac, timingSafeEqual } from "node:crypto";

import { canonicalShareJson, sha256ShareValue } from "@/lib/reviewed-localization-envelope";
import type { WorkpackDispatchChannel, ShareRecipientInput } from "@/lib/workpack-commercial";
import type { WorkpackShareServerConfig } from "@/lib/workpack-share-server-config";

export type ChannelAvailabilityReason =
  | "available"
  | "recipient_contact_missing"
  | "provider_unconfigured"
  | "relay_unconfigured"
  | "idempotency_unsupported"
  | "template_unapproved"
  | "policy_disabled";

export type ResolvedChannel = {
  channel: WorkpackDispatchChannel;
  configured: boolean;
  approved: boolean;
  available: boolean;
  recipientCount: number;
  reasonCode: ChannelAvailabilityReason;
  ownerRoute: "/settings";
};

export type ChannelRuntimeConfiguration = {
  dispatchMode: "fixture" | "live";
  relayProvider: string | null;
  relayEndpoint: string | null;
  relayConfigured: boolean;
  providerCredential: string | null;
  persistentIdempotencyPolicyVersion: string;
  persistentIdempotencySupported: boolean;
  kakao: {
    enabled: boolean;
    provider: string | null;
    senderId: string | null;
    templateId: string | null;
    templateVersion: string | null;
    approved: boolean;
    credential: string | null;
  };
};

export function buildChannelRuntimeConfiguration(input: {
  environment: NodeJS.ProcessEnv;
  liveDispatch: boolean;
  relayEndpoint: string | null;
  relayCredential: string | null;
}): ChannelRuntimeConfiguration {
  const fixture = !input.liveDispatch;
  const kakaoEnabled = input.environment.SAFEGUARD_KAKAO_ENABLED === "1"
    || input.environment.SAFECLAW_KAKAO_ENABLED === "1";
  const templateId = input.environment.SOLAPI_KAKAO_TEMPLATE_ID?.trim()
    || input.environment.SOLAPI_KAKAO_TEMPLATE_CODE?.trim()
    || null;
  return {
    dispatchMode: fixture ? "fixture" : "live",
    relayProvider: fixture ? "safe-fixture" : "n8n",
    relayEndpoint: fixture ? null : input.relayEndpoint,
    relayConfigured: fixture || Boolean(input.relayEndpoint && input.relayCredential),
    providerCredential: fixture ? null : input.relayCredential,
    persistentIdempotencyPolicyVersion: "share-session-access-policy-cas/v1",
    persistentIdempotencySupported: true,
    kakao: {
      enabled: kakaoEnabled,
      provider: fixture ? "safe-fixture" : kakaoEnabled ? "solapi-alimtalk" : null,
      senderId: input.environment.SOLAPI_KAKAO_SENDER_KEY?.trim() || null,
      templateId,
      templateVersion: input.environment.SOLAPI_KAKAO_TEMPLATE_VERSION?.trim() || null,
      approved: input.environment.SOLAPI_KAKAO_TEMPLATE_APPROVED === "1",
      credential: null
    }
  };
}

export type ChannelAvailabilityInput = {
  config: WorkpackShareServerConfig;
  runtime: ChannelRuntimeConfiguration;
  userId: string;
  organizationId: string;
  siteId: string | null;
  workpackId: string;
  canonicalWorkpackRevision: string;
  recipients: ShareRecipientInput[];
  requestedChannels: WorkpackDispatchChannel[];
  now: Date;
};

export type ChannelAvailabilityResolution = {
  ok: true;
  version: "channel-availability/v1";
  workpackId: string;
  canonicalWorkpackRevision: string;
  recipientDigest: string;
  requestedChannels: WorkpackDispatchChannel[];
  dispatchMode: "fixture" | "live";
  channels: ResolvedChannel[];
  configurationVersion: "channel-configuration/v2";
  configurationRevision: number;
  configurationDigestKeyId: string;
  configurationDigest: string;
  resolvedAt: string;
  expiresAt: string;
  availabilityToken: string;
  ready: boolean;
};

export type ChannelAvailabilityFailure = {
  ok: false;
  reasonCode: "channel_request_invalid" | "availability_token_invalid" | "availability_token_expired" | "channel_configuration_changed";
};

export type ShareSessionIdentity = {
  shareSessionId: string;
  organizationId: string;
  siteId: string | null;
  workpackId: string;
  createdBy: string;
};

export type ShareLocalizationBinding = {
  canonicalWorkpackRevision: string;
  normalizedWorkpackDigest: string;
  localePayloadDigest: string;
};

export type ShareDispatchBindingV1 = {
  version: "share-dispatch-binding/v1";
  sessionIdentity: ShareSessionIdentity;
  canonicalWorkpackRevision: string;
  normalizedWorkpackDigest: string;
  recipientSnapshotDigest: string;
  requestedChannels: WorkpackDispatchChannel[];
  channelConfigurationVersion: "channel-configuration/v2";
  channelConfigurationRevision: number;
  channelConfigurationDigestKeyId: string;
  channelConfigurationDigest: string;
  localePayloadDigest: string;
  createdAt: string;
  bindingDigest: string;
};

export type ShareDispatchBindingFailureReason =
  | "session_binding_missing_or_malformed"
  | "session_identity_mismatch"
  | "workpack_revision_or_digest_changed"
  | "recipient_snapshot_changed"
  | "channel_configuration_changed"
  | "translation_incomplete";

type AvailabilityTokenPayload = Omit<
  ChannelAvailabilityResolution,
  "ok" | "version" | "channels" | "availabilityToken" | "ready"
>;

const CHANNEL_ORDER: WorkpackDispatchChannel[] = ["email", "sms", "kakao"];
const TOKEN_TTL_MS = 120_000;

function bindingDigest(binding: Omit<ShareDispatchBindingV1, "bindingDigest">): string {
  return sha256ShareValue(binding);
}

export function buildShareDispatchBinding(input: {
  sessionIdentity: ShareSessionIdentity;
  localization: ShareLocalizationBinding;
  channelResolution: ChannelAvailabilityResolution;
  createdAt: string;
}): ShareDispatchBindingV1 {
  const unsigned: Omit<ShareDispatchBindingV1, "bindingDigest"> = {
    version: "share-dispatch-binding/v1",
    sessionIdentity: input.sessionIdentity,
    canonicalWorkpackRevision: input.localization.canonicalWorkpackRevision,
    normalizedWorkpackDigest: input.localization.normalizedWorkpackDigest,
    recipientSnapshotDigest: input.channelResolution.recipientDigest,
    requestedChannels: [...input.channelResolution.requestedChannels],
    channelConfigurationVersion: input.channelResolution.configurationVersion,
    channelConfigurationRevision: input.channelResolution.configurationRevision,
    channelConfigurationDigestKeyId: input.channelResolution.configurationDigestKeyId,
    channelConfigurationDigest: input.channelResolution.configurationDigest,
    localePayloadDigest: input.localization.localePayloadDigest,
    createdAt: input.createdAt
  };
  return { ...unsigned, bindingDigest: bindingDigest(unsigned) };
}

export function parseShareDispatchBinding(value: unknown): ShareDispatchBindingV1 | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  if (typeof record.sessionIdentity !== "object" || record.sessionIdentity === null || Array.isArray(record.sessionIdentity)) {
    return null;
  }
  const identity = record.sessionIdentity as Record<string, unknown>;
  const requestedChannels = Array.isArray(record.requestedChannels)
    ? record.requestedChannels.filter((channel): channel is WorkpackDispatchChannel => (
        channel === "email" || channel === "sms" || channel === "kakao"
      ))
    : [];
  const binding = record as unknown as ShareDispatchBindingV1;
  if (
    binding.version !== "share-dispatch-binding/v1"
    || typeof identity.shareSessionId !== "string"
    || typeof identity.organizationId !== "string"
    || !(typeof identity.siteId === "string" || identity.siteId === null)
    || typeof identity.workpackId !== "string"
    || typeof identity.createdBy !== "string"
    || typeof binding.canonicalWorkpackRevision !== "string"
    || typeof binding.normalizedWorkpackDigest !== "string"
    || typeof binding.recipientSnapshotDigest !== "string"
    || requestedChannels.length !== (record.requestedChannels as unknown[]).length
    || typeof binding.channelConfigurationRevision !== "number"
    || typeof binding.channelConfigurationDigestKeyId !== "string"
    || typeof binding.channelConfigurationDigest !== "string"
    || typeof binding.localePayloadDigest !== "string"
    || typeof binding.createdAt !== "string"
    || typeof binding.bindingDigest !== "string"
  ) return null;
  const { bindingDigest: persistedDigest, ...unsigned } = binding;
  if (bindingDigest(unsigned) !== persistedDigest) return null;
  return { ...binding, requestedChannels };
}

export function validateShareDispatchBinding(input: {
  binding: unknown;
  sessionIdentity: ShareSessionIdentity;
  localization: ShareLocalizationBinding;
  recipientSnapshotDigest: string;
  channelResolution: ChannelAvailabilityResolution;
}): { ok: true; binding: ShareDispatchBindingV1 } | { ok: false; reasonCode: ShareDispatchBindingFailureReason } {
  const binding = parseShareDispatchBinding(input.binding);
  if (!binding) return { ok: false, reasonCode: "session_binding_missing_or_malformed" };
  if (canonicalShareJson(binding.sessionIdentity) !== canonicalShareJson(input.sessionIdentity)) {
    return { ok: false, reasonCode: "session_identity_mismatch" };
  }
  if (
    binding.canonicalWorkpackRevision !== input.localization.canonicalWorkpackRevision
    || binding.normalizedWorkpackDigest !== input.localization.normalizedWorkpackDigest
  ) {
    return { ok: false, reasonCode: "workpack_revision_or_digest_changed" };
  }
  if (binding.recipientSnapshotDigest !== input.recipientSnapshotDigest) {
    return { ok: false, reasonCode: "recipient_snapshot_changed" };
  }
  if (
    binding.channelConfigurationVersion !== input.channelResolution.configurationVersion
    || binding.channelConfigurationRevision !== input.channelResolution.configurationRevision
    || binding.channelConfigurationDigestKeyId !== input.channelResolution.configurationDigestKeyId
    || binding.channelConfigurationDigest !== input.channelResolution.configurationDigest
    || canonicalShareJson(binding.requestedChannels) !== canonicalShareJson(input.channelResolution.requestedChannels)
  ) {
    return { ok: false, reasonCode: "channel_configuration_changed" };
  }
  if (binding.localePayloadDigest !== input.localization.localePayloadDigest) {
    return { ok: false, reasonCode: "translation_incomplete" };
  }
  return { ok: true, binding };
}

function signTokenPayload(payload: AvailabilityTokenPayload, secret: string): string {
  return createHmac("sha256", secret).update(canonicalShareJson(payload)).digest("hex");
}

function encodeToken(payload: AvailabilityTokenPayload, secret: string): string {
  const encoded = Buffer.from(canonicalShareJson(payload), "utf8").toString("base64url");
  return `${encoded}.${signTokenPayload(payload, secret)}`;
}

function decodeToken(token: string): { payload: AvailabilityTokenPayload; signature: string } | null {
  const [encoded, signature, extra] = token.split(".");
  if (!encoded || !signature || extra || !/^[0-9a-f]{64}$/i.test(signature)) return null;
  try {
    const parsed: unknown = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8"));
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return null;
    return { payload: parsed as AvailabilityTokenPayload, signature };
  } catch (error) {
    console.warn("channel availability token parse failed", error);
    return null;
  }
}

function signatureMatches(expected: string, actual: string): boolean {
  if (!/^[0-9a-f]{64}$/i.test(expected) || !/^[0-9a-f]{64}$/i.test(actual)) return false;
  return timingSafeEqual(Buffer.from(expected, "hex"), Buffer.from(actual, "hex"));
}

function normalizedEndpoint(value: string | null): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    url.hash = "";
    url.hostname = url.hostname.toLowerCase();
    url.searchParams.sort();
    return url.toString();
  } catch {
    return value.trim() || null;
  }
}

function credentialFingerprint(secret: string, credential: string | null): string {
  return createHmac("sha256", secret).update(credential || "not-configured").digest("hex");
}

function channelConfigurationDigest(input: ChannelAvailabilityInput): string {
  const identity = {
    schema: "channel-configuration-identity/v2",
    dispatchMode: input.runtime.dispatchMode,
    relayProvider: input.runtime.relayProvider,
    relayEndpoint: normalizedEndpoint(input.runtime.relayEndpoint),
    relayConfigured: input.runtime.relayConfigured,
    providerCredentialFingerprint: credentialFingerprint(
      input.config.channelConfigurationBindingSecret,
      input.runtime.providerCredential
    ),
    persistentIdempotencyPolicyVersion: input.runtime.persistentIdempotencyPolicyVersion,
    persistentIdempotencySupported: input.runtime.persistentIdempotencySupported,
    channels: [{
      channel: "email",
      provider: input.runtime.relayProvider
    }, {
      channel: "sms",
      provider: input.runtime.relayProvider
    }, {
      channel: "kakao",
      provider: input.runtime.kakao.provider,
      senderId: input.runtime.kakao.senderId,
      templateId: input.runtime.kakao.templateId,
      templateVersion: input.runtime.kakao.templateVersion,
      approved: input.runtime.kakao.approved,
      enabled: input.runtime.kakao.enabled,
      credentialFingerprint: credentialFingerprint(
        input.config.channelConfigurationBindingSecret,
        input.runtime.kakao.credential
      )
    }]
  };
  return createHmac("sha256", input.config.channelConfigurationBindingSecret)
    .update(canonicalShareJson(identity))
    .digest("hex");
}

export function buildShareRecipientDigest(recipients: ShareRecipientInput[]): string {
  return sha256ShareValue([...recipients]
    .sort((left, right) => (left.workerId || "").localeCompare(right.workerId || ""))
    .map((recipient) => ({
      workerId: recipient.workerId,
      displayName: recipient.displayName,
      languageCode: recipient.languageCode,
      role: recipient.role,
      phone: recipient.workerSnapshot?.phone || null,
      email: recipient.workerSnapshot?.email || null
    })));
}

function hasContact(recipient: ShareRecipientInput, channel: WorkpackDispatchChannel): boolean {
  const value = channel === "email"
    ? recipient.workerSnapshot?.email
    : recipient.workerSnapshot?.phone;
  return typeof value === "string" && value.trim().length > 0;
}

function resolveChannel(input: ChannelAvailabilityInput, channel: WorkpackDispatchChannel): ResolvedChannel {
  const contactsReady = input.recipients.every((recipient) => hasContact(recipient, channel));
  if (!contactsReady) {
    return {
      channel,
      configured: true,
      approved: channel !== "kakao" || input.runtime.kakao.approved,
      available: false,
      recipientCount: input.recipients.length,
      reasonCode: "recipient_contact_missing",
      ownerRoute: "/settings"
    };
  }
  if (input.runtime.dispatchMode === "fixture") {
    return {
      channel,
      configured: false,
      approved: channel !== "kakao" || input.runtime.kakao.approved,
      available: false,
      recipientCount: input.recipients.length,
      reasonCode: "provider_unconfigured",
      ownerRoute: "/settings"
    };
  }
  if (input.runtime.dispatchMode === "live" && !input.runtime.persistentIdempotencySupported) {
    return {
      channel,
      configured: true,
      approved: channel !== "kakao" || input.runtime.kakao.approved,
      available: false,
      recipientCount: input.recipients.length,
      reasonCode: "idempotency_unsupported",
      ownerRoute: "/settings"
    };
  }
  if (input.runtime.dispatchMode === "live" && !input.runtime.relayConfigured) {
    return {
      channel,
      configured: false,
      approved: true,
      available: false,
      recipientCount: input.recipients.length,
      reasonCode: "relay_unconfigured",
      ownerRoute: "/settings"
    };
  }
  if (channel === "kakao") {
    const configured = Boolean(
      input.runtime.kakao.provider
      && input.runtime.kakao.senderId
      && input.runtime.kakao.templateId
    );
    const available = input.runtime.kakao.enabled && configured && input.runtime.kakao.approved;
    return {
      channel,
      configured,
      approved: input.runtime.kakao.approved,
      available,
      recipientCount: input.recipients.length,
      reasonCode: !input.runtime.kakao.enabled
        ? "policy_disabled"
        : !configured
          ? "provider_unconfigured"
          : !input.runtime.kakao.approved
            ? "template_unapproved"
            : "available",
      ownerRoute: "/settings"
    };
  }
  return {
    channel,
    configured: input.runtime.relayConfigured,
    approved: true,
    available: true,
    recipientCount: input.recipients.length,
    reasonCode: "available",
    ownerRoute: "/settings"
  };
}

function canonicalChannels(channels: WorkpackDispatchChannel[]): WorkpackDispatchChannel[] | null {
  if (!channels.length || new Set(channels).size !== channels.length) return null;
  if (channels.some((channel) => !CHANNEL_ORDER.includes(channel))) return null;
  return CHANNEL_ORDER.filter((channel) => channels.includes(channel));
}

export function resolveServerChannelAvailability(
  input: ChannelAvailabilityInput
): ChannelAvailabilityResolution | ChannelAvailabilityFailure {
  const requestedChannels = canonicalChannels(input.requestedChannels);
  if (!requestedChannels || !input.recipients.length || !Number.isFinite(input.now.getTime())) {
    return { ok: false, reasonCode: "channel_request_invalid" };
  }
  const resolvedAt = input.now.toISOString();
  const expiresAt = new Date(input.now.getTime() + TOKEN_TTL_MS).toISOString();
  const configurationDigest = channelConfigurationDigest(input);
  const payload: AvailabilityTokenPayload = {
    workpackId: input.workpackId,
    canonicalWorkpackRevision: input.canonicalWorkpackRevision,
    recipientDigest: buildShareRecipientDigest(input.recipients),
    requestedChannels,
    dispatchMode: input.runtime.dispatchMode,
    configurationVersion: "channel-configuration/v2",
    configurationRevision: input.config.channelConfigurationRevision,
    configurationDigestKeyId: input.config.channelConfigurationDigestKeyId,
    configurationDigest,
    resolvedAt,
    expiresAt
  };
  const channels = requestedChannels.map((channel) => resolveChannel(input, channel));
  return {
    ok: true,
    version: "channel-availability/v1",
    ...payload,
    channels,
    availabilityToken: encodeToken(payload, input.config.channelAvailabilitySecret),
    ready: channels.every((channel) => channel.available)
  };
}

export function verifyChannelAvailabilityToken(
  input: ChannelAvailabilityInput,
  token: string
): { ok: true; resolution: ChannelAvailabilityResolution } | ChannelAvailabilityFailure {
  const decoded = decodeToken(token);
  if (!decoded) return { ok: false, reasonCode: "availability_token_invalid" };
  const expectedSignature = signTokenPayload(decoded.payload, input.config.channelAvailabilitySecret);
  if (!signatureMatches(expectedSignature, decoded.signature)) {
    return { ok: false, reasonCode: "channel_configuration_changed" };
  }
  const expiresAt = Date.parse(decoded.payload.expiresAt);
  if (!Number.isFinite(expiresAt) || expiresAt <= input.now.getTime()) {
    return { ok: false, reasonCode: "availability_token_expired" };
  }
  const issuedAt = new Date(decoded.payload.resolvedAt);
  const current = resolveServerChannelAvailability({ ...input, now: issuedAt });
  if (!current.ok) return current;
  const currentPayload: AvailabilityTokenPayload = {
    workpackId: current.workpackId,
    canonicalWorkpackRevision: current.canonicalWorkpackRevision,
    recipientDigest: current.recipientDigest,
    requestedChannels: current.requestedChannels,
    dispatchMode: current.dispatchMode,
    configurationVersion: current.configurationVersion,
    configurationRevision: current.configurationRevision,
    configurationDigestKeyId: current.configurationDigestKeyId,
    configurationDigest: current.configurationDigest,
    resolvedAt: current.resolvedAt,
    expiresAt: current.expiresAt
  };
  if (canonicalShareJson(currentPayload) !== canonicalShareJson(decoded.payload)) {
    return { ok: false, reasonCode: "channel_configuration_changed" };
  }
  return { ok: true, resolution: current };
}
