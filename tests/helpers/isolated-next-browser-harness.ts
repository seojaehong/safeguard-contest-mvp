import { spawn, spawnSync, type ChildProcessWithoutNullStreams } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { chromium, type Browser } from "playwright";

type ServerExit = {
  code: number | null;
  signal: NodeJS.Signals | null;
};

type HarnessOptions = {
  slug: string;
  initialPath: string;
  portSalt: number;
  mode?: "dev" | "prod";
  timeoutMs?: number;
  tempRoot?: string;
  makeTempDirectory?: (prefix: string) => string;
  onTemporaryDirectory?: (directory: string) => void;
  environment?: Readonly<Record<string, string | undefined>>;
};

export type IsolatedNextBrowserHarness = {
  baseUrl: string;
  browser: Browser;
  mode: "dev" | "prod";
  temporaryDirectory?: string;
  distDirectory?: string;
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

async function stopProcessTree(server: ChildProcessWithoutNullStreams | null): Promise<void> {
  const processId = server?.pid;
  if (!processId || server.exitCode !== null || server.signalCode !== null) return;
  if (process.platform === "win32") {
    spawnSync("taskkill.exe", ["/PID", String(processId), "/T", "/F"], {
      encoding: "utf8",
      windowsHide: true
    });
    return;
  }
  const exited = new Promise<void>((resolve) => server.once("exit", () => resolve()));
  server.kill("SIGTERM");
  await Promise.race([exited, delay(5_000)]);
  if (server.exitCode === null && server.signalCode === null) {
    server.kill("SIGKILL");
    await Promise.race([exited, delay(5_000)]);
  }
}

export async function startIsolatedNextBrowserHarness(
  options: HarnessOptions
): Promise<IsolatedNextBrowserHarness> {
  if (!/^[a-z0-9-]+$/u.test(options.slug)) {
    throw new Error(`Invalid browser harness slug: ${options.slug}`);
  }

  const timeoutMs = options.timeoutMs ?? 90_000;
  const mode = options.mode ?? "dev";
  const port = 20_000 + ((process.pid * 97 + options.portSalt) % 30_000);
  const baseUrl = `http://127.0.0.1:${port}`;
  const output: string[] = [];
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
      for (const directoryName of ["app", "components", "data", "lib", "types"]) {
        const sourceDirectory = path.join(sourceRoot, directoryName);
        if (fs.existsSync(sourceDirectory)) {
          fs.cpSync(sourceDirectory, path.join(temporaryDirectory, directoryName), { recursive: true });
        }
      }
      for (const directoryName of ["node_modules", "public"]) {
        const sourceDirectory = path.join(sourceRoot, directoryName);
        if (fs.existsSync(sourceDirectory)) {
          fs.symlinkSync(sourceDirectory, path.join(temporaryDirectory, directoryName), directoryLinkType);
        }
      }
      for (const fileName of ["package.json", "tsconfig.json", "next-env.d.ts"]) {
        const sourceFile = path.join(sourceRoot, fileName);
        if (fs.existsSync(sourceFile)) fs.copyFileSync(sourceFile, path.join(temporaryDirectory, fileName));
      }
      const sourceConfigUrl = pathToFileURL(path.join(sourceRoot, "next.config.mjs")).href;
      fs.writeFileSync(
        path.join(temporaryDirectory, "next.config.mjs"),
        `import sourceConfig from ${JSON.stringify(sourceConfigUrl)};\n\nexport default { ...sourceConfig, distDir: "dist" };\n`,
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
    output.push(value);
    if (value.includes("SAFECLAW_TEST_SERVER_READY") || value.includes("Ready in")) ready = true;
  });
  server.stderr.on("data", (chunk: Buffer) => output.push(chunk.toString()));
  server.on("exit", (code, signal) => {
    serverExit = { code, signal };
  });

  const startedAt = Date.now();
  try {
    while (Date.now() - startedAt < timeoutMs) {
      if (serverExit) {
        throw new Error(`Isolated Next server exited before readiness: ${JSON.stringify(serverExit)}\n${output.slice(-30).join("")}`);
      }
      if (ready) {
        try {
          const response = await fetch(`${baseUrl}${options.initialPath}`);
          if (response.ok) {
            const browser = await chromium.launch({ headless: true });
            let stopped = false;
            const stop = async (): Promise<void> => {
              if (stopped) return;
              stopped = true;
              try {
                const contextClosures = browser.contexts().map((context) => context.close());
                await withTimeout(Promise.allSettled(contextClosures), 15_000, "Browser context cleanup");
                try {
                  await withTimeout(browser.close(), 10_000, "Browser cleanup");
                } catch (error) {
                  if (browser.isConnected()) throw error;
                }
              } finally {
                try {
                  await stopProcessTree(server);
                } finally {
                  cleanupTemporaryDirectory();
                }
              }
            };
            return {
              baseUrl,
              browser,
              mode,
              temporaryDirectory: tempPaths?.temporaryDirectory,
              distDirectory: tempPaths?.distDirectory,
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
    try {
      await stopProcessTree(server);
    } finally {
      cleanupTemporaryDirectory();
    }
    throw error;
  }

  try {
    await stopProcessTree(server);
  } finally {
    cleanupTemporaryDirectory();
  }
  throw new Error(`Timed out waiting for ${baseUrl}${options.initialPath}\n${output.slice(-30).join("")}`);
}
