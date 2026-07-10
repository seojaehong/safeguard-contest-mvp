import fs from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";

const clientPath = path.join(process.cwd(), "lib", "workflow-share-client.ts");

async function loadClient() {
  expect(fs.existsSync(clientPath), "authenticated share client helper must exist").toBe(true);
  return await import("@/lib/workflow-share-client");
}

describe("authenticated workflow share client", () => {
  it("resolves selected local worker keys to the real saved worker UUIDs", async () => {
    const { resolveSavedWorkerIds } = await loadClient();
    const workerMap = {
      "worker-local-a": "11111111-1111-4111-8111-111111111111",
      "worker-local-b": "22222222-2222-4222-8222-222222222222"
    };

    expect(resolveSavedWorkerIds(workerMap, ["worker-local-b", "worker-local-a"])).toEqual([
      "22222222-2222-4222-8222-222222222222",
      "11111111-1111-4111-8111-111111111111"
    ]);
    expect(() => resolveSavedWorkerIds(workerMap, ["worker-missing"])).toThrow(
      "선택한 작업자의 서버 저장 ID를 찾지 못했습니다: worker-missing"
    );
  });

  it("creates a share session with real worker UUIDs and Bearer auth", async () => {
    const { createAuthenticatedShareSession } = await loadClient();
    const fetcher = vi.fn(async (_input: string, _init: RequestInit) => new Response(JSON.stringify({
      ok: true,
      configured: true,
      shareSessionId: "33333333-3333-4333-8333-333333333333",
      message: "공유 세션 생성 완료"
    }), { status: 200, headers: { "content-type": "application/json" } }));

    const result = await createAuthenticatedShareSession(fetcher, {
      authToken: "access-token",
      workpackId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      workerIds: ["11111111-1111-4111-8111-111111111111"]
    });

    expect(result.shareSessionId).toBe("33333333-3333-4333-8333-333333333333");
    expect(fetcher).toHaveBeenCalledWith(
      "/api/workpacks/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/share-sessions",
      {
        method: "POST",
        headers: {
          authorization: "Bearer access-token",
          "content-type": "application/json"
        },
        body: JSON.stringify({ recipients: ["11111111-1111-4111-8111-111111111111"] })
      }
    );
  });

  it("dispatches only server authority identifiers, channels, and operator note", async () => {
    const { dispatchAuthenticatedShareSession } = await loadClient();
    const fetcher = vi.fn(async (_input: string, _init: RequestInit) => new Response(JSON.stringify({
      ok: true,
      configured: true,
      workflowRunId: "run-1",
      message: "전파 접수 완료"
    }), { status: 200, headers: { "content-type": "application/json" } }));

    const result = await dispatchAuthenticatedShareSession(fetcher, {
      authToken: "access-token",
      workpackId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      shareSessionId: "33333333-3333-4333-8333-333333333333",
      channels: ["email", "sms"],
      operatorNote: "TBM 후 확인"
    });

    expect(result.ok).toBe(true);
    const request = fetcher.mock.calls[0];
    expect(request?.[0]).toBe("/api/workflow/dispatch");
    expect(request?.[1]?.headers).toEqual({
      authorization: "Bearer access-token",
      "content-type": "application/json"
    });
    expect(JSON.parse(String(request?.[1]?.body))).toEqual({
      workpackId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      shareSessionId: "33333333-3333-4333-8333-333333333333",
      channels: ["email", "sms"],
      operatorNote: "TBM 후 확인"
    });
  });

  it("surfaces server errors and malformed success responses explicitly", async () => {
    const { createAuthenticatedShareSession, dispatchAuthenticatedShareSession } = await loadClient();
    const rejectedFetcher = vi.fn(async () => new Response(JSON.stringify({
      ok: false,
      configured: true,
      message: "서버 검수에서 공유 준비가 확인되지 않았습니다."
    }), { status: 409, headers: { "content-type": "application/json" } }));

    await expect(createAuthenticatedShareSession(rejectedFetcher, {
      authToken: "access-token",
      workpackId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      workerIds: ["11111111-1111-4111-8111-111111111111"]
    })).rejects.toThrow("서버 검수에서 공유 준비가 확인되지 않았습니다. (HTTP 409)");

    const malformedFetcher = vi.fn(async () => new Response(JSON.stringify({
      ok: true,
      configured: true,
      message: "세션 생성됨"
    }), { status: 200, headers: { "content-type": "application/json" } }));
    await expect(createAuthenticatedShareSession(malformedFetcher, {
      authToken: "access-token",
      workpackId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      workerIds: ["11111111-1111-4111-8111-111111111111"]
    })).rejects.toThrow("공유 세션 응답에 shareSessionId가 없습니다.");

    const invalidSessionFetcher = vi.fn(async () => new Response(JSON.stringify({
      ok: true,
      configured: true,
      shareSessionId: "fixture-session",
      message: "세션 생성됨"
    }), { status: 200, headers: { "content-type": "application/json" } }));
    await expect(createAuthenticatedShareSession(invalidSessionFetcher, {
      authToken: "access-token",
      workpackId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      workerIds: ["11111111-1111-4111-8111-111111111111"]
    })).rejects.toThrow("공유 세션 응답의 shareSessionId가 올바른 UUID가 아닙니다.");

    const dispatchFetcher = vi.fn(async () => new Response("gateway unavailable", { status: 502 }));
    await expect(dispatchAuthenticatedShareSession(dispatchFetcher, {
      authToken: "access-token",
      workpackId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      shareSessionId: "33333333-3333-4333-8333-333333333333",
      channels: ["email"],
      operatorNote: ""
    })).rejects.toThrow("전파 요청에 실패했습니다. (HTTP 502)");
  });

  it("does not treat fixture or validation-only dispatch as real provider confirmation", async () => {
    const client = await loadClient();
    expect(client.isProviderDispatchConfirmed).toBeTypeOf("function");
    if (!client.isProviderDispatchConfirmed) return;

    expect(client.isProviderDispatchConfirmed({
      ok: true,
      configured: true,
      providerStatus: "fixture",
      message: "fixture accepted",
      channelResults: [{ channel: "sms", provider: "safe-fixture", status: "sent" }]
    })).toBe(false);
    expect(client.isProviderDispatchConfirmed({
      ok: true,
      configured: true,
      providerStatus: "validation-only",
      message: "validation complete",
      channelResults: [{ channel: "email", provider: "n8n", status: "sent" }]
    })).toBe(false);
    expect(client.isProviderDispatchConfirmed({
      ok: true,
      configured: true,
      providerStatus: "accepted",
      message: "provider accepted",
      channelResults: [{ channel: "sms", provider: "twilio", status: "sent" }]
    })).toBe(true);
    expect(client.isProviderDispatchConfirmed({
      ok: true,
      configured: true,
      providerStatus: "accepted",
      message: "provider accepted",
      channelResults: [{ channel: "sms", provider: "latest-sms", status: "sent" }]
    })).toBe(true);
  });
});

describe("workflow share component wiring", () => {
  it("retains the saved worker map and passes server worker IDs into the share panel", () => {
    const source = fs.readFileSync(path.join(process.cwd(), "components", "FieldOperationsWorkspace.tsx"), "utf8");

    expect(source).toContain("setSavedWorkerMap");
    expect(source).toContain("resolveSavedWorkerIds");
    expect(source).toContain("workerIds={savedWorkerIds}");
  });

  it("retains the share session and does not infer confirmation readiness from fixture success", () => {
    const source = fs.readFileSync(path.join(process.cwd(), "components", "WorkflowSharePanel.tsx"), "utf8");

    expect(source).toContain("setShareSessionId");
    expect(source).toContain("dispatchAuthenticatedShareSession");
    expect(source).toContain("서버 확인 전");
    expect(source).toContain("미리보기 언어");
    expect(source).toContain("저장된 작업팩과 작업자 언어 스냅샷");
    expect(source).toContain('validationOnlyResult ? "validation-only"');
    expect(source).not.toContain('result?.ok\n    ? "전파 요청 기록됨"');
  });
});
