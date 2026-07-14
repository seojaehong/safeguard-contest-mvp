import { createHash, createHmac, timingSafeEqual } from "node:crypto";

import {
  parseSupportedLanguageCode,
  resolveAuthoritativeRecipientLocale,
  type SupportedLanguageCode
} from "@/lib/foreign-worker";
import {
  containsHangulResidue,
  hasLocalizedSemanticText,
  isFullEnglishFallback
} from "@/lib/localized-content-policy";
import type { AskResponse } from "@/lib/types";
import type { ShareRecipientInput } from "@/lib/workpack-commercial";

export type LocalizedDispatchContent = {
  subject: string;
  metadata: {
    siteLabel: string;
    siteValue: string;
    taskLabel: string;
    taskValue: string;
    coreRiskLabel: string;
    coreRiskValue: string;
  };
  bodyLines: string[];
  semanticRiskLabels: string[];
};

export type LocalizedDispatchArtifactDraft = {
  artifactId: string;
  targetLocale: SupportedLanguageCode;
  localized: LocalizedDispatchContent;
  provenance: {
    method: "human" | "provider" | "hybrid";
    provider: string | null;
    modelOrVersion: string | null;
    generatedAt: string;
  };
};

export type LocalizedDispatchArtifact = LocalizedDispatchArtifactDraft & {
  artifactRevision: number;
};

export type ReviewedLocalizationEnvelope = {
  version: "reviewed-localization-envelope/v1";
  workpackId: string;
  generationRevision: string;
  sourceDocumentKey: "foreignWorkerTransmission";
  sourceDocumentDigest: string;
  targetLocale: SupportedLanguageCode;
  artifact: LocalizedDispatchArtifact;
  review: {
    state: "approved" | "rejected";
    reviewerId: string;
    reviewerDisplayName: string;
    reviewedAt: string;
  };
  artifactDigest: string;
  signedAt: string;
  signature: string;
};

export type LocalizationAuthorityFailure = {
  ok: false;
  reasonCode:
    | "recipient_locale_invalid"
    | "translation_incomplete"
    | "translation_not_reviewed"
    | "translation_rejected";
  owner: "workers" | "document";
  validatedSupportedCode?: SupportedLanguageCode;
};

export type LocalizationAuthoritySuccess = {
  ok: true;
  canonicalWorkpackRevision: string;
  normalizedWorkpackDigest: string;
  localePayloadDigest: string;
  dispatchRecipients: Array<{
    workerId: string;
    targetLocale: SupportedLanguageCode;
    artifactDigest: string;
    localized: LocalizedDispatchContent;
  }>;
  verifiedEnvelopes: Partial<Record<SupportedLanguageCode, ReviewedLocalizationEnvelope>>;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (!isRecord(value)) return value;
  return Object.keys(value).sort().reduce<Record<string, unknown>>((result, key) => {
    if (value[key] !== undefined) result[key] = canonicalize(value[key]);
    return result;
  }, {});
}

export function canonicalShareJson(value: unknown): string {
  return JSON.stringify(canonicalize(value));
}

export function sha256ShareValue(value: unknown): string {
  return createHash("sha256").update(canonicalShareJson(value)).digest("hex");
}

function signShareValue(value: unknown, secret: string): string {
  return createHmac("sha256", secret).update(canonicalShareJson(value)).digest("hex");
}

function signaturesEqual(expected: string, actual: string): boolean {
  if (!/^[0-9a-f]{64}$/i.test(expected) || !/^[0-9a-f]{64}$/i.test(actual)) return false;
  return timingSafeEqual(Buffer.from(expected, "hex"), Buffer.from(actual, "hex"));
}

function generationRevision(response: AskResponse): string {
  const evidence = response.generationEvidence;
  if (!evidence) throw new Error("generationEvidence is required for reviewed localization");
  return sha256ShareValue({
    version: evidence.version,
    signature: evidence.signature,
    responseContentDigest: evidence.snapshot.responseContentDigest
  });
}

export function buildSourceDocumentDigest(response: AskResponse): string {
  return sha256ShareValue({
    sourceDocumentKey: "foreignWorkerTransmission",
    body: response.deliverables.foreignWorkerTransmission,
    companyName: response.scenario.companyName,
    siteName: response.scenario.siteName,
    workSummary: response.scenario.workSummary,
    topRisk: response.riskSummary.topRisk
  });
}

function buildArtifactDigest(input: {
  generationRevision: string;
  sourceDocumentDigest: string;
  artifact: LocalizedDispatchArtifact;
  review: ReviewedLocalizationEnvelope["review"];
}): string {
  return sha256ShareValue({
    generationRevision: input.generationRevision,
    sourceDocumentKey: "foreignWorkerTransmission",
    sourceDocumentDigest: input.sourceDocumentDigest,
    targetLocale: input.artifact.targetLocale,
    localized: input.artifact.localized,
    provenance: input.artifact.provenance,
    artifactRevision: input.artifact.artifactRevision,
    review: input.review
  });
}

