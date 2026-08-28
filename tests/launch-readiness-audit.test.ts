import { spawn } from "node:child_process";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import type { Socket } from "node:net";

import { afterAll, describe, expect, it } from "vitest";

const root = process.cwd();
const auditScript = path.join(root, "scripts", "launch_readiness_audit.mjs");
const testRoot = path.join(root, "evaluation", ".launch-readiness-audit-tests");
const childDeadlineMs = 5_000;
const auditRequestTimeoutMs = 1_000;
const delayedStdoutPreload = `data:text/javascript,${encodeURIComponent(`
  const originalWrite = process.stdout.write.bind(process.stdout);
  process.stdout.write = function delayedWrite(chunk, encoding, callback) {
    const resolvedEncoding = typeof encoding === "string" ? encoding : undefined;
    const resolvedCallback = typeof encoding === "function" ? encoding : callback;
    setTimeout(() => originalWrite(chunk, resolvedEncoding, resolvedCallback), 25);
    return true;
  };
`)}`;

type FixtureMode =
  | "success"
  | "build-info-failure"
  | "http-failure"
  | "distributed-unavailable"
  | "timeout"
  | "malformed-json";

type FixtureRequest = {
  body: string;
  method: string | undefined;
  url: string | undefined;
};

type ChildResult = {
  code: number | null;
  durationMs: number;
  outputFiles: string[];
  outputText: string | null;
  requests: FixtureRequest[];
  signal: NodeJS.Signals | null;
  stderr: string;
  stdout: string;
};

type FixtureServer = {
  baseUrl: string;
  close: () => Promise<void>;
  requests: FixtureRequest[];
};

const successPayload = {
  scenario: { task: "local launch readiness fixture" },
  status: { ai: "live", detail: "fixture detail", lawgo: "live" },
  externalData: {},
  deliverables: {
    workpackSummaryDraft: "Fixture output long enough to be marked as present.",
    workPermitDraft: "Fixture permit output long enough to be marked as present.",
  },
};

const buildInfoPayload = {
  ok: true,
  commitSha: "fixture-production-commit",
  branch: "master",
  environment: "test",
};

function asJsonObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Expected a JSON object");
  }
  return value as Record<string, unknown>;
}

function parseJsonObject(text: string): Record<string, unknown> {
  const parsed: unknown = JSON.parse(text);
  return asJsonObject(parsed);
}

async function startFixtureServer(mode: FixtureMode): Promise<FixtureServer> {
  const requests: FixtureRequest[] = [];
  const sockets = new Set<Socket>();
  const server = http.createServer((request, response) => {
    const chunks: Buffer[] = [];
    request.on("data", (chunk: Buffer) => chunks.push(chunk));
    request.on("error", (error) => response.destroy(error));
    request.on("end", () => {
      requests.push({
        body: Buffer.concat(chunks).toString("utf8"),
        method: request.method,
        url: request.url,
      });

      if (request.method === "GET" && request.url === "/api/build-info") {
        if (mode === "build-info-failure") {
          response.writeHead(503, { "content-type": "application/json" });
          response.end(JSON.stringify({ error: "fixture build marker unavailable" }));
          return;
        }
        response.writeHead(200, { "content-type": "application/json" });
        response.end(JSON.stringify(buildInfoPayload));
        return;
      }

      if (request.method !== "POST" || request.url !== "/api/ask") {
        response.writeHead(404, { "content-type": "application/json" });
        response.end(JSON.stringify({ error: "fixture route not found" }));
        return;
      }

      if (mode === "timeout") return;
      if (mode === "http-failure") {
        response.writeHead(503, { "content-type": "application/json" });
        response.end(JSON.stringify({ error: "fixture unavailable" }));
        return;
      }
      if (mode === "distributed-unavailable") {
        response.writeHead(503, {
          "content-type": "application/json",
          "x-safeclaw-rate-limit": "distributed",
          "x-safeclaw-work-unit": "generation",
        });
        response.end(JSON.stringify({
          code: "DISTRIBUTED_RATE_LIMIT_UNAVAILABLE",
          error: "request protection unavailable",
          retryAfterSeconds: 5,
        }));
        return;
      }
      if (mode === "malformed-json") {
        response.writeHead(200, { "content-type": "application/json" });
        response.end("{malformed fixture json");
        return;
      }

      response.writeHead(200, { "content-type": "application/json" });
      response.end(JSON.stringify(successPayload));
    });
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
  if (!address || typeof address === "string") {
    throw new Error("Fixture server did not expose a TCP address");
  }

  return {
    baseUrl: `http://127.0.0.1:${address.port}`,
    requests,
    close: async () => {
      for (const socket of sockets) socket.destroy();
      await new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      });
    },
  };
}

