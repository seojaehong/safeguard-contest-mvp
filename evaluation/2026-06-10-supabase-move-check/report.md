# Supabase Move Check

- generatedAt: 2026-06-10T05:06:27.003Z
- projectRef: pleyuknjnprsckssxvrh
- verdict: pass_with_notice

## Summary

SafeClaw runtime-required Supabase tables are present and reachable through the current local environment.

The current code path does not query `admin_users` for `/api/workpacks`, `/api/dispatch-logs`, `/api/workers`, `/api/education-records`, or knowledge persistence routes. Those routes call `getWorkspaceUser()`, which validates the bearer token with Supabase Auth via `client.auth.getUser(token)`.

## Table Check

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

## Finding

`admin_users` is not a blocker for the current SafeClaw app code because no current source reference to `admin_users` was found under `app`, `lib`, `scripts`, or `supabase`.

The prior concern is resolved for the current target project: `admin_users` exists with 1 row in the active Supabase project. If another deployment environment still points to a different Supabase project, repeat this check against that environment's variables.

## Evidence

- JSON result: `evaluation/2026-06-10-supabase-move-check/supabase-live-table-check.json`
- Code auth model checked:
  - `lib/supabase-admin.ts`
  - `app/api/workpacks/route.ts`
  - `app/api/dispatch-logs/route.ts`
  - `app/api/workers/route.ts`
  - `app/api/education-records/route.ts`
  - `app/api/knowledge/ingest/route.ts`
  - `app/api/knowledge/regenerate/route.ts`
