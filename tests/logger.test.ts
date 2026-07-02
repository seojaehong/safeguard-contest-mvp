import { describe, expect, test, vi, afterEach } from "vitest";
import { createLogger } from "@/lib/logger";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("createLogger", () => {
  test("error always logs with scope prefix and structured context", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const log = createLogger("ai-deliverables", { level: "info" });
    log.error("call failed", { model: "gemini-2.5-flash", attempt: 1 });
    expect(spy).toHaveBeenCalledTimes(1);
    const [line] = spy.mock.calls[0];
    expect(line).toContain("[ai-deliverables]");
    expect(line).toContain("call failed");
    expect(line).toContain("gemini-2.5-flash");
  });

  test("debug is suppressed at info level", () => {
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});
    const log = createLogger("search", { level: "info" });
    log.debug("noisy detail");
    expect(spy).not.toHaveBeenCalled();
  });

  test("debug logs at debug level", () => {
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});
    const log = createLogger("search", { level: "debug" });
    log.debug("noisy detail");
    expect(spy).toHaveBeenCalledTimes(1);
  });

  test("warn logs at info level", () => {
    const spy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const log = createLogger("search", { level: "info" });
    log.warn("degraded", { source: "kosha" });
    expect(spy).toHaveBeenCalledTimes(1);
  });

  test("accepts a raw Error as the second argument (console.error drop-in)", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const log = createLogger("ai", { level: "info" });
    log.error("chain failed", new Error("boom"));
    expect(spy.mock.calls[0][0]).toContain("boom");
  });

  test("serializes Error objects in context", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const log = createLogger("ai", { level: "info" });
    log.error("boom", { error: new Error("Vertex AI timeout after 45000ms") });
    expect(spy.mock.calls[0][0]).toContain("Vertex AI timeout after 45000ms");
  });
});
