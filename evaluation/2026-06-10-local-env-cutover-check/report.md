# Local Supabase Env Cutover Check

- generatedAt: 2026-06-10T06:43:34.574Z
- verdict: pass
- expectedRef: mewqgevgdgghhatqtuos
- oldRefPresent: false

## Ref Check

| Key | Ref | Result |
| --- | --- | --- |
| NEXT_PUBLIC_SUPABASE_URL | mewqgevgdgghhatqtuos | ok |
| SUPABASE_URL | mewqgevgdgghhatqtuos | ok |
| NEXT_PUBLIC_SUPABASE_ANON_KEY | mewqgevgdgghhatqtuos | ok |
| SUPABASE_SERVICE_ROLE_KEY | mewqgevgdgghhatqtuos | ok |

## Table Counts

| Table | Count | Status | Result |
| --- | ---: | ---: | --- |
| organizations | 4 | 206 | ok |
| sites | 6 | 206 | ok |
| workers | 5 | 206 | ok |
| workpacks | 5 | 206 | ok |
| education_records | 4 | 206 | ok |
| dispatch_logs | 6 | 206 | ok |
| daily_entries | 0 | 200 | ok |
| knowledge_events | 0 | 200 | ok |
| knowledge_regeneration_runs | 0 | 200 | ok |
| safety_reference_sources | 1063 | 206 | ok |
| safety_reference_items | 9920 | 206 | ok |
| safety_reference_ingestion_runs | 2 | 206 | ok |
| documents | 0 | 200 | ok |
| query_logs | 0 | 200 | ok |
| admin_users | 1 | 206 | ok |

## Decision

Codex-machine `.env.local` now points to `yellow-envelope-law`. Drop readiness gate 1 is complete; authenticated browser smoke and the 24-hour observation window remain.
