import { describe, expect, it } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import {
  fetchBufferWithBudget,
  readBoundedPositiveInteger,
  spawnWithBudget,
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

  it.runIf(process.platform === "win32")("terminates a Windows subprocess tree at the deadline", async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "safeclaw-process-tree-"));
    const markerPath = path.join(tempDir, "grandchild-survived.txt");
    const grandchildSource = `setTimeout(() => require("node:fs").writeFileSync(${JSON.stringify(markerPath)}, "survived"), 5000)`;
    const parentSource = [
      'const { spawn } = require("node:child_process");',
      `setTimeout(() => spawn(process.execPath, ["-e", ${JSON.stringify(grandchildSource)}], { stdio: "ignore" }), 450);`,
      "setTimeout(() => {}, 10000);",
    ].join("");

    try {
      const result = await spawnWithBudget(process.execPath, ["-e", parentSource], {}, {
        timeoutMs: 300,
        maxBufferBytes: 1024,
      });
      expect(result.error).toMatchObject({ code: "SMOKE_PROCESS_TIMEOUT" });
      await new Promise((resolve) => setTimeout(resolve, 5200));
      expect(fs.existsSync(markerPath)).toBe(false);
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  }, 15_000);

  it.runIf(process.platform === "win32")("terminates a Windows subprocess tree at the output ceiling", async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "safeclaw-process-output-tree-"));
    const markerPath = path.join(tempDir, "grandchild-survived.txt");
    const grandchildSource = `setTimeout(() => require("node:fs").writeFileSync(${JSON.stringify(markerPath)}, "survived"), 5000)`;
    const parentSource = [
      'const { spawn } = require("node:child_process");',
      `spawn(process.execPath, ["-e", ${JSON.stringify(grandchildSource)}], { stdio: "ignore" });`,
      'process.stdout.write("x".repeat(2048));',
      "setTimeout(() => {}, 10000);",
    ].join("");

    try {
      const result = await spawnWithBudget(process.execPath, ["-e", parentSource], {}, {
        timeoutMs: 10_000,
        maxBufferBytes: 64,
      });
      expect(result.error).toMatchObject({ code: "SMOKE_PROCESS_OUTPUT_BUDGET_EXCEEDED" });
      expect(Buffer.byteLength(result.stdout)).toBe(64);
      await new Promise((resolve) => setTimeout(resolve, 5200));
      expect(fs.existsSync(markerPath)).toBe(false);
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  }, 15_000);

  it.runIf(process.platform === "win32")("cleans descendants when output overflow is observed after the parent exits", async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "safeclaw-exited-parent-tree-"));
    const markerPath = path.join(tempDir, "grandchild-survived.txt");
    const grandchildSource = `setTimeout(() => require("node:fs").writeFileSync(${JSON.stringify(markerPath)}, "survived"), 5000)`;
    const parentSource = [
      'const { spawn } = require("node:child_process");',
      `spawn(process.execPath, ["-e", ${JSON.stringify(grandchildSource)}], { stdio: "ignore" });`,
      'process.stdout.write("x".repeat(2048));',
    ].join("");

    try {
      const result = await spawnWithBudget(process.execPath, ["-e", parentSource], {}, {
        timeoutMs: 10_000,
        maxBufferBytes: 64,
      });
      expect(result).toMatchObject({
        status: null,
        error: { code: "SMOKE_PROCESS_OUTPUT_BUDGET_EXCEEDED" },
      });
      await new Promise((resolve) => setTimeout(resolve, 5200));
      expect(fs.existsSync(markerPath)).toBe(false);
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  }, 15_000);

  it("preserves live stdout and stderr while bounding captured output", async () => {
    const streamed = [] as string[];
    const result = await spawnWithBudget(process.execPath, ["-e", 'process.stdout.write("out"); process.stderr.write("err")'], {}, {
      timeoutMs: 1_000,
      maxBufferBytes: 32,
      onStdout: (chunk) => streamed.push(`stdout:${chunk.toString("utf8")}`),
      onStderr: (chunk) => streamed.push(`stderr:${chunk.toString("utf8")}`),
    });

    expect(result).toMatchObject({ status: 0, stdout: "out", stderr: "err", error: null });
    expect(streamed).toEqual(expect.arrayContaining(["stdout:out", "stderr:err"]));
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
    const release = fs.readFileSync("scripts/final_release_closeout.mjs", "utf8");
    const reportsPublisher = fs.readFileSync("scripts/publish_reports_wave1_evidence.mjs", "utf8");
    const reportsSupport = fs.readFileSync("scripts/reports_wave1_publish_support.mjs", "utf8");

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
    expect(release).toContain("spawnWithBudget");
    expect(release).not.toMatch(/\bspawnSync\(/);
    expect(release).toContain("!result.error");
    expect(reportsPublisher).toContain("spawnWithBudget");
    expect(reportsPublisher).not.toMatch(/\bspawnSync\(/);
    expect(reportsPublisher).toContain("result.error || result.status !== 0");
    expect(reportsPublisher).toContain("onStdout");
    expect(reportsPublisher).toContain("onStderr");
    expect(reportsSupport).toContain("timeout: GIT_EXEC_TIMEOUT_MS");
    expect(reportsSupport).toContain("maxBuffer: GIT_EXEC_MAX_BUFFER_BYTES");
    expect(final99).toContain("maxBuffer: 8 * 1024 * 1024");
    expect(final99).toContain('killSignal: "SIGKILL"');
  });
});
