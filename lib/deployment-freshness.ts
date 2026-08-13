const COMMIT_SHA_PATTERN = /^[0-9a-f]{40}$/u;

export type BuildInfoResponse = {
  configured?: unknown;
  commitSha?: unknown;
};

export function normalizeCommitSha(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase();
  return COMMIT_SHA_PATTERN.test(normalized) ? normalized : null;
}

export function isNewDeploymentAvailable(
  currentBuildSha: unknown,
  response: BuildInfoResponse,
): boolean {
  const current = normalizeCommitSha(currentBuildSha);
  const latest = response.configured === true ? normalizeCommitSha(response.commitSha) : null;
  return Boolean(current && latest && current !== latest);
}
