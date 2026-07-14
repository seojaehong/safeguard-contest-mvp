# KOSHA Verified Subset Evaluation

## Verdict

- Authoritative repository base: `785f328e2804ba472a1d659d83ef4c3c89acf342`
- Source artifact: `kosha-corpus-body-recovery-2026-07-13-fixed-v1`
- Source snapshot: `976068bc0f060e177be0392323a2853cd43f145c6d294e7759bcb6374f411282`
- Subset snapshot: `3c4fe965bb713947568149c92c3c45d118e60f3d5426a9d5c4a9a25b764ae905`
- `launch_ready`: **false**
- Accepted: **0**
- Rejected: **234**

The fixed-v1 corpus is not promoted to current. The generated subset is immutable but intentionally non-deployable because no retained row-level official metadata artifact proves every required provenance field.

## Coverage Scope

The explicit scope is `technical-support-regulation-current-native`.

| Metric | Count |
| --- | ---: |
| Source inventory | 1,040 |
| `technical-support-regulation` | 237 |
| Current-unverified, native, successful extraction candidates | 234 |
| Version mismatch exclusions | 2 |
| B-E-3 boundary exclusion | 1 |
| Other out-of-scope rows | 803 |
| Accepted | 0 |
| Reject ledger | 234 |

All 234 candidates were rejected with `official-metadata-missing`. The generator requires official KOSHA URL, official file ID, publication date, matching official version, explicit current status, matching PDF SHA-256, and matching normalized body SHA-256. It does not infer these fields from `state`, title text, source filename, PDF body text, or corpus-level count parity.

## Evidence Boundary

The fixed-v1 manifest retains a corpus-level official list/API summary and current count/hash, but its own download boundary says item download URLs were absent. The repository's prior read-only audit also records official file ID and official publication date as missing for all 1,040 stored rows. Neither artifact is a row-level joinable official metadata ledger.

No DB, Supabase data, schema migration, Vercel environment, or status route was changed. No live DB read was used to fill gaps. The result therefore remains fail-closed instead of manufacturing provenance.

## Launch Gate

Loader `ready` is prohibited when any of these conditions holds:

- `launch_ready=false`
- failure ledger count is greater than zero
- coverage is partial or accepted count differs from candidate count
- provenance completeness is false
- coverage, manifest, and output counts disagree
- an accepted row lacks matching official URL/file ID/date/version/current status/PDF hash/body hash

The generated zero-proof subset is verified to return `blocked` with `gate:launch-not-ready`.

## Immutable Outputs

| Artifact | SHA-256 / size |
| --- | --- |
| `items.jsonl` | `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` / 0 bytes |
| `chunks.jsonl` | `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` / 0 bytes |
| `failures.jsonl` | `9ec1feefe9306f65529c3221382a1f7847f9a167c7a35a806504727b8384c7fe` / 151,012 bytes |
| Complete subset root | 153,988 bytes / 5 files |

Machine report: `report.json`
Generator log: `generator.log`
Schema validation log: `schema-validation.log`
Function size log: `function-size.log`

## Next Tracing Boundary

Because `launch_ready` is false, no repository-relative default and no Next output-file tracing rule was added. The production build baseline confirms the generated subset is not traced:

| Route | Route JS | Traced files | Traced bytes | Subset traced |
| --- | ---: | ---: | ---: | --- |
| `/api/safety-reference/search` | 7,423 | 55 | 1,217,181 | no |
| `/api/ask` | 11,190 | 71 | 2,889,041 | no |

Tracing and a repository-relative runtime default are a separate follow-up only after a non-empty subset passes the launch gate.

## Verification

- Focused fail-closed Vitest: 7 passed.
- All KOSHA Vitest files: 194 passed across 11 files.
- Python subset and corpus tests: 56 passed.
- TypeScript typecheck: passed.
- Next production build: passed.
- JSON Schema validation of generated current/manifest/reject ledger: passed.
