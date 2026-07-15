# KOSHA Official Metadata Trust-Boundary Remediation

## Scope

This remediation keeps the trusted production registry empty while strengthening the read-only promotion boundary. It performs no database, schema, or environment mutation.

## Closed review findings

- The pinned body-corpus snapshot is now verified from its manifest source identity, generation policy, declared output files, reproducibility hash, and immutable snapshot directory name.
- Live collection refreshes official API pages by default. Cache reuse is opt-in, timestamped, and bounded by an explicit maximum age.
- Every official row must belong to the requested KOSHA category before it can enter reconciliation or promotion.
- Category `totalCount`, raw rows, normalized rows, unique stable keys, and duplicate counts remain fail-closed.

## Fresh live result

- Source snapshot: `976068bc0f060e177be0392323a2853cd43f145c6d294e7759bcb6374f411282`
- Promotion snapshot: `c10572ee3531d9c66ca455265bf0d599f5eae5b01b8113daaa71ad5f9012a129`
- Official rows: `1,039`
- Candidate body records: `234`
- Exact official PDF matches: `212`
- Official PDF hash mismatches: `22`
- Page shards: `13`
- Launch ready: `false`
- Trusted registry populated: `false`

The remaining 22 mismatches are intentionally retained in `failures.jsonl`. They require a new official-PDF body recovery snapshot and cannot be waived by this metadata promotion step.

## Verification

- Python unit tests: 14 passed
- KOSHA Vitest gates: 2 files, 119 tests passed
- Strict TypeScript typecheck: passed
- Live official collection: completed with exit code 2, the expected fail-closed result while mismatches remain
- Live execution log: `remediation-live-run.log`
