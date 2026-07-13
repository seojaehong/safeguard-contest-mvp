import { describe, expect, it } from "vitest";

import { buildMockAskResponse, mockSearchResults } from "@/lib/mock-data";
import {
  buildReviewedLocalizationEnvelope,
  resolveReviewedLocalizationAuthority,
  verifyReviewedLocalizationEnvelope,
  type LocalizedDispatchArtifactDraft,
  type ReviewedLocalizationEnvelope
} from "@/lib/reviewed-localization-envelope";
import type { AskResponse } from "@/lib/types";
import type { ShareRecipientInput } from "@/lib/workpack-commercial";

const WORKPACK_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const WORKER_ID = "11111111-1111-4111-8111-111111111111";
const REVIEW_SECRET = "reviewed-localization-secret-abcdefghijklmnopqrstuvwxyz";

function workpack(): AskResponse {
  const response = buildMockAskResponse("성수동 외벽 도장", mockSearchResults.slice(0, 2), "live", "test");
  return {
    ...response,
    generationEvidence: {
      version: "safeclaw-generation-evidence/v1",
      algorithm: "HMAC-SHA256",
      snapshot: {
        question: response.question,
        scenario: response.scenario,
        dbHarnessPacket: {} as NonNullable<AskResponse["generationEvidence"]>["snapshot"]["dbHarnessPacket"],
        responseContentDigest: "f".repeat(64),
        generatedAt: "2026-07-14T00:00:00.000Z"
      },
      signature: "e".repeat(64)
    }
  };
}

function vietnameseArtifact(): LocalizedDispatchArtifactDraft {
  return {
    artifactId: "artifact-vi-1",
    targetLocale: "vi",
    localized: {
      subject: "Thông báo an toàn SafeClaw",
      metadata: {
        siteLabel: "Công trường",
        siteValue: "Seongsu",
        taskLabel: "Công việc",
        taskValue: "Sơn tường ngoài",
        coreRiskLabel: "Rủi ro chính",
        coreRiskValue: "Ngã cao"
      },
      bodyLines: [
        "Kiểm tra lan can và thiết bị bảo hộ trước khi làm việc.",
        "Dừng công việc khi có gió mạnh hoặc điều kiện không an toàn."
      ],
      semanticRiskLabels: ["Nguy cơ ngã", "Dừng việc và báo cáo"]
    },
    provenance: {
      method: "human",
      provider: null,
      modelOrVersion: null,
      generatedAt: "2026-07-14T00:01:00.000Z"
    }
  };
}

function reviewedEnvelope(
  response: AskResponse,
  artifact: LocalizedDispatchArtifactDraft = vietnameseArtifact()
): ReviewedLocalizationEnvelope {
  return buildReviewedLocalizationEnvelope({
    workpackId: WORKPACK_ID,
    response,
    artifact,
    artifactRevision: 1,
    decision: "approved",
    reviewerId: "reviewer-1",
    reviewerDisplayName: "Safety Reviewer",
    reviewedAt: "2026-07-14T00:02:00.000Z",
    signedAt: "2026-07-14T00:02:01.000Z",
    secret: REVIEW_SECRET
  });
}

function recipient(languageCode: string, snapshotLanguageCode = languageCode): ShareRecipientInput {
  return {
    workerId: WORKER_ID,
    displayName: "Nguyen",
    languageCode,
    role: "viewer",
    workerSnapshot: {
      workerId: WORKER_ID,
      displayName: "Nguyen",
      languageCode: snapshotLanguageCode,
      phone: "010-1111-2222",
      email: "nguyen@example.com"
    }
  };
}

