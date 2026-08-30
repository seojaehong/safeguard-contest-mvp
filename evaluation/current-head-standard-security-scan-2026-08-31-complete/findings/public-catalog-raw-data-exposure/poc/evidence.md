# Static Supporting Evidence

- Scan: `f218c713-1a1c-4f4e-9777-8095926be1df`
- Revision: `b5f145120766cd2ef904fce38ef32ed1a9facf74`
- Validation: static source-to-sink review
- Finding: Public catalog RLS exposes raw safety-reference and ingestion data

## Reviewed Locations

- `supabase/migrations/004_safety_reference_catalog.sql:1-45`
- `supabase/migrations/004_safety_reference_catalog.sql:58-72`

## Result

The parent validation confirmed the source crossing described in the write-up. No exploit execution or state mutation was required or performed.

## Boundary

Production grants and runtime reachability are limited exactly as stated in the finding. Exact saved Share remains `MISSING_EVIDENCE`.

