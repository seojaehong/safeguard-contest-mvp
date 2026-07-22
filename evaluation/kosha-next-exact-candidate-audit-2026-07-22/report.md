# KOSHA Next Exact Candidate Audit

Generated at: 2026-07-22T00:14:18.056Z

Verdict: `NEXT_EXACT_TRUST_CANDIDATES_IDENTIFIED_APPROVAL_FREE`

This is a read-only audit. It did not perform DB mutation, embedding generation, upload, provider dispatch, or new KOSHA network acquisition.

## Current Boundary

The current exact KOSHA trust registry is proven for 3 pins only:

- `B-E-10-2026`
- `D-C-13-2026`
- `D-C-7-2026`

This remains enough to claim the accepted exact-trust slice. It is not enough to claim that every KOSHA Guide row is exact direct evidence.

## Candidate Pool

| Item | Count |
| --- | ---: |
| Source inventory | 1040 |
| Current native technical-support regulation subset | 234 |
| Generated chunks | 7127 |
| Snapshot failures | 0 |
| Out of scope rows | 806 |
| Existing exact pins | 3 |
| Metadata-verified non-exact candidates | 231 |

Subset properties:

- scope: `technical-support-regulation-current-native`
- body kind: `native`
- official status: `current`
- provenance complete: true
- network calls: false
- OCR: false
- DB mutation: false

## Metadata Coverage

`data\safety-knowledge\kosha-official-metadata\official-metadata-2026-07-15.jsonl` contains 234 complete current metadata rows.

| Category | Complete current rows |
| --- | ---: |
| A | 23 |
| B | 59 |
| C | 93 |
| D | 15 |
| E | 44 |

Sample non-exact candidates:

| Stable key | Version | Category | Published | File ID |
| --- | --- | --- | --- | --- |
| A-G-1 | A-G-1-2025 | A | 2025-03-26 | FL00021379766 |
| A-G-10 | A-G-10-2025 | A | 2025-03-26 | FL00021380042 |
| A-G-11 | A-G-11-2025 | A | 2025-03-26 | FL00021380051 |
| A-G-12 | A-G-12-2026 | A | 2026-01-30 | CTC2026012909222643246624 |
| A-G-13 | A-G-13-2026 | A | 2026-01-30 | CTC2026012909351050697115 |

These rows are not exact production evidence yet. They are next-promotion candidates.

## Required Before Promotion

1. Select a bounded candidate set from the metadata-verified non-exact current native rows.
2. Persist exact-kosha reference JSON only after immutable body/pdf/provenance hashes are reviewed and matched to official URL, file ID, version, publication date, and stable key.
3. Add registry tests proving each new pin fails closed on stale version, hash mismatch, missing lifecycle, missing human confirmation, and metadata contradiction.
4. Run exact-trusted grounding, KOSHA current live gate, North Star open-gate audit, and launch-readiness boundary tests after promotion.
5. Keep KOSHA Guide vector/embedding/runtime claims separate until approved SIF/KOSHA vector gates are executed.

## Safe Claims

- KOSHA exact trust is current and proven for the accepted 3-pin slice.
- A 234-item current native technical-support regulation subset is reproducible and complete as a candidate pool.
- Additional exact pins can be proposed from the verified subset, but only after separate immutable acquisition/review.

## Forbidden Claims

- All 1,040 KOSHA Guide rows are exact direct evidence.
- The metadata-verified non-exact candidates are already exact production evidence.
- KOSHA Guide embeddings or vector retrieval are production-active.
- This audit performed DB mutation, embedding generation, upload, or provider dispatch.
