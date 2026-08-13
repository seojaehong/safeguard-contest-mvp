# Supporting Evidence

Finding ID: ``
Occurrence ID: ``

## Root Cause

Site-binding validation and mutation are not atomic.

## Validation

Validated the attacker boundary, effective controls, counterevidence, and sink for POST /api/workers.

## Code Evidence

- `app/api/workers/route.ts:78-114`: Site-binding validation and mutation are not atomic.