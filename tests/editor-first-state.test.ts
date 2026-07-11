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
});
