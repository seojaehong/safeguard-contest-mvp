import { describe, expect, it, vi } from "vitest";

describe("build-info route", () => {
  it("returns only safe Vercel deployment identity fields", async () => {
    vi.stubEnv("VERCEL_GIT_COMMIT_SHA", "ABCDEFabcdef1234567890abcdef1234567890ab");
    vi.stubEnv("VERCEL_GIT_COMMIT_REF", "master");
    vi.stubEnv("VERCEL_ENV", "production");
    vi.stubEnv("VERCEL_URL", "safeclaw.example.vercel.app");
    vi.stubEnv("OPENAI_API_KEY", "sk-proj-secret");

    const { GET } = await import("@/app/api/build-info/route");
    const response = GET();
    const bodyText = await response.text();
    const body = JSON.parse(bodyText) as {
      ok: boolean;
      configured: boolean;
      source: string;
      commitSha: string | null;
      branch: string | null;
      environment: string | null;
      deploymentUrl: string | null;
    };

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      ok: true,
      configured: true,
      source: "vercel-system-env",
      commitSha: "abcdefabcdef1234567890abcdef1234567890ab",
      branch: "master",
      environment: "production",
      deploymentUrl: "safeclaw.example.vercel.app"
    });
    expect(bodyText).not.toContain("sk-proj-secret");
  });

  it("fails soft when Vercel commit identity is unavailable or malformed", async () => {
    vi.stubEnv("VERCEL_GIT_COMMIT_SHA", "not-a-sha");
    vi.stubEnv("NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA", "");
    vi.stubEnv("VERCEL_GIT_COMMIT_REF", "master;rm");
    vi.stubEnv("VERCEL_ENV", "production");

    const { GET } = await import("@/app/api/build-info/route");
    const response = GET();
    const body = await response.json() as {
      ok: boolean;
      configured: boolean;
      source: string;
      commitSha: string | null;
      branch: string | null;
      environment: string | null;
      message: string;
    };

    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.configured).toBe(false);
    expect(body.source).toBe("unavailable");
    expect(body.commitSha).toBeNull();
    expect(body.branch).toBeNull();
    expect(body.environment).toBe("production");
    expect(body.message).toContain("노출되지 않았습니다");
  });
});
