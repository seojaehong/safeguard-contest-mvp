import { createHash } from "node:crypto";

import type {
  KoshaGroundingDecision,
  SafetyReferenceItem,
} from "@/lib/safety-reference-catalog";

export type ExactKoshaTrustPin = Readonly<{
  itemId: string;
  sourceId: string;
  itemType: "technical-guideline" | "technical-support-regulation";
  title: string;
  stableDocumentKey: string;
  version: string;
  bodySha256: string;
  pdfSha256: string;
  officialUrl: string;
  officialFileId: string;
  publishedAt: string;
}>;

const PRODUCTION_TRUSTED_KOSHA_REFERENCES: readonly ExactKoshaTrustPin[] = Object.freeze([
  Object.freeze({
    itemId: "technical-support-01-0065-d-c-13-2026-외벽도장보수공사에-안전작업에-관한-기술지원규정",
    sourceId: "kosha-technical-support-regulations-2025",
    itemType: "technical-support-regulation",
    title: "D-C-13-2026 외벽도장보수공사에 안전작업에 관한 기술지원규정",
    stableDocumentKey: "D-C-13",
    version: "D-C-13-2026",
    bodySha256: "ea8bb93a3e03a40873222ab385d257e1a5946cb4d28e5c65951353731b0a5919",
    pdfSha256: "790a823a3fceae0328ba3c2692486c057f33a036a2ea1fa672e94a626c481179",
    officialUrl: "https://portal.kosha.or.kr/openapi/v1/file/down/CTC2026012914371557826167/1",
    officialFileId: "CTC2026012914371557826167",
    publishedAt: "2026-01-30",
  }),
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function metadataRecords(item: SafetyReferenceItem): readonly Record<string, unknown>[] {
  return [item.payload, item.metadata].filter(isRecord);
}

function readStrings(
  records: readonly Record<string, unknown>[],
  keys: readonly string[],
): readonly string[] {
  const values: string[] = [];
  for (const record of records) {
    for (const key of keys) {
      const value = record[key];
      if (typeof value === "string" && value.trim()) values.push(value.trim());
    }
  }
  return values;
}

function readBooleans(
  records: readonly Record<string, unknown>[],
  keys: readonly string[],
): readonly boolean[] {
  const values: boolean[] = [];
  for (const record of records) {
    for (const key of keys) {
      const value = record[key];
      if (typeof value === "boolean") values.push(value);
    }
  }
  return values;
}

function matchesRequiredPinnedValue(
  records: readonly Record<string, unknown>[],
  keys: readonly string[],
  expected: string,
): boolean {
  const values = readStrings(records, keys);
  return values.length > 0 && values.every((value) => value === expected);
}

function metadataDoesNotContradictPin(
  item: SafetyReferenceItem,
  pin: ExactKoshaTrustPin,
): boolean {
  const records = metadataRecords(item);
  if (!records.length) return false;
  const lifecycle = readStrings(records, ["official_status", "officialStatus", "lifecycle", "state", "status"]);
  const reviewState = readStrings(records, ["review_state", "reviewState", "quality"]);
  const bodyKind = readStrings(records, ["body_kind", "bodyKind", "extraction_method", "extractionMethod"]);
  const humanConfirmed = readBooleans(records, ["human_confirmed", "humanConfirmed"]);
  const tampered = readBooleans(records, ["tampered", "integrity_tampered", "integrityTampered"]);
  if (!lifecycle.length || lifecycle.some((value) => value.toLowerCase() !== "current")) return false;
  if (!reviewState.length || reviewState.some((value) => !["verified", "published", "accepted"].includes(value.toLowerCase()))) return false;
  if (!bodyKind.length || bodyKind.some((value) => !["native", "native-pdf", "native_pdf"].includes(value.toLowerCase()))) return false;
  if (!humanConfirmed.length || humanConfirmed.some((value) => value !== true)) return false;
  if (!tampered.length || tampered.some((value) => value !== false)) return false;

  const grounding = item.kosha_grounding;
  if (grounding && grounding.reason !== "metadata-absent") {
    if (grounding.status !== "verified_current" || grounding.reviewRequired || !grounding.metadata) return false;
    const metadata = grounding.metadata;
    if (metadata.lifecycle !== "current"
      || !["verified", "published", "accepted"].includes(metadata.reviewState.toLowerCase())
      || metadata.bodyKind !== "native"
      || metadata.stableDocumentKey !== pin.stableDocumentKey
      || metadata.version !== pin.version
      || metadata.currentVersion !== pin.version
      || metadata.bodySha256 !== pin.bodySha256
      || metadata.officialUrl !== pin.officialUrl
      || metadata.officialFileId !== pin.officialFileId
      || metadata.publishedAt !== pin.publishedAt) {
      return false;
    }
  }

  const guide = item.kosha_guide;
  if (guide && (
    guide.referenceId !== pin.itemId
    || guide.stableDocumentKey !== pin.stableDocumentKey
    || guide.version !== pin.version
    || guide.officialVersion !== pin.version
    || guide.quality !== "accepted"
    || guide.lifecycle !== "current"
    || guide.bodyKind !== "native"
    || guide.directEligible !== true
    || guide.bodySha256 !== pin.bodySha256
    || guide.pdfSha256 !== pin.pdfSha256
    || guide.officialUrl !== pin.officialUrl
    || guide.officialFileId !== pin.officialFileId
    || guide.publicationDate !== pin.publishedAt
  )) {
    return false;
  }

  return matchesRequiredPinnedValue(
    records,
    ["reference_item_id", "referenceItemId", "uid"],
    pin.itemId,
  ) && matchesRequiredPinnedValue(
    records,
    ["stable_document_key", "stableDocumentKey", "stable_key"],
    pin.stableDocumentKey,
  ) && matchesRequiredPinnedValue(
    records,
    ["version", "version_code", "versionKey", "version_key"],
    pin.version,
  ) && matchesRequiredPinnedValue(
    records,
    ["official_version_code", "officialVersionCode", "current_version", "currentVersion"],
    pin.version,
  ) && matchesRequiredPinnedValue(
    records,
    ["body_sha256", "bodySha256", "normalized_text_sha256", "normalizedTextSha256"],
    pin.bodySha256,
  ) && matchesRequiredPinnedValue(
    records,
    ["pdf_sha256", "pdfSha256", "raw_sha256", "rawSha256"],
    pin.pdfSha256,
  ) && matchesRequiredPinnedValue(
    records,
    ["official_url", "officialUrl", "official_download_url", "officialDownloadUrl"],
    pin.officialUrl,
  ) && matchesRequiredPinnedValue(
    records,
    ["official_file_id", "officialFileId", "techGdlnOrgnlAtcflNo"],
    pin.officialFileId,
  ) && matchesRequiredPinnedValue(
    records,
    ["official_published_at", "officialPublishedAt", "published_at", "publishedAt"],
    pin.publishedAt,
  );
}

export function matchesExactKoshaTrustPin(
  item: SafetyReferenceItem,
  pin: ExactKoshaTrustPin,
): boolean {
  if (item.id !== pin.itemId
    || item.source_id !== pin.sourceId
    || item.item_type !== pin.itemType
    || item.title !== pin.title
    || (item.source_url && item.source_url !== pin.officialUrl)) {
    return false;
  }
  const body = item.body ?? "";
  if (!body.trim()) return false;
  const actualBodySha256 = createHash("sha256").update(body, "utf8").digest("hex");
  return actualBodySha256 === pin.bodySha256 && metadataDoesNotContradictPin(item, pin);
}

function matchingPin(
  item: SafetyReferenceItem,
  pins: readonly ExactKoshaTrustPin[],
): ExactKoshaTrustPin | null {
  return pins.find((pin) => matchesExactKoshaTrustPin(item, pin)) ?? null;
}

export function buildExactTrustedKoshaGroundingDecision(
  item: SafetyReferenceItem,
  pins: readonly ExactKoshaTrustPin[] = PRODUCTION_TRUSTED_KOSHA_REFERENCES,
): KoshaGroundingDecision | null {
  const pin = matchingPin(item, pins);
  if (!pin) return null;
  return {
    status: "verified_current",
    reason: "verified-current",
    source: "production-registry",
    reviewRequired: false,
    directEvidenceEligible: true,
    supportingCitationEligible: true,
    mandatoryCitationEligible: true,
    riskRowEligible: true,
    promptExcerptEligible: true,
    metadata: {
      uid: pin.itemId,
      stableDocumentKey: pin.stableDocumentKey,
      version: pin.version,
      currentVersion: pin.version,
      lifecycle: "current",
      reviewState: "published",
      bodyKind: "native",
      bodySha256: pin.bodySha256,
      officialUrl: pin.officialUrl,
      officialFileId: pin.officialFileId,
      publishedAt: pin.publishedAt,
      provenance: `${pin.officialUrl}#file=${encodeURIComponent(pin.officialFileId)}`,
    },
  };
}

export function isProductionTrustedKoshaReference(item: SafetyReferenceItem): boolean {
  return buildExactTrustedKoshaGroundingDecision(item) !== null;
}
