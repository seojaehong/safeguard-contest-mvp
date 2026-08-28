# Worker site-binding check races with upsert

**Severity:** Low

Existing site bindings are read and later upserted separately. Concurrent requests can invalidate the route's transfer-required decision.

## Remediation

Enforce the site-binding invariant in an atomic database operation.
