import { describe, expect, it } from "vitest";

import {
  buildReadConfirmationId,
  matchesReadConfirmationIdentity,
} from "@/lib/read-confirmation-idempotency";

const identity = {
  organizationId: "org-1",
  siteId: "site-1",
  workpackId: "workpack-1",
  shareSessionId: "session-1",
  workerId: "worker-1",
  workerDisplayName: "Nguyễn Văn A",
  confirmationMethod: "button",
};

describe("read confirmation idempotency", () => {
  it("normalizes display-name Unicode while preserving a UUIDv8 identity", () => {
    const first = buildReadConfirmationId(identity);
    const decomposed = buildReadConfirmationId({
      ...identity,
      workerDisplayName: identity.workerDisplayName.normalize("NFD"),
    });

    expect(decomposed).toBe(first);
    expect(first).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-8[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });

  it("changes for a different session, worker, or confirmation method", () => {
    const first = buildReadConfirmationId(identity);

    expect(buildReadConfirmationId({ ...identity, shareSessionId: "session-2" })).not.toBe(first);
    expect(buildReadConfirmationId({ ...identity, workerId: "worker-2" })).not.toBe(first);
    expect(buildReadConfirmationId({ ...identity, confirmationMethod: "admin_marked" })).not.toBe(first);
  });

  it("requires the complete stored tenant and relationship tuple", () => {
    const id = buildReadConfirmationId(identity);
    const row = {
      id,
      organization_id: identity.organizationId,
      site_id: identity.siteId,
      workpack_id: identity.workpackId,
      share_session_id: identity.shareSessionId,
      worker_id: identity.workerId,
      worker_display_name: identity.workerDisplayName,
      confirmation_method: identity.confirmationMethod,
    };

    expect(matchesReadConfirmationIdentity(row, identity)).toBe(true);
    expect(matchesReadConfirmationIdentity({ ...row, organization_id: "org-other" }, identity)).toBe(false);
    expect(matchesReadConfirmationIdentity({ ...row, worker_id: "worker-other" }, identity)).toBe(false);
  });
});
