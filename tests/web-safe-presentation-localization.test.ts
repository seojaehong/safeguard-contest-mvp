import { describe, expect, it } from "vitest";

import { buildSifEmbeddingApprovalPacket } from "@/lib/sif-embedding-approval-packet";
import { getSifEmbeddingGateStatus, type SifEmbeddingGateStatus } from "@/lib/sif-embedding-gate-status";
import {
  buildPhotoFlowPresentation,
  formatArchiveStatus,
  formatDispatchChannel,
  formatDispatchFailureReason,
  formatDispatchLanguage,
  formatDispatchProvider,
  formatDispatchProviderStatus,
  formatDryrunQualityNote,
  formatPhotoFileValidationMode,
  formatPhotoInputLimit,
  formatSifApprovalDecisionForPresentation,
  formatSifCanaryModeForPresentation,
  formatSifGateIdForPresentation,
  formatSifRuntimeStatusForPresentation,
  formatSifTextForPresentation,
  formatWorkflowRunId,
  readPhotoVisionPresentationPayload,
  toDryrunPresentationSnapshot
} from "@/lib/web-safe-presentation";

const gateEnvironment = {
  OPENAI_API_KEY: "",
  SUPABASE_URL: "https://example.supabase.co",
  SUPABASE_SERVICE_ROLE_KEY: "service-role-placeholder",
  SAFETY_REFERENCE_VECTOR_SEARCH: ""
};

function markdownHeadings(markdown: string): string[] {
  return markdown
    .split("\n")
    .filter((line) => line.startsWith("## "));
}

function markdownBulletKeys(markdown: string): string[] {
  return markdown
    .split("\n")
    .flatMap((line) => {
      const match = /^- ([A-Za-z][A-Za-z /-]*):/u.exec(line);
      return match ? [match[1]] : [];
    });
}

