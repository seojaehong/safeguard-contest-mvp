import type { MetadataRoute } from "next";

const BASE_URL = "https://www.safeclaw.kr";

// 공개 페이지만 포함한다. robots.txt에서 차단한 /ops, /dryrun 및
// 내부 운영·데모 페이지는 제외.
const PUBLIC_PATHS = [
  "/",
  "/workspace",
  "/why",
  "/trust",
  "/roadmap",
  "/ask",
  "/knowledge",
  "/login",
] as const;

export default function sitemap(): MetadataRoute.Sitemap {
  return PUBLIC_PATHS.map((path) => ({
    url: path === "/" ? BASE_URL : `${BASE_URL}${path}`,
    changeFrequency: "weekly",
    priority: path === "/" ? 1 : 0.7,
  }));
}
