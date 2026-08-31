# Distributed admission trusts an unverified forwarded IP header

- Severity: low
- Target: `9504d8db95fcbc9f37f6c5abc638e9ad0813a325`

## Summary

`x-vercel-forwarded-for` is accepted before trusted Vercel ingress is established and becomes the distributed per-client key.

## Remediation

Only accept it under verified Vercel ingress; otherwise use trusted ingress identity or a conservative anonymous bucket.

## Boundary

This is a source-backed finding. No DB, provider, Share-session, vector, Wiki, or KOSHA registry mutation was performed. Exact saved Share remains `MISSING_EVIDENCE`.

