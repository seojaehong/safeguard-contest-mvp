#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import path from "node:path";
import process from "node:process";

import {
  REPORTS_WAVE1_BUILD_MANIFEST_FILENAME,
  REPORTS_WAVE1_EVIDENCE_RELATIVE_DIR,
  writeReportsWave1BuildManifest,
} from "./reports_wave1_publish_support.mjs";

const root = process.cwd();
const evidenceDirectory = path.join(root, REPORTS_WAVE1_EVIDENCE_RELATIVE_DIR);
const manifestPath = path.join(evidenceDirectory, REPORTS_WAVE1_BUILD_MANIFEST_FILENAME);
const browserEvidenceEnvironment = {
  NEXT_PUBLIC_SUPABASE_URL: "https://wave8-fixture.supabase.co",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "wave8-public-anon-key",
};

function run(command, args, env = {}) {
  const result = spawnSync(process.env.ComSpec || "cmd.exe", ["/d", "/s", "/c", command, ...args], {
    cwd: root,
    env: {
      ...process.env,
      NEXT_TELEMETRY_DISABLED: "1",
      ...env,
    },
    stdio: "inherit",
    windowsHide: true,
  });
  if (result.status !== 0) {
    const failureReason = result.error instanceof Error ? result.error.message : `exit code ${result.status ?? "unknown"}`;
    throw new Error(`${command} ${args.join(" ")} failed with ${failureReason}`);
  }
}

run("npm.cmd", ["run", "build"], browserEvidenceEnvironment);
const manifest = writeReportsWave1BuildManifest({
  root,
  buildDirectory: path.join(root, ".next"),
  outputPath: manifestPath,
  publisherCommand: "node .\\scripts\\publish_reports_wave1_evidence.mjs",
});
run("npm.cmd", [
  "test",
  "--",
  "tests/reports-design-remediation.test.ts",
  "-t",
  "Reports Wave 1 browser design contract",
  "--pool=forks",
  "--maxWorkers=1",
  "--reporter=verbose",
], {
  ...browserEvidenceEnvironment,
  SAFECLAW_HARNESS_MODE: "prod",
  SAFECLAW_PRODUCTION_BUILD_MANIFEST: manifestPath,
  SAFECLAW_REPORTS_WAVE1_PUBLISH: "1",
});

console.log(JSON.stringify({
  published: true,
  manifestPath: path.relative(root, manifestPath).replaceAll("\\", "/"),
  productSourceSha: manifest.productSourceSha,
  buildId: manifest.buildId,
}, null, 2));
