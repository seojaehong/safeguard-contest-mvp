# KOSHA Guide Repair Row Evidence Manifest

Generated at: 2026-07-20T07:43:38.242Z

Decision: `row_level_evidence_incomplete_before_mutation_or_embedding`

This is a read-only manifest. It documents evidence coverage only and does not authorize DB mutation, upload, or embedding generation.

## Row Set Inventory

| Workstream | Evidence mode | Source count | Rows available | Row-level complete | Missing row manifest | Next artifact |
| --- | --- | ---: | ---: | --- | ---: | --- |
| `provenance_and_status_backfill_dry_run` | count_only | 1,040 | 0 | no | 1,040 | official-provenance-backfill-row-manifest.json |
| `body_hydration_or_ocr_review` | count_only | 818 | 0 | no | 818 | body-hydration-ocr-row-manifest.json |
| `summary_regeneration` | group_sample | 822 | 33 | no | 789 | source-grounded-summary-row-manifest.json |
| `version_state_reconciliation` | row_level_complete | 8 | 8 | yes | 0 | - |
| `control_causality_review` | row_level_complete | 71 | 71 | yes | 0 | - |
| `retrieval_branch_observation` | scenario_branch_level_complete | 8 | 8 | yes | 0 | - |

## Incomplete Workstreams

| Workstream | Source count | Rows available now | Missing rows | Required next artifact |
| --- | ---: | ---: | ---: | --- |
| `provenance_and_status_backfill_dry_run` | 1,040 | 0 | 1,040 | official-provenance-backfill-row-manifest.json |
| `body_hydration_or_ocr_review` | 818 | 0 | 818 | body-hydration-ocr-row-manifest.json |
| `summary_regeneration` | 822 | 33 | 789 | source-grounded-summary-row-manifest.json |

## Approval Gate

- Mutation allowed by this run: false
- Embedding allowed by this run: false
- Blocker: Do not mutate Supabase rows or generate embeddings until every count-only workstream has a reviewed per-row manifest.
