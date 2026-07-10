import { describe, expect, test, vi, beforeEach, afterEach } from "vitest";
import { generateAllDeliverablesWithDiagnostics } from "@/lib/ai-deliverables";
import type { AskProgressEvent } from "@/lib/ask-progress";

// Task D-2a: the "doc" progress events (design §1b) are emitted from inside
// generateAllDeliverablesWithDiagnostics's groupResults loop. The happy-path emission
// (real Vertex calls resolving/rejecting) is exercised live in the SSE dev-server
// verification (see task-d2a-report.md) since it needs GOOGLE_APPLICATION_CREDENTIALS_JSON
// / GCP_PROJECT_ID — not available in CI. This test instead locks down the
// "provider not configured" early-return path: onProgress must not fire (no docs ran)
// and the function must not throw when onProgress is passed but unused.
describe("generateAllDeliverablesWithDiagnostics onProgress wiring", () => {
  const savedCreds = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON;
  const savedProject = process.env.GCP_PROJECT_ID;

  beforeEach(() => {
    delete process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON;
    delete process.env.GCP_PROJECT_ID;
  });

  afterEach(() => {
    if (savedCreds !== undefined) process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON = savedCreds;
    if (savedProject !== undefined) process.env.GCP_PROJECT_ID = savedProject;
  });

  test("does not call onProgress when Vertex is not configured (no docs ran)", async () => {
    const events: AskProgressEvent[] = [];
    const onProgress = vi.fn((e: AskProgressEvent) => events.push(e));

    const result = await generateAllDeliverablesWithDiagnostics({
      scenario: {
        companyName: "테스트사",
        siteName: "테스트 현장",
        workSummary: "테스트 작업",
        workerCount: 3,
        weatherNote: "맑음"
      },
      question: "테스트 질문",
      onProgress
    });

    expect(result.diagnostics.geminiAvailable).toBe(false);
    expect(result.diagnostics.groupResults).toEqual([]);
    expect(result.diagnostics.trace).toEqual({
      attempted: false,
      provider: null,
      modelPerDocument: {},
      fallbackUsed: false
    });
    expect(onProgress).not.toHaveBeenCalled();
  });

  test("accepts an undefined onProgress without throwing", async () => {
    await expect(
      generateAllDeliverablesWithDiagnostics({
        scenario: {
          companyName: "테스트사",
          siteName: "테스트 현장",
          workSummary: "테스트 작업",
          workerCount: 3,
          weatherNote: "맑음"
        },
        question: "테스트 질문"
      })
    ).resolves.toBeTruthy();
  });
});
