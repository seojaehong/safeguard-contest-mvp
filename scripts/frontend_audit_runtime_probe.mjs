#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";

import { chromium } from "playwright";

import { canonicalFrontendSourceIdentity } from "./frontend_audit_source_identity.mjs";
import { filterExpectedBoundaryErrors } from "./frontend_consistency_browser_audit.mjs";

const confirmationMessage = "SafeClaw deterministic frontend audit error boundary confirmed";

function readMode() {
  const modeIndex = process.argv.indexOf("--mode");
  const mode = modeIndex >= 0 ? process.argv[modeIndex + 1] : "";
  if (!["normal", "audit"].includes(mode)) {
    throw new Error("Usage: frontend_audit_runtime_probe.mjs --mode normal|audit");
  }
  return mode;
}

async function main() {
  const mode = readMode();
  const root = process.cwd();
  const command = `node ./scripts/frontend_audit_runtime_probe.mjs --mode ${mode}`;
  const buildDirectory = path.resolve(process.env.FRONTEND_AUDIT_BUILD_DIR ?? ".next");
  const buildIdPath = path.join(buildDirectory, "BUILD_ID");
  if (!fs.existsSync(buildIdPath)) throw new Error(`Missing BUILD_ID: ${buildIdPath}`);
  const buildId = fs.readFileSync(buildIdPath, "utf8").trim();
  const sourceSha = execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).trim();
  const { sourceIdentity } = canonicalFrontendSourceIdentity(root);
  const baseUrl = process.env.FRONTEND_AUDIT_BASE_URL ?? "http://127.0.0.1:3011";
  const requestedPath = "/dryrun?__auditBoundary=error";
  const outputPath = path.resolve(
    process.env.OUTPUT_PATH ?? `evaluation/audit-error-boundary-2026-07-15/${mode}-runtime-probe.json`,
  );

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const rawPageErrors = [];
  const rawConsoleErrors = [];
  page.on("pageerror", (error) => rawPageErrors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") rawConsoleErrors.push(message.text());
  });

  const response = await page.goto(`${baseUrl}${requestedPath}`, {
    waitUntil: "domcontentloaded",
    timeout: 30_000,
  });
  if (mode === "audit") {
    await page.waitForSelector('[data-audit-boundary="error"]', { timeout: 8_000 });
  }
  await page.waitForTimeout(650);
  const { boundaryMarker, boundaryMarkerCount } = await page.evaluate(() => ({
    boundaryMarker: document.querySelector("[data-audit-boundary]")?.getAttribute("data-audit-boundary") ?? "",
    boundaryMarkerCount: document.querySelectorAll("[data-audit-boundary]").length,
  }));
  const probeConfirmed = rawPageErrors.includes(confirmationMessage)
    || rawConsoleErrors.includes(confirmationMessage);
  const pageErrors = mode === "audit"
    ? filterExpectedBoundaryErrors(rawPageErrors, "error", "page", probeConfirmed)
    : [...rawPageErrors];
  const consoleErrors = mode === "audit"
    ? filterExpectedBoundaryErrors(rawConsoleErrors, "error", "console", probeConfirmed)
    : [...rawConsoleErrors];
  const row = {
    route: "special:error",
    viewport: "desktop-1440",
    requestedUrl: `${baseUrl}${requestedPath}`,
    finalUrl: page.url(),
    status: response?.status() ?? 0,
    boundaryMarker,
    boundaryMarkerCount,
    probeConfirmed,
    rawConsoleErrors,
    rawPageErrors,
    consoleErrors,
    pageErrors,
  };
  await browser.close();

  const passed = mode === "audit"
    ? row.status === 500
      && row.boundaryMarker === "error"
      && row.boundaryMarkerCount === 1
      && row.probeConfirmed
      && row.consoleErrors.length === 0
      && row.pageErrors.length === 0
    : row.status === 200
      && row.boundaryMarker === ""
      && row.boundaryMarkerCount === 0
      && row.consoleErrors.length === 0
      && row.pageErrors.length === 0;
  const report = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    command,
    mode,
    sourceSha,
    sourceIdentity,
    buildId,
    buildDirectory: path.relative(root, buildDirectory).replaceAll("\\", "/") || ".",
    row,
    status: passed ? "pass" : "fail",
  };
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  console.log(JSON.stringify(report, null, 2));
  if (!passed) process.exitCode = 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) await main();