function envelopeSigningPayload(envelope: Omit<ReviewedLocalizationEnvelope, "signature">): unknown {
  return envelope;
}

export function buildReviewedLocalizationEnvelope(input: {
  workpackId: string;
  response: AskResponse;
  artifact: LocalizedDispatchArtifactDraft;
  artifactRevision: number;
  decision: "approved" | "rejected";
  reviewerId: string;
  reviewerDisplayName: string;
  reviewedAt: string;
  signedAt: string;
  secret: string;
}): ReviewedLocalizationEnvelope {
  const artifact: LocalizedDispatchArtifact = {
    ...input.artifact,
    artifactRevision: input.artifactRevision
  };
  const review: ReviewedLocalizationEnvelope["review"] = {
    state: input.decision,
    reviewerId: input.reviewerId,
    reviewerDisplayName: input.reviewerDisplayName,
    reviewedAt: input.reviewedAt
  };
  const revision = generationRevision(input.response);
  const sourceDocumentDigest = buildSourceDocumentDigest(input.response);
  const artifactDigest = buildArtifactDigest({
    generationRevision: revision,
    sourceDocumentDigest,
    artifact,
    review
  });
  const unsigned: Omit<ReviewedLocalizationEnvelope, "signature"> = {
    version: "reviewed-localization-envelope/v1",
    workpackId: input.workpackId,
    generationRevision: revision,
    sourceDocumentKey: "foreignWorkerTransmission",
    sourceDocumentDigest,
    targetLocale: artifact.targetLocale,
    artifact,
    review,
    artifactDigest,
    signedAt: input.signedAt
  };
  return {
    ...unsigned,
    signature: signShareValue(envelopeSigningPayload(unsigned), input.secret)
  };
}

function hasCompleteLocalizedContent(content: LocalizedDispatchContent): boolean {
  const metadata = content.metadata;
  const required = [
    content.subject,
    metadata.siteLabel,
    metadata.siteValue,
    metadata.taskLabel,
    metadata.taskValue,
    metadata.coreRiskLabel,
    metadata.coreRiskValue,
    ...content.bodyLines,
    ...content.semanticRiskLabels
  ];
  return content.bodyLines.length > 0
    && content.semanticRiskLabels.length > 0
    && required.every((value) => (
      typeof value === "string"
      && value.trim().length > 0
      && hasLocalizedSemanticText(value)
    ));
}

function isLocalizedContentComplete(
  content: LocalizedDispatchContent,
  locale: SupportedLanguageCode
): boolean {
  if (!hasCompleteLocalizedContent(content)) return false;
  if (locale !== "ko" && containsHangulResidue(canonicalShareJson(content))) return false;
  return !isFullEnglishFallback([
    content.subject,
    ...Object.values(content.metadata),
    ...content.bodyLines,
    ...content.semanticRiskLabels
  ], locale);
}

export function parseLocalizedDispatchArtifactDraft(
  value: unknown,
  expectedLocale: SupportedLanguageCode
): LocalizedDispatchArtifactDraft | null {
  if (!isRecord(value) || !isRecord(value.localized) || !isRecord(value.provenance)) return null;
  const locale = parseSupportedLanguageCode(value.targetLocale);
  const localized = value.localized;
  const metadata = localized.metadata;
  if (
    locale.status !== "supported"
    || locale.locale !== expectedLocale
    || typeof value.artifactId !== "string"
    || !value.artifactId.trim()
    || !isRecord(metadata)
    || typeof localized.subject !== "string"
    || !Array.isArray(localized.bodyLines)
    || !localized.bodyLines.every((item) => typeof item === "string")
    || !Array.isArray(localized.semanticRiskLabels)
    || !localized.semanticRiskLabels.every((item) => typeof item === "string")
    || !(value.provenance.method === "human" || value.provenance.method === "provider" || value.provenance.method === "hybrid")
    || !(typeof value.provenance.provider === "string" || value.provenance.provider === null)
    || !(typeof value.provenance.modelOrVersion === "string" || value.provenance.modelOrVersion === null)
    || typeof value.provenance.generatedAt !== "string"
    || !Number.isFinite(Date.parse(value.provenance.generatedAt))
  ) return null;
  const content: LocalizedDispatchContent = {
    subject: localized.subject,
    metadata: {
      siteLabel: typeof metadata.siteLabel === "string" ? metadata.siteLabel : "",
      siteValue: typeof metadata.siteValue === "string" ? metadata.siteValue : "",
      taskLabel: typeof metadata.taskLabel === "string" ? metadata.taskLabel : "",
      taskValue: typeof metadata.taskValue === "string" ? metadata.taskValue : "",
      coreRiskLabel: typeof metadata.coreRiskLabel === "string" ? metadata.coreRiskLabel : "",
      coreRiskValue: typeof metadata.coreRiskValue === "string" ? metadata.coreRiskValue : ""
    },
    bodyLines: localized.bodyLines,
    semanticRiskLabels: localized.semanticRiskLabels
  };
  if (!isLocalizedContentComplete(content, expectedLocale)) return null;
  return {
    artifactId: value.artifactId.trim(),
    targetLocale: expectedLocale,
    localized: content,
    provenance: {
      method: value.provenance.method,
      provider: value.provenance.provider,
      modelOrVersion: value.provenance.modelOrVersion,
      generatedAt: value.provenance.generatedAt
    }
  };
}

