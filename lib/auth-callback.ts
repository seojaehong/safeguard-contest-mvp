export type AuthHashSession = {
  accessToken: string;
  refreshToken: string;
};

export function parseAuthHashSession(hash: string): AuthHashSession | null {
  const normalizedHash = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!normalizedHash) return null;

  const params = new URLSearchParams(normalizedHash);
  const accessToken = params.get("access_token");
  const refreshToken = params.get("refresh_token");
  const tokenType = params.get("token_type");

  if (!accessToken || !refreshToken) return null;
  if (tokenType && tokenType.toLowerCase() !== "bearer") return null;

  return { accessToken, refreshToken };
}

export function resolveSafeNextPath(nextPath: string | null | undefined, fallback = "/workspace"): string {
  if (!nextPath) return fallback;
  if (!nextPath.startsWith("/")) return fallback;
  if (nextPath.startsWith("//")) return fallback;
  if (nextPath.includes("\\") || nextPath.includes("\n") || nextPath.includes("\r")) return fallback;
  return nextPath;
}
