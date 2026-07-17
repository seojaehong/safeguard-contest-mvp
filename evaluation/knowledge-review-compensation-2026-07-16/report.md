# Knowledge Review Compensation P2

## Scope

- Worktree: `C:\Users\iceam\dev\safeguard-contest-mvp\.worktrees\knowledge-review-compensation`
- Branch: `fix/knowledge-review-compensation`
- Database migration: none
- Commit/push: intentionally not performed pending independent review

## Root Cause

`applyKnowledgeReviewAction` finalized the run as `approved` or `failed` before updating its events one by one. A later event failure therefore left a final run with incomplete events. The next call rejected that run as non-actionable, so the reported compensation could not actually resume.

## Implemented Contract

- Events are reviewed before the run receives its final status.
- Every reviewed event keeps `publicationState: unpublished`, `ontologyPublished: false`, and a `knowledge-human-review.v1` receipt.
- The receipt binds the operation to `runId`, `action`, `organizationId`, `siteId`, and authenticated reviewer ID.
- A retry accepts only already-completed events with a matching receipt and target status, then writes only pending events.
- A different action, scope, reviewer, or inconsistent receipt returns `review_idempotency_conflict` without another write.
- If all events are complete but the final run write failed, retry skips every event and finalizes only the run.
- Replaying an already completed matching request is a no-op success.
- A legacy run-first partial state with a final run status resumes only its pending events when the stored run/event receipt matches the current operation.
- An actionable run never reuses a stored receipt unless it parses and matches the current action, organization, site, and authenticated reviewer.
- A stale run-finalize race can be retried successfully when matching completed event receipts prove the operation.
- A run-only retry reports `eventsUpdated: false` and `eventsUpdatedCount: 0`.

## Independent Review Remediation

The first independent review was rejected. The follow-up RED suite reproduced all requested gaps:

- finalized legacy run with partial events could not resume
- actionable run reused mismatched stored receipts
- stale run-finalize lacked a successful second-call assertion
- run-only retry incorrectly reported events as updated
- reviewer change, null-site, and tampered receipt boundaries were not explicit

The remediation keeps the same schema and API while validating receipt identity before reuse and treating matching final-state runs as resumable compensation states.

## Residual Rereview Remediation

- The actionable overlap query can omit a finalized current run, so the conflict calculation now explicitly includes the current run and de-duplicates its query result.
- A finalized legacy resume sharing any event with another actionable run returns `review_shared_event_conflict` before writes.
- Receipt coverage now includes a scope-only tamper where the action remains unchanged.

## Final Legacy Compatibility Remediation

- Base `418a76d` receipts are parsed in their actual v1 shape without `operationId`, `runId`, `organizationId`, or `siteId`.
- Legacy receipts are accepted only for a matching final run compensation state after validating action, scope, reviewer, safety flags, tenant-scoped run, and event consistency.
- Any receipt containing only part of the current identity fields is not allowed to fall back to the legacy parser.
- An actionable run or event carrying an old receipt is treated as an arbitrary state and rejected before writes.
- Accepted old receipts are upgraded to the current identity-bound shape for pending event writes and final run normalization.
- A stale final run with missing, legacy, or published run output is conditionally normalized to a current receipt with `publicationState: unpublished` and `ontologyPublished: false`.

## Finalized Pair Conflict Remediation

- The overlap query now reads actionable plus `approved` and `failed` runs in the same organization and site scope.
- A finalized candidate participates when it shares an event currently in `pending_review`; conflict ownership is independent from receipt replay or upgrade eligibility.
- Two compensable finalized runs sharing the same pending event both return `review_shared_event_conflict` before writes, regardless of which run is called first.
- Cross-reviewer and malformed finalized receipts fail closed for pending-event conflicts, while replay and upgrade still require strict reviewer-bound receipt validation.
- Finalized rows overlapping only already-completed events remain excluded from conflict candidates.

## Completed Event Safety Remediation

- A matching receipt no longer makes a completed event skippable by itself; its top-level safety envelope must also be exactly unpublished with all effect flags false.
- Unsafe or incomplete completed event envelopes are conditionally normalized while preserving the completed review status and tenant/site scope.
- `buildReviewedOutput` and `buildReviewedEventProposal` now force `publicationState: unpublished`, `ontologyPublished: false`, `publishPerformed: false`, and `migrationPerformed: false`.
- Stale-final run normalization checks and writes the same four top-level fields.
- Published completed events and each true effect flag have dedicated regression coverage.

## Receipt Timestamp Remediation

- Current and legacy receipt parsers now share the repository `isRfc3339OffsetTimestamp` validator.
- Empty, calendar-rollover, offset-free, and otherwise invalid `reviewedAt` values fail before idempotency replay or upgrade resolution.
- A valid RFC3339 instant with an explicit offset remains replayable.
- Finalized pending-event conflict detection remains receipt-eligibility independent, while cross-reviewer receipt reuse remains rejected.

## TDD Evidence

RED command:

```powershell
npm.cmd test -- tests/knowledge-review-actions.test.ts
```

Initial RED observed 8 failing tests. The independent-review remediation added a second RED cycle with 8 expected failures covering the rejected findings.

GREEN command:

```powershell
npm.cmd test -- tests/knowledge-review-actions.test.ts tests/knowledge-review-route.test.ts
```

Result after remediation: action suite 37 passed, route suite 14 passed, combined 51 passed, 0 failed. The receipt timestamp RED reproduced empty and calendar-invalid current receipts being accepted as finalized no-op replays.

Typecheck command:

```powershell
npm.cmd run typecheck
```

Result: passed with `tsc --noEmit --incremental false`.

## Files

- `lib/knowledge-review.ts`
- `tests/knowledge-review-actions.test.ts`
- `evaluation/knowledge-review-compensation-2026-07-16/report.md`
- `evaluation/knowledge-review-compensation-2026-07-16/report.json`

## Review Notes

- Success outcomes remain `approved/approved` for approval actions and `failed/rejected` for rejection.
- No schema, migration, environment, or remote changes were made.
- `npm.cmd ci` was used once to restore dependencies already declared in `package-lock.json`; it produced no tracked dependency-file changes.