function parseEnvelope(value: unknown): ReviewedLocalizationEnvelope | null {
  if (!isRecord(value) || !isRecord(value.artifact) || !isRecord(value.review)) return null;
  const artifact = value.artifact;
  if (!isRecord(artifact.localized) || !isRecord(artifact.localized.metadata) || !isRecord(artifact.provenance)) {
    return null;
  }
  const localized = artifact.localized;
  if (!Array.isArray(localized.bodyLines) || !localized.bodyLines.every((item) => typeof item === "string")) return null;
  if (!Array.isArray(localized.semanticRiskLabels) || !localized.semanticRiskLabels.every((item) => typeof item === "string")) return null;
  const locale = parseSupportedLanguageCode(value.targetLocale);
  const artifactLocale = parseSupportedLanguageCode(artifact.targetLocale);
  if (locale.status !== "supported" || artifactLocale.status !== "supported" || locale.locale !== artifactLocale.locale) {
    return null;
  }
  return value as ReviewedLocalizationEnvelope;
}

export function verifyReviewedLocalizationEnvelope(input: {
  workpackId: string;
  response: AskResponse;
  envelope: unknown;
  secret: string;
}): { ok: true; envelope: ReviewedLocalizationEnvelope } | LocalizationAuthorityFailure {
  const envelope = parseEnvelope(input.envelope);
  if (!envelope || envelope.version !== "reviewed-localization-envelope/v1") {
    return { ok: false, reasonCode: "translation_incomplete", owner: "document" };
  }
  if (envelope.review.state === "rejected") {
    return {
      ok: false,
      reasonCode: "translation_rejected",
      owner: "document",
      validatedSupportedCode: envelope.targetLocale
    };
  }
  if (envelope.review.state !== "approved" || !envelope.review.reviewerId || !envelope.review.reviewedAt) {
    return {
      ok: false,
      reasonCode: "translation_not_reviewed",
      owner: "document",
      validatedSupportedCode: envelope.targetLocale
    };
  }
  if (
    envelope.workpackId !== input.workpackId
    || envelope.sourceDocumentKey !== "foreignWorkerTransmission"
    || envelope.generationRevision !== generationRevision(input.response)
    || envelope.sourceDocumentDigest !== buildSourceDocumentDigest(input.response)
    || !Number.isSafeInteger(envelope.artifact.artifactRevision)
    || envelope.artifact.artifactRevision < 1
    || !isLocalizedContentComplete(envelope.artifact.localized, envelope.targetLocale)
  ) {
    return {
      ok: false,
      reasonCode: "translation_incomplete",
      owner: "document",
      validatedSupportedCode: envelope.targetLocale
    };
  }
  const artifactDigest = buildArtifactDigest({
    generationRevision: envelope.generationRevision,
    sourceDocumentDigest: envelope.sourceDocumentDigest,
    artifact: envelope.artifact,
    review: envelope.review
  });
  const { signature, ...unsigned } = envelope;
  const expectedSignature = signShareValue(envelopeSigningPayload(unsigned), input.secret);
  if (artifactDigest !== envelope.artifactDigest || !signaturesEqual(expectedSignature, signature)) {
    return {
      ok: false,
      reasonCode: "translation_incomplete",
      owner: "document",
      validatedSupportedCode: envelope.targetLocale
    };
  }
  return { ok: true, envelope };
}

function buildKoreanSourceContent(response: AskResponse): LocalizedDispatchContent {
  return {
    subject: `[SafeClaw 안전공지] ${response.scenario.companyName}`,
    metadata: {
      siteLabel: "현장",
      siteValue: response.scenario.siteName,
      taskLabel: "작업",
      taskValue: response.scenario.workSummary,
      coreRiskLabel: "핵심 위험",
      coreRiskValue: response.riskSummary.topRisk
    },
    bodyLines: response.deliverables.foreignWorkerTransmission
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean),
    semanticRiskLabels: [response.riskSummary.topRisk, ...response.riskSummary.immediateActions]
  };
}

