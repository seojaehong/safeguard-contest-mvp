import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { buildSifEmbeddingApprovalPacket } from "@/lib/sif-embedding-approval-packet";
import {
  formatSifCanaryModeForPresentation,
  formatSifGateIdForPresentation,
  formatSifRuntimeStatusForPresentation,
  getSifEmbeddingGateStatus,
  type SifEmbeddingGateStatus
} from "@/lib/sif-embedding-gate-status";

function read(relativePath: string): string {
  return readFileSync(join(process.cwd(), relativePath), "utf8");
}

describe("web-safe presentation localization", () => {
  it("maps SIF gate and runtime values without exposing unknown raw tokens", () => {
    expect(formatSifGateIdForPresentation("apply-sif-only-migration")).toBe("SIF 전용 마이그레이션 적용");
    expect(formatSifGateIdForPresentation("future-gate-token")).toBe("상태 확인 필요");
    expect(formatSifRuntimeStatusForPresentation("migration-required")).toBe("마이그레이션 필요");
    expect(formatSifRuntimeStatusForPresentation("future-runtime-token")).toBe("상태 확인 필요");
  });

  it("maps AI connect gate, status, file mode, and flow step at the render boundary", () => {
    const source = read("components/AiConnectPanel.tsx");

    for (const contract of [
      '"approve-upload": "업로드 승인"',
      '"migration-required": "마이그레이션 필요"',
      '"signature_only": "파일 시그니처 확인"',
      'attach: "1단계"',
      'return SIF_GATE_LABELS[gateId as SifGateId] ?? "상태 확인 필요"',
      'return SIF_RUNTIME_STATUS_LABELS[status] ?? "상태 확인 필요"',
      'return PHOTO_FILE_VALIDATION_MODE_LABELS[mode] ?? "분류 검토 필요"',
      'return PHOTO_FLOW_STEP_LABELS[step] ?? "분류 검토 필요"'
    ]) {
      expect(source).toContain(contract);
    }
  });

  it("keeps AI connect machine contracts while removing raw operator-facing copy", () => {
    const source = read("components/AiConnectPanel.tsx");

    for (const rawCopy of [
      "<span>SIF Embedding Gate</span>",
      "<strong>Canary 임베딩</strong>",
      "<strong>Vector 검색</strong>",
      "feature flag 켜짐",
      "feature flag 꺼짐",
      "<span>Next approval</span>",
      "<span>Operator gate</span>",
      "<dt>Migration</dt>",
      "<dt>Canary</dt>",
      "<dt>Gate</dt>",
      "<dt>Verifier</dt>",
      "<summary>Preflight 자동 점검",
      "Runtime DB probe:",
      "<span>Vision/OCR Harness</span>",
      "사진 분석 endpoint",
      "Before/After 개선 사진",
      "vision/OCR payload",
      "<dd>{sifGate.operatorGate.gateId}</dd>",
      "{sifGate.postMigrationVerification.status} ·",
      "운영 DB 점검: {sifGate.runtimeDbProbe.status}",
      "photoVision.fileValidation.mode ===",
      "<span>{item.step}</span>"
    ]) {
      expect(source, `raw presentation copy remains: ${rawCopy}`).not.toContain(rawCopy);
    }

    for (const localizedCopy of [
      "SIF 임베딩 승인 단계",
      "소규모 검증 임베딩",
      "벡터 검색",
      "기능 플래그 켜짐",
      "다음 승인",
      "운영자 승인 단계",
      "마이그레이션",
      "검증 결과",
      "사전 자동 점검",
      "운영 DB 점검",
      "사진 분석/OCR 하네스",
      "사진 분석 API 경로",
      "개선 전/개선 후 사진",
      "formatSifGateId(sifGate.operatorGate.gateId)",
      "formatSifRuntimeStatus(sifGate.postMigrationVerification.status)",
      "formatSifRuntimeStatus(sifGate.runtimeDbProbe.status)",
      "formatPhotoFileValidationMode(photoVision.fileValidation.mode)",
      "formatPhotoFlowStep(item.step)",
      "formatPhotoFlowLabel(item.step)",
      "formatPhotoFlowDetail(item.step, photoVision.maxInputPhotos)"
    ]) {
      expect(source).toContain(localizedCopy);
    }

    for (const technicalToken of [
      "gateId",
      "runtimeDbProbe",
      "fileValidation",
      "/api/input-photos/hazard-analysis",
      "/api/workpacks/[id]/improvements",
      "SIF",
      "OpenAI",
      "Supabase",
      "OCR",
      "RPC",
      "MD",
      "JSONL"
    ]) {
      expect(source).toContain(technicalToken);
    }
  });

  it("localizes archive and operations metadata without changing stored field names", () => {
    const archive = read("app/archive/page.tsx");
    const dryrun = read("app/dryrun/page.tsx");
    const ops = read("app/ops/api/page.tsx");

    for (const rawCopy of [
      "provider 상태",
      "provider 결과",
      "snapshot",
      "<code>{archive.status}</code>",
      "{log.channel} · {log.providerStatus || \"결과 확인\"}",
      "{log.languageCode ? ` · ${log.languageCode}` : \"\"}",
      "{log.failureReason ? ` · ${log.failureReason}` : \"\"}",
      "{log.workflowRunId || log.provider || \"전파 기록\"}"
    ]) {
      expect(archive, `archive still renders raw metadata: ${rawCopy}`).not.toContain(rawCopy);
    }

    for (const contract of [
      '"sent": "전송 완료"',
      '"n8n": "전송 자동화"',
      'return DISPATCH_PROVIDER_STATUS_LABELS[status] ?? "상태 확인 필요"',
      'return DISPATCH_PROVIDER_LABELS[provider] ?? "분류 검토 필요"',
      'return DISPATCH_CHANNEL_LABELS[channel] ?? "분류 검토 필요"',
      'return DISPATCH_LANGUAGE_LABELS[languageCode] ?? "분류 검토 필요"',
      "formatArchiveStatus(archive.status)",
      "formatDispatchProviderStatus(log.providerStatus)",
      "formatDispatchProvider(log.provider)",
      "formatDispatchChannel(log.channel)",
      "formatDispatchLanguage(log.languageCode)",
      "formatDispatchFailureReason(log.failureReason)",
      "formatWorkflowRunId(log.workflowRunId)",
      "로컬 작업자 저장본",
      "로컬 작업팩"
    ]) {
      expect(archive).toContain(contract);
    }

    for (const rawCopy of [
      "<span>runId</span>",
      "summary:",
      "report:",
      ">{item.ok ? 'ok' : 'check'}<",
      "preview unavailable",
      "elapsed {item.elapsedMs} ms",
      "answer {item.answerLength} chars",
      "citations {item.citations}"
    ]) {
      expect(dryrun, `dry-run still renders raw copy: ${rawCopy}`).not.toContain(rawCopy);
    }

    for (const localizedCopy of [
      "<span>실행 ID</span>",
      "요약:",
      "보고서:",
      "item.ok ? '정상' : '확인 필요'",
      "미리보기 없음",
      "소요 {item.elapsedMs}밀리초",
      "답변 {item.answerLength}자",
      "인용 {item.citations}건",
      "formatDryrunQualityNote(snapshot.qualityNote)",
      'return DRYRUN_QUALITY_NOTE_LABELS[note.trim()] ?? "상태 확인 필요"'
    ]) {
      expect(dryrun).toContain(localizedCopy);
    }

    expect(ops).not.toContain("<span>Run</span>");
    expect(ops).not.toContain("snapshot?.qualityNote?.replaceAll");
    expect(ops).toContain("<span>실행 ID</span>");
    expect(ops).toContain("formatDryrunQualityNote(snapshot?.qualityNote)");

    for (const field of ["providerStatus", "workflowRunId", "runId", "summaryPath", "reportPath"]) {
      expect(`${archive}\n${dryrun}\n${ops}`).toContain(field);
    }
  });

  it("localizes SIF status and Markdown presentation while preserving machine enums", () => {
    const status = getSifEmbeddingGateStatus({
      OPENAI_API_KEY: "",
      SUPABASE_URL: "https://example.supabase.co",
      SUPABASE_SERVICE_ROLE_KEY: "service-role-placeholder",
      SAFETY_REFERENCE_VECTOR_SEARCH: ""
    });

    expect(status.nextApprovalGate.id).toBe("apply-sif-only-migration");
    expect(status.postMigrationVerification.status).toBe("migration-required");
    expect(status.canary.mode).toBe("embed-only");
    expect(status.canary.label).toBe("소규모 검증 임베딩 완료 · 업로드 전");
    expect(status.canary.answer).toContain("소규모 검증 임베딩 벡터");
    expect(status.vectorGuard.label).toBe("벡터 검색 잠금");
    expect(status.nextApprovalGate.label).toBe("SIF 전용 DB 마이그레이션 승인");
    expect(status.operatorGate.evidenceSummary.join("\n")).toContain("마이그레이션 필요");
    expect(status.operatorGate.evidenceSummary.join("\n")).not.toContain("migration-required");
    expect(formatSifCanaryModeForPresentation("embed-only")).toBe("임베딩만 생성");
    expect(formatSifCanaryModeForPresentation("future-canary-mode")).toBe("분류 검토 필요");

    const packet = buildSifEmbeddingApprovalPacket(status);
    expect(packet.gateId).toBe("apply-sif-only-migration");
    expect(packet.postMigrationVerification.status).toBe("migration-required");
    expect(packet.canary.mode).toBe("embed-only");
    expect(packet.markdown).toContain("## 사전 점검");
    expect(packet.markdown).toContain("## 사진 분석/OCR 하네스 경로");
    expect(packet.markdown).toContain("개선 전/개선 후 개선사항");
    expect(packet.markdown).not.toContain("## Preflight Checks");
    expect(packet.markdown).not.toContain("## Vision/OCR Harness Path");
    expect(packet.markdown).not.toContain("Before/After improvements");

    const unknownStatus: SifEmbeddingGateStatus = {
      ...status,
      runtimeDbProbe: { ...status.runtimeDbProbe, status: "future-runtime-token" },
      postMigrationVerification: {
        ...status.postMigrationVerification,
        status: "future-verifier-token"
      },
      canary: { ...status.canary, mode: "future-canary-mode" }
    };
    const unknownPacket = buildSifEmbeddingApprovalPacket(unknownStatus);

    expect(unknownPacket.postMigrationVerification.status).toBe("future-verifier-token");
    expect(unknownPacket.canary.mode).toBe("future-canary-mode");
    expect(unknownPacket.markdown).not.toMatch(/future-runtime-token|future-verifier-token|future-canary-mode/u);
    expect(unknownPacket.markdown).toContain("상태 확인 필요");
    expect(unknownPacket.markdown).toContain("분류 검토 필요");
  });
});
