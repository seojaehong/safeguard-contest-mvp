import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { resolveBriefingEmailDispatchStatus } from "@/lib/server/briefing-dispatch-status";

const rootDir = process.cwd();

describe("briefing dispatch truth contract", () => {
  it("keeps scheduled email preview-only even when relay and live flags are configured", () => {
    expect(resolveBriefingEmailDispatchStatus({
      liveDispatchEnabled: true,
      relayConfigured: true
    })).toEqual({
      emailReady: false,
      mode: "preview_only",
      reason: "persistent_idempotency_unavailable"
    });
  });

  it("keeps the settings UI explicit about generation versus actual email dispatch", () => {
    const source = fs.readFileSync(
      path.join(rootDir, "components", "BriefingSettingsCard.tsx"),
      "utf8"
    );

    expect(source).toContain('emailDispatchReady ? " + 이메일 발송" : " · 이메일 실제 발송은 승인 전 잠금"');
    expect(source).toContain("아침 문서팩 자동 생성 활성화");
    expect(source).toContain("이메일 실제 발송은 중복 방지 저장 계약이");
  });

  it("blocks the cron email provider call behind the shared capability", () => {
    const source = fs.readFileSync(
      path.join(rootDir, "app", "api", "briefing", "run", "route.ts"),
      "utf8"
    );

    expect(source).toContain("const dispatchStatus = resolveBriefingEmailDispatchStatus()");
    expect(source).toContain("if (!dispatchStatus.emailReady)");
    expect(source.indexOf("if (!dispatchStatus.emailReady)")).toBeLessThan(
      source.indexOf("await postWebhookWithTimeout")
    );
  });

  it("keeps dispatch entry surfaces truthful while provider persistence is unavailable", () => {
    const dispatchPage = fs.readFileSync(path.join(rootDir, "app", "dispatch", "page.tsx"), "utf8");
    // UX PR-1(2026-10-27): 첫 화면은 입력 폼 하나라 전파 모듈 설명(§05 productModules)이 없다. 부정 단언만 남긴다.
    const landing = fs.readFileSync(path.join(rootDir, "components", "SafeClawLanding.tsx"), "utf8");
    const prototype = fs.readFileSync(path.join(rootDir, "components", "SafeClawPrototype.tsx"), "utf8");
    const combined = [dispatchPage, landing, prototype].join("\n");

    expect(dispatchPage).toContain("실제 발송 가능 여부와 승인된 접수 결과를 구분해 기록합니다.");
    expect(landing).not.toContain("전송");
    expect(prototype).toContain('status: "partial"');
    expect(prototype).toContain("준비되지 않은 채널은 미리보기로 유지합니다.");
    expect(combined).not.toContain("메일과 문자로 현장 공지와 외국인 안내문을 보내고");
    expect(combined).not.toContain("메일과 문자로 안전공지와 외국인 안내문을 보내고");
  });
});
