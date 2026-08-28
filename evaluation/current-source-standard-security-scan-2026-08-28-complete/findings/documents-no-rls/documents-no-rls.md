# Documents table is exposed without row-level security

**Severity:** Medium

The canonical `documents` table stores full document content, but no canonical migration enables row-level security or defines a policy. If browser roles receive table grants, document bodies and source metadata can cross the intended authorization boundary.

## Evidence

- `supabase/migrations/001_init.sql:8-17`
- No later canonical migration enables RLS for `documents`.

## Remediation

Enable RLS, define least-privilege policies, and verify anonymous/authenticated grants before exposing the table through Supabase REST.
