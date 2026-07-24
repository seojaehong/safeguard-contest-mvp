import { describe, expect, it } from "vitest";

import {
  PROVIDER_DISPATCH_IDEMPOTENCY_SUPPORTED,
  resolveProviderDispatchCapability
} from "@/lib/server/workflow-dispatch-capability-policy";

describe("workflow dispatch capability policy", () => {
  it("keeps provider dispatch idempotency fail-closed until the persistence gate is approved", () => {
    expect(PROVIDER_DISPATCH_IDEMPOTENCY_SUPPORTED).toBe(false);
  });

  it("reports every channel as preview-only when persistent idempotency is unavailable", () => {
    expect(resolveProviderDispatchCapability({
      persistentIdempotencySupported: false,
      liveDispatchEnabled: true,
      channels: {
        email: { providerConfigured: true, contactReadiness: "request_scoped" },
        sms: { providerConfigured: true, contactReadiness: "request_scoped" },
        kakao: { providerConfigured: true, contactReadiness: "request_scoped" }
      }
    })).toEqual({
      capability: false,
      mode: "preview_only",
      reason: "persistent_idempotency_unavailable",
      channels: {
        email: { capability: false, reason: "persistent_idempotency_unavailable" },
        sms: { capability: false, reason: "persistent_idempotency_unavailable" },
        kakao: { capability: false, reason: "persistent_idempotency_unavailable" }
      }
    });
  });

  it("preserves a contact-specific reason when configured providers have no ready recipients", () => {
    expect(resolveProviderDispatchCapability({
      persistentIdempotencySupported: true,
      liveDispatchEnabled: true,
      channels: {
        email: { providerConfigured: true, contactReadiness: "unavailable" },
        sms: { providerConfigured: true, contactReadiness: "unavailable" },
        kakao: { providerConfigured: true, contactReadiness: "unavailable" }
      }
    })).toEqual({
      capability: false,
      mode: "preview_only",
      reason: "recipient_contact_unavailable",
      channels: {
        email: { capability: false, reason: "recipient_contact_unavailable" },
        sms: { capability: false, reason: "recipient_contact_unavailable" },
        kakao: { capability: false, reason: "recipient_contact_unavailable" }
      }
    });
  });
});
