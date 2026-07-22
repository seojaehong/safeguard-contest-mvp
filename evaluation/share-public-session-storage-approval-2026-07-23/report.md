# Share Public Session Storage Approval Packet

- Generated: `2026-07-22T16:51:26.8677714Z`
- Source HEAD: `cc5422bace80ad8e98f83e02bc73fdda9217ea3c`
- Production `/api/build-info`: `cc5422bace80ad8e98f83e02bc73fdda9217ea3c`
- Verdict: `APPROVAL_REQUIRED_PUBLIC_SHARE_SESSION_STORAGE_MIGRATION_NO_MUTATION`
- Exact saved/generated `/share/[sessionId]`: `MISSING_EVIDENCE`

## Boundary

No DB mutation, schema migration, share-session creation, provider dispatch, or exact saved-session claim was performed by this packet.

The current blocker is storage-backed, not fixture-layout-only: read-only service-role probing reported `PGRST205` for `public.workpack_share_sessions`, with the message `Could not find the table 'public.workpack_share_sessions' in the schema cache`.

## Approval Scope

Candidate migration:

- Path: `supabase/migrations/010_commercial_operations.sql`
- SHA-256: `54893129afae1d9d977acaef8f2ea62c06b1293207b8f62a429882432fc2bbe3`
- Size: `9359` bytes

This migration is broader than public share sessions. It also contains read confirmations, improvement memory tables, photo metadata, SIF/KOSHA embedding hooks, `vector` extension usage, and RLS policies. Operator review is required before applying or repairing production storage.

## Current Safe Options

- Use an already existing user-provided production `/share/[sessionId]?workerId=...` URL and measure it read-only.
- Keep exact saved/generated Share as `MISSING_EVIDENCE`.
- Refresh read-only live markers and no-mutation reports.

## Blocked Without Approval

- Applying or repairing `workpack_share_sessions` storage in production.
- Refreshing PostgREST schema cache after storage changes.
- Creating a saved/generated production share session through `POST /api/workpacks/[id]/share-sessions`.
- Treating `/workspace?share` or fixture recipient proof as exact saved-session proof.

## Acceptance After Approval

1. `workpack_share_sessions` is readable through the expected server storage path.
2. Missing public share-session URLs fail closed without a 5xx server-error shape.
3. A concrete saved-exact session URL or approved created session is measured at `1440x723`, `1440x900`, and `390x723`.
4. Desktop saved-result geometry shows a non-mobile multi-pane workbench with no horizontal overflow.
5. Provider dispatch and unrelated DB mutations remain unclaimed unless separately approved.
