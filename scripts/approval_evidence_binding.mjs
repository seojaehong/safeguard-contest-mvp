// @ts-check

import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, lstatSync, readFileSync, realpathSync } from "node:fs";
import { isAbsolute, relative, resolve, sep } from "node:path";

const COMMIT_SHA = /^[0-9a-f]{40}$/u;

function git(root, args) {
  try {
    return execFileSync("git", args, {
      cwd: root,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return null;
  }
}

function gitBlobBatch(root, blobIds) {
  const uniqueBlobIds = [...new Set(blobIds.filter((value) => /^[0-9a-f]{40}$/u.test(value)))];
  if (uniqueBlobIds.length === 0) return new Map();
  try {
    const output = execFileSync("git", ["cat-file", "--batch"], {
      cwd: root,
      input: `${uniqueBlobIds.join("\n")}\n`,
      maxBuffer: 64 * 1024 * 1024,
      stdio: ["pipe", "pipe", "ignore"],
    });
    const blobs = new Map();
    let offset = 0;
    for (const requestedBlob of uniqueBlobIds) {
      const headerEnd = output.indexOf(10, offset);
      if (headerEnd < 0) return new Map();
      const header = output.subarray(offset, headerEnd).toString("utf8");
      const match = /^([0-9a-f]{40})\s+blob\s+(\d+)$/u.exec(header);
      if (!match || match[1] !== requestedBlob) return new Map();
      const size = Number(match[2]);
      const bodyStart = headerEnd + 1;
      const bodyEnd = bodyStart + size;
      if (!Number.isSafeInteger(size) || size < 0 || bodyEnd > output.length) return new Map();
      blobs.set(requestedBlob, output.subarray(bodyStart, bodyEnd));
      offset = bodyEnd + 1;
    }
    return blobs;
  } catch {
    return new Map();
  }
}

function gitWorkingBlobBatch(root, gitPaths) {
  if (gitPaths.length === 0 || gitPaths.some((value) => /[\r\n]/u.test(value))) return new Map();
  try {
    const output = execFileSync("git", ["hash-object", "--stdin-paths"], {
      cwd: root,
      encoding: "utf8",
      input: `${gitPaths.join("\n")}\n`,
      maxBuffer: 16 * 1024 * 1024,
      stdio: ["pipe", "pipe", "ignore"],
    });
    const hashes = output.trim().split(/\r?\n/u);
    if (hashes.length !== gitPaths.length || hashes.some((value) => !/^[0-9a-f]{40}$/u.test(value))) {
      return new Map();
    }
    return new Map(gitPaths.map((gitPath, index) => [gitPath, hashes[index]]));
  } catch {
    return new Map();
  }
}

function normalizeGitPath(relativePath) {
  return relativePath.replaceAll("\\", "/");
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

export function approvalEvidencePacketDigest({ sourceHead, productionCommit, artifacts, evidenceCommits }) {
  return sha256(JSON.stringify({
    sourceHead,
    productionCommit,
    artifacts: artifacts.map(({ path, sha256: artifactSha256, headSha256, headBlobSha1: blob, gitMode }) => ({
      path,
      sha256: artifactSha256,
      headSha256,
      headBlobSha1: blob,
      gitMode,
    })),
    evidenceCommits,
  }));
}

function isInsideRoot(rootPath, targetPath) {
  const relativePath = relative(rootPath, targetPath);
  return relativePath === ""
    || (!isAbsolute(relativePath) && relativePath !== ".." && !relativePath.startsWith(`..${sep}`));
}

function inspectRegularPath(root, relativePath) {
  const lexicalRoot = resolve(root);
  const absolutePath = resolve(lexicalRoot, relativePath);
  if (!isInsideRoot(lexicalRoot, absolutePath)) {
    return { absolutePath, exists: false, regularFile: false, symlink: false, realPathWithinRoot: false };
  }

  const relativeSegments = relative(lexicalRoot, absolutePath).split(/[\\/]+/u).filter(Boolean);
  let cursor = lexicalRoot;
  for (const segment of relativeSegments) {
    cursor = resolve(cursor, segment);
    if (!existsSync(cursor)) {
      return { absolutePath, exists: false, regularFile: false, symlink: false, realPathWithinRoot: false };
    }
    if (lstatSync(cursor).isSymbolicLink()) {
      return { absolutePath, exists: true, regularFile: false, symlink: true, realPathWithinRoot: false };
    }
  }

  const leaf = lstatSync(absolutePath);
  const realRoot = realpathSync(lexicalRoot);
  const realPath = realpathSync(absolutePath);
  return {
    absolutePath,
    exists: true,
    regularFile: leaf.isFile(),
    symlink: false,
    realPathWithinRoot: isInsideRoot(realRoot, realPath),
  };
}

export function isCommitSha(value) {
  return typeof value === "string" && COMMIT_SHA.test(value);
}

export function currentGitHead(root) {
  const value = git(root, ["rev-parse", "HEAD"]);
  return isCommitSha(value) ? value : null;
}

export function isCommitAncestor(root, possibleAncestor, descendant) {
  if (!isCommitSha(possibleAncestor) || !isCommitSha(descendant)) return false;
  try {
    execFileSync("git", ["merge-base", "--is-ancestor", possibleAncestor, descendant], {
      cwd: root,
      stdio: "ignore",
    });
    return true;
  } catch {
    return false;
  }
}

export function buildApprovalEvidenceBinding({ root, inputPaths, productionCommit, evidenceCommits = [] }) {
  const sourceHead = currentGitHead(root);
  const uniquePaths = [...new Set(inputPaths)].sort((left, right) => left.localeCompare(right));
  const gitPaths = uniquePaths.map(normalizeGitPath);
  const treeRows = git(root, ["ls-tree", "-r", "HEAD", "--", ...gitPaths]) ?? "";
  const headEntries = new Map();
  for (const line of treeRows.split(/\r?\n/u).filter(Boolean)) {
    const match = /^(\d+)\s+blob\s+([0-9a-f]{40})\t(.+)$/u.exec(line);
    if (match) headEntries.set(match[3], { mode: match[1], blob: match[2] });
  }
  const headBlobBytes = gitBlobBatch(root, [...headEntries.values()].map(({ blob }) => blob));
  const workingBlobHashes = gitWorkingBlobBatch(root, gitPaths);
  const dirtyRows = git(root, ["diff", "HEAD", "--name-only", "--", ...gitPaths]) ?? "";
  const dirtyPaths = new Set(dirtyRows.split(/\r?\n/u).map((value) => value.trim()).filter(Boolean));
  const artifacts = uniquePaths.map((relativePath) => {
    const gitPath = normalizeGitPath(relativePath);
    const pathState = inspectRegularPath(root, relativePath);
    const headEntry = headEntries.get(gitPath) ?? null;
    const gitMode = headEntry?.mode ?? null;
    const gitModeRegular = gitMode === "100644" || gitMode === "100755";
    const readable = pathState.exists && pathState.regularFile && !pathState.symlink && pathState.realPathWithinRoot;
    const workingBytes = readable ? readFileSync(pathState.absolutePath) : null;
    const headBytes = headEntry && gitModeRegular ? headBlobBytes.get(headEntry.blob) ?? null : null;
    const workingRawSha256 = workingBytes ? sha256(workingBytes) : null;
    const headSha256 = headBytes ? sha256(headBytes) : null;
    const headBlobSha1 = headEntry?.blob ?? null;
    const workingBlobSha1 = readable ? workingBlobHashes.get(gitPath) ?? null : null;
    const workingTreeMatchesHead = workingBlobSha1 !== null
      && headBlobSha1 !== null
      && workingBlobSha1 === headBlobSha1
      && !dirtyPaths.has(gitPath);
    return {
      path: relativePath,
      bytes: workingBytes?.byteLength ?? null,
      sha256: workingTreeMatchesHead ? headSha256 : workingRawSha256,
      workingRawSha256,
      headSha256,
      gitMode,
      regularFile: pathState.regularFile,
      symlink: pathState.symlink,
      realPathWithinRoot: pathState.realPathWithinRoot,
      headBlobSha1,
      workingBlobSha1,
      trackedAtHead: /^[0-9a-f]{40}$/u.test(headBlobSha1 ?? "") && gitModeRegular,
      workingTreeMatchesHead,
    };
  });
  const normalizedEvidenceCommits = [...new Set(evidenceCommits.filter((value) => typeof value === "string"))].sort();
  const failures = [];
  if (!sourceHead) failures.push("current-head-invalid");
  const commitsToCheck = [...new Set([productionCommit, ...normalizedEvidenceCommits])];
  if (!isCommitSha(productionCommit)) failures.push("production-commit-invalid");
  for (const commit of commitsToCheck) {
    if (!isCommitSha(commit)) failures.push(`evidence-commit-invalid:${commit || "missing"}`);
    else if (!sourceHead || !isCommitAncestor(root, commit, sourceHead)) failures.push(`evidence-commit-not-ancestor:${commit}`);
  }
  for (const artifact of artifacts) {
    if (artifact.symlink) failures.push(`input-symlink:${artifact.path}`);
    if (!artifact.regularFile) failures.push(`input-not-regular:${artifact.path}`);
    if (!artifact.realPathWithinRoot) failures.push(`input-outside-real-root:${artifact.path}`);
    if (artifact.gitMode && artifact.gitMode !== "100644" && artifact.gitMode !== "100755") {
      failures.push(`input-git-mode-not-regular:${artifact.path}:${artifact.gitMode}`);
    }
    if (!artifact.trackedAtHead) failures.push(`input-not-tracked-at-head:${artifact.path}`);
    else if (!artifact.workingTreeMatchesHead) failures.push(`input-differs-from-head:${artifact.path}`);
    if (!artifact.sha256) failures.push(`input-sha256-missing:${artifact.path}`);
  }
  const packetDigest = approvalEvidencePacketDigest({
    sourceHead,
    productionCommit: isCommitSha(productionCommit) ? productionCommit : null,
    artifacts,
    evidenceCommits: normalizedEvidenceCommits,
  });
  return {
    schemaVersion: "safeclaw-approval-evidence-binding/v1",
    sourceHead,
    productionCommit: isCommitSha(productionCommit) ? productionCommit : null,
    artifacts,
    evidenceCommits: normalizedEvidenceCommits,
    packetDigest,
    verified: failures.length === 0,
    failures,
  };
}
