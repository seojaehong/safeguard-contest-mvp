import crypto from "node:crypto";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

export const REPORTS_WAVE1_EVIDENCE_RELATIVE_DIR =
  "evaluation/frontend-design-contract-remediation-2026-07-12/wave-1-reports";
export const REPORTS_WAVE1_BUILD_MANIFEST_FILENAME = "reports-wave1-build-manifest.json";
export const REPORTS_WAVE1_PRODUCT_RELATIVE_FILES = [
  "app/globals.css",
  "app/reports/page.tsx",
  "components/ReportsDownloadCenter.tsx",
  "components/SafeClawModuleShell.tsx",
];
export const REPORTS_WAVE1_PUBLISHER = "safeclaw-reports-wave1-explicit-publish";

function normalizeRelative(filePath) {
  return filePath.replaceAll("\\", "/");
}

function ensureWithinRoot(root, targetPath, label) {
  const absoluteRoot = path.resolve(root);
  const absoluteTarget = path.resolve(targetPath);
  const workspacePrefix = `${absoluteRoot}${path.sep}`;
  if (absoluteTarget !== absoluteRoot && !absoluteTarget.startsWith(workspacePrefix)) {
    throw new Error(`Refusing to use ${label} outside workspace root: ${absoluteTarget}`);
  }
  return absoluteTarget;
}

export function listFilesRecursively(directory) {
  if (!fs.existsSync(directory)) return [];
  const result = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const absolutePath = path.join(directory, entry.name);
    if (entry.isDirectory()) result.push(...listFilesRecursively(absolutePath));
    else result.push(absolutePath);
  }
  return result.sort();
}

export function digestFiles(baseDirectory, files) {
  if (!files.length) throw new Error(`Cannot digest an empty file set under ${baseDirectory}`);
  const hash = crypto.createHash("sha256");
  for (const filePath of [...files].sort()) {
    hash.update(normalizeRelative(path.relative(baseDirectory, filePath)));
    hash.update("\0");
    hash.update(fs.readFileSync(filePath));
    hash.update("\0");
  }
  return hash.digest("hex");
}

function absoluteProductFiles(root, relativeFiles = REPORTS_WAVE1_PRODUCT_RELATIVE_FILES) {
  const absoluteFiles = relativeFiles.map((relativePath) => path.join(root, relativePath));
  for (const filePath of absoluteFiles) {
    if (!fs.existsSync(filePath)) throw new Error(`Missing Reports Wave 1 product file: ${filePath}`);
  }
  return absoluteFiles;
}

export function getReportsWave1ProductIdentity(root, relativeFiles = REPORTS_WAVE1_PRODUCT_RELATIVE_FILES) {
  const absoluteFiles = absoluteProductFiles(root, relativeFiles);
  const gitPaths = relativeFiles.map(normalizeRelative);
  const sourceSha = execFileSync("git", ["log", "-n", "1", "--format=%H", "--", ...gitPaths], {
    cwd: root,
    encoding: "utf8",
  }).trim();
  if (!/^[0-9a-f]{40}$/u.test(sourceSha)) {
    throw new Error(`Unable to resolve Reports Wave 1 product source SHA for ${gitPaths.join(", ")}`);
  }
  return {
    sourceSha,
    sourceIdentity: digestFiles(root, absoluteFiles),
    sourceFiles: [...relativeFiles],
  };
}

export function computeNextBuildIdentity({ root = process.cwd(), buildDirectory = path.join(root, ".next") } = {}) {
  const absoluteRoot = path.resolve(root);
  const absoluteBuildDirectory = ensureWithinRoot(absoluteRoot, buildDirectory, "Next build directory");
  const buildIdPath = path.join(absoluteBuildDirectory, "BUILD_ID");
  if (!fs.existsSync(buildIdPath)) {
    throw new Error(`Missing BUILD_ID in production build directory: ${buildIdPath}`);
  }
  const requiredTopLevelFiles = [
    "app-build-manifest.json",
    "build-manifest.json",
    "prerender-manifest.json",
    "required-server-files.json",
    "routes-manifest.json",
  ]
    .map((fileName) => path.join(absoluteBuildDirectory, fileName))
    .filter((filePath) => fs.existsSync(filePath));
  const servingDirectories = ["server", "static"]
    .map((directoryName) => path.join(absoluteBuildDirectory, directoryName))
    .filter((directoryPath) => fs.existsSync(directoryPath));
  const buildFiles = [
    buildIdPath,
    ...requiredTopLevelFiles,
    ...servingDirectories.flatMap((directoryPath) => listFilesRecursively(directoryPath)),
  ];
  if (buildFiles.length < 3) {
    throw new Error(`Production build identity is incomplete under ${absoluteBuildDirectory}`);
  }
  return {
    buildDirectory: absoluteBuildDirectory,
    relativeBuildDirectory: normalizeRelative(path.relative(absoluteRoot, absoluteBuildDirectory) || "."),
    buildId: fs.readFileSync(buildIdPath, "utf8").trim(),
    buildIdentity: digestFiles(absoluteBuildDirectory, buildFiles),
    buildFileCount: buildFiles.length,
  };
}

