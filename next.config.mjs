import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  typedRoutes: true,
  outputFileTracingRoot: projectRoot,
  async redirects() {
    return [
      // Design handoff v1.0 §10.4 routing alignment.
      // Guide names → existing implementation routes. permanent: true issues
      // 308 (preserves method); the dynamic /docs/:id is non-permanent because
      // its dynamic segment isn't yet supported on the destination.
      { source: "/system/api", destination: "/ops/api", permanent: true },
      { source: "/system/settings", destination: "/settings", permanent: true },
      { source: "/docs", destination: "/documents", permanent: true },
      { source: "/docs/:id", destination: "/documents", permanent: false }
    ];
  }
};

export default nextConfig;
