import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";
import { buildProviderDispatchUiContract } from "@/lib/workflow-share-client";
import type { ProviderDispatchCapability } from "@/lib/workflow-dispatch-capability";

const root = process.cwd();
const commandCenter = readFileSync(join(root, "components", "SafeGuardCommandCenter.tsx"), "utf8");
const sharePanel = readFileSync(join(root, "components", "WorkflowSharePanel.tsx"), "utf8");
const dispatchRoute = readFileSync(join(root, "app", "api", "workflow", "dispatch", "route.ts"), "utf8");

describe("workspace share simplification", () => {
  it("keeps channels and the primary action preview-only when provider dispatch is unavailable", () => {
    const capability: ProviderDispatchCapability = {
      capability: false,
      mode: "preview_only",
      reason: "persistent_idempotency_unavailable",
      channels: {
        email: { capability: false, reason: "persistent_idempotency_unavailable" },
        sms: { capability: false, reason: "persistent_idempotency_unavailable" },
        kakao: { capability: false, reason: "persistent_idempotency_unavailable" }
      }
    };
    expect(buildProviderDispatchUiContract({ status: "preview_only", capability })).toEqual({
      status: "preview_only",
      canDispatch: false,
      statusLabel: "미리보기 전용",
      reasonLabel: "안전한 중복 방지 저장 기능을 준비하고 있습니다.",
      primaryLabel: "미리보기 전용",
      primaryDisabled: true,
      showUnavailableActions: true
    });
    expect(sharePanel).toContain("loadProviderDispatchCapability");
    expect(sharePanel).toContain("providerDispatchUi.canDispatch");
    expect(sharePanel).toContain("providerDispatchUi.primaryDisabled");
    expect(sharePanel).toContain("providerDispatchUi.primaryLabel");
    expect(sharePanel).toContain("buildProviderDispatchChannelUiContract");
    expect(sharePanel).toContain("createAuthenticatedShareSession");
    expect(sharePanel).toContain("recipientMessageVariants.messageVariants");
    expect(sharePanel).toContain('id="workflow-language-select"');
  });

  it("offers channel preparation guidance and retry without misleading unavailable channel actions", () => {
    expect(sharePanel).toContain('href="/settings"');
    expect(sharePanel).toContain("발송 채널 준비 안내");
    expect(sharePanel).toContain("다시 확인");
    expect(sharePanel).toContain("channelUi.reasonLabel");
    expect(sharePanel).toContain("channelUi.enabled");
  });

  it("advertises only the relay transport implemented by provider dispatch", () => {
    const capabilityResolver = dispatchRoute.slice(
      dispatchRoute.indexOf("function resolveCurrentProviderDispatchCapability"),
      dispatchRoute.indexOf("export async function GET")
    );

    expect(capabilityResolver).toContain("providerConfigured: relayConfigured");
    expect(capabilityResolver).not.toContain("relayConfigured || isKakaoProviderConfigured()");
  });

  it("describes language-specific preparation without claiming a pre-created share link", () => {
    expect(sharePanel).toContain("선택한 대상에게 언어별 전송본을 준비합니다.");
    expect(sharePanel).toContain("전송 후 관리자 화면에서 작업자별 전송 상태와 확인 이력을 이어서 관리합니다.");
    expect(sharePanel).toContain("작업자용 공동 열람 링크는 별도 승인된 포털에서 열립니다.");
    expect(sharePanel).not.toContain("공유 링크로 활성화");
    expect(sharePanel).not.toContain("href={`/share/${shareSessionId}`");
    expect(sharePanel).not.toContain("작업자 확인 화면은 /share/[sessionId] 경로에서 열립니다.");
    expect(sharePanel).not.toContain("열람 확인");
    expect(sharePanel).not.toContain("수신자가 확인");
  });

  it("offers one deterministic revalidation action after document edits", () => {
    expect(commandCenter).toContain("revalidateEditedWorkpack");
    expect(commandCenter).toContain('fetch("/api/ontology/graph"');
    expect(commandCenter).toContain("편집본 재검증");
    expect(commandCenter).toContain("handleEditedWorkpackRevalidation");
  });

  it("keeps the workspace share page focused on the delivery workflow", () => {
    const sharePage = commandCenter.slice(
      commandCenter.indexOf('{workspacePage === "share" ? ('),
      commandCenter.indexOf("</main>")
    );

    expect(sharePage).toContain('surface="share"');
    expect(sharePage).not.toContain("문서팩을 현장에 전송하세요");
    expect(sharePage).not.toContain("공유 설정 보기");
    expect(sharePage).not.toContain("Before/After 개선 기록 보기");
    expect(sharePage).not.toContain("operation-ontology-panel");
  });

  it("keeps only the four-step delivery sequence on the default surface", () => {
    const targets = sharePanel.indexOf("오늘 대상");
    const channels = sharePanel.indexOf('id="workflow-channel-heading"');
    const language = sharePanel.indexOf('id="workflow-language-heading"');
    const preview = sharePanel.indexOf('data-share-preview');

    expect(targets).toBeGreaterThan(-1);
    expect(channels).toBeGreaterThan(targets);
    expect(language).toBeGreaterThan(channels);
    expect(preview).toBeGreaterThan(language);
    expect(sharePanel).not.toContain("share-delivery-summary");
    expect(sharePanel).not.toContain("다음 행동 · {channel.nextAction}");
    expect(sharePanel).not.toContain('className="dispatch-evidence-ledger"');
    expect(sharePanel).not.toContain("관리자 표시와 분리");
    expect(sharePanel).not.toContain("전달 메모 추가");
    expect(sharePanel).not.toContain("저장 및 전송 기록");
    expect(sharePanel).not.toContain("메시지 복사");
    expect(sharePanel).not.toContain("전체 메시지 원문");
    expect(sharePanel).toContain('href="/login"');
  });

  it("keeps the localized message heading compact on mobile", () => {
    expect(sharePanel).toContain('return "한국어 전송본 미리보기"');
    expect(sharePanel).toContain('`${formatMessageTargetLabel(data, selectedTarget)} 전송본 미리보기`');
    expect(sharePanel).not.toContain("외국인 근로자 전송본 ·");
    expect(sharePanel).toContain("미리보기 선택은 전송 본문을 바꾸지 않습니다.");
    expect(sharePanel).toContain("messageVariants: recipientMessageVariants.messageVariants");
  });

  it("renders one fail-closed primary control", () => {
    expect(sharePanel.match(/data-share-primary/g)).toHaveLength(2);
    expect(sharePanel).toContain("onClick={dispatchWorkflow}");
    expect(sharePanel).toContain("disabled={primaryDisabled}");
    expect(sharePanel).not.toContain("setIsConfirming");
    expect(sharePanel).not.toContain("dispatch-confirm-panel");
    expect(sharePanel).toContain("dispatchInFlightRef.current");
    expect(sharePanel).toContain('shareRecords.status === "loading"');
    expect(sharePanel).toContain('shareRecords.status === "error"');
  });

  it("separates authored documents from the total deliverable output count", () => {
    expect(commandCenter).toContain("작성 문서 9종(핵심 3종 + 지원 6종) · 총 산출물 12개");
    expect(commandCenter).toContain("개 추가 산출물 보기");
    expect(commandCenter).not.toContain("문서 12종 + 외국인 안내문");
  });
});
