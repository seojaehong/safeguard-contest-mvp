import { describe, expect, it } from "vitest";

import {
  buildImprovementDraft,
  buildImprovementPhotoPath,
  buildReadConfirmationDraft,
  buildShareSessionDraft,
  verifyShareRecipientContact
} from "@/lib/workpack-commercial";

describe("commercial workpack operation contracts", () => {
  it("defaults share sessions to invited-only with manual language switching", () => {
    const draft = buildShareSessionDraft({
      organizationId: "org-1",
      siteId: "site-1",
      workpackId: "wp-1",
      createdBy: "user-1",
      recipients: [{
        workerId: "worker-1",
        displayName: "Nguyen",
        languageCode: "vi",
        workerSnapshot: { trade: "도장공" }
      }]
    });

    expect(draft.share_scope).toBe("invited");
    expect(draft.status).toBe("active");
    expect(draft.access_policy).toMatchObject({
      anonymousAllowed: false,
      manualLanguageSwitchAllowed: true
    });
    expect(draft.recipients_snapshot[0]).toMatchObject({
      workerId: "worker-1",
      displayName: "Nguyen",
      languageCode: "vi",
      role: "viewer",
      workerSnapshot: {
        trade: "도장공",
        workerId: "worker-1",
        displayName: "Nguyen",
        languageCode: "vi",
        role: "viewer"
      }
    });
  });

  it("rejects anonymous read confirmations", () => {
    const draft = buildReadConfirmationDraft({
      organizationId: "org-1",
      siteId: "site-1",
      workpackId: "wp-1",
      shareSessionId: "session-1",
      displayName: "",
      workerSnapshot: { workerId: "worker-1" }
    });

    if (draft.ok) throw new Error("anonymous confirmation should be rejected");
    expect(draft.message).toContain("작업자 표시명");
  });

  it("rejects read confirmations without a worker snapshot", () => {
    const draft = buildReadConfirmationDraft({
      organizationId: "org-1",
      siteId: "site-1",
      workpackId: "wp-1",
      shareSessionId: "session-1",
      displayName: "Nguyen",
      workerSnapshot: {}
    });

    if (draft.ok) throw new Error("empty worker snapshot should be rejected");
    expect(draft.message).toContain("snapshot");
  });

  it("preserves administrator-marked provenance separately from recipient buttons", () => {
    const draft = buildReadConfirmationDraft({
      organizationId: "org-1",
      siteId: "site-1",
      workpackId: "wp-1",
      shareSessionId: "session-1",
      workerId: "worker-1",
      displayName: "Nguyen",
      workerSnapshot: { workerId: "worker-1" },
      confirmationMethod: "admin_marked",
    });

    if (!draft.ok) throw new Error(draft.message);
    expect(draft.insert.confirmation_method).toBe("admin_marked");
  });

  it("verifies an invited worker with the full snapshotted phone or email", () => {
    const recipient = {
      workerId: "worker-1",
      displayName: "Nguyen",
      workerSnapshot: {
        phone: "010-1234-5678",
        email: "Nguyen@example.com"
      }
    };

    expect(verifyShareRecipientContact(recipient, "010 1234 5678")).toEqual({ ok: true, method: "phone" });
    expect(verifyShareRecipientContact(recipient, "nguyen@EXAMPLE.com")).toEqual({ ok: true, method: "email" });
    expect(verifyShareRecipientContact(recipient, "5678")).toEqual({ ok: false, reason: "verification_mismatch" });
    expect(verifyShareRecipientContact(recipient, "attacker@example.com")).toEqual({ ok: false, reason: "verification_mismatch" });
  });

  it("fails closed when an invited worker has no verification contact", () => {
    expect(verifyShareRecipientContact({
      workerId: "worker-1",
      displayName: "Nguyen",
      workerSnapshot: { workerId: "worker-1" }
    }, "010-1234-5678")).toEqual({ ok: false, reason: "recipient_contact_unavailable" });
  });

  it("turns before/after photos into a reviewable improvement draft", () => {
    const draft = buildImprovementDraft({
      organizationId: "org-1",
      siteId: "site-1",
      workpackId: "wp-1",
      taskLabel: "성수동 외벽 도장",
      hazardLabel: "추락",
      beforePhotoName: "before unsafe.png",
      afterPhotoName: "after guardrail.png",
      reflectedDocuments: ["위험성평가표", "TBM 브리핑"]
    });

    expect(draft.review_status).toBe("candidate");
    expect(draft.source_type).toBe("photo_analysis");
    expect(draft.improvement_text).toContain("Before/After 사진 비교 후보");
    expect(draft.reflected_documents).toEqual(["위험성평가표", "TBM 브리핑"]);
  });

  it("builds scoped storage paths without leaking raw whitespace", () => {
    const path = buildImprovementPhotoPath({
      organizationId: "org-1",
      workpackId: "wp-1",
      improvementId: "improvement-1",
      kind: "before",
      fileName: "before unsafe photo.png"
    });

    expect(path).toBe("organizations/org-1/workpacks/wp-1/improvements/improvement-1/before-before-unsafe-photo.png");
  });
});
