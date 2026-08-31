import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const briefingMocks = vi.hoisted(() => ({
  runAsk: vi.fn(),
}));

vi.mock("@/lib/search", () => ({
  runAsk: briefingMocks.runAsk,
}));

vi.mock("@/lib/supabase-admin", () => ({
  createSupabaseAdminClient: () => null,
}));

vi.mock("@/lib/workpack-store", () => ({
  saveAskResponseAsScheduledWorkpack: vi.fn(),
}));

describe("briefing error projection boundary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("CRON_SECRET", "cron-contract-secret");
    vi.stubEnv("BRIEFING_SITES", JSON.stringify([{
      name: "Contract Site",
      question: "Create the daily safety briefing",
      email: "manager@example.com",
    }]));
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  it("returns a stable generation reference without the thrown detail", async () => {
    const secretMarker = "internal search provider stack and database host";
    const errorLog = vi.spyOn(console, "error").mockImplementation(() => undefined);
    briefingMocks.runAsk.mockRejectedValue(new Error(secretMarker));
    const { GET } = await import("@/app/api/briefing/run/route");

    const response = await GET(new NextRequest("http://localhost/api/briefing/run", {
      headers: { authorization: "Bearer cron-contract-secret" },
    }));
    const body = await response.json() as {
      ok: boolean;
      results: Array<{ generated: boolean; message?: string }>;
    };
    const serialized = JSON.stringify(body);

    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.results[0]).toMatchObject({ generated: false });
    expect(body.results[0]?.message).toMatch(
      /^generate: failed \(BRIEFING_GENERATION_FAILED; reference [0-9a-f-]{36}\)$/u,
    );
    expect(serialized).not.toContain(secretMarker);
    expect(JSON.stringify(errorLog.mock.calls)).not.toContain(secretMarker);
  });
});
