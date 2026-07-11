#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const marker = "SafeClaw deterministic frontend audit global boundary probe";
const modeIndex = process.argv.indexOf("--mode");
const mode = modeIndex >= 0 ? process.argv[modeIndex + 1] : "";
if (!["normal", "audit"].includes(mode)) {
  throw new Error("Usage: frontend_audit_bundle_contract.mjs --mode normal|audit");
}

const buildDirectory = path.resolve(process.env.FRONTEND_AUDIT_BUILD_DIR ?? ".next");
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

const chunkFiles = listJavaScript(staticDirectory);
const markerFiles = chunkFiles.filter((file) => fs.readFileSync(file, "utf8").includes(marker));
const passed = mode === "normal" ? markerFiles.length === 0 : markerFiles.length > 0;
const report = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  mode,
  buildDirectory,
  chunkCount: chunkFiles.length,
  markerCount: markerFiles.length,
  markerFiles: markerFiles.map((file) => path.relative(buildDirectory, file).replaceAll("\\", "/")),
  status: passed ? "pass" : "fail",
};

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
console.log(JSON.stringify(report, null, 2));
if (!passed) process.exitCode = 1;