export function resolveReviewedLocalizationAuthority(input: {
  workpackId: string;
  response: AskResponse;
  reviewedEnvelopes: Record<string, unknown>;
  recipients: ShareRecipientInput[];
  secret: string;
}): LocalizationAuthoritySuccess | LocalizationAuthorityFailure {
  let revision: string;
  try {
    revision = generationRevision(input.response);
  } catch (error) {
    console.error("reviewed localization generation revision failed", error);
    return { ok: false, reasonCode: "translation_incomplete", owner: "document" };
  }

  const verifiedEnvelopes: Partial<Record<SupportedLanguageCode, ReviewedLocalizationEnvelope>> = {};
  for (const [rawLocale, rawEnvelope] of Object.entries(input.reviewedEnvelopes)) {
    const locale = parseSupportedLanguageCode(rawLocale);
    if (locale.status !== "supported") continue;
    const verified = verifyReviewedLocalizationEnvelope({
      workpackId: input.workpackId,
      response: input.response,
      envelope: rawEnvelope,
      secret: input.secret
    });
    if (verified.ok) verifiedEnvelopes[locale.locale] = verified.envelope;
  }

  const dispatchRecipients: LocalizationAuthoritySuccess["dispatchRecipients"] = [];
  for (const recipient of input.recipients) {
    const snapshotLanguageCode = recipient.workerSnapshot?.languageCode;
    const locale = resolveAuthoritativeRecipientLocale({
      workerLanguageCode: snapshotLanguageCode,
      recipientLanguageCode: recipient.languageCode,
      snapshotLanguageCode
    });
    if (locale.status !== "supported") {
      return { ok: false, reasonCode: "recipient_locale_invalid", owner: "workers" };
    }
    const workerId = recipient.workerId?.trim() || "";
    if (!workerId) return { ok: false, reasonCode: "recipient_locale_invalid", owner: "workers" };
    if (locale.locale === "ko") {
      const localized = buildKoreanSourceContent(input.response);
      dispatchRecipients.push({
        workerId,
        targetLocale: "ko",
        artifactDigest: sha256ShareValue(localized),
        localized
      });
      continue;
    }
    const envelope = verifiedEnvelopes[locale.locale];
    if (!envelope) {
      const rawEnvelope = input.reviewedEnvelopes[locale.locale];
      if (rawEnvelope) {
        const failed = verifyReviewedLocalizationEnvelope({
          workpackId: input.workpackId,
          response: input.response,
          envelope: rawEnvelope,
          secret: input.secret
        });
        if (!failed.ok) return failed;
      }
      return {
        ok: false,
        reasonCode: "translation_incomplete",
        owner: "document",
        validatedSupportedCode: locale.locale
      };
    }
    dispatchRecipients.push({
      workerId,
      targetLocale: locale.locale,
      artifactDigest: envelope.artifactDigest,
      localized: envelope.artifact.localized
    });
  }

  const reviewSetDigest = sha256ShareValue(Object.entries(verifiedEnvelopes)
    .map(([locale, envelope]) => ({
      locale,
      artifactDigest: envelope?.artifactDigest,
      signature: envelope?.signature
    }))
    .sort((left, right) => left.locale.localeCompare(right.locale)));
  const canonicalWorkpackRevision = sha256ShareValue({ generationRevision: revision, reviewSetDigest });
  const normalizedWorkpackDigest = sha256ShareValue({
    question: input.response.question,
    scenario: input.response.scenario,
    riskSummary: input.response.riskSummary,
    deliverables: input.response.deliverables,
    generationEvidence: input.response.generationEvidence
  });
  const localePayloadDigest = sha256ShareValue([...dispatchRecipients]
    .sort((left, right) => left.workerId.localeCompare(right.workerId))
    .map((recipient) => ({
      workerId: recipient.workerId,
      targetLocale: recipient.targetLocale,
      artifactDigest: recipient.artifactDigest,
      localized: recipient.localized
    })));

  return {
    ok: true,
    canonicalWorkpackRevision,
    normalizedWorkpackDigest,
    localePayloadDigest,
    dispatchRecipients,
    verifiedEnvelopes
  };
}

export function readReviewedLocalizationEnvelopes(evidenceSummary: unknown): Record<string, unknown> {
  if (!isRecord(evidenceSummary) || !isRecord(evidenceSummary.reviewedLocalizationEnvelopes)) return {};
  return { ...evidenceSummary.reviewedLocalizationEnvelopes };
}
