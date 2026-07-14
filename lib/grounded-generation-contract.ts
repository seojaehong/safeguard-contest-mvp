import { createHash } from "node:crypto";

import type { DbHarnessPacket } from "@/lib/db-harness";
import {
  getSafetyReferenceDisplayTitle,
  isKoshaSupportingCitationEligible,
  isSafetyReferenceDirectEligible,
  type SafetyReferenceItem
} from "@/lib/safety-reference-catalog";
import type { SearchResult } from "@/lib/types";

export type GroundedGenerationSource = Readonly<{
  referenceKey: string;
  kind: "direct" | "sif" | "kosha" | "law";
  sourceId: string;
  title: string;
  summary: string;
  aliases: readonly string[];
  controls: readonly string[];
}>;

export type GroundedGenerationPacket = Readonly<{
  version: "grounded-generation-v1";
  sourceIdentity: string;
  status: "ready" | "review_required";
  llmRole: "naturalize_only";
  sources: readonly GroundedGenerationSource[];
}>;

export type GroundingViolation = Readonly<{
  code: "unknown_reference" | "control_provenance_missing" | "control_claim_not_in_packet";
  path: string;
  value: string;
}>;

export type GroundedGenerationValidation = Readonly<{
  status: "grounded" | "review_required";
  violations: readonly GroundingViolation[];
}>;

function uniqueStrings(values: readonly (string | null | undefined)[]): string[] {
  return [...new Set(values.map((value) => value?.trim()).filter((value): value is string => Boolean(value)))];
}

function safetySource(
  item: SafetyReferenceItem,
  kind: GroundedGenerationSource["kind"],
  referenceKey: string
): GroundedGenerationSource {
  const title = getSafetyReferenceDisplayTitle(item);
  return {
    referenceKey,
    kind,
    sourceId: item.source_id,
    title,
    summary: item.short_summary || item.summary,
    aliases: uniqueStrings([
      referenceKey,
      item.id,
      item.source_id,
      title,
      item.kosha_guide?.referenceId,
      item.kosha_guide?.stableDocumentKey,
      item.kosha_guide?.evidenceRef
    ]),
    controls: uniqueStrings(item.controls)
  };
}

function legalSource(item: SearchResult): GroundedGenerationSource {
  const referenceKey = `LAW:${item.id}`;
  return {
    referenceKey,
    kind: "law",
    sourceId: item.id,
    title: item.title,
    summary: item.summary,
    aliases: uniqueStrings([referenceKey, item.id, item.title, item.citation, item.sourceUrl]),
    controls: []
  };
}

function deepFreeze<T>(value: T): T {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) deepFreeze(child);
  }
  return value;
}

export function buildGroundedGenerationPacket(input: {
  dbHarnessPacket: DbHarnessPacket;
  legalCandidates: readonly SearchResult[];
  eligibleKoshaIds: ReadonlySet<string>;
}): GroundedGenerationPacket {
  const direct = input.dbHarnessPacket.directEvidence
    .filter(isSafetyReferenceDirectEligible)
    .map((item) => safetySource(item, "direct", `DB:${item.id}`));
  const sif = input.dbHarnessPacket.sifCases
    .filter((item) => item.item_type === "sif-case")
    .map((item) => safetySource(item, "sif", `SIF:${item.id}`));
  const kosha = input.dbHarnessPacket.supportingEvidence
    .filter((item) => input.eligibleKoshaIds.has(item.id) && isKoshaSupportingCitationEligible(item))
    .map((item) => {
      const stableKey = item.kosha_guide?.stableDocumentKey || item.id;
      const version = item.kosha_guide?.version;
      return safetySource(item, "kosha", `KOSHA:${stableKey}${version ? `@${version}` : ""}`);
    });
  const law = input.legalCandidates.map(legalSource);
  const sources = [...direct, ...sif, ...kosha, ...law];
  const identityPayload = JSON.stringify(sources.map((source) => ({
    referenceKey: source.referenceKey,
    sourceId: source.sourceId,
    controls: source.controls
  })));
  const packet: GroundedGenerationPacket = {
    version: "grounded-generation-v1",
    sourceIdentity: createHash("sha256").update(identityPayload).digest("hex"),
    status: input.dbHarnessPacket.ontologyChecklist.status === "ready" && sources.length > 0
      ? "ready"
      : "review_required",
    llmRole: "naturalize_only",
    sources
  };
  return deepFreeze(packet);
}

