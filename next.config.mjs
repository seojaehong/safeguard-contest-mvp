import { execSync } from "node:child_process";
import { dirname } from "node:path";
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
  env: {
    NEXT_PUBLIC_BUILD_DATE: buildDate
  },
  async redirects() {
    return [
      // www → apex redirect: eliminate 829ms redirect chain by making
      // safeclaw.kr the canonical and redirecting www → root permanently.
      // Note: Vercel domain primary should also be set to safeclaw.kr in the dashboard.
      { source: "/:path*", destination: "https://safeclaw.kr/:path*", permanent: true, has: [{ type: "host", value: "www.safeclaw.kr" }] },

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
