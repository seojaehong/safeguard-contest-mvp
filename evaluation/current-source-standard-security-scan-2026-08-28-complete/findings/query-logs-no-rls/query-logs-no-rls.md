# Query logs table is exposed without row-level security

**Severity:** Low

`query_logs` stores user query text without RLS or policies. Exposure depends on live grants, which were not probed.

## Evidence

- `supabase/migrations/001_init.sql:1-6`

## Remediation

Enable RLS and allow only narrowly scoped server inserts and authorized reads.
