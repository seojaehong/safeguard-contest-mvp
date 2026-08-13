# Supporting Evidence

Finding ID: ``
Occurrence ID: ``

## Root Cause

RLS grants broad mutation instead of server-enforced transitions and immutable review evidence.

## Validation

Validated the attacker boundary, effective controls, counterevidence, and sink for Direct knowledge table updates.

## Code Evidence

- `supabase/migrations/003_knowledge_runtime.sql:94-126`: RLS grants broad mutation instead of server-enforced transitions and immutable review evidence.