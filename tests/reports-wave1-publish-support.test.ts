import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  REPORTS_WAVE1_BUILD_MANIFEST_FILENAME,
  REPORTS_WAVE1_EVIDENCE_RELATIVE_DIR,
  REPORTS_WAVE1_PUBLISHER,
  resolveReportsWave1OutputDirectory,
  validateReportsWave1BuildManifest,
  writeReportsWave1BuildManifest,
} from "@/scripts/reports_wave1_publish_support.mjs";

const root = process.cwd();

function createFixtureBuild(rootDirectory: string): string {
  const buildDirectory = path.join(rootDirectory, ".next");
  fs.mkdirSync(path.join(buildDirectory, "server", "app"), { recursive: true });
  fs.mkdirSync(path.join(buildDirectory, "static", "chunks", "app"), { recursive: true });
  fs.writeFileSync(path.join(buildDirectory, "BUILD_ID"), "reports-wave1-fixture\n", "utf8");
  fs.writeFileSync(path.join(buildDirectory, "app-build-manifest.json"), "{\"pages\":[]}\n", "utf8");
  fs.writeFileSync(path.join(buildDirectory, "build-manifest.json"), "{\"rootMainFiles\":[]}\n", "utf8");
  fs.writeFileSync(path.join(buildDirectory, "prerender-manifest.json"), "{\"version\":4}\n", "utf8");
  fs.writeFileSync(path.join(buildDirectory, "required-server-files.json"), "{\"version\":1}\n", "utf8");
  fs.writeFileSync(path.join(buildDirectory, "routes-manifest.json"), "{\"version\":3}\n", "utf8");
  fs.writeFileSync(path.join(buildDirectory, "server", "app", "reports.js"), "module.exports = 'reports';\n", "utf8");
  fs.writeFileSync(path.join(buildDirectory, "static", "chunks", "app", "reports.js"), "console.log('reports');\n", "utf8");
  return buildDirectory;
}

describe("Reports Wave 1 publish support", () => {
  it("defaults browser evidence output to unique temp directories and publishes only explicitly", () => {
    const first = resolveReportsWave1OutputDirectory({ root, env: {} });
    const second = resolveReportsWave1OutputDirectory({ root, env: {} });
    const published = resolveReportsWave1OutputDirectory({
      root,
      env: { SAFECLAW_REPORTS_WAVE1_PUBLISH: "1" },
    });

    expect(first.publish).toBe(false);
    expect(first.cleanup).toBe(true);
    expect(second.publish).toBe(false);
    expect(second.cleanup).toBe(true);
    expect(first.directory).not.toBe(second.directory);
    expect(path.dirname(first.directory)).toBe(os.tmpdir());
    expect(path.dirname(second.directory)).toBe(os.tmpdir());
    expect(fs.existsSync(first.directory)).toBe(true);
    expect(fs.existsSync(second.directory)).toBe(true);

    expect(published).toEqual({
      directory: path.join(root, REPORTS_WAVE1_EVIDENCE_RELATIVE_DIR),
      publish: true,
      cleanup: false,
    });

    fs.rmSync(first.directory, { recursive: true, force: true });
    fs.rmSync(second.directory, { recursive: true, force: true });
  });

  it("writes explicit build manifests and rejects stale or mismatched production builds", () => {
    const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "safeclaw-wave1-manifest-"));
    const buildDirectory = createFixtureBuild(tempRoot);
    const manifestPath = path.join(tempRoot, REPORTS_WAVE1_BUILD_MANIFEST_FILENAME);
    const productIdentity = {
      sourceSha: "6af13474726d8c3f7f992f6a2f94ef9aa687011e",
      sourceIdentity: "a".repeat(64),
      sourceFiles: ["app/globals.css", "components/ReportsDownloadCenter.tsx"],
    };

    const manifest = writeReportsWave1BuildManifest({
      root: tempRoot,
      buildDirectory,
      outputPath: manifestPath,
      publisherCommand: "node .\\scripts\\publish_reports_wave1_evidence.mjs",
      publisherCommitSha: "1".repeat(40),
      productIdentity,
    });

    expect(manifest.publisher).toBe(REPORTS_WAVE1_PUBLISHER);
    expect(manifest.productSourceSha).toBe(productIdentity.sourceSha);
    expect(manifest.buildDirectory).toBe(".next");

    expect(
      validateReportsWave1BuildManifest({
        root: tempRoot,
        manifestPath,
        expectedBuildDirectory: buildDirectory,
        productIdentity,
      }),
    ).toMatchObject({
      publisher: REPORTS_WAVE1_PUBLISHER,
      productSourceSha: productIdentity.sourceSha,
      buildId: "reports-wave1-fixture",
    });

    fs.writeFileSync(path.join(buildDirectory, "static", "chunks", "app", "reports.js"), "console.log('stale');\n", "utf8");
    expect(() => validateReportsWave1BuildManifest({
      root: tempRoot,
      manifestPath,
      expectedBuildDirectory: buildDirectory,
      productIdentity,
    })).toThrow(/build identity mismatch/u);

    fs.writeFileSync(path.join(buildDirectory, "static", "chunks", "app", "reports.js"), "console.log('reports');\n", "utf8");
    expect(() => validateReportsWave1BuildManifest({
      root: tempRoot,
      manifestPath,
      expectedBuildDirectory: buildDirectory,
      productIdentity: {
        ...productIdentity,
        sourceSha: "2".repeat(40),
      },
    })).toThrow(/source SHA mismatch/u);

    fs.rmSync(tempRoot, { recursive: true, force: true });
  });
});
