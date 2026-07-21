# SafeClaw KOSHA Current Live Gate

Generated at: 2026-07-21T22:11:06.135Z
Source HEAD at generation: 350f2d33111971b3e3148b57c6819299a474fdcc
Live commit at generation: 350f2d33111971b3e3148b57c6819299a474fdcc

Note: this artifact is generated before it is committed. The containing Git commit and deployed build must be verified through `git log` and `/api/build-info` after push.
Verdict: `pass_current_kosha_exact_trust_and_corpus_gate`
DB mutation performed: no

## Live Runtime Summary

- Catalog items: 9920
- KOSHA technical rows: 1040 (803 guides + 237 support regulations)
- Local corpus: ready, 234 items, 7127 chunks, 0 failures
- Exact registry: ready, 3 documents (D-C-13, D-C-7, B-E-10)

## Checks

| Check | Result | Detail |
| --- | --- | --- |
| build_info_configured | pass | Production build-info must identify a configured 40-character commit. |
| status_ready | pass | Safety reference status must be ready/searchReady. |
| catalog_total_ready | pass | Safety reference catalog must report 9,920 items. |
| technical_total_ready | pass | KOSHA technical corpus must report 1,040 technical rows. |
| technical_split_ready | pass | KOSHA technical split must remain 803 guides + 237 support regulations. |
| local_corpus_ready | pass | Local KOSHA corpus must be ready with 234+ items, 7,127+ chunks, and zero failures. |
| exact_registry_ready | pass | Exact KOSHA trust registry must be ready with no integrity failure. |
| exact_registry_count | pass | Exact KOSHA trust registry must load exactly three pinned documents. |
| exact_registry_required_keys | pass | Exact KOSHA keys must be D-C-13, D-C-7, B-E-10 only. |
| exact_registry_items_match_keys | pass | Exact trust registry item keys must match the required stable document keys. |

## Failed Check IDs

- None.

## Allowed Claims

- KOSHA technical corpus is live-ready for current retrieval/search status.
- Exact KOSHA evidence is limited to the pinned D-C-13, D-C-7, and B-E-10 documents.
- Metadata-verified KOSHA candidates remain supporting/review-required unless promoted through exact acquisition review.

## Forbidden Claims

- All 1,040 KOSHA technical materials are exact direct evidence.
- Any KOSHA candidate can be cited as mandatory legal proof without lifecycle/provenance review.
- Vector embedding retrieval is active before the approved SIF/KOSHA embedding migration/upload runtime gate.
