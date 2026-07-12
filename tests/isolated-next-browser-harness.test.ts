import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { startIsolatedNextBrowserHarness } from "./helpers/isolated-next-browser-harness";

const root = process.cwd();

describe("isolated next browser harness", () => {
  it("uses unique OS temp dist dirs, cleans them on stop, and releases the same port salt", async () => {
    const slug = "isolated-harness-cleanup";
    const portSalt = 14121;
    const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "safeclaw-isolated-harness-success-"));
    const legacyDistDirectory = path.join(root, ".next-browser-tests", `${slug}-${process.pid}`);
    let first: Awaited<ReturnType<typeof startIsolatedNextBrowserHarness>> | null = null;
    let second: Awaited<ReturnType<typeof startIsolatedNextBrowserHarness>> | null = null;

    try {
      first = await startIsolatedNextBrowserHarness({
        slug,
        initialPath: "/reports",
        portSalt,
        mode: "dev",
        tempRoot,
      });
      const firstBaseUrl = first.baseUrl;
      const firstTemporaryDirectory = first.temporaryDirectory;
      if (!firstTemporaryDirectory || !first.distDirectory) {
        throw new Error("Dev harness did not expose its temporary dist directory");
      }
      expect(path.dirname(firstTemporaryDirectory)).toBe(tempRoot);
      expect(first.distDirectory.startsWith(`${firstTemporaryDirectory}${path.sep}`)).toBe(true);
      expect(fs.existsSync(first.distDirectory)).toBe(true);
      expect(fs.existsSync(path.join(firstTemporaryDirectory, "source-next.config.mjs"))).toBe(true);
      expect(fs.readFileSync(path.join(firstTemporaryDirectory, "next.config.mjs"), "utf8"))
        .toContain("./source-next.config.mjs");
      expect(fs.existsSync(path.join(
        firstTemporaryDirectory,
        "evaluation",
        "sif-embedding-gate",
        "report.json"
      ))).toBe(true);
      expect(first.readServerOutput()).toContain("SAFECLAW_TEST_SERVER_READY");
      const routeResponses = await Promise.all(
        ["/documents?theme=day", "/workspace?theme=day", "/home?theme=day"]
          .map(async (route) => {
            const response = await fetch(`${firstBaseUrl}${route}`);
            return { route, response, body: await response.text() };
          })
      );
      for (const { route, response, body } of routeResponses) {
        expect(response.status, route).toBe(200);
        expect(body, route).not.toContain("Internal browser harness error");
      }
      await first.stop();
      first = null;
      expect(fs.existsSync(firstTemporaryDirectory)).toBe(false);

      second = await startIsolatedNextBrowserHarness({
        slug,
        initialPath: "/reports",
        portSalt,
        mode: "dev",
        tempRoot,
      });
      const secondTemporaryDirectory = second.temporaryDirectory;
      if (!secondTemporaryDirectory) throw new Error("Second dev harness did not expose its temporary directory");
      expect(second.baseUrl).toBe(firstBaseUrl);
      expect(secondTemporaryDirectory).not.toBe(firstTemporaryDirectory);
      await second.stop();
      second = null;
      expect(fs.existsSync(secondTemporaryDirectory)).toBe(false);
      expect(fs.existsSync(legacyDistDirectory)).toBe(false);
    } finally {
      await first?.stop();
      await second?.stop();
      fs.rmSync(legacyDistDirectory, { recursive: true, force: true });
      fs.rmSync(tempRoot, { recursive: true, force: true });
    }
  }, 120_000);

  it("cleans the unique temp dist dir when startup never becomes ready", async () => {
    const slug = "isolated-harness-startup-failure";
    const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "safeclaw-isolated-harness-failure-"));
    const legacyDistDirectory = path.join(root, ".next-browser-tests", `${slug}-${process.pid}`);
    let temporaryDirectory = "";

    try {
      await expect(startIsolatedNextBrowserHarness({
        slug,
        initialPath: "/reports-startup-must-fail",
        portSalt: 15121,
        mode: "dev",
        timeoutMs: 5_000,
        tempRoot,
        onTemporaryDirectory: (directory) => {
          temporaryDirectory = directory;
        },
      })).rejects.toThrow(/Timed out waiting|exited before readiness/u);

      expect(path.dirname(temporaryDirectory)).toBe(tempRoot);
      expect(fs.existsSync(temporaryDirectory)).toBe(false);
      expect(fs.readdirSync(tempRoot)).toEqual([]);
      expect(fs.existsSync(legacyDistDirectory)).toBe(false);
    } finally {
      fs.rmSync(legacyDistDirectory, { recursive: true, force: true });
      fs.rmSync(tempRoot, { recursive: true, force: true });
    }
  }, 30_000);
});
