# Supporting Evidence

Finding ID: ``
Occurrence ID: ``

## Root Cause

Nullable tenant ownership is treated as a universal allow condition.

## Validation

Validated the attacker boundary, effective controls, counterevidence, and sink for Direct PostgREST dispatch_logs operation.

## Code Evidence

- `supabase/migrations/002_workspace_productization.sql:183-200`: Nullable tenant ownership is treated as a universal allow condition.