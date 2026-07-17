# KOSHA Runtime Corpus Repackaging Check

Generated: 2026-07-18

## Summary

The live `/api/safety-reference/status` degradation is not caused by an empty Supabase catalog. The live status body already reports the catalog split correctly (`items=9920`, `technicalTotal=1040`, `technicalSupportRegulations=237`, `technicalGuidelines=803`), but the runtime KOSHA local corpus is unconfigured.

A launch-ready body recovery artifact exists locally:

- Source artifact: `.worktrees/northstar-kosha-official-metadata-20260715/output/kobr26/corpus`
- Body snapshot: `935340ef3f74078c36168666650164c43511daced84efa3eda849833ad8d6844`
- Manifest SHA-256: `ab77251d0c95ce81d86470f1dbe19cdc18778dc5f6b32cde1b2d4f77bc427ab8`
- Body rows: `1039`
- Chunks: `20536`
- Failure ledger: `1`
- Body recovery report: `evaluation/kosha-official-body-recovery-2026-07-15/report.json`

However, this artifact is a full body recovery corpus, not a runtime-accepted verified subset. The current runtime loader requires the `safeclaw-kosha-verified-subset/v1` contract with trusted `official_metadata_sha256` pinned in the generation policy. The body recovery corpus manifest does not satisfy that runtime trust gate.

## Attempted Gate

I temporarily copied the body recovery corpus into `data/safety-knowledge/kosha-guide-corpus` and tried to make it the bundled default. The loader correctly returned `blocked`, not `ready`. That attempt was reverted and the copied data was removed.

This is the correct safety outcome: SafeClaw must not mark KOSHA local corpus search as ready by bypassing the provenance gate.

## Current Verified Commands

After reverting the unsafe bundling attempt:

```powershell
npm.cmd test -- tests\kosha-guide-offline-harness.test.ts tests\kosha-guide-offline-harness-expanded.test.ts tests\safety-reference-status-route.test.ts tests\exact-trusted-kosha-registry-wave2.test.ts tests\exact-trusted-kosha-registry-wave3.test.ts
```

Result:

- Test files: `5 passed`
- Tests: `81 passed`

With an external `KOSHA_GUIDE_CORPUS_DIR` pointed at the body recovery corpus, the older harness-focused subset also remains green:

```powershell
$env:KOSHA_GUIDE_CORPUS_DIR='C:\Users\iceam\dev\safeguard-contest-mvp\.worktrees\northstar-kosha-official-metadata-20260715\output\kobr26\corpus'
npm.cmd test -- tests\kosha-guide-offline-harness.test.ts tests\kosha-guide-offline-harness-expanded.test.ts tests\safety-reference-status-route.test.ts
```

Result:

- Test files: `3 passed`
- Tests: `37 passed`

That proves the artifact shape is close enough for many harness paths, but not enough for the stricter production trust gate.

## Launch Decision

Do not bundle the full body recovery corpus directly into production yet.

Required next step:

1. Repackage the 2026-07-15 body recovery output into a runtime `safeclaw-kosha-verified-subset/v1` corpus.
2. Include `official_metadata_sha256 = 1c03af6776158ba21650325ea7b31f2a661d0adea9441d29aacf977e0c815a5f`.
3. Set `trusted_metadata_registry_sha256` to the exact hash of the approved metadata registry.
4. Preserve the one boundary item as a failure ledger entry, or explicitly decide whether the production runtime allows partial-but-verified coverage.
5. Only after the loader returns `ready`, add narrow Next tracing for the runtime corpus files and prove `/api/safety-reference/status` returns HTTP 200.

## Product Impact

For the imminent demo, the exact trusted KOSHA registry remains available through the three production-pinned exact references:

- `D-C-13-2026` exterior painting/repair work
- `D-C-7-2026` scaffold structure and safe work
- `B-E-10-2026` de-energized electrical work

The full KOSHA corpus should be described as a prepared/recoverable corpus awaiting runtime trust repackaging, not as already live-ready in production.
