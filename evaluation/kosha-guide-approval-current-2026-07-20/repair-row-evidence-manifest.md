# KOSHA Guide Repair Row Evidence Manifest

Generated at: 2026-07-20T07:54:22.544Z

Decision: `row_level_evidence_complete_for_review`

This is a read-only manifest. It documents evidence coverage only and does not authorize DB mutation, upload, or embedding generation.

## Row Set Inventory

| Workstream | Evidence mode | Source count | Rows available | Row-level complete | Missing row manifest | Next artifact |
| --- | --- | ---: | ---: | --- | ---: | --- |
| `provenance_and_status_backfill_dry_run` | row_level_complete | 1,040 | 1,040 | yes | 0 | - |
| `body_hydration_or_ocr_review` | row_level_complete | 818 | 818 | yes | 0 | - |
| `summary_regeneration` | row_level_complete | 822 | 822 | yes | 0 | - |
| `version_state_reconciliation` | row_level_complete | 8 | 8 | yes | 0 | - |
| `control_causality_review` | row_level_complete | 71 | 71 | yes | 0 | - |
| `retrieval_branch_observation` | scenario_branch_level_complete | 8 | 8 | yes | 0 | - |

## Incomplete Workstreams

| Workstream | Source count | Rows available now | Missing rows | Required next artifact |
| --- | ---: | ---: | ---: | --- |
| - | - | - | - | - |

## Approval Gate

- Mutation allowed by this run: false
- Embedding allowed by this run: false
- Blocker: Do not mutate Supabase rows or generate embeddings until every count-only workstream has a reviewed per-row manifest.
