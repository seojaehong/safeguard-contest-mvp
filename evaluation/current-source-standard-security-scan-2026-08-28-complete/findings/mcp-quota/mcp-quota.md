# MCP token quota uses a check-then-insert race

**Severity:** Low

The route counts active tokens and inserts a new token in separate statements, so concurrent requests can exceed the site quota.

## Remediation

Reserve quota atomically with a lock, transaction, or constraint-backed function.
