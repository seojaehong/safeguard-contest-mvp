import fs from "node:fs";
import { createServer, type Server } from "node:net";
import os from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { startIsolatedNextBrowserHarness } from "./helpers/isolated-next-browser-harness";

const root = process.cwd();

function closeServer(server: Server): Promise<void> {
  return new Promise((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
  });
}

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
      const routeContracts = [
        { route: "/documents?theme=day", selector: ".safeclaw-module-shell[data-ready='true']" },
        { route: "/workspace?theme=day", selector: ".command-center-shell" },
        { route: "/home?theme=day", selector: ".safeclaw-module-shell[data-ready='true']" }
      ];
      for (const { route } of routeContracts) {
        const response = await fetch(`${firstBaseUrl}${route}`);
        expect(response.status, `warm ${route}`).toBe(200);
      }
      const routeResults = await Promise.all(
        routeContracts.map(async ({ route, selector }) => {
          const page = await first!.browser.newPage({ viewport: { width: 1280, height: 800 } });
          const runtimeErrors: string[] = [];
          page.on("pageerror", (error) => runtimeErrors.push(error.stack ?? error.message));
          try {
            const response = await page.goto(`${firstBaseUrl}${route}`, { waitUntil: "networkidle" });
            await page.locator(selector).waitFor({ state: "attached" });
            return {
              route,
              status: response?.status() ?? 0,
              runtimeErrors,
              body: (await page.locator("body").innerText()).slice(0, 2_000)
            };
          } finally {
            await page.close();
          }
        })
      );
      for (const { route, status, runtimeErrors, body } of routeResults) {
        expect(status, route).toBe(200);
        expect(runtimeErrors, route).toEqual([]);
        expect(body, route).not.toContain("Internal browser harness error");
      }
      expect(first.readServerOutput()).not.toContain("EADDRINUSE");
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

  it("retries with a new port when the probed port is claimed before Next starts", async () => {
    const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "safeclaw-isolated-harness-port-race-"));
    const temporaryDirectories: string[] = [];
    const attempts: number[] = [];
    let blocker: Server | null = null;
    let harness: Awaited<ReturnType<typeof startIsolatedNextBrowserHarness>> | null = null;

    try {
      harness = await startIsolatedNextBrowserHarness({
        slug: "isolated-harness-port-race",
        initialPath: "/reports",
        portSalt: 16121,
        mode: "dev",
        tempRoot,
        onTemporaryDirectory: (directory) => temporaryDirectories.push(directory),
        beforeServerStart: async (port, attempt) => {
          attempts.push(attempt);
          if (attempt === 0) {
            blocker = createServer();
            await new Promise<void>((resolve, reject) => {
              blocker?.once("error", reject);
              blocker?.listen(port, "127.0.0.1", resolve);
            });
            return;
          }
          if (blocker) {
            await closeServer(blocker);
            blocker = null;
          }
        }
      });

      expect(attempts.slice(0, 2)).toEqual([0, 1]);
      expect(temporaryDirectories).toHaveLength(2);
      expect(fs.existsSync(temporaryDirectories[0])).toBe(false);
      expect((await fetch(`${harness.baseUrl}/reports`)).status).toBe(200);
    } finally {
      await harness?.stop();
      if (blocker) await closeServer(blocker);
      fs.rmSync(tempRoot, { recursive: true, force: true });
    }
  }, 120_000);
});
