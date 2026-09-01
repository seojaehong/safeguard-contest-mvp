#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { spawnWithBudget } from "./operator_smoke_resource_budget.mjs";

const startedAt = Date.now();
const rootDir = process.cwd();
const outDir = path.resolve(process.env.SAFECLAW_RELEASE_CLOSEOUT_OUT_DIR || path.join(rootDir, "evaluation", "final-release-closeout"));
const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";
const RELEASE_STEP_TIMEOUT_MS = 10 * 60 * 1000;
const RELEASE_STEP_MAX_BUFFER_BYTES = 20 * 1024 * 1024;

const steps = [
  {
    name: "targeted-token-auth-tests",
    command: npmCommand,
    args: ["test", "--", "tests/auth-callback.test.ts", "tests/mcp-token-service.test.ts"],
  },
  {
    name: "typecheck",
    command: npmCommand,
    args: ["run", "typecheck"],
  },
  {
    name: "strict-release-scale-audit",
    command: npmCommand,
    args: ["run", "audit:release-scale:strict"],
  },
  {
    name: "build",
    command: npmCommand,
    args: ["run", "build"],
  },
];

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function commandText(step) {
  return [step.command, ...step.args].join(" ");
}

function writeJson(fileName, payload) {
  fs.writeFileSync(path.join(outDir, fileName), `${JSON.stringify(payload, null, 2)}\n`, "utf8");
}

function writeMarkdown(fileName, content) {
  fs.writeFileSync(path.join(outDir, fileName), `${content.trim()}\n`, "utf8");
}

async function runStep(step, index) {
  const stepStartedAt = Date.now();
  const command = process.platform === "win32" ? process.env.ComSpec || "cmd.exe" : step.command;
  const args = process.platform === "win32" ? ["/d", "/s", "/c", commandText(step)] : step.args;
  const result = await spawnWithBudget(command, args, {
    cwd: rootDir,
    env: process.env,
    encoding: "utf8",
    shell: false,
  }, {
    timeoutMs: RELEASE_STEP_TIMEOUT_MS,
    maxBufferBytes: RELEASE_STEP_MAX_BUFFER_BYTES,
  });
  const exitCode = !result.error && typeof result.status === "number" ? result.status : 1;
  const signal = result.signal || null;
  const spawnError = result.error ? `${result.error.name}: ${result.error.message}` : null;
  const elapsedMs = Date.now() - stepStartedAt;
  const logFileName = `${String(index + 1).padStart(2, "0")}-${step.name}.log`;
  const logPath = path.join(outDir, logFileName);
  const logBody = [
    `command: ${commandText(step)}`,
    `exitCode: ${exitCode}`,
    `signal: ${signal || ""}`,
    `elapsedMs: ${elapsedMs}`,
    "",
    "## stdout",
    result.stdout || "",
    "",
    "## stderr",
    result.stderr || "",
    "",
    "## spawnError",
    spawnError || "",
  ].join("\n");
  fs.writeFileSync(logPath, logBody, "utf8");
  return {
    name: step.name,
    command: commandText(step),
    exitCode,
    signal,
    spawnError,
    elapsedMs,
    verdict: exitCode === 0 ? "pass" : "blocked",
    logPath: path.relative(rootDir, logPath).replace(/\\/g, "/"),
  };
}

function renderMarkdown(payload) {
  const rows = payload.steps
    .map((step) => `| ${step.name} | ${step.verdict} | ${step.exitCode} | ${step.elapsedMs} | ${step.logPath} |`)
    .join("\n");
  return `
# SafeClaw Final Release Closeout

Generated: ${payload.generatedAt}

Verdict: **${payload.verdict}**

Elapsed: ${payload.elapsedMs} ms

## Steps

| Step | Verdict | Exit Code | Elapsed Ms | Log |
|------|---------|-----------|------------|-----|
${rows}

## Interpretation

- This closeout is complete only when every step is \`pass\`.
- If \`strict-release-scale-audit\` is blocked, inspect \`evaluation/final-release-scale-audit/final-release-scale-audit.json\` for the remaining release gates.
`;
}

async function main() {
  ensureDir(outDir);
  const results = [];
  for (const [index, step] of steps.entries()) {
    results.push(await runStep(step, index));
  }
  const verdict = results.every((step) => step.verdict === "pass") ? "pass" : "blocked";
  const payload = {
    generatedAt: new Date().toISOString(),
    elapsedMs: Date.now() - startedAt,
    verdict,
    steps: results,
  };
  writeJson("report.json", payload);
  writeMarkdown("report.md", renderMarkdown(payload));
  console.log(JSON.stringify({
    verdict: payload.verdict,
    blockedSteps: results.filter((step) => step.verdict === "blocked").map((step) => step.name),
    outDir,
  }, null, 2));
  if (verdict !== "pass") process.exitCode = 1;
}

await main();
