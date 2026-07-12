import { existsSync } from "node:fs";

import { afterEach, describe, expect, it } from "vitest";

import {
  isKoshaGuideDirectEvidenceAccepted,
  loadKoshaGuideCorpus,
  resetKoshaGuideCorpusCacheForTests
} from "@/lib/kosha-guide-corpus";
import {
  ACTUAL_KOSHA_ROOT,
  cleanupKoshaFixtures,
  createKoshaFixture
} from "@/tests/helpers/kosha-offline-fixture";

afterEach(() => {
  resetKoshaGuideCorpusCacheForTests();
  cleanupKoshaFixtures();
});

describe("current-base KOSHA lifecycle quality", () => {
  it.skipIf(!existsSync(ACTUAL_KOSHA_ROOT))("maps the actual stale1038/retired1 v3 distribution to review-required", async () => {
    const loaded = await loadKoshaGuideCorpus({ rootDir: ACTUAL_KOSHA_ROOT });
    expect(loaded.status === "blocked" ? loaded.failures.join(", ") : loaded.status).toBe("ready");
    if (loaded.status !== "ready") return;
    const lifecycleCounts = loaded.records.reduce<Record<string, number>>((counts, record) => {
      counts[record.provenance.lifecycle] = (counts[record.provenance.lifecycle] ?? 0) + 1;
      return counts;
    }, {});

    expect(lifecycleCounts).toEqual({ stale: 1038, retired: 1 });
    expect(loaded.records.every((record) => record.quality === "review_required")).toBe(true);
    expect(loaded.records.every((record) => !isKoshaGuideDirectEvidenceAccepted(record))).toBe(true);

    const dc13 = loaded.records.find((record) => record.version === "D-C-13-2026");
    expect(dc13).toMatchObject({
      version: "D-C-13-2026",
      quality: "review_required",
      provenance: { lifecycle: "stale" }
    });
  }, 20_000);

  it("accepts valid current records while stale and retired remain review-required", async () => {
    for (const lifecycle of ["current", "stale", "retired"] as const) {
      const loaded = await loadKoshaGuideCorpus({ rootDir: createKoshaFixture({ state: lifecycle }) });
      expect(loaded.status).toBe("ready");
      if (loaded.status !== "ready") continue;
      const expectedQuality = lifecycle === "current" ? "accepted" : "review_required";
      const expectedDirect = lifecycle === "current";
      expect(new Set(loaded.records.map((record) => record.quality))).toEqual(new Set([expectedQuality]));
      expect(new Set(loaded.records.map((record) => record.provenance.lifecycle))).toEqual(new Set([lifecycle]));
      expect(loaded.records.every((record) => isKoshaGuideDirectEvidenceAccepted(record) === expectedDirect)).toBe(true);
    }
  });
});
