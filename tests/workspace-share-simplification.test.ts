import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const root = process.cwd();
const commandCenter = readFileSync(join(root, "components", "SafeGuardCommandCenter.tsx"), "utf8");
const sharePanel = readFileSync(join(root, "components", "WorkflowSharePanel.tsx"), "utf8");

describe("workspace share simplification", () => {
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
  });

  it("exposes exactly one direct primary send action", () => {
    expect(sharePanel.match(/data-share-primary/g)).toHaveLength(2);
    expect(sharePanel).toContain("onClick={dispatchWorkflow}");
    expect(sharePanel).not.toContain("setIsConfirming");
    expect(sharePanel).not.toContain("dispatch-confirm-panel");
  });
});
