import "server-only";

import { isLiveDispatchEnabled, resolveWebhookConfig } from "@/lib/n8n-webhook";
import {
  PROVIDER_DISPATCH_IDEMPOTENCY_SUPPORTED,
  resolveProviderDispatchCapability
} from "@/lib/server/workflow-dispatch-capability-policy";
import type { ProviderDispatchReason } from "@/lib/workflow-dispatch-capability";

export type BriefingEmailDispatchStatus = {
  emailReady: boolean;
  mode: "live" | "preview_only";
  reason: ProviderDispatchReason | null;
};

type BriefingDispatchSignals = {
  liveDispatchEnabled: boolean;
  relayConfigured: boolean;
};

export function resolveBriefingEmailDispatchStatus(
  signals?: BriefingDispatchSignals
): BriefingEmailDispatchStatus {
  const webhookConfig = signals ? null : resolveWebhookConfig();
  const relayConfigured = signals?.relayConfigured
    ?? Boolean(webhookConfig?.url && webhookConfig.token);
  const liveDispatchEnabled = signals?.liveDispatchEnabled
    ?? isLiveDispatchEnabled();
  const capability = resolveProviderDispatchCapability({
    persistentIdempotencySupported: PROVIDER_DISPATCH_IDEMPOTENCY_SUPPORTED,
    liveDispatchEnabled,
    channels: {
      email: { providerConfigured: relayConfigured, contactReadiness: "request_scoped" },
      sms: { providerConfigured: relayConfigured, contactReadiness: "request_scoped" },
      kakao: { providerConfigured: relayConfigured, contactReadiness: "request_scoped" }
    }
  });

  return {
    emailReady: capability.channels.email.capability,
    mode: capability.mode,
    reason: capability.channels.email.reason
  };
}