describe("reviewed localization envelope", () => {
  it("verifies a complete source-bound Vietnamese artifact without Korean metadata residue", () => {
    const response = workpack();
    const envelope = reviewedEnvelope(response);

    expect(verifyReviewedLocalizationEnvelope({
      workpackId: WORKPACK_ID,
      response,
      envelope,
      secret: REVIEW_SECRET
    })).toEqual({ ok: true, envelope });
    expect(JSON.stringify(envelope.artifact.localized)).not.toMatch(/[가-힣]/);
  });

  it("fails closed when a non-Korean metadata value contains Korean residue", () => {
    const response = workpack();
    const artifact = vietnameseArtifact();
    artifact.localized.metadata.siteValue = "성수 현장";
    const envelope = reviewedEnvelope(response, artifact);

    const result = verifyReviewedLocalizationEnvelope({
      workpackId: WORKPACK_ID,
      response,
      envelope,
      secret: REVIEW_SECRET
    });

    expect(result).toMatchObject({ ok: false, reasonCode: "translation_incomplete" });
  });

  it("rejects a signature created with a rotated localization secret", () => {
    const response = workpack();
    const envelope = reviewedEnvelope(response);

    const result = verifyReviewedLocalizationEnvelope({
      workpackId: WORKPACK_ID,
      response,
      envelope,
      secret: `${REVIEW_SECRET}-rotated`
    });

    expect(result).toMatchObject({ ok: false, reasonCode: "translation_incomplete" });
  });

  it.each(["", "xx", "vi-VN"])("routes invalid authoritative locale %s to the worker owner", (languageCode) => {
    const response = workpack();
    const result = resolveReviewedLocalizationAuthority({
      workpackId: WORKPACK_ID,
      response,
      reviewedEnvelopes: { vi: reviewedEnvelope(response) },
      recipients: [recipient(languageCode)],
      secret: REVIEW_SECRET
    });

    expect(result).toMatchObject({
      ok: false,
      reasonCode: "recipient_locale_invalid",
      owner: "workers"
    });
    expect(JSON.stringify(result)).not.toContain('"targetLocale":"ko"');
  });

  it("rejects conflicting recipient and worker snapshot locale sources", () => {
    const response = workpack();
    const result = resolveReviewedLocalizationAuthority({
      workpackId: WORKPACK_ID,
      response,
      reviewedEnvelopes: { vi: reviewedEnvelope(response) },
      recipients: [recipient("vi", "ko")],
      secret: REVIEW_SECRET
    });

    expect(result).toMatchObject({
      ok: false,
      reasonCode: "recipient_locale_invalid",
      owner: "workers"
    });
  });

  it("separates an allowlisted locale with a missing artifact from locale parsing failures", () => {
    const response = workpack();
    const result = resolveReviewedLocalizationAuthority({
      workpackId: WORKPACK_ID,
      response,
      reviewedEnvelopes: {},
      recipients: [recipient("vi")],
      secret: REVIEW_SECRET
    });

    expect(result).toMatchObject({
      ok: false,
      reasonCode: "translation_incomplete",
      owner: "document",
      validatedSupportedCode: "vi"
    });
  });

  it("builds stable workpack and locale payload digests only from verified authority", () => {
    const response = workpack();
    const envelope = reviewedEnvelope(response);
    const first = resolveReviewedLocalizationAuthority({
      workpackId: WORKPACK_ID,
      response,
      reviewedEnvelopes: { vi: envelope },
      recipients: [recipient("vi")],
      secret: REVIEW_SECRET
    });
    const second = resolveReviewedLocalizationAuthority({
      workpackId: WORKPACK_ID,
      response,
      reviewedEnvelopes: { vi: envelope },
      recipients: [recipient("vi")],
      secret: REVIEW_SECRET
    });

    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
    if (!first.ok || !second.ok) throw new Error("complete localization must resolve");
    expect(first.canonicalWorkpackRevision).toMatch(/^[0-9a-f]{64}$/);
    expect(first.normalizedWorkpackDigest).toMatch(/^[0-9a-f]{64}$/);
    expect(first.localePayloadDigest).toMatch(/^[0-9a-f]{64}$/);
    expect(second).toEqual(first);
  });
});
