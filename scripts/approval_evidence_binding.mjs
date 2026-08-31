// @ts-check

import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";

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

function normalizeGitPath(relativePath) {
  return relativePath.replaceAll("\\", "/");
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
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
  const indexRows = git(root, ["ls-files", "--stage", "--", ...gitPaths]) ?? "";
  const headBlobs = new Map();
  for (const line of indexRows.split(/\r?\n/u).filter(Boolean)) {
    const match = /^\d+\s+([0-9a-f]{40})\s+\d+\t(.+)$/u.exec(line);
    if (match) headBlobs.set(match[2], match[1]);
  }
  const dirtyRows = git(root, ["diff", "HEAD", "--name-only", "--", ...gitPaths]) ?? "";
  const dirtyPaths = new Set(dirtyRows.split(/\r?\n/u).map((value) => value.trim()).filter(Boolean));
  const artifacts = uniquePaths.map((relativePath) => {
    const absolutePath = resolve(root, relativePath);
    const gitPath = normalizeGitPath(relativePath);
    const exists = existsSync(absolutePath) && statSync(absolutePath).isFile();
    const workingSha256 = exists ? sha256(readFileSync(absolutePath)) : null;
    const headBlobSha1 = headBlobs.get(gitPath) ?? null;
    const workingTreeMatchesHead = exists && headBlobSha1 !== null && !dirtyPaths.has(gitPath);
    return {
      path: relativePath,
      bytes: exists ? statSync(absolutePath).size : null,
      sha256: workingSha256,
      headBlobSha1,
      workingBlobSha1: workingTreeMatchesHead ? headBlobSha1 : null,
      trackedAtHead: /^[0-9a-f]{40}$/u.test(headBlobSha1 ?? ""),
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
    if (!artifact.trackedAtHead) failures.push(`input-not-tracked-at-head:${artifact.path}`);
    else if (!artifact.workingTreeMatchesHead) failures.push(`input-differs-from-head:${artifact.path}`);
    if (!artifact.sha256) failures.push(`input-sha256-missing:${artifact.path}`);
  }
  const packetDigest = sha256(JSON.stringify({
    sourceHead,
    productionCommit: isCommitSha(productionCommit) ? productionCommit : null,
    artifacts: artifacts.map(({ path, sha256: artifactSha256, headBlobSha1: blob }) => ({ path, sha256: artifactSha256, headBlobSha1: blob })),
    evidenceCommits: normalizedEvidenceCommits,
  }));
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
