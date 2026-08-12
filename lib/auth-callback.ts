export type AuthHashSession = {
  accessToken: string;
  refreshToken: string;
};

export const AUTH_TRANSACTION_STORAGE_KEY = "safeclaw.auth.callback.transaction";
const AUTH_TRANSACTION_MAX_AGE_MS = 15 * 60_000;

export type AuthTransaction = {
  state: string;
  createdAt: number;
};

type AuthTransactionStorage = Pick<Storage, "getItem" | "removeItem">;

export function createAuthTransaction(
  createdAt = Date.now(),
  state = crypto.randomUUID()
): AuthTransaction {
  return { state, createdAt };
}

export function consumeAuthTransaction(
  storage: AuthTransactionStorage,
  receivedState: string | null | undefined,
  now = Date.now()
): boolean {
  const serialized = storage.getItem(AUTH_TRANSACTION_STORAGE_KEY);
  storage.removeItem(AUTH_TRANSACTION_STORAGE_KEY);
  if (!serialized || !receivedState) return false;

  try {
    const parsed = JSON.parse(serialized) as unknown;
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return false;
    const record = parsed as Record<string, unknown>;
    if (record.state !== receivedState || typeof record.createdAt !== "number") return false;
    if (!Number.isSafeInteger(record.createdAt) || record.createdAt > now) return false;
    return now - record.createdAt <= AUTH_TRANSACTION_MAX_AGE_MS;
  } catch {
    return false;
  }
}

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

export function buildAuthCallbackUrl(
  origin: string,
  nextPath: string | null | undefined,
  transactionState?: string
): string {
  const safeNextPath = resolveSafeNextPath(nextPath);
  const params = new URLSearchParams({ next: safeNextPath });
  if (transactionState) params.set("auth_tx", transactionState);
  return `${origin}/auth/callback?${params.toString()}`;
}
