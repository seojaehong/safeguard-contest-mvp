# Export smoke chain accepts unbounded responses and lacks subprocess deadlines

- Severity: low
- Target: `9504d8db95fcbc9f37f6c5abc638e9ad0813a325`

## Summary

Operator smoke helpers fully materialize responses and invoke Chrome or child processes without byte ceilings or deadlines.

## Remediation

Add AbortSignal deadlines, response byte ceilings, process timeouts, termination, and temp cleanup.

## Boundary

This is a source-backed finding. No DB, provider, Share-session, vector, Wiki, or KOSHA registry mutation was performed. Exact saved Share remains `MISSING_EVIDENCE`.

