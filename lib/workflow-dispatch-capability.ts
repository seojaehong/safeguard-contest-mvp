export type ProviderDispatchChannel = "email" | "sms" | "kakao";

export type ProviderDispatchReason =
  | "persistent_idempotency_unavailable"
  | "live_dispatch_disabled"
  | "provider_configuration_unavailable"
  | "recipient_contact_unavailable";

export type ProviderDispatchChannelCapability = {
  capability: boolean;
  reason: ProviderDispatchReason | null;
};

export type ProviderDispatchCapability = {
  capability: boolean;
  mode: "preview_only" | "live";
  reason: ProviderDispatchReason | null;
  channels: Record<ProviderDispatchChannel, ProviderDispatchChannelCapability>;
};
