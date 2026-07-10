import { describe, expect, it } from "vitest";

import { buildDbHarnessPacket } from "@/lib/db-harness";
import {
  attachGenerationEvidence,
  buildResponseContentDigest,
  sealGenerationEvidence,
  verifyGenerationEvidence
} from "@/lib/generation-evidence";
import { buildMockAskResponse } from "@/lib/mock-data";
import type { AskResponse } from "@/lib/types";
import type { GenerationEvidenceSnapshot } from "@/lib/types";

const SECRET = "safeclaw-generation-evidence-test-secret";

function snapshot(): GenerationEvidenceSnapshot {
  const question = "성수동 외벽 도장 작업";
  return {
    question,
    scenario: {
      siteName: "성수 현장",
      companyName: "세이프건설",
      companyType: "건설업",
      workSummary: "외벽 도장",
      workerCount: 4,
      weatherNote: "강풍 주의"
    },
    dbHarnessPacket: buildDbHarnessPacket({ question, references: [] }),
    responseContentDigest: "sha256:test-fixture",
    generatedAt: "2026-07-10T09:30:00.000Z"
  };
}

function responseWithHarness(): AskResponse {
  const response = buildMockAskResponse(snapshot().question, [], "mock", "test");
  const packet = snapshot().dbHarnessPacket;
  return {
    ...response,
    scenario: snapshot().scenario,
    dbHarness: {
      packet,
      promptContext: "server generation harness",
      summary: {
        mode: packet.mode,
        llmRole: packet.generationContract.llmRole,
        llmOutputScope: packet.generationContract.llmOutputScope,
        evidenceAuthority: packet.generationContract.evidenceAuthority,
        providerRetryScope: packet.generationContract.providerRetryScope,
        fallbackChainAllowed: packet.generationContract.fallbackChainAllowed,
        genericProseSubstitutionAllowed: packet.generationContract.genericProseSubstitutionAllowed,
        missingEvidencePolicy: packet.generationContract.missingEvidencePolicy,
        directEvidence: packet.directEvidence.length,
        sifCases: packet.sifCases.length,
        supportingEvidence: packet.supportingEvidence.length,
        improvementMemory: packet.improvementMemory.length,
        workpackMemory: packet.workpackMemory.length,
        missingEvidence: packet.generationContract.missingEvidence,
        documentCoverage: packet.generationContract.documentCoverage,
        retrievalContract: packet.retrievalContract,
        ontologyStatus: packet.ontologyChecklist.status
      }
    }
  };
}

describe("generation evidence integrity", () => {
  it("seals and verifies the canonical generation snapshot", () => {
    const expected = snapshot();
    const envelope = sealGenerationEvidence(expected, SECRET);

    expect(envelope.version).toBe("safeclaw-generation-evidence/v1");
    expect(envelope.algorithm).toBe("HMAC-SHA256");
    expect(verifyGenerationEvidence(envelope, expected, SECRET)).toEqual({
      ok: true,
      snapshot: expected
    });
  });

  it("rejects a tampered envelope", () => {
    const expected = snapshot();
    const envelope = sealGenerationEvidence(expected, SECRET);
    const tampered = {
      ...envelope,
      snapshot: {
        ...envelope.snapshot,
        question: "변조된 작업"
      }
    };

    expect(verifyGenerationEvidence(tampered, expected, SECRET)).toMatchObject({
      ok: false,
      code: "signature_invalid"
    });
  });

  it("rejects a valid envelope when the save payload differs", () => {
    const sealedSnapshot = snapshot();
    const envelope = sealGenerationEvidence(sealedSnapshot, SECRET);
    const changedPayload = {
      ...sealedSnapshot,
      scenario: {
        ...sealedSnapshot.scenario,
        workerCount: 99
      }
    };

    expect(verifyGenerationEvidence(envelope, changedPayload, SECRET)).toMatchObject({
      ok: false,
      code: "payload_mismatch"
    });
  });

  it("attaches a sealed envelope to a server generation response", () => {
    const response = responseWithHarness();
    const attached = attachGenerationEvidence(response, {
      secret: SECRET,
      generatedAt: snapshot().generatedAt
    });

    expect(attached.generationEvidence?.snapshot).toEqual({
      ...snapshot(),
      responseContentDigest: buildResponseContentDigest(response)
    });
    expect(attached.generationEvidenceError).toBeUndefined();
  });

  it("keeps missing-secret generation failures explicit without creating authoritative evidence", () => {
    const attached = attachGenerationEvidence(responseWithHarness(), {
      secret: undefined,
      generatedAt: snapshot().generatedAt
    });

    expect(attached.generationEvidence).toBeUndefined();
    expect(attached.generationEvidenceError).toMatchObject({
      code: "secret_unconfigured"
    });
  });
});
