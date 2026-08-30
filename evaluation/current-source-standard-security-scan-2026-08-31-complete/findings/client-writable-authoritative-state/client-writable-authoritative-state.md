# Tenant-writable rows can forge authoritative workflow evidence

**Severity:** low  
**Confidence:** high  
**Rule:** `authorization-bypass.client-writable-authoritative-state`  
**Taxonomy:** CWE-863

## Summary

Broad owner FOR ALL policies allow direct setting of Share-session, acknowledgement, provider receipt, improvement approval, and knowledge review fields treated as authoritative by application workflows.

## Attack path

Broad owner FOR ALL policies allow direct setting of Share-session, acknowledgement, provider receipt, improvement approval, and knowledge review fields treated as authoritative by application workflows.

## Evidence

- `supabase/migrations/002_workspace_productization.sql:183-200`
- `supabase/migrations/003_knowledge_runtime.sql:94-126`
- `supabase/migrations/010_commercial_operations.sql:161-227`

## Validation boundary

Application routes are fail-closed; direct exploitation requires table DML grants and does not prove exact saved Share.

The scan performed no database, provider, Share-session, vector, wiki, or KOSHA registry mutation. Exact saved Share remains MISSING_EVIDENCE.

## Remediation

Revoke client mutation of authoritative fields and expose narrow server-only transactional transitions with immutable provenance.
