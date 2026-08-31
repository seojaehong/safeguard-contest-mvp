# Credential issuance CLIs print bearer tokens to stdout

- Severity: low
- Target: `9504d8db95fcbc9f37f6c5abc638e9ad0813a325`

## Summary

MCP and Supabase issuance scripts print full bearer tokens where terminal capture, wrappers, or CI logs can retain them.

## Remediation

Default to metadata only; require explicit TTY reveal or permission-restricted credential output.

## Boundary

This is a source-backed finding. No DB, provider, Share-session, vector, Wiki, or KOSHA registry mutation was performed. Exact saved Share remains `MISSING_EVIDENCE`.

