import { afterEach, describe, expect, it, vi } from "vitest";

import { dispatchWithConfiguredProvider } from "@/lib/workflow-dispatch-provider";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("configured workflow dispatch provider", () => {
  it("accepts one strict receipt covering every requested channel", async () => {
    const fetcher = vi.fn(async () => new Response(JSON.stringify({
      ok: true,
      workflowRunId: "provider-run-1",
      channelResults: [
        { channel: "email", status: "sent", message: "queued" },
        { channel: "sms", status: "failed", message: "provider rejected" }
      ]
    }), { status: 200, headers: { "content-type": "application/json" } }));
    vi.stubGlobal("fetch", fetcher);

    const receipt = await dispatchWithConfiguredProvider({
      url: "https://n8n.example/webhook",
      token: "secret",
      requestedChannels: ["email", "sms"],
      payload: { receiptId: "55555555-5555-4555-8555-555555555555" }
    });

    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(receipt).toEqual({
      workflowRunId: "provider-run-1",
      providerStatus: "live",
      channelResults: [
        { channel: "email", provider: "n8n-relay", status: "sent", message: "queued" },
        { channel: "sms", provider: "n8n-relay", status: "failed", message: "provider rejected" }
      ]
    });
  });

  it.each([
    ["empty", ""],
    ["non-json", "accepted"],
    ["missing workflow id", JSON.stringify({ ok: true, channelResults: [{ channel: "email", status: "sent" }] })],
    ["missing channel", JSON.stringify({ ok: true, workflowRunId: "run", channelResults: [] })],
    ["unknown status", JSON.stringify({ ok: true, workflowRunId: "run", channelResults: [{ channel: "email", status: "unknown" }] })]
  ])("fails closed for %s provider evidence", async (_label, responseBody) => {
    const fetcher = vi.fn(async () => new Response(responseBody, { status: 200 }));
    vi.stubGlobal("fetch", fetcher);

    await expect(dispatchWithConfiguredProvider({
      url: "https://n8n.example/webhook",
      token: "secret",
      requestedChannels: ["email"],
      payload: { receiptId: "55555555-5555-4555-8555-555555555555" }
    })).rejects.toThrow("provider receipt");
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
});
