import { describe, expect, it } from "vitest";

import {
  buildShareEvidenceSummary,
  buildWorkflowShareEvidenceScopeKey,
  buildWorkflowShareRequestScopeKey,
  buildWorkflowShareTargetSignature,
  classifyWorkflowDispatchPresentation,
  createWorkflowShareEvidenceState,
  readWorkflowShareEvidenceForScope,
  reduceWorkflowShareEvidence,
  resolveShareLanguagePresentation,
  resolveShareProductPresentation
} from "@/components/WorkflowSharePolicy";

describe("workflow share panel behavior", () => {
  it("changes the async request identity for target, workpack authority, and channel scope", () => {
    const base = {
      authorityScope: "workpack-a:target-a",
      eligible: true,
      operatorNote: "",
      authority: {
        workpackId: "workpack-a",
        canonicalWorkpackRevision: "revision-a",
        workerIds: ["worker-a"]
      },
      selectedChannels: ["email", "sms"],
      channelResolution: {
        ready: true,
        workpackId: "workpack-a",
        canonicalWorkpackRevision: "revision-a",
        requestedChannels: ["email", "sms"],
        availabilityToken: "availability-a",
        expiresAt: "2099-07-14T00:00:00.000Z"
      }
    } as const;
    const baseKey = buildWorkflowShareRequestScopeKey(base);

    expect(buildWorkflowShareRequestScopeKey({
      ...base,
      authorityScope: "workpack-a:target-b"
    })).not.toBe(baseKey);
    expect(buildWorkflowShareRequestScopeKey({
      ...base,
      authority: { ...base.authority, canonicalWorkpackRevision: "revision-b" }
    })).not.toBe(baseKey);
    expect(buildWorkflowShareRequestScopeKey({
      ...base,
      selectedChannels: ["email"],
      channelResolution: {
        ...base.channelResolution,
        requestedChannels: ["email"],
        availabilityToken: "availability-b"
      }
    })).not.toBe(baseKey);
    expect(buildWorkflowShareRequestScopeKey(base)).toBe(baseKey);
  });

  it("clears result, session, and log evidence when the target or workpack scope changes", () => {
    const targetSignature = buildWorkflowShareTargetSignature([{
      displayName: "Worker One",
      role: "painter",
      nationality: "VN",
      languageCode: "vi",
      languageLabel: "베트남어",
      trainingStatus: "required"
    }]);
    const previousScope = buildWorkflowShareEvidenceScopeKey({
      workpackId: "workpack-a",
      targetSignature,
      workerIds: ["11111111-1111-4111-8111-111111111111"]
    });
    const nextScope = buildWorkflowShareEvidenceScopeKey({
      workpackId: "workpack-a",
      targetSignature,
      workerIds: ["22222222-2222-4222-8222-222222222222"]
    });
    const populated = {
      ...createWorkflowShareEvidenceState(previousScope),
      result: { ok: true, configured: true, message: "old dispatch sent" },
      resultSource: "dispatch" as const,
      shareSessionId: "33333333-3333-4333-8333-333333333333",
      logSaveState: {
        status: "saved" as const,
        message: "old logs saved",
        savedCount: 2,
        knownTotal: 2
      }
    };

    const reset = reduceWorkflowShareEvidence(populated, {
      type: "scope_changed",
      scopeKey: nextScope
    });

    expect(reset).toEqual(createWorkflowShareEvidenceState(nextScope));
    expect(readWorkflowShareEvidenceForScope(populated, nextScope)).toEqual(
      createWorkflowShareEvidenceState(nextScope)
    );
    expect(reduceWorkflowShareEvidence(reset, {
      type: "set_result",
      scopeKey: previousScope,
      result: populated.result,
      resultSource: "dispatch"
    })).toEqual(reset);

    const nextWorkpack = reduceWorkflowShareEvidence(populated, {
      type: "scope_changed",
      scopeKey: buildWorkflowShareEvidenceScopeKey({
        workpackId: "workpack-b",
        targetSignature,
        workerIds: ["11111111-1111-4111-8111-111111111111"]
      })
    });
    expect(nextWorkpack).toEqual(createWorkflowShareEvidenceState(nextWorkpack.scopeKey));
    expect(nextScope).not.toBe(previousScope);
  });

  it("uses current target languages when a historical session will not be reused", () => {
    const historicalSession = {
      id: "33333333-3333-4333-8333-333333333333",
      status: "active",
      shareScope: "invited",
      anonymousAllowed: false,
      expiresAt: null,
      recipients: [{
        workerId: "11111111-1111-4111-8111-111111111111",
        displayName: "Worker One",
        languageCode: "vi",
        role: "viewer",
        workerSnapshot: {
          workerId: "11111111-1111-4111-8111-111111111111",
          displayName: "Worker One",
          languageCode: "vi",
          languageLabel: "베트남어"
        }
      }]
    };

    expect(resolveShareLanguagePresentation({
      session: historicalSession,
      sessionReusable: false,
      plannedLanguageLabels: ["태국어"]
    })).toEqual({
      label: "태국어",
      basis: "선택 대상 기준 · 새 세션의 서버 snapshot 생성 후 재확인"
    });
    expect(resolveShareLanguagePresentation({
      session: historicalSession,
      sessionReusable: true,
      plannedLanguageLabels: ["태국어"]
    })).toEqual({
      label: "베트남어",
      basis: "재사용 session workerSnapshot 기준"
    });
  });

  it("separates saved evidence, planned records, uncertain logs, and unsupported worker acknowledgements", () => {
    const summary = buildShareEvidenceSummary({
      workpackSaved: true,
      sessionSaved: false,
      dispatchLogState: "uncertain",
      workerConfirmationSupported: false
    });

    expect(summary).toEqual({
      headline: "저장 확인과 계획 분리",
      detail: "workpack 저장 확인 · 초대 snapshot 생성 계획 · provider 로그 저장 미확인 · 작업자 확인 인증 경로 미연결"
    });
    expect(summary.detail).not.toContain("4개 기록 분리");
  });

  it("marks partial and unconfigured channel aggregates as incomplete problem states", () => {
    expect(classifyWorkflowDispatchPresentation({
      resultSource: "dispatch",
      validationOnly: false,
      result: {
        ok: true,
        configured: true,
        message: "provider accepted",
        channelResults: [
          { channel: "email", status: "sent" },
          { channel: "kakao", status: "unconfigured" }
        ]
      }
    })).toEqual({ succeeded: false, hasFailure: true, fullySent: false });
    expect(classifyWorkflowDispatchPresentation({
      resultSource: "dispatch",
      validationOnly: false,
      result: {
        ok: true,
        configured: true,
        message: "all sent",
        channelResults: [
          { channel: "email", status: "sent" },
          { channel: "sms", status: "sent" }
        ]
      }
    })).toEqual({ succeeded: false, hasFailure: true, fullySent: false });
    expect(classifyWorkflowDispatchPresentation({
      resultSource: "dispatch",
      validationOnly: false,
      result: {
        ok: true,
        configured: true,
        state: "recorded",
        outcome: "accepted",
        message: "recorded",
        workflowRunId: "run-1",
        idempotencyKey: "server-key-1",
        idempotencySupported: true,
        duplicateRisk: false,
        providerCalled: true,
        channelResults: [
          { channel: "email", provider: "n8n-relay", status: "sent" },
          { channel: "sms", provider: "n8n-relay", status: "sent" }
        ],
        logIds: ["log-1", "log-2"],
        receipt: {
          version: "server-dispatch-receipt/v1",
          receiptId: "receipt-1",
          shareSessionId: "session-1",
          idempotencyKey: "server-key-1",
          workpackId: "workpack-1",
          canonicalWorkpackRevision: "revision-1",
          outcome: "accepted",
          workflowRunId: "run-1",
          logIds: ["log-1", "log-2"],
          recordedAt: "2026-07-14T00:00:00.000Z"
        }
      }
    })).toEqual({ succeeded: true, hasFailure: false, fullySent: true });
  });

  it("applies revalidation before generic blocked, offline, target, and auth states", () => {
    const presentation = resolveShareProductPresentation({
      theme: "night",
      sending: false,
      outcome: null,
      staleReason: null,
      requiresRevalidation: true,
      readinessCanShare: false,
      online: false,
      targetCount: 0,
      authenticated: false,
      authorityStatus: "idle",
      channelStatus: "idle"
    });

    expect(presentation).toMatchObject({
      state: "workpack_revalidation",
      primary: {
        kind: "link",
        label: "문서 다시 검수",
        href: "/workspace?step=document&returnStep=share&theme=night"
      }
    });
  });

  it("routes an empty target and invalid locale to the workers owner without interpolating locale", () => {
    expect(resolveShareProductPresentation({
      theme: "day",
      sending: false,
      outcome: null,
      staleReason: null,
      requiresRevalidation: false,
      readinessCanShare: true,
      online: true,
      targetCount: 0,
      authenticated: true,
      authorityStatus: "idle",
      channelStatus: "idle"
    })).toMatchObject({
      state: "no_recipients",
      primary: {
        label: "오늘 참여자 선택",
        href: `/workers?next=${encodeURIComponent("/workspace?step=share&theme=day")}`
      }
    });

    const invalid = resolveShareProductPresentation({
      theme: "day",
      sending: false,
      outcome: null,
      staleReason: null,
      requiresRevalidation: false,
      readinessCanShare: true,
      online: true,
      targetCount: 1,
      authenticated: true,
      authorityStatus: "recipient_locale_invalid",
      channelStatus: "idle",
      validatedLanguage: "vi-VN"
    });
    expect(invalid).toMatchObject({
      state: "review_required",
      primary: {
        label: "작업자 언어 확인",
        href: expect.stringContaining("/workers?focus=language&next=")
      }
    });
    expect(invalid.primary.href).not.toContain("language=");
    expect(invalid.primary.href).not.toContain("vi-VN");
  });

  it("routes a supported incomplete translation to the validated document owner", () => {
    expect(resolveShareProductPresentation({
      theme: "night",
      sending: false,
      outcome: null,
      staleReason: null,
      requiresRevalidation: false,
      readinessCanShare: true,
      online: true,
      targetCount: 2,
      authenticated: true,
      authorityStatus: "translation_incomplete",
      channelStatus: "idle",
      validatedLanguage: "vi"
    })).toMatchObject({
      state: "review_required",
      primary: {
        label: "번역본 보완",
        href: "/workspace?step=document&document=foreignWorkerTransmission&language=vi&returnStep=share&theme=night"
      }
    });
  });

  it("keeps an unimplemented channel settings owner as an honest disabled blocker", () => {
    const presentation = resolveShareProductPresentation({
      theme: "day",
      sending: false,
      outcome: null,
      staleReason: null,
      requiresRevalidation: false,
      readinessCanShare: true,
      online: true,
      targetCount: 1,
      authenticated: true,
      authorityStatus: "ready",
      channelStatus: "unavailable"
    });

    expect(presentation).toMatchObject({
      state: "blocked",
      primary: {
        kind: "button",
        label: "채널 연결 대기",
        disabled: true
      }
    });
    expect(presentation.primary.href).toBeUndefined();
  });

  it("keeps exactly one state-specific primary through ready, sending, session failure, and persisted result", () => {
    const base = {
      theme: "day" as const,
      staleReason: null,
      requiresRevalidation: false,
      readinessCanShare: true,
      online: true,
      targetCount: 2,
      authenticated: true,
      authorityStatus: "ready" as const,
      channelStatus: "ready" as const
    };
    expect(resolveShareProductPresentation({ ...base, sending: false, outcome: null })).toMatchObject({
      state: "ready",
      primary: { kind: "button", label: "2명에게 전송", action: "send", disabled: false }
    });
    expect(resolveShareProductPresentation({ ...base, sending: true, outcome: null })).toMatchObject({
      state: "sending",
      primary: { kind: "button", label: "전송 중", disabled: true }
    });
    expect(resolveShareProductPresentation({
      ...base,
      sending: false,
      outcome: { stage: "session_failed", logIds: [] }
    })).toMatchObject({
      state: "fail",
      primary: { kind: "button", label: "초대 세션 다시 시도", action: "recheck" }
    });
    expect(resolveShareProductPresentation({
      ...base,
      sending: false,
      outcome: { stage: "accepted", logIds: ["77777777-7777-4777-8777-777777777777"] }
    })).toMatchObject({
      state: "success",
      primary: { kind: "link", label: "전파 이력 확인", href: "/dispatch" }
    });
  });
});
