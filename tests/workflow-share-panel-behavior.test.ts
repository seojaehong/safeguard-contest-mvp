import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { buildSampleWorkpack } from "@/lib/sample-workpack";
import {
  buildCanonicalRecipientMessageVariants,
  resolveWorkflowMessagePreview
} from "@/lib/workflow-share-client";

import {
  buildProviderDispatchIdempotencyKey,
  buildShareEvidenceSummary,
  buildWorkflowShareEvidenceScopeKey,
  buildWorkflowShareTargetSignature,
  classifyWorkflowDispatchPresentation,
  createWorkflowShareEvidenceState,
  readWorkflowShareEvidenceForScope,
  reduceWorkflowShareEvidence,
  resolveShareLanguagePresentation
} from "@/components/WorkflowSharePolicy";

describe("workflow share panel behavior", () => {
  it("keeps canonical recipient variants unchanged when the manager changes preview language", () => {
    const data = buildSampleWorkpack();
    const recipientLanguageCodes = ["ko", "vi"];
    const beforePreviewChange = buildCanonicalRecipientMessageVariants({ data, recipientLanguageCodes });

    expect(resolveWorkflowMessagePreview(data, "manager")).toBe(data.deliverables.kakaoMessage);
    expect(resolveWorkflowMessagePreview(data, "foreign:vi")).toContain("Tiếng Việt");

    const afterPreviewChange = buildCanonicalRecipientMessageVariants({ data, recipientLanguageCodes });
    expect(afterPreviewChange).toEqual(beforePreviewChange);
    expect(afterPreviewChange).toMatchObject({
      ok: true,
      messageVariants: {
        ko: data.deliverables.kakaoMessage.trim(),
        vi: expect.stringContaining("Tiếng Việt")
      }
    });
    if (afterPreviewChange.ok) {
      expect(afterPreviewChange.messageVariants.vi).not.toMatch(/[가-힣]/u);
    }
  });

  it("fails closed for a malformed language code stored in the workpack", () => {
    const data = buildSampleWorkpack();
    const malformedCode = "vi<script>";
    const malformed = {
      ...data,
      deliverables: {
        ...data.deliverables,
        foreignWorkerLanguages: [{
          ...data.deliverables.foreignWorkerLanguages[0],
          code: malformedCode
        }]
      }
    };

    expect(buildCanonicalRecipientMessageVariants({
      data: malformed,
      recipientLanguageCodes: [malformedCode]
    })).toEqual({
      ok: false,
      invalidLanguageCodes: [malformedCode],
      koreanLeakLanguageCodes: [],
      malformedFields: []
    });
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

  it("does not expose a raw recipient portal link as the manager share CTA", () => {
    const source = readFileSync(join(process.cwd(), "components", "WorkflowSharePanel.tsx"), "utf8");

    expect(source).toContain("오늘 대상과 채널을 확인하고, 언어별 전송본을 미리 봅니다.");
    expect(source).toContain("첫 번째 작업자 화면을 미리 열어 전송본을 확인할 수 있습니다.");
    expect(source).toContain("recipientPortalPreviewHref");
    expect(source).toContain("작업자 화면 미리보기");
    expect(source).not.toContain("href={`/share/${shareSessionId}`");
    expect(source).not.toContain("작업자 확인 화면은 /share/[sessionId] 경로에서 열립니다.");
  });

  it("keeps provider result details as bounded drilldown in the share cockpit", () => {
    const componentSource = readFileSync(join(process.cwd(), "components", "WorkflowSharePanel.tsx"), "utf8");
    const cssSource = readFileSync(join(process.cwd(), "app", "globals.css"), "utf8");

    expect(componentSource).toContain("data-share-result-drilldown");
    expect(componentSource).toContain("data-share-result-summary");
    expect(componentSource).toContain("workflow-result-detail");
    expect(componentSource).toContain("formatResultSummaryMeta");
    expect(componentSource).toContain("검증 전용 · ${countLabel}");
    expect(componentSource).toContain("open={Boolean(resultHasFailure || result.duplicateRisk || logSaveState.status === \"duplicate-risk\")}");
    expect(cssSource).toContain(".workflow-result-detail");
    expect(cssSource).toContain(".workflow-result > summary em");
    expect(cssSource).toContain("max-height: min(260px, 34vh)");
    expect(cssSource).toContain(".command-center-shell.workspace-page-share .workflow-result");
    expect(cssSource).toContain(".safeclaw-module-shell[data-module-route=\"/dispatch\"] .workflow-result");
    expect(cssSource).not.toContain(".command-center-shell.workspace-page-share .workflow-result {\n    grid-column: 1 / -1;");
  });

  it("builds a stable provider-dispatch idempotency key for one attempt", () => {
    const input = {
      workpackId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      shareSessionId: "33333333-3333-4333-8333-333333333333",
      dispatchAttemptId: "44444444-4444-4444-8444-444444444444",
      channels: ["sms", "email"]
    };
    const key = buildProviderDispatchIdempotencyKey(input);

    expect(key).toMatch(/^provider-dispatch-v1-44444444-4444-4444-8444-444444444444-[0-9a-f]{8}$/);
    expect(buildProviderDispatchIdempotencyKey({ ...input, channels: ["email", "sms"] })).toBe(key);
    expect(buildProviderDispatchIdempotencyKey({
      ...input,
      dispatchAttemptId: "55555555-5555-4555-8555-555555555555"
    })).not.toBe(key);
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
    })).toEqual({ succeeded: true, hasFailure: false, fullySent: true });
  });
});
