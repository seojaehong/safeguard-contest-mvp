# SafeClaw Launch Approval Boundary

Generated: 2026-07-25 KST

Source of truth:

- Current source/branch/master/production marker: `0053cd8d47e50121a48c257ba627599f12de0bd4`
- Northstar open gates: `evaluation/northstar-open-gates-current/report.json`
- Northstar next runway: `evaluation/northstar-next-runway-current-2026-07-22/report.json`

## Current closed surface

The approval-free product and evidence surface is currently closed for the following gates:

- Live harness quality
- Document quality grounding
- Live document quality matrix
- Live document quality stress matrix
- Live document field isolation
- Live KOSHA exact materialization
- Six-document wording review
- Twelve-deliverable broad review
- Six-secondary-document scenario grounding
- Documents/share cockpit geometry
- Dispatch standalone cockpit
- Share result fixture cockpit
- Share recipient long-content fixture
- KOSHA exact trust registry

These gates are proven in current Northstar evidence. They must not be used to claim the approval-gated items below.

## Remaining launch boundaries

### final_99_gate

State: `notice`

Why it remains open:

- Final-99 currently carries auth-history and dispatch-policy notices.
- Fully automated launch readiness is not proven until admin-auth save/reopen and approved provider dispatch are executed in a secure environment.
- Full final-99 rerun is not treated as no-approval cleanup when `SAFEGUARD_AUTH_TOKEN` is configured.

What would close it:

- Approved admin-auth live save/reopen canary.
- Approved provider dispatch canary.
- Fresh final-99 report that records those approvals and results without hiding the notices.

Do not do without approval:

- Do not rerun full final-99 as a no-approval task if it can use configured auth.
- Do not claim full launch automation from current notice state.

### share_exact_saved_session_boundary

State: `notice`

Why it remains open:

- Exact saved/generated `/share/[sessionId]` user-session geometry is still `MISSING_EVIDENCE`.
- Fixture or generated `/workspace` Share proof is explicitly not accepted as saved-session proof.
- Public share storage readiness is blocked by `PGRST205` for `workpack_share_sessions` visibility in the PostgREST schema cache.

What would close it:

- A concrete production `/share/[sessionId]?workerId=...` URL from a valid saved session, or an explicitly approved safe creation flow.
- Desktop 1440x723, desktop 1440x900, and mobile 390x723 geometry rerun with `sessionKind=saved-exact`.
- Metrics must include root width ratio, x-region count, first action, preview/status visibility, and overflow.

Do not do without approval:

- Do not call `POST /api/workpacks/[id]/share-sessions` because that inserts `workpack_share_sessions`.
- Do not treat missing-session fail-closed or invalid-id fail-closed as exact saved-session proof.

### share_recipient_ack_approval

State: `approval_gated`

Why it remains open:

- The route/test preflight is operator-ready.
- A real production invited-recipient ACK canary would create `workpack_share_sessions` and `workpack_read_confirmations` rows.

What would close it:

- Explicit live-data mutation approval for a disposable workpack/worker ACK canary.
- Production readback proving share-session creation and read-confirmation insertion.

Do not do without approval:

- Do not create a real ACK canary.
- Do not claim invited-recipient ACK readback from mocked or fixture-only evidence.

### provider_dispatch_persistence

State: `approval_gated`

Why it remains open:

- Provider dispatch remains preview-only.
- Attempt-level idempotency reservation draft exists, but per-channel result persistence and exactly-once behavior are not approved or proven.
- No migration, DB mutation, provider send, or live unlock has occurred.

What would close it:

- Approved provider-result persistence design: either a per-channel child table or tested canonical `provider_result` JSONB ledger.
- Approved route-level reservation-before-provider-call test.
- Duplicate replay behavior test.
- Target project verification for `provider_dispatch_attempts_set_updated_at` before live dispatch enablement.

Do not do without approval:

- Do not set `PROVIDER_DISPATCH_IDEMPOTENCY_SUPPORTED=true`.
- Do not send live provider messages.
- Do not apply dispatch persistence migrations.

### supabase_rls_launch_isolation

State: `approval_gated`

Why it remains open:

- Read-only RLS approval preflight passed, but live RLS catalog and tenant A/B isolation are not proven.

What would close it:

- Approval of authoritative project and credential provenance.
- Read-only live catalog capture.
- Disposable tenant A/B negative tests before production migration claims.

Do not do without approval:

- Do not mutate production schema or tenant data.
- Do not claim RLS launch isolation from source-only preflight.

### llm_wiki_publication

State: `approval_gated`

Why it remains open:

- Candidate/wiki surfaces exist.
- Publication RPC, RLS, and append-only ledger approval are not complete.

What would close it:

- Approval of final DDL, append-only ledger, graph pointer, and RPC threat model.
- Approved isolated-project publication canary.
- Human confirmation before generated wiki candidates are published.

Do not do without approval:

- Do not publish generated wiki candidates.
- Do not run publication RPC canaries in production.

### sif_embedding_runtime

State: `approval_gated`

Why it remains open:

- SIF corpus is ready for approval with 6,032 records.
- Embedding generation, upload, and vector runtime remain held.

What would close it:

- Separate approval for SIF-only migration.
- Separate approval for embedding cost.
- Separate approval for upload and vector runtime enablement.
- Post-migration verification proving vector retrieval is production-active.

Do not do without approval:

- Do not generate embeddings.
- Do not upload vector data.
- Do not claim production vector retrieval.

### kosha_exact_promotion_review_gate

State: `approval_gated`

Why it remains open:

- The review template covers 8 KOSHA candidates and is blocked by default.
- Exact promotion still requires completed human review and separate approval.
- Current contract audit confirms shallow human-confirmation-only reviews are blocked.

What would close it:

- Completed generated KOSHA review template with reviewer, reviewedAt, humanConfirmed, and every required check.
- Fresh `scripts/kosha_exact_promotion_review_gate.mjs` run on completed review input.
- Separate explicit approval before writing exact-trust registry changes.

Do not do without approval:

- Do not mutate the exact-trust registry.
- Do not accept shallow human confirmation as a completed review.

## Recommended next approval order

1. Saved Share storage and exact saved-session geometry.
2. Recipient ACK canary.
3. Provider dispatch persistence and live dispatch canary.
4. RLS live tenant isolation.
5. LLM wiki publication canary.
6. SIF embedding runtime.
7. KOSHA exact promotion.

The first three close the most user-visible last-mile product claims. The latter four close trust, retrieval, and governance depth.

