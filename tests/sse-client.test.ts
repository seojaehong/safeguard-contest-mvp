import { describe, expect, test } from "vitest";
import { parseSseChunk } from "@/lib/sse-client";
import { formatSseEvent, type AskProgressEvent } from "@/lib/ask-progress";

describe("parseSseChunk", () => {
  test("parses a single complete frame delivered in one chunk", () => {
    const event: AskProgressEvent = { kind: "stage", stage: "weather", status: "start" };
    const { events, rest } = parseSseChunk("", formatSseEvent(event));
    expect(events).toEqual([event]);
    expect(rest).toBe("");
  });

  test("parses multiple events delivered in a single chunk", () => {
    const e1: AskProgressEvent = { kind: "stage", stage: "weather", status: "start" };
    const e2: AskProgressEvent = { kind: "stage", stage: "weather", status: "ok" };
    const e3: AskProgressEvent = { kind: "doc", name: "riskAssessment", status: "ok" };
    const chunk = formatSseEvent(e1) + formatSseEvent(e2) + formatSseEvent(e3);
    const { events, rest } = parseSseChunk("", chunk);
    expect(events).toEqual([e1, e2, e3]);
    expect(rest).toBe("");
  });

  test("holds back an event split across a chunk boundary until it completes", () => {
    const event: AskProgressEvent = { kind: "stage", stage: "kosha", status: "ok" };
    const frame = formatSseEvent(event);
    const splitPoint = Math.floor(frame.length / 2);
    const first = frame.slice(0, splitPoint);
    const second = frame.slice(splitPoint);

    const firstResult = parseSseChunk("", first);
    expect(firstResult.events).toEqual([]);
    expect(firstResult.rest).toBe(first);

    const secondResult = parseSseChunk(firstResult.rest, second);
    expect(secondResult.events).toEqual([event]);
    expect(secondResult.rest).toBe("");
  });

  test("holds back incomplete JSON (no closing brace yet) without throwing", () => {
    const { events, rest } = parseSseChunk("", 'data: {"kind":"stage","stage":"weather"');
    expect(events).toEqual([]);
    expect(rest).toBe('data: {"kind":"stage","stage":"weather"');
  });

  test("skips a complete but malformed JSON frame instead of throwing", () => {
    const good: AskProgressEvent = { kind: "stage", stage: "response", status: "ok" };
    const chunk = "data: {not-json}\n\n" + formatSseEvent(good);
    expect(() => parseSseChunk("", chunk)).not.toThrow();
    const { events, rest } = parseSseChunk("", chunk);
    expect(events).toEqual([good]);
    expect(rest).toBe("");
  });

  test("ignores blank lines and non-data frames", () => {
    const { events, rest } = parseSseChunk("", "\n\n: comment\n\n");
    expect(events).toEqual([]);
    expect(rest).toBe("");
  });

  test("round-trips a final event carrying an arbitrary payload", () => {
    const event: AskProgressEvent = { kind: "final", payload: { status: { summary: "정상" } } };
    const { events } = parseSseChunk("", formatSseEvent(event));
    expect(events).toEqual([event]);
  });
});
