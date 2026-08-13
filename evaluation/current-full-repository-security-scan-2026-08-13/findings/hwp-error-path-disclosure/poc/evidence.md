# Supporting Evidence

Finding ID: ``
Occurrence ID: ``

## Root Cause

Internal initialization diagnostics are reused as public error text.

## Validation

Validated the attacker boundary, effective controls, counterevidence, and sink for POST /api/export/hwp.

## Code Evidence

- `app/api/export/hwp/route.ts:49-64`: Internal initialization diagnostics are reused as public error text.