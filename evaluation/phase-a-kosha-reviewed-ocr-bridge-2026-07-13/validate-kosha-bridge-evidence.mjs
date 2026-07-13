import { spawnSync } from "node:child_process";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, isAbsolute, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const taskRoot = dirname(fileURLToPath(import.meta.url));
const repositoryRoot = resolve(taskRoot, "../..");
const evaluationPrefix = "evaluation/phase-a-kosha-reviewed-ocr-bridge-2026-07-13/";
const allowedCandidatePaths = new Set([
  "data/safety-knowledge/kosha-body-corpus.schema.json",
  "lib/kosha-guide-corpus-audit.ts",
  "lib/kosha-guide-corpus.ts",
  "scripts/audit_kosha_guides.mjs",
  "scripts/recover_kosha_ocr_boundary.py",
  "scripts/snapshot_kosha_guide_corpus.py",
  "scripts/tests/test_recover_kosha_ocr_boundary.py",
  "scripts/tests/test_snapshot_kosha_guide_corpus.py",
  "tests/kosha-guide-corpus-audit.test.ts",
  "tests/kosha-guide-offline-harness.test.ts"
]);
const safeDigestLabels = new Set([
  "bodysha256",
  "candidateattestationsha256",
  "candidatecontentsha256",
  "candidatefilesha256",
  "currentsha256",
  "entrymanifestsha256",
  "generationpolicysha256",
  "identitysha256",
  "manifestsha256",
  "provenanceidentitysha256",
  "rawsha256",
  "recomputedgenerationpolicysha256",
  "recomputedsourceidentitysha256",
  "recomputedsnapshotid",
  "recordersha256",
  "reproducibilityhash",
  "resumelogsha256",
  "sha256",
  "snapshotid",
  "snapshotscriptsha256",
  "sourceidentitysha256"
]);
const configuredSecretNames = [
  "ANTHROPIC_API_KEY",
  "GEMINI_API_KEY",
  "GITHUB_TOKEN",
  "GOOGLE_GENERATIVE_AI_API_KEY",
  "KOSHA_OCR_REVIEW_HMAC_KEY",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "OPENAI_API_KEY",
  "SUPABASE_ACCESS_TOKEN",
  "SUPABASE_SERVICE_ROLE_KEY",
  "VERCEL_TOKEN"
];
const binarySignatures = [
  [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a],
  [0xff, 0xd8, 0xff],
  [0x47, 0x49, 0x46, 0x38, 0x37, 0x61],
  [0x47, 0x49, 0x46, 0x38, 0x39, 0x61],
  [0x25, 0x50, 0x44, 0x46, 0x2d],
  [0x50, 0x4b, 0x03, 0x04],
  [0x50, 0x4b, 0x05, 0x06],
  [0x1f, 0x8b],
  [0x37, 0x7a, 0xbc, 0xaf, 0x27, 0x1c],
  [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1],
  [0x77, 0x4f, 0x46, 0x46],
  [0x77, 0x4f, 0x46, 0x32],
  [0x00, 0x01, 0x00, 0x00],
  [0x00, 0x00, 0x01, 0x00]
];

function parseArguments(arguments_) {
  const parsed = { commits: [], targetPaths: [] };
  for (let index = 0; index < arguments_.length; index += 1) {
    const name = arguments_[index];
    const value = arguments_[index + 1];
    if (!value || value.startsWith("--")) throw new Error(`validator-argument-value-missing:${name}`);
    if (name === "--integration-target") parsed.integrationTarget = value;
    else if (name === "--candidate-sha") parsed.candidateSha = value;
    else if (name === "--commit") parsed.commits.push(value);
    else if (name === "--target-existing-path") parsed.targetPaths.push(value);
    else if (name === "--report") parsed.report = value;
    else if (name === "--artifact-root") parsed.artifactRoot = value;
    else throw new Error(`validator-argument-unknown:${name}`);
    index += 1;
  }
  for (const name of ["integrationTarget", "candidateSha", "report", "artifactRoot"]) {
    if (!parsed[name]) throw new Error(`validator-argument-required:${name}`);
  }
  if (parsed.commits.length === 0) throw new Error("validator-commit-series-empty");
  return parsed;
}

