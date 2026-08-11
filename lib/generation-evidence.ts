import { createHash, createHmac, timingSafeEqual } from "node:crypto";

import type { HarnessImprovement } from "@/lib/db-harness";
import {
  buildPublicSafetyReferenceItem,
  type SafetyReferenceItem,
  type SafetyReferenceSearchResult,
} from "@/lib/safety-reference-catalog";
import type {
  AskResponse,
  GenerationEvidenceEnvelope,
  GenerationEvidenceSnapshot
} from "@/lib/types";

const VERSION = "safeclaw-generation-evidence/v1" as const;
const ALGORITHM = "HMAC-SHA256" as const;

type VerificationFailureCode =
  | "envelope_invalid"
  | "signature_invalid"
  | "payload_mismatch"
  | "secret_unconfigured"
  | "unsealed"
  | "db_harness_missing";

export type GenerationEvidenceVerification = {
  ok: true;
  snapshot: GenerationEvidenceSnapshot;
} | {
  ok: false;
  code: VerificationFailureCode;
  message: string;
};

export type GenerationEvidenceComparison = {
  query: string;
  retrievedAt: string;
  mode: "comparison_only";
  not_used_for_generation: true;
  count: number;
  retrievalMode: SafetyReferenceSearchResult["retrievalMode"];
  vectorSearch: SafetyReferenceSearchResult["vectorSearch"];
  items: SafetyReferenceItem[];
};

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map((item) => canonicalize(item));
  if (value && typeof value === "object") {
    return Object.keys(value)
      .sort()
      .reduce<Record<string, unknown>>((record, key) => {
        const item = (value as Record<string, unknown>)[key];
        if (typeof item !== "undefined") record[key] = canonicalize(item);
        return record;
      }, {});
  }
  return value;
}

function canonicalPayload(snapshot: GenerationEvidenceSnapshot): string {
  return JSON.stringify(canonicalize({
    version: VERSION,
    algorithm: ALGORITHM,
    snapshot
  }));
}

export function buildResponseContentDigest(response: AskResponse): string {
  const content = { ...response } as Record<string, unknown>;
  delete content.generationEvidence;
  delete content.generationEvidenceError;
  const digest = createHash("sha256")
    .update(JSON.stringify(canonicalize(content)), "utf8")
    .digest("base64url");
  return `sha256:${digest}`;
}

function signatureFor(snapshot: GenerationEvidenceSnapshot, secret: string): string {
  return createHmac("sha256", secret)
    .update(canonicalPayload(snapshot), "utf8")
    .digest("base64url");
}

function isEnvelope(value: unknown): value is GenerationEvidenceEnvelope {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  return record.version === VERSION
    && record.algorithm === ALGORITHM
    && typeof record.signature === "string"
    && Boolean(record.snapshot)
    && typeof record.snapshot === "object"
    && !Array.isArray(record.snapshot);
}

function signaturesEqual(actual: string, expected: string): boolean {
  const actualBuffer = Buffer.from(actual, "utf8");
  const expectedBuffer = Buffer.from(expected, "utf8");
  return actualBuffer.length === expectedBuffer.length
    && timingSafeEqual(actualBuffer, expectedBuffer);
}

export function sealGenerationEvidence(
  snapshot: GenerationEvidenceSnapshot,
  secret: string
): GenerationEvidenceEnvelope {
  return {
    version: VERSION,
    algorithm: ALGORITHM,
    snapshot,
    signature: signatureFor(snapshot, secret)
  };
}

export function attachGenerationEvidence(
  response: AskResponse,
  options: { secret: string | undefined; generatedAt: string }
): AskResponse {
  if (!options.secret?.trim()) {
    return {
      ...response,
      generationEvidence: undefined,
      generationEvidenceError: {
        code: "secret_unconfigured",
        message: "SAFECLAW_GENERATION_EVIDENCE_SECRET이 없어 생성 근거를 봉인하지 못했습니다. 저장과 공유는 차단됩니다."
      }
    };
  }

  if (!response.dbHarness?.packet) {
    return {
      ...response,
      generationEvidence: undefined,
      generationEvidenceError: {
        code: "db_harness_missing",
        message: "DB 하네스 packet이 없어 생성 근거를 봉인하지 못했습니다. 저장과 공유는 차단됩니다."
      }
    };
  }

  const snapshot: GenerationEvidenceSnapshot = {
    question: response.question,
    scenario: response.scenario,
    dbHarnessPacket: response.dbHarness.packet,
    ...(response.generationTrace ? { generationTrace: response.generationTrace } : {}),
    responseContentDigest: buildResponseContentDigest(response),
    generatedAt: options.generatedAt
  };
  return {
    ...response,
    generationEvidence: sealGenerationEvidence(snapshot, options.secret),
    generationEvidenceError: undefined
  };
}

