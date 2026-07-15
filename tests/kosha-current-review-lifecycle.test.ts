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
  createKoshaFixture,
  koshaTestLookup
} from "@/tests/helpers/kosha-offline-fixture";

afterEach(() => {
  resetKoshaGuideCorpusCacheForTests();
  cleanupKoshaFixtures();
});

describe("current-base KOSHA lifecycle quality", () => {
  it.skipIf(!existsSync(ACTUAL_KOSHA_ROOT))("blocks the legacy v3 lifecycle snapshot before retrieval", async () => {
    const loaded = await loadKoshaGuideCorpus({ rootDir: ACTUAL_KOSHA_ROOT });
    expect(loaded.status).toBe("blocked");
    expect(loaded.status === "blocked" && loaded.failures).toContain("schema:manifest.json");
  }, 20_000);

  it("accepts valid current records while stale and retired remain review-required", async () => {
    for (const lifecycle of ["current", "stale", "retired"] as const) {
      const loaded = await loadKoshaGuideCorpus(koshaTestLookup(createKoshaFixture({ state: lifecycle })));
      if (lifecycle !== "current") {
        expect(loaded.status).toBe("blocked");
        expect(loaded.status === "blocked" && loaded.failures).toContain("gate:provenance-incomplete");
        continue;
      }
      expect(loaded.status).toBe("ready");
      if (loaded.status !== "ready") continue;
      expect(new Set(loaded.records.map((record) => record.quality))).toEqual(new Set(["accepted"]));
      expect(new Set(loaded.records.map((record) => record.provenance.lifecycle))).toEqual(new Set(["current"]));
      expect(loaded.records.every(isKoshaGuideDirectEvidenceAccepted)).toBe(true);
    }
  });
});