function repositoryRelativePath(path, label) {
  const normalized = path.replaceAll("\\", "/");
  if (normalized.length === 0 || isAbsolute(path) || normalized.split("/").includes("..")) {
    throw new Error(`validator-relative-path-invalid:${label}`);
  }
  const resolved = resolve(repositoryRoot, normalized);
  const fromRoot = relative(repositoryRoot, resolved);
  if (fromRoot.startsWith("..") || isAbsolute(fromRoot)) {
    throw new Error(`validator-relative-path-escape:${label}`);
  }
  return { normalized, resolved };
}

function git(arguments_) {
  const result = spawnSync("git", arguments_, {
    cwd: repositoryRoot,
    encoding: "utf8",
    windowsHide: true
  });
  return {
    exitCode: result.status ?? -1,
    stdout: result.stdout || ""
  };
}

function exactCommit(value, label) {
  if (!/^[0-9a-f]{40}$/u.test(value)) throw new Error(`validator-commit-sha-invalid:${label}`);
  if (git(["cat-file", "-e", `${value}^{commit}`]).exitCode !== 0) {
    throw new Error(`validator-commit-missing:${label}`);
  }
}

function commitPaths(commit) {
  const result = git([
    "diff-tree",
    "--root",
    "--no-commit-id",
    "--name-only",
    "--no-renames",
    "-r",
    commit
  ]);
  if (result.exitCode !== 0) throw new Error("validator-commit-path-read-failed");
  return result.stdout.split(/\r?\n/u).filter((path) => path.length > 0);
}

function candidatePathAllowed(path) {
  const normalized = path.replaceAll("\\", "/");
  return allowedCandidatePaths.has(normalized) || normalized.startsWith(evaluationPrefix);
}

function listFiles(root) {
  return readdirSync(root).flatMap((name) => {
    const path = resolve(root, name);
    return statSync(path).isDirectory() ? listFiles(path) : [path];
  });
}

function startsWithBytes(bytes, signature) {
  return signature.length <= bytes.length && signature.every((value, index) => bytes[index] === value);
}

function binaryContent(bytes) {
  if (binarySignatures.some((signature) => startsWithBytes(bytes, signature))) return true;
  return startsWithBytes(bytes, [0x52, 0x49, 0x46, 0x46]) &&
    bytes.length >= 12 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50;
}

function decodeArtifact(path, bytes) {
  let decoded;
  try {
    decoded = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    if (binaryContent(bytes)) return null;
    throw new Error(`artifact-invalid-utf8:${path}`);
  }
  if (binaryContent(bytes)) return null;
  if (decoded.includes("\u0000")) throw new Error(`artifact-invalid-utf8:${path}`);
  return decoded;
}

function normalizedPathText(value) {
  return value
    .replaceAll("\\\\", "//")
    .replaceAll("\\/", "/")
    .replaceAll("\\", "/")
    .toLowerCase();
}

function containsUncPath(value) {
  const separatorCode = 92;
  const allowedPrefix = new Set([" ", "\t", "\r", "\n", "\"", "'", "(", "=", ":", ","]);
  const segmentCharacter = (character) => /[A-Za-z0-9._$-]/u.test(character);
  for (let index = 0; index + 1 < value.length; index += 1) {
    if (value.charCodeAt(index) !== separatorCode || value.charCodeAt(index + 1) !== separatorCode) {
      continue;
    }
    if (index > 0 && !allowedPrefix.has(value[index - 1] || "")) continue;
    let cursor = index + 2;
    while (value.charCodeAt(cursor) === separatorCode) cursor += 1;
    const serverStart = cursor;
    while (cursor < value.length && segmentCharacter(value[cursor] || "")) cursor += 1;
    if (cursor === serverStart || value.charCodeAt(cursor) !== separatorCode) continue;
    while (value.charCodeAt(cursor) === separatorCode) cursor += 1;
    const shareStart = cursor;
    while (cursor < value.length && segmentCharacter(value[cursor] || "")) cursor += 1;
    if (cursor > shareStart) return true;
  }
  return false;
}