export function verifyGenerationEvidence(
  envelope: unknown,
  expectedSnapshot: GenerationEvidenceSnapshot,
  secret: string
): GenerationEvidenceVerification {
  if (!isEnvelope(envelope)) {
    return {
      ok: false,
      code: "envelope_invalid",
      message: "generationEvidence envelope 형식이 올바르지 않습니다."
    };
  }

  if (!signaturesEqual(envelope.signature, signatureFor(envelope.snapshot, secret))) {
    return {
      ok: false,
      code: "signature_invalid",
      message: "generationEvidence 서명 검증에 실패했습니다."
    };
  }

  if (canonicalPayload(envelope.snapshot) !== canonicalPayload(expectedSnapshot)) {
    return {
      ok: false,
      code: "payload_mismatch",
      message: "generationEvidence와 저장 요청 payload가 일치하지 않습니다."
    };
  }

  return { ok: true, snapshot: envelope.snapshot };
}

export function verifyAskResponseGenerationEvidence(
  response: AskResponse,
  secret: string | undefined
): GenerationEvidenceVerification {
  if (!secret?.trim()) {
    return {
      ok: false,
      code: "secret_unconfigured",
      message: "SAFECLAW_GENERATION_EVIDENCE_SECRET이 없어 authoritative 저장을 검증할 수 없습니다."
    };
  }
  if (!response.generationEvidence) {
    return {
      ok: false,
      code: "unsealed",
      message: "봉인된 generationEvidence가 없어 저장할 수 없습니다. 다시 생성해 주세요."
    };
  }
  if (!response.dbHarness?.packet) {
    return {
      ok: false,
      code: "db_harness_missing",
      message: "generationEvidence 검증 대상 DB 하네스 packet이 없습니다."
    };
  }

  const generatedAt = response.generationEvidence.snapshot?.generatedAt;
  if (typeof generatedAt !== "string" || !generatedAt) {
    return {
      ok: false,
      code: "envelope_invalid",
      message: "generationEvidence generatedAt 형식이 올바르지 않습니다."
    };
  }

  return verifyGenerationEvidence(response.generationEvidence, {
    question: response.question,
    scenario: response.scenario,
    dbHarnessPacket: response.dbHarness.packet,
    ...(response.generationTrace ? { generationTrace: response.generationTrace } : {}),
    responseContentDigest: buildResponseContentDigest(response),
    generatedAt
  }, secret);
}

export function generationEvidenceReferences(
  snapshot: GenerationEvidenceSnapshot
): SafetyReferenceItem[] {
  const references = [
    ...snapshot.dbHarnessPacket.directEvidence,
    ...snapshot.dbHarnessPacket.sifCases,
    ...snapshot.dbHarnessPacket.supportingEvidence
  ];
  const unique = new Map<string, SafetyReferenceItem>();
  for (const reference of references) {
    if (!unique.has(reference.id)) unique.set(reference.id, reference);
  }
  return [...unique.values()];
}

export function mergeGenerationImprovements(
  snapshot: GenerationEvidenceSnapshot,
  latest: HarnessImprovement[]
): HarnessImprovement[] {
  const merged = new Map<string, HarnessImprovement>();
  for (const improvement of snapshot.dbHarnessPacket.improvementMemory) {
    merged.set(improvement.id, improvement);
  }
  for (const improvement of latest) merged.set(improvement.id, improvement);
  return [...merged.values()];
}

export function buildGenerationEvidenceComparison(
  result: SafetyReferenceSearchResult,
  retrievedAt: string
): GenerationEvidenceComparison {
  return {
    query: result.query,
    retrievedAt,
    mode: "comparison_only",
    not_used_for_generation: true,
    count: result.count,
    retrievalMode: result.retrievalMode,
    vectorSearch: result.vectorSearch,
    items: result.items.map(buildPublicSafetyReferenceItem)
  };
}
