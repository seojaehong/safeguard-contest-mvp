import { describe, expect, it } from "vitest";

import { createLatestOnlyRequestGate } from "@/lib/request-version-guard";

describe("command center request lifecycle", () => {
  it("aborts the previous photo-analysis request when a newer 1-10 photo set starts", () => {
    const gate = createLatestOnlyRequestGate();

    const first = gate.begin();
    const second = gate.begin();

    expect(first.signal.aborted).toBe(true);
    expect(gate.isCurrent(first.requestId)).toBe(false);
    expect(second.signal.aborted).toBe(false);
    expect(gate.isCurrent(second.requestId)).toBe(true);
  });

  it("does not let a stale request finish clear the latest request guard", () => {
    const gate = createLatestOnlyRequestGate();

    const first = gate.begin();
    const second = gate.begin();
    gate.finish(first.requestId);

    expect(gate.isCurrent(second.requestId)).toBe(true);
    gate.finish(second.requestId);
    expect(gate.isCurrent(second.requestId)).toBe(false);
  });
});
