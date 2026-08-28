import type { RateLimiter } from "@/lib/rate-limit";
import { isIP } from "node:net";

function singleIp(value: string | null, requireValidIp: boolean): string | undefined {
  const candidate = value?.trim();
  if (!candidate || candidate.includes(",")) return undefined;
  return !requireValidIp || isIP(candidate) !== 0 ? candidate : undefined;
}

export function getClientIp(request: Request): string {
  const vercelForwarded = singleIp(request.headers.get("x-vercel-forwarded-for"), true);
  if (vercelForwarded) return vercelForwarded;

  const production = process.env.NODE_ENV === "production";
  const trustedProxy = process.env.SAFECLAW_TRUST_PROXY_HEADERS === "true";
  if (process.env.VERCEL === "1" && production) {
    return "unknown";
  }

  if (trustedProxy || !production) {
    const forwarded = request.headers.get("x-forwarded-for");
    if (forwarded) {
      const first = forwarded.split(",")[0]?.trim();
      if (first && (!production || isIP(first) !== 0)) return first;
    }
    return singleIp(request.headers.get("x-real-ip"), production) ?? "unknown";
  }

  return "unknown";
}

/**
 * Returns a 429 Response when the caller exceeded the limiter, null otherwise.
 */
export function enforceRateLimit(request: Request, limiter: RateLimiter): Response | null {
  const result = limiter.check(getClientIp(request));
  if (result.allowed) return null;
  const retryAfter = String(result.retryAfterSeconds ?? 60);
  return new Response(
    JSON.stringify({ error: "요청이 너무 잦습니다. 잠시 후 다시 시도해 주세요.", retryAfterSeconds: Number(retryAfter) }),
    {
      status: 429,
      headers: { "Content-Type": "application/json", "Retry-After": retryAfter },
    }
  );
}
