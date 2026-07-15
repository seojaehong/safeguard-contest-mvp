import { execSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = dirname(fileURLToPath(import.meta.url));

// 빌드 시점에 마지막 git 커밋 날짜를 inject. Vercel build에서 매 배포마다 자동 갱신
// → 푸터 UPDATED 라인 수동 갱신 불필요. git unavailable / 런타임 fallback은 today.
const buildDate = (() => {
  try {
    return execSync("git log -1 --format=%cd --date=short", { stdio: ["ignore", "pipe", "ignore"] })
      .toString()
      .trim();
  } catch {
    return new Date().toISOString().slice(0, 10);
  }
})();

/** @type {import('next').NextConfig} */
const nextConfig = {
  typedRoutes: true,
  outputFileTracingRoot: projectRoot,
  outputFileTracingIncludes: {
    "/*": ["./data/safety-knowledge/exact-kosha/d-c-13-2026.json"]
  },
  env: {
    NEXT_PUBLIC_BUILD_DATE: buildDate
  },
  webpack(config) {
    const auditEnabled = process.env.SAFECLAW_FRONTEND_AUDIT === "1";
    config.resolve.alias["safeclaw-audit-error-escalation$"] = join(
      projectRoot,
      auditEnabled
        ? "lib/frontend-audit/GlobalBoundaryProbe.audit.tsx"
        : "lib/frontend-audit/GlobalBoundaryProbe.noop.tsx"
    );
    config.resolve.alias["safeclaw-audit-app-error-escalation$"] = join(
      projectRoot,
      auditEnabled
        ? "lib/frontend-audit/AppBoundaryProbe.audit.ts"
        : "lib/frontend-audit/AppBoundaryProbe.noop.ts"
    );
    return config;
  },
  async redirects() {
    return [
      // 8-L의 www→apex redirect 제거: Vercel 대시보드가 apex→www를 강제해서
      // 무한 redirect loop 발생 (apex 307→www, www 308→apex). 도메인 primary
      // 변경은 Vercel 대시보드에서 수동 처리 필요 (사용자 액션).

      // Design handoff v1.0 §10.4 routing alignment.
      // Guide names → existing implementation routes. permanent: true issues
      // 308 (preserves method); the dynamic /docs/:id is non-permanent because
      // its dynamic segment isn't yet supported on the destination.
      { source: "/system/api", destination: "/ops/api", permanent: true },
      { source: "/system/settings", destination: "/settings", permanent: true },
      { source: "/docs", destination: "/documents", permanent: true },
      { source: "/docs/:id", destination: "/documents", permanent: false }
    ];
  },
  async headers() {
    return [
      {
        // Baseline security headers — all routes
        source: "/(.*)",
        headers: [
          { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" }
        ]
      },
      {
        // Static assets — long-lived cache
        source: "/brand/:path*",
        headers: [
          { key: "Cache-Control", value: "public, max-age=31536000, immutable" }
        ]
      },
      {
        // WASM + PDF references
        source: "/:path*.wasm",
        headers: [
          { key: "Cache-Control", value: "public, max-age=31536000, immutable" }
        ]
      },
      {
        // KOSHA PDFs
        source: "/kosha-references/:path*",
        headers: [
          { key: "Cache-Control", value: "public, max-age=86400" }
        ]
      }
    ];
  }
};

export default nextConfig;
