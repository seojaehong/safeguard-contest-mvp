# Share Public Session Storage Approval Packet

- Generated: `2026-07-22T22:10:09.772Z`
- Source HEAD: `f66a8c5e9bb0ac74a0831f07cc6f2bd9af1ae6c6`
- Production `/api/build-info`: `f66a8c5e9bb0ac74a0831f07cc6f2bd9af1ae6c6`
- Verdict: `APPROVAL_REQUIRED_PUBLIC_SHARE_SESSION_STORAGE_MIGRATION_NO_MUTATION`
- Exact saved/generated `/share/[sessionId]`: `MISSING_EVIDENCE`

## Boundary

No DB mutation, schema migration, share-session creation, provider dispatch, or exact saved-session claim was performed by this packet.

The current read-only storage readiness check reports `PGRST205` for `public.workpack_share_sessions` and public missing-session GET status `404`. Exact saved/generated session geometry remains separate from fixture/layout proof.

## Approval Scope

Candidate migration:

- Path: `supabase/migrations/010_commercial_operations.sql`
- SHA-256: `54893129afae1d9d977acaef8f2ea62c06b1293207b8f62a429882432fc2bbe3`
- Size: `9359` bytes

This migration is broader than public share sessions. It also contains read confirmations, improvement memory tables, photo metadata, SIF/KOSHA embedding hooks, `vector` extension usage, and RLS policies. Operator review is required before applying or repairing production storage.

## Current Safe Options

- Keep exact saved/generated /share/[sessionId] geometry as MISSING_EVIDENCE.
- Measure a user-provided existing production /share/[sessionId]?workerId=... URL without creating or mutating a session.
- Refresh read-only live markers and no-mutation evidence.

## Blocked Without Approval

- Apply or repair public workpack_share_sessions storage in production.
- Refresh PostgREST schema cache after storage changes.
- Create a saved/generated production share session through POST /api/workpacks/[id]/share-sessions.
- Promote fixture or /workspace?share generated proof to exact saved-session proof.

## Acceptance After Approval

1. workpack_share_sessions is readable through the expected server storage path.
2. Missing public share-session URLs fail closed without a 5xx server-error shape.
3. A concrete saved-exact session URL or approved created session is measured at 1440x723, 1440x900, and 390x723.
4. Desktop saved-result geometry shows a non-mobile multi-pane workbench with no horizontal overflow.
5. Provider dispatch and unrelated DB mutations remain unclaimed unless separately approved.
