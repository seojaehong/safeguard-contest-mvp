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

  it("shows one compact confirmation summary without the four-card evidence ledger", () => {
    expect(sharePanel).toContain("오늘 대상");
    expect(sharePanel).toContain("채널");
    expect(sharePanel).toContain("언어 미리보기");
    expect(sharePanel).toContain("메시지 미리보기");
    expect(sharePanel).not.toContain("share-delivery-summary");
    expect(sharePanel).not.toContain("다음 행동 · {channel.nextAction}");
    expect(sharePanel).not.toContain('className="dispatch-evidence-ledger"');
    expect(sharePanel).not.toContain("관리자 표시와 분리");
    expect(sharePanel).toContain('href="/login"');
  });

  it("keeps the localized message heading compact on mobile", () => {
    expect(sharePanel).toContain('return "한국어 전송본 미리보기"');
    expect(sharePanel).toContain('`${formatMessageTargetLabel(data, selectedTarget)} 전송본 미리보기`');
    expect(sharePanel).not.toContain("외국인 근로자 전송본 ·");
  });

  it("keeps only the confirmation action visible during the send confirmation step", () => {
    expect(sharePanel).toMatch(/\{!isConfirming \? \(\s*<div className="command-actions">/);
    expect(sharePanel).toMatch(/\{isConfirming \? \(\s*<div className="dispatch-confirm-panel/);
  });
});
