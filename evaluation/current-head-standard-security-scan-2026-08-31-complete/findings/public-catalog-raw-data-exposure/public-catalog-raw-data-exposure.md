# Public catalog RLS exposes raw safety-reference and ingestion data

- Severity: medium
- Confidence: medium
- Rule: `information-exposure.raw-corpus`
- Target revision: `b5f145120766cd2ef904fce38ef32ed1a9facf74`

## Summary

using(true) SELECT policies expose raw bodies, payloads, source paths, report paths, and ingestion details instead of the bounded reviewed application projection.

## Code Evidence

- `supabase/migrations/004_safety_reference_catalog.sql:1-45`
- `supabase/migrations/004_safety_reference_catalog.sql:58-72`

## Attack Path

using(true) SELECT policies expose raw bodies, payloads, source paths, report paths, and ingestion details instead of the bounded reviewed application projection.

- Impact: medium
- Likelihood: unknown

## Limitations

- Effective production grants and deployed row classification were not inspected.

## Remediation

Approval-gated: remove anonymous raw-table SELECT, publish a bounded reviewed view or RPC, and keep ingestion metadata service-role-only.

## Scan Boundaries

No database, provider, Share-session, vector, Wiki, or KOSHA registry mutation was performed. Exact saved Share remains `MISSING_EVIDENCE`. Approval-gated deployment and database claims remain unverified.

