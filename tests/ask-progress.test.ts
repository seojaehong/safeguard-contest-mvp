import { describe, expect, test, vi } from "vitest";
import {
  formatSseEvent,
  safeEmit,
  attachProgressListeners,
  noopOnProgress,
  type AskProgressEvent
} from "@/lib/ask-progress";

describe("formatSseEvent", () => {
  test("formats a stage event as an SSE data line ending in a blank line", () => {
    const event: AskProgressEvent = { kind: "stage", stage: "weather", status: "start" };
    const line = formatSseEvent(event);
    expect(line.startsWith("data: ")).toBe(true);
    expect(line.endsWith("\n\n")).toBe(true);
  });

  test("round-trips through JSON", () => {
    const event: AskProgressEvent = { kind: "doc", name: "riskAssessment", status: "ok" };
    const line = formatSseEvent(event);
    const json = line.slice("data: ".length, -2);
    expect(JSON.parse(json)).toEqual(event);
  });

  test("formats a final event carrying an arbitrary payload", () => {
    const event: AskProgressEvent = { kind: "final", payload: { hello: "world" } };
    const line = formatSseEvent(event);
    const json = line.slice("data: ".length, -2);
    expect(JSON.parse(json)).toEqual(event);
  });
});

describe("safeEmit", () => {
  test("calls onProgress with the event", () => {
    const onProgress = vi.fn();
    safeEmit(onProgress, { kind: "stage", stage: "weather", status: "ok" });
    expect(onProgress).toHaveBeenCalledWith({ kind: "stage", stage: "weather", status: "ok" });
  });

  test("does not throw when onProgress itself throws", () => {
    const onProgress = vi.fn(() => {
      throw new Error("listener exploded");
    });
    expect(() => safeEmit(onProgress, { kind: "stage", stage: "weather", status: "ok" })).not.toThrow();
  });

  test("no-ops when onProgress is undefined", () => {
    expect(() => safeEmit(undefined, { kind: "stage", stage: "weather", status: "ok" })).not.toThrow();
  });
});

describe("noopOnProgress", () => {
  test("is callable and does nothing observable", () => {
    expect(() => noopOnProgress({ kind: "stage", stage: "x", status: "ok" })).not.toThrow();
  });
});

describe("attachProgressListeners", () => {
  test("emits start immediately then ok when a promise resolves", async () => {
    const events: AskProgressEvent[] = [];
    const onProgress = (e: AskProgressEvent) => events.push(e);
    const resolved = Promise.resolve("value");

    attachProgressListeners([{ stage: "weather", promise: resolved }], onProgress);

    expect(events).toEqual([{ kind: "stage", stage: "weather", status: "start" }]);
    await resolved.catch(() => {});
    // allow the .then listener microtask to flush
    await Promise.resolve();
    expect(events).toEqual([
      { kind: "stage", stage: "weather", status: "start" },
      { kind: "stage", stage: "weather", status: "ok" }
    ]);
  });

  test("emits a stable safe failure through SSE when a promise rejects with PII and a secret", async () => {
    const events: AskProgressEvent[] = [];
    const onProgress = (e: AskProgressEvent) => events.push(e);
    const rejected = Promise.reject(
      new Error("boom resident=900101-1234567 Authorization=Bearer secret-token")
    );

    attachProgressListeners([{ stage: "kosha", promise: rejected }], onProgress);

    await rejected.catch(() => {});
    await Promise.resolve();
    expect(events).toEqual([
      { kind: "stage", stage: "kosha", status: "start" },
      {
        kind: "stage",
        stage: "kosha",
        status: "fail",
        code: "ask_stage_failed",
        detail: "이 단계를 완료하지 못했습니다. 다음 단계는 계속 진행합니다."
      }
    ]);
    const sse = events.map(formatSseEvent).join("");
    expect(sse).not.toContain("900101-1234567");
    expect(sse).not.toContain("secret-token");
    expect(sse).not.toContain("boom");
  });

  test("handles a mixed batch independent of settlement order", async () => {
    const events: AskProgressEvent[] = [];
    const onProgress = (e: AskProgressEvent) => events.push(e);
    const ok = Promise.resolve(1);
    const fail = Promise.reject("string reason");

    attachProgressListeners(
      [
        { stage: "a", promise: ok },
        { stage: "b", promise: fail }
      ],
      onProgress
    );

    await Promise.allSettled([ok, fail]);
    await Promise.resolve();

    const starts = events.filter((e) => e.kind === "stage" && e.status === "start");
    const settles = events.filter((e) => e.kind === "stage" && e.status !== "start");
    expect(starts).toHaveLength(2);
    expect(settles).toHaveLength(2);
    expect(settles.find((e) => e.kind === "stage" && e.stage === "a")).toEqual({
      kind: "stage",
      stage: "a",
      status: "ok"
    });
    expect(settles.find((e) => e.kind === "stage" && e.stage === "b")).toEqual({
      kind: "stage",
      stage: "b",
      status: "fail",
      code: "ask_stage_failed",
      detail: "이 단계를 완료하지 못했습니다. 다음 단계는 계속 진행합니다."
    });
  });

  test("no-ops entirely when onProgress is undefined", () => {
    expect(() =>
      attachProgressListeners([{ stage: "x", promise: Promise.resolve(1) }], undefined)
    ).not.toThrow();
  });
});
