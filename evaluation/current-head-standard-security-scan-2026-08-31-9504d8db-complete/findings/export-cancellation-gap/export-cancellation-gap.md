# Public export work can outlive its distributed admission lease

- Severity: low
- Target: `9504d8db95fcbc9f37f6c5abc638e9ad0813a325`

## Summary

Export routes hold a 310-second lease but do not propagate request cancellation or enforce a shorter render deadline.

## Remediation

Propagate `request.signal`, abort render workers, and keep admission leased until termination is confirmed.

## Boundary

This is a source-backed finding. No DB, provider, Share-session, vector, Wiki, or KOSHA registry mutation was performed. Exact saved Share remains `MISSING_EVIDENCE`.

