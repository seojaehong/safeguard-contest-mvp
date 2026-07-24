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
});
