import { createHash } from "node:crypto";

import {
  getKoshaGroundingDecision,
  type SafetyReferenceItem,
} from "@/lib/safety-reference-catalog";

type ProductionTrustedKoshaReference = Readonly<{
  stableDocumentKey: string;
  version: string;
  bodySha256: string;
  officialUrl: string;
  officialFileId: string;
  publishedAt: string;
}>;

const PRODUCTION_TRUSTED_KOSHA_REFERENCES: readonly ProductionTrustedKoshaReference[] = Object.freeze([
  Object.freeze({
    stableDocumentKey: "D-C-13",
    version: "D-C-13-2026",
    bodySha256: "ea8bb93a3e03a40873222ab385d257e1a5946cb4d28e5c65951353731b0a5919",
    officialUrl: "https://portal.kosha.or.kr/openapi/v1/file/down/CTC2026012914371557826167/1",
    officialFileId: "CTC2026012914371557826167",
    publishedAt: "2026-01-30",
  }),
]);

export function isProductionTrustedKoshaReference(item: SafetyReferenceItem): boolean {
  const decision = getKoshaGroundingDecision(item);
  const metadata = decision?.metadata;
  if (decision?.status !== "verified_current"
    || decision.reason !== "verified-current"
    || decision.reviewRequired
    || !decision.supportingCitationEligible
    || !metadata
    || metadata.lifecycle !== "current"
    || !["verified", "published", "accepted"].includes(metadata.reviewState.trim().toLowerCase())
    || metadata.bodyKind !== "native"
    || metadata.version !== metadata.currentVersion) {
    return false;
  }
  const body = item.body ?? "";
  if (!body.trim()) return false;
  const actualBodySha256 = createHash("sha256").update(body, "utf8").digest("hex");
  return PRODUCTION_TRUSTED_KOSHA_REFERENCES.some((trusted) => (
    metadata.stableDocumentKey === trusted.stableDocumentKey
    && metadata.version === trusted.version
    && metadata.bodySha256 === trusted.bodySha256
    && actualBodySha256 === trusted.bodySha256
    && metadata.officialUrl === trusted.officialUrl
    && metadata.officialFileId === trusted.officialFileId
    && metadata.publishedAt === trusted.publishedAt
  ));
}
