import "server-only";

import type {
  ProviderDispatchCapability,
  ProviderDispatchChannel,
  ProviderDispatchChannelCapability,
  ProviderDispatchReason
} from "@/lib/workflow-dispatch-capability";

type ChannelPolicySignals = {
  providerConfigured: boolean;
  contactReadiness: "ready" | "request_scoped" | "unavailable";
};

export type ProviderDispatchPolicyInput = {
  persistentIdempotencySupported: boolean;
  liveDispatchEnabled: boolean;
  channels: Record<ProviderDispatchChannel, ChannelPolicySignals>;
};

const CHANNELS: ProviderDispatchChannel[] = ["email", "sms", "kakao"];

export const PROVIDER_DISPATCH_IDEMPOTENCY_SUPPORTED = false;

function blockedChannels(reason: ProviderDispatchReason): ProviderDispatchCapability["channels"] {
  return Object.fromEntries(CHANNELS.map((channel) => [
    channel,
    { capability: false, reason }
  ])) as ProviderDispatchCapability["channels"];
}

function resolveChannelCapability(signals: ChannelPolicySignals): ProviderDispatchChannelCapability {
  if (!signals.providerConfigured) {
    return { capability: false, reason: "provider_configuration_unavailable" };
  }
  if (signals.contactReadiness === "unavailable") {
    return { capability: false, reason: "recipient_contact_unavailable" };
  }
  return { capability: true, reason: null };
}

export function resolveProviderDispatchCapability(
  input: ProviderDispatchPolicyInput
): ProviderDispatchCapability {
  if (!input.persistentIdempotencySupported) {
    return {
      capability: false,
      mode: "preview_only",
      reason: "persistent_idempotency_unavailable",
      channels: blockedChannels("persistent_idempotency_unavailable")
    };
  }
  if (!input.liveDispatchEnabled) {
    return {
      capability: false,
      mode: "preview_only",
      reason: "live_dispatch_disabled",
      channels: blockedChannels("live_dispatch_disabled")
    };
  }

  const channels = Object.fromEntries(CHANNELS.map((channel) => [
    channel,
    resolveChannelCapability(input.channels[channel])
  ])) as ProviderDispatchCapability["channels"];
  const capability = CHANNELS.some((channel) => channels[channel].capability);
  const reason = capability
    ? null
    : CHANNELS.map((channel) => channels[channel].reason).find((value) => value !== null)
      ?? "provider_configuration_unavailable";
  return {
    capability,
    mode: capability ? "live" : "preview_only",
    reason,
    channels
  };
}
