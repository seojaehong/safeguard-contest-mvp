import { createHash } from "node:crypto";

function uuidFromDigest(digest: Buffer): string {
  const bytes = Buffer.from(digest.subarray(0, 16));
  bytes[6] = (bytes[6] & 0x0f) | 0x50;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = bytes.toString("hex");
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20, 32),
  ].join("-");
}

export function dispatchLogRowId(input: {
  organizationId: string;
  siteId: string;
  idempotencyKey: string;
  rowIndex: number;
}): string {
  const identity = [
    input.organizationId,
    input.siteId,
    input.idempotencyKey,
    String(input.rowIndex),
  ].join("\u0000");
  return uuidFromDigest(createHash("sha256").update(identity, "utf8").digest());
}

export function isDispatchLogReplayError(value: unknown): boolean {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const code = "code" in value ? value.code : undefined;
  return code === "23505";
}