describe("web-safe presentation localization", () => {
  it("formats known SIF values and safely hides unknown presentation tokens", () => {
    expect(formatSifGateIdForPresentation("apply-sif-only-migration")).toBe("SIF 전용 마이그레이션 적용");
    expect(formatSifRuntimeStatusForPresentation("migration-required")).toBe("마이그레이션 필요");
    expect(formatSifCanaryModeForPresentation("embed-only")).toBe("임베딩만 생성");
    expect(formatSifTextForPresentation("Canary 임베딩 완료 · 업로드 전")).toBe("소규모 검증 임베딩 완료 · 업로드 전");

    for (const value of [null, undefined, 17, {}, [], ["future-token"]]) {
      expect(formatSifGateIdForPresentation(value)).toBe("상태 확인 필요");
      expect(formatSifRuntimeStatusForPresentation(value)).toBe("상태 확인 필요");
      expect(formatSifCanaryModeForPresentation(value)).toBe("분류 검토 필요");
      expect(formatSifApprovalDecisionForPresentation(value)).toBe("결정 내용 확인 필요");
    }
  });

  it("formats archive metadata from unknown values without leaking objects", () => {
    expect(formatArchiveStatus("ready")).toBe("준비됨");
    expect(formatDispatchProviderStatus("sent")).toBe("전송 완료");
    expect(formatDispatchProvider("n8n")).toBe("전송 자동화");
    expect(formatDispatchChannel("sms")).toBe("문자");
    expect(formatDispatchLanguage("vi")).toBe("베트남어");
    expect(formatDispatchFailureReason("provider timeout")).toBe("실패 사유 확인 필요");
    expect(formatWorkflowRunId("run-42")).toBe("실행 ID run-42");

    for (const value of [null, 17, {}, [], ["sent"]]) {
      const output = [
        formatArchiveStatus(value),
        formatDispatchProviderStatus(value),
        formatDispatchProvider(value),
        formatDispatchChannel(value),
        formatDispatchLanguage(value),
        formatDispatchFailureReason(value),
        formatWorkflowRunId(value)
      ].join(" ");

      expect(output).not.toContain("[object Object]");
    }
  });

  it("normalizes dry-run presentation input instead of trusting parsed JSON", () => {
    expect(formatDryrunQualityNote("All document dry-run cases returned output, but quality may still be generic.")).toBe(
      "모든 문서 생성 점검이 응답을 반환했지만, 내용은 추가 검토가 필요합니다."
    );
    expect(formatDryrunQualityNote("One or more document dry-run cases failed or returned weak output.")).toBe(
      "문서 생성 점검 중 실패했거나 응답이 부족한 사례가 있습니다."
    );
    expect(formatDryrunQualityNote(null)).toBe("최근 점검 결과가 없습니다.");

    for (const value of [{}, 7, [], ["quality"]]) {
      expect(() => formatDryrunQualityNote(value)).not.toThrow();
      expect(formatDryrunQualityNote(value)).toBe("상태 확인 필요");
    }

    expect(toDryrunPresentationSnapshot(null)).toBeNull();
    expect(toDryrunPresentationSnapshot([])).toBeNull();

    const snapshot = toDryrunPresentationSnapshot({
      runId: { raw: "run-unsafe" },
      okCount: 4,
      totalRuns: 5,
      avgMs: 120,
      p95Ms: 200,
      qualityNote: { raw: "unsafe" },
      summaryPath: ["unsafe"],
      reportPath: "evaluation/report.md",
      highlights: [
        {
          id: "case-1",
          label: { raw: "unsafe" },
          ok: true,
          answerPreview: { raw: "unsafe" },
          elapsedMs: 12,
          answerLength: 30,
          citations: 2
        }
      ]
    });

    expect(snapshot).toMatchObject({
      runId: "실행 ID 확인 필요",
      qualityNote: "상태 확인 필요",
      summaryPath: "경로 확인 필요",
      reportPath: "evaluation/report.md"
    });
    expect(JSON.stringify(snapshot)).not.toContain("[object Object]");
  });

  it("normalizes AiConnect photo limits and flow values at the output boundary", () => {
    expect(formatPhotoInputLimit(10)).toBe("10장");
    expect(formatPhotoInputLimit(null)).toBe("첨부 한도 확인 필요");
    expect(formatPhotoInputLimit({ value: 10 })).toBe("첨부 한도 확인 필요");
    expect(formatPhotoFileValidationMode("signature_only")).toBe("파일 시그니처 확인");

    const knownFlow = buildPhotoFlowPresentation(
      [{ step: "attach" }, { step: "ground" }, { step: "review" }, { step: "export" }],
      10
    );
    expect(knownFlow).toEqual([
      {
        key: "attach-0",
        step: "1단계",
        label: "현장 사진 첨부",
        detail: "입력 화면의 첨부 기능에서 최대 10장까지 받습니다."
      },
      {
        key: "ground-1",
        step: "3단계",
        label: "검증 근거 확정",
        detail: "SafeClaw 검증 체계가 후보별 근거 출처와 현장 통제를 확정하거나 근거 부족으로 잠급니다."
      },
      {
        key: "review-2",
        step: "4단계",
        label: "사용자 채택·기각",
        detail: "검증된 후보를 사용자가 채택하거나 기각하고, 채택한 항목만 개선 메모리에 들어갑니다."
      },
      {
        key: "export-3",
        step: "5단계",
        label: "운영 메모리 보존",
        detail: "채택된 후보와 개선 전/개선 후 사항은 재사용 검토 파일과 다음 검증 입력에 보존됩니다."
      }
    ]);
    expect(JSON.stringify(knownFlow)).not.toMatch(/하네스|JSONL|source ID|DB\/MCP/u);

    for (const input of [
      { flow: null, maxInputPhotos: null },
      { flow: {}, maxInputPhotos: {} },
      { flow: 5, maxInputPhotos: 5 },
      { flow: [{ step: null }, { step: {} }, []], maxInputPhotos: [] }
    ]) {
      expect(() => buildPhotoFlowPresentation(input.flow, input.maxInputPhotos)).not.toThrow();
      const output = buildPhotoFlowPresentation(input.flow, input.maxInputPhotos);
      expect(output.length).toBeGreaterThan(0);
      expect(JSON.stringify(output)).not.toContain("[object Object]");
      expect(output.some((item) => item.label === "흐름 정보 확인 필요")).toBe(true);
    }

    expect(readPhotoVisionPresentationPayload(null)).toBeNull();
    expect(readPhotoVisionPresentationPayload([])).toBeNull();
    expect(readPhotoVisionPresentationPayload({
      ok: true,
      status: "ready",
      model: "gpt-4.1-mini",
      maxInputPhotos: { unsafe: true },
      fileValidation: { mode: null },
      acceptedOnly: true,
      ocrSupported: true,
      flow: { unsafe: true },
      hazardAnalysisMethod: "POST multipart/form-data",
      hazardAnalysisEndpoint: "/api/input-photos/hazard-analysis",
      improvementEndpointPattern: "/api/workpacks/[id]/improvements",
      exportTargets: [{ unsafe: true }]
    })).toMatchObject({
      ok: true,
      status: "ready",
      maxInputPhotos: { unsafe: true },
      flow: { unsafe: true },
      exportTargets: []
    });
    expect(readPhotoVisionPresentationPayload({
      exportTargets: ["위험성평가표", "작업 이력 MD", "하네스 JSONL"]
    })?.exportTargets).toEqual(["위험성평가표", "작업 이력 문서", "재사용 검토 데이터"]);
  });

  it("keeps JSON fields raw while localizing only Markdown values", () => {
    const status = getSifEmbeddingGateStatus(gateEnvironment);
    const packet = buildSifEmbeddingApprovalPacket(status);

    expect(packet.gateId).toBe(status.nextApprovalGate.id);
    expect(packet.currentState).toBe(status.readinessVerdict.label);
    expect(packet.nextAction).toBe(status.nextApprovalGate.action);
    expect(packet.canary).toEqual(status.canary);
    expect(packet.operatorGate).toEqual(status.operatorGate);
    expect(packet.postMigrationVerification).toEqual(status.postMigrationVerification);
    expect(packet.requiredArtifacts).toEqual(status.approvalPacket.requiredArtifacts);
    expect(packet.artifactIntegrity).toEqual(status.approvalPacket.artifactIntegrity);

    expect(packet.markdown).toContain("Gate: SIF 전용 마이그레이션 적용");
    expect(packet.markdown).toContain("Status: 마이그레이션 필요");
    expect(packet.markdown).toContain("소규모 검증 임베딩 완료 · 업로드 전");
    expect(packet.markdown).not.toContain("Status: migration-required");
    expect(packet.markdown).not.toContain("Canary 임베딩 완료 · 업로드 전");
  });

  it("localizes generated SIF phrases without changing diagnostic paths", () => {
    const status = getSifEmbeddingGateStatus(gateEnvironment);

    expect(formatSifTextForPresentation(status.nextApprovalGate.detail)).toBe(
      "운영 DB에 safety_reference_embeddings 테이블 또는 match_safety_reference_embeddings RPC가 없어 업로드 전 마이그레이션 승인이 먼저 필요합니다."
    );
    expect(formatSifTextForPresentation(status.nextApprovalGate.action)).toBe(
      "SIF 전용 마이그레이션 SQL을 승인 후 적용합니다."
    );
    expect(status.operatorGate.evidenceSummary.map((item) => formatSifTextForPresentation(item))).toEqual(expect.arrayContaining([
      "소규모 검증은 3건 임베딩만 생성 방식으로 확인했고 DB 업로드는 0건입니다.",
      "운영 DB 점검은 마이그레이션 필요이며 테이블 없음, RPC 없음입니다.",
      "마이그레이션 후 검증은 마이그레이션 필요이며 업로드 0 / 6,032건을 보고합니다."
    ]));

    const verifierEvidence = status.operatorGate.checklist.find((item) => item.id === "post-migration-verifier")?.evidence;
    expect(formatSifTextForPresentation(verifierEvidence)).toBe(
      "evaluation/sif-embedding-gate/post-migration-verify.json · 현재 마이그레이션 필요"
    );
  });

  it("preserves the base Markdown parser headings and raw keys", () => {
    const packet = buildSifEmbeddingApprovalPacket(getSifEmbeddingGateStatus(gateEnvironment));

    expect(markdownHeadings(packet.markdown)).toEqual([
      "## Current State",
      "## Operator Gate Runbook",
      "## Post-Migration Verification",
      "## Canary Embedding Evidence",
      "## Corpus",
      "## Required Decision",
      "## Required Artifacts",
      "## Artifact Integrity",
      "## Safety Locks",
      "## Preflight Checks",
      "## Runtime DB Probe",
      "## Vision/OCR Harness Path",
      "## Held Command"
    ]);
    expect(markdownBulletKeys(packet.markdown)).toEqual(expect.arrayContaining([
      "Verdict",
      "Answer",
      "Next action",
      "Status",
      "Approval question",
      "Report",
      "Mode",
      "Before/After improvements"
    ]));
  });

  it("falls back in Markdown without destroying an unknown raw decision", () => {
    const status = getSifEmbeddingGateStatus(gateEnvironment);
    const rawDiagnostic = "future-approval-decision diagnostic=keep-raw";
    const unknownStatus: SifEmbeddingGateStatus = {
      ...status,
      runtimeDbProbe: { ...status.runtimeDbProbe, status: "future-runtime-token" },
      postMigrationVerification: {
        ...status.postMigrationVerification,
        status: "future-verifier-token"
      },
      canary: { ...status.canary, mode: "future-canary-mode" },
      approvalPacket: {
        ...status.approvalPacket,
        decisions: [rawDiagnostic]
      },
      nextApprovalDecisions: [rawDiagnostic]
    };
    const packet = buildSifEmbeddingApprovalPacket(unknownStatus);

    expect(unknownStatus.approvalPacket.decisions).toEqual([rawDiagnostic]);
    expect(unknownStatus.nextApprovalDecisions).toEqual([rawDiagnostic]);
    expect(packet.postMigrationVerification.status).toBe("future-verifier-token");
    expect(packet.canary.mode).toBe("future-canary-mode");
    expect(packet.markdown).not.toMatch(/future-approval-decision|future-runtime-token|future-verifier-token|future-canary-mode/u);
    expect(packet.markdown).toContain("결정 내용 확인 필요");
    expect(packet.markdown).toContain("상태 확인 필요");
    expect(packet.markdown).toContain("분류 검토 필요");
  });
});
