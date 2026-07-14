import { describe, expect, it } from "vitest";

import {
  buildServerDispatchGate,
  completeServerDispatchGate,
  parseServerDispatchGate,
  reserveServerDispatchGate
} from "@/lib/workpack-dispatch-gate";

const SESSION_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const WORKPACK_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const IDEMPOTENCY_KEY = "provider-dispatch-v1-44444444-4444-4444-8444-444444444444-deadbeef";
const RECEIPT_ID = "55555555-5555-4555-8555-555555555555";

describe("server dispatch gate", () => {
  it("binds a server-issued key to one session, workpack revision and channel set", () => {
    const gate = buildServerDispatchGate({
      shareSessionId: SESSION_ID,
      workpackId: WORKPACK_ID,
      canonicalWorkpackRevision: "a".repeat(64),
      requestedChannels: ["email", "sms"],
      idempotencyKey: IDEMPOTENCY_KEY,
      issuedAt: "2026-07-14T01:00:00.000Z"
    });

    expect(parseServerDispatchGate(gate)).toEqual(gate);
    expect(parseServerDispatchGate({ ...gate, workpackId: "forged" })).toBeNull();
    expect(parseServerDispatchGate({ ...gate, requestedChannels: ["sms", "email"] })).toBeNull();
  });

  it("permits one ready-to-reserved transition and binds the final evidence receipt", () => {
    const ready = buildServerDispatchGate({
      shareSessionId: SESSION_ID,
      workpackId: WORKPACK_ID,
      canonicalWorkpackRevision: "a".repeat(64),
      requestedChannels: ["email"],
      idempotencyKey: IDEMPOTENCY_KEY,
      issuedAt: "2026-07-14T01:00:00.000Z"
    });
    const reserved = reserveServerDispatchGate(ready, {
      idempotencyKey: IDEMPOTENCY_KEY,
      receiptId: RECEIPT_ID,
      reservedAt: "2026-07-14T01:01:00.000Z"
    });

    expect(reserved.ok).toBe(true);
    if (!reserved.ok) throw new Error("expected reservation");
    expect(reserveServerDispatchGate(reserved.gate, {
      idempotencyKey: IDEMPOTENCY_KEY,
      receiptId: "66666666-6666-4666-8666-666666666666",
      reservedAt: "2026-07-14T01:02:00.000Z"
    })).toEqual({ ok: false, reasonCode: "dispatch_already_reserved" });

    const recorded = completeServerDispatchGate(reserved.gate, {
      receiptId: RECEIPT_ID,
      outcome: "accepted",
      workflowRunId: "provider-run-1",
      logIds: ["77777777-7777-4777-8777-777777777777"],
      completedAt: "2026-07-14T01:03:00.000Z"
    });
    expect(recorded.ok).toBe(true);
    if (!recorded.ok) throw new Error("expected completion");
    expect(recorded.gate).toMatchObject({
      state: "recorded",
      receiptId: RECEIPT_ID,
      outcome: "accepted",
      workflowRunId: "provider-run-1",
      logIds: ["77777777-7777-4777-8777-777777777777"]
    });
    expect(completeServerDispatchGate(reserved.gate, {
      receiptId: "66666666-6666-4666-8666-666666666666",
      outcome: "accepted",
      workflowRunId: "provider-run-1",
      logIds: ["77777777-7777-4777-8777-777777777777"],
      completedAt: "2026-07-14T01:03:00.000Z"
    })).toEqual({ ok: false, reasonCode: "dispatch_receipt_mismatch" });
  });
});
