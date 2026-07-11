import { spawn, spawnSync, type ChildProcessWithoutNullStreams } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { chromium, type Browser } from "playwright";

type ServerExit = {
  code: number | null;
  signal: NodeJS.Signals | null;
};

type HarnessOptions = {
  slug: string;
  initialPath: string;
  portSalt: number;
  timeoutMs?: number;
};

export type IsolatedNextBrowserHarness = {
  baseUrl: string;
  browser: Browser;
  stop: () => Promise<void>;
};

function resolveNextModule(): string {
  const candidates = [
    path.join(process.cwd(), "node_modules", "next"),
    path.resolve(process.cwd(), "..", "..", "node_modules", "next")
  ];
  const nextModule = candidates.find((candidate) => fs.existsSync(path.join(candidate, "package.json")));
  if (!nextModule) throw new Error(`Unable to locate Next.js. Checked: ${candidates.join(", ")}`);
  return nextModule;
}

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${label} timed out after ${timeoutMs}ms`)), timeoutMs);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error: unknown) => {
        clearTimeout(timer);
        reject(error);
      }
    );
  });
}

function stopProcessTree(server: ChildProcessWithoutNullStreams | null): void {
  const processId = server?.pid;
  if (!processId) return;
  if (process.platform === "win32") {
    spawnSync("taskkill.exe", ["/PID", String(processId), "/T", "/F"], {
      encoding: "utf8",
      windowsHide: true
    });
    return;
  }
  server.kill("SIGTERM");
}

export async function startIsolatedNextBrowserHarness(
  options: HarnessOptions
): Promise<IsolatedNextBrowserHarness> {
  if (!/^[a-z0-9-]+$/u.test(options.slug)) {
    throw new Error(`Invalid browser harness slug: ${options.slug}`);
  }

  const timeoutMs = options.timeoutMs ?? 90_000;
  const port = 20_000 + ((process.pid * 97 + options.portSalt) % 30_000);
  const baseUrl = `http://127.0.0.1:${port}`;
  const distDir = path.join(".next-browser-tests", `${options.slug}-${process.pid}`);
  const output: string[] = [];
  let serverExit: ServerExit | null = null;
  let ready = false;

  const serverScript = `
    const http = require("node:http");
    const imported = require(${JSON.stringify(resolveNextModule())});
    const createNextServer = imported.default || imported;
    const app = createNextServer({
      dev: true,
      dir: process.cwd(),
      hostname: "127.0.0.1",
      port: ${port},
      conf: { distDir: ${JSON.stringify(distDir)} }
    });
    let httpServer;
    async function shutdown() {
      if (httpServer) await new Promise((resolve) => httpServer.close(resolve));
      await app.close();
      process.exit(0);
    }
    process.on("SIGTERM", () => void shutdown());
    process.on("SIGINT", () => void shutdown());
    app.prepare()
      .then(() => {
        const handler = app.getRequestHandler();
        httpServer = http.createServer((request, response) => {
          handler(request, response).catch((error) => {
            console.error(error);
            if (!response.headersSent) response.statusCode = 500;
            response.end("Internal browser harness error");
          });
        });
        httpServer.on("error", (error) => {
          console.error(error);
          process.exit(1);
        });
        httpServer.listen(${port}, "127.0.0.1", () => console.log("SAFECLAW_TEST_SERVER_READY"));
      })
      .catch((error) => {
        console.error(error);
        process.exit(1);
      });
  `;

  const server = spawn(process.execPath, ["-e", serverScript], {
    cwd: process.cwd(),
    env: { ...process.env, NEXT_TELEMETRY_DISABLED: "1" },
    windowsHide: true
  });
  server.stdout.on("data", (chunk: Buffer) => {
    const value = chunk.toString();
    output.push(value);
    if (value.includes("SAFECLAW_TEST_SERVER_READY")) ready = true;
  });
  server.stderr.on("data", (chunk: Buffer) => output.push(chunk.toString()));
  server.on("exit", (code, signal) => {
    serverExit = { code, signal };
  });

  const startedAt = Date.now();
  try {
    while (Date.now() - startedAt < timeoutMs) {
      if (serverExit) {
        throw new Error(
          `Isolated Next server exited before readiness: ${JSON.stringify(serverExit)}\n${output.slice(-30).join("")}`
        );
      }
      if (ready) {
        try {
          const response = await fetch(`${baseUrl}${options.initialPath}`);
          if (response.ok) {
            const browser = await chromium.launch({ headless: true });
            const stop = async (): Promise<void> => {
              try {
                const contextClosures = browser.contexts().map((context) => context.close());
                await withTimeout(Promise.allSettled(contextClosures), 15_000, "Browser context cleanup");
                try {
                  await withTimeout(browser.close(), 10_000, "Browser cleanup");
                } catch (error) {
                  if (browser.isConnected()) throw error;
                }
              } finally {
                stopProcessTree(server);
                const absoluteDistDir = path.resolve(process.cwd(), distDir);
                const workspaceRoot = `${path.resolve(process.cwd())}${path.sep}`;
                if (!absoluteDistDir.startsWith(workspaceRoot)) {
                  throw new Error(`Refusing to remove unexpected test dist directory: ${absoluteDistDir}`);
                }
                fs.rmSync(absoluteDistDir, { recursive: true, force: true });
              }
            };
            return { baseUrl, browser, stop };
          }
        } catch (error) {
          if (serverExit) throw error;
        }
      }
      await delay(500);
    }
  } catch (error) {
    stopProcessTree(server);
    throw error;
  }

  stopProcessTree(server);
  throw new Error(`Timed out waiting for ${baseUrl}${options.initialPath}\n${output.slice(-30).join("")}`);
}
