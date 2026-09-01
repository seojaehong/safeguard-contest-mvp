#!/usr/bin/env node

import path from "node:path";
import process from "node:process";
import { spawnWithBudget } from "./operator_smoke_resource_budget.mjs";

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
const PUBLISH_STEP_TIMEOUT_MS = 10 * 60 * 1000;
const PUBLISH_STEP_MAX_BUFFER_BYTES = 20 * 1024 * 1024;

async function run(command, args, env = {}) {
  const result = await spawnWithBudget(process.env.ComSpec || "cmd.exe", ["/d", "/s", "/c", command, ...args], {
    cwd: root,
    env: {
      ...process.env,
      NEXT_TELEMETRY_DISABLED: "1",
      ...env,
    },
    encoding: "utf8",
  }, {
    timeoutMs: PUBLISH_STEP_TIMEOUT_MS,
    maxBufferBytes: PUBLISH_STEP_MAX_BUFFER_BYTES,
    onStdout: (chunk) => process.stdout.write(chunk),
    onStderr: (chunk) => process.stderr.write(chunk),
  });
  if (result.error || result.status !== 0) {
    const failureReason = result.error instanceof Error ? result.error.message : `exit code ${result.status ?? "unknown"}`;
    throw new Error(`${command} ${args.join(" ")} failed with ${failureReason}`);
  }
}

await run("npm.cmd", ["run", "build"], browserEvidenceEnvironment);
const manifest = writeReportsWave1BuildManifest({
  root,
  buildDirectory: path.join(root, ".next"),
  outputPath: manifestPath,
  publisherCommand: "node .\\scripts\\publish_reports_wave1_evidence.mjs",
});
await run("npm.cmd", [
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
