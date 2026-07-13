import fs from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";

const clientPath = path.join(process.cwd(), "lib", "workflow-share-client.ts");
const policyPath = path.join(process.cwd(), "components", "WorkflowSharePolicy.ts");
const WORKPACK_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const WORKER_ID = "11111111-1111-4111-8111-111111111111";
const CANONICAL_REVISION = "a".repeat(64);
const AVAILABILITY_TOKEN = "signed-availability-token";
const SESSION_AUTHORITY = {
  channels: ["email", "sms"] as const,
  canonicalWorkpackRevision: CANONICAL_REVISION,
  availabilityToken: AVAILABILITY_TOKEN
};

async function loadClient() {
  expect(fs.existsSync(clientPath), "authenticated share client helper must exist").toBe(true);
  return await import("@/lib/workflow-share-client");
}

async function loadPolicy() {
  expect(fs.existsSync(policyPath), "share session policy helper must exist").toBe(true);
  return await import("@/components/WorkflowSharePolicy");
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
      expiresAt: "2099-01-01T00:00:00.000Z",
      message: "공유 세션 생성 완료"
    }), { status: 200, headers: { "content-type": "application/json" } }));

    const result = await createAuthenticatedShareSession(fetcher, {
      authToken: "access-token",
      workpackId: WORKPACK_ID,
      workerIds: [WORKER_ID],
      ...SESSION_AUTHORITY
    });

    expect(result.shareSessionId).toBe("33333333-3333-4333-8333-333333333333");
    expect(result.expiresAt).toBe("2099-01-01T00:00:00.000Z");
    expect(fetcher).toHaveBeenCalledWith(
      "/api/workpacks/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/share-sessions",
      {
        method: "POST",
        headers: {
          authorization: "Bearer access-token",
          "content-type": "application/json"
        },
        body: JSON.stringify({
          recipients: [WORKER_ID],
          channels: ["email", "sms"],
          canonicalWorkpackRevision: CANONICAL_REVISION,
          availabilityToken: AVAILABILITY_TOKEN
        })
      }
    );
  });

  it("dispatches only server authority identifiers, channels, and operator note", async () => {
    const { dispatchAuthenticatedShareSession } = await loadClient();
    const fetcher = vi.fn(async (_input: string, _init: RequestInit) => new Response(JSON.stringify({
      ok: true,
      configured: true,
      workflowRunId: "run-1",
      idempotencyKey: "provider-dispatch-v1-44444444-4444-4444-8444-444444444444-deadbeef",
      message: "전파 접수 완료"
    }), { status: 200, headers: { "content-type": "application/json" } }));

    const result = await dispatchAuthenticatedShareSession(fetcher, {
      authToken: "access-token",
      workpackId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      shareSessionId: "33333333-3333-4333-8333-333333333333",
      idempotencyKey: "provider-dispatch-v1-44444444-4444-4444-8444-444444444444-deadbeef",
      channels: ["email", "sms"],
      operatorNote: "TBM 후 확인"
    });

    expect(result.ok).toBe(true);
    expect(result.idempotencyKey).toBe("provider-dispatch-v1-44444444-4444-4444-8444-444444444444-deadbeef");
    const request = fetcher.mock.calls[0];
    expect(request?.[0]).toBe("/api/workflow/dispatch");
    expect(request?.[1]?.headers).toEqual({
      authorization: "Bearer access-token",
      "content-type": "application/json"
    });
    expect(JSON.parse(String(request?.[1]?.body))).toEqual({
      workpackId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      shareSessionId: "33333333-3333-4333-8333-333333333333",
      idempotencyKey: "provider-dispatch-v1-44444444-4444-4444-8444-444444444444-deadbeef",
      channels: ["email", "sms"],
      operatorNote: "TBM 후 확인"
    });
  });

  it("returns a fail-closed provider idempotency response without treating it as delivery", async () => {
    const { dispatchAuthenticatedShareSession, isProviderDispatchConfirmed } = await loadClient();
    const fetcher = vi.fn(async () => new Response(JSON.stringify({
      ok: false,
      configured: false,
      providerStatus: "idempotency-unsupported",
      idempotencyKey: "provider-dispatch-v1-44444444-4444-4444-8444-444444444444-deadbeef",
      idempotencySupported: false,
      duplicateRisk: true,
      providerCalled: false,
      message: "영속 중복방지를 보장할 수 없어 provider 호출을 차단했습니다."
    }), { status: 409, headers: { "content-type": "application/json" } }));

    const result = await dispatchAuthenticatedShareSession(fetcher, {
      authToken: "access-token",
      workpackId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      shareSessionId: "33333333-3333-4333-8333-333333333333",
      idempotencyKey: "provider-dispatch-v1-44444444-4444-4444-8444-444444444444-deadbeef",
      channels: ["sms"],
      operatorNote: ""
    });

    expect(result).toMatchObject({
      ok: false,
      providerStatus: "idempotency-unsupported",
      idempotencySupported: false,
      duplicateRisk: true,
      providerCalled: false
    });
    expect(isProviderDispatchConfirmed(result)).toBe(false);
  });

  it("preserves an uncertain provider response with its idempotency key and duplicate risk", async () => {
    const { dispatchAuthenticatedShareSession, isProviderDispatchConfirmed } = await loadClient();
    const idempotencyKey = "provider-dispatch-v1-44444444-4444-4444-8444-444444444444-deadbeef";
    const fetcher = vi.fn(async () => new Response(JSON.stringify({
      ok: false,
      configured: true,
      providerStatus: "provider-response-uncertain",
      idempotencyKey,
      idempotencySupported: true,
      duplicateRisk: true,
      providerCalled: true,
      message: "provider 호출 후 응답을 확정하지 못했습니다."
    }), { status: 502, headers: { "content-type": "application/json" } }));

    const result = await dispatchAuthenticatedShareSession(fetcher, {
      authToken: "access-token",
      workpackId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      shareSessionId: "33333333-3333-4333-8333-333333333333",
      idempotencyKey,
      channels: ["sms"],
      operatorNote: ""
    });

    expect(result).toMatchObject({
      ok: false,
      idempotencyKey,
      idempotencySupported: true,
      duplicateRisk: true,
      providerCalled: true
    });
    expect(isProviderDispatchConfirmed(result)).toBe(false);
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
      workpackId: WORKPACK_ID,
      workerIds: [WORKER_ID],
      ...SESSION_AUTHORITY
    })).rejects.toThrow("서버 검수에서 공유 준비가 확인되지 않았습니다. (HTTP 409)");

    const malformedFetcher = vi.fn(async () => new Response(JSON.stringify({
      ok: true,
      configured: true,
      message: "세션 생성됨"
    }), { status: 200, headers: { "content-type": "application/json" } }));
    await expect(createAuthenticatedShareSession(malformedFetcher, {
      authToken: "access-token",
      workpackId: WORKPACK_ID,
      workerIds: [WORKER_ID],
      ...SESSION_AUTHORITY
    })).rejects.toThrow("공유 세션 응답에 shareSessionId가 없습니다.");

    const invalidSessionFetcher = vi.fn(async () => new Response(JSON.stringify({
      ok: true,
      configured: true,
      shareSessionId: "fixture-session",
      message: "세션 생성됨"
    }), { status: 200, headers: { "content-type": "application/json" } }));
    await expect(createAuthenticatedShareSession(invalidSessionFetcher, {
      authToken: "access-token",
      workpackId: WORKPACK_ID,
      workerIds: [WORKER_ID],
      ...SESSION_AUTHORITY
    })).rejects.toThrow("공유 세션 응답의 shareSessionId가 올바른 UUID가 아닙니다.");

    const dispatchFetcher = vi.fn(async () => new Response("gateway unavailable", { status: 502 }));
    await expect(dispatchAuthenticatedShareSession(dispatchFetcher, {
      authToken: "access-token",
      workpackId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      shareSessionId: "33333333-3333-4333-8333-333333333333",
      idempotencyKey: "provider-dispatch-v1-44444444-4444-4444-8444-444444444444-deadbeef",
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

  it("loads current server workpack and worker authority without mutating the roster", async () => {
    const { loadAuthenticatedShareAuthority } = await loadClient();
    const requests: Array<{ input: string; init: RequestInit }> = [];
    const validDetail = {
      ok: true,
      workpack: {
        id: WORKPACK_ID,
        reopenData: {
          question: "성수동 외벽 도장",
          generationEvidence: { signature: "generation-signature-1" },
          scenario: {
            companyName: "SafeClaw Pilot",
            siteName: "성수 현장",
            workSummary: "외벽 도장"
          },
          riskSummary: {
            topRisk: "추락",
            immediateActions: ["난간 확인"]
          },
          deliverables: {
            foreignWorkerTransmission: "작업 전 난간을 확인합니다."
          }
        }
      },
      shareLocalization: {
        ok: true,
        canonicalWorkpackRevision: CANONICAL_REVISION,
        reviewedEnvelopes: {
          vi: {
            targetLocale: "vi",
            artifactDigest: "b".repeat(64),
            review: { state: "approved" },
            artifact: {
              targetLocale: "vi",
              localized: {
                subject: "Thông báo an toàn",
                metadata: {
                  siteLabel: "Công trường",
                  siteValue: "Seongsu",
                  taskLabel: "Công việc",
                  taskValue: "Sơn tường ngoài",
                  coreRiskLabel: "Rủi ro chính",
                  coreRiskValue: "Ngã cao"
                },
                bodyLines: ["Kiểm tra lan can trước khi làm việc."],
                semanticRiskLabels: ["Nguy cơ ngã", "Dừng việc và báo cáo"]
              }
            }
          }
        }
      }
    };
    const fetcher = vi.fn(async (input: string, init: RequestInit) => {
      requests.push({ input, init });
      if (input === "/api/workpacks?limit=50") {
        return Response.json({ ok: true, workpacks: [{ id: WORKPACK_ID, question: "성수동 외벽 도장" }] });
      }
      if (input === `/api/workpacks/${WORKPACK_ID}`) return Response.json(validDetail);
      if (input.startsWith("/api/workers?")) {
        return Response.json({
          ok: true,
          workers: [{
            id: WORKER_ID,
            external_key: "worker-local-a",
            display_name: "Nguyen Van A",
            language_code: "vi"
          }]
        });
      }
      throw new Error(`Unexpected request ${input}`);
    });

    const result = await loadAuthenticatedShareAuthority(fetcher, {
      authToken: "access-token",
      knownWorkpackId: null,
      question: "성수동 외벽 도장",
      generationEvidenceSignature: "generation-signature-1",
      scenario: {
        companyName: "SafeClaw Pilot",
        siteName: "성수 현장",
        companyType: "건설업"
      },
      selectedWorkers: [{
        externalKey: "worker-local-a",
        displayName: "Nguyen Van A",
        languageCode: "vi"
      }]
    });

    expect(result).toMatchObject({
      ok: true,
      workpackId: WORKPACK_ID,
      workerIds: [WORKER_ID],
      recipientLocales: ["vi"],
      canonicalWorkpackRevision: CANONICAL_REVISION,
      previews: {
        vi: {
          subject: "Thông báo an toàn",
          metadata: { coreRiskValue: "Ngã cao" }
        }
      }
    });
    expect(requests.every((item) => !item.init.method || item.init.method === "GET")).toBe(true);
  });

  it("fails closed when a supported translation is incomplete or retains Korean metadata", async () => {
    const { parseAuthenticatedWorkpackShareAuthority } = await loadClient();
    const result = parseAuthenticatedWorkpackShareAuthority({
      expectedWorkpackId: WORKPACK_ID,
      expectedGenerationEvidenceSignature: "generation-signature-1",
      recipientLocales: ["vi"],
      payload: {
        ok: true,
        workpack: {
          id: WORKPACK_ID,
          reopenData: { generationEvidence: { signature: "generation-signature-1" } }
        },
        shareLocalization: {
          ok: true,
          canonicalWorkpackRevision: CANONICAL_REVISION,
          reviewedEnvelopes: {
            vi: {
              targetLocale: "vi",
              artifactDigest: "b".repeat(64),
              review: { state: "approved" },
              artifact: {
                targetLocale: "vi",
                localized: {
                  subject: "Thông báo an toàn",
                  metadata: {
                    siteLabel: "Công trường",
                    siteValue: "성수 현장",
                    taskLabel: "Công việc",
                    taskValue: "Sơn tường ngoài",
                    coreRiskLabel: "Rủi ro chính",
                    coreRiskValue: "Ngã cao"
                  },
                  bodyLines: ["Kiểm tra lan can."],
                  semanticRiskLabels: ["Nguy cơ ngã"]
                }
              }
            }
          }
        }
      }
    });

    expect(result).toEqual({
      ok: false,
      reasonCode: "translation_incomplete",
      validatedSupportedCode: "vi"
    });
  });

  it("resolves channels with exact server identifiers and persists only log IDs as evidence", async () => {
    const { persistAuthenticatedDispatchLogs, resolveAuthenticatedShareChannels } = await loadClient();
    const fetcher = vi.fn(async (input: string, init: RequestInit) => {
      if (input === "/api/settings/channels/resolve") {
        return Response.json({
          ok: true,
          version: "channel-availability/v1",
          workpackId: WORKPACK_ID,
          canonicalWorkpackRevision: CANONICAL_REVISION,
          recipientDigest: "c".repeat(64),
          requestedChannels: ["email", "sms"],
          dispatchMode: "fixture",
          channels: [
            { channel: "email", available: true, reasonCode: "available" },
            { channel: "sms", available: true, reasonCode: "available" }
          ],
          configurationVersion: "channel-configuration/v2",
          configurationRevision: 7,
          configurationDigestKeyId: "channel-key-2026-07",
          configurationDigest: "d".repeat(64),
          resolvedAt: "2026-07-14T00:00:00.000Z",
          expiresAt: "2099-01-01T00:00:00.000Z",
          availabilityToken: AVAILABILITY_TOKEN,
          ready: true
        });
      }
      if (input === "/api/dispatch-logs") {
        return Response.json({
          ok: true,
          configured: true,
          savedCount: 2,
          logIds: [
            "77777777-7777-4777-8777-777777777777",
            "88888888-8888-4888-8888-888888888888"
          ],
          message: "전파 이력을 저장했습니다."
        });
      }
      throw new Error(`Unexpected request ${input}: ${String(init.body)}`);
    });

    const channels = await resolveAuthenticatedShareChannels(fetcher, {
      authToken: "access-token",
      workpackId: WORKPACK_ID,
      canonicalWorkpackRevision: CANONICAL_REVISION,
      workerIds: [WORKER_ID],
      requestedChannels: ["email", "sms"]
    });
    expect(channels).toMatchObject({ ready: true, availabilityToken: AVAILABILITY_TOKEN });
    expect(JSON.parse(String(fetcher.mock.calls[0]?.[1]?.body))).toEqual({
      workpackId: WORKPACK_ID,
      canonicalWorkpackRevision: CANONICAL_REVISION,
      recipients: [WORKER_ID],
      requestedChannels: ["email", "sms"]
    });

    const logs = await persistAuthenticatedDispatchLogs(fetcher, {
      authToken: "access-token",
      workpackId: WORKPACK_ID,
      logs: [
        { channel: "email", providerStatus: "sent" },
        { channel: "sms", providerStatus: "failed" }
      ]
    });
    expect(logs.logIds).toHaveLength(2);
    expect(logs.savedCount).toBe(2);
  });
});

describe("workflow share component wiring", () => {
  it("passes local worker keys only as read-only server lookup inputs on Share", () => {
    const source = fs.readFileSync(path.join(process.cwd(), "components", "FieldOperationsWorkspace.tsx"), "utf8");

    expect(source).toContain("selectedWorkerKeys={selectedWorkerIds}");
    const shareOnly = source.slice(source.indexOf('if (surface === "share")'), source.indexOf("const workspaceSide"));
    expect(shareOnly).not.toContain("ensureWorkpackSaved");
    expect(shareOnly).not.toContain("workerIds={savedWorkerIds}");
  });

  it("adapts dense share controls to the panel width instead of only the viewport", () => {
    const source = fs.readFileSync(path.join(process.cwd(), "components", "WorkflowSharePanel.tsx"), "utf8");
    const cssPath = path.join(process.cwd(), "components", "WorkflowSharePanel.module.css");

    expect(fs.existsSync(cssPath)).toBe(true);
    const css = fs.existsSync(cssPath) ? fs.readFileSync(cssPath, "utf8") : "";
    expect(source).toContain('import styles from "@/components/WorkflowSharePanel.module.css"');
    expect(source).toContain("data-share-primary");
    expect(source).toContain("data-share-preview");
    expect(source).toContain("loadAuthenticatedShareAuthority");
    expect(source).toContain("resolveAuthenticatedShareChannels");
    expect(source).toContain("buildProviderDispatchIdempotencyKey");
    expect(source).not.toContain("parseWorkflowShareArchive");
    expect(source).not.toContain("buildReadConfirmationStatus");
    expect(source).not.toContain("share-session-details");
    expect(source).not.toContain("language-chip");
    expect(source).toContain("<textarea");
    expect(css).toContain("container-type: inline-size");
    expect(css).toContain("@container (max-width: 560px)");
    expect(css).toContain("min-height: 44px");
    expect(css).toContain("max-height: min(34vh, 320px)");
  });

});

describe("workflow share session policy", () => {
  const authority = {
    workpackId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    workerIds: ["11111111-1111-4111-8111-111111111111"]
  };
  const reusableSession = {
    id: "33333333-3333-4333-8333-333333333333",
    status: "active",
    shareScope: "invited",
    anonymousAllowed: false,
    expiresAt: "2030-01-01T00:00:00.000Z",
    recipients: [{
      workerId: authority.workerIds[0],
      displayName: "Server Nguyen",
      languageCode: "ko",
      role: "viewer",
      workerSnapshot: {
        workerId: authority.workerIds[0],
        displayName: "Server Nguyen",
        languageCode: "vi",
        languageLabel: "베트남어"
      }
    }]
  };

  it("classifies admin-bearer confirmation rows as admin_marked and excludes them from worker totals", async () => {
    const { buildReadConfirmationStatus, parseAdminConfirmationRows, summarizeReadConfirmations } = await loadPolicy();
    const confirmations = parseAdminConfirmationRows([{
      id: "confirmation-1",
      share_session_id: reusableSession.id,
      worker_display_name: "Server Nguyen",
      language_code: "vi",
      confirmation_method: "button",
      read_at: "2026-07-11T01:00:00.000Z"
    }]);

    expect(confirmations).toEqual([expect.objectContaining({ confirmationKind: "admin_marked" })]);
    const summary = summarizeReadConfirmations(confirmations, reusableSession.id);
    expect(summary).toEqual({
      workerConfirmedCount: 0,
      adminMarkedCount: 1
    });
    expect(buildReadConfirmationStatus({
      hasSession: true,
      recipientCount: 1,
      historyError: false,
      ...summary
    })).toEqual({
      label: "0/1명 작업자 확인",
      detail: "전송 완료와 별도 · 관리자 표시 1건은 작업자 확인 집계에서 제외",
      nextAction: "invitee-scoped 인증 경로 연결 후 확인 수집"
    });
  });

  it("parses expires_at and the persisted workerSnapshot without substituting target data", async () => {
    const { parseShareSessionRows } = await loadPolicy();
    const sessions = parseShareSessionRows([{
      id: reusableSession.id,
      status: "active",
      share_scope: "invited",
      access_policy: { anonymousAllowed: false },
      expires_at: reusableSession.expiresAt,
      recipients_snapshot: reusableSession.recipients.map((recipient) => ({
        ...recipient,
        languageCode: "ko"
      })),
      created_at: "2026-07-11T00:00:00.000Z"
    }]);

    expect(sessions).toEqual([expect.objectContaining({
      expiresAt: reusableSession.expiresAt,
      recipients: [expect.objectContaining({
        languageCode: "ko",
        workerSnapshot: expect.objectContaining({ languageCode: "vi", languageLabel: "베트남어" })
      })]
    })]);
  });

  it("does not select any historical session without valid authority and a current target", async () => {
    const { selectAuthorityShareSession, selectReusableShareSession } = await loadPolicy();

    expect(selectReusableShareSession([reusableSession], null, 0, Date.parse("2026-07-11T00:00:00.000Z"))).toBeNull();
    expect(selectReusableShareSession([reusableSession], authority, 0, Date.parse("2026-07-11T00:00:00.000Z"))).toBeNull();
    expect(selectAuthorityShareSession([reusableSession], null, 0)).toBeNull();
  });

  it("shows an exact authority session as history but marks missing expiry as non-reusable", async () => {
    const { evaluateShareSessionReuse, selectAuthorityShareSession, selectReusableShareSession } = await loadPolicy();
    const sessionWithoutExpiry = { ...reusableSession, expiresAt: null };

    expect(selectAuthorityShareSession([sessionWithoutExpiry], authority, 1)).toEqual(sessionWithoutExpiry);
    expect(evaluateShareSessionReuse(
      sessionWithoutExpiry,
      authority,
      1,
      Date.parse("2026-07-11T00:00:00.000Z")
    )).toEqual({ reusable: false, reason: "expiry_missing" });
    expect(selectReusableShareSession(
      [sessionWithoutExpiry],
      authority,
      1,
      Date.parse("2026-07-11T00:00:00.000Z")
    )).toBeNull();
  });

  it.each([
    ["public scope", { shareScope: "public" }],
    ["anonymous access", { anonymousAllowed: true }],
    ["editor recipient", { recipients: [{ ...reusableSession.recipients[0], role: "editor" }] }],
    ["expired session", { expiresAt: "2026-07-10T23:59:59.000Z" }],
    ["missing expiry", { expiresAt: null }],
    ["missing worker snapshot", { recipients: [{ ...reusableSession.recipients[0], workerSnapshot: null }] }],
    ["different recipient snapshot", {
      recipients: [{
        ...reusableSession.recipients[0],
        workerId: "22222222-2222-4222-8222-222222222222",
        workerSnapshot: {
          ...reusableSession.recipients[0].workerSnapshot,
          workerId: "22222222-2222-4222-8222-222222222222"
        }
      }]
    }]
  ])("rejects reuse for %s", async (_label, override) => {
    const { selectReusableShareSession } = await loadPolicy();
    const session = { ...reusableSession, ...override };

    expect(selectReusableShareSession([session], authority, 1, Date.parse("2026-07-11T00:00:00.000Z"))).toBeNull();
  });

  it("reuses only a permission-ready, unexpired, exact-recipient viewer session", async () => {
    const { isShareSessionPermissionReady, selectReusableShareSession } = await loadPolicy();

    expect(isShareSessionPermissionReady(reusableSession)).toBe(true);
    expect(selectReusableShareSession(
      [reusableSession],
      authority,
      1,
      Date.parse("2026-07-11T00:00:00.000Z")
    )).toEqual(reusableSession);
  });

  it("uses the persisted workerSnapshot language instead of the current target language", async () => {
    const { getSessionLanguageLabels } = await loadPolicy();

    expect(getSessionLanguageLabels(reusableSession)).toEqual(["베트남어"]);
  });

  it("rejects a non-UUID authority workpack ID", async () => {
    const { validateShareAuthority } = await loadPolicy();

    expect(validateShareAuthority({ ...authority, workpackId: "workpack-fixture" }, 1)).toEqual({
      ok: false,
      reason: "workpack_id_invalid"
    });
    expect(validateShareAuthority(authority, 1)).toEqual({ ok: true });
  });

  it("builds a stable dispatch-log idempotency key but blocks retry while the server lacks support", async () => {
    const { buildDispatchLogIdempotencyKey, getDispatchLogRetryPolicy } = await loadPolicy();
    const input = {
      workpackId: authority.workpackId,
      shareSessionId: reusableSession.id,
      dispatchAttemptId: "44444444-4444-4444-8444-444444444444",
      workflowRunId: "run-1",
      logs: [
        { channel: "sms", provider: "twilio", providerStatus: "sent" },
        { channel: "email", provider: "sendgrid", providerStatus: "sent" }
      ]
    };

    const first = buildDispatchLogIdempotencyKey(input);
    const reordered = buildDispatchLogIdempotencyKey({ ...input, logs: [...input.logs].reverse() });
    const nextAttempt = buildDispatchLogIdempotencyKey({
      ...input,
      dispatchAttemptId: "55555555-5555-4555-8555-555555555555"
    });
    expect(first).toMatch(/^dispatch-v1-44444444-4444-4444-8444-444444444444-[0-9a-f]{8}$/);
    expect(reordered).toBe(first);
    expect(nextAttempt).not.toBe(first);
    expect(getDispatchLogRetryPolicy(false)).toEqual(expect.objectContaining({
      retryAllowed: false,
      duplicateRisk: true
    }));
  });
});