function buildChildEnv(baseUrl: string, outDir: string): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    SAFETYGUARD_AUDIT_DISPATCH: "false",
    SAFETYGUARD_AUDIT_OUTPUT: "audit.json",
    SAFETYGUARD_AUDIT_QUESTION: "Local fixture launch readiness question",
    SAFETYGUARD_AUDIT_TIMEOUT_MS: String(auditRequestTimeoutMs),
    SAFETYGUARD_BASE_URL: baseUrl,
    SAFETYGUARD_OUT_DIR: outDir,
  };
  for (const name of [
    "DATA_GO_KR_SERVICE_KEY",
    "GEMINI_API_KEY",
    "KOREAN_LAW_MCP_LAW_OC",
    "LAWGO_OC",
    "N8N_INTERNAL_BASE",
    "N8N_PUBLIC_BASE",
    "N8N_WEBHOOK_PATH",
    "N8N_WEBHOOK_TOKEN",
    "N8N_WEBHOOK_URL",
    "NODE_OPTIONS",
    "PUBLIC_DATA_API_KEY",
    "WORK24_AUTH_KEY",
  ]) {
    delete env[name];
  }
  return env;
}

async function runAudit(
  mode: FixtureMode,
  options: { preseedOutput?: boolean } = {},
): Promise<ChildResult> {
  fs.mkdirSync(testRoot, { recursive: true });
  const runDirectory = fs.mkdtempSync(path.join(testRoot, "run-"));
  const outDir = path.join(runDirectory, "output");
  const outputPath = path.join(outDir, "audit.json");
  fs.mkdirSync(outDir, { recursive: true });
  if (options.preseedOutput) {
    fs.writeFileSync(outputPath, JSON.stringify({ stale: true }), "utf8");
  }

  const fixture = await startFixtureServer(mode);
  const startedAt = Date.now();
  let stdout = "";
  let stderr = "";

  try {
    const child = spawn(
      process.execPath,
      ["--import", delayedStdoutPreload, auditScript],
      {
        cwd: runDirectory,
        env: buildChildEnv(fixture.baseUrl, outDir),
        stdio: ["ignore", "pipe", "pipe"],
        windowsHide: true,
      },
    );
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk: string) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk: string) => {
      stderr += chunk;
    });

    let exceededDeadline = false;
    const deadline = setTimeout(() => {
      exceededDeadline = true;
      child.kill();
    }, childDeadlineMs);
    const closed = await new Promise<{ code: number | null; signal: NodeJS.Signals | null }>(
      (resolve, reject) => {
        child.once("error", reject);
        child.once("close", (code, signal) => resolve({ code, signal }));
      },
    );
    clearTimeout(deadline);
    if (exceededDeadline) {
      throw new Error(`Audit child exceeded ${childDeadlineMs}ms and was terminated`);
    }

    return {
      ...closed,
      durationMs: Date.now() - startedAt,
      outputFiles: fs.existsSync(outDir) ? fs.readdirSync(outDir).sort() : [],
      outputText: fs.existsSync(outputPath) ? fs.readFileSync(outputPath, "utf8") : null,
      requests: [...fixture.requests],
      stderr,
      stdout,
    };
  } finally {
    await fixture.close();
    fs.rmSync(runDirectory, { recursive: true, force: true });
  }
}

function expectBuildInfoThenAskRequests(result: ChildResult): void {
  expect(result.requests).toHaveLength(2);
  expect(result.requests[0]).toMatchObject({ method: "GET", url: "/api/build-info" });
  expect(result.requests[0].body).toBe("");
  expect(result.requests[1]).toMatchObject({ method: "POST", url: "/api/ask" });
  expect(parseJsonObject(result.requests[1].body)).toEqual({
    question: "Local fixture launch readiness question",
  });
}

afterAll(() => {
  const absoluteTestRoot = path.resolve(testRoot);
  const evaluationRoot = `${path.resolve(root, "evaluation")}${path.sep}`;
  if (!absoluteTestRoot.startsWith(evaluationRoot)) {
    throw new Error(`Refusing to remove test directory outside evaluation: ${absoluteTestRoot}`);
  }
  fs.rmSync(absoluteTestRoot, { recursive: true, force: true });
});

