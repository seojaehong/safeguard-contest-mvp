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

  it("describes language-specific preparation and the active worker viewer link contract", () => {
    expect(sharePanel).toContain("작업자별 저장 언어로 전송본을 준비합니다.");
    expect(sharePanel).toContain("오늘 대상과 채널을 확인하고, 언어별 전송본을 미리 봅니다.");
    expect(sharePanel).not.toContain("작업자는 개인 화면에서 확인을 남깁니다.");
    expect(sharePanel).toContain("첫 번째 작업자 화면을 미리 열어 전송본을 확인할 수 있습니다.");
    expect(sharePanel).toContain("recipientPortalPreviewHref");
    expect(sharePanel).toContain("작업자 화면 미리보기");
    expect(sharePanel).not.toContain("공유 링크로 활성화");
    expect(sharePanel).not.toContain("href={`/share/${shareSessionId}`");
    expect(sharePanel).not.toContain("작업자용 공동 열람 링크는 별도 승인된 포털에서 열립니다.");
    expect(sharePanel).not.toContain("작업자 확인 화면은 /share/[sessionId] 경로에서 열립니다.");
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
    expect(sharePanel).toContain('data-share-stage-rail');
    expect(sharePanel).toContain('data-share-stage="targets"');
    expect(sharePanel).toContain('data-share-stage="channels"');
    expect(sharePanel).toContain('data-share-stage="language"');
    expect(sharePanel).toContain('data-share-stage="dispatch"');
    expect(sharePanel).not.toContain("share-delivery-summary");
    expect(sharePanel).not.toContain("다음 행동 · {channel.nextAction}");
    expect(sharePanel).not.toContain('className="dispatch-evidence-ledger"');
    expect(sharePanel).not.toContain("관리자 표시와 분리");
    expect(sharePanel).not.toContain("전달 메모 추가");
    expect(sharePanel).not.toContain("저장 및 전송 기록");
    expect(sharePanel).not.toContain("메시지 복사");
    expect(sharePanel).not.toContain("전체 메시지 원문");
    expect(sharePanel).toContain('href="/login"');
    expect(readFileSync(join(root, "app", "globals.css"), "utf8").replace(/\r\n/gu, "\n")).toContain(
      ".share-panel.workflow-panel .channel-grid {\n  grid-template-columns: repeat(3, minmax(0, 1fr));"
    );
  });

  it("uses a real desktop two-pane share composition instead of a narrow mobile card", () => {
    const css = readFileSync(join(root, "app", "globals.css"), "utf8").replace(/\r\n/gu, "\n");
    const desktopShareBlock = css.slice(
      css.indexOf("@media (min-width: 960px)"),
      css.indexOf(".share-workflow-header,", css.indexOf("@media (min-width: 960px)"))
    );

    expect(desktopShareBlock).toContain("grid-template-columns: minmax(0, 1fr) minmax(520px, 0.72fr);");
    expect(desktopShareBlock).toContain(".share-stage-rail {\n    grid-column: 1 / -1;\n    grid-row: 2;");
    expect(desktopShareBlock).toContain(".share-form-shell {\n    grid-row: 3;\n    grid-template-columns: repeat(3, minmax(0, 1fr));");
    expect(desktopShareBlock).toContain(".share-form-card {\n    grid-row: 2;\n    align-content: start;\n    min-height: 150px;");
    expect(desktopShareBlock).toContain("grid-row: 2;");
    expect(desktopShareBlock).toContain(".channel-grid {\n    grid-template-columns: repeat(3, minmax(0, 1fr));");
    expect(desktopShareBlock).toContain("position: sticky;");
    expect(desktopShareBlock).toContain("top: 88px;");
    expect(desktopShareBlock).toContain("min-height: min(400px, calc(100vh - 210px));");
    expect(desktopShareBlock).toContain("max-height: calc(100vh - 160px);");
    expect(desktopShareBlock).toContain("grid-column: 2;");
    expect(desktopShareBlock).toContain("grid-row: 3 / span 4;");
    expect(desktopShareBlock).toContain(".share-primary-action-row {\n    grid-column: 1 / -1;");
    expect(desktopShareBlock).toContain("grid-row: 1;");
    expect(desktopShareBlock).toContain("order: -1;");
    expect(desktopShareBlock).toContain(".share-primary-action-row .button {\n    flex: 1 1 0;");
  });

  it("keeps the localized message heading compact on mobile", () => {
    expect(sharePanel).toContain('return "한국어 메시지 미리보기"');
    expect(sharePanel).toContain('`${formatMessageTargetLabel(data, selectedTarget)} 핵심 안전 안내`');
    expect(sharePanel).not.toContain("외국인 근로자 전송본 ·");
    expect(sharePanel).toContain("작업자에게는 저장된 언어의 핵심 안전 안내를 보냅니다.");
    expect(sharePanel).toContain("관리자 화면의 라벨은 한국어로 표시됩니다.");
    expect(sharePanel).toContain(">표시 언어</label>");
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
