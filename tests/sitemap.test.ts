import { describe, expect, it } from "vitest";

import sitemap from "@/app/sitemap";

const REQUIRED_PATHS = [
  "/",
  "/workspace",
  "/why",
  "/trust",
  "/roadmap",
  "/ask",
] as const;

describe("app/sitemap", () => {
  const entries = sitemap();

  it("모든 항목이 https://www.safeclaw.kr 절대 URL이다", () => {
    expect(entries.length).toBeGreaterThan(0);
    for (const entry of entries) {
      expect(entry.url).toMatch(/^https:\/\/www\.safeclaw\.kr(\/|$)/);
    }
  });

  it("필수 공개 경로를 모두 포함한다", () => {
    const urls = entries.map((entry) => entry.url);
    for (const path of REQUIRED_PATHS) {
      const expected =
        path === "/"
          ? "https://www.safeclaw.kr"
          : `https://www.safeclaw.kr${path}`;
      expect(urls).toContain(expected);
    }
  });

  it("robots.txt에서 차단한 경로(/ops, /dryrun)는 포함하지 않는다", () => {
    const urls = entries.map((entry) => entry.url);
    for (const url of urls) {
      expect(url).not.toMatch(/\/(ops|dryrun)(\/|$)/);
    }
  });
});
