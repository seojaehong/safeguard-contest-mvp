import { afterEach, describe, expect, it, vi } from "vitest";

const admission = vi.hoisted(() => ({ leaseHeld: false }));

vi.mock("@/lib/public-distributed-rate-limit", () => ({
  withPublicSafetyReferenceStatusAdmission: vi.fn(async (
    _request: Request,
    work: () => Promise<Response>,
  ) => {
    admission.leaseHeld = true;
    try {
      return await work();
    } finally {
      admission.leaseHeld = false;
    }
  }),
}));

import { withPublicStatusAdmission } from "@/lib/server/status-admission";

describe("public status admission lifecycle", () => {
  afterEach(() => {
    admission.leaseHeld = false;
    vi.useRealTimers();
  });

  it("aborts at the deadline and holds the lease until cancelled work settles", async () => {
    vi.useFakeTimers();
    let settle: () => void = () => undefined;
    const settleGate = new Promise<void>((resolve) => { settle = resolve; });
    let observedSignal: AbortSignal | undefined;
    const pending = withPublicStatusAdmission(
      new Request("https://www.safeclaw.kr/api/ontology/graph"),
      async (signal) => {
        observedSignal = signal;
        await settleGate;
        signal.throwIfAborted();
        return new Response("late");
      },
      { deadlineMs: 25 },
    );
    await vi.waitFor(() => expect(admission.leaseHeld).toBe(true));

    await vi.advanceTimersByTimeAsync(25);
    expect(observedSignal?.aborted).toBe(true);
    expect(admission.leaseHeld).toBe(true);
    settle();

    const response = await pending;
    expect(response.status).toBe(504);
    expect(admission.leaseHeld).toBe(false);
    await expect(response.json()).resolves.toMatchObject({ code: "PUBLIC_STATUS_DEADLINE_EXCEEDED" });
  });

  it("forwards caller cancellation into admitted work", async () => {
    const controller = new AbortController();
    let observedSignal: AbortSignal | undefined;
    const pending = withPublicStatusAdmission(
      new Request("https://www.safeclaw.kr/api/ontology/graph", { signal: controller.signal }),
      async (signal) => {
        observedSignal = signal;
        await new Promise<void>((_resolve, reject) => {
          signal.addEventListener("abort", () => reject(signal.reason), { once: true });
        });
        return new Response("unreachable");
      },
    );
    await vi.waitFor(() => expect(observedSignal).toBeInstanceOf(AbortSignal));

    controller.abort(new Error("client disconnected"));

    const response = await pending;
    expect(observedSignal?.aborted).toBe(true);
    expect(response.status).toBe(499);
    expect(admission.leaseHeld).toBe(false);
  });
});
