import { spawn } from "node:child_process";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import type { Socket } from "node:net";

import { afterEach, describe, expect, it } from "vitest";

const scriptPath = path.resolve(
  "evaluation",
  "final-99-no-approval-boundary-2026-07-23",
  "run-final-99-no-approval-boundary.mjs",
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
        commitSha: "fixture-final99-live",
        configured: true,
        environment: "production",
        ok: true,
      }));
      return;
    }
    response.writeHead(404, { "content-type": "application/json" });
    response.end(JSON.stringify({ ok: false }));
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
  const outputDir = fs.mkdtempSync(path.join(os.tmpdir(), "safeclaw-final99-boundary-"));
  tempRoots.push(outputDir);
  const childArgs = [scriptPath, "--output", outputDir, ...args];
  let stdout = "";
  let stderr = "";
  const child = spawn(process.execPath, childArgs, {
    cwd: process.cwd(),
    env: {
      ...process.env,
      SAFEGUARD_AUTH_TOKEN: "",
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

describe("final-99 no-approval boundary runner", () => {
  it("documents the approval boundary without running the write-capable final-99 runner", async () => {
    const server = await startFixtureServer();
    try {
      const result = await runBoundaryScript(["--base-url", server.baseUrl]);
      const report = readReport(result.outputDir);

      expect(result.code).toBe(0);
      expect(result.stderr).toBe("");
      expect(result.stdout).toContain("\"currentFinal99Overall\": \"pass_with_notice\"");
      expect(report).toMatchObject({
        currentCarriedNoticeCount: 2,
        currentFinal99Overall: "pass_with_notice",
        currentNoticeGateIds: ["auth-history-reuse", "dispatch-policy"],
        dbMutationPerformed: false,
        fullyAutomatedLaunchClaimAllowed: false,
        productionCommit: "fixture-final99-live",
        providerDispatchLiveClaimed: false,
        safeLaunchDemoClaimAllowed: true,
        verdict: "NO_APPROVAL_FINAL_99_RERUN_BLOCKED_BOUNDARY_DOCUMENTED",
      });
      expect(report.runnerNoApprovalRisk as Record<string, unknown>).toMatchObject({
        authHistoryReuseWritesWhenTokenPresent: true,
        authTokenPresentInThisReview: false,
        dispatchLogWritesWhenTokenPresent: true,
        safeWhenSafeguardAuthTokenAbsent: true,
      });
      expect(report.forbiddenActionsWithoutApproval).toContain("Do not reinterpret pass_with_notice as fully automated launch readiness.");
    } finally {
      await server.close();
    }
  });
});
