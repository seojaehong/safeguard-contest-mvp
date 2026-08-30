# Static Supporting Evidence

- Scan: `f218c713-1a1c-4f4e-9777-8095926be1df`
- Revision: `b5f145120766cd2ef904fce38ef32ed1a9facf74`
- Validation: static source-to-sink review
- Finding: Related object identifiers are not bound to the same tenant

## Reviewed Locations

- `supabase/migrations/002_workspace_productization.sql:21-90`
- `supabase/migrations/003_knowledge_runtime.sql:1-64`
- `supabase/migrations/010_commercial_operations.sql:21-95`

## Result

The parent validation confirmed the source crossing described in the write-up. No exploit execution or state mutation was required or performed.

## Boundary

Production grants and runtime reachability are limited exactly as stated in the finding. Exact saved Share remains `MISSING_EVIDENCE`.

