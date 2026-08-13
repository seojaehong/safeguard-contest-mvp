# Atomic database race approval boundary

## Verdict

`APPROVAL_REQUIRED_TRANSACTIONAL_DB_RACE_REMEDIATION_NO_MUTATION`

The sealed post-remediation scan contains two low-severity race findings that cannot be closed honestly with an application-only mutex or retry. Both invariants are database-wide and include service-role paths outside one API process.

## MCP token active cap

The MCP token route counts active rows and inserts separately. The operator CLI also inserts directly. The minimum complete control is a per-site database lock that guards insert and activation updates using the same active-token predicate. Rejection must return a stable conflict without exposing the plaintext token.

## Worker site binding

The worker route looks up existing site bindings and later upserts a complete batch. Concurrent first writes can both pass the lookup. The minimum complete control is a service-role-only transactional batch RPC that never updates `site_id` on conflict and rolls back the full batch when any existing binding differs.

## Approval boundary

No migration was authored or applied. No database row, Share session, provider, vector, wiki, or KOSHA registry was mutated. Implementing these controls requires explicit approval for migration/RPC/trigger work and temporary database concurrency tests.

The immutable scan findings remain open until the approved implementation, database integration evidence, deployment verification, and a fresh security scan are complete. Exact saved `/share/[sessionId]` remains `MISSING_EVIDENCE`.
