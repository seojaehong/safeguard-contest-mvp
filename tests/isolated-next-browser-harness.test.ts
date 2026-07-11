import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { startIsolatedNextBrowserHarness } from "./helpers/isolated-next-browser-harness";

const root = process.cwd();

describe("isolated next browser harness", () => {
  it("cleans the dev dist dir and releases the same port salt for the next run", async () => {
    const slug = "isolated-harness-cleanup";
    const portSalt = 14121;
    const distDirectory = path.join(root, ".next-browser-tests", `${slug}-${process.pid}`);

    const first = await startIsolatedNextBrowserHarness({
      slug,
      initialPath: "/reports",
      portSalt,
      mode: "dev",
    });
    const firstBaseUrl = first.baseUrl;
    await first.stop();
    expect(fs.existsSync(distDirectory)).toBe(false);

    const second = await startIsolatedNextBrowserHarness({
      slug,
      initialPath: "/reports",
      portSalt,
      mode: "dev",
    });
    expect(second.baseUrl).toBe(firstBaseUrl);
    await second.stop();
    expect(fs.existsSync(distDirectory)).toBe(false);
  }, 120_000);
});
