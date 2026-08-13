import fs from "node:fs";
import { describe, expect, it } from "vitest";

import { isNewDeploymentAvailable } from "@/lib/deployment-freshness";

const CURRENT = "a".repeat(40);
const LATEST = "b".repeat(40);

describe("deployment freshness guard", () => {
  it("detects only a configured valid SHA change", () => {
    expect(isNewDeploymentAvailable(CURRENT, { configured: true, commitSha: LATEST })).toBe(true);
    expect(isNewDeploymentAvailable(CURRENT, { configured: true, commitSha: CURRENT })).toBe(false);
    expect(isNewDeploymentAvailable(CURRENT, { configured: false, commitSha: LATEST })).toBe(false);
    expect(isNewDeploymentAvailable("invalid", { configured: true, commitSha: LATEST })).toBe(false);
    expect(isNewDeploymentAvailable(CURRENT, { configured: true, commitSha: "invalid" })).toBe(false);
  });

  it("keeps the normal layout unchanged until a newer deployment exists", () => {
    const layout = fs.readFileSync("app/layout.tsx", "utf8");
    const component = fs.readFileSync("components/DeploymentFreshnessGuard.tsx", "utf8");
    expect(layout).toContain("<DeploymentFreshnessGuard currentBuildSha={currentBuildSha()} />");
    expect(component).toContain("if (!updateAvailable) return null");
    expect(component).toContain('cache: "no-store"');
    expect(component).toContain('document.addEventListener("visibilitychange"');
    expect(component).toContain('aria-label="최신 버전으로 새로고침"');
  });
});