function scanText(path, text, repositoryRoots) {
  const violations = [];
  const normalized = normalizedPathText(text);
  const drivePath = /(?:^|[\s"'(=])(?:file:\/{2,})?[a-z]:\/+[^\s"'<>]+/iu;
  const posixPath = /(?:^|[\s"'(=])\/(?:builds|etc|exports|github|home|mnt|opt|private|root|runner|srv|tmp|users|var|volumes|workspace|workspaces)\/+[^\s"'<>]+/iu;
  const repositoryPath = repositoryRoots.some((root) => {
    const candidate = normalizedPathText(root).replace(/\/+$/u, "");
    return candidate.length > 2 && normalized.includes(candidate);
  });
  const pathKinds = [
    drivePath.test(normalized) ? "drive" : null,
    containsUncPath(text) ? "unc" : null,
    posixPath.test(normalized) ? "posix" : null,
    repositoryPath ? "repository" : null
  ].filter(Boolean);
  if (pathKinds.length > 0) {
    violations.push({ path, code: "absolute-local-path", detail: pathKinds.join(",") });
  }
  const tokenPatterns = [
    /\bsk-(?:proj-)?[A-Za-z0-9_-]{16,}\b/gu,
    /\bsb_secret_[A-Za-z0-9_-]{16,}\b/gu,
    /\bBearer\s+[A-Za-z0-9._~+/=-]{16,}\b/giu,
    /\beyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\b/gu
  ];
  if (tokenPatterns.some((pattern) => pattern.test(text))) {
    violations.push({ path, code: "token-pattern" });
  }
  const safeAssignmentValues = new Set([
    "absent",
    "false",
    "null",
    "present",
    "redacted",
    "true",
    "undefined"
  ]);
  const credentialAssignmentPattern = /\b([A-Za-z][A-Za-z0-9_]*(?:api_key|service_role_key|anon_key|hmac_key|access_token|auth_token|password|secret|token))\b["']?\s*[:=]\s*["']?([^\s"',}\]]+)/giu;
  for (const match of text.matchAll(credentialAssignmentPattern)) {
    const value = match[2]?.replace(/[;.]$/u, "") || "";
    const normalizedValue = value.toLowerCase();
    const placeholder = value.startsWith("<") || value.startsWith("${");
    if (value.length >= 8 && !placeholder && !safeAssignmentValues.has(normalizedValue)) {
      violations.push({ path, code: "credential-assignment", detail: match[1] || "credential" });
    }
  }
  const hmacPattern = /\b(?:signature_hmac_sha256|review_hmac|hmac(?:_key|_sha256)?)\b["']?\s*[:,=]\s*["']?([A-Fa-f0-9]{64}|[A-Za-z0-9+/]{40,}={0,2})\b/giu;
  if (hmacPattern.test(text)) {
    violations.push({ path, code: "raw-hmac-value" });
  }
  const digestPattern = /\b([A-Za-z][A-Za-z0-9_-]*(?:sha256|digest|hash))\b["']?\s*[:,=]\s*["']?([A-Fa-f0-9]{64}|[A-Za-z0-9+/]{40,}={0,2})\b/giu;
  for (const match of text.matchAll(digestPattern)) {
    const label = match[1] || "digest";
    const compact = label.toLowerCase().replaceAll("-", "").replaceAll("_", "");
    const sensitive = /secret|hmac|token|credential|password|apikey|servicerole/u.test(compact);
    if (sensitive && !safeDigestLabels.has(compact)) {
      violations.push({ path, code: "sensitive-digest-label", detail: label });
    }
  }
  for (const name of configuredSecretNames) {
    const value = process.env[name];
    if (value && value.length >= 8 && text.includes(value)) {
      violations.push({ path, code: "configured-secret-value", detail: name });
    }
  }
  return violations;
}

function readNumber(record, key, errors) {
  const value = record?.[key];
  if (typeof value !== "number" || !Number.isFinite(value)) {
    errors.push(`report-number-invalid:${key}`);
    return 0;
  }
  return value;
}

const options = parseArguments(process.argv.slice(2));
exactCommit(options.integrationTarget, "integration-target");
exactCommit(options.candidateSha, "candidate-sha");
for (const [index, commit] of options.commits.entries()) exactCommit(commit, `series-${index}`);

const errors = [];
if (options.commits.at(-1) !== options.candidateSha) errors.push("candidate-series-tip-mismatch");
for (let index = 1; index < options.commits.length; index += 1) {
  if (git(["merge-base", "--is-ancestor", options.commits[index - 1], options.commits[index]]).exitCode !== 0) {
    errors.push(`candidate-series-not-linear:${index}`);
  }
}
const candidatePaths = [...new Set(options.commits.flatMap((commit) => commitPaths(commit)))].sort();
for (const path of candidatePaths) {
  if (!candidatePathAllowed(path)) errors.push(`candidate-path-out-of-scope:${path}`);
}
for (const path of options.targetPaths) {
  const normalized = repositoryRelativePath(path, "target-existing-path").normalized;
  if (git(["cat-file", "-e", `${options.integrationTarget}:${normalized}`]).exitCode !== 0) {
    errors.push(`integration-target-path-missing:${normalized}`);
  }
  if (candidatePaths.includes(normalized)) errors.push(`target-path-mixed-into-candidate:${normalized}`);
}

const reportPath = repositoryRelativePath(options.report, "report");
const artifactRoot = repositoryRelativePath(options.artifactRoot, "artifact-root");
const reportRaw = readFileSync(reportPath.resolved, "utf8");
const report = JSON.parse(reportRaw);
if (reportRaw.includes("NEW_HEAD")) errors.push("report-mutable-head-reference");
if (report.gitScope?.reviewedHead) errors.push("report-stale-reviewed-head-reference");
if (report.gitScope?.integrationTargetSha !== options.integrationTarget) {
  errors.push("report-integration-target-mismatch");
}
if (report.gitScope?.candidateSha !== options.candidateSha) errors.push("report-candidate-sha-mismatch");
if (report.gitScope?.evidenceParentCandidateSha !== options.candidateSha) {
  errors.push("report-evidence-parent-mismatch");
}
if (JSON.stringify(report.gitScope?.candidateSeries) !== JSON.stringify(options.commits)) {
  errors.push("report-candidate-series-mismatch");
}
const expectedCommand = { executable: "git", args: ["cherry-pick", ...options.commits] };
if (JSON.stringify(report.gitScope?.candidateApplyCommand) !== JSON.stringify(expectedCommand)) {
  errors.push("report-candidate-command-mismatch");
}
if (report.gitScope?.candidateScope?.fileCount !== candidatePaths.length) {
  errors.push("report-candidate-file-count-mismatch");
}
const pythonDuration = readNumber(
  report.verification?.final?.pythonFocused,
  "frameworkDurationSeconds",
  errors
);
const typescriptDuration = readNumber(
  report.verification?.final?.typescriptFocused,
  "frameworkDurationSeconds",
  errors
);
const ontologyDuration = readNumber(
  report.verification?.final?.ontologyEvidenceRegression,
  "frameworkDurationSeconds",
  errors
);
const expectedFrameworkDuration = Number(
  (pythonDuration + typescriptDuration + ontologyDuration).toFixed(3)
);
if (report.verification?.final?.totals?.frameworkDurationAggregateSeconds !== expectedFrameworkDuration) {
  errors.push("report-framework-duration-aggregate-mismatch");
}

const artifactFiles = listFiles(artifactRoot.resolved).sort();
const artifactViolations = [];
let binaryArtifactCount = 0;
for (const path of artifactFiles) {
  const artifactPath = relative(repositoryRoot, path).replaceAll("\\", "/");
  let text;
  try {
    text = decodeArtifact(artifactPath, readFileSync(path));
  } catch (error) {
    artifactViolations.push({
      path: artifactPath,
      code: error instanceof Error ? error.message.split(":", 1)[0] : "artifact-read-failed"
    });
    continue;
  }
  if (text === null) {
    binaryArtifactCount += 1;
    continue;
  }
  artifactViolations.push(...scanText(
    artifactPath,
    text,
    [repositoryRoot, resolve(repositoryRoot, "..")]
  ));
}
if (artifactViolations.length > 0) errors.push("evaluation-artifact-scan-failed");

const result = {
  schemaVersion: "safeclaw-kosha-bridge-evidence-validator/v1",
  status: errors.length === 0 ? "pass" : "fail",
  integrationTargetSha: options.integrationTarget,
  candidateSha: options.candidateSha,
  candidateSeries: options.commits,
  candidateScope: {
    commitCount: options.commits.length,
    fileCount: candidatePaths.length,
    paths: candidatePaths,
    outOfScopeCount: errors.filter((error) => error.startsWith("candidate-path-out-of-scope:")).length
  },
  targetExistingPaths: options.targetPaths,
  report: {
    path: reportPath.normalized,
    expectedFrameworkDurationSeconds: expectedFrameworkDuration
  },
  artifactScan: {
    root: artifactRoot.normalized,
    fileCount: artifactFiles.length,
    binaryArtifactCount,
    violationCount: artifactViolations.length,
    violations: artifactViolations
  },
  errors,
  networkRequestPerformed: false,
  productionGetPerformed: false,
  dbMutationPerformed: false,
  corpusImportPerformed: false,
  launchReadiness: false
};

process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
process.exit(errors.length === 0 ? 0 : 1);
