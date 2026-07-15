#!/usr/bin/env node

import crypto from "node:crypto";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";

import { canonicalFrontendSourceIdentity } from "./frontend_audit_source_identity.mjs";

const markerDefinitions = {
  global: "SafeClaw deterministic frontend audit global boundary probe",
  appError: "SafeClaw deterministic frontend audit error boundary probe",
  appErrorConfirmation: "SafeClaw deterministic frontend audit error boundary confirmed",
};
const modeIndex = process.argv.indexOf("--mode");
const mode = modeIndex >= 0 ? process.argv[modeIndex + 1] : "";
if (!["normal", "audit"].includes(mode)) {
  throw new Error("Usage: frontend_audit_bundle_contract.mjs --mode normal|audit");
}

const buildDirectory = path.resolve(process.env.FRONTEND_AUDIT_BUILD_DIR ?? ".next");
const root = process.cwd();
const staticDirectory = path.join(buildDirectory, "static");
const serverDirectory = path.join(buildDirectory, "server");
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

const staticFiles = listJavaScript(staticDirectory);
const serverFiles = listJavaScript(serverDirectory);
const outputFiles = [...staticFiles, ...serverFiles];
const buildIdPath = path.join(buildDirectory, "BUILD_ID");
if (!fs.existsSync(buildIdPath)) throw new Error(`Missing BUILD_ID: ${buildIdPath}`);
const buildId = fs.readFileSync(buildIdPath, "utf8").trim();
if (!buildId) throw new Error("BUILD_ID is empty.");
const sourceSha = execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).trim();
const { sourceIdentity } = canonicalFrontendSourceIdentity(root);
const buildIdentity = digestFiles(buildDirectory, [buildIdPath, ...outputFiles]);
const contentByFile = new Map(outputFiles.map((file) => [file, fs.readFileSync(file, "utf8")]));

function markerEvidence(marker) {
  const matchingStaticFiles = staticFiles.filter((file) => contentByFile.get(file)?.includes(marker));
  const matchingServerFiles = serverFiles.filter((file) => contentByFile.get(file)?.includes(marker));
  return {
    staticCount: matchingStaticFiles.length,
    serverCount: matchingServerFiles.length,
    totalCount: matchingStaticFiles.length + matchingServerFiles.length,
    files: [...matchingStaticFiles, ...matchingServerFiles]
      .map((file) => path.relative(buildDirectory, file).replaceAll("\\", "/")),
  };
}

const markers = Object.fromEntries(
  Object.entries(markerDefinitions).map(([name, marker]) => [name, markerEvidence(marker)]),
);
const normalPassed = Object.values(markers).every((evidence) => evidence.totalCount === 0);
const auditPassed = markers.global.staticCount === 1
  && markers.global.serverCount >= 1
  && markers.appError.staticCount === 0
  && markers.appError.serverCount === 1
  && markers.appErrorConfirmation.staticCount === 1
  && markers.appErrorConfirmation.serverCount === 0;
const passed = mode === "normal" ? normalPassed : auditPassed;
const report = {
  schemaVersion: 2,
  generatedAt: new Date().toISOString(),
  mode,
  buildDirectory: safeRepositoryPath(root, buildDirectory),
  buildId,
  sourceSha,
  sourceIdentity,
  buildIdentity,
  chunkCount: outputFiles.length,
  staticChunkCount: staticFiles.length,
  serverChunkCount: serverFiles.length,
  markerCount: markers.global.staticCount,
  markerFiles: markers.global.files.filter((file) => file.startsWith("static/")),
  markers,
  status: passed ? "pass" : "fail",
};

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
console.log(JSON.stringify(report, null, 2));
if (!passed) process.exitCode = 1;
