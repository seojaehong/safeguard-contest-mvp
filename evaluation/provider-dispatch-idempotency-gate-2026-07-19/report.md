# Provider Dispatch Idempotency Gate

Generated at: 2026-07-19 KST

## Purpose

Live provider dispatch is intentionally preview-only until SafeClaw can prove a persistent duplicate-prevention contract.

This gate prepares the approval packet for that contract without applying a migration or sending any provider message.

## Current Live State

Live `/api/workflow/dispatch` returns:

- `capability=false`
- `mode=preview_only`
- `reason=persistent_idempotency_unavailable`

The route keeps real provider dispatch locked with `PROVIDER_DISPATCH_IDEMPOTENCY_SUPPORTED=false`.

## Drafted Approval Artifact

- `evaluation/provider-dispatch-idempotency-gate-2026-07-19/provider-dispatch-idempotency-draft.sql`

The draft creates `provider_dispatch_attempts` as a server-side reservation table:

- unique `(organization_id, idempotency_key)` gate
- workpack and share-session ownership checks
- required tenant tuple: `organization_id`, `site_id`, `workpack_id`, and `share_session_id`
- provider call state: `reserved`, `provider_called`, `accepted`, `failed`, `uncertain`
- `provider_called` and `request_hash` fields for retry safety
- RLS enabled and forced
- owner-scoped SELECT/INSERT/UPDATE policies
- no nullable organization branch, no `FOR ALL`, and no owner DELETE policy

This explicitly avoids the legacy `dispatch_logs` anti-patterns identified in the Supabase RLS audit: null-organization reachability, broad owner `FOR ALL`, and child rows that do not prove same-tenant relationships.

## Required Before Enabling Live Dispatch

1. User approves the migration scope.
2. Migration is applied to the target Supabase project.
3. Runtime probe confirms table, unique index, forced RLS, policies, and cross-tenant negative cases.
4. Route changes reserve the idempotency key before calling the provider.
5. Route changes treat duplicate keys as an existing attempt, not a new provider call.
6. Provider dry run proves webhook idempotency and retry behavior without unintended real messages.
7. Only after those gates should `PROVIDER_DISPATCH_IDEMPOTENCY_SUPPORTED` become true.

## Non-Actions

- No DB migration was applied.
- No Supabase data was inserted, updated, or deleted.
- No provider message was sent.
- Preview-only behavior remains the live product state.

## Verification

- `npm.cmd test -- tests\provider-dispatch-idempotency-gate.test.ts --maxWorkers=1 --fileParallelism=false`: PASS, 1 file / 6 tests.
- `npm.cmd run typecheck`: PASS.
