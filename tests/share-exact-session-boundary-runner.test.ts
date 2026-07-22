import { spawn } from "node:child_process";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import type { Socket } from "node:net";

import { afterEach, describe, expect, it } from "vitest";

const scriptPath = path.resolve(
  "evaluation",
  "share-exact-session-boundary-2026-07-22",
  "run-share-exact-session-boundary.mjs",
);

type FixtureServer = {
  baseUrl: string;
  close: () => Promise<void>;
};

type ChildResult = {
  code: number | null;
  outputDir: string;
  stderr: string;
  stdout: string;
};

const tempRoots: string[] = [];

async function startFixtureServer(): Promise<FixtureServer> {
  const sockets = new Set<Socket>();
  const server = http.createServer((request, response) => {
    if (request.url?.startsWith("/api/build-info")) {
      response.writeHead(200, { "content-type": "application/json" });
      response.end(JSON.stringify({
        branch: "master",
        commitSha: "fixture-live-commit",
        configured: true,
        environment: "production",
        ok: true,
      }));
      return;
    }
    if (request.url?.startsWith("/api/share-sessions/")) {
      response.writeHead(404, { "content-type": "application/json" });
      response.end(JSON.stringify({ message: "missing fixture session", ok: false }));
      return;
    }
    if (request.url?.startsWith("/share/saved-session")) {
      response.writeHead(200, { "content-type": "text/html" });
      response.end(`<!doctype html>
        <html>
          <head>
            <style>
              body { margin: 0; font-family: Arial, sans-serif; }
              .safeclaw-share-recipient-page {
                box-sizing: border-box;
                display: grid;
                gap: 16px;
                margin: 24px auto;
                max-width: min(1204px, calc(100vw - 48px));
                width: min(1204px, calc(100vw - 48px));
              }
              @media (min-width: 900px) {
                .safeclaw-share-recipient-page {
                  grid-template-columns: minmax(360px, 0.82fr) minmax(460px, 1fr);
                }
              }
              .safeclaw-share-recipient-card { border: 1px solid #ddd; min-height: 120px; padding: 16px; }
              button { margin-top: 12px; padding: 12px 16px; }
            </style>
          </head>
          <body>
            <main class="safeclaw-share-recipient-page">
              <section class="safeclaw-share-recipient-card">
                <h1>Review document pack</h1>
                <button>I have reviewed</button>
              </section>
              <section class="safeclaw-share-recipient-card">
                <h2>3 key documents</h2>
                <p>Selected preview and provenance.</p>
              </section>
            </main>
          </body>
        </html>`);
      return;
    }
    response.writeHead(404, { "content-type": "text/plain" });
    response.end("not found");
  });
  server.on("connection", (socket) => {
    sockets.add(socket);
    socket.on("close", () => sockets.delete(socket));
  });
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Fixture server did not start");
  return {
    baseUrl: `http://127.0.0.1:${address.port}`,
    close: async () => {
      for (const socket of sockets) socket.destroy();
      await new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      });
    },
  };
}

async function runBoundaryScript(args: string[]): Promise<ChildResult> {
  const outputDir = fs.mkdtempSync(path.join(os.tmpdir(), "safeclaw-share-exact-boundary-"));
  tempRoots.push(outputDir);
  const childArgs = [scriptPath, "--output", outputDir, ...args];
  let stdout = "";
  let stderr = "";
  const child = spawn(process.execPath, childArgs, {
    cwd: process.cwd(),
    env: {
      ...process.env,
      SAFECLAW_EXACT_SHARE_SESSION_PAYLOAD: "",
      SAFECLAW_EXACT_SHARE_SESSION_URL: "",
    },
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
  });
  child.stdout.setEncoding("utf8");
  child.stderr.setEncoding("utf8");
  child.stdout.on("data", (chunk: string) => {
    stdout += chunk;
  });
  child.stderr.on("data", (chunk: string) => {
    stderr += chunk;
  });
  const code = await new Promise<number | null>((resolve, reject) => {
    child.once("error", reject);
    child.once("close", resolve);
  });
  return { code, outputDir, stderr, stdout };
}

function readReport(outputDir: string): Record<string, unknown> {
  return JSON.parse(fs.readFileSync(path.join(outputDir, "report.json"), "utf8")) as Record<string, unknown>;
}

afterEach(() => {
  for (const root of tempRoots.splice(0)) {
    fs.rmSync(root, { force: true, recursive: true });
  }
});

describe("share exact session boundary runner", () => {
  it("keeps exact saved Share missing when no concrete URL is provided", async () => {
    const server = await startFixtureServer();
    try {
      const result = await runBoundaryScript(["--base-url", server.baseUrl]);
      const report = readReport(result.outputDir);

      expect(result.code).toBe(0);
      expect(result.stderr).toBe("");
      expect(report).toMatchObject({
        exactSavedSessionUrlProvided: false,
        exactSavedUserSessionReproduced: false,
        liveCommit: "fixture-live-commit",
        sessionKind: "missing-exact",
        verdict: "MISSING_EXACT_SAVED_SESSION_EVIDENCE_NO_MUTATION_BOUNDARY_CONFIRMED",
      });
      expect((report.boundary as Record<string, unknown>).dbMutationPerformed).toBe(false);
    } finally {
      await server.close();
    }
  });

  it("measures a provided exact saved recipient URL without mutation requests", async () => {
    const server = await startFixtureServer();
    try {
      const exactUrl = `${server.baseUrl}/share/saved-session?workerId=worker-1`;
      const result = await runBoundaryScript([
        "--base-url",
        server.baseUrl,
        "--exact-url",
        exactUrl,
      ]);
      const report = readReport(result.outputDir);

      expect(result.code).toBe(0);
      expect(result.stderr).toBe("");
      expect(report).toMatchObject({
        exactSavedSessionUrlProvided: true,
        exactSavedUserSessionReproduced: true,
        liveCommit: "fixture-live-commit",
        sessionKind: "saved-exact",
        verdict: "PASS_EXACT_SAVED_SESSION_GEOMETRY_NO_MUTATION",
      });
      expect((report.boundary as Record<string, unknown>).dbMutationPerformed).toBe(false);
      expect((report.boundary as Record<string, unknown>).exactSessionMutationRequestCount).toBe(0);
      const rows = report.exactSessionGeometry as Array<{ verdict: string }>;
      expect(rows).toHaveLength(3);
      expect(rows.every((row) => row.verdict === "PASS_EXACT_SAVED_SESSION_GEOMETRY_NO_MUTATION")).toBe(true);
    } finally {
      await server.close();
    }
  }, 30_000);
});
