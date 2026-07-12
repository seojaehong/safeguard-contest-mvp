import crypto from "node:crypto";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import ts from "typescript";

export const REPORTS_WAVE1_EVIDENCE_RELATIVE_DIR =
  "evaluation/frontend-design-contract-remediation-2026-07-12/wave-1-reports";
export const REPORTS_WAVE1_BUILD_MANIFEST_FILENAME = "reports-wave1-build-manifest.json";
export const REPORTS_WAVE1_PRODUCT_ENTRY_FILES = [
  "next.config.mjs",
  "app/error.tsx",
  "app/global-error.tsx",
  "app/globals.css",
  "app/layout.tsx",
  "app/not-found.tsx",
  "app/reports/page.tsx",
];
export const REPORTS_WAVE1_PRODUCT_RELATIVE_FILES = REPORTS_WAVE1_PRODUCT_ENTRY_FILES;
export const REPORTS_WAVE1_PUBLISHER_RELATIVE_FILES = [
  "scripts/publish_reports_wave1_evidence.mjs",
  "scripts/reports_wave1_publish_support.mjs",
];
export const REPORTS_WAVE1_PUBLISHER = "safeclaw-reports-wave1-explicit-publish";
export const REPORTS_WAVE1_SOURCE_IDENTITY_ALGORITHM = "git-head-runtime-contract-blob-oids-sha256-v2";

const LOCAL_SOURCE_EXTENSIONS = [".ts", ".tsx", ".js", ".jsx", ".mjs", ".css", ".json"];
const SPECIAL_LOCAL_IMPORTS = new Map([
  [
    "safeclaw-audit-error-escalation",
    [
      "lib/frontend-audit/GlobalBoundaryProbe.audit.tsx",
      "lib/frontend-audit/GlobalBoundaryProbe.noop.tsx",
    ],
  ],
]);

function normalizeRelative(filePath) {
  return filePath.replaceAll("\\", "/");
}

