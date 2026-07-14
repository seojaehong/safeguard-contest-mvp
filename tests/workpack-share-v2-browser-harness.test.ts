import type { SpawnSyncOptionsWithStringEncoding } from "node:child_process";

import { describe, expect, it, vi } from "vitest";

const taskkillFailure = vi.hoisted(() => ({
  failuresRemaining: 0,
  invocationCount: 0,
  processIds: [] as string[]
}));

vi.mock("node:child_process", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:child_process")>();
  return {
    ...actual,
    spawnSync: (
      command: string,
      args: readonly string[] | undefined,
      options: SpawnSyncOptionsWithStringEncoding
    ) => {
      if (command === "taskkill.exe") {
        taskkillFailure.invocationCount += 1;
        const processId = args?.[1];
        if (processId) taskkillFailure.processIds.push(processId);
      }
      if (command === "taskkill.exe" && taskkillFailure.failuresRemaining > 0) {
        taskkillFailure.failuresRemaining -= 1;
        return {
          pid: 0,
          output: [null, "", "Injected taskkill failure before termination"],
          stdout: "",
          stderr: "Injected taskkill failure before termination",
          status: 5,
          signal: null,
          error: undefined
        };
      }
      return actual.spawnSync(command, args ? [...args] : undefined, options);
    }
  };
});

import { startIsolatedNextBrowserHarness } from "./helpers/isolated-next-browser-harness";

describe.skipIf(process.platform !== "win32")("Share browser harness teardown", () => {
  async function forceCleanupRecordedProcesses(): Promise<void> {
    const actual = await vi.importActual<typeof import("node:child_process")>("node:child_process");
    for (const processId of new Set(taskkillFailure.processIds)) {
      actual.spawnSync("taskkill.exe", ["/PID", processId, "/T", "/F"], {
        encoding: "utf8",
        windowsHide: true
      });
    }
  }

  it("retries after an actual first taskkill failure and verifies the process tree and port are gone", async () => {
    const harness = await startIsolatedNextBrowserHarness({
      slug: "workpack-share-v2-teardown",
      initialPath: "/workspace?step=share&theme=day",
      portSalt: 17_207,
      mode: "dev",
      timeoutMs: 120_000,
      terminationTimeoutMs: 5_000
    });

    taskkillFailure.failuresRemaining = 1;
    taskkillFailure.invocationCount = 0;
    taskkillFailure.processIds = [];
    try {
      await expect(harness.stop()).resolves.toBeUndefined();
      expect(taskkillFailure.invocationCount).toBe(2);
      await expect(fetch(harness.baseUrl)).rejects.toThrow();
    } finally {
      taskkillFailure.failuresRemaining = 0;
      await forceCleanupRecordedProcesses();
    }
  }, 120_000);

  it("keeps teardown retryable after a bounded termination timeout and then cleans up", async () => {
    const harness = await startIsolatedNextBrowserHarness({
      slug: "workpack-share-v2-teardown-timeout",
      initialPath: "/workspace?step=share&theme=night",
      portSalt: 17_209,
      mode: "dev",
      timeoutMs: 120_000,
      terminationTimeoutMs: 600
    });

    taskkillFailure.failuresRemaining = 10;
    taskkillFailure.invocationCount = 0;
    taskkillFailure.processIds = [];
    try {
      await expect(harness.stop()).rejects.toThrow(/termination.*not verified|taskkill.*failed/iu);
      expect(taskkillFailure.invocationCount).toBeGreaterThanOrEqual(2);

      const attemptsAfterTimeout = taskkillFailure.invocationCount;
      taskkillFailure.failuresRemaining = 0;
      await expect(harness.stop()).resolves.toBeUndefined();
      expect(taskkillFailure.invocationCount).toBeGreaterThan(attemptsAfterTimeout);
      await expect(fetch(harness.baseUrl)).rejects.toThrow();
    } finally {
      taskkillFailure.failuresRemaining = 0;
      await forceCleanupRecordedProcesses();
    }
  }, 120_000);
});