describe("launch readiness audit process lifecycle", () => {
  it("flushes one summary, writes one valid report, and exits zero", async () => {
    const result = await runAudit("success", { preseedOutput: true });

    expect(result.code).toBe(0);
    expect(result.signal).toBeNull();
    expect(result.stderr).toBe("");
    expect(result.durationMs).toBeLessThan(childDeadlineMs);
    expect(parseJsonObject(result.stdout.trim())).toMatchObject({
      apiAskOk: true,
      dispatchOk: null,
    });
    expect(result.outputFiles).toEqual(["audit.json"]);
    const report = parseJsonObject(result.outputText ?? "");
    expect(report).toMatchObject({
      apiAskOk: true,
      apiAskStatus: 200,
      dispatchOk: null,
      dispatchStatus: null,
      productionCommit: "fixture-production-commit",
      productionBuild: buildInfoPayload,
    });
    expect(asJsonObject(report.documents)).toMatchObject({
      workPermitDraft: true,
      workpackSummaryDraft: true,
    });
    expectBuildInfoThenAskRequests(result);
  });

  it("fails closed before the audit request when the production marker is unavailable", async () => {
    const result = await runAudit("build-info-failure", { preseedOutput: true });

    expect(result.code).toBe(1);
    expect(result.signal).toBeNull();
    expect(result.stdout).toBe("");
    expect(parseJsonObject(result.stderr.trim())).toMatchObject({
      error: "Launch readiness audit failed",
      detail: "Production build marker unavailable (503).",
    });
    expect(result.outputFiles).toEqual([]);
    expect(result.outputText).toBeNull();
    expect(result.requests).toHaveLength(1);
    expect(result.requests[0]).toMatchObject({ method: "GET", url: "/api/build-info" });
  });

  it("keeps the HTTP failure report and exits one after flushing its summary", async () => {
    const result = await runAudit("http-failure");

    expect(result.code).toBe(1);
    expect(result.signal).toBeNull();
    expect(result.stderr).toBe("");
    expect(parseJsonObject(result.stdout.trim())).toMatchObject({ apiAskOk: false });
    expect(result.outputFiles).toEqual(["audit.json"]);
    expect(parseJsonObject(result.outputText ?? "")).toMatchObject({
      apiAskOk: false,
      apiAskStatus: 503,
    });
    expectBuildInfoThenAskRequests(result);
  });

  it("preserves distributed admission failure details without dispatch", async () => {
    const result = await runAudit("distributed-unavailable");

    expect(result.code).toBe(1);
    expect(result.signal).toBeNull();
    expect(result.stderr).toBe("");
    expect(parseJsonObject(result.stdout.trim())).toMatchObject({
      apiAskErrorCode: "DISTRIBUTED_RATE_LIMIT_UNAVAILABLE",
      apiAskOk: false,
      dispatchOk: null,
    });
    expect(parseJsonObject(result.outputText ?? "")).toMatchObject({
      apiAskError: "request protection unavailable",
      apiAskErrorCode: "DISTRIBUTED_RATE_LIMIT_UNAVAILABLE",
      apiAskRateLimit: "distributed",
      apiAskRetryAfterSeconds: 5,
      apiAskStatus: 503,
      apiAskWorkUnit: "generation",
      dispatchStatus: null,
    });
    expectBuildInfoThenAskRequests(result);
  });

  it("removes stale output and exits one when the request times out", async () => {
    const result = await runAudit("timeout", { preseedOutput: true });

    expect(result.code).toBe(1);
    expect(result.signal).toBeNull();
    expect(result.stdout).toBe("");
    expect(parseJsonObject(result.stderr.trim())).toMatchObject({
      error: "Launch readiness audit failed",
    });
    expect(result.outputFiles).toEqual([]);
    expect(result.outputText).toBeNull();
    expectBuildInfoThenAskRequests(result);
  });

  it("preserves HTTP semantics for a malformed successful response", async () => {
    const result = await runAudit("malformed-json");

    expect(result.code).toBe(0);
    expect(result.signal).toBeNull();
    expect(result.stderr).toBe("");
    expect(parseJsonObject(result.stdout.trim())).toMatchObject({ apiAskOk: true });
    const report = parseJsonObject(result.outputText ?? "");
    expect(report).toMatchObject({
      apiAskOk: true,
      apiAskStatus: 200,
      scenario: null,
    });
    const documents = asJsonObject(report.documents);
    expect(Object.values(documents).every((value) => value === false)).toBe(true);
    expect(result.outputFiles).toEqual(["audit.json"]);
    expectBuildInfoThenAskRequests(result);
  });
});
