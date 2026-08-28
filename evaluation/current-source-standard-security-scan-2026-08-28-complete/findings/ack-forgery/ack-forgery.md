# Tenant owners can directly forge worker read confirmations

**Severity:** Low

Direct writes can choose the worker snapshot, confirmation method, and timestamp without proving a recipient interaction.

## Remediation

Use a trusted, session-bound, idempotent confirmation function.
