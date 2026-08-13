import { createHash } from "node:crypto";

export const READ_CONFIRMATION_ID_VERSION = "workpack-read-confirmation/v1";

export type ReadConfirmationIdentity = {
  organizationId: string;
  siteId: string | null;
  workpackId: string;
  shareSessionId: string;
  workerId: string | null;
  workerDisplayName: string;
  confirmationMethod: string;
};

type StoredReadConfirmationIdentity = {
  id?: unknown;
  organization_id?: unknown;
  site_id?: unknown;
  workpack_id?: unknown;
  share_session_id?: unknown;
  worker_id?: unknown;
  worker_display_name?: unknown;
  confirmation_method?: unknown;
};

function normalizedText(value: string): string {
  return value.trim().normalize("NFC");
}

function canonicalIdentity(identity: ReadConfirmationIdentity) {
  return {
    contractVersion: READ_CONFIRMATION_ID_VERSION,
    organizationId: identity.organizationId,
    siteId: identity.siteId,
    workpackId: identity.workpackId,
    shareSessionId: identity.shareSessionId,
    workerId: identity.workerId,
    workerDisplayName: normalizedText(identity.workerDisplayName),
    confirmationMethod: normalizedText(identity.confirmationMethod),
  };
}

export function buildReadConfirmationId(identity: ReadConfirmationIdentity): string {
  const digest = createHash("sha256")
    .update(JSON.stringify(canonicalIdentity(identity)), "utf8")
    .digest()
    .subarray(0, 16);
  digest[6] = (digest[6] & 0x0f) | 0x80;
  digest[8] = (digest[8] & 0x3f) | 0x80;
  const hex = digest.toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export function matchesReadConfirmationIdentity(
  row: StoredReadConfirmationIdentity | null,
  identity: ReadConfirmationIdentity,
): row is StoredReadConfirmationIdentity & { id: string } {
  if (!row) return false;
  const expectedId = buildReadConfirmationId(identity);
  return row.id === expectedId
    && row.organization_id === identity.organizationId
    && (row.site_id ?? null) === identity.siteId
    && row.workpack_id === identity.workpackId
    && row.share_session_id === identity.shareSessionId
    && (row.worker_id ?? null) === identity.workerId
    && row.worker_display_name === normalizedText(identity.workerDisplayName)
    && row.confirmation_method === normalizedText(identity.confirmationMethod);
}
