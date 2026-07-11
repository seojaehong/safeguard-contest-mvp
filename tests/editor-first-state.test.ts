import { describe, expect, it } from "vitest";

import { buildStoredCurrentWorkpack, parseStoredCurrentWorkpack } from "@/lib/current-workpack";
import { buildSampleWorkpack } from "@/lib/sample-workpack";

describe("editor-first draft identity", () => {
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
});
