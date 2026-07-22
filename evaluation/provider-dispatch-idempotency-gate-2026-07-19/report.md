# Provider Dispatch Idempotency Gate

Generated at: 2026-07-19 KST

Current refresh: 2026-07-22T23:48:04.078Z

Source marker for approval packet wiring: `5891ddcd07c5ddd598129de0ce33b73391d90a1d`

## Purpose

Live provider dispatch is intentionally preview-only until SafeClaw can prove a persistent duplicate-prevention contract.

This gate prepares the approval packet for that contract without applying a migration or sending any provider message.

## Current Live State

Live `/api/workflow/dispatch` returns:

- `capability=false`
- `mode=preview_only`
- `reason=persistent_idempotency_unavailable`

The route keeps real provider dispatch locked with `PROVIDER_DISPATCH_IDEMPOTENCY_SUPPORTED=false`.

Current production marker at refresh: `5891ddcd07c5ddd598129de0ce33b73391d90a1d`.

## Drafted Approval Artifact

- `evaluation/provider-dispatch-idempotency-gate-2026-07-19/provider-dispatch-idempotency-draft.sql`

The draft creates `provider_dispatch_attempts` as a server-side reservation table:

- unique `(organization_id, idempotency_key)` gate
- workpack and share-session ownership checks
- required tenant tuple: `organization_id`, `site_id`, `workpack_id`, and `share_session_id`
- provider call state: `reserved`, `provider_called`, `accepted`, `failed`, `uncertain`
- `provider_called` and `request_hash` fields for retry safety
- RLS enabled and forced
- `updated_at` trigger included in the draft
- owner-scoped SELECT/INSERT/UPDATE policies
- no nullable organization branch, no `FOR ALL`, and no owner DELETE policy

This explicitly avoids the legacy `dispatch_logs` anti-patterns identified in the Supabase RLS audit: null-organization reachability, broad owner `FOR ALL`, and child rows that do not prove same-tenant relationships.

## Scope Boundary

This draft is an attempt-level reservation slice. It does not yet prove channel-level exactly-once result persistence.

The current draft stores `channels text[]` and `provider_result jsonb` on one attempt row. Before claiming channel-level exactly-once persistence, a later approved route/migration design must do one of the following:

1. Add a `provider_dispatch_attempt_channels` child table with a unique `(attempt_id, channel)` or `(organization_id, idempotency_key, channel)` contract.
2. Explicitly define `provider_result` JSONB as the canonical per-channel ledger and add route tests proving reservation-before-provider-call, duplicate replay behavior, and per-channel result retention.

`updated_at` is present and the draft includes `provider_dispatch_attempts_set_updated_at`. A later applied migration must still verify the trigger exists in the target Supabase project and that route status updates preserve `updated_at` ownership.

## Required Before Enabling Live Dispatch

1. User approves the migration scope.
2. Migration is applied to the target Supabase project.
3. Runtime probe confirms table, unique index, forced RLS, policies, and cross-tenant negative cases.
4. Route changes reserve the idempotency key before calling the provider.
5. Route changes treat duplicate keys as an existing attempt, not a new provider call.
6. Route/migration design proves channel-level result persistence through a child table or canonical JSONB ledger tests.
7. Provider dry run proves webhook idempotency and retry behavior without unintended real messages.
8. Only after those gates should `PROVIDER_DISPATCH_IDEMPOTENCY_SUPPORTED` become true.

## Non-Actions

- No DB migration was applied.
- No Supabase data was inserted, updated, or deleted.
- No provider message was sent.
- Preview-only behavior remains the live product state.

## Verification

- `npm.cmd test -- tests\provider-dispatch-idempotency-gate.test.ts tests\workflow-dispatch-capability-policy.test.ts tests\workflow-share-client.test.ts tests\workflow-share-capability-browser.test.ts --maxWorkers=1 --fileParallelism=false --testTimeout=90000 --hookTimeout=180000`: PASSED, 4 files / 44 tests.
- Live `GET https://www.safeclaw.kr/api/workflow/dispatch`: PASSED, `preview_only`, reason `persistent_idempotency_unavailable`, email/SMS/Kakao capabilities: email=`false`, sms=`false`, kakao=`false`.