function normalize(value: string): string {
  return value.replace(/\s+/g, " ").trim().toLocaleLowerCase("ko-KR");
}

function sourceMatchesReference(source: GroundedGenerationSource, reference: string): boolean {
  const normalizedReference = normalize(reference);
  return source.aliases.some((alias) => {
    const normalizedAlias = normalize(alias);
    return normalizedAlias === normalizedReference
      || normalizedReference.includes(normalizedAlias)
      || normalizedAlias.includes(normalizedReference);
  });
}

function matchingSources(packet: GroundedGenerationPacket, reference: string): readonly GroundedGenerationSource[] {
  return packet.sources.filter((source) => sourceMatchesReference(source, reference));
}

const CONTROL_FIELDS = ["currentControls", "additionalControls", "safetyMeasure", "control", "action"] as const;
const KOSHA_REFERENCE_RE = /\b[A-Z](?:-[A-Z])?-\d{1,4}(?:-\d{4})?\b/g;
const LAW_REFERENCE_RE = /제\d+조(?:의\d+)?/g;

function collectExplicitReferences(value: string): string[] {
  return uniqueStrings([
    ...(value.match(KOSHA_REFERENCE_RE) || []),
    ...(value.match(LAW_REFERENCE_RE) || [])
  ]);
}

function validateNode(
  node: unknown,
  packet: GroundedGenerationPacket,
  path: string,
  violations: GroundingViolation[]
): void {
  if (typeof node === "string") {
    for (const reference of collectExplicitReferences(node)) {
      if (matchingSources(packet, reference).length === 0) {
        violations.push({ code: "unknown_reference", path, value: reference });
      }
    }
    return;
  }
  if (Array.isArray(node)) {
    node.forEach((item, index) => validateNode(item, packet, `${path}[${index}]`, violations));
    return;
  }
  if (!node || typeof node !== "object") return;

  const record = node as Record<string, unknown>;
  const evidenceRefs = Array.isArray(record.evidenceRefs)
    ? record.evidenceRefs.filter((value): value is string => typeof value === "string" && value.trim().length > 0)
    : [];
  const resolvedSources = evidenceRefs.flatMap((reference) => matchingSources(packet, reference));
  for (const reference of evidenceRefs) {
    if (matchingSources(packet, reference).length === 0) {
      violations.push({ code: "unknown_reference", path: `${path}.evidenceRefs`, value: reference });
    }
  }

  const controlSources = resolvedSources.filter((source) => source.controls.length > 0);
  for (const controlField of CONTROL_FIELDS) {
    const controlValue = record[controlField];
    if (typeof controlValue !== "string" || controlValue.trim().length === 0) continue;
    if (controlSources.length === 0) {
      violations.push({
        code: "control_provenance_missing",
        path: `${path}.${controlField}`,
        value: controlValue
      });
      continue;
    }
    const normalizedClaim = normalize(controlValue);
    const matchesPacketControl = controlSources.some((source) => source.controls.some((control) => {
      const normalizedControl = normalize(control);
      return normalizedClaim === normalizedControl
        || normalizedClaim.includes(normalizedControl)
        || normalizedControl.includes(normalizedClaim);
    }));
    if (!matchesPacketControl) {
      violations.push({
        code: "control_claim_not_in_packet",
        path: `${path}.${controlField}`,
        value: controlValue
      });
    }
  }

  for (const [key, value] of Object.entries(record)) {
    if (key === "evidenceRefs") continue;
    validateNode(value, packet, path ? `${path}.${key}` : key, violations);
  }
}

export function validateGroundedGenerationOutput(
  output: unknown,
  packet: GroundedGenerationPacket
): GroundedGenerationValidation {
  const violations: GroundingViolation[] = [];
  validateNode(output, packet, "$", violations);
  return deepFreeze({
    status: packet.status === "ready" && violations.length === 0 ? "grounded" : "review_required",
    violations
  });
}

export function serializeGroundedGenerationPacket(packet: GroundedGenerationPacket): string {
  return JSON.stringify(packet);
}
