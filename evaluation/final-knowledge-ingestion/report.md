# Final knowledge ingestion report

- generated_at: 2026-05-03T11:13:27.734197+00:00
- db_mutation_applied: true
- schema_exists: true
- elapsed_ms: 10545
- exact_command: `python .\scripts\execute_safety_reference_upsert.py --payload 'evaluation\supabase-safety-ingestion-ready-2026-05-03\upsert-payload.json' --out-dir 'evaluation\final-knowledge-ingestion' --chunk-size 100`

## Initial Before Counts

- safety_reference_sources: 6
- safety_reference_items: 8431
- safety_reference_ingestion_runs: 1

## Retry Before Counts

- safety_reference_sources: 1063
- safety_reference_items: 8431
- safety_reference_ingestion_runs: 1

## After Counts

- safety_reference_sources: 1063
- safety_reference_items: 9920
- safety_reference_ingestion_runs: 2

## Net New Counts

- safety_reference_sources: 1057
- safety_reference_items: 1489
- safety_reference_ingestion_runs: 1

## Mutation Summary

- sources_upserted: 1062
- items_upserted: 1505
- ingestion_runs_inserted: 1
- success_count: 2568
- failure_count: 0
- operation: insert/upsert only; no delete; no migration

## First Attempt Note

- First attempt confirmed schema and partially upserted sources, then item upload failed on a NUL text character.
- Resolution: removed NUL characters from payload strings in-memory and reran the idempotent upsert. No delete, rollback, or schema change was applied.

## Verification

- rest_status_probe_ok: true
- rest_search_probe_ok: true
- rest_search_probe_count: 5
- app_api_status_ok: true
- app_api_status_items: 9920
- app_api_search_ok: true
- app_api_search_count: 5
