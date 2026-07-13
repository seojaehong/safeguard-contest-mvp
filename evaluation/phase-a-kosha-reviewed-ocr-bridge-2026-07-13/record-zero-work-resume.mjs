import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  readFileSync,
  readdirSync,
  statSync,
  writeFileSync
} from "node:fs";
import { dirname, isAbsolute, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const taskRoot = dirname(fileURLToPath(import.meta.url));
const repositoryRoot = resolve(taskRoot, "../..");
const sourceRoot = requiredEnvironmentPath("KOSHA_SOURCE_DIR");
const snapshotOutputRoot = requiredEnvironmentPath("KOSHA_SNAPSHOT_OUTPUT_DIR");
const pythonCommand = process.env.PYTHON_EXECUTABLE || "python";
const snapshotScriptRelative = "scripts/snapshot_kosha_guide_corpus.py";
const snapshotScript = resolve(repositoryRoot, snapshotScriptRelative);
const resumeLog = resolve(taskRoot, "snapshot-resume.log");
const commandManifest = resolve(taskRoot, "zero-work-resume-command.json");
const commandArguments = [
  snapshotScriptRelative,
  "--source",
  sourceRoot,
  "--output-dir",
  snapshotOutputRoot,
  "--resume"
];

function requiredEnvironmentPath(name) {
  const value = process.env[name];
  if (!value) throw new Error(`required-environment-path-missing:${name}`);
  return resolve(value);
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function fileSha256(path) {
  return sha256(readFileSync(path));
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function safeSnapshotPath(root, candidate) {
  if (typeof candidate !== "string" || candidate.length === 0 || isAbsolute(candidate)) {
    throw new Error("resume-command-snapshot-path-invalid");
  }
  const resolved = resolve(root, candidate);
  const fromRoot = relative(root, resolved);
  if (fromRoot.startsWith("..") || isAbsolute(fromRoot)) {
    throw new Error("resume-command-snapshot-path-escape");
  }
  return resolved;
}

function readSnapshotState() {
  const currentPath = resolve(snapshotOutputRoot, "current.json");
  const currentBytes = readFileSync(currentPath);
  const current = JSON.parse(currentBytes.toString("utf8"));
  const snapshotRoot = safeSnapshotPath(snapshotOutputRoot, current.snapshot_path);
  const manifestPath = resolve(snapshotRoot, "manifest.json");
  const manifestBytes = readFileSync(manifestPath);
  const manifest = JSON.parse(manifestBytes.toString("utf8"));
  const outputHashes = Object.fromEntries(
    Object.keys(manifest.output_hashes).sort().map((name) => [name, fileSha256(resolve(snapshotRoot, name))])
  );
  const declaredOutputHashes = Object.fromEntries(
    Object.entries(manifest.output_hashes).sort(([left], [right]) => left.localeCompare(right))
  );
  return {
    currentSha256: sha256(currentBytes),
    manifestSha256: sha256(manifestBytes),
    snapshotId: current.snapshot_id,
    sourceIdentitySha256: manifest.source_identity.identity_sha256,
    generationPolicySha256: manifest.generation_policy_sha256,
    outputHashes,
    declaredOutputHashes,
    outputHashesMatch: JSON.stringify(outputHashes) === JSON.stringify(declaredOutputHashes)
  };
}

function readSourceFiles() {
  return readdirSync(sourceRoot)
    .filter((name) => name.toLowerCase().endsWith(".zip"))
    .sort((left, right) => left.localeCompare(right))
    .map((name) => {
      const path = resolve(sourceRoot, name);
      return {
        name,
        sha256: fileSha256(path),
        size: statSync(path).size
      };
    });
}

function pythonIdentity() {
  const probe = spawnSync(pythonCommand, [
    "-c",
    "import hashlib,json,pathlib,platform,sys; p=pathlib.Path(sys.executable); print(json.dumps({'name':p.name,'sha256':hashlib.sha256(p.read_bytes()).hexdigest(),'version':platform.python_version()}, separators=(',',':')))"
  ], {
    cwd: repositoryRoot,
    encoding: "utf8",
    windowsHide: true
  });
  if (probe.status !== 0) throw new Error("resume-command-python-identity-failed");
  return JSON.parse(probe.stdout.trim());
}

function replacePathVariants(text, path, replacement) {
  const variants = new Set([
    path,
    path.replaceAll("\\", "/"),
    path.replaceAll("\\", "\\\\")
  ]);
  let sanitized = text;
  for (const variant of [...variants].sort((left, right) => right.length - left.length)) {
    sanitized = sanitized.replaceAll(variant, replacement);
  }
  return sanitized;
}

function sanitizeCommandOutput(text) {
  const replacements = [
    [snapshotOutputRoot, "<snapshot-output-root>"],
    [sourceRoot, "<source-root>"],
    [repositoryRoot, "<repository-root>"],
    [process.env.USERPROFILE || "", "<user-root>"]
  ].filter(([path]) => path.length > 0);
  return replacements.reduce(
    (value, [path, replacement]) => replacePathVariants(value, path, replacement),
    text
  );
}

function parseResult(stdout) {
  const lines = stdout.trim().split(/\r?\n/u).reverse();
  for (const line of lines) {
    if (!line.startsWith("{")) continue;
    try {
      return JSON.parse(line);
    } catch {
      continue;
    }
  }
  throw new Error("resume-command-result-json-missing");
}

const before = readSnapshotState();
const sourceFiles = readSourceFiles();
const executableIdentity = pythonIdentity();
const startedAt = new Date();
const started = process.hrtime.bigint();
const result = spawnSync(pythonCommand, commandArguments, {
  cwd: repositoryRoot,
  encoding: "utf8",
  maxBuffer: 16 * 1024 * 1024,
  windowsHide: true
});
const ended = process.hrtime.bigint();
const endedAt = new Date();
const elapsedSeconds = Number(ended - started) / 1_000_000_000;
const exitCode = result.status ?? -1;
const combinedOutput = `${result.stdout || ""}${result.stderr || ""}`;
const sanitizedOutput = sanitizeCommandOutput(combinedOutput).trimEnd();
writeFileSync(resumeLog, `${sanitizedOutput}\n`, "utf8");

const observed = parseResult(result.stdout || "");
const after = readSnapshotState();
const snapshotBytesUnchanged =
  before.currentSha256 === after.currentSha256 &&
  before.manifestSha256 === after.manifestSha256 &&
  JSON.stringify(before.outputHashes) === JSON.stringify(after.outputHashes);
const success =
  exitCode === 0 &&
  observed.processed_this_run === 0 &&
  observed.reproducibility_hash === before.snapshotId &&
  before.snapshotId === after.snapshotId &&
  before.outputHashesMatch &&
  after.outputHashesMatch &&
  snapshotBytesUnchanged;

const environmentNames = [
  "KOSHA_SOURCE_DIR",
  "KOSHA_SNAPSHOT_OUTPUT_DIR",
  "PYTHON_EXECUTABLE",
  "KOSHA_OCR_REVIEW_HMAC_KEY"
];
const manifest = {
  schemaVersion: "safeclaw-kosha-zero-work-resume-command/v1",
  status: success ? "observed_success" : "observed_failure",
  operation: "zero-work-resume-validation",
  command: {
    executable: pythonCommand,
    executableIdentity,
    orderedArgs: [
      snapshotScriptRelative,
      "--source",
      "${KOSHA_SOURCE_DIR}",
      "--output-dir",
      "${KOSHA_SNAPSHOT_OUTPUT_DIR}",
      "--resume"
    ],
    cwd: { base: "repository", relative: "." }
  },
  environment: Object.fromEntries(environmentNames.map((name) => [name, {
    present: Boolean(process.env[name]),
    valueRecorded: false
  }])),
  timing: {
    startedAt: startedAt.toISOString(),
    endedAt: endedAt.toISOString(),
    elapsedSeconds: Number(elapsedSeconds.toFixed(3)),
    exitCode
  },
  inputs: {
    recorderSha256: fileSha256(fileURLToPath(import.meta.url)),
    snapshotScriptSha256: fileSha256(snapshotScript),
    sourceIdentitySha256: before.sourceIdentitySha256,
    sourceFiles,
    currentSha256: before.currentSha256,
    manifestSha256: before.manifestSha256,
    generationPolicySha256: before.generationPolicySha256,
    outputHashes: before.outputHashes
  },
  outputs: {
    processedThisRun: observed.processed_this_run,
    snapshotId: after.snapshotId,
    currentSha256: after.currentSha256,
    manifestSha256: after.manifestSha256,
    outputHashes: after.outputHashes,
    resumeLogSha256: fileSha256(resumeLog),
    snapshotBytesUnchanged
  },
  historicalFullGeneration: {
    commandEvidence: "verified_from_actual_session_tool_call",
    evidence: {
      rolloutId: "019f5ba5-b7ef-7441-8d4b-c854d0e15532",
      invocationTimestamp: "2026-07-13T14:54:43.429Z",
      completionTimestamp: "2026-07-13T15:26:57.993Z",
      invocationCallId: "call_LS9whGTLuZF0ra2YBXHUKmil",
      completionCallId: "call_FvtDN5Fs8dPVAn9rNbezGZNX"
    },
    executable: "python",
    orderedArgs: [
      snapshotScriptRelative,
      "--source",
      "${HOME}/Downloads/기술지원규정",
      "--output-dir",
      "${USERPROFILE}/dev/safeclaw-local-artifacts/kosha-corpus-body-recovery-2026-07-13-fixed-v1"
    ],
    cwd: { base: "repository", relative: "." },
    elapsedSeconds: 1929.811,
    independentlyRerun: false
  },
  networkRequestPerformed: false,
  productionGetPerformed: false,
  dbMutationPerformed: false,
  corpusImportPerformed: false,
  launchReadiness: false
};
writeFileSync(commandManifest, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");

if (!success) {
  process.stderr.write("zero-work-resume-command-verification-failed\n");
  process.exit(1);
}
