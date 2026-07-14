import { spawn, spawnSync, type ChildProcessWithoutNullStreams } from "node:child_process";
import fs from "node:fs";
import { createServer } from "node:net";
import os from "node:os";
import path from "node:path";
import { chromium, type Browser } from "playwright";

type ServerExit = {
  code: number | null;
  signal: NodeJS.Signals | null;
};

const MAX_SERVER_OUTPUT_CHARS = 20_000;
const MAX_PORT_BIND_ATTEMPTS = 8;
const WINDOWS_TERMINATION_ATTEMPTS = 2;

type HarnessOptions = {
  slug: string;
  initialPath: string;
  portSalt: number;
  mode?: "dev" | "prod";
  timeoutMs?: number;
  terminationTimeoutMs?: number;
  tempRoot?: string;
  makeTempDirectory?: (prefix: string) => string;
  onTemporaryDirectory?: (directory: string) => void;
  beforeServerStart?: (port: number, attempt: number) => void | Promise<void>;
  environment?: Readonly<Record<string, string | undefined>>;
};

export type IsolatedNextBrowserHarness = {
  baseUrl: string;
  browser: Browser;
  mode: "dev" | "prod";
  temporaryDirectory?: string;
  distDirectory?: string;
  readServerOutput: () => string;
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

function probeLoopbackPort(port: number): Promise<number | null> {
  return new Promise((resolve, reject) => {
    const probe = createServer();
    probe.unref();
    probe.once("error", (error: NodeJS.ErrnoException) => {
      if (error.code === "EACCES" || error.code === "EADDRINUSE") {
        resolve(null);
        return;
      }
      reject(error);
    });
    probe.listen(port, "127.0.0.1", () => {
      const address = probe.address();
      const selectedPort = typeof address === "object" && address ? address.port : null;
      probe.close((error) => error ? reject(error) : resolve(selectedPort));
    });
  });
}

async function resolveLoopbackPort(preferredPort: number): Promise<number> {
  for (let offset = 0; offset < 512; offset += 1) {
    const candidate = 20_000 + ((preferredPort - 20_000 + offset) % 20_000);
    const available = await probeLoopbackPort(candidate);
    if (available !== null) return available;
  }
  const fallback = await probeLoopbackPort(0);
  if (fallback === null) throw new Error("Unable to allocate an isolated Next.js loopback port");
  return fallback;
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

function processIsAlive(server: ChildProcessWithoutNullStreams, processId: number): boolean {
  if (server.exitCode !== null || server.signalCode !== null) return false;
  try {
    process.kill(processId, 0);
    return true;
  } catch (error) {
    return (error as NodeJS.ErrnoException).code !== "ESRCH";
  }
}

async function terminationIsVerified(
  server: ChildProcessWithoutNullStreams,
  processId: number,
  port: number
): Promise<boolean> {
  return !processIsAlive(server, processId) && await probeLoopbackPort(port) !== null;
}

async function waitForTerminationVerification(
  server: ChildProcessWithoutNullStreams,
  processId: number,
  port: number,
  deadline: number
): Promise<boolean> {
  do {
    if (await terminationIsVerified(server, processId, port)) return true;
    const remaining = deadline - Date.now();
    if (remaining <= 0) return false;
    await delay(Math.min(100, remaining));
  } while (Date.now() <= deadline);
  return await terminationIsVerified(server, processId, port);
}

async function stopProcessTree(
  server: ChildProcessWithoutNullStreams | null,
  port: number,
  timeoutMs: number
): Promise<void> {
  const processId = server?.pid;
  if (!server || !processId) return;
  const deadline = Date.now() + timeoutMs;
  if (await terminationIsVerified(server, processId, port)) return;
  if (process.platform === "win32") {
    const diagnostics: string[] = [];
    for (let attempt = 1; attempt <= WINDOWS_TERMINATION_ATTEMPTS; attempt += 1) {
      const result = spawnSync("taskkill.exe", ["/PID", String(processId), "/T", "/F"], {
        encoding: "utf8",
        windowsHide: true
      });
      const detail = `${result.stdout ?? ""}\n${result.stderr ?? ""}`.trim() || "no taskkill output";
      diagnostics.push(
        `attempt=${attempt} status=${String(result.status)} error=${result.error?.message || "none"} output=${detail}`
      );
      const remaining = deadline - Date.now();
      if (remaining <= 0) break;
      const verificationDeadline = result.error || result.status !== 0
        ? Math.min(deadline, Date.now() + 150)
        : deadline;
      if (await waitForTerminationVerification(server, processId, port, verificationDeadline)) return;
    }
    if (Date.now() < deadline && await waitForTerminationVerification(server, processId, port, deadline)) return;
    if (await terminationIsVerified(server, processId, port)) return;
    const processAlive = processIsAlive(server, processId);
    const portReleased = await probeLoopbackPort(port) !== null;
    throw new Error(
      `Windows process-tree termination not verified for browser harness PID ${processId} on port ${port} after ${timeoutMs}ms; processAlive=${processAlive}; portReleased=${portReleased}; ${diagnostics.join(" | ")}`
    );
  }
  const exited = new Promise<void>((resolve) => server.once("exit", () => resolve()));
  server.kill("SIGTERM");
  await Promise.race([exited, delay(Math.min(5_000, Math.max(0, deadline - Date.now())))]);
  if (server.exitCode === null && server.signalCode === null) {
    server.kill("SIGKILL");
    await Promise.race([exited, delay(Math.min(5_000, Math.max(0, deadline - Date.now())))]);
  }
  if (!await waitForTerminationVerification(server, processId, port, deadline)) {
    throw new Error(`Process-tree termination not verified for browser harness PID ${processId} on port ${port}`);
  }
}

async function startIsolatedNextBrowserHarnessAttempt(
  options: HarnessOptions,
  attempt: number
): Promise<IsolatedNextBrowserHarness> {
  if (!/^[a-z0-9-]+$/u.test(options.slug)) {
    throw new Error(`Invalid browser harness slug: ${options.slug}`);
  }

  const timeoutMs = options.timeoutMs ?? 90_000;
  const mode = options.mode ?? "dev";
  const preferredPort = 20_000 + ((process.pid * 97 + options.portSalt + attempt) % 20_000);
  const port = await resolveLoopbackPort(preferredPort);
  await options.beforeServerStart?.(port, attempt);
  const baseUrl = `http://127.0.0.1:${port}`;
  let serverOutput = "";
  let serverExit: ServerExit | null = null;
  let ready = false;
  const nextModule = resolveNextModule();
  let tempPaths: {
    root: string;
    temporaryDirectory: string;
    distDirectory: string;
  } | null = null;

  const cleanupTemporaryDirectory = (): void => {
    if (!tempPaths) return;
    const { root: tempRoot, temporaryDirectory } = tempPaths;
    if (
      path.dirname(temporaryDirectory) !== tempRoot
      || !path.basename(temporaryDirectory).startsWith(`safeclaw-next-${options.slug}-`)
    ) {
      throw new Error(`Refusing to remove unexpected browser harness temp directory: ${temporaryDirectory}`);
    }
    fs.rmSync(temporaryDirectory, { recursive: true, force: true });
  };

  const cleanupTemporaryDirectoryAfterTermination = async (): Promise<void> => {
    for (let attempt = 1; attempt <= 5; attempt += 1) {
      try {
        cleanupTemporaryDirectory();
        return;
      } catch (error) {
        const code = (error as NodeJS.ErrnoException).code;
        if (attempt === 5 || (code !== "EPERM" && code !== "EBUSY" && code !== "ENOTEMPTY")) throw error;
        await delay(attempt * 100);
      }
    }
  };

  const appendServerOutput = (value: string): void => {
    serverOutput = `${serverOutput}${value}`.slice(-MAX_SERVER_OUTPUT_CHARS);
  };

  if (mode === "dev") {
    const systemTempRoot = path.resolve(os.tmpdir());
    const tempRoot = path.resolve(options.tempRoot ?? systemTempRoot);
    if (tempRoot !== systemTempRoot && !tempRoot.startsWith(`${systemTempRoot}${path.sep}`)) {
      throw new Error(`Browser harness temp root must be under the OS temp directory: ${tempRoot}`);
    }
    if (!fs.existsSync(tempRoot) || !fs.statSync(tempRoot).isDirectory()) {
      throw new Error(`Browser harness temp root is missing: ${tempRoot}`);
    }
    const prefixName = `safeclaw-next-${options.slug}-`;
    const makeTempDirectory = options.makeTempDirectory ?? fs.mkdtempSync;
    const temporaryDirectory = path.resolve(makeTempDirectory(path.join(tempRoot, prefixName)));
    if (path.dirname(temporaryDirectory) !== tempRoot || !path.basename(temporaryDirectory).startsWith(prefixName)) {
      throw new Error(`Browser harness created an unexpected temp directory: ${temporaryDirectory}`);
    }
    const distDirectory = path.join(temporaryDirectory, "dist");
    tempPaths = { root: tempRoot, temporaryDirectory, distDirectory };
    try {
      const sourceRoot = process.cwd();
      const directoryLinkType = process.platform === "win32" ? "junction" : "dir";
      const copiedDirectories = ["app", "components", "data", "lib", "types"];
      for (const relativeDirectory of copiedDirectories) {
        const sourceDirectory = path.join(sourceRoot, relativeDirectory);
        if (fs.existsSync(sourceDirectory)) {
          fs.cpSync(sourceDirectory, path.join(temporaryDirectory, relativeDirectory), { recursive: true });
        }
      }
      for (const directoryName of ["evaluation", "knowledge", "node_modules", "public", "templates"]) {
        const sourceDirectory = path.join(sourceRoot, directoryName);
        if (fs.existsSync(sourceDirectory)) {
          fs.symlinkSync(sourceDirectory, path.join(temporaryDirectory, directoryName), directoryLinkType);
        }
      }
      for (const fileName of ["package.json", "tsconfig.json", "next-env.d.ts"]) {
        const sourceFile = path.join(sourceRoot, fileName);
        if (fs.existsSync(sourceFile)) fs.copyFileSync(sourceFile, path.join(temporaryDirectory, fileName));
      }
      fs.copyFileSync(
        path.join(sourceRoot, "next.config.mjs"),
        path.join(temporaryDirectory, "source-next.config.mjs")
      );
      fs.writeFileSync(
        path.join(temporaryDirectory, "next.config.mjs"),
        `import sourceConfig from "./source-next.config.mjs";\n\nexport default { ...sourceConfig, distDir: "dist" };\n`,
        "utf8",
      );
      options.onTemporaryDirectory?.(temporaryDirectory);
    } catch (error) {
      cleanupTemporaryDirectory();
      throw error;
    }
  }

  let server: ChildProcessWithoutNullStreams;
  try {
    server = mode === "prod"
      ? spawn(
        process.execPath,
        [path.join(nextModule, "dist", "bin", "next"), "start", "-H", "127.0.0.1", "-p", String(port)],
        {
          cwd: process.cwd(),
          env: { ...process.env, ...options.environment, NEXT_TELEMETRY_DISABLED: "1" },
          windowsHide: true
        }
      )
      : spawn(process.execPath, ["-e", `
      const http = require("node:http");
      const imported = require(${JSON.stringify(nextModule)});
      const createNextServer = imported.default || imported;
      const app = createNextServer({
        dev: true,
        dir: ${JSON.stringify(tempPaths?.temporaryDirectory)},
        hostname: "127.0.0.1",
        port: ${port}
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
      `], {
        cwd: tempPaths?.temporaryDirectory,
        env: { ...process.env, ...options.environment, NEXT_TELEMETRY_DISABLED: "1" },
        windowsHide: true
      });
  } catch (error) {
    cleanupTemporaryDirectory();
    throw error;
  }
  server.stdout.on("data", (chunk: Buffer) => {
    const value = chunk.toString();
    appendServerOutput(value);
    if (value.includes("SAFECLAW_TEST_SERVER_READY") || value.includes("Ready in")) ready = true;
  });
  server.stderr.on("data", (chunk: Buffer) => appendServerOutput(chunk.toString()));
  server.on("exit", (code, signal) => {
    serverExit = { code, signal };
  });

  const startedAt = Date.now();
  try {
    while (Date.now() - startedAt < timeoutMs) {
      if (serverExit) {
        throw new Error(`Isolated Next server exited before readiness: ${JSON.stringify(serverExit)}\n${serverOutput}`);
      }
      if (ready) {
        try {
          const response = await fetch(`${baseUrl}${options.initialPath}`);
          if (response.ok) {
            const browser = await chromium.launch({ headless: true });
            let stopState: "running" | "stopping" | "stopped" = "running";
            let stopPromise: Promise<void> | null = null;
            const stop = async (): Promise<void> => {
              if (stopState === "stopped") return;
              if (stopPromise) return await stopPromise;
              stopState = "stopping";
              const operation = async (): Promise<void> => {
                let browserFailure: unknown = null;
                try {
                  const contextClosures = browser.contexts().map((context) => context.close());
                  await withTimeout(Promise.allSettled(contextClosures), 15_000, "Browser context cleanup");
                  try {
                    await withTimeout(browser.close(), 10_000, "Browser cleanup");
                  } catch (error) {
                    if (browser.isConnected()) throw error;
                  }
                } catch (error) {
                  browserFailure = error;
                }
                await stopProcessTree(server, port, options.terminationTimeoutMs ?? 10_000);
                await cleanupTemporaryDirectoryAfterTermination();
                if (browserFailure) throw browserFailure;
                stopState = "stopped";
              };
              stopPromise = operation().catch((error: unknown) => {
                stopState = "running";
                throw error;
              }).finally(() => {
                stopPromise = null;
              });
              return await stopPromise;
            };
            return {
              baseUrl,
              browser,
              mode,
              temporaryDirectory: tempPaths?.temporaryDirectory,
              distDirectory: tempPaths?.distDirectory,
              readServerOutput: () => serverOutput,
              stop,
            };
          }
        } catch (error) {
          if (serverExit) throw error;
        }
      }
      await delay(500);
    }
  } catch (error) {
    await stopProcessTree(server, port, options.terminationTimeoutMs ?? 10_000);
    await cleanupTemporaryDirectoryAfterTermination();
    throw error;
  }

  await stopProcessTree(server, port, options.terminationTimeoutMs ?? 10_000);
  await cleanupTemporaryDirectoryAfterTermination();
  throw new Error(`Timed out waiting for ${baseUrl}${options.initialPath}\n${serverOutput}`);
}

function isRetryablePortBindError(error: unknown): error is Error {
  return error instanceof Error && /\b(?:EADDRINUSE|EACCES)\b/u.test(error.message);
}

export async function startIsolatedNextBrowserHarness(
  options: HarnessOptions
): Promise<IsolatedNextBrowserHarness> {
  let lastPortBindError: Error | null = null;
  for (let attempt = 0; attempt < MAX_PORT_BIND_ATTEMPTS; attempt += 1) {
    try {
      return await startIsolatedNextBrowserHarnessAttempt(options, attempt);
    } catch (error) {
      if (!isRetryablePortBindError(error)) throw error;
      lastPortBindError = error;
    }
  }
  throw new Error(
    `Unable to start an isolated Next.js server after ${MAX_PORT_BIND_ATTEMPTS} port attempts`,
    { cause: lastPortBindError }
  );
}
