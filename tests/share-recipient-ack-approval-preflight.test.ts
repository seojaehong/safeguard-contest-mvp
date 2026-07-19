import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

type ShareRecipientAckApprovalPreflightReport = {
  overall: string;
  approvalRequired: boolean;
  liveDataMutationApproved: boolean;
  dbMutationPerformed: boolean;
  providerMessageSent: boolean;
  productionShareSessionCreated: boolean;
  productionReadConfirmationInserted: boolean;
  failedCheckIds: string[];
  forbiddenBeforeApproval: string[];
};

type ShareRecipientAckApprovalPreflightModule = {
  buildShareRecipientAckApprovalPreflight: (input: { root: string }) => ShareRecipientAckApprovalPreflightReport;
  renderShareRecipientAckApprovalPreflightMarkdown: (report: ShareRecipientAckApprovalPreflightReport) => string;
};

async function loadPreflightModule(): Promise<ShareRecipientAckApprovalPreflightModule> {
  // @ts-expect-error -- executable MJS module exposes the audited runtime API.
  return await import("../scripts/share_recipient_ack_approval_preflight.mjs") as ShareRecipientAckApprovalPreflightModule;
}

function writeJson(root: string, relativePath: string, value: unknown): void {
  const fullPath = join(root, relativePath);
  mkdirSync(join(fullPath, ".."), { recursive: true });
  writeFileSync(fullPath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function writeText(root: string, relativePath: string, value: string): void {
  const fullPath = join(root, relativePath);
  mkdirSync(join(fullPath, ".."), { recursive: true });
  writeFileSync(fullPath, value, "utf8");
}

function createFixtureRoot(): string {
  const root = mkdtempSync(join(tmpdir(), "safeclaw-share-ack-preflight-"));
  writeJson(root, "evaluation/share-recipient-live-current-2026-07-19/report.json", {
    verdict: "pass_current_production_mapped_share_recipient_surface",
    dbSchemaChanged: false,
    supabaseDataChanged: false,
    providerMessageSent: false
  });
  writeJson(root, "evaluation/share-recipient-route-loop-gate-2026-07-19/report.json", {
    verdict: "pass_non_mutating_route_level_invited_recipient_loop",
    contract: {
      managerStatusReadsBackConfirmation: true,
      productionMutationPerformed: false,
      providerMessageSent: false
    }
  });
  writeJson(root, "evaluation/north-star-current-state-2026-07-19/report.json", {
    approvalGatedOrIncompleteGates: {
      realProductionInvitedAck: {
        state: "requires_explicit_live_data_approval"
      }
    }
  });
  writeText(root, "app/api/share-sessions/[sessionId]/route.ts", [
    "createSupabaseAdminClient",
    "loadActivePublicShareSession",
    "workpack_read_confirmations",
    "confirmation_method: \"button\"",
    ".insert(insert)",
    "초대된 작업자 식별자가 확인되지 않아 열람 확인을 저장할 수 없습니다.",
    "초대된 작업자 링크로 다시 접속해 주세요.",
    "{ status: 403 }"
  ].join("\n"));
  writeText(root, "app/api/workpacks/[id]/share-sessions/route.ts", [
    "loadServerShareRecipients",
    "recipients_snapshot",
    "access_policy",
    "workpack_share_sessions"
  ].join("\n"));
  writeText(root, "tests/workpack-share-authority-routes.test.ts", [
    "proves the manager-created invited session can be opened by the worker and reflected in manager confirmations",
    "workerConfirmResponse.status",
    "managerStatus.confirmations",
    "confirmation-route-loop"
  ].join("\n"));
  writeText(root, "tests/share-recipient-portal-browser.test.ts", [
    "renders an invited worker confirmation page without mobile overflow",
    "Lịch sử xác nhận đã được lưu cho quản lý.",
    "confirmationBody",
    "languageCode: \"vi\""
  ].join("\n"));
  return root;
}

describe("share recipient ACK approval preflight", () => {
  it("keeps real production ACK behind explicit live-data approval", async () => {
    const { buildShareRecipientAckApprovalPreflight } = await loadPreflightModule();
    const report = buildShareRecipientAckApprovalPreflight({ root: createFixtureRoot() });

    expect(report.overall).toBe("approval_ready_open");
    expect(report.approvalRequired).toBe(true);
    expect(report.liveDataMutationApproved).toBe(false);
    expect(report.dbMutationPerformed).toBe(false);
    expect(report.providerMessageSent).toBe(false);
    expect(report.productionShareSessionCreated).toBe(false);
    expect(report.productionReadConfirmationInserted).toBe(false);
    expect(report.failedCheckIds).toEqual([]);
    expect(report.forbiddenBeforeApproval).toContain("Insert production workpack_read_confirmations rows.");
  });

  it("fails closed when the current-state artifact claims real ACK does not require approval", async () => {
    const { buildShareRecipientAckApprovalPreflight } = await loadPreflightModule();
    const root = createFixtureRoot();
    const currentStatePath = join(root, "evaluation/north-star-current-state-2026-07-19/report.json");
    const currentState = JSON.parse(readFileSync(currentStatePath, "utf8")) as {
      approvalGatedOrIncompleteGates: { realProductionInvitedAck: { state: string } };
    };
    currentState.approvalGatedOrIncompleteGates.realProductionInvitedAck.state = "proven";
    writeFileSync(currentStatePath, `${JSON.stringify(currentState, null, 2)}\n`, "utf8");

    const report = buildShareRecipientAckApprovalPreflight({ root });

    expect(report.overall).toBe("blocked_preflight_failed");
    expect(report.failedCheckIds).toContain("current_state_keeps_real_ack_approval_required");
  });

  it("fails closed when the route loop evidence is mutating production data", async () => {
    const { buildShareRecipientAckApprovalPreflight } = await loadPreflightModule();
    const root = createFixtureRoot();
    const routeLoopPath = join(root, "evaluation/share-recipient-route-loop-gate-2026-07-19/report.json");
    const routeLoop = JSON.parse(readFileSync(routeLoopPath, "utf8")) as {
      contract: { productionMutationPerformed: boolean };
    };
    routeLoop.contract.productionMutationPerformed = true;
    writeFileSync(routeLoopPath, `${JSON.stringify(routeLoop, null, 2)}\n`, "utf8");

    const report = buildShareRecipientAckApprovalPreflight({ root });

    expect(report.overall).toBe("blocked_preflight_failed");
    expect(report.failedCheckIds).toContain("route_loop_non_mutating_contract_proven");
  });

  it("renders the approval boundary in Markdown", async () => {
    const {
      buildShareRecipientAckApprovalPreflight,
      renderShareRecipientAckApprovalPreflightMarkdown
    } = await loadPreflightModule();
    const report = buildShareRecipientAckApprovalPreflight({ root: createFixtureRoot() });
    const markdown = renderShareRecipientAckApprovalPreflightMarkdown(report);

    expect(markdown).toContain("real production invited-recipient ACK canary still requires explicit live-data approval");
    expect(markdown).toContain("Create production workpack_share_sessions rows.");
    expect(markdown).toContain("Insert production workpack_read_confirmations rows.");
  });
});
