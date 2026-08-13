# Supporting Evidence

Finding ID: ``
Occurrence ID: ``

## Root Cause

Related-object tenant binding is absent in RLS and omitted from the public idempotency lookup.

## Validation

Validated the attacker boundary, effective controls, counterevidence, and sink for Direct PostgREST insert plus public acknowledgement.

## Code Evidence

- `app/api/share-sessions/[sessionId]/route.ts:232-256`: Related-object tenant binding is absent in RLS and omitted from the public idempotency lookup.