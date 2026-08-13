import { createHash } from "node:crypto";

type KnowledgeIngestRunIdentity = {
  organizationId: string;
  siteId: string;
  source: string;
  sourceId: string;
  capturedAt: string;
  title: string;
  url: string | null;
  payload: unknown;
  relatedHazardIds: string[];
  reflectedDocuments: string[];
};

type StoredKnowledgeEventIdentity = {
  captured_at: unknown;
  title: unknown;
  url: unknown;
  payload: unknown;
  related_hazard_ids: unknown;
  reflected_documents: unknown;
};

export const KNOWLEDGE_INGEST_RUN_ID_VERSION = "knowledge-ingest-run/v1";

function stableJson(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value) ?? "null";
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${stableJson(record[key])}`).join(",")}}`;
}

function canonicalTimestamp(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const timestamp = Date.parse(value);
  return Number.isNaN(timestamp) ? value : new Date(timestamp).toISOString();
}

function canonicalStringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string").sort();
}

export function buildKnowledgeIngestRunId(identity: KnowledgeIngestRunIdentity): string {
  const canonical = stableJson({
    contractVersion: KNOWLEDGE_INGEST_RUN_ID_VERSION,
    ...identity,
    relatedHazardIds: [...identity.relatedHazardIds].sort(),
    reflectedDocuments: [...identity.reflectedDocuments].sort(),
  });
  const bytes = createHash("sha256").update(canonical, "utf8").digest().subarray(0, 16);
  bytes[6] = (bytes[6] & 0x0f) | 0x80;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = bytes.toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export function knowledgeEventRequiresReviewReset(
  stored: StoredKnowledgeEventIdentity,
  incoming: Omit<KnowledgeIngestRunIdentity, "organizationId" | "siteId" | "source" | "sourceId">,
): boolean {
  return stableJson({
    capturedAt: canonicalTimestamp(stored.captured_at),
    title: stored.title,
    url: stored.url,
    payload: stored.payload,
    relatedHazardIds: canonicalStringList(stored.related_hazard_ids),
    reflectedDocuments: canonicalStringList(stored.reflected_documents),
  }) !== stableJson({
    capturedAt: canonicalTimestamp(incoming.capturedAt),
    title: incoming.title,
    url: incoming.url,
    payload: incoming.payload,
    relatedHazardIds: [...incoming.relatedHazardIds].sort(),
    reflectedDocuments: [...incoming.reflectedDocuments].sort(),
  });
}
