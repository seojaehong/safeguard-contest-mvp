import { createRateLimiter } from "@/lib/rate-limit";
import { checkPublicRateLimit } from "@/lib/public-distributed-rate-limit";

const PUBLIC_ASK_LIMIT = 10;
const PUBLIC_ASK_WINDOW_MS = 60_000;
const publicAskInstanceLimiter = createRateLimiter({
  limit: PUBLIC_ASK_LIMIT,
  windowMs: PUBLIC_ASK_WINDOW_MS,
});

export function checkPublicAskAdmission(request: Request) {
  return checkPublicRateLimit({
    request,
    namespace: "public-ask-family",
    limit: PUBLIC_ASK_LIMIT,
    windowMs: PUBLIC_ASK_WINDOW_MS,
    instanceLimiter: publicAskInstanceLimiter,
  });
}
