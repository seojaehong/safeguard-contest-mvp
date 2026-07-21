import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { describe, expect, it } from "vitest";

type MobileP0Report = {
  verdict: string;
  hardBlockersClosed: boolean;
  acceptance: {
    horizontalOverflow: boolean;
    noHorizontalOverflow: boolean;
  };
  production: {
    commitSha: string;
  };
  mobileFlow: {
    documentsSafetyBrief: {
      heightRatio: number;
      documentDeepReviewOpen: boolean;
      visibleDocumentPreviews: number;
    };
    share: {
      heightRatio: number;
      messagePreviewY: number;
      primaryShareCtas: number;
      stickyLikeCount: number;
      allowedStickyLikeCount: number;
      unsafeStickyLikeCount: number;
    };
  };
};

function writeJson(root: string, relativePath: string, value: unknown): void {
  const absolutePath = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
  fs.writeFileSync(absolutePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function geometry(visibleDocumentPreviews = 0, shareStickyLike: unknown[] = []): Record<string, unknown> {
  return {
    build: {
      commitSha: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      branch: "master",
      environment: "production",
      deploymentUrl: "safeclaw.example",
    },
    results: [
      {
        name: "mobile-day",
        ok: true,
        documents: {
          body: { height: 1269, overflowX: false },
          outside: 0,
          stickyLike: [],
          documentPage: { y: 262, h: 902 },
          documentPreview: { y: 1247 },
          documentDeepReviewOpen: false,
          visibleDocumentPreviews,
        },
        editor: {
          body: { height: 1981, overflowX: false },
          outside: 0,
          stickyLike: [],
          documentEditor: { y: 63 },
          documentTextarea: { y: 361 },
        },
        share: {
          body: { height: 1451, overflowX: false },
          outside: 0,
          stickyLike: shareStickyLike,
          sharePage: { y: 244 },
          shareRoot: { w: 336 },
          sharePreview: { y: 380, bottom: 599 },
          primaryShareCtas: 1,
        },
      },
    ],
  };
}

function liveCritical(findings: unknown[] = []): Record<string, unknown> {
  return {
    findings,
    rows: [
      { route: "/workspace", viewport: "mobile", heightRatio: 1.17, under44Count: 3, horizontalOverflow: false, outsideCount: 0 },
      { route: "/documents", viewport: "mobile", under44Count: 0 },
      { route: "/share/not-a-session?lang=vi", viewport: "mobile", under44Count: 0 },
    ],
  };
}

function runReport(root: string): MobileP0Report {
  execFileSync("node", [
    path.resolve("scripts", "mobile_p0_report_from_geometry.mjs"),
    "--root",
    root,
    "--output",
    "evaluation/mobile-p0-test",
  ], { cwd: path.resolve("."), stdio: "pipe" });
  return JSON.parse(fs.readFileSync(path.join(root, "evaluation", "mobile-p0-test", "report.json"), "utf8")) as MobileP0Report;
}

function createRoot(visibleDocumentPreviews = 0, findings: unknown[] = [], shareStickyLike: unknown[] = []): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "safeclaw-mobile-p0-"));
  writeJson(root, "evaluation/workspace-docs-share-production-gate-2026-07-20/current-geometry.json", geometry(visibleDocumentPreviews, shareStickyLike));
  writeJson(root, "evaluation/live-critical-surface-current-2026-07-20-rerun/report.json", liveCritical(findings));
  return root;
}

describe("mobile P0 report from geometry", () => {
  it("reports MOBILE_FIXED when default documents preview is closed and live-critical has no findings", () => {
    const root = createRoot();
    const report = runReport(root);

    expect(report.verdict).toBe("MOBILE_FIXED");
    expect(report.hardBlockersClosed).toBe(true);
    expect(report.acceptance.horizontalOverflow).toBe(false);
    expect(report.acceptance.noHorizontalOverflow).toBe(true);
    expect(report.production.commitSha).toBe("aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa");
    expect(report.mobileFlow.documentsSafetyBrief.heightRatio).toBe(1.5);
    expect(report.mobileFlow.documentsSafetyBrief.documentDeepReviewOpen).toBe(false);
    expect(report.mobileFlow.documentsSafetyBrief.visibleDocumentPreviews).toBe(0);
    expect(report.mobileFlow.share.heightRatio).toBe(1.72);
    expect(report.mobileFlow.share.messagePreviewY).toBe(380);
    expect(report.mobileFlow.share.primaryShareCtas).toBe(1);
  });

  it("allows the mobile share primary action row sticky affordance without reopening P0", () => {
    const root = createRoot(0, [], [{ selector: "command-actions share-primary-action-row", position: "sticky", y: 689, h: 62 }]);
    const report = runReport(root);

    expect(report.verdict).toBe("MOBILE_FIXED");
    expect(report.hardBlockersClosed).toBe(true);
    expect(report.mobileFlow.share.stickyLikeCount).toBe(1);
    expect(report.mobileFlow.share.allowedStickyLikeCount).toBe(1);
    expect(report.mobileFlow.share.unsafeStickyLikeCount).toBe(0);
  });

  it("fails closed when a hidden document preview is still visibly rendered", () => {
    const root = createRoot(1);

    expect(() => runReport(root)).toThrow();
    const report = JSON.parse(fs.readFileSync(path.join(root, "evaluation", "mobile-p0-test", "report.json"), "utf8")) as MobileP0Report;
    expect(report.verdict).toBe("MOBILE_PARTIAL");
    expect(report.hardBlockersClosed).toBe(false);
  });

  it("fails closed when the live-critical sweep has findings", () => {
    const root = createRoot(0, [{ route: "/workspace", severity: "P1", message: "overflow" }]);

    expect(() => runReport(root)).toThrow();
    const report = JSON.parse(fs.readFileSync(path.join(root, "evaluation", "mobile-p0-test", "report.json"), "utf8")) as MobileP0Report;
    expect(report.verdict).toBe("MOBILE_PARTIAL");
    expect(report.hardBlockersClosed).toBe(false);
  });
});
