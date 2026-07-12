import { existsSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { loadKoshaGuideCorpus } from "@/lib/kosha-guide-corpus";
import { ACTUAL_KOSHA_ROOT } from "@/tests/helpers/kosha-offline-fixture";

describe("KOSHA v3 provenance gate", () => {
  it.skipIf(!existsSync(ACTUAL_KOSHA_ROOT))("accepts only the reviewed v3 snapshot identity", async () => {
    const loaded = await loadKoshaGuideCorpus({ rootDir: ACTUAL_KOSHA_ROOT });
    expect(loaded.status === "blocked" ? loaded.failures.join(", ") : loaded.status).toBe("ready");
    if (loaded.status !== "ready") return;
    expect(loaded.snapshotId).toBe("bb8dd542a0d8dc1ac37e330944bc24fcbfef6eea72e4afb106f96a9c19e63d51");
    expect(loaded.manifestSha256).toBe("f90262fc98c190243d80124b5e8711866d3372b3affef7d294c881ed194806d2");
    expect(loaded.records.every((record) => record.referenceId.startsWith("kosha-"))).toBe(true);
  }, 20_000);
});
