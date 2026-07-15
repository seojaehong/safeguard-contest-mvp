#!/usr/bin/env node

import crypto from "node:crypto";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";

import { canonicalFrontendSourceIdentity } from "./frontend_audit_source_identity.mjs";

const marker = "SafeClaw deterministic frontend audit global boundary probe";
const modeIndex = process.argv.indexOf("--mode");
const mode = modeIndex >= 0 ? process.argv[modeIndex + 1] : "";
if (!["normal", "audit"].includes(mode)) {
  throw new Error("Usage: frontend_audit_bundle_contract.mjs --mode normal|audit");
}

const buildDirectory = path.resolve(process.env.FRONTEND_AUDIT_BUILD_DIR ?? ".next");
const root = process.cwd();
const staticDirectory = path.join(buildDirectory, "static");
const outputPath = path.resolve(
  process.env.OUTPUT_PATH
    ?? `evaluation/frontend-audit-runner-port-v2-2026-07-11/bundle-${mode}.json`,
);

function listJavaScript(directory) {
  if (!fs.existsSync(directory)) return [];
  const files = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const absolutePath = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...listJavaScript(absolutePath));
    else if (entry.name.endsWith(".js")) files.push(absolutePath);
  }
  return files;
}

function digestFiles(baseDirectory, files) {
  const hash = crypto.createHash("sha256");
  for (const filePath of [...files].sort()) {
    hash.update(path.relative(baseDirectory, filePath).replaceAll("\\", "/"));
    hash.update("\0");
    hash.update(fs.readFileSync(filePath));
    hash.update("\0");
  }
  return hash.digest("hex");
}

function safeRepositoryPath(repositoryRoot, absolutePath) {
  const relativePath = path.relative(repositoryRoot, absolutePath);
  if (path.isAbsolute(relativePath) || relativePath === ".." || relativePath.startsWith(`..${path.sep}`)) {
    return "<external-build-directory>";
  }
  return (relativePath || ".").replaceAll("\\", "/");
}

const chunkFiles = listJavaScript(staticDirectory);
const buildIdPath = path.join(buildDirectory, "BUILD_ID");
if (!fs.existsSync(buildIdPath)) throw new Error(`Missing BUILD_ID: ${buildIdPath}`);
const buildId = fs.readFileSync(buildIdPath, "utf8").trim();
if (!buildId) throw new Error("BUILD_ID is empty.");
const sourceSha = execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).trim();
const { sourceIdentity } = canonicalFrontendSourceIdentity(root);
const buildIdentity = digestFiles(buildDirectory, [buildIdPath, ...chunkFiles]);
const markerFiles = chunkFiles.filter((file) => fs.readFileSync(file, "utf8").includes(marker));
const passed = mode === "normal" ? markerFiles.length === 0 : markerFiles.length === 1;
const report = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  mode,
  buildDirectory: safeRepositoryPath(root, buildDirectory),
  buildId,
  sourceSha,
  sourceIdentity,
  buildIdentity,
  chunkCount: chunkFiles.length,
  markerCount: markerFiles.length,
  markerFiles: markerFiles.map((file) => path.relative(buildDirectory, file).replaceAll("\\", "/")),
  status: passed ? "pass" : "fail",
};

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
console.log(JSON.stringify(report, null, 2));
if (!passed) process.exitCode = 1;