function normalizeIdentityRelative(filePath) {
  if (path.isAbsolute(filePath)) {
    throw new Error(`Reports Wave 1 identity paths must be relative: ${filePath}`);
  }
  const normalized = path.posix.normalize(normalizeRelative(filePath).replace(/^\.\//u, ""));
  if (!normalized || normalized === "." || normalized === ".." || normalized.startsWith("../")) {
    throw new Error(`Reports Wave 1 identity path escapes the repository: ${filePath}`);
  }
  return normalized;
}

function resolveGitHeadSha(root) {
  const sourceSha = execFileSync("git", ["rev-parse", "--verify", "HEAD"], {
    cwd: root,
    encoding: "utf8",
  }).trim();
  if (!/^[0-9a-f]{40}$/u.test(sourceSha)) {
    throw new Error(`Unable to resolve Reports Wave 1 Git HEAD in ${root}`);
  }
  return sourceSha;
}

function listGitTree(root, commitSha) {
  const output = execFileSync("git", ["ls-tree", "-r", "-z", commitSha], {
    cwd: root,
    encoding: "utf8",
  });
  const entries = new Map();
  for (const record of output.split("\0").filter(Boolean)) {
    const tabIndex = record.indexOf("\t");
    const header = record.slice(0, tabIndex).split(" ");
    const relativePath = normalizeIdentityRelative(record.slice(tabIndex + 1));
    entries.set(relativePath, header[2]);
  }
  return entries;
}

function moduleSpecifiers(relativePath, source) {
  if (/\.(?:css|json)$/u.test(relativePath)) return [];
  const sourceFile = ts.createSourceFile(relativePath, source.toString("utf8"), ts.ScriptTarget.Latest, true);
  const specifiers = new Set();
  const visit = (node) => {
    if (
      (ts.isImportDeclaration(node) || ts.isExportDeclaration(node))
      && node.moduleSpecifier
      && ts.isStringLiteralLike(node.moduleSpecifier)
    ) {
      specifiers.add(node.moduleSpecifier.text);
    }
    if (
      ts.isCallExpression(node)
      && node.arguments.length === 1
      && ts.isStringLiteralLike(node.arguments[0])
      && (
        node.expression.kind === ts.SyntaxKind.ImportKeyword
        || (ts.isIdentifier(node.expression) && node.expression.text === "require")
      )
    ) {
      specifiers.add(node.arguments[0].text);
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return [...specifiers];
}

function runtimeReferenceTemplates(relativePath, source) {
  if (/\.(?:css|json)$/u.test(relativePath)) return [];
  const sourceFile = ts.createSourceFile(relativePath, source.toString("utf8"), ts.ScriptTarget.Latest, true);
  const references = new Set();
  const visit = (node) => {
    if (ts.isStringLiteralLike(node)) {
      references.add(node.text);
    } else if (ts.isTemplateExpression(node)) {
      references.add([
        node.head.text,
        ...node.templateSpans.flatMap((span) => ["${*}", span.literal.text]),
      ].join(""));
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return [...references].filter((reference) => reference.startsWith("/") && !reference.startsWith("//"));
}

function runtimePathSegments(reference) {
  const pathname = reference.split(/[?#]/u, 1)[0];
  return pathname.split("/").filter(Boolean).map((segment) => segment.includes("${*}") ? "*" : segment);
}

function routeContract(relativePath) {
  const segments = normalizeRelative(relativePath).split("/");
  if (segments.shift() !== "app") return null;
  const fileName = segments.pop();
  if (!fileName || !/^(?:page|route)\.(?:ts|tsx|js|jsx|mjs)$/u.test(fileName)) return null;
  return {
    relativePath,
    segments: segments.filter((segment) => !/^\(.+\)$/u.test(segment) && !segment.startsWith("@")),
  };
}

function routeMatchesReference(routeSegments, referenceSegments) {
  const catchAllIndex = routeSegments.findIndex((segment) => /^\[\[?\.\.\./u.test(segment));
  if (catchAllIndex === -1 && routeSegments.length !== referenceSegments.length) return false;
  if (catchAllIndex !== -1 && referenceSegments.length < catchAllIndex) return false;
  const comparedLength = catchAllIndex === -1 ? routeSegments.length : catchAllIndex;
  for (let index = 0; index < comparedLength; index += 1) {
    const routeSegment = routeSegments[index];
    const referenceSegment = referenceSegments[index];
    if (referenceSegment === "*" || /^\[[^\]]+\]$/u.test(routeSegment)) continue;
    if (routeSegment !== referenceSegment) return false;
  }
  return true;
}

function resolveRuntimeContracts(reference, trackedFiles, routeContracts) {
  const result = [];
  if (!reference.includes("${*}")) {
    const pathname = reference.split(/[?#]/u, 1)[0];
    const publicFile = normalizeIdentityRelative(`public${pathname}`);
    if (trackedFiles.has(publicFile)) result.push(publicFile);
  }
  const referenceSegments = runtimePathSegments(reference);
  for (const contract of routeContracts) {
    if (routeMatchesReference(contract.segments, referenceSegments)) {
      result.push(contract.relativePath);
    }
  }
  return result;
}

function resolveLocalImport(importer, specifier, trackedFiles) {
  const specialFiles = SPECIAL_LOCAL_IMPORTS.get(specifier);
  if (specialFiles) return [...specialFiles];

  let unresolvedPath;
  if (specifier.startsWith("@/")) {
    unresolvedPath = specifier.slice(2);
  } else if (specifier.startsWith(".")) {
    unresolvedPath = path.posix.join(path.posix.dirname(importer), normalizeRelative(specifier));
  } else {
    return [];
  }

  const normalizedPath = normalizeIdentityRelative(unresolvedPath);
  const candidates = [
    normalizedPath,
    ...LOCAL_SOURCE_EXTENSIONS.map((extension) => `${normalizedPath}${extension}`),
    ...LOCAL_SOURCE_EXTENSIONS.map((extension) => path.posix.join(normalizedPath, `index${extension}`)),
  ];
  const resolved = candidates.find((candidate) => trackedFiles.has(candidate));
  if (!resolved) {
    throw new Error(`Unable to resolve Reports Wave 1 dependency ${specifier} imported by ${importer}`);
  }
  return [resolved];
}

export function collectReportsWave1ProductFiles(root, commitSha = resolveGitHeadSha(root)) {
  const trackedFiles = listGitTree(root, commitSha);
  const routeContracts = [...trackedFiles.keys()].map(routeContract).filter(Boolean);
  const pending = [...REPORTS_WAVE1_PRODUCT_ENTRY_FILES];
  const sourceFiles = new Set();
  const runtimeContractFiles = new Set();

  while (pending.length) {
    const relativePath = normalizeIdentityRelative(pending.shift());
    if (sourceFiles.has(relativePath)) continue;
    if (!trackedFiles.has(relativePath)) {
      throw new Error(`Missing committed Reports Wave 1 product file: ${relativePath}`);
    }
    sourceFiles.add(relativePath);
    const source = fs.readFileSync(path.join(root, relativePath));
    for (const reference of runtimeReferenceTemplates(relativePath, source)) {
      for (const contractFile of resolveRuntimeContracts(reference, trackedFiles, routeContracts)) {
        runtimeContractFiles.add(contractFile);
      }
    }
    for (const specifier of moduleSpecifiers(relativePath, source)) {
      for (const dependency of resolveLocalImport(relativePath, specifier, trackedFiles)) {
        if (!sourceFiles.has(dependency)) pending.push(dependency);
      }
    }
  }

  return [...new Set([...sourceFiles, ...runtimeContractFiles])].sort();
}

function assertIdentityFilesClean(root, relativeFiles) {
  const status = execFileSync(
    "git",
    ["status", "--porcelain=v1", "--untracked-files=all", "--", ...relativeFiles],
    { cwd: root, encoding: "utf8" },
  ).trimEnd();
  if (status) {
    throw new Error(`Reports Wave 1 identity files are not clean:\n${status}`);
  }
}

function assertCommitContainsFiles(root, commitSha, relativeFiles, label) {
  if (!/^[0-9a-f]{40}$/u.test(commitSha)) {
    throw new Error(`Invalid ${label} commit SHA: ${commitSha}`);
  }
  const trackedFiles = listGitTree(root, commitSha);
  const missingFiles = relativeFiles.filter((relativePath) => !trackedFiles.has(relativePath));
  if (missingFiles.length) {
    throw new Error(`${label} commit ${commitSha} does not contain: ${missingFiles.join(", ")}`);
  }
}

function assertCommitIsAncestorOfHead(root, commitSha, label) {
  try {
    execFileSync("git", ["merge-base", "--is-ancestor", commitSha, "HEAD"], {
      cwd: root,
      stdio: "ignore",
    });
  } catch {
    throw new Error(`${label} commit ${commitSha} is not an ancestor of Git HEAD`);
  }
}

function resolveProductSourceSha(root, sourceFiles) {
  const sourceSha = execFileSync(
    "git",
    ["log", "-n", "1", "--format=%H", "HEAD", "--", ...sourceFiles, ...REPORTS_WAVE1_PUBLISHER_RELATIVE_FILES],
    { cwd: root, encoding: "utf8" },
  ).trim();
  if (!/^[0-9a-f]{40}$/u.test(sourceSha)) {
    throw new Error(`Unable to resolve Reports Wave 1 source commit for ${sourceFiles.join(", ")}`);
  }
  return sourceSha;
}

function digestGitFiles(root, commitSha, relativeFiles) {
  if (!relativeFiles.length) throw new Error(`Cannot digest an empty Git file set in ${root}`);
  const trackedFiles = listGitTree(root, commitSha);
  const hash = crypto.createHash("sha256");
  for (const relativePath of [...relativeFiles].sort()) {
    const blobOid = trackedFiles.get(relativePath);
    if (!blobOid) throw new Error(`Missing committed Reports Wave 1 identity file: ${relativePath}`);
    hash.update(relativePath);
    hash.update("\0");
    hash.update(blobOid);
    hash.update("\0");
  }
  return hash.digest("hex");
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

export function getReportsWave1ProductIdentity(root, relativeFiles) {
  const headSha = resolveGitHeadSha(root);
  const sourceFiles = relativeFiles
    ? [...new Set(relativeFiles.map(normalizeIdentityRelative))].sort()
    : collectReportsWave1ProductFiles(root, headSha);
  assertIdentityFilesClean(root, sourceFiles);
  assertCommitContainsFiles(root, headSha, sourceFiles, "Reports Wave 1 HEAD");
  const sourceSha = resolveProductSourceSha(root, sourceFiles);
  assertCommitContainsFiles(
    root,
    sourceSha,
    REPORTS_WAVE1_PUBLISHER_RELATIVE_FILES,
    "Reports Wave 1 product source",
  );
  return {
    sourceSha,
    sourceIdentity: digestGitFiles(root, headSha, sourceFiles),
    sourceFiles,
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

export function cleanupReportsWave1OutputDirectory(
  output,
  { tempRoot = os.tmpdir() } = {},
) {
  if (!output.cleanup) return;
  const absoluteTempRoot = path.resolve(tempRoot);
  const absoluteDirectory = path.resolve(output.directory);
  if (
    absoluteDirectory === absoluteTempRoot
    || !absoluteDirectory.startsWith(`${absoluteTempRoot}${path.sep}`)
  ) {
    throw new Error(`Refusing to remove Reports Wave 1 output outside its temp root: ${absoluteDirectory}`);
  }
  fs.rmSync(absoluteDirectory, { recursive: true, force: true });
}

function sameStringArray(actual, expected) {
  return Array.isArray(actual)
    && actual.length === expected.length
    && actual.every((value, index) => value === expected[index]);
}

export function writeReportsWave1BuildManifest({
  root = process.cwd(),
  buildDirectory = path.join(root, ".next"),
  outputPath = path.join(root, REPORTS_WAVE1_EVIDENCE_RELATIVE_DIR, REPORTS_WAVE1_BUILD_MANIFEST_FILENAME),
  publisherCommand = "node .\\scripts\\publish_reports_wave1_evidence.mjs",
  publisherCommitSha = resolveGitHeadSha(root),
  productIdentity,
} = {}) {
  const absoluteRoot = path.resolve(root);
  const identity = productIdentity ?? getReportsWave1ProductIdentity(absoluteRoot);
  assertIdentityFilesClean(absoluteRoot, REPORTS_WAVE1_PUBLISHER_RELATIVE_FILES);
  assertCommitContainsFiles(
    absoluteRoot,
    publisherCommitSha,
    REPORTS_WAVE1_PUBLISHER_RELATIVE_FILES,
    "Reports Wave 1 publisher",
  );
  assertCommitContainsFiles(
    absoluteRoot,
    identity.sourceSha,
    REPORTS_WAVE1_PUBLISHER_RELATIVE_FILES,
    "Reports Wave 1 product source",
  );
  assertCommitIsAncestorOfHead(absoluteRoot, publisherCommitSha, "Reports Wave 1 publisher");
  assertCommitIsAncestorOfHead(absoluteRoot, identity.sourceSha, "Reports Wave 1 product source");
  const build = computeNextBuildIdentity({ root: absoluteRoot, buildDirectory });
  const absoluteOutputPath = ensureWithinRoot(absoluteRoot, outputPath, "Reports Wave 1 build manifest");
  const manifest = {
    schemaVersion: 2,
    publisher: REPORTS_WAVE1_PUBLISHER,
    generatedAt: new Date().toISOString(),
    publisherCommitSha,
    publisherCommand,
    publisherSourceFiles: [...REPORTS_WAVE1_PUBLISHER_RELATIVE_FILES],
    productSourceSha: identity.sourceSha,
    productSourceIdentityAlgorithm: REPORTS_WAVE1_SOURCE_IDENTITY_ALGORITHM,
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
  if (manifest.schemaVersion !== 2 || manifest.publisher !== REPORTS_WAVE1_PUBLISHER) {
    throw new Error(`Unsupported production build manifest: ${absoluteManifestPath}`);
  }
  if (manifest.productSourceIdentityAlgorithm !== REPORTS_WAVE1_SOURCE_IDENTITY_ALGORITHM) {
    throw new Error(`Unsupported Reports Wave 1 source identity algorithm: ${manifest.productSourceIdentityAlgorithm}`);
  }
  if (!sameStringArray(manifest.publisherSourceFiles, REPORTS_WAVE1_PUBLISHER_RELATIVE_FILES)) {
    throw new Error("Production build manifest publisher source files mismatch.");
  }
  assertIdentityFilesClean(absoluteRoot, REPORTS_WAVE1_PUBLISHER_RELATIVE_FILES);
  assertCommitContainsFiles(
    absoluteRoot,
    manifest.publisherCommitSha,
    REPORTS_WAVE1_PUBLISHER_RELATIVE_FILES,
    "Reports Wave 1 publisher",
  );
  assertCommitContainsFiles(
    absoluteRoot,
    manifest.productSourceSha,
    REPORTS_WAVE1_PUBLISHER_RELATIVE_FILES,
    "Reports Wave 1 product source",
  );
  assertCommitIsAncestorOfHead(absoluteRoot, manifest.publisherCommitSha, "Reports Wave 1 publisher");
  assertCommitIsAncestorOfHead(absoluteRoot, manifest.productSourceSha, "Reports Wave 1 product source");
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
  if (!sameStringArray(manifest.productSourceFiles, currentIdentity.sourceFiles)) {
    throw new Error("Production build manifest source file list mismatch.");
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
