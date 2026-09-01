import { describe, expect, it } from "vitest";
import fs from "node:fs";

import {
  fetchBufferWithBudget,
  readBoundedPositiveInteger,
  spawnSyncWithBudget,
} from "@/scripts/operator_smoke_resource_budget.mjs";

describe("operator smoke resource budgets", () => {
  it("fails closed when a streamed response exceeds the byte ceiling", async () => {
    const fetchImpl = async () => new Response(new Uint8Array(33), {
      headers: { "content-length": "33" },
    });

    await expect(fetchBufferWithBudget("https://example.invalid", {}, {
      maxBytes: 32,
      timeoutMs: 1_000,
      fetchImpl,
    })).rejects.toMatchObject({
      code: "SMOKE_RESPONSE_BUDGET_EXCEEDED",
    });
  });

  it("fails closed when an undeclared streamed response exceeds the byte ceiling", async () => {
    const fetchImpl = async () => new Response(new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new Uint8Array(16));
        controller.enqueue(new Uint8Array(17));
        controller.close();
      },
    }));

    await expect(fetchBufferWithBudget("https://example.invalid", {}, {
      maxBytes: 32,
      timeoutMs: 1_000,
      fetchImpl,
    })).rejects.toMatchObject({
      code: "SMOKE_RESPONSE_BUDGET_EXCEEDED",
    });
  });

  it("aborts a request that exceeds its deadline", async () => {
    const fetchImpl = async (_url: string | URL | Request, init?: RequestInit) => await new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener("abort", () => reject(init.signal?.reason), { once: true });
    });

    await expect(fetchBufferWithBudget("https://example.invalid", {}, {
      maxBytes: 32,
      timeoutMs: 10,
      fetchImpl,
    })).rejects.toMatchObject({
      code: "SMOKE_REQUEST_TIMEOUT",
    });
  });

  it("keeps the deadline active while a response body stalls", async () => {
    const fetchImpl = async (_url: string | URL | Request, init?: RequestInit) => new Response(
      new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(new Uint8Array([123]));
          init?.signal?.addEventListener("abort", () => controller.error(init.signal?.reason), { once: true });
        },
      }),
    );

    await expect(fetchBufferWithBudget("https://example.invalid", {}, {
      maxBytes: 32,
      timeoutMs: 10,
      fetchImpl,
    })).rejects.toMatchObject({
      code: "SMOKE_REQUEST_TIMEOUT",
    });
  });

  it("terminates a child process that outlives the smoke deadline", () => {
    const result = spawnSyncWithBudget(process.execPath, ["-e", "setTimeout(() => {}, 10000)"], {
      encoding: "utf8",
    }, {
      timeoutMs: 50,
      maxBufferBytes: 1024,
    });

    expect(result.error).toMatchObject({ code: "ETIMEDOUT" });
  });

  it("bounds operator-provided numeric overrides", () => {
    expect(readBoundedPositiveInteger("0", 30, { max: 100 })).toBe(30);
    expect(readBoundedPositiveInteger("500", 30, { max: 100 })).toBe(100);
    expect(readBoundedPositiveInteger("50", 30, { max: 100 })).toBe(50);
  });

  it("keeps every orchestration smoke edge on the shared resource budget", () => {
    const orchestration = fs.readFileSync("scripts/prod_orchestration_download_smoke.mjs", "utf8");
    const matrix = fs.readFileSync("scripts/final_e2e_matrix_runner.mjs", "utf8");
    const integrity = fs.readFileSync("scripts/final_output_integrity_audit.mjs", "utf8");
    const submission = fs.readFileSync("scripts/submission_readiness_smoke.mjs", "utf8");
    const final99 = fs.readFileSync("scripts/final_99_gate_runner.mjs", "utf8");

    expect(orchestration).toContain("fetchBufferWithBudget");
    expect(orchestration).toContain("spawnSyncWithBudget");
    expect(orchestration).toContain("fs.rmSync(userDataDir, { recursive: true, force: true })");
    expect(matrix).toContain("fetchBufferWithBudget");
    expect(matrix).toContain("spawnSyncWithBudget");
    expect(integrity).toContain('fetchBufferWithBudget(`${baseUrl}${route}`, init)');
    expect(integrity).not.toMatch(/\bfetch\(/);
    expect(integrity).not.toContain("response.text()");
    expect(integrity).toContain('new TextDecoder().decode(buffer)');
    expect(integrity).toContain("spawnSyncWithBudget");
    expect(submission).toContain("spawnSyncWithBudget");
    expect(final99).toContain("maxBuffer: 8 * 1024 * 1024");
    expect(final99).toContain('killSignal: "SIGKILL"');
  });
});
