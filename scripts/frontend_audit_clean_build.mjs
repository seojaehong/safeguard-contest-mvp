#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";

export function frontendAuditBuildPlan(mode) {
  if (!["normal", "audit"].includes(mode)) {
    throw new Error("Frontend audit build mode must be normal or audit.");
  }
  return {
    mode,
    buildDirectory: ".next",
    cleanBeforeBuild: true,
    auditEnabled: mode === "audit",
  };
}

export function cleanFrontendAuditBuild(root, mode) {
  const plan = frontendAuditBuildPlan(mode);
  const buildDirectory = path.resolve(root, plan.buildDirectory);
  const relativePath = path.relative(root, buildDirectory);
  if (path.isAbsolute(relativePath) || relativePath === ".." || relativePath.startsWith(`..${path.sep}`)) {
    throw new Error(`Unsafe frontend audit build directory: ${buildDirectory}`);
  }
  fs.rmSync(buildDirectory, { recursive: true, force: true });
  return plan;
}

export function frontendAuditBuildCommand(platform) {
  return platform === "win32"
    ? { command: "cmd.exe", args: ["/d", "/s", "/c", "npm.cmd run build"] }
    : { command: "npm", args: ["run", "build"] };
}

function readMode() {
  const modeIndex = process.argv.indexOf("--mode");
  return modeIndex >= 0 ? process.argv[modeIndex + 1] : "";
}

function main() {
  const root = process.cwd();
  const plan = cleanFrontendAuditBuild(root, readMode());
  const buildCommand = frontendAuditBuildCommand(process.platform);
  const command = process.platform === "win32"
    ? process.env.ComSpec ?? buildCommand.command
    : buildCommand.command;
  const result = spawnSync(command, buildCommand.args, {
    cwd: root,
    env: {
      ...process.env,
      FRONTEND_AUDIT_BUILD_DIR: plan.buildDirectory,
      SAFECLAW_FRONTEND_AUDIT: plan.auditEnabled ? "1" : "0",
    },
    stdio: "inherit",
  });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exitCode = result.status ?? 1;
  else console.log(JSON.stringify(plan));
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) main();
