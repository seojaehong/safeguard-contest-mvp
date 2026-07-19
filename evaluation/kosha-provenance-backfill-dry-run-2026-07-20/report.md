# KOSHA Provenance Backfill Dry Run

Generated: 2026-07-19T20:02:05.163Z
Source HEAD: `92a7ca8db08e957a9db69251dcf7ff334a27283d`

## Verdict

This is a zero-mutation dry run. It does not apply a DB migration, update Supabase rows, upload files, or promote additional KOSHA guides as authoritative evidence.

- Broad corpus rows: 1040
- Broad corpus authoritative launch-ready: false
- Broad missing provenance rows: 1040
- Broad empty body rows: 818
- Broad version/state drift rows: 8
- Broad tested retrieval reflection failures: 13
- Verified subset ready rows: 234
- Remaining rows requiring metadata/body/review work: 806

## Ready Scope

The ready scope is verified current technical-support-regulation subset only. The verified subset manifest is launch-ready for its own bounded scope and has 234 item rows / 7127 chunks with complete required provenance.

## Still Blocked Scope

technical-guideline rows, empty-body rows, version/state drift rows, and retrieval-reflection failures remain excluded from authoritative grounding

## Next Step

Generate per-item official metadata candidates for the remaining broad corpus rows and reconcile the broad local parse snapshot with the verified subset before any DB write.

## Verification Inputs

- broadAudit: `evaluation/kosha-guide-current-audit-2026-07-20/report.json`
- verifiedSubsetCurrent: `data/safety-knowledge/kosha-guide-corpus/current.json`
- verifiedSubsetManifest: `data/safety-knowledge/kosha-guide-corpus/snapshots/e99b7faf268c513c9eed329c016670339d686ba580141e54fe3ffdfafb478a12/manifest.json`
- officialMetadata: `data/safety-knowledge/kosha-official-metadata/official-metadata-2026-07-15.jsonl`

## Sample Ready Rows

| stable key | official version | publication | file id | status |
| --- | --- | --- | --- | --- |
| D-C-1 | D-C-1-2025 | 2025-03-26 | FL00021380545 | current |
| D-C-10 | D-C-10-2026 | 2026-01-30 | CTC2026012914313984348485 | current |
| D-C-11 | D-C-11-2026 | 2026-01-30 | CTC2026012914341697414755 | current |
| D-C-12 | D-C-12-2026 | 2026-01-30 | CTC2026012914355740302531 | current |
| D-C-13 | D-C-13-2026 | 2026-01-30 | CTC2026012914371557826167 | current |
| D-C-14 | D-C-14-2026 | 2026-01-30 | CTC2026012914380154825946 | current |
| D-C-15 | D-C-15-2026 | 2026-01-30 | CTC2026012914392397572332 | current |
| D-C-2 | D-C-2-2025 | 2025-03-26 | FL00021380583 | current |
