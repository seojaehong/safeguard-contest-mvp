import { existsSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { loadKoshaGuideCorpus } from "@/lib/kosha-guide-corpus";
import { ACTUAL_KOSHA_ROOT } from "@/tests/helpers/kosha-offline-fixture";

describe("KOSHA v3 provenance gate", () => {
  it.skipIf(!existsSync(ACTUAL_KOSHA_ROOT))("rejects the legacy v3 snapshot without launch and item provenance", async () => {
    const loaded = await loadKoshaGuideCorpus({ rootDir: ACTUAL_KOSHA_ROOT });
    expect(loaded.status).toBe("blocked");
    expect(loaded.status === "blocked" && loaded.failures).toContain("schema:manifest.json");
  }, 20_000);
});
