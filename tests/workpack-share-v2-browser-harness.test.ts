import type { SpawnSyncOptionsWithStringEncoding } from "node:child_process";

import { describe, expect, it, vi } from "vitest";

const taskkillFailure = vi.hoisted(() => ({
  enabled: false,
  invocationCount: 0
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
      const result = actual.spawnSync(command, args ? [...args] : undefined, options);
      if (command === "taskkill.exe" && taskkillFailure.enabled) {
        taskkillFailure.invocationCount += 1;
        return {
          ...result,
          status: 5,
          stderr: "Injected taskkill verification failure"
        };
      }
      return result;
    }
  };
});

import { startIsolatedNextBrowserHarness } from "./helpers/isolated-next-browser-harness";

describe.skipIf(process.platform !== "win32")("Share browser harness teardown", () => {
  it("rejects teardown when Windows process-tree termination is not verified", async () => {
    const harness = await startIsolatedNextBrowserHarness({
      slug: "workpack-share-v2-teardown",
      initialPath: "/workspace?step=share&theme=day",
      portSalt: 17_207,
      mode: "dev",
      timeoutMs: 120_000
    });

    taskkillFailure.enabled = true;
    try {
      await expect(harness.stop()).rejects.toThrow(/taskkill.*failed/iu);
      expect(taskkillFailure.invocationCount).toBe(1);
    } finally {
      taskkillFailure.enabled = false;
    }
  }, 120_000);
});
