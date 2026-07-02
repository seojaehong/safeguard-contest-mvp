import type { RateLimiter } from "@/lib/rate-limit";

export function getClientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  return request.headers.get("x-real-ip") ?? "unknown";
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
