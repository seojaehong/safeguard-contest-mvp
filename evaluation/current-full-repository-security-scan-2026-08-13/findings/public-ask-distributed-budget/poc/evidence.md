# Supporting Evidence

Finding ID: ``
Occurrence ID: ``

## Root Cause

Production distributed admission is optional for public Ask rate and weighted provider leases.

## Validation

Validated the attacker boundary, effective controls, counterevidence, and sink for POST /api/ask and POST /api/ask/stream.

## Code Evidence

- `lib/public-ask-admission.ts:27-69`: Production distributed admission is optional for public Ask rate and weighted provider leases.