export function resolveReportsWave1OutputDirectory({
  root = process.cwd(),
  env = process.env,
  prefix = "safeclaw-reports-wave1-",
  tempRoot = os.tmpdir(),
  makeTempDirectory = fs.mkdtempSync,
} = {}) {
  if (env.SAFECLAW_REPORTS_WAVE1_PUBLISH === "1") {
    const directory = path.join(root, REPORTS_WAVE1_EVIDENCE_RELATIVE_DIR);
    fs.mkdirSync(directory, { recursive: true });
    return { directory, publish: true, cleanup: false };
  }
  const directory = makeTempDirectory(path.join(tempRoot, prefix));
  return { directory, publish: false, cleanup: true };
}

export function writeReportsWave1BuildManifest({
  root = process.cwd(),
  buildDirectory = path.join(root, ".next"),
  outputPath = path.join(root, REPORTS_WAVE1_EVIDENCE_RELATIVE_DIR, REPORTS_WAVE1_BUILD_MANIFEST_FILENAME),
  publisherCommand = "node .\\scripts\\publish_reports_wave1_evidence.mjs",
  publisherCommitSha = execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).trim(),
  productIdentity,
} = {}) {
  const absoluteRoot = path.resolve(root);
  const identity = productIdentity ?? getReportsWave1ProductIdentity(absoluteRoot);
  const build = computeNextBuildIdentity({ root: absoluteRoot, buildDirectory });
  const absoluteOutputPath = ensureWithinRoot(absoluteRoot, outputPath, "Reports Wave 1 build manifest");
  const manifest = {
    schemaVersion: 1,
    publisher: REPORTS_WAVE1_PUBLISHER,
    generatedAt: new Date().toISOString(),
    publisherCommitSha,
    publisherCommand,
    productSourceSha: identity.sourceSha,
    productSourceIdentity: identity.sourceIdentity,
    productSourceFiles: identity.sourceFiles,
    buildDirectory: build.relativeBuildDirectory,
    buildId: build.buildId,
    buildIdentity: build.buildIdentity,
    buildFileCount: build.buildFileCount,
  };
  fs.mkdirSync(path.dirname(absoluteOutputPath), { recursive: true });
  fs.writeFileSync(absoluteOutputPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  return manifest;
}

export function validateReportsWave1BuildManifest({
  root = process.cwd(),
  manifestPath,
  expectedBuildDirectory = path.join(root, ".next"),
  productIdentity,
} = {}) {
  if (!manifestPath) throw new Error("A production build manifest path is required.");
  const absoluteRoot = path.resolve(root);
  const absoluteManifestPath = ensureWithinRoot(absoluteRoot, manifestPath, "Reports Wave 1 build manifest");
  if (!fs.existsSync(absoluteManifestPath)) {
    throw new Error(`Production build manifest is missing: ${absoluteManifestPath}`);
  }
  const manifest = JSON.parse(fs.readFileSync(absoluteManifestPath, "utf8"));
  if (manifest.schemaVersion !== 1 || manifest.publisher !== REPORTS_WAVE1_PUBLISHER) {
    throw new Error(`Unsupported production build manifest: ${absoluteManifestPath}`);
  }
  const expectedBuild = ensureWithinRoot(absoluteRoot, expectedBuildDirectory, "expected Next build directory");
  const declaredBuild = ensureWithinRoot(absoluteRoot, path.join(absoluteRoot, manifest.buildDirectory), "declared Next build directory");
  if (declaredBuild !== expectedBuild) {
    throw new Error(`Production build manifest points to ${declaredBuild}, expected ${expectedBuild}`);
  }
  const currentIdentity = productIdentity ?? getReportsWave1ProductIdentity(absoluteRoot);
  if (manifest.productSourceSha !== currentIdentity.sourceSha) {
    throw new Error(
      `Production build manifest source SHA mismatch: ${manifest.productSourceSha} != ${currentIdentity.sourceSha}`,
    );
  }
  if (manifest.productSourceIdentity !== currentIdentity.sourceIdentity) {
    throw new Error("Production build manifest source identity mismatch.");
  }
  const currentBuild = computeNextBuildIdentity({ root: absoluteRoot, buildDirectory: declaredBuild });
  if (manifest.buildId !== currentBuild.buildId) {
    throw new Error(`Production build manifest BUILD_ID mismatch: ${manifest.buildId} != ${currentBuild.buildId}`);
  }
  if (manifest.buildIdentity !== currentBuild.buildIdentity) {
    throw new Error("Production build manifest build identity mismatch.");
  }
  return {
    ...manifest,
    absoluteManifestPath,
    absoluteBuildDirectory: declaredBuild,
  };
}
