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

The body recovery artifact was not bundled directly. It was repackaged into the runtime `safeclaw-kosha-verified-subset/v1` contract with trusted `official_metadata_sha256` pinned in the generation policy.

Runtime verified subset:

- Runtime root: `data/safety-knowledge/kosha-guide-corpus`
- Runtime snapshot: `e99b7faf268c513c9eed329c016670339d686ba580141e54fe3ffdfafb478a12`
- Runtime manifest SHA-256: `e234586aa3f217acc701aca743eb70ab89448ac8de71e1eb61960e526cabefa5`
- Accepted items: `234`
- Rejected items: `0`
- Chunks: `7127`
- Official metadata SHA-256: `1c03af6776158ba21650325ea7b31f2a661d0adea9441d29aacf977e0c815a5f`

## Attempted Gate

I temporarily copied the body recovery corpus into `data/safety-knowledge/kosha-guide-corpus` and tried to make it the bundled default. The loader correctly returned `blocked`, not `ready`. That attempt was reverted and the copied data was removed.

This is the correct safety outcome: SafeClaw must not mark KOSHA local corpus search as ready by bypassing the provenance gate.

## Repackaging Result

The body recovery corpus was then converted through `scripts/build_kosha_verified_subset.py` with the official metadata artifact:

```powershell
python scripts\build_kosha_verified_subset.py --source-root "C:\Users\iceam\dev\safeguard-contest-mvp\.worktrees\northstar-kosha-official-metadata-20260715\output\kobr26\corpus" --official-metadata "data\safety-knowledge\kosha-official-metadata\official-metadata-2026-07-15.jsonl" --output-root "data\safety-knowledge\kosha-guide-corpus" --report "evaluation\kosha-runtime-corpus-repackaging-2026-07-18\verified-subset-build-report.json"
```

Result:

- `accepted_count=234`
- `rejected_count=0`
- `launch_ready=true`
- `subset_snapshot_id=e99b7faf268c513c9eed329c016670339d686ba580141e54fe3ffdfafb478a12`

## Current Verified Commands

After verified-subset repackaging:

```powershell
npm.cmd test -- tests\safety-reference-status-bundled-corpus.test.ts tests\kosha-guide-offline-harness.test.ts tests\kosha-guide-offline-harness-expanded.test.ts tests\safety-reference-status-route.test.ts tests\exact-trusted-kosha-registry-wave2.test.ts tests\exact-trusted-kosha-registry-wave3.test.ts tests\kosha-verified-subset-gate.test.ts
```

Result:

- Test files: `7 passed`
- Tests: `93 passed`

Python builder tests:

```powershell
python -m unittest scripts.tests.test_build_kosha_verified_subset
```

Result:

- Tests: `6 passed`

TypeScript and production build:

```powershell
npm.cmd run typecheck
npm.cmd run build
```

Result:

- Typecheck: PASS
- Build: PASS
- Static pages: `28/28`

Local production endpoint:

```powershell
npm.cmd run start -- -p 3017
curl.exe -s -i http://localhost:3017/api/safety-reference/status
```

Result:

- HTTP `200`
- `ok=true`
- `searchReady=true`
- `localCorpus.status=ready`
- `localCorpus.snapshotId=e99b7faf268c513c9eed329c016670339d686ba580141e54fe3ffdfafb478a12`
- `localCorpus.itemCount=234`
- `localCorpus.chunkCount=7127`
- `localCorpus.failureCount=0`

Next build trace:

- `.next/server/app/api/safety-reference/status/route.js.nft.json` includes `current.json`, `manifest.json`, `items.jsonl`, `chunks.jsonl`, and `failures.jsonl`.

## Launch Decision

The runtime KOSHA corpus is now locally launch-ready in the production build. Live production still needs deployment of the current commit before `www.safeclaw.kr/api/safety-reference/status` can be expected to return HTTP 200.

## Product Impact

For the imminent demo, the exact trusted KOSHA registry remains available through the three production-pinned exact references:

- `D-C-13-2026` exterior painting/repair work
- `D-C-7-2026` scaffold structure and safe work
- `B-E-10-2026` de-energized electrical work

The full KOSHA body recovery corpus should be described as the source artifact. The runtime product should claim only the verified subset: 234 current technical-support regulations with official metadata and hash provenance pinned.
