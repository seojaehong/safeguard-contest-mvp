import { describe, expect, it } from "vitest";

import { buildStoredCurrentWorkpack, parseStoredCurrentWorkpack } from "@/lib/current-workpack";
import { buildSampleWorkpack } from "@/lib/sample-workpack";
import type { WorkpackRevalidationBasis } from "@/lib/workpack-readiness";

describe("editor-first draft identity", () => {
  it("round-trips the authoritative revalidation basis with worker and dispatch snapshots", () => {
    const sample = buildSampleWorkpack();
    const revalidationBasis = {
      reviewTasks: ["외벽 도장"],
      source: "generated-ontology-qa"
    } satisfies WorkpackRevalidationBasis;
    const workerSnapshot = {
      savedAt: "2026-07-17T00:00:00.000+09:00",
      source: "workspace" as const,
      workers: [{
        id: "worker-1",
        displayName: "테스트 작업자",
        role: "작업자",
        joinedAt: "2026-07-01",
        experienceLevel: "중간" as const,
        experienceSummary: "현장 배치 확인",
        nationality: "대한민국",
        languageCode: "ko",
        languageLabel: "한국어",
        isNewWorker: false,
        isForeignWorker: false,
        trainingStatus: "이수" as const,
        trainingSummary: "교육 이수"
      }],
      selectedWorkerIds: ["worker-1"]
    };
    const dispatchSnapshot = {
      savedAt: "2026-07-17T00:00:00.000+09:00",
      source: "workspace" as const,
      recipientSuggestions: [],
      targetWorkers: [{
        displayName: "테스트 작업자",
        role: "작업자",
        nationality: "대한민국",
        languageCode: "ko",
        languageLabel: "한국어",
        trainingStatus: "이수" as const
      }]
    };

    const stored = buildStoredCurrentWorkpack(sample, {
      revalidationBasis,
      workerSnapshot,
      dispatchSnapshot
    });
    const reopened = parseStoredCurrentWorkpack(JSON.stringify(stored));

    expect(reopened?.revalidationBasis).toEqual(revalidationBasis);
    expect(reopened?.workerSnapshot).toEqual(workerSnapshot);
    expect(reopened?.dispatchSnapshot).toEqual(dispatchSnapshot);
  });

  it("keeps the generation fingerprint stable when only volatile quality time changes", () => {
    const first = buildSampleWorkpack();
    const second = structuredClone(first);
    if (!first.qualityContract || !second.qualityContract) {
      throw new Error("Sample workpack must include a quality contract");
    }

    first.qualityContract.generatedAt = "2026-07-11T01:00:00.000Z";
    second.qualityContract.generatedAt = "2026-07-11T02:00:00.000Z";

    const firstStored = buildStoredCurrentWorkpack(first);
    const secondStored = buildStoredCurrentWorkpack(second);

    expect(firstStored.generationFingerprint).toBeTruthy();
    expect(secondStored.generationFingerprint).toBe(firstStored.generationFingerprint);

    const reopened = parseStoredCurrentWorkpack(JSON.stringify(firstStored));
    expect(reopened?.generationFingerprint).toBe(firstStored.generationFingerprint);

    if (!reopened) throw new Error("Stored workpack should reopen");
    const edited = structuredClone(reopened.data);
    edited.deliverables.tbmBriefing += "\n사용자 편집";
    const resaved = buildStoredCurrentWorkpack(edited, {
      generationFingerprint: reopened.generationFingerprint
    });
    expect(parseStoredCurrentWorkpack(JSON.stringify(resaved))?.generationFingerprint)
      .toBe(firstStored.generationFingerprint);
  });

  it("preserves workPermitDraft edits in the canonical current workpack snapshot", () => {
    const sample = buildSampleWorkpack();
    const sentinel = "SAFECLAW_WORK_PERMIT_RESTORED";

    sample.deliverables.workPermitDraft = [
      "[1. 허가 기본정보]",
      `허가대상 작업: ${sentinel}`,
      "작업현장: 세이프건설"
    ].join("\n");

    const stored = buildStoredCurrentWorkpack(sample);
    const reopened = parseStoredCurrentWorkpack(JSON.stringify(stored));

    expect(reopened?.data.deliverables.workPermitDraft).toContain(sentinel);

    if (!reopened) throw new Error("Stored workpack should reopen");
    const resaved = buildStoredCurrentWorkpack(reopened.data, {
      generationFingerprint: reopened.generationFingerprint
    });

    expect(parseStoredCurrentWorkpack(JSON.stringify(resaved))?.data.deliverables.workPermitDraft)
      .toContain(sentinel);
  });

  it("preserves an explicitly empty workPermitDraft in the canonical current workpack snapshot", () => {
    const sample = buildSampleWorkpack();
    sample.deliverables.workPermitDraft = "";

    const stored = buildStoredCurrentWorkpack(sample);
    const reopened = parseStoredCurrentWorkpack(JSON.stringify(stored));

    expect(reopened).not.toBeNull();
    expect(reopened?.data.deliverables.workPermitDraft).toBe("");

    if (!reopened) throw new Error("Stored workpack should reopen");
    const resaved = buildStoredCurrentWorkpack(reopened.data, {
      generationFingerprint: reopened.generationFingerprint
    });

    expect(parseStoredCurrentWorkpack(JSON.stringify(resaved))?.data.deliverables.workPermitDraft)
      .toBe("");
  });

  it("round-trips generation trace, fingerprint, and an explicit empty permit together", () => {
    const sample = buildSampleWorkpack();
    sample.deliverables.workPermitDraft = "";
    sample.generationTrace = {
      traceId: "trace-cross-contract",
      askMode: "enhanced",
      answer: {
        provider: "safeclaw",
        model: null,
        composition: "safeclaw_db_harness",
        upstream: {
          provider: "openai",
          model: "gpt-4.1-mini",
          fallbackUsed: false,
          usedInFinal: true
        }
      },
      deliverables: {
        attempted: true,
        provider: "safeclaw",
        modelPerDocument: {
          workPermitDraft: {
            provider: "safeclaw",
            model: null,
            source: "deterministic",
            fallbackUsed: false
          }
        }
      },
      fallbackUsed: false
    };

    const stored = buildStoredCurrentWorkpack(sample);
    const reopened = parseStoredCurrentWorkpack(JSON.stringify(stored));

    expect(reopened).not.toBeNull();
    expect(reopened?.generationFingerprint).toBe(stored.generationFingerprint);
    expect(reopened?.data.generationTrace).toEqual(sample.generationTrace);
    expect(reopened?.data.deliverables.workPermitDraft).toBe("");

    if (!reopened) throw new Error("Stored workpack should reopen");
    const resaved = buildStoredCurrentWorkpack(reopened.data, {
      generationFingerprint: reopened.generationFingerprint
    });
    const roundTripped = parseStoredCurrentWorkpack(JSON.stringify(resaved));

    expect(roundTripped?.generationFingerprint).toBe(stored.generationFingerprint);
    expect(roundTripped?.data.generationTrace).toEqual(sample.generationTrace);
    expect(roundTripped?.data.deliverables.workPermitDraft).toBe("");
  });
});
