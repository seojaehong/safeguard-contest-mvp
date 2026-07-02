import { describe, expect, it } from "vitest";
import nextConfig from "@/next.config.mjs";

type HeaderEntry = { key: string; value: string };
type HeaderRule = { source: string; headers: HeaderEntry[] };

const REQUIRED_HEADERS: Record<string, string> = {
  "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "SAMEORIGIN",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
};

describe("next.config.mjs security headers", () => {
  it("applies the 5 baseline security headers to all routes", async () => {
    const rules = (await nextConfig.headers()) as HeaderRule[];
    const globalRule = rules.find((rule) => rule.source === "/(.*)");
    expect(globalRule).toBeDefined();

    for (const [key, value] of Object.entries(REQUIRED_HEADERS)) {
      const header = globalRule?.headers.find((h) => h.key === key);
      expect(header, `missing header: ${key}`).toBeDefined();
      expect(header?.value).toBe(value);
    }
  });

  it("keeps the existing Cache-Control rules", async () => {
    const rules = (await nextConfig.headers()) as HeaderRule[];
    const cacheSources = rules.filter((rule) =>
      rule.headers.some((h) => h.key === "Cache-Control")
    );
    expect(cacheSources.length).toBeGreaterThanOrEqual(3);
  });
});